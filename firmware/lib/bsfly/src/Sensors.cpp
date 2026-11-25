#include "Sensors.h"
#include "Actuators.h"
#include "Display.h"
#include "MqttLink.h"
#include "ServerApi.h"
#include "Storage.h"

void sendOrStoreSensorReading(const char *drawerName, float temperature, float humidity, int leftSubstrate, int centerSubstrate, int rightSubstrate, int ammonia);

void beginAds()
{
  // ADS1115 #1
  ads1Available = ads1.begin(ADS1115_ADDR_1, &Wire);
  if (!ads1Available)
  {
    Serial.println(F("ADS1115 #1 not found"));
  }
  else
  {
    ads1.readADC_SingleEnded(0); // Dummy read to set up config register for channel 0
    ads1.readADC_SingleEnded(1); // Dummy read to set up config register for channel 1
    ads1.readADC_SingleEnded(2); // Dummy read to set up config register for channel 2
    ads1.setGain(GAIN_TWOTHIRDS);
    ads1.setDataRate(RATE_ADS1115_128SPS);

    Serial.println(F("ADS1115 #1 initialized"));
  }

  // ADS1115 #2
  ads2Available = ads2.begin(ADS1115_ADDR_2, &Wire);
  if (!ads2Available)
  {
    Serial.println(F("ADS1115 #2 not found"));
  }
  else
  {
    // Keep consistent unless ADS#2 is used for a lower-voltage signal that needs higher gain.
    ads2.readADC_SingleEnded(0); // Dummy read to set up config register for channel 0
    ads2.setGain(GAIN_TWOTHIRDS);
    ads2.setDataRate(RATE_ADS1115_128SPS);
    Serial.println(F("ADS1115 #2 initialized"));
  }
}

void beginDht()
{
  // DHTs
  dhtA11.begin();
  dhtB11.begin();
  dhtC11.begin();
  dhtA22.begin();
  dhtB22.begin();
  dhtC22.begin();
  dhtD22.begin();
  dhtE22.begin();
  dhtD11.begin();
  dhtE11.begin();
}

int16_t readAds1Channel(uint8_t channel)
{
  if (!ads1Available)
    return ADS_INVALID;

  return ads1.readADC_SingleEnded(channel);
}

int16_t readAds2Channel(uint8_t channel)
{
  if (!ads2Available)
    return ADS_INVALID;

  return ads2.readADC_SingleEnded(channel);
}

int readSubstrate1()
{
  int16_t v = readAds1Channel(ADS1_SUBSTRATE_1);
  if (v == ADS_INVALID)
    return -1; // sentinel for "invalid"
  return (int)v;
}

int readSubstrate2()
{
  int16_t v = readAds1Channel(ADS1_SUBSTRATE_2);
  if (v == ADS_INVALID)
    return -1;
  return (int)v;
}

int readSubstrate3()
{
  int16_t v = readAds1Channel(ADS1_SUBSTRATE_3);
  if (v == ADS_INVALID)
    return -1;
  return (int)v;
}

int readMQ137()
{
  int16_t v = readAds2Channel(ADS2_MQ137);
  if (v == ADS_INVALID)
    return -1;
  return (int)v;
}

static inline int moisturePercentFromRaw(int raw)
{
  if (raw < 0)
    return -1;

  // Ensure ordering
  int dry = gMoistureRawDry;
  int wet = gMoistureRawWet;
  if (dry == wet)
    return -1;
  if (dry < wet)
  {
    int tmp = dry;
    dry = wet;
    wet = tmp;
  }

  // Many capacitive modules give higher voltage (thus raw) when DRY.
  // Map raw in [wet..dry] -> [100..0] or [0..100] depending on your convention.
  // Here: wet => 100, dry => 0.
  long pct = map(raw, wet, dry, 100, 0);
  return (int)constrain(pct, 0, 100);
}

