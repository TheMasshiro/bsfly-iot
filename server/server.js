import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import connectDB from "./database/mongo.database.js";
import "dotenv/config";
import "./controllers/UserControllers.js";
import { registerActuatorHandlers } from "./socket/actuatorHandlers.js";

const app = express();
app.use(cors());

const httpServer = createServer();
await connectDB();

const FRONTEND_PORT = 8100;
const BACKEND_PORT = 5000;
const io = new Server(httpServer, {
  cors: {
    origin: `http://localhost:${FRONTEND_PORT}`,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  registerActuatorHandlers(io, socket);
});

httpServer.listen(BACKEND_PORT, () => {
  console.log(`Server is running on port ${BACKEND_PORT}`);
});
