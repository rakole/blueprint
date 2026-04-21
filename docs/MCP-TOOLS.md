# Blueprint MCP Tools

## Purpose

Blueprint commands use MCP tools for deterministic state operations. This keeps filesystem contracts, validation, and path safety consistent across commands and prevents prompt-only state mutation from becoming the real runtime.

## Design Rules

- Tools own persistence.
- Commands own UX.
- Skills own orchestration.
- Agents own bounded deep work.
- Shared runtime security lives below the tool surface and is consumed by MCP tools rather than by command-only prompt logic.
- Failed mutating tool calls should append a best-effort diagnostic entry to `.blueprint/mcp-write-failures.ndjson` before the rejection or exception is surfaced back to the model.

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
| `blueprint_state_load` | Load stored state together with derived routing signals, including `derivedStatus.milestoneAudit` | `{state, blockers, derivedStatus}` |
| `blueprint_state_update` | Patch `STATE.md` deterministically | `{updatedFields, statePath, warnings}` |
| `blueprint_pause_handoff_get` | Read the latest `pause-work` handoff report | `{found, path, handoff, reason, warnings}` |
| `blueprint_pause_handoff_write` | Persist the latest `pause-work` handoff report with overwrite protection | `{path, written, created, overwritten, status, handoff, warnings}` |
| `blueprint_state_sync` | Reconstruct state from current artifacts and runtime signals | `{syncedFields, warnings, statePath}` |

### Roadmap and Phase

| Tool | Purpose | Returns |
|---|---|---|
| `blueprint_roadmap_read` | Load roadmap, milestone, and phase list | `{roadmap, milestone, phases}` |
| `blueprint_roadmap_add_phase` | Append the next whole-number phase and derive the matching `.blueprint/phases/<phase-slug>/` directory without mutating code or git history | `{phaseNumber, phaseDir, roadmapPath}` |
| `blueprint_roadmap_insert_phase` | Insert the next decimal phase after an existing integer phase via numeric `after` without renumbering later roadmap entries | `{afterPhaseNumber, phaseNumber, phasePrefix, phaseDir, roadmapPath}` |
| `blueprint_roadmap_remove_phase` | Remove and renumber phase entries | `{removedPhase, renumberedPhases, roadmapPath}` |
| `blueprint_roadmap_promote_backlog` | Preview backlog items or promote confirmed items into appended roadmap phases while reusing reserved `999.x` phase stubs when present | `{status, backlogItems, selectedBacklogIds, promotedItems, createdPhaseDirs, warnings}` |
| `blueprint_phase_locate` | Resolve a phase reference to disk state | `{found, phaseNumber, phaseName, phaseDir, artifacts}` |
| `blueprint_phase_context` | Summarize phase boundary, project brief, requirements grounding, workflow posture, existing artifacts, and any mapped codebase context | `{phase, projectBrief, requirementsGrounding, workflowPosture, codebase, requirements, missingArtifacts, warnings}` |
| `blueprint_phase_research_status` | Report discovery readiness for context, research, and UI-spec artifacts | `{hasContext, hasResearch, hasUiSpec, contextPath, researchPath, uiSpecPath, researchValid, researchIssues, suggestedRepairs, warnings}` |
| `blueprint_phase_artifact_read` | Read phase-scoped discovery artifacts such as `CONTEXT`, `DISCUSSION-LOG`, `RESEARCH`, or `UI-SPEC` | `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, reason}` |
| `blueprint_phase_artifact_write` | Persist substantive phase-scoped discovery artifact content with overwrite protection and research validation | `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, written, created, overwritten, status, validation, warnings}` |
| `blueprint_phase_plan_index` | Index plan files, execution readiness across waves, and explicit gap-closure targets | `{plans, waves, missingPlans, gapClosurePlans}` |
| `blueprint_phase_plan_read` | Read a phase-scoped plan artifact together with parsed metadata and validation signals | `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, validation, reason}` |
| `blueprint_phase_plan_write` | Persist substantive phase-scoped plan artifact content with overwrite protection and validation; optional `gap_closure: true` frontmatter marks an explicit gap-closure plan | `{phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, written, created, overwritten, status, validation, warnings}` |
| `blueprint_phase_summary_index` | Index execution summaries, validate them, and report completed versus pending plans | `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, summaries, completedPlans, pendingPlans, warnings}` |
| `blueprint_phase_summary_read` | Read a phase-scoped summary artifact together with linked plan metadata | `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, reason}` |
| `blueprint_phase_summary_write` | Persist substantive phase-scoped summary content for an existing plan | `{phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, linkedPlanPath, written, created, overwritten, status, issues, warnings}` |
| `blueprint_phase_validation_read` | Read a phase-scoped validation artifact and its execution-summary coverage | `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, summaryPaths, reason}` |
| `blueprint_phase_validation_write` | Persist a phase-scoped `VERIFICATION` or `UAT` artifact with overwrite protection and execution-aware prerequisite checks | `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, summaryPaths, written, created, overwritten, status, issues, warnings}` |
| `blueprint_phase_checkpoint_get` | Read the saved `discuss-phase` checkpoint for a phase | `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, path, checkpoint, reason}` |
| `blueprint_phase_checkpoint_put` | Persist a `discuss-phase` checkpoint JSON object for a phase using the richer resumability shape | `{phaseNumber, phasePrefix, phaseName, phaseDir, path, updated, warnings}` |
| `blueprint_phase_checkpoint_delete` | Delete a saved `discuss-phase` checkpoint after successful completion | `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, path, deleted, reason}` |

