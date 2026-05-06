#ifndef CONTROL_H
#define CONTROL_H

#include <Arduino.h>

// Control mode enum
enum ControlMode {
  CONTROL_MODE_AUTO = 0,
  CONTROL_MODE_MANUAL = 1
};

// Auto-control logic
void autoControlEggLarvaeDrawer(float temperature, float humidity, int moisture);
void autoControlPupaDrawer(float temperature, float humidity);

// Control mode management
bool isAutoControlActive();
void setRequestedControlMode(ControlMode mode);
const char *getRequestedControlModeName();
void recordManualActuatorChange();

// Validation helpers
bool isValidDrawer1DhtReading(float temperature, float humidity);
bool isValidDrawer2DhtReading(float temperature, float humidity);

#endif // CONTROL_H
