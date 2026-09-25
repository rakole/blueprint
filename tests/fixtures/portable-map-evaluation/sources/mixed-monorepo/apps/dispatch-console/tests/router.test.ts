import test from "node:test";
import assert from "node:assert/strict";
import { createApplication } from "../src/main.ts";

test("routes slot creation and unknown paths", () => {
  const router = createApplication();
  const created = router.handle({method: "POST", path: "/slots", body: {requestId: "2", memberId: "m2", depotCode: "SOUTH-02", boxCount: 1, routeDate: "2026-09-26"}});
  assert.equal(created.status, 201);
  assert.equal(router.handle({method: "GET", path: "/missing"}).status, 404);
});
