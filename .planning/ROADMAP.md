# Roadmap: Blueprint

## Overview

Blueprint moves from a locked docs-first planning pack to an executable Gemini extension in staged phases. The roadmap starts with the smallest foundation loop that can make future commands real, inserts a drift-repair checkpoint after the shipped Wave 0 work, and then expands outward through lifecycle commands, roadmap administration, capture flows, quality tooling, and finally workspace and maintenance operations.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): planned milestone work
- Decimal phases (2.1, 2.2): urgent insertions if new work must land between planned phases

- [x] **Phase 1: Foundation Bootstrap and State** - Create the extension scaffold, router entrypoints, and deterministic MCP-backed bootstrap flow
- [x] **Phase 2: Router, Health, and Mapping** - Make foundational read-path and brownfield foundation commands executable
- [x] **Phase 2.1: Drift Recovery Gate** - Re-baseline docs, runtime surfaces, and Wave 0 parity before Phase 3 exposure
- [ ] **Phase 2.2: Urgent Drift-Repair Follow-Up** - Complete the locked truth-sync, runtime-awareness, parity, and phase-freeze work before any Phase 3 execution
- [ ] **Phase 3: Phase Discovery** - Add context capture, targeted research, and UI-spec flows
- [ ] **Phase 4: Plan, Execute, and Verify** - Complete the core implementation loop for planned work
- [ ] **Phase 5: Roadmap and Milestones** - Add roadmap mutation and milestone administration flows
- [ ] **Phase 6: Capture and Lightweight Execution** - Add notes, todos, backlog, and lightweight execution/routing tools
- [ ] **Phase 7: Quality and Shipping** - Add review, verification-adjacent quality, and shipping workflows
- [ ] **Phase 8: Workspaces and Maintenance** - Add global workspace management and maintenance commands within locked safety boundaries

## Phase Details

### Phase 1: Foundation Bootstrap and State
**Goal**: Turn the current docs pack into an installable Gemini extension skeleton with a working `/blu:new-project` path and shared MCP tool primitives.
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03
**Success Criteria** (what must be TRUE):
  1. Developer can load the Blueprint extension scaffold in Gemini and invoke `/blu` plus `/blu:new-project`
  2. `/blu:new-project` creates deterministic `.blueprint/` artifacts from locked defaults and repo context
  3. Shared project/config/state/artifact MCP primitives exist and are covered by initial fixture tests
**Plans**: 3 plans

Plans:
- [x] 01-01: Scaffold `gemini-extension.json`, `GEMINI.md`, and the root `/blu` command entrypoint
- [x] 01-02: Bootstrap `src/mcp/server.ts` plus project/config/state/artifact tool surfaces
- [x] 01-03: Implement `/blu:new-project` command wiring and initial happy-path tests

### Phase 2: Router, Health, and Mapping
**Goal**: Make the rest of Wave 0 usable against real repo state.
**Depends on**: Phase 1
**Requirements**: FND-04, FND-05, FND-06
**Success Criteria** (what must be TRUE):
  1. User can update settings and set profile without hand-editing config
  2. Help, progress, and health return actionable guidance from real `.blueprint/` state
  3. Brownfield users can map an existing codebase into stable artifacts for downstream planning
**Plans**: 3 plans

Plans:
- [x] 02-01: Implement `settings` and `set-profile` on normalized config
- [x] 02-02: Implement `help`, `progress`, and `health` on shared state primitives
- [x] 02-03: Implement `map-codebase` artifact generation and related tests

### Phase 2.1: Drift Recovery Gate
**Goal**: Repair Phase 1 and Phase 2 drift so runtime truth, docs, and routing rules agree before more command surface is exposed.
**Depends on**: Phase 2
**Requirements**: DRIFT-01, DRIFT-02, DRIFT-03, DRIFT-04
**Success Criteria** (what must be TRUE):
  1. Control docs, handoff docs, and implementation state all describe the actual shipped Wave 0 runtime
  2. `/blu`, `help`, and `progress` surface only commands whose manifests, primary skills, and required MCP tools exist
  3. Shipped Wave 0 skills and agent contracts exist in the runtime and the codebase mapping bundle includes `STRUCTURE.md`
  4. Later commands stay blocked until their missing roadmap/phase substrate exists
