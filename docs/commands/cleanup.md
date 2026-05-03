# `/blu-cleanup`
| Field | Value |
|---|---|
| Wave | `5` |
| Family | `Workspace And Maintenance` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `high-risk-maintenance` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- Keep the cleanup posture explicit throughout the run: resolved scope must stay tied to the candidate archive set, the protected exclusions, and the chosen archive destination; pending gates stay limited to visible preflight blockers such as `dirty-working-tree`, `missing-phase-root`, or `inconsistent-phase-layout`, the destructive approval gate `cleanup-confirmation`, `archive-destination-confirmation` when a new cleanup destination would need approval, and `report-overwrite-confirmation` when `cleanup-latest` already exists; execution mode should reflect preview-only versus confirmed cleanup execution; and the next safe action should stay visible while the command is waiting on cleanup, destination approval, report replacement approval, or missing evidence.


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
- Creating a new cleanup archive destination inside `.blueprint/` requires explicit approval when no safe existing destination already exists.


## Outputs


- User-facing result: a concise completion summary plus any active waiting state or next safe action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.
- In-flight cleanup work should keep the resolved scope, active stage, pending gate, execution mode, report-before-mutate posture, protected exclusions, and next safe action legible while the run is still live.


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

## Digest And Report Contract

- Pass only repo-relative `artifactPaths` to `blueprint_artifact_summary_digest`.
- Treat the returned `inputsUsed` list as the authoritative digest scope instead of widening the cleanup evidence set after the tool returns.
- Persist the approved cleanup plan through `blueprint_artifact_report_write` with the bare report name `cleanup-latest`, not a `.blueprint/reports/...` path.
- Treat the returned report `path` as authoritative.

## In-Flight Progress Contract

- Keep the shared stage vocabulary visible only for the stages the cleanup run actually reaches.
- Keep the waiting state explicit whenever cleanup is blocked before mutation: preflight blockers should surface as `dirty-working-tree`, `missing-phase-root`, or `inconsistent-phase-layout`; destructive approval should stay visible as `cleanup-confirmation`; new archive-destination approval should stay visible as `archive-destination-confirmation`; and existing-report replacement should stay visible as `report-overwrite-confirmation`.
- Keep that visible progress aligned to the resolved scope, active stage, pending gate, execution mode, protected exclusions, report status, and next safe action while the run moves from preview through approval, report persistence, filesystem execution, validation, and routing.
- Execution mode should distinguish preview-only versus confirmed cleanup execution.


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
- Keep the report-before-mutate posture explicit before any filesystem mutation proceeds.


## User Prompts And Confirmation Gates


- Require confirmation before moving or deleting accumulated phase directories.
- Use Gemini CLI's built-in `ask_user` interaction tool for cleanup confirmation, archive-destination creation approval, and report-overwrite approval when it is available. `ask_user` is a Gemini CLI interaction surface, not Blueprint MCP persistence, so Blueprint-owned writes still stay on the documented MCP tool surface.
- Keep the destructive approval gate visible as `cleanup-confirmation` until the user approves through `ask_user` when available; if `ask_user` is unavailable, stop honestly with `cleanup-confirmation` still visible and keep the next safe action explicit before any filesystem mutation begins.
- Confirm report replacement before overwriting `.blueprint/reports/cleanup-latest.md`, keep the report-overwrite waiting state visible as `report-overwrite-confirmation` while blocked, use `ask_user` when available, and stop honestly with that named pending gate still visible when `ask_user` is unavailable.
- Confirm the resolved archive destination when no existing cleanup destination is already present, keep that waiting state visible as `archive-destination-confirmation` while blocked, use `ask_user` when available, and stop honestly with that named pending gate still visible when `ask_user` is unavailable.


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
- Keeps the `high-risk-maintenance` execution profile, shared stage vocabulary, and in-flight status fields visible while the run is active or waiting.
- Keeps the destructive approval, destination-approval, and report-overwrite waiting states visible with an explicit next safe action before mutation proceeds.
- Never archives the current phase or any phase still referenced by the active roadmap.
- Keeps the current phase, active roadmap references, evidence-incomplete directories, and final protected exclusions explicit before any archive scope is approved.
- Records the selected phase directories, protected exclusions, archive destination, and mutation outcome in `.blueprint/reports/cleanup-latest.md`.


## Test Cases


- Completed-milestone archival fixture.
- Dirty-tree or missing-evidence fixture.
- Direct `cleanup` happy-path fixture.
