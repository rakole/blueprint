# `/blu-remove-phase`
| Field | Value |
|---|---|
| Wave | `2` |
| Family | `Roadmap And Milestone` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


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
- The target phase may not already have execution evidence such as `SUMMARY`, `VERIFICATION`, or `UAT` artifacts.


## Outputs


- User-facing result: a concise completion summary plus the next safe implemented action when applicable.
- Repo side effects: Removes the requested future phase from `.blueprint/ROADMAP.md`, deletes the matching phase directory, renumbers later phase directories and artifact filenames to fill the gap, and updates `.blueprint/STATE.md`.


## Blueprint And Global State Reads


- The current roadmap and milestone inventory through `blueprint_roadmap_read`
- Existing target-phase artifacts through `blueprint_artifact_list`


## Blueprint And Global State Writes


- `.blueprint/ROADMAP.md`
- `renamed phase directories and phase-scoped artifact filenames under .blueprint/phases/`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_roadmap_remove_phase` -> `{removedPhase, renumberedPhases, roadmapPath}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
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


## Edge Cases


- Decimal phase targets are allowed and should shift later phases left to fill the removed slot.
- Reject current or past phases even if they still appear in the roadmap.
- Reject target phases that already contain execution evidence until the user resolves or removes that evidence intentionally.


## Failure Modes And Recovery


- Show roadmap and phase-directory drift before mutation.
- Refuse mutation when the target phase directory is missing or ambiguous.
- Refuse mutation when `.blueprint/STATE.md` does not provide a usable current phase for the future-phase guard.
- Return the nearest valid phase or milestone candidates when the target does not exist.


## Acceptance Criteria


- Keeps roadmap, phase directories, and state synchronized.
- Deletes the target phase directory and renumbers later directories plus phase-scoped artifact filenames.
- Rejects current or past phases and phases that already have execution evidence.
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


