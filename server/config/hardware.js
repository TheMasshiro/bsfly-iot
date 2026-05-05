export const DRAWER_CONFIG = {
  drawer1: {
    sensors: {
      dht: ["A", "B", "C"],
      substrate: [1, 2, 3],
      mq137: [1],
    },
    actuators: {
      humidifier: [1, 2],
      heater: [1],
      fan: [1, 2],
    },
    lcd: 1,
  },
  drawer2: {
    sensors: {
      dht: ["D", "E"],
      substrate: [],
      mq137: [],
    },
    actuators: {
      fan: [3, 4],
    },
    lcd: 2,
  },
};

export const ACTUATOR_TYPES = [
  "fan",
  "heater",
  "humidifier",
  "misting",
];

export const SENSOR_TYPES = ["temperature", "humidity", "moisture", "ammonia"];

export const MCP23017_PINS = {
  humidifier1: 0,
  humidifier2: 1,
  heater: 2,
  fan1: 3,
  fan2: 4,
  fan3: 5,
  fan4: 6,
  humidifier3: 8,
};

export const ADS1115_CHANNELS = {
  substrate1: { chip: 1, channel: 0 },
  substrate2: { chip: 1, channel: 1 },
  substrate3: { chip: 1, channel: 2 },
  mq137: { chip: 1, channel: 3 },
};

export const DHT_SENSORS = {
  A: { pin: 13, drawers: ["drawer1"], type: "DHT11" },
  B: { pin: 26, drawers: ["drawer1"], type: "DHT11" },
  C: { pin: 25, drawers: ["drawer1"], type: "DHT22" },
  D: { pin: 14, drawers: ["drawer2"], type: "DHT22" },
  E: { pin: 27, drawers: ["drawer2"], type: "DHT22" },
};

export const I2C_ADDRESSES = {
  ADS1115_1: 0x48,
  ADS1115_2: 0x49,
  MCP23017: 0x20,
  TCA9548A: 0x70,
};

export const TCA9548A_CHANNELS = {
  LCD1: 0,
  LCD2: 1,
};
