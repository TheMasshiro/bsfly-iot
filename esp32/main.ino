#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>
#include <Adafruit_MCP23X17.h>
#include <Adafruit_SSD1306.h>
#include <SD.h>
#include <SPI.h>

// ==================== CONFIGURATION ====================
const char* BACKEND_URL = "https://backend-bsfly.vercel.app";

String DEVICE_ID;
String DEVICE_ID_CLEAN;

// ==================== I2C BUS ====================
#define I2C_SDA 21
#define I2C_SCL 22

// ==================== SPI BUS (microSD) ====================
#define SPI_SCK 18
#define SPI_MISO 19
#define SPI_MOSI 23
#define SPI_CS_SD 5

// ==================== CD74HC4067 ANALOG MUX ====================
#define MUX_SIG 35
#define MUX_S0 16
#define MUX_S1 17
#define MUX_S2 25
#define MUX_S3 26

// ==================== DHT22 SENSORS ====================
#define DHT_A_PIN 27
#define DHT_B_PIN 13
#define DHT_C_PIN 33
#define DHT_TYPE DHT22

// ==================== I2C DEVICE ADDRESSES ====================
#define ADS1115_ADDR_1 0x48
#define ADS1115_ADDR_2 0x49
#define MCP23017_ADDR 0x20
#define TCA9548A_ADDR 0x70

// ==================== TCA9548A CHANNELS ====================
#define TCA_CH_OLED1 0
#define TCA_CH_OLED2 1

// ==================== MCP23017 PINS ====================
#define MCP_HUMIDIFIER1 0
#define MCP_HUMIDIFIER2 1
#define MCP_HEATER 2
#define MCP_FAN1 3
#define MCP_FAN2 4
#define MCP_FAN3 5
#define MCP_FAN4 6
#define MCP_HUMIDIFIER3 8
#define MCP_FAN5 9

// ==================== ADS1115 CHANNELS ====================
#define ADS_SOIL1 0
#define ADS_SOIL2 1
#define ADS_SOIL3 2
#define ADS_MQ137 3

// ==================== CD74HC4067 CHANNELS ====================
#define MUX_CH_SOIL1 0
#define MUX_CH_SOIL2 1
#define MUX_CH_SOIL3 2

// ==================== TIMING ====================
#define POLL_INTERVAL 2000
#define SENSOR_INTERVAL 35000
#define HEARTBEAT_INTERVAL 30000
#define SD_SYNC_INTERVAL 60000
#define SD_DATA_FILE "/sensor_data.json"

// ==================== OFFLINE THRESHOLDS ====================
#define TEMP_MIN 25.0
#define TEMP_MAX 35.0
#define TEMP_OPTIMAL_LOW 28.0
#define TEMP_OPTIMAL_HIGH 32.0

#define HUMIDITY_MIN 50.0
#define HUMIDITY_MAX 80.0
#define HUMIDITY_OPTIMAL_LOW 60.0
#define HUMIDITY_OPTIMAL_HIGH 70.0

#define MOISTURE_MIN 40
#define MOISTURE_MAX 70
#define MOISTURE_OPTIMAL_LOW 50
#define MOISTURE_OPTIMAL_HIGH 60

// ==================== GLOBALS ====================
DHT dhtA(DHT_A_PIN, DHT_TYPE);
DHT dhtB(DHT_B_PIN, DHT_TYPE);
DHT dhtC(DHT_C_PIN, DHT_TYPE);

Adafruit_ADS1115 ads1;
Adafruit_ADS1115 ads2;
Adafruit_MCP23X17 mcp;

bool ads1Available = false;
bool ads2Available = false;
bool mcpAvailable = false;
bool sdAvailable = false;

unsigned long lastPollTime = 0;
unsigned long lastSensorTime = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastSdSyncTime = 0;

bool lightState = false;

