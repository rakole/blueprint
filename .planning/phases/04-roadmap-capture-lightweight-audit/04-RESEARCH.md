# Phase 4: Roadmap Capture Lightweight Audit - Research

**Researched:** 2026-05-01
**Domain:** Blueprint roadmap administration, milestone closeout, capture, lightweight execution, and debug flows
**Confidence:** HIGH

## Research Question

What does the executor need to know to audit Blueprint's roadmap, milestone, capture, fast, quick, and debug command surfaces without applying source, manifest, skill, test, build, generated asset, runtime, installed-extension, host-global, or remote-service fixes?

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COV-03 | Roadmap administration, milestone flows, capture commands, lightweight execution, and debug are audited. | Audit slices must trace roadmap-admin, milestone report, capture, quick/fast, and debug commands from docs/manifests into skills, runtime references, MCP tools, report/index substrates, and focused tests. |
| NFIX-01 | No source, manifest, skill, test, build, generated asset, or runtime behavior fixes are applied. | Plans must be read-heavy and write only bug reports, bug index rows, summaries, and planning artifacts. |
| NFIX-02 | Temporary probe files are removed before completion and documented. | Runtime probes should use disposable temp roots only when static evidence and existing tests cannot settle a material ambiguity. |
| NFIX-03 | Git status is checked at phase boundaries. | Every plan must include a `git status --short` boundary check and separate unrelated user changes from phase-owned bug docs. |

## Summary

Phase 4 should audit five connected but separable surfaces. Start with roadmap mutation safety because the Phase 4 context explicitly selected preview parity, destructive-gate rigor, partial-failure recovery, and authoritative state routing as high-value audit targets. Then audit milestone reports, capture and backlog promotion, lightweight execution, and debug. The strongest evidence path is static contract review plus targeted existing tests: command specs, TOML manifests, primary skills, command-specific runtime references, `docs/MCP-TOOLS.md`, `docs/RUNTIME-REFERENCE.md`, `src/mcp/tools/phase.ts`, `src/mcp/tools/artifacts.ts`, and focused metadata/tool tests. If a defect is confirmed or likely, create one `docs/bugs/BPBUG-###-*.md` report using the established template and update the index. If a slice finds no defect, record the no-defect result in that plan's summary and final Phase 4 index row.

## Locked Decisions From Context

- D-01: Roadmap mutation previews should reflect the same MCP mutation substrate as real writes wherever practical.
- D-02: Destructive or high-risk roadmap operations need ordinary confirmation plus a second destructive confirmation when execution evidence, phase artifacts, renumbering, deletion, archival, or rewrite risk exists.
- D-03: Multi-file partial-failure gaps count as Phase 4 bugs when roadmap, phase directory, artifact filename, or state consistency can be lost without rollback, retry, or clear recovery guidance.
- D-04: Roadmap mutations must update state through MCP-owned paths and route from returned concrete phase numbers and paths, not prose-derived guesses.
- D-05: Preserve the Phase 2 and Phase 3 evidence bar: prefer confirmed or likely findings with concrete file, command, test, or contract evidence.
- D-06: Use static contract review plus targeted existing tests before any disposable runtime probe.
- D-07: Preserve the discovery-only boundary. Audit findings may create or update planning docs and `docs/bugs/*.md`, but must not repair Blueprint runtime behavior.

## Evidence Baseline

### Roadmap Mutation Commands

