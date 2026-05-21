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
- Gemini CLI exposes an enabled delegated agent as a same-named tool. Do not
  read, inline, or load any separate agent source before delegation.
- Call the same-named `blueprint-doc-writer` Gemini agent tool with a bounded
  documentation task packet only when the active `/blu-docs-update` command
  contract permits it, effective config does not disable `workflow.subagents`,
  the tool is available in the current host session, and the change spans
  multiple sections or files.
- Call the same-named `blueprint-doc-verifier` Gemini agent tool with a bounded
  documentation task packet only when the active `/blu-docs-update` command
  contract permits it, effective config does not disable `workflow.subagents`,
  the tool is available in the current host session, and bounded fact-checking
  of current docs or proposed updates is useful.
- Preserve the inline fallback when optional docs agents are unavailable or the
  scope is too small to justify delegation. The fallback must keep the same
  evidence depth and output quality one doc section or file at a time.
- Do not substitute generic, browser-only, web-search-only, or shell-only
  agents.

## No-Subagent Fallback

When optional docs agents are unavailable, unnecessary, or unsafe, continue
inline and sequentially:

1. Resolve the selected doc scope and the exact evidence set before drafting or
   verification.
2. Read and verify one documentation file or one bounded section at a time
   where the agent path could have isolated drafting or fact-checking.
3. Apply the update or verification decision for that single unit only.
4. After each completed unit, compress compact carry-forward context: file or
   section covered, repo evidence used, external-truth status when applicable,
   changes or findings, and the next unit.
5. Persist the same docs-update report through MCP and keep follow-up routing
   implemented-only.

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
