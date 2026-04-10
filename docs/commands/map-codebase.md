# `/blu:map-codebase`
| Field | Value |
|---|---|
| Wave | `0` |
| Family | `Foundation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Analyze codebase with parallel mapper agents to produce .planning/codebase/ documents |


## Purpose


`map-codebase` carries forward the GSD intent to analyze codebase with parallel mapper agents to produce .planning/codebase/ documents. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu:map-codebase`
- Root router form: `/blu map-codebase`
- Argument hint: `[optional: specific area to map, e.g., 'api' or 'auth']`
- `/blu:map-codebase auth`
- `/blu map-codebase`

## Inputs, Project State, And Prerequisite Artifacts


- A Blueprint project must already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `.blueprint/codebase/STACK.md`
- `.blueprint/codebase/ARCHITECTURE.md`
- `.blueprint/codebase/CONVENTIONS.md`
- `.blueprint/codebase/TESTING.md`
- `.blueprint/codebase/INTEGRATIONS.md`
- `.blueprint/codebase/CONCERNS.md`


## Required MCP Tools


- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`


## Skills And Subagents


- Primary skill: `blueprint-map`
- Optional subagents:
- `blueprint-mapper`


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
- git
- rg


## Shell Risk Profile

- Medium: refresh mode can replace existing codebase-mapping artifacts.

## User Prompts And Confirmation Gates


- Confirm replacing heavily edited mapping docs.


## Edge Cases


- The repo already contains a partial `.blueprint/` tree from an earlier attempt.
- The command is invoked from a nested directory rather than the repo root.


## Failure Modes And Recovery


- Stop with a precise repo-root or config-path error instead of guessing.
- Preserve existing Blueprint artifacts unless the user explicitly confirms replacement.


## Acceptance Criteria


- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Creates or updates only the declared artifacts for this command.


## Test Cases


- Fresh repo fixture.
- Partially initialized Blueprint repo fixture.
- Direct `map-codebase` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/map-codebase.md`
- Upstream workflow status: GSD has an upstream workflow file
