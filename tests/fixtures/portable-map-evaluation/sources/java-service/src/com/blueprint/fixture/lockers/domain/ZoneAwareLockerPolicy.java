package com.blueprint.fixture.lockers.domain;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;

public final class ZoneAwareLockerPolicy implements LockerAssignmentPolicy {
    @Override
    public Optional<Locker> choose(Parcel parcel, List<Locker> availableLockers) {
        return availableLockers.stream()
                .filter(Locker::isAvailable)
                .filter(locker -> locker.zone().equals(parcel.zone()))
                .filter(locker -> locker.size().fits(parcel.requestedSize()))
                .min(Comparator.comparing(Locker::size).thenComparing(Locker::id));
    }
}