### Artifact Management

| Tool | Purpose | Returns |
|---|---|---|
| `blueprint_artifact_scaffold` | Create or seed artifacts from templates; use it for first-write scaffolding or reuse/refresh seeding, not as the final persistence layer for filled-in artifacts | `{createdFiles, reusedFiles, warnings}` |
| `blueprint_artifact_contract_read` | Read canonical artifact contracts, including scaffold templates, locked markers, and required headings | `{artifactId, contract}` or `{artifactId: null, contracts}` |
| `blueprint_artifact_list` | Enumerate known core, phase, codebase, and report artifacts | `{artifacts, reports, missing, warnings}` |
| `blueprint_codebase_artifact_write` | Persist substantive codebase mapping content for one of the seven `.blueprint/codebase/*.md` artifacts, with contract validation and overwrite protection | `{path, artifactId, written, created, overwritten, reused, status, issues, warnings}` |
| `blueprint_artifact_mutate_index` | Append or update canonical capture entries in Blueprint indexes such as backlog, notes, and todos, with duplicate detection, pending-todo inspection, and optional backlog stub reservation metadata | `{targetPath, createdEntryIds, matchedEntryIds, entries, updatedCounts, duplicateEntryIds, reservedPhase, summary, warnings}` |
| `blueprint_artifact_validate` | Validate Blueprint artifact structure and required fields | `{valid, issues, suggestedRepairs, warnings}` |
| `blueprint_artifact_summary_digest` | Build digests from saved artifacts plus optional code, tests, docs, and tracked-file inputs | `{digest, inputsUsed}` |
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
- `new-project` leans on project, config, state, `blueprint_artifact_contract_read`, `blueprint_artifact_validate`, and `blueprint_artifact_scaffold`.
- `map-codebase` uses `blueprint_project_status`, `blueprint_artifact_contract_read`, `blueprint_artifact_scaffold`, `blueprint_artifact_list`, `blueprint_artifact_summary_digest`, `blueprint_codebase_artifact_write`, and `blueprint_artifact_validate` to keep the seven-document bundle contract-read before seeding, treat scaffold as reuse-or-seed only, persist substantive mapping content through MCP instead of raw file edits, and validate the resulting bundle before concluding.
- `add-backlog` uses `blueprint_artifact_mutate_index` and, when the user explicitly reserves a parking-lot phase, `blueprint_artifact_scaffold`.
- `review-backlog` uses `blueprint_roadmap_promote_backlog`, `blueprint_artifact_mutate_index`, and `blueprint_state_update` to preview backlog candidates, append promoted roadmap phases, preserve backlog history through status transitions, and route the repo into `/blu-discuss-phase`.
- `explore` uses `blueprint_project_status`, `blueprint_artifact_mutate_index`, `blueprint_roadmap_add_phase`, and `blueprint_artifact_scaffold` to classify ideas before persistence, keep capture writes confirmation-gated, and scaffold the first phase context when a confirmed idea is promoted directly into the active roadmap.
- `discuss-phase` uses phase location/context, `blueprint_phase_plan_index`, `blueprint_artifact_contract_read`, discovery artifact read and write tools, checkpoint tools, scaffolding, and `blueprint_state_update` to keep the phase-discovery flow anchored in saved artifacts, checkpoint resumability, canonical plan-index and artifact-contract reads, and end-of-run state updates; it folds deferred ideas forward and does not claim a dedicated todo/backlog read path.
- `research-phase` uses phase location/context, research status, discovery artifact read and write tools, `blueprint_artifact_contract_read`, scaffolding, `blueprint_state_load`, `blueprint_command_catalog`, and `blueprint_state_update`.
- `ui-phase` uses phase readiness, the canonical UI-spec contract read, discovery artifact read and write tools, scaffolding, config, a bounded checker review loop, and state update tools.
- `plan-phase` uses the canonical `phase.plan` contract read, plan index, plan read and write tools, config, artifact validation, and state update tools. It keeps planner/checker guidance tied to the live `contract.authoringTemplate`, requires a requirements-coverage check before finalization, splits overly broad phases into prioritized waves when needed, and prefers synced state recomputation so `STATE.md` reflects the updated artifact inventory.
- `execute-phase` uses plan index/read, `blueprint_artifact_contract_read` for the phase.summary contract before summary authoring, summary index/read/write, config, artifact validation, and state update tools.
- `fast` uses `blueprint_project_status` and `blueprint_state_update` to keep trivial inline execution inside the implemented command surface without inventing extra Blueprint artifacts.
- `quick` uses `blueprint_project_status`, `blueprint_command_catalog`, `blueprint_artifact_report_write`, and `blueprint_state_update` to keep bounded quick runs report-backed and routed inside the implemented command surface.
- `validate-phase` and `verify-work` use summary index/read, validation read/write, `blueprint_artifact_contract_read`, config, artifact validation, and state update tools so their required tool shapes stay contract-derived.
- `add-tests` uses phase locate, summary index/read, validation read/write, artifact list/validate/report-write, and state update tools to keep repo test generation grounded in saved execution evidence while keeping Blueprint-owned persistence phase-scoped and report-backed.
- `pause-work` and `resume-work` use state load and update tools together with pause handoff read and write support.
- `list-phase-assumptions` uses `blueprint_phase_locate`, `blueprint_phase_context`, `blueprint_roadmap_read`, and `blueprint_project_status`.
- `add-phase` uses `blueprint_roadmap_read`, `blueprint_roadmap_add_phase`, `blueprint_artifact_scaffold`, and `blueprint_state_update`.
- `insert-phase` uses `blueprint_roadmap_read`, `blueprint_roadmap_insert_phase`, `blueprint_artifact_scaffold`, and `blueprint_state_update` to insert the next decimal phase after an existing integer anchor, record a durable `roadmapEvolutionNotes` entry in `STATE.md`, and route the repo back into `/blu-discuss-phase`.
- `remove-phase` uses `blueprint_roadmap_read`, `blueprint_phase_locate`, `blueprint_roadmap_remove_phase`, and `blueprint_state_update`, with `force: true` reserved for a separately confirmed execution-evidence removal path.
- `plan-milestone-gaps` uses `blueprint_roadmap_read`, `blueprint_artifact_list`, `blueprint_artifact_summary_digest`, `blueprint_roadmap_add_phase`, and `blueprint_state_update` to compare audit-backed requirement, integration, flow, and optional gaps, repair traceability where needed, and append grouped roadmap phases without touching code or git history.
- `audit-milestone` uses `blueprint_roadmap_read`, `blueprint_phase_summary_index`, `blueprint_artifact_list`, `blueprint_artifact_contract_read`, `blueprint_artifact_summary_digest`, and `blueprint_artifact_report_write` to compare roadmap intent against completed evidence and author `report.milestone-audit` with grouped gap sections plus traceability notes before routing gaps into implemented follow-up commands.
- `complete-milestone` uses `blueprint_roadmap_read`, `blueprint_artifact_list`, `blueprint_state_load`, `blueprint_artifact_contract_read`, `blueprint_artifact_summary_digest`, `blueprint_artifact_report_write`, and `blueprint_state_update` to turn the saved audit into `report.milestone-complete`, fail fast until `derivedStatus.milestoneAudit.readyForCompletion` is true, and route to `/blu-milestone-summary <milestone>`.
- `milestone-summary` uses `blueprint_roadmap_read`, `blueprint_artifact_list`, `blueprint_artifact_contract_read`, `blueprint_artifact_summary_digest`, `blueprint_artifact_report_write`, and `blueprint_state_update` to turn the saved audit plus completion evidence into `report.milestone-summary` and route to `/blu-new-milestone`.
- `new-milestone` uses `blueprint_roadmap_read`, `blueprint_artifact_contract_read`, `blueprint_artifact_summary_digest`, `blueprint_artifact_scaffold`, and `blueprint_state_update` to carry forward from the saved milestone summary, preserve historical phase artifacts, and scaffold the next whole-number phase context.
- `code-review` uses `blueprint_phase_locate`, `blueprint_artifact_list`, `blueprint_artifact_contract_read`, `blueprint_review_scope`, and `blueprint_review_record` to derive a deterministic repo-file scope from executed plans or explicit file paths and persist `XX-REVIEW.md` against the canonical review contract.
- `code-review-fix` uses `blueprint_phase_locate`, `blueprint_review_load_findings`, `blueprint_artifact_contract_read`, `blueprint_review_record`, and `blueprint_state_update` to load saved review findings, keep remediation bounded, persist `XX-REVIEW-FIX.md` against the canonical review-fix contract, and route follow-up through implemented commands only.
- `audit-fix` uses `blueprint_phase_locate`, `blueprint_artifact_list`, `blueprint_review_scope`, `blueprint_artifact_report_write`, `blueprint_artifact_mutate_index`, and `blueprint_state_update` to keep audit-driven remediation evidence-first (`--source`), bounded by severity and cap (`--severity`, `--max`), confirmation-gated for non-trivial mutation and todo capture, stop-on-first-failure in mutation mode, report-backed, and routed inside implemented follow-up commands.
- `secure-phase` uses `blueprint_phase_locate`, `blueprint_artifact_list`, `blueprint_phase_plan_index`, `blueprint_phase_plan_read`, `blueprint_artifact_contract_read`, and `blueprint_review_record` to read the canonical `review.security` contract before drafting `XX-SECURITY.md`, parse the saved phase threat model from executed plan evidence, keep the audit threat-model-bound instead of broad-scan-driven, and persist phase-scoped security evidence as `XX-SECURITY.md`, with the shared security layer enforcing prompt-boundary checks before the artifact is written.
- `review` uses `blueprint_phase_locate`, `blueprint_artifact_list`, `blueprint_phase_plan_index`, `blueprint_phase_plan_read`, and `blueprint_review_record` to read the saved phase plan set, keep reviewer availability explicit, and persist `XX-REVIEWS.md`.
- `ui-review` uses `blueprint_phase_locate`, `blueprint_artifact_list`, and `blueprint_review_record` to persist phase-scoped UI audit evidence as `XX-UI-REVIEW.md`.
- `pr-branch` uses `blueprint_project_status`, `blueprint_config_get`, `blueprint_artifact_summary_digest`, and `blueprint_artifact_report_write` to keep review-branch preparation evidence-backed, report-backed, and explicit about `.blueprint/` filtering before any git mutation; its maintenance flow should continue to apply the shared dirty-tree and resolved-target preflight checks before branch mutation.
- `ship` uses `blueprint_project_status`, `blueprint_phase_locate`, `blueprint_config_get`, `blueprint_artifact_list`, `blueprint_artifact_summary_digest`, `blueprint_artifact_report_write`, and `blueprint_state_update` to keep shipping evidence-backed, report-backed, explicit about push or PR mutation, and honest about the next safe follow-up when `gh` is unavailable; its maintenance flow should continue to apply the shared dirty-tree, scope, and report-before-mutate preflight checks.
- `undo` uses `blueprint_project_status`, `blueprint_phase_locate`, `blueprint_artifact_list`, `blueprint_artifact_summary_digest`, `blueprint_artifact_report_write`, and `blueprint_state_update` to keep revert previews evidence-backed, report-backed before git mutation, explicit about dependency impact, and aligned with safe `git revert` style execution instead of destructive history rewrites; its maintenance flow should continue to apply the shared dirty-tree, resolved-target, and report-before-mutate preflight checks.
- `cleanup` uses `blueprint_project_status`, `blueprint_roadmap_read`, `blueprint_artifact_list`, `blueprint_artifact_summary_digest`, `blueprint_artifact_report_write`, and `blueprint_state_update` to keep phase-directory archival evidence-backed, report-backed before filesystem mutation, and explicit about active-phase protection plus archive destination selection; its maintenance flow should continue to apply the shared dirty-tree, protected-scope, and report-before-mutate preflight checks.

