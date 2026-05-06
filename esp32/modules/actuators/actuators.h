#ifndef ACTUATORS_H
#define ACTUATORS_H

#include <Arduino.h>

// Individual actuator control
void setEggLarvaePump(bool state);
void setEggLarvaeHumidifier(bool state);
void setEggLarvaeFan(bool state);
void setEggLarvaeHeater(bool state);
void setEggLarvaeHeaterFan(bool state);
void setPupaHumidifier(bool state);
void setPupaFan(bool state);

// Light control
void updateLightLed();

// State dispatcher
bool applyActuatorState(const char *actuator, bool state);

// Publishing
void publishActuatorStateBool(const char *actuator, bool state);
void publishLightTimerState(int timeSeconds, uint64_t startTimeMs);

// Logging
void logActuatorCommand(const char *actuator, bool state);

#endif // ACTUATORS_H
