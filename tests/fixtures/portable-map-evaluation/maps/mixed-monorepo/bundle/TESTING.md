# Testing

## Purpose

Checked-in tests exercise console domain, service, router and event parsing; planner validation, ordering, repository/date grouping and serialization; and Java fulfillment/configuration behavior. The root contract script probes the TypeScript parser, Python parser and Java probe with the same example event. The map records test sources and documented commands without claiming an execution result for this authoring pass.

## Component tests

Node tests cover slot and box boundaries, dispatch creation and route grouping, assigned-event parsing, and 404 routing. Python unittest modules cover assigned-event parsing, priority ordering, capacity rejection, repository/date grouping and plan JSON shape. Java main-based tests cover assignment, configuration and the contract probe.

## Cross-language check

scripts/check-contracts.mjs reads the dispatch-event example, sends it to the Python and Java probes, and checks both results against dispatch.assigned:ASSIGNED after the TypeScript parser accepts it.

## Evidence

- `README.md`
- `apps/dispatch-console/tests/contracts.test.ts`
- `apps/dispatch-console/tests/dispatch-service.test.ts`
- `apps/dispatch-console/tests/domain.test.ts`
- `apps/dispatch-console/tests/router.test.ts`
- `workers/route-planner/tests/test_contracts.py`
- `workers/route-planner/tests/test_planner.py`
- `workers/route-planner/tests/test_repository.py`
- `workers/route-planner/tests/test_serialization.py`
- `services/fulfillment/tests/com/marketroute/fulfillment/FulfillmentServiceTest.java`
- `services/fulfillment/tests/com/marketroute/fulfillment/ConfigurationTest.java`
- `services/fulfillment/tests/com/marketroute/fulfillment/ContractProbe.java`
- `scripts/check-contracts.mjs`
