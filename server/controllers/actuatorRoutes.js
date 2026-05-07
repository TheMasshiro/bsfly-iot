import express from "express";
import ActuatorState from "../models/ActuatorState.js";
import Device from "../models/User.Device.js";
import { publishMqtt } from "../mqttClient.js";
import { isValidActuatorState } from "../middleware/validation.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

export const getDeviceIdFromActuatorId = (actuatorId) => {
  if (!actuatorId || typeof actuatorId !== "string") return null;
  const parts = actuatorId.split(":");
  if (parts.length < 2) return null;
  if (parts.length >= 7 && parts[5].length === 2) {
    return parts.slice(0, 6).join(":");
  }
  return parts[0];
};

const findDeviceByIdOrMac = async (deviceId) => {
  if (deviceId.includes(":")) {
    return Device.findOne({ macAddress: deviceId.toUpperCase() });
  }
  const device = await Device.findById(deviceId).catch(() => null);
  if (device) return device;
  return Device.findOne({ macAddress: deviceId.toUpperCase() });
};

const verifyActuatorAccess = async (userId, actuatorId) => {
  const deviceId = getDeviceIdFromActuatorId(actuatorId);
  if (!deviceId) return false;

  const device = await findDeviceByIdOrMac(deviceId);
  if (!device) return false;

  return device.members.some((m) => m.userId === userId);
};

export const normalizeActuatorId = (actuatorId) => {
  if (!actuatorId || typeof actuatorId !== "string") return actuatorId;
  if (actuatorId.endsWith(":dehumidifier1")) {
    return actuatorId.replace(/:dehumidifier1$/, ":fan1");
  }
  if (actuatorId.endsWith(":dehumidifier3")) {
    return actuatorId.replace(/:dehumidifier3$/, ":fan3");
  }
  if (actuatorId.endsWith(":dehumidifier")) {
    if (actuatorId.includes(":drawer2:")) {
      return actuatorId.replace(/:dehumidifier$/, ":fan3");
    }
    return actuatorId.replace(/:dehumidifier$/, ":fan1");
  }
  if (actuatorId.endsWith(":pump")) {
    return actuatorId.replace(/:pump$/, ":substrate");
  }
  return actuatorId;
};

export const getLegacyActuatorId = (actuatorId) => {
  if (!actuatorId || typeof actuatorId !== "string") return null;
  if (actuatorId.endsWith(":substrate")) {
    return actuatorId.replace(/:substrate$/, ":pump");
  }
  return null;
};

const resolveStoredActuatorState = async (actuatorId) => {
  const normalizedActuatorId = normalizeActuatorId(actuatorId);
  const candidateIds = [normalizedActuatorId];
  const legacyActuatorId = getLegacyActuatorId(normalizedActuatorId);

  if (legacyActuatorId && legacyActuatorId !== normalizedActuatorId) {
    candidateIds.push(legacyActuatorId);
  }

  for (const candidateId of candidateIds) {
    const state = await ActuatorState.findOne({ actuatorId: candidateId });
    if (state) {
      return { actuatorId: candidateId, state };
    }
  }

  return null;
};

const isLifecycleActuatorId = (actuatorId) => {
  if (!actuatorId || typeof actuatorId !== "string") return false;
  return actuatorId.endsWith(":lifecycle");
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const MAX_LIGHT_SECONDS = 8 * 3600;

const normalizeLightSeconds = (state, nowMs = Date.now()) => {
  if (typeof state === "number") {
    return clamp(Math.round(state), 0, MAX_LIGHT_SECONDS);
  }

  if (typeof state === "boolean") {
    return state ? MAX_LIGHT_SECONDS : 0;
  }

  if (typeof state === "object" && state !== null) {
    const seconds = Number(state.time);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return 0;
    }

    const startTimeMs = Number(state.startTime);
    if (Number.isFinite(startTimeMs) && startTimeMs > 0) {
      const endTimeMs = startTimeMs + seconds * 1000;
      const remaining = Math.ceil((endTimeMs - nowMs) / 1000);
      return clamp(remaining, 0, MAX_LIGHT_SECONDS);
    }

    return clamp(Math.round(seconds), 0, MAX_LIGHT_SECONDS);
  }

  return 0;
};

