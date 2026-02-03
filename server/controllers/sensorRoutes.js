import express from "express";
import DrawerReading from "../models/Sensor.DrawerReadings.js";
import { sensorLimiter } from "../middleware/rateLimiter.js";
import {
  isValidTemperature,
  isValidHumidity,
  isValidMoisture,
} from "../middleware/validation.js";

const router = express.Router();

// Store sensor readings from ESP32
router.post("/", sensorLimiter, async (req, res) => {
  try {
    const { deviceId, temperature, humidity, moisture, ammonia, timestamp } = req.body;

    if (!deviceId || typeof deviceId !== "string") {
      return res.status(400).json({ error: "Valid deviceId is required" });
    }

    // Validate sensor values if provided
    if (temperature !== undefined && !isValidTemperature(temperature)) {
      return res.status(400).json({ error: "Invalid temperature value" });
    }
    if (humidity !== undefined && !isValidHumidity(humidity)) {
      return res.status(400).json({ error: "Invalid humidity value" });
    }
    if (moisture !== undefined && !isValidMoisture(moisture)) {
      return res.status(400).json({ error: "Invalid moisture value" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const readingData = {
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    };

    // Only include defined values
    if (temperature !== undefined) readingData.temperature = temperature;
    if (humidity !== undefined) readingData.humidity = humidity;
    if (moisture !== undefined) readingData.moisture = moisture;
    if (ammonia !== undefined) readingData.ammonia = ammonia;

    const reading = await DrawerReading.findOneAndUpdate(
      { drawerId: deviceId.toUpperCase(), date: today },
      { $push: { readings: readingData } },
      { upsert: true, new: true }
    );

    res.status(201).json({ success: true, reading });
  } catch (error) {
    res.status(500).json({ error: "Failed to store sensor reading" });
  }
});

// Get latest sensor readings for a device
router.get("/device/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;

    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required" });
    }

    // Get today's readings for this device
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reading = await DrawerReading.findOne({
      drawerId: deviceId.toUpperCase(),
      date: { $gte: today }
    });

    if (!reading || !reading.readings || reading.readings.length === 0) {
      return res.json({
        temperature: null,
        humidity: null,
        moisture1: null,
        moisture2: null,
        ammonia: null,
      });
    }

    // Get the latest reading
    const latest = reading.readings[reading.readings.length - 1];

    res.json({
      temperature: latest.temperature ?? null,
      humidity: latest.humidity ?? null,
      moisture1: latest.moisture ?? null,
      moisture2: null,
      ammonia: latest.ammonia ?? null,
      timestamp: latest.timestamp,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sensor data" });
  }
});

// Get sensor history for a device within date range
router.get("/device/:deviceId/history", async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { from, to } = req.query;

    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required" });
    }

    const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();
    
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    const readings = await DrawerReading.find({
      drawerId: deviceId.toUpperCase(),
      date: { $gte: fromDate, $lte: toDate }
    }).sort({ date: 1 });

    res.json(readings);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sensor history" });
  }
});

// Get latest readings for a specific drawer
router.get("/drawer/:drawerId", async (req, res) => {
  try {
    const { drawerId } = req.params;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reading = await DrawerReading.findOne({
      drawerId: drawerId,
      date: { $gte: today }
    });

    if (!reading || !reading.readings || reading.readings.length === 0) {
      return res.json({ temperature: null, humidity: null });
    }

    const latest = reading.readings[reading.readings.length - 1];
    res.json({
      temperature: latest.temperature ?? null,
      humidity: latest.humidity ?? null,
      moisture: latest.moisture ?? null,
      ammonia: latest.ammonia ?? null,
      timestamp: latest.timestamp,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch drawer data" });
  }
});

export default router;
