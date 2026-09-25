package com.blueprint.fixture.lockers.adapter;

import com.blueprint.fixture.lockers.application.DeliveryRepository;
import com.blueprint.fixture.lockers.domain.Delivery;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

public final class InMemoryDeliveryRepository implements DeliveryRepository {
    private final Map<String, Delivery> deliveries = new LinkedHashMap<>();

    @Override
    public Optional<Delivery> findByTrackingId(String trackingId) {
        return Optional.ofNullable(deliveries.get(trackingId));
    }

    @Override
    public void save(Delivery delivery) {
        deliveries.put(delivery.parcel().trackingId(), delivery);
    }
}
