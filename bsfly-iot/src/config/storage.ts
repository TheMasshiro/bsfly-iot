/**
 * Storage Constants
 * Centralized localStorage key management
 */

export const STORAGE_KEYS = {
  HARDWARE_STATUS: "hardware_status",
  HARDWARE_CALIBRATION: "hardware_calibration",
  HARDWARE_STATUS_TIMESTAMP: "hardware_status_timestamp",
  HARDWARE_CALIBRATION_TIMESTAMP: "hardware_calibration_timestamp",
  DEVICE_ID: "current_device_id",
} as const;

/**
 * Cache staleness threshold in milliseconds
 * Data older than this will be flagged as stale
 */
export const CACHE_STALENESS_MS = 1000 * 60 * 60; // 1 hour

/**
 * Backend data expiry constants
 * Matches server-side cache validity
 */
export const CACHE_VALIDITY = {
  STATUS: 1000 * 60 * 60, // 1 hour
  CALIBRATION: 1000 * 60 * 60 * 24, // 1 day
  HARDWARE_PAGE: 1000 * 60 * 60, // 1 hour
} as const;
