
export const STORAGE_KEYS = {
  DEVICE_ID: "current_device_id",
} as const;

export const CACHE_STALENESS_MS = 1000 * 60 * 60; // 1 hour

export const CACHE_VALIDITY = {
  CALIBRATION: 1000 * 60 * 60 * 24, // 1 day
} as const;
