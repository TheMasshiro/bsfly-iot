// Simple sketch to get ESP32 MAC Address
// Upload this, open Serial Monitor at 115200 baud, then use the MAC in the app Settings

#include <WiFi.h>

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n================================");
  Serial.println("ESP32 MAC Address Finder");
  Serial.println("================================\n");
  
  String mac = WiFi.macAddress();
  
  Serial.print("MAC Address: ");
  Serial.println(mac);
  
  Serial.println("\n--> Use this MAC address to register your device in the app Settings page");
  Serial.println("================================\n");
}

void loop() {
  // Blink built-in LED to show it's running
  delay(1000);
}
