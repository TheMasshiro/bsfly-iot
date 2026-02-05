import express from "express";
import ActuatorState from "../models/ActuatorState.js";
import Device from "../models/User.Device.js";
import { isValidActuatorState } from "../middleware/validation.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Extract deviceId from actuatorId (format: deviceId:actuatorType or deviceId:drawer:actuatorType)
const getDeviceIdFromActuatorId = (actuatorId) => {
  if (!actuatorId || typeof actuatorId !== "string") return null;
  const parts = actuatorId.split(":");
  return parts[0] || null;
};

// Verify user is a member of the device that owns the actuator
const verifyActuatorAccess = async (userId, actuatorId) => {
  const deviceId = getDeviceIdFromActuatorId(actuatorId);
  if (!deviceId) return false;
  
  const device = await Device.findById(deviceId.toUpperCase());
  if (!device) return false;
  
  return device.members.some((m) => m.userId === userId);
};

// ESP32 GET endpoint - requires device API key header
router.get("/:actuatorId", async (req, res) => {
  try {
    const { actuatorId } = req.params;
    const apiKey = req.headers["x-api-key"];
    
    const deviceId = getDeviceIdFromActuatorId(actuatorId);
    if (!deviceId) {
      return res.status(400).json({ error: "Invalid actuator ID format" });
    }
    
    // Verify device API key
    const device = await Device.findById(deviceId.toUpperCase());
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    if (!apiKey || device.apiKey !== apiKey) {
      return res.status(401).json({ error: "Invalid API key" });
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

// Frontend POST endpoint - requires user auth
router.post("/:actuatorId", requireAuth, async (req, res) => {
  try {
    const { actuatorId } = req.params;
    const { state } = req.body;
    const userId = req.userId;

    if (state === undefined || state === null) {
      return res.status(400).json({ error: "state is required" });
    }
    if (!isValidActuatorState(state)) {
      return res.status(400).json({ error: "state must be a boolean or object" });
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

// ESP32 polling endpoint - requires device API key header
router.get("/poll/since/:timestamp", async (req, res) => {
  try {
    const { timestamp } = req.params;
    const apiKey = req.headers["x-api-key"];
    const deviceId = req.query.deviceId;
    
    if (!deviceId) {
      return res.status(400).json({ error: "deviceId query parameter required" });
    }
    
    // Verify device API key
    const device = await Device.findById(deviceId.toUpperCase());
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
    
    // Only return actuator states for this device
    const states = await ActuatorState.find({
      actuatorId: { $regex: `^${deviceId.toUpperCase()}:` },
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

// Frontend endpoint to get all actuator states for user's devices
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    
    // Get all devices the user is a member of
    const devices = await Device.find({ "members.userId": userId });
    
    if (devices.length === 0) {
      return res.json({});
    }
    
    // Build regex pattern for all user's devices
    const devicePatterns = devices.map(d => `^${d._id}:`);
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

export default router;
