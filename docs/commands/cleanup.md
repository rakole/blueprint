# `/blu-cleanup`
| Field | Value |
|---|---|
| Wave | `5` |
| Family | `Workspace And Maintenance` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`cleanup` is Blueprint's command for archive accumulated phase directories from completed milestones. In Blueprint it now ships as a confirmation-gated, evidence-backed archival flow: it reads saved roadmap and milestone closeout evidence first, persists a durable cleanup report before filesystem mutation, and keeps active phase protection explicit instead of hiding directory moves behind shell glue.


## Command Path And Examples

- CLI command path: `/blu-cleanup`
- Root router form: `/blu cleanup`
- Argument hint: `none`
- `/blu-cleanup`
- `/blu cleanup`

## Inputs, Project State, And Prerequisite Artifacts


- A Blueprint project must already exist.
- Saved milestone completion or summary reports should already exist for the phase directories selected for cleanup.
- Replacing an existing cleanup report requires explicit overwrite confirmation.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- `.blueprint/ROADMAP.md`
- `.blueprint/STATE.md` when current phase or next action context is needed
- saved milestone closeout reports under `.blueprint/reports/`
- candidate completed phase directories under `.blueprint/phases/`


## Blueprint And Global State Writes


- archived phase directories for completed milestones
- `.blueprint/reports/cleanup-latest.md`
- `.blueprint/STATE.md` when the next safe action changes after cleanup


## Required MCP Tools


- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`
- `blueprint_artifact_report_write` -> `{path, written, created, overwritten, status, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`


## Skills And Subagents


- Primary skill: `blueprint-maintenance`
- Optional subagents: none


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/complete-milestone.md`


## External Shell Or Git Dependencies


- External dependencies:
- filesystem operations
- git for dirty-tree safety checks when available


## Shell Risk Profile

- High: confirmation-gated phase-directory archival and removal behavior.

## Risk Notes


- Cleanup should never silently remove active, current-milestone, or unverified phase material.
- The command should emit a durable cleanup report before deleting, compacting, or relocating planning artifacts.
- Milestone-level cleanup must respect later reports that still reference earlier phase files.
- Cleanup should not invent a new archive destination inside `.blueprint/` without explicit approval when no existing destination already exists.
- Cleanup should show the resolved phase-directory set, protected exclusions, and final archive destination before any filesystem mutation proceeds.


## User Prompts And Confirmation Gates


- Require confirmation before moving or deleting accumulated phase directories.
- Confirm report replacement before overwriting `.blueprint/reports/cleanup-latest.md`.
- Confirm the resolved archive destination when no existing cleanup destination is already present.


## Edge Cases


- The current phase or active roadmap still references one of the candidate directories, making cleanup unsafe.
- Saved milestone completion evidence is missing for one or more candidate phase directories.
- A dirty tree, patch conflict, or active work in another location would make mutation unsafe.
- No safe archive destination exists inside `.blueprint/` and the user did not explicitly approve creating one.


## Failure Modes And Recovery


- Stop on dirty trees, missing milestone evidence, or protected active-phase scope with a specific remediation checklist.
- Do not mutate the installed extension directory.
- Leave the repo, workspace registry, and patch registry unchanged when a preflight check fails.
- Preserve the written cleanup report when filesystem archiving partially fails after report creation.


## Acceptance Criteria


- Mutates only the intended completed-milestone phase directories.
- Leaves a durable cleanup report behind every maintenance action.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Never executes git, workspace, patch, or cleanup mutation without an explicit confirmation gate.
- Never archives the current phase or any phase still referenced by the active roadmap.
- Records the selected phase directories, protected exclusions, archive destination, and mutation outcome in `.blueprint/reports/cleanup-latest.md`.


## Test Cases


- Completed-milestone archival fixture.
- Dirty-tree or missing-evidence fixture.
- Direct `cleanup` happy-path fixture.


