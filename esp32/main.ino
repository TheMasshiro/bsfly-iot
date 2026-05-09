/**
 * BSFLY IoT - Main Control Firmware
 *
 * This firmware manages a multi-drawer environmental monitoring and control system
 * for BSF (Black Soldier Fly) larvae cultivation. It handles:
 * - Temperature and humidity monitoring via 3x DHT sensors (Drawer 1: A, B, C)
 * - Temperature and humidity monitoring via 2x DHT sensors (Drawer 2: D, E)
 * - Substrate moisture sensing via analog inputs (Drawer 1 only)
 * - Ammonia detection via MQ137 sensor (Drawer 1 only)
 * - Actuator control (heaters, humidifiers, fans)
 * - Data transmission via WiFi (HTTP/MQTT) and local storage (SD card)
 * - Automatic environmental control when offline
 *
 * Hardware:
 * - ESP32 microcontroller
 * - TCA9548A I2C multiplexer (dual LCD displays)
 * - ADS1115 ADC modules (substrate moisture and ammonia)
 * - MCP23017 I/O expander (actuator control)
 * - CD74HC4067 analog multiplexer (substrate sensors)
 * - DHT11/DHT22 temperature/humidity sensors
 * - MicroSD card module
 *
 * Network:
 * - WiFi: MQTT
 * - Fallback: Local SD card storage and autonomous control
 *
 * ==================== PIN MAPPING ====================
 * ESP32 Pin Mapping:
 * | Function/Peripheral    | Macro       | ESP32 GPIO |
 * |------------------------|-------------|------------|
 * | I2C SDA                | I2C_SDA     | 21         |
 * | I2C SCL                | I2C_SCL     | 22         |
 * | SPI SCK (SD Card)      | SPI_SCK     | 18         |
 * | SPI MISO (SD Card)     | SPI_MISO    | 19         |
 * | SPI MOSI (SD Card)     | SPI_MOSI    | 23         |
 * | SPI CS (SD Card)       | SPI_CS_SD   | 15         |
 * | LED                    | LED_PIN     | 4          |
 * | MUX SIG (analog in)    | MUX_SIG     | 35         |
 * | MUX S0                 | MUX_S0      | 17         |
 * | MUX S1                 | MUX_S1      | 5          |
 * | MUX S2                 | MUX_S2      | 32         |
 * | MUX S3                 | MUX_S3      | 33         |
 * | DHT Sensor A           | DHT_A_PIN   | 16         |
 * | DHT Sensor B           | DHT_B_PIN   | 26         |
 * | DHT Sensor C           | DHT_C_PIN   | 25         |
 * | DHT Sensor D           | DHT_D_PIN   | 14         |
 * | DHT Sensor E           | DHT_E_PIN   | 27         |
 *
 * I2C Device Addresses:
 * | Device                 | Macro            | Address |
 * |------------------------|------------------|---------|
 * | ADS1115 #1             | ADS1115_ADDR_1   | 0x48    |
 * | ADS1115 #2             | ADS1115_ADDR_2   | 0x49    |
 * | MCP23017               | MCP23017_ADDR    | 0x20    |
 * | TCA9548A               | TCA9548A_ADDR    | 0x70    |
 * | LCD (I2C)              | LCD_ADDR         | 0x27    |
 *
 * TCA9548A Channels:
 * | Device | Macro       | Channel |
 * |--------|-------------|---------|
 * | LCD #1 | TCA_CH_LCD1 | 0       |
 * | LCD #2 | TCA_CH_LCD2 | 1       |
 *
 * MCP23017 Pin Mapping (Actuators):
 * | Actuator               | Macro                     | MCP23017 Pin |
 * |------------------------|---------------------------|--------------|
 * | Enclosure Light        | MCP_ENCLOSURE_LIGHT       | 0            |
 * | Egg/Larvae Pump        | MCP_EGGLARVAE_PUMP        | 1            |
 * | Egg/Larvae Humidifier  | MCP_EGGLARVAE_HUMIDIFIER  | 2            |
 * | Egg/Larvae Fans        | MCP_EGGLARVAE_FANS        | 3            |
 * | Egg/Larvae Heater      | MCP_EGGLARVAE_HEATER      | 4            |
 * | Egg/Larvae Heater Fans | MCP_EGGLARVAE_HEATER_FANS | 5            |
 * | Pupa Humidifier        | MCP_PUPA_HUMIDIFIER       | 6            |
 * | Pupa Fan               | MCP_PUPA_FAN              | 7            |
 *
 * ADS1115 Channels:
 * | Function               | Macro            | ADS / Channel |
 * |------------------------|------------------|---------------|
 * | Substrate 1            | ADS1_SUBSTRATE_1 | ADS#1 / A0    |
 * | Substrate 2            | ADS1_SUBSTRATE_2 | ADS#1 / A1    |
 * | Substrate 3            | ADS1_SUBSTRATE_3 | ADS#1 / A2    |
 * | Ammonia (MQ137)        | ADS2_MQ137       | ADS#2 / A0    |
 *
 * CD74HC4067 Channels:
 * | Function               | Macro             | MUX Channel |
 * |------------------------|-------------------|-------------|
 * | Substrate 1 (MUX)      | MUX_CH_SUBSTRATE1 | 0           |
 * | Substrate 2 (MUX)      | MUX_CH_SUBSTRATE2 | 1           |
 * | Substrate 3 (MUX)      | MUX_CH_SUBSTRATE3 | 2           |
 * ==================================================
 */

// Include necessary libraries
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <HTTPClient.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ElegantOTA.h>
#include <ArduinoJson.h>
#include <math.h>
#include <limits.h>
#include <SD.h>
#include <SPI.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>
#include <Adafruit_MCP23X17.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/task.h>
#include "credentials.h"

#define MQTT_BASE_TOPIC "devices"

String DEVICE_ID;
String DEVICE_ID_CLEAN;

const u_int8_t IP_STA[] = {192, 168, 100, 200};
const u_int8_t IP_GW[] = {192, 168, 100, 1};
const u_int8_t SUBNET[] = {255, 255, 255, 0};
const u_int8_t IP_DNS[] = {192, 168, 100, 1};

// ==================== I2C BUS ====================
#define I2C_SDA GPIO_NUM_21
#define I2C_SCL GPIO_NUM_22

// ==================== SPI BUS (microSD) ====================
#define SPI_SCK GPIO_NUM_18
#define SPI_MISO GPIO_NUM_19
#define SPI_MOSI GPIO_NUM_23
#define SPI_CS_SD GPIO_NUM_15

// ==================== LED ====================
#define LED_PIN GPIO_NUM_4
#define MUX_SIG GPIO_NUM_35
#define MUX_S0 GPIO_NUM_17
#define MUX_S1 GPIO_NUM_5
#define MUX_S2 GPIO_NUM_32
#define MUX_S3 GPIO_NUM_33

// ==================== DHT SENSORS ====================
// Drawer 1
#define DHT_A_PIN GPIO_NUM_16
#define DHT_B_PIN GPIO_NUM_26
#define DHT_C_PIN GPIO_NUM_25
// Drawer 2
#define DHT_D_PIN GPIO_NUM_14
#define DHT_E_PIN GPIO_NUM_27

#define DHT_READ_ATTEMPTS 1
#define DHT11_TYPE DHT11
#define DHT22_TYPE DHT22

// ==================== I2C DEVICE ADDRESSES ====================
#define ADS1115_ADDR_1 0x48
#define ADS1115_ADDR_2 0x49
#define MCP23017_ADDR 0x20
#define TCA9548A_ADDR 0x70
#define LCD_ADDR 0x27

// ==================== TCA9548A CHANNELS ====================
#define TCA_CH_LCD1 0
#define TCA_CH_LCD2 1

// ==================== MCP23017 PINS ====================
// Actuator Pin Mapping:
#define MCP_ENCLOSURE_LIGHT 0
#define MCP_EGGLARVAE_PUMP 1
#define MCP_EGGLARVAE_HUMIDIFIER 2
#define MCP_EGGLARVAE_FANS 3
#define MCP_EGGLARVAE_HEATER 4
#define MCP_EGGLARVAE_HEATER_FANS 5
#define MCP_PUPA_HUMIDIFIER 6
#define MCP_PUPA_FAN 7

// ==================== ADS1115 CHANNELS ====================
#define ADS1_SUBSTRATE_1 0 // On ADS1115 #1
#define ADS1_SUBSTRATE_2 1 // On ADS1115 #1
#define ADS1_SUBSTRATE_3 2 // On ADS1115 #1
#define ADS2_MQ137 0       // On ADS1115 #2

// ==================== CD74HC4067 CHANNELS ====================
#define MUX_CH_SUBSTRATE1 0
#define MUX_CH_SUBSTRATE2 1
#define MUX_CH_SUBSTRATE3 2

// ==================== TIMING ====================
#define SENSOR_INTERVAL 5000
#define HEARTBEAT_INTERVAL 15000
#define SD_SYNC_INTERVAL 60000
#define SD_DATA_FILE "/sensor_data.json"
#define OFFLINE_AUTOCONTROL_HOLD_MS 120000
#define HEARTBEAT_TIMEOUT_MS 1500
#define HEARTBEAT_COOLDOWN_AFTER_ACTUATOR_MS 4000
#define SD_UPLOAD_HTTP_TIMEOUT_MS 1500
#define SD_UPLOAD_MAX_PER_CYCLE 3
#define MQTT_RECONNECT_INTERVAL_MS 5000
#define MODE_DEBUG_INTERVAL_MS 15000

// ==================== OFFLINE THRESHOLDS ====================
#define TEMP_MIN 25.0
#define TEMP_MAX 35.0
#define TEMP_OPTIMAL_LOW 27.0
#define TEMP_OPTIMAL_HIGH 31.0

#define HUMIDITY_MIN 50.0
#define HUMIDITY_MAX 80.0
#define HUMIDITY_OPTIMAL_LOW 60.0
#define HUMIDITY_OPTIMAL_HIGH 70.0

// ==================== MQ137 CALIBRATION ====================
#define MQ137_RL 4.7f                           // Load resistance in kOhm
#define MQ137_VC 5.0f                           // Supply voltage in V
#define MQ137_CALIBRATION_PPM 21.0f             // Display-only reference value (NOT actual fresh-air NH3 ppm); Ro is derived from MQ137_CALIBRATION_RATIO
#define MQ137_CALIBRATION_RATIO 3.6f            // Rst/Ro ratio in fresh air (from datasheet)
#define MQ137_CALIBRATION_CYCLES 500            // Number of readings to average
#define MQ137_CALIBRATION_FILE "/mq137_ro.json" // File to store calibration data
#define MQ137_NH3_A 23.7f                       // Coefficient A for NH3 ppm calculation (from log-log plot of datasheet)
#define MQ137_NH3_B -4.796f                     // Coefficient B for NH3 ppm calculation (from log-log plot of datasheet)
#define MQ137_DIVIDER_INVERTED 1                // Set to 1 if your sensor is wired with the load resistor on the high side (Vc) instead of low side (GND)

#define MOISTURE_MIN 40
#define MOISTURE_MAX 70
#define MOISTURE_OPTIMAL_LOW 50
#define MOISTURE_OPTIMAL_HIGH 60

