import test from "node:test";
import assert from "node:assert/strict";
import { parseDispatchEvent } from "../src/application/contracts.ts";

test("accepts the shared assigned dispatch shape", () => {
  const event = parseDispatchEvent({eventType: "dispatch.assigned", dispatchId: "dispatch-1", boxId: "box-1", depotCode: "NORTH-01", routeDate: "2026-09-25", status: "ASSIGNED"});
  assert.equal(event.status, "ASSIGNED");
});

test("rejects lifecycle values owned by fulfillment", () => {
  assert.throws(() => parseDispatchEvent({eventType: "dispatch.cancelled", status: "CANCELLED"}));
});
