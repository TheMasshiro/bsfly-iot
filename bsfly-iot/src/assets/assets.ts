import {
  cloudOutline,
  leafOutline,
  thermometerOutline,
  waterOutline,
} from "ionicons/icons";

export const sensorsData = [
  {
    name: "Temperature",
    value: "--",
    unit: "°C",
    icon: thermometerOutline,
    type: "temperature",
  },
  {
    name: "Humidity",
    value: "--",
    unit: "%",
    icon: cloudOutline,
    type: "humidity",
  },
  {
    name: "Substrate Moisture",
    value: "--",
    unit: "%",
    icon: waterOutline,
    type: "moisture",
  },
  {
    name: "Ammonia",
    value: "--",
    unit: "ppm",
    icon: leafOutline,
    type: "ammonia",
  },
];

interface TimeProps {
  id: number;
  name: string;
  seconds: number;
}

export const timers: TimeProps[] = [
  {
    id: 1,
    name: "Off",
    seconds: 0,
  },
  {
    id: 2,
    name: "On",
    seconds: 28800,
  },
];

export const controlsData = [
  {
    sensor: "Temperature",
    name: "Fan",
    description: "Reduces Temperature (controls Fan 1-4 for Drawer 1+2, Fan 5 for Drawer 3)",
    available: true,
  },
  {
    sensor: "Temperature",
    name: "Heater",
    description: "Increases Temperature (Drawer 1+2 only)",
    available: true,
  },
  {
    sensor: "Humidity",
    name: "Humidifier",
    description: "Increases Humidity (Humidifier 1-2 for Drawer 1+2, Humidifier 3 for Drawer 3)",
    available: true,
  },
  {
    sensor: "Humidity",
    name: "Dehumidifier",
    description: "Decreases Humidity",
    available: true,
  },
  {
    sensor: "Substrate Moisture",
    name: "Misting Device",
    description: "Increases Moisture",
    available: true,
  },
  {
    sensor: "Ammonia",
    name: "Ammonia Sensor",
    description:
      "Monitors ammonia levels continuously with no manual controls. System responses appear in the dashboard, and notifications are sent based on sensor data.",
    available: false,
  },
];

export const drawerActuatorMap = {
  "Drawer 1": {
    Fan: ["fan1", "fan2", "fan3", "fan4"],
    Heater: ["heater"],
    Humidifier: ["humidifier1", "humidifier2"],
  },
  "Drawer 2": {
    Fan: ["fan1", "fan2", "fan3", "fan4"],
    Heater: ["heater"],
    Humidifier: ["humidifier1", "humidifier2"],
  },
  "Drawer 3": {
    Fan: ["fan5"],
    Humidifier: ["humidifier3"],
  },
} as const;
