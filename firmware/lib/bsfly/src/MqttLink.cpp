#include "MqttLink.h"
#include "Actuators.h"
#include "Sensors.h"
#include "ServerApi.h"

void initMqttQueue()
{
  if (!gMqttPublishQueue)
    gMqttPublishQueue = xQueueCreate(12, sizeof(MqttPublishItem));
}

bool sendSensorReading(const char *drawerName, float temperature, float humidity,
                       int leftSubstrate, int centerSubstrate, int rightSubstrate, int ammonia)
{
  (void)ammonia; // Option A: ignore legacy ammonia %

  if (!mqttEnabled)
    return false;

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

  // Drawer 1: backend expects "ammonia" => send NH3 ppm as "ammonia" (float OK; backend converts to int)
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

  char payload[384];
  size_t n = serializeJson(doc, payload, sizeof(payload));
  if (n == 0)
    return false;

  char topic[128];
  snprintf(topic, sizeof(topic), "%s/%s/sensors", MQTT_BASE_TOPIC, DEVICE_ID.c_str());

  return mqttEnqueuePublish(topic, payload, false);
}

bool mqttEnqueuePublish(const char *topic, const char *payload, bool retain)
{
  if (!mqttEnabled)
    return false;
  if (!gMqttPublishQueue)
    return false;
  if (!topic || !payload)
    return false;

  MqttPublishItem item{};
  strncpy(item.topic, topic, sizeof(item.topic) - 1);
  strncpy(item.payload, payload, sizeof(item.payload) - 1);
  item.retain = retain;

  // Non-blocking: keep system responsive, drop if queue is full.
  if (xQueueSend(gMqttPublishQueue, &item, 0) != pdTRUE)
  {
    gMqttQueueDropCount++;
    return false;
  }

  return true;
}

void mqttDrainQueue()
{
  if (!mqttEnabled || !mqttClient.connected() || !gMqttPublishQueue)
    return;

  MqttPublishItem item;
  const int kMaxPerLoop = 8;

  for (int i = 0; i < kMaxPerLoop; i++)
  {
    if (xQueueReceive(gMqttPublishQueue, &item, 0) != pdTRUE)
      break;

    mqttClient.publish(item.topic, item.payload, item.retain);
  }
}

void mqttCallback(char *topic, byte *payload, unsigned int length)
{
  // Copy payload to a bounded C string
  char msg[256];
  unsigned int n = (length < sizeof(msg) - 1) ? length : (sizeof(msg) - 1);
  memcpy(msg, payload, n);
  msg[n] = '\0';

  Serial.print(F("MQTT msg ["));
  Serial.print(topic);
  Serial.print(F("] "));
  Serial.println(msg);

  // Expected: devices/<MAC>/actuators/<actuator>/control
  const char *base = MQTT_BASE_TOPIC;
  size_t baseLen = strlen(base);

  if (strncmp(topic, base, baseLen) != 0 || topic[baseLen] != '/')
    return;

  const char *p = topic + baseLen + 1; // after "devices/"
  const char *slash1 = strchr(p, '/');
  if (!slash1)
    return;
  // mac is p..slash1-1 (we currently don't use it)
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

  // JSON parse (bounded)
  JsonDocument d;
  bool isJson = (deserializeJson(d, msg) == DeserializationError::Ok);

  // Handle mode actuator
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

  // Light timer JSON object case (same as your current logic)
  if (strcmp(actuator, "light") == 0 && isJson && d["state"].is<JsonObject>())
  {
    int timeSeconds = d["state"]["time"] | 0;
    uint64_t startTimeMs = d["state"]["startTime"] | 0ULL;

    if (timeSeconds > 0 && startTimeMs > 0)
    {
      uint64_t durationMs = (uint64_t)timeSeconds * 1000ULL;
      uint64_t endTimeMs = startTimeMs + durationMs;

      unsigned long deviceNow = millis();
      unsigned long deviceEnd = deviceNow + (unsigned long)durationMs;

      if (durationMs > 0)
      {
        setLightTimerLocked(true, deviceEnd);
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

      char clearTopic[160];
      snprintf(clearTopic, sizeof(clearTopic), "%s/%s/actuators/light/control",
               MQTT_BASE_TOPIC, DEVICE_ID.c_str());
      mqttEnqueuePublish(clearTopic, "", true);

      Serial.println(F("Light (MQTT): OFF"));
    }
    return;
  }

  // Parse state for other actuators
  bool state = false;
  if (strcmp(msg, "true") == 0 || strcmp(msg, "1") == 0)
    state = true;
  else if (isJson && d["state"].is<bool>())
    state = d["state"].as<bool>();

  if (WiFi.status() == WL_CONNECTED && requestedControlMode == CONTROL_MODE_AUTO && strcmp(actuator, "light") != 0)
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

  configureTlsClient(espClient, MQTT_ROOT_CA, "MQTT");

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
      setRequestedControlMode(requestedControlMode);
    }
    else
    {
      Serial.print(F("MQTT connect failed, rc="));
      Serial.println(mqttClient.state());
    }
  }
}
