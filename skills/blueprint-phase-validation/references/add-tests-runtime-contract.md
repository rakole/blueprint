# Add Tests Runtime Contract

This reference is the local runtime contract for `/blu-add-tests`. It translates
the retained GSD test-generation behavior into Blueprint-native orchestration:
MCP owns deterministic Blueprint state, the command stays user-facing, the skill
owns workflow policy, repo mutation is limited to selected tests, and optional
agents perform bounded implementation or verification work when suitable agents
are available.

## Stage Mapping

| Stage | Purpose | Required Control Signal |
|-------|---------|-------------------------|
| Resolve | Identify the target phase and whether it is testable. | `blueprint_phase_locate.found`, `phaseNumber`, `phaseDir`, and recovery `reason`. |
| Read | Gather completed execution evidence, validation or UAT evidence, existing artifacts, and current state. | Summary index, every completed summary body, verification read, UAT read, artifact inventory, artifact health, and state load results. |
| Decide | Classify candidate files and choose the narrowest safe test scope. | Testability classification, discovered test conventions, user-approved scope, missing evidence, and next safe action. |
| Execute | Generate or update tests and run the narrowest meaningful check. | Parent-approved test plan, changed test files, targeted test command, pass/fail/blocker status, and bug-versus-test-error classification. |
| Persist | Save updated verification notes and the durable add-tests report through MCP. | `phase.verification` authoring template, `report.add-tests` authoring template, self-check results, and write responses. |
| Validate | Re-validate saved Blueprint artifacts and repair if needed. | `blueprint_artifact_validate.valid`, write statuses, issues, warnings, and suggested repairs. |
| Route | Update state and report the next implemented action. | `blueprint_state_update`, saved verification/report status, remaining gaps, and implemented follow-up availability. |

## Required MCP Calls

Call these tools through runtime FQNs from the manifest. Their return values are
the authority for control flow.

| Tool | Controls |
|------|----------|
| `blueprint_phase_locate` | Target phase resolution, unresolved-phase recovery, and phase-scoped state boundaries. |
| `blueprint_phase_summary_index` | Whether completed execution summaries exist and which summaries must be read. |
| `blueprint_phase_summary_read` | Source implementation evidence for every completed summary; never generate tests from chat memory alone. |
| `blueprint_phase_validation_read` with `artifact: "verification"` | Existing validation baseline, saved gaps, and verification note update baseline. |
| `blueprint_phase_validation_read` with `artifact: "uat"` | User-observable evidence, UAT gaps, and additional scenario source. |
| `blueprint_artifact_contract_read` with `artifactId: "phase.verification"` | Canonical heading, marker, and authoring-template authority for the verification update. |
| `blueprint_artifact_contract_read` with `artifactId: "report.add-tests"` | Canonical heading and authoring-template authority for the durable add-tests report. |
| `blueprint_artifact_list` | Existing phase and report inventory, including whether review evidence already exists. |
| `blueprint_artifact_validate` | Preflight artifact health and post-write validation status. |
| `blueprint_artifact_report_write` | The only allowed persistence path for `.blueprint/reports/add-tests-<phase>.md`. |
| `blueprint_state_load` | Current safe action, blockers, and state routing before changes. |
| `blueprint_state_update` with `base: "synced"` | Final state sync and next-action derivation. |

## Input State Model

- Missing phase: stop without writing and report the locate `reason`.
- Missing completed summaries: stop without writing and route to
  `/blu-execute-phase <phase>`.
- Missing both verification and UAT evidence: stop without writing and route to
  `/blu-validate-phase <phase>`; do not generate tests from chat memory.
- Existing verification or UAT evidence plus completed summaries: proceed to a
  testability classification and scope decision.
- Existing add-tests report: read artifact inventory, then require an explicit
  overwrite path before replacing it; otherwise preserve the existing report and
  return the next safe action.

## Classification And Scope Decision

Build a classification table before editing. Read each candidate file, nearby
tests, and relevant runner configuration directly; do not classify by filename
alone.

| Category | Use When | Expected Test Shape |
|----------|----------|---------------------|
| `Unit / TDD` | Pure functions, validators, parsers, transformations, state transitions, command argument logic, or deterministic utilities. | Targeted unit tests with explicit arrange/act/assert expectations. |
| `Integration / API` | Behavior crosses modules, command routing, MCP tool contracts, filesystem state, config loading, or non-browser process behavior. | Focused integration or tool-contract tests using existing repo harnesses. |
| `E2E / UI` | User-observable browser, CLI, navigation, form, keyboard, or workflow behavior is the acceptance surface. | Existing E2E or browser/CLI tests, with startup prerequisites stated. |
| `Skip` | Layout-only styling, generated declarations, wiring without behavior, already-covered unchanged paths, migrations, or untestable external prerequisites. | No new test; record the reason and any manual or deferred coverage. |

Before writing tests:

1. Extract candidate changed surfaces from saved summaries and validation or UAT
   gaps.
2. Discover existing test structure, naming conventions, and test commands from
   repo files.
3. Prefer extending nearby tests over duplicating coverage in a second suite.
4. Present the classification and narrow default scope through `ask_user` when
   the choice is broad, ambiguous, or would create more than a focused pass.
5. Present a concrete test plan with target test paths, cases or scenarios,
   expected assertions, and the narrow command to run.
