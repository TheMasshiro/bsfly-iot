import express from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { deviceMembers, devices, drawers, newJoinCode, users } from "../db/schema.js";
import { requireAuth, requireDeviceKey, requireMembership, requireOwner } from "../middleware/auth.js";
import { deviceLimiter } from "../middleware/rateLimiter.js";
import { isValidDeviceName, isValidJoinCode, isValidMacAddress, validateBody } from "../middleware/validation.js";
import {
  DRAWER_NAMES,
  devicesForUser,
  ensureUser,
  issueApiKey,
  membersOf,
  normalizeMac,
  toDeviceDto,
  touchDevice,
} from "../services/devices.js";
import { publishMqtt } from "../services/mqtt.js";

const router = express.Router();

const registerSchema = {
  macAddress: { required: true, type: "string", validator: isValidMacAddress, message: "Invalid MAC address format" },
  name: { required: true, type: "string", validator: isValidDeviceName, message: "Device name must be 1-50 characters" },
};

const joinSchema = {
  joinCode: { required: true, type: "string", validator: isValidJoinCode, message: "Join code must be 8 alphanumeric characters" },
};

const withMembers = async (device) => toDeviceDto(device, await membersOf([device.id]));

router.post("/register", requireAuth, deviceLimiter, validateBody(registerSchema), async (req, res) => {
  const macAddress = normalizeMac(req.body.macAddress);
  await ensureUser(req.userId);

  const { apiKey, ...keyFields } = issueApiKey();
  const device = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(devices)
      .values({ macAddress, name: req.body.name, ownerId: req.userId, ...keyFields })
      .onConflictDoNothing()
      .returning();
    if (!created) return null;
    await tx.insert(deviceMembers).values({ deviceId: created.id, userId: req.userId });
    await tx.insert(drawers).values(DRAWER_NAMES.map((name) => ({ deviceId: created.id, name })));
    return created;
  });

  if (!device) return res.status(409).json({ error: "Device already registered" });
  res.status(201).json({ ...(await withMembers(device)), apiKey });
});

router.post("/join", requireAuth, validateBody(joinSchema), async (req, res) => {
  const [device] = await db.select().from(devices).where(eq(devices.joinCode, req.body.joinCode.toUpperCase()));
  if (!device) return res.status(404).json({ error: "Invalid join code" });

  await ensureUser(req.userId);
  const [joined] = await db
    .insert(deviceMembers)
    .values({ deviceId: device.id, userId: req.userId })
    .onConflictDoNothing()
    .returning();
  if (!joined) return res.status(409).json({ error: "Already a member of this device" });

  res.json({ message: "Successfully joined device", ...(await withMembers(device)) });
});

router.get("/user/me", requireAuth, async (req, res) => {
  const list = await devicesForUser(req.userId);
  const members = await membersOf(list.map((d) => d.id));
  res.json(list.map((d) => toDeviceDto(d, members.filter((m) => m.deviceId === d.id))));
});

router.post("/:deviceId/heartbeat", requireDeviceKey, async (req, res) => {
  const ip = req.body?.ipAddress;
  await touchDevice(req.device.id, typeof ip === "string" && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) ? ip : undefined);
  res.json({ status: "online", lastSeen: new Date() });
});

router.get("/by-mac/:deviceId", requireDeviceKey, (req, res) => {
  const { id, macAddress, ipAddress, lastSeen } = req.device;
  res.json({ deviceId: id, macAddress, ipAddress, lastSeen });
});

router.get("/:deviceId", requireAuth, requireMembership, async (req, res) => {
  res.json(await withMembers(req.device));
});

router.patch("/:deviceId/control-mode", requireAuth, requireMembership, async (req, res) => {
  const { mode } = req.body ?? {};
  if (!["auto", "manual"].includes(mode)) {
    return res.status(400).json({ error: "Invalid mode. Must be 'auto' or 'manual'" });
  }

  const [device] = await db.update(devices).set({ controlMode: mode }).where(eq(devices.id, req.device.id)).returning();
  publishMqtt(`devices/${device.macAddress}/actuators/mode/control`, { state: mode }, { retain: true });
  res.json(await withMembers(device));
});

