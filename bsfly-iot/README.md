# BSFLY IoT Mobile App

Ionic + React mobile application for monitoring and controlling BSF farming environment.

## Tech Stack

- Ionic Framework 8
- React 19
- TypeScript
- Capacitor (Android/iOS)
- Clerk Authentication
- Chart.js for analytics
- Vite build tool

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| VITE_CLERK_PUBLISHABLE_KEY | Clerk public key |
| VITE_BACKEND_URL | Backend API URL |

### 3. Run Development Server

```bash
npm run dev
```

App runs at `http://localhost:5173`

### 4. Build for Production

```bash
npm run build
```

## Project Structure

```
bsfly-iot/
├── src/
│   ├── assets/
│   │   └── assets.ts         # Sensor/control data definitions
│   ├── components/
│   │   ├── Graph/            # Chart.js sensor graphs
│   │   ├── LoadingSkeleton/  # Loading states
│   │   ├── Segments/         # Drawer selector
│   │   └── Toolbar/          # App header
│   ├── config/
│   │   ├── hardware.ts       # Hardware configuration
│   │   └── thresholds.ts     # Sensor thresholds per drawer
│   ├── context/
│   │   ├── DeviceContext.tsx # Device state management
│   │   ├── LifeCycleContext.tsx # Drawer/stage selection
│   │   └── NotificationContext.tsx # Alert notifications
│   ├── pages/
│   │   ├── Analytics/        # Sensor history graphs
│   │   ├── Dashboard/        # Main monitoring view
│   │   ├── Devices/          # Device management
│   │   ├── Light/            # Light timer control
│   │   └── ...
│   ├── services/
│   │   └── socket/           # Actuator service
│   ├── types/
│   │   └── device.ts         # TypeScript interfaces
│   ├── utils/
│   │   └── api.ts            # Axios API client
│   ├── App.tsx               # Main app with routes
│   └── main.tsx              # Entry point
├── android/                  # Android native project
├── public/                   # Static assets
├── capacitor.config.ts       # Capacitor config
├── ionic.config.json         # Ionic config
└── vite.config.ts            # Vite config
```

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/dashboard` | Real-time sensor readings with quick actions |
| Analytics | `/analytics` | 24-hour sensor history graphs |
| Light | `/light` | Light timer control |
| Devices | `/devices` | Device management and sharing |
| About | `/about` | System information |

## Features

### Dashboard

- Real-time sensor readings (temperature, humidity, moisture, ammonia)
- Environment quality score
- Quick action buttons (Fan, Heater, Humidifier)
- Drawer selector (Drawer 1, 2, 3)
- Threshold-based color coding (success/warning/danger)

### Analytics

- 24-hour historical graphs
- Per-drawer filtering
- Temperature, humidity, moisture charts
- Threshold reference lines

### Light Control

- Timer-based light control
- Countdown display
- On/Off toggle

### Device Management

- Register devices by MAC address
- Share devices via join code
- View device online/offline status
- Remove devices

## Drawer Configuration

| Drawer | Sensors | Actuators |
|--------|---------|-----------|
| Drawer 1 | DHT22 A+B, Soil 1-3, MQ137 | Fan 1-4, Humidifier 1-2, Heater |
| Drawer 2 | DHT22 A+B, Soil 1-3, MQ137 | Fan 1-4, Humidifier 1-2, Heater |
| Drawer 3 | DHT22 C | Fan 5, Humidifier 3 |

## Thresholds

Defined in `src/config/thresholds.ts`:

| Sensor | Min | Optimal | Max |
|--------|-----|---------|-----|
| Temperature | 20°C | 27-31°C | 35°C |
| Humidity | 50% | 60-70% | 80% |
| Moisture | 50% | 60-75% | 80% |
| Ammonia | 0 ppm | 0-10 ppm | 30 ppm |

## Android Build

### 1. Sync Capacitor

```bash
npx cap sync android
```

### 2. Open in Android Studio

```bash
npx cap open android
```

### 3. Build APK

Build via Android Studio or:

```bash
cd android
./gradlew assembleDebug
```

## Testing

### Unit Tests

```bash
npm run test.unit
```

### E2E Tests

```bash
npm run test.e2e
```

## Linting

```bash
npm run lint
```

## Deployment

### Vercel (Web)

```bash
vercel --prod
```

### Android (Play Store)

1. Build release APK/AAB in Android Studio
2. Sign with release keystore
3. Upload to Play Console
