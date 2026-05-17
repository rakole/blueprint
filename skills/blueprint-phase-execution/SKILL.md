---
name: blueprint-phase-execution
description: >
  Plan execution, bounded quick delivery, and durable execution evidence for
  Blueprint lifecycle work. Use this skill to run saved plans in wave-aware
  order, execute quick scoped tasks, and keep Blueprint-owned persistence on
  MCP rails.
status: implemented
commands:
  - /blu-execute-phase
  - /blu-fast
  - /blu-quick
input_bundles:
  shared: []
  commands:
    "/blu-execute-phase":
      - commands/blu-execute-phase.toml
      - skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md
      - skills/blueprint-phase-execution/references/long-running-execution-profile.md
    "/blu-quick":
      - commands/blu-quick.toml
      - skills/blueprint-phase-execution/references/quick-runtime-contract.md
      - skills/blueprint-phase-execution/references/long-running-execution-profile.md
    "/blu-fast":
      - commands/blu-fast.toml
      - skills/blueprint-phase-execution/references/fast-runtime-contract.md
---

# Blueprint Phase Execution Skill

## Purpose

Orchestrate Blueprint's execution-family flows while keeping command behavior
host-native, plan-aware, and MCP-owned.

## Runtime Self-Sufficiency

This skill package is the runtime source of truth for `/blu-execute-phase`,
`/blu-quick`, and `/blu-fast`.

- Shipped phase-execution commands are docs-free at runtime. Resolve runtime
  inputs from structured `input_bundles`, command manifests, local references,
  and MCP/artifact contracts.
- Runtime behavior must stay executable from this skill plus its local
  references alone.
- Load only the command-specific reference bundle for the active command. Do
  not inline `/blu-quick` or `/blu-fast` runtime details into
  `/blu-execute-phase` context.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as
  `mcp_blueprint_blueprint_project_status`.
- Translate shorthand tool ids from older docs into runtime FQNs before
  calling them.
- Translate any shorthand tool ids like `blueprint_project_status` into runtime
  FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI
  entrypoints, not shell executables.
- Prefer  `ask_user` tool for focused confirmations and
  branch choices. When the host does not expose `ask_user`, ask the same
  focused question in prose instead of inventing a replacement tool.
- `/blu-execute-phase` and non-trivial `/blu-quick` runs use the shared
  `long-running-mutation` posture from
  `references/long-running-execution-profile.md`.
- `/blu-fast` stays on the interactive-read trivial path defined in
  `references/fast-runtime-contract.md`.

## Local Runtime References

- `skills/blueprint-phase-execution/references/long-running-execution-profile.md`
  Shared stage, status, and session-local helper guidance for
  `/blu-execute-phase` and non-trivial `/blu-quick`.
- `skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md`
  Rich `/blu-execute-phase` contract for target selection, lower-wave gating,
  summary persistence, carry-forward evidence, synced state refresh, and
  validation handoff.
- `skills/blueprint-phase-execution/references/quick-runtime-contract.md`
  Bounded `/blu-quick` contract for optional depth gates, tracker-eligible
  branching, quick-run report persistence, and follow-up routing.
- `skills/blueprint-phase-execution/references/fast-runtime-contract.md`
  Trivial `/blu-fast` contract for inline execution, no-subagent behavior, and
  optional state refresh without report persistence.

Command-specific inputs are resolved from the structured `input_bundles`
frontmatter for the invoking execution command. The shared bundle is
intentionally empty so active command runtime stays docs-free and derives
contracts from manifests, local references, and MCP/artifact contract reads.

## Shared MCP Contracts

- `blueprint_phase_locate`: pass only a numeric phase reference when the
  command provides one, or omit `phase` to allow state or roadmap inference.
  Never pass phase directories, slugs, or filenames.
- `blueprint_phase_execution_targets`: use it as the deterministic read path
  for execute-phase target selection, lower-wave blockers, overwrite
  candidates, overlap warnings, selected plan metadata, existing summary
  metadata, blocker packets, and gap-only routing on the common pre-write path.
- `blueprint_phase_summary_authoring_context`: read it before summary drafting
  so Markdown summary content is grounded in the selected saved plan's
  acceptance criteria, dependency plan inventory, linked plan path, summary
  path, and status-safe next actions.
- `blueprint_phase_summary_validate_model`: validate Markdown summary draft
  content and repair semantic diagnostics before persistence. The tool name is
  retained for compatibility; schema-first summary JSON is deprecated.
