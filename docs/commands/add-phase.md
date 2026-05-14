# `/blu-add-phase`
| Field | Value |
|---|---|
| Wave | `2` |
| Family | `Roadmap And Milestone` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `interactive-read` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `add-phase` uses the shared interactive-read classification only to keep the command metadata aligned; it performs one bounded roadmap append, keeps persistence on MCP-owned Blueprint artifacts, and does not adopt tracker-backed branching or the long-running progress layer used by mutation-heavy commands.
- Shared phase-admin spine: read roadmap state first, preview the exact phase target plus requirement grounding plus roadmap objective and success criteria, require a named confirmation gate before any mutation, persist only through MCP tools, treat the scaffolded context as starter material only, update `STATE.md` only after scaffold succeeds, route to `/blu-discuss-phase <phase>`, and never widen into tracker tools, long-running progress posture, or planned-only shortcuts.
- Keep the waiting state explicit as `phase-number-confirmation` while the computed append target is waiting for approval, and as `stale-phase-number` when the previewed number is no longer current.
- Rich behavior reference: `skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md`


## Purpose


`add-phase` is Blueprint's command for appending a new whole-number phase to the current milestone roadmap. In Blueprint it stays host-native, uses documented MCP tools to append the next whole-number phase, derives that number from the highest base phase number while ignoring decimal suffixes, and scaffolds the matching `.blueprint/phases/<phase-slug>/` directory before updating state. Its contract follows the same returned-metadata-first pattern as `insert-phase`, but it appends the next integer phase instead of inserting a decimal phase.


## Command Path And Examples

- CLI command path: `/blu-add-phase`
- Root router form: `/blu add-phase`
- Argument hint: `<description>`
- `/blu-add-phase Notifications`
- `/blu add-phase Notifications`

## Inputs, Project State, And Prerequisite Artifacts


- A Blueprint project and roadmap must already exist.
- A non-empty phase description is required. The description becomes the new phase title and drives the scaffolded phase slug.
- At least one durable requirement ID declared in `.blueprint/REQUIREMENTS.md` is required for a plain whole-number add. Confirmed IDs are passed as `requirementIds`.
- Roadmap-derived IDs are acceptable only when the roadmap already maps back to declared `.blueprint/REQUIREMENTS.md` rows or when audit-backed repair details explicitly name those durable IDs.
- A concrete ROADMAP objective plus 2-5 observable success criteria are required and passed as `goal` and `successCriteria`.
- The next phase number is the next integer after the highest base phase number already present in the roadmap. Decimal suffixes are ignored for numbering, so `2.1` and `2.2` still advance the next append target to `3`.
- The computed next phase number, requirement IDs, requirement source, objective, and success criteria must be previewed from the roadmap read result before any mutation.


## Outputs


- User-facing result: a concise completion summary plus the next safe Blueprint follow-up when applicable.
- Repo side effects: Appends the new phase to `.blueprint/ROADMAP.md`, scaffolds `.blueprint/phases/<phase-slug>/`, and updates `.blueprint/STATE.md`.
- In-flight posture: none beyond a concise inline summary or confirmation gate; `add-phase` does not expose the long-running progress layer.


## Blueprint And Global State Reads


- `.blueprint/ROADMAP.md` via `blueprint_roadmap_read`


## Blueprint And Global State Writes


- `.blueprint/ROADMAP.md`
- `.blueprint/phases/<phase-slug>/`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_roadmap_add_phase` -> `{phaseNumber, phasePrefix, phaseDir, roadmapPath}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Phase Creation Contract

- Preview the exact computed next integer phase number from the roadmap read result before append, then use `ask_user` for the confirmation gate before any mutation.
- Call `blueprint_roadmap_add_phase` with the confirmed phase description, the confirmed next phase number in `expectedPhaseNumber`, the confirmed durable IDs in `requirementIds`, the confirmed objective in `goal`, and 2-5 confirmed criteria in `successCriteria` after the user approves the previewed roadmap grounding. For plain add-phase, requirement grounding must resolve to durable `.blueprint/REQUIREMENTS.md` declarations; roadmap-only hints are acceptable only when they already map to those declarations or to explicit audit-backed repair details. Do not precompute the slug or directory path yourself.
- Treat returned `phaseNumber`, `phasePrefix`, and `phaseDir` as the authoritative new-phase metadata.
- Scaffold the initial context file at `${phaseDir}/${phasePrefix}-CONTEXT.md` from the returned phase metadata. Do not treat scaffold text as finished phase context.
- Update `STATE.md` only after scaffold succeeds so the active phase never points at a missing context path.


## Skills And Subagents


- Primary skill: `blueprint-roadmap-admin`
- Optional subagents: none
- No-subagent fallback: the parent command completes the workflow directly from MCP results; browser, web-search-only, shell-only, or generic agents are not substitutes.


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/new-project.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Medium: mutates roadmap state and scaffolds a new phase.

## User Prompts And Confirmation Gates


- Preview the exact computed next integer phase number from the roadmap read result before append.
- Use Gemini CLI's built-in `ask_user` dialog for the structured confirmation gate instead of prose-only confirmation when the user must approve that exact phase number.
- Include the requirement grounding, requirement source, objective, and success criteria in that same confirmation preview.


## Edge Cases


- none


## Failure Modes And Recovery


- Show roadmap and phase-directory drift before mutation if the roadmap read reveals a mismatch.
- Explain which base phase numbers were considered and which decimal suffixes were ignored when deriving the append target.
- Reject the add-phase mutation if the live next phase no longer matches the confirmed `expectedPhaseNumber`; re-read the roadmap before retrying.
- If scaffold creation fails, report the exact `${phaseDir}/${phasePrefix}-CONTEXT.md` path and stop without manually writing the file.
- If state update fails after roadmap append and scaffold success, report the completed writes, the state-update failure, and `/blu-progress` as the recovery route instead of manually editing `STATE.md`.
- Stop without mutation when the phase description is missing, the roadmap is unavailable, or the previewed next phase number cannot be confirmed.
- Stop without mutation when a plain add-phase request has no confirmed requirement IDs.
- Stop without mutation when a plain add-phase request has no concrete objective or lacks 2-5 observable success criteria.


## Acceptance Criteria


- Keeps roadmap, phase directories, and state synchronized for add-phase only.
- Previews the exact next integer phase number before append and confirms it through `ask_user`.
- Chooses, previews, confirms, and passes at least one durable requirement ID for plain whole-number add-phase.
- Confirms and passes a concrete objective plus 2-5 observable success criteria so `/blu-discuss-phase` is not expected to backfill ROADMAP placeholders.
- Appends the next whole-number phase to the roadmap instead of inserting a decimal phase.
- Refuses to append when the confirmed next phase number is stale.
- Creates the matching `.blueprint/phases/<phase-slug>/` scaffold.
- Updates `.blueprint/STATE.md` with the new next action.
- Returns `/blu-discuss-phase <new phase number>` as the next safe Blueprint follow-up.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Roadmap append fixture.
- Decimal-phase numbering regression fixture.
- Missing-description rejection fixture.
- Renumbering or archival regression fixture.
- Direct `add-phase` happy-path fixture.
