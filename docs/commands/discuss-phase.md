# `/blu-discuss-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`discuss-phase` is Blueprint's command for gather phase context through adaptive questioning before planning. It is not a claim of full GSD parity; instead, the repaired Blueprint Phase 3 slice keeps the useful discovery intent while using Blueprint-specific replacements for the missing safeguards and must-haves: prior-context sweeps across saved phase artifacts and codebase scout summaries; answer validation and retry; stronger assumptions-mode analysis; methodology-shaped gray-area lenses; folding deferred ideas into the saved record; checkpoint-per-area behavior; progress recaps that keep the session legible; and a blocking anti-pattern check before save. The contract does not promise a dedicated todo/backlog file crawl; any follow-up references only carry forward when they are already present in the saved discovery record. It still reads actual saved discovery context before questioning, persists substantive context content and resumable checkpoint state through dedicated MCP tools, and normalizes the final context and discussion drafts to the canonical `authoringTemplate` before write. It restores the intended gray-area conversation loop while still deferring legacy power-mode, chain-mode, auto-mode, or auto-advance behavior until later substrate exists. In Blueprint it stays host-native, delegates persistence to documented MCP tools, and keeps the repo-side contract explicit enough that this command can be repaired without broadening runtime exposure elsewhere.


## Command Path And Examples

- CLI command path: `/blu-discuss-phase`
- Root router form: `/blu discuss-phase`
- Argument hint: `<phase>`
- `/blu-discuss-phase 3`
- `/blu discuss-phase`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase must exist in `.blueprint/ROADMAP.md`.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads

- effective Blueprint config through `blueprint_config_get`
- current phase plan inventory through `blueprint_phase_plan_index`


## Blueprint And Global State Writes

- `phase XX-CONTEXT.md`
- `optional phase XX-DISCUSSION-LOG.md`
- `optional phase XX-DISCUSS-CHECKPOINT.json`
- `.blueprint/STATE.md`
- The final context and discussion bodies must be normalized to the canonical `authoringTemplate` before write, then self-checked against that contract and blocked until any anti-patterns, contradictions, or dropped deferred ideas are corrected before save.


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_context` -> `{phase, projectBrief, requirementsGrounding, workflowPosture, codebase, requirements, missingArtifacts, warnings}`
- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_phase_plan_index` -> `{plans, waves, missingPlans}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract, authoringTemplate, validation, warnings}`
- `blueprint_phase_artifact_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, reason}`
- `blueprint_phase_artifact_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, written, created, overwritten, warnings}`
- `blueprint_phase_checkpoint_get` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, path, checkpoint, reason}`
- `blueprint_phase_checkpoint_put` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, path, updated, warnings}`
- `blueprint_phase_checkpoint_delete` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, path, deleted, reason}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Artifact Persistence Contract

- Pass `phase` to `blueprint_phase_artifact_write` and `blueprint_phase_checkpoint_put` as the resolved numeric phase reference only, for example `"3"` or `3`.
- Read `blueprint_artifact_contract_read` with `artifactId: "phase.context"` before drafting or revising `XX-CONTEXT.md`.
- Read `blueprint_artifact_contract_read` with `artifactId: "phase.discussion-log"` before drafting or revising `XX-DISCUSSION-LOG.md`.
- Normalize the final context and discussion drafts to the returned `authoringTemplate` before writing, then self-check the normalized body against the contract and block the write if placeholder text, contradictions, missing canonical references, unsupported mode claims, or dropped deferred ideas remain.
- Use `blueprint_artifact_scaffold` only with repo-relative Blueprint artifact paths such as `.blueprint/phases/03-auth/03-CONTEXT.md`; bare names and absolute filesystem paths are invalid.
- Treat scaffold output as first-write seeding only. Persist the real final markdown through `blueprint_phase_artifact_write`.
- Use `artifact: "context"` for `XX-CONTEXT.md` and `artifact: "discussion-log"` for `XX-DISCUSSION-LOG.md`. Pass the full final body and treat the returned `path` as authoritative instead of rebuilding filenames manually.
- `blueprint_phase_checkpoint_put` requires `checkpoint` to be a JSON object using the structured discuss checkpoint shape. Include `completedAreas`, `remainingAreas`, `decisions`, `deferredIdeas`, `canonicalReferences`, and `resumeMeta`, and keep resumability details inside `resumeMeta` with fields such as `mode`, `pendingTopics`, `completedTopics`, `currentQuestion`, `notes`, `resumeHint`, and `updatedAt`. Treat the returned checkpoint `path` as authoritative, and do not try to serialize resumable state into markdown fields.