- `docs/commands/add-phase.md`, `insert-phase.md`, `remove-phase.md`, and `plan-milestone-gaps.md` define expected reads, previews, confirmations, MCP mutations, scaffold behavior, and follow-up routing.
- `commands/blu-add-phase.toml`, `blu-insert-phase.toml`, `blu-remove-phase.toml`, and `blu-plan-milestone-gaps.toml` should keep prompts thin and require the same MCP tools named in the specs and skill.
- `skills/blueprint-roadmap-admin/SKILL.md` requires roadmap reads first, MCP-owned roadmap mutation, returned values as authoritative, implemented-only follow-up routing, and second confirmation for force-style removal.
- `skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md` and `insert-phase-runtime-contract.md` are richer contracts for the two shipped append/insert paths.
- `src/mcp/tools/phase.ts` owns `blueprintRoadmapAddPhase`, `blueprintRoadmapInsertPhase`, `blueprintRoadmapRemovePhase`, and `blueprintRoadmapPromoteBacklog`.
- `tests/roadmap-tools.test.ts`, `tests/add-phase-metadata.test.ts`, `tests/insert-phase-metadata.test.ts`, `tests/remove-phase-metadata.test.ts`, and `tests/plan-milestone-gaps-metadata.test.ts` are the focused first-pass evidence set.

### Milestone Report And Carry-Forward Commands

- `docs/commands/audit-milestone.md`, `complete-milestone.md`, `milestone-summary.md`, and `new-milestone.md` define report-driven milestone evidence and carry-forward behavior.
- The roadmap-admin skill requires `blueprint_artifact_contract_read`, `blueprint_artifact_summary_digest`, `blueprint_artifact_report_write`, `blueprint_state_load`, `blueprint_state_update`, and `blueprint_artifact_scaffold` for these paths.
- `tests/audit-milestone-tools.test.ts` exercises milestone report write, digest, derived milestone readiness, and routing behavior.
- Metadata tests cover command manifest, skill, and runtime-reference alignment for each milestone command.

### Capture And Backlog Promotion Commands

- `docs/commands/note.md`, `add-todo.md`, `check-todos.md`, `add-backlog.md`, `review-backlog.md`, and `explore.md` define project-local capture, duplicate handling, todo status updates, backlog promotion, and ideation routing.
- `skills/blueprint-capture/SKILL.md` requires `blueprint_artifact_mutate_index` for notes, todos, and backlog rows, `blueprint_roadmap_promote_backlog` for promotion previews and applies, `blueprint_roadmap_add_phase` only for confirmed roadmap-ready explore results, and returned ids as authoritative.
- `src/mcp/tools/artifacts.ts` owns `blueprintArtifactMutateIndex`; `src/mcp/tools/phase.ts` owns `blueprintRoadmapPromoteBacklog`.
- `tests/capture-tools.test.ts`, capture metadata tests, and `tests/roadmap-tools.test.ts` provide focused coverage for duplicates, reserved stubs, todo status changes, backlog promotion, and safe degradation.

### Fast And Quick Commands

- `docs/commands/fast.md` locks `/blu-fast` to trivial inline execution, no subagents, no tracker layer, no durable report, and optional state refresh only in initialized projects.
- `docs/commands/quick.md` locks `/blu-quick` to bounded quick execution, optional depth gates, durable `quick-run-latest` report persistence, and refusal to impersonate saved planning or multi-wave execution.
- `skills/blueprint-phase-execution/SKILL.md`, `references/fast-runtime-contract.md`, and `references/quick-runtime-contract.md` define the detailed execution-family boundaries.
- `tests/fast-metadata.test.ts`, `tests/quick-metadata.test.ts`, `tests/lightweight-execution-regression.test.ts`, and quick-report cases in `tests/lifecycle-pilot-integration.test.ts` are the strongest existing evidence leads.

### Debug Command

- `docs/commands/debug.md` and `skills/blueprint-debug/SKILL.md` require a concrete issue statement, diagnose-only boundaries, durable `debug-latest` report persistence, explicit follow-up gating before todo capture or fix attempts, and implemented-only routing.
- `blueprint_artifact_report_write`, `blueprint_artifact_mutate_index`, and `blueprint_state_update` are the required persistence tools.
- `tests/debug-metadata.test.ts`, `tests/lightweight-execution-regression.test.ts`, `tests/artifact-contracts.test.ts`, and debug-report cases in `tests/lifecycle-pilot-integration.test.ts` are the focused evidence set.

