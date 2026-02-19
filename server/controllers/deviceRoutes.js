import express from "express";
import Device from "../models/User.Device.js";
import Drawer from "../models/Sensor.Drawer.js";
import DrawerReading from "../models/Sensor.DrawerReadings.js";
import ActuatorState from "../models/ActuatorState.js";
import User from "../models/User.js";
import { deviceLimiter } from "../middleware/rateLimiter.js";
import { requireAuth } from "../middleware/auth.js";
import {
  validateBody,
  isValidMacAddress,
  isValidDeviceName,
  isValidJoinCode,
} from "../middleware/validation.js";

const router = express.Router();

const registerSchema = {
  macAddress: { required: true, type: "string", validator: isValidMacAddress, message: "Invalid MAC address format" },
  name: { required: true, type: "string", validator: isValidDeviceName, message: "Device name must be 1-50 characters" },
};

const joinSchema = {
  joinCode: { required: true, type: "string", validator: isValidJoinCode, message: "Join code must be 8 alphanumeric characters" },
};

router.post("/register", requireAuth, deviceLimiter, validateBody(registerSchema), async (req, res) => {
  try {
    const { macAddress, name } = req.body;
    const userId = req.userId;
    const normalizedMac = macAddress.toUpperCase();

    const existing = await Device.findOne({ macAddress: normalizedMac });
    if (existing) {
      return res.status(409).json({ error: "Device already registered" });
    }

    const device = new Device({
      macAddress: normalizedMac,
      name,
      ownerId: userId,
      members: [{ userId, role: "owner", joinedAt: new Date() }],
    });

    await device.save();

    await Drawer.deleteMany({ deviceId: device._id });

    const drawerNames = ["Drawer 1", "Drawer 2", "Drawer 3"];
    const drawers = await Drawer.insertMany(
      drawerNames.map((drawerName) => ({
        deviceId: device._id,
        name: drawerName,
      }))
    );

    device.drawers = drawers.map((d) => d._id);
    await device.save();

    await User.findByIdAndUpdate(userId, { $addToSet: { devices: device._id } });

    res.status(201).json({
      deviceId: device._id,
      macAddress: device.macAddress,
      name: device.name,
      joinCode: device.joinCode,
    });
  } catch (error) {
    console.error("Register device error:", error);
    res.status(500).json({ error: "Failed to register device" });
  }
});

router.post("/join", requireAuth, validateBody(joinSchema), async (req, res) => {
  try {
    const { joinCode } = req.body;
    const userId = req.userId;

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

    await User.findByIdAndUpdate(userId, { $addToSet: { devices: device._id } });

    res.json({
      message: "Successfully joined device",
      deviceId: device._id,
      macAddress: device.macAddress,
      name: device.name,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to join device" });
  }
});

router.get("/user/me", requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const devices = await Device.find({ "members.userId": userId });
    res.json(devices.map((d) => ({
      deviceId: d._id,
      macAddress: d.macAddress,
      name: d.name,
      status: d.status,
      lastSeen: d.lastSeen,
    })));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch devices" });
  }
});

router.get("/:deviceId", requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const device = await Device.findById(req.params.deviceId);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    const isMember = device.members.some((m) => m.userId === userId);
    if (!isMember) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({
      deviceId: device._id,
      macAddress: device.macAddress,
      name: device.name,
      status: device.status,
      lastSeen: device.lastSeen,
      joinCode: device.joinCode,
      ownerId: device.ownerId,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch device" });
  }
});

router.get("/:deviceId/members", requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const device = await Device.findById(req.params.deviceId);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    const isMember = device.members.some((m) => m.userId === userId);
    if (!isMember) {
      return res.status(403).json({ error: "Access denied" });
    }

    const memberIds = device.members.map((m) => m.userId);
    const users = await User.find({ _id: { $in: memberIds } });

    const membersWithInfo = device.members.map((member) => {
      const user = users.find((u) => u._id === member.userId);
      return {
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt,
        name: user?.name || "Unknown",
        email: user?.email || "",
      };
    });

    res.json(membersWithInfo);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

router.post("/:deviceId/regenerate-code", requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
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

router.delete("/:deviceId/leave", requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const device = await Device.findById(req.params.deviceId);

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    if (device.ownerId === userId) {
      const drawers = await Drawer.find({ deviceId: device._id });
      const drawerIds = drawers.map((d) => d._id);

      await DrawerReading.deleteMany({ drawerId: { $in: drawerIds } });
      await ActuatorState.deleteMany({ actuatorId: { $regex: `^${device._id}` } });
      await Drawer.deleteMany({ deviceId: device._id });
      await Device.findByIdAndDelete(req.params.deviceId);

      const memberIds = device.members.map((m) => m.userId);
      await User.updateMany({ _id: { $in: memberIds } }, { $pull: { devices: device._id } });

      return res.json({ message: "Device deleted" });
    }

    device.members = device.members.filter((m) => m.userId !== userId);
    await device.save();

    await User.findByIdAndUpdate(userId, { $pull: { devices: device._id } });

    res.json({ message: "Left device successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to leave device" });
  }
});

