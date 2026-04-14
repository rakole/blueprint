# Blueprint MCP Tools

## Purpose

Blueprint commands use MCP tools for deterministic state operations. This keeps filesystem contracts, validation, and path safety consistent across commands and prevents prompt-only state mutation from becoming the real runtime.

## Design Rules

- Tools own persistence.
- Commands own UX.
- Skills own orchestration.
- Agents own bounded deep work.
- Shared runtime security lives below the tool surface and is consumed by MCP tools rather than by command-only prompt logic.

## Current Registered Tool Surface

These are the tool names actually registered by `src/mcp/server.ts` today. Future command specs may reference planned tools, but those are not part of the live runtime until they are registered here.

### Project and Command Catalog

| Tool | Purpose | Returns |
|---|---|---|
| `blueprint_command_catalog` | Return the retained command registry plus runtime availability metadata | `{commands, waves, aliases}` with per-command `declaredStatus`, `status`, `implemented`, `blockedBy`, `manifestPath`, `skillPath`, `specPath`, `requiredTools`, `requiredToolsSatisfied`, `optionalAgents`, and `availableOptionalAgents` |
| `blueprint_project_init` | Create the initial `.blueprint/` scaffold, seed normalized repo config, and derive bootstrap routing signals | `{projectRoot, createdPaths, seededState, configPath, configProvenance, brownfield, bootstrapDiagnostics, nextAction, warnings}` |
| `blueprint_project_status` | Summarize project readiness, current state, bootstrap routing signals, and next action | `{status, initialized, currentPhase, currentMilestone, nextAction, bootstrap, health}` |

### Config

| Tool | Purpose | Returns |
|---|---|---|
| `blueprint_config_get` | Read normalized config in `project`, `defaults`, or `effective` scope | `{scope, config, provenance, sourcePath, warnings}` |
| `blueprint_config_set` | Apply a schema-validated config patch to `project` or `defaults` scope and persist normalized form | `{scope, updatedKeys, config, provenance, configPath, warnings}` |
| `blueprint_config_set_profile` | Set the active project model profile without mutating user defaults | `{profile, updatedKeys, configPath}` |

### State and Pause Handoff

| Tool | Purpose | Returns |
|---|---|---|
| `blueprint_state_load` | Load stored state together with derived routing signals | `{state, blockers, derivedStatus}` |
| `blueprint_state_update` | Patch `STATE.md` deterministically | `{updatedFields, statePath, warnings}` |
| `blueprint_pause_handoff_get` | Read the latest `pause-work` handoff report | `{found, path, handoff, reason, warnings}` |
| `blueprint_pause_handoff_write` | Persist the latest `pause-work` handoff report with overwrite protection | `{path, written, created, overwritten, status, handoff, warnings}` |
| `blueprint_state_sync` | Reconstruct state from current artifacts and runtime signals | `{syncedFields, warnings, statePath}` |

### Roadmap and Phase

