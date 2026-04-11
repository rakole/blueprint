---
name: blueprint-governance
status: implemented
commands:
  - /blu:settings
  - /blu:set-profile
  - /blu:health
  - /blu:pause-work
  - /blu:resume-work
---

# Blueprint Governance Skill

## Purpose

Handle config, profile, and health flows with explicit state inspection and confirmation-gated repair behavior.

## Parity Goal

Stay close to upstream GSD governance flows for settings, profile selection, and health validation while preserving Blueprint config and hook boundaries.

## Required Inputs

- `docs/commands/settings.md`
- `docs/commands/set-profile.md`
- `docs/commands/health.md`
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
- `blueprint_state_sync`
- `blueprint_artifact_list`
- `blueprint_artifact_validate`

## Workflow Rules

1. Diagnose before mutating.
2. Never reintroduce repo-level `hooks.*`, `workflow.use_workspaces`, or `workflow.use_workstreams`.
3. `set-profile` changes only project-local `model_profile`.
4. `health --repair` must explain exact writes before it performs them.
5. If Blueprint is uninitialized, route to `/blu:new-project` instead of pretending repair equals bootstrap.
6. Keep all config persistence in MCP.
7. `pause-work` must persist a single durable handoff in `.blueprint/reports/` through MCP and require explicit confirmation before replacing it.
8. `pause-work` should preserve resumable context without silently creating a git commit; keep the next implemented follow-up on `/blu:progress`.
