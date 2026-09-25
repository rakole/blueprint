# Structure

## Purpose

The tree separates apps/dispatch-console into domain, application, persistence, HTTP, types and UI areas; workers/route-planner into models, validation, scoring, planning, storage helpers, serialization and CLI; and services/fulfillment into domain, application, adapter and config packages. contracts/ contains shared schemas and examples, while tests remain beside each component.

## Dispatch console

Domain modules define slot and food-box rules, application services coordinate dispatch creation and event translation, repository interfaces isolate storage, and HTTP modules translate requests and responses. dispatch-board.tsx and status-badge.jsx are small render surfaces.

## Route planner

models.py defines immutable request, stop and plan shapes; validation.py and scoring.py hold input and ordering rules; planner.py orchestrates them; serialization.py and cli.py form the JSON/stdin boundary.

## Fulfillment service

Java domain records model depots, food boxes, shelf assignments, events and statuses. Application ports and BoxAssignmentService coordinate assignment, while in-memory adapters and PropertiesConfigLoader provide the executable baseline.

## Evidence

- `apps/dispatch-console/src/types.ts`
- `apps/dispatch-console/src/domain/slot.ts`
- `apps/dispatch-console/src/application/dispatch-service.ts`
- `apps/dispatch-console/src/http/dispatch-routes.ts`
- `apps/dispatch-console/src/ui/dispatch-board.tsx`
- `workers/route-planner/src/routeplanner/models.py`
- `workers/route-planner/src/routeplanner/planner.py`
- `workers/route-planner/src/routeplanner/serialization.py`
- `services/fulfillment/src/com/marketroute/fulfillment/domain/DispatchEvent.java`
- `services/fulfillment/src/com/marketroute/fulfillment/application/BoxAssignmentService.java`
- `services/fulfillment/src/com/marketroute/fulfillment/adapter/InMemoryDispatchRepository.java`
- `services/fulfillment/src/com/marketroute/fulfillment/config/PropertiesConfigLoader.java`
