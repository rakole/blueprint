---
id: BPBUG-002
title: Cleanup lacks behavioral regression coverage for protected-scope archival
severity: medium
confidence: confirmed
surface: tests
status: fixed
discovery_phase: 6
reported: 2026-05-02
---

# BPBUG-002: Cleanup lacks behavioral regression coverage for protected-scope archival

## Classification

- Severity: `medium`
- Confidence: `confirmed`
- Surface: `tests`
- Status: `fixed`

## Summary

Blueprint's `/blu-cleanup` command is documented and routed as an implemented high-risk maintenance command that can move or delete phase directories after report persistence and protected-scope checks, but the repo only ships metadata assertions for that surface. There is no dedicated cleanup behavioral regression that exercises current-phase protection, active-roadmap exclusions, report-before-mutate ordering, overwrite gating, or partial-failure handling.

## Expected Behavior

An implemented high-risk cleanup command should have executable regression coverage that proves it will not archive the current phase, active-roadmap directories, or evidence-incomplete directories, and that it persists `cleanup-latest` before any filesystem mutation while preserving the report when later archive work fails.

## Actual Behavior

The command contract in `commands/blu-cleanup.toml` and `docs/commands/cleanup.md` requires protected exclusions, report-before-mutate behavior, and destructive confirmation gates, but the only cleanup-specific test file in the repo is `tests/cleanup-metadata.test.ts`, which checks strings in docs and manifests. No cleanup behavioral test file exists under `tests/`, and the current focused cleanup test command exercises only those metadata assertions.

## Impact

Cleanup is a destructive maintenance surface. Without behavioral regression coverage, changes to the cleanup prompt contract, archive-scope derivation, or report sequencing can regress protected-scope safety without being caught by the test suite. That makes current-phase or active-roadmap archival mistakes more likely to reach users unnoticed.

## Affected Files

- `commands/blu-cleanup.toml`
- `docs/commands/cleanup.md`
- `tests/cleanup-metadata.test.ts`
- `tests/maintenance-regression.test.ts`
- `tests/command-contract-docs.test.ts`

## Evidence

| Source | Evidence | Why It Matters |
|--------|----------|----------------|
| `commands/blu-cleanup.toml:10-19` | The manifest requires reading project and roadmap state first, deriving protected exclusions, persisting `cleanup-latest` before mutation, then running only the approved filesystem operations. | This is the high-risk command behavior that should be protected by executable regression coverage. |
| `commands/blu-cleanup.toml:27-33` | The response requirements forbid moving or deleting phase directories without explicit confirmation and require protected exclusions and report persistence before mutation. | The destructive safety guarantees are explicit and concrete, not optional guidance. |
| `docs/commands/cleanup.md:19-20` | The command is described as a confirmation-gated, evidence-backed archival flow that persists a durable cleanup report before filesystem mutation. | The user-facing contract promises report-before-mutate behavior. |
| `docs/commands/cleanup.md:124-129` | The risk notes say cleanup should never silently remove active or unverified material and should keep the report-before-mutate posture explicit. | The docs frame cleanup as a protected-scope destructive flow. |
| `docs/commands/cleanup.md:153-156` | Failure handling says cleanup must preserve the written cleanup report when filesystem archiving partially fails after report creation. | Partial-failure preservation is part of the shipped contract. |
| `tests/cleanup-metadata.test.ts:8-143` | The cleanup-specific tests only assert manifest/doc/runtime-reference strings and shipped status. They do not create candidate phase directories, simulate active-roadmap exclusions, or verify report-before-mutate ordering. | Existing cleanup-focused coverage is metadata-only. |
| `tests/maintenance-regression.test.ts:84-89` | The broader maintenance regression coverage for cleanup is also regex-based prompt-contract checking. | The shared maintenance suite does not provide behavioral safety coverage either. |
| `rg --files tests \| sort \| rg 'cleanup'` | The only cleanup-specific test file returned is `tests/cleanup-metadata.test.ts`. | Confirms there is no dedicated cleanup behavioral regression file in the repo. |
| `npx tsx --test tests/cleanup-metadata.test.ts` | The focused cleanup suite passes with 4 metadata tests and no behavioral filesystem exercise. | Confirms the current green test signal does not cover destructive cleanup behavior. |

## Verification Steps

1. Inspect `commands/blu-cleanup.toml:10-19` and `commands/blu-cleanup.toml:27-33`; confirm the command contract requires protected exclusions, report-before-mutate ordering, and explicit destructive confirmation.
2. Inspect `docs/commands/cleanup.md:19-20`, `docs/commands/cleanup.md:124-129`, and `docs/commands/cleanup.md:153-156`; confirm the user-facing cleanup docs promise active-phase protection and cleanup-report preservation on partial failure.
3. Inspect `tests/cleanup-metadata.test.ts:8-143`; observe that the file only matches strings in docs, manifests, and runtime references.
4. Run `rg --files tests | sort | rg 'cleanup'`; observe that the repo returns only `tests/cleanup-metadata.test.ts`.
5. Run `npx tsx --test tests/cleanup-metadata.test.ts`; observe that the suite passes even though it never simulates cleanup scope selection, report persistence ordering, or partial archive failure.

