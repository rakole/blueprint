# Concerns

## Purpose

The executable baseline is intentionally small and in-memory. Dispatch persistence, planner request storage and fulfillment event publication are all process-local, while SQL files describe possible durable shapes only. Partial structural coverage and unsupported file types limit symbol-level detail for configuration, documentation and SQL; conclusions about those files remain file-level or explicit unknowns.

## Persistence and operations

The console and Java service use in-memory Maps/lists, and the Python repository is also in memory. The root README states that no service starts a network listener and no external database or message broker is required, so deployment, durability and broker delivery semantics are outside the observed baseline.

## Ownership limits

The planner owns route ordering and capacity estimates, while fulfillment owns individual shelf assignment and status transitions. The console parses the shared event but does not implement fulfillment lifecycle transitions.

## Evidence limits

The prepared generation contains unsupported SQL, JSON, TOML, properties and Markdown files plus partial parser coverage for selected source files. The SQL adapter role is therefore recorded as unknown at runtime even though its table shape is visible.

## Evidence

- `README.md`
- `contracts/field-notes.md`
- `apps/dispatch-console/src/persistence/in-memory-dispatch-repository.ts`
- `workers/route-planner/src/routeplanner/repository.py`
- `services/fulfillment/src/com/marketroute/fulfillment/adapter/InMemoryDispatchRepository.java`
- `services/fulfillment/src/com/marketroute/fulfillment/adapter/InMemoryEventPublisher.java`
- `contracts/dispatch.sql`
- `services/fulfillment/sql/fulfillment.sql`
- `contracts/README.md`
