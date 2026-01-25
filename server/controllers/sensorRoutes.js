import express from "express";
import DrawerReading from "../models/Sensor.DrawerReadings.js";

const router = express.Router();

// Store sensor readings from ESP32
router.post("/", async (req, res) => {
  try {
    const { deviceId, temperature, humidity, timestamp } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required" });
    }

    // For now, store with deviceId as drawerId
    // In production, you'd map deviceId to actual drawer IDs
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reading = await DrawerReading.findOneAndUpdate(
      { drawerId: deviceId, date: today },
      {
        $push: {
          readings: {
            timestamp: new Date(timestamp) || new Date(),
            temperature,
            humidity,
          },
        },
      },
      { upsert: true, new: true }
    );

    res.status(201).json({ success: true, reading });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get latest sensor readings for a device (all drawers)
router.get("/device/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;

    const readings = await DrawerReading.find({
      drawerId: { $regex: deviceId } // Find drawers belonging to this device
    })
      .sort({ "readings.timestamp": -1 })
      .limit(3); // Get latest 3 drawer readings

    if (!readings || readings.length === 0) {
      return res.json({
        temperature: null,
        humidity: null,
        moisture1: null,
        moisture2: null,
        ammonia: null,
      });
    }

    // Extract latest sensor values from the most recent readings
    const latestValues = {
      temperature: null,
      humidity: null,
      moisture1: null,
      moisture2: null,
      ammonia: null,
    };

    readings.forEach((drawerReading) => {
      if (drawerReading.readings && drawerReading.readings.length > 0) {
        const latest = drawerReading.readings[drawerReading.readings.length - 1];
        
        if (latest.temperature !== undefined) {
          latestValues.temperature = latest.temperature;
        }
        if (latest.humidity !== undefined) {
          latestValues.humidity = latest.humidity;
        }
        if (latest.moisture !== undefined) {
          if (!latestValues.moisture1) {
            latestValues.moisture1 = latest.moisture;
          } else if (!latestValues.moisture2) {
            latestValues.moisture2 = latest.moisture;
          }
        }
        if (latest.ammonia !== undefined) {
          latestValues.ammonia = latest.ammonia;
        }
      }
    });

    res.json(latestValues);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get latest readings for a specific drawer
router.get("/drawer/:drawerId", async (req, res) => {
  try {
    const { drawerId } = req.params;

    const reading = await DrawerReading.findById(drawerId)
      .sort({ "readings.timestamp": -1 });

    if (!reading || !reading.readings || reading.readings.length === 0) {
      return res.json({ temperature: null, humidity: null });
    }

    const latest = reading.readings[reading.readings.length - 1];
    res.json({
      temperature: latest.temperature,
      humidity: latest.humidity,
      moisture: latest.moisture,
      ammonia: latest.ammonia,
      timestamp: latest.timestamp,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