## Likely Cause

Cleanup was marked implemented through manifest, skill, and required MCP substrate availability, but no cleanup-specific behavioral harness was added for the destructive orchestration path. The repo currently relies on metadata and contract-string assertions for a command whose highest-risk guarantees live in sequencing and scope derivation.

## Suggested Fix Direction

Add a dedicated cleanup behavioral regression suite that exercises at least:

- protected exclusion of the current phase and active-roadmap directories
- blocking when closeout evidence is incomplete
- report creation or overwrite confirmation before any archive mutation
- preservation of `cleanup-latest` when archive work fails after report persistence

If the current architecture keeps cleanup as prompt orchestration over generic MCP tools, add a command-level harness or fixture-based integration test that proves the ordering and safety guarantees instead of only asserting prompt text.

## Uncertainty

None known. The coverage gap is confirmed by command/doc inspection, cleanup-specific test inspection, and the absence of any cleanup behavioral test file under `tests/`.

## Related Bugs

- Root-cause cluster: `missing regression guards`. This bug remains the anchor for the destructive-orchestration regression-gap cluster; no duplicate or same-repair-path peer is currently known.

## No Fix Applied

No source, manifest, skill, test, generated asset, or runtime behavior fix was applied during this discovery milestone.

## Repair Outcome - 2026-05-03

Status: `fixed`.

Repair commits:

- `e034e40` locked cleanup destructive confirmation guidance to Gemini-native `ask_user` gates without changing the Blueprint MCP tool surface.
- `e7b7918` added the initial cleanup behavior regression suite.
- `571f591` hardened the behavior fixture to use completed historical milestones outside the active roadmap, bind tested invariants to live manifest/skill text, and exercise true partial archive failure.

Verification:

- `npm run typecheck` - pass.
- `npx tsx --test tests/cleanup-behavior.test.ts tests/cleanup-tools.test.ts tests/cleanup-metadata.test.ts tests/maintenance-regression.test.ts tests/command-contract-docs.test.ts tests/command-catalog.test.ts` - pass, `109/109`.
- `npm test` - pass, `845/845`.

Residual note:

- Cleanup remains prompt-orchestrated rather than a dedicated cleanup executor MCP tool. The repair adds executable fixture coverage for the intended invariants and contract assertions against the live manifest/skill, but it does not introduce a new runtime cleanup tool.

## Repair Plan - 2026-05-03

### Scope Read

The plan inspected the cleanup bug report and confirmed BPBUG-002 asks for executable coverage of protected exclusions, report-before-mutate ordering, overwrite gating, and partial failure preservation.

Key local contract areas inspected:

- `commands/blu-cleanup.toml`: project/roadmap/artifact reads, protected exclusions, report write before filesystem mutation, declared writes, and hard safety requirements.
- `docs/commands/cleanup.md`: user-facing report-before-mutate promise, active-scope protection, and partial-failure report preservation.
- `skills/blueprint-maintenance/SKILL.md`: cleanup orchestration contract.
- `docs/MCP-TOOLS.md`: cleanup required MCP substrate.
- `docs/RUNTIME-REFERENCE.md`: cleanup runtime row.
- `src/mcp/artifact-contracts/index.ts`: cleanup report template and `report.cleanup` contract.
- `src/mcp/tools/artifacts.ts`: report write overwrite behavior.
- `tests/cleanup-metadata.test.ts`, `tests/maintenance-regression.test.ts`, and `tests/command-contract-docs.test.ts`: cleanup assertions are metadata-oriented.
- `tests/cleanup-tools.test.ts`: covers report write and digest mechanics, but not protected-scope archival behavior.

### Official Gemini CLI Research

- Google Gemini CLI overview describes the CLI using built-in tools and MCP servers in a ReAct loop, which matches Blueprint's command-plus-MCP model: <https://developers.google.com/gemini-code-assist/docs/gemini-cli>.
- Gemini CLI extension docs describe extension packaging for prompts, MCP servers, custom commands, skills, hooks, and agents; extension commands come from TOML files under `commands/`: <https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/index.md> and <https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md>.
- Custom command docs say TOML commands require `prompt`, optionally `description`, and `/commands reload` picks up changed TOML files without restart: <https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md> and <https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/commands.md>.
- The Gemini CLI tools reference documents `ask_user` as the interaction tool for clarification/confirmation. `write_todos` and `update_topic` are not needed for this compact cleanup fix: <https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/tools.md>.
- Policy docs confirm `ask_user` is the confirmation decision for tool execution, which supports making cleanup's destructive gates explicitly `ask_user`-backed where prompts/docs are touched: <https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/policy-engine.md>.

