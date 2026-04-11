# Blueprint MCP Tools

## Purpose

Blueprint commands must use MCP tools for deterministic state operations. This keeps filesystem contracts, validation, and path safety consistent across commands.

## Design Rules

- Tools own persistence.
- Commands own UX.
- Skills own orchestration.
- Agents own bounded deep work.

## Tool Families

### Project and Command Catalog

| Tool | Purpose | Returns |
|---|---|---|
| `blueprint_command_catalog` | Return the retained command registry plus runtime availability metadata | `{commands, waves, aliases}` where each command includes `declaredStatus`, `status`, `implemented`, `blockedBy`, `manifestPath`, `skillPath`, `specPath`, `requiredTools`, `requiredToolsSatisfied`, `optionalAgents`, and `availableOptionalAgents` |
| `blueprint_project_init` | Create the initial `.blueprint/` scaffold and seed normalized repo config from hardcoded defaults plus optional user defaults | `{projectRoot, createdPaths, seededState, configPath, configProvenance}` |
| `blueprint_project_status` | Summarize project readiness and next actions | `{initialized, currentPhase, currentMilestone, nextAction, health}` |

### Config

| Tool | Purpose | Returns |
|---|---|---|
| `blueprint_config_get` | Read normalized config in `project`, `defaults`, or `effective` scope | `{scope, config, provenance, sourcePath, warnings}` |
| `blueprint_config_set` | Apply a schema-validated config patch to `project` or `defaults` scope and persist normalized form | `{scope, updatedKeys, config, provenance, configPath, warnings}` |
| `blueprint_config_set_profile` | Set the active project model profile without mutating user defaults | `{profile, updatedKeys, configPath}` |

### State

| Tool | Purpose | Returns |
|---|---|---|
| `blueprint_state_load` | Load current state and derived signals | `{state, blockers, derivedStatus}` |
| `blueprint_state_update` | Patch `STATE.md` deterministically | `{updatedFields, statePath}` |
| `blueprint_state_sync` | Reconstruct state from artifacts | `{syncedFields, warnings}` |

### Roadmap and Phase Management

| Tool | Purpose | Returns |
|---|---|---|
| `blueprint_roadmap_read` | Load roadmap, milestone, and phase list | `{roadmap, milestone, phases}` |
| `blueprint_roadmap_add_phase` | Append a phase | `{phaseNumber, phaseDir, roadmapPath}` |
| `blueprint_roadmap_insert_phase` | Insert decimal phase | `{phaseNumber, phaseDir, roadmapPath}` |
| `blueprint_roadmap_remove_phase` | Remove and renumber phase entries | `{removedPhase, renumberedPhases, roadmapPath}` |
| `blueprint_roadmap_promote_backlog` | Promote backlog items into roadmap phases | `{promotedItems, createdPhaseDirs}` |
| `blueprint_phase_locate` | Resolve a phase reference to disk state | `{found, phaseNumber, phaseName, phaseDir, artifacts}` |
| `blueprint_phase_context` | Summarize phase boundary and existing artifacts | `{phase, requirements, missingArtifacts}` |
| `blueprint_phase_research_status` | Report research and UI-spec readiness plus research validation signals | `{hasContext, hasResearch, hasUiSpec, contextPath, researchPath, uiSpecPath, researchValid, researchIssues, suggestedRepairs, warnings}` |
| `blueprint_phase_artifact_read` | Read substantive phase-scoped artifact content for discovery, validation, or UAT work | `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, reason}` |
| `blueprint_phase_artifact_write` | Persist substantive phase-scoped artifact content with overwrite protection and validation | `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, written, created, overwritten, status, validation, warnings}` |
| `blueprint_phase_checkpoint_get` | Read the saved discuss-phase checkpoint for a phase | `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, path, checkpoint, reason}` |
| `blueprint_phase_checkpoint_put` | Persist a discuss-phase checkpoint JSON object for a phase | `{phaseNumber, phasePrefix, phaseName, phaseDir, path, updated, warnings}` |
| `blueprint_phase_checkpoint_delete` | Delete a saved discuss-phase checkpoint after successful completion | `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, path, deleted, reason}` |
| `blueprint_phase_plan_index` | Index plan files and execution readiness across waves | `{plans, waves, missingPlans}` |
| `blueprint_phase_plan_read` | Read a phase-scoped PLAN artifact together with parsed metadata and validation signals | `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, validation, reason}` |
| `blueprint_phase_plan_write` | Persist substantive phase-scoped PLAN artifact content with overwrite protection and validation | `{phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, written, created, overwritten, status, validation, warnings}` |
| `blueprint_phase_summary_index` | Index execution summary files and report which plans are completed or still pending execution evidence | `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, summaries, completedPlans, pendingPlans, warnings}` |
| `blueprint_phase_summary_read` | Read a phase-scoped SUMMARY artifact together with its linked plan path and concise metadata | `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, reason}` |
| `blueprint_phase_summary_write` | Persist substantive phase-scoped SUMMARY artifact content for an existing plan with overwrite protection | `{phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, linkedPlanPath, written, created, overwritten, status, issues, warnings}` |
| `blueprint_phase_mark_complete` | Update state and roadmap for completed phase or milestone | `{updatedPaths, status}` |

