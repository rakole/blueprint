# `/blu-plan-phase` Frontier Research And Gap Analysis

Date: 2026-05-16

## Document Purpose

This report analyzes the current `/blu-plan-phase` workflow against frontier research in AI-assisted software planning, patterns from sibling Blueprint improvement reports, and concrete usage evidence from the existing runtime contract, skill, command manifest, and agent contracts. It identifies gaps, improvement opportunities, and risk areas that drive a subsequent implementation plan.

## Source Documents Analyzed

### Blueprint Workflow Files

- `commands/blu-plan-phase.toml` — command manifest (54 lines)
- `skills/blueprint-phase-planning/SKILL.md` — skill orchestration contract (115 lines)
- `skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md` — detailed runtime behavior contract (313 lines)
- `agents/blueprint-planner.md` — planner subagent contract (174 lines)
- `agents/blueprint-checker.md` — checker subagent contract (187 lines)
- `docs/commands/plan-phase.md` — command spec (194 lines)

### Sibling Improvement Reports

- `docs/imp/discuss/final-unified-phase-based-plan.md` — discuss-phase improvements
- `docs/imp/new-project/final-unified-phase-based-plan.md` — new-project improvements
- `docs/imp/new-milestone/final-unified-phase-based-plan.md` — milestone/phase-admin improvements
- `docs/imp/research/R1-plan.md` through `R8-plan.md` — research-phase improvements
- `docs/imp/research/reviews.md` — MCP review findings

### Frontier Research

- AI-assisted plan decomposition and task splitting quality verification (2025-2026)
- Agentic code planning verification loops, hallucination grounding, and requirement traceability
- Evidence-backed implementation plan generation quality metrics

---

## Current Workflow Summary

### What `/blu-plan-phase` Does Today

`/blu-plan-phase` is a `long-running-mutation` command that:

1. **Resolves** the target phase via `blueprint_phase_locate`
2. **Reads** the phase.plan contract, authoring context with runtime-narrowed task schema, phase context (XX-CONTEXT.md), research status with planningReadiness gate, discovery artifacts, validation/review evidence, plan index, effective config, and current state
3. **Decides** through config-gated research/UI/plan-check gates, planning readiness handoff, and reuse/revise/replace decisions for existing plans
4. **Executes** by drafting structured `phase.plan` JSON models via optional `blueprint-planner` subagent or inline fallback, with optional `blueprint-checker` review when `workflow.plan_check=true`
5. **Persists** through `blueprint_phase_plan_validate_model` then `blueprint_phase_plan_write` with `validationMode: "strict"` and `authoringMode: "model-only"`
6. **Validates** via `blueprint_phase_plan_validate` for scoped plan-set drift, dependency issues, and coverage gaps
7. **Routes** by updating STATE.md via synced state update and naming the next safe implemented action

### Key Strengths

| Area | Current Strength |
|------|-----------------|
| Schema enforcement | Structured JSON model validated against live task schema before write |
| Requirement coverage | Exhaustive ledger: every phase requirement is `covered`, `deferred`, or `irrelevant` |
| Evidence coverage | Runtime-narrowed evidence inventory dynamically updated after each plan write |
| Config gating | Research, UI, UI safety, and plan-check gates are all config-driven |
| Anti-shallow rules | Explicit rejection of vague action text, placeholder language, and scope reduction |
| Persistence safety | MCP-owned writes with strict validation; no raw file edits |
| Revision control | Reuse/revise/replace gate with explicit user confirmation for existing plans |
| Subagent boundaries | Clear parent-owns-persistence, planner-returns-models contract |

---

## Gap Analysis

### R1: Investigation Trace And Evidence Provenance Gap

**Problem:** The current plan-phase workflow reads a large number of MCP data sources (context, research, validation, review findings, plan index, authoring context, config, state) but has no structured mechanism for the planning agent to show *what it read*, *what it found*, and *how each source influenced the plan*. The planner jumps from "read everything" to "draft plan" without visible intermediate reasoning.

**Evidence:**
- The runtime contract has a dense `### Read` section listing 12+ MCP calls but no guidance on summarizing findings before drafting
- The planner agent contract says "Required Reads" but has no investigation trace or evidence summary output
- Sibling discuss-phase improvements added a `Selected Phase Read Packet`, `Artifact Status Classification`, and intermediate summary before questioning
- Sibling research-phase R1 improvements added an `Investigation Trace`, `Navigation Evidence Packet`, and per-strand `Planning Handoff`

