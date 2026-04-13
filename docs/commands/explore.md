# `/blu-explore`
| Field | Value |
|---|---|
| Wave | `3` |
| Family | `Capture And Lightweight Execution` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`explore` is Blueprint's command for socratic ideation and idea routing — think through ideas before committing to plans. In Blueprint the shipped slice stays Gemini-native, classifies an idea into the right capture target, requires an explicit confirmation before writing, and uses documented MCP tools to persist only the chosen note, todo, backlog, or roadmap proposal.


## Command Path And Examples

- Gemini command path: `/blu-explore`
- Root router form: `/blu explore`
- Argument hint: `<idea>`
- `/blu-explore authentication-strategy`
- `/blu explore`

## Inputs, Project State, And Prerequisite Artifacts


- Project context is preferred when the result should be persisted.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes only the confirmed Blueprint capture or roadmap artifact for the chosen target.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `the chosen target only: note, todo, backlog entry, or roadmap proposal`


## Required MCP Tools


- `blueprint_artifact_mutate_index` -> `{targetPath, createdEntryIds, updatedCounts}`
- `blueprint_roadmap_add_phase` -> `{phaseNumber, phaseDir, roadmapPath}`
- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`


## Skills And Subagents


- Primary skill: `blueprint-capture`
- Optional subagents:
- `blueprint-researcher`


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/new-project.md`
- `docs/commands/note.md`


## External Shell Or Git Dependencies


- External dependencies:
- web lookups only when current ecosystem context matters


## Shell Risk Profile

- Low: ideation-first, persistence second.

## User Prompts And Confirmation Gates


- Confirm the final routing target before writing exploration output.


## Edge Cases


- The input is too vague to classify cleanly into note, todo, backlog, or execution work.
- The target item already exists or has already been promoted, completed, or archived.


## Failure Modes And Recovery


- Repair malformed index files through MCP instead of raw append logic.
- Route oversized execution asks to `quick` or `plan-phase` instead of bluffing.


## Acceptance Criteria


- Capture outputs stay deterministic and append-only where expected.
- If no Blueprint project exists, the command degrades to safe suggestion mode instead of inventing persistence.
- Requires explicit confirmation of the final routing target before any write.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Capture append fixture.
- No-project graceful degradation fixture.
- Direct `explore` happy-path fixture.


