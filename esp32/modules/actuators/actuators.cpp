#include "actuators.h"
#include <ArduinoJson.h>

// External dependencies
extern bool mcpAvailable, lightState;
extern Adafruit_MCP23X17 mcp;
extern String DEVICE_ID;
extern bool mqttEnabled;
extern const char* MQTT_BASE_TOPIC;

// MCP23017 pins
#define MCP_ENCLOSURE_LIGHT 0
#define MCP_EGGLARVAE_PUMP 1
#define MCP_EGGLARVAE_HUMIDIFIER 2
#define MCP_EGGLARVAE_FANS 3
#define MCP_EGGLARVAE_HEATER 4
#define MCP_EGGLARVAE_HEATER_FANS 5
#define MCP_PUPA_HUMIDIFIER 6
#define MCP_PUPA_FAN 7

// External functions
extern void setMcpActuator(uint8_t pin, bool state);
extern void logActuatorCommand(const char *actuator, bool state);
extern void mqttEnqueuePublish(const char *topic, const char *payload, bool retain);
extern void setLightTimerLocked(bool on, unsigned long endTimeMs);
extern void getLightTimerLocked(bool &on, unsigned long &endTimeMs);
extern unsigned long lightEndTime;
extern void recordManualActuatorChangeLocked();
extern unsigned long lastActuatorCommandTime;

// Individual actuator setters
inline void setEggLarvaePump(bool state) 
{ 
  setMcpActuator(MCP_EGGLARVAE_PUMP, state); 
}

inline void setEggLarvaeHumidifier(bool state) 
{ 
  setMcpActuator(MCP_EGGLARVAE_HUMIDIFIER, state); 
}

inline void setEggLarvaeFan(bool state) 
{ 
  setMcpActuator(MCP_EGGLARVAE_FANS, state); 
}

inline void setEggLarvaeHeater(bool state) 
{ 
  setMcpActuator(MCP_EGGLARVAE_HEATER, state); 
}

inline void setEggLarvaeHeaterFan(bool state) 
{ 
  setMcpActuator(MCP_EGGLARVAE_HEATER_FANS, state); 
}

inline void setPupaHumidifier(bool state) 
{ 
  setMcpActuator(MCP_PUPA_HUMIDIFIER, state); 
}

inline void setPupaFan(bool state) 
{ 
  setMcpActuator(MCP_PUPA_FAN, state); 
}

// LED control
void updateLightLed()
{
  if (!mcpAvailable)
    return;
  mcp.digitalWrite(MCP_ENCLOSURE_LIGHT, lightState ? LOW : HIGH);
}

// Main actuator dispatcher
bool applyActuatorState(const char *actuator, bool state)
{
  lastActuatorCommandTime = millis();
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

// Logging
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

// MQTT publishing
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

  mqttEnqueuePublish(topic, payload, true);
}