static inline const char *rawRangeTag(int raw)
{
  if (raw < 0)
    return "INVALID";
  int dry = gMoistureRawDry;
  int wet = gMoistureRawWet;
  if (dry < wet)
  {
    int t = dry;
    dry = wet;
    wet = t;
  }

  if (raw > dry)
    return "ABOVE_DRY";
  if (raw < wet)
    return "BELOW_WET";
  return "IN_RANGE";
}

static inline void printAds1MoistureDebug(int16_t r0, int16_t r1, int16_t r2)
{
  Serial.print(F("Sub volts(L/C/R)="));
  if (r0 != ADS_INVALID)
    Serial.print(ads1.computeVolts(r0), 3);
  else
    Serial.print(F("NaN"));
  Serial.print(F("/"));
  if (r1 != ADS_INVALID)
    Serial.print(ads1.computeVolts(r1), 3);
  else
    Serial.print(F("NaN"));
  Serial.print(F("/"));
  if (r2 != ADS_INVALID)
    Serial.println(ads1.computeVolts(r2), 3);
  else
    Serial.println(F("NaN"));
}

bool isValidDrawer1DhtReading(float temperature, float humidity)
{
  // Drawer 1 operates in a warm, humid envelope. Tight bounds block cross-type garbage readings.
  return !isnan(temperature) && !isnan(humidity) && temperature >= 15.0f && temperature <= 45.0f && humidity >= 30.0f && humidity <= 95.0f;
}

bool isValidDrawer2DhtReading(float temperature, float humidity)
{
  return !isnan(temperature) && !isnan(humidity) && temperature >= 15.0f && temperature <= 45.0f && humidity >= 20.0f && humidity <= 100.0f;
}

bool isStableDhtReading(const DhtReading &current, const DhtReading &previous, float maxTempDelta, float maxHumidityDelta)
{
  if (!previous.valid)
    return true;

  return fabsf(current.temperature - previous.temperature) <= maxTempDelta && fabsf(current.humidity - previous.humidity) <= maxHumidityDelta;
}

bool readRawDht(DHT &sensor, float &humidity, float &temperature)
{
  if (gDhtMutex)
  {
    if (xSemaphoreTake(gDhtMutex, pdMS_TO_TICKS(1500)) != pdTRUE)
      return false;
  }

  bool ok = false;

  for (int attempt = 0; attempt < DHT_READ_ATTEMPTS; attempt++)
  {
    humidity = sensor.readHumidity();
    temperature = sensor.readTemperature();
    if (!isnan(temperature) && !isnan(humidity))
    {
      ok = true;
      break;
    }
    delay(120);
  }

  if (gDhtMutex)
    xSemaphoreGive(gDhtMutex);

  return ok;
}

DhtReading readDhtAutoType(DHT &dht11, DHT &dht22, bool preferDht11, bool useDrawer1Validation, bool allowTypeFallback, const char *label)
{
  DhtReading result = {NAN, NAN, false, 0};

  float humidityPrimary = NAN;
  float temperaturePrimary = NAN;
  float humiditySecondary = NAN;
  float temperatureSecondary = NAN;

  DHT &primary = preferDht11 ? dht11 : dht22;
  DHT &secondary = preferDht11 ? dht22 : dht11;
  uint8_t primaryType = preferDht11 ? 11 : 22;
  uint8_t secondaryType = preferDht11 ? 22 : 11;

  bool primaryOk = readRawDht(primary, humidityPrimary, temperaturePrimary);
  if (primaryOk)
  {
    bool inRange = useDrawer1Validation
                       ? isValidDrawer1DhtReading(temperaturePrimary, humidityPrimary)
                       : isValidDrawer2DhtReading(temperaturePrimary, humidityPrimary);
    if (inRange)
    {
      result.temperature = temperaturePrimary;
      result.humidity = humidityPrimary;
      result.valid = true;
      result.sourceType = primaryType;
      return result;
    }
  }

  if (!allowTypeFallback)
  {
    Serial.print("[WARN] DHT ");
    Serial.print(label);
    Serial.println(" primary read invalid; fallback disabled for fixed sensor type");
    return result;
  }

  bool secondaryOk = readRawDht(secondary, humiditySecondary, temperatureSecondary);
  if (secondaryOk)
  {
    bool inRange = useDrawer1Validation
                       ? isValidDrawer1DhtReading(temperatureSecondary, humiditySecondary)
                       : isValidDrawer2DhtReading(temperatureSecondary, humiditySecondary);
    if (inRange)
    {
      result.temperature = temperatureSecondary;
      result.humidity = humiditySecondary;
      result.valid = true;
      result.sourceType = secondaryType;
      Serial.print(F("[INFO] DHT "));
      Serial.print(label);
      Serial.print(F(" fallback using DHT"));
      Serial.println(secondaryType);
      return result;
    }
  }

  return result;
}

