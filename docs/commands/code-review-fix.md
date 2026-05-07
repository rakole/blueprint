# `/blu-code-review-fix`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `code-review-fix` uses the shared long-running-mutation posture: resolve the target phase, read saved findings plus the schema-first review-fix authoring context, decide the bounded remediation set and any overwrite or finding-selection gate, execute only the selected fixes, validate the review-fix model, persist that same model through MCP, and route to the next safe implemented follow-up.
- Keep the remediation posture explicit throughout the run: resolved scope must stay tied to the saved findings baseline plus the repo files implicated by those findings, pending gates stay limited to overwrite confirmation or finding-selection confirmation when those gates are triggered, execution mode should reflect whether the run stays inline or uses the reviewer subagent and whether the fix set came from explicit selection, `--all`, or bounded `--auto`, and live remediation plus verification status should come from the actual work instead of being invented after the fact.
- Detailed runtime reference: `skills/blueprint-review/references/code-review-fix-runtime-contract.md`. The command manifest should stay thin enough to point at the `blueprint-review` skill and this local reference while still naming the required MCP tools.

## Purpose


`code-review-fix` is Blueprint's bounded remediation command for issues already captured in a saved `XX-REVIEW.md`. Blueprint ships it as an evidence-backed long-running follow-up step: it loads the saved findings first, narrows the fix set to explicitly selected or high-confidence auto-selected findings, keeps the active remediation stage and pending gate visible while work is in flight, validates a schema-first `review.review-fix` model, persists that same model through the shared review MCP tool, and updates `STATE.md` so follow-up routing stays inside implemented commands. It does not currently imply atomic git commits, branch creation, or a separate fixer-agent loop.


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


- User-facing result: a concise completion summary plus the next logical action when applicable, with remediation and verification status reported while the run is in flight.
- Repo side effects: may apply bounded repo fixes, writes a durable review-fix artifact, and updates `.blueprint/STATE.md`.
- In-flight review-fix work should keep the resolved phase, resolved scope, selected finding ids, active stage, pending gate, execution mode, remediation progress, verification progress, artifact status, and next safe action legible while the run is still live.


## Blueprint And Global State Reads


- Phase resolution plus saved review findings through the documented phase and review MCP tools


## Blueprint And Global State Writes


