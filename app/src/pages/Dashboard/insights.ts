import { lifecycleThresholds } from "../../config/thresholds";
import { calculateQuality } from "../../utils/calculateQuality";
import { Status, statusOf } from "../../components/ui/status";
import { Drawer, Snapshot } from "./useFarmData";

export interface Reading {
  key: "temperature" | "humidity" | "ammonia" | "leftSubstrate" | "centerSubstrate" | "rightSubstrate";
  label: string;
  unit: string;
  value: number | null;
  status: Status;
  range: [number, number] | null;
  digits: number;
}

const LABELS: Record<Reading["key"], [string, string, number]> = {
  temperature: ["Temperature", "°C", 1],
  humidity: ["Humidity", "%", 1],
  ammonia: ["Ammonia", "ppm", 1],
  leftSubstrate: ["Substrate left", "%", 0],
  centerSubstrate: ["Substrate middle", "%", 0],
  rightSubstrate: ["Substrate right", "%", 0],
};

export function readingsFor(drawer: Drawer, s: Snapshot): Reading[] {
  const t = lifecycleThresholds[drawer] as Record<string, { min: number; max: number; optimal: number[] }>;
  const keys: Reading["key"][] = drawer === "Drawer 1"
    ? ["temperature", "humidity", "leftSubstrate", "centerSubstrate", "rightSubstrate", "ammonia"]
    : ["temperature", "humidity"];
  return keys.map((key) => {
    const thresholdKey = key.endsWith("Substrate") ? "moisture" : key;
    const th = t[thresholdKey];
    const [label, unit, digits] = LABELS[key];
    return {
      key,
      label,
      unit,
      digits,
      value: s[key],
      status: statusOf(s[key], th),
      range: th ? [th.optimal[0], th.optimal[1]] : null,
    };
  });
}

export function scoreFor(drawer: Drawer, s: Snapshot) {
  const rows = readingsFor(drawer, s).map((r) => ({ name: r.key.endsWith("Substrate") ? "substrate" : r.label, value: r.value ?? "--" }));
  const hasData = rows.some((r) => typeof r.value === "number");
  return hasData ? Math.round(calculateQuality(rows, lifecycleThresholds[drawer], drawer) * 100) : null;
}

export interface Issue {
  drawer: Drawer;
  status: Status;
  text: string;
}

export function issuesFor(drawer: Drawer, s: Snapshot): Issue[] {
  return readingsFor(drawer, s)
    .filter((r) => r.status === "warn" || r.status === "crit")
    .map((r) => {
      const high = r.range && r.value !== null && r.value > r.range[1];
      const word =
        r.key === "temperature" ? (high ? "too hot" : "too cold")
        : r.key === "humidity" ? (high ? "too humid" : "too dry")
        : r.key === "ammonia" ? "ammonia is high"
        : high ? "too wet" : "too dry";
      const subject = r.key === "ammonia" ? "" : `${r.label} `;
      return {
        drawer,
        status: r.status,
        text: `${subject}${word}: ${r.value?.toFixed(r.digits)}${r.unit}, aim for ${r.range?.[0]}–${r.range?.[1]}${r.unit}`,
      };
    });
}
