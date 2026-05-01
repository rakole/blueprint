# Phase 2: Bootstrap Router Config Audit - Research

**Researched:** 2026-05-01
**Domain:** Blueprint bootstrap routing, command catalog projection, config/readiness state
**Confidence:** HIGH

## Research Question

What does the executor need to know to audit Blueprint's foundational entrypoints and configuration/readiness substrate without applying source fixes?

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COV-01 | Bootstrap, router, config, help, progress, health, and map-first readiness behavior are audited. | Audit must start from `/blu`, `/blu-help`, `/blu-progress`, `/blu-next`, `/blu-new-project`, `/blu-map-codebase`, `/blu-health`, settings/profile, catalog, and config/state tool behavior. |
| NFIX-01 | No source, manifest, skill, test, build, generated asset, or runtime behavior fixes are applied. | Plans must be read-heavy and write only bug reports, bug index rows, summaries, and planning artifacts. |
| NFIX-02 | Temporary probe files are removed before completion and documented. | Probe-based verification should use temp dirs only and record cleanup in bug docs when used. |
| NFIX-03 | Git status is checked at phase boundaries. | Every plan must include a `git status --short` boundary check and separate unrelated changes from phase-owned bug docs. |

## Summary

Phase 2 should audit user-facing router/readiness outputs first, then trace any mismatch into the command catalog, command manifests, primary skills, required MCP tools, config normalization, state derivation, tests, and docs. The safest evidence path is to inspect current docs and source, run targeted existing tests when dependencies are installed, and create `docs/bugs/BPBUG-###-*.md` only for confirmed or likely defects. If no defect is found in a surface, update `docs/bugs/INDEX.md` Phase 2 slice coverage with the surfaces examined and mark the result as no bug found for that plan.

## Locked Decisions From Context

- D-01: Treat user-facing routing/help violations on `/blu`, `/blu-help`, `/blu-progress`, `/blu-next`, and direct `/blu-<cmd>` surfaces as primary Phase 2 defects.
- D-02: File a bug when a command is declared implemented but unroutable because required substrate is missing.
- D-03: File material docs-drift bugs even when routing output remains safe.
- D-04: Classify declared-implemented-but-unroutable findings as command catalog/status contract defects.
- D-05: Audit order starts with user-facing routing/help outputs and traces into catalog logic, manifests, skills, tools, and tests.
- D-06 through D-08: Use confirmed or likely evidence only; keep digging or drop suspected-only findings.
- D-09 through D-12: Map-first readiness is a hard gate: unmapped brownfield and mapping-incomplete route to `/blu-map-codebase`; mapped-only routes to `/blu-new-project`.

## Evidence Baseline

### Router And Readiness Contracts

- `docs/commands/root-router.md` requires `/blu` to use `blueprint_command_catalog`, `blueprint_project_status`, and `blueprint_config_get`, to prefer `/blu-map-codebase` for unmapped brownfield and `mapping-incomplete`, to prefer `/blu-new-project` for greenfield/scaffold-only and `mapped-only`, and to never recommend non-implemented commands.
- `docs/commands/help.md`, `docs/commands/progress.md`, and `docs/commands/next.md` repeat the implemented-only and waiting-state contract for read-only router commands.
- `commands/blu.toml`, `commands/blu-help.toml`, `commands/blu-progress.toml`, and `commands/blu-next.toml` contain prompt-level requirements for project status, catalog, config/state reads, map-first routing, and implemented-only guidance.

### Catalog And Runtime Projection

- `docs/COMMAND-CATALOG.md` is the declared command baseline. Runtime availability is derived in `src/mcp/tools/project.ts`, where `buildCommandCatalogEntry()` parses each row, verifies command spec, manifest, primary skill, and required MCP tools, and marks `implemented` only when `status === "implemented"`.
- `src/mcp/command-resources.ts` exposes runtime-contract resources only for implemented catalog entries and intentionally excludes `review` today. That exclusion can be valid only if docs, runtime reference, and tests consistently explain it.
- `tests/command-catalog.test.ts` checks implemented commands, required tools, aliases, runtime-contract projections, optional agents, and command-path helpers.

### Map-First And Next-Action Logic

