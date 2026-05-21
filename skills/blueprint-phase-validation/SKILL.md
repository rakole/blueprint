---
name: blueprint-phase-validation
description: >
  Verification, UAT, tests, and gap closure for Blueprint lifecycle work. Use
  this skill to validate summary-backed execution evidence, run resumable UAT,
  and keep follow-up fixes explicit and MCP-owned.
status: implemented
commands:
  - /blu-validate-phase
  - /blu-verify-work
  - /blu-add-tests
input_bundles:
  shared: []
  commands:
    "/blu-validate-phase":
      - skills/blueprint-phase-validation/references/validate-phase-runtime-contract.md
    "/blu-verify-work":
      - skills/blueprint-phase-validation/references/verify-work-runtime-contract.md
    "/blu-add-tests":
      - skills/blueprint-phase-validation/references/add-tests-runtime-contract.md
---

# Blueprint Phase Validation Skill

## Purpose

Orchestrate Blueprint's post-execution validation, conversational UAT, and evidence-backed test-generation flow so completed phase summaries are audited, durable validation artifacts are persisted through MCP, and follow-up routing stays inside the implemented Blueprint surface.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Before optional delegation, read effective config with `mcp_blueprint_blueprint_config_get`. Call same-named Gemini CLI agent tools only when the current command contract explicitly allows them, `workflow.subagents` is not `false`, the same-named tool is available in the current host session, and the task benefits from bounded verifier or executor work. Do not read, inline, or load separate agent source before delegation; otherwise use the command's no-subagent fallback and state the fallback reason.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.

## Parity Goal

Carry forward the useful validation intent while preserving Blueprint deltas:

- execution summaries remain the source of truth for what was actually delivered
- validation and UAT stay host-native and MCP-owned instead of script-owned
- conversational UAT is resumable through `XX-UAT.md`
- test generation stays grounded in saved summaries plus validation or UAT evidence
- follow-up fixes stay explicit instead of hidden in prompt-only prose
- persistent writes remain phase-scoped inside `.blueprint/`
- follow-up routing stays inside the implemented Blueprint surface

## Shared Visibility Contract

- Execution profile for `validate-phase`, `verify-work`, and the long-running parts of `add-tests`: `long-running-mutation`
- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- For `add-tests`, keep the selected test scope, targeted test command or result, verification status, report status, and next safe action explicit while bounded repo mutation is in flight.
- For structured interactive choices, confirmations, validation feedback, per-test UAT prompts, review/skip/stop branching, or short clarifications, prefer  `ask_user` tool over plain assistant prose.
- When a validation-family run is non-trivial, keep those status fields visible with `update_topic`, `write_todos`, or an honest prose fallback rather than inventing persistence outside MCP.
- Keep validation saved-summary-first: the `Execute` stage is bounded verifier analysis grounded in saved summaries and existing validation artifacts, not direct repo mutation or prompt-memory reconstruction. For `add-tests`, bounded repo mutation stays grounded in saved summaries plus validation evidence, and the resulting verification plus report status must come from MCP returns.

## Required Inputs

Runtime input resolution is structured and command-scoped:

- Load only the active command's `input_bundles.commands[...]` inputs plus `input_bundles.shared` for that invocation. The shared validation bundle is intentionally empty.
- Do not preload sibling validation runtime contracts by default.
- For normal runtime execution, treat the active local runtime contract as the only skill-authored input bundle file.
- Treat structured runtime truth as owned by the command runtime metadata/catalog, the `blueprint://commands/{command}/runtime-contract` resource, MCP tool results, and artifact contracts read through MCP.
- Treat saved phase summaries, verification artifacts, UAT artifacts, report authoring context, and state as MCP-resolved data, not preloaded prompt files.

## Required MCP Tools

