package com.blueprint.fixture.lockers.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

public final class Delivery {
    private final Parcel parcel;
    private final String zone;
    private final String pickupCode;
    private DeliveryStatus status;
    private String lockerId;
    private Instant pickupDeadline;

    public Delivery(Parcel parcel, String zone, String pickupCode) {
        this.parcel = Objects.requireNonNull(parcel, "parcel");
        this.zone = requireText(zone, "zone");
        this.pickupCode = requireText(pickupCode, "pickupCode");
        this.status = DeliveryStatus.QUEUED;
    }

    public Parcel parcel() {
        return parcel;
    }

    public String zone() {
        return zone;
    }

    public DeliveryStatus status() {
        return status;
    }

    public Optional<String> lockerId() {
        return Optional.ofNullable(lockerId);
    }

    public Optional<Instant> pickupDeadline() {
        return Optional.ofNullable(pickupDeadline);
    }

    public void assign(String candidateLockerId, Instant deadline) {
        if (status != DeliveryStatus.QUEUED) {
            throw new DomainException("Delivery is already " + status);
        }
        lockerId = requireText(candidateLockerId, "lockerId");
        pickupDeadline = Objects.requireNonNull(deadline, "deadline");
        status = DeliveryStatus.ASSIGNED;
    }

    public void collect(String suppliedPickupCode) {
        if (status != DeliveryStatus.ASSIGNED) {
            throw new DomainException("Delivery is not ready for collection");
        }
        if (!pickupCode.equals(suppliedPickupCode)) {
            throw new DomainException("Pickup code is invalid");
        }
        status = DeliveryStatus.COLLECTED;
    }

    public void cancel() {
        if (status != DeliveryStatus.QUEUED && status != DeliveryStatus.ASSIGNED) {
            throw new DomainException("Collected delivery cannot be cancelled");
        }
        status = DeliveryStatus.CANCELLED;
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value.trim();
    }
}
