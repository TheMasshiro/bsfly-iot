import { Threshold } from "../config/thresholds";

interface SensorData {
  name: string;
  value: number | string;
}

type ThresholdsMap = Record<
  string,
  Threshold | { min: number; max: number; optimal: number[] }
>;

export const calculateQuality = (
  sensorsData: SensorData[],
  thresholds: ThresholdsMap,
  stage: string
): number => {
  if (!sensorsData || !thresholds) {
    return 0;
  }

  const isDrawer2 = stage.toLowerCase() === "drawer 2";

  const getSensorType = (name: string): string | undefined => {
    const lowerName = name.toLowerCase();
    if (lowerName === "temperature") return "temperature";
    if (lowerName === "humidity") return "humidity";
    if (
      lowerName.includes("substrate moisture") ||
      lowerName.includes("substrate")
    ) {
      return "moisture";
    }
    if (lowerName === "ammonia") return "ammonia";
    return undefined;
  };

  const calculateScore = (value: number, sensorType: string): number => {
    const { min, max, optimal } = thresholds[sensorType];
    const [optimalMin, optimalMax] = optimal;

    if (value >= optimalMin && value <= optimalMax) {
      return 1.0;
    } else if (value >= min && value < optimalMin) {
      return 0.5 + 0.5 * ((value - min) / (optimalMin - min));
    } else if (value > optimalMax && value <= max) {
      return 1.0 - 0.5 * ((value - optimalMax) / (max - optimalMax));
    }
    return 0;
  };

  const scores: number[] = [];

  sensorsData.forEach((sensor) => {
    if (sensor.value === "--" || typeof sensor.value === "string") {
      return;
    }

    const sensorType = getSensorType(sensor.name);

    if (isDrawer2 && (sensorType === "moisture" || sensorType === "ammonia")) {
      return;
    }

    if (sensorType && thresholds[sensorType]) {
      scores.push(calculateScore(sensor.value, sensorType));
    }
  });

  return scores.length > 0
    ? scores.reduce((sum, score) => sum + score, 0) / scores.length
    : 0;
};
