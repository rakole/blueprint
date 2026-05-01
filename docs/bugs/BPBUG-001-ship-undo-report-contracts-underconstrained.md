---
id: BPBUG-001
title: Ship and undo report contracts accept under-specified high-risk evidence
severity: medium
confidence: confirmed
surface: MCP tool
status: new
discovery_phase: 5
reported: 2026-05-01
---

# BPBUG-001: Ship and undo report contracts accept under-specified high-risk evidence

## Summary

Blueprint's `/blu-ship` and `/blu-undo` command manifests require durable reports to record high-risk shipping and revert evidence, but the canonical `report.ship` and `report.undo` contracts only require broad headings. Minimal reports without saved evidence, source/base branch detail, exact push/PR/revert commands, `gh` fallback notes, digest inputs, branch state, or pending approved commands validate successfully.

## Expected Behavior

The `ship-latest` report contract should require selected scope, saved evidence, source/base branches, requested push and PR actions, actual outcome, `gh` fallback notes, and a manual checklist. The `undo-latest` report contract should require selected scope, candidate commits, dependency-impact notes, digest inputs, branch state, and pending or approved revert commands.

## Actual Behavior

The command manifests describe those report fields, but `src/mcp/artifact-contracts/index.ts` renders and validates `report.ship` and `report.undo` with only broad section headings and no placeholder signals. The focused metadata tests pass while checking command/skill/doc guardrail strings, but they do not assert populated canonical report content for `ship-latest` or `undo-latest`.

## Impact

High-risk git workflows can produce durable reports that look schema-valid while omitting the evidence needed to review a push, PR, or revert decision after the chat context is gone. That weakens the report-before-mutate posture and makes later repair, audit, or rollback planning depend on prompt text rather than `.blueprint/reports/*-latest.md`.

## Affected Files

- `commands/blu-ship.toml`
- `commands/blu-undo.toml`
- `src/mcp/artifact-contracts/index.ts`
- `tests/ship-metadata.test.ts`
- `tests/undo-metadata.test.ts`

## Evidence

| Source | Evidence | Why It Matters |
|--------|----------|----------------|
| `commands/blu-ship.toml:16-20` | The manifest says saved evidence is a gate and `ship-latest` must record saved evidence, source/base branches, requested push and PR actions, actual push or PR outcome, `gh` fallback notes, and a manual checklist. | This is the command-level contract the durable report should preserve. |
| `commands/blu-undo.toml:20-23` | The manifest says undo must collect affected Blueprint evidence, digest inputs, branch state, candidate commits, dependency-impact notes, and pending revert commands before mutation. | This is the undo report-before-mutate contract. |
| `src/mcp/artifact-contracts/index.ts:2525-2570` | The ship and undo authoring templates contain only broad bullets under generic headings. | The canonical templates do not guide authors toward the high-risk evidence required by the manifests. |
| `src/mcp/artifact-contracts/index.ts:4480-4508` | `report.ship` and `report.undo` define required headings only and both have `placeholderSignals: []`. | Validation has no contract-backed signal for omitted branch, evidence, fallback, digest, or command details. |
| `tests/ship-metadata.test.ts:8-82` | The ship metadata tests assert manifest, skill, and runtime-reference strings but do not load `report.ship`, validate a populated report, or reject a minimal report. | Current focused coverage cannot catch the under-constrained report contract. |
| `tests/undo-metadata.test.ts:8-143` | The undo metadata tests assert guardrail strings and shipped status but do not load `report.undo`, validate a populated report, or reject a minimal report. | Current focused coverage cannot catch the under-constrained undo report contract. |
| `npx tsx -e "...validateReportArtifactContent..."` | Minimal `ship-latest` and `undo-latest` reports returned `{"valid":true,"issues":[],"warnings":[]}`. | Confirms the validator currently accepts reports that omit the high-risk fields. |
| `npx tsx --test tests/pr-branch-metadata.test.ts tests/ship-metadata.test.ts tests/undo-metadata.test.ts` | The focused metadata suite passed: 12 tests, 12 pass, 0 fail. | Confirms existing tests do not detect this contract gap. |

## Verification Steps

1. Inspect `commands/blu-ship.toml:16-20` and confirm the command requires saved evidence, branch identity, requested push/PR actions, remote outcome, `gh` fallback notes, and manual checklist content in `ship-latest`.
2. Inspect `commands/blu-undo.toml:20-23` and confirm the command requires affected evidence, digest inputs, branch state, candidate commits, dependency-impact notes, and pending revert commands in `undo-latest`.
3. Inspect `src/mcp/artifact-contracts/index.ts:2525-2570` and `src/mcp/artifact-contracts/index.ts:4480-4508`; observe that the canonical templates and placeholder signals do not require those fields.
4. Run `npx tsx --test tests/pr-branch-metadata.test.ts tests/ship-metadata.test.ts tests/undo-metadata.test.ts`; observe that the suite passes despite the weak ship/undo report contracts.
5. Run a no-write validation probe with `validateReportArtifactContent` using minimal `ship-latest` and `undo-latest` reports containing only the required headings; observe both return `valid: true`.

## Likely Cause

`report.pr-branch` received a richer canonical template, placeholder-signal rejection, and a populated-report metadata test, while `report.ship` and `report.undo` remained broad heading-based Markdown contracts. The command manifests evolved to require stronger report content, but the artifact contracts and focused tests were not tightened in parallel.

## Suggested Fix Direction

Strengthen `report.ship` and `report.undo` authoring templates with explicit fields for the manifest-required evidence, add placeholder signals for required values, document the templates in `docs/ARTIFACT-SCHEMA.md`, and extend `tests/ship-metadata.test.ts` and `tests/undo-metadata.test.ts` with canonical populated-report validation plus minimal-report rejection.

## Uncertainty

None known. The contract mismatch is confirmed by source inspection, focused metadata test output, and a direct no-write validator probe.

## Related Bugs

None known.

## No Fix Applied

No source, manifest, skill, test, generated asset, or runtime behavior fix was applied during this discovery milestone.
