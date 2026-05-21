# Validate Phase Runtime Contract

This reference is the local runtime contract for `/blu-validate-phase`. It
translates the retained GSD Nyquist validation behavior into Blueprint-native
orchestration: MCP owns deterministic state, the command stays thin and
user-facing, the skill owns workflow policy, and the verifier agent performs
bounded read-only analysis when available.

This file is the canonical detailed contract for `validate-phase`. The skill
bundle, command manifest, and command doc should point here for detailed stage
mapping and retry behavior instead of restating the full flow.

## Visible Validation Progress

For non-trivial runs, keep progress visible through short boundary updates.
Gemini-native progress helpers are presentation mirrors only. They do not
expand the MCP tool allowlist, persistence authority, verifier authority,
coverage authority, validation authority, state-sync authority, routing
authority, or user confirmation authority defined by this contract.

Visible validation stages:

| Step | User-visible wording | Shared stage | Required visibility |
|------|----------------------|--------------|---------------------|
| 1 | resolve validation phase | Resolve | selected phase, phase directory, or recovery blocker |
| 2 | read saved execution evidence | Read | summary index, completed summary count, existing verification state, effective config, artifact health, and current state |
| 3 | classify validation state | Decide | State A/B/C, overwrite gate, verifier/Nyquist mode, missing evidence, and pre-write next action |
| 4 | analyze coverage and gaps | Execute | requirement/task coverage posture, gap classes, verifier/fallback mode, manual-only or deferred rows, and repair route candidates |
| 5 | write verification model | Persist | authoring-context status, model-validation status, write/reuse status, summaryPaths, and artifact path |
| 6 | validate saved artifacts | Validate | post-write artifact validation result, suggested repairs, retry status, and gate-state consistency |
| 7 | sync state and route | Route | state-sync result, saved gate state, readiness, and implemented next action |

Progress updates must be short boundary updates. Emit exceptional updates for
missing summaries, overwrite waits, manual-feedback or UAT-readiness waits,
verifier unavailable fallback, contradictory evidence, model-validation repair,
write rejection, post-write artifact-validation repair, state-sync failure,
ambiguous routing, and completion.

## Stage Mapping

| Stage | Purpose | Required Control Signal |
|-------|---------|-------------------------|
| Resolve | Identify the target phase and phase directory. | `blueprint_phase_locate.found`, `phaseNumber`, `phaseDir`, and recovery `reason`. |
| Read | Gather saved execution evidence and current validation baseline. | Summary index, every completed summary body, existing verification content, effective config, artifact health, and current state. |
| Decide | Classify input state and select reuse, revise, or stop behavior. | State A/B/C, overwrite gate, verifier and Nyquist config, missing evidence, and next safe action. |
| Execute | Run bounded validation analysis over saved evidence. | Requirement/task coverage map, test infrastructure metadata, gap classifications, and verifier result. |
| Persist | Validate and write only the canonical verification artifact. | `phase.verification` authoring context, narrowed `taskSchema`, model validation result, and `blueprint_phase_validation_write` response. |
| Validate | Re-validate persisted Blueprint artifacts and repair if needed. | `blueprint_artifact_validate.valid`, write status, issues, warnings, and suggested repairs. |
| Route | Update state and report the next implemented action. | `blueprint_state_update` plus saved gate state and readiness. |

## Required MCP Calls

Call these tools through runtime FQNs from the manifest. Their return values are
the authority for control flow. Every registered Blueprint MCP tool mirrors its
full `structuredContent` as compact JSON in `content.text`, so hosts that only
surface text still expose the complete deterministic result.

| Tool | Controls |
|------|----------|
| `blueprint_phase_locate` | Target phase resolution, unresolved-phase recovery, and phase-scoped write boundaries. |
| `blueprint_phase_summary_index` | Input state, completed versus pending execution evidence, and summary list for detailed reads. |
| `blueprint_phase_summary_read` | Source evidence for every completed summary; never validate from chat memory alone. |
| `blueprint_phase_validation_read` with `artifact: "verification"` | State A baseline and overwrite/reuse decision. |
| `blueprint_config_get` with `scope: "effective"` | Whether verifier and Nyquist-style coverage expectations are active or informational. |
| `blueprint_artifact_validate` | Preflight artifact health and post-write validation status. |
| `blueprint_state_load` | Current safe action and blockers before routing changes. |
| `blueprint_artifact_contract_read` with `artifactId: "phase.verification"` | Canonical markers, required headings, notes, and structured `modelContract` authority for the model-only public contract read. |
| `blueprint_phase_validation_authoring_context` with `artifact: "verification"` | Mandatory valid summary citations, compact saved-summary evidence, existing baseline, prerequisite blockers, allowed values, routing rules, base schema, and narrowed task schema. |
| `blueprint_phase_validation_validate_model` with `artifact: "verification"` | AJV task-schema validation, residual quality checks, all diagnostics, normalized model, and canonical markdown render preview from the structured verification payload. |
| `blueprint_phase_validation_write` with `artifact: "verification"` | The only allowed persistence path for `XX-VERIFICATION.md`; `/blu-validate-phase` passes the validated model with `authoringMode: "model-only"`. |
| `blueprint_state_update` with `base: "synced"` plus `patch.activeCommand: "/blu-validate-phase"` | Final state sync, active-command capture, and next-action derivation. |

