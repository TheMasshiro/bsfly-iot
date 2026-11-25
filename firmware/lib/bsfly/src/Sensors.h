#pragma once

#include "State.h"

void beginAds();
void beginDht();
void sendSensorData();
void sensorTask(void *pvParameters);
int16_t readAds1Channel(uint8_t channel);
int16_t readAds2Channel(uint8_t channel);
Nh3Metrics readNh3Metrics();
float calculateRstFromRaw(int16_t rawValue);
float estimateNh3PpmFromRaw(int16_t rawValue);
float calibrateMQ137();
void loadMQ137Calibration();
void mq137CalibrationTask(void *pvParameters);
