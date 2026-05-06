#include "storage.h"
#include <SD.h>
#include <ArduinoJson.h>

extern String DEVICE_ID;
extern bool sdAvailable;
extern bool mqttEnabled;
extern Adafruit_ADS1X15 ads2;
extern bool ads2Available;
extern WiFiClientSecure gHttpsClient;  // HTTPS client for uploads

// Rounding helper
static inline double round2(double v)
{
  return round(v * 100.0) / 100.0;
}

// External function declarations
extern Nh3Metrics readNh3Metrics();
extern int16_t readAds2Channel(uint8_t channel);
extern bool canStartTlsNow(const char *op);
extern bool tlsTryLock(TickType_t timeout);
extern void tlsUnlock();
extern bool mqttEnqueuePublish(const char *topic, const char *payload, bool retain);

// External constants (defined in main.ino)
extern const int16_t ADS_INVALID;

// SD file definitions (extern from main.ino)
extern volatile bool sdUploadKick;
extern unsigned long gSdStoredCountCached;

#define SD_DATA_FILE "/sensors.jsonl"
#define SD_UPLOAD_MAX_PER_CYCLE 10
#define SD_UPLOAD_HTTP_TIMEOUT_MS 5000
#define BACKEND_URL "https://bsfly-api.vercel.app"

void storeSensorToSD(const char *drawerName, float temperature, float humidity,
                     int leftSubstrate, int centerSubstrate, int rightSubstrate, int ammonia)
{
  (void)ammonia;

  if (!sdAvailable)
    return;

  File file = SD.open(SD_DATA_FILE, FILE_APPEND);
  if (!file)
    return;

  JsonDocument doc;
  doc["macAddress"] = DEVICE_ID;
  doc["drawerName"] = drawerName;
  doc["temperature"] = round2(temperature);
  doc["humidity"] = round2(humidity);

  if (leftSubstrate >= 0)
    doc["leftSubstrate"] = round2((double)leftSubstrate);
  if (centerSubstrate >= 0)
    doc["centerSubstrate"] = round2((double)centerSubstrate);
  if (rightSubstrate >= 0)
    doc["rightSubstrate"] = round2((double)rightSubstrate);

  if (strcmp(drawerName, "Drawer 1") == 0)
  {
    Nh3Metrics nh3 = readNh3Metrics();
    if (nh3.valid)
    {
      if (isfinite(nh3.ppm))
        doc["ammonia"] = round2(nh3.ppm);
      if (isfinite(nh3.ratio))
        doc["ammoniaRatio"] = round2(nh3.ratio);
      doc["ammoniaRaw"] = (nh3.raw == ADS_INVALID) ? -1 : nh3.raw;
    }
  }

  doc["timestamp"] = millis();

  char line[384];
  size_t n = serializeJson(doc, line, sizeof(line));
  if (n > 0)
    file.println(line);

  file.close();
}

