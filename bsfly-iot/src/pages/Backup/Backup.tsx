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
    IonItem,
    IonLabel,
    IonPage,
    IonRange,
    IonText,
    IonSpinner,
    IonToolbar,
    IonTitle,
    useIonToast,
} from "@ionic/react";
import { calendarOutline, cloudUpload, timeOutline, documentOutline, downloadOutline, documentTextOutline, hardwareChipOutline, cloudDownloadOutline, syncOutline, trashOutline } from "ionicons/icons";
import { FC, useState, useMemo, useEffect } from "react";
import Toolbar from "../../components/Toolbar/Toolbar";
import PagePurpose from "../../components/PagePurpose/PagePurpose";
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

interface RawReadingRow {
    drawerId: string;
    timestamp: string;
    temperature?: number;
    humidity?: number;
    moisture?: number;
    ammonia?: number;
}

const Backup: FC = () => {
    const [daysAgo, setDaysAgo] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [sdLoading, setSdLoading] = useState(false);
    const [present] = useIonToast();
    const { currentDevice, getToken } = useDevice();
    const [sdStatus, setSdStatus] = useState<{ storedCount: number; sdAvailable: boolean } | null>(null);
    const [resolvedIp, setResolvedIp] = useState<string>(currentDevice?.ipAddress || "");

    const resolveDeviceIp = async (): Promise<string | null> => {
        if (currentDevice?.ipAddress) {
            setResolvedIp(currentDevice.ipAddress);
            return currentDevice.ipAddress;
        }

        if (!currentDevice?._id) {
            return null;
        }

        const token = await getToken();
        const { data } = await api.get(
            `/api/devices/${currentDevice._id}`,
            withToken(token)
        );

        if (data?.ipAddress) {
            setResolvedIp(data.ipAddress);
            return data.ipAddress;
        }

        return null;
    };

    useEffect(() => {
        if (!currentDevice?._id) {
            setResolvedIp("");
            setSdStatus(null);
            return;
        }

        void resolveDeviceIp();
    }, [currentDevice?._id]);

    const today = new Date();

    const selectedDate = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        return date;
    }, [daysAgo]);

    const selectedRangeLabel = useMemo(() => {
        if (daysAgo === 0) return "Today only";
        return `Last ${daysAgo} day${daysAgo > 1 ? "s" : ""}`;
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
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    };

    const formatTimestamp24 = (date: Date): string => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        const h = String(date.getHours()).padStart(2, "0");
        const min = String(date.getMinutes()).padStart(2, "0");
        const s = String(date.getSeconds()).padStart(2, "0");
        return `${y}-${m}-${d} ${h}:${min}:${s}`;
    };

    const fetchSensorHistory = async (): Promise<DayReading[]> => {
        if (!currentDevice) {
            throw new Error("No device selected");
        }

        const token = await getToken();
        const { data } = await api.get(
            `/api/sensors/device/${currentDevice._id}/history?from=${formatDateISO(selectedDate)}&to=${formatDateISO(today)}`,
            withToken(token)
        );

        return data;
    };

    const generateCSV = (data: DayReading[]): string => {
        const headers = ["Drawer", "Timestamp", "Temperature (°C)", "Humidity (%)", "Moisture (%)", "Ammonia (ppm)"];
        const rows: string[] = [headers.join(",")];
        const csvEscape = (value: string | number): string => {
            const text = String(value);
            return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        };

        data.forEach((day) => {
            day.readings.forEach((reading) => {
                const date = new Date(reading.timestamp);
                const row = [
                    day.drawerId,
                    formatTimestamp24(date),
                    reading.temperature ?? "",
                    reading.humidity ?? "",
                    reading.moisture ?? "",
                    reading.ammonia ?? "",
                ];
                rows.push(row.map(csvEscape).join(","));
            });
        });

        return rows.join("\n");
    };

    interface MetricStats {
        avg: number | null;
        min: number | null;
        max: number | null;
        count: number;
    }

    interface DailyAverage {
        date: string;
        drawer: string;
        readings: number;
        temperature: MetricStats;
        humidity: MetricStats;
        moisture: MetricStats;
        ammonia: MetricStats;
    }

    interface HourlyAverage extends DailyAverage {
        hour: string;
    }

    const formatStatValue = (value: number | null, forceInteger = false): string => {
        if (value === null) return "-";
        if (forceInteger) return Math.round(value).toString();
        return Number.isInteger(value) ? value.toString() : value.toFixed(2);
    };

    const calculateStats = (arr: number[]): MetricStats => {
        if (arr.length === 0) return { avg: null, min: null, max: null, count: 0 };
        const sum = arr.reduce((a, b) => a + b, 0);
            return {
            avg: Math.round((sum / arr.length) * 100) / 100,
            min: Math.round(Math.min(...arr) * 100) / 100,
            max: Math.round(Math.max(...arr) * 100) / 100,
            count: arr.length,
        };
    };

    const calculateDailyAverages = (data: DayReading[]): DailyAverage[] => {
        const dailyMap = new Map<string, {
            temp: number[]; hum: number[]; moist: number[]; amm: number[]; readings: number;
        }>();

        data.forEach((day) => {
            day.readings.forEach((reading) => {
                const dateKey = formatDateISO(new Date(reading.timestamp));
                const key = `${day.drawerId}|${dateKey}`;
                if (!dailyMap.has(key)) {
                    dailyMap.set(key, { temp: [], hum: [], moist: [], amm: [], readings: 0 });
                }
                const entry = dailyMap.get(key)!;
                entry.readings += 1;
                if (reading.temperature !== undefined) entry.temp.push(reading.temperature);
                if (reading.humidity !== undefined) entry.hum.push(reading.humidity);
                if (reading.moisture !== undefined) entry.moist.push(reading.moisture);
                if (reading.ammonia !== undefined) entry.amm.push(reading.ammonia);
            });
        });

        return Array.from(dailyMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, values]) => {
                const [drawer, date] = key.split('|');
                return {
                    date,
                    drawer,
                    readings: values.readings,
                    temperature: calculateStats(values.temp),
                    humidity: calculateStats(values.hum),
                    moisture: calculateStats(values.moist),
                    ammonia: calculateStats(values.amm),
                };
            });
    };

    const calculateHourlyAverages = (data: DayReading[]): HourlyAverage[] => {
        const hourlyMap = new Map<string, {
            temp: number[]; hum: number[]; moist: number[]; amm: number[]; readings: number;
        }>();

        data.forEach((day) => {
            day.readings.forEach((reading) => {
                const timestamp = new Date(reading.timestamp);
                const dateKey = formatDateISO(timestamp);
                const hourKey = `${String(timestamp.getHours()).padStart(2, "0")}:00`;
                const key = `${day.drawerId}|${dateKey}|${hourKey}`;

                if (!hourlyMap.has(key)) {
                    hourlyMap.set(key, { temp: [], hum: [], moist: [], amm: [], readings: 0 });
                }

                const entry = hourlyMap.get(key)!;
                entry.readings += 1;
                if (reading.temperature !== undefined) entry.temp.push(reading.temperature);
                if (reading.humidity !== undefined) entry.hum.push(reading.humidity);
                if (reading.moisture !== undefined) entry.moist.push(reading.moisture);
                if (reading.ammonia !== undefined) entry.amm.push(reading.ammonia);
            });
        });

        return Array.from(hourlyMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, values]) => {
                const [drawer, date, hour] = key.split('|');
                return {
                    drawer,
                    date,
                    hour,
                    readings: values.readings,
                    temperature: calculateStats(values.temp),
                    humidity: calculateStats(values.hum),
                    moisture: calculateStats(values.moist),
                    ammonia: calculateStats(values.amm),
                };
            });
    };

    const generatePDFReport = (data: DayReading[], startDate: Date, JsPdfCtor: any) => {
        const doc = new JsPdfCtor();
        const dailyAverages = calculateDailyAverages(data);
        const hourlyAverages = calculateHourlyAverages(data);
        const uniqueDays = new Set(dailyAverages.map((entry) => entry.date)).size;
        const drawersPresent = Array.from(new Set(dailyAverages.map((entry) => entry.drawer))).sort();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 16;
        let y = 20;

        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.text("BSF Sensor Report", pageWidth / 2, y, { align: "center" });
        y += 10;

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text(`Device: ${currentDevice?.name || "Unknown"}`, pageWidth / 2, y, { align: "center" });
        y += 6;
        doc.text(`Period: ${formatDate(startDate)} - ${formatDate(today)}`, pageWidth / 2, y, { align: "center" });
        y += 6;
        doc.text(`Generated: ${new Date().toLocaleString("en-US", { hour12: false })}`, pageWidth / 2, y, { align: "center" });
        y += 15;

        doc.setDrawColor(200);
        doc.line(20, y, pageWidth - 20, y);
        y += 10;

        doc.setTextColor(0);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Report Overview", 20, y);
        y += 8;

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60);
        const overviewLines = [
            `Drawers included: ${drawersPresent.length > 0 ? drawersPresent.join(", ") : "None"}`,
            `Days covered: ${uniqueDays}`,
            `Tables are separated by drawer for easier reading; hourly detail is added only for a single-day export.`,
        ];

        overviewLines.forEach((line) => {
            doc.text(line, 20, y);
            y += 5.5;
        });

        y += 4;
        doc.setDrawColor(200);
        doc.line(20, y, pageWidth - 20, y);
        y += 10;

        doc.setTextColor(0);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Daily Summary", 20, y);
        y += 10;

        const startX = margin;
        const dailyHeaders = ["Date", "Temperature (°C)", "Humidity (%)", "Substrate Moisture (%)", "Ammonia (ppm)"];
        const dailyWidths = [30, 34, 30, 44, 30];

        const drawSectionTitle = (title: string) => {
            if (y > pageHeight - 25) {
                doc.addPage();
                y = 20;
            }
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(30);
            doc.text(title, startX, y);
            y += 7;
            doc.setTextColor(0);
        };

        const drawTableHeader = (headers: string[], widths: number[]) => {
            if (y > pageHeight - 20) {
                doc.addPage();
                y = 20;
            }
            let headerX = startX;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setFillColor(240, 240, 240);
            doc.rect(startX - 2, y - 4, widths.reduce((a, b) => a + b, 0), 7, "F");
            headers.forEach((header, i) => {
                doc.text(header, headerX, y);
                headerX += widths[i];
            });
            y += 8;
            doc.setFont("helvetica", "normal");
        };

        const drawTableRow = (row: string[], widths: number[], rowHeight = 7) => {
            if (y > pageHeight - 20) {
                doc.addPage();
                y = 20;
                drawTableHeader(dailyHeaders, dailyWidths);
            }
            let x = startX;
            doc.setFontSize(8.5);
            row.forEach((cell, index) => {
                doc.text(String(cell), x, y);
                x += widths[index];
            });
            y += rowHeight;
        };

        const drawerOrder: Array<"Drawer 1" | "Drawer 2"> = ["Drawer 1", "Drawer 2"];

        drawerOrder.forEach((drawerName) => {
            const drawerRows = dailyAverages.filter((entry) => entry.drawer === drawerName);
            if (drawerRows.length === 0) return;

            drawSectionTitle(drawerName);
            drawTableHeader(dailyHeaders, dailyWidths);

            drawerRows.forEach((entry) => {
                drawTableRow([
                    entry.date,
                    formatStatValue(entry.temperature.avg),
                    formatStatValue(entry.humidity.avg),
                    formatStatValue(entry.moisture.avg, true),
                    formatStatValue(entry.ammonia.avg),
                ], dailyWidths);
            });

            y += 5;
        });

        if (uniqueDays === 1 && hourlyAverages.length > 0) {
            y += 8;
            doc.setDrawColor(200);
            doc.line(20, y, pageWidth - 20, y);
            y += 10;

            doc.setTextColor(0);
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text("Hourly Detail", 20, y);
            y += 8;

            doc.setFontSize(9);
            doc.setTextColor(60);
            doc.setFont("helvetica", "normal");
            doc.text("Hourly detail is shown only for a single-day export so the report stays readable.", 20, y);
            y += 8;

            const hourlyHeaders = ["Hour", "Temperature (°C)", "Humidity (%)", "Substrate Moisture (%)", "Ammonia (ppm)"];
            const hourlyWidths = [20, 34, 30, 44, 30];

            drawerOrder.forEach((drawerName) => {
                const drawerRows = hourlyAverages.filter((entry) => entry.drawer === drawerName);
                if (drawerRows.length === 0) return;

                drawSectionTitle(`${drawerName} - Hourly Detail`);
                drawTableHeader(hourlyHeaders, hourlyWidths);

                drawerRows.forEach((entry) => {
                    drawTableRow([
                        entry.hour,
                        formatStatValue(entry.temperature.avg),
                        formatStatValue(entry.humidity.avg),
                        formatStatValue(entry.moisture.avg, true),
                        formatStatValue(entry.ammonia.avg),
                    ], hourlyWidths, 6.5);
                });

                y += 5;
            });
        }

        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("Black Soldier Fly IoT Monitoring System", pageWidth / 2, pageHeight - 10, { align: "center" });

        return doc;
    };

    const generateRawPDFReport = (data: DayReading[], startDate: Date, JsPdfCtor: any) => {
        const doc = new JsPdfCtor();
        const rows: RawReadingRow[] = [];

        data.forEach((day) => {
            day.readings.forEach((reading) => {
                rows.push({
                    drawerId: day.drawerId,
                    timestamp: reading.timestamp,
                    temperature: reading.temperature,
                    humidity: reading.humidity,
                    moisture: reading.moisture,
                    ammonia: reading.ammonia,
                });
            });
        });

        rows.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 16;
        const startX = margin;
        const headers = ["Drawer", "Timestamp", "Temp (°C)", "Humidity (%)", "Moisture (%)", "Ammonia (ppm)"];
        const widths = [22, 44, 24, 26, 26, 26];
        let y = 20;

        const drawHeader = () => {
            if (y > pageHeight - 20) {
                doc.addPage();
                y = 20;
            }

            let headerX = startX;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setFillColor(240, 240, 240);
            doc.rect(startX - 2, y - 4, widths.reduce((a, b) => a + b, 0), 7, "F");
            headers.forEach((header, index) => {
                doc.text(header, headerX, y);
                headerX += widths[index];
            });
            y += 8;
            doc.setFont("helvetica", "normal");
        };

        const drawRow = (row: string[]) => {
            if (y > pageHeight - 20) {
                doc.addPage();
                y = 20;
                drawHeader();
            }

            let x = startX;
            doc.setFontSize(7.5);
            row.forEach((cell, index) => {
                doc.text(String(cell), x, y);
                x += widths[index];
            });
            y += 6;
        };

        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.text("BSF Sensor Raw Data", pageWidth / 2, y, { align: "center" });
        y += 10;

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text(`Device: ${currentDevice?.name || "Unknown"}`, pageWidth / 2, y, { align: "center" });
        y += 6;
        doc.text(`Period: ${formatDate(startDate)} - ${formatDate(today)}`, pageWidth / 2, y, { align: "center" });
        y += 6;
        doc.text(`Generated: ${new Date().toLocaleString("en-US", { hour12: false })}`, pageWidth / 2, y, { align: "center" });
        y += 10;

        doc.setTextColor(0);
        doc.setFontSize(9);
        doc.text("Raw sensor readings are listed in the order they were recorded, including 5-second interval samples.", startX, y, { maxWidth: pageWidth - margin * 2 });
        y += 10;

        drawHeader();

        rows.forEach((row) => {
            drawRow([
                row.drawerId,
                formatTimestamp24(new Date(row.timestamp)),
                row.temperature ?? "",
                row.humidity ?? "",
                row.moisture ?? "",
                row.ammonia ?? "",
            ]);
        });

        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("Black Soldier Fly IoT Monitoring System", pageWidth / 2, pageHeight - 10, { align: "center" });

        return doc;
    };

    const handlePDFReport = async () => {
        if (!currentDevice) {
            present({ message: "Please select a device first", duration: 2000, color: "warning" });
            return;
        }

        setLoading(true);
        try {
            const token = await getToken();
            const { data } = await api.get(
                `/api/sensors/device/${currentDevice._id}/history?from=${formatDateISO(selectedDate)}&to=${formatDateISO(today)}`,
                withToken(token)
            );

            if (!data || data.length === 0) {
                present({ message: "No sensor data found for the selected range", duration: 2000, color: "warning" });
                return;
            }

            const { jsPDF } = await import("jspdf");
            const doc = generatePDFReport(data, selectedDate, jsPDF);
            const deviceName = currentDevice.name.replace(/[^a-z0-9]/gi, "_");
            const fromStr = formatDateISO(selectedDate);
            const toStr = formatDateISO(today);
            doc.save(`${deviceName}_report_${fromStr}_to_${toStr}.pdf`);

            present({ message: "PDF report generated", duration: 2000, color: "success" });
        } catch (error: any) {
            present({ message: error.response?.data?.message || error.message || "Failed to generate report", duration: 2000, color: "danger" });
        } finally {
            setLoading(false);
        }
    };

    const handleRawPDFReport = async () => {
        if (!currentDevice) {
            present({ message: "Please select a device first", duration: 2000, color: "warning" });
            return;
        }

        setLoading(true);
        try {
            const token = await getToken();
            const { data } = await api.get(
                `/api/sensors/device/${currentDevice._id}/history?from=${formatDateISO(selectedDate)}&to=${formatDateISO(today)}`,
                withToken(token)
            );

            if (!data || data.length === 0) {
                present({ message: "No sensor data found for the selected range", duration: 2000, color: "warning" });
                return;
            }

            const { jsPDF } = await import("jspdf");
            const doc = generateRawPDFReport(data, selectedDate, jsPDF);
            const deviceName = currentDevice.name.replace(/[^a-z0-9]/gi, "_");
            const fromStr = formatDateISO(selectedDate);
            const toStr = formatDateISO(today);
            doc.save(`${deviceName}_raw_${fromStr}_to_${toStr}.pdf`);

            present({ message: "Raw PDF generated", duration: 2000, color: "success" });
        } catch (error: any) {
            present({ message: error.response?.data?.message || error.message || "Failed to generate raw PDF", duration: 2000, color: "danger" });
        } finally {
            setLoading(false);
        }
    };

            const handleActuatorReport = async () => {
                if (!currentDevice) {
                    present({ message: "Please select a device first", duration: 2000, color: "warning" });
                    return;
                }

                setLoading(true);
                try {
                    const token = await getToken();
                    const resp = await api.get(
                        `/api/reports/actuators?deviceId=${currentDevice._id}&from=${formatDateISO(selectedDate)}&to=${formatDateISO(today)}`,
                        { ...withToken(token), responseType: 'blob' }
                    );

                    const blob = new Blob([resp.data], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${currentDevice.name.replace(/[^a-z0-9]/gi, '_')}_actuator_report_${formatDateISO(selectedDate)}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);

                    present({ message: 'Actuator PDF downloaded', duration: 2000, color: 'success' });
                } catch (error: any) {
                    present({ message: error.response?.data?.message || error.message || 'Failed to download actuator report', duration: 2000, color: 'danger' });
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

    const handleBackup = async () => {
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

            const csv = generateCSV(data);
            downloadFile(csv, `${deviceName}_backup_${dateStr}.csv`, "text/csv");

            present({ message: "Backup exported as CSV", duration: 2000, color: "success" });
        } catch (error: any) {
            present({ message: error.message || "Failed to create backup", duration: 2000, color: "danger" });
        } finally {
            setLoading(false);
        }
    };

    const checkSdStatus = async () => {
        if (currentDevice?.status === "offline") {
            present({
                message: "Device is offline - cannot access SD card",
                duration: 2500,
                color: "warning",
            });
            return;
        }

        const deviceIp = await resolveDeviceIp();

        if (!deviceIp) {
            present({
                message: "This device has no cached IP yet. Wait for a heartbeat or reconnect it first.",
                duration: 2500,
                color: "warning",
            });
            return;
        }

        setSdLoading(true);
        try {
            const response = await fetch(`http://${deviceIp}/status`, { method: "GET" });
            if (!response.ok) {
                throw new Error(`ESP32 status request failed (${response.status})`);
            }
            const data = await response.json();
            setSdStatus({ storedCount: data.storedCount, sdAvailable: data.sdAvailable });
            present({ message: `Found ${data.storedCount} stored readings`, duration: 2000, color: "success" });
        } catch (error: any) {
            present({ message: error.message || "Cannot connect to ESP32. Check IP and ensure you're on the same network.", duration: 3000, color: "danger" });
            setSdStatus(null);
        } finally {
            setSdLoading(false);
        }
    };

    const downloadSdData = async () => {
        if (currentDevice?.status === "offline") {
            present({
                message: "Device is offline - cannot download SD data",
                duration: 2500,
                color: "warning",
            });
            return;
        }

        const deviceIp = await resolveDeviceIp();
        if (!deviceIp) return;

        setSdLoading(true);
        try {
            const response = await fetch(`http://${deviceIp}/sdcard/data`);
            if (!response.ok) {
                throw new Error(`SD data download failed (${response.status})`);
            }
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
        } catch (error: any) {
            present({ message: error.message || "Failed to download data", duration: 2000, color: "danger" });
        } finally {
            setSdLoading(false);
        }
    };

    const syncSdToCloud = async () => {
        if (currentDevice?.status === "offline") {
            present({
                message: "Device is offline - cannot sync SD data",
                duration: 2500,
                color: "warning",
            });
            return;
        }

        const deviceIp = await resolveDeviceIp();
        if (!deviceIp) return;

        setSdLoading(true);
        try {
            const response = await fetch(`http://${deviceIp}/sdcard/sync`, { method: "POST" });
            if (!response.ok) {
                throw new Error(`SD sync failed (${response.status})`);
            }
            const data = await response.json();
            present({ message: `Uploaded ${data.uploaded} readings to cloud`, duration: 2000, color: "success" });
            setSdStatus(prev => prev ? { ...prev, storedCount: data.remaining } : null);
        } catch (error: any) {
            present({ message: error.message || "Failed to sync data", duration: 2000, color: "danger" });
        } finally {
            setSdLoading(false);
        }
    };

    const clearSdData = async () => {
        if (currentDevice?.status === "offline") {
            present({
                message: "Device is offline - cannot clear SD data",
                duration: 2500,
                color: "warning",
            });
            return;
        }

        const deviceIp = await resolveDeviceIp();
        if (!deviceIp) return;

        setSdLoading(true);
        try {
            const response = await fetch(`http://${deviceIp}/sdcard/clear`, { method: "POST" });
            if (!response.ok) {
                throw new Error(`SD clear failed (${response.status})`);
            }
            await response.json();
            present({ message: "SD card data cleared", duration: 2000, color: "success" });
            setSdStatus(prev => prev ? { ...prev, storedCount: 0 } : null);
        } catch (error: any) {
            present({ message: error.message || "Failed to clear data", duration: 2000, color: "danger" });
        } finally {
            setSdLoading(false);
        }
    };

    return (
        <IonPage className="backup-page">
            <IonHeader class="ion-no-border">
                <Toolbar />
            </IonHeader>

            <IonContent fullscreen>
                <IonHeader collapse="condense">
                    <IonToolbar>
                        <IonTitle size="large">Backup Data</IonTitle>
                    </IonToolbar>
                </IonHeader>
                <PagePurpose text="Export sensor history, generate reports, and retrieve offline records from the ESP32 SD card." />

                <IonCard className="ion-margin info-card">
                    <IonCardHeader>
                        <IonCardTitle>
                            <IonIcon
                                icon={hardwareChipOutline}
                                className="subtitle-icon"
                            />
                            Selected Device
                        </IonCardTitle>
                        <IonCardSubtitle>
                            Backup uses the currently selected device and its cached IP
                        </IonCardSubtitle>
                    </IonCardHeader>
                    <IonCardContent>
                        <div className="hardware-hints">
                            <IonChip color={currentDevice ? "success" : "warning"}>
                                <IonLabel>
                                    {currentDevice
                                        ? `${currentDevice.name || "Selected device"} • ${currentDevice.macAddress || currentDevice._id}`
                                        : "Select a device from the device menu to begin"}
                                </IonLabel>
                            </IonChip>
                            {currentDevice?.status === "offline" && (
                                <IonChip color="danger">
                                    <IonLabel>Device Offline</IonLabel>
                                </IonChip>
                            )}
                            <IonText color="medium">
                                <p>
                                    {resolvedIp
                                        ? `Using cached IP ${resolvedIp} from the selected device.`
                                        : "This device has no cached IP yet. The ESP32 must report its IP before offline data can be extracted."}
                                </p>
                            </IonText>
                        </div>
                    </IonCardContent>
                </IonCard>

                <IonCard className="ion-margin">
                    <IonCardHeader>
                        <IonCardSubtitle>
                            <IonIcon
                                icon={calendarOutline}
                                className="subtitle-icon"
                            />
                            Select Date Range
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
                                    {selectedRangeLabel}
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
                                <small>From: {formatDate(selectedDate)}</small>
                            </IonText>
                            <IonText color="medium">
                                <small>
                                    To: {formatDate(today)}
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
                                <strong>{formatDate(selectedDate)}</strong> to today.
                            </p>
                            <p className="export-description">
                                CSV exports raw readings with full timestamps, including the 5-second sensor samples.
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
                                        Generate PDF Report
                                    </>
                                )}
                            </IonButton>

                            <IonButton
                                expand="block"
                                onClick={handleRawPDFReport}
                                size="large"
                                disabled={loading || !currentDevice}
                                color="warning"
                                className="export-btn"
                            >
                                {loading ? (
                                    <IonSpinner name="crescent" />
                                ) : (
                                    <>
                                        <IonIcon icon={documentOutline} slot="start" />
                                        Export Raw PDF
                                    </>
                                )}
                            </IonButton>

                            <IonButton
                                expand="block"
                                onClick={handleActuatorReport}
                                size="large"
                                disabled={loading || !currentDevice}
                                color="tertiary"
                                className="export-btn"
                            >
                                {loading ? (
                                    <IonSpinner name="crescent" />
                                ) : (
                                    <>
                                        <IonIcon icon={hardwareChipOutline} slot="start" />
                                        Generate Actuator PDF
                                    </>
                                )}
                            </IonButton>

                            <IonButton
                                expand="block"
                                onClick={handleBackup}
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
                                        Export Raw CSV
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

                        <div className="sd-connect-row">
                            <IonText color="medium">
                                <p className="export-description">
                                    {resolvedIp
                                        ? `Using cached IP ${resolvedIp} from the selected device.`
                                        : "This device has no cached IP yet. The ESP32 must report its IP before offline data can be extracted."}
                                </p>
                            </IonText>
                        </div>

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
                                disabled={sdLoading || !resolvedIp || !sdStatus?.sdAvailable || currentDevice?.status === "offline"}
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
                                disabled={sdLoading || !resolvedIp || !sdStatus?.sdAvailable || currentDevice?.status === "offline"}
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
                                disabled={sdLoading || !resolvedIp || !sdStatus?.sdAvailable || currentDevice?.status === "offline"}
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
