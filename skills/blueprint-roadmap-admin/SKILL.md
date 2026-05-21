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
input_bundles:
  shared: []
  commands:
    "/blu-add-phase":
      - skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md
    "/blu-insert-phase":
      - skills/blueprint-roadmap-admin/references/insert-phase-runtime-contract.md
    "/blu-remove-phase":
      - commands/blu-remove-phase.toml
    "/blu-plan-milestone-gaps":
      - commands/blu-plan-milestone-gaps.toml
    "/blu-audit-milestone":
      - commands/blu-audit-milestone.toml
    "/blu-complete-milestone":
      - commands/blu-complete-milestone.toml
    "/blu-milestone-summary":
      - commands/blu-milestone-summary.toml
    "/blu-new-milestone":
      - commands/blu-new-milestone.toml
---

# Blueprint Roadmap Admin Skill

## Purpose

Orchestrate Blueprint roadmap and milestone management flows so phase mutations, milestone evidence, and archival decisions stay aligned with durable project state.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Before optional delegation, read effective config with `mcp_blueprint_blueprint_config_get`. Call same-named Gemini CLI agent tools only when the current command contract explicitly allows them, `workflow.subagents` is enabled, the same-named tool is available in the current host session, and the task benefits from bounded roadmap or milestone analysis. Do not read, inline, or load separate agent source before delegation; otherwise use the command's no-subagent fallback and state the fallback reason.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.
- Load only the active command's structured `input_bundles.commands[...]` inputs when one is present; roadmap-admin commands do not use docs as active runtime inputs.

## Parity Goal

Carry forward the useful roadmap and milestone intent while preserving Blueprint's host-native boundaries:

- roadmap reads happen before roadmap or milestone mutations
- new phases require an explicit description and deterministic numbering
- milestone audits compare original intent against saved phase evidence
- milestone reports stay durable and project-local in `.blueprint/reports/`
- milestone closeout stays report-driven and state-driven unless a later MCP substrate proves a stronger mutation path is necessary
- follow-up routing stays inside the implemented Blueprint surface
- persistent writes remain scoped to `.blueprint/`

## Runtime Inputs

Roadmap-admin commands resolve active inputs from the structured `input_bundles` frontmatter:

- `/blu-add-phase`: `skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md`
- `/blu-insert-phase`: `skills/blueprint-roadmap-admin/references/insert-phase-runtime-contract.md`
- `/blu-remove-phase`: `commands/blu-remove-phase.toml`
- `/blu-plan-milestone-gaps`: `commands/blu-plan-milestone-gaps.toml`
- `/blu-audit-milestone`: `commands/blu-audit-milestone.toml`
- `/blu-complete-milestone`: `commands/blu-complete-milestone.toml`
- `/blu-milestone-summary`: `commands/blu-milestone-summary.toml`
- `/blu-new-milestone`: `commands/blu-new-milestone.toml`

The earlier repository-doc-backed Required Inputs list is retained only in repository history. It is intentionally not a parsed section of this skill, so runtime skill input resolution cannot activate internal documentation paths for roadmap-admin commands.

## Required MCP Tools

- `blueprint_roadmap_read`
- `blueprint_roadmap_add_phase`
- `blueprint_roadmap_insert_phase`
- `blueprint_artifact_list`
- `blueprint_roadmap_remove_phase`
- `blueprint_artifact_scaffold`
- `blueprint_state_update`
- `blueprint_phase_locate`
- `blueprint_state_load`
- `blueprint_phase_summary_index`
- `blueprint_artifact_summary_digest`
- `blueprint_config_get`
- `blueprint_artifact_report_write`
- `blueprint_artifact_contract_read`

## Optional Agents

- `blueprint-roadmapper`
- `blueprint-verifier`

## No-Subagent Parity

When a roadmap-admin command allows an optional Blueprint agent tool and that
same-named tool is unavailable, disabled, or unnecessary, the parent command keeps the
same evidence depth, confirmation discipline, and output quality by working one
isolated roadmap or milestone unit at a time, compressing carry-forward context
after each completed unit, and finishing through the same MCP-owned write path.

For `/blu-new-milestone`, keep `roadmapperMode` explicit as `used`,
`skipped-disabled`, `skipped-unnecessary`, or `unavailable-fallback`. The
inline fallback must produce the same result shape as the delegated path:
`provisionalOrderedProposals`, `coverageNotes`, `blockers`, `warnings`,
`assumptions`, `confidence`, and `relativeFirstPhaseRecommendation`.

Do not swap in browser-only, web-search-only, shell-only, or generic helper
substitutes for the same-named `blueprint-roadmapper` or `blueprint-verifier`
Gemini CLI agent tools.

## Shared MCP Contracts

