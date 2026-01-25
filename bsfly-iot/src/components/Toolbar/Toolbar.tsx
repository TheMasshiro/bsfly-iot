import { IonButton, IonButtons, IonChip, IonIcon, IonSelect, IonSelectOption, IonTitle, IonToolbar } from "@ionic/react";
import { menuOutline, notifications } from "ionicons/icons";
import { FC, useEffect, useState } from "react";
import { menuController } from '@ionic/core/components';
import { actuatorService } from "../../services/socket/socket";
import { useDevice } from "../../context/DeviceContext";

interface ToolbarProps {
    header: string,
}

const Toolbar: FC<ToolbarProps> = ({ header }) => {
    const [isOnline, setIsOnline] = useState(false);
    const { devices, currentDevice, setCurrentDevice } = useDevice();

    useEffect(() => {
        const checkStatus = async () => {
            const online = await actuatorService.checkConnection();
            setIsOnline(online);
        };

        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        actuatorService.startPolling(1000);

        return () => {
            clearInterval(interval);
            actuatorService.stopPolling();
        };
    }, []);

    async function openMainMenu() {
        await menuController.open('open-menu');
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
                <IonSelect
                    slot="end"
                    interface="popover"
                    value={currentDevice?._id}
                    onIonChange={(e) => {
                        const device = devices.find(d => d._id === e.detail.value);
                        if (device) setCurrentDevice(device);
                    }}
                    style={{ maxWidth: "150px" }}
                >
                    {devices.map((device) => (
                        <IonSelectOption key={device._id} value={device._id}>
                            {device.name}
                        </IonSelectOption>
                    ))}
                </IonSelect>
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