WebServer server(80);

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);

  Wire.begin(I2C_SDA, I2C_SCL);

  SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, SPI_CS_SD);
  sdAvailable = SD.begin(SPI_CS_SD);
  if (sdAvailable) {
    Serial.println("SD card initialized");
  } else {
    Serial.println("SD card not found");
  }

  pinMode(MUX_S0, OUTPUT);
  pinMode(MUX_S1, OUTPUT);
  pinMode(MUX_S2, OUTPUT);
  pinMode(MUX_S3, OUTPUT);

  dhtA.begin();
  dhtB.begin();
  dhtC.begin();

  ads1Available = ads1.begin(ADS1115_ADDR_1);
  if (!ads1Available) {
    Serial.println("ADS1115 #1 not found");
  }

  ads2Available = ads2.begin(ADS1115_ADDR_2);
  if (!ads2Available) {
    Serial.println("ADS1115 #2 not found");
  }

  mcpAvailable = mcp.begin_I2C(MCP23017_ADDR);
  if (mcpAvailable) {
    for (int i = 0; i < 16; i++) {
      mcp.pinMode(i, OUTPUT);
      mcp.digitalWrite(i, LOW);
    }
  } else {
    Serial.println("MCP23017 not found");
  }

  WiFiManager wm;
  wm.setConfigPortalTimeout(180);

  bool res = wm.autoConnect("Connect2Wifi", "esp32bsf");

  if (!res) {
    Serial.println("Failed to connect to WiFi");
    delay(2000);
    ESP.restart();
  } else {
    Serial.print("Connected! IP: ");
    Serial.println(WiFi.localIP());

    DEVICE_ID = WiFi.macAddress();
    DEVICE_ID_CLEAN = DEVICE_ID;
    DEVICE_ID_CLEAN.replace(":", "");

    Serial.print("Device ID: ");
    Serial.println(DEVICE_ID);
    Serial.print("Device ID (clean): ");
    Serial.println(DEVICE_ID_CLEAN);
  }

  setupWebServer();
  sendHeartbeat();
}

// ==================== MAIN LOOP ====================
void loop() {
  unsigned long currentTime = millis();

  server.handleClient();

  if (currentTime - lastPollTime >= POLL_INTERVAL) {
    pollActuators();
    lastPollTime = currentTime;
  }

  if (currentTime - lastSensorTime >= SENSOR_INTERVAL) {
    sendSensorData();
    lastSensorTime = currentTime;
  }

  if (currentTime - lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeatTime = currentTime;
  }

  if (currentTime - lastSdSyncTime >= SD_SYNC_INTERVAL) {
    uploadStoredData();
    lastSdSyncTime = currentTime;
  }

  delay(100);
}

// ==================== ACTUATOR POLLING ====================
void pollActuators() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, skipping poll");
    return;
  }

  HTTPClient http;
  http.setTimeout(5000);

  String lightUrl = String(BACKEND_URL) + "/api/actuators/" + DEVICE_ID + ":light";

  http.begin(lightUrl);
  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();

    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error && doc.containsKey("state")) {
      if (doc["state"].is<bool>()) {
        bool newState = doc["state"].as<bool>();
        if (newState != lightState) {
          lightState = newState;
          Serial.print("Light: ");
          Serial.println(lightState ? "ON" : "OFF");
        }
      } else if (doc["state"].is<JsonObject>()) {
        int timeSeconds = doc["state"]["time"].as<int>();
        unsigned long startTimeMs = doc["state"]["startTime"].as<unsigned long>();
        
        bool newState = false;
        if (timeSeconds > 0 && startTimeMs > 0) {
          unsigned long serverNow = getServerTime();
          if (serverNow > 0) {
            unsigned long endTime = startTimeMs + ((unsigned long)timeSeconds * 1000UL);
            newState = serverNow < endTime;
          }
        }
        
        if (newState != lightState) {
          lightState = newState;
          Serial.print("Light (timer): ");
          Serial.println(lightState ? "ON" : "OFF");
        }
      }
    }
  } else if (httpCode != 404) {
    Serial.print("Poll failed, code: ");
    Serial.println(httpCode);
  }

  http.end();

  pollActuator("humidifier1");
  pollActuator("humidifier2");
  pollActuator("humidifier3");
  pollActuator("heater");
  pollActuator("fan1");
  pollActuator("fan2");
  pollActuator("fan3");
  pollActuator("fan4");
  pollActuator("fan5");
}

