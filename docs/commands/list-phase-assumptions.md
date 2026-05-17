# `/blu-list-phase-assumptions`
| Field | Value |
|---|---|
| Wave | `2` |
| Family | `Roadmap And Milestone` |
| Execution profile | `interactive-read` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `list-phase-assumptions` uses the shared interactive-read classification for inline pre-planning synthesis. Keep the command read-only, grounded in saved Blueprint state, and conversational without adopting tracker-backed branching or the long-running progress layer used by mutation commands.
- If phase resolution is blocked or the requested phase is missing, name that waiting state plainly, keep the next safe action explicit, and stop instead of guessing a replacement phase.


## Purpose


`list-phase-assumptions` is Blueprint's command for surfacing the agent's assumptions about a phase approach before planning. In Blueprint it stays host-native, uses only read-oriented MCP tools, and remains purely conversational so users can correct misunderstandings before `discuss-phase` or `plan-phase`.


## Command Path And Examples

- CLI command path: `/blu-list-phase-assumptions`
- Root router form: `/blu list-phase-assumptions`
- Argument hint: `[phase]`
- `/blu-list-phase-assumptions 4`
- `/blu list-phase-assumptions`

## Inputs, Project State, And Prerequisite Artifacts


- A target phase must exist or be inferrable from Blueprint state or the roadmap.


## Outputs


- User-facing result: a concise assumptions review that explicitly covers technical approach, implementation order, scope boundaries, risk areas, and dependencies, plus a correction prompt, any active waiting state when phase resolution is blocked, and the next logical implemented action when applicable.
- Repo side effects: No durable artifact writes are planned.
- In-flight posture: none beyond an inline read-only summary; this command does not expose the long-running progress layer.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- none


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_context` -> `{phase, codebase, requirements, missingArtifacts}`
- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_config_get` -> effective config for optional agent policy


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


- Show roadmap and phase-directory drift without mutating anything, and keep the waiting state explicit when the requested phase cannot be resolved safely.
- When the target phase does not exist, return the precise lookup failure plus the valid roadmap phases instead of guessing a replacement.


## Acceptance Criteria


- Returns guidance, assumptions, or routing output without mutating project artifacts by default.
- Uses only documented read-oriented MCP queries for inspection and routing.
- Preserves the five assumption areas from the locked discovery workflow: technical approach, implementation order, scope boundaries, risk areas, and dependencies.
- Makes uncertainty explicit instead of overstating confidence.
- Keeps blocked or missing phase resolution in a visible waiting-state posture with an explicit next safe action.
- Never routes to omitted commands or hides destructive behavior behind an implicit step.
- Explicitly excludes long-running progress tooling such as `update_topic`, `write_todos`, and tracker-backed branching.


## Test Cases


- Roadmap mutation fixture.
- Renumbering or archival regression fixture.
- Direct `list-phase-assumptions` happy-path fixture.
