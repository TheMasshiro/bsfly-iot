import {
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonChip,
    IonCol,
    IonContent,
    IonGrid,
    IonHeader,
    IonIcon,
    IonLabel,
    IonPage,
    IonRefresher,
    IonRefresherContent,
    IonRow,
    IonSegment,
    IonSegmentButton,
    IonText,
    useIonToast,
} from "@ionic/react";
import { bugOutline, eggOutline, leafOutline, playOutline, stopOutline } from "ionicons/icons";
import { FC, useState, useEffect, useMemo, useCallback, useRef } from "react";
import Toolbar from "../../components/Toolbar/Toolbar";
import Countdown from "react-countdown";
import { actuatorService } from "../../services/socket/socket";
import { useDevice } from "../../context/DeviceContext";
import "./LifeStages.css";

interface LifeStage {
    name: string;
    icon: string;
    days: number;
    description: string;
    color: string;
}

const lifeStages: Record<string, LifeStage> = {
    eggs: {
        name: "Eggs",
        icon: eggOutline,
        days: 4,
        description: "Eggs hatch within 4 days, releasing larvae ready to feed",
        color: "warning",
    },
    larvae: {
        name: "Larvae",
        icon: bugOutline,
        days: 18,
        description: "Active feeding phase - larvae consume organic waste and convert to biomass",
        color: "success",
    },
    prepupa: {
        name: "Prepupa & Pupa",
        icon: leafOutline,
        days: 14,
        description: "Larvae cease feeding and undergo metamorphosis in dry, sheltered areas",
        color: "tertiary",
    },
};

interface DrawerInfo {
    drawer: string;
    description: string;
    availableStages: string[];
}

