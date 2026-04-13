# `/blu-review`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`review` is Blueprint's command for request cross-AI peer review of phase plans from external AI CLIs. Blueprint now ships it as a Gemini-native peer-review command: it reads the saved phase plan set through dedicated phase-plan MCP tools, keeps reviewer availability explicit instead of assumed, preserves reviewer disagreement honestly, and persists the final result through the shared review MCP tools instead of prompt-only file writes.


## Command Path And Examples

- Gemini command path: `/blu-review`
- Root router form: `/blu review`
- Argument hint: `--phase N [--gemini] [--claude] [--codex] [--opencode] [--all]`
- `/blu-review --phase 3 --all`
- `/blu review`

## Inputs, Project State, And Prerequisite Artifacts


- Phase plans should already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes only the declared phase-scoped peer-review artifact for this command.


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


- Confirm which external reviewers are actually available before launching.
- Require explicit overwrite confirmation before replacing an existing `XX-REVIEWS.md`.


## Edge Cases


- Peer reviewer CLIs may be installed but unauthenticated, producing a partial rather than total review fan-out.
- Different reviewers may disagree materially, which means the artifact must preserve disagreement instead of flattening it.
- The phase has plan intent but no saved `XX-YY-PLAN.md` artifacts yet.
- External tooling such as `git`, `gh`, or peer-review CLIs is missing or only partially available.


## Failure Modes And Recovery


- Preserve partial reviewer output when at least one requested reviewer completed.
- Route to `/blu-plan-phase <phase>` when the saved plan baseline is missing instead of guessing.
- Fall back to manual reviewer guidance instead of inventing reviewer coverage.


## Acceptance Criteria


- Produces a durable artifact for review, security, UI, or shipping work.
- Never hides destructive git behavior behind an implicit step.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Keeps reviewer availability and disagreement explicit in the saved artifact.
- Leaves unrelated repo files untouched.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Direct `review` happy-path fixture.


