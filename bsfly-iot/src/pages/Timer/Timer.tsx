import { IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonChip, IonCol, IonContent, IonGrid, IonHeader, IonItem, IonMenuButton, IonPage, IonRadio, IonRadioGroup, IonRow, IonSegment, IonSegmentButton, IonText, IonTitle, IonToolbar } from '@ionic/react';
import './Timer.css';
import { buildStyles, CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { Stage, useLifeCycle } from '../../context/LifeCycleContext';
import { timers } from '../../assets/assets';
import { getStatus, Threshold } from '../../config/thresholds';
import { useState } from 'react';

export const statusColor = (sensorType: string, value: number, thresholds: any) => {
    return sensorType
        ? getStatus(value, thresholds[sensorType] as Threshold)
        : "medium";
}

const Timer: React.FC = () => {
    const { stage, setStage } = useLifeCycle()
    const [time, setTime] = useState<number>(timers[0].seconds);

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonButtons slot="start">
                        <IonMenuButton />
                    </IonButtons>
                    <IonTitle>Timer</IonTitle>
                    <IonChip slot='end' color="danger">
                        Offline
                    </IonChip>
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen>
                <IonHeader collapse="condense">
                    <IonToolbar>
                        <IonTitle size="large">Timer</IonTitle>
                    </IonToolbar>
                </IonHeader>

                <IonGrid className="dashboard-grid">
                    <IonRow className="ion-justify-content-center ion-align-items-center">
                        <IonCol>
                            <IonCard className="circular-background-md">
                                <IonCardHeader>
                                    <IonCardTitle>Current Stage: {stage}</IonCardTitle>
                                </IonCardHeader>
                                <IonCardContent>
                                    <div className="circular-progress-container circular-background-md">
                                        <div className="circular-progress-wrapper">
                                            <CircularProgressbar
                                                className="circular-progress"
                                                value={0}
                                                maxValue={1}
                                                text={`${Math.round(0 * 100)}`}
                                                styles={buildStyles({
                                                    pathColor: '#0054e9',
                                                    textColor: '#0054e9',
                                                    trailColor: '#e5e7eb',
                                                    pathTransitionDuration: 0.9,
                                                })}
                                            />
                                            <IonText className="progress-text">{time ? "Light is set to" : "Disabled"}</IonText>
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
                                        onClick={() => setTime(timer.seconds)}
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

                <div className="stage-selector-container">
                    <IonSegment
                        value={stage}
                        onIonChange={(e) => setStage(e.detail.value as Stage)}
                    >
                        <IonSegmentButton value="Egg">
                            <div className="stage-button-content">
                                <span className="stage-label">Egg</span>
                            </div>
                        </IonSegmentButton>

                        <IonSegmentButton value="Larva">
                            <div className="stage-button-content">
                                <span className="stage-label">Larva</span>
                            </div>
                        </IonSegmentButton>

                        <IonSegmentButton value="Pupa">
                            <div className="stage-button-content">
                                <span className="stage-label">Pupa</span>
                            </div>
                        </IonSegmentButton>

                        <IonSegmentButton value="Adult">
                            <div className="stage-button-content">
                                <span className="stage-label">Adult</span>
                            </div>
                        </IonSegmentButton>
                    </IonSegment>
                </div>
            </IonContent>
        </IonPage >
    );
};

export default Timer;
