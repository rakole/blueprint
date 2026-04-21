# `/blu-help`
| Field | Value |
|---|---|
| Wave | `0` |
| Family | `Foundation` |
| Execution profile | `router` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `help` stays inside the shared router posture: resolve the repo state, read the current command surface, and route to the next safe implemented command without implying hidden mutation.
- When the repo is waiting on a prerequisite, `help` should name that pending gate in concrete terms instead of glossing over it.

## Purpose

`help` is Blueprint's command for showing available Blueprint commands and usage guidance. In Blueprint it stays host-native, state-aware, and aligned to the shared router profile, but safe command recommendations must be limited to the shipped runtime surface.

## Command Path And Examples

- CLI command path: `/blu-help`
- Root router form: `/blu help`
- Argument hint: `none`
- `/blu-help`
- `/blu help`

## Inputs, Project State, And Prerequisite Artifacts

- None.

## Outputs

- User-facing result: a concise completion summary plus the next logical action when applicable, with waiting state called out when Blueprint is still uninitialized or partially initialized.
- Repo side effects: No durable artifact writes are planned.
- Safe command recommendations must be limited to catalog entries whose `implemented` field is `true`, and blocked or planned commands must be described as not runnable.

## Blueprint And Global State Reads

- retained command catalog metadata
- repo readiness via project status
- waiting state from project status and command availability

## Blueprint And Global State Writes

- none

## Required MCP Tools

- `blueprint_command_catalog` -> `{commands, waves, aliases}` with per-command `implemented`, `status`, and `blockedBy`
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
- The user asks for a documented-but-blocked command.

## Failure Modes And Recovery

- If Blueprint is not initialized, prefer `/blu-new-project`.
- If Blueprint is partial, prefer `/blu-health`.
- If a requested command is blocked, explain the missing substrate instead of presenting it as runnable.
- If the current state is waiting on a missing artifact, verification debt, or blocked substrate, say so plainly instead of masking it as a general recommendation.
- Keep the next safe action explicit even when the current state is only a waiting state.

## Acceptance Criteria

- Returns guidance, assumptions, or routing output without mutating project artifacts by default.
- Uses only documented read-oriented MCP queries for inspection and routing.
- Never routes to omitted commands or hides destructive behavior behind an implicit step.
- Never recommends a planned-only or blocked command as if it were already shipped.
- Keeps the shared router profile visible in the command contract.

## Test Cases

- Fresh repo fixture.
- Partially initialized Blueprint repo fixture.
- Direct `help` happy-path fixture.
