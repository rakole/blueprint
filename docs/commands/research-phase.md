# `/blu-research-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Rich behavior reference: `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `research-phase` uses the shared long-running-mutation posture for topic-strand phase research: keep `Resolve`/`Read`/`Decide`/`Execute`/`Persist`/`Validate`/`Route` narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, use Gemini-native `update_topic` and `write_todos` for non-trivial multi-strand research without turning them into persistence, and when those helpers are unavailable fall back to short progress recaps plus MCP-backed checkpoints and `STATE.md` instead of claiming they ran.
- Keep the in-flight research posture honest while the run is live:
  - resolved scope: the selected phase, current context and research reuse-versus-update posture, codebase-bundle availability, and the topic strand currently in progress
  - active stage: the current shared stage label behind the research pass
  - pending gate: missing or ambiguous phase resolution, `view`/`skip`/`update` choice, resume-versus-discard checkpoint choice, overwrite confirmation, validation blocker, external-check confirmation when policy is `ask`, or missing external confirmation for a claim the repo cannot settle
  - execution mode: repo-evidence-only synthesis when `research.external_sources` is `off`, confirmation-gated repo-plus-external verification when it is `ask`, or repo-plus-external verification when it is `auto`, plus fresh versus resumed checkpoint posture
  - next safe action: continue the current strand, resume from the saved checkpoint, revisit context, move to `/blu-plan-phase` when refreshed state and the runtime catalog support it, or fall back to `/blu-progress` when planning or UI follow-up is still blocked


## Purpose


`research-phase` is Blueprint's command for research how to implement a phase as a standalone discovery flow that usually feeds `/blu-plan-phase`. In Blueprint it stays host-native, delegates persistence to documented MCP tools, must honor the effective `research.external_sources` policy before any external verification, and must read the actual current context content before drafting planner-friendly, cited, confidence-tagged phase research rather than a scaffold-only placeholder.


## Command Path And Examples

- CLI command path: `/blu-research-phase`
- Root router form: `/blu research-phase`
- Argument hint: `[phase]`
- `/blu-research-phase 3`
- `/blu research-phase`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase must exist.


## Outputs


- User-facing result: a concise summary of whether existing research was viewed, reused, created, or updated, plus the next logical action when applicable.
- Repo side effects: writes validated `XX-RESEARCH.md` content when research changes, may refresh the shared phase checkpoint with research-owned continuation state during pauses or inconclusive runs, and updates `.blueprint/STATE.md`.
- In-flight research should keep the resolved scope, active stage, pending gate, execution mode, and next safe action legible until the run concludes, pauses on a checkpoint, or stops on a confirmation or validation gate.

## Behavior Stages

1. `Resolve`: resolve the target phase, confirm current artifact posture, and stop early when the phase is ambiguous or Blueprint prerequisites are missing.
2. `Read`: inspect phase context, current `XX-CONTEXT.md`, existing `XX-RESEARCH.md`, checkpoint state, saved codebase summaries, and refreshed state before any drafting or overwrite path. Missing `XX-CONTEXT.md` is a visible gate, not a silent fallback.
3. `Decide`: keep invalid-research repair posture, valid `view`/`skip`/`update`, resume-versus-discard checkpoint posture, overwrite posture, and `research.external_sources` policy (`off`/`ask`/`auto`) explicit before branching.
4. `Execute`: work one topic-sized strand at a time, compare repo evidence against any needed parent-supplied external evidence packets when policy allows it, and give short progress recaps while the session is live.
5. `Persist`: draft directly from the canonical `authoringTemplate`, reserve scaffolding for deliberate placeholder creation only, persist resumable checkpoint state when the run pauses or remains inconclusive, write final research through MCP only, and still refresh `STATE.md` on valid non-writing exits.
6. `Validate`: normalize the draft to the canonical `phase.research` template, block on missing required sections or placeholders, require explicit source dates or a clear `not externally checked` marker in `## State Of The Art`, and keep unresolved evidence gaps explicit instead of faking certainty.
7. `Route`: summarize viewed versus reused versus updated research, checkpoint disposition, warnings, and the next safe implemented action.


## Blueprint And Global State Reads


- `.blueprint/STATE.md`
- current phase `XX-CONTEXT.md` content through `blueprint_phase_artifact_read`


## Blueprint And Global State Writes


