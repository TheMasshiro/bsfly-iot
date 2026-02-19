#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ==================== CONFIGURATION ====================
const char* BACKEND_URL = "https://backend-bsfly.vercel.app";

String DEVICE_ID;
String DEVICE_ID_CLEAN;

#define LIGHT_PIN 19
#define DHT_PIN 5
#define DHT_TYPE DHT22

#define POLL_INTERVAL 2000
#define SENSOR_INTERVAL 35000
#define HEARTBEAT_INTERVAL 30000

// ==================== GLOBALS ====================
DHT dht(DHT_PIN, DHT_TYPE);

unsigned long lastPollTime = 0;
unsigned long lastSensorTime = 0;
unsigned long lastHeartbeatTime = 0;

bool lightState = false;

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);

  pinMode(LIGHT_PIN, OUTPUT);
  digitalWrite(LIGHT_PIN, LOW);

  dht.begin();

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

  sendHeartbeat();
}

// ==================== MAIN LOOP ====================
void loop() {
  unsigned long currentTime = millis();

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
          digitalWrite(LIGHT_PIN, lightState ? HIGH : LOW);
          Serial.print("Light: ");
          Serial.println(lightState ? "ON" : "OFF");
        }
      } else if (doc["state"].is<JsonObject>()) {
        int timeSeconds = doc["state"]["time"].as<int>();
        bool newState = timeSeconds > 0;
        if (newState != lightState) {
          lightState = newState;
          digitalWrite(LIGHT_PIN, lightState ? HIGH : LOW);
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

  pollDrawerActuator("drawer1", "fan");
  pollDrawerActuator("drawer1", "heater");
  pollDrawerActuator("drawer1", "humidifier");
}

void pollDrawerActuator(const char* drawer, const char* actuator) {
  HTTPClient http;
  http.setTimeout(5000);

  String url = String(BACKEND_URL) + "/api/actuators/" + DEVICE_ID + ":" + drawer + ":" + actuator;

  http.begin(url);
  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();

    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error && doc.containsKey("state")) {
      bool state = doc["state"].as<bool>();
      Serial.print(drawer);
      Serial.print(":");
      Serial.print(actuator);
      Serial.print(" = ");
      Serial.println(state ? "ON" : "OFF");
    }
  }

  http.end();
}

// ==================== SENSOR DATA ====================
void sendSensorData() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, skipping sensor send");
    return;
  }

  float humidity = NAN;
  float temperature = NAN;
  
  for (int attempt = 0; attempt < 3; attempt++) {
    humidity = dht.readHumidity();
    temperature = dht.readTemperature();
    
    if (!isnan(humidity) && !isnan(temperature)) {
      break;
    }
    delay(500);
  }

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("DHT read failed after 3 attempts");
    return;
  }

  Serial.print("Temp: ");
  Serial.print(temperature);
  Serial.print("°C, Humidity: ");
  Serial.print(humidity);
  Serial.println("%");

  HTTPClient http;
  http.setTimeout(5000);
  String sensorUrl = String(BACKEND_URL) + "/api/sensor";

  http.begin(sensorUrl);
  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);

  if (httpCode == 200 || httpCode == 201) {
    Serial.println("Sensor data sent successfully");
  } else {
    Serial.print("Sensor send failed, code: ");
    Serial.println(httpCode);
  }

  http.end();
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
