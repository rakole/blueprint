# Phase 8: Cross-Cut Drift And Regression Gaps - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

## Phase Boundary

Discovery-only audit of Blueprint's cross-cutting contract drift, missing regression coverage, schema drift, generated asset freshness, and issue clusters from the codebase concern map. Outputs are evidence-backed bug reports in `docs/bugs/*.md`; no source, manifest, skill, test, build, generated asset, runtime `.blueprint/`, installed-extension, host-global, branch, PR, or remote-service fixes are applied in this phase.

Phase 8 should audit drift across the full Blueprint contract stack: docs, command catalog, command manifests, skills, MCP docs, runtime/source, tests, and generated `dist` where relevant. Earlier clean phase slices are trusted as prior evidence, but shared docs, tests, generated assets, and any surface touched by cross-cut evidence should receive targeted re-checks.

## Implementation Decisions

### Contract Drift Matrix
- **D-01:** Use a full cross-layer drift matrix. Compare `docs/`, `docs/COMMAND-CATALOG.md`, `commands/*.toml`, `skills/*/SKILL.md`, `docs/MCP-TOOLS.md`, runtime/source handlers, focused tests, and generated `dist` outputs where relevant.
- **D-02:** File a drift bug only for material mismatches: drift that can mislead a user, agent, test, installer, runtime caller, or later repair planner. Low-impact wording drift should be captured as a note, not inflated into a bug.
- **D-03:** Organize the matrix by command or surface family, matching prior phase slices: router/readiness, lifecycle, roadmap/capture/lightweight execution, review/impact/shipping, workspace/maintenance, packaging/hooks/generated assets, and shared MCP docs/tests.
- **D-04:** Preserve targeted re-check discipline. Do not re-audit every prior clean slice from scratch; re-check shared docs/tests/generated assets and prior surfaces only when cross-cut evidence touches them.

### Regression Gap Threshold
- **D-05:** Missing regression coverage becomes a `docs/bugs/*.md` finding only when risk-backed. The missing guard must protect high-risk behavior, prior bug recurrence, generated assets, safety gates, or user-visible runtime contracts.
- **D-06:** Lower-risk test gaps should be captured as non-bug notes in phase artifacts, summaries, or Phase 9 review context. They should not crowd the bug index unless they create material repair-planning risk.
- **D-07:** Prioritize regression-gap leads in this order: prior bug recurrence, high-risk confirmation or destructive safety gates, generated asset freshness, and user-visible runtime or MCP contracts.
- **D-08:** A regression-gap bug must name the exact missing guard, the surface it protects, existing nearby tests, and the concrete failure mode that could escape without that guard.

### Concern Map Triage
- **D-09:** Consider all high-risk leads from `.planning/codebase/CONCERNS.md`, with priority for cross-layer or user-visible drift. Initial leads include Markdown parsing drift, permissive schema validation, generated asset freshness, filesystem/destructive-operation edges, impact performance, and stale docs/runtime contracts.
- **D-10:** Concern-map leads become bug reports only when confirmed or likely through contract/source/test evidence. Purely speculative concerns stay as risk context unless impact is high and uncertainty is explicit.
- **D-11:** Use static contract review and focused existing tests as the default evidence path. Disposable probes are allowed only when they resolve material ambiguity and must not mutate installed extensions, host-global state, source behavior, generated assets, or long-lived runtime state.
- **D-12:** Security, TOCTOU, and filesystem-race concerns should be documented as bugs only with concrete exploitability, destructive impact, or a clear contract violation. Otherwise, preserve them as risk notes for repair planning.

### Bug Clustering Rules
- **D-13:** Link BPBUG-001 through BPBUG-004 and any new Phase 8 findings into shared root-cause clusters without changing each bug's individual identity.
- **D-14:** Use practical root-cause cluster labels, such as under-specified contracts, missing regression guards, generated-asset freshness, stale docs/runtime references, and cross-layer contract synchronization gaps.
- **D-15:** Mark findings as duplicates only when they share the same defect and the same repair path. Bugs with the same root-cause family but different affected surfaces or fixes should remain separate and be linked as related.
- **D-16:** Record cluster information in `docs/bugs/INDEX.md` and each affected bug report's related-bugs section. Phase 8 planning should preserve those links so Phase 9 can prioritize repairs without rereading every report.

### Carried-Forward Audit Standards
- **D-17:** Preserve the Phase 2 through Phase 7 evidence bar: prefer confirmed or likely findings with concrete file, command, test, schema, generated-output, or contract evidence. Avoid weak suspected reports unless impact is high and uncertainty is explicit.
- **D-18:** Preserve the discovery-only boundary. Audit findings may create or update planning docs and `docs/bugs/*.md`; they must not repair source/runtime behavior, command manifests, skills, tests, generated assets, `.blueprint/` runtime state, installed extension directories, host-global state, branches, PRs, or git history.
- **D-19:** If a verification probe creates temporary files, it must use a disposable location, clean up before phase closeout, and document the probe in the relevant plan summary or bug evidence.
- **D-20:** Planned-only or non-routable Blueprint commands must not be recommended as immediate remediation paths in bug reports, context, or follow-up routing.