| Tool | Purpose | Returns |
|---|---|---|
| `blueprint_roadmap_read` | Load roadmap, milestone, and phase list | `{roadmap, milestone, phases}` |
| `blueprint_roadmap_add_phase` | Append the next whole-number phase and derive the matching `.blueprint/phases/<phase-slug>/` directory | `{phaseNumber, phaseDir, roadmapPath}` |
| `blueprint_roadmap_insert_phase` | Insert the next decimal phase after an existing integer phase without renumbering later roadmap entries | `{afterPhaseNumber, phaseNumber, phaseDir, roadmapPath}` |
| `blueprint_roadmap_remove_phase` | Remove and renumber phase entries | `{removedPhase, renumberedPhases, roadmapPath}` |
| `blueprint_roadmap_promote_backlog` | Preview backlog items or promote confirmed items into appended roadmap phases while reusing reserved `999.x` phase stubs when present | `{status, backlogItems, selectedBacklogIds, promotedItems, createdPhaseDirs, warnings}` |
| `blueprint_phase_locate` | Resolve a phase reference to disk state | `{found, phaseNumber, phaseName, phaseDir, artifacts}` |
| `blueprint_phase_context` | Summarize phase boundary and existing artifacts | `{phase, requirements, missingArtifacts}` |
| `blueprint_phase_research_status` | Report discovery readiness for context, research, and UI-spec artifacts | `{hasContext, hasResearch, hasUiSpec, contextPath, researchPath, uiSpecPath, researchValid, researchIssues, suggestedRepairs, warnings}` |
| `blueprint_phase_artifact_read` | Read phase-scoped discovery artifacts such as `CONTEXT`, `DISCUSSION-LOG`, `RESEARCH`, or `UI-SPEC` | `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, reason}` |
| `blueprint_phase_artifact_write` | Persist substantive phase-scoped discovery artifact content with overwrite protection and research validation | `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, written, created, overwritten, status, validation, warnings}` |
| `blueprint_phase_plan_index` | Index plan files and execution readiness across waves | `{plans, waves, missingPlans}` |
| `blueprint_phase_plan_read` | Read a phase-scoped plan artifact together with parsed metadata and validation signals | `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, validation, reason}` |
| `blueprint_phase_plan_write` | Persist substantive phase-scoped plan artifact content with overwrite protection and validation | `{phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, written, created, overwritten, status, validation, warnings}` |
| `blueprint_phase_summary_index` | Index execution summaries and report completed versus pending plans | `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, summaries, completedPlans, pendingPlans, warnings}` |
| `blueprint_phase_summary_read` | Read a phase-scoped summary artifact together with linked plan metadata | `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, reason}` |
| `blueprint_phase_summary_write` | Persist substantive phase-scoped summary content for an existing plan | `{phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, linkedPlanPath, written, created, overwritten, status, issues, warnings}` |
| `blueprint_phase_validation_read` | Read a phase-scoped validation artifact and its execution-summary coverage | `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, summaryPaths, reason}` |
| `blueprint_phase_validation_write` | Persist a phase-scoped `VERIFICATION` or `UAT` artifact with overwrite protection and execution-aware prerequisite checks | `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, summaryPaths, written, created, overwritten, status, issues, warnings}` |
| `blueprint_phase_checkpoint_get` | Read the saved `discuss-phase` checkpoint for a phase | `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, path, checkpoint, reason}` |
| `blueprint_phase_checkpoint_put` | Persist a `discuss-phase` checkpoint JSON object for a phase | `{phaseNumber, phasePrefix, phaseName, phaseDir, path, updated, warnings}` |
| `blueprint_phase_checkpoint_delete` | Delete a saved `discuss-phase` checkpoint after successful completion | `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, path, deleted, reason}` |

### Artifact Management

| Tool | Purpose | Returns |
|---|---|---|
| `blueprint_artifact_scaffold` | Create or seed artifacts from templates; use it for first-write scaffolding, not as the final persistence layer for filled-in artifacts | `{createdFiles, reusedFiles, warnings}` |
| `blueprint_artifact_list` | Enumerate known core, phase, codebase, and report artifacts | `{artifacts, reports, missing, warnings}` |
| `blueprint_artifact_mutate_index` | Append or update canonical capture entries in Blueprint indexes such as backlog, notes, and todos, with duplicate detection, pending-todo inspection, and optional backlog stub reservation metadata | `{targetPath, createdEntryIds, matchedEntryIds, entries, updatedCounts, duplicateEntryIds, reservedPhase, summary, warnings}` |
| `blueprint_artifact_validate` | Validate Blueprint artifact structure and required fields | `{valid, issues, suggestedRepairs, warnings}` |
| `blueprint_artifact_summary_digest` | Build digests from artifacts, code, tests, and reports | `{digest, inputsUsed}` |
| `blueprint_artifact_report_write` | Persist durable report artifacts such as milestone audits with overwrite protection | `{path, written, created, overwritten, status, warnings}` |

### Review

| Tool | Purpose | Returns |
|---|---|---|
| `blueprint_review_scope` | Resolve a deterministic review scope for a phase from executed plan metadata or explicit repo file paths | `{status, phase, files, reviewMode, artifacts, reason, warnings}` |
| `blueprint_review_load_findings` | Load structured findings, follow-ups, and severity counts from a saved phase-scoped review artifact | `{findings, severityCounts, followUps, path, warnings}` |
| `blueprint_review_record` | Persist a phase-scoped review artifact such as `XX-SECURITY.md`, `XX-REVIEW.md`, `XX-REVIEWS.md`, or `XX-UI-REVIEW.md` with overwrite protection | `{reportPath, counts, followUps, status, warnings}` |

## Planned Later Tool Families

These tool names are part of the documented future contract, but they are not registered today.

### Future Workspace and Workstream Tools

- `blueprint_workspace_registry_get`
- `blueprint_workspace_create`
- `blueprint_workspace_remove`
- `blueprint_workstream_list`
- `blueprint_workstream_mutate`

