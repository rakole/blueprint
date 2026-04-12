---
name: blueprint-docs
description: >
  Documentation generation and verification for Blueprint repos. Use this skill
  to refresh selected repo docs from saved evidence, keep verification explicit,
  and persist a durable docs-update report without widening into arbitrary repo
  mutation.
status: implemented
commands:
  - /blu:docs-update
---

# Blueprint Docs Skill

## Purpose

Orchestrate Blueprint's documentation refresh and verification flow so repo
docs stay aligned with the actual codebase, Blueprint evidence stays durable,
and doc mutation remains reviewable and tightly scoped.

## Parity Goal

Carry forward the useful upstream docs-update intent while preserving
Blueprint's Gemini-native boundaries:

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
- `docs/GSD-RUNTIME-MIGRATION.md`
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

## Workflow Rules

### `docs-update`

1. Require initialized Blueprint state before relying on project or codebase
   artifacts. Route to `/blu:new-project` or `/blu:health` when the state is
   missing or unhealthy.
2. Resolve the doc scope before drafting anything. Default to the user-named
   files, or a narrow `README.md`-first pass when scope is otherwise omitted.
3. Keep broad repo-doc refreshes blocked until the repo has enough saved
   evidence, especially the `.blueprint/codebase/` bundle from
   `/blu:map-codebase`.
4. Build the evidence base through `blueprint_artifact_summary_digest` with
   explicit artifact and repo file inputs instead of relying on chat memory.
5. Treat `--verify-only` as read-only for repo docs. The command may still
   write the durable `.blueprint/reports/docs-update-latest.md` report.
6. Use `blueprint-doc-writer` for bounded drafting when the update spans
   multiple sections or files.
7. Use `blueprint-doc-verifier` to fact-check either the current docs or the
   drafted update before finalizing results.
8. Require explicit overwrite confirmation before replacing heavily edited docs
   or the canonical `docs-update-latest` report unless the user passed
   `--force`.
9. Keep repo mutations scoped to the selected documentation files only. Do not
   widen into code edits, test edits, `.blueprint/` rewrites, or git flows from
   this command.
10. Persist the durable report through `blueprint_artifact_report_write` and
    keep follow-up routing inside implemented Blueprint commands only.

## Non-Negotiables

- All Blueprint-owned persistence must go through MCP tools only.
- Do not mutate `.blueprint/` directly from prompt text.
- Do not rewrite broad internal doc sets unless the user explicitly asked for
  that scope.
- Do not present planned-only review, shipping, or maintenance commands as
  runnable just because they are documented.
