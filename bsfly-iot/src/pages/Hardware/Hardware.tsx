import {
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonChip,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonPage,
    IonText,
    IonToolbar,
    IonTitle,
    useIonToast,
} from "@ionic/react";
import {
    cloudUploadOutline,
    hardwareChipOutline,
    refreshOutline,
    serverOutline,
} from "ionicons/icons";
import { FC, useState } from "react";
import Toolbar from "../../components/Toolbar/Toolbar";
import PagePurpose from "../../components/PagePurpose/PagePurpose";
import DataIndicator from "../../components/DataIndicator/DataIndicator";
import { StatusSkeleton, CalibrationSkeleton } from "../../components/LoadingSkeleton/HardwareSkeleton";
import { useDevice } from "../../context/DeviceContext";
import { useHardwareStatus, useDeviceCalibration } from "../../hooks/useHardwareStatus";
import { api, withToken } from "../../utils/api";
import { STORAGE_KEYS } from "../../config/storage";
import { CalibrateResponse } from "../../types/hardware";
import "./Hardware.css";

const Hardware: FC = () => {
    const [present] = useIonToast();
    const { currentDevice, getToken } = useDevice();
    const { status, refreshStatus } = useHardwareStatus(currentDevice?._id);
    const { calibration, refreshCalibration } = useDeviceCalibration(currentDevice?._id);
    const [calibrating, setCalibrating] = useState(false);

    const fetchStatus = async () => {
        if (!currentDevice?._id) {
            present({ message: "Select a device first", duration: 2000, color: "warning" });
            return;
        }
        await refreshStatus();
        if (!status.error) {
            present({ message: "Status fetched successfully", duration: 1400, color: "success" });
        } else {
            present({ message: status.error, duration: 2500, color: "danger" });
        }
    };

    const openOtaPage = () => {
        if (!currentDevice?._id) {
            present({ message: "Select a device first", duration: 2500, color: "warning" });
            return;
        }
        if (currentDevice.status === "offline") {
            present({ message: "Device is offline - cannot open OTA page", duration: 2500, color: "warning" });
            return;
        }
        void (async () => {
            try {
                const token = await getToken();
                const { data } = await api.get(`/api/devices/${currentDevice._id}/hardware-url`, withToken(token));
                if (!data?.url) throw new Error("Hardware URL not available");
                window.open(data.url, "_blank", "noopener,noreferrer");
            } catch (error: any) {
                present({
                    message: error?.response?.data?.error || error?.message || "Failed to open OTA page",
                    duration: 2500,
                    color: "danger",
                });
            }
        })();
    };

    const rebootDevice = async () => {
        if (!currentDevice?._id) {
            present({ message: "Select a device first", duration: 2000, color: "warning" });
            return;
        }
        if (currentDevice.status === "offline") {
            present({ message: "Device is offline - cannot reboot", duration: 2000, color: "warning" });
            return;
        }
        try {
            const token = await getToken();
            const { data } = await api.post(`/api/devices/${currentDevice._id}/reboot`, {}, withToken(token));
            present({ message: data?.message || "Reboot command sent", duration: 2200, color: "success" });
        } catch (error: any) {
            present({ message: error?.message || "Failed to reboot device", duration: 2500, color: "danger" });
        }
    };

    const calibrateAllSensors = async () => {
        if (!currentDevice?._id) {
            present({ message: "Select a device first", duration: 2000, color: "warning" });
            return;
        }
        if (currentDevice.status === "offline") {
            present({ message: "Device is offline - cannot calibrate", duration: 2000, color: "warning" });
            return;
        }
        setCalibrating(true);
        try {
            const token = await getToken();
            await api.post<CalibrateResponse>(`/api/devices/${currentDevice._id}/calibrate-all`, {}, withToken(token));
            const now = new Date().toLocaleString();
            const message = `Calibrated: ${now}`;
            localStorage.setItem(STORAGE_KEYS.HARDWARE_CALIBRATION, message);
            localStorage.setItem(STORAGE_KEYS.HARDWARE_CALIBRATION_TIMESTAMP, new Date().toISOString());
            await refreshCalibration();
            present({ message: "All sensors calibrated successfully", duration: 2500, color: "success" });
        } catch (error: any) {
            const errorMsg = error?.response?.data?.error || error?.message || "Failed to calibrate sensors";
            present({ message: errorMsg, duration: 2500, color: "danger" });
        } finally {
            setCalibrating(false);
        }
    };

    return (
        <IonPage className="hardware-page">
            <IonHeader class="ion-no-border">
                <Toolbar />
            </IonHeader>
            <IonContent fullscreen>
                <IonHeader collapse="condense">
                    <IonToolbar>
                        <IonTitle size="large">Hardware</IonTitle>
                    </IonToolbar>
                </IonHeader>
                <PagePurpose text="Select a device, then calibrate all sensors from the backend without needing the ESP32 IP address." />
                <IonCard className="ion-margin info-card">
                    <IonCardHeader>
                        <IonCardTitle>
                            <IonIcon icon={serverOutline} className="subtitle-icon" />
                            Selected Device
                        </IonCardTitle>
                        <IonCardSubtitle>Calibration uses the currently selected device and backend API</IonCardSubtitle>
                    </IonCardHeader>
                    <IonCardContent>
                        <div className="hardware-hints">
                            <IonChip color={currentDevice ? "success" : "warning"}>
                                <IonLabel>
                                    {currentDevice
                                        ? `${currentDevice.name || "Selected device"} • ${currentDevice.macAddress || currentDevice._id}`
                                        : "Select a device from the device menu to begin"}
                                </IonLabel>
                            </IonChip>
                            {currentDevice?.status === "offline" && (
                                <IonChip color="danger">
                                    <IonLabel>Device Offline - operations unavailable</IonLabel>
                                </IonChip>
                            )}
                            <IonText color="medium">
                                <p>You no longer need to type the ESP32 IP address. OTA still opens the device page when cached.</p>
                            </IonText>
                            <div className="action-group">
                                <IonButton expand="block" onClick={openOtaPage} disabled={!currentDevice || currentDevice.status === "offline"}>
                                    <IonIcon icon={cloudUploadOutline} slot="start" />
                                    Open OTA Page
                                </IonButton>
                                <IonButton expand="block" color="danger" onClick={rebootDevice} disabled={!currentDevice || currentDevice.status === "offline" || status.loading}>
                                    <IonIcon icon={refreshOutline} slot="start" />
                                    Reboot Device
                                </IonButton>
                            </div>
                        </div>
                    </IonCardContent>
                </IonCard>
                <IonCard className="ion-margin status-card">
                    <IonCardHeader>
                        <IonCardTitle>Latest Update</IonCardTitle>
                        <IonCardSubtitle>Firmware status from device</IonCardSubtitle>
                    </IonCardHeader>
                    <IonCardContent>
                        {status.loading ? (
                            <StatusSkeleton count={3} />
                        ) : (
                            <IonList
                                style={{ width: "100%", paddingLeft: 0, paddingRight: 0 }}
                                aria-live="polite"
                                aria-busy={status.loading}
                            >
                                {status.uptime && <IonItem lines="none"><IonLabel>{status.uptime}</IonLabel></IonItem>}
                                {status.wifiConnected && <IonItem lines="none"><IonLabel>{status.wifiConnected}</IonLabel></IonItem>}
                                {status.autoControlActive && <IonItem lines="none"><IonLabel>{status.autoControlActive}</IonLabel></IonItem>}
                                {!status.uptime && !status.wifiConnected && !status.autoControlActive && (
                                    <IonItem lines="none"><IonLabel>{status.error || "No status available"}</IonLabel></IonItem>
                                )}
                            </IonList>
                        )}
                        {status.lastUpdated && !status.loading && (
                            <DataIndicator lastUpdated={status.lastUpdated} isStale={status.isStale} />
                        )}
                        <div style={{ display: "flex", gap: 12, marginTop: 8, justifyContent: "center", width: "100%" }}>
                            <IonButton onClick={fetchStatus} disabled={!currentDevice || currentDevice.status === "offline" || status.loading} style={{ minWidth: 160 }} aria-label="Refresh hardware status">
                                <IonIcon icon={refreshOutline} slot="start" />
                                {status.loading ? "Refreshing..." : "Refresh"}
                            </IonButton>
                        </div>
                    </IonCardContent>
                </IonCard>
                <IonCard className="ion-margin status-card">
                    <IonCardHeader>
                        <IonCardTitle>
                            <IonIcon icon={hardwareChipOutline} className="subtitle-icon" />
                            Sensor Calibration
                        </IonCardTitle>
                        <IonCardSubtitle>Calibrate MQ137 ammonia, substrate moisture, and temperature sensors</IonCardSubtitle>
                    </IonCardHeader>
                    <IonCardContent>
                        {calibration.loading ? (
                            <CalibrationSkeleton />
                        ) : (
                            <IonList
                                style={{ width: "100%", paddingLeft: 0, paddingRight: 0 }}
                                aria-live="polite"
                                aria-busy={calibration.loading}
                            >
                                <IonItem lines="none">
                                    <IonLabel>{calibration.lastCalibrationTime || "Ready to calibrate"}</IonLabel>
                                </IonItem>
                            </IonList>
                        )}
                        {calibration.lastUpdated && !calibration.loading && (
                            <DataIndicator lastUpdated={calibration.lastUpdated} isStale={calibration.isStale} />
                        )}
                        <div style={{ display: "flex", gap: 12, marginTop: 8, justifyContent: "center", width: "100%" }}>
                            <IonButton onClick={calibrateAllSensors} disabled={!currentDevice || currentDevice.status === "offline" || calibrating} style={{ minWidth: 200 }} color="primary" aria-label="Calibrate all sensors">
                                {calibrating ? "Calibrating..." : "Calibrate All Sensors"}
                            </IonButton>
                        </div>
                        <IonText color="medium" style={{ fontSize: "0.9em", marginTop: 8 }}>
                            <p>
                                Ensure sensors are in calibration environment:
                                <br />• MQ137: Fresh air (20°C, 65% humidity)
                                <br />• Moisture: Consistent medium
                                <br />• Temperature: Room temperature
                            </p>
                        </IonText>
                    </IonCardContent>
                </IonCard>
            </IonContent>
        </IonPage>
    );
};

export default Hardware;
