# Blueprint

Blueprint is a Gemini-native planning and execution system for repository work.

## Checkpoint Status

- Phase 2.1 drift recovery and Phase 2.2 future-contract drift repair both closed on 2026-04-11.
- Phase 3 discovery shipped on 2026-04-11.
- The live runtime now includes `/blu-plan-phase`, `/blu-execute-phase`, `/blu-validate-phase`, `/blu-verify-work`, `/blu-add-tests`, `/blu-fast`, `/blu-quick`, `/blu-debug`, `/blu-pause-work`, `/blu-resume-work`, `/blu-add-phase`, `/blu-insert-phase`, `/blu-remove-phase`, `/blu-plan-milestone-gaps`, `/blu-audit-milestone`, `/blu-complete-milestone`, `/blu-milestone-summary`, `/blu-new-milestone`, `/blu-note`, `/blu-add-todo`, `/blu-check-todos`, `/blu-add-backlog`, `/blu-review-backlog`, `/blu-explore`, `/blu-docs-update`, `/blu-list-phase-assumptions`, `/blu-code-review`, `/blu-code-review-fix`, `/blu-audit-fix`, `/blu-secure-phase`, `/blu-review`, `/blu-ui-review`, `/blu-pr-branch`, `/blu-ship`, `/blu-undo`, and `/blu-cleanup`. Current follow-up work is keeping the shipped discovery, planning, execution, validation/UAT, test-generation, lightweight execution, debugging, governance, roadmap-admin, capture, docs, review, review-fix, and maintenance contracts aligned while later commands remain blocked until their substrate exists.
- Runtime routing must still surface only commands whose catalog entry is `implemented`.
- Host-facing docs should keep using the shared effectiveness-spine vocabulary: execution profile, stage, pending gate/status, and next safe action. When Gemini-only helpers are unavailable, Blueprint should describe the fallback honestly rather than implying tool parity.

## Command Namespace

- Use `/blu` as the root router when the user wants help, next-step guidance, or intent-based routing.
- Use direct commands in the `/blu-<command>` namespace when the user already knows the action they want.
- Current shipped direct commands: `/blu-new-project`, `/blu-settings`, `/blu-set-profile`, `/blu-help`, `/blu-progress`, `/blu-health`, `/blu-map-codebase`, `/blu-discuss-phase`, `/blu-list-phase-assumptions`, `/blu-research-phase`, `/blu-ui-phase`, `/blu-plan-phase`, `/blu-execute-phase`, `/blu-validate-phase`, `/blu-verify-work`, `/blu-add-tests`, `/blu-fast`, `/blu-quick`, `/blu-debug`, `/blu-next`, `/blu-pause-work`, `/blu-resume-work`, `/blu-add-phase`, `/blu-insert-phase`, `/blu-remove-phase`, `/blu-plan-milestone-gaps`, `/blu-audit-milestone`, `/blu-complete-milestone`, `/blu-milestone-summary`, `/blu-new-milestone`, `/blu-note`, `/blu-add-todo`, `/blu-check-todos`, `/blu-add-backlog`, `/blu-review-backlog`, `/blu-explore`, `/blu-docs-update`, `/blu-code-review`, `/blu-code-review-fix`, `/blu-audit-fix`, `/blu-secure-phase`, `/blu-review`, `/blu-ui-review`, `/blu-pr-branch`, `/blu-ship`, `/blu-undo`, and `/blu-cleanup`.

## State Boundaries

- Project-local Blueprint state lives in `.blueprint/`.
- Global operational Blueprint state lives in `~/.gemini/blueprint/`.
- `.planning/` is not Blueprint runtime state and must not be used for shipped command persistence. It may still exist in this repo as implementation bookkeeping for the Blueprint build-out.

## Current Runtime Surface

