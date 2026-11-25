import mqtt from "mqtt";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { devices } from "../db/schema.js";
import { lightSecondsRemaining, toLightTimer } from "./actuators.js";
import { getState, logEvent, saveState } from "./actuatorStore.js";
import { findDevice, touchDevice } from "./devices.js";
import { storeReading } from "./readings.js";

let client = null;

const parse = (message) => {
  const text = message.toString();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export function publishMqtt(topic, payload, options = {}) {
  if (!client?.connected) return false;
  client.publish(topic, typeof payload === "string" ? payload : JSON.stringify(payload), options);
  return true;
}

async function deviceFor(mac) {
  const device = await findDevice(mac);
  if (device) await touchDevice(device.id);
  return device;
}

async function handleActuatorState(device, actuator, payload) {
  const incoming = payload?.state ?? payload;

  if (actuator === "light") {
    if (incoming === false || incoming === 0) {
      const existing = await getState(device.id, "light");
      if (lightSecondsRemaining(existing?.state) > 0) return;
    }
    await saveState(device.id, "light", toLightTimer(incoming));
  } else {
    await saveState(device.id, actuator, incoming);
  }

  if (actuator === "mode" && (incoming === "auto" || incoming === "manual")) {
    await db.update(devices).set({ controlMode: incoming }).where(eq(devices.id, device.id));
  }

  await logEvent(device.id, actuator, incoming);
}

export async function handleMessage(topic, message) {
  const [root, mac, kind, actuator, leaf] = topic.split("/");
  if (root !== "devices" || !mac) return;

  if (kind === "sensors") {
    const device = await deviceFor(mac);
    if (device) await storeReading(device.id, parse(message));
    return;
  }

  if (kind === "actuators" && actuator && leaf === "state") {
    const device = await deviceFor(mac);
    if (device) await handleActuatorState(device, actuator, parse(message));
  }
}

export function initMqtt(url = process.env.MQTT_BROKER_URL) {
  if (!url) {
    console.warn("MQTT_BROKER_URL not set, MQTT disabled");
    return;
  }

  client = mqtt.connect(url, {
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    clientId: `bsfly-server-${Math.random().toString(36).slice(2, 10)}`,
  });

  client.on("connect", () => {
    client.subscribe(["devices/+/sensors", "devices/+/actuators/+/state"], { qos: 0 });
    console.log("MQTT connected");
  });
  client.on("message", (topic, message) =>
    handleMessage(topic, message).catch((err) => console.error("MQTT message failed:", err)),
  );
  client.on("error", (err) => console.error("MQTT error:", err.message));
}

export const closeMqtt = () => client?.end();
