#ifndef MQ137_CALIBRATION_H
#define MQ137_CALIBRATION_H

#include <Arduino.h>

// MQ137 Sensor Constants
#define MQ137_RL 10.0
#define MQ137_VC 5.0
#define MQ137_CALIBRATION_RATIO 3.59
#define MQ137_NH3_A 102.2
#define MQ137_NH3_B -2.473

// Global calibration state
extern float mq137Ro;
extern unsigned long mq137LastCalibration;
extern bool mq137CalibrationInProgress;

// Function declarations
float calculateRstFromRaw(int rawValue);
float calibrateMQ137();
void loadMQ137Calibration();
float estimateNh3PpmFromRaw(int rawValue);

#endif // MQ137_CALIBRATION_H
