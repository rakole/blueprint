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
- Treat Blueprint skills as loaded guidance, not callable tools. Before any
  discovery delegation decision, read effective config with
  `mcp_blueprint_blueprint_config_get`. When delegation is allowed, call the
  same-named Gemini CLI agent tool (`blueprint-researcher`,
  `blueprint-ui-designer`, or `blueprint-checker`) with a bounded task packet.
  Delegate only when the active command contract permits that agent,
  `workflow.subagents` is not `false`, the same-named tool is available in the
  current host session, and the task benefits from bounded sidecar synthesis.
  Do not read, inline, or load any separate agent source before delegation;
  otherwise use the command's no-subagent fallback and state the fallback
  reason.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.
- For structured interactive choices, confirmations, or short clarifications, prefer  `ask_user` tool over plain assistant prose.
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
- keep command-specific discovery behavior in the active runtime contract instead of duplicating the full workflow in this shared skill
- use `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` as the rich behavior contract for `/blu-discuss-phase`
- use `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md` as the shared long-running profile for `/blu-discuss-phase`
- use `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md` as the rich behavior contract for `/blu-research-phase`
- use `skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md` as the rich behavior contract for `/blu-ui-phase`
- treat `phase.context.modelContract` as the context schema authority and `contract.authoringTemplate` as the schema authority for freehand discovery artifacts, while treating scaffold output as starter-only seed material that must not survive into final saved artifacts

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
- `blueprint_phase_artifact_scaffold`
- `blueprint_phase_artifact_write`
- `blueprint_artifact_contract_read`
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
- `blueprint_state_load`
- `blueprint_command_catalog`
- `blueprint_state_update`

### `/blu-list-phase-assumptions`

- `blueprint_phase_locate`
- `blueprint_project_status`
- `blueprint_roadmap_read`
- `blueprint_phase_context`
- `blueprint_config_get`

## Optional Agents

- `blueprint-researcher`
- `blueprint-ui-designer`
- `blueprint-checker`

## Shared MCP Contracts

- `blueprint_phase_locate`: pass only a numeric phase reference when the command provides one, or omit `phase` to let the runtime infer it from state or the roadmap. Never pass phase directories, slugs, or filenames.
- `blueprint_phase_artifact_write`: pass numeric `phase`, the correct artifact enum, and exactly one input. For `artifact: "context"`, pass a structured `phase.context` model and let MCP render canonical Markdown; Markdown `content` fallback is rejected. For `discussion-log`, `research`, and `ui-spec`, pass full artifact content. The tool owns the final artifact `path`; use the returned `path` as authoritative and do not write raw filenames directly.
- For `phase.context` models, when `Open Questions` has no unresolved items, set `openQuestions: []` and let MCP render the canonical `- none` Markdown row. Keep `openQuestions: ["none"]` only as compatibility for older saved model inputs, and do not pass scalar `openQuestions: "none"`.
- `blueprint_phase_artifact_scaffold`: pass numeric `phase`, the correct artifact enum, and optional `overwrite` only when a phase command deliberately seeds a placeholder file before final authoring. The tool owns the canonical phase artifact path.
- `blueprint_artifact_contract_read`: read canonical model contracts, authoring templates, and validation metadata by contract id instead of relying on copied prompt-local templates. `phase.context` is model-only at read time; freehand artifacts such as `phase.discussion-log`, `phase.research`, and `phase.ui-spec` still expose `authoringTemplate`. If runtime contracts later expose a separate scaffold template, keep that scaffold shape starter-only.
- `blueprint_artifact_scaffold`: use it only with supported repo-relative artifact paths when a command contract explicitly allows path-based scaffolding. Do not treat scaffold text as completed context, research, or UI-spec content, and do not preserve literal scaffold placeholders, example bullets, or fill-in cues in the final write.
- `blueprint_phase_checkpoint_get`: pass the command's expected owner and mode when resuming saved state, then honor `safeToResume` and `warnings` before using the checkpoint.
- `blueprint_phase_checkpoint_put`: `checkpoint` must be a JSON object using the active command's runtime-contract checkpoint shape, including owner and mode guards. The tool owns the shared checkpoint filename and location, rejects foreign-owner or legacy overwrites, and pairs with `blueprint_phase_checkpoint_delete` owner/mode guards when commands clean up checkpoint state.
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

