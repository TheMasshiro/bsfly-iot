import { IonButton, IonContent, IonIcon, IonPage, IonText } from '@ionic/react';
import { alertCircleOutline, refreshOutline } from 'ionicons/icons';
import { FC } from 'react';
import './ErrorFallback.css';

interface Props {
    error: Error | null;
    onReset: () => void;
}

const ErrorFallback: FC<Props> = ({ error, onReset }) => {
    const handleReload = () => {
        window.location.reload();
    };

    return (
        <IonPage>
            <IonContent className="error-fallback-content">
                <div className="error-fallback-container">
                    <IonIcon icon={alertCircleOutline} className="error-icon" color="danger" />
                    <h1>Something went wrong</h1>
                    <IonText color="medium">
                        <p>An unexpected error occurred. Please try again.</p>
                    </IonText>
                    {error && (
                        <div className="error-details">
                            <code>{error.message}</code>
                        </div>
                    )}
                    <div className="error-actions">
                        <IonButton onClick={onReset} fill="outline">
                            <IonIcon slot="start" icon={refreshOutline} />
                            Try Again
                        </IonButton>
                        <IonButton onClick={handleReload}>
                            Reload App
                        </IonButton>
                    </div>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default ErrorFallback;
