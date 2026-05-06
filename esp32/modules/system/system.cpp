#include "system.h"
#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

// External state variables and FreeRTOS primitives
extern SemaphoreHandle_t gTlsMutex;
extern ControlMode requestedControlMode;
extern unsigned long offlineAutoControlHoldUntil;
extern bool lightState;
extern unsigned long lightEndTime;

// External constants
#define OFFLINE_AUTOCONTROL_HOLD_MS 30000
#define TLS_MIN_FREE_HEAP 32768
#define TLS_MIN_FREE_HEAP_MIN 16384

// External core locking functions (defined in main.ino)
extern void stateLock();
extern void stateUnlock();

// ==================== CONTROL MODE LOCKING ====================
ControlMode getControlModeLocked()
{
  stateLock();
  ControlMode m = requestedControlMode;
  stateUnlock();
  return m;
}

void setControlModeLocked(ControlMode mode)
{
  stateLock();
  requestedControlMode = mode;
  if (requestedControlMode == CONTROL_MODE_AUTO)
  {
    offlineAutoControlHoldUntil = 0;
  }
  stateUnlock();
}

// ==================== MANUAL ACTUATOR TRACKING ====================
void recordManualActuatorChangeLocked()
{
  stateLock();
  offlineAutoControlHoldUntil = millis() + OFFLINE_AUTOCONTROL_HOLD_MS;
  stateUnlock();
}

unsigned long getOfflineHoldUntilLocked()
{
  stateLock();
  unsigned long t = offlineAutoControlHoldUntil;
  stateUnlock();
  return t;
}

// ==================== LIGHT TIMER MANAGEMENT ====================
void setLightTimerLocked(bool on, unsigned long endTimeMs)
{
  stateLock();
  lightState = on;
  lightEndTime = endTimeMs;
  stateUnlock();
}

void getLightTimerLocked(bool &on, unsigned long &endTimeMs)
{
  stateLock();
  on = lightState;
  endTimeMs = lightEndTime;
  stateUnlock();
}

// ==================== TLS HELPERS ====================
bool tlsTryLock(TickType_t waitTicks)
{
  if (!gTlsMutex)
    return false;
  return xSemaphoreTake(gTlsMutex, waitTicks) == pdTRUE;
}

void tlsUnlock()
{
  if (gTlsMutex)
    xSemaphoreGive(gTlsMutex);
}

bool canStartTlsNow(const char *tag)
{
  uint32_t heap = ESP.getFreeHeap();
  uint32_t minHeap = ESP.getMinFreeHeap();

  if (heap < TLS_MIN_FREE_HEAP || minHeap < TLS_MIN_FREE_HEAP_MIN)
  {
    Serial.print(F("[TLS] Skip "));
    Serial.print(tag);
    Serial.print(F(": heap="));
    Serial.print(heap);
    Serial.print(F(" minHeap="));
    Serial.println(minHeap);
    return false;
  }
  return true;
}
