import express from "express";
import ActuatorState from "../models/ActuatorState.js";
import { isValidActuatorState } from "../middleware/validation.js";

const router = express.Router();

// Get all actuator states (for polling)
router.get("/", async (_req, res) => {
  try {
    const states = await ActuatorState.find({});
    const stateMap = {};
    states.forEach((s) => {
      stateMap[s.actuatorId] = s.state;
    });
    res.json(stateMap);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch actuator states" });
  }
});

// Get specific actuator state
router.get("/:actuatorId", async (req, res) => {
  try {
    const { actuatorId } = req.params;
    const state = await ActuatorState.findOne({ actuatorId });
    if (!state) {
      return res.json({ actuatorId, state: null });
    }
    res.json({ actuatorId, state: state.state });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch actuator state" });
  }
});

// Set actuator state
router.post("/:actuatorId", async (req, res) => {
  try {
    const { actuatorId } = req.params;
    const { state } = req.body;

    // Validate state input
    if (state === undefined || state === null) {
      return res.status(400).json({ error: "state is required" });
    }
    if (!isValidActuatorState(state)) {
      return res.status(400).json({ error: "state must be a boolean or object" });
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

// Get states updated since timestamp (for efficient polling)
router.get("/poll/since/:timestamp", async (req, res) => {
  try {
    const { timestamp } = req.params;
    const since = new Date(parseInt(timestamp));

    if (isNaN(since.getTime())) {
      return res.status(400).json({ error: "Invalid timestamp" });
    }
    
    const states = await ActuatorState.find({
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

export default router;
