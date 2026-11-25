import { FC, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import annotationPlugin from 'chartjs-plugin-annotation';
import Chart from 'chart.js/auto';
import { IonSpinner, useIonToast } from '@ionic/react';
import { useDevice } from '../../context/DeviceContext';
import { useLifeCycle } from '../../context/LifeCycleContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { offlineService } from '../../services/offline/OfflineService';
import { api, withToken } from '../../utils/api';
import StatusPill from '../ui/StatusPill';
import { Status } from '../ui/status';
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
    leftsubstrate: 'leftSubstrate',
    centersubstrate: 'centerSubstrate',
    rightsubstrate: 'rightSubstrate',
    ammonia: 'ammonia',
};

const DISPLAY_TITLE_MAP: Record<string, string> = {
    temperature: 'Temperature',
    humidity: 'Humidity',
    moisture: 'Substrate moisture',
    leftsubstrate: 'Left substrate',
    centersubstrate: 'Center substrate',
    rightsubstrate: 'Right substrate',
    ammonia: 'Ammonia',
};

const formatGraphValue = (sensorType: string, value: number): string => {
    const key = sensorType.toLowerCase().replace(/\s+/g, '');
    if (key === 'moisture' || key === 'leftsubstrate' || key === 'centersubstrate' || key === 'rightsubstrate') {
        return Math.round(value).toString();
    }

    return value.toFixed(1);
};

const isSubstrateKey = (sensorType: string): boolean => {
    const key = sensorType.toLowerCase().replace(/\s+/g, '');
    return key === 'moisture' || key === 'leftsubstrate' || key === 'centersubstrate' || key === 'rightsubstrate';
};

Chart.register(annotationPlugin);

const readChartTokens = () => {
    const styles = getComputedStyle(document.documentElement);
    const token = (name: string) => styles.getPropertyValue(name).trim();
    return {
        font: token('--bs-font'),
        brand: token('--bs-brand'),
        brandFill: `rgba(${token('--bs-brand-rgb')}, 0.14)`,
        crit: token('--bs-crit'),
        warn: token('--bs-warn'),
        muted: token('--bs-text-3'),
        critSoft: token('--bs-crit-soft'),
        warnSoft: token('--bs-warn-soft'),
        grid: token('--bs-border'),
        surface: token('--bs-surface'),
        text: token('--bs-text'),
    };
};

