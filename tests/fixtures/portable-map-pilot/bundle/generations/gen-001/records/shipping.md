# Shipping source records

## File: `python/rates.py` {#file-python-rates-py}

- Language: Python; role: local delivery-rate lookup.
- Source: [rates.py](../../../../../python/rates.py#L1-L10)
- Symbol: `RateTable.quote_shipping` (lines 8-10), aliases: `shipping quote`,
  `delivery rate`.
- Constraint: an unknown destination uses the standard rate.

## File: `java/com/acme/fulfillment/ShipmentPlanner.java` {#file-java-com-acme-fulfillment-shipmentplanner-java}

- Language: Java; role: parcel or freight service selection.
- Source: [ShipmentPlanner.java](../../../../../java/com/acme/fulfillment/ShipmentPlanner.java#L1-L11)
- Symbol: `ShipmentPlanner.planShipment` (lines 4-7), alias: `dispatch plan`.
- Symbol: `ShipmentPlanner.ShipmentPlan` (lines 9-11).
