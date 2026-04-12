# `/blu:complete-milestone`
| Field | Value |
|---|---|
| Wave | `2` |
| Family | `Roadmap And Milestone` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Archive completed milestone and prepare for next version |


## Purpose


`complete-milestone` carries forward the GSD intent to archive completed milestone and prepare for next version. In Blueprint it stays Gemini-native, uses a report-driven closeout flow gated by the saved milestone audit, writes a durable completion report, and re-anchors state on the next safe implemented archival follow-up instead of introducing a new milestone-state engine.


## Command Path And Examples

- Gemini command path: `/blu:complete-milestone`
- Root router form: `/blu complete-milestone`
- Argument hint: `<version>`
- `/blu:complete-milestone v1.0`
- `/blu complete-milestone`

## Inputs, Project State, And Prerequisite Artifacts


- A matching `milestone-audit-<version>.md` report should already exist in `.blueprint/reports/`.
- All roadmap phases for the milestone should already be complete, with saved verification and UAT evidence.
- Replacing an existing milestone completion report requires explicit overwrite confirmation.


## Outputs


- User-facing result: a concise completion summary plus the next safe implemented action when applicable.
- Repo side effects: Writes a durable milestone completion report in `.blueprint/reports/` and updates `.blueprint/STATE.md`.


## Blueprint And Global State Reads


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`


## Blueprint And Global State Writes


- `.blueprint/reports/milestone-complete-<version>.md`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`
- `blueprint_artifact_report_write` -> `{path, written, created, overwritten, status, warnings}`
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
- `docs/commands/audit-milestone.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Medium: writes milestone closeout evidence and advances the milestone archival flow.

## User Prompts And Confirmation Gates


- Require explicit confirmation before replacing an existing milestone completion report.
- Confirm the resolved milestone before writing the completion report when the user passed an ambiguous version or name.


## Edge Cases


- Existing milestone completion report replacement.
- Missing milestone audit report for the resolved milestone.


## Failure Modes And Recovery


- Show roadmap and report drift before mutation.
- If the milestone audit report is missing, stop with concise guidance to run `/blu:audit-milestone` first.
- Return the nearest valid phase or milestone candidates when the target does not exist.


## Acceptance Criteria


- Keeps milestone closeout grounded in the saved roadmap and audit report rather than chat memory.
- Produces a durable report for milestone-level operations.
- Requires explicit confirmation before overwriting an existing completion report.
- Does not rewrite `.blueprint/ROADMAP.md` or phase directories directly.
- Returns `/blu:milestone-summary <milestone>` as the next safe implemented follow-up.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Missing-audit rejection fixture.
- Existing completion report overwrite fixture.
- Direct `complete-milestone` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/complete-milestone.md`
- Upstream workflow status: GSD has an upstream workflow file
