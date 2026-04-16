# `/blu-new-project`
| Field | Value |
|---|---|
| Wave | `0` |
| Family | `Foundation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Purpose

`new-project` is Blueprint's command for initialize a new project with deep context gathering and `PROJECT.md`. In Blueprint it stays host-native and delegates persistence to documented MCP tools, but the orchestration depth must remain richer than a simple scaffold-only bootstrap.

## Command Path And Examples

- CLI command path: `/blu-new-project`
- Root router form: `/blu new-project`
- Argument hint: `[--auto]`
- `/blu-new-project --auto`
- `/blu new-project`

## Inputs, Project State, And Prerequisite Artifacts

- Run from the target repo root.

## Outputs

- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.
- `PROJECT.md`, `REQUIREMENTS.md`, and `ROADMAP.md` must be substantive bootstrap drafts rather than scaffold-only placeholders.
- Brownfield repos should be left ready for `map-codebase`, and project bootstrap should preserve durable requirement and roadmap traceability.

## Interaction Model

- Interactive bootstrap should begin with thread-following project questioning, not a rigid checklist.
- The questioning loop should capture enough clarity around vision, audience, constraints, milestone scope, and success outcomes that authored bootstrap artifacts do not force downstream commands to guess.
- Short option lists are allowed when they sharpen a concrete tradeoff, but the command should stay conversational and host-native.
- When structured choices help, interactive bootstrap should prefer Gemini CLI's built-in `ask_user` dialog, asked one focused question at a time with labeled options plus a typed custom-answer path.
- In interactive mode, the command should summarize its understanding and secure explicit approval before the first persistent bootstrap write.
- `--auto` may skip that approval loop only when the supplied brief is strong enough to synthesize a credible bootstrap seed.

## Behavior Stages

1. Preflight: confirm repo root, inspect saved defaults, classify repo shape, and require explicit overwrite confirmation when `.blueprint/` already exists.
2. Discovery: gather or synthesize a bootstrap brief with vision, audience, constraints, non-goals, milestone framing, and assumptions.
3. Workflow preferences: offer saved defaults first, then gather repo-level workflow settings only when they materially shape bootstrap quality.
4. Requirements shaping: draft specific, user-centered, traceable requirements and distinguish likely v1 scope from deferred or explicitly out-of-scope work.
5. Roadmap shaping: synthesize grouped phases with requirement coverage and success criteria, then run a revision loop when the user requests roadmap adjustments.
6. Persistence: use Blueprint MCP tools for the first write, then refine config or state through Blueprint MCP tools only.
7. Routing: end with the next safe implemented command, routing brownfield repos to `map-codebase` when roadmap confidence is still provisional.

## Blueprint And Global State Reads

- `~/.<host>/blueprint/defaults.json` when present

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

## Bootstrap Contract

- `blueprint_project_init` is the first persistent bootstrap write. Require explicit overwrite confirmation before calling it with `overwrite: true`.
- Treat returned `createdPaths`, `configPath`, and `nextAction` as authoritative instead of rebuilding bootstrap paths manually.
- Use `blueprint_artifact_scaffold` only for deliberate extra Blueprint artifacts, with supported repo-relative Blueprint artifact paths only. Bare names and absolute paths are invalid.
- Treat scaffold output as seeding, not final authored persistence.
- `blueprint_config_set` expects a JSON-object `patch`. Keep repo writes at `scope: "project"` by default, and use `scope: "defaults"` only when the user explicitly approved changing saved defaults.

## Skills And Subagents

- Primary skill: `blueprint-bootstrap`
- Optional subagents:
- `blueprint-project-researcher`
- `blueprint-roadmapper`

## Local Bootstrap References

- `skills/blueprint-bootstrap/references/questioning.md`

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

- When interactive and `~/.<host>/blueprint/defaults.json` exists, offer those saved defaults before asking project-specific setup questions.
- In interactive mode, ask enough discovery questions to write a substantive project brief before the first persistent write.
- Follow the thread of the user's idea instead of running a canned bootstrap survey.
- Use concise conversational choices only when they help the user react to a real ambiguity or scope tradeoff, and prefer `ask_user` over plain-text numbered lists when a structured choice is useful.
- `--auto` is a non-interactive bootstrap mode: apply saved defaults automatically when they are available and valid, skip follow-up questioning, and surface any assumptions explicitly in the written artifacts.
- Confirm overwrite if `.blueprint/` already exists.
- `--auto` must not bypass the overwrite confirmation gate.
- In interactive mode, summarize your understanding and require explicit approval before the first persistent bootstrap write, preferably through `ask_user`.
- In interactive mode, requirements and roadmap shape should support a revision loop before the first persistent write when the user wants adjustments.
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
- If the user has not supplied enough context for a credible bootstrap, keep questioning instead of inventing product intent.
- Do not promise GSD-style `.planning/research/`, shell commit choreography, or generated instruction-file behavior that Blueprint has not implemented.

## Acceptance Criteria

- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Creates or updates only the declared artifacts for this command.
- Seeds `.blueprint/config.json` as a fully materialized normalized v2 config using hardcoded defaults, optional user defaults, and the current command inputs.
- Produces authored `PROJECT.md`, `REQUIREMENTS.md`, and `ROADMAP.md` bootstrap drafts instead of placeholder shells.
- Interactive bootstrap discovery follows the user's idea thread deeply enough that project intent, milestone scope, and success outcomes are explicit before the first write.
- Interactive bootstrap provides a revision loop for requirements and roadmap structure before first-write persistence when the user wants changes.
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
