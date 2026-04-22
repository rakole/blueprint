# `/blu-review`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `review` uses the shared long-running-mutation posture: resolve the target phase, read saved phase plans plus related evidence, decide reviewer availability and any overwrite gate, execute the bounded peer-review fan-out that is actually available, persist the durable peer-review artifact through MCP, validate the saved review posture, and route to the next safe implemented follow-up only when reviewer availability is honest and explicit.
- Keep the external review posture explicit throughout the run: resolved scope must stay tied to the saved phase plan set, pending gates stay limited to overwrite confirmation, reviewer-availability confirmation, or the visible `reviewer-availability` waiting state, execution mode should reflect explicit reviewer flags versus `--all`, and reviewer coverage plus disagreement posture must come from the real reviewer run instead of being invented after the fact.


## Purpose


`review` is Blueprint's command for request cross-AI peer review of phase plans from external AI CLIs. Blueprint now ships it as a host-native peer-review command: it reads the saved phase plan set through dedicated phase-plan MCP tools, keeps reviewer availability explicit instead of assumed, preserves reviewer disagreement honestly, and persists the final result through the shared review MCP tools instead of prompt-only file writes.


## Command Path And Examples

- CLI command path: `/blu-review`
- Root router form: `/blu review`
- Argument hint: `--phase N [--gemini] [--claude] [--codex] [--opencode] [--all]`
- `/blu-review --phase 3 --all`
- `/blu review`

## Inputs, Project State, And Prerequisite Artifacts


- Phase plans should already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes only the declared phase-scoped peer-review artifact for this command.
- In-flight review should keep the resolved scope, active stage, requested reviewer set, reviewer availability, disagreement posture, pending gate, execution mode, artifact status, and next safe action legible while the run is still live. When reviewer availability is unresolved, next-step guidance stays on `/blu-review <phase>`.

## In-Flight Progress Contract

- For non-trivial review runs, keep the active stage visible with Gemini CLI's internal `update_topic` tool and keep a compact peer-review checklist with `write_todos`.
- Keep that visible progress aligned to the resolved phase, requested reviewers, available and unavailable reviewers, active stage, pending gate, execution mode, disagreement posture, peer-review artifact status, and next safe action as the run moves from target resolution through saved-plan review, reviewer-availability confirmation, bounded peer-review execution, artifact persistence, and routing.
- Treat `update_topic` and `write_todos` as session-local visibility only; when the host lacks them, report the same progress in prose instead of inventing a second persistence path.
- When requested reviewers are unavailable or unauthenticated, keep the waiting state explicit as `reviewer-availability` and do not imply that hidden reviewer coverage exists.


## Blueprint And Global State Reads


- Phase resolution, artifact inventory, and saved plan artifacts through the documented phase, artifact, and review MCP tools


## Blueprint And Global State Writes


- `phase XX-REVIEWS.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_phase_plan_index` -> `{plans, waves, missingPlans}`
- `blueprint_phase_plan_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, validation, reason}`
- `blueprint_review_record` -> `{reportPath, counts, followUps}`

## Peer-Review Persistence Contract

- Read only the selected phase plans through `blueprint_phase_plan_read`; do not widen peer-review scope from unrelated repo drift.
- Persist the durable peer-review artifact through `blueprint_review_record` with `artifact: "peer-review"` and treat the returned `reportPath` as authoritative instead of hand-building `XX-REVIEWS.md`.
- Preserve partial reviewer coverage honestly when only some requested reviewers can run, and keep reviewer disagreement explicit in the saved artifact rather than flattening it into false consensus.


## Skills And Subagents


- Primary skill: `blueprint-review`
- Optional subagents: none


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/plan-phase.md`


## External Shell Or Git Dependencies


- External dependencies:
- Gemini, Claude, Codex, or OpenCode CLIs when available


## Shell Risk Profile

- Medium: external tool orchestration without default repo mutation.

## User Prompts And Confirmation Gates


- Use Gemini CLI's `ask_user` tool for overwrite confirmation before replacing an existing `XX-REVIEWS.md`.
- Use Gemini CLI's `ask_user` tool for any structured reviewer-availability confirmation when requested reviewers are unavailable or unauthenticated.
- Confirm which external reviewers are actually available before launching. If reviewer coverage is incomplete, keep that waiting state explicit instead of implying a hidden full fan-out.


## Edge Cases


- Peer reviewer CLIs may be installed but unauthenticated, producing a partial rather than total review fan-out.
- Different reviewers may disagree materially, which means the artifact must preserve disagreement instead of flattening it.
- The phase has plan intent but no saved `XX-YY-PLAN.md` artifacts yet.
- External tooling such as `git`, `gh`, or peer-review CLIs is missing or only partially available.


## Failure Modes And Recovery


- Preserve partial reviewer output when at least one requested reviewer completed.
- Keep the next safe action on `/blu-review <phase>` when reviewer availability is still unresolved.
- Route to `/blu-plan-phase <phase>` when the saved plan baseline is missing instead of guessing.
- Fall back to manual reviewer guidance instead of inventing reviewer coverage.


## Acceptance Criteria


- Produces a durable artifact for review, security, UI, or shipping work.
- Never hides destructive git behavior behind an implicit step.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Non-trivial review runs use the shared long-running-mutation posture with visible stage and status fields.
- Keeps reviewer availability, reviewer disagreement, pending gates, execution mode, and the waiting state explicit while peer review is in flight.
- Uses Gemini-native `ask_user` confirmation for overwrite and structured reviewer-availability decision paths.
- Keeps reviewer availability and disagreement explicit in the saved artifact.
- Leaves unrelated repo files untouched.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Direct `review` happy-path fixture.
