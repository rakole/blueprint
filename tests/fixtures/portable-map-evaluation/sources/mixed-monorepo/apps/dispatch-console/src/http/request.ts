import type { SlotRequest } from "../types.ts";

export interface HttpRequest { method: string; path: string; body?: unknown; }

export function readSlotRequest(request: HttpRequest): SlotRequest {
  if (request.method !== "POST" || request.path !== "/slots") throw new Error("unsupported request");
  return request.body as SlotRequest;
}
