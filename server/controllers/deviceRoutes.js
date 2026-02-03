import express from "express";
import Device from "../models/User.Device.js";
import Drawer from "../models/Sensor.Drawer.js";
import DrawerReading from "../models/Sensor.DrawerReadings.js";
import ActuatorState from "../models/ActuatorState.js";
import { deviceLimiter } from "../middleware/rateLimiter.js";
import {
  validateBody,
  isValidMacAddress,
  isValidDeviceName,
  isValidJoinCode,
  isValidUserId,
} from "../middleware/validation.js";

const router = express.Router();

const registerSchema = {
  deviceId: { required: true, type: "string", validator: isValidMacAddress, message: "Invalid MAC address format" },
  name: { required: true, type: "string", validator: isValidDeviceName, message: "Device name must be 1-50 characters" },
  userId: { required: true, type: "string", validator: isValidUserId, message: "Invalid user ID" },
};

const joinSchema = {
  joinCode: { required: true, type: "string", validator: isValidJoinCode, message: "Join code must be 8 alphanumeric characters" },
  userId: { required: true, type: "string", validator: isValidUserId, message: "Invalid user ID" },
};

const userIdSchema = {
  userId: { required: true, type: "string", validator: isValidUserId, message: "Invalid user ID" },
};

router.post("/register", deviceLimiter, validateBody(registerSchema), async (req, res) => {
  try {
    const { deviceId, name, userId } = req.body;
    const normalizedId = deviceId.toUpperCase();

    const existing = await Device.findById(normalizedId);
    if (existing) {
      return res.status(409).json({ error: "Device already registered" });
    }

    // Clean up any orphan drawers from previous failed attempts
    await Drawer.deleteMany({ deviceId: normalizedId });

    const device = new Device({
      _id: normalizedId,
      name,
      ownerId: userId,
      members: [{ userId, role: "owner", joinedAt: new Date() }],
    });

    await device.save();

    const drawerNames = ["Drawer 1", "Drawer 2", "Drawer 3"];
    const drawers = await Drawer.insertMany(
      drawerNames.map((drawerName) => ({
        deviceId: device._id,
        name: drawerName,
      }))
    );

    device.drawers = drawers.map((d) => d._id);
    await device.save();

    res.status(201).json(device);
  } catch (error) {
    console.error("Register device error:", error);
    res.status(500).json({ error: "Failed to register device" });
  }
});

router.post("/join", validateBody(joinSchema), async (req, res) => {
  try {
    const { joinCode, userId } = req.body;

    const device = await Device.findOne({ joinCode: joinCode.toUpperCase() });
    if (!device) {
      return res.status(404).json({ error: "Invalid join code" });
    }

    const isMember = device.members.some((m) => m.userId === userId);
    if (isMember) {
      return res.status(409).json({ error: "Already a member of this device" });
    }

    device.members.push({ userId, role: "member", joinedAt: new Date() });
    await device.save();

    res.json({ message: "Successfully joined device", device });
  } catch (error) {
    res.status(500).json({ error: "Failed to join device" });
  }
});

router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const devices = await Device.find({ "members.userId": userId });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch devices" });
  }
});

router.get("/:deviceId", async (req, res) => {
  try {
    const device = await Device.findById(req.params.deviceId);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch device" });
  }
});

router.get("/:deviceId/members", async (req, res) => {
  try {
    const device = await Device.findById(req.params.deviceId);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    res.json(device.members);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

router.post("/:deviceId/regenerate-code", validateBody(userIdSchema), async (req, res) => {
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
    res.status(500).json({ error: "Failed to regenerate code" });
  }
});

router.delete("/:deviceId/leave", validateBody(userIdSchema), async (req, res) => {
  try {
    const { userId } = req.body;
    const device = await Device.findById(req.params.deviceId);

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    if (device.ownerId === userId) {
      // Cascade delete: drawers, readings, actuator states, then device
      const drawers = await Drawer.find({ deviceId: device._id });
      const drawerIds = drawers.map((d) => d._id);

      await DrawerReading.deleteMany({ drawerId: { $in: drawerIds } });
      await ActuatorState.deleteMany({ actuatorId: { $regex: `^${device._id}` } });
      await Drawer.deleteMany({ deviceId: device._id });
      await Device.findByIdAndDelete(req.params.deviceId);

      return res.json({ message: "Device deleted" });
    }

    device.members = device.members.filter((m) => m.userId !== userId);
    await device.save();
    res.json({ message: "Left device successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to leave device" });
  }
});

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
    res.status(500).json({ error: "Failed to update heartbeat" });
  }
});

const HEARTBEAT_TIMEOUT = 90000;
setInterval(async () => {
  try {
    const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT);
    await Device.updateMany(
      { lastSeen: { $lt: cutoff }, status: "online" },
      { status: "offline" }
    );
  } catch {
  }
}, 30000);

export default router;
