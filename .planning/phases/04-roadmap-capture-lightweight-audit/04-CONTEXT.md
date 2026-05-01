# Phase 4: Roadmap Capture Lightweight Audit - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

## Phase Boundary

Discovery-only audit of Blueprint's roadmap administration, milestone flows, capture commands, lightweight execution, and debug surfaces. Outputs are evidence-backed bug reports in `docs/bugs/*.md`; no source, manifest, skill, test, build, generated asset, runtime `.blueprint/`, installed-extension, host-global, or remote-service fixes are applied in this phase.

Phase 4 should audit the shipped command surfaces listed in the roadmap: roadmap admin commands, capture and promotion commands, `/blu-fast`, `/blu-quick`, and `/blu-debug`. The discussion focused on roadmap mutation safety; undiscussed Phase 4 surfaces remain in scope and should be planned using the carried-forward milestone guardrails and the roadmap success criteria.

## Implementation Decisions

### Roadmap Mutation Safety
- **D-01:** Preview parity is a real Phase 4 audit target. For roadmap mutations, preview and confirmation evidence should reflect the same MCP mutation substrate as the real write wherever practical; file a bug when preview can materially drift from apply behavior.
- **D-02:** Destructive or high-risk roadmap operations need two-gate scrutiny. The audit should look for a normal confirmation gate plus a second destructive confirmation when execution evidence, phase artifacts, renumbering, deletion, archival, or rewrite risk exists.
- **D-03:** Multi-file partial-failure gaps count as Phase 4 bugs. If a roadmap mutation can leave `.blueprint/ROADMAP.md`, phase directories, artifact filenames, or `.blueprint/STATE.md` inconsistent without rollback, idempotent retry, or clear recovery guidance, document it as a defect.
- **D-04:** Post-mutation state and follow-up routing get strict checks. Roadmap mutations must update state through MCP-owned paths and point only to implemented Blueprint commands, using concrete phase numbers and paths returned by MCP results rather than prose-derived guesses.

### Carried-Forward Audit Standards
- **D-05:** Preserve the Phase 2 and Phase 3 evidence bar: prefer confirmed or likely findings with concrete file, command, test, or contract evidence; avoid weak suspected reports unless impact is high and uncertainty is explicit.
- **D-06:** Default evidence approach remains static contract review plus targeted existing tests. Disposable runtime probes are allowed only when they resolve a material ambiguity and must be cleaned up before phase closeout.
- **D-07:** This phase is discovery-only. Audit findings may create or update planning docs and `docs/bugs/*.md`; they must not repair source/runtime behavior, command manifests, skills, tests, generated assets, `.blueprint/` runtime state, installed extension directories, host-global state, or remote services.

### the agent's Discretion
- The researcher and planner may choose the exact Phase 4 plan slicing, but should make roadmap mutation safety an explicit early slice because the user selected it for discussion and chose the strictest safety posture for all roadmap mutation questions.
- For Phase 4 surfaces not discussed interactively, use `.planning/ROADMAP.md`, prior phase contexts, command specs, skill contracts, runtime references, codebase concerns, and existing tests to choose sensible audit depth.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Guardrails
- `.planning/PROJECT.md` - discovery-only milestone contract, Blueprint-not-GSD boundary, and output target under `docs/bugs/*.md`.
- `.planning/REQUIREMENTS.md` - evidence, classification, workflow coverage, and no-fix requirements, especially `COV-03` and `NFIX-*`.
- `.planning/ROADMAP.md` - Phase 4 goal, suggested surfaces, dependencies, and success criteria.
- `.planning/STATE.md` - current milestone state and active guardrails.
- `.planning/phases/01-bug-taxonomy-and-reporting-harness/01-CONTEXT.md` - bug-reporting harness, evidence standard, and discovery-only decisions carried forward.
- `.planning/phases/02-bootstrap-router-config-audit/02-CONTEXT.md` - tests-first evidence preference, confidence threshold, implemented-only routing, and material drift standards carried forward.
- `.planning/phases/03-core-lifecycle-audit/03-CONTEXT.md` - command-flow audit order, targeted-test posture, lifecycle-state defect threshold, and no-fix boundary decisions carried forward.

### Phase 4 Command Specs And Manifests
- `docs/commands/add-phase.md` and `commands/blu-add-phase.toml` - roadmap append command contract.
- `docs/commands/insert-phase.md` and `commands/blu-insert-phase.toml` - decimal insertion command contract.
- `docs/commands/remove-phase.md` and `commands/blu-remove-phase.toml` - destructive phase removal and renumbering contract.
- `docs/commands/plan-milestone-gaps.md` and `commands/blu-plan-milestone-gaps.toml` - grouped gap-closure roadmap mutation contract.
- `docs/commands/audit-milestone.md` and `commands/blu-audit-milestone.toml` - milestone audit report contract.
- `docs/commands/complete-milestone.md` and `commands/blu-complete-milestone.toml` - milestone completion report and routing contract.
- `docs/commands/milestone-summary.md` and `commands/blu-milestone-summary.toml` - milestone summary report contract.
- `docs/commands/new-milestone.md` and `commands/blu-new-milestone.toml` - carry-forward/new milestone scaffold contract.
- `docs/commands/note.md`, `docs/commands/add-todo.md`, `docs/commands/check-todos.md`, `docs/commands/add-backlog.md`, `docs/commands/review-backlog.md`, and `docs/commands/explore.md` - capture, duplicate handling, todo status, backlog, promotion, and ideation contracts.
- `docs/commands/fast.md`, `docs/commands/quick.md`, and `docs/commands/debug.md` - lightweight execution, quick-run evidence, and debug report/follow-up contracts.

