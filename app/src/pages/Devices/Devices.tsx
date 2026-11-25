import {
    IonActionSheet, IonAlert, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput,
    IonItem, IonItemOption, IonItemOptions, IonItemSliding, IonLabel, IonList, IonModal,
    IonTitle, IonToolbar, useIonToast
} from "@ionic/react";
import { close, copy, hardwareChip, keyOutline, logOut, people, personRemove, refresh, swapHorizontal } from "ionicons/icons";
import { FC, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useDevice } from "../../context/DeviceContext";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import Page from "../../components/ui/Page";
import StatusPill from "../../components/ui/StatusPill";
import LoadingSkeleton from "../../components/LoadingSkeleton/LoadingSkeleton";
import { validateMacAddress, validateDeviceName, validateJoinCode, formatMacAddress } from "../../utils/validation";
import { api, withToken } from "../../utils/api";
import { Device, DeviceMember } from "../../types/device";
import "./Devices.css";

const Devices: FC = () => {
    const { userId, getToken, isLoaded: authLoaded } = useAuth();
    const [present] = useIonToast();
    const { refreshDevices } = useDevice();

    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);

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
    const [apiKeyDevice, setApiKeyDevice] = useState<Device | null>(null);
    const [maskedApiKey, setMaskedApiKey] = useState("");
    const [apiKeyLoading, setApiKeyLoading] = useState(false);
    const [newApiKey, setNewApiKey] = useState<string | null>(null);
    const [showRegenerateAlert, setShowRegenerateAlert] = useState(false);
    const [memberToTransfer, setMemberToTransfer] = useState<DeviceMember | null>(null);

    const slidingRefs = useRef<Map<string, HTMLIonItemSlidingElement>>(new Map());

    const fetchDevices = useCallback(async () => {
        if (!authLoaded || !userId) return;
        try {
            const token = await getToken();
            const { data } = await api.get("/api/devices/user/me", withToken(token));
            setDevices(Array.isArray(data) ? data : []);
        } catch {
        } finally {
            setLoading(false);
        }
    }, [userId, getToken, authLoaded]);

    useEffect(() => {
        if (authLoaded) {
            fetchDevices();
        }
    }, [fetchDevices, authLoaded]);

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
            present({ message: "Fix the errors above and try again.", duration: 2000, color: "warning" });
            return;
        }

        if (!userId) {
            present({ message: "Sign in to continue.", duration: 2000, color: "warning" });
            return;
        }

        try {
            const token = await getToken();
            const { data: registered } = await api.post("/api/devices/register", {
                macAddress: macAddress.toUpperCase(),
                name: deviceName
            }, withToken(token));

            present({ message: "Device registered.", duration: 2000, color: "success" });
            if (registered?.apiKey) {
                setNewApiKey(registered.apiKey);
            }
            setMacAddress("");
            setDeviceName("");
            setMacError(undefined);
            setNameError(undefined);
            fetchDevices();
        } catch (error: any) {
            present({ message: error.response?.data?.error || error.message, duration: 2000, color: "danger" });
        }
    };

    const joinDevice = async () => {
        const codeResult = validateJoinCode(joinCode);
        setJoinCodeError(codeResult.valid ? undefined : codeResult.error);

        if (!codeResult.valid) {
            present({ message: "Fix the errors above and try again.", duration: 2000, color: "warning" });
            return;
        }

        if (!userId) {
            present({ message: "Sign in to continue.", duration: 2000, color: "warning" });
            return;
        }

        try {
            const token = await getToken();
            await api.post("/api/devices/join", { joinCode }, withToken(token));

            present({ message: "Joined device.", duration: 2000, color: "success" });
            setJoinCode("");
            setJoinCodeError(undefined);
            fetchDevices();
        } catch (error: any) {
            present({ message: error.response?.data?.error || error.message, duration: 2000, color: "danger" });
        }
    };

    const leaveDevice = async (device: Device) => {
        if (!userId) return;

        try {
            const token = await getToken();
            await api.delete(`/api/devices/${device._id}/leave`, withToken(token));

            present({
                message: device.ownerId === userId ? "Device deleted" : "Left device",
                duration: 2000,
                color: "success"
            });
            fetchDevices();
        } catch (error: any) {
            present({ message: error.response?.data?.error || error.message, duration: 2000, color: "danger" });
        }
    };

    const regenerateCode = async (device: Device) => {
        if (!userId) return;

        try {
            const token = await getToken();
            await api.post(`/api/devices/${device._id}/regenerate-code`, {}, withToken(token));

            present({ message: "Join code regenerated.", duration: 2000, color: "success" });
            fetchDevices();
        } catch (error: any) {
            present({ message: error.response?.data?.error || error.message, duration: 2000, color: "danger" });
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        present({ message: "Copied to clipboard.", duration: 1500, color: "success" });
    };

    const openMembersModal = async (device: Device) => {
        setSelectedDevice(device);
        setShowMembersModal(true);
        setMembersLoading(true);

        try {
            const token = await getToken();
            const { data } = await api.get(`/api/devices/${device._id}/members`, withToken(token));
            setMembers(data);
        } catch (error: any) {
            present({ message: error.response?.data?.error || error.message, duration: 2000, color: "danger" });
        } finally {
            setMembersLoading(false);
        }
    };

    const removeMember = async () => {
        if (!userId || !selectedDevice || !memberToRemove) return;

        try {
            const token = await getToken();
            await api.delete(`/api/devices/${selectedDevice._id}/members/${memberToRemove.userId}`, withToken(token));

            present({ message: "Member removed", duration: 2000, color: "success" });
            setMembers(members.filter(m => m.userId !== memberToRemove.userId));
            fetchDevices();
        } catch (error: any) {
            present({ message: error.response?.data?.error || error.message, duration: 2000, color: "danger" });
        }
    };

    const transferOwnership = async () => {
        if (!userId || !selectedDevice || !memberToTransfer) return;

        try {
            const token = await getToken();
            await api.patch(`/api/devices/${selectedDevice._id}/members/${memberToTransfer.userId}/role`, { role: "owner" }, withToken(token));

            present({ message: "Ownership transferred", duration: 2000, color: "success" });
            setShowMembersModal(false);
            fetchDevices();
        } catch (error: any) {
            present({ message: error.response?.data?.error || error.message, duration: 2000, color: "danger" });
        }
    };

    const openApiKey = async (device: Device) => {
        setApiKeyDevice(device);
        setMaskedApiKey("");
        setApiKeyLoading(true);

        try {
            const token = await getToken();
            const { data } = await api.get("/api/devices/" + device._id + "/api-key", withToken(token));
            setMaskedApiKey(data?.apiKey ?? "");
        } catch {
            present({ message: "Couldn't load the API key. Try again.", duration: 2000, color: "danger" });
        } finally {
            setApiKeyLoading(false);
        }
    };

    const regenerateApiKey = async () => {
        if (!apiKeyDevice) return;

        try {
            const token = await getToken();
            const { data } = await api.post("/api/devices/" + apiKeyDevice._id + "/regenerate-api-key", {}, withToken(token));
            setNewApiKey(data.apiKey);
            setApiKeyDevice(null);
            setMaskedApiKey("");
        } catch {
            present({ message: "Couldn't regenerate the key. Try again.", duration: 2000, color: "danger" });
        }
    };

    const handleCloseSlidingItem = async (memberId: string) => {
        const slidingEl = slidingRefs.current.get(memberId);
        if (slidingEl) {
            await slidingEl.close();
        }
    };

    const selected = devices.find((d) => d._id === selectedId) ?? devices[0] ?? null;
    const selectedOwner = selected?.ownerId === userId;
    const selectedOnline = selected?.status === "online";
    const memberCount = (n: number) => `${n} ${n === 1 ? "member" : "members"}`;

    return (
        <Page
            className="devices-page"
            title="Devices"
            subtitle="Add controllers, join a device, and manage who can use it."
            onRefresh={() => Promise.all([fetchDevices(), refreshDevices()])}
        >
            <div className="device-forms">
                <Card title="Add device">
                    <div className="form-stack">
                        <div className="field">
                            <IonInput
                                label="Device name"
                                labelPlacement="stacked"
                                fill="outline"
                                placeholder="My BSF Farm"
                                value={deviceName}
                                onIonInput={(e) => handleNameChange(e.detail.value || "")}
                                className={nameError ? "ion-invalid ion-touched" : ""}
                            />
                            {nameError && <p className="field-error" role="alert">{nameError}</p>}
                        </div>
                        <div className="field">
                            <IonInput
                                label="MAC address"
                                labelPlacement="stacked"
                                fill="outline"
                                placeholder="AA:BB:CC:DD:EE:FF"
                                value={macAddress}
                                onIonInput={(e) => handleMacChange(e.detail.value || "")}
                                className={macError ? "ion-invalid ion-touched" : ""}
                            />
                            {macError && <p className="field-error" role="alert">{macError}</p>}
                        </div>
                        <IonButton expand="block" onClick={registerDevice} disabled={!!macError || !!nameError}>
                            Register device
                        </IonButton>
                        <a
                            className="text-link"
                            href="https://github.com/TheMasshiro/bsfly-iot/blob/main/README.md#how-to-get-esp32-mac-address"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            How to find the ESP32 MAC address
                        </a>
                    </div>
                </Card>

                <Card title="Join with code">
                    <div className="form-stack">
                        <p className="card-help">Ask the device owner for the 8-character join code.</p>
                        <div className="field">
                            <IonInput
                                label="Join code"
                                labelPlacement="stacked"
                                fill="outline"
                                placeholder="Enter 8-character code"
                                value={joinCode}
                                maxlength={8}
                                onIonInput={(e) => handleJoinCodeChange(e.detail.value || "")}
                                className={joinCodeError ? "ion-invalid ion-touched" : ""}
                            />
                            {joinCodeError && <p className="field-error" role="alert">{joinCodeError}</p>}
                        </div>
                        <IonButton expand="block" onClick={joinDevice} disabled={!!joinCodeError}>
                            Join device
                        </IonButton>
                    </div>
                </Card>
            </div>

            <section className="device-list" aria-labelledby="device-list-title">
                <div className="section-head">
                    <h2 id="device-list-title">My devices</h2>
                    <span className="count mono">{devices.length}</span>
                </div>

                {loading ? (
                    <Card>
                        <LoadingSkeleton variant="list-item" count={2} />
                    </Card>
                ) : devices.length === 0 ? (
                    <Card>
                        <EmptyState icon={hardwareChip} title="No devices yet">
                            Register or join one above.
                        </EmptyState>
                    </Card>
                ) : (
                    <div className="device-grid">
                        {devices.map((device) => {
                            const isOwner = device.ownerId === userId;
                            const online = device.status === "online";
                            return (
                                <button
                                    key={device._id}
                                    type="button"
                                    className="device-card"
                                    aria-pressed={selected?._id === device._id}
                                    onClick={() => setSelectedId(device._id)}
                                >
                                    <span className="device-card-top">
                                        <span className="device-name">{device.name}</span>
                                        <StatusPill status="idle" plain>{isOwner ? "Owner" : "Member"}</StatusPill>
                                    </span>
                                    <span className="device-mac mono">{device.macAddress}</span>
                                    <span className="device-card-foot">
                                        <StatusPill status={online ? "ok" : "idle"}>{online ? "Online" : "Offline"}</StatusPill>
                                        <span className="device-members">{memberCount(device.members.length)}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            {selected && (
                <section className="device-detail card-grid" aria-label={`${selected.name} details`}>
                    <Card title="Device">
                        <dl className="bs-kv">
                            <dt>Status</dt>
                            <dd>
                                <StatusPill status={selectedOnline ? "ok" : "idle"}>{selectedOnline ? "Online" : "Offline"}</StatusPill>
                            </dd>
                            <dt>Your role</dt>
                            <dd>{selectedOwner ? "Owner" : "Member"}</dd>
                            <dt>MAC address</dt>
                            <dd>{selected.macAddress}</dd>
                        </dl>

                        {selectedOwner && (
                            <div className="join-code">
                                <div>
                                    <span className="muted">Join code</span>
                                    <span className="join-code-value mono">{selected.joinCode}</span>
                                </div>
                                <div className="inline-actions">
                                    <IonButton fill="outline" onClick={() => copyToClipboard(selected.joinCode)}>
                                        <IonIcon icon={copy} slot="start" />
                                        Copy
                                    </IonButton>
                                    <IonButton fill="outline" onClick={() => regenerateCode(selected)}>
                                        <IonIcon icon={refresh} slot="start" />
                                        New code
                                    </IonButton>
                                </div>
                            </div>
                        )}
                    </Card>

                    {selectedOwner && (
                        <Card title="Members">
                            <p className="big-number">
                                <span className="mono">{selected.members.length}</span>
                                {selected.members.length === 1 ? "member" : "members"}
                            </p>
                            <p className="card-help">Remove members or hand over ownership.</p>
                            <div className="card-action">
                                <IonButton expand="block" fill="outline" onClick={() => openMembersModal(selected)}>
                                    <IonIcon icon={people} slot="start" />
                                    Manage members
                                </IonButton>
                            </div>
                        </Card>
                    )}

                    {selectedOwner && (
                        <Card title="API key">
                            <p className="card-help">The ESP32 uses this key to send readings.</p>
                            <div className="card-action">
                                <IonButton expand="block" fill="outline" onClick={() => openApiKey(selected)}>
                                    <IonIcon icon={keyOutline} slot="start" />
                                    View API key
                                </IonButton>
                            </div>
                        </Card>
                    )}

                    <section className="danger-zone card-wide">
                        <div>
                            <h3>{selectedOwner ? "Delete device" : "Leave device"}</h3>
                            <p className="card-help">
                                {selectedOwner ? "Removes the device for all members." : "You can rejoin later with a join code."}
                            </p>
                        </div>
                        <IonButton
                            color="danger"
                            fill="outline"
                            onClick={() => {
                                setDeviceToLeave(selected);
                                setShowLeaveAlert(true);
                            }}
                        >
                            <IonIcon icon={logOut} slot="start" />
                            {selectedOwner ? "Delete device" : "Leave device"}
                        </IonButton>
                    </section>
                </section>
            )}

            <IonModal isOpen={showMembersModal} onDidDismiss={() => setShowMembersModal(false)}>
                <IonHeader>
                    <IonToolbar>
                        <IonTitle>Members</IonTitle>
                        <IonButtons slot="end">
                            <IonButton onClick={() => setShowMembersModal(false)} aria-label="Close">
                                <IonIcon icon={close} />
                            </IonButton>
                        </IonButtons>
                    </IonToolbar>
                </IonHeader>
                <IonContent>
                    <IonList>
                        {membersLoading ? (
                            <div className="device-skeleton">
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
                                                    aria-label="Make owner"
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
                                                <h2>{member.name || "Unknown user"}</h2>
                                                <p>{member.email}</p>
                                            </IonLabel>
                                            <span slot="end">
                                                <StatusPill status={isOwnerMember ? "ok" : "idle"} plain>
                                                    {isOwnerMember ? "Owner" : "Member"}
                                                </StatusPill>
                                            </span>
                                        </IonItem>
                                        {!isCurrentUser && !isOwnerMember && (
                                            <IonItemOptions side="end">
                                                <IonItemOption
                                                    color="danger"
                                                    aria-label="Remove member"
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

            <IonModal
                isOpen={apiKeyDevice !== null}
                onDidDismiss={() => {
                    setApiKeyDevice(null);
                    setMaskedApiKey("");
                }}
            >
                <IonHeader>
                    <IonToolbar>
                        <IonTitle>API key</IonTitle>
                        <IonButtons slot="end">
                            <IonButton onClick={() => setApiKeyDevice(null)} aria-label="Close">
                                <IonIcon icon={close} />
                            </IonButton>
                        </IonButtons>
                    </IonToolbar>
                </IonHeader>
                <IonContent className="ion-padding">
                    <p className="device-key-name">{apiKeyDevice?.name}</p>
                    {apiKeyLoading ? (
                        <LoadingSkeleton variant="list-item" count={1} />
                    ) : (
                        <p className="device-key-value">{maskedApiKey || "No key"}</p>
                    )}
                    <IonButton expand="block" color="danger" fill="outline" disabled={apiKeyLoading} onClick={() => setShowRegenerateAlert(true)}>
                        Regenerate key
                    </IonButton>
                </IonContent>
            </IonModal>

            <IonModal isOpen={newApiKey !== null} onDidDismiss={() => setNewApiKey(null)}>
                <IonHeader>
                    <IonToolbar>
                        <IonTitle>New API key</IonTitle>
                        <IonButtons slot="end">
                            <IonButton onClick={() => setNewApiKey(null)} aria-label="Close">
                                <IonIcon icon={close} />
                            </IonButton>
                        </IonButtons>
                    </IonToolbar>
                </IonHeader>
                <IonContent className="ion-padding">
                    <p className="device-key-value">{newApiKey}</p>
                    <IonButton expand="block" onClick={() => copyToClipboard(newApiKey ?? "")}>
                        <IonIcon icon={copy} slot="start" />
                        Copy
                    </IonButton>
                    <p className="device-key-note">Copy this now. It won't be shown again. Paste it into DEVICE_API_KEY in credentials.h.</p>
                </IonContent>
            </IonModal>

            <IonAlert
                isOpen={showRegenerateAlert}
                onDidDismiss={() => setShowRegenerateAlert(false)}
                header="Regenerate API key?"
                message="The current key stops working right away. Flash the new key to the ESP32."
                buttons={[
                    { text: "Cancel", role: "cancel" },
                    { text: "Regenerate", role: "destructive", handler: () => { void regenerateApiKey(); } }
                ]}
            />

            <IonAlert
                isOpen={showRemoveAlert}
                onDidDismiss={() => setShowRemoveAlert(false)}
                header="Remove member?"
                message={`Remove ${memberToRemove?.name || "this member"} from the device?`}
                buttons={[
                    { text: "Cancel", role: "cancel" },
                    { text: "Remove", role: "destructive", handler: removeMember }
                ]}
            />

            <IonActionSheet
                isOpen={showTransferSheet}
                onDidDismiss={() => setShowTransferSheet(false)}
                header={`Transfer ownership to ${memberToTransfer?.name}?`}
                subHeader="You will become a regular member."
                buttons={[
                    { text: "Transfer ownership", role: "destructive", handler: transferOwnership },
                    { text: "Cancel", role: "cancel" }
                ]}
            />

            <IonAlert
                isOpen={showLeaveAlert}
                onDidDismiss={() => setShowLeaveAlert(false)}
                header={deviceToLeave?.ownerId === userId ? "Delete device?" : "Leave device?"}
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
        </Page>
    );
};

export default Devices;
