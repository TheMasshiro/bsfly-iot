// MQ137 Ammonia Sensor Calibration Header
// This file contains calibration functions for the MQ137 sensor

#ifndef MQ137_CALIBRATION_H
#define MQ137_CALIBRATION_H

// External variables (defined in main.ino)
extern float mq137Ro;
extern float mq137LastCalibration;
extern bool mq137CalibrationInProgress;

// Calculate sensor resistance (Rs) from raw ADC value
float calculateRsFromRaw(int16_t rawValue)
{
  // Convert ADC reading to voltage (0-1.024V for ADS1115 with GAIN_ONE)
  float VRL = (rawValue / 32767.0) * 1.024;
  
  if (VRL == 0) return 0;
  
  // Calculate Rs: Rs = ((Vc/VRL)-1)*RL
  // Assuming Vc = 5V (typical for MQ137)
  float Rs = ((5.0 / VRL) - 1.0) * MQ137_RL;
  return Rs;
}

// Perform MQ137 calibration
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
    int16_t rawValue = readAds1Channel(ADS_MQ137);
    float Rs = calculateRsFromRaw(rawValue);
    RsSum += Rs;
    
    if (i % 50 == 0)
    {
      Serial.print(F("[MQ137] Reading "));
      Serial.print(i);
      Serial.print(F("/"));
      Serial.print(MQ137_CALIBRATION_CYCLES);
      Serial.print(F(" - Rs: "));
      Serial.println(Rs);
    }
    
    delay(10);
  }

  float RsAverage = RsSum / MQ137_CALIBRATION_CYCLES;
  
  // Calculate Ro: Ro = Rs / (Rs/Ro ratio at calibration point)
  mq137Ro = RsAverage / MQ137_CALIBRATION_RATIO;
  mq137LastCalibration = time(nullptr);
  
  // Save calibration to SD card
  if (sdAvailable)
  {
    StaticJsonDocument<256> doc;
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

// Load calibration from SD card
void loadMQ137Calibration()
{
  if (!sdAvailable)
  {
    Serial.println(F("[MQ137] SD not available, using default Ro = 3.6"));
    return;
  }

  if (!SD.exists(MQ137_CALIBRATION_FILE))
  {
    Serial.println(F("[MQ137] No calibration file found, using default Ro = 3.6"));
    return;
  }

  File file = SD.open(MQ137_CALIBRATION_FILE, FILE_READ);
  if (!file)
  {
    Serial.println(F("[MQ137] Failed to open calibration file"));
    return;
  }

  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, file);
  file.close();

  if (error)
  {
    Serial.print(F("[MQ137] Failed to parse calibration: "));
    Serial.println(error.f_str());
    return;
  }

  if (doc.containsKey("ro"))
  {
    mq137Ro = doc["ro"].as<float>();
    mq137LastCalibration = doc["timestamp"].as<unsigned long>();
    Serial.print(F("[MQ137] Loaded calibration - Ro = "));
    Serial.print(mq137Ro);
    Serial.print(F(" (timestamp: "));
    Serial.print(mq137LastCalibration);
    Serial.println(F(")"));
  }
}

#endif
