# Runtime Architecture Hardening Audit

Subagent 1: Runtime Architecture Auditor

Date: 2026-05-04

Scope inspected: `src/mcp/**`, command resources, command/runtime vocabulary, artifact contracts, security helpers, MCP server registration, and representative runtime-contract tests.

## Executive Summary

Blueprint has a substantial MCP-centered runtime, but its deterministic-state-engine boundary is stretched by three architectural patterns:

- Very large domain modules combine path ownership, parsing, rendering, validation, write policy, state inference, and command lifecycle rules.
- Runtime truth is split between typed metadata, live tool registration, Markdown docs, TOML manifests, skill files, and runtime-reference tables.
- Versioning and migration are partial: config/global registries have versions, some model contracts expose descriptor versions, but important project-local Markdown state does not carry an explicit migration envelope.

The highest-return hardening work is to create typed registries and transaction boundaries that make runtime behavior code-owned, versioned, and uniformly observable, while generating docs from those registries instead of parsing docs as runtime input.

## Prioritized Findings

### P1 - Runtime Ownership Is Concentrated In High-Complexity Modules

Evidence:

- `wc -l` showed `src/mcp/tools/phase.ts` at 12,098 lines, `src/mcp/tools/artifacts.ts` at 11,839, `src/mcp/tools/review.ts` at 8,908, `src/mcp/tools/impact.ts` at 8,341, `src/mcp/artifact-contracts/index.ts` at 4,954, and `src/mcp/command-runtime-metadata.ts` at 3,004.
- `src/mcp/tools/artifacts.ts:41-96` defines core paths and supported artifacts, while the same file also owns shared writers (`src/mcp/tools/artifacts.ts:2215-2285`), lock helpers (`src/mcp/tools/artifacts.ts:2287-2334`), Markdown parsers (`src/mcp/tools/artifacts.ts:2336-2455`), contract validation (`src/mcp/tools/artifacts.ts:3524-6345`), artifact inventory (`src/mcp/tools/artifacts.ts:6393-6465`), and report writes (`src/mcp/tools/artifacts.ts:11460-11644`).
- `src/mcp/tools/phase.ts:10082-10370` shows a single plan-write path doing phase resolution, plan-id allocation, model rendering, prompt-boundary preparation, Markdown validation, dependency validation, prospective set validation, overwrite handling, and persistence.

Risk:

These files are not merely long; they are state-lifecycle multiplexers. A new lifecycle rule can be implemented in one path while adjacent paths keep older parsing, locking, status, or validation behavior. That makes deterministic state harder to reason about and review.

Recommended hardening:

- Split by invariant rather than command family: path registry, artifact inventory, Markdown parsing, artifact validation, model rendering, transaction/write policy, and lifecycle routing.
- Move repeated write return shapes into small shared result builders.
- Require new tools to compose registry services instead of reaching directly into filesystem parsing/rendering helpers.

### P1 - Command Runtime Truth Is Split Across Code And Markdown

Evidence:

- `src/mcp/tools/project.ts:899-945` reads `docs/COMMAND-CATALOG.md`, parses Markdown table rows, and derives the live command catalog unless it falls back to runtime-owned metadata.
- `src/mcp/tools/project.ts:580-593` parses required tools from command specs via Markdown sections; `src/mcp/command-resources.ts:77-150` has a separate Markdown-section/spec parser for the runtime resource.
- `src/mcp/command-resources.ts:253-267` reads and parses `docs/RUNTIME-REFERENCE.md`, then overlays runtime-owned metadata.
- `src/mcp/command-runtime-metadata.ts:49-90`, `src/mcp/command-runtime-metadata.ts:632-708`, and `src/mcp/command-runtime-metadata.ts:2918-2976` define a second code-owned metadata source for many commands.
- `rg` found duplicated Markdown parsing helpers in `src/mcp/skill-metadata.ts`, `src/mcp/command-resources.ts`, `src/mcp/tools/project.ts`, `src/mcp/tools/phase.ts`, `src/mcp/tools/state.ts`, `src/mcp/tools/workspace.ts`, and `src/mcp/tools/artifacts.ts`.

Risk:

A doc table formatting change, heading rename, or spec layout drift can affect runtime projections. The fallback/overlay model is useful during migration, but it creates hidden authority rules: some commands are source-owned, some are doc-parsed, and resources merge both.

Recommended hardening:

- Make a typed command catalog registry the single runtime source of truth.
- Generate `docs/COMMAND-CATALOG.md`, command runtime resources, and runtime-reference docs from the registry.
- If Markdown parsing must remain for compatibility, isolate it behind one parser package with fixture tests for malformed tables/headings and explicit deprecation notes.

### P1 - Persistence Is Not Uniformly Transactional Or Serialized

Evidence:

