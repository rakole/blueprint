import assert from "node:assert/strict";
import test from "node:test";
import {ReservationService} from "../src/application/reservation-service.ts";
import {Member} from "../src/domain/member.ts";
import {Tool} from "../src/domain/tool.ts";
import {InMemoryMemberRepository} from "../src/persistence/in-memory-member-repository.ts";
import {InMemoryReservationRepository} from "../src/persistence/in-memory-reservation-repository.ts";
import {InMemoryToolRepository} from "../src/persistence/in-memory-tool-repository.ts";
import {asMemberId, asToolId} from "../src/types/ids.ts";

function setup() {
  const member = new Member(asMemberId("member-1"), "Sam Lee");
  const tool = new Tool(asToolId("tool-1"), "Circular saw", "power");
  let sequence = 0;
  return {
    member,
    tool,
    service: new ReservationService({
      members: new InMemoryMemberRepository([member]),
      tools: new InMemoryToolRepository([tool]),
      reservations: new InMemoryReservationRepository(),
      now: () => new Date("2030-04-01T08:00:00Z"),
      nextId: () => `reservation-${++sequence}`,
    }),
  };
}

const input = {
  memberId: asMemberId("member-1"),
  toolId: asToolId("tool-1"),
  startsAt: "2030-04-02T09:00:00Z",
  endsAt: "2030-04-02T13:00:00Z",
};

test("creates and confirms a reservation", () => {
  const {service} = setup();
  const created = service.create(input);
  assert.equal(created.status, "held");
  assert.equal(service.confirm(created.id).status, "confirmed");
});

test("rejects overlapping reservations for one tool", () => {
  const {service} = setup();
  service.create(input);
  assert.throws(() => service.create({...input, startsAt: "2030-04-02T11:00:00Z"}), /already reserved/);
});

test("cancellation releases a time window", () => {
  const {service} = setup();
  const created = service.create(input);
  assert.equal(service.cancel(created.id).status, "cancelled");
  assert.equal(service.create(input).status, "held");
});
