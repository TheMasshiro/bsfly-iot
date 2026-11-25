import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { actuatorEvents, actuatorStates } from "../db/schema.js";
import { drawerForActuator, parameterForActuator } from "./actuators.js";

export async function getState(deviceId, actuator) {
  const [row] = await db
    .select()
    .from(actuatorStates)
    .where(and(eq(actuatorStates.deviceId, deviceId), eq(actuatorStates.actuator, actuator)));
  return row ?? null;
}

export const statesFor = (deviceIds) =>
  deviceIds.length === 0 ? [] : db.select().from(actuatorStates).where(inArray(actuatorStates.deviceId, deviceIds));

export async function saveState(deviceId, actuator, state, at = new Date()) {
  await db
    .insert(actuatorStates)
    .values({ deviceId, actuator, state, updatedAt: at })
    .onConflictDoUpdate({
      target: [actuatorStates.deviceId, actuatorStates.actuator],
      set: { state, updatedAt: at },
    });
}

export async function logEvent(deviceId, actuator, value) {
  await db.insert(actuatorEvents).values({
    deviceId,
    actuator,
    drawer: drawerForActuator(actuator),
    parameter: parameterForActuator(actuator),
    value: value ?? null,
  });
}
