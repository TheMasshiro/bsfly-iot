# ESP32 Setup for BSFLY IoT

## Required Libraries

Install these in Arduino IDE (Sketch → Include Library → Manage Libraries):

1. **WiFiManager** by tzapu
2. **ArduinoJson** by Benoit Blanchon (v7.x)
3. **DHT sensor library** by Adafruit
4. **Adafruit ADS1X15** by Adafruit
5. **Adafruit MCP23017** by Adafruit
6. **Adafruit SSD1306** by Adafruit
7. **Wire** (built-in)

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

## Device Registration

1. After ESP32 connects, check Serial Monitor for MAC address
2. In the app Settings page, register the device using the MAC address
3. Share the join code with other users who need access

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
│  Drawer 1+2:                                                │
│   DHT22 A+B ──► Temp/Humidity                               │
│   (GPIO27,13)                                               │
│   ADS1115 ────► Soil Moisture, Ammonia ──► POST /api/sensor │
│                                                             │
│  Drawer 3:                                                  │
│   DHT22 C ────► Temp/Humidity ───────────► POST /api/sensor │
│   (GPIO33)                                                  │
│                                                             │
│  MCP23017 ◄─── Poll actuator states ◄──── GET /api/actuators│
│   (Fans, Humidifiers, Heater)                               │
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

- **WiFi not connecting**: Hold reset, let it create AP, reconfigure
- **Sensor read failed**: Check DHT22 wiring, add 10K pullup resistor
- **I²C devices not found**: Check SDA/SCL wiring, verify addresses with I2C scanner
- **Actuator not responding**: Verify MAC address matches registered device
