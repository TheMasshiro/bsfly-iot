import { IonButtons, IonChip, IonMenuButton, IonTitle, IonToolbar } from "@ionic/react";
import { FC } from "react";

interface ToolbarProps {
    header: string,
}

const Toolbar: FC<ToolbarProps> = ({ header }) => {
    return (
        <IonToolbar>
            <IonButtons slot="start">
                <IonMenuButton />
            </IonButtons>
            <IonTitle>{header}</IonTitle>
            <IonChip slot='end' color="danger">
                Offline
            </IonChip>
        </IonToolbar>
    )
}

export default Toolbar;
