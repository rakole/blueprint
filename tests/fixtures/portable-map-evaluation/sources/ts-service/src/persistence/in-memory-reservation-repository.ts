import type {Reservation} from "../domain/reservation.ts";
import type {MemberId, ReservationId, ToolId} from "../types/ids.ts";
import type {ReservationRepository} from "./reservation-repository.ts";

export class InMemoryReservationRepository implements ReservationRepository {
  private readonly records = new Map<ReservationId, Reservation>();

  findById(id: ReservationId): Reservation | undefined {
    return this.records.get(id);
  }

  findByMember(memberId: MemberId): Reservation[] {
    return [...this.records.values()].filter((reservation) => reservation.memberId === memberId);
  }

  findOverlapping(toolId: ToolId, startsAt: Date, endsAt: Date): Reservation | undefined {
    return [...this.records.values()].find(
      (reservation) => reservation.toolId === toolId && reservation.overlaps(startsAt, endsAt),
    );
  }

  save(reservation: Reservation): void {
    this.records.set(reservation.id, reservation);
  }
}
