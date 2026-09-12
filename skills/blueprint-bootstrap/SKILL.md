---
name: blueprint-bootstrap
description: Clarify product intent and create a first milestone with MCP-owned project documents.
status: implemented
commands:
  - /blu-new-project
input_bundles:
  commands:
    "/blu-new-project":
      - skills/blueprint-bootstrap/references/bootstrap-runtime-contract.md
---
# Blueprint Bootstrap

Use `references/bootstrap-runtime-contract.md` as the active contract.
Start with `mcp_blueprint_blueprint_project_prepare`; it returns readiness, config,
repo summary and the small authoring schema. Do not separately fetch artifact
contracts, config or status when prepare already supplied them.

First run must ask a clarifying question and wait for the user, even when there is
no `.blueprint/config.json`. Only explicit `--auto` enables automatic synthesis.
The hardcoded config defaults are `mode: "interactive"` and `workflow.auto_advance: false`.

The parent owns discovery, visible approval and MCP persistence. Author the product
once with `bootstrapModel`; runtime owns IDs, numbering, statuses and Markdown.
Do not generate `.planning/`, `AGENTS.md`, `CLAUDE.md`, or repo-root `CONTEXT.md`.
Never hand-edit `.blueprint/`.

## Runtime Call Rules

Translate any shorthand tool ids like `blueprint_project_status` to runtime FQNs
such as `mcp_blueprint_blueprint_project_status` before calling them.
Treat Blueprint skills as loaded guidance, not callable tools.
Never run `/blu-*` in the shell.
Never invoke MCP tools through shell wrappers or ad-hoc SDK scripts.

Normal tools:
- `mcp_blueprint_blueprint_project_prepare`
- `mcp_blueprint_blueprint_project_init`
- `mcp_blueprint_blueprint_artifact_validate`
- `mcp_blueprint_blueprint_project_status`
- `mcp_blueprint_blueprint_config_set` only for approved preference changes

Load `references/questioning.md` only when discovery is difficult, and
`references/runtime-guardrails.md` only for recovery or unfamiliar host behavior.
Optional agents `blueprint-project-researcher` and `blueprint-roadmapper` are for
specific unresolved questions, only when prepare's effective `workflow.subagents`
is enabled and the bundled agent is available. Otherwise synthesize inline.
Read that agent's contract only when using it; give a compact bootstrap packet,
not an existing-milestone carry-forward packet. Never substitute generic browser,
web-search or shell-only agents. Rewrite useful findings into the main proposal.
