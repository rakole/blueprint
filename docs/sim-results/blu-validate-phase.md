# `/blu-validate-phase` Simulation Results

## Scope

Workflow simulated: `/blu-validate-phase`

Simulation focus: realistic `XX-VERIFICATION.md` generation through the real model-only authoring context, narrowed task schema, model validation, canonical render, strict write, artifact validation, and synced state update.

Investigation grounding:
- Command: `commands/blu-validate-phase.toml`
- Skill: `skills/blueprint-phase-validation/SKILL.md`
- Runtime contract: `skills/blueprint-phase-validation/references/validate-phase-runtime-contract.md`
- Optional verifier agent: `agents/blueprint-verifier.md`
- Command spec: `docs/commands/validate-phase.md`
- Contract/model source: `src/mcp/artifact-contracts/index.ts`
- Base model schema: `src/mcp/artifact-contracts/schemas/phase.verification.model.schema.json`
- Task-schema narrowing: `src/mcp/tools/phase-validation-schemas.ts`
- Rendering: `src/mcp/tools/phase-validation-rendering.ts`
- Diagnostics: `src/mcp/tools/phase-validation-diagnostics.ts`
- Authoring context, validate, write: `src/mcp/tools/phase.ts`
- Markdown artifact validation: `src/mcp/tools/artifacts.ts`
- State routing: `src/mcp/tools/state.ts`

Artifacts involved:
- `.blueprint/phases/<phase-slug>/<phase-prefix>-VERIFICATION.md`
- `.blueprint/STATE.md`

`/blu-validate-phase` does not normally create reports, checkpoints, or mutate `ROADMAP.md`; `ROADMAP.md` completion sync belongs to later verification/UAT flow.

## Simulation Summary

Two independent agents ran real simulations against temporary repos using live Blueprint handlers. Both reached a persisted `XX-VERIFICATION.md` within three attempts. The model-only write path worked and correctly protected verification truth, but both simulations found that the most useful constraints are surfaced through low-level schema diagnostics rather than semantic repair guidance.

| Agent | Attempts | Final Result | Main Retry Drivers |
| --- | ---: | --- | --- |
| GPT-5.5 high | 2 | `PASS` verification saved; state routed to `/blu-verify-work 3` | PASS rejects `MANUAL` coverage; no-gap arrays/sentinels; generic diagnostics |
| GPT-5.4 high | 3 | `PASS` verification saved; read as ready for UAT | Missing one completed summary path; wrong next action; AJV const/enum diagnostics |

Both simulations exercised `blueprint_phase_validation_authoring_context`, `blueprint_phase_validation_validate_model`, `blueprint_phase_validation_write`, `blueprint_artifact_validate`, and `blueprint_state_update`.

## Findings

### High: Exact completed-summary coverage is useful, but diagnostics are too low-level

The narrowed task schema requires `evidenceReviewedSummaryPaths` to include every completed summary path. One simulation omitted the second completed summary and correctly failed, but the returned errors were AJV-style `const`, `contains`, and `minItems` diagnostics rather than a semantic message such as `You reviewed 1 of 2 completed summaries; add 04-02-SUMMARY.md`.

Evidence:
- Completed-summary path narrowing: `src/mcp/tools/phase-validation-schemas.ts:60`.
- Model validation entrypoint: `src/mcp/tools/phase.ts:5267`.
- Observed missing-summary attempt used `.blueprint/phases/04-phase-validation/04-01-SUMMARY.md` but omitted `.blueprint/phases/04-phase-validation/04-02-SUMMARY.md`.

Why it matters: this is a valuable validation, not ceremony. The defect is the repair surface. A model can recover, but it must translate schema mechanics into workflow meaning.

### Medium: PASS next-action enforcement is strict but explained in schema terms

For `PASS`, the task schema hard-pins `nextSafeAction` to `/blu-verify-work <phase>`. A simulation using `/blu-progress` correctly failed, but the diagnostic shape was `const` / `enum` / `if-then` rather than `PASS must route to /blu-verify-work 4`.

Evidence:
- PASS next-action narrowing: `src/mcp/tools/phase-validation-schemas.ts:106`.
- State routing later also derives readiness for `/blu-verify-work`: `src/mcp/tools/state.ts`.

