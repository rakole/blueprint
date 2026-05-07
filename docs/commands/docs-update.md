# `/blu-docs-update`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `docs-update` uses the shared long-running-mutation posture: resolve the selected documentation scope, read the selected docs plus saved Blueprint and code evidence, decide whether external verification, broad-scope confirmation, or overwrite confirmation is needed, execute a bounded verify-only or update pass, persist the durable report through MCP, validate the saved report posture, and route only to the next safe implemented follow-up.
- Keep the documentation evidence posture explicit throughout the run: resolved scope must stay tied to the selected doc files plus the digest `inputsUsed`, pending gates stay limited to broad-scope confirmation, doc overwrite confirmation, or report overwrite confirmation, execution mode should reflect `--verify-only` versus update plus inline versus `blueprint-doc-writer` or `blueprint-doc-verifier` assistance, and repo truth must stay distinct from cited external truth whenever the run actually uses outside sources.

## Purpose


`docs-update` is Blueprint's command for generating, refreshing, or verifying selected project documentation against saved Blueprint evidence and the live repo. Blueprint ships it as a scoped documentation command: it keeps repo-doc edits explicit and reviewable, keeps Blueprint-owned persistence on MCP rails, and treats external source checks as optional cited evidence instead of a substitute for repo truth.


## Command Path And Examples

- CLI command path: `/blu-docs-update`
- Root router form: `/blu docs-update`
- Argument hint: `[--force] [--verify-only]`
- `/blu-docs-update --verify-only`
- `/blu docs-update`

## Inputs, Project State, And Prerequisite Artifacts


- Selected repo docs and the related source tree must already exist.
- Broad repo-doc refreshes depend on saved Blueprint evidence, especially the `.blueprint/codebase/` bundle from `/blu-map-codebase`.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable, with scope, evidence posture, and report status reported while the run is in flight.
- Repo side effects: may update the selected repo documentation files and persists a durable `docs-update` report in `.blueprint/reports/`.
- In-flight docs-update work should keep the resolved doc scope, active stage, pending gate, execution mode, repo-truth versus external-truth posture, repo-doc mutation status, report status, and next safe action legible while the run is still live.

## In-Flight Progress Contract

- For non-trivial docs-update runs, keep the active stage visible with Gemini CLI's internal `update_topic` tool and keep a compact docs-update checklist with `write_todos`.
- Keep that visible progress aligned to the resolved doc scope, digest-backed evidence set, active stage, pending gate, execution mode, whether the run is verify-only or update mode, whether the current pass stays inline or uses `blueprint-doc-writer` or `blueprint-doc-verifier`, the repo-truth versus external-truth posture, repo-doc mutation status, report status, and next safe action as the run moves from scope resolution through evidence review, optional external verification, drafting or verification, report persistence, and routing.
- Treat `update_topic` and `write_todos` as session-local visibility only; when the host lacks them, report the same progress in prose instead of inventing a second persistence path.
- Keep the pending gate explicit as `none`, broad-scope confirmation, doc overwrite confirmation, or report overwrite confirmation. When a broad refresh is blocked because the `.blueprint/codebase/` bundle is missing, keep the next safe action on `/blu-map-codebase` until that evidence exists.


## Blueprint And Global State Reads


- Effective workflow config through `blueprint_config_get` before any optional doc-writer or doc-verifier decision
- Project status and artifact inventory through the documented project and artifact MCP tools
- Digest-backed Blueprint evidence for the selected docs through `blueprint_artifact_summary_digest`


## Blueprint And Global State Writes


- `repo documentation files`
- `docs-update report in .blueprint/reports/`


## Required MCP Tools


- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`
- `blueprint_artifact_report_write` -> `{path, written, created, overwritten, status, warnings}`

## Digest And Report Contract

- Read effective config through `blueprint_config_get` before deciding whether to use `blueprint-doc-writer`, `blueprint-doc-verifier`, or the inline fallback.
- Pass only repo-relative `artifactPaths`, `docFiles`, `sourceFiles`, and `testFiles` to `blueprint_artifact_summary_digest`.
- Treat the returned `inputsUsed` list as the authoritative digest scope instead of re-describing or widening the evidence set afterward.
- Treat digest-backed repo files and saved Blueprint artifacts as repo truth. When external verification is genuinely needed, keep cited external truth separate in the report instead of flattening it into the same evidence claim.
- Persist the durable docs report through `blueprint_artifact_report_write` with the bare report name `docs-update-latest`, not a `.blueprint/reports/...` path.
- Treat the returned report `path` as authoritative.


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


- Require explicit confirmation before broad repo-doc sweeps that go beyond the default narrow README-plus-top-level-doc scope.
- Confirm forced regeneration before replacing heavily edited docs.
- Require explicit overwrite confirmation before replacing the canonical `docs-update-latest` report unless the user passed `--force`.
- `--verify-only` must never mutate repo documentation files.


## Edge Cases


- The command scope does not match the currently changed files, branch, or phase artifacts.
- The repo docs are accurate for repo truth but the user also wants external API, library, or product facts verified against current outside sources.
- A broad docs refresh is requested before the repo has a saved `.blueprint/codebase/` mapping bundle.
- External web verification tooling is unavailable, so the run has to stay on repo truth only.


## Failure Modes And Recovery


- Preserve the durable report when doc mutation is skipped, blocked, or partially applied.
- Continue with repo truth only and report that external verification was skipped when web tools are unavailable.
- Route broad evidence-light refreshes to `/blu-map-codebase` instead of improvising documentation from chat memory.
- Fall back to explicit file selection or manual guidance instead of guessing a broad docs scope.


## Acceptance Criteria


- Produces or updates selected repo documentation files and a durable `.blueprint/reports/docs-update-latest.md` report.
- Non-trivial docs-update runs use the shared long-running-mutation posture with visible stage and status fields.
- Keeps repo truth and cited external truth explicit while docs-update is in flight and in the saved report when outside sources are used.
- Never broadens into repo-wide doc sweeps without explicit confirmation.
- Never hides destructive git behavior behind an implicit step.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for Blueprint-owned persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Narrow repo-doc refresh fixture with digest-backed evidence.
- External verification unavailable fixture.
- Direct `docs-update` happy-path fixture.
