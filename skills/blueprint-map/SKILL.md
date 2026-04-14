---
name: blueprint-map
description: >
  Blueprint brownfield codebase-mapping specialist. Use this skill when
  `/blu-map-codebase` needs evidence-backed repository analysis, stable
  codebase-bundle output, or reuse-versus-refresh guidance for existing mapping
  docs. Example scenarios: producing the seven-document codebase bundle,
  deepening one area like `mcp` or `auth`, deciding whether existing mapping
  docs should be reused, and summarizing brownfield architecture for later
  Blueprint lifecycle work.
status: implemented
commands:
  - /blu-map-codebase
---

# Blueprint Map Skill

## Purpose

Map a codebase into the stable Blueprint codebase bundle with strong reuse-by-default behavior and clear alignment with the locked Blueprint mapping contract.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- For `mcp_blueprint_blueprint_artifact_scaffold`, pass repo-relative artifact paths such as `.blueprint/codebase/STACK.md`; do not guess bare names like `STACK` and do not pass absolute filesystem paths.
- Treat Blueprint skills as loaded guidance, not callable tools. Only invoke optional subagents when the current command contract explicitly allows them.
- Never run `/blu-*` in the shell. Blueprint slash commands are Gemini entrypoints, not shell executables.

## Parity Goal

Carry forward the mapper-oriented flow:

- prefer dedicated mapper agents when available
- otherwise perform deterministic sequential mapping
- produce a full codebase reference bundle

Blueprint deltas:

- write to `.blueprint/codebase/`
- preserve edited docs unless replace is explicitly confirmed
- keep persistence in MCP tools

## Required Inputs

- `docs/commands/map-codebase.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/RUNTIME-REFERENCE.md`
- `docs/DRIFT.MD`

## Required MCP Tools

- `blueprint_project_status`
- `blueprint_artifact_scaffold`
- `blueprint_artifact_list`
- `blueprint_artifact_summary_digest`

## Optional Agents

- `blueprint-mapper`

## Artifact Bundle

- `.blueprint/codebase/STACK.md`
- `.blueprint/codebase/ARCHITECTURE.md`
- `.blueprint/codebase/STRUCTURE.md`
- `.blueprint/codebase/CONVENTIONS.md`
- `.blueprint/codebase/TESTING.md`
- `.blueprint/codebase/INTEGRATIONS.md`
- `.blueprint/codebase/CONCERNS.md`

## Workflow Rules

1. Stop early if Blueprint is uninitialized or partial.
2. Inspect the existing codebase bundle before writing.
3. Reuse edited docs by default.
4. Require explicit replace confirmation before overwriting existing codebase docs.
5. Mention created, reused, and blocked artifacts separately.
6. End with the next implemented Blueprint action, not a planned-only command.
