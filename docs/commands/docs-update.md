# `/blu-docs-update`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`docs-update` is Blueprint's command for generate or update project documentation verified against the codebase. In Blueprint it stays Gemini-native, keeps Blueprint-owned persistence on MCP rails, and treats repo documentation edits as explicit, reviewable mutations instead of hidden side effects.


## Command Path And Examples

- Gemini command path: `/blu-docs-update`
- Root router form: `/blu docs-update`
- Argument hint: `[--force] [--verify-only]`
- `/blu-docs-update --verify-only`
- `/blu docs-update`

## Inputs, Project State, And Prerequisite Artifacts


- Repo docs and source tree must already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: may update the selected repo documentation files and persists a durable `docs-update` report in `.blueprint/reports/`.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `repo documentation files`
- `docs-update report in .blueprint/reports/`


## Required MCP Tools


- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`
- `blueprint_artifact_report_write` -> `{path, written, created, overwritten, status, warnings}`


## Skills And Subagents


- Primary skill: `blueprint-docs`
- Optional subagents:
- `blueprint-doc-writer`
- `blueprint-doc-verifier`


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/new-project.md`
- `docs/commands/map-codebase.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Medium: writes repo docs outside `.blueprint/`.

## User Prompts And Confirmation Gates


- Confirm forced regeneration before replacing heavily edited docs.
- `--verify-only` must never mutate repo documentation files.


## Edge Cases


- The command scope does not match the currently changed files, branch, or phase artifacts.
- External tooling such as `git`, `gh`, or peer-review CLIs is missing or only partially available.


## Failure Modes And Recovery


- Preserve the durable report when doc mutation is skipped, blocked, or partially applied.
- Fall back to explicit file selection or manual guidance instead of guessing a broad docs scope.


## Acceptance Criteria


- Produces or updates selected repo documentation files and a durable `.blueprint/reports/docs-update-latest.md` report.
- Never hides destructive git behavior behind an implicit step.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for Blueprint-owned persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Direct `docs-update` happy-path fixture.