6. If the user adjusts classification or plan scope, update the table and
   re-present the changed plan before writing.

## Execution Rules

- Keep repo mutation limited to approved test files plus minimal supporting test
  helpers.
- Do not fix implementation bugs discovered by tests during this command; record
  them as bugs or blockers.
- Repair test authoring errors caused by new tests, then re-run the targeted
  command once.
- Never mark a test as passing unless a targeted command or explicit inspection
  supports it.
- If E2E or integration prerequisites are missing, mark the test `blocked` and
  capture the missing prerequisite instead of claiming success.
- Prefer the narrowest meaningful command. Ask before widening to a broader
  package script or suite-wide run.

## Artifact Authoring Rules

1. Read `phase.verification` before drafting updated verification notes.
2. Read `report.add-tests` before drafting the durable report.
3. Treat each returned `contract.authoringTemplate`, `requiredHeadings`,
   `lockedMarkers`, and `freehandPolicy` as heading and schema authority.
4. Preserve existing verification content as the baseline and append or update
   explicit test-coverage notes instead of casually replacing it.
5. The verification update must cite saved summaries, validation or UAT evidence,
   targeted test commands, test result status, and remaining gaps.
6. The add-tests report must include the approved scope, classification table,
   test plan, tests added or updated, commands run, generated/passing/failing/
   blocked counts, bugs or blockers discovered, verification write status,
   report write status, remaining gaps, and next safe action.
7. Self-check both drafts against their returned contracts before writing.

## Capability-Gated Subagent Path

Use subagents only when the host provides suitable Blueprint agents and the work
is large enough to benefit from bounded delegation.

Use `blueprint-executor` for non-trivial test implementation when the approved
scope spans multiple files, multiple suites, or a harness adaptation. Pass it:

- resolved phase number, name, and phase directory
- completed summary bodies plus verification or UAT evidence
- the user-approved classification and test plan
- explicit write ownership for test paths or helper paths
- existing test conventions and the narrow command to run
- required output: changed files, targeted command results, failed/blocked
  tests, bugs discovered, and report-ready notes

Use `blueprint-verifier` after implementation when coverage confidence matters.
Pass it:

- saved execution and validation evidence
- approved test plan and changed test files
- targeted command output
- draft verification update and draft add-tests report
- required output: `READY`, `GAPS`, or `BLOCKED`, with evidence-backed coverage
  rows and remaining gaps

Do not substitute browser, web-search-only, shell-only, or generic agents for
these Blueprint code/workflow-analysis roles.

## No-Subagent Fallback

When suitable subagents are unavailable or unnecessary, perform the same work
sequentially in the parent command:

1. Read one completed summary at a time.
2. Extract changed surfaces, behavior claims, test commands, and validation or
   UAT gaps.
3. Compress each summary into carry-forward classification rows before reading
   the next one.
4. Inspect nearby repo files and existing tests for one candidate area at a
   time.
5. Build and confirm the classification table.
6. Build and confirm the test plan.
7. Implement one approved test file or scenario group at a time.
8. Run the narrow command, classify the outcome, and compress the result into
   report-ready rows before moving on.
9. Draft the verification update and add-tests report from the final rows.

This fallback must preserve the same output quality bar as the subagent path.

## Retry And Repair Behavior

- If `blueprint_phase_validation_write` returns `status: "invalid"` or
  `written: false` because validation failed, report the issues, repair the
  verification draft against the canonical contract, and retry once.
- If `blueprint_artifact_report_write` returns `status: "invalid"` or
  `written: false` because validation failed, repair the report draft against
  the `report.add-tests` authoring template and retry once.
- If post-write `blueprint_artifact_validate` reports validation failures, use
  `suggestedRepairs` to revise the phase-scoped verification or report content
  and retry once when the repair does not require external state.
- If targeted test execution fails because the generated test exposed an
  implementation bug, preserve the report with `failing` status and route to an
  implemented follow-up instead of fixing product code.
- If targeted test execution is blocked by missing infrastructure, preserve the
  report with `blocked` status and name the prerequisite.
- Never claim persistence from a tool call unless `written` is `true` or the
  returned `status` explicitly says `reused`.

## Output Quality Criteria

A high-quality add-tests run:

- names every saved summary and validation or UAT artifact used
- shows file-by-file classification with reasons and skipped-scope rationale
- records the approved test plan before mutation
- identifies existing test conventions and the exact target command
- distinguishes tests generated, passing, failing, and blocked
- separates implementation bugs from test authoring errors
- cites changed test files and helper files
- updates verification notes from the canonical verification contract
- writes an add-tests report from the canonical report contract
- reports verification and report write statuses from MCP returns
- routes only to implemented Blueprint commands

## Completion Criteria

`/blu-add-tests` is complete only when one of these is true:

- Missing prerequisites are reached: no tests or Blueprint artifacts are written,
  the missing evidence is named, and the next implemented recovery command is
  reported.
- Test generation completes: selected tests are added or updated, the narrowest
  meaningful command runs or a blocker is recorded, verification notes are
  written or explicitly reused, the add-tests report is written, post-write
  validation runs, state is synced, and routing matches the saved status.
- Test generation is blocked after planning: no partial success is claimed, a
  report captures the blocker when report persistence is possible, and the next
  implemented recovery action is reported.