router.get("/:deviceId/members", requireAuth, requireMembership, async (req, res) => {
  const rows = await db
    .select({ userId: deviceMembers.userId, joinedAt: deviceMembers.joinedAt, name: users.name, email: users.email })
    .from(deviceMembers)
    .leftJoin(users, eq(users.id, deviceMembers.userId))
    .where(eq(deviceMembers.deviceId, req.device.id));

  res.json(
    rows.map((m) => ({
      ...m,
      name: m.name || "Unknown",
      email: m.email ?? "",
      role: m.userId === req.device.ownerId ? "owner" : "member",
    })),
  );
});

router.post("/:deviceId/regenerate-code", requireAuth, requireMembership, requireOwner, async (req, res) => {
  const [device] = await db
    .update(devices)
    .set({ joinCode: newJoinCode() })
    .where(eq(devices.id, req.device.id))
    .returning();
  res.json({ joinCode: device.joinCode });
});

router.get("/:deviceId/api-key", requireAuth, requireMembership, requireOwner, (req, res) => {
  res.json({ apiKey: req.device.apiKeyHint, note: "Masked. Regenerate to get a new key." });
});

router.post("/:deviceId/regenerate-api-key", requireAuth, requireMembership, requireOwner, async (req, res) => {
  const { apiKey, ...keyFields } = issueApiKey();
  await db.update(devices).set(keyFields).where(eq(devices.id, req.device.id));
  res.json({ apiKey, note: "Shown once. Put it in DEVICE_API_KEY in credentials.h." });
});

router.patch("/:deviceId/members/:memberId/role", requireAuth, requireMembership, requireOwner, async (req, res) => {
  const { memberId } = req.params;
  const { role } = req.body ?? {};
  if (!["owner", "member"].includes(role)) {
    return res.status(400).json({ error: "Invalid role. Must be 'owner' or 'member'" });
  }

  const [member] = await db
    .select()
    .from(deviceMembers)
    .where(and(eq(deviceMembers.deviceId, req.device.id), eq(deviceMembers.userId, memberId)));
  if (!member) return res.status(404).json({ error: "Member not found" });

  if (role === "member" && memberId === req.device.ownerId) {
    return res.status(400).json({ error: "Cannot demote the owner. Transfer ownership first." });
  }
  if (role === "owner") {
    await db.update(devices).set({ ownerId: memberId }).where(eq(devices.id, req.device.id));
  }

  res.json({ message: "Member role updated", _id: req.device.id, macAddress: req.device.macAddress });
});

router.delete("/:deviceId/members/:memberId", requireAuth, requireMembership, requireOwner, async (req, res) => {
  const { memberId } = req.params;
  if (memberId === req.device.ownerId) return res.status(400).json({ error: "Cannot remove the owner" });

  const removed = await db
    .delete(deviceMembers)
    .where(and(eq(deviceMembers.deviceId, req.device.id), eq(deviceMembers.userId, memberId)))
    .returning();
  if (removed.length === 0) return res.status(404).json({ error: "Member not found" });

  res.json({ message: "Member removed", _id: req.device.id, macAddress: req.device.macAddress });
});

router.delete("/:deviceId/leave", requireAuth, requireMembership, async (req, res) => {
  if (req.device.ownerId === req.userId) {
    await db.delete(devices).where(eq(devices.id, req.device.id));
    return res.json({ message: "Device deleted" });
  }

  await db
    .delete(deviceMembers)
    .where(and(eq(deviceMembers.deviceId, req.device.id), eq(deviceMembers.userId, req.userId)));
  res.json({ message: "Left device successfully" });
});

export default router;
