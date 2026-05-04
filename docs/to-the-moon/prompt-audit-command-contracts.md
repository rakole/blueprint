# Command Prompt Contract Audit

Date: 2026-05-04

Auditor: Subagent 1 - Command Prompt Contract Auditor

Scope: `commands/*.toml` prompt contracts only. This audit did not implement source fixes.

## Audit Criteria

Each command prompt was checked for whether it clearly states:

- Purpose and command identity.
- Inputs and argument semantics.
- Preconditions and stop conditions.
- MCP tools to use, including read and write ownership.
- Files or artifacts to read.
- Files or artifacts to write.
- Confirmation gates for overwrite, destructive, broad, or high-risk actions.
- Artifact contracts or model schemas to use before authoring.
- Expected final response.

## Executive Summary

Most command manifests are materially stronger than a loose slash-command prompt: all 54 manifests define a `description`, identify the command, and most include explicit MCP FQNs, stop paths, write boundaries, implemented-only routing, and final response requirements.

The main defects are concentrated rather than systemic:

1. `/blu-new-project` is too thin for a command-local contract. It delegates the required MCP tool set and artifact contract details to skill references instead of stating them in the manifest.
2. Several report-writing commands write known report families without first requiring the canonical report contract read, despite the runtime documenting those report contracts.
3. Reduced-ceremony mutation commands, especially `/blu-quick` and `/blu-debug`, are intentionally broad but do not pin repo file scope, dirty-tree posture, or verification expectations tightly enough in the manifest.
4. A few governance/config manifests have good flows but weaker tool-rule and final-response specificity than comparable high-risk commands.
5. The longest prompts are mostly precise, but several are dense enough that key gates are buried inside large steps rather than surfaced as checklist-grade contract clauses.

## High-Confidence Findings

### 1. `/blu-new-project` Does Not Name Its Required MCP Tools Or Artifact Contracts

Severity: High

Evidence:

- `commands/blu-new-project.toml:5` says the manifest is "a thin command envelope."
- `commands/blu-new-project.toml:13` says to "Use the required MCP tool set" declared by the skill package, but does not list the tools.
- `commands/blu-new-project.toml:27` and `commands/blu-new-project.toml:30` mention project-init/scaffold behavior without naming `mcp_blueprint_blueprint_project_init`, `mcp_blueprint_blueprint_artifact_contract_read`, `mcp_blueprint_blueprint_artifact_validate`, or any exact artifact IDs.
- The missing details exist elsewhere: `docs/commands/new-project.md:95` names `blueprint_project_init`, `docs/commands/new-project.md:111` requires bootstrap artifact contract reads, and `skills/blueprint-bootstrap/SKILL.md:69` lists `mcp_blueprint_blueprint_project_init`.

Why this matters:

The audit checklist requires the command prompt itself to make tool and artifact ownership clear. `/blu-new-project` is a bootstrap command that creates `.blueprint/PROJECT.md`, `.blueprint/REQUIREMENTS.md`, `.blueprint/ROADMAP.md`, `.blueprint/STATE.md`, config, and phase scaffolding. If a host or agent reads only the command manifest, the first-write path is under-specified.

Expected contract improvement:

The manifest should name the required MCP tools, the bootstrap artifact IDs (`bootstrap.project`, `bootstrap.requirements`, `bootstrap.roadmap`), the first persistent write, validation, overwrite gate, read set, write set, and final response in command-local terms.

### 2. Known Report Writers Skip Canonical Report Contract Reads

Severity: High

Evidence:

