package com.blueprint.fixture.lockers.adapter;

import com.blueprint.fixture.lockers.application.LockerRepository;
import com.blueprint.fixture.lockers.domain.Locker;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class InMemoryLockerRepository implements LockerRepository {
    private final Map<String, Locker> lockers = new LinkedHashMap<>();

    public InMemoryLockerRepository(List<Locker> initialLockers) {
        initialLockers.forEach(this::save);
    }

    @Override
    public List<Locker> findAvailableInZone(String zone) {
        return lockers.values().stream()
                .filter(locker -> locker.zone().equals(zone) && locker.isAvailable())
                .toList();
    }

    @Override
    public Optional<Locker> findById(String lockerId) {
        return Optional.ofNullable(lockers.get(lockerId));
    }

    @Override
    public void save(Locker locker) {
        lockers.put(locker.id(), locker);
    }

    public List<Locker> snapshot() {
        return new ArrayList<>(lockers.values());
    }
}
