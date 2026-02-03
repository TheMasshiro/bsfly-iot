import express from "express";
import cors from "cors";
import connectDB from "./database/mongo.database.js";
import "dotenv/config";
import userRoutes from "./controllers/UserControllers.js";
import actuatorRoutes from "./controllers/actuatorRoutes.js";
import deviceRoutes from "./controllers/deviceRoutes.js";
import sensorRoutes from "./controllers/sensorRoutes.js";
import webhookRoutes from "./controllers/webhookRoutes.js";
import { apiLimiter } from "./middleware/rateLimiter.js";

const app = express();

app.use("/api/webhooks", webhookRoutes);

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8100', 'https://bsfly-iot.vercel.app'],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.use(express.json({ limit: "10kb" }));

app.use("/api", apiLimiter);

await connectDB();

const BACKEND_PORT = process.env.PORT || 5000;

app.get("/", (_req, res) => res.send("REST API Working"));

app.use("/api/users", userRoutes);

app.use("/api/actuators", actuatorRoutes);

app.use("/api/devices", deviceRoutes);

app.use("/api/sensor", sensorRoutes);
app.use("/api/sensors", sensorRoutes);

if (process.env.VERCEL !== "1") {
  app.listen(BACKEND_PORT);
}

export default app;
