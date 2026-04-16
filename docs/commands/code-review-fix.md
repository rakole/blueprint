# `/blu-code-review-fix`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`code-review-fix` is Blueprint's command for auto-fix issues found by code review in REVIEW.md. Spawns fixer agent, commits each fix atomically, produces REVIEW-FIX.md summary. Blueprint ships it as a bounded, evidence-backed remediation step: it starts from the saved `XX-REVIEW.md` artifact, fixes only the explicitly selected findings, persists a durable `XX-REVIEW-FIX.md` summary through the shared review MCP tool, and updates `STATE.md` so follow-up routing stays inside implemented commands.


## Command Path And Examples

- CLI command path: `/blu-code-review-fix`
- Root router form: `/blu code-review-fix`
- Argument hint: `<phase-number> [--all] [--auto]`
- `/blu-code-review-fix 3 --auto`
- `/blu code-review-fix`

## Inputs, Project State, And Prerequisite Artifacts


- A matching XX-REVIEW.md must already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: may apply bounded repo fixes, writes a durable review-fix artifact, and updates `.blueprint/STATE.md`.


## Blueprint And Global State Reads


- Phase resolution plus saved review findings through the documented phase and review MCP tools


## Blueprint And Global State Writes


- `phase XX-REVIEW-FIX.md`
- `code changes`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_review_load_findings` -> `{findings, severityCounts, followUps, path, warnings}`
- `blueprint_review_record` -> `{reportPath, counts, followUps, status, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Remediation Contract

- Load the saved review baseline through `blueprint_review_load_findings` with `artifact: "code-review"` and treat the returned `findings`, `severityCounts`, and `followUps` as authoritative.
- Do not recreate finding ids or severity from chat memory, current branch drift, or a second prompt-only review when the saved artifact already exists.
- Persist the durable remediation summary through `blueprint_review_record` with `artifact: "review-fix"` and treat the returned `reportPath` as authoritative instead of hand-building `XX-REVIEW-FIX.md`.


## Skills And Subagents


- Primary skill: `blueprint-review`
- Optional subagents:
- `blueprint-fixer`
- `blueprint-reviewer`


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/code-review.md`


## External Shell Or Git Dependencies


- External dependencies:
- git


## Shell Risk Profile

- High: automated fixes plus optional iteration loop.

## User Prompts And Confirmation Gates


- Confirm the selected findings before applying fixes unless the user explicitly approved automatic remediation.


## Edge Cases


- The command scope does not match the currently changed files, branch, or phase artifacts.
- External tooling such as `git`, `gh`, or peer-review CLIs is missing or only partially available.


## Failure Modes And Recovery


- Preserve generated reports when verification or shell checks fail.
- Fall back to `/blu-code-review <phase>` when the saved review baseline is missing or too weak.
- Fall back to `/blu-progress` instead of guessing through an unclear remediation scope.


## Acceptance Criteria


- Produces a durable artifact for review, security, UI, or shipping work.
- Never hides destructive git behavior behind an implicit step.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Persists the durable remediation artifact through `blueprint_review_record`.
- Updates `STATE.md` when the next-step signal changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Direct `code-review-fix` happy-path fixture.

