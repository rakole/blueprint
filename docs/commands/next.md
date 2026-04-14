# `/blu-next`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`next` is Blueprint's command for advancing to the next logical step in the Blueprint workflow. In Blueprint it stays host-native, relies on documented read-only MCP tools, and keeps the repo-side contract explicit enough that routing remains implementation-aware instead of prompt-only guesswork.


## Command Path And Examples

- CLI command path: `/blu-next`
- Root router form: `/blu next`
- Argument hint: `none`
- `/blu-next`
- `/blu next`

## Inputs, Project State, And Prerequisite Artifacts


- None, but Blueprint context improves routing.
- Uninitialized repos must fall back to `/blu-new-project`.
- Partial repos must fall back to `/blu-health`.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: No durable artifact writes are planned.


## Blueprint And Global State Reads


- `.blueprint/STATE.md` through `blueprint_state_load`
- `.blueprint/ROADMAP.md`, phase artifacts, and codebase bundle presence through `blueprint_project_status` and `blueprint_artifact_list`
- runtime command availability through `blueprint_command_catalog`


## Blueprint And Global State Writes


- none


## Required MCP Tools


- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
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
- `docs/commands/progress.md`


## Related Command Docs


- `docs/commands/progress.md`
- `docs/commands/discuss-phase.md`
- `docs/commands/plan-phase.md`
- `docs/commands/execute-phase.md`
- `docs/commands/verify-work.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Low: read-only router.

## User Prompts And Confirmation Gates


- None.


## Edge Cases


- The target phase is omitted or ambiguous while multiple active phases exist.
- Expected prior artifacts exist but are stale, incomplete, or inconsistent with `ROADMAP.md`.


## Failure Modes And Recovery


- Explain exactly which phase artifact is missing and which implemented command creates it.
- On failure, return the safest implemented recovery command instead of mutating project state implicitly.


## Acceptance Criteria


- Returns guidance, assumptions, or routing output without mutating project artifacts by default.
- Uses only documented read-oriented MCP queries for inspection and routing.
- Never routes to omitted commands or hides destructive behavior behind an implicit step.


## Test Cases


- Uninitialized repo routes to `/blu-new-project`.
- Partial Blueprint repo routes to `/blu-health`.
- Initialized repo reuses the next implemented discovery command or falls back to `/blu-progress` safely.
- Direct `next` command contract uses only registered read-oriented MCP tools.