**Impact:** Without visible investigation trace, it is difficult to audit *why* a plan was structured the way it was, *which evidence was weighted*, and *where uncertainty was silently resolved*. Downstream validation and checker review cannot trace plan decisions back to specific evidence sources.

**Decision value:** HIGH — affects plan quality, auditability, and revision accuracy.

---

### R2: Planning Decision Record Gap

**Problem:** The current workflow captures *what* was planned but not *why* specific planning decisions were made. When the planner splits a phase into multiple plans, chooses wave ordering, defers requirements, or selects a vertical vs. horizontal slice, the rationale is ephemeral — it lives in the chat transcript but not in any structured form.

**Evidence:**
- The planner agent outputs "split/prioritization rationale" and "dependency-wave and sequencing notes" but these are freeform prose in the chat, not structured fields
- The checker agent reviews against dimensions but its findings are also ephemeral
- Sibling new-milestone improvements introduced a `New Milestone Transition Packet` with structured `requirementTransitions`, `evidenceLedger`, and claim-level source refs
- Sibling discuss-phase improvements added a `grayAreaQueue` with `decisionValue`, `resolutionCriterion`, and `downstreamImpact` per area

**Impact:** When a plan needs revision (via checker, user feedback, or changed context), the agent has no structured record of why previous decisions were made, leading to potential regression or unnecessary full replanning.

**Decision value:** HIGH — directly affects revision loop quality and planning continuity.

---

### R3: Plan Quality Self-Assessment Gap

**Problem:** The current checker loop is binary (ACCEPT/REVISE/BLOCK) and focuses on structural compliance. There is no structured pre-draft quality assessment or post-draft self-evaluation against planning-specific quality dimensions beyond the checker's 13 review dimensions.

**Evidence:**
- The checker contract has 13 dimensions but no weighting or severity classification
- The inline fallback checklist (when checker is unavailable) is a flat list without priority ordering
- Sibling discuss-phase improvements added a `Context Model Readiness` ledger (field / source basis / confidence / unresolved risk / downstream consumer)
- Sibling discuss-phase improvements added a `Semantic Self-Check` with 5 concrete yes/no questions before claiming success
- Frontier research emphasizes "Plan-Execute-Verify" loops with explicit quality gates at each step, not just a binary pass/fail at the end

**Impact:** Without graduated quality assessment, plans can pass structural validation but fail on planning-specific quality: weak action specificity, thin evidence grounding, implicit dependencies, or unchallenged assumptions.

**Decision value:** HIGH — the difference between structurally valid and execution-ready plans.

---

### R4: Planner/Checker Handoff Packet Gap

**Problem:** The current planner and checker agent contracts describe what they need as input and what they produce as output, but there is no typed handoff packet shape between the parent command, planner, and checker. The parent must manually assemble context for each agent call.

**Evidence:**
- The planner says "Required Reads" lists 10 items but no structured packet shape
- The checker says "Required Reads" lists 7 items but no structured packet shape
- Sibling new-milestone improvements defined `NewMilestoneRoadmapperPacket` with typed fields for digest scope, constraints, forbidden actions, and expected output shape
- Sibling new-project improvements added explicit "Optional-Agent Decision Record" and three-gate invocation checks
- Frontier research emphasizes that typed handoff packets between orchestrator and worker agents reduce hallucination and improve output consistency

**Impact:** Without typed handoff packets, agent calls are ad-hoc, increasing the risk of missing context, inconsistent evidence bundles, and wasted agent turns on context assembly.

**Decision value:** MEDIUM — improves reliability and reduces agent turn waste.

---

### R5: No-Subagent Fallback Depth Gap

**Problem:** The no-subagent fallback is well-structured (7 steps) but lacks the depth of the sibling improvements. It does not include an investigation trace, planning decision record, or graduated quality assessment when running inline.

**Evidence:**
- Current fallback: "Compress read context / Draft one model at a time / Run inline checklist / Compress carry-forward / Persist / Move to next wave / Repair blockers"
- The inline checklist covers 8 items but is flat and unprioritized
- Sibling research-phase R1 improved the no-subagent fallback with evidence ladder, navigation evidence packets, and strand planning handoffs
- Sibling discuss-phase improvements added per-area carry-forward packets and deterministic resume ordering

**Impact:** The inline fallback produces structurally valid but potentially shallower plans than the subagent path, creating a quality gap between the two execution modes.

**Decision value:** MEDIUM — affects plan quality when subagents are unavailable.

---

### R6: Plan-to-Execution Handoff Gap

