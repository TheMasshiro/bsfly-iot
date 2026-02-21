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
    IonInput,
    IonItem,
    IonLabel,
    IonPage,
    IonRange,
    IonSegment,
    IonSegmentButton,
    IonText,
    IonSpinner,
    useIonToast,
} from "@ionic/react";
import { calendarOutline, cloudUpload, timeOutline, documentOutline, downloadOutline, documentTextOutline, hardwareChipOutline, cloudDownloadOutline, syncOutline, trashOutline, layersOutline } from "ionicons/icons";
import { FC, useState, useMemo } from "react";
import { jsPDF } from "jspdf";
import Toolbar from "../../components/Toolbar/Toolbar";
import { useDevice } from "../../context/DeviceContext";
import { api, withToken } from "../../utils/api";
import "./Backup.css";

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
    const [selectedDrawer, setSelectedDrawer] = useState<string>("all");
    const [loading, setLoading] = useState(false);
    const [sdLoading, setSdLoading] = useState(false);
    const [present] = useIonToast();
    const { currentDevice, getToken } = useDevice();
    const [espIp, setEspIp] = useState<string>("");
    const [sdStatus, setSdStatus] = useState<{ storedCount: number; sdAvailable: boolean } | null>(null);

    const drawerOptions = ["all", "Drawer 1", "Drawer 2", "Drawer 3"];

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

        const token = await getToken();
        let url = `/api/sensors/device/${currentDevice._id}/history?from=${formatDateISO(selectedDate)}&to=${formatDateISO(today)}`;
        if (selectedDrawer !== "all") {
            url += `&drawer=${encodeURIComponent(selectedDrawer)}`;
        }
        const { data } = await api.get(url, withToken(token));

        return data;
    };

    const generateCSV = (data: DayReading[]): string => {
        const headers = ["Drawer", "Date", "Time", "Temperature (°C)", "Humidity (%)", "Moisture (%)", "Ammonia (ppm)"];
        const rows: string[] = [headers.join(",")];

        data.forEach((day) => {
            day.readings.forEach((reading) => {
                const date = new Date(reading.timestamp);
                const row = [
                    day.drawerId,
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
                    drawer: day.drawerId,
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

    interface DailyAverage {
        date: string;
        temperature: { avg: number; min: number; max: number; count: number };
        humidity: { avg: number; min: number; max: number; count: number };
        moisture: { avg: number; min: number; max: number; count: number };
        ammonia: { avg: number; min: number; max: number; count: number };
    }

    const calculateDailyAverages = (data: DayReading[]): DailyAverage[] => {
        const dailyMap = new Map<string, {
            temp: number[]; hum: number[]; moist: number[]; amm: number[];
        }>();

        data.forEach((day) => {
            day.readings.forEach((reading) => {
                const dateKey = new Date(reading.timestamp).toISOString().split('T')[0];
                if (!dailyMap.has(dateKey)) {
                    dailyMap.set(dateKey, { temp: [], hum: [], moist: [], amm: [] });
                }
                const entry = dailyMap.get(dateKey)!;
                if (reading.temperature !== undefined) entry.temp.push(reading.temperature);
                if (reading.humidity !== undefined) entry.hum.push(reading.humidity);
                if (reading.moisture !== undefined) entry.moist.push(reading.moisture);
                if (reading.ammonia !== undefined) entry.amm.push(reading.ammonia);
            });
        });

        const calcStats = (arr: number[]) => {
            if (arr.length === 0) return { avg: 0, min: 0, max: 0, count: 0 };
            const sum = arr.reduce((a, b) => a + b, 0);
            return {
                avg: Math.round((sum / arr.length) * 10) / 10,
                min: Math.round(Math.min(...arr) * 10) / 10,
                max: Math.round(Math.max(...arr) * 10) / 10,
                count: arr.length,
            };
        };

        return Array.from(dailyMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, values]) => ({
                date,
                temperature: calcStats(values.temp),
                humidity: calcStats(values.hum),
                moisture: calcStats(values.moist),
                ammonia: calcStats(values.amm),
            }));
    };

    const generatePDFReport = (data: DayReading[], startDate: Date) => {
        const doc = new jsPDF();
        const dailyAverages = calculateDailyAverages(data);
        const pageWidth = doc.internal.pageSize.getWidth();
        let y = 20;

        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        const title = selectedDrawer === "all" ? "BSF Weekly Report" : `BSF Weekly Report - ${selectedDrawer}`;
        doc.text(title, pageWidth / 2, y, { align: "center" });
        y += 10;

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text(`Device: ${currentDevice?.name || "Unknown"}`, pageWidth / 2, y, { align: "center" });
        y += 6;
        doc.text(`Period: ${formatDate(startDate)} - ${formatDate(today)}`, pageWidth / 2, y, { align: "center" });
        y += 6;
        doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, y, { align: "center" });
        y += 15;

        doc.setDrawColor(200);
        doc.line(20, y, pageWidth - 20, y);
        y += 10;

        doc.setTextColor(0);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Weekly Summary", 20, y);
        y += 10;

        const allTemps: number[] = [];
        const allHums: number[] = [];
        const allMoist: number[] = [];
        const allAmm: number[] = [];

        dailyAverages.forEach(day => {
            if (day.temperature.count > 0) allTemps.push(day.temperature.avg);
            if (day.humidity.count > 0) allHums.push(day.humidity.avg);
            if (day.moisture.count > 0) allMoist.push(day.moisture.avg);
            if (day.ammonia.count > 0) allAmm.push(day.ammonia.avg);
        });

        const calcOverall = (arr: number[]) => {
            if (arr.length === 0) return { avg: "N/A", min: "N/A", max: "N/A" };
            const sum = arr.reduce((a, b) => a + b, 0);
            return {
                avg: (sum / arr.length).toFixed(1),
                min: Math.min(...arr).toFixed(1),
                max: Math.max(...arr).toFixed(1),
            };
        };

        const tempStats = calcOverall(allTemps);
        const humStats = calcOverall(allHums);
        const moistStats = calcOverall(allMoist);
        const ammStats = calcOverall(allAmm);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");

        const summaryData = [
            ["Parameter", "Average", "Min", "Max"],
            ["Temperature (°C)", tempStats.avg, tempStats.min, tempStats.max],
            ["Humidity (%)", humStats.avg, humStats.min, humStats.max],
            ["Moisture (%)", moistStats.avg, moistStats.min, moistStats.max],
            ["Ammonia (ppm)", ammStats.avg, ammStats.min, ammStats.max],
        ];

        const colWidths = [50, 35, 35, 35];
        const startX = 25;

        summaryData.forEach((row, rowIndex) => {
            let x = startX;
            row.forEach((cell, colIndex) => {
                if (rowIndex === 0) {
                    doc.setFont("helvetica", "bold");
                    doc.setFillColor(240, 240, 240);
                    doc.rect(x - 2, y - 4, colWidths[colIndex], 7, "F");
                } else {
                    doc.setFont("helvetica", "normal");
                }
                doc.text(String(cell), x, y);
                x += colWidths[colIndex];
            });
            y += 8;
        });

        y += 10;
        doc.setDrawColor(200);
        doc.line(20, y, pageWidth - 20, y);
        y += 10;

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Daily Averages", 20, y);
        y += 10;

        doc.setFontSize(9);
        const dailyHeaders = ["Date", "Temp (°C)", "Humidity (%)", "Moisture (%)", "Ammonia (ppm)"];
        const dailyColWidths = [35, 30, 35, 35, 35];

        let x = startX;
        doc.setFont("helvetica", "bold");
        doc.setFillColor(240, 240, 240);
        doc.rect(startX - 2, y - 4, dailyColWidths.reduce((a, b) => a + b, 0), 7, "F");
        dailyHeaders.forEach((header, i) => {
            doc.text(header, x, y);
            x += dailyColWidths[i];
        });
        y += 8;

        doc.setFont("helvetica", "normal");
        dailyAverages.forEach((day) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }

            x = startX;
            const rowData = [
                day.date,
                day.temperature.count > 0 ? day.temperature.avg.toString() : "-",
                day.humidity.count > 0 ? day.humidity.avg.toString() : "-",
                day.moisture.count > 0 ? day.moisture.avg.toString() : "-",
                day.ammonia.count > 0 ? day.ammonia.avg.toString() : "-",
            ];

            rowData.forEach((cell, i) => {
                doc.text(cell, x, y);
                x += dailyColWidths[i];
            });
            y += 6;
        });

        y += 10;
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("Black Soldier Fly IoT Monitoring System", pageWidth / 2, 285, { align: "center" });

        return doc;
    };

    const handlePDFReport = async () => {
        if (!currentDevice) {
            present({ message: "Please select a device first", duration: 2000, color: "warning" });
            return;
        }

        setLoading(true);
        try {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            
            const token = await getToken();
            let url = `/api/sensors/device/${currentDevice._id}/history?from=${formatDateISO(weekAgo)}&to=${formatDateISO(today)}`;
            if (selectedDrawer !== "all") {
                url += `&drawer=${encodeURIComponent(selectedDrawer)}`;
            }
            const { data } = await api.get(url, withToken(token));

            if (!data || data.length === 0) {
                present({ message: "No sensor data found for the last 7 days", duration: 2000, color: "warning" });
                return;
            }

            const doc = generatePDFReport(data, weekAgo);
            const deviceName = currentDevice.name.replace(/[^a-z0-9]/gi, "_");
            const drawerSuffix = selectedDrawer === "all" ? "" : `_${selectedDrawer.replace(/\s+/g, "")}`;
            const weekStr = formatDateISO(weekAgo);
            doc.save(`${deviceName}${drawerSuffix}_weekly_report_${weekStr}.pdf`);

            present({ message: "Weekly PDF report generated", duration: 2000, color: "success" });
        } catch (error: any) {
            present({ message: error.response?.data?.message || error.message || "Failed to generate report", duration: 2000, color: "danger" });
        } finally {
            setLoading(false);
        }
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
            const drawerSuffix = selectedDrawer === "all" ? "" : `_${selectedDrawer.replace(/\s+/g, "")}`;
            const dateStr = formatDateISO(selectedDate);

            if (format === "csv") {
                const csv = generateCSV(data);
                downloadFile(csv, `${deviceName}${drawerSuffix}_backup_${dateStr}.csv`, "text/csv");
            } else {
                const json = generateJSON(data);
                downloadFile(json, `${deviceName}${drawerSuffix}_backup_${dateStr}.json`, "application/json");
            }

            present({ message: `Backup exported as ${format.toUpperCase()}`, duration: 2000, color: "success" });
        } catch (error: any) {
            present({ message: error.message || "Failed to create backup", duration: 2000, color: "danger" });
        } finally {
            setLoading(false);
        }
    };

    const checkSdStatus = async () => {
        if (!espIp) {
            present({ message: "Please enter ESP32 IP address", duration: 2000, color: "warning" });
            return;
        }

        setSdLoading(true);
        try {
            const response = await fetch(`http://${espIp}/status`, { method: "GET" });
            const data = await response.json();
            setSdStatus({ storedCount: data.storedCount, sdAvailable: data.sdAvailable });
            present({ message: `Found ${data.storedCount} stored readings`, duration: 2000, color: "success" });
        } catch {
            present({ message: "Cannot connect to ESP32. Check IP and ensure you're on the same network.", duration: 3000, color: "danger" });
            setSdStatus(null);
        } finally {
            setSdLoading(false);
        }
    };

    const downloadSdData = async () => {
        if (!espIp) return;

        setSdLoading(true);
        try {
            const response = await fetch(`http://${espIp}/sdcard/data`);
            const data = await response.json();

            if (data.readings && data.readings.length > 0) {
                const content = JSON.stringify(data, null, 2);
                const blob = new Blob([content], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `esp32_offline_data_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                present({ message: `Downloaded ${data.readings.length} readings`, duration: 2000, color: "success" });
            } else {
                present({ message: "No offline data stored", duration: 2000, color: "warning" });
            }
        } catch {
            present({ message: "Failed to download data", duration: 2000, color: "danger" });
        } finally {
            setSdLoading(false);
        }
    };

    const syncSdToCloud = async () => {
        if (!espIp) return;

        setSdLoading(true);
        try {
            const response = await fetch(`http://${espIp}/sdcard/sync`, { method: "POST" });
            const data = await response.json();
            present({ message: `Uploaded ${data.uploaded} readings to cloud`, duration: 2000, color: "success" });
            setSdStatus(prev => prev ? { ...prev, storedCount: data.remaining } : null);
        } catch {
            present({ message: "Failed to sync data", duration: 2000, color: "danger" });
        } finally {
            setSdLoading(false);
        }
    };

    const clearSdData = async () => {
        if (!espIp) return;

        setSdLoading(true);
        try {
            const response = await fetch(`http://${espIp}/sdcard/clear`, { method: "POST" });
            await response.json();
            present({ message: "SD card data cleared", duration: 2000, color: "success" });
            setSdStatus(prev => prev ? { ...prev, storedCount: 0 } : null);
        } catch {
            present({ message: "Failed to clear data", duration: 2000, color: "danger" });
        } finally {
            setSdLoading(false);
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
                                className="subtitle-icon"
                            />
                            Select Backup Date
                        </IonCardSubtitle>
                        <IonCardTitle className="ion-text-center ion-padding-top">
                            <IonText color="primary">
                                <h1 className="date-title">
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
                        >
                            <IonLabel slot="start" color="medium">
                                Today
                            </IonLabel>
                            <IonLabel slot="end" color="medium">
                                30 days
                            </IonLabel>
                        </IonRange>

                        <div className="date-range-labels">
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
                                icon={layersOutline}
                                className="subtitle-icon"
                            />
                            Select Drawer
                        </IonCardSubtitle>
                    </IonCardHeader>

                    <IonCardContent>
                        <IonSegment value={selectedDrawer} onIonChange={(e) => setSelectedDrawer(e.detail.value as string)}>
                            {drawerOptions.map((drawer) => (
                                <IonSegmentButton key={drawer} value={drawer}>
                                    <IonLabel>{drawer === "all" ? "All" : drawer.replace("Drawer ", "D")}</IonLabel>
                                </IonSegmentButton>
                            ))}
                        </IonSegment>
                    </IonCardContent>
                </IonCard>

                <IonCard className="ion-margin">
                    <IonCardHeader>
                        <IonCardSubtitle>
                            <IonIcon
                                icon={cloudUpload}
                                className="subtitle-icon"
                            />
                            Export Options
                        </IonCardSubtitle>
                        <IonCardTitle>Backup & Reports</IonCardTitle>
                    </IonCardHeader>

                    <IonCardContent>
                        <IonText color="medium">
                            <p className="export-description">
                                Export sensor data from{" "}
                                <strong>{formatDate(selectedDate)}</strong> to today
                                {selectedDrawer !== "all" && <> for <strong>{selectedDrawer}</strong></>}.
                            </p>
                        </IonText>

                        <div className="export-buttons">
                            <IonButton
                                expand="block"
                                onClick={handlePDFReport}
                                size="large"
                                disabled={loading || !currentDevice}
                                color="danger"
                                className="export-btn"
                            >
                                {loading ? (
                                    <IonSpinner name="crescent" />
                                ) : (
                                    <>
                                        <IonIcon
                                            icon={documentTextOutline}
                                            slot="start"
                                        />
                                        Weekly PDF Report
                                    </>
                                )}
                            </IonButton>

                            <IonButton
                                expand="block"
                                onClick={() => handleBackup("csv")}
                                size="large"
                                disabled={loading || !currentDevice}
                                className="export-btn export-btn-csv"
                            >
                                {loading ? (
                                    <IonSpinner name="crescent" />
                                ) : (
                                    <>
                                        <IonIcon
                                            icon={downloadOutline}
                                            slot="start"
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
                                className="export-btn"
                            >
                                {loading ? (
                                    <IonSpinner name="crescent" />
                                ) : (
                                    <>
                                        <IonIcon
                                            icon={documentOutline}
                                            slot="start"
                                        />
                                        Export as JSON
                                    </>
                                )}
                            </IonButton>
                        </div>

                        {!currentDevice && (
                            <IonText color="warning" className="ion-text-center">
                                <p className="no-device-warning">
                                    Please select a device in Devices to export data.
                                </p>
                            </IonText>
                        )}
                    </IonCardContent>
                </IonCard>

                <IonCard className="ion-margin">
                    <IonCardHeader>
                        <IonCardSubtitle>
                            <IonIcon
                                icon={hardwareChipOutline}
                                className="subtitle-icon"
                            />
                            ESP32 SD Card
                        </IonCardSubtitle>
                        <IonCardTitle>Extract Offline Data</IonCardTitle>
                    </IonCardHeader>

                    <IonCardContent>
                        <IonText color="medium">
                            <p className="export-description">
                                Connect to your ESP32 directly to extract data stored while offline.
                                Make sure your phone is on the same WiFi network as the ESP32.
                            </p>
                        </IonText>

                        <IonItem className="ion-margin-top">
                            <IonInput
                                label="ESP32 IP Address"
                                labelPlacement="stacked"
                                placeholder="e.g., 192.168.1.100"
                                value={espIp}
                                onIonInput={(e) => setEspIp(e.detail.value || "")}
                            />
                            <IonButton
                                slot="end"
                                fill="clear"
                                onClick={checkSdStatus}
                                disabled={sdLoading || !espIp}
                            >
                                {sdLoading ? <IonSpinner name="crescent" /> : "Connect"}
                            </IonButton>
                        </IonItem>

                        {sdStatus && (
                            <div className="sd-status ion-margin-top">
                                <IonChip color={sdStatus.sdAvailable ? "success" : "danger"}>
                                    <IonLabel>SD Card: {sdStatus.sdAvailable ? "Available" : "Not Found"}</IonLabel>
                                </IonChip>
                                <IonChip color={sdStatus.storedCount > 0 ? "warning" : "medium"}>
                                    <IonLabel>{sdStatus.storedCount} Stored Readings</IonLabel>
                                </IonChip>
                            </div>
                        )}

                        <div className="export-buttons">
                            <IonButton
                                expand="block"
                                onClick={syncSdToCloud}
                                size="large"
                                disabled={sdLoading || !espIp || !sdStatus?.sdAvailable}
                                color="success"
                                className="export-btn"
                            >
                                {sdLoading ? (
                                    <IonSpinner name="crescent" />
                                ) : (
                                    <>
                                        <IonIcon icon={syncOutline} slot="start" />
                                        Sync to Cloud
                                    </>
                                )}
                            </IonButton>

                            <IonButton
                                expand="block"
                                onClick={downloadSdData}
                                size="large"
                                disabled={sdLoading || !espIp || !sdStatus?.sdAvailable}
                                className="export-btn"
                            >
                                {sdLoading ? (
                                    <IonSpinner name="crescent" />
                                ) : (
                                    <>
                                        <IonIcon icon={cloudDownloadOutline} slot="start" />
                                        Download JSON
                                    </>
                                )}
                            </IonButton>

                            <IonButton
                                expand="block"
                                onClick={clearSdData}
                                size="large"
                                disabled={sdLoading || !espIp || !sdStatus?.sdAvailable}
                                color="danger"
                                className="export-btn"
                            >
                                {sdLoading ? (
                                    <IonSpinner name="crescent" />
                                ) : (
                                    <>
                                        <IonIcon icon={trashOutline} slot="start" />
                                        Clear SD Data
                                    </>
                                )}
                            </IonButton>
                        </div>
                    </IonCardContent>
                </IonCard>
            </IonContent>
        </IonPage>
    );
};

export default Backup;
