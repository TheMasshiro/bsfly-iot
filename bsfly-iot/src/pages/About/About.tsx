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
    analyticsOutline,
    bugOutline,
    chevronForward,
    codeSlashOutline,
    documentTextOutline,
    flashOutline,
    globeOutline,
    hardwareChipOutline,
    leafOutline,
    logoGithub,
    mailOutline,
    peopleOutline,
    personOutline,
    ribbonOutline,
    shieldCheckmarkOutline,
    sunnyOutline,
    thermometerOutline,
} from "ionicons/icons";
import { FC } from "react";
import Toolbar from "../../components/Toolbar/Toolbar";
import "./About.css";

const APP_VERSION = "1.0.0";

const researchers = [
    "Advincula, Kristine Joy B.",
    "Bugarin, Jethro Daniel D.",
    "Dagsaan, Jed",
    "Farrales, Mark Niel S.",
    "Maggay, Nigel Bennett",
    "Vicente, John Christian",
];

const features = [
    { icon: thermometerOutline, title: "Environmental Monitoring", desc: "Temperature, humidity, moisture, ammonia" },
    { icon: flashOutline, title: "Actuator Control", desc: "Fan, heater, humidifier, misting" },
    { icon: sunnyOutline, title: "Light Management", desc: "Photoperiod timer control" },
    { icon: leafOutline, title: "Life Stage Tracking", desc: "Eggs, larvae, prepupa timers" },
    { icon: analyticsOutline, title: "Analytics & Reports", desc: "Historical data and PDF reports" },
    { icon: hardwareChipOutline, title: "Multi-Device Support", desc: "Manage multiple ESP32 devices" },
];

const About: FC = () => {
    return (
        <IonPage className="about-page">
            <IonHeader class="ion-no-border">
                <Toolbar header={"About"} />
            </IonHeader>

            <IonContent fullscreen>
                <IonCard className="ion-margin hero-card">
                    <IonCardHeader className="ion-text-center ion-padding">
                        <div className="about-logo">
                            <IonIcon icon={bugOutline} className="about-logo-icon" />
                        </div>
                        <IonCardTitle>
                            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Black Soldier Fly IoT</h1>
                        </IonCardTitle>
                        <IonCardSubtitle>Smart Monitoring System</IonCardSubtitle>
                        <IonChip color="primary" style={{ marginTop: 12 }}>
                            <IonLabel>Version {APP_VERSION}</IonLabel>
                        </IonChip>
                    </IonCardHeader>
                    <IonCardContent className="ion-text-center">
                        <IonText color="medium">
                            <p style={{ margin: 0, lineHeight: 1.6 }}>
                                A comprehensive IoT solution for monitoring and controlling
                                Black Soldier Fly larvae cultivation environments. Track environmental
                                conditions, manage actuators, and optimize your BSF farming operations.
                            </p>
                        </IonText>
                    </IonCardContent>
                </IonCard>

                <IonCard className="ion-margin">
                    <IonCardHeader>
                        <IonCardSubtitle>
                            <IonIcon icon={shieldCheckmarkOutline} style={{ verticalAlign: "middle", marginRight: 8 }} />
                            Key Features
                        </IonCardSubtitle>
                    </IonCardHeader>
                    <IonCardContent>
                        <div className="features-grid">
                            {features.map((feature, index) => (
                                <div key={index} className="feature-item">
                                    <IonIcon icon={feature.icon} className="feature-icon" color="primary" />
                                    <div className="feature-text">
                                        <strong>{feature.title}</strong>
                                        <span>{feature.desc}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </IonCardContent>
                </IonCard>

                <IonAccordionGroup className="ion-margin">
                    <IonAccordion value="developer">
                        <IonItem slot="header">
                            <IonIcon icon={codeSlashOutline} slot="start" color="primary" />
                            <IonLabel>Developer</IonLabel>
                        </IonItem>
                        <IonList slot="content">
                            <IonItem lines="none">
                                <IonIcon icon={personOutline} slot="start" />
                                <IonLabel>John Christian Vicente</IonLabel>
                            </IonItem>
                            <IonItem lines="none">
                                <IonIcon icon={mailOutline} slot="start" />
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

                    <IonAccordion value="researchers">
                        <IonItem slot="header">
                            <IonIcon icon={peopleOutline} slot="start" color="primary" />
                            <IonLabel>Research Team</IonLabel>
                            <IonChip slot="end" color="medium">
                                <IonLabel>{researchers.length}</IonLabel>
                            </IonChip>
                        </IonItem>
                        <IonList slot="content">
                            {researchers.map((name, index) => (
                                <IonItem key={index} lines="none">
                                    <IonIcon icon={personOutline} slot="start" color="medium" />
                                    <IonLabel color="medium">{name}</IonLabel>
                                </IonItem>
                            ))}
                        </IonList>
                    </IonAccordion>

                    <IonAccordion value="tech">
                        <IonItem slot="header">
                            <IonIcon icon={globeOutline} slot="start" color="primary" />
                            <IonLabel>Technology Stack</IonLabel>
                        </IonItem>
                        <IonList slot="content">
                            <IonItem lines="none">
                                <IonLabel>
                                    <h3>Frontend</h3>
                                    <p>React, Ionic, TypeScript, Capacitor</p>
                                </IonLabel>
                            </IonItem>
                            <IonItem lines="none">
                                <IonLabel>
                                    <h3>Backend</h3>
                                    <p>Node.js, Express, MongoDB</p>
                                </IonLabel>
                            </IonItem>
                            <IonItem lines="none">
                                <IonLabel>
                                    <h3>Hardware</h3>
                                    <p>ESP32, DHT11, MQ-135, Soil Moisture Sensors</p>
                                </IonLabel>
                            </IonItem>
                        </IonList>
                    </IonAccordion>

                    <IonAccordion value="support">
                        <IonItem slot="header">
                            <IonIcon icon={bugOutline} slot="start" color="primary" />
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
                                <IonIcon icon={bugOutline} slot="start" color="warning" />
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
                                <IonIcon icon={documentTextOutline} slot="start" color="tertiary" />
                                <IonLabel>
                                    <h3>Documentation</h3>
                                    <p>Setup guide and usage instructions</p>
                                </IonLabel>
                            </IonItem>
                            <IonItem
                                button
                                href="https://github.com/TheMasshiro/bsfly-iot"
                                target="_blank"
                                rel="noopener noreferrer"
                                detail
                                detailIcon={chevronForward}
                            >
                                <IonIcon icon={logoGithub} slot="start" />
                                <IonLabel>
                                    <h3>Source Code</h3>
                                    <p>View on GitHub</p>
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
                                <IonIcon icon={ribbonOutline} slot="start" color="success" />
                                <IonLabel>
                                    <h3>MIT License</h3>
                                    <p>Open source software</p>
                                </IonLabel>
                            </IonItem>
                        </IonList>
                    </IonAccordion>
                </IonAccordionGroup>

                <div className="ion-text-center ion-padding" style={{ paddingBottom: 32 }}>
                    <IonText color="medium">
                        <p style={{ fontSize: 12, margin: 0 }}>
                            © {new Date().getFullYear()} Black Soldier Fly IoT
                        </p>
                    </IonText>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default About;