const useThemeVersion = () => {
    const [version, setVersion] = useState(0);
    useEffect(() => {
        const observer = new MutationObserver(() => setVersion((v) => v + 1));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);
    return version;
};

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
    const themeVersion = useThemeVersion();

    const sensorKey = useMemo(() => {
        const normalized = sensorType.toLowerCase().replace(/\s+/g, '');
        return SENSOR_KEY_MAP[normalized] ?? 'temperature';
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
                    time: new Date(h.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                    value: isSubstrateKey(sensorType)
                        ? Math.round(h[sensorKey])
                        : Math.round(h[sensorKey] * 100) / 100
                }));

            const { data: currentData } = await api.get(
                `/api/sensors/device/${currentDeviceId}?drawer=${encodeURIComponent(stage)}`,
                withToken(token)
            );

            const currentValueRaw = currentData?.[sensorKey];
            if (typeof currentValueRaw === 'number') {
                const currentHourStart = new Date();
                currentHourStart.setMinutes(0, 0, 0);
                const currentHourLabel = currentHourStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                const currentValue = isSubstrateKey(sensorType)
                    ? Math.round(currentValueRaw)
                    : Math.round(currentValueRaw * 100) / 100;

                const existingHourIndex = points.findIndex((point) => point.time === currentHourLabel);
                if (existingHourIndex >= 0) {
                    points[existingHourIndex] = {
                        ...points[existingHourIndex],
                        value: currentValue,
                    };
                } else {
                    points.push({
                        time: currentHourLabel,
                        value: currentValue,
                    });
                }
            }

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
        }, 5000);

        return () => clearInterval(interval);
    }, [currentDeviceId, isDeviceOffline, isAppOnline, fetchData, getCacheKey]);


    const reading = useMemo(() => {
        const latestValue = chartData.length > 0 ? chartData[chartData.length - 1].value : 0;
        if (latestValue >= upperLimit) return { latestValue, status: 'crit' as Status, label: 'Too high' };
        if (latestValue >= warningLimit) return { latestValue, status: 'warn' as Status, label: 'Getting high' };
        if (latestValue <= lowerLimit) return { latestValue, status: 'idle' as Status, label: 'Too low' };
        return { latestValue, status: 'ok' as Status, label: 'In range' };
    }, [chartData, upperLimit, warningLimit, lowerLimit]);

    useEffect(() => {
        if (!canvasRef.current) return;

        chartRef.current?.destroy();

        const t = readChartTokens();
        Chart.defaults.font.family = t.font;

        chartRef.current = new Chart(canvasRef.current, {
            type: 'line',
            data: {
                labels: chartData.map((row) => row.time),
                datasets: [{
                    label: `${sensorType} ${unit}`,
                    data: chartData.map((row) => row.value),
                    borderColor: t.brand,
                    backgroundColor: t.brandFill,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: chartData.map((row) => {
                        if (row.value >= upperLimit) return t.crit;
                        if (row.value >= warningLimit) return t.warn;
                        if (row.value <= lowerLimit) return t.muted;
                        return t.brand;
                    }),
                    pointBorderColor: t.surface,
                    pointBorderWidth: 1,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { color: t.grid },
                        border: { color: t.grid },
                        ticks: { color: t.muted, maxRotation: 0, autoSkipPadding: 12 },
                    },
                    y: {
                        grid: { color: t.grid },
                        border: { display: false },
                        ticks: { color: t.muted },
                    },
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: t.surface,
                        titleColor: t.text,
                        bodyColor: t.text,
                        borderColor: t.grid,
                        borderWidth: 1,
                        displayColors: false,
                    },
                    annotation: {
                        annotations: {
                            critBand: {
                                type: 'box',
                                yMin: upperLimit,
                                yMax: upperLimit + Math.max(upperLimit - warningLimit, 1),
                                backgroundColor: t.critSoft,
                                borderWidth: 0,
                                adjustScaleRange: false,
                                drawTime: 'beforeDatasetsDraw',
                            },
                            warnBand: {
                                type: 'box',
                                yMin: warningLimit,
                                yMax: upperLimit,
                                backgroundColor: t.warnSoft,
                                borderWidth: 0,
                                adjustScaleRange: false,
                                drawTime: 'beforeDatasetsDraw',
                            },
                            upperLimit: {
                                type: 'line',
                                yMin: upperLimit,
                                yMax: upperLimit,
                                borderColor: t.crit,
                                borderWidth: 1,
                                borderDash: [4, 4],
                            },
                            warningLimit: {
                                type: 'line',
                                yMin: warningLimit,
                                yMax: warningLimit,
                                borderColor: t.warn,
                                borderWidth: 1,
                                borderDash: [4, 4],
                            },
                            lowerLimit: {
                                type: 'line',
                                yMin: lowerLimit,
                                yMax: lowerLimit,
                                borderColor: t.muted,
                                borderWidth: 1,
                                borderDash: [4, 4],
                            },
                        },
                    },
                },
            },
        });

        return () => { chartRef.current?.destroy(); };
    }, [chartData, sensorType, upperLimit, lowerLimit, warningLimit, unit, themeVersion]);

    const displayKey = sensorType.toLowerCase().replace(/\s+/g, '');
    const displayTitle = DISPLAY_TITLE_MAP[displayKey] ?? sensorType;
    const limits = [
        { tone: 'crit', label: 'Upper', value: upperLimit },
        { tone: 'warn', label: 'Warning', value: warningLimit },
        { tone: 'muted', label: 'Lower', value: lowerLimit },
    ];

    if (loading) {
        return (
            <section className="bs-card chart-card">
                <div className="chart-head">
                    <h2>{displayTitle}</h2>
                </div>
                <div className="chart-state">
                    <IonSpinner name="crescent" />
                </div>
            </section>
        );
    }

    if (chartData.length === 0) {
        return (
            <section className="bs-card chart-card">
                <div className="chart-head">
                    <h2>{displayTitle}</h2>
                </div>
                <div className="chart-state">
                    <p>No readings yet for this drawer.</p>
                </div>
            </section>
        );
    }

    return (
        <section className="bs-card chart-card">
            <div className="chart-head">
                <div>
                    <h2>{displayTitle}</h2>
                    <p>Latest hour</p>
                </div>
                <div className="chart-now" data-status={reading.status}>
                    <span className="chart-value mono">
                        {formatGraphValue(sensorType, reading.latestValue)}
                        <small>{unit}</small>
                    </span>
                    <StatusPill status={reading.status}>{reading.label}</StatusPill>
                </div>
            </div>
            <div className="chart-container">
                <canvas ref={canvasRef} role="img" aria-label={`${sensorType} data chart`} />
            </div>
            <dl className="chart-limits">
                {limits.map((limit) => (
                    <div key={limit.label} data-tone={limit.tone}>
                        <dt>
                            <i aria-hidden="true" />
                            {limit.label}
                        </dt>
                        <dd className="mono">{limit.value}{unit}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
};

export default Graph;