// ==================== GLOBALS ====================
DHT dhtA11(DHT_A_PIN, DHT11_TYPE);
DHT dhtA22(DHT_A_PIN, DHT22_TYPE);
DHT dhtB11(DHT_B_PIN, DHT11_TYPE);
DHT dhtB22(DHT_B_PIN, DHT22_TYPE);
DHT dhtC11(DHT_C_PIN, DHT11_TYPE);
DHT dhtC22(DHT_C_PIN, DHT22_TYPE);
DHT dhtD11(DHT_D_PIN, DHT11_TYPE);
DHT dhtD22(DHT_D_PIN, DHT22_TYPE);
DHT dhtE11(DHT_E_PIN, DHT11_TYPE);
DHT dhtE22(DHT_E_PIN, DHT22_TYPE);

Adafruit_ADS1115 ads1;
Adafruit_ADS1115 ads2;
Adafruit_MCP23X17 mcp;

LiquidCrystal_I2C lcd1(LCD_ADDR, 16, 2);
LiquidCrystal_I2C lcd2(LCD_ADDR, 16, 2);

bool ads1Available = false;
bool ads2Available = false;
bool mcpAvailable = false;
bool sdAvailable = false;
bool lcd1Available = false;
bool lcd2Available = false;

unsigned long lastSensorTime = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastSdSyncTime = 0;
unsigned long lastActuatorCommandTime = 0;
unsigned long lastMqttReconnectAttempt = 0;
unsigned long lastModeDebugTime = 0;

// ==================== TLS / HTTPS ROBUSTNESS ====================
static constexpr uint32_t TLS_MIN_FREE_HEAP = 65000;
static constexpr uint32_t TLS_MIN_FREE_HEAP_MIN = 50000;

static SemaphoreHandle_t gTlsMutex = nullptr;
static WiFiClientSecure gHttpsClient;
static unsigned long gTlsFailCooldownUntilMs = 0;

// ==================== HEARTBEAT & SENSOR UPLOAD TASK ====================
TaskHandle_t heartbeatTaskHandle = nullptr;
TaskHandle_t sensorTaskHandle = nullptr;

// ==================== SD UPLOAD TASK ====================
static TaskHandle_t sdUploadTaskHandle = nullptr;
static volatile bool sdUploadKick = false;

static volatile int gSdStoredCountCached = -1;
static TaskHandle_t sdCountTaskHandle = nullptr;
static void sdCountTask(void *pvParameters);

// ==================== STATE LOCKING (CRITICAL SECTION) ====================
// Protects shared state touched from loop(), sensorTask(), MQTT callback, and web handlers.
static portMUX_TYPE gStateMux = portMUX_INITIALIZER_UNLOCKED;
static inline void stateLock() { portENTER_CRITICAL(&gStateMux); }
static inline void stateUnlock() { portEXIT_CRITICAL(&gStateMux); }

int lastHeartbeatHttpCode = 0;
bool lastWifiConnected = false;
bool lastMqttConnected = false;

bool lightState = false;
unsigned long lightEndTime = 0;
unsigned long offlineAutoControlHoldUntil = 0;

enum ControlMode
{
  CONTROL_MODE_AUTO = 0,
  CONTROL_MODE_MANUAL = 1,
};

ControlMode requestedControlMode = CONTROL_MODE_AUTO;

struct DhtReading
{
  float temperature;
  float humidity;
  bool valid;
  uint8_t sourceType;
};

DhtReading lastDrawer1SensorA = {NAN, NAN, false, 0};
DhtReading lastDrawer1SensorB = {NAN, NAN, false, 0};
DhtReading lastDrawer1SensorC = {NAN, NAN, false, 0};
DhtReading lastDrawer2SensorD = {NAN, NAN, false, 0};
DhtReading lastDrawer2SensorE = {NAN, NAN, false, 0};

AsyncWebServer server(80);

// ==================== MQ137 CALIBRATION VARIABLES ====================
float mq137Ro = 0.0f;                    // Ro in kΩ (0 = not calibrated yet)
float mq137LastCalibration = 0.0f;       // Unix timestamp (seconds) of last calibration
bool mq137CalibrationInProgress = false; // Flag to indicate ongoing calibration

// Async calibration task state
static TaskHandle_t mq137CalTaskHandle = nullptr;
static volatile uint16_t mq137CalProgress = 0; // 0..100
static volatile uint16_t mq137CalValidSamples = 0;
static volatile float mq137CalLastRsAvg = NAN;

struct Nh3Metrics
{
  bool valid;
  int16_t raw;
  float vrl;
  float rs_kohm;
  float ratio;
  float ppm;
};

// ==================== MOISTURE CALIBRATION (raw endpoints) ====================
// These defaults are placeholders; you should calibrate for your setup.
static int gMoistureRawDry = 28000; // raw reading in air/dry
static int gMoistureRawWet = 12000; // raw reading in water/very wet

static SemaphoreHandle_t gDhtMutex = nullptr;

// ==================== ADS1115 VARIABLES ====================
static constexpr int16_t ADS_INVALID = INT16_MIN;

// MQTT client (optional)
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);

struct MqttPublishItem
{
  char topic[160];
  char payload[384];
  bool retain;
};

static QueueHandle_t gMqttPublishQueue = nullptr;
static volatile uint32_t gMqttQueueDropCount = 0;
bool mqttEnabled = false;

bool tcaAvailable = false;
unsigned int i2cErrorCount = 0;
unsigned int sdErrorCount = 0;

// ==================== FUNCTION PROTOTYPES ====================
void setup();
void loop();

// MQTT queue helpers
static bool mqttEnqueuePublish(const char *topic, const char *payload, bool retain);
static void mqttDrainQueue();
void mqttCallback(char *topic, byte *payload, unsigned int length);
void mqttReconnect();

// Tasks
static void sdUploadTask(void *pvParameters);
static inline void kickHeartbeatNow();
void heartbeatTask(void *pvParameters);
void sensorTask(void *pvParameters);
static void mq137CalibrationTask(void *pvParameters);

// Heartbeat / network
bool sendHeartbeat();
uint64_t getServerTime();
void setActuatorState(const char *actuatorType, bool state);

// LED / light timer
void ledOn();
void ledOff();
void updateLightLed();
void publishLightTimerState(int timeSeconds, uint64_t startTimeMs);

// Sensors / processing
void sendSensorData();
void collectAndProcessEggLarvaeDrawer();
void collectAndProcessPupaDrawer();
void sendOrStoreSensorReading(const char *drawerName, float temperature, float humidity,
                              int leftSubstrate, int centerSubstrate, int rightSubstrate, int ammonia);
bool sendSensorReading(const char *drawerName, float temperature, float humidity,
                       int leftSubstrate, int centerSubstrate, int rightSubstrate, int ammonia);

// Moisture helpers
static inline int moisturePercentFromRaw(int raw);
static inline void printAds1MoistureDebug(int16_t r0, int16_t r1, int16_t r2);

// MUX / I2C helpers
void selectMuxChannel(uint8_t channel);
int readMuxAnalog(uint8_t channel);
void selectTcaChannel(uint8_t channel);

// LCD helpers
void updateLCD1(float temp, float humidity, int ammonia);
void updateLCD2(float temp, float humidity);
static void updateLCD2SubstratesRow(int leftPct, int centerPct, int rightPct);
void displayLCDMessage(uint8_t lcdNum, const char *line1, const char *line2);

// ADS helpers / readers
int16_t readAds1Channel(uint8_t channel);
int16_t readAds2Channel(uint8_t channel);
int readSubstrate1();
int readSubstrate2();
int readSubstrate3();
int readMQ137();

// MCP / actuators
void setMcpActuator(uint8_t pin, bool state);
bool applyActuatorState(const char *actuator, bool state);
void logActuatorCommand(const char *actuator, bool state);
void publishActuatorStateBool(const char *actuator, bool state);

// Inline actuator helpers
inline void setEggLarvaePump(bool state);
inline void setEggLarvaeHumidifier(bool state);
inline void setEggLarvaeFan(bool state);
inline void setEggLarvaeHeater(bool state);
inline void setEggLarvaeHeaterFan(bool state);
inline void setPupaHumidifier(bool state);
inline void setPupaFan(bool state);

// Offline control / mode
void autoControlEggLarvaeDrawer(float temperature, float humidity, int leftMoisture, int centerMoisture, int rightMoisture);
void autoControlPupaDrawer(float temperature, float humidity);
bool isAutoControlActive();
void setRequestedControlMode(ControlMode mode);
const char *getRequestedControlModeName();
void recordManualActuatorChange();
void logConnectivityState(const char *source);

// DHT helpers
bool isValidDrawer1DhtReading(float temperature, float humidity);
bool isValidDrawer2DhtReading(float temperature, float humidity);
bool isStableDhtReading(const DhtReading &current, const DhtReading &previous,
                        float maxTempDelta, float maxHumidityDelta);
bool readRawDht(DHT &sensor, float &humidity, float &temperature);
DhtReading readDhtAutoType(DHT &dht11, DHT &dht22, bool preferDht11,
                           bool useDrawer1Validation, bool allowTypeFallback, const char *label);

// SD storage
void storeSensorToSD(const char *drawerName, float temperature, float humidity,
                     int leftSubstrate, int centerSubstrate, int rightSubstrate, int ammonia);
void uploadStoredData();
int getStoredDataCount();

static void sdCountTask(void *pvParameters);

// Web server
void setupWebServer();
void handleHardwarePage(AsyncWebServerRequest *request);
void handleCalibrateAmmonia(AsyncWebServerRequest *request);
void handleCalibrationStatus(AsyncWebServerRequest *request);
void handleCalibrateAllSensors(AsyncWebServerRequest *request);
void handleStatus(AsyncWebServerRequest *request);
void handleGetSdData(AsyncWebServerRequest *request);
void handleClearSdData(AsyncWebServerRequest *request);
void handleSyncSdData(AsyncWebServerRequest *request);
void handleReboot(AsyncWebServerRequest *request);

struct Nh3Metrics;
static Nh3Metrics readNh3Metrics();
float calculateRstFromRaw(int16_t rawValue);
static float estimateNh3PpmFromRaw(int16_t rawValue);
float calibrateMQ137();
void loadMQ137Calibration();

// Misc
static void logLoopHealth();

// Inline actuator helpers (definitions)
inline void setEggLarvaePump(bool state) { setMcpActuator(MCP_EGGLARVAE_PUMP, state); }
inline void setEggLarvaeHumidifier(bool state) { setMcpActuator(MCP_EGGLARVAE_HUMIDIFIER, state); }
inline void setEggLarvaeFan(bool state) { setMcpActuator(MCP_EGGLARVAE_FANS, state); }
inline void setEggLarvaeHeater(bool state) { setMcpActuator(MCP_EGGLARVAE_HEATER, state); }
inline void setEggLarvaeHeaterFan(bool state) { setMcpActuator(MCP_EGGLARVAE_HEATER_FANS, state); }
inline void setPupaHumidifier(bool state) { setMcpActuator(MCP_PUPA_HUMIDIFIER, state); }
inline void setPupaFan(bool state) { setMcpActuator(MCP_PUPA_FAN, state); }

