import { SignInButton } from "@clerk/clerk-react";
import { CheckboxCustomEvent, IonButton, IonCheckbox, IonContent, IonIcon, IonPage } from "@ionic/react";
import { bugOutline, cloudOutline, leafOutline, notificationsOutline, powerOutline, pulseOutline, thermometerOutline, waterOutline } from "ionicons/icons";
import { FC, useRef, useState } from "react";
import Card from "../../components/ui/Card";
import Metric from "../../components/ui/Metric";
import StatusPill from "../../components/ui/StatusPill";
import Terms from "../../components/Terms/Terms";
import "./Welcome.css";

const features = [
    { icon: pulseOutline, title: "Live readings", detail: "Temperature, humidity, substrate moisture and ammonia for both drawers." },
    { icon: notificationsOutline, title: "Alerts", detail: "Get a warning when a reading drifts out of range." },
    { icon: powerOutline, title: "Controls", detail: "Switch the fans, heater, humidifier, pump and light." },
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
            <IonContent fullscreen>
                <div className="welcome-shell">
                    <section className="welcome-intro">
                        <div className="welcome-brand">
                            <span className="welcome-mark">
                                <IonIcon icon={bugOutline} aria-hidden="true" />
                            </span>
                            <span>BSFly</span>
                        </div>
                        <h1>Watch your larvae drawers from your phone.</h1>
                        <ul className="welcome-features">
                            {features.map((feature) => (
                                <li key={feature.title} className="welcome-feature">
                                    <span className="feature-icon">
                                        <IonIcon icon={feature.icon} aria-hidden="true" />
                                    </span>
                                    <span>
                                        <strong>{feature.title}</strong>
                                        <small>{feature.detail}</small>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="welcome-cta" aria-label="Sign in">
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
                                Sign in
                            </IonButton>
                        </SignInButton>
                    </section>

                    <aside className="welcome-preview" aria-label="Example readings">
                        <Card title="Drawer readings" action={<StatusPill status="idle" plain>Example</StatusPill>}>
                            <div className="preview-grid">
                                <Metric label="Temperature" icon={thermometerOutline} value={29.4} unit="°C" status="ok" statusLabel="In range" />
                                <Metric label="Humidity" icon={cloudOutline} value={64} digits={0} unit="%" status="ok" statusLabel="In range" />
                                <Metric label="Ammonia" icon={leafOutline} value={18} digits={0} unit="ppm" status="warn" statusLabel="High" />
                                <Metric label="Substrate moisture" icon={waterOutline} value={58} digits={0} unit="%" status="ok" statusLabel="In range" />
                            </div>
                            <p className="preview-note">Sample values for layout only. Your farm's readings appear after you sign in.</p>
                        </Card>
                    </aside>

                    <footer className="welcome-footer">
                        <p>© 2026 Black Soldier Fly IoT</p>
                    </footer>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default Welcome;
