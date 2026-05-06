#include "web_handlers.h"
#include <ArduinoJson.h>
#include <SD.h>
#include <ElegantOTA.h>

// External dependencies
extern bool sdAvailable;
extern uint32_t gSdStoredCountCached;
extern bool mq137CalibrationInProgress;
extern TaskHandle_t mq137CalTaskHandle;
extern float mq137Ro;
extern unsigned long mq137LastCalibration;
extern uint8_t mq137CalProgress;
extern uint16_t mq137CalValidSamples;
extern float mq137CalLastRsAvg;
extern void mq137CalibrationTask(void *pvParameters);
extern float calibrateMQ137();
extern int readMQ137();
extern int readAds2Channel(int channel);
extern float estimateNh3PpmFromRaw(int rawValue);
extern float calculateRstFromRaw(int rawValue);
extern void sdUploadKick;
extern void uploadStoredData();
extern bool isAutoControlActive();
extern String getRequestedControlModeName();

#define SD_DATA_FILE "/sensor_data.ndjson"
#define MQ137_CALIBRATION_PPM 0.0

static const char HARDWARE_HTML[] PROGMEM = R"HTML(
<!DOCTYPE html>
<html>
<head>
  <title>BSFly IoT</title>
  <meta name='viewport' content='width=device-width,initial-scale=1'>
  <style>
    body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:20px;max-width:760px;margin:0 auto;background:#08110d;color:#e9f5ee}
    h1,h2,h3{color:#ffffff}
    .card{background:rgba(255,255,255,.05);padding:18px;margin:14px 0;border-radius:16px;border:1px solid rgba(255,255,255,.08)}
    a,button{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#2dd55b 0%,#17a34a 100%);color:white;border:none;padding:12px 18px;border-radius:12px;margin:6px 6px 6px 0;cursor:pointer;text-decoration:none;font-weight:700}
    button:hover,a:hover{filter:brightness(1.05)}
    .danger{background:linear-gradient(135deg,#ff4757 0%,#c5000f 100%)}
    .muted{color:rgba(233,245,238,.75);line-height:1.6}
    ul{padding-left:20px;line-height:1.7}
    code{background:rgba(255,255,255,.08);padding:2px 6px;border-radius:8px}
  </style>
</head>
<body>
  <h1>BSFly IoT Hardware</h1>
  <p class='muted'>Upload firmware over the air, then reboot the controller from the same page.</p>

  <div class='card'>
    <strong>Device ID:</strong> <span id="deviceId">Loading...</span><br>
    <strong>IP Address:</strong> <span id="ip">Loading...</span>
  </div>

  <div class='card'>
    <strong>SD Card:</strong> <span id="sdAvail">Loading...</span><br>
    <strong>Control Mode:</strong> <span id="modeText">Loading...</span><br>
    <strong>Stored Readings:</strong> <span id="storedCount">Loading...</span>
  </div>

  <div class='card'>
    <h2>Actions</h2>
    <a href='/update' target='_blank' rel='noopener noreferrer'>Open ElegantOTA Upload</a>
    <button class='danger' onclick="fetch('/reboot',{method:'POST'}).then(r=>r.json()).then(d=>alert(d.message)).catch(e=>alert(e.message))">
      Reboot ESP32
    </button>
  </div>

  <div class='card'>
    <h2>MQ137 Ammonia Sensor Calibration</h2>
    <p class='muted'>Calibrate the MQ137 sensor in fresh air.</p>
    <p id='calibStatus' class='muted'>Status: Loading...</p>
    <button id='calibBtn' onclick='startCalibration()'>Start Calibration</button>
  </div>

  <script>
    let calibPollTimer=null;

    function renderStatus(s){
      document.getElementById('deviceId').textContent = s.deviceId || 'N/A';
      document.getElementById('ip').textContent = s.ip || 'N/A';
      document.getElementById('sdAvail').textContent = (s.sdAvailable ? 'Available' : 'Not found');
      document.getElementById('storedCount').textContent = (typeof s.storedCount !== 'undefined') ? s.storedCount : 'N/A';
      document.getElementById('modeText').textContent = s.requestedControlMode || 'N/A';
    }

    function renderCalib(d){
      const inProg=!!d.inProgress;
      const prog=('progress' in d)?(''+d.progress):'0';
      const valid=('validSamples' in d)?(''+d.validSamples):'0';
      const ro=(d.ro!==undefined&&d.ro!==null)?d.ro:'N/A';
      const last=(d.lastCalibration?new Date(d.lastCalibration*1000).toLocaleString():'Never');
      let st='Status: '+(inProg?'Calibrating':'Idle')+' | Progress: '+prog+'% (valid '+valid+') | Ro='+ro+' | Last='+last;
      document.getElementById('calibStatus').textContent=st;
      const btn=document.getElementById('calibBtn');
      btn.disabled=inProg;
      btn.textContent=inProg?'Calibrating...':'Start Calibration';
    }

    function loadStatus(){
      fetch('/status').then(r=>r.json()).then(renderStatus).catch(_=>{});
    }

    function loadCalibStatus(){
      fetch('/calibration/status').then(r=>r.json()).then(d=>{
        renderCalib(d);
        if(d.inProgress){
          if(!calibPollTimer) calibPollTimer=setInterval(loadCalibStatus, 1000);
        } else {
          if(calibPollTimer){clearInterval(calibPollTimer); calibPollTimer=null;}
        }
      }).catch(_=>{
        document.getElementById('calibStatus').textContent='Status: Error loading';
      });
    }

    function startCalibration(){
      const btn=document.getElementById('calibBtn');
      btn.disabled=true; btn.textContent='Starting...';
      fetch('/calibrate/mq137',{method:'POST'}).then(async r=>{
        let d={}; try{d=await r.json();}catch(e){}
        if(!r.ok){throw new Error(d.error||d.message||('HTTP '+r.status));}
        loadCalibStatus();
      }).catch(e=>alert('Error: '+e.message));
    }

    loadStatus();
    loadCalibStatus();
    setInterval(loadStatus, 5000);
  </script>
</body>
</html>
)HTML";

void setupWebServer()
{
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "Content-Type");

  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request)
            { request->redirect("/hardware"); });
  server.on("/hardware", HTTP_GET, handleHardwarePage);
  server.on("/calibrate/mq137", HTTP_POST, handleCalibrateAmmonia);
  server.on("/calibration/status", HTTP_GET, handleCalibrationStatus);
  server.on("/calibrate/all", HTTP_POST, handleCalibrateAllSensors);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/sdcard/data", HTTP_GET, handleGetSdData);
  server.on("/sdcard/clear", HTTP_POST, handleClearSdData);
  server.on("/sdcard/sync", HTTP_POST, handleSyncSdData);
  server.on("/reboot", HTTP_POST, handleReboot);
  ElegantOTA.begin(&server);
  server.begin();
  Serial.print(F("Web server started at http://"));
  Serial.println(WiFi.localIP());
}

