import {systemClock} from "./adapters/system-clock.js";
import {newReservationId} from "./adapters/ids.js";
import {ReservationService} from "./application/reservation-service.ts";
import {InMemoryMemberRepository} from "./persistence/in-memory-member-repository.ts";
import {InMemoryReservationRepository} from "./persistence/in-memory-reservation-repository.ts";
import {InMemoryToolRepository} from "./persistence/in-memory-tool-repository.ts";
import {routeRequest} from "./http/router.ts";
import {Member} from "./domain/member.ts";
import {Tool} from "./domain/tool.ts";
import {asMemberId, asToolId} from "./types/ids.ts";

type ServiceSeed = {
  members: readonly Member[];
  tools: readonly Tool[];
};

export function createService(seed: ServiceSeed = {members: [], tools: []}): ReservationService {
  return new ReservationService({
    members: new InMemoryMemberRepository(seed.members),
    tools: new InMemoryToolRepository(seed.tools),
    reservations: new InMemoryReservationRepository(),
    now: systemClock,
    nextId: newReservationId,
  });
}

export function createDemoService(): ReservationService {
  return createService({
    members: [new Member(asMemberId("member-1"), "Alex Rivera")],
    tools: [new Tool(asToolId("tool-drill"), "Cordless drill", "power")],
  });
}

export {routeRequest};
