#ifndef CONNECTIVITY_H
#define CONNECTIVITY_H

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <HTTPClient.h>

// Function declarations
bool sendHeartbeat();
void heartbeatTask(void *pvParameters);
void mqttCallback(char *topic, byte *payload, unsigned int length);
void mqttReconnect();
uint64_t getServerTime();
void setActuatorState(const char *actuatorType, bool state);
void kickHeartbeatNow();

#endif // CONNECTIVITY_H
