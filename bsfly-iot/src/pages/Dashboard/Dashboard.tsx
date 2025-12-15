import { IonButtons, IonCard, IonCardContent, IonChip, IonCol, IonContent, IonGrid, IonHeader, IonIcon, IonMenuButton, IonPage, IonRow, IonSegment, IonSegmentButton, IonText, IonTitle, IonToolbar } from '@ionic/react';
import './Dashboard.css';
import { buildStyles, CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { Stage, useLifeCycle } from '../../context/LifeCycleContext';
import { sensorsData } from '../../assets/assets';
import { getStatus, lifecycleThresholds, Threshold } from '../../config/thresholds';
import { calculateStability } from '../../utils/calculateStability';

const sensorTypeMap: Record<string, string> = {
    "temperature": "temperature",
    "humidity": "humidity",
    "substrate moisture": "moisture",
    "ammonia": "ammonia",
};

export const statusColor = (sensorType: string, value: number, thresholds: any) => {
    return sensorType
        ? getStatus(value, thresholds[sensorType] as Threshold)
        : "medium";
}

const Dashboard: React.FC = () => {
    const { stage, setStage } = useLifeCycle()
    const thresholds = lifecycleThresholds[stage];
    const stability = calculateStability(sensorsData, thresholds);

    const status = (name: string, value: number) => {
        return statusColor(sensorTypeMap[name.toLowerCase()], value, thresholds)
    }

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonButtons slot="start">
                        <IonMenuButton />
                    </IonButtons>
                    <IonTitle>Dashboard</IonTitle>
                    <IonChip slot='end' color="danger">
                        Offline
                    </IonChip>
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen>
                <IonHeader collapse="condense">
                    <IonToolbar>
                        <IonTitle size="large">Dashboard</IonTitle>
                    </IonToolbar>
                </IonHeader>

                <IonGrid className="dashboard-grid">
                    <IonRow className="ion-justify-content-center ion-align-items-center">
                        <IonCol>
                            <IonCard className="circular-background-md">
                                <IonCardContent>
                                    <div className="circular-progress-container circular-background-md">
                                        <div className="circular-progress-wrapper">
                                            <CircularProgressbar
                                                className="circular-progress"
                                                value={stability}
                                                maxValue={1}
                                                text={`${Math.round(stability * 100)}%`}
                                                styles={buildStyles({
                                                    pathColor: stability >= 0.8 ? '#48bb78' : stability >= 0.5 ? '#ed8936' : '#f56565',
                                                    textColor: stability >= 0.8 ? '#48bb78' : stability >= 0.5 ? '#ed8936' : '#f56565',
                                                    trailColor: '#e5e7eb',
                                                    pathTransitionDuration: 0.9,
                                                })}
                                            />
                                            <IonText className="progress-text">Environment Stability</IonText>
                                            <IonChip className="progress-chip" color={stability >= 0.8 ? 'success' : stability >= 0.5 ? 'warning' : 'danger'}>
                                                {stability >= 0.8 ? 'Good' : stability >= 0.5 ? 'Moderate' : 'Poor'}
                                            </IonChip>
                                        </div>
                                    </div>
                                </IonCardContent>
                            </IonCard>
                        </IonCol>
                    </IonRow>
                    <IonRow className="ion-justify-content-center ion-align-items-center">
                        {sensorsData.map((sensor, index) => (
                            <IonCol size="12" sizeMd="6" key={index}>
                                <IonCard className={`sensor-card sensor-card-${status(sensor.name, sensor.value)}`}>
                                    <IonCardContent className="sensor-card-content">
                                        <div className="sensor-info">
                                            <IonIcon size="large" icon={sensor.icon}></IonIcon>
                                            <p className="sensor-name">{sensor.name}</p>
                                        </div>
                                        <span className="sensor-value">{sensor.value}</span>
                                        <span className="sensor-unit">{sensor.unit}</span>
                                    </IonCardContent>
                                </IonCard>
                            </IonCol>
                        ))}
                    </IonRow>
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

export default Dashboard;
