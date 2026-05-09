# List Phase Assumptions Runtime Contract

This reference is the rich behavior contract for
`/blu-list-phase-assumptions`. Load it on demand for assumptions review runs
instead of reading repository command specs or shared docs. Treat live MCP
results as the source of truth for phase state and roadmap context.

## Runtime Posture

`/blu-list-phase-assumptions` is an `interactive-read` command. It summarizes
likely assumptions and correction opportunities for one resolved phase without
writing artifacts, checkpoints, todos, state, or source files.

Use only the command-scoped read tools:

- `blueprint_phase_locate`
- `blueprint_project_status`
- `blueprint_roadmap_read`
- `blueprint_phase_context`

Do not call write-capable MCP tools, task tracker helpers, `update_topic`, or
`write_todos`. Do not create hidden plans, staged long-running progress, or
branching execution state.

## Resolve And Read

Resolve the target phase first with `blueprint_phase_locate`. Pass only a
numeric phase reference when the user supplied one, or omit `phase` when the
runtime should infer it.

If the phase cannot be resolved, stop in a visible waiting state:

- state that the phase is not resolved
- name the missing input or ambiguity
- give the next safe implemented action, usually rerunning the command with a
  numeric phase or using `/blu-progress`
- do not guess a phase, inspect broad files to compensate, or write anything

After resolution, read:

- `blueprint_project_status` for workflow posture and project readiness
- `blueprint_roadmap_read` for phase boundary, success criteria, and neighboring
  phase context
- `blueprint_phase_context` for saved discovery, research, UI, codebase, and
  requirement evidence surfaced by the runtime

## Five Assumption Areas

Organize the answer around these five areas, using only evidence available from
the resolved MCP reads:

- Technical approach: stack, architecture, command, MCP, artifact, data,
  integration, requirement-mapping, and acceptance-signal expectations implied
  by saved context.
- Implementation order: prerequisite artifacts, current lifecycle posture,
  likely next command, blocked gates, state transitions that must stay
  implemented-only, and neighboring phase sequencing.
- Scope boundaries: what appears in scope, out of scope, deferred, missing from
  current requirement evidence, or likely to change the phase boundary.
- Risk areas: uncertainty, validation gaps, regression surface, security or
  host-safety concerns, and consequences if the assumption is wrong.
- Dependencies: upstream and downstream phase context, required runtime tools,
  saved discovery/research/UI/codebase/requirement evidence, and external
  project or implementation dependencies visible in the loaded state.

Prefer phase-specific wording over generic labels. If an area has no meaningful
evidence, say that directly instead of inventing assumptions.

## Output Contract

Keep the response conversational and correction-oriented. The user should be
able to confirm, correct, or ask for deeper discussion without feeling that the
command has mutated project state.

For each useful assumption, include:

- the assumption in plain language
- evidence from the MCP-loaded phase, roadmap, project, or context data
- uncertainty as `Confident`, `Likely`, or `Unclear`
- why it matters downstream
- a concise correction prompt when user input would materially change planning

Use uncertainty language honestly. Say `I cannot tell from current Blueprint
state` when the loaded runtime evidence does not settle a claim. Avoid implying
external verification, source-file inspection, or artifact reads that did not
happen in this command.

## Optional Researcher Bounds

Use `blueprint-researcher` only when the host exposes a suitable Blueprint
researcher and a bounded read-only sidecar would materially improve a single
assumption area. Never require the agent for command correctness.

When used, bound the agent to one area and pass only the compact runtime
evidence packet from the resolved phase. Ask for likely assumptions, supporting
evidence, uncertainty, and consequences if wrong. The agent must not write
artifacts, update state, fetch external sources independently, or draft command
output as if it owned synthesis.

## Single-Agent Fallback

If no suitable agent exists, the parent command must run the same five-area
analysis without reducing evidence depth or output quality. Do not substitute
browser-only, web-search-only, shell-only, or generic helpers for Blueprint
phase and workflow analysis.

Work sequentially, one assumption area at a time:

1. Build a compact carry-forward note from the resolved MCP reads: phase
   boundary, workflow posture, saved context signals, and already-captured
   corrections.
2. Pick the next assumption area.
3. Derive only that area's assumptions from current MCP evidence.
4. Summarize the completed area back into the carry-forward note with the
   assumption, evidence, uncertainty, why it matters, and any correction prompt
   still worth asking.
5. Move to the next area only after the current one is complete.

## Waiting State And Next Safe Action

When the command cannot proceed safely, keep the waiting state explicit:

- unresolved or ambiguous phase
- missing roadmap or project status
- missing phase context
- runtime evidence too thin to name useful assumptions

End with a next safe action that is implemented and consistent with the loaded
runtime state. Prefer `/blu-progress` when routing is uncertain. Use
phase-specific follow-ups such as `/blu-discuss-phase <phase>`,
`/blu-research-phase <phase>`, or `/blu-ui-phase <phase>` only when the loaded
state or context supports that handoff.
