# Blueprint Artifact Schema

## Project Tree

Blueprint-managed repositories store project state here:

```text
.blueprint/
  PROJECT.md
  REQUIREMENTS.md
  ROADMAP.md
  STATE.md
  config.json
  mcp-write-failures.ndjson
  phases/
  reports/
  backlog/
  todos/
  notes/
  codebase/
  workstreams/
```

In shared docs, `~/.<host>/blueprint/` means `~/.gemini/blueprint/` on Gemini CLI and `~/.tabnine/blueprint/` on Tabnine CLI.

## Core Top-Level Artifacts

### `PROJECT.md`

Purpose:
- project intent
- milestone framing
- scope and product language

Minimum locked sections:
- vision
- audience
- constraints
- current milestone
- non-goals

### `REQUIREMENTS.md`

Purpose:
- canonical requirements list
- requirement identifiers used by phase plans and milestone audits
- durable traceability target for roadmap phases and verification artifacts

Minimum locked sections:
- requirements table
- requirement identifiers such as `REQ-*`
- traceability or mapping notes
- acceptance notes
- deferred items

### `ROADMAP.md`

Purpose:
- ordered phase list
- milestone grouping
- phase goals and dependencies

Minimum locked fields per phase:
- phase number
- phase name
- goal
- dependency note
- mapped requirements
- success criteria
- status
- optional inserted marker for urgent decimal phase detail blocks, written as `Inserted: yes`

Contract notes:
- `new-milestone` may rewrite `ROADMAP.md` for the next milestone, but it should preserve historical phase artifacts and continue numbering at the next whole-number phase instead of renumbering prior milestones.

### `STATE.md`

Purpose:
- current position in the workflow
- last successful command
- active phase / plan
- blockers
- next suggested action
- durable roadmap evolution notes when an urgent decimal phase is inserted after an integer anchor

Minimum locked fields:
- project status
- current milestone
- current phase
- active command
- blockers
- last updated

Optional durable section:
- roadmap evolution notes, recorded as bullets under `## Roadmap Evolution Notes` and preserved across `STATE.md` sync/update cycles

### `config.json`

Purpose:
- Blueprint runtime configuration for the repo
- persisted in normalized full form rather than as sparse overrides
- merged with optional user defaults from the host-global defaults file at `~/.<host>/blueprint/defaults.json`

Current normalized schema:

```json
{
  "version": 2,
  "mode": "interactive",
  "granularity": "standard",
  "model_profile": "balanced",
  "project_code": null,
  "phase_naming": "sequential",
  "response_language": null,
  "planning": {
    "commit_docs": true,
    "search_gitignored": false
  },
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true,
    "ui_phase": true,
    "ui_safety_gate": true,
    "code_review": true,
    "code_review_depth": "standard",
    "auto_advance": false,
    "research_before_questions": false,
    "discuss_mode": "discuss",
    "skip_discuss": false,
    "use_worktrees": true,
    "subagent_timeout": 300000
  },
  "parallelization": {
    "enabled": true,
    "plan_level": true,
    "task_level": false,
    "skip_checkpoints": true,
    "max_concurrent_agents": 3,
    "min_plans_for_parallel": 2
  },
  "git": {
    "branching_strategy": "none",
    "base_branch": null,
    "phase_branch_template": "blu/phase-{phase}-{slug}",
    "milestone_branch_template": "blu/{milestone}-{slug}",
    "quick_branch_template": null
  },
  "gates": {
    "confirm_project": true,
    "confirm_phases": true,
    "confirm_roadmap": true,
    "confirm_breakdown": true,
    "confirm_plan": true,
    "execute_next_plan": true,
    "issues_review": true,
    "confirm_transition": true
  },
  "safety": {
    "always_confirm_destructive": true,
    "always_confirm_external_services": true
  },
  "maintenance": {
    "patch_registry": "~/.<host>/blueprint/patches",
    "workspace_root": "~/blueprint-workspaces"
  },
  "agent_skills": {}
}
```

