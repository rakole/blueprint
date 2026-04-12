# `/blu-audit-fix`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Autonomous audit-to-fix pipeline — find issues, classify, fix, test, commit |


## Purpose


`audit-fix` carries forward the GSD intent to autonomous audit-to-fix pipeline — find issues, classify, fix, test, commit. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu-audit-fix`
- Compatibility during this release: `/blu:audit-fix` (deprecated; remove next release)
- Root router form: `/blu audit-fix`
- Argument hint: `--source <audit-uat> [--severity <medium|high|all>] [--max N] [--dry-run]`
- `/blu-audit-fix --dry-run`
- `/blu audit-fix`

## Inputs, Project State, And Prerequisite Artifacts


- A suitable audit source must exist or be computable.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `audit-fix report in .blueprint/reports/`
- `code changes when not dry-running`
- `optional todo follow-ups`


## Required MCP Tools


- `blueprint_review_scope` -> `{phase, files, reviewMode}`
- `blueprint_review_record` -> `{reportPath, counts, followUps}`
- `blueprint_artifact_mutate_index` -> `{targetPath, createdEntryIds, updatedCounts}`
- `blueprint_state_update` -> `{updatedFields, statePath}`


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


- Confirm severity threshold and max fix count before mutation.


## Edge Cases


- The command scope does not match the currently changed files, branch, or phase artifacts.
- External tooling such as `git`, `gh`, or peer-review CLIs is missing or only partially available.


## Failure Modes And Recovery


- Preserve generated reports when git or external CLI steps fail.
- Fall back to explicit file selection or manual shipping guidance instead of guessing.


## Acceptance Criteria


- Produces a durable artifact for review, security, UI, or shipping work.
- Never hides destructive git behavior behind an implicit step.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Direct `audit-fix` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/audit-fix.md`
- Upstream workflow status: GSD has an upstream workflow file
