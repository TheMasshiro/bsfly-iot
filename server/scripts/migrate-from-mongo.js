import "dotenv/config";
import { MongoClient } from "mongodb";
import { sql } from "drizzle-orm";
import { closeDb, connectDb } from "../src/db/index.js";
import {
  actuatorEvents,
  actuatorStates,
  deviceMembers,
  devices,
  drawers,
  readings,
  users,
} from "../src/db/schema.js";
import { parseActuatorId } from "../src/services/actuators.js";
import { hashApiKey, normalizeDrawerName, normalizeMac } from "../src/services/devices.js";
import { readingFromPayload } from "../src/services/readings.js";

const BATCH = 1000;
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) throw new Error("Set MONGODB_URI to the old database");

const mongo = await MongoClient.connect(mongoUri);
const src = mongo.db();
const db = connectDb();
const id = (v) => String(v);
const count = {};

async function insertMany(table, rows, name) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.insert(table).values(rows.slice(i, i + BATCH)).onConflictDoNothing();
  }
  count[name] = (count[name] ?? 0) + rows.length;
}

const oldDevices = await src.collection("devices").find().toArray();
const userIds = new Set(oldDevices.flatMap((d) => [d.ownerId, ...(d.members ?? []).map((m) => m.userId)]));
const oldUsers = await src.collection("users").find().toArray();
const userRows = oldUsers.map((u) => ({ id: id(u._id), name: u.name ?? "", email: u.email ?? "" }));
for (const uid of userIds) if (uid && !userRows.some((u) => u.id === uid)) userRows.push({ id: uid });
await insertMany(users, userRows, "users");

await insertMany(
  devices,
  oldDevices.map((d) => {
    const key = d.apiKey ?? "";
    return {
      id: id(d._id),
      macAddress: normalizeMac(d.macAddress),
      name: d.name,
      ownerId: d.ownerId,
      controlMode: d.controlMode === "manual" ? "manual" : "auto",
      lastSeen: d.lastSeen ?? null,
      ipAddress: d.ipAddress ?? null,
      joinCode: d.joinCode,
      apiKeyHash: hashApiKey(key),
      apiKeyHint: key ? `${key.slice(0, 4)}...${key.slice(-4)}` : "****",
      createdAt: d.createdAt ?? new Date(),
    };
  }),
  "devices",
);

await insertMany(
  deviceMembers,
  oldDevices.flatMap((d) =>
    (d.members ?? []).map((m) => ({ deviceId: id(d._id), userId: m.userId, joinedAt: m.joinedAt ?? new Date() })),
  ),
  "device_members",
);

const deviceIds = new Set(oldDevices.map((d) => id(d._id)));
const oldDrawers = (await src.collection("drawers").find().toArray()).filter((d) => deviceIds.has(id(d.deviceId)));
await insertMany(
  drawers,
  oldDrawers.map((d) => ({ id: id(d._id), deviceId: id(d.deviceId), name: normalizeDrawerName(d.name) })),
  "drawers",
);

const drawerIds = new Set(oldDrawers.map((d) => id(d._id)));
let buffer = [];
for await (const bucket of src.collection("drawerreadings").find()) {
  if (!drawerIds.has(id(bucket.drawerId))) continue;
  for (const r of bucket.readings ?? []) {
    buffer.push({ drawerId: id(bucket.drawerId), ...readingFromPayload(r) });
  }
  if (buffer.length >= BATCH) {
    await insertMany(readings, buffer, "readings");
    buffer = [];
  }
}
if (buffer.length) await insertMany(readings, buffer, "readings");

const stateRows = [];
for (const s of await src.collection("actuatorstates").find().toArray()) {
  const parsed = parseActuatorId(s.actuatorId);
  if (!parsed || !deviceIds.has(parsed.deviceRef) || s.state === undefined) continue;
  stateRows.push({ deviceId: parsed.deviceRef, actuator: parsed.actuator, state: s.state, updatedAt: s.updatedAt ?? new Date() });
}
await insertMany(actuatorStates, stateRows, "actuator_states");

buffer = [];
for await (const e of src.collection("actuatorevents").find()) {
  if (!deviceIds.has(id(e.deviceId))) continue;
  buffer.push({
    deviceId: id(e.deviceId),
    actuator: e.actuator,
    drawer: e.drawer ?? null,
    parameter: e.parameter ?? null,
    value: e.value ?? null,
    createdAt: e.timestamp ?? e.createdAt ?? new Date(),
  });
  if (buffer.length >= BATCH) {
    await insertMany(actuatorEvents, buffer, "actuator_events");
    buffer = [];
  }
}
if (buffer.length) await insertMany(actuatorEvents, buffer, "actuator_events");

await db.execute(sql`select 1`);
console.table(count);
console.log("Done. Old devices keep working only after you regenerate their API key and re-flash.");
await mongo.close();
await closeDb();
