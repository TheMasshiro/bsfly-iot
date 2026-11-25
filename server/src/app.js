import express from "express";
import cors from "cors";
import actuatorRoutes from "./routes/actuators.js";
import deviceRoutes from "./routes/devices.js";
import reportRoutes from "./routes/reports.js";
import sensorRoutes from "./routes/sensors.js";
import userRoutes from "./routes/users.js";
import webhookRoutes from "./routes/webhooks.js";
import { clerkIdentity } from "./middleware/auth.js";
import { apiLimiter } from "./middleware/rateLimiter.js";

const DEFAULT_ORIGINS = ["http://localhost:5173", "http://localhost:8100", "capacitor://localhost", "https://localhost"];

function corsOptions() {
  const configured = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  const allowed = new Set(configured.length ? configured : DEFAULT_ORIGINS);
  return {
    origin: (origin, cb) => (!origin || allowed.has(origin) ? cb(null, true) : cb(new Error("CORS origin denied"))),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
    credentials: true,
  };
}

export function createApp({ identify = clerkIdentity() } = {}) {
  const app = express();
  app.set("trust proxy", 1);

  app.use(cors(corsOptions()));
  app.use("/api/webhooks", webhookRoutes);
  app.use(express.json({ limit: "10kb" }));
  app.use(identify);
  app.use("/api", apiLimiter);

  app.get("/", (_req, res) => res.send("BSFLY API"));
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/time", (_req, res) => res.json({ now: Date.now() }));

  app.use("/api/users", userRoutes);
  app.use("/api/devices", deviceRoutes);
  app.use("/api/sensors", sensorRoutes);
  app.use("/api/actuators", actuatorRoutes);
  app.use("/api/reports", reportRoutes);

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  app.use((err, _req, res, _next) => {
    if (err?.message === "CORS origin denied") return res.status(403).json({ error: err.message });
    if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
