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
        moisture: null,
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
        moisture: null,
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
        moisture: null,
        ammonia: null,
      });
    }

    res.json({
      temperature: latest.temperature ?? null,
      humidity: latest.humidity ?? null,
      moisture: latest.moisture ?? null,
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

router.get("/device/:deviceId/hourly", async (req, res) => {
  try {
    const { deviceId } = req.params;

    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required" });
    }

    const drawers = await Drawer.find({ deviceId: deviceId.toUpperCase() });

    if (drawers.length === 0) {
      return res.json([]);
    }

    const now = new Date();
    const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const startOfPast24h = new Date(past24h);
    startOfPast24h.setHours(past24h.getHours(), 0, 0, 0);

    const drawerIds = drawers.map((d) => d._id);
    const readings = await DrawerReading.find({
      drawerId: { $in: drawerIds },
      date: { $gte: new Date(startOfPast24h.setHours(0, 0, 0, 0)) },
    });

    const hourlyData = {};
    for (let i = 0; i < 24; i++) {
      const hourStart = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
      hourStart.setMinutes(0, 0, 0);
      const hourKey = hourStart.toISOString();
      hourlyData[hourKey] = {
        hour: hourStart,
        temperature: [],
        humidity: [],
        moisture: [],
        ammonia: [],
      };
    }

    readings.forEach((r) => {
      if (r.readings) {
        r.readings.forEach((reading) => {
          const ts = new Date(reading.timestamp);
          if (ts >= past24h) {
            const hourStart = new Date(ts);
            hourStart.setMinutes(0, 0, 0);
            const hourKey = hourStart.toISOString();

            if (hourlyData[hourKey]) {
              if (reading.temperature !== undefined) hourlyData[hourKey].temperature.push(reading.temperature);
              if (reading.humidity !== undefined) hourlyData[hourKey].humidity.push(reading.humidity);
              if (reading.moisture !== undefined) hourlyData[hourKey].moisture.push(reading.moisture);
              if (reading.ammonia !== undefined) hourlyData[hourKey].ammonia.push(reading.ammonia);
            }
          }
        });
      }
    });

    const result = Object.values(hourlyData).map((h) => ({
      hour: h.hour,
      temperature: h.temperature.length > 0 ? h.temperature.reduce((a, b) => a + b, 0) / h.temperature.length : null,
      humidity: h.humidity.length > 0 ? h.humidity.reduce((a, b) => a + b, 0) / h.humidity.length : null,
      moisture: h.moisture.length > 0 ? h.moisture.reduce((a, b) => a + b, 0) / h.moisture.length : null,
      ammonia: h.ammonia.length > 0 ? h.ammonia.reduce((a, b) => a + b, 0) / h.ammonia.length : null,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch hourly data" });
  }
});

export default router;
