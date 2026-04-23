---
name: blueprint-phase-discovery
description: >
  Pre-planning discovery and requirements shaping for Blueprint lifecycle
  work. Use this skill to orchestrate discuss, research, UI-contract, and
  assumptions-review flows while keeping persistent state MCP-owned and
  phase-scoped.
status: implemented
commands:
  - /blu-discuss-phase
  - /blu-research-phase
  - /blu-ui-phase
  - /blu-list-phase-assumptions
---

# Blueprint Phase Discovery Skill

## Purpose

Orchestrate Blueprint's pre-planning discovery flow with deterministic MCP-owned phase artifacts.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Only invoke optional subagents when the current command contract explicitly allows them.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.
- For structured interactive choices, confirmations, or short clarifications, prefer Gemini CLI's built-in `ask_user` tool over plain assistant prose.
- Execution profile for `/blu-discuss-phase`: `long-running-mutation`.
- Keep the shared stage vocabulary explicit during non-trivial `/blu-discuss-phase` runs: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`.
- Keep the in-flight status contract visible during non-trivial `/blu-discuss-phase` runs: resolved scope, active stage, pending gate, execution mode, next safe action.
- On Gemini, use `update_topic` and `write_todos` only as session-local visibility aids during non-trivial `/blu-discuss-phase` runs; do not let them replace MCP-backed artifacts, checkpoints, or `STATE.md`.
- When a host does not expose `update_topic` or `write_todos`, keep the same stage and next-safe-action visibility in normal progress recaps plus MCP-backed checkpoints and `STATE.md` instead of claiming those helpers ran.
- Execution profile for `/blu-research-phase`: `long-running-mutation`.
- Keep the shared stage vocabulary explicit during non-trivial `/blu-research-phase` runs: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`.
- Keep the in-flight status contract visible during non-trivial `/blu-research-phase` runs: resolved scope, active stage, pending gate, execution mode, next safe action.
- On Gemini, use `update_topic` and `write_todos` only as session-local visibility aids during non-trivial `/blu-research-phase` runs; do not let them replace MCP-backed artifacts, checkpoints, or `STATE.md`.
- When a host does not expose `update_topic` or `write_todos`, keep the same stage and next-safe-action visibility in short progress recaps plus MCP-backed checkpoints and `STATE.md` instead of claiming those helpers ran.
- Execution profile for `/blu-ui-phase`: `long-running-mutation`.
- Keep the shared stage vocabulary explicit during non-trivial `/blu-ui-phase` runs: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`.
- Keep the in-flight status contract visible during non-trivial `/blu-ui-phase` runs: resolved scope, active stage, pending gate, execution mode, next safe action.
- Execution profile for `/blu-list-phase-assumptions`: `interactive-read`.
- Keep `/blu-list-phase-assumptions` conversational and read-only; do not turn it into staged long-running progress, tracker-backed branching, visible todos, or hidden planning.
- Do not use `update_topic`, `write_todos`, or task tracker tools for `/blu-list-phase-assumptions`; when phase resolution is blocked, name the waiting state plainly and give the next safe implemented follow-up instead.

## Parity Goal

Keep the useful discovery intent while preserving Blueprint deltas:

- persistent writes stay inside `.blueprint/`
- commands stay thin and user-facing
- MCP tools own state mutation
- later chaining and power-mode variants stay deferred until the downstream lifecycle substrate exists
- keep the GSD-inspired discovery staples Blueprint actually ships: prior-context sweeps, deferred-idea folding, methodology lenses, codebase-scout reuse, stronger assumptions-mode analysis, progress recaps, checkpoint-per-area persistence, and end-of-run `STATE.md` updates

## Required Inputs

- `docs/commands/discuss-phase.md`
- `docs/commands/list-phase-assumptions.md`
- `docs/commands/research-phase.md`
- `docs/commands/ui-phase.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`

## Required MCP Tools

- `blueprint_phase_locate`
- `blueprint_phase_context`
- `blueprint_roadmap_read`
- `blueprint_project_status`
- `blueprint_phase_research_status`
- `blueprint_phase_artifact_read`
- `blueprint_phase_artifact_write`
- `blueprint_phase_plan_index`
- `blueprint_artifact_contract_read`
- `blueprint_phase_checkpoint_get`
- `blueprint_phase_checkpoint_put`
- `blueprint_phase_checkpoint_delete`
- `blueprint_artifact_list`
- `blueprint_command_catalog`
- `blueprint_state_load`
- `blueprint_artifact_scaffold`
- `blueprint_state_update`
- `blueprint_config_get`

## Optional Agents

- `blueprint-researcher`
- `blueprint-ui-designer`
- `blueprint-checker`

## Shared MCP Contracts

- `blueprint_phase_locate`: pass only a numeric phase reference when the command provides one, or omit `phase` to let the runtime infer it from state or the roadmap. Never pass phase directories, slugs, or filenames.
- `blueprint_phase_artifact_write`: pass numeric `phase`, the correct artifact enum, and full artifact content. The tool owns the final artifact `path`; use the returned `path` as authoritative and do not write raw filenames directly.
- `blueprint_artifact_contract_read`: read canonical authoring templates and validation metadata by contract id such as `phase.research` or `phase.uat` instead of relying on copied prompt-local templates.
- `blueprint_artifact_scaffold`: use it only to seed a missing discovery artifact file. Do not treat scaffold text as completed context, research, or UI-spec content.
- `blueprint_phase_checkpoint_put`: `checkpoint` must be a JSON object using the structured discuss checkpoint shape, with `completedAreas`, `remainingAreas`, `decisions`, `deferredIdeas`, `canonicalReferences`, and `resumeMeta`. `resumeMeta` carries the resumability fields such as `mode`, `pendingTopics`, `completedTopics`, `currentQuestion`, `notes`, `resumeHint`, and `updatedAt`. The tool owns the checkpoint filename and location.

## Workflow Rules

0. Treat `blueprint_phase_context.codebase` as reusable brownfield repo evidence when it is present. Prefer the saved `.blueprint/codebase/` summaries before re-reading broad repo surfaces, and call out when the codebase bundle is missing or incomplete.
   Sweep prior-phase context first so the session reuses the current evidence base before it asks for fresh detail; this is a saved-artifact sweep, not a dedicated todo/backlog file crawl.

### Canonical Research Contract

Use `blueprint_artifact_contract_read` with `artifactId: "phase.research"` when `/blu-research-phase` creates or updates research.

- Normalize the final draft to the returned `authoringTemplate`.
- Keep the contract's required section names and locked markers unchanged.
- Replace every placeholder signal before writing.
- Allow extra top-level headings only when the contract policy says they are supported.

### `discuss-phase`

0. Keep the resolved scope explicit as the selected phase, prior-context bundle, artifact reuse-versus-replace posture, and current gray area.
1. Resolve the phase through MCP tools before asking the user to confirm any write path.
2. Ground the flow in actual repo context before questioning: read the substantive project brief, requirements, and workflow posture already surfaced through `blueprint_phase_context`, then read the current `XX-CONTEXT.md`, `XX-DISCUSSION-LOG.md`, and earlier phase context artifacts when they materially reduce duplicate questions.
3. Read `blueprint_phase_plan_index` before refreshing context so the command can warn that saved plans do not change automatically; users must re-run `/blu-plan-phase` if refreshed discovery should affect planning.
4. Read the canonical contracts through `blueprint_artifact_contract_read` with `artifactId: "phase.context"` before drafting context and `artifactId: "phase.discussion-log"` before drafting any durable discussion log.
5. Normalize the final context and discussion drafts to the returned `authoringTemplate` before any write, then run a blocking anti-pattern check for placeholders, contradictions, missing canonical references, unsupported mode claims, or dropped deferred ideas before saving.
6. During interactive discovery, prefer one-question `ask_user` dialogs for concrete tradeoffs, overwrite confirmation, resume-versus-discard choices, and gray-area selection instead of plain-text menus. If an answer is vague, incomplete, or conflicts with saved context, ask a focused follow-up or retry the question with a narrower prompt before treating it as final.
7. Treat pending gates explicitly as phase ambiguity, resume-versus-discard checkpoint choice, gray-area selection, overwrite confirmation, or validation blockers instead of burying them in recap prose.
8. Keep execution mode explicit as interactive `workflow.discuss_mode="discuss"`, stronger assumptions-mode analysis, or repo-evidence-driven `workflow.skip_discuss=true`, plus fresh versus resumed checkpoint posture.
9. During non-trivial multi-area discovery runs on Gemini, use `update_topic` and `write_todos` to keep the active stage and next safe action visible without turning either tool into persistence. When a host does not expose those helpers, keep the same visibility through normal progress recaps plus MCP-backed checkpoints and `STATE.md`.
10. Identify gray areas first, let the user choose which area to discuss, support iterative `next area` and `more questions` loops, capture canonical references behind decisions, fold deferred ideas into the saved context or discussion log instead of dropping them, checkpoint each major area as it closes with the structured discuss checkpoint shape, emit short progress recaps so the session stays legible, and analyze the branch with Blueprint-friendly lenses such as scope, tradeoffs, dependencies, risks, reuse, implementation order, and methodology. Do not pretend power, chain, or auto modes are shipped.
11. Use `blueprint_artifact_scaffold` only to seed a missing `XX-CONTEXT.md`, then persist the actual finished content through `blueprint_phase_artifact_write`.
12. Write `XX-DISCUSSION-LOG.md` only when durable notes add value beyond the main context artifact.
13. Require explicit overwrite confirmation before replacing existing context artifacts.
14. End with a next safe action inside the implemented Blueprint surface and leave `STATE.md` legible about that next step.

### `research-phase`

1. Confirm phase readiness with `blueprint_phase_context` and `blueprint_phase_research_status`.
2. Read the actual current `XX-CONTEXT.md` content through `blueprint_phase_artifact_read` before drafting research so the output stays grounded in the saved discovery context, not only status metadata.
3. Read any existing `XX-RESEARCH.md` through `blueprint_phase_artifact_read` before proposing replacement and force an explicit `view`, `skip`, or `update` decision when research already exists.
4. Prefer a one-question `ask_user` dialog for the `view`/`skip`/`update` choice and for overwrite confirmation when replacement is requested.
5. Use `blueprint_artifact_scaffold` only to seed a missing research file.
6. Use `blueprint-researcher` for bounded sidecar research when the artifact needs to be created or updated.
7. Keep the resolved scope explicit as the selected phase, current context and research reuse-versus-update posture, codebase-bundle availability, the topic strand currently in progress, and whether the run is repo-evidence-only or also checking external truth.
8. Ground repo truth first in `blueprint_phase_context`, the actual saved `XX-CONTEXT.md` body, any existing research, and saved `.blueprint/codebase/` summaries before consulting external sources.
9. Use official docs or explicitly supplied external references only when the repo cannot settle a claim, and keep repo-derived evidence distinct from external or web-derived evidence in the draft, recommendations, and `## Sources`. If external verification is skipped or unavailable, say so plainly instead of implying it happened.
10. During non-trivial multi-strand research on Gemini, use `update_topic` and `write_todos` to keep the active stage and next safe action visible without turning either tool into persistence. When a host does not expose those helpers, keep the same visibility through short progress recaps plus MCP-backed checkpoints and `STATE.md`.
11. Normalize the final research draft to the canonical `phase.research` authoring template before calling `blueprint_phase_artifact_write`.
12. Persist only validated research content through `blueprint_phase_artifact_write`; do not leave `research-phase` with a scaffold-only placeholder.
13. Require explicit overwrite confirmation before replacing existing research.
14. Use `blueprint_command_catalog` before recommending `/blu-ui-phase`; otherwise route toward `/blu-progress`.
15. Keep the research branch read-heavy and phase-scoped; do not mutate unrelated repo files.
16. Break long-running research into topic-sized strands instead of forcing a single linear pass. Re-check the phase context and saved research status between strands so the command can continue from the last durable checkpoint instead of redoing settled work.
17. When a strand reaches a natural pause, write or refresh the phase checkpoint with the completed topics, remaining topics, open questions, and a resume hint that stays inside the implemented Blueprint surface. Treat the checkpoint as the continuation point for the next run.
18. If evidence stays incomplete or conflicts remain unresolved after a reasonable pass, mark the result as inconclusive rather than stretching the draft. Summarize what was verified, what remains unknown, and the next safe action within the implemented surface, such as continuing research, revisiting context, or moving to `/blu-progress` when planning is no longer appropriate.
19. Do not imply auto-chaining or power-mode continuation. Any continuation path must be explicit, checkpointed, and resumable through the shipped discovery workflow.