void pollActuator(const char* actuator) {
  HTTPClient http;
  http.setTimeout(5000);

  String url = String(BACKEND_URL) + "/api/actuators/" + DEVICE_ID + ":" + actuator;

  http.begin(url);
  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();

    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error && doc.containsKey("state")) {
      bool state = doc["state"].as<bool>();
      applyActuatorState(actuator, state);
      Serial.print(actuator);
      Serial.print(" = ");
      Serial.println(state ? "ON" : "OFF");
    }
  }

  http.end();
}

void applyActuatorState(const char* actuator, bool state) {
  if (strcmp(actuator, "humidifier1") == 0) setHumidifier1(state);
  else if (strcmp(actuator, "humidifier2") == 0) setHumidifier2(state);
  else if (strcmp(actuator, "humidifier3") == 0) setHumidifier3(state);
  else if (strcmp(actuator, "heater") == 0) setHeater(state);
  else if (strcmp(actuator, "fan1") == 0) setFan1(state);
  else if (strcmp(actuator, "fan2") == 0) setFan2(state);
  else if (strcmp(actuator, "fan3") == 0) setFan3(state);
  else if (strcmp(actuator, "fan4") == 0) setFan4(state);
  else if (strcmp(actuator, "fan5") == 0) setFan5(state);
}

// ==================== SENSOR DATA ====================
void sendSensorData() {
  collectAndProcessDrawer12();
  collectAndProcessDrawer3();
}

void collectAndProcessDrawer12() {
  float humidityA = dhtA.readHumidity();
  float temperatureA = dhtA.readTemperature();
  float humidityB = dhtB.readHumidity();
  float temperatureB = dhtB.readTemperature();

  float humidity = NAN;
  float temperature = NAN;

  if (!isnan(humidityA) && !isnan(humidityB)) {
    humidity = (humidityA + humidityB) / 2.0;
  } else if (!isnan(humidityA)) {
    humidity = humidityA;
  } else if (!isnan(humidityB)) {
    humidity = humidityB;
  }

  if (!isnan(temperatureA) && !isnan(temperatureB)) {
    temperature = (temperatureA + temperatureB) / 2.0;
  } else if (!isnan(temperatureA)) {
    temperature = temperatureA;
  } else if (!isnan(temperatureB)) {
    temperature = temperatureB;
  }

  int soil1Raw = readSoil1();
  int soil2Raw = readSoil2();
  int soil3Raw = readSoil3();
  int moisture = (soil1Raw + soil2Raw + soil3Raw) / 3;
  moisture = map(moisture, 0, 26000, 0, 100);
  moisture = constrain(moisture, 0, 100);

  int ammoniaRaw = readMQ137();
  int ammonia = map(ammoniaRaw, 0, 26000, 0, 100);
  ammonia = constrain(ammonia, 0, 100);

  if (!isnan(humidity) && !isnan(temperature)) {
    sendOrStoreSensorReading("Drawer 1", temperature, humidity, moisture, ammonia);
    sendOrStoreSensorReading("Drawer 2", temperature, humidity, moisture, ammonia);
    
    if (WiFi.status() != WL_CONNECTED) {
      autoControlDrawer12(temperature, humidity, moisture);
    }
  }
}