## Planned Command Notes

- Planned and blocked command specs may reference the future tool families above as implementation contracts.
- Those commands remain non-routable until the tools are registered and the runtime catalog marks them `implemented`.

## Model-Facing Call Contracts

These notes are the shared prompt-facing contract for the current runtime. Command manifests, skills, agents, and command docs should follow them when they tell the model how to call Blueprint MCP tools safely.

### Numeric Phase And Artifact IDs

- Fields such as `phase`, `after`, and `planId` accept only numeric Blueprint references or numeric artifact ids.
- Omit `phase` only when a command intentionally wants the runtime to infer the current phase from `STATE.md` or the roadmap.
- Never pass phase directories, slugs, filenames, combined tokens such as `02-01`, or artifact frontmatter keys where the tool expects a numeric id.
- Treat returned `phaseNumber`, `phasePrefix`, `planId`, `phaseDir`, `path`, and similar fields as authoritative. Do not derive replacement ids or paths from chat text when the tool already returned the canonical value.

### Capture Index Mutations

- `blueprint_artifact_mutate_index` defaults to append mode when `action` is omitted. Append flows should pass `target` plus `entry.text`.
- Use only the returned `createdEntryIds`, `duplicateEntryIds`, `matchedEntryIds`, and `reservedPhase` fields as authoritative capture identifiers or reserved stub metadata. Do not invent `NOTE-*`, `TODO-*`, or `BACKLOG-*` ids manually.
- `reservePhaseStub` applies only to backlog append requests. When a reserved stub is created, the returned `reservedPhase.phaseNumber`, `reservedPhase.phaseDir`, and `reservedPhase.artifactPaths` are authoritative.
- Todo status changes must use `action: "update"` plus either `match.id` or exact `match.text`, and they must include `update.status`.
- Backlog or batch status changes should use `updates[]` with canonical entry ids from prior tool output, and `reservedPhase: null` is the supported way to clear consumed reservation metadata.

