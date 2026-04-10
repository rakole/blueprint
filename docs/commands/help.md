# `/blu:help`
| Field | Value |
|---|---|
| Wave | `0` |
| Family | `Foundation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Show available GSD commands and usage guide |


## Purpose


`help` carries forward the GSD intent to show available GSD commands and usage guide. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu:help`
- Root router form: `/blu help`
- Argument hint: `none`
- `/blu:help`
- `/blu help`

## Inputs, Project State, And Prerequisite Artifacts


- None.


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
- none


## Upstream Dependency Docs


- `docs/commands/root-router.md`
- `docs/commands/new-project.md`
- `docs/commands/progress.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Low: read-only help and routing guidance.

## User Prompts And Confirmation Gates


- None.


## Edge Cases


- The repo already contains a partial `.blueprint/` tree from an earlier attempt.
- The command is invoked from a nested directory rather than the repo root.


## Failure Modes And Recovery


- Stop with a precise repo-root or config-path error instead of guessing.
- Preserve existing Blueprint artifacts unless the user explicitly confirms replacement.


## Acceptance Criteria


- Returns guidance, assumptions, or routing output without mutating project artifacts by default.
- Uses only documented read-oriented MCP queries for inspection and routing.
- Never routes to omitted commands or hides destructive behavior behind an implicit step.


## Test Cases


- Fresh repo fixture.
- Partially initialized Blueprint repo fixture.
- Direct `help` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/help.md`
- Upstream workflow status: GSD has an upstream workflow file
