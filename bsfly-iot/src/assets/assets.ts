import {
  cloudOutline,
  leafOutline,
  thermometerOutline,
  waterOutline,
} from "ionicons/icons";

export const sensorsData = [
  {
    name: "Temperature",
    value: 14.5,
    unit: "°C",
    icon: thermometerOutline,
    type: "temperature",
  },
  {
    name: "Humidity",
    value: 20,
    unit: "%",
    icon: cloudOutline,
    type: "humidity",
  },
  {
    name: "Substrate Moisture 1",
    value: 40,
    unit: "%",
    icon: waterOutline,
    type: "moisture",
  },
  {
    name: "Substrate Moisture 2",
    value: 60,
    unit: "%",
    icon: waterOutline,
    type: "moisture",
  },
  {
    name: "Ammonia",
    value: 25,
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
    description: "Reduces Temperature",
    available: true,
  },
  {
    sensor: "Temperature",
    name: "Heater",
    description: "Increases Temperature",
    available: true,
  },
  {
    sensor: "Humidity",
    name: "Humidifier",
    description: "Increases Humidity",
    available: true,
  },
  {
    sensor: "Humidity",
    name: "Dehumidifier",
    description: "Decreases Humidity",
    available: true,
  },
  {
    sensor: "Substrate Moisture 1",
    name: "Misting Device 1",
    description: "Increases Moisture",
    available: true,
  },
  {
    sensor: "Substrate Moisture 2",
    name: "Misting Device 2",
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