### Backlog Promotion

- `blueprint_roadmap_promote_backlog` should be called with `previewOnly: true`, or with no `backlogIds`, when the command wants a deterministic preview without mutation.
- Promotion calls should reuse only confirmed `backlogIds` returned by the preview result.
- Treat returned `promotedItems`, `selectedBacklogIds`, and `createdPhaseDirs` as authoritative. Do not invent promoted phase numbers or reserved-stub reuse paths manually.

### Scaffolding

- `blueprint_artifact_scaffold` accepts only supported repo-relative Blueprint artifact paths.
- `blueprint_artifact_contract_read` returns the runtime-owned canonical authoring contract object for a given artifact id such as `phase.research`, `phase.verification`, or `report.debug`; `contract.authoringTemplate` holds the authoring template.
- Do not pass bare artifact names such as `STACK`, absolute filesystem paths, or ad hoc report filenames.
- Use scaffolding only for first-write seeding or template regeneration. Do not treat scaffold output as the final persistent content for filled-in research, context, UI-spec, plan, summary, validation, or report artifacts.
- Treat returned `createdFiles` and `reusedFiles` as authoritative for what the tool actually touched.

### Roadmap Creation And Insertion

- `blueprint_roadmap_add_phase` accepts only `description` plus optional `cwd`.
- `blueprint_roadmap_insert_phase` accepts an integer anchor in `after` plus `description`.
- Do not precompute phase numbers, decimal suffixes, slugs, or phase directories in prompt logic. The tool owns numbering and conflict checks.
- After the tool returns, use the returned `afterPhaseNumber`, `phaseNumber`, `phasePrefix`, and `phaseDir` as authoritative when follow-on scaffolding or routing needs a concrete phase target.

