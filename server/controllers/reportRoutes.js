import express from "express";
import Device from "../models/User.Device.js";
import ActuatorEvent from "../models/ActuatorEvent.js";
import { requireAuth } from "../middleware/auth.js";
import PDFDocument from "pdfkit";

const router = express.Router();

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

    res.setHeader("Content-Type", "application/pdf");
    const filename = `${device.name || device._id}_actuator_report_${from || "all"}_to_${to || "now"}.pdf`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/\s+/g, "_")}"`);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    doc.pipe(res);

    doc.fontSize(18).font("Helvetica-Bold").text("Actuator Events Report", { align: "center" });
    doc.moveDown(0.4);
    doc.fontSize(10).font("Helvetica").fillColor("#4b5563").text(`Device: ${device.name || device._id}`, { align: "center" });
    doc.text(`Period: ${fromDate.toLocaleString("en-US")} - ${toDate.toLocaleString("en-US")}`, { align: "center" });
    doc.text(`Generated: ${new Date().toLocaleString("en-US")}`, { align: "center" });
    doc.fillColor("black");
    doc.moveDown(0.7);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const startX = doc.page.margins.left;
    const headers = ["Data Time", "Parameter", "Value", "State", "Actuator"];
    const colWidths = [120, 90, 105, 55, pageWidth - 120 - 90 - 105 - 55];
    const colX = [
      startX,
      startX + colWidths[0],
      startX + colWidths[0] + colWidths[1],
      startX + colWidths[0] + colWidths[1] + colWidths[2],
      startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
    ];

    const grouped = events.reduce((acc, ev) => {
      const key = ev.drawer || "Unassigned";
      if (!acc[key]) acc[key] = [];
      acc[key].push(ev);
      return acc;
    }, {});

    const drawerKeys = Object.keys(grouped).sort();

    const drawTableHeader = (y) => {
      const h = 18;
      doc.save();
      doc.fillColor("#f3f4f6").rect(startX, y, pageWidth, h).fill();
      doc.restore();

      doc.lineWidth(0.8).rect(startX, y, pageWidth, h).stroke();
      let x = startX;
      for (let i = 0; i < colWidths.length - 1; i += 1) {
        x += colWidths[i];
        doc.moveTo(x, y).lineTo(x, y + h).stroke();
      }

      doc.font("Helvetica-Bold").fontSize(9).fillColor("#111827");
      for (let i = 0; i < headers.length; i += 1) {
        doc.text(headers[i], colX[i] + 4, y + 5, { width: colWidths[i] - 8 });
      }
      doc.fillColor("black");
      return y + h;
    };

    const ensureSpace = (heightNeeded, currentY, sectionTitle = null) => {
      let y = currentY;
      if (y + heightNeeded <= doc.page.height - doc.page.margins.bottom) {
        return y;
      }
      doc.addPage();
      y = doc.page.margins.top;
      if (sectionTitle) {
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#1f2937").text(sectionTitle, startX, y);
        y += 10;
        doc.fillColor("black");
      }
      y = drawTableHeader(y);
      return y;
    };

    const formatValue = (raw) => {
      if (raw === null || raw === undefined) return "-";
      if (typeof raw === "object") return JSON.stringify(raw);
      return String(raw);
    };

    let y = doc.y;

    if (events.length === 0) {
      doc.font("Helvetica-Oblique").fontSize(10).text("No actuator events found in the selected period.");
      doc.end();
      return;
    }

    for (const drawerName of drawerKeys) {
      const sectionTitle = drawerName;
      y = ensureSpace(32, y, null);
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#1f2937").text(sectionTitle, startX, y);
      y += 10;
      doc.fillColor("black");
      y = drawTableHeader(y);

      grouped[drawerName].forEach((ev, index) => {
        const dataTime = ev.dataTime || ev.timestamp.toLocaleString("en-US");
        const parameter = ev.parameter || "-";
        const value = formatValue(ev.value);
        const state = typeof ev.state === "boolean" ? (ev.state ? "ON" : "OFF") : "-";
        const actuator = ev.actuator || "-";

        const h1 = doc.heightOfString(dataTime, { width: colWidths[0] - 8 });
        const h2 = doc.heightOfString(parameter, { width: colWidths[1] - 8 });
        const h3 = doc.heightOfString(value, { width: colWidths[2] - 8 });
        const h4 = doc.heightOfString(state, { width: colWidths[3] - 8 });
        const h5 = doc.heightOfString(actuator, { width: colWidths[4] - 8 });
        const rowHeight = Math.max(18, h1, h2, h3, h4, h5) + 6;

        y = ensureSpace(rowHeight, y, sectionTitle);

        if (index % 2 === 0) {
          doc.save();
          doc.fillColor("#fafafa").rect(startX, y, pageWidth, rowHeight).fill();
          doc.restore();
        }

        doc.lineWidth(0.5).rect(startX, y, pageWidth, rowHeight).stroke();
        let x = startX;
        for (let i = 0; i < colWidths.length - 1; i += 1) {
          x += colWidths[i];
          doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();
        }

        doc.font("Helvetica").fontSize(9);
        doc.text(dataTime, colX[0] + 4, y + 4, { width: colWidths[0] - 8 });
        doc.text(parameter, colX[1] + 4, y + 4, { width: colWidths[1] - 8 });
        doc.text(value, colX[2] + 4, y + 4, { width: colWidths[2] - 8 });
        doc.text(state, colX[3] + 4, y + 4, { width: colWidths[3] - 8 });
        doc.text(actuator, colX[4] + 4, y + 4, { width: colWidths[4] - 8 });

        y += rowHeight;
      });

      y += 8;
    }

    doc.end();
  } catch (error) {
    console.error("Failed to generate actuator report", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

export default router;
