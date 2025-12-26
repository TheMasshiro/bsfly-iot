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
                header: 'Agree to Terms and Conditions?',
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
                <h2>1. Agreement to Terms</h2>
                <p>
                    These Terms and Conditions (“Terms”) govern your use of the BSFLy IoT application and related services. By installing, accessing, or using the App, you agree to be bound by these Terms.
                </p>

                <h2>2. Purpose and Academic Use</h2>
                <p>
                    The App was developed as part of an academic capstone project. It is provided for demonstration, evaluation, and research purposes only and is not intended for commercial or mission-critical use.
                </p>

                <h2>3. Eligibility</h2>
                <p>
                    The App is intended for users aged 18 years and above. By using the App, you confirm that you meet this requirement.
                </p>

                <h2>4. License</h2>
                <p>
                    The App’s source code is licensed under the MIT License.
                    Users are permitted to use, copy, modify, and distribute the software
                    in accordance with the terms of the MIT License. A copy of the license
                    is provided with the App’s source code.
                </p>

                <h2>5. Privacy and Data</h2>
                <p>
                    The App may collect limited technical data, such as device identifiers and anonymous usage information, solely for functionality and academic evaluation. No sensitive personal data is intentionally collected.
                </p>

                <h2>6. Prohibited Use</h2>
                <p>
                    You agree not to:
                </p>
                <ul>
                    <li>
                        Use the App for unlawful purposes
                    </li>
                    <li>
                        Attempt to disrupt or compromise system security
                    </li>
                    <li>
                        Use the App in any manner that could cause harm to people, property, or data
                    </li>
                </ul>

                <h2>7. Intellectual Property and Authorship</h2>
                <p>
                    All original content, system design, and documentation associated with the App were created by the author as part of an academic requirement. Third-party libraries or tools remain the property of their respective owners and are used under their applicable licenses.
                </p>
                <h2>8. Limitations of Use</h2>
                <p>
                    The App is provided for educational and experimental purposes only. The author makes no guarantees regarding accuracy, reliability, or availability. The App must not be relied upon for professional, safety-critical, or real-world operational decisions.
                </p>

                <h2>9. Warranty Disclaimer</h2>
                <p>
                    THE APP IS PROVIDED “AS IS,” WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.
                </p>

                <h2>10. Limitation of Liability</h2>
                <p>
                    To the maximum extent permitted by law, the author shall not be liable for any direct or indirect damages arising from the use or inability to use the App.
                </p>

                <h2>11. Termination</h2>
                <p>
                    Access to the App may be suspended or terminated if these Terms are violated
                    or if continued use is deemed inappropriate for academic purposes.
                </p>

                <h2>12. Changes to Terms</h2>
                <p>
                    These Terms may be updated as part of academic revisions or improvements to the project. Continued use of the App constitutes acceptance of the updated Terms.
                </p>

                <h2>13. Governing Law</h2>
                <p>
                    These Terms are governed by the laws of the Republic of the Philippines.
                </p>

                <h2>14. Contact</h2>
                <p>
                    For academic or project-related inquiries, contact:<br />
                    <strong>Email:</strong> johnc.vicente1@gmail.com
                </p>
            </IonContent>
        </IonModal>
    );
}

export default Terms;
