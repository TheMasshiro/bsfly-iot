import {
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonChip,
    IonContent,
    IonHeader,
    IonIcon,
    IonLabel,
    IonPage,
    IonRange,
    IonText,
    IonSpinner,
    useIonToast,
} from "@ionic/react";
import { calendarOutline, cloudUpload, timeOutline, documentOutline, downloadOutline } from "ionicons/icons";
import { FC, useState, useMemo } from "react";
import Toolbar from "../../components/Toolbar/Toolbar";
import { useDevice } from "../../context/DeviceContext";
import "./Backup.css";

const API_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000").replace(/\/+$/, "");

interface SensorReading {
    timestamp: string;
    temperature?: number;
    humidity?: number;
    moisture?: number;
    ammonia?: number;
}

interface DayReading {
    drawerId: string;
    date: string;
    readings: SensorReading[];
}

const Backup: FC = () => {
    const [daysAgo, setDaysAgo] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [present] = useIonToast();
    const { currentDevice } = useDevice();

    const today = useMemo(() => new Date(), []);

    const selectedDate = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        return date;
    }, [daysAgo]);

    const formatDate = (date: Date): string => {
        return date.toLocaleDateString("en-US", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    const formatDateISO = (date: Date): string => {
        return date.toISOString().split('T')[0];
    };

    const fetchSensorHistory = async (): Promise<DayReading[]> => {
        if (!currentDevice) {
            throw new Error("No device selected");
        }

        const response = await fetch(
            `${API_URL}/api/sensors/device/${currentDevice._id}/history?from=${formatDateISO(selectedDate)}&to=${formatDateISO(today)}`
        );

        if (!response.ok) {
            throw new Error("Failed to fetch sensor data");
        }

        return response.json();
    };

    const generateCSV = (data: DayReading[]): string => {
        const headers = ["Date", "Time", "Temperature (°C)", "Humidity (%)", "Moisture (%)", "Ammonia (ppm)"];
        const rows: string[] = [headers.join(",")];

        data.forEach((day) => {
            day.readings.forEach((reading) => {
                const date = new Date(reading.timestamp);
                const row = [
                    formatDateISO(date),
                    date.toLocaleTimeString(),
                    reading.temperature ?? "",
                    reading.humidity ?? "",
                    reading.moisture ?? "",
                    reading.ammonia ?? "",
                ];
                rows.push(row.join(","));
            });
        });

        return rows.join("\n");
    };

    const generateJSON = (data: DayReading[]): string => {
        const exportData = {
            device: currentDevice?.name || "Unknown",
            deviceId: currentDevice?._id || "",
            exportDate: new Date().toISOString(),
            dateRange: {
                from: formatDateISO(selectedDate),
                to: formatDateISO(today),
            },
            readings: data.flatMap((day) =>
                day.readings.map((reading) => ({
                    timestamp: reading.timestamp,
                    temperature: reading.temperature,
                    humidity: reading.humidity,
                    moisture: reading.moisture,
                    ammonia: reading.ammonia,
                }))
            ),
        };
        return JSON.stringify(exportData, null, 2);
    };

    const downloadFile = (content: string, filename: string, mimeType: string) => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleBackup = async (format: "csv" | "json") => {
        if (!currentDevice) {
            present({ message: "Please select a device first", duration: 2000, color: "warning" });
            return;
        }

        setLoading(true);
        try {
            const data = await fetchSensorHistory();

            if (!data || data.length === 0) {
                present({ message: "No sensor data found for the selected period", duration: 2000, color: "warning" });
                return;
            }

            const deviceName = currentDevice.name.replace(/[^a-z0-9]/gi, "_");
            const dateStr = formatDateISO(selectedDate);

            if (format === "csv") {
                const csv = generateCSV(data);
                downloadFile(csv, `${deviceName}_backup_${dateStr}.csv`, "text/csv");
            } else {
                const json = generateJSON(data);
                downloadFile(json, `${deviceName}_backup_${dateStr}.json`, "application/json");
            }

            present({ message: `Backup exported as ${format.toUpperCase()}`, duration: 2000, color: "success" });
        } catch (error: any) {
            present({ message: error.message || "Failed to create backup", duration: 2000, color: "danger" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <IonPage className="backup-page">
            <IonHeader class="ion-no-border">
                <Toolbar header={"Backup Data"} />
            </IonHeader>

            <IonContent fullscreen>
                <IonCard className="ion-margin">
                    <IonCardHeader>
                        <IonCardSubtitle>
                            <IonIcon
                                icon={calendarOutline}
                                style={{ verticalAlign: "middle", marginRight: 8 }}
                            />
                            Select Backup Date
                        </IonCardSubtitle>
                        <IonCardTitle className="ion-text-center ion-padding-top">
                            <IonText color="primary">
                                <h1 style={{ margin: 0, fontSize: 28 }}>
                                    {formatDate(selectedDate)}
                                </h1>
                            </IonText>
                        </IonCardTitle>
                    </IonCardHeader>

                    <IonCardContent>
                        <div className="ion-text-center ion-padding-bottom">
                            <IonChip color={daysAgo === 0 ? "primary" : "medium"}>
                                <IonIcon icon={timeOutline} />
                                <IonLabel>
                                    {daysAgo === 0
                                        ? "Today"
                                        : `${daysAgo} day${daysAgo > 1 ? "s" : ""} ago`}
                                </IonLabel>
                            </IonChip>
                        </div>

                        <IonRange
                            min={0}
                            max={30}
                            step={1}
                            value={daysAgo}
                            onIonChange={(e) => setDaysAgo(e.detail.value as number)}
                            pin
                            pinFormatter={(value: number) => `${value}d`}
                            style={{ padding: "0 8px" }}
                        >
                            <IonLabel slot="start" color="medium">
                                Today
                            </IonLabel>
                            <IonLabel slot="end" color="medium">
                                30 days
                            </IonLabel>
                        </IonRange>

                        <div
                            className="ion-text-center"
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "8px 8px 0",
                            }}
                        >
                            <IonText color="medium">
                                <small>{formatDate(today)}</small>
                            </IonText>
                            <IonText color="medium">
                                <small>
                                    {formatDate(
                                        new Date(
                                            today.getTime() - 30 * 24 * 60 * 60 * 1000
                                        )
                                    )}
                                </small>
                            </IonText>
                        </div>
                    </IonCardContent>
                </IonCard>

                <IonCard className="ion-margin">
                    <IonCardHeader>
                        <IonCardSubtitle>
                            <IonIcon
                                icon={cloudUpload}
                                style={{ verticalAlign: "middle", marginRight: 8 }}
                            />
                            Backup Action
                        </IonCardSubtitle>
                        <IonCardTitle>Create Backup</IonCardTitle>
                    </IonCardHeader>

                    <IonCardContent>
                        <IonText color="medium">
                            <p style={{ margin: "0 0 24px" }}>
                                Export sensor data from{" "}
                                <strong>{formatDate(selectedDate)}</strong> to today.
                            </p>
                        </IonText>

                        <div style={{ display: "flex", gap: "12px", flexDirection: "column" }}>
                            <IonButton
                                expand="block"
                                onClick={() => handleBackup("csv")}
                                size="large"
                                disabled={loading || !currentDevice}
                                style={{
                                    "--background":
                                        "linear-gradient(135deg, var(--ion-color-primary) 0%, var(--ion-color-primary-shade) 100%)",
                                    "--box-shadow":
                                        "0 4px 16px rgba(var(--ion-color-primary-rgb), 0.4)",
                                    "--border-radius": "12px",
                                    height: "56px",
                                    fontSize: "18px",
                                    fontWeight: "600",
                                }}
                            >
                                {loading ? (
                                    <IonSpinner name="crescent" />
                                ) : (
                                    <>
                                        <IonIcon
                                            icon={downloadOutline}
                                            slot="start"
                                            style={{ fontSize: 24 }}
                                        />
                                        Export as CSV
                                    </>
                                )}
                            </IonButton>

                            <IonButton
                                expand="block"
                                onClick={() => handleBackup("json")}
                                size="large"
                                disabled={loading || !currentDevice}
                                color="secondary"
                                style={{
                                    "--border-radius": "12px",
                                    height: "56px",
                                    fontSize: "18px",
                                    fontWeight: "600",
                                }}
                            >
                                {loading ? (
                                    <IonSpinner name="crescent" />
                                ) : (
                                    <>
                                        <IonIcon
                                            icon={documentOutline}
                                            slot="start"
                                            style={{ fontSize: 24 }}
                                        />
                                        Export as JSON
                                    </>
                                )}
                            </IonButton>
                        </div>

                        {!currentDevice && (
                            <IonText color="warning" className="ion-text-center">
                                <p style={{ marginTop: 16 }}>
                                    Please select a device in Settings to export data.
                                </p>
                            </IonText>
                        )}
                    </IonCardContent>
                </IonCard>
            </IonContent>
        </IonPage>
    );
};

export default Backup;
