#include "ServerApi.h"

void configureTlsClient(WiFiClientSecure &client, const char *rootCa, const char *tag)
{
#ifdef ALLOW_INSECURE_TLS
  (void)rootCa;
  client.setInsecure();
  Serial.print(F("[TLS] WARNING: certificate verification disabled for "));
  Serial.println(tag);
#else
  client.setCACert(rootCa);
#endif
}

bool tlsTryLock(TickType_t waitTicks)
{
  if (!gTlsMutex)
    return false;
  return xSemaphoreTake(gTlsMutex, waitTicks) == pdTRUE;
}

void tlsUnlock()
{
  if (gTlsMutex)
    xSemaphoreGive(gTlsMutex);
}

bool canStartTlsNow(const char *tag)
{
  uint32_t heap = ESP.getFreeHeap();
  uint32_t minHeap = ESP.getMinFreeHeap();

  if (heap < TLS_MIN_FREE_HEAP || minHeap < TLS_MIN_FREE_HEAP_MIN)
  {
    Serial.print(F("[TLS] Skip "));
    Serial.print(tag);
    Serial.print(F(": heap="));
    Serial.print(heap);
    Serial.print(F(" minHeap="));
    Serial.println(minHeap);
    return false;
  }
  return true;
}

bool sendHeartbeat()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println(F("WiFi disconnected, skipping heartbeat"));
    lastHeartbeatHttpCode = -1000;
    return false;
  }

  if (millis() < gTlsFailCooldownUntilMs)
  {
    lastHeartbeatHttpCode = -1004;
    return false;
  }

  if (!canStartTlsNow("heartbeat"))
  {
    lastHeartbeatHttpCode = -1002; // low heap / fragmented
    return false;
  }

  if (!tlsTryLock(pdMS_TO_TICKS(1500)))
  {
    Serial.println(F("[TLS] Heartbeat skipped: TLS mutex busy"));
    lastHeartbeatHttpCode = -1003;
    return false;
  }

  HTTPClient http;
  http.setTimeout(HEARTBEAT_TIMEOUT_MS);

  String heartbeatUrl = String(BACKEND_URL) + "/api/devices/" + DEVICE_ID + "/heartbeat";

  Serial.print(F("Sending heartbeat to: "));
  Serial.println(heartbeatUrl);

  if (!http.begin(gHttpsClient, heartbeatUrl))
  {
    Serial.println(F("HTTP begin failed"));
    lastHeartbeatHttpCode = -1001;
    tlsUnlock();
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", DEVICE_API_KEY);

  JsonDocument doc;
  doc["ipAddress"] = WiFi.localIP().toString();
  String jsonPayload;
  serializeJson(doc, jsonPayload);

  int httpCode = http.POST(jsonPayload);
  lastHeartbeatHttpCode = httpCode;

  http.end();
  tlsUnlock();

  if (httpCode == 200)
  {
    Serial.println(F("Heartbeat sent - device online"));
    return true;
  }

  if (httpCode == 404)
  {
    Serial.println(F("Device not registered. Register in app Settings."));
  }
  else
  {
    Serial.print(F("Heartbeat failed, code: "));
    Serial.println(httpCode);
    if (httpCode < 0)
      Serial.println(F("[MODE] Internet/DNS unreachable while WiFi is connected"));
  }

  if (httpCode < 0)
  {
    // Back off 60s on transport/TLS errors to avoid repeated heap fragmentation.
    gTlsFailCooldownUntilMs = millis() + 60000UL;
  }

  return false;
}

void heartbeatTask(void *pvParameters)
{
  (void)pvParameters;

  for (;;)
  {
    // Wait until next interval OR until someone kicks us (notify)
    ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(HEARTBEAT_INTERVAL));

    unsigned long now = millis();
    if (now - lastActuatorCommandTime < HEARTBEAT_COOLDOWN_AFTER_ACTUATOR_MS)
      continue;

    bool ok = sendHeartbeat();
    if (!ok)
      Serial.println(F("[MODE] Heartbeat check failed; operating in offline/degraded behavior"));

    lastHeartbeatTime = millis();
  }
}

uint64_t getServerTime()
{
  if (WiFi.status() != WL_CONNECTED)
    return 0;

  if (!canStartTlsNow("serverTime"))
    return 0;

  if (!tlsTryLock(pdMS_TO_TICKS(1500)))
  {
    Serial.println(F("[TLS] getServerTime skipped: TLS mutex busy"));
    return 0;
  }

  HTTPClient http;
  http.setTimeout(2000);

  if (!http.begin(gHttpsClient, String(BACKEND_URL) + "/api/time"))
  {
    tlsUnlock();
    return 0;
  }

  http.addHeader("x-api-key", DEVICE_API_KEY);
  int httpCode = http.GET();
  uint64_t serverTime = 0;

  if (httpCode == 200)
  {
    String payload = http.getString();
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, payload);
    if (!err && !doc["now"].isNull())
      serverTime = doc["now"].as<uint64_t>();
  }

  http.end();
  tlsUnlock();
  return serverTime;
}
