package com.marketroute.fulfillment.domain;

public record ShelfAssignment(String boxId, String depotCode, String shelfCode, DispatchStatus status) {
    public ShelfAssignment {
        if (boxId == null || boxId.isBlank() || depotCode == null || depotCode.isBlank()) {
            throw new IllegalArgumentException("assignment ids are required");
        }
    }
}
