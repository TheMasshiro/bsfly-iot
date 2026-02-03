import { Threshold } from "../config/thresholds";

interface SensorData {
  name: string;
  value: number;
}

type ThresholdsMap = Record<string, Threshold | { min: number; max: number; optimal: number[] }>;

export const calculateQuality = (
  sensorsData: SensorData[],
  thresholds: ThresholdsMap,
  stage: string
): number => {
  if (!sensorsData || !thresholds) {
    return 0;
  }

  const isDrawer3 = stage.toLowerCase() === 'drawer 3';

  const getSensorType = (name: string): string | undefined => {
    const lowerName = name.toLowerCase();
    if (lowerName === "temperature") return "temperature";
    if (lowerName === "humidity") return "humidity";
    if (lowerName.includes("substrate moisture")) return "moisture";
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

  const scoresByType: Record<string, number[]> = {};

  sensorsData.forEach((sensor) => {
    const sensorType = getSensorType(sensor.name);
    
    if (isDrawer3 && (sensorType === "moisture" || sensorType === "ammonia")) {
      return;
    }
    
    if (sensorType && thresholds[sensorType]) {
      const score = calculateScore(sensor.value, sensorType);
      if (!scoresByType[sensorType]) {
        scoresByType[sensorType] = [];
      }
      scoresByType[sensorType].push(score);
    }
  });

  const typeScores = Object.values(scoresByType).map(
    (scores) => scores.reduce((sum, s) => sum + s, 0) / scores.length
  );

  return typeScores.length > 0
    ? typeScores.reduce((sum, s) => sum + s, 0) / typeScores.length
    : 0;
};
