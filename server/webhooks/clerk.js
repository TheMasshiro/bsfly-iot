import { Webhook } from "svix";
import Device from "../models/User.Device.js";

export async function handleClerkWebhook(req, res) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  const svix_id = req.headers["svix-id"];
  const svix_timestamp = req.headers["svix-timestamp"];
  const svix_signature = req.headers["svix-signature"];

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).json({ error: "Missing svix headers" });
  }

  try {
    const wh = new Webhook(webhookSecret);
    const event = wh.verify(req.body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
    const { type, data } = event;

    switch (type) {
      case "user.deleted": {
        const userId = data.id;

        await Device.updateMany(
          { "members.userId": userId },
          { $pull: { members: { userId } } }
        );

        await Device.deleteMany({ ownerId: userId });

        break;
      }

      case "user.created":
      case "user.updated":
        break;
      default:
        break;
    }

    res.json({ received: true });
  } catch (error) {
    if (error.message?.includes("signature")) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }
    res.status(500).json({ error: "Webhook processing failed" });
  }
}
