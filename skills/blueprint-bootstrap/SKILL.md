---
name: blueprint-bootstrap
description: >
  Blueprint bootstrap and repo-initialization specialist. Use this skill when
  `/blu-new-project` needs durable project setup, repo-shape classification, or
  brownfield-aware bootstrap guidance before later lifecycle work. Example
  scenarios: classifying a repo as greenfield or brownfield, applying saved
  defaults during bootstrap, drafting substantive initial planning artifacts,
  and deciding whether bootstrap should route to `/blu-map-codebase`.
status: implemented
commands:
  - /blu-new-project
---

# Blueprint Bootstrap Skill

## Purpose

Orchestrate Blueprint project initialization around the current MCP bootstrap primitives without reducing the flow to raw scaffolding.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Only invoke optional subagents when the current command contract explicitly allows them.
- Never run `/blu-*` in the shell. Blueprint slash commands are Gemini entrypoints, not shell executables.

## Parity Goal

Preserve the useful structure of the locked `new-project` contract:

- detect brownfield context early
- honor saved defaults
- ask clarifying questions when needed
- establish trustworthy project state before later planning

Current Blueprint delta:

- persistent writes go through MCP tools into `.blueprint/`
- no `.planning/` runtime state
- no installer-managed runtime mutation
- Gemini runtime FQNs for Blueprint MCP tools use the form `mcp_blueprint_<toolName>` when a prompt needs to name them explicitly

## Required Inputs

- `docs/commands/new-project.md`
- `docs/RUNTIME-REFERENCE.md`
- `docs/DRIFT.MD`

## Required MCP Tools

- `mcp_blueprint_blueprint_project_init`
- `mcp_blueprint_blueprint_project_status`
- `mcp_blueprint_blueprint_config_get`
- `mcp_blueprint_blueprint_config_set`
- `mcp_blueprint_blueprint_state_update`
- `mcp_blueprint_blueprint_artifact_scaffold`

## Optional Agents

- `blueprint-project-researcher`
- `blueprint-roadmapper`

## Workflow Rules

1. Classify the repo as greenfield, scaffold-only, or brownfield before the first write.
2. Inspect saved defaults before asking for changes, and treat `--auto` as a non-interactive bootstrap mode rather than a way to skip overwrite safety.
3. Gather or synthesize enough context that `PROJECT.md`, `REQUIREMENTS.md`, and `ROADMAP.md` are no longer placeholder-only shells.
4. Use `mcp_blueprint_blueprint_project_init` for the first persistent bootstrap write.
5. Keep follow-up config changes inside `mcp_blueprint_blueprint_config_set`.
6. If the repo is brownfield and mapping has not happened yet, route to `/blu-map-codebase` or mark the roadmap as provisional until mapping is complete.
7. Re-read project status after initialization and end with the next safe implemented command.
8. Do not claim later lifecycle commands are runnable unless the catalog marks them implemented.
9. If Blueprint MCP tools are unavailable, stop and report the disconnected runtime instead of trying shell wrappers such as `mcp use`, `blueprint-mcp`, or ad-hoc SDK scripts.

## Output Style

- Explain defaults provenance.
- Explain any overwrite or repair risk before writes.
- Keep the user anchored on the next safe action after bootstrap.
