import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonCol, IonContent, IonGrid, IonHeader, IonPage, IonRadio, IonRadioGroup, IonRow, IonText, IonTitle, IonToolbar, useIonToast } from '@ionic/react';
import './Timer.css';
import { buildStyles, CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { useLifeCycle } from '../../context/LifeCycleContext';
import { timers } from '../../assets/assets';
import { getStatus, Threshold } from '../../config/thresholds';
import { useState } from 'react';
import Segments from '../../components/Segments/Segments';
import Toolbar from '../../components/Toolbar/Toolbar';
import Countdown from 'react-countdown';

export const statusColor = (sensorType: string, value: number, thresholds: any) => {
    return sensorType
        ? getStatus(value, thresholds[sensorType] as Threshold)
        : "medium";
}

const Timer: React.FC = () => {
    const { stage, setStage } = useLifeCycle()
    const [time, setTime] = useState<number>(timers[0].seconds);

    const [present] = useIonToast()
    const presentToast = (message: string, duration: number) => {
        present({
            message: message,
            duration: duration,
            position: "top",
            mode: "ios",
            layout: "stacked",
            swipeGesture: "vertical",
        })
    }

    const renderer = ({ hours, minutes, seconds, completed }: any) => {
        if (completed) {
            return "0";
        } else {
            return hours > 0
                ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
                : `${minutes}:${String(seconds).padStart(2, '0')}`;
        }
    };

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
                                            <CircularProgressbar
                                                className="circular-progress"
                                                value={0}
                                                maxValue={1}
                                                text={time ? (
                                                    <Countdown
                                                        date={Date.now() + (time * 1000)}
                                                        renderer={renderer}
                                                    />
                                                ) : "0:00:00"}
                                                styles={buildStyles({
                                                    pathColor: '#1a65eb',
                                                    textColor: '#1a65eb',
                                                    trailColor: '#e5e7eb',
                                                    pathTransitionDuration: 0.9,
                                                })}
                                            />
                                            <IonText className="progress-text">
                                            </IonText>
                                        </div>
                                    </div>
                                </IonCardContent>
                            </IonCard>
                        </IonCol>
                    </IonRow>
                    <IonRadioGroup
                        value={time}
                        onIonChange={(e) => {
                            setTime(e.detail.value)
                        }}>
                        <IonRow className="ion-justify-content-center ion-align-items-center">
                            {timers.map((timer) => (
                                <IonCol size="12" key={timer.id}>
                                    <IonCard
                                        className={`timer-card ${time === timer.seconds ? 'timer-card-selected' : 'timer-card-primary'}`}
                                        button
                                        onClick={() => {
                                            setTime(timer.seconds)
                                            presentToast(`Light is set to ${timer.name}`, 1500)
                                        }
                                        }
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