- `/blu-new-project` bootstraps deterministic `.blueprint/` artifacts and normalized repo config.
- `/blu-settings` reads or updates normalized Blueprint config through MCP tools.
- `/blu-set-profile` changes only the project-local `model_profile`.
- `/blu-help` returns read-only routing guidance from an implementation-aware command catalog and repo readiness.
- `/blu-progress` summarizes repo status, blockers, warnings, and the next safe action from real `.blueprint/` state while filtering to implemented commands.
- `/blu-next` turns the current derived next action into a safe direct-command recommendation without introducing hidden writes.
- `/blu-health` diagnoses Blueprint artifacts and enters repair flows only after explicit confirmation.
- `/blu-map-codebase` creates or reuses the seven-document `.blueprint/codebase/` bundle, including `STRUCTURE.md`.
- `/blu-discuss-phase` now captures substantive `XX-CONTEXT.md` content and can persist resumable discussion checkpoints.
- `/blu-list-phase-assumptions` now runs as a read-only discovery command that surfaces roadmap- and context-backed phase assumptions before planning.
- `/blu-research-phase` now persists substantive `XX-RESEARCH.md` content instead of relying on scaffold placeholders.
- `/blu-ui-phase` now persists substantive `XX-UI-SPEC.md` content or an explicit skip rationale in that same file.
- `/blu-plan-phase` now persists substantive `XX-YY-PLAN.md` content through the plan MCP substrate.
- `/blu-execute-phase` now persists `XX-YY-SUMMARY.md` execution evidence through the summary MCP substrates and keeps the next action explicit.
- `/blu-validate-phase` now persists `XX-VERIFICATION.md` verification evidence through the validation MCP substrates.
- `/blu-verify-work` now persists resumable `XX-UAT.md` conversational UAT evidence through the same validation MCP substrates and keeps follow-up fixes explicit.
- `/blu-add-tests` now generates focused repo tests from saved summaries plus validation or UAT evidence, updates `XX-VERIFICATION.md` through the validation MCP substrates, and persists `.blueprint/reports/add-tests-<phase>.md`.
- `/blu-fast` now ships as the trivial inline execution path; it keeps truly small repo work out of the heavier planning surface and updates `.blueprint/STATE.md` only when Blueprint is already initialized.
- `/blu-quick` now ships as the bounded lightweight execution path; it starts from project status and the runtime command catalog, keeps deeper discuss, research, and validation work opt-in, persists `.blueprint/reports/quick-run-latest.md`, and updates `.blueprint/STATE.md`.
- `/blu-debug` now ships as the structured investigation path; it persists `.blueprint/reports/debug-latest.md`, keeps diagnose-only runs confirmation-gated for fixes, and routes broader remediation into the implemented execution surface.
- `/blu-audit-milestone` audits milestone completion against original intent, writes a durable report in `.blueprint/reports/`, and keeps the follow-up inside the implemented Blueprint surface.
- `/blu-complete-milestone`, `/blu-milestone-summary`, and `/blu-new-milestone` now ship as the report-driven milestone closeout and carry-forward reset trio on the existing roadmap, artifact, and state substrates.
- `/blu-note` now ships as the project-local note capture slice; it appends duplicate-safe notes to `.blueprint/notes/NOTES.md` through Blueprint MCP and leaves list or promote behavior for later capture contracts.
- `/blu-add-todo` now ships as the project-local todo capture slice; it appends duplicate-safe todo entries to `.blueprint/todos/TODO.md` through Blueprint MCP.
- `/blu-add-backlog` now ships as the parking-lot capture slice; it appends deterministic backlog entries to `.blueprint/backlog/BACKLOG.md`, detects duplicates, and can optionally reserve a `999.x` phase stub through Blueprint MCP plus scaffolding.
- `/blu-explore` now ships as the ideation-routing capture slice; it classifies ideas into note, todo, backlog, or roadmap-ready work, requires explicit routing confirmation before any write, and persists only the confirmed target through Blueprint MCP.
- `/blu-docs-update` now verifies or refreshes selected repo docs against repo and Blueprint evidence, keeps the write scope narrow, and persists a durable `.blueprint/reports/docs-update-latest.md` report.
- `/blu-code-review` now resolves a deterministic repo-file scope from executed plans or explicit file paths, keeps findings evidence-backed, and persists `XX-REVIEW.md` through the shared review MCP tools.
- `/blu-code-review-fix` now loads saved `XX-REVIEW.md` findings through `blueprint_review_load_findings`, keeps remediation bounded to the selected issues, persists `XX-REVIEW-FIX.md`, and updates `.blueprint/STATE.md` with the next safe implemented follow-up.
- `/blu-audit-fix` now ships as the bounded remediation path; it starts from saved review or validation evidence, keeps repo mutation scoped to the deterministic review surface, persists `.blueprint/reports/audit-fix-<phase>.md`, and routes the next safe action through implemented validation or progress commands.
- `/blu-review` now ships as the phase-plan peer-review path; it reads saved plan artifacts through the plan MCP substrate, keeps reviewer availability explicit instead of assumed, and persists `XX-REVIEWS.md` through `blueprint_review_record`.
- `/blu-ui-review` now persists `XX-UI-REVIEW.md` through `blueprint_review_record`, keeps the shipped UI audit slice phase-scoped and MCP-owned, and can use `blueprint-ui-auditor` for bounded six-pillar review.
- `/blu-pr-branch` now ships as the review-branch preparation path; it keeps `.blueprint/` filtering explicit, requires confirmation before any git replay, and persists `.blueprint/reports/pr-branch-latest.md`.
- `/blu-ship` now ships as the confirmation-gated shipping path; it reuses saved verification and review evidence, separates push from PR creation, persists `.blueprint/reports/ship-latest.md`, and leaves a durable manual fallback when `gh` cannot create the PR.
- `/blu-undo` now ships as the confirmation-gated safe-revert path; it previews the revert scope first, persists `.blueprint/reports/undo-latest.md` before any git mutation, and keeps git history changes limited to explicit `git revert` style steps.
- `/blu-cleanup` now ships as the confirmation-gated cleanup path; it reads project, roadmap, and milestone closeout evidence first, persists `.blueprint/reports/cleanup-latest.md` before filesystem mutation, and never archives the current phase or active roadmap scope.
- `/blu-plan-milestone-gaps` reads the latest milestone audit, groups actionable gaps into a coherent follow-up slice, appends the approved phases through MCP roadmap tools, and routes to `/blu-discuss-phase` for the first new phase.
- `/blu-pause-work` and `/blu-resume-work` now persist the canonical handoff/report and state-routing contract across `.blueprint/reports/pause-work-latest.md` and `.blueprint/STATE.md`.
- `/blu-secure-phase` now persists `XX-SECURITY.md` through `blueprint_review_record` and keeps the shipped security review slice phase-scoped and MCP-owned.
- `/blu-add-phase` now appends the next whole-number phase, ignores decimal suffixes when numbering, scaffolds `.blueprint/phases/<phase-slug>/`, and updates `.blueprint/STATE.md`.
- `/blu-insert-phase` now inserts the next decimal phase after an existing integer phase, keeps later roadmap entries stable, scaffolds `.blueprint/phases/<decimal-phase-slug>/`, and routes back to `/blu-discuss-phase`.
- `/blu-remove-phase` now removes a future phase, deletes the matching phase directory, renumbers later roadmap references plus phase-scoped artifact filenames, and updates `.blueprint/STATE.md`.
- Shipped orchestration skills live in `skills/`, including `blueprint-phase-discovery`, `blueprint-phase-validation`, `blueprint-debug`, `blueprint-docs`, `blueprint-review`, `blueprint-roadmap-admin`, and `blueprint-maintenance`.
- Shipped agent contracts live in `agents/`, including `blueprint-researcher`, `blueprint-debugger`, `blueprint-ui-designer`, `blueprint-doc-writer`, `blueprint-doc-verifier`, `blueprint-reviewer`, `blueprint-security-auditor`, and `blueprint-ui-auditor`.

