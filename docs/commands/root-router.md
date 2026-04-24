# `/blu`

| Field | Value |
|---|---|
| Type | Root router |
| Scope | All retained Blueprint commands |
| Default behavior | Route inline when intent is clear; recommend a direct command when it is not |

## Purpose

`/blu` is the front door to Blueprint. It inspects user intent together with project state, then either routes directly into an implemented Blueprint command flow or recommends the safest direct `/blu-<command>` entrypoint.

## Command Path And Examples

- CLI command path: `/blu`
- Example: `/blu`
- Example: `/blu plan phase 3`
- Example: `/blu what should I do next`

## Inputs, Project State, And Prerequisite Artifacts

- No Blueprint project is required for `/blu help`-style usage.
- Routing quality improves when `.blueprint/STATE.md` and `.blueprint/ROADMAP.md` exist.
- Routing quality also improves when effective config can be loaded from `.blueprint/config.json` and optional user defaults.
- Ambiguous user requests should prefer clarification or recommendation mode over risky execution.

## Outputs

- An inline routed flow when intent is clear, side effects are expected, and the target command is implemented.
- A direct command recommendation when the request is ambiguous, unsupported, or surprisingly destructive.
- A blocked-command explanation when the requested workflow exists in docs but is not yet shipped.
- No durable artifact writes by default.

## Blueprint And Global State Reads

- `.blueprint/STATE.md` when present
- `.blueprint/ROADMAP.md` when present
- effective config via `.blueprint/config.json` and optional `~/.<host>/blueprint/defaults.json`
- retained command catalog metadata

## Blueprint And Global State Writes

- none

## Required MCP Tools

- `blueprint_command_catalog` -> `{commands, waves, aliases}` with per-command `implemented`, `status`, and `blockedBy`
- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`

## Skills And Subagents

- Primary skill: `blueprint-router`
- Optional subagents: none

## Dependencies

- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/help.md`
- `docs/commands/progress.md`
- `docs/commands/next.md`
- `docs/commands/do.md`

## External Shell Or Git Dependencies

- External dependencies:
- none

## Shell Risk Profile

- Low: `/blu` should prefer read-only routing and recommendation behavior unless the target command is already unambiguous.

## User Prompts And Confirmation Gates

- Ask for clarification only when multiple retained commands fit and their side effects differ materially.
- Confirm before dispatching into a high-risk maintenance or git command from a vague root-router request.

## Edge Cases

- The user asks for an omitted command name that existed in earlier planning.
- The project is partially initialized, so routing needs to prefer `health` instead of pretending everything is ready.
- The repo is an unmapped brownfield or `mapping-incomplete`, so routing needs to prefer `map-codebase`; the repo is `mapped-only`, so routing needs to prefer `new-project`.
- The next action is blocked by missing artifacts and the router needs to explain the correct prerequisite command.

## Failure Modes And Recovery

- Fall back to `map-codebase` when Blueprint is not initialized on a brownfield repo, to `new-project` for greenfield/scaffold-only uninitialized or `mapped-only` repos, and to `health` for broken partial core state.
- Never hallucinate unsupported commands, hidden aliases, or undocumented maintenance behavior.
- Never recommend a command whose catalog entry is not `implemented`.
- Prefer a safe recommendation over a speculative dispatch when state inspection is incomplete.
- If config cannot be normalized, recommend `health` instead of routing based on stale assumptions.

## Acceptance Criteria

- Can explain why a command was selected.
- Can reason over every retained Blueprint command while routing only to implemented ones.
- Returns a safe recommendation instead of surprising the user with hidden destructive behavior.
- Uses effective config to surface active profile, branching mode, and config warnings when they materially change routing.

## Test Cases

- Router help fixture.
- Router recommendation fixture.
- Router blocked-state fixture.
- Router brownfield map-first fixture.
- Router config-warning fixture.
