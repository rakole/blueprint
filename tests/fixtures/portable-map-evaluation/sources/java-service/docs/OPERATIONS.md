# Operating notes

An inbound manifest row has five comma-separated values:

```
trackingId,recipientId,lockerSize,zone,pickupCode
```

The first row may be a header. A manifest import creates a delivery only when
the requested locker size fits an available locker in the requested zone. The
application records the assignment before it emits a notification so an
operator can reconcile the notification against the delivery repository.

Pickup codes are treated as secrets at the application boundary: the service
compares the supplied code and never includes it in a receipt or notification.
An assigned parcel remains in its locker until a successful collection or a
separate cancellation workflow releases it. The sample CLI uses in-memory
repositories and therefore loses assignments when the process exits.
