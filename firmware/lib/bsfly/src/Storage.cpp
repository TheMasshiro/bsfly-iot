#include "Storage.h"
#include "Sensors.h"
#include "ServerApi.h"

void beginSd()
{
  // Initialize SPI for SD card
  pinMode(SPI_CS_SD, OUTPUT);
  digitalWrite(SPI_CS_SD, HIGH);

  SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, SPI_CS_SD);

  vTaskDelay(100);

  sdAvailable = SD.begin(SPI_CS_SD, SPI, 2000000);
  if (sdAvailable)
  {
    uint8_t cardType = SD.cardType();
    if (cardType == CARD_NONE)
    {
      Serial.println(F("No SD card attached"));
      sdAvailable = false;
    }
    else
    {
      Serial.print(F("SD card type: "));
      if (cardType == CARD_MMC)
        Serial.println(F("MMC"));
      else if (cardType == CARD_SD)
        Serial.println(F("SDSC"));
      else if (cardType == CARD_SDHC)
        Serial.println(F("SDHC"));
      else
        Serial.println(F("UNKNOWN"));

      uint64_t cardSize = SD.cardSize() / (1024 * 1024);
      Serial.printf("SD card size: %lluMB\n", cardSize);
    }
  }
  else
  {
    Serial.println(F("SD card mount failed. Check:"));
    Serial.println(F("  - Wiring: SCK=18, MISO=19, MOSI=23, CS=15"));
    Serial.println(F("  - Card formatted as FAT32"));
    Serial.println(F("  - Card inserted properly"));
  }
}

void storeSensorToSD(const char *drawerName, float temperature, float humidity,
                     int leftSubstrate, int centerSubstrate, int rightSubstrate, int ammonia)
{
  (void)ammonia; // Option A

  if (!sdAvailable)
    return;

  File file = SD.open(SD_DATA_FILE, FILE_APPEND);
  if (!file)
    return;

  JsonDocument doc;
  doc["macAddress"] = DEVICE_ID;
  doc["drawerName"] = drawerName;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;

  if (leftSubstrate >= 0)
    doc["leftSubstrate"] = leftSubstrate;
  if (centerSubstrate >= 0)
    doc["centerSubstrate"] = centerSubstrate;
  if (rightSubstrate >= 0)
    doc["rightSubstrate"] = rightSubstrate;

  // Keep SD schema consistent with backend uploads: "ammonia" carries ppm for Drawer 1
  if (strcmp(drawerName, "Drawer 1") == 0)
  {
    Nh3Metrics nh3 = readNh3Metrics();
    if (nh3.valid)
    {
      if (isfinite(nh3.ppm))
        doc["ammonia"] = nh3.ppm; // ammonia == ppm
      if (isfinite(nh3.ratio))
        doc["ammoniaRatio"] = nh3.ratio;
      doc["ammoniaRaw"] = (nh3.raw == ADS_INVALID) ? -1 : nh3.raw;
    }
  }

  // Store device-local millis so we can attach accurate server-time timestamps when uploading
  doc["deviceTimestampMs"] = (uint64_t)millis();

  char line[1024];
  size_t n = serializeJson(doc, line, sizeof(line));
  if (n > 0)
    file.println(line);

  file.close();
}

void uploadStoredData()
{
  if (!sdAvailable || WiFi.status() != WL_CONNECTED)
    return;

  // Avoid TLS attempts when heap is low/fragmented
  if (!canStartTlsNow("sdUpload"))
    return;

  // Serialize TLS across heartbeat/serverTime/sdUpload
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
  uint64_t serverNowMs = getServerTime();
  uint64_t nowMs = (uint64_t)millis();

  char lineBuf[1024];

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

    // Attempt to adjust timestamps to server time if available
    // We'll get server time once before processing lines (see above)
    if (serverNowMs > 0 && doc.containsKey("deviceTimestampMs"))
    {
      uint64_t deviceTs = doc["deviceTimestampMs"] | 0ULL;
      if (deviceTs > 0)
      {
        // approximate original event time as: serverNow - (nowMs - deviceTs)
        uint64_t corrected = (serverNowMs > nowMs && serverNowMs - nowMs > 0) ? (serverNowMs - (nowMs - deviceTs)) : (serverNowMs - (nowMs - deviceTs));
        doc["timestamp"] = corrected; // send epoch ms
      }
    }

    // Re-serialize potentially-updated doc into a buffer for POST
    char postBuf[1024];
    size_t postLen = serializeJson(doc, postBuf, sizeof(postBuf));
    if (postLen == 0) continue;

    HTTPClient http;
    http.setTimeout(SD_UPLOAD_HTTP_TIMEOUT_MS);

    // IMPORTANT: reuse the global TLS client (less heap churn/fragmentation)
    if (!http.begin(gHttpsClient, url))
    {
      if (tempFile)
      {
        tempFile.println(postBuf);
        hasPendingData = true;
      }
      failed++;
      processedThisCycle++;
      continue;
    }

    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", DEVICE_API_KEY);
    int httpCode = http.POST((uint8_t *)postBuf, postLen);
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

  char buf[1024];

  auto readLine = [&](File &f, char *out, size_t outLen) -> bool
  {
    size_t n = f.readBytesUntil('\n', out, outLen - 1);
    if (n == 0)
      return false;
    out[n] = '\0';

    // Trim CR and whitespace at end
    while (n > 0 && (out[n - 1] == '\r' || out[n - 1] == ' ' || out[n - 1] == '\t'))
    {
      out[n - 1] = '\0';
      n--;
    }

    // Skip leading whitespace
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

void sdUploadTask(void *pvParameters)
{
  (void)pvParameters;

  for (;;)
  {
    if (sdUploadKick)
    {
      sdUploadKick = false;
      uploadStoredData();
    }

    vTaskDelay(pdMS_TO_TICKS(200));
  }
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
