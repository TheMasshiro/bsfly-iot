import express from "express";
import cors from "cors";
import connectDB from "./database/mongo.database.js";
import "dotenv/config";
import "./controllers/UserControllers.js";
import actuatorRoutes from "./controllers/actuatorRoutes.js";
import deviceRoutes from "./controllers/deviceRoutes.js";
import sensorRoutes from "./controllers/sensorRoutes.js";

// REST API Server for Vercel
const app = express();

// CORS configuration - allow all origins for API
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['http://localhost:3000', 'http://localhost:5173', 'https://bsfly-iot.vercel.app'],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.use(express.json());

await connectDB();

const BACKEND_PORT = process.env.PORT || 5000;

// Health check
app.get("/", (_req, res) => res.send("REST API Working"));

// Actuator routes
app.use("/api/actuators", actuatorRoutes);

// Device routes
app.use("/api/devices", deviceRoutes);

// Sensor routes
app.use("/api/sensor", sensorRoutes);
app.use("/api/sensors", sensorRoutes);

if (process.env.VERCEL !== "1") {
  app.listen(BACKEND_PORT, () => {
    console.log(`REST API server running on port ${BACKEND_PORT}`);
  });
}

export default app;