### `list-phase-assumptions`

0. Treat `/blu-list-phase-assumptions` as an `interactive-read` summary, not a long-running progress flow.
1. Resolve the phase through `blueprint_phase_locate`; omitted phase input may be inferred from state or roadmap, but an explicit invalid phase must fail clearly.
2. Read `blueprint_project_status`, `blueprint_roadmap_read`, and `blueprint_phase_context` before presenting any assumptions so the answer stays grounded in actual repo readiness, roadmap intent, and saved discovery artifacts.
3. Keep the command read-only. Do not scaffold, write, repair, or update `.blueprint/` artifacts from this flow.
4. Surface assumptions across the five required areas: technical approach, implementation order, scope boundaries, risk areas, and dependencies.
5. Mark uncertainty explicitly instead of overstating confidence; use evidence-first language when context is thin or missing.
6. If the requested phase cannot be resolved, report the exact failure reason and list valid roadmap phases instead of guessing a substitute.
7. When deeper technical context would materially improve the summary, `blueprint-researcher` may be used as a bounded read-only sidecar, but the command still ends with conversational output only.
8. Keep blocked or missing phase resolution in a visible waiting-state posture with an explicit next safe action instead of smoothing it away.
9. End by inviting corrections and keeping any next-step suggestion inside the implemented Blueprint surface.

