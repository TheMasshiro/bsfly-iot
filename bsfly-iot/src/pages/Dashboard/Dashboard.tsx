import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonChip, IonCol, IonContent, IonGrid, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonRow, IonText, IonTitle, IonToolbar, useIonToast } from '@ionic/react';
import './Dashboard.css';
import { buildStyles, CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { useLifeCycle } from '../../context/LifeCycleContext';
import { useDevice } from '../../context/DeviceContext';
import { useNotification } from '../../context/NotificationContext';
import { sensorsData, drawer1SubstrateSensors, controlsData, drawerActuatorMap } from '../../assets/assets';
import { getStatus, lifecycleThresholds, Threshold } from '../../config/thresholds';
import { calculateQuality } from '../../utils/calculateQuality';
import Segments from '../../components/Segments/Segments';
import Toolbar from '../../components/Toolbar/Toolbar';
import GlobalFabControls from '../../components/GlobalFabControls/GlobalFabControls';
import LoadingSkeleton from '../../components/LoadingSkeleton/LoadingSkeleton';
import PagePurpose from '../../components/PagePurpose/PagePurpose';
import { useState, useMemo, useCallback, useEffect, useRef, FC } from 'react';
import { actuatorService } from '../../services/socket/socket';
import { api, withToken } from '../../utils/api';

type SensorSnapshot = {
    temperature: number | null;
    humidity: number | null;
    moisture: number | null;
    leftSubstrate: number | null;
    centerSubstrate: number | null;
    rightSubstrate: number | null;
    ammonia: number | null;
};

const EMPTY_SENSOR_SNAPSHOT: SensorSnapshot = {
    temperature: null,
    humidity: null,
    moisture: null,
    leftSubstrate: null,
    centerSubstrate: null,
    rightSubstrate: null,
    ammonia: null,
};

const sensorTypeMap: Record<string, string> = {
    "temperature": "temperature",
    "humidity": "humidity",
    "left substrate": "moisture",
    "center substrate": "moisture",
    "right substrate": "moisture",
    "ammonia": "ammonia",
};

const normalizeDrawerName = (name: unknown): string | null => {
    if (typeof name !== 'string') return null;
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('Drawer 2')) return 'Drawer 2';
    if (trimmed.startsWith('Drawer 1')) return 'Drawer 1';
    return trimmed;
};

const getActuatorId = (deviceId: string | undefined, stage: string, actionName: string): string => {
    const drawerNum = stage.toLowerCase().replace('drawer ', '');
    const actionMap: Record<string, string> = {
        "Fan": "fan",
        "Heater": "heater",
        "Humidifier": "humidifier",
        "Water Pump": "substrate",
        "Misting Device": "misting",
    };
    const actuator = actionMap[actionName] || actionName.toLowerCase();
    return deviceId ? `${deviceId}:drawer${drawerNum}:${actuator}` : `drawer${drawerNum}:${actuator}`;
};

