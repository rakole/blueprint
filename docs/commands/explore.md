# `/blu-explore`
| Field | Value |
|---|---|
| Wave | `3` |
| Family | `Capture And Lightweight Execution` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `interactive-read` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `explore` uses the shared interactive-read classification only to keep the command metadata aligned; it stays a short ideation-and-routing pass, keeps persistence on MCP rails, and does not adopt tracker-backed branching or the long-running progress layer used by mutation-heavy commands.
- Optional researcher use is bounded to short context checks when that context materially changes the routing target; `/blu-explore` should not turn into a prolonged research session.


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
- In-flight posture: none beyond a concise inline summary or confirmation gate; `explore` does not expose the long-running progress layer.


## Blueprint And Global State Reads


- `blueprint_project_status` reads Blueprint readiness before persistence.
- `blueprint_config_get` reads the effective workflow policy before any optional researcher decision.


## Blueprint And Global State Writes


- `.blueprint/notes/NOTES.md`
- `.blueprint/todos/TODO.md`
- `.blueprint/backlog/BACKLOG.md`
- `.blueprint/ROADMAP.md` plus `.blueprint/phases/<phase-slug>/` when the user explicitly promotes the explored idea into an active roadmap phase


## Required MCP Tools


- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_artifact_mutate_index` -> `{targetPath, createdEntryIds, updatedCounts}`
- `blueprint_roadmap_add_phase` -> `{phaseNumber, phaseDir, roadmapPath}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`

## Routing Persistence Contract

- Read effective config through `blueprint_config_get` before deciding whether to use the optional `blueprint-researcher` path or stay inline.
- Capture routes use `blueprint_artifact_mutate_index` in append mode: omit `action`, pass the normalized idea in `entry.text`, and use returned entry ids as authoritative.
- Roadmap promotion uses `blueprint_roadmap_add_phase` with the confirmed phase description plus confirmed durable `requirementIds`, concrete `goal`, and 2-5 item `successCriteria`. Treat the returned `phaseNumber`, `phasePrefix`, and `phaseDir` as authoritative.
- When scaffolding the roadmap route, build the initial context path from the returned `phaseDir` plus returned `phasePrefix`. Do not invent the phase slug or path from user prose.


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


- Confirm the final routing target before any durable write. Prefer Gemini CLI `ask_user` when a structured choice helps, otherwise keep the same gate explicit in prose.
- Confirm the final phase description, requirement IDs, objective, and success criteria before promoting an explored idea directly into the active roadmap.


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
- Explicitly excludes `update_topic`, `write_todos`, tracker-backed branching, and other long-running progress behavior.


## Test Cases


- Capture append fixture.
- No-project graceful degradation fixture.
- Roadmap-promotion fixture with scaffolded phase context.
- Direct `explore` happy-path fixture.