## Input State Model

- State A: an existing `XX-VERIFICATION.md` exists. Read it as the audit
  baseline, compare the new evidence against it, and require explicit overwrite
  confirmation before changing it. Reuse unchanged valid evidence by default.
- State B: no verification artifact exists, but completed execution summaries
  exist. Reconstruct verification from saved summaries and the canonical
  `phase.verification` contract.
- State C: no completed execution summaries exist. Stop without writing and
  route to `/blu-execute-phase <phase>` when execution is the missing
  prerequisite. If plan artifacts are also missing, explain that the phase has
  not reached executable validation state.

When validation needs human confirmation around manual-only coverage, UAT
readiness, or another structured gate, use Gemini-native `ask_user` instead of
plain assistant prose.

## Evidence And Gap Analysis

Build a compact but explicit validation map before writing:

- reviewed summaries, plan ids, completed and pending plan ids
- requirement, task, or acceptance criteria identifiers found in saved summaries
- implementation or artifact surfaces cited by summaries
- existing test commands, verification notes, or evidence files cited by
  summaries
- test infrastructure metadata when visible in saved evidence or repo context
- coverage state per row: `PASS`, `COVERED`, `MANUAL`, `DEFERRED`, or `BLOCKED`
- gap class per row: `missing-evidence`, `partial-coverage`,
  `manual-only`, `deferred-test`, `contradiction`, or `none`

Nyquist-style validation is active when `workflow.nyquist_validation=true`.
When it is disabled, still report coverage gaps, but label the Nyquist pass as
informational and do not imply automated gap closure happened.

`/blu-validate-phase` remains advisory and artifact-focused. It must not mutate
implementation files or create tests. Route test-generation gaps to
`/blu-add-tests <phase>` and implementation or behavior gaps to `/blu-audit-fix
<phase>` only when those commands are implemented and the saved artifact makes
the need explicit.

## Artifact Authoring Rules

1. Read `phase.verification` with `blueprint_artifact_contract_read` before
   drafting final content.
2. Read `blueprint_phase_validation_authoring_context` before rendering so every mandatory summary citation, prerequisite blocker, allowed value, and routing rule is in the authoring packet.
3. Treat `contract.modelContract`, `requiredHeadings`, `lockedMarkers`,
   `freehandPolicy`, and `blueprint_phase_validation_authoring_context.taskSchema`
   as schema authority. Use `blueprint_phase_validation_validate_model.renderPreview`
   as the canonical rendered preview.
4. Preserve all locked markers exactly, including `**Coverage:**`,
   `**Gate State:**`, and `**Sign-off:**`.
5. Fill every required section with concrete evidence. Do not leave scaffold
   placeholders or generic "none" rows where gaps exist.
6. Keep every completed saved summary path or filename under `## Evidence Reviewed`.
7. Put requirement/task coverage under `## Requirement / Task Coverage`.
8. Put harness, command, evidence source, and confidence notes under
   `## Test Infrastructure / Evidence Metadata`.
9. Put manual-only and deferred coverage under
   `## Manual-Only or Deferred Coverage`.
10. Keep top `**Gate State:**` aligned with the `## Gate State` section:
   `PASS` means `ready for UAT`; `PARTIAL` or `BLOCKED` means
   `not ready for UAT`.
11. Do not declare `PASS` while unresolved coverage, gap, or repair signals
    remain. Use `PARTIAL` or `BLOCKED` and route to `/blu-audit-fix <phase>`
    for implementation/behavior gaps or `/blu-add-tests <phase>` for
    test-generation gaps.
12. Call `blueprint_phase_validation_validate_model` with the structured evidence payload and treat `status: "valid"` plus `renderPreview` as the pre-write self-check.
13. Author against `phase.verification` model schema `1.1.0`: include `status` equal to `gateState`, use `COVERED` or `PASS` for completed coverage rows, preserve validation session state, checkpoint, test matrix, result counts, observed behavior, unresolved gaps, structured gaps, and follow-up fixes when that detail exists, and let MCP normalize scalar `validationSummary`, lowercase `covered`, and empty or omitted passing no-gap arrays.
14. Call `blueprint_phase_validation_write` only with the same ready structured `model` and `authoringMode: "model-only"`; do not hand-build or pass the final markdown body from `/blu-validate-phase`. Model writes must not include identity fields such as `phase`, `artifact`, `path`, or `content`.

## Pre-Write Routing Shorthand

Before the final verification model validation and write, apply this exact routing logic:

