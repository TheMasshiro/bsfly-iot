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

    if (hardwareData) {
      device.hardwareInfo = hardwareData;
      device.hardwareInfoCachedAt = new Date();
      await device.save();
      logger.info("Fetched hardware page directly from device", {
        deviceId: device._id,
      });

      return res.json({
        source: "direct",
        cached: false,
        data: hardwareData,
      });
    }

    // Check if cached data is fresh
    const cacheExpiry = device.hardwareInfoCachedAt
      ? new Date(device.hardwareInfoCachedAt.getTime() + CACHE_VALIDITY_MS)
      : null;
    const isCacheFresh =
      cacheExpiry && new Date() < cacheExpiry && device.hardwareInfo;

    if (isCacheFresh) {
      logger.debug("Returning fresh cached hardware data", { deviceId: device._id });
      return res.json({
        source: "cache",
        cached: true,
        cachedAt: device.hardwareInfoCachedAt,
        data: device.hardwareInfo,
      });
    }

    logger.warn("Device offline - hardware page unavailable", {
      deviceId: device._id,
    });
    res.status(503).json({
      source: "offline",
      error: "Device is offline. Unable to reach hardware page.",
      lastCachedData: device.hardwareInfo || null,
      lastSeenAt: device.lastSeen || null,
    });
  } catch (error) {
    logger.error("Error fetching hardware", { error: error.message, deviceId: req.params.deviceId });
    res.status(500).json({ error: "Failed to fetch hardware page" });
  }
});

/**
 * GET /api/devices/:deviceId/hardware-url
 * Resolve OTA hardware page URL from stored device IP
 */
router.get("/:deviceId/hardware-url", requireAuth, verifyDeviceAccess, async (req, res) => {
  try {
    const device = req.device;

    if (!device.ipAddress) {
      return res.status(404).json({
        error: "Device has not reported an IP address yet",
        deviceId: device._id,
        macAddress: device.macAddress,
      });
    }

    res.json({
      deviceId: device._id,
      macAddress: device.macAddress,
      ipAddress: device.ipAddress,
      url: `http://${device.ipAddress}/hardware`,
    });
  } catch (error) {
    logger.error("Error resolving hardware URL", { error: error.message });
    res.status(500).json({ error: "Failed to resolve hardware URL" });
  }
});

/**
 * POST /api/devices/:deviceId/reboot
 * Trigger ESP32 reboot via direct HTTP or MQTT fallback
 */
router.post("/:deviceId/reboot", requireAuth, verifyDeviceAccess, async (req, res) => {
  try {
    const device = req.device;

    // Try direct HTTP first
    const rebootResult = await hardwareService.triggerRebootViaDirect(
      device.ipAddress
    );

    if (rebootResult) {
      logger.info("Reboot command sent via direct HTTP", { deviceId: device._id });
      return res.json({
        source: "direct",
        message: "Reboot command sent successfully",
      });
    }

    // Fall back to MQTT
    const mqttSuccess = await hardwareService.triggerRebootViaMqtt(
      device.macAddress
    );

    if (mqttSuccess) {
      logger.info("Reboot command queued via MQTT", { deviceId: device._id });
      return res.json({
        source: "mqtt",
        message: "Reboot command queued via MQTT",
      });
    }

    logger.warn("Device offline - reboot unavailable", { deviceId: device._id });
    res.status(503).json({
      source: "offline",
      error: "Device is offline. Reboot command could not be sent.",
    });
  } catch (error) {
    logger.error("Error triggering reboot", { error: error.message, deviceId: req.params.deviceId });
    res.status(500).json({ error: "Failed to trigger reboot" });
  }
});

/**
 * POST /api/devices/:deviceId/ip
 * Called by ESP32 to register its current IP address
 */
