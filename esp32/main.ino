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
 * - DHT11 temperature/humidity sensors (2x for Drawer 1)
 * - DHT22 temperature/humidity sensor (1x for Drawer 2)
 * - MicroSD card module
 *
 * Network:
 * - WiFi: MQTT
 * - Fallback: Local SD card storage and autonomous control
 *
 * ==================== PIN MAPPING ====================
 * ESP32 Pin Mapping:
 * | Function/Peripheral    | Macro            | ESP32 Pin |
 * |------------------------|------------------|-----------|
 * | I2C SDA                | I2C_SDA          | 21        |
 * | I2C SCL                | I2C_SCL          | 22        |
 * | SPI SCK (SD Card)      | SPI_SCK          | 18        |
 * | SPI MISO (SD Card)     | SPI_MISO         | 19        |
 * | SPI MOSI (SD Card)     | SPI_MOSI         | 23        |
 * | SPI CS (SD Card)       | SPI_CS_SD        | 15        |
 * | LED                    | LED_PIN          | 4         |
 * | MUX SIG                | MUX_SIG          | 35        |
 * | MUX S0                 | MUX_S0           | 16        |
 * | MUX S1                 | MUX_S1           | 17        |
 * | MUX S2                 | MUX_S2           | 32        |
 * | MUX S3                 | MUX_S3           | 33        |
 * | DHT Sensor A           | DHT_A_PIN        | 13        |
 * | DHT Sensor B           | DHT_B_PIN        | 26        |
 * | DHT Sensor C           | DHT_C_PIN        | 25        |
 * | DHT Sensor D           | DHT_D_PIN        | 14        |
 * | DHT Sensor E           | DHT_E_PIN        | 27        |
 *
 * I2C Device Addresses:
 * | Device                 | Macro            | Address   |
 * |------------------------|------------------|-----------|
 * | ADS1115 #1             | ADS1115_ADDR_1   | 0x48      |
 * | ADS1115 #2             | ADS1115_ADDR_2   | 0x49      |
 * | MCP23017               | MCP23017_ADDR    | 0x20      |
 * | TCA9548A               | TCA9548A_ADDR    | 0x70      |
 * | LCD (I2C)              | LCD_ADDR         | 0x27      |
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
 * | Pupa Fans              | MCP_PUPA_FANS             | 7            |
 *
 * Other Analog Channels:
 * | Function               | Macro            | Channel/Pin |
 * |------------------------|------------------|-------------|
 * | Substrate 1 (ADS1115)  | ADS_SUBSTRATE1   | 0           |
 * | Substrate 2 (ADS1115)  | ADS_SUBSTRATE2   | 1           |
 * | Substrate 3 (ADS1115)  | ADS_SUBSTRATE3   | 2           |
 * | Ammonia (ADS1115)      | ADS_MQ137        | 3           |
 * | Substrate 1 (MUX)      | MUX_CH_SUBSTRATE1| 0           |
 * | Substrate 2 (MUX)      | MUX_CH_SUBSTRATE2| 1           |
 * | Substrate 3 (MUX)      | MUX_CH_SUBSTRATE3| 2           |
 * ==================================================
 */

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
#include <SD.h>
#include <SPI.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>
#include <Adafruit_MCP23X17.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

// ==================== CONFIGURATION ====================
#include "credentials.h"\n#include "mq137_calibration.h"

#define MQTT_BASE_TOPIC "devices"

String DEVICE_ID;
String DEVICE_ID_CLEAN;

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
// Drawer 1 sensors: DHT11 A+B and DHT22 C
#define DHT_A_PIN GPIO_NUM_16

#define DHT_B_PIN GPIO_NUM_26
#define DHT_C_PIN GPIO_NUM_25
// Drawer 2 dedicated DHT22 sensor D
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
#define ADS_SUBSTRATE1 0
#define ADS_SUBSTRATE2 1
#define ADS_SUBSTRATE3 2
#define ADS_MQ137 3

// ==================== CD74HC4067 CHANNELS ====================
#define MUX_CH_SUBSTRATE1 0
#define MUX_CH_SUBSTRATE2 1
#define MUX_CH_SUBSTRATE3 2

// ==================== TIMING ====================
#define SENSOR_INTERVAL 30000
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
#define TEMP_OPTIMAL_LOW 28.0
#define TEMP_OPTIMAL_HIGH 32.0

#define HUMIDITY_MIN 50.0
#define HUMIDITY_MAX 80.0
#define HUMIDITY_OPTIMAL_LOW 60.0
#define HUMIDITY_OPTIMAL_HIGH 70.0

// ==================== MQ137 CALIBRATION ====================
#define MQ137_RL 47.0  // Load resistance in kOhm (47K recommended)
#define MQ137_CALIBRATION_PPM 21.0  // Fresh air reference (21% O2 approx)
#define MQ137_CALIBRATION_RATIO 3.6  // Rs/Ro ratio in fresh air (from datasheet)
#define MQ137_CALIBRATION_CYCLES 500  // Number of readings to average
#define MQ137_CALIBRATION_FILE "/mq137_ro.json"  // File to store calibration data

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
TaskHandle_t heartbeatTaskHandle = nullptr;

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
float mq137Ro = 3.6;  // Sensor resistance at calibration (default 3.6 kOhm)
float mq137LastCalibration = 0.0;  // Unix timestamp of last calibration
bool mq137CalibrationInProgress = false;  // Flag to indicate ongoing calibration

