# `/blu-code-review`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`code-review` is Blueprint's command for review source files changed during a phase for bugs, security issues, and code quality problems. Blueprint ships it as a host-native review command: it resolves a deterministic repo-file scope from executed plan metadata or explicit file paths, honors the surfaced `workflow.code_review` and `workflow.code_review_depth` settings, audits that scope against saved phase evidence, and persists the result through the shared review MCP tools instead of prompt-only file writes.


## Command Path And Examples

- CLI command path: `/blu-code-review`
- Root router form: `/blu code-review`
- Argument hint: `<phase-number> [--depth=quick|standard|deep] [--files file1,file2,...]`
- `/blu-code-review 3 --depth=deep`
- `/blu code-review`

## Inputs, Project State, And Prerequisite Artifacts


- Executed phase artifacts or an explicit file scope must already exist.
- The normalized project config may already define `workflow.code_review` and `workflow.code_review_depth`, which influence the default review depth and the command's surfaced review posture.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable, with scope, depth, and finding-count progress reported while the review is in flight.
- Repo side effects: Writes only the declared phase-scoped review artifact for this command.


## Blueprint And Global State Reads


- `.blueprint/config.json`
- Phase resolution, artifact inventory, and review scoping through the documented phase, artifact, and review MCP tools


## Blueprint And Global State Writes


- `phase XX-REVIEW.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_review_scope` -> `{status, phase, files, reviewMode, artifacts, reason, warnings}`
- `blueprint_review_record` -> `{reportPath, counts, followUps}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`

## Review Scope Contract

- Read `blueprint_config_get` with `scope: "effective"` before choosing the default depth so the command honors the surfaced review settings.
- Call `blueprint_review_scope` with the resolved numeric `phase`.
- When explicit files are needed, pass only repo-relative file paths. Directories, wildcards, `.blueprint/**`, and absolute paths are invalid review-scope inputs.
- Omit `files` to let Blueprint derive scope from executed plans and summaries, then treat the returned `files` list as authoritative instead of widening scope from chat memory or git drift.
- If explicit files were supplied, review only those exact repo-relative paths even if the phase has broader execution evidence or saved summaries.
- If the derived scope is broad, multi-plan, or deep enough that the user should explicitly approve it, pause for a structured confirmation before any replacement write.
- Persist the final review through `blueprint_review_record` with `artifact: "code-review"` and treat the returned `reportPath` as authoritative instead of hand-building `XX-REVIEW.md`.


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
- `docs/commands/execute-phase.md`


## External Shell Or Git Dependencies


- External dependencies:
- git


## Shell Risk Profile

- Low: review artifact generation only.

## User Prompts And Confirmation Gates


- Confirm scope when automatic scoping is ambiguous.
- Use structured `ask_user` confirmation when the resolved review scope is broad, multi-plan, or deep enough that the user should approve the exact scope before the review continues.
- Require explicit overwrite confirmation before replacing an existing `XX-REVIEW.md`.


## Edge Cases


- The command scope does not match the currently changed files, branch, or phase artifacts.
- External tooling such as `git`, `gh`, or peer-review CLIs is missing or only partially available.


## Failure Modes And Recovery


- Preserve generated reports when git or external CLI steps fail.
- Fall back to explicit file selection or manual shipping guidance instead of guessing.


## Acceptance Criteria


- Produces a durable artifact for review, security, UI, or shipping work.
- Honors the surfaced `workflow.code_review` and `workflow.code_review_depth` settings.
- Never hides destructive git behavior behind an implicit step.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Never widens explicit `--files` scope beyond the user-selected files.
- Leaves unrelated repo files untouched.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Direct `code-review` happy-path fixture.