const drawerData: DrawerInfo[] = [
    {
        drawer: "Drawer 1",
        description: "Egg incubation and early larvae feeding phase",
        availableStages: ["eggs", "larvae"],
    },
    {
        drawer: "Drawer 2",
        description: "Continued larvae growth and development",
        availableStages: ["eggs", "larvae"],
    },
    {
        drawer: "Drawer 3",
        description: "Prepupal and pupal metamorphosis phase",
        availableStages: ["prepupa"],
    },
];

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const countdownRenderer = ({ days, hours, minutes, seconds, completed }: any) => {
    if (completed) {
        return <span className="countdown-complete">Complete!</span>;
    }
    return (
        <span className="countdown-time">
            {days > 0 && `${days}d `}{String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
    );
};

const LifeStages: FC = () => {
    const [present] = useIonToast();
    const [activeTimers, setActiveTimers] = useState<Record<string, { startTime: number; duration: number; stage: string } | null>>({});
    const [quadrantStages, setQuadrantStages] = useState<Record<string, string>>({});
    const { currentDevice, refreshDevices } = useDevice();
    const deviceId = currentDevice?._id;
    const lastUserActionRef = useRef<number>(0);

    const lifecycleActuatorId = deviceId ? `${deviceId}:lifecycle` : 'lifecycle';

    const fetchLifecycleState = useCallback(async () => {
        if (!deviceId) return;
        const state = await actuatorService.getState(lifecycleActuatorId);
        if (state) {
            if (state.timers) setActiveTimers(state.timers);
            if (state.stages) setQuadrantStages(state.stages);
        }
    }, [deviceId, lifecycleActuatorId]);

    useEffect(() => {
        if (!deviceId) return;

        fetchLifecycleState();

        const onLifecycleResponse = (state: { timers: typeof activeTimers; stages: typeof quadrantStages }) => {
            if (Date.now() - lastUserActionRef.current < 3000) return;
            if (state.timers) setActiveTimers(state.timers);
            if (state.stages) setQuadrantStages(state.stages);
        };

        actuatorService.on(lifecycleActuatorId, onLifecycleResponse);

        return () => {
            actuatorService.off(lifecycleActuatorId, onLifecycleResponse);
        };
    }, [deviceId, lifecycleActuatorId]);

    const handleRefresh = async (event: CustomEvent) => {
        await Promise.all([fetchLifecycleState(), refreshDevices()]);
        event.detail.complete();
    };

    useEffect(() => {
        if (Object.keys(quadrantStages).length === 0) {
            const defaults: Record<string, string> = {};
            drawerData.forEach((drawer, di) => {
                defaults[`${di}`] = drawer.availableStages[0];
            });
            setQuadrantStages(defaults);
        }
    }, []);

    const syncToBackend = useCallback((timers: typeof activeTimers, stages: typeof quadrantStages) => {
        if (!deviceId) return;
        actuatorService.emit(lifecycleActuatorId, { timers, stages });
    }, [deviceId, lifecycleActuatorId]);

    const getTimerKey = (drawerIndex: number) => `${drawerIndex}`;

    const handleStageChange = (drawerIndex: number, stageKey: string) => {
        lastUserActionRef.current = Date.now();
        const key = getTimerKey(drawerIndex);
        const newStages = { ...quadrantStages, [key]: stageKey };
        setQuadrantStages(newStages);
        syncToBackend(activeTimers, newStages);
    };

    const handleStart = (drawerIndex: number) => {
        lastUserActionRef.current = Date.now();
        if (!deviceId) {
            present({
                message: "No device selected. Go to Devices to add a device.",
                duration: 2000,
                position: "top",
                mode: "ios",
                color: "warning",
            });
            return;
        }

        const key = getTimerKey(drawerIndex);
        const stageKey = quadrantStages[key];
        const stage = lifeStages[stageKey] || lifeStages[drawerData[drawerIndex].availableStages[0]];
        if (!stage) return;
        const duration = stage.days * MILLISECONDS_PER_DAY;
        const drawer = drawerData[drawerIndex];

        const newTimers = {
            ...activeTimers,
            [key]: { startTime: Date.now(), duration, stage: stageKey }
        };
        setActiveTimers(newTimers);
        syncToBackend(newTimers, quadrantStages);

        present({
            message: `${drawer.drawer} - ${stage.name} timer started (${stage.days} days)`,
            duration: 2000,
            position: "top",
            mode: "ios",
            color: "success",
        });
    };

    const handleStop = (drawerIndex: number) => {
        lastUserActionRef.current = Date.now();
        const key = getTimerKey(drawerIndex);
        const timer = activeTimers[key];
        const stageName = timer ? lifeStages[timer.stage]?.name : "Timer";
        const drawer = drawerData[drawerIndex];

        const newTimers = {
            ...activeTimers,
            [key]: null
        };
        setActiveTimers(newTimers);
        syncToBackend(newTimers, quadrantStages);

        present({
            message: `${drawer.drawer} - ${stageName} timer stopped`,
            duration: 2000,
            position: "top",
            mode: "ios",
        });
    };

    const getEndTime = (drawerIndex: number) => {
        const key = getTimerKey(drawerIndex);
        const timer = activeTimers[key];
        if (!timer) return null;
        return timer.startTime + timer.duration;
    };

    const isTimerActive = (drawerIndex: number) => {
        const key = getTimerKey(drawerIndex);
        const timer = activeTimers[key];
        if (!timer) return false;
        return Date.now() < timer.startTime + timer.duration;
    };

    const getActiveStage = (drawerIndex: number) => {
        const key = getTimerKey(drawerIndex);
        const timer = activeTimers[key];
        if (timer && lifeStages[timer.stage]) return lifeStages[timer.stage];
        const stageKey = quadrantStages[key] || drawerData[drawerIndex]?.availableStages[0] || "eggs";
        return lifeStages[stageKey] || lifeStages["eggs"];
    };

    const totalDays = useMemo(() => {
        return Object.values(lifeStages).reduce((sum, stage) => sum + stage.days, 0);
    }, []);

    return (
        <IonPage className="lifestages-page">
            <IonHeader className="ion-no-border">
                <Toolbar header="Life Stages" />
            </IonHeader>

            <IonContent fullscreen>
                <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
                    <IonRefresherContent />
                </IonRefresher>
                <IonGrid>
                    <IonRow>
                        <IonCol>
                            <IonCard className="hero-card">
                                <IonCardHeader className="ion-text-center ion-padding">
                                    <div className="hero-icon-container">
                                        <IonIcon icon={bugOutline} className="hero-icon" />
                                    </div>
                                    <IonCardTitle>
                                        <h1>BSF Life Cycle</h1>
                                    </IonCardTitle>
                                    <IonCardSubtitle>Complete Growth Timeline</IonCardSubtitle>
                                </IonCardHeader>
                                <IonCardContent className="ion-text-center">
                                    <IonText color="medium">
                                        <p className="hero-description">
                                            Track lifecycle stages from eggs through larvae to prepupa.
                                            Total cycle: approximately <strong>{totalDays} days</strong>.
                                        </p>
                                    </IonText>
                                    <div className="lifecycle-summary">
                                        <IonChip color="warning" outline>
                                            <IonIcon icon={eggOutline} />
                                            <IonLabel>Eggs: 4 days</IonLabel>
                                        </IonChip>
                                        <IonChip color="success" outline>
                                            <IonIcon icon={bugOutline} />
                                            <IonLabel>Larvae: 13-18 days</IonLabel>
                                        </IonChip>
                                        <IonChip color="tertiary" outline>
                                            <IonIcon icon={leafOutline} />
                                            <IonLabel>Prepupa/Pupa: 14 days</IonLabel>
                                        </IonChip>
                                    </div>
                                </IonCardContent>
                            </IonCard>
                        </IonCol>
                    </IonRow>

                    {drawerData.map((drawer, drawerIndex) => {
                        const key = getTimerKey(drawerIndex);
                        const timerActive = isTimerActive(drawerIndex);
                        const endTime = getEndTime(drawerIndex);
                        const activeStage = getActiveStage(drawerIndex);
                        const selectedStageKey = quadrantStages[key] || drawer.availableStages[0];
                        
                        return (
                            <IonRow key={drawerIndex}>
                                <IonCol>
                                    <IonCard className="drawer-card">
                                        <IonCardHeader>
                                            <IonCardTitle>{drawer.drawer}</IonCardTitle>
                                            <IonCardSubtitle>{drawer.description}</IonCardSubtitle>
                                        </IonCardHeader>
                                        <IonCardContent>
                                            <div className={`drawer-single stage-${activeStage.color}`}>
                                                {drawer.availableStages.length > 1 && !timerActive && (
                                                    <IonSegment
                                                        value={selectedStageKey}
                                                        onIonChange={(e) => handleStageChange(drawerIndex, e.detail.value as string)}
                                                        className="stage-segment"
                                                    >
                                                        {drawer.availableStages.map((stageKey) => (
                                                            <IonSegmentButton key={stageKey} value={stageKey}>
                                                                <IonIcon icon={lifeStages[stageKey].icon} />
                                                                <IonLabel>{lifeStages[stageKey].name}</IonLabel>
                                                            </IonSegmentButton>
                                                        ))}
                                                    </IonSegment>
                                                )}

                                                <div className="drawer-stage-info">
                                                    <IonIcon icon={activeStage.icon} className="stage-icon" color={activeStage.color} />
                                                    <span className="stage-name">{activeStage.name}</span>
                                                    <span className="stage-days">{activeStage.days} days</span>
                                                </div>

                                                <div className="drawer-actions">
                                                    {timerActive && endTime ? (
                                                        <>
                                                            <div className="timer-display">
                                                                <IonText color="primary">
                                                                    <Countdown
                                                                        key={endTime}
                                                                        date={endTime}
                                                                        renderer={countdownRenderer}
                                                                    />
                                                                </IonText>
                                                            </div>
                                                            <IonButton
                                                                color="danger"
                                                                size="small"
                                                                expand="block"
                                                                onClick={() => handleStop(drawerIndex)}
                                                            >
                                                                <IonIcon slot="start" icon={stopOutline} />
                                                                Stop
                                                            </IonButton>
                                                        </>
                                                    ) : (
                                                        <IonButton
                                                            color={activeStage.color}
                                                            size="small"
                                                            expand="block"
                                                            onClick={() => handleStart(drawerIndex)}
                                                        >
                                                            <IonIcon slot="start" icon={playOutline} />
                                                            Start Timer
                                                        </IonButton>
                                                    )}
                                                </div>
                                            </div>
                                        </IonCardContent>
                                    </IonCard>
                                </IonCol>
                            </IonRow>
                        );
                    })}

                    <IonRow>
                        <IonCol>
                            <div className="ion-text-center ion-padding footer-text">
                                <IonText color="medium">
                                    <p>
                                        Timeline based on optimal growing conditions (Barragán-Fonseca et al., 2017)
                                    </p>
                                </IonText>
                            </div>
                        </IonCol>
                    </IonRow>
                </IonGrid>
            </IonContent>
        </IonPage>
    );
};

export default LifeStages;
