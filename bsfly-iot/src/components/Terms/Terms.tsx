import { useState, useRef, useEffect, FC } from 'react';
import {
    IonButtons,
    IonButton,
    IonModal,
    IonHeader,
    IonContent,
    IonToolbar,
    IonTitle,
    useIonActionSheet,
} from '@ionic/react';

interface TermsProps {
    isOpen: boolean;
    onClose: () => void;
}

const Terms: FC<TermsProps> = ({ isOpen, onClose }) => {
    const modal = useRef<HTMLIonModalElement>(null);
    const page = useRef(null);

    const [presentingElement, setPresentingElement] = useState<HTMLElement | null>(null);
    const [present] = useIonActionSheet();

    useEffect(() => {
        setPresentingElement(page.current);
    }, []);

    const canDismiss = () => {
        return new Promise<boolean>((resolve, reject) => {
            present({
                header: 'Done Reading?',
                buttons: [
                    {
                        text: 'Yes',
                        role: 'confirm',
                    },
                    {
                        text: 'No',
                        role: 'cancel',
                    },
                ],
                onWillDismiss: (event) => {
                    if (event.detail.role === 'confirm') {
                        resolve(true);
                    } else {
                        resolve(false);
                        reject();
                    }
                },
            });
        });
    }

    return (
        <IonModal
            ref={modal}
            isOpen={isOpen}
            onDidDismiss={onClose}
            canDismiss={canDismiss}
            presentingElement={presentingElement!}
        >
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Terms and Conditions</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={() => modal.current?.dismiss()}>Close</IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent className="ion-padding">
                <h2>1. Acceptance of Terms</h2>
                <p>
                    By accessing and using this application, you accept and agree to be bound by the terms and provision of this agreement.
                </p>

                <h2>2. Use of the Application</h2>
                <p>
                    You agree to use the application only for lawful purposes and in a way that does not infringe the rights of others.
                </p>

                <h2>3. Privacy</h2>
                <p>
                    Your privacy is important to us. Please review our Privacy Policy to understand how we collect and use information.
                </p>

                <h2>4. Intellectual Property</h2>
                <p>
                    All content included in the application, such as text, graphics, logos, and images, is the property of the application owner or its content suppliers.
                </p>

                <h2>5. Limitation of Liability</h2>
                <p>
                    The application is provided "as is". We are not liable for any damages resulting from the use or inability to use the application.
                </p>

                <h2>6. Changes to Terms</h2>
                <p>
                    We reserve the right to modify these terms at any time. Continued use of the application constitutes acceptance of the updated terms.
                </p>
            </IonContent>
        </IonModal>
    );
}

export default Terms;
