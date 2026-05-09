import express from "express";
import Device from "../models/User.Device.js";
import ActuatorEvent from "../models/ActuatorEvent.js";
import { requireAuth } from "../middleware/auth.js";
import PDFDocument from "pdfkit";

const router = express.Router();

// GET /api/reports/actuators?deviceId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/actuators", requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { deviceId, from, to } = req.query;

    if (!deviceId) return res.status(400).json({ error: "deviceId is required" });

    const device = await Device.findById(deviceId);
    if (!device) return res.status(404).json({ error: "Device not found" });

    const isMember = device.members.some((m) => m.userId === userId);
    if (!isMember) return res.status(403).json({ error: "Access denied" });

    const fromDate = from ? new Date(String(from)) : new Date(0);
    let toDate = to ? new Date(String(to)) : new Date();
    // Include full day when date-only provided
    toDate.setHours(23, 59, 59, 999);

    const events = await ActuatorEvent.find({
      deviceId: device._id,
      timestamp: { $gte: fromDate, $lte: toDate },
    }).sort({ timestamp: 1 });

    // Stream PDF
    res.setHeader("Content-Type", "application/pdf");
    const filename = `${device.name || device._id}_actuator_report_${from || "all"}_to_${to || "now"}.pdf`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/\s+/g, "_")}"`);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    doc.pipe(res);

    doc.fontSize(16).text("Actuator Events Report", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Device: ${device.name || device._id}`);
    doc.text(`Period: ${fromDate.toISOString()} - ${toDate.toISOString()}`);
    doc.moveDown(0.5);

    // Table header
    const tableTop = doc.y + 8;
    const colWidths = [120, 120, 120, 150];
    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("Time", { continued: true, width: colWidths[0] });
    doc.text("Parameter", { continued: true, width: colWidths[1] });
    doc.text("Value", { continued: true, width: colWidths[2] });
    doc.text("Actuator/Drawer", { width: colWidths[3] });
    doc.moveDown(0.5);
    doc.font("Helvetica");

    for (const ev of events) {
      const time = ev.timestamp.toISOString();
      const param = ev.parameter || "";
      const value = typeof ev.value === "object" ? JSON.stringify(ev.value) : String(ev.value);
      const act = `${ev.actuator}${ev.drawer ? " • " + ev.drawer : ""}`;

      doc.text(time, { continued: true, width: colWidths[0] });
      doc.text(param, { continued: true, width: colWidths[1] });
      doc.text(value, { continued: true, width: colWidths[2] });
      doc.text(act, { width: colWidths[3] });

      // Add page break if close to bottom
      if (doc.y > doc.page.height - 80) doc.addPage();
    }

    doc.end();
  } catch (error) {
    console.error("Failed to generate actuator report", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

export default router;
