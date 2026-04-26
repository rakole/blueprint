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
- `plan-phase` uses the shared long-running-mutation posture: resolve the target phase, read live planning inputs, decide the reuse/revise/replace gate, execute bounded drafting, persist through MCP, validate the saved artifact, and route to the next safe implemented follow-up.
- When saved plans already exist, keep the pending gate explicit and require a structured `reuse`, `revise`, or `replace` gate before any overwrite path.
- The rich local runtime contract lives at `skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md`; it defines the detailed stage mapping, MCP call control flow, anti-shallow plan authoring rules, capability-gated subagent path, no-subagent fallback, validation repair behavior, output quality criteria, and completion criteria.


## Purpose


`plan-phase` is Blueprint's command for create a detailed phase plan with verification loop. Blueprint now implements it with the plan index plus dedicated plan read/write/validate tools so it can read existing plans, read the actual current context and relevant discovery artifact content, run a requirements-coverage check before finalization, persist real `XX-YY-PLAN.md` content, validate the saved plan set in phase scope, and update state deterministically while staying host-native.

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
- `optional plan-check report in .blueprint/reports/`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_context` -> `{phase, codebase, requirements, missingArtifacts}`
- `blueprint_phase_research_status` -> `{hasContext, hasResearch, hasUiSpec}`
- `blueprint_phase_artifact_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, reason}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract}` or `{artifactId: null, contracts}`
- `blueprint_phase_plan_index` -> `{plans, waves, missingPlans}`
- `blueprint_phase_plan_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, validation, reason}`
- `blueprint_phase_plan_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, written, created, overwritten, status, validation, warnings}`
- `blueprint_phase_plan_validate` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, status, issues, warnings, planCount, planIds, roadmapRequirementIds, coveredRequirementIds, uncoveredRequirementIds, unexpectedRequirementIds, missingDependencyIds, cyclicDependencyPlanIds}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Plan Persistence Contract


- Read the canonical `phase.plan` contract through `mcp_blueprint_blueprint_artifact_contract_read` with `artifactId: "phase.plan"` before drafting or revising `XX-YY-PLAN.md`, and normalize the final draft to `contract.authoringTemplate`. Use the live contract object as the source of truth for the plan shape and required wording rather than a copied local template.
- Persist final plan bodies through `blueprint_phase_plan_write`; do not write raw `.blueprint/` plan files directly.
- Do not seed `XX-YY-PLAN.md` with scaffold placeholders; draft the finished plan body before the first write.
- `/blu-plan-phase` writes must use `validationMode: "strict"`; do not use warn-mode writes from this command.
- Read the actual current `XX-CONTEXT.md` content and any relevant discovery artifacts through `blueprint_phase_artifact_read` before drafting or revising plans; do not rely on readiness metadata alone.
- Before finalization, map every declared phase requirement and must-have to explicit plan coverage or a named blocker. If the phase is too broad for one coherent plan, split/prioritize it into smaller dependency-aware waves before writing.
- Author plans at execution-prompt quality, not outline quality: concrete repo-relative `Read First` entries, concrete target-state `Action` text, grep/test/CLI/file-read-verifiable `Acceptance Criteria`, goal-backward must-haves with observable truths/artifacts/key links, and full-fidelity coverage of locked context decisions.
- Do not silently reduce scope with `v1`, placeholder, static-for-now, future-wiring, stub, or "will be wired later" language. If full fidelity does not fit, split, prioritize with user confirmation, or block.
- Use `blueprint-planner` and `blueprint-checker` only when suitable planning/workflow analysis agents are available; otherwise follow the runtime contract's sequential no-subagent fallback, drafting and validating one plan or topic at a time with compressed carry-forward context.
- Do not use browser, web-search-only, or generic browsing agents as substitutes for codebase or workflow planning agents.
- If planner/checker revisions keep failing after a bounded number of passes, stop the loop, preserve the best coherent draft, and report the exact unresolved requirement or split point instead of looping indefinitely.
- After the final write, run `blueprint_phase_plan_validate` so scoped dependency drift, slot/title mismatches, cycles, and roadmap coverage gaps are surfaced before completion.
- If `blueprint_phase_plan_write` or final scoped plan validation rejects a plan, repair against the live contract and retry through MCP before presenting completion.
- Pass `phase` as the resolved phase number, for example `"3"` or `3`.
- Pass `content` as the full finalized `XX-YY-PLAN.md` body, not scaffold placeholder text.
- Omit `planId` to let Blueprint auto-assign the next available plan slot.
- If targeting a specific plan, pass only the numeric plan id. Prefer zero-padded string values such as `"01"` so the request matches Blueprint artifact naming, but numeric inputs such as `1` are also accepted.
- Do not derive `planId` manually from a scaffold path and do not pass phase slugs, filenames, or combined tokens such as `02-01` as `planId`.


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


- External dependencies:
- web docs for unstable technical choices


## Shell Risk Profile

- Medium: can replace plans and change downstream execution order.

## User Prompts And Confirmation Gates


- Confirm destructive replanning when plans already exist.
- Prefer reusing the existing plan index and reading existing plan files before creating replacements.
- Use `ask_user` for overwrite confirmation and any reuse/revise/replace decision when one or more plan files already exist.


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
- Uses the plan index plus dedicated plan read/write/validate tools to persist actual plan content instead of scaffold-only placeholders.
- Uses the scoped plan validation tool to validate the saved plan set instead of relying on a global artifact sweep.
- Reads actual current context content and relevant discovery artifact content before drafting or revising plans instead of relying on status-only discovery signals.
- Reads the canonical `phase.plan` contract and normalizes the final draft to `contract.authoringTemplate` before writing.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Derives research, plan-check, Nyquist, UI-gate, and planning-confirmation behavior from normalized effective config instead of re-deriving defaults inside the command.
- Keeps the planner/checker loop bounded, requirements-aware, and split-friendly when the phase is too broad for a single coherent plan.
- Reads the live `phase.plan` contract before writing instead of copying local template text.
- Loads the local plan-phase runtime contract and applies its anti-shallow output criteria, no-subagent fallback, and validation repair loop.


## Test Cases


- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Config-conditioned planning fixture with research or UI gating disabled.
- Existing-plan overwrite and plan-index refresh fixture.
- Direct `plan-phase` happy-path fixture.
