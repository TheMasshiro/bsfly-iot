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
