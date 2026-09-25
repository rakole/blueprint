# Structure

## Purpose

Source packages are organized under com.blueprint.fixture.lockers: domain contains Parcel, Delivery, Locker, statuses, and assignment policy; application contains use-case services, commands, receipts, and ports; adapter contains in-memory repositories, CSV input, notifications, and a fixed clock; config contains property loading; Main composes the executable sample. Three Java main-style tests cover application behavior, configuration/manifest translation, and CLI wiring.

## Source tree

The repository has src/, tests/, config/, docs/, and sql/ roots. The Java source set has no framework or generated-code layer; each package is small and directly referenced by the CLI or tests.

## Domain vocabulary

DeliveryStatus and ParcelStatus represent lifecycle values; LockerSize provides fit ordering; Delivery, Parcel, and Locker hold state with guarded transitions. Application records CreateDeliveryCommand, ManifestLine, and DeliveryReceipt carry boundary data.

## Evidence

- `src/com/blueprint/fixture/lockers/domain/Delivery.java`
- `src/com/blueprint/fixture/lockers/domain/Parcel.java`
- `src/com/blueprint/fixture/lockers/domain/Locker.java`
- `src/com/blueprint/fixture/lockers/application/CreateDeliveryCommand.java`
- `src/com/blueprint/fixture/lockers/application/ManifestLine.java`
- `src/com/blueprint/fixture/lockers/application/DeliveryReceipt.java`
- `tests/com/blueprint/fixture/lockers/DeliveryApplicationServiceTest.java`
