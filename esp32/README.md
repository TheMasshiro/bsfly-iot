# ESP32 Setup for BSFLY IoT

## Required Libraries

Install these in Arduino IDE (Sketch → Include Library → Manage Libraries):

1. **WiFiManager** by tzapu
2. **ArduinoJson** by Benoit Blanchon (v7.x)
3. **DHT sensor library** by Adafruit

## Wiring

| Component | ESP32 Pin |
|-----------|-----------|
| Light (Relay/LED) | GPIO 19 |
| DHT22 Data | GPIO 5 |
| DHT22 VCC | 3.3V |
| DHT22 GND | GND |

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
│                         Backend (Vercel)                     │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │  /api/actuators │    │  /api/devices   │                 │
│  └────────▲────────┘    └────────▲────────┘                 │
│           │                      │                           │
└───────────┼──────────────────────┼───────────────────────────┘
            │                      │
    Poll every 2s          Heartbeat every 30s
            │                      │
┌───────────┴──────────────────────┴───────────────────────────┐
│                         ESP32                                │
│                                                              │
│   DHT22 ─────► Read Temp/Humidity ─────► POST /api/sensor   │
│   (GPIO5)          every 60s                                 │
│                                                              │
│   Light ◄───── Poll actuator state ◄───── GET /api/actuators │
│   (GPIO19)         every 2s                                  │
└──────────────────────────────────────────────────────────────┘
```

## Actuator ID Format

Actuators use format: `{MAC_ADDRESS}:{actuator_type}`

Example: `AABBCCDDEEFF:light`

## Troubleshooting

- **WiFi not connecting**: Hold reset, let it create AP, reconfigure
- **Sensor read failed**: Check DHT22 wiring, add 10K pullup resistor
- **Actuator not responding**: Verify MAC address matches registered device