### Phase Artifact Writes And Checkpoints

- `blueprint_phase_artifact_write` accepts numeric `phase`, enum `artifact`, and full `content`.
- Do not pass artifact filenames, `phaseDir`, or `phasePrefix` into `blueprint_phase_artifact_write`; the tool owns the artifact path.
- When normalizing authored phase artifacts, prefer `blueprint_artifact_contract_read` over copied prompt-local templates.
- Research writes validate in `strict` mode by default. Use `validationMode: "warn"` only when the command intentionally wants warnings without blocking the write attempt.
- Research writes should be normalized to Blueprint's exact `XX-RESEARCH.md` template before calling the tool, and angle-bracket placeholders must be replaced with real content.
- `blueprint_phase_checkpoint_put` requires `checkpoint` to be a JSON object that includes `completedAreas`, `remainingAreas`, `decisions`, `deferredIdeas`, `canonicalReferences`, and `resumeMeta`. The tool owns the checkpoint filename and location, and legacy saved checkpoints remain readable.
- Treat returned `path`, `written`, `created`, `overwritten`, and `status` fields as authoritative for artifact and checkpoint persistence.

### Plan, Summary, And Validation Artifacts

- `blueprint_phase_plan_write` omits `planId` to auto-assign the next plan slot. When targeting an existing plan, pass only the numeric plan id.
- `blueprint_phase_plan_index` and `blueprint_phase_plan_read` surface an explicit `gapClosure` signal from optional `gap_closure: true` plan frontmatter. `--gaps-only` should target those plans rather than inferring gap closure from missing summaries alone.
- `blueprint_phase_summary_write` requires numeric `phase`, numeric `planId`, and full summary `content`. The matching plan must already exist.
- `blueprint_phase_validation_write` requires numeric `phase`, enum `artifact` (`verification` or `uat`), and full validation content.
- Verification and UAT writes both require saved execution summaries. UAT also requires an existing verification artifact.
- Treat returned `path`, `linkedPlanPath`, `summaryPaths`, `planId`, `gapClosurePlans`, and `status` as authoritative. Do not invent plan or summary filenames manually.
- Validation reads and writes expose only summaries whose `**Plan:**` marker matches the linked plan path; invalid summaries stay out of `summaryPaths`.

