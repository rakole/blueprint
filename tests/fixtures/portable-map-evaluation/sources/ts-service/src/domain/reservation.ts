import {ValidationError} from "./errors.ts";
import type {ReservationStatus, ReservationView} from "../contracts/reservations.ts";
import type {MemberId, ReservationId, ToolId} from "../types/ids.ts";

export type ReservationParts = {
  id: ReservationId;
  memberId: MemberId;
  toolId: ToolId;
  startsAt: Date;
  endsAt: Date;
  status?: ReservationStatus;
};

export class Reservation {
  readonly status: ReservationStatus;

  private readonly parts: ReservationParts;

  private constructor(parts: ReservationParts) {
    this.parts = parts;
    this.status = parts.status ?? "held";
  }

  static create(parts: ReservationParts, now: Date): Reservation {
    if (Number.isNaN(parts.startsAt.getTime()) || Number.isNaN(parts.endsAt.getTime())) {
      throw new ValidationError("reservation dates must be valid timestamps");
    }
    if (parts.endsAt <= parts.startsAt) {
      throw new ValidationError("reservation must end after it starts");
    }
    if (parts.startsAt < now) {
      throw new ValidationError("reservation cannot start in the past");
    }
    const durationHours = (parts.endsAt.getTime() - parts.startsAt.getTime()) / 3_600_000;
    if (durationHours < 2 || durationHours > 24 * 7) {
      throw new ValidationError("reservation duration must be between two hours and seven days");
    }
    return new Reservation(parts);
  }

  confirm(): Reservation {
    if (this.status !== "held") {
      throw new ValidationError("only held reservations can be confirmed");
    }
    return new Reservation({...this.parts, status: "confirmed"});
  }

  cancel(): Reservation {
    if (this.status === "cancelled") {
      return this;
    }
    return new Reservation({...this.parts, status: "cancelled"});
  }

  overlaps(startsAt: Date, endsAt: Date): boolean {
    return this.status !== "cancelled" && this.parts.startsAt < endsAt && startsAt < this.parts.endsAt;
  }

  toView(): ReservationView {
    return {
      id: this.parts.id,
      memberId: this.parts.memberId,
      toolId: this.parts.toolId,
      startsAt: this.parts.startsAt.toISOString(),
      endsAt: this.parts.endsAt.toISOString(),
      status: this.status,
    };
  }

  get id(): ReservationId { return this.parts.id; }
  get memberId(): MemberId { return this.parts.memberId; }
  get toolId(): ToolId { return this.parts.toolId; }
  get startsAt(): Date { return this.parts.startsAt; }
  get endsAt(): Date { return this.parts.endsAt; }
}
