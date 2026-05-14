# `/blu-execute-phase` Simulation Results

## Scope

Workflow simulated: `/blu-execute-phase`

Simulation focus: realistic execution-summary generation through the real authoring context, Markdown validation, strict write path, summary index refresh, artifact validation, and synced state update.

Investigation grounding:
- Command: `commands/blu-execute-phase.toml`
- Skill: `skills/blueprint-phase-execution/SKILL.md`
- Runtime contract: `skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md`
- Long-running profile: `skills/blueprint-phase-execution/references/long-running-execution-profile.md`
- Optional execution agent: `agents/blueprint-executor.md`
- Authoring context, validation, write, and execution target selection: `src/mcp/tools/phase.ts`
- Summary contract/template: `src/mcp/artifact-contracts/index.ts`
- Summary validation helpers: `src/mcp/tools/artifacts.ts`
- State refresh: `src/mcp/tools/state.ts`

Artifacts involved:
- `.blueprint/phases/<phase-slug>/<phase-prefix>-<plan-id>-SUMMARY.md`
- `.blueprint/STATE.md`

No command-owned checkpoint or report artifact is in the required `/blu-execute-phase` persistence path.

## Simulation Summary

Two independent agents ran real save simulations against temporary repos using live Blueprint handlers. Both reached a persisted summary within three attempts. The write path correctly blocked untruthful `COMPLETED` summaries and protected dependency truth, but both simulations found avoidable authoring friction around invalid scaffold text, exact sentinel formatting, and non-specific repair guidance.

| Agent | Attempts | Final Result | Main Retry Drivers |
| --- | ---: | --- | --- |
| GPT-5.5 high | 3 | Concrete `COMPLETED` summary saved and indexed as complete | Invalid template status, placeholder scaffold blockers, flat write diagnostics |
| GPT-5.4 high | 3 | Truthful `PARTIAL` summary saved; state stayed on execute-phase | Incomplete dependency summary, status truth-table repairs, warning-only sentinel formatting |

Both simulations exercised the real handler path, including `blueprint_phase_execution_targets`, `blueprint_phase_summary_authoring_context`, `blueprint_phase_summary_validate_model`, `blueprint_phase_summary_write`, `blueprint_artifact_validate`, `blueprint_state_load`, and `blueprint_state_update`.

## Findings

### High: Canonical summary template is not a saveable first draft

One simulation used the contract-shaped authoring template as the first draft and hit hard validation failures. The template includes placeholder values such as `**Status:** COMPLETED|PARTIAL|BLOCKED` and placeholder prose that is later rejected as scaffold text.

Evidence:
- Template/scaffold authority: `src/mcp/artifact-contracts/index.ts:1366` and `src/mcp/artifact-contracts/index.ts:4374`.
- Placeholder/scaffold rejection path: `src/mcp/tools/artifacts.ts:8152`.
- Runtime contract tells the workflow to use the `phase.summary` authoring template as authority: `skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md:85`.

Why it matters: a model following the command contract can produce an invalid first attempt by copying the official scaffold too literally. That creates retries before the workflow reaches actual execution evidence.

### High: Warning-only sentinel formatting can create low-value retry loops

A semantically correct `COMPLETED` summary that used natural language rows such as `No dependencies` and `No deferred work` still validated, but returned multiple warnings solely for exact sentinel table formatting like `none | none | none`.

Evidence:
- Warning-only lifecycle/sentinel checks: `src/mcp/tools/artifacts.ts:7902`.
- Expected dependency sentinel is documented by the summary contract and surfaced through `blueprint_phase_summary_authoring_context`.

Why it matters: the command contract asks the model to validate and repair before persistence. Warning-only formatting advice can therefore consume retries even when the summary is already truthful and machine-usable.

### Medium: Dependency truth gate is useful, but the repair hint is indirect

One simulation tried to save plan `02` as `COMPLETED` while dependency plan `01` had no completed summary. Validation correctly failed with `depends on incomplete execution plan(s): 01`, but the higher-level repair guidance framed the issue as generic untruthful completion rather than plainly saying to use `PARTIAL` or `BLOCKED` until the dependency summary exists.

Evidence:
- Dependency/live-plan gate: `src/mcp/tools/phase.ts:3848`.
- Semantic completion blocker: `src/mcp/tools/artifacts.ts:8062`.
- Observed diagnostic: `linked plan ... depends on incomplete execution plan(s): 01`.

Why it matters: this is a legitimate blocker, not ceremony. The friction is that the second-attempt repair requires the model to infer the correct lifecycle downgrade and related marker changes.

### Medium: Invalid write diagnostics are weaker than preflight validation diagnostics

The preflight validator returned structured diagnostics, but a direct invalid `blueprint_phase_summary_write` probe returned flatter `issues` and `warnings` without the same structured repair context.

Evidence:
- Preflight validation diagnostic assembly: `src/mcp/tools/phase.ts:8736`.
- Write invalid-response path: `src/mcp/tools/phase.ts:9474`.

Why it matters: if a workflow skips or misorders preflight validation, the write failure is harder to repair. A real model may need an extra contract-read loop to recover.

### Medium: `validate_model` naming is misleading for a Markdown-first summary workflow

The workflow validates Markdown through `blueprint_phase_summary_validate_model`, while `blueprint_phase_summary_authoring_context` returns `taskSchema: null`, `schemaPath: null`, and `modelOnly: false`.

Evidence:
- Authoring context: `src/mcp/tools/phase.ts:8452`.
- Validator entrypoint: `src/mcp/tools/phase.ts:8589`.
- Markdown-first behavior is covered by `tests/execute-phase-summary-tools.test.ts`.

Why it matters: the implementation is correctly Markdown-first, but the tool name can make the flow feel schema/model-driven and obscure the expected input shape.

### Medium: Post-write repo-wide warnings can muddy summary completion

After successful summary writes, post-write `blueprint_artifact_validate` and `blueprint_state_update(base: "synced")` surfaced unrelated repo-wide warnings, such as UI-spec rationale or quality-gate debt.

Evidence:
- Command requires post-write validation and state refresh: `commands/blu-execute-phase.toml:21`.
- Synced state refresh path: `src/mcp/tools/state.ts:2947`.

Why it matters: these checks are useful for routing, but mixing local summary success with ambient repo health warnings can make a model keep repairing the wrong artifact.

### Low: Lifecycle truth-table repairs arrive in several warning steps

Changing only `Status` from `COMPLETED` to `PARTIAL` made one invalid draft technically valid, but produced warnings requiring matching changes to `Readiness`, `Completion State`, `Next Safe Action`, verification result, gap row, and follow-up.

Evidence:
- Observed warnings included:
  - `Summary artifact status PARTIAL should use Readiness not-ready-for-validation`
  - `...should include at least one non-pass Verification result`
  - `...should include at least one OPEN or BLOCKED gap row`

Why it matters: the truth table is valuable, but bundled lifecycle repair advice would make the second attempt cleaner.

## Deduplication Notes

Both agents independently reached the same central pattern: the summary persistence path is protective and does not appear to lose data, but the authoring experience is more expensive than necessary. The repeated issues were:
- official scaffold content that fails if treated as a draft;
- warning-only exact formatting checks that can drive unnecessary repair loops;
- repair messages that require inference rather than naming the next valid lifecycle state;
- post-write feedback that blends summary status with unrelated repo health.

The simulations did not find a source-code mutation bug or an unsafe overwrite path. Invalid writes were rejected, valid writes persisted, and state routing remained aligned with pending-summary truth.
