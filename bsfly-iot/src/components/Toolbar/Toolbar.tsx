import { IonButton, IonButtons, IonChip, IonIcon, IonTitle, IonToolbar } from "@ionic/react";
import { menuOutline, notifications } from "ionicons/icons";
import { FC, useEffect, useState } from "react";
import { menuController } from '@ionic/core/components';
import { actuatorService } from "../../services/socket/socket";

interface ToolbarProps {
    header: string,
}

const Toolbar: FC<ToolbarProps> = ({ header }) => {
    const [isOnline, setIsOnline] = useState(false);

    useEffect(() => {
        // Check connection status periodically
        const checkStatus = async () => {
            const online = await actuatorService.checkConnection();
            setIsOnline(online);
        };

        checkStatus();
        const interval = setInterval(checkStatus, 5000);

        // Start polling for actuator updates
        actuatorService.startPolling(2000);

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
            <IonChip slot='end' color={isOnline ? "success" : "danger"}>
                {isOnline ? "Online" : "Offline"}
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
