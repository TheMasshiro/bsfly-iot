#include <Arduino.h>
#include <ArduinoJson.h>
#include <SD.h>

#include "mq137_calibration.h"

extern bool sdAvailable;
extern int readMQ137();
extern uint64_t getServerTime();

float calibrateMQ137()
{
  if (mq137CalibrationInProgress)
  {
    Serial.println(F("MQ137 calibration already in progress"));
    return mq137Ro;
  }

  Serial.println(F("[MQ137] Starting calibration..."));
  Serial.println(F("[MQ137] Please ensure sensor is in fresh air (20C, 65% humidity, 21% O2)"));
  mq137CalibrationInProgress = true;

  float rsSum = 0.0f;
  uint16_t valid = 0;

  for (int i = 0; i < MQ137_CALIBRATION_CYCLES; i++)
  {
    int16_t rawValue = (int16_t)readMQ137();
    float rst = calculateRstFromRaw(rawValue);
    if (rst > 0.0f && isfinite(rst))
    {
      rsSum += rst;
      valid++;
    }

    if (i % 50 == 0)
    {
      Serial.print(F("[MQ137] Reading "));
      Serial.print(i);
      Serial.print(F("/"));
      Serial.print(MQ137_CALIBRATION_CYCLES);
      Serial.print(F(" - Rst: "));
      Serial.println(rst);
    }

    delay(10);
  }

  if (valid == 0)
  {
    mq137CalibrationInProgress = false;
    Serial.println(F("[MQ137] Calibration failed: no valid samples"));
    return mq137Ro;
  }

  float rsAverage = rsSum / (float)valid;

  mq137Ro = rsAverage / MQ137_CALIBRATION_RATIO;
  mq137LastCalibration = getServerTime() / 1000ULL;

  if (sdAvailable)
  {
    JsonDocument doc;
    doc["ro"] = mq137Ro;
    doc["timestamp"] = mq137LastCalibration;
    doc["rsAverage"] = rsAverage;
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
  Serial.print(F("[MQ137] Valid samples: "));
  Serial.println(valid);

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

  if (doc["ro"].is<float>() || doc["ro"].is<int>() || doc["ro"].is<double>())
  {
    mq137Ro = doc["ro"].as<float>();

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
