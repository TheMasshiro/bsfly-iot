/**
 * BSFLY IoT - Main Control Firmware (ESP32)
 *
 * Purpose
 * -------
 * Firmware for a Black Soldier Fly (BSF) multi-drawer incubator controller. It monitors
 * environmental conditions (temperature, humidity, substrate moisture, ammonia/NH3) and
 * drives actuators (fans, heater, humidifiers, pump, enclosure light). It is designed
 * to remain functional when the network is unavailable by buffering readings to SD and
 * continuing autonomous control.
 *
 * Key Capabilities
 * ----------------
 * Sensors
 *  - Drawer 1 (Egg/Larvae):
 *      * 3x DHT sensors (A/B/C): temperature + humidity
 *      * 3x substrate moisture channels via ADS1115 #1 (A0/A1/A2)
 *      * MQ137 ammonia sensor via ADS1115 #2 (A0), reported as NH3 PPM (via Rs/Ro curve)
 *  - Drawer 2 (Pupa):
 *      * 2x DHT sensors (D/E): temperature + humidity
 *
 * Actuators (via MCP23017, active-low outputs in this project)
 *  - Enclosure light
 *  - Drawer 1: pump, humidifier, fans, heater, heater-fans
 *  - Drawer 2: humidifier, fan
 *
 * Connectivity / Data Path
 *  - WiFi is provisioned via WiFiManager.
 *  - MQTT publishes sensor readings and actuator state; receives actuator commands.
 *  - HTTPS: heartbeat + time endpoint; SD upload uses HTTPS when online.
 *  - SD card: append-only line-delimited JSON buffer for offline storage and retry upload.
 *
 * Concurrency Model (ESP32 / FreeRTOS)
 * -----------------------------------
 *  - loop(): connectivity supervision, MQTT loop/drain, light timer expiry, health logging.
 *  - sensorTask(): periodic sensor collection and local control decisions.
 *  - heartbeatTask(): periodic HTTPS heartbeat, with cooldown after actuator activity.
 *  - sdUploadTask(): uploads buffered SD readings when kicked.
 *  - sdCountTask(): periodically counts buffered SD readings for the web UI.
 *
 * Robustness / Degraded Operation
 * -------------------------------
 *  - If MCP23017 missing: actuators/light are disabled, firmware continues sensing/networking.
 *  - If TCA9548A missing: LCD output is disabled, firmware continues otherwise.
 *  - TLS/HTTPS protected by a mutex to serialize requests and reduce heap fragmentation.
 *  - DHT reads protected by a mutex to avoid concurrent access timing issues.
 *  - Offline auto-control stays active when WiFi is down, with a manual-override holdoff timer.
 *
 * Notes on Measurements
 * ---------------------
 *  - Substrate moisture is derived from ADS raw values mapped to percent using calibrated
 *    dry/wet endpoints (gMoistureRawDry/gMoistureRawWet).
 *  - MQ137:
 *      * Ro calibration is stored on SD (/mq137_ro.json).
 *      * NH3 PPM is estimated from Rs/Ro using a power-law curve (MQ137_NH3_A / MQ137_NH3_B).
 *      * The term "ammonia" in the payload is treated as NH3 PPM for backend compatibility.
 *
 * ================================== PIN / BUS MAPPING ====================================
 *
 * GPIO (ESP32)
 * +--------------------+-------------+----------+----------------------------------------------+
 * | Module/Component   | Signal      | GPIO     | Notes                                        |
 * +--------------------+-------------+----------+----------------------------------------------+
 * | I2C Bus            | SDA         | 21       | I2C_SDA                                      |
 * | I2C Bus            | SCL         | 22       | I2C_SCL                                      |
 * | SPI (microSD)      | SCK         | 18       | SPI_SCK                                      |
 * | SPI (microSD)      | MISO        | 19       | SPI_MISO                                     |
 * | SPI (microSD)      | MOSI        | 23       | SPI_MOSI                                     |
 * | SPI (microSD)      | CS          | 15       | SPI_CS_SD                                    |
 * | LED/Light Control  | LED_PIN     | 4        | Project-defined LED pin (MCP controls light) |
 * | DHT Drawer 1       | Sensor A    | 16       | DHT_A_PIN                                    |
 * | DHT Drawer 1       | Sensor B    | 26       | DHT_B_PIN                                    |
 * | DHT Drawer 1       | Sensor C    | 25       | DHT_C_PIN                                    |
 * | DHT Drawer 2       | Sensor D    | 14       | DHT_D_PIN                                    |
 * | DHT Drawer 2       | Sensor E    | 27       | DHT_E_PIN                                    |
 * +--------------------+-------------+----------+----------------------------------------------+
 *
 * I2C Devices
 * +--------------------+-------------+----------+----------------------------------------------+
 * | Module/Component   | Part        | Addr     | Usage                                        |
 * +--------------------+-------------+----------+----------------------------------------------+
 * | ADC #1             | ADS1115     | 0x48     | Substrate moisture (3 ch)                    |
 * | ADC #2             | ADS1115     | 0x49     | MQ137 (NH3) input                            |
 * | IO Expander        | MCP23017    | 0x20     | Actuators (active-low)                       |
 * | I2C Mux            | TCA9548A    | 0x70     | LCD bus multiplexing                         |
 * | LCD Modules (x2)   | 16x2 LCD    | 0x27     | Behind TCA9548A channels                     |
 * +--------------------+-------------+----------+----------------------------------------------+
 *
 * MCP23017 Outputs (active-low)
 * +--------------------+-------------+----------+----------------------------------------------+
 * | Module/Component   | Actuator    | Pin      | Notes                                        |
 * +--------------------+-------------+----------+----------------------------------------------+
 * | Enclosure          | Light       | 0        | MCP_ENCLOSURE_LIGHT                          |
 * | Drawer 1           | Pump        | 1        | MCP_EGGLARVAE_PUMP                           |
 * | Drawer 1           | Humidifier  | 2        | MCP_EGGLARVAE_HUMIDIFIER                     |
 * | Drawer 1           | Fans        | 3        | MCP_EGGLARVAE_FANS                           |
 * | Drawer 1           | Heater      | 4        | MCP_EGGLARVAE_HEATER                         |
 * | Drawer 1           | Heater Fans | 5        | MCP_EGGLARVAE_HEATER_FANS                    |
 * | Drawer 2           | Humidifier  | 6        | MCP_PUPA_HUMIDIFIER                          |
 * | Drawer 2           | Fan         | 7        | MCP_PUPA_FAN                                 |
 * +--------------------+-------------+----------+----------------------------------------------+
 *
 * ADS1115 Channel Assignments
 * +--------------------+-------------+----------+----------------------------------------------+
 * | Module/Component   | Device      | Channel  | Usage                                        |
 * +--------------------+-------------+----------+----------------------------------------------+
 * | Substrate Sensors  | ADS1115#1   | A0 (0)   | ADS1_SUBSTRATE_1                             |
 * | Substrate Sensors  | ADS1115#1   | A1 (1)   | ADS1_SUBSTRATE_2                             |
 * | Substrate Sensors  | ADS1115#1   | A2 (2)   | ADS1_SUBSTRATE_3                             |
 * | MQ137 NH3 Sensor   | ADS1115#2   | A0 (0)   | ADS2_MQ137                                   |
 * +--------------------+-------------+----------+----------------------------------------------+
 *
 * TCA9548A Channels
 * +--------------------+-------------+------------------+
 * | Module/Component   | Channel     | Notes            |
 * +--------------------+-------------+------------------+
 * | LCD #1             | 0           | TCA_CH_LCD1      |
 * | LCD #2             | 1           | TCA_CH_LCD2      |
 * +--------------------+-------------+------------------+
 *
 */

#include <Arduino.h>
#include <Wire.h>
#include "Actuators.h"
#include "Config.h"
#include "Display.h"
#include "MqttLink.h"
#include "Net.h"
#include "Sensors.h"
#include "ServerApi.h"
#include "State.h"
#include "Storage.h"
#include "Tasks.h"
#include "WebPortal.h"

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

void setup()
{
  setCpuFrequencyMhz(240);
  Serial.begin(115200);
  delay(1000);

  if (!gTlsMutex)
    gTlsMutex = xSemaphoreCreateMutex();
  configureTlsClient(gHttpsClient, SERVER_ROOT_CA, "HTTPS");

  if (!gDhtMutex)
    gDhtMutex = xSemaphoreCreateMutex();

  initMqttQueue();

  beginSd();

  Wire.begin(I2C_SDA, I2C_SCL, 200000);
  beginAds();
  beginMcp();
  beginDisplay();
  beginDht();
  loadMQ137Calibration();

  connectWifi();
  setupWebServer();
  sendHeartbeat();
  startTasks();

  if (strlen(MQTT_BROKER) > 0)
  {
    mqttEnabled = true;
    mqttReconnect();
  }
}

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

  checkLightTimerExpiry();

  yield();
}
