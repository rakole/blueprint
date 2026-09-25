import { validateSlotRequest } from "../domain/slot.ts";
import type { Dispatch, DispatchEvent, SlotRequest } from "../types.ts";
import type { DispatchRepository } from "../persistence/dispatch-repository.ts";
import { summarizeRoute } from "../domain/route.ts";

export class DispatchService {
  private readonly repository: DispatchRepository;

  constructor(repository: DispatchRepository) {
    this.repository = repository;
  }

  create(request: SlotRequest): Dispatch {
    validateSlotRequest(request);
    const dispatch: Dispatch = {
      id: `dispatch-${request.requestId}`,
      memberId: request.memberId,
      depotCode: request.depotCode,
      routeDate: request.routeDate,
      boxCount: request.boxCount,
      status: "ASSIGNED",
    };
    this.repository.save(dispatch);
    return dispatch;
  }

  routeForDate(routeDate: string) { return summarizeRoute(this.repository.findByDate(routeDate)); }

  toEvent(dispatch: Dispatch): DispatchEvent {
    return {
      eventType: "dispatch.assigned",
      dispatchId: dispatch.id,
      boxId: `box-${dispatch.id.replace("dispatch-", "")}`,
      depotCode: dispatch.depotCode,
      routeDate: dispatch.routeDate,
      status: dispatch.status,
    };
  }
}
