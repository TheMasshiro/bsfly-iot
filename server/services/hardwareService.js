import axios from "axios";
import { publishMqtt } from "../mqttClient.js";
import logger from "../utils/logger.js";

const HTTP_TIMEOUT_MS = 5000;

/**
 * Hardware Service
 * Centralized business logic for device hardware operations
 * Handles HTTP proxying, MQTT fallback, and error recovery
 */

export const fetchHardwarePageFromEsp32 = async (ipAddress) => {
  if (!ipAddress) {
    logger.debug("No IP address available for hardware page");
    return null;
  }

  try {
    logger.debug(`Fetching hardware page from ESP32 at ${ipAddress}`);
    const response = await axios.get(`http://${ipAddress}:80/hardware`, {
      timeout: HTTP_TIMEOUT_MS,
    });

    if (response.data) {
      logger.debug(`Successfully fetched hardware page from ${ipAddress}`);
      return response.data;
    }
  } catch (error) {
    logger.warn(
      `Failed to fetch hardware page from ${ipAddress}: ${error.code || error.message}`
    );
    return null;
  }
};

export const fetchCalibrationStatusFromEsp32 = async (ipAddress) => {
  if (!ipAddress) {
    logger.debug("No IP address available for calibration status");
    return null;
  }

  try {
    logger.debug(`Fetching calibration status from ESP32 at ${ipAddress}`);
    const response = await axios.get(
      `http://${ipAddress}:80/calibration/status`,
      { timeout: HTTP_TIMEOUT_MS }
    );

    if (response.data) {
      logger.debug(`Successfully fetched calibration status from ${ipAddress}`);
      return response.data;
    }
  } catch (error) {
    logger.warn(
      `Failed to fetch calibration status from ${ipAddress}: ${error.code || error.message}`
    );
    return null;
  }
};

export const triggerCalibrationViaDirect = async (ipAddress) => {
  if (!ipAddress) {
    logger.debug("No IP address available for direct calibration");
    return null;
  }

  try {
    logger.debug(`Triggering calibration on ESP32 at ${ipAddress}`);
    const response = await axios.post(
      `http://${ipAddress}:80/calibrate/all`,
      {},
      { timeout: HTTP_TIMEOUT_MS }
    );

    if (response.data && response.data.success) {
      logger.info(`Successfully triggered calibration on ${ipAddress}`);
      return response.data;
    }

    logger.warn(`Calibration response was not successful from ${ipAddress}`);
    return null;
  } catch (error) {
    logger.warn(
      `Failed to trigger calibration on ${ipAddress}: ${error.code || error.message}`
    );
    return null;
  }
};

export const triggerRebootViaDirect = async (ipAddress) => {
  if (!ipAddress) {
    logger.debug("No IP address available for direct reboot");
    return null;
  }

  try {
    logger.debug(`Triggering reboot on ESP32 at ${ipAddress}`);
    const response = await axios.post(
      `http://${ipAddress}:80/reboot`,
      {},
      { timeout: HTTP_TIMEOUT_MS }
    );

    logger.info(`Successfully triggered reboot on ${ipAddress}`);
    return response.data || { success: true };
  } catch (error) {
    logger.warn(
      `Failed to trigger reboot on ${ipAddress}: ${error.code || error.message}`
    );
    return null;
  }
};

export const triggerCalibrationViaMqtt = async (macAddress) => {
  try {
    const topic = `devices/${macAddress}/calibrate/all/command`;
    logger.debug(`Publishing calibration command to MQTT topic: ${topic}`);

    await publishMqtt(topic, JSON.stringify({ action: "calibrate_all" }), true);

    logger.info(`Successfully published calibration command for ${macAddress}`);
    return true;
  } catch (error) {
    logger.error(`Failed to publish calibration command via MQTT: ${error.message}`);
    return false;
  }
};

export const triggerRebootViaMqtt = async (macAddress) => {
  try {
    const topic = `devices/${macAddress}/actuators/reboot/command`;
    logger.debug(`Publishing reboot command to MQTT topic: ${topic}`);

    await publishMqtt(topic, JSON.stringify({ action: "reboot" }), true);

    logger.info(`Successfully published reboot command for ${macAddress}`);
    return true;
  } catch (error) {
    logger.error(`Failed to publish reboot command via MQTT: ${error.message}`);
    return false;
  }
};

export default {
  fetchHardwarePageFromEsp32,
  fetchCalibrationStatusFromEsp32,
  triggerCalibrationViaDirect,
  triggerRebootViaDirect,
  triggerCalibrationViaMqtt,
  triggerRebootViaMqtt,
};