void collectAndProcessEggLarvaeDrawer()
{
  // ----- DHTs -----
  DhtReading currentA = readDhtAutoType(dhtA11, dhtA22, true, true, true, "A");
  DhtReading currentB = readDhtAutoType(dhtB11, dhtB22, true, true, true, "B");
  DhtReading currentC = readDhtAutoType(dhtC11, dhtC22, false, true, false, "C");

  // Compact print (avoid long serial spam that can slow loops under load)
  Serial.print(F("DHT1 A:"));
  Serial.print(currentA.valid ? F("OK ") : F("X "));
  Serial.print(F("B:"));
  Serial.print(currentB.valid ? F("OK ") : F("X "));
  Serial.print(F("C:"));
  Serial.println(currentC.valid ? F("OK") : F("X"));

  float humidity = NAN;
  float temperature = NAN;

  int validSensors = 0;
  float tempSum = 0.0f, humSum = 0.0f;

  auto accept = [&](const DhtReading &cur, DhtReading &last, const char *label)
  {
    if (!cur.valid)
      return;

    if (!last.valid || isStableDhtReading(cur, last, 6.0f, 25.0f))
    {
      tempSum += cur.temperature;
      humSum += cur.humidity;
      validSensors++;
      last = cur;
    }
    else
    {
      Serial.print(F("[WARN] Drawer 1 DHT "));
      Serial.print(label);
      Serial.println(F(" rejected as unstable"));
    }
  };

  accept(currentA, lastDrawer1SensorA, "A");
  accept(currentB, lastDrawer1SensorB, "B");
  accept(currentC, lastDrawer1SensorC, "C");

  if (validSensors > 0)
  {
    temperature = tempSum / validSensors;
    humidity = humSum / validSensors;
  }
  else
  {
    Serial.println(F("[WARN] Drawer 1 has no valid DHT readings in this cycle"));
  }

  // ----- Substrate raw + % -----
  int substrate1Raw = readSubstrate1();
  int substrate2Raw = readSubstrate2();
  int substrate3Raw = readSubstrate3();

  printAds1MoistureDebug(
      (substrate1Raw < 0) ? ADS_INVALID : (int16_t)substrate1Raw,
      (substrate2Raw < 0) ? ADS_INVALID : (int16_t)substrate2Raw,
      (substrate3Raw < 0) ? ADS_INVALID : (int16_t)substrate3Raw);

  int leftSubstrate = moisturePercentFromRaw(substrate1Raw);
  int centerSubstrate = moisturePercentFromRaw(substrate2Raw);
  int rightSubstrate = moisturePercentFromRaw(substrate3Raw);

  Serial.print(F("Sub(L/C/R) raw="));
  Serial.print(substrate1Raw);
  Serial.print(F("/"));
  Serial.print(substrate2Raw);
  Serial.print(F("/"));
  Serial.print(substrate3Raw);
  Serial.print(F(" pct="));
  Serial.print(leftSubstrate);
  Serial.print(F("/"));
  Serial.print(centerSubstrate);
  Serial.print(F("/"));
  Serial.print(rightSubstrate);
  Serial.print(F(" tag="));
  Serial.print(rawRangeTag(substrate1Raw));
  Serial.print(F("/"));
  Serial.print(rawRangeTag(substrate2Raw));
  Serial.print(F("/"));
  Serial.println(rawRangeTag(substrate3Raw));

  Nh3Metrics nh3 = readNh3Metrics();

  Serial.print(F("[MQ137] raw="));
  Serial.print((nh3.raw == ADS_INVALID) ? -1 : nh3.raw);

  Serial.print(F(" vrl="));
  if (isfinite(nh3.vrl))
    Serial.print(nh3.vrl, 3);
  else
    Serial.print(F("NaN"));

  Serial.print(F(" rs_kohm="));
  if (isfinite(nh3.rs_kohm))
    Serial.print(nh3.rs_kohm, 3);
  else
    Serial.print(F("NaN"));

  Serial.print(F(" ratio="));
  if (isfinite(nh3.ratio))
    Serial.print(nh3.ratio, 3);
  else
    Serial.print(F("NaN"));

  Serial.print(F(" ppm="));
  if (isfinite(nh3.ppm))
    Serial.println(nh3.ppm, 4);
  else
    Serial.println(F("NaN"));

  // ----- Display + publish/store + control -----
  if (!isnan(humidity) && !isnan(temperature))
  {
    updateLCD1(temperature, humidity, -1);

    updateLCD2SubstratesRow(leftSubstrate, centerSubstrate, rightSubstrate);

    sendOrStoreSensorReading("Drawer 1", temperature, humidity,
                             leftSubstrate, centerSubstrate, rightSubstrate,
                             -1);

    if (isAutoControlActive())
    {
      bool offline = WiFi.status() != WL_CONNECTED;
      if (!offline || millis() >= offlineAutoControlHoldUntil)
      {
        autoControlEggLarvaeDrawer(temperature, humidity, leftSubstrate, centerSubstrate, rightSubstrate);
      }
      else
      {
        Serial.println(F("Offline auto-control skipped during manual override holdoff"));
      }
    }
  }
  else
  {
    if (lcd1Available)
    {
      selectTcaChannel(TCA_CH_LCD1);
      lcd1.clear();
      lcd1.setCursor(0, 0);
      lcd1.print(F("T:X H:X"));
      lcd1.setCursor(0, 1);
      lcd1.print(F("NH3:X"));
    }
  }
}

