import {randomUUID} from "node:crypto";

export function newReservationId() {
  return randomUUID();
}