void collectAndProcessDrawer3() {
  float humidity = dhtC.readHumidity();
  float temperature = dhtC.readTemperature();

  for (int attempt = 0; attempt < 3 && (isnan(humidity) || isnan(temperature)); attempt++) {
    delay(500);
    humidity = dhtC.readHumidity();
    temperature = dhtC.readTemperature();
  }

  if (!isnan(humidity) && !isnan(temperature)) {
    sendOrStoreSensorReading("Drawer 3", temperature, humidity, -1, -1);
    
    if (WiFi.status() != WL_CONNECTED) {
      autoControlDrawer3(temperature, humidity);
    }
  }
}

void sendOrStoreSensorReading(const char* drawerName, float temperature, float humidity, int moisture, int ammonia) {
  if (WiFi.status() == WL_CONNECTED) {
    bool success = sendSensorReading(drawerName, temperature, humidity, moisture, ammonia);
    if (!success && sdAvailable) {
      storeSensorToSD(drawerName, temperature, humidity, moisture, ammonia);
    }
  } else if (sdAvailable) {
    storeSensorToSD(drawerName, temperature, humidity, moisture, ammonia);
    Serial.print("Stored offline: ");
    Serial.println(drawerName);
  }
}

bool sendSensorReading(const char* drawerName, float temperature, float humidity, int moisture, int ammonia) {
  HTTPClient http;
  http.setTimeout(5000);
  String sensorUrl = String(BACKEND_URL) + "/api/sensor";

  http.begin(sensorUrl);
  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
  doc["macAddress"] = DEVICE_ID;
  doc["drawerName"] = drawerName;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  if (moisture >= 0) doc["moisture"] = moisture;
  if (ammonia >= 0) doc["ammonia"] = ammonia;

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);
  http.end();

  if (httpCode == 200 || httpCode == 201) {
    Serial.print(drawerName);
    Serial.println(" sensor data sent");
    return true;
  } else {
    Serial.print(drawerName);
    Serial.print(" sensor send failed: ");
    Serial.println(httpCode);
    return false;
  }
}

// ==================== HEARTBEAT ====================
void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, skipping heartbeat");
    return;
  }

  HTTPClient http;
  http.setTimeout(5000);

  String heartbeatUrl = String(BACKEND_URL) + "/api/devices/" + DEVICE_ID + "/heartbeat";

  http.begin(heartbeatUrl);
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.POST("{}");

  if (httpCode == 200) {
    Serial.println("Heartbeat sent - device online");
  } else if (httpCode == 404) {
    Serial.println("Device not registered. Register in app Settings.");
  } else {
    Serial.print("Heartbeat failed, code: ");
    Serial.println(httpCode);
  }

  http.end();
}

// ==================== HELPER ====================
void setActuatorState(const char* actuatorType, bool state) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.setTimeout(5000);
  String url = String(BACKEND_URL) + "/api/actuators/" + DEVICE_ID + ":" + actuatorType;

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
  doc["state"] = state;

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);

  if (httpCode == 200 || httpCode == 201) {
    Serial.print("Actuator ");
    Serial.print(actuatorType);
    Serial.print(" set to ");
    Serial.println(state ? "ON" : "OFF");
  }

  http.end();
}

// ==================== TIME HELPER ====================
unsigned long getServerTime() {
  HTTPClient http;
  http.setTimeout(2000);
  http.begin(String(BACKEND_URL) + "/api/time");
  int httpCode = http.GET();
  unsigned long serverTime = 0;
  
  if (httpCode == 200) {
    String payload = http.getString();
    JsonDocument doc;
    if (!deserializeJson(doc, payload)) {
      serverTime = doc["now"].as<unsigned long>();
    }
  }
  
  http.end();
  return serverTime;
}

// ==================== MUX HELPERS ====================
void selectMuxChannel(uint8_t channel) {
  digitalWrite(MUX_S0, channel & 0x01);
  digitalWrite(MUX_S1, (channel >> 1) & 0x01);
  digitalWrite(MUX_S2, (channel >> 2) & 0x01);
  digitalWrite(MUX_S3, (channel >> 3) & 0x01);
  delayMicroseconds(100);
}

