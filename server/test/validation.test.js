import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeString,
  isValidMacAddress,
  isValidDeviceName,
  isValidJoinCode,
  isValidSensorValue,
  validateBody,
} from "../middleware/validation.js";

test("sanitizeString trims and escapes html", () => {
  assert.equal(sanitizeString("  <script>alert(1)</script>  "),
    "&lt;script&gt;alert(1)&lt;&#x2F;script&gt;");
});

test("isValidMacAddress accepts common mac formats", () => {
  assert.equal(isValidMacAddress("AA:BB:CC:DD:EE:FF"), true);
  assert.equal(isValidMacAddress("aa-bb-cc-dd-ee-ff"), true);
  assert.equal(isValidMacAddress("invalid-mac"), false);
});

test("isValidDeviceName enforces length bounds", () => {
  assert.equal(isValidDeviceName("Device A"), true);
  assert.equal(isValidDeviceName(""), false);
  assert.equal(isValidDeviceName("x".repeat(51)), false);
});

test("isValidJoinCode expects eight alphanumeric characters", () => {
  assert.equal(isValidJoinCode("AB12CD34"), true);
  assert.equal(isValidJoinCode("short"), false);
});

test("isValidSensorValue respects bounds", () => {
  assert.equal(isValidSensorValue(25), true);
  assert.equal(isValidSensorValue(-100), false);
  assert.equal(isValidSensorValue(200), false);
});

test("validateBody returns 400 for missing required fields", () => {
  const middleware = validateBody({
    name: { required: true, type: "string" },
  });

  const req = { body: {} };
  let statusCode = null;
  let jsonBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      jsonBody = payload;
      return this;
    },
  };

  middleware(req, res, () => {
    throw new Error("next should not be called");
  });

  assert.equal(statusCode, 400);
  assert.deepEqual(jsonBody, { error: "name is required" });
});

test("validateBody sanitizes string fields before next", () => {
  const middleware = validateBody({
    name: { required: true, type: "string" },
  });

  const req = { body: { name: "  <b>Alpha</b>  " } };
  let nextCalled = false;
  const res = {
    status() {
      return this;
    },
    json() {
      throw new Error("json should not be called");
    },
  };

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.body.name, "&lt;b&gt;Alpha&lt;&#x2F;b&gt;");
});