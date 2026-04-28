# Verify Work Runtime Contract

This reference is the local runtime contract for `/blu-verify-work`. It
translates the retained GSD conversational UAT behavior into Blueprint-native
orchestration: MCP owns deterministic state, the command stays thin and
user-facing, the skill owns workflow policy, and the verifier agent performs
bounded read-only UAT analysis when a suitable agent is available.

## Stage Mapping

| Stage | Purpose | Required Control Signal |
|-------|---------|-------------------------|
| Resolve | Identify the target phase and phase directory. | `blueprint_phase_locate.found`, `phaseNumber`, `phaseDir`, and recovery `reason`. |
| Read | Gather saved execution evidence, ready verification evidence, existing UAT state, effective config, artifact health, and current state. | Summary index, every completed valid summary body, `verification` read, `uat` read, config, artifact validation, and state load results. |
| Decide | Select view, resume, update, create, or stop behavior. | Missing prerequisites, existing UAT decision, overwrite gate, verifier and Nyquist config, active checkpoint, and next safe action. |
| Execute | Run bounded conversational UAT over user-observable outcomes. | Test queue, current test, response classification, result counts, structured gaps, blocked prerequisites, and verifier result. |
| Persist | Render and write only the canonical UAT artifact. | `phase.uat` authoring context, locked markers, structured render result, and `blueprint_phase_validation_write` response. |
| Validate | Re-validate persisted Blueprint artifacts and repair if needed. | `blueprint_artifact_validate.valid`, write status, issues, warnings, and suggested repairs. |
| Route | Update state and report the next implemented action. | `blueprint_state_update` plus saved UAT status, checkpoint state, blockers, and readiness. |

## Required MCP Calls

Call these tools through runtime FQNs from the manifest. Their return values are
the authority for control flow.

| Tool | Controls |
|------|----------|
| `blueprint_phase_locate` | Target phase resolution, unresolved-phase recovery, and phase-scoped write boundaries. |
| `blueprint_phase_summary_index` | Input state, completed versus pending execution evidence, and summary list for detailed reads. |
| `blueprint_phase_summary_read` | Source evidence for every completed valid summary; never build UAT from chat memory alone. |
| `blueprint_phase_validation_read` with `artifact: "verification"` | Required validation baseline plus typed `validation`, `verificationReadyForUat`, and `complete` truth. |
| `blueprint_phase_validation_read` with `artifact: "uat"` | Existing session state plus typed `validation`, `uatStatus`, `resumeState`, `checkpoint`, and `complete` truth for view/resume/update decisions. |
| `blueprint_config_get` with `scope: "effective"` | Whether verifier and Nyquist-style gap expectations are active or informational. |
| `blueprint_artifact_validate` | Preflight artifact health and post-write validation status. |
| `blueprint_state_load` | Current safe action and blockers before routing changes. |
| `blueprint_artifact_contract_read` with `artifactId: "phase.uat"` | Canonical heading, marker, and authoring-template authority. |
| `blueprint_phase_validation_authoring_context` with `artifact: "uat"` | Mandatory summary evidence, ready-verification prerequisite status, existing UAT baseline, allowed values, and routing rules. |
| `blueprint_phase_validation_render` with `artifact: "uat"` | Canonical UAT markdown rendering and pre-write validation from the structured UAT payload. |
| `blueprint_phase_validation_write` with `artifact: "uat"` | The only allowed persistence path for `XX-UAT.md`. |
| `blueprint_state_update` with `base: "synced"` | Final state sync and next-action derivation. |

Checkpoint state for `/blu-verify-work` lives in `XX-UAT.md` itself. Do not use
the shared phase checkpoint JSON tools for UAT continuation.

## Input State Model

- Missing summaries: stop without writing and route to `/blu-execute-phase
  <phase>`.
- Missing verification: stop without writing and route to
  `/blu-validate-phase <phase>`.
- Invalid verification or verification not ready for UAT: stop without writing
  and route to `/blu-validate-phase <phase>` for repair.
- Existing invalid UAT: summarize the validation issues and treat it as view or
  explicit replacement only; do not resume malformed saved UAT blindly.
- Existing valid incomplete UAT: default to view or resume. Replacement
  requires an explicit user update path plus overwrite confirmation before
  persistence.
- No existing UAT and prerequisites are ready: create a new summary-grounded UAT
  pass.

## Test Queue Construction

Build a concrete UAT queue before asking the user anything.

