# `/blu-map-codebase`
| Field | Value |
|---|---|
| Wave | `0` |
| Family | `Foundation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Purpose

`map-codebase` is Blueprint's command for analyzing a brownfield codebase with mapper-style passes and producing durable codebase documents. In Blueprint it stays host-native, delegates persistence to documented MCP tools, and keeps the brownfield contract explicit without reviving omitted commands such as `scan` or `intel`. When a focus area is supplied, the command deepens that subsystem while still producing the full seven-artifact bundle.

## Command Path And Examples

- CLI command path: `/blu-map-codebase`
- Root router form: `/blu map-codebase`
- Argument hint: `[optional: specific area to deepen, e.g., 'api', 'auth', or 'mcp']`
- `/blu-map-codebase auth`
- `/blu map-codebase`

## Inputs, Project State, And Prerequisite Artifacts

- Default path: run after `new-project` so output is written into `.blueprint/codebase/`.
- Brownfield intent should still be explicit: do not silently replace existing codebase docs and do not hide the mapping step behind another command.
- Prefer Gemini CLI's built-in `ask_user` dialog for any reuse-versus-refresh or replace confirmation gate.

## Outputs

- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.
- Existing codebase docs should be reused by default. If they are heavily edited and the user wants a refresh or replace path, use `ask_user` to confirm the choice before any overwrite.

## Blueprint And Global State Reads

- none

## Blueprint And Global State Writes

- `.blueprint/codebase/STACK.md`
- `.blueprint/codebase/ARCHITECTURE.md`
- `.blueprint/codebase/STRUCTURE.md`
- `.blueprint/codebase/CONVENTIONS.md`
- `.blueprint/codebase/TESTING.md`
- `.blueprint/codebase/INTEGRATIONS.md`
- `.blueprint/codebase/CONCERNS.md`

## Required MCP Tools

- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`
- `blueprint_codebase_artifact_write` -> `{path, artifactId, written, created, overwritten, reused, status, issues, warnings}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract}` or `{artifactId: null, contracts}`
- `blueprint_artifact_validate` -> `{valid, issues, suggestedRepairs, warnings}`

## Mapping Artifact Contract

- Use `blueprint_artifact_scaffold` only with the seven supported repo-relative codebase artifact paths under `.blueprint/codebase/`. Bare names and absolute paths are invalid.
- Treat scaffold output as seeding or reuse only; the authored mapping content still needs to match the real repo evidence.
- Persist substantive mapping content through `blueprint_codebase_artifact_write` using canonical codebase artifact ids instead of raw file writes.
- Read the canonical codebase-bundle contract before any scaffold or refresh decision, and validate the resulting bundle after digesting the evidence.
- Pass only repo-relative evidence inputs to `blueprint_artifact_summary_digest`.
- Treat the returned `inputsUsed` list as the authoritative digest scope.

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
- Reuse existing codebase docs by default and require explicit confirmation for replace or refresh behavior.

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
- Produces the seven-document codebase bundle, including `STRUCTURE.md`.

## Test Cases

- Fresh repo fixture.
- Partially initialized Blueprint repo fixture.
- Direct `map-codebase` happy-path fixture.
