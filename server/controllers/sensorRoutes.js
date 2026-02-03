import express from "express";
import Drawer from "../models/Sensor.Drawer.js";
import DrawerReading from "../models/Sensor.DrawerReadings.js";
import { sensorLimiter } from "../middleware/rateLimiter.js";
import {
  isValidTemperature,
  isValidHumidity,
  isValidMoisture,
} from "../middleware/validation.js";

const router = express.Router();

router.post("/", sensorLimiter, async (req, res) => {
  try {
    const { deviceId, drawerName, temperature, humidity, moisture, ammonia } = req.body;

    if (!deviceId || typeof deviceId !== "string") {
      return res.status(400).json({ error: "Valid deviceId is required" });
    }

    if (temperature !== undefined && !isValidTemperature(temperature)) {
      return res.status(400).json({ error: "Invalid temperature value" });
    }
    if (humidity !== undefined && !isValidHumidity(humidity)) {
      return res.status(400).json({ error: "Invalid humidity value" });
    }
    if (moisture !== undefined && !isValidMoisture(moisture)) {
      return res.status(400).json({ error: "Invalid moisture value" });
    }

    let drawer = await Drawer.findOne({
      deviceId: deviceId.toUpperCase(),
      name: drawerName || "Drawer 1",
    });

    if (!drawer) {
      drawer = await Drawer.create({
        deviceId: deviceId.toUpperCase(),
        name: drawerName || "Drawer 1",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const readingData = {
      timestamp: new Date(),
    };

    if (temperature !== undefined) readingData.temperature = temperature;
    if (humidity !== undefined) readingData.humidity = humidity;
    if (moisture !== undefined) readingData.moisture = moisture;
    if (ammonia !== undefined) readingData.ammonia = ammonia;

    const reading = await DrawerReading.findOneAndUpdate(
      { drawerId: drawer._id, date: today },
      { $push: { readings: readingData } },
      { upsert: true, new: true }
    );

    res.status(201).json({ success: true, reading });
  } catch (error) {
    res.status(500).json({ error: "Failed to store sensor reading" });
  }
});

router.get("/device/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;

    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required" });
    }

    const drawers = await Drawer.find({ deviceId: deviceId.toUpperCase() });
    
    if (drawers.length === 0) {
      return res.json({
        temperature: null,
        humidity: null,
        moisture1: null,
        moisture2: null,
        ammonia: null,
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const drawerIds = drawers.map((d) => d._id);
    const readings = await DrawerReading.find({
      drawerId: { $in: drawerIds },
      date: { $gte: today },
    });

    if (!readings || readings.length === 0) {
      return res.json({
        temperature: null,
        humidity: null,
        moisture1: null,
        moisture2: null,
        ammonia: null,
      });
    }

    let latest = null;
    readings.forEach((r) => {
      if (r.readings && r.readings.length > 0) {
        const lastReading = r.readings[r.readings.length - 1];
        if (!latest || lastReading.timestamp > latest.timestamp) {
          latest = lastReading;
        }
      }
    });

    if (!latest) {
      return res.json({
        temperature: null,
        humidity: null,
        moisture1: null,
        moisture2: null,
        ammonia: null,
      });
    }

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

router.get("/device/:deviceId/history", async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { from, to } = req.query;

    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required" });
    }

    const drawers = await Drawer.find({ deviceId: deviceId.toUpperCase() });
    
    if (drawers.length === 0) {
      return res.json([]);
    }

    const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();
    
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    const drawerIds = drawers.map((d) => d._id);
    const readings = await DrawerReading.find({
      drawerId: { $in: drawerIds },
      date: { $gte: fromDate, $lte: toDate },
    }).sort({ date: 1 });

    res.json(readings);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sensor history" });
  }
});

router.get("/drawer/:drawerId", async (req, res) => {
  try {
    const { drawerId } = req.params;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reading = await DrawerReading.findOne({
      drawerId: drawerId,
      date: { $gte: today },
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
