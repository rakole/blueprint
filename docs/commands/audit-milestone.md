# `/blu-audit-milestone`
| Field | Value |
|---|---|
| Wave | `2` |
| Family | `Roadmap And Milestone` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Audit milestone completion against original intent before archiving |


## Purpose


`audit-milestone` carries forward the GSD intent to audit milestone completion against original intent before archiving. In Blueprint it stays Gemini-native, compares roadmap intent against saved phase evidence, and writes a durable milestone audit report before any archival step is attempted.


## Command Path And Examples

- Gemini command path: `/blu-audit-milestone`
- Root router form: `/blu audit-milestone`
- Argument hint: `[version]`
- `/blu-audit-milestone v1.0`
- `/blu audit-milestone`

## Inputs, Project State, And Prerequisite Artifacts


- A roadmap and at least one completed phase evidence set should exist.
- An existing audit report should only be replaced with explicit confirmation.


## Outputs


- User-facing result: a concise completion summary plus the next safe implemented action when applicable.
- Repo side effects: Writes a durable milestone audit report in `.blueprint/reports/`.


## Blueprint And Global State Reads


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_phase_summary_index` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, summaries, completedPlans, pendingPlans, warnings}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`


## Blueprint And Global State Writes


- `milestone audit report in .blueprint/reports/`


## Required MCP Tools


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_phase_summary_index` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, summaries, completedPlans, pendingPlans, warnings}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`
- `blueprint_artifact_report_write` -> `{path, written, created, overwritten, status, warnings}`


## Skills And Subagents


- Primary skill: `blueprint-roadmap-admin`
- Optional subagents:
- `blueprint-verifier`


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/execute-phase.md`
- `docs/commands/verify-work.md`
- `docs/commands/plan-milestone-gaps.md`
- `docs/commands/complete-milestone.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Low: report generation only.

## User Prompts And Confirmation Gates


- Require explicit confirmation before replacing an existing milestone audit report.


## Edge Cases


- Existing audit report replacement.


## Failure Modes And Recovery


- Show roadmap and phase-directory drift before mutation.
- Return the nearest valid phase or milestone candidates when the target does not exist.
- If the audit surfaces actionable gaps, route to `/blu-plan-milestone-gaps`; otherwise route to `/blu-progress`.


## Acceptance Criteria


- Keeps roadmap, phase directories, and state synchronized.
- Produces a durable report for milestone-level operations.
- Requires explicit confirmation before overwriting an existing audit report.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Roadmap mutation fixture.
- Renumbering or archival regression fixture.
- Direct `audit-milestone` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/audit-milestone.md`
- Upstream workflow status: GSD has an upstream workflow file
