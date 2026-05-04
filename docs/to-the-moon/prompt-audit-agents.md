# Prompt Audit: Agents And Delegation

Date: 2026-05-04

Auditor: Subagent 3, Agent and Delegation Auditor

## Scope

Reviewed:

- `agents/*.md`
- agent architecture docs in `docs/SKILLS-AND-AGENTS.md`, `docs/ARCHITECTURE.md`, and related command specs
- command and skill references that invoke agents, especially lifecycle, review, docs, debug, mapping, quick, and maintenance flows

Allowed write scope for this audit was limited to this report under `docs/to-the-moon/`. No source fixes were made.

## Executive Summary

Blueprint's subagent model is directionally healthy: most agents are optional, bounded, evidence-first helpers, and the parent commands usually retain persistence, routing, confirmation, and MCP validation. The strongest contracts are `blueprint-executor`, `blueprint-planner`, `blueprint-verifier`, and `blueprint-reviewer`, which explicitly separate parent-owned orchestration from agent-owned analysis or implementation.

The main defects are contract drift and handoff ambiguity around newer review-family agents. `secure-phase` and `ui-review` now require schema-first MCP model persistence, but their auditors still hand back prose artifact drafts. `blueprint-reviewer` is reused for peer-review synthesis, review-fix reclassification, and audit-fix classification even though its concrete JSON output contract is written for `review.code-review`. `quick` can invoke four lifecycle agents without a quick-specific handoff schema, which makes a lightweight command look like a hidden phase lifecycle. Architecture docs also understate the shipped agent set.

## Findings

### A1. Security and UI auditor outputs do not match model-only command contracts

Severity: High

Evidence:

- `/blu-secure-phase` requires only structured `review.security` model fields and explicitly rejects Markdown fallback in `commands/blu-secure-phase.toml:33-36`.
- `docs/commands/secure-phase.md:84-88` repeats that `blueprint_review_validate_model` and `blueprint_review_record` must use the same structured model, and that hand-built `XX-SECURITY.md` content is invalid.
- `agents/blueprint-security-auditor.md:78-89` instead asks the auditor to return a posture plus "a concise artifact draft for `XX-SECURITY.md`".
- `/blu-ui-review` likewise requires a structured `review.ui-review` JSON model and says Markdown `content` is invalid in `commands/blu-ui-review.toml:23-24`.
- `skills/blueprint-review/references/ui-review-runtime-contract.md:94-100` says the parent must author the `review.ui-review` JSON model, persist through `blueprint_review_record`, and never hand-write `XX-UI-REVIEW.md`.
- `agents/blueprint-ui-auditor.md:98-119` asks for posture, pillar scores, findings, and "a concise artifact draft for `XX-UI-REVIEW.md`", not validated model fields.

Why it matters:

The parent command has to translate prose drafts into strict JSON models after the subagent returns. That creates a lossy handoff exactly where the runtime is trying to avoid Markdown fallback, schema drift, sentinel mistakes, threat-count errors, and score/evidence inconsistencies.

Recommendation:

Update these auditor contracts to return parent-schema-shaped data. For security, require the exact `review.security` fields listed by the command. For UI review, require the exact `review.ui-review` fields, six pillar score objects, visual-evidence posture, findings/follow-ups, audit trail, and next safe action. Keep optional rendered draft text secondary, not the primary handoff.

### A2. `blueprint-reviewer` is overloaded across incompatible review modes

Severity: High

Evidence:

