package com.blueprint.fixture.lockers.domain;

import java.util.Objects;

public final class Parcel {
    private final String trackingId;
    private final String recipientId;
    private final LockerSize requestedSize;
    private final String zone;
    private ParcelStatus status;

    public Parcel(String trackingId, String recipientId, LockerSize requestedSize, String zone) {
        this.trackingId = requireText(trackingId, "trackingId");
        this.recipientId = requireText(recipientId, "recipientId");
        this.requestedSize = Objects.requireNonNull(requestedSize, "requestedSize");
        this.zone = requireText(zone, "zone");
        this.status = ParcelStatus.REGISTERED;
    }

    public String trackingId() {
        return trackingId;
    }

    public String recipientId() {
        return recipientId;
    }

    public LockerSize requestedSize() {
        return requestedSize;
    }

    public String zone() {
        return zone;
    }

    public ParcelStatus status() {
        return status;
    }

    public void markReady() {
        requireStatus(ParcelStatus.REGISTERED);
        status = ParcelStatus.READY_FOR_PICKUP;
    }

    public void collect() {
        requireStatus(ParcelStatus.READY_FOR_PICKUP);
        status = ParcelStatus.COLLECTED;
    }

    public void returnToDepot() {
        if (status == ParcelStatus.COLLECTED) {
            throw new DomainException("Collected parcel cannot return to depot");
        }
        status = ParcelStatus.RETURNED;
    }

    private void requireStatus(ParcelStatus expected) {
        if (status != expected) {
            throw new DomainException("Parcel " + trackingId + " is " + status + ", expected " + expected);
        }
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value.trim();
    }
}
