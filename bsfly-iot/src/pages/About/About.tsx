import {
    IonAccordion,
    IonAccordionGroup,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonChip,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonPage,
    IonText,
} from "@ionic/react";
import {
    bug,
    chevronForward,
    codeSlashOutline,
    documentText,
    logoGithub,
    mail,
    people,
    person,
    ribbon,
    sparkles,
} from "ionicons/icons";
import { FC } from "react";
import Toolbar from "../../components/Toolbar/Toolbar";

const APP_VERSION = "0.1a";

const researchers = [
    "Advincula, Kristine Joy B.",
    "Bugarin, Jethro Daniel D.",
    "Dagsaan, Jed",
    "Farrales, Mark Niel S.",
    "Maggay, Nigel Bennett",
    "Vicente, John Christian",
];

const About: FC = () => {
    return (
        <IonPage className="about-page">
            <IonHeader class="ion-no-border">
                <Toolbar header={"About"} />
            </IonHeader>

            <IonContent fullscreen>
                {/* Hero Card */}
                <IonCard className="ion-margin">
                    <IonCardHeader className="ion-text-center ion-padding">
                        <div
                            style={{
                                width: 80,
                                height: 80,
                                margin: "0 auto 16px",
                                borderRadius: 20,
                                background: "var(--ion-color-primary)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <IonIcon
                                icon={sparkles}
                                style={{ fontSize: 40, color: "#fff" }}
                            />
                        </div>
                        <IonCardTitle>
                            <h1 style={{ margin: 0 }}>BSFly IoT</h1>
                        </IonCardTitle>
                        <IonCardSubtitle>Monitoring System</IonCardSubtitle>
                        <IonChip color="primary" style={{ marginTop: 8 }}>
                            <IonLabel>v{APP_VERSION}</IonLabel>
                        </IonChip>
                    </IonCardHeader>
                    <IonCardContent className="ion-text-center">
                        <IonText color="medium">
                            <p>
                                An IoT-based monitoring and control system for
                                Black Soldier Fly larvae cultivation.
                            </p>
                        </IonText>
                    </IonCardContent>
                </IonCard>

                {/* Expandable Sections */}
                <IonAccordionGroup className="ion-margin">
                    {/* Developer Section */}
                    <IonAccordion value="developer">
                        <IonItem slot="header">
                            <IonIcon
                                icon={codeSlashOutline}
                                slot="start"
                                color="primary"
                            />
                            <IonLabel>Developer</IonLabel>
                        </IonItem>
                        <IonList slot="content">
                            <IonItem lines="none">
                                <IonIcon icon={person} slot="start" />
                                <IonLabel>John Christian Vicente</IonLabel>
                            </IonItem>
                            <IonItem lines="none">
                                <IonIcon icon={mail} slot="start" />
                                <IonLabel>johnc.vicente1@gmail.com</IonLabel>
                            </IonItem>
                            <IonItem
                                button
                                href="https://github.com/TheMasshiro"
                                target="_blank"
                                rel="noopener noreferrer"
                                detail
                                detailIcon={chevronForward}
                                lines="none"
                            >
                                <IonIcon icon={logoGithub} slot="start" />
                                <IonLabel>@TheMasshiro</IonLabel>
                            </IonItem>
                        </IonList>
                    </IonAccordion>

                    {/* Research Team Section */}
                    <IonAccordion value="researchers">
                        <IonItem slot="header">
                            <IonIcon
                                icon={people}
                                slot="start"
                                color="primary"
                            />
                            <IonLabel>Research Team</IonLabel>
                            <IonChip slot="end" color="medium">
                                <IonLabel>{researchers.length}</IonLabel>
                            </IonChip>
                        </IonItem>
                        <IonList slot="content">
                            {researchers.map((name, index) => (
                                <IonItem key={index} lines="none">
                                    <IonIcon
                                        icon={person}
                                        slot="start"
                                        color="medium"
                                    />
                                    <IonLabel color="medium">{name}</IonLabel>
                                </IonItem>
                            ))}
                        </IonList>
                    </IonAccordion>

                    {/* Support Section */}
                    <IonAccordion value="support">
                        <IonItem slot="header">
                            <IonIcon icon={bug} slot="start" color="primary" />
                            <IonLabel>Support & Resources</IonLabel>
                        </IonItem>
                        <IonList slot="content">
                            <IonItem
                                button
                                href="https://github.com/TheMasshiro/bsfly-iot/issues"
                                target="_blank"
                                rel="noopener noreferrer"
                                detail
                                detailIcon={chevronForward}
                            >
                                <IonIcon
                                    icon={bug}
                                    slot="start"
                                    color="warning"
                                />
                                <IonLabel>
                                    <h3>Report an Issue</h3>
                                    <p>Found a bug? Let us know</p>
                                </IonLabel>
                            </IonItem>
                            <IonItem
                                button
                                href="https://github.com/TheMasshiro/bsfly-iot/blob/main/README.md"
                                target="_blank"
                                rel="noopener noreferrer"
                                detail
                                detailIcon={chevronForward}
                            >
                                <IonIcon
                                    icon={documentText}
                                    slot="start"
                                    color="tertiary"
                                />
                                <IonLabel>
                                    <h3>Documentation</h3>
                                    <p>Learn how to use the app</p>
                                </IonLabel>
                            </IonItem>
                            <IonItem
                                button
                                href="https://github.com/TheMasshiro/bsfly-iot/blob/main/LICENSE"
                                target="_blank"
                                rel="noopener noreferrer"
                                detail
                                detailIcon={chevronForward}
                                lines="none"
                            >
                                <IonIcon
                                    icon={ribbon}
                                    slot="start"
                                    color="success"
                                />
                                <IonLabel>
                                    <h3>MIT License</h3>
                                    <p>Open source software</p>
                                </IonLabel>
                            </IonItem>
                        </IonList>
                    </IonAccordion>
                </IonAccordionGroup>

                {/* Footer */}
                <div
                    className="ion-text-center ion-padding"
                    style={{ paddingBottom: 32 }}
                >
                    <IonText color="medium">
                        <p style={{ fontSize: 12, margin: 0 }}>
                            © {new Date().getFullYear()} BSFly IoT
                        </p>
                        <p style={{ fontSize: 12, margin: "4px 0 0" }}>
                            All rights reserved.
                        </p>
                    </IonText>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default About;
