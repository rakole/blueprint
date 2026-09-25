package com.blueprint.fixture.lockers.application;

import com.blueprint.fixture.lockers.domain.Delivery;

import java.util.Optional;

public interface DeliveryRepository {
    Optional<Delivery> findByTrackingId(String trackingId);

    void save(Delivery delivery);
}
