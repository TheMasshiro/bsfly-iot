export const MAX_LIGHT_SECONDS = 10 * 3600;

const DRAWER_2_ACTUATORS = new Set(["fan3", "fan4", "humidifier3"]);

const PARAMETERS = [
  [/^humidifier/, "Humidity"],
  [/^heater/, "Temperature"],
  [/^fan/, "Ventilation"],
  [/^light$/, "Lighting"],
  [/^(substrate|pump)/, "Substrate moisture"],
  [/^mode$/, "Control mode"],
];

const LEGACY_NAMES = {
  dehumidifier1: "fan1",
  dehumidifier3: "fan3",
  pump: "substrate",
};

const MAC_PREFIX = /^([0-9A-F]{2}:){5}[0-9A-F]{2}:/i;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function parseActuatorId(actuatorId) {
  if (typeof actuatorId !== "string") return null;
  const mac = actuatorId.match(MAC_PREFIX);
  const deviceRef = mac ? mac[0].slice(0, -1).toUpperCase() : actuatorId.split(":")[0];
  const rest = actuatorId.slice(deviceRef.length + 1).split(":").filter(Boolean);
  if (!deviceRef || rest.length === 0) return null;

  let actuator = rest[rest.length - 1];
  if (actuator === "dehumidifier") actuator = rest.includes("drawer2") ? "fan3" : "fan1";
  actuator = LEGACY_NAMES[actuator] ?? actuator;
  return { deviceRef, actuator };
}

export const drawerForActuator = (actuator) =>
  DRAWER_2_ACTUATORS.has(actuator) ? "Drawer 2" : "Drawer 1";

export const parameterForActuator = (actuator) =>
  PARAMETERS.find(([pattern]) => pattern.test(actuator))?.[1] ?? null;

export function lightSecondsRemaining(state, nowMs = Date.now()) {
  if (typeof state === "boolean") return state ? MAX_LIGHT_SECONDS : 0;
  if (typeof state === "number") return clamp(Math.round(state), 0, MAX_LIGHT_SECONDS);
  if (!state || typeof state !== "object") return 0;

  const seconds = Number(state.time);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;

  const startTime = Number(state.startTime);
  if (!Number.isFinite(startTime) || startTime <= 0) return clamp(Math.round(seconds), 0, MAX_LIGHT_SECONDS);

  return clamp(Math.ceil((startTime + seconds * 1000 - nowMs) / 1000), 0, MAX_LIGHT_SECONDS);
}

export function toLightTimer(state, nowMs = Date.now()) {
  if (state && typeof state === "object" && "time" in state) return state;
  return { time: lightSecondsRemaining(state, nowMs), startTime: nowMs };
}

export function describeState(value) {
  if (typeof value === "boolean") return value ? "ON" : "OFF";
  if (typeof value === "number") return value > 0 ? "ON" : "OFF";
  if (value && typeof value === "object" && "time" in value) return Number(value.time) > 0 ? "ON" : "OFF";
  if (typeof value === "string") {
    const match = value.match(/\((ON|OFF)\)\s*$/i);
    if (match) return match[1].toUpperCase();
  }
  return "-";
}
