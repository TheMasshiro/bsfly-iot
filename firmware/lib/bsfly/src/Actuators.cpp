#include "Actuators.h"
#include "MqttLink.h"

void beginMcp()
{
  // MCP23017 (DEGRADED MODE: do not return from setup())
  mcpAvailable = mcp.begin_I2C(MCP23017_ADDR);
  if (!mcpAvailable)
  {
    Serial.println(F("MCP23017 not found (degraded mode: actuators/light disabled)"));
    // DO NOT return;
  }
  else
  {
    for (int i = 0; i < 16; i++)
    {
      mcp.pinMode(i, OUTPUT);
      mcp.digitalWrite(i, HIGH);
    }
    Serial.println(F("MCP23017 initialized"));
  }
}

void ledOn()
{
  if (!mcpAvailable)
    return;
  mcp.digitalWrite(MCP_ENCLOSURE_LIGHT, LOW);
}

void ledOff()
{
  if (!mcpAvailable)
    return;
  mcp.digitalWrite(MCP_ENCLOSURE_LIGHT, HIGH);
}

void updateLightLed()
{
  if (lightState)
  {
    ledOn();
  }
  else
  {
    ledOff();
  }
}

bool applyActuatorState(const char *actuator, bool state)
{
  lastActuatorCommandTime = millis();

  // Manual change holdoff must be protected (used by multiple contexts)
  recordManualActuatorChangeLocked();

  if (strcmp(actuator, "light") == 0)
  {
    setLightTimerLocked(state, 0);
    updateLightLed();
    logActuatorCommand("light", state);
    return true;
  }
  else if (strcmp(actuator, "substrate") == 0 || strcmp(actuator, "pump") == 0)
  {
    setEggLarvaePump(state);
    logActuatorCommand("substrate", state);
    return true;
  }
  else if (strcmp(actuator, "humidifier1") == 0)
  {
    setEggLarvaeHumidifier(state);
    logActuatorCommand("humidifier1", state);
    return true;
  }
  else if (strcmp(actuator, "humidifier3") == 0)
  {
    setPupaHumidifier(state);
    logActuatorCommand("humidifier3", state);
    return true;
  }
  else if (strcmp(actuator, "humidifier") == 0)
  {
    setEggLarvaeHumidifier(state);
    setPupaHumidifier(state);
    logActuatorCommand("humidifier", state);
    return true;
  }
  else if (strcmp(actuator, "heater") == 0)
  {
    setEggLarvaeHeater(state);
    setEggLarvaeHeaterFan(state);
    logActuatorCommand("heater", state);
    return true;
  }
  else if (strcmp(actuator, "fan1") == 0)
  {
    setEggLarvaeFan(state);
    logActuatorCommand("fan1", state);
    return true;
  }
  else if (strcmp(actuator, "fan3") == 0)
  {
    setPupaFan(state);
    logActuatorCommand("fan3", state);
    return true;
  }
  return false;
}

void setMcpActuator(uint8_t pin, bool state)
{
  if (!mcpAvailable)
    return;
  mcp.digitalWrite(pin, state ? LOW : HIGH);
}

void logActuatorCommand(const char *actuator, bool state)
{
  if (state)
  {
    Serial.print(F("[ACTUATOR ON] "));
    Serial.println(actuator);
  }
  else
  {
    Serial.print(F("[ACTUATOR OFF] "));
    Serial.println(actuator);
  }
}

void publishActuatorStateBool(const char *actuator, bool state)
{
  if (!mqttEnabled)
    return;

  JsonDocument doc;
  doc["state"] = state;

  char payload[64];
  serializeJson(doc, payload, sizeof(payload));

  char topic[160];
  snprintf(topic, sizeof(topic), "%s/%s/actuators/%s/state", MQTT_BASE_TOPIC, DEVICE_ID.c_str(), actuator);

  mqttEnqueuePublish(topic, payload, true);
}

