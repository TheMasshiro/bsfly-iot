import { Capacitor } from "@capacitor/core";
import { IonAlert, IonButton, IonIcon, IonLabel, IonRange, IonSpinner, useIonToast } from "@ionic/react";
import { calendarOutline, timeOutline, documentOutline, documentTextOutline, downloadOutline, hardwareChipOutline, cloudDownloadOutline, syncOutline, trashOutline } from "ionicons/icons";
import { FC, useState, useMemo, useEffect } from "react";
import Card from "../../components/ui/Card";
import Metric from "../../components/ui/Metric";
import Page from "../../components/ui/Page";
import StatusPill from "../../components/ui/StatusPill";
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

interface AdminCreds {
    username: string;
    password: string;
}

const encodeBasic = (creds: AdminCreds): string => {
    const bytes = new TextEncoder().encode(creds.username + ":" + creds.password);
    let binary = "";
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return "Basic " + btoa(binary);
};

const Backup: FC = () => {
    const [daysAgo, setDaysAgo] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [sdLoading, setSdLoading] = useState(false);
    const [present] = useIonToast();
    const { currentDevice, getToken } = useDevice();
    const [sdStatus, setSdStatus] = useState<{ storedCount: number; sdAvailable: boolean } | null>(null);
    const [resolvedIp, setResolvedIp] = useState<string>(currentDevice?.ipAddress || "");
    const isNative = Capacitor.isNativePlatform();
    const [adminCreds, setAdminCreds] = useState<AdminCreds | null>(null);
    const [authAction, setAuthAction] = useState<((creds: AdminCreds) => Promise<void>) | null>(null);
    const [showAuthAlert, setShowAuthAlert] = useState(false);

    const runWithAdmin = (action: (creds: AdminCreds) => Promise<void>) => {
        if (adminCreds) {
            void action(adminCreds);
            return;
        }
        setAuthAction(() => action);
        setShowAuthAlert(true);
    };

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
        const csvEscape = (value: string | number): string => {
            const text = String(value);
            return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        };

        const groups = new Map<string, Array<string>>();
        data.forEach((day) => {
            const drawer = day.drawerId;
            if (!groups.has(drawer)) groups.set(drawer, []);
            day.readings.forEach((reading) => {
                const date = new Date(reading.timestamp);
                const row = [
                    drawer,
                    formatTimestamp24(date),
                    reading.temperature ?? "",
                    reading.humidity ?? "",
                    reading.moisture ?? "",
                    reading.ammonia ?? "",
                ];
                groups.get(drawer)!.push(row.map(csvEscape).join(","));
            });
        });

        const drawerOrder: Array<"Drawer 1" | "Drawer 2"> = ["Drawer 1", "Drawer 2"];
        const outRows: string[] = [headers.join(",")];

        drawerOrder.forEach((drawer) => {
            const group = groups.get(drawer) || [];
            group.sort((a, b) => {
                const ta = a.split(",")[1];
                const tb = b.split(",")[1];
                return ta.localeCompare(tb);
            });

            if (group.length > 0) {
                outRows.push(`"${drawer} Raw Readings"`);
                outRows.push(...group);
            }
        });

        return outRows.join("\n");
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

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 16;
        const startX = margin;
        const headers = ["Timestamp", "Temp (°C)", "Humidity (%)", "Moisture (%)", "Ammonia (ppm)"];
        const widths = [48, 28, 28, 28, 28];
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
        doc.text("Raw sensor readings are grouped by drawer and listed in timestamp order.", startX, y, { maxWidth: pageWidth - margin * 2 });
        y += 10;

        const drawerOrder: Array<"Drawer 1" | "Drawer 2"> = ["Drawer 1", "Drawer 2"];

        drawerOrder.forEach((drawerName) => {
            const drawerRows = rows.filter((r) => r.drawerId === drawerName);
            if (drawerRows.length === 0) return;

            drawerRows.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            if (y > pageHeight - 30) {
                doc.addPage();
                y = 20;
            }
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text(drawerName, startX, y);
            y += 8;

            drawHeader();

            drawerRows.forEach((row) => {
                drawRow([
                    formatTimestamp24(new Date(row.timestamp)),
                    row.temperature !== undefined && row.temperature !== null ? String(row.temperature) : "",
                    row.humidity !== undefined && row.humidity !== null ? String(row.humidity) : "",
                    row.moisture !== undefined && row.moisture !== null ? String(row.moisture) : "",
                    row.ammonia !== undefined && row.ammonia !== null ? String(row.ammonia) : "",
                ]);
            });

            y += 6;
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

    const clearSdData = async (creds: AdminCreds) => {
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
            const response = await fetch(`http://${deviceIp}/sdcard/clear`, { method: "POST", headers: { Authorization: encodeBasic(creds) } });
            if (response.status === 401) {
                setAdminCreds(null);
                throw new Error("Wrong device login");
            }
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
        <Page
            className="backup-page"
            title="Export data"
            subtitle="Download sensor history and reports for the selected device."
        >
            <div className="backup-layout">
                <Card title="Device" className="backup-device">
                    {currentDevice ? (
                        <div className="backup-device-body">
                            <div>
                                <p className="backup-device-name">{currentDevice.name || "Selected device"}</p>
                                <p className="backup-device-mac mono">{currentDevice.macAddress || currentDevice._id}</p>
                            </div>
                            {currentDevice.status === "online" ? (
                                <StatusPill status="ok">Online</StatusPill>
                            ) : (
                                <StatusPill status="crit">Offline</StatusPill>
                            )}
                            <p className="card-help">
                                {resolvedIp ? (
                                    <>Cached IP <span className="mono">{resolvedIp}</span></>
                                ) : (
                                    "No cached IP yet. The ESP32 must report its IP before offline data can be extracted."
                                )}
                            </p>
                        </div>
                    ) : (
                        <div className="backup-device-body">
                            <p className="card-help">No device selected.</p>
                            <IonButton expand="block" fill="outline" routerLink="/devices">
                                Choose a device
                            </IonButton>
                        </div>
                    )}
                </Card>

                <Card title="Export" className="backup-export">
                    <div className="range">
                        <div className="range-head">
                            <p className="range-title">From {formatDate(selectedDate)} to today</p>
                            <StatusPill status="idle" plain>{selectedRangeLabel}</StatusPill>
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
                            <IonLabel slot="start" color="medium">Today</IonLabel>
                            <IonLabel slot="end" color="medium">30 days</IonLabel>
                        </IonRange>
                    </div>

                    <div className="metric-pair">
                        <Metric
                            label="Days selected"
                            icon={calendarOutline}
                            value={daysAgo + 1}
                            digits={0}
                            unit={daysAgo === 0 ? "day" : "days"}
                            hint={`From ${formatDate(selectedDate)}`}
                        />
                        <Metric
                            label="Sample interval"
                            icon={timeOutline}
                            value={5}
                            digits={0}
                            unit="s"
                            hint="Raw CSV keeps every sample"
                        />
                    </div>

                    <div className="export-section">
                        <p className="card-help">
                            CSV has every raw reading with its timestamp. PDF reports summarize each day.
                        </p>
                        <div className="export-actions">
                            <IonButton expand="block" size="large" onClick={handleBackup} disabled={loading || !currentDevice}>
                                {loading ? (
                                    <IonSpinner name="crescent" />
                                ) : (
                                    <>
                                        <IonIcon icon={downloadOutline} slot="start" />
                                        Export CSV
                                    </>
                                )}
                            </IonButton>
                            <IonButton
                                expand="block"
                                size="large"
                                fill="outline"
                                onClick={handlePDFReport}
                                disabled={loading || !currentDevice}
                            >
                                {loading ? (
                                    <IonSpinner name="crescent" />
                                ) : (
                                    <>
                                        <IonIcon icon={documentTextOutline} slot="start" />
                                        PDF report
                                    </>
                                )}
                            </IonButton>
                        </div>

                        <div className="export-more">
                            <p className="more-label">More reports</p>
                            <div className="export-actions">
                                <IonButton expand="block" fill="outline" onClick={handleRawPDFReport} disabled={loading || !currentDevice}>
                                    {loading ? (
                                        <IonSpinner name="crescent" />
                                    ) : (
                                        <>
                                            <IonIcon icon={documentOutline} slot="start" />
                                            Raw PDF
                                        </>
                                    )}
                                </IonButton>
                                <IonButton expand="block" fill="outline" onClick={handleActuatorReport} disabled={loading || !currentDevice}>
                                    {loading ? (
                                        <IonSpinner name="crescent" />
                                    ) : (
                                        <>
                                            <IonIcon icon={hardwareChipOutline} slot="start" />
                                            Actuator PDF
                                        </>
                                    )}
                                </IonButton>
                            </div>
                        </div>

                        {!currentDevice && <p className="card-help warn">Please select a device in Devices to export data.</p>}
                    </div>
                </Card>

                {isNative ? (
                    <Card title="Device storage" className="backup-storage">
                        <p className="card-help">
                            Connect to your ESP32 directly to extract data stored while offline.
                            Make sure your phone is on the same WiFi network as the ESP32.
                        </p>
                        <p className="card-help">
                            {resolvedIp ? (
                                <>Using cached IP <span className="mono">{resolvedIp}</span> from the selected device.</>
                            ) : (
                                "This device has no cached IP yet. The ESP32 must report its IP before offline data can be extracted."
                            )}
                        </p>

                        {sdStatus && (
                            <div className="sd-status">
                                <StatusPill status={sdStatus.sdAvailable ? "ok" : "crit"}>
                                    {sdStatus.sdAvailable ? "SD card available" : "SD card not found"}
                                </StatusPill>
                                <StatusPill status={sdStatus.storedCount > 0 ? "warn" : "idle"}>
                                    {sdStatus.storedCount} stored {sdStatus.storedCount === 1 ? "reading" : "readings"}
                                </StatusPill>
                            </div>
                        )}

                        <div className="export-actions">
                            <IonButton
                                expand="block"
                                onClick={syncSdToCloud}
                                disabled={sdLoading || !resolvedIp || !sdStatus?.sdAvailable || currentDevice?.status === "offline"}
                            >
                                {sdLoading ? (
                                    <IonSpinner name="crescent" />
                                ) : (
                                    <>
                                        <IonIcon icon={syncOutline} slot="start" />
                                        Sync to cloud
                                    </>
                                )}
                            </IonButton>

                            <IonButton
                                expand="block"
                                fill="outline"
                                onClick={downloadSdData}
                                disabled={sdLoading || !resolvedIp || !sdStatus?.sdAvailable || currentDevice?.status === "offline"}
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
                                color="danger"
                                fill="outline"
                                onClick={() => runWithAdmin(clearSdData)}
                                disabled={sdLoading || !resolvedIp || !sdStatus?.sdAvailable || currentDevice?.status === "offline"}
                            >
                                {sdLoading ? (
                                    <IonSpinner name="crescent" />
                                ) : (
                                    <>
                                        <IonIcon icon={trashOutline} slot="start" />
                                        Clear SD data
                                    </>
                                )}
                            </IonButton>
                        </div>
                    </Card>
                ) : (
                    <p className="card-help backup-hint">Device storage tools are available in the Android app.</p>
                )}
            </div>

            <IonAlert
                isOpen={showAuthAlert}
                onDidDismiss={() => setShowAuthAlert(false)}
                header="Device admin login"
                message="Required to clear the SD card. Forgotten when you leave this page."
                inputs={[
                    { name: "username", type: "text", placeholder: "Username" },
                    { name: "password", type: "password", placeholder: "Password" }
                ]}
                buttons={[
                    { text: "Cancel", role: "cancel", handler: () => setAuthAction(null) },
                    {
                        text: "Continue",
                        handler: (values) => {
                            const creds = { username: String(values.username ?? ""), password: String(values.password ?? "") };
                            if (!creds.username || !creds.password) return false;
                            const action = authAction;
                            setAdminCreds(creds);
                            setAuthAction(null);
                            if (action) void action(creds);
                            return true;
                        }
                    }
                ]}
            />
        </Page>
    );
};

export default Backup;
