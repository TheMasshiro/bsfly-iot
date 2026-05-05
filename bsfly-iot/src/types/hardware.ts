/**
 * Hardware API Response Types
 * Type-safe contracts for all hardware endpoints
 */

export interface HardwareUrlResponse {
  deviceId: string;
  macAddress: string;
  ipAddress: string;
  url: string;
}

export interface CalibrationStatusResponse {
  source: "direct" | "cache";
  ro?: number;
  lastCalibration?: string;
  estimatedPpm?: number;
  warning?: string;
  hasData?: boolean;
}

export interface LastCalibrationResponse {
  lastCalibrationTime: string | null;
  hasData: boolean;
}

export interface RebootResponse {
  source: "direct" | "mqtt" | "offline";
  message: string;
  error?: string;
}

export interface CalibrateResponse {
  source: "direct" | "mqtt" | "offline";
  message: string;
  warning?: string;
  error?: string;
  data?: Record<string, any>;
}

export interface HardwarePageResponse {
  source: "direct" | "cache" | "offline";
  cached: boolean;
  data?: Record<string, any>;
  cachedAt?: string;
  error?: string;
  lastCachedData?: Record<string, any> | null;
  lastSeenAt?: string | null;
}
