# Subagent B: MCP, State, and Artifact Contract Audit

Worktree: `/Users/rhishi/dev/repositories/blueprint-top5-20260504-194251`

Output owner: Subagent B

Date: 2026-05-04

## Executive Summary

Blueprint has a real MCP-centered persistence spine: most project, config, phase, review, report, workspace, update, and impact mutations are routed through registered MCP tools; artifact contracts live in `src/mcp/artifact-contracts/`; model-first plan/summary/validation/review/report paths use JSON Schema plus runtime narrowing; and rejected mutating tool results are centrally logged.

The deterministic-state-engine claim is only partially true today. The strongest gaps are not missing tools, but inconsistent enforcement around the edges: `blueprint_artifact_validate` validates only a subset of managed artifacts, common writes still use direct `fs.writeFile` without atomic replacement and only some state transitions are locked, `STATE.md` is unversioned Markdown with loose string patches, and command/runtime resources still rely on Markdown-table parsing despite docs saying docs are control-plane history rather than runtime inputs.

Overall risk: **medium-high** for long-running or parallel command runs, especially where multiple agents or resumable commands touch `.blueprint/STATE.md`, summaries, validation artifacts, reports, or command routing assumptions.

## Evidence Table

| Finding | Risk | Evidence | Impact |
|---|---:|---|---|
| `blueprint_artifact_validate` does not validate the full `.blueprint/` contract surface. | High | `src/mcp/tools/artifacts.ts:7524-7814` validates bootstrap docs, codebase bundle, `*-RESEARCH.md`, `*-VERIFICATION.md`, `*-UAT.md`, `*-PLAN.md`, and `*-SUMMARY.md`; it does not call `validatePhaseArtifactContent` for `*-CONTEXT.md`, `*-DISCUSSION-LOG.md`, or `*-UI-SPEC.md`, and does not sweep reports/review artifacts. `validatePhaseArtifactContent` exists at `src/mcp/tools/artifacts.ts:4368-4469`. | A command can report artifact validation as clean while important authored artifacts have drifted after persistence. This weakens `/blu-health`, post-write validation, and “MCP owns schema truth” guarantees. |
| Some report write paths are effectively schema-optional. | Medium | `validateReportArtifactContent` returns `valid: true` for unknown report names and `report.pause-work` at `src/mcp/tools/artifacts.ts:5401-5417`; `blueprint_artifact_report_write` accepts any non-empty `content` after that validation path at `src/mcp/tools/artifacts.ts:11586-11643`. Report names are slug-normalized into `.blueprint/reports/<slug>.md` at `src/mcp/tools/artifacts.ts:2029-2045`. | Generic report flexibility may be intentional, but it creates a low-friction bypass around contract-backed report shapes and makes report inventory less deterministic over time. |
| Writes are not consistently atomic or serialized. | High | Shared `writeTextFile` and `writeJsonFile` use direct `fs.writeFile` at `src/mcp/tools/artifacts.ts:2259-2284`. A repo lock exists at `src/mcp/tools/artifacts.ts:2287-2334`, but `rg` shows it is used for roadmap-add-phase and phase-plan-write only (`src/mcp/tools/phase.ts:8166`, `src/mcp/tools/phase.ts:10090`). Summary, validation, checkpoint, state, report, and codebase writes use direct writes without the shared lock (`src/mcp/tools/phase.ts:9761-9773`, `src/mcp/tools/phase.ts:11584-11608`, `src/mcp/tools/state.ts:2222-2251`, `src/mcp/tools/artifacts.ts:11566-11755`). | Concurrent subagents or interrupted writes can lose updates or leave partial files. This directly affects the “deterministic state engine” premise under parallel execution. |
| `STATE.md` is weakly typed and unversioned. | Medium | `BlueprintState` stores status, phase, active command, and next action as plain strings at `src/mcp/tools/state.ts:35-44`. The `blueprint_state_update` input schema accepts arbitrary string fields at `src/mcp/tools/state.ts:291-305`, parses Markdown labels with regex at `src/mcp/tools/state.ts:592-624`, and writes rendered Markdown at `src/mcp/tools/state.ts:566-590` / `src/mcp/tools/state.ts:2196-2234`. `docs/ARTIFACT-SCHEMA.md:113-132` defines locked fields but no schema version for `STATE.md`. | Bad or stale `activeCommand`, `nextAction`, or status strings can persist even when derived routing is stricter elsewhere. There is no artifact-level migration/version marker to distinguish old state from malformed current state. |
| Command runtime resources and catalog still have hidden Markdown dependencies. | Medium | `docs/RUNTIME-REFERENCE.md:52-63` says docs are control-plane history, resources are read-only, and resources must mirror tool truth. Runtime code still parses `docs/COMMAND-CATALOG.md` rows in `src/mcp/tools/project.ts:899-945`; command resources parse command specs and `docs/RUNTIME-REFERENCE.md` rows in `src/mcp/command-resources.ts:126-150` and `src/mcp/command-resources.ts:169-218`. Similar `extractMarkdownSection`/`parseRequiredTools` helpers are duplicated in `project.ts`, `command-resources.ts`, `state.ts`, `phase.ts`, `artifacts.ts`, `workspace.ts`, and `skill-metadata.ts` (`rg` evidence). | A formatting or heading drift in docs can alter runtime projections or resource payloads. The source-owned metadata path reduces this for many implemented commands, but the docs/runtime boundary is still ambiguous. |
| Schema/versioning is uneven across state artifacts. | Medium | `config.json` has hardcoded version `2` and normalization/migration notes (`src/mcp/tools/config.ts:165`, `src/mcp/tools/config.ts:202-276`, `docs/ARTIFACT-SCHEMA.md:141-237`). Structured schemas such as `phase.plan`, `phase.summary`, and `report.add-tests` have `$id` but no embedded payload `schemaVersion`; `report.impact` does require `schemaVersion` (`src/mcp/artifact-contracts/schemas/report.impact.model.schema.json`). Pause handoff has `schemaVersion: 1` in `src/mcp/tools/state.ts:74-98`. Most Markdown artifacts rely on headings and frontmatter rather than explicit artifact schema versions. | Future contract changes will be hard to migrate deterministically because readers cannot always tell whether an artifact is old-but-valid, old-and-needs-migration, or simply malformed. |
| Failure logging is useful but best-effort and coverage is status-list dependent. | Low-Medium | Mutation failures are logged through the server wrapper at `src/mcp/server.ts:486-505`; mutation tools and logged statuses are enumerated at `src/mcp/server.ts:57-94`. The log appends NDJSON best-effort and suppresses logging failures at `src/mcp/write-failure-log.ts:137-158`. Tests cover invalid-result and thrown-exception logging at `tests/mcp-write-failure-logging.test.ts:150-256`. | A tool returning an unlisted failure status will not be logged, and log write failures are invisible. This is acceptable for diagnostics, but not a complete recovery mechanism. |
| Preferred documentation read order has drift. | Low | AGENTS.md asks agents to read `docs/DRIFT.MD`, but `rg --files docs | rg -i 'drift'` found no drift doc in this worktree, and direct `rg ... docs/DRIFT.MD` failed with “No such file or directory.” | This is not an MCP runtime defect, but it is a process drift signal for future auditors. |

