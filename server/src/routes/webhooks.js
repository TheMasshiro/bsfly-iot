import express from "express";
import { Webhook } from "svix";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";

const router = express.Router();

router.post("/clerk", express.raw({ type: "application/json" }), async (req, res) => {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: "Webhook secret not configured" });

  let event;
  try {
    event = new Webhook(secret).verify(req.body.toString("utf8"), {
      "svix-id": req.headers["svix-id"],
      "svix-timestamp": req.headers["svix-timestamp"],
      "svix-signature": req.headers["svix-signature"],
    });
  } catch {
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  const { type, data } = event;
  if (type === "user.created" || type === "user.updated") {
    const email = data.email_addresses?.[0]?.email_address ?? "";
    const name = `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || email;
    await db
      .insert(users)
      .values({ id: data.id, name, email })
      .onConflictDoUpdate({ target: users.id, set: { name, email } });
  } else if (type === "user.deleted" && data.id) {
    await db.delete(users).where(eq(users.id, data.id));
  }

  res.json({ received: true });
});

export default router;
