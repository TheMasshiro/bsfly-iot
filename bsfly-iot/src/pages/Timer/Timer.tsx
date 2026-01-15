import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonCol, IonContent, IonGrid, IonHeader, IonPage, IonRadio, IonRadioGroup, IonRow, IonText, IonTitle, IonToolbar, useIonToast } from '@ionic/react';
import './Timer.css';
import 'react-circular-progressbar/dist/styles.css';
import { useLifeCycle } from '../../context/LifeCycleContext';
import { timers } from '../../assets/assets';
import { useState, useCallback, useMemo } from 'react';
import Segments from '../../components/Segments/Segments';
import Toolbar from '../../components/Toolbar/Toolbar';
import Countdown from 'react-countdown';

const renderer = ({ hours, minutes, seconds, completed }: any) => {
    if (completed) {
        return "0";
    } else {
        return hours > 0
            ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
            : `${minutes}:${String(seconds).padStart(2, '0')}`;
    }
};

const Timer: React.FC = () => {
    const { stage, setStage } = useLifeCycle()
    const [time, setTime] = useState<number>(timers[0].seconds);
    const [startTime, setStartTime] = useState<number>(Date.now());

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

    const countdownDate = useMemo(() => startTime + (time * 1000), [startTime, time]);

    const handleTimeChange = useCallback((newTime: number, timerName: string) => {
        setTime(newTime);
        setStartTime(Date.now());
        presentToast(timerName, 1500);
    }, [presentToast]);

    return (
        <IonPage className="timer-page">
            <IonHeader>
                <Toolbar
                    header={"Timer"}
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
                                <IonCardHeader className="ion-justify-content-center ion-align-items-center ion-no-padding">
                                    <IonCardTitle>Current Stage: {stage}</IonCardTitle>
                                </IonCardHeader>
                                <IonCardContent>
                                    <div className="circular-progress-container circular-background-md">
                                        <div className="circular-progress-wrapper">
                                            <IonText className="timer-text">
                                                {time ? (
                                                    <Countdown
                                                        key={startTime}
                                                        date={countdownDate}
                                                        renderer={renderer}
                                                    />
                                                ) : "0:00:00"}
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
                                        onClick={() => handleTimeChange(timer.seconds, timer.name)}
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

                <Segments
                    stage={stage}
                    setStage={setStage}
                />
            </IonContent>
        </IonPage >
    );
};

export default Timer;
