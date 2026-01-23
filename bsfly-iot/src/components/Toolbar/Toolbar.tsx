import { IonButton, IonButtons, IonChip, IonIcon, IonTitle, IonToolbar } from "@ionic/react";
import { menuOutline, notifications } from "ionicons/icons";
import { FC } from "react";
import { menuController } from '@ionic/core/components';

interface ToolbarProps {
    header: string,
}

const Toolbar: FC<ToolbarProps> = ({ header }) => {
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
            <IonChip slot='end' color="danger">
                Offline
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
