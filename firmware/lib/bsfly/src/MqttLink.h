#pragma once

#include "State.h"

void initMqttQueue();
bool sendSensorReading(const char *drawerName, float temperature, float humidity, int leftSubstrate, int centerSubstrate, int rightSubstrate, int ammonia);
bool mqttEnqueuePublish(const char *topic, const char *payload, bool retain = false);
void mqttDrainQueue();
void mqttReconnect();
