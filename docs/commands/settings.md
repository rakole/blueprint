# `/blu-settings`
| Field | Value |
|---|---|
| Wave | `0` |
| Family | `Foundation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`settings` is Blueprint's command for configuring workflow toggles and model profile. In Blueprint it should stay host-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later. The common settings pass includes the review defaults that make `/blu-code-review` meaningful, namely `workflow.code_review` and `workflow.code_review_depth`.


## Command Path And Examples

- CLI command path: `/blu-settings`
- Root router form: `/blu settings`
- Argument hint: `none`
- `/blu-settings`
- `/blu settings`

## Inputs, Project State, And Prerequisite Artifacts


- A Blueprint project must already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- `.blueprint/config.json`
- `~/.<host>/blueprint/defaults.json` when present


## Blueprint And Global State Writes


- `.blueprint/config.json`
- `optional ~/.<host>/blueprint/defaults.json`


## Required MCP Tools


- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_config_set` -> `{scope, updatedKeys, config, provenance, configPath, warnings}`

## Config Mutation Contract

- `blueprint_config_get` defaults to `scope: "effective"` when scope is omitted. `/blu-settings` should use `scope: "project"` for repo-local editing and `scope: "defaults"` only when the user explicitly wants to inspect or change saved defaults.
- `blueprint_config_set` defaults to `scope: "project"`. Pass a JSON-object `patch` only; do not try to write sparse file fragments or manual config text.
- Use `scope: "defaults"` only after explicit user confirmation that saved defaults should be changed.
- Treat the returned `configPath` as authoritative instead of reconstructing config paths manually.
- The reserved effectiveness-spine keys `ux.progress_mode`, `ux.structured_confirmations`, `ux.user_checkpoints`, `orchestration.task_tracker`, and `research.external_sources` are documented contract-only in `S8.1`; do not offer or persist them through `/blu-settings` until runtime support lands.


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


## Related Command Docs


- `docs/commands/new-project.md`
- `docs/commands/set-profile.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Low: config-only mutation inside repo config plus optional user defaults.

## User Prompts And Confirmation Gates


- Run a common settings pass for profile, research/plan/verify, Nyquist, UI, the `/blu-code-review` review toggle and depth, commit-docs, branching, and worktree isolation before offering advanced keys.
- Offer an advanced settings pass for gate, safety, timeout, template, response-language, and agent-skill fields.
- Do not present the reserved effectiveness-spine keys as interactive choices yet; if the user asks for them directly, explain that the config contract is documented but the runtime write path is not shipped until the dedicated infra implementation slice.
- Offer to save the resolved settings as `~/.<host>/blueprint/defaults.json` after project-local changes are applied.
- Confirm broad config resets before applying them.


## Edge Cases


- The repo already contains a partial `.blueprint/` tree from an earlier attempt.
- The command is invoked from a nested directory rather than the repo root.
- The repo config is still on the old minimal schema and needs migration before the interactive flow starts.
- Saved defaults are malformed or conflict with the normalized v2 schema.


## Failure Modes And Recovery


- Stop with a precise repo-root or config-path error instead of guessing.
- Preserve existing Blueprint artifacts unless the user explicitly confirms replacement.
- Reject removed repo keys such as `workflow.use_workspaces`, `workflow.use_workstreams`, or repo-level `hooks.*` instead of writing them back into config.
- If the user asks for a reserved effectiveness-spine config key before runtime support exists, report that it is documented but not yet writable instead of fabricating persistence.


## Acceptance Criteria


- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Creates or updates only the declared artifacts for this command.
- Persists project config in normalized full form and never treats `.blueprint/config.json` as a sparse override file.
- Never stores hook enablement in repo config; hook control remains in `hooks/hooks.json`.
- Keeps `workflow.code_review` and `workflow.code_review_depth` in the normalized config so `/blu-code-review` can read them as real defaults.
- Does not present or persist the reserved effectiveness-spine config keys before the runtime implementation slice ships.


## Test Cases


- Fresh repo fixture.
- Partially initialized Blueprint repo fixture.
- `settings` common-pass-only fixture.
- `settings` advanced-pass plus save-defaults fixture.
- Direct `settings` happy-path fixture.