## Mutation Rules

- Commands own UX and routing.
- MCP tools own persistent reads and writes.
- Do not create or mutate Blueprint artifacts through prompt-only prose when an MCP tool is responsible for the change.
- Host docs may describe Gemini-only helpers such as `ask_user`, `write_todos`, `update_topic`, tracker tools, and resource tools, but they must also state the non-Gemini fallback posture instead of promising those helpers everywhere.
- When you need to name a Blueprint MCP tool explicitly in Gemini CLI, use the runtime FQN form `mcp_blueprint_<toolName>`.
- Never try to reach Blueprint MCP tools through shell wrappers such as `mcp use ...`, `blueprint-mcp ...`, or ad-hoc `node -e` SDK scripts. If a Blueprint MCP tool is unavailable, say the Blueprint MCP server is disconnected or undiscovered and ask the user to check `/mcp` or restart Gemini CLI.

## Router Guidance

- Prefer safe inline routing when user intent is clear.
- Recommend the best direct `/blu-<command>` entrypoint when intent is ambiguous or the next action is risky.
- Only recommend commands whose `blueprint_command_catalog` entry is `implemented`.
- For roadmap work, keep `/blu-add-phase`, `/blu-insert-phase`, `/blu-remove-phase`, `/blu-plan-milestone-gaps`, `/blu-audit-milestone`, and `/blu-list-phase-assumptions` available as the implemented Wave 2 commands until the remaining roadmap surfaces ship.
- When a command is blocked, explain the missing substrate instead of presenting it as runnable.
- Do not rely on slash-command chaining or undocumented aliases.