### Artifact Management

| Tool | Purpose | Returns |
|---|---|---|
| `blueprint_artifact_scaffold` | Create or seed artifacts from templates; use it for first-write scaffolding, not as the final persistence layer for filled-in discovery artifacts | `{createdFiles, reusedFiles, warnings}` |
| `blueprint_artifact_list` | Enumerate known artifacts for repo or phase | `{artifacts, reports, missing}` |
| `blueprint_artifact_validate` | Validate structure and required fields | `{valid, issues, suggestedRepairs}` |
| `blueprint_artifact_mutate_index` | Update backlog, notes, todos, and similar index files | `{targetPath, createdEntryIds, updatedCounts}` |
| `blueprint_artifact_summary_digest` | Build digests from summaries, reviews, or milestone artifacts | `{digest, inputsUsed}` |

### Workspace and Workstream

| Tool | Purpose | Returns |
|---|---|---|
| `blueprint_workspace_registry_get` | Read the global workspace registry | `{registryPath, workspaces}` |
| `blueprint_workspace_create` | Create workspace and registry entry | `{workspacePath, registryEntry, repoMembers}` |
| `blueprint_workspace_remove` | Remove workspace and registry entry | `{removedPath, removedEntry, skippedMembers}` |
| `blueprint_workstream_list` | Enumerate project workstreams | `{active, workstreams, summary}` |
| `blueprint_workstream_mutate` | Create, switch, complete, or resume workstreams | `{operation, active, affectedPaths}` |

### Review and Maintenance

| Tool | Purpose | Returns |
|---|---|---|
| `blueprint_review_scope` | Compute code or artifact scope for reviews | `{phase, files, reviewMode}` |
| `blueprint_review_record` | Persist review-shaped outputs | `{reportPath, counts, followUps}` |
| `blueprint_review_load_findings` | Parse existing review artifacts | `{findings, severityCounts}` |
| `blueprint_update_check` | Compare installed and latest Blueprint versions | `{installedVersion, latestVersion, updateAvailable}` |
| `blueprint_update_plan` | Build a safe out-of-band update checklist | `{steps, requiresRestart, notes}` |
| `blueprint_patch_record` | Record local patch metadata | `{patchId, registryPath, trackedFiles}` |
| `blueprint_patch_list` | Enumerate saved patches | `{patches, registryPath}` |
| `blueprint_patch_reapply` | Reapply saved patch manifests | `{appliedPatches, skippedPatches, conflicts}` |

## Command Ownership Notes

- `new-project`, `settings`, `set-profile`, `progress`, `health` lean on project, config, and state tools.
- `/blu`, `help`, and `progress` must filter to catalog entries where `implemented` is `true`.
- `plan-phase` uses `blueprint_phase_plan_index`, `blueprint_phase_plan_read`, and `blueprint_phase_plan_write` to read existing plans, persist updated `XX-YY-PLAN.md` content, and keep readiness aligned.
- `execute-phase` uses `blueprint_phase_plan_index`, `blueprint_phase_plan_read`, `blueprint_phase_summary_index`, `blueprint_phase_summary_read`, and `blueprint_phase_summary_write` to read plans, persist `XX-YY-SUMMARY.md` execution evidence, and keep completion state aligned.
- `validate-phase` and `verify-work` use `blueprint_phase_summary_index`, `blueprint_phase_summary_read`, `blueprint_phase_artifact_read`, `blueprint_phase_artifact_write`, `blueprint_artifact_scaffold`, `blueprint_artifact_list`, `blueprint_artifact_validate`, `blueprint_state_load`, and `blueprint_state_update` to persist phase-scoped verification and UAT evidence.
- lifecycle commands lean on phase, artifact, and state tools.
- roadmap and milestone commands lean on roadmap plus phase tools.
- capture commands use `blueprint_artifact_mutate_index`.
- quality commands use review and artifact tools.
- workspace and maintenance commands use workspace, update, and patch tools.

## Path Safety Rules

- All tools operate relative to the repo root or the locked global Blueprint directory.
- Config tools may read or write only `.blueprint/config.json` and `~/.gemini/blueprint/defaults.json`; they must not create ad hoc config files elsewhere.
- Tools must reject path traversal.
- Tools must not write into the installed extension directory as part of normal command execution.
