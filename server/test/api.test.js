import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { startTestServer } from "./helpers.js";
import { handleMessage } from "../src/services/mqtt.js";

const MAC = "AA:BB:CC:DD:EE:01";
let t;
let device;
let apiKey;

before(async () => {
  t = await startTestServer();
  const res = await t.call("POST", "/api/devices/register", { user: "alice", body: { macAddress: MAC, name: "Rack" } });
  assert.equal(res.status, 201);
  device = res.body;
  apiKey = res.body.apiKey;
});

after(() => t.stop());

test("register returns the device, owner membership and a one-time API key", async () => {
  assert.match(apiKey, /^[0-9a-f]{64}$/);
  assert.equal(device.members[0].role, "owner");
  const again = await t.call("POST", "/api/devices/register", { user: "bob", body: { macAddress: MAC, name: "X" } });
  assert.equal(again.status, 409);
  const masked = await t.call("GET", `/api/devices/${device._id}/api-key`, { user: "alice" });
  assert.ok(!masked.body.apiKey.includes(apiKey));
});

test("heartbeat requires the device API key", async () => {
  assert.equal((await t.call("POST", `/api/devices/${MAC}/heartbeat`, { body: {} })).status, 401);
  assert.equal((await t.call("POST", `/api/devices/${MAC}/heartbeat`, { key: "nope", body: {} })).status, 401);
  const ok = await t.call("POST", `/api/devices/${MAC}/heartbeat`, { key: apiKey, body: { ipAddress: "192.168.1.9" } });
  assert.equal(ok.status, 200);
  const list = await t.call("GET", "/api/devices/user/me", { user: "alice" });
  assert.equal(list.body[0].status, "online");
  assert.equal(list.body[0].ipAddress, "192.168.1.9");
});

test("sensor readings are stored and queried", async () => {
  const post = await t.call("POST", "/api/sensors", {
    key: apiKey,
    body: { macAddress: MAC, drawerName: "Drawer 1", temperature: 28.456, humidity: 70, leftSubstrate: 40, centerSubstrate: 50, rightSubstrate: 60, ammonia: 3 },
  });
  assert.equal(post.status, 201);
  const d2 = await t.call("POST", "/api/sensors", {
    key: apiKey,
    body: { macAddress: MAC, drawerName: "Drawer 2", temperature: 30, humidity: 65, leftSubstrate: -1, centerSubstrate: -1, rightSubstrate: -1, ammonia: -1 },
  });
  assert.equal(d2.status, 201);
  assert.equal((await t.call("POST", "/api/sensors", { body: { macAddress: MAC, temperature: 1 } })).status, 401);
  assert.equal((await t.call("POST", "/api/sensors", { key: apiKey, body: { macAddress: MAC, humidity: 140 } })).status, 400);

  const latest = await t.call("GET", `/api/sensors/device/${device._id}?drawer=Drawer%201`, { user: "alice" });
  assert.equal(latest.body.temperature, 28.46);
  assert.equal(latest.body.moisture, 50);

  const latest2 = await t.call("GET", `/api/sensors/device/${device._id}?drawer=Drawer%202`, { user: "alice" });
  assert.equal(latest2.body.leftSubstrate, null);

  const hourly = await t.call("GET", `/api/sensors/device/${device._id}/hourly?drawer=Drawer%201`, { user: "alice" });
  assert.equal(hourly.body.length, 24);
  assert.equal(hourly.body[23].moisture, 50);

  const history = await t.call("GET", `/api/sensors/device/${device._id}/history`, { user: "alice" });
  assert.deepEqual(history.body.map((b) => b.drawerId).sort(), ["Drawer 1", "Drawer 2"]);
  assert.equal(history.body[0].readings.length, 1);
});

test("non-members cannot read device data", async () => {
  assert.equal((await t.call("GET", `/api/sensors/device/${device._id}`, { user: "mallory" })).status, 403);
  assert.equal((await t.call("GET", `/api/devices/${device._id}`, { user: "mallory" })).status, 403);
  assert.equal((await t.call("GET", `/api/actuators/${device._id}:fan1`)).status, 401);
  assert.equal((await t.call("GET", `/api/actuators/${device._id}:fan1`, { user: "mallory" })).status, 403);
  const drawers = await t.call("GET", `/api/sensors/device/${device._id}/history`, { user: "alice" });
  assert.ok(drawers.body.length > 0);
  assert.equal((await t.call("GET", "/api/sensors/drawer/does-not-exist", { user: "mallory" })).status, 404);
});