1. Read every completed valid summary.
2. Extract user-observable accomplishments and workflow changes from sections
   such as outcome, changes made, verification, follow-ups, evidence, and saved
   file references.
3. Skip purely internal implementation details unless they affect visible
   startup, command behavior, generated artifacts, routing, or errors.
4. For each test, produce:
   - `name`: short observable behavior label
   - `expected`: what the user should see, receive, or be able to do
   - `evidence`: saved summary path or filename plus any verification evidence
   - `result`: `pending`, `pass`, `issue`, `skipped`, or `blocked`
5. Prepend a cold-start smoke test when saved summary evidence touches startup,
   server entrypoints, CLI entrypoints, database, seed, migration, Docker, or
   other first-run surfaces.

## Conversational UAT Loop

Present one test at a time. Show expected behavior and ask whether reality
matches. Keep the prompt plain and specific; do not interrogate the user for
severity or internal implementation guesses. When the host supports interactive
questions, use `ask_user` for the first-pass result on each test with one
focused prompt and explicit result choices such as `pass`, `issue`, `blocked`,
or `skipped`. Only fall back to plain assistant prose when `ask_user` is
unavailable, and ask a short follow-up question when an `issue` or `blocked`
result needs detail that should be preserved in the UAT artifact.

Response classification:

- Empty response -> `no-answer`; restate the current test once and ask again
- `yes`, `y`, `ok`, `pass`, `next`, or `approved` -> `pass`
- `skip`, `can't test`, or `n/a` -> `skipped`, preserving the reason when given
- Responses that mention blocked prerequisites such as server, not running,
  physical device, release build, third-party configuration, or prior phase ->
  `blocked` with `blocked_by` set to `server`, `physical-device`,
  `release-build`, `third-party`, `prior-phase`, or `other`
- Any other response -> `issue`, preserving the verbatim report and inferring
  severity:
  - crash, error, exception, fails, broken, unusable -> `blocker`
  - does not work, wrong, missing, cannot -> `major`
  - slow, weird, minor, small -> `minor`
  - color, font, spacing, alignment, visual -> `cosmetic`
  - default -> `major`

Blocked tests are prerequisite gates, not code gaps. Issue results become
structured gaps that can later feed explicit gap closure planning or follow-up
fix capture.

For non-trivial UAT, checkpoint after each major test group. Use `ask_user` for
`review`, `skip`, or `stop` choices:

- `review`: summarize current progress, observed behavior, counts, and gaps
  before continuing.
- `skip`: mark the current area skipped or deferred in the UAT artifact and
  continue.
- `stop`: persist the current test queue, counts, gaps, and checkpoint; keep
  the next safe action on `/blu-verify-work <phase>`.

## Artifact Authoring Rules

1. Read `phase.uat` with `blueprint_artifact_contract_read` before drafting
   final content.
2. Read `blueprint_phase_validation_authoring_context` before rendering so ready
   verification, mandatory summary evidence, existing UAT state, allowed values,
   and routing rules are explicit.
3. Treat `contract.authoringTemplate`, `requiredHeadings`, `lockedMarkers`, and
   `freehandPolicy` as schema authority.
4. Preserve all locked markers exactly, including `**Status:**`,
   `**Resume State:**`, and `**Checkpoint:**`.
5. Treat `**Checkpoint:**` as the current in-artifact checkpoint label or
   `none`, not as a separate checkpoint file path.
6. Fill every required section with concrete evidence. Do not leave scaffold
   placeholders or omit the richer current-test, test-matrix, result-summary,
   or structured-gap sections.
7. Keep saved summary paths or filenames in `## UAT Summary`,
   `## Session State`, or `## Observed Behavior`.
8. Keep the current test or completion state in the saved artifact so the run
   survives context reset.
9. Include a test matrix with name, expected behavior, evidence, result, and
   notes for every generated test.
10. Include result counts for total, passed, issues, pending, skipped, and
   blocked.
11. Include structured gaps with truth, status, reason, severity, test number,
   artifacts, missing work, and follow-up status when issues are found.
12. Persist user-reported issues, blocked prerequisites, and structured gaps as
    UAT evidence without an extra confirmation gate. Keep follow-up-fix entries
    explicit enough for the parent command to ask for confirmation before
    persisting or acting on them.
13. Call `blueprint_phase_validation_render` with the structured UAT payload and
    treat `readyToWrite: true` as the pre-write self-check.
14. Call `blueprint_phase_validation_write` only with exactly one of the
    returned `content` or the same structured `model`; do not hand-build the
    final markdown body.

## Capability-Gated Subagent Path