- `docs/MCP-TOOLS.md:241` says `blueprint_artifact_contract_read` returns canonical contracts for artifacts such as `report.debug`.
- `docs/MCP-TOOLS.md:311` says report-family commands should use `blueprint_artifact_contract_read` when a known Blueprint report shape exists.
- `src/mcp/artifact-contracts/index.ts:4447`, `src/mcp/artifact-contracts/index.ts:4462`, `src/mcp/artifact-contracts/index.ts:4478`, and `src/mcp/artifact-contracts/index.ts:4681` define contracts for `report.debug`, `report.quick-run`, `report.docs-update`, and `report.cleanup`.
- `commands/blu-debug.toml:23` writes `debug-latest` through `mcp_blueprint_blueprint_artifact_report_write`, but its tool rules at `commands/blu-debug.toml:30` do not include `mcp_blueprint_blueprint_artifact_contract_read`.
- `commands/blu-quick.toml:25` writes `quick-run-latest`, but `commands/blu-quick.toml:30` omits `mcp_blueprint_blueprint_artifact_contract_read`.
- `commands/blu-docs-update.toml:33` writes `docs-update-latest`, but `commands/blu-docs-update.toml:37` omits `mcp_blueprint_blueprint_artifact_contract_read`.
- `commands/blu-cleanup.toml:17` writes `cleanup-latest`, but `commands/blu-cleanup.toml:23` omits `mcp_blueprint_blueprint_artifact_contract_read`.

Why this matters:

These prompts ask the model to author durable reports, but they do not require reading the runtime-owned heading/schema authority before writing. That creates a drift path where report files can be syntactically accepted by `artifact_report_write` but semantically shallow, stale, or inconsistent with the canonical report contract.

Expected contract improvement:

Each known report writer should read the matching contract before drafting. Where a structured model exists, the manifest should also require authoring context and validation before report write.

### 3. `/blu-quick` Is Broad Enough To Mutate Repo Files Without Enough Scope Preflight

Severity: Medium-High

Evidence:

- `commands/blu-quick.toml:1` describes a "bounded repo task with reduced ceremony."
- `commands/blu-quick.toml:8` permits `blueprint-researcher`, `blueprint-planner`, `blueprint-executor`, and `blueprint-verifier` subagents for bounded quick-run scope.
- `commands/blu-quick.toml:19` says to stop if the request needs a saved phase plan or larger rollout, but the manifest does not require a dirty-tree check, exact file list preview, target file read list, or explicit verification command before mutation.
- `commands/blu-quick.toml:25` persists `quick-run-latest`, but without the report contract read noted above.
- `commands/blu-quick.toml:27` asks for a concise summary, but not a concrete changed-file list, command-output evidence, or "unable to verify" field.

Why this matters:

`quick` is intentionally the low-ceremony mutation path. That makes scope discipline more important, not less. Without an exact file-scope and verification preflight, it can blur into `/blu-execute-phase` or `/blu-plan-phase` behavior while still producing a durable report.

Expected contract improvement:

Require a resolved repo mutation scope before editing, name dirty-tree behavior, list files to read/write when known, require a targeted verification plan or explicit "verification unavailable" reason, and read `report.quick-run` before writing the durable report.

### 4. `/blu-debug` Mixes Investigation, Optional Fix Routing, Report Persistence, And Todo Capture Without A Report Schema Gate

Severity: Medium-High

Evidence:

- `commands/blu-debug.toml:7` starts in `interactive-read` and escalates to `long-running-mutation`.
- `commands/blu-debug.toml:16` says to inspect relevant files, tests, logs, or prior debug report, but leaves the exact evidence/read contract open-ended.
- `commands/blu-debug.toml:22` says bounded fixes should route to `/blu-quick`, but the prompt still allows deeper investigation and subagent work before the route is clear.
- `commands/blu-debug.toml:23` writes `debug-latest` without first requiring the `report.debug` contract.
- `commands/blu-debug.toml:25` permits todo capture after confirmation, but there is no separate artifact contract or authoring context for the debug report.

Why this matters:

Debugging naturally expands. The prompt does include good stop/reroute language, but the report contract and evidence scope should be as explicit as the investigation path. Otherwise debug reports may record conclusions without consistent reproduction, confidence, evidence, and next-action sections.

Expected contract improvement:

