package com.blueprint.fixture.lockers.application;

import com.blueprint.fixture.lockers.domain.Locker;

import java.util.List;
import java.util.Optional;

public interface LockerRepository {
    List<Locker> findAvailableInZone(String zone);

    Optional<Locker> findById(String lockerId);

    void save(Locker locker);
}
