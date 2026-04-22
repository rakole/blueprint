# `/blu-ui-review`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `ui-review` uses the shared long-running-mutation posture: resolve the target phase, read saved execution and UI-spec evidence, decide whether overwrite confirmation or a bounded auditor handoff is needed, execute the six-pillar UI audit that fits the saved scope, persist the durable UI-review artifact through MCP, validate the saved audit posture, and route to the next safe implemented follow-up without widening beyond the selected phase.
- Keep the UI-audit posture explicit throughout the run: resolved scope must stay tied to the selected phase, saved execution evidence, saved `XX-UI-SPEC.md` contract when present, and the actual frontend surface under review; pending gates stay limited to overwrite confirmation; execution mode should reflect inline versus `blueprint-ui-auditor`-assisted analysis; and the artifact plus findings posture must stay legible while the audit is in flight.


## Purpose


`ui-review` is Blueprint's command for retroactive 6-pillar visual audit of implemented frontend code. Blueprint ships it as a phase-scoped UI audit command: it grounds the review in saved execution evidence plus the saved `XX-UI-SPEC.md` contract when present, can delegate bounded visual analysis to a dedicated UI auditor, and persists the finished result through the shared review MCP tool instead of prompt-only file writes.


## Command Path And Examples

- CLI command path: `/blu-ui-review`
- Root router form: `/blu ui-review`
- Argument hint: `[phase]`
- `/blu-ui-review 3`
- `/blu ui-review`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase should already have shipped UI work.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes only the declared phase-scoped UI-review artifact for this command.
- In-flight ui-review work should keep the resolved scope, active stage, saved execution and UI-spec coverage, pending gate, execution mode, whether the existing `XX-UI-REVIEW.md` artifact is being created, reused, or revised, main findings or pass signals, and next safe action legible while the run is still live.


## Blueprint And Global State Reads


- Phase resolution and artifact inventory through the documented phase and artifact MCP tools


## Blueprint And Global State Writes


- `phase XX-UI-REVIEW.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_review_record` -> `{reportPath, counts, followUps, status, warnings}`

## UI Review Artifact Contract

- Persist the durable UI audit through `blueprint_review_record` with `artifact: "ui-review"` and treat the returned `reportPath` as authoritative instead of hand-building `XX-UI-REVIEW.md`.


## Skills And Subagents


- Primary skill: `blueprint-review`
- Optional subagents:
- `blueprint-ui-auditor`


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/execute-phase.md`
- `docs/commands/ui-phase.md`


## External Shell Or Git Dependencies


- External dependencies:
- optional screenshot tooling or user-supplied visual evidence later


## Shell Risk Profile

- Low: review artifact only.

## User Prompts And Confirmation Gates


- None by default. Overwrite remains explicit confirmation when a prior `XX-UI-REVIEW.md` already exists.


## In-Flight Progress Contract

- For non-trivial ui-review runs, keep the active stage visible with Gemini CLI's internal `update_topic` tool and keep a compact UI-review checklist with `write_todos`.
- Keep that visible progress aligned to the resolved phase, saved execution and UI-spec coverage, active stage, pending gate, execution mode, whether the existing `XX-UI-REVIEW.md` artifact is being created, reused, or revised, main findings or pass signals, and next safe action as the run moves from target resolution through saved-evidence review, bounded UI analysis, artifact persistence, validation, and routing.
- Treat `update_topic` and `write_todos` as session-local visibility only; when the host lacks them, report the same progress in prose instead of inventing a second persistence path.
- Closing summary must include whether the UI-review artifact was created, reused, or revised, the main UI findings or pass signals, any explicit follow-ups, and the next safe implemented action.


## Edge Cases


- The phase contains little or no actual UI work and only a saved skip rationale in `XX-UI-SPEC.md`.
- The command scope does not match the currently changed files, branch, or phase artifacts.
- External tooling such as `git`, `gh`, or peer-review CLIs is missing or only partially available.


## Failure Modes And Recovery


- Preserve generated review artifacts when follow-up git or external CLI steps fail.
- Fall back to explicit UI evidence review or manual next-step guidance instead of guessing.


## Acceptance Criteria


- Produces a durable artifact for review, security, UI, or shipping work.
- Non-trivial ui-review runs use the shared long-running-mutation posture with visible stage and status fields.
- Grounds the audit in saved execution evidence and the UI contract when available.
- Keeps the review stages, pending gate, execution mode, artifact status, findings posture, and next safe action explicit while the UI audit is in flight.
- Never hides destructive git behavior behind an implicit step.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Phase review fixture with saved UI evidence.
- Git or external CLI availability fixture.
- Direct `ui-review` happy-path fixture.