Research impact: no new Gemini extension mechanism is needed. Keep Blueprint MCP tool list unchanged. If touching cleanup prompt/docs, add `ask_user` only at confirmation gates, not as a Blueprint MCP required tool.

### Minimal Implementation Plan

Do not add a new `blueprint_cleanup_*` MCP tool. The narrowest fix is a dedicated fixture-based behavioral suite that uses existing live MCP tools plus real temp-directory filesystem moves. Add a small prompt/doc polish only to make the destructive confirmation tool explicit.

Required file changes:

- `commands/blu-cleanup.toml`: in flow steps 7-8, say destructive cleanup, archive destination creation, and report overwrite confirmations should use Gemini-native `ask_user` when available; if unavailable, stop with the named pending gate. Keep the allowed Blueprint MCP tools list unchanged.
- `docs/commands/cleanup.md`: under confirmation gates, mirror the `ask_user` rule and clarify it is a Gemini CLI interaction tool, not a Blueprint MCP persistence tool.
- `skills/blueprint-maintenance/SKILL.md`: cleanup step 8 should mirror the `ask_user` confirmation rule.
- `tests/cleanup-metadata.test.ts`: assert manifest/docs/skill mention `ask_user` for cleanup confirmations.
- `tests/maintenance-regression.test.ts`: add one cleanup assertion that the maintenance manifest/skill keep `ask_user` confirmation explicit.
- `tests/command-contract-docs.test.ts`: add one cleanup docs assertion for `ask_user`.
- New `tests/cleanup-behavior.test.ts`: add behavioral coverage.

### Behavior Test Design