Require `mcp_blueprint_blueprint_artifact_contract_read` for `report.debug`, define minimum evidence fields, require an explicit reproduction or "not reproduced" result, and keep fix attempts fully outside this command unless the user routes to `/blu-quick`.

### 5. `/blu-health` And Config Commands Are Less Explicit About Tool Allow-Lists And Final Repair Summaries

Severity: Medium

Evidence:

- `commands/blu-health.toml:9-19` lists concrete reads and repair writes, but unlike most mature manifests it has no final "Use only ..." tool allow-list.
- `commands/blu-health.toml:15` says read-only mode stops after diagnosis, and `commands/blu-health.toml:16-18` describes repair writes, but there is no explicit post-repair final response shape.
- `commands/blu-settings.toml:37-38` permits project and host-global defaults writes through `mcp_blueprint_blueprint_config_set`, but there is no explicit allowed write boundary bullet comparable to high-risk commands.
- `commands/blu-set-profile.toml:14-15` is stricter for a single profile mutation and explicitly forbids defaults writes, making the broader settings prompt look under-specified by comparison.

Why this matters:

Health and settings touch config/state surfaces that are foundational. The prompt behavior is mostly safe, but it should be as explicit as high-risk maintenance commands about the exact MCP tool set, host-global defaults gate, post-write validation/re-read, and final response fields.

Expected contract improvement:

Add explicit tool allow-lists, read/write boundaries, post-repair or post-save validation/re-read expectations, and final response fields for diagnosis, repaired keys, unchanged state, paths, warnings, and next safe action.

### 6. Dense Long Prompts Hide Important Gates In Large Sentences

Severity: Medium

Evidence:

- `commands/blu-add-tests.toml:20` packs a large multi-tool read set and many reasons into one numbered step.
- `commands/blu-secure-phase.toml:33` lists the entire `review.security` model field set plus sentinel/status rules in one step.
- `commands/blu-review.toml:44` lists 11 MCP tools in one response-requirements bullet.
- `commands/blu-map-codebase.toml:35-36` embeds the seven codebase artifact path list inline.

Why this matters:

These prompts are precise, not vague. The risk is operator miss: a model can satisfy the early half of a dense instruction and miss a later gate, especially when the same line covers reads, schema authority, evidence, and final routing.

Expected contract improvement:

For the longest commands, split the manifest into visibly separate "Required MCP reads", "Required MCP writes", "Artifact contracts", "Confirmation gates", and "Final response" bullets. Keep detailed richness rules in runtime references, but make the command-local checklist skimmable.

## Command-By-Command Notes

