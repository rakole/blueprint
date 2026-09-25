# Integrations

## Purpose

Integration surfaces are local standard-library adapters. PropertiesServiceConfigLoader reads pickup.window.hours and default.zone; CsvManifestReader reads five-column CSV rows and ManifestImportService maps them to CreateDeliveryCommand values; Main composes these with in-memory repositories, a fixed clock, and console notifications. sql/schema.sql is an illustrative relational shape for a future adapter, while the executable baseline remains in memory.

## CLI

Main accepts an optional config path and optional manifest path. With a manifest it imports rows and prints a receipt count; without one it prints a readiness message for the configured default zone.

## Persistence and notification

In-memory repositories are the only executable persistence adapters. ConsoleNotificationAdapter reports ready and collected events; no network client, database driver, or durable store is shown.

## Evidence

- `src/com/blueprint/fixture/lockers/Main.java`
- `src/com/blueprint/fixture/lockers/config/PropertiesServiceConfigLoader.java`
- `config/default.properties`
- `src/com/blueprint/fixture/lockers/adapter/CsvManifestReader.java`
- `src/com/blueprint/fixture/lockers/application/ManifestImportService.java`
- `src/com/blueprint/fixture/lockers/adapter/InMemoryDeliveryRepository.java`
- `src/com/blueprint/fixture/lockers/adapter/InMemoryLockerRepository.java`
- `sql/schema.sql`