int readMuxAnalog(uint8_t channel) {
  selectMuxChannel(channel);
  return analogRead(MUX_SIG);
}

// ==================== TCA9548A HELPER ====================
void selectTcaChannel(uint8_t channel) {
  Wire.beginTransmission(TCA9548A_ADDR);
  Wire.write(1 << channel);
  Wire.endTransmission();
}

// ==================== ADS1115 HELPERS ====================
int16_t readAds1Channel(uint8_t channel) {
  if (!ads1Available) return 0;
  return ads1.readADC_SingleEnded(channel);
}

int16_t readAds2Channel(uint8_t channel) {
  if (!ads2Available) return 0;
  return ads2.readADC_SingleEnded(channel);
}

// ==================== MCP23017 HELPERS ====================
void setMcpActuator(uint8_t pin, bool state) {
  if (!mcpAvailable) return;
  mcp.digitalWrite(pin, state ? HIGH : LOW);
}

void setHumidifier1(bool state) { setMcpActuator(MCP_HUMIDIFIER1, state); }
void setHumidifier2(bool state) { setMcpActuator(MCP_HUMIDIFIER2, state); }
void setHumidifier3(bool state) { setMcpActuator(MCP_HUMIDIFIER3, state); }
void setHeater(bool state) { setMcpActuator(MCP_HEATER, state); }
void setFan1(bool state) { setMcpActuator(MCP_FAN1, state); }
void setFan2(bool state) { setMcpActuator(MCP_FAN2, state); }
void setFan3(bool state) { setMcpActuator(MCP_FAN3, state); }
void setFan4(bool state) { setMcpActuator(MCP_FAN4, state); }
void setFan5(bool state) { setMcpActuator(MCP_FAN5, state); }

// ==================== SENSOR READERS ====================
int readSoil1() { return readAds1Channel(ADS_SOIL1); }
int readSoil2() { return readAds1Channel(ADS_SOIL2); }
int readSoil3() { return readAds1Channel(ADS_SOIL3); }
int readMQ137() { return readAds1Channel(ADS_MQ137); }

// ==================== SD CARD STORAGE ====================
void storeSensorToSD(const char* drawerName, float temperature, float humidity, int moisture, int ammonia) {
  if (!sdAvailable) return;

  File file = SD.open(SD_DATA_FILE, FILE_APPEND);
  if (!file) {
    Serial.println("Failed to open SD file for writing");
    return;
  }

  JsonDocument doc;
  doc["macAddress"] = DEVICE_ID;
  doc["drawerName"] = drawerName;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  if (moisture >= 0) doc["moisture"] = moisture;
  if (ammonia >= 0) doc["ammonia"] = ammonia;
  doc["timestamp"] = millis();

  String line;
  serializeJson(doc, line);
  file.println(line);
  file.close();
}

void uploadStoredData() {
  if (!sdAvailable || WiFi.status() != WL_CONNECTED) return;
  if (!SD.exists(SD_DATA_FILE)) return;

  File file = SD.open(SD_DATA_FILE, FILE_READ);
  if (!file) return;

  String tempPath = "/temp_data.json";
  File tempFile = SD.open(tempPath, FILE_WRITE);
  
  int uploaded = 0;
  int failed = 0;

  while (file.available()) {
    String line = file.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) continue;

    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, line);
    if (error) continue;

    HTTPClient http;
    http.setTimeout(5000);
    http.begin(String(BACKEND_URL) + "/api/sensor");
    http.addHeader("Content-Type", "application/json");

    int httpCode = http.POST(line);
    http.end();

    if (httpCode == 200 || httpCode == 201) {
      uploaded++;
    } else {
      if (tempFile) tempFile.println(line);
      failed++;
    }
  }

  file.close();
  if (tempFile) tempFile.close();

  SD.remove(SD_DATA_FILE);
  if (failed > 0 && SD.exists(tempPath)) {
    SD.rename(tempPath, SD_DATA_FILE);
  } else {
    SD.remove(tempPath);
  }

  if (uploaded > 0) {
    Serial.print("Uploaded ");
    Serial.print(uploaded);
    Serial.println(" stored readings");
  }
  if (failed > 0) {
    Serial.print("Failed to upload ");
    Serial.print(failed);
    Serial.println(" readings (kept for retry)");
  }
}

