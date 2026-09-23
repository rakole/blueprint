# Delivery rates and shipment planning

## Purpose

Shipping combines a local delivery-rate table with a Java shipment planner.
The vocabulary includes `shipping quote`, `delivery rate`, `shipment plan`, and
the alias `dispatch plan`.

## Entry points and flow

- [Rate records](../records/shipping.md#file-python-rates-py) describe the
  Python zone lookup and weight adjustment.
- [Planner records](../records/shipping.md#file-java-com-acme-fulfillment-shipmentplanner-java)
  describe the Java service and its parcel/freight boundary.
- The SQL file is [inventory-only](../records/unsupported.md#file-db-migrations-001-orders-sql).

## Required live evidence

- [Python rate source](../records/shipping.md#file-python-rates-py)
- [Java planner source](../records/shipping.md#file-java-com-acme-fulfillment-shipmentplanner-java)

## Supporting evidence

- No direct shipping test is present in the selected inventory. This is
  **no test evidence in the selected inventory**, not a coverage claim.

## Constraints

- Unknown zones use the standard local rate.
- Weight changes the quoted amount and the Java planner selects a service.
- Python and Java records are separate evidence; no runtime call graph is
  asserted.
