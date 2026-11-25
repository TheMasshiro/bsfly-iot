#include "Tasks.h"
#include "Sensors.h"
#include "ServerApi.h"
#include "Storage.h"

static TaskHandle_t sdUploadTaskHandle = nullptr;
static TaskHandle_t sdCountTaskHandle = nullptr;

void startTasks()
{
  xTaskCreatePinnedToCore(heartbeatTask, "HeartbeatTask", 8192, nullptr, 6, &heartbeatTaskHandle, 0);
  xTaskCreatePinnedToCore(sdUploadTask, "SDUploadTask", 8192, nullptr, 4, &sdUploadTaskHandle, 0);
  xTaskCreatePinnedToCore(sensorTask, "SensorTask", 16384, nullptr, 2, &sensorTaskHandle, 1);
  xTaskCreatePinnedToCore(sdCountTask, "SDCountTask", 4096, nullptr, 1, &sdCountTaskHandle, 1);
}

BaseType_t startMq137CalibrationTask()
{
  return xTaskCreatePinnedToCore(mq137CalibrationTask, "MQ137Cal", 6144, nullptr, 1, &mq137CalTaskHandle, 1);
}
