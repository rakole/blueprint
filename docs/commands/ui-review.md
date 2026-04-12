# `/blu-ui-review`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Retroactive 6-pillar visual audit of implemented frontend code |


## Purpose


`ui-review` carries forward the GSD intent to retroactive 6-pillar visual audit of implemented frontend code. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu-ui-review`
- Compatibility during this release: `/blu:ui-review` (deprecated; remove next release)
- Root router form: `/blu ui-review`
- Argument hint: `[phase]`
- `/blu-ui-review 3`
- `/blu ui-review`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase should already have shipped UI work.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `phase XX-UI-REVIEW.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_review_record` -> `{reportPath, counts, followUps}`


## Skills And Subagents


- Primary skill: `blueprint-review`
- Optional subagents:
- `blueprint-ui-auditor`


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/execute-phase.md`
- `docs/commands/ui-phase.md`


## External Shell Or Git Dependencies


- External dependencies:
- optional screenshot tooling later


## Shell Risk Profile

- Low: review artifact only.

## User Prompts And Confirmation Gates


- None.


## Edge Cases


- The command scope does not match the currently changed files, branch, or phase artifacts.
- External tooling such as `git`, `gh`, or peer-review CLIs is missing or only partially available.


## Failure Modes And Recovery


- Preserve generated reports when git or external CLI steps fail.
- Fall back to explicit file selection or manual shipping guidance instead of guessing.


## Acceptance Criteria


- Produces a durable artifact for review, security, UI, or shipping work.
- Never hides destructive git behavior behind an implicit step.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Direct `ui-review` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/ui-review.md`
- Upstream workflow status: GSD has an upstream workflow file
