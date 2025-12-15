import { FC, useEffect, useRef } from 'react';
import annotationPlugin from 'chartjs-plugin-annotation';
import Chart from 'chart.js/auto';
import { IonCard, IonCardContent, IonCardHeader, IonCardSubtitle } from '@ionic/react';
import { humidityData, moistureData, temperatureData } from '../../assets/data';

interface GraphProps {
    sensorType: string,
    upperLimit: number,
    lowerLimit: number,
    warningLimit: number,
    unit: string,
}

Chart.register(annotationPlugin);
const Graph: FC<GraphProps> = ({ sensorType, upperLimit, lowerLimit, warningLimit, unit }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<Chart | null>(null);

    const getData = () => {
        switch (sensorType.toLowerCase()) {
            case "temperature":
                return temperatureData;
            case "humidity":
                return humidityData;
            case "substrate moisture":
                return moistureData;
            default:
                return temperatureData;
        }
    };

    const chartData = getData();

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
    }, [sensorType, upperLimit, lowerLimit, warningLimit]);

    return (
        <IonCard mode="ios">
            <IonCardHeader>
                <IonCardSubtitle>{sensorType.toUpperCase() === "MOISTURE" ? "SUBSTRATE MOISTURE" : sensorType.toUpperCase()}</IonCardSubtitle>
            </IonCardHeader>

            <IonCardContent>
                <div style={{ height: '250px' }}>
                    <canvas ref={canvasRef} id="acquisitions"></canvas>
                </div>
            </IonCardContent>
        </IonCard>
    )
}


export default Graph;