- Shared writers use direct writes: `writeJsonFile` calls `fs.writeFile` at `src/mcp/tools/artifacts.ts:2259-2265`; `writeTextFile` calls `fs.writeFile` at `src/mcp/tools/artifacts.ts:2267-2285`.
- A repo lock exists at `src/mcp/tools/artifacts.ts:2287-2334`, but `rg` found it used only for `roadmap-add-phase` and `phase-plan-write` (`src/mcp/tools/phase.ts:8166`, `src/mcp/tools/phase.ts:10090`).
- `blueprint_state_update` and `blueprint_state_sync` read, derive, and write `STATE.md` without the shared lock at `src/mcp/tools/state.ts:2196-2251`.
- `rg` showed many `.blueprint/` writes through direct shared writers across phase, artifact, review, config, state, and workspace modules, while workspace/update/impact have some bespoke temp-file-plus-rename paths.

Risk:

Parallel agents, interrupted processes, or overlapping commands can lose updates or leave partial files. This is especially risky for `STATE.md`, report overwrites, checkpoint JSON, summary writes, and roadmap/report flows that do read-modify-write.

Recommended hardening:

- Make shared text/json writers atomic via temp file plus rename.
- Require path-scoped or repo-scoped locks for every read-modify-write mutation under `.blueprint/`.
- Add lock coverage tests that simulate two concurrent writes to state, summaries, reports, and indexes.

### P1 - Schema Versioning And Migration Are Uneven

Evidence:

- Config has a hard-coded version and version handling (`src/mcp/tools/config.ts:22-95`, `src/mcp/tools/config.ts:202-260`, `src/mcp/tools/config.ts:404-413`), and docs mention config migration to version 2 (`docs/ARTIFACT-SCHEMA.md:236`).
- `STATE.md` is rendered as plain Markdown with no schema marker (`src/mcp/tools/state.ts:566-590`) and parsed by label regexes (`src/mcp/tools/state.ts:592-624`).
- `BlueprintState` fields such as `projectStatus`, `activeCommand`, and `nextAction` are plain strings (`src/mcp/tools/state.ts:35-44`).
- Artifact contract descriptors expose `modelContract.schemaVersion` (`src/mcp/artifact-contracts/index.ts:11-21`, `src/mcp/artifact-contracts/index.ts:4794-4805`), but most rendered Markdown artifacts do not embed a durable artifact schema version. Impact is stronger: docs require `schemaVersion: blueprint.impact.report.v1` (`docs/ARTIFACT-SCHEMA.md:886`), and `src/mcp/tools/impact.ts` validates impact schema versions.
- Pause handoff has `schemaVersion: 1` in a TypeScript record (`src/mcp/tools/state.ts:74-98`), but it is still rendered/read as Markdown.

Risk:

Future contract changes will be difficult to distinguish from malformed current artifacts. Readers cannot always tell whether an artifact is old-but-migratable, current-but-invalid, or authored outside the MCP contract.

Recommended hardening:

- Define a project-local artifact version registry covering config, state, roadmap, phase artifacts, reviews, reports, impact bundles, checkpoints, workstreams, and global registries.
- Add explicit `schema_version` frontmatter or a structured JSON sidecar for Markdown-owned artifacts.
- Create a migration runner with read-only assessment and explicit write mode; surface migration status from `blueprint_project_status` and `blueprint_artifact_validate`.

### P2 - Error Boundaries Depend On Manual Tool And Status Lists

Evidence:

- The MCP server manually lists mutation tools in `BLUEPRINT_MUTATION_TOOL_NAMES` (`src/mcp/server.ts:57-86`) and failure statuses in `MUTATION_FAILURE_STATUSES` (`src/mcp/server.ts:87-94`).
- `executeToolHandlerWithFailureLogging` logs rejected mutation results and thrown mutation errors centrally (`src/mcp/server.ts:486-505`).
- Failure-log append is best-effort and suppresses logging failures (`src/mcp/write-failure-log.ts:137-158`).
- Tests cover rejected and thrown mutation logging (`tests/mcp-write-failure-logging.test.ts:150-220`).

Risk:

A new mutating tool can be registered without being added to the mutation set, or can return a new failure status that is not logged. Because log-write failure is swallowed, operators may not know that diagnostics were dropped.

Recommended hardening:

- Add `kind: "read" | "mutation"` and normalized result status metadata to each tool definition.
- Derive mutation logging from tool metadata rather than a separate server-side name list.
- Standardize an error/result envelope so invalid, blocked, rejected, and thrown paths are observable consistently.
- Return a warning when failure logging itself cannot persist, while still avoiding recursive write failure loops.

### P2 - Markdown Parsing Is A Weak Shared Abstraction

Evidence:

- `src/mcp/tools/artifacts.ts:2336-2455` implements heading, table, frontmatter, and inline-array parsing manually.
- `src/mcp/tools/review.ts` has its own Markdown section/table extraction functions (`src/mcp/tools/review.ts:2222`, `src/mcp/tools/review.ts:3353`, `src/mcp/tools/review.ts:3425`, `src/mcp/tools/review.ts:3559`).
- `src/mcp/tools/state.ts:566-624` renders/parses state Markdown by exact labels.
- `src/mcp/command-resources.ts:77-150` and `src/mcp/tools/project.ts:580-593` duplicate command-spec parsing logic.

Risk:

Small formatting differences can change runtime interpretation. Because parsers differ by module, one artifact can be considered valid or routable in one path and invalid or invisible in another.

Recommended hardening:

- Centralize Markdown parsing helpers and use one frontmatter/table parser contract everywhere.
- Prefer structured models as the canonical write path, with Markdown as a rendered projection.
- Add golden tests that feed the same artifact through every consumer that reads it.

### P2 - Generic Report Writes Create A Contract Bypass

Evidence:

- `validateReportArtifactContent` returns valid for unknown report names and for `report.pause-work` (`src/mcp/tools/artifacts.ts:5401-5417`).
- `blueprint_artifact_report_write` accepts arbitrary non-empty `content` for the content path after that validation (`src/mcp/tools/artifacts.ts:11586-11643`).
- Structured model writes are limited to selected known reports (`src/mcp/tools/artifacts.ts:11490-11503`), so the generic content path remains broader than the model-contract path.

Risk:

This may be intentional for flexible reports, but it weakens the claim that durable reports are contract-backed MCP artifacts. Unknown or misnamed reports can accumulate with no schema boundary.

Recommended hardening:

- Require known report contracts by default, or return an explicit `generic-report` status/warning with a separate inventory class.
- Block reserved names such as pause-work from the generic report writer if a dedicated tool owns them.
- Add a report-name registry with ownership and validation policy.

### P2 - Runtime Vocabulary Still Encodes Migration Compatibility Without A Sunset Model

Evidence:

- `resolveBlueprintSkillPath` prefers bundled skill directories but falls back to legacy flat skill files (`src/mcp/runtime-vocabulary.ts:33-65`).
- Tests explicitly preserve the legacy fallback during migration (`tests/runtime-vocabulary.test.ts:45-52`).

Risk:

Compatibility behavior is reasonable, but without a versioned deprecation/migration model it can become permanent ambient complexity. Runtime catalog status depends on whether either layout exists, not on a declared migration phase.

Recommended hardening:

- Add a documented runtime compatibility matrix for skill layouts and command metadata sources.
- Emit catalog warnings for legacy skill resolution.
- Define a version or release where fallback can be removed.

## Cross-Cutting Hardening Plan

1. Establish typed runtime registries.
   - Command registry: commands, statuses, manifests, primary skills, required tools, risk, router exposure, runtime-resource facts.
   - Artifact registry: artifact ids, path patterns, owner tools, schema versions, validators, renderers, migration handlers.
   - Tool registry: read/mutation kind, failure statuses, lock policy, state roots touched.

2. Make docs generated projections.
   - Generate command catalog and runtime reference from the typed registry.
   - Keep docs as reviewable control-plane output, not runtime input.
   - Retain Markdown parsers only as migration readers.

3. Add a versioned migration substrate.
   - Read-only `assess_migrations`.
   - Explicit `apply_migrations`.
   - Per-artifact version markers and migration records.
   - Project status exposes `migration: current | needed | unsupported`.

4. Standardize transactions.
   - Atomic shared writers.
   - Lock policy declared per mutating tool.
   - Rollback/backup behavior for multi-file operations.
   - Tests for concurrent mutation and crash-interrupted temp files.

5. Normalize error/result envelopes.
   - One structured result shape for invalid, blocked, not found, rejected, reused, updated, created.
   - Tool definitions declare mutation/logging policy.
   - Failure logging becomes registry-driven and reports logging failures as warnings.

## Notes On Uncertainty

- Some generic report behavior may be intentional product flexibility; the risk is architectural ambiguity, not proof of a current user-facing bug.
- Legacy skill fallback appears intentionally tested as a migration bridge; the hardening recommendation is to make the migration phase explicit.
- I did not run tests or mutate runtime state; this is a static architecture audit plus read-only command inspection.

## Read-Only Commands Used

- `git status --short`
- `rg --files src/mcp src/shared src/hooks commands docs tests`
- `wc -l src/mcp/server.ts src/mcp/command-resources.ts src/mcp/runtime-vocabulary.ts src/mcp/runtime-host.ts src/mcp/skill-metadata.ts src/mcp/command-runtime-metadata.ts src/mcp/write-failure-log.ts src/mcp/command-paths.ts src/shared/security.ts src/mcp/tools/*.ts src/mcp/artifact-contracts/index.ts`
- Multiple `rg -n` inspections for schema/version, Markdown parsing, command catalog/runtime-resource coupling, lock/write usage, and failure logging.
- Multiple `nl -ba ... | sed -n ...` reads of the files cited above.