### the agent's Discretion
- The researcher and planner may choose the exact Phase 8 plan slicing, but the plan set should make the four discussed areas visible: contract drift matrix, regression-gap threshold, concern-map triage, and bug clustering.
- The planner may choose a matrix artifact shape that is efficient for execution, but it must retain surface family, risk tag, expected contract, actual observed behavior, evidence source, and disposition.
- The planner may group low-risk non-bug notes for Phase 9 instead of creating separate reports, as long as material confirmed or likely defects still receive full `docs/bugs/*.md` reports.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Guardrails
- `.planning/PROJECT.md` - discovery-only milestone contract, Blueprint-not-GSD boundary, and output target under `docs/bugs/*.md`.
- `.planning/REQUIREMENTS.md` - Phase 8 mapped requirements, especially `CLASS-04`, `EVID-04`, `COV-07`, `COV-08`, and `NFIX-*`.
- `.planning/ROADMAP.md` - Phase 8 goal, suggested surfaces, dependencies, and success criteria.
- `.planning/STATE.md` - current milestone state, active guardrails, Phase 7 validation state, and Docker integration-test blocker context.
- `docs/bugs/INDEX.md` - current bug inventory, slice coverage, duplicate vocabulary, and routing guardrails.

### Prior Phase Context
- `.planning/phases/01-bug-taxonomy-and-reporting-harness/01-CONTEXT.md` - bug-reporting harness, evidence fields, and discovery-only baseline.
- `.planning/phases/04-roadmap-capture-lightweight-audit/04-CONTEXT.md` - preview parity, high-risk confirmation, partial-failure, state-routing, and no-fix standards.
- `.planning/phases/05-review-quality-impact-shipping-audit/05-CONTEXT.md` - review/report artifact quality, impact scaling, mutation safety, high-risk git safety, and BPBUG-001 context.
- `.planning/phases/06-workspace-maintenance-audit/06-CONTEXT.md` - workspace/global-state boundaries, cleanup regression gap context, stale MCP update docs, and BPBUG-002/BPBUG-003 context.
- `.planning/phases/07-host-packaging-build-hooks-audit/07-VALIDATION.md` - Phase 7 validation state after BPBUG-004 repair and generated-asset freshness evidence.

### Cross-Cut Contract Inputs
- `.planning/codebase/CONCERNS.md` - concern-map leads for monolithic MCP tools, Markdown parsing, schema permissiveness, generated/output drift, filesystem edges, impact scaling, and test gaps.
- `.planning/codebase/TESTING.md` - test framework, suite organization, targeted regression patterns, and coverage limitations.
- `.planning/codebase/STRUCTURE.md` - repo layout and source/manifest/skill/test/generated-asset locations.
- `docs/DECISIONS.md` - global product and architecture decisions that define expected Blueprint behavior.
- `docs/MCP-TOOLS.md` - shared MCP tool contract documentation and a key drift target after BPBUG-003.
- `docs/RUNTIME-REFERENCE.md` - runtime behavior reference for implemented commands and known deltas.
- `docs/COMMAND-CATALOG.md` - declared command status baseline and implemented-only routing contract.
- `docs/ARTIFACT-SCHEMA.md` - `.blueprint/` artifact shapes, report schemas, and validation expectations.
- `docs/commands/*.md` - command spec set for all implemented and documented `/blu-*` surfaces.
- `commands/*.toml` - command manifest prompt contracts, required MCP calls, and user-facing routing constraints.
- `skills/*/SKILL.md` - orchestration contracts and command-family runtime rules.
- `agents/*.md` - bounded agent contracts; do not read them in the orchestrator unless a plan explicitly needs schema validation evidence.

### Runtime Truth Sources
- `src/mcp/tools/project.ts` - command catalog/runtime status computation and implemented-only routing surface.
- `src/mcp/tools/state.ts` - state updates, next-action routing, and implemented-command filtering.
- `src/mcp/tools/phase.ts` - roadmap and phase lifecycle mutation behavior.
- `src/mcp/tools/artifacts.ts` - artifact contract validation, report authoring, and Markdown parsing pressure points.
- `src/mcp/tools/review.ts` - review/report validation and schema-backed artifact behavior.
- `src/mcp/tools/impact.ts` - impact analysis, permissive schema validation, dependency scanning, and scaling concerns.
- `src/mcp/tools/workspace.ts` - workspace, cleanup, workstream, patch, filesystem, and host-global registry behavior.
- `src/mcp/tools/update.ts` - advisory update runtime behavior and stale MCP docs lead.
- `src/mcp/runtime-host.ts` - host identity, installed-extension path, and global-state root resolution.
- `src/mcp/server.ts` - tool registration and mutation-failure logging wrappers.
- `scripts/build.mjs` - generated `dist` build pipeline and copied schema assets.
- `dist/` - committed generated runtime bundle launched by installed hosts.

