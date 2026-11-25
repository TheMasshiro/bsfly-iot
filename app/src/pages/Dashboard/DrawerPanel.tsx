import { IonIcon } from "@ionic/react";
import { flameOutline, snowOutline, thermometerOutline, waterOutline, cloudOutline, leafOutline, rainyOutline } from "ionicons/icons";
import { FC } from "react";
import Metric from "../../components/ui/Metric";
import StatusPill from "../../components/ui/StatusPill";
import { Status, statusText } from "../../components/ui/status";
import { lifecycleThresholds } from "../../config/thresholds";
import { formatRelativeTime } from "../../utils/time";
import { readingsFor, scoreFor } from "./insights";
import { ControlName, Drawer, Snapshot, controlsFor } from "./useFarmData";

const CONTROL_ICON: Record<ControlName, string> = {
  Fan: snowOutline,
  Heater: flameOutline,
  Humidifier: cloudOutline,
  "Water Pump": rainyOutline,
};

const CONTROL_HELP: Record<ControlName, string> = {
  Fan: "Cools and dries the air",
  Heater: "Warms both drawers",
  Humidifier: "Adds moisture to the air",
  "Water Pump": "Wets the substrate",
};

const ICONS: Record<string, string> = {
  temperature: thermometerOutline,
  humidity: cloudOutline,
  ammonia: leafOutline,
};

interface DrawerPanelProps {
  drawer: Drawer;
  snapshot: Snapshot;
  controls: Partial<Record<ControlName, boolean>>;
  canControl: boolean;
  lockReason: string | null;
  busy: ControlName | null;
  onToggle: (control: ControlName) => void;
  hidden?: boolean;
}

const scoreStatus = (score: number | null): Status => (score === null ? "idle" : score >= 80 ? "ok" : score >= 50 ? "warn" : "crit");
const scoreWord = (score: number | null) => (score === null ? "Waiting for data" : score >= 80 ? "Good" : score >= 50 ? "Needs attention" : "Act now");

const DrawerPanel: FC<DrawerPanelProps> = ({ drawer, snapshot, controls, canControl, lockReason, busy, onToggle, hidden }) => {
  const readings = readingsFor(drawer, snapshot);
  const score = scoreFor(drawer, snapshot);
  const th = lifecycleThresholds[drawer] as Record<string, { min: number; max: number; optimal: number[] }>;
  const main = readings.filter((r) => !r.key.endsWith("Substrate"));
  const substrate = readings.filter((r) => r.key.endsWith("Substrate"));

  return (
    <section className="drawer-panel" hidden={hidden} aria-label={drawer}>
      <header className="drawer-head">
        <div>
          <h2>{drawer}</h2>
          <p>{snapshot.updatedAt ? `Updated ${formatRelativeTime(new Date(snapshot.updatedAt))}` : "No readings yet"}</p>
        </div>
        <div className="drawer-score" data-status={scoreStatus(score)}>
          {score !== null && <span className="mono">{score}%</span>}
          <StatusPill status={scoreStatus(score)}>{scoreWord(score)}</StatusPill>
        </div>
      </header>

      <div className="drawer-metrics">
        {main.map((r) => (
          <Metric
            key={r.key}
            label={r.label}
            icon={ICONS[r.key]}
            value={r.value}
            unit={r.unit}
            digits={r.digits}
            status={r.status}
            statusLabel={statusText(r.value, th[r.key])}
            hint={r.range ? `Aim for ${r.range[0]}–${r.range[1]} ${r.unit}` : undefined}
          />
        ))}
        {substrate.length > 0 && (
          <div className="substrate-tile" data-status={substrate.some((s) => s.status === "crit") ? "crit" : substrate.some((s) => s.status === "warn") ? "warn" : substrate.every((s) => s.status === "ok") ? "ok" : "idle"}>
            <div className="bs-metric-top">
              <span>
                <IonIcon icon={waterOutline} aria-hidden="true" />
                Substrate moisture
              </span>
              <span className="hint">Aim for {th.moisture.optimal[0]}–{th.moisture.optimal[1]} %</span>
            </div>
            <div className="substrate-cols">
              {substrate.map((s) => (
                <div key={s.key} className="substrate-col" data-status={s.status}>
                  <span className="label">{s.label.replace("Substrate ", "")}</span>
                  <span className="value mono">{s.value === null ? "—" : Math.round(s.value)}<small>%</small></span>
                  <span className="bar" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(0, s.value ?? 0))}%` }} /></span>
                  <span className="word">{statusText(s.value, th.moisture)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="drawer-controls">
        <div className="controls-head">
          <h3>Controls</h3>
          {lockReason && <span>{lockReason}</span>}
        </div>
        <div className="control-grid">
          {controlsFor(drawer).map((name) => {
            const on = Boolean(controls[name]);
            return (
              <button
                key={name}
                type="button"
                className="control-tile"
                aria-pressed={on}
                disabled={!canControl || busy !== null}
                onClick={() => onToggle(name)}
                title={CONTROL_HELP[name]}
              >
                <IonIcon icon={CONTROL_ICON[name]} aria-hidden="true" />
                <span className="name">{name === "Water Pump" ? "Water pump" : name}</span>
                <span className="state">{busy === name ? "…" : on ? "ON" : "OFF"}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default DrawerPanel;
