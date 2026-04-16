---
name: blueprint-roadmap-admin
description: >
  Roadmap append, milestone audits, and future roadmap or milestone mutations
  for Blueprint project state. Use this skill to keep roadmap changes
  deterministic, evidence-backed, and MCP-owned.
status: implemented
commands:
  - /blu-add-phase
  - /blu-insert-phase
  - /blu-remove-phase
  - /blu-plan-milestone-gaps
  - /blu-audit-milestone
  - /blu-complete-milestone
  - /blu-milestone-summary
  - /blu-new-milestone
---

# Blueprint Roadmap Admin Skill

## Purpose

Orchestrate Blueprint roadmap and milestone management flows so phase mutations, milestone evidence, and archival decisions stay aligned with durable project state.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Only invoke optional subagents when the current command contract explicitly allows them.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.

## Parity Goal

Carry forward the useful roadmap and milestone intent while preserving Blueprint's host-native boundaries:

- roadmap reads happen before roadmap or milestone mutations
- new phases require an explicit description and deterministic numbering
- milestone audits compare original intent against saved phase evidence
- milestone reports stay durable and project-local in `.blueprint/reports/`
- milestone closeout stays report-driven and state-driven unless a later MCP substrate proves a stronger mutation path is necessary
- follow-up routing stays inside the implemented Blueprint surface
- persistent writes remain scoped to `.blueprint/`

## Required Inputs

- `docs/commands/add-phase.md`
- `docs/commands/insert-phase.md`
- `docs/commands/remove-phase.md`
- `docs/commands/plan-milestone-gaps.md`
- `docs/commands/audit-milestone.md`
- `docs/commands/complete-milestone.md`
- `docs/commands/milestone-summary.md`
- `docs/commands/new-milestone.md`
- `docs/COMMAND-CATALOG.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/RUNTIME-REFERENCE.md`

## Required MCP Tools

- `blueprint_roadmap_read`
- `blueprint_roadmap_add_phase`
- `blueprint_roadmap_insert_phase`
- `blueprint_artifact_list`
- `blueprint_roadmap_remove_phase`
- `blueprint_artifact_scaffold`
- `blueprint_state_update`
- `blueprint_phase_summary_index`
- `blueprint_artifact_summary_digest`
- `blueprint_artifact_report_write`

## Optional Agents

- `blueprint-roadmapper`
- `blueprint-verifier`

## Shared MCP Contracts

- `blueprint_roadmap_add_phase` and `blueprint_roadmap_insert_phase`: pass only the phase description plus the integer `after` anchor for insertion. Do not precompute phase numbers, slugs, or directory paths; use returned `phaseNumber`, `phasePrefix`, and `phaseDir` as authoritative.
- `blueprint_artifact_scaffold`: pass only supported repo-relative Blueprint artifact paths. Use the scaffold to seed starter docs or `XX-CONTEXT.md`, not as the final authored milestone or phase content.
- `blueprint_artifact_summary_digest`: pass repo-relative `artifactPaths` only, and treat `inputsUsed` as the authoritative digest scope.
- `blueprint_artifact_report_write`: pass a bare report name such as `milestone-audit-v1` or `milestone-summary-v2`, not a `.blueprint/reports/...` path. Use the returned `path` as authoritative.

## Workflow Rules

### `add-phase`

1. Require a non-empty phase description before any mutation.
2. Read the roadmap first and stop with recovery guidance if the roadmap is missing or malformed.
3. Require explicit confirmation before appending the phase.
4. Choose the next phase number from the highest base phase number already present in the roadmap and ignore decimal suffixes when counting.
5. Persist the roadmap mutation through `blueprint_roadmap_add_phase`; do not rewrite `.blueprint/ROADMAP.md` directly from the command prompt.
6. Scaffold the new phase directory through `blueprint_artifact_scaffold` by seeding the initial `XX-CONTEXT.md` file.
7. Update `STATE.md` through `blueprint_state_update` so the new phase becomes current and the next safe implemented follow-up is `/blu-discuss-phase <phase>`.
8. Keep follow-up routing inside implemented Blueprint commands only.

### `insert-phase`

