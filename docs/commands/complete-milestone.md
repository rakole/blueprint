# `/blu-complete-milestone`
| Field | Value |
|---|---|
| Wave | `2` |
| Family | `Roadmap And Milestone` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `interactive-read` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `complete-milestone` uses the shared interactive-read classification only to keep the command metadata aligned; it performs one bounded closeout decision and report write, keeps persistence on MCP-owned Blueprint artifacts, and does not adopt tracker-backed branching or the long-running progress layer used by mutation-heavy commands.
- Keep the waiting state explicit as `missing-milestone-audit`, `milestone-not-ready`, or `milestone-complete-overwrite-confirmation` when the command is blocked before writing.


## Purpose


`complete-milestone` is Blueprint's command for archive a completed milestone and prepare for the next version. In Blueprint it stays host-native, uses a report-driven closeout flow gated by a saved milestone audit that is already `READY_TO_CLOSE` with no actionable gaps or blockers, writes a durable completion report, and re-anchors state on the saved audit's next safe follow-up instead of introducing a new milestone-state engine.


## Command Path And Examples

- CLI command path: `/blu-complete-milestone`
- Root router form: `/blu complete-milestone`
- Argument hint: `<version>`
- `/blu-complete-milestone v1.0`
- `/blu complete-milestone`

## Inputs, Project State, And Prerequisite Artifacts


- A matching `milestone-audit-<version>.md` report should already exist in `.blueprint/reports/`, and its saved verdict should already be `READY_TO_CLOSE`.
- The audit report should have no actionable gaps or archival blockers left open, and the milestone should already have saved verification and UAT evidence for every completed phase.
- Replacing an existing milestone completion report requires explicit overwrite confirmation.
- Read the canonical `report.milestone-complete` contract before drafting or revising the report.


## Outputs


- User-facing result: a concise completion summary that surfaces the audit readiness, evidence used, report status, and the next safe implemented action when applicable.
- Repo side effects: Writes a durable milestone completion report in `.blueprint/reports/` and updates `.blueprint/STATE.md`.
- In-flight posture: none beyond a concise inline summary or overwrite confirmation gate; `complete-milestone` does not expose the long-running progress layer.


## Blueprint And Global State Reads


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}` where `derivedStatus.milestoneAudit` carries the saved audit verdict, gap/blocker signals, next safe action, and `readyForCompletion`
- `blueprint_artifact_contract_read` -> `{artifactId, contract}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`


## Blueprint And Global State Writes


- `.blueprint/reports/milestone-complete-<version>.md`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}` where `derivedStatus.milestoneAudit` carries the saved audit verdict, gap/blocker signals, next safe action, and `readyForCompletion`
- `blueprint_artifact_contract_read` -> `{artifactId, contract}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`
- `blueprint_artifact_report_write` -> `{path, written, created, overwritten, status, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Digest And Report Contract

- Read `report.milestone-complete` through `blueprint_artifact_contract_read` before drafting or revising the report, and normalize the final completion body to the returned `contract.authoringTemplate` when the contract provides one.
- Pass only repo-relative `artifactPaths` into `blueprint_artifact_summary_digest`, and treat returned `inputsUsed` as the authoritative digest scope.
- Pass only the bare report name `milestone-complete-<milestone>` into `blueprint_artifact_report_write`. Do not pass `.blueprint/reports/...`; the returned `path` is authoritative.


## Skills And Subagents


- Primary skill: `blueprint-roadmap-admin`
- Optional subagents: none


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/audit-milestone.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Medium: writes milestone closeout evidence and advances the milestone archival flow.

## User Prompts And Confirmation Gates


- Require explicit confirmation before replacing an existing milestone completion report.
- Confirm the resolved milestone before writing the completion report when the user passed an ambiguous version or name.
- Prefer Gemini CLI `ask_user` for that overwrite or ambiguity confirmation gate.


## Edge Cases


- Existing milestone completion report replacement.
- Missing milestone audit report for the resolved milestone.


## Failure Modes And Recovery


- Show roadmap and report drift before mutation.
- If the milestone audit report is missing, stop with concise guidance to run `/blu-audit-milestone` first.
- If the saved milestone audit is not `READY_TO_CLOSE`, route to the saved audit's `nextSafeAction` when present, otherwise to `/blu-plan-milestone-gaps` when actionable gaps or blockers remain, and only fall back to `/blu-progress` when the report is malformed or undecidable.
- Return the nearest valid phase or milestone candidates when the target does not exist.


## Acceptance Criteria


- Keeps milestone closeout grounded in the saved roadmap and audit report rather than chat memory.
- Produces a durable report for milestone-level operations.
- Requires explicit confirmation before overwriting an existing completion report.
- Fails fast until `derivedStatus.milestoneAudit.readyForCompletion` is true.
- Does not rewrite `.blueprint/ROADMAP.md` or phase directories directly.
- Returns `/blu-milestone-summary <milestone>` as the next safe implemented follow-up.
- Prefers the saved audit's next safe action or `/blu-plan-milestone-gaps` instead of looping back into `/blu-audit-milestone` when the audit already exists but is not ready.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Missing-audit rejection fixture.
- Existing completion report overwrite fixture.
- Direct `complete-milestone` happy-path fixture.
