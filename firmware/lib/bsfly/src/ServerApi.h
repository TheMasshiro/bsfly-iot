#pragma once

#include "State.h"

void configureTlsClient(WiFiClientSecure &client, const char *rootCa, const char *tag);
bool canStartTlsNow(const char *tag);
bool tlsTryLock(TickType_t waitTicks = pdMS_TO_TICKS(1000));
void tlsUnlock();
bool sendHeartbeat();
uint64_t getServerTime();
void heartbeatTask(void *pvParameters);

inline void kickHeartbeatNow()
{
  if (heartbeatTaskHandle)
    xTaskNotifyGive(heartbeatTaskHandle);
}
