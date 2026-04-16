# `/blu-audit-fix`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`audit-fix` is Blueprint's command for autonomous audit-to-fix pipeline — find issues, classify, fix, test, commit. Blueprint ships it as a bounded, evidence-backed remediation loop: it resolves a deterministic repo-file scope from saved phase execution metadata, reads the most relevant review and verification artifacts first, keeps repo mutation tightly scoped, persists a durable `.blueprint/reports/audit-fix-<phase>.md` report, and updates `STATE.md` so follow-up routing stays inside implemented commands.


## Command Path And Examples

- CLI command path: `/blu-audit-fix`
- Root router form: `/blu audit-fix`
- Argument hint: `--source <audit-uat> [--severity <medium|high|all>] [--max N] [--dry-run]`
- `/blu-audit-fix --dry-run`
- `/blu audit-fix`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase must already have execution summaries or an explicit repo-file scope.
- At least one of `XX-REVIEW.md`, `XX-SECURITY.md`, `XX-VERIFICATION.md`, or `XX-UAT.md` should already exist so the remediation pass starts from saved evidence instead of chat memory.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: may apply bounded repo fixes when not dry-running, writes a durable remediation report under `.blueprint/reports/`, may capture an explicit todo follow-up, and updates `.blueprint/STATE.md`.


## Blueprint And Global State Reads


- Phase resolution and saved artifact inventory through the documented phase, artifact, and review MCP tools


## Blueprint And Global State Writes


- `.blueprint/reports/audit-fix-<phase>.md`
- `code changes when not dry-running`
- `optional todo follow-ups`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_review_scope` -> `{status, phase, files, reviewMode, artifacts, reason, warnings}`
- `blueprint_artifact_report_write` -> `{path, written, created, overwritten, status, warnings}`
- `blueprint_artifact_mutate_index` -> `{targetPath, createdEntryIds, updatedCounts}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Remediation Scope And Report Contract

- Call `blueprint_review_scope` with the resolved numeric `phase`.
- When explicit files are needed, pass only repo-relative file paths. Directories, wildcards, `.blueprint/**`, and absolute paths are invalid review-scope inputs.
- Omit `files` to let Blueprint derive scope from executed plans and summaries, then treat the returned `files` list as authoritative instead of widening scope from git drift or chat memory.
- Persist the durable remediation report through `blueprint_artifact_report_write` with the bare report name `audit-fix-<phase>`, not a `.blueprint/reports/...` path, and treat the returned `path` as authoritative.
- When capturing a todo follow-up, append through `blueprint_artifact_mutate_index` and treat the returned `createdEntryIds` as authoritative instead of inventing todo ids manually.


## Skills And Subagents


- Primary skill: `blueprint-review`
- Optional subagents:
- `blueprint-reviewer`
- `blueprint-fixer`
- `blueprint-verifier`


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/code-review.md`
- `docs/commands/verify-work.md`


## External Shell Or Git Dependencies


- External dependencies:
- git
- test runners


## Shell Risk Profile

- High: classification plus automated remediation.

## User Prompts And Confirmation Gates


- Confirm before applying non-trivial fixes unless the user explicitly requested automatic remediation.
- Confirm before capturing a follow-up todo.


## Edge Cases


- The command scope does not match the currently changed files, branch, or phase artifacts.
- External tooling such as `git`, `gh`, or peer-review CLIs is missing or only partially available.


## Failure Modes And Recovery


- Preserve the durable audit-fix report even when verification or shell checks fail.
- Route to `/blu-code-review <phase>` or `/blu-verify-work <phase>` when the remediation baseline is too weak instead of guessing through missing evidence.
- Fall back to explicit file selection or `/blu-progress` instead of guessing through an unclear fix scope.


## Acceptance Criteria


- Produces a durable artifact for review, security, UI, or shipping work.
- Never hides destructive git behavior behind an implicit step.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Persists the durable remediation report through `blueprint_artifact_report_write`.
- Updates `STATE.md` when the next-step signal changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Direct `audit-fix` happy-path fixture.

