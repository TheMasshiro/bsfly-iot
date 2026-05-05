import { useState, useEffect, useCallback } from "react";
import { api, withToken } from "../utils/api";
import { useDevice } from "../context/DeviceContext";
import {
  CACHE_STALENESS_MS,
  STORAGE_KEYS,
} from "../config/storage";

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