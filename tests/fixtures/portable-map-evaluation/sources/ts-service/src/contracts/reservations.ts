import type {MemberId, ReservationId, ToolId} from "../types/ids.ts";

export type ReservationStatus = "held" | "confirmed" | "cancelled";

export type CreateReservationInput = {
  memberId: MemberId;
  toolId: ToolId;
  startsAt: string;
  endsAt: string;
};

export type ReservationView = {
  id: ReservationId;
  memberId: MemberId;
  toolId: ToolId;
  startsAt: string;
  endsAt: string;
  status: ReservationStatus;
};
