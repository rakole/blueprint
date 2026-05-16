# `/blu-ui-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- Rich behavior contract: `skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md`
- `ui-phase` uses the shared long-running-mutation posture for bounded UI-contract drafting: keep `Resolve`/`Read`/`Decide`/`Execute`/`Persist`/`Validate`/`Route` narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible while the run is live.
- Keep the in-flight UI posture honest while the run is live:
  - resolved scope: the selected phase, research readiness, current artifact reuse-versus-replace posture, and whether config currently points toward a real UI contract or an explicit skip rationale
  - active stage: the shared stage label behind the current UI-spec pass
  - pending gate: missing or ambiguous phase resolution, contract-versus-skip choice, `workflow.ui_safety_gate` rationale confirmation, overwrite confirmation, or checker-requested revision before save
  - execution mode: real UI contract versus explicit skip rationale, plus inline drafting versus the bounded `blueprint-ui-designer` and `blueprint-checker` loop
  - next safe action: finish the current UI draft, satisfy the active confirmation or checker gate, move to `/blu-plan-phase` when the saved UI artifact is ready, or fall back to `/blu-progress` when discovery prerequisites remain unresolved


## Purpose


`ui-phase` is Blueprint's command for generating a UI design contract (`UI-SPEC.md`) for frontend phases. In Blueprint it stays host-native, delegates persistence to documented MCP tools, reads the canonical `phase.ui-spec` contract before drafting or persisting, and uses a bounded checker review loop so designer output is revised before anything is saved.


## Command Path And Examples

- CLI command path: `/blu-ui-phase`
- Root router form: `/blu ui-phase`
- Argument hint: `[phase]`
- `/blu-ui-phase 2`
- `/blu ui-phase`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase must exist.
- Frontend-heavy phases should produce a UI contract.
- Backend-only or intentionally skipped phases should record the rationale in `XX-UI-SPEC.md` instead of inventing a second phase artifact.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: writes validated `XX-UI-SPEC.md` content and updates `.blueprint/STATE.md`.
- In-flight UI drafting should keep the resolved scope, active stage, pending gate, execution mode, and next safe action legible until the run concludes or stops on a confirmation or checker revision gate.

## Behavior Stages

1. `Resolve`: resolve the target phase, current research posture, and any config or runtime state that changes whether a UI contract or skip rationale is appropriate.
2. `Read`: inspect effective config, phase research status, any existing `XX-UI-SPEC.md`, and only the canonical contract or saved context/research bodies needed for the branch that actually runs.
3. `Decide`: keep contract-versus-skip posture, `workflow.ui_safety_gate` rationale requirements, overwrite posture, and checker review posture explicit before drafting.
4. `Execute`: draft one bounded `XX-UI-SPEC.md` outcome, using `blueprint-ui-designer` only when deeper UI guidance is useful, falling back to the no-subagent section-by-section path when suitable subagents are unavailable, and keeping checker revisions scoped to the affected sections. Skip mode stays progressive and only writes the `skipRationale` text.
5. `Persist`: use the dedicated skip-write MCP path for explicit skip mode, and use scaffold plus markdown persistence only for real UI-contract mode.
6. `Validate`: normalize only real UI-contract drafts to the canonical `authoringTemplate`, enforce the single-artifact `XX-UI-SPEC.md` contract, and block on placeholder output, missing rationale, or checker-requested revisions.
7. `Route`: summarize whether the artifact was reused, created, or revised, surface any warnings, and end on the next safe implemented action.


## Blueprint And Global State Reads


- effective Blueprint config through `blueprint_config_get`


## Blueprint And Global State Writes


