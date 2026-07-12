import test from "node:test";
import assert from "node:assert/strict";

test("intentional runner fixture failure proves exit propagation", () => {
  assert.fail("intentional test-runner fixture failure");
});