## Assessment: Does MCP Act as the Deterministic State Engine?

Partially yes. MCP owns the main write tools, performs path containment, normalizes config, resolves phase/report paths, validates structured models, and centralizes mutation-failure logging. The plan/summary/validation/review/report model paths are the strongest examples of deterministic ownership.

The weaker areas are all state-engine qualities rather than tool-count qualities:

- Deterministic validation is incomplete because global artifact validation skips several managed artifact classes.
- Deterministic persistence is incomplete because many writes are direct, non-atomic, and not covered by the repo lock.
- Deterministic state evolution is incomplete because `STATE.md` is loose Markdown without a schema version and accepts arbitrary string patches.
- Deterministic runtime contracts are incomplete because live catalog/resource payloads still parse docs Markdown in some paths.

## Improvement Recommendations

1. Expand `blueprint_artifact_validate` into a true registry-backed sweep.
   - Iterate `artifactContractIds` and known path inventories.
   - Validate context, discussion-log, UI-spec, review artifacts, report artifacts, workstreams, impact bundles, and capture indexes where contracts exist.
   - Report intentionally unsupported or generic artifacts explicitly as warnings instead of silently accepting them.

2. Make persistence atomic and consistently serialized.
   - Change shared text/json writers to write temp files and `rename`.
   - Use one repo-scoped lock or path-scoped locks for all `.blueprint/` mutating tools that read-modify-write.
   - Keep dedicated transactional flows in workspace/impact where already stronger.

