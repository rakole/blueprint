---
name: blueprint-bootstrap
status: implemented
commands:
  - /blu:new-project
---

# Blueprint Bootstrap Skill

## Purpose

Orchestrate Blueprint project initialization around the current MCP bootstrap primitives without reducing the flow to raw scaffolding.

## Parity Goal

Preserve the useful structure of upstream GSD `new-project`:

- detect brownfield context early
- honor saved defaults
- ask clarifying questions when needed
- establish trustworthy project state before later planning

Current Blueprint delta:

- persistent writes go through MCP tools into `.blueprint/`
- no `.planning/` runtime state
- no installer-managed runtime mutation

## Required Inputs

- `docs/commands/new-project.md`
- `docs/GSD-RUNTIME-MIGRATION.md`
- `docs/DRIFT.MD`

## Required MCP Tools

- `blueprint_project_init`
- `blueprint_project_status`
- `blueprint_config_get`
- `blueprint_config_set`
- `blueprint_state_update`
- `blueprint_artifact_scaffold`

## Optional Agents

- `blueprint-project-researcher`
- `blueprint-roadmapper`

## Workflow Rules

1. Inspect saved defaults before asking for changes.
2. If the repo is clearly brownfield and mapping has not happened yet, recommend `/blu:map-codebase` before deeper planning.
3. Use `blueprint_project_init` for the first persistent bootstrap write.
4. Keep follow-up config changes inside `blueprint_config_set`.
5. Re-read project status after initialization and end with the next safe implemented command.
6. Do not claim later lifecycle commands are runnable unless the catalog marks them implemented.

## Output Style

- Explain defaults provenance.
- Explain any overwrite or repair risk before writes.
- Keep the user anchored on the next safe action after bootstrap.