- `blueprint_roadmap_add_phase` and `blueprint_roadmap_insert_phase`: for add-phase, pass the phase description plus confirmed durable `requirementIds`, concrete `goal`, and 2-5 item `successCriteria`; for insertion, pass the integer `after` anchor, description, concrete `goal`, 2-5 item `successCriteria`, and confirmed durable `requirementIds` declared in `.blueprint/REQUIREMENTS.md`. Do not precompute phase numbers, slugs, or directory paths; use returned `phaseNumber`, `phasePrefix`, and `phaseDir` as authoritative. Do not use `none yet`, placeholder text, blank values, or undeclared IDs as requirement grounding.
- `blueprint_artifact_scaffold`: pass only supported repo-relative Blueprint artifact paths. Use the scaffold to seed starter docs or `XX-CONTEXT.md`, not as the final authored milestone or phase content.
- `blueprint_artifact_summary_digest`: pass repo-relative `artifactPaths` only, and treat `inputsUsed` as the authoritative digest scope.
- `blueprint_artifact_report_write`: pass a bare report name such as `milestone-audit-v1` or `milestone-summary-v2`, not a `.blueprint/reports/...` path. Use the returned `path` as authoritative.
- `blueprint_artifact_contract_read`: use it before authoring any report-family milestone artifact with a canonical runtime contract such as `report.milestone-audit`, `report.milestone-complete`, or `report.milestone-summary`, and before seeding the first carried-forward `phase.context` artifact for `new-milestone`.

## Workflow Rules

Execution profile for `/blu-add-phase`, `/blu-insert-phase`, `/blu-remove-phase`, `/blu-plan-milestone-gaps`, `/blu-audit-milestone`, `/blu-complete-milestone`, `/blu-milestone-summary`, and `/blu-new-milestone`: `interactive-read`.

In-flight status fields for this roadmap-admin family: resolved scope, active stage, pending gate, execution mode, next safe action.

Treat roadmap-admin commands as short, bounded roadmap or report work, not as long-running orchestration. Do not use `update_topic`, `write_todos`, or tracker tools to make these commands look like lifecycle, review, or maintenance runs. When a roadmap-admin command needs confirmation, prefer Gemini's `ask_user` tool when a structured confirmation helps; otherwise keep the same decision boundary explicit in prose.

For `/blu-add-phase`, `/blu-insert-phase`, and `/blu-new-milestone`, keep the same shared phase-admin spine: roadmap read first, exact preview packet with source scope plus target phase plus requirement grounding, named confirmation before mutation, safe default as stop-without-writing, named in-flight receipt that binds the approved preview to later MCP arguments, MCP-only persistence, starter-only context scaffolding, state update after scaffold, `/blu-discuss-phase` follow-up routing after successful writes, `/blu-progress` decline routing when a safe route is needed, and no tracker-backed or planned-only shortcuts.

For those same three commands, return command-specific completion receipts in the response only. Do not create `.blueprint/receipts`, `.blueprint/runs`, host-global receipt state, or any other new write surface for receipt storage.

### `add-phase`

Load `skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md` as the richer local runtime contract for this command. The summary below is the quick checklist; the reference owns the detailed stage mapping, required MCP call controls, stale-confirmation behavior, no-subagent fallback, retry rules, and output-quality criteria.

1. Require a non-empty phase description before any mutation.
2. Read the roadmap first and stop with recovery guidance if the roadmap is missing or malformed.
3. Preview the exact next integer phase number from the roadmap read result, ignoring decimal suffixes, then require explicit `ask_user` confirmation before appending the phase.
4. Choose at least one durable requirement ID declared in `.blueprint/REQUIREMENTS.md`, capture a concrete roadmap objective plus 2-5 observable success criteria, preview them with the phase number and requirement source, and persist the roadmap mutation through `blueprint_roadmap_add_phase` with the confirmed number in `expectedPhaseNumber` plus the confirmed `requirementIds`, `goal`, and `successCriteria`; do not rewrite `.blueprint/ROADMAP.md` directly from the command prompt. Plain add-phase must validate `requirementIds` against declared `.blueprint/REQUIREMENTS.md` rows before mutation. Keep audit-backed repair traceability separate in `auditBackedDetails.repairRequirementIds` instead of weakening the plain-append requirement check.
5. The preview packet must include `expectedPhaseNumber`, description, declared requirement IDs, requirement source, objective, 2-5 success criteria, source warnings, scaffold target, and `Safe default: stop without writing`. Treat `phase-number-confirmation` as the named receipt that binds those approved fields to the later mutation arguments. If the user declines, stop without writing and point to `/blu-progress` when a safe route is needed.
6. Treat returned `phaseNumber`, `phasePrefix`, `phaseName`, `slug`, and `phaseDir` as authoritative, and scaffold `${phaseDir}/${phasePrefix}-CONTEXT.md` through `blueprint_artifact_scaffold`.
7. Return a compact starter handoff before the route instruction: returned phase number and title, declared requirement IDs, confirmed objective, success criteria, source refs, and open items for discuss-phase.
8. Do not treat scaffold text or the starter handoff as finished phase context; route to `/blu-discuss-phase <phase>` so the context is authored by the discovery workflow.
9. Keep the handoff compact starter seed only. `/blu-add-phase` must not author final `XX-CONTEXT.md`, `/blu-plan-phase`, or `/blu-execute-phase` output.
10. Return the add-phase completion receipt in the same response with the approved `phaseNumber`, returned phase metadata, declared `requirementIds`, confirmed `goal`, `successCriteriaCount`, `roadmapPath`, `contextScaffoldPath`, `stateRoute`, `safeRetry`, and `warnings`.
11. Keep recovery wording explicit in the response: mutation not attempted is safe to rerun after blocker resolution; roadmap mutation plus scaffold failure must report the successful roadmap path and exact scaffold blocker without hand-writing context; scaffold success plus state-update failure must route to `/blu-progress` without hand-editing `STATE.md`; same preview plus same returned files may reuse when the tool reports `reused`; changed params or files under the same confirmation token must block as stale or require manual recovery.
12. Add-phase-specific recovery must also stay explicit: stale `expectedPhaseNumber` requires a roadmap re-read and fresh preview; undeclared `requirementIds` must list the missing IDs; missing returned metadata must block and surface the tool error instead of guessing.
13. Update `STATE.md` through `blueprint_state_update` only after scaffold succeeds so the new phase becomes current, `/blu-add-phase` is the active command, and the next safe implemented follow-up is `/blu-discuss-phase <phase>`.
14. Keep follow-up routing inside implemented Blueprint commands only.
15. Keep the flow skill-led. There is no add-phase subagent path; browser, web-search-only, shell-only, or generic agents are not substitutes for roadmap-admin analysis.

