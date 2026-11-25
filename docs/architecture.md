# Architecture

## Big picture

```mermaid
flowchart LR
  subgraph Farm
    ESP[ESP32<br/>sensors + relays]
  end
  subgraph Cloud
    BROKER[(EMQX<br/>MQTT broker)]
    API[Express API<br/>server/]
    DB[(PostgreSQL<br/>Neon)]
    CLERK[Clerk<br/>auth]
  end
  subgraph Users
    APP[Ionic app<br/>web + Android]
  end

  ESP -- "sensors / state (MQTT)" --> BROKER
  BROKER -- subscribe --> API
  BROKER -- "live data (read-only user)" --> APP
  API -- "commands (MQTT)" --> BROKER
  BROKER -- control --> ESP
  ESP -- "heartbeat, backfill (HTTPS + x-api-key)" --> API
  APP -- "REST + Clerk token" --> API
  API --> DB
  APP --> CLERK
  CLERK -- webhook --> API
```

The app never publishes to MQTT. Every command goes through the API, which checks membership and AUTO/MANUAL mode first.

## A command, end to end

```mermaid
sequenceDiagram
  participant U as App
  participant A as API
  participant B as Broker
  participant E as ESP32
  U->>A: POST /api/actuators/:deviceId:fan1 {state:true}
  A->>A: member? manual mode?
  A->>B: devices/MAC/actuators/fan1/control
  B->>E: control
  E->>B: devices/MAC/actuators/fan1/state
  B->>A: state (stored + logged)
  B->>U: state (UI updates)
```

## MQTT topics

| Topic | From | Payload |
|---|---|---|
| `devices/<MAC>/sensors` | ESP32 | `{drawerName, temperature, humidity, leftSubstrate, centerSubstrate, rightSubstrate, ammonia}` |
| `devices/<MAC>/actuators/<name>/state` | ESP32 | `{state}` |
| `devices/<MAC>/actuators/<name>/control` | API | `{state}` |
| `devices/<MAC>/actuators/mode/control` | API | `{state: "auto" \| "manual"}` (retained) |

## Who can call what

| Caller | Auth | Endpoints |
|---|---|---|
| App user | Clerk Bearer token | everything under `/api` except device-only routes |
| ESP32 | `x-api-key` | `POST /api/devices/<MAC>/heartbeat`, `POST /api/sensors`, `GET /api/actuators/<MAC>:<name>` |
| Clerk | Svix signature | `POST /api/webhooks/clerk` |
| Anyone | none | `GET /api/time`, `GET /health` |

A device is **online** when its last heartbeat or MQTT message is newer than 20 s. No background sweep needed.

## Repo layout

```
firmware/   ESP32 PlatformIO project (lib/bsfly = reusable library)
app/        Ionic + React + Capacitor client
server/     Express API, Drizzle schema, migrations
docs/       you are here
```