- `if gateState == PASS and no unresolved gaps or repair signals remain -> nextSafeAction = /blu-verify-work <phase>`
- `else if explicit deferred-test or test-generation gaps remain -> nextSafeAction = /blu-add-tests <phase>`
- `else if implementation or behavior gaps remain -> nextSafeAction = /blu-audit-fix <phase>`
- `else -> keep nextSafeAction on /blu-validate-phase <phase> only for validation-document repair or manual-only prerequisites`

Treat this shorthand as a preflight against the live `taskSchema`, not a replacement for it. The
structured model still has to pass `blueprint_phase_validation_validate_model`, and `PASS` must stay
aligned with a ready-for-UAT artifact that carries no unresolved gap, deferred-test, or repair
signal.

## Capability-Gated Subagent Path

Gemini CLI exposes an enabled delegated verifier as the same-named
`blueprint-verifier` tool. Do not read, inline, or load separate agent source
before delegation. Call `blueprint-verifier` with a bounded validation task
packet only when the host provides that suitable code/workflow-analysis tool,
`workflow.verifier=true`, and `workflow.subagents` is not `false`.

Pass the verifier task packet:

- resolved phase number, name, and phase directory
- summary index metadata and every completed summary body
- existing verification artifact when present
- effective config values for verifier and Nyquist gates
- canonical `phase.verification` authoring rules
- requested output shape: `READY`, `GAPS`, or `BLOCKED`, plus populated
  coverage map, evidence sources, gap classifications, suggested repairs, and a
  verification draft

The verifier must remain read-only. It may recommend `/blu-add-tests <phase>`
for explicit test gaps or `/blu-audit-fix <phase>` for implementation/behavior
gaps, but it must not create or modify files during `/blu-validate-phase`.

Do not substitute browser, web-search-only, shell-only, or generic agents for
the `blueprint-verifier` tool. If the suitable verifier is unavailable, use the
fallback below.

## No-Subagent Fallback

When `blueprint-verifier` is unavailable, disabled, unnecessary, or unsafe, perform the same analysis
sequentially in the parent command:

1. Read one completed summary at a time.
2. Extract requirement/task evidence, changed surfaces, verification commands,
   unresolved blockers, and follow-up notes.
3. Compress each summary into a carry-forward row before reading the next one.
4. Build the requirement/task coverage map from the compressed rows.
5. Classify gaps and decide gate state.
6. Draft the canonical verification artifact from the final map.

This fallback must preserve the same output quality bar as the agent-tool path.

## Retry And Repair Behavior

- If `blueprint_phase_validation_validate_model` returns `status: "invalid"`, report the
  diagnostics, repair the structured payload against the canonical task schema, and
  validate again before calling the writer.
- If `blueprint_phase_validation_write` returns `status: "invalid"` or
  `written: false` after valid model validation, treat that as a race, overwrite, or
  prerequisite failure, repair once through MCP when safe, and stop with the
  issues otherwise. Do not run post-write artifact validation or state sync until
  the write succeeds with `written: true` or `status: "reused"`.
- If `blueprint_artifact_validate` reports invalid artifacts after a successful
  write or reuse outcome,
  use `suggestedRepairs` to revise the draft and retry once when the repair is
  phase-scoped and does not require external state.
- If overwrite confirmation is denied, preserve the existing artifact, report
  the newly discovered gaps as unsaved findings, and route back to
  `/blu-validate-phase <phase>` or `/blu-progress` based on implemented
  availability.
- If summaries are contradictory or missing required evidence, write a
  `BLOCKED` verification only when completed summaries exist and the artifact
  can cite the blocker. Otherwise stop without writing.
- If the draft claims `PASS` while the coverage table, gap classification,
  `## Gaps Found`, or `## Suggested Repairs` still contains unresolved work,
  repair the gate to `PARTIAL` or `BLOCKED` and route to `/blu-audit-fix
  <phase>` or `/blu-add-tests <phase>` before retrying the MCP write.
- Never claim persistence from a tool call unless `written` is `true` or the
  returned `status` explicitly says `reused`.

## Output Quality Criteria

A high-quality validation artifact:

- names every reviewed saved summary
- includes at least one concrete requirement/task coverage row
- shows the test or evidence basis for each major coverage claim
- distinguishes automated, manual-only, deferred, partial, and blocked coverage
- classifies gaps with repair paths instead of flattening them into generic
  suggestions
- states whether verifier and Nyquist gates were active or informational
- keeps gate state, readiness, and next safe action consistent
- routes only to implemented Blueprint commands

## Completion Criteria

`/blu-validate-phase` is complete only when one of these is true:

- State A is reused: existing valid verification remains the authority, state is
  synced, and the next safe action is reported.
- State A or B is written: final markdown passes the canonical contract,
  `blueprint_phase_validation_write` persists or updates it, post-write
  validation runs, state is synced, and routing matches the saved gate state.
- State C or unrecoverable invalid evidence is reached: no artifact is written,
  the missing prerequisite is named, and the user gets the next implemented
  recovery command.
