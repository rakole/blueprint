package com.blueprint.fixture.lockers.application;

import com.blueprint.fixture.lockers.domain.LockerSize;

import java.util.Objects;

public record CreateDeliveryCommand(
        String trackingId,
        String recipientId,
        LockerSize requestedSize,
        String zone,
        String pickupCode) {
    public CreateDeliveryCommand {
        trackingId = requireText(trackingId, "trackingId");
        recipientId = requireText(recipientId, "recipientId");
        requestedSize = Objects.requireNonNull(requestedSize, "requestedSize");
        zone = requireText(zone, "zone");
        pickupCode = requireText(pickupCode, "pickupCode");
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value.trim();
    }
}
