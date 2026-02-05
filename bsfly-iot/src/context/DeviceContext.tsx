import { createContext, FC, ReactNode, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useUser, useAuth } from "@clerk/clerk-react";
import { offlineService } from "../services/offline/OfflineService";
import { actuatorService } from "../services/socket/socket";

const API_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000").replace(/\/+$/, "");
const CACHE_KEY_DEVICES = "devices";

export interface Device {
    _id: string;
    name: string;
    ownerId: string;
    status: "online" | "offline";
    joinCode: string;
    members: { userId: string; role: string; joinedAt: string }[];
    lastSeen?: string;
}

interface DeviceContextProps {
    devices: Device[];
    currentDevice: Device | null;
    setCurrentDevice: (device: Device | null) => void;
    refreshDevices: () => Promise<void>;
    loading: boolean;
    getToken: () => Promise<string | null>;
}

const DeviceContext = createContext<DeviceContextProps | null>(null);

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
                setCurrentDevice(prev => {
                    if (cached.length > 0) {
                        const updated = cached.find(d => d._id === prev?._id);
                        return updated || cached[0];
                    }
                    return null;
                });
            }
            setLoading(false);
            return;
        }

        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/devices/user/me`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await res.json();
            const deviceList = Array.isArray(data) ? data : [];
            setDevices(deviceList);
            offlineService.set(`${CACHE_KEY_DEVICES}_${user.id}`, deviceList);

            setCurrentDevice(prev => {
                if (deviceList.length > 0) {
                    const updated = deviceList.find(d => d._id === prev?._id);
                    if (updated) {
                        return updated;
                    }
                    return deviceList[0];
                }
                return null;
            });
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
