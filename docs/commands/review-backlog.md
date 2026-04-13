# `/blu-review-backlog`
| Field | Value |
|---|---|
| Wave | `3` |
| Family | `Capture And Lightweight Execution` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Review and promote backlog items to active milestone |


## Purpose


`review-backlog` carries forward the GSD intent to review and promote backlog items to active milestone. In Blueprint it now ships as the deterministic backlog-promotion flow: preview canonical backlog entries first, require explicit promotion decisions, reuse reserved `999.x` stubs when present, and keep backlog plus roadmap mutations inside documented MCP tools.


## Command Path And Examples

- Gemini command path: `/blu-review-backlog`
- Compatibility during this release: `/blu:review-backlog` (deprecated; remove next release)
- Root router form: `/blu review-backlog`
- Argument hint: `none`
- `/blu-review-backlog`
- `/blu review-backlog`

## Inputs, Project State, And Prerequisite Artifacts


- A backlog index should already exist.
- A Blueprint roadmap should already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- `backlog index`
- `roadmap and phase inventory`


## Blueprint And Global State Writes


- `updated backlog index`
- `updated roadmap and any promoted phase stubs`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_artifact_mutate_index` -> `{targetPath, updatedCounts, warnings}`
- `blueprint_roadmap_promote_backlog` -> `{status, backlogItems, promotedItems, createdPhaseDirs, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`


## Skills And Subagents


- Primary skill: `blueprint-capture`
- Optional subagents: none


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/add-backlog.md`
- `docs/commands/add-phase.md`
- `docs/commands/discuss-phase.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Medium: can promote backlog items into active roadmap scope.

## User Prompts And Confirmation Gates


- Confirm each promote, keep, or remove decision.


## Edge Cases


- The input is too vague to classify cleanly into note, todo, backlog, or execution work.
- The target item already exists or has already been promoted, completed, or archived.


## Failure Modes And Recovery


- Repair malformed index files through MCP instead of raw append logic.
- Preview backlog candidates through MCP before asking for promote/remove decisions.
- Route oversized execution asks to `quick` or `plan-phase` instead of bluffing.


## Acceptance Criteria


- Capture outputs stay deterministic and append-only where expected.
- If no Blueprint project exists, the command degrades to safe suggestion mode instead of inventing persistence.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Promoted backlog items become active roadmap phases without deleting backlog history.
- Leaves unrelated repo files untouched.


## Test Cases


- Backlog preview fixture.
- No-project graceful degradation fixture.
- Direct `review-backlog` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/review-backlog.md`
- Upstream workflow status: GSD does not have a dedicated upstream workflow file and will need a Blueprint-native flow contract