void publishLightTimerState(int timeSeconds, uint64_t startTimeMs)
{
  if (!mqttEnabled)
    return;

  JsonDocument doc;
  JsonObject state = doc["state"].to<JsonObject>();
  state["time"] = timeSeconds;
  state["startTime"] = startTimeMs;

  char payload[128];
  serializeJson(doc, payload, sizeof(payload));

  char topic[160];
  snprintf(topic, sizeof(topic), "%s/%s/actuators/light/state", MQTT_BASE_TOPIC, DEVICE_ID.c_str());

  mqttEnqueuePublish(topic, payload, false);
}

void checkLightTimerExpiry()
{
  if (lightEndTime > 0 && millis() >= lightEndTime)
  {
    // Make timer expiry atomic with respect to MQTT callback / actuator apply
    stateLock();
    bool expired = (lightEndTime > 0 && millis() >= lightEndTime);
    if (expired)
    {
      lightState = false;
      lightEndTime = 0;
    }
    stateUnlock();

    if (expired)
    {
      updateLightLed();
      publishActuatorStateBool("light", false);

      char clearTopic[160];
      snprintf(clearTopic, sizeof(clearTopic), "%s/%s/actuators/light/control",
               MQTT_BASE_TOPIC, DEVICE_ID.c_str());
      mqttEnqueuePublish(clearTopic, "", true);

      Serial.println(F("Light timer expired - Light OFF"));
    }
  }
}

void autoControlEggLarvaeDrawer(float temperature, float humidity, int leftMoisture, int centerMoisture, int rightMoisture)
{
  bool fanOn = false;
  bool heaterOn = false;
  bool heaterFanOn = false;
  bool humidifierOn = false;
  bool pumpOn = false;

  if (temperature > DRAWER1_TEMP_OPTIMAL_HIGH || temperature > DRAWER1_TEMP_MAX)
  {
    fanOn = true;
  }
  else if (temperature < DRAWER1_TEMP_OPTIMAL_LOW || temperature < DRAWER1_TEMP_MIN)
  {
    fanOn = false;
  }

  if (temperature < DRAWER1_TEMP_OPTIMAL_LOW || temperature < DRAWER1_TEMP_MIN)
  {
    heaterOn = true;
    heaterFanOn = true;
  }
  else if (temperature > DRAWER1_TEMP_OPTIMAL_HIGH || temperature > DRAWER1_TEMP_MAX)
  {
    heaterOn = false;
    heaterFanOn = false;
  }

  if (humidity < DRAWER1_HUMIDITY_OPTIMAL_LOW)
  {
    humidifierOn = true;
  }

  if (humidity > DRAWER1_HUMIDITY_OPTIMAL_HIGH)
  {
    fanOn = true;
  }

  if (fanOn)
  {
    humidifierOn = false;
  }

  if ((leftMoisture >= 0 && leftMoisture < DRAWER1_MOISTURE_OPTIMAL_LOW) ||
      (centerMoisture >= 0 && centerMoisture < DRAWER1_MOISTURE_OPTIMAL_LOW) ||
      (rightMoisture >= 0 && rightMoisture < DRAWER1_MOISTURE_OPTIMAL_LOW))
  {
    pumpOn = true;
  }

  setEggLarvaePump(pumpOn);
  setEggLarvaeFan(fanOn);
  setEggLarvaeHeater(heaterOn);
  setEggLarvaeHeaterFan(heaterFanOn);
  setEggLarvaeHumidifier(humidifierOn);

  publishActuatorStateBool("substrate", pumpOn);
  publishActuatorStateBool("fan1", fanOn);
  publishActuatorStateBool("heater", heaterOn);
  publishActuatorStateBool("humidifier1", humidifierOn);

  Serial.println(F("Auto control Drawer 1:"));
  Serial.print(F("  Temp="));
  Serial.print(temperature);
  Serial.print(F(" Hum="));
  Serial.print(humidity);
  Serial.print(F(" L/C/R="));
  Serial.print(leftMoisture);
  Serial.print(F("/"));
  Serial.print(centerMoisture);
  Serial.print(F("/"));
  Serial.println(rightMoisture);
  Serial.print(F("  Fan="));
  Serial.print(fanOn ? F("ON") : F("OFF"));
  Serial.print(F(" Heater="));
  Serial.print(heaterOn ? F("ON") : F("OFF"));
  Serial.print(F(" Humidifier="));
  Serial.print(humidifierOn ? F("ON") : F("OFF"));
  Serial.print(F(" Pump="));
  Serial.println(pumpOn ? F("ON") : F("OFF"));
}

