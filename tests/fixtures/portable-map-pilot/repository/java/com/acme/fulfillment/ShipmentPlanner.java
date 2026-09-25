package com.acme.fulfillment;

public final class ShipmentPlanner {
    public ShipmentPlan planShipment(String destinationZone, int weightGrams) {
        String service = weightGrams > 5000 ? "freight" : "parcel";
        return new ShipmentPlan(destinationZone, service, weightGrams);
    }

    public record ShipmentPlan(String destinationZone, String service, int weightGrams) {}
}
