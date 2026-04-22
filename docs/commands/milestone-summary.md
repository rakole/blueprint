# `/blu-milestone-summary`
| Field | Value |
|---|---|
| Wave | `2` |
| Family | `Roadmap And Milestone` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `interactive-read` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `milestone-summary` uses the shared interactive-read classification only to keep the command metadata aligned; it performs one bounded summary report pass, keeps persistence on MCP-owned Blueprint artifacts, and does not adopt tracker-backed branching or the long-running progress layer used by mutation-heavy commands.
- Keep the waiting state explicit as `missing-milestone-audit`, `missing-milestone-complete`, or `milestone-summary-overwrite-confirmation` when the command is blocked before writing.


## Purpose


`milestone-summary` is Blueprint's command for generate a comprehensive project summary from milestone artifacts for team onboarding and review. In Blueprint it stays host-native, builds the final summary from saved roadmap and closeout evidence, writes a durable summary report for onboarding or carry-forward planning, and routes the repo to the next safe milestone-start action without pulling in later-wave documentation agents.


## Command Path And Examples

- CLI command path: `/blu-milestone-summary`
- Root router form: `/blu milestone-summary`
- Argument hint: `[version]`
- `/blu-milestone-summary v1.0`
- `/blu milestone-summary`

## Inputs, Project State, And Prerequisite Artifacts


- Matching `milestone-audit-<version>.md` and `milestone-complete-<version>.md` reports should already exist in `.blueprint/reports/`.
- Replacing an existing milestone summary report requires explicit overwrite confirmation.
- Read the canonical `report.milestone-summary` contract before drafting or revising the report.


## Outputs


- User-facing result: a concise completion summary that surfaces the source reports and evidence used, plus the next safe implemented action when applicable.
- Repo side effects: Writes a durable summary report in `.blueprint/reports/` and updates `.blueprint/STATE.md`.
- In-flight posture: none beyond a concise inline summary or overwrite confirmation gate; `milestone-summary` does not expose the long-running progress layer.


## Blueprint And Global State Reads


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`


## Blueprint And Global State Writes


- `.blueprint/reports/milestone-summary-<version>.md`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`
- `blueprint_artifact_report_write` -> `{path, written, created, overwritten, status, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Digest And Report Contract

- Read `report.milestone-summary` through `blueprint_artifact_contract_read` before drafting or revising the report, and normalize the final summary body to the returned `contract.authoringTemplate` when the contract provides one.
- Pass only repo-relative `artifactPaths` into `blueprint_artifact_summary_digest`, and treat returned `inputsUsed` as the authoritative digest scope.
- Pass only the bare report name `milestone-summary-<milestone>` into `blueprint_artifact_report_write`. Do not pass `.blueprint/reports/...`; the returned `path` is authoritative.


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
- `docs/commands/complete-milestone.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Low: report generation only.

## User Prompts And Confirmation Gates


- Require explicit confirmation before replacing an existing milestone summary report.
- Prefer Gemini CLI `ask_user` for that overwrite confirmation gate.


## Edge Cases


- Missing milestone completion report for the resolved milestone.
- Existing milestone summary report replacement.


## Failure Modes And Recovery


- Show roadmap and report drift before mutation.
- If the completion report is missing, stop with concise guidance to run `/blu-complete-milestone` first.
- If the audit report is missing, stop with concise guidance to run `/blu-audit-milestone` first.
- Return the nearest valid phase or milestone candidates when the target does not exist.


## Acceptance Criteria


- Keeps milestone summarization grounded in saved roadmap, audit, and completion evidence.
- Produces a durable report for milestone-level operations.
- Requires explicit confirmation before overwriting an existing milestone summary report.
- Does not depend on any later-wave docs agent.
- Returns `/blu-new-milestone` as the next safe implemented follow-up.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Missing-completion rejection fixture.
- Existing summary report overwrite fixture.
- Direct `milestone-summary` happy-path fixture.
