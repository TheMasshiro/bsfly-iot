import mqtt from "mqtt";
import Device from "./models/User.Device.js";
import Drawer from "./models/Sensor.Drawer.js";
import DrawerReading from "./models/Sensor.DrawerReadings.js";
import ActuatorState from "./models/ActuatorState.js";
import ActuatorEvent from "./models/ActuatorEvent.js";

const brokerUrl = process.env.MQTT_BROKER_URL;
const username = process.env.MQTT_USERNAME;
const password = process.env.MQTT_PASSWORD;
const opts = {};
if (username) opts.username = username;
if (password) opts.password = password;

let client = null;

const normalizeDrawerName = (rawDrawerName) => {
  if (typeof rawDrawerName !== "string") return "Drawer 1";
  const name = rawDrawerName.trim();
  if (name.length === 0) return "Drawer 1";

  if (name.startsWith("Drawer 2")) return "Drawer 2";
  if (name.startsWith("Drawer 1")) return "Drawer 1";

  return name;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const MAX_LIGHT_SECONDS = 10 * 3600;
const LIGHT_AUTO_ON_HOUR = 19;

let lightAutoScheduler = null;
const lightAutoTriggeredDates = new Set();

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isLightEffectivelyOn = (state, nowMs = Date.now()) => {
  if (typeof state === "boolean") {
    return state;
  }

  if (typeof state === "number") {
    return state > 0;
  }

  if (typeof state === "object" && state !== null) {
    return normalizeLightSeconds(state, nowMs) > 0;
  }

  return false;
};

const syncEveningLightTimer = async (device, nowMs) => {
  const deviceId = String(device._id);
  const dateKey = getLocalDateKey(new Date(nowMs));
  const triggerKey = `${deviceId}:${dateKey}`;

  if (lightAutoTriggeredDates.has(triggerKey)) {
    return;
  }

  const actuatorId = `${deviceId}:light`;
  const stateDoc = await ActuatorState.findOne({ actuatorId });
  if (stateDoc && isLightEffectivelyOn(stateDoc.state, nowMs)) {
    lightAutoTriggeredDates.add(triggerKey);
    return;
  }

  const topic = `devices/${device.macAddress}/actuators/light/control`;
  const payload = {
    state: {
      time: MAX_LIGHT_SECONDS,
      startTime: nowMs,
    },
  };

  if (publishMqtt(topic, payload)) {
    await ActuatorState.findOneAndUpdate(
      { actuatorId },
      {
        actuatorId,
        state: payload.state,
        updatedAt: new Date(nowMs),
      },
      { upsert: true, new: true }
    );

    lightAutoTriggeredDates.add(triggerKey);
    console.log(`[LIGHT] Auto-started evening timer for ${device.macAddress}`);
  }
};

const runLightAutoScheduler = async () => {
  const now = new Date();

  if (now.getHours() < LIGHT_AUTO_ON_HOUR) {
    return;
  }

  const devices = await Device.find({ status: "online" });
  for (const device of devices) {
    try {
      await syncEveningLightTimer(device, now.getTime());
    } catch (error) {
      console.error("[LIGHT] Evening auto-start failed:", error);
    }
  }
};

export function startLightAutoScheduler() {
  if (lightAutoScheduler) {
    return;
  }

  const tick = () => {
    runLightAutoScheduler().catch((error) => {
      console.error("[LIGHT] Scheduler tick failed:", error);
    });
  };

  tick();
  lightAutoScheduler = setInterval(tick, 60000);
}

const markDeviceOnline = async (macAddress) => {
  if (!macAddress) return;

  await Device.updateOne(
    { macAddress: macAddress.toUpperCase() },
    { $set: { status: "online", lastSeen: new Date() } }
  );
};

const findDeviceByMac = async (macAddress) => {
  if (!macAddress) return null;

  return Device.findOne({
    macAddress: macAddress.toUpperCase(),
  });
};

const parseMqttJson = (message) => {
  const text = message.toString();

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const loadDeviceForMac = async (macAddress) => {
  await markDeviceOnline(macAddress);
  return findDeviceByMac(macAddress);
};

const getHourBucket = (timestamp = new Date()) => {
  const hourBucket = new Date(timestamp);
  hourBucket.setMinutes(0, 0, 0);
  return hourBucket;
};

const storeHourlyReading = async (drawerId, readingData) => {
  const hourBucket = getHourBucket(readingData.timestamp);
  const nextHourBucket = new Date(hourBucket);
  nextHourBucket.setHours(nextHourBucket.getHours() + 1);

  const existingReading = await DrawerReading.findOne({
    drawerId,
    date: { $gte: hourBucket, $lt: nextHourBucket },
    readings: {
      $elemMatch: {
        timestamp: { $gte: hourBucket, $lt: nextHourBucket },
      },
    },
  });

  if (existingReading) {
    await DrawerReading.updateOne(
      { _id: existingReading._id },
      {
        $set: {
          "readings.$[reading]": readingData,
        },
      },
      {
        arrayFilters: [
          {
            "reading.timestamp": { $gte: hourBucket, $lt: nextHourBucket },
          },
        ],
      }
    );
    return;
  }

  await DrawerReading.findOneAndUpdate(
    { drawerId, date: hourBucket },
    { $push: { readings: readingData } },
    { upsert: true }
  );
};

const normalizeLightSeconds = (state, nowMs = Date.now()) => {
  if (typeof state === "number") {
    return clamp(Math.round(state), 0, MAX_LIGHT_SECONDS);
  }

  if (typeof state === "boolean") {
    return state ? MAX_LIGHT_SECONDS : 0;
  }

  if (typeof state === "object" && state !== null) {
    const seconds = Number(state.time);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return 0;
    }

    const startTimeMs = Number(state.startTime);
    if (Number.isFinite(startTimeMs) && startTimeMs > 0) {
      const endTimeMs = startTimeMs + seconds * 1000;
      const remaining = Math.ceil((endTimeMs - nowMs) / 1000);
      return clamp(remaining, 0, MAX_LIGHT_SECONDS);
    }

    return clamp(Math.round(seconds), 0, MAX_LIGHT_SECONDS);
  }

  return 0;
};

const formatDataTime = (date) =>
  date.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

export function publishMqtt(topic, payload, options = {}) {
  try {
    if (client && client.connected) {
      const p = typeof payload === "string" ? payload : JSON.stringify(payload);
      client.publish(topic, p, options);
      return true;
    } else {
      return false;
    }
  } catch (e) {
    console.error("MQTT publish error", e);
    return false;
  }
}

export async function initMqtt() {
  return new Promise((resolve, reject) => {
    client = mqtt.connect(brokerUrl, opts);

    client.on("connect", () => {
      client.subscribe("devices/+/sensors", { qos: 0 });
      client.subscribe("devices/+/actuators/+/state", { qos: 0 });
      resolve();
    });

    client.on("message", async (topic, message) => {
      try {
        const parts = topic.split("/");
        const mac = parts[1];

        if (
          parts.length >= 3 &&
          parts[0] === "devices" &&
          parts[2] === "sensors"
        ) {
          const payload = parseMqttJson(message);

          const device = await loadDeviceForMac(mac);
          if (!device) {
            return;
          }

          const normalizedDrawerName = normalizeDrawerName(payload.drawerName);

          let drawer = await Drawer.findOne({
            deviceId: device._id,
            name: normalizedDrawerName,
          });
          if (!drawer) {
            drawer = await Drawer.create({
              deviceId: device._id,
              name: normalizedDrawerName,
            });
          }

          const round2 = (v) => {
            const n = Number(v);
            return Number.isFinite(n) ? Number(n.toFixed(2)) : v;
          };

          const roundWhole = (v) => {
            const n = Number(v);
            return Number.isFinite(n) ? Math.round(n) : v;
          };

          const readingData = { timestamp: new Date() };
          if (payload.temperature !== undefined)
            readingData.temperature = round2(payload.temperature);
          if (payload.humidity !== undefined)
            readingData.humidity = round2(payload.humidity);
          if (payload.moisture !== undefined)
            readingData.moisture = roundWhole(payload.moisture);
          const leftSubstrate = payload.leftSubstrate ?? payload.leftSoil;
          const centerSubstrate = payload.centerSubstrate ?? payload.centerSoil;
          const rightSubstrate = payload.rightSubstrate ?? payload.rightSoil;
          if (leftSubstrate !== undefined)
            readingData.leftSubstrate = roundWhole(leftSubstrate);
          if (centerSubstrate !== undefined)
            readingData.centerSubstrate = roundWhole(centerSubstrate);
          if (rightSubstrate !== undefined)
            readingData.rightSubstrate = roundWhole(rightSubstrate);
          if (payload.ammonia !== undefined)
            readingData.ammonia = round2(payload.ammonia);

          await storeHourlyReading(drawer._id, readingData);

          return;
        }

        if (
          parts.length >= 5 &&
          parts[0] === "devices" &&
          parts[2] === "actuators" &&
          parts[4] === "state"
        ) {
          const actuator = parts[3];
          const payload = parseMqttJson(message);

          const device = await loadDeviceForMac(mac);
          if (!device) {
            return;
          }

          const actuatorId = `${device._id}:${actuator}`;

          if (actuator === "light") {
            const incomingState = payload.state;

            if (incomingState === false || incomingState === 0) {
              const existing = await ActuatorState.findOne({ actuatorId });
              const storedState = existing?.state;

              if (storedState && typeof storedState === "object" && storedState.time > 0) {
                const endTimeMs = storedState.startTime + storedState.time * 1000;
                if (endTimeMs > Date.now()) {
                  console.log(`[MQTT] Ignoring false/0 ACK for ${actuatorId}, timer still active`);
                  return;
                }
              }
            }

            const normalizedState =
              typeof incomingState === "object" && incomingState !== null && "time" in incomingState
                ? incomingState
                : normalizeLightSeconds(incomingState);

            await ActuatorState.findOneAndUpdate(
              { actuatorId },
              { actuatorId, state: normalizedState, updatedAt: new Date() },
              { upsert: true }
            );

            // Store actuator event for reports
            try {
              const drawer = actuator.includes("3") || actuator === "fan3" || actuator === "humidifier3" ? "Drawer 2" : "Drawer 1";
              const eventValue = typeof incomingState === "object" && incomingState !== null && "time" in incomingState ? incomingState : incomingState;
              const ts = new Date();
              await ActuatorEvent.create({
                deviceId: device._id,
                actuator,
                drawer,
                value: eventValue,
                dataTime: formatDataTime(ts),
                timestamp: ts,
              });
            } catch (e) {
              console.error("Failed to persist actuator event:", e);
            }
          } else {
            await ActuatorState.findOneAndUpdate(
              { actuatorId },
              { actuatorId, state: payload.state, updatedAt: new Date() },
              { upsert: true }
            );

            // Store actuator event for reports
            try {
              const drawer = actuator.includes("3") || actuator === "fan3" || actuator === "humidifier3" ? "Drawer 2" : "Drawer 1";
              const ts = new Date();
              await ActuatorEvent.create({
                deviceId: device._id,
                actuator,
                drawer,
                value: payload.state,
                dataTime: formatDataTime(ts),
                timestamp: ts,
              });
            } catch (e) {
              console.error("Failed to persist actuator event:", e);
            }
          }

          return;
        }
      } catch (err) {
        console.error("Error processing MQTT message", err);
      }
    });

    client.on("error", (err) => {
      console.error("MQTT client error", err);
    });

    client.on("close", () => {});
  });
}

export default { initMqtt, publishMqtt };