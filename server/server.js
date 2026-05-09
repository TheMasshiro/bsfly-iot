import express from "express";
import cors from "cors";
import connectDB from "./database/mongo.database.js";
import "dotenv/config";
import userRoutes from "./controllers/UserControllers.js";
import actuatorRoutes from "./controllers/actuatorRoutes.js";
import deviceRoutes from "./controllers/deviceRoutes.js";
import sensorRoutes from "./controllers/sensorRoutes.js";
import webhookRoutes from "./controllers/webhookRoutes.js";
import reportRoutes from "./controllers/reportRoutes.js";
import { initMqtt } from "./mqttClient.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { clerkMiddleware } from "./middleware/auth.js";

const app = express();

app.set("trust proxy", 1);

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8100",
  "https://bsfly-iot.onrender.com",
  "https://bsfly-iot.vercel.app",
];

const configuredOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : defaultAllowedOrigins;

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    if (/^https:\/\/bsfly-iot-.*\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "x-api-key"],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use("/api/webhooks", webhookRoutes);

app.use(express.json({ limit: "10kb" }));

app.use(clerkMiddleware());

app.use("/api", apiLimiter);

await connectDB();

initMqtt().catch((e) =>
  console.error("MQTT init failed (continuing without broker):", e)
);

const BACKEND_PORT = process.env.PORT || 5000;

app.get("/", (_req, res) => res.send("REST API Working"));

app.get("/api/time", (_req, res) => res.json({ now: Date.now() }));

app.use("/api/users", userRoutes);

app.use("/api/actuators", actuatorRoutes);

app.use("/api/devices", deviceRoutes);

app.use("/api/sensors", sensorRoutes);
app.use("/api/reports", reportRoutes);

app.use((err, _req, res, _next) => {
  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "CORS origin denied" });
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "Internal server error" });
});

if (process.env.VERCEL !== "1") {
  app.listen(BACKEND_PORT, () => {});
}

export default app;
