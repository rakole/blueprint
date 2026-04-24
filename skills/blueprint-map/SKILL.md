---
name: blueprint-map
description: >
  Blueprint brownfield codebase-mapping specialist. Use this skill when
  `/blu-map-codebase` needs evidence-backed repository analysis, stable
  codebase-bundle output, or reuse-versus-refresh guidance for existing mapping
  docs. Example scenarios: producing the seven-document codebase bundle,
  deepening one area like `mcp` or `auth`, deciding whether existing mapping
  docs should be reused or refreshed, and summarizing brownfield architecture
  for later Blueprint lifecycle work.
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
- Prefer Gemini CLI's built-in `ask_user` dialog for overwrite, reuse-versus-refresh, or any structured confirmation choice.
- Execution profile: `long-running-mutation`.
- Keep the shared stage vocabulary explicit during non-trivial runs: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`.
- Keep the in-flight status contract legible throughout the mapping pass: resolved scope, active stage, pending gate, execution mode, and next safe action.
- Treat a user-supplied focus area as targeted deepening of the same seven-artifact bundle, not as a separate suffix-only mode.
- Read the canonical codebase-bundle contract before deciding whether to seed or refresh existing artifacts, and validate the resulting bundle before concluding.
- For `mcp_blueprint_blueprint_artifact_scaffold`, pass repo-relative artifact paths such as `.blueprint/codebase/STACK.md`; do not guess bare names like `STACK` and do not pass absolute filesystem paths.
- For `mcp_blueprint_blueprint_artifact_summary_digest`, pass repo-relative evidence inputs only and treat the returned `inputsUsed` list as the authoritative digest scope.
- Treat Blueprint skills as loaded guidance, not callable tools. Only invoke optional subagents when the current command contract explicitly allows them.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.

## Parity Goal

Carry forward the mapper-oriented flow:

- prefer dedicated mapper agents when available
- otherwise perform deterministic sequential mapping
- produce a full codebase reference bundle
- keep focused deepening within the same seven artifact outputs

Blueprint deltas:

- write to `.blueprint/codebase/`
- may be the first Blueprint write for brownfield repos, creating only the
  seven `.blueprint/codebase/*.md` artifacts
- preserve edited docs unless replace is explicitly confirmed
- keep persistence in MCP tools

## Required Inputs

- `docs/commands/map-codebase.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/RUNTIME-REFERENCE.md`

## Required MCP Tools

- `blueprint_project_status`
- `blueprint_artifact_contract_read`
- `blueprint_artifact_scaffold`
- `blueprint_artifact_list`
- `blueprint_artifact_summary_digest`
- `blueprint_codebase_artifact_write`
- `blueprint_artifact_validate`

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

1. Read `blueprint_project_status` first. Continue when an uninitialized repo is brownfield, when status is `mapping-incomplete`, or when an initialized project needs a map refresh. Stop early for greenfield/scaffold-only uninitialized repos and for broken partial core state.
2. Inspect the existing codebase bundle before writing.
3. Keep the resolved scope explicit as the repo root, requested focus area if any, and the same seven-artifact bundle target.
4. Reuse edited docs by default.
5. Treat reuse-versus-refresh, replace confirmation, and validation blockers as explicit pending gates instead of post-hoc notes.
6. Keep the execution mode explicit as full-bundle mapping versus focused deepening, plus reuse-default versus confirmed refresh.
7. Persist substantive mapping content through `blueprint_codebase_artifact_write` instead of raw file edits once the digest-backed summaries are ready.
8. Validate the resulting bundle before treating the mapping pass as complete.
9. Mention created, reused, and blocked artifacts separately.
10. End with the next implemented Blueprint action, not a planned-only command. A successful map-first brownfield run should leave `mapped-only` status and route to `/blu-new-project`.
