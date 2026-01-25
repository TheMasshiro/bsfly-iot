import express from "express";
import Device from "../models/User.Device.js";

const router = express.Router();

// Register a new device (owner)
router.post("/register", async (req, res) => {
  try {
    const { deviceId, name, userId } = req.body;
    
    if (!deviceId || !name || !userId) {
      return res.status(400).json({ error: "deviceId, name, and userId are required" });
    }

    // Check if device already exists
    const existing = await Device.findById(deviceId);
    if (existing) {
      return res.status(409).json({ error: "Device already registered" });
    }

    const device = new Device({
      _id: deviceId,
      name,
      ownerId: userId,
      members: [{ userId, role: "owner", joinedAt: new Date() }]
    });

    await device.save();
    res.status(201).json(device);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Join a device using join code
router.post("/join", async (req, res) => {
  try {
    const { joinCode, userId } = req.body;
    
    if (!joinCode || !userId) {
      return res.status(400).json({ error: "joinCode and userId are required" });
    }

    const device = await Device.findOne({ joinCode: joinCode.toUpperCase() });
    if (!device) {
      return res.status(404).json({ error: "Invalid join code" });
    }

    // Check if user is already a member
    const isMember = device.members.some(m => m.userId === userId);
    if (isMember) {
      return res.status(409).json({ error: "Already a member of this device" });
    }

    device.members.push({ userId, role: "member", joinedAt: new Date() });
    await device.save();

    res.json({ message: "Successfully joined device", device });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all devices for a user
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    const devices = await Device.find({ "members.userId": userId });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific device
router.get("/:deviceId", async (req, res) => {
  try {
    const device = await Device.findById(req.params.deviceId);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all members of a device
router.get("/:deviceId/members", async (req, res) => {
  try {
    const device = await Device.findById(req.params.deviceId);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    res.json(device.members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Regenerate join code (owner only)
router.post("/:deviceId/regenerate-code", async (req, res) => {
  try {
    const { userId } = req.body;
    const device = await Device.findById(req.params.deviceId);
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    if (device.ownerId !== userId) {
      return res.status(403).json({ error: "Only the owner can regenerate the join code" });
    }

    await device.regenerateJoinCode();
    res.json({ joinCode: device.joinCode });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Leave a device (member) or delete device (owner)
router.delete("/:deviceId/leave", async (req, res) => {
  try {
    const { userId } = req.body;
    const device = await Device.findById(req.params.deviceId);
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    // If owner, delete the entire device
    if (device.ownerId === userId) {
      await Device.findByIdAndDelete(req.params.deviceId);
      return res.json({ message: "Device deleted" });
    }

    // Otherwise, remove user from members
    device.members = device.members.filter(m => m.userId !== userId);
    await device.save();
    res.json({ message: "Left device successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update device status (for ESP32 heartbeat)
router.post("/:deviceId/heartbeat", async (req, res) => {
  try {
    const device = await Device.findByIdAndUpdate(
      req.params.deviceId,
      { status: "online", lastSeen: new Date() },
      { new: true }
    );
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    
    res.json({ status: "online", lastSeen: device.lastSeen });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