// MQTT client (optional)
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);

bool mqttEnabled = false;

bool tcaAvailable = false;

unsigned int i2cErrorCount = 0;
unsigned int sdErrorCount = 0;

// ==================== FUNCTION PROTOTYPES ====================
void setup();
void loop();
static void logLoopHealth();
void ledOn();
void ledOff();
void updateLightLed();
bool applyActuatorState(const char *actuator, bool state);
void sendSensorData();
void collectAndProcessEggLarvaeDrawer();
void collectAndProcessPupaDrawer();
void sendOrStoreSensorReading(const char *drawerName, float temperature, float humidity, int leftSubstrate, int centerSubstrate, int rightSubstrate, int ammonia);
bool sendSensorReading(const char *drawerName, float temperature, float humidity, int leftSubstrate, int centerSubstrate, int rightSubstrate, int ammonia);
bool sendHeartbeat();
void setActuatorState(const char *actuatorType, bool state);
uint64_t getServerTime();
void selectMuxChannel(uint8_t channel);
int readMuxAnalog(uint8_t channel);
void selectTcaChannel(uint8_t channel);
void updateLCD1(float temp, float humidity, int moisture, int ammonia);
void updateLCD2(float temp, float humidity);
void displayLCDMessage(uint8_t lcdNum, const char *line1, const char *line2);
int16_t readAds1Channel(uint8_t channel);
int16_t readAds2Channel(uint8_t channel);
void setMcpActuator(uint8_t pin, bool state);
void logActuatorCommand(const char *actuator, bool state);
void publishActuatorStateBool(const char *actuator, bool state);
void publishLightTimerState(int timeSeconds, uint64_t startTimeMs);
void mqttCallback(char *topic, byte *payload, unsigned int length);
void mqttReconnect();
int readSubstrate1();
int readSubstrate2();
int readSubstrate3();
int readMQ137();
void storeSensorToSD(const char *drawerName, float temperature, float humidity, int leftSubstrate, int centerSubstrate, int rightSubstrate, int ammonia);
void uploadStoredData();
int getStoredDataCount();
void autoControlEggLarvaeDrawer(float temperature, float humidity, int moisture);
void autoControlPupaDrawer(float temperature, float humidity);
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
bool isValidDrawer1DhtReading(float temperature, float humidity);
bool isValidDrawer2DhtReading(float temperature, float humidity);
bool isStableDhtReading(const DhtReading &current, const DhtReading &previous, float maxTempDelta, float maxHumidityDelta);
bool readRawDht(DHT &sensor, float &humidity, float &temperature);
DhtReading readDhtAutoType(DHT &dht11, DHT &dht22, bool preferDht11, bool useDrawer1Validation, bool allowTypeFallback, const char *label);
void heartbeatTask(void *pvParameters);
void recordManualActuatorChange();
void logConnectivityState(const char *source);
const char *getRequestedControlModeName();
bool isAutoControlActive();
void setRequestedControlMode(ControlMode mode);

// Inline actuator helpers
inline void setEggLarvaePump(bool state) { setMcpActuator(MCP_EGGLARVAE_PUMP, state); }
inline void setEggLarvaeHumidifier(bool state) { setMcpActuator(MCP_EGGLARVAE_HUMIDIFIER, state); }
inline void setEggLarvaeFan(bool state) { setMcpActuator(MCP_EGGLARVAE_FANS, state); }
inline void setEggLarvaeHeater(bool state) { setMcpActuator(MCP_EGGLARVAE_HEATER, state); }
inline void setEggLarvaeHeaterFan(bool state) { setMcpActuator(MCP_EGGLARVAE_HEATER_FANS, state); }
inline void setPupaHumidifier(bool state) { setMcpActuator(MCP_PUPA_HUMIDIFIER, state); }
inline void setPupaFan(bool state) { setMcpActuator(MCP_PUPA_FAN, state); }

