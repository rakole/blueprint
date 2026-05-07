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
  shared: []
  commands:
    "/blu-discuss-phase":
      - skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md
      - skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md
    "/blu-research-phase":
      - skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md
    "/blu-ui-phase":
      - skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md
    "/blu-list-phase-assumptions":
      - skills/blueprint-phase-discovery/references/list-phase-assumptions-runtime-contract.md
---

# Blueprint Phase Discovery Skill

## Purpose

Orchestrate Blueprint's pre-planning discovery flow with deterministic MCP-owned phase artifacts.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Invoke optional subagents only when the current command contract explicitly allows them and effective config has `workflow.subagents=true`; otherwise use the command's no-subagent fallback and state config disabled subagents.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.
- For structured interactive choices, confirmations, or short clarifications, prefer Gemini CLI's built-in `ask_user` tool over plain assistant prose.
- Load only the active command's `input_bundles.commands[...]` inputs plus the shared inputs for that invocation. Do not preload sibling discovery command runtime references unless the active command contract explicitly calls for them.
- Execution profile for `/blu-discuss-phase`: `long-running-mutation`; read `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md` for the shared stage, in-flight status, and session-local helper contract.
- Execution profile for `/blu-research-phase`: `long-running-mutation`.
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

Repository docs are not active runtime inputs for this skill bundle. Do not load
command specs, artifact-schema docs, or MCP-tool docs as part of normal command
execution.

Command-specific inputs are resolved from the structured `input_bundles`
frontmatter for the invoking discovery command. Treat the active command's
skill-local runtime reference as the detailed behavior authority, and treat live
MCP responses plus `blueprint_artifact_contract_read` results as the runtime
source of truth for tool behavior, project state, and artifact schema.

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
- `blueprint_phase_checkpoint_put`: `checkpoint` must be a JSON object using the structured checkpoint shape, with `ownerCommand`, `completedAreas`, `remainingAreas`, `decisions`, `deferredIdeas`, `canonicalReferences`, and `resumeMeta`. `ownerCommand` must match `resumeMeta.mode` (`/blu-discuss-phase` -> `discuss`, `/blu-research-phase` -> `research`). `resumeMeta` carries the resumability fields such as `mode`, `pendingTopics`, `completedTopics`, `currentQuestion`, `notes`, `resumeHint`, and `updatedAt`. The tool owns the shared checkpoint filename and location, rejects foreign-owner overwrites, and pairs with `blueprint_phase_checkpoint_delete` owner/mode guards when commands clean up checkpoint state.
- `blueprint_config_get`: use `scope: "effective"` when command behavior depends on normalized config such as `research.external_sources`. Treat it as the source of truth even when another MCP result mirrors the same setting for convenience.

## Phase Context Ownership

- Blueprint does not create, manage, or repair repo-root `CONTEXT.md`.
- Brownfield mapping writes repo context only to `.blueprint/codebase/*.md`.
- Phase context lives only at `.blueprint/phases/<phase>/<XX>-CONTEXT.md`; the canonical filename shape is `XX-CONTEXT.md`.
- `/blu-discuss-phase` authors and repairs phase context.
- `/blu-research-phase` and `/blu-ui-phase` read phase context and route back to `/blu-discuss-phase <phase>` when it is missing, invalid, or unusable; they must not repair, overwrite, synthesize, or mirror context.
- `/blu-plan-phase` follows the same read-only context boundary from its planning skill contract.
- Validation repair loops get one retry after diagnostics. If identical diagnostics repeat, stop, preserve the command checkpoint or safest no-write state, report the exact diagnostics plus next safe action, and do not inspect MCP source files as a repair strategy.

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
13. If `blueprint_phase_artifact_write` returns `status: "invalid"` or validation issues, repair the same normalized draft using the returned issues and retry once before treating `/blu-discuss-phase` as complete. If the same diagnostics repeat or repair cannot finish safely, leave the checkpoint intact, report the exact validation blocker and next safe action, and do not inspect MCP source files as a repair strategy.
14. Write `XX-DISCUSSION-LOG.md` only when durable notes add value beyond the main context artifact.
15. Require explicit overwrite confirmation before replacing existing context artifacts.
16. End with the next safe action loaded from `blueprint_state_load.derivedStatus.nextAction` after a synced `blueprint_state_update` that preserves the already resolved selected phase in `patch.currentPhase` together with `patch.activeCommand`, and leave `STATE.md` legible about that next step. Do not infer a direct `/blu-plan-phase` handoff from successful context capture when enabled research or UI gates still route through `/blu-research-phase` or `/blu-ui-phase`.

### `research-phase`

Before running the command flow, read `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`. That file is the detailed authority for research-specific flow, evidence depth, checkpoint ownership, validation repair, and routing, so keep this shared skill focused on the active command boundary instead of restating the whole workflow inline.

