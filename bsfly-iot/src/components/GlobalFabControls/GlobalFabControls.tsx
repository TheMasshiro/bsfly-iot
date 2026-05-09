import { IonFab, IonFabButton, IonFabList, IonIcon, useIonToast } from '@ionic/react';
import { flame, snow, water } from 'ionicons/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { controlsData, drawerActuatorMap } from '../../assets/assets';
import { useDevice } from '../../context/DeviceContext';
import { useLifeCycle } from '../../context/LifeCycleContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { actuatorService } from '../../services/socket/socket';
import { api, withToken } from '../../utils/api';
import './GlobalFabControls.css';

const quickActionIcons: Record<string, string> = {
    Fan: snow,
    Heater: flame,
    Humidifier: water,
    'Misting Device': water,
    'Water Pump': water,
};

const getActuatorId = (deviceId: string | undefined, stage: string, actionName: string): string => {
    const normalizedStage = stage.trim().toLowerCase();
    const stageIsDrawer2 = normalizedStage === 'drawer 2';
    const actionMap: Record<string, string> = {
        Fan: stageIsDrawer2 ? 'fan3' : 'fan1',
        Heater: 'heater',
        Humidifier: stageIsDrawer2 ? 'humidifier3' : 'humidifier1',
        'Water Pump': 'substrate',
        'Misting Device': 'misting',
    };
    const actuator = actionMap[actionName] || actionName.toLowerCase();
    return deviceId ? `${deviceId}:${actuator}` : actuator;
};

const getActuatorIds = (deviceId: string | undefined, stage: string, actionName: string): string[] => {
    const stageKey = stage as keyof typeof drawerActuatorMap;
    const mapping = drawerActuatorMap[stageKey];
    if (!mapping) return [getActuatorId(deviceId, stage, actionName)];

    const actionKey = actionName as keyof typeof mapping;
    const actuators = mapping[actionKey];
    if (!actuators) return [getActuatorId(deviceId, stage, actionName)];

    return actuators.map((act: string) => (deviceId ? `${deviceId}:${act}` : act));
};

