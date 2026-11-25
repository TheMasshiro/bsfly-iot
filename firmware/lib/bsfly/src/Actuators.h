#pragma once

#include "State.h"

void beginMcp();
void ledOn();
void ledOff();
void updateLightLed();
bool applyActuatorState(const char *actuator, bool state);
void setMcpActuator(uint8_t pin, bool state);
void logActuatorCommand(const char *actuator, bool state);
void publishActuatorStateBool(const char *actuator, bool state);
void publishLightTimerState(int timeSeconds, uint64_t startTimeMs);
void checkLightTimerExpiry();
void autoControlEggLarvaeDrawer(float temperature, float humidity, int leftMoisture, int centerMoisture, int rightMoisture);
void autoControlPupaDrawer(float temperature, float humidity);
bool isAutoControlActive();
void setRequestedControlMode(ControlMode mode);
const char *getRequestedControlModeName();
void recordManualActuatorChange();
void logConnectivityState(const char *source);

inline void setEggLarvaePump(bool state) { setMcpActuator(MCP_EGGLARVAE_PUMP, state); }
inline void setEggLarvaeHumidifier(bool state) { setMcpActuator(MCP_EGGLARVAE_HUMIDIFIER, state); }
inline void setEggLarvaeFan(bool state) { setMcpActuator(MCP_EGGLARVAE_FANS, state); }
inline void setEggLarvaeHeater(bool state) { setMcpActuator(MCP_EGGLARVAE_HEATER, state); }
inline void setEggLarvaeHeaterFan(bool state) { setMcpActuator(MCP_EGGLARVAE_HEATER_FANS, state); }
inline void setPupaHumidifier(bool state) { setMcpActuator(MCP_PUPA_HUMIDIFIER, state); }
inline void setPupaFan(bool state) { setMcpActuator(MCP_PUPA_FAN, state); }
