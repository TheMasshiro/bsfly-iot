import express from "express";
import Device from "../models/User.Device.js";
import { requireAuth } from "../middleware/auth.js";
import logger from "../utils/logger.js";
import hardwareService from "../services/hardwareService.js";

const router = express.Router();

const CACHE_VALIDITY_MS = 1000 * 60 * 60; // 1 hour cache validity

/**
 * Middleware: Verify device access
 */
const verifyDeviceAccess = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const userId = req.userId;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    const isMember = device.members.some((m) => m.userId === userId);
    if (!isMember) {
      return res.status(403).json({ error: "Access denied" });
    }

    req.device = device;
    next();
  } catch (error) {
    logger.error("Error verifying device access", { error: error.message });
    res.status(500).json({ error: "Access verification failed" });
  }
};

/**
 * Helper: Update device IP address when ESP32 reports in
 */
const updateDeviceIp = async (device, newIp) => {
  if (device.ipAddress !== newIp) {
    device.ipAddress = newIp;
    logger.info(`Updated device IP`, { deviceId: device._id, newIp });
    await device.save();
  }
};

/**
 * GET /api/devices/:deviceId/hardware
 * Get hardware page with intelligent fallback
 */
router.get("/:deviceId/hardware", requireAuth, verifyDeviceAccess, async (req, res) => {
  try {
    const device = req.device;

    // Try direct HTTP first
    const hardwareData = await hardwareService.fetchHardwarePageFromEsp32(
      device.ipAddress
    );

    const device = req.device;

    if (!device.ipAddress) {
      return res.status(404).json({
        error: "Device has not reported an IP address yet",
        deviceId: device._id,
        macAddress: device.macAddress,
      });
    }

        message: "Reboot command sent successfully",
      });
    }

      previousIp: device.ipAddress || null,
    });
  } catch (error) {
    logger.error("Error updating device IP", { error: error.message });
    res.status(500).json({ error: "Failed to update IP address" });
  }
});

/**
 * POST /api/devices/:deviceId/calibrate-mq137
 * Trigger MQ137 ammonia sensor calibration
 */
router.post("/:deviceId/calibrate-mq137", requireAuth, verifyDeviceAccess, async (req, res) => {
  try {
    const device = req.device;

    // Try direct HTTP first
    const calibResult = await hardwareService.triggerCalibrationViaDirect(
      device.ipAddress
    );

    if (calibResult) {
      device.mq137Ro = calibResult.ro || device.mq137Ro;
      device.mq137LastCalibration = new Date(calibResult.timestamp * 1000);
      device.lastCalibrationTime = new Date();
      await device.save();
      logger.info("MQ137 calibration successful via HTTP", { deviceId: device._id });

      return res.json({
        source: "direct",
        message: calibResult.message || "Calibration completed",
      if (statusData.timestamp) {
        device.mq137LastCalibration = new Date(statusData.timestamp * 1000);
      }
      if (statusData.estimatedPpm) device.mq137EstimatedPpm = statusData.estimatedPpm;
      await device.save();
      logger.debug("Fetched calibration status from device", {
        deviceId: device._id,
      });

      return res.json({
        source: "direct",
        ...statusData,
      });
    }

    // Return cached data
    logger.debug("Returning cached calibration status", { deviceId: device._id });
      device.ipAddress
    );

    if (calibResult && calibResult.success) {
      if (calibResult.mq137 && calibResult.mq137.ro) {
        device.mq137Ro = calibResult.mq137.ro;
        device.mq137LastCalibration = new Date(calibResult.mq137.timestamp * 1000);
      }
      device.lastCalibrationTime = new Date();
      await device.save();
      logger.info("All sensors calibrated successfully via HTTP", {
        deviceId: device._id,
      });

      return res.json({
        source: "direct",
        message: calibResult.message || "All sensors calibrated",
        data: calibResult,
      });
    }

    // Fall back to MQTT
    const mqttSuccess = await hardwareService.triggerCalibrationViaMqtt(
      device.macAddress
    );

    if (mqttSuccess) {
      device.lastCalibrationTime = new Date();
      await device.save();
      logger.info("Calibration command queued via MQTT", { deviceId: device._id });

      return res.json({
        source: "mqtt",
        message: "Calibration command sent via MQTT. Check device for results.",
        warning: "Results not immediately available",
      });
    }

    logger.warn("Device offline - calibration unavailable", { deviceId: device._id });
    res.status(503).json({
      source: "offline",
      error: "Device is offline. Calibration command could not be sent.",
    });
  } catch (error) {
    logger.error("Error triggering calibration", {
      error: error.message,
      deviceId: req.params.deviceId,
    });
    res.status(500).json({ error: "Failed to trigger calibration" });
  }
});

/**
 * GET /api/devices/:deviceId/device-status
 * Get device firmware and runtime status
 */
router.get("/:deviceId/device-status", requireAuth, verifyDeviceAccess, async (req, res) => {
  try {
    const device = req.device;

    // Try direct HTTP first
    const statusData = await hardwareService.fetchDeviceStatusFromEsp32(
      device.ipAddress
    );

    if (statusData) {
      device.lastStatusData = statusData;
      device.lastStatusUpdateTime = new Date();
      await device.save();
      logger.debug("Fetched device status from device", {
        deviceId: device._id,
      });

      return res.json({
        source: "direct",
        ...statusData,
      });
    }

    // Return cached data
    if (device.lastStatusData) {
      logger.debug("Returning cached device status", { deviceId: device._id });
      return res.json({
        source: "cache",
        ...device.lastStatusData,
        cachedAt: device.lastStatusUpdateTime,
      });
    }

    // No data available
    logger.warn("No device status available", { deviceId: device._id });
      deviceId: req.params.deviceId,
    });
    res.status(500).json({ error: "Failed to get last calibration" });
  }
});

export default router;
