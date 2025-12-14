export const lifecycleThresholds = {
  Egg: {
    temperature: { min: 20, max: 35, optimal: [25, 30] },
    humidity: { min: 50, max: 90, optimal: [60, 80] },
    moisture: { min: 40, max: 80, optimal: [50, 70] },
    ammonia: { min: 0, max: 30, optimal: [0, 10] },
    photoperiod: { min: 0, max: 86400, optimal: [28800, 43200] },
  },
  Larva: {
    temperature: { min: 10, max: 38, optimal: [27, 32] },
    humidity: { min: 55, max: 95, optimal: [65, 85] },
    moisture: { min: 50, max: 85, optimal: [60, 75] },
    ammonia: { min: 0, max: 30, optimal: [0, 10] },
    photoperiod: { min: 0, max: 86400, optimal: [28800, 43200] },
  },
  Pupa: {
    temperature: { min: 20, max: 35, optimal: [24, 28] },
    humidity: { min: 40, max: 80, optimal: [50, 70] },
    moisture: { min: 30, max: 70, optimal: [40, 60] },
    ammonia: { min: 0, max: 30, optimal: [0, 10] },
    photoperiod: { min: 0, max: 86400, optimal: [28800, 43200] },
  },
  Adult: {
    temperature: { min: 20, max: 35, optimal: [25, 30] },
    humidity: { min: 45, max: 85, optimal: [55, 75] },
    moisture: { min: 30, max: 70, optimal: [40, 60] },
    ammonia: { min: 0, max: 30, optimal: [0, 10] },
    photoperiod: { min: 0, max: 86400, optimal: [28800, 43200] },
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
