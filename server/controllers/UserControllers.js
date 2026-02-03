import express from "express";
import User from "../models/User.js";
import Device from "../models/User.Device.js";
import { validateBody, isValidUserId } from "../middleware/validation.js";
import validator from "validator";

const router = express.Router();

// Validation helpers
const isValidEmail = (email) => validator.isEmail(email);
const isValidName = (name) => typeof name === "string" && name.trim().length >= 1 && name.length <= 100;

// Validation schemas
const createUserSchema = {
  userId: { required: true, type: "string", validator: isValidUserId, message: "Invalid user ID" },
  name: { required: true, type: "string", validator: isValidName, message: "Name must be 1-100 characters" },
  email: { required: true, type: "string", validator: isValidEmail, message: "Invalid email address" },
};

const updateUserSchema = {
  name: { required: false, type: "string", validator: isValidName, message: "Name must be 1-100 characters" },
  email: { required: false, type: "string", validator: isValidEmail, message: "Invalid email address" },
};

// Create or update user (for Clerk webhook or first login)
router.post("/", validateBody(createUserSchema), async (req, res) => {
  try {
    const { userId, name, email } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { _id: userId, name, email },
      { upsert: true, new: true }
    );

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Get user by ID
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Update user
router.put("/:userId", validateBody(updateUserSchema), async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email } = req.body;

    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const user = await User.findByIdAndUpdate(userId, updateData, { new: true });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Delete user and remove from all devices
router.delete("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // Remove user from all devices they're a member of
    await Device.updateMany(
      { "members.userId": userId },
      { $pull: { members: { userId } } }
    );

    // Delete devices owned by this user
    await Device.deleteMany({ ownerId: userId });

    // Delete the user
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// Get user's devices summary
router.get("/:userId/devices", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const devices = await Device.find({ "members.userId": userId });
    
    const summary = {
      total: devices.length,
      owned: devices.filter(d => d.ownerId === userId).length,
      member: devices.filter(d => d.ownerId !== userId).length,
      online: devices.filter(d => d.status === "online").length,
      offline: devices.filter(d => d.status === "offline").length,
    };

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user devices" });
  }
});

export default router;
