# `/blu-workstreams`
| Field | Value |
|---|---|
| Wave | `5` |
| Family | `Workspace And Maintenance` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `interactive-read` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Persist`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- Keep the workstream posture explicit throughout the run: the resolved scope should stay tied to the requested operation, target workstream, active workstream, and saved snapshot availability; pending gates stay limited to `workstream-switch-confirmation`, `workstream-archive-confirmation`, `missing-workstream`, `missing-resume-snapshot`, `dirty-working-tree`, or `corrupt-workstream-index`; execution mode should reflect read-only summary versus confirmed state mutation; and the next safe action should stay visible while the command is waiting on clarification, confirmation, or a repo cleanup step.

## Purpose

`workstreams` is Blueprint's project-local command for listing, creating, switching, resuming, checking, and completing parallel workstreams. In Blueprint it now ships as an MCP-backed `interactive-read` flow: the command keeps durable workstream state under `.blueprint/workstreams/`, uses Gemini-native `ask_user` for interactive selection or confirmation, delegates deterministic reads and writes to the workstream MCP tools, and uses `blueprint_state_update` only for the final routing or resume-state patch.

## Command Path And Examples

- CLI command path: `/blu-workstreams`
- Root router form: `/blu workstreams`
- Argument hint: `[list|status|progress|create <name>|switch <name>|resume <name>|complete <name>]`
- `/blu-workstreams`
- `/blu-workstreams create backend api`
- `/blu-workstreams switch backend-api`
- `/blu-workstreams resume backend-api`
- `/blu workstreams complete backend-api`

## Inputs, Project State, And Prerequisite Artifacts

- A Blueprint project must already exist.
- Workstream state is project-local and must stay under `.blueprint/workstreams/`.
- Exactly one workstream may be active at a time.
- `switch`, `resume`, and completing the current active workstream must stop on a dirty working tree.
- `resume` requires a previously saved `STATE.md` snapshot for the selected workstream.

## Outputs

- User-facing result: a concise completion summary plus any active waiting state or next safe action when applicable.
- Repo side effects: updates the declared Blueprint workstream artifacts and may patch `.blueprint/STATE.md` only through the shared state MCP tool after a confirmed `resume` or final routing update.
- In-flight workstream runs should keep the resolved scope, active stage, pending gate, execution mode, and next safe action legible while the run is still live.

## Blueprint And Global State Reads

- `.blueprint/workstreams/WORKSTREAMS.md`
- `.blueprint/workstreams/<slug>/state.json`
- `.blueprint/STATE.md` when a saved snapshot must be captured or restored
- git status for dirty-tree preflights on active-stream transitions

## Blueprint And Global State Writes

- `.blueprint/workstreams/WORKSTREAMS.md`
- `.blueprint/workstreams/<slug>/state.json`
- `.blueprint/STATE.md` only through `blueprint_state_update` after a confirmed resume or final routing patch

## Required MCP Tools

- `blueprint_workstream_list` -> `{status, active, workstreams, summary, waitingState, reason}`
- `blueprint_workstream_mutate` -> `{status, operation, active, workstreams, affectedPaths, waitingState, nextAction, statePatch}`
- `blueprint_state_update` -> `{updatedFields, statePath, warnings}`

## Workstream Artifact Contract

- Treat `.blueprint/workstreams/WORKSTREAMS.md` as the human-readable index only; it must stay aligned with the canonical per-workstream state files.
- Persist each workstream at `.blueprint/workstreams/<slug>/state.json` with `version`, `name`, `slug`, `status`, `createdAt`, `updatedAt`, optional `activatedAt` and `completedAt`, and an optional saved `STATE.md` snapshot subset.
- The workstream MCP tools own index validation and regeneration. If `WORKSTREAMS.md` drifts from the canonical per-stream state files, the command must stop with the waiting state `corrupt-workstream-index` instead of guessing.
- `resume` must restore only the saved `STATE.md` subset returned by `blueprint_workstream_mutate`; it must not invent a second persistence path or widen into `/blu-resume-work`.

## In-Flight Progress Contract

- Keep the shared stage vocabulary visible only for the stages the workstream run actually reaches.
- Use Gemini-native `ask_user` whenever the user has not already supplied the specific workstream target or the command needs confirmation for `switch` or `complete`.
- For interactive sessions, `ask_user` is the required gate for selecting a workstream or confirming destructive changes. If the host cannot provide `ask_user`, stop clearly instead of mutating through guesswork.
- Non-interactive or headless runs must require an explicit operation and target; they must not branch into interactive selection or confirmation prompts.
- Keep waiting states explicit: `workstream-switch-confirmation` and `workstream-archive-confirmation` stay visible until the user approves; `missing-workstream`, `missing-resume-snapshot`, `dirty-working-tree`, and `corrupt-workstream-index` stay visible with the next safe action while the run is blocked.

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
- `docs/commands/resume-work.md`
- `docs/commands/new-workspace.md`

## External Shell Or Git Dependencies

- External dependencies:
- git status inspection only

## Shell Risk Profile

- Medium: project-local state mutation with active-stream switching semantics.

## Risk Notes

- Workstream state must stay project-local. Do not store workstream registry data in `~/.<host>/blueprint/`, repo config, or `.planning/`.
- `create` must not silently switch away from an already active workstream.
- `switch` and `resume` must snapshot the current active workstream before activating another one.
- `complete` must archive project-local workstream state only; it must not delete workstream files or silently rewrite unrelated roadmap or phase state.

## User Prompts And Confirmation Gates

- Use `ask_user` to choose an operation or target when the user did not already provide one.
- Preview the current active workstream, target workstream, and saved-snapshot posture before `switch` or `resume`.
- Require explicit confirmation before switching away from an active workstream, and keep the waiting state visible as `workstream-switch-confirmation` until the user approves.
- Require explicit confirmation before completing the current active workstream, and keep the waiting state visible as `workstream-archive-confirmation` until the user approves.

## Edge Cases

- The requested target does not exist in the project-local workstream registry.
- A target workstream has no saved `STATE.md` snapshot to resume.
- The repo has uncommitted changes while the command is trying to change the active workstream.
- `WORKSTREAMS.md` is stale relative to the canonical per-stream state files.

## Failure Modes And Recovery

- Stop on dirty trees, missing workstreams, missing resume snapshots, or corrupted workstream index state with a specific remediation checklist.
- Do not mutate the installed extension directory.
- Leave `.blueprint/STATE.md`, roadmap artifacts, and global Blueprint state unchanged when a preflight or confirmation gate blocks the run.
- Keep workstream index regeneration and per-stream state writes aligned so partial workstream updates do not leave the index stale.

## Acceptance Criteria

- Mutates only `.blueprint/workstreams/WORKSTREAMS.md`, `.blueprint/workstreams/<slug>/state.json`, and the final `STATE.md` patch triggered through `blueprint_state_update`.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files and host-global state untouched.
- Keeps exactly one active workstream at a time.
- Keeps the `interactive-read` execution profile, shared stage vocabulary, and in-flight status fields visible while the run is active or waiting.
- Keeps `workstream-switch-confirmation`, `workstream-archive-confirmation`, `missing-workstream`, `missing-resume-snapshot`, `dirty-working-tree`, and `corrupt-workstream-index` explicit when those gates apply.
- Uses `ask_user` for interactive selection or confirmation instead of guessing.
- Never reintroduces `workflow.use_workstreams` or another config toggle for workstream behavior.

## Test Cases

- Empty project-local workstream registry fixture.
- Create-first-workstream happy path.
- Dirty-tree switch blocker fixture.
- Missing-resume-snapshot blocker fixture.
- Corrupt-index fixture.
- Resume-from-saved-snapshot fixture.