### Future Review and Maintenance Tools

- `blueprint_update_check`
- `blueprint_update_plan`
- `blueprint_patch_record`
- `blueprint_patch_list`
- `blueprint_patch_reapply`

## Implemented Command Ownership Notes

- `/blu`, `help`, `progress`, and `next` rely on `blueprint_command_catalog`, project status, and other read-oriented tools. They must only surface commands whose catalog entry is `implemented`.
- `new-project`, `settings`, and `set-profile` lean on project, config, and state tools.
- `map-codebase` uses `blueprint_project_status`, `blueprint_artifact_scaffold`, `blueprint_artifact_list`, and `blueprint_artifact_summary_digest`.
- `add-backlog` uses `blueprint_artifact_mutate_index` and, when the user explicitly reserves a parking-lot phase, `blueprint_artifact_scaffold`.
- `review-backlog` uses `blueprint_roadmap_promote_backlog`, `blueprint_artifact_mutate_index`, and `blueprint_state_update` to preview backlog candidates, append promoted roadmap phases, preserve backlog history through status transitions, and route the repo into `/blu-discuss-phase`.
- `explore` uses `blueprint_project_status`, `blueprint_artifact_mutate_index`, `blueprint_roadmap_add_phase`, and `blueprint_artifact_scaffold` to classify ideas before persistence, keep capture writes confirmation-gated, and scaffold the first phase context when a confirmed idea is promoted directly into the active roadmap.
- `discuss-phase` uses phase location/context, discovery artifact read and write tools, checkpoint tools, scaffolding, and `blueprint_state_update`.
- `research-phase` uses phase location/context, research status, discovery artifact read and write tools, scaffolding, `blueprint_state_load`, `blueprint_command_catalog`, and `blueprint_state_update`.
- `ui-phase` uses phase readiness, discovery artifact read and write tools, scaffolding, config, and state update tools.
- `plan-phase` uses plan index, plan read and write tools, config, artifact validation, and state update tools.
- `execute-phase` uses plan index/read, summary index/read/write, config, artifact validation, and state update tools.
- `fast` uses `blueprint_project_status` and `blueprint_state_update` to keep trivial inline execution inside the implemented command surface without inventing extra Blueprint artifacts.
- `quick` uses `blueprint_project_status`, `blueprint_command_catalog`, `blueprint_artifact_report_write`, and `blueprint_state_update` to keep bounded quick runs report-backed and routed inside the implemented command surface.
- `validate-phase` and `verify-work` use summary index/read, validation read/write, config, artifact validation, and state update tools.
- `add-tests` uses phase locate, summary index/read, validation read/write, artifact list/validate/report-write, and state update tools to keep repo test generation grounded in saved execution evidence while keeping Blueprint-owned persistence phase-scoped and report-backed.
- `pause-work` and `resume-work` use state load and update tools together with pause handoff read and write support.
- `list-phase-assumptions` uses `blueprint_phase_locate`, `blueprint_phase_context`, `blueprint_roadmap_read`, and `blueprint_project_status`.
- `add-phase` uses `blueprint_roadmap_read`, `blueprint_roadmap_add_phase`, `blueprint_artifact_scaffold`, and `blueprint_state_update`.
- `insert-phase` uses `blueprint_roadmap_read`, `blueprint_roadmap_insert_phase`, `blueprint_artifact_scaffold`, and `blueprint_state_update` to insert the next decimal phase after an existing integer anchor and route the repo back into `/blu-discuss-phase`.
- `remove-phase` uses `blueprint_roadmap_read`, `blueprint_artifact_list`, `blueprint_roadmap_remove_phase`, and `blueprint_state_update`.
- `plan-milestone-gaps` uses `blueprint_roadmap_read`, `blueprint_artifact_list`, `blueprint_artifact_summary_digest`, `blueprint_roadmap_add_phase`, and `blueprint_state_update`.
- `audit-milestone` uses `blueprint_roadmap_read`, `blueprint_phase_summary_index`, `blueprint_artifact_list`, `blueprint_artifact_summary_digest`, and `blueprint_artifact_report_write`.
- `complete-milestone` uses `blueprint_roadmap_read`, `blueprint_artifact_list`, `blueprint_artifact_summary_digest`, `blueprint_artifact_report_write`, and `blueprint_state_update` to turn the saved audit into `milestone-complete-<version>.md` and route to `/blu-milestone-summary <milestone>`.
- `milestone-summary` uses `blueprint_roadmap_read`, `blueprint_artifact_list`, `blueprint_artifact_summary_digest`, `blueprint_artifact_report_write`, and `blueprint_state_update` to turn the saved audit plus completion evidence into `milestone-summary-<version>.md` and route to `/blu-new-milestone`.
- `new-milestone` uses `blueprint_roadmap_read`, `blueprint_artifact_summary_digest`, `blueprint_artifact_scaffold`, and `blueprint_state_update` to carry forward from the saved milestone summary, preserve historical phase artifacts, and scaffold the next whole-number phase context.
- `code-review` uses `blueprint_phase_locate`, `blueprint_artifact_list`, `blueprint_review_scope`, and `blueprint_review_record` to derive a deterministic repo-file scope from executed plans or explicit file paths and persist `XX-REVIEW.md`.
- `code-review-fix` uses `blueprint_phase_locate`, `blueprint_review_load_findings`, `blueprint_review_record`, and `blueprint_state_update` to load saved review findings, keep remediation bounded, persist `XX-REVIEW-FIX.md`, and route follow-up through implemented commands only.
- `audit-fix` uses `blueprint_phase_locate`, `blueprint_artifact_list`, `blueprint_review_scope`, `blueprint_artifact_report_write`, `blueprint_artifact_mutate_index`, and `blueprint_state_update` to keep audit-driven remediation bounded, report-backed, and routed inside implemented follow-up commands.
- `secure-phase` uses `blueprint_phase_locate`, `blueprint_artifact_list`, and `blueprint_review_record` to persist phase-scoped security evidence as `XX-SECURITY.md`, with the shared security layer enforcing prompt-boundary checks before the artifact is written.
- `review` uses `blueprint_phase_locate`, `blueprint_artifact_list`, `blueprint_phase_plan_index`, `blueprint_phase_plan_read`, and `blueprint_review_record` to read the saved phase plan set, keep reviewer availability explicit, and persist `XX-REVIEWS.md`.
- `ui-review` uses `blueprint_phase_locate`, `blueprint_artifact_list`, and `blueprint_review_record` to persist phase-scoped UI audit evidence as `XX-UI-REVIEW.md`.
- `pr-branch` uses `blueprint_project_status`, `blueprint_config_get`, `blueprint_artifact_summary_digest`, and `blueprint_artifact_report_write` to keep review-branch preparation evidence-backed, report-backed, and explicit about `.blueprint/` filtering before any git mutation; its maintenance flow should continue to apply the shared dirty-tree and resolved-target preflight checks before branch mutation.
- `ship` uses `blueprint_project_status`, `blueprint_phase_locate`, `blueprint_config_get`, `blueprint_artifact_list`, `blueprint_artifact_summary_digest`, `blueprint_artifact_report_write`, and `blueprint_state_update` to keep shipping evidence-backed, report-backed, explicit about push or PR mutation, and honest about the next safe follow-up when `gh` is unavailable; its maintenance flow should continue to apply the shared dirty-tree, scope, and report-before-mutate preflight checks.
- `cleanup` uses `blueprint_project_status`, `blueprint_roadmap_read`, `blueprint_artifact_list`, `blueprint_artifact_summary_digest`, `blueprint_artifact_report_write`, and `blueprint_state_update` to keep phase-directory archival evidence-backed, report-backed before filesystem mutation, and explicit about active-phase protection plus archive destination selection; its maintenance flow should continue to apply the shared dirty-tree, protected-scope, and report-before-mutate preflight checks.

## Planned Command Notes

- Planned and blocked command specs may reference the future tool families above as implementation contracts.
- Those commands remain non-routable until the tools are registered and the runtime catalog marks them `implemented`.

## Path Safety Rules

- All tools operate relative to the repo root or the locked host-global Blueprint directory.
- Config tools may read or write only `.blueprint/config.json` and `~/.<host>/blueprint/defaults.json`; they must not create ad hoc config files elsewhere.
- Tools must reject path traversal, absolute-path misuse for repo-relative inputs, null bytes, and symlink escapes.
- Tools should use shared safe parsing with size limits for config, checkpoint, and registry-style JSON inputs.
- Prompt-boundary-sensitive writes such as reports, phase artifacts, review artifacts, pause handoffs, and capture indexes should be checked through the shared security layer before persistence.
- Tools must not write into the installed extension directory as part of normal command execution.
