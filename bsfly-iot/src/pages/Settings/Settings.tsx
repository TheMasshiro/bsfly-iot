import {
    IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList,
    IonPage, IonButton, IonBadge, IonAlert, IonText, useIonToast, IonChip,
    IonRefresher, IonRefresherContent
} from "@ionic/react";
import { hardwareChip, helpCircle, add, logOut, refresh, copy, people } from "ionicons/icons";
import { FC, useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/clerk-react";
import { useDevice } from "../../context/DeviceContext";
import Toolbar from "../../components/Toolbar/Toolbar";
import "./Settings.css";

const API_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000").replace(/\/+$/, "");

interface DeviceMember {
    userId: string;
    role: "owner" | "member";
    joinedAt: string;
}

interface Device {
    _id: string;
    name: string;
    ownerId: string;
    status: "online" | "offline";
    joinCode: string;
    members: DeviceMember[];
    lastSeen?: string;
}

const Settings: FC = () => {
    const { user } = useUser();
    const [present] = useIonToast();
    const { refreshDevices } = useDevice();

    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);

    // Register device form
    const [macAddress, setMacAddress] = useState("");
    const [deviceName, setDeviceName] = useState("");

    // Join device form
    const [joinCode, setJoinCode] = useState("");

    // Alerts
    const [showLeaveAlert, setShowLeaveAlert] = useState(false);
    const [deviceToLeave, setDeviceToLeave] = useState<Device | null>(null);

    const fetchDevices = useCallback(async () => {
        if (!user?.id) return;
        try {
            const res = await fetch(`${API_URL}/api/devices/user/${user.id}`);
            const data = await res.json();
            setDevices(Array.isArray(data) ? data : []);
        } catch {
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchDevices();
    }, [fetchDevices]);

    const handleRefresh = async (event: CustomEvent) => {
        await Promise.all([fetchDevices(), refreshDevices()]);
        event.detail.complete();
    };

    const registerDevice = async () => {
        if (!user?.id || !macAddress || !deviceName) {
            present({ message: "Please fill in all fields", duration: 2000, color: "warning" });
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/devices/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    deviceId: macAddress.toUpperCase(),
                    name: deviceName,
                    userId: user.id
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            present({ message: "Device registered successfully!", duration: 2000, color: "success" });
            setMacAddress("");
            setDeviceName("");
            fetchDevices();
        } catch (error: any) {
            present({ message: error.message, duration: 2000, color: "danger" });
        }
    };

    const joinDevice = async () => {
        if (!user?.id || !joinCode) {
            present({ message: "Please enter a join code", duration: 2000, color: "warning" });
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/devices/join`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ joinCode, userId: user.id })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            present({ message: "Joined device successfully!", duration: 2000, color: "success" });
            setJoinCode("");
            fetchDevices();
        } catch (error: any) {
            present({ message: error.message, duration: 2000, color: "danger" });
        }
    };

    const leaveDevice = async (device: Device) => {
        if (!user?.id) return;

        try {
            const res = await fetch(`${API_URL}/api/devices/${device._id}/leave`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.id })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            present({
                message: device.ownerId === user.id ? "Device deleted" : "Left device",
                duration: 2000,
                color: "success"
            });
            fetchDevices();
        } catch (error: any) {
            present({ message: error.message, duration: 2000, color: "danger" });
        }
    };

    const regenerateCode = async (device: Device) => {
        if (!user?.id) return;

        try {
            const res = await fetch(`${API_URL}/api/devices/${device._id}/regenerate-code`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.id })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            present({ message: "Join code regenerated!", duration: 2000, color: "success" });
            fetchDevices();
        } catch (error: any) {
            present({ message: error.message, duration: 2000, color: "danger" });
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        present({ message: "Copied to clipboard!", duration: 1500, color: "success" });
    };

    return (
        <IonPage className="settings-page">
            <IonHeader class="ion-no-border">
                <Toolbar header={"Settings"} />
            </IonHeader>

            <IonContent fullscreen>
                <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
                    <IonRefresherContent />
                </IonRefresher>

                <IonList inset>
                    <IonItem lines="none">
                        <IonIcon icon={add} slot="start" />
                        <IonLabel>Register New ESP32</IonLabel>
                    </IonItem>
                    <IonItem>
                        <IonInput
                            label="Device Name"
                            labelPlacement="stacked"
                            placeholder="My Butterfly Farm"
                            value={deviceName}
                            onIonInput={(e) => setDeviceName(e.detail.value || "")}
                        />
                    </IonItem>
                    <IonItem>
                        <IonInput
                            label="MAC Address"
                            labelPlacement="stacked"
                            placeholder="AA:BB:CC:DD:EE:FF"
                            value={macAddress}
                            onIonInput={(e) => setMacAddress(e.detail.value || "")}
                        />
                    </IonItem>
                    <IonItem lines="none">
                        <IonButton expand="block" onClick={registerDevice} style={{ width: "100%" }}>
                            Register Device
                        </IonButton>
                    </IonItem>
                    <IonItem button href="https://github.com/TheMasshiro/bsfly-iot/blob/main/README.md" target="_blank">
                        <IonIcon icon={helpCircle} slot="start" />
                        <IonLabel color="medium">How to get ESP32 MAC Address?</IonLabel>
                    </IonItem>
                </IonList>

                <IonList inset>
                    <IonItem lines="none">
                        <IonIcon icon={people} slot="start" />
                        <IonLabel>Join Existing Device</IonLabel>
                    </IonItem>
                    <IonItem>
                        <IonInput
                            label="Join Code"
                            labelPlacement="stacked"
                            placeholder="Enter 8-character code"
                            value={joinCode}
                            onIonInput={(e) => setJoinCode(e.detail.value || "")}
                            maxlength={8}
                        />
                    </IonItem>
                    <IonItem lines="none">
                        <IonButton expand="block" onClick={joinDevice} style={{ width: "100%" }}>
                            Join Device
                        </IonButton>
                    </IonItem>
                </IonList>

                <IonList inset>
                    <IonItem lines="none">
                        <IonIcon icon={hardwareChip} slot="start" />
                        <IonLabel>My Devices</IonLabel>
                        <IonBadge slot="end">{devices.length}</IonBadge>
                    </IonItem>

                    {loading ? (
                        <IonItem>
                            <IonLabel color="medium">Loading...</IonLabel>
                        </IonItem>
                    ) : devices.length === 0 ? (
                        <IonItem>
                            <IonLabel color="medium">No devices yet. Register or join one above.</IonLabel>
                        </IonItem>
                    ) : (
                        devices.map((device) => {
                            const isOwner = device.ownerId === user?.id;
                            return (
                                <div key={device._id}>
                                    <IonItem>
                                        <IonLabel>
                                            <h2>{device.name}</h2>
                                            <p>{device._id}</p>
                                            <p>
                                                <IonChip color={device.status === "online" ? "success" : "medium"}>
                                                    {device.status}
                                                </IonChip>
                                                <IonChip color={isOwner ? "primary" : "secondary"}>
                                                    {isOwner ? "Owner" : "Member"}
                                                </IonChip>
                                                <IonChip>
                                                    <IonIcon icon={people} />
                                                    <IonLabel>{device.members.length}</IonLabel>
                                                </IonChip>
                                            </p>
                                        </IonLabel>
                                    </IonItem>

                                    {isOwner && (
                                        <IonItem>
                                            <IonLabel>
                                                <IonText color="medium">Join Code: </IonText>
                                                <IonText><strong>{device.joinCode}</strong></IonText>
                                            </IonLabel>
                                            <IonButton fill="clear" slot="end" onClick={() => copyToClipboard(device.joinCode)}>
                                                <IonIcon icon={copy} />
                                            </IonButton>
                                            <IonButton fill="clear" slot="end" onClick={() => regenerateCode(device)}>
                                                <IonIcon icon={refresh} />
                                            </IonButton>
                                        </IonItem>
                                    )}

                                    <IonItem lines="none">
                                        <IonButton
                                            color="danger"
                                            fill="clear"
                                            onClick={() => {
                                                setDeviceToLeave(device);
                                                setShowLeaveAlert(true);
                                            }}
                                        >
                                            <IonIcon icon={logOut} slot="start" />
                                            {isOwner ? "Delete Device" : "Leave Device"}
                                        </IonButton>
                                    </IonItem>
                                </div>
                            );
                        })
                    )}
                </IonList>

                <IonAlert
                    isOpen={showLeaveAlert}
                    onDidDismiss={() => setShowLeaveAlert(false)}
                    header={deviceToLeave?.ownerId === user?.id ? "Delete Device?" : "Leave Device?"}
                    message={
                        deviceToLeave?.ownerId === user?.id
                            ? "This will remove the device for all members."
                            : "You can rejoin later with a join code."
                    }
                    buttons={[
                        { text: "Cancel", role: "cancel" },
                        {
                            text: deviceToLeave?.ownerId === user?.id ? "Delete" : "Leave",
                            role: "destructive",
                            handler: () => {
                                if (deviceToLeave) leaveDevice(deviceToLeave);
                            }
                        }
                    ]}
                />
            </IonContent>
        </IonPage>
    );
};

export default Settings;
