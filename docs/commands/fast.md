# `/blu-fast`
| Field | Value |
|---|---|
| Wave | `3` |
| Family | `Capture And Lightweight Execution` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `interactive-read` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `fast` uses the shared interactive-read classification only to keep the command metadata aligned; it does not adopt tracker-backed branching or the long-running progress layer used by `quick` and lifecycle execution.
- `fast` completes inline or reroutes quickly. Do not use `update_topic`, `write_todos`, or tracker tools to make a trivial run look long-running.

## Purpose


`fast` is Blueprint's command for executing a trivial task inline — no subagents, no planning overhead. In Blueprint it is implemented as a host-native trivial-execution path that keeps Blueprint-owned persistence on MCP rails, avoids durable quick-run reports, excludes tracker or long-running progress behavior, and updates state only when the repo is already initialized.


## Command Path And Examples

- CLI command path: `/blu-fast`
- Root router form: `/blu fast`
- Argument hint: `[task description]`
- `/blu-fast fix-readme-typo`
- `/blu fast`

## Inputs, Project State, And Prerequisite Artifacts


- May run inside or outside a Blueprint project, but only persists state inside one.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: may mutate repo files for the trivial task and updates `STATE.md` only when running inside an initialized Blueprint project.
- In-flight posture: none beyond a concise inline summary or reroute; `fast` does not expose the long-running progress layer.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- optional `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_state_update` -> `{updatedFields, statePath}`


## Skills And Subagents


- Primary skill: `blueprint-phase-execution`
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
- git status checks are recommended


## Shell Risk Profile

- Medium: minimal-planning repo mutation path.

## User Prompts And Confirmation Gates


- Refuse or reroute if the requested task is not truly trivial.
- Route partial or unhealthy Blueprint repos to `/blu-health` before any Blueprint-owned persistence.


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
- Explicitly excludes `update_topic`, `write_todos`, tracker-backed branching, and other long-running progress behavior.
- Does not create quick-run reports, phase artifacts, or subagent side effects.


## Test Cases


- Capture append fixture.
- No-project graceful degradation fixture.
- Direct `fast` happy-path fixture.

