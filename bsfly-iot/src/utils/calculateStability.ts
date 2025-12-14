export const calculateStability = (
  sensorsData: Array<{ name: string; value: number }>,
  thresholds: any
): number => {
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
        // Perfect - in optimal range
        score = 1.0;
      } else if (value >= min && value < optimalMin) {
        // Below optimal but within acceptable range
        // Linear scale from min (0.5) to optimalMin (1.0)
        score = 0.5 + 0.5 * ((value - min) / (optimalMin - min));
      } else if (value > optimalMax && value <= max) {
        // Above optimal but within acceptable range
        // Linear scale from optimalMax (1.0) to max (0.5)
        score = 1.0 - 0.5 * ((value - optimalMax) / (max - optimalMax));
      } else {
        // Outside acceptable range - critical
        score = 0;
      }

      totalScore += score;
    }
  });

  return sensorCount > 0 ? totalScore / sensorCount : 0;
};
