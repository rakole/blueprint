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
  impact/
  reports/
  backlog/
  todos/
  notes/
  codebase/
  workstreams/
```

Blueprint does not create, own, or repair a repository-root `CONTEXT.md`.
Brownfield mapping persists only the canonical `.blueprint/codebase/*.md`
bundle. Phase-specific context lives only under
`.blueprint/phases/<phase>/<XX>-CONTEXT.md`; commands must not mirror it to the
repo root, infer it from a root context file, or treat root-level context files
as Blueprint-managed state.

## Bootstrap Readiness States

`blueprint_project_status` and related read tools use these project readiness states:

- `uninitialized`: no Blueprint workflow artifacts exist. A missing `.blueprint/` tree, an empty greenfield/scaffold-only `.blueprint/` root, or a root containing only operational diagnostics such as `mcp-write-failures.ndjson` all stay retryable. Brownfield repos in this state route to `/blu-map-codebase`; greenfield and scaffold-only repos route to `/blu-new-project`.
- `mapping-incomplete`: `.blueprint/` contains only an interrupted, missing, or invalid `.blueprint/codebase/` mapping bundle. This is an intentional codebase-only state and routes to `/blu-map-codebase`, not `/blu-health`.
- `mapped-only`: `.blueprint/` contains a valid seven-document `.blueprint/codebase/` bundle but no core project bootstrap artifacts. This is an intentional codebase-only state and routes to `/blu-new-project`; validation treats it as healthy.
- `partial`: core project bootstrap artifacts are broken or incomplete. This routes to `/blu-health`.
- `initialized`: core project bootstrap artifacts are present and normal workflow routing can continue.

In shared docs, `~/.<host>/blueprint/` means `~/.gemini/blueprint/` on Gemini CLI and `~/.tabnine/blueprint/` on Tabnine CLI.

## Read-Only MCP Resource Views

Blueprint's planned MCP resources are derived read views over existing runtime truth. The live command resources and planned future MCP resources follow that same model: they are not stored as separate files under `.blueprint/`, they do not replace any artifact in this schema, and they must never become write targets.

Locked resource URIs:

- `blueprint://commands/catalog`
- `blueprint://commands/<command>/runtime-contract`
- `blueprint://phases/<phase>/bundle`
- `blueprint://codebase/bundle`
- `blueprint://reports/latest`

Contract notes:

- `blueprint://commands/catalog` is a read-only projection of the retained command registry and its runtime availability metadata; it does not widen implemented-only exposure rules.
- `blueprint://commands/<command>/runtime-contract` is a read-only projection of one implemented command's locked runtime contract, derived from the command catalog plus the matching command spec and runtime-reference row.
- The same runtime-contract payload now also exposes the resolved `skillInputs` bundle for the invoking command as `{skill, shared, commandSpecific, effective}` so loaders can ground only the current command's inputs.
- `blueprint://phases/<phase>/bundle` is a read-only projection over saved Blueprint phase-grounding inputs such as `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, and the resolved phase artifact set for the requested phase.
- `blueprint://codebase/bundle` is a read-only projection over the saved seven-document `.blueprint/codebase/` bundle and its artifact-contract metadata.
- `blueprint://reports/latest` is a read-only projection over durable report inventory in `.blueprint/reports/`; it is an index view, not a report authoring path.
- Resource views are for discovery and grounding only. Writes remain on the existing MCP tool surface for config, roadmap, phase, report, review, and capture persistence.

## Structured Model Schema Assets

Some artifact contracts expose a `modelContract.schemaPath` pointing at a JSON Schema asset under `src/mcp/artifact-contracts/schemas/`. Bootstrap artifacts are Markdown-contract-backed unless the contract exposes a first-class `modelContract`; their `requiredHeadings`, `authoringTemplate`, placeholder signals, and notes remain the runtime authority. For `bootstrap.roadmap`, the base schema lives at `src/mcp/artifact-contracts/schemas/bootstrap.roadmap.model.schema.json`. The model contract is the canonical ROADMAP parity source for milestone, bootstrap status, requirement coverage, ordered phases, optional phase details, status vocabulary, dependencies, inserted markers, durable requirement IDs, and 2-5 success criteria per phase. The rendered `bootstrap.roadmap` headings are `Milestone`, `Bootstrap Status`, `Requirement Coverage`, `Phases`, optional `Phase Details`, and `Notes`; contract `requiredHeadings` covers the always-present headings while `modelContract.renderedHeadings` also records the optional detail heading used by roadmap-admin insert/add flows. For `phase.plan`, the base schema lives at `src/mcp/artifact-contracts/schemas/phase.plan.model.schema.json`; `blueprint_phase_plan_authoring_context` narrows that base schema at runtime with exact roadmap requirement ids, a dynamic saved-evidence inventory, and allowed dependency plan ids before `/blu-plan-phase` validates and writes the strict structured model. The rendered `phase.plan` headings are `Goal`, `Scope`, `Tasks`, `Verification`, `Must Haves`, `Requirement Coverage`, `Evidence Coverage`, `File / Surface Coverage`, and `Unknowns And Deferrals`; contract `requiredHeadings` and `modelContract.renderedHeadings` must stay in parity. In the `phase.plan` model, top-level `requirements` lists only the known requirements this specific plan covers now, while `requirementCoverage` accounts for every known phase requirement exactly once as covered, deferred, or irrelevant. Evidence coverage is runtime-narrowed and dynamic: after a successful plan write, saved plan files can become evidence artifacts for later plan slots, so agents must re-read `blueprint_phase_plan_authoring_context` before each validation/write. `phase.summary` is Markdown-first: `/blu-execute-phase` reads the Markdown contract and summary authoring context, validates draft `content` for semantic completion truth, and writes Markdown through `blueprint_phase_summary_write` instead of using a summary JSON schema. For `phase.verification`, the base schema lives at `src/mcp/artifact-contracts/schemas/phase.verification.model.schema.json`; `blueprint_phase_validation_authoring_context` narrows it with exact completed summary paths and allowed next actions before `/blu-validate-phase` validates and writes the model. The verification model contract is `1.1.0`: it includes both `status` and `gateState` with equality enforced, accepts `COVERED` plus lowercase `covered` for coverage rows and normalizes lowercase to `COVERED`, accepts scalar or array `validationSummary`, permits empty no-gap arrays only for passing gates, and preserves optional validation session state, checkpoint, test matrix, result counts, observed behavior, unresolved gaps, structured gaps, and follow-up fixes in rendered verification Markdown. For `phase.uat`, the base schema lives at `src/mcp/artifact-contracts/schemas/phase.uat.model.schema.json`; `blueprint_phase_validation_authoring_context` narrows it with exact completed summary paths, ready verification evidence, and allowed next actions before `/blu-verify-work` validates and writes the model. For `review.code-review`, the base schema lives at `src/mcp/artifact-contracts/schemas/review.code-review.model.schema.json`; `blueprint_review_scope` narrows it with scoped files, evidence keys, and allowed next actions before `/blu-code-review` validates and records the model. For `review.peer-review`, the base schema lives at `src/mcp/artifact-contracts/schemas/review.peer-review.model.schema.json`; `blueprint_review_authoring_context` narrows it with exact selected plan ids/paths, saved evidence keys, pending-plan state, and status-safe next actions before `/blu-review` validates and records the model. For `review.security`, the base schema lives at `src/mcp/artifact-contracts/schemas/review.security.model.schema.json`; the secure-phase task schema narrows it with live plan, summary, threat, prior-security, validation, UAT, and evidence inventory before `/blu-secure-phase` validates and records the model. For `report.add-tests`, the base schema lives at `src/mcp/artifact-contracts/schemas/report.add-tests.model.schema.json`; `blueprint_artifact_report_authoring_context` narrows it with exact completed summary paths, linked plan provenance, pending plan rows, dependency plan rows, validation/UAT evidence paths, and status-safe next actions before `/blu-add-tests` validates and writes the same model. For `report.impact`, the base schema lives at `src/mcp/artifact-contracts/schemas/report.impact.model.schema.json`; `blueprint_impact_report_write` narrows it with exact impact id, optional MCP-owned expected scope fingerprint/source/description, expected files, evidence ids and paths, finding ids, and blocking/warning finding projection ids before persisting the report bundle.

## Core Top-Level Artifacts

### `PROJECT.md`

Purpose:
- project intent
- milestone framing
- scope and product language

Minimum locked sections:
- `Vision`
- `Audience`
- `Constraints`
- `Current Milestone`
- `Bootstrap Shape`
- `Scope Posture`
- `Non-Goals`
- `Assumptions`

Contract notes:
- `PROJECT.md` is backed by the `bootstrap.project` Markdown artifact contract. Current bootstrap-shaped artifacts validate these exact headings, substantive required-section content, placeholder drift, and bootstrap traceability signals; older initialized legacy shells may remain compatible when they contain substantive project guidance. `PROJECT.md` does not expose a `modelContract` or separate JSON schema.

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
- phase goals, requirement coverage, and sequencing

Minimum locked fields per phase:
- phase number
- phase name
- goal
- mapped requirements
- success criteria
- status
- optional inserted marker for urgent decimal phase detail blocks, written as `Inserted: yes`

Contract notes:
- `bootstrap.roadmap` has a structured `modelContract` and JSON Schema. The model is the canonical contract for active milestone, bootstrap readiness, committed/deferred/out-of-scope requirement coverage, phase status vocabulary (`planned`, `in_progress`, `completed`, `done`), dependency phase numbers, decimal inserted phases, durable requirement IDs, optional phase detail blocks, and 2-5 success criteria per phase. Whole-number bootstrap phases should carry at least one durable requirement ID; inserted decimal phases may temporarily use empty requirement grounding until discovery assigns it.
- `requiredHeadings` remains the always-present Markdown surface; `modelContract.renderedHeadings` additionally includes optional `Phase Details` so schema-first authoring and roadmap-admin mutations share the same rendered ROADMAP vocabulary.
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
  "ux": {
    "progress_mode": "quiet",
    "structured_confirmations": "auto",
    "user_checkpoints": "off"
  },
  "orchestration": {
    "task_tracker": "off"
  },
  "research": {
    "external_sources": "off"
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
    "subagents": true,
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

Effectiveness-spine config extension notes:
- `ux.progress_mode` accepts only `quiet`, `stage`, or `checklist`.
- `ux.structured_confirmations` accepts only `auto` or `required`.
- `ux.user_checkpoints` accepts only `off`, `phase`, or `plan`.
- `orchestration.task_tracker` accepts only `off` or `auto`.
- `research.external_sources` accepts only `off`, `ask`, or `auto`.
- These keys are interaction and orchestration preferences, not project-state or hook-ownership exceptions.
- `S8.1` locked the names and enum values. `S8.2` adds runtime normalization and persistence through the existing config MCP tools.
- Older project configs that omit these keys still inherit them from saved defaults or hardcoded defaults until the project explicitly writes an override.

Normalization and precedence rules:
- Effective config precedence is hardcoded Blueprint defaults, then `~/.<host>/blueprint/defaults.json`, then `.blueprint/config.json`, then command flags.
- `.blueprint/config.json` is persisted in normalized object form for every section, including `parallelization`, even if legacy or shorthand input was accepted at the tool boundary.
- Repo config must not contain `workflow.use_workspaces`, `workflow.use_workstreams`, or repo-level `hooks.*` keys. Workspace and workstream behavior stays command-driven; hook activation stays extension-owned in `hooks/hooks.json`.
- `workflow.subagents` is the global optional-subagent workflow policy for Blueprint command orchestration. It governs whether commands may use their optional Blueprint subagent paths; it does not install host agents, change agent catalog availability, or widen routing.
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
- when this is the only file under `.blueprint/`, project readiness should stay retryable instead of becoming a partial bootstrap that requires manual deletion

## Phase Tree

Each phase directory lives under `.blueprint/phases/<phase-slug>/`.

Canonical source-of-truth note:
- The runtime-owned contract registry under `src/mcp/artifact-contracts/` is the canonical source for scaffold starters, authoring templates, locked markers, required headings, and freehand policy. Keep the distinction explicit: starter scaffold material seeds a missing file, while the authoring template governs the final saved artifact body.
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
- `XX-DISCUSS-CHECKPOINT.json` (shared temporary phase continuation state; the retained filename is legacy-compatible, while ownership now comes from `ownerCommand` and `resumeMeta.mode`)
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
- if scaffold starter material was used, the final saved body must rewrite it into concrete phase decisions rather than preserving starter wording verbatim
- must populate the full discuss-phase context contract sections from `Phase Boundary`, `Discovery Grounding`, `Implementation Decisions`, `Specific Ideas`, `Existing Code Insights`, `Dependencies`, `Open Questions`, `Deferred Ideas`, and `Canonical References`
- implementation decisions should be evidence-backed enough for downstream research and planning: include rationale, repo or saved-artifact paths where applicable, options considered, consequences if assumptions are wrong, and full relative canonical references
- `/blu-discuss-phase` must repair any returned write validation issues before treating the context capture as complete; if repair cannot finish, the checkpoint remains the continuation source
- a context file with only `## Decisions`, or with just the older summary-style sections, no longer satisfies the contract

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
- `/blu-ui-phase` treats the canonical authoring template as heading/schema authority and `skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md` as the richness authority for design-system evidence, spacing, typography, color, copy, screen states, accessibility, registry safety, six-dimension checker review, and retry/repair behavior

### `XX-YY-SUMMARY.md`

`XX-YY-SUMMARY.md` is the execution summary contract for a single plan.

Validation expectations:
- new writes should include an H1 title, `Plan`, `Status`, `Readiness`, `Completion State`, and `Next Safe Action` markers, but marker casing and heading shape are tolerant
- preferred Markdown sections are `## Outcome`, `## Changes Made`, `## Verification`, `## Dependency Plans`, `## Manual / Deferred Work`, `## Gap / Repair Routes`, `## Follow-Ups`, and `## Evidence`
- `blueprint_phase_summary_write` accepts Markdown `content` and derives phase, plan id, summary path, and linked plan provenance from MCP arguments
- hard evidence eligibility requires a canonical summary path, linked plan existence, non-empty body, valid explicit status when present, and no explicit `COMPLETED` contradiction such as failed, blocked, or not-run verification rows
- `COMPLETED` summaries close the selected plan's execution debt only when dependency plan summaries are already completed
- `PARTIAL` and `BLOCKED` summaries remain truthful carry-forward evidence and keep the plan pending
- heading casing, missing optional sections, marker shape drift, exact sentinel row style, and legacy concise summaries are warnings rather than blockers
- legacy summaries without a `Status` marker can still count as completed evidence when their canonical plan link and semantic checks pass; new writes still require explicit status

### `XX-DISCUSS-CHECKPOINT.json`

`XX-DISCUSS-CHECKPOINT.json` is the shared phase continuation checkpoint for
discovery and validation flows. The retained filename is legacy-compatible; the
actual owner is declared inside the checkpoint body.

Structured persistence expectations:
- top-level JSON value must be an object
- persisted checkpoints must use the richer resumability shape with `ownerCommand`, `completedAreas`, `remainingAreas`, `decisions`, `deferredIdeas`, `canonicalReferences`, and `resumeMeta`
- `ownerCommand` identifies the command that owns the continuation state; current values are `/blu-discuss-phase` and `/blu-research-phase`
- `resumeMeta.mode` is enum-like ownership metadata; current values are `discuss` and `research`, and new writes must match the owning command (`/blu-discuss-phase` -> `discuss`, `/blu-research-phase` -> `research`)
- `resumeMeta` must carry durable resume metadata such as `mode`, `pendingTopics`, `completedTopics`, `currentQuestion`, `notes`, `resumeHint`, and `updatedAt`
- the MCP tool owns the shared checkpoint path; callers must treat returned `path` values as authoritative instead of hand-building mode-specific filenames
- legacy object-shaped checkpoints may still be read for compatibility, and matching legacy mode-only checkpoints may still be updated or deleted by the owning command, but `blueprint_phase_checkpoint_get` reports ownership/mode warnings and a `safeToResume` signal when the caller supplies expected ownership

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
- scaffold starters, when used, are first-write seed material only and must not survive verbatim into the final saved artifact
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

- <current ecosystem or repo update relevant to this phase>

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
- `**Gate State:**` `PASS|PARTIAL|BLOCKED`
- `**Sign-off:**` named reviewer or `pending`
- `## Validation Summary`
- `## Requirement / Task Coverage`
- `## Evidence Reviewed`
- `## Test Infrastructure / Evidence Metadata`
- `## Manual-Only or Deferred Coverage`
- `## Gate State`
- `## Gap Classification`
- `## Gaps Found`
- `## Suggested Repairs`
- `## Next Safe Action`

Validation expectations:
- must be grounded in the saved execution summaries for the phase
- may be authored as a structured `blueprint.phase.verification.model` payload; MCP owns phase identity, path derivation, runtime task-schema narrowing, canonical Markdown rendering, example-leakage rejection, and the final Markdown validation pass
- should describe gaps and pass signals explicitly rather than only restating artifact content
- should keep the locked markers `**Coverage:**`, `**Gate State:**`, and `**Sign-off:**` exactly as written
- should keep the full heading set above so the persisted artifact matches the runtime validator and authoring template
- should only route the next safe action to `/blu-verify-work` when the saved gate state is `PASS`, readiness is ready for UAT, and no unresolved gap or repair signals remain
- should keep non-ready validation truthful as `PARTIAL` or `BLOCKED` and route repairable test gaps to `/blu-add-tests <phase>` or implementation/behavior gaps to `/blu-audit-fix <phase>`
- should be resumable by the next `validate-phase` run if the artifact already exists

### `XX-UAT.md`

`XX-UAT.md` is the phase-scoped conversational UAT contract for a completed phase.

Minimum expected structure:
- `**Status:** PASS|FAIL|PARTIAL`
- `**Resume State:** RESUMED|NEW|CONTINUED`
- `**Checkpoint:** <current checkpoint label or none>`
- `## UAT Summary`
- `## Session State`
- `## Questions Asked`
- `## Observed Behavior`
- `## Unresolved Gaps`
- `## Follow-Up Fixes`
- `## Next Safe Action`

Richer authoring template sections:
- `## Current Test`
- `## Test Matrix`
- `## Result Summary`
- `## Structured Gaps`

UAT expectations:
- must be grounded in the saved execution summaries for the phase
- may be authored as a structured `blueprint.phase.uat.model` payload; MCP owns phase identity, path derivation, runtime task-schema narrowing, canonical Markdown rendering, example-leakage rejection, and the final Markdown validation pass
- should preserve resumable conversational state rather than acting like a one-shot transcript
- should keep resumability inside `XX-UAT.md` itself rather than inventing a separate checkpoint file for `/blu-verify-work`
- should preserve a concrete user-observable test queue with expected behavior, saved evidence, result state, and notes
- should separate blocked prerequisites from code gaps, preserve verbatim issue reports, and infer severity without asking the user to classify it manually
- should preserve user-reported issues, blocked prerequisites, and structured gaps as UAT evidence without an extra confirmation gate
- should include structured gaps that can feed later explicit follow-up capture or repair planning
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
**Checkpoint:** <current checkpoint label or none>

## UAT Summary

- Concise user-facing result grounded in the saved summaries and verification artifact.

## Session State

- Resume source: <saved summary path, in-artifact checkpoint, or none>
- Current session step: <what is being resumed now>
- Continuity notes: <what must remain stable between sessions>

## Current Test

- Number: <active test number or testing complete>
- Name: <active user-observable test name or none>
- Expected: <what the user should observe>
- Awaiting: <explicit user response, checkpoint review choice, or none>

## Test Matrix

| # | Test | Expected Behavior | Evidence | Result | Notes |
|---|------|-------------------|----------|--------|-------|
| 1 | <test name> | <observable expected behavior> | `.blueprint/phases/.../XX-YY-SUMMARY.md` | pending|pass|issue|skipped|blocked | <note> |

## Result Summary

- Total: <N>
- Passed: <N>
- Issues: <N>
- Pending: <N>
- Skipped: <N>
- Blocked: <N>

## Questions Asked

- Question asked during the UAT pass, or `none`.

## Observed Behavior

- User-reported observed behavior tied to saved summary evidence.

## Unresolved Gaps

- Explicit blocker, follow-up, or `none`.

## Structured Gaps

| Test | Truth | Status | Severity | Reason | Follow-Up |
|------|-------|--------|----------|--------|-----------|
| <test number or none> | <expected behavior> | failed|partial|blocked|none | blocker|major|minor|cosmetic|none | <verbatim report or blocked reason> | <repair or confirmation path> |

## Follow-Up Fixes

- Explicit follow-up fix, acceptance note, or `none`.

## Next Safe Action

- <implemented next action such as `/blu-verify-work <phase>` while checkpointed, or `/blu-progress` when completed>
```

Contract notes:
- Keep the `**Status:**`, `**Resume State:**`, and `**Checkpoint:**` markers exactly as written.
- Keep all required section names unchanged so `blueprint_phase_validation_write` passes current validation.
- Treat `**Checkpoint:**` as the current in-artifact checkpoint label rather than a separate checkpoint file path.
- Reference at least one saved summary path or filename inside `## UAT Summary`, `## Session State`, or `## Observed Behavior`.
- Fill the richer authoring sections when creating or updating UAT; completion-grade saved UAT should include current test state, the test matrix, result counts, and structured gaps.
- Preserve user-reported issues and blocked prerequisites as UAT evidence by default. Keep follow-up-fix captures explicit enough that the parent command can ask for confirmation before persistence.

### `XX-REVIEW-FIX.md`

`XX-REVIEW-FIX.md` is the phase-scoped remediation summary contract for review-driven follow-up work.

Canonical source-of-truth note:
- The runtime contract registry under `src/mcp/artifact-contracts/` is canonical. This section is the human-readable mirror of the `review.review-fix` contract and should stay aligned with it.
- `/blu-code-review-fix` authors `review.review-fix` JSON first, validates it through `blueprint_review_validate_model`, and persists the same model through `blueprint_review_record`. When remediation is scoped to a subset, authoring, validation, and persistence must all receive the same selected saved target ids as `targetIds`. Markdown `content` fallback is invalid.

Minimum expected structure:
- `**Status:** COMPLETED|PARTIAL|BLOCKED`
- `**Readiness:** ready-for-validation|not-ready-for-validation|blocked`
- `**Completion State:** complete|pending|blocked`
- `**Next Safe Action:** /blu-validate-phase <phase>|/blu-code-review-fix <phase>|/blu-add-tests <phase>|/blu-progress`
- `## Remediation Summary`
- `## Findings Addressed`
- `## Changes Made`
- `## Verification`
- `## Dependency Plans`
- `## Manual / Deferred Work`
- `## Gap / Repair Routes`
- `## Follow-Ups`
- `## Evidence`
- `## Next Safe Action`

Review-fix expectations:
- must stay grounded in findings loaded from the saved `XX-REVIEW.md` baseline rather than a fresh prompt-only review
- must use review authoring context from saved code-review findings plus phase execution plan, summary, and dependency evidence, preserving selected saved target ids through `targetIds`
- should summarize only the selected remediation pass instead of restating every open issue in the phase
- should capture concrete verification evidence for applied changes and keep unresolved work explicit
- Blueprint-native review-fix behavior focuses on bounded remediation; it does not currently ship a real `blueprint-fixer` agent, atomic per-fix commits, or a GSD-style automated re-review loop.
- invalid or incomplete review-fix models should be repaired against the canonical `review.review-fix` task schema and retried once through `blueprint_review_validate_model`; the command must not bypass MCP by writing the artifact directly

Exact persistence template:

```md
# Phase XX: <Phase Name> - Review Fix

**Status:** COMPLETED|PARTIAL|BLOCKED
**Readiness:** ready-for-validation|not-ready-for-validation|blocked
**Completion State:** complete|pending|blocked
**Source Review:** .blueprint/phases/<phase-slug>/XX-REVIEW.md
**Next Safe Action:** /blu-validate-phase <phase>|/blu-code-review-fix <phase>|/blu-add-tests <phase>|/blu-progress

## Remediation Summary

- Concrete summary of this bounded remediation pass.

## Findings Addressed

- Saved finding id and remediation disposition.

## Changes Made

| File | Summary |
|------|---------|
| path/to/file.ts | Concrete remediation completed. |

## Verification

| Check | Command | Result | Evidence |
|-------|---------|--------|----------|
| Focused check | npm test -- tests/example.test.ts | pass|fail|blocked|not-run | Validation or test evidence for the applied fix. |

## Dependency Plans

| Plan | Status | Evidence |
|------|--------|----------|
| none | none | none |

## Manual / Deferred Work

| Item | Reason | Follow-Up | Status |
|------|--------|-----------|--------|
| none | none | none | NONE |

## Gap / Repair Routes

| Gap | Evidence | Repair | Status |
|-----|----------|--------|--------|
| none | none | none | NONE |

## Follow-Ups

- Remaining work, deferred item, or `none`.

## Evidence

| Kind | Source | Summary |
|------|--------|---------|
| review | .blueprint/phases/<phase-slug>/XX-REVIEW.md | Saved review findings baseline. |

## Next Safe Action

- /blu-validate-phase <phase>
```

Contract notes:
- Keep the `**Status:**`, `**Readiness:**`, `**Completion State:**`, and `**Next Safe Action:**` markers exactly as written. `**Source Review:**` is MCP-owned rendered provenance, not a model-authored identity key.
- Keep all required section names unchanged so `blueprint_review_record` continues to render the canonical review-fix artifact contract.
- `## Findings Addressed` is the locked heading for remediation scope; do not rename it to `Findings Fixed`, `Resolved Findings`, or similar variants.
- `COMPLETED` means selected saved findings were fixed and verified. `PARTIAL` and `BLOCKED` remain carry-forward remediation evidence.
- If this document and the runtime registry ever drift, follow `src/mcp/artifact-contracts/` and repair this doc to match.

### `XX-SECURITY.md`

`XX-SECURITY.md` is the phase-scoped security audit contract for a completed phase.

Canonical model note:
- `/blu-secure-phase` authors `review.security` JSON first, validates it against `src/mcp/artifact-contracts/schemas/review.security.model.schema.json` plus the narrowed task schema, and then persists that same model through `blueprint_review_record`.
- Markdown fallback is invalid for `/blu-secure-phase`; MCP owns the final `XX-SECURITY.md` rendering.
- The task schema narrows the base model to the live saved plan, summary, declared threat, prior security, validation, UAT, and evidence inventory for the selected phase.

Minimum expected structure:
- `**Status:** COMPLETED|PARTIAL|BLOCKED`
- `**Readiness:** ready-for-routing|needs-follow-up|blocked`
- `**Completion State:** complete|partial|blocked`
- `**Next Safe Action:** <implemented command or blocked sentinel>`
- `## Security Summary`
- `## Evidence Reviewed`
- `## Threat Register`
- `## Accepted Risks`
- `## Findings`
- `## Manual / Deferred Work`
- `## Gap / Repair Routes`
- `## Follow-Ups`
- `## Security Audit Trail`
- `## Next Safe Action`

Security audit expectations:
- must stay grounded in saved phase evidence, relevant code, or clearly cited repo references
- should distinguish confirmed mitigations from missing or partial controls, while keeping threat dispositions and accepted-risk handling explicit
- should keep the rendered threat register rich enough for audit parity, while model authors provide only `threatId`, `status`, `evidence`, and `verifierNote` and MCP renders saved-plan provenance plus category, component, disposition, and mitigation columns
- should use lowercase threat-register status values such as `closed`, `accepted`, `open`, and `none`
- should keep the threat register or equivalent security disposition shape explicit instead of accepting scaffold-only placeholder markers as complete
- should require the `Threat Register`, `Accepted Risks`, and `Security Audit Trail` sections so the security artifact cannot collapse back into a generic findings-only review
- should treat `none` bullets as empty entries rather than real findings or follow-up items
- should call out suspicious artifact content or prompt-boundary issues explicitly when they materially affect trust in the saved evidence
- should keep explicit follow-up hardening work visible instead of burying it in chat history
- model-only authoring uses `auditTrail` as an object; empty arrays are valid for no accepted risks, no findings, no manual or deferred work, no gap routes, or explicit no-threat reviews because MCP renders `none` rows and bullets in the final Markdown artifact
- missing threat-model context should narrow authoring to truthful `PARTIAL` or `BLOCKED` outcomes, while explicit saved no-threat evidence may still support a `COMPLETED` review

### `XX-UI-REVIEW.md`

`XX-UI-REVIEW.md` is the phase-scoped UI audit contract for completed
frontend or UX work.

Canonical source-of-truth note:
- The runtime contract registry under `src/mcp/artifact-contracts/` is
  canonical. This section is the human-readable mirror of the
  `review.ui-review` contract and should stay aligned with it.

Minimum validation structure:
- `**Verdict:** PASS|FOLLOW_UP|BLOCKED`
- `## UI Review Summary`
- `## Evidence Reviewed`
- `## Findings`
- `## Follow-Ups`
- `## Next Safe Action`

Authoring expectations:
- `/blu-ui-review` authors `review.ui-review` JSON first, validates it against
  `src/mcp/artifact-contracts/schemas/review.ui-review.model.schema.json` plus
  the narrowed task schema, and then persists that same model through
  `blueprint_review_record`; Markdown `content` fallback is invalid
- must read the canonical `review.ui-review` model contract and
  `blueprint_review_authoring_context.authoringContext.taskSchema` before
  drafting or repair
- should include `## Pillar Scores`, `## Priority Fixes`, and `## Audit Trail`
  when creating or updating a UI review
- should score Copywriting, Visual Hierarchy, Color, Typography, Spacing, and
  Experience Design from 1-4, with an overall score out of 24
- must stay grounded in saved execution summaries, the saved `XX-UI-SPEC.md`
  when present, actual repo evidence, and supplied screenshots or visual
  observations when available
- must record screenshot or visual-runtime limitations instead of claiming
  visual certainty from static evidence alone
- should identify up to three concrete priority fixes with user impact and
  repair guidance, or write `none` with explicit pass evidence
- PASS requires ready-for-routing, complete state, no priority fixes, no
  findings, exact `none` followUps, score consistency, and a routed implemented
  next action
- FOLLOW_UP and BLOCKED require concrete findings or blocked evidence, concrete
  followUps, non-complete state, and `/blu-progress` rather than a ready
  validation or UAT next action
- invalid or incomplete UI-review models should be repaired against the
  narrowed `review.ui-review` task schema and retried once through
  `blueprint_review_validate_model` and `blueprint_review_record`; the command
  must not bypass MCP by writing the artifact directly

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
- `/blu-code-review` authors JSON first and validates it through `blueprint_review_validate_model`; `blueprint_review_record` rejects Markdown `content` for `review.code-review`
- `/blu-review` authors JSON first and validates it through `blueprint_review_validate_model`; `blueprint_review_record` rejects Markdown `content` for `review.peer-review`
- the authored model may contain only `verdict`, `reviewSummary`, `positiveSignals`, `findings`, `evidenceCoverage`, `followUps`, and `nextSafeAction`
- `evidenceCoverage` keys must exactly match the known evidence artifacts returned by `blueprint_review_scope.authoringContext`, each with `used`, `deferred`, or `irrelevant` plus a concrete rationale
- runtime-owned depth, scope source, scope reviewed, evidence inventory rendering, severity counts, paths, and canonical Markdown are computed by MCP rather than authored JSON
- severity summary must maintain machine-extractable counts for critical/high/medium/low/unknown counts
- findings must cite evidence and impact for each issue
- follow-up work should be explicit rather than buried in findings prose

## Supporting Trees

### `reports/`

Used for non-phase-specific outputs and command logs:

- milestone audit reports
- milestone completion reports
- milestone summaries
- add-tests reports
- pause / resume handoffs
- debug logs
- review-branch preparation reports
- cleanup reports
- update and patch reports
- quick-task reports

### `impact/<impact-id>/`

Purpose:
- durable blast-radius report bundle for implemented `/blu-impact`
- human-readable `IMPACT.md` plus machine-readable `impact.json` and `summary.json`
- optional evidence, reviewer/test checklist, and questions files derived from the validated report payload

Canonical source-of-truth note:
- The runtime contract registry under `src/mcp/artifact-contracts/` is canonical.
  This section mirrors the `report.impact` contract and should stay aligned with it.
- `/blu-impact` is implemented as an advisory report command. The MCP writer owns only the bounded impact bundle and does not mutate source files, roadmap state, PR state, deployment state, command-catalog state, or the installed extension directory.

Required bundle files:
- `IMPACT.md`
- `impact.json`
- `summary.json`

Conditional bundle files:
- `evidence.jsonl` when evidence records exist or evidence logging is requested
- `review-checklist.md` when reviewers, tests, actions, or obligations exist
- `QUESTIONS.md` when unknowns exist

Minimum locked `IMPACT.md` sections:
- `## Summary`
- `## Change Scope`
- `## Top Impacted Areas`
- `## Required Reviewers`
- `## Required Tests`
- `## Blocking Findings`
- `## Warnings`
- `## Contract And Compatibility Impact`
- `## Database, Config, Infra, And Deployment Impact`
- `## Unknowns And Missing Metadata`
- `## Evidence`
- `## Suggested Next Actions`

Impact report expectations:
- `blueprint_impact_report_write` owns the bundle path and writes only under `.blueprint/impact/<impact-id>/`.
- The structured payload must use `schemaVersion: blueprint.impact.report.v1` and validate against the `report.impact` JSON Schema.
- JSON Schema owns required fields, unsupported fields, static enums, status alignment, single-line sink safety, path-shape restrictions, evidence-ref minima, and runtime narrowing for exact analyzer scope/files/evidence/finding/projection expectations.
- Missing ownership, dependency, compliance, test, or scope metadata must remain explicit unknowns rather than being described as safety.
- Residual TypeScript validation rejects invalid live path containment, empty rendered sections, unresolved placeholders, generic `N/A` without a reason, stale summary counts, unknown evidence refs, ungrounded reviewers/tests/actions, semantic status contradictions, and high confidence without file-backed scope proof before any files are written.
- Existing identical bundles are reused; changed existing bundles require explicit overwrite.

### `reports/add-tests-<phase>.md`

Purpose:
- durable test-generation report for `/blu-add-tests`
- evidence-backed record of saved phase evidence, classification, approved test
  plan, targeted command results, and remaining coverage gaps

Canonical source-of-truth note:
- The runtime contract registry under `src/mcp/artifact-contracts/` is
  canonical. This section mirrors the `report.add-tests` contract and should
  stay aligned with it.

Minimum locked sections:
- `## Coverage Goal`
- `## Evidence Used`
- `## Tests Added Or Updated`
- `## Remaining Gaps`
- `## Next Safe Action`

Add-tests report expectations:
- must cite saved summaries plus verification or UAT evidence used as the test
  specification
- should show the approved file/behavior classification and why each candidate
  was `Unit / TDD`, `Integration / API`, `E2E / UI`, or `Skip`
- should include the approved test plan, target test files, expected assertions
  or scenarios, duplicate-coverage decisions, and narrow command selected
- should distinguish generated, passing, failing, and blocked checks
- should separate implementation bugs from test-authoring errors and blocked
  prerequisites
- should record verification write status and report write status from MCP
  return values

Exact persistence template:

```md
# Add Tests Report

## Coverage Goal

- Phase coverage gap selected for this pass.
- Approved test scope and why it is the narrowest safe scope.

## Evidence Used

- Saved summaries, verification or UAT artifacts, existing test conventions,
  nearby coverage, and target command discovered.

## Classification And Test Plan

| Surface | Classification | Reason | Planned Test |
|---------|----------------|--------|--------------|
| <repo-relative path or behavior> | <Unit / TDD, Integration / API, E2E / UI, or Skip> | <why this classification fits> | <test case, scenario, or skip rationale> |

## Tests Added Or Updated

- Test files or suites changed.
- Targeted command and result counts.
- Bugs or blockers discovered.

## Remaining Gaps

- Remaining coverage gap, deferred/manual-only area, failed generated test,
  blocked prerequisite, or `none`.
- Verification write status and report write status.

## Next Safe Action

- /blu-progress
```

Contract notes:
- Persist this report through `blueprint_artifact_report_write` with the bare
  report name `add-tests-<phase>`; do not hand-build `.blueprint/reports/...`
  paths.
- Replacing an existing add-tests report requires explicit confirmation.

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
- should include the pre-mutation classification table with finding id, evidence source, severity, classification (`auto-fixable`, `manual-only`, or `skip`), reason, implicated files, and narrow verification
- should capture stop-on-first-failure behavior when the capped mutation loop halts early
- should distinguish applied fixes, failed attempts, dry-run-only candidates, skipped findings, manual-only findings, and unattempted candidates
- should include verification outcome and commit traceability (`pre-fix HEAD`, created commit SHA(s), or `none`)
- should keep follow-up todo capture explicit when requested
- should document invalid-write repair or retry outcomes if `blueprint_artifact_report_write` rejects the first body

Exact persistence template:

```md
# Audit Fix Report

## Evidence Used

- Saved artifacts selected by `--source`, scoped repo files, pre-fix HEAD, and unavailable expected evidence.

## Fix Scope

- Source/severity/max/dry-run settings, authoritative `blueprint_review_scope.files`, confirmation gates, and classification table.

## Changes Applied

- Applied fixes, failed attempts, dry-run classification output, verification checks, commit SHA(s), rollback status, or `none`.

## Remaining Gaps

- Manual-only findings, skipped findings, unattempted candidates, verification gaps, todo decisions, stop reason, or `none`.

## Next Safe Action

- /blu-progress
```

Contract notes:
- Keep required section names unchanged so `blueprint_artifact_report_write` continues to recognize the canonical audit-fix report contract.
- Persist this report through `blueprint_artifact_report_write` with the bare report name `audit-fix-<phase>`; do not route through `blueprint_review_record`.
- Replacing an existing audit-fix report requires explicit confirmation.

### `reports/pr-branch-latest.md`

Purpose:
- durable review-branch preparation report for `/blu-pr-branch`
- evidence bridge between the source branch and the clean review branch reviewers should inspect

Minimum locked sections:
- `## Source Branch`
- `## Review Branch`
- `## Filtered Scope`
- `## Verification`
- `## Next Safe Action`

Pr-branch report expectations:
- must record base branch, source branch, source `HEAD`, candidate review branch, created review branch, current branch after validation, and config inputs used for branch policy
- must include a commit classification ledger with commit SHA, subject, classification (`code-only`, `blueprint-only`, `mixed`, or `empty-after-filter`), include/exclude/skip action, filtered paths, and reason
- must record included and excluded repo-relative path sets plus digest `inputsUsed`
- must capture post-create verification commands and results, including clean status, retained file count, retained commit count, and excluded `.blueprint/**` file count
- must document recovery notes or blockers rather than claiming success when replay or verification fails
- should document invalid-write repair or retry outcomes if `blueprint_artifact_report_write` rejects the first body

Exact persistence template:

```md
# PR Branch Report

## Source Branch

- Base branch: <base branch>
- Source branch: <source branch>
- Source HEAD: <commit sha>
- Config used: git.base_branch=<value>; git.branching_strategy=<value>; planning.commit_docs=<true|false>

## Review Branch

- Candidate branch: <candidate review branch>
- Created branch: <created review branch or not created>
- Current branch after run: <current branch after validation>
- Execution mode: <preview-only|confirmed-replay|blocked>
- Git commands approved: <commands or none>

## Filtered Scope

- .blueprint policy: <excluded|included> because <reason>
- Digest inputs used: <inputsUsed from blueprint_artifact_summary_digest>
- Included paths: <repo-relative paths or none>
- Excluded paths: <repo-relative paths or none>

| Commit | Subject | Classification | Action | Filtered paths | Reason |
|---|---|---|---|---|---|
| <sha> | <subject> | <code-only|blueprint-only|mixed|empty-after-filter> | <include|exclude|skip> | <paths or none> | <reason> |

## Verification

- Clean review branch status: <command and result>
- Excluded .blueprint file count in review diff: <count>
- Total files in review diff: <count>
- Review branch commits ahead of base: <count>
- Recovery or blocker: <none or blocker>

## Next Safe Action

- <manual push/PR guidance or /blu-progress>
```

Contract notes:
- Keep required section names unchanged so `blueprint_artifact_report_write` continues to recognize the canonical pr-branch report contract.
- Persist this report through `blueprint_artifact_report_write` with the bare report name `pr-branch-latest`.
- Replacing an existing pr-branch report requires explicit confirmation.

### `reports/ship-latest.md`

Purpose:
- durable shipping report for `/blu-ship`
- evidence ledger for push and PR decisions, approved commands, and manual fallback guidance

Minimum locked sections:
- `## Selected Scope`
- `## Saved Evidence`
- `## Branch Plan`
- `## Remote Actions`
- `## Push Or PR Outcome`
- `## Manual Fallback Guidance`
- `## Next Safe Action`

Ship report expectations:
- must record the selected shipping scope, source branch, source `HEAD`, base branch, current branch, execution mode, draft or ready mode, and config inputs used for branch policy
- must preserve digest `inputsUsed`, saved evidence paths, tracked files, and the draft PR body source so the push or PR outcome can be traced to concrete inputs
- must record whether push and PR were requested, which `git` and `gh` commands were approved, and whether `gh` was available and authenticated before remote mutation
- must capture both push and PR outcomes explicitly, including blocked or not-run states, instead of implying success from surrounding narration
- must include a manual checklist and fallback notes when remote shipping does not complete automatically

Exact persistence template:

```md
# Ship Report

## Selected Scope

- **Scope:** <selected scope such as review-branch|current-branch|commits>
- **Source branch:** <source branch>
- **Source HEAD:** <commit sha>
- **Base branch:** <base branch>
- **Execution mode:** <preview-only|confirmed-run|blocked>
- **Draft or ready mode:** <draft|ready>
- **Config used:** <git.base_branch=<value>; git.branching_strategy=<value>; planning.commit_docs=<true|false>>
- **Current branch:** <current branch>

## Saved Evidence

- **Digest inputs used:** <inputsUsed from blueprint_artifact_summary_digest>
- **Saved evidence paths:** <saved evidence paths or none>
- **Tracked files:** <repo-relative tracked files or none>
- **Draft PR body source:** <path|generated body|none>

## Branch Plan

- **Push requested:** <true|false>
- **PR requested:** <true|false>
- **Git commands approved:** <commands or none>

## Remote Actions

- **gh commands approved:** <commands or none>
- **gh availability and auth:** <available and authenticated|available but unauthenticated|unavailable>

## Push Or PR Outcome

- **Push outcome:** <not-run|success|failed|blocked>
- **PR outcome:** <not-run|created|updated|failed|blocked>
- **gh fallback notes:** <fallback notes or none>

## Manual Fallback Guidance

- **Manual checklist:**
  1. <manual step one>
  2. <manual step two>
  3. <manual step three>

## Next Safe Action

- <manual next action or /blu-progress>
```

Contract notes:
- Keep required section names and bold field labels unchanged so `blueprint_artifact_report_write` continues to recognize the canonical ship report contract.
- Persist this report through `blueprint_artifact_report_write` with the bare report name `ship-latest`.
- Replacing an existing ship report requires explicit confirmation.

### `reports/undo-latest.md`

Purpose:
- durable undo report for `/blu-undo`
- approval and evidence ledger for revert scope, branch state, and mutation outcome

Minimum locked sections:
- `## Requested Scope`
- `## Branch State`
- `## Affected Evidence And Digest Inputs`
- `## Candidate Revert Set`
- `## Dependency Impact`
- `## Approved Revert Commands`
- `## Mutation Outcome`
- `## Next Safe Action`

Undo report expectations:
- must record the requested undo scope, operator-approved reason, execution mode, and pending gate before any revert command is run
- must preserve current branch, `HEAD`, working tree status, merge state, and report overwrite status so the branch state is auditable
- must capture digest `inputsUsed`, affected evidence paths, stale-evidence impact, and tracked files to show what downstream artifacts may need refresh
- must include a commit ledger for the candidate revert set plus dependency risk analysis, even when the final outcome is blocked or preview-only
- must record pending and approved `git` commands, the forbidden-command safety check, the revert outcome, and blockers instead of collapsing those details into prose

Exact persistence template:

```md
# Undo Report

## Requested Scope

- **Scope:** <requested undo scope such as commits|report overwrite|phase artifact>
- **Reason:** <operator-approved reason>
- **Execution mode:** <preview-only|confirmed-run|blocked>
- **Pending gate:** <awaiting confirmation|approved|blocked>

## Branch State

- **Current branch:** <current branch>
- **HEAD:** <commit sha>
- **Working tree status:** <clean|dirty>
- **Merge state:** <not in progress|merge in progress|rebase in progress|cherry-pick in progress>
- **Report overwrite status:** <new report|overwrite approved|overwrite blocked>

## Affected Evidence And Digest Inputs

- **Digest inputs used:** <inputsUsed from blueprint_artifact_summary_digest>
- **Affected evidence:** <saved evidence paths or none>
- **Stale evidence impact:** <stale evidence impact or none>
- **Tracked files:** <repo-relative tracked files or none>

## Candidate Revert Set

- **Commit ledger:**

| Commit | Subject | Scope | Revert action | Notes |
|---|---|---|---|---|
| <sha> | <subject> | <scope> | <revert|skip> | <notes> |

## Dependency Impact

- **Dependency risk:** <dependency risk or none>

## Approved Revert Commands

- **Pending git commands:** <commands awaiting approval or none>
- **Approved git commands:** <approved commands or none>
- **Forbidden-command check:** <passed|failed with blockers>

## Mutation Outcome

- **Revert outcome:** <not-run|success|failed|blocked>
- **Blockers:** <blockers or none>

## Next Safe Action

- <manual next action or /blu-progress>
```

Contract notes:
- Keep required section names, the commit-ledger table, and bold field labels unchanged so `blueprint_artifact_report_write` continues to recognize the canonical undo report contract.
- Persist this report through `blueprint_artifact_report_write` with the bare report name `undo-latest`.
- Replacing an existing undo report requires explicit confirmation.

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

Purpose:
- project-local parallel-work tracking for `/blu-workstreams`
- human-readable index plus canonical per-workstream mini-state

Canonical contents:
- `WORKSTREAMS.md`
- one subdirectory per workstream, each with `state.json`

Canonical `WORKSTREAMS.md` shape:

```md
# Blueprint Workstreams

- Active workstream: `backend-api`
- Workstream counts: 1 active, 1 paused, 0 completed

| Name | Slug | Status | Snapshot | Updated |
|---|---|---|---|---|
| `Backend API` | `backend-api` | `active` | `Phase 3; /blu-plan-phase` | `2026-04-23T09:15:00.000Z` |
| `Docs Sweep` | `docs-sweep` | `paused` | `none` | `2026-04-23T08:10:00.000Z` |
```

Canonical `.blueprint/workstreams/<slug>/state.json` shape:

```json
{
  "version": 1,
  "name": "Backend API",
  "slug": "backend-api",
  "status": "active",
  "createdAt": "2026-04-23T08:00:00.000Z",
  "updatedAt": "2026-04-23T09:15:00.000Z",
  "activatedAt": "2026-04-23T09:15:00.000Z",
  "completedAt": null,
  "stateSnapshot": {
    "projectStatus": "active",
    "currentMilestone": "v1",
    "currentPhase": "3",
    "activeCommand": "/blu-plan-phase",
    "nextAction": "Run /blu-execute-phase 3",
    "blockers": [],
    "roadmapEvolutionNotes": [],
    "lastUpdated": "2026-04-23T09:14:00.000Z"
  }
}
```

Contract notes:
- `status` accepts only `active`, `paused`, or `completed`.
- At most one workstream may be `active`.
- `createdAt` and `updatedAt` are required non-empty ISO-8601 strings; `activatedAt` and `completedAt` must be missing, `null`, or non-empty ISO-8601 strings. Malformed timestamp values are corrupt canonical state and should block workstream reads or mutation through the existing invalid/corrupt path.
- `WORKSTREAMS.md` is the human index; the per-workstream `state.json` files are the canonical mini-state that the MCP tool validates and mirrors into the index.
- `stateSnapshot` stores the saved `STATE.md` subset used by `resume`; it must stay project-local and must not be mirrored into host-global config or registries.
- A stale or missing `WORKSTREAMS.md` relative to the canonical state files, or malformed canonical `state.json` content such as bad timestamps, is corrupt workstream state and should block mutation until repaired.

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

### `patches/index.json`

Purpose:
- authoritative host-global patch registry index for `reapply-patches`

Canonical shape:

```json
{
  "version": 1,
  "patches": [
    "theme-fix",
    "lint-cleanup"
  ]
}
```

Contract notes:
- patch ids are file-safe identifiers that map directly to `<patch-id>.json`, `<patch-id>.patch`, and `<patch-id>.audit.ndjson`
- malformed or partial index entries are a hard stop for patch replay
- this registry stays host-global under `~/.<host>/blueprint/patches/`; Blueprint must not mirror it into `.blueprint/`

### `patches/<patch-id>.json`

Purpose:
- durable patch manifest for one replayable patch entry

Canonical shape:

```json
{
  "version": 1,
  "patchId": "theme-fix",
  "label": "Theme compatibility fix",
  "createdAt": "2026-04-22T10:15:00.000Z",
  "sourceVersion": "abc1234",
  "repoRootName": "blueprint",
  "repoRemote": "https://github.com/rakole/blueprint.git",
  "patchFile": "theme-fix.patch",
  "patchHash": "<sha256>",
  "trackedFiles": [
    "src/theme.ts",
    "tests/theme.test.ts"
  ],
  "compatibility": {
    "host": "gemini",
    "repoRootName": "blueprint",
    "remoteUrl": "https://github.com/rakole/blueprint.git"
  },
  "lastAppliedAt": "2026-04-22T10:20:00.000Z",
  "lastOutcome": "applied"
}
```

Contract notes:
- the manifest points at the sibling patch payload file `<patch-id>.patch`
- `patchHash` must match the on-disk patch payload; a mismatch is malformed-registry state
- compatibility checks are host-global guardrails, not advisory hints; a mismatch is a hard stop before replay
- `lastAppliedAt` and `lastOutcome` are replay metadata, not project-local evidence

### `patches/<patch-id>.audit.ndjson`

Purpose:
- append-only replay audit history for one patch entry

Canonical shape:

```json
{
  "version": 1,
  "timestamp": "2026-04-22T10:20:00.000Z",
  "action": "reapply",
  "outcome": "applied",
  "cwd": "/path/to/repo",
  "repoRoot": "/path/to/repo",
  "targetHead": "def5678",
  "trackedFiles": [
    "src/theme.ts",
    "tests/theme.test.ts"
  ],
  "conflicts": [],
  "warnings": [],
  "dryRun": false
}
```

Contract notes:
- audits are newline-delimited JSON entries appended by the patch MCP tools
- preview runs should record `action: "preview"` with `dryRun: true`
- replay runs should record `action: "reapply"` after preview completes and the approved replay step finishes or reports a clean blocker
- patch audit lives only under `~/.<host>/blueprint/patches/`; do not create `.blueprint/reports/` runtime ownership for this flow

## Commit Expectations

- `.blueprint/` is committed by default.
- Commands that mutate project state should update `.blueprint/` deterministically.
- Maintenance state and user defaults in `~/.<host>/blueprint/` are not project-tracked.
