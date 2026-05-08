# `/blu-discuss-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Shared profile reference: `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md`
- Command behavior reference: `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md`
- Saved artifact schema authority: the live `contract.authoringTemplate` returned by `blueprint_artifact_contract_read`; any scaffold output is starter-only seed material and is never the final saved contract body
- Detailed Draw.io workflow: [`docs/diagrams/discuss-phase-workflow-end-to-end.drawio`](../diagrams/discuss-phase-workflow-end-to-end.drawio)

## Purpose


`discuss-phase` is Blueprint's command for gathering phase context through adaptive questioning before planning. It preserves the thinking-partner discovery loop while translating persistence and routing into Blueprint-native MCP tools: prior-context sweeps, answer validation and retry, assumptions-mode analysis, capability-gated sidecar research for one gray area, single-agent fallback, deferred-idea capture, checkpoint-per-area resumability, and validation/repair before completion. The detailed behavior lives in the runtime contract reference instead of being repeated here.


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
- Repo side effects: Writes only declared `.blueprint/` phase artifacts, checkpoints, and `STATE.md` through MCP tools.
- Blueprint does not create or manage repo-root `CONTEXT.md`; this command authors or repairs phase context only at `.blueprint/phases/<phase>/<XX>-CONTEXT.md`.
- In-flight discovery follows the shared profile until the run concludes or stops on a checkpoint or overwrite decision.
- The rich behavior contract lives at `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md`; the saved artifact schema remains the live `contract.authoringTemplate` returned by `blueprint_artifact_contract_read`, while scaffold output remains starter-only and must not survive verbatim into saved artifacts.


## Behavior Stages

1. `Resolve`: resolve the target phase and stop early when the phase is ambiguous or Blueprint prerequisites are missing.
2. `Read`: sweep phase context, roadmap state, artifact inventory, effective config, saved context or discussion artifacts, checkpoint state, and saved plan inventory before asking for fresh detail.
3. `Decide`: keep the current gray area, resume-versus-discard checkpoint posture, overwrite posture, and discussion mode explicit before branching.
4. `Execute`: run one-question `ask_user` branching, optionally use capability-gated sidecar research for one gray area, capture decisions, evidence, canonical references, deferred ideas, and short progress recaps one area at a time.
5. `Persist`: scaffold only missing discovery artifacts, treat scaffold text as disposable starter seed, persist substantive context or discussion content, refresh checkpoints per area, and update `STATE.md` through MCP only.
6. `Validate`: normalize drafts to the canonical `authoringTemplate`, strip scaffold literals and other placeholders from the final body, run the blocking anti-pattern check, repair any `blueprint_phase_artifact_write` validation issues, and keep plan-inventory warnings explicit before conclusion.
7. `Route`: summarize reused versus replaced artifacts, checkpoint disposition, deferred follow-ups, and the next safe implemented action loaded from refreshed state, without inferring a direct `/blu-plan-phase` handoff while research or UI gates still route elsewhere.


## Blueprint And Global State Reads

- effective Blueprint config through `blueprint_config_get`
- current phase plan inventory through `blueprint_phase_plan_index`


## Blueprint And Global State Writes

