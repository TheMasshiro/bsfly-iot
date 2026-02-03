import express from "express";
import { handleClerkWebhook } from "../webhooks/clerk.js";

const router = express.Router();

router.get("/clerk", (_req, res) => {
  res.json({ status: "Webhook endpoint active", method: "POST required" });
});

// Use express.text() to preserve raw body as string for svix signature verification
router.post("/clerk", express.text({ type: "application/json" }), handleClerkWebhook);

export default router;
