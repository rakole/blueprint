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
- Keep `/blu-fast` and `/blu-quick` cache-friendly: the static prompt prefix
  should hold command identity, hard contract, routing ladder, tool
  boundaries, and response or report schema expectations, while user task,
  preflight result, overwrite metadata, and files/evidence/validation output
  stay in the variable suffix via command-specific input bundles.
- Keep long examples and verbose behavior notes in local references, not in the
  manifests.

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
  Bounded `/blu-quick` contract for inline-default adaptive subagent gates,
  compact progress UX, tracker-eligible branching, quick-run report
  persistence, and follow-up routing.
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
- `blueprint_phase_execution_prepare`: use preview to obtain the immutable
  selection/authority packet, claim with the exact fingerprint and confirmation
  literal, and resume only the exact active durable session.
- `blueprint_phase_execution_apply`: use it for every selected plan-owned
  write or delete with the exact claimed or latest receipted preimage.
- `blueprint_phase_execution_verify`: run only the commands bound into the
  claimed packet and accept its one-repair limit.
- `blueprint_phase_execution_finalize`: use it after pass or terminal failure;
  it derives the summary from receipts and owns summary/index/artifact/state
  persistence plus next-plan or terminal routing.
- `blueprint_artifact_contract_read`: read canonical authoring templates and
  validation metadata by contract id instead of relying on copied prompt-local
  templates.
- `blueprint_artifact_report_write`: pass a bare report name such as
  `quick-run-latest`, plus the structured quick-run report `model`, not
  Markdown `content` and not a `.blueprint/reports/...` path. Use the returned
  `path` as authoritative.
- `blueprint_lightweight_preflight`: use it as the deterministic read-only
  scope, health, config, implemented-route, quick-report overwrite, and next
  safe action preflight for `/blu-fast` and `/blu-quick`.
- `blueprint_state_update`: when refreshed artifact truth should drive routing,
  call it with `base: "synced"` so `STATE.md` recomputes the next safe action.

## Command-Scoped Required MCP Tools

Use only the MCP tools allowed by the active command contract. The shared skill
does not widen a command's tool scope.

### `/blu-execute-phase`

- `blueprint_phase_execution_prepare`
- `blueprint_phase_execution_apply`
- `blueprint_phase_execution_verify`
- `blueprint_phase_execution_finalize`

### `/blu-quick`

- `blueprint_lightweight_preflight`
- `blueprint_artifact_report_write`
- `blueprint_state_update`

### `/blu-fast`

- `blueprint_lightweight_preflight`
- `blueprint_state_update`

## Optional Agents

- `blueprint-researcher`
- `blueprint-planner`
- `blueprint-executor`
- `blueprint-verifier`

Use optional agents only when the active command contract allows them. `/blu-fast`
does not use subagents.

`/blu-execute-phase` has no optional write agent. Its inline orchestrator may
reason about the packet, but all repository mutation stays inside
`blueprint_phase_execution_apply`.

For `/blu-quick`, default inline and use optional agents only when the local
decision table says the bounded value outweighs the coordination cost. Do not
substitute browser-only, shell-only, web-search-only, or generic helper agents,
and do not let tracker state impersonate a saved plan.

## Shared Execution Posture

- Execution stays host-native and MCP-owned instead of script-owned.
- Follow-up routing stays inside the implemented Blueprint surface.
- State updates happen after artifact truth is refreshed, not before.
- `/blu-execute-phase` keeps saved plans as the execution scope authority.
- `/blu-execute-phase` keeps the claimed execution packet as the only selection,
  freshness, approval, plan-body, preimage, and verification authority.
- `/blu-quick` stays bounded and report-backed rather than impersonating saved
  planning or broad lifecycle execution.
- `/blu-fast` stays trivial and does not create durable reports or phase
  artifacts.

## Command Summaries

### `/blu-execute-phase`

Before running the command flow, read
`skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md`.
It locks deterministic claimed selection, sequential plan ownership,
preimage-bound MCP mutation, packet-bound verification, one repair,
receipt-derived summaries, resumable persistence, validation handoff, and no
report persistence.