void autoControlPupaDrawer(float temperature, float humidity)
{
  bool fanOn = false;
  bool humidifierOn = false;

  // Temperature: fan on when temp is high
  if (temperature > DRAWER2_TEMP_OPTIMAL_HIGH || temperature > DRAWER2_TEMP_MAX)
  {
    fanOn = true;
  }
  else if (temperature < DRAWER2_TEMP_OPTIMAL_LOW || temperature < DRAWER2_TEMP_MIN)
  {
    fanOn = false;
  }

  // Humidity: humidifier on when humidity is low
  if (humidity < DRAWER2_HUMIDITY_OPTIMAL_LOW)
  {
    humidifierOn = true;
  }
  else if (humidity > DRAWER2_HUMIDITY_OPTIMAL_HIGH)
  {
    humidifierOn = false;
  }

  // Humidity: fan on when humidity is high
  if (humidity > DRAWER2_HUMIDITY_OPTIMAL_HIGH || humidity > DRAWER2_HUMIDITY_MAX)
  {
    fanOn = true;
  }
  else if (humidity < DRAWER2_HUMIDITY_OPTIMAL_LOW)
  {
    fanOn = false;
  }

  if (fanOn)
  {
    humidifierOn = false;
  }

  setPupaFan(fanOn);
  setPupaHumidifier(humidifierOn);

  // Publish actuator states for drawer 2
  publishActuatorStateBool("fan3", fanOn);
  publishActuatorStateBool("humidifier3", humidifierOn);

  Serial.println(F("Auto control Drawer 2:"));
  Serial.print(F("  Temp="));
  Serial.print(temperature);
  Serial.print(F(" Hum="));
  Serial.println(humidity);
  Serial.print(F("  Fan="));
  Serial.println(fanOn ? F("ON") : F("OFF"));
}

void recordManualActuatorChange()
{
  recordManualActuatorChangeLocked();
}

bool isAutoControlActive()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    return true;
  }

  // Read mode under lock
  return getControlModeLocked() == CONTROL_MODE_AUTO;
}

void setRequestedControlMode(ControlMode mode)
{
  setControlModeLocked(mode);

  if (mqttEnabled)
  {
    JsonDocument doc;
    doc["state"] = getRequestedControlModeName();

    char payload[64];
    serializeJson(doc, payload, sizeof(payload));

    char topic[160];
    snprintf(topic, sizeof(topic), "%s/%s/actuators/mode/state", MQTT_BASE_TOPIC, DEVICE_ID.c_str());

    mqttEnqueuePublish(topic, payload, true);
  }

  Serial.print(F("[MODE] Requested control mode set to "));
  Serial.println(getRequestedControlModeName());
}

const char *getRequestedControlModeName()
{
  // Small: return based on a locked read to avoid stale/tearing
  ControlMode m = getControlModeLocked();
  return m == CONTROL_MODE_MANUAL ? "manual" : "auto";
}

void logConnectivityState(const char *source)
{
  bool wifiConnected = WiFi.status() == WL_CONNECTED;
  bool mqttConnected = mqttEnabled && mqttClient.connected();

  Serial.print(F("[MODE] Source="));
  Serial.print(source);
  Serial.print(F(" WiFi="));
  Serial.print(wifiConnected ? F("ON") : F("OFF"));
  Serial.print(F(" MQTT="));
  Serial.print(mqttConnected ? F("ON") : F("OFF"));
  Serial.print(F(" RequestedMode="));
  Serial.print(getRequestedControlModeName());
  Serial.print(F(" ActiveAuto="));
  Serial.print(isAutoControlActive() ? F("YES") : F("NO"));
  Serial.print(F(" LastHeartbeatCode="));
  Serial.println(lastHeartbeatHttpCode);
}