### Skills And Runtime References
- `skills/blueprint-roadmap-admin/SKILL.md` - roadmap admin orchestration, required MCP tools, confirmation gates, state updates, and follow-up routing.
- `skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md` - detailed add-phase runtime contract.
- `skills/blueprint-roadmap-admin/references/insert-phase-runtime-contract.md` - detailed insert-phase runtime contract.
- `skills/blueprint-capture/SKILL.md` - capture, duplicate detection, reserved stub, backlog promotion, and follow-up routing contract.
- `skills/blueprint-phase-execution/SKILL.md` - lightweight execution orchestration for fast/quick paths.
- `skills/blueprint-phase-execution/references/fast-runtime-contract.md` - `/blu-fast` qualification, state, and no-report contract.
- `skills/blueprint-phase-execution/references/quick-runtime-contract.md` - `/blu-quick` bounded execution, durable report, and routing contract.
- `skills/blueprint-debug/SKILL.md` - `/blu-debug` diagnosis, report persistence, explicit follow-up gate, and todo-capture contract.

### Runtime Truth Sources
- `docs/COMMAND-CATALOG.md` - declared command status baseline; Phase 4 commands listed here are declared implemented and must stay aligned with runtime substrate.
- `docs/MCP-TOOLS.md` - authoritative MCP tool surface and model-facing call contracts.
- `docs/RUNTIME-REFERENCE.md` - runtime behavior reference for implemented commands and known deltas.
- `docs/ARTIFACT-SCHEMA.md` - `.blueprint/` artifact shape, report contracts, and state boundaries.
- `src/mcp/tools/phase.ts` - roadmap/phase mutation handlers, phase directory and artifact behavior, and roadmap/state coordination.
- `src/mcp/tools/artifacts.ts` - artifact contract, scaffold, report, validation, and safe persistence helpers.
- `src/mcp/tools/review.ts` - review/report helper behavior included in Phase 4 suggested surfaces.
- `src/mcp/tools/state.ts` - durable `STATE.md` transitions and next-safe-action behavior.

### Regression Tests As Evidence Leads
- `tests/roadmap-tools.test.ts`
- `tests/add-phase-metadata.test.ts`
- `tests/insert-phase-metadata.test.ts`
- `tests/remove-phase-metadata.test.ts`
- `tests/plan-milestone-gaps-metadata.test.ts`
- `tests/audit-milestone-metadata.test.ts`
- `tests/audit-milestone-tools.test.ts`
- `tests/complete-milestone-metadata.test.ts`
- `tests/milestone-summary-metadata.test.ts`
- `tests/new-milestone-metadata.test.ts`
- `tests/note-metadata.test.ts`
- `tests/add-todo-metadata.test.ts`
- `tests/check-todos-metadata.test.ts`
- `tests/add-backlog-metadata.test.ts`
- `tests/review-backlog-metadata.test.ts`
- `tests/explore-metadata.test.ts`
- `tests/fast-metadata.test.ts`
- `tests/quick-metadata.test.ts`
- `tests/debug-metadata.test.ts`

## Existing Code Insights

### Reusable Assets
- `src/mcp/tools/phase.ts` centralizes roadmap and phase mutations, including add/insert/remove behavior and phase artifact coordination.
- `src/mcp/tools/artifacts.ts` provides report/scaffold/validation helpers that milestone and capture flows rely on for contract-owned writes.
- `src/mcp/tools/state.ts` owns next-action state transitions and should be checked after any Phase 4 mutation that changes active work.
- The existing metadata and tool tests provide targeted evidence leads for roadmap admin, capture, quick, fast, and debug contracts without inventing broad new probes first.

### Established Patterns
- Commands are thin TOML prompt contracts; skills orchestrate; MCP tools own deterministic persistence and state transitions.
- Root routing and follow-up guidance must surface only implemented commands.
- High-risk roadmap and workspace-style mutations should use explicit confirmation gates and authoritative returned MCP values.
- Discovery phases update planning artifacts and bug docs only; source/runtime defects are documented for later repair.

### Integration Points
- Phase 4 should trace each command from `docs/commands/*.md` and `commands/blu-*.toml` into the relevant skill, runtime reference where present, MCP tool handlers, and focused tests.
- Roadmap mutation bugs should cite both the contract side and the implementation/test side, especially when preview, apply, state update, or recovery behavior diverges.
- Capture and lightweight execution findings should distinguish project-local `.blueprint/` persistence from session-local coordination helpers.

## Specific Ideas

Start Phase 4 with a roadmap mutation safety slice because the user chose that area and selected the strictest posture for preview parity, destructive gates, partial-failure handling, and state routing. Then audit capture/promotion and lightweight execution/debug surfaces using the same evidence and no-fix standards.

## Deferred Ideas

None - discussion stayed within phase scope.

---

*Phase: 4-Roadmap Capture Lightweight Audit*
*Context gathered: 2026-05-01*
