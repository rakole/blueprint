# Architecture

## Purpose

Pickup requests enter the dispatch console router, are validated and saved by DispatchService, and can be grouped into route summaries. The Python worker independently filters requests by date, validates and capacity-checks them, then orders stops. The Java service assigns a box to a depot shelf, stores the assignment, publishes a dispatch.assigned event, and returns a receipt. Shared JSON contracts define the handoff vocabulary while each component owns its own business rules.

## Console flow

dispatchRouter maps POST /slots to request translation and DispatchService.create, and maps GET /routes to routeForDate. main.ts composes the router with an in-memory repository. Router returns a 404 JSON response for an unknown method/path.

## Worker boundary

build_plan selects one route date, calls request validation, enforces daily capacity, and creates ordered PlannedStop values. Repository and schedule helpers provide in-memory pending lookup and date grouping; neither is shown as a durable queue.

## Fulfillment flow

BoxAssignmentService checks the depot and shelf capacity, rejects duplicate box assignments, saves ShelfAssignment through DispatchRepository, publishes DispatchEvent through EventPublisher, and returns DispatchReceipt.

## Evidence

- `apps/dispatch-console/src/main.ts`
- `apps/dispatch-console/src/http/dispatch-routes.ts`
- `apps/dispatch-console/src/http/router.ts`
- `apps/dispatch-console/src/application/dispatch-service.ts`
- `apps/dispatch-console/src/persistence/in-memory-dispatch-repository.ts`
- `workers/route-planner/src/routeplanner/planner.py`
- `workers/route-planner/src/routeplanner/repository.py`
- `workers/route-planner/src/routeplanner/schedule.py`
- `services/fulfillment/src/com/marketroute/fulfillment/application/BoxAssignmentService.java`
- `services/fulfillment/src/com/marketroute/fulfillment/application/DispatchRepository.java`
- `services/fulfillment/src/com/marketroute/fulfillment/application/EventPublisher.java`
