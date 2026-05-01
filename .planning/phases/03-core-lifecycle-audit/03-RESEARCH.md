# Phase 3: Core Lifecycle Audit - Research

**Researched:** 2026-05-01
**Domain:** Blueprint core lifecycle discovery, planning, execution, validation, UAT, and test-generation flows
**Confidence:** HIGH

## Research Question

What does the executor need to know to audit Blueprint's core phase lifecycle in command-flow order without applying source, manifest, skill, test, build, generated asset, runtime, installed-extension, or host-global fixes?

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COV-02 | Core phase lifecycle behavior is audited: discuss, research, UI, plan, execute, validate, UAT, and add-tests. | Audit slices must trace `/blu-discuss-phase`, `/blu-research-phase`, `/blu-ui-phase`, `/blu-plan-phase`, `/blu-execute-phase`, `/blu-validate-phase`, `/blu-verify-work`, and `/blu-add-tests` from docs/manifests into skills, runtime contracts, MCP tools, artifact schemas, and focused tests. |
| NFIX-01 | No source, manifest, skill, test, build, generated asset, or runtime behavior fixes are applied. | Plans must be read-heavy and write only bug reports, bug index rows, summaries, and planning artifacts. |
| NFIX-02 | Temporary probe files are removed before completion and documented. | Probe-based verification should use disposable temp roots only when static evidence and existing tests cannot settle a material ambiguity. |
| NFIX-03 | Git status is checked at phase boundaries. | Every plan must include a `git status --short` boundary check and separate unrelated user changes from phase-owned bug docs. |

## Summary

Phase 3 should audit the lifecycle exactly as a Blueprint user experiences it: discovery artifacts first, then plan authoring, execution summaries, validation/UAT, and finally add-tests plus closeout. The strongest evidence path is to compare command specs, TOML manifests, skill references, runtime-reference rows, MCP tool registrations, artifact contracts, and existing lifecycle tests before creating any runtime probe. If a defect is confirmed or likely, create one `docs/bugs/BPBUG-###-*.md` report using the established template and update the index. If a slice finds no defect, record that in the plan summary and final Phase 3 slice row instead of inventing a bug.

## Locked Decisions From Context

- D-01: Audit in command-flow order: `/blu-discuss-phase`, `/blu-research-phase`, `/blu-ui-phase`, `/blu-plan-phase`, `/blu-execute-phase`, `/blu-validate-phase`, `/blu-verify-work`, and `/blu-add-tests`.
- D-02: Each command-flow slice must trace docs, command manifest, primary skill, runtime-contract reference, MCP tools, schemas, generated assets if relevant, and regression tests.
- D-03: Split the lifecycle into small enough audit slices that each records examined surfaces, deferred surfaces, and any bug findings independently.
- D-04 and D-05: Use static contract review plus targeted existing test runs as the default evidence path.
- D-06 and D-07: Use disposable temp probes only when material lifecycle ambiguity cannot be resolved from static evidence and existing tests.
- D-08 through D-11: File bugs only for user-impact or lifecycle-state risk, material misleading drift, or high-confidence likely defects.
- D-12 through D-15: Preserve strict but practical discovery-only boundaries and verify `git status --short` at closeout.

## Evidence Baseline

### Lifecycle Command Contracts

- `docs/PHASE-LIFECYCLE.md` defines the intended happy path from `discuss-phase` through `verify-work`, with optional `add-tests`, checkpoint ownership, summary-backed validation, resumable UAT, and state-based next-safe-action routing.
- `docs/COMMAND-CATALOG.md` declares all Phase 3 lifecycle commands as `implemented`: `discuss-phase`, `research-phase`, `ui-phase`, `plan-phase`, `execute-phase`, `validate-phase`, `verify-work`, and `add-tests`.
- `docs/RUNTIME-REFERENCE.md` records runtime contract rows for each lifecycle command, including required skills, MCP destinations, optional agents, hook involvement, and `needs-behavior-audit` evidence state.
- `docs/MCP-TOOLS.md` lists the registered phase, summary, validation, checkpoint, and add-tests report tool families that lifecycle commands must use.

