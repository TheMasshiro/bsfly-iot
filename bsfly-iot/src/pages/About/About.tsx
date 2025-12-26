import { IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonPage } from "@ionic/react"
import { bug, codeSlashOutline, informationCircle, logoGithub, mail, people, person } from "ionicons/icons"
import { FC } from "react"
import Toolbar from "../../components/Toolbar/Toolbar"

const About: FC = () => {
    return (
        <IonPage className="about-page">
            <IonHeader class="ion-no-border">
                <Toolbar
                    header={"About"}
                />
            </IonHeader>

            <IonContent fullscreen>
                <IonList inset>
                    <IonItem lines="none">
                        <IonIcon icon={informationCircle} slot="start"></IonIcon>
                        <IonLabel>App Information</IonLabel>
                    </IonItem>
                    <IonItem>
                        <IonLabel>App Name</IonLabel>
                        <IonLabel slot="end" color="medium">BSFly IoT - Monitoring System</IonLabel>
                    </IonItem>
                    <IonItem>
                        <IonLabel>Version</IonLabel>
                        <IonLabel slot="end" color="medium">0.1a</IonLabel>
                    </IonItem>
                </IonList>
                <IonList inset>
                    <IonItem lines="none">
                        <IonIcon icon={codeSlashOutline} slot="start"></IonIcon>
                        <IonLabel>Developer</IonLabel>
                    </IonItem>
                    <IonItem>
                        <IonIcon icon={person} slot="start"></IonIcon>
                        <IonLabel slot="end" color="medium">John Christian Vicente</IonLabel>
                    </IonItem>
                    <IonItem>
                        <IonIcon icon={mail} slot="start"></IonIcon>
                        <IonLabel slot="end" color="medium">johnc.vicente1@gmail.com</IonLabel>
                    </IonItem>
                    <IonItem button href="https://github.com/TheMasshiro" target="_blank" rel="noopener noreferrer">
                        <IonIcon icon={logoGithub} slot="start"></IonIcon>
                        <IonLabel slot="end" color="medium">TheMasshiro</IonLabel>
                    </IonItem>
                </IonList>
                <IonList inset>
                    <IonItem lines="none">
                        <IonIcon icon={bug} slot="start"></IonIcon>
                        <IonLabel>Support</IonLabel>
                    </IonItem>
                    <IonItem button href="https://github.com/TheMasshiro/bsfly-iot/issues" target="_blank" rel="noopener noreferrer">
                        <IonLabel>Report an Issue</IonLabel>
                    </IonItem>
                    <IonItem button href="https://github.com/TheMasshiro/bsfly-iot/blob/main/README.md" target="_blank" rel="noopener noreferrer">
                        <IonLabel>Documentations</IonLabel>
                    </IonItem>
                    <IonItem button href="https://github.com/TheMasshiro/bsfly-iot/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">
                        <IonLabel>MIT License</IonLabel>
                    </IonItem>
                </IonList>
                <IonList inset>
                    <IonItem lines="none">
                        <IonIcon icon={people} slot="start"></IonIcon>
                        <IonLabel>Researchers</IonLabel>
                    </IonItem>
                    <IonItem>
                        <IonLabel color="medium">Advincula, Kristine Joy B.</IonLabel>
                    </IonItem>
                    <IonItem>
                        <IonLabel color="medium">Bugarin, Jethro Daniel D.</IonLabel>
                    </IonItem>
                    <IonItem>
                        <IonLabel color="medium">Dagsaan, Jed</IonLabel>
                    </IonItem>
                    <IonItem>
                        <IonLabel color="medium">Maggay, Nigel Bennett</IonLabel>
                    </IonItem>
                    <IonItem>
                        <IonLabel color="medium">Farrales, Mark Niel S.</IonLabel>
                    </IonItem>
                    <IonItem>
                        <IonLabel color="medium">Vicente, John Christian</IonLabel>
                    </IonItem>
                </IonList>
                <div className="ion-align-items-center ion-justify-content-center ion-text-center">
                    <IonLabel color="medium">
                        © 2025 BSFly IoT. All rights reserved.
                    </IonLabel>
                </div>
            </IonContent>
        </IonPage>
    )
}

export default About;
