import express from "express";
import ActuatorState from "../models/ActuatorState.js";

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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// Set actuator state
router.post("/:actuatorId", async (req, res) => {
  try {
    const { actuatorId } = req.params;
    const { state } = req.body;

    const updated = await ActuatorState.findOneAndUpdate(
      { actuatorId },
      { actuatorId, state, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    console.log(`Actuator ${actuatorId}:`, state);
    res.json({ actuatorId, state: updated.state });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get states updated since timestamp (for efficient polling)
router.get("/poll/since/:timestamp", async (req, res) => {
  try {
    const { timestamp } = req.params;
    const since = new Date(parseInt(timestamp));
    
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
    res.status(500).json({ error: error.message });
  }
});

export default router;
