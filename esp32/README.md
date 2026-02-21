# ESP32 Setup for BSFLY IoT

## Required Libraries

Install these in Arduino IDE (Sketch → Include Library → Manage Libraries):

1. **WiFiManager** by tzapu
2. **ArduinoJson** by Benoit Blanchon (v7.x)
3. **DHT sensor library** by Adafruit
4. **Adafruit ADS1X15** by Adafruit
5. **Adafruit MCP23017** by Adafruit
6. **Adafruit SSD1306** by Adafruit
7. **SD** (built-in)
8. **SPI** (built-in)
9. **Wire** (built-in)
10. **WebServer** (built-in)

## Wiring

See [PIN_MAP.md](PIN_MAP.md) for complete pin mapping.

### I²C Bus

| Function | ESP32 Pin |
|----------|-----------|
| SDA | GPIO21 |
| SCL | GPIO22 |

### SPI Bus (microSD)

| Function | ESP32 Pin |
|----------|-----------|
| SCK | GPIO18 |
| MISO | GPIO19 |
| MOSI | GPIO23 |
| CS | GPIO5 |

### DHT22 Sensors

| Sensor | ESP32 Pin | Drawer |
|--------|-----------|--------|
| DHT22 #A | GPIO27 | Drawer 1+2 |
| DHT22 #B | GPIO13 | Drawer 1+2 |
| DHT22 #C | GPIO33 | Drawer 3 |

### CD74HC4067 Analog Multiplexer

| Function | ESP32 Pin |
|----------|-----------|
| SIG | GPIO35 |
| S0 | GPIO16 |
| S1 | GPIO17 |
| S2 | GPIO25 |
| S3 | GPIO26 |
| EN | GND |

### I²C Devices

| Device | Address |
|--------|---------|
| ADS1115 #1 | 0x48 |
| ADS1115 #2 | 0x49 |
| MCP23017 | 0x20 |
| TCA9548A | 0x70 |

### MCP23017 Actuator Mapping

| Pin | Actuator |
|-----|----------|
| GPA0 | Humidifier 1 |
| GPA1 | Humidifier 2 |
| GPA2 | Heater |
| GPA3 | Fan 1 |
| GPA4 | Fan 2 |
| GPA5 | Fan 3 |
| GPA6 | Fan 4 |
| GPB0 | Humidifier 3 |
| GPB1 | Fan 5 |

### ADS1115 Sensor Mapping

| Channel | Sensor |
|---------|--------|
| A0 | Soil #1 |
| A1 | Soil #2 |
| A2 | Soil #3 |
| A3 | MQ137 |

## Configuration

1. Open `main.ino`
2. Update `BACKEND_URL` with your Vercel backend URL:
   ```cpp
   const char* BACKEND_URL = "https://your-backend.vercel.app";
   ```

## First Time Setup

1. Upload the code to ESP32
2. ESP32 creates WiFi AP: `Connect2Wifi` (password: `esp32bsf`)
3. Connect to AP and configure your WiFi credentials
4. ESP32 restarts and connects to your WiFi

## How to Get MAC Address

The MAC address is required to register the device in the app.

### From Serial Monitor

1. Open Serial Monitor (115200 baud)
2. Reset the ESP32
3. Look for:
   ```
   Connected! IP: 192.168.x.x
   Device ID: AA:BB:CC:DD:EE:FF
   ```
4. Use the `Device ID` value as the MAC address

### From Web Interface

1. After connecting to WiFi, note the IP address from Serial Monitor
2. Open `http://<IP_ADDRESS>` in a browser
3. The MAC address is displayed on the page

### Using a Simple Sketch

```cpp
#include <WiFi.h>

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.print("MAC Address: ");
  Serial.println(WiFi.macAddress());
}

void loop() {}
```

## Device Registration

1. After ESP32 connects, check Serial Monitor for MAC address
2. In the app Settings page, register the device using the MAC address
3. Share the join code with other users who need access

## Offline Features

### SD Card Storage

When WiFi is disconnected, sensor data is automatically stored on the SD card:
- Data saved to `/sensor_data.json`
- Each reading includes timestamp, temperature, humidity, moisture, ammonia
- Auto-uploads to cloud when WiFi reconnects (every 60 seconds)

### Automatic Actuator Control

When offline, actuators are controlled automatically based on thresholds:

| Condition | Action |
|-----------|--------|
| Temperature > 32°C | Fans ON, Heater OFF |
| Temperature < 28°C | Heater ON, Fans OFF |
| Temperature > 35°C (critical) | Fans ON |
| Temperature < 25°C (critical) | Heater ON |
| Humidity < 60% | Humidifiers ON |
| Humidity > 70% | Humidifiers OFF, Fans ON |
| Moisture < 50% | Humidifiers ON |

Thresholds can be configured in `main.ino`:
```cpp
#define TEMP_OPTIMAL_LOW 28.0
#define TEMP_OPTIMAL_HIGH 32.0
#define HUMIDITY_OPTIMAL_LOW 60.0
#define HUMIDITY_OPTIMAL_HIGH 70.0
```

### Local Web Server

ESP32 runs a web server on port 80 for direct access:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Web interface |
| `/status` | GET | JSON status (stored count, SD available) |
| `/sdcard/data` | GET | Download all stored readings |
| `/sdcard/sync` | POST | Upload data to cloud |
| `/sdcard/clear` | POST | Clear stored data |

Access via browser: `http://<ESP32_IP>/`

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                     Backend (Vercel)                        │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │  /api/actuators │    │  /api/devices   │                │
│  └────────▲────────┘    └────────▲────────┘                │
│           │                      │                          │
└───────────┼──────────────────────┼──────────────────────────┘
            │                      │
    Poll every 2s          Heartbeat every 30s
            │                      │
┌───────────┴──────────────────────┴──────────────────────────┐
│                         ESP32                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  WiFi Connected:                                     │   │
│  │   - POST sensor data to /api/sensor                  │   │
│  │   - GET actuator states from /api/actuators          │   │
│  │   - Auto-upload stored SD data                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  WiFi Disconnected:                                  │   │
│  │   - Store sensor data to SD card                     │   │
│  │   - Auto-control actuators based on thresholds       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Drawer 1+2: DHT22 A+B, ADS1115 (Soil, Ammonia)            │
│  Drawer 3:   DHT22 C                                        │
│  Actuators:  MCP23017 (Fans, Humidifiers, Heater)          │
│  Storage:    microSD via SPI                                │
│  Web Server: Port 80                                        │
└─────────────────────────────────────────────────────────────┘
```

## Actuator ID Format

Actuators use format: `{MAC_ADDRESS}:{actuator_name}`

Examples:
- `AA:BB:CC:DD:EE:FF:light`
- `AA:BB:CC:DD:EE:FF:fan1`
- `AA:BB:CC:DD:EE:FF:humidifier1`
- `AA:BB:CC:DD:EE:FF:heater`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| WiFi not connecting | Hold reset, let it create AP, reconfigure |
| Sensor read failed | Check DHT22 wiring, add 10K pullup resistor |
| I²C devices not found | Check SDA/SCL wiring, verify addresses with I2C scanner |
| Actuator not responding | Verify MAC address matches registered device |
| SD card not found | Check SPI wiring, ensure card is formatted FAT32 |
| Web server not accessible | Ensure phone/PC is on same network as ESP32 |
| Offline data not syncing | Check SD card, verify WiFi connection |
