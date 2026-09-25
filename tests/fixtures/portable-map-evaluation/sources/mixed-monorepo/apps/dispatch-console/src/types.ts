export type DispatchStatus = "ASSIGNED" | "READY" | "COLLECTED";

export interface SlotRequest {
  requestId: string;
  memberId: string;
  depotCode: string;
  boxCount: number;
  routeDate: string;
}

export interface DispatchEvent {
  eventType: "dispatch.assigned";
  dispatchId: string;
  boxId: string;
  depotCode: string;
  routeDate: string;
  status: DispatchStatus;
}

export interface Dispatch {
  id: string;
  memberId: string;
  depotCode: string;
  routeDate: string;
  boxCount: number;
  status: DispatchStatus;
}

export interface RouteSummary {
  depotCode: string;
  routeDate: string;
  dispatchIds: string[];
  boxCount: number;
}
