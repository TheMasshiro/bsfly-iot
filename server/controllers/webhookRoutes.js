import express from "express";
import { handleClerkWebhook } from "../webhooks/clerk.js";

const router = express.Router();

// Health check for webhook endpoint
router.get("/clerk", (_req, res) => {
  res.json({ status: "Webhook endpoint active", method: "POST required" });
});

// Clerk webhook endpoint - uses raw body for signature verification
router.post("/clerk", express.raw({ type: "application/json" }), handleClerkWebhook);

export default router;
