# Structured Artifact Models Plan

## Summary

Move Blueprint artifact generation from model-authored Markdown toward model-authored structured JSON, with MCP-owned rendering, validation, and visible coverage ledgers.

The core decision is: Markdown remains the durable `.blueprint/` source of truth, but commands should increasingly ask models for strict structured artifact models. MCP then validates those models against known context, renders canonical Markdown, and runs existing Markdown validators before persistence.

This plan starts with a document-only checkpoint. Runtime behavior changes should happen in later implementation passes.

## Implementation Status

- 2026-04-28: `/blu-validate-phase` slice implemented for `phase.verification` and the shared validation writer. `phase.verification` and `phase.uat` now expose structured `modelContract` metadata from `blueprint_artifact_contract_read`, and `blueprint_phase_validation_write` accepts exactly one of rendered Markdown `content` or a structured `model` that MCP validates, renders, and revalidates before persistence.

## Locked Decisions

- Keep `.blueprint/*.md` artifacts as durable human-readable state.
- Add structured model contracts to the artifact contract registry, not separate prompt-only docs.
- Extend existing write tools to accept exactly one of `content` or `model`; do not create a parallel model-write tool family for the pilot.
- Return detailed JSON Schema, quality rules, context bindings, rendered headings, and minimal valid examples from `blueprint_artifact_contract_read`.
- Reject low-effort docs through known-context coverage validation, not word-count or section-length heuristics.
- Render important coverage ledgers visibly into Markdown.
- Keep raw Markdown writes compatible, but validate them against the same richer requirements after a contract is upgraded.
- Define "repair until valid" as: never persist invalid artifacts, retry while issues are changing, stop on repeated issue fingerprints, non-repairable blockers, required human input, or a hard cap of 5 attempts per artifact.
- Reject copied example phrases and generic example leakage.

## Implementation Plan

### 1. Add Model Contract Support

Add `modelContract` support to `src/mcp/artifact-contracts/index.ts`.

Define a reusable contract shape with:

- `schemaId`
- `schemaVersion`
- `jsonSchema`
- `qualityRules`
- `contextBindings`
- `renderedHeadings`
- `minimalValidExample`
- `exampleLeakageSignals`

`blueprint_artifact_contract_read` should include this payload when an artifact supports structured model authoring.

### 2. Extend Existing Write Tool Inputs

For the pilot, update:

- `blueprint_phase_plan_write`
- `blueprint_artifact_report_write`

Each should accept:

- `content?: string`
- `model?: Record<string, unknown>`

Validation rule: exactly one must be supplied. Existing `content` behavior stays available.

### 3. Pilot `phase.plan` Structured Model

Use MCP-owned identity:

- `phase` comes from the write tool args.
- `planId` is supplied by args or auto-assigned by the existing plan writer.
- The renderer writes matching frontmatter and path.

The model should include typed fields for:

- title, wave, status, objective, dependencies, autonomous flag
- goal and scope
- tasks with stable task ids, read-first paths, actions, and acceptance criteria
- verification items
- must-haves
- requirement coverage ledger
- evidence coverage ledger
- file/surface coverage ledger
- unknowns and deferrals

MCP must reject the model when:

- any known in-scope requirement is missing, duplicated, or neither covered nor explicitly deferred or irrelevant
- any known evidence artifact is omitted without rationale
- any modified file lacks task and verification coverage
- acceptance criteria are not test, grep, command, file-read, or artifact-validation verifiable
- example phrases or placeholder language survive
- next action points to non-implemented commands

### 4. Pilot `report.quick-run` Structured Model

Use a generic sectioned report model for simple reports:

- task summary
- changed surfaces
- evidence used
- verification
- follow-ups
- next safe action

The renderer outputs the canonical `report.quick-run` Markdown shape plus visible ledgers for changed surfaces and evidence.

### 5. Update Rendered Markdown Contracts

For `phase.plan`, add explicit visible sections:

- `## Requirement Coverage`
- `## Evidence Coverage`
- `## File / Surface Coverage`
- `## Unknowns And Deferrals`

Raw Markdown content writes must include equivalent sections once this contract is upgraded.

### 6. Add Context-Aware Validation

Validation should compare model content against available Blueprint context:

- roadmap requirement ids
- phase context, research, UI, and review artifacts
- existing plan index and dependencies
- saved summaries and validation artifacts where relevant
- changed files or declared file surfaces
- implemented command catalog for next-safe-action checks

Irrelevant known context is allowed only with explicit rationale.

### 7. Roll Out To Strict Core Execution Artifacts

First strict wave after the pilot:

- `phase.plan`
- `phase.summary`
- `phase.verification`
- `phase.uat`
- `review.code-review`
- `review.review-fix`
- `review.peer-review`
- `review.security`
- `review.ui-review`
- `report.impact`

This affects roughly 11 command workflows. Full Markdown-oriented migration affects roughly 27 workflows.

## Test Plan

- Add contract registry tests proving `blueprint_artifact_contract_read` returns `modelContract` for `phase.plan` and `report.quick-run`.
- Add schema validation tests for valid and invalid structured plan models.
- Add context coverage tests that reject missing requirement, evidence, file, task, and verification coverage.
- Add renderer tests proving structured models render canonical Markdown with visible ledgers.
- Add compatibility tests proving raw Markdown writes still work only when they satisfy the upgraded contract.
- Add low-effort rejection tests for placeholder text, copied examples, generic `none`, and unverifiable acceptance criteria.
- Add command metadata tests updating `/blu-plan-phase` and `/blu-quick` guidance.
- Run `npm ci` in the active worktree before runtime verification, then run `npm run typecheck` and targeted tests. Run full `npm test` if targeted tests pass.

## Assumptions

- This document-only execution creates `docs/build/STRUCTURED-ARTIFACT-MODEL-PLAN.md`.
- This planning document can be committed directly on `main` because the user explicitly approved a direct main doc update and push.
- No runtime behavior changes are included in this doc-only commit.
- Runtime implementation should happen in a later execution pass using the plan above.