void handleHardwarePage(AsyncWebServerRequest *request)
{
  request->send(200, "text/html", HARDWARE_HTML);
}

void handleStatus(AsyncWebServerRequest *request)
{
  int cached = (int)gSdStoredCountCached;

  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["ip"] = WiFi.localIP().toString();
  doc["sdAvailable"] = sdAvailable;
  doc["storedCount"] = (cached >= 0) ? cached : 0;
  doc["wifiConnected"] = WiFi.status() == WL_CONNECTED;
  doc["requestedControlMode"] = getRequestedControlModeName();
  doc["autoControlActive"] = isAutoControlActive();
  doc["uptime"] = millis() / 1000;

  String response;
  serializeJson(doc, response);
  request->send(200, "application/json", response);
}

void handleGetSdData(AsyncWebServerRequest *request)
{
  if (!sdAvailable)
  {
    request->send(503, "application/json", "{\"error\":\"SD card not available\"}");
    return;
  }

  if (!SD.exists(SD_DATA_FILE))
  {
    request->send(200, "application/json", "{\"readings\":[]}");
    return;
  }

  File file = SD.open(SD_DATA_FILE, FILE_READ);
  if (!file)
  {
    request->send(500, "application/json", "{\"error\":\"Failed to open file\"}");
    return;
  }

  AsyncResponseStream *response = request->beginResponseStream("application/json");
  response->print("{\"deviceId\":\"");
  response->print(DEVICE_ID);
  response->print("\",\"readings\":[");

  bool first = true;
  while (file.available())
  {
    String line = file.readStringUntil('\n');
    line.trim();
    if (line.length() > 0)
    {
      if (!first)
        response->print(",");
      response->print(line);
      first = false;
    }
  }

  response->print("]}");
  request->send(response);
  file.close();
}

void handleClearSdData(AsyncWebServerRequest *request)
{
  if (!sdAvailable)
  {
    request->send(503, "application/json", "{\"error\":\"SD card not available\"}");
    return;
  }

  if (SD.exists(SD_DATA_FILE))
  {
    SD.remove(SD_DATA_FILE);
  }

  request->send(200, "application/json", "{\"message\":\"Data cleared\",\"success\":true}");
}

void handleSyncSdData(AsyncWebServerRequest *request)
{
  if (!sdAvailable)
  {
    request->send(503, "application/json", "{\"error\":\"SD card not available\"}");
    return;
  }

  if (WiFi.status() != WL_CONNECTED)
  {
    request->send(503, "application/json", "{\"error\":\"WiFi not connected\"}");
    return;
  }

  sdUploadKick = true;

  int cached = (int)gSdStoredCountCached;
  JsonDocument doc;
  doc["message"] = "Sync queued";
  doc["queued"] = true;
  doc["storedCount"] = (cached >= 0) ? cached : 0;
  doc["success"] = true;

  String response;
  serializeJson(doc, response);
  request->send(202, "application/json", response);
}

