# `/blu-help`
| Field | Value |
|---|---|
| Wave | `0` |
| Family | `Foundation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Show available GSD commands and usage guide |

## Purpose

`help` carries forward the GSD intent to show available GSD commands and usage guide. In Blueprint it stays Gemini-native and state-aware, but safe command recommendations must be limited to the shipped runtime surface.

## Command Path And Examples

- Gemini command path: `/blu-help`
- Compatibility during this release: `/blu:help` (deprecated; remove next release)
- Root router form: `/blu help`
- Argument hint: `none`
- `/blu-help`
- `/blu help`

## Inputs, Project State, And Prerequisite Artifacts

- None.

## Outputs

- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: No durable artifact writes are planned.
- Safe command recommendations must be limited to catalog entries whose `implemented` field is `true`.

## Blueprint And Global State Reads

- retained command catalog metadata
- repo readiness via project status

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
- Upstream dependency docs:
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

## Acceptance Criteria

- Returns guidance, assumptions, or routing output without mutating project artifacts by default.
- Uses only documented read-oriented MCP queries for inspection and routing.
- Never routes to omitted commands or hides destructive behavior behind an implicit step.
- Never recommends a planned-only or blocked command as if it were already shipped.

## Test Cases

- Fresh repo fixture.
- Partially initialized Blueprint repo fixture.
- Direct `help` happy-path fixture.

## Upstream Reference

- Upstream command file: `commands/gsd/help.md`
- Upstream workflow status: GSD has an upstream workflow file