- Fixture repo with `.blueprint/PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `config.json`, `.git` placeholder, `.blueprint/phases/*`, `.blueprint/reports/*`, and an existing `.blueprint/archive/v1/`.
- Roadmap references active phases `03-active-roadmap` and `04-current-maintenance`; state current phase is `4`.
- Historical `01-completed-milestone` has phase summary plus milestone summary evidence and is eligible.
- Historical `02-missing-closeout` lacks milestone closeout evidence and must remain protected.
- Test harness calls real `blueprintProjectStatus`, `blueprintRoadmapRead`, `blueprintArtifactList`, `blueprintArtifactSummaryDigest`, and `blueprintArtifactReportWrite`; filesystem archive uses `rename` or copy-then-delete in temp dirs only.
- Record an event log so tests assert `report:write` occurs before any `fs:*` event.

Behavior tests to add:

- Archives only the evidence-backed historical phase; leaves current, active-roadmap, and evidence-incomplete phase directories in place; writes `cleanup-latest` first.
- Existing `cleanup-latest` plus `overwrite: false` blocks before any filesystem mutation and preserves the old report.
- Archive destination missing plus no destination approval blocks before report write and mutation.
- Filesystem failure after report persistence preserves `cleanup-latest` and leaves the original selected phase directory intact.

### Parallel Waves

- Wave 1, prompt/docs confirmation clarity: `commands/blu-cleanup.toml`, `docs/commands/cleanup.md`, `skills/blueprint-maintenance/SKILL.md`, `tests/cleanup-metadata.test.ts`, `tests/maintenance-regression.test.ts`, and `tests/command-contract-docs.test.ts`. Only add `ask_user` confirmation wording; do not alter required MCP tools, command status, catalog semantics, or archive schema.
- Wave 2, behavioral regression: new `tests/cleanup-behavior.test.ts`. Keep helpers test-local; use real MCP functions for state/report/digest and real filesystem operations in temp dirs. Do not mutate repo `.blueprint/` or global `~/.gemini/blueprint/`.
- Wave 3, verification: run `npm run typecheck`, `npx tsx --test tests/cleanup-behavior.test.ts tests/cleanup-tools.test.ts tests/cleanup-metadata.test.ts tests/maintenance-regression.test.ts tests/command-contract-docs.test.ts tests/command-catalog.test.ts`, and full `npm test` if time permits.

### DoD Reviewer Checklist

- New test fails meaningfully if current phase or active-roadmap directories are selected.
- New test fails if `cleanup-latest` is written after filesystem mutation.
- New test fails if overwrite rejection still mutates files.
- New test fails if post-report archive failure deletes originals or removes the report.
- Cleanup prompt/docs mention `ask_user` only at confirmation gates.
- Required MCP tool list remains exactly the existing six cleanup tools.
- No new cleanup MCP tool, command catalog status change, `.planning/` runtime ownership, or global state mutation is introduced.

### Risks / Uncertainty

`/blu-cleanup` is prompt-orchestrated, so fixture tests cannot prove every live model run will follow the prompt. A dedicated MCP cleanup executor would reduce that risk further, but it would expand the runtime surface and is not minimal for BPBUG-002. The proposed suite still closes the concrete regression gap by exercising the real MCP report/digest/overwrite substrate and real filesystem mutation ordering in a controlled fixture.

## Review Reports - 2026-05-03

### DoD Reviewer Report

Verdict: `PASS`.

Findings:

- `BLOCKER`: none.
- `HIGH`: none.
- `MEDIUM`: none.
- `LOW`: none.

Evidence checked:

- The new behavior regression asserts only `.blueprint/phases/01-completed-milestone` is archived and protected directories remain in place.
- The event log enforces `report:write` before any `fs:*` event.
- With `overwriteReport: false`, the behavior run blocks, preserves prior report content, emits no `fs:*` events, and performs no archive.
- Simulated filesystem failure after report persistence keeps `.blueprint/reports/cleanup-latest.md` and leaves the original phase directory intact.
- `ask_user` wording is constrained to cleanup confirmation, archive destination, and report overwrite gates.
- The cleanup Blueprint MCP tool list remains the existing six tools and does not include `ask_user`.
- The diff did not add a cleanup MCP tool, change command-catalog status, introduce `.planning/` runtime ownership, or mutate global state.

Tests run:

- `npm run typecheck` - pass.
- `npx tsx --test tests/cleanup-behavior.test.ts tests/cleanup-tools.test.ts tests/cleanup-metadata.test.ts tests/maintenance-regression.test.ts tests/command-contract-docs.test.ts tests/command-catalog.test.ts` - pass, `109` tests.

### Code Reviewer Report

Findings:

- `HIGH`: `tests/cleanup-behavior.test.ts` builds its own `runCleanupBehavior` orchestrator that decides protected scope, writes `cleanup-latest`, and performs `fs.rename` itself. The test can pass even if the actual `/blu-cleanup` command prompt or `blueprint-maintenance` skill drifts on ordering, gates, or scope selection, because it only invokes a few MCP helpers directly. Recommended fix: bind the behavior harness to the real command/skill contract as much as possible, so the test fails if manifest/skill guidance drifts away from the tested safety invariants.
- `MEDIUM`: The partial-failure case injects an `fsArchiveOperation` that always throws and the fixture selects only one phase directory, so it covers total failure after report write rather than a true partial archive where one move succeeds and a later move fails. Recommended fix: add a second evidence-backed candidate, fail on the second move/copy, and assert report preservation plus correct moved/untouched directory state.
- `LOW`: Some `ask_user` doc/contract assertions are wording-brittle and may fail on harmless editorial rewrites. This is not part of the required high/medium remediation pass.

Tests run:

- `npm run build --silent` - pass.
- `npx tsx --test tests/cleanup-behavior.test.ts` - pass.
- `npx tsx --test tests/cleanup-metadata.test.ts tests/maintenance-regression.test.ts tests/command-contract-docs.test.ts` - pass.

Residual risk:

- Because cleanup is prompt-driven rather than a single callable cleanup MCP executor, behavioral tests can improve coverage of intended invariants but cannot fully prove every live model run will follow the prompt.

### Bug Finder Report

Findings:

- `HIGH`: The new behavior happy path validates archiving from the still-active milestone. The fixture marks `v1` as active in roadmap and state, excludes only incomplete entries and current phase, and expects Phase 1 to archive. The command contract says cleanup should only archive directories from completed milestones and never archive the active milestone or phases still referenced by the active roadmap. Recommended fix: remodel the fixture with at least one completed prior milestone and one active milestone, and derive eligibility from completed milestone plus no active-roadmap reference rather than only `[x]` status.
- `MEDIUM`: Partial-failure coverage never exercises an actual partial archive because only one archival candidate is selected and the failure hook throws before any directory is moved. Recommended fix: add a second evidence-backed candidate and fail on the second move/copy, then assert the report survives, the already-moved directory is accounted for, and untouched directories remain in place.
- `LOW`: The fixture evidence model is narrower than the cleanup contract because it looks for `milestone-summary-*` reports containing a literal safe-to-archive phrase while the command allows milestone completion or summary reports and latest audit evidence when useful. This is not part of the required high/medium remediation pass.

Tests run:

- `npx tsx --test tests/cleanup-behavior.test.ts` - pass.
- `npx tsx --test tests/cleanup-metadata.test.ts` - pass.
- `npx tsx --test tests/maintenance-regression.test.ts` - pass.
- `node --test --test-name-pattern="cleanup" --import tsx tests/command-contract-docs.test.ts` - pass.
