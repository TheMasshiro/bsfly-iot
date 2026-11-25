#pragma once

#include <Arduino.h>
#include "credentials.h"

#define MQTT_BASE_TOPIC "devices"

#define I2C_SDA GPIO_NUM_21
#define I2C_SCL GPIO_NUM_22

// ==================== SPI BUS (microSD) ====================
#define SPI_SCK GPIO_NUM_18
#define SPI_MISO GPIO_NUM_19
#define SPI_MOSI GPIO_NUM_23
#define SPI_CS_SD GPIO_NUM_15

// ==================== LED / MUX ====================
#define LED_PIN GPIO_NUM_4

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
#define HEARTBEAT_INTERVAL 10000
#define SD_SYNC_INTERVAL 30000
#define SD_DATA_FILE "/sensor_data.json"
#define OFFLINE_AUTOCONTROL_HOLD_MS 120000
#define HEARTBEAT_TIMEOUT_MS 1500
#define HEARTBEAT_COOLDOWN_AFTER_ACTUATOR_MS 4000
#define SD_UPLOAD_HTTP_TIMEOUT_MS 1500
#define SD_UPLOAD_MAX_PER_CYCLE 3
#define MQTT_RECONNECT_INTERVAL_MS 5000
#define MODE_DEBUG_INTERVAL_MS 15000

// ==================== OFFLINE THRESHOLDS ====================
#define DRAWER1_TEMP_MIN 27.0
#define DRAWER1_TEMP_MAX 31.0
#define DRAWER1_TEMP_OPTIMAL_LOW 27.0
#define DRAWER1_TEMP_OPTIMAL_HIGH 31.0

#define DRAWER1_HUMIDITY_MIN 60.0
#define DRAWER1_HUMIDITY_MAX 70.0
#define DRAWER1_HUMIDITY_OPTIMAL_LOW 60.0
#define DRAWER1_HUMIDITY_OPTIMAL_HIGH 70.0

#define DRAWER1_MOISTURE_MIN 60
#define DRAWER1_MOISTURE_MAX 75
#define DRAWER1_MOISTURE_OPTIMAL_LOW 60
#define DRAWER1_MOISTURE_OPTIMAL_HIGH 75

#define DRAWER1_AMMONIA_MAX 25.0f

#define DRAWER2_TEMP_MIN 27.0
#define DRAWER2_TEMP_MAX 30.0
#define DRAWER2_TEMP_OPTIMAL_LOW 27.0
#define DRAWER2_TEMP_OPTIMAL_HIGH 30.0

#define DRAWER2_HUMIDITY_MIN 60.0
#define DRAWER2_HUMIDITY_MAX 70.0
#define DRAWER2_HUMIDITY_OPTIMAL_LOW 60.0
#define DRAWER2_HUMIDITY_OPTIMAL_HIGH 70.0

// ==================== MQ137 CALIBRATION ====================
#define MQ137_RL 4.7f                           // Load resistance in kOhm
#define MQ137_VC 5.0f                           // Supply voltage in V
#define MQ137_CALIBRATION_PPM 21.0f             // Display-only reference value (NOT actual fresh-air NH3 ppm); Ro is derived from MQ137_CALIBRATION_RATIO
#define MQ137_CALIBRATION_RATIO 3.6f            // Rst/Ro ratio in fresh air (from datasheet)
#define MQ137_CALIBRATION_CYCLES 500            // Number of readings to average
#define MQ137_CALIBRATION_FILE "/mq137_ro.json" // File to store calibration data
#define MQ137_NH3_A 1.5f                        // Coefficient A for NH3 ppm calculation (from log-log plot of datasheet)
#define MQ137_NH3_B 0.8f                        // Coefficient B for NH3 ppm calculation (from log-log plot of datasheet)
#define MQ137_DIVIDER_INVERTED 1                // Set to 1 if your sensor is wired with the load resistor on the high side (Vc) instead of low side (GND)

static constexpr uint32_t TLS_MIN_FREE_HEAP = 65000;
static constexpr uint32_t TLS_MIN_FREE_HEAP_MIN = 50000;
constexpr int16_t ADS_INVALID = INT16_MIN;

