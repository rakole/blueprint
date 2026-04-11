# `/blu:new-project`
| Field | Value |
|---|---|
| Wave | `0` |
| Family | `Foundation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Initialize a new project with deep context gathering and PROJECT.md |

## Purpose

`new-project` carries forward the GSD intent to initialize a new project with deep context gathering and `PROJECT.md`. In Blueprint it stays Gemini-native and delegates persistence to documented MCP tools, but the orchestration depth must remain closer to upstream than a simple scaffold-only bootstrap.

## Command Path And Examples

- Gemini command path: `/blu:new-project`
- Root router form: `/blu new-project`
- Argument hint: `[--auto]`
- `/blu:new-project --auto`
- `/blu new-project`

## Inputs, Project State, And Prerequisite Artifacts

- Run from the target repo root.

## Outputs

- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.
- `PROJECT.md`, `REQUIREMENTS.md`, and `ROADMAP.md` must be substantive bootstrap drafts rather than scaffold-only placeholders.
- Brownfield repos should be left ready for `map-codebase`, and project bootstrap should preserve durable requirement and roadmap traceability.

## Blueprint And Global State Reads

- `~/.gemini/blueprint/defaults.json` when present

## Blueprint And Global State Writes

- `.blueprint/PROJECT.md`
- `.blueprint/REQUIREMENTS.md`
- `.blueprint/ROADMAP.md`
- `.blueprint/STATE.md`
- `.blueprint/config.json`
- `.blueprint/phases/`

## Required MCP Tools

- `blueprint_project_init` -> `{projectRoot, createdPaths, seededState, configPath, configProvenance}`
- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_config_set` -> `{scope, updatedKeys, config, provenance, configPath, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`

## Skills And Subagents

- Primary skill: `blueprint-bootstrap`
- Optional subagents:
- `blueprint-project-researcher`
- `blueprint-roadmapper`

## Dependencies

- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`

## External Shell Or Git Dependencies

- External dependencies:
- none

## Shell Risk Profile

- Medium: creates the initial planning tree and repo-level Blueprint state.

## User Prompts And Confirmation Gates

- When interactive and `~/.gemini/blueprint/defaults.json` exists, offer those saved defaults before asking project-specific setup questions.
- `--auto` is a non-interactive bootstrap mode: apply saved defaults automatically when they are available and valid, skip follow-up questioning, and surface any assumptions explicitly in the written artifacts.
- Confirm overwrite if `.blueprint/` already exists.
- `--auto` must not bypass the overwrite confirmation gate.
- For brownfield repos, classify the repo before the first persistent write and make the next safe step explicit:
- if the repo is unmapped, route to `map-codebase`
- if bootstrap artifacts are generated before mapping, mark the roadmap as provisional until mapping is complete
- if `.blueprint/codebase/` already exists, allow normal bootstrap follow-through

## Edge Cases

- The repo already contains a partial `.blueprint/` tree from an earlier attempt.
- The command is invoked from a nested directory rather than the repo root.
- Saved defaults exist but are malformed, outdated, or contain repo-specific fields that must be dropped during seeding.

## Failure Modes And Recovery

- Stop with a precise repo-root or config-path error instead of guessing.
- Preserve existing Blueprint artifacts unless the user explicitly confirms replacement.
- If saved defaults cannot be normalized, fall back to hardcoded defaults and explain that the defaults layer was skipped.

## Acceptance Criteria

- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Creates or updates only the declared artifacts for this command.
- Seeds `.blueprint/config.json` as a fully materialized normalized v2 config using hardcoded defaults, optional user defaults, and the current command inputs.
- Produces authored `PROJECT.md`, `REQUIREMENTS.md`, and `ROADMAP.md` bootstrap drafts instead of placeholder shells.
- Keeps requirement IDs traceable from `REQUIREMENTS.md` into `ROADMAP.md`.
- Makes repo-shape assumptions explicit instead of silently inventing them.
- For brownfield repos, sets the next safe action to `map-codebase` whenever roadmap confidence is still provisional.

## Test Cases

- Fresh repo fixture.
- Partially initialized Blueprint repo fixture.
- New-project fixture with saved defaults present.
- Direct `new-project` happy-path fixture.
- Brownfield fixture that routes to `map-codebase`.
- Bootstrap seed fixture that verifies authored requirements and roadmap traceability.

## Upstream Reference

- Upstream command file: `commands/gsd/new-project.md`
- Upstream workflow status: GSD has an upstream workflow file
