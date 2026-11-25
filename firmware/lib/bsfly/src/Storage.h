#pragma once

#include "State.h"

void beginSd();
void storeSensorToSD(const char *drawerName, float temperature, float humidity, int leftSubstrate, int centerSubstrate, int rightSubstrate, int ammonia);
void uploadStoredData();
int getStoredDataCount();
void sdUploadTask(void *pvParameters);
void sdCountTask(void *pvParameters);