Why it matters: routing safety is important, but schema-shaped feedback creates an avoidable retry loop for a model that already knows the phase and gate state.

### Medium: PASS/no-gap authoring guidance asks for more ceremony than the runtime needs

Both simulations touched no-gap handling. The runtime can normalize empty passing arrays for `manualOrDeferredCoverage`, `gapClassification`, `gapsFound`, and `suggestedRepairs`, then render canonical `none` rows/bullets. Literal hand-authored `none` scaffolding is therefore not always necessary.

Evidence:
- Runtime contract mentions normalization for passing empty no-gap arrays: `skills/blueprint-phase-validation/references/validate-phase-runtime-contract.md:112`.
- Renderer defaults: `src/mcp/tools/phase-validation-rendering.ts:347`.
- Required model ledgers: `src/mcp/artifact-contracts/schemas/phase.verification.model.schema.json:8`.

Why it matters: the ledgers are useful for non-pass states, but prompting models to hand-author all literal no-gap sentinel rows in PASS cases adds low-value generation work.

### Medium: PASS repair diagnostics are too generic for common LLM mistakes

One simulation used a plausible manual-review phrase in a PASS model. Validation failed because PASS coverage must be `PASS`, `COVERED`, or normalized `covered`, and no-gap rows must be empty or literal none. The repair text mostly said to revise the model against the narrowed schema.

Evidence:
- PASS coverage narrowing: `src/mcp/tools/phase-validation-schemas.ts:88`.
- Generic AJV diagnostic mapping: `src/mcp/tools/phase-validation-diagnostics.ts:64`.

Why it matters: the most likely authoring mistake is semantically obvious: `MANUAL` is not a passing coverage state. The model should not need to inspect the full schema to discover the valid enum subset.

### Medium: Post-write validation/state sync can mix local success with unrelated lifecycle noise

Successful verification writes can be followed by whole-repo artifact validation warnings or state routes driven by other missing artifacts, such as UI-spec or earlier discovery artifacts. One simulation saw verification saved and valid while broader lifecycle checks still routed elsewhere.

Evidence:
- Command requires post-write artifact validation and synced state update: `commands/blu-validate-phase.toml:28`.
- State lifecycle precedence includes broader phase prerequisites: `src/mcp/tools/state.ts:2179`.
- Runtime contract says only phase-scoped repairable issues should trigger retry: `skills/blueprint-phase-validation/references/validate-phase-runtime-contract.md:165`.

Why it matters: a model may read the final state as validate-phase failure even when `XX-VERIFICATION.md` was written correctly. Local artifact success and broader repo health need clearer separation.

### Low: Minimal examples are helpful but can become rejection bait

The model contract provides minimal examples while residual diagnostics also reject copied example phrases or leakage signals.

Evidence:
- Minimal valid example and model contract: `src/mcp/artifact-contracts/index.ts:3541`.
- Example/leakage residual diagnostics: `src/mcp/tools/phase-validation-diagnostics.ts:163`.

Why it matters: examples are useful, but the returned contract should make it obvious that values are shape-only and should be replaced with repo-specific evidence.

### Low: Writer revalidation duplicates preflight validation

`blueprint_phase_validation_write` re-runs model validation before persistence even after a successful `blueprint_phase_validation_validate_model` call.

Evidence:
- Writer-side revalidation: `src/mcp/tools/phase.ts:7426`.

Why it matters: the duplicate check is reasonable race protection. It is low severity because it did not cause failure, but it adds to the command’s ceremony and can surprise models expecting a validated model to be accepted without a second full validation pass.

## Deduplication Notes

Both agents independently confirmed that the model-only validate-phase path is protective and functional. The repeated friction is not unsafe persistence; it is that workflow-level truths are expressed through schema-level diagnostics.

The report groups duplicate issues into:
- missing completed summaries should produce semantic repair instructions;
- PASS next action should be explained as routing truth, not const/enum failure;
- no-gap PASS cases should lean on empty-array normalization instead of hand-authored sentinel ceremony;
- post-write local verification success should be visibly separated from broader lifecycle health warnings.