void uploadStoredData()
{
  if (!sdAvailable || WiFi.status() != WL_CONNECTED)
    return;

  if (!canStartTlsNow("sdUpload"))
    return;

  if (!tlsTryLock(pdMS_TO_TICKS(5000)))
  {
    Serial.println(F("[TLS] SD upload skipped: TLS mutex busy"));
    return;
  }

  File file = SD.open(SD_DATA_FILE, FILE_READ);
  if (!file)
  {
    tlsUnlock();
    return;
  }

  const char *tempPath = "/temp_data.json";
  File tempFile = SD.open(tempPath, FILE_WRITE);

  const String url = String(BACKEND_URL) + "/api/sensors";

  int uploaded = 0;
  int failed = 0;
  int processedThisCycle = 0;
  bool hasPendingData = false;

  char lineBuf[384];

  auto readLine = [&](File &f, char *buf, size_t bufLen) -> bool
  {
    size_t n = f.readBytesUntil('\n', buf, bufLen - 1);
    if (n == 0)
      return false;
    buf[n] = '\0';

    while (n > 0 && (buf[n - 1] == '\r' || buf[n - 1] == ' ' || buf[n - 1] == '\t'))
    {
      buf[n - 1] = '\0';
      n--;
    }

    size_t start = 0;
    while (buf[start] == ' ' || buf[start] == '\t')
      start++;

    if (start > 0)
      memmove(buf, buf + start, strlen(buf + start) + 1);

    return strlen(buf) > 0;
  };

  while (file.available())
  {
    if (processedThisCycle >= SD_UPLOAD_MAX_PER_CYCLE)
      break;

    if (!readLine(file, lineBuf, sizeof(lineBuf)))
      continue;

    JsonDocument doc;
    if (deserializeJson(doc, lineBuf) != DeserializationError::Ok)
      continue;

    HTTPClient http;
    http.setTimeout(SD_UPLOAD_HTTP_TIMEOUT_MS);

    if (!http.begin(gHttpsClient, url))
    {
      if (tempFile)
      {
        tempFile.println(lineBuf);
        hasPendingData = true;
      }
      failed++;
      processedThisCycle++;
      continue;
    }

    http.addHeader("Content-Type", "application/json");
    int httpCode = http.POST((uint8_t *)lineBuf, strlen(lineBuf));
    http.end();

    if (httpCode == 200 || httpCode == 201)
    {
      uploaded++;
    }
    else
    {
      if (tempFile)
      {
        tempFile.println(lineBuf);
        hasPendingData = true;
      }
      failed++;
    }

    processedThisCycle++;
    yield();
  }

  while (file.available())
  {
    if (!readLine(file, lineBuf, sizeof(lineBuf)))
      continue;

    if (tempFile)
    {
      tempFile.println(lineBuf);
      hasPendingData = true;
    }
  }

  file.close();
  if (tempFile)
    tempFile.close();

  SD.remove(SD_DATA_FILE);
  if (hasPendingData && SD.exists(tempPath))
  {
    SD.rename(tempPath, SD_DATA_FILE);
  }
  else
  {
    SD.remove(tempPath);
  }

  if (uploaded > 0)
  {
    Serial.print(F("Uploaded "));
    Serial.print(uploaded);
    Serial.println(F(" stored readings"));
  }
  if (failed > 0)
  {
    Serial.print(F("Failed to upload "));
    Serial.print(failed);
    Serial.println(F(" readings (kept for retry)"));
  }

  tlsUnlock();
}

int getStoredDataCount()
{
  if (!sdAvailable || !SD.exists(SD_DATA_FILE))
    return 0;

  File file = SD.open(SD_DATA_FILE, FILE_READ);
  if (!file)
    return 0;

  char buf[384];

  auto readLine = [&](File &f, char *out, size_t outLen) -> bool
  {
    size_t n = f.readBytesUntil('\n', out, outLen - 1);
    if (n == 0)
      return false;
    out[n] = '\0';

    while (n > 0 && (out[n - 1] == '\r' || out[n - 1] == ' ' || out[n - 1] == '\t'))
    {
      out[n - 1] = '\0';
      n--;
    }

    size_t start = 0;
    while (out[start] == ' ' || out[start] == '\t')
      start++;

    if (start > 0)
      memmove(out, out + start, strlen(out + start) + 1);

    return strlen(out) > 0;
  };

  int count = 0;
  while (file.available())
  {
    if (readLine(file, buf, sizeof(buf)))
      count++;
  }

  file.close();
  return count;
}

void sdCountTask(void *pvParameters)
{
  (void)pvParameters;

  // Initial fill
  if (sdAvailable)
    gSdStoredCountCached = getStoredDataCount();
  else
    gSdStoredCountCached = 0;

  for (;;)
  {
    // Update every 10s; keep off the async web task
    if (sdAvailable)
      gSdStoredCountCached = getStoredDataCount();
    else
      gSdStoredCountCached = 0;

    vTaskDelay(pdMS_TO_TICKS(10000));
  }
}
