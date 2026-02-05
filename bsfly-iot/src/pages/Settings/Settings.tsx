import {
    IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList,
    IonPage, IonButton, IonBadge, IonAlert, IonText, useIonToast, IonChip,
    IonRefresher, IonRefresherContent, IonNote, IonModal, IonButtons, IonTitle,
    IonToolbar, IonItemSliding, IonItemOptions, IonItemOption, IonActionSheet
} from "@ionic/react";
import { hardwareChip, helpCircle, add, logOut, refresh, copy, people, personRemove, swapHorizontal, close, chevronForward } from "ionicons/icons";
import { FC, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
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
    name?: string;
    email?: string;
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
    const { userId, getToken } = useAuth();
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

    const [showMembersModal, setShowMembersModal] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
    const [members, setMembers] = useState<DeviceMember[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);

    const [showRemoveAlert, setShowRemoveAlert] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState<DeviceMember | null>(null);

    const [showTransferSheet, setShowTransferSheet] = useState(false);
    const [memberToTransfer, setMemberToTransfer] = useState<DeviceMember | null>(null);

    const slidingRefs = useRef<Map<string, HTMLIonItemSlidingElement>>(new Map());

    const fetchDevices = useCallback(async () => {
        if (!userId) return;
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/devices/user/me`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await res.json();
            setDevices(Array.isArray(data) ? data : []);
        } catch {
        } finally {
            setLoading(false);
        }
    }, [userId, getToken]);

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

        if (!userId) {
            present({ message: "Please sign in", duration: 2000, color: "warning" });
            return;
        }

        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/devices/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    deviceId: macAddress.toUpperCase(),
                    name: deviceName
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

        if (!userId) {
            present({ message: "Please sign in", duration: 2000, color: "warning" });
            return;
        }

        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/devices/join`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ joinCode })
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
        if (!userId) return;

        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/devices/${device._id}/leave`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            present({
                message: device.ownerId === userId ? "Device deleted" : "Left device",
                duration: 2000,
                color: "success"
            });
            fetchDevices();
        } catch (error: any) {
            present({ message: error.message, duration: 2000, color: "danger" });
        }
    };

    const regenerateCode = async (device: Device) => {
        if (!userId) return;

        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/devices/${device._id}/regenerate-code`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
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

    const openMembersModal = async (device: Device) => {
        setSelectedDevice(device);
        setShowMembersModal(true);
        setMembersLoading(true);

        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/devices/${device._id}/members`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setMembers(data);
        } catch (error: any) {
            present({ message: error.message, duration: 2000, color: "danger" });
        } finally {
            setMembersLoading(false);
        }
    };

    const removeMember = async () => {
        if (!userId || !selectedDevice || !memberToRemove) return;

        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/devices/${selectedDevice._id}/members/${memberToRemove.userId}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            present({ message: "Member removed", duration: 2000, color: "success" });
            setMembers(members.filter(m => m.userId !== memberToRemove.userId));
            fetchDevices();
        } catch (error: any) {
            present({ message: error.message, duration: 2000, color: "danger" });
        }
    };

    const transferOwnership = async () => {
        if (!userId || !selectedDevice || !memberToTransfer) return;

        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/devices/${selectedDevice._id}/members/${memberToTransfer.userId}/role`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ role: "owner" })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            present({ message: "Ownership transferred", duration: 2000, color: "success" });
            setShowMembersModal(false);
            fetchDevices();
        } catch (error: any) {
            present({ message: error.message, duration: 2000, color: "danger" });
        }
    };

    const handleCloseSlidingItem = async (memberId: string) => {
        const slidingEl = slidingRefs.current.get(memberId);
        if (slidingEl) {
            await slidingEl.close();
        }
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
                        <IonButton expand="block" onClick={registerDevice} className="full-width-btn" disabled={!!macError || !!nameError}>
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
                        <IonButton expand="block" onClick={joinDevice} className="full-width-btn" disabled={!!joinCodeError}>
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
                        <div className="skeleton-container">
                            <LoadingSkeleton variant="list-item" count={2} />
                        </div>
                    ) : devices.length === 0 ? (
                        <IonItem>
                            <IonLabel color="medium">No devices yet. Register or join one above.</IonLabel>
                        </IonItem>
                    ) : (
                        devices.map((device) => {
                            const isOwner = device.ownerId === userId;
                            return (
                                <div key={device._id}>
                                    <IonItem>
                                        <IonLabel>
                                            <h2>{device.name}</h2>
                                            <p>{device._id}</p>
                                            <p>
                                                <IonChip color={device.status === "online" ? "success" : "medium"}>
                                                    {device.status === "online" ? "Online" : "Offline"}
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

                                    {isOwner && (
                                        <IonItem button detail detailIcon={chevronForward} onClick={() => openMembersModal(device)}>
                                            <IonIcon icon={people} slot="start" />
                                            <IonLabel>Manage Members</IonLabel>
                                            <IonBadge slot="end">{device.members.length}</IonBadge>
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

                <IonModal isOpen={showMembersModal} onDidDismiss={() => setShowMembersModal(false)}>
                    <IonHeader>
                        <IonToolbar>
                            <IonTitle>Members</IonTitle>
                            <IonButtons slot="end">
                                <IonButton onClick={() => setShowMembersModal(false)}>
                                    <IonIcon icon={close} />
                                </IonButton>
                            </IonButtons>
                        </IonToolbar>
                    </IonHeader>
                    <IonContent>
                        <IonList>
                            {membersLoading ? (
                                <div className="skeleton-container">
                                    <LoadingSkeleton variant="list-item" count={3} />
                                </div>
                            ) : members.length === 0 ? (
                                <IonItem>
                                    <IonLabel color="medium">No members found</IonLabel>
                                </IonItem>
                            ) : (
                                members.map((member) => {
                                    const isCurrentUser = member.userId === userId;
                                    const isOwnerMember = member.role === "owner";

                                    return (
                                        <IonItemSliding
                                            key={member.userId}
                                            disabled={isCurrentUser}
                                            ref={(el) => {
                                                if (el) {
                                                    slidingRefs.current.set(member.userId, el);
                                                } else {
                                                    slidingRefs.current.delete(member.userId);
                                                }
                                            }}
                                        >
                                            {!isCurrentUser && !isOwnerMember && (
                                                <IonItemOptions side="start">
                                                    <IonItemOption
                                                        color="primary"
                                                        onClick={() => {
                                                            handleCloseSlidingItem(member.userId);
                                                            setMemberToTransfer(member);
                                                            setShowTransferSheet(true);
                                                        }}
                                                    >
                                                        <IonIcon slot="icon-only" icon={swapHorizontal} />
                                                    </IonItemOption>
                                                </IonItemOptions>
                                            )}
                                            <IonItem>
                                                <IonLabel>
                                                    <h2>{member.name || "Unknown User"}</h2>
                                                    <p>{member.email}</p>
                                                </IonLabel>
                                                <IonChip slot="end" color={isOwnerMember ? "primary" : "medium"}>
                                                    {isOwnerMember ? "Owner" : "Member"}
                                                </IonChip>
                                            </IonItem>
                                            {!isCurrentUser && !isOwnerMember && (
                                                <IonItemOptions side="end">
                                                    <IonItemOption
                                                        color="danger"
                                                        onClick={() => {
                                                            handleCloseSlidingItem(member.userId);
                                                            setMemberToRemove(member);
                                                            setShowRemoveAlert(true);
                                                        }}
                                                    >
                                                        <IonIcon slot="icon-only" icon={personRemove} />
                                                    </IonItemOption>
                                                </IonItemOptions>
                                            )}
                                        </IonItemSliding>
                                    );
                                })
                            )}
                        </IonList>
                    </IonContent>
                </IonModal>

                <IonAlert
                    isOpen={showRemoveAlert}
                    onDidDismiss={() => setShowRemoveAlert(false)}
                    header="Remove Member?"
                    message={`Remove ${memberToRemove?.name || "this member"} from the device?`}
                    buttons={[
                        { text: "Cancel", role: "cancel" },
                        {
                            text: "Remove",
                            role: "destructive",
                            handler: removeMember
                        }
                    ]}
                />

                <IonActionSheet
                    isOpen={showTransferSheet}
                    onDidDismiss={() => setShowTransferSheet(false)}
                    header={`Transfer ownership to ${memberToTransfer?.name}?`}
                    subHeader="You will become a regular member."
                    buttons={[
                        {
                            text: "Transfer Ownership",
                            role: "destructive",
                            handler: transferOwnership
                        },
                        { text: "Cancel", role: "cancel" }
                    ]}
                />

                <IonAlert
                    isOpen={showLeaveAlert}
                    onDidDismiss={() => setShowLeaveAlert(false)}
                    header={deviceToLeave?.ownerId === userId ? "Delete Device?" : "Leave Device?"}
                    message={
                        deviceToLeave?.ownerId === userId
                            ? "This will remove the device for all members."
                            : "You can rejoin later with a join code."
                    }
                    buttons={[
                        { text: "Cancel", role: "cancel" },
                        {
                            text: deviceToLeave?.ownerId === userId ? "Delete" : "Leave",
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
