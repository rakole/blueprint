package com.blueprint.fixture.lockers.application;

import com.blueprint.fixture.lockers.domain.DeliveryStatus;

import java.time.Instant;

public record DeliveryReceipt(
        String trackingId,
        String lockerId,
        DeliveryStatus status,
        Instant pickupDeadline) {
}