void collectAndProcessPupaDrawer()
{
  DhtReading currentD = readDhtAutoType(dhtD11, dhtD22, false, false, false, "D");
  DhtReading currentE = readDhtAutoType(dhtE11, dhtE22, false, false, false, "E");

  float humidityD = currentD.humidity;
  float temperatureD = currentD.temperature;
  float humidityE = currentE.humidity;
  float temperatureE = currentE.temperature;

  Serial.print("DHT D -> T:");
  Serial.print(temperatureD);
  Serial.print(" C H:");
  Serial.println(humidityD);
  Serial.print("DHT E -> T:");
  Serial.print(temperatureE);
  Serial.print(" C H:");
  Serial.println(humidityE);

  // --- Parity with EggLarvaeDrawer: average valid DHTs, display, send/store only one averaged reading ---
  float humidity = NAN;
  float temperature = NAN;
  int validSensors = 0;
  float tempSum = 0, humSum = 0;

  bool dValid = currentD.valid && (!lastDrawer2SensorD.valid || isStableDhtReading(currentD, lastDrawer2SensorD, 6.0f, 25.0f));
  bool eValid = currentE.valid && (!lastDrawer2SensorE.valid || isStableDhtReading(currentE, lastDrawer2SensorE, 6.0f, 25.0f));

  if (dValid)
  {
    tempSum += temperatureD;
    humSum += humidityD;
    validSensors++;
    lastDrawer2SensorD = currentD;
  }
  else if (currentD.valid)
  {
    Serial.println("[WARN] Drawer 2 DHT D reading rejected as unstable");
  }

  if (eValid)
  {
    tempSum += temperatureE;
    humSum += humidityE;
    validSensors++;
    lastDrawer2SensorE = currentE;
  }
  else if (currentE.valid)
  {
    Serial.println("[WARN] Drawer 2 DHT E reading rejected as unstable");
  }
  if (validSensors > 0)
  {
    temperature = tempSum / validSensors;
    humidity = humSum / validSensors;
    updateLCD2(temperature, humidity);
    sendOrStoreSensorReading("Drawer 2", temperature, humidity, -1, -1, -1, -1);
  }
  else
  {
    if (lcd2Available)
    {
      selectTcaChannel(TCA_CH_LCD2);
      lcd2.setCursor(0, 1);
      lcd2.print("T:X H:X ");
    }
    Serial.println("[WARN] Drawer 2 has no valid DHT readings in this cycle");
  }

  // --- Auto-control logic: use average if both valid, else whichever is valid ---
  bool doAutoControl = false;
  float autoTemp = NAN;
  float autoHum = NAN;
  if (dValid && eValid)
  {
    autoTemp = (temperatureD + temperatureE) / 2.0f;
    autoHum = (humidityD + humidityE) / 2.0f;
    doAutoControl = true;
  }
  else if (dValid)
  {
    autoTemp = temperatureD;
    autoHum = humidityD;
    doAutoControl = true;
  }
  else if (eValid)
  {
    autoTemp = temperatureE;
    autoHum = humidityE;
    doAutoControl = true;
  }

  if (doAutoControl && isAutoControlActive())
  {
    bool offline = WiFi.status() != WL_CONNECTED;
    if (!offline || millis() >= offlineAutoControlHoldUntil)
    {
      autoControlPupaDrawer(autoTemp, autoHum);
    }
    else
    {
      Serial.println("Offline auto-control skipped during manual override holdoff");
    }
  }
}

