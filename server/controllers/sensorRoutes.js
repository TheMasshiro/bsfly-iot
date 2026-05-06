import express from "express";
import Drawer from "../models/Sensor.Drawer.js";
import DrawerReading from "../models/Sensor.DrawerReadings.js";
import Device from "../models/User.Device.js";
import { sensorLimiter } from "../middleware/rateLimiter.js";
import { requireAuth, requireDeviceAuth, requireDeviceMembership } from "../middleware/auth.js";
import {
  isValidTemperature,
  isValidHumidity,
  isValidMoisture,
  isValidAmmonia,
} from "../middleware/validation.js";

const router = express.Router();

const normalizeDrawerName = (rawDrawerName) => {
  if (typeof rawDrawerName !== "string") return "Drawer 1";
  const name = rawDrawerName.trim();
  if (name.length === 0) return "Drawer 1";

  if (name.startsWith("Drawer 2")) return "Drawer 2";
  if (name.startsWith("Drawer 1")) return "Drawer 1";

  return name;
};

const emptySensorResponse = {
  temperature: null,
  humidity: null,
  moisture: null,
  leftSubstrate: null,
  centerSubstrate: null,
  rightSubstrate: null,
  ammonia: null,
};

const computeMoisture = (reading) => {
  if (!reading) return null;
  if (reading.moisture !== undefined && reading.moisture !== null) {
    return Math.round(reading.moisture);
  }

  const substrateValues = [
    reading.leftSubstrate ?? reading.leftSoil,
    reading.centerSubstrate ?? reading.centerSoil,
    reading.rightSubstrate ?? reading.rightSoil,
  ].filter(
    (v) => typeof v === "number"
  );

  if (substrateValues.length === 0) return null;
  return Math.round(substrateValues.reduce((sum, v) => sum + v, 0) / substrateValues.length);
};

const getHourBucket = (timestamp = new Date()) => {
  const hourBucket = new Date(timestamp);
  hourBucket.setMinutes(0, 0, 0);
  return hourBucket;
};

const storeHourlyReading = async (drawerId, readingData) => {
  const hourBucket = getHourBucket(readingData.timestamp);
  const nextHourBucket = new Date(hourBucket);
  nextHourBucket.setHours(nextHourBucket.getHours() + 1);

  const existingReading = await DrawerReading.findOne({
    drawerId,
    date: { $gte: hourBucket, $lt: nextHourBucket },
    readings: {
      $elemMatch: {
        timestamp: { $gte: hourBucket, $lt: nextHourBucket },
      },
    },
  });

  if (existingReading) {
    await DrawerReading.updateOne(
      { _id: existingReading._id },
      {
        $set: {
          "readings.$[reading]": readingData,
        },
      },
      {
        arrayFilters: [
          {
            "reading.timestamp": { $gte: hourBucket, $lt: nextHourBucket },
          },
        ],
      }
    );
    return;
  }

  await DrawerReading.findOneAndUpdate(
    { drawerId, date: hourBucket },
    { $push: { readings: readingData } },
    { upsert: true }
  );
};

router.post("/", requireDeviceAuth, sensorLimiter, async (req, res) => {
  try {
    const {
      macAddress,
      drawerName,
      temperature,
      humidity,
      moisture,
      leftSubstrate,
      centerSubstrate,
      rightSubstrate,
      ammonia,
    } = req.body;

    const leftSubstrateValue = leftSubstrate ?? req.body.leftSoil;
    const centerSubstrateValue = centerSubstrate ?? req.body.centerSoil;
    const rightSubstrateValue = rightSubstrate ?? req.body.rightSoil;
    const normalizedDrawerName = normalizeDrawerName(drawerName);

    if (temperature !== undefined && !isValidTemperature(temperature)) {
      return res.status(400).json({ error: "Invalid temperature value" });
    }
    if (humidity !== undefined && !isValidHumidity(humidity)) {
      return res.status(400).json({ error: "Invalid humidity value" });
    }
    if (moisture !== undefined && !isValidMoisture(moisture)) {
      return res.status(400).json({ error: "Invalid moisture value" });
    }
    if (leftSubstrateValue !== undefined && !isValidMoisture(leftSubstrateValue)) {
      return res.status(400).json({ error: "Invalid leftSubstrate value" });
    }
    if (centerSubstrateValue !== undefined && !isValidMoisture(centerSubstrateValue)) {
      return res.status(400).json({ error: "Invalid centerSubstrate value" });
    }
    if (rightSubstrateValue !== undefined && !isValidMoisture(rightSubstrateValue)) {
      return res.status(400).json({ error: "Invalid rightSubstrate value" });
    }
    if (ammonia !== undefined && !isValidAmmonia(ammonia)) {
      return res.status(400).json({ error: "Invalid ammonia value" });
    }

    const device = await Device.findOne({ macAddress: macAddress.toUpperCase() });
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    let drawer = await Drawer.findOne({
      deviceId: device._id,
      name: normalizedDrawerName,
    });

    if (!drawer) {
      drawer = await Drawer.create({
        deviceId: device._id,
        name: normalizedDrawerName,
      });
    }

    const readingData = {
      timestamp: new Date(),
    };

    if (temperature !== undefined) readingData.temperature = temperature;
    if (humidity !== undefined) readingData.humidity = humidity;
    if (moisture !== undefined) readingData.moisture = moisture;
    if (leftSubstrateValue !== undefined) readingData.leftSubstrate = leftSubstrateValue;
    if (centerSubstrateValue !== undefined) readingData.centerSubstrate = centerSubstrateValue;
    if (rightSubstrateValue !== undefined) readingData.rightSubstrate = rightSubstrateValue;
    if (ammonia !== undefined) readingData.ammonia = ammonia;

    await storeHourlyReading(drawer._id, readingData);

    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to store sensor reading" });
  }
});

