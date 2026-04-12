# `/blu-quick`
| Field | Value |
|---|---|
| Wave | `3` |
| Family | `Capture And Lightweight Execution` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Execute a quick task with GSD guarantees (atomic commits, state tracking) but skip optional agents |


## Purpose


`quick` carries forward the GSD intent to execute a quick task with GSD guarantees (atomic commits, state tracking) but skip optional agents. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu-quick`
- Compatibility during this release: `/blu:quick` (deprecated; remove next release)
- Root router form: `/blu quick`
- Argument hint: `[--full] [--validate] [--discuss] [--research]`
- `/blu-quick --full`
- `/blu quick`

## Inputs, Project State, And Prerequisite Artifacts


- A Blueprint project should already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `quick-run reports in .blueprint/reports/`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_command_catalog` -> `{commands, waves, aliases}`
- `blueprint_state_update` -> `{updatedFields, statePath}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`


## Skills And Subagents


- Primary skill: `blueprint-phase-execution`
- Optional subagents:
- `blueprint-researcher`
- `blueprint-planner`
- `blueprint-executor`
- `blueprint-verifier`


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/new-project.md`
- `docs/commands/progress.md`


## Upstream Dependency Docs


- `docs/commands/fast.md`
- `docs/commands/do.md`
- `docs/commands/plan-phase.md`


## External Shell Or Git Dependencies


- External dependencies:
- git


## Shell Risk Profile

- High: can execute repo changes with reduced ceremony.

## User Prompts And Confirmation Gates


- Confirm optional discuss, research, or full verification modes before starting.


## Edge Cases


- The input is too vague to classify cleanly into note, todo, backlog, or execution work.
- The target item already exists or has already been promoted, completed, or archived.


## Failure Modes And Recovery


- Repair malformed index files through MCP instead of raw append logic.
- Route oversized execution asks to `quick` or `plan-phase` instead of bluffing.


## Acceptance Criteria


- Capture outputs stay deterministic and append-only where expected.
- If no Blueprint project exists, the command degrades to safe suggestion mode instead of inventing persistence.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Capture append fixture.
- No-project graceful degradation fixture.
- Direct `quick` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/quick.md`
- Upstream workflow status: GSD has an upstream workflow file
