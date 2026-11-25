#include "State.h"

portMUX_TYPE gStateMux = portMUX_INITIALIZER_UNLOCKED;

String DEVICE_ID;
String DEVICE_ID_CLEAN;

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

AsyncWebServer server(80);

WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);
QueueHandle_t gMqttPublishQueue = nullptr;
volatile uint32_t gMqttQueueDropCount = 0;
bool mqttEnabled = false;

bool ads1Available = false;
bool ads2Available = false;
bool mcpAvailable = false;
bool sdAvailable = false;
bool lcd1Available = false;
bool lcd2Available = false;
bool tcaAvailable = false;
unsigned int i2cErrorCount = 0;
unsigned int sdErrorCount = 0;

unsigned long lastSensorTime = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastSdSyncTime = 0;
unsigned long lastActuatorCommandTime = 0;
unsigned long lastMqttReconnectAttempt = 0;
unsigned long lastModeDebugTime = 0;
int lastHeartbeatHttpCode = 0;
bool lastWifiConnected = false;
bool lastMqttConnected = false;

bool lightState = false;
unsigned long lightEndTime = 0;
unsigned long offlineAutoControlHoldUntil = 0;
ControlMode requestedControlMode = CONTROL_MODE_AUTO;

DhtReading lastDrawer1SensorA = {NAN, NAN, false, 0};
DhtReading lastDrawer1SensorB = {NAN, NAN, false, 0};
DhtReading lastDrawer1SensorC = {NAN, NAN, false, 0};
DhtReading lastDrawer2SensorD = {NAN, NAN, false, 0};
DhtReading lastDrawer2SensorE = {NAN, NAN, false, 0};

SemaphoreHandle_t gTlsMutex = nullptr;
WiFiClientSecure gHttpsClient;
unsigned long gTlsFailCooldownUntilMs = 0;
SemaphoreHandle_t gDhtMutex = nullptr;

TaskHandle_t heartbeatTaskHandle = nullptr;
TaskHandle_t sensorTaskHandle = nullptr;
TaskHandle_t mq137CalTaskHandle = nullptr;
volatile bool sdUploadKick = false;
volatile int gSdStoredCountCached = -1;

float mq137Ro = 0.0f;
float mq137LastCalibration = 0.0f;
bool mq137CalibrationInProgress = false;
volatile uint16_t mq137CalProgress = 0;
volatile uint16_t mq137CalValidSamples = 0;
volatile float mq137CalLastRsAvg = NAN;

int gMoistureRawDry = 28000;
int gMoistureRawWet = 12000;