1. Require an explicit integer phase number and a non-empty phase description before any mutation.
2. Read the roadmap first and stop with recovery guidance if the roadmap is missing or malformed.
3. Require explicit confirmation before inserting the decimal phase, and preview the computed decimal number plus the fact that later phases will not be renumbered automatically.
4. Persist the roadmap mutation through `blueprint_roadmap_insert_phase`; do not rewrite `.blueprint/ROADMAP.md` or hand-create phase directories directly from the command prompt.
5. Treat integer-only targets as mandatory and reject decimal targets.
6. Keep numbering roadmap-driven: derive the next decimal from the existing roadmap entries under that integer base and fail fast when a conflicting decimal directory already exists on disk.
7. Scaffold the inserted phase directory through `blueprint_artifact_scaffold` by seeding the initial `XX-CONTEXT.md` file.
8. Update `STATE.md` through `blueprint_state_update` so the inserted decimal phase becomes current and the next safe implemented follow-up is `/blu-discuss-phase <phase>`.
9. Keep follow-up routing inside implemented Blueprint commands only.

### `remove-phase`

1. Require an explicit phase number before any mutation.
2. Read the roadmap first and stop with recovery guidance if the roadmap is missing or malformed.
3. Read the target phase artifacts before mutation so drift or execution evidence is visible in the preview.
4. Require explicit confirmation before deleting the target phase and renumbering subsequent phases.
5. Persist the roadmap mutation through `blueprint_roadmap_remove_phase`; do not rewrite `.blueprint/ROADMAP.md` or rename phase directories directly from the command prompt.
6. Treat the future-phase guard as mandatory and reject targets that already have execution evidence such as `SUMMARY`, `VERIFICATION`, or `UAT` artifacts.
7. Update `STATE.md` through `blueprint_state_update` so `/blu-remove-phase` is the active command and the next safe implemented follow-up is `/blu-progress`.
8. Keep follow-up routing inside implemented Blueprint commands only.

### `audit-milestone`

1. Read the roadmap before making milestone claims or writing milestone reports.
2. Keep milestone audits grounded in saved roadmap and phase evidence instead of chat memory.
3. Require explicit overwrite confirmation before replacing an existing milestone audit report.
4. Use `blueprint_artifact_summary_digest` with explicit milestone artifact paths when the command needs a compact roadmap-plus-evidence digest.
5. Use `blueprint-verifier` when a second-pass evidence review helps explain gaps or stale assumptions.
6. Keep milestone report output project-local in `.blueprint/reports/` through `blueprint_artifact_report_write`. Pass a bare report name and rely on the returned `path` instead of hand-building the report filename.
7. If the audit surfaces actionable gaps and `plan-milestone-gaps` is implemented, route the follow-up there; otherwise treat planned-only milestone follow-up commands as unavailable.

### `plan-milestone-gaps`

1. Read the roadmap first and then inspect `.blueprint/reports/` through `blueprint_artifact_list` so the command stays grounded in the latest milestone audit instead of chat memory.
2. Fail fast when the matching milestone audit report is missing or when the audit contains no actionable gaps.
3. Use `blueprint_artifact_summary_digest` with explicit roadmap-plus-audit inputs to build a compact evidence view before proposing any new phases.
4. Preserve the locked gap-closure intent by grouping related requirement, integration, and flow gaps into a few coherent roadmap phases rather than adding one phase per gap.
5. Keep the grouping reviewable: show which gaps each proposed phase closes and separate optional nice-to-have gaps from must-close work.
6. Require one explicit confirmation before any roadmap mutation.
7. Append each approved gap-closure phase through repeated `blueprint_roadmap_add_phase` calls; do not rewrite `.blueprint/ROADMAP.md` directly from the command prompt.
8. Update `STATE.md` through `blueprint_state_update` so the first new gap-closure phase becomes current and the next safe implemented follow-up is `/blu-discuss-phase <phase>`.
9. Keep follow-up routing inside implemented Blueprint commands only.

### `complete-milestone`

1. Read the roadmap first and then inspect `.blueprint/reports/` through `blueprint_artifact_list` so the closeout step stays grounded in the saved audit report instead of chat memory.
2. Fail fast when the matching milestone audit report is missing. Route the user to `/blu-audit-milestone` instead of inventing closeout evidence.
3. Use `blueprint_artifact_summary_digest` with explicit roadmap-plus-audit inputs to build a compact evidence view before writing the completion report.
4. Keep `complete-milestone` report-driven and state-driven. Do not rewrite `.blueprint/ROADMAP.md`, renumber phases, or invent a new `phase_mark_complete` substrate from the command prompt.
5. Persist the completion report project-local in `.blueprint/reports/` through `blueprint_artifact_report_write`. Pass a bare report name and rely on the returned `path` instead of hand-building the report filename.
6. Require explicit overwrite confirmation before replacing an existing milestone completion report.
7. Update `STATE.md` through `blueprint_state_update` so `/blu-complete-milestone` is the active command and the next safe implemented follow-up is `/blu-milestone-summary <milestone>`.
8. Keep follow-up routing inside implemented Blueprint commands only.

