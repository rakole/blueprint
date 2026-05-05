# `/blu-plan-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `plan-phase` uses the shared long-running-mutation posture. Keep the detailed behavior in `skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md` and keep this command doc focused on the user-facing surface and MCP boundaries.
- When saved plans would be revised or replaced, keep the pending gate explicit and require a structured `reuse`, `revise`, or `replace` decision before the overwrite path. Additive new plan ids may proceed without that gate when no saved plan body will be overwritten.
- The rich local runtime contract lives at `skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md`; it defines the detailed stage mapping, MCP call control flow, anti-shallow plan authoring rules, capability-gated subagent path, no-subagent fallback, validation repair behavior, output quality criteria, and completion criteria.


## Purpose


`plan-phase` is Blueprint's command for creating a detailed phase plan with a verification loop. Blueprint now implements it with the plan index plus dedicated plan read/schema-context/model-validation/write/validate tools so it can read existing plans, read the actual current context and relevant discovery artifact content, run schema-backed requirements/evidence/dependency checks before finalization, persist real `XX-YY-PLAN.md` content from a structured `phase.plan` model, validate the saved plan set in phase scope, and update state deterministically while staying host-native.

Interactive planning UX rules:
- Prefer Gemini CLI's built-in `ask_user` dialog over plain assistant prose whenever you need overwrite confirmation or a structured reuse/revise/replace decision about an existing plan.
- Default to one focused question per `ask_user` call.
- For structured decisions, use `ask_user` with `type: "choice"`, 2-4 labeled options, concise descriptions, and a placeholder such as `Type your own answer...` so the built-in custom-answer path stays open.


## Command Path And Examples

- CLI command path: `/blu-plan-phase`
- Root router form: `/blu plan-phase`
- Argument hint: `[phase]`
- `/blu-plan-phase 3`
- `/blu plan-phase`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase must exist and usually should already have context and research.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and updates `.blueprint/STATE.md` through MCP.
- In-flight planning should keep the resolved scope, active stage, pending gate, execution mode, and next safe action legible while the run is still live.


## Blueprint And Global State Reads


- `.blueprint/STATE.md`
- `.blueprint/config.json`


## Blueprint And Global State Writes


- `one or more XX-YY-PLAN.md files`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_context` -> `{phase: {roadmap}, codebase, requirements, missingArtifacts}`
- `blueprint_phase_research_status` -> `{hasContext, hasResearch, hasUiSpec, hasUsableContext, hasUsableResearch, hasUsableUiSpec, contextValid, contextIssues, researchValid, researchIssues, uiSpecValid, uiSpecIssues, planningReadiness}`
- `blueprint_phase_artifact_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, reason}`
- `blueprint_phase_validation_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, summaryPaths, validation, reason}`
- `blueprint_review_load_findings` -> `{findings, severityCounts, followUps, path, warnings}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract}` or `{artifactId: null, contracts}`
- `blueprint_phase_plan_index` -> `{plans, waves, missingPlans}`
- `blueprint_phase_plan_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, validation, reason}`
- `blueprint_phase_plan_authoring_context` -> `{status, phase, planId, path, schemaPath, baseSchema, taskSchema, knownRequirements, knownEvidenceArtifacts, allowedDependencyPlanIds}`
- `blueprint_phase_plan_validate_model` -> `{status, valid, phase, planId, path, schemaPath, taskSchema, diagnostics, normalizedModel, renderPreview, warnings}`
- `blueprint_phase_plan_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, written, created, overwritten, status, validation, warnings}`
- `blueprint_phase_plan_validate` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, status, issues, warnings, planCount, planIds, roadmapRequirementIds, coveredRequirementIds, uncoveredRequirementIds, unexpectedRequirementIds, missingDependencyIds, cyclicDependencyPlanIds}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Plan Persistence Contract


- Read the canonical `phase.plan` contract through `mcp_blueprint_blueprint_artifact_contract_read` with `artifactId: "phase.plan"` and the narrowed task schema through `blueprint_phase_plan_authoring_context` before drafting or revising plans. Use `contract.modelContract.schemaPath`, `contract.modelContract.jsonSchema`, and `phase_plan_authoring_context.taskSchema` as the model-authoring authority rather than a copied local template.
- Read the actual current `XX-CONTEXT.md` content and any relevant discovery artifacts through `blueprint_phase_artifact_read` before drafting or revising plans; do not rely on readiness metadata alone. Read saved validation evidence through `blueprint_phase_validation_read` and saved review findings through `blueprint_review_load_findings` when those artifacts exist before replanning around them.
- Use saved research for unstable technical choices. If needed research is missing or stale under the active gates, route to `/blu-research-phase` instead of browsing live web docs during planning.
- Treat `blueprint_phase_research_status.planningReadiness` as the config-aware pre-draft handoff gate. If it reports `readyForPlanPhase=false`, route to its `nextSafeAction` before drafting. If it reports `readyForPlanPhase=true`, do not block only because raw missing-artifact or suggested-repair fields mention research or UI artifacts that normalized config disabled.
- Validate the structured model through `blueprint_phase_plan_validate_model`, then persist the same model through `blueprint_phase_plan_write`; do not write raw `.blueprint/` plan files directly. Re-read `blueprint_phase_plan_authoring_context` immediately before each model validation/write, especially after a successful plan write, because saved plan files are intentional known evidence artifacts for later plan slots. `/blu-plan-phase` writes must use `validationMode: "strict"` and `authoringMode: "model-only"`, and must not pass Markdown `content`; do not use warn-mode writes or Markdown fallback from this command.
- After the final write, run `blueprint_phase_plan_validate` so scoped dependency drift, slot/title mismatches, cycles, and roadmap coverage gaps are surfaced before completion. If model validation, `blueprint_phase_plan_write`, or final scoped plan validation rejects a plan, repair all diagnostics against the live task schema and contract in one pass and retry through MCP before presenting completion.
- When `workflow.plan_check=true`, run the bounded review loop from the runtime contract before finalization: use `blueprint-checker` when suitable, otherwise use the inline fallback. When `workflow.plan_check=false`, skip checker review entirely and state that the config disabled it.
- Pass `phase` as the resolved phase number, for example `"3"` or `3`.
- Pass `model` as the full validated structured `phase.plan` JSON object, not scaffold placeholder text or Markdown.
- Omit `planId` to let Blueprint auto-assign the next available plan slot.
- If targeting a specific plan, pass only the numeric plan id. Use the JSON string value `planId: "01"` or numeric value `planId: 1`, never the double-encoded string `planId: "\"01\""`.
- Do not derive `planId` manually from a scaffold path and do not pass phase slugs, filenames, or combined tokens such as `02-01` as `planId`.
- When omitting `planId` to add a new plan and no saved plan body will be overwritten, do not force a reuse/revise/replace gate just because other plans already exist for the phase.


## Skills And Subagents


- Primary skill: `blueprint-phase-planning`
- Optional subagents:
- `blueprint-planner`
- `blueprint-checker`


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/new-project.md`
- `docs/commands/discuss-phase.md`
- `docs/commands/research-phase.md`