- `blueprint_phase_locate`
- `blueprint_phase_summary_index`
- `blueprint_phase_summary_read`
- `blueprint_phase_validation_read`
- `blueprint_phase_validation_authoring_context`
- `blueprint_phase_validation_render`
- `blueprint_phase_validation_validate_model`
- `blueprint_phase_validation_write`
- `blueprint_artifact_contract_read`
- `blueprint_artifact_list`
- `blueprint_config_get`
- `blueprint_artifact_validate`
- `blueprint_artifact_report_authoring_context`
- `blueprint_artifact_report_validate_model`
- `blueprint_artifact_report_write`
- `blueprint_state_load`
- `blueprint_state_update`

## Optional Agents

- `blueprint-verifier`
- `blueprint-executor`

## Shared MCP Contracts

- `blueprint_phase_locate`: pass only a numeric phase reference when the command provides one, or omit `phase` for state or roadmap inference. Never pass phase directories or filenames.
- `blueprint_phase_validation_authoring_context`: read this before authoring validation artifacts so canonical contracts, mandatory valid summary citations, compact saved-summary evidence, existing baselines, prerequisite blockers, allowed values, routing rules, and any schema-first `taskSchema` are explicit. On hosts that expose only MCP text, the response text mirrors the full structured result as compact JSON.
- `blueprint_phase_validation_render`: compatibility render path for structured `verification` or `uat` evidence payloads. Use schema-first model validation for validate-phase and verify-work command persistence.
- `blueprint_phase_validation_validate_model`: for `phase.verification` and `phase.uat`, validate the structured model against the narrowed task schema and use the returned diagnostics plus `renderPreview` before persistence. Treat every diagnostic in the tool response as repair input. For `phase.verification`, treat `context.summaryPaths` and `context.summaryEvidence` from the authoring context as the only valid execution evidence set; do not cite or infer from summaries that are absent there.
- `blueprint_phase_validation_write`: pass numeric `phase`, artifact enum `verification` or `uat`, and exactly one of full artifact `content` or a structured `model`. For `/blu-validate-phase` and `/blu-verify-work`, pass the same validated structured model with `authoringMode: "model-only"` and do not use Markdown fallback. Both validation modes require saved summaries, and `uat` also requires an existing verification artifact. Model writes reject model-owned identity keys, copied contract examples, missing required ledgers, unsupported fields, and invalid field types before rendering. Use returned `path`, `summaryPaths`, `written`, and `status` as authoritative. Only describe the artifact as persisted when `written` is `true`; report `reused` or `invalid` outcomes explicitly.
- `blueprint_artifact_contract_read`: read canonical validation metadata and optional `modelContract` metadata by contract id such as `phase.verification`, `phase.uat`, or `report.add-tests` instead of relying on copied prompt-local templates. Markdown-authored contracts may expose `authoringTemplate`; model-only public reads such as `phase.verification`, `phase.uat`, and `report.add-tests` expose `modelContract` without a public `authoringTemplate`. On hosts that expose only MCP text, the response text mirrors the full structured result as compact JSON.
- `blueprint_artifact_report_authoring_context`: for `report.add-tests`, read this before authoring so the base schema, runtime task schema, completed summaries, pending plans, dependency plans, validation/UAT evidence paths, and allowed next actions are explicit.
- `blueprint_artifact_report_validate_model`: for `report.add-tests`, validate the structured model against the narrowed task schema and use the returned diagnostics plus `renderPreview` before persistence.
- `blueprint_artifact_report_write`: pass a bare report name such as `add-tests-3`, not `.blueprint/reports/add-tests-3.md`. For `report.add-tests`, pass the same validated structured `model`; Markdown content fallback is not supported. Use the returned `path` as authoritative.
- `blueprint_artifact_validate`: run after every validation or UAT write so the persisted artifact is checked before the next state update is written.

## Canonical Validation Contracts

