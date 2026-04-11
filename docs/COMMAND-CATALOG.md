# Blueprint Command Catalog

This file is a one-page index for the retained Blueprint command surface. It complements the per-command specs in `docs/commands/` and helps future sessions choose the next implementation slice quickly. The `Status` column captures declared runtime intent; the live `blueprint_command_catalog` result remains the source of truth for actual availability.

| Command | Wave | Family | Primary Skill | Status | Key Writes | Risk |
|---|---:|---|---|---|---|---|
| `add-backlog` | 3 | `Capture And Lightweight Execution` | `blueprint-capture` | `planned` | `.blueprint/backlog/BACKLOG.md; optional 999.x phase stub in .blueprint/phases/` | `Low: backlog append plus optional stub scaffold.` |
| `add-phase` | 2 | `Roadmap And Milestone` | `blueprint-roadmap-admin` | `planned` | `new phase directory in .blueprint/phases/` | `Medium: mutates roadmap state and scaffolds a new phase.` |
| `add-tests` | 4 | `Quality And Shipping` | `blueprint-phase-validation` | `planned` | `new or updated test files in the repo; verification notes in XX-VERIFICATION.md` | `High: repo code mutation plus verification updates.` |
| `add-todo` | 3 | `Capture And Lightweight Execution` | `blueprint-capture` | `planned` | `.blueprint/todos/TODO.md; optional .blueprint/notes/NOTES.md updates when converting a note` | `Low: todo index update only.` |
| `audit-fix` | 4 | `Quality And Shipping` | `blueprint-review` | `planned` | `audit-fix report in .blueprint/reports/; code changes when not dry-running` | `High: classification plus automated remediation.` |
| `audit-milestone` | 2 | `Roadmap And Milestone` | `blueprint-roadmap-admin` | `planned` | `milestone audit report in .blueprint/reports/` | `Low: report generation only.` |
| `check-todos` | 3 | `Capture And Lightweight Execution` | `blueprint-capture` | `planned` | `todo status fields when selection or completion changes` | `Low: todo selection and status update only.` |
| `cleanup` | 5 | `Workspace And Maintenance` | `blueprint-maintenance` | `planned` | `archived phase directories; cleanup report in .blueprint/reports/` | `High: planning-directory archival and removal behavior.` |
| `code-review-fix` | 4 | `Quality And Shipping` | `blueprint-review` | `planned` | `phase XX-REVIEW-FIX.md; code changes` | `High: automated fixes plus optional iteration loop.` |
| `code-review` | 4 | `Quality And Shipping` | `blueprint-review` | `planned` | `phase XX-REVIEW.md` | `Low: review artifact generation only.` |
| `complete-milestone` | 2 | `Roadmap And Milestone` | `blueprint-roadmap-admin` | `planned` | `milestone completion report; .blueprint/STATE.md` | `Medium: advances milestone status and archival expectations.` |
| `debug` | 3 | `Capture And Lightweight Execution` | `blueprint-debug` | `planned` | `debug report in .blueprint/reports/; optional todo follow-ups` | `Medium: exploratory shell commands and test runs are likely.` |
| `discuss-phase` | 1 | `Core Lifecycle` | `blueprint-phase-discovery` | `implemented` | `phase XX-CONTEXT.md; optional phase XX-DISCUSSION-LOG.md; optional phase XX-DISCUSS-CHECKPOINT.json during in-progress discovery` | `Medium: can replace or extend phase context artifacts.` |
| `do` | 3 | `Capture And Lightweight Execution` | `blueprint-router` | `blocked` | `none` | `Low: routing only.` |
| `docs-update` | 4 | `Quality And Shipping` | `blueprint-docs` | `planned` | `repo documentation files; docs-update report in .blueprint/reports/` | `Medium: writes repo docs outside `.blueprint/`.` |
| `execute-phase` | 1 | `Core Lifecycle` | `blueprint-phase-execution` | `implemented` | `one or more XX-YY-SUMMARY.md files; optional execution reports in .blueprint/reports/` | `High: drives real repo mutation during implementation and records execution summaries.` |
| `explore` | 3 | `Capture And Lightweight Execution` | `blueprint-capture` | `planned` | `the chosen target only: note, todo, backlog entry, or roadmap proposal` | `Low: ideation-first, persistence second.` |
| `fast` | 3 | `Capture And Lightweight Execution` | `blueprint-phase-execution` | `planned` | `code changes and optional STATE.md last-action updates` | `Medium: minimal-planning repo mutation path.` |
| `health` | 0 | `Foundation` | `blueprint-governance` | `implemented` | `.blueprint/config.json and .blueprint/STATE.md in repair mode` | `Medium: repair mode can normalize config and rewrite malformed planning artifacts.` |
| `help` | 0 | `Foundation` | `blueprint-router` | `implemented` | `none` | `Low: read-only help and routing guidance.` |
| `insert-phase` | 2 | `Roadmap And Milestone` | `blueprint-roadmap-admin` | `blocked` | `new decimal phase directory; .blueprint/STATE.md` | `Medium: introduces decimal numbering and can shift later assumptions.` |
| `list-phase-assumptions` | 2 | `Roadmap And Milestone` | `blueprint-phase-discovery` | `planned` | `none` | `Low: read-only analysis.` |
| `map-codebase` | 0 | `Foundation` | `blueprint-map` | `implemented` | .blueprint/codebase/STACK.md; .blueprint/codebase/ARCHITECTURE.md; .blueprint/codebase/STRUCTURE.md; .blueprint/codebase/CONVENTIONS.md; .blueprint/codebase/TESTING.md; .blueprint/codebase/INTEGRATIONS.md; .blueprint/codebase/CONCERNS.md | `Medium: refresh mode can replace existing codebase-mapping artifacts.` |
| `milestone-summary` | 2 | `Roadmap And Milestone` | `blueprint-roadmap-admin` | `planned` | `summary report in .blueprint/reports/` | `Low: report generation only.` |
| `new-milestone` | 2 | `Roadmap And Milestone` | `blueprint-roadmap-admin` | `planned` | `PROJECT.md; REQUIREMENTS.md` | `Medium: rotates milestone-scope planning docs.` |
| `new-project` | 0 | `Foundation` | `blueprint-bootstrap` | `implemented` | `.blueprint/PROJECT.md; .blueprint/REQUIREMENTS.md; .blueprint/config.json` | `Medium: creates the initial planning tree and seeds normalized repo config.` |
| `new-workspace` | 5 | `Workspace And Maintenance` | `blueprint-maintenance` | `planned` | `workspace directory under configured maintenance.workspace_root or ~/blueprint-workspaces by default; workspace manifest` | `High: filesystem and git worktree mutation outside the current repo.` |
| `next` | 1 | `Core Lifecycle` | `blueprint-router` | `implemented` | `none` | `Low: read-only router.` |
| `note` | 3 | `Capture And Lightweight Execution` | `blueprint-capture` | `planned` | `.blueprint/notes/NOTES.md` | `Low: note capture only.` |
| `pause-work` | 1 | `Core Lifecycle` | `blueprint-governance` | `implemented` | `.blueprint/reports/pause-work-latest.md; .blueprint/STATE.md` | `Low: writes handoff and state artifacts only.` |
| `plan-milestone-gaps` | 2 | `Roadmap And Milestone` | `blueprint-roadmap-admin` | `planned` | `updated roadmap entries; new phase directories for approved gaps` | `Medium: can add multiple phases in one pass.` |
| `plan-phase` | 1 | `Core Lifecycle` | `blueprint-phase-planning` | `implemented` | `one or more XX-YY-PLAN.md files; .blueprint/STATE.md` | `Medium: can replace plans and change downstream execution order.` |
| `pr-branch` | 4 | `Quality And Shipping` | `blueprint-maintenance` | `planned` | `git branch state; branch report in .blueprint/reports/` | `High: git branch mutation.` |
| `progress` | 0 | `Foundation` | `blueprint-router` | `implemented` | `none` | `Low: read-only status inspection.` |
| `quick` | 3 | `Capture And Lightweight Execution` | `blueprint-phase-execution` | `planned` | `quick-run reports in .blueprint/reports/; .blueprint/STATE.md` | `High: can execute repo changes with reduced ceremony.` |
| `reapply-patches` | 5 | `Workspace And Maintenance` | `blueprint-maintenance` | `planned` | `patch replay report in .blueprint/reports/ or global patch logs; repo file changes when replay succeeds` | `High: patch replay may touch many repo files.` |
| `remove-phase` | 2 | `Roadmap And Milestone` | `blueprint-roadmap-admin` | `planned` | `.blueprint/ROADMAP.md; renamed or archived phase directories` | `High: renumbering can invalidate downstream roadmap references.` |
| `remove-workspace` | 5 | `Workspace And Maintenance` | `blueprint-maintenance` | `planned` | `updated global workspace registry; workspace directory removal` | `High: directory deletion and worktree cleanup.` |
| `research-phase` | 1 | `Core Lifecycle` | `blueprint-phase-discovery` | `implemented` | `phase XX-RESEARCH.md; .blueprint/STATE.md` | `Low: writes research artifacts only.` |
| `resume-work` | 1 | `Core Lifecycle` | `blueprint-governance` | `planned` | `none` | `Low: restores state without planned repo mutation.` |
| `review-backlog` | 3 | `Capture And Lightweight Execution` | `blueprint-capture` | `planned` | `updated backlog index; updated roadmap and any promoted phase stubs` | `Medium: can promote backlog items into active roadmap scope.` |
| `review` | 4 | `Quality And Shipping` | `blueprint-review` | `planned` | `phase XX-REVIEWS.md or equivalent peer-review artifact` | `Medium: external tool orchestration without default repo mutation.` |
| `secure-phase` | 4 | `Quality And Shipping` | `blueprint-review` | `planned` | `phase XX-SECURITY.md` | `Low: audit artifact only.` |
| `set-profile` | 0 | `Foundation` | `blueprint-governance` | `implemented` | `.blueprint/config.json` | `Low: single-setting mutation for project model profile selection.` |
| `settings` | 0 | `Foundation` | `blueprint-governance` | `implemented` | `.blueprint/config.json; optional ~/.gemini/blueprint/defaults.json` | `Low: config-only mutation inside repo config plus optional user defaults.` |
| `ship` | 4 | `Quality And Shipping` | `blueprint-maintenance` | `planned` | `ship report in .blueprint/reports/; optional PR body file or state note` | `High: remote and git mutation path.` |
| `ui-phase` | 1 | `Core Lifecycle` | `blueprint-phase-discovery` | `implemented` | `phase XX-UI-SPEC.md (UI contract or explicit skip rationale); .blueprint/STATE.md` | `Low: writes a UI contract or documented skip rationale only.` |
| `ui-review` | 4 | `Quality And Shipping` | `blueprint-review` | `planned` | `phase XX-UI-REVIEW.md` | `Low: review artifact only.` |
| `undo` | 4 | `Quality And Shipping` | `blueprint-maintenance` | `planned` | `git history through revert operations; undo report in .blueprint/reports/` | `High: intentionally destructive history-rewrite-adjacent workflow using safe revert-style steps.` |
| `update` | 5 | `Workspace And Maintenance` | `blueprint-maintenance` | `planned` | `update plan metadata under ~/.gemini/blueprint/updates/; human-readable update checklist report` | `Low: advisory only; no in-session self-update.` |
| `validate-phase` | 1 | `Core Lifecycle` | `blueprint-phase-validation` | `implemented` | `phase XX-VERIFICATION.md; .blueprint/STATE.md` | `Low: writes validation artifacts and gap reports.` |
| `verify-work` | 1 | `Core Lifecycle` | `blueprint-phase-validation` | `planned` | `phase XX-UAT.md; .blueprint/STATE.md` | `Low: writes UAT and verification artifacts.` |
| `workstreams` | 5 | `Workspace And Maintenance` | `blueprint-maintenance` | `planned` | `.blueprint/workstreams/WORKSTREAMS.md; per-workstream state files` | `Medium: project-local state mutation with switching semantics.` |