- `agents/blueprint-reviewer.md:123-148` defines a concrete output contract for `review.code-review`: JSON fields `verdict`, `reviewSummary`, `positiveSignals`, `findings`, `evidenceCoverage`, `followUps`, and `nextSafeAction`.
- The same file warns that non-code-review reuse needs an explicit parent-provided output shape in `agents/blueprint-reviewer.md:37-39` and `agents/blueprint-reviewer.md:142-144`.
- `/blu-review` uses `blueprint-reviewer` for read-only packet and consensus/disagreement analysis, not code review findings, in `commands/blu-review.toml:6` and `commands/blu-review.toml:31`.
- The peer-review runtime contract says the reviewer may return packet-completeness issues, synthesis gaps, consensus/disagreement notes, risk posture, and an artifact draft in `skills/blueprint-review/references/review-runtime-contract.md:225-228`; that is not the `review.code-review` schema.
- `/blu-code-review-fix` uses `blueprint-reviewer` for saved-finding reclassification in `commands/blu-code-review-fix.toml:28-29`, while the runtime contract only says it may reclassify findings, flag stale evidence, and recommend selection/defer lists in `skills/blueprint-review/references/code-review-fix-runtime-contract.md:122-135`.
- `/blu-audit-fix` also uses `blueprint-reviewer` for classification in `commands/blu-audit-fix.toml:29`, and the runtime contract says it sorts issues into `auto-fixable`, `manual-only`, or `skip` in `skills/blueprint-review/references/audit-fix-runtime-contract.md:171-182`.

Why it matters:

This single agent now means at least four different things: code review, peer-review packet quality, review-fix triage, and audit-fix classification. The agent definition only fully specifies one of those shapes. Parent commands can still work sequentially, but the subagent path is under-specified and likely to produce outputs that need ad hoc interpretation.

Recommendation:

Either split the roles or add explicit mode contracts to `blueprint-reviewer`:

- `code-review` mode: current `review.code-review` JSON contract
- `peer-review-packet` mode: packet completeness, reviewer-output synthesis, consensus/disagreement rows
- `review-fix-triage` mode: saved finding id, disposition, confidence, reason, implicated files, minimal fix scope
- `audit-fix-classification` mode: source artifact, severity, `auto-fixable|manual-only|skip`, narrow verification, stale-evidence flag

The parent command should name the mode and required fields when delegating.

### A3. `quick` has a broad multi-agent path without quick-specific output contracts

Severity: Medium

Evidence:

- `/blu-quick` may use `blueprint-researcher`, `blueprint-planner`, `blueprint-executor`, and `blueprint-verifier` when the user asks for more depth in `commands/blu-quick.toml:5`.
- The command narrows those uses in `commands/blu-quick.toml:21-24`, but it does not define the handoff output shape for compact research, compact planning, quick implementation notes, or quick validation.
- `skills/blueprint-phase-execution/references/quick-runtime-contract.md:24-31` repeats the agent list and says they must stay inside quick-run scope, but its completion criteria at `skills/blueprint-phase-execution/references/quick-runtime-contract.md:45-51` only check boundedness, confirmation, session-local progress, MCP report persistence, and implemented routing.
- `blueprint-planner` is designed to return complete structured `phase.plan` JSON models in `agents/blueprint-planner.md:24-26` and `agents/blueprint-planner.md:104-137`.
- `blueprint-executor` is designed around one saved `XX-YY-PLAN.md` and summary-ready `XX-YY-SUMMARY.md` output in `agents/blueprint-executor.md:27-31`, `agents/blueprint-executor.md:51-65`, and `agents/blueprint-executor.md:135-170`.
- `blueprint-verifier` is designed around saved phase summaries, validation/UAT artifacts, add-tests review, or audit-fix verification in `agents/blueprint-verifier.md:27-33` and `agents/blueprint-verifier.md:53-97`.

Why it matters:

The quick command is meant to be bounded and lower ceremony, but it borrows agents whose contracts assume durable phase artifacts. Without quick-mode handoff schemas, agents may return phase-plan models, phase summaries, or validation drafts that the quick report cannot persist directly.

Recommendation:

Keep quick's no-subagent path as the default and add explicit quick-mode output contracts before using each lifecycle agent. For example: `QuickResearchMemo`, `QuickChecklist`, `QuickExecutionNotes`, and `QuickValidationNotes`, all targeted at `.blueprint/reports/quick-run-latest.md` rather than phase artifacts. If that feels too heavy, remove planner/verifier from quick and route deeper requests to lifecycle commands.