router.get("/device/:deviceId", requireAuth, requireDeviceMembership, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { drawer } = req.query;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.json(emptySensorResponse);
    }

    const drawerQuery = { deviceId };
    if (drawer) {
      drawerQuery.name = normalizeDrawerName(drawer);
    }

    const drawers = await Drawer.find(drawerQuery);
    
    if (drawers.length === 0) {
      return res.json(emptySensorResponse);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const drawerIds = drawers.map((d) => d._id);
    const latestResult = await DrawerReading.aggregate([
      {
        $match: {
          drawerId: { $in: drawerIds },
          date: { $gte: today },
        },
      },
      { $unwind: "$readings" },
      { $sort: { "readings.timestamp": -1 } },
      { $limit: 1 },
      { $replaceRoot: { newRoot: "$readings" } },
    ]);

    if (!latestResult || latestResult.length === 0) {
      return res.json(emptySensorResponse);
    }

    const latest = latestResult[0];

    res.json({
      temperature: latest.temperature ?? null,
      humidity: latest.humidity ?? null,
      moisture: computeMoisture(latest),
      leftSubstrate: latest.leftSubstrate ?? latest.leftSoil ?? null,
      centerSubstrate: latest.centerSubstrate ?? latest.centerSoil ?? null,
      rightSubstrate: latest.rightSubstrate ?? latest.rightSoil ?? null,
      ammonia: latest.ammonia ?? null,
      timestamp: latest.timestamp,
    });
  } catch (error) {
    console.error("Failed to fetch latest sensor data:", {
      deviceId: req.params?.deviceId,
      drawer: req.query?.drawer,
      message: error.message,
    });
    res.status(500).json({ error: "Failed to fetch sensor data" });
  }
});

router.get("/device/:deviceId/history", requireAuth, requireDeviceMembership, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { from, to } = req.query;

    const drawers = await Drawer.find({ deviceId });
    
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

    const drawerMap = {};
    drawers.forEach((d) => {
      drawerMap[d._id.toString()] = d.name;
    });

    const result = readings.map((r) => ({
      ...r.toObject(),
      drawerId: drawerMap[r.drawerId.toString()] || r.drawerId,
    }));

    res.json(result);
  } catch (error) {
    console.error("Failed to fetch sensor history:", {
      deviceId: req.params?.deviceId,
      from: req.query?.from,
      to: req.query?.to,
      message: error.message,
    });
    res.status(500).json({ error: "Failed to fetch sensor history" });
  }
});

router.get("/drawer/:drawerId", requireAuth, async (req, res) => {
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
      moisture: computeMoisture(latest),
      leftSubstrate: latest.leftSubstrate ?? latest.leftSoil ?? null,
      centerSubstrate: latest.centerSubstrate ?? latest.centerSoil ?? null,
      rightSubstrate: latest.rightSubstrate ?? latest.rightSoil ?? null,
      ammonia: latest.ammonia ?? null,
      timestamp: latest.timestamp,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch drawer data" });
  }
});

router.get("/device/:deviceId/hourly", requireAuth, requireDeviceMembership, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { drawer } = req.query;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.json([]);
    }

    const drawerQuery = { deviceId };
    if (drawer) {
      drawerQuery.name = normalizeDrawerName(drawer);
    }

    const drawers = await Drawer.find(drawerQuery);

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
        leftSubstrate: [],
        centerSubstrate: [],
        rightSubstrate: [],
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
              const computedMoisture = computeMoisture(reading);
              if (reading.temperature !== undefined) hourlyData[hourKey].temperature.push(reading.temperature);
              if (reading.humidity !== undefined) hourlyData[hourKey].humidity.push(reading.humidity);
              if (computedMoisture !== null) hourlyData[hourKey].moisture.push(computedMoisture);
              if (reading.leftSubstrate !== undefined) hourlyData[hourKey].leftSubstrate.push(Math.round(reading.leftSubstrate));
              if (reading.centerSubstrate !== undefined) hourlyData[hourKey].centerSubstrate.push(Math.round(reading.centerSubstrate));
              if (reading.rightSubstrate !== undefined) hourlyData[hourKey].rightSubstrate.push(Math.round(reading.rightSubstrate));
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
      moisture: h.moisture.length > 0 ? Math.round(h.moisture.reduce((a, b) => a + b, 0) / h.moisture.length) : null,
      leftSubstrate: h.leftSubstrate.length > 0 ? Math.round(h.leftSubstrate.reduce((a, b) => a + b, 0) / h.leftSubstrate.length) : null,
      centerSubstrate: h.centerSubstrate.length > 0 ? Math.round(h.centerSubstrate.reduce((a, b) => a + b, 0) / h.centerSubstrate.length) : null,
      rightSubstrate: h.rightSubstrate.length > 0 ? Math.round(h.rightSubstrate.reduce((a, b) => a + b, 0) / h.rightSubstrate.length) : null,
      ammonia: h.ammonia.length > 0 ? h.ammonia.reduce((a, b) => a + b, 0) / h.ammonia.length : null,
    }));

    res.json(result);
  } catch (error) {
    console.error("Failed to fetch hourly sensor data:", {
      deviceId: req.params?.deviceId,
      drawer: req.query?.drawer,
      message: error.message,
    });
    res.status(500).json({ error: "Failed to fetch hourly data" });
  }
});

export default router;
