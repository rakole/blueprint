# `/blu-new-project`
| Field | Value |
|---|---|
| Wave | `0` |
| Family | `Foundation` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `new-project` uses the shared long-running-mutation posture while keeping the richer Gemini-native bootstrap flow: resolve repo shape and bootstrap intent, read saved defaults plus canonical bootstrap contracts, decide overwrite, approval, and workflow-preference gates, execute bounded discovery and shaping, persist through MCP, validate the resulting artifacts, and route to the next safe implemented follow-up.
- Keep the richer bootstrap language grounded in the shared in-flight status contract:
  - resolved scope: the target repo root, repo shape, auto vs interactive posture, and whether bootstrap is greenfield-ready or brownfield-provisional
  - active stage: the current shared stage label behind the richer bootstrap narration
  - pending gate: overwrite confirmation, missing brief, saved-default choice, pre-write approval, revision request, or MCP/runtime availability blocker
  - execution mode: interactive bootstrap, `--auto`, and whether optional bounded research or roadmap synthesis is in play
  - next safe action: the authoritative follow-up from project status, including `/blu-map-codebase` when brownfield mapping is still required

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
- In-flight bootstrap should keep the resolved scope, active stage, pending gate, execution mode, and next safe action legible while the run is still live.

## Interaction Model

- Interactive bootstrap should begin with thread-following project questioning, not a rigid checklist.
- The questioning loop should capture enough clarity around vision, audience, constraints, milestone scope, and success outcomes that authored bootstrap artifacts do not force downstream commands to guess.
- Short option lists are allowed when they sharpen a concrete tradeoff, but the command should stay conversational and host-native.
- When structured choices help, interactive bootstrap should prefer Gemini CLI's built-in `ask_user` dialog, asked one focused question at a time with labeled options plus a typed custom-answer path.
- When the bootstrap spans multiple stages, use Gemini CLI's internal `update_topic` and `write_todos` tools to keep the session legible instead of relying on repeated prose-only progress recaps.
- In interactive mode, the command should summarize its understanding and secure explicit approval before the first persistent bootstrap write.
- `--auto` may skip that approval loop only when the supplied brief is strong enough to synthesize a credible bootstrap seed.

## Behavior Stages

1. `Resolve`: confirm repo root, detect `--auto`, classify repo shape, and require explicit overwrite confirmation when `.blueprint/` already exists.
2. `Read`: inspect saved defaults, effective warnings, repo evidence, and canonical bootstrap artifact contracts before the first persistent write.
3. `Decide`: initialize Gemini-native session coordination, gather or synthesize the bootstrap brief, offer saved defaults first, and run approval or revision gates when interactive shaping needs a decision.
4. `Execute`: draft specific, user-centered, traceable requirements and grouped roadmap phases with success criteria, using optional bounded research or roadmapping help only when it materially improves the bootstrap.
5. `Persist`: use Blueprint MCP tools for the first write, then refine config or state through Blueprint MCP tools only.
6. `Validate`: validate the authored bootstrap, surface warnings or provisional roadmap confidence honestly, and keep the revision loop available before or after the first draft when the command contract calls for it.
7. `Route`: end with the next safe implemented command, routing brownfield repos to `map-codebase` when roadmap confidence is still provisional.

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
- `blueprint_artifact_contract_read` -> `{artifactId, contract}` or `{artifactId: null, contracts}`
- `blueprint_artifact_validate` -> `{valid, issues, suggestedRepairs, warnings}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`

## Gemini-Native Internal Tool Guidance

- Prefer `ask_user` for structured clarification, overwrite approval, and the final pre-write decision gate.
- Use `write_todos` for the visible session-local bootstrap checklist when the run spans multiple stages.
- Use `update_topic` to keep the current bootstrap stage and status visible during long discovery or shaping runs.
- When the bootstrap flow develops real internal dependencies, use Gemini CLI task-tracking tools such as `tracker_create_task`, `tracker_add_dependency`, `tracker_update_task`, `tracker_get_task`, `tracker_list_tasks`, and `tracker_visualize` to coordinate that graph instead of recreating it in prose.
- Treat Gemini-native todos, topic narration, and task tracking as session-local coordination aids only; Blueprint MCP tools remain the only durable state owner.
- If the command needs to verify Gemini CLI capability details before relying on them, use `get_internal_docs` for self-correction instead of guessing.

## Bootstrap Contract

- Read the canonical bootstrap artifact contracts for `bootstrap.project`, `bootstrap.requirements`, and `bootstrap.roadmap` before shaping the first authored drafts.
- `blueprint_project_init` is the first persistent bootstrap write. Require explicit overwrite confirmation before calling it with `overwrite: true`.
- Treat returned `createdPaths`, `configPath`, and `nextAction` as authoritative instead of rebuilding bootstrap paths manually.
- Use `blueprint_artifact_scaffold` only for deliberate extra Blueprint artifacts, with supported repo-relative Blueprint artifact paths only. Bare names and absolute paths are invalid.
- Treat scaffold output as seeding, not final authored persistence.
- Validate the written bootstrap artifacts with `blueprint_artifact_validate` before treating bootstrap as complete.
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
- Keep Gemini-native session coordination honest as the bootstrap progresses:
- initialize `write_todos` and `update_topic` early for non-trivial runs
- update task-tracker state when optional research, revision, or validation branches appear
- close the loop before finishing so the visible topic and task state match the actual bootstrap outcome
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
- Uses Gemini-native session helpers such as `ask_user`, `write_todos`, `update_topic`, and the task tracker when helpful to keep long bootstrap runs structured without turning those helpers into durable state.
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