**Problem:** After plan persistence, the command routes to the next safe action (typically `/blu-execute-phase`) but provides no structured handoff packet summarizing what the execution agent needs to know about planning decisions, evidence gaps, deferred items, and verification expectations.

**Evidence:**
- Current final response: "phase, config gates, whether plans were added/revised/replaced, checker behavior, warnings, and next safe action"
- Sibling discuss-phase improvements added a `Downstream Handoff Packet` with `researchBrief`, `uiBrief`, `planBrief`, `planInventory`, and `routingGates`
- The saved plan files contain full structured content, but there is no compact execution-oriented summary

**Impact:** The execution agent must re-read all plan files and context to understand what was planned and why, losing the planning agent's contextual understanding of evidence gaps, assumptions, and verification priorities.

**Decision value:** MEDIUM — affects execution quality and context transfer.

---

### R7: Stale Evidence Detection Gap

**Problem:** The runtime contract re-reads authoring context before each plan write (to pick up newly saved plan files as evidence), but there is no general staleness detection for other evidence sources that may have changed between the planning start and plan persistence.

**Evidence:**
- The contract says "Re-read `blueprint_phase_plan_authoring_context` immediately before each model validation/write" but this is narrow to plan-file evidence
- No staleness check for context, research, UI-spec, or review findings that may have been modified by concurrent processes
- Sibling discuss-phase checkpoint improvements added a `readSet` with path plus fingerprint for stale-input detection on resume

**Impact:** If context or research changes between the planning read and the plan write (e.g., a parallel discuss-phase run updates context), the plan could be written against stale evidence without detection.

**Decision value:** LOW — concurrent modification is rare but not impossible.

---

### R8: Worked Examples And Anti-Examples Gap

**Problem:** The runtime contract is dense and prescriptive but lacks concrete examples of good and bad planning behavior. An agent reading the contract for the first time has no worked examples to anchor the rules.

**Evidence:**
- 313 lines of contract text with zero worked examples or anti-examples
- Sibling new-project improvements added 7 good examples and 7 anti-examples in a dedicated section
- Sibling discuss-phase improvements added anti-generic-question rules with specific bad/good question pairs
- Frontier research emphasizes that worked examples significantly improve agent task success rates and reduce hallucination

**Impact:** Agents may misinterpret complex rules (like the reuse/revise/replace gate, the evidence coverage dynamic refresh, or the strict validation retry behavior) without concrete examples.

**Decision value:** MEDIUM — affects agent comprehension and first-run correctness.

---

### R9: Plan Complexity Budget And Split Signals Gap

**Problem:** The current contract has split signals ("4 tasks is a warning; 5+ tasks or 8+ files trigger split review") but no structured complexity budget or split-decision framework.

**Evidence:**
- Current: a single paragraph with numeric thresholds
- No guidance on *how* to split (which axis: by feature, by layer, by risk, by dependency?)
- No guidance on *when* to stop splitting (minimum viable plan size)
- Frontier research on task decomposition emphasizes utility-aware decomposition where agents reason about the "cost" of different split strategies

**Impact:** Agents tend to either over-split (creating many trivially small plans) or under-split (creating monolithic plans), both reducing execution quality.

**Decision value:** MEDIUM — affects plan set coherence and execution efficiency.

---

### R10: Checker Revision Loop Observability Gap

**Problem:** The checker loop is bounded to 3 passes, but there is no structured way to track what changed between revisions, whether the same issues recur, or whether the revision trajectory is converging.

**Evidence:**
- Current: "up to three checker passes; after that, report unresolved issues"
- No revision diff tracking between passes
- No convergence signal (are issues decreasing? stalling? oscillating?)
- Sibling discuss-phase improvements added deterministic area state tracking (unseen / questioning / assumed / decided / blocked / needs-revisit) so progress is measurable

**Impact:** Without convergence tracking, the agent may waste turns on oscillating revisions or give up prematurely when a targeted fix would close the loop.

**Decision value:** MEDIUM — affects revision loop efficiency and outcome quality.

---

## Frontier Research Synthesis

### Theme A: Visible Investigation And Evidence Tracing

Modern AI planning workflows demand visible intermediate reasoning between evidence gathering and plan generation. The industry consensus is that agents should show their work — not just for auditability, but because visible investigation traces improve plan quality by forcing structured evidence evaluation before drafting.

**Blueprint applicability:** Add a structured investigation summary between the Read and Execute stages, similar to the discuss-phase's read packet and the research-phase's investigation trace.

### Theme B: Typed Agent Handoff Packets

The orchestrator-worker pattern requires typed handoff packets that prevent context loss between parent command and subagents. Untyped handoffs are a documented source of hallucination and wasted agent turns in production agentic systems.

