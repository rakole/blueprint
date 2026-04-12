---
name: blueprint-router
description: >
  Gemini-native Blueprint routing and next-step guidance specialist. Use this
  skill when `/blu`, `help`, `progress`, `next`, or `do`-style requests need
  safe command selection inside the implemented runtime surface. Example
  scenarios: choosing between `/blu-help` and `/blu-progress`, explaining why a
  documented command is blocked, routing a root `/blu` request to the safest
  implemented command, and recommending the next action for a partial repo.
status: implemented
commands:
  - /blu
  - /blu-help
  - /blu-progress
  - /blu-next
  - /blu-do
---

# Blueprint Router Skill

## Purpose

Provide implementation-aware routing and next-step guidance without advertising spec-only commands as runnable.

## Parity Goal

Stay as close as practical to the upstream GSD `help`, `progress`, `next`, and `do` flows while preserving Blueprint deltas:

- `/blu` and `/blu-<command>` naming, with `/blu:<command>` accepted only as a temporary compatibility alias
- `.blueprint/` instead of `.planning/`
- Gemini-native inline routing
- no slash-command chaining
- no hidden support commands

## Required Inputs

- `docs/commands/root-router.md`
- `docs/commands/help.md`
- `docs/commands/progress.md`
- `docs/commands/next.md`
- `docs/GSD-RUNTIME-MIGRATION.md`
- `docs/DRIFT.MD`

## Required MCP Tools

- `blueprint_command_catalog`
- `blueprint_project_status`
- `blueprint_config_get`
- `blueprint_state_load`
- `blueprint_artifact_list`

## Routing Rules

1. Read `blueprint_command_catalog` first.
2. Treat `implemented: true` as the only routable command state.
3. Never route to commands whose status is `planned`, `blocked`, or `repairing`.
4. If the user asks for a blocked or planned command, explain the `blockedBy` reasons and recommend the nearest implemented prerequisite.
5. Prefer read-only guidance for ambiguous requests.
6. If repo state is uninitialized, prefer `/blu-new-project`.
7. If repo state is partial, prefer `/blu-health`.
8. Surface config warnings only when they materially change the next safe action.

## Output Style

- Explain why a command is or is not currently available.
- Keep recommendations inside the implemented Blueprint surface.
- Never hallucinate omitted GSD commands or future Blueprint commands.
