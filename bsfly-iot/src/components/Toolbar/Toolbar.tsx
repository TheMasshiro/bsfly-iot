import { IonButton, IonButtons, IonChip, IonIcon, IonTitle, IonToolbar } from "@ionic/react";
import { cloudOfflineOutline, hardwareChipOutline, menuOutline, notifications } from "ionicons/icons";
import { FC, useEffect, useRef } from "react";
import { menuController } from '@ionic/core/components';
import { actuatorService } from "../../services/socket/socket";
import { useDevice } from "../../context/DeviceContext";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import "./Toolbar.css";

interface ToolbarProps {
    header: string,
}

let pollingStarted = false;

const Toolbar: FC<ToolbarProps> = ({ header }) => {
    const { devices, currentDevice, refreshDevices } = useDevice();
    const isOnline = useOnlineStatus();
    const statusIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        refreshDevices();
        statusIntervalRef.current = window.setInterval(refreshDevices, 30000);

        if (!pollingStarted) {
            pollingStarted = true;
            actuatorService.startPolling(10000);
        }

        return () => {
            if (statusIntervalRef.current) {
                clearInterval(statusIntervalRef.current);
            }
        };
    }, [refreshDevices]);

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

    return (
        <IonToolbar>
            <IonButtons slot="start">
                <IonButton expand="block" onClick={openMainMenu}>
                    <IonIcon slot="icon-only" icon={menuOutline} />
                </IonButton>
            </IonButtons>
            <IonTitle>{header}</IonTitle>
            
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
                <IonChip slot='end' color={isDeviceOnline ? "success" : "danger"}>
                    {isDeviceOnline ? "Online" : "Offline"}
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
