import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeActuatorId,
  buildExclusiveActuatorIds,
} from "../controllers/actuatorRoutes.js";

test("normalizeActuatorId maps legacy dehumidifier ids to supported fan ids", () => {
  assert.equal(normalizeActuatorId("dev:dehumidifier1"), "dev:fan1");
  assert.equal(normalizeActuatorId("dev:dehumidifier3"), "dev:fan3");
  assert.equal(normalizeActuatorId("dev:drawer2:dehumidifier"), "dev:drawer2:fan3");
  assert.equal(normalizeActuatorId("dev:dehumidifier"), "dev:fan1");
});

test("normalizeActuatorId keeps pump compatibility mapping", () => {
  assert.equal(normalizeActuatorId("dev:pump"), "dev:substrate");
});

test("buildExclusiveActuatorIds returns firmware-safe exclusions", () => {
  assert.deepEqual(buildExclusiveActuatorIds("dev1", "heater"), [
    "dev1:fan1",
    "dev1:fan3",
  ]);

  assert.deepEqual(buildExclusiveActuatorIds("dev1", "humidifier"), [
    "dev1:fan1",
    "dev1:fan3",
  ]);

  assert.deepEqual(buildExclusiveActuatorIds("dev1", "fan1"), [
    "dev1:heater",
    "dev1:humidifier1",
  ]);

  assert.deepEqual(buildExclusiveActuatorIds("dev1", "humidifier3"), [
    "dev1:fan3",
  ]);
});
