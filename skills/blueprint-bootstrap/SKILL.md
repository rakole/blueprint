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
### Guidance for LLM only(not to show on screen)
- Make sure to keep updating the user what you are doing through gemini cli native tools / UX, Do not dump whole ouput, but step name and just the gist of what you are doing is enough

# Blueprint Bootstrap Skill

## Purpose

Orchestrate Blueprint project initialization around the current MCP bootstrap
primitives without reducing the flow to raw scaffolding.

## Runtime Self-Sufficiency

This skill package is the runtime source of truth for `/blu-new-project`.

- Runtime behavior must stay executable from this skill plus its local
  references alone.

## Runtime Call Rules

- Load `references/runtime-guardrails.md` for the canonical host-entrypoint,
  shell, MCP FQN, approval-surface, and Gemini-helper rules.
- Call Blueprint MCP tools only through runtime FQNs such as
  `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` before
  calling them.
- Treat Blueprint skills as loaded guidance, not callable tools.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI
  entrypoints, not shell executables.

## Visible Approval Surface

- Follow the approval-surface rules in `references/runtime-guardrails.md`.
- Treat `blueprint-project-researcher` and `blueprint-roadmapper` outputs as
  private synthesis inputs until their conclusions are rewritten into the main
  conversation as the visible approval packet.

## Local Runtime References

- `skills/blueprint-bootstrap/references/questioning.md`
  Questioning style for the deep discovery loop and approval rhythm.
- `skills/blueprint-bootstrap/references/bootstrap-runtime-contract.md`
  Staged bootstrap workflow, saved-default provenance, approval and revision
  gates, `--auto` behavior, persistence, validation, and routing.
- `skills/blueprint-bootstrap/references/runtime-guardrails.md`
  Host-entrypoint, shell, FQN, anti-legacy, and honest Gemini-native fallback
  guardrails.

## Required MCP Tools

- `mcp_blueprint_blueprint_project_init`
- `mcp_blueprint_blueprint_project_status`
- `mcp_blueprint_blueprint_config_get`
- `mcp_blueprint_blueprint_config_set`
- `mcp_blueprint_blueprint_state_update`
- `mcp_blueprint_blueprint_artifact_contract_read`
- `mcp_blueprint_blueprint_artifact_validate`
- `mcp_blueprint_blueprint_artifact_scaffold`

## Optional Agents

- `blueprint-project-researcher`
- `blueprint-roadmapper`

Use optional agents only when their bundled definitions are available and the
current bootstrap question benefits from bounded read-only synthesis. Browser,
web-search, shell-only, or generic helpers are not substitutes for these
Blueprint agents. When the agents are unavailable, follow the no-subagent
fallback in `references/bootstrap-runtime-contract.md`: handle one research
dimension, requirement group, or roadmap area at a time, compress the
carry-forward evidence, then continue.

## Shared Bootstrap Posture

- Execution profile: `long-running-mutation`.
- Keep the richer bootstrap language grounded in the shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`.
- Keep the in-flight status contract legible throughout non-trivial runs: resolved scope, active stage, pending gate, execution mode, and next safe action.
- Read the bootstrap contracts and artifact contracts before drafting or revising authored
  bootstrap content, persist the first substantive write through
  `mcp_blueprint_blueprint_project_init`, and validate the result with
  `mcp_blueprint_blueprint_artifact_validate`.
- Treat `contract.authoringTemplate` from `mcp_blueprint_blueprint_artifact_contract_read`
  as the heading and schema authority for authored `PROJECT.md`,
  `REQUIREMENTS.md`, and `ROADMAP.md` content. Richness comes from the
  bootstrap seed and visible approval packet, not from weakening validation.
- Requirements must be specific, user-centered, atomic, grouped, and traceable.
  Roadmap phases must cover every committed requirement exactly once and carry
  observable success criteria suitable for later discovery, planning, and
  validation.
- `mcp_blueprint_blueprint_project_init` remains the first persistent bootstrap write, with the detailed mutation contract preserved in `references/bootstrap-runtime-contract.md`.
- Workflow preference capture still covers mode, granularity, parallelization posture, planning-doc git preference, and key workflow toggles through the local runtime references.
- Preserve brownfield classification, saved-default handling, workflow
  preference capture, revision loop behavior, and next safe implemented command
  routing through the local runtime references rather than top-level docs.

## Output Style

- Explain the project direction you captured, not just the files you created.
- Explain defaults provenance.
- Explain whether requirements and roadmap shape were approved, revised, or
  auto-synthesized.
- Explain any overwrite or repair risk before writes.
- Keep the user anchored on the next safe implemented command.