## External Shell Or Git Dependencies


- No live web dependency: use saved research for unstable technical choices, or route back to `/blu-research-phase` when the plan still needs fresh external evidence.


## Shell Risk Profile

- Medium: can replace plans and change downstream execution order.

## User Prompts And Confirmation Gates


- Confirm destructive replanning when the current write would revise or replace saved plans.
- Prefer reusing the existing plan index and reading existing plan files before creating replacements.
- Use `ask_user` for overwrite confirmation and any reuse/revise/replace decision that would mutate an existing saved plan body or the saved plan set.


## Edge Cases


- The target phase is omitted or ambiguous while multiple active phases exist.
- Expected prior artifacts exist but are stale, incomplete, or inconsistent with `ROADMAP.md`.
- Existing plan files conflict with the current roadmap or are missing required wave coverage.


## Failure Modes And Recovery


- Explain exactly which phase artifact is missing and which command creates it.
- Write follow-up state back into `.blueprint/` instead of dropping context on failure.
- If config disables optional planning steps such as research or UI gating, report that those behaviors were skipped because of normalized `workflow.*` settings rather than undocumented defaults.


## Acceptance Criteria


- Reads and writes only the selected phase scope.
- Updates `STATE.md` whenever the next-step signal changes and prefers synced recomputation after persistence with `base: "synced"` so routing follows the updated artifact inventory.
- Creates or updates only the declared artifacts for this command.
- Uses the plan index plus dedicated plan read/schema-context/model-validation/write/validate tools to persist actual plan content instead of scaffold-only placeholders.
- Uses the scoped plan validation tool to validate the saved plan set instead of relying on a global artifact sweep.
- Reads actual current context content and relevant discovery artifact content before drafting or revising plans instead of relying on status-only discovery signals.
- Reads the canonical `phase.plan` contract and narrowed task schema before writing.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Derives research, plan-check, Nyquist, UI-gate, and planning-confirmation behavior from normalized effective config instead of re-deriving defaults inside the command.
- Keeps the plan-check loop conditional, bounded, requirements-aware, and split-friendly when the phase is too broad for a single coherent plan.
- Reads the live `phase.plan` schema contract before writing instead of copying local template text.
- Loads the local plan-phase runtime contract and applies its anti-shallow output criteria, no-subagent fallback, and validation repair loop.


## Test Cases


- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Config-conditioned planning fixture with research or UI gating disabled.
- Existing-plan overwrite and plan-index refresh fixture.
- Direct `plan-phase` happy-path fixture.
