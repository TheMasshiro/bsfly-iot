import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonToggle, ToggleCustomEvent, useIonToast } from "@ionic/react";
import { FC, useState, useCallback, useMemo } from "react";
import "./Controls.css";

interface ControlsProps {
    title: string;
    description: string;
}

const Controls: FC<ControlsProps> = ({ title, description }) => {
    const [isTouched, setIsTouched] = useState(false);
    const [isChecked, setIsChecked] = useState(false);
    const [present] = useIonToast();

    const handleToggle = useCallback((event: ToggleCustomEvent) => {
        const checked = event.detail.checked;
        setIsTouched(true);
        setIsChecked(checked);
        present({
            message: `${title} turned ${checked ? 'on' : 'off'}`,
            duration: 700,
            position: "top",
            mode: "ios",
            layout: "stacked",
            swipeGesture: "vertical",
        });
    }, [title, present]);

    const toggleClassName = useMemo(() => 
        `${isChecked ? 'ion-valid' : 'ion-invalid'} ${isTouched ? 'ion-touched' : ''}`.trim()
    , [isChecked, isTouched]);

    return (
        <IonCard mode="ios" className="controls-margin">
            <IonCardHeader>
                <IonCardTitle>{title}</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
                <IonToggle 
                    enableOnOffLabels
                    className={toggleClassName}
                    justify="space-between"
                    checked={isChecked}
                    onIonChange={handleToggle}
                    aria-label={`Toggle ${title}`}
                >
                    {description}
                </IonToggle>
            </IonCardContent>
        </IonCard>
    );
};

export default Controls;