| Command manifest | Verdict | Notes |
|---|---|---|
| `commands/blu.toml` | Strong | Clear router purpose, project status/catalog/config reads, implemented-only routing, and no hidden aliases. No writes expected. |
| `commands/blu-add-backlog.toml` | Adequate | Clear append/reserve behavior, confirmation for phase reservation, index/scaffold/state tools, and write paths. |
| `commands/blu-add-phase.toml` | Adequate | Clear roadmap read, confirmation, add-phase/scaffold/state tools, and route. |
| `commands/blu-add-tests.toml` | Strong but dense | Excellent gates and schema-backed report flow; longest read step is hard to scan. |
| `commands/blu-add-todo.toml` | Strong | Narrow input, duplicate stop, single index tool, final response. |
| `commands/blu-audit-fix.toml` | Strong | Good source/severity/max arguments, schema-first report model, confirmation, and bounded mutation loop. |
| `commands/blu-audit-milestone.toml` | Strong | Evidence-backed report flow with contract read, digest, and no code/git mutation. |
| `commands/blu-check-todos.toml` | Adequate | Clear list/select/complete behavior and index/state tools. |
| `commands/blu-cleanup.toml` | Gap | Strong destructive gates, but writes a known `report.cleanup` without requiring `artifact_contract_read`. |
| `commands/blu-code-review-fix.toml` | Strong | Clear saved findings source of truth, selection gate, model-only review-fix persistence. |
| `commands/blu-code-review.toml` | Strong | Clear review scope tool, explicit file-scope constraints, model-only persistence. |
| `commands/blu-complete-milestone.toml` | Strong | Requires ready audit evidence before completion and uses report contract. |
| `commands/blu-debug.toml` | Gap | Broad investigation path and report write lack canonical `report.debug` contract read and minimum evidence schema. |
| `commands/blu-discuss-phase.toml` | Adequate with delegation | Tool list and gates are present, but much of the real flow lives in external references. |
| `commands/blu-docs-update.toml` | Gap | Good doc-scope gates, but writes known `report.docs-update` without contract read. |
| `commands/blu-execute-phase.toml` | Strong | Clear target selection, plan/summary contracts, overwrite gate, summary write, validation, and no phase completion claim. |
| `commands/blu-explore.toml` | Adequate | Confirmation-gated routing into capture/backlog/roadmap paths and clear writes. |
| `commands/blu-fast.toml` | Adequate | Properly narrow no-subagent path; no report artifact expected. |
| `commands/blu-health.toml` | Gap | Solid repair flow, but no explicit command-local MCP allow-list or post-repair final summary shape. |
| `commands/blu-help.toml` | Strong | Read-only router guidance with implemented-only rule. |
| `commands/blu-impact.toml` | Strong | Purpose-built impact tools own scope, context, analysis, write, render, and no-source-mutation safety. |
| `commands/blu-insert-phase.toml` | Adequate | Clear decimal insertion flow, confirmation, scaffold/state writes. |
| `commands/blu-list-phase-assumptions.toml` | Strong | Read-only, phase resolution stop, five assumption areas, no hidden planning. |
| `commands/blu-map-codebase.toml` | Strong but dense | Good contract reads, seven-artifact bundle, overwrite gate, scoped writes. Dense path list could be extracted. |
| `commands/blu-milestone-summary.toml` | Strong | Uses saved closeout evidence and report contract. |
| `commands/blu-new-milestone.toml` | Adequate | Carry-forward and scaffold path are clear; depends on roadmap-admin runtime for detailed behavior. |
| `commands/blu-new-project.toml` | Gap | Too thin; does not command-locally list required MCP tools or artifact IDs. |
| `commands/blu-new-workspace.toml` | Strong | High-risk maintenance posture, exact preview, dirty-tree/conflict stops, confirmation, host-global registry boundary. |
| `commands/blu-next.toml` | Strong | Read-only implemented-command routing and waiting-state reporting. |
| `commands/blu-note.toml` | Strong | Narrow note capture, duplicate stop, single index tool, no global-note behavior. |
| `commands/blu-pause-work.toml` | Adequate | Clear handoff fields, overwrite gate, pause write/state update. Could add canonical report contract if one exists. |
| `commands/blu-plan-milestone-gaps.toml` | Adequate | Reads latest audit, requires approval before roadmap mutation, no code/git mutation. |
| `commands/blu-plan-phase.toml` | Strong | Schema-first plan authoring, config gates, overwrite/reuse gate, model validation, state sync. |
| `commands/blu-pr-branch.toml` | Strong | Good git preflight, commit classification ledger, confirmation, report contract, validation. |
| `commands/blu-progress.toml` | Strong | Read-only status/config/state/artifact/catalog guidance with implemented-only routing. |
| `commands/blu-quick.toml` | Gap | Useful routing and report/state persistence, but broad repo mutation lacks exact scope/dirty-tree/verification preflight and report contract read. |
| `commands/blu-reapply-patches.toml` | Strong | Dry-run preview, dirty/incompatible stops, confirmation, installed-extension guard, host-global patch boundary. |
| `commands/blu-remove-phase.toml` | Adequate | Confirmation-gated roadmap/phase mutation; route and write boundaries are clear. |
| `commands/blu-remove-workspace.toml` | Strong | Exact teardown preview, dirty-tree/registry-drift stops, structured confirmation, registry boundary. |
| `commands/blu-research-phase.toml` | Strong | Phase/context stop, config-aware external source gate, contract read, checkpoint ownership, state sync. |
| `commands/blu-resume-work.toml` | Adequate | Good handoff/state flow, state-only write boundary. |
| `commands/blu-review-backlog.toml` | Adequate | Preview-first promotion, per-item confirmation, index/state writes. |
| `commands/blu-review.toml` | Strong but dense | Good reviewer availability, model-only peer-review persistence, no fabricated reviewer coverage. Dense tool list. |
| `commands/blu-secure-phase.toml` | Strong but dense | Good threat-register-bounded model-only flow and open-threat stop. Dense schema/status instruction. |
| `commands/blu-set-profile.toml` | Adequate | Strong single-setting mutation guard; would benefit from explicit invalid-profile stop behavior beyond argument contract. |
| `commands/blu-settings.toml` | Watch | Good config flow and defaults gate, but write boundaries/tool allow-list are less explicit than high-risk commands. |
| `commands/blu-ship.toml` | Strong | Report-before-remote-mutate, contract read, push/PR confirmation, fallback guidance. |
| `commands/blu-ui-phase.toml` | Strong but dense | Good config gates, UI contract read, overwrite/skip rationale gates, single artifact output. |
| `commands/blu-ui-review.toml` | Strong | Uses UI-review runtime contract, model/schema authority, no planned follow-ups. |
| `commands/blu-undo.toml` | Strong | High-risk git revert preview, contract read, report-before-mutate, destructive-command exclusions. |
| `commands/blu-update.toml` | Strong | Advisory-only update behavior, installed-extension no-write guard, host-global update plan boundary. |
| `commands/blu-validate-phase.toml` | Strong | Saved-summary-first, verification contract, model-only persistence, overwrite and UAT gates. |
| `commands/blu-verify-work.toml` | Strong | UAT readiness, resumability, model validation/write, overwrite/checkpoint gates. |
| `commands/blu-workstreams.toml` | Strong | Read/list first, explicit operation/target requirements, switch/complete confirmations, workstream state ownership. |

