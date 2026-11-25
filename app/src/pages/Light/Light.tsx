import { IonButton, IonIcon, useIonToast, useIonViewWillEnter } from '@ionic/react';
import { powerOutline, sunnyOutline } from 'ionicons/icons';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import Countdown from 'react-countdown';
import { timers } from '../../assets/assets';
import Page from '../../components/ui/Page';
import StatusPill from '../../components/ui/StatusPill';
import { useDevice } from '../../context/DeviceContext';
import { actuatorService } from '../../services/socket/socket';
import './Light.css';

const renderer = ({ days, hours, minutes, completed }: any) => {
    if (completed) return '0:00';
    const totalHours = days * 24 + hours;
    return `${totalHours}:${String(minutes).padStart(2, '0')}`;
};

const normalizeLightState = (state: unknown) => {
    if (typeof state === 'object' && state !== null && 'time' in state) {
        const typedState = state as { time?: number; startTime?: number };
        return {
            time: typedState.time || 0,
            startTime: typedState.startTime || Date.now(),
        };
    }

    if (typeof state === 'number') {
        return {
            time: Math.max(0, Math.min(10 * 3600, Math.round(state))),
            startTime: Date.now(),
        };
    }

    if (typeof state === 'boolean') {
        return {
            time: state ? 36000 : 0,
            startTime: Date.now(),
        };
    }

    return null;
};

const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return hours > 0 ? `${hours} h` : `${minutes} min`;
};

