# `/blu-secure-phase`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Retroactively verify threat mitigations for a completed phase |


## Purpose


`secure-phase` carries forward the GSD intent to retroactively verify threat mitigations for a completed phase. Blueprint ships it as a Gemini-native security audit command: it reads saved phase evidence, drafts a phase-scoped security review, and persists the result through the dedicated review MCP tool instead of prompt-only file writes.


## Command Path And Examples

- Gemini command path: `/blu-secure-phase`
- Root router form: `/blu secure-phase`
- Argument hint: `[phase number]`
- `/blu-secure-phase 3`
- `/blu secure-phase`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase must already have executed artifacts.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes only the declared phase-scoped security artifact for this command.


## Blueprint And Global State Reads


- Phase resolution and artifact inventory through the documented phase and artifact MCP tools


## Blueprint And Global State Writes


- `phase XX-SECURITY.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_review_record` -> `{reportPath, counts, followUps}`


## Skills And Subagents


- Primary skill: `blueprint-review`
- Optional subagents:
- `blueprint-security-auditor`


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
- none


## Shell Risk Profile

- Low: audit artifact only.

## User Prompts And Confirmation Gates


- None unless follow-up fixes are requested immediately.


## Edge Cases


- The command scope does not match the currently changed files, branch, or phase artifacts.
- External tooling such as `git`, `gh`, or peer-review CLIs is missing or only partially available.


## Failure Modes And Recovery


- Preserve generated security artifacts when the audit needs revision or external context is incomplete.
- Fall back to explicit evidence gaps and the safest implemented next step instead of guessing missing mitigations.


## Acceptance Criteria


- Produces a durable artifact for review, security, UI, or shipping work.
- Never hides destructive git behavior behind an implicit step.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Direct `secure-phase` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/secure-phase.md`
- Upstream workflow status: GSD has an upstream workflow file
