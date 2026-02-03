import {
    IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList,
    IonPage, IonButton, IonBadge, IonAlert, IonText, useIonToast, IonChip,
    IonRefresher, IonRefresherContent, IonNote
} from "@ionic/react";
import { hardwareChip, helpCircle, add, logOut, refresh, copy, people } from "ionicons/icons";
import { FC, useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/clerk-react";
import { useDevice } from "../../context/DeviceContext";
import Toolbar from "../../components/Toolbar/Toolbar";
import LoadingSkeleton from "../../components/LoadingSkeleton/LoadingSkeleton";
import { validateMacAddress, validateDeviceName, validateJoinCode, formatMacAddress } from "../../utils/validation";
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
    status: "Online" | "Offline";
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

    const [macAddress, setMacAddress] = useState("");
    const [deviceName, setDeviceName] = useState("");
    const [macError, setMacError] = useState<string | undefined>();
    const [nameError, setNameError] = useState<string | undefined>();

    const [joinCode, setJoinCode] = useState("");
    const [joinCodeError, setJoinCodeError] = useState<string | undefined>();

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

    const handleMacChange = (value: string) => {
        const formatted = formatMacAddress(value);
        setMacAddress(formatted);
        if (formatted) {
            const result = validateMacAddress(formatted);
            setMacError(result.valid ? undefined : result.error);
        } else {
            setMacError(undefined);
        }
    };

    const handleNameChange = (value: string) => {
        setDeviceName(value);
        if (value) {
            const result = validateDeviceName(value);
            setNameError(result.valid ? undefined : result.error);
        } else {
            setNameError(undefined);
        }
    };

    const handleJoinCodeChange = (value: string) => {
        const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
        setJoinCode(cleaned);
        if (cleaned) {
            const result = validateJoinCode(cleaned);
            setJoinCodeError(result.valid ? undefined : result.error);
        } else {
            setJoinCodeError(undefined);
        }
    };

    const registerDevice = async () => {
        const macResult = validateMacAddress(macAddress);
        const nameResult = validateDeviceName(deviceName);

        setMacError(macResult.valid ? undefined : macResult.error);
        setNameError(nameResult.valid ? undefined : nameResult.error);

        if (!macResult.valid || !nameResult.valid) {
            present({ message: "Please fix validation errors", duration: 2000, color: "warning" });
            return;
        }

        if (!user?.id) {
            present({ message: "Please sign in", duration: 2000, color: "warning" });
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
            setMacError(undefined);
            setNameError(undefined);
            fetchDevices();
        } catch (error: any) {
            present({ message: error.message, duration: 2000, color: "danger" });
        }
    };

    const joinDevice = async () => {
        const codeResult = validateJoinCode(joinCode);
        setJoinCodeError(codeResult.valid ? undefined : codeResult.error);

        if (!codeResult.valid) {
            present({ message: "Please fix validation errors", duration: 2000, color: "warning" });
            return;
        }

        if (!user?.id) {
            present({ message: "Please sign in", duration: 2000, color: "warning" });
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
            setJoinCodeError(undefined);
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
                    <IonItem className={nameError ? 'ion-invalid' : ''}>
                        <IonInput
                            label="Device Name"
                            labelPlacement="stacked"
                            placeholder="My BSF Farm"
                            value={deviceName}
                            onIonInput={(e) => handleNameChange(e.detail.value || "")}
                            className={nameError ? 'ion-invalid ion-touched' : ''}
                        />
                        {nameError && <IonNote slot="error">{nameError}</IonNote>}
                    </IonItem>
                    <IonItem className={macError ? 'ion-invalid' : ''}>
                        <IonInput
                            label="MAC Address"
                            labelPlacement="stacked"
                            placeholder="AA:BB:CC:DD:EE:FF"
                            value={macAddress}
                            onIonInput={(e) => handleMacChange(e.detail.value || "")}
                            className={macError ? 'ion-invalid ion-touched' : ''}
                        />
                        {macError && <IonNote slot="error">{macError}</IonNote>}
                    </IonItem>
                    <IonItem lines="none">
                        <IonButton expand="block" onClick={registerDevice} style={{ width: "100%" }} disabled={!!macError || !!nameError}>
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
                    <IonItem className={joinCodeError ? 'ion-invalid' : ''}>
                        <IonInput
                            label="Join Code"
                            labelPlacement="stacked"
                            placeholder="Enter 8-character code"
                            value={joinCode}
                            onIonInput={(e) => handleJoinCodeChange(e.detail.value || "")}
                            maxlength={8}
                            className={joinCodeError ? 'ion-invalid ion-touched' : ''}
                        />
                        {joinCodeError && <IonNote slot="error">{joinCodeError}</IonNote>}
                    </IonItem>
                    <IonItem lines="none">
                        <IonButton expand="block" onClick={joinDevice} style={{ width: "100%" }} disabled={!!joinCodeError}>
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
                        <div style={{ padding: '8px 16px' }}>
                            <LoadingSkeleton variant="list-item" count={2} />
                        </div>
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
                                                <IonChip color={device.status === "Online" ? "success" : "medium"}>
                                                    {device.status === "Online" ? "Online" : "Offline"}
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