- `phase XX-REVIEW-FIX.md`
- `code changes`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_review_load_findings` -> `{findings, severityCounts, followUps, path, warnings}`
- `blueprint_review_authoring_context` -> `{status, phase, artifact, authoringContext, reason, warnings}`; pass `targetIds` when the run selected a subset
- `blueprint_review_validate_model` -> `{status, diagnostics, diagnosticCounts, normalizedModel, renderPreview, taskSchema}`
- `blueprint_review_record` -> `{reportPath, counts, followUps, status, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Remediation Contract

- Load the saved review baseline through `blueprint_review_load_findings` with `artifact: "code-review"` and treat the returned `findings`, `severityCounts`, and `followUps` as authoritative.
- Read the `review.review-fix` authoring context through `blueprint_review_authoring_context` before drafting or updating `XX-REVIEW-FIX.md`, and use its base schema, narrowed `taskSchema`, locked markers, rendered headings, saved findings, phase execution plan/summary evidence, and dependency evidence as the baseline instead of a copied prompt-local variant.
- When remediation is scoped to selected saved findings or follow-ups, pass the exact selected saved target ids as `targetIds` to `blueprint_review_authoring_context`, `blueprint_review_validate_model`, and `blueprint_review_record`. Omit `targetIds` consistently only when the run covers the full saved baseline.
- Do not recreate finding ids or severity from chat memory, current branch drift, or a second prompt-only review when the saved artifact already exists.
- Default unscoped remediation to saved `follow-up` findings only. Observations, accepted risks, validation-only follow-ups, process notes, and stale evidence should enter the run only when the user explicitly selects them or when the command is documenting a `defer` or `skip` decision.
- Author `review.review-fix` as JSON only. Valid lifecycle statuses are `COMPLETED`, `PARTIAL`, and `BLOCKED`; locked markers are `Status`, `Readiness`, `Completion State`, and `Next Safe Action`.
- Populate the schema's camelCase fields such as `remediationSummary`, `findingsAddressed`, `changesMade`, `verification`, `dependencyPlans`, `manualOrDeferredWork`, `gapRoutes`, `followUps`, `evidence`, and `nextSafeAction`. Keep the rendered `XX-REVIEW-FIX.md` structure intact through those fields, including `## Remediation Summary`, `## Findings Addressed`, `## Changes Made`, `## Verification`, `## Dependency Plans`, `## Manual / Deferred Work`, `## Gap / Repair Routes`, `## Follow-Ups`, `## Evidence`, and `## Next Safe Action`.
- Literal rendered heading keys and locked-marker labels are forbidden in the JSON model.
- Validate the model through `blueprint_review_validate_model`, repair returned diagnostics against the task schema once, and persist the same validated model through `blueprint_review_record` with `artifact: "review-fix"` and the same `targetIds` selection. Treat the returned `reportPath` as authoritative instead of hand-building `XX-REVIEW-FIX.md`.
- Markdown `content` fallback is invalid for `review.review-fix`.
- Treat finding selection as an explicit gate before repo mutation unless the user already made the exact fix set explicit through `--all`, `--auto`, or a comparably narrow instruction.
- Keep repo mutation bounded to the selected findings and the repo files directly implicated by the saved review evidence; route broader remediation to another implemented command instead of widening this command in place.
- Treat `--auto` as bounded finding selection only. It may skip manual selection for a narrow, high-confidence saved finding set, but it does not authorize auto-fixer behavior, implicit commits, hidden iterative re-review, or an unbounded fixer loop.
- When `blueprint-reviewer` is available and the saved review is broad or ambiguous, use it only for read-only reclassification of the selected saved target ids into `fix`, `defer`, or `skip` recommendations plus stale-evidence notes. Browser, web, or search-only agents are not substitutes for codebase analysis.
- When no suitable subagent is available, use the explicit single-agent fallback from the runtime contract: work one selected target at a time, reread implicated source files, decide `fix`, `defer`, or `skip`, record stale-evidence notes when current code drift makes the saved target unsafe, apply the minimal scoped change only for `fix` decisions, verify the changed surface, record fixed/skipped/deferred evidence, and compress carry-forward context before moving to the next target.
- If `blueprint_review_validate_model` or `blueprint_review_record` rejects the review-fix model, repair against the `review.review-fix` task schema once. If the retry still fails, stop with the MCP failure reason rather than writing `XX-REVIEW-FIX.md` by hand.
- Update `.blueprint/STATE.md` through `blueprint_state_update` with `base: "synced"` plus an explicit patch that sets `activeCommand`, `currentPhase`, and `nextAction` after the remediation artifact is settled.


## Skills And Subagents


- Primary skill: `blueprint-review`
- Local runtime contract: `skills/blueprint-review/references/code-review-fix-runtime-contract.md`
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
- Keep pending gates limited to overwrite confirmation and finding-selection confirmation; broader repair planning should route to another implemented command instead of widening this command in place.

## In-Flight Progress Contract

- For non-trivial code-review-fix runs, keep the active stage visible with Gemini CLI's internal `update_topic` tool and keep a compact remediation checklist with `write_todos`.
- Keep that visible progress aligned to the resolved phase, resolved scope, selected finding ids, selected-finding mode (`explicit`, `--all`, or bounded `--auto`), active stage, pending gate, execution mode, remediation progress, verification progress, deferred findings, artifact status, and next safe action as the run moves from saved-findings review through finding-selection confirmation, bounded remediation, artifact persistence, validation, and routing.
- Treat `update_topic` and `write_todos` as session-local coordination only; when the host lacks them, report the same progress in prose instead of inventing a second persistence path.
- Call out deferred findings, skipped checks, and remaining follow-up work explicitly as they become known.


## Edge Cases


- The command scope does not match the currently changed files, branch, or phase artifacts.
- External tooling such as `git`, `gh`, or peer-review CLIs is missing or only partially available.


## Failure Modes And Recovery


- Preserve generated reports when verification or shell checks fail.
- Fall back to `/blu-code-review <phase>` when the saved review baseline is missing or too weak.
- Fall back to `/blu-progress` instead of guessing through an unclear remediation scope.
- Preserve the model diagnostics in the user-visible response when validation or persistence still fails after one schema repair retry.


## Acceptance Criteria


- Produces a durable artifact for review, security, UI, or shipping work.
- Keeps the remediation stages, pending gates, execution mode, and next safe action explicit while code-review-fix is in flight.
- Never hides destructive git behavior behind an implicit step.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Persists the durable remediation artifact through `blueprint_review_record`.
- Updates `STATE.md` when the next-step signal changes.
- Leaves unrelated repo files untouched.
- Keeps the finding-selection gate explicit and bounded to the saved review evidence.
- Keeps `--auto` bounded to finding selection instead of implying hidden git automation, auto-fixer behavior, implicit branches or commits, or iterative re-review.
- Has a capability-gated read-only subagent path and an explicit one-finding-at-a-time fallback when no suitable subagent is available.
- Repairs invalid review-fix models against the task schema once before stopping.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Direct `code-review-fix` happy-path fixture.
