#ifndef SENSOR_PIPELINE_H
#define SENSOR_PIPELINE_H

#include <Arduino.h>
#include <ArduinoJson.h>

// Sensor data structures
struct SensorReading {
  unsigned long timestamp;
  float tempA, tempB, tempC, tempD, tempE;
  float humidityA, humidityB, humidityC, humidityD, humidityE;
  int moistureADC[3];
  float moisturePercent[3];
  float nh3_ppm;
  int nh3_raw;
};

// Function declarations
void initSensorPipeline();
SensorReading collectSensorData();
void sendOrStoreSensorReading(const SensorReading& reading);
void readNh3Metrics(float& ppm, int& raw);
void collectAndProcessEggLarvaeDrawer(SensorReading& reading);
void collectAndProcessPupaDrawer(SensorReading& reading);

#endif // SENSOR_PIPELINE_H
