# `/blu-explore`
| Field | Value |
|---|---|
| Wave | `3` |
| Family | `Capture And Lightweight Execution` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`explore` is Blueprint's command for socratic ideation and idea routing — think through ideas before committing to plans. In Blueprint the shipped slice stays host-native, classifies an idea into the right capture target, requires an explicit confirmation before writing, and uses documented MCP tools to persist only the chosen note, todo, backlog, or roadmap proposal.


## Command Path And Examples

- CLI command path: `/blu-explore`
- Root router form: `/blu explore`
- Argument hint: `<topic>`
- `/blu-explore authentication-strategy`
- `/blu explore release workflow`

## Inputs, Project State, And Prerequisite Artifacts


- A non-empty idea, question, or topic is required.
- Blueprint project context is required for durable writes.
- The user must explicitly confirm the final route before any persistence.


## Outputs


- User-facing result: a concise completion summary plus the next logical implemented action when applicable.
- Repo side effects: writes only the confirmed target artifact path and leaves unrelated repo files untouched.


## Blueprint And Global State Reads


- `blueprint_project_status` reads Blueprint readiness before persistence.


## Blueprint And Global State Writes


- `.blueprint/notes/NOTES.md`
- `.blueprint/todos/TODO.md`
- `.blueprint/backlog/BACKLOG.md`
- `.blueprint/ROADMAP.md` plus `.blueprint/phases/<phase-slug>/` when the user explicitly promotes the explored idea into an active roadmap phase


## Required MCP Tools


- `blueprint_artifact_mutate_index` -> `{targetPath, createdEntryIds, updatedCounts}`
- `blueprint_roadmap_add_phase` -> `{phaseNumber, phaseDir, roadmapPath}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
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

- Medium: ideation-first, but confirmed roadmap promotion can append a new active phase.

## User Prompts And Confirmation Gates


- Confirm the final routing target before any durable write.
- Confirm the final phase description before promoting an explored idea directly into the active roadmap.


## Edge Cases


- The input is too vague to classify cleanly into note, todo, backlog, or execution work.
- The target item already exists or has already been promoted, completed, or archived.
- The explored idea turns out to be ready for bounded execution now rather than capture or roadmap promotion.


## Failure Modes And Recovery


- Repair malformed index files through MCP instead of raw append logic.
- Use duplicate detection on capture-index routes instead of creating variant copies of the same idea.
- Route oversized execution asks to `quick` or `plan-phase` instead of bluffing.


## Acceptance Criteria


- Capture outputs stay deterministic and append-only where expected.
- If no Blueprint project exists, the command degrades to safe suggestion mode instead of inventing persistence.
- Confirm the final routing target before any durable write.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Capture append fixture.
- No-project graceful degradation fixture.
- Roadmap-promotion fixture with scaffolded phase context.
- Direct `explore` happy-path fixture.

