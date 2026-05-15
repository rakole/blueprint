# `/blu-plan-phase` Simulation Results

## Scope

Workflow simulated: `/blu-plan-phase`

Simulation focus: realistic structured `phase.plan` model generation through the real authoring context, model validation, strict write, final plan-set validation, overwrite/reuse behavior, readiness gating, and synced state update.

Investigation grounding:
- Command: `commands/blu-plan-phase.toml`
- Skill: `skills/blueprint-phase-planning/SKILL.md`
- Runtime contract: `skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md`
- Optional agents: `agents/blueprint-planner.md`, `agents/blueprint-checker.md`
- Authoring context, model validation, write, and plan-set validation: `src/mcp/tools/phase.ts`
- Schema narrowing: `src/mcp/tools/phase-plan-schemas.ts`
- Diagnostics: `src/mcp/tools/phase-plan-diagnostics.ts`
- Rendering: `src/mcp/tools/phase-plan-rendering.ts`
- Base schema: `src/mcp/artifact-contracts/schemas/phase.plan.model.schema.json`

Artifacts involved:
- `.blueprint/phases/<phase-slug>/<phase-prefix>-<plan-id>-PLAN.md`
- `.blueprint/STATE.md`

No command-owned plan-phase checkpoint artifact is in the required MCP tool set.

## Simulation Summary

Three independent agents ran real simulations against temporary repos using live Blueprint handlers. All reached a persisted plan within three attempts. The write path correctly rejected invalid models, protected existing plan content without explicit overwrite, reused unchanged content, and auto-assigned new plan slots when `planId` was omitted.

| Agent | Attempts | Final Result | Main Retry Drivers |
| --- | ---: | --- | --- |
| GPT-5.5 high | 3 | Plan updated with overwrite, plan set valid, state routed to execute | Identity fields, missing evidence, uncovered roadmap requirement, overwrite gate |
| GPT-5.4 high | 3 | Plan created, reused on identical retry; final validation still invalid for uncovered requirement | Exact coverage diagnostics, write/final validation split |
| GPT-5.2 high | 3 | Plan created, reused on identical retry, state synced | Readiness block, exact coverage diagnostics, unverifiable acceptance criterion |

Focused checks reported by agents passed for plan tooling, including `tests/phase-planning-tools.test.ts` and `tests/phase-plan-validation-hardening.test.ts`.

## Findings

### High: Strict write and final plan-set validation disagree on roadmap coverage (FIXME:)

Two simulations saved a plan successfully while `blueprint_phase_plan_validate` immediately reported the saved plan set as invalid because not all roadmap requirements were covered.

Observed behavior:
- `blueprint_phase_plan_write` returned `status: "created"` with warning: `Phase 3 plan set does not cover roadmap requirements: LIFE-02.`
- `blueprint_phase_plan_validate` then returned `status: "invalid"` for the same uncovered requirement.

Evidence:
- Write-time prospective validation warning path: `src/mcp/tools/phase.ts:8083`.
- Final plan-set validation treats the same issue as invalid around `src/mcp/tools/phase.ts:3621`.
- Plan validation path referenced by simulations around `src/mcp/tools/phase.ts:7734`.

Why it matters: the command contract says to run final scoped validation after write. A model can see “write succeeded” and “plan set invalid” in the same run, and state may still advance if the orchestrator is not careful about the final validation result.

### High: Exact-coverage diagnostics are noisy and partly misleading (FIXME: agree to reduce unecessary noise)

When a model omitted one required requirement or evidence artifact row, diagnostics included the useful `schema.exactCoverage` message, but also `schema.const` diagnostics that suggested replacing existing valid rows with the missing value.

Evidence:
- Runtime exact coverage schema construction: `src/mcp/tools/phase-plan-schemas.ts:63` and `src/mcp/tools/phase-plan-schemas.ts:78`.
- Exact object property helper: `src/mcp/tools/phase-task-schema-helpers.ts:31`.
- Diagnostic shaping for schema errors: `src/mcp/tools/phase-plan-diagnostics.ts:182` and `src/mcp/tools/phase-plan-diagnostics.ts:251`.

Why it matters: the correct repair is usually “add one missing row,” but the extra `const` diagnostics can nudge a model to replace existing rows and create a new coverage gap.

### High: Acceptance-criterion verifier misses underscore-separated tool names (FIXME:)

One simulation used a natural criterion such as `blueprint_phase_plan_validate_model returns status valid`. It failed with `coverage.unverifiable_acceptance_criterion` because the verifier did not treat underscore-separated tool names as containing `validate`.

Evidence:
- Verifiability helper: `src/mcp/tools/phase.ts:4246`.
- Residual diagnostic code: `coverage.unverifiable_acceptance_criterion`.

Why it matters: Blueprint tool names are underscore-separated. Criteria naming the actual tool can still be rejected unless the model also includes a concrete backticked command, grep, file-read, or test phrasing.