void sendOrStoreSensorReading(const char *drawerName, float temperature, float humidity, int leftSubstrate, int centerSubstrate, int rightSubstrate, int ammonia)
{
  // ammonia argument is legacy (old percent). Backend expects "ammonia" key, which we now treat as PPM.
  (void)ammonia;

  bool wifiConnected = WiFi.status() == WL_CONNECTED;
  bool mqttConnected = mqttEnabled && mqttClient.connected();

  // ...existing code...

  // --- Console printing for debugging ---
  Serial.print(F("[SENSOR] "));
  Serial.print(drawerName);
  Serial.print(F(" | Temp: "));
  Serial.print(temperature);
  Serial.print(F(" C | Humidity: "));
  Serial.print(humidity);
  Serial.print(F(" %"));

  if (leftSubstrate >= 0 && centerSubstrate >= 0 && rightSubstrate >= 0)
  {
    Serial.print(F(" | Substrate LCR: "));
    Serial.print(leftSubstrate);
    Serial.print(F("/"));
    Serial.print(centerSubstrate);
    Serial.print(F("/"));
    Serial.print(rightSubstrate);
    Serial.print(F(" %"));
  }

  if (strcmp(drawerName, "Drawer 1") == 0)
  {
    Nh3Metrics nh3 = readNh3Metrics();
    if (nh3.valid)
    {
      Serial.print(F(" | NH3: "));
      if (isfinite(nh3.ppm))
      {
        Serial.print(nh3.ppm, 4);
        Serial.print(F(" ppm"));
      }
      else
      {
        Serial.print(F("NaN"));
      }

      Serial.print(F(" | Rs/Ro: "));
      if (isfinite(nh3.ratio))
        Serial.print(nh3.ratio, 3);
      else
        Serial.print(F("NaN"));
    }
  }

  Serial.println();

  if (wifiConnected)
  {
    bool success = sendSensorReading(drawerName, temperature, humidity, leftSubstrate, centerSubstrate, rightSubstrate, -1);
    if (!success && sdAvailable)
    {
      storeSensorToSD(drawerName, temperature, humidity, leftSubstrate, centerSubstrate, rightSubstrate, -1);
      Serial.println(F("[MODE] Fallback: publish failed, data buffered to SD"));
    }
  }
  else if (sdAvailable)
  {
    storeSensorToSD(drawerName, temperature, humidity, leftSubstrate, centerSubstrate, rightSubstrate, -1);
    Serial.print(F("Stored offline: "));
    Serial.println(drawerName);
  }
}

