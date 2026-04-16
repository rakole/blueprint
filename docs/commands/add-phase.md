# `/blu-add-phase`
| Field | Value |
|---|---|
| Wave | `2` |
| Family | `Roadmap And Milestone` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`add-phase` is Blueprint's command for add phase to end of current milestone in roadmap. In Blueprint it stays host-native, uses documented MCP tools to append the next whole-number phase, derives that number from the highest base phase number while ignoring decimal suffixes, and scaffolds the matching `.blueprint/phases/<phase-slug>/` directory before updating state.


## Command Path And Examples

- CLI command path: `/blu-add-phase`
- Root router form: `/blu add-phase`
- Argument hint: `<description>`
- `/blu-add-phase Notifications`
- `/blu add-phase Notifications`

## Inputs, Project State, And Prerequisite Artifacts


- A Blueprint project and roadmap must already exist.
- A non-empty phase description is required. The description becomes the new phase title and drives the scaffolded phase slug.
- The next phase number is the next integer after the highest base phase number already present in the roadmap. Decimal suffixes are ignored for numbering, so `2.1` and `2.2` still advance the next append target to `3`.


## Outputs


- User-facing result: a concise completion summary plus the next safe Blueprint follow-up when applicable.
- Repo side effects: Appends the new phase to `.blueprint/ROADMAP.md`, scaffolds `.blueprint/phases/<phase-slug>/`, updates `.blueprint/STATE.md`, and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `.blueprint/ROADMAP.md`
- `.blueprint/phases/<phase-slug>/`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_roadmap_add_phase` -> `{phaseNumber, phaseDir, roadmapPath}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Phase Creation Contract

- Call `blueprint_roadmap_add_phase` with only the confirmed phase description. Do not precompute the phase number, slug, or directory path yourself.
- Treat returned `phaseNumber`, `phasePrefix`, and `phaseDir` as the authoritative new-phase metadata.
- Scaffold the initial context file from the returned phase metadata. Do not treat scaffold text as finished phase context.


## Skills And Subagents


- Primary skill: `blueprint-roadmap-admin`
- Optional subagents: none


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


- Confirm the final phase description and resulting next integer phase number before append.


## Edge Cases


- none


## Failure Modes And Recovery


- Show roadmap and phase-directory drift before mutation.
- Explain which base phase numbers were considered and which decimal suffixes were ignored when deriving the append target.
- Return the nearest valid phase or milestone candidates when the target does not exist.


## Acceptance Criteria


- Keeps roadmap, phase directories, and state synchronized.
- Produces a durable report for milestone-level operations.
- Appends the next whole-number phase to the roadmap instead of inserting a decimal phase.
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

