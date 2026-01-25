import express from "express";
import cors from "cors";
import connectDB from "./database/mongo.database.js";
import "dotenv/config";
import "./controllers/UserControllers.js";
import actuatorRoutes from "./controllers/actuatorRoutes.js";

// REST API Server for Vercel
const app = express();
app.use(cors());
app.use(express.json());

await connectDB();

const BACKEND_PORT = process.env.PORT || 5000;

// Health check
app.get("/", (_req, res) => res.send("REST API Working"));

// Actuator routes (replaces Socket.IO)
app.use("/api/actuators", actuatorRoutes);

// Only start server if not running on Vercel
if (process.env.VERCEL !== "1") {
  app.listen(BACKEND_PORT, () => {
    console.log(`REST API server running on port ${BACKEND_PORT}`);
  });
}

export default app;
