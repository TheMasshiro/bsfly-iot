import { useState, useEffect, useCallback } from "react";
import { api, withToken } from "../utils/api";
import { useDevice } from "../context/DeviceContext";
import {
  DeviceStatusResponse,
  LastStatusResponse,
} from "../types/hardware";
import {
  STORAGE_KEYS,
  CACHE_STALENESS_MS,
} from "../config/storage";

interface HardwareStatusState {
  uptime?: string;
  wifiConnected?: string;
  autoControlActive?: string;
  loading: boolean;
  error: string | null;
  isStale: boolean;
  lastUpdated: Date | null;
}

/**
 * Hook: Fetch and cache device hardware status
 * Handles backend caching and localStorage fallback
 */
export const useHardwareStatus = (deviceId: string | undefined) => {
  const { getToken } = useDevice();
  const [status, setStatus] = useState<HardwareStatusState>(() => {
    const cached = localStorage.getItem(STORAGE_KEYS.HARDWARE_STATUS);
    const timestamp = localStorage.getItem(
      STORAGE_KEYS.HARDWARE_STATUS_TIMESTAMP
    );
    const lastUpdated = timestamp ? new Date(timestamp) : null;
    const isStale =
      !lastUpdated ||
      new Date().getTime() - lastUpdated.getTime() > CACHE_STALENESS_MS;

    return {
      loading: false,
      error: null,
      isStale,
      lastUpdated,
      ...parseStatusString(cached),
    };
  });

  const refreshStatus = useCallback(async () => {
    if (!deviceId) return;

    setStatus((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const token = await getToken();

      // Try backend first
      const { data } = await api.get<LastStatusResponse>(
        `/api/devices/${deviceId}/last-status`,
        withToken(token)
      );

      if (data.hasData) {
        const formatted = formatStatusData(data);
        setStatus({
          ...formatted,
          loading: false,
          error: null,
          isStale: false,
          lastUpdated: new Date(),
        });
        localStorage.setItem(
          STORAGE_KEYS.HARDWARE_STATUS,
          formatStatusForStorage(data)
        );
        localStorage.setItem(
          STORAGE_KEYS.HARDWARE_STATUS_TIMESTAMP,
          new Date().toISOString()
        );
      } else {
        setStatus((prev) => ({
          ...prev,
          loading: false,
          error: "No status data available",
        }));
      }
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error ||
        err?.message ||
        "Failed to fetch status";
      setStatus((prev) => ({
        ...prev,
        loading: false,
        error: errorMsg,
      }));
    }
  }, [deviceId, getToken]);

  // Load cached data on device change
  useEffect(() => {
    if (!deviceId) {
      setStatus({
        loading: false,
        error: null,
        isStale: true,
        lastUpdated: null,
      });
      return;
    }

    // Try to load from backend on mount
    refreshStatus();
  }, [deviceId, refreshStatus]);

  return { status, refreshStatus };
};

/**
 * Hook: Fetch and cache device calibration status
 */
export const useDeviceCalibration = (deviceId: string | undefined) => {
  const { getToken } = useDevice();
  const [calibration, setCalibration] = useState<{
    lastCalibrationTime: string | null;
    loading: boolean;
    error: string | null;
    isStale: boolean;
    lastUpdated: Date | null;
  }>(() => {
    const cached = localStorage.getItem(
      STORAGE_KEYS.HARDWARE_CALIBRATION
    );
    const timestamp = localStorage.getItem(
      STORAGE_KEYS.HARDWARE_CALIBRATION_TIMESTAMP
    );
    const lastUpdated = timestamp ? new Date(timestamp) : null;
    const isStale =
      !lastUpdated ||
      new Date().getTime() - lastUpdated.getTime() > CACHE_STALENESS_MS;

    return {
      lastCalibrationTime: cached || null,
      loading: false,
      error: null,
      isStale,
      lastUpdated,
    };
  });

  const refreshCalibration = useCallback(async () => {
    if (!deviceId) return;

    setCalibration((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const token = await getToken();
      const { data } = await api.get(
        `/api/devices/${deviceId}/last-calibration`,
        withToken(token)
      );

      if (data.hasData && data.lastCalibrationTime) {
        const message = `Calibrated: ${new Date(
          data.lastCalibrationTime
        ).toLocaleString()}`;
        setCalibration({
          lastCalibrationTime: message,
          loading: false,
          error: null,
          isStale: false,
          lastUpdated: new Date(),
        });
        localStorage.setItem(
          STORAGE_KEYS.HARDWARE_CALIBRATION,
          message
        );
        localStorage.setItem(
          STORAGE_KEYS.HARDWARE_CALIBRATION_TIMESTAMP,
          new Date().toISOString()
        );
      }
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error ||
        err?.message ||
        "Failed to fetch calibration";
      setCalibration((prev) => ({
        ...prev,
        loading: false,
        error: errorMsg,
      }));
    }
  }, [deviceId, getToken]);

  useEffect(() => {
    if (!deviceId) {
      setCalibration({
        lastCalibrationTime: null,
        loading: false,
        error: null,
        isStale: true,
        lastUpdated: null,
      });
      return;
    }

    refreshCalibration();
  }, [deviceId, refreshCalibration]);

  return { calibration, refreshCalibration };
};

/**
 * Helper: Parse status string from storage
 */
function parseStatusString(
  statusStr: string | null
): Partial<HardwareStatusState> {
  if (!statusStr) return {};

  try {
    const lines = statusStr.split("\n");
    const data: Partial<HardwareStatusState> = {};

    for (const line of lines) {
      if (line.includes("Uptime:")) {
        data.uptime = line.replace("Uptime: ", "");
      } else if (line.includes("WiFi:")) {
        data.wifiConnected = line.replace("WiFi: ", "");
      } else if (line.includes("Auto Control:")) {
        data.autoControlActive = line.replace("Auto Control: ", "");
      }
    }

    return data;
  } catch {
    return {};
  }
}

/**
 * Helper: Format status data for display
 */
function formatStatusData(
  data: LastStatusResponse
): Partial<HardwareStatusState> {
  return {
    uptime: data.uptime
      ? `Uptime: ${Math.floor(data.uptime / 3600)}h ${Math.floor(
          (data.uptime % 3600) / 60
        )}m`
      : undefined,
    wifiConnected: data.wifiConnected
      ? `WiFi: ${data.wifiConnected ? "Connected" : "Disconnected"}`
      : undefined,
    autoControlActive: data.autoControlActive
      ? `Auto Control: ${
          data.autoControlActive ? "Active" : "Inactive"
        }`
      : undefined,
  };
}

/**
 * Helper: Format status data for localStorage
 */
function formatStatusForStorage(data: LastStatusResponse): string {
  const lines = [];
  if (data.uptime) {
    lines.push(
      `Uptime: ${Math.floor(data.uptime / 3600)}h ${Math.floor(
        (data.uptime % 3600) / 60
      )}m`
    );
  }
  if (data.wifiConnected !== undefined) {
    lines.push(`WiFi: ${data.wifiConnected ? "Connected" : "Disconnected"}`);
  }
  if (data.autoControlActive !== undefined) {
    lines.push(`Auto Control: ${data.autoControlActive ? "Active" : "Inactive"}`);
  }
  return lines.join("\n");
}
