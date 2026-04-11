# Requirements: Blueprint

**Defined:** 2026-04-10
**Core Value:** A Gemini user can get from ambiguous work to a trustworthy next step through explicit commands, durable artifacts, and deterministic state.

## v1 Requirements

### Foundation

- [x] **FND-01**: Developer can install Blueprint from GitHub as a Gemini extension and load the extension successfully
- [x] **FND-02**: User can invoke the root `/blu` router and direct `/blu:<command>` entrypoints without relying on slash-command chaining
- [x] **FND-03**: User can run `/blu:new-project` to create deterministic `.blueprint/PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, and normalized config for a fresh repo
- [x] **FND-04**: User can change Blueprint repo settings and model profile without manually editing raw JSON
- [x] **FND-05**: User can ask Blueprint for help, progress, and health and get next-step guidance from the current repo state
- [x] **FND-06**: User can map an existing codebase into stable `.blueprint/codebase/` artifacts before planning brownfield work

### Drift Repair

- [x] **DRIFT-01**: Control docs, handoff docs, and implementation state describe the actual shipped Wave 0 runtime
- [x] **DRIFT-02**: `/blu`, `help`, and `progress` only surface commands whose manifests, primary skills, and required MCP tools exist
- [x] **DRIFT-03**: Shipped Wave 0 skills and agent contracts exist in the runtime, and `map-codebase` owns the seven-document bundle including `STRUCTURE.md`
- [x] **DRIFT-04**: Later commands stay blocked until their missing roadmap and phase substrate exists
- [x] **DRIFT-05**: Future retained command docs preserve thin-command, skill-led, agent-explicit, MCP-owned architecture
- [x] **DRIFT-06**: Command metadata stays consistent across the catalog, skills inventory, migration matrix, and per-command specs
- [x] **DRIFT-07**: Regression tests catch control-plane and contract drift before later phases proceed

### Lifecycle

- [ ] **LIFE-01**: User can capture phase context and discussion decisions as durable phase artifacts
- [ ] **LIFE-02**: User can run targeted phase research when technical uncertainty exists
- [ ] **LIFE-03**: User can generate a UI spec or explicit UI-skip rationale for frontend-heavy phases
- [ ] **LIFE-04**: User can create phase plans that map requirements to executable work and pass plan checks
- [ ] **LIFE-05**: User can execute approved plans and persist summaries of what changed
- [ ] **LIFE-06**: User can validate implementation results and capture UAT evidence before a phase is treated as complete
- [ ] **LIFE-07**: User can pause, resume, and route to the next safe workflow step from current state

### Roadmap And Milestones

- [ ] **ROAD-01**: User can add, insert, and remove phases while keeping roadmap references and phase directories synchronized
- [ ] **ROAD-02**: User can surface phase assumptions and plan milestone gaps against the active roadmap
- [ ] **ROAD-03**: User can audit a milestone, complete it, summarize it, and start the next milestone without losing traceability

### Capture And Lightweight Execution

- [ ] **CAP-01**: User can capture notes, todos, and backlog items inside `.blueprint/`
- [ ] **CAP-02**: User can review backlog items and promote approved work into the roadmap
- [ ] **CAP-03**: User can use `fast`, `quick`, `do`, `explore`, and `debug` flows without bypassing state or safety rules

### Quality And Shipping

- [ ] **QUAL-01**: User can run code review, review-fix, audit-fix, and peer review with durable artifacts
- [ ] **QUAL-02**: User can run docs updates, security review, UI review, and test-addition flows that integrate with phase evidence
- [ ] **QUAL-03**: User can prepare PR branches, ship, and undo with explicit confirmations and graceful handling of missing external tools

### Workspaces And Maintenance

- [ ] **OPS-01**: User can create and remove workspaces using the global workspace registry and default workspace root
- [ ] **OPS-02**: User can manage workstreams locally and run cleanup, update, and reapply-patches within locked mutation boundaries

## v2 Requirements

### Deferred Reconsideration

- **FUTR-01**: Revisit omitted or additional command surfaces only after the retained Blueprint v1 command set is executable and stable
- **FUTR-02**: Revisit richer analytics and reporting only after `progress`, `health`, and milestone summaries have proven useful in real use

## Out of Scope

| Feature | Reason |
|---------|--------|
| `.planning/` as Blueprint runtime state | `.planning/` is only the local GSD workspace for building Blueprint; product repos must still use `.blueprint/` |
| Hidden aliases for omitted GSD commands | The retained Blueprint command contract is intentionally strict in v1 |
| Extension self-update or installed-extension mutation | Locked out by Blueprint architecture and safety decisions |
| Hook-owned state transitions | Hooks are advisory, not the source of truth |
| Literal file-for-file GSD port | Blueprint is a Gemini-native redesign |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Complete |
| FND-02 | Phase 1 | Complete |
| FND-03 | Phase 1 | Complete |
| FND-04 | Phase 2 | Complete |
| FND-05 | Phase 2 | Complete |
| FND-06 | Phase 2 | Complete |
| DRIFT-01 | Phase 2.1 | Complete |
| DRIFT-02 | Phase 2.1 | Complete |
| DRIFT-03 | Phase 2.1 | Complete |
| DRIFT-04 | Phase 2.1 | Complete |
| DRIFT-05 | Phase 2.2 | Complete |
| DRIFT-06 | Phase 2.2 | Complete |
| DRIFT-07 | Phase 2.2 | Complete |
| LIFE-01 | Phase 3 | Pending |
| LIFE-02 | Phase 3 | Pending |
| LIFE-03 | Phase 3 | Pending |
| LIFE-04 | Phase 4 | Pending |
| LIFE-05 | Phase 4 | Pending |
| LIFE-06 | Phase 4 | Pending |
| LIFE-07 | Phase 4 | Pending |
| ROAD-01 | Phase 5 | Pending |
| ROAD-02 | Phase 5 | Pending |
| ROAD-03 | Phase 5 | Pending |
| CAP-01 | Phase 6 | Pending |
| CAP-02 | Phase 6 | Pending |
| CAP-03 | Phase 6 | Pending |
| QUAL-01 | Phase 7 | Pending |
| QUAL-02 | Phase 7 | Pending |
| QUAL-03 | Phase 7 | Pending |
| OPS-01 | Phase 8 | Pending |
| OPS-02 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-04-11 after Phase 2.2 closure verification*
