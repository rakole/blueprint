import type { DispatchEvent } from "../types.ts";

export function parseDispatchEvent(value: unknown): DispatchEvent {
  if (!value || typeof value !== "object") throw new Error("dispatch event must be an object");
  const candidate = value as Record<string, unknown>;
  const fields = ["dispatchId", "boxId", "depotCode", "routeDate"];
  if (candidate.eventType !== "dispatch.assigned" || candidate.status !== "ASSIGNED") {
    throw new Error("only assigned dispatch events are accepted");
  }
  for (const field of fields) {
    if (typeof candidate[field] !== "string" || candidate[field] === "") throw new Error(`missing ${field}`);
  }
  return candidate as unknown as DispatchEvent;
}
