# Phase 3: Core Lifecycle Audit - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

## Phase Boundary

Discovery-only audit of Blueprint's core phase lifecycle: phase discovery, context and research artifacts, UI-spec handling, plan authoring, execution summaries, validation, UAT/verify-work, add-tests, checkpoint behavior, and state transitions. Outputs are evidence-backed bug reports in `docs/bugs/*.md`; no source, manifest, skill, test, generated asset, runtime, installed extension, or host-global state fixes are applied in this phase.

## Implementation Decisions

### Lifecycle Slice Order
- **D-01:** Phase 3 should audit in **command-flow order**: `/blu-discuss-phase`, `/blu-research-phase`, `/blu-ui-phase`, `/blu-plan-phase`, `/blu-execute-phase`, `/blu-validate-phase`, `/blu-verify-work`, and `/blu-add-tests`.
- **D-02:** Each command-flow slice should still trace through the relevant docs, command manifest, primary skill, runtime-contract reference, MCP tools, schemas, generated assets if relevant, and regression tests before concluding.
- **D-03:** Planning should split the lifecycle into small enough audit slices that each can independently record examined surfaces, deferred surfaces, and any `docs/bugs/*.md` findings.

### Probe Depth
- **D-04:** Default evidence approach is **static contract review plus targeted existing test runs**.
- **D-05:** Auditors should inspect docs/manifests/skills/MCP code and run focused lifecycle test suites where they directly support or disprove a finding.
- **D-06:** Temporary runtime probes are allowed only when static evidence and existing tests cannot resolve a material lifecycle ambiguity. Probes should use disposable temp repositories or clearly bounded `.planning/` bookkeeping, and any created temporary files must be removed before phase closeout.
- **D-07:** Full end-to-end dry runs are not the default; use them only when needed to verify a high-impact state-transition or artifact-flow concern.

### Defect Threshold
- **D-08:** File a real bug when drift or behavior creates **user-impact or lifecycle-state risk**, including command misrouting, lost/skipped evidence, corrupted lifecycle state, hidden blockers, invalid next-safe-action guidance, or misleading downstream agents.
- **D-09:** Material docs/runtime drift that misleads users or maintainers should be documented as a bug even if the current runtime happens to fail safe.
- **D-10:** Low-impact wording drift or harmless implementation differences should be noted in phase summaries rather than inflated into bug reports.
- **D-11:** Keep Phase 2's confidence standard: prefer `confirmed` or `likely` findings with concrete evidence; avoid `suspected` unless impact is high and uncertainty is explicitly stated.

### Boundary Handling
- **D-12:** Phase 3 uses **strict but practical** discovery-only boundaries: no source/runtime fixes and no mutation of installed extension directories or host-global `~/.gemini/blueprint/` state.
- **D-13:** Probes may create temporary files only in disposable temp directories or bounded planning bookkeeping when needed; cleanup must be verified and documented.
- **D-14:** Lifecycle checkpoint behavior is in scope for audit, but the audit must not hand-edit `.blueprint/` lifecycle artifacts as a repair. Any checkpoint or state defect is documented for later repair.
- **D-15:** Phase closeout must check `git status --short` and confirm intentional changes are limited to `.planning/` and `docs/bugs/`.

### the agent's Discretion
- The planner may decide the exact number of Phase 3 plans and which command-flow slices are grouped together, as long as the grouping preserves command-flow order and keeps each slice independently auditable.
- The researcher/planner may choose the focused test commands per slice from the existing lifecycle-related suites, favoring targeted tests over broad test runs unless broad runs are needed to resolve a finding.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Guardrails
- `.planning/PROJECT.md` — discovery-only milestone contract, Blueprint-not-GSD boundary, and output target under `docs/bugs/*.md`.
- `.planning/REQUIREMENTS.md` — evidence, classification, workflow coverage, and no-fix requirements, especially `COV-02` and `NFIX-*`.
- `.planning/ROADMAP.md` — Phase 3 goal, suggested surfaces, dependencies, and success criteria.
- `.planning/STATE.md` — current milestone state and active guardrails.
- `.planning/phases/01-bug-taxonomy-and-reporting-harness/01-CONTEXT.md` — bug-reporting harness, evidence standard, and discovery-only decisions carried forward.
- `.planning/phases/02-bootstrap-router-config-audit/02-CONTEXT.md` — tests-first evidence preference, confidence threshold, and implemented-only routing decisions carried forward.

### Lifecycle Contracts
- `docs/PHASE-LIFECYCLE.md` — intended lifecycle sequence, checkpoint ownership, summaries, validation, UAT, and completion signals.
- `docs/ARTIFACT-SCHEMA.md` — `.blueprint/` artifact shape, structured model schema assets, and project/phase state boundaries.
- `docs/MCP-TOOLS.md` — authoritative MCP tool surface and model-facing call contracts for phase, artifact, validation, and report tools.
- `docs/RUNTIME-REFERENCE.md` — runtime behavior reference for implemented commands and known deltas.
- `docs/COMMAND-CATALOG.md` — declared command status and implemented-only exposure baseline.

### Command Specs And Manifests
- `docs/commands/discuss-phase.md` and `commands/blu-discuss-phase.toml` — context/discussion command contract.
- `docs/commands/research-phase.md` and `commands/blu-research-phase.toml` — research artifact contract.
- `docs/commands/ui-phase.md` and `commands/blu-ui-phase.toml` — UI-spec contract and skip behavior.
- `docs/commands/plan-phase.md` and `commands/blu-plan-phase.toml` — plan authoring and validation contract.
- `docs/commands/execute-phase.md` and `commands/blu-execute-phase.toml` — execution target and summary contract.
- `docs/commands/validate-phase.md` and `commands/blu-validate-phase.toml` — verification contract.
- `docs/commands/verify-work.md` and `commands/blu-verify-work.toml` — UAT contract.
- `docs/commands/add-tests.md` and `commands/blu-add-tests.toml` — add-tests/report/update-verification contract.

