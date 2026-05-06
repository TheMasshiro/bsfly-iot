import { FC, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import annotationPlugin from 'chartjs-plugin-annotation';
import Chart from 'chart.js/auto';
import { IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonChip, IonText, IonSpinner, useIonToast } from '@ionic/react';
import { useDevice } from '../../context/DeviceContext';
import { useLifeCycle } from '../../context/LifeCycleContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { offlineService } from '../../services/offline/OfflineService';
import { api, withToken } from '../../utils/api';
import './Graph.css';

interface GraphProps {
    sensorType: string;
    upperLimit: number;
    lowerLimit: number;
    warningLimit: number;
    unit: string;
}

interface ChartDataPoint {
    time: string;
    value: number;
}

const SENSOR_KEY_MAP: Record<string, string> = {
    temperature: 'temperature',
    humidity: 'humidity',
    moisture: 'moisture',
    ammonia: 'ammonia',
};

Chart.register(annotationPlugin);

const Graph: FC<GraphProps> = ({ sensorType, upperLimit, lowerLimit, warningLimit, unit }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<Chart | null>(null);
    const { currentDevice, getToken } = useDevice();
    const { stage } = useLifeCycle();
    const isAppOnline = useOnlineStatus();
    const currentDeviceId = currentDevice?._id;
    const isDeviceOffline = currentDevice?.status === 'offline';
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [present] = useIonToast();
    const lastErrorRef = useRef<number>(0);
    const hasLoadedOnceRef = useRef(false);

    const sensorKey = useMemo(() => {
        const normalized = sensorType.toLowerCase();
        return Object.keys(SENSOR_KEY_MAP).find(key => normalized.includes(key)) || 'temperature';
    }, [sensorType]);

    const getCacheKey = useCallback(() => {
        return `graph_data_${currentDeviceId}_${stage}_${sensorKey}`;
    }, [currentDeviceId, stage, sensorKey]);

    const fetchData = useCallback(async () => {
        if (!currentDeviceId) {
            setChartData([]);
            setLoading(false);
            return;
        }

        const cacheKey = getCacheKey();

        if (!isAppOnline || isDeviceOffline) {
            const cached = offlineService.get<ChartDataPoint[]>(cacheKey);
            if (cached && cached.length > 0) {
                setChartData(cached);
            } else {
                setChartData([]);
            }
            setLoading(false);
            return;
        }

        try {
            const token = await getToken();
            const { data } = await api.get(
                `/api/sensors/device/${currentDeviceId}/hourly?drawer=${encodeURIComponent(stage)}`,
                withToken(token)
            );

            const points: ChartDataPoint[] = data
                .filter((h: any) => h[sensorKey] !== null)
                .map((h: any) => ({
                    time: new Date(h.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    value: Math.round(h[sensorKey] * 100) / 100
                }));

            setChartData(points);
            offlineService.set(getCacheKey(), points);
        } catch (error) {
            const cached = offlineService.get<ChartDataPoint[]>(getCacheKey());
            if (cached && cached.length > 0) {
                setChartData(cached);
            } else {
                setChartData([]);
            }
            if (isAppOnline && !isDeviceOffline) {
                const now = Date.now();
                if (now - lastErrorRef.current > 60000) {
                    lastErrorRef.current = now;
                    present({
                        message: `Failed to load ${sensorType} graph data`,
                        duration: 2000,
                        position: "top",
                        mode: "ios",
                        color: "warning",
                    });
                }
            }
        } finally {
            setLoading(false);
        }
    }, [currentDeviceId, isDeviceOffline, stage, sensorKey, sensorType, present, getToken, getCacheKey, isAppOnline]);

    useEffect(() => {
        if (!currentDeviceId) return;

        const cached = offlineService.get<ChartDataPoint[]>(getCacheKey());
        if (cached && cached.length > 0) {
            setChartData(cached);
            hasLoadedOnceRef.current = true;
            setLoading(false);
        } else if (!hasLoadedOnceRef.current) {
            setLoading(true);
        }

        fetchData();

        const interval = setInterval(() => {
            if (isAppOnline && !isDeviceOffline) {
                fetchData();
            }
        }, 60 * 60 * 1000);

        return () => clearInterval(interval);
    }, [currentDeviceId, isDeviceOffline, isAppOnline, fetchData, getCacheKey]);

    const { colorClass, chipColor, statusText } = useMemo(() => {
        const latestValue = chartData.length > 0 ? chartData[chartData.length - 1].value : 0;
        if (latestValue >= upperLimit) return { colorClass: 'graph-value--critical', chipColor: 'danger', statusText: 'Critical' };
        if (latestValue >= warningLimit) return { colorClass: 'graph-value--warning', chipColor: 'warning', statusText: 'Warning' };
        if (latestValue <= lowerLimit) return { colorClass: 'graph-value--low', chipColor: 'primary', statusText: 'Low' };
        return { colorClass: 'graph-value--optimal', chipColor: 'success', statusText: 'Optimal' };
    }, [chartData, upperLimit, warningLimit, lowerLimit]);

    const latestValue = chartData.length > 0 ? chartData[chartData.length - 1].value : 0;

    useEffect(() => {
        if (!canvasRef.current) return;
        
        chartRef.current?.destroy();

        chartRef.current = new Chart(canvasRef.current, {
            type: 'line',
            data: {
                labels: chartData.map((row) => row.time),
                datasets: [{
                    label: `${sensorType} ${unit}`,
                    data: chartData.map((row) => row.value),
                    backgroundColor: 'rgba(40, 187, 80, 0.2)',
                    borderColor: 'rgba(40, 187, 80, 1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: chartData.map((row) => {
                        if (row.value >= upperLimit) return 'rgba(255, 99, 132, 1)';
                        if (row.value >= warningLimit) return 'rgba(255, 205, 86, 1)';
                        if (row.value <= lowerLimit) return 'rgba(54, 162, 235, 1)';
                        return 'rgba(40, 187, 80, 1)';
                    }),
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1,
                    pointRadius: 3,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    annotation: {
                        annotations: {
                            upperLimit: {
                                type: 'line',
                                yMin: upperLimit,
                                yMax: upperLimit,
                                borderColor: 'rgb(255, 99, 132)',
                                borderWidth: 2,
                                borderDash: [5, 5],
                            },
                            warningLimit: {
                                type: 'line',
                                yMin: warningLimit,
                                yMax: warningLimit,
                                borderColor: 'rgb(255, 205, 86)',
                                borderWidth: 2,
                                borderDash: [5, 5],
                            },
                            lowerLimit: {
                                type: 'line',
                                yMin: lowerLimit,
                                yMax: lowerLimit,
                                borderColor: 'rgb(54, 162, 235)',
                                borderWidth: 2,
                                borderDash: [5, 5],
                            }
                        }
                    },
                    legend: { display: false }
                }
            }
        });

        return () => { chartRef.current?.destroy(); };
    }, [chartData, sensorType, upperLimit, lowerLimit, warningLimit, unit]);

    const displayTitle = sensorType.toUpperCase() === "MOISTURE" ? "SUBSTRATE MOISTURE" : sensorType.toUpperCase();

    if (loading) {
        return (
            <IonCard mode="ios">
                <IonCardHeader>
                    <IonCardSubtitle>{displayTitle}</IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>
                    <div className="graph-loading">
                        <IonSpinner name="crescent" />
                    </div>
                </IonCardContent>
            </IonCard>
        );
    }

    if (chartData.length === 0) {
        return (
            <IonCard mode="ios">
                <IonCardHeader>
                    <IonCardSubtitle>{displayTitle}</IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>
                    <div className="graph-empty">
                        <IonText color="medium">No data available</IonText>
                    </div>
                </IonCardContent>
            </IonCard>
        );
    }

    return (
        <IonCard mode="ios">
            <IonCardHeader>
                <IonCardSubtitle className="graph-header">
                    <span>{displayTitle}</span>
                    <div className="graph-value-container">
                        <IonText className={`graph-value ${colorClass}`}>
                            {typeof latestValue === 'number' ? latestValue.toFixed(2) : latestValue}{unit}
                        </IonText>
                        <IonChip color={chipColor} className="graph-status-chip">
                            {statusText}
                        </IonChip>
                    </div>
                </IonCardSubtitle>
            </IonCardHeader>
            <IonCardContent>
                <div className="graph-container">
                    <canvas ref={canvasRef} role="img" aria-label={`${sensorType} data chart`} />
                </div>
            </IonCardContent>
        </IonCard>
    );
};

export default Graph;
