# Architecture

## Purpose

The implementation separates domain state and policies from application orchestration, ports, adapters, configuration, and CLI composition. DeliveryApplicationService coordinates repository lookups, ZoneAwareLockerPolicy selection, Delivery and Parcel transitions, persistence, and notifications; Main wires those ports to in-memory adapters and a fixed clock.

## Application flow

accept constructs a Parcel, asks the assignment policy to choose from available lockers in the requested zone, assigns a deadline, saves delivery and locker state, then emits deliveryReady. collect and cancel delegate lifecycle checks to Delivery and Parcel while releasing the associated locker.

## Ports and adapters

DeliveryRepository, LockerRepository, NotificationPort, ManifestReader, and TimeSource define application-facing boundaries. InMemoryDeliveryRepository, InMemoryLockerRepository, ConsoleNotificationAdapter, CsvManifestReader, and FixedTimeSource provide executable adapters in this fixture.

## Evidence

- `src/com/blueprint/fixture/lockers/application/DeliveryApplicationService.java`
- `src/com/blueprint/fixture/lockers/domain/ZoneAwareLockerPolicy.java`
- `src/com/blueprint/fixture/lockers/Main.java`
- `src/com/blueprint/fixture/lockers/application/DeliveryRepository.java`
- `src/com/blueprint/fixture/lockers/application/LockerRepository.java`
- `src/com/blueprint/fixture/lockers/application/NotificationPort.java`