0. Treat `blueprint_phase_context.codebase` as reusable brownfield repo evidence when it is present. Prefer the saved `.blueprint/codebase/` summaries before re-reading broad repo surfaces, and call out when the codebase bundle is missing or incomplete. Treat saved summaries as useful but potentially stale: cite them, then confirm the live repo still agrees before using them as planner-grade truth.
   Sweep prior-phase context first so the session reuses the current evidence base before it asks for fresh detail; this is a saved-artifact sweep, not a dedicated todo/backlog file crawl.

### Canonical Research Contract

Use `blueprint_artifact_contract_read` with `artifactId: "phase.research"` when `/blu-research-phase` creates or updates research.

- Normalize the final draft to the returned `authoringTemplate`.
- Keep the contract's required section names and locked markers unchanged.
- Replace every placeholder signal before writing.
- Allow extra top-level headings only when the contract policy says they are supported.

### `discuss-phase`

Before running `/blu-discuss-phase`, load `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` and `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md`. The runtime contract owns the discuss-specific behavior; the long-running profile owns visible stage, pending-gate, and next-safe-action posture.

Keep persistent writes MCP-owned, phase-scoped, and limited to the command-scoped MCP tools. If the allowed same-named Gemini agent tool is unavailable, disabled, unnecessary, or unsafe, use the runtime contract's no-subagent fallback while preserving final artifact quality.

### `research-phase`

Before running the command flow, read `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`. That file is the detailed authority for research-specific flow, evidence depth, checkpoint ownership, validation repair, and routing, so keep this shared skill focused on the active command boundary instead of restating the whole workflow inline.

1. Confirm phase readiness with `blueprint_phase_context`, `blueprint_phase_research_status`, and `blueprint_config_get`.
2. Read the actual current `XX-CONTEXT.md` content through `blueprint_phase_artifact_read` before drafting research so the output stays grounded in saved discovery context, not only status metadata. If that read reports `found: false`, stop and route back to `/blu-discuss-phase <phase>`. If that read reports invalid or unusable context, stop and route back to `/blu-discuss-phase <phase>` without repairing, overwriting, synthesizing, or substituting repo-root `CONTEXT.md`.
3. Read any existing `XX-RESEARCH.md` through `blueprint_phase_artifact_read` before proposing replacement. Force repair when saved research is invalid. When saved research is already valid, prefer a one-question `ask_user` dialog for `view`/`skip`/`update`; choosing `update` is the overwrite gate.
4. Draft directly from `contract.authoringTemplate`. Use `blueprint_phase_artifact_scaffold` only for deliberate placeholder creation when a seeded file is explicitly needed before final research exists.
5. Apply the runtime contract sections for external-source decisions, evidence quality, investigation trace, strand ledger, dependency/tool evaluation, sidecar criteria, progress visibility, validation repair, and completion receipt. Those sections own the detailed research behavior; this shared skill owns only the command boundary.
6. Call the same-named `blueprint-researcher` Gemini agent tool with a bounded research task packet only when the runtime contract's capability and material-help criteria are met. The parent owns evidence acceptance, synthesis, final confidence, persistence, checkpoints, state sync, user gates, and routing.
7. If `blueprint_phase_artifact_write` returns `status: "invalid"` or validation issues, repair the same normalized draft using the returned issues and retry once before treating `/blu-research-phase` as complete. If the same diagnostics repeat, preserve or refresh the research checkpoint, report the exact diagnostics and next safe action, and stop.
8. After a successful research write or a valid `view`/`skip`/`reuse` exit, call `blueprint_state_update` with `base: "synced"` while preserving the already resolved selected phase in `patch.currentPhase` together with `patch.activeCommand`, then call `blueprint_state_load`, verify the recommended follow-up through `blueprint_command_catalog`, and delete only the guarded research-owned checkpoint after route proof succeeds.

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
six UI dimensions, progressive-disclosure if/else branching, the dedicated
`blueprint_phase_ui_skip_write` path for explicit skip mode, and
`blueprint_artifact_contract_read` with `artifactId: "phase.ui-spec"` only for
real UI-contract mode,
bounded `blueprint-checker` use, no-subagent fallback, browser-only,
web-search-only, shell-only, or generic agents rejection, validation repair,
and `/blu-plan-phase <phase>` or `/blu-progress` routing. Do not inline the
full UI workflow into `/blu-discuss-phase` context.
It preserves the exact `workflow.ui_safety_gate` rationale confirmation gate.
It preserves the rejection of browser-only, web-search-only, shell-only, or generic agents.
It preserves `artifactId: "phase.ui-spec"` as the canonical UI-spec contract id.
After a successful write or valid reuse path, call `blueprint_state_update`
with `base: "synced"` while preserving the already resolved selected phase in
`patch.currentPhase` together with `patch.activeCommand`, then call
`blueprint_state_load` and report the refreshed next safe action from
`derivedStatus.nextAction`. Use `blueprint_command_catalog` whenever the final
routing recommendation needs an explicit implemented-only check, and fall back
to `/blu-progress` when refreshed routing is missing, blocked, or ambiguous.

