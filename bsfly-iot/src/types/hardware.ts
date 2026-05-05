/**
 * Hardware API Response Types
 * Type-safe contracts for all hardware endpoints
 */

export interface DeviceStatusResponse {
  uptime: number;
  wifiConnected: boolean;
  autoControlActive: boolean;
  requestedControlMode: string;
  sdAvailable: boolean;
  storedCount: number;
  deviceId: string;
  ip: string;
  source: "direct" | "cache";
  cachedAt?: string;
}

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

export interface LastStatusResponse {
  hasData: boolean;
  message?: string;
  lastStatusUpdateTime?: string;
  uptime?: number;
  wifiConnected?: boolean;
  autoControlActive?: boolean;
  source?: "direct" | "cache";
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
