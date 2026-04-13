# `/blu-ui-review`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`ui-review` is Blueprint's command for retroactive 6-pillar visual audit of implemented frontend code. Blueprint ships it as a phase-scoped UI audit command: it grounds the review in saved execution evidence plus the saved `XX-UI-SPEC.md` contract when present, can delegate bounded visual analysis to a dedicated UI auditor, and persists the finished result through the shared review MCP tool instead of prompt-only file writes.


## Command Path And Examples

- Gemini command path: `/blu-ui-review`
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


- Phase resolution and artifact inventory through the documented phase and artifact MCP tools


## Blueprint And Global State Writes


- `phase XX-UI-REVIEW.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_review_record` -> `{reportPath, counts, followUps, status, warnings}`


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
- optional screenshot tooling or user-supplied visual evidence later


## Shell Risk Profile

- Low: review artifact only.

## User Prompts And Confirmation Gates


- None by default. Overwrite remains explicit confirmation when a prior `XX-UI-REVIEW.md` already exists.


## Edge Cases


- The phase contains little or no actual UI work and only a saved skip rationale in `XX-UI-SPEC.md`.
- The command scope does not match the currently changed files, branch, or phase artifacts.
- External tooling such as `git`, `gh`, or peer-review CLIs is missing or only partially available.


## Failure Modes And Recovery


- Preserve generated review artifacts when follow-up git or external CLI steps fail.
- Fall back to explicit UI evidence review or manual next-step guidance instead of guessing.


## Acceptance Criteria


- Produces a durable artifact for review, security, UI, or shipping work.
- Grounds the audit in saved execution evidence and the UI contract when available.
- Never hides destructive git behavior behind an implicit step.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Phase review fixture with saved UI evidence.
- Git or external CLI availability fixture.
- Direct `ui-review` happy-path fixture.


