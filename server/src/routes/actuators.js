import express from "express";
import { isValidActuatorState } from "../middleware/validation.js";
import { requireAuth } from "../middleware/auth.js";
import { lightSecondsRemaining, parseActuatorId, toLightTimer } from "../services/actuators.js";
import { getState, saveState, statesFor } from "../services/actuatorStore.js";
import { apiKeyMatches, devicesForUser, findDevice, isMember, isOnline } from "../services/devices.js";
import { publishMqtt } from "../services/mqtt.js";

const router = express.Router();

const readState = (row) => (row.actuator === "light" ? lightSecondsRemaining(row.state) : row.state);

async function resolve(req, res) {
  const parsed = parseActuatorId(req.params.actuatorId);
  if (!parsed) {
    res.status(400).json({ error: "Invalid actuator ID format" });
    return null;
  }
  if (parsed.actuator === "lifecycle") {
    res.status(400).json({ error: "Lifecycle actuators are not supported" });
    return null;
  }

  const device = await findDevice(parsed.deviceRef);
  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return null;
  }
  return { device, actuator: parsed.actuator };
}

router.get("/", requireAuth, async (req, res) => {
  const list = await devicesForUser(req.userId);
  const rows = await statesFor(list.map((d) => d.id));
  const map = {};
  for (const row of rows) {
    if (row.actuator !== "lifecycle") map[`${row.deviceId}:${row.actuator}`] = readState(row);
  }
  res.json(map);
});

router.get("/:actuatorId", async (req, res) => {
  const target = await resolve(req, res);
  if (!target) return;
  const { device, actuator } = target;

  const byKey = apiKeyMatches(device, req.headers["x-api-key"]);
  if (!byKey) {
    if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await isMember(device.id, req.userId))) return res.status(403).json({ error: "Access denied" });
  }

  const row = await getState(device.id, actuator);
  res.json({ actuatorId: `${device.id}:${actuator}`, state: row ? readState(row) : null });
});

router.post("/:actuatorId", requireAuth, async (req, res) => {
  const target = await resolve(req, res);
  if (!target) return;
  const { device, actuator } = target;
  const { state } = req.body ?? {};

  if (state === undefined || state === null) return res.status(400).json({ error: "state is required" });
  if (!isValidActuatorState(state) && !(actuator === "light" && typeof state === "number")) {
    return res.status(400).json({ error: "state must be a boolean, number or object" });
  }
  if (!(await isMember(device.id, req.userId))) return res.status(403).json({ error: "Access denied" });

  if (actuator !== "light" && isOnline(device) && device.controlMode !== "manual") {
    return res.status(409).json({
      error: "Manual actuator control is disabled while device is in AUTO mode",
      controlMode: device.controlMode,
    });
  }

  const stored = actuator === "light" ? toLightTimer(state) : state;
  await saveState(device.id, actuator, stored);
  publishMqtt(`devices/${device.macAddress}/actuators/${actuator}/control`, { state: stored });

  res.json({ actuatorId: `${device.id}:${actuator}`, state: stored });
});

export default router;