### Regression Tests As Evidence Leads
- `tests/command-contract-docs.test.ts` - docs/manifest/contract alignment coverage.
- `tests/command-catalog.test.ts` - command catalog and implemented-status coverage.
- `tests/extension-runtime-contracts.test.ts` - runtime contract and generated bundle surface coverage.
- `tests/built-assets-smoke.test.ts` and `tests/built-schema-assets.test.ts` - generated asset freshness and copied schema checks.
- `tests/artifact-contracts.test.ts` and `tests/artifact-validate-runtime.test.ts` - artifact schema/validation behavior.
- `tests/impact-tools.test.ts`, `tests/impact-fixtures.test.ts`, and `tests/impact-metadata.test.ts` - impact depth, config, report, and scaling evidence leads.
- `tests/cleanup-tools.test.ts` and `tests/cleanup-metadata.test.ts` - cleanup behavioral and metadata evidence leads after BPBUG-002.
- `tests/update-tools.test.ts` and `tests/update-metadata.test.ts` - update behavior and docs drift evidence leads after BPBUG-003.
- `tests/review-docs-safety-regression.test.ts`, `tests/ship-metadata.test.ts`, and `tests/undo-metadata.test.ts` - report contract and high-risk workflow evidence leads after BPBUG-001.
- `tests/security-hardening.test.ts` and `tests/security-docs.test.ts` - path, prompt, and security-doc guardrails.

### External Research References
- `https://pactflow.github.io/drift-docs/docs/concepts/where-drift-fits/` - contract drift should validate schema and data types early while behavioral tests stay focused.
- `https://getbestest.com/testing-methodologies/risk-based-testing/` - risk-based testing prioritizes coverage by impact and complexity.
- `https://www.techtarget.com/searchsoftwarequality/tip/How-to-handle-root-cause-analysis-of-software-defects` - root-cause analysis should preserve evidence and produce preventive actions rather than only restating symptoms.

## Existing Code Insights

### Reusable Assets
- `docs/bugs/TEMPLATE.md` and `docs/bugs/INDEX.md` provide the bug-report format and index vocabulary for Phase 8 findings and clusters.
- `.planning/codebase/CONCERNS.md` provides the most important cross-cut discovery leads and should seed the concern-map portion of the matrix.
- Existing metadata, slice, tool, and generated-asset tests provide targeted evidence leads without broad re-auditing of every prior phase.
- `src/mcp/tools/*` modules are the runtime truth sources for MCP behavior and should be compared against command docs, manifests, skill contracts, and tests.

### Established Patterns
- Commands are thin TOML prompt contracts; skills orchestrate; MCP tools own deterministic persistence, validation, and state transitions.
- Root routing and follow-up guidance must surface only implemented commands.
- Discovery phases update planning artifacts and bug docs only; source/runtime defects are documented for later repair.
- High-risk mutation flows should make resolved scope, confirmation gates, preview/report evidence, and next safe action visible before mutation.
- Generated `dist` assets are committed and installed hosts launch them directly, so source/build drift can be a runtime-impacting defect.

### Integration Points
- Phase 8 should trace each material drift lead from expected contract to actual behavior and coverage: docs/spec -> manifest -> skill -> MCP/source -> tests -> generated assets when applicable.
- Regression-gap bugs should cite existing nearby tests to show the exact missing guard rather than making generic "add more tests" claims.
- Cluster work should update `docs/bugs/INDEX.md` and individual report related-bugs sections when Phase 8 creates or touches bug reports.
- Non-bug risk notes should be preserved for Phase 9 priority review, especially lower-risk coverage notes and speculative concern-map items.

## Specific Ideas

Start with a compact drift matrix that uses surface family as the primary grouping and risk tags as a secondary field. Suggested columns: surface family, expected contract, observed source/runtime/generated/test behavior, evidence path, risk tag, disposition, and related bug id or note.

Prioritize BPBUG recurrence and concern-map leads first:
- BPBUG-001: under-specified high-risk report contracts.
- BPBUG-002: missing behavioral regression guard for cleanup protected-scope archival.
- BPBUG-003: stale shared MCP docs for update return shapes.
- BPBUG-004: generated `dist` freshness gap, repaired before Phase 8 but still useful as a regression/freshness cluster lead.

Research notes used to calibrate the audit posture:
- Contract drift guidance supports comparing declared contracts to observable behavior early instead of relying only on downstream functional tests.
- Risk-based testing guidance supports filing coverage gaps only when impact and complexity justify them.
- Root-cause analysis guidance supports clustering related defects by preventive repair path while preserving separate evidence for distinct bugs.

## Deferred Ideas

None - discussion stayed within phase scope.

---

*Phase: 8-Cross-Cut Drift And Regression Gaps*
*Context gathered: 2026-05-02*
