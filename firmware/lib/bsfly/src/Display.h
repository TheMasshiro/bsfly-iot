#pragma once

#include "State.h"

void beginDisplay();
void selectTcaChannel(uint8_t channel);
void updateLCD1(float temp, float humidity, int ammonia);
void updateLCD2SubstratesRow(int leftPct, int centerPct, int rightPct);
void updateLCD2(float temp, float humidity);
void displayLCDMessage(uint8_t lcdNum, const char *line1, const char *line2);
