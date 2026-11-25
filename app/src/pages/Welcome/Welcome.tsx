import { SignInButton } from "@clerk/clerk-react";
import {
    IonPage,
    IonContent,
    IonButton,
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
    bugOutline
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

const benefits = ["Live readings", "Alerts", "Analytics"];

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
                        <IonIcon icon={bugOutline} className="hero-icon" />
                        <h1 className="welcome-title">BSFly</h1>
                        <p className="welcome-subtitle">Environmental monitoring for Black Soldier Fly farms.</p>
                        <ul className="benefits-row">
                            {benefits.map((benefit) => (
                                <li key={benefit} className="benefit-pill">{benefit}</li>
                            ))}
                        </ul>
                    </section>

                    <section className="features-section">
                        <div className="feature-grid">
                            {features.map((feature) => (
                                <IonCard key={feature.title} className="feature-card">
                                    <IonCardContent className="ion-text-center">
                                        <IonIcon icon={feature.icon} color={feature.color} size="large" />
                                        <h2>{feature.title}</h2>
                                    </IonCardContent>
                                </IonCard>
                            ))}
                        </div>
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
                                    Get started
                                </IonButton>
                            </SignInButton>
                        </div>
                    </section>

                    <footer className="welcome-footer">
                        <p>© 2026 Black Soldier Fly IoT</p>
                    </footer>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default Welcome;
