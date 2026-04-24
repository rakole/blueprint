# `/blu-next`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Execution profile | `router` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`next` is Blueprint's command for advancing to the next logical step in the Blueprint workflow. In Blueprint it stays host-native, relies on documented read-only MCP tools, and keeps the repo-side contract explicit enough that routing remains implementation-aware instead of prompt-only guesswork. When the repo is waiting on a prerequisite, `next` names that waiting state and the next safe follow-up instead of smoothing it away.


## Command Path And Examples

- CLI command path: `/blu-next`
- Root router form: `/blu next`
- Argument hint: `none`
- `/blu-next`
- `/blu next`

## Inputs, Project State, And Prerequisite Artifacts


- None, but Blueprint context improves routing.
- Uninitialized repos must fall back to `/blu-new-project` unless brownfield map-first gating requires `/blu-map-codebase`.
- Uninitialized brownfield repos must fall back to `/blu-map-codebase`; uninitialized greenfield and scaffold-only repos must fall back to `/blu-new-project`.
- `mapping-incomplete` codebase-only repos must fall back to `/blu-map-codebase`.
- `mapped-only` repos must fall back to `/blu-new-project`.
- Partial repos must fall back to `/blu-health`.
- Partial core bootstrap repos must fall back to `/blu-health`.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- When the repo is waiting on a missing artifact, verification debt, or blocked substrate, include the pending gate and the next safe follow-up command explicitly.
- Repo side effects: No durable artifact writes are planned.


## Blueprint And Global State Reads


- `.blueprint/STATE.md` through `blueprint_state_load`
- `.blueprint/ROADMAP.md`, phase artifacts, and codebase bundle presence through `blueprint_project_status` and `blueprint_artifact_list`
- runtime command availability through `blueprint_command_catalog`
- waiting state and derived next action through `blueprint_state_load`


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
- Surfaces waiting state plainly when the repo is blocked, partial, or missing a prerequisite artifact.
- Never routes to omitted commands or hides destructive behavior behind an implicit step.
- Always names the next safe follow-up command when one is available.


## Test Cases


- Brownfield uninitialized repo routes to `/blu-map-codebase`.
- Greenfield/scaffold-only uninitialized repo routes to `/blu-new-project`.
- Mapping-incomplete codebase-only repo routes to `/blu-map-codebase`.
- Mapped-only repo routes to `/blu-new-project`.
- Partial core Blueprint repo routes to `/blu-health`.
- Initialized repo reuses the next implemented discovery command or falls back to `/blu-progress` safely, while naming any waiting state that explains the choice.
- Direct `next` command contract uses only registered read-oriented MCP tools.
