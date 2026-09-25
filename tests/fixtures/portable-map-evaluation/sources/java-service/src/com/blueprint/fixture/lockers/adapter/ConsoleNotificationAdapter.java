package com.blueprint.fixture.lockers.adapter;

import com.blueprint.fixture.lockers.application.NotificationPort;
import com.blueprint.fixture.lockers.domain.Delivery;

public final class ConsoleNotificationAdapter implements NotificationPort {
    @Override
    public void deliveryReady(Delivery delivery) {
        System.out.println("READY " + delivery.parcel().trackingId() + " locker="
                + delivery.lockerId().orElse("unknown"));
    }

    @Override
    public void deliveryCollected(Delivery delivery) {
        System.out.println("COLLECTED " + delivery.parcel().trackingId());
    }
}
