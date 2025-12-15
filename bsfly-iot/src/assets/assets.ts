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
    name: "Substrate Moisture",
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
    name: "Disabled",
    seconds: 0,
  },
  {
    id: 2,
    name: "8 Hours",
    seconds: 28800,
  },
  {
    id: 3,
    name: "12 Hours",
    seconds: 43200,
  },
];
