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
| POST | /api/sensor | Submit sensor reading (ESP32) |
| POST | /api/devices/:id/heartbeat | Device heartbeat |
| GET | /api/time | Server timestamp |

## License

See [LICENSE](LICENSE) file.
