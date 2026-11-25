export const lifecycleThresholds = {
  "Drawer 1": {
    temperature: { min: 27, max: 31, optimal: [27, 31] },
    humidity: { min: 60, max: 70, optimal: [60, 70] },
    moisture: { min: 60, max: 75, optimal: [60, 75] },
    ammonia: { min: 0, max: 25, optimal: [0, 25] },
  },
  "Drawer 2": {
    temperature: { min: 27, max: 30, optimal: [27, 30] },
    humidity: { min: 60, max: 70, optimal: [60, 70] },
  },
};

export type Threshold = {
  min: number;
  max: number;
  optimal: [number, number];
};

export function getStatus(value: number, thresholds: Threshold) {
  if (value < thresholds.min || value > thresholds.max) {
    return "danger";
  }
  if (value >= thresholds.optimal[0] && value <= thresholds.optimal[1]) {
    return "success";
  }
  return "warning";
}