### `milestone-summary`

1. Read the roadmap first and inspect `.blueprint/reports/` through `blueprint_artifact_list` so the summary stays grounded in the matching milestone audit and completion reports.
2. Fail fast when either the audit report or completion report is missing. Route the user to `/blu-audit-milestone` or `/blu-complete-milestone` instead of fabricating missing inputs.
3. Use `blueprint_artifact_summary_digest` with explicit roadmap-plus-report inputs to build the milestone summary from durable evidence.
4. Persist the summary report project-local in `.blueprint/reports/` through `blueprint_artifact_report_write`. Pass a bare report name and rely on the returned `path` instead of hand-building the report filename.
5. Require explicit overwrite confirmation before replacing an existing milestone summary report.
6. Keep the flow skill-led. Do not pull in `blueprint-doc-writer` or any later-wave docs agent for this Wave 2 summary step.
7. Update `STATE.md` through `blueprint_state_update` so `/blu-milestone-summary` is the active command and the next safe implemented follow-up is `/blu-new-milestone`.
8. Keep follow-up routing inside implemented Blueprint commands only.

### `new-milestone`

1. Read the roadmap first and derive the next milestone starter context from the saved milestone summary through `blueprint_artifact_summary_digest`.
2. Treat carry-forward as the default mode. Only switch to a fresh reset when the user explicitly asks for it.
3. Use `blueprint-roadmapper` only when grouped carry-forward synthesis helps sharpen the next milestone's starter scope; the command still owns the final write path.
4. Regenerate starter docs through `blueprint_artifact_scaffold` with an explicit carry-forward seed. Do not hand-edit `PROJECT.md`, `REQUIREMENTS.md`, or `ROADMAP.md` from the command prompt.
5. Preserve historical phase directories. Do not delete or renumber earlier milestone artifacts as part of `new-milestone`.
6. Start the new milestone at the next whole-number phase and scaffold the first phase context artifact so `/blu-discuss-phase <first phase>` has a valid target directory.
7. Require explicit overwrite confirmation before replacing the existing starter docs.
8. Update `STATE.md` through `blueprint_state_update` so the first carried-forward phase becomes current and the next safe implemented follow-up is `/blu-discuss-phase <first phase>`.
9. Keep follow-up routing inside implemented Blueprint commands only.

## Wave 2 Closeout Guardrail

- `insert-phase` is now shipped through its dedicated roadmap MCP substrate; keep later roadmap and post-Wave-2 surfaces blocked until their own runtime contracts exist.
- Do not promote `complete-milestone`, `milestone-summary`, or `new-milestone` by docs alone; they become routable only when the manifest, primary skill, and required MCP tools all exist.

## Output Style

- For `add-phase`, report the new phase number and description plainly, mention the scaffolded phase path and any reuse warnings, and end with the next safe implemented action.
- For `insert-phase`, report the inserted decimal phase plainly, mention the anchor integer phase, call out any directory reuse or detail-order warnings, and end with the next safe implemented action.
- For `plan-milestone-gaps`, show the grouped gap-closure phases compactly, call out any deferred optional gaps, and end with the first safe implemented follow-up.
- For `remove-phase`, report the removed phase plainly, summarize any renumbered phases or drift warnings, and end with the next safe implemented action.
- For `plan-milestone-gaps`, show the grouped gap-closure phases compactly, call out any deferred optional gaps, and end with the first safe implemented follow-up.
- For `audit-milestone`, call out the original milestone intent, the evidence that confirms or weakens it, any gaps, and the next safe implemented action.
- For `complete-milestone`, report the milestone resolved, the audit report used, whether the completion report was created or replaced, and the next safe implemented action.
- For `milestone-summary`, report the milestone resolved, the source reports used, whether the summary report was created or replaced, and the next safe implemented action.
- For `new-milestone`, report the new milestone name, whether the flow used carry-forward or explicit reset, the first new phase scaffolded, and the next safe implemented action.
