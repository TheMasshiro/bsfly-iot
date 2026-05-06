#include "connectivity.h"
#include <ArduinoJson.h>

// External dependencies
extern WiFiClientSecure gHttpsClient;
extern WiFiClient espClient;
extern PubSubClient mqttClient;
extern String DEVICE_ID, DEVICE_ID_CLEAN;
extern bool mqttEnabled;
extern TaskHandle_t heartbeatTaskHandle;
extern unsigned long lastHeartbeatTime;
extern unsigned long lastActuatorCommandTime;
extern unsigned long lastMqttReconnectAttempt;
extern int lastHeartbeatHttpCode;
extern uint32_t gTlsFailCooldownUntilMs;

// Configuration constants (defined in credentials)
extern const char* BACKEND_URL;
extern const char* MQTT_BROKER;
extern const uint16_t MQTT_PORT;
extern const char* MQTT_USER;
extern const char* MQTT_PASS;
extern const char* MQTT_BASE_TOPIC;

// Timing constants
#define HEARTBEAT_INTERVAL pdMS_TO_TICKS(30000)
#define HEARTBEAT_TIMEOUT_MS 8000
#define HEARTBEAT_COOLDOWN_AFTER_ACTUATOR_MS 2000
#define MQTT_RECONNECT_INTERVAL_MS 10000

// External functions
extern bool canStartTlsNow(const char *reason);
extern bool tlsTryLock(TickType_t waitTicks);
extern void tlsUnlock();
extern bool applyActuatorState(const char *actuator, bool state);
extern void publishActuatorStateBool(const char *actuator, bool state);
extern void publishLightTimerState(int seconds, uint64_t startTimeMs);
extern ControlMode getRequestedControlMode();
extern void setRequestedControlMode(ControlMode mode);

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
    lastHeartbeatHttpCode = -1002;
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
    gTlsFailCooldownUntilMs = millis() + 60000UL;
  }

  return false;
}

void kickHeartbeatNow()
{
  if (heartbeatTaskHandle)
    xTaskNotifyGive(heartbeatTaskHandle);
}

void heartbeatTask(void *pvParameters)
{
  (void)pvParameters;

  for (;;)
  {
    ulTaskNotifyTake(pdTRUE, HEARTBEAT_INTERVAL);

    unsigned long now = millis();
    if (now - lastActuatorCommandTime < HEARTBEAT_COOLDOWN_AFTER_ACTUATOR_MS)
      continue;

    bool ok = sendHeartbeat();
    if (!ok)
      Serial.println(F("[MODE] Heartbeat check failed; operating in offline/degraded behavior"));

    lastHeartbeatTime = millis();
  }
}

void setActuatorState(const char *actuatorType, bool state)
{
  if (WiFi.status() != WL_CONNECTED)
    return;

  if (!canStartTlsNow("actuatorState"))
    return;

  if (!tlsTryLock(pdMS_TO_TICKS(2000)))
  {
    Serial.println(F("[TLS] setActuatorState skipped: TLS mutex busy"));
    return;
  }

  HTTPClient http;
  http.setTimeout(2000);

  String url = String(BACKEND_URL) + "/api/actuators/" + DEVICE_ID + ":" + actuatorType;

  if (!http.begin(gHttpsClient, url))
  {
    Serial.println(F("[TLS] setActuatorState: HTTP begin failed"));
    http.end();
    tlsUnlock();
    return;
  }

  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
  doc["state"] = state;

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);

  http.end();
  tlsUnlock();

  if (httpCode == 200 || httpCode == 201)
  {
    Serial.print(F("Actuator "));
    Serial.print(actuatorType);
    Serial.print(F(" set to "));
    Serial.println(state ? F("ON") : F("OFF"));
  }
  else
  {
    Serial.print(F("Actuator HTTP failed, code: "));
    Serial.println(httpCode);
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

  int httpCode = http.GET();
  uint64_t serverTime = 0;

  if (httpCode == 200)
  {
    String payload = http.getString();
    JsonDocument doc;
    if (deserializeJson(doc, payload) == DeserializationError::Ok)
    {
      serverTime = doc["timestamp"] | 0ULL;
    }
  }

  http.end();
  tlsUnlock();

  return serverTime;
}