## Completion Self-Check

Before claiming completion, verify:

- The active command's skill-local runtime reference from `input_bundles.commands[...]` was loaded, and sibling discovery references were not treated as active input; for `/blu-discuss-phase`, the long-running profile was also loaded.
- The active command used only its command-scoped MCP allowlist, translated to `mcp_blueprint_*` runtime FQNs, and reached the contract's required milestones in order: resolve, read evidence/config/contracts, decide gates, persist or no-write, validate, and route.
- Any artifact work used `blueprint_artifact_contract_read` for the active contract id (`phase.context`, `phase.discussion-log`, `phase.research`, or `phase.ui-spec`) before authoring or writing; context used the structured model contract, freehand discovery artifacts used their authoring templates, and scaffold text, starter template literals, status booleans, and prompt-local templates were not treated as finished content or preserved verbatim in the saved artifact.
- Persistence, when allowed, happened only through the owning MCP tools; returned `status`, `written`, `created`, `updated`, `path`, `validation`, `warnings`, and `reason` fields were treated as authoritative. For `/blu-list-phase-assumptions`, verify no write-capable MCP tool, task tracker, or hidden planning helper was called.
- Required gates were satisfied before action: artifact overwrite/reuse/update, discuss checkpoint resume-versus-discard, research external-source policy, UI contract-versus-skip, `workflow.ui_safety_gate` rationale, checker-requested revisions, and checkpoint owner/mode cleanup guards.
- Validation, checker, model-check, or MCP rejection results were repaired through the same normalized draft and retried when the active contract allows it; otherwise the run stopped with a checkpoint or waiting state and an honest blocker. Invalid, partial, scaffold-only, skipped, or silently reused invalid work was not described as successful completion.
- For `/blu-research-phase`, the loaded runtime contract's research evidence, source-policy, strand-ledger, dependency/tool, sidecar, repair, and completion rules were followed; richer provenance warnings on older otherwise-valid artifacts remained warning-grade unless MCP validation made them strict.
- For `/blu-research-phase`, progress used the visible research stages, any
  `research.external_sources=ask` branch recorded `accept`, `decline`, or
  `cancel`, parent-only fallback was explicit when relevant, and the final
  response used the compact completion receipt instead of duplicating
  `XX-RESEARCH.md`.
- The command stayed inside its write boundary, limited to `.blueprint/phases/<phase>/` plus `.blueprint/STATE.md` when mutation is allowed, and did not mutate source files, runtime contracts, installed extension directories, host-global Blueprint state, planned-only surfaces, or prompt-only hidden state.
- Routing and the final response came from refreshed MCP state and, when required, `blueprint_command_catalog`; recommend only implemented commands, using `/blu-progress` when the safe next action is missing, blocked, or ambiguous.
- The final response named the phase, MCP-returned artifact paths or explicit no-write outcome, checkpoint and state-update behavior, warnings or blockers, and the next safe implemented action.

## Non-Negotiables

- All persistent writes must go through MCP tools only.
- Do not mutate arbitrary repo files from discovery commands.
- Do not present planned-only lifecycle commands as runnable just because they are documented.
