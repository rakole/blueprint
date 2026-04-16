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
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.
- For structured interactive choices, confirmations, or short clarifications, prefer Gemini CLI's built-in `ask_user` tool over plain assistant prose.

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
- Host runtime FQNs for Blueprint MCP tools use the form `mcp_blueprint_<toolName>` when a prompt needs to name them explicitly
- no GSD shell choreography, commit-per-stage behavior, or generated bootstrap instruction files unless Blueprint ships dedicated runtime support

## Required Inputs

- `docs/commands/new-project.md`
- `docs/RUNTIME-REFERENCE.md`
- `docs/DRIFT.MD`
- `docs/GEMINI-CONSTRAINTS.md`
- `skills/blueprint-bootstrap/references/questioning.md`

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

## Bootstrap References

- `skills/blueprint-bootstrap/references/questioning.md` is the questioning style guide for the bootstrap conversation.
- Use the reference to improve how you ask, not to force a checklist on the user.

## Shared MCP Contracts

- `mcp_blueprint_blueprint_project_init` is the first persistent bootstrap write. Pass structured bootstrap context through `bootstrapSeed`, require explicit confirmation before `overwrite: true`, and use returned `createdPaths`, `configPath`, and `nextAction` as authoritative.
- `mcp_blueprint_blueprint_config_set` defaults to project-local writes. Use `scope: "defaults"` only when the user explicitly asks to update saved defaults.
- `mcp_blueprint_blueprint_artifact_scaffold` is a seeding tool, not the durable source of truth for authored bootstrap content once `project_init` has run.

## Workflow Rules

### 1. Preflight

1. Classify the repo as greenfield, scaffold-only, or brownfield before the first write.
2. Inspect saved defaults before asking for changes, and treat `--auto` as a non-interactive bootstrap mode rather than a way to skip overwrite safety.
3. Require explicit overwrite confirmation before replacing an existing `.blueprint/` tree.
4. If repo evidence is fuzzy or brownfield risk is non-trivial, use `blueprint-project-researcher` for a bounded repo-and-product brief before proceeding.

### 2. Bootstrap Discovery

1. Run a real discovery loop before the first write unless `--auto` already includes enough project context.
2. Use `questioning.md` as a background guide: start open, follow the thread, challenge vagueness, make abstract ideas concrete, and stop once the bootstrap brief is strong enough to write.
3. When the user wants to explain freely, keep the interaction in freeform conversation. When a concrete tradeoff or workflow choice needs structure, prefer a one-question `ask_user` dialog over a plain-text menu.
4. Capture enough context to support:
   - a substantive `PROJECT.md`
   - grouped and traceable bootstrap requirements
   - a credible first roadmap slice with success criteria
5. In interactive mode, summarize your understanding and get explicit confirmation before the first persistent write. Prefer `ask_user` for that approval gate.

### 3. Workflow Preferences

1. Offer saved defaults first when they exist and are valid.
2. If defaults are not used, gather concise workflow preferences that materially affect bootstrap quality:
   - mode
   - granularity
   - parallelization posture
   - planning-doc git preference
   - key workflow gates such as research, plan check, and verifier
3. Prefer `ask_user` when saved-default or workflow-preference choices are better expressed as labeled options with short descriptions.
4. Use `mcp_blueprint_blueprint_config_set` after initialization to persist repo-level choices, and only touch saved defaults when the user explicitly asks.

### 4. Requirements And Roadmap Shaping

1. Convert the discovered context into a bootstrap brief with vision, audience, constraints, milestone framing, non-goals, and assumptions.
2. Shape requirements before writing:
   - make them specific, user-centered, and testable
   - separate likely v1 scope from deferred and out-of-scope work
   - keep requirement-to-phase traceability explicit
3. Use `blueprint-roadmapper` when grouped phase proposals, requirement coverage, sequencing, or success-criteria shaping would benefit from a bounded synthesis pass.
4. In interactive mode, run a revision loop for requirements and roadmap structure before the first persistent write instead of locking in the first draft immediately.

### 5. Persistence And Routing

1. Use `mcp_blueprint_blueprint_project_init` for the first persistent bootstrap write.
2. Pass the strongest available bootstrap seed so `PROJECT.md`, `REQUIREMENTS.md`, and `ROADMAP.md` land as authored drafts rather than placeholder shells.
3. Keep follow-up config changes inside `mcp_blueprint_blueprint_config_set`.
4. If the repo is brownfield and mapping has not happened yet, route to `/blu-map-codebase` or mark the roadmap as provisional until mapping is complete.
5. Re-read project status after initialization and end with the next safe implemented command.
6. Do not claim later lifecycle commands are runnable unless the catalog marks them implemented.
7. If Blueprint MCP tools are unavailable, stop and report the disconnected runtime instead of trying shell wrappers such as `mcp use`, `blueprint-mcp`, or ad-hoc SDK scripts.

## Output Style

- Explain the project direction you captured, not just the files you created.
- Explain defaults provenance.
- Explain whether requirements and roadmap shape were approved, revised, or auto-synthesized.
- Explain any overwrite or repair risk before writes.
- Keep the user anchored on the next safe action after bootstrap.