Use `blueprint-verifier` only when the host provides that suitable
code/workflow-analysis agent and `workflow.verifier=true`.

Pass the verifier:

- resolved phase number, name, and phase directory
- summary index metadata and every completed summary body
- current verification artifact and readiness state
- existing UAT artifact when present
- effective config values for verifier and Nyquist gates
- canonical `phase.uat` authoring rules
- requested output shape: `READY`, `GAPS`, or `BLOCKED`, plus a prepared test
  queue, response-classification-ready UAT prompts, saved-evidence-only gap
  hypotheses, pending-state scaffold content, and optional follow-up-fix
  candidates

The verifier must remain read-only. It may recommend explicit follow-up capture
or a later implemented repair command, but it must not mutate implementation
files or write Blueprint state. It must not invent observed user behavior,
completed result counts, or a final acceptance-ready UAT draft before the
parent has collected user responses.

Do not substitute browser, web-search-only, shell-only, or generic agents for
`blueprint-verifier`. If the suitable verifier is unavailable, use the fallback
below.

## No-Subagent Fallback

When a suitable verifier is unavailable or disabled, perform the same UAT
preparation sequentially in the parent command:

1. Read one completed summary at a time.
2. Extract user-observable outcomes, changed surfaces, verification evidence,
   follow-ups, and blockers.
3. Compress each summary into carry-forward test rows before reading the next
   one.
4. Build the final test queue from the compressed rows.
5. Add cold-start smoke coverage when the saved evidence touches startup or
   first-run surfaces.
6. Run the conversational UAT loop one test at a time.
7. Classify responses, update counts, and append structured gaps before moving
   on.
8. Draft the canonical UAT artifact from the final queue, counts, gaps, and
   checkpoint state.

This fallback must preserve the same output quality bar as the subagent path.

## Retry And Repair Behavior

- If `blueprint_phase_validation_render` returns `readyToWrite: false`, report the
  issues, repair the structured UAT payload against the canonical contract, and
  render again before calling the writer.
- If `blueprint_phase_validation_write` returns `status: "invalid"` or
  `written: false` after a ready render, treat that as a race, overwrite, or
  prerequisite failure, repair once through MCP when safe, and stop with the
  issues otherwise.
- Re-read the saved UAT through `blueprint_phase_validation_read` after a
  write and use its typed `validation`, `uatStatus`, `resumeState`,
  `checkpoint`, and `complete` fields as the artifact-scoped truth.
- If the write result or the post-write UAT re-read says the saved UAT artifact
  is invalid, repair it once against the canonical contract before stopping.
- If `blueprint_artifact_validate` reports unrelated repo issues after a write,
  surface them as broader repo-health follow-ups instead of rewriting the UAT
  draft.
- If overwrite confirmation is denied, preserve the existing artifact, report
  any newly discovered UAT findings as unsaved findings, and keep the next safe
  action on `/blu-verify-work <phase>` or `/blu-progress` based on implemented
  availability.
- If all remaining tests are blocked by external prerequisites, persist a
  `PARTIAL` UAT artifact with blocked counts and reasons instead of claiming
  failure.
- Never claim persistence from a tool call unless `written` is `true` or the
  returned `status` explicitly says `reused`.

## Output Quality Criteria

A high-quality UAT artifact:

- names every reviewed saved summary
- includes a concrete user-observable test queue
- shows expected behavior and evidence for each test
- preserves current test, result counts, checkpoint label, and resume state
- distinguishes pass, issue, skipped, blocked, pending, and partial outcomes
- preserves verbatim user issue reports and inferred severity
- separates blocked prerequisites from code gaps
- structures issue gaps for later repair planning or follow-up capture
- states whether verifier and Nyquist gates were active or informational
- keeps next safe action consistent with saved UAT status
- routes only to implemented Blueprint commands

## Completion Criteria

`/blu-verify-work` is complete only when one of these is true:

- Existing UAT is viewed or reused without mutation, state remains synced, and
  the next safe action is reported.
- Existing UAT is resumed or a new UAT is created, final markdown passes the
  canonical contract, `blueprint_phase_validation_write` persists or updates
  it, post-write validation runs, state is synced, and routing matches the
  saved UAT status.
- The user stops mid-pass, a `PARTIAL` checkpointed UAT artifact is persisted,
  and the next safe action stays on `/blu-verify-work <phase>`.
- Missing or invalid prerequisites are reached, no UAT artifact is written, the
  missing prerequisite is named, and the user gets the next implemented recovery
  command.
