import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonChip, IonCol, IonContent, IonGrid, IonHeader, IonIcon, IonLabel, IonPage, IonRefresher, IonRefresherContent, IonRow, IonSegment, IonSegmentButton, IonSegmentContent, IonSegmentView, IonTitle, IonToolbar } from '@ionic/react';
import { lifecycleThresholds } from '../../config/thresholds';
import { FC, useMemo, useState, useEffect, useCallback } from 'react';
import { cloudOutline, thermometerOutline, waterOutline } from 'ionicons/icons';
import { useLifeCycle } from '../../context/LifeCycleContext';
import { useDevice } from '../../context/DeviceContext';
import Graph from '../../components/Graph/Graph';
import Segments from '../../components/Segments/Segments';
import "./Analytics.css"
import Toolbar from '../../components/Toolbar/Toolbar';

const API_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000").replace(/\/+$/, "");

interface SensorValues {
    temperature: number | null;
    humidity: number | null;
    moisture1: number | null;
    moisture2: number | null;
    ammonia: number | null;
}

const Analytics: FC = () => {
    const { stage, setStage } = useLifeCycle()
    const { currentDevice } = useDevice();
    const thresholds = lifecycleThresholds[stage]
    const [selectedSegment, setSelectedSegment] = useState("Temperature")
    const [sensorValues, setSensorValues] = useState<SensorValues>({
        temperature: null,
        humidity: null,
        moisture1: null,
        moisture2: null,
        ammonia: null,
    });

    const fetchCurrentValues = useCallback(async () => {
        if (!currentDevice) return;
        try {
            const response = await fetch(`${API_URL}/api/sensors/device/${currentDevice._id}`);
            if (response.ok) {
                const data = await response.json();
                setSensorValues(data);
            }
        } catch {
        }
    }, [currentDevice]);

    useEffect(() => {
        fetchCurrentValues();
        const interval = setInterval(fetchCurrentValues, 10000);
        return () => clearInterval(interval);
    }, [fetchCurrentValues]);

    const handleRefresh = async (event: CustomEvent) => {
        await fetchCurrentValues();
        event.detail.complete();
    };

    const sensorGraphs = useMemo(() => {
        const moisture = 'moisture' in thresholds ? thresholds.moisture : null;
        const graphs = [
            {
                id: "1",
                sensor: "Temperature",
                max: thresholds.temperature.max,
                min: thresholds.temperature.min,
                warn: thresholds.temperature.optimal[1],
                unit: "°C",
                icon: thermometerOutline
            },
            {
                id: "2",
                sensor: "Humidity",
                max: thresholds.humidity.max,
                min: thresholds.humidity.min,
                warn: thresholds.humidity.optimal[1],
                unit: "%",
                icon: cloudOutline
            },
            ...(moisture ? [
                {
                    id: "3",
                    sensor: "Substrate Moisture 1",
                    max: moisture.max,
                    min: moisture.min,
                    warn: moisture.optimal[1],
                    unit: "%",
                    icon: waterOutline
                },
                {
                    id: "4",
                    sensor: "Substrate Moisture 2",
                    max: moisture.max,
                    min: moisture.min,
                    warn: moisture.optimal[1],
                    unit: "%",
                    icon: waterOutline
                }
            ] : [])
        ];

        return graphs;
    }, [thresholds, stage]);

    const sensorCurrentValues = useMemo(() => {
        return sensorGraphs.map(graph => {
            let latestValue = 0;
            
            if (graph.sensor === "Temperature") {
                latestValue = sensorValues.temperature ?? 0;
            } else if (graph.sensor === "Humidity") {
                latestValue = sensorValues.humidity ?? 0;
            } else if (graph.sensor === "Substrate Moisture 1") {
                latestValue = sensorValues.moisture1 ?? 0;
            } else if (graph.sensor === "Substrate Moisture 2") {
                latestValue = sensorValues.moisture2 ?? 0;
            }

            let status: 'danger' | 'warning' | 'primary' | 'success';

            if (latestValue >= graph.max) status = 'danger';
            else if (latestValue >= graph.warn) status = 'warning';
            else if (latestValue <= graph.min) status = 'primary';
            else status = 'success';

            return { ...graph, latestValue, status };
        });
    }, [sensorGraphs, sensorValues]);

    return (
        <IonPage className="analytics-page">
            <IonHeader>
                <Toolbar
                    header={"Analytics"}
                />
            </IonHeader>

            <IonContent fullscreen>
                <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
                    <IonRefresherContent />
                </IonRefresher>
                <IonHeader collapse="condense">
                    <IonToolbar>
                        <IonTitle size="large">Analytics</IonTitle>
                    </IonToolbar>
                </IonHeader>

                <IonGrid>
                    <IonRow className="ion-justify-content-center ion-align-items-center">
                        <IonCol>
                            <IonCard className="sensor-quick-switch-card">
                                <IonCardHeader className="ion-no-padding">
                                    <IonCardTitle>Current {stage}</IonCardTitle>
                                </IonCardHeader>
                                <IonCardContent className="sensor-buttons-container">
                                    {sensorCurrentValues.map((sensor) => (
                                        <div
                                            key={sensor.id}
                                            className="sensor-quick-btn"
                                            aria-label={`${sensor.sensor}: ${sensor.latestValue}${sensor.unit}`}
                                        >
                                            <IonIcon icon={sensor.icon} className="sensor-quick-icon" />
                                            <IonChip className={`sensor-quick-value status-${sensor.status}`}>
                                                {sensor.latestValue}{sensor.unit}
                                            </IonChip>
                                        </div>
                                    ))}
                                </IonCardContent>
                            </IonCard>
                        </IonCol>
                    </IonRow>
                    <IonRow>
                        <IonCol>
                            <IonSegment value={selectedSegment} onIonChange={e => setSelectedSegment(e.detail.value as string)}>
                                {sensorGraphs.map((graph) => (
                                    <IonSegmentButton key={graph.id} value={graph.sensor} contentId={graph.sensor}>
                                        <IonIcon icon={graph.icon} />
                                    </IonSegmentButton>
                                ))}
                            </IonSegment>
                            <IonSegmentView>
                                {sensorGraphs.map((graph) => (
                                    <IonSegmentContent key={graph.id} id={graph.sensor}>
                                        <Graph
                                            sensorType={graph.sensor}
                                            upperLimit={graph.max}
                                            lowerLimit={graph.min}
                                            warningLimit={graph.warn}
                                            unit={graph.unit} />

                                        <IonRow class="ion-justify-content-center ion-align-items-center legends-row">
                                            <IonChip color="danger">
                                                <IonLabel>Upper: {graph.max}{graph.unit}</IonLabel>
                                            </IonChip>
                                            <IonChip color="warning">
                                                <IonLabel>Warning: {graph.warn}{graph.unit}</IonLabel>
                                            </IonChip>
                                            <IonChip color="secondary">
                                                <IonLabel>Lower: {graph.min}{graph.unit}</IonLabel>
                                            </IonChip>
                                        </IonRow>
                                    </IonSegmentContent>
                                ))}
                            </IonSegmentView>
                        </IonCol>
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

export default Analytics;

