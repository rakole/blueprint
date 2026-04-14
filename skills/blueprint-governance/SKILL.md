---
name: blueprint-governance
description: >
  Blueprint governance, config, and handoff specialist. Use this skill when
  `settings`, `set-profile`, `health`, `pause-work`, or `resume-work` need
  explicit state inspection, confirmation-gated repair behavior, or durable
  handoff handling. Example scenarios: updating normalized repo settings,
  changing the active model profile, diagnosing config drift, writing a pause
  handoff, and restoring work from the canonical pause state.
status: implemented
commands:
  - /blu-settings
  - /blu-set-profile
  - /blu-health
  - /blu-pause-work
  - /blu-resume-work
---

# Blueprint Governance Skill

## Purpose

Handle config, profile, and health flows with explicit state inspection and confirmation-gated repair behavior.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Only invoke optional subagents when the current command contract explicitly allows them.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.

## Parity Goal

Stay close to the locked governance contracts for settings, profile selection, and health validation while preserving Blueprint config and hook boundaries.

## Required Inputs

- `docs/commands/settings.md`
- `docs/commands/set-profile.md`
- `docs/commands/health.md`
- `docs/commands/pause-work.md`
- `docs/commands/resume-work.md`
- `docs/DECISIONS.md`
- `docs/DRIFT.MD`

## Required MCP Tools

- `blueprint_project_status`
- `blueprint_config_get`
- `blueprint_config_set`
- `blueprint_config_set_profile`
- `blueprint_state_load`
- `blueprint_pause_handoff_get`
- `blueprint_pause_handoff_write`
- `blueprint_state_update`
- `blueprint_state_sync`
- `blueprint_artifact_list`
- `blueprint_artifact_validate`

## Workflow Rules

1. Diagnose before mutating.
2. Never reintroduce repo-level `hooks.*`, `workflow.use_workspaces`, or `workflow.use_workstreams`.
3. `set-profile` changes only project-local `model_profile`.
4. `health --repair` must explain exact writes before it performs them.
5. If Blueprint is uninitialized, route to `/blu-new-project` instead of pretending repair equals bootstrap.
6. Keep all config persistence in MCP.
7. `pause-work` must persist a single durable handoff in `.blueprint/reports/` through MCP and require explicit confirmation before replacing it.
8. `pause-work` should preserve resumable context without silently creating a git commit; keep the next implemented follow-up on `/blu-resume-work`.
9. `resume-work` must restore the canonical pause handoff context, clear an active pause condition through `blueprint_state_update`, and then re-anchor `STATE.md` on the live next safe implemented action.
