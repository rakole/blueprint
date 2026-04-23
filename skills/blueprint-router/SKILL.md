---
name: blueprint-router
description: >
  host-native Blueprint routing and next-step guidance specialist. Use this
  skill when `/blu`, `help`, `progress`, `next`, or `do`-style requests need
  safe command selection inside the implemented runtime surface. Example
  scenarios: choosing between `/blu-help` and `/blu-progress`, explaining why a
  documented command is blocked or still planned, routing a root `/blu` request
  to the safest implemented command, surfacing the current waiting state for
  root `/blu` requests, and recommending the next action for a partial repo.
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

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Only invoke optional subagents when the current command contract explicitly allows them.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.

## Parity Goal

Stay aligned with the locked `help`, `progress`, `next`, and `do` contracts while preserving Blueprint deltas:

- `/blu` and `/blu-<command>` naming
- `.blueprint/` instead of `.planning/`
- host-native inline routing
- no slash-command chaining
- no hidden support commands
- `/blu` waiting-state visibility without widening routable commands

## Required Inputs

- `docs/commands/root-router.md`
- `docs/commands/help.md`
- `docs/commands/progress.md`
- `docs/commands/next.md`
- `docs/commands/do.md`
- `docs/RUNTIME-REFERENCE.md`
- `docs/DRIFT.MD`

## Required MCP Tools

- `mcp_blueprint_blueprint_command_catalog`
- `mcp_blueprint_blueprint_project_status`
- `mcp_blueprint_blueprint_config_get`
- `mcp_blueprint_blueprint_state_load`
- `mcp_blueprint_blueprint_artifact_list`

## Routing Rules

1. Read `mcp_blueprint_blueprint_command_catalog` first.
2. Treat `implemented: true` as the only routable command state.
3. Never route to commands whose status is `planned`, `blocked`, or `repairing`.
4. If the user asks for a blocked or planned command, explain the `blockedBy` reasons and recommend the nearest implemented prerequisite.
5. Prefer read-only guidance for ambiguous requests.
6. If repo state is uninitialized, prefer `/blu-new-project`.
7. If repo state is partial, prefer `/blu-health`.
8. Surface config warnings only when they materially change the next safe action.
9. When handling a root `/blu` request and routing cannot proceed, explain the waiting state in concrete terms such as a missing artifact or blocked substrate.

## Planned `/blu-do` Contract

- `/blu-do` remains a planned direct freeform router contract until its own manifest ships. Do not present it as runnable while `blueprint_command_catalog` keeps it non-implemented.
- When implementing or auditing `/blu-do`, use this intent taxonomy:
  - Repo or status guidance -> `help`, `progress`, `next`
  - Lightweight capture -> `note`, `add-todo`, `add-backlog`, `review-backlog`
  - Idea shaping -> `explore`
  - Small execution -> `fast`
  - Bounded execution -> `quick`
  - Planning or lifecycle escalation -> `discuss-phase`, `plan-phase`
  - Ambiguous, oversized, risky, or unsupported asks -> clarify or recommend the safest implemented direct command
- `/blu-do` routes only to retained Blueprint commands, never writes directly, never widens routing to planned or blocked commands, and never hides high-risk maintenance behavior behind vague prose.
- `/blu` is the front door, `/blu-explore` is ideation with confirmation-gated persistence, and `/blu-do` is the future direct freeform router.

## Output Style

- Explain why a command is or is not currently available.
- Keep recommendations inside the implemented Blueprint surface.
- Never hallucinate omitted legacy commands or future Blueprint commands.