Normalization and precedence rules:
- Effective config precedence is hardcoded Blueprint defaults, then `~/.<host>/blueprint/defaults.json`, then `.blueprint/config.json`, then command flags.
- `.blueprint/config.json` is persisted in normalized object form for every section, including `parallelization`, even if legacy or shorthand input was accepted at the tool boundary.
- Repo config must not contain `workflow.use_workspaces`, `workflow.use_workstreams`, or repo-level `hooks.*` keys. Workspace and workstream behavior stays command-driven; hook activation stays extension-owned in `hooks/hooks.json`.
- `workflow.code_review` and `workflow.code_review_depth` are surfaced through `/blu-settings` and consumed by `/blu-code-review`; the review toggle should stay meaningful as a surfaced workflow setting, and the depth value is the default when the review command runs without an explicit `--depth`.
- `~/.<host>/blueprint/defaults.json` uses the same normalized schema shape for user defaults, but repo-identity fields should be omitted or left `null` when saving defaults.
- Health and config-write flows are responsible for migrating older minimal Blueprint config files forward to version `2`.
- Discovery runtime actively uses `workflow.discuss_mode`, `workflow.skip_discuss`, and `workflow.research_before_questions`. `workflow.auto_advance` remains a reserved compatibility field until a later lifecycle rollout makes it real.

### `mcp-write-failures.ndjson`

Purpose:
- append-only MCP-side diagnostics for failed Blueprint mutation attempts
- preserve rejected write inputs, structured validation failures, and thrown mutation errors before the failure reaches the model

Contract notes:
- stored as newline-delimited JSON under `.blueprint/mcp-write-failures.ndjson`
- written best-effort by the MCP server for mutating tools such as config, roadmap, phase, report, review, and capture writes
- entries include timestamp, tool name, sanitized request fields, and either a rejected result payload or thrown error metadata
- this is an operational debug log rather than a workflow artifact that commands should edit directly

## Phase Tree

Each phase directory lives under `.blueprint/phases/<phase-slug>/`.

Canonical source-of-truth note:
- The runtime-owned contract registry under `src/mcp/artifact-contracts/` is the canonical source for scaffold templates, authoring templates, locked markers, required headings, and freehand policy.
- This document is the human-readable reference and should stay aligned with the runtime contract registry rather than competing with it.

Core phase artifacts:
- `XX-CONTEXT.md`
- `XX-RESEARCH.md`
- `XX-YY-PLAN.md`
- `XX-YY-SUMMARY.md`
- `XX-VERIFICATION.md`
- `XX-UAT.md`

Plan note:
- Phase plans may include optional `gap_closure: true` frontmatter to mark explicit gap-closure targets for `/blu-execute-phase --gaps-only`; the runtime surfaces that signal in plan read/index metadata instead of inferring it from missing summaries.

Auxiliary phase artifacts:
- `XX-DISCUSSION-LOG.md`
- `XX-DISCUSS-CHECKPOINT.json` (temporary resumability state for `discuss-phase`; should be deleted after successful context capture)
- `XX-REVIEW.md`
- `XX-REVIEW-FIX.md`
- `XX-REVIEWS.md`
- `XX-SECURITY.md`
- `XX-UI-SPEC.md` (used for either a UI design contract or an explicit rationale that UI work was intentionally skipped)
- `XX-UI-REVIEW.md`

### `XX-CONTEXT.md`

`XX-CONTEXT.md` is the durable discuss-phase context artifact for a single phase.

Validation expectations:
- must start with an H1 title
- must not persist scaffold placeholders such as `Goal:`, `Project brief:`, or `Question 1:`
- must populate the richer discuss-phase contract sections from `Phase Boundary`, `Discovery Grounding`, `Dependencies`, `Open Questions`, `Deferred Ideas`, and `Canonical References`
- a context file with only `## Decisions` no longer satisfies the contract

### `XX-DISCUSSION-LOG.md`

`XX-DISCUSSION-LOG.md` is the durable supporting log for discuss-phase notes and follow-ups.

Validation expectations:
- must start with an H1 title
- must not persist scaffold placeholders such as `Timestamped notes:` or `Follow-up 1:`
- must populate at least one contract section from `Summary`, `Notes`, or `Follow-Ups`
- missing contract sections are currently warnings, not hard failures

### `XX-UI-SPEC.md`

`XX-UI-SPEC.md` is the single durable UI artifact for either a real UI contract or an explicit skip rationale.

Validation expectations:
- must start with an H1 title
- must include a populated `## Outcome Mode`
- UI contract mode may use the full canonical section set from the runtime contract registry
- explicit skip mode must include a populated `## Rationale`
- scaffold placeholders such as `Goal 1:` or `Component 1:` are rejected on write

### `XX-YY-SUMMARY.md`

`XX-YY-SUMMARY.md` is the execution summary contract for a single plan.

