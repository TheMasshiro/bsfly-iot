import express from "express";
import { eq } from "drizzle-orm";
import validator from "validator";
import { db } from "../db/index.js";
import { devices, users } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { validateBody } from "../middleware/validation.js";
import { devicesForUser, isOnline } from "../services/devices.js";

const router = express.Router();

const isValidName = (name) => typeof name === "string" && name.trim().length >= 1 && name.length <= 100;

const profileSchema = (required) => ({
  name: { required, type: "string", validator: isValidName, message: "Name must be 1-100 characters" },
  email: { required, type: "string", validator: (e) => validator.isEmail(e), message: "Invalid email address" },
});

const toUserDto = (user) => ({ _id: user.id, name: user.name, email: user.email, createdAt: user.createdAt });

router.post("/", requireAuth, validateBody(profileSchema(true)), async (req, res) => {
  const { name, email } = req.body;
  const [user] = await db
    .insert(users)
    .values({ id: req.userId, name, email })
    .onConflictDoUpdate({ target: users.id, set: { name, email } })
    .returning();
  res.status(201).json(toUserDto(user));
});

router.get("/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(users).where(eq(users.id, req.userId));
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(toUserDto(user));
});

router.put("/me", requireAuth, validateBody(profileSchema(false)), async (req, res) => {
  const patch = {};
  if (req.body.name) patch.name = req.body.name;
  if (req.body.email) patch.email = req.body.email;
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "No valid fields to update" });

  const [user] = await db.update(users).set(patch).where(eq(users.id, req.userId)).returning();
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(toUserDto(user));
});

router.delete("/me", requireAuth, authLimiter, async (req, res) => {
  const deleted = await db.delete(users).where(eq(users.id, req.userId)).returning();
  if (deleted.length === 0) return res.status(404).json({ error: "User not found" });
  res.json({ message: "User deleted successfully" });
});

router.get("/me/devices", requireAuth, async (req, res) => {
  const list = await devicesForUser(req.userId);
  const owned = list.filter((d) => d.ownerId === req.userId).length;
  const online = list.filter((d) => isOnline(d)).length;
  res.json({
    total: list.length,
    owned,
    member: list.length - owned,
    online,
    offline: list.length - online,
  });
});

export default router;
