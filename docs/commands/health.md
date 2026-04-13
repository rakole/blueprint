# `/blu-health`
| Field | Value |
|---|---|
| Wave | `0` |
| Family | `Foundation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Diagnose planning directory health and optionally repair issues |


## Purpose


`health` carries forward the GSD intent to diagnose planning directory health and optionally repair issues. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu-health`
- Root router form: `/blu health`
- Argument hint: `[--repair]`
- `/blu-health --repair`
- `/blu health`

## Inputs, Project State, And Prerequisite Artifacts


- A Blueprint project must already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- `.blueprint/config.json`
- `effective config diagnostics when saved defaults exist`


## Blueprint And Global State Writes


- `.blueprint/config.json and .blueprint/STATE.md in repair mode`


## Required MCP Tools


- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_config_set` -> `{scope, updatedKeys, config, provenance, configPath, warnings}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_validate` -> `{valid, issues, suggestedRepairs}`
- `blueprint_state_sync` -> `{syncedFields, warnings}`


## Skills And Subagents


- Primary skill: `blueprint-governance`
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
- none


## Shell Risk Profile

- Medium: repair mode can normalize config and rewrite malformed planning artifacts.

## User Prompts And Confirmation Gates


- Require confirmation before repair writes.
- When a repair would migrate legacy config keys or drop removed repo-config fields, summarize those changes before writing.


## Edge Cases


- The repo already contains a partial `.blueprint/` tree from an earlier attempt.
- The command is invoked from a nested directory rather than the repo root.
- The repo config still uses the old minimal Blueprint schema or contains removed keys such as `workflow.use_workspaces`, `workflow.use_workstreams`, or repo-level `hooks.*`.
- Saved defaults exist but are malformed, so effective-config diagnostics differ from the repo file.


## Failure Modes And Recovery


- Stop with a precise repo-root or config-path error instead of guessing.
- Preserve existing Blueprint artifacts unless the user explicitly confirms replacement.
- Report malformed or legacy config with a repairable diff instead of silently rewriting the file in non-repair mode.


## Acceptance Criteria


- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Creates or updates only the declared artifacts for this command.
- Detects invalid enums, malformed structure, removed repo-level hook keys, and legacy minimal config, and can normalize them to config schema v2 during repair.


## Test Cases


- Fresh repo fixture.
- Partially initialized Blueprint repo fixture.
- Legacy minimal-config migration fixture.
- Malformed-config repair fixture.
- Direct `health` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/health.md`
- Upstream workflow status: GSD has an upstream workflow file
