import { IonCard, IonCardContent, IonCol, IonContent, IonGrid, IonHeader, IonIcon, IonPage, IonRadio, IonRadioGroup, IonRow, IonText, IonTitle, IonToolbar, useIonToast } from '@ionic/react';
import './Light.css';
import 'react-circular-progressbar/dist/styles.css';
import { timers } from '../../assets/assets';
import { useState, useCallback, useMemo } from 'react';
import Toolbar from '../../components/Toolbar/Toolbar';
import Countdown from 'react-countdown';
import { heart, heartOutline } from 'ionicons/icons';

const renderer = ({ hours, minutes, seconds, completed }: any) => {
    if (completed) {
        return "0";
    } else {
        return hours > 0
            ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
            : `${minutes}:${String(seconds).padStart(2, '0')}`;
    }
};

const Light: React.FC = () => {
    const [time, setTime] = useState<number>(timers[0].seconds);
    const [startTime, setStartTime] = useState<number>(Date.now());

    const countdownDate = useMemo(() => startTime + (time * 1000), [startTime, time]);
    const isLightOn = time > 0;

    const handleTimeChange = useCallback((newTime: number) => {
        setTime(newTime);
        setStartTime(Date.now());
    }, []);

    return (
        <IonPage className="timer-page">
            <IonHeader>
                <Toolbar
                    header={"Light"}
                />
            </IonHeader>
            <IonContent fullscreen>
                <IonHeader collapse="condense">
                    <IonToolbar>
                        <IonTitle size="large">Timer</IonTitle>
                    </IonToolbar>
                </IonHeader>

                <IonGrid>
                    <IonRow className="ion-justify-content-center ion-align-items-center">
                        <IonCol>
                            <IonCard className="circular-background-md">
                                <IonCardContent>
                                    <div className="circular-progress-container circular-background-md">
                                        <div className="circular-progress-wrapper">
                                            <div className={`light-bulb-container ${isLightOn ? 'light-on' : 'light-off'}`}>
                                                <IonIcon
                                                    icon={isLightOn ? heart : heartOutline}
                                                    className="light-bulb-icon"
                                                />
                                            </div>
                                            <IonText className="timer-text">
                                                {time ? (
                                                    <Countdown
                                                        key={startTime}
                                                        date={countdownDate}
                                                        renderer={renderer}
                                                    />
                                                ) : "Off"}
                                            </IonText>
                                            <IonText className="light-status-text">
                                                {isLightOn ? 'Light On' : 'Light Off'}
                                            </IonText>
                                        </div>
                                    </div>
                                </IonCardContent>
                            </IonCard>
                        </IonCol>
                    </IonRow>
                    <IonRadioGroup value={time}>
                        <IonRow className="ion-justify-content-center ion-align-items-center">
                            {timers.map((timer) => (
                                <IonCol size="12" key={timer.id}>
                                    <IonCard
                                        className={`timer-card ${time === timer.seconds ? 'timer-card-selected' : 'timer-card-primary'}`}
                                        button
                                        onClick={() => handleTimeChange(timer.seconds)}
                                    >
                                        <IonCardContent className="timer-card-content">
                                            <IonRadio value={timer.seconds} justify='space-between'>
                                                <span className="timer-value">{timer.name}</span>
                                            </IonRadio>
                                        </IonCardContent>
                                    </IonCard>
                                </IonCol>
                            ))}
                        </IonRow>
                    </IonRadioGroup>
                </IonGrid>
            </IonContent>
        </IonPage >
    );
};

export default Light;
