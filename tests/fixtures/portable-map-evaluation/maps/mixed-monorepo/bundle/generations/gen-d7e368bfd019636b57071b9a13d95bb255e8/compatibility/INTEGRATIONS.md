# Integrations

## Purpose

contracts/slot-request.schema.json and contracts/dispatch-event.schema.json define the shared JSON shapes. The console creates and validates assigned dispatch events, the Python worker validates the same event vocabulary and consumes slot requests, and Java serializes the fulfillment event. The source describes in-process and stdin/stdout checks; no network listener, broker client or external database adapter is shown.

## Pickup request

A slot request carries requestId, memberId, depotCode, boxCount and routeDate; the schema bounds boxCount from 1 through 12 and requires an ISO date. The console and Python model preserve those fields while using language-specific naming internally.

## Dispatch event

An assigned event carries eventType, dispatchId, boxId, depotCode, routeDate and status. TypeScript, Python and Java all enforce or probe dispatch.assigned with ASSIGNED status; status codes also list READY and COLLECTED for the broader lifecycle vocabulary.

## Durable shapes

contracts/dispatch.sql and services/fulfillment/sql/fulfillment.sql describe future dispatch and shelf-assignment tables and indexes. They are file-level SQL evidence and are not shown as active runtime integrations.

## Evidence

- `contracts/slot-request.schema.json`
- `contracts/dispatch-event.schema.json`
- `contracts/slot-request.example.json`
- `contracts/dispatch-event.example.json`
- `apps/dispatch-console/src/application/contracts.ts`
- `workers/route-planner/src/routeplanner/contracts.py`
- `services/fulfillment/src/com/marketroute/fulfillment/domain/DispatchEvent.java`
- `scripts/check-contracts.mjs`
- `contracts/dispatch.sql`
- `services/fulfillment/sql/fulfillment.sql`
