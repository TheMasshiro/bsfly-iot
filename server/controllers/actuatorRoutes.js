import express from "express";
import ActuatorState from "../models/ActuatorState.js";
import Device from "../models/User.Device.js";
import { isValidActuatorState } from "../middleware/validation.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const getDeviceIdFromActuatorId = (actuatorId) => {
  if (!actuatorId || typeof actuatorId !== "string") return null;
  const parts = actuatorId.split(":");
  if (parts.length < 2) return null;
  return parts[0];
};

const verifyActuatorAccess = async (userId, actuatorId) => {
  const deviceId = getDeviceIdFromActuatorId(actuatorId);
  if (!deviceId) return false;

  const device = await Device.findById(deviceId);
  if (!device) return false;

  return device.members.some((m) => m.userId === userId);
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

    const stateMap = {};
    states.forEach((s) => {
      stateMap[s.actuatorId] = s.state;
    });

    res.json(stateMap);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch actuator states" });
  }
});

router.get("/poll/since/:timestamp", async (req, res) => {
  try {
    const { timestamp } = req.params;
    const apiKey = req.headers["x-api-key"];
    const macAddress = req.query.macAddress;

    if (!macAddress) {
      return res
        .status(400)
        .json({ error: "macAddress query parameter required" });
    }

    const device = await Device.findOne({
      macAddress: macAddress.toUpperCase(),
    });
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    if (!apiKey || device.apiKey !== apiKey) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    const since = new Date(parseInt(timestamp));

    if (isNaN(since.getTime())) {
      return res.status(400).json({ error: "Invalid timestamp" });
    }

    const states = await ActuatorState.find({
      actuatorId: { $regex: `^${device._id}:` },
      updatedAt: { $gt: since },
    });

    const stateMap = {};
    states.forEach((s) => {
      stateMap[s.actuatorId] = s.state;
    });

    res.json({
      states: stateMap,
      serverTime: Date.now(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to poll actuator states" });
  }
});

router.get("/:actuatorId", async (req, res) => {
  try {
    const { actuatorId } = req.params;
    const apiKey = req.headers["x-api-key"];
    const authHeader = req.headers.authorization;

    const deviceId = getDeviceIdFromActuatorId(actuatorId);
    if (!deviceId) {
      return res.status(400).json({ error: "Invalid actuator ID format" });
    }

    const device = await Device.findById(deviceId);
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
    } else {
      return res.status(401).json({ error: "Authentication required" });
    }

    const state = await ActuatorState.findOne({ actuatorId });
    if (!state) {
      return res.json({ actuatorId, state: null });
    }
    res.json({ actuatorId, state: state.state });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch actuator state" });
  }
});

router.post("/:actuatorId", requireAuth, async (req, res) => {
  try {
    const { actuatorId } = req.params;
    const { state } = req.body;
    const userId = req.userId;

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

    const updated = await ActuatorState.findOneAndUpdate(
      { actuatorId },
      { actuatorId, state, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({ actuatorId, state: updated.state });
  } catch (error) {
    res.status(500).json({ error: "Failed to update actuator state" });
  }
});

export default router;
