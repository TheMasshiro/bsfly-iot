import { IonButton, IonButtons, IonChip, IonIcon, IonTitle, IonToolbar } from "@ionic/react";
import { menuOutline, notifications } from "ionicons/icons";
import { FC, useEffect, useState } from "react";
import { menuController } from '@ionic/core/components';
import { socket } from "../../services/socket/socket";

interface ToolbarProps {
    header: string,
}

const Toolbar: FC<ToolbarProps> = ({ header }) => {
    const [isOnline, setIsOnline] = useState(socket.connected);

    useEffect(() => {
        const onConnect = () => setIsOnline(true);
        const onDisconnect = () => setIsOnline(false);

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
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