Validation expectations:
- must start with an H1 title at the very top of the normalized artifact body
- must include populated `## Outcome`, `## Changes Made`, `## Verification`, `## Follow-Ups`, and `## Evidence`
- the locked `**Plan:**` and `**Status:**` markers remain required, but the scaffold placeholder values they carry are rejected by `blueprint_phase_summary_write`
- the `**Plan:**` marker must match the linked `XX-YY-PLAN.md` path for the summary to count as valid execution evidence
- scaffold-only placeholder text in `Changes Made`, `Verification`, `Follow-Ups`, and `Evidence` is rejected by `blueprint_phase_summary_write`

### `XX-DISCUSS-CHECKPOINT.json`

`XX-DISCUSS-CHECKPOINT.json` is temporary resumability state for `discuss-phase`.

Structured persistence expectations:
- top-level JSON value must be an object
- persisted checkpoints must include at least one resumability field such as `mode`, `pendingTopics`, `completedTopics`, `currentQuestion`, `answers`, `notes`, `resumeHint`, or `updatedAt`
- legacy object-shaped checkpoints may still be read for compatibility, but new writes should use the structured resumability shape

### `XX-RESEARCH.md`

`XX-RESEARCH.md` is the planner-facing research contract for a single phase.

Canonical template structure:
- `**Confidence:** LOW|MEDIUM|HIGH`
- `## Phase Requirements`
- `## Summary`
- `## Locked Decisions From Context`
- `## User Constraints`
- `## Standard Stack`
- `## Installation And Setup`
- `## Alternatives Considered`
- `## Architecture Patterns`
- `## Don't Hand-Roll`
- `## Anti-Patterns`
- `## State Of The Art`
- `## Common Pitfalls`
- `## Open Questions`
- `## Confidence Breakdown`
- `## Code Examples`
- `## Recommendations`
- `## Sources`

Validation expectations:
- recommendations should be prescriptive rather than descriptive
- sources must include a URL, repo path, or cited file reference
- scaffold-only placeholders are not considered valid completed research
- the canonical authoring template is MCP-owned and should be supplied to drafting before the final write step so the research body is shaped from the same contract throughout
- current validation keys off the canonical heading set and also requires the `## Phase Requirements` table to include at least one populated requirement row

Exact persistence template:

````md
# Phase XX: <Phase Name> - Research

**Researched:** <YYYY-MM-DD>
**Domain:** <research domain>
**Confidence:** LOW|MEDIUM|HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| <requirement-id> | <phase requirement> | <evidence-backed guidance> |

## Summary

- <key conclusion>

## Locked Decisions From Context

- <phase decision preserved from context>

## User Constraints

- <repo, product, or workflow constraint>

## Standard Stack

- <runtime, library, or shared repo pattern>

## Installation And Setup

- <installation or setup guidance>

## Alternatives Considered

- <alternative considered and tradeoff>

## Architecture Patterns

- <durable implementation pattern>

## Don't Hand-Roll

- <existing tool, helper, or platform feature>

## Anti-Patterns

- <anti-pattern detail or implementation to avoid>

## State Of The Art

- <current ecosystem or repo update>

## Common Pitfalls

- <failure mode or regression risk>

## Open Questions

- <open question that still needs an answer>

## Confidence Breakdown

| Topic | Confidence | Why |
|-------|------------|-----|
| <topic> | LOW|MEDIUM|HIGH | <evidence-backed confidence explanation> |

## Code Examples

```text
<short code or pseudocode example>
```

## Recommendations

- <prescriptive recommendation with tradeoffs>

## Sources

- <repo path, URL, or cited file reference> - why it matters
````

Contract notes:
- Keep the `**Confidence:**` marker exactly as written.
- Keep all required section names unchanged so `blueprint_phase_artifact_write` passes current research validation.
- Replace every angle-bracket placeholder before persisting the artifact through MCP.

### `XX-VERIFICATION.md`

`XX-VERIFICATION.md` is the phase-scoped validation contract for a completed phase.

Minimum expected structure:
- `**Coverage:**` brief summary of which summaries or plan slices were validated
- `## Validation Summary`
- `## Evidence Reviewed`
- `## Gaps Found`
- `## Suggested Repairs`
- `## Next Safe Action`

Validation expectations:
- must be grounded in the saved execution summaries for the phase
- should describe gaps and pass signals explicitly rather than only restating artifact content
- should be resumable by the next `validate-phase` run if the artifact already exists

### `XX-UAT.md`

