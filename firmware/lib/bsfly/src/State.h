#pragma once

#include <Arduino.h>
#include <math.h>
#include <limits.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <SD.h>
#include <SPI.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>
#include <Adafruit_MCP23X17.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <freertos/queue.h>
#include <freertos/task.h>
#include "Config.h"

// ==================== TYPES ====================
enum ControlMode
{
  CONTROL_MODE_AUTO = 0,
  CONTROL_MODE_MANUAL = 1,
};

struct DhtReading
{
  float temperature;
  float humidity;
  bool valid;
  uint8_t sourceType;
};

struct Nh3Metrics
{
  bool valid;
  int16_t raw;
  float vrl;
  float rs_kohm;
  float ratio;
  float ppm;
};

struct MqttPublishItem
{
  char topic[160];
  char payload[384];
  bool retain;
};

// ==================== STATE LOCKING (CRITICAL SECTION) ====================
// Protects shared state touched from loop(), sensorTask(), MQTT callback, and web handlers.
extern portMUX_TYPE gStateMux;
inline void stateLock() { portENTER_CRITICAL(&gStateMux); }
inline void stateUnlock() { portEXIT_CRITICAL(&gStateMux); }

extern String DEVICE_ID;
extern String DEVICE_ID_CLEAN;

extern DHT dhtA11;
extern DHT dhtA22;
extern DHT dhtB11;
extern DHT dhtB22;
extern DHT dhtC11;
extern DHT dhtC22;
extern DHT dhtD11;
extern DHT dhtD22;
extern DHT dhtE11;
extern DHT dhtE22;
extern Adafruit_ADS1115 ads1;
extern Adafruit_ADS1115 ads2;
extern Adafruit_MCP23X17 mcp;
extern LiquidCrystal_I2C lcd1;
extern LiquidCrystal_I2C lcd2;
extern AsyncWebServer server;

extern WiFiClientSecure espClient;
extern PubSubClient mqttClient;
extern QueueHandle_t gMqttPublishQueue;
extern volatile uint32_t gMqttQueueDropCount;
extern bool mqttEnabled;

extern bool ads1Available;
extern bool ads2Available;
extern bool mcpAvailable;
extern bool sdAvailable;
extern bool lcd1Available;
extern bool lcd2Available;
extern bool tcaAvailable;
extern unsigned int i2cErrorCount;
extern unsigned int sdErrorCount;

extern unsigned long lastSensorTime;
extern unsigned long lastHeartbeatTime;
extern unsigned long lastSdSyncTime;
extern unsigned long lastActuatorCommandTime;
extern unsigned long lastMqttReconnectAttempt;
extern unsigned long lastModeDebugTime;
extern int lastHeartbeatHttpCode;
extern bool lastWifiConnected;
extern bool lastMqttConnected;

extern bool lightState;
extern unsigned long lightEndTime;
extern unsigned long offlineAutoControlHoldUntil;
extern ControlMode requestedControlMode;

extern DhtReading lastDrawer1SensorA;
extern DhtReading lastDrawer1SensorB;
extern DhtReading lastDrawer1SensorC;
extern DhtReading lastDrawer2SensorD;
extern DhtReading lastDrawer2SensorE;

extern SemaphoreHandle_t gTlsMutex;
extern WiFiClientSecure gHttpsClient;
extern unsigned long gTlsFailCooldownUntilMs;
extern SemaphoreHandle_t gDhtMutex;

extern TaskHandle_t heartbeatTaskHandle;
extern TaskHandle_t sensorTaskHandle;
extern TaskHandle_t mq137CalTaskHandle;
extern volatile bool sdUploadKick;
extern volatile int gSdStoredCountCached;

extern float mq137Ro;
extern float mq137LastCalibration;
extern bool mq137CalibrationInProgress;
extern volatile uint16_t mq137CalProgress;
extern volatile uint16_t mq137CalValidSamples;
extern volatile float mq137CalLastRsAvg;

extern int gMoistureRawDry;
extern int gMoistureRawWet;

inline void setControlModeLocked(ControlMode mode)
{
  stateLock();
  requestedControlMode = mode;
  if (requestedControlMode == CONTROL_MODE_AUTO)
  {
    offlineAutoControlHoldUntil = 0;
  }
  stateUnlock();
}

inline ControlMode getControlModeLocked()
{
  stateLock();
  ControlMode m = requestedControlMode;
  stateUnlock();
  return m;
}

inline void recordManualActuatorChangeLocked()
{
  stateLock();
  offlineAutoControlHoldUntil = millis() + OFFLINE_AUTOCONTROL_HOLD_MS;
  stateUnlock();
}

inline unsigned long getOfflineHoldUntilLocked()
{
  stateLock();
  unsigned long t = offlineAutoControlHoldUntil;
  stateUnlock();
  return t;
}

inline void setLightTimerLocked(bool on, unsigned long endTimeMs)
{
  stateLock();
  lightState = on;
  lightEndTime = endTimeMs;
  stateUnlock();
}

inline void getLightTimerLocked(bool &on, unsigned long &endTimeMs)
{
  stateLock();
  on = lightState;
  endTimeMs = lightEndTime;
  stateUnlock();
}