**Blueprint applicability:** Define explicit `PlannerHandoffPacket` and `CheckerHandoffPacket` shapes in the skill/contract, not as new MCP types but as prompt-level contracts.

### Theme C: Graduated Quality Assessment

Binary pass/fail verification is insufficient for complex planning tasks. Modern systems use multi-dimensional quality scoring with severity levels, allowing plans to proceed with documented warnings rather than hard-blocking on every issue.

**Blueprint applicability:** Add a pre-draft planning readiness assessment and a post-draft quality self-check, both structured as ledgers with per-item confidence and risk classification.

### Theme D: Decision Record And Revision Continuity

When AI agents revise plans, they need a compact record of previous decisions to avoid regression and unnecessary rework. This is equivalent to human "design decision logs" but adapted for agentic revision loops.

**Blueprint applicability:** Add a session-local planning decision record that persists across revision passes and is folded into the plan's `unknownsAndDeferrals` section.

### Theme E: Execution-Oriented Handoff

The plan is not the end goal — execution is. Modern planning systems include an explicit "handoff summary" that translates planning decisions into execution-oriented context, bridging the gap between the planner's understanding and the executor's needs.

**Blueprint applicability:** Add a compact downstream handoff packet to the plan-phase completion response.

---

## Cross-Report Pattern Analysis

### Patterns Repeated Across All Sibling Reports

1. **Investigation/read packet before action** — discuss-phase has "Selected Phase Read Packet", research-phase has "Investigation Trace", new-project has "Bootstrap Evidence Ledger"
2. **Typed handoff packets between agents** — new-milestone has `NewMilestoneRoadmapperPacket`, new-project has three-gate agent invocation
3. **Downstream handoff at completion** — discuss-phase has full handoff packet, new-milestone has `PhaseAdminDiscussHandoff`
4. **Worked examples and anti-examples** — new-project has 7+7 examples section
5. **Graduated quality assessment** — discuss-phase has readiness ledger, research has evidence grading
6. **Structured resume/revision continuity** — discuss-phase has checkpoint v2 with area queue, research has strand handoffs
7. **Staleness detection** — discuss-phase has readSet fingerprinting

### Pattern Gaps In Plan-Phase

Plan-phase is the *consumer* of all upstream evidence and the *producer* of execution-ready artifacts. It is the most critical quality gate in the Blueprint lifecycle. Yet it currently has the fewest structured intermediate reasoning aids of any major lifecycle command.

| Pattern | discuss | research | new-project | new-milestone | **plan-phase** |
|---------|:---:|:---:|:---:|:---:|:---:|
| Investigation/read packet | Y | Y | Y | Y | **N** |
| Typed agent handoff | Y | Y | Y | Y | **N** |
| Downstream handoff | Y | — | — | Y | **N** |
| Worked examples | Y | Y | Y | — | **N** |
| Quality self-assessment | Y | Y | Y | — | **N** |
| Revision continuity | Y | Y | — | — | **N** |
| Staleness detection | Y | — | — | — | **N** |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|:---:|:---:|------------|
| Contract becomes too long for agents | Medium | Medium | Use labeled blocks, short examples, static test anchors. Keep detailed examples in runtime reference only. |
| Structured handoff packets feel bureaucratic | Low | Low | Keep packets session-local, not new artifacts. They guide agent behavior, not user interaction. |
| Quality self-check adds latency | Low | Low | Make it a fast inline check, not a separate MCP call. |
| Revision continuity records grow large | Low | Medium | Keep compact, carry-forward only essential decisions. |
| Stale evidence false positives | Low | Low | Use lightweight fingerprinting, not deep content comparison. |

---

## Improvement Priority Matrix

| ID | Gap | Decision Value | Effort | Priority |
|----|-----|:---:|:---:|:---:|
| R1 | Investigation trace | HIGH | Medium | P1 |
| R2 | Planning decision record | HIGH | Medium | P1 |
| R3 | Quality self-assessment | HIGH | Low | P1 |
| R8 | Worked examples | MEDIUM | Low | P1 |
| R4 | Typed agent handoff packets | MEDIUM | Medium | P2 |
| R5 | No-subagent fallback depth | MEDIUM | Low | P2 |
| R6 | Execution handoff | MEDIUM | Low | P2 |
| R9 | Complexity budget | MEDIUM | Low | P2 |
| R10 | Revision loop observability | MEDIUM | Low | P2 |
| R7 | Stale evidence detection | LOW | Low | P3 |
