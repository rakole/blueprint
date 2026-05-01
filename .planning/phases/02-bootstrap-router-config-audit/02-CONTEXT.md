# Phase 2: Bootstrap Router Config Audit - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

## Phase Boundary

Discovery-only audit of Blueprint's foundational bootstrap routing plus the readiness/config substrate for `/blu`, `/blu-help`, `/blu-progress`, `/blu-next`, `new-project`, and map-first readiness behavior. Outputs are evidence-backed bug reports in `docs/bugs/*.md`; no runtime/source fixes are applied in this phase.

## Implementation Decisions

### Implemented-Only Routing (Defect Definition)
- **D-01:** Phase 2 treats defects primarily as **user-facing routing/help violations** on `/blu`, `/blu-help`, `/blu-progress`, `/blu-next`, and direct `/blu-<cmd>` surfaces.
- **D-02:** If a command is declared implemented but is unroutable due to missing substrate, file a bug anyway; routing being "safely hidden" does not make the contract correct.
- **D-03:** If drift does not change user-facing routing/help output, still file a docs-drift bug when the mismatch is material (misleads users or maintainers).
- **D-04:** For "declared implemented but unroutable", classify the primary defect as a **command catalog/status contract defect** (missing substrate is evidence, not the primary classification).

### Audit Ordering And Evidence Threshold
- **D-05:** Default audit order: start from user-facing routing/help outputs as "actual", then trace into command catalog logic, manifests, skills, tools, and tests to explain or confirm defects.
- **D-06:** Evidence bar for confidence:
  - **Confirmed:** reproducible (failing test, deterministic output, or clear runtime behavior).
  - **Likely:** strong static contract/implementation contradiction with concrete file evidence.
  - **Suspected:** avoid unless high-impact; otherwise gather more objective evidence or drop.
- **D-07:** Repro evidence preference is tests-first when feasible; avoid creating new tests during discovery unless explicitly permitted later.
- **D-08:** When evidence is ambiguous, keep digging until at least "Likely" (or drop); avoid flooding Phase 2 with weak "Suspected" bugs.

### Map-First Readiness Expectations
- **D-09:** Map-first is a hard gate: brownfield/unmapped and `mapping-incomplete` repos must route to `/blu-map-codebase`; misrouting is a defect.
- **D-10:** Router guidance must be explicit about the waiting state and exact next safe action (state label plus `/blu-map-codebase`).
- **D-11:** If brownfield-vs-greenfield detection is ambiguous, fail safe to `/blu-map-codebase` rather than `/blu-new-project`.
- **D-12:** For `mapped-only` repos, the correct next action is `/blu-new-project` (do not recommend `map-codebase` again unless the bundle is invalid).

### the agent's Discretion
- Bug report wording and headings may align to the established `docs/bugs/TEMPLATE.md` style as long as the locked phase decisions above are preserved.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Guardrails
- `.planning/PROJECT.md` — discovery-only milestone contract and output targets.
- `.planning/REQUIREMENTS.md` — evidence, classification, and no-fix discipline requirements.
- `.planning/ROADMAP.md` — Phase 2 goal, suggested surfaces, and success criteria.
- `.planning/STATE.md` — current guardrails and workflow posture.

### Routing And Map-First Contracts
- `docs/DECISIONS.md` — product and routing guardrails, including implemented-only expectations.
- `docs/COMMAND-CATALOG.md` — declared command status baseline used by routing contracts.
- `docs/MCP-TOOLS.md` — authoritative MCP tool surface used by router commands.
- `docs/commands/root-router.md` — `/blu` contract and routing expectations.
- `docs/commands/help.md` — `/blu-help` readiness and safe recommendation contract.
- `docs/commands/progress.md` — `/blu-progress` readiness and safe recommendation contract.
- `docs/commands/next.md` — `/blu-next` readiness and next-action contract.
- `docs/commands/new-project.md` — `new-project` bootstrap gate contract (including map-first).
- `docs/commands/map-codebase.md` — `map-codebase` behavior and codebase-only write contract.
- `commands/blu.toml` — root router prompt contract.
- `commands/blu-help.toml` — help prompt contract.
- `commands/blu-progress.toml` — progress prompt contract.
- `commands/blu-next.toml` — next prompt contract.
- `commands/blu-new-project.toml` — new-project prompt contract.
- `commands/blu-map-codebase.toml` — map-codebase prompt contract.

### Runtime Truth Sources (Readiness, Routing, Catalog Projection)
- `src/mcp/tools/project.ts` — readiness inspection and command catalog access (notably `blueprintProjectStatus()` and catalog loading).
- `src/mcp/command-resources.ts` — command catalog and per-command runtime contract projection.
- `src/mcp/tools/config.ts` — config reads/normalization that affect routing.
- `src/mcp/tools/state.ts` — state reads and derived status used by router commands.

### Regression Tests As Primary Evidence
- `tests/help-progress-health.test.ts`
- `tests/next.test.ts`
- `tests/new-project.test.ts`
- `tests/command-catalog.test.ts`
- `tests/command-contract-docs.test.ts`
- `tests/map-codebase.test.ts`

## Existing Code Insights

### Reusable Assets
- `src/mcp/tools/project.ts` already encodes map-first readiness branching:
  - `uninitialized` brownfield unmapped -> `map-codebase`
  - `mapping-incomplete` -> `map-codebase`
  - `mapped-only` -> `new-project`
  - `partial` -> `health`
- Command manifests and docs already repeat the readiness matrix, so drift is likely to be material and user-visible.

### Established Patterns
- `/blu*` router behavior is governed by `blueprint_project_status` plus `blueprint_command_catalog` outputs and must not recommend non-implemented commands.

### Integration Points
- Phase 2 evidence should start from user-facing router outputs and trace into tool outputs, manifests, docs, and tests.

## Specific Ideas

Audit from user-facing routing/help outputs outward into supporting contracts and runtime substrates.

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 2-Bootstrap Router Config Audit*
*Context gathered: 2026-05-01*

