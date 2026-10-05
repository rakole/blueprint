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
Start with `blueprint_blueprint_project_prepare`; it returns readiness, config,
repo summary and the small authoring schema. Do not separately fetch artifact
contracts, config or status when prepare already supplied them.

When a brownfield brief needs repository understanding, reuse the prepare packet
and any known live targets first. If discovery is still unresolved, consult a
verified `.blueprint/codebase/INDEX.md` and follow its generated `ENTRY.md`
navigation to selected evidence only. Missing, unsupported, stale, or malformed
portable maps fall back to ordinary source discovery or existing summaries; this
skill never regenerates a map. Greenfield bootstrap and readiness or routing
decisions do not require a map read.

First run must ask a clarifying question and wait for the user, even when there is
no `.blueprint/config.json`. Only explicit `--auto` enables automatic synthesis.
The hardcoded config defaults are `mode: "interactive"` and `workflow.auto_advance: false`.

The parent owns discovery, visible approval and MCP persistence. Author the product
once with `bootstrapModel`; runtime owns IDs, numbering, statuses and Markdown.
Do not generate `.planning/`, `AGENTS.md`, `CLAUDE.md`, or repo-root `CONTEXT.md`.
Never hand-edit `.blueprint/`.

## Native Invocation Guard

Run this skill only after the active `/blu` command has loaded it once through native `skill({ name })` dispatch and the active command appears in this skill's `commands` metadata. If invoked directly through a synthesized `/blueprint-*` alias or any other direct skill call, stop before tool, MCP, resource, or filesystem activity and direct the user to `/blu-help`. Read only the active command's effective input bundle; do not preload sibling-command or recovery references.

## Runtime Call Rules

Translate any shorthand tool ids like `blueprint_project_status` to runtime FQNs
such as `blueprint_blueprint_project_status` before calling them.
Treat Blueprint skills as loaded guidance, not callable tools.
Never run `/blu-*` in the shell.
Never invoke MCP tools through shell wrappers or ad-hoc SDK scripts.

Normal tools:
- `blueprint_blueprint_project_prepare`
- `blueprint_blueprint_project_init`
- `blueprint_blueprint_artifact_validate`
- `blueprint_blueprint_project_status`
- `blueprint_blueprint_config_set` only for approved preference changes

Load `references/questioning.md` only when discovery is difficult, and
`references/runtime-guardrails.md` only for recovery or unfamiliar host behavior.
Optional agents `blueprint-project-researcher` and `blueprint-roadmapper` are for
specific unresolved questions, only when prepare's effective `workflow.subagents`
is enabled and the bundled agent is available. Otherwise synthesize inline.
Read that agent's contract only when using it; give a compact bootstrap packet,
not an existing-milestone carry-forward packet. Never substitute generic browser,
web-search or shell-only agents. Rewrite useful findings into the main proposal.
