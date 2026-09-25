package com.blueprint.fixture.lockers;

import com.blueprint.fixture.lockers.adapter.FixedTimeSource;
import com.blueprint.fixture.lockers.adapter.InMemoryDeliveryRepository;
import com.blueprint.fixture.lockers.adapter.InMemoryLockerRepository;
import com.blueprint.fixture.lockers.application.CreateDeliveryCommand;
import com.blueprint.fixture.lockers.application.DeliveryApplicationService;
import com.blueprint.fixture.lockers.application.NotificationPort;
import com.blueprint.fixture.lockers.domain.DeliveryStatus;
import com.blueprint.fixture.lockers.domain.DomainException;
import com.blueprint.fixture.lockers.domain.Locker;
import com.blueprint.fixture.lockers.domain.LockerSize;
import com.blueprint.fixture.lockers.domain.ParcelStatus;
import com.blueprint.fixture.lockers.domain.ZoneAwareLockerPolicy;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public final class DeliveryApplicationServiceTest {
    public static void main(String[] args) {
        assignsSmallestFittingLockerAndReleasesOnCollection();
        rejectsWrongPickupCodeWithoutChangingState();
        rejectsOversizedParcelWhenNoLockerFits();
        System.out.println("DeliveryApplicationServiceTest passed");
    }

    private static void assignsSmallestFittingLockerAndReleasesOnCollection() {
        InMemoryDeliveryRepository deliveries = new InMemoryDeliveryRepository();
        InMemoryLockerRepository lockers = new InMemoryLockerRepository(List.of(
                new Locker("N-10", LockerSize.LARGE, "NORTH"),
                new Locker("N-11", LockerSize.MEDIUM, "NORTH"),
                new Locker("N-12", LockerSize.SMALL, "NORTH"),
                new Locker("S-10", LockerSize.LARGE, "SOUTH")));
        RecordingNotifications notifications = new RecordingNotifications();
        DeliveryApplicationService service = newService(deliveries, lockers, notifications);

        var receipt = service.accept(new CreateDeliveryCommand(
                "PK-100", "recipient-7", LockerSize.MEDIUM, "NORTH", "4821"));

        check(receipt.lockerId().equals("N-11"), "medium parcel should use the smallest fitting locker");
        check(receipt.status() == DeliveryStatus.ASSIGNED, "receipt should report assignment");
        check(receipt.pickupDeadline().equals(Instant.parse("2026-02-03T10:00:00Z")), "deadline should use service clock");
        check(notifications.events.equals(List.of("ready:PK-100")), "assignment should notify once");
        check(lockers.findById("N-11").orElseThrow().parcelTrackingId().orElseThrow().equals("PK-100"), "locker should be occupied");

        service.collect("PK-100", "4821");
        var delivery = deliveries.findByTrackingId("PK-100").orElseThrow();
        check(delivery.status() == DeliveryStatus.COLLECTED, "delivery should be collected");
        check(delivery.parcel().status() == ParcelStatus.COLLECTED, "parcel should be collected");
        check(lockers.findById("N-11").orElseThrow().isAvailable(), "locker should be released");
        check(notifications.events.equals(List.of("ready:PK-100", "collected:PK-100")), "collection should notify once");
    }

    private static void rejectsWrongPickupCodeWithoutChangingState() {
        InMemoryDeliveryRepository deliveries = new InMemoryDeliveryRepository();
        InMemoryLockerRepository lockers = new InMemoryLockerRepository(List.of(
                new Locker("N-20", LockerSize.SMALL, "NORTH")));
        DeliveryApplicationService service = newService(deliveries, lockers, new RecordingNotifications());
        service.accept(new CreateDeliveryCommand("PK-200", "recipient-8", LockerSize.SMALL, "NORTH", "secret"));

        expectDomain(() -> service.collect("PK-200", "wrong"), "wrong pickup code should be rejected");
        check(deliveries.findByTrackingId("PK-200").orElseThrow().status() == DeliveryStatus.ASSIGNED, "failed collection must preserve status");
        check(lockers.findById("N-20").orElseThrow().isAvailable() == false, "failed collection must preserve locker assignment");
    }

    private static void rejectsOversizedParcelWhenNoLockerFits() {
        InMemoryDeliveryRepository deliveries = new InMemoryDeliveryRepository();
        InMemoryLockerRepository lockers = new InMemoryLockerRepository(List.of(
                new Locker("N-30", LockerSize.MEDIUM, "NORTH")));
        DeliveryApplicationService service = newService(deliveries, lockers, new RecordingNotifications());

        expectDomain(() -> service.accept(new CreateDeliveryCommand(
                "PK-300", "recipient-9", LockerSize.LARGE, "NORTH", "1234")), "oversized parcel should be rejected");
        check(deliveries.findByTrackingId("PK-300").isEmpty(), "rejected parcel must not be persisted");
        check(lockers.findById("N-30").orElseThrow().isAvailable(), "rejected parcel must not occupy a locker");
    }

    private static DeliveryApplicationService newService(
            InMemoryDeliveryRepository deliveries,
            InMemoryLockerRepository lockers,
            NotificationPort notifications) {
        return new DeliveryApplicationService(
                deliveries,
                lockers,
                new ZoneAwareLockerPolicy(),
                notifications,
                new FixedTimeSource(Instant.parse("2026-02-01T10:00:00Z")),
                Duration.ofHours(48));
    }

    private static void expectDomain(Runnable action, String message) {
        try {
            action.run();
            throw new AssertionError(message);
        } catch (DomainException expected) {
            // Expected policy rejection.
        }
    }

    private static void check(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    private static final class RecordingNotifications implements NotificationPort {
        private final List<String> events = new ArrayList<>();

        @Override
        public void deliveryReady(com.blueprint.fixture.lockers.domain.Delivery delivery) {
            events.add("ready:" + delivery.parcel().trackingId());
        }

        @Override
        public void deliveryCollected(com.blueprint.fixture.lockers.domain.Delivery delivery) {
            events.add("collected:" + delivery.parcel().trackingId());
        }
    }
}
