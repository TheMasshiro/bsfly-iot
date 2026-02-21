# ESP32 Pin Map

## Global Shared Buses

| Bus | Pins |
|-----|------|
| I²C SDA | GPIO21 |
| I²C SCL | GPIO22 |
| SPI SCK | GPIO18 |
| SPI MISO | GPIO19 |
| SPI MOSI | GPIO23 |
| SPI CS (microSD) | GPIO15 |

## Global Multiplexer Wiring

| Device | Module Pin | ESP32 Pin |
|--------|------------|-----------|
| CD74HC4067 | SIG | GPIO35 (ADC1) |
| CD74HC4067 | S0 | GPIO16 |
| CD74HC4067 | S1 | GPIO17 |
| CD74HC4067 | S2 | GPIO25 |
| CD74HC4067 | S3 | GPIO26 |
| CD74HC4067 | EN | GND |
| TCA9548A | SDA/SCL | GPIO21/GPIO22 |
| ADS1115 #1 | I²C (0x48) | GPIO21/GPIO22 |
| ADS1115 #2 | I²C (0x49) | GPIO21/GPIO22 |
| MCP23017 | I²C (0x20) | GPIO21/GPIO22 |

## Drawer 1 + 2 (Shared Set)

| ESP32 Pin | Multiplexer | Sensor/Actuator |
|-----------|-------------|-----------------|
| GPIO27 | — | DHT22 #A |
| GPIO13 | — | DHT22 #B |
| GPIO35 | CD74HC4067 C0 | Soil #1 |
| GPIO35 | CD74HC4067 C1 | Soil #2 |
| GPIO35 | CD74HC4067 C2 | Soil #3 |
| I²C | ADS1115 #1 A3 | MQ137 #1 |
| I²C | TCA9548A CH0 | OLED #1 |
| I²C | MCP23017 GPA0 | Humidifier #1 |
| I²C | MCP23017 GPA1 | Humidifier #2 |
| I²C | MCP23017 GPA2 | Heater |
| I²C | MCP23017 GPA3 | Fan #1 |
| I²C | MCP23017 GPA4 | Fan #2 |
| I²C | MCP23017 GPA5 | Fan #3 |
| I²C | MCP23017 GPA6 | Fan #4 |

## Drawer 3 (Separate Set)

| ESP32 Pin | Multiplexer | Sensor/Actuator |
|-----------|-------------|-----------------|
| GPIO33 | — | DHT22 #C |
| I²C | TCA9548A CH1 | OLED #2 |
| I²C | MCP23017 GPB0 | Humidifier #3 |
| I²C | MCP23017 GPB1 | Fan #5 |

## ADS1115 Allocation

| ADS Chip | Address | Channels |
|----------|---------|----------|
| ADS1115 #1 | 0x48 | A0=Soil #1, A1=Soil #2, A2=Soil #3, A3=MQ137 #1 |
| ADS1115 #2 | 0x49 | spare |

## MCP23017 Pin Reference

| Pin | Purpose |
|-----|---------|
| GPA0 | Humidifier 1 |
| GPA1 | Humidifier 2 |
| GPA2 | Heater |
| GPA3 | Fan 1 |
| GPA4 | Fan 2 |
| GPA5 | Fan 3 |
| GPA6 | Fan 4 |
| GPA7 | spare |
| GPB0 | Humidifier 3 (drawer 3) |
| GPB1 | Fan 5 (drawer 3) |
| GPB2–GPB7 | spare |
