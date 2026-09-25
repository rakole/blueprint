import assert from "node:assert/strict";
import test from "node:test";
import {loadConfig} from "../src/config.ts";

test("config uses safe local defaults", () => {
  assert.deepEqual(loadConfig({}), {port: 8080, reservationHorizonDays: 7});
});

test("config rejects invalid network settings", () => {
  assert.throws(() => loadConfig({PORT: "70000"}), /PORT must be/);
});
