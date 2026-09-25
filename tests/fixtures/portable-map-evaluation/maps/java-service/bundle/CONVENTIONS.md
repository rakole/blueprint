# Conventions

## Purpose

The Java code uses final classes, records for boundary values, enums for statuses and sizes, constructor null checks, requireText validation for identifiers, Optional for absent locker and deadline values, and repository/port interfaces for application dependencies. IDs and zones are trimmed before storage where requireText is used; pickup codes are passed as strings and compared at collection.

## Validation and state

Parcel, Delivery, Locker, CreateDeliveryCommand, and ServiceConfig reject blank text and null required values. Delivery and Parcel guard legal transitions with DomainException; Locker guards ownership when assigning or releasing.

## Selection ordering

ZoneAwareLockerPolicy filters available lockers by zone and size fit, then chooses the minimum LockerSize and ID. The ordering is implemented with Comparator and is observed by the application test.

## Evidence

- `src/com/blueprint/fixture/lockers/domain/Parcel.java`
- `src/com/blueprint/fixture/lockers/domain/Delivery.java`
- `src/com/blueprint/fixture/lockers/domain/Locker.java`
- `src/com/blueprint/fixture/lockers/domain/ZoneAwareLockerPolicy.java`
- `tests/com/blueprint/fixture/lockers/DeliveryApplicationServiceTest.java`
