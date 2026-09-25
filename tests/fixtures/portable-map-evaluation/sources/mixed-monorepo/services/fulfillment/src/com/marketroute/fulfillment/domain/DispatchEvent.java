package com.marketroute.fulfillment.domain;

public record DispatchEvent(String dispatchId, String boxId, String depotCode, String routeDate, DispatchStatus status) {
    public String eventType() { return "dispatch.assigned"; }

    public String toJson() {
        return "{\"eventType\":\"" + eventType() + "\",\"dispatchId\":\"" + dispatchId
            + "\",\"boxId\":\"" + boxId + "\",\"depotCode\":\"" + depotCode
            + "\",\"routeDate\":\"" + routeDate + "\",\"status\":\"" + status + "\"}";
    }
}
