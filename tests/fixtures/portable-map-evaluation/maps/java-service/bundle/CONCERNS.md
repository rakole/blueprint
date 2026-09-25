# Concerns

## Purpose

This is an intentionally bounded synthetic fixture. The executable composition uses process-local in-memory repositories, so assignments disappear when Main exits; sql/schema.sql describes a future relational adapter and is not wired. The prepared map has full structural coverage for 29 files and file-only coverage for six records, including a partial Java interface and five unsupported-language files, so claims about those files are limited to observed file content. No evidence establishes production-scale concurrency, durability, security hashing, or external protocol behavior.

## Lifecycle and data handling

Delivery keeps pickupCode in an in-memory String and compares it during collection; receipts and the console adapter use delivery and parcel identifiers/statuses rather than the code. cancel persists the cancelled delivery and releases its locker but does not call the notification port in the observed application method.

## Unsupported or future surfaces

README.md and docs/OPERATIONS.md are file-level evidence, as are properties and SQL files. The SQL schema includes a pickup_code_hash column, but no executable adapter or hashing implementation is present in the Java source.

## Evidence

- `README.md`
- `docs/OPERATIONS.md`
- `src/com/blueprint/fixture/lockers/application/DeliveryApplicationService.java`
- `src/com/blueprint/fixture/lockers/domain/Delivery.java`
- `sql/schema.sql`
- `config/default.properties`
