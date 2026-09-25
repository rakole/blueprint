# Planning boundary

Requests are grouped by depot and route date. The planner gives the configured
priority depot a stable first position, then orders other depots by box count
and code. Capacity is checked before a plan is emitted; a fulfillment service
still decides whether an individual box can be assigned to a shelf.
