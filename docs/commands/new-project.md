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
- Use Gemini-native coordination helpers according to the centralized guardrails in `skills/blueprint-bootstrap/references/runtime-guardrails.md`.
- In interactive mode, the command should summarize its understanding and secure explicit approval before the first persistent bootstrap write.
- Approval must be reviewable in the main Gemini CLI conversation before the confirmation prompt.
- `bootstrapMode` defaults to `interactive`; `--auto` is the command-facing way to request `bootstrapMode: "auto"`.
- Interactive mode must pass a sufficient `bootstrapSeed` into `blueprint_project_init`. If the seed is missing or too thin, the tool rejects before writing and the command should keep asking rather than asking the MCP layer to invent purpose, requirements, roadmap, state, config, or phases.
- `--auto` may synthesize bootstrap artifacts only because the user explicitly requested it, only when the supplied or repo-derived brief is strong enough to produce a complete `bootstrapSeed`, and only after brownfield map-first gating has passed. If no complete seed can be produced, stop and ask for the missing brief.

## Behavior Stages

1. `Resolve`: confirm repo root, detect `--auto`, classify repo shape, and require explicit overwrite confirmation when initialized core `.blueprint/` artifacts already exist.
2. `Read`: inspect saved defaults, effective warnings, repo evidence, and canonical bootstrap artifact contracts before the first persistent write.
3. `Decide`: initialize Gemini-native session coordination, gather or synthesize the bootstrap brief, offer saved defaults first, and run approval or revision gates when interactive shaping needs a decision.
4. `Execute`: draft specific, user-centered, traceable requirements and grouped roadmap phases with success criteria, using optional bounded research or roadmapping help only when it materially improves the bootstrap.
5. `Persist`: use Blueprint MCP tools for the first write, then refine config or state through Blueprint MCP tools only.
6. `Validate`: validate the authored bootstrap, surface warnings or provisional roadmap confidence honestly, and keep the revision loop available before or after the first draft when the command contract calls for it.
7. `Route`: end with the next safe implemented command, routing brownfield repos to `map-codebase` when roadmap confidence is still provisional.

## Research, Requirements, And Roadmap Quality

- Optional `blueprint-project-researcher` and `blueprint-roadmapper` use is capability-gated. Browser, web-search, shell-only, or generic helpers are not substitutes for Blueprint code/workflow analysis agents.
- When project research is useful, the bootstrap contract uses the GSD-inspired dimensions that are relevant to the repo: stack, features, architecture, and pitfalls. These are synthesis inputs, not a `.planning/research/` runtime dependency.
- When subagents are unavailable, the parent command falls back to sequential one-topic-at-a-time work: classify repo shape, handle stack/features/architecture/pitfalls as needed, scope one requirement group at a time, compress carry-forward evidence, then perform a final coverage pass.
- Requirements must be specific, user-centered, atomic, grouped, and traceable.
- Roadmap phases must map every committed requirement exactly once, include dependency notes, and carry 2-5 observable success criteria per phase.
- Validation or MCP write failures caused by thin content, missing headings, placeholders, missing success criteria, or traceability gaps trigger seed repair and retry through MCP. The command must not hand-edit `.blueprint/` artifacts around the MCP owner.

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

