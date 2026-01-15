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

    const sensorGraphs = useMemo(() => [
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
            sensor: "Substrate Moisture",
            max: thresholds.moisture.max,
            min: thresholds.moisture.min,
            warn: thresholds.moisture.optimal[1],
            unit: "%"
        }
    ], [thresholds]);

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
                                    <IonCardTitle>Current Stage: {stage}</IonCardTitle>
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
                    <IonSegment onIonChange={e => handleSegmentChange(e.detail.value!)}>
                        <IonSegmentButton value="Temperature" contentId='Temperature'>
                            <IonIcon icon={thermometerOutline} />
                        </IonSegmentButton>
                        <IonSegmentButton value="Humidity" contentId='Humidity'>
                            <IonIcon icon={cloudOutline} />
                        </IonSegmentButton>
                        <IonSegmentButton value="Substrate Moisture" contentId='Substrate Moisture'>
                            <IonIcon icon={waterOutline} />
                        </IonSegmentButton>
                    </IonSegment>
                    <IonRow>
                        <IonCol>
                            <IonSegmentView>
                                {sensorGraphs.map((graph, index) => {
                                    return (
                                        <IonSegmentContent key={index} id={graph.sensor} >
                                            <Graph
                                                key={index}
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