void sendSensorData()
{
  collectAndProcessEggLarvaeDrawer(); // Drawer 1 (3 DHT averaged, 3 substrate sensors)
  collectAndProcessPupaDrawer();      // Drawer 2 (1 dedicated DHT22)
}

void sensorTask(void *pvParameters)
{
  (void)pvParameters;

  // Use a fixed-rate schedule to prevent drift
  TickType_t lastWake = xTaskGetTickCount();

  // Spread initial load a little so we don't collide with boot MQTT/heartbeat setup.
  vTaskDelay(pdMS_TO_TICKS(2000));
  lastWake = xTaskGetTickCount();

  for (;;)
  {
    uint32_t startMs = millis();

    sendSensorData();

    uint32_t elapsed = millis() - startMs;
    if (elapsed > (uint32_t)SENSOR_INTERVAL)
    {
      Serial.print(F("[WARN] Sensor cycle overran interval: "));
      Serial.print(elapsed);
      Serial.println(F(" ms"));
    }

    vTaskDelayUntil(&lastWake, pdMS_TO_TICKS(SENSOR_INTERVAL));
  }
}

Nh3Metrics readNh3Metrics()
{
  Nh3Metrics m{};
  m.valid = false;
  m.raw = ADS_INVALID;
  m.vrl = NAN;
  m.rs_kohm = NAN;
  m.ratio = NAN;
  m.ppm = NAN;

  if (!ads2Available || mq137Ro <= 0.0f)
    return m;

  int16_t raw = readAds2Channel(ADS2_MQ137);
  if (raw == ADS_INVALID)
    return m;

  m.raw = raw;
  m.vrl = ads2.computeVolts(raw);

  float rs = calculateRstFromRaw(raw);
  if (!(rs > 0.0f) || !isfinite(rs))
    return m;

  m.rs_kohm = rs;
  m.ratio = rs / mq137Ro;
  m.ppm = estimateNh3PpmFromRaw(raw);

  m.valid = isfinite(m.ratio) && (m.ratio > 0.0f);
  return m;
}

float calculateRstFromRaw(int16_t rawValue)
{
  if (rawValue == ADS_INVALID)
    return 0.0f;

  const float VRL = ads2.computeVolts(rawValue);
  if (!isfinite(VRL) || VRL <= 0.00001f)
    return 0.0f;

  const float Vc = MQ137_VC;

  if (VRL >= (Vc - 0.01f))
    return 0.0f;

#if MQ137_DIVIDER_INVERTED
  // Vc -> RL -> (AO=VRL) -> Rs -> GND
  // VRL = Vc * (Rs / (RL + Rs))  =>  Rs = RL * VRL / (Vc - VRL)
  float Rst = MQ137_RL * (VRL / (Vc - VRL)); // kΩ
#else
  // Vc -> Rs -> (AO=VRL) -> RL -> GND
  // VRL = Vc * (RL / (RL + Rs))  =>  Rs = ((Vc/VRL) - 1) * RL
  float Rst = ((Vc / VRL) - 1.0f) * MQ137_RL; // kΩ
#endif

  if (!isfinite(Rst) || Rst <= 0.0f)
    return 0.0f;

  return Rst;
}

