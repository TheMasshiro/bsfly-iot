import { SignInButton } from "@clerk/clerk-react";
import {
    IonPage,
    IonContent,
    IonButton,
    IonText,
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
    bugOutline
} from "ionicons/icons";
import { FC, useEffect, useRef, useState } from "react";
import "./Welcome.css";
import Terms from "../../components/Terms/Terms";

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
            <IonContent className="ion-padding" fullscreen>
                <IonGrid>
                    <IonRow className="ion-justify-content-center ion-align-items-center">
                        <IonCol size="12" sizeMd="8" sizeLg="5" className="ion-text-center">
                            <IonIcon icon={bugOutline} color="success" size="large" />
                            <IonText>
                                <h1 className="welcome-title">
                                    <div>Your gateway</div>
                                    <div>
                                        to <span className="accent">BSFly</span>
                                    </div>
                                    <div>monitoring</div>
                                </h1>
                            </IonText>
                            <IonText className="welcome-description">
                                <p>
                                    Monitor <span className="danger">temperature</span>,{" "}
                                    <span className="primary">humidity</span>,{" "}
                                    <span className="success">substrate moisture</span>, and{" "}
                                    <span className="warning">ammonia</span> in real-time.
                                </p>
                                <p>
                                    Join <strong>farmers</strong> today.
                                </p>
                            </IonText>
                        </IonCol>
                    </IonRow>

                    <IonRow className="ion-justify-content-center">
                        <IonCol size="12" sizeMd="10" sizeLg="8">
                            <IonRow>
                                <IonCol size="6" sizeMd="3">
                                    <IonCard className="feature-card">
                                        <IonCardContent className="ion-text-center">
                                            <IonIcon icon={thermometerOutline} color="danger" size="large" />
                                            <h2>Temperature</h2>
                                        </IonCardContent>
                                    </IonCard>
                                </IonCol>
                                <IonCol size="6" sizeMd="3">
                                    <IonCard className="feature-card">
                                        <IonCardContent className="ion-text-center">
                                            <IonIcon icon={waterOutline} color="primary" size="large" />
                                            <h2>Humidity</h2>
                                        </IonCardContent>
                                    </IonCard>
                                </IonCol>
                                <IonCol size="6" sizeMd="3">
                                    <IonCard className="feature-card">
                                        <IonCardContent className="ion-text-center">
                                            <IonIcon icon={leafOutline} color="success" size="large" />
                                            <h2>Moisture</h2>
                                        </IonCardContent>
                                    </IonCard>
                                </IonCol>
                                <IonCol size="6" sizeMd="3">
                                    <IonCard className="feature-card">
                                        <IonCardContent className="ion-text-center">
                                            <IonIcon icon={pulseOutline} color="warning" size="large" />
                                            <h2>Ammonia</h2>
                                        </IonCardContent>
                                    </IonCard>
                                </IonCol>
                            </IonRow>
                        </IonCol>
                    </IonRow>

                    <IonRow className="ion-justify-content-center ion-margin-top">
                        <IonCheckbox
                            ref={agreeRef}
                            className={`${isValid ? 'ion-valid' : ''} ${isValid === false ? 'ion-invalid' : ''} ${isTouched ? 'ion-touched' : ''
                                }`}
                            helperText="Agree to the terms before continuing"
                            errorText="You must agree to the terms to continue"
                            onIonChange={(event) => {
                                validateCheckbox(event)
                                setShowTerms(true);
                            }}
                            labelPlacement="end"
                        >
                            I agree to the terms and conditions
                        </IonCheckbox>

                        {(showTerms && isValid) && (
                            <Terms
                                isOpen={showTerms}
                                onClose={() => setShowTerms(false)}
                            />
                        )}
                    </IonRow>

                    <IonRow className="ion-justify-content-center ion-margin-top">
                        <IonCol size="12" sizeMd="6">
                            <SignInButton mode="redirect">
                                <IonButton disabled={!isValid} expand="block" size="large" fill="clear" className="signin-button">
                                    SIGN IN
                                </IonButton>
                            </SignInButton>
                        </IonCol>
                    </IonRow>
                </IonGrid>
            </IonContent>
        </IonPage>
    );
};

export default Welcome;
