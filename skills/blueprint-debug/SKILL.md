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

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Only invoke optional subagents when the current command contract explicitly allows them.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.

## Parity Goal

Carry forward the useful debug intent while preserving Blueprint's
host-native boundaries:

- investigations stay grounded in repo evidence rather than chat memory
- persistence remains explicit through a durable `.blueprint/reports/` artifact
- follow-up work can be captured intentionally instead of disappearing into chat
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
4. Read the most relevant local evidence directly, including existing
   `.blueprint/reports/debug-latest.md` content when a prior run should be
   continued instead of replaced.
5. Use `blueprint-debugger` for bounded hypothesis testing, reproduction, log
   review, and confidence-rated diagnosis when the investigation is more than a
   quick local inspection.
6. Keep `debug` investigative. When the result is a real implementation task,
   route to `/blu-quick` for a bounded fix or `/blu-plan-phase` for a broader
   saved-plan rollout instead of widening the debug run indefinitely.
7. Persist the durable report through `blueprint_artifact_report_write` with
   the canonical `debug-latest` report name.
8. Use `blueprint_artifact_mutate_index` only for explicit todo follow-up
   capture. Do not silently turn every finding into a todo.
9. After persistence, update `STATE.md` through `blueprint_state_update` so the
   next safe implemented action is explicit.
10. Keep follow-up routing inside implemented commands only. Prefer
    `/blu-progress` when the investigation ends with multiple viable next
    steps.

## Output Style

- Summarize the symptom, evidence, diagnosis, and confidence plainly.
- Separate confirmed causes from hypotheses or likely next experiments.
- State whether the run stayed diagnose-only or crossed into a confirmed fix
  attempt.
- Name the `debug-latest` report and any captured todo follow-up explicitly.
- End on the safest implemented next action.
