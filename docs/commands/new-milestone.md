# `/blu-new-milestone`
| Field | Value |
|---|---|
| Wave | `2` |
| Family | `Roadmap And Milestone` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`new-milestone` is Blueprint's command for start a new milestone cycle — update PROJECT.md and route to requirements. In Blueprint it stays host-native, defaults to carry-forward from the saved milestone summary, rewrites the starter milestone docs through the existing scaffold flow, preserves historical phase artifacts, and starts the new milestone at the next whole-number phase instead of renumbering prior work.


## Command Path And Examples

- CLI command path: `/blu-new-milestone`
- Root router form: `/blu new-milestone`
- Argument hint: `[milestone name, e.g., 'v1.1 Notifications']`
- `/blu-new-milestone v1.1-Platform`
- `/blu new-milestone`

## Inputs, Project State, And Prerequisite Artifacts


- A Blueprint project must already exist.
- A matching `milestone-summary-<version>.md` report should already exist in `.blueprint/reports/`.
- Carry-forward is the default. A fresh reset is allowed only after explicit confirmation.
- Replacing the existing top-level milestone starter docs requires explicit overwrite confirmation.
- Read the canonical `report.milestone-summary` contract before building carry-forward seed text, and read `phase.context` before scaffolding the first context artifact for the next milestone.


## Outputs


- User-facing result: a concise completion summary plus the next safe implemented action when applicable.
- Repo side effects: Rewrites the starter milestone docs in `.blueprint/`, scaffolds the first carried-forward phase context artifact, and updates `.blueprint/STATE.md`.


## Blueprint And Global State Reads


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract, authoringTemplate, validation, warnings}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`


## Blueprint And Global State Writes


- `.blueprint/PROJECT.md`
- `.blueprint/REQUIREMENTS.md`
- `.blueprint/ROADMAP.md`
- `.blueprint/phases/<next-phase-slug>/<NN-CONTEXT.md>`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract, authoringTemplate, validation, warnings}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Carry-Forward Contract

- Read `report.milestone-summary` through `blueprint_artifact_contract_read` before deriving carry-forward seed text, and normalize any summary-derived seed text to the returned `authoringTemplate` when the contract provides one.
- Read `phase.context` through `blueprint_artifact_contract_read` before scaffolding the first phase context artifact so the seeded `XX-CONTEXT.md` stays aligned with the canonical contract.
- Pass only repo-relative `artifactPaths` into `blueprint_artifact_summary_digest`, and treat returned `inputsUsed` as the authoritative carry-forward evidence scope.
- Use `blueprint_artifact_scaffold` only to seed the next milestone starter docs and first context file. Do not treat scaffold text as the final authored milestone content.
- Preserve the confirmed next phase number when building the first context path; do not invent or renumber historical phase directories manually.


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
- `docs/commands/milestone-summary.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Medium: rewrites carried-forward milestone starter docs and advances the active milestone.

## User Prompts And Confirmation Gates


- Carry-forward is the default path. Require explicit confirmation only when the user wants a fresh reset instead.
- Require explicit overwrite confirmation before replacing the existing milestone starter docs.
- Prefer Gemini CLI `ask_user` for the reset-vs-carry-forward and overwrite confirmation gates.


## Edge Cases


- Missing milestone summary report for the resolved milestone.
- Fresh reset instead of the default carry-forward path.
- Continuing phase numbering without deleting historical phase directories.


## Failure Modes And Recovery


- Show roadmap and report drift before mutation.
- If the milestone summary report is missing, stop with concise guidance to run `/blu-milestone-summary` first.
- Preserve historical phase directories; do not delete or renumber prior milestones as part of this command.
- Return the nearest valid phase or milestone candidates when the target does not exist.


## Acceptance Criteria


- Defaults to carry-forward from the saved milestone summary and requires an explicit user choice to reset from scratch.
- Uses the saved `milestone-summary-<version>.md` report as the durable carry-forward input for the next milestone start.
- Rewrites starter docs through `blueprint_artifact_scaffold` using an explicit carry-forward seed rather than ad hoc file edits.
- Preserves historical phase directories and starts the new milestone at the next whole-number phase.
- Scaffolds the first new phase context artifact so `/blu-discuss-phase <first phase>` has a valid phase directory to target.
- Returns `/blu-discuss-phase <first phase>` as the next safe implemented follow-up.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Missing-summary rejection fixture.
- Carry-forward default fixture.
- Phase-number continuity fixture.
- Direct `new-milestone` happy-path fixture.