## Existing Tests To Reuse

Prefer these targeted commands during discovery:

```bash
npx tsx --test tests/roadmap-tools.test.ts tests/add-phase-metadata.test.ts tests/insert-phase-metadata.test.ts tests/remove-phase-metadata.test.ts tests/plan-milestone-gaps-metadata.test.ts
npx tsx --test tests/audit-milestone-tools.test.ts tests/audit-milestone-metadata.test.ts tests/complete-milestone-metadata.test.ts tests/milestone-summary-metadata.test.ts tests/new-milestone-metadata.test.ts
npx tsx --test tests/capture-tools.test.ts tests/note-metadata.test.ts tests/add-todo-metadata.test.ts tests/check-todos-metadata.test.ts tests/add-backlog-metadata.test.ts tests/review-backlog-metadata.test.ts tests/explore-metadata.test.ts
npx tsx --test tests/fast-metadata.test.ts tests/quick-metadata.test.ts tests/lightweight-execution-regression.test.ts
npx tsx --test tests/debug-metadata.test.ts tests/lightweight-execution-regression.test.ts
```

Run `npm ci` first only in a fresh worktree with missing `node_modules`. If a targeted test cannot run because of dependency or environment issues, record the blocker honestly in the summary.

## Recommended Audit Shape

1. Roadmap mutation safety: add, insert, remove, and plan-milestone-gaps, with special focus on D-01 through D-04.
2. Milestone reports and carry-forward: audit-milestone, complete-milestone, milestone-summary, and new-milestone.
3. Capture and promotion: note, add-todo, check-todos, add-backlog, review-backlog, and explore.
4. Lightweight execution: fast and quick boundaries, quick report persistence, and state routing.
5. Debug and closeout: debug diagnosis/report/follow-up behavior, Phase 4 bug index reconciliation, and no-fix boundary.

## Validation Architecture

Phase 4 validation is artifact and evidence based, not source mutation based.

- Each plan must preserve no-fix discipline: writes are limited to `docs/bugs/*.md`, `docs/bugs/INDEX.md`, and Phase 4 planning/execution artifacts under `.planning/phases/04-roadmap-capture-lightweight-audit/`.
- Each bug report must follow `docs/bugs/TEMPLATE.md` and cite concrete evidence from command outputs, test outputs, file paths, line-level references where useful, or docs/source contract mismatches.
- Each plan should run at least one targeted Phase 4 test command or document why it could not run.
- Every plan must run `git status --short` before completion and document that no source, manifest, skill, test, build, generated asset, runtime `.blueprint/`, installed extension, host-global, or remote-service changes were applied by the audit.
- If tests fail, classify whether the failure is defect evidence, an environment/dependency problem, or unrelated pre-existing breakage.

## Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| The audit repairs a roadmap or capture defect instead of documenting it. | Plans forbid source, manifest, skill, test, build, generated asset, runtime `.blueprint/`, installed-extension, host-global, and remote-service mutations. |
| Preview/confirm bugs are missed because only docs are read. | Roadmap mutation plans trace specs and manifests into `src/mcp/tools/phase.ts` and focused tool tests. |
| Capture duplicate and status behavior is inferred from prompts only. | Capture plans read `blueprintArtifactMutateIndex` and `tests/capture-tools.test.ts` before conclusions. |
| Quick/debug investigations drift into implementation. | Lightweight execution and debug plans audit command contracts and tests only; any actual fix stays deferred to a later repair milestone. |

## Deferrals

- Repairing any discovered Phase 4 defect is deferred to a later repair milestone.
- Review, security, docs-update, impact, shipping, undo, workspace, maintenance, packaging, and cross-cut drift surfaces are deferred to Phases 5 through 8 unless directly needed as evidence for a Phase 4 defect.

## Research Complete

Phase 4 can be planned from this research, the Phase 4 context, and the existing Phase 1 bug-reporting harness.