## Positive Patterns To Preserve

- Router commands consistently enforce implemented-only guidance: see `commands/blu.toml:13`, `commands/blu-help.toml:21`, `commands/blu-progress.toml:26`, and `commands/blu-next.toml:24`.
- High-risk maintenance commands consistently preview exact mutation plans before action: `commands/blu-new-workspace.toml:15`, `commands/blu-remove-workspace.toml:14`, `commands/blu-undo.toml:22`, `commands/blu-ship.toml:18`, and `commands/blu-reapply-patches.toml:21`.
- Phase lifecycle commands increasingly use schema/model-first persistence instead of raw Markdown writes: `commands/blu-plan-phase.toml:35`, `commands/blu-execute-phase.toml:19-20`, `commands/blu-validate-phase.toml:26-28`, and `commands/blu-code-review.toml:30-32`.
- Several prompts explicitly prevent session-local helpers from becoming persistence channels, for example `commands/blu-add-tests.toml:10`, `commands/blu-ship.toml:33`, and `commands/blu-secure-phase.toml:55`.

## Recommended Repair Order

1. Fix `/blu-new-project` first because it owns the initial state tree and is the clearest command-local contract gap.
2. Add canonical report contract reads to `/blu-debug`, `/blu-quick`, `/blu-docs-update`, and `/blu-cleanup`.
3. Tighten `/blu-quick` and `/blu-debug` around exact repo mutation/evidence scope, dirty-tree posture, and verification reporting.
4. Normalize `/blu-health` and `/blu-settings` to the mature manifest shape: explicit tool allow-list, write boundary, post-write re-read/validation, and final response.
5. Refactor dense long prompts into skimmable command-local checklists while leaving detailed richness rules in skill runtime references.
