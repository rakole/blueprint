# `/blu-code-review`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- `code-review` uses the shared long-running-mutation posture.
- The detailed stage vocabulary, in-flight status fields, and progress semantics live in `skills/blueprint-review/references/code-review-runtime-contract.md`.
- Runtime contract reference: `skills/blueprint-review/references/code-review-runtime-contract.md` owns depth-specific review semantics, artifact richness, capability-gated reviewer use, no-subagent fallback, and MCP retry/repair behavior.


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
- In-flight code review should keep the shared review posture from the runtime contract legible while the run is still live.

## In-Flight Progress Contract

- For non-trivial code-review runs, keep the active stage visible with Gemini CLI's internal `update_topic` tool and keep a compact review checklist with `write_todos`.
- Keep that visible progress aligned to the shared review posture defined in `skills/blueprint-review/references/code-review-runtime-contract.md` as the run moves from evidence review through scope confirmation, bounded findings analysis, artifact persistence, and routing.
- Treat `update_topic` and `write_todos` as session-local coordination only; when the host lacks them, report the same progress in prose instead of inventing a second persistence path.


## Blueprint And Global State Reads


- `.blueprint/config.json`
- Phase resolution, artifact inventory, and review scoping through the documented phase, artifact, and review MCP tools


## Blueprint And Global State Writes


- `phase XX-REVIEW.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_artifact_contract_read` -> `{id, requiredHeadings, lockedMarkers, authoringTemplate, notes}`
- `blueprint_review_scope` -> `{status, phase, files, reviewMode, confirmationRecommended, artifacts, reason, warnings}`
- `blueprint_review_load_findings` -> `{findings, severityCounts, followUps, path, warnings}`
- `blueprint_review_record` -> `{reportPath, counts, followUps}`

## Review Scope Contract

- Call `blueprint_review_scope` with the resolved numeric `phase` and treat it as the authoritative source for effective review depth, whether review is enabled, saved evidence inventory, the deterministic repo-file scope, and deterministic scope-confirmation guidance.
- When explicit files are needed, pass only repo-relative file paths. Directories, wildcards, `.blueprint/**`, and absolute paths are invalid review-scope inputs. Missing files and non-file entries are also invalid, and any invalid explicit entry must fail the whole explicit scope instead of silently narrowing it.
- Omit `files` to let Blueprint derive scope from executed plans and summaries, then treat the returned `files` list as authoritative instead of widening scope from chat memory or git drift.
- If explicit files were supplied, review only those exact repo-relative paths even if the phase has broader execution evidence or saved summaries.
- If `blueprint_review_scope.confirmationRecommended.recommended` is true, pause for a structured confirmation before any replacement write and ground that prompt in the returned reasons and thresholds.
- If a prior `XX-REVIEW.md` exists, load its structured findings through `blueprint_review_load_findings` before replacement, and use read-only file access for full-body comparison only when needed.
- Persist the final review through `blueprint_review_record` with `artifact: "code-review"` plus the resolved `scopeFiles`, and treat the returned `reportPath` as authoritative instead of hand-building `XX-REVIEW.md`.

## Depth And Output Quality Contract

- `quick` reviews scan the resolved files for high-signal correctness, security, unsafe API, debug-artifact, and obvious test-gap patterns. They must not claim deep cross-file confidence.
- `standard` reviews read every resolved file and apply behavior, security, error-handling, language-aware, and test-coverage checks in context.
- `deep` reviews add import/export, call-chain, boundary-type, error-propagation, and shared-state consistency checks across the resolved file set. If the scope is too broad for a credible deep pass, ask for scope confirmation or recommend narrowing instead of saving a thin review.
- Every material finding must include severity, disposition, repo-relative file path and line or line range, evidence, impact, and a concrete fix or verification suggestion.
- The saved artifact must list every reviewed file in `Scope Reviewed`, every saved artifact that influenced the result in `Evidence Reviewed`, matching critical/high/medium/low/unknown counts in `Severity Summary`, and only implemented commands in `Next Safe Action`.

## Subagent And Fallback Contract

- Use `blueprint-reviewer` only when a suitable code-analysis subagent is available and the scope spans multiple plans, many files, risky surfaces, a prior review revision, or `--depth=deep`.
- Do not substitute browser, web-search-only, shell-only, or generic page-inspection helpers for `blueprint-reviewer`.
- If the reviewer subagent is unavailable or unnecessary, use the sequential no-subagent fallback from `skills/blueprint-review/references/code-review-runtime-contract.md`: read saved evidence first, review one file group at a time, compress carry-forward context after each group, and run a final severity-count consistency pass before persistence.


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


- None for the normal review path. The command should stay grounded in saved Blueprint evidence and the resolved repo files instead of git drift or external CLIs.


## Shell Risk Profile

- Low: review artifact generation only.

## User Prompts And Confirmation Gates


- Confirm scope when automatic scoping is ambiguous.
- Use structured `ask_user` confirmation when the resolved review scope is broad, multi-plan, or deep enough that the user should approve the exact scope before the review continues.
- Require explicit overwrite confirmation before replacing an existing `XX-REVIEW.md`.


## Edge Cases


- The command scope does not match the currently changed files, branch, or phase artifacts.
- An explicit `--files` request contains even one invalid path and must be rejected instead of narrowed.


## Failure Modes And Recovery


- Preserve generated reports when review persistence needs overwrite confirmation or artifact repair.
- Fall back to explicit file selection or saved-evidence recovery guidance instead of guessing.
- If `blueprint_review_record` returns `status: "invalid"`, repair the authored markdown against the canonical `authoringTemplate` and returned warnings, retry once through MCP, and stop with the invalid reasons if the retry still fails.


## Acceptance Criteria


- Produces a durable `phase XX-REVIEW.md` artifact for `/blu-code-review`.
- Honors the review enablement, depth defaults, and evidence inventory surfaced through `blueprint_review_scope`.
- Keeps the review stages, pending gates, execution mode, finding posture, and next safe action explicit while code review is in flight.
- Rejects any explicit `--files` scope that contains invalid entries instead of silently narrowing it.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Never widens explicit `--files` scope beyond the user-selected files.
- Leaves unrelated repo files untouched.


## Test Cases


- Phase review fixture with saved summary or plan evidence.
- Explicit `--files` rejection fixture with invalid paths.
- Direct `code-review` happy-path fixture.