- Execution profile: `long-running-mutation`.
- Keep the shared stage vocabulary explicit during non-trivial runs:
  `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`.
- Keep the in-flight status contract visible during non-trivial runs: resolved
  scope, active stage, pending gate, execution mode, next safe action.
- Preview first, bind external-service and overwrite decisions into the packet,
  then claim with the exact fingerprint and confirmation literal.
- Execute packet plans sequentially. Never delegate or perform direct repo
  writes; submit exact preimage-bound mutations through execution_apply.
- Run execution_verify after each apply. A first failure permits exactly one
  repair apply and one mandatory second verification.
- Finalize passing or blocked plans through execution_finalize. Its durable
  session, receipt-derived summary, summary index, artifact validation, synced
  state, and advancement order are authoritative.
- Resume interruptions with execution_prepare `mode: "resume"` and the exact
  session id; mixed postimages, unreceipted drift, and stale authority block.
- Do not make a phase-level completion claim from execute-phase itself; that
  waits for `/blu-validate-phase`, and the validation/state tools choose
  `/blu-verify-work` or `/blu-progress` from `workflow.no_uat` once validation
  evidence exists.
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
- Keep the active stage visible only at meaningful stage or gate transitions,
  keep the resolved scope, pending gate, execution mode, and next safe action
  explicit, and treat tracker state as session-local coordination only.
- Start from `blueprint_lightweight_preflight` before optional subagent
  decisions so effective config, health/new-project routing, implemented routes,
  and overwrite gates share one deterministic read path; treat `--discuss`,
  `--research`, `--validate`, and `--full` as bounded non-destructive depth
  preauthorization rather than overwrite, destructive, or scope-expansion
  approval.
- Keep the common quick path to `blueprint_lightweight_preflight` first. When
  validation is needed, run validation shell or test commands outside
  Blueprint MCP before `blueprint_artifact_report_write`, then persist through
  `blueprint_artifact_report_write` and `blueprint_state_update`. Do not add
  redundant primitive MCP reads when preflight already surfaced the scope,
  health, config, route, and overwrite facts the run needs.
- Use no subagents by default. Bring in `blueprint-researcher`,
  `blueprint-planner`, `blueprint-executor`, or `blueprint-verifier` only when
  the quick runtime contract's decision table says the bounded quality gain
  earns the coordination cost.
- Run cheap validation for code mutation when a bounded safe check is
  discoverable, or record an explicit skipped reason in the quick report.
- Persist durable quick-run evidence through
  `blueprint_artifact_report_write` with the bare canonical report name
  `quick-run-latest`.
- Keep the default final quick closeout within 12 lines: task, depth used,
  validation status, authoritative report `status` and `path`, warnings or
  deferred work, and the next safe implemented action. Leave detailed evidence
  in the quick-run report.
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
- Start from `blueprint_lightweight_preflight`, keep the ask genuinely small,
  keep the common path to preflight plus optional `blueprint_state_update`
  only, avoid redundant primitive MCP reads when preflight already surfaced
  classification and health, and do not create durable reports or phase
  artifacts.
- Keep the final fast closeout within 8 lines: qualification reason,
  state-update or no-write status, any reroute or warning, and the next safe
  implemented action.
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
- Persistence used only the owning MCP tools: the four execute-phase control
  tools for saved-plan execution, `mcp_blueprint_blueprint_artifact_report_write`
  for the quick report, and `mcp_blueprint_blueprint_state_update` for fast or
  quick state refreshes.
- Returned command-specific fields such as summary `path`, `linkedPlanPath`,
  report `path`, `written`, `overwritten`, state `statePath`,
  `updatedFields`, validation results, warnings, issues, statuses, and
  `reason` values were treated as authoritative evidence.
- Required gates were satisfied before writes: execute summary replacement or
  overlapping execution, quick optional-depth expansion or report replacement,
  and fast persistence only through healthy initialized Blueprint state.
- Validation, model-check, and tool rejection results were repaired or reported
  honestly: execute uses receipt-derived `BLOCKED` summaries when needed,
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
