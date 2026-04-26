# Blueprint Memory

## Purpose

This file is the evolving project snapshot for Codex sessions operating on Blueprint.
Use `AGENTS.md` for durable repo instructions and use this file for current state, recent decisions, and next-step context.

## Project Status

- Current milestone: post-shipment lifecycle and roadmap-admin closeout now also includes the shipped Wave 3 capture slice, the shipped Wave 3 lightweight execution slice, the shipped Wave 3 debug slice, the shipped Wave 4 docs, review, remediation, review-fix, peer-review, UI-audit, test-generation, impact, review-branch, shipping, and undo slices, the shipped Wave 5 `new-workspace`, `remove-workspace`, `workstreams`, cleanup, patch-replay, and advisory update slice; `complete-milestone`, `milestone-summary`, `new-milestone`, `insert-phase`, `note`, `add-todo`, `check-todos`, `add-backlog`, `review-backlog`, `explore`, `fast`, `quick`, `debug`, `docs-update`, `impact`, `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `review`, `ui-review`, `add-tests`, `pr-branch`, `ship`, `undo`, `new-workspace`, `remove-workspace`, `workstreams`, `cleanup`, `reapply-patches`, and `update` are implemented alongside the earlier lifecycle, governance, and roadmap-admin surfaces
- Runtime status: Wave 0 plus the Phase 3 discovery commands (`discuss-phase`, `research-phase`, `ui-phase`), the roadmap-discovery command `list-phase-assumptions`, the lifecycle commands `plan-phase`, `execute-phase`, `validate-phase`, `verify-work`, and `add-tests`, the Wave 3 lightweight execution commands `fast` and `quick`, the Wave 3 debug command `debug`, the router command `next`, the governance handoff/resume commands `pause-work` and `resume-work`, the Wave 2 roadmap-admin commands `add-phase`, `insert-phase`, `remove-phase`, `plan-milestone-gaps`, `audit-milestone`, `complete-milestone`, `milestone-summary`, and `new-milestone`, the Wave 3 capture commands `note`, `add-todo`, `check-todos`, `add-backlog`, `review-backlog`, and `explore`, the Wave 4 docs and review commands `docs-update`, `impact`, `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `review`, and `ui-review`, and the maintenance commands `pr-branch`, `ship`, `undo`, `new-workspace`, `remove-workspace`, `workstreams`, `cleanup`, `reapply-patches`, and `update` are implemented, and routing still filters to implemented commands only. `/blu-impact` now has its command manifest, `blueprint-impact` primary skill, runtime-contract reference, report writing/rendering, docs, tests, and built assets aligned.
- Brownfield bootstrap decision: brownfield repos now map first. `mapping-incomplete` and `mapped-only` are intentional codebase-only readiness states; unmapped brownfield and `mapping-incomplete` route to `/blu-map-codebase`, while `mapped-only` routes to `/blu-new-project` and preserves `.blueprint/codebase/*.md`.
- Planning status: shared architecture docs, executable Wave 0 plus Phase 3 runtime artifacts, a closed drift ledger, shipped advisory hooks, repaired research-phase parity guarantees, implemented plan-phase artifacts, implemented validation artifacts, implemented capture, lightweight execution, docs, review, remediation, and roadmap insertion artifacts, and Phase 4 execution summaries are present
- Implementation strategy: keep the shipped Wave 2 closeout plus `insert-phase`, `note`, `add-todo`, `add-backlog`, `review-backlog`, `fast`, `quick`, `debug`, `docs-update`, `impact`, `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `review`, `ui-review`, `add-tests`, `pr-branch`, `ship`, `undo`, `new-workspace`, `remove-workspace`, `workstreams`, `cleanup`, `reapply-patches`, and `update` contracts locked, preserve the closed Phase 2.2 and shipped Phase 3 guarantees, and continue treating `/blu-impact` as an explicit additive Wave 4 command rather than a retained-baseline revival
- Roadmap-admin status: `/blu-add-phase`, `/blu-insert-phase`, `/blu-remove-phase`, `/blu-plan-milestone-gaps`, `/blu-audit-milestone`, `/blu-complete-milestone`, `/blu-milestone-summary`, and `/blu-new-milestone` are now shipped as the current roadmap-admin slice, covering whole-number phase append, decimal insertion without renumbering later phases, future-phase removal with renumbering, grouped gap-closure planning, milestone audit reporting, report-driven milestone closeout, summary generation, and carry-forward milestone reset

## Stable References

- Durable repo instructions: `AGENTS.md`
- Drift ledger: `docs/DRIFT.MD`
- Shared architecture decisions: `docs/DECISIONS.md`
- MCP contracts: `docs/MCP-TOOLS.md`
- Command inventory: `docs/COMMAND-CATALOG.md`
- Current handoff: `docs/HANDOFF.md`

## Operational Notes (Worktrees + GitHub Writes)

- New `git worktree` checkouts do not share `node_modules`. Always run `npm ci` in the active worktree before any verification (`npm run build`, `npm run typecheck`, `npm test`), otherwise missing `esbuild`/`tsc` invalidates the pass.
- Treat the Codex GitHub plugin as read-only; avoid spending tokens attempting PR creation/merge through it. Use `gh` CLI (or plain `git push` and create/merge the PR manually).

## Current Architecture Snapshot

- Blueprint uses MCP as the deterministic state engine for structured reads and writes
- Shared runtime hardening now lives under `src/shared/security.ts`, with MCP helpers consuming it for path containment, safe JSON parsing, prompt-boundary checks, and identifier validation
- Blueprint now supports Gemini CLI and Tabnine CLI as two hosts for one shared runtime; host identity is injected at extension launch time and the MCP layer derives host-global Blueprint paths from that runtime context
- Commands own UX and routing
- Skills own orchestration
- `/blu-new-project` now uses a thin manifest envelope while the
  `blueprint-bootstrap` skill package carries the self-sufficient runtime
  contract and local bootstrap references under
  `skills/blueprint-bootstrap/references/`
- Agents own bounded deep work
- Hooks remain advisory rather than state-owning
- Scripts are not the primary persistence layer
- `blueprint_command_catalog` is runtime-aware and should be treated as the source of routable-command truth
- Gemini CLI runtime FQNs for Blueprint MCP tools use `mcp_blueprint_<toolName>`; do not reintroduce Codex-style `mcp_blueprint_...` names or shell fallbacks such as `mcp use` or `blueprint-mcp`

## Planned MCP Responsibilities

- `blueprint_project_*`: initialize repo state and report readiness
- `blueprint_config_*`: read and update `.blueprint/config.json`
- `blueprint_state_*`: load, update, and sync `STATE.md`
- `blueprint_roadmap_*` and `blueprint_phase_*`: mutate roadmap state, inspect phase readiness, and persist validated phase-scoped research, plans, and checkpoints
- `blueprint_review_*`: persist phase-scoped review artifacts and later review findings
- `blueprint_artifact_*`: scaffold, capture-index mutate, list, validate, and summarize artifacts
- `blueprint_review_*`: persist phase-scoped review artifacts and later review findings
- `blueprint_workspace_*`: manage global workspace registry and workspace creation/removal
- `blueprint_workstream_*`: manage project-local workstreams
- `blueprint_update_*`: generate advisory update checks and checklists
- `blueprint_patch_*`: record and replay patch metadata from the global registry

## Local Vs Global State

- Every Blueprint-managed repo or workspace gets its own `.blueprint/`
- `.blueprint/` holds project truth such as `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, phase artifacts, backlog, todos, notes, reports, codebase docs, and workstreams
- `~/.gemini/blueprint/` holds only cross-project operational data such as:
- host-global Blueprint state lives under the active CLI home, currently `~/.gemini/blueprint/` for Gemini and `~/.tabnine/blueprint/` for Tabnine
- workspace registry
- update metadata
- patch registry
- `.planning/` in this repo is implementation bookkeeping for the Blueprint build-out and must not be surfaced as Blueprint runtime state