## Skills And Subagents


- Primary skill: `blueprint-phase-discovery`
- Optional subagents:
- `blueprint-researcher`


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/new-project.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Medium: can replace or extend phase context artifacts.

## User Prompts And Confirmation Gates


- Confirm overwrite when a context artifact already exists.
- Resume from a saved checkpoint by default when one exists and the user has not explicitly asked to discard it.
- When structured discovery choices help, prefer Gemini CLI's built-in `ask_user` dialog asked one focused question at a time instead of a plain-text questionnaire.
- Identify gray areas from repo evidence first, let the user choose which area to discuss next, and support iterative `next area` or `more questions` loops.
- Inspect the saved plan inventory before rewriting context and warn that refreshed context does not rewrite existing plans unless the user re-runs `/blu-plan-phase`.
- Do not advertise follow-on execution or planning flows as runnable until those commands are implemented in the runtime catalog.


## Edge Cases


- The target phase is omitted or ambiguous while multiple active phases exist.
- Expected prior artifacts exist but are stale, incomplete, or inconsistent with `ROADMAP.md`.
- `workflow.discuss_mode` may switch the command into an evidence-first assumptions flow rather than an interview-style loop.
- `workflow.skip_discuss=true` should shorten the discussion path instead of pretending no context capture is needed.
- Earlier phase context artifacts may contain canonical references or deferred ideas that should be reused instead of re-elicited.
- When answers are vague, incomplete, or inconsistent with saved context, retry the question with a narrower prompt instead of accepting them as final.
- Use structured gray-area lenses such as scope, tradeoffs, dependencies, risks, reuse, implementation order, and methodology so the discussion stays grounded in Blueprint-friendly decisions.
- Give short progress recaps as the session moves from one area to the next so the conversation stays legible.
- Fold deferred ideas into the saved context or discussion log rather than dropping them on the floor.
- Fold deferred ideas into the saved context or discussion log rather than dropping them on the floor.


## Failure Modes And Recovery


- Explain exactly which phase artifact is missing and which command creates it.
- Write follow-up state back into `.blueprint/` instead of dropping context on failure.


## Acceptance Criteria


- Reads and writes only the selected phase scope.
- Updates `STATE.md` whenever the next-step signal changes and leaves the end-of-run `STATE.md` update legible.
- Creates or updates only the declared artifacts for this command.
- Persists real phase decisions into `XX-CONTEXT.md`, not only scaffold placeholders.
- Reads actual saved context and discussion content, plus the canonical `phase.context` and `phase.discussion-log` contracts, before drafting updates.
- Warns clearly when refreshed discovery leaves existing saved plans unchanged until `/blu-plan-phase` is run again.
- Captures canonical references plus deferred or scope-creep ideas when they surface during gray-area discussion.
- Captures prior-context sweep findings, deferred ideas, codebase scout notes, and per-area checkpoint progress when they surface during gray-area discussion.
- Blocks save-time drift when the normalized body still contains placeholder text, contradictions, missing canonical references, unsupported mode claims, or dropped deferred ideas.
- Uses checkpoint persistence only as a resumability aid and deletes the checkpoint after successful completion.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Direct `discuss-phase` happy-path fixture.