- `blueprint_phase_summary_write`: pass numeric `phase`, numeric `planId`, and
  Markdown `content` with an explicit Status marker. The matching plan must
  already exist, and the returned `path` plus `linkedPlanPath` are
  authoritative.
- `blueprint_artifact_contract_read`: read canonical authoring templates and
  validation metadata by contract id instead of relying on copied prompt-local
  templates.
- `blueprint_artifact_report_write`: pass a bare report name such as
  `quick-run-latest`, plus the structured quick-run report `model`, not
  Markdown `content` and not a `.blueprint/reports/...` path. Use the returned
  `path` as authoritative.
- `blueprint_state_update`: when refreshed artifact truth should drive routing,
  call it with `base: "synced"` so `STATE.md` recomputes the next safe action.

## Command-Scoped Required MCP Tools

Use only the MCP tools allowed by the active command contract. The shared skill
does not widen a command's tool scope.

### `/blu-execute-phase`

- `blueprint_phase_locate`
- `blueprint_phase_plan_index`
- `blueprint_phase_execution_targets`
- `blueprint_phase_plan_read`
- `blueprint_phase_summary_index`
- `blueprint_phase_summary_read`
- `blueprint_phase_summary_authoring_context`
- `blueprint_phase_summary_validate_model`
- `blueprint_phase_summary_write`
- `blueprint_artifact_contract_read`
- `blueprint_config_get`
- `blueprint_artifact_validate`
- `blueprint_state_load`
- `blueprint_state_update`

### `/blu-quick`

- `blueprint_project_status`
- `blueprint_command_catalog`
- `blueprint_artifact_report_write`
- `blueprint_state_update`

### `/blu-fast`

- `blueprint_project_status`
- `blueprint_state_update`

## Optional Agents

- `blueprint-researcher`
- `blueprint-planner`
- `blueprint-executor`
- `blueprint-verifier`

Use optional agents only when the active command contract allows them. `/blu-fast`
does not use subagents.

## Shared Execution Posture

- Execution stays host-native and MCP-owned instead of script-owned.
- Follow-up routing stays inside the implemented Blueprint surface.
- State updates happen after artifact truth is refreshed, not before.
- `/blu-execute-phase` keeps saved plans as the execution scope authority.
- `/blu-execute-phase` keeps `blueprint_phase_execution_targets` as the common
  pre-write metadata authority; `blueprint_phase_plan_read` stays for selected
  plan bodies, and `blueprint_phase_summary_read` stays conditional on needing
  existing summary body text for overwrite or repair reasoning.
- `/blu-quick` stays bounded and report-backed rather than impersonating saved
  planning or broad lifecycle execution.
- `/blu-fast` stays trivial and does not create durable reports or phase
  artifacts.

## Command Summaries

### `/blu-execute-phase`

Before running the command flow, read
`skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md`.
It locks the retained execute behavior that is easy to dilute: deterministic
`blueprint_phase_execution_targets` selection, absolute lower-wave blockers,
disjoint-write parallel gating, summary-backed carry-forward evidence,
`PARTIAL` and `BLOCKED` pending semantics, synced state refresh, validation
handoff, and no report persistence.

- Execution profile: `long-running-mutation`.
- Keep the shared stage vocabulary explicit during non-trivial runs:
  `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`.
- Keep the in-flight status contract visible during non-trivial runs: resolved
  scope, active stage, pending gate, execution mode, next safe action.
- Use `blueprint-executor` only for bounded plan work with disjoint write
  ownership. Use the single-agent fallback when agents are unavailable or
  unsafe.
- Persist one Markdown summary per executed plan through MCP and
  treat valid `PARTIAL` and `BLOCKED` summaries as durable carry-forward
  evidence rather than completion.
- Use saved plan external-service prerequisites plus
  `blueprint_phase_execution_targets.externalServicePreflight` to stop for
  readiness confirmation before meaningful execution when the plan depends on
  runtime services the agent cannot safely assume are ready.
- Keep the default pre-write read path trimmed to
  `blueprint_phase_execution_targets`, effective `blueprint_config_get`, and
  `blueprint_phase_plan_read` for selected plan bodies. Do not treat
  pre-write `blueprint_artifact_validate` or `blueprint_state_load` as common
  required reads, and use `blueprint_phase_summary_read` only when existing
  summary body text is needed for overwrite or repair reasoning.