### Review Scope And Review Persistence

- `blueprint_review_scope` accepts repo-relative file paths only. Absolute paths, directories, wildcards, and `.blueprint/**` paths are rejected or skipped.
- Omit `files` when the command wants review scope derived from executed plans and summaries.
- Review-family commands must use `blueprint_artifact_contract_read` to fetch the canonical review artifact contract before drafting or updating `XX-REVIEW.md`, `XX-REVIEW-FIX.md`, `XX-SECURITY.md`, `XX-REVIEWS.md`, or `XX-UI-REVIEW.md` instead of embedding hand-copied templates.
- `blueprint_review_record` requires numeric `phase`, enum `artifact`, and the full artifact `content`. The tool owns the final review filename.
- `blueprint_review_load_findings` defaults `artifact` to `code-review` when it is omitted.
- Treat returned `files`, `reportPath`, `counts`, `followUps`, `findings`, and `severityCounts` as authoritative review scope and review-artifact metadata.

### Config, Bootstrap, And Pause Handoff

- `blueprint_config_get` defaults `scope` to `effective`. `defaultsPath` is only an override for the host-global defaults file.
- `blueprint_config_set` defaults `scope` to `project`, and `patch` must be a JSON object.
- Use `blueprint_config_set` with `scope: "defaults"` only when the user explicitly wants saved-default changes.
- Use `blueprint_config_set_profile` instead of a generic config patch when the only intended mutation is `model_profile`.
- `blueprint_project_init` is the first persistent bootstrap write. `overwrite` requires explicit confirmation, and a structured `bootstrapSeed` is the supported way to pass authored startup context.
- `blueprint_pause_handoff_write` requires `currentState`. Other list fields are optional and normalized, and omitting `nextAction` lets the tool derive the safest current next action.
- Treat returned `configPath`, `updatedKeys`, `createdPaths`, `nextAction`, `path`, and `handoff` as authoritative.

