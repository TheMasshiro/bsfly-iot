import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { startTestServer } from "./helpers.js";

let t;
before(async () => {
  delete process.env.ALLOWED_ORIGINS;
  t = await startTestServer();
});
after(() => t.stop());

const preflight = (origin) =>
  fetch(t.base + "/api/time", { method: "OPTIONS", headers: { origin, "access-control-request-method": "GET" } });

test("production and preview Vercel origins are allowed by default", async () => {
  assert.equal((await preflight("https://bsfly-iot.vercel.app")).status, 204);
  assert.equal((await preflight("https://bsfly-iot-abc123-john-christian-vicentes-projects.vercel.app")).status, 204);
  assert.equal((await preflight("https://evil.example.com")).status, 403);
});