- `phase XX-RESEARCH.md`
- `optional shared phase checkpoint JSON owned by research-phase`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_context` -> `{phase, projectBrief, requirementsGrounding, workflowPosture, codebase, requirements, missingArtifacts, warnings}` where `workflowPosture.research.externalSources` mirrors the effective `research.external_sources` policy
- `blueprint_phase_research_status` -> `{hasContext, hasResearch, hasUiSpec, contextPath, researchPath, uiSpecPath, researchValid, researchIssues, suggestedRepairs, warnings}`
- `blueprint_phase_artifact_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, reason}`
- `blueprint_phase_artifact_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, written, created, overwritten, status, validation, warnings}`
- `blueprint_phase_checkpoint_get` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, path, checkpoint, ownerCommand, resumeMode, safeToResume, warnings, reason}`
- `blueprint_phase_checkpoint_put` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, path, updated, warnings}`
- `blueprint_phase_checkpoint_delete` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, path, deleted, reason}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_command_catalog` -> `{commands, waves, aliases}`
- `blueprint_state_update` -> `{updatedFields, statePath, warnings}`

## Research Persistence Contract

- Pass `phase` to `blueprint_phase_artifact_write` as the resolved numeric phase reference only, for example `"3"` or `3`.
- Use `blueprint_artifact_scaffold` only with the repo-relative Blueprint research artifact path for the selected phase. Bare names such as `RESEARCH` and absolute paths are invalid.
- Read `blueprint_config_get` with `scope: "effective"` before any external verification decision. Treat `config.research.external_sources` as the source of truth and `blueprint_phase_context.workflowPosture.research.externalSources` as the surfaced mirror inside the phase bundle.
- `research.external_sources: "off"` means no live external lookup; keep the run repo-only and mark freshness-sensitive claims as not externally checked.
- `research.external_sources: "ask"` means stop for confirmation before any official-doc or other external verification.
- `research.external_sources: "auto"` allows official-doc or explicit external verification when repo evidence cannot settle the claim.
- Read the canonical `phase.research` contract through `blueprint_artifact_contract_read` with `artifactId: "phase.research"` before drafting or revising `XX-RESEARCH.md`.
- Treat the live response as `{artifactId, contract}` and use `contract.authoringTemplate` plus `contract.freehandPolicy` as the authoritative fields when normalizing or deciding whether extra top-level headings are allowed.
- Ground repo truth in `blueprint_phase_context`, the actual saved `XX-CONTEXT.md` body, existing `XX-RESEARCH.md`, and any saved `.blueprint/codebase/` summaries before consulting external sources.
- Use official docs or explicitly supplied external references only for claims the repo cannot settle, and keep repo-derived evidence distinct from external or web-derived evidence in the draft, recommendations, and `## Sources`.
- The parent command, not `blueprint-researcher`, must gather or receive any external evidence. When external evidence is passed into subagent work, include source title, source date, URL, excerpt, claim, and whether it is an official reference or supplied reference.
- If external verification is skipped, unavailable, or still inconclusive, state that explicitly instead of implying the command confirmed it.
- `## State Of The Art` should include explicit source dates for freshness-sensitive claims, or say `not externally checked` when no approved external verification happened.
- Pass `phase` to `blueprint_phase_checkpoint_put` as the resolved numeric phase reference only, and treat checkpoint `path` values as authoritative instead of hand-building checkpoint filenames. The MCP tool keeps a shared phase checkpoint path, so ownership comes from `ownerCommand` and `resumeMeta.mode`, not from a research-specific filename.
- Persist the final research body through `blueprint_phase_artifact_write` with `artifact: "research"` and treat the returned `path` as authoritative instead of deriving filenames from the phase slug.
- `blueprint_phase_artifact_write` keeps research validation strict by default. Do not force a warn-only save just to bypass missing sections, citations, or other schema issues unless the user explicitly accepted that tradeoff.
- If the current `XX-CONTEXT.md` read returns `found: false`, stop and route back to `/blu-discuss-phase <phase>` before drafting research.
- If existing research is invalid, force repair or stop with the blocker; do not treat `view`, `skip`, default reuse, or an unchanged invalid write result as successful completion.
- Normalize the final research draft to `contract.authoringTemplate` after drafting and before persistence.
- Draft directly from `contract.authoringTemplate`; use `blueprint_artifact_scaffold` only when a deliberate placeholder file is explicitly requested before final research exists.
- Keep the contract's required section names and locked markers unchanged.
- Replace every placeholder signal before persistence.
- Allow extra top-level headings only when `contract.freehandPolicy` is `additional-top-level-headings`.
- Use checkpoint persistence only as a resumability aid for long-running or inconclusive research, not as a second research artifact.
- Read checkpoints with `expectedOwnerCommand: "/blu-research-phase"` and `expectedMode: "research"`, then honor `safeToResume` and `warnings` before using saved state.
- `blueprint_phase_checkpoint_put` requires `checkpoint` to be a JSON object using the structured checkpoint shape with `ownerCommand: "/blu-research-phase"`, `completedAreas`, `remainingAreas`, `decisions`, `deferredIdeas`, `canonicalReferences`, and `resumeMeta`. Keep resumability details inside `resumeMeta` with `mode: "research"` plus fields such as `pendingTopics`, `completedTopics`, `currentQuestion`, `notes`, `resumeHint`, and `updatedAt`.
- Delete the saved checkpoint through `blueprint_phase_checkpoint_delete` with `expectedOwnerCommand: "/blu-research-phase"` and `expectedMode: "research"` after a successful final research write so later runs do not resume stale continuation state and cleanup cannot remove another command's checkpoint.
- After a successful research write or a valid `view`/`skip`/`reuse` exit, call `blueprint_state_update` with `base: "synced"` and then `blueprint_state_load` so `STATE.md` and the reported next safe action both reflect live artifact inventory without rewriting the research artifact.
- Keep the section names unchanged and replace every angle-bracket placeholder before writing.
- Use `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md` as the output-quality and recovery authority: it requires planner-consumed sections, repo-versus-external provenance, capability-gated `blueprint-researcher` use, a single-agent topic-strand fallback when subagents are unavailable, and validation repair/retry before completion.


