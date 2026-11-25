import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { drawers, readings } from "../db/schema.js";
import { normalizeDrawerName } from "./devices.js";

const METRICS = ["temperature", "humidity", "moisture", "leftSubstrate", "centerSubstrate", "rightSubstrate", "ammonia"];
const ROUNDED = new Set(["moisture", "leftSubstrate", "centerSubstrate", "rightSubstrate"]);
const HOUR_MS = 3_600_000;

const toNumber = (value) => {
  const n = Number(value);
  return value === null || value === undefined || value === "" || !Number.isFinite(n) ? undefined : n;
};

const SUBSTRATE_ALIASES = {
  leftSubstrate: "leftSoil",
  centerSubstrate: "centerSoil",
  rightSubstrate: "rightSoil",
};

export function readingFromPayload(payload) {
  const row = {};
  for (const metric of METRICS) {
    const raw = payload[metric] ?? payload[SUBSTRATE_ALIASES[metric]];
    const value = toNumber(raw);
    if (value === undefined || (metric !== "temperature" && value < 0)) continue;
    row[metric] = ROUNDED.has(metric) ? Math.round(value) : Math.round(value * 100) / 100;
  }
  const ts = new Date(payload.timestamp ?? payload.deviceTimestampMs ?? Date.now());
  row.recordedAt = Number.isNaN(ts.getTime()) ? new Date() : ts;
  return row;
}

export function computeMoisture(row) {
  if (row.moisture !== null && row.moisture !== undefined) return Math.round(row.moisture);
  const values = [row.leftSubstrate, row.centerSubstrate, row.rightSubstrate].filter((v) => typeof v === "number");
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

export function toReadingDto(row) {
  if (!row) {
    return Object.fromEntries(METRICS.map((m) => [m, null]));
  }
  return {
    temperature: row.temperature ?? null,
    humidity: row.humidity ?? null,
    moisture: computeMoisture(row),
    leftSubstrate: row.leftSubstrate ?? null,
    centerSubstrate: row.centerSubstrate ?? null,
    rightSubstrate: row.rightSubstrate ?? null,
    ammonia: row.ammonia ?? null,
    timestamp: row.recordedAt,
  };
}

export async function getOrCreateDrawer(deviceId, rawName) {
  const name = normalizeDrawerName(rawName);
  const [created] = await db.insert(drawers).values({ deviceId, name }).onConflictDoNothing().returning();
  if (created) return created;
  const [existing] = await db
    .select()
    .from(drawers)
    .where(and(eq(drawers.deviceId, deviceId), eq(drawers.name, name)));
  return existing;
}

export async function storeReading(deviceId, payload) {
  const drawer = await getOrCreateDrawer(deviceId, payload.drawerName);
  await db.insert(readings).values({ drawerId: drawer.id, ...readingFromPayload(payload) });
}

export async function drawersFor(deviceId, drawerName) {
  const where = drawerName
    ? and(eq(drawers.deviceId, deviceId), eq(drawers.name, normalizeDrawerName(drawerName)))
    : eq(drawers.deviceId, deviceId);
  return db.select().from(drawers).where(where);
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export async function latestReading(drawerIds) {
  if (drawerIds.length === 0) return null;
  const [row] = await db
    .select()
    .from(readings)
    .where(and(inArray(readings.drawerId, drawerIds), gte(readings.recordedAt, startOfToday())))
    .orderBy(desc(readings.recordedAt))
    .limit(1);
  return row ?? null;
}

export async function history(drawerList, from, to) {
  if (drawerList.length === 0) return [];
  const names = new Map(drawerList.map((d) => [d.id, d.name]));
  const rows = await db
    .select()
    .from(readings)
    .where(
      and(
        inArray(readings.drawerId, [...names.keys()]),
        gte(readings.recordedAt, from),
        lte(readings.recordedAt, to),
      ),
    )
    .orderBy(readings.recordedAt);

  const buckets = new Map();
  for (const row of rows) {
    const hour = new Date(Math.floor(row.recordedAt.getTime() / HOUR_MS) * HOUR_MS);
    const key = `${row.drawerId}|${hour.getTime()}`;
    if (!buckets.has(key)) buckets.set(key, { drawerId: names.get(row.drawerId), date: hour, readings: [] });
    buckets.get(key).readings.push(toReadingDto(row));
  }
  return [...buckets.values()];
}

export async function hourlyAverages(drawerIds, nowMs = Date.now()) {
  const since = new Date(nowMs - 24 * HOUR_MS);
  const currentHour = Math.floor(nowMs / HOUR_MS) * HOUR_MS;
  const slots = Array.from({ length: 24 }, (_, i) => currentHour - (23 - i) * HOUR_MS);

  const avg = (col) => sql`avg(${col})::float8`;
  const moistureExpr = sql`coalesce(${readings.moisture}, (select avg(v) from (values (${readings.leftSubstrate}), (${readings.centerSubstrate}), (${readings.rightSubstrate})) s(v)))`;
  const hourExpr = sql`(floor(extract(epoch from ${readings.recordedAt}) / 3600) * 3600000)::float8`;

  const rows = drawerIds.length
    ? await db
        .select({
          hourMs: hourExpr,
          temperature: avg(readings.temperature),
          humidity: avg(readings.humidity),
          moisture: sql`avg(${moistureExpr})::float8`,
          leftSubstrate: avg(readings.leftSubstrate),
          centerSubstrate: avg(readings.centerSubstrate),
          rightSubstrate: avg(readings.rightSubstrate),
          ammonia: avg(readings.ammonia),
        })
        .from(readings)
        .where(and(inArray(readings.drawerId, drawerIds), gte(readings.recordedAt, since)))
        .groupBy(hourExpr)
    : [];

  const byHour = new Map(rows.map((r) => [Number(r.hourMs), r]));
  const round = (v) => (v === null || v === undefined ? null : Math.round(v));
  return slots.map((hourMs) => {
    const r = byHour.get(hourMs) ?? {};
    return {
      hour: new Date(hourMs),
      temperature: r.temperature ?? null,
      humidity: r.humidity ?? null,
      moisture: round(r.moisture),
      leftSubstrate: round(r.leftSubstrate),
      centerSubstrate: round(r.centerSubstrate),
      rightSubstrate: round(r.rightSubstrate),
      ammonia: r.ammonia ?? null,
    };
  });
}
