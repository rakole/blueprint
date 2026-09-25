# Portable map evaluation fixture

`development/project` is a small, checked-in source and map graph for the
deterministic evaluator in `scripts/portable-map-evaluation.mjs`. It is a
development fixture only. It does not represent held-out tasks, hosted-agent
quality, token savings, or a production consumer runtime.

The runner compares ordinary lexical discovery, seven compatibility views,
structural records/search, and semantic portable-map records at 4, 8, and
12 KiB visible-text budgets. Route actions are selected from task text and
live files. Required, supporting, alternative, stale, and negative evidence
is applied only by the post-route scorer, so changing gold cannot change the
recorded actions.

Each arm uses the same deterministic candidate policy: lowercase query tokens
are matched against the returned page or record, candidates are ranked by exact
path match and token-hit count, then tied by path and symbol. The lexical and
map readers may scan repository or map bytes in the backend; those bytes are
reported as `backendScanBytes` and do not spend the visible budget. Every
delivered map page, search output line and source byte does spend that budget,
including the seven compatibility views. Semantic aliases follow their sealed
target records and ordered continuation fragments, while structural navigation
does not consume semantic records.
