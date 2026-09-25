# Fulfillment service

The Java service receives a food-box assignment, verifies that the requested
box fits a depot shelf, stores the assignment in memory, and publishes the
shared `dispatch.assigned` event. It owns fulfillment status transitions while
the sibling Python worker owns route ordering.

From this directory, compile `src` and `tests` into a temporary folder and run
the test classes listed below. The service uses only Java 17 standard-library
APIs and has no runtime network or database dependency. `sql/fulfillment.sql`
documents the durable shape an adapter could implement later.
