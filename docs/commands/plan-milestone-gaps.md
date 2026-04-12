# `/blu:plan-milestone-gaps`
| Field | Value |
|---|---|
| Wave | `2` |
| Family | `Roadmap And Milestone` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Create phases to close all gaps identified by milestone audit |


## Purpose


`plan-milestone-gaps` carries forward the GSD intent to create phases to close all gaps identified by milestone audit. In Blueprint it stays Gemini-native, keeps the flow audit-first, groups related gaps into a few coherent follow-up phases, and delegates roadmap/state persistence to documented MCP tools instead of direct file rewrites.


## Command Path And Examples

- Gemini command path: `/blu:plan-milestone-gaps`
- Root router form: `/blu plan-milestone-gaps`
- Argument hint: `none`
- `/blu:plan-milestone-gaps`
- `/blu plan-milestone-gaps`

## Inputs, Project State, And Prerequisite Artifacts


- A milestone audit report should already exist in `.blueprint/reports/`.
- The command should use the current roadmap context plus the latest matching audit report to decide whether any new gap-closure phases are needed.


## Outputs


- User-facing result: a concise “Gap Closure Plan” review plus a completion summary and the next safe implemented action when applicable.
- Repo side effects: Appends approved gap-closure phases to the roadmap, creates the matching phase directories, updates `.blueprint/STATE.md`, and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`


## Blueprint And Global State Writes


- `.blueprint/ROADMAP.md`
- `new phase directories for approved gaps`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_roadmap_add_phase` -> `{phaseNumber, phaseDir, roadmapPath}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`
- `blueprint_state_update` -> `{updatedFields, statePath}`


## Skills And Subagents


- Primary skill: `blueprint-roadmap-admin`
- Optional subagents:
- `blueprint-roadmapper`


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

- Medium: can add multiple phases in one pass.

## User Prompts And Confirmation Gates


- Confirm the grouped gap-closure plan before writing any new phases.


## Edge Cases


- No matching milestone audit report exists yet.
- The audit report exists but contains no actionable gaps.
- The audit contains optional or nice-to-have gaps that should be separated from must-close follow-up work.


## Failure Modes And Recovery


- Show roadmap and phase-directory drift before mutation.
- Stop with concise guidance to run `/blu:audit-milestone` first when no matching audit report exists.
- If the audit contains no actionable gaps, stop without mutation and route to `/blu:progress`.
- Return the nearest valid phase or milestone candidates when the target does not exist.


## Acceptance Criteria


- Keeps roadmap, phase directories, and state synchronized.
- Uses a real milestone audit report as the source of truth for gap planning.
- Groups related gaps into a few coherent phases instead of blindly creating one phase per gap.
- Requires one explicit confirmation before appending any gap-closure phases.
- Updates `.blueprint/STATE.md` so the first new phase becomes current and `/blu:discuss-phase <phase>` is the next safe implemented action.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Missing-audit rejection fixture.
- No-actionable-gaps fixture.
- Grouped gap-closure review fixture.
- Direct `plan-milestone-gaps` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/plan-milestone-gaps.md`
- Upstream workflow status: GSD has an upstream workflow file
