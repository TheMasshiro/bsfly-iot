import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonChip, IonCol, IonContent, IonGrid, IonHeader, IonIcon, IonLabel, IonPage, IonRow, IonSegment, IonSegmentButton, IonSegmentContent, IonSegmentView, IonText, IonTitle, IonToolbar, SegmentValue } from '@ionic/react';
import { lifecycleThresholds } from '../../config/thresholds';
import { FC, useState, useEffect, useMemo, useCallback } from 'react';
import { cloudOutline, thermometerOutline, waterOutline } from 'ionicons/icons';
import { useLifeCycle } from '../../context/LifeCycleContext';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import Graph, { getData } from '../../components/Graph/Graph';
import Segments from '../../components/Segments/Segments';
import "./Analytics.css"
import Toolbar from '../../components/Toolbar/Toolbar';

const Analytics: FC = () => {
    const { stage, setStage } = useLifeCycle()
    const thresholds = lifecycleThresholds[stage]
    const [selectedSegment, setSelectedSegment] = useState<SegmentValue>("Temperature")
    const [currentReading, setCurrentReading] = useState<number>()
    const [maxValue, setMaxValue] = useState<number>()

    const sensorGraphs = useMemo(() => {
        const graphs = [
            {
                id: "1",
                sensor: "Temperature",
                max: thresholds.temperature.max,
                min: thresholds.temperature.min,
                warn: thresholds.temperature.optimal[1],
                unit: "°C"
            },
            {
                id: "2",
                sensor: "Humidity",
                max: thresholds.humidity.max,
                min: thresholds.humidity.min,
                warn: thresholds.humidity.optimal[1],
                unit: "%"
            },
            {
                id: "3",
                sensor: "Substrate Moisture 1",
                max: thresholds.moisture.max,
                min: thresholds.moisture.min,
                warn: thresholds.moisture.optimal[1],
                unit: "%"
            },
            {
                id: "4",
                sensor: "Substrate Moisture 2",
                max: thresholds.moisture.max,
                min: thresholds.moisture.min,
                warn: thresholds.moisture.optimal[1],
                unit: "%"
            }
        ];

        return graphs.filter(graph => {
            if (stage.toLowerCase() === 'drawer 3' && graph.sensor.toLowerCase() === 'substrate moisture 2') {
                return false;
            }
            return true;
        });
    }, [thresholds, stage]);

    useEffect(() => {
        const data = getData(selectedSegment as string);
        const currentGraph = sensorGraphs.find(graph => graph.sensor === selectedSegment);

        if (data.length > 0) {
            setCurrentReading(data[data.length - 1].value);
        }

        if (currentGraph) {
            setMaxValue(currentGraph.max);
        }
    }, [selectedSegment, sensorGraphs]);

    const progressStyles = useMemo(() => buildStyles({
        pathColor: '#6030ff',
        textColor: '#f6f8fc',
        trailColor: '#f6f8fc',
        pathTransitionDuration: 0.9,
    }), []);

    const handleSegmentChange = useCallback((value: SegmentValue) => {
        setSelectedSegment(value);
    }, []);

    return (
        <IonPage className="analytics-page">
            <IonHeader>
                <Toolbar
                    header={"Analytics"}
                />
            </IonHeader>

            <IonContent fullscreen>
                <IonHeader collapse="condense">
                    <IonToolbar>
                        <IonTitle size="large">Analytics</IonTitle>
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
                                                value={currentReading ?? 0}
                                                text={`${currentReading ?? 0}`}
                                                maxValue={maxValue ?? 100}
                                                styles={progressStyles}
                                            />
                                            <IonText className="progress-text">{selectedSegment}</IonText>
                                        </div>
                                    </div>
                                </IonCardContent>
                            </IonCard>
                        </IonCol>
                    </IonRow>
                    <IonSegment onIonChange={e => handleSegmentChange(e.detail.value!)} aria-label="Sensor selection">
                        <IonSegmentButton value="Temperature" contentId='Temperature' aria-label="Temperature">
                            <IonIcon icon={thermometerOutline} aria-hidden="true" />
                        </IonSegmentButton>
                        <IonSegmentButton value="Humidity" contentId='Humidity' aria-label="Humidity">
                            <IonIcon icon={cloudOutline} aria-hidden="true" />
                        </IonSegmentButton>
                        <IonSegmentButton value="Substrate Moisture 1" contentId='Substrate Moisture 1' aria-label="Substrate Moisture 1">
                            <IonIcon icon={waterOutline} aria-hidden="true" />
                        </IonSegmentButton>
                        {stage.toLowerCase() !== 'drawer 3' && (
                            <IonSegmentButton value="Substrate Moisture 2" contentId='Substrate Moisture 2' aria-label="Substrate Moisture 2">
                                <IonIcon icon={waterOutline} aria-hidden="true" />
                            </IonSegmentButton>
                        )}
                    </IonSegment>
                    <IonRow>
                        <IonCol>
                            <IonSegmentView>
                                {sensorGraphs.map((graph) => {
                                    return (
                                        <IonSegmentContent key={graph.id} id={graph.sensor} >
                                            <Graph
                                                sensorType={graph.sensor}
                                                upperLimit={graph.max}
                                                lowerLimit={graph.min}
                                                warningLimit={graph.warn}
                                                unit={graph.unit} />

                                            <IonRow class="ion-justify-content-center ion-align-items-center legends-row">
                                                <IonChip color="primary">{graph.sensor} {graph.unit}</IonChip>
                                                <IonChip color="danger">
                                                    <IonLabel>Upper Limit: {graph.max} {graph.unit}</IonLabel>
                                                </IonChip>
                                                <IonChip color="warning">
                                                    <IonLabel>Warning Limit: {graph.warn} {graph.unit}</IonLabel>
                                                </IonChip>
                                                <IonChip color="secondary">
                                                    <IonLabel>Lower Limit: {graph.min} {graph.unit}</IonLabel>
                                                </IonChip>
                                            </IonRow >
                                        </IonSegmentContent>
                                    )
                                })}
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