- For `XX-VERIFICATION.md`, use `blueprint_phase_validation_authoring_context`, `blueprint_artifact_contract_read` with `artifactId: "phase.verification"`, then `blueprint_phase_validation_validate_model` before `/blu-validate-phase` persistence. Treat `contract.modelContract` plus the returned `taskSchema` as the authoring authority, and use `renderPreview` as the canonical preview instead of a public `contract.authoringTemplate`. Persist the same structured `model` with `authoringMode: "model-only"` for validate-phase, never Markdown fallback. The `phase.verification` model is schema version `1.1.0`: keep `status` equal to `gateState`, use `COVERED` or `PASS` for completed coverage rows, preserve validation session state/checkpoint/test matrix/result summary/observed behavior/unresolved gaps/structured gaps/follow-up fixes when present, and let MCP normalize scalar `validationSummary`, lowercase `covered`, and passing empty no-gap arrays. Cite every path from `context.summaryPaths` under `## Evidence Reviewed`, keep prompt-boundary or protocol-style marker text out of the artifact, and use the canonical `none` or `NONE` sentinel rows only when the contract truly has no gaps to report.
- For `XX-UAT.md`, use `blueprint_phase_validation_authoring_context`, `blueprint_artifact_contract_read` with `artifactId: "phase.uat"`, then `blueprint_phase_validation_validate_model` before persistence. Treat `contract.modelContract` plus the returned `taskSchema` as the authoring authority, and use `renderPreview` as the canonical preview instead of a public `contract.authoringTemplate`. Persist the same structured `model` with `authoringMode: "model-only"`, never Markdown fallback.
- For `.blueprint/reports/add-tests-<phase>.md`, use `blueprint_artifact_contract_read` with `artifactId: "report.add-tests"`, then `blueprint_artifact_report_authoring_context` and `blueprint_artifact_report_validate_model`. Treat `contract.modelContract` plus the returned `taskSchema` as the authoring authority, and use `renderPreview` as the canonical preview instead of a public `contract.authoringTemplate`.
- Keep each contract's locked markers and required section names unchanged.
- Keep summary references in the contract-defined evidence sections.
- Allow extra top-level headings only when the contract policy says they are supported.

## Workflow Rules

### `validate-phase`

1. Load `references/validate-phase-runtime-contract.md` and treat it as the canonical detailed contract for stage mapping, State A/B/C handling, verifier use, the no-subagent fallback, retry behavior, and output quality.
2. Keep validation saved-summary-first, phase-scoped, and MCP-owned: execution summaries are the baseline, existing `XX-VERIFICATION.md` is the audit baseline when present, and direct repo mutation is out of scope.
3. Respect `workflow.verifier` and `workflow.nyquist_validation` from normalized effective config when deciding whether verifier analysis runs and whether Nyquist-style gap language is active or informational.
4. Read `blueprint_phase_validation_authoring_context` and `blueprint_artifact_contract_read` with `artifactId: "phase.verification"` before final authoring, build a structured verification evidence payload against the returned `taskSchema`, call `blueprint_phase_validation_validate_model`, keep every completed summary filename or path in the contract-defined evidence section, and persist only through `blueprint_phase_validation_write` with the `verification` artifact when validation returns `status: "valid"`, passing the same structured `model` with `authoringMode: "model-only"`.
5. Apply this routing shorthand before the final verification model validation and write:
   `if gateState == PASS and no unresolved gaps or repair signals remain -> nextSafeAction = /blu-verify-work <phase>`
   `else if explicit deferred-test or test-generation gaps remain -> nextSafeAction = /blu-add-tests <phase>`
   `else if implementation or behavior gaps remain -> nextSafeAction = /blu-audit-fix <phase>`
   `else -> keep nextSafeAction on /blu-validate-phase <phase> only for validation-document repair or manual-only prerequisites`
6. Run post-write `blueprint_artifact_validate` only after a successful write or reuse outcome, then sync `STATE.md` through `blueprint_state_update` with `base: "synced"` plus `patch.activeCommand: "/blu-validate-phase"`. Route explicit test-generation gaps to `/blu-add-tests <phase>` and implementation/behavior gaps to `/blu-audit-fix <phase>` only when the saved artifact keeps the gate `PARTIAL` or `BLOCKED` and makes that follow-up necessary.

