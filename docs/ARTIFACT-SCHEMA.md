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

Minimum locked sections:
- requirements table
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
- status

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

Planned schema:

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
- `XX-REVIEW.md`
- `XX-REVIEW-FIX.md`
- `XX-REVIEWS.md`
- `XX-SECURITY.md`
- `XX-UI-SPEC.md`
- `XX-UI-REVIEW.md`

## Supporting Trees

### `reports/`

Used for non-phase-specific outputs and command logs:

- milestone audit reports
- milestone summaries
- pause / resume handoffs
- debug logs
- cleanup reports
- update and patch reports
- quick-task reports

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

Planned contents:
- `STACK.md`
- `ARCHITECTURE.md`
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