static inline void getLightTimerLocked(bool &on, unsigned long &endTimeMs);
static inline void setLightTimerLocked(bool on, unsigned long endTimeMs);
static inline unsigned long getOfflineHoldUntilLocked();
static inline void recordManualActuatorChangeLocked();
static inline ControlMode getControlModeLocked();
static inline void setControlModeLocked(ControlMode mode);

static bool canStartTlsNow(const char *tag);
static void tlsUnlock();
static bool tlsTryLock(TickType_t waitTicks = pdMS_TO_TICKS(1000));

// Auto Mode for Drawers
void autoControlEggLarvaeDrawer(float temperature, float humidity, int leftMoisture, int centerMoisture, int rightMoisture);
void autoControlPupaDrawer(float temperature, float humidity);
bool isAutoControlActive();
void setRequestedControlMode(ControlMode mode);
const char *getRequestedControlModeName();
void recordManualActuatorChange();
void logConnectivityState(const char *source);

// DHT helpers
bool isValidDrawer1DhtReading(float temperature, float humidity);
bool isValidDrawer2DhtReading(float temperature, float humidity);
bool isStableDhtReading(const DhtReading &current, const DhtReading &previous,
                        float maxTempDelta, float maxHumidityDelta);
bool readRawDht(DHT &sensor, float &humidity, float &temperature);
DhtReading readDhtAutoType(DHT &dht11, DHT &dht22, bool preferDht11,
                           bool useDrawer1Validation, bool allowTypeFallback, const char *label);

// SD storage
void storeSensorToSD(const char *drawerName, float temperature, float humidity,
                     int leftSubstrate, int centerSubstrate, int rightSubstrate, int ammonia);
void uploadStoredData();
int getStoredDataCount();

static void sdCountTask(void *pvParameters);

// Web server
void setupWebServer();
void handleHardwarePage(AsyncWebServerRequest *request);
void handleCalibrateAmmonia(AsyncWebServerRequest *request);
void handleCalibrationStatus(AsyncWebServerRequest *request);
void handleCalibrateAllSensors(AsyncWebServerRequest *request);
void handleStatus(AsyncWebServerRequest *request);
void handleGetSdData(AsyncWebServerRequest *request);
void handleClearSdData(AsyncWebServerRequest *request);
void handleSyncSdData(AsyncWebServerRequest *request);
void handleReboot(AsyncWebServerRequest *request);

struct Nh3Metrics;
static Nh3Metrics readNh3Metrics();
float calculateRstFromRaw(int16_t rawValue);
static float estimateNh3PpmFromRaw(int16_t rawValue);
float calibrateMQ137();
void loadMQ137Calibration();

// Misc
static void logLoopHealth();

// Inline actuator helpers
inline void setEggLarvaePump(bool state) { setMcpActuator(MCP_EGGLARVAE_PUMP, state); }
inline void setEggLarvaeHumidifier(bool state) { setMcpActuator(MCP_EGGLARVAE_HUMIDIFIER, state); }
inline void setEggLarvaeFan(bool state) { setMcpActuator(MCP_EGGLARVAE_FANS, state); }
inline void setEggLarvaeHeater(bool state) { setMcpActuator(MCP_EGGLARVAE_HEATER, state); }
inline void setEggLarvaeHeaterFan(bool state) { setMcpActuator(MCP_EGGLARVAE_HEATER_FANS, state); }
inline void setPupaHumidifier(bool state) { setMcpActuator(MCP_PUPA_HUMIDIFIER, state); }
inline void setPupaFan(bool state) { setMcpActuator(MCP_PUPA_FAN, state); }

static inline void getLightTimerLocked(bool &on, unsigned long &endTimeMs);
static inline void setLightTimerLocked(bool on, unsigned long endTimeMs);
static inline unsigned long getOfflineHoldUntilLocked();
static inline void recordManualActuatorChangeLocked();
static inline ControlMode getControlModeLocked();
static inline void setControlModeLocked(ControlMode mode);

static bool canStartTlsNow(const char *tag);
static void tlsUnlock();
static bool tlsTryLock(TickType_t waitTicks = pdMS_TO_TICKS(1000));

// Auto Mode for Drawers
void autoControlEggLarvaeDrawer(float temperature, float humidity, int leftMoisture, int centerMoisture, int rightMoisture);
void autoControlPupaDrawer(float temperature, float humidity);
bool isAutoControlActive();
void setRequestedControlMode(ControlMode mode);
const char *getRequestedControlModeName();
void recordManualActuatorChange();
void logConnectivityState(const char *source);

// DHT helpers
bool isValidDrawer1DhtReading(float temperature, float humidity);
bool isValidDrawer2DhtReading(float temperature, float humidity);
bool isStableDhtReading(const DhtReading &current, const DhtReading &previous,
                        float maxTempDelta, float maxHumidityDelta);
bool readRawDht(DHT &sensor, float &humidity, float &temperature);
DhtReading readDhtAutoType(DHT &dht11, DHT &dht22, bool preferDht11,
                           bool useDrawer1Validation, bool allowTypeFallback, const char *label);

// SD storage
void storeSensorToSD(const char *drawerName, float temperature, float humidity,
                     int leftSubstrate, int centerSubstrate, int rightSubstrate, int ammonia);
void uploadStoredData();
int getStoredDataCount();

static void sdCountTask(void *pvParameters);

// Web server
void setupWebServer();
void handleHardwarePage(AsyncWebServerRequest *request);
void handleCalibrateAmmonia(AsyncWebServerRequest *request);
void handleCalibrationStatus(AsyncWebServerRequest *request);
void handleCalibrateAllSensors(AsyncWebServerRequest *request);
void handleStatus(AsyncWebServerRequest *request);
void handleGetSdData(AsyncWebServerRequest *request);
void handleClearSdData(AsyncWebServerRequest *request);
void handleSyncSdData(AsyncWebServerRequest *request);
void handleReboot(AsyncWebServerRequest *request);

struct Nh3Metrics;
static Nh3Metrics readNh3Metrics();
float calculateRstFromRaw(int16_t rawValue);
static float estimateNh3PpmFromRaw(int16_t rawValue);
float calibrateMQ137();
void loadMQ137Calibration();

// Misc
static void logLoopHealth();

// Inline actuator helpers (definitions)
inline void setEggLarvaePump(bool state) { setMcpActuator(MCP_EGGLARVAE_PUMP, state); }
inline void setEggLarvaeHumidifier(bool state) { setMcpActuator(MCP_EGGLARVAE_HUMIDIFIER, state); }
inline void setEggLarvaeFan(bool state) { setMcpActuator(MCP_EGGLARVAE_FANS, state); }
inline void setEggLarvaeHeater(bool state) { setMcpActuator(MCP_EGGLARVAE_HEATER, state); }
inline void setEggLarvaeHeaterFan(bool state) { setMcpActuator(MCP_EGGLARVAE_HEATER_FANS, state); }
inline void setPupaHumidifier(bool state) { setMcpActuator(MCP_PUPA_HUMIDIFIER, state); }
inline void setPupaFan(bool state) { setMcpActuator(MCP_PUPA_FAN, state); }

static inline void getLightTimerLocked(bool &on, unsigned long &endTimeMs);
static inline void setLightTimerLocked(bool on, unsigned long endTimeMs);
static inline unsigned long getOfflineHoldUntilLocked();
static inline void recordManualActuatorChangeLocked();
static inline ControlMode getControlModeLocked();
static inline void setControlModeLocked(ControlMode mode);

static bool canStartTlsNow(const char *tag);
static void tlsUnlock();
static bool tlsTryLock(TickType_t waitTicks = pdMS_TO_TICKS(1000));

// ==================== SETUP ====================
void setup()
{
  setCpuFrequencyMhz(240);
  Serial.begin(115200);
  delay(1000);

  // Create TLS mutex
  if (!gTlsMutex)
    gTlsMutex = xSemaphoreCreateMutex();
  gHttpsClient.setInsecure();

  // Create DHT mutex
  if (!gDhtMutex)
    gDhtMutex = xSemaphoreCreateMutex();

  // Create MQTT publish queue early.
  if (!gMqttPublishQueue)
    gMqttPublishQueue = xQueueCreate(12, sizeof(MqttPublishItem));

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

  // Initialize I2C bus and devices
  Wire.begin(I2C_SDA, I2C_SCL, 200000);

  // ADS1115 #1
  ads1Available = ads1.begin(ADS1115_ADDR_1, &Wire);
  if (!ads1Available)
  {
    Serial.println(F("ADS1115 #1 not found"));
  }
  else
  {
    ads1.readADC_SingleEnded(0); // Dummy read to set up config register for channel 0
    ads1.readADC_SingleEnded(1); // Dummy read to set up config register for channel 1
    ads1.readADC_SingleEnded(2); // Dummy read to set up config register for channel 2
    ads1.setGain(GAIN_TWOTHIRDS);
    ads1.setDataRate(RATE_ADS1115_128SPS);

    Serial.println(F("ADS1115 #1 initialized"));
  }

  // ADS1115 #2
  ads2Available = ads2.begin(ADS1115_ADDR_2);
  if (!ads2Available)
  {
    Serial.println(F("ADS1115 #2 not found"));
  }
  else
  {
    // Keep consistent unless ADS#2 is used for a lower-voltage signal that needs higher gain.
    ads2.readADC_SingleEnded(0); // Dummy read to set up config register for channel 0
    ads2.setGain(GAIN_TWOTHIRDS);
    ads2.setDataRate(RATE_ADS1115_128SPS);
    Serial.println(F("ADS1115 #2 initialized"));
  }

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

  // TCA9548A (DEGRADED MODE: do not return from setup())
  tcaAvailable = false;
  Wire.beginTransmission(TCA9548A_ADDR);
  if (Wire.endTransmission() == 0)
  {
    Serial.println(F("TCA9548A detected"));
    tcaAvailable = true;
  }
  else
  {
    Serial.println(F("TCA9548A not found (degraded mode: LCD disabled)"));
    // DO NOT return;
  }

  // LCD #1
  if (tcaAvailable)
  {
    selectTcaChannel(TCA_CH_LCD1);
    lcd1.init();
    lcd1Available = true;
    lcd1.setBacklight(255);
    lcd1.setCursor(0, 0);
    lcd1.print(F("Drawer 1"));
    lcd1.setCursor(0, 1);
    lcd1.print(F("Initializing..."));
    delay(200);
  }
  else
  {
    lcd1Available = false;
  }

  // LCD #2
  if (tcaAvailable)
  {
    selectTcaChannel(TCA_CH_LCD2);
    lcd2.init();
    lcd2Available = true;
    lcd2.setBacklight(255);
    lcd2.setCursor(0, 0);
    lcd2.print(F("Drawer 2"));
    lcd2.setCursor(0, 1);
    lcd2.print(F("Initializing..."));
    delay(200);
  }
  else
  {
    lcd2Available = false;
  }

  // CD74HC4067
  pinMode(MUX_S0, OUTPUT);
  pinMode(MUX_S1, OUTPUT);
  pinMode(MUX_S2, OUTPUT);
  pinMode(MUX_S3, OUTPUT);

  // DHTs
  dhtA11.begin();
  dhtB11.begin();
  dhtC11.begin();
  dhtA22.begin();
  dhtB22.begin();
  dhtC22.begin();
  dhtD22.begin();
  dhtE22.begin();
  dhtD11.begin();
  dhtE11.begin();

  loadMQ137Calibration(); // Load MQ137 calibration from SD if present

  // WiFiManager
  WiFi.setTxPower(WIFI_POWER_19_5dBm);
  WiFi.setSleep(false);
  WiFiManager wm;
  wm.setSTAStaticIPConfig(IPAddress(IP_STA), IPAddress(IP_GW), IPAddress(SUBNET), IPAddress(IP_DNS));
  wm.setConfigPortalTimeout(180);

  bool res = wm.autoConnect("setupBSF", "bsfcpe67");

  if (!res)
  {
    Serial.println(F("Failed to connect to WiFi"));
    delay(2000);
    ESP.restart();
  }
  else
  {
    Serial.print(F("Connected! IP: "));
    Serial.println(WiFi.localIP());

    DEVICE_ID = WiFi.macAddress();
    DEVICE_ID_CLEAN = DEVICE_ID;
    DEVICE_ID_CLEAN.replace(":", "");

    Serial.print(F("Device ID: "));
    Serial.println(DEVICE_ID);
    Serial.print(F("Device ID (clean): "));
    Serial.println(DEVICE_ID_CLEAN);
  }

  setupWebServer();
  sendHeartbeat();

  xTaskCreatePinnedToCore(
      heartbeatTask,
      "HeartbeatTask",
      8192,
      nullptr,
      6,
      &heartbeatTaskHandle,
      0);

  xTaskCreatePinnedToCore(
      sdUploadTask,
      "SDUploadTask",
      8192,
      nullptr,
      4,
      &sdUploadTaskHandle,
      0);

  xTaskCreatePinnedToCore(
      sensorTask,
      "SensorTask",
      16384,
      nullptr,
      2,
      &sensorTaskHandle,
      1);

  xTaskCreatePinnedToCore(
      sdCountTask,
      "SDCountTask",
      4096,
      nullptr,
      1,
      &sdCountTaskHandle,
      1);

  if (strlen(MQTT_BROKER) > 0)
  {
    mqttEnabled = true;
    mqttReconnect();
  }
}

