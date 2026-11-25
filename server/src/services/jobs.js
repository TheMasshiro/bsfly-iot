import { gt } from "drizzle-orm";
import { db } from "../db/index.js";
import { devices } from "../db/schema.js";
import { MAX_LIGHT_SECONDS, lightSecondsRemaining } from "./actuators.js";
import { getState, saveState } from "./actuatorStore.js";
import { ONLINE_WINDOW_MS } from "./devices.js";
import { publishMqtt } from "./mqtt.js";

const LIGHT_ON_HOUR = Number(process.env.LIGHT_AUTO_ON_HOUR ?? 19);
const triggered = new Set();
let timer = null;

const dateKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export async function runEveningLights(now = new Date()) {
  if (now.getHours() < LIGHT_ON_HOUR) return;

  const online = await db
    .select()
    .from(devices)
    .where(gt(devices.lastSeen, new Date(now.getTime() - ONLINE_WINDOW_MS)));

  for (const device of online) {
    const key = `${device.id}:${dateKey(now)}`;
    if (triggered.has(key)) continue;

    const current = await getState(device.id, "light");
    if (lightSecondsRemaining(current?.state, now.getTime()) > 0) {
      triggered.add(key);
      continue;
    }

    const state = { time: MAX_LIGHT_SECONDS, startTime: now.getTime() };
    if (publishMqtt(`devices/${device.macAddress}/actuators/light/control`, { state })) {
      await saveState(device.id, "light", state, now);
      triggered.add(key);
    }
  }
}

export function startJobs() {
  if (timer) return;
  const tick = () => runEveningLights().catch((err) => console.error("Evening lights failed:", err));
  tick();
  timer = setInterval(tick, 60_000);
}

export function stopJobs() {
  clearInterval(timer);
  timer = null;
}
