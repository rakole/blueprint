package com.blueprint.fixture.lockers.domain;

import java.util.List;
import java.util.Optional;

public interface LockerAssignmentPolicy {
    Optional<Locker> choose(Parcel parcel, List<Locker> availableLockers);
}