const formatClock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const Light: FC = () => {
    const [time, setTime] = useState<number>(timers[0].seconds);
    const [startTime, setStartTime] = useState<number>(Date.now());
    const [present] = useIonToast();
    const { currentDevice, refreshDevices } = useDevice();
    const deviceId = currentDevice?._id;

    const countdownDate = useMemo(() => startTime + (time * 1000), [startTime, time]);
    const isLightOn = time > 0;

    const lightActuatorId = deviceId ? `${deviceId}:light` : 'light';

    const handleCountdownComplete = useCallback(async () => {
        if (!deviceId) return;
        try {
            const offTime = Date.now();
            await actuatorService.emit(lightActuatorId, { time: 0, startTime: offTime });
            setTime(0);
            setStartTime(offTime);
            present({
                message: 'Light timer completed - Light Off',
                duration: 2000,
                position: 'top',
                mode: 'ios',
            });
        } catch {
            present({
                message: 'Failed to finalize light timer',
                duration: 2000,
                position: 'top',
                mode: 'ios',
                color: 'danger',
            });
            await fetchInitialLightState();
        }
    }, [deviceId, lightActuatorId, present]);

    const fetchInitialLightState = useCallback(async () => {
        if (!deviceId) return;
        try {
            const state = await actuatorService.getState(lightActuatorId);
            const normalizedState = normalizeLightState(state);
            if (normalizedState) {
                setTime(normalizedState.time);
                setStartTime(normalizedState.startTime);
            }
        } catch (error) {
            console.error('Failed to fetch initial light state:', error);
        }
    }, [deviceId, lightActuatorId]);

    useEffect(() => {
        if (!deviceId) return;

        fetchInitialLightState();

        const onLightResponse = (state: any) => {
            const normalizedState = normalizeLightState(state);
            if (normalizedState) {
                setTime(normalizedState.time);
                setStartTime(normalizedState.startTime);
            }
        };

        actuatorService.on(lightActuatorId, onLightResponse);

        return () => {
            actuatorService.off(lightActuatorId, onLightResponse);
        };
    }, [deviceId, lightActuatorId, fetchInitialLightState]);

    useIonViewWillEnter(() => {
        fetchInitialLightState();
    });

    const handleRefresh = async () => {
        await refreshDevices();
        await fetchInitialLightState();
    };

    const handleTimeChange = useCallback(async (newTime: number) => {
        if (!deviceId) {
            present({
                message: 'No device selected. Go to Devices to add a device.',
                duration: 2000,
                position: 'top',
                mode: 'ios',
                color: 'warning',
            });
            return;
        }

        if (currentDevice?.status === 'offline') {
            present({
                message: 'Device is offline',
                duration: 2000,
                position: 'top',
                mode: 'ios',
                color: 'danger',
            });
            return;
        }

        if ((newTime > 0) === isLightOn) {
            return;
        }

        const newStartTime = Date.now();
        try {
            await actuatorService.emit(lightActuatorId, { time: newTime, startTime: newStartTime });
            setTime(newTime);
            setStartTime(newStartTime);

            const timerName = timers.find(t => t.seconds === newTime)?.name || 'Off';
            present({
                message: `Light set to ${timerName}`,
                duration: 1500,
                position: 'top',
                mode: 'ios',
            });
        } catch {
            present({
                message: 'Failed to update light state',
                duration: 1800,
                position: 'top',
                mode: 'ios',
                color: 'danger',
            });
            await fetchInitialLightState();
        }
    }, [present, deviceId, currentDevice, lightActuatorId, fetchInitialLightState, isLightOn]);

    const offline = currentDevice?.status === 'offline';

    return (
        <Page
            title="Light"
            subtitle="Light cycle for adult BSF mating"
            onRefresh={handleRefresh}
        >
            <div className="light-layout">
                <div className="light-main">
                    <section className="light-state" data-on={isLightOn}>
                        <div className="light-state-top">
                            <StatusPill status={isLightOn ? 'ok' : 'idle'}>{isLightOn ? 'On' : 'Off'}</StatusPill>
                            <IonIcon icon={sunnyOutline} aria-hidden="true" />
                        </div>
                        <div className="light-time mono" aria-live="polite">
                            {time ? (
                                <Countdown
                                    key={startTime}
                                    date={countdownDate}
                                    renderer={renderer}
                                    onComplete={handleCountdownComplete}
                                />
                            ) : '0:00'}
                        </div>
                        <p className="light-time-label">{isLightOn ? 'Time left, hours and minutes' : 'The light is off'}</p>
                        <IonButton expand="block" size="large" onClick={() => void handleTimeChange(isLightOn ? 0 : timers[1].seconds)}>
                            {isLightOn ? 'Turn off' : `Start for ${formatDuration(timers[1].seconds)}`}
                        </IonButton>
                        {offline && <p className="light-note">The device is offline. Changes will not reach the light until it is back.</p>}
                        {!deviceId && <p className="light-note">No device selected. Go to Devices to add one.</p>}
                    </section>

                    <div className="light-presets" role="group" aria-label="Light timer">
                        {timers.map((timer) => {
                            const isActive = (timer.seconds > 0) === isLightOn;
                            return (
                                <button
                                    key={timer.id}
                                    type="button"
                                    className="light-preset"
                                    aria-pressed={isActive}
                                    aria-disabled={isActive}
                                    onClick={() => {
                                        if (!isActive) void handleTimeChange(timer.seconds);
                                    }}
                                >
                                    <IonIcon icon={timer.seconds > 0 ? sunnyOutline : powerOutline} aria-hidden="true" />
                                    <strong>{timer.seconds > 0 ? `On for ${formatDuration(timer.seconds)}` : 'Off'}</strong>
                                    <span>{timer.seconds > 0 ? 'Turns off by itself when the time is up' : 'Turns the light off now'}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <aside className="light-side">
                    <section className="bs-card light-card">
                        <h2>Schedule</h2>
                        <dl className="bs-kv">
                            <dt>State</dt>
                            <dd>{isLightOn ? 'On' : 'Off'}</dd>
                            <dt>Started</dt>
                            <dd>{isLightOn ? formatClock(startTime) : '-'}</dd>
                            <dt>Ends</dt>
                            <dd>{isLightOn ? formatClock(countdownDate) : '-'}</dd>
                            <dt>Device</dt>
                            <dd>{currentDevice?.name ?? '-'}</dd>
                        </dl>
                    </section>
                    <section className="bs-card light-card">
                        <h2>About this light</h2>
                        <p>Adult flies use the light to mate. When the time is up, the light turns off on its own.</p>
                    </section>
                </aside>
            </div>
        </Page>
    );
};

export default Light;
