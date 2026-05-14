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
- Plain append validation must confirm those `requirementIds` are already declared in `.blueprint/REQUIREMENTS.md` before mutation. Keep the audit-backed repair path separate by using `auditBackedDetails.repairRequirementIds` when repair evidence, rather than a plain append, is driving the requirement traceability update.
- Roadmap-derived IDs are acceptable only when the roadmap already maps back to declared `.blueprint/REQUIREMENTS.md` rows; otherwise they are not valid plain-append grounding.
- A concrete ROADMAP objective plus 2-5 observable success criteria are required and passed as `goal` and `successCriteria`.
- The next phase number is the next integer after the highest base phase number already present in the roadmap. Decimal suffixes are ignored for numbering, so `2.1` and `2.2` still advance the next append target to `3`.
- The computed next phase number, requirement IDs, requirement source, objective, and success criteria must be previewed from the roadmap read result before any mutation as a structured packet that also names source warnings, the scaffold target, and `Safe default: stop without writing`.
- The completion response must include a compact starter handoff block for `/blu-discuss-phase` with the returned phase number and title, declared requirement IDs, confirmed objective, success criteria, source refs, and open items for discuss-phase.
- Keep that handoff compact starter seed only. Do not treat it as final `XX-CONTEXT.md`, and do not jump directly to `/blu-plan-phase` or `/blu-execute-phase`.


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
- Treat `phase-number-confirmation` as a named in-flight receipt that binds the approved preview packet fields to the later `blueprint_roadmap_add_phase` arguments: `expectedPhaseNumber`, description, `requirementIds`, `goal`, and `successCriteria`.
- Call `blueprint_roadmap_add_phase` with the confirmed phase description, the confirmed next phase number in `expectedPhaseNumber`, the confirmed durable IDs in `requirementIds`, the confirmed objective in `goal`, and 2-5 confirmed criteria in `successCriteria` after the user approves the previewed roadmap grounding. For plain add-phase, the command must validate `requirementIds` against declared `.blueprint/REQUIREMENTS.md` rows before mutation. Keep audit-backed repair traceability separate in `auditBackedDetails.repairRequirementIds` instead of weakening the plain-append requirement check. Do not precompute the slug or directory path yourself.
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
- Include `expectedPhaseNumber`, the description, declared requirement IDs, requirement grounding, source warnings, objective, 2-5 success criteria, the scaffold target, and `Safe default: stop without writing` in that same confirmation preview.
- Before the route instruction, include the compact starter handoff block for `/blu-discuss-phase`.
- If the user declines, stop without writing. When a safe route is needed, point to `/blu-progress`.


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
- Stop without mutation when a plain add-phase request uses `requirementIds` that are not declared in `.blueprint/REQUIREMENTS.md`.
- Stop without mutation when a plain add-phase request has no concrete objective or lacks 2-5 observable success criteria.


## Acceptance Criteria


- Keeps roadmap, phase directories, and state synchronized for add-phase only.
- Previews the exact next integer phase number before append and confirms it through `ask_user`.
- Uses a named confirmation receipt that binds the approved preview packet to the later `expectedPhaseNumber`, `requirementIds`, `goal`, and `successCriteria` arguments.
- Chooses, previews, confirms, and passes at least one durable requirement ID for plain whole-number add-phase.
- Requires those plain-append `requirementIds` to already exist in `.blueprint/REQUIREMENTS.md` before mutation, while preserving audit-backed repair through `auditBackedDetails.repairRequirementIds`.
- Confirms and passes a concrete objective plus 2-5 observable success criteria so `/blu-discuss-phase` is not expected to backfill ROADMAP placeholders.
- Returns a compact starter handoff block with the returned phase number and title, declared requirement IDs, confirmed objective, success criteria, source refs, and open discuss items.
- Appends the next whole-number phase to the roadmap instead of inserting a decimal phase.
- Refuses to append when the confirmed next phase number is stale.
- Creates the matching `.blueprint/phases/<phase-slug>/` scaffold.
- Updates `.blueprint/STATE.md` with the new next action.
- Does not route directly to `/blu-plan-phase` or `/blu-execute-phase`; the starter handoff belongs to `/blu-discuss-phase`.
- Returns `/blu-discuss-phase <new phase number>` as the next safe Blueprint follow-up.
- Stops without writing when the user declines the preview confirmation.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Roadmap append fixture.
- Decimal-phase numbering regression fixture.
- Missing-description rejection fixture.
- Renumbering or archival regression fixture.
- Direct `add-phase` happy-path fixture.
