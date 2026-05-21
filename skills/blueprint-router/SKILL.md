---
name: blueprint-router
description: >
  host-native Blueprint routing and next-step guidance specialist. Use this
  skill when `/blu`, `help`, `progress`, `next`, or `do`-style requests need
  safe command selection inside the implemented runtime surface. Example
  scenarios: choosing between `/blu-help` and `/blu-progress`, explaining why a
  documented command is blocked or still planned, routing a root `/blu` request
  to the safest implemented command, surfacing the current waiting state for
  root `/blu` requests, and recommending the next action for partial or
  codebase-only bootstrap state.
status: implemented
commands:
  - /blu
  - /blu-help
  - /blu-progress
  - /blu-next
input_bundles:
  shared: []
  commands:
    "/blu":
      - commands/blu.toml
    "/blu-help":
      - commands/blu-help.toml
    "/blu-progress":
      - commands/blu-progress.toml
    "/blu-next":
      - commands/blu-next.toml
---

# Blueprint Router Skill

## Purpose

Provide implementation-aware routing and next-step guidance without widening recommendations past the implemented runtime surface.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Invoke optional subagents only when the current command contract explicitly allows them and effective config has `workflow.subagents=true`; otherwise use the command's no-subagent fallback and state config disabled subagents.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.

## Parity Goal

Stay aligned with the locked `help`, `progress`, `next`, and `do` contracts while preserving Blueprint deltas:

- `/blu` and `/blu-<command>` naming
- `.blueprint/` instead of `.planning/`
- host-native inline routing
- no slash-command chaining
- no hidden support commands
- `/blu` waiting-state visibility without widening routable commands

## Runtime Input Notes

Runtime input resolution is structured and command-scoped through the `input_bundles` frontmatter above. Router commands load their active command manifest as the skill-authored input bundle; live catalog metadata and command runtime-contract resources provide the command availability and routing surface.

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
6. If repo state is uninitialized and brownfield, prefer `/blu-map-codebase`.
7. If repo state is uninitialized and greenfield or scaffold-only, prefer `/blu-new-project`.
8. If repo state is `mapping-incomplete`, prefer `/blu-map-codebase`.
9. If repo state is `mapped-only`, prefer `/blu-new-project`.
10. If repo state is partial, prefer `/blu-health`.
11. Surface config warnings only when they materially change the next safe action.
12. When handling a root `/blu` request and routing cannot proceed, explain the waiting state in concrete terms such as a mapping prerequisite, missing artifact, approval gate, or blocked substrate.
13. Recommend `/blu-spec-phase <phase>` only after confirming its `blueprint_command_catalog` entry is `implemented: true`.
14. Use `/blu-spec-phase <phase>` when the user wants spec-first planning or requirements clarification before discuss, when missing context leaves a roadmap phase ambiguous enough to need WHAT/WHY clarification first, or when a saved spec is stale or contradictory and needs refresh.
15. Do not describe a missing spec by itself as a normal lifecycle blocker; discuss, research, and plan remain allowed when their own gates are satisfied.

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

## Completion Self-Check

Before claiming completion, verify:

- The active router input was only the current command (`/blu`, `/blu-help`, `/blu-progress`, or `/blu-next`); sibling manifests/docs and the planned `/blu-do` taxonomy did not add active reads, writes, agents, or routable commands.
- The active command's manifest/runtime contract was loaded, and the required MCP read set used runtime FQNs: `/blu-help` -> `mcp_blueprint_blueprint_command_catalog`, `mcp_blueprint_blueprint_project_status`; `/blu-progress` -> `mcp_blueprint_blueprint_project_status`, `mcp_blueprint_blueprint_config_get`, `mcp_blueprint_blueprint_state_load`, `mcp_blueprint_blueprint_artifact_list`, `mcp_blueprint_blueprint_command_catalog`; `/blu-next` -> `mcp_blueprint_blueprint_project_status`, `mcp_blueprint_blueprint_state_load`, `mcp_blueprint_blueprint_artifact_list`, `mcp_blueprint_blueprint_command_catalog`; `/blu` -> `mcp_blueprint_blueprint_command_catalog`, `mcp_blueprint_blueprint_project_status`, plus `mcp_blueprint_blueprint_config_get` only when config affects routing.
- Every recommendation was checked against the live catalog result with `implemented: true`; planned, blocked, or repairing commands were described with `status`/`blockedBy`, `/blu-do` remained non-runnable, and `/blu-spec-phase <phase>` was only recommended for the spec-first or stale-spec cases above.
- Project status, config warnings, state, artifacts, blockers, `derivedStatus`, `nextAction`, `missing`, `reason`, and source/path fields from MCP results were treated as authoritative; missing or rejected reads were repaired or reported as blockers.
- The router stayed read-only: no files, `.blueprint/` artifacts, host-global `~/.<host>/blueprint/`, installed extension directories, shell slash commands, or write-oriented MCP tools were mutated or invoked.
- High-risk, destructive, host-global, maintenance, shipping, undo, cleanup, workspace, or patch asks were not hidden behind freeform routing; any confirmation gate belongs to the explicit implemented direct command, not this router response.
- Waiting states were named concretely as mapping prerequisites, partial repair, missing artifacts, verification debt, approval gates, or blocked substrate, with `/blu-progress` as the fallback when no safer implemented command is unambiguous.
- The final response reported no-write status when relevant, material warnings/blockers, and the next safe implemented direct command or a clear blocker instead of claiming completion from prompt-following alone.