const getRemainingLightSeconds = (stateDoc, nowMs = Date.now()) => {
  const stored = stateDoc?.state;

  if (typeof stored === "number") {
    const total = clamp(Math.round(stored), 0, MAX_LIGHT_SECONDS);
    if (total <= 0) {
      return 0;
    }

    const updatedAtMs = new Date(stateDoc.updatedAt).getTime();
    if (!Number.isFinite(updatedAtMs) || updatedAtMs <= 0) {
      return total;
    }

    const elapsedSeconds = Math.max(0, Math.floor((nowMs - updatedAtMs) / 1000));
    return clamp(total - elapsedSeconds, 0, MAX_LIGHT_SECONDS);
  }

  return normalizeLightSeconds(stored, nowMs);
};

const syncLightStateOnRead = async (stateDoc, nowMs = Date.now()) => {
  const remaining = getRemainingLightSeconds(stateDoc, nowMs);
  const stored = Number(stateDoc?.state);

  if (Number.isFinite(stored) && Math.round(stored) !== remaining) {
    await ActuatorState.updateOne(
      { _id: stateDoc._id },
      { state: remaining, updatedAt: new Date(nowMs) }
    );
  }

  return remaining;
};

router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    const devices = await Device.find({ "members.userId": userId });

    if (devices.length === 0) {
      return res.json({});
    }

    const devicePatterns = devices.map((d) => `^${d._id}:`);
    const pattern = devicePatterns.join("|");

    const states = await ActuatorState.find({
      actuatorId: { $regex: pattern },
    });

    const nowMs = Date.now();
    const stateMap = {};

    for (const s of states) {
      const normalizedId = normalizeActuatorId(s.actuatorId);
      if (isLifecycleActuatorId(normalizedId)) {
        continue;
      }
      if (normalizedId !== s.actuatorId && stateMap[normalizedId] !== undefined) {
        continue;
      }

      if (normalizedId.endsWith(":light")) {
        stateMap[normalizedId] = await syncLightStateOnRead(s, nowMs);
      } else {
        stateMap[normalizedId] = s.state;
      }
    }

    res.json(stateMap);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch actuator states" });
  }
});

