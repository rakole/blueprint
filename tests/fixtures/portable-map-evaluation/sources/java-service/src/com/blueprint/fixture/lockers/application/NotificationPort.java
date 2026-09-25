package com.blueprint.fixture.lockers.application;

import com.blueprint.fixture.lockers.domain.Delivery;

public interface NotificationPort {
    void deliveryReady(Delivery delivery);

    void deliveryCollected(Delivery delivery);
}