router.post("/:deviceId/ip", async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { ipAddress } = req.body;
    const apiKey = req.headers["x-api-key"];

    const device = await Device.findById(deviceId);
    if (!device) return res.status(404).json({ error: "Device not found" });

    // Verify API key
    if (!apiKey || apiKey !== device.apiKey) {
      logger.warn("Invalid API key for IP registration", { deviceId });
      return res.status(401).json({ error: "Invalid API key" });
    }

    // Validate IP format
    if (!ipAddress || !/^\d+\.\d+\.\d+\.\d+$/.test(ipAddress)) {
      logger.warn("Invalid IP address format", { deviceId, ipAddress });
      return res.status(400).json({ error: "Invalid IP address format" });
    }

    await updateDeviceIp(device, ipAddress);
    res.json({
      message: "IP address registered",
      ipAddress,
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
        ro: calibResult.ro,
        timestamp: calibResult.timestamp,
      });
    }

    // Fall back to MQTT
    const mqttSuccess = await hardwareService.triggerCalibrationViaMqtt(
      device.macAddress
    );

    if (mqttSuccess) {
      device.lastCalibrationTime = new Date();
      await device.save();
      logger.info("MQ137 calibration command queued via MQTT", {
        deviceId: device._id,
      });

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
    logger.error("Error triggering MQ137 calibration", {
      error: error.message,
      deviceId: req.params.deviceId,
    });
    res.status(500).json({ error: "Failed to trigger calibration" });
  }
});

/**
 * GET /api/devices/:deviceId/calibration-status
 * Get MQ137 calibration status and current Ro value
 */
router.get("/:deviceId/calibration-status", requireAuth, verifyDeviceAccess, async (req, res) => {
  try {
    const device = req.device;

    // Try direct HTTP first
    const statusData = await hardwareService.fetchCalibrationStatusFromEsp32(
      device.ipAddress
    );

    if (statusData) {
      if (statusData.ro) device.mq137Ro = statusData.ro;
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
    res.json({
      source: "cache",
      ro: device.mq137Ro || 3.6,
      lastCalibration: device.mq137LastCalibration,
      estimatedPpm: device.mq137EstimatedPpm || 0,
      warning: device.ipAddress
        ? "Device offline - showing cached values"
        : "No calibration data available yet",
    });
  } catch (error) {
    logger.error("Error getting calibration status", {
      error: error.message,
      deviceId: req.params.deviceId,
    });
    res.status(500).json({ error: "Failed to get calibration status" });
  }
});

/**
 * POST /api/devices/:deviceId/calibrate-all
 * Trigger calibration of all sensors (MQ137, substrate, temperature)
 * Intelligent fallback: Direct HTTP → MQTT → offline error
 */
router.post("/:deviceId/calibrate-all", requireAuth, verifyDeviceAccess, async (req, res) => {
  try {
    const device = req.device;

    // Try direct HTTP first
    const calibResult = await hardwareService.triggerCalibrationViaDirect(
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
    res.json({
      source: "offline",
      status: "offline",
      message: "Device has not reported status yet",
    });
  } catch (error) {
    logger.error("Error getting device status", {
      error: error.message,
      deviceId: req.params.deviceId,
    });
    res.status(500).json({ error: "Failed to get device status" });
  }
});

/**
 * GET /api/devices/:deviceId/last-calibration
 * Get the last calibration timestamp
 */
router.get("/:deviceId/last-calibration", requireAuth, verifyDeviceAccess, async (req, res) => {
  try {
    const device = req.device;

    res.json({
      lastCalibrationTime: device.lastCalibrationTime || null,
      hasData: !!device.lastCalibrationTime,
    });
  } catch (error) {
    logger.error("Error getting last calibration", {
      error: error.message,
      deviceId: req.params.deviceId,
    });
    res.status(500).json({ error: "Failed to get last calibration" });
  }
});

/**
 * GET /api/devices/:deviceId/last-status
 * Get the last cached device status
 */
router.get("/:deviceId/last-status", requireAuth, verifyDeviceAccess, async (req, res) => {
  try {
    const device = req.device;

    if (!device.lastStatusData) {
      return res.json({
        hasData: false,
        message: "No status data cached yet",
      });
    }

    res.json({
      hasData: true,
      lastStatusUpdateTime: device.lastStatusUpdateTime || null,
      ...device.lastStatusData,
    });
  } catch (error) {
    logger.error("Error getting last status", {
      error: error.message,
      deviceId: req.params.deviceId,
    });
    res.status(500).json({ error: "Failed to get last status" });
  }
});

export default router;
