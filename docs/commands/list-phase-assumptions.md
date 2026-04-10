# `/blu:list-phase-assumptions`
| Field | Value |
|---|---|
| Wave | `2` |
| Family | `Roadmap And Milestone` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Surface Claude's assumptions about a phase approach before planning |


## Purpose


`list-phase-assumptions` carries forward the GSD intent to surface Claude's assumptions about a phase approach before planning. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu:list-phase-assumptions`
- Root router form: `/blu list-phase-assumptions`
- Argument hint: `[phase]`
- `/blu:list-phase-assumptions 4`
- `/blu list-phase-assumptions`

## Inputs, Project State, And Prerequisite Artifacts


- A target phase must exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: No durable artifact writes are planned.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- none


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_context` -> `{phase, requirements, missingArtifacts}`
- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`


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
- `docs/commands/map-codebase.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Low: read-only analysis.

## User Prompts And Confirmation Gates


- None.


## Edge Cases


- none


## Failure Modes And Recovery


- Show roadmap and phase-directory drift before mutation.
- Return the nearest valid phase or milestone candidates when the target does not exist.


## Acceptance Criteria


- Returns guidance, assumptions, or routing output without mutating project artifacts by default.
- Uses only documented read-oriented MCP queries for inspection and routing.
- Never routes to omitted commands or hides destructive behavior behind an implicit step.


## Test Cases


- Roadmap mutation fixture.
- Renumbering or archival regression fixture.
- Direct `list-phase-assumptions` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/list-phase-assumptions.md`
- Upstream workflow status: GSD has an upstream workflow file
