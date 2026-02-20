export const DRAWER_CONFIG = {
  drawer1: {
    sensors: {
      dht: ["A", "B"],
      soil: [1, 2, 3],
      mq137: [1],
    },
    actuators: {
      humidifier: [1, 2],
      heater: [1],
      fan: [1, 2, 3, 4],
    },
    oled: 1,
  },
  drawer2: {
    sensors: {
      dht: ["A", "B"],
      soil: [1, 2, 3],
      mq137: [1],
    },
    actuators: {
      humidifier: [1, 2],
      heater: [1],
      fan: [1, 2, 3, 4],
    },
    oled: 1,
  },
  drawer3: {
    sensors: {
      dht: ["C"],
      soil: [],
      mq137: [],
    },
    actuators: {
      humidifier: [3],
      fan: [5],
    },
    oled: 2,
  },
} as const;

export type DrawerKey = keyof typeof DRAWER_CONFIG;

export const ACTUATOR_TYPES = [
  "fan",
  "heater",
  "humidifier",
  "dehumidifier",
  "misting",
] as const;

export type ActuatorType = (typeof ACTUATOR_TYPES)[number];

export const SENSOR_TYPES = [
  "temperature",
  "humidity",
  "moisture",
  "ammonia",
] as const;

export type SensorType = (typeof SENSOR_TYPES)[number];

export const MCP23017_PINS: Record<string, number> = {
  humidifier1: 0,
  humidifier2: 1,
  heater: 2,
  fan1: 3,
  fan2: 4,
  fan3: 5,
  fan4: 6,
  humidifier3: 8,
  fan5: 9,
};

export const ADS1115_CHANNELS: Record<string, { chip: number; channel: number }> = {
  soil1: { chip: 1, channel: 0 },
  soil2: { chip: 1, channel: 1 },
  soil3: { chip: 1, channel: 2 },
  mq137: { chip: 1, channel: 3 },
};

export const DHT_SENSORS: Record<string, { pin: number; drawers: DrawerKey[] }> = {
  A: { pin: 27, drawers: ["drawer1", "drawer2"] },
  B: { pin: 13, drawers: ["drawer1", "drawer2"] },
  C: { pin: 33, drawers: ["drawer3"] },
};

export const I2C_ADDRESSES = {
  ADS1115_1: 0x48,
  ADS1115_2: 0x49,
  MCP23017: 0x20,
  TCA9548A: 0x70,
} as const;

export const TCA9548A_CHANNELS = {
  OLED1: 0,
  OLED2: 1,
} as const;
