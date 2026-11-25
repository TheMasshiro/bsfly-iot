import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { deviceMembers, devices, newApiKey, users } from "../db/schema.js";

export const ONLINE_WINDOW_MS = 20_000;
export const DRAWER_NAMES = ["Drawer 1", "Drawer 2"];

export const hashApiKey = (key) => createHash("sha256").update(key).digest("hex");

export function issueApiKey() {
  const apiKey = newApiKey();
  return { apiKey, apiKeyHash: hashApiKey(apiKey), apiKeyHint: `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` };
}

export function apiKeyMatches(device, candidate) {
  if (typeof candidate !== "string" || !candidate) return false;
  const a = Buffer.from(hashApiKey(candidate), "hex");
  const b = Buffer.from(device.apiKeyHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const isOnline = (device, nowMs = Date.now()) =>
  Boolean(device.lastSeen) && nowMs - new Date(device.lastSeen).getTime() < ONLINE_WINDOW_MS;

export const normalizeMac = (mac) => String(mac).toUpperCase().replace(/-/g, ":");

export function normalizeDrawerName(raw) {
  if (typeof raw !== "string" || !raw.trim()) return "Drawer 1";
  const name = raw.trim();
  if (name.startsWith("Drawer 2")) return "Drawer 2";
  if (name.startsWith("Drawer 1")) return "Drawer 1";
  return name;
}

export function toDeviceDto(device, members = []) {
  return {
    _id: device.id,
    macAddress: device.macAddress,
    name: device.name,
    status: isOnline(device) ? "online" : "offline",
    controlMode: device.controlMode,
    lastSeen: device.lastSeen,
    joinCode: device.joinCode,
    ownerId: device.ownerId,
    ipAddress: device.ipAddress,
    members: members.map((m) => ({
      userId: m.userId,
      role: m.userId === device.ownerId ? "owner" : "member",
      joinedAt: m.joinedAt,
    })),
  };
}

export async function findDevice(ref) {
  const byMac = /:/.test(ref) || /^[0-9A-F]{12}$/i.test(ref);
  const [device] = await db
    .select()
    .from(devices)
    .where(byMac ? eq(devices.macAddress, normalizeMac(ref)) : eq(devices.id, ref))
    .limit(1);
  return device ?? null;
}

export async function isMember(deviceId, userId) {
  const [row] = await db
    .select({ userId: deviceMembers.userId })
    .from(deviceMembers)
    .where(and(eq(deviceMembers.deviceId, deviceId), eq(deviceMembers.userId, userId)))
    .limit(1);
  return Boolean(row);
}

export const membersOf = (deviceIds) =>
  deviceIds.length === 0
    ? []
    : db.select().from(deviceMembers).where(inArray(deviceMembers.deviceId, deviceIds));

export async function devicesForUser(userId) {
  const rows = await db
    .select({ device: devices })
    .from(devices)
    .innerJoin(deviceMembers, eq(deviceMembers.deviceId, devices.id))
    .where(eq(deviceMembers.userId, userId));
  return rows.map((r) => r.device);
}

export async function ensureUser(userId, profile = {}) {
  await db
    .insert(users)
    .values({ id: userId, name: profile.name ?? "", email: profile.email ?? "" })
    .onConflictDoNothing();
}

export async function touchDevice(deviceId, ipAddress) {
  const patch = { lastSeen: new Date() };
  if (ipAddress) patch.ipAddress = ipAddress;
  await db.update(devices).set(patch).where(eq(devices.id, deviceId));
}
