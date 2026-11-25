#include "Net.h"
#include <WiFiManager.h>

void connectWifi()
{
  // WiFiManager
  WiFi.setTxPower(WIFI_POWER_19_5dBm);
  WiFi.setSleep(false);
  WiFiManager wm;
#ifdef USE_STATIC_IP
  wm.setSTAStaticIPConfig(IPAddress(IP_STA), IPAddress(IP_GW), IPAddress(SUBNET), IPAddress(IP_DNS));
#endif
  wm.setConfigPortalTimeout(180);

  bool res = wm.autoConnect(SETUP_AP_NAME, SETUP_AP_PASSWORD);

  if (!res)
  {
    Serial.println(F("Failed to connect to WiFi"));
    delay(2000);
    ESP.restart();
  }
  else
  {
    Serial.print(F("Connected! IP: "));
    Serial.println(WiFi.localIP());

    DEVICE_ID = WiFi.macAddress();
    DEVICE_ID_CLEAN = DEVICE_ID;
    DEVICE_ID_CLEAN.replace(":", "");

    Serial.print(F("Device ID: "));
    Serial.println(DEVICE_ID);
    Serial.print(F("Device ID (clean): "));
    Serial.println(DEVICE_ID_CLEAN);
  }
}
