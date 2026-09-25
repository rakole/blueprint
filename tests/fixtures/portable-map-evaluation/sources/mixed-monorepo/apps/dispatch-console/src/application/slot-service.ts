import { validateSlotRequest } from "../domain/slot.ts";
import type { SlotRequest } from "../types.ts";

export class SlotService {
  accept(request: SlotRequest): SlotRequest { return validateSlotRequest(request); }
}