- `blueprintProjectStatus()` in `src/mcp/tools/project.ts` distinguishes `uninitialized`, `mapping-incomplete`, `mapped-only`, `partial`, and `initialized`.
- For non-initialized states, `blueprintProjectStatus()` routes brownfield unmapped and `mapping-incomplete` to `/blu-map-codebase`, `mapped-only` to `/blu-new-project`, and `partial` to `/blu-health`.
- `deriveNextAction()` in `src/mcp/tools/state.ts` repeats the same early state routing and then derives phase lifecycle follow-ups only from implemented commands.
- `tests/help-progress-health.test.ts` contains fixtures for greenfield/scaffold-only, brownfield, mapping-incomplete, mapped-only, partial state, next discovery command selection, and waiting-state contract checks.

### Config And Governance

- `src/mcp/tools/config.ts` normalizes hardcoded defaults, optional user defaults, project config, model profiles, workflow flags, git branching templates, safety settings, and maintenance host paths.
- `.blueprint/config.json` is the runtime config in product docs; this repository's `.planning/config.json` is local GSD bookkeeping and must not be treated as Blueprint runtime state.
- `docs/commands/settings.md`, `docs/commands/set-profile.md`, and `docs/commands/health.md` define config repair, profile updates, malformed/defaults behavior, and health recovery expectations.

### Existing Tests To Reuse

- `tests/help-progress-health.test.ts`
- `tests/next.test.ts`
- `tests/new-project.test.ts`
- `tests/map-codebase.test.ts`
- `tests/command-catalog.test.ts`
- `tests/command-contract-docs.test.ts`

Targeted commands should be preferred during discovery:

```bash
npx tsx --test tests/help-progress-health.test.ts
npx tsx --test tests/next.test.ts
npx tsx --test tests/new-project.test.ts
npx tsx --test tests/map-codebase.test.ts
npx tsx --test tests/command-catalog.test.ts
npx tsx --test tests/command-contract-docs.test.ts
```

If `node_modules` is missing in a fresh worktree, run `npm ci` before any build, typecheck, or test command.

## Recommended Audit Shape

1. Router/readiness audit: compare user-facing `/blu`, `/blu-help`, `/blu-progress`, and `/blu-next` contracts against project/status/state implementations and existing tests.
2. Catalog/substrate audit: compare declared implemented commands against runtime catalog derivation, manifests, skills, required MCP tool registration, runtime-contract resource projection, and command catalog tests.
3. Bootstrap/config/governance audit: compare `new-project`, `map-codebase`, `settings`, `set-profile`, and `health` docs/manifests/skills against config and project-state tools.
4. Closeout: update `docs/bugs/INDEX.md` Phase 2 slice coverage, verify every Phase 2 finding has a bug file, and run `git status --short` to prove discovery-only boundaries.

## Validation Architecture

Phase 2 validation is artifact and evidence based, not source mutation based.

- Each plan must preserve no-fix discipline: writes are limited to `docs/bugs/*.md`, `docs/bugs/INDEX.md`, and Phase 2 planning/execution artifacts under `.planning/phases/02-bootstrap-router-config-audit/`.
- Each bug report must follow `docs/bugs/TEMPLATE.md` and cite concrete evidence from command outputs, test outputs, file paths, or docs/source contract mismatches.
- Each plan should run at least one targeted read/grep/test check over its assigned surfaces.
- Every plan must run `git status --short` before completion and document that no source, manifest, skill, test, build, generated asset, runtime `.blueprint/`, or host-global state changes were applied by the audit.
- If tests fail, the plan should classify whether the failure is the defect evidence, an environment/dependency problem, or unrelated pre-existing breakage.

## Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| Audit accidentally fixes a defect while inspecting it. | Plans forbid source, manifest, skill, test, build, generated asset, runtime `.blueprint/`, and host-global mutations. |
| Router defects are hidden by prompt-only behavior. | Require tracing from docs/manifests into MCP source and regression tests. |
| Weak suspected findings flood the bug index. | Apply D-06 through D-08: confirmed or likely only; drop low-evidence suspected findings. |
| `.planning/` state is mistaken for Blueprint runtime state. | Plans explicitly keep `.planning/` as GSD bookkeeping and `.blueprint/` as runtime state. |

## Deferrals

- Repairing any discovered defect is deferred to a later repair milestone.
- Broad lifecycle, review/shipping, workspace, packaging, and cross-cutting audits are deferred to Phases 3 through 8.

## Research Complete

Phase 2 can be planned from this research, the Phase 2 context, and the existing Phase 1 bug harness.
