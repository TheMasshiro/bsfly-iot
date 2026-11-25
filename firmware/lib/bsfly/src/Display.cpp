#include "Display.h"
#include "Sensors.h"

void beginDisplay()
{
  // TCA9548A (DEGRADED MODE: do not return from setup())
  tcaAvailable = false;
  Wire.beginTransmission(TCA9548A_ADDR);
  if (Wire.endTransmission() == 0)
  {
    Serial.println(F("TCA9548A detected"));
    tcaAvailable = true;
  }
  else
  {
    Serial.println(F("TCA9548A not found (degraded mode: LCD disabled)"));
    // DO NOT return;
  }

  // LCD #1
  if (tcaAvailable)
  {
    selectTcaChannel(TCA_CH_LCD1);
    lcd1.init();
    lcd1Available = true;
    lcd1.setBacklight(255);
    lcd1.setCursor(0, 0);
    lcd1.print(F("Drawer 1"));
    lcd1.setCursor(0, 1);
    lcd1.print(F("Initializing..."));
    delay(200);
  }
  else
  {
    lcd1Available = false;
  }

  // LCD #2
  if (tcaAvailable)
  {
    selectTcaChannel(TCA_CH_LCD2);
    lcd2.init();
    lcd2Available = true;
    lcd2.setBacklight(255);
    lcd2.setCursor(0, 0);
    lcd2.print(F("Drawer 2"));
    lcd2.setCursor(0, 1);
    lcd2.print(F("Initializing..."));
    delay(200);
  }
  else
  {
    lcd2Available = false;
  }
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

void updateLCD1(float temp, float humidity, int ammonia)
{
  (void)ammonia; // Option A: legacy % not used anymore

  if (!lcd1Available)
    return;

  Nh3Metrics nh3 = readNh3Metrics();

  selectTcaChannel(TCA_CH_LCD1);
  lcd1.clear();
  lcd1.setCursor(0, 0);

  // Temperature
  if (!isnan(temp))
  {
    lcd1.print("T:");
    lcd1.print(temp, 1);
    lcd1.print("C ");
  }
  else
  {
    lcd1.print("T:X ");
  }

  // Humidity
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

  // NH3: show ppm if available; if ppm is too tiny/NaN, show ratio
  if (isfinite(nh3.ppm))
  {
    lcd1.print("NH3:");
    if (nh3.ppm < 10.0f)
      lcd1.print(nh3.ppm, 2); // e.g. 0.1, 2.3
    else
      lcd1.print((int)(nh3.ppm + 0.5f)); // e.g. 12, 105

    lcd1.print("ppm");

    if (nh3.ppm > DRAWER1_AMMONIA_MAX)
    {
      Serial.print(F("[WARN] Drawer 1 ammonia above threshold: "));
      Serial.print(nh3.ppm, 2);
      Serial.print(F(" ppm > "));
      Serial.println(DRAWER1_AMMONIA_MAX, 0);
    }
  }
  else if (isfinite(nh3.ratio))
  {
    lcd1.print("R:");
    lcd1.print(nh3.ratio, 2); // Rs/Ro
    lcd1.print("    ");       // pad
  }
  else
  {
    lcd1.print("NH3:X");
  }
}

void updateLCD2SubstratesRow(int leftPct, int centerPct, int rightPct)
{
  if (!lcd2Available)
    return;

  selectTcaChannel(TCA_CH_LCD2);
  lcd2.setCursor(0, 0);

  // Example: "S 68/63/100 "
  // Keep it within 16 chars.
  char row0[17];
  snprintf(row0, sizeof(row0), "S:%3d/%3d/%3d",
           (leftPct >= 0 && leftPct <= 100) ? leftPct : -1,
           (centerPct >= 0 && centerPct <= 100) ? centerPct : -1,
           (rightPct >= 0 && rightPct <= 100) ? rightPct : -1);

  // Ensure fixed width (pad with spaces)
  for (size_t i = strlen(row0); i < 16; i++)
    row0[i] = ' ';
  row0[16] = '\0';

  lcd2.print(row0);
}

void updateLCD2(float temp, float humidity)
{
  if (!lcd2Available)
    return;
  selectTcaChannel(TCA_CH_LCD2);
  lcd2.setCursor(0, 1);

  char row1[17];

  // Row 1 example: "T:29.4C H:63%"
  // Fits 16 chars.
  if (!isnan(temp) && !isnan(humidity))
  {
    snprintf(row1, sizeof(row1), "T:%4.1fC H:%2d%%", temp, (int)humidity);
  }
  else if (!isnan(temp))
  {
    snprintf(row1, sizeof(row1), "T:%4.1fC H:X  ", temp);
  }
  else if (!isnan(humidity))
  {
    snprintf(row1, sizeof(row1), "T:X    H:%2d%%", (int)humidity);
  }
  else
  {
    snprintf(row1, sizeof(row1), "T:X    H:X   ");
  }

  // Pad/truncate to 16
  row1[16] = '\0';
  lcd2.print(row1);
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