### High: Planning readiness depends on upstream research substance heuristics

One simulation was blocked before planning because `planningReadiness.readyForPlanPhase` was false. The blocker came from research validation:

```text
Research artifact section Sources must contain substantive content after placeholders are removed.
```

Evidence:
- Research substance checks: `src/mcp/tools/artifacts.ts:3588` and `src/mcp/tools/artifacts.ts:3630`.
- Planning readiness builder: `src/mcp/tools/phase.ts:3129`.

Why it matters: this is correct in the command boundary, but it means `/blu-plan-phase` can be blocked by upstream research artifact heuristics that may themselves be ceremonial or wording-sensitive.

### Medium: Plan write, final validation, and state routing are easy to mis-sequence

One simulation observed a valid plan write and then synced state routing to `/blu-execute-phase 3`, even though the standalone plan-set validation still reported uncovered requirements. This appears orchestrator-sensitive: the command contract requires final validation before completion, but lower-level tools expose separate success surfaces.

Evidence:
- Write returns success with warnings near `src/mcp/tools/phase.ts:8083`.
- State sync path: `src/mcp/tools/state.ts:2901`.

Why it matters: an LLM must interpret multiple results together: model validation, write result, final plan-set validation, and state load. Treating write success alone as completion is unsafe.

### Medium: Lower-level authoring tools do not enforce the planning-readiness gate (FIXME:)

The command contract requires stopping when `phase_research_status.planningReadiness.readyForPlanPhase=false`, but `blueprint_phase_plan_authoring_context` itself primarily blocks on missing roadmap requirements. Command correctness depends on the orchestrator remembering to call and honor the readiness gate first.

Evidence:
- Command readiness instruction: `commands/blu-plan-phase.toml:23`.
- Authoring context path: `src/mcp/tools/phase.ts:7768`.
- Authoring-context blockers: `src/mcp/tools/phase.ts:4209`.

Why it matters: simulation agents could still get an authoring schema and write path even when the command should route back to research/UI/discuss first.

### Medium: Saved plans becoming required evidence makes accidental auto-add costly (FIXME:)

After saving plan `01`, omitting `planId` caused the next authoring context to target plan `02`. The task schema then required the saved `03-01-PLAN.md` as evidence. This is coherent for additive planning, but confusing when the model intended to revise plan `01`.

Evidence:
- Known evidence artifact collection: `src/mcp/tools/phase.ts:4259`.
- Authoring context updates after saved plan files: `src/mcp/tools/phase.ts:4291`.

Why it matters: a model trying to repair or revise an existing plan must explicitly target `planId: "01"`. Otherwise the schema shifts under it and reports missing evidence for the previous plan.

### Medium: Schema errors can mask semantic repair feedback (FIXME:)

One invalid model also had vague acceptance criteria and placeholder-like values, but residual semantic checks did not appear until schema validity was repaired.

Evidence:
- Deeper residual checks run after schema validation around `src/mcp/tools/phase.ts:4774`.

Why it matters: this can create a whack-a-mole repair loop: first schema issues, then semantic issues, then prospective plan-set issues.

### Low: Synced state update emits off-topic milestone-closeout warnings

After plan save, `blueprint_state_update({ base: "synced" })` emitted a warning about no valid execution summaries, which is true but off-topic during plan authoring.

Evidence:
- State sync path: `src/mcp/tools/state.ts:2901`.

Why it matters: the warning can distract from plan completion and validation results.

### Low: Structured plan model is heavy for small plans

A valid one-task plan still needed many top-level fields plus requirement, evidence, file-surface, verification, and unknowns ledgers.

Evidence:
- Required model fields begin in `src/mcp/artifact-contracts/schemas/phase.plan.model.schema.json:8`.

Why it matters: the structure improves downstream execution safety, but some fields feel ceremonial for tiny changes and increase generation cost.

### Low: Good overwrite and reuse behavior

Simulations confirmed useful safety properties:
- existing changed plan content rejects without explicit overwrite;
- unchanged content returns `status: "reused"`;
- omitting `planId` auto-assigns a next available slot.

Evidence:
- Existing-content protection and reuse path: `src/mcp/tools/phase.ts:7863`, `src/mcp/tools/phase.ts:8118`, and `src/mcp/tools/phase.ts:8144`.

Why it matters: this behavior reduces accidental overwrites. The main issue is making sure the command-layer prompt keeps the `planId`/overwrite decision explicit.

## Deduplication Notes

The repeated high-signal issue across agents was not a raw persistence bug; it was multi-surface interpretation cost. `validate_model`, `phase_plan_write`, `phase_plan_validate`, and `state_update` can all return different degrees of success or warning. The final report groups duplicate findings into:
- write success versus plan-set invalidity;
- noisy exact-coverage diagnostics;
- schema/semantic validation staging;
- dynamic authoring context after saved plans;
- readiness gates living outside the lower-level authoring context.