`XX-UAT.md` is the phase-scoped conversational UAT contract for a completed phase.

Minimum expected structure:
- `**Status:** PASS|FAIL|PARTIAL`
- `**Resume State:** RESUMED|NEW|CONTINUED`
- `**Checkpoint:** <saved checkpoint path or none>`
- `## UAT Summary`
- `## Session State`
- `## Questions Asked`
- `## Observed Behavior`
- `## Unresolved Gaps`
- `## Follow-Up Fixes`
- `## Next Safe Action`

UAT expectations:
- must be grounded in the saved execution summaries for the phase
- should preserve resumable conversational state rather than acting like a one-shot transcript
- should be normalized to the canonical `phase.uat` authoring template before persistence
- should keep explicit follow-up fixes visible in the artifact instead of hiding them in chat history
- should be validated after write so schema drift or heading drift is caught before the next state update

### Milestone Report Contracts

The milestone command family now uses canonical report contracts before authoring or revising report artifacts:

- `report.milestone-audit` for `.blueprint/reports/milestone-audit-<milestone>.md`
- `report.milestone-complete` for `.blueprint/reports/milestone-complete-<milestone>.md`
- `report.milestone-summary` for `.blueprint/reports/milestone-summary-<milestone>.md`

Contract notes:
- Read the matching report contract before drafting or replacing the report so the persisted text stays aligned with the runtime template.
- `new-milestone` additionally reads `phase.context` before seeding the first context artifact for the next milestone.

Exact persistence template:

```md
# Phase XX: <Phase Name> - UAT

**Status:** PASS|FAIL|PARTIAL
**Resume State:** RESUMED|NEW|CONTINUED
**Checkpoint:** <saved checkpoint path or none>

## UAT Summary

- Concise user-facing result grounded in the saved summaries and verification artifact.

## Session State

- Resume source: <saved summary path, checkpoint, or none>
- Current session step: <what is being resumed now>
- Continuity notes: <what must remain stable between sessions>

## Questions Asked

- Question asked during the UAT pass, or `none`.

## Observed Behavior

- Observed behavior tied to saved summary evidence.

## Unresolved Gaps

- Explicit blocker, follow-up, or `none`.

## Follow-Up Fixes

- Explicit follow-up fix, acceptance note, or `none`.

## Next Safe Action

- `/blu-progress`
```

Contract notes:
- Keep the `**Status:**`, `**Resume State:**`, and `**Checkpoint:**` markers exactly as written.
- Keep all required section names unchanged so `blueprint_phase_validation_write` passes current validation.
- Reference at least one saved summary path or filename inside `## UAT Summary`, `## Session State`, or `## Observed Behavior`.
- Keep follow-up-fix captures explicit enough that the parent command can ask for confirmation before persistence.

### `XX-REVIEW-FIX.md`

`XX-REVIEW-FIX.md` is the phase-scoped remediation summary contract for review-driven follow-up work.

Canonical source-of-truth note:
- The runtime contract registry under `src/mcp/artifact-contracts/` is canonical. This section is the human-readable mirror of the `review.review-fix` contract and should stay aligned with it.
Minimum expected structure:
- `**Status:** APPLIED|PARTIAL|SKIPPED`
- `## Findings Addressed`
- `## Changes Made`
- `## Verification`
- `## Follow-Ups`
- `## Next Safe Action`

Review-fix expectations:
- must stay grounded in findings loaded from the saved `XX-REVIEW.md` baseline rather than a fresh prompt-only review
- should summarize only the selected remediation pass instead of restating every open issue in the phase
- should capture concrete verification evidence for applied changes and keep unresolved work explicit
- Blueprint-native review-fix behavior focuses on bounded remediation; it does not currently ship a real `blueprint-fixer` agent, atomic per-fix commits, or a GSD-style automated re-review loop.

Exact persistence template:

```md
# Phase XX: <Phase Name> - Review Fix

**Status:** APPLIED|PARTIAL|SKIPPED

## Findings Addressed

- Finding id or summary addressed in this remediation pass.

## Changes Made

- Concrete remediation completed.

## Verification

- Validation or test evidence for the applied fix, or `none`.

## Follow-Ups

- Remaining work, deferred item, or `none`.

## Next Safe Action

- /blu-progress
```

