# `/blu-discuss-phase` Final Unified Implementation Plan

Date: 2026-05-14

## Document Purpose

This is a copy-paste-ready implementation plan for upgrading `/blu-discuss-phase` from a dense but loosely executable discovery prompt into a deterministic requirements-discovery workflow. Each Task is scoped for **one agent with fresh context**. Waves group tasks for sequential or parallel execution by an orchestrating agent.

Source documents consumed:
- `skills/blueprint-phase-discovery/SKILL.md` — shared skill orchestration
- `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` — command behavior contract
- `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md` — stage/progress profile
- `commands/blu-discuss-phase.toml` — command manifest
- `docs/commands/discuss-phase.md` — command spec
- `docs/imp/discuss/discuss-phase-frontier-research-and-improvement-plan.md` — frontier research and analysis

## Scope And Boundaries

### What Changes

All changes are **prompt/documentation/test only** unless explicitly marked as optional runtime work. Target files:

| File | Role | Change Type |
|------|------|-------------|
| `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` | Primary behavior contract | Major restructure + new sections |
| `skills/blueprint-phase-discovery/SKILL.md` | Shared skill orchestration | Add discuss-specific orchestration steps |
| `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md` | Stage/progress profile | Add fallback progress line |
| `commands/blu-discuss-phase.toml` | Command manifest | Add short local guard |
| `docs/commands/discuss-phase.md` | Command spec | Mirror user-visible behavior changes |
| `tests/phase-discovery-discuss.test.ts` | Regression tests | Add static contract assertions |
| `tests/context-contract-parity.test.ts` | Schema parity tests | Only if optional schema work done |

### What Does NOT Change

- No `src/mcp/*` runtime code changes in Wave 1–4
- No `phase.context` JSON schema changes
- No new MCP tools or artifact types
- No changes to `blueprint_command_catalog` allowlist
- Model-only `phase.context` writes, `openQuestions: ["none"]` semantics, checkpoint owner/mode guards, and implemented-only routing all stay intact

### Architecture Recap (Context For Fresh Agents)

Blueprint is a **Gemini CLI extension** (not Claude Code, not Codex). It uses:
- **Command manifests** (`commands/blu-*.toml`) — thin user-facing entry points
- **Skills** (`skills/*/SKILL.md`) — orchestration contracts loaded by the host agent
- **Runtime contract references** (`skills/*/references/*.md`) — detailed behavior docs the agent reads at runtime
- **MCP tools** (`src/mcp/tools/*.ts`) — deterministic state engine for reads/writes
- **Agents** (`agents/*.md`) — bounded deep-work contracts

`/blu-discuss-phase` is a `long-running-mutation` command that:
1. Resolves the target phase via MCP
2. Reads prior context, roadmap, config, artifacts, checkpoints
3. Identifies phase-specific gray areas
4. Asks focused questions or runs assumptions mode
5. Checkpoints decisions per area
6. Writes `XX-CONTEXT.md` via structured `phase.context` model (MCP renders Markdown)
7. Optionally writes `XX-DISCUSSION-LOG.md`
8. Syncs `STATE.md`, reloads state, reports refreshed next safe action

The runtime contract (`discuss-phase-runtime-contract.md`) is the **primary implementation target** — it is the detailed behavior authority that agents read before executing the command.

## Verification Commands

Every task must pass these before completion:

```bash
npm ci                                           # in worktree
npm test -- tests/phase-discovery-discuss.test.ts # primary regression
npm test -- tests/context-contract-parity.test.ts # schema parity
npm run typecheck                                 # type safety
git diff --check                                  # no whitespace errors
```

---

## Wave 1: Regression Tests + Runtime Contract Restructure

**Goal**: Add failing static tests that pin every new contract anchor, then restructure the runtime contract into executable blocks without changing behavior yet.

**Parallelism**: Task 1.1 first (tests), then Task 1.2 (restructure) — sequential within wave.

---

### Task 1.1 — Add Static Regression Tests For New Contract Anchors

**Agent scope**: Edit `tests/phase-discovery-discuss.test.ts` only.

**Context to load**:
- Read `tests/phase-discovery-discuss.test.ts` to understand existing test patterns
- Read `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` for current text

**What to do**:

Add a new test group (using the existing `node:test` runner pattern) with focused text-level assertions. These tests will **initially fail** because the contract text does not yet contain these anchors. They become the regression gate for all later waves.

**Tests to add** (each is one `test()` call):

1. **`discuss runtime contract defines selected phase read packet`**
   - Assert contract contains: `Selected Phase Read Packet`, `selectedPhase`, `stateCurrentPhase`, `selectedPhaseResolvedFrom`, and the `found: false` stop rule text

2. **`discuss runtime contract requires artifact status classification`**
   - Assert contract contains all statuses: `missing`, `scaffold-starter`, `authored-substantive`, `validation-suspect`, `safe-checkpoint`, `foreign-checkpoint`, `stale-plan-inventory`

3. **`discuss runtime contract defines gray area queue`**
   - Assert contract contains: `grayAreaQueue`, `areaId`, `decisionValue`, `resolutionCriterion`, `candidateQuestion`, `downstreamImpact`
   - Assert all requirement slots appear: `actor`, `action-task`, `object-concept`, `attribute`, `goal`, `event`, `constraint`, `exception`, `external-interface`, `quality-attribute`, `acceptance-verification`
   - Assert all defect labels appear: `ambiguous`, `incomplete`, `inconsistent`, `unverifiable`, `tradeoff`

4. **`discuss runtime contract has anti-generic-question rule`**
   - Assert `Any other requirements?` appears only in an anti-example/warning context
   - Assert `What should we consider?` appears only in an anti-example/warning context

5. **`questioning rules require decision value and resolved-when format`**
   - Assert contract contains: `Question:`, `Why it matters:`, `Known evidence:`, `Recommended option:`, `Other options:`, `Resolved when:`

6. **`assumptions mode defines confidence labels and ask threshold`**
   - Assert contract contains: `Assumption record`, `Evidence grade`, `Competing interpretations`, `Contradictions checked`, `Consequence if wrong`, `Downstream status`
   - Assert confidence definitions: `Confident`, `Likely`, `Unclear` with evidence/consequence criteria
   - Assert `Ask instead of assuming` with scope, public behavior, data/contracts, security/privacy

