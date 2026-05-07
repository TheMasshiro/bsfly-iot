/**
 * Storage Constants
 * Centralized localStorage key management
 */

export const STORAGE_KEYS = {
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
  CALIBRATION: 1000 * 60 * 60 * 24, // 1 day
} as const;
