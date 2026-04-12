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
  phases/
  reports/
  backlog/
  todos/
  notes/
  codebase/
  workstreams/
```

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

Contract notes:
- `new-milestone` may rewrite `ROADMAP.md` for the next milestone, but it should preserve historical phase artifacts and continue numbering at the next whole-number phase instead of renumbering prior milestones.

### `STATE.md`

Purpose:
- current position in the workflow
- last successful command
- active phase / plan
- blockers
- next suggested action

Minimum locked fields:
- project status
- current milestone
- current phase
- active command
- blockers
- last updated

### `config.json`

Purpose:
- Blueprint runtime configuration for the repo
- persisted in normalized full form rather than as sparse overrides
- merged with optional user defaults from `~/.gemini/blueprint/defaults.json`

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
    "patch_registry": "~/.gemini/blueprint/patches",
    "workspace_root": "~/blueprint-workspaces"
  },
  "agent_skills": {}
}
```

Normalization and precedence rules:
- Effective config precedence is hardcoded Blueprint defaults, then `~/.gemini/blueprint/defaults.json`, then `.blueprint/config.json`, then command flags.
- `.blueprint/config.json` is persisted in normalized object form for every section, including `parallelization`, even if legacy or shorthand input was accepted at the tool boundary.
- Repo config must not contain `workflow.use_workspaces`, `workflow.use_workstreams`, or repo-level `hooks.*` keys. Workspace and workstream behavior stays command-driven; hook activation stays extension-owned in `hooks/hooks.json`.
- `~/.gemini/blueprint/defaults.json` uses the same normalized schema shape for user defaults, but repo-identity fields should be omitted or left `null` when saving defaults.
- Health and config-write flows are responsible for migrating older minimal Blueprint config files forward to version `2`.
- Discovery runtime actively uses `workflow.discuss_mode`, `workflow.skip_discuss`, and `workflow.research_before_questions`. `workflow.auto_advance` remains a reserved compatibility field until a later lifecycle rollout makes it real.

## Phase Tree

Each phase directory lives under `.blueprint/phases/<phase-slug>/`.

Core phase artifacts:
- `XX-CONTEXT.md`
- `XX-RESEARCH.md`
- `XX-YY-PLAN.md`
- `XX-YY-SUMMARY.md`
- `XX-VERIFICATION.md`
- `XX-UAT.md`

Auxiliary phase artifacts:
- `XX-DISCUSSION-LOG.md`
- `XX-DISCUSS-CHECKPOINT.json` (temporary resumability state for `discuss-phase`; should be deleted after successful context capture)
- `XX-REVIEW.md`
- `XX-REVIEW-FIX.md`
- `XX-REVIEWS.md`
- `XX-SECURITY.md`
- `XX-UI-SPEC.md` (used for either a UI design contract or an explicit rationale that UI work was intentionally skipped)
- `XX-UI-REVIEW.md`

### `XX-RESEARCH.md`

`XX-RESEARCH.md` is the planner-facing research contract for a single phase.

Minimum required structure:
- `**Confidence:** LOW|MEDIUM|HIGH`
- `## Phase Requirements`
- `## Summary`
- `## User Constraints`
- `## Standard Stack`
- `## Architecture Patterns`
- `## Don't Hand-Roll`
- `## Common Pitfalls`
- `## Code Examples`
- `## Recommendations`
- `## Sources`

Validation expectations:
- recommendations should be prescriptive rather than descriptive
- sources must include a URL, repo path, or cited file reference
- scaffold-only placeholders are not considered valid completed research

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
- `## UAT Summary`
- `## Questions Asked`
- `## Observed Behavior`
- `## Unresolved Gaps`
- `## Follow-Up Fixes`
- `## Next Safe Action`

UAT expectations:
- must be grounded in the saved execution summaries for the phase
- should preserve resumable conversational state rather than acting like a one-shot transcript
- should keep explicit follow-up fixes visible in the artifact instead of hiding them in chat history

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
- durable audit report for `/blu:audit-milestone` before milestone archival
- evidence bridge between the original milestone intent and the completed phase set

Minimum locked sections:
- milestone identifier and original intent snapshot
- roadmap and phase evidence digest
- gaps found and archival blockers
- next safe action

Contract notes:
- `audit-milestone` owns this report and writes it through the documented Blueprint persistence flow, including `blueprint_artifact_report_write`.
- Replacing an existing audit report requires explicit confirmation.
- The report should stay project-local in `.blueprint/reports/` and not spill into unrelated repo files.

### `reports/milestone-complete-<version>.md`

Purpose:
- durable closeout report for `/blu:complete-milestone`
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
- durable summary report for `/blu:milestone-summary`
- carry-forward input for `/blu:new-milestone`

Minimum locked sections:
- milestone identifier and scope summary
- source reports used
- shipped outcomes and deferred follow-ups
- recommended carry-forward context

Contract notes:
- `milestone-summary` owns this report and writes it through `blueprint_artifact_report_write`.
- Replacing an existing milestone summary requires explicit confirmation.
- The report should stay project-local in `.blueprint/reports/`.

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

Planned contents:
- `BACKLOG.md`

Backlog items may also reserve phase-style directories using `999.x` numbering when promotion readiness matters.

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

### `workstreams/`

Planned contents:
- `WORKSTREAMS.md`
- one subdirectory per workstream, with its own mini-state

## Global State Tree

Blueprint-global state lives here:

```text
~/.gemini/blueprint/
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
- Maintenance state and user defaults in `~/.gemini/blueprint/` are not project-tracked.