// ==================== LED CONTROL ====================
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

// ==================== MAIN LOOP ====================
void loop()
{
  unsigned long currentTime = millis();

  static unsigned long lastAlive = 0;
  if (currentTime - lastAlive >= 10000)
  {
    lastAlive = currentTime;
    logLoopHealth();
  }

  bool wifiConnected = WiFi.status() == WL_CONNECTED;
  bool mqttConnected = mqttEnabled && mqttClient.connected();

  if (wifiConnected != lastWifiConnected)
  {
    Serial.print(F("[MODE] WiFi "));
    Serial.println(wifiConnected ? F("CONNECTED") : F("DISCONNECTED -> OFFLINE mode"));
    lastWifiConnected = wifiConnected;

    if (wifiConnected)
      kickHeartbeatNow(); // send one ASAP after reconnect
  }

  if (mqttConnected != lastMqttConnected)
  {
    Serial.print(F("[MODE] MQTT "));
    Serial.println(mqttConnected ? F("CONNECTED") : F("DISCONNECTED"));
    lastMqttConnected = mqttConnected;
  }

  if (currentTime - lastModeDebugTime >= MODE_DEBUG_INTERVAL_MS)
  {
    logConnectivityState("loop");
    lastModeDebugTime = currentTime;
  }

  if (mqttEnabled)
  {
    if (!mqttClient.connected() && currentTime - lastMqttReconnectAttempt >= MQTT_RECONNECT_INTERVAL_MS)
      mqttReconnect();
    mqttClient.loop();
    mqttDrainQueue();
  }

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

  yield();
}

// ==================== SD UPLOAD TASK ====================
static void sdUploadTask(void *pvParameters)
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

// ==================== SENSOR TASK ====================
void sensorTask(void *pvParameters)
{
  (void)pvParameters;

  // Use a fixed-rate schedule to prevent drift
  TickType_t lastWake = xTaskGetTickCount();

  // Spread initial load a little so we don't collide with boot MQTT/heartbeat setup.
  vTaskDelay(pdMS_TO_TICKS(2000));
  lastWake = xTaskGetTickCount();

  for (;;)
  {
    uint32_t startMs = millis();

    sendSensorData();

    uint32_t elapsed = millis() - startMs;
    if (elapsed > (uint32_t)SENSOR_INTERVAL)
    {
      Serial.print(F("[WARN] Sensor cycle overran interval: "));
      Serial.print(elapsed);
      Serial.println(F(" ms"));
    }

    vTaskDelayUntil(&lastWake, pdMS_TO_TICKS(SENSOR_INTERVAL));
  }
}

// ==================== ACTUATOR CONTROL ====================
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

// ==================== SENSOR DATA ====================
void sendSensorData()
{
  collectAndProcessEggLarvaeDrawer(); // Drawer 1 (3 DHT averaged, 3 substrate sensors)
  collectAndProcessPupaDrawer();      // Drawer 2 (1 dedicated DHT22)
}

// ==================== MOISTURE CALIBRATION ====================
static inline int moisturePercentFromRaw(int raw)
{
  if (raw < 0)
    return -1;

  // Ensure ordering
  int dry = gMoistureRawDry;
  int wet = gMoistureRawWet;
  if (dry == wet)
    return -1;
  if (dry < wet)
  {
    int tmp = dry;
    dry = wet;
    wet = tmp;
  }

  // Many capacitive modules give higher voltage (thus raw) when DRY.
  // Map raw in [wet..dry] -> [100..0] or [0..100] depending on your convention.
  // Here: wet => 100, dry => 0.
  long pct = map(raw, wet, dry, 100, 0);
  return (int)constrain(pct, 0, 100);
}

static inline const char *rawRangeTag(int raw)
{
  if (raw < 0)
    return "INVALID";
  int dry = gMoistureRawDry;
  int wet = gMoistureRawWet;
  if (dry < wet)
  {
    int t = dry;
    dry = wet;
    wet = t;
  }

  if (raw > dry)
    return "ABOVE_DRY";
  if (raw < wet)
    return "BELOW_WET";
  return "IN_RANGE";
}

static inline void printAds1MoistureDebug(int16_t r0, int16_t r1, int16_t r2)
{
  Serial.print(F("Sub volts(L/C/R)="));
  if (r0 != ADS_INVALID)
    Serial.print(ads1.computeVolts(r0), 3);
  else
    Serial.print(F("NaN"));
  Serial.print(F("/"));
  if (r1 != ADS_INVALID)
    Serial.print(ads1.computeVolts(r1), 3);
  else
    Serial.print(F("NaN"));
  Serial.print(F("/"));
  if (r2 != ADS_INVALID)
    Serial.println(ads1.computeVolts(r2), 3);
  else
    Serial.println(F("NaN"));
}

void collectAndProcessEggLarvaeDrawer()
{
  // ----- DHTs -----
  DhtReading currentA = readDhtAutoType(dhtA11, dhtA22, true, true, true, "A");
  DhtReading currentB = readDhtAutoType(dhtB11, dhtB22, true, true, true, "B");
  DhtReading currentC = readDhtAutoType(dhtC11, dhtC22, false, true, false, "C");

  // Compact print (avoid long serial spam that can slow loops under load)
  Serial.print(F("DHT1 A:"));
  Serial.print(currentA.valid ? F("OK ") : F("X "));
  Serial.print(F("B:"));
  Serial.print(currentB.valid ? F("OK ") : F("X "));
  Serial.print(F("C:"));
  Serial.println(currentC.valid ? F("OK") : F("X"));

  float humidity = NAN;
  float temperature = NAN;

  int validSensors = 0;
  float tempSum = 0.0f, humSum = 0.0f;

  auto accept = [&](const DhtReading &cur, DhtReading &last, const char *label)
  {
    if (!cur.valid)
      return;

    if (!last.valid || isStableDhtReading(cur, last, 6.0f, 25.0f))
    {
      tempSum += cur.temperature;
      humSum += cur.humidity;
      validSensors++;
      last = cur;
    }
    else
    {
      Serial.print(F("[WARN] Drawer 1 DHT "));
      Serial.print(label);
      Serial.println(F(" rejected as unstable"));
    }
  };

  accept(currentA, lastDrawer1SensorA, "A");
  accept(currentB, lastDrawer1SensorB, "B");
  accept(currentC, lastDrawer1SensorC, "C");

  if (validSensors > 0)
  {
    temperature = tempSum / validSensors;
    humidity = humSum / validSensors;
  }
  else
  {
    Serial.println(F("[WARN] Drawer 1 has no valid DHT readings in this cycle"));
  }

  // ----- Substrate raw + % -----
  int substrate1Raw = readSubstrate1();
  int substrate2Raw = readSubstrate2();
  int substrate3Raw = readSubstrate3();

  printAds1MoistureDebug(
      (substrate1Raw < 0) ? ADS_INVALID : (int16_t)substrate1Raw,
      (substrate2Raw < 0) ? ADS_INVALID : (int16_t)substrate2Raw,
      (substrate3Raw < 0) ? ADS_INVALID : (int16_t)substrate3Raw);

  int leftSubstrate = moisturePercentFromRaw(substrate1Raw);
  int centerSubstrate = moisturePercentFromRaw(substrate2Raw);
  int rightSubstrate = moisturePercentFromRaw(substrate3Raw);

  Serial.print(F("Sub(L/C/R) raw="));
  Serial.print(substrate1Raw);
  Serial.print(F("/"));
  Serial.print(substrate2Raw);
  Serial.print(F("/"));
  Serial.print(substrate3Raw);
  Serial.print(F(" pct="));
  Serial.print(leftSubstrate);
  Serial.print(F("/"));
  Serial.print(centerSubstrate);
  Serial.print(F("/"));
  Serial.print(rightSubstrate);
  Serial.print(F(" tag="));
  Serial.print(rawRangeTag(substrate1Raw));
  Serial.print(F("/"));
  Serial.print(rawRangeTag(substrate2Raw));
  Serial.print(F("/"));
  Serial.println(rawRangeTag(substrate3Raw));

  Nh3Metrics nh3 = readNh3Metrics();

  Serial.print(F("[MQ137] raw="));
  Serial.print((nh3.raw == ADS_INVALID) ? -1 : nh3.raw);

  Serial.print(F(" vrl="));
  if (isfinite(nh3.vrl))
    Serial.print(nh3.vrl, 3);
  else
    Serial.print(F("NaN"));

  Serial.print(F(" rs_kohm="));
  if (isfinite(nh3.rs_kohm))
    Serial.print(nh3.rs_kohm, 3);
  else
    Serial.print(F("NaN"));

  Serial.print(F(" ratio="));
  if (isfinite(nh3.ratio))
    Serial.print(nh3.ratio, 3);
  else
    Serial.print(F("NaN"));

  Serial.print(F(" ppm="));
  if (isfinite(nh3.ppm))
    Serial.println(nh3.ppm, 4);
  else
    Serial.println(F("NaN"));

  // ----- Display + publish/store + control -----
  if (!isnan(humidity) && !isnan(temperature))
  {
    updateLCD1(temperature, humidity, -1);

    updateLCD2SubstratesRow(leftSubstrate, centerSubstrate, rightSubstrate);

    sendOrStoreSensorReading("Drawer 1", temperature, humidity,
                             leftSubstrate, centerSubstrate, rightSubstrate,
                             -1);

    if (isAutoControlActive())
    {
      bool offline = WiFi.status() != WL_CONNECTED;
      if (!offline || millis() >= offlineAutoControlHoldUntil)
      {
        autoControlEggLarvaeDrawer(temperature, humidity, leftSubstrate, centerSubstrate, rightSubstrate);
      }
      else
      {
        Serial.println(F("Offline auto-control skipped during manual override holdoff"));
      }
    }
  }
  else
  {
    if (lcd1Available)
    {
      selectTcaChannel(TCA_CH_LCD1);
      lcd1.clear();
      lcd1.setCursor(0, 0);
      lcd1.print(F("T:X H:X"));
      lcd1.setCursor(0, 1);
      lcd1.print(F("NH3:X"));
    }
  }
}

