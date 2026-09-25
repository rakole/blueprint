import { DispatchRuleError } from "./errors.ts";
import type { SlotRequest } from "../types.ts";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export function validateSlotRequest(request: SlotRequest): SlotRequest {
  if (!request.requestId || !request.memberId || !request.depotCode) {
    throw new DispatchRuleError("slot requests require ids and a depot");
  }
  if (!Number.isInteger(request.boxCount) || request.boxCount < 1 || request.boxCount > 12) {
    throw new DispatchRuleError("slot requests support between one and twelve boxes");
  }
  if (!isoDate.test(request.routeDate)) throw new DispatchRuleError("routeDate must use YYYY-MM-DD");
  return request;
}