### Digests And Reports

- `blueprint_artifact_summary_digest` accepts repo-relative `artifactPaths`, `docFiles`, `sourceFiles`, `testFiles`, and `trackedFiles`, and it can combine saved artifact summaries with live repo-file evidence in one digest.
- Do not pass absolute paths or already-normalized report paths into the digest tool.
- Treat returned `inputsUsed` as the authoritative digest scope that was actually summarized.
- Report-family commands should use `blueprint_artifact_contract_read` to fetch canonical report contracts when a known Blueprint report shape exists.
- `blueprint_artifact_report_write` accepts a bare `reportName` such as `audit-fix-3`, `ship-latest`, `undo-latest`, or `quick-run-latest`.
- Do not pass `.blueprint/reports/<name>.md`, absolute paths, or slash-separated report destinations into `blueprint_artifact_report_write`; the tool normalizes the slug and owns the final `path`.
- Treat returned `path`, `written`, `created`, `overwritten`, and `status` as authoritative for report persistence.

## Path Safety Rules

- All tools operate relative to the repo root or the locked host-global Blueprint directory.
- Config tools may read or write only `.blueprint/config.json` and `~/.<host>/blueprint/defaults.json`; they must not create ad hoc config files elsewhere.
- Tools must reject path traversal, absolute-path misuse for repo-relative inputs, null bytes, and symlink escapes.
- Tools should use shared safe parsing with size limits for config, checkpoint, and registry-style JSON inputs.
- Prompt-boundary-sensitive writes such as reports, phase artifacts, review artifacts, pause handoffs, and capture indexes should be checked through the shared security layer before persistence.
- Tools must not write into the installed extension directory as part of normal command execution.
