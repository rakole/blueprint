---
name: blueprint-docs
description: >
  Documentation generation and verification for Blueprint repos. Use this skill
  to refresh selected repo docs from saved evidence, keep verification explicit,
  and persist a durable docs-update report without widening into arbitrary repo
  mutation.
status: implemented
commands:
  - /blu-docs-update
---

# Blueprint Docs Skill

## Purpose

Orchestrate Blueprint's documentation refresh and verification flow so repo
docs stay aligned with the actual codebase, Blueprint evidence stays durable,
and doc mutation remains reviewable and tightly scoped.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Only invoke optional subagents when the current command contract explicitly allows them.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.

## Parity Goal

Carry forward the useful docs-update intent while preserving
Blueprint's host-native boundaries:

- documentation updates stay grounded in repo and Blueprint evidence
- verification-only runs stay read-only for repo docs
- durable reporting remains project-local in `.blueprint/reports/`
- repo doc edits stay narrowly scoped instead of becoming a broad rewrite pass
- follow-up routing stays inside the implemented Blueprint surface

## Required Inputs

- `docs/commands/docs-update.md`
- `docs/COMMAND-CATALOG.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/RUNTIME-REFERENCE.md`
- the targeted repo docs selected for the current pass
- relevant code, tests, and any existing `.blueprint/codebase/` artifacts that
  verify the documentation claims

## Required MCP Tools

- `blueprint_project_status`
- `blueprint_artifact_list`
- `blueprint_artifact_summary_digest`
- `blueprint_artifact_report_write`

## Optional Agents

- `blueprint-doc-writer`
- `blueprint-doc-verifier`

## Shared Runtime Contract

- Execution profile for `docs-update`: `long-running-mutation`
- Stage vocabulary for visible docs-update posture: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields for `docs-update`: resolved scope, active stage, pending gate, execution mode, next safe action

## Shared MCP Contracts

- `blueprint_artifact_summary_digest`: pass repo-relative `artifactPaths`, `docFiles`, `sourceFiles`, and `testFiles` only, and treat `inputsUsed` as the authoritative digest scope.
- `blueprint_artifact_report_write`: pass the bare report name `docs-update-latest`, not `.blueprint/reports/docs-update-latest.md`. Use the returned `path` as the authoritative saved report location.

## Workflow Rules

### `docs-update`

1. Require initialized Blueprint state before relying on project or codebase
   artifacts. Route to `/blu-new-project` or `/blu-health` when the state is
   missing or unhealthy.
2. Resolve the doc scope before drafting anything. Default to the user-named
   files, or a narrow `README.md`-first pass when scope is otherwise omitted.
3. Keep the active stage visible as the run moves through `Resolve`, `Read`,
   `Decide`, `Execute`, `Persist`, `Validate`, and `Route`, and keep the
   resolved scope, active stage, pending gate, execution mode, and next safe
   action legible throughout the run.
4. For non-trivial docs-update runs, prefer update_topic plus `write_todos` so
   scope resolution, evidence review, optional external verification, bounded
   drafting or verification, report persistence, and routing stay visible
   without becoming persistence.
5. Keep broad repo-doc refreshes confirmation-gated and blocked until the repo
   has enough saved evidence, especially the `.blueprint/codebase/` bundle from
   `/blu-map-codebase`.
6. Treat the selected repo docs, source files, tests, and saved Blueprint
   artifacts as repo truth. Use external web tools only when the user
   explicitly asked for outside verification or the documentation claim depends
   on current external API, library, or product facts that cannot come from
   repo truth alone. Keep cited external truth separate from repo truth in the
   saved report and user summary; if web tools are unavailable, continue with
   repo truth only and note that the external verification was skipped.
7. Build the evidence base through `blueprint_artifact_summary_digest` with
   explicit artifact and repo file inputs instead of relying on chat memory.
8. Report in-flight progress, including the resolved doc scope, whether the
   digest-backed evidence stays repo-only or also uses cited external truth,
   active stage, pending gate, execution mode, whether the run is verify-only
   or update mode, whether the pass stays inline or uses `blueprint-doc-writer`
   or `blueprint-doc-verifier`, repo-doc mutation status, report status, and
   next safe action.
9. Keep pending gates limited to broad-scope confirmation, doc overwrite
   confirmation, report overwrite confirmation, or `none`.
10. Treat `--verify-only` as read-only for repo docs. The command may still
   write the durable `.blueprint/reports/docs-update-latest.md` report.
11. Use `blueprint-doc-writer` for bounded drafting when the update spans
   multiple sections or files.
12. Use `blueprint-doc-verifier` to fact-check either the current docs or the
   drafted update before finalizing results.
13. Require explicit overwrite confirmation before replacing heavily edited docs
   or the canonical `docs-update-latest` report unless the user passed
   `--force`.
14. Keep repo mutations scoped to the selected documentation files only. Do not
   widen into code edits, test edits, `.blueprint/` rewrites, or git flows from
   this command.
15. Persist the durable report through `blueprint_artifact_report_write` and
   keep follow-up routing inside implemented Blueprint commands only. Prefer
   `/blu-map-codebase` when broad refresh evidence is missing and
   `/blu-progress` when the safest follow-up is otherwise ambiguous.

## Non-Negotiables

- All Blueprint-owned persistence must go through MCP tools only.
- Do not mutate `.blueprint/` directly from prompt text.
- Do not rewrite broad internal doc sets unless the user explicitly asked for
  that scope.
- Do not present planned-only review, shipping, or maintenance commands as
  runnable just because they are documented.
