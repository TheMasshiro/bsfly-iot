import { FC, useEffect, useRef, useState } from 'react';
import annotationPlugin from 'chartjs-plugin-annotation';
import Chart from 'chart.js/auto';
import { IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonChip, IonText, IonSpinner } from '@ionic/react';
import { useDevice } from '../../context/DeviceContext';

const API_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000").replace(/\/+$/, "");

interface GraphProps {
    sensorType: string,
    upperLimit: number,
    lowerLimit: number,
    warningLimit: number,
    unit: string,
}

interface ChartDataPoint {
    time: string;
    value: number;
}

Chart.register(annotationPlugin);

const Graph: FC<GraphProps> = ({ sensorType, upperLimit, lowerLimit, warningLimit, unit }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<Chart | null>(null);
    const { currentDevice } = useDevice();
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [loading, setLoading] = useState(true);

    const getSensorKey = (type: string): string => {
        const normalized = type.toLowerCase();
        if (normalized.includes('temperature')) return 'temperature';
        if (normalized.includes('humidity')) return 'humidity';
        if (normalized.includes('moisture')) return 'moisture';
        if (normalized.includes('ammonia')) return 'ammonia';
        return 'temperature';
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!currentDevice) {
                setChartData([]);
                setLoading(false);
                return;
            }

            try {
                const today = new Date();
                const fromDate = new Date();
                fromDate.setDate(fromDate.getDate() - 1);

                const response = await fetch(
                    `${API_URL}/api/sensors/device/${currentDevice._id}/history?from=${fromDate.toISOString().split('T')[0]}&to=${today.toISOString().split('T')[0]}`
                );

                if (!response.ok) throw new Error('Failed to fetch');

                const data = await response.json();
                const sensorKey = getSensorKey(sensorType);

                const points: ChartDataPoint[] = [];
                data.forEach((day: any) => {
                    if (day.readings) {
                        day.readings.forEach((reading: any) => {
                            if (reading[sensorKey] !== undefined) {
                                const date = new Date(reading.timestamp);
                                points.push({
                                    time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                    value: reading[sensorKey]
                                });
                            }
                        });
                    }
                });

                setChartData(points.slice(-24));
            } catch {
                setChartData([]);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [currentDevice, sensorType]);
    
    const latestValue = chartData.length > 0 ? chartData[chartData.length - 1].value : 0;
    
    const getStatusInfo = () => {
        if (latestValue >= upperLimit) {
            return { color: '#cb1a27', chipColor: 'danger', statusText: 'High' };
        }
        if (latestValue >= warningLimit) {
            return { color: '#ffca22', chipColor: 'warning', statusText: 'Warning' };
        }
        if (latestValue <= lowerLimit) {
            return { color: '#3dc2ff', chipColor: 'primary', statusText: 'Low' };
        }
        return { color: '#42d96b', chipColor: 'success', statusText: 'Optimal' };
    };

    const { color, chipColor, statusText } = getStatusInfo();

    useEffect(() => {
        if (canvasRef.current) {
            if (chartRef.current) {
                chartRef.current.destroy();
            }

            chartRef.current = new Chart(canvasRef.current, {
                type: 'line',
                data: {
                    labels: chartData.map(row => row.time),
                    datasets: [{
                        label: `${sensorType} ${unit}`,
                        data: chartData.map(row => row.value),
                        backgroundColor: 'rgba(40, 187, 80, 0.2)',
                        borderColor: 'rgba(40, 187, 80, 1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: chartData.map(row => {
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
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }

        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
            }
        };
    }, [chartData, sensorType, upperLimit, lowerLimit, warningLimit, unit]);

    if (loading) {
        return (
            <IonCard mode="ios">
                <IonCardHeader>
                    <IonCardSubtitle>{sensorType.toUpperCase()}</IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>
                    <div style={{ height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                    <IonCardSubtitle>{sensorType.toUpperCase()}</IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>
                    <div style={{ height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IonText color="medium">No data available</IonText>
                    </div>
                </IonCardContent>
            </IonCard>
        );
    }

    return (
        <IonCard mode="ios">
            <IonCardHeader>
                <IonCardSubtitle style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{sensorType.toUpperCase() === "MOISTURE" ? "SUBSTRATE MOISTURE" : sensorType.toUpperCase()}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <IonText style={{ color, fontWeight: 'bold', fontSize: '1.2rem' }}>
                            {latestValue}{unit}
                        </IonText>
                        <IonChip color={chipColor} style={{ margin: 0 }}>
                            {statusText}
                        </IonChip>
                    </div>
                </IonCardSubtitle>
            </IonCardHeader>

            <IonCardContent>
                <div style={{ height: '250px' }}>
                    <canvas ref={canvasRef} id="acquisitions" role="img" aria-label={`${sensorType} data chart`}></canvas>
                </div>
            </IonCardContent>
        </IonCard>
    )
}


export default Graph;
