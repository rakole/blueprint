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
input_bundles:
  shared:
    - docs/ARTIFACT-SCHEMA.md
    - docs/MCP-TOOLS.md
  commands:
    "/blu-discuss-phase":
      - docs/commands/discuss-phase.md
      - skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md
      - skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md
    "/blu-research-phase":
      - docs/commands/research-phase.md
      - skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md
    "/blu-ui-phase":
      - docs/commands/ui-phase.md
      - skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md
    "/blu-list-phase-assumptions":
      - docs/commands/list-phase-assumptions.md
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
- Execution profile for `/blu-discuss-phase`: `long-running-mutation`; read `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md` for the shared stage, in-flight status, and session-local helper contract.
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
- use `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` as the rich behavior contract for `/blu-discuss-phase`
- use `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md` as the shared long-running profile for `/blu-discuss-phase`
- use `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md` as the rich behavior contract for `/blu-research-phase`
- use `skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md` as the rich behavior contract for `/blu-ui-phase`
- treat `contract.authoringTemplate` from `blueprint_artifact_contract_read` as the schema authority for saved artifacts

## Required Inputs

- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`

Command-specific inputs are resolved from the structured `input_bundles` frontmatter for the invoking discovery command.

## Command-Scoped Required MCP Tools

Use only the MCP tools allowed by the active command contract. The shared skill
does not grant broader tool scope to a command.

### `/blu-discuss-phase`

- `blueprint_phase_locate`
- `blueprint_phase_context`
- `blueprint_roadmap_read`
- `blueprint_artifact_list`
- `blueprint_config_get`
- `blueprint_phase_artifact_read`
- `blueprint_phase_plan_index`
- `blueprint_artifact_contract_read`
- `blueprint_phase_artifact_write`
- `blueprint_phase_checkpoint_get`
- `blueprint_phase_checkpoint_put`
- `blueprint_phase_checkpoint_delete`
- `blueprint_artifact_scaffold`
- `blueprint_state_update`
- `blueprint_state_load`

### `/blu-research-phase`

- `blueprint_phase_locate`
- `blueprint_phase_context`
- `blueprint_phase_research_status`
- `blueprint_phase_artifact_read`
- `blueprint_phase_artifact_write`
- `blueprint_artifact_contract_read`
- `blueprint_artifact_scaffold`
- `blueprint_phase_checkpoint_get`
- `blueprint_phase_checkpoint_put`
- `blueprint_phase_checkpoint_delete`
- `blueprint_config_get`
- `blueprint_state_load`
- `blueprint_command_catalog`
- `blueprint_state_update`

### `/blu-ui-phase`

- `blueprint_phase_locate`
- `blueprint_phase_research_status`
- `blueprint_config_get`
- `blueprint_artifact_contract_read`
- `blueprint_phase_artifact_read`
- `blueprint_phase_artifact_write`
- `blueprint_artifact_scaffold`
- `blueprint_state_update`

### `/blu-list-phase-assumptions`

- `blueprint_phase_locate`
- `blueprint_project_status`
- `blueprint_roadmap_read`
- `blueprint_phase_context`

## Optional Agents

- `blueprint-researcher`
- `blueprint-ui-designer`
- `blueprint-checker`

## Shared MCP Contracts

- `blueprint_phase_locate`: pass only a numeric phase reference when the command provides one, or omit `phase` to let the runtime infer it from state or the roadmap. Never pass phase directories, slugs, or filenames.
- `blueprint_phase_artifact_write`: pass numeric `phase`, the correct artifact enum, and full artifact content. The tool owns the final artifact `path`; use the returned `path` as authoritative and do not write raw filenames directly.
- `blueprint_artifact_contract_read`: read canonical authoring templates and validation metadata by contract id such as `phase.research` or `phase.uat` instead of relying on copied prompt-local templates.
- `blueprint_artifact_scaffold`: use it only to seed a missing discovery artifact file. Do not treat scaffold text as completed context, research, or UI-spec content.
- `blueprint_phase_checkpoint_get`: pass the command's expected owner and mode when resuming saved state, then honor `safeToResume` and `warnings` before using the checkpoint.
- `blueprint_phase_checkpoint_put`: `checkpoint` must be a JSON object using the structured checkpoint shape, with `ownerCommand`, `completedAreas`, `remainingAreas`, `decisions`, `deferredIdeas`, `canonicalReferences`, and `resumeMeta`. `ownerCommand` must match `resumeMeta.mode` (`/blu-discuss-phase` -> `discuss`, `/blu-research-phase` -> `research`, `/blu-verify-work` -> `uat`). `resumeMeta` carries the resumability fields such as `mode`, `pendingTopics`, `completedTopics`, `currentQuestion`, `notes`, `resumeHint`, and `updatedAt`. The tool owns the shared checkpoint filename and location, rejects foreign-owner overwrites, and pairs with `blueprint_phase_checkpoint_delete` owner/mode guards when commands clean up checkpoint state.
- `blueprint_config_get`: use `scope: "effective"` when command behavior depends on normalized config such as `research.external_sources`. Treat it as the source of truth even when another MCP result mirrors the same setting for convenience.

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

Before running the command flow, read `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md`. It locks the retained discuss-phase behavior that is easy to dilute: phase-specific gray-area discovery, evidence-backed assumptions, capability-gated sidecar research, single-agent fallback, rich context authoring, and validation/repair before completion.

0. Keep the resolved scope explicit as the selected phase, prior-context bundle, artifact reuse-versus-replace posture, and current gray area.
1. Resolve the phase through MCP tools before asking the user to confirm any write path.
2. Ground the flow in actual repo context before questioning: read the substantive project brief, requirements, and workflow posture already surfaced through `blueprint_phase_context`, then read the current `XX-CONTEXT.md`, `XX-DISCUSSION-LOG.md`, and earlier phase context artifacts when they materially reduce duplicate questions.
3. Read `blueprint_phase_plan_index` before refreshing context so the command can warn that saved plans do not change automatically; users must re-run `/blu-plan-phase` if refreshed discovery should affect planning.
4. Read the canonical contracts through `blueprint_artifact_contract_read` with `artifactId: "phase.context"` before drafting context and `artifactId: "phase.discussion-log"` before drafting any durable discussion log.
5. Normalize the final context and discussion drafts to the returned `authoringTemplate` before any write, then run a blocking anti-pattern check for placeholders, contradictions, missing canonical references, unsupported mode claims, or dropped deferred ideas before saving.
6. During interactive discovery, prefer one-question `ask_user` dialogs for concrete tradeoffs, overwrite confirmation, resume-versus-discard choices, and gray-area selection instead of plain-text menus. If an answer is vague, incomplete, or conflicts with saved context, ask a focused follow-up or retry the question with a narrower prompt before treating it as final.
7. Treat pending gates explicitly as phase ambiguity, resume-versus-discard checkpoint choice, gray-area selection, overwrite confirmation, or validation blockers instead of burying them in recap prose.
8. Keep execution mode explicit as interactive `workflow.discuss_mode="discuss"`, stronger assumptions-mode analysis, or repo-evidence-driven `workflow.skip_discuss=true`, plus fresh versus resumed checkpoint posture.
9. Follow `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md` for stage visibility, next-safe-action visibility, and session-local helper fallback behavior.
10. Identify gray areas first, let the user choose which area to discuss, support iterative `next area` and `more questions` loops, capture canonical references behind decisions, fold deferred ideas into the saved context or discussion log instead of dropping them, checkpoint each major area as it closes with the structured discuss checkpoint shape, emit short progress recaps so the session stays legible, and analyze the branch with Blueprint-friendly lenses such as scope, tradeoffs, dependencies, risks, reuse, implementation order, and methodology.
11. Use capability-gated subagents only when suitable Blueprint discovery or research agents are available and bounded evidence work materially improves a single gray area or assumptions pass. `blueprint-researcher` may return options, tradeoffs, rationale, complexity or impact surface, and cited evidence for one area, but the parent command owns synthesis, questions, persistence, and routing. If no suitable subagent is available, use the single-agent fallback from the runtime contract: handle one area at a time, compress carry-forward context, checkpoint it, then move on without reducing output richness.
12. Use `blueprint_artifact_scaffold` only to seed a missing `XX-CONTEXT.md`, then persist the actual finished content through `blueprint_phase_artifact_write`.
13. If `blueprint_phase_artifact_write` returns `status: "invalid"` or validation issues, repair the same normalized draft using the returned issues and retry before treating `/blu-discuss-phase` as complete. If repair cannot finish safely, leave the checkpoint intact and report the validation blocker.
14. Write `XX-DISCUSSION-LOG.md` only when durable notes add value beyond the main context artifact.
15. Require explicit overwrite confirmation before replacing existing context artifacts.
16. End with a next safe action inside the implemented Blueprint surface and leave `STATE.md` legible about that next step.

### `research-phase`

Before running the command flow, read `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`. It locks the retained research behavior that is easy to dilute: phase validation, existing research reuse/update gates, actual saved context reads, planner-consumed research sections, repo-versus-external provenance, official docs or explicitly supplied external references, capability-gated researcher use, a single-agent no-subagent fallback, checkpointed inconclusive strands, validation repair, implemented-only routing, and rejection of browser-only, web-search-only, shell-only, or generic substitute agents. Do not inline the full research workflow into `/blu-discuss-phase` context.

1. Confirm phase readiness with `blueprint_phase_context`, `blueprint_phase_research_status`, and `blueprint_config_get`.
2. Read the actual current `XX-CONTEXT.md` content through `blueprint_phase_artifact_read` before drafting research so the output stays grounded in the saved discovery context, not only status metadata. If that read reports `found: false`, stop and route back to `/blu-discuss-phase <phase>` instead of drafting from status-only signals.
3. Read any existing `XX-RESEARCH.md` through `blueprint_phase_artifact_read` before proposing replacement. Force repair when saved research is invalid, and force an explicit `view`, `skip`, or `update` decision only when the saved research is already valid.
4. Prefer a one-question `ask_user` dialog for the `view`/`skip`/`update` choice and for overwrite confirmation when replacement is requested.
5. Draft directly from `contract.authoringTemplate`. Use `blueprint_artifact_scaffold` only for deliberate placeholder creation when a seeded file is explicitly needed before final research exists.
6. Honor `research.external_sources` before any external verification step: `off` means stay repo-only and mark freshness-sensitive claims as not externally checked, `ask` means stop for confirmation before official-doc or external verification, and `auto` allows official-doc or external verification only when repo evidence cannot settle the claim.
7. Use `blueprint-researcher` for bounded sidecar research when the artifact needs to be created or updated. The parent must supply any external evidence packet itself, with source title, date, URL, excerpt, claim, and whether it is an official reference or supplied reference. Do not ask the subagent to fetch official docs on its own.
8. Keep the resolved scope explicit as the selected phase, current context and research reuse-versus-update posture, codebase-bundle availability, the topic strand currently in progress, and whether the run is repo-evidence-only or also checking external truth.
9. Ground repo truth first in `blueprint_phase_context`, the actual saved `XX-CONTEXT.md` body, any existing research, and saved `.blueprint/codebase/` summaries before consulting external sources.
10. Use official docs or explicitly supplied external references only when the repo cannot settle a claim, and keep repo-derived evidence distinct from external or web-derived evidence in the draft, recommendations, and `## Sources`. If external verification is skipped or unavailable, say so plainly instead of implying it happened.
11. Require `## State Of The Art` freshness claims to include explicit source dates or a clear `not externally checked` marker.
12. During non-trivial multi-strand research on Gemini, use `update_topic` and `write_todos` to keep the active stage and next safe action visible without turning either tool into persistence. When a host does not expose those helpers, keep the same visibility through short progress recaps plus MCP-backed checkpoints and `STATE.md`.
13. Normalize the final research draft to the canonical `phase.research` authoring template before calling `blueprint_phase_artifact_write`.
14. Persist only validated research content through `blueprint_phase_artifact_write`; do not leave `research-phase` with a scaffold-only placeholder.
15. Require explicit overwrite confirmation before replacing existing research.
16. Use `blueprint_command_catalog` before recommending `/blu-ui-phase`; otherwise route toward `/blu-progress`.
17. Keep the research branch read-heavy and phase-scoped; do not mutate unrelated repo files.
18. Break long-running research into topic-sized strands instead of forcing a single linear pass. Re-check the phase context and saved research status between strands so the command can continue from the last durable checkpoint instead of redoing settled work.
19. When a strand reaches a natural pause, write or refresh the phase checkpoint with the completed topics, remaining topics, open questions, and a resume hint that stays inside the implemented Blueprint surface. Treat the checkpoint as the continuation point for the next run.
20. If evidence stays incomplete or conflicts remain unresolved after a reasonable pass, mark the result as inconclusive rather than stretching the draft. Summarize what was verified, what remains unknown, and the next safe action within the implemented surface, such as continuing research, revisiting context, or moving to `/blu-progress` when planning is no longer appropriate.
21. Do not imply auto-chaining or power-mode continuation. Any continuation path must be explicit, checkpointed, and resumable through the shipped discovery workflow.
22. If no suitable Blueprint research or code-analysis subagent is available, use the runtime contract's single-agent fallback: handle one topic strand at a time, compress carry-forward evidence before moving on, normalize the draft section-by-section to the canonical template, and checkpoint pauses or inconclusive evidence without lowering output richness.
23. Do not use browser-only, web-search-only, shell-only, or generic agents as substitutes for codebase and workflow analysis. External references may support claims, but they do not replace repo evidence or the saved Blueprint artifacts.
24. If `blueprint_phase_artifact_write` returns `status: "invalid"` or validation issues, repair the same normalized draft using the returned issues and retry before treating `/blu-research-phase` as complete. If repair cannot finish safely, leave or refresh the checkpoint and report the blocker.
25. After a successful research write or a valid `view`/`skip`/`reuse` exit, call `blueprint_state_update` with `base: "synced"` and then `blueprint_state_load` so `STATE.md` and the reported next safe action advance without mutating the research artifact.