- `phase XX-CONTEXT.md`
- `optional phase XX-DISCUSSION-LOG.md`
- `optional shared phase XX-DISCUSS-CHECKPOINT.json`
- `.blueprint/STATE.md`
- The final context and discussion bodies must be normalized to the canonical `authoringTemplate` before write, then self-checked against that contract and blocked until any anti-patterns, contradictions, dropped deferred ideas, or preserved scaffold literals are corrected before save. If `blueprint_phase_artifact_write` returns `status: "invalid"` or validation issues, repair the same normalized draft from those returned issues and retry before treating the discussion as complete.
- Retry validation repair at most once for the same draft. If the same diagnostics repeat, stop, preserve the discuss checkpoint, report the exact diagnostics and next safe action, and do not inspect MCP source as the repair strategy.


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
- `blueprint_phase_checkpoint_get` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, path, checkpoint, ownerCommand, resumeMode, safeToResume, warnings, reason}`
- `blueprint_phase_checkpoint_put` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, path, updated, warnings}`
- `blueprint_phase_checkpoint_delete` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, path, deleted, reason}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`

## Artifact Persistence Contract

- Pass `phase` to `blueprint_phase_artifact_write` and `blueprint_phase_checkpoint_put` as the resolved numeric phase reference only, for example `"3"` or `3`.
- Read `blueprint_artifact_contract_read` with `artifactId: "phase.context"` before drafting or revising `XX-CONTEXT.md`.
- Read `blueprint_artifact_contract_read` with `artifactId: "phase.discussion-log"` before drafting or revising `XX-DISCUSSION-LOG.md`.
- Normalize the final context and discussion drafts to the returned `authoringTemplate` before writing, then self-check the normalized body against the contract and block the write if placeholder text, preserved scaffold literals, contradictions, missing canonical references, unsupported mode claims, or dropped deferred ideas remain.
- Use `blueprint_artifact_scaffold` only with repo-relative Blueprint artifact paths such as `.blueprint/phases/03-auth/03-CONTEXT.md`; bare names and absolute filesystem paths are invalid.
- Treat scaffold output as first-write seeding only. Persist the real final markdown through `blueprint_phase_artifact_write`, with literal scaffold placeholders, example bullets, and fill-in cues removed before save.
- Use `artifact: "context"` for `XX-CONTEXT.md` and `artifact: "discussion-log"` for `XX-DISCUSSION-LOG.md`. Pass the full final body and treat the returned `path` as authoritative instead of rebuilding filenames manually.
- Read checkpoints with `expectedOwnerCommand: "/blu-discuss-phase"` and `expectedMode: "discuss"`, then honor `safeToResume` and `warnings` before using saved state.
- `blueprint_phase_checkpoint_put` requires `checkpoint` to be a JSON object using the structured discuss checkpoint shape. Include `ownerCommand: "/blu-discuss-phase"`, `completedAreas`, `remainingAreas`, `decisions`, `deferredIdeas`, `canonicalReferences`, and `resumeMeta`, and keep resumability details inside `resumeMeta` with fields such as `mode`, `pendingTopics`, `completedTopics`, `currentQuestion`, `notes`, `resumeHint`, and `updatedAt`; for discuss checkpoints, `mode` must be `"discuss"`. Treat the returned checkpoint `path` as authoritative, do not try to serialize resumable state into markdown fields, and remember that the filename is a shared phase checkpoint path rather than proof of discuss ownership.
- Delete checkpoints with `expectedOwnerCommand: "/blu-discuss-phase"` and `expectedMode: "discuss"` so cleanup only removes discuss-owned continuation state from the shared checkpoint path.
- During the final synced `blueprint_state_update`, preserve the already resolved selected phase in `patch.currentPhase` together with `patch.activeCommand`; do not let sync fall back to the roadmap's current phase when the user explicitly chose another phase.
- Rich context authoring should preserve evidence behind decisions: options considered, selected answer or assumption, rationale, repo paths or saved artifacts used as evidence, consequences if an assumption is wrong, canonical refs, and deferred ideas. This density is required even when the command falls back to a single main agent with no subagent support.
- `/blu-discuss-phase` is the only lifecycle command that authors or repairs phase context. Research, UI, and planning commands read this artifact and route back here when it is missing, invalid, or unusable.


## Skills And Subagents


- Primary skill: `blueprint-phase-discovery`
- Required skill reference: `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md`
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
- When structured discovery choices help, use host-supported structured choices one focused question at a time instead of a plain-text questionnaire.
- Identify gray areas from repo evidence first, let the user choose which area to discuss next, and support iterative `next area` or `more questions` loops.
- Use `blueprint-researcher` only as a capability-gated, bounded, read-only sidecar for a single gray area or assumptions pass when the host exposes it and extra evidence would materially improve the choices. Ask for gray-area memo output with options, tradeoffs, complexity or impact surface, recommendation rationale, confidence, and evidence; do not ask for `phase.research` or `XX-RESEARCH.md` content from `/blu-discuss-phase`. If no suitable subagent is available, the main agent must continue one area at a time, compress carry-forward context, checkpoint, and preserve the same artifact depth.
- Follow the shared long-running phase-discovery profile for stage visibility, next-safe-action visibility, and session-local helper fallback behavior.
- Inspect the saved plan inventory before rewriting context and warn that refreshed context does not rewrite existing plans unless the user re-runs `/blu-plan-phase`.
- Keep follow-on routing inside the implemented runtime catalog.


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


## Failure Modes And Recovery


- Explain exactly which phase artifact is missing and which command creates it.
- Write follow-up state back into `.blueprint/` instead of dropping context on failure.


## Acceptance Criteria


- Reads and writes only the selected phase scope.
- Updates `STATE.md` whenever the next-step signal changes and leaves the end-of-run `STATE.md` update legible.
- Keeps the explicitly selected phase pinned through the final synced state refresh instead of re-deriving phase routing from the roadmap alone.
- Creates or updates only the declared artifacts for this command.
- Persists real phase decisions into `XX-CONTEXT.md`, not only scaffold placeholders.
- Reads actual saved context and discussion content, plus the canonical `phase.context` and `phase.discussion-log` contracts, before drafting updates.
- Warns clearly when refreshed discovery leaves existing saved plans unchanged until `/blu-plan-phase` is run again.
- Captures canonical references plus deferred or scope-creep ideas when they surface during gray-area discussion.
- Captures prior-context sweep findings, deferred ideas, codebase scout notes, and per-area checkpoint progress when they surface during gray-area discussion.
- Blocks save-time drift when the normalized body still contains placeholder text, contradictions, missing canonical references, unsupported mode claims, or dropped deferred ideas, and repairs any returned write validation issues before completion.
- Supports capability-gated subagents for bounded one-area evidence work and an explicit single-agent fallback with carry-forward compression, checkpointing, and equally rich saved context.
- Uses checkpoint persistence only as a resumability aid and deletes the checkpoint after successful completion.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Direct `discuss-phase` happy-path fixture.
