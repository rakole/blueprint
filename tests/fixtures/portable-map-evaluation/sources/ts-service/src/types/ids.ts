export type MemberId = string & {readonly __brand: "MemberId"};
export type ToolId = string & {readonly __brand: "ToolId"};
export type ReservationId = string & {readonly __brand: "ReservationId"};

export function asMemberId(value: string): MemberId {
  return value as MemberId;
}

export function asToolId(value: string): ToolId {
  return value as ToolId;
}

export function asReservationId(value: string): ReservationId {
  return value as ReservationId;
}
