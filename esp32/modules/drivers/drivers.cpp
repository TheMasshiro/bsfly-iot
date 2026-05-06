#include "drivers.h"
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

extern bool tcaAvailable;
extern LiquidCrystal_I2C lcd1, lcd2;
extern bool lcd1Available, lcd2Available;
extern Adafruit_ADS1X15 ads1, ads2;
extern bool ads1Available, ads2Available;

// readNh3Metrics() defined in main.ino
extern Nh3Metrics readNh3Metrics();

#define TCA9548A_ADDR 0x70
#define TCA_CH_LCD1 0
#define TCA_CH_LCD2 1

void selectMuxChannel(uint8_t channel)
{
  digitalWrite(MUX_S0, channel & 0x01);
  digitalWrite(MUX_S1, (channel >> 1) & 0x01);
  digitalWrite(MUX_S2, (channel >> 2) & 0x01);
  digitalWrite(MUX_S3, (channel >> 3) & 0x01);
  delayMicroseconds(100);
}

int readMuxAnalog(uint8_t channel)
{
  selectMuxChannel(channel);
  return analogRead(MUX_SIG);
}

void selectTcaChannel(uint8_t channel)
{
  if (!tcaAvailable)
  {
    i2cErrorCount++;
    Serial.println(F("[WARN] TCA9548A not available, cannot select channel"));
    return;
  }
  Wire.beginTransmission(TCA9548A_ADDR);
  Wire.write(1 << channel);
  Wire.endTransmission();
}

void updateLCD1(float temp, float humidity, int moisture, int ammonia)
{
  (void)ammonia;
  if (!lcd1Available)
    return;

  Nh3Metrics nh3 = readNh3Metrics();

  selectTcaChannel(TCA_CH_LCD1);
  lcd1.clear();
  lcd1.setCursor(0, 0);

  if (!isnan(temp))
  {
    lcd1.print("T:");
    lcd1.print(temp, 2);
    lcd1.print("C ");
  }
  else
  {
    lcd1.print("T:X ");
  }

  if (!isnan(humidity))
  {
    lcd1.print("H:");
    lcd1.print((int)humidity);
    lcd1.print("%");
  }
  else
  {
    lcd1.print("H:X");
  }

  lcd1.setCursor(0, 1);

  if (moisture >= 0 && moisture <= 100)
  {
    lcd1.print("S:");
    lcd1.print(moisture);
    lcd1.print(" ");
  }
  else
  {
    lcd1.print("S:X ");
  }

  if (isfinite(nh3.ppm))
  {
    lcd1.print("NH3:");
    lcd1.print(nh3.ppm, 2);
    lcd1.print("ppm");
  }
  else if (isfinite(nh3.ratio))
  {
    lcd1.print("R:");
    lcd1.print(nh3.ratio, 2);
    lcd1.print("    ");
  }
  else
  {
    lcd1.print("NH3:X");
  }
}

void updateLCD2(float temp, float humidity)
{
  if (!lcd2Available)
    return;
  selectTcaChannel(TCA_CH_LCD2);
  lcd2.clear();
  lcd2.setCursor(0, 0);

  if (!isnan(temp))
  {
    lcd2.print("T:");
    lcd2.print(temp, 2);
    lcd2.print("C ");
  }
  else
  {
    lcd2.print("T:X ");
  }

  if (!isnan(humidity))
  {
    lcd2.print("H:");
    lcd2.print((int)humidity);
    lcd2.print("%");
  }
  else
  {
    lcd2.print("H:X");
  }
}

void displayLCDMessage(uint8_t lcdNum, const char *line1, const char *line2)
{
  if (lcdNum == 1 && !lcd1Available)
    return;
  if (lcdNum == 2 && !lcd2Available)
    return;

  selectTcaChannel(lcdNum == 1 ? TCA_CH_LCD1 : TCA_CH_LCD2);
  LiquidCrystal_I2C &lcd = (lcdNum == 1) ? lcd1 : lcd2;

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1);
  lcd.setCursor(0, 1);
  lcd.print(line2);
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
