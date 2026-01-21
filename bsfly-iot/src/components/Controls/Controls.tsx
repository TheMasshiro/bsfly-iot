import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonToggle, ToggleCustomEvent, useIonToast } from "@ionic/react";
import { FC, useState, useCallback } from "react";
import "./Controls.css"

interface ControlProps {
    title: string,
    description: string
}

const Controls: FC<ControlProps> = ({ title, description }) => {

    const [isTouched, setIsTouched] = useState<boolean>();
    const [isValid, setIsValid] = useState<boolean | undefined>();
    const [isChecked, setIsChecked] = useState<boolean>();

    const [present] = useIonToast()
    const presentToast = useCallback((message: string, duration: number) => {
        present({
            message: message,
            duration: duration,
            position: "top",
            mode: "ios",
            layout: "stacked",
            swipeGesture: "vertical",
        })
    }, [present]);

    const validateToggle = useCallback((event: ToggleCustomEvent<{ checked: boolean }>) => {
        setIsTouched(true);
        setIsChecked(event.detail.checked);
        setIsValid(event.detail.checked);
        const message = event.detail.checked ? `${title} turned on` : `${title} turned off`;
        presentToast(message, 700);
    }, [title, presentToast]);


    return (
        <IonCard mode="ios" className="controls-margin">
            <IonCardHeader>
                <IonCardTitle>{title}</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
                <IonToggle 
                    enableOnOffLabels={true}
                    className={`${isValid ? 'ion-valid' : ''} ${isValid === false ? 'ion-invalid' : ''} ${isTouched ? 'ion-touched' : ''}`}
                    justify="space-between"
                    checked={isChecked}
                    onIonChange={validateToggle}
                    aria-label={`Toggle ${title}`}
                >
                    {description}
                </IonToggle>
            </IonCardContent>
        </IonCard>
    )
}

export default Controls;
