# BSFLY IoT Server

Node.js/Express backend API for the BSFLY IoT system.

## Tech Stack

- Node.js + Express 5
- MongoDB + Mongoose
- Clerk Authentication
- Deployed on Vercel

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
| PORT | Server port (default: 5000) |
| MONGODB_URI | MongoDB connection string |
| CLERK_PUBLISHABLE_KEY | Clerk public key |
| CLERK_SECRET_KEY | Clerk secret key |
| CLERK_WEBHOOK_SECRET | Clerk webhook signing secret |
| ALLOWED_ORIGINS | Comma-separated CORS origins |

### 3. Run Development Server

```bash
npm run dev
```

### 4. Run Production

```bash
npm start
```

## Project Structure

```
server/
├── config/
│   └── hardware.js       # Hardware pin/channel configuration
├── controllers/
│   ├── actuatorRoutes.js # Actuator state endpoints
│   ├── deviceRoutes.js   # Device management endpoints
│   ├── sensorRoutes.js   # Sensor data endpoints
│   └── webhookRoutes.js  # Clerk webhook handlers
├── database/
│   └── mongo.database.js # MongoDB connection
├── middleware/
│   ├── auth.js           # Authentication middleware
│   ├── rateLimiter.js    # Rate limiting
│   └── validation.js     # Input validation
├── models/
│   ├── ActuatorState.js  # Actuator state schema
│   ├── Sensor.Drawer.js  # Drawer schema
│   ├── Sensor.DrawerReadings.js # Sensor readings schema
│   ├── User.Device.js    # Device schema
│   └── User.js           # User schema
├── webhooks/
│   └── clerk.js          # Clerk webhook handlers
├── server.js             # Main entry point
└── vercel.json           # Vercel deployment config
```

## API Endpoints

### Actuators

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/actuators | User | Get all actuator states for user's devices |
| GET | /api/actuators/:id | Device/User | Get single actuator state |
| POST | /api/actuators/:id | User | Update actuator state |
| GET | /api/actuators/poll/since/:timestamp | Device | Poll for changes since timestamp |

### Sensors

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/sensor | Device | Submit sensor reading |
| GET | /api/sensors/device/:id | User | Get latest readings (supports `?drawer=Drawer 1`) |
| GET | /api/sensors/device/:id/hourly | User | Get 24h hourly averages (supports `?drawer=Drawer 1`) |
| GET | /api/sensors/device/:id/history | User | Get historical readings |
| GET | /api/sensors/drawer/:id | User | Get readings for specific drawer |

### Devices

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/devices | User | List user's devices |
| POST | /api/devices | User | Register new device |
| POST | /api/devices/:id/heartbeat | Device | Device heartbeat |
| POST | /api/devices/join | User | Join device via code |

### Utility

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/time | None | Get server timestamp |

## Actuator ID Format

```
{MAC_ADDRESS}:{actuator_name}
```

Examples:
- `AA:BB:CC:DD:EE:FF:light`
- `AA:BB:CC:DD:EE:FF:fan1`
- `AA:BB:CC:DD:EE:FF:humidifier1`
- `AA:BB:CC:DD:EE:FF:heater`

## Deployment

### Vercel

```bash
vercel --prod
```

The `vercel.json` is pre-configured for serverless deployment.

## Database Models

### Device

- `macAddress`: Unique device MAC
- `name`: Display name
- `ownerId`: Clerk user ID
- `members`: Array of users with access
- `joinCode`: 6-char sharing code
- `apiKey`: Device authentication key
- `status`: online/offline
- `lastSeen`: Last heartbeat timestamp

### Drawer

- `deviceId`: Reference to device
- `name`: "Drawer 1", "Drawer 2", or "Drawer 3"

### DrawerReading

- `drawerId`: Reference to drawer
- `date`: Date (one document per day)
- `readings`: Array of `{ timestamp, temperature, humidity, moisture, ammonia }`

### ActuatorState

- `actuatorId`: Unique actuator identifier
- `state`: Boolean or object (for timers)
- `updatedAt`: Last update timestamp