const GlobalFabControls: React.FC = () => {
    const { stage } = useLifeCycle();
    const { currentDevice, getToken, setCurrentDevice } = useDevice();
    const isOnline = useOnlineStatus();
    const [present] = useIonToast();
    const [modeUpdating, setModeUpdating] = useState(false);
    const [actuatorStates, setActuatorStates] = useState<Record<string, Record<string, boolean>>>({
        'Drawer 1': {},
        'Drawer 2': {},
    });
    const fabRef = useRef<HTMLIonFabElement | null>(null);

    const deviceId = currentDevice?._id;
    const selectedMode = currentDevice?.controlMode ?? 'auto';
    const effectiveMode = selectedMode;

    const drawerControls = useMemo(() => {
        const currentStage = stage.toLowerCase();
        return controlsData.filter((control) => {
            if (!control.available) return false;
            if (currentStage === 'drawer 2') {
                return control.name !== 'Water Pump';
            }
            return true;
        });
    }, [stage]);

    useEffect(() => {
        if (!fabRef.current) return;
        fabRef.current.activated = false;
    }, [stage]);

    useEffect(() => {
        if (!deviceId) {
            setActuatorStates({ 'Drawer 1': {}, 'Drawer 2': {} });
            return;
        }

        const loadStates = async () => {
            const allStates = await actuatorService.getAllStates();
            const updated: Record<string, Record<string, boolean>> = {
                'Drawer 1': {},
                'Drawer 2': {},
            };

            Object.entries(allStates).forEach(([actuatorId, state]) => {
                const parts = actuatorId.split(':');
                if (parts.length < 2 || parts[0] !== deviceId) return;

                const actuatorSuffix = parts.slice(1).join(':');

                (Object.keys(drawerActuatorMap) as Array<keyof typeof drawerActuatorMap>).forEach((drawerName) => {
                    const mapping = drawerActuatorMap[drawerName];
                    const actionName = Object.keys(mapping).find((name) => {
                        const mapped = mapping[name as keyof typeof mapping] as readonly string[];
                        return mapped.includes(actuatorSuffix);
                    });

                    if (actionName) {
                        updated[drawerName][actionName] = Boolean(state);
                    }
                });
            });

            setActuatorStates((prev) => ({ ...prev, ...updated }));
        };

        loadStates();

        const stages = ['Drawer 1', 'Drawer 2'];
        const listeners: Array<{ id: string; cb: (state: any) => void }> = [];
        const seenListenerIds = new Set<string>();

        stages.forEach((s) => {
            controlsData.forEach((c) => {
                if (!c.available) return;
                const actuatorIds = getActuatorIds(deviceId, s, c.name);
                const cb = (state: boolean) => {
                    setActuatorStates((prev) => ({
                        ...prev,
                        [s]: { ...prev[s], [c.name]: state },
                    }));
                };

                actuatorIds.forEach((actuatorId) => {
                    const listenerKey = `${actuatorId}:${c.name}:${s}`;
                    if (seenListenerIds.has(listenerKey)) return;
                    seenListenerIds.add(listenerKey);
                    actuatorService.on(actuatorId, cb);
                    listeners.push({ id: actuatorId, cb });
                });
            });
        });

        return () => {
            listeners.forEach(({ id, cb }) => actuatorService.off(id, cb));
        };
    }, [deviceId]);

    const handleModeChange = useCallback(async (mode: 'auto' | 'manual') => {
        if (!currentDevice?._id || modeUpdating) return;
        if (!isOnline && mode !== 'auto') return;

        try {
            setModeUpdating(true);
            const token = await getToken();
            const modeEndpoints = [
                `/api/devices/${currentDevice._id}/control-mode`,
                `/api/devices/${currentDevice._id}/controlMode`,
                `/api/device/${currentDevice._id}/control-mode`,
            ];

            let updated = false;
            for (const endpoint of modeEndpoints) {
                try {
                    await api.patch(endpoint, { mode }, withToken(token));
                    updated = true;
                    break;
                } catch (error: any) {
                    const status = error?.response?.status;
                    if (status !== 404) {
                        throw error;
                    }
                }
            }

            if (!updated) {
                throw new Error('CONTROL_MODE_ENDPOINT_NOT_FOUND');
            }

            if (currentDevice) {
                setCurrentDevice({ ...currentDevice, controlMode: mode });
            }

            if (fabRef.current) {
                fabRef.current.activated = false;
            }
            present({
                message: `Control mode set to ${mode.toUpperCase()}`,
                duration: 1600,
                position: 'top',
                mode: 'ios',
                color: 'success',
            });
        } catch (error: any) {
            const notFound = error?.message === 'CONTROL_MODE_ENDPOINT_NOT_FOUND' || error?.response?.status === 404;
            present({
                message: notFound
                    ? 'Control mode endpoint not found. Backend likely needs redeploy.'
                    : 'Failed to update control mode',
                duration: 2200,
                position: 'top',
                mode: 'ios',
                color: 'danger',
            });
        } finally {
            setModeUpdating(false);
        }
    }, [currentDevice, getToken, isOnline, modeUpdating, present, setCurrentDevice]);

    const handleQuickAction = useCallback(async (actionName: string) => {
        if (!deviceId) {
            present({
                message: 'No device selected. Open device menu to choose one.',
                duration: 2000,
                position: 'top',
                mode: 'ios',
                color: 'warning',
            });
            return;
        }

        if (currentDevice?.status !== 'online') {
            present({
                message: 'Device is offline',
                duration: 2000,
                position: 'top',
                mode: 'ios',
                color: 'danger',
            });
            return;
        }

        if (effectiveMode === 'auto') {
            present({
                message: 'Device is in AUTO mode. Switch to MANUAL from FAB first.',
                duration: 2200,
                position: 'top',
                mode: 'ios',
                color: 'warning',
            });
            return;
        }

        const newState = !Boolean(actuatorStates[stage]?.[actionName]);
        const actuatorIds = getActuatorIds(deviceId, stage, actionName);

        const updatedStates: Record<string, Record<string, boolean>> = {
            ...actuatorStates,
            [stage]: { ...(actuatorStates[stage] || {}), [actionName]: newState },
        };

        try {
            await Promise.all(actuatorIds.map((id) => actuatorService.emit(id, newState)));
            setActuatorStates(updatedStates);
            if (fabRef.current) {
                fabRef.current.activated = false;
            }
            present({
                message: `${actionName} ${newState ? 'enabled' : 'disabled'}`,
                duration: 1500,
                position: 'top',
                mode: 'ios',
            });
        } catch {
            present({
                message: `Failed to update ${actionName}`,
                duration: 1500,
                position: 'top',
                mode: 'ios',
                color: 'danger',
            });
        }
    }, [actuatorStates, currentDevice, deviceId, effectiveMode, present, stage]);

    return (
        <IonFab ref={fabRef} vertical="bottom" horizontal="end" edge={false} className="global-fab-controls">
            <IonFabButton color="success" aria-label="Open controls">
                <span className="fab-main-label">+</span>
            </IonFabButton>

            <IonFabList side="start" className="global-fab-mode-list">
                <IonFabButton
                    className={`fab-mode-auto ${(effectiveMode === 'auto') ? 'fab-mode-active' : ''}`}
                    disabled={modeUpdating || !currentDevice}
                    onClick={() => {
                        void handleModeChange('auto');
                    }}
                    aria-label="Set Auto mode"
                    title="Auto mode"
                >
                    <span className="fab-mode-label">Auto</span>
                </IonFabButton>
                <IonFabButton
                    className={`fab-mode-manual ${(effectiveMode === 'manual') ? 'fab-mode-active' : ''}`}
                    disabled={modeUpdating || !currentDevice}
                    onClick={() => {
                        void handleModeChange('manual');
                    }}
                    aria-label="Set Manual mode"
                    title="Manual mode"
                >
                    <span className="fab-mode-label">Manual</span>
                </IonFabButton>
            </IonFabList>

            <IonFabList side="top" className="global-fab-action-list">
                {drawerControls.map((control) => (
                    <IonFabButton
                        key={control.name}
                        disabled={!currentDevice || !isOnline}
                    className={actuatorStates[stage]?.[control.name] ? 'fab-control-active' : ''}
                        onClick={() => {
                            void handleQuickAction(control.name);
                        }}
                        aria-label={control.name}
                        title={control.description}
                    >
                        <IonIcon icon={quickActionIcons[control.name]} />
                        <span className="fab-control-label">{control.name}</span>
                    </IonFabButton>
                ))}
            </IonFabList>
        </IonFab>
    );
};

export default GlobalFabControls;
