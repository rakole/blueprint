import test from "node:test";
import assert from "node:assert/strict";
import { DispatchService } from "../src/application/dispatch-service.ts";
import { InMemoryDispatchRepository } from "../src/persistence/in-memory-dispatch-repository.ts";

test("creates an assigned dispatch event and groups routes", () => {
  const service = new DispatchService(new InMemoryDispatchRepository());
  const dispatch = service.create({requestId: "771", memberId: "member-44", depotCode: "NORTH-01", boxCount: 2, routeDate: "2026-09-25"});
  assert.deepEqual(service.toEvent(dispatch), {eventType: "dispatch.assigned", dispatchId: "dispatch-771", boxId: "box-771", depotCode: "NORTH-01", routeDate: "2026-09-25", status: "ASSIGNED"});
  assert.deepEqual(service.routeForDate("2026-09-25")[0].boxCount, 2);
});