void handleReboot(AsyncWebServerRequest *request)
{
  JsonDocument doc;
  doc["message"] = "ESP32 rebooting";
  doc["success"] = true;

  String response;
  serializeJson(doc, response);
  request->send(200, "application/json", response);
  delay(1000);
  ESP.restart();
}

void handleCalibrateAmmonia(AsyncWebServerRequest *request)
{
  JsonDocument doc;

  if (mq137CalibrationInProgress || mq137CalTaskHandle != nullptr)
  {
    doc["error"] = "Calibration already in progress";
    doc["status"] = "busy";
    String response;
    serializeJson(doc, response);
    request->send(409, "application/json", response);
    return;
  }

  // MQ137 is read from ADS1115 #2 in this firmware
  extern bool ads2Available;
  if (!ads2Available)
  {
    doc["error"] = "ADS1115 #2 not available";
    String response;
    serializeJson(doc, response);
    request->send(503, "application/json", response);
    return;
  }

  // Start calibration in background task; return immediately.
  BaseType_t ok = xTaskCreatePinnedToCore(
      mq137CalibrationTask,
      "MQ137Cal",
      6144,
      nullptr,
      1,
      &mq137CalTaskHandle,
      1);

  if (ok != pdPASS)
  {
    mq137CalTaskHandle = nullptr;
    doc["error"] = "Failed to start calibration task";
    String response;
    serializeJson(doc, response);
    request->send(500, "application/json", response);
    return;
  }

  doc["success"] = true;
  doc["message"] = "MQ137 calibration started";
  doc["status"] = "started";
  doc["progress"] = (int)mq137CalProgress;

  String response;
  serializeJson(doc, response);
  request->send(202, "application/json", response);
}

void handleCalibrationStatus(AsyncWebServerRequest *request)
{
  JsonDocument doc;

  doc["inProgress"] = (mq137CalibrationInProgress || mq137CalTaskHandle != nullptr);
  doc["progress"] = (int)mq137CalProgress;
  doc["validSamples"] = (int)mq137CalValidSamples;
  doc["ro"] = mq137Ro;
  doc["lastCalibration"] = mq137LastCalibration;
  doc["calibrationPoint"] = MQ137_CALIBRATION_PPM;
  doc["rl"] = (float)MQ137_RL;

  if (isfinite(mq137CalLastRsAvg))
    doc["rsAverage"] = mq137CalLastRsAvg;

  // Keep estimated PPM behavior
  if (mq137Ro > 0)
  {
    int16_t rawValue = readAds2Channel(ADS2_MQ137);
    extern int ADS_INVALID;
    if (rawValue != ADS_INVALID)
    {
      doc["raw"] = rawValue;
      extern Adafruit_ADS1115 ads2;
      doc["vrl"] = ads2.computeVolts(rawValue);

      float rs = calculateRstFromRaw(rawValue);
      doc["rs_kohm"] = rs;

      float ratio = rs / mq137Ro;
      doc["rs_ro_ratio"] = ratio;

      float ppm = estimateNh3PpmFromRaw(rawValue);
      if (isfinite(ppm))
        doc["estimatedPpm"] = ppm;

      extern float MQ137_NH3_A, MQ137_NH3_B;
      doc["curveA"] = MQ137_NH3_A;
      doc["curveB"] = MQ137_NH3_B;
    }
  }

  String response;
  serializeJson(doc, response);
  request->send(200, "application/json", response);
}

void handleCalibrateAllSensors(AsyncWebServerRequest *request)
{
  JsonDocument doc;

  if (mq137CalibrationInProgress)
  {
    doc["error"] = "Calibration already in progress";
    doc["status"] = "busy";
  }
  else
  {
    Serial.println(F("[CALIBRATION] Starting all-sensor calibration..."));
    float newRo = calibrateMQ137();

    doc["success"] = true;
    doc["message"] = "All sensors calibrated";

    // mq137 object
    JsonObject mq137 = doc["mq137"].to<JsonObject>();
    mq137["ro"] = newRo;
    mq137["timestamp"] = mq137LastCalibration;
    mq137["status"] = "calibrated";

    // substrate object
    JsonObject substrate = doc["substrate"].to<JsonObject>();
    substrate["status"] = "not_implemented";
    substrate["message"] = "Substrate moisture calibration available on hardware page";

    // temperature object
    JsonObject temperature = doc["temperature"].to<JsonObject>();
    temperature["status"] = "not_needed";
    temperature["message"] = "Temperature sensors use standard DHT calibration";
  }

  String response;
  serializeJson(doc, response);
  request->send(200, "application/json", response);
}