float estimateNh3PpmFromRaw(int16_t rawValue)
{
  if (rawValue == ADS_INVALID || mq137Ro <= 0.0f)
    return NAN;

  float rs = calculateRstFromRaw(rawValue);
  if (!(rs > 0.0f) || !isfinite(rs))
    return NAN;

  float ratio = rs / mq137Ro;
  if (!(ratio > 0.0f) || !isfinite(ratio))
    return NAN;

  // Trust region: based on your curve points (10ppm=>0.32, 100ppm=>0.198).
  // Ratios far below ~0.1 imply very high ppm and/or model mismatch.
  const float kMinTrustedRatio = 0.10f;
  const float kMaxTrustedRatio = 10.0f;

  if (ratio < kMinTrustedRatio)
    return NAN; // out-of-model; prevents absurd ppm
  if (ratio > kMaxTrustedRatio)
    ratio = kMaxTrustedRatio;

  float ppm = MQ137_NH3_A * powf(ratio, MQ137_NH3_B);
  if (!isfinite(ppm) || ppm < 0.0f)
    return NAN;

  return ppm;
}

float calibrateMQ137()
{
  if (mq137CalibrationInProgress)
  {
    Serial.println(F("MQ137 calibration already in progress"));
    return mq137Ro;
  }

  Serial.println(F("[MQ137] Starting calibration..."));
  Serial.println(F("[MQ137] Please ensure sensor is in fresh air (20°C, 65% humidity, 21% O2)"));
  mq137CalibrationInProgress = true;

  // Take multiple readings and average them
  float RsSum = 0;
  for (int i = 0; i < MQ137_CALIBRATION_CYCLES; i++)
  {
    int16_t rawValue = readAds2Channel(ADS2_MQ137);
    float Rst = calculateRstFromRaw(rawValue);
    RsSum += Rst;

    if (i % 50 == 0)
    {
      Serial.print(F("[MQ137] Reading "));
      Serial.print(i);
      Serial.print(F("/"));
      Serial.print(MQ137_CALIBRATION_CYCLES);
      Serial.print(F(" - Rst: "));
      Serial.println(Rst);
    }

    delay(10);
  }

  float RsAverage = RsSum / MQ137_CALIBRATION_CYCLES;

  // Calculate Ro: Ro = Rst / (Rst/Ro ratio at calibration point)
  mq137Ro = RsAverage / MQ137_CALIBRATION_RATIO;
  mq137LastCalibration = getServerTime() / 1000ULL; // Store as seconds since epoch

  // Save calibration to SD card
  if (sdAvailable)
  {
    JsonDocument doc;
    doc["ro"] = mq137Ro;
    doc["timestamp"] = mq137LastCalibration;
    doc["rsAverage"] = RsAverage;
    doc["calibrationPoint"] = MQ137_CALIBRATION_PPM;

    File file = SD.open(MQ137_CALIBRATION_FILE, FILE_WRITE);
    if (file)
    {
      serializeJson(doc, file);
      file.close();
      Serial.println(F("[MQ137] Calibration data saved to SD"));
    }
    else
    {
      Serial.println(F("[MQ137] Failed to save calibration to SD"));
    }
  }

  mq137CalibrationInProgress = false;

  Serial.print(F("[MQ137] Calibration complete! Ro = "));
  Serial.println(mq137Ro);

  return mq137Ro;
}

