package com.blueprint.fixture.lockers.domain;

import java.util.Objects;
import java.util.Optional;

public final class Locker {
    private final String id;
    private final LockerSize size;
    private final String zone;
    private String parcelTrackingId;

    public Locker(String id, LockerSize size, String zone) {
        this.id = requireText(id, "id");
        this.size = Objects.requireNonNull(size, "size");
        this.zone = requireText(zone, "zone");
    }

    public String id() {
        return id;
    }

    public LockerSize size() {
        return size;
    }

    public String zone() {
        return zone;
    }

    public boolean isAvailable() {
        return parcelTrackingId == null;
    }

    public Optional<String> parcelTrackingId() {
        return Optional.ofNullable(parcelTrackingId);
    }

    public void assign(String trackingId) {
        if (!isAvailable()) {
            throw new DomainException("Locker " + id + " is already occupied");
        }
        parcelTrackingId = requireText(trackingId, "trackingId");
    }

    public void release(String trackingId) {
        if (!Objects.equals(parcelTrackingId, trackingId)) {
            throw new DomainException("Locker " + id + " does not contain " + trackingId);
        }
        parcelTrackingId = null;
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value.trim();
    }
}
