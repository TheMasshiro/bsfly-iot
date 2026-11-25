import { getStatus, Threshold } from "../../config/thresholds";

export type Status = "ok" | "warn" | "crit" | "idle";

export function statusOf(value: number | null | undefined, threshold?: Threshold | { min: number; max: number; optimal: number[] }): Status {
  if (value === null || value === undefined || Number.isNaN(value) || !threshold) return "idle";
  const s = getStatus(value, threshold as Threshold);
  return s === "success" ? "ok" : s === "warning" ? "warn" : "crit";
}

export function statusText(value: number | null | undefined, threshold?: { min: number; max: number; optimal: number[] }): string {
  if (value === null || value === undefined || !threshold) return "No data";
  const [lo, hi] = threshold.optimal;
  if (value < threshold.min) return "Too low";
  if (value > threshold.max) return "Too high";
  if (value < lo) return "Low";
  if (value > hi) return "High";
  return "In range";
}