Contract notes:
- Keep the `**Status:**` marker exactly as written.
- Keep all required section names unchanged so `blueprint_review_record` continues to recognize the canonical review-fix artifact contract.
- `## Findings Addressed` is the locked heading for remediation scope; do not rename it to `Findings Fixed`, `Resolved Findings`, or similar variants.
- If this document and the runtime registry ever drift, follow `src/mcp/artifact-contracts/` and repair this doc to match.

### `XX-SECURITY.md`

`XX-SECURITY.md` is the phase-scoped security audit contract for a completed phase.

Minimum expected structure:
- `**Posture:** PASS|FOLLOW_UP|BLOCKED`
- `## Security Summary`
- `## Evidence Reviewed`
- `## Threat Register`
- `## Accepted Risks`
- `## Findings`
- `## Follow-Ups`
- `## Security Audit Trail`
- `## Next Safe Action`

Security audit expectations:
- must stay grounded in saved phase evidence, relevant code, or clearly cited repo references
- should distinguish confirmed mitigations from missing or partial controls, while keeping threat dispositions and accepted-risk handling explicit
- should keep the threat register or equivalent security disposition shape explicit instead of accepting scaffold-only placeholder markers as complete
- should require the `Threat Register`, `Accepted Risks`, and `Security Audit Trail` sections so the security artifact cannot collapse back into a generic findings-only review
- should treat `none` bullets as empty entries rather than real findings or follow-up items
- should call out suspicious artifact content or prompt-boundary issues explicitly when they materially affect trust in the saved evidence
- should keep explicit follow-up hardening work visible instead of burying it in chat history

### `XX-REVIEW.md`

`XX-REVIEW.md` is the phase-scoped code review contract for a completed phase.

Minimum expected structure:
- `**Verdict:** PASS|FOLLOW_UP|BLOCKED`
- `## Review Summary`
- `## Scope Reviewed`
- `## Evidence Reviewed`
- `## Positive Signals`
- `## Severity Summary`
- `## Findings`
- `## Follow-Ups`
- `## Next Safe Action`

Code review expectations:
- must stay grounded in saved phase evidence, relevant code, or clearly cited repo references
- severity summary must maintain machine-extractable counts for critical/high/medium/low/unknown counts
- findings must cite evidence and impact for each issue
- follow-up work should be explicit rather than buried in findings prose

## Supporting Trees

### `reports/`

Used for non-phase-specific outputs and command logs:

- milestone audit reports
- milestone completion reports
- milestone summaries
- pause / resume handoffs
- debug logs
- cleanup reports
- update and patch reports
- quick-task reports

### `reports/milestone-audit-<version>.md`

Purpose:
- durable audit report for `/blu-audit-milestone` before milestone archival
- evidence bridge between the original milestone intent and the completed phase set

Minimum locked sections:
- milestone identifier and original intent snapshot
- roadmap and phase evidence digest
- requirements traceability notes and repair candidates
- grouped gaps found under requirement, integration, flow, and optional sections
- archival blockers
- next safe action

Contract notes:
- `audit-milestone` owns this report and writes it through the documented Blueprint persistence flow, including `blueprint_artifact_report_write`.
- Replacing an existing audit report requires explicit confirmation.
- The report should stay project-local in `.blueprint/reports/` and not spill into unrelated repo files.
- The report should keep enough traceability detail for `/blu-plan-milestone-gaps` to convert grouped gaps into roadmap phases without re-running the audit.

### `reports/milestone-complete-<version>.md`

Purpose:
- durable closeout report for `/blu-complete-milestone`
- evidence bridge between the milestone audit and the final archival summary

Minimum locked sections:
- milestone identifier and closeout decision
- audit report used
- completion rationale and residual watch items
- next safe action

Contract notes:
- `complete-milestone` owns this report and writes it through `blueprint_artifact_report_write`.
- Replacing an existing completion report requires explicit confirmation.
- The report should stay project-local in `.blueprint/reports/`.

### `reports/milestone-summary-<version>.md`

Purpose:
- durable summary report for `/blu-milestone-summary`
- carry-forward input for `/blu-new-milestone`

Minimum locked sections:
- milestone identifier and scope summary
- source reports used
- shipped outcomes and deferred follow-ups
- recommended carry-forward context

Contract notes:
- `milestone-summary` owns this report and writes it through `blueprint_artifact_report_write`.
- `new-milestone` treats this report as the default carry-forward seed and only switches to a fresh reset after an explicit user choice.
- Replacing an existing milestone summary requires explicit confirmation.
- The report should stay project-local in `.blueprint/reports/`.

### `reports/audit-fix-<phase>.md`

