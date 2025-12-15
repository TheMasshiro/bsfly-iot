import { IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonPage } from "@ionic/react";
import { hardwareChip, helpCircle } from "ionicons/icons";
import { FC } from "react";
import Toolbar from "../../components/Toolbar/Toolbar";

const Settings: FC = () => {
    return (
        <IonPage>
            <IonHeader class="ion-no-border">
                <Toolbar
                    header={"Settings"}
                />
            </IonHeader>

            <IonContent fullscreen>
                <IonList inset>
                    <IonItem lines="none">
                        <IonIcon icon={hardwareChip} slot="start"></IonIcon>
                        <IonLabel>ESP32 Configuration</IonLabel>
                    </IonItem>
                    <IonItem>
                        <IonInput label="Enter Mac Address" label-placement="stacked" placeholder="AA:BB:CC:DD:EE:FF"></IonInput>
                    </IonItem>
                    <IonItem lines="none">
                        <IonLabel color="medium">Current Address: AA:BB:CC:DD:EE:FF</IonLabel>
                    </IonItem>
                    <IonItem button href="https://github.com/TheMasshiro/bsfly/blob/main/README.md" target="_blank" rel="noopener noreferrer">
                        <IonIcon icon={helpCircle} slot="start"></IonIcon>
                        <IonLabel color="medium">How to get ESP32 Mac Address?</IonLabel>
                    </IonItem>
                </IonList>
            </IonContent>
        </IonPage>
    )
}

export default Settings;