### `insert-phase`

Load `skills/blueprint-roadmap-admin/references/insert-phase-runtime-contract.md` as the richer local runtime contract for this command. The summary below is the quick checklist; the reference owns the detailed stage mapping, required MCP call controls, artifact scaffold rules, no-subagent fallback, retry rules, output-quality criteria, and completion criteria.

1. Require an explicit integer phase number and a non-empty phase description before any mutation.
2. Read the roadmap first and stop with recovery guidance if the roadmap is missing or malformed.
3. Require explicit confirmation before inserting the decimal phase, and prefer Gemini CLI `ask_user` for that confirmation gate when available instead of prose-only confirmation.
4. The preview packet must include the integer anchor, next decimal candidate, declared requirement IDs, concrete roadmap objective, 2-5 observable success criteria, a no-renumbering acknowledgment, a dependency-review note, the scaffold target, and `Safe default: stop without writing`. Treat `phase-insert-confirmation` as the named receipt that binds those approved fields to the later mutation arguments. If the user declines, stop without writing and point to `/blu-progress` when a safe route is needed.
5. Persist the roadmap mutation through `blueprint_roadmap_insert_phase` with the confirmed `goal`, `successCriteria`, and confirmed durable `requirementIds`; do not rewrite `.blueprint/ROADMAP.md` or hand-create phase directories directly from the command prompt.
6. Treat integer-only targets as mandatory and reject decimal targets.
7. Reject `none yet`, placeholder text, blank values, or requirement IDs not declared in `.blueprint/REQUIREMENTS.md`; inserted phases must have durable requirement grounding before mutation.
8. Reject confirmed requirement IDs that are already mapped to another roadmap phase; insertion must not reuse another phase's requirement traceability note.
9. Keep numbering roadmap-driven: derive the next decimal from the existing roadmap entries under that integer base and fail fast when a conflicting decimal directory already exists on disk.
10. Scaffold the inserted phase directory through `blueprint_artifact_scaffold` by seeding the initial `XX-CONTEXT.md` file at `${phaseDir}/${phasePrefix}-CONTEXT.md`.
11. Return a compact starter handoff before the route instruction: decimal phase number and title, anchor phase, declared requirement IDs, no-renumbering and dependency-review note, roadmap evolution note summary, and open risks plus dependency questions.
12. Return the insert-phase completion receipt in the same response with the integer `anchor`, inserted decimal `phaseNumber`, returned phase metadata, `requirementMappingStatus`, `requirementsPath`, `roadmapPath`, `contextScaffoldPath`, `stateRoute`, the no-renumbering note, `safeRetry`, and `warnings`.
13. Keep recovery wording explicit in the response: mutation not attempted is safe to rerun after blocker resolution; roadmap mutation plus scaffold failure must report the successful roadmap path and exact scaffold blocker without hand-writing context; scaffold success plus state-update failure must route to `/blu-progress` without hand-editing `STATE.md`; same preview plus same returned files may reuse when the tool reports `reused`; changed params or files under the same confirmation token must block as stale or require manual recovery.
14. Insert-phase-specific recovery must also stay explicit: invalid non-integer anchors return an error; declared-ID failures list the failed IDs; already-mapped IDs list the conflicting phases; conflicting decimal directories block with the exact conflict; dependency-review warnings stay visible in receipt `warnings`.
15. Update `STATE.md` through `blueprint_state_update` only after scaffold succeeds so the inserted decimal phase becomes current, add a durable `roadmapEvolutionNotes` entry that records the urgent insertion after the integer anchor, and set the next safe implemented follow-up to `/blu-discuss-phase <phase>`.
16. Keep follow-up routing inside implemented Blueprint commands only.
17. Keep the flow skill-led. There is no insert-phase subagent path; `blueprint-roadmapper`, `blueprint-verifier`, browser, web-search-only, shell-only, or generic agents are not substitutes for roadmap-admin insertion analysis.
18. Treat scaffold text and the starter handoff as starter material only. Do not author final `XX-CONTEXT.md` content, create insert-phase-specific reports, or jump directly to `/blu-plan-phase` or `/blu-execute-phase`; `/blu-discuss-phase <phase>` owns rich context authoring against the `phase.context` contract.