### `ui-phase`

1. Inspect effective config through `blueprint_config_get`.
2. Respect `workflow.ui_phase` and `workflow.ui_safety_gate`.
3. Read the canonical `phase.ui-spec` contract through `blueprint_artifact_contract_read` with `artifactId: "phase.ui-spec"` before drafting, revising, or persisting `XX-UI-SPEC.md`.
4. Read any existing `XX-UI-SPEC.md` through `blueprint_phase_artifact_read` before proposing replacement so reuse remains the default.
5. Prefer a one-question `ask_user` dialog for overwrite confirmation and focused contract-versus-skip decisions when a structured choice will help.
6. Keep the resolved scope explicit as the selected phase, current research readiness, artifact reuse-versus-replace posture, and whether config currently points toward a real UI contract or an explicit skip rationale.
7. Treat pending gates explicitly as missing or ambiguous phase resolution, contract-versus-skip choice, `workflow.ui_safety_gate` rationale confirmation, overwrite confirmation, or checker-requested revision before save instead of flattening them into recap prose.
8. Keep execution mode explicit as real UI contract versus explicit skip rationale, plus inline drafting versus the bounded `blueprint-ui-designer` and `blueprint-checker` loop.
9. Use `XX-UI-SPEC.md` as the single durable output for both a real UI contract and an explicit skip rationale.
10. Require explicit overwrite confirmation before replacing an existing UI spec.
11. When deeper design work is needed, use `blueprint-ui-designer` for the draft and `blueprint-checker` for a bounded review loop before persistence. If the checker requests revisions, update only the affected sections, re-normalize to the same `authoringTemplate`, and re-run the checker before saving.
12. When UI work is intentionally skipped, record the rationale in `XX-UI-SPEC.md` instead of inventing a second file.
13. End with the next safe action inside the implemented surface, usually `/blu-plan-phase <phase>` once the UI artifact is settled or `/blu-progress` when discovery prerequisites remain unresolved.

## Non-Negotiables

- All persistent writes must go through MCP tools only.
- Do not mutate arbitrary repo files from discovery commands.
- Do not present planned-only lifecycle commands as runnable just because they are documented.
