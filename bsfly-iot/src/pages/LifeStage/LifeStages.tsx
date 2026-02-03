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
import { bugOutline, eggOutline, gridOutline, leafOutline, playOutline, stopOutline, timeOutline } from "ionicons/icons";
import { FC, useState, useEffect, useMemo, useCallback } from "react";
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
    quadrants: number;
    availableStages: string[];
}

const drawerData: DrawerInfo[] = [
    {
        drawer: "Drawer 1",
        description: "Egg incubation and early larvae feeding phase",
        quadrants: 2,
        availableStages: ["eggs", "larvae"],
    },
    {
        drawer: "Drawer 2",
        description: "Continued larvae growth and development",
        quadrants: 2,
        availableStages: ["eggs", "larvae"],
    },
    {
        drawer: "Drawer 3",
        description: "Prepupal and pupal metamorphosis phase",
        quadrants: 0,
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
                for (let q = 0; q < drawer.quadrants; q++) {
                    defaults[`${di}-${q}`] = drawer.availableStages[0];
                }
            });
            setQuadrantStages(defaults);
        }
    }, []);

    const syncToBackend = useCallback((timers: typeof activeTimers, stages: typeof quadrantStages) => {
        if (!deviceId) return;
        actuatorService.emit(lifecycleActuatorId, { timers, stages });
    }, [deviceId, lifecycleActuatorId]);

    const getTimerKey = (drawerIndex: number, quadrantIndex: number) => `${drawerIndex}-${quadrantIndex}`;

    const handleStageChange = (drawerIndex: number, quadrantIndex: number, stageKey: string) => {
        const key = getTimerKey(drawerIndex, quadrantIndex);
        const newStages = { ...quadrantStages, [key]: stageKey };
        setQuadrantStages(newStages);
        syncToBackend(activeTimers, newStages);
    };

    const handleStart = (drawerIndex: number, quadrantIndex: number) => {
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

        const key = getTimerKey(drawerIndex, quadrantIndex);
        const stageKey = quadrantStages[key];
        const stage = lifeStages[stageKey] || lifeStages[drawerData[drawerIndex].availableStages[0]];
        if (!stage) return;
        const duration = stage.days * MILLISECONDS_PER_DAY;
        const drawer = drawerData[drawerIndex];
        const hasQuadrants = drawer.quadrants > 0;

        const newTimers = {
            ...activeTimers,
            [key]: { startTime: Date.now(), duration, stage: stageKey }
        };
        setActiveTimers(newTimers);
        syncToBackend(newTimers, quadrantStages);

        present({
            message: hasQuadrants 
                ? `${drawer.drawer} Q${quadrantIndex + 1} - ${stage.name} timer started (${stage.days} days)`
                : `${drawer.drawer} - ${stage.name} timer started (${stage.days} days)`,
            duration: 2000,
            position: "top",
            mode: "ios",
            color: "success",
        });
    };

    const handleStop = (drawerIndex: number, quadrantIndex: number) => {
        const key = getTimerKey(drawerIndex, quadrantIndex);
        const timer = activeTimers[key];
        const stageName = timer ? lifeStages[timer.stage]?.name : "Timer";
        const drawer = drawerData[drawerIndex];
        const hasQuadrants = drawer.quadrants > 0;

        const newTimers = {
            ...activeTimers,
            [key]: null
        };
        setActiveTimers(newTimers);
        syncToBackend(newTimers, quadrantStages);

        present({
            message: hasQuadrants
                ? `${drawer.drawer} Q${quadrantIndex + 1} - ${stageName} timer stopped`
                : `${drawer.drawer} - ${stageName} timer stopped`,
            duration: 2000,
            position: "top",
            mode: "ios",
        });
    };

    const getEndTime = (drawerIndex: number, quadrantIndex: number) => {
        const key = getTimerKey(drawerIndex, quadrantIndex);
        const timer = activeTimers[key];
        if (!timer) return null;
        return timer.startTime + timer.duration;
    };

    const isTimerActive = (drawerIndex: number, quadrantIndex: number) => {
        const key = getTimerKey(drawerIndex, quadrantIndex);
        const timer = activeTimers[key];
        if (!timer) return false;
        return Date.now() < timer.startTime + timer.duration;
    };

    const getActiveStage = (drawerIndex: number, quadrantIndex: number) => {
        const key = getTimerKey(drawerIndex, quadrantIndex);
        const timer = activeTimers[key];
        if (timer) return lifeStages[timer.stage];
        return lifeStages[quadrantStages[key]] || lifeStages["eggs"];
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
                                        <h1 style={{ margin: 0 }}>BSF Life Cycle</h1>
                                    </IonCardTitle>
                                    <IonCardSubtitle>Complete Growth Timeline</IonCardSubtitle>
                                </IonCardHeader>
                                <IonCardContent className="ion-text-center">
                                    <IonText color="medium">
                                        <p style={{ margin: "0 0 12px" }}>
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
                        const stage = lifeStages[drawer.availableStages[0]];
                        
                        if (drawer.quadrants === 0) {
                            const timerActive = isTimerActive(drawerIndex, 0);
                            const endTime = getEndTime(drawerIndex, 0);
                            
                            return (
                                <IonRow key={drawerIndex}>
                                    <IonCol>
                                        <IonCard className="drawer-card">
                                            <IonCardHeader>
                                                <IonCardTitle>{drawer.drawer}</IonCardTitle>
                                                <IonCardSubtitle>{drawer.description}</IonCardSubtitle>
                                            </IonCardHeader>
                                            <IonCardContent>
                                                <div className={`drawer-single stage-${stage.color}`}>
                                                    <div className="drawer-stage-info">
                                                        <IonIcon icon={stage.icon} className="stage-icon" color={stage.color} />
                                                        <div>
                                                            <h4 className="stage-name">{stage.name}</h4>
                                                            <IonChip color={stage.color} outline className="stage-duration">
                                                                <IonIcon icon={timeOutline} />
                                                                <IonLabel>{stage.days} days</IonLabel>
                                                            </IonChip>
                                                        </div>
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
                                                                    onClick={() => handleStop(drawerIndex, 0)}
                                                                >
                                                                    <IonIcon slot="start" icon={stopOutline} />
                                                                    Stop
                                                                </IonButton>
                                                            </>
                                                        ) : (
                                                            <IonButton
                                                                color={stage.color}
                                                                size="small"
                                                                expand="block"
                                                                onClick={() => handleStart(drawerIndex, 0)}
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
                        }
                        
                        return (
                            <IonRow key={drawerIndex}>
                                <IonCol>
                                    <IonCard className="drawer-card">
                                        <IonCardHeader>
                                            <IonCardTitle>{drawer.drawer}</IonCardTitle>
                                            <IonCardSubtitle>{drawer.description}</IonCardSubtitle>
                                        </IonCardHeader>
                                        <IonCardContent>
                                            <div className="quadrant-grid">
                                                {Array.from({ length: drawer.quadrants }).map((_, quadrantIndex) => {
                                                    const key = getTimerKey(drawerIndex, quadrantIndex);
                                                    const timerActive = isTimerActive(drawerIndex, quadrantIndex);
                                                    const endTime = getEndTime(drawerIndex, quadrantIndex);
                                                    const activeStage = getActiveStage(drawerIndex, quadrantIndex);
                                                    const selectedStageKey = quadrantStages[key] || drawer.availableStages[0];

                                                    return (
                                                        <div key={quadrantIndex} className={`quadrant-item quadrant-${activeStage.color}`}>
                                                            <div className="quadrant-header">
                                                                <IonIcon icon={gridOutline} className="quadrant-icon" />
                                                                <span className="quadrant-label">Quadrant {quadrantIndex + 1}</span>
                                                            </div>

                                                            {drawer.availableStages.length > 1 && !timerActive && (
                                                                <IonSegment
                                                                    value={selectedStageKey}
                                                                    onIonChange={(e) => handleStageChange(drawerIndex, quadrantIndex, e.detail.value as string)}
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

                                                            <div className="quadrant-stage-info">
                                                                <IonIcon icon={activeStage.icon} className="stage-icon" color={activeStage.color} />
                                                                <div>
                                                                    <h4 className="stage-name">{activeStage.name}</h4>
                                                                    <IonChip color={activeStage.color} outline className="stage-duration">
                                                                        <IonIcon icon={timeOutline} />
                                                                        <IonLabel>{activeStage.days} days</IonLabel>
                                                                    </IonChip>
                                                                </div>
                                                            </div>

                                                            <div className="quadrant-actions">
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
                                                                            onClick={() => handleStop(drawerIndex, quadrantIndex)}
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
                                                                        onClick={() => handleStart(drawerIndex, quadrantIndex)}
                                                                    >
                                                                        <IonIcon slot="start" icon={playOutline} />
                                                                        Start Timer
                                                                    </IonButton>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </IonCardContent>
                                    </IonCard>
                                </IonCol>
                            </IonRow>
                        );
                    })}

                    <IonRow>
                        <IonCol>
                            <div className="ion-text-center ion-padding" style={{ paddingBottom: 32 }}>
                                <IonText color="medium">
                                    <p style={{ fontSize: 12, margin: 0 }}>
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