7. **`skip discuss uses assumptions safety rules`**
   - Assert `workflow.skip_discuss=true` is mentioned alongside evidence-backed context and high-impact stop/ask rule

8. **`checkpoint contract preserves area queue as semantic source`**
   - Assert contract contains: `Persist after every user answer`, `areaQueue`, `schemaVersion`, `carryForward`, `readSet`
   - Assert all area states: `unseen`, `questioning`, `assumed`, `decided`, `blocked`, `needs-revisit`

9. **`resume ordering is deterministic`**
   - Assert ordering: `questioning`, then `blocked`, then `needs-revisit`, then `unseen`
   - Assert `expectedOwnerCommand: "/blu-discuss-phase"` and `expectedMode: "discuss"`

10. **`context readiness ledger and discussion log triggers are present`**
    - Assert `Context Model Readiness`, `readiness ledger`, `source basis`, `confidence`, `unresolved risk`, `downstream consumer`
    - Assert discussion-log triggers mention: multi-area, assumptions corrections, user direction changes, contradictions

11. **`downstream handoff packet is required`**
    - Assert `Downstream Handoff Packet`, `researchBrief`, `uiBrief`, `planBrief`, `planInventory`, `routingGates`

12. **`final routing copies refreshed state and forbids alternate routes`**
    - Assert `Route only from the post-write` or equivalent
    - Assert `derivedStatus.nextAction`
    - Assert `Do not include secondary runnable routes`
    - Assert missing/blocked fallback is `/blu-progress`

13. **`allowlist remains stable`**
    - Assert `blueprint_command_catalog` is NOT in the discuss command's scoped MCP tool list
    - Read `commands/blu-discuss-phase.toml` and assert it does not add `blueprint_command_catalog`

14. **`long running profile has fallback progress line`**
    - Read `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md`
    - Assert it contains `Progress: phase=` fallback format

**Implementation pattern**: Each assertion reads the file content via `fs.readFileSync` and uses `assert.match()` or `assert.ok(content.includes(...))` following the existing test patterns in the file.

**Expected outcome**: All 14 tests FAIL. This is correct — they define the contract surface that later tasks will implement.

**Verification**: `npm test -- tests/phase-discovery-discuss.test.ts` should show 14 new failures plus all existing tests still passing.

---

### Task 1.2 — Restructure Runtime Contract Into Executable Blocks

**Agent scope**: Edit `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` only.

**Context to load**:
- Read `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` (current full content)
- Read `skills/blueprint-phase-discovery/SKILL.md` lines 179–199 (discuss-phase workflow rules)

**What to do**:

Reorganize the runtime contract into numbered executable blocks. **Preserve all existing correct content** — this is a restructure, not a rewrite. The new section order must be:

1. `## Objective And Authority Boundary` — from current `Parity Target` section
2. `## Required MCP Read Sequence` — from current `Resolve And Read` section
3. `## Selected Phase Read Packet` — placeholder heading only (content added in Wave 2)
4. `## Artifact Status Classification` — placeholder heading only (content added in Wave 2)
5. `## Checkpoint And Resume` — from current checkpoint content scattered across the doc
6. `## Gray Area Identification` — keep current content
7. `## Gray Area Queue` — placeholder heading only (content added in Wave 2)
8. `## Questioning Rules` — keep current content under `## Questioning Rules`
9. `## Assumptions Mode` — keep current content
10. `## Capability-Gated Agent Use` — keep current content
11. `## Single-Agent Fallback` — keep current content
12. `## Context Model Readiness` — placeholder heading only (content added in Wave 3)
13. `## Artifact Authoring` — keep current content
14. `## Discussion Log Triggers` — placeholder heading only (content added in Wave 3)
15. `## Downstream Handoff Packet` — placeholder heading only (content added in Wave 3)
16. `## Validation And Repair` — keep current content
17. `## Final Routing` — placeholder heading only (content added in Wave 4)
18. `## Final Response Shape` — placeholder heading only (content added in Wave 4)
19. `## Phase Context Ownership And Repair Loop` — keep current content

**Rules**:
- Placeholder sections must contain: `<!-- Content added in Wave N -->`
- Do NOT delete any existing substantive text
- Do NOT add new behavioral content yet — only restructure
- Keep the opening paragraph about contract authority and scaffold/authoring template distinction