3. Introduce a versioned state artifact contract.
   - Add a `schema_version` or JSON sidecar for `STATE.md`, or move canonical state to structured JSON with Markdown as a rendered view.
   - Constrain `projectStatus`, `activeCommand`, and next-action command tokens against live implemented-command vocabulary.
   - Add migration behavior for old state shapes.

4. Clarify docs/runtime authority.
   - Either make command catalog/resource projection fully runtime-metadata-owned, or document exactly which docs are live runtime inputs.
   - Centralize Markdown parsing helpers if docs parsing remains intentional.
   - Add regression coverage for malformed command-catalog/runtime-reference tables.

5. Tighten report contract boundaries.
   - Require known report names for `blueprint_artifact_report_write`, or return a distinct `generic-report` status/warning when writing unknown names.
   - Validate `report.pause-work` content when routed through the generic report writer, or block pause-work report names outside `blueprint_pause_handoff_write`.

6. Standardize schema-version policy.
   - Embed payload-level `schemaVersion` in all model-authored JSON contracts, not only impact.
   - Record artifact contract versions in rendered Markdown frontmatter for model-rendered artifacts.
   - Add a migration matrix in `docs/ARTIFACT-SCHEMA.md` for config, state, phase, review, report, impact, workstream, and global registry artifacts.

## Commands Run

Read-only inspection commands:

- `cat AGENTS.md`
- `rg --files src/mcp src/shared commands skills docs tests | sort`
- `ls -la docs/to-the-moon`
- `git status --short`
- Multiple `rg -n ...` searches across `src/mcp`, `src/shared`, `docs`, `commands`, `skills`, and `tests`
- Multiple `nl -ba ... | sed -n ...` reads for:
  - `src/mcp/tools/project.ts`
  - `src/mcp/command-resources.ts`
  - `src/mcp/server.ts`
  - `src/mcp/tools/artifacts.ts`
  - `src/mcp/tools/state.ts`
  - `src/mcp/tools/phase.ts`
  - `src/mcp/tools/config.ts`
  - `src/shared/security.ts`
  - `src/mcp/write-failure-log.ts`
  - `src/mcp/artifact-contracts/index.ts`
  - selected JSON schemas under `src/mcp/artifact-contracts/schemas/`
  - `docs/ARTIFACT-SCHEMA.md`
  - `docs/MCP-TOOLS.md`
  - `docs/COMMAND-CATALOG.md`
  - `docs/RUNTIME-REFERENCE.md`
  - `docs/DECISIONS.md`
  - selected tests and existing bug docs

Failures/unavailable:

- `rg -n ... docs/DRIFT.MD ...` failed because `docs/DRIFT.MD` does not exist in this worktree.
- No MCP tools were invoked.
- No tests, builds, installs, or write-capable project/global commands were run because this audit was discovery-only and repo read-only except this report.

