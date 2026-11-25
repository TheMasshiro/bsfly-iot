import express from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { deviceMembers, drawers, readings } from "../db/schema.js";
import { requireAuth, requireDeviceKey, requireMembership } from "../middleware/auth.js";
import { sensorLimiter } from "../middleware/rateLimiter.js";
import { isValidAmmonia, isValidHumidity, isValidMoisture, isValidTemperature } from "../middleware/validation.js";
import { touchDevice } from "../services/devices.js";
import {
  drawersFor,
  getOrCreateDrawer,
  history,
  hourlyAverages,
  latestReading,
  readingFromPayload,
  toReadingDto,
} from "../services/readings.js";

const router = express.Router();

const RULES = {
  temperature: isValidTemperature,
  humidity: isValidHumidity,
  moisture: isValidMoisture,
  leftSubstrate: isValidMoisture,
  centerSubstrate: isValidMoisture,
  rightSubstrate: isValidMoisture,
  ammonia: isValidAmmonia,
};

router.post("/", requireDeviceKey, sensorLimiter, async (req, res) => {
  const reading = readingFromPayload(req.body);
  const invalid = Object.entries(RULES).find(([key, ok]) => reading[key] !== undefined && !ok(reading[key]));
  if (invalid) return res.status(400).json({ error: `Invalid ${invalid[0]} value` });

  const drawer = await getOrCreateDrawer(req.device.id, req.body.drawerName);
  await db.insert(readings).values({ drawerId: drawer.id, ...reading });
  await touchDevice(req.device.id);
  res.status(201).json({ success: true });
});

router.get("/device/:deviceId", requireAuth, requireMembership, async (req, res) => {
  const list = await drawersFor(req.device.id, req.query.drawer);
  res.json(toReadingDto(await latestReading(list.map((d) => d.id))));
});

router.get("/device/:deviceId/hourly", requireAuth, requireMembership, async (req, res) => {
  const list = await drawersFor(req.device.id, req.query.drawer);
  res.json(await hourlyAverages(list.map((d) => d.id)));
});

router.get("/device/:deviceId/history", requireAuth, requireMembership, async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 7 * 86_400_000);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return res.status(400).json({ error: "Invalid date range" });
  }
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  res.json(await history(await drawersFor(req.device.id), from, to));
});

router.get("/drawer/:drawerId", requireAuth, async (req, res) => {
  const [drawer] = await db
    .select({ id: drawers.id })
    .from(drawers)
    .innerJoin(deviceMembers, eq(deviceMembers.deviceId, drawers.deviceId))
    .where(and(eq(drawers.id, req.params.drawerId), eq(deviceMembers.userId, req.userId)));
  if (!drawer) return res.status(404).json({ error: "Drawer not found" });

  res.json(toReadingDto(await latestReading([drawer.id])));
});

export default router;
