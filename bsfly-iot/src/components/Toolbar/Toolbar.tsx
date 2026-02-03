import { IonButton, IonButtons, IonChip, IonIcon, IonTitle, IonToolbar } from "@ionic/react";
import { hardwareChipOutline, menuOutline, notifications } from "ionicons/icons";
import { FC, useEffect, useState, useRef } from "react";
import { menuController } from '@ionic/core/components';
import { actuatorService } from "../../services/socket/socket";
import { useDevice } from "../../context/DeviceContext";
import "./Toolbar.css";

interface ToolbarProps {
    header: string,
}

let pollingStarted = false;

const Toolbar: FC<ToolbarProps> = ({ header }) => {
    const [isOnline, setIsOnline] = useState(false);
    const { devices, currentDevice } = useDevice();
    const statusIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        const checkStatus = async () => {
            const online = await actuatorService.checkConnection();
            setIsOnline(online);
        };

        checkStatus();
        statusIntervalRef.current = window.setInterval(checkStatus, 30000);

        if (!pollingStarted) {
            pollingStarted = true;
            actuatorService.startPolling(10000);
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

    return (
        <IonToolbar>
            <IonButtons slot="start">
                <IonButton expand="block" onClick={openMainMenu}>
                    <IonIcon slot="icon-only" icon={menuOutline} />
                </IonButton>
            </IonButtons>
            <IonTitle>{header}</IonTitle>
            
            {devices.length > 0 && (
                <IonButton slot="end" fill="clear" onClick={openDeviceMenu}>
                    <IonIcon slot="icon-only" icon={hardwareChipOutline} />
                </IonButton>
            )}
            
            <IonChip slot='end' color={currentDevice?.status === "online" ? "success" : isOnline ? "warning" : "danger"}>
                {currentDevice?.status === "online" ? "Device Online" : isOnline ? "API Online" : "Offline"}
            </IonChip>
            <IonButtons slot="end">
                <IonButton expand="block" onClick={openNotifications}>
                    <IonIcon slot="icon-only" icon={notifications} />
                </IonButton>
            </IonButtons>
        </IonToolbar>
    )
}

export default Toolbar;
