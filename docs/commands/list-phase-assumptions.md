# `/blu-list-phase-assumptions`
| Field | Value |
|---|---|
| Wave | `2` |
| Family | `Roadmap And Milestone` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`list-phase-assumptions` is Blueprint's command for surface the agent's assumptions about a phase approach before planning. In Blueprint it stays host-native, uses only read-oriented MCP tools, and remains purely conversational so users can correct misunderstandings before `discuss-phase` or `plan-phase`.


## Command Path And Examples

- CLI command path: `/blu-list-phase-assumptions`
- Root router form: `/blu list-phase-assumptions`
- Argument hint: `[phase]`
- `/blu-list-phase-assumptions 4`
- `/blu list-phase-assumptions`

## Inputs, Project State, And Prerequisite Artifacts


- A target phase must exist or be inferrable from Blueprint state or the roadmap.


## Outputs


- User-facing result: a concise assumptions review that explicitly covers technical approach, implementation order, scope boundaries, risk areas, and dependencies, plus a correction prompt and the next logical implemented action when applicable.
- Repo side effects: No durable artifact writes are planned.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- none


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_context` -> `{phase, requirements, missingArtifacts}`
- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
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


- Show roadmap and phase-directory drift without mutating anything.
- When the target phase does not exist, return the precise lookup failure plus the valid roadmap phases instead of guessing a replacement.


## Acceptance Criteria


- Returns guidance, assumptions, or routing output without mutating project artifacts by default.
- Uses only documented read-oriented MCP queries for inspection and routing.
- Preserves the five assumption areas from the locked discovery workflow: technical approach, implementation order, scope boundaries, risk areas, and dependencies.
- Makes uncertainty explicit instead of overstating confidence.
- Never routes to omitted commands or hides destructive behavior behind an implicit step.


## Test Cases


- Roadmap mutation fixture.
- Renumbering or archival regression fixture.
- Direct `list-phase-assumptions` happy-path fixture.


