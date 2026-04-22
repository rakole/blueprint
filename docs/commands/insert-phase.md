# `/blu-insert-phase`
| Field | Value |
|---|---|
| Wave | `2` |
| Family | `Roadmap And Milestone` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `interactive-read` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `insert-phase` uses the shared interactive-read classification only to keep the command metadata aligned; it performs one bounded roadmap insert, keeps persistence on MCP-owned Blueprint artifacts, and does not adopt tracker-backed branching or the long-running progress layer used by mutation-heavy commands.
- Keep the waiting state explicit as `phase-insert-confirmation` while the computed decimal insert is waiting for approval, `invalid-insertion-anchor` when the requested integer anchor is unusable, and `conflicting-decimal-directory` when on-disk state blocks the insert.


## Purpose


`insert-phase` is Blueprint's command for insert urgent work as decimal phase (e.g., 72.1) between existing phases. In Blueprint it is implemented as a host-native roadmap insertion flow that reads the current roadmap first, derives the next decimal from the requested integer phase group, inserts the new roadmap line and Phase Details block without renumbering later phases, scaffolds the matching `.blueprint/phases/<phasePrefix>-<phaseSlug>/` directory, and then routes the repo back into discovery.


## Command Path And Examples

- CLI command path: `/blu-insert-phase`
- Root router form: `/blu insert-phase`
- Argument hint: `<afterPhaseNumber> <description>`
- `/blu-insert-phase 3 Migration-cleanup`
- `/blu insert-phase`

## Inputs, Project State, And Prerequisite Artifacts


- A Blueprint project and roadmap must already exist.
- An existing integer phase number is required as the insertion anchor (`after`). Decimal insertion targets are rejected.
- A non-empty phase description is required. The description becomes the inserted phase title and drives the scaffolded phase slug, while the returned `phasePrefix` determines the scaffolded context filename.
- The next decimal phase number is derived from roadmap state under the requested integer base only. If the roadmap contains `2`, `2.1`, and `2.2`, then inserting after `2` creates `2.3`.
- Do not renumber later phases or rewrite later dependency lines automatically as part of `insert-phase`.


## Outputs


- User-facing result: a concise completion summary plus the next safe Blueprint follow-up when applicable.
- Repo side effects: Inserts the new decimal phase into `.blueprint/ROADMAP.md`, scaffolds `.blueprint/phases/<phasePrefix>-<phaseSlug>/`, updates `.blueprint/STATE.md`, and does not mutate code or git state.
- In-flight posture: none beyond a concise inline summary or confirmation gate; `insert-phase` does not expose the long-running progress layer.


## Blueprint And Global State Reads


- The current roadmap and milestone inventory through `blueprint_roadmap_read`


## Blueprint And Global State Writes


- `.blueprint/ROADMAP.md`
- `.blueprint/phases/<phasePrefix>-<phaseSlug>/`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_roadmap_insert_phase` -> `{afterPhaseNumber, phaseNumber, phasePrefix, phaseDir, roadmapPath}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Phase Insertion Contract

- Call `blueprint_roadmap_insert_phase` with only the confirmed integer anchor in `after` plus the phase description.
- Treat returned `afterPhaseNumber`, `phaseNumber`, `phasePrefix`, and `phaseDir` as the authoritative inserted-phase metadata. Do not invent decimal numbering, phase slugs, or scaffold paths manually.
- Record the inserted decimal phase in `STATE.md` as a durable `roadmapEvolutionNotes` entry and keep later phases' numbering unchanged.
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
- `docs/commands/add-phase.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Medium: inserts decimal numbering into the roadmap without renumbering later phases.

## User Prompts And Confirmation Gates


- Confirm the integer insertion target, the computed next decimal number, and the fact that later phases will not be renumbered automatically before mutation. Prefer Gemini CLI `ask_user` for this confirmation gate instead of prose-only confirmation.


## Edge Cases


- Reject decimal insertion targets even if they exist in the roadmap.
- Reject targets that are missing from `.blueprint/ROADMAP.md`.
- Reject roadmap drift when the target integer phase directory is missing or ambiguous.
- Reject conflicting on-disk decimal directories when the computed inserted phase number already maps to a different directory.


## Failure Modes And Recovery


- Show roadmap and phase-directory drift before mutation.
- Refuse mutation when the target phase is not an existing integer phase.
- Refuse mutation when the roadmap cannot place the new Phase Details block immediately after the target base-phase group.
- Return the nearest valid phase or milestone candidates when the target does not exist.


## Acceptance Criteria


- Keeps roadmap, phase directories, and state synchronized.
- Inserts the next decimal after the requested integer phase group and does not renumber later phases.
- Creates the matching `.blueprint/phases/<phasePrefix>-<phaseSlug>/` scaffold.
- Writes `Depends on: Phase <integer>`, `Status: planned`, and the optional `Inserted: yes` marker for the inserted Phase Details block.
- Records the inserted decimal phase in `STATE.md` without renumbering later phases.
- Returns `/blu-discuss-phase <decimal>` as the next safe Blueprint follow-up.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- First decimal insertion fixture.
- Repeated decimal insertion fixture.
- Decimal-target rejection fixture.
- Missing-target rejection fixture.
- Conflicting-directory drift rejection fixture.
- Later-phase non-renumbering regression fixture.
- Direct `insert-phase` happy-path fixture.
