# Phase 5: Review Quality Impact Shipping Audit - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

## Phase Boundary

Discovery-only audit of Blueprint's review, remediation, docs-update, impact, review-branch, shipping, and undo surfaces. Outputs are evidence-backed bug reports in `docs/bugs/*.md`; no source, manifest, skill, test, build, generated asset, runtime `.blueprint/`, installed-extension, host-global, remote-service, branch, PR, or git-history fixes are applied in this phase.

Phase 5 should audit the shipped command surfaces listed in the roadmap: `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `review`, `ui-review`, `docs-update`, `impact`, `pr-branch`, `ship`, and `undo`. The discussion selected all four gray areas: review artifact quality, impact analysis depth, remediation/docs mutation safety, and high-risk git workflow safety.

## Implementation Decisions

### Review Artifact Quality
- **D-01:** Phase 5 uses a schema-plus-evidence standard for review artifacts. File a bug when a review artifact can pass structural/model validation but still creates audit risk through generic evidence, missing coverage, stale saved evidence, out-of-scope citations, weak finding rationale, or unsafe next-action routing.
- **D-02:** The audit should treat `blueprint_review_authoring_context`, `blueprint_review_validate_model`, and `blueprint_review_record` as the core evidence path, then cross-check command specs, manifests, skill/runtime contracts, saved artifact expectations, and focused slice tests.
- **D-03:** Review findings should cite concrete files, schema/model constraints, rendered artifact output, tests, or runtime contract mismatches. Avoid filing style-only review-output complaints unless they materially mislead users or downstream agents.

### Impact Analysis Depth
- **D-04:** Phase 5 should audit the full `/blu-impact` contract, not just happy-path report writing. Scope includes config merge/provenance, scope resolution, context loading, surface classification, ownership coverage, dependency coverage, generated/source mixed-scope signals, report validation/write, output rendering, and command-substrate exposure checks.
- **D-05:** Scaling and graceful degradation are in scope for `/blu-impact`. The audit should look for concrete evidence that large repos, large diffs, large lockfiles, bounded import scans, missing ownership metadata, or partial dependency graphs produce misleading confidence, poor warnings, unacceptable runtime cost, or brittle report validation.
- **D-06:** Performance/scaling findings still need evidence. Prefer existing `impact` fixtures/tests and code-path inspection first; use disposable probes only if static review and targeted tests cannot resolve a material ambiguity.

### Remediation And Docs Mutation Safety
- **D-07:** For `code-review-fix`, `audit-fix`, and `docs-update`, Phase 5 should audit both mutation safety and durable evidence. File bugs for missing preflight scope, weak confirmation gates, broad or unexpected source/docs writes, report-after-mutate behavior when the contract requires reviewable evidence first, poor verification, missing traceability, or unsafe state/follow-up routing.
- **D-08:** Remediation/docs-update flows may be inspected, but this milestone must not perform real source fixes. Any runtime probe that would mutate repo code or docs must use a disposable copy or dry-run path and must be cleaned up before phase closeout.
- **D-09:** Reports and state updates for remediation/docs flows should remain MCP-owned and evidence-backed. Markdown fallback, unstructured traceability, or prompt-only persistence is a Phase 5 defect when it violates the locked runtime contract or creates repair-planning risk.

### High-Risk Git Workflow Safety
- **D-10:** `pr-branch`, `ship`, and `undo` should use a pre-mutation report/preview gate posture. File bugs for dirty-tree gaps, stale evidence, weak confirmation, missing manual fallback, missing report-before-mutate behavior, unsafe implemented-command routing, or mutation plans that cannot be reviewed before branch/remote/history effects.
- **D-11:** High-risk git audits should avoid live remote mutation and avoid destructive local history probes in the main worktree. Prefer static contract review, targeted metadata tests, and disposable local repositories when behavior must be verified.
- **D-12:** `undo` should be judged against safe revert-style behavior, explicit preflight blockers, visible confirmation state, and report persistence before mutation. `ship` should be judged against local prep, optional push/PR creation, failure/manual fallback, and state routing. `pr-branch` should be judged against clean source branch protection, exact include/exclude previews, and source-branch preservation.

### Carried-Forward Audit Standards
- **D-13:** Preserve the Phase 2 through Phase 4 evidence bar: prefer confirmed or likely findings with concrete file, command, test, schema, or contract evidence; avoid weak suspected reports unless impact is high and uncertainty is explicit.
- **D-14:** Default evidence approach remains static contract review plus targeted existing tests. Disposable runtime probes are allowed only when they resolve a material ambiguity and must be isolated and cleaned up.
- **D-15:** This phase is discovery-only. Audit findings may create or update planning docs and `docs/bugs/*.md`; they must not repair source/runtime behavior, command manifests, skills, tests, generated assets, `.blueprint/` runtime state, installed extension directories, host-global state, remote services, branches, PRs, or git history.

### the agent's Discretion
- The researcher and planner may choose the exact Phase 5 plan slicing, but should make the four discussed areas explicit in the plan set: review artifact quality, impact analysis depth/scaling, remediation/docs mutation safety, and high-risk git safety.
- The planner may group low-risk review artifact commands together when they share the same `src/mcp/tools/review.ts` substrate, but should keep `impact` and high-risk git workflows distinct enough that scaling and mutation gates do not get diluted.
- The planner may choose focused test commands per slice from the existing test suite, favoring targeted metadata/slice/tool tests over broad test runs unless broad runs are needed to resolve a finding.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Guardrails
- `.planning/PROJECT.md` - discovery-only milestone contract, Blueprint-not-GSD boundary, and output target under `docs/bugs/*.md`.
- `.planning/REQUIREMENTS.md` - evidence, classification, workflow coverage, and no-fix requirements, especially `COV-04` and `NFIX-*`.
- `.planning/ROADMAP.md` - Phase 5 goal, suggested surfaces, dependencies, and success criteria.
- `.planning/STATE.md` - current milestone state and active guardrails.
- `.planning/phases/01-bug-taxonomy-and-reporting-harness/01-CONTEXT.md` - bug-reporting harness, evidence standard, and discovery-only decisions carried forward.
- `.planning/phases/02-bootstrap-router-config-audit/02-CONTEXT.md` - tests-first evidence preference, confidence threshold, implemented-only routing, and material drift standards carried forward.
- `.planning/phases/03-core-lifecycle-audit/03-CONTEXT.md` - command-flow audit order, targeted-test posture, lifecycle-state defect threshold, and no-fix boundary decisions carried forward.
- `.planning/phases/04-roadmap-capture-lightweight-audit/04-CONTEXT.md` - preview parity, high-risk confirmation, partial-failure, state-routing, and no-fix decisions carried forward.

### Phase 5 Command Specs And Manifests
- `docs/commands/code-review.md` and `commands/blu-code-review.toml` - code-review scope, artifact, and schema-first authoring contract.
- `docs/commands/code-review-fix.md` and `commands/blu-code-review-fix.toml` - selected finding remediation, evidence, and review-fix artifact contract.
- `docs/commands/audit-fix.md` and `commands/blu-audit-fix.toml` - audit-driven remediation, classification, report, and state-routing contract.
- `docs/commands/secure-phase.md` and `commands/blu-secure-phase.toml` - saved threat evidence, security review artifact, and open-threat routing contract.
- `docs/commands/review.md` and `commands/blu-review.toml` - peer-review packet, reviewer coverage, and disagreement preservation contract.
- `docs/commands/ui-review.md` and `commands/blu-ui-review.toml` - UI audit evidence, scoring, visual-evidence limitation, and artifact contract.
- `docs/commands/docs-update.md` and `commands/blu-docs-update.toml` - scoped repo-doc refresh, verification, and docs-update report contract.
- `docs/commands/impact.md` and `commands/blu-impact.toml` - impact scope, analysis, report bundle, and output rendering contract.
- `docs/commands/pr-branch.md` and `commands/blu-pr-branch.toml` - review-branch preview, filtered replay, report, and branch safety contract.
- `docs/commands/ship.md` and `commands/blu-ship.toml` - shipping report, optional push/PR behavior, manual fallback, and state-routing contract.
- `docs/commands/undo.md` and `commands/blu-undo.toml` - revert-style undo, preflight blockers, report-before-mutate, and state-routing contract.

### Skills And Runtime References
- `skills/blueprint-review/SKILL.md` - shared review, review-fix, audit-fix, secure-phase, peer-review, and UI-review orchestration.
- `skills/blueprint-review/references/code-review-runtime-contract.md` - code-review runtime behavior and model-only review artifact expectations.
- `skills/blueprint-review/references/code-review-fix-runtime-contract.md` - review-fix target selection, bounded mutation, validation, and artifact contract.
- `skills/blueprint-review/references/audit-fix-runtime-contract.md` - audit-fix classification, mutation gate, report, and follow-up contract.
- `skills/blueprint-review/references/secure-phase-runtime-contract.md` - threat verification and security artifact contract.
- `skills/blueprint-review/references/review-runtime-contract.md` - peer-review packet and reviewer coverage contract.
- `skills/blueprint-review/references/ui-review-runtime-contract.md` - UI-review scoring, evidence, and artifact contract.
- `skills/blueprint-impact/SKILL.md` - `/blu-impact` orchestration and report-bundle behavior.
- `skills/blueprint-impact/references/impact-runtime-contract.md` - impact config, scope, context, analysis, report write, and output render contract.
- `skills/blueprint-docs/SKILL.md` - docs-update orchestration, evidence, and report behavior.
- `skills/blueprint-maintenance/SKILL.md` - shared high-risk maintenance orchestration for branch/shipping/undo-style flows.
- `skills/blueprint-maintenance/references/pr-branch-runtime-contract.md` - review-branch filtering, preview, report, and source-branch safety contract.

### Runtime Truth Sources
- `docs/COMMAND-CATALOG.md` - declared implemented command status baseline for Phase 5 commands.
- `docs/MCP-TOOLS.md` - authoritative MCP tool surface and model-facing call contracts for review, impact, artifact, state, and report tools.
- `docs/RUNTIME-REFERENCE.md` - runtime behavior reference for implemented review, impact, docs-update, pr-branch, ship, and undo commands.
- `docs/ARTIFACT-SCHEMA.md` - `.blueprint/` artifact shape, review/report schemas, and state boundaries.
- `src/mcp/tools/review.ts` - review scope, authoring context, model validation, artifact rendering, findings loading, and record behavior.
- `src/mcp/tools/impact.ts` - impact config, scope resolution, context loading, analysis, report writing, output rendering, dependency/ownership/scaling behavior.
- `src/mcp/tools/artifacts.ts` - report authoring/validation/write helpers for audit-fix, docs-update, ship, undo, pr-branch, and other report-backed flows.
- `src/mcp/tools/workspace.ts` - maintenance/patch/workspace helpers relevant to high-risk mutation patterns and host-global boundaries.
- `src/mcp/tools/state.ts` - durable `STATE.md` transitions, review next-safe-action reading, and implemented-command routing checks.
- `src/mcp/server.ts` - MCP tool registration and mutation-failure logging wrappers.

### Regression Tests As Evidence Leads
- `tests/code-review-metadata.test.ts`
- `tests/code-review-slice.test.ts`
- `tests/code-review-fix-metadata.test.ts`
- `tests/code-review-fix-slice.test.ts`
- `tests/audit-fix-metadata.test.ts`
- `tests/audit-fix-slice.test.ts`
- `tests/secure-phase-metadata.test.ts`
- `tests/secure-phase-slice.test.ts`
- `tests/review-metadata.test.ts`
- `tests/review-slice.test.ts`
- `tests/ui-review-metadata.test.ts`
- `tests/ui-review-slice.test.ts`
- `tests/docs-update-metadata.test.ts`
- `tests/review-docs-safety-regression.test.ts`
- `tests/impact-metadata.test.ts`
- `tests/impact-tools.test.ts`
- `tests/impact-fixtures.test.ts`
- `tests/pr-branch-metadata.test.ts`
- `tests/ship-metadata.test.ts`
- `tests/undo-metadata.test.ts`

## Existing Code Insights

### Reusable Assets
- `src/mcp/tools/review.ts` centralizes review scope, authoring context, model validation, review artifact rendering, saved findings loading, and record behavior for code-review, peer-review, review-fix, security, and UI-review artifacts.
- `src/mcp/tools/impact.ts` centralizes `/blu-impact` config, scope resolution, context loading, surface classification, ownership/dependency analysis, normalized report validation, report-bundle writing, and output rendering.
- `src/mcp/tools/artifacts.ts` provides report authoring, validation, and write helpers used by report-backed remediation, docs, shipping, and maintenance flows.
- `src/mcp/tools/state.ts` reads saved review next-safe-action values and filters them through implemented-command availability.
- Existing metadata, slice, fixture, and tool tests provide targeted evidence leads for Phase 5 without starting from broad end-to-end probes.

### Established Patterns
- Commands are thin TOML prompt contracts; skills orchestrate; MCP tools own deterministic persistence, validation, and state transitions.
- Review and report artifacts are increasingly model-only/schema-first; Markdown fallback is intentionally rejected in key review flows.
- High-risk mutations should make resolved scope, active stage, pending gate, execution mode, preview/report evidence, and next safe action visible before mutation.
- Discovery phases update planning artifacts and bug docs only; source/runtime defects are documented for later repair.

### Integration Points
- Phase 5 should trace each command from `docs/commands/*.md` and `commands/blu-*.toml` into the relevant skill/runtime reference, MCP tool handlers, artifact schemas, runtime reference rows, and focused tests.
- Review artifact bugs should cite both the contract/model side and the rendered/persisted artifact behavior, especially when weak evidence passes validation.
- Impact bugs should cite config/scope/context/analyze/report/write/render behavior and distinguish correctness defects from scaling or graceful-degradation defects.
- Git workflow bugs should cite preflight checks, preview/report content, confirmation posture, report-before-mutate behavior, and implemented-command routing.

## Specific Ideas

Start Phase 5 with review artifact quality because many commands share the `src/mcp/tools/review.ts` substrate. Then split `/blu-impact` into its own depth/scaling slice. Keep remediation/docs mutation and high-risk git workflows separate enough to preserve their stronger confirmation and no-live-mutation boundaries.

Discussion research notes used to calibrate the audit posture:
- OWASP code-review guidance supports tying review conclusions to concrete code and security evidence.
- Ajv strict-mode documentation supports treating schema strictness and silently ignored schema mistakes as meaningful validation concerns.
- GitHub branch protection guidance supports requiring status/review gates and safe PR-oriented workflows for protected branches.
- NIST SSDF guidance supports evidence-backed review, testing, provenance, and release-readiness checks.

## Deferred Ideas

None - discussion stayed within phase scope.

---

*Phase: 5-Review Quality Impact Shipping Audit*
*Context gathered: 2026-05-02*
