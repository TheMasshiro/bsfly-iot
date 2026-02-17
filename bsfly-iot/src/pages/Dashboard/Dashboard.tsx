import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonChip, IonCol, IonContent, IonGrid, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonRow, IonText, IonTitle, IonToolbar, useIonToast } from '@ionic/react';
import './Dashboard.css';
import { buildStyles, CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { useLifeCycle } from '../../context/LifeCycleContext';
import { useDevice } from '../../context/DeviceContext';
import { useNotification } from '../../context/NotificationContext';
import { sensorsData, controlsData } from '../../assets/assets';
import { getStatus, lifecycleThresholds, Threshold } from '../../config/thresholds';
import { calculateQuality } from '../../utils/calculateQuality';
import Segments from '../../components/Segments/Segments';
import Toolbar from '../../components/Toolbar/Toolbar';
import LoadingSkeleton from '../../components/LoadingSkeleton/LoadingSkeleton';
import { useState, useMemo, useCallback, useEffect, useRef, FC } from 'react';
import { snow, flame, water, rainy } from 'ionicons/icons';
import { actuatorService } from '../../services/socket/socket';
import { api, withToken } from '../../utils/api';

const sensorTypeMap: Record<string, string> = {
    "temperature": "temperature",
    "humidity": "humidity",
    "substrate moisture": "moisture",
    "ammonia": "ammonia",
};

const quickActionIcons: Record<string, string> = {
    "Fan": snow,
    "Heater": flame,
    "Humidifier": water,
    "Dehumidifier": rainy,
    "Misting Device": water,
};

const getActuatorId = (deviceId: string | undefined, stage: string, actionName: string): string => {
    const drawerNum = stage.toLowerCase().replace('drawer ', '');
    const actionMap: Record<string, string> = {
        "Fan": "fan",
        "Heater": "heater",
        "Humidifier": "humidifier",
        "Dehumidifier": "dehumidifier",
        "Misting Device": "misting",
    };
    const actuator = actionMap[actionName] || actionName.toLowerCase();
    return deviceId ? `${deviceId}:drawer${drawerNum}:${actuator}` : `drawer${drawerNum}:${actuator}`;
};

export const statusColor = (sensorType: string, value: number, thresholds: Record<string, Threshold | { min: number; max: number; optimal: number[] }>) => {
    const threshold = sensorType && thresholds[sensorType];
    if (!threshold) return "medium";
    return getStatus(value, threshold as Threshold);
}

const Dashboard: FC = () => {
    const { stage, setStage } = useLifeCycle()
    const { currentDevice, refreshDevices, loading: deviceLoading, getToken } = useDevice();
    const { addNotification } = useNotification();
    const deviceId = currentDevice?._id;
    const [sensorLoading, setSensorLoading] = useState(true);
    const [sensorData, setSensorData] = useState<Record<string, number | null>>({
        temperature: null,
        humidity: null,
        moisture: null,
        ammonia: null,
    });
    const thresholds = lifecycleThresholds[stage];

    const status = useCallback((name: string, value: number | string) => {
        if (value === "--" || typeof value === "string") return "medium";
        return statusColor(sensorTypeMap[name.toLowerCase()], value, thresholds)
    }, [thresholds]);

    const filteredSensors = useMemo(() =>
        sensorsData.map(sensor => {
            if (sensor.name === "Temperature" && sensorData.temperature !== null) {
                return { ...sensor, value: sensorData.temperature };
            }
            if (sensor.name === "Humidity" && sensorData.humidity !== null) {
                return { ...sensor, value: sensorData.humidity };
            }
            if (sensor.name === "Substrate Moisture" && sensorData.moisture !== null) {
                return { ...sensor, value: sensorData.moisture };
            }
            if (sensor.name === "Ammonia" && sensorData.ammonia !== null) {
                return { ...sensor, value: sensorData.ammonia };
            }
            return sensor;
        }).filter(sensor => {
            if (stage.toLowerCase() === 'drawer 3') {
                const name = sensor.name.toLowerCase();
                if (name.includes('substrate moisture') || name === 'ammonia') {
                    return false;
                }
            }
            return true;
        }), [stage, sensorData]);

    const quality = useMemo(() => calculateQuality(filteredSensors, thresholds, stage), [filteredSensors, thresholds, stage]);

    const qualityColor = useMemo(() =>
        quality >= 0.8 ? '#42d96b' : quality >= 0.5 ? '#ffca22' : '#cb1a27'
        , [quality]);

    const qualityChipColor = useMemo(() =>
        quality >= 0.8 ? 'success' : quality >= 0.5 ? 'warning' : 'danger'
        , [quality]);

    const qualityText = useMemo(() =>
        quality >= 0.8 ? 'Good Quality' : quality >= 0.5 ? 'Moderate Quality' : 'Poor Quality'
        , [quality]);

    const [present] = useIonToast();

    const [actuatorStates, setActuatorStates] = useState<Record<string, Record<string, boolean>>>(() => {
        const stages = ['Drawer 1', 'Drawer 2', 'Drawer 3'];
        const initial: Record<string, Record<string, boolean>> = {};
        stages.forEach(s => {
            initial[s] = {};
            controlsData.forEach(c => {
                if (c.available) initial[s][c.name] = false;
            });
        });
        return initial;
    });

    const shownAlertsRef = useRef<Set<string>>(new Set());

    const fetchSensorData = useCallback(async () => {
        if (!deviceId) {
            setSensorLoading(false);
            return;
        }
        try {
            const token = await getToken();
            const { data } = await api.get(`/api/sensors/device/${deviceId}`, withToken(token));
            setSensorData(data);
        } catch {
            present({
                message: "Failed to load sensor data",
                duration: 2000,
                position: "top",
                mode: "ios",
                color: "danger",
            });
        } finally {
            setSensorLoading(false);
        }
    }, [deviceId, present, getToken]);

    useEffect(() => {
        if (!deviceId) return;
        fetchSensorData();
        const interval = setInterval(fetchSensorData, 10000);
        return () => clearInterval(interval);
    }, [deviceId, fetchSensorData]);

    const handleRefresh = async (event: CustomEvent) => {
        await Promise.all([fetchSensorData(), refreshDevices()]);
        event.detail.complete();
    };

    useEffect(() => {
        const drawerNum = stage.toLowerCase().replace('drawer ', '');
        const drawer = `drawer${drawerNum}` as 'drawer1' | 'drawer2' | 'drawer3';

        const sensorChecks = [
            { key: 'temperature', name: 'Temperature', value: sensorData.temperature, unit: '°C' },
            { key: 'humidity', name: 'Humidity', value: sensorData.humidity, unit: '%' },
            { key: 'moisture', name: 'Substrate Moisture', value: sensorData.moisture, unit: '%' },
            { key: 'ammonia', name: 'Ammonia', value: sensorData.ammonia, unit: 'ppm' },
        ];

        sensorChecks.forEach(({ key, name, value, unit }) => {
            if (value === null || value === undefined) return;

            const threshold = thresholds[key as keyof typeof thresholds];
            if (!threshold) return;

            const [optimalMin, optimalMax] = threshold.optimal;
            const isDanger = value < threshold.min || value > threshold.max;
            const isWarning = !isDanger && (value < optimalMin || value > optimalMax);
            const isNormal = value >= optimalMin && value <= optimalMax;

            const dangerLowKey = `${stage}-${name}-danger-low`;
            const dangerHighKey = `${stage}-${name}-danger-high`;
            const warningLowKey = `${stage}-${name}-warning-low`;
            const warningHighKey = `${stage}-${name}-warning-high`;

            if (value < threshold.min && !shownAlertsRef.current.has(dangerLowKey)) {
                shownAlertsRef.current.add(dangerLowKey);
                addNotification({
                    type: 'danger',
                    title: `${name} Critical`,
                    message: `${name} is critically low: ${value}${unit} (min: ${threshold.min}${unit})`,
                    drawer,
                });
                present({
                    message: `${name} is critically low: ${value}${unit}`,
                    duration: 3000,
                    position: "top",
                    mode: "ios",
                    color: "danger",
                });
            } else if (value > threshold.max && !shownAlertsRef.current.has(dangerHighKey)) {
                shownAlertsRef.current.add(dangerHighKey);
                addNotification({
                    type: 'danger',
                    title: `${name} Critical`,
                    message: `${name} is critically high: ${value}${unit} (max: ${threshold.max}${unit})`,
                    drawer,
                });
                present({
                    message: `${name} is critically high: ${value}${unit}`,
                    duration: 3000,
                    position: "top",
                    mode: "ios",
                    color: "danger",
                });
            } else if (isWarning && value < optimalMin && !shownAlertsRef.current.has(warningLowKey)) {
                shownAlertsRef.current.add(warningLowKey);
                addNotification({
                    type: 'warning',
                    title: `${name} Warning`,
                    message: `${name} is below optimal: ${value}${unit} (optimal: ${optimalMin}-${optimalMax}${unit})`,
                    drawer,
                });
                present({
                    message: `${name} below optimal: ${value}${unit}`,
                    duration: 2500,
                    position: "top",
                    mode: "ios",
                    color: "warning",
                });
            } else if (isWarning && value > optimalMax && !shownAlertsRef.current.has(warningHighKey)) {
                shownAlertsRef.current.add(warningHighKey);
                addNotification({
                    type: 'warning',
                    title: `${name} Warning`,
                    message: `${name} is above optimal: ${value}${unit} (optimal: ${optimalMin}-${optimalMax}${unit})`,
                    drawer,
                });
                present({
                    message: `${name} above optimal: ${value}${unit}`,
                    duration: 2500,
                    position: "top",
                    mode: "ios",
                    color: "warning",
                });
            }

            if (isNormal) {
                shownAlertsRef.current.delete(dangerLowKey);
                shownAlertsRef.current.delete(dangerHighKey);
                shownAlertsRef.current.delete(warningLowKey);
                shownAlertsRef.current.delete(warningHighKey);
            } else if (!isDanger) {
                shownAlertsRef.current.delete(dangerLowKey);
                shownAlertsRef.current.delete(dangerHighKey);
            }
        });
    }, [sensorData, thresholds, stage, present, addNotification]);

    useEffect(() => {
        if (!deviceId) return;

        const loadStates = async () => {
            const allStates = await actuatorService.getAllStates();

            setActuatorStates(prev => {
                const updated = { ...prev };
                Object.entries(allStates).forEach(([actuatorId, state]) => {
                    const parts = actuatorId.split(':');
                    if (parts.length < 3 || parts[0] !== deviceId) return;

                    const drawerPart = parts[1];
                    const drawerName = `Drawer ${drawerPart.replace('drawer', '')}`;
                    const actionName = controlsData.find(c =>
                        getActuatorId(deviceId, drawerName, c.name) === actuatorId
                    )?.name;

                    if (actionName && updated[drawerName]) {
                        updated[drawerName][actionName] = Boolean(state);
                    }
                });
                return updated;
            });
        };
        loadStates();

        const stages = ['Drawer 1', 'Drawer 2', 'Drawer 3'];
        const listeners: Array<{ id: string; cb: (state: any) => void }> = [];

        stages.forEach(s => {
            controlsData.forEach(c => {
                if (c.available) {
                    const actuatorId = getActuatorId(deviceId, s, c.name);
                    const cb = (state: boolean) => {
                        setActuatorStates(prev => ({
                            ...prev,
                            [s]: { ...prev[s], [c.name]: state }
                        }));
                    };
                    actuatorService.on(actuatorId, cb);
                    listeners.push({ id: actuatorId, cb });
                }
            });
        });

        return () => {
            listeners.forEach(({ id, cb }) => actuatorService.off(id, cb));
        };
    }, [deviceId]);

    const getQuickActions = useCallback((sensorName: string) => {
        return controlsData.filter(c => c.sensor === sensorName && c.available);
    }, []);

    const handleQuickAction = useCallback(async (actionName: string) => {
        if (!deviceId) {
            present({
                message: "No device selected. Go to Settings to add a device.",
                duration: 2000,
                position: "top",
                mode: "ios",
                color: "warning",
            });
            return;
        }

        if (currentDevice?.status === "offline") {
            present({
                message: "Device is offline",
                duration: 2000,
                position: "top",
                mode: "ios",
                color: "danger",
            });
            return;
        }

        const newState = !actuatorStates[stage][actionName];
        const actuatorId = getActuatorId(deviceId, stage, actionName);

        setActuatorStates(prev => ({
            ...prev,
            [stage]: { ...prev[stage], [actionName]: newState }
        }));

        try {
            await actuatorService.emit(actuatorId, newState);
            present({
                message: `${actionName} ${newState ? 'enabled' : 'disabled'}`,
                duration: 1500,
                position: "top",
                mode: "ios",
            });
        } catch {
            setActuatorStates(prev => ({
                ...prev,
                [stage]: { ...prev[stage], [actionName]: !newState }
            }));
            present({
                message: `Failed to update ${actionName}`,
                duration: 1500,
                position: "top",
                mode: "ios",
                color: "danger",
            });
        }
    }, [present, stage, actuatorStates, deviceId, currentDevice]);

    return (
        <IonPage className="dashboard-page">
            <IonHeader>
                <Toolbar
                    header={"Dashboard"}
                />
            </IonHeader>

            <IonContent fullscreen>
                <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
                    <IonRefresherContent />
                </IonRefresher>
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
                                    <IonCardTitle>Current {stage}</IonCardTitle>
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
                                                    pathColor: qualityColor,
                                                    textColor: qualityColor,
                                                    trailColor: '#f6f8fc',
                                                    pathTransitionDuration: 0.9,
                                                })}
                                            />
                                            <IonText className="progress-text">Environment Quality</IonText>
                                            <IonChip className="progress-chip" color={qualityChipColor}>
                                                {qualityText}
                                            </IonChip>
                                        </div>
                                    </div>
                                </IonCardContent>
                            </IonCard>
                        </IonCol>
                    </IonRow>
                    <IonRow className="ion-justify-content-center ion-align-items-center">
                        {(deviceLoading || sensorLoading) ? (
                            <>
                                <IonCol size="12" sizeMd="6"><LoadingSkeleton variant="card" /></IonCol>
                                <IonCol size="12" sizeMd="6"><LoadingSkeleton variant="card" /></IonCol>
                                <IonCol size="12" sizeMd="6"><LoadingSkeleton variant="card" /></IonCol>
                                <IonCol size="12" sizeMd="6"><LoadingSkeleton variant="card" /></IonCol>
                            </>
                        ) : filteredSensors.map((sensor) => (
                            <IonCol size="12" sizeMd="6" key={sensor.name}>
                                <IonCard
                                    className={`sensor-card sensor-card-${status(sensor.name, sensor.value)}`}
                                    aria-label={`${sensor.name}: ${sensor.value} ${sensor.unit}`}
                                >
                                    <IonCardContent className="sensor-card-content">
                                        <div className="sensor-main">
                                            <div className="sensor-info">
                                                <IonIcon size="large" icon={sensor.icon} aria-hidden="true"></IonIcon>
                                                <p className="sensor-name">{sensor.name}</p>
                                            </div>
                                            <div className="sensor-data">
                                                <span className="sensor-value">{sensor.value}</span>
                                                <span className="sensor-unit">{sensor.unit}</span>
                                            </div>
                                        </div>
                                        {getQuickActions(sensor.name).length > 0 && (
                                            <div className="quick-actions">
                                                {getQuickActions(sensor.name).map((action) => (
                                                    <button
                                                        key={action.name}
                                                        className={`quick-action-btn ${actuatorStates[stage]?.[action.name] ? 'active' : ''}`}
                                                        onClick={() => handleQuickAction(action.name)}
                                                        aria-label={action.name}
                                                        title={action.description}
                                                    >
                                                        <IonIcon icon={quickActionIcons[action.name]} />
                                                        <span>{action.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
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