- If a selected plan depends on another plan whose summary is not yet
  `COMPLETED`, do not write `COMPLETED` for the dependent plan. Use `PARTIAL`
  or `BLOCKED`, update Readiness, Completion State, Next Safe Action,
  Verification, Gap / Repair Routes, and Follow-Ups to match, and keep the
  dependency blocker explicit until the dependency summary exists.
- Warning-only Markdown shape, exact sentinel, or style advice does not require
  another repair loop when linkage, status, dependency order, verification truth,
  and external-service readiness are otherwise valid.
- Do not make a phase-level completion claim from execute-phase itself; that
  waits for `/blu-validate-phase`, and `/blu-verify-work` remains the verifier
  follow-up once validation evidence exists.
- Prefer `/blu-progress` as the default safe follow-up unless a narrower
  implemented next step is clearly warranted.

### `/blu-quick`

Before running the command flow, read
`skills/blueprint-phase-execution/references/quick-runtime-contract.md`. It
locks the bounded quick behavior that is easy to dilute: explicit optional
depth gates, tracker-eligible branch handling, durable `quick-run-latest`
report persistence, and routing that refuses to impersonate saved planning or
multi-wave execution.

- Execution profile: `long-running-mutation` for non-trivial runs.
- Use the shared long-running execution profile only for the stages the quick
  run actually reaches.
- Keep the active stage visible, keep the resolved scope, pending gate,
  execution mode, and next safe action explicit, and treat tracker state as
  session-local coordination only.
- Persist durable quick-run evidence through
  `blueprint_artifact_report_write` with the bare canonical report name
  `quick-run-latest`.
- Prefer `/blu-progress` after completion unless a narrower implemented next
  step is obvious and safe.

### `/blu-fast`

Before running the command flow, read
`skills/blueprint-phase-execution/references/fast-runtime-contract.md`. It
locks the trivial inline path that is easy to dilute: small-scope qualification,
no subagents, no tracker or visible todo layer, optional state refresh only in
initialized projects, and no quick-run report persistence.

- Execution profile: `interactive-read`.
- `/blu-fast` explicitly excludes `update_topic`, `write_todos`, and tracker
  tools; finish the run inline or reroute.
- Start from `blueprint_project_status`, keep the ask genuinely small, and do
  not create durable reports or phase artifacts.
- Prefer `/blu-progress` unless a narrower implemented follow-up is obvious
  and safe.

## Output Style

- Explain the selected scope and why it fits the active command.
- Explain any overwrite, blocker, or boundedness risk before writes.
- Keep the user anchored on the next safe implemented action.

## Completion Self-Check

Before claiming completion, verify the active command's loaded manifest and
runtime contract support the result:

- Active input stayed command-scoped: only the invoking command's
  `input_bundles` files, plus `long-running-execution-profile.md` when
  applicable, were treated as active requirements.
- Required Blueprint MCP calls were made in the active contract's order through
  runtime FQNs; no `/blu-*` command ran in the shell and no shorthand tool id
  was treated as callable.
- Persistence used only the owning MCP tools:
  `mcp_blueprint_blueprint_phase_summary_write` for execute summaries,
  `mcp_blueprint_blueprint_artifact_report_write` for the quick report, and
  `mcp_blueprint_blueprint_state_update` for allowed state refreshes.
- Returned command-specific fields such as summary `path`, `linkedPlanPath`,
  report `path`, `written`, `overwritten`, state `statePath`,
  `updatedFields`, validation results, warnings, issues, statuses, and
  `reason` values were treated as authoritative evidence.
- Required gates were satisfied before writes: execute summary replacement or
  overlapping execution, quick optional-depth expansion or report replacement,
  and fast persistence only through healthy initialized Blueprint state.
- Validation, model-check, and tool rejection results were repaired or reported
  honestly: execute uses valid `PARTIAL` or `BLOCKED` summaries when needed,
  while quick and fast report warnings, deferred follow-up, reroute, or
  no-write status instead of claiming success.
- The run stayed inside the active command's write boundary and did not mutate
  unrelated Blueprint state, runtime files, installed extension directories,
  hidden state, direct `.blueprint/` paths, or planned-only surfaces.
- Final routing stayed inside the implemented Blueprint surface, using
  command-catalog evidence only when the active command loaded it, with
  `/blu-progress` as the fallback when the next safe action was ambiguous or
  unavailable.
- The final response named the concrete executed scope and authoritative
  artifact paths or no-write status, included warnings or blockers, and did
  not claim phase completion from `/blu-execute-phase`.
