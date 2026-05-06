// MQ137 calibration interface and constants.
// Implementations live in mq137_calibration.cpp.

#ifndef MQ137_CALIBRATION_H
#define MQ137_CALIBRATION_H

#include <stdint.h>

// MQ137 constants shared by main firmware and calibration module.
#define MQ137_RL 4.7f                           // Load resistance in kOhm
#define MQ137_VC 5.0f                           // Supply voltage in V
#define MQ137_CALIBRATION_PPM 21.0f             // Display-only reference value
#define MQ137_CALIBRATION_RATIO 3.6f            // Rst/Ro ratio in fresh air
#define MQ137_CALIBRATION_CYCLES 500            // Number of readings to average
#define MQ137_CALIBRATION_FILE "/mq137_ro.json" // Calibration file path
#define MQ137_NH3_A 23.7f                       // NH3 curve coefficient A
#define MQ137_NH3_B -4.796f                     // NH3 curve coefficient B
#define MQ137_DIVIDER_INVERTED 1                // Wiring model selector

extern float mq137Ro;
extern float mq137LastCalibration;
extern bool mq137CalibrationInProgress;

float calculateRstFromRaw(int16_t rawValue);
float calibrateMQ137();
void loadMQ137Calibration();

#endif
