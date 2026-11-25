import test from "node:test";
import assert from "node:assert/strict";
import {
  describeState,
  drawerForActuator,
  lightSecondsRemaining,
  parameterForActuator,
  parseActuatorId,
} from "../src/services/actuators.js";

test("parseActuatorId handles device ids, MACs and legacy names", () => {
  assert.deepEqual(parseActuatorId("abc:fan1"), { deviceRef: "abc", actuator: "fan1" });
  assert.deepEqual(parseActuatorId("aa:bb:cc:dd:ee:ff:light"), { deviceRef: "AA:BB:CC:DD:EE:FF", actuator: "light" });
  assert.deepEqual(parseActuatorId("abc:dehumidifier3"), { deviceRef: "abc", actuator: "fan3" });
  assert.deepEqual(parseActuatorId("abc:drawer2:dehumidifier"), { deviceRef: "abc", actuator: "fan3" });
  assert.deepEqual(parseActuatorId("abc:pump"), { deviceRef: "abc", actuator: "substrate" });
  assert.equal(parseActuatorId("abc"), null);
});

test("drawer 2 actuators map to Drawer 2", () => {
  for (const a of ["fan3", "fan4", "humidifier3"]) assert.equal(drawerForActuator(a), "Drawer 2");
  for (const a of ["fan1", "fan2", "heater", "humidifier1", "light"]) assert.equal(drawerForActuator(a), "Drawer 1");
});

test("parameters and states are described for reports", () => {
  assert.equal(parameterForActuator("humidifier2"), "Humidity");
  assert.equal(parameterForActuator("light"), "Lighting");
  assert.equal(describeState(true), "ON");
  assert.equal(describeState(false), "OFF");
  assert.equal(describeState({ time: 60, startTime: 1 }), "ON");
  assert.equal(describeState("auto"), "-");
});

test("light timer counts down", () => {
  const now = 1_000_000;
  assert.equal(lightSecondsRemaining({ time: 100, startTime: now - 40_000 }, now), 60);
  assert.equal(lightSecondsRemaining({ time: 10, startTime: now - 40_000 }, now), 0);
  assert.equal(lightSecondsRemaining(true), 36000);
});
