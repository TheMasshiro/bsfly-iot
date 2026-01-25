#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ==================== CONFIGURATION ====================
const char* BACKEND_URL = "https://backend-bsfly.vercel.app";

// Device ID (MAC address with colons, e.g., "AA:BB:CC:DD:EE:FF")
String DEVICE_ID;
// Device ID without colons for actuator IDs
String DEVICE_ID_CLEAN;

// Pin definitions
#define LIGHT_PIN 19       // Actuator: Light relay/LED
#define DHT_PIN 5          // Sensor: DHT22
#define DHT_TYPE DHT22

// Timing intervals (milliseconds)
#define POLL_INTERVAL 2000       // Poll actuators every 2 seconds
#define SENSOR_INTERVAL 60000    // Send sensor data every 60 seconds
#define HEARTBEAT_INTERVAL 30000 // Heartbeat every 30 seconds

// ==================== GLOBALS ====================
DHT dht(DHT_PIN, DHT_TYPE);

unsigned long lastPollTime = 0;
unsigned long lastSensorTime = 0;
unsigned long lastHeartbeatTime = 0;

// Current actuator states
bool lightState = false;

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);

  // Initialize pins
  pinMode(LIGHT_PIN, OUTPUT);
  digitalWrite(LIGHT_PIN, LOW);

  // Initialize DHT sensor
  dht.begin();

  // WiFi Manager setup
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

    // Get MAC address as device ID
    DEVICE_ID = WiFi.macAddress(); // With colons: "AA:BB:CC:DD:EE:FF"
    DEVICE_ID_CLEAN = DEVICE_ID;
    DEVICE_ID_CLEAN.replace(":", ""); // Without colons: "AABBCCDDEEFF"

    Serial.print("Device ID: ");
    Serial.println(DEVICE_ID);
    Serial.print("Device ID (clean): ");
    Serial.println(DEVICE_ID_CLEAN);
  }

  // Send initial heartbeat
  sendHeartbeat();
}

// ==================== MAIN LOOP ====================
void loop() {
  unsigned long currentTime = millis();

  // Poll actuator states
  if (currentTime - lastPollTime >= POLL_INTERVAL) {
    pollActuators();
    lastPollTime = currentTime;
  }

  // Send sensor readings
  if (currentTime - lastSensorTime >= SENSOR_INTERVAL) {
    sendSensorData();
    lastSensorTime = currentTime;
  }

  // Send heartbeat
  if (currentTime - lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeatTime = currentTime;
  }

  delay(100); // Small delay to prevent watchdog issues
}

// ==================== ACTUATOR POLLING ====================
void pollActuators() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, skipping poll");
    return;
  }

  HTTPClient http;

  // Poll for light state
  // Format: {deviceId}:light (e.g., "AA:BB:CC:DD:EE:FF:light")
  String lightUrl = String(BACKEND_URL) + "/api/actuators/" + DEVICE_ID + ":light";

  http.begin(lightUrl);
  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();

    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error && doc.containsKey("state")) {
      // Light state can be bool or object with time property
      if (doc["state"].is<bool>()) {
        bool newState = doc["state"].as<bool>();
        if (newState != lightState) {
          lightState = newState;
          digitalWrite(LIGHT_PIN, lightState ? HIGH : LOW);
          Serial.print("Light: ");
          Serial.println(lightState ? "ON" : "OFF");
        }
      } else if (doc["state"].is<JsonObject>()) {
        // Handle timer-based light state: { time: seconds, startTime: timestamp }
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
  } else if (httpCode == 404) {
    // Actuator not found - that's okay, might not be set yet
  } else {
    Serial.print("Poll failed, code: ");
    Serial.println(httpCode);
  }

  http.end();

  // Poll for drawer actuators (fan, heater, humidifier, etc.)
  pollDrawerActuator("drawer1", "fan");
  pollDrawerActuator("drawer1", "heater");
  pollDrawerActuator("drawer1", "humidifier");
  // Add more as needed for your setup
}

void pollDrawerActuator(const char* drawer, const char* actuator) {
  HTTPClient http;

  // Format: {deviceId}:{drawer}:{actuator}
  String url = String(BACKEND_URL) + "/api/actuators/" + DEVICE_ID + ":" + drawer + ":" + actuator;

  http.begin(url);
  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();

    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error && doc.containsKey("state")) {
      bool state = doc["state"].as<bool>();
      // Handle actuator state here
      // You would map drawer:actuator to GPIO pins
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

  // Read DHT22 sensor
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature(); // Celsius

  // Check if reading failed
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("DHT22 read failed");
    return;
  }

  Serial.print("Temp: ");
  Serial.print(temperature);
  Serial.print("°C, Humidity: ");
  Serial.print(humidity);
  Serial.println("%");

  // Send to backend
  HTTPClient http;
  String sensorUrl = String(BACKEND_URL) + "/api/sensor";

  http.begin(sensorUrl);
  http.addHeader("Content-Type", "application/json");

  // Create JSON payload
  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["timestamp"] = millis();

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

  // Use MAC address with colons for device registration
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

// ==================== HELPER: Set Actuator State ====================
// Call this to update actuator state on the server (e.g., from physical button)
void setActuatorState(const char* actuatorType, bool state) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  // Format: {deviceId}:{actuatorType}
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