void collectAndProcessPupaDrawer()
{
  DhtReading currentD = readDhtAutoType(dhtD11, dhtD22, false, false, false, "D");
  DhtReading currentE = readDhtAutoType(dhtE11, dhtE22, false, false, false, "E");

  float humidityD = currentD.humidity;
  float temperatureD = currentD.temperature;
  float humidityE = currentE.humidity;
  float temperatureE = currentE.temperature;

  Serial.print("DHT D -> T:");
  Serial.print(temperatureD);
  Serial.print(" C H:");
  Serial.println(humidityD);
  Serial.print("DHT E -> T:");
  Serial.print(temperatureE);
  Serial.print(" C H:");
  Serial.println(humidityE);

  // --- Parity with EggLarvaeDrawer: average valid DHTs, display, send/store only one averaged reading ---
  float humidity = NAN;
  float temperature = NAN;
  int validSensors = 0;
  float tempSum = 0, humSum = 0;

  bool dValid = currentD.valid && (!lastDrawer2SensorD.valid || isStableDhtReading(currentD, lastDrawer2SensorD, 6.0f, 25.0f));
  bool eValid = currentE.valid && (!lastDrawer2SensorE.valid || isStableDhtReading(currentE, lastDrawer2SensorE, 6.0f, 25.0f));

  if (dValid)
  {
    tempSum += temperatureD;
    humSum += humidityD;
    validSensors++;
    lastDrawer2SensorD = currentD;
  }
  else if (currentD.valid)
  {
    Serial.println("[WARN] Drawer 2 DHT D reading rejected as unstable");
  }

  if (eValid)
  {
    tempSum += temperatureE;
    humSum += humidityE;
    validSensors++;
    lastDrawer2SensorE = currentE;
  }
  else if (currentE.valid)
  {
    Serial.println("[WARN] Drawer 2 DHT E reading rejected as unstable");
  }
  if (validSensors > 0)
  {
    temperature = tempSum / validSensors;
    humidity = humSum / validSensors;
    updateLCD2(temperature, humidity);
    sendOrStoreSensorReading("Drawer 2", temperature, humidity, -1, -1, -1, -1);
  }
  else
  {
    if (lcd2Available)
    {
      selectTcaChannel(TCA_CH_LCD2);
      lcd2.setCursor(0, 1);
      lcd2.print("T:X H:X ");
    }
    Serial.println("[WARN] Drawer 2 has no valid DHT readings in this cycle");
  }

  // --- Auto-control logic: use average if both valid, else whichever is valid ---
  bool doAutoControl = false;
  float autoTemp = NAN;
  float autoHum = NAN;
  if (dValid && eValid)
  {
    autoTemp = (temperatureD + temperatureE) / 2.0f;
    autoHum = (humidityD + humidityE) / 2.0f;
    doAutoControl = true;
  }
  else if (dValid)
  {
    autoTemp = temperatureD;
    autoHum = humidityD;
    doAutoControl = true;
  }
  else if (eValid)
  {
    autoTemp = temperatureE;
    autoHum = humidityE;
    doAutoControl = true;
  }

  if (doAutoControl && isAutoControlActive())
  {
    bool offline = WiFi.status() != WL_CONNECTED;
    if (!offline || millis() >= offlineAutoControlHoldUntil)
    {
      autoControlPupaDrawer(autoTemp, autoHum);
    }
    else
    {
      Serial.println("Offline auto-control skipped during manual override holdoff");
    }
  }
}

void sendOrStoreSensorReading(const char *drawerName, float temperature, float humidity, int leftSubstrate, int centerSubstrate, int rightSubstrate, int ammonia)
{
  // ammonia argument is legacy (old percent). Backend expects "ammonia" key, which we now treat as PPM.
  (void)ammonia;

  bool wifiConnected = WiFi.status() == WL_CONNECTED;
  bool mqttConnected = mqttEnabled && mqttClient.connected();

  // ...existing code...

  // --- Console printing for debugging ---
  Serial.print(F("[SENSOR] "));
  Serial.print(drawerName);
  Serial.print(F(" | Temp: "));
  Serial.print(temperature);
  Serial.print(F(" C | Humidity: "));
  Serial.print(humidity);
  Serial.print(F(" %"));

  if (leftSubstrate >= 0 && centerSubstrate >= 0 && rightSubstrate >= 0)
  {
    Serial.print(F(" | Substrate LCR: "));
    Serial.print(leftSubstrate);
    Serial.print(F("/"));
    Serial.print(centerSubstrate);
    Serial.print(F("/"));
    Serial.print(rightSubstrate);
    Serial.print(F(" %"));
  }

  if (strcmp(drawerName, "Drawer 1") == 0)
  {
    Nh3Metrics nh3 = readNh3Metrics();
    if (nh3.valid)
    {
      Serial.print(F(" | NH3: "));
      if (isfinite(nh3.ppm))
      {
        Serial.print(nh3.ppm, 4);
        Serial.print(F(" ppm"));
      }
      else
      {
        Serial.print(F("NaN"));
      }

      Serial.print(F(" | Rs/Ro: "));
      if (isfinite(nh3.ratio))
        Serial.print(nh3.ratio, 3);
      else
        Serial.print(F("NaN"));
    }
  }

  Serial.println();

  if (wifiConnected)
  {
    bool success = sendSensorReading(drawerName, temperature, humidity, leftSubstrate, centerSubstrate, rightSubstrate, -1);
    if (!success && sdAvailable)
    {
      storeSensorToSD(drawerName, temperature, humidity, leftSubstrate, centerSubstrate, rightSubstrate, -1);
      Serial.println(F("[MODE] Fallback: publish failed, data buffered to SD"));
    }
  }
  else if (sdAvailable)
  {
    storeSensorToSD(drawerName, temperature, humidity, leftSubstrate, centerSubstrate, rightSubstrate, -1);
    Serial.print(F("Stored offline: "));
    Serial.println(drawerName);
  }
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

static bool mqttEnqueuePublish(const char *topic, const char *payload, bool retain = false)
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

static void mqttDrainQueue()
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

// ==================== HEARTBEAT ====================
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

static inline void kickHeartbeatNow()
{
  if (heartbeatTaskHandle)
    xTaskNotifyGive(heartbeatTaskHandle);
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

// ==================== HELPER ====================
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

// ==================== TIME HELPER ====================
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
    DeserializationError err = deserializeJson(doc, payload);
    if (!err && !doc["now"].isNull())
      serverTime = doc["now"].as<uint64_t>();
  }

  http.end();
  tlsUnlock();
  return serverTime;
}

// ==================== MUX HELPERS ====================
void selectMuxChannel(uint8_t channel)
{
  digitalWrite(MUX_S0, channel & 0x01);
  digitalWrite(MUX_S1, (channel >> 1) & 0x01);
  digitalWrite(MUX_S2, (channel >> 2) & 0x01);
  digitalWrite(MUX_S3, (channel >> 3) & 0x01);
  delayMicroseconds(100);
}

int readMuxAnalog(uint8_t channel)
{
  selectMuxChannel(channel);
  return analogRead(MUX_SIG);
}

// ==================== TCA9548A HELPER ====================
void selectTcaChannel(uint8_t channel)
{
  if (!tcaAvailable)
  {
    i2cErrorCount++;
    Serial.println(F("[WARN] TCA9548A not available, cannot select channel"));
    return;
  }
  Wire.beginTransmission(TCA9548A_ADDR);
  Wire.write(1 << channel);
  Wire.endTransmission();
}

// ==================== LCD DISPLAY HELPERS ====================
void updateLCD1(float temp, float humidity, int ammonia)
{
  (void)ammonia; // Option A: legacy % not used anymore

  if (!lcd1Available)
    return;

  Nh3Metrics nh3 = readNh3Metrics();

  selectTcaChannel(TCA_CH_LCD1);
  lcd1.clear();
  lcd1.setCursor(0, 0);

  // Temperature
  if (!isnan(temp))
  {
    lcd1.print("T:");
    lcd1.print(temp, 1);
    lcd1.print("C ");
  }
  else
  {
    lcd1.print("T:X ");
  }

  // Humidity
  if (!isnan(humidity))
  {
    lcd1.print("H:");
    lcd1.print((int)humidity);
    lcd1.print("%");
  }
  else
  {
    lcd1.print("H:X");
  }

  lcd1.setCursor(0, 1);

  // NH3: show ppm if available; if ppm is too tiny/NaN, show ratio
  if (isfinite(nh3.ppm))
  {
    lcd1.print("NH3:");
    if (nh3.ppm < 10.0f)
      lcd1.print(nh3.ppm, 1); // e.g. 0.1, 2.3
    else
      lcd1.print((int)(nh3.ppm + 0.5f)); // e.g. 12, 105

    lcd1.print("ppm");
  }
  else if (isfinite(nh3.ratio))
  {
    lcd1.print("R:");
    lcd1.print(nh3.ratio, 2); // Rs/Ro
    lcd1.print("    ");       // pad
  }
  else
  {
    lcd1.print("NH3:X");
  }
}

static void updateLCD2SubstratesRow(int leftPct, int centerPct, int rightPct)
{
  if (!lcd2Available)
    return;

  selectTcaChannel(TCA_CH_LCD2);
  lcd2.setCursor(0, 0);

  // Example: "S 68/63/100 "
  // Keep it within 16 chars.
  char row0[17];
  snprintf(row0, sizeof(row0), "S %3d/%3d/%3d",
           (leftPct >= 0 && leftPct <= 100) ? leftPct : -1,
           (centerPct >= 0 && centerPct <= 100) ? centerPct : -1,
           (rightPct >= 0 && rightPct <= 100) ? rightPct : -1);

  // Ensure fixed width (pad with spaces)
  for (size_t i = strlen(row0); i < 16; i++)
    row0[i] = ' ';
  row0[16] = '\0';

  lcd2.print(row0);
}

