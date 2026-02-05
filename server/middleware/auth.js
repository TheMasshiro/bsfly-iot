import { clerkClient } from "@clerk/express";
import Device from "../models/User.Device.js";

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const { sub: userId } = await clerkClient.verifyToken(token);

    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.userId = userId;
    next();
  } catch (error) {
    console.error("Auth error:", error.message);
    return res.status(401).json({ error: "Authentication failed" });
  }
};

export const requireDeviceAuth = async (req, res, next) => {
  try {
    const apiKey = req.headers["x-api-key"];
    const deviceId = req.body?.deviceId || req.params?.deviceId;

    if (!apiKey) {
      return res.status(401).json({ error: "API key required" });
    }

    if (!deviceId) {
      return res.status(400).json({ error: "Device ID required" });
    }

    const device = await Device.findById(deviceId.toUpperCase());
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    if (device.apiKey !== apiKey) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    req.device = device;
    next();
  } catch (error) {
    console.error("Device auth error:", error.message);
    return res.status(401).json({ error: "Device authentication failed" });
  }
};

export const requireDeviceMembership = async (req, res, next) => {
  try {
    const userId = req.userId;
    const deviceId = req.params?.deviceId || req.body?.deviceId;

    if (!deviceId) {
      return res.status(400).json({ error: "Device ID required" });
    }

    const device = await Device.findById(deviceId.toUpperCase());
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    const isMember = device.members.some((m) => m.userId === userId);
    if (!isMember) {
      return res.status(403).json({ error: "Access denied - not a device member" });
    }

    req.device = device;
    next();
  } catch (error) {
    console.error("Membership check error:", error.message);
    return res.status(403).json({ error: "Access verification failed" });
  }
};