**Plans**: 4 plans

Plans:
- [x] 02.1-01: Create `docs/DRIFT.MD` and truth-sync control docs plus implementation state
- [x] 02.1-02: Add runtime Wave 0 skills and agent contracts, then harden command discovery against planned-only commands
- [x] 02.1-03: Re-baseline shipped Wave 0 command specs and manifests to restore GSD intent without breaking Blueprint deltas
- [x] 02.1-04: Add consistency, routing, and parity regression coverage before allowing later phases

### Phase 2.2: Urgent Drift-Repair Follow-Up (INSERTED)

**Goal:** Repair future command contract drift and control-plane truth so later phases stay aligned with Blueprint architecture without changing runtime status semantics or expanding command exposure.
**Locked Scope:** Do not discard working Phase 1/2 code without an explicit Blueprint reason; keep `docs/DRIFT.md` as the repair source of truth; truth-sync the control docs and planning state; backfill drift-repair requirement traceability; keep `blueprint_command_catalog` runtime-aware without changing its status semantics; keep planned-only commands hidden from `/blu`, `/blu:help`, and `/blu:progress`; preserve only the explicit Blueprint divergences; and keep Phase 3 blocked until the Phase 2.2 contract-repair exit criteria pass.
**Requirements**: DRIFT-05, DRIFT-06, DRIFT-07
**Depends on:** Phase 2.1
**Success Criteria** (what must be TRUE):
  1. Control docs and planning state describe Phase 2.1 as complete on 2026-04-11 and Phase 2.2 as the active checkpoint
  2. Future command ownership, wave, family, and primary skill metadata stay consistent across `docs/COMMAND-CATALOG.md`, `docs/SKILLS-AND-AGENTS.md`, `docs/GSD-RUNTIME-MIGRATION.md`, and `docs/commands/*.md`
  3. Regression tests fail on control-plane or future-command contract drift
  4. `blueprint_command_catalog` keeps its current implemented-versus-blocked semantics and later commands remain unroutable
**Plans:** 4 plans

Plans:
- [ ] 02.2-01: Reopen `docs/DRIFT.MD` and truth-sync control-plane docs plus `.planning` state around the active checkpoint
- [ ] 02.2-02: Backfill `DRIFT-01` through `DRIFT-07` traceability and repair future command ownership metadata
- [ ] 02.2-03: Refresh future-phase migration and parity notes without changing runtime command exposure
- [ ] 02.2-04: Add regression coverage for control-plane and command-contract drift

### Phase 3: Phase Discovery
**Goal**: Add the pre-planning discovery commands that capture context before plan creation.
**Depends on**: Phase 2.2
**Requirements**: LIFE-01, LIFE-02, LIFE-03
**Success Criteria** (what must be TRUE):
  1. User can capture phase framing in durable context artifacts
  2. User can request focused research when uncertainty exists
  3. Frontend-heavy work can produce a UI spec or explicit skip rationale
**Plans**: 3 plans

Plans:
- [ ] 03-01: Implement `discuss-phase` and phase context artifact handling
- [ ] 03-02: Implement `research-phase` orchestration and research artifacts
- [ ] 03-03: Implement `ui-phase` generation and UI-safety integration

### Phase 4: Plan, Execute, and Verify
**Goal**: Complete the core loop that turns scoped work into executed and verified change.
**Depends on**: Phase 3
**Requirements**: LIFE-04, LIFE-05, LIFE-06, LIFE-07
**Success Criteria** (what must be TRUE):
  1. User can create executable phase plans with plan-check validation
  2. User can execute plans, persist summaries, and verify results before phase completion
  3. `next`, `pause-work`, and `resume-work` reconstruct workflow position correctly after interruptions
**Plans**: 4 plans

Plans:
- [ ] 04-01: Implement `plan-phase` and plan-check integration
- [ ] 04-02: Implement `execute-phase` summary flow and state progression
- [ ] 04-03: Implement `validate-phase` and `verify-work`
- [ ] 04-04: Implement `next`, `pause-work`, and `resume-work`