### `remove-phase`

1. Require an explicit phase number before any mutation.
2. Read the roadmap first and stop with recovery guidance if the roadmap is missing or malformed.
3. Read the target phase through `blueprint_phase_locate` before mutation so drift or execution evidence is visible in the preview.
4. Require explicit confirmation before deleting the target phase and renumbering subsequent phases. Prefer Gemini CLI `ask_user` for that confirmation gate when available instead of prose-only confirmation.
5. Persist the roadmap mutation through `blueprint_roadmap_remove_phase`; do not rewrite `.blueprint/ROADMAP.md` or rename phase directories directly from the command prompt.
6. Treat the future-phase guard as mandatory. When the preview shows execution evidence such as `SUMMARY`, `VERIFICATION`, or `UAT`, stop on the default safe path and require a second explicit destructive confirmation before continuing with `force: true`; otherwise reject the mutation.
7. Update `STATE.md` through `blueprint_state_update` so `/blu-remove-phase` is the active command and the next safe implemented follow-up is `/blu-progress`.
8. Keep follow-up routing inside implemented Blueprint commands only.

### `audit-milestone`

1. Read the roadmap before making milestone claims or writing milestone reports.
2. Keep milestone audits grounded in saved roadmap and phase evidence instead of chat memory.
3. Read `report.milestone-audit` through `blueprint_artifact_contract_read` before drafting or revising the report, and normalize the final report body to the returned authoring template when the contract provides one.
4. Require explicit overwrite confirmation before replacing an existing milestone audit report, and prefer `ask_user` for that confirmation gate.
5. Use `blueprint_artifact_summary_digest` with explicit milestone artifact paths when the command needs a compact roadmap-plus-evidence digest.
6. Call the same-named Gemini CLI agent tool `blueprint-verifier` with a bounded milestone-evidence review packet when a second-pass review helps explain gaps or stale assumptions and optional delegation is enabled. Do not read, inline, or load separate agent source before delegation.
7. If `blueprint-verifier` is unavailable or unnecessary, keep parity by reviewing one milestone evidence group at a time and carrying forward only a compact note of confirmed gaps, stale assumptions, and remaining questions before writing the report.
8. Keep milestone report output project-local in `.blueprint/reports/` through `blueprint_artifact_report_write`. Use the exact `blueprint_roadmap_read.milestone` value as `<milestone>` and let `blueprint_artifact_report_write` own normalization. Pass a bare report name and rely on the returned `path` instead of hand-building the report filename.
9. If the audit surfaces actionable gaps and `plan-milestone-gaps` is implemented, route the follow-up there; otherwise treat planned-only milestone follow-up commands as unavailable.
10. Preserve grouped gap sections and any requirements traceability repair notes so the downstream gap-planning pass can close the same evidence chain without re-auditing from scratch.

### `plan-milestone-gaps`

1. Read the roadmap first and then inspect `.blueprint/reports/` through `blueprint_artifact_list` so the command stays grounded in the latest milestone audit instead of chat memory.
2. Fail fast when the matching milestone audit report is missing or when the audit contains no actionable gaps.
3. Use `blueprint_artifact_summary_digest` with explicit roadmap-plus-audit inputs to build a compact evidence view before proposing any new phases.
4. Preserve the locked gap-closure intent by grouping related requirement, integration, and flow gaps into a few coherent roadmap phases rather than adding one phase per gap, and keep any requirements traceability repair in the grouped plan instead of scattering it across phases.
5. When broad audit gaps benefit from a second-pass grouping review, call the same-named Gemini CLI agent tool `blueprint-roadmapper` with a bounded gap-grouping packet only when optional delegation is enabled. Do not read, inline, or load separate agent source before delegation.
6. Keep the grouping reviewable: show which gaps each proposed phase closes, separate optional nice-to-have gaps from must-close work, and surface the sectioned requirement / integration / flow / optional breakdown from the audit.
7. Require one explicit confirmation before any roadmap mutation, and prefer Gemini CLI `ask_user` for that confirmation gate when available.
8. Append each approved gap-closure phase through repeated `blueprint_roadmap_add_phase` calls with `auditBackedDetails` populated from the source audit report, grouped repair requirement IDs, success criteria, and gap rows; do not rewrite `.blueprint/ROADMAP.md` directly from the command prompt, and do not imply code or git mutation.
9. Treat an existing-audit-backed-phase reuse warning from `blueprint_roadmap_add_phase` as retry recovery. Continue from the returned canonical `phaseNumber`, `phasePrefix`, and `phaseDir` rather than appending the same grouped gaps again.
10. Update `STATE.md` through `blueprint_state_update` so the first new gap-closure phase becomes current and the next safe implemented follow-up is `/blu-discuss-phase <phase>`.
11. Keep follow-up routing inside implemented Blueprint commands only.

