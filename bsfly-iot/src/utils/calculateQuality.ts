import { Threshold } from "../config/thresholds";

interface SensorData {
  name: string;
  value: number;
}

type ThresholdsMap = Record<string, Threshold | { min: number; max: number; optimal: number[] }>;

export const calculateQuality = (
  sensorsData: SensorData[],
  thresholds: ThresholdsMap
): number => {
  if (!sensorsData || !thresholds) {
    return 0;
  }

  const sensorTypeMap: Record<string, string> = {
    temperature: "temperature",
    humidity: "humidity",
    "substrate moisture": "moisture",
    ammonia: "ammonia",
  };

  let totalScore = 0;
  let sensorCount = 0;

  sensorsData.forEach((sensor) => {
    const sensorType = sensorTypeMap[sensor.name.toLowerCase()];
    if (sensorType && thresholds[sensorType]) {
      sensorCount++;
      const { min, max, optimal } = thresholds[sensorType];
      const [optimalMin, optimalMax] = optimal;
      const value = sensor.value;

      let score = 0;

      if (value >= optimalMin && value <= optimalMax) {
        score = 1.0;
      } else if (value >= min && value < optimalMin) {
        score = 0.5 + 0.5 * ((value - min) / (optimalMin - min));
      } else if (value > optimalMax && value <= max) {
        score = 1.0 - 0.5 * ((value - optimalMax) / (max - optimalMax));
      } else {
        score = 0;
      }

      totalScore += score;
    }
  });

  return sensorCount > 0 ? totalScore / sensorCount : 0;
};
