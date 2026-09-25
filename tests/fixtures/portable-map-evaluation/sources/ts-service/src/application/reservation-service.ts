import {NotFoundError} from "../domain/errors.ts";
import {Reservation} from "../domain/reservation.ts";
import {assertReservationAllowed} from "../domain/reservation-policy.ts";
import type {CreateReservationInput, ReservationView} from "../contracts/reservations.ts";
import type {MemberRepository} from "../persistence/member-repository.ts";
import type {ReservationRepository} from "../persistence/reservation-repository.ts";
import type {ToolRepository} from "../persistence/tool-repository.ts";
import {asReservationId} from "../types/ids.ts";

type ReservationServiceDeps = {
  members: MemberRepository;
  tools: ToolRepository;
  reservations: ReservationRepository;
  now: () => Date;
  nextId: () => string;
};

export class ReservationService {
  private readonly deps: ReservationServiceDeps;

  constructor(deps: ReservationServiceDeps) {
    this.deps = deps;
  }

  create(input: CreateReservationInput): ReservationView {
    const member = this.deps.members.findById(input.memberId);
    if (!member) throw new NotFoundError("member");
    const tool = this.deps.tools.findById(input.toolId);
    if (!tool) throw new NotFoundError("tool");
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    const reservation = Reservation.create({
      id: asReservationId(this.deps.nextId()),
      memberId: input.memberId,
      toolId: input.toolId,
      startsAt,
      endsAt,
    }, this.deps.now());
    assertReservationAllowed(
      member,
      tool,
      this.deps.reservations.findByMember(member.id),
      this.deps.reservations.findOverlapping(tool.id, startsAt, endsAt),
    );
    this.deps.reservations.save(reservation);
    return reservation.toView();
  }

  get(id: string): ReservationView {
    const reservation = this.deps.reservations.findById(asReservationId(id));
    if (!reservation) throw new NotFoundError("reservation");
    return reservation.toView();
  }

  confirm(id: string): ReservationView {
    const current = this.require(id);
    const updated = current.confirm();
    this.deps.reservations.save(updated);
    return updated.toView();
  }

  cancel(id: string): ReservationView {
    const current = this.require(id);
    const updated = current.cancel();
    this.deps.reservations.save(updated);
    return updated.toView();
  }

  private require(id: string): Reservation {
    const reservation = this.deps.reservations.findById(asReservationId(id));
    if (!reservation) throw new NotFoundError("reservation");
    return reservation;
  }
}
