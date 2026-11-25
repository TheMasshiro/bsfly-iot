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

export const drawer1SubstrateSensors = [
  {
    name: "Left Substrate",
    value: "--",
    unit: "%",
    icon: waterOutline,
    type: "leftSubstrate",
    sensorType: "Substrate Moisture",
  },
  {
    name: "Center Substrate",
    value: "--",
    unit: "%",
    icon: waterOutline,
    type: "centerSubstrate",
    sensorType: "Substrate Moisture",
  },
  {
    name: "Right Substrate",
    value: "--",
    unit: "%",
    icon: waterOutline,
    type: "rightSubstrate",
    sensorType: "Substrate Moisture",
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
    seconds: 36000,
  },
];

export const controlsData = [
  {
    sensor: "Temperature",
    name: "Fan",
    description: "Reduces Temperature and Humidity (drawer fan bank)",
    available: true,
  },
  {
    sensor: "Temperature",
    name: "Heater",
    description: "Increases Temperature",
    available: true,
  },
  {
    sensor: "Substrate Moisture",
    name: "Water Pump",
    description: "Controls Drawer 1 substrate moisture via water pump",
    available: true,
  },
  {
    sensor: "Humidity",
    name: "Humidifier",
    description: "Increases Humidity",
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
    Fan: ["fan1"],
    Heater: ["heater"],
    "Water Pump": ["substrate"],
    Humidifier: ["humidifier1"],
  },
  "Drawer 2": {
    Fan: ["fan3"],
    Heater: ["heater"],
    Humidifier: ["humidifier3"],
  },
} as const;
