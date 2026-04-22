# `/blu-plan-milestone-gaps`
| Field | Value |
|---|---|
| Wave | `2` |
| Family | `Roadmap And Milestone` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `interactive-read` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `plan-milestone-gaps` uses the shared interactive-read classification only to keep the command metadata aligned; it performs one bounded audit-follow-up roadmap planning pass, keeps persistence on MCP-owned Blueprint artifacts, and does not adopt tracker-backed branching or the long-running progress layer used by mutation-heavy commands.
- Keep the waiting state explicit as `missing-milestone-audit` when the source report is unavailable, `no-actionable-gaps` when no roadmap mutation is needed, and `gap-plan-confirmation` while the grouped plan is waiting for approval.


## Purpose


`plan-milestone-gaps` is Blueprint's command for create phases to close all gaps identified by milestone audit. In Blueprint it stays host-native, keeps the flow audit-first, groups related gaps into a few coherent follow-up phases, and delegates roadmap/state persistence to documented MCP tools instead of direct file rewrites or code/git mutation.


## Command Path And Examples

- CLI command path: `/blu-plan-milestone-gaps`
- Root router form: `/blu plan-milestone-gaps`
- Argument hint: `none`
- `/blu-plan-milestone-gaps`
- `/blu plan-milestone-gaps`

## Inputs, Project State, And Prerequisite Artifacts


- A milestone audit report should already exist in `.blueprint/reports/`.
- The command should use the current roadmap context plus the latest matching audit report to decide whether any new gap-closure phases are needed.
- The audit report should already carry grouped requirement, integration, flow, and optional sections so traceability repair can happen before any roadmap append.


## Outputs


- User-facing result: a concise “Gap Closure Plan” review plus a completion summary and the next safe implemented action when applicable.
- Repo side effects: Appends approved gap-closure phases to the roadmap, creates the matching phase directories, and updates `.blueprint/STATE.md`.
- In-flight posture: none beyond a concise inline review or confirmation gate; `plan-milestone-gaps` does not expose the long-running progress layer.


## Blueprint And Global State Reads


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`


## Blueprint And Global State Writes


- `.blueprint/ROADMAP.md`
- `new phase directories for approved gaps`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_roadmap_add_phase` -> `{phaseNumber, phaseDir, roadmapPath}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Structured Gap Contract

- Pass only repo-relative `artifactPaths` into `blueprint_artifact_summary_digest`, and treat returned `inputsUsed` as the authoritative digest scope.
- Let `blueprint_roadmap_add_phase` assign each new phase number. Treat returned `phaseNumber`, `phasePrefix`, and `phaseDir` as authoritative instead of inventing numbering or slugs manually.
- Present the digest and plan using grouped `## Requirement Gaps`, `## Integration Gaps`, `## Flow Gaps`, and `## Optional Gaps` sections so the plan stays reviewable.
- Call out any requirements traceability repair needed for each proposed phase instead of folding it into a generic bucket.


## Skills And Subagents


- Primary skill: `blueprint-roadmap-admin`
- Optional subagents:
- `blueprint-roadmapper`


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/audit-milestone.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Medium: can add multiple phases in one pass.

## User Prompts And Confirmation Gates


- Prefer Gemini CLI `ask_user` for the grouped gap-closure confirmation gate before writing any new phases.


## Edge Cases


- No matching milestone audit report exists yet.
- The audit report exists but contains no actionable gaps.
- The audit contains optional or nice-to-have gaps that should be separated from must-close follow-up work.


## Failure Modes And Recovery


- Show roadmap and phase-directory drift before mutation.
- Stop with concise guidance to run `/blu-audit-milestone` first when no matching audit report exists.
- If the audit contains no actionable gaps, stop without mutation and route to `/blu-progress`.
- Return the nearest valid phase or milestone candidates when the target does not exist.


## Acceptance Criteria


- Keeps roadmap, phase directories, and state synchronized.
- Uses a real milestone audit report as the source of truth for gap planning.
- Groups related gaps into a few coherent phases instead of blindly creating one phase per gap.
- Preserves the structured gap sections and any requirements traceability repair notes needed for closure.
- Requires one explicit confirmation before appending any gap-closure phases.
- Updates `.blueprint/STATE.md` so the first new phase becomes current and `/blu-discuss-phase <phase>` is the next safe implemented action.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Missing-audit rejection fixture.
- No-actionable-gaps fixture.
- Grouped gap-closure review fixture.
- Direct `plan-milestone-gaps` happy-path fixture.
