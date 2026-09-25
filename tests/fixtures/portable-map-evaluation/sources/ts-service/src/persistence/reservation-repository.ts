import type {Reservation} from "../domain/reservation.ts";
import type {MemberId, ReservationId, ToolId} from "../types/ids.ts";

export interface ReservationRepository {
  findById(id: ReservationId): Reservation | undefined;
  findByMember(memberId: MemberId): Reservation[];
  findOverlapping(toolId: ToolId, startsAt: Date, endsAt: Date): Reservation | undefined;
  save(reservation: Reservation): void;
}