### A4. Debugger promises reproduction work but has no execution capability and no shell-request schema

Severity: Medium

Evidence:

- `/blu-debug` says to use `blueprint-debugger` for "reproducing a failing test or command" and "gathering log, stack trace, or config evidence" in `commands/blu-debug.toml:17-21`.
- The runtime reference says the debugger is for bounded hypothesis testing, reproduction, log review, and diagnosis in `skills/blueprint-debug/references/debug-runtime-contract.md:88-93`.
- `agents/blueprint-debugger.md:13-18` lists only read/search tools, no `run_shell_command`.
- The debugger protocol says when command or test reproduction is needed, it should ask the parent for the exact bounded shell step in `agents/blueprint-debugger.md:45-46`.
- Its required output sections in `agents/blueprint-debugger.md:56-70` do not include a structured "requested shell step", "parent evidence needed", or "reproduction blocked" field.

Why it matters:

The design can be safe: the parent owns shell execution. But the handoff is weak. A debugger asked to reproduce cannot actually reproduce, and the output contract does not force it to hand back a bounded command request with rationale, expected signal, and safety notes.

Recommendation:

Either give the debugger a tightly scoped shell tool with the same isolation rules as `blueprint-executor`, or keep it read-only and add a required `## Parent Action Needed` / `## Repro Command Request` section with command, cwd, expected output, failure signal, and why the step is safe.

### A5. `blueprint-mapper` allows delegated persistence that its frontmatter tools cannot perform

Severity: Medium

Evidence:

- `agents/blueprint-mapper.md:88-91` says if the parent delegates persistence and Blueprint MCP tools are available, the mapper should persist through `mcp_blueprint_blueprint_codebase_artifact_write`; otherwise it should return drafts to the parent.
- The mapper frontmatter only lists local read/search tools in `agents/blueprint-mapper.md:11-16`; it does not list write tools or Blueprint MCP tools.
- The map command itself keeps persistence on MCP rails and says to use code-analysis subagents only for mapper lanes in `commands/blu-map-codebase.toml:41-43`.

Why it matters:

The agent's safest actual role is draft-only analysis, but the contract suggests a write-owning mode that is not represented in the agent's tool capability. That can confuse parent prompts into delegating persistence the subagent cannot execute, or into expecting `.blueprint/codebase/` writes from a subagent lane.

Recommendation:

Make the mapper explicitly read-only/draft-only unless the host's subagent tool manifest actually exposes the Blueprint MCP write tool. If write delegation is retained, list the required MCP tool capability in frontmatter or a capability gate and require the parent to pass the canonical contract and target artifact id.

### A6. UI review lacks a visual-evidence capture agent or strict visual-input gate

Severity: Medium

Evidence:

- `blueprint-ui-auditor` is described as checking shipped UI against UI specs, interaction states, responsiveness, and prior UI audits in `agents/blueprint-ui-auditor.md:4-9`.
- Its tools are only `list_directory`, `read_file`, `glob`, and `grep_search` in `agents/blueprint-ui-auditor.md:11-16`.
- The auditor must still score visual hierarchy, color, typography, spacing, and experience design in `agents/blueprint-ui-auditor.md:98-113`.
- The command docs correctly say that if screenshot or visual-runtime evidence is unavailable, the audit must be recorded as code/static-evidence-only and avoid claims requiring visual inspection in `docs/commands/ui-review.md:76-86`.

Why it matters:

The fallback is honest, but the shipped agent set has no bounded visual-inspection helper. For frontend-heavy phases, static grep/read evidence is not enough to support a high-confidence six-pillar UI audit, especially around spacing, hierarchy, responsiveness, overflow, and visual polish.

Recommendation:

Add a required visual-evidence input packet for `blueprint-ui-auditor` delegation, or introduce a separate capability-gated visual inspector that can consume screenshots/recordings supplied by the parent. Keep browser-only substitutes rejected unless the command explicitly owns a safe visual-capture flow and labels that evidence as captured.

### A7. Architecture docs under-report the shipped agent surface

Severity: Low

Evidence:

- `docs/SKILLS-AND-AGENTS.md:33-47` lists fifteen shipped agent contracts, including debug, review, security, UI audit, and docs agents.
- `docs/ARCHITECTURE.md:91-94` says the shipped contracts cover only project research, roadmapping, mapping, research, UI design, planning, checking, execution, and verification.
- The architecture doc also says planned later runtime surfaces include "extra agent contracts for review, docs, debugging, UI audit, and security audit" in `docs/ARCHITECTURE.md:65-67`, even though those agent files exist and are listed as shipped elsewhere.

Why it matters:

This drift makes it harder for command authors to know which agent contracts are current and which are planned-only. It also weakens the implemented-only mental model: users see shipped command docs invoking agents that architecture still treats as future.

Recommendation:

Refresh `docs/ARCHITECTURE.md` to match `docs/SKILLS-AND-AGENTS.md` and the current `agents/*.md` inventory.

## Positive Signals

- Parent-command ownership is consistently emphasized. Examples: `blueprint-planner` leaves MCP writes and routing to the parent in `agents/blueprint-planner.md:28-36`; `blueprint-executor` leaves phase selection, wave ordering, summary persistence, and Blueprint state updates to the parent in `agents/blueprint-executor.md:33-49`; `blueprint-verifier` leaves user responses, validation-state writes, and final routing to the parent in `agents/blueprint-verifier.md:35-51`.
- The execution agent is properly bounded for mutation. It requires explicit write ownership, keeps edits inside assigned boundaries, rereads `Read First` paths, uses shell only for bounded verification, and reports partial/blocked states honestly in `agents/blueprint-executor.md:67-113` and `agents/blueprint-executor.md:126-170`.
- Code review has a strong scope boundary. `blueprint-reviewer` treats `blueprint_review_scope.files` as authoritative, refuses to widen scope, and has depth-aware review expectations in `agents/blueprint-reviewer.md:41-74`.
- Research agents are correctly evidence-gated. `blueprint-researcher` separates repo evidence, locked docs, parent-supplied official/external evidence, and inference; it also refuses to fetch official docs itself without parent-supplied provenance in `agents/blueprint-researcher.md:36-72`.
- Many command docs reject browser/web/search-only/generic agents as substitutes for Blueprint code/workflow agents, which keeps delegation quality from silently degrading.

## Missing Or Underdeveloped Agent Types

- `blueprint-fixer` is intentionally planned-only and non-routable in `docs/SKILLS-AND-AGENTS.md:49-55`. That is safe today, but review-fix and audit-fix should continue to avoid implying an auto-fixer exists.
- A visual evidence helper is missing for UI review. The current UI auditor can consume supplied evidence but cannot capture runtime screenshots itself.
- A dedicated review-triage/classifier agent may be warranted if `blueprint-reviewer` keeps serving code-review, peer-review synthesis, review-fix triage, and audit-fix classification.
- A maintenance risk-review agent is not shipped. `pr-branch` has a vague capability-gated "suitable code-analysis subagent" sidecar in `skills/blueprint-maintenance/references/pr-branch-runtime-contract.md:78-83`, while `docs/SKILLS-AND-AGENTS.md:86` says `pr-branch` uses no dedicated subagents. That default is safe, but the optional sidecar should either be named or removed.

## Overall Assessment

Subagents are generally used for the right categories of work: bounded deep work, research, code review, repo mapping, planning, validation, and scoped implementation. The weakest area is not "wrong agent for wrong job"; it is "right agent name, underspecified mode." Tightening mode-specific output schemas would remove most of the current risk without changing the overall architecture.