void updateLCD2(float temp, float humidity)
{
  if (!lcd2Available)
    return;
  selectTcaChannel(TCA_CH_LCD2);
  lcd2.setCursor(0, 1);

  char row1[17];

  // Row 1 example: "T:29.4C H:63%"
  // Fits 16 chars.
  if (!isnan(temp) && !isnan(humidity))
  {
    snprintf(row1, sizeof(row1), "T:%4.1fC H:%2d%%", temp, (int)humidity);
  }
  else if (!isnan(temp))
  {
    snprintf(row1, sizeof(row1), "T:%4.1fC H:X  ", temp);
  }
  else if (!isnan(humidity))
  {
    snprintf(row1, sizeof(row1), "T:X    H:%2d%%", (int)humidity);
  }
  else
  {
    snprintf(row1, sizeof(row1), "T:X    H:X   ");
  }

  // Pad/truncate to 16
  row1[16] = '\0';
  lcd2.print(row1);
}

void displayLCDMessage(uint8_t lcdNum, const char *line1, const char *line2)
{
  if (lcdNum == 1 && !lcd1Available)
    return;
  if (lcdNum == 2 && !lcd2Available)
    return;

  selectTcaChannel(lcdNum == 1 ? TCA_CH_LCD1 : TCA_CH_LCD2);
  LiquidCrystal_I2C &lcd = (lcdNum == 1) ? lcd1 : lcd2;

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1);
  lcd.setCursor(0, 1);
  lcd.print(line2);
}

// ==================== ADS1115 HELPERS ====================
int16_t readAds1Channel(uint8_t channel)
{
  if (!ads1Available)
    return ADS_INVALID;

  return ads1.readADC_SingleEnded(channel);
}

int16_t readAds2Channel(uint8_t channel)
{
  if (!ads2Available)
    return ADS_INVALID;

  return ads2.readADC_SingleEnded(channel);
}

// ==================== MCP23017 HELPERS ====================
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

// ==================== MQTT CALLBACK & RECONNECT ====================
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
      setRequestedControlMode(requestedControlMode);
    }
    else
    {
      Serial.print(F("MQTT connect failed, rc="));
      Serial.println(mqttClient.state());
    }
  }
}

// ==================== SENSOR READERS ====================
int readSubstrate1()
{
  int16_t v = readAds1Channel(ADS1_SUBSTRATE_1);
  if (v == ADS_INVALID)
    return -1; // sentinel for "invalid"
  return (int)v;
}

int readSubstrate2()
{
  int16_t v = readAds1Channel(ADS1_SUBSTRATE_2);
  if (v == ADS_INVALID)
    return -1;
  return (int)v;
}

int readSubstrate3()
{
  int16_t v = readAds1Channel(ADS1_SUBSTRATE_3);
  if (v == ADS_INVALID)
    return -1;
  return (int)v;
}

int readMQ137()
{
  int16_t v = readAds2Channel(ADS2_MQ137);
  if (v == ADS_INVALID)
    return -1;
  return (int)v;
}

// ==================== SD CARD STORAGE ====================
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

    // IMPORTANT: reuse the global TLS client (less heap churn/fragmentation)
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

// ==================== OFFLINE AUTO CONTROL ====================
void autoControlEggLarvaeDrawer(float temperature, float humidity, int leftMoisture, int centerMoisture, int rightMoisture)
{
  bool fanOn = false;
  bool heaterOn = false;
  bool heaterFanOn = false;
  bool humidifierOn = false;
  bool pumpOn = false;

  // Temperature control: fan for cooling, heater for warming
  if (temperature >= TEMP_OPTIMAL_HIGH)
  {
    fanOn = true;
    heaterOn = false;
    heaterFanOn = false;
  }
  else if (temperature <= TEMP_OPTIMAL_LOW)
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

  // Humidity control: humidifier when humidity is low.
  // Keep temperature safety priority: do not disable cooling fans due to low humidity.
  if (humidity <= HUMIDITY_OPTIMAL_LOW)
  {
    if (!fanOn)
    {
      humidifierOn = true;
    }
  }
  else if (humidity >= HUMIDITY_OPTIMAL_HIGH)
  {
    fanOn = true;
    humidifierOn = false;
  }

  // Moisture control
  if ((leftMoisture >= 0 && leftMoisture <= MOISTURE_OPTIMAL_LOW) ||
      (centerMoisture >= 0 && centerMoisture <= MOISTURE_OPTIMAL_LOW) ||
      (rightMoisture >= 0 && rightMoisture <= MOISTURE_OPTIMAL_LOW))
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

  // Temperature control: fan for cooling only
  if (temperature >= TEMP_OPTIMAL_HIGH || temperature > TEMP_MAX)
  {
    fanOn = true;
    humidifierOn = false;
  }

  // Humidity control: humidify when dry, ventilate when too humid
  if (humidity <= HUMIDITY_OPTIMAL_LOW)
  {
    humidifierOn = true;
  }
  else if (humidity >= HUMIDITY_OPTIMAL_HIGH)
  {
    humidifierOn = false;
    fanOn = true;
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

bool isValidDrawer1DhtReading(float temperature, float humidity)
{
  // Drawer 1 operates in a warm, humid envelope. Tight bounds block cross-type garbage readings.
  return !isnan(temperature) && !isnan(humidity) && temperature >= 15.0f && temperature <= 45.0f && humidity >= 30.0f && humidity <= 95.0f;
}

bool isValidDrawer2DhtReading(float temperature, float humidity)
{
  return !isnan(temperature) && !isnan(humidity) && temperature >= 15.0f && temperature <= 45.0f && humidity >= 20.0f && humidity <= 100.0f;
}

bool isStableDhtReading(const DhtReading &current, const DhtReading &previous, float maxTempDelta, float maxHumidityDelta)
{
  if (!previous.valid)
    return true;

  return fabsf(current.temperature - previous.temperature) <= maxTempDelta && fabsf(current.humidity - previous.humidity) <= maxHumidityDelta;
}

bool readRawDht(DHT &sensor, float &humidity, float &temperature)
{
  if (gDhtMutex)
  {
    if (xSemaphoreTake(gDhtMutex, pdMS_TO_TICKS(1500)) != pdTRUE)
      return false;
  }

  bool ok = false;

  for (int attempt = 0; attempt < DHT_READ_ATTEMPTS; attempt++)
  {
    humidity = sensor.readHumidity();
    temperature = sensor.readTemperature();
    if (!isnan(temperature) && !isnan(humidity))
    {
      ok = true;
      break;
    }
    delay(120);
  }

  if (gDhtMutex)
    xSemaphoreGive(gDhtMutex);

  return ok;
}

DhtReading readDhtAutoType(DHT &dht11, DHT &dht22, bool preferDht11, bool useDrawer1Validation, bool allowTypeFallback, const char *label)
{
  DhtReading result = {NAN, NAN, false, 0};

  float humidityPrimary = NAN;
  float temperaturePrimary = NAN;
  float humiditySecondary = NAN;
  float temperatureSecondary = NAN;

  DHT &primary = preferDht11 ? dht11 : dht22;
  DHT &secondary = preferDht11 ? dht22 : dht11;
  uint8_t primaryType = preferDht11 ? 11 : 22;
  uint8_t secondaryType = preferDht11 ? 22 : 11;

  bool primaryOk = readRawDht(primary, humidityPrimary, temperaturePrimary);
  if (primaryOk)
  {
    bool inRange = useDrawer1Validation
                       ? isValidDrawer1DhtReading(temperaturePrimary, humidityPrimary)
                       : isValidDrawer2DhtReading(temperaturePrimary, humidityPrimary);
    if (inRange)
    {
      result.temperature = temperaturePrimary;
      result.humidity = humidityPrimary;
      result.valid = true;
      result.sourceType = primaryType;
      return result;
    }
  }

  if (!allowTypeFallback)
  {
    Serial.print("[WARN] DHT ");
    Serial.print(label);
    Serial.println(" primary read invalid; fallback disabled for fixed sensor type");
    return result;
  }

  bool secondaryOk = readRawDht(secondary, humiditySecondary, temperatureSecondary);
  if (secondaryOk)
  {
    bool inRange = useDrawer1Validation
                       ? isValidDrawer1DhtReading(temperatureSecondary, humiditySecondary)
                       : isValidDrawer2DhtReading(temperatureSecondary, humiditySecondary);
    if (inRange)
    {
      result.temperature = temperatureSecondary;
      result.humidity = humiditySecondary;
      result.valid = true;
      result.sourceType = secondaryType;
      Serial.print(F("[INFO] DHT "));
      Serial.print(label);
      Serial.print(F(" fallback using DHT"));
      Serial.println(secondaryType);
      return result;
    }
  }

  return result;
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

// ==================== WEB SERVER ====================
void setupWebServer()
{
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "Content-Type");

  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request)
            { request->redirect("/hardware"); });
  server.on("/hardware", HTTP_GET, handleHardwarePage);
  server.on("/calibrate/mq137", HTTP_POST, handleCalibrateAmmonia);
  server.on("/calibration/status", HTTP_GET, handleCalibrationStatus);
  server.on("/calibrate/all", HTTP_POST, handleCalibrateAllSensors);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/sdcard/data", HTTP_GET, handleGetSdData);
  server.on("/sdcard/clear", HTTP_POST, handleClearSdData);
  server.on("/sdcard/sync", HTTP_POST, handleSyncSdData);
  server.on("/reboot", HTTP_POST, handleReboot);
  ElegantOTA.begin(&server);
  server.begin();
  Serial.print(F("Web server started at http://"));
  Serial.println(WiFi.localIP());
}

