# `/blu-remove-phase`
| Field | Value |
|---|---|
| Wave | `2` |
| Family | `Roadmap And Milestone` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `interactive-read` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `remove-phase` uses the shared interactive-read classification only to keep the command metadata aligned; it performs one bounded roadmap removal, keeps persistence on MCP-owned Blueprint artifacts, and does not adopt tracker-backed branching or the long-running progress layer used by mutation-heavy commands.
- Keep the waiting state explicit as `future-phase-guard` when the target is not safely removable, `remove-phase-confirmation` while the default preview is waiting for approval, and `force-remove-confirmation` when execution evidence triggers the second destructive gate.


## Purpose


`remove-phase` is Blueprint's command for remove a future phase from roadmap and renumber subsequent phases. In Blueprint it is implemented as a host-native roadmap surgery flow that previews the impact, removes the requested future phase, deletes the matching phase directory, renumbers subsequent roadmap entries and phase directories, and then re-anchors `.blueprint/STATE.md` on the safest implemented follow-up.


## Command Path And Examples

- CLI command path: `/blu-remove-phase`
- Root router form: `/blu remove-phase`
- Argument hint: `<phase-number>`
- `/blu-remove-phase 7`
- `/blu remove-phase`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase must already exist in `.blueprint/ROADMAP.md`.
- The target phase must be a future phase relative to `.blueprint/STATE.md`.
- The target phase may already have execution evidence such as `SUMMARY`, `VERIFICATION`, or `UAT` artifacts, but removal must stop on the default safe path unless the user gives an explicit destructive confirmation for the force-removal path.


## Outputs


- User-facing result: a concise completion summary plus the next safe implemented action when applicable.
- Repo side effects: Removes the requested future phase from `.blueprint/ROADMAP.md`, deletes the matching phase directory, renumbers later phase directories and artifact filenames to fill the gap, and updates `.blueprint/STATE.md`.
- In-flight posture: none beyond a concise inline summary or destructive confirmation gate; `remove-phase` does not expose the long-running progress layer.


## Blueprint And Global State Reads


- The current roadmap and milestone inventory through `blueprint_roadmap_read`
- Existing target-phase artifacts and drift through `blueprint_phase_locate`


## Blueprint And Global State Writes


- `.blueprint/ROADMAP.md`
- `renamed phase directories and phase-scoped artifact filenames under .blueprint/phases/`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_roadmap_remove_phase` -> `{removedPhase, renumberedPhases, roadmapPath}`
- `blueprint_state_update` -> `{updatedFields, statePath}`


## Skills And Subagents


- Primary skill: `blueprint-roadmap-admin`
- Optional subagents: none


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/add-phase.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- High: renumbering can invalidate downstream roadmap references.

## User Prompts And Confirmation Gates


- Always require a preview and confirmation before renumbering.
- Treat the confirmation gate as mandatory because the command deletes a phase directory and shifts later phase numbering.
- Prefer Gemini CLI `ask_user` for the destructive confirmation gate instead of a plain-text prompt.
- When execution evidence exists, require a second explicit destructive confirmation before calling the force-removal path.


## Edge Cases


- Decimal phase targets are allowed and should shift later phases left to fill the removed slot.
- Reject current or past phases even if they still appear in the roadmap.
- Default to refusal when the target phase already contains execution evidence until the user explicitly confirms force removal.


## Failure Modes And Recovery


- Show roadmap and phase-directory drift before mutation.
- Refuse mutation when the target phase directory is missing or ambiguous.
- Refuse mutation when `.blueprint/STATE.md` does not provide a usable current phase for the future-phase guard.
- Return the nearest valid phase or milestone candidates when the target does not exist.
- When execution evidence exists, present the evidence first and require a second explicit destructive confirmation before continuing with force removal.


## Acceptance Criteria


- Keeps roadmap, phase directories, and state synchronized.
- Deletes the target phase directory and renumbers later directories plus phase-scoped artifact filenames.
- Rejects current or past phases and defaults to rejecting phases that already have execution evidence unless the user explicitly confirms force removal.
- Returns `/blu-progress` as the next safe implemented follow-up.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Roadmap mutation fixture.
- Renumbering or archival regression fixture.
- Current-phase rejection fixture.
- Execution-evidence rejection fixture.
- Direct `remove-phase` happy-path fixture.
