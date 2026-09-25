# Route planner notes

The planner uses Python standard-library APIs only. Keep request validation in
`validation.py`, scoring decisions in `scoring.py`, and JSON translation in
`contracts.py` and `serialization.py`. Tests must run with
`PYTHONDONTWRITEBYTECODE=1` so the source fixture stays free of caches.
