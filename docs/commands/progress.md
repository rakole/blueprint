# `/blu:progress`
| Field | Value |
|---|---|
| Wave | `0` |
| Family | `Foundation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Check project progress, show context, and route to next action (execute or plan) |


## Purpose


`progress` carries forward the GSD intent to check project progress, show context, and route to next action (execute or plan). In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu:progress`
- Root router form: `/blu progress`
- Argument hint: `none`
- `/blu:progress`
- `/blu progress`

## Inputs, Project State, And Prerequisite Artifacts


- A Blueprint project must already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- When initialized, include active model profile, branching mode, and config warnings that materially affect the recommended next step.
- Repo side effects: No durable artifact writes are planned.


## Blueprint And Global State Reads


- effective config via `.blueprint/config.json` and optional `~/.gemini/blueprint/defaults.json`


## Blueprint And Global State Writes


- none


## Required MCP Tools


- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_command_catalog` -> `{commands, waves, aliases}`


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
- `docs/commands/new-project.md`


## Upstream Dependency Docs


- `docs/commands/help.md`
- `docs/commands/next.md`
- `docs/commands/pause-work.md`
- `docs/commands/resume-work.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Low: read-only status inspection.

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
- Surfaces effective-config signals from normalized config instead of re-deriving profile, branching, or warning state locally.


## Test Cases


- Fresh repo fixture.
- Partially initialized Blueprint repo fixture.
- Config-warning fixture.
- Direct `progress` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/progress.md`
- Upstream workflow status: GSD has an upstream workflow file
