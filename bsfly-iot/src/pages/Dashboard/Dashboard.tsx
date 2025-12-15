import { IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonChip, IonCol, IonContent, IonGrid, IonHeader, IonIcon, IonMenuButton, IonPage, IonRow, IonText, IonTitle, IonToolbar } from '@ionic/react';
import './Dashboard.css';
import { buildStyles, CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { useLifeCycle } from '../../context/LifeCycleContext';
import { sensorsData } from '../../assets/assets';
import { getStatus, lifecycleThresholds, Threshold } from '../../config/thresholds';
import { calculateQuality } from '../../utils/calculateQuality';
import Segments from '../../components/Segments/Segments';

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
    const quality = calculateQuality(sensorsData, thresholds);

    const status = (name: string, value: number) => {
        return statusColor(sensorTypeMap[name.toLowerCase()], value, thresholds)
    }

    return (
        <IonPage className="dashboard-page">
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
                                                value={quality}
                                                maxValue={1}
                                                text={`${Math.round(quality * 100)}%`}
                                                styles={buildStyles({
                                                    pathColor: quality >= 0.8 ? '#42d96b' : quality >= 0.5 ? '#ffca22' : '#cb1a27',
                                                    textColor: quality >= 0.8 ? '#42d96b' : quality >= 0.5 ? '#ffca22' : '#cb1a27',
                                                    trailColor: '#f6f8fc',
                                                    pathTransitionDuration: 0.9,
                                                })}
                                            />
                                            <IonText className="progress-text">Environment Quality</IonText>
                                            <IonChip className="progress-chip" color={quality >= 0.8 ? 'success' : quality >= 0.5 ? 'warning' : 'danger'}>
                                                {quality >= 0.8 ? 'Good' : quality >= 0.5 ? 'Moderate' : 'Poor'}
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

                <Segments
                    stage={stage}
                    setStage={setStage}
                />
            </IonContent>
        </IonPage >
    );
};

export default Dashboard;
