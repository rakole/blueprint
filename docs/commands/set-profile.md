# `/blu-set-profile`
| Field | Value |
|---|---|
| Wave | `0` |
| Family | `Foundation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Switch model profile for GSD agents (quality/balanced/budget/inherit) |


## Purpose


`set-profile` carries forward the GSD intent to switch model profile for GSD agents (quality/balanced/budget/inherit). In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu-set-profile`
- Root router form: `/blu set-profile`
- Argument hint: `<profile (quality|balanced|budget|inherit)>`
- `/blu-set-profile quality`
- `/blu set-profile`

## Inputs, Project State, And Prerequisite Artifacts


- A Blueprint project must already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- `.blueprint/config.json`


## Blueprint And Global State Writes


- `.blueprint/config.json`


## Required MCP Tools


- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_config_set_profile` -> `{profile, updatedKeys, configPath}`


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
- `docs/commands/settings.md`


## Upstream Dependency Docs


- `docs/commands/settings.md`
- `docs/commands/progress.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Low: single-setting mutation for model profile selection.

## User Prompts And Confirmation Gates


- Echo the old and new profile before saving.
- Never offer to mutate `~/.gemini/blueprint/defaults.json`; this command is project-local only.


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
- Changes only `model_profile` in the repo config and leaves all other config fields, scopes, and defaults untouched.


## Test Cases


- Fresh repo fixture.
- Partially initialized Blueprint repo fixture.
- Project-profile change with saved defaults already present.
- Direct `set-profile` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/set-profile.md`
- Upstream workflow status: GSD does not have a dedicated upstream workflow file and will need a Blueprint-native flow contract
