# `/blu-plan-phase` Final Unified Implementation Plan

Date: 2026-05-16

## Document Purpose

Copy-paste-ready implementation plan for upgrading `/blu-plan-phase` from a structurally sound but opaque planning workflow into an evidence-traced, quality-assessed, revision-continuous planning system. Each Task is scoped for **one agent with fresh context**. Waves group tasks for sequential or parallel execution.

Source: [plan-phase-frontier-research-and-gap-analysis.md](file:///Users/rhishi/dev/repositories/antigravity/blueprint/docs/imp/planning/plan-phase-frontier-research-and-gap-analysis.md)

## Scope And Boundaries

### What Changes

All changes in Waves 1–3 are **prompt/documentation/test only**. No `src/mcp/*` runtime code changes.

| File | Role | Change Type |
|------|------|-------------|
| `skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md` | Primary behavior contract | Major: add 6 new sections |
| `skills/blueprint-phase-planning/SKILL.md` | Skill orchestration | Add planning-specific workflow rules |
| `commands/blu-plan-phase.toml` | Command manifest | Add short local guards |
| `agents/blueprint-planner.md` | Planner subagent | Add investigation trace + handoff packet rules |
| `agents/blueprint-checker.md` | Checker subagent | Add revision tracking + convergence signal |
| `docs/commands/plan-phase.md` | Command spec | Mirror user-visible behavior changes |
| `tests/phase-planning.test.ts` | Regression tests | Add static contract assertions |

### What Does NOT Change

- No `src/mcp/*` runtime code changes
- No new MCP tools or artifact types
- No `phase.plan` JSON schema changes
- No `blueprint_command_catalog` allowlist changes
- Model-only `phase.plan` writes, strict validation, implemented-only routing all stay intact
- Existing planner/checker agent boundaries stay intact

### Architecture Recap (Context For Fresh Agents)

Blueprint is a **Gemini CLI extension**. It uses:
- **Command manifests** (`commands/blu-*.toml`) — thin user-facing entry points
- **Skills** (`skills/*/SKILL.md`) — orchestration contracts loaded by the host agent
- **Runtime contract references** (`skills/*/references/*.md`) — detailed behavior docs
- **MCP tools** (`src/mcp/tools/*.ts`) — deterministic state engine
- **Agents** (`agents/*.md`) — bounded deep-work contracts

`/blu-plan-phase` is a `long-running-mutation` command that resolves a phase, reads context/research/config/plan-index, drafts structured JSON plan models, validates and persists through MCP, runs optional checker review, validates the plan set, and updates state.

## Verification Commands

```bash
npm ci
npm test -- tests/phase-planning.test.ts
npm run typecheck
git diff --check
```

---

## Wave 1: Investigation Trace, Quality Self-Check, And Worked Examples

**Goal**: Make the planning reasoning visible and add concrete behavioral examples. Addresses gaps R1, R3, R8.

**Parallelism**: Tasks 1.1 and 1.2 can run in parallel (different sections of runtime contract). Task 1.3 sequential after both. Task 1.4 sequential after all.

---

### Task 1.1 — Add Planning Investigation Trace

**Agent scope**: Edit `skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md` — add new section `## Planning Investigation Trace` after `### Read`.

**Context to load**:
- Read the full runtime contract
- Read `docs/imp/discuss/final-unified-phase-based-plan.md` lines 225–298 (Selected Phase Read Packet + Artifact Status Classification pattern)
- Read `docs/imp/research/R1-plan.md` lines 149–228 (Investigation Trace pattern)

**What to add** — new section between `### Read` and `### Decide`:

```markdown
## Planning Investigation Trace

After completing all Read-stage MCP calls, build a session-local planning
evidence summary before drafting any plan content. This summary is working
state, not a new artifact or MCP type.

### Evidence Inventory

| Source | Status | Key Finding | Planning Impact | Confidence |
|--------|--------|-------------|-----------------|------------|

Classify each source as one of:
- `present-usable`: artifact exists with substantive authored content
- `present-scaffold`: artifact exists but contains only scaffold/seed content
- `present-invalid`: artifact exists but failed or may fail validation
- `missing`: no artifact file exists
- `disabled-by-config`: artifact gate disabled in normalized config

Required sources to classify:
- Phase context (`XX-CONTEXT.md`)
- Research (`XX-RESEARCH.md`) — only when `workflow.research=true`
- UI spec (`XX-UI-SPEC.md`) — only when `workflow.ui_phase=true`
- Validation evidence — when present
- Review findings — when present
- Existing plan inventory
- Mapped codebase summaries

### Planning Signals

Before drafting, extract and list:

1. **Locked decisions**: implementation decisions from context that constrain
   the plan and must not be reduced
2. **Requirement mapping**: which phase requirements map to which
   implementation areas and what evidence supports each mapping
3. **Evidence gaps**: where saved evidence is missing, stale, or
   insufficient for confident planning
4. **Split signals**: early indicators that the phase needs multiple plans
   (broad scope, independent features, dependency layers)
5. **Risk factors**: security exposure, external dependencies, validation
   complexity, or areas where research flagged uncertainty

### Compact Summary

Summarize in 3-5 lines: phase goal, key constraints, evidence quality,
anticipated plan count, and highest-risk planning decision.

Present this summary before any plan drafting or subagent invocation.
```

**Verification**: Runtime contract contains `Planning Investigation Trace`, `Evidence Inventory`, `Planning Signals`, and `Compact Summary`.

---

### Task 1.2 — Add Quality Self-Assessment And Semantic Self-Check

**Agent scope**: Edit `skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md` — add new section `## Planning Quality Self-Check` before `## Completion Criteria`.

**Context to load**:
- Read the full runtime contract
- Read `docs/imp/discuss/final-unified-phase-based-plan.md` lines 912–926 (Semantic Self-Check pattern)

**What to add**:

```markdown
## Planning Quality Self-Check

### Pre-Draft Readiness Assessment

Before drafting plan content, assess readiness per dimension:

| Dimension | Ready? | Evidence | Risk If Weak |
|-----------|--------|----------|--------------|
| Phase goal clarity | | | |
| Requirement completeness | | | |
| Locked decision coverage | | | |
| Evidence sufficiency | | | |
| Dependency visibility | | | |
| Verification feasibility | | | |

If any HIGH-risk dimension is not ready, document the gap as a planning
assumption or blocker before drafting. Do not silently resolve uncertainty
by omitting the requirement or weakening the plan.

### Post-Draft Semantic Self-Check

Before claiming plan completion, answer yes/no:

1. Does every task `Action` name concrete target state (functions, routes,
   schema fields, config keys, expected values) rather than vague alignment
   or wiring language?
2. Does every task `Read First` cite the actual files being modified plus
   constraining docs, schemas, interfaces, or tests?
3. Does every `Acceptance Criteria` item specify a mechanically checkable
   condition (grep string, test command, CLI output, file content)?
4. Does `requirementCoverage` account for every known phase requirement
   exactly once with concrete rationale for deferred or irrelevant items?
5. Does `evidenceCoverage` match the latest runtime-narrowed inventory
   from a fresh `blueprint_phase_plan_authoring_context` read?
6. Could `/blu-execute-phase` implement each task without asking what file,
   function, route, or test is intended?
7. Are deferred items, assumptions, and evidence gaps named in
   `unknownsAndDeferrals` rather than silently omitted?

If any answer is "no", repair the affected plan section before persistence.
```

**Verification**: Runtime contract contains `Planning Quality Self-Check`, `Pre-Draft Readiness Assessment`, and `Post-Draft Semantic Self-Check`.

---

### Task 1.3 — Add Worked Examples And Anti-Examples

**Agent scope**: Edit `skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md` — add new section `## Worked Examples And Anti-Examples` after `## Planning Quality Self-Check`.

**Context to load**:
- Read the full runtime contract
- Read `docs/imp/new-project/final-unified-phase-based-plan.md` lines 579–657 (Worked Examples pattern)

**What to add**:

```markdown
## Worked Examples And Anti-Examples

### Good: Single-Plan Phase With Research

Phase has 2 requirements, clear context, valid research. Agent reads all
evidence, builds investigation trace showing both requirements map to one
implementation area. Drafts one structured plan model with 3 tasks, validates
against task schema, persists through MCP, runs checker (ACCEPT), validates
plan set, syncs state. Final response names phase, plan id, path, gates
honored, and next safe action.

### Good: Multi-Plan Phase With Dependency Waves

Phase has 5 requirements spanning UI and backend. Agent investigation trace
identifies 2 independent feature slices plus 1 shared foundation. Drafts
3 plans: wave-1 foundation, wave-2a UI slice, wave-2b backend slice.
Re-reads authoring context after each write so saved plan files become
evidence for later slots. Checker finds one REVISE issue; agent fixes the
affected plan only, re-validates. Final plan set passes scoped validation.

### Good: Reuse Gate For Existing Plans

Phase has 2 existing plans. Agent reads plan index and plan bodies. New
context does not change the first plan but invalidates the second. Agent
uses `ask_user` for reuse/revise/replace: user chooses "revise plan 02".
Agent drafts revised model for plan 02 only, preserving plan 01.

### Good: Config-Disabled Research Skip

`workflow.research=false` in effective config. Agent reads config, reports
"Research was skipped because normalized config disabled it." Proceeds to
plan without blocking on missing research artifact.

### Good: Planning Readiness Block

`planningReadiness.readyForPlanPhase=false` with blocker "missing usable
context". Agent stops before drafting, reports the blocker and routes to
`/blu-discuss-phase <phase>`. No plan files written.

### Anti-Example: Skipping Investigation Trace

Bad: Reading all MCP sources then immediately drafting a plan model without
summarizing what was found.
Correct: Building the evidence inventory and planning signals summary before
any drafting.

### Anti-Example: Markdown Fallback After Validation Failure

Bad: `blueprint_phase_plan_validate_model` returns invalid diagnostics.
Agent writes raw `.blueprint/` Markdown file to bypass validation.
Correct: Repairing diagnostics against the live task schema, retrying through
`blueprint_phase_plan_write`, stopping if identical diagnostics repeat.

### Anti-Example: Ignoring Evidence Coverage Refresh

Bad: Writing plan 01, then writing plan 02 without re-reading
`blueprint_phase_plan_authoring_context`. Plan 02's `evidenceCoverage`
misses the newly saved plan 01 file.
Correct: Re-reading authoring context immediately before each model
validation/write.

### Anti-Example: Scope Reduction Language

Bad: Task action says "Add a simplified v1 authentication flow for now."
Correct: Task action says "Add JWT-based authentication with refresh token
rotation per the auth-contract decision in XX-CONTEXT.md."

### Anti-Example: Vague Acceptance Criteria

Bad: "Authentication is properly configured and working."
Correct: "`npm test -- tests/auth.test.ts` passes; `grep -r 'refreshToken'
src/auth/` returns the rotation handler; `.env.example` contains
`JWT_SECRET` and `JWT_REFRESH_EXPIRY`."

### Anti-Example: Unbounded Checker Loop

Bad: Checker returns REVISE three times with the same issue. Agent keeps
retrying without tracking convergence.
Correct: After 3 passes with the same blocker, agent stops, preserves the
best draft, reports the exact unresolved issue, and routes to `/blu-progress`.
```

**Verification**: Runtime contract contains `Worked Examples And Anti-Examples` with at least 5 good and 6 anti-examples.

---

### Task 1.4 — Add Regression Tests For Wave 1 Anchors

**Agent scope**: Create `tests/phase-planning-contract.test.ts`.

**Context to load**:
- Read existing test patterns in `tests/phase-discovery-discuss.test.ts`
- Read the completed Wave 1 runtime contract changes

**Tests to add** (using `node:test` runner, `fs.readFileSync`, `assert.match`):

1. `planning contract defines investigation trace` — assert contract contains `Planning Investigation Trace`, `Evidence Inventory`, `Planning Signals`, `present-usable`, `present-scaffold`, `missing`, `disabled-by-config`
2. `planning contract defines pre-draft readiness` — assert contract contains `Pre-Draft Readiness Assessment`, `Phase goal clarity`, `Evidence sufficiency`
3. `planning contract defines semantic self-check` — assert contract contains `Post-Draft Semantic Self-Check`, 7 yes/no items
4. `planning contract has worked examples` — assert contract contains `Worked Examples And Anti-Examples`, `Single-Plan Phase`, `Multi-Plan Phase`, `Reuse Gate`, `Anti-Example: Markdown Fallback`
5. `planning contract preserves existing completion criteria` — assert existing completion criteria text still present

**Verification**: `npm test -- tests/phase-planning-contract.test.ts`

---

## Wave 2: Planning Decision Record, Agent Handoff Packets, Split Framework

**Goal**: Add structured reasoning aids for plan decisions and agent interactions. Addresses gaps R2, R4, R5, R9.

**Parallelism**: Tasks 2.1 and 2.2 can run in parallel (different sections). Task 2.3 edits agent files independently. Task 2.4 sequential after all.

---

### Task 2.1 — Add Planning Decision Record

**Agent scope**: Edit runtime contract — add `## Planning Decision Record` after `## Planning Investigation Trace`.

**What to add**:

```markdown
## Planning Decision Record

Maintain a session-local record of planning decisions that persist across
revision passes. This is working state, not a new artifact.

For each non-trivial planning decision, record:

- `decision`: what was decided (split strategy, wave ordering, requirement
  deferral, dependency direction, vertical vs horizontal slice)
- `rationale`: why this choice over alternatives
- `evidence`: which investigation trace source supported this decision
- `alternatives`: what was considered and rejected
- `risk`: what could invalidate this decision
- `revision-stable`: whether this decision should survive a targeted
  revision pass (yes by default; no only when the checker found it unsound)

### Carry-Forward Between Revision Passes

When the checker returns REVISE, carry the decision record forward so the
revision pass can:
1. Preserve decisions marked `revision-stable: yes`
2. Revise only decisions the checker found unsound
3. Avoid re-deriving decisions that were already validated

### Fold Into Plan Artifacts

Before final model validation and write, fold unresolved decisions into the plan's
`unknownsAndDeferrals` section. Fold rejected alternatives into `scope`
when they clarify what the plan intentionally excludes.
```

**Verification**: Contract contains `Planning Decision Record`, `revision-stable`, `Carry-Forward Between Revision Passes`.

---

### Task 2.2 — Add Split Decision Framework

**Agent scope**: Edit runtime contract — add `## Plan Complexity And Split Framework` after `## Artifact Authoring Rules`.

**What to add**:

```markdown
## Plan Complexity And Split Framework

### Complexity Signals

Evaluate these signals before and during drafting:

| Signal | Threshold | Action |
|--------|-----------|--------|
| Tasks per plan | >3 | Consider split |
| Files modified per plan | >8 | Consider split |
| Files per task | >5 | Split the task or plan |
| Independent features | >1 | Prefer vertical slice split |
| Dependency layers | >2 | Consider horizontal foundation plan |
| Requirement groups | >2 unrelated | Split by requirement group |
| Risk concentration | 1 task has all risk | Isolate risky task in its own plan |

### Split Axes (ordered by preference)

1. **By feature/vertical slice**: when independent features can run and
   validate in parallel without shared state
2. **By requirement group**: when requirements cluster into distinct
   implementation areas with different verification strategies
3. **By dependency layer**: when a shared foundation must be proven before
   dependent features can start (use sparingly)
4. **By risk boundary**: when one area has disproportionate uncertainty,
   security exposure, or external dependency

### Minimum Viable Plan

A plan is too small to be useful when it:
- Has only 1 trivial task that could be a subtask of another plan
- Creates no verifiable artifact or behavior change
- Cannot be validated independently

When a split would produce a below-minimum plan, merge it back into its
nearest dependency neighbor.

### Split Rationale In Output

When splitting, include in the planning decision record:
- Why this split axis was chosen over alternatives
- What dependency exists between the resulting plans
- What the execution order constraint is
- What would trigger a re-merge if evidence changes
```

**Verification**: Contract contains `Plan Complexity And Split Framework`, `Split Axes`, `Minimum Viable Plan`.

---

### Task 2.3 — Add Typed Handoff Packets To Agent Contracts

**Agent scope**: Edit `agents/blueprint-planner.md` and `agents/blueprint-checker.md`.

**What to add in `blueprint-planner.md`** — after `## Required Reads`, add:

```markdown
## Expected Handoff Packet From Parent

The parent command should supply a structured planning packet:

- `phase`: resolved phase number and directory
- `contract`: live `phase.plan` JSON schema and authoring template
- `taskSchema`: runtime-narrowed task schema from authoring context
- `context`: actual `XX-CONTEXT.md` content (not status metadata)
- `research`: actual research content when `workflow.research=true`
- `uiSpec`: actual UI spec content when `workflow.ui_phase=true`
- `validation`: saved verification evidence when present
- `reviewFindings`: saved review findings when present
- `config`: normalized effective config with gate states
- `codebase`: mapped codebase summaries when present
- `existingPlans`: plan index + plan bodies when revising
- `checkerFindings`: current checker findings during revision pass
- `investigationTrace`: the parent's planning evidence summary
- `decisionRecord`: the parent's planning decision record (revision passes)

The planner should cite which packet fields shaped each plan decision.
```

**What to add in `blueprint-checker.md`** — after `## Required Reads`, add:

```markdown
## Expected Handoff Packet From Parent

The parent command should supply:

- `phase`: resolved phase number and directory
- `taskSchema`: runtime-narrowed task schema from authoring context
- `planBodies`: saved `-PLAN.md` content under review (not summaries)
- `context`: actual `XX-CONTEXT.md` content
- `research`: actual research content when gates enabled
- `config`: normalized effective config
- `codebase`: mapped codebase summaries when present
- `priorFindings`: findings from previous checker pass (revision loops)
- `investigationTrace`: the parent's planning evidence summary

## Revision Tracking

When reviewing a revision pass, compare against `priorFindings`:
- `resolved`: issue no longer present in revised plan
- `recurring`: same issue appears again (convergence risk)
- `new`: issue not in prior findings
- `regressed`: previously resolved issue reappeared

Report convergence status: issues decreasing (converging), stalling
(same count), or increasing (diverging). Recommend stop after 3 passes
if stalling or diverging.
```

**Verification**: Both agent files contain `Expected Handoff Packet From Parent`.

---

### Task 2.4 — Add Regression Tests For Wave 2

**Agent scope**: Edit `tests/phase-planning-contract.test.ts`.

**Tests to add**:

1. `planning contract defines decision record` — assert `Planning Decision Record`, `revision-stable`, `Carry-Forward`
2. `planning contract defines split framework` — assert `Plan Complexity And Split Framework`, `Split Axes`, `Minimum Viable Plan`
3. `planner agent defines handoff packet` — assert `Expected Handoff Packet From Parent`, `investigationTrace`, `decisionRecord`
4. `checker agent defines revision tracking` — assert `Revision Tracking`, `resolved`, `recurring`, `convergence status`

**Verification**: `npm test -- tests/phase-planning-contract.test.ts`

---

## Wave 3: Downstream Handoff, Skill Updates, Manifest Guards, Command Spec

**Goal**: Add execution handoff, update the skill and manifest, align the command spec. Addresses gaps R5, R6, R7, R10.

**Parallelism**: Tasks 3.1 and 3.2 can run in parallel. Task 3.3 and 3.4 sequential after.

---

### Task 3.1 — Add Downstream Execution Handoff And Stale Evidence Rule

**Agent scope**: Edit runtime contract — add `## Downstream Execution Handoff` after `### Route`, and add stale evidence rule to `### Read`.

**What to add for handoff**:

```markdown
## Downstream Execution Handoff

Before final routing, derive a compact execution handoff from the planning
session. Include it in the final response as structured prose:

- `planSummary`: plan count, wave structure, total tasks, key files
- `executionOrder`: which plans run first and why
- `evidenceGaps`: evidence that was missing or uncertain during planning;
  executor should verify these early
- `assumptions`: planning assumptions that execution should validate
- `verificationPriorities`: which acceptance criteria are highest-risk
  and should be checked first
- `deferredItems`: requirements or ideas deferred from this planning pass
  with rationale
- `knownRisks`: risk factors from the investigation trace that execution
  should monitor

Do not create a new artifact. Include the handoff substance in the final
response and in `unknownsAndDeferrals` where appropriate.
```

**What to add for stale evidence** — in `### Read`, after the minimum read order:

```markdown
### Read-Set Staleness Check

Record the key evidence paths read during the planning session:
- `XX-CONTEXT.md` path
- `XX-RESEARCH.md` path (when read)
- `XX-UI-SPEC.md` path (when read)
- Plan index state (plan count and ids)

Before final persistence, compare against the current filesystem. If any
key evidence file was modified after the planning session started, warn
before writing and suggest re-reading the changed artifact. This is a
warning, not a hard block.
```

**Verification**: Contract contains `Downstream Execution Handoff`, `Read-Set Staleness Check`.

---

### Task 3.2 — Strengthen No-Subagent Fallback

**Agent scope**: Edit runtime contract — update `## No-Subagent Fallback`.

**What to change**: Replace the current 7-step fallback with an enhanced version that incorporates investigation trace, decision record, and quality self-check:

```markdown
## No-Subagent Fallback

When planner/checker agents are unavailable, continue with the same plan
quality, evidence coverage, and review bar expected from the bounded
subagent path.

1. Build the Planning Investigation Trace from the read context: evidence
   inventory, planning signals, and compact summary.
2. Build the Pre-Draft Readiness Assessment. If any HIGH-risk dimension is
   not ready, document it as a planning assumption or blocker.
3. Draft one structured plan model at a time from the live runtime-narrowed
   task schema. Start a Planning Decision Record for non-trivial decisions.
4. Run the inline quality checklist with priority ordering:
   a. Requirement coverage completeness (BLOCKER if gaps)
   b. Locked decision fidelity (BLOCKER if reduced)
   c. Task action specificity (BLOCKER if vague)
   d. Acceptance criteria verifiability (BLOCKER if subjective)
   e. Dependency correctness (WARNING if unclear)
   f. Scope sanity and split signals (WARNING if thresholds exceeded)
   g. Evidence coverage match (WARNING if stale)
   h. Must-have derivation quality (WARNING if chore-only)
5. Compress the completed plan into the carry-forward note with plan ids,
   requirement coverage decisions, evidence used, remaining blockers, and
   what the next wave can assume.
6. Persist only after the current plan passes the inline checklist with
   no BLOCKER items.
7. Move to the next dependency wave only after summarizing what was
   written and what evidence still carries forward.
8. If the inline checklist finds a blocker, repair the affected plan
   before drafting more plans.
9. Run the Post-Draft Semantic Self-Check before claiming completion.
```

**Verification**: No-subagent fallback contains 9 steps and references investigation trace, decision record, and quality self-check.

---

### Task 3.3 — Update Skill And Command Manifest

**Agent scope**: Edit `skills/blueprint-phase-planning/SKILL.md` and `commands/blu-plan-phase.toml`.

**What to add in SKILL.md** — after existing workflow rule 4 (about planningReadiness):

```markdown
5. Before drafting any plan content, build the Planning Investigation
   Trace from the runtime contract: evidence inventory, planning signals,
   and compact summary. Present this summary before subagent invocation or
   inline drafting.
6. After final persistence, run the Post-Draft Semantic Self-Check from
   the runtime contract. If any answer is "no", repair the affected plan
   section before claiming completion.
7. When splitting a phase into multiple plans, record the split rationale
   in a session-local Planning Decision Record. Carry this record forward
   across revision passes so the checker can distinguish stable decisions
   from unsound ones.
```

Renumber subsequent items.

**What to add in manifest** — after existing investigation trace mention:

```
- Before drafting plan content, build the Planning Investigation Trace and Pre-Draft Readiness Assessment from the runtime contract. Present the compact evidence summary before subagent invocation or inline drafting.
- After final persistence, run the Post-Draft Semantic Self-Check. If any answer is "no", repair the affected plan section before claiming completion.
```

**Verification**: Skill and manifest reference investigation trace and quality self-check.

---

### Task 3.4 — Update Command Spec And Final Regression Tests

**Agent scope**: Edit `docs/commands/plan-phase.md` and `tests/phase-planning-contract.test.ts`.

**What to update in command spec**:

1. In `## Purpose`: Add "with visible evidence tracing and quality self-assessment"
2. In `## Acceptance Criteria`: Add "Builds a Planning Investigation Trace before drafting", "Runs Post-Draft Semantic Self-Check before claiming completion", "Includes a compact downstream execution handoff in the final response"
3. In `## Test Cases`: Add "Investigation trace visibility fixture", "Quality self-check enforcement fixture", "Multi-plan split rationale fixture"

**Tests to add**:

1. `planning contract defines downstream handoff` — assert `Downstream Execution Handoff`, `executionOrder`, `evidenceGaps`
2. `planning contract defines staleness check` — assert `Read-Set Staleness Check`
3. `no-subagent fallback references investigation trace` — assert fallback section contains `Planning Investigation Trace`, `Pre-Draft Readiness`, `Post-Draft Semantic Self-Check`
4. `skill references investigation trace` — assert SKILL.md contains `Planning Investigation Trace`
5. `manifest references quality self-check` — assert manifest contains `Post-Draft Semantic Self-Check`
6. `command spec mentions investigation trace` — assert spec contains `Investigation Trace`

**Verification**: All tests pass. `npm run typecheck` clean.

---

## Task Dependency Graph

```
Wave 1 (parallel core, sequential finish):
  1.1 Investigation trace ─┐
                            ├──→ 1.3 Worked examples ──→ 1.4 Tests
  1.2 Quality self-check  ─┘

Wave 2 (parallel core, sequential finish):
  2.1 Decision record     ─┐
  2.2 Split framework      ├──→ 2.4 Tests
  2.3 Agent handoff packets┘

Wave 3 (parallel core, sequential finish):
  3.1 Downstream handoff ──┐
                            ├──→ 3.3 Skill/manifest ──→ 3.4 Spec/tests
  3.2 Fallback depth     ──┘
```

## Test Coverage Map

| Test # | Assertion Target | Passes After |
|--------|-----------------|-------------|
| 1 | Investigation trace | Task 1.1 |
| 2 | Pre-draft readiness | Task 1.2 |
| 3 | Semantic self-check | Task 1.2 |
| 4 | Worked examples | Task 1.3 |
| 5 | Existing completion criteria | Task 1.4 |
| 6 | Decision record | Task 2.1 |
| 7 | Split framework | Task 2.2 |
| 8 | Planner handoff packet | Task 2.3 |
| 9 | Checker revision tracking | Task 2.3 |
| 10 | Downstream handoff | Task 3.1 |
| 11 | Staleness check | Task 3.1 |
| 12 | Enhanced fallback | Task 3.2 |
| 13 | Skill references | Task 3.3 |
| 14 | Manifest references | Task 3.3 |
| 15 | Command spec alignment | Task 3.4 |

## Risks And Mitigations

| Risk | Mitigation |
|------|-----------:|
| Contract becomes too long | Use labeled blocks, keep examples in reference only, test anchors not paragraphs |
| Investigation trace adds latency | Keep it compact (5 lines), not a full analysis |
| Decision record feels bureaucratic | Only for non-trivial decisions; trivial plans skip it |
| Split framework is too prescriptive | Provide axes and signals, not rigid rules |
| Worked examples become stale | Tie to test anchors so drift is caught |

## Definition Of Done

- [ ] Runtime contract has 6 new sections: Investigation Trace, Quality Self-Check, Worked Examples, Decision Record, Split Framework, Downstream Handoff
- [ ] Planner and checker agents have typed handoff packet shapes and revision tracking
- [ ] No-subagent fallback references all new quality aids
- [ ] Skill and manifest reference investigation trace and quality self-check
- [ ] Command spec acceptance criteria updated
- [ ] 15 regression test assertions pass
- [ ] No existing contract behavior is removed or weakened
- [ ] `npm ci && npm test -- tests/phase-planning-contract.test.ts && npm run typecheck && git diff --check` all pass