### Phase 5: Roadmap and Milestones
**Goal**: Let users reshape the roadmap safely and manage milestone transitions.
**Depends on**: Phase 4
**Requirements**: ROAD-01, ROAD-02, ROAD-03
**Success Criteria** (what must be TRUE):
  1. Roadmap mutations keep files, numbering, and phase directories in sync
  2. Users can surface assumptions and add milestone-gap phases without corrupting history
  3. Milestone audit, completion, summary, and new-milestone flows preserve traceability
**Plans**: 3 plans

Plans:
- [ ] 05-01: Implement `add-phase`, `insert-phase`, and `remove-phase`
- [ ] 05-02: Implement `list-phase-assumptions` and `plan-milestone-gaps`
- [ ] 05-03: Implement `audit-milestone`, `complete-milestone`, `milestone-summary`, and `new-milestone`

### Phase 6: Capture and Lightweight Execution
**Goal**: Add project-local capture flows and lightweight execution helpers.
**Depends on**: Phase 5
**Requirements**: CAP-01, CAP-02, CAP-03
**Success Criteria** (what must be TRUE):
  1. Notes, todos, and backlog items persist deterministically inside project state
  2. Backlog review can promote approved work into the roadmap
  3. Lightweight execution and routing commands respect state and safety boundaries
**Plans**: 3 plans

Plans:
- [ ] 06-01: Implement `note`, `add-todo`, `check-todos`, and `add-backlog`
- [ ] 06-02: Implement `review-backlog`, `fast`, `quick`, `do`, and `explore`
- [ ] 06-03: Implement `debug`

### Phase 7: Quality and Shipping
**Goal**: Add review, verification-adjacent quality, and shipping workflows.
**Depends on**: Phase 6
**Requirements**: QUAL-01, QUAL-02, QUAL-03
**Success Criteria** (what must be TRUE):
  1. Review and review-fix flows produce durable artifacts and safe follow-up loops
  2. Docs, security, UI review, and test flows integrate with phase evidence
  3. PR branching, shipping, and undo preserve confirmation gates and degrade safely when tools are missing
**Plans**: 3 plans

Plans:
- [ ] 07-01: Implement `code-review`, `code-review-fix`, `audit-fix`, and `review`
- [ ] 07-02: Implement `docs-update`, `secure-phase`, `ui-review`, and `add-tests`
- [ ] 07-03: Implement `pr-branch`, `ship`, and `undo`

### Phase 8: Workspaces and Maintenance
**Goal**: Complete the retained v1 command surface with scoped global state and maintenance behavior.
**Depends on**: Phase 7
**Requirements**: OPS-01, OPS-02
**Success Criteria** (what must be TRUE):
  1. Workspaces use the locked global registry and workspace root
  2. Workstreams remain project-local and safe to switch or resume
  3. Cleanup, update, and patch replay stay within locked mutation boundaries and do not self-mutate the installed extension
**Plans**: 2 plans

Plans:
- [ ] 08-01: Implement `new-workspace`, `remove-workspace`, and `workstreams`
- [ ] 08-02: Implement `cleanup`, `update`, and `reapply-patches`

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 2.1 → 2.2 → 3 → 4 → 5 → 6 → 7 → 8

Phase 3 and beyond remain blocked from runtime exposure until their missing substrate is implemented deliberately.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation Bootstrap and State | 3/3 | Complete | 2026-04-11 |
| 2. Router, Health, and Mapping | 3/3 | Complete | 2026-04-11 |
| 2.1. Drift Recovery Gate | 4/4 | Complete | 2026-04-11 |
| 2.2. Urgent Drift-Repair Follow-Up | 0/4 | Active | - |
| 3. Phase Discovery | 0/3 | Not started | - |
| 4. Plan, Execute, and Verify | 0/4 | Not started | - |
| 5. Roadmap and Milestones | 0/3 | Not started | - |
| 6. Capture and Lightweight Execution | 0/3 | Not started | - |
| 7. Quality and Shipping | 0/3 | Not started | - |
| 8. Workspaces and Maintenance | 0/2 | Not started | - |
