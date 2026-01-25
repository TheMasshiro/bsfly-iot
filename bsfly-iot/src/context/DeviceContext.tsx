import { createContext, FC, ReactNode, useContext, useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";

const API_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000").replace(/\/+$/, "");

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
}

const DeviceContext = createContext<DeviceContextProps | null>(null);

export const DeviceProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useUser();
    const [devices, setDevices] = useState<Device[]>([]);
    const [currentDevice, setCurrentDevice] = useState<Device | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshDevices = async () => {
        if (!user?.id) {
            setDevices([]);
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/devices/user/${user.id}`);
            const data = await res.json();
            const deviceList = Array.isArray(data) ? data : [];
            setDevices(deviceList);

            // Auto-select first device if none selected or current device no longer exists
            if (deviceList.length > 0) {
                if (!currentDevice || !deviceList.find(d => d._id === currentDevice._id)) {
                    setCurrentDevice(deviceList[0]);
                }
            } else {
                setCurrentDevice(null);
            }
        } catch (error) {
            console.error("Failed to fetch devices:", error);
            setDevices([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshDevices();
    }, [user?.id]);

    return (
        <DeviceContext.Provider
            value={{
                devices,
                currentDevice,
                setCurrentDevice,
                refreshDevices,
                loading
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
