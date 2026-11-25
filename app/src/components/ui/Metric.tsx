import { IonIcon } from "@ionic/react";
import { FC, ReactNode } from "react";
import { Status } from "./status";
import StatusPill from "./StatusPill";

interface MetricProps {
  label: string;
  value: number | null | undefined;
  unit?: string;
  digits?: number;
  icon?: string;
  status?: Status;
  statusLabel?: string;
  hint?: ReactNode;
}

const Metric: FC<MetricProps> = ({ label, value, unit, digits = 1, icon, status = "idle", statusLabel, hint }) => {
  const has = typeof value === "number" && Number.isFinite(value);
  return (
    <div className="bs-metric" data-status={status} aria-label={`${label}: ${has ? value : "no data"} ${unit ?? ""}`}>
      <div className="bs-metric-top">
        <span>
          {icon && <IonIcon icon={icon} aria-hidden="true" />}
          {label}
        </span>
        {statusLabel && <StatusPill status={status}>{statusLabel}</StatusPill>}
      </div>
      <div className={`bs-metric-value ${has ? "" : "empty"}`}>
        {has ? (value as number).toFixed(digits) : "—"}
        {unit && <small>{unit}</small>}
      </div>
      {hint && <div className="bs-metric-hint">{hint}</div>}
    </div>
  );
};

export default Metric;
