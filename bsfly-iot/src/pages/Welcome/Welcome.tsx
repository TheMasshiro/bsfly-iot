import { SignInButton } from "@clerk/clerk-react";
import {
    IonPage,
    IonContent,
    IonButton,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonCardContent,
    IonIcon,
    IonCheckbox,
    CheckboxCustomEvent
} from "@ionic/react";
import {
    thermometerOutline,
    waterOutline,
    pulseOutline,
    leafOutline,
    bugOutline,
    flashOutline,
    shieldCheckmarkOutline,
    analyticsOutline
} from "ionicons/icons";
import { FC, useRef, useState } from "react";
import "./Welcome.css";
import Terms from "../../components/Terms/Terms";

const features = [
    { icon: thermometerOutline, color: "danger", title: "Temperature" },
    { icon: waterOutline, color: "primary", title: "Humidity" },
    { icon: leafOutline, color: "success", title: "Moisture" },
    { icon: pulseOutline, color: "warning", title: "Ammonia" }
];

const benefits = [
    { icon: flashOutline, text: "Real-time" },
    { icon: shieldCheckmarkOutline, text: "Alerts" },
    { icon: analyticsOutline, text: "Analytics" }
];

const Welcome: FC = () => {
    const [showTerms, setShowTerms] = useState(false);
    const [isTouched, setIsTouched] = useState<boolean>(false);
    const [isValid, setIsValid] = useState<boolean | undefined>();
    const agreeRef = useRef<HTMLIonCheckboxElement>(null);

    const validateCheckbox = (event: CheckboxCustomEvent<{ checked: boolean }>) => {
        setIsTouched(true);
        setIsValid(event.detail.checked);
    };

    return (
        <IonPage className="welcome-page">
            <IonContent className="ion-padding" fullscreen scrollY={true}>
                <div className="welcome-container">
                    <section className="hero-section">
                        <div className="hero-glow" />
                        <div className="hero-icon-wrapper">
                            <IonIcon icon={bugOutline} className="hero-icon" />
                        </div>
                        <h1 className="welcome-title">
                            <span className="title-line">Smart Farming</span>
                            <span className="title-line">
                                with <span className="gradient-text">BSFly</span>
                            </span>
                        </h1>
                        <p className="welcome-subtitle">
                            IoT-powered environmental monitoring for Black Soldier Fly farming
                        </p>
                        <div className="benefits-row">
                            {benefits.map((benefit, index) => (
                                <div key={index} className="benefit-pill">
                                    <IonIcon icon={benefit.icon} />
                                    <span>{benefit.text}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="features-section">
                        <IonGrid>
                            <IonRow className="ion-justify-content-center">
                                {features.map((feature, index) => (
                                    <IonCol key={index} size="6" sizeMd="3">
                                        <IonCard className="feature-card">
                                            <IonCardContent className="ion-text-center">
                                                <IonIcon icon={feature.icon} color={feature.color} size="large" />
                                                <h2>{feature.title}</h2>
                                            </IonCardContent>
                                        </IonCard>
                                    </IonCol>
                                ))}
                            </IonRow>
                        </IonGrid>
                    </section>

                    <section className="cta-section">
                        <div className="cta-card">
                            <IonCheckbox
                                ref={agreeRef}
                                color="success"
                                className={`terms-checkbox ${isValid ? 'ion-valid' : ''} ${isValid === false ? 'ion-invalid' : ''} ${isTouched ? 'ion-touched' : ''}`}
                                helperText="Agree to the terms before continuing"
                                errorText="You must agree to the terms to continue"
                                onIonChange={(event) => {
                                    validateCheckbox(event);
                                    setShowTerms(true);
                                }}
                                labelPlacement="end"
                            >
                                I agree to the terms and conditions
                            </IonCheckbox>

                            {(showTerms && isValid) && (
                                <Terms isOpen={showTerms} onClose={() => setShowTerms(false)} />
                            )}

                            <SignInButton mode="modal">
                                <IonButton disabled={!isValid} expand="block" size="large" className="signin-button">
                                    <span className="button-text">Get Started</span>
                                    <span className="button-arrow">→</span>
                                </IonButton>
                            </SignInButton>
                        </div>
                    </section>

                    <footer className="welcome-footer">
                        <p>© 2025 Black Soldier Fly IoT</p>
                    </footer>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default Welcome;