## Skills And Subagents


- Primary skill: `blueprint-phase-discovery`
- Runtime reference: `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
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
- `docs/commands/discuss-phase.md`


## External Shell Or Git Dependencies


- External dependencies:
- web docs only when `research.external_sources` permits the check and the parent command or user has approved it; otherwise stay repo-only


## Shell Risk Profile

- Low: writes phase research artifacts when needed, may refresh the resumable research-owned shared checkpoint, and syncs `.blueprint/STATE.md`.

## User Prompts And Confirmation Gates


- Confirm overwrite when research already exists.
- Force an explicit `view`, `skip`, or `update` path when `XX-RESEARCH.md` already exists.
- Treat missing `XX-CONTEXT.md` as a blocking gate before drafting research.
- Treat invalid existing research as repair-only; do not allow it to complete through `skip` or default reuse.
- Prefer Gemini CLI's built-in `ask_user` dialog for the `view`/`skip`/`update` choice and overwrite confirmation instead of a plain-text menu.
- Resume from a saved checkpoint by default when one exists and the user has not explicitly asked to discard it.
- During non-trivial multi-strand research runs on Gemini, keep the active stage and next safe action visible with `update_topic` and `write_todos` while leaving persistence to MCP artifacts, checkpoints, and `STATE.md`.
- When those Gemini visibility helpers are unavailable, keep the same stage and next-safe-action visibility through short progress recaps plus MCP-backed checkpoints and `STATE.md`.


## Edge Cases


- The target phase is omitted or ambiguous while multiple active phases exist.
- Expected prior artifacts exist but are stale, incomplete, or inconsistent with `ROADMAP.md`.
- Research may need multiple bounded passes when evidence gathering is broad, contradictory, or blocked on external confirmation.
- A partially completed research run should preserve resumable state instead of pretending the artifact is final.


## Failure Modes And Recovery


- Explain exactly which phase artifact is missing and which command creates it.
- Surface `blueprint_phase_locate.recovery` guidance for missing roadmap or phase-directory failures.
- Write follow-up state back into `.blueprint/` instead of dropping context on failure.
- When research remains inconclusive, persist a checkpoint, summarize verified versus unresolved areas, and route to the next safe implemented continuation step instead of fabricating certainty.


## Acceptance Criteria


- Reads and writes only the selected phase scope.
- Updates `STATE.md` whenever the next-step signal changes.
- Creates or updates only the declared artifacts for this command.
- Reads the actual saved context content before drafting or revising research instead of relying on status-only readiness signals.
- Stops on missing context until the user repairs or confirms the recovery route.
- Keeps topic-strand progress visible while research is in flight and uses checkpoints only as resumable continuation state.
- Persists populated research content through MCP rather than raw prompt-side file writes.
- Uses `contract.authoringTemplate` as the direct drafting seed and reserves scaffold for deliberate placeholder creation only.
- Uses a research schema with citations, confidence, recommendations, and planner-friendly sections.
- Honors the effective `research.external_sources` policy before any external verification step.
- Keeps repo truth explicit and distinguishes it from any official-doc or user-supplied external evidence instead of blending the two into one unstated source pool.
- Requires `## State Of The Art` freshness claims to carry explicit dates or a clear `not externally checked` marker.
- Handles long-running or inconclusive research through checkpointed continuation rather than a single all-or-nothing pass.
- Does not treat invalid unchanged research as accepted merely because the saved file was reused.
- Reports the next safe action from refreshed runtime state instead of assuming `blueprint_state_update` returned it.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Direct `research-phase` happy-path fixture.
- Existing research `view`, `skip`, and `update` fixture.
- Existing invalid research repair fixture.
- Missing-context gate fixture.
- Reuse plus `STATE.md` sync fixture.
- Invalid research-content rejection fixture.