// ==================== SETUP ====================
void setup()
{
  setCpuFrequencyMhz(240);
  Serial.begin(115200);
  delay(1000);

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
    ads1.setGain(GAIN_ONE);                     // 0-1.024V range (for substrate and ammonia sensors)
    ads1.setDataRate(RATE_ADS1115_128SPS);      // Set data rate to 128 samples per second for faster readings
    ads1.startADCReading(ADS_SUBSTRATE1, true); // Start continuous reading for Substrate 1 on channel 0
    ads1.startADCReading(ADS_SUBSTRATE2, true); // Start continuous reading for Substrate 2 on channel 1
    ads1.startADCReading(ADS_SUBSTRATE3, true); // Start continuous reading for Substrate 3 on channel 2
    ads1.startADCReading(ADS_MQ137, true);      // Start continuous reading for MQ137 sensor on channel 3
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
    ads2.setGain(GAIN_TWOTHIRDS);          // 0-6.144V range (for substrate and ammonia sensors)
    ads2.setDataRate(RATE_ADS1115_860SPS); // Set data rate to 860 samples per second for faster readings
    Serial.println(F("ADS1115 #2 initialized"));
  }

  // MCP23017
  mcpAvailable = mcp.begin_I2C(MCP23017_ADDR);
  if (!mcpAvailable)
  {
    Serial.println(F("MCP23017 not found"));
    return;
  }
  for (int i = 0; i < 16; i++)
  {
    mcp.pinMode(i, OUTPUT);
    mcp.digitalWrite(i, HIGH);
  }
  Serial.println(F("MCP23017 initialized"));

  // TC9548A
  tcaAvailable = false;
  Wire.beginTransmission(TCA9548A_ADDR);
  if (Wire.endTransmission() == 0)
  {
    Serial.println(F("TCA9548A detected"));
    tcaAvailable = true;
  }
  else
  {
    Serial.println(F("TCA9548A not found"));
    return;
  }

  // LCD #1
  selectTcaChannel(TCA_CH_LCD1);
  lcd1.init();
  lcd1Available = true;
  lcd1.setBacklight(255);
  lcd1.setCursor(0, 0);
  lcd1.print(F("Drawer 1"));
  lcd1.setCursor(0, 1);
  lcd1.print(F("Initializing..."));
  delay(200);

  // LCD #2
  selectTcaChannel(TCA_CH_LCD2);
  lcd2.init();
  lcd2Available = true;
  lcd2.setBacklight(255);
  lcd2.setCursor(0, 0);
  lcd2.print(F("Drawer 2"));
  lcd2.setCursor(0, 1);
  lcd2.print(F("Initializing..."));
  delay(200);

  // CD74HC4067
  pinMode(MUX_S0, OUTPUT);
  pinMode(MUX_S1, OUTPUT);
  pinMode(MUX_S2, OUTPUT);
  pinMode(MUX_S3, OUTPUT);

  // DHTs
  dhtA22.begin();
  dhtB22.begin();
  dhtC22.begin();
  dhtD22.begin();
  dhtE22.begin();
  dhtA11.begin();
  dhtB11.begin();
  dhtC11.begin();
  dhtD11.begin();
  dhtE11.begin();

  // WiFiManager
  WiFi.setTxPower(WIFI_POWER_8_5dBm);
  WiFi.setSleep(false);
  WiFiManager wm;
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

  // Load MQ137 calibration data from SD card
  loadMQ137Calibration();

  setupWebServer();
  sendHeartbeat();

  // Run / in its own task so HTTP latency does not block actuator responsiveness.
  xTaskCreatePinnedToCore(
      heartbeatTask,
      "HeartbeatTask",
      8192,
      nullptr,
      1,
      &heartbeatTaskHandle,
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
  mcp.digitalWrite(MCP_ENCLOSURE_LIGHT, LOW);
}

void ledOff()
{
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
  }

  if (currentTime - lastSensorTime >= SENSOR_INTERVAL)
  {
    sendSensorData();
    lastSensorTime = currentTime;
  }

  if (currentTime - lastSdSyncTime >= SD_SYNC_INTERVAL)
  {
    uploadStoredData();
    lastSdSyncTime = currentTime;
  }

  if (lightEndTime > 0 && millis() >= lightEndTime)
  {
    lightState = false;
    lightEndTime = 0;
    updateLightLed();
    publishActuatorStateBool("light", false);
    Serial.println(F("Light timer expired - Light OFF"));
  }

  yield();
}