router.post("/:deviceId/heartbeat", async (req, res) => {
  try {
    const apiKey = req.headers["x-api-key"];
    const device = await Device.findById(req.params.deviceId);

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    if (!apiKey || device.apiKey !== apiKey) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    device.status = "online";
    device.lastSeen = new Date();
    await device.save();

    res.json({ status: "online", lastSeen: device.lastSeen });
  } catch (error) {
    res.status(500).json({ error: "Failed to update heartbeat" });
  }
});

router.get("/by-mac/:macAddress", async (req, res) => {
  try {
    const apiKey = req.headers["x-api-key"];
    const device = await Device.findOne({ macAddress: req.params.macAddress.toUpperCase() });

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    if (!apiKey || device.apiKey !== apiKey) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    res.json({ deviceId: device._id, macAddress: device.macAddress });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch device" });
  }
});

router.get("/:deviceId/api-key", requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const device = await Device.findById(req.params.deviceId);

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    if (device.ownerId !== userId) {
      return res.status(403).json({ error: "Only the owner can view the API key" });
    }

    res.json({ apiKey: device.apiKey });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch API key" });
  }
});

router.post("/:deviceId/regenerate-api-key", requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const device = await Device.findById(req.params.deviceId);

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    if (device.ownerId !== userId) {
      return res.status(403).json({ error: "Only the owner can regenerate the API key" });
    }

    await device.regenerateApiKey();
    res.json({ apiKey: device.apiKey });
  } catch (error) {
    res.status(500).json({ error: "Failed to regenerate API key" });
  }
});

router.patch("/:deviceId/members/:memberId/role", requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { deviceId, memberId } = req.params;
    const { role } = req.body;

    if (!role || !["owner", "member"].includes(role)) {
      return res.status(400).json({ error: "Invalid role. Must be 'owner' or 'member'" });
    }

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    if (device.ownerId !== userId) {
      return res.status(403).json({ error: "Only the owner can change member roles" });
    }

    const memberIndex = device.members.findIndex((m) => m.userId === memberId);
    if (memberIndex === -1) {
      return res.status(404).json({ error: "Member not found" });
    }

    if (role === "owner") {
      device.members = device.members.map((m) => ({
        ...m.toObject(),
        role: m.userId === memberId ? "owner" : "member",
      }));
      device.ownerId = memberId;
    } else {
      if (memberId === device.ownerId) {
        return res.status(400).json({ error: "Cannot demote the owner. Transfer ownership first." });
      }
      device.members[memberIndex].role = role;
    }

    await device.save();
    res.json({ message: "Member role updated", deviceId: device._id, macAddress: device.macAddress });
  } catch (error) {
    res.status(500).json({ error: "Failed to update member role" });
  }
});

router.delete("/:deviceId/members/:memberId", requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { deviceId, memberId } = req.params;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    if (device.ownerId !== userId) {
      return res.status(403).json({ error: "Only the owner can remove members" });
    }

    if (memberId === device.ownerId) {
      return res.status(400).json({ error: "Cannot remove the owner" });
    }

    const memberIndex = device.members.findIndex((m) => m.userId === memberId);
    if (memberIndex === -1) {
      return res.status(404).json({ error: "Member not found" });
    }

    device.members.splice(memberIndex, 1);
    await device.save();

    await User.findByIdAndUpdate(memberId, { $pull: { devices: device._id } });

    res.json({ message: "Member removed", deviceId: device._id, macAddress: device.macAddress });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove member" });
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
  } catch {}
}, 30000);

export default router;
