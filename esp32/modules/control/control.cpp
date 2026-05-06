#include "control.h"
#include <ArduinoJson.h>
#include <math.h>

// External dependencies
extern WiFiClient espClient;
extern String DEVICE_ID;
extern bool mqttEnabled;
extern const char* MQTT_BASE_TOPIC;

// Hardware thresholds (from main)
#define TEMP_OPTIMAL_LOW 24.0f
#define TEMP_OPTIMAL_HIGH 28.0f
#define TEMP_MIN 15.0f
#define TEMP_MAX 40.0f
#define HUMIDITY_OPTIMAL_LOW 70.0f
#define HUMIDITY_OPTIMAL_HIGH 85.0f
#define MOISTURE_OPTIMAL_LOW 40
#define MOISTURE_MIN 20
#define OFFLINE_AUTOCONTROL_HOLD_MS 5000

// External functions
extern void setEggLarvaePump(bool state);
extern void setEggLarvaeFan(bool state);
extern void setEggLarvaeHeater(bool state);
extern void setEggLarvaeHeaterFan(bool state);
extern void setEggLarvaeHumidifier(bool state);
extern void setPupaFan(bool state);
extern void setPupaHumidifier(bool state);
extern void mqttEnqueuePublish(const char *topic, const char *payload, bool retain);
extern void stateLock();
extern void stateUnlock();

// State management
extern ControlMode requestedControlMode;
extern unsigned long offlineAutoControlHoldUntil;

// Drawer 1: Full environmental control
void autoControlEggLarvaeDrawer(float temperature, float humidity, int moisture)
{
  bool fanOn = false;
  bool heaterOn = false;
  bool heaterFanOn = false;
  bool humidifierOn = false;
  bool pumpOn = false;

  // Temperature control: fan for cooling, heater for warming
  if (temperature > TEMP_OPTIMAL_HIGH)
  {
    fanOn = true;
    heaterOn = false;
    heaterFanOn = false;
  }
  else if (temperature < TEMP_OPTIMAL_LOW)
  {
    fanOn = false;
    heaterOn = true;
    heaterFanOn = true;
  }

  if (temperature > TEMP_MAX)
  {
    fanOn = true;
    heaterOn = false;
    heaterFanOn = false;
  }
  else if (temperature < TEMP_MIN)
  {
    fanOn = false;
    heaterOn = true;
    heaterFanOn = true;
  }

  // Humidity control: humidifier when humidity is low (mutually exclusive with fans)
  if (humidity < HUMIDITY_OPTIMAL_LOW)
  {
    humidifierOn = true;
    fanOn = false;
  }
  else if (humidity >= HUMIDITY_OPTIMAL_HIGH)
  {
    humidifierOn = false;
  }

  // Moisture control
  if (moisture < MOISTURE_OPTIMAL_LOW || moisture < MOISTURE_MIN)
  {
    pumpOn = true;
  }

  setEggLarvaePump(pumpOn);
  setEggLarvaeFan(fanOn);
  setEggLarvaeHeater(heaterOn);
  setEggLarvaeHeaterFan(heaterFanOn);
  setEggLarvaeHumidifier(humidifierOn);

  Serial.println(F("Auto control Drawer 1:"));
  Serial.print(F("  Temp="));
  Serial.print(temperature);
  Serial.print(F(" Hum="));
  Serial.print(humidity);
  Serial.print(F(" Moist="));
  Serial.println(moisture);
  Serial.print(F("  Fan="));
  Serial.print(fanOn ? F("ON") : F("OFF"));
  Serial.print(F(" Heater="));
  Serial.print(heaterOn ? F("ON") : F("OFF"));
  Serial.print(F(" Humidifier="));
  Serial.print(humidifierOn ? F("ON") : F("OFF"));
  Serial.print(F(" Pump="));
  Serial.println(pumpOn ? F("ON") : F("OFF"));
}

// Drawer 2: Temperature & humidity only
void autoControlPupaDrawer(float temperature, float humidity)
{
  bool fanOn = false;
  bool humidifierOn = false;

  // Temperature control: fan for cooling only
  if (temperature > TEMP_OPTIMAL_HIGH || temperature > TEMP_MAX)
  {
    fanOn = true;
    humidifierOn = false;
  }

  // Humidity control: humidify when dry, ventilate when too humid
  if (humidity < HUMIDITY_OPTIMAL_LOW)
  {
    humidifierOn = true;
    fanOn = false;
  }
  else if (humidity >= HUMIDITY_OPTIMAL_HIGH)
  {
    humidifierOn = false;
    fanOn = true;
  }

  setPupaFan(fanOn);
  setPupaHumidifier(humidifierOn);

  Serial.println(F("Auto control Drawer 2:"));
  Serial.print(F("  Temp="));
  Serial.print(temperature);
  Serial.print(F(" Hum="));
  Serial.println(humidity);
  Serial.print(F("  Fan="));
  Serial.println(fanOn ? F("ON") : F("OFF"));
}

// Validation helpers
bool isValidDrawer1DhtReading(float temperature, float humidity)
{
  return !isnan(temperature) && !isnan(humidity) && 
         temperature >= 15.0f && temperature <= 45.0f && 
         humidity >= 30.0f && humidity <= 95.0f;
}

bool isValidDrawer2DhtReading(float temperature, float humidity)
{
  return !isnan(temperature) && !isnan(humidity) && 
         temperature >= 15.0f && temperature <= 45.0f && 
         humidity >= 20.0f && humidity <= 100.0f;
}

// Control mode state management
static inline void setControlModeLocked(ControlMode mode)
{
  stateLock();
  requestedControlMode = mode;
  if (requestedControlMode == CONTROL_MODE_AUTO)
  {
    offlineAutoControlHoldUntil = 0;
  }
  stateUnlock();
}

static inline ControlMode getControlModeLocked()
{
  stateLock();
  ControlMode m = requestedControlMode;
  stateUnlock();
  return m;
}

static inline void recordManualActuatorChangeLocked()
{
  stateLock();
  offlineAutoControlHoldUntil = millis() + OFFLINE_AUTOCONTROL_HOLD_MS;
  stateUnlock();
}

// Public wrappers
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
  ControlMode m = getControlModeLocked();
  return m == CONTROL_MODE_MANUAL ? "manual" : "auto";
}
