# Database

PostgreSQL, managed with [Drizzle](https://orm.drizzle.team). Schema: `server/src/db/schema.js`. Migrations: `server/drizzle/`.

## Why SQL

Users, devices, members and drawers are relational, and readings are time series. Postgres gives foreign keys, cascading deletes and `GROUP BY hour` for charts, so the server doesn't have to do it by hand.

## Schema

```mermaid
erDiagram
  users ||--o{ devices : owns
  users ||--o{ device_members : "is member"
  devices ||--o{ device_members : has
  devices ||--o{ drawers : has
  drawers ||--o{ readings : records
  devices ||--o{ actuator_states : "current state"
  devices ||--o{ actuator_events : "history"

  users {
    text id PK "Clerk user id"
    text name
    text email
  }
  devices {
    text id PK
    text mac_address UK
    text owner_id FK
    enum control_mode
    timestamptz last_seen
    text join_code UK
    text api_key_hash
  }
  device_members {
    text device_id PK, FK
    text user_id PK, FK
    timestamptz joined_at
  }
  drawers {
    text id PK
    text device_id FK
    text name "Drawer 1 or 2"
  }
  readings {
    bigint id PK
    text drawer_id FK
    timestamptz recorded_at
    real temperature
    real humidity
    real moisture
    real ammonia
  }
  actuator_states {
    text device_id PK, FK
    text actuator PK
    jsonb state
  }
  actuator_events {
    bigint id PK
    text device_id FK
    text actuator
    text drawer
    text parameter
    jsonb value
  }
```

- Deleting a user deletes the devices they own and all of those devices' data.
- API keys are stored as SHA-256 hashes. The full key is shown once, when you register the device or regenerate its key.

## Setup

```mermaid
flowchart TD
  A{Where?} -->|laptop| B[docker compose up -d]
  A -->|cloud| C[Create Neon project]
  B --> D["DATABASE_URL = local Postgres"]
  C --> E["Copy pooled connection string"]
  D --> F[npm run db:migrate]
  E --> F
  F --> G[npm run dev]
```

```bash
cd server
cp .env.example .env
docker compose up -d
npm install
npm run db:migrate
npm run dev
```

Changed the schema? Run `npm run db:generate`, commit the new file in `drizzle/`, then `npm run db:migrate`. You can browse the data with `npm run db:studio`.

## Moving old MongoDB data

```bash
MONGODB_URI="mongodb+srv://…" npm run migrate:mongo
```

The script only reads from Mongo, and it's safe to run twice. Device IDs are kept. Old API keys still hash to the same value, but the firmware never sent one, so **regenerate each device's key in the app and re-flash**.

## Storage budget

At one reading every 5 s per drawer, that's about 35k rows and roughly 4 MB per day. Neon's free 0.5 GB lasts about 4 months. To keep only the last 90 days:

```sql
delete from readings where recorded_at < now() - interval '90 days';
```
