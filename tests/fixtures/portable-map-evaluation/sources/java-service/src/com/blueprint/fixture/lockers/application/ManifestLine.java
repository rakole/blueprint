package com.blueprint.fixture.lockers.application;

import com.blueprint.fixture.lockers.domain.LockerSize;

public record ManifestLine(
        String trackingId,
        String recipientId,
        LockerSize requestedSize,
        String zone,
        String pickupCode) {
}
