import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonChip, IonCol, IonContent, IonGrid, IonHeader, IonIcon, IonLabel, IonPage, IonRefresher, IonRefresherContent, IonRow, IonSegment, IonSegmentButton, IonSegmentContent, IonSegmentView, IonTitle, IonToolbar, useIonToast } from '@ionic/react';
import { lifecycleThresholds } from '../../config/thresholds';
import { FC, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { cloudOutline, thermometerOutline, waterOutline } from 'ionicons/icons';
import { useLifeCycle } from '../../context/LifeCycleContext';
import { useDevice } from '../../context/DeviceContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { offlineService } from '../../services/offline/OfflineService';
import Graph from '../../components/Graph/Graph';
import Segments from '../../components/Segments/Segments';
import GlobalFabControls from '../../components/GlobalFabControls/GlobalFabControls';
import "./Analytics.css"
import Toolbar from '../../components/Toolbar/Toolbar';
import PagePurpose from '../../components/PagePurpose/PagePurpose';
import { api, withToken } from '../../utils/api';
import { actuatorService } from '../../services/socket/socket';

interface SensorValues {
    temperature: number | null;
    humidity: number | null;
    moisture: number | null;
    leftSubstrate: number | null;
    centerSubstrate: number | null;
    rightSubstrate: number | null;
    ammonia: number | null;
}

const EMPTY_SENSOR_VALUES: SensorValues = {
    temperature: null,
    humidity: null,
    moisture: null,
    leftSubstrate: null,
    centerSubstrate: null,
    rightSubstrate: null,
    ammonia: null,
};

const formatAnalyticsValue = (sensor: string, value: number | null): string => {
    if (value === null) return '-';
    if (sensor === 'Left Substrate' || sensor === 'Center Substrate' || sensor === 'Right Substrate' || sensor === 'Moisture') {
        return Math.round(value).toString();
    }
    return value.toFixed(2);
};

const normalizeDrawerName = (name: unknown): string | null => {
    if (typeof name !== 'string') return null;
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('Drawer 2')) return 'Drawer 2';
    if (trimmed.startsWith('Drawer 1')) return 'Drawer 1';
    return trimmed;
};

