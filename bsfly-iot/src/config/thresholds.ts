export const lifecycleThresholds = {
  "Drawer 1": {
    temperature: { min: 20, max: 35, optimal: [27, 31] },
    humidity: { min: 50, max: 80, optimal: [60, 70] },
    moisture: { min: 50, max: 80, optimal: [60, 75] },
    ammonia: { min: 0, max: 30, optimal: [0, 10] },
  },
  "Drawer 2": {
    temperature: { min: 20, max: 35, optimal: [27, 31] },
    humidity: { min: 50, max: 80, optimal: [60, 70] },
    moisture: { min: 50, max: 80, optimal: [60, 75] },
    ammonia: { min: 0, max: 30, optimal: [0, 10] },
  },
  "Drawer 3": {
    temperature: { min: 20, max: 35, optimal: [26, 30] },
    humidity: { min: 40, max: 60, optimal: [40, 50] },
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