### `complete-milestone`

1. Read the roadmap first and then inspect `.blueprint/reports/` through `blueprint_artifact_list` so the closeout step stays grounded in the saved audit report instead of chat memory.
2. Read `blueprint_state_load` so you can inspect `derivedStatus.milestoneAudit` and `derivedStatus.nextAction`. Fail fast unless `derivedStatus.milestoneAudit.readyForCompletion` is true and `derivedStatus.nextAction` routes to `/blu-complete-milestone <milestone>` for the resolved target milestone. Do not treat report-local readiness alone as sufficient. If the audit report is missing, route the user to `/blu-audit-milestone`. If the audit exists but is not ready, or if `derivedStatus.nextAction` points somewhere other than `/blu-complete-milestone <milestone>`, route them to `derivedStatus.milestoneAudit.nextSafeAction` when present and safe, otherwise to `derivedStatus.nextAction` when it is an implemented non-closeout command, otherwise to `/blu-plan-milestone-gaps` when actionable gaps or blockers remain, and only fall back to `/blu-progress` when the report is malformed or undecidable.
3. Read `report.milestone-complete` through `blueprint_artifact_contract_read` before drafting or revising the report, and normalize the final completion body to the returned `contract.authoringTemplate` when the contract provides one.
4. Use `blueprint_artifact_summary_digest` with explicit roadmap-plus-audit inputs to build a compact evidence view before writing the completion report. Surface the audit readiness and evidence trail, not just a terse summary.
5. Keep `complete-milestone` report-driven and state-driven. Do not rewrite `.blueprint/ROADMAP.md`, renumber phases, or invent a new `phase_mark_complete` substrate from the command prompt.
6. Persist the completion report project-local in `.blueprint/reports/` through `blueprint_artifact_report_write`. Use the exact `blueprint_roadmap_read.milestone` value as `<milestone>` and let `blueprint_artifact_report_write` own normalization. Pass a bare report name and rely on the returned `path` instead of hand-building the report filename.
7. Require explicit overwrite confirmation before replacing an existing milestone completion report, and prefer `ask_user` for that confirmation gate.
8. Update `STATE.md` through `blueprint_state_update` so `/blu-complete-milestone` is the active command and the next safe implemented follow-up is `/blu-milestone-summary <milestone>`.
9. Keep follow-up routing inside implemented Blueprint commands only. Do not loop back into `/blu-audit-milestone` when the saved audit already names a safer follow-up.

### `milestone-summary`

1. Read the roadmap first and inspect `.blueprint/reports/` through `blueprint_artifact_list` so the summary stays grounded in the matching milestone audit and completion reports.
2. Fail fast when either the audit report or completion report is missing. Route the user to `/blu-audit-milestone` or `/blu-complete-milestone` instead of fabricating missing inputs.
3. Read `report.milestone-summary` through `blueprint_artifact_contract_read` before drafting or revising the report, and normalize the final summary body to the returned `contract.authoringTemplate` when the contract provides one.
4. Use `blueprint_artifact_summary_digest` with explicit roadmap-plus-report inputs to build the milestone summary from durable evidence.
5. Persist the summary report project-local in `.blueprint/reports/` through `blueprint_artifact_report_write`. Use the exact `blueprint_roadmap_read.milestone` value as `<milestone>` and let `blueprint_artifact_report_write` own normalization. Pass a bare report name and rely on the returned `path` instead of hand-building the report filename.
6. Require explicit overwrite confirmation before replacing an existing milestone summary report, and prefer `ask_user` for that confirmation gate.
7. Keep the flow skill-led. Do not pull in `blueprint-doc-writer` or any later-wave docs agent for this Wave 2 summary step.
8. Update `STATE.md` through `blueprint_state_update` so `/blu-milestone-summary` is the active command and the next safe implemented follow-up is `/blu-new-milestone`.
9. Keep follow-up routing inside implemented Blueprint commands only.

### `new-milestone`

