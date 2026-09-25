import {ConflictError} from "./errors.ts";
import {Member} from "./member.ts";
import {Tool} from "./tool.ts";
import type {Reservation} from "./reservation.ts";

export const MAX_OPEN_RESERVATIONS = 3;

export function assertReservationAllowed(
  member: Member,
  tool: Tool,
  memberReservations: readonly Reservation[],
  conflictingReservation: Reservation | undefined,
): void {
  if (!member.canReserve()) {
    throw new ConflictError("member is not allowed to reserve tools");
  }
  if (!tool.canReserve()) {
    throw new ConflictError("tool is not available for reservation");
  }
  if (memberReservations.filter((reservation) => reservation.status !== "cancelled").length >= MAX_OPEN_RESERVATIONS) {
    throw new ConflictError("member has reached the open reservation limit");
  }
  if (conflictingReservation) {
    throw new ConflictError("tool is already reserved for that time window");
  }
}