void loadMQ137Calibration()
{
  if (!sdAvailable)
  {
    Serial.println(F("[MQ137] SD not available, calibration not loaded (Ro=0)"));
    return;
  }

  if (!SD.exists(MQ137_CALIBRATION_FILE))
  {
    Serial.println(F("[MQ137] No calibration file found (Ro=0, please calibrate)"));
    return;
  }

  File file = SD.open(MQ137_CALIBRATION_FILE, FILE_READ);
  if (!file)
  {
    Serial.println(F("[MQ137] Failed to open calibration file"));
    return;
  }

  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, file);
  file.close();

  if (error)
  {
    Serial.print(F("[MQ137] Failed to parse calibration: "));
    Serial.println(error.f_str());
    return;
  }

  // ArduinoJson v7+ friendly: avoid containsKey()
  if (doc["ro"].is<float>() || doc["ro"].is<int>() || doc["ro"].is<double>())
  {
    mq137Ro = doc["ro"].as<float>();

    // timestamp is optional; only read if present and numeric
    if (doc["timestamp"].is<unsigned long>() || doc["timestamp"].is<long>() || doc["timestamp"].is<uint32_t>())
      mq137LastCalibration = doc["timestamp"].as<unsigned long>();

    Serial.print(F("[MQ137] Loaded calibration - Ro = "));
    Serial.print(mq137Ro);
    Serial.print(F(" (timestamp: "));
    Serial.print(mq137LastCalibration);
    Serial.println(F(")"));
  }
  else
  {
    Serial.println(F("[MQ137] Calibration file missing numeric 'ro', using Ro=0 (not calibrated)"));
    mq137Ro = 0.0f;
  }
}

void mq137CalibrationTask(void *pvParameters)
{
  (void)pvParameters;

  mq137CalibrationInProgress = true;
  mq137CalProgress = 0;
  mq137CalValidSamples = 0;
  mq137CalLastRsAvg = NAN;

  float RsSum = 0.0f;
  uint16_t valid = 0;

  for (int i = 0; i < MQ137_CALIBRATION_CYCLES; i++)
  {
    int16_t rawValue = readAds2Channel(ADS2_MQ137);
    float Rst = calculateRstFromRaw(rawValue);

    if (Rst > 0.0f && isfinite(Rst))
    {
      RsSum += Rst;
      valid++;
    }

    if ((i % 50) == 0)
    {
      Serial.print(F("[MQ137] Reading "));
      Serial.print(i);
      Serial.print(F("/"));
      Serial.print(MQ137_CALIBRATION_CYCLES);
      Serial.print(F(" - Rst: "));
      Serial.print(Rst);
      Serial.print(F(" valid="));
      Serial.println(valid);
    }

    mq137CalProgress = (uint16_t)((100UL * (uint32_t)(i + 1)) / (uint32_t)MQ137_CALIBRATION_CYCLES);
    mq137CalValidSamples = valid;

    vTaskDelay(pdMS_TO_TICKS(10));
  }

  if (valid == 0)
  {
    Serial.println(F("[MQ137] Calibration failed: no valid samples"));
    mq137CalibrationInProgress = false;
    mq137CalTaskHandle = nullptr;
    vTaskDelete(nullptr);
    return;
  }

  float RsAverage = RsSum / (float)valid;
  mq137CalLastRsAvg = RsAverage;

  mq137Ro = RsAverage / MQ137_CALIBRATION_RATIO;

  // Prefer server time if available; else store 0 (unknown) instead of wrong epoch.
  uint64_t serverNow = getServerTime();
  mq137LastCalibration = (serverNow > 0) ? (float)(serverNow / 1000ULL) : 0.0f;

  // Save calibration to SD card
  if (sdAvailable)
  {
    JsonDocument doc;
    doc["ro"] = mq137Ro;
    doc["timestamp"] = mq137LastCalibration;
    doc["rsAverage"] = RsAverage;
    doc["validSamples"] = valid;
    doc["calibrationPoint"] = MQ137_CALIBRATION_PPM;

    File file = SD.open(MQ137_CALIBRATION_FILE, FILE_WRITE);
    if (file)
    {
      serializeJson(doc, file);
      file.close();
      Serial.println(F("[MQ137] Calibration data saved to SD"));
    }
    else
    {
      Serial.println(F("[MQ137] Failed to save calibration to SD"));
    }
  }

  mq137CalibrationInProgress = false;
  mq137CalTaskHandle = nullptr;

  Serial.print(F("[MQ137] Calibration complete! Ro = "));
  Serial.println(mq137Ro);

  vTaskDelete(nullptr);
}
