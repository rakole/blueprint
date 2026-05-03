---
id: BPBUG-001
title: Ship and undo report contracts accept under-specified high-risk evidence
severity: medium
confidence: confirmed
surface: MCP tool
status: fixed
discovery_phase: 5
reported: 2026-05-01
---

# BPBUG-001: Ship and undo report contracts accept under-specified high-risk evidence

## Classification

- Severity: `medium`
- Confidence: `confirmed`
- Surface: `MCP tool`
- Status: `fixed`

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
| `npx tsx -e 'import { validateReportArtifactContent } ...'` | The no-write probe below returned `{"ship":{"valid":true,"issues":[],"warnings":[]},"undo":{"valid":true,"issues":[],"warnings":[]}}`. | Confirms the validator currently accepts reports that omit the high-risk fields. |
| `npx tsx --test tests/pr-branch-metadata.test.ts tests/ship-metadata.test.ts tests/undo-metadata.test.ts` | The focused metadata suite passed: 12 tests, 12 pass, 0 fail. | Confirms existing tests do not detect this contract gap. |

## Verification Steps

1. Inspect `commands/blu-ship.toml:16-20` and confirm the command requires saved evidence, branch identity, requested push/PR actions, remote outcome, `gh` fallback notes, and manual checklist content in `ship-latest`.
2. Inspect `commands/blu-undo.toml:20-23` and confirm the command requires affected evidence, digest inputs, branch state, candidate commits, dependency-impact notes, and pending revert commands in `undo-latest`.
3. Inspect `src/mcp/artifact-contracts/index.ts:2525-2570` and `src/mcp/artifact-contracts/index.ts:4480-4508`; observe that the canonical templates and placeholder signals do not require those fields.
4. Run `npx tsx --test tests/pr-branch-metadata.test.ts tests/ship-metadata.test.ts tests/undo-metadata.test.ts`; observe that the suite passes despite the weak ship/undo report contracts.
5. Run this no-write validation probe with minimal `ship-latest` and `undo-latest` reports containing only the required headings:

```bash
npx tsx -e 'import { validateReportArtifactContent } from "./src/mcp/tools/artifacts.ts";
const ship = `# Ship Report

## Selected Scope

- scope

## Branch Plan

- plan

## Push Or PR Outcome

- none

## Manual Fallback Guidance

- fallback

## Next Safe Action

- /blu-progress`;
const undo = `# Undo Report

## Requested Scope

- scope

## Candidate Revert Set

- commits

## Dependency Impact

- impact

## Mutation Outcome

- pending

## Next Safe Action

- /blu-progress`;
console.log(JSON.stringify({ ship: validateReportArtifactContent(ship, "ship-latest"), undo: validateReportArtifactContent(undo, "undo-latest") }));'
```

Observed stdout:

```json
{"ship":{"valid":true,"issues":[],"warnings":[]},"undo":{"valid":true,"issues":[],"warnings":[]}}
```

## Likely Cause

`report.pr-branch` received a richer canonical template, placeholder-signal rejection, and a populated-report metadata test, while `report.ship` and `report.undo` remained broad heading-based Markdown contracts. The command manifests evolved to require stronger report content, but the artifact contracts and focused tests were not tightened in parallel.

## Suggested Fix Direction

Strengthen `report.ship` and `report.undo` authoring templates with explicit fields for the manifest-required evidence, add placeholder signals for required values, document the templates in `docs/ARTIFACT-SCHEMA.md`, and extend `tests/ship-metadata.test.ts` and `tests/undo-metadata.test.ts` with canonical populated-report validation plus minimal-report rejection.

## Uncertainty

None known. The contract mismatch is confirmed by source inspection, focused metadata test output, and a direct no-write validator probe.

## Related Bugs

- Root-cause cluster: `under-specified contracts`. This bug remains the anchor for that cluster; no duplicate or same-repair-path peer is currently known.

## No Fix Applied

No source, manifest, skill, test, generated asset, or runtime behavior fix was applied during this discovery milestone.

## Repair Outcome - 2026-05-03

Status: `fixed`.

Repair commits:

- `f55d2f8` tightened canonical `report.ship` and `report.undo` contracts and mirrored them in `docs/ARTIFACT-SCHEMA.md`.
- `143e246` aligned ship/undo command prompts, maintenance guidance, and runtime docs with canonical contract reads.
- `146f51f` added focused ship/undo contract regression coverage.
- `e309c1c` fixed review findings by adding post-mutation report overwrites, ship/undo semantic validation, and partial-placeholder rejection.
- `235631f` updated full-suite command-catalog expectations and refreshed tracked `dist/mcp/server.js` outputs.

Verification:

- `npm run typecheck` - pass.
- `npx tsx --test tests/pr-branch-metadata.test.ts tests/ship-metadata.test.ts tests/undo-metadata.test.ts tests/maintenance-regression.test.ts tests/command-contract-docs.test.ts tests/mcp-contract-audit-metadata.test.ts` - pass, `67/67`.
- `npm test` - pass, `840/840`.

Residual note:

- A low-severity runtime-reference table wording note was recorded during review. It did not affect the BPBUG-001 high/medium acceptance criteria or runtime behavior after remediation.

## Repair Plan - 2026-05-03

### Local Evidence Inspected

- Bug contract: `docs/bugs/BPBUG-001-ship-undo-report-contracts-underconstrained.md` confirms current gap, expected fields, and suggested fix direction.
- Command manifests: `commands/blu-ship.toml` requires saved evidence, digest, branch/remote plan, exact commands, `gh` fallback, and `ship-latest` persistence; `commands/blu-undo.toml` requires affected evidence, digest inputs, branch state, candidate commits, dependency impact, pending revert commands, and `undo-latest`.
- Maintenance skill: `skills/blueprint-maintenance/SKILL.md` already has shared report-contract guidance and report-write rules; ship/undo flows are the impacted orchestration paths.
- Runtime contracts: `src/mcp/artifact-contracts/index.ts` has broad ship/undo templates and heading-only `report.ship`/`report.undo` definitions with empty `placeholderSignals`.
- Existing validator is sufficient: `src/mcp/tools/artifacts.ts` validates H1, locked markers, required non-empty headings, and placeholder signals; report writes call it before persistence.
- Precedent: `tests/pr-branch-metadata.test.ts` locks a rich report template, rejects unresolved placeholders, rejects weak content, and accepts a populated report.
- Current missing coverage: `tests/ship-metadata.test.ts` and `tests/undo-metadata.test.ts` check metadata/status strings but do not lock report contract behavior.
- Human docs gap: `docs/ARTIFACT-SCHEMA.md` lists reports but lacks ship/undo report sections; the pr-branch schema section is the template mirror to follow.

### Official Gemini CLI Research

- Official Gemini CLI tools documentation says tools are invoked by the model as needed, mutating file/shell tools require confirmation, and users should review confirmation prompts: <https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/tools.md>.
- The same reference lists `ask_user`, `write_todos`, experimental task tracker tools, and `update_topic`; `update_topic` accepts `title`, `summary`, and `strategic_intent`, while the tracker is experimental and enabled separately. This supports keeping Blueprint tracker usage session-local and fallback-safe, not durable.
- Official extension documentation says extensions expose custom commands through TOML files under `commands/`, load MCP servers from `gemini-extension.json`, and workspace config can override extension MCP settings: <https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md>.
- Official MCP documentation says discovered MCP tools are available to the model like built-ins and are executed through the MCP server with normal confirmation/display behavior: <https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md>.
- Impact on this fix: no artifact-contract design change is required. Durable ship/undo reports must not depend on `write_todos`, `update_topic`, or tracker state. The fix should add or keep canonical Blueprint MCP report-contract reads where command prompts author reports.

### Implementation Plan

- Keep the fix structural and minimal: strengthen `report.ship` and `report.undo` Markdown contracts using existing `requiredHeadings`, `lockedMarkers`, and `placeholderSignals`; do not add model schemas or custom validators.
- Update `src/mcp/artifact-contracts/index.ts`:
  - Replace `renderShipTemplate()` with sections: `Selected Scope`, `Saved Evidence`, `Branch Plan`, `Remote Actions`, `Push Or PR Outcome`, `Manual Fallback Guidance`, `Next Safe Action`.
  - Include ship fields for scope, source branch, source HEAD, base branch, execution mode, draft/ready mode, digest inputs, saved evidence paths, tracked files, config used, current branch, push requested, PR requested, git commands approved, `gh` commands approved, `gh` availability/auth, push outcome, PR outcome, `gh` fallback notes, manual checklist, and draft PR body source.
  - Replace `renderUndoTemplate()` with sections: `Requested Scope`, `Branch State`, `Affected Evidence And Digest Inputs`, `Candidate Revert Set`, `Dependency Impact`, `Approved Revert Commands`, `Mutation Outcome`, `Next Safe Action`.
  - Include undo fields for scope, reason, execution mode, pending gate, current branch, HEAD, working tree status, merge state, report overwrite status, digest inputs, affected evidence, stale evidence impact, tracked files, commit ledger, dependency risk, pending/approved git commands, forbidden-command check, revert outcome, and blockers.
  - Update `report.ship` and `report.undo` required headings, add locked markers for those field labels, and add placeholder signals for all angle-bracket/example enum placeholders.
