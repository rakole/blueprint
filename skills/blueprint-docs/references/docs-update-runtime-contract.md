# Docs Update Runtime Contract

`/blu-docs-update` refreshes or verifies selected repo documentation from
current repo evidence, saved Blueprint artifacts, and explicitly requested or
necessary current external truth. It is a long-running mutation command, but the
write scope is intentionally narrow.

## Scope Resolution

- Read `blueprint_project_status` first and stop on uninitialized or unhealthy
  Blueprint state.
- Read `blueprint_artifact_list` before deciding whether saved evidence is
  sufficient for the requested documentation pass.
- Resolve the documentation scope before drafting or verification. Prefer files
  named by the user. When no scope is named, default to a narrow README-first
  pass plus closely related top-level documentation.
- Treat broad repo-wide or multi-directory documentation refreshes as
  confirmation-gated unless the user already approved that breadth or passed
  `--force`.
- If a broad refresh lacks the saved codebase mapping bundle, stop and route to
  `/blu-map-codebase` so the docs pass stays evidence-backed.

## Evidence Truth

- Treat selected repo documentation, source files, tests, saved Blueprint
  artifacts, and digest `inputsUsed` as repo truth.
- Use `blueprint_artifact_summary_digest` with explicit repo-relative
  `artifactPaths`, `docFiles`, `sourceFiles`, and `testFiles`; never rely on
  chat memory as the evidence list.
- Treat returned `inputsUsed` as the authoritative digest scope for the report
  and completion summary.
- Use external web verification only when the user explicitly requested it or a
  claim depends on current external API, library, product, or standards facts
  that repo truth cannot settle.
- Keep cited external truth separate from repo truth in the report and user
  summary. If external verification was requested but unavailable, continue
  from repo truth and say what was skipped.

## Execution Modes

- In update mode, edit only the selected documentation files.
- In `--verify-only` mode, keep repo documentation read-only. The command may
  still write the durable `.blueprint/reports/docs-update-latest.md` report
  through MCP.
- Use `blueprint-doc-writer` only for bounded drafting when the change spans
  multiple sections or files.
- Use `blueprint-doc-verifier` only for bounded fact-checking of current docs
  or proposed updates.
- Preserve the inline fallback when optional docs agents are unavailable; do
  not substitute generic, browser-only, web-search-only, or shell-only agents.

## Confirmation Gates

- Pending gates are limited to `broad-scope confirmation`, `doc overwrite
  confirmation`, `report overwrite confirmation`, or `none`.
- Require doc overwrite confirmation before replacing heavily edited selected
  documentation unless the user explicitly approved replacement or passed
  `--force`.
- Require report overwrite confirmation before replacing the canonical latest
  report unless the user approved replacement or passed `--force`.
- Treat `--force` only as approval for the resolved docs-update scope, not as
  permission to widen into code, tests, git, or unrelated project state.

## Persistence Boundaries

- Blueprint-owned persistence goes only through MCP tools.
- Use `blueprint_artifact_report_write` with the bare `reportName`
  `docs-update-latest`; do not pass a report path.
- Treat the returned report `path`, `status`, and write metadata as
  authoritative.
- Keep Blueprint-owned writes inside `.blueprint/reports/`.
- Do not mutate `.blueprint/` directly, edit code or tests, or start git flows
  from this command.

## Progress And Routing

- Keep `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and
  `Route` visible for non-trivial runs.
- Track resolved scope, active stage, pending gate, execution mode,
  verify-only versus update mode, inline versus docs-agent execution, repo-doc
  mutation status, report status, evidence posture, and next safe action.
- Use host progress helpers only for session visibility; they are not durable
  Blueprint state.
- Route follow-ups only to implemented Blueprint commands. Prefer
  `/blu-map-codebase` for evidence-light broad refresh requests and
  `/blu-progress` when no narrower implemented follow-up is clearly safer.