int getStoredDataCount() {
  if (!sdAvailable || !SD.exists(SD_DATA_FILE)) return 0;

  File file = SD.open(SD_DATA_FILE, FILE_READ);
  if (!file) return 0;

  int count = 0;
  while (file.available()) {
    String line = file.readStringUntil('\n');
    if (line.length() > 0) count++;
  }
  file.close();
  return count;
}

// ==================== OFFLINE AUTO CONTROL ====================
void autoControlDrawer12(float temperature, float humidity, int moisture) {
  bool fanOn = false;
  bool heaterOn = false;
  bool humidifierOn = false;

  if (temperature > TEMP_OPTIMAL_HIGH) {
    fanOn = true;
    heaterOn = false;
  } else if (temperature < TEMP_OPTIMAL_LOW) {
    heaterOn = true;
    fanOn = false;
  }

  if (temperature > TEMP_MAX) {
    fanOn = true;
    heaterOn = false;
  } else if (temperature < TEMP_MIN) {
    heaterOn = true;
    fanOn = false;
  }

  if (humidity < HUMIDITY_OPTIMAL_LOW || humidity < HUMIDITY_MIN) {
    humidifierOn = true;
  } else if (humidity > HUMIDITY_OPTIMAL_HIGH || humidity > HUMIDITY_MAX) {
    humidifierOn = false;
    fanOn = true;
  }

  if (moisture < MOISTURE_OPTIMAL_LOW || moisture < MOISTURE_MIN) {
    humidifierOn = true;
  }

  setFan1(fanOn);
  setFan2(fanOn);
  setFan3(fanOn);
  setFan4(fanOn);
  setHeater(heaterOn);
  setHumidifier1(humidifierOn);
  setHumidifier2(humidifierOn);

  Serial.println("Auto control D1/D2:");
  Serial.print("  Temp="); Serial.print(temperature);
  Serial.print(" Hum="); Serial.print(humidity);
  Serial.print(" Moist="); Serial.println(moisture);
  Serial.print("  Fan="); Serial.print(fanOn ? "ON" : "OFF");
  Serial.print(" Heater="); Serial.print(heaterOn ? "ON" : "OFF");
  Serial.print(" Humidifier="); Serial.println(humidifierOn ? "ON" : "OFF");
}

void autoControlDrawer3(float temperature, float humidity) {
  bool fanOn = false;
  bool humidifierOn = false;

  if (temperature > TEMP_OPTIMAL_HIGH || temperature > TEMP_MAX) {
    fanOn = true;
  }

  if (humidity < HUMIDITY_OPTIMAL_LOW || humidity < HUMIDITY_MIN) {
    humidifierOn = true;
  } else if (humidity > HUMIDITY_OPTIMAL_HIGH || humidity > HUMIDITY_MAX) {
    humidifierOn = false;
    fanOn = true;
  }

  setFan5(fanOn);
  setHumidifier3(humidifierOn);

  Serial.println("Auto control D3:");
  Serial.print("  Temp="); Serial.print(temperature);
  Serial.print(" Hum="); Serial.println(humidity);
  Serial.print("  Fan="); Serial.print(fanOn ? "ON" : "OFF");
  Serial.print(" Humidifier="); Serial.println(humidifierOn ? "ON" : "OFF");
}

