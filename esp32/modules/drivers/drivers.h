#ifndef DRIVERS_H
#define DRIVERS_H

#include <Arduino.h>

// MUX helpers
void selectMuxChannel(uint8_t channel);
int readMuxAnalog(uint8_t channel);

// TCA9548A / LCD helpers
void selectTcaChannel(uint8_t channel);
void updateLCD1(float temp, float humidity, int moisture, int ammonia);
void updateLCD2(float temp, float humidity);
void displayLCDMessage(uint8_t lcdNum, const char *line1, const char *line2);

// ADS1115 helpers
int16_t readAds1Channel(uint8_t channel);
int16_t readAds2Channel(uint8_t channel);

#endif // DRIVERS_H
