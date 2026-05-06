#ifndef STORAGE_H
#define STORAGE_H

#include <Arduino.h>

extern bool sdAvailable;

// SD storage operations
void uploadStoredData();
void storeSensorToSD(const char *drawerName, float temperature, float humidity,
                     int leftSubstrate, int centerSubstrate, int rightSubstrate, int ammonia);
int getStoredDataCount();

// FreeRTOS background task for caching stored data count
void sdCountTask(void *pvParameters);

#endif // STORAGE_H
