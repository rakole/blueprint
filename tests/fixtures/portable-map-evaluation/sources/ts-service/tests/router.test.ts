import assert from "node:assert/strict";
import test from "node:test";
import {createDemoService, routeRequest} from "../src/server.ts";

test("router translates a create request into an HTTP response", () => {
  const service = createDemoService();
  const response = routeRequest({
    method: "POST",
    path: "/reservations",
    body: {
      memberId: "member-1",
      toolId: "tool-drill",
      startsAt: "2099-01-02T09:00:00Z",
      endsAt: "2099-01-02T12:00:00Z",
    },
  }, service);
  assert.equal(response.status, 201);
  assert.equal(response.headers["content-type"], "application/json");
  const id = (response.body as {id: string}).id;
  assert.equal(routeRequest({method: "POST", path: `/reservations/${id}/confirm`}, service).status, 200);
});

test("router reports domain errors with stable status and code", () => {
  const response = routeRequest({
    method: "GET",
    path: "/reservations/missing",
  }, createDemoService());
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {error: "not_found", message: "reservation was not found"});
});

test("router rejects unknown nested reservation paths", () => {
  const service = createDemoService();
  const created = routeRequest({
    method: "POST",
    path: "/reservations",
    body: {
      memberId: "member-1",
      toolId: "tool-drill",
      startsAt: "2099-01-02T09:00:00Z",
      endsAt: "2099-01-02T12:00:00Z",
    },
  }, service);
  const id = (created.body as {id: string}).id;

  const response = routeRequest({
    method: "GET",
    path: `/reservations/${id}/unexpected`,
  }, service);

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {error: "route_not_found"});
});

test("router validates create bodies at the HTTP boundary", () => {
  const invalidBodies: unknown[] = [
    undefined,
    {},
    null,
    [],
    "not an object",
    {memberId: "member-1", toolId: "tool-drill", startsAt: 123, endsAt: "2099-01-02T12:00:00Z"},
  ];

  for (const body of invalidBodies) {
    const request = body === undefined
      ? {method: "POST", path: "/reservations"}
      : {method: "POST", path: "/reservations", body};
    const response = routeRequest(request, createDemoService());
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.deepEqual(response.body, {
      error: "validation_error",
      message: "request body must include memberId, toolId, startsAt, and endsAt strings",
    });
  }
});

test("unknown routes remain a protocol concern", () => {
  const response = routeRequest({method: "GET", path: "/health"}, createDemoService());
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {error: "route_not_found"});
});