1. Read the roadmap first and derive the next milestone starter context from the saved milestone summary through `blueprint_artifact_summary_digest`.
2. Read `blueprint_config_get` with `scope: "effective"` before any optional `blueprint-roadmapper` decision so roadmapper use stays config-gated.
3. Read `report.milestone-summary` through `blueprint_artifact_contract_read` before generating carry-forward seeds, and normalize any summary-derived seed text to the returned authoring template when the contract provides one.
4. Treat carry-forward as the default mode. Only switch to a fresh reset when the user explicitly asks for it, and prefer `ask_user` when the choice is not already explicit.
5. Preview the exact source scope before mutation: the source milestone summary path, digest `inputsUsed`, warnings, carry-forward or reset mode, proposed milestone name, starter-doc overwrite set, first whole-number phase target, affected starter paths, overwrite risk, and `Safe default: stop without writing`.
6. Before any optional delegation, build a typed `Roadmapper Packet` from digest-backed evidence only. The packet must include `digestScope`, `carryForwardFacts`, `requirementTransitionHints`, `firstPhasePreview`, `parentOwnedResponsibilities`, `forbiddenActions`, and `stopConditions`.
7. `digestScope` must stay limited to the digest `inputsUsed` plus the resolved milestone summary path. `carryForwardFacts` must stay limited to digest-backed roadmap and milestone facts. `requirementTransitionHints` may summarize likely `carry`, `modify`, `defer`, `retire`, `new`, `self-derived`, or `uncertain` rows with `sourceRefs` plus `rationale`, but they remain starter-seed evidence only and do not become a competing `.blueprint/REQUIREMENTS.md` write path.
8. `parentOwnedResponsibilities` must keep digest reads, evidence-scope construction, final milestone name, final phase numbers and paths, confirmation gates, MCP writes, final response, and routing with the parent command. `forbiddenActions` must forbid MCP writes, hand-editing `.blueprint/`, final phase-context authoring, confirmation-gate overrides, and any web, browser, or shell access not granted in the roadmapper frontmatter. `stopConditions` must include missing summary evidence, conflicting carry-forward facts, unresolved transition uncertainty that changes grouping, stale preview receipts, and any case where the parent cannot keep the write path deterministic.
9. Call the same-named Gemini CLI agent tool `blueprint-roadmapper` only when grouped carry-forward synthesis helps sharpen the next milestone's starter scope and optional delegation is enabled; the roadmapper proposes grouping and ordering only. Do not read, inline, or load separate agent source before delegation, and do not pass raw reports, chat history, unrestricted files, web search results, browser-only findings, or shell-only substitutes to it.
10. The typed roadmapper result must stay limited to `roadmapperMode`, `provisionalOrderedProposals`, `coverageNotes`, `blockers`, `warnings`, `assumptions`, `confidence`, and `relativeFirstPhaseRecommendation`. `relativeFirstPhaseRecommendation` is advisory only; the parent still owns the final first phase number and path.
11. If `blueprint-roadmapper` is disabled, unnecessary, or unavailable, keep parity by filling that same result shape inline before scaffold. Use `roadmapperMode: "skipped-disabled"` when effective config disables subagents, `roadmapperMode: "skipped-unnecessary"` when the carry-forward scope is small enough that inline synthesis is equivalent, `roadmapperMode: "unavailable-fallback"` when the agent is not available at runtime, and `roadmapperMode: "used"` only when the roadmapper was called.
12. Before scaffold, build a compact `New Milestone First-Phase Handoff Packet` with `mode`, `fromMilestone`, `toMilestone`, `firstPhase`, `digestInputsUsed`, `retainedDecisions`, `activeRequirementTransitions`, `openForDiscuss`, `riskWatchlist`, `deferredNotDoingNow`, `canonicalReferences`, and `routeReceipt`.
13. Cap that packet to roughly 12-18 bullets total. Do not write final implementation decisions for unresolved gray areas; use `openForDiscuss` with confidence and consequence instead. Do not infer codebase facts not present in the digest or refreshed repo evidence; label unverified claims as assumptions. Preserve deferred material as `deferredNotDoingNow`, `riskWatchlist`, or `openForDiscuss`; never collapse it into `none`.
14. Read `phase.context` through `blueprint_artifact_contract_read` before scaffolding the first phase context artifact for the new milestone so the seeded `XX-CONTEXT.md` stays aligned with the canonical contract.
15. Regenerate starter docs through `blueprint_artifact_scaffold` with an explicit carry-forward seed. Do not hand-edit `PROJECT.md`, `REQUIREMENTS.md`, or `ROADMAP.md` from the command prompt.
16. Preserve historical phase directories. Do not delete or renumber earlier milestone artifacts as part of `new-milestone`.
17. Start the new milestone at the next whole-number phase and scaffold the first phase context artifact so `/blu-discuss-phase <first phase>` has a valid target directory.
18. Require explicit overwrite confirmation before replacing the existing starter docs, and prefer `ask_user` for that confirmation gate.
19. Treat `carry-forward-confirmation` and `starter-doc-overwrite-confirmation` as named in-flight receipts that bind the approved preview packet fields and typed roadmapper result to the later scaffold and state-update arguments.
20. If the user declines either gate, stop without writing and point to `/blu-progress` when a safe route is needed.
21. Treat the scaffold receipt fields `highestBasePhaseNumber`, `firstPhaseNumber`, `firstPhasePrefix`, `firstPhaseDir`, `firstContextPath`, `deletedPhaseDirectories`, and `renamedPhaseDirectories` as authoritative; stale previews, conflicting first-phase directories, ambiguous first-phase directories, and missing first context paths block instead of being recomputed in prompt text.
22. Return the new-milestone completion receipt in the same response with `mode`, `roadmapperMode`, `firstPhaseTarget` (`number`, `prefix`, `dir`, `contextPath`), `scaffoldPathStatuses` (`created`, `reused`, `overwritten`, or `blocked` per path), `inputsUsed`, `stateUpdated`, `safeRetry`, `nextAction`, `warnings`, `deletedPhaseDirectories`, and `renamedPhaseDirectories`.
23. Keep recovery wording explicit in the response: mutation not attempted is safe to rerun after blocker resolution; roadmap mutation plus scaffold failure must report the successful roadmap path and exact scaffold blocker without hand-writing starter docs; scaffold success plus state-update failure must route to `/blu-progress` without hand-editing `STATE.md`; same preview plus same returned files may reuse when the tool reports `reused`; changed params or files under the same confirmation token must block as stale or require manual recovery.
24. New-milestone-specific recovery must also stay explicit: missing summary blocks with `missing-milestone-summary`; reset ambiguity requires an explicit mode choice; starter overwrite blockers require overwrite approval; stale first-phase numbers require a roadmap re-read and fresh preview; directory conflicts block with the exact conflict; state mismatch is reported and routed to `/blu-progress`.
25. Treat the handoff packet as starter-only seed material for `/blu-discuss-phase`, not as final authored `phase.context`. It must not widen into a new typed `.blueprint/` write surface or a durable handoff store.
26. Update `STATE.md` through `blueprint_state_update` only after scaffold succeeds so the first carried-forward phase becomes current and the next safe implemented follow-up is `/blu-discuss-phase <first phase>`.
27. Keep follow-up routing inside implemented Blueprint commands only.

