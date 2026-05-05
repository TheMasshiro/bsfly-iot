import { clerkMiddleware, getAuth, requireAuth as clerkRequireAuth } from "@clerk/express";
import Device from "../models/User.Device.js";

export { clerkMiddleware };

export const requireAuth = (req, res, next) => {
  try {
    const auth = getAuth(req);
    
    if (!auth || !auth.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.userId = auth.userId;
    next();
  } catch (error) {
    console.error("Auth error:", error.message);
    return res.status(401).json({ error: "Authentication failed" });
  }
};

export const requireDeviceAuth = async (req, res, next) => {
  try {
    const apiKey = req.headers["x-api-key"];
    const macAddress = req.body?.macAddress || req.body?.deviceId;

    if (!macAddress) {
      return res.status(400).json({ error: "MAC address required" });
    }

    const device = await Device.findOne({ macAddress: macAddress.toUpperCase() });
    
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    if (apiKey && device.apiKey !== apiKey) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    req.device = device;
    req.body.macAddress = macAddress.toUpperCase();
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

    const device = await Device.findById(deviceId);
    
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