static const char HARDWARE_HTML[] PROGMEM = R"HTML(
<!DOCTYPE html>
<html>
<head>
  <title>BSFly IoT</title>
  <meta name='viewport' content='width=device-width,initial-scale=1'>
  <style>
    body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:20px;max-width:760px;margin:0 auto;background:#08110d;color:#e9f5ee}
    h1,h2,h3{color:#ffffff}
    .card{background:rgba(255,255,255,.05);padding:18px;margin:14px 0;border-radius:16px;border:1px solid rgba(255,255,255,.08)}
    a,button{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#2dd55b 0%,#17a34a 100%);color:white;border:none;padding:12px 18px;border-radius:12px;margin:6px 6px 6px 0;cursor:pointer;text-decoration:none;font-weight:700}
    button:hover,a:hover{filter:brightness(1.05)}
    .danger{background:linear-gradient(135deg,#ff4757 0%,#c5000f 100%)}
    .muted{color:rgba(233,245,238,.75);line-height:1.6}
    ul{padding-left:20px;line-height:1.7}
    code{background:rgba(255,255,255,.08);padding:2px 6px;border-radius:8px}
  </style>
</head>
<body>
  <h1>BSFly IoT Hardware</h1>
  <p class='muted'>Upload firmware over the air, then reboot the controller from the same page.</p>

  <div class='card'>
    <strong>Device ID:</strong> <span id="deviceId">Loading...</span><br>
    <strong>IP Address:</strong> <span id="ip">Loading...</span>
  </div>

  <div class='card'>
    <strong>SD Card:</strong> <span id="sdAvail">Loading...</span><br>
    <strong>Control Mode:</strong> <span id="modeText">Loading...</span><br>
    <strong>Stored Readings:</strong> <span id="storedCount">Loading...</span>
  </div>

  <div class='card'>
    <h2>Actions</h2>
    <a href='/update' target='_blank' rel='noopener noreferrer'>Open ElegantOTA Upload</a>
    <button class='danger' onclick="fetch('/reboot',{method:'POST'}).then(r=>r.json()).then(d=>alert(d.message)).catch(e=>alert(e.message))">
      Reboot ESP32
    </button>
  </div>

  <div class='card'>
    <h2>MQ137 Ammonia Sensor Calibration</h2>
    <p class='muted'>Calibrate the MQ137 sensor in fresh air.</p>
    <p id='calibStatus' class='muted'>Status: Loading...</p>
    <button id='calibBtn' onclick='startCalibration()'>Start Calibration</button>
  </div>

  <script>
    let calibPollTimer=null;

    function renderStatus(s){
      document.getElementById('deviceId').textContent = s.deviceId || 'N/A';
      document.getElementById('ip').textContent = s.ip || 'N/A';
      document.getElementById('sdAvail').textContent = (s.sdAvailable ? 'Available' : 'Not found');
      document.getElementById('storedCount').textContent = (typeof s.storedCount !== 'undefined') ? s.storedCount : 'N/A';
      document.getElementById('modeText').textContent = s.requestedControlMode || 'N/A';
    }

    function renderCalib(d){
      const inProg=!!d.inProgress;
      const prog=('progress' in d)?(''+d.progress):'0';
      const valid=('validSamples' in d)?(''+d.validSamples):'0';
      const ro=(d.ro!==undefined&&d.ro!==null)?d.ro:'N/A';
      const last=(d.lastCalibration?new Date(d.lastCalibration*1000).toLocaleString():'Never');
      let st='Status: '+(inProg?'Calibrating':'Idle')+' | Progress: '+prog+'% (valid '+valid+') | Ro='+ro+' | Last='+last;
      document.getElementById('calibStatus').textContent=st;
      const btn=document.getElementById('calibBtn');
      btn.disabled=inProg;
      btn.textContent=inProg?'Calibrating...':'Start Calibration';
    }

    function loadStatus(){
      fetch('/status').then(r=>r.json()).then(renderStatus).catch(_=>{});
    }

    function loadCalibStatus(){
      fetch('/calibration/status').then(r=>r.json()).then(d=>{
        renderCalib(d);
        if(d.inProgress){
          if(!calibPollTimer) calibPollTimer=setInterval(loadCalibStatus, 1000);
        } else {
          if(calibPollTimer){clearInterval(calibPollTimer); calibPollTimer=null;}
        }
      }).catch(_=>{
        document.getElementById('calibStatus').textContent='Status: Error loading';
      });
    }

    function startCalibration(){
      const btn=document.getElementById('calibBtn');
      btn.disabled=true; btn.textContent='Starting...';
      fetch('/calibrate/mq137',{method:'POST'}).then(async r=>{
        let d={}; try{d=await r.json();}catch(e){}
        if(!r.ok){throw new Error(d.error||d.message||('HTTP '+r.status));}
        loadCalibStatus();
      }).catch(e=>alert('Error: '+e.message));
    }

    loadStatus();
    loadCalibStatus();
    setInterval(loadStatus, 5000);
  </script>
</body>
</html>
)HTML";

void handleHardwarePage(AsyncWebServerRequest *request)
{
  request->send_P(200, "text/html", HARDWARE_HTML);
}

void handleStatus(AsyncWebServerRequest *request)
{
  int cached = (int)gSdStoredCountCached;

  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["ip"] = WiFi.localIP().toString();
  doc["sdAvailable"] = sdAvailable;
  doc["storedCount"] = (cached >= 0) ? cached : 0;
  doc["wifiConnected"] = WiFi.status() == WL_CONNECTED;
  doc["requestedControlMode"] = getRequestedControlModeName();
  doc["autoControlActive"] = isAutoControlActive();
  doc["uptime"] = millis() / 1000;

  String response;
  serializeJson(doc, response);
  request->send(200, "application/json", response);
}

void handleGetSdData(AsyncWebServerRequest *request)
{
  if (!sdAvailable)
  {
    request->send(503, "application/json", "{\"error\":\"SD card not available\"}");
    return;
  }

  if (!SD.exists(SD_DATA_FILE))
  {
    request->send(200, "application/json", "{\"readings\":[]}");
    return;
  }

  File file = SD.open(SD_DATA_FILE, FILE_READ);
  if (!file)
  {
    request->send(500, "application/json", "{\"error\":\"Failed to open file\"}");
    return;
  }

  AsyncResponseStream *response = request->beginResponseStream("application/json");
  response->print("{\"deviceId\":\"");
  response->print(DEVICE_ID);
  response->print("\",\"readings\":[");

  bool first = true;
  while (file.available())
  {
    String line = file.readStringUntil('\n');
    line.trim();
    if (line.length() > 0)
    {
      if (!first)
        response->print(",");
      response->print(line);
      first = false;
    }
  }

  response->print("]}");
  request->send(response);
  file.close();
}

void handleClearSdData(AsyncWebServerRequest *request)
{
  if (!sdAvailable)
  {
    request->send(503, "application/json", "{\"error\":\"SD card not available\"}");
    return;
  }

  if (SD.exists(SD_DATA_FILE))
  {
    SD.remove(SD_DATA_FILE);
  }

  request->send(200, "application/json", "{\"message\":\"Data cleared\",\"success\":true}");
}

void handleSyncSdData(AsyncWebServerRequest *request)
{
  if (!sdAvailable)
  {
    request->send(503, "application/json", "{\"error\":\"SD card not available\"}");
    return;
  }

  if (WiFi.status() != WL_CONNECTED)
  {
    request->send(503, "application/json", "{\"error\":\"WiFi not connected\"}");
    return;
  }

  sdUploadKick = true;

  int cached = (int)gSdStoredCountCached;
  JsonDocument doc;
  doc["message"] = "Sync queued";
  doc["queued"] = true;
  doc["storedCount"] = (cached >= 0) ? cached : 0;
  doc["success"] = true;

  String response;
  serializeJson(doc, response);
  request->send(202, "application/json", response);
}

void handleReboot(AsyncWebServerRequest *request)
{
  JsonDocument doc;
  doc["message"] = "ESP32 rebooting";
  doc["success"] = true;

  String response;
  serializeJson(doc, response);
  request->send(200, "application/json", response);
  delay(1000);
  ESP.restart();
}

void handleCalibrateAmmonia(AsyncWebServerRequest *request)
{
  JsonDocument doc;

  if (mq137CalibrationInProgress || mq137CalTaskHandle != nullptr)
  {
    doc["error"] = "Calibration already in progress";
    doc["status"] = "busy";
    String response;
    serializeJson(doc, response);
    request->send(409, "application/json", response);
    return;
  }

  // MQ137 is read from ADS1115 #2 in this firmware
  if (!ads2Available)
  {
    doc["error"] = "ADS1115 #2 not available";
    String response;
    serializeJson(doc, response);
    request->send(503, "application/json", response);
    return;
  }

  // Start calibration in background task; return immediately.
  BaseType_t ok = xTaskCreatePinnedToCore(
      mq137CalibrationTask,
      "MQ137Cal",
      6144,
      nullptr,
      1,
      &mq137CalTaskHandle,
      1);

  if (ok != pdPASS)
  {
    mq137CalTaskHandle = nullptr;
    doc["error"] = "Failed to start calibration task";
    String response;
    serializeJson(doc, response);
    request->send(500, "application/json", response);
    return;
  }

  doc["success"] = true;
  doc["message"] = "MQ137 calibration started";
  doc["status"] = "started";
  doc["progress"] = (int)mq137CalProgress;

  String response;
  serializeJson(doc, response);
  request->send(202, "application/json", response);
}

void handleCalibrationStatus(AsyncWebServerRequest *request)
{
  JsonDocument doc;

  doc["inProgress"] = (mq137CalibrationInProgress || mq137CalTaskHandle != nullptr);
  doc["progress"] = (int)mq137CalProgress;
  doc["validSamples"] = (int)mq137CalValidSamples;
  doc["ro"] = mq137Ro;
  doc["lastCalibration"] = mq137LastCalibration;
  doc["calibrationPoint"] = MQ137_CALIBRATION_PPM;
  doc["rl"] = (float)MQ137_RL;

  if (isfinite(mq137CalLastRsAvg))
    doc["rsAverage"] = mq137CalLastRsAvg;

  // Keep your old estimated PPM behavior, but only when we can read a value.
  if (mq137Ro > 0)
  {
    int16_t rawValue = readAds2Channel(ADS2_MQ137);
    if (rawValue != ADS_INVALID)
    {
      doc["raw"] = rawValue;
      doc["vrl"] = ads2.computeVolts(rawValue);

      float rs = calculateRstFromRaw(rawValue);
      doc["rs_kohm"] = rs;

      float ratio = rs / mq137Ro;
      doc["rs_ro_ratio"] = ratio;

      float ppm = estimateNh3PpmFromRaw(rawValue);
      if (isfinite(ppm))
        doc["estimatedPpm"] = ppm;

      // Expose curve constants for debugging/tuning
      doc["curveA"] = MQ137_NH3_A;
      doc["curveB"] = MQ137_NH3_B;
    }
  }

  String response;
  serializeJson(doc, response);
  request->send(200, "application/json", response);
}

void handleCalibrateAllSensors(AsyncWebServerRequest *request)
{
  JsonDocument doc;

  if (mq137CalibrationInProgress)
  {
    doc["error"] = "Calibration already in progress";
    doc["status"] = "busy";
  }
  else
  {
    Serial.println(F("[CALIBRATION] Starting all-sensor calibration..."));
    float newRo = calibrateMQ137();

    doc["success"] = true;
    doc["message"] = "All sensors calibrated";

    // mq137 object
    JsonObject mq137 = doc["mq137"].to<JsonObject>();
    mq137["ro"] = newRo;
    mq137["timestamp"] = mq137LastCalibration;
    mq137["status"] = "calibrated";

    // substrate object
    JsonObject substrate = doc["substrate"].to<JsonObject>();
    substrate["status"] = "not_implemented";
    substrate["message"] = "Substrate moisture calibration available on hardware page";

    // temperature object
    JsonObject temperature = doc["temperature"].to<JsonObject>();
    temperature["status"] = "not_needed";
    temperature["message"] = "Temperature sensors use standard DHT calibration";
  }

  String response;
  serializeJson(doc, response);
  request->send(200, "application/json", response);
}

static void logLoopHealth()
{
  Serial.print(F("[ALIVE] millis="));
  Serial.print(millis());

  Serial.print(F(" heap="));
  Serial.print(ESP.getFreeHeap());

  Serial.print(F(" minHeap="));
  Serial.print(ESP.getMinFreeHeap());

  Serial.print(F(" loopStackWatermark="));
  Serial.print(uxTaskGetStackHighWaterMark(nullptr));

  Serial.print(F(" mqttQueueDrops="));
  Serial.println((uint32_t)gMqttQueueDropCount);
}

static Nh3Metrics readNh3Metrics()
{
  Nh3Metrics m{};
  m.valid = false;
  m.raw = ADS_INVALID;
  m.vrl = NAN;
  m.rs_kohm = NAN;
  m.ratio = NAN;
  m.ppm = NAN;

  if (!ads2Available || mq137Ro <= 0.0f)
    return m;

  int16_t raw = readAds2Channel(ADS2_MQ137);
  if (raw == ADS_INVALID)
    return m;

  m.raw = raw;
  m.vrl = ads2.computeVolts(raw);

  float rs = calculateRstFromRaw(raw);
  if (!(rs > 0.0f) || !isfinite(rs))
    return m;

  m.rs_kohm = rs;
  m.ratio = rs / mq137Ro;
  m.ppm = estimateNh3PpmFromRaw(raw);

  m.valid = isfinite(m.ratio) && (m.ratio > 0.0f);
  return m;
}

// Calculate sensor resistance(Rst) from raw ADC value
float calculateRstFromRaw(int16_t rawValue)
{
  if (rawValue == ADS_INVALID)
    return 0.0f;

  const float VRL = ads2.computeVolts(rawValue);
  if (!isfinite(VRL) || VRL <= 0.00001f)
    return 0.0f;

  const float Vc = MQ137_VC;

  if (VRL >= (Vc - 0.01f))
    return 0.0f;

#if MQ137_DIVIDER_INVERTED
  // Vc -> RL -> (AO=VRL) -> Rs -> GND
  // VRL = Vc * (Rs / (RL + Rs))  =>  Rs = RL * VRL / (Vc - VRL)
  float Rst = MQ137_RL * (VRL / (Vc - VRL)); // kΩ
#else
  // Vc -> Rs -> (AO=VRL) -> RL -> GND
  // VRL = Vc * (RL / (RL + Rs))  =>  Rs = ((Vc/VRL) - 1) * RL
  float Rst = ((Vc / VRL) - 1.0f) * MQ137_RL; // kΩ
#endif

  if (!isfinite(Rst) || Rst <= 0.0f)
    return 0.0f;

  return Rst;
}

static float estimateNh3PpmFromRaw(int16_t rawValue)
{
  if (rawValue == ADS_INVALID || mq137Ro <= 0.0f)
    return NAN;

  float rs = calculateRstFromRaw(rawValue);
  if (!(rs > 0.0f) || !isfinite(rs))
    return NAN;

  float ratio = rs / mq137Ro;
  if (!(ratio > 0.0f) || !isfinite(ratio))
    return NAN;

  // Trust region: based on your curve points (10ppm=>0.32, 100ppm=>0.198).
  // Ratios far below ~0.1 imply very high ppm and/or model mismatch.
  const float kMinTrustedRatio = 0.10f;
  const float kMaxTrustedRatio = 10.0f;

  if (ratio < kMinTrustedRatio)
    return NAN; // out-of-model; prevents absurd ppm
  if (ratio > kMaxTrustedRatio)
    ratio = kMaxTrustedRatio;

  float ppm = MQ137_NH3_A * powf(ratio, MQ137_NH3_B);
  if (!isfinite(ppm) || ppm < 0.0f)
    return NAN;

  return ppm;
}

// Perform MQ137 calibration
float calibrateMQ137()
{
  if (mq137CalibrationInProgress)
  {
    Serial.println(F("MQ137 calibration already in progress"));
    return mq137Ro;
  }

  Serial.println(F("[MQ137] Starting calibration..."));
  Serial.println(F("[MQ137] Please ensure sensor is in fresh air (20°C, 65% humidity, 21% O2)"));
  mq137CalibrationInProgress = true;

  // Take multiple readings and average them
  float RsSum = 0;
  for (int i = 0; i < MQ137_CALIBRATION_CYCLES; i++)
  {
    int16_t rawValue = readAds2Channel(ADS2_MQ137);
    float Rst = calculateRstFromRaw(rawValue);
    RsSum += Rst;

    if (i % 50 == 0)
    {
      Serial.print(F("[MQ137] Reading "));
      Serial.print(i);
      Serial.print(F("/"));
      Serial.print(MQ137_CALIBRATION_CYCLES);
      Serial.print(F(" - Rst: "));
      Serial.println(Rst);
    }

    delay(10);
  }

  float RsAverage = RsSum / MQ137_CALIBRATION_CYCLES;

  // Calculate Ro: Ro = Rst / (Rst/Ro ratio at calibration point)
  mq137Ro = RsAverage / MQ137_CALIBRATION_RATIO;
  mq137LastCalibration = getServerTime() / 1000ULL; // Store as seconds since epoch

  // Save calibration to SD card
  if (sdAvailable)
  {
    JsonDocument doc;
    doc["ro"] = mq137Ro;
    doc["timestamp"] = mq137LastCalibration;
    doc["rsAverage"] = RsAverage;
    doc["calibrationPoint"] = MQ137_CALIBRATION_PPM;

    File file = SD.open(MQ137_CALIBRATION_FILE, FILE_WRITE);
    if (file)
    {
      serializeJson(doc, file);
      file.close();
      Serial.println(F("[MQ137] Calibration data saved to SD"));
    }
    else
    {
      Serial.println(F("[MQ137] Failed to save calibration to SD"));
    }
  }

  mq137CalibrationInProgress = false;

  Serial.print(F("[MQ137] Calibration complete! Ro = "));
  Serial.println(mq137Ro);

  return mq137Ro;
}

// Load calibration from SD card
void loadMQ137Calibration()
{
  if (!sdAvailable)
  {
    Serial.println(F("[MQ137] SD not available, calibration not loaded (Ro=0)"));
    return;
  }

  if (!SD.exists(MQ137_CALIBRATION_FILE))
  {
    Serial.println(F("[MQ137] No calibration file found (Ro=0, please calibrate)"));
    return;
  }

  File file = SD.open(MQ137_CALIBRATION_FILE, FILE_READ);
  if (!file)
  {
    Serial.println(F("[MQ137] Failed to open calibration file"));
    return;
  }

  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, file);
  file.close();

  if (error)
  {
    Serial.print(F("[MQ137] Failed to parse calibration: "));
    Serial.println(error.f_str());
    return;
  }

  // ArduinoJson v7+ friendly: avoid containsKey()
  if (doc["ro"].is<float>() || doc["ro"].is<int>() || doc["ro"].is<double>())
  {
    mq137Ro = doc["ro"].as<float>();

    // timestamp is optional; only read if present and numeric
    if (doc["timestamp"].is<unsigned long>() || doc["timestamp"].is<long>() || doc["timestamp"].is<uint32_t>())
      mq137LastCalibration = doc["timestamp"].as<unsigned long>();

    Serial.print(F("[MQ137] Loaded calibration - Ro = "));
    Serial.print(mq137Ro);
    Serial.print(F(" (timestamp: "));
    Serial.print(mq137LastCalibration);
    Serial.println(F(")"));
  }
  else
  {
    Serial.println(F("[MQ137] Calibration file missing numeric 'ro', using Ro=0 (not calibrated)"));
    mq137Ro = 0.0f;
  }
}

// ==================== ASYNC MQ137 CALIBRATION TASK ====================
static void mq137CalibrationTask(void *pvParameters)
{
  (void)pvParameters;

  mq137CalibrationInProgress = true;
  mq137CalProgress = 0;
  mq137CalValidSamples = 0;
  mq137CalLastRsAvg = NAN;

  float RsSum = 0.0f;
  uint16_t valid = 0;

  for (int i = 0; i < MQ137_CALIBRATION_CYCLES; i++)
  {
    int16_t rawValue = readAds2Channel(ADS2_MQ137);
    float Rst = calculateRstFromRaw(rawValue);

    if (Rst > 0.0f && isfinite(Rst))
    {
      RsSum += Rst;
      valid++;
    }

    if ((i % 50) == 0)
    {
      Serial.print(F("[MQ137] Reading "));
      Serial.print(i);
      Serial.print(F("/"));
      Serial.print(MQ137_CALIBRATION_CYCLES);
      Serial.print(F(" - Rst: "));
      Serial.print(Rst);
      Serial.print(F(" valid="));
      Serial.println(valid);
    }

    mq137CalProgress = (uint16_t)((100UL * (uint32_t)(i + 1)) / (uint32_t)MQ137_CALIBRATION_CYCLES);
    mq137CalValidSamples = valid;

    vTaskDelay(pdMS_TO_TICKS(10));
  }

  if (valid == 0)
  {
    Serial.println(F("[MQ137] Calibration failed: no valid samples"));
    mq137CalibrationInProgress = false;
    mq137CalTaskHandle = nullptr;
    vTaskDelete(nullptr);
    return;
  }

  float RsAverage = RsSum / (float)valid;
  mq137CalLastRsAvg = RsAverage;

  mq137Ro = RsAverage / MQ137_CALIBRATION_RATIO;

  // Prefer server time if available; else store 0 (unknown) instead of wrong epoch.
  uint64_t serverNow = getServerTime();
  mq137LastCalibration = (serverNow > 0) ? (float)(serverNow / 1000ULL) : 0.0f;

  // Save calibration to SD card
  if (sdAvailable)
  {
    JsonDocument doc;
    doc["ro"] = mq137Ro;
    doc["timestamp"] = mq137LastCalibration;
    doc["rsAverage"] = RsAverage;
    doc["validSamples"] = valid;
    doc["calibrationPoint"] = MQ137_CALIBRATION_PPM;

    File file = SD.open(MQ137_CALIBRATION_FILE, FILE_WRITE);
    if (file)
    {
      serializeJson(doc, file);
      file.close();
      Serial.println(F("[MQ137] Calibration data saved to SD"));
    }
    else
    {
      Serial.println(F("[MQ137] Failed to save calibration to SD"));
    }
  }

  mq137CalibrationInProgress = false;
  mq137CalTaskHandle = nullptr;

  Serial.print(F("[MQ137] Calibration complete! Ro = "));
  Serial.println(mq137Ro);

  vTaskDelete(nullptr);
}

// ==================== STATE LOCKING (CRITICAL SECTION) ====================
// Protects shared state touched from loop(), sensorTask(), MQTT callback, and web handlers.
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

static inline unsigned long getOfflineHoldUntilLocked()
{
  stateLock();
  unsigned long t = offlineAutoControlHoldUntil;
  stateUnlock();
  return t;
}

static inline void setLightTimerLocked(bool on, unsigned long endTimeMs)
{
  stateLock();
  lightState = on;
  lightEndTime = endTimeMs;
  stateUnlock();
}

static inline void getLightTimerLocked(bool &on, unsigned long &endTimeMs)
{
  stateLock();
  on = lightState;
  endTimeMs = lightEndTime;
  stateUnlock();
}

static bool tlsTryLock(TickType_t waitTicks)
{
  if (!gTlsMutex)
    return false;
  return xSemaphoreTake(gTlsMutex, waitTicks) == pdTRUE;
}

static void tlsUnlock()
{
  if (gTlsMutex)
    xSemaphoreGive(gTlsMutex);
}

static bool canStartTlsNow(const char *tag)
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

static void sdCountTask(void *pvParameters)
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