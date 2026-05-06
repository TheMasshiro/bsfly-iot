#ifndef SYSTEM_H
#define SYSTEM_H

#include <Arduino.h>
#include <freertos/FreeRTOS.h>

// Control mode enum - must match definition in main.ino
enum ControlMode
{
  CONTROL_MODE_AUTO = 0,
  CONTROL_MODE_MANUAL = 1,
};

// Control mode locking
ControlMode getControlModeLocked();
void setControlModeLocked(ControlMode mode);

// Manual actuator tracking (offline hold)
void recordManualActuatorChangeLocked();
unsigned long getOfflineHoldUntilLocked();

// Light timer management
void setLightTimerLocked(bool on, unsigned long endTimeMs);
void getLightTimerLocked(bool &on, unsigned long &endTimeMs);

// TLS helpers
bool tlsTryLock(TickType_t timeout);
void tlsUnlock();
bool canStartTlsNow(const char *op);

// Time / heartbeat
uint64_t getServerTime();
void kickHeartbeatNow();

#endif // SYSTEM_H