void mqttCallback(char *topic, byte *payload, unsigned int length)
{
  char msg[256];
  unsigned int n = (length < sizeof(msg) - 1) ? length : (sizeof(msg) - 1);
  memcpy(msg, payload, n);
  msg[n] = '\0';

  Serial.print(F("MQTT msg ["));
  Serial.print(topic);
  Serial.print(F("] "));
  Serial.println(msg);

  const char *base = MQTT_BASE_TOPIC;
  size_t baseLen = strlen(base);

  if (strncmp(topic, base, baseLen) != 0 || topic[baseLen] != '/')
    return;

  const char *p = topic + baseLen + 1;
  const char *slash1 = strchr(p, '/');
  if (!slash1)
    return;

  const char *afterMac = slash1 + 1;

  const char *actPrefix = "actuators/";
  size_t actPrefixLen = strlen(actPrefix);
  if (strncmp(afterMac, actPrefix, actPrefixLen) != 0)
    return;

  const char *actuatorStart = afterMac + actPrefixLen;
  const char *slash2 = strchr(actuatorStart, '/');
  if (!slash2)
    return;

  char actuator[32];
  size_t actuatorLen = (size_t)(slash2 - actuatorStart);
  if (actuatorLen == 0 || actuatorLen >= sizeof(actuator))
    return;
  memcpy(actuator, actuatorStart, actuatorLen);
  actuator[actuatorLen] = '\0';

  const char *last = slash2 + 1;
  if (strcmp(last, "control") != 0)
    return;

  JsonDocument d;
  bool isJson = (deserializeJson(d, msg) == DeserializationError::Ok);

  if (strcmp(actuator, "mode") == 0)
  {
    const char *requestedMode = nullptr;
    if (isJson && !d["state"].isNull())
    {
      requestedMode = d["state"].as<const char *>();
    }
    else
    {
      requestedMode = msg;
    }

    if (requestedMode && (strcasecmp(requestedMode, "manual") == 0))
      setRequestedControlMode(CONTROL_MODE_MANUAL);
    else
      setRequestedControlMode(CONTROL_MODE_AUTO);

    return;
  }

  if (strcmp(actuator, "light") == 0 && isJson && d["state"].is<JsonObject>())
  {
    int timeSeconds = d["state"]["time"] | 0;
    uint64_t startTimeMs = d["state"]["startTime"] | 0ULL;

    if (timeSeconds > 0 && startTimeMs > 0)
    {
      uint64_t durationMs = (uint64_t)timeSeconds * 1000ULL;
      uint64_t endTimeMs = startTimeMs + durationMs;

      uint64_t localNowMs = millis();
      uint64_t estimatedRemaining = (endTimeMs > (startTimeMs + localNowMs))
                                        ? (endTimeMs - (startTimeMs + localNowMs))
                                        : 0ULL;

      if (estimatedRemaining > 0)
      {
        setLightTimerLocked(true, (unsigned long)(localNowMs + estimatedRemaining));
      }
      else
      {
        setLightTimerLocked(false, 0);
      }

      updateLightLed();

      bool on;
      unsigned long endT;
      getLightTimerLocked(on, endT);

      if (on)
        publishLightTimerState(timeSeconds, startTimeMs);
      else
        publishActuatorStateBool("light", false);

      Serial.print(F("Light (MQTT timer): "));
      Serial.println(on ? F("ON") : F("OFF"));
    }
    else
    {
      setLightTimerLocked(false, 0);
      updateLightLed();
      publishActuatorStateBool("light", false);
      Serial.println(F("Light (MQTT): OFF"));
    }
    return;
  }

  bool state = false;
  if (strcmp(msg, "true") == 0 || strcmp(msg, "1") == 0)
    state = true;
  else if (isJson && d["state"].is<bool>())
    state = d["state"].as<bool>();

  if (WiFi.status() == WL_CONNECTED && getRequestedControlMode() == CONTROL_MODE_AUTO)
  {
    Serial.print(F("Ignored manual actuator command while AUTO mode is active: "));
    Serial.println(actuator);
    return;
  }

  bool applied = applyActuatorState(actuator, state);
  if (applied)
  {
    publishActuatorStateBool(actuator, state);
    Serial.print(F("Actuator via MQTT: "));
    Serial.print(actuator);
    Serial.print(F(" = "));
    Serial.println(state ? F("ON") : F("OFF"));
  }
  else
  {
    Serial.print(F("Unsupported actuator command: "));
    Serial.println(actuator);
  }
}

void mqttReconnect()
{
  if (!mqttEnabled)
    return;

  lastMqttReconnectAttempt = millis();

  espClient.setInsecure();

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  if (!mqttClient.connected())
  {
    String clientId = "esp32-" + DEVICE_ID_CLEAN;
    Serial.print(F("Connecting to MQTT broker "));
    Serial.println(MQTT_BROKER);

    bool ok = false;
    if (strlen(MQTT_USER) > 0)
    {
      ok = mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS);
    }
    else
    {
      ok = mqttClient.connect(clientId.c_str());
    }

    if (ok)
    {
      Serial.println(F("MQTT connected"));
      String topic = "devices/" + DEVICE_ID + "/actuators/+/control";
      mqttClient.subscribe(topic.c_str());
      setRequestedControlMode(getRequestedControlMode());
    }
    else
    {
      Serial.print(F("MQTT connect failed, rc="));
      Serial.println(mqttClient.state());
    }
  }
}
