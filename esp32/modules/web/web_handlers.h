#ifndef WEB_HANDLERS_H
#define WEB_HANDLERS_H

#include <ESPAsyncWebServer.h>

// Forward declarations
extern AsyncWebServer server;
extern String DEVICE_ID;

// Web server setup
void setupWebServer();

// Request handlers
void handleHardwarePage(AsyncWebServerRequest *request);
void handleStatus(AsyncWebServerRequest *request);
void handleGetSdData(AsyncWebServerRequest *request);
void handleClearSdData(AsyncWebServerRequest *request);
void handleSyncSdData(AsyncWebServerRequest *request);
void handleReboot(AsyncWebServerRequest *request);
void handleCalibrateAmmonia(AsyncWebServerRequest *request);
void handleCalibrationStatus(AsyncWebServerRequest *request);
void handleCalibrateAllSensors(AsyncWebServerRequest *request);

#endif // WEB_HANDLERS_H
