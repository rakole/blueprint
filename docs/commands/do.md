# `/blu-do`
| Field | Value |
|---|---|
| Wave | `3` |
| Family | `Capture And Lightweight Execution` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Route freeform text to the right GSD command automatically |


## Purpose


`do` carries forward the GSD intent to route freeform text to the right GSD command automatically. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu-do`
- Root router form: `/blu do`
- Argument hint: `<description of what you want to do>`
- `/blu-do set-up-roadmap-for-notifications`
- `/blu do`

## Inputs, Project State, And Prerequisite Artifacts


- None, though project context improves routing.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: No durable artifact writes are planned.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- none


## Required MCP Tools


- `blueprint_command_catalog` -> `{commands, waves, aliases}`
- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`


## Skills And Subagents


- Primary skill: `blueprint-router`
- Optional subagents: none


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/help.md`
- `docs/commands/progress.md`


## Upstream Dependency Docs


- `docs/commands/help.md`
- `docs/commands/fast.md`
- `docs/commands/quick.md`
- `docs/commands/discuss-phase.md`
- `docs/commands/plan-phase.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Low: routing only.

## User Prompts And Confirmation Gates


- None.


## Edge Cases


- The input is too vague to classify cleanly into note, todo, backlog, or execution work.
- The target item already exists or has already been promoted, completed, or archived.


## Failure Modes And Recovery


- Repair malformed index files through MCP instead of raw append logic.
- Route oversized execution asks to `quick` or `plan-phase` instead of bluffing.


## Acceptance Criteria


- Returns guidance, assumptions, or routing output without mutating project artifacts by default.
- Uses only documented read-oriented MCP queries for inspection and routing.
- Never routes to omitted commands or hides destructive behavior behind an implicit step.


## Test Cases


- Capture append fixture.
- No-project graceful degradation fixture.
- Direct `do` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/do.md`
- Upstream workflow status: GSD has an upstream workflow file