- Update command prompts:
  - In `commands/blu-ship.toml`, after digest, call `mcp_blueprint_blueprint_artifact_contract_read` for `report.ship`; use `contract.authoringTemplate` as the report authority before `mcp_blueprint_blueprint_artifact_report_write`; add this FQN to response requirements.
  - In `commands/blu-undo.toml`, do the same for `report.undo` while preserving report-before-mutate ordering.
- Update orchestration/docs:
  - In `skills/blueprint-maintenance/SKILL.md`, name `report.ship` and `report.undo` alongside `report.pr-branch`; add ship/undo steps to read the canonical contract before report persistence.
  - In `docs/commands/ship.md` and `docs/commands/undo.md`, add `blueprint_artifact_contract_read` to Required MCP Tools and report contract sections.
  - In `docs/MCP-TOOLS.md` and `docs/RUNTIME-REFERENCE.md`, update ship/undo exact tool lists and mention canonical report contracts.
  - In `docs/ARTIFACT-SCHEMA.md`, add `reports/ship-latest.md` and `reports/undo-latest.md` sections mirroring the new templates.

### Gemini CLI Tool Usage Placement

- Keep `update_topic` and `write_todos` only in ship's non-trivial in-flight progress guidance; they stay session-local.
- Keep tracker wording capability-gated and session-local because official docs mark task tracker experimental.
- Do not add Gemini core tools to undo.
- Add only Blueprint MCP FQN `mcp_blueprint_blueprint_artifact_contract_read` to ship/undo prompt flows and response requirements.

### Tests

- Update `tests/ship-metadata.test.ts`:
  - Import `readArtifactContract` and `validateReportArtifactContent`.
  - Assert new headings, locked markers, placeholder signals, and template fields.
  - Assert `contract.authoringTemplate` is invalid until placeholders are replaced.
  - Assert the old minimal report from BPBUG-001 is invalid.
  - Assert a populated ship report validates.
  - Update metadata assertions for `mcp_blueprint_blueprint_artifact_contract_read`.
- Update `tests/undo-metadata.test.ts` with parallel undo contract assertions and old-minimal rejection.
- Update `tests/command-contract-docs.test.ts`, `tests/mcp-contract-audit-metadata.test.ts`, and `tests/maintenance-regression.test.ts` for the new contract-read references and runtime tool lists.
- Verification commands after `npm ci`: `npm run typecheck`; `npx tsx --test tests/pr-branch-metadata.test.ts tests/ship-metadata.test.ts tests/undo-metadata.test.ts tests/maintenance-regression.test.ts tests/command-contract-docs.test.ts tests/mcp-contract-audit-metadata.test.ts`.

### Parallel Waves

- Wave 1, contract runtime: `src/mcp/artifact-contracts/index.ts`, `docs/ARTIFACT-SCHEMA.md`. Needs the final field list above. No dependency.
- Wave 2, prompt/runtime alignment: `commands/blu-ship.toml`, `commands/blu-undo.toml`, `skills/blueprint-maintenance/SKILL.md`, `docs/commands/ship.md`, `docs/commands/undo.md`, `docs/MCP-TOOLS.md`, `docs/RUNTIME-REFERENCE.md`. Can run parallel with Wave 1 if the same headings/field names are shared.
- Wave 3, tests: `tests/ship-metadata.test.ts`, `tests/undo-metadata.test.ts`, `tests/command-contract-docs.test.ts`, `tests/mcp-contract-audit-metadata.test.ts`, `tests/maintenance-regression.test.ts`. Depends on Waves 1-2.

### DoD Reviewer Checklist

- `report.ship` and `report.undo` reject the BPBUG-001 minimal reports.
- The canonical ship/undo templates reject themselves until placeholders are replaced.
- Populated ship/undo fixtures validate successfully through `validateReportArtifactContent`.
- `blueprint_artifact_report_write` still uses existing validation; no custom write path or model schema was added.
- Ship/undo manifests read `report.ship`/`report.undo` contracts before report write and still pass bare report names only.
- `update_topic`, `write_todos`, and tracker state remain session-local and non-durable.
- Runtime catalog remains implemented because all added required tools are already registered.
- No installed extension directory, `dist/`, host-global state, or unrelated command surface is changed.

### Risks / Uncertainty

- Tightening headings/markers may make old broad `ship-latest` or `undo-latest` bodies invalid on reuse; this is acceptable for high-risk evidence repair, but mention it in release notes if needed.
- Structural Markdown validation still cannot prove semantic truth of values such as `none`; schema-first report models would be a larger future hardening task.
- Gemini task tracker is experimental, so durable report content must not rely on tracker availability.

## Review Reports - 2026-05-03

### DoD Reviewer Report

Verdict: `PASS`.

Findings:

- `BLOCKER`: none.
- `HIGH`: none.
- `MEDIUM/LOW/INFO`: The BPBUG-001 minimal report probe strings now fail validation with missing locked markers and missing required sections. This is expected and matches the repair plan, but it is a behavior change for legacy thin `ship-latest` or `undo-latest` reports.

