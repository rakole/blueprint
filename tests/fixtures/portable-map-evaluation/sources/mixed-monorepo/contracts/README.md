# Shared contracts

`slot-request.schema.json` describes the request accepted by the dispatch
console and route planner. `dispatch-event.schema.json` describes the event
emitted after the fulfillment service assigns a food box. The example files are
small, valid payloads used by component tests and the cross-language check.

`dispatch.sql` records the tables an eventual durable adapter would need,
while `status-codes.conf` keeps operational labels out of application code.