Purpose:
- durable remediation report for `/blu-audit-fix`
- evidence-backed record of classification filters, bounded mutation outcome, and next safe routing

Canonical source-of-truth note:
- The runtime contract registry under `src/mcp/artifact-contracts/` is canonical. This section mirrors the `report.audit-fix` contract and should stay aligned with it.

Minimum locked sections:
- `## Evidence Used`
- `## Fix Scope`
- `## Changes Applied`
- `## Remaining Gaps`
- `## Next Safe Action`

Audit-fix report expectations:
- must stay evidence-first and cite saved review, security, verification, or UAT artifacts selected by `--source`
- should record `--severity`, `--max`, and `--dry-run` settings used for this run
- should capture stop-on-first-failure behavior when the capped mutation loop halts early
- should include verification outcome and commit traceability (`pre-fix HEAD`, created commit SHA(s), or `none`)
- should keep follow-up todo capture explicit when requested

Exact persistence template:

```md
# Audit Fix Report

## Evidence Used

- Saved evidence reviewed for this run.

## Fix Scope

- Selected source, severity, cap, and candidate scope.

## Changes Applied

- Applied fixes, dry-run classification output, or `none`.

## Remaining Gaps

- Remaining gap, stop reason, or `none`.

## Next Safe Action

- /blu-progress
```

Contract notes:
- Keep required section names unchanged so `blueprint_artifact_report_write` continues to recognize the canonical audit-fix report contract.
- Persist this report through `blueprint_artifact_report_write` with the bare report name `audit-fix-<phase>`; do not route through `blueprint_review_record`.
- Replacing an existing audit-fix report requires explicit confirmation.

### `reports/pause-work-latest.md`

Purpose:
- durable human-readable and machine-parseable pause handoff for the current Blueprint work context
- canonical resumability input for `resume-work`

Locked fields and sections:
- frontmatter keys:
  `report_type`, `schema_version`, `status`, `timestamp`, `project_status`, `current_milestone`, `current_phase`, `active_command`
- `## Current State`
- `## Completed Work`
- `## Remaining Work`
- `## Decisions`
- `## Blockers`
- `## Human Actions Pending`
- `## Modified Files`
- `## Blueprint Snapshot`
- `## Next Action`
- `## Context Notes`

Contract notes:
- `pause-work` owns this file and writes it only through MCP.
- Replacing an existing handoff requires explicit confirmation.
- The file should stay single-source-of-truth for the latest paused state rather than creating hidden sidecar state outside `.blueprint/`.

### `backlog/`

Current contents:
- `BACKLOG.md`

Contract notes:
- `BACKLOG.md` is the canonical parking-lot index for backlog ideas captured through MCP.
- Entries are stored as repeated markdown blocks with deterministic IDs such as `BACKLOG-001`.
- Backlog items may also reserve phase-style directories using `999.x` numbering when promotion readiness matters.
- Promotion keeps backlog history in place by updating row status instead of deleting reviewed items.

### `todos/`

Planned contents:
- `TODO.md`
- `DONE.md`

### `notes/`

Planned contents:
- `NOTES.md`

Notes are project-local in Blueprint v1 planning.

### `codebase/`

Current shipped bundle:
- `STACK.md`
- `ARCHITECTURE.md`
- `STRUCTURE.md`
- `CONVENTIONS.md`
- `TESTING.md`
- `INTEGRATIONS.md`
- `CONCERNS.md`

Contract notes:
- `map-codebase` keeps the same seven-artifact bundle even when the user asks for a focused deepening pass such as `api`, `auth`, or `mcp`.
- Focused mapping narrows evidence collection and section depth; it does not change the bundle shape or create a suffix-specific artifact family.
- Reuse versus refresh decisions stay confirmation-gated at the command layer, and the resulting bundle should be validated before it is treated as complete.

### `workstreams/`

Planned contents:
- `WORKSTREAMS.md`
- one subdirectory per workstream, with its own mini-state

## Global State Tree

Blueprint-global state lives here:

```text
~/.<host>/blueprint/
  defaults.json
  workspaces.json
  updates/
  patches/
```

Purpose:
- user-level defaults for new Blueprint projects
- workspace registry
- update metadata and last-known version info
- patch manifests for `reapply-patches`

## Commit Expectations

- `.blueprint/` is committed by default.
- Commands that mutate project state should update `.blueprint/` deterministically.
- Maintenance state and user defaults in `~/.<host>/blueprint/` are not project-tracked.