const Analytics: FC = () => {
    const { stage, setStage } = useLifeCycle()
    const { currentDevice, refreshDevices, getToken } = useDevice();
    const isAppOnline = useOnlineStatus();
    const currentDeviceId = currentDevice?._id;
    const isDeviceOffline = currentDevice?.status === "offline";
    const thresholds = lifecycleThresholds[stage]
    const [selectedSegment, setSelectedSegment] = useState("Temperature")
    const [sensorValuesByDrawer, setSensorValuesByDrawer] = useState<Record<'Drawer 1' | 'Drawer 2', SensorValues>>({
        'Drawer 1': { ...EMPTY_SENSOR_VALUES },
        'Drawer 2': { ...EMPTY_SENSOR_VALUES },
    });
    const sensorValues = sensorValuesByDrawer[stage];
    const [isOfflineData, setIsOfflineData] = useState(false);
    const [present] = useIonToast();
    const lastErrorRef = useRef<number>(0);

    const normalizeSensorValues = useCallback((data: any): SensorValues => {
        const toNumberOrNull = (value: any) => (typeof value === "number" ? value : null);

        const leftSubstrate = toNumberOrNull(data?.leftSubstrate ?? data?.leftSoil);
        const centerSubstrate = toNumberOrNull(data?.centerSubstrate ?? data?.centerSoil);
        const rightSubstrate = toNumberOrNull(data?.rightSubstrate ?? data?.rightSoil);
        const moistureFromApi = toNumberOrNull(data?.moisture);

        const substrateValues = [leftSubstrate, centerSubstrate, rightSubstrate].filter((v): v is number => v !== null);
        const computedMoisture = substrateValues.length > 0
            ? substrateValues.reduce((sum, v) => sum + v, 0) / substrateValues.length
            : null;

        return {
            temperature: toNumberOrNull(data?.temperature),
            humidity: toNumberOrNull(data?.humidity),
            moisture: moistureFromApi ?? computedMoisture,
            leftSubstrate,
            centerSubstrate,
            rightSubstrate,
            ammonia: toNumberOrNull(data?.ammonia),
        };
    }, []);

    const getCacheKey = useCallback((targetStage: 'Drawer 1' | 'Drawer 2' = stage) => {
        return `sensor_current_${currentDeviceId}_${targetStage}`;
    }, [currentDeviceId, stage]);

    const fetchCurrentValues = useCallback(async (targetStage: 'Drawer 1' | 'Drawer 2' = stage) => {
        if (!currentDeviceId) return;

        const cacheKey = getCacheKey(targetStage);

        if (!isAppOnline || isDeviceOffline) {
            const cached = offlineService.get<SensorValues>(cacheKey);
            if (cached) {
                setSensorValuesByDrawer((prev) => ({
                    ...prev,
                    [targetStage]: cached,
                }));
                setIsOfflineData(true);
            }
            return;
        }

        try {
            const token = await getToken();
            const { data } = await api.get(`/api/sensors/device/${currentDeviceId}?drawer=${encodeURIComponent(targetStage)}`, withToken(token));
            const normalized = normalizeSensorValues(data);
            setSensorValuesByDrawer((prev) => ({
                ...prev,
                [targetStage]: normalized,
            }));
            offlineService.set(cacheKey, normalized);
            setIsOfflineData(false);
        } catch (error) {
            const cached = offlineService.get<SensorValues>(cacheKey);
            if (cached) {
                setSensorValuesByDrawer((prev) => ({
                    ...prev,
                    [targetStage]: cached,
                }));
                setIsOfflineData(!isAppOnline || isDeviceOffline);
            } else {
                setIsOfflineData(!isAppOnline || isDeviceOffline);
            }
            if (isAppOnline && !isDeviceOffline) {
                const now = Date.now();
                if (now - lastErrorRef.current > 5000) {
                    lastErrorRef.current = now;
                    present({
                        message: "Failed to load sensor data",
                        duration: 2000,
                        position: "top",
                        mode: "ios",
                        color: "danger",
                    });
                }
            }
        }
    }, [currentDeviceId, isDeviceOffline, stage, present, getToken, normalizeSensorValues, getCacheKey, isAppOnline]);

    useEffect(() => {
        if (!currentDeviceId) return;

        const cached = offlineService.get<SensorValues>(getCacheKey(stage));
        if (cached) {
            setSensorValuesByDrawer((prev) => ({
                ...prev,
                [stage]: cached,
            }));
            setIsOfflineData(!isAppOnline || isDeviceOffline);
        }

        fetchCurrentValues(stage);

        const intervalId = window.setInterval(() => {
            fetchCurrentValues(stage);
        }, 5000);

        return () => {
            clearInterval(intervalId);
        };
    }, [currentDeviceId, stage, fetchCurrentValues, getCacheKey, isAppOnline, isDeviceOffline]);

    useEffect(() => {
        if (!currentDeviceId) return;

        const handleSensorUpdate = (data: any) => {
            const incomingDrawer = normalizeDrawerName(data?.drawerName);
            if (incomingDrawer && incomingDrawer !== stage) return;
            const normalized = normalizeSensorValues(data);
            setSensorValuesByDrawer((prev) => ({
                ...prev,
                [stage]: normalized,
            }));
            offlineService.set(getCacheKey(stage), normalized);
            setIsOfflineData(false);
        };

        const unsubscribe = offlineService.subscribe((isAppOnline) => {
            if (isAppOnline && !isDeviceOffline) {
                fetchCurrentValues(stage);
            }
        });

        actuatorService.onSensor(currentDeviceId, handleSensorUpdate);

        return () => {
            actuatorService.offSensor(currentDeviceId, handleSensorUpdate);
            unsubscribe();
        };
    }, [currentDeviceId, isDeviceOffline, stage, fetchCurrentValues, normalizeSensorValues, getCacheKey]);

    const handleRefresh = async (event: CustomEvent) => {
        await Promise.all([fetchCurrentValues(), refreshDevices()]);
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
            ...(moisture && stage === 'Drawer 1' ? [
                {
                    id: "3",
                    sensor: "Left Substrate",
                    max: moisture.max,
                    min: moisture.min,
                    warn: moisture.optimal[1],
                    unit: "%",
                    icon: waterOutline
                },
                {
                    id: "4",
                    sensor: "Center Substrate",
                    max: moisture.max,
                    min: moisture.min,
                    warn: moisture.optimal[1],
                    unit: "%",
                    icon: waterOutline
                },
                {
                    id: "5",
                    sensor: "Right Substrate",
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
            } else if (graph.sensor === "Left Substrate") {
                latestValue = sensorValues.leftSubstrate ?? 0;
            } else if (graph.sensor === "Center Substrate") {
                latestValue = sensorValues.centerSubstrate ?? 0;
            } else if (graph.sensor === "Right Substrate") {
                latestValue = sensorValues.rightSubstrate ?? 0;
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
                <Toolbar />
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

                <PagePurpose text="Analyze historical trends and threshold status to evaluate drawer environmental performance." />

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
                                            <IonChip color={sensor.status} className={`sensor-quick-value status-${sensor.status}`}>
                                                {formatAnalyticsValue(sensor.sensor, typeof sensor.latestValue === 'number' ? sensor.latestValue : null)}{sensor.unit}
                                            </IonChip>
                                        </div>
                                    ))}
                                </IonCardContent>
                            </IonCard>
                        </IonCol>
                    </IonRow>
                    <IonRow>
                        <IonCol>
                            <IonSegment className="analytics-graph-segment" value={selectedSegment} onIonChange={e => setSelectedSegment(e.detail.value as string)}>
                                {sensorGraphs.map((graph) => (
                                    <IonSegmentButton key={graph.id} value={graph.sensor} contentId={graph.id}>
                                        <IonIcon icon={graph.icon} />
                                    </IonSegmentButton>
                                ))}
                            </IonSegment>
                            <IonSegmentView>
                                {sensorGraphs.map((graph) => (
                                    <IonSegmentContent key={graph.id} id={graph.id}>
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

                <GlobalFabControls />
            </IonContent>
        </IonPage >
    );
};

export default Analytics;