const getActuatorIds = (deviceId: string | undefined, stage: string, actionName: string): string[] => {
    const stageKey = stage as keyof typeof drawerActuatorMap;
    const mapping = drawerActuatorMap[stageKey];
    if (!mapping) return [getActuatorId(deviceId, stage, actionName)];
    
    const actionKey = actionName as keyof typeof mapping;
    const actuators = mapping[actionKey];
    if (!actuators) return [getActuatorId(deviceId, stage, actionName)];
    
    return actuators.map((act: string) => 
        deviceId ? `${deviceId}:${act}` : act
    );
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
    const [sensorDataByDrawer, setSensorDataByDrawer] = useState<Record<'Drawer 1' | 'Drawer 2', SensorSnapshot>>({
        'Drawer 1': { ...EMPTY_SENSOR_SNAPSHOT },
        'Drawer 2': { ...EMPTY_SENSOR_SNAPSHOT },
    });
    const sensorData = sensorDataByDrawer[stage];
    const thresholds = lifecycleThresholds[stage];

    const status = useCallback((name: string, value: number | string) => {
        if (value === "--" || typeof value === "string") return "medium";
        return statusColor(sensorTypeMap[name.toLowerCase()], value, thresholds)
    }, [thresholds]);

    const filteredSensors = useMemo(() => {
        if (stage.toLowerCase() === 'drawer 1') {
            const tempHumidity = sensorsData.filter(s => 
                s.name === 'Temperature' || s.name === 'Humidity'
            ).map(sensor => {
                if (sensor.name === "Temperature" && sensorData.temperature !== null) {
                    return { ...sensor, value: sensorData.temperature };
                }
                if (sensor.name === "Humidity" && sensorData.humidity !== null) {
                    return { ...sensor, value: sensorData.humidity };
                }
                return sensor;
            });
            
            const substrateSensors = drawer1SubstrateSensors.map(sensor => {
                if (sensor.type === "leftSubstrate" && sensorData.leftSubstrate !== null) {
                    return { ...sensor, value: sensorData.leftSubstrate };
                }
                if (sensor.type === "centerSubstrate" && sensorData.centerSubstrate !== null) {
                    return { ...sensor, value: sensorData.centerSubstrate };
                }
                if (sensor.type === "rightSubstrate" && sensorData.rightSubstrate !== null) {
                    return { ...sensor, value: sensorData.rightSubstrate };
                }
                return sensor;
            });
            
            const ammoniaSensor = sensorsData.filter(s => s.name === 'Ammonia').map(sensor => {
                if (sensor.name === "Ammonia" && sensorData.ammonia !== null) {
                    return { ...sensor, value: sensorData.ammonia };
                }
                return sensor;
            });
            
            return [...tempHumidity, ...substrateSensors, ...ammoniaSensor];
        } else {
            return sensorsData.filter(s => 
                s.name === 'Temperature' || s.name === 'Humidity'
            ).map(sensor => {
                if (sensor.name === "Temperature" && sensorData.temperature !== null) {
                    return { ...sensor, value: sensorData.temperature };
                }
                if (sensor.name === "Humidity" && sensorData.humidity !== null) {
                    return { ...sensor, value: sensorData.humidity };
                }
                return sensor;
            });
        }
    }, [stage, sensorData]);

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

    const getSensorActuatorIndicators = useCallback((sensorName: string): string[] => {
        const lower = sensorName.toLowerCase();

        if (lower.includes('temperature')) {
            return ['Fan', 'Heater'];
        }

        if (lower.includes('humidity')) {
            return ['Humidifier'];
        }

        if (lower.includes('center') && lower.includes('substrate') && stage === 'Drawer 1') {
            return ['Water Pump'];
        }

        return [];
    }, [stage]);

    const [present] = useIonToast();

    const [actuatorStates, setActuatorStates] = useState<Record<string, Record<string, boolean>>>(() => {
        const stages = ['Drawer 1', 'Drawer 2'];
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
    const hasLoadedOnceRef = useRef(false);

    useEffect(() => {
        hasLoadedOnceRef.current = false;
        setSensorLoading(true);
        setSensorDataByDrawer({
            'Drawer 1': { ...EMPTY_SENSOR_SNAPSHOT },
            'Drawer 2': { ...EMPTY_SENSOR_SNAPSHOT },
        });
    }, [deviceId]);

    const normalizeSensorData = useCallback((data: any) => {
        const toNumberOrNull = (value: any) => (typeof value === "number" ? value : null);

        const leftSubstrate = toNumberOrNull(data?.leftSubstrate ?? data?.leftSoil);
        const centerSubstrate = toNumberOrNull(data?.centerSubstrate ?? data?.centerSoil);
        const rightSubstrate = toNumberOrNull(data?.rightSubstrate ?? data?.rightSoil);

        const moistureFromApi = toNumberOrNull(data?.moisture);
        const moistureValues = [leftSubstrate, centerSubstrate, rightSubstrate].filter((v): v is number => v !== null);
        const computedMoisture = moistureValues.length > 0
            ? moistureValues.reduce((sum, v) => sum + v, 0) / moistureValues.length
            : null;

        return {
            temperature: toNumberOrNull(data?.temperature),
            humidity: toNumberOrNull(data?.humidity),
            moisture: moistureFromApi ?? computedMoisture,
            leftSubstrate: leftSubstrate ?? moistureFromApi,
            centerSubstrate: centerSubstrate ?? moistureFromApi,
            rightSubstrate: rightSubstrate ?? moistureFromApi,
            ammonia: toNumberOrNull(data?.ammonia),
        };
    }, []);

    const fetchSensorData = useCallback(async (targetStage: 'Drawer 1' | 'Drawer 2' = stage) => {
        if (!deviceId) {
            if (targetStage === stage) {
                setSensorLoading(false);
            }
            return;
        }
        try {
            const token = await getToken();
            const { data } = await api.get(`/api/sensors/device/${deviceId}?drawer=${encodeURIComponent(targetStage)}`, withToken(token));
            const normalized = normalizeSensorData(data);
            setSensorDataByDrawer((prev) => ({
                ...prev,
                [targetStage]: normalized,
            }));
        } catch {
            present({
                message: "Failed to load sensor data",
                duration: 2000,
                position: "top",
                mode: "ios",
                color: "danger",
            });
        } finally {
            if (targetStage === stage) {
                hasLoadedOnceRef.current = true;
                setSensorLoading(false);
            }
        }
    }, [deviceId, stage, present, getToken, normalizeSensorData]);

    useEffect(() => {
        if (!deviceId) return;

        if (!hasLoadedOnceRef.current) {
            setSensorLoading(true);
        }
        void fetchSensorData(stage);

        const handleSensorUpdate = (data: any) => {
            const incomingDrawer = normalizeDrawerName(data?.drawerName);
            const targetStage = (incomingDrawer === 'Drawer 1' || incomingDrawer === 'Drawer 2') ? incomingDrawer : stage;
            const normalized = normalizeSensorData(data);

            setSensorDataByDrawer((prev) => ({
                ...prev,
                [targetStage]: normalized,
            }));

            if (targetStage === stage) {
                hasLoadedOnceRef.current = true;
                setSensorLoading(false);
            }
        };

        actuatorService.onSensor(deviceId, handleSensorUpdate);

        return () => {
            actuatorService.offSensor(deviceId, handleSensorUpdate);
        };
    }, [deviceId, stage, fetchSensorData, normalizeSensorData]);

    const handleRefresh = async (event: CustomEvent) => {
        await Promise.all([fetchSensorData(), refreshDevices()]);
        event.detail.complete();
    };

    useEffect(() => {
        if (currentDevice?.status === "offline") return;

        const drawerNum = stage.toLowerCase().replace('drawer ', '');
        const drawer = `drawer${drawerNum}` as 'drawer1' | 'drawer2';

        const sensorChecks = [
            { key: 'temperature', name: 'Temperature', value: sensorData.temperature, unit: '°C' },
            { key: 'humidity', name: 'Humidity', value: sensorData.humidity, unit: '%' },
        ];
        
        if (stage.toLowerCase() === 'drawer 1') {
            sensorChecks.push(
                { key: 'moisture', name: 'Left Substrate', value: sensorData.leftSubstrate, unit: '%' },
                { key: 'moisture', name: 'Center Substrate', value: sensorData.centerSubstrate, unit: '%' },
                { key: 'moisture', name: 'Right Substrate', value: sensorData.rightSubstrate, unit: '%' },
                { key: 'ammonia', name: 'Ammonia', value: sensorData.ammonia, unit: 'ppm' }
            );
        }

        sensorChecks.forEach(({ key, name, value, unit }) => {
            if (value === null || value === undefined || typeof value !== "number") return;

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
    }, [sensorData, thresholds, stage, present, addNotification, currentDevice?.status]);

    useEffect(() => {
        if (!deviceId) return;

        const loadStates = async () => {
            const allStates = await actuatorService.getAllStates();

            setActuatorStates(prev => {
                const updated = { ...prev };
                Object.entries(allStates).forEach(([actuatorId, state]) => {
                    const parts = actuatorId.split(':');
                    if (parts.length < 2 || parts[0] !== deviceId) return;

                    const actuatorSuffix = parts.slice(1).join(':');
                    const mapping = drawerActuatorMap["Drawer 1" as keyof typeof drawerActuatorMap];
                    if (!mapping) return;

                    const actionName = Object.keys(mapping).find((name) => {
                        const mapped = mapping[name as keyof typeof mapping] as readonly string[];
                        return mapped.includes(actuatorSuffix);
                    });

                    if (actionName) {
                        // Try to infer drawer from actuator suffix (e.g., fan1/humidifier1 = Drawer 1, fan3/humidifier3 = Drawer 2)
                        const drawerNum = actuatorSuffix.match(/\d+/)?.[0] || '1';
                        const drawerName = `Drawer ${drawerNum === '1' || drawerNum === '' ? '1' : drawerNum.startsWith('3') ? '2' : '1'}`;
                        if (updated[drawerName as keyof typeof updated]) {
                            updated[drawerName as keyof typeof updated][actionName] = Boolean(state);
                        }
                    }
                });
                return updated;
            });
        };
        loadStates();

        const stages = ['Drawer 1', 'Drawer 2'];
        const listeners: Array<{ id: string; cb: (state: any) => void }> = [];
        const seenListenerIds = new Set<string>();

        stages.forEach(s => {
            controlsData.forEach(c => {
                if (c.available) {
                    const actuatorIds = getActuatorIds(deviceId, s, c.name);
                    const cb = (state: boolean) => {
                        setActuatorStates(prev => ({
                            ...prev,
                            [s]: { ...prev[s], [c.name]: state }
                        }));
                    };

                    actuatorIds.forEach((actuatorId) => {
                        if (seenListenerIds.has(`${actuatorId}:${c.name}:${s}`)) return;
                        seenListenerIds.add(`${actuatorId}:${c.name}:${s}`);
                        actuatorService.on(actuatorId, cb);
                        listeners.push({ id: actuatorId, cb });
                    });
                }
            });
        });

        return () => {
            listeners.forEach(({ id, cb }) => actuatorService.off(id, cb));
        };
    }, [deviceId]);

    return (
        <IonPage className="dashboard-page">
            <IonHeader>
                <Toolbar />
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

                <PagePurpose text="Monitor live sensor readings per drawer and quickly trigger environmental controls." />

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
                        ) : filteredSensors.map((sensor) => {
                            const indicatorControls = getSensorActuatorIndicators(sensor.name);

                            return (
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
                                                    <span className="sensor-value">{typeof sensor.value === 'number' ? Math.round(sensor.value) : sensor.value}</span>
                                                    <span className="sensor-unit">{sensor.unit}</span>
                                                </div>
                                            </div>

                                            {indicatorControls.length > 0 && (
                                                <div className="sensor-actuator-indicators">
                                                    {indicatorControls.map((controlName) => {
                                                        const isOn = Boolean(actuatorStates[stage]?.[controlName]);

                                                        return (
                                                            <span
                                                                key={`${sensor.name}-${controlName}`}
                                                                className={`sensor-indicator-chip ${isOn ? 'on' : 'off'}`}
                                                            >
                                                                {controlName}: {isOn ? 'ON' : 'OFF'}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </IonCardContent>

                                    </IonCard>
                                </IonCol>
                            );
                        })}
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

export default Dashboard;
