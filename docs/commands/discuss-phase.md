# `/blu:discuss-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Gather phase context through adaptive questioning before planning. Use --auto to skip interactive questions (Claude picks recommended defaults). Use --chain for interactive discuss followed by automatic plan+execute. Use --power for bulk question generation into a file-based UI (answer at your own pace). |


## Purpose


`discuss-phase` carries forward the GSD intent to gather phase context through adaptive questioning before planning. The repaired Blueprint Phase 3 slice now persists substantive context content and resumable checkpoint state through dedicated MCP tools, while still deferring upstream-style power-mode, chain-mode, or auto-advance behavior until later substrate exists. In Blueprint it stays Gemini-native, delegates persistence to documented MCP tools, and keeps the repo-side contract explicit enough that this command can be repaired without broadening runtime exposure elsewhere.


## Command Path And Examples

- Gemini command path: `/blu:discuss-phase`
- Root router form: `/blu discuss-phase`
- Argument hint: `<phase>`
- `/blu:discuss-phase 3`
- `/blu discuss-phase`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase must exist in `.blueprint/ROADMAP.md`.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads

- effective Blueprint config through `blueprint_config_get`


## Blueprint And Global State Writes

- `phase XX-CONTEXT.md`
- `optional phase XX-DISCUSSION-LOG.md`
- `optional phase XX-DISCUSS-CHECKPOINT.json`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_context` -> `{phase, requirements, missingArtifacts}`
- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_phase_artifact_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, reason}`
- `blueprint_phase_artifact_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, written, created, overwritten, warnings}`
- `blueprint_phase_checkpoint_get` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, path, checkpoint, reason}`
- `blueprint_phase_checkpoint_put` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, path, updated, warnings}`
- `blueprint_phase_checkpoint_delete` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, path, deleted, reason}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`


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
- Do not advertise follow-on execution or planning flows as runnable until those commands are implemented in the runtime catalog.


## Edge Cases


- The target phase is omitted or ambiguous while multiple active phases exist.
- Expected prior artifacts exist but are stale, incomplete, or inconsistent with `ROADMAP.md`.
- `workflow.discuss_mode` may switch the command into an evidence-first assumptions flow rather than an interview-style loop.
- `workflow.skip_discuss=true` should shorten the discussion path instead of pretending no context capture is needed.


## Failure Modes And Recovery


- Explain exactly which phase artifact is missing and which command creates it.
- Write follow-up state back into `.blueprint/` instead of dropping context on failure.


## Acceptance Criteria


- Reads and writes only the selected phase scope.
- Updates `STATE.md` whenever the next-step signal changes.
- Creates or updates only the declared artifacts for this command.
- Persists real phase decisions into `XX-CONTEXT.md`, not only scaffold placeholders.
- Uses checkpoint persistence only as a resumability aid and deletes the checkpoint after successful completion.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Direct `discuss-phase` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/discuss-phase.md`
- Upstream workflow status: GSD has an upstream workflow file