**Expected outcome**: The runtime contract has a clean navigable structure. No tests pass yet (placeholders don't contain the assertion targets).

**Verification**: `npm test -- tests/phase-discovery-discuss.test.ts` — existing tests still pass, new tests still fail.

---

## Wave 2: Phase Resolution, Gray-Area Queue, And Assumptions Mode

**Goal**: Fill the placeholder sections in the runtime contract with the core behavioral content from the frontier research. This wave makes tests 1–9 and 14 pass.

**Parallelism**: Tasks 2.1, 2.2, 2.3, and 2.4 can run **in parallel** — they edit different sections of the runtime contract. Task 2.5 is sequential after 2.1–2.4 (it edits the manifest and skill).

---

### Task 2.1 — Add Selected Phase Read Packet And Artifact Status Classification

**Agent scope**: Edit `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` — sections `## Selected Phase Read Packet` and `## Artifact Status Classification` only.

**Context to load**:
- Read the full runtime contract (after Wave 1 restructure)
- Read `docs/imp/discuss/discuss-phase-frontier-research-and-improvement-plan.md` lines 155–231 (Analysis A1)
- Read `src/mcp/tools/phase.ts` lines containing `blueprintPhaseLocate` for the return shape

**What to write in `## Selected Phase Read Packet`**:

Replace the placeholder with this content (adapt formatting to match document style):

```markdown
After `blueprint_phase_locate` succeeds, create a run-local selected-phase register:
- `selectedPhase`: `String(result.phaseNumber)`
- `selectedPhasePrefix`: `result.phasePrefix`
- `selectedPhaseDir`: `result.phaseDir`
- `selectedPhaseResolvedFrom`: `result.resolvedFrom`

Use `selectedPhase` for every phase-scoped read, checkpoint read/write/delete,
scaffold path, artifact write, and final `patch.currentPhase`. Treat any
state-derived current phase returned by later reads as `stateCurrentPhase`,
an ambient routing signal, not a replacement for `selectedPhase`.

If `blueprint_phase_locate.found` is false, stop before artifact reads or
writes and report `reason` plus `recovery`.

### Minimum Read Order

1. Call `blueprint_phase_locate`.
2. In parallel, call `blueprint_phase_context`, `blueprint_roadmap_read`,
   `blueprint_artifact_list`, and `blueprint_config_get`.
3. Using `selectedPhase`, read current `context`, current `discussion-log`,
   the discuss checkpoint with owner/mode guards, plan inventory, and the
   `phase.context` artifact contract.
4. Read the `phase.discussion-log` contract only when a durable discussion
   log is likely.
5. Read earlier phase context only when the relevance rule below matches.

### Prior-Context Relevance Rule

Earlier phase context is materially relevant when it shares roadmap
requirement ids, canonical references, deferred ideas, codebase surfaces,
MCP tool families, command lifecycle gates, or explicit dependency language
with the selected phase. Prefer the nearest prior matching phase plus any
phase explicitly referenced by ROADMAP or saved context. If no rule matches,
say no earlier context was reused instead of doing a broad sweep.

### Compact Read-Packet Summary

Before the first fresh user question, summarize: selected phase, phase
resolution source, `stateCurrentPhase` if different, config mode
(`discuss`, `assumptions`, or `skip_discuss`), context status, discussion-log
status, checkpoint status, prior context reused/skipped, codebase-summary
status, and plan-inventory warning.
```

**What to write in `## Artifact Status Classification`**:

Replace the placeholder with:

```markdown
Classify current artifacts before questioning:

| Status | Meaning |
|--------|---------|
| `missing` | No artifact file exists |
| `scaffold-starter` | File exists but contains only scaffold/seed content |
| `authored-substantive` | File contains real authored content |
| `validation-suspect` | File exists but failed or may fail validation |
| `unreadable` | File exists but cannot be parsed or read |
| `safe-checkpoint` | Checkpoint exists with matching owner/mode |
| `foreign-checkpoint` | Checkpoint exists but owner/mode mismatch |
| `stale-plan-inventory` | Saved plans exist that may not reflect current context |

The classification controls the next gate:
- `missing` or `scaffold-starter` → fresh discovery
- `authored-substantive` → overwrite confirmation gate
- `validation-suspect` → repair or overwrite confirmation
- `unreadable` → report and route to fresh discovery
- `safe-checkpoint` → resume-versus-discard gate
- `foreign-checkpoint` → treat as non-resumable evidence only
- `stale-plan-inventory` → warn before context rewrite
```

**Verification**: Tests 1, 2, 3 (partially) should now pass.

---

### Task 2.2 — Add Gray Area Queue And Stop Criteria

**Agent scope**: Edit `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` — section `## Gray Area Queue` only.

**Context to load**:
- Read the full runtime contract (after Wave 1 restructure)
- Read `docs/imp/discuss/discuss-phase-frontier-research-and-improvement-plan.md` lines 232–342 (Analysis A2)

**What to write in `## Gray Area Queue`**:

Replace the placeholder with:

```markdown
Before asking the user anything, build a compact `grayAreaQueue` from the
evidence packet. This queue is working state and checkpoint context, not a
competing artifact schema. Each entry must include:

- `areaId`: stable kebab-case label
- `slot`: actor | action-task | object-concept | attribute | goal | event |
  constraint | exception | external-interface | quality-attribute |
  acceptance-verification
- `defect`: ambiguous | incomplete | inconsistent | unverifiable | tradeoff
- `lens`: scope | user-visible-behavior | interface-contract | reuse |
  dependency | risk-failure | methodology | routing
- `evidence`: repo paths, saved artifacts, MCP results, or user-provided
  source that exposed the gap
- `downstreamImpact`: research | ui | plan | validation | routing
- `decisionValue`: high | medium | low
- `resolutionCriterion`: what answer, assumption, or handoff makes the area
  resolved
- `candidateQuestion`: the single next question that would resolve or shrink
  the area

Classify every gray area by requirement slot first, then by Blueprint lens.
Example: `slot=external-interface`, `lens=interface-contract`,
`defect=incomplete`, `impact=plan+validation`: "The roadmap says sync to
GitHub, but no payload, auth, or failure contract is known."

### Stop Criteria

An area is resolved when one of these is true:

1. A user answer or evidence-backed assumption maps to a concrete
   `implementationDecisions` entry with rationale and evidence.
2. The unknown is intentionally recorded in `openQuestions` with owner or
   downstream consumer and no longer blocks the current context write.
3. The unknown is routed to `research`, `ui`, or later planning with the exact
   follow-up read or artifact dependency recorded.
4. The idea is out of scope and captured under `deferredIdeas`.

Stop asking when all high-decision-value areas are resolved by one of those
paths and remaining low-value details would not change the next safe action.

### Model-Authoring Bridge

Every resolved high-value area must appear in the final `phase.context` model
as an `implementationDecisions` row, a `dependencies` item, an `openQuestions`
item, a `deferredIdeas` item, or a `canonicalReferences` source. If none of
those fields receives the area, the discussion is not ready to write.

### Anti-Generic Question Rule

Do not ask checklist or atmosphere questions such as "Any other requirements?",
"What should we consider?", or "What are your preferences?" unless the question
is tied to a named `grayAreaQueue` entry, cites the evidence gap, and states
what downstream decision the answer will change.

### Gray Area Example

- `areaId`: auth-error-contract
- `slot`: exception
- `defect`: incomplete
- `lens`: interface-contract
- `evidence`: `.blueprint/ROADMAP.md` says "handle auth failures"; current
  context names no error payload.
- `downstreamImpact`: plan, validation
- `decisionValue`: high
- `candidateQuestion`: "For auth failures, should this phase standardize a
  machine-readable error code now, reuse the existing generic failure shape,
  or defer payload shape to a later API-contract phase?"
- `resolved`: selected generic failure shape; record rationale and validation
  expectation in `implementationDecisions`.
```

**Verification**: Tests 3 and 4 should now pass.

---

### Task 2.3 — Strengthen Questioning Rules

**Agent scope**: Edit `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` — section `## Questioning Rules` only.

**Context to load**:
- Read the current `## Questioning Rules` section in the runtime contract
- Read `docs/imp/discuss/discuss-phase-frontier-research-and-improvement-plan.md` lines 274–306 (A2 questioning improvements)

**What to do**:

**Preserve** existing content about `ask_user`, one-question preference, concrete options, and not claiming unshipped behavior. **Add** these new subsections after the existing content:

```markdown
### Decision-Value Ranking

Ask the highest-decision-value unresolved question next. A question is high
value only when the answer can change phase boundary, implementation approach,
acceptance/verification hooks, safety/security posture, artifact routing, or
required `phase.context` fields. If the answer would only add color, record
it as a deferred idea or optional note instead of interrupting.

### One-Question Format

Use this format for interactive `ask_user` calls:

```
Question: <one concrete phase-specific decision>
Why it matters: <which context field, downstream command, or routing gate this unblocks>
Known evidence: <repo path/MCP result/user source>
Recommended option: <safe default, only when evidence supports one>
Other options: <2-3 concrete alternatives plus freeform escape>
Resolved when: <exact criterion that lets the agent checkpoint or move on>
```
```

**Verification**: Test 5 should now pass.

---

### Task 2.4 — Strengthen Assumptions Mode And Add Evidence Grading

**Agent scope**: Edit `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` — section `## Assumptions Mode` only.

**Context to load**:
- Read the current `## Assumptions Mode` section in the runtime contract
- Read `docs/imp/discuss/discuss-phase-frontier-research-and-improvement-plan.md` lines 343–432 (Analysis A3)

**What to do**:

**Preserve** existing content about evidence-first assumptions, citing sources, confidence labels, and asking for uncertain/high-impact corrections. **Add** these new subsections after the existing content:

```markdown
### Assumption Record Shape

Each assumption should be recorded with:

- **Area**: gray-area id this resolves
- **Decision default**: the assumed answer
- **Evidence**: repo paths, saved artifacts, MCP results
- **Evidence grade**: `repo-observed` | `repo-inferred` | `saved-artifact` |
  `user-stated` | `official-external` | `research-secondary` | `assumption` |
  `contradicted` | `unknown`
- **Confidence**: `Confident` | `Likely` | `Unclear`
- **Competing interpretations**: other viable readings
- **Contradictions checked**: conflicts found or "none found"
- **Consequence if wrong**: downstream impact
- **Ask/reopen rule**: condition that should trigger re-asking
- **Downstream status**: `plan-safe` | `research-needed` | `ui-needed` |
  `user-confirmation-needed`

### Confidence Label Definitions

- **Confident**: Direct repo/runtime or saved Blueprint evidence supports
  the default, no material contradictory evidence was found, and the
  consequence if wrong is low or easily corrected.
- **Likely**: The default follows from a consistent repo pattern or prior
  artifact but lacks direct confirmation, or the consequence if wrong is
  moderate and must be visible to downstream planning.
- **Unclear**: Evidence is thin, conflicting, stale, externally inferred, or
  the consequence if wrong is high. Do not lock as plan-safe; ask the user
  or route to research/UI/user confirmation.

### Ask-Versus-Assume Threshold

Ask instead of assuming when the answer changes phase scope, public behavior,
data/contracts, security/privacy, migration or deletion behavior, acceptance
criteria, command routing, or whether a downstream research/UI gate is
required.

Assume only when the evidence is repo-grounded, internally consistent, low
blast-radius, and the final context can label the default as reversible.

### Contradiction Handling

When evidence conflicts, preserve the conflict instead of smoothing it. For
current Blueprint runtime behavior, prefer live MCP output and repo source
over saved docs. For desired product intent, prefer the user's current answer
over older artifacts. If the conflict changes implementation shape, ask the
user; if it changes technical feasibility or external correctness, route to a
`research-needed` assumption.

### Sidecar Bounds For Assumptions

Ask `blueprint-researcher` for one assumptions pass only when configured and
useful. It must return defaults grouped by gray area, direct repo paths or
supplied official references, confidence labels using this contract,
contradictions or missing evidence, and the smallest question that would
change each default. It must not draft `phase.context` or mark `Unclear`
defaults as decisions.

### Skip-Discuss Safety

When `workflow.skip_discuss=true`, the same safety rules apply: produce
evidence-backed context, label defaults, and stop or ask when high-impact
assumptions remain unresolved. Skip-discuss may reduce interview turns but
must not silently convert thin evidence into saved context.
```

**Verification**: Tests 6 and 7 should now pass.

---

### Task 2.5 — Update Manifest, Skill, And Long-Running Profile

**Agent scope**: Edit `commands/blu-discuss-phase.toml`, `skills/blueprint-phase-discovery/SKILL.md`, and `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md`.

**Context to load**:
- Read all three files in full
- Read `docs/imp/discuss/discuss-phase-frontier-research-and-improvement-plan.md` lines 759–798 (target files section)

**What to do in `commands/blu-discuss-phase.toml`**:

Add one short sentence inside the `prompt` string, after the "Command-local constraints:" block and before "Response requirements:":

```
Before any user question or sidecar decision, resolve the phase and build the selected-phase read packet from the discuss runtime contract. Keep the selected phase distinct from ambient state phase when they differ.
```

**What to do in `skills/blueprint-phase-discovery/SKILL.md`**:

In the `### discuss-phase` section (lines 179–199), add these numbered items **before** the existing item 16 (which becomes item 19). Insert after item 15:

```markdown
16. Before asking the user anything, build the `grayAreaQueue` from the read packet using the runtime contract's taxonomy-driven gray-area discovery. Use the ask-versus-assume threshold from the runtime contract to decide which areas need user input versus evidence-backed defaults.
17. When using assumptions mode, follow the runtime contract's assumption record shape, confidence label definitions, and ask-versus-assume threshold. Do not lock `Unclear` defaults as plan-safe decisions.
18. Before final state sync, derive the downstream handoff packet and fold it into the saved context model: `researchBrief`, `uiBrief`, `planBrief`, `planInventory`, and `routingGates`. Keep it filtered and artifact-oriented; do not carry the full discussion transcript forward.
```

Renumber the old item 16 to 19.

**What to do in `long-running-phase-discovery-profile.md`**:

Add this subsection after the existing `## Session-Local Visibility Helpers` section:

```markdown
## Fallback Progress Format

When `update_topic` and `write_todos` are unavailable, use this fixed
one-line status format for progress recaps:

```
Progress: phase=<resolved phase> stage=<Resolve|Read|Decide|Execute|Persist|Validate|Route>
gate=<pending gate or none> mode=<discuss|assumptions|skip-discuss>/<fresh|resumed>
areas=<decided>/<total> active=<areaId or none> next=<next safe action or next question>
```

Helper state mirrors the MCP checkpoint. If helper state and checkpoint
state disagree, report the checkpoint state and refresh the helper display.
The MCP checkpoint remains authoritative.
```

**Verification**: Tests 13 (partially — manifest check) and 14 should now pass.

---

## Wave 3: Checkpointing, Context Readiness, And Downstream Handoff

**Goal**: Fill checkpoint v2, context model readiness, discussion-log triggers, and downstream handoff packet sections. This wave makes tests 8, 9, 10, and 11 pass.

**Parallelism**: Tasks 3.1 and 3.2 can run **in parallel** — they edit different sections of the runtime contract.

---

### Task 3.1 — Add Checkpoint V2 Semantics And Deterministic Resume

**Agent scope**: Edit `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` — section `## Checkpoint And Resume` only.

**Context to load**:
- Read the current `## Checkpoint And Resume` section in the runtime contract
- Read `docs/imp/discuss/discuss-phase-frontier-research-and-improvement-plan.md` lines 434–527 (Analysis A4)
- Read `src/mcp/tools/phase-checkpoint-records.ts` to understand the current Zod schema with `.catchall(z.unknown())`

**What to do**:

**Preserve** existing content about checkpoint ownership, `ownerCommand`, `resumeMeta`, and the cleanup gating rules. **Add** these new subsections after the existing content:

```markdown
### Checkpoint Persistence Frequency

Persist after every user answer and after every gray-area boundary. A
checkpoint is resume-ready only when the active area has a stable `areaId`,
state, current question or blocking reason, evidence refs, and the last
accepted user answer or assumption. Do not infer these from the chat
transcript.

### Area States

Each gray area in the checkpoint progresses through these states:
`unseen`, `questioning`, `assumed`, `decided`, `blocked`, `needs-revisit`.

Resume must not re-ask an area whose `resolutionCriterion` was already met
unless new evidence contradicts the saved decision.

### Checkpoint V2 Shape

The current MCP checkpoint schema tolerates extra fields via `.catchall()`.
Use this extended shape as prompt-compatible metadata. Keep existing
`completedAreas`, `remainingAreas`, `decisions`, `deferredIdeas`,
`canonicalReferences`, and `resumeMeta` for current runtime compatibility,
but derive them from `areaQueue` when `areaQueue` exists. The `areaQueue`
is the semantic source of truth; the lists are compatibility summaries.

Sample v2 checkpoint:

```json
{
  "ownerCommand": "/blu-discuss-phase",
  "schemaVersion": 2,
  "phaseKey": "03-phase-discovery",
  "progress": {
    "activeStage": "Execute",
    "pendingGate": "gray-area-question",
    "executionMode": "discuss/resumed",
    "areasDecided": 1,
    "areasTotal": 4,
    "nextActionPreview": "Ask the current UI expectations follow-up"
  },
  "areaQueue": [
    {
      "areaId": "scope-boundary",
      "title": "Scope boundaries",
      "state": "decided",
      "decisionIds": ["D-scope-001"],
      "evidenceRefs": [".blueprint/ROADMAP.md"],
      "downstreamConsumers": ["/blu-research-phase", "/blu-plan-phase"]
    },
    {
      "areaId": "ui-expectations",
      "title": "UI expectations",
      "state": "questioning",
      "currentQuestion": "Does this phase author a real UI surface or only a no-UI rationale?",
      "questionWhyItMatters": "Controls whether /blu-ui-phase should produce UI work or an explicit skip rationale.",
      "lastUserAnswer": null
    }
  ],
  "carryForward": {
    "phaseBoundary": [],
    "completedDecisions": [],
    "openQuestions": [],
    "deferredIdeas": [],
    "canonicalReferences": [],
    "contradictions": [],
    "doNotInferBeyond": []
  },
  "readSet": []
}
```

### Carry-Forward Packet

Before asking the next question or handing off to a sidecar, build
`carryForward`: `phaseBoundary`, `activeArea`, `completedDecisions`,
`openQuestions`, `deferredIdeas`, `canonicalReferences`, `evidenceRefs`,
`contradictions`, `omittedDetails`, and `doNotInferBeyond`. Store the
compact `carryForward` in the checkpoint. Copy the final version into
`XX-DISCUSSION-LOG.md` when the session had more than one area,
contradictions, assumptions, or deferred ideas.

### Deterministic Resume Ordering

On resume, read with `expectedOwnerCommand: "/blu-discuss-phase"` and
`expectedMode: "discuss"`. If `safeToResume` is false, ask resume-versus-
discard using the warnings. If `safeToResume` is true, pick the first area
with state `questioning`, then `blocked`, then `needs-revisit`, then the
first `unseen` area. Never reconstruct the queue from `completedAreas`
prose alone.

### Stale-Input Detection

`readSet` should list the roadmap/context/config/plan-index artifacts used
to form the queue, with path plus lightweight fingerprint or `updatedAt`
where available. On resume, warn when the read set changed and route the
affected area to `needs-revisit` instead of silently continuing.

### Checkpoint Deletion And Audit Trail

When `blueprint_phase_checkpoint_delete` succeeds after finalization, the
final response and optional discussion log should say which areas were
decided, which were assumed, which remain open, and where those facts
landed in `XX-CONTEXT.md` or `XX-DISCUSSION-LOG.md`.
```

**Verification**: Tests 8 and 9 should now pass.

---

### Task 3.2 — Add Context Readiness, Discussion-Log Triggers, And Handoff Packet

**Agent scope**: Edit `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` — sections `## Context Model Readiness`, `## Discussion Log Triggers`, and `## Downstream Handoff Packet` only.

**Context to load**:
- Read the full runtime contract (after Wave 2)
- Read `docs/imp/discuss/discuss-phase-frontier-research-and-improvement-plan.md` lines 528–735 (Analyses A5 and A6)

**What to write in `## Context Model Readiness`**:

Replace the placeholder with:

```markdown
Before writing `phase.context`, build a readiness ledger:

| field | source basis | confidence | unresolved risk | downstream consumer |
|-------|-------------|------------|-----------------|---------------------|

Every required field must be evidence-backed, user-confirmed, or explicitly
assumption-backed. Do not write the model while any field is scaffold-derived,
source-free, or contradicted without an `openQuestions`, `dependencies`, or
`deferredIdeas` entry.

Every resolved high-value gray area must appear in the final `phase.context`
model as an `implementationDecisions` row, a `dependencies` item, an
`openQuestions` item, a `deferredIdeas` item, or a `canonicalReferences`
source. If none of those fields receives the area, the discussion is not
ready to write.

### Claim-Linked Evidence

Because the current `phase.context` schema has no separate per-claim evidence
object, include evidence anchors inside durable values when useful. Prefer:

"Keep execution resumability checkpoint-owned because
tests/phase-discovery-discuss.test.ts covers checkpoint survival after
invalid context writes."

Avoid disconnected source lists such as:

"Implementation is straightforward and tests should be added."

### Context Quality Anti-Example

Weak: "Implementation is straightforward and tests should be added."

Better: "Planning must preserve checkpoint deletion after context write,
optional discussion-log write, synced STATE update, and state reload; the
runtime contract names this order and tests assert it."
```

**What to write in `## Discussion Log Triggers`**:

Replace the placeholder with:

```markdown
Write `XX-DISCUSSION-LOG.md` when any trigger is true:

- More than one gray area was discussed or resumed
- Assumptions mode presented defaults that were accepted, corrected, or
  rejected
- The user changed direction, rejected an option, or supplied rationale not
  fully represented in `phase.context`
- A contradiction, plan-inventory warning, compliance/audit concern, or
  deferred follow-up needs reconstruction later

Skip the log only when one straightforward area was resolved and the final
`phase.context` preserves all decisions, sources, and follow-ups.

### Discussion-Log Content Expectations

The log complements, not duplicates, `XX-CONTEXT.md`:

- `Summary`: the decision arc and session outcome
- `Notes`: user corrections, options rejected, evidence snippets, and
  assumption review results
- `Follow-Ups`: only concrete later actions, or exact rationale that no
  follow-up remains

### Assumptions Review Block

When assumptions mode was used, include:

- Presented: assumption text
- User correction: what changed
- Evidence changed: new evidence surfaced
- Final disposition: accepted / corrected / rejected
- Downstream impact: which command or artifact is affected
```

**What to write in `## Downstream Handoff Packet`**:

Replace the placeholder with:

```markdown
Before final validation and routing, derive a compact handoff packet from the
saved context model, checkpoint decisions, plan index, effective config, and
artifact inventory. Persist its substance inside existing `phase.context`
model sections; do not create a new artifact or pass the raw conversation
transcript downstream.

### Required Packet Fields

- `researchBrief`: known unknowns, evidence needed, source policy from
  effective config, decision each research item unblocks, stop condition,
  evidence refs, and unresolved questions that must route to
  `/blu-research-phase`.
- `uiBrief`: UI applicability, users, critical journeys, interaction
  surfaces, accessibility/privacy/safety constraints, and any no-UI skip-
  rationale candidate. A candidate is not a completed `XX-UI-SPEC.md` skip
  rationale.
- `planBrief`: initial state, desired end state, dependencies, forbidden
  moves, validation oracle, non-goals, repo constraints, accepted assumptions,
  rejected options, and open planning risks.
- `planInventory`: existing plan IDs and paths, dependency gaps, warnings,
  and whether refreshed discovery leaves saved plans stale until
  `/blu-plan-phase` is rerun.
- `routingGates`: selected phase, workflow research/UI booleans, context
  path, research path/status, UI-spec path/status, refreshed next safe
  action, and fallback action when routing is unavailable.

### Stale-Plan Warning

When `blueprint_phase_plan_index.plans.length > 0`, include this warning
in the handoff and the final response:

> Existing saved plans were not rewritten by this refreshed discussion;
> rerun `/blu-plan-phase <selectedPhase>` before trusting plan content that
> depends on the new context.

### Research Handoff Stop Condition

Give research a concrete stop: "enough evidence to choose between the listed
options or confirm that repo evidence is insufficient and an assumption must
remain open."

### UI Handoff Applicability

`uiBrief.applicability` should be one of:
- `needs-ui-contract` — UI work is needed
- `skip-rationale-candidate` — discuss captured a skip rationale candidate
  but `/blu-ui-phase` must still confirm or formalize it
- `unknown` — UI applicability not yet determined

### Plan Handoff Shape

Keep `planBrief` planning-oriented: acceptance/verification hooks,
dependencies, non-goals, constraints, rejected options, and assumptions
safe for planning. Any unresolved high-impact ambiguity should stay in
`openQuestions` or `researchBrief`, not silently become a plan premise.
```

**Verification**: Tests 10 and 11 should now pass.

---

## Wave 4: Final Routing, Command Spec, And Semantic Self-Check

**Goal**: Fill final routing and final response shape sections, update the command spec doc, add the semantic self-check, and make all remaining tests (12, 13) pass. All 14 tests should be green after this wave.

**Parallelism**: Tasks 4.1 and 4.2 can run **in parallel**. Task 4.3 is sequential after both.

---

### Task 4.1 — Add Final Routing And Final Response Shape

**Agent scope**: Edit `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` — sections `## Final Routing` and `## Final Response Shape` only.

**Context to load**:
- Read the full runtime contract (after Wave 3)
- Read `docs/imp/discuss/discuss-phase-frontier-research-and-improvement-plan.md` lines 630–736 (Analysis A6)
- Read the existing `## Validation And Repair` section to ensure no overlap

**What to write in `## Final Routing`**:

Replace the placeholder with:

```markdown
Route only from the post-write `blueprint_state_load` result:

1. Call `blueprint_state_update({ base: "synced", patch: { currentPhase:
   selectedPhase, activeCommand: "/blu-discuss-phase" } })`.
2. Call `blueprint_state_load`.
3. Copy `derivedStatus.nextAction` exactly as the next safe action.
4. If the loaded action is missing, blocked, or not a Blueprint command, say:
   "Run /blu-progress to review the next safe Blueprint action."
5. Do not include secondary runnable routes unless a future contract
   explicitly adds `blueprint_command_catalog` to this command's allowlist
   and tests.

### State Warning Preservation

Preserve state warnings in the final response when they affect routing:
requested-phase preservation warnings, invalid research warnings, missing
plan dependency warnings, and quality-gate debt warnings. This makes the
refreshed route auditable without requiring downstream agents to re-run
all reads.
```

**What to write in `## Final Response Shape`**:

Replace the placeholder with:

```markdown
Final response shape:

- **Saved**: context path, optional discussion-log path, reused/replaced
  status.
- **Checkpoint**: deleted, retained with reason, or no checkpoint.
- **Handoff**: one-line summary of `researchBrief`, `uiBrief`, `planBrief`,
  and `planInventory`, including the stale-plan warning when plans already
  exist.
- **Next safe action**: exact refreshed `derivedStatus.nextAction` or
  `/blu-progress` fallback. Do not include secondary runnable routes.

### Semantic Self-Check

Before claiming success, answer yes/no:

1. Does every `implementationDecisions` row name a decision and the
   constraint/tradeoff that makes it durable?
2. Does every `existingCodeInsights` item cite a file/module, saved artifact,
   command output, or explicit unknown?
3. Are all deferred or later ideas preserved in `deferredIdeas` and, when
   useful, in the discussion log?
4. Are all open questions either concrete blockers or exactly the model value
   `"none"`?
5. Could `/blu-research-phase`, `/blu-ui-phase`, or `/blu-plan-phase` consume
   this without re-asking basics?
```

**Verification**: Test 12 should now pass.

---

### Task 4.2 — Update Command Spec Documentation

**Agent scope**: Edit `docs/commands/discuss-phase.md` only.

**Context to load**:
- Read `docs/commands/discuss-phase.md` in full
- Read the completed runtime contract for the behavioral changes to mirror

**What to do**:

Mirror user-visible behavior changes without over-specifying runtime internals. Make these specific edits:

1. **In `## Purpose`**: Add a sentence about taxonomy-driven gray-area discovery and evidence-graded assumptions.

2. **In `## Behavior Stages`**:
   - Stage 2 `Read`: Add "builds the selected-phase read packet and classifies artifact status"
   - Stage 3 `Decide`: Add "selects from the `grayAreaQueue` by decision value"
   - Stage 4 `Execute`: Add "uses the one-question format with decision-value ranking and stop criteria"

3. **In `## User Prompts And Confirmation Gates`**:
   - Add: "Questions follow the decision-value ranking: ask only when the answer changes phase boundary, implementation approach, acceptance criteria, safety posture, or routing."
   - Add: "Assumptions mode uses defined confidence labels (Confident, Likely, Unclear) and the ask-versus-assume threshold."

4. **In `## Edge Cases`**:
   - Add: "`workflow.skip_discuss=true` must still produce evidence-backed context and stop when high-impact assumptions are unresolved."

5. **In `## Acceptance Criteria`**:
   - Add: "Derives and folds the downstream handoff packet (`researchBrief`, `uiBrief`, `planBrief`, `planInventory`, `routingGates`) into the saved context model."
   - Add: "Final routing copies `derivedStatus.nextAction` exactly; does not include secondary runnable routes."

**Rules**:
- Keep the command spec concise — it is user-facing, not the runtime contract
- Do not duplicate the full gray-area queue shape, checkpoint v2 shape, or assumption record here
- Preserve all existing content that is still correct

**Verification**: Existing tests still pass. No new tests target this file directly.

---

### Task 4.3 — Verify All Tests Pass And Fix Any Gaps

**Agent scope**: Read all modified files, run tests, fix any assertion mismatches.

**Context to load**:
- Read the full runtime contract
- Read `tests/phase-discovery-discuss.test.ts` (the new test assertions from Task 1.1)
- Read `skills/blueprint-phase-discovery/SKILL.md`
- Read `commands/blu-discuss-phase.toml`
- Read `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md`

**What to do**:

1. Run `npm ci` in the worktree
2. Run `npm test -- tests/phase-discovery-discuss.test.ts`
3. Run `npm test -- tests/context-contract-parity.test.ts`
4. Run `npm run typecheck`
5. Run `git diff --check`

If any of the 14 new tests fail:
- Read the exact assertion that fails
- Find the corresponding section in the runtime contract, skill, manifest, or profile
- Fix the content to match the assertion anchor (the test defines the contract surface)
- Re-run until all tests pass

If any existing tests broke:
- Read the failing test carefully
- The fix must preserve the existing behavior — do not weaken existing assertions
- The most likely cause is a restructure that moved text away from where an existing assertion looks for it

**Expected outcome**: All tests green. `npm run typecheck` clean. `git diff --check` clean.

**Verification**: All verification commands pass.

---

## Wave 5: Optional Runtime And Schema Hardening (Deferred)

**Goal**: Only after prompt behavior proves valuable and downstream commands need machine-readable fields. This wave is explicitly **later work** — do not execute until Wave 1–4 are stable and validated in real `/blu-discuss-phase` runs.

**Parallelism**: Tasks 5.1, 5.2, and 5.3 can run **in parallel** — they touch different source modules.

---

### Task 5.1 — Harden Checkpoint Schema (Optional)

**Agent scope**: Edit `src/mcp/tools/phase-checkpoint-records.ts` and `tests/phase-discovery-discuss.test.ts`.

**Context to load**:
- Read `src/mcp/tools/phase-checkpoint-records.ts` for current Zod schema
- Read the checkpoint v2 shape from the runtime contract (Wave 3)

**What to do**:

- Add typed optional fields to the checkpoint Zod schema: `schemaVersion`, `areaQueue`, `progress`, `carryForward`, `readSet`
- Validate: no duplicate `areaId` values, legal area states only, `currentQuestion` required when state is `questioning`, evidence refs required when state is `decided` or `assumed`
- Preserve `.catchall(z.unknown())` or provide a migration path for existing checkpoints
- Add round-trip fixture tests: write a v2 checkpoint with `blueprintPhaseCheckpointPut`, read with `blueprintPhaseCheckpointGet`, assert all v2 fields preserved
- Add schema-hardening tests for invalid states and missing required fields

**Verification**: `npm run build && npm run typecheck && npm test -- tests/phase-discovery-discuss.test.ts`

---

### Task 5.2 — Add Context Model Claim/Provenance Fields (Optional)

**Agent scope**: Edit `src/mcp/artifact-contracts/schemas/phase.context.model.schema.json`, `src/mcp/tools/phase-context-model.ts`, `src/mcp/artifact-contracts/index.ts`, and `tests/context-contract-parity.test.ts`.

**Context to load**:
- Read the current schema, renderer, and contract registration
- Read the context readiness guidance from the runtime contract (Wave 3)

**What to do**:

- Add optional versioned fields: `evidenceClaims`, richer `implementationDecisions` with `areaId`/`requirementIds`/`sourceRefs`/`assumptionStatus`, structured `openQuestions` with `question`/`blocks`/`owner`/`fallbackAssumption`
- Update the renderer to handle new optional fields gracefully
- Update examples in the contract registration
- Update `tests/context-contract-parity.test.ts` for schema identity, required field parity, rendered heading parity, minimal examples, exact `openQuestions: ["none"]` compatibility, and `additionalProperties` behavior
- Version the schema change explicitly

**Verification**: `npm run build && npm run typecheck && npm test -- tests/context-contract-parity.test.ts`

---

### Task 5.3 — Consider Discussion-Log Model (Optional)

**Agent scope**: Evaluate whether a model-backed `phase.discussion-log` is warranted based on real usage of Wave 1–4.

**What to do**:

- Review actual discussion logs produced after Wave 1–4 deployment
- If the optional log is consistently useful with the trigger rules, design: `sessionSummary`, `turnNotes`, `optionsConsidered`, `userCorrections`, `assumptionsPresented`, `deferredFollowUps`, `sourceRefs`
- If not consistently useful, document the skip rationale and keep the freehand Markdown contract

This task produces a decision document, not code. Code follows only if the decision is "yes, model-back it."

**Verification**: Decision document reviewed. No code changes unless decided.

---

## Task Dependency Graph

```
Wave 1 (sequential):
  1.1 Add tests ──→ 1.2 Restructure contract

Wave 2 (parallel core, sequential finish):
  2.1 Phase read packet  ─┐
  2.2 Gray area queue     ├──→ 2.5 Manifest/skill/profile
  2.3 Questioning rules   │
  2.4 Assumptions mode    ─┘

Wave 3 (parallel):
  3.1 Checkpoint v2 ──┐
                      ├──→ (both independent)
  3.2 Readiness/handoff ─┘

Wave 4 (parallel core, sequential finish):
  4.1 Final routing  ──┐
                       ├──→ 4.3 Verify all tests
  4.2 Command spec   ──┘

Wave 5 (optional, all parallel):
  5.1 Checkpoint schema
  5.2 Context model fields
  5.3 Discussion-log model
```

## Test Coverage Map

| Test # | Assertion Target | Passes After |
|--------|-----------------|-------------|
| 1 | Selected Phase Read Packet | Task 2.1 |
| 2 | Artifact Status Classification | Task 2.1 |
| 3 | Gray Area Queue | Task 2.2 |
| 4 | Anti-Generic Question Rule | Task 2.2 |
| 5 | Questioning Rules Format | Task 2.3 |
| 6 | Assumptions Confidence + Threshold | Task 2.4 |
| 7 | Skip-Discuss Safety | Task 2.4 |
| 8 | Checkpoint Area Queue | Task 3.1 |
| 9 | Resume Ordering | Task 3.1 |
| 10 | Context Readiness + Log Triggers | Task 3.2 |
| 11 | Downstream Handoff Packet | Task 3.2 |
| 12 | Final Routing + No Alternate Routes | Task 4.1 |
| 13 | Allowlist Stability | Task 2.5 (partial) + Task 4.3 |
| 14 | Fallback Progress Line | Task 2.5 |

## Risks And Mitigations

| Risk | Mitigation |
|------|-----------|
| Prompt becomes too long for agents | Use labeled blocks, short examples, static test anchors. Keep detailed examples in runtime reference only. |
| Strict question rules feel bureaucratic | Rank by decision value, stop when remaining details don't change routing, allow assumptions for low-risk defaults. |
| Rich checkpoint metadata appears authoritative before runtime validation | Mark v2 fields as prompt-compatible metadata. Keep existing compatibility lists and owner/mode guards. |
| Handoff packet language looks like a new artifact | State that packet substance lands in existing `phase.context`, `phase.discussion-log`, and checkpoint fields. |
| Static prompt tests become brittle | Assert semantic anchors and required phrases, not exact paragraphs. |
| Schema expansion breaks existing artifacts | Defer to Wave 5, version changes, keep backward-compatible examples. |
| Agents bypass implemented-only routing | Keep `blueprint_command_catalog` absent from allowlist, assert no secondary routes, route only from `derivedStatus.nextAction`. |

## Definition Of Done

- [ ] `commands/blu-discuss-phase.toml`, `skills/blueprint-phase-discovery/SKILL.md`, and `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` agree on selected-phase handling, question policy, assumptions safety, context authoring, checkpointing, handoff, and final routing
- [ ] `docs/commands/discuss-phase.md` accurately describes user-visible behavior without becoming the source of truth for runtime ordering
- [ ] `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md` has the fallback progress format
- [ ] `tests/phase-discovery-discuss.test.ts` pins all 14 new prompt-contract anchors and preserves existing routing, checkpoint, and allowlist guarantees
- [ ] `tests/context-contract-parity.test.ts` remains green
- [ ] Model-only `phase.context` writes, exact `openQuestions: ["none"]` semantics, checkpoint owner/mode safety, and implemented-only route reporting are all preserved
- [ ] `npm ci && npm test -- tests/phase-discovery-discuss.test.ts && npm test -- tests/context-contract-parity.test.ts && npm run typecheck && git diff --check` all pass
- [ ] No new prompt text suggests planned-only commands
- [ ] Final route language is copied from refreshed state, not inferred from a successful context write
- [ ] Assumptions with `Unclear` confidence cannot become plan-safe decisions
- [ ] UI skip candidates are not described as completed UI skip rationales
- [ ] Checkpoint deletion happens only after context write, optional discussion-log write, synced state update, and state reload all succeed
