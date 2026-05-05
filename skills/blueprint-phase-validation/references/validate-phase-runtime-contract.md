# Validate Phase Runtime Contract

This reference is the local runtime contract for `/blu-validate-phase`. It
translates the retained GSD Nyquist validation behavior into Blueprint-native
orchestration: MCP owns deterministic state, the command stays thin and
user-facing, the skill owns workflow policy, and the verifier agent performs
bounded read-only analysis when available.

This file is the canonical detailed contract for `validate-phase`. The skill
bundle, command manifest, and command doc should point here for detailed stage
mapping and retry behavior instead of restating the full flow.

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
the authority for control flow.

| Tool | Controls |
|------|----------|
| `blueprint_phase_locate` | Target phase resolution, unresolved-phase recovery, and phase-scoped write boundaries. |
| `blueprint_phase_summary_index` | Input state, completed versus pending execution evidence, and summary list for detailed reads. |
| `blueprint_phase_summary_read` | Source evidence for every completed summary; never validate from chat memory alone. Its MCP text response includes the full summary body for hosts whose generic file tools ignore `.blueprint/`. |
| `blueprint_phase_validation_read` with `artifact: "verification"` | State A baseline and overwrite/reuse decision. Its MCP text response includes the full validation artifact body when present. |
| `blueprint_config_get` with `scope: "effective"` | Whether verifier and Nyquist-style coverage expectations are active or informational. |
| `blueprint_artifact_validate` | Preflight artifact health and post-write validation status. |
| `blueprint_state_load` | Current safe action and blockers before routing changes. |
| `blueprint_artifact_contract_read` with `artifactId: "phase.verification"` | Canonical heading, marker, authoring-template, and structured `modelContract` authority. Its MCP text response includes the full model schema when present. |
| `blueprint_phase_validation_authoring_context` with `artifact: "verification"` | Mandatory valid summary citations, compact saved-summary evidence, existing baseline, prerequisite blockers, allowed values, routing rules, base schema, and narrowed task schema. Its MCP text response includes schemas and existing validation content for hosts that expose only text. |
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
3. Treat `contract.authoringTemplate`, `requiredHeadings`, `lockedMarkers`,
   `freehandPolicy`, and `modelContract` as schema authority.
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
13. Author against `phase.verification` model schema `1.1.0`: include `status` equal to `gateState`, use `COVERED` or `PASS` for completed coverage rows, preserve validation session state, checkpoint, test matrix, result counts, observed behavior, unresolved gaps, structured gaps, and follow-up fixes when that detail exists, and let MCP normalize scalar `validationSummary`, lowercase `covered`, and empty passing no-gap arrays.
14. Call `blueprint_phase_validation_write` only with the same ready structured `model` and `authoringMode: "model-only"`; do not hand-build or pass the final markdown body from `/blu-validate-phase`. Model writes must not include identity fields such as `phase`, `artifact`, `path`, or `content`.

## Capability-Gated Subagent Path

Use `blueprint-verifier` only when the host provides that suitable
code/workflow-analysis agent and `workflow.verifier=true`.

Pass the verifier:

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
`blueprint-verifier`. If the suitable verifier is unavailable, use the
fallback below.

## No-Subagent Fallback

When a suitable verifier is unavailable or disabled, perform the same analysis
sequentially in the parent command:

1. Read one completed summary at a time.
2. Extract requirement/task evidence, changed surfaces, verification commands,
   unresolved blockers, and follow-up notes.
3. Compress each summary into a carry-forward row before reading the next one.
4. Build the requirement/task coverage map from the compressed rows.
5. Classify gaps and decide gate state.
6. Draft the canonical verification artifact from the final map.

This fallback must preserve the same output quality bar as the subagent path.

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
