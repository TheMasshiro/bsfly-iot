import { clerkMiddleware, getAuth } from "@clerk/express";
import { apiKeyMatches, findDevice, isMember, normalizeMac } from "../services/devices.js";

export function clerkIdentity() {
  const clerk = clerkMiddleware();
  return (req, res, next) =>
    clerk(req, res, (err) => {
      if (err) return next(err);
      try {
        req.userId = getAuth(req)?.userId ?? null;
      } catch {
        req.userId = null;
      }
      next();
    });
}

export function requireAuth(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

export async function requireDeviceKey(req, res, next) {
  try {
    const ref = req.params.deviceId ?? req.body?.macAddress ?? req.body?.deviceId;
    if (!ref) return res.status(400).json({ error: "MAC address required" });

    const device = await findDevice(ref);
    if (!device) return res.status(404).json({ error: "Device not found" });
    if (!apiKeyMatches(device, req.headers["x-api-key"])) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    req.device = device;
    if (req.body?.macAddress) req.body.macAddress = normalizeMac(req.body.macAddress);
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireMembership(req, res, next) {
  try {
    const device = await findDevice(req.params.deviceId);
    if (!device) return res.status(404).json({ error: "Device not found" });
    if (!(await isMember(device.id, req.userId))) {
      return res.status(403).json({ error: "Access denied" });
    }
    req.device = device;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireOwner(req, res, next) {
  if (req.device.ownerId !== req.userId) {
    return res.status(403).json({ error: "Only the owner can do this" });
  }
  next();
}
