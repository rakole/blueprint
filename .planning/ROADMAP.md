# Roadmap: Blueprint

## Overview

Blueprint moves from a locked docs-first planning pack to an executable Gemini extension in eight phases. The roadmap starts with the smallest foundation loop that can make future commands real, then expands outward through lifecycle commands, roadmap administration, capture flows, quality tooling, and finally workspace and maintenance operations.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): planned milestone work
- Decimal phases (2.1, 2.2): urgent insertions if new work must land between planned phases

- [x] **Phase 1: Foundation Bootstrap and State** - Create the extension scaffold, router entrypoints, and deterministic MCP-backed bootstrap flow
- [ ] **Phase 2: Router, Health, and Mapping** - Make foundational read-path and brownfield foundation commands executable
- [ ] **Phase 3: Phase Discovery** - Add context capture, targeted research, and UI-spec flows
- [ ] **Phase 4: Plan, Execute, and Verify** - Complete the core implementation loop for planned work
- [ ] **Phase 5: Roadmap and Milestones** - Add roadmap mutation and milestone administration flows
- [ ] **Phase 6: Capture and Lightweight Execution** - Add notes, todos, backlog, and lightweight execution/routing tools
- [ ] **Phase 7: Quality and Shipping** - Add review, docs, security, UI, tests, and shipping flows
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

### Phase 3: Phase Discovery
**Goal**: Add the pre-planning discovery commands that capture context before plan creation.
**Depends on**: Phase 2
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
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation Bootstrap and State | 3/3 | Complete | 2026-04-11 |
| 2. Router, Health, and Mapping | 0/3 | Not started | - |
| 3. Phase Discovery | 0/3 | Not started | - |
| 4. Plan, Execute, and Verify | 0/4 | Not started | - |
| 5. Roadmap and Milestones | 0/3 | Not started | - |
| 6. Capture and Lightweight Execution | 0/3 | Not started | - |
| 7. Quality and Shipping | 0/3 | Not started | - |
| 8. Workspaces and Maintenance | 0/2 | Not started | - |