## Wave 2 Closeout Guardrail

- `insert-phase` is now shipped through its dedicated roadmap MCP substrate; keep later roadmap and post-Wave-2 surfaces blocked until their own runtime contracts exist.
- Do not promote `complete-milestone`, `milestone-summary`, or `new-milestone` by docs alone; they become routable only when the manifest, primary skill, and required MCP tools all exist.
- Milestone report commands should remain contract-driven: `audit-milestone` uses `report.milestone-audit`, `complete-milestone` uses `report.milestone-complete`, `milestone-summary` uses `report.milestone-summary`, and `new-milestone` reads `phase.context` before scaffolding the first new phase context.

## Output Style

- For `add-phase`, report the new phase number and description plainly, mention the scaffolded phase path and any reuse warnings, and end with the next safe implemented action.
- For `insert-phase`, report the inserted decimal phase plainly, mention the anchor integer phase, call out any directory reuse or detail-order warnings, and end with the next safe implemented action.
- For `remove-phase`, report the removed phase plainly, summarize any renumbered phases or drift warnings, and end with the next safe implemented action.
- For `plan-milestone-gaps`, show the grouped gap-closure phases compactly, call out any deferred optional gaps, and end with the first safe implemented follow-up.
- For `audit-milestone`, call out the original milestone intent, the evidence that confirms or weakens it, grouped gap sections, any traceability repair notes, and the next safe implemented action.
- For `complete-milestone`, report the milestone resolved, the audit readiness, audit report, and evidence used, whether the completion report was created or replaced, and the next safe implemented action.
- For `milestone-summary`, report the milestone resolved, the source reports and evidence used, whether the summary report was created or replaced, and the next safe implemented action.
- For `new-milestone`, report the new milestone name, whether the flow used carry-forward or explicit reset, the first new phase scaffolded, the compact `New Milestone First-Phase Handoff Packet`, and the next safe implemented action.
- For `add-phase`, include the compact starter handoff block before the route instruction: returned phase number and title, declared requirement IDs, confirmed objective, success criteria, source refs, and open items for discuss-phase.
- For `insert-phase`, include the compact starter handoff block before the route instruction: decimal phase number and title, anchor phase, declared requirement IDs, no-renumbering and dependency-review note, roadmap evolution note summary, and open risks plus dependency questions.
- For `add-phase`, `insert-phase`, and `new-milestone`, when a confirmation gate is shown, render the preview packet fields explicitly and name the safe default as `stop without writing`.
- For `add-phase`, `insert-phase`, and `new-milestone`, when confirmation succeeds, the completion summary should name the gate receipt implicitly by carrying forward the exact approved target or scaffold values instead of introducing new mutation arguments after approval.
- For `add-phase`, include the completion receipt fields: approved `phaseNumber`, returned phase metadata, declared `requirementIds`, confirmed `goal`, `successCriteriaCount`, `roadmapPath`, `contextScaffoldPath`, `stateRoute`, `safeRetry`, and `warnings`.
- For `insert-phase`, include the completion receipt fields: integer `anchor`, inserted decimal `phaseNumber`, returned phase metadata, `requirementMappingStatus`, `requirementsPath`, `roadmapPath`, `contextScaffoldPath`, `stateRoute`, the no-renumbering note, `safeRetry`, and `warnings`.
- For `new-milestone`, include the completion receipt fields: `mode`, `roadmapperMode`, `firstPhaseTarget`, `scaffoldPathStatuses`, `inputsUsed`, `stateUpdated`, `safeRetry`, `nextAction`, `warnings`, `deletedPhaseDirectories: []`, and `renamedPhaseDirectories: []`.
- For `add-phase`, `insert-phase`, and `new-milestone`, keep the recovery matrix visible in the response whenever the flow stops or partially succeeds: mutation not attempted, roadmap mutation plus scaffold failure, scaffold success plus state-update failure, same preview plus same returned files reuse, and stale same-token param or file changes.
- For `new-milestone`, include the MCP scaffold receipt values for the first phase: `firstPhaseNumber`, `firstPhasePrefix`, `firstPhaseDir`, `firstContextPath`, `deletedPhaseDirectories: []`, and `renamedPhaseDirectories: []`.