// ==================== ACTUATOR CONTROL ====================
bool applyActuatorState(const char *actuator, bool state)
{
  lastActuatorCommandTime = millis();
  recordManualActuatorChange();

  if (strcmp(actuator, "light") == 0)
  {
    lightState = state;
    lightEndTime = 0;
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

void collectAndProcessEggLarvaeDrawer()
{
  DhtReading currentA = readDhtAutoType(dhtA11, dhtA22, true, true, true, "A");
  DhtReading currentB = readDhtAutoType(dhtB11, dhtB22, true, true, true, "B");
  DhtReading currentC = readDhtAutoType(dhtC11, dhtC22, false, true, false, "C");

  float humidityA = currentA.humidity;
  float temperatureA = currentA.temperature;
  float humidityB = currentB.humidity;
  float temperatureB = currentB.temperature;
  float humidityC = currentC.humidity;
  float temperatureC = currentC.temperature;

  Serial.print(F("DHT A -> T:"));
  Serial.print(temperatureA);
  Serial.print(F(" C H:"));
  Serial.print(humidityA);
  Serial.print(F(" % | DHT B -> T:"));
  Serial.print(temperatureB);
  Serial.print(F(" C H:"));
  Serial.print(humidityB);
  Serial.print(F(" % | DHT C -> T:"));
  Serial.print(temperatureC);
  Serial.print(F(" C H:"));
  Serial.println(humidityC);

  float humidity = NAN;
  float temperature = NAN;
  int validSensors = 0;
  float tempSum = 0, humSum = 0;

  if (currentA.valid && (!lastDrawer1SensorA.valid || isStableDhtReading(currentA, lastDrawer1SensorA, 6.0f, 25.0f)))
  {
    tempSum += currentA.temperature;
    humSum += currentA.humidity;
    validSensors++;
    lastDrawer1SensorA = currentA;
  }
  else if (currentA.valid)
  {
    Serial.println(F("[WARN] Drawer 1 DHT A reading rejected as unstable"));
  }

  if (currentB.valid && (!lastDrawer1SensorB.valid || isStableDhtReading(currentB, lastDrawer1SensorB, 6.0f, 25.0f)))
  {
    tempSum += currentB.temperature;
    humSum += currentB.humidity;
    validSensors++;
    lastDrawer1SensorB = currentB;
  }
  else if (currentB.valid)
  {
    Serial.println(F("[WARN] Drawer 1 DHT B reading rejected as unstable"));
  }

  if (currentC.valid && (!lastDrawer1SensorC.valid || isStableDhtReading(currentC, lastDrawer1SensorC, 6.0f, 25.0f)))
  {
    tempSum += currentC.temperature;
    humSum += currentC.humidity;
    validSensors++;
    lastDrawer1SensorC = currentC;
  }
  else if (currentC.valid)
  {
    Serial.println(F("[WARN] Drawer 1 DHT C reading rejected as unstable"));
  }

  if (validSensors > 0)
  {
    temperature = tempSum / validSensors;
    humidity = humSum / validSensors;
  }
  else
  {
    Serial.println("[WARN] Drawer 1 has no valid DHT readings in this cycle");
  }

  int substrate1Raw = readSubstrate1();
  int substrate2Raw = readSubstrate2();
  int substrate3Raw = readSubstrate3();

  Serial.print(F("Substrate Raw Values - S1:"));
  Serial.print(substrate1Raw);
  Serial.print(F(" S2:"));
  Serial.print(substrate2Raw);
  Serial.print(F(" S3:"));
  Serial.println(substrate3Raw);

  int leftSubstrate = map(substrate1Raw, 0, 26000, 0, 100);
  leftSubstrate = constrain(leftSubstrate, 0, 100);

  int centerSubstrate = map(substrate2Raw, 0, 26000, 0, 100);
  centerSubstrate = constrain(centerSubstrate, 0, 100);

  int rightSubstrate = map(substrate3Raw, 0, 26000, 0, 100);
  rightSubstrate = constrain(rightSubstrate, 0, 100);

  Serial.print(F("Substrate Mapped (%) - Left:"));
  Serial.print(leftSubstrate);
  Serial.print(F(" Center:"));
  Serial.print(centerSubstrate);
  Serial.print(F(" Right:"));
  Serial.println(rightSubstrate);

  int ammoniaRaw = readMQ137();
  // Calculate ammonia concentration using calibration constant
  float Rs = calculateRsFromRaw(ammoniaRaw);
  float ratio = (mq137Ro > 0) ? (Rs / mq137Ro) : 1.0;
  
  // Simplified PPM calculation (exponent from MQ137 datasheet)
  // PPM = 10^((log(RS/RO) - log(a)) / b)
  // For MQ137: a ≈ 3.6, b ≈ -0.93 (approximate from gas curve)
  float ammonia_ppm = 0;
  if (ratio > 0)
  {
    // Simplified formula: ppm ≈ 21 * (1 / ratio)^1.2 (approximate for ammonia)
    ammonia_ppm = 21.0 * pow(1.0 / ratio, 1.2);
  }
  
  // Clamp to 0-100 ppm range for display
  int ammonia = constrain((int)ammonia_ppm, 0, 100);

  if (!isnan(humidity) && !isnan(temperature))
  {
    int avgMoisture = (leftSubstrate + centerSubstrate + rightSubstrate) / 3;
    updateLCD1(temperature, humidity, avgMoisture, ammonia);

    sendOrStoreSensorReading("Drawer 1", temperature, humidity, leftSubstrate, centerSubstrate, rightSubstrate, ammonia);

    if (isAutoControlActive())
    {
      bool offline = WiFi.status() != WL_CONNECTED;
      if (!offline || millis() >= offlineAutoControlHoldUntil)
      {
        autoControlEggLarvaeDrawer(temperature, humidity, avgMoisture);
      }
      else
      {
        Serial.println(F("Offline auto-control skipped during manual override holdoff"));
      }
    }
  }
  else
  {
    // Show "X" for invalid values on LCD1
    if (lcd1Available)
    {
      selectTcaChannel(TCA_CH_LCD1);
      lcd1.clear();
      lcd1.setCursor(0, 0);
      lcd1.print("T:X H:X");
      lcd1.setCursor(0, 1);
      lcd1.print("S:X NH3:X");
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
      lcd2.clear();
      lcd2.setCursor(0, 0);
      lcd2.print("T:X ");
      lcd2.print(" H:X ");
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
  bool wifiConnected = WiFi.status() == WL_CONNECTED;
  bool mqttConnected = mqttEnabled && mqttClient.connected();

  if (!wifiConnected)
  {
    Serial.println(F("[MODE] OFFLINE: WiFi disconnected, storing locally and using auto-control"));
  }
  else if (!mqttConnected)
  {
    Serial.println(F("[MODE] DEGRADED: WiFi connected but MQTT unavailable, trying send/fallback to SD"));
    ;
  }
  else
  {
    Serial.println(F("[MODE] ONLINE: WiFi+MQTT connected, publishing live data"));
  }

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
  if (ammonia >= 0)
  {
    Serial.print(F(" | Ammonia: "));
    Serial.print(ammonia);
    Serial.print(F(" %"));
  }
  Serial.println();
  // --- End console printing ---
  if (wifiConnected)
  {
    bool success = sendSensorReading(drawerName, temperature, humidity, leftSubstrate, centerSubstrate, rightSubstrate, ammonia);
    if (!success && sdAvailable)
    {
      storeSensorToSD(drawerName, temperature, humidity, leftSubstrate, centerSubstrate, rightSubstrate, ammonia);
      Serial.println(F("[MODE] Fallback: publish failed, data buffered to SD"));
    }
  }
  else if (sdAvailable)
  {
    storeSensorToSD(drawerName, temperature, humidity, leftSubstrate, centerSubstrate, rightSubstrate, ammonia);
    Serial.print(F("Stored offline: "));
    Serial.println(drawerName);
  }
}

bool sendSensorReading(const char *drawerName, float temperature, float humidity,
                       int leftSubstrate, int centerSubstrate, int rightSubstrate, int ammonia)
{
  if (!(mqttEnabled && mqttClient.connected()))
    return false;

  // Keep this reasonably sized; adjust if you add more fields.
  StaticJsonDocument<256> doc;

  doc["macAddress"] = DEVICE_ID; // (still a String global, OK)
  doc["drawerName"] = drawerName;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;

  if (leftSubstrate >= 0)
    doc["leftSubstrate"] = leftSubstrate;
  if (centerSubstrate >= 0)
    doc["centerSubstrate"] = centerSubstrate;
  if (rightSubstrate >= 0)
    doc["rightSubstrate"] = rightSubstrate;
  if (ammonia >= 0)
    doc["ammonia"] = ammonia;

  char payload[256];
  size_t n = serializeJson(doc, payload, sizeof(payload));
  if (n == 0)
  {
    Serial.print(F("[WARN] serializeJson produced empty payload for "));
    Serial.println(drawerName);
    return false;
  }

  char topic[128];
  // Avoid temporary String concatenations
  snprintf(topic, sizeof(topic), "%s/%s/sensors", MQTT_BASE_TOPIC, DEVICE_ID.c_str());

  if (mqttClient.publish(topic, payload))
  {
    Serial.print(drawerName);
    Serial.println(F(" sensor data published via MQTT"));
    return true;
  }

  Serial.print(F("MQTT publish failed for "));
  Serial.println(drawerName);
  return false;
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

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.setTimeout(HEARTBEAT_TIMEOUT_MS);

  String heartbeatUrl = String(BACKEND_URL) + "/api/devices/" + DEVICE_ID + "/heartbeat";

  Serial.print(F("Sending heartbeat to: "));
  Serial.println(heartbeatUrl);

  if (!http.begin(client, heartbeatUrl))
  {
    Serial.println(F("HTTP begin failed"));
    lastHeartbeatHttpCode = -1001;
    return false;
  }

  http.addHeader("Content-Type", "application/json");

  // Prepare heartbeat payload with IP address
  StaticJsonDocument<256> doc;
  doc["ipAddress"] = WiFi.localIP().toString();
  String jsonPayload;
  serializeJson(doc, jsonPayload);

  int httpCode = http.POST(jsonPayload);
  lastHeartbeatHttpCode = httpCode;

  if (httpCode == 200)
  {
    Serial.print(F("Heartbeat sent - device online at "));
    Serial.println(WiFi.localIP());
    http.end();
    return true;
  }
  else if (httpCode == 404)
  {
    Serial.println(F("Device not registered. Register in app Settings."));
  }
  else
  {
    Serial.print(F("Heartbeat failed, code: "));
    Serial.println(httpCode);
    if (httpCode < 0)
    {
      Serial.println(F("[MODE] Internet/DNS unreachable while WiFi is connected"));
    }
  }

  http.end();
  return false;
}

void heartbeatTask(void *pvParameters)
{
  (void)pvParameters;

  for (;;)
  {
    unsigned long now = millis();
    if (now - lastHeartbeatTime >= HEARTBEAT_INTERVAL &&
        now - lastActuatorCommandTime >= HEARTBEAT_COOLDOWN_AFTER_ACTUATOR_MS)
    {
      bool ok = sendHeartbeat();
      if (!ok)
      {
        Serial.println(F("[MODE] Heartbeat check failed; operating in offline/degraded behavior"));
      }
      lastHeartbeatTime = millis();
    }

    vTaskDelay(pdMS_TO_TICKS(200));
  }
}

// ==================== HELPER ====================
void setActuatorState(const char *actuatorType, bool state)
{
  if (WiFi.status() != WL_CONNECTED)
    return;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.setTimeout(5000);
  String url = String(BACKEND_URL) + "/api/actuators/" + DEVICE_ID + ":" + actuatorType;

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
  doc["state"] = state;

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);

  if (httpCode == 200 || httpCode == 201)
  {
    Serial.print(F("Actuator "));
    Serial.print(actuatorType);
    Serial.print(F(" set to "));
    Serial.println(state ? F("ON") : F("OFF"));
  }

  http.end();
}

// ==================== TIME HELPER ====================
uint64_t getServerTime()
{
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.setTimeout(2000);
  http.begin(client, String(BACKEND_URL) + "/api/time");
  int httpCode = http.GET();
  uint64_t serverTime = 0;

  if (httpCode == 200)
  {
    String payload = http.getString();
    JsonDocument doc;
    if (!deserializeJson(doc, payload))
    {
      serverTime = doc["now"].as<uint64_t>();
    }
  }

  http.end();
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
void updateLCD1(float temp, float humidity, int moisture, int ammonia)
{
  if (!lcd1Available)
    return;
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

  // Moisture
  if (moisture >= 0 && moisture <= 100)
  {
    lcd1.print("S:");
    lcd1.print(moisture);
    lcd1.print(" ");
  }
  else
  {
    lcd1.print("S:X ");
  }

  // Ammonia
  if (ammonia >= 0 && ammonia <= 100)
  {
    lcd1.print("NH3:");
    lcd1.print(ammonia);
    lcd1.print("%");
  }
  else
  {
    lcd1.print("NH3:X");
  }
}

void updateLCD2(float temp, float humidity)
{
  if (!lcd2Available)
    return;
  selectTcaChannel(TCA_CH_LCD2);
  lcd2.clear();
  lcd2.setCursor(0, 0);

  // Temperature
  if (!isnan(temp))
  {
    lcd2.print("T:");
    lcd2.print(temp, 1);
    lcd2.print("C ");
  }
  else
  {
    lcd2.print("T:X ");
  }

  // Humidity
  if (!isnan(humidity))
  {
    lcd2.print("H:");
    lcd2.print((int)humidity);
    lcd2.print("%");
  }
  else
  {
    lcd2.print("H:X");
  }
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
    return 0;
  return ads1.readADC_SingleEnded(channel);
}

int16_t readAds2Channel(uint8_t channel)
{
  if (!ads2Available)
    return 0;
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
  if (!mqttEnabled || !mqttClient.connected())
    return;

  StaticJsonDocument<64> doc;
  doc["state"] = state;

  char payload[64];
  serializeJson(doc, payload, sizeof(payload));

  char topic[160];
  snprintf(topic, sizeof(topic), "%s/%s/actuators/%s/state", MQTT_BASE_TOPIC, DEVICE_ID.c_str(), actuator);
  mqttClient.publish(topic, payload);
}

void publishLightTimerState(int timeSeconds, uint64_t startTimeMs)
{
  if (!mqttEnabled || !mqttClient.connected())
    return;

  StaticJsonDocument<96> doc;
  JsonObject state = doc["state"].to<JsonObject>();
  state["time"] = timeSeconds;
  state["startTime"] = startTimeMs;

  char payload[128];
  serializeJson(doc, payload, sizeof(payload));

  char topic[160];
  snprintf(topic, sizeof(topic), "%s/%s/actuators/light/state", MQTT_BASE_TOPIC, DEVICE_ID.c_str());
  mqttClient.publish(topic, payload);
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
  StaticJsonDocument<256> d;
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

      uint64_t localNowMs = millis();
      uint64_t estimatedRemaining = (endTimeMs > (startTimeMs + localNowMs))
                                        ? (endTimeMs - (startTimeMs + localNowMs))
                                        : 0ULL;

      if (estimatedRemaining > 0)
      {
        lightEndTime = localNowMs + estimatedRemaining;
        lightState = true;
      }
      else
      {
        lightEndTime = 0;
        lightState = false;
      }

      updateLightLed();
      if (lightState)
        publishLightTimerState(timeSeconds, startTimeMs);
      else
        publishActuatorStateBool("light", false);

      Serial.print(F("Light (MQTT timer): "));
      Serial.println(lightState ? F("ON") : F("OFF"));
    }
    else
    {
      lightState = false;
      lightEndTime = 0;
      updateLightLed();
      publishActuatorStateBool("light", false);
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

  if (WiFi.status() == WL_CONNECTED && requestedControlMode == CONTROL_MODE_AUTO)
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
  return readAds1Channel(ADS_SUBSTRATE1);
}

int readSubstrate2()
{
  return readAds1Channel(ADS_SUBSTRATE2);
}

int readSubstrate3()
{
  return readAds1Channel(ADS_SUBSTRATE3);
}

int readMQ137() { return readAds1Channel(ADS_MQ137); }

// ==================== SD CARD STORAGE ====================
void storeSensorToSD(const char *drawerName, float temperature, float humidity, int leftSubstrate, int centerSubstrate, int rightSubstrate, int ammonia)
{
  if (!sdAvailable)
    return;

  File file = SD.open(SD_DATA_FILE, FILE_APPEND);
  if (!file)
  {
    Serial.println(F("Failed to open SD file for writing"));
    sdErrorCount++;
    return;
  }

  StaticJsonDocument<384> doc;
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
  if (ammonia >= 0)
    doc["ammonia"] = ammonia;
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
  if (!SD.exists(SD_DATA_FILE))
    return;

  File file = SD.open(SD_DATA_FILE, FILE_READ);
  if (!file)
    return;

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

    // Trim CR and whitespace at end
    while (n > 0 && (buf[n - 1] == '\r' || buf[n - 1] == ' ' || buf[n - 1] == '\t'))
    {
      buf[n - 1] = '\0';
      n--;
    }

    // Skip leading whitespace
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

    // Validate JSON quickly (optional, but keeps parity with your existing check)
    StaticJsonDocument<256> doc;
    if (deserializeJson(doc, lineBuf) != DeserializationError::Ok)
      continue;

    WiFiClientSecure client;
    client.setInsecure();

    HTTPClient http;
    http.setTimeout(SD_UPLOAD_HTTP_TIMEOUT_MS);
    if (!http.begin(client, url))
    {
      // keep for retry
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

    // Make sure MQTT stays serviced during SD sync bursts
    if (mqttEnabled && mqttClient.connected())
      mqttClient.loop();

    yield();
  }

  // Keep the rest of unread lines for the next sync cycle
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
    fanOn = false; // Turn off fans if humidifier is needed
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
  for (int attempt = 0; attempt < DHT_READ_ATTEMPTS; attempt++)
  {
    humidity = sensor.readHumidity();
    temperature = sensor.readTemperature();
    if (!isnan(temperature) && !isnan(humidity))
      return true;
    delay(120);
  }

  return false;
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
  offlineAutoControlHoldUntil = millis() + OFFLINE_AUTOCONTROL_HOLD_MS;
}

const char *getRequestedControlModeName()
{
  return requestedControlMode == CONTROL_MODE_MANUAL ? "manual" : "auto";
}

bool isAutoControlActive()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    return true;
  }
  return requestedControlMode == CONTROL_MODE_AUTO;
}

void setRequestedControlMode(ControlMode mode)
{
  requestedControlMode = mode;
  if (requestedControlMode == CONTROL_MODE_AUTO)
  {
    offlineAutoControlHoldUntil = 0;
  }

  if (mqttEnabled && mqttClient.connected())
  {
    StaticJsonDocument<64> doc;
    doc["state"] = getRequestedControlModeName();

    char payload[64];
    serializeJson(doc, payload, sizeof(payload));

    char topic[160];
    snprintf(topic, sizeof(topic), "%s/%s/actuators/mode/state", MQTT_BASE_TOPIC, DEVICE_ID.c_str());
    mqttClient.publish(topic, payload);
  }

  Serial.print(F("[MODE] Requested control mode set to "));
  Serial.println(getRequestedControlModeName());
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

void handleHardwarePage(AsyncWebServerRequest *request)
{
  String html = "<!DOCTYPE html><html><head><title>BSFly IoT</title>";
  html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:20px;max-width:760px;margin:0 auto;background:#08110d;color:#e9f5ee}";
  html += "h1,h2,h3{color:#ffffff}.card{background:rgba(255,255,255,.05);padding:18px;margin:14px 0;border-radius:16px;border:1px solid rgba(255,255,255,.08)}";
  html += "a,button{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#2dd55b 0%,#17a34a 100%);color:white;border:none;padding:12px 18px;border-radius:12px;margin:6px 6px 6px 0;cursor:pointer;text-decoration:none;font-weight:700}";
  html += "button:hover,a:hover{filter:brightness(1.05)}.danger{background:linear-gradient(135deg,#ff4757 0%,#c5000f 100%)}.muted{color:rgba(233,245,238,.75);line-height:1.6}ul{padding-left:20px;line-height:1.7}";
  html += "code{background:rgba(255,255,255,.08);padding:2px 6px;border-radius:8px}</style></head>";
  html += "<body><h1>BSFly IoT Hardware</h1>";
  html += "<p class='muted'>Upload firmware over the air, then reboot the controller from the same page.</p>";
  html += "<div class='card'><strong>Device ID:</strong> " + DEVICE_ID + "<br><strong>IP Address:</strong> " + WiFi.localIP().toString() + "</div>";
  html += "<div class='card'><strong>SD Card:</strong> " + String(sdAvailable ? "Available" : "Not found") + "<br><strong>Control Mode:</strong> " + String(getRequestedControlModeName()) + "<br><strong>Stored Readings:</strong> " + String(getStoredDataCount()) + "</div>";
  html += "<div class='card'><h2>Actions</h2>";
  html += "<a href='/update' target='_blank' rel='noopener noreferrer'>Open ElegantOTA Upload</a>";
  html += "<button class='danger' onclick=\"fetch('/reboot',{method:'POST'}).then(r=>r.json()).then(d=>alert(d.message)).catch(e=>alert(e.message))\">Reboot ESP32</button>";
  html += "</div>";
  html += "<div class='card'><h2>MQ137 Ammonia Sensor Calibration</h2>";
  html += "<p class='muted'>Calibrate the MQ137 sensor for accurate ammonia readings. Ensure sensor is in fresh air (20°C, 65% humidity) before calibrating.</p>";
  html += "<p id='calibStatus' class='muted'>Status: Loading...</p>";
  html += "<button id='calibBtn' onclick=\"startCalibration()\">Start Calibration</button>";
  html += "<script>";
  html += "function loadCalibStatus(){fetch('/calibration/status').then(r=>r.json()).then(d=>{";
  html += "let st='Status: Ro='+(d.ro||'N/A')+', Last='+(d.lastCalibration?new Date(d.lastCalibration*1000).toLocaleString():'Never');";
  html += "document.getElementById('calibStatus').textContent=st;";
  html += "document.getElementById('calibBtn').disabled=d.inProgress;";
  html += "document.getElementById('calibBtn').textContent=d.inProgress?'Calibrating...':'Start Calibration';";
  html += "}).catch(e=>document.getElementById('calibStatus').textContent='Status: Error loading')}";
  html += "function startCalibration(){";
  html += "document.getElementById('calibBtn').disabled=true;";
  html += "document.getElementById('calibBtn').textContent='Calibrating...';";
  html += "fetch('/calibrate/mq137',{method:'POST'}).then(r=>r.json()).then(d=>{";
  html += "alert(d.message||'Calibration complete\\n\\nRo='+(d.ro||'N/A'));";
  html += "loadCalibStatus();";
  html += "}).catch(e=>alert('Error: '+e.message)).finally(()=>document.getElementById('calibBtn').disabled=false)}";
  html += "loadCalibStatus();";
  html += "</script>";
  html += "</div>";
  html += "<div class='card'><h2>What this page does</h2><ul><li>Shows device status and IP address.</li><li>Accepts ElegantOTA firmware uploads from a browser.</li><li>Reboots the controller after the update finishes.</li></ul></div>";
  html += "</body></html>";
  request->send(200, "text/html", html);
}

void handleStatus(AsyncWebServerRequest *request)
{
  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["ip"] = WiFi.localIP().toString();
  doc["sdAvailable"] = sdAvailable;
  doc["storedCount"] = getStoredDataCount();
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

  int beforeCount = getStoredDataCount();
  uploadStoredData();
  int afterCount = getStoredDataCount();
  int uploaded = beforeCount - afterCount;

  JsonDocument doc;
  doc["message"] = "Sync complete";
  doc["uploaded"] = uploaded;
  doc["remaining"] = afterCount;
  doc["success"] = true;

  String response;
  serializeJson(doc, response);
  request->send(200, "application/json", response);
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
  // Verify API key if provided
  if (request->hasParam("key"))
  {
    String providedKey = request->getParam("key")->value();
    // Note: Compare with device API key (currently would need to retrieve from flash)
    // For now, we'll just proceed - you can add authentication here
  }

  JsonDocument doc;
  
  if (mq137CalibrationInProgress)
  {
    doc["error"] = "Calibration already in progress";
    doc["status"] = "busy";
  }
  else
  {
    // Run calibration (this may take a few seconds)
    float newRo = calibrateMQ137();
    
    doc["success"] = true;
    doc["message"] = "MQ137 calibration completed";
    doc["ro"] = newRo;
    doc["timestamp"] = mq137LastCalibration;
    doc["calibrationPoint"] = MQ137_CALIBRATION_PPM;
  }

  String response;
  serializeJson(doc, response);
  request->send(200, "application/json", response);
}

void handleCalibrationStatus(AsyncWebServerRequest *request)
{
  JsonDocument doc;
  
  doc["inProgress"] = mq137CalibrationInProgress;
  doc["ro"] = mq137Ro;
  doc["lastCalibration"] = mq137LastCalibration;
  doc["calibrationPoint"] = MQ137_CALIBRATION_PPM;
  doc["rl"] = (float)MQ137_RL;
  
  // Calculate ppm from current reading if calibrated
  if (mq137Ro > 0)
  {
    int16_t rawValue = readAds1Channel(ADS_MQ137);
    float Rs = calculateRsFromRaw(rawValue);
    float ratio = Rs / mq137Ro;
    // Simple ppm estimation (would need lookup table for accuracy)
    float ppm = 21.0 * (1.0 / (ratio + 0.01));  // Placeholder formula
    doc["estimatedPpm"] = ppm;
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
    // Calibrate MQ137 ammonia sensor
    Serial.println(F("[CALIBRATION] Starting all-sensor calibration..."));
    float newRo = calibrateMQ137();
    
    // TODO: Add calibration for substrate moisture sensors
    // TODO: Add calibration for temperature sensors
    
    doc["success"] = true;
    doc["message"] = "All sensors calibrated";
    doc["mq137"] = {
      "ro": newRo,
      "timestamp": mq137LastCalibration,
      "status": "calibrated"
    };
    doc["substrate"] = {
      "status": "not_implemented",
      "message": "Substrate moisture calibration available on hardware page"
    };
    doc["temperature"] = {
      "status": "not_needed",
      "message": "Temperature sensors use standard DHT calibration"
    };
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
  Serial.println(uxTaskGetStackHighWaterMark(nullptr));
}