### Discovery Artifact Flow

- `docs/commands/discuss-phase.md`, `commands/blu-discuss-phase.toml`, `skills/blueprint-phase-discovery/SKILL.md`, and `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` require phase resolution, prior context reads, shared checkpoint ownership guards, canonical context/discussion contracts, validation repair, synced state refresh, and safe routing.
- `docs/commands/research-phase.md`, `commands/blu-research-phase.toml`, and `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md` require saved context before research, effective external-source policy, canonical `phase.research` authoring, strict validation, checkpoint ownership, and state sync even on valid reuse paths.
- `docs/commands/ui-phase.md`, `commands/blu-ui-phase.toml`, and `skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md` require the single `XX-UI-SPEC.md` artifact for either a UI contract or explicit skip rationale, config-aware UI gates, checker revision, and MCP-only persistence.
- `src/mcp/tools/phase.ts` owns phase artifact read/write, research status, and `blueprint_phase_checkpoint_get|put|delete` with owner/mode safety checks.

### Plan Authoring Flow

- `docs/commands/plan-phase.md`, `commands/blu-plan-phase.toml`, `skills/blueprint-phase-planning/SKILL.md`, and `skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md` require the live `phase.plan` model contract, `blueprint_phase_plan_authoring_context`, model validation, strict model-only writes, scoped plan-set validation, config-aware research/UI/readiness gates, bounded checker loop, and synced state update.
- `src/mcp/artifact-contracts/index.ts` exposes `phase.plan` model metadata and render templates; `src/mcp/artifact-contracts/schemas/phase.plan.model.schema.json` is the base schema.
- `src/mcp/tools/phase.ts` implements plan index/read/authoring-context/validate-model/write/validate handlers.

### Execution Summary Flow

- `docs/commands/execute-phase.md`, `commands/blu-execute-phase.toml`, `skills/blueprint-phase-execution/SKILL.md`, and `skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md` require deterministic target selection through `blueprint_phase_execution_targets`, lower-wave blockers, summary-backed carry-forward, valid `PARTIAL` and `BLOCKED` pending semantics, model-only summary writes, and post-write summary index plus artifact validation plus synced state update.
- `src/mcp/artifact-contracts/index.ts` exposes `phase.summary`; `src/mcp/artifact-contracts/schemas/phase.summary.model.schema.json` is the base schema.
- `src/mcp/tools/phase.ts` implements summary index/read/authoring-context/validate-model/write and execution target selection.

### Validation, UAT, And Add-Tests Flow

- `docs/commands/validate-phase.md`, `commands/blu-validate-phase.toml`, and `skills/blueprint-phase-validation/references/validate-phase-runtime-contract.md` require completed summaries as the validation baseline, State A/B/C classification, structured `phase.verification` model validation, no Markdown fallback, gap classification, and implemented repair routes.
- `docs/commands/verify-work.md`, `commands/blu-verify-work.toml`, and `skills/blueprint-phase-validation/references/verify-work-runtime-contract.md` require ready verification before UAT, saved-summary-first UAT queue construction, per-test response classification, in-artifact checkpoint state, structured `phase.uat` model validation, post-write validation, and roadmap/state sync only from saved evidence.
- `docs/commands/add-tests.md`, `commands/blu-add-tests.toml`, and `skills/blueprint-phase-validation/references/add-tests-runtime-contract.md` require saved summaries plus validation/UAT evidence before test generation, evidence-backed test scope/classification, bounded repo test mutation, canonical verification updates, and a structured `report.add-tests` report.
- `src/mcp/artifact-contracts/schemas/phase.verification.model.schema.json`, `phase.uat.model.schema.json`, and `report.add-tests.model.schema.json` are the base schemas for the validation-family model flows.

## Existing Tests To Reuse

Prefer targeted commands during discovery:

```bash
npx tsx --test tests/phase-discovery-discuss.test.ts tests/phase-discovery-research.test.ts tests/phase-discovery-ui.test.ts tests/phase-discovery-tools.test.ts
npx tsx --test tests/phase-planning-tools.test.ts tests/phase-plan-validation-hardening.test.ts tests/phase-plan-write-locking.test.ts tests/plan-phase-metadata.test.ts
npx tsx --test tests/execute-phase-summary-tools.test.ts tests/execute-phase-metadata.test.ts
npx tsx --test tests/phase-validation-slice.test.ts tests/validate-phase-tools.test.ts tests/verify-work-roadmap-sync.test.ts tests/validate-phase-metadata.test.ts tests/verify-work-metadata.test.ts
npx tsx --test tests/add-tests-slice.test.ts tests/add-tests-metadata.test.ts
```

Run `npm ci` first only in a fresh worktree with missing `node_modules`; this repository currently has `node_modules/`, but execution summaries should document any dependency or environment blocker honestly.

## Recommended Audit Shape

1. Discovery artifact audit: discuss, research, UI-spec or skip-rationale behavior, shared checkpoint owner/mode safety, discovery artifact validation, and discovery tests.
2. Plan authoring audit: plan-phase readiness gates, plan model authoring context, model validation, strict plan writes, scoped validation, checker loop, and plan metadata tests.
3. Execution summary audit: execution target selection, lower-wave blockers, plan read/summary authoring, model-only summary writes, partial/blocked semantics, and execution tests.
4. Validation and UAT audit: validate-phase State A/B/C, verification model writing, UAT readiness/resume/checkpoint behavior, roadmap/state sync, and validation/UAT tests.
5. Add-tests and closeout audit: add-tests evidence prerequisites, test-scope classification, verification/report persistence, bug index reconciliation, no-fix boundary, and final `git status --short`.

## Validation Architecture

Phase 3 validation is artifact and evidence based, not source mutation based.

- Each plan must preserve no-fix discipline: writes are limited to `docs/bugs/*.md`, `docs/bugs/INDEX.md`, and Phase 3 planning/execution artifacts under `.planning/phases/03-core-lifecycle-audit/`.
- Each bug report must follow `docs/bugs/TEMPLATE.md` and cite concrete evidence from command outputs, test outputs, file paths, line-level references where useful, or docs/source contract mismatches.
- Each plan should run at least one targeted lifecycle test command or document why it could not run.
- Every plan must run `git status --short` before completion and document that no source, manifest, skill, test, build, generated asset, runtime `.blueprint/`, installed extension, or host-global state changes were applied by the audit.
- If tests fail, classify whether the failure is defect evidence, an environment/dependency problem, or unrelated pre-existing breakage.

## Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| The audit accidentally fixes the lifecycle defect it finds. | Plans forbid source, manifest, skill, test, build, generated asset, runtime `.blueprint/`, installed-extension, and host-global mutations. |
| Command-flow order hides cross-layer MCP defects. | Each slice traces from command docs/manifests into skills, runtime contracts, MCP tools, schemas, and tests before conclusion. |
| Existing tests prove metadata only, not behavior. | Plans combine metadata tests with tool-level lifecycle tests and allow disposable probes only for unresolved material ambiguity. |
| UAT/add-tests findings become implementation work. | Preserve discovery-only output: bug docs, index rows, summaries, and planning state only. |

## Deferrals

- Repairing any discovered lifecycle defect is deferred to a later repair milestone.
- Review, security, shipping, workspace, packaging, and cross-cut drift surfaces are deferred to Phases 4 through 8 unless directly needed as evidence for a Phase 3 lifecycle defect.

## Research Complete

Phase 3 can be planned from this research, the Phase 3 context, and the existing Phase 1 bug-reporting harness.