## Retained Commands

- Total retained commands: 53, plus the explicitly approved additive `/blu-impact` command now shipped as an implemented advisory/reporting command
- Root router spec: `docs/commands/root-router.md`
- Per-command specs: `docs/commands/*.md`
- Command inventory index: `docs/COMMAND-CATALOG.md`

## Important Docs

- `README.md`
- `docs/DRIFT.MD`
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/GEMINI-CONSTRAINTS.md`
- `docs/PHASE-LIFECYCLE.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- `docs/TEST-STRATEGY.md`
- `docs/HANDOFF.md`

## Recommended Read Order Before Coding

1. `AGENTS.md`
2. `docs/DRIFT.MD`
3. `docs/DECISIONS.md`
4. `docs/ARCHITECTURE.md`
5. `docs/ARTIFACT-SCHEMA.md`
6. `docs/MCP-TOOLS.md`
7. `docs/GEMINI-CONSTRAINTS.md`
8. `docs/PHASE-LIFECYCLE.md`
9. `docs/SKILLS-AND-AGENTS.md`
10. `docs/IMPLEMENTATION-ORDER.md`
11. `docs/COMMAND-CATALOG.md`
12. `docs/commands/<command>.md`

## Next Implementation Slice

- continue `/blu-impact` from `docs/IMPACT-WORKFLOW-IMPLEMENTATION-PLAN.md` Phase 10 next; Phase 9 shipped the command manifest, `blueprint-impact` primary skill, rich runtime-contract reference, catalog implementation status, docs alignment, and metadata regression coverage
- keep the shipped `complete-milestone`, `milestone-summary`, `new-milestone`, `pr-branch`, `ship`, and `cleanup` contracts aligned with their docs, manifests, shared skills, and implemented-only routing behavior
- keep the shipped `insert-phase` contract aligned across its manifest, primary skill contract, required MCP substrate, and regression coverage
- start any post-Wave-2 rollout from a fresh plan instead of treating the closeout trio as still upcoming
- preserve the shipped `add-phase`, `remove-phase`, `plan-milestone-gaps`, and `audit-milestone` contracts plus implemented-only routing behavior
- preserve the shipped Phase 3 discovery artifact contracts, the read-only `list-phase-assumptions` contract, and implemented-only routing behavior
- keep `plan-phase` routed through the plan index plus dedicated plan read/write MCP tools
- keep `execute-phase` routed through the plan index plus dedicated summary read/write MCP tools
- keep `code-review` routed through `blueprint_phase_locate`, `blueprint_artifact_list`, `blueprint_review_scope`, and `blueprint_review_record`
- keep `audit-fix` routed through `blueprint_phase_locate`, `blueprint_artifact_list`, `blueprint_review_scope`, `blueprint_artifact_report_write`, `blueprint_artifact_mutate_index`, and `blueprint_state_update`
- keep `secure-phase` routed through `blueprint_phase_locate`, `blueprint_artifact_list`, `blueprint_phase_plan_index`, `blueprint_phase_plan_read`, `blueprint_artifact_contract_read`, and `blueprint_review_record`
- keep `ui-review` routed through `blueprint_phase_locate`, `blueprint_artifact_list`, and `blueprint_review_record`
- keep `docs-update` routed through its evidence-backed docs-report substrate
- keep `note` routed through `blueprint_artifact_mutate_index`
- keep `add-todo` routed through `blueprint_artifact_mutate_index`
- keep `check-todos` routed through `blueprint_project_status` plus `blueprint_artifact_mutate_index` list and update actions
- keep `add-backlog` routed through `blueprint_artifact_mutate_index` plus optional stub scaffolding
- keep command-catalog rollout aligned with each shipped Wave 3, Wave 4, and Wave 5 command, including `note`, `add-todo`, `check-todos`, `add-backlog`, `review-backlog`, `explore`, `fast`, `quick`, `debug`, `docs-update`, `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `review`, `ui-review`, `add-tests`, `pr-branch`, `ship`, `new-workspace`, `remove-workspace`, `workstreams`, `cleanup`, `reapply-patches`, and `update`
- `remove-workspace` shipped on 2026-04-23 on top of `blueprint_workspace_registry_get`, `blueprint_workspace_remove`, the `blueprint-maintenance` skill, and host-global workspace registry teardown with transactional rollback plus renewable lock protection
- `workstreams` shipped on 2026-04-23 on top of `blueprint_workstream_list`, `blueprint_workstream_mutate`, the `blueprint-maintenance` skill, and project-local `.blueprint/workstreams/` state with resume patches routed through `blueprint_state_update`
- `workstreams` hardening closed later on 2026-04-23: rollback now removes newly created workstream directories on failed writes, malformed or unreadable `STATE.md` snapshots now block `create`, `switch`, `resume`, and active `complete` with `missing-resume-snapshot`, and malformed canonical timestamp fields in `.blueprint/workstreams/<slug>/state.json` now surface `corrupt-workstream-index` instead of being normalized away
- keep regression coverage in place so the closed drift and discovery guarantees fail fast if they drift
- keep the new shared security helper wired into future MCP persistence paths instead of reintroducing local path, parse, or prompt-boundary logic
- keep high-risk maintenance specs and skills aligned around explicit resolved-target and report-before-mutate preflights
- keep `new-workspace` aligned with its host-global registry contract, transactional workspace bootstrap path, and implemented-only routing guarantees

## Guardrail Snapshot

- Do not start by porting all legacy scripts directly
- Do not make hooks foundational to state transitions
- Do not mutate the installed extension directory from Blueprint commands
- Treat `update` as advisory only
- Treat high-risk commands like `undo`, `ship`, `new-workspace`, `remove-workspace`, `cleanup`, and `reapply-patches` as explicit-confirmation flows

## Session Notes

- The repo contains a buildable Gemini extension shell plus the shipped Wave 0, lifecycle, governance, and roadmap-admin command sets
- Runtime `skills/` and `agents/` surfaces now exist for the shipped Wave 0, capture, discovery, planning, execution, validation, review, docs, and roadmap-admin contracts
- The router/help/progress path must filter to commands whose catalog entry is `implemented`
- `map-codebase` now owns a seven-document codebase bundle: `STACK`, `ARCHITECTURE`, `STRUCTURE`, `CONVENTIONS`, `TESTING`, `INTEGRATIONS`, and `CONCERNS`
- Phase 2.1 drift recovery and Phase 2.2 future-contract drift repair both closed on 2026-04-11
- Phase 3 discovery is now implemented end-to-end with deterministic phase MCP tools, bounded researcher/UI agent contracts, and command-catalog/doc parity tests
- `/blu-new-project` now carries a richer Gemini-native bootstrap contract: deep thread-following questioning, saved-default-aware workflow preference capture, requirement and roadmap revision loops before the first persistent write, and a local `skills/blueprint-bootstrap/references/questioning.md` guide instead of bare scaffold-style prompting
- `/blu-new-project` now also leans on Gemini-native session helpers for long bootstrap runs: `update_topic` for stage narration, `write_todos` for visible progress, task-tracker tools for dependency-heavy bootstrap branches, and `get_internal_docs` for host-tool self-correction before relying on Gemini-specific behavior
- `/blu-new-project`, `/blu-discuss-phase`, `/blu-research-phase`, and `/blu-ui-phase` now prefer Gemini CLI's built-in `ask_user` dialog for one-question-at-a-time structured choices, confirmations, and explicit `view`/`skip`/`update` style decisions instead of dumping multi-question assistant paragraphs
- `research-phase` now uses validated MCP-owned research writes, explicit existing-research handling, and advisory hooks for read-before-edit, `.blueprint` write safety, and workflow drift
- `/blu-next` now ships as a read-only router on top of `blueprint_project_status`, `blueprint_state_load`, `blueprint_artifact_list`, and `blueprint_command_catalog`
- `/blu-pause-work` now persists a single canonical handoff at `.blueprint/reports/pause-work-latest.md` through MCP instead of relying on raw file writes or an automatic WIP commit, and `/blu-resume-work` restores the next safe implemented action from that handoff
- Canonical future-command ownership is `next` and `do` on `blueprint-router`, `pause-work` and `resume-work` on `blueprint-governance`, and `plan-milestone-gaps` on `blueprint-roadmap-admin`
- `ui-phase` keeps a single declared phase artifact: `XX-UI-SPEC.md`, which may hold either a UI contract or an explicit skip rationale
- `plan-phase` now uses `blueprint_phase_plan_index`, `blueprint_phase_plan_read`, and `blueprint_phase_plan_write` to persist real `XX-YY-PLAN.md` content
- `validate-phase` now uses `blueprint_phase_summary_index`, `blueprint_phase_summary_read`, `blueprint_phase_validation_read`, and `blueprint_phase_validation_write` to persist real `XX-VERIFICATION.md` content
- `add-tests` shipped on 2026-04-13 with a dedicated `/blu-add-tests` manifest, the shared `blueprint-phase-validation` skill, bounded `blueprint-executor` plus `blueprint-verifier` support, verification persistence through `blueprint_phase_validation_write`, and durable `.blueprint/reports/add-tests-<phase>.md` reporting through `blueprint_artifact_report_write`
- `note` now uses `blueprint_artifact_mutate_index` to append canonical note entries in `.blueprint/notes/NOTES.md`, detect duplicates deterministically, and keep note capture project-local instead of reintroducing global-note behavior
- `add-todo` now uses `blueprint_artifact_mutate_index` to append canonical todo entries in `.blueprint/todos/TODO.md`, detect duplicates deterministically, and keep todo capture project-local
- `check-todos` now uses `blueprint_project_status` plus `blueprint_artifact_mutate_index` list and update actions to inspect pending todos in `.blueprint/todos/TODO.md` and mark a single todo active or completed deterministically
- `add-backlog` now uses `blueprint_artifact_mutate_index` to append canonical parking-lot entries in `.blueprint/backlog/BACKLOG.md`, detect duplicates deterministically, and optionally reserve a `999.x` phase stub before scaffolding it
- `review-backlog` now uses `blueprint_roadmap_promote_backlog`, `blueprint_artifact_mutate_index`, and `blueprint_state_update` to preview backlog candidates, promote confirmed ideas into active roadmap phases, reuse reserved `999.x` stubs when present, and preserve backlog history through status transitions
- `explore` shipped on 2026-04-13 with a dedicated `/blu-explore` manifest, the shared `blueprint-capture` skill, safe project gating through `blueprint_project_status`, and explicit routing confirmation before persisting a note, todo, backlog item, or roadmap-ready idea
- `fast` shipped on 2026-04-13 with a dedicated `/blu-fast` manifest, the shared `blueprint-phase-execution` skill, no subagent or report-backed side path, and optional `STATE.md` refresh through `blueprint_state_update` only when Blueprint is initialized
- `quick` shipped on 2026-04-12 with a dedicated `/blu-quick` manifest, the shared `blueprint-phase-execution` skill, a canonical `.blueprint/reports/quick-run-latest.md` report, and implemented-only follow-up routing through `blueprint_command_catalog`
- `debug` shipped on 2026-04-13 with dedicated `/blu-debug` manifests, the `blueprint-debug` skill, the `blueprint-debugger` agent contract, a canonical `.blueprint/reports/debug-latest.md` report, and optional todo capture through `blueprint_artifact_mutate_index`
- `code-review` shipped on 2026-04-13 with a dedicated `/blu-code-review` manifest, the discoverable `blueprint-review` skill, the bounded `blueprint-reviewer` agent contract, deterministic scope resolution through `blueprint_review_scope`, and review persistence through `blueprint_review_record`
- `code-review-fix` shipped on 2026-04-13 with a dedicated `/blu-code-review-fix` manifest, the discoverable `blueprint-review` skill, saved review loading through `blueprint_review_load_findings`, durable remediation persistence through `blueprint_review_record`, and explicit follow-up routing through `blueprint_state_update`
- `audit-fix` shipped on 2026-04-13 with a dedicated `/blu-audit-fix` manifest, the discoverable `blueprint-review` skill, deterministic scope resolution through `blueprint_review_scope`, report-backed persistence through `blueprint_artifact_report_write`, optional todo capture through `blueprint_artifact_mutate_index`, and explicit follow-up routing through `blueprint_state_update`
- `secure-phase` now uses `blueprint_artifact_contract_read` plus `blueprint_review_record`, the discoverable `blueprint-review` skill, `skills/blueprint-review/references/secure-phase-runtime-contract.md`, and the `blueprint-security-auditor` contract to persist real `XX-SECURITY.md` content through a threat-register-shaped review contract
- `secure-phase` now also uses `blueprint_phase_plan_index` plus `blueprint_phase_plan_read` so the saved phase threat model is read from executed plan evidence before the audit is written
- `secure-phase` now treats the saved phase threat model as the bounded review scope, lets the user verify or explicitly accept open threats, and blocks advancement while any threat remains open
- `secure-phase` now incorporates execution-summary threat flags, preserves a sequential no-subagent fallback when the auditor is unavailable, and repairs rejected `review.security` writes once through MCP instead of hand-writing security artifacts
- `blueprint_review_record` now counts open security threats from the Threat Register as findings so security artifacts do not under-report risk when Findings stays empty
- shared runtime hardening now routes core path validation, JSON parsing, prompt-boundary checks, and hidden-control-character sanitization through `src/shared/security.ts`, with hooks reusing the same detector set for advisory parity
- `review` shipped on 2026-04-13 with a dedicated `/blu-review` manifest, the discoverable `blueprint-review` skill, plan inventory plus plan-read MCP grounding, and peer-review persistence through `blueprint_review_record` as `XX-REVIEWS.md`
- `ui-review` shipped on 2026-04-13 with a dedicated `/blu-ui-review` manifest, the discoverable `blueprint-review` skill, the bounded `blueprint-ui-auditor` agent contract, and UI audit persistence through `blueprint_review_record`
- `docs/build/WAVE-2-AGENT-WORKFLOW.md`, `docs/build/WAVE-2-PARALLEL-CLOSEOUT-PLAN.md`, and `docs/build/WAVE-2-AUTO-AGENT-META-PROMPT.md` now define the anti-drift closeout workflow for the next 1-to-3-agent cycles
- `docs-update` shipped on 2026-04-12 with a dedicated `blueprint-docs` skill, the `blueprint-doc-writer` and `blueprint-doc-verifier` agent contracts, a routable command manifest, and report persistence through `blueprint_artifact_report_write`
- `pr-branch` shipped on 2026-04-13 with a dedicated `/blu-pr-branch` manifest, the `blueprint-maintenance` skill, a canonical `.blueprint/reports/pr-branch-latest.md` report, and explicit git confirmation gates grounded in `blueprint_project_status`, `blueprint_config_get`, and `blueprint_artifact_summary_digest`
- `ship` shipped on 2026-04-13 with a dedicated `/blu-ship` manifest, the `blueprint-maintenance` skill, a canonical `.blueprint/reports/ship-latest.md` report, explicit push or PR confirmation gates, and manual fallback guidance when `gh` is missing or unauthenticated
- `undo` shipped on 2026-04-16 with a dedicated `/blu-undo` manifest, the `blueprint-maintenance` skill, a canonical `.blueprint/reports/undo-latest.md` report, explicit revert confirmation gates, dependency-impact previews grounded in `blueprint_artifact_list` plus `blueprint_artifact_summary_digest`, and a hard ban on destructive shortcuts such as `git reset --hard`
- `cleanup` shipped on 2026-04-13 with a dedicated `/blu-cleanup` manifest, the `blueprint-maintenance` skill, a canonical `.blueprint/reports/cleanup-latest.md` report, explicit archive or delete confirmation gates, and active-phase protection grounded in `blueprint_project_status`, `blueprint_roadmap_read`, and milestone closeout evidence
- `new-workspace` shipped on 2026-04-22 with a dedicated `/blu-new-workspace` manifest, the `blueprint-maintenance` skill, new `blueprint_workspace_registry_get` plus `blueprint_workspace_create` MCP tools, a host-global `~/.<host>/blueprint/workspaces.json` registry, a per-workspace `.blueprint-workspace.json` manifest, confirmation-gated workspace previews, effective-config workspace-root resolution, and transactional registry-plus-disk creation
- `remove-workspace` shipped on 2026-04-23 with a dedicated `/blu-remove-workspace` manifest, the `blueprint-maintenance` skill, new `blueprint_workspace_remove` MCP tooling, host-global registry-backed teardown previews, confirmation-gated workspace removal, and transactional rollback on manifest or registry drift
- `workstreams` hardening closed on 2026-04-23 with rollback for failed directory creation, explicit `missing-resume-snapshot` blocking for malformed saved `STATE.md` snapshots, and `corrupt-workstream-index` handling for malformed canonical timestamp fields
- `workstreams` shipped on 2026-04-23 with a dedicated `/blu-workstreams` manifest, the `blueprint-maintenance` skill, new `blueprint_workstream_list` plus `blueprint_workstream_mutate` MCP tools, project-local persistence under `.blueprint/workstreams/`, canonical `WORKSTREAMS.md` regeneration, and explicit active-stream confirmation gates
- `reapply-patches` shipped on 2026-04-22 with a dedicated `/blu-reapply-patches` manifest, the `blueprint-maintenance` skill, new `blueprint_patch_list`, `blueprint_patch_reapply`, and `blueprint_patch_record` MCP tools, a host-global `~/.<host>/blueprint/patches/` registry, explicit `preflight -> preview -> confirm -> replay -> record` flow control, and hard stops for dirty trees, malformed registry state, compatibility mismatches, missing patch targets, and installed-extension targets
- `update` shipped on 2026-04-22 with a dedicated `/blu-update` manifest, the `blueprint-maintenance` skill, new `blueprint_update_check` plus `blueprint_update_plan` MCP tools, host-global persistence under `~/.<host>/blueprint/updates/`, explicit `ask_user` versus manual-fallback mode gating, read-only extension-path handling, and restart guidance instead of any in-session self-update path
- the MCP server now appends failed mutation diagnostics to `.blueprint/mcp-write-failures.ndjson` before surfacing rejected write results or thrown mutating-tool errors, so schema failures and other legitimate write rejections remain debuggable after the model sees the failure
- milestone audit reports now persist structured `Requirement Gaps`, `Integration Gaps`, `Flow Gaps`, and `Optional Gaps` sections in addition to the summary `Gaps Found` section, and `blueprint_project_status` now prefers those structured sections when deciding whether `/blu-plan-milestone-gaps` is the next safe action
- `blueprint_roadmap_add_phase` now accepts audit-backed gap details for roadmap-admin follow-up phases, writes richer roadmap detail blocks instead of placeholder-only phase docs, and repairs affected `REQUIREMENTS.md` rows by resetting them to `pending` with idempotent reassignment notes for the new gap-closure phase
- Future sessions should treat the Wave 2 milestone-closeout trio plus `insert-phase`, `note`, `add-todo`, `check-todos`, `add-backlog`, `review-backlog`, `fast`, `quick`, `debug`, `docs-update`, `impact`, `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `review`, `ui-review`, `add-tests`, `pr-branch`, `ship`, `undo`, `new-workspace`, `remove-workspace`, `workstreams`, `cleanup`, `reapply-patches`, and `update` as shipped, and only start a new slice once its manifest, primary skill, and required MCP tools are planned together