router.get("/:actuatorId", async (req, res) => {
  try {
    const actuatorId = normalizeActuatorId(req.params.actuatorId);
    if (isLifecycleActuatorId(actuatorId)) {
      return res.status(400).json({ error: "Lifecycle actuators are not supported" });
    }
    const apiKey = req.headers["x-api-key"];
    const authHeader = req.headers.authorization;

    const deviceId = getDeviceIdFromActuatorId(actuatorId);
    if (!deviceId) {
      return res.status(400).json({ error: "Invalid actuator ID format" });
    }

    const device = await findDeviceByIdOrMac(deviceId);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    if (apiKey) {
      if (device.apiKey !== apiKey) {
        return res.status(401).json({ error: "Invalid API key" });
      }
    } else if (authHeader && authHeader.startsWith("Bearer ")) {
      const { getAuth } = await import("@clerk/express");
      const auth = getAuth(req);
      if (!auth || !auth.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const hasAccess = device.members.some((m) => m.userId === auth.userId);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    const actuatorSuffix = actuatorId.replace(deviceId, "");
    const normalizedActuatorId = `${device._id}${actuatorSuffix}`;

    const storedState = await resolveStoredActuatorState(normalizedActuatorId);
    if (!storedState) {
      return res.json({ actuatorId, state: null });
    }

    const responseState = actuatorId.endsWith(":light")
      ? await syncLightStateOnRead(storedState.state)
      : storedState.state.state;

    res.json({ actuatorId, state: responseState });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch actuator state" });
  }
});

const MUTUALLY_EXCLUSIVE = {
  fan: ["heater", "humidifier"],
  heater: ["fan"],
  humidifier: ["fan"],
};

const getActuatorDrawerSuffix = (actuatorType) => {
  if (typeof actuatorType !== "string") return "";
  const match = actuatorType.match(/(\d+)$/);
  return match ? match[1] : "";
};

export const buildExclusiveActuatorIds = (deviceId, actuatorType) => {
  if (!deviceId || typeof actuatorType !== "string") return [];

  const drawerSuffix = getActuatorDrawerSuffix(actuatorType);
  const fanId = drawerSuffix ? `${deviceId}:fan${drawerSuffix}` : null;
  const humidifierId = drawerSuffix ? `${deviceId}:humidifier${drawerSuffix}` : null;

  if (actuatorType === "heater") {
    return [`${deviceId}:fan1`, `${deviceId}:fan3`];
  }

  if (actuatorType === "humidifier") {
    return [`${deviceId}:fan1`, `${deviceId}:fan3`];
  }

  if (actuatorType.startsWith("fan")) {
    const exclusions = [`${deviceId}:heater`];
    if (humidifierId) {
      exclusions.push(humidifierId);
    } else {
      exclusions.push(`${deviceId}:humidifier1`, `${deviceId}:humidifier3`);
    }
    return exclusions;
  }

  if (actuatorType.startsWith("humidifier")) {
    if (fanId) {
      return [fanId];
    }
    return [`${deviceId}:fan1`, `${deviceId}:fan3`];
  }

  if (MUTUALLY_EXCLUSIVE[actuatorType]) {
    return MUTUALLY_EXCLUSIVE[actuatorType].map((type) => `${deviceId}:${type}`);
  }

  return [];
};

router.post("/:actuatorId", requireAuth, async (req, res) => {
  try {
    const actuatorId = normalizeActuatorId(req.params.actuatorId);
    if (isLifecycleActuatorId(actuatorId)) {
      return res.status(400).json({ error: "Lifecycle actuators are not supported" });
    }
    const { state } = req.body;
    const userId = req.userId;
    const parts = actuatorId.split(":");
    const actuatorType = parts[parts.length - 1];

    if (state === undefined || state === null) {
      return res.status(400).json({ error: "state is required" });
    }
    if (!isValidActuatorState(state)) {
      return res
        .status(400)
        .json({ error: "state must be a boolean or object" });
    }

    const hasAccess = await verifyActuatorAccess(userId, actuatorId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    const deviceIdStr = getDeviceIdFromActuatorId(actuatorId);
    const device = await findDeviceByIdOrMac(deviceIdStr);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    if (device.status === "online" && device.controlMode !== "manual") {
      return res.status(409).json({
        error: "Manual actuator control is disabled while device is in AUTO mode",
        controlMode: device.controlMode,
      });
    }

    const storedState =
      actuatorType === "light" ? normalizeLightSeconds(state) : state;

    const storedActuatorId = normalizeActuatorId(actuatorId);

    const updated = await ActuatorState.findOneAndUpdate(
      { actuatorId: storedActuatorId },
      { actuatorId: storedActuatorId, state: storedState, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    try {
      const topic = `devices/${device.macAddress}/actuators/${actuatorType}/control`;

      let publishState = state;
      if (actuatorType === "light" && typeof state === "number") {
        publishState = {
          time: clamp(Math.round(state), 0, MAX_LIGHT_SECONDS),
          startTime: Date.now(),
        };
      }

      publishMqtt(topic, { state: publishState });
    } catch (e) {
      console.error("Failed to publish MQTT actuator update", e);
    }

    if (state === true) {
      const exclusions = buildExclusiveActuatorIds(device._id, actuatorType);
      for (const excludeId of exclusions) {
        await ActuatorState.findOneAndUpdate(
          { actuatorId: excludeId },
          { actuatorId: excludeId, state: false, updatedAt: new Date() },
          { upsert: true }
        );

        const excludedActuatorType = excludeId.split(":").pop();
        if (excludedActuatorType) {
          const exclusionTopic = `devices/${device.macAddress}/actuators/${excludedActuatorType}/control`;
          publishMqtt(exclusionTopic, { state: false });
        }
      }
    }

    res.json({ actuatorId: storedActuatorId, state: updated.state });
  } catch (error) {
    res.status(500).json({ error: "Failed to update actuator state" });
  }
});

export default router;