### Skills And Runtime References
- `skills/blueprint-phase-discovery/SKILL.md` — discovery command orchestration for discuss/research/UI.
- `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` — discuss-phase runtime behavior.
- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md` — research-phase runtime behavior.
- `skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md` — UI-phase runtime behavior.
- `skills/blueprint-phase-planning/SKILL.md` — plan-phase orchestration.
- `skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md` — plan-phase runtime behavior.
- `skills/blueprint-phase-execution/SKILL.md` — execute-phase orchestration.
- `skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md` — execute-phase runtime behavior.
- `skills/blueprint-phase-validation/SKILL.md` — validate/verify/add-tests orchestration.
- `skills/blueprint-phase-validation/references/validate-phase-runtime-contract.md` — validate-phase runtime behavior.
- `skills/blueprint-phase-validation/references/verify-work-runtime-contract.md` — verify-work runtime behavior.
- `skills/blueprint-phase-validation/references/add-tests-runtime-contract.md` — add-tests runtime behavior.

### Runtime Truth Sources
- `src/mcp/tools/phase.ts` — phase locate/context/artifact, plan, summary, validation, and checkpoint tool handlers.
- `src/mcp/tools/artifacts.ts` — artifact contracts, validation, scaffold/report helpers, and path-safe persistence.
- `src/mcp/tools/state.ts` — state load/update/sync behavior and next-action state transitions.
- `src/mcp/artifact-contracts/index.ts` — canonical artifact contracts and rendering/scaffold templates.
- `src/mcp/artifact-contracts/schemas/phase.plan.model.schema.json` — base plan model schema.
- `src/mcp/artifact-contracts/schemas/phase.summary.model.schema.json` — base summary model schema.
- `src/mcp/artifact-contracts/schemas/phase.verification.model.schema.json` — base verification model schema.
- `src/mcp/artifact-contracts/schemas/phase.uat.model.schema.json` — base UAT model schema.
- `src/mcp/artifact-contracts/schemas/report.add-tests.model.schema.json` — base add-tests report schema.

### Regression Tests As Evidence Leads
- `tests/phase-discovery-discuss.test.ts`
- `tests/phase-discovery-research.test.ts`
- `tests/phase-discovery-ui.test.ts`
- `tests/phase-discovery-tools.test.ts`
- `tests/phase-planning-tools.test.ts`
- `tests/phase-plan-validation-hardening.test.ts`
- `tests/phase-plan-write-locking.test.ts`
- `tests/execute-phase-summary-tools.test.ts`
- `tests/phase-validation-slice.test.ts`
- `tests/validate-phase-tools.test.ts`
- `tests/verify-work-roadmap-sync.test.ts`
- `tests/add-tests-slice.test.ts`
- `tests/add-tests-metadata.test.ts`
- `tests/plan-phase-metadata.test.ts`
- `tests/execute-phase-metadata.test.ts`
- `tests/validate-phase-metadata.test.ts`
- `tests/verify-work-metadata.test.ts`

## Existing Code Insights

### Reusable Assets
- `src/mcp/tools/phase.ts` already centralizes most lifecycle state: locating phases, reading/writing discovery artifacts, plan indexing/validation/writes, summary indexing/writes, validation/UAT authoring/rendering/writes, and shared checkpoint get/put/delete.
- `src/mcp/tools/artifacts.ts` provides artifact contract read/list/validate/scaffold/report helpers that lifecycle commands rely on for schema-first authoring and report-backed outputs.
- `src/mcp/tools/state.ts` owns durable `STATE.md` transitions and next-action state, which makes it a key integration point for lifecycle completion and recovery bugs.
- Existing lifecycle tests are already split across discovery, planning, execution summaries, validation, UAT, add-tests, and metadata-contract suites, so Phase 3 can use targeted test runs rather than inventing new probes first.

### Established Patterns
- Commands are thin TOML prompt contracts; skills orchestrate; MCP tools own persistence and validation.
- Phase artifacts should be written through MCP-owned phase/artifact/review/report tools, not by prompt-only filesystem mutation.
- Plan, summary, verification, UAT, and add-tests paths are increasingly schema-first/model-first; Markdown fallback is intentionally rejected for several runtime flows.
- Checkpoint ownership matters: discuss and research may share `XX-DISCUSS-CHECKPOINT.json` with owner metadata, while UAT checkpoint/resume state belongs inside `XX-UAT.md`.

### Integration Points
- Phase 3 should trace each command from `docs/commands/*.md` and `commands/blu-*.toml` into the relevant skill runtime-contract reference, MCP tool definitions, artifact schemas, and targeted tests.
- Bugs that affect next-safe-action routing should cite both lifecycle docs and the actual state/phase tool behavior.
- Discovery-only closeout should update the bug index slice row and planning summaries, not source/runtime behavior.

## Specific Ideas

Start the audit from the user-visible lifecycle path, then trace inward for each command. Favor existing tests as objective evidence, but allow tightly scoped temp-repo probes when a lifecycle ambiguity cannot be resolved from static evidence and tests.

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 3-Core Lifecycle Audit*
*Context gathered: 2026-05-01*
