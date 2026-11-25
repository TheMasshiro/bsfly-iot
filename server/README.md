# BSFLY server

Express 5 API + MQTT bridge, backed by PostgreSQL via Drizzle.

```
src/
  index.js        boot: db, mqtt, jobs, listen
  app.js          express app (routes, cors, errors)
  db/             schema.js, migrate.js
  routes/         devices, sensors, actuators, users, reports, webhooks
  services/       mqtt bridge, readings, actuator logic, scheduled jobs
  middleware/     auth (Clerk + device API key), validation, rate limits
drizzle/          SQL migrations
scripts/          one-off MongoDB → Postgres import
test/             API tests on in-memory Postgres (pglite)
```

| Command | Does |
|---|---|
| `npm run dev` | start with reload |
| `npm test` | run tests |
| `npm run db:migrate` | apply migrations |
| `npm run db:generate` | new migration after editing `schema.js` |
| `npm run db:studio` | browse data |
| `npm run migrate:mongo` | import old MongoDB data |

Setup and deploy: [database](../docs/database.md), [deployment](../docs/deployment.md), [architecture](../docs/architecture.md).
