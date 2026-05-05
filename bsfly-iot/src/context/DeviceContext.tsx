import { createContext, FC, ReactNode, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useUser, useAuth } from "@clerk/clerk-react";
import { offlineService } from "../services/offline/OfflineService";
import { actuatorService } from "../services/socket/socket";
import { api, withToken } from "../utils/api";
import { Device } from "../types/device";

export type { Device };

const CACHE_KEY_DEVICES = "devices";

interface DeviceContextProps {
    devices: Device[];
    currentDevice: Device | null;
    setCurrentDevice: (device: Device | null) => void;
    refreshDevices: () => Promise<void>;
    loading: boolean;
    getToken: () => Promise<string | null>;
}

const DeviceContext = createContext<DeviceContextProps | null>(null);

const updateDeviceCollection = (
    devices: Device[],
    deviceId: string,
    updates: Partial<Device>
) => devices.map((device) => (
    device._id === deviceId
        ? { ...device, ...updates }
        : device
));

const patchCurrentDevice = (
    currentDevice: Device | null,
    deviceId: string,
    updates: Partial<Device>
) => {
    if (!currentDevice || currentDevice._id !== deviceId) {
        return currentDevice;
    }

    return {
        ...currentDevice,
        ...updates,
    };
};

const selectCurrentDevice = (currentDevice: Device | null, devices: Device[]) => {
    if (devices.length === 0) {
        return null;
    }

    const matchedDevice = devices.find((device) => device._id === currentDevice?._id);
    return matchedDevice || devices[0];
};

export const DeviceProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useUser();
    const { getToken, isLoaded: authLoaded } = useAuth();
    const [devices, setDevices] = useState<Device[]>([]);
    const [currentDevice, setCurrentDevice] = useState<Device | null>(null);
    const [loading, setLoading] = useState(true);
    const fetchedRef = useRef(false);
    const userIdRef = useRef<string | null>(null);

    useEffect(() => {
        actuatorService.setTokenGetter(getToken);
    }, [getToken]);

    useEffect(() => {
        const applyLiveDeviceUpdate = (deviceId: string, updates: Partial<Device>) => {
            setDevices((prev) => updateDeviceCollection(prev, deviceId, updates));
            setCurrentDevice((prev) => patchCurrentDevice(prev, deviceId, updates));
        };

        const handleDeviceActivity = ({ deviceId, lastSeen }: { deviceId: string; lastSeen: string }) => {
            applyLiveDeviceUpdate(deviceId, { status: "online", lastSeen });
        };

        const handleModeUpdate = ({ deviceId, mode }: { deviceId: string; mode: "auto" | "manual" }) => {
            applyLiveDeviceUpdate(deviceId, { controlMode: mode });
        };

        actuatorService.onDeviceActivity(handleDeviceActivity);
        actuatorService.onMode(handleModeUpdate);

        return () => {
            actuatorService.offDeviceActivity(handleDeviceActivity);
            actuatorService.offMode(handleModeUpdate);
        };
    }, []);

    const refreshDevices = useCallback(async () => {
        if (!authLoaded || !user?.id) {
            setDevices([]);
            setLoading(false);
            return;
        }

        if (!offlineService.getOnlineStatus()) {
            const cached = offlineService.get<Device[]>(`${CACHE_KEY_DEVICES}_${user.id}`);
            if (cached) {
                setDevices(cached);
                setCurrentDevice((prev) => selectCurrentDevice(prev, cached));
            }
            setLoading(false);
            return;
        }

        try {
            const token = await getToken();
            const { data } = await api.get("/api/devices/user/me", withToken(token));
            const deviceList = Array.isArray(data) ? data : [];
            setDevices(deviceList);
            offlineService.set(`${CACHE_KEY_DEVICES}_${user.id}`, deviceList);

            setCurrentDevice((prev) => selectCurrentDevice(prev, deviceList));
        } catch {
            const cached = offlineService.get<Device[]>(`${CACHE_KEY_DEVICES}_${user.id}`);
            if (cached) {
                setDevices(cached);
            } else {
                setDevices([]);
            }
        } finally {
            setLoading(false);
        }
    }, [user?.id, getToken, authLoaded]);

    useEffect(() => {
        if (!authLoaded) return;
        
        if (user?.id && user.id !== userIdRef.current) {
            userIdRef.current = user.id;
            fetchedRef.current = false;
        }

        if (!fetchedRef.current && user?.id) {
            fetchedRef.current = true;
            refreshDevices();
        }
    }, [user?.id, refreshDevices, authLoaded]);

    return (
        <DeviceContext.Provider
            value={{
                devices,
                currentDevice,
                setCurrentDevice,
                refreshDevices,
                loading,
                getToken
            }}
        >
            {children}
        </DeviceContext.Provider>
    );
};

export const useDevice = () => {
    const context = useContext(DeviceContext);
    if (!context) throw new Error("useDevice must be used inside DeviceProvider");
    return context;
};