Evidence checked:

- `report.ship` and `report.undo` reject the BPBUG-001 minimal reports.
- Canonical ship/undo templates reject themselves until placeholders are replaced.
- Populated ship/undo fixtures validate through `validateReportArtifactContent`.
- `blueprint_artifact_report_write` still uses existing validation through `validateReportArtifactContent`; no custom write path or model schema was added.
- `commands/blu-ship.toml` reads `report.ship` before persisting `ship-latest` with the bare report name.
- `commands/blu-undo.toml` reads `report.undo` before persisting `undo-latest` with the bare report name.
- `update_topic`, `write_todos`, and tracker state remain session-local and non-durable.
- Runtime catalog probe returned `status: "implemented"` and `requiredToolsSatisfied: true` for `ship` and `undo`, with `blueprint_artifact_contract_read` present in required tools.
- `git diff --name-only origin/main..HEAD` was limited to command/docs/skill/contracts/tests; no `dist/`, extension manifest, installed extension, or host-global state change was present.

Tests run:

- `npm run typecheck` - pass.
- `npx tsx --test tests/pr-branch-metadata.test.ts tests/ship-metadata.test.ts tests/undo-metadata.test.ts tests/maintenance-regression.test.ts tests/command-contract-docs.test.ts tests/mcp-contract-audit-metadata.test.ts` - pass, `67/67`.

### Code Reviewer Report

No `CRITICAL` or `HIGH` issues found. The BPBUG-001 tightening was internally consistent across templates, contracts, manifests, docs, and tests, and the targeted suite passed.

Findings:

- `MEDIUM`: `report.ship` uses a nested placeholder for the config line, such as `<git.base_branch=<value>; ...>`. The validator flags exact `placeholderSignals` substrings, so a partially edited line that still contains inner `<value>` tokens but no longer contains the full original placeholder string could incorrectly pass placeholder detection. Recommended fix: use a single non-nested placeholder token for the whole field or add narrower placeholder signals.
- `LOW`: `docs/RUNTIME-REFERENCE.md` still omits `blueprint_artifact_contract_read` from the `ship`/`undo` exact MCP destination table column even though the manifests require it and nearby prose mentions it. This may confuse readers who treat the column as canonical.

Tests run:

- `npm run typecheck` - pass.
- `npx tsx --test tests/pr-branch-metadata.test.ts tests/ship-metadata.test.ts tests/undo-metadata.test.ts tests/maintenance-regression.test.ts tests/command-contract-docs.test.ts tests/mcp-contract-audit-metadata.test.ts` - pass, `67/67`.

Residual risk:

- Old pre-BPBUG-001 minimal reports are intentionally invalid under the tightened contracts, so future reuse flows should regenerate from the new authoring template.
- Ship/undo validators remain structural unless follow-up semantic validation is added.

### Bug Finder Report

No `CRITICAL` findings. Remaining issues found: `2 HIGH`, `1 MEDIUM`, `1 LOW`.

Findings:

- `HIGH`: `commands/blu-ship.toml` writes `ship-latest` before remote mutation but does not require a second `blueprint_artifact_report_write` after approved push/PR steps complete. The durable report can remain stuck at the preflight plan and miss actual push outcome, PR outcome, fallback notes, and post-mutation evidence. Recommended fix: keep the pre-mutation report write, then explicitly overwrite `ship-latest` after the push/PR attempt with actual outcomes.
- `HIGH`: `commands/blu-undo.toml` writes `undo-latest` before `git revert` but does not require a second write after the revert succeeds, fails, or stops on conflicts. The durable report can omit the actual mutation outcome and blockers. Recommended fix: keep the pre-mutation report write, then explicitly overwrite `undo-latest` after the revert attempt with final outcome and blockers.
- `MEDIUM`: Ship/undo report validation still false-accepts semantically invalid safety records because the Markdown validator only checks H1, headings, locked markers, and placeholder removal. A probe returned `valid: true` for a ship report with values such as `Execution mode: yolo` and `Push requested: maybe`, and for an undo report with `Approved git commands: git reset --hard HEAD~1` plus `Forbidden-command check: passed`. Recommended fix: add ship/undo-specific semantic validation for allowed enum values and forbidden destructive undo commands, with negative tests.
- `LOW`: The runtime-reference exact MCP destination table omits `blueprint_artifact_contract_read` for `ship` and `undo`, while tests assert that incomplete column. Recommended fix: update the table and assertions together. This is tracked as low severity and is not part of the required critical/high/medium remediation pass.

Tests run:

- `npx tsx --test tests/ship-metadata.test.ts tests/undo-metadata.test.ts` - pass, `8/8`.