### `verify-work`

1. Resolve the target phase and require both execution summaries and a `XX-VERIFICATION.md` artifact that is valid and ready for UAT before UAT begins. If the verification is valid but not ready, follow its saved implemented repair route such as `/blu-audit-fix <phase>` or `/blu-add-tests <phase>` before UAT.
2. Read summary index, completed valid summary artifacts, and any existing validation or UAT artifact so conversational UAT is grounded in saved execution evidence.
3. Keep the active stage visible as the run moves through `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`, and keep the resolved scope, pending gate, execution mode, and next safe action legible throughout the run.
4. Inspect any existing `XX-UAT.md` before proposing replacement. Use the typed `blueprint_phase_validation_read` result as the truth for whether the saved UAT is valid, complete, resumable, or needs explicit replacement; default to resume or reuse only when the saved artifact is valid and incomplete.
5. Respect `workflow.verifier` and `workflow.nyquist_validation` from normalized effective config when describing the UAT pass and any remaining acceptance gaps.
6. Load `references/verify-work-runtime-contract.md` and follow it for UAT test queue construction, response classification, artifact authoring, verifier use, no-subagent fallback, retry behavior, and output quality.
7. Build a concrete user-observable test queue from saved summaries and ready verification evidence before asking the user anything. Include expected behavior, saved evidence, current result, and notes for each test. Prepend a cold-start smoke test when saved summary evidence touches startup, server or CLI entrypoints, database, seed, migration, Docker, or first-run surfaces.
8. Present one expected behavior at a time, using `ask_user` for the per-test result when the host supports interactive questioning. Treat an empty or cancelled answer as no answer, restate the current test once, and ask again instead of recording a pass. Classify non-empty user responses as `pass`, `skipped`, `blocked`, or `issue`; infer issue severity from the user's words; preserve verbatim issue text; keep blocked prerequisites separate from code gaps; and append structured gap rows for issues.
9. Call the same-named `blueprint-verifier` Gemini agent tool with a bounded UAT-prep task packet only for summary-grounded UAT preparation when the runtime contract permits it, `workflow.verifier=true`, `workflow.subagents` is not `false`, and the tool is available: test rows, expected behaviors, evidence notes, response-ready prompts, saved-evidence-only gap hypotheses, and optional follow-up fix notes. The parent command, not the verifier, owns observed behavior, live result counts, and the final UAT artifact after user responses are collected.
10. When the verifier tool is unavailable or disabled, use the no-subagent fallback from the runtime contract: read one completed summary at a time, compress carry-forward test rows, build the queue, run one UAT prompt at a time, classify responses, and draft from the final queue, counts, gaps, and checkpoint state.
11. Never substitute browser, web-search-only, shell-only, or generic agents for codebase or workflow UAT analysis.
12. Keep non-trivial conversational UAT sequential and checkpointed: after each major evidence block or question group, surface progress and ask the user whether to `review`, `skip`, or `stop` before continuing.
13. `review` means summarize the current checkpoint, observed behavior, result counts, and unresolved gaps before proceeding. `skip` means keep the skipped area explicit in the resumable UAT body and move to the next bounded step. `stop` means persist the current checkpoint and leave the next safe action on `/blu-verify-work <phase>` unless a missing prerequisite routes elsewhere.
14. Build the final UAT draft as a structured `phase.uat` evidence payload grounded in the returned `modelContract` and `taskSchema`, and call `blueprint_phase_validation_validate_model` before calling `blueprint_phase_validation_write`. Keep summary filenames or paths inside the contract-defined summary-aware sections, keep all required section names unchanged, keep the contract-owned `**Resume State:**` and `**Checkpoint:**` markers current, keep checkpoint state inside `XX-UAT.md` rather than a separate checkpoint file, and include current test state, test matrix, result counts, structured gaps, blocked prerequisites, and follow-up fix candidates.
15. Treat the model validation result as the contract self-check; persist finished UAT evidence through `blueprint_phase_validation_write` with the `uat` artifact only when `status: "valid"`, passing the same structured `model` with `authoringMode: "model-only"`. Use the returned `summaryPaths` plus `written` or `status` to report whether the evidence was newly saved, preserved unchanged, or rejected as invalid.
16. Re-read the saved UAT through `blueprint_phase_validation_read` after persistence and use its typed `validation`, `uatStatus`, `resumeState`, `checkpoint`, and `complete` fields as the artifact-scoped truth. Repair the draft and retry once only when the write result or the post-write UAT re-read says the saved UAT is invalid. Treat unrelated `blueprint_artifact_validate` failures as broader repo-health follow-ups instead of rewriting the UAT draft.
17. Keep user-reported issues and structured gaps in the same artifact as first-class UAT evidence. Keep follow-up fixes explicit in the same artifact or in a clearly signposted state update, and confirm any follow-up-fix capture before persisting it.
18. Run `blueprint_artifact_validate` after the write and before `STATE.md` is updated.
19. Update `STATE.md` with the UAT result and the next safe implemented action.

### `add-tests`

1. Resolve the target phase and require saved execution summaries before generating or updating tests.
2. Read summary artifacts plus any existing `XX-VERIFICATION.md` or `XX-UAT.md`, then read `blueprint_artifact_report_authoring_context` for `add-tests-<phase>` before mutation so test generation is grounded in saved implementation evidence plus valid current validation or UAT evidence.
3. Require `blueprint_artifact_report_authoring_context.status: "ready"` and a non-empty `validationEvidencePaths` inventory before proceeding. Route to `/blu-validate-phase` when the report authoring context is invalid, validation evidence is missing, or only stale/malformed validation files exist.
4. Load `references/add-tests-runtime-contract.md` and follow it for stage mapping, classification gates, test-plan approval, RED/GREEN-style execution behavior, artifact authoring, same-named agent-tool use, no-subagent fallback, retry behavior, and output quality.
5. Keep repo mutation narrow: honor explicit user scope first, otherwise derive a focused test scope from completed summaries, saved gaps, and existing repo test conventions.
6. Build a file-by-file classification table before writing. Read each candidate file and classify it as `Unit / TDD`, `Integration / API`, `E2E / UI`, or `Skip` with concrete reasons; do not classify from filename alone.
7. Discover existing test structure, naming conventions, nearby coverage, and narrow test commands before presenting the test plan. Stop instead of inventing a framework when no convention is discoverable.
8. Use `ask_user` for structured classification, scope, test-plan, or breadth decisions instead of burying those gates in prose. Re-present adjusted classifications or plans before mutation.
9. Keep the active stage visible as the run moves through `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`, and keep the resolved scope, selected test scope, classification status, test-plan status, pending gate, execution mode, targeted test command or result, verification status, report status, and next safe action legible throughout the run.
10. Treat broad test-scope confirmation, classification approval, test-plan approval, any broader-suite request, unclear repo test conventions, and verification or report persistence outcomes as explicit pending gates rather than post-hoc notes.
11. For non-trivial add-tests runs, prefer update_topic plus `write_todos` so evidence review, classification, scope confirmation, bounded implementation, targeted test execution, verification-note persistence, report persistence, post-write validation, and routing stay visible without becoming persistence.
12. Call the same-named `blueprint-executor` Gemini agent tool with a bounded implementation task packet for multi-file test implementation only when the harness or write scope is non-trivial and write ownership is explicit.
13. Call the same-named `blueprint-verifier` Gemini agent tool with a bounded coverage-review task packet to review whether the generated tests cover the saved execution behavior and any explicit validation or UAT gaps.
14. When suitable agent tools are unavailable or unnecessary, use the no-subagent fallback from the runtime contract: process one summary and candidate area at a time, compress carry-forward classification and execution rows, then draft from the final table.
15. Never substitute browser, web-search-only, shell-only, or generic agents for Blueprint code/workflow analysis agent tools.
16. Read `blueprint_phase_validation_authoring_context` and `blueprint_artifact_contract_read` for `phase.verification`, build a structured verification evidence payload, call `blueprint_phase_validation_render`, and persist verification notes only when `readyToWrite: true`.
17. Read `blueprint_artifact_contract_read` for `report.add-tests`, then read `blueprint_artifact_report_authoring_context`, author a structured `report.add-tests` model against the returned `taskSchema`, validate it with `blueprint_artifact_report_validate_model`, and include approved classification, selected scope, test plan, tests added or updated, generated/passing/failing/blocked counts, bugs or blockers discovered, verification status, report status, remaining gaps, and next safe action.
18. Persist updated verification notes through `blueprint_phase_validation_write` with the `verification` artifact and preserve the existing artifact as the baseline when it already exists. Keep the reported verification status aligned with the tool-owned `written` and `status` result.
19. Persist the durable non-phase report through `blueprint_artifact_report_write` using the same validated model and bare canonical `add-tests-<phase>` report naming pattern, not Markdown content and not a `.blueprint/reports/...` path. Keep the reported report status aligned with the tool-owned `written` and `status` result.
20. If validation, report model validation, or report writes are rejected, repair the model against the canonical contract and retry once before stopping with explicit issues and suggested repairs.
21. Update `STATE.md` with the test-generation result and the next safe implemented action. Prefer `/blu-code-review <phase>` when review evidence is still missing, otherwise fall back to `/blu-progress`.

## Non-Negotiables

- All persistent writes must go through MCP tools only.
- Do not mutate arbitrary repo files from validation commands.
- Do not invent or switch test frameworks when the repo has no clear test convention.
- Do not present planned-only lifecycle commands as runnable just because they are documented.

## Completion Self-Check

Before claiming completion, verify:

- The active command's runtime contract (`validate-phase`, `verify-work`, or `add-tests`) was loaded from this skill's command-scoped bundle, and sibling validation contracts were not treated as active input.
- Required Blueprint MCP calls used runtime FQNs and followed the active contract's order: resolve phase, read summary/validation/report/state evidence, load canonical contracts and authoring context, validate or render the structured payload, persist only from a ready result, then post-write validate/read and sync state.
- Persistence went only through the owning MCP tools: `blueprint_phase_validation_write` for `verification` or `uat`, `blueprint_artifact_report_write` for `add-tests`, and `blueprint_state_update` for `STATE.md`; returned `status`, `written`, `created`, `updated`, `path`, `summaryPaths`, validation diagnostics, and reasons drove the final claim.
- Required gates were satisfied before action: overwrite or replacement for existing verification, UAT, or add-tests report; UAT view/resume/update and review/skip/stop choices; add-tests scope/classification/test-plan/broader-suite decisions; and any follow-up-fix capture.
- Invalid model checks, non-ready renders, writer rejections, failed post-write validation, blocked prerequisites, and skipped or stopped UAT were repaired once as the active contract allows or reported as blocked, partial, or no-write instead of success.
- The run stayed within write boundaries: validation/UAT touched only the selected phase artifacts plus `STATE.md` (and `ROADMAP.md` only when verify-work completion evidence requires it); add-tests repo edits stayed inside the approved test scope or minimal helpers while Blueprint writes stayed in the selected phase, `.blueprint/reports/`, and `STATE.md`; no runtime files, installed extension directories, hidden state, direct `.blueprint/` writes, or planned-only surfaces changed.
- Final routing used only implemented Blueprint commands authorized by saved artifacts and the active contract; when the safe next action was ambiguous or not implemented, routing fell back to `/blu-progress`.
- The final response named the MCP-returned artifact paths or no-write status, reported the targeted test command and result for `add-tests`, included warnings, blockers, or unsaved findings, and stated the next safe implemented action.