- `phase XX-UI-SPEC.md` for either a UI contract or an explicit UI-skip rationale
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_research_status` -> `{hasContext, hasResearch, hasUiSpec}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_phase_artifact_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, reason}`
- `blueprint_phase_ui_skip_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, written, created, overwritten, status, validation, warnings}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract, authoringTemplate, validation, warnings}`
- `blueprint_phase_artifact_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, written, created, overwritten, warnings}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
- `blueprint_state_load` -> `{state, derivedStatus, warnings}`
- `blueprint_command_catalog` -> `{commands, families, routing}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## UI Persistence Contract

- Pass `phase` to `blueprint_phase_ui_skip_write` or `blueprint_phase_artifact_write` as the resolved numeric phase reference only, for example `"2"` or `2`.
- Read any existing `XX-UI-SPEC.md` through `blueprint_phase_artifact_read` before proposing replacement so overwrite confirmation stays explicit and reuse remains the default.
- If the run is explicit skip mode, keep the flow progressive: do not load the full `phase.ui-spec` contract, do not scaffold, and persist through `blueprint_phase_ui_skip_write` with only the final `skipRationale` text. That tool renders the minimal valid skip-form `XX-UI-SPEC.md`.
- If the run is real UI-contract mode, read the canonical `phase.ui-spec` contract through `blueprint_artifact_contract_read` with `artifactId: "phase.ui-spec"` before drafting or revising `XX-UI-SPEC.md`, and normalize the final draft to the returned `authoringTemplate`.
- Treat `contract.authoringTemplate` as the heading and schema authority only for real UI-contract mode while `skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md` supplies output richness, evidence density, fallback, and repair behavior for both branches.
- When real UI-contract mode needs saved context or research, read the actual `XX-CONTEXT.md` and `XX-RESEARCH.md` bodies through `blueprint_phase_artifact_read` before drafting so the UI spec is grounded in saved decisions rather than only status metadata.
- Use `blueprint_artifact_scaffold` only with the repo-relative UI-spec artifact path for the selected phase in real UI-contract mode. Bare names such as `UI-SPEC` and absolute filesystem paths are invalid.
- Use `blueprint-ui-designer` to draft the phase-scoped UI guidance when deeper design work is useful, then use `blueprint-checker` to review the draft against the phase requirements, locked Blueprint decisions, and discovery artifacts before any persistence step. If the checker requests revisions, update only the affected sections, re-normalize the draft to the same `authoringTemplate`, and re-run the checker before saving.
- When no suitable Blueprint UI design, code-analysis, or workflow-analysis subagent is available, use the explicit no-subagent fallback: write one concrete `skipRationale` string in skip mode, or draft one canonical section at a time plus self-check the six UI dimensions in real UI-contract mode, repair blockers, and then persist through MCP.
- Do not use browser-only, web-search-only, shell-only, or generic agents as substitutes for Blueprint UI design, codebase, or workflow analysis.
- Persist the real final markdown through `blueprint_phase_artifact_write` with `artifact: "ui-spec"` and treat the returned `path` as authoritative instead of rebuilding filenames manually.
- `XX-UI-SPEC.md` is the single durable output whether the phase gets a real UI contract or an explicit skip rationale. Do not invent a second skip artifact.

## UI Quality Contract

- UI contract mode should include design-system evidence, concrete spacing and layout rhythm, typography sizes/weights/line heights, color hierarchy with accent reserved-for list, copywriting for CTAs/empty/error/destructive states, screen and responsive state coverage, component reuse or new-component justification, accessibility/content hierarchy, and registry/design-system safety evidence.
- Checker review should evaluate six dimensions before persistence: copywriting, visual hierarchy, color, typography, spacing, and registry/design-system safety.
- Explicit skip mode should populate `## Outcome Mode` and `## Rationale`, including why UI work is out of scope, which safety gate was considered, and what scope change should trigger a revisit.


## Skills And Subagents


- Primary skill: `blueprint-phase-discovery`
- Optional subagents:
- `blueprint-ui-designer`
- `blueprint-checker`


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/new-project.md`
- `docs/commands/discuss-phase.md`
- `docs/commands/map-codebase.md`


## External Shell Or Git Dependencies


- External dependencies:
- web docs when framework behavior is unclear


## Shell Risk Profile

- Low: writes a UI design contract only.

## User Prompts And Confirmation Gates


- Confirm replacement when a UI spec already exists.
- Prefer Gemini CLI's built-in `ask_user` dialog for overwrite confirmation or focused contract-versus-skip decisions instead of a plain-text menu.
- Honor effective-config gates before writing:
- `workflow.ui_phase=false` should produce a documented skip rationale instead of a generated UI contract.
- `workflow.ui_safety_gate=true` should require an explicit rationale when UI work is skipped.
- Keep the active pending gate explicit as phase ambiguity, contract-versus-skip choice, `workflow.ui_safety_gate` rationale confirmation, overwrite confirmation, or checker-requested revision before save.
- Keep the next safe action inside the implemented surface: usually `/blu-plan-phase <phase>` once the UI artifact is settled, or `/blu-progress` when a prerequisite or confirmation gate still blocks the follow-up.
- Keep the checker-and-revision gate bounded: revise only the affected sections, then re-run the checker before persisting the final artifact.


## Edge Cases


- The selected phase is backend-only and should probably record an explicit UI-skip rationale instead of forcing a `UI-SPEC`.
- The project already has a design system, and the new UI contract needs to extend it rather than invent a parallel language.
- The target phase is omitted or ambiguous while multiple active phases exist.
- Expected prior artifacts exist but are stale, incomplete, or inconsistent with `ROADMAP.md`.


## Failure Modes And Recovery


- Explain exactly which phase artifact is missing and which command creates it.
- Write follow-up state back into `.blueprint/` instead of dropping context on failure.
- If `blueprint_phase_artifact_write` returns `status: "invalid"` or validation issues, repair the same normalized draft using the returned issues and retry through MCP once before declaring the run blocked.
- If the checker returns `BLOCK` or asks for revision, revise only the affected sections, re-normalize to the same `authoringTemplate`, and rerun the checker or no-subagent six-dimension self-check before persistence.


## Acceptance Criteria


- Reads and writes only the selected phase scope.
- Updates `STATE.md` whenever the next-step signal changes.
- Creates or updates only the declared artifacts for this command.
- Uses `XX-UI-SPEC.md` as the single phase-scoped durable output, whether the result is a full UI contract or a documented skip rationale.
- Respects effective-config UI gates before generating or skipping UI output.
- Keeps the contract-versus-skip posture, overwrite posture, checker revision gate, and next safe action explicit while the run is in flight.
- Persists substantive UI guidance or skip rationale into `XX-UI-SPEC.md`, not only scaffold placeholders.
- Reads the canonical `phase.ui-spec` contract before drafting or revising the artifact.
- Uses a checker-reviewed revision loop before persistence.
- Provides a capability-gated `blueprint-ui-designer` and `blueprint-checker` path plus a single-agent no-subagent fallback that does not lower output quality.
- Rejects browser-only, web-search-only, shell-only, or generic agents as substitutes for UI design or codebase analysis.
- Repairs invalid write or validation failures through MCP retry before completion.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Direct `ui-phase` happy-path fixture.
