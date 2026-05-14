import { IonButton, IonButtons, IonChip, IonIcon, IonTitle, IonToolbar } from "@ionic/react";
import { cloudOfflineOutline, hardwareChipOutline, menuOutline, notifications } from "ionicons/icons";
import { FC, useEffect, useRef } from "react";
import { menuController } from '@ionic/core/components';
import { actuatorService } from "../../services/socket/socket";
import { useDevice } from "../../context/DeviceContext";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import "./Toolbar.css";

let mqttStarted = false;

const Toolbar: FC = () => {
    const { devices, currentDevice, refreshDevices } = useDevice();
    const isOnline = useOnlineStatus();
    const statusIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        statusIntervalRef.current = window.setInterval(() => {
            refreshDevices();
        }, 5000);

        if (!mqttStarted) {
            mqttStarted = true;
            actuatorService.connect();
        }

        return () => {
            if (statusIntervalRef.current) {
                clearInterval(statusIntervalRef.current);
            }
        };
    }, []);

    async function openMainMenu() {
        await menuController.open('open-menu');
    }

    async function openDeviceMenu() {
        await menuController.open('device-menu');
    }

    async function openNotifications() {
        await menuController.open('open-notifications');
    }

    const isDeviceOnline = currentDevice?.status === "online";
    const effectiveMode = currentDevice?.controlMode ?? "auto";

    return (
        <IonToolbar>
            <IonButtons slot="start">
                <IonButton expand="block" onClick={openMainMenu}>
                    <IonIcon slot="icon-only" icon={menuOutline} />
                </IonButton>
            </IonButtons>
            
            {!isOnline && (
                <IonChip slot="end" color="warning" className="offline-chip">
                    <IonIcon icon={cloudOfflineOutline} />
                    Offline
                </IonChip>
            )}
            
            {devices.length > 0 && (
                <IonButton slot="end" fill="clear" onClick={openDeviceMenu}>
                    <IonIcon slot="icon-only" icon={hardwareChipOutline} />
                </IonButton>
            )}
            
            {isOnline && (
                <IonChip
                    slot='end'
                    color={isDeviceOnline ? "success" : "danger"}
                    className="device-status-chip"
                    aria-label={`Device ${isDeviceOnline ? "online" : "offline"}`}
                    title={`Device ${isDeviceOnline ? "online" : "offline"}`}
                >
                    Device {isDeviceOnline ? "Online" : "Offline"}
                </IonChip>
            )}

            {currentDevice && (
                <IonChip
                    slot='end'
                    className={`mode-visibility-chip ${effectiveMode === "manual" ? "mode-manual" : "mode-auto"}`}
                    aria-label={`Control mode ${effectiveMode.toUpperCase()}`}
                    title={`Control mode ${effectiveMode.toUpperCase()}`}
                >
                    {effectiveMode === "manual" ? "MANUAL" : "AUTO"}
                </IonChip>
            )}

            <IonButtons slot="end">
                <IonButton expand="block" onClick={openNotifications}>
                    <IonIcon slot="icon-only" icon={notifications} />
                </IonButton>
            </IonButtons>
        </IonToolbar>
    )
}

export default Toolbar;