## Completion Self-Check

Before claiming completion, verify:

- The active roadmap-admin command loaded only its structured `input_bundles.commands[...]` input: the add/insert runtime contract or the active `commands/blu-*.toml` manifest. Sibling command references were not treated as active requirements.
- Required MCP calls ran in the active contract's order through runtime FQNs (`mcp_blueprint_blueprint_*`), with roadmap, report, contract, digest, artifact, or phase-locate reads completed before any roadmap, scaffold, report, or state write.
- Persistence used only the owning MCP tools for the active command: roadmap mutation, artifact scaffold/report write, and state update. No direct edits were made to `.blueprint/ROADMAP.md`, `.blueprint/STATE.md`, `.blueprint/phases/`, `.blueprint/reports/`, runtime files, installed extension directories, or planned-only surfaces.
- Returned MCP fields were treated as authoritative, including `status`, `written`, `created`, `updated`, `createdFiles`, `reusedFiles`, `path`, `phaseNumber`, `phasePrefix`, `phaseDir`, `inputsUsed`, validation results, warnings, recovery guidance, and `reason`.
- Every required confirmation gate was satisfied before mutation: phase-number append, decimal insert, future/destructive removal, grouped gap plan, overwrite or replacement, carry-forward versus reset, and starter-doc regeneration.
- For `add-phase`, `insert-phase`, and `new-milestone`, the approved preview packet and later MCP mutation arguments stayed aligned; declines stopped without writing and routed to `/blu-progress` only when a safe route was needed.
- For `add-phase`, `insert-phase`, and `new-milestone`, the final response included the command-specific completion receipt fields and stated that receipts live only in the command response, not in `.blueprint/receipts`, `.blueprint/runs`, host-global state, or any other durable surface.
- The shared recovery matrix stayed explicit for those three commands: mutation not attempted, roadmap mutation plus scaffold failure, scaffold success plus state-update failure, same preview plus same returned files reuse, and stale same-token param or file changes.
- Command-specific recovery wording stayed explicit when applicable: stale `expectedPhaseNumber`, undeclared `requirementIds`, missing returned metadata, invalid non-integer anchors, declared-ID failures, already-mapped IDs, conflicting decimal directories, dependency-review warnings, missing summary, reset ambiguity, starter overwrite blockers, stale first-phase numbers, directory conflicts, and state mismatch.
- Missing inputs, no-actionable-gap states, invalid anchors, stale phase numbers, conflicting directories, missing reports, audit-not-ready states, validation failures, tool rejections, partial writes, or skipped steps were repaired through the active reference or reported as blockers/no-write status, not described as successful completion.
- The command stayed inside its write boundary: roadmap surgery only for add/insert/remove/gap phases, reports only through `.blueprint/reports/`, new-milestone starter scaffolds only through `blueprint_artifact_scaffold`, and no source, test, git, hook, catalog-status, or installed-extension mutation.
- Final routing named only implemented Blueprint commands from the active contract; `/blu-progress` was used when the safe next action was ambiguous, blocked, declined, or not implemented.
- The final response named concrete returned artifact, report, scaffold, roadmap, or state paths, or explicitly stated that no write occurred, and included warnings, reuse/drift notes, blockers, and the next safe implemented action.
