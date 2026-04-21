# `/blu-progress`
| Field | Value |
|---|---|
| Wave | `0` |
| Family | `Foundation` |
| Execution profile | `router` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `progress` stays inside the shared router posture: resolve repo state, read the live status surface, and route to the next safe implemented command without implying hidden mutation.
- When the repo is waiting on a prerequisite, `progress` should name the pending gate plainly instead of flattening it into a generic status update.

## Purpose

`progress` is Blueprint's command for checking project progress, showing context, and routing to the next safe action. In Blueprint it stays read-oriented and host-native, but it must not present blocked lifecycle or roadmap commands as runnable when the substrate is missing.

## Command Path And Examples

- CLI command path: `/blu-progress`
- Root router form: `/blu progress`
- Argument hint: `none`
- `/blu-progress`
- `/blu progress`

## Inputs, Project State, And Prerequisite Artifacts

- A Blueprint project must already exist.

## Outputs

- User-facing result: a concise completion summary plus the next logical action when applicable.
- When initialized, include active model profile, branching mode, blockers, pending gates, and config warnings that materially affect the recommended next step.
- Repo side effects: No durable artifact writes are planned.
- Routed recommendations must be limited to commands whose catalog entry is `implemented`.

## Blueprint And Global State Reads

- effective config via `.blueprint/config.json` and optional `~/.<host>/blueprint/defaults.json`

## Blueprint And Global State Writes

- none

## Required MCP Tools

- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_command_catalog` -> `{commands, waves, aliases}` with per-command `implemented`, `status`, and `blockedBy`

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
- The current phase suggests a later command that is still blocked by missing substrate.

## Failure Modes And Recovery

- If the repo is uninitialized, route to `/blu-new-project`.
- If the repo is partial, route to `/blu-health`.
- If the natural next command is blocked, explain the missing substrate and keep the recommendation inside the implemented Wave 0 surface.
- If the repo is waiting on a missing artifact, verification debt, or blocked substrate, say so explicitly.

## Acceptance Criteria

- Returns guidance, assumptions, or routing output without mutating project artifacts by default.
- Uses only documented read-oriented MCP queries for inspection and routing.
- Never routes to omitted commands or hides destructive behavior behind an implicit step.
- Surfaces effective-config signals from normalized config instead of re-deriving profile, branching, or warning state locally.
- Does not present blocked lifecycle or roadmap commands as runnable when the underlying substrate is missing.

## Test Cases

- Fresh repo fixture.
- Partially initialized Blueprint repo fixture.
- Config-warning fixture.
- Direct `progress` happy-path fixture.
