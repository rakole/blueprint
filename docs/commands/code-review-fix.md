# `/blu-code-review-fix`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`code-review-fix` is Blueprint's bounded remediation command for issues already captured in a saved `XX-REVIEW.md`. Blueprint ships it as an evidence-backed follow-up step: it loads the saved findings first, narrows the fix set to explicitly selected or high-confidence auto-selected findings, persists a durable `XX-REVIEW-FIX.md` summary through the shared review MCP tool, and updates `STATE.md` so follow-up routing stays inside implemented commands. It does not currently imply atomic git commits, branch creation, or a separate fixer-agent loop.


## Command Path And Examples

- CLI command path: `/blu-code-review-fix`
- Root router form: `/blu code-review-fix`
- Argument hint: `<phase-number> [--all] [--auto]`
- `/blu-code-review-fix 3 --auto`
- `/blu code-review-fix`

`--auto` is a bounded finding-selection shortcut only. It may skip the manual finding-pick step when the saved review already contains a narrow, high-confidence fix set, but it does not authorize automatic commits, automatic PR creation, or capped re-review loops.

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
- `blueprint_artifact_contract_read` -> `{artifactId, contract, template, requiredHeadings}`
- `blueprint_review_record` -> `{reportPath, counts, followUps, status, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Remediation Contract

- Load the saved review baseline through `blueprint_review_load_findings` with `artifact: "code-review"` and treat the returned `findings`, `severityCounts`, and `followUps` as authoritative.
- Read the canonical `review.review-fix` contract through `blueprint_artifact_contract_read` before drafting or updating `XX-REVIEW-FIX.md`, and use the returned template plus headings as the baseline instead of a copied prompt-local variant.
- Do not recreate finding ids or severity from chat memory, current branch drift, or a second prompt-only review when the saved artifact already exists.
- Keep the canonical `XX-REVIEW-FIX.md` structure intact, including the `## Findings Addressed` section required by the review-fix contract.
- Persist the durable remediation summary through `blueprint_review_record` with `artifact: "review-fix"` and treat the returned `reportPath` as authoritative instead of hand-building `XX-REVIEW-FIX.md`.


## Skills And Subagents


- Primary skill: `blueprint-review`
- Optional subagents:
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

- High: bounded repo fixes to selected findings plus follow-up verification.

## User Prompts And Confirmation Gates

- Use Gemini CLI's `ask_user` tool for overwrite confirmation and for any structured confirmation of which findings Blueprint is about to fix.
- Confirm the selected findings before applying fixes unless the user explicitly approved bounded automatic selection through `--all`, `--auto`, or equivalent narrow natural-language direction.

## In-Flight Progress Contract

- Report the resolved phase, selected finding ids, remediation progress, and verification progress while the command is running, not only in the closing summary.
- Call out deferred findings, skipped checks, and remaining follow-up work explicitly as they become known.


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
- Keeps `--auto` bounded to finding selection instead of implying hidden git automation or iterative re-review.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Direct `code-review-fix` happy-path fixture.
