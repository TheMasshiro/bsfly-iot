# BSFLY IoT

IoT monitoring and control system for BSF (Black Soldier Fly) farming with ESP32, Ionic/React mobile app, and Node.js backend.

## Project Structure

```
bsfly-iot/
├── esp32/          # ESP32 firmware (Arduino)
├── bsfly-iot/      # Mobile app (Ionic + React)
├── server/         # Backend API (Node.js + Express)
└── README.md
```

## Features

- Real-time temperature, humidity, moisture, and ammonia monitoring
- Per-drawer sensor readings (Drawer 1, 2, 3)
- Remote actuator control (fans, humidifiers, heater)
- Light timer with countdown
- User authentication (Clerk)
- Device sharing via join codes
- Push notifications for threshold alerts
- **Offline data storage** on SD card when internet is unavailable
- **Automatic actuator control** when offline based on sensor thresholds
- **Local web server** for extracting offline data via browser/app

## Hardware

- ESP32 DevKit
- DHT22 temperature/humidity sensors (x3)
- Soil moisture sensors (x3)
- MQ137 ammonia sensor
- ADS1115 16-bit ADC (x2)
- MCP23017 I/O expander
- CD74HC4067 analog multiplexer
- TCA9548A I²C multiplexer
- SSD1306 OLED displays (x2)
- **microSD card module** (for offline data storage)

See [esp32/README.md](esp32/README.md) for wiring details.

## Quick Start

### 1. Backend

```bash
cd server
cp .env.example .env
# Edit .env with your MongoDB and Clerk credentials
npm install
npm run dev
```

### 2. Frontend

```bash
cd bsfly-iot
cp .env.example .env
# Edit .env with your Clerk key and backend URL
npm install
npm run dev
```

### 3. ESP32

1. Open `esp32/main.ino` in Arduino IDE
2. Install required libraries (see [esp32/README.md](esp32/README.md))
3. Update `BACKEND_URL`
4. Upload to ESP32

## How to Get ESP32 MAC Address

The MAC address is required to register your ESP32 device in the app.

### Method 1: Serial Monitor (Recommended)

1. Upload the firmware to your ESP32
2. Open Serial Monitor (115200 baud)
3. Reset or power on the ESP32
4. Look for the line:
   ```
   Device ID: AA:BB:CC:DD:EE:FF
   ```
5. Copy this MAC address to register in the app

### Method 2: Simple Sketch

Upload this sketch to your ESP32:

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

### Method 3: Web Interface

After the ESP32 connects to WiFi:
1. Check Serial Monitor for the IP address (e.g., `192.168.1.100`)
2. Open a browser and go to `http://192.168.1.100`
3. The MAC address is displayed on the page

## Environment Variables

### Backend (`server/.env`)

| Variable | Description |
|----------|-------------|
| PORT | Server port (default: 5000) |
| MONGODB_URI | MongoDB connection string |
| CLERK_PUBLISHABLE_KEY | Clerk public key |
| CLERK_SECRET_KEY | Clerk secret key |
| CLERK_WEBHOOK_SECRET | Clerk webhook secret |
| ALLOWED_ORIGINS | CORS allowed origins |

### Frontend (`bsfly-iot/.env`)

| Variable | Description |
|----------|-------------|
| VITE_CLERK_PUBLISHABLE_KEY | Clerk public key |
| VITE_BACKEND_URL | Backend API URL |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/actuators/:id | Get actuator state |
| POST | /api/actuators/:id | Set actuator state |
| GET | /api/sensors/device/:id | Get latest sensor data |
| GET | /api/sensors/device/:id/hourly | Get 24h sensor history |
| GET | /api/sensors/device/:id/history | Get historical data range |
| POST | /api/sensor | Submit sensor reading (ESP32) |
| POST | /api/devices/:id/heartbeat | Device heartbeat |
| GET | /api/time | Server timestamp |

## ESP32 Local Endpoints

When ESP32 is connected to WiFi, it runs a local web server:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | / | Web interface for SD card management |
| GET | /status | Device status JSON |
| GET | /sdcard/data | Download stored offline data |
| POST | /sdcard/sync | Upload offline data to cloud |
| POST | /sdcard/clear | Clear SD card data |

## License

See [LICENSE](LICENSE) file.
