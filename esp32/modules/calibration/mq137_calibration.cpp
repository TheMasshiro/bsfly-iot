#include "mq137_calibration.h"
#include <ArduinoJson.h>
#include <SD.h>

// Global variables
float mq137Ro = 10.0;
unsigned long mq137LastCalibration = 0;
bool mq137CalibrationInProgress = false;

// External dependencies
extern int readMQ137();
extern unsigned long getServerTime();
extern bool sdAvailable();

float calculateRstFromRaw(int rawValue) {
  float voltage = (rawValue / 32767.0) * 3.3;
  float Rst = MQ137_RL * (MQ137_VC - voltage) / voltage;
  return Rst;
}

float calibrateMQ137() {
  mq137CalibrationInProgress = true;
  const int SAMPLE_COUNT = 500;
  const int SAMPLE_INTERVAL_MS = 10;
  const int VALID_THRESHOLD = 100;
  
  int validSamples = 0;
  float sumRstRatio = 0.0;
  
  // Collect samples
  for (int i = 0; i < SAMPLE_COUNT; i++) {
    int rawValue = readMQ137();
    
    // Filter out invalid/zero readings
    if (rawValue > VALID_THRESHOLD) {
      float Rst = calculateRstFromRaw(rawValue);
      if (Rst > 0) {
        float ratio = Rst / MQ137_CALIBRATION_RATIO;
        if (ratio > 0 && ratio < 1000.0) { // Sanity check
          sumRstRatio += ratio;
          validSamples++;
        }
      }
    }
    
    delay(SAMPLE_INTERVAL_MS);
  }
  
  // Compute Ro from valid samples
  if (validSamples > 50) {
    mq137Ro = sumRstRatio / validSamples;
  } else {
    mq137CalibrationInProgress = false;
    return -1.0; // Insufficient valid samples
  }
  
  // Save to SD if available
  if (sdAvailable()) {
    File file = SD.open("/mq137_calibration.json", FILE_WRITE);
    if (file) {
      DynamicJsonDocument doc(256);
      doc["timestamp"] = getServerTime();
      doc["ro"] = mq137Ro;
      doc["samples"] = validSamples;
      
      serializeJson(doc, file);
      file.close();
    }
  }
  
  mq137LastCalibration = getServerTime();
  mq137CalibrationInProgress = false;
  return mq137Ro;
}

void loadMQ137Calibration() {
  if (!sdAvailable()) {
    return;
  }
  
  File file = SD.open("/mq137_calibration.json");
  if (!file) {
    return;
  }
  
  DynamicJsonDocument doc(256);
  if (deserializeJson(doc, file) == DeserializationError::Ok) {
    mq137Ro = doc["ro"] | 10.0;
    mq137LastCalibration = doc["timestamp"] | 0;
  }
  file.close();
}

float estimateNh3PpmFromRaw(int rawValue) {
  if (mq137Ro <= 0) {
    return -1.0;
  }
  
  float Rst = calculateRstFromRaw(rawValue);
  if (Rst <= 0) {
    return -1.0;
  }
  
  float ratio = Rst / mq137Ro;
  float ppm = MQ137_NH3_A * pow(ratio, MQ137_NH3_B);
  
  return ppm > 0 ? ppm : 0.0;
}