1. Confirm phase readiness with `blueprint_phase_context`, `blueprint_phase_research_status`, and `blueprint_config_get`.
2. Read the actual current `XX-CONTEXT.md` content through `blueprint_phase_artifact_read` before drafting research so the output stays grounded in saved discovery context, not only status metadata. If that read reports `found: false`, stop and route back to `/blu-discuss-phase <phase>`. If that read reports invalid or unusable context, stop and route back to `/blu-discuss-phase <phase>` without repairing, overwriting, synthesizing, or substituting repo-root `CONTEXT.md`.
3. Read any existing `XX-RESEARCH.md` through `blueprint_phase_artifact_read` before proposing replacement. Force repair when saved research is invalid. When saved research is already valid, prefer a one-question `ask_user` dialog for `view`/`skip`/`update`; choosing `update` is the overwrite gate.
4. Draft directly from `contract.authoringTemplate`. Use `blueprint_artifact_scaffold` only for deliberate placeholder creation when a seeded file is explicitly needed before final research exists.
5. Honor `research.external_sources` before any external verification step: `off` stays repo-only, `ask` stops for confirmation, and `auto` allows official-doc or external verification only when repo evidence cannot settle the claim. Keep repo-derived evidence distinct from external evidence, and avoid implying live verification happened when it did not.
6. Use `blueprint-researcher` only when a suitable Blueprint research or code-analysis agent is available and a bounded sidecar pass materially helps. The parent must supply any external evidence packet itself, with source title, date, URL, excerpt, claim, and whether it is an official reference or supplied reference. Do not ask the subagent to fetch official docs on its own.
7. During non-trivial multi-strand research on Gemini, use `update_topic` and `write_todos` only as session-local visibility aids. When a host does not expose those helpers, keep the same stage and next-safe-action visibility through short progress recaps plus MCP-backed checkpoints and `STATE.md`.
8. Break long-running research into topic-sized strands, checkpoint paused or inconclusive work, and use the runtime contract's single-agent fallback when no suitable subagent is available. Do not use browser-only, web-search-only, shell-only, or generic agents as substitutes.
9. If `blueprint_phase_artifact_write` returns `status: "invalid"` or validation issues, repair the same normalized draft using the returned issues and retry once before treating `/blu-research-phase` as complete. If the same diagnostics repeat, preserve or refresh the research checkpoint, report the exact diagnostics and next safe action, and stop.
10. After a successful research write or a valid `view`/`skip`/`reuse` exit, call `blueprint_state_update` with `base: "synced"` while preserving the already resolved selected phase in `patch.currentPhase` together with `patch.activeCommand`, then call `blueprint_state_load` so `STATE.md` and the reported next safe action advance without mutating the research artifact.

### `list-phase-assumptions`

Before running the command flow, read
`skills/blueprint-phase-discovery/references/list-phase-assumptions-runtime-contract.md`.
That command-specific reference is the behavior authority for the five
assumption areas, read-only output, optional `blueprint-researcher` bounds,
uncertainty language, waiting-state behavior, and next-safe-action guidance.
Treat `/blu-list-phase-assumptions` as an `interactive-read` summary and keep it
read-only. Do not use `update_topic`, `write_todos`, task tracker tools, hidden
planning, staged progress, or persistence tools for this command.

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

## Completion Self-Check

Before claiming completion, verify:

- The active command's skill-local runtime reference from `input_bundles.commands[...]` was loaded, and sibling discovery references were not treated as active input; for `/blu-discuss-phase`, the long-running profile was also loaded.
- The active command used only its command-scoped MCP allowlist, translated to `mcp_blueprint_*` runtime FQNs, and reached the contract's required milestones in order: resolve, read evidence/config/contracts, decide gates, persist or no-write, validate, and route.
- Any artifact work used `blueprint_artifact_contract_read` for the active contract id (`phase.context`, `phase.discussion-log`, `phase.research`, or `phase.ui-spec`) before drafting or writing; scaffold text, status booleans, and prompt-local templates were not treated as finished content.
- Persistence, when allowed, happened only through the owning MCP tools; returned `status`, `written`, `created`, `updated`, `path`, `validation`, `warnings`, and `reason` fields were treated as authoritative. For `/blu-list-phase-assumptions`, verify no write-capable MCP tool, task tracker, or hidden planning helper was called.
- Required gates were satisfied before action: artifact overwrite/reuse/update, discuss checkpoint resume-versus-discard, research external-source policy, UI contract-versus-skip, `workflow.ui_safety_gate` rationale, checker-requested revisions, and checkpoint owner/mode cleanup guards.
- Validation, checker, model-check, or MCP rejection results were repaired through the same normalized draft and retried when the active contract allows it; otherwise the run stopped with a checkpoint or waiting state and an honest blocker. Invalid, partial, scaffold-only, skipped, or silently reused invalid work was not described as successful completion.
- The command stayed inside its write boundary, limited to `.blueprint/phases/<phase>/` plus `.blueprint/STATE.md` when mutation is allowed, and did not mutate source files, runtime contracts, installed extension directories, host-global Blueprint state, planned-only surfaces, or prompt-only hidden state.
- Routing and the final response came from refreshed MCP state and, when required, `blueprint_command_catalog`; recommend only implemented commands, using `/blu-progress` when the safe next action is missing, blocked, or ambiguous.
- The final response named the phase, MCP-returned artifact paths or explicit no-write outcome, checkpoint and state-update behavior, warnings or blockers, and the next safe implemented action.

## Non-Negotiables

- All persistent writes must go through MCP tools only.
- Do not mutate arbitrary repo files from discovery commands.
- Do not present planned-only lifecycle commands as runnable just because they are documented.
