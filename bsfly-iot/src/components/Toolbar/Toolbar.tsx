import { IonButton, IonButtons, IonChip, IonIcon, IonMenuButton, IonTitle, IonToolbar } from "@ionic/react";
import { FC } from "react";
import ControlModal from "../Modal/Modal";
import { optionsOutline } from "ionicons/icons";

interface ToolbarProps {
    header: string,
    isDashboard?: boolean
}

const Toolbar: FC<ToolbarProps> = ({ header, isDashboard }) => {
    return (
        <IonToolbar>
            <IonButtons slot="start">
                <IonMenuButton />
            </IonButtons>
            {isDashboard ?
                <>
                    <IonTitle>{header}</IonTitle>
                    <IonChip slot='end' color="danger">
                        Offline
                    </IonChip>
                    <IonButtons slot="end">
                        <IonButton id="open-control-modal" fill="solid" shape="round" color="secondary">
                            <IonIcon slot="icon-only" icon={optionsOutline}></IonIcon>
                            <ControlModal />
                        </IonButton>
                    </IonButtons>
                </>
                : <>
                    <IonTitle>{header}</IonTitle>
                    <IonChip slot='end' color="danger">
                        Offline
                    </IonChip>
                </>}
        </IonToolbar>
    )
}

export default Toolbar;
