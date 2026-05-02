---
id: BPBUG-002
title: Cleanup lacks behavioral regression coverage for protected-scope archival
severity: medium
confidence: confirmed
surface: tests
status: new
discovery_phase: 6
reported: 2026-05-02
---

# BPBUG-002: Cleanup lacks behavioral regression coverage for protected-scope archival

## Classification

- Severity: `medium`
- Confidence: `confirmed`
- Surface: `tests`
- Status: `new`

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
