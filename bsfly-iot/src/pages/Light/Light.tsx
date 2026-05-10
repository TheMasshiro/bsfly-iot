import { IonCard, IonCardContent, IonCol, IonContent, IonGrid, IonHeader, IonIcon, IonPage, IonRadio, IonRadioGroup, IonRefresher, IonRefresherContent, IonRow, IonText, IonTitle, IonToolbar, useIonToast, useIonViewWillEnter } from '@ionic/react';
import './Light.css';
import 'react-circular-progressbar/dist/styles.css';
import { timers } from '../../assets/assets';
import { useState, useCallback, useMemo, useEffect } from 'react';
import Toolbar from '../../components/Toolbar/Toolbar';
import PagePurpose from '../../components/PagePurpose/PagePurpose';
import Countdown from 'react-countdown';
import { heart, heartOutline } from 'ionicons/icons';
import { actuatorService } from '../../services/socket/socket';
import { useDevice } from '../../context/DeviceContext';

const renderer = ({ hours, minutes, seconds, completed }: any) => {
    if (completed) {
        return "0";
    } else {
        return hours > 0
            ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
            : `${minutes}:${String(seconds).padStart(2, '0')}`;
    }
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

const Light: React.FC = () => {
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
                message: "Light timer completed - Light Off",
                duration: 2000,
                position: 'top',
                mode: 'ios',
            });
        } catch {
            present({
                message: "Failed to finalize light timer",
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

    const handleRefresh = async (event: CustomEvent) => {
        await refreshDevices();
        await fetchInitialLightState();
        event.detail.complete();
    };

    const handleTimeChange = useCallback(async (newTime: number) => {
        if (!deviceId) {
            present({
                message: "No device selected. Go to Devices to add a device.",
                duration: 2000,
                position: 'top',
                mode: 'ios',
                color: 'warning',
            });
            return;
        }

        if (currentDevice?.status === "offline") {
            present({
                message: "Device is offline",
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
                message: "Failed to update light state",
                duration: 1800,
                position: 'top',
                mode: 'ios',
                color: 'danger',
            });
            await fetchInitialLightState();
        }
    }, [present, deviceId, currentDevice, lightActuatorId, fetchInitialLightState, isLightOn]);

    return (
        <IonPage className="timer-page">
            <IonHeader>
                <Toolbar />
            </IonHeader>
            <IonContent fullscreen>
                <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
                    <IonRefresherContent />
                </IonRefresher>
                <IonHeader collapse="condense">
                    <IonToolbar>
                        <IonTitle size="large">Light</IonTitle>
                    </IonToolbar>
                </IonHeader>

                <PagePurpose text="Set and monitor light cycles used to support adult BSF mating activity." />

                <IonGrid>
                    <IonRow className="ion-justify-content-center ion-align-items-center">
                        <IonCol>
                            <IonCard className="circular-background-md">
                                <IonCardContent>
                                    <div className="circular-progress-container circular-background-md">
                                        <div className="circular-progress-wrapper">
                                            <div className={`light-bulb-container ${isLightOn ? 'light-on' : 'light-off'}`}>
                                                <IonIcon
                                                    icon={isLightOn ? heart : heartOutline}
                                                    className="light-bulb-icon"
                                                />
                                            </div>
                                            <IonText className="timer-text">
                                                {time ? (
                                                    <Countdown
                                                        key={startTime}
                                                        date={countdownDate}
                                                        renderer={renderer}
                                                        onComplete={handleCountdownComplete}
                                                    />
                                                ) : "Off"}
                                            </IonText>
                                            <IonText className="light-status-text">
                                                {isLightOn ? 'Light On' : 'Light Off'}
                                            </IonText>
                                        </div>
                                    </div>
                                </IonCardContent>
                            </IonCard>
                        </IonCol>
                    </IonRow>
                    <IonRadioGroup value={isLightOn ? timers[1].seconds : timers[0].seconds}>
                        <IonRow className="ion-justify-content-center ion-align-items-center">
                            {timers.map((timer) => {
                                const isActiveChoice = (timer.seconds > 0) === isLightOn;

                                return (
                                <IonCol size="12" key={timer.id}>
                                    <IonCard
                                        className={`timer-card ${
                                            isActiveChoice ? 'timer-card-selected timer-card-active-option' : 'timer-card-primary'
                                        }`}
                                        button={!isActiveChoice}
                                        onClick={!isActiveChoice ? () => handleTimeChange(timer.seconds) : undefined}
                                        aria-disabled={isActiveChoice}
                                        title={isActiveChoice ? 'Already active' : `Set light to ${timer.name}`}
                                    >
                                        <IonCardContent className="timer-card-content">
                                            <IonRadio value={timer.seconds} justify='space-between'>
                                                <span className="timer-value">{timer.name}</span>
                                            </IonRadio>
                                        </IonCardContent>
                                    </IonCard>
                                </IonCol>
                                );
                            })}
                        </IonRow>
                    </IonRadioGroup>
                </IonGrid>
            </IonContent>
        </IonPage >
    );
};

export default Light;
