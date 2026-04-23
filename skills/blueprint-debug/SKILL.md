---
name: blueprint-debug
description: >
  Debug investigations and recovery plans for Blueprint. Use this skill to run
  structured issue diagnosis, keep debugging evidence explicit, persist a
  durable debug report, and capture follow-up todo work without inventing
  hidden state.
status: implemented
commands:
  - /blu-debug
---

# Blueprint Debug Skill

## Purpose

Orchestrate Blueprint's debugging flow so issue diagnosis stays evidence-backed,
stateful only through explicit MCP-owned artifacts, and honest about whether
the right next step is a bounded fix, a saved plan, or more validation.

## Runtime Call Rules

- Execution profile: `long-running-mutation`
- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Only invoke optional subagents when the current command contract explicitly allows them.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.
- For structured diagnose-only, overwrite, todo-capture, or reroute decisions, prefer Gemini CLI's built-in `ask_user` tool over plain assistant prose when the host makes it available.
- Use Gemini CLI's internal `update_topic` tool to keep non-trivial debugging anchored on the active stage.
- Use Gemini CLI's internal `write_todos` tool to maintain a compact visible checklist for non-trivial investigations.
- Treat `update_topic` and `write_todos` as session-local coordination only; they do not replace Blueprint MCP persistence, and they are not permission to capture persisted follow-up todos implicitly.

## Parity Goal

Carry forward the useful debug intent while preserving Blueprint's
host-native boundaries:

- investigations stay grounded in repo evidence rather than chat memory
- persistence remains explicit through a durable `.blueprint/reports/` artifact
- follow-up work can be captured intentionally instead of disappearing into chat, but only after an explicit ask or confirmation
- diagnose-only runs stay distinct from fix attempts
- routing stays inside the implemented Blueprint surface

## Required Inputs

- `docs/commands/debug.md`
- `docs/COMMAND-CATALOG.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/RUNTIME-REFERENCE.md`
- the issue statement, repro notes, failing command, or other evidence the user supplied

## Required MCP Tools

- `blueprint_project_status`
- `blueprint_artifact_report_write`
- `blueprint_artifact_mutate_index`
- `blueprint_state_update`

## Optional Agents

- `blueprint-debugger`

## Shared MCP Contracts

- `blueprint_artifact_report_write`: pass the bare report name `debug-latest`, not `.blueprint/reports/debug-latest.md`. Use the returned `path` as the authoritative saved report location.
- `blueprint_artifact_mutate_index`: use returned capture ids as authoritative follow-up todo ids and never create todo ids manually.

## Workflow Rules

### `debug`

1. Require a concrete issue statement before deep investigation. If the request
   is too vague, ask for the failing behavior, expected behavior, and repro
   hint instead of pretending the scope is known.
2. Require initialized Blueprint state before promising durable debugging
   persistence. If the repo is not initialized, degrade to suggestion mode and
   route to `/blu-new-project`.
3. Treat `--diagnose` as a hard diagnose-only boundary until the user confirms
   a fix attempt.
4. For non-trivial investigations, keep the resolved scope, active stage,
   pending gate, execution mode, and next safe action visible with
   `update_topic`, `write_todos`, or the equivalent prose fallback.
5. Read the most relevant local evidence directly, including existing
   `.blueprint/reports/debug-latest.md` content when a prior run should be
   continued instead of replaced.
6. Use `blueprint-debugger` for bounded hypothesis testing, reproduction, log
   review, and confidence-rated diagnosis when the investigation is more than a
   quick local inspection.
7. Keep `debug` investigative. When the result is a bounded fix, route to
   `/blu-quick`. When it needs a broader saved-plan rollout, route to
   `/blu-plan-phase`. When the next safe step is saved verification evidence,
   route to `/blu-validate-phase`. Prefer `/blu-progress` when multiple
   implemented next steps remain viable instead of widening the debug run
   indefinitely.
8. Persist the durable report through `blueprint_artifact_report_write` with
   the bare canonical `debug-latest` report name, not a `.blueprint/reports/...`
   path.
9. Stop on an explicit follow-up gate after the diagnosis: keep the run
   report-only, capture a todo only after an explicit user ask or confirmation,
   route to `/blu-quick`, route to `/blu-plan-phase`, route to
   `/blu-validate-phase`, or defer to `/blu-progress` when multiple
   implemented next steps remain viable.
10. Stop on an explicit follow-up gate after the diagnosis: keep the short menu visible as report-only, capture a todo, route to `/blu-quick`, route to `/blu-plan-phase`, or defer to `/blu-progress` when the saved-verification branch is not needed.
11. Use `blueprint_artifact_mutate_index` only for explicit todo follow-up
   capture after the user asks to capture it or confirms that the diagnosis or
   saved report should become a persisted todo. Do not silently turn every
   finding into a todo, and do not confuse visible `write_todos` checklists
   with persisted Blueprint follow-up capture.
12. After persistence, update `STATE.md` through `blueprint_state_update` so
    the next safe implemented action is explicit.
13. Keep follow-up routing inside implemented commands only. Prefer
    `/blu-progress` when the investigation ends with multiple viable next
    steps.

## Output Style

- Summarize the symptom, evidence, diagnosis, and confidence plainly.
- Separate confirmed causes from hypotheses or likely next experiments.
- State whether the run stayed diagnose-only or crossed into a confirmed fix
  attempt.
- State whether any in-flight visibility stayed session-local only and whether
  any persisted todo follow-up was explicitly approved.
- Name whether the follow-up stayed report-only, became a captured todo, or
  rerouted into another implemented command.
- Name the `debug-latest` report and any captured todo follow-up explicitly.
- End on the safest implemented next action.
