# `/blu-review-backlog`
| Field | Value |
|---|---|
| Wave | `3` |
| Family | `Capture And Lightweight Execution` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `interactive-read` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `review-backlog` uses the shared interactive-read classification only to keep the command metadata aligned; it reviews the canonical backlog in short deterministic passes and does not adopt tracker-backed branching or the long-running progress layer used by mutation-heavy commands.
- Promotion or archival decisions stay explicit and local: preview first, confirm the exact backlog ids, then persist through MCP without turning the command into broader roadmap orchestration.


## Purpose


`review-backlog` is Blueprint's command for review and promote backlog items to active milestone. In Blueprint it now ships as the deterministic backlog-promotion flow: preview canonical backlog entries first, require explicit promotion decisions, reuse reserved `999.x` stubs when present, and keep backlog plus roadmap mutations inside documented MCP tools.


## Command Path And Examples

- CLI command path: `/blu-review-backlog`
- Root router form: `/blu review-backlog`
- Argument hint: `none`
- `/blu-review-backlog`
- `/blu review-backlog`

## Inputs, Project State, And Prerequisite Artifacts


- A backlog index should already exist.
- A Blueprint roadmap should already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: updates `.blueprint/backlog/BACKLOG.md`, `.blueprint/ROADMAP.md`, any promoted phase directories, and `.blueprint/STATE.md`.
- In-flight posture: none beyond concise preview, confirmation, and completion summaries; `review-backlog` does not expose the long-running progress layer.


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

## Backlog Promotion Contract

- Start with `blueprint_roadmap_promote_backlog` in preview mode by passing `previewOnly: true`, or by omitting `backlogIds`, before asking the user to decide.
- Promote only with confirmed `backlogIds` returned by the preview result. Do not derive backlog ids manually from prose or list order.
- Treat returned `promotedItems` and `createdPhaseDirs` as the authoritative promotion result, including any reused reserved `999.x` phase directories.


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


- Confirm each promote or remove decision. Keep is the default safe path. Prefer Gemini CLI `ask_user` when a structured choice helps, otherwise keep the same gates explicit in prose.


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
- Explicitly excludes `update_topic`, `write_todos`, tracker-backed branching, and other long-running progress behavior.


## Test Cases


- Backlog preview fixture.
- No-project graceful degradation fixture.
- Direct `review-backlog` happy-path fixture.