// ==================== WEB SERVER ====================
void setupWebServer() {
  server.on("/", HTTP_GET, handleRoot);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/sdcard/data", HTTP_GET, handleGetSdData);
  server.on("/sdcard/clear", HTTP_POST, handleClearSdData);
  server.on("/sdcard/sync", HTTP_POST, handleSyncSdData);
  server.enableCORS(true);
  server.begin();
  Serial.print("Web server started at http://");
  Serial.println(WiFi.localIP());
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head><title>BSFly IoT</title>";
  html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<style>body{font-family:sans-serif;padding:20px;max-width:600px;margin:0 auto}";
  html += "h1{color:#333}.card{background:#f5f5f5;padding:15px;margin:10px 0;border-radius:8px}";
  html += "button{background:#007bff;color:white;border:none;padding:10px 20px;border-radius:5px;margin:5px;cursor:pointer}";
  html += "button:hover{background:#0056b3}.danger{background:#dc3545}.danger:hover{background:#c82333}</style></head>";
  html += "<body><h1>BSFly IoT Device</h1>";
  html += "<div class='card'><strong>Device ID:</strong> " + DEVICE_ID + "</div>";
  html += "<div class='card'><strong>IP Address:</strong> " + WiFi.localIP().toString() + "</div>";
  html += "<div class='card'><strong>SD Card:</strong> " + String(sdAvailable ? "Available" : "Not found") + "</div>";
  html += "<div class='card'><strong>Stored Readings:</strong> " + String(getStoredDataCount()) + "</div>";
  html += "<h2>Actions</h2>";
  html += "<button onclick=\"fetch('/sdcard/sync',{method:'POST'}).then(r=>r.json()).then(d=>alert(d.message))\">Sync to Cloud</button>";
  html += "<button onclick=\"window.location='/sdcard/data'\">Download Data</button>";
  html += "<button class='danger' onclick=\"if(confirm('Clear all stored data?'))fetch('/sdcard/clear',{method:'POST'}).then(r=>r.json()).then(d=>alert(d.message))\">Clear Data</button>";
  html += "</body></html>";
  server.send(200, "text/html", html);
}

void handleStatus() {
  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["ip"] = WiFi.localIP().toString();
  doc["sdAvailable"] = sdAvailable;
  doc["storedCount"] = getStoredDataCount();
  doc["wifiConnected"] = WiFi.status() == WL_CONNECTED;
  doc["uptime"] = millis() / 1000;

  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleGetSdData() {
  if (!sdAvailable) {
    server.send(503, "application/json", "{\"error\":\"SD card not available\"}");
    return;
  }

  if (!SD.exists(SD_DATA_FILE)) {
    server.send(200, "application/json", "{\"readings\":[]}");
    return;
  }

  File file = SD.open(SD_DATA_FILE, FILE_READ);
  if (!file) {
    server.send(500, "application/json", "{\"error\":\"Failed to open file\"}");
    return;
  }

  server.setContentLength(CONTENT_LENGTH_UNKNOWN);
  server.send(200, "application/json", "");
  server.sendContent("{\"deviceId\":\"" + DEVICE_ID + "\",\"readings\":[");

  bool first = true;
  while (file.available()) {
    String line = file.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      if (!first) server.sendContent(",");
      server.sendContent(line);
      first = false;
    }
  }

  server.sendContent("]}");
  file.close();
}

void handleClearSdData() {
  if (!sdAvailable) {
    server.send(503, "application/json", "{\"error\":\"SD card not available\"}");
    return;
  }

  if (SD.exists(SD_DATA_FILE)) {
    SD.remove(SD_DATA_FILE);
  }

  server.send(200, "application/json", "{\"message\":\"Data cleared\",\"success\":true}");
}

void handleSyncSdData() {
  if (!sdAvailable) {
    server.send(503, "application/json", "{\"error\":\"SD card not available\"}");
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    server.send(503, "application/json", "{\"error\":\"WiFi not connected\"}");
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
  server.send(200, "application/json", response);
}