- `blueprint_project_init` -> `{projectRoot, createdPaths, seededState, configPath, configProvenance}` with `bootstrapMode: "interactive" | "auto"` and default `interactive`
- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_config_set` -> `{scope, updatedKeys, config, provenance, configPath, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract}` or `{artifactId: null, contracts}`
- `blueprint_artifact_validate` -> `{valid, issues, suggestedRepairs, warnings}`

## Gemini-Native Internal Tool Guidance

- `skills/blueprint-bootstrap/references/runtime-guardrails.md` is the canonical source for `ask_user`, `update_topic`, `write_todos`, task-tracker, `get_internal_docs`, MCP FQN, shell, and approval-surface behavior.
- Keep those helpers session-local only; Blueprint MCP tools remain the only durable state owner.
- The final pre-write approval still requires a visible project brief and roadmap preview in the main conversation.

## Bootstrap Contract

- Read the canonical bootstrap artifact contracts for `bootstrap.project`, `bootstrap.requirements`, and `bootstrap.roadmap` before shaping the first authored drafts.
- `blueprint_project_init` is the first persistent core bootstrap write. Require explicit overwrite confirmation before calling it with `overwrite: true`.
- Brownfield map-first gating happens before this write: unmapped brownfield repos and `mapping-incomplete` codebase-only bundles must route to `/blu-map-codebase`.
- `mapped-only` is not an overwrite conflict; call `blueprint_project_init` with an explicit seed and preserve existing `.blueprint/codebase/*.md`.
- Treat returned `createdPaths`, `configPath`, and `nextAction` as authoritative instead of rebuilding bootstrap paths manually.
- Do not call `blueprint_artifact_scaffold` before initialization. Use it only for deliberate extra Blueprint artifacts after `blueprint_project_init`, with supported repo-relative Blueprint artifact paths only. Bare names and absolute paths are invalid.
- Treat scaffold output as seeding, not final authored persistence.
- Validate the written bootstrap artifacts with `blueprint_artifact_validate` before treating bootstrap as complete.
- `blueprint_config_set` expects a JSON-object `patch`. Keep repo writes at `scope: "project"` by default, and use `scope: "defaults"` only when the user explicitly approved changing saved defaults.

## Skills And Subagents

- Primary skill: `blueprint-bootstrap`
- Optional subagents:
- `blueprint-project-researcher`
- `blueprint-roadmapper`

## Runtime Packaging

- The direct command manifest is intentionally thin and should stay focused on
  host-entrypoint and runtime-guardrail instructions.
- The runtime-heavy bootstrap workflow now lives in the self-sufficient
  `blueprint-bootstrap` skill package under `skills/blueprint-bootstrap/`.
- `docs/commands/new-project.md` and `docs/RUNTIME-REFERENCE.md` remain the
  canonical external truth for humans and parity review, but live runtime
  execution must not require those docs.

## Local Bootstrap References

- `skills/blueprint-bootstrap/references/questioning.md`
- `skills/blueprint-bootstrap/references/bootstrap-runtime-contract.md`
- `skills/blueprint-bootstrap/references/runtime-guardrails.md`

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
- Use concise conversational choices only when they help the user react to a real ambiguity or scope tradeoff.
- `--auto` is a non-interactive bootstrap mode: apply saved defaults automatically when they are available and valid, skip follow-up questioning, and surface any assumptions explicitly in the written artifacts.
- Confirm overwrite if `.blueprint/` already exists.
- `--auto` must not bypass the overwrite confirmation gate.
- In interactive mode, summarize your understanding and require explicit approval before the first persistent bootstrap write.
- Follow the centralized approval-surface rule in `runtime-guardrails.md`: the prompt must refer to a visible preview already shown in the main Gemini CLI window.
- In interactive mode, requirements and roadmap shape should support a revision loop before the first persistent write when the user wants adjustments.
- Keep Gemini-native session coordination honest as described in `runtime-guardrails.md`.
- For brownfield repos, classify the repo before the first persistent write and make the next safe step explicit:
- if the repo is unmapped, hard-stop before writing and route to `map-codebase`
- if `.blueprint/codebase/` is interrupted, invalid, or incomplete, route to `map-codebase`
- if `.blueprint/codebase/` is valid and core bootstrap artifacts are absent, treat the repo as `mapped-only` and allow bootstrap follow-through without replacing codebase docs

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
- Interactive bootstrap shows the reviewable project brief and roadmap preview in the main Gemini CLI conversation before the approval prompt.
- Uses Gemini-native session helpers through the centralized guardrail contract when helpful, without turning those helpers into durable state.
- Keeps requirement IDs traceable from `REQUIREMENTS.md` into `ROADMAP.md`.
- Makes repo-shape assumptions explicit instead of silently inventing them.
- For brownfield repos, sets the next safe action to `map-codebase` whenever roadmap confidence is still provisional.

## Test Cases

- Fresh repo fixture.
- Partially initialized Blueprint repo fixture.
- New-project fixture with saved defaults present.
- Direct `new-project` happy-path fixture.
- Brownfield fixture that rejects `new-project` before writes and routes to `map-codebase`.
- Mapped-only brownfield fixture that bootstraps with an explicit seed and preserves `.blueprint/codebase/*.md`.
- Bootstrap seed fixture that verifies authored requirements and roadmap traceability.
- Subagent contract fixture that verifies capability-gated project research/roadmapping and the no-subagent fallback.
- Validation-retry fixture that verifies thin or invalid authored bootstrap content routes back through seed repair rather than manual artifact edits.
