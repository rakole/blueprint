# `/blu-spec-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes |

## Shared Runtime Contract

- Rich behavior reference for this command: `skills/blueprint-phase-discovery/references/spec-phase-runtime-contract.md`
- Shared stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- The shared discovery skill should load only the active `/blu-spec-phase` runtime reference from its command input bundle; sibling discovery references stay out of scope unless the active contract explicitly calls for them.

## Purpose

`spec-phase` is Blueprint's phase-scoped requirements-shaping command. Its end
state is a phase-local `XX-SPEC.md` artifact that locks WHAT a phase should
deliver before `/blu-discuss-phase` focuses on HOW to execute it. It is optional:
missing `XX-SPEC.md` does not block normal discuss, research, or plan lifecycle
runs when those commands otherwise have enough grounded evidence.

## Command Path And Examples

- CLI command path: `/blu-spec-phase`
- Root router form: `/blu spec-phase`
- Argument hint: `<phase> [--auto] [--text]`
- `/blu-spec-phase 3`
- `/blu-spec-phase 3 --auto`
- `/blu spec-phase 3 --text`

## Inputs, Project State, And Prerequisite Artifacts

- The target phase must exist.
- The command should ground itself in Blueprint phase context, roadmap state,
  artifact inventory, and effective config before it asks for or drafts
  anything phase-specific.
- Existing `XX-CONTEXT.md`, `XX-RESEARCH.md`, or other discovery artifacts are
  supporting evidence only; they do not by themselves prove spec readiness.
- Missing `XX-SPEC.md` is not by itself a lifecycle blocker for
  `/blu-discuss-phase`, `/blu-research-phase`, or `/blu-plan-phase`.
- The command may be recommended by router/help/progress/next only after
  `blueprint_command_catalog` proves `/blu-spec-phase` is implemented.

## Outputs

- User-facing result: a compact status receipt that explains whether the run was
  reused saved evidence, wrote the spec, intentionally skipped writing, or
  prepared the next safe implemented action.
- Repo side effects: write validated phase-scoped `XX-SPEC.md` content through
  `blueprint_phase_artifact_write` with `artifact: "spec"` and update
  `.blueprint/STATE.md` through Blueprint MCP tools only.

## Behavior Stages

1. `Resolve`: identify the selected phase, preferring `blueprint_phase_context`
   and using `blueprint_phase_locate` only as fallback recovery.
2. `Read`: inspect roadmap state, artifact inventory, effective config, current
   phase artifacts, live contract data, and current Blueprint state.
3. `Decide`: run the existing-spec update/view/skip gate, keep spec-first
   versus refresh posture explicit, and stop early only when phase selection,
   grounding, write support, or routing proof is genuinely missing.
4. `Execute`: score ambiguity before asking new questions, then use the bounded
   Socratic loop to lock goal, boundary, constraint, and acceptance evidence.
5. `Persist`: persist only through `blueprint_phase_artifact_write` with
   `artifact: "spec"` and a resolved numeric phase.
6. `Validate`: normalize against the live `phase.spec` contract rather than a
   prompt-local template.
7. `Route`: update and reload state only through MCP when mutation is actually
   allowed, then recommend only implemented follow-up commands.

## Blueprint And Global State Reads

- `.blueprint/STATE.md`
- effective Blueprint config through `blueprint_config_get`
- roadmap and phase packet reads through Blueprint MCP tools
- existing phase-local discovery artifacts when present

## Blueprint And Global State Writes

- durable output: phase `XX-SPEC.md`
- `.blueprint/STATE.md` after successful spec persistence or a valid no-write
  state-sync path

## Required MCP Tools

- `blueprint_phase_locate` -> fallback recovery `{found, phaseNumber, phaseName, phaseDir, artifacts, reason, recovery}`
- `blueprint_phase_context` -> `{phaseSelection, phase, projectBrief, requirementsGrounding, workflowPosture, codebase, requirements, missingArtifacts, warnings}`
- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_phase_artifact_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, reason}`
- `blueprint_phase_artifact_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, written, created, overwritten, status, validation, warnings}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract, authoringTemplate, validation, warnings}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_state_update` -> `{updatedFields, statePath, warnings}`
- `blueprint_command_catalog` -> `{commands, waves, aliases}`

## Runtime Anchors

- Load `skills/blueprint-phase-discovery/references/spec-phase-runtime-contract.md`
  as the behavior authority for the command.
- Treat `skills/blueprint-phase-discovery/references/spec-template.md` as a
  drafting aid only. The live `phase.spec` contract is the authoring and
  validation authority.
- Use the quantitative ambiguity model, existing-spec view/update/skip gate,
  and bounded Socratic loop from the runtime contract.
- Persist only through `blueprint_phase_artifact_write` with a resolved numeric
  `phase` and `artifact: "spec"`.
- Verify any recommended follow-up through `blueprint_command_catalog` so the
  final response stays inside implemented routing.

## Skills And Subagents

- Primary skill: `blueprint-phase-discovery`
- Required skill reference: `skills/blueprint-phase-discovery/references/spec-phase-runtime-contract.md`
- Optional subagents: none required

## Dependencies

- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/discuss-phase.md`
- `docs/commands/research-phase.md`
- `docs/commands/ui-phase.md`

## External Shell Or Git Dependencies

- External dependencies:
- none

## Shell Risk Profile

- Low: this command writes one phase-scoped spec artifact and synced state
  through MCP-owned persistence only.

## User Prompts And Confirmation Gates

- `--auto` and `--text` are reserved command flags and should remain visible in
  the command surface.
- `--auto` selects reasonable defaults without `ask_user`, records those choices
  in the interview log, and keeps unresolved dimensions explicit.
- Interactive existing-spec runs use `ask_user` with `Update`, `View`, and
  `Skip`; `View` summarizes the saved spec before returning to the decision,
  and `Skip` exits without writing.
- `--text` uses plain numbered prompts instead of rich structured choices when
  needed.

## Edge Cases

- The selected phase is omitted or ambiguous while multiple active phases
  exist.
- Saved discovery artifacts exist but the phase still lacks enough grounded
  evidence for a durable spec.
- A saved spec exists and the user chooses update, view, or skip.
- A saved spec is stale or contradicts roadmap, context, research, or planning
  evidence and should be refreshed through `/blu-spec-phase`.

## Failure Modes And Recovery

- Explain exactly which prerequisite is missing: phase selection, grounding
  artifact, contract support, write-path support, or routing proof.
- Route to `/blu-progress` when the next safe implemented action is otherwise
  missing or ambiguous.
- Treat missing spec as nonblocking for normal discuss/research/plan lifecycle.

## Acceptance Criteria

- The command surface uses Blueprint and Gemini wording only.
- The command is catalog-gated and root-routable only when the live catalog entry
  reports `implemented`.
- Only the declared Blueprint MCP tools are available for persistent state
  reads or writes.
- The active runtime reference stays command-scoped to `/blu-spec-phase`.
- No raw `.blueprint` writes, source-file writes, or planned-only follow-up
  routes are described as successful completion.
- Missing `XX-SPEC.md` is documented as optional and nonblocking for normal
  lifecycle progression.

## Test Cases

- Manifest and skill metadata expose `/blu-spec-phase` with the
  `long-running-mutation` execution profile.
- The `/blu-spec-phase` input bundle resolves only
  `skills/blueprint-phase-discovery/references/spec-phase-runtime-contract.md`.
- The command catalog exposes `/blu-spec-phase` as implemented only when its
  manifest, skill, runtime metadata, required MCP tools, command docs, and
  required input paths are aligned.
