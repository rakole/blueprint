package com.blueprint.fixture.lockers.application;

import com.blueprint.fixture.lockers.domain.Delivery;
import com.blueprint.fixture.lockers.domain.DeliveryStatus;
import com.blueprint.fixture.lockers.domain.DomainException;
import com.blueprint.fixture.lockers.domain.Locker;
import com.blueprint.fixture.lockers.domain.LockerAssignmentPolicy;
import com.blueprint.fixture.lockers.domain.Parcel;

import java.time.Instant;
import java.util.Objects;

public final class DeliveryApplicationService {
    private final DeliveryRepository deliveryRepository;
    private final LockerRepository lockerRepository;
    private final LockerAssignmentPolicy assignmentPolicy;
    private final NotificationPort notificationPort;
    private final TimeSource timeSource;
    private final java.time.Duration pickupWindow;

    public DeliveryApplicationService(
            DeliveryRepository deliveryRepository,
            LockerRepository lockerRepository,
            LockerAssignmentPolicy assignmentPolicy,
            NotificationPort notificationPort,
            TimeSource timeSource,
            java.time.Duration pickupWindow) {
        this.deliveryRepository = Objects.requireNonNull(deliveryRepository, "deliveryRepository");
        this.lockerRepository = Objects.requireNonNull(lockerRepository, "lockerRepository");
        this.assignmentPolicy = Objects.requireNonNull(assignmentPolicy, "assignmentPolicy");
        this.notificationPort = Objects.requireNonNull(notificationPort, "notificationPort");
        this.timeSource = Objects.requireNonNull(timeSource, "timeSource");
        this.pickupWindow = Objects.requireNonNull(pickupWindow, "pickupWindow");
        if (pickupWindow.isZero() || pickupWindow.isNegative()) {
            throw new IllegalArgumentException("pickupWindow must be positive");
        }
    }

    public DeliveryReceipt accept(CreateDeliveryCommand command) {
        Objects.requireNonNull(command, "command");
        if (deliveryRepository.findByTrackingId(command.trackingId()).isPresent()) {
            throw new DomainException("Tracking id already exists: " + command.trackingId());
        }

        Parcel parcel = new Parcel(
                command.trackingId(),
                command.recipientId(),
                command.requestedSize(),
                command.zone());
        Locker locker = assignmentPolicy.choose(
                        parcel,
                        lockerRepository.findAvailableInZone(command.zone()))
                .orElseThrow(() -> new DomainException("No locker available in zone " + command.zone()));

        Instant deadline = timeSource.now().plus(pickupWindow);
        parcel.markReady();
        Delivery delivery = new Delivery(parcel, command.zone(), command.pickupCode());
        delivery.assign(locker.id(), deadline);
        locker.assign(parcel.trackingId());

        deliveryRepository.save(delivery);
        lockerRepository.save(locker);
        notificationPort.deliveryReady(delivery);
        return receipt(delivery);
    }

    public void collect(String trackingId, String pickupCode) {
        Delivery delivery = findDelivery(trackingId);
        delivery.collect(pickupCode);
        Locker locker = lockerRepository.findById(delivery.lockerId().orElseThrow())
                .orElseThrow(() -> new DomainException("Locker record is missing"));
        delivery.parcel().collect();
        locker.release(trackingId);
        deliveryRepository.save(delivery);
        lockerRepository.save(locker);
        notificationPort.deliveryCollected(delivery);
    }

    public void cancel(String trackingId) {
        Delivery delivery = findDelivery(trackingId);
        delivery.cancel();
        if (delivery.status() == DeliveryStatus.CANCELLED && delivery.lockerId().isPresent()) {
            Locker locker = lockerRepository.findById(delivery.lockerId().orElseThrow())
                    .orElseThrow(() -> new DomainException("Locker record is missing"));
            locker.release(trackingId);
            lockerRepository.save(locker);
        }
        delivery.parcel().returnToDepot();
        deliveryRepository.save(delivery);
    }

    private Delivery findDelivery(String trackingId) {
        return deliveryRepository.findByTrackingId(trackingId)
                .orElseThrow(() -> new DomainException("Unknown tracking id: " + trackingId));
    }

    private DeliveryReceipt receipt(Delivery delivery) {
        return new DeliveryReceipt(
                delivery.parcel().trackingId(),
                delivery.lockerId().orElseThrow(),
                delivery.status(),
                delivery.pickupDeadline().orElseThrow());
    }
}
