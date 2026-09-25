# Conventions

## Purpose

The components use explicit small boundaries and keep domain rules near their owning models. TypeScript uses ESM imports, interfaces and union literals; Python uses snake_case functions and frozen dataclasses; Java uses package-scoped records, interfaces and enum statuses. Cross-language JSON uses camelCase field names such as dispatchId and routeDate.

## Validation and errors

The console throws DispatchRuleError for slot and box rule failures, the planner raises PlanningError, and Java records/services use IllegalArgumentException or IllegalStateException for invalid assignments. Validation stays in domain or validation modules rather than in adapters.

## Storage and adapters

Repository interfaces or in-memory implementations isolate persistence. Python SlotRequest, PlannedStop and RoutePlan are frozen dataclasses; Java domain values are records and the console stores Dispatch values in a Map.

## Contract naming

The shared wire vocabulary uses eventType=dispatch.assigned and status=ASSIGNED. Python converts camelCase request keys to snake_case model fields and serializes the plan back to camelCase keys.

## Evidence

- `apps/dispatch-console/src/domain/errors.ts`
- `apps/dispatch-console/src/domain/slot.ts`
- `apps/dispatch-console/src/types.ts`
- `workers/route-planner/src/routeplanner/models.py`
- `workers/route-planner/src/routeplanner/errors.py`
- `services/fulfillment/src/com/marketroute/fulfillment/domain/DispatchStatus.java`
- `services/fulfillment/src/com/marketroute/fulfillment/domain/DispatchEvent.java`
- `contracts/dispatch-event.schema.json`
- `workers/route-planner/src/routeplanner/serialization.py`
