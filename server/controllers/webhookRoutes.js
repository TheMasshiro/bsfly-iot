import express from "express";
import { handleClerkWebhook } from "../webhooks/clerk.js";

const router = express.Router();

router.get("/clerk", (_req, res) => {
  res.json({ status: "Webhook endpoint active", method: "POST required" });
});

router.post("/clerk", express.json(), handleClerkWebhook);

export default router;
