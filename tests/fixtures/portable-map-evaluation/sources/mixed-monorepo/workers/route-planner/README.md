# Route planner worker

The route planner turns pickup-slot requests into ordered depot work. It keeps a
small repository abstraction for queued requests, applies a capacity rule, and
serializes the resulting plan for the dispatch console or a future worker queue.
It reads the same request and dispatch event vocabulary as the sibling
components, but owns route ordering rather than fulfillment status transitions.

Run the baseline from this directory:

```sh
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=src python3 -m unittest discover -s tests -v
```

No packages outside Python's standard library are required.