### `list-phase-assumptions`

Treat `/blu-list-phase-assumptions` as an `interactive-read` summary and keep
it read-only. Do not use `update_topic`, `write_todos`, or task tracker tools
for `/blu-list-phase-assumptions`; keep blocked or missing phase resolution in
a visible waiting-state posture with an explicit next safe action. The command
spec `docs/commands/list-phase-assumptions.md` remains the command-specific
source for the five assumption areas, `blueprint-researcher` sidecar limits,
and correction-oriented conversational output.

### `ui-phase`

Before running the command flow, read
`skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md`.
That command-specific reference preserves saved context or research grounding,
contract-versus-skip choice handling, `workflow.ui_safety_gate` rationale
confirmation, checker-requested revision, six-dimension UI quality review,
six UI dimensions, `blueprint_artifact_contract_read` with `artifactId:
"phase.ui-spec"`,
bounded `blueprint-checker` use, no-subagent fallback, browser-only,
web-search-only, shell-only, or generic agents rejection, validation repair,
and `/blu-plan-phase <phase>` or `/blu-progress` routing. Do not inline the
full UI workflow into `/blu-discuss-phase` context.
It preserves the exact `workflow.ui_safety_gate` rationale confirmation gate.
It preserves the rejection of browser-only, web-search-only, shell-only, or generic agents.
It preserves `artifactId: "phase.ui-spec"` as the canonical UI-spec contract id.

## Non-Negotiables

- All persistent writes must go through MCP tools only.
- Do not mutate arbitrary repo files from discovery commands.
- Do not present planned-only lifecycle commands as runnable just because they are documented.
