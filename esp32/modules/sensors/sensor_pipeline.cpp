#include "sensor_pipeline.h"

// External dependencies
extern DHT dhtA11, dhtB11, dhtC11, dhtD11, dhtE11;
extern DHT dhtA22, dhtB22, dhtC22, dhtD22, dhtE22;
extern struct DhtReading lastDrawer1SensorA, lastDrawer1SensorB, lastDrawer1SensorC;
extern struct DhtReading lastDrawer2SensorD, lastDrawer2SensorE;
extern int gMoistureRawDry, gMoistureRawWet;
extern bool sdAvailable;
extern String DEVICE_ID;
extern bool mqttEnabled;
extern PubSubClient mqttClient;
extern bool isAutoControlActive();
extern void autoControlEggLarvaeDrawer(float temp, float humidity, int avgMoisture);
extern void autoControlPupaDrawer(float temp, float humidity);
extern void updateLCD1(float temp, float humidity, int moisture, int ammonia);
extern void updateLCD2(float temp, float humidity);
extern bool lcd1Available, lcd2Available;
extern LiquidCrystal_I2C lcd1, lcd2;
extern void selectTcaChannel(int channel);
extern int readSubstrate1(), readSubstrate2(), readSubstrate3();
extern struct Nh3Metrics readNh3Metrics();
extern void storeSensorToSD(const char *drawerName, float temperature, float humidity, 
                           int leftSubstrate, int centerSubstrate, int rightSubstrate, int ammonia);
extern void publishActuatorStateBool(const char *actuator, bool state);
extern unsigned long offlineAutoControlHoldUntil;

#define TCA_CH_LCD1 0
#define TCA_CH_LCD2 1

void initSensorPipeline()
{
  // Sensor initialization if needed
}

SensorReading collectSensorData()
{
  SensorReading reading;
  reading.timestamp = getServerTime();
  
  // Placeholder - actual implementation delegates to drawer-specific functions
  collectAndProcessEggLarvaeDrawer(reading);
  collectAndProcessPupaDrawer(reading);
  
  return reading;
}

void sendOrStoreSensorReading(const char *drawerName, float temperature, float humidity, 
                             int leftSubstrate, int centerSubstrate, int rightSubstrate, int ammonia)
{
  (void)ammonia;

  bool wifiConnected = WiFi.status() == WL_CONNECTED;
  bool mqttConnected = mqttEnabled && mqttClient.connected();

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
          Serial.print(nh3.ppm, 2);
        Serial.print(F(" ppm"));
      }
      else
      {
        Serial.print(F("NaN"));
      }

      Serial.print(F(" | Rs/Ro: "));
      if (isfinite(nh3.ratio))
        Serial.print(nh3.ratio, 2);
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

void readNh3Metrics(float& ppm, int& raw)
{
  Nh3Metrics nh3 = readNh3Metrics();
  ppm = nh3.ppm;
  raw = nh3.raw;
}

void collectAndProcessEggLarvaeDrawer(SensorReading& reading)
{
  // ----- DHTs -----
  DhtReading currentA = readDhtAutoType(dhtA11, dhtA22, true, true, true, "A");
  DhtReading currentB = readDhtAutoType(dhtB11, dhtB22, true, true, true, "B");
  DhtReading currentC = readDhtAutoType(dhtC11, dhtC22, false, true, false, "C");

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

  int leftSubstrate = moisturePercentFromRawValue(substrate1Raw, gMoistureRawDry, gMoistureRawWet);
  int centerSubstrate = moisturePercentFromRawValue(substrate2Raw, gMoistureRawDry, gMoistureRawWet);
  int rightSubstrate = moisturePercentFromRawValue(substrate3Raw, gMoistureRawDry, gMoistureRawWet);

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
  Serial.print(moistureRawRangeTag(substrate1Raw, gMoistureRawDry, gMoistureRawWet));
  Serial.print(F("/"));
  Serial.print(moistureRawRangeTag(substrate2Raw, gMoistureRawDry, gMoistureRawWet));
  Serial.print(F("/"));
  Serial.println(moistureRawRangeTag(substrate3Raw, gMoistureRawDry, gMoistureRawWet));

  Nh3Metrics nh3 = readNh3Metrics();

  Serial.print(F("[MQ137] raw="));
  Serial.print((nh3.raw == ADS_INVALID) ? -1 : nh3.raw);

  Serial.print(F(" vrl="));
  if (isfinite(nh3.vrl))
    Serial.print(nh3.vrl, 2);
  else
    Serial.print(F("NaN"));

  Serial.print(F(" rs_kohm="));
  if (isfinite(nh3.rs_kohm))
    Serial.print(nh3.rs_kohm, 2);
  else
    Serial.print(F("NaN"));

  Serial.print(F(" ratio="));
  if (isfinite(nh3.ratio))
    Serial.print(nh3.ratio, 2);
  else
    Serial.print(F("NaN"));

  Serial.print(F(" ppm="));
  if (isfinite(nh3.ppm))
    Serial.println(nh3.ppm, 2);
  else
    Serial.println(F("NaN"));

  if (!isnan(humidity) && !isnan(temperature))
  {
    int avgMoisture = -1;
    if (leftSubstrate >= 0 && centerSubstrate >= 0 && rightSubstrate >= 0)
      avgMoisture = (leftSubstrate + centerSubstrate + rightSubstrate) / 3;

    updateLCD1(temperature, humidity, avgMoisture, -1);

    sendOrStoreSensorReading("Drawer 1", temperature, humidity,
                             leftSubstrate, centerSubstrate, rightSubstrate, -1);

    if (isAutoControlActive())
    {
      bool offline = WiFi.status() != WL_CONNECTED;
      if (!offline || millis() >= offlineAutoControlHoldUntil)
      {
        autoControlEggLarvaeDrawer(temperature, humidity, (avgMoisture >= 0 ? avgMoisture : 0));
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
      lcd1.print(F("S:X NH3:X"));
    }
  }
}

void collectAndProcessPupaDrawer(SensorReading& reading)
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
      lcd2.clear();
      lcd2.setCursor(0, 0);
      lcd2.print("T:X ");
      lcd2.print(" H:X ");
    }
    Serial.println("[WARN] Drawer 2 has no valid DHT readings in this cycle");
  }

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