test("actuator control respects AUTO mode", async () => {
  const blocked = await t.call("POST", `/api/actuators/${device._id}:fan1`, { user: "alice", body: { state: true } });
  assert.equal(blocked.status, 409);

  const light = await t.call("POST", `/api/actuators/${device._id}:light`, { user: "alice", body: { state: 600 } });
  assert.equal(light.status, 200);
  assert.equal(light.body.state.time, 600);

  await t.call("PATCH", `/api/devices/${device._id}/control-mode`, { user: "alice", body: { mode: "manual" } });
  const ok = await t.call("POST", `/api/actuators/${device._id}:fan1`, { user: "alice", body: { state: true } });
  assert.equal(ok.status, 200);

  const all = await t.call("GET", "/api/actuators", { user: "alice" });
  assert.equal(all.body[`${device._id}:fan1`], true);
  assert.ok(all.body[`${device._id}:light`] > 590);

  const byKey = await t.call("GET", `/api/actuators/${MAC}:fan1`, { key: apiKey });
  assert.equal(byKey.body.state, true);
});

test("mqtt state messages are stored with the right drawer", async () => {
  await handleMessage(`devices/${MAC}/actuators/fan4/state`, Buffer.from(JSON.stringify({ state: true })));
  await handleMessage(`devices/${MAC}/sensors`, Buffer.from(JSON.stringify({ drawerName: "Drawer 2", temperature: 31 })));
  const { actuatorEvents } = await import("../src/db/schema.js");
  const events = await t.db.select().from(actuatorEvents);
  const fan4 = events.find((e) => e.actuator === "fan4");
  assert.equal(fan4.drawer, "Drawer 2");
  assert.equal(fan4.parameter, "Ventilation");
});

test("join, members and leave", async () => {
  const code = device.joinCode;
  assert.equal((await t.call("POST", "/api/devices/join", { user: "bob", body: { joinCode: code } })).status, 200);
  assert.equal((await t.call("POST", "/api/devices/join", { user: "bob", body: { joinCode: code } })).status, 409);

  const members = await t.call("GET", `/api/devices/${device._id}/members`, { user: "bob" });
  assert.deepEqual(members.body.map((m) => m.role).sort(), ["member", "owner"]);

  assert.equal((await t.call("POST", `/api/devices/${device._id}/regenerate-api-key`, { user: "bob" })).status, 403);
  assert.equal((await t.call("DELETE", `/api/devices/${device._id}/leave`, { user: "bob" })).status, 200);
  assert.equal((await t.call("GET", `/api/devices/${device._id}`, { user: "bob" })).status, 403);
});

test("rotating the API key invalidates the old one", async () => {
  const rotated = await t.call("POST", `/api/devices/${device._id}/regenerate-api-key`, { user: "alice" });
  assert.equal(rotated.status, 200);
  assert.equal((await t.call("POST", `/api/devices/${MAC}/heartbeat`, { key: apiKey, body: {} })).status, 401);
  assert.equal((await t.call("POST", `/api/devices/${MAC}/heartbeat`, { key: rotated.body.apiKey, body: {} })).status, 200);
});

test("users endpoint ignores body userId and uses the session", async () => {
  const res = await t.call("POST", "/api/users", { user: "alice", body: { userId: "victim", name: "A", email: "a@example.com" } });
  assert.equal(res.status, 201);
  assert.equal(res.body._id, "alice");
  assert.equal((await t.call("POST", "/api/users", { body: { name: "A", email: "a@example.com" } })).status, 401);
});

test("webhook rejects bad signatures", async () => {
  process.env.CLERK_WEBHOOK_SECRET = "whsec_" + Buffer.from("secret").toString("base64");
  const res = await t.call("POST", "/api/webhooks/clerk", { body: { type: "user.deleted", data: { id: "alice" } } });
  assert.equal(res.status, 401);
});
