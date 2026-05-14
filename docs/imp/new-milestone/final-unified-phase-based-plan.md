# Phase-Admin Improvement Plan: `/blu-new-milestone`, `/blu-add-phase`, `/blu-insert-phase`

Status: final unified implementation plan.

Source: [new-milestone-frontier-research-and-improvement-plan.md](file:///Users/rhishi/dev/repositories/antigravity/blueprint/docs/imp/new-milestone/new-milestone-frontier-research-and-improvement-plan.md)

> [!IMPORTANT]
> This is a copy-paste executable plan for implementing agents. Blueprint is a **Gemini CLI extension** — not Claude Code, Codex, or any other harness. All edits are to Blueprint source files, not to any agent harness internals.

---

## Table of Contents

1. [Context Summary](#context-summary)
2. [Existing Workflow Summary](#existing-workflow-summary)
3. [Frontier Research Synthesis](#frontier-research-synthesis)
4. [Shared Vocabulary and Types](#shared-vocabulary-and-types)
5. [Wave 0 — Preflight](#wave-0--preflight)
6. [Wave 1 — Static Contract Reconciliation](#wave-1--static-contract-reconciliation)
7. [Wave 2 — Requirement Provenance Guards](#wave-2--requirement-provenance-guards)
8. [Wave 3 — Preview and Confirmation Receipts](#wave-3--preview-and-confirmation-receipts)
9. [Wave 4 — Numbering, Path Authority, Historical Preservation](#wave-4--numbering-path-authority-historical-preservation)
10. [Wave 5 — Starter Scaffolds and Discuss-Phase Handoff](#wave-5--starter-scaffolds-and-discuss-phase-handoff)
11. [Wave 6 — Roadmapper Packet and No-Subagent Parity](#wave-6--roadmapper-packet-and-no-subagent-parity)
12. [Wave 7 — Response Receipts, Idempotency, Recovery](#wave-7--response-receipts-idempotency-recovery)
13. [Wave 8 — Final Parity and End-to-End Verification](#wave-8--final-parity-and-end-to-end-verification)
14. [Risk and Rollback](#risk-and-rollback)

---

## Context Summary

### What is being improved

Three Blueprint phase-admin commands that start or extend phase work and then route to `/blu-discuss-phase <phase>`:

| Command | Job | Numbering | Optional Agent | Write Set |
|---|---|---|---|---|
| `/blu-new-milestone` | Start next milestone from reviewed carry-forward evidence, scaffold starter top-level docs + first whole-number phase | Next whole integer after highest base phase | `blueprint-roadmapper` (optional, config-gated) | PROJECT, REQUIREMENTS, ROADMAP, phases/, STATE |
| `/blu-add-phase` | Append one whole-number phase to current milestone | Next whole integer | None | ROADMAP, phases/, STATE |
| `/blu-insert-phase` | Insert one decimal phase after an integer anchor | Next decimal under anchor | None | ROADMAP, REQUIREMENTS, phases/, STATE |

### Why these three together

They share a common quality spine: source-grounded intent → exact preview → explicit confirmation → MCP-owned mutation → returned metadata as authority → starter-only context scaffold → compact receipt → implemented-only next route. Improvements should standardize this spine while preserving command-specific semantics.

### Key source files

**Commands:**
- [commands/blu-new-milestone.toml](file:///Users/rhishi/dev/repositories/antigravity/blueprint/commands/blu-new-milestone.toml)
- [commands/blu-add-phase.toml](file:///Users/rhishi/dev/repositories/antigravity/blueprint/commands/blu-add-phase.toml)
- [commands/blu-insert-phase.toml](file:///Users/rhishi/dev/repositories/antigravity/blueprint/commands/blu-insert-phase.toml)

**Skill & references:**
- [skills/blueprint-roadmap-admin/SKILL.md](file:///Users/rhishi/dev/repositories/antigravity/blueprint/skills/blueprint-roadmap-admin/SKILL.md)
- `skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md`
- `skills/blueprint-roadmap-admin/references/insert-phase-runtime-contract.md`

**Agent:**
- `agents/blueprint-roadmapper.md`

**Runtime source:**
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/phase.ts` — roadmap add/insert, numbering logic
- `src/mcp/tools/artifacts.ts` — scaffold, seed types, path guards
- `src/mcp/tools/state.ts` — state update, route safety
- `src/mcp/tools/phase-numbering.ts` — shared normalization

**Docs:**
- `docs/commands/new-milestone.md`
- `docs/commands/add-phase.md`
- `docs/commands/insert-phase.md`
- `docs/MCP-TOOLS.md`
- `docs/RUNTIME-REFERENCE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/COMMAND-CATALOG.md`

**Tests:**
- `tests/new-milestone-metadata.test.ts`
- `tests/add-phase-metadata.test.ts`
- `tests/insert-phase-metadata.test.ts`
- `tests/roadmap-tools.test.ts`
- `tests/command-contract-docs.test.ts`
- `tests/command-catalog.test.ts`
- `tests/roadmap-admin-runtime-contract-resource.test.ts`
- `tests/extension-runtime-contracts.test.ts`
- `tests/agent-contract-specialists.test.ts`

---

## Existing Workflow Summary

### `/blu-new-milestone` — current behavior

1. **Read roadmap** via `blueprint_roadmap_read` to resolve current milestone and phase inventory.
2. **Read config** via `blueprint_config_get(scope: "effective")` to decide whether optional `blueprint-roadmapper` is allowed.
3. **Read milestone-summary contract** via `blueprint_artifact_contract_read(artifactId: "report.milestone-summary")`. If the matching report is missing → block with `missing-milestone-summary`.
4. **Build carry-forward digest** via `blueprint_artifact_summary_digest` with explicit repo-relative paths including `.blueprint/ROADMAP.md` and the milestone summary report. Treat returned `inputsUsed` as authoritative scope.
5. **Carry-forward is the default mode.** Switch to fresh reset only after explicit user intent. Use `ask_user` when ambiguous.
6. **Derive milestone name** from current milestone + carry-forward summary when user did not supply one. Show in confirmation gate before any write.
7. **Compute first new phase** as next integer after highest base phase number in roadmap.
8. **Read phase.context contract** before scaffolding first new phase context.
9. **Optional roadmapper pass** — only when config allows subagents and carry-forward benefits from grouped synthesis. Command still owns final phase numbers and writes.
10. **Require overwrite confirmation** via `ask_user` before replacing existing `PROJECT.md`, `REQUIREMENTS.md`, or `ROADMAP.md`.
11. **Scaffold starter docs** via `blueprint_artifact_scaffold` with carry-forward bootstrap seed. Includes PROJECT, REQUIREMENTS, ROADMAP, phases/, and first `NN-CONTEXT.md`. Scaffold text ≠ final authored content.
12. **Update STATE.md** via `blueprint_state_update(base: "synced")` — set new milestone, current phase, route to `/blu-discuss-phase <first phase>`.
13. **Return completion summary** — new milestone name, carry-forward/reset mode, first phase, warnings, next action.

**Waiting states:** `missing-milestone-summary`, `carry-forward-confirmation`, `starter-doc-overwrite-confirmation`.

**Required MCP tools:** `blueprint_roadmap_read`, `blueprint_artifact_contract_read`, `blueprint_artifact_summary_digest`, `blueprint_config_get`, `blueprint_artifact_scaffold`, `blueprint_state_update`.

### `/blu-add-phase` — current behavior

1. **Require** explicit phase description from user input.
2. **Read roadmap** — know active milestone, phase inventory, recovery warnings.
3. **Preview** the next integer phase number (highest base + 1, ignoring decimals). Choose durable requirement IDs, concrete objective, 2-5 success criteria. Confirm via `ask_user`.
4. **Mutate roadmap** via `blueprint_roadmap_add_phase` with confirmed `expectedPhaseNumber`, `requirementIds`, `goal`, `successCriteria`.
5. **Treat returned metadata** (`phaseNumber`, `phasePrefix`, `phaseDir`) as authoritative.
6. **Scaffold** `${phaseDir}/${phasePrefix}-CONTEXT.md` via `blueprint_artifact_scaffold`.
7. **Update state** — new phase current, route to `/blu-discuss-phase <phase>`.

**Waiting states:** `phase-number-confirmation`, `stale-phase-number`.

**Required MCP tools:** `blueprint_roadmap_read`, `blueprint_roadmap_add_phase`, `blueprint_artifact_scaffold`, `blueprint_state_update`.

### `/blu-insert-phase` — current behavior

1. **Require** explicit integer phase number + non-empty description.
2. **Read roadmap** — know active milestone, phase inventory, warnings.
3. **Preview** target phase, computed decimal insertion, objective, 2-5 success criteria, declared durable requirement IDs from `.blueprint/REQUIREMENTS.md`, no automatic renumbering notice. Confirm via `ask_user`.
4. **Mutate roadmap** via `blueprint_roadmap_insert_phase` — rejects decimal targets, derives next decimal, inserts roadmap entry with concrete Phase Details.
5. **Scaffold** `${phaseDir}/${phasePrefix}-CONTEXT.md`.
6. **Update state** — inserted decimal phase current, durable `roadmapEvolutionNotes` entry, route to `/blu-discuss-phase <phase>`.

**Waiting states:** `phase-insert-confirmation`, `invalid-insertion-anchor`, `conflicting-decimal-directory`.

**Required MCP tools:** `blueprint_roadmap_read`, `blueprint_roadmap_insert_phase`, `blueprint_artifact_scaffold`, `blueprint_state_update`.

### Common current behavior

All three commands:
- Use `interactive-read` execution profile
- Keep writes inside `.blueprint/`
- Do not use `update_topic`, `write_todos`, or tracker tools
- Route to `/blu-discuss-phase <phase>` — never to planned-only commands
- Treat scaffold text as starter material, not final authored content
- Preserve historical phase directories and numbering history

---

## Frontier Research Synthesis

The research document covers 8 research lanes (R1–R8) and 7 Blueprint-specific analyses (A1–A7). Below is the distilled set of improvement themes that drive the implementation plan.

### Theme 1 — Source-scoped carry-forward (R1, R4, A1)

**Problem:** `inputsUsed` proves which files were summarized but cannot explain which starter-doc claim came from which source section, which evidence was weak, or which old milestone details were intentionally dropped.

**Solution:** Introduce a `New Milestone Transition Packet` with structured categories: `validatedOutcomes`, `retainedDecisions`, `openRisks`, `deferredIdeas`, `candidateNextMilestoneThemes`, `nonCarryForwardItems`, `staleOrAmbiguousClaims`, and a claim-level `evidenceLedger` with source refs back to `inputsUsed`.

### Theme 2 — Outcome-framed milestones (R2, A5)

**Problem:** The first new phase is currently "next leftover task" rather than "nearest useful learning slice." No target outcome, measurable signals, or value gaps are explicitly captured.

**Solution:** Add an `outcomeFrame` to the starter seed: `targetOutcome`, `measurableSignals` (allowing "unknown: <reason>"), `unrealizedValueOrGaps`, `deliveryCapabilityConstraints`.

### Theme 3 — Trust-calibrated confirmation gates (R3, A2)

**Problem:** Confirmation gates are prose-only, lack evidence preview, and could lead to confirmation fatigue or rubber-stamping.

**Solution:** Make the three existing gate IDs (`missing-milestone-summary`, `carry-forward-confirmation`, `starter-doc-overwrite-confirmation`) evidence-backed with structured preview packets showing `inputsUsed`, affected paths, carry-forward highlights, uncertainty, and named choices (not generic OK/Cancel).

### Theme 4 — Requirement transition decisions (R4, A1, A5)

**Problem:** Regenerating `REQUIREMENTS.md` can silently copy, rewrite, or omit old requirements without making the disposition inspectable.

**Solution:** Add `requirementTransitions` rows with `decision` (carry/modify/defer/retire/new/self-derived/uncertain), `sourceRefs`, `rationale`, `uncertainty`. Each active requirement ID must exist in generated REQUIREMENTS rows.

### Theme 5 — Typed MCP contracts and receipts (R5, A3, A7)

**Problem:** Command success/failure depends on prose inference rather than structured tool results. `blueprint_artifact_scaffold` returns only `createdFiles`/`reusedFiles`/`warnings` — no per-path operation status.

**Solution:** Define preview packets, confirmation receipts, and completion receipts as shared vocabulary. Extend tool results with non-breaking fields where needed.

### Theme 6 — Bounded roadmapper delegation (R6, A4)

**Problem:** Roadmapper invocation lacks a typed handoff packet. It's easy to accidentally pass raw report text or chat history instead of curated evidence.

**Solution:** Define `NewMilestoneRoadmapperPacket` with digest scope, constraints, forbidden actions, and expected output shape. Parent command keeps all write authority. No-subagent fallback fills the same result shape inline.

### Theme 7 — Learning loops (R7, A5)

**Problem:** Carry-forward is mostly prose-level continuity that can preserve "shape" while losing the difference between validated outcomes, durable decisions, unresolved risks, and stale noise.

**Solution:** Add a compact `Milestone Learning Loop` block: `validatedLessons`, `systemImprovements`, `evidencePointers`, `successSignals`, `deferredLearning`, `doNotCarryForward`.

### Theme 8 — Idempotency and recovery (R8)

**Problem:** Partial failure (scaffold succeeds, state update fails) has no typed recovery path. Retry after confirmation could overwrite changed files.

**Solution:** Add a stable run token/parameter fingerprint, per-path scaffold receipt, precondition checks, and a recovery matrix. Same-token/different-parameter retries should block. Prefer forward recovery over automatic rollback.

### Theme 9 — Add-phase requirement grounding (A1, A2)

**Problem:** Plain `/blu-add-phase` currently allows requirement IDs that may not be declared in `.blueprint/REQUIREMENTS.md`.

**Solution:** Add MCP-level validation that requirement IDs are declared before roadmap mutation. Reserve audit-backed repair path separately.

### Theme 10 — Historical preservation as invariant (R2, R4, R7, R8, A3)

**Problem:** All improvements must preserve historical phase directories, numbering history, and prior milestone artifacts. This is a hard boundary that cuts across every wave.

**Solution:** Negative tests that no workflow deletes, renames, or renumbers historical phase directories. Completion receipts report `deletedPhaseDirectories: []` and `renamedPhaseDirectories: []`.

---

## Shared Vocabulary and Types

> [!NOTE]
> These types define the shared language used across all waves. If a field is model-built from tool output, say so in the command/skill text. If a field is returned by a tool, update source, docs, tests, and built assets together.

```ts
// --- Shared across all three commands ---

type PhaseAdminCommand =
  | "/blu-new-milestone"
  | "/blu-add-phase"
  | "/blu-insert-phase";

type PhaseAdminMutationKind =
  | "milestone-transition"
  | "whole-phase-append"
  | "decimal-phase-insert";

type PhaseAdminPreviewPacket = {
  command: PhaseAdminCommand;
  mutationKind: PhaseAdminMutationKind;
  activeMilestone: string;
  sourceScope: {
    roadmapPath: ".blueprint/ROADMAP.md";
    requirementsPath?: ".blueprint/REQUIREMENTS.md";
    milestoneSummaryPath?: string;
    inputsUsed?: string[];
    warnings: string[];
  };
  target: {
    phaseNumberPreview: string;
    phasePrefixPreview: string;
    phaseTitle: string;
    phaseDirPreview?: string;
    contextPathPreview?: string;
    insertionAnchor?: string;
  };
  grounding: {
    requirementIds: string[];
    objective: string;
    successCriteria: string[];   // 2-5 observable items
    uncertainty: string[];
  };
  historyPolicy: {
    preservesHistoricalPhaseDirectories: true;
    renumbersLaterPhases: false;
    deletesPriorPhaseArtifacts: false;
  };
  nextRoute: "/blu-discuss-phase <phase>";
};

type PhaseAdminConfirmationReceipt = {
  gateId:
    | "carry-forward-confirmation"
    | "starter-doc-overwrite-confirmation"
    | "phase-number-confirmation"
    | "phase-insert-confirmation";
  command: PhaseAdminCommand;
  selectedChoice: "approved" | "declined" | "revise";
  approvedPhaseNumber?: string;
  approvedInsertionAnchor?: string;
  approvedRequirementIds: string[];
  approvedObjective?: string;
  approvedSuccessCriteria?: string[];
  approvedMode?: "carry-forward" | "fresh-reset";
  approvedOverwritePaths?: string[];
  safeDefault: "stop-without-writing";
  routeOnDecline: "/blu-progress";
};

type PhaseAdminCompletionReceipt = {
  command: PhaseAdminCommand;
  status: "written" | "blocked" | "partial" | "reused";
  phaseNumber: string;
  phasePrefix: string;
  phaseDir: string;
  contextPath: string;
  roadmapPath?: ".blueprint/ROADMAP.md";
  requirementsPath?: ".blueprint/REQUIREMENTS.md";
  stateUpdated: boolean;
  createdFiles: string[];
  reusedFiles: string[];
  overwrittenFiles: string[];
  blockedFiles: string[];
  deletedPhaseDirectories: [];   // always empty — hard invariant
  renamedPhaseDirectories: [];   // always empty — hard invariant
  safeRetry: boolean;
  nextAction: "/blu-discuss-phase <phase>" | "/blu-progress";
  warnings: string[];
};

// --- Discuss-phase handoff (shared by all three senders) ---

type PhaseAdminDiscussHandoff = {
  command: PhaseAdminCommand;
  starterOnly: true;
  phaseNumber: string;
  phaseTitle: string;
  requirementIds: string[];
  objective: string;
  successCriteria: string[];
  sourceRefs: string[];
  openForDiscuss: string[];
  riskWatchlist: string[];
  deferredNotDoingNow: string[];
  routeReceipt: "/blu-discuss-phase <phase>";
};

// --- new-milestone specific ---

type NewMilestoneTransitionPacket = {
  packetVersion: "new-milestone-transition/v1";
  sourceScope: {
    previousMilestone: string;
    targetMilestoneProposal: string | null;
    summaryPath: string;
    roadmapPath: ".blueprint/ROADMAP.md";
    inputsUsed: string[];
    missingOrSkippedInputs: string[];
    digestWarnings: string[];
  };
  carryForwardDigest: {
    validatedOutcomes: string[];
    retainedDecisions: string[];
    openRisks: string[];
    deferredIdeas: string[];
    candidateNextMilestoneThemes: string[];
    nonCarryForwardItems: string[];
    staleOrAmbiguousClaims: string[];
  };
  requirementTransitions: Array<{
    priorRequirementId?: string;
    newRequirementId?: string;
    decision: "carry" | "modify" | "defer" | "retire"
            | "new" | "self-derived" | "uncertain";
    sourceRefs: string[];
    rationale: string;
    uncertainty: "low" | "medium" | "high";
  }>;
  evidenceLedger: Array<{
    claimId: string;
    category: string;
    claim: string;
    sourcePath: string;
    sourceHeading: string;
    decision: "carry" | "modify" | "defer" | "retire"
            | "new" | "drop" | "uncertain";
    confidence: "low" | "medium" | "high";
    usedBy: Array<"PROJECT" | "REQUIREMENTS" | "ROADMAP"
                 | "phase.context" | "confirmation-preview">;
    uncertainty: string;
  }>;
};

// --- add-phase specific ---

type AddPhaseAppendPacket = PhaseAdminPreviewPacket & {
  command: "/blu-add-phase";
  mutationKind: "whole-phase-append";
  expectedPhaseNumber: string;
  requirementSource: ".blueprint/REQUIREMENTS.md" | "auditBackedDetails";
  auditBackedDetailsUsed: boolean;
};

// --- insert-phase specific ---

type InsertPhasePacket = PhaseAdminPreviewPacket & {
  command: "/blu-insert-phase";
  mutationKind: "decimal-phase-insert";
  insertionAnchor: string;
  nextDecimalCandidate: string;
  requirementSource: ".blueprint/REQUIREMENTS.md";
  laterPhaseRenumberingAcknowledged: true;
  roadmapEvolutionNote: string;
};
```

---

## Implementation Rules (all waves)

> [!WARNING]
> Every wave must follow these rules. Violations block merge.

1. Start in a **fresh worktree/branch**. Run `npm ci` before any `npm run build`, `npm run typecheck`, or `npm test`.
2. Implement **one wave at a time**. If a wave feels large, split into: docs/static tests first → runtime source → built assets.
3. Keep command status and routing semantics **unchanged** unless the user explicitly asks for a routing/status change.
4. For every source wave, update matching docs/tests/runtime metadata and run `npm run typecheck`, `npm run build`, focused `tsx --test ...`, and `git diff --check`.
5. Include tracked `dist/` output when source changes affect the extension runtime bundle.
6. Use **stable field names and behavior-class tests**. Avoid brittle full-sentence regexes unless the exact user-visible wording is the behavior under test.
7. Line numbers below are current anchors. If they drift, anchor by section heading, exported symbol, command name, or test name.
8. **Stop and re-plan** if implementation would require: a new MCP state owner, a durable receipt store, broad artifact schema expansion, or changed root-router availability.
9. Do not hand-edit `.blueprint/` except inside isolated test fixtures.
10. Do not use GSD, Blueprint slash workflow, `update_topic`, `write_todos`, or task tracker tools to do the work.

---

## Wave 0 — Preflight

**Objective:** Make the implementation branch safe before any production edit.

**Themes addressed:** None — infrastructure only.

**Estimated scope:** ~15 min, no file edits.

### Task 0.1 — Create worktree and install dependencies

**Type:** Sequential  
**Dependencies:** None  
**Files touched:** None (worktree setup only)

**Steps:**
1. Create a fresh worktree from `main`:
   ```bash
   git worktree add ../blueprint-phase-admin-improvements -b feat/phase-admin-improvements
   ```
2. Move into the worktree (all subsequent work happens here).
3. Install dependencies:
   ```bash
   npm ci
   ```
4. Confirm the active branch:
   ```bash
   git status --short --branch
   ```

**Exit criteria:** Clean worktree with `node_modules/` installed. No uncommitted changes.

### Task 0.2 — Classify first slice

**Type:** Sequential  
**Dependencies:** Task 0.1  
**Files touched:** None

**Steps:**
1. Decide whether the first wave is docs/static-contract only, command/skill prompt only, or runtime source.
2. If runtime source is needed, identify exact `dist/` outputs before editing.
3. For this plan, Wave 1 is docs/static-contract + tests — no `src/` changes unless runtime metadata parity repair is needed.

**Exit criteria:** Implementor knows the first slice scope.

### Task 0.3 — Search preflight (parallel-safe)

**Type:** Parallel-safe  
**Dependencies:** Task 0.1  
**Files touched:** None

**Steps — run these searches to baseline the state:**

```bash
# Inventory of all phase-admin mentions
rg -n "new-milestone|add-phase|insert-phase|blueprint_config_get|route to requirements|<NN-CONTEXT|phase-number-confirmation|phase-insert-confirmation" commands docs skills agents src tests

# MCP tool references
rg -n "blueprint_roadmap_add_phase|blueprint_roadmap_insert_phase|blueprint_artifact_scaffold|blueprint_state_update" src/mcp tests docs skills commands

# Forbidden patterns (should find zero matches in production code)
rg -n "update_topic|write_todos|task tracker|tracker-backed|long-running progress" commands docs skills agents src tests

# Branch state
git status --short --branch
```

**Exit criteria:** Implementor has baseline search results. No unrelated files changed.

---

## Wave 1 — Static Contract Reconciliation

**Objective:** Align static contracts and inventories for all three workflows before runtime behavior changes.

**Themes addressed:** Theme 3 (confirmation gates), Theme 5 (typed contracts), Theme 7 (learning loops), Theme 10 (historical preservation).

**Estimated scope:** ~1-2 hours. Touches docs, skills, manifests, tests. May touch `src/mcp/command-runtime-metadata.ts` for parity repair.

### Task 1.1 — Create one phase-admin contract map

**Type:** Sequential  
**Dependencies:** Wave 0 complete

**Files to edit:**

| File | What to do |
|---|---|
| `docs/commands/new-milestone.md` | Add/normalize shared spine language: roadmap read first, exact preview, confirmation gate, MCP mutation only, scaffold starter context only, state update after scaffold, `/blu-discuss-phase <phase>` route, no tracker tools |
| `docs/commands/add-phase.md` | Same spine language, preserving add-phase specifics (no subagent, `expectedPhaseNumber`, requirement source) |
| `docs/commands/insert-phase.md` | Same spine language, preserving insert-phase specifics (integer anchor, decimal insert, no renumbering, requirement mapping, evolution note) |
| `skills/blueprint-roadmap-admin/SKILL.md` | Normalize `new-milestone`, `add-phase`, `insert-phase` checklist sections to use consistent preview → confirm → mutate → scaffold → state → route terminology |
| `docs/MCP-TOOLS.md` | Ensure the `new-milestone` tool summary row mentions `blueprint_config_get` |
| `docs/RUNTIME-REFERENCE.md` | Ensure `new-milestone` row lists `blueprint_config_get` in exact MCP destination |
| `docs/COMMAND-CATALOG.md` | Update only write/risk summaries if changed — do not encode packet internals |

**Concrete edits for the shared spine:**

Each command doc should describe the flow as:
1. Read roadmap state first
2. Show exact preview with evidence (source scope, phase target, requirement grounding)
3. Require explicit confirmation via named gate before any mutation
4. Mutate only through MCP tools — never through direct `.blueprint/` file writes
5. Scaffold starter context only — it is not final authored content
6. Update state after scaffold — state never points to a non-existent context path
7. Route to `/blu-discuss-phase <phase>` — never to planned-only or shortcut commands
8. Do not use tracker tools, long-running flows, or branching progress posture

### Task 1.2 — Fix known parity drift

**Type:** Sequential  
**Dependencies:** Task 1.1

**Concrete parity fixes:**

**Fix A — `blueprint_config_get` in new-milestone inventories:**

The manifest (`commands/blu-new-milestone.toml`) and runtime metadata already require `blueprint_config_get`, but these doc-facing inventories omit it:

| File | Location | Fix |
|---|---|---|
| `src/mcp/command-runtime-metadata.ts` | `spec.reads` near lines 1098-1102 | Add `blueprint_config_get -> effective config` |
| `docs/commands/new-milestone.md` | reads/tools near lines 49-74 | Add `blueprint_config_get` to required tools list |
| `docs/RUNTIME-REFERENCE.md` | line 109 | Add `blueprint_config_get` to exact MCP destination |
| `docs/MCP-TOOLS.md` | line 193 | Add `blueprint_config_get` to new-milestone tool summary |
| `skills/blueprint-roadmap-admin/SKILL.md` | required-tool list near lines 79-94 | Add `blueprint_config_get` |

**Fix B — Stale "route to requirements" language:**

| File | Location | Fix |
|---|---|---|
| `docs/commands/new-milestone.md` | line 20 | Replace "route to requirements" with "seed starter milestone docs and route to `/blu-discuss-phase <first phase>`" |

**Fix C — Insert-phase requirement write surface:**

| File | Location | Fix |
|---|---|---|
| `docs/commands/insert-phase.md` | write surface section | Ensure docs mention `.blueprint/REQUIREMENTS.md` when describing requirement traceability writes |
| `docs/COMMAND-CATALOG.md` | insert-phase row | Update key writes if not already mentioning REQUIREMENTS |

**Fix D — Add-phase requirement source documentation:**

| File | Location | Fix |
|---|---|---|
| `docs/commands/add-phase.md` | requirement grounding section | Clarify that requirement IDs come from `.blueprint/REQUIREMENTS.md`; reserve roadmap-derived IDs for already-declared roadmap mappings or audit-backed repair details |

### Task 1.3 — Strengthen static tests (parallel-safe)

**Type:** Parallel-safe after Task 1.2  
**Dependencies:** Task 1.2

**Files to edit:**

| Test file | Assertions to add/strengthen |
|---|---|
| `tests/new-milestone-metadata.test.ts` | Assert manifest/skill/runtime metadata mention `blueprint_config_get` for optional roadmapper gating |
| `tests/add-phase-metadata.test.ts` | Assert no optional subagents, requirement source mentions `.blueprint/REQUIREMENTS.md` |
| `tests/insert-phase-metadata.test.ts` | Assert no optional subagents, `.blueprint/REQUIREMENTS.md` write surface in docs |
| `tests/command-contract-docs.test.ts` | Assert new-milestone docs do not say "route to requirements", all three docs mention shared spine steps |
| `tests/command-catalog.test.ts` | Assert required tool sets match runtime metadata, config-gate invariant preserved |
| `tests/roadmap-admin-runtime-contract-resource.test.ts` | Preserve docless guarantee — no `docs/` paths in runtime `skillInputs.effective` |

**Test style rules:**
- Assert stable identifiers (tool IDs, field names, gate IDs), not broad prose patterns
- Avoid brittle full-sentence regexes
- Use `describe`/`it` blocks that name the behavior class being tested

### Task 1.4 — Verify Wave 1

**Type:** Sequential  
**Dependencies:** Tasks 1.1–1.3

**If no `src/` changes:**
```bash
npx tsx --test tests/new-milestone-metadata.test.ts tests/add-phase-metadata.test.ts tests/insert-phase-metadata.test.ts tests/command-contract-docs.test.ts tests/command-catalog.test.ts tests/roadmap-admin-runtime-contract-resource.test.ts
git diff --check
```

**If `src/mcp/command-runtime-metadata.ts` changed:**
```bash
npm run typecheck
npm run build
npx tsx --test tests/new-milestone-metadata.test.ts tests/add-phase-metadata.test.ts tests/insert-phase-metadata.test.ts tests/command-contract-docs.test.ts tests/command-catalog.test.ts tests/roadmap-admin-runtime-contract-resource.test.ts tests/extension-runtime-contracts.test.ts
git diff --check
```

**Exit criteria:**
- [ ] All three commands describe the same phase-admin spine
- [ ] Their differences are explicit and tested
- [ ] Root routing and implemented status unchanged
- [ ] `blueprint_config_get` appears in all new-milestone inventories
- [ ] No "route to requirements" stale language remains
- [ ] Tests pass

---

## Wave 2 — Requirement Provenance Guards

**Objective:** Make requirement grounding explicit for all three workflows without creating a heavy traceability system.

**Themes addressed:** Theme 4 (requirement transitions), Theme 9 (add-phase requirement grounding).

**Estimated scope:** ~2-3 hours. Touches docs, skills, `src/mcp/tools/phase.ts`, tests.

### Task 2.1 — Define requirement decision model in contracts

**Type:** Sequential  
**Dependencies:** Wave 1 complete

**Files to edit:**

| File | What to do |
|---|---|
| `docs/commands/new-milestone.md` | Introduce `requirementTransitions` inside the carry-forward contract as starter-seed evidence (not final requirement mapping) |
| `docs/commands/add-phase.md` | Require plain-append requirement IDs to be declared in `.blueprint/REQUIREMENTS.md` before mutation. Reserve audit-backed repair path separately with `auditBackedDetails.repairRequirementIds` |
| `docs/commands/insert-phase.md` | Preserve existing strictness: IDs must be declared in `.blueprint/REQUIREMENTS.md`, must not be `none yet` or placeholders, must not already be mapped to another roadmap phase |
| `skills/blueprint-roadmap-admin/SKILL.md` | Add requirement-source rules under each command's checklist |
| Add/insert runtime reference files | Update stage mappings to document the requirement validation step |

**Requirement decision vocabulary for new-milestone:**

```ts
type RequirementTransitionDecision =
  | "carry"         // Validated, kept with same or updated ID
  | "modify"        // Requirement changed in scope or wording
  | "defer"         // Not in next milestone, kept in backlog
  | "retire"        // Completed or intentionally dropped
  | "new"           // Brand new requirement for next milestone
  | "self-derived"  // Inferred from evidence, not from prior requirement
  | "uncertain";    // Disposition unclear, flagged for discuss-phase
```

Each transition row must cite `sourceRefs` and `rationale`. Uncertainty must be labeled, not hidden.

### Task 2.2 — Add the add-phase MCP requirement guard

**Type:** Sequential  
**Dependencies:** Task 2.1

**Files to edit:**

| File | Anchor | What to do |
|---|---|---|
| `src/mcp/tools/phase.ts` | Requirement table parsing helpers near line 2074-2284 | Reuse or extract insert-phase's existing declared-ID validation. Add a non-mutating helper for plain add-phase that validates `requirementIds` against `.blueprint/REQUIREMENTS.md` before `materializePhaseDirectory` or ROADMAP writes |
| `src/mcp/tools/phase.ts` | `blueprint_roadmap_add_phase` handler near line 5544-5741 | Call the requirement validation helper before mutation. On undeclared IDs → return error before ROADMAP, REQUIREMENTS, phase directory, or state changes |

**Behavior specification:**

```
Input: requirementIds = ["REQ-PERF-01", "REQ-UX-03"]
.blueprint/REQUIREMENTS.md declares: REQ-PERF-01, REQ-SEC-02, REQ-UX-03

→ Both IDs found → proceed to mutation

Input: requirementIds = ["REQ-PERF-01", "REQ-UNKNOWN-99"]
.blueprint/REQUIREMENTS.md declares: REQ-PERF-01, REQ-SEC-02

→ REQ-UNKNOWN-99 not declared → return error, no mutation

Input: auditBackedDetails present with repairRequirementIds
→ Skip normal requirement declaration check, use audit-backed path
```

**Preservations:**
- Insert-phase requirement validation remains unchanged (it already has this strictness)
- Audit-backed repair behavior stays separate and is not broken by this guard

### Task 2.3 — Add behavior tests (parallel-safe)

**Type:** Parallel-safe after Task 2.2  
**Dependencies:** Task 2.2

**Files to edit:**

| Test file | Test cases to add |
|---|---|
| `tests/roadmap-tools.test.ts` (near add-phase section, line ~572-725) | **add-phase rejects undeclared IDs:** create fixture with REQUIREMENTS declaring `REQ-01`, `REQ-02`; call add-phase with `requirementIds: ["REQ-01", "REQ-MISSING"]`; assert error returned, no ROADMAP mutation, no phase directory created |
| `tests/roadmap-tools.test.ts` | **add-phase accepts declared IDs:** same fixture, call with `requirementIds: ["REQ-01"]`; assert ROADMAP entry written, phase directory created |
| `tests/roadmap-tools.test.ts` | **add-phase keeps audit-backed repair intact:** call with `auditBackedDetails` present; assert bypass of normal requirement check |
| `tests/roadmap-tools.test.ts` (near insert-phase section, line ~974-1238) | **insert-phase still rejects undeclared and already-mapped IDs:** regression test — confirm existing behavior unchanged |
| `tests/new-milestone-metadata.test.ts` | **new-milestone contract mentions requirementTransitions:** assert command docs and skill mention requirement transition rows as starter seed only |

### Task 2.4 — Verify Wave 2

**Type:** Sequential  
**Dependencies:** Tasks 2.1–2.3

```bash
npm run typecheck
npm run build
npx tsx --test tests/roadmap-tools.test.ts tests/add-phase-metadata.test.ts tests/insert-phase-metadata.test.ts tests/new-milestone-metadata.test.ts tests/command-contract-docs.test.ts
git diff --check
```

**Exit criteria:**
- [ ] Plain add-phase cannot persist arbitrary undeclared requirement IDs
- [ ] Insert-phase strictness unchanged
- [ ] New-milestone requirement transitions remain source-scoped starter evidence, not a competing REQUIREMENTS write path
- [ ] Audit-backed repair behavior intact
- [ ] Tests pass

---

## Wave 3 — Preview and Confirmation Receipts

**Objective:** Make approval gates specific enough to audit and retry safely.

**Themes addressed:** Theme 3 (trust-calibrated confirmation), Theme 5 (typed receipts).

**Estimated scope:** ~1-2 hours. Touches command manifests, docs, skill, tests.

### Task 3.1 — Define command-specific preview packets

**Type:** Sequential  
**Dependencies:** Wave 2 complete

**Files to edit:**

| File | What to do |
|---|---|
| `commands/blu-new-milestone.toml` | Add preview packet before confirmation: source summary path, `inputsUsed`, carry-forward/reset mode, proposed milestone name, first phase preview, affected starter paths, overwrite risk, safe default |
| `commands/blu-add-phase.toml` | Add preview packet: `expectedPhaseNumber`, description, declared requirement IDs, objective, 2-5 success criteria, source warnings, scaffold target, safe default |
| `commands/blu-insert-phase.toml` | Add preview packet: integer anchor, next decimal candidate, declared requirement IDs, objective, 2-5 success criteria, no-renumbering acknowledgment, dependency-review note, scaffold target, safe default |
| Command docs (all three) | Document preview packet content and structure |
| `skills/blueprint-roadmap-admin/SKILL.md` | Add preview-before-confirm requirement to each command's checklist |

**Preview packet example for add-phase (what user sees before confirming):**

```text
Phase Admin Preview — /blu-add-phase

Milestone: Blueprint Defect Discovery
Next phase: 8 — Automated Regression Suite
Requirement IDs: REQ-TEST-01, REQ-CI-03
  Source: .blueprint/REQUIREMENTS.md
Objective: Build automated regression test coverage for shipped commands
Success criteria:
  1. All shipped commands have at least one happy-path behavior test
  2. Mutation tools reject stale input in focused test cases
  3. CI runs full test suite on every PR
Scaffold target: .blueprint/phases/08-automated-regression-suite/08-CONTEXT.md
Safe default: stop without writing

Approve this phase? [yes / revise / decline]
```

### Task 3.2 — Standardize confirmation receipts

**Type:** Sequential  
**Dependencies:** Task 3.1

**Gate IDs remain command-specific and current:**

| Gate ID | Command | When used |
|---|---|---|
| `carry-forward-confirmation` | new-milestone | Before scaffold after carry-forward digest |
| `starter-doc-overwrite-confirmation` | new-milestone | Before overwriting existing PROJECT/REQUIREMENTS/ROADMAP |
| `phase-number-confirmation` | add-phase | Before appending to roadmap |
| `phase-insert-confirmation` | insert-phase | Before inserting decimal phase |

**Existing blocker names preserved:**
- `stale-phase-number` (add-phase)
- `invalid-insertion-anchor` (insert-phase)
- `conflicting-decimal-directory` (insert-phase)
- `stale-first-phase-number` (new-milestone)
- `missing-milestone-summary` (new-milestone)

**Decline behavior:**
- Decline stops without mutation
- Routes to `/blu-progress` when a safe command route is needed
- Receipt binds approved preview to later MCP arguments (no gap between what user approved and what gets written)

**Files to edit:**

| File | What to do |
|---|---|
| `commands/blu-new-milestone.toml` | Add receipt-binds-preview language between confirmation and scaffold steps |
| `commands/blu-add-phase.toml` | Same — approved preview fields feed into `blueprint_roadmap_add_phase` arguments |
| `commands/blu-insert-phase.toml` | Same — approved preview fields feed into `blueprint_roadmap_insert_phase` arguments |
| Command docs (all three) | Document confirmation receipt structure |
| `skills/blueprint-roadmap-admin/SKILL.md` | Add confirmation receipt rules to output section |

### Task 3.3 — Test bypass resistance (parallel-safe)

**Type:** Parallel-safe after Task 3.2  
**Dependencies:** Task 3.2

**Files to edit:**

| Test file | Test cases to add |
|---|---|
| `tests/new-milestone-metadata.test.ts` | Assert command contract mentions confirmation gates by name (`carry-forward-confirmation`, `starter-doc-overwrite-confirmation`), mentions safe default behavior |
| `tests/add-phase-metadata.test.ts` | Assert manifest requires confirmation before `blueprint_roadmap_add_phase`, mentions `expectedPhaseNumber` in preview |
| `tests/insert-phase-metadata.test.ts` | Assert manifest does not accept decimal anchors, requires confirmation before mutation |
| `tests/roadmap-tools.test.ts` | Assert add-phase with stale `expectedPhaseNumber` blocks with no writes. Assert insert-phase decimal anchor rejected at tool level |
| `tests/command-contract-docs.test.ts` | Assert all three docs describe safe default as stop-without-writing |

### Task 3.4 — Verify Wave 3

**Type:** Sequential  
**Dependencies:** Tasks 3.1–3.3

```bash
npm run typecheck
npm run build
npx tsx --test tests/new-milestone-metadata.test.ts tests/add-phase-metadata.test.ts tests/insert-phase-metadata.test.ts tests/roadmap-tools.test.ts tests/command-contract-docs.test.ts
git diff --check
```

**Exit criteria:**
- [ ] Every mutating command has an exact preview and named approval gate
- [ ] Tests prove stale or invalid confirmations do not silently mutate
- [ ] Command prompts do not rely on generic prose-only consent
- [ ] Tests pass

---

## Wave 4 — Numbering, Path Authority, Historical Preservation

**Objective:** Put safety-critical phase number and path decisions on shared helpers or MCP receipts instead of prompt-only reasoning.

**Themes addressed:** Theme 5 (typed contracts), Theme 10 (historical preservation).

**Estimated scope:** ~3-4 hours. Touches `src/mcp/tools/phase-numbering.ts`, `src/mcp/tools/phase.ts`, `src/mcp/tools/artifacts.ts`, `src/mcp/tools/state.ts`, tests.

### Task 4.1 — Share next-whole-number logic

**Type:** Sequential  
**Dependencies:** Wave 3 complete

**Files to edit:**

| File | Anchor | What to do |
|---|---|---|
| `src/mcp/tools/phase-numbering.ts` | lines 19-50, 89-97 | Extract or reuse the highest-base integer logic already used by add-phase. Expose a `computeNextWholePhaseNumber(roadmapPhases)` helper |
| `src/mcp/tools/phase.ts` | add-phase handler near line 5544-5741 | Refactor to use the shared helper |

**Numbering rules (must be codified in the helper):**
- Decimal phases (e.g., `2.1`, `2.2`) count only toward their base; they do not affect the next whole number
- Gaps are preserved: history `1, 2, 4` → next whole number is `5`, not `3`
- Empty or malformed ROADMAP blocks unless a later source slice explicitly defines safe Phase 1 initialization

**Test cases for the helper:**

| Input phases | Expected next whole |
|---|---|
| `[1, 2, 3]` | `4` |
| `[1, 2, 2.1, 2.2, 3]` | `4` |
| `[1, 2, 4]` | `5` |
| `[1, 2.1, 2.2]` | `3` |
| `[]` (empty) | Block with error |

### Task 4.2 — Add new-milestone first-phase commit guard

**Type:** Sequential  
**Dependencies:** Task 4.1

**Files to edit:**

| File | Anchor | What to do |
|---|---|---|
| `src/mcp/tools/artifacts.ts` | Scaffold handler near line 8783-8868, seed types near 130-182 | Add new-milestone-specific path guard that computes and receipts: `highestBasePhaseNumber`, `firstPhaseNumber`, `firstPhasePrefix`, `firstPhaseDir`, `firstContextPath` |
| `src/mcp/tools/state.ts` | State update near lines 847-857, 2480-2533 | Add consistency check: state route must not point to missing context path |

**Commit guard behavior:**

```
Before scaffold commit:
1. Re-read ROADMAP (not cached copy)
2. Compute firstPhaseNumber via shared helper
3. Check: firstPhaseNumber matches previewed number → proceed
4. Check: firstPhaseDir does not already exist on disk → proceed
5. Check: firstContextPath does not contain user-authored content
   (unless overwrite approval gate passed) → proceed
6. If any check fails → block, report exact blocker, no writes

After scaffold commit:
7. Report deletedPhaseDirectories: [] (always empty)
8. Report renamedPhaseDirectories: [] (always empty)
```

### Task 4.3 — Preserve add/insert authority (parallel-safe)

**Type:** Parallel-safe after Task 4.2  
**Dependencies:** Task 4.2

**Verification — no changes needed, just confirm:**
- Add-phase keeps `blueprint_roadmap_add_phase` as authority for `phaseNumber`, `phasePrefix`, `phaseDir`, `roadmapPath`
- Insert-phase keeps `blueprint_roadmap_insert_phase` as authority for decimal suffix, canonical directory, requirement mapping, no downstream renumbering
- No prompt text hand-builds slugs or paths except from returned MCP fields

### Task 4.4 — Add behavior tests (parallel-safe)

**Type:** Parallel-safe after Task 4.2  
**Dependencies:** Task 4.2

**Files to edit:**

| Test file | Test cases to add |
|---|---|
| `tests/roadmap-tools.test.ts` or new `tests/phase-numbering.test.ts` | **new-milestone decimal history:** phases `[1, 2.1, 2.2]` → first whole phase `3` |
| Same | **new-milestone gapped history:** phases `[1, 2, 4]` → first whole phase `5`, gaps preserved |
| Same | **new-milestone stale preview blocks:** previewed first phase changed between preview and commit → no writes |
| Same | **new-milestone conflicting first-phase directory:** `.blueprint/phases/03-...` already exists → block |
| Same | **new-milestone ambiguous directory:** multiple directories match computed prefix → block |
| Same | **state update rejects missing context path:** state route points to `<dir>/<prefix>-CONTEXT.md` that doesn't exist → block |
| `tests/roadmap-tools.test.ts` | **add-phase stale expectedPhaseNumber:** confirm existing behavior unchanged — blocks with no writes |
| Same | **add-phase returned metadata drives scaffold:** confirm scaffold path comes from tool result, not prompt computation |
| Same | **insert-phase decimal target rejected:** confirm existing behavior unchanged |
| Same | **insert-phase conflicting decimal directory:** confirm existing behavior unchanged |
| Same | **insert-phase no renumbering:** confirm later phases untouched |

### Task 4.5 — Verify Wave 4

**Type:** Sequential  
**Dependencies:** Tasks 4.1–4.4

```bash
npm run typecheck
npm run build
npx tsx --test tests/roadmap-tools.test.ts tests/new-milestone-metadata.test.ts tests/add-phase-metadata.test.ts tests/insert-phase-metadata.test.ts tests/command-contract-docs.test.ts tests/command-catalog.test.ts
git diff --check
```

**Exit criteria:**
- [ ] New-milestone no longer depends on prompt-only first-path computation
- [ ] Add-phase and insert-phase keep their existing MCP metadata authority
- [ ] No workflow deletes, renames, or renumbers historical phase directories
- [ ] Shared numbering helper handles all documented edge cases
- [ ] Tests pass

---

## Wave 5 — Starter Scaffolds and Discuss-Phase Handoff

**Objective:** Make the scaffold useful as starter evidence while preserving `/blu-discuss-phase` as the final context author.

**Themes addressed:** Theme 1 (source-scoped carry-forward), Theme 2 (outcome framing), Theme 7 (learning loops).

**Estimated scope:** ~2-3 hours. Touches manifests, skills, docs, potentially `src/mcp/tools/artifacts.ts`, tests.

### Task 5.1 — Add new-milestone starter seed and first-phase handoff

**Type:** Sequential  
**Dependencies:** Wave 4 complete

**Files to edit:**

| File | What to do |
|---|---|
| `commands/blu-new-milestone.toml` | Add `New Milestone First-Phase Handoff Packet` build step between digest and scaffold. Packet contains: mode, fromMilestone, toMilestone, firstPhase target, digestInputsUsed, retainedDecisions, activeRequirementTransitions, openForDiscuss, riskWatchlist, deferredNotDoingNow, canonicalReferences, routeReceipt |
| `skills/blueprint-roadmap-admin/SKILL.md` | Add packet fields and no-over-authoring guardrails under `new-milestone` checklist |
| `src/mcp/tools/artifacts.ts` (if seed becomes typed input) | Extend scaffold input/rendering path with typed `firstPhaseHandoff` or equivalent — only if implementation wants deterministic seeded content |
| `docs/ARTIFACT-SCHEMA.md` | Document starter-vs-final context rule |

**Over-authoring guardrails (must be in manifest/skill):**

- Cap the handoff packet to roughly 12-18 bullets total
- Do not write final implementation decisions for unresolved first-phase gray areas — use `openForDiscuss` with confidence and consequence instead
- Do not infer codebase facts not in the digest or refreshed repo evidence — mark unverified claims as assumptions
- Preserve deferred material as `deferredNotDoingNow`, `riskWatchlist`, or `openForDiscuss`; do not collapse into "none"
- Map packet content into existing `phase.context` model sections:

| Packet field | Maps to context section |
|---|---|
| `firstPhase` | `phaseBoundary` |
| `mode`, milestone transition, retained decisions | `discoveryGrounding` |
| Confirmed carry-forward decisions only | `implementationDecisions` |
| User/source examples | `specificIdeas` |
| Known reusable/gap evidence | `existingCodeInsights` |
| `digestInputsUsed`, required follow-up reads | `dependencies` |
| `openForDiscuss` | `openQuestions` |
| `deferredNotDoingNow` and unresolved risks | `deferredIdeas` |
| `canonicalReferences` | `canonicalReferences` |

### Task 5.2 — Add smaller add/insert handoffs

**Type:** Sequential  
**Dependencies:** Task 5.1

**Add-phase handoff fields:**
- Returned phase number/title
- Declared requirement IDs
- Confirmed objective
- Success criteria
- Source refs
- Open items for discuss-phase

**Insert-phase handoff fields:**
- Decimal phase number/title
- Anchor phase
- Declared requirement IDs
- No-renumbering/dependency-review note
- Roadmap evolution note summary
- Open risks and dependency questions

**Files to edit:**

| File | What to do |
|---|---|
| `commands/blu-add-phase.toml` | Add handoff fields to completion response (before route instruction) |
| `commands/blu-insert-phase.toml` | Add handoff fields including dependency-review note |
| Add/insert runtime reference files | Document handoff field expectations |
| `skills/blueprint-roadmap-admin/SKILL.md` | Add handoff output requirements to add/insert command checklists |

**Rules:**
- Keep both handoffs compact — they are starter seed, not final authored context
- Do not make add/insert author final `XX-CONTEXT.md` — that is `/blu-discuss-phase`'s job

### Task 5.3 — Add discuss-phase receiver rules

**Type:** Sequential  
**Dependencies:** Task 5.2

**Files to edit:**

| File | What to do |
|---|---|
| `commands/blu-discuss-phase.toml` | Add receiver rules: when selected phase was just scaffolded by new/add/insert, read the starter handoff as seed evidence before asking questions |
| `skills/blueprint-phase-discovery/SKILL.md` | Add mapping rules for processing starter handoff into final `phase.context` model |
| `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` | Add rules near single-agent fallback and artifact authoring sections |

**Receiver behavior:**
1. Read first-phase handoff as seed evidence — treat it as disposable starter material
2. Carry forward source refs, deferred risks, and open gray areas into structured `phase.context` model
3. **Do not preserve:** packet heading, scaffold footer, placeholder labels, unsupported claims
4. Ask only for missing, contradictory, uncertain, or high-impact details
5. If packet marks an assumption with consequence-if-wrong → either confirm with user, convert to implementation decision with evidence, or keep in Open Questions/Deferred Ideas
6. After writing context, report refreshed `derivedStatus.nextAction` exactly — do not infer `/blu-plan-phase` from context completion

### Task 5.4 — Add tests (parallel-safe)

**Type:** Parallel-safe after Task 5.3  
**Dependencies:** Task 5.3

| Test file | Test cases |
|---|---|
| `tests/phase-discovery-discuss.test.ts` | **starter handoff consumed but not preserved verbatim:** seed a first-phase handoff, run context write path, assert final context preserves canonical references, open questions, and deferred ideas while removing scaffold packet text |
| Same | **anti-pattern: final context drops deferred risks:** assert blocking — packet-marked deferred risks must survive in final context |
| Same | **anti-pattern: final context copies packet verbatim:** assert blocking — scaffold labels and packet headings must not appear in final context |
| `tests/new-milestone-metadata.test.ts` | Assert first-phase handoff fields in command contract |
| `tests/add-phase-metadata.test.ts` | Assert add-phase remains starter-only and routes to discuss-phase |
| `tests/insert-phase-metadata.test.ts` | Assert insert-phase dependency-review handoff exists |
| `tests/command-contract-docs.test.ts` | Assert no command routes directly to plan/execute shortcuts |

### Task 5.5 — Verify Wave 5

**Type:** Sequential  
**Dependencies:** Tasks 5.1–5.4

```bash
npm run typecheck
npm run build
npx tsx --test tests/phase-discovery-discuss.test.ts tests/new-milestone-metadata.test.ts tests/add-phase-metadata.test.ts tests/insert-phase-metadata.test.ts tests/command-contract-docs.test.ts tests/artifact-contracts.test.ts tests/built-schema-assets.test.ts
git diff --check
```

**Exit criteria:**
- [ ] Starter context helps `/blu-discuss-phase` without becoming final context
- [ ] Deferred risks and requirement grounding survive handoff
- [ ] Scaffold or packet text is not copied verbatim into final context
- [ ] Tests pass

---

## Wave 6 — Roadmapper Packet and No-Subagent Parity

**Objective:** Make optional delegation safe for `/blu-new-milestone` only.

**Themes addressed:** Theme 6 (bounded roadmapper delegation).

**Estimated scope:** ~1-2 hours. Touches manifest, skill, agent doc, runtime metadata, tests.

### Task 6.1 — Define the roadmapper packet/result

**Type:** Sequential  
**Dependencies:** Wave 5 complete

**Files to edit:**

| File | What to do |
|---|---|
| `commands/blu-new-milestone.toml` | Add typed roadmapper packet build step: digest scope, carry-forward facts, requirement transition hints, first-phase preview, parent-owned responsibilities, forbidden actions, stop conditions |
| `skills/blueprint-roadmap-admin/SKILL.md` | Add roadmapper packet and result shape rules |
| `agents/blueprint-roadmapper.md` | Define typed packet input and result output: provisional ordered proposals, coverage notes, blockers, warnings, assumptions, confidence, relative first-phase recommendation only |
| `src/mcp/command-runtime-metadata.ts` | Update runtime metadata for roadmapper packet/result |
| `docs/RUNTIME-REFERENCE.md` | Update new-milestone row |

**Roadmapper boundaries:**

| Action | Who owns it |
|---|---|
| Reading digest + building evidence scope | Parent command |
| Proposing phase grouping/ordering | Roadmapper |
| Final milestone name | Parent command |
| Final phase numbers and paths | Parent command |
| Confirmation gates | Parent command |
| MCP writes (roadmap, scaffold, state) | Parent command |
| Final response and routing | Parent command |

**Forbidden roadmapper actions:**
- Must not call MCP write tools
- Must not hand-edit `.blueprint/` files
- Must not generate final phase context
- Must not override parent confirmation gates
- Must not access web search, browser, or shell tools unless explicitly permitted in agent frontmatter

### Task 6.2 — Define same-shape fallback

**Type:** Sequential  
**Dependencies:** Task 6.1

**Files to edit:**

| File | What to do |
|---|---|
| `commands/blu-new-milestone.toml` | Add fallback rule: if roadmapper disabled, unavailable, or unnecessary, parent fills same result shape inline |
| `skills/blueprint-roadmap-admin/SKILL.md` | Add no-subagent parity requirement with `roadmapperMode` field |

**roadmapperMode values:**
- `used` — roadmapper was called and its proposals were incorporated
- `skipped-disabled` — config says subagents are disabled
- `skipped-unnecessary` — carry-forward scope is small enough that inline synthesis is equivalent
- `unavailable-fallback` — roadmapper agent is not available at runtime

**Rules:**
- Do not pass raw reports, chat history, unrestricted files, web search results, browser-only findings, or shell-only substitutes to roadmapper
- No-subagent path must produce identical quality and shape as subagent path
- Use `blueprint_config_get(scope: "effective")` before any roadmapper call

### Task 6.3 — Keep add/insert no-subagent contracts locked (parallel-safe)

**Type:** Parallel-safe after Task 6.2  
**Dependencies:** Task 6.2

**Files to edit:**

| Test file | Assertions |
|---|---|
| `tests/add-phase-metadata.test.ts` | Assert optional agent list remains empty |
| `tests/insert-phase-metadata.test.ts` | Assert optional agent list remains empty |
| `tests/command-catalog.test.ts` | Assert add/insert have no optional subagents |
| `tests/roadmap-admin-runtime-contract-resource.test.ts` | Assert roadmap-admin skill says no add-phase/insert-phase subagent path |

### Task 6.4 — Verify Wave 6

**Type:** Sequential  
**Dependencies:** Tasks 6.1–6.3

```bash
npm run typecheck
npm run build
npx tsx --test tests/new-milestone-metadata.test.ts tests/agent-contract-specialists.test.ts tests/command-catalog.test.ts tests/add-phase-metadata.test.ts tests/insert-phase-metadata.test.ts tests/roadmap-admin-runtime-contract-resource.test.ts tests/extension-runtime-contracts.test.ts
git diff --check
```

**Exit criteria:**
- [ ] Roadmapper can improve grouping but cannot take over control
- [ ] Disabled subagents do not create a weaker new-milestone path
- [ ] Add/insert remain subagent-free
- [ ] Tests pass

---

## Wave 7 — Response Receipts, Idempotency, Recovery

**Objective:** Make partial success and retry behavior clear without adding a workflow engine.

**Themes addressed:** Theme 5 (typed receipts), Theme 8 (idempotency and recovery).

**Estimated scope:** ~3-4 hours. Touches manifests, docs, skills, potentially `src/mcp/tools/phase.ts` and `src/mcp/tools/artifacts.ts`, tests.

### Task 7.1 — Add response receipts

**Type:** Sequential  
**Dependencies:** Wave 6 complete

**Command-specific receipt fields:**

**New-milestone completion receipt:**
- `mode` (carry-forward / fresh-reset)
- `roadmapperMode` (used / skipped-disabled / skipped-unnecessary / unavailable-fallback)
- First phase target (number, prefix, dir, context path)
- Scaffold path statuses (created / reused / overwritten / blocked per path)
- `inputsUsed`
- `stateUpdated` (boolean)
- `safeRetry` (boolean)
- `nextAction` (resolved route)
- `warnings`
- `deletedPhaseDirectories: []` (always empty)
- `renamedPhaseDirectories: []` (always empty)

**Add-phase completion receipt:**
- Approved phase number and returned phase metadata
- Declared requirement IDs
- Goal and success criteria count
- Roadmap path, context scaffold path
- State route
- `safeRetry`
- `warnings`

**Insert-phase completion receipt:**
- Anchor and inserted decimal
- Returned phase metadata
- Requirement mapping status
- Requirements path, roadmap path, context scaffold path
- State route
- No-renumbering note
- `safeRetry`
- `warnings`

**Files to edit:**

| File | What to do |
|---|---|
| `commands/blu-new-milestone.toml` | Add receipt fields to response requirements section |
| `commands/blu-add-phase.toml` | Add receipt fields to response requirements section |
| `commands/blu-insert-phase.toml` | Add receipt fields to response requirements section |
| Command docs (all three) | Document receipt fields |
| `skills/blueprint-roadmap-admin/SKILL.md` | Add receipt fields to output and completion self-check sections |

### Task 7.2 — Add recovery matrices

**Type:** Sequential  
**Dependencies:** Task 7.1

**Shared recovery matrix (all three commands):**

| Scenario | Recovery action |
|---|---|
| Mutation not attempted (blocker hit) | Safe to rerun after blocker resolved |
| Roadmap mutation succeeded, scaffold failed | Report successful roadmap path and exact scaffold blocker; do not hand-write context |
| Scaffold succeeded, state update failed | Report roadmap/scaffold success; route to `/blu-progress` for recovery; do not hand-edit `STATE.md` |
| Same preview + same returned files on retry | Safe reuse when tool reports `reused` |
| Same token but changed params/files | Block as stale or require manual recovery |

**Additional new-milestone scenarios:**

| Scenario | Recovery action |
|---|---|
| Summary missing | Block with `missing-milestone-summary` |
| Reset ambiguity | Ask for explicit mode choice |
| Starter overwrite blocked | Ask for overwrite approval |
| Stale first phase number | Re-read roadmap, re-compute, re-preview |
| Directory conflict | Block, report exact conflict |
| State mismatch | Report mismatch, route to `/blu-progress` |

**Additional add-phase scenarios:**

| Scenario | Recovery action |
|---|---|
| Stale `expectedPhaseNumber` | Re-read roadmap, re-preview |
| Undeclared requirement IDs | Return error listing missing IDs |
| Missing returned metadata | Block, report tool error |

**Additional insert-phase scenarios:**

| Scenario | Recovery action |
|---|---|
| Invalid anchor (non-integer) | Return error |
| Declared-ID failure | Return error listing failed IDs |
| Already-mapped IDs | Return error listing conflicting phases |
| Conflicting decimal directory | Block, report conflict |
| Dependency-review warning | Include in receipt warnings |

**Files to edit:**

| File | What to do |
|---|---|
| Command docs (all three) | Add recovery/failure mode section with matrix |
| `skills/blueprint-roadmap-admin/SKILL.md` | Add recovery rules to completion self-check |

### Task 7.3 — Extend MCP result fields (only where needed)

**Type:** Sequential  
**Dependencies:** Task 7.2

> [!CAUTION]
> Only add non-breaking fields. Do not change generic tool return shapes unless the tool behavior changes. Do not add durable receipt files.

**Potentially extendable fields:**

| Tool | Possible new fields | Condition |
|---|---|---|
| `blueprint_roadmap_add_phase` result | `contextPath`, `requirementValidationStatus`, `createdPhaseDir`, `idempotencyStatus` | Only if these help commands avoid prompt-level path computation |
| `blueprint_roadmap_insert_phase` result | `requirementMappingStatus`, `contextPath`, `createdPhaseDir` | Same condition |
| `blueprint_artifact_scaffold` result | `newMilestoneReceipt` (command-specific) | Only when `newMilestoneSeed` or equivalent input is present |

**Rules:**
- Do not add `.blueprint/receipts/`, `.blueprint/runs/`, or host-global receipt state
- Response receipts live only in the command response, not in persistent storage
- Prefer current file/state verification over stored receipts

### Task 7.4 — Add tests (parallel-safe)

**Type:** Parallel-safe after Task 7.3  
**Dependencies:** Task 7.3

| Test file | Test cases |
|---|---|
| `tests/roadmap-tools.test.ts` | **add-phase: undeclared IDs block with no mutation** (may already exist from Wave 2 — keep as regression) |
| Same | **add-phase: stale expectedPhaseNumber blocks** (regression) |
| Same | **add-phase: scaffold failure does not hand-write context** |
| Same | **insert-phase: conflicting decimal directory blocks** (regression) |
| Same | **insert-phase: requirement mapping failure reports accurately** |
| Same | **insert-phase: state-update failure reported separately** |
| `tests/new-milestone-metadata.test.ts` | **partial scaffold/state scenarios return safeRetry or manual blocker** |
| Same | **same inputs reuse safely** |
| Same | **changed path/hash blocks** |
| `tests/command-contract-docs.test.ts` | **all three docs include receipt field requirements** |

### Task 7.5 — Verify Wave 7

**Type:** Sequential  
**Dependencies:** Tasks 7.1–7.4

```bash
npm run typecheck
npm run build
npx tsx --test tests/roadmap-tools.test.ts tests/new-milestone-metadata.test.ts tests/add-phase-metadata.test.ts tests/insert-phase-metadata.test.ts tests/command-contract-docs.test.ts tests/command-catalog.test.ts
git diff --check
```

**Exit criteria:**
- [ ] User-facing output distinguishes roadmap, requirements, scaffold, and state outcomes
- [ ] Retry guidance is bounded and does not invite manual `.blueprint/` repair
- [ ] No durable receipt store introduced
- [ ] Tests pass

---

## Wave 8 — Final Parity and End-to-End Verification

**Objective:** Prove all three workflows remain coherent after implementation.

**Themes addressed:** All themes — cross-cutting verification.

**Estimated scope:** ~1 hour. No new features — verification and cleanup only.

### Task 8.1 — Run wording and boundary sweeps (parallel-safe)

**Type:** Parallel-safe  
**Dependencies:** Wave 7 complete

```bash
# Stale patterns that should be zero in production surfaces
rg -n "route to requirements|<NN-CONTEXT|Are you sure\?|\bOK\b|\bCancel\b|update_topic|write_todos|task tracker|tracker-backed" commands docs skills agents src tests

# Phase-admin mention inventory (for completeness check)
rg -n "new-milestone|add-phase|insert-phase" commands docs skills agents src tests

# blueprint_config_get parity check
rg -n "blueprint_config_get" commands/blu-new-milestone.toml docs/commands/new-milestone.md docs/RUNTIME-REFERENCE.md docs/MCP-TOOLS.md skills/blueprint-roadmap-admin/SKILL.md src/mcp/command-runtime-metadata.ts tests

# New vocabulary presence check
rg -n "deletedPhaseDirectories|renamedPhaseDirectories|roadmapperMode|safeRetry|phase-number-confirmation|phase-insert-confirmation" commands docs skills agents src tests
```

### Task 8.2 — Run focused verification

**Type:** Sequential  
**Dependencies:** Task 8.1

```bash
npm run typecheck
npm run build
npx tsx --test tests/new-milestone-metadata.test.ts tests/add-phase-metadata.test.ts tests/insert-phase-metadata.test.ts tests/roadmap-tools.test.ts tests/command-catalog.test.ts tests/command-contract-docs.test.ts tests/roadmap-admin-runtime-contract-resource.test.ts tests/extension-runtime-contracts.test.ts tests/agent-contract-specialists.test.ts tests/phase-discovery-discuss.test.ts tests/artifact-contracts.test.ts tests/built-schema-assets.test.ts
git diff --check
```

### Task 8.3 — Inspect built assets

**Type:** Sequential  
**Dependencies:** Task 8.2

- If `src/mcp/command-runtime-metadata.ts`, MCP tools, schema assets, or command resources changed → inspect `dist/` and include tracked built output required by extension-install contract
- Do not touch `dist/` for docs-only or manifest-only slices unless build output intentionally changed

### Task 8.4 — Final checklist

**Type:** Sequential  
**Dependencies:** Task 8.3

- [ ] All three commands remain `implemented` because their manifest, primary skill/input, and required MCP tools are present
- [ ] `/blu`, `/blu-help`, `/blu-progress`, `/blu-next` still recommend implemented-only commands
- [ ] Roadmap-admin runtime contracts still build when docs are unavailable
- [ ] Only new-milestone exposes optional `blueprint-roadmapper`, gated by `blueprint_config_get(scope=effective)`
- [ ] Add/insert optional agent lists remain empty
- [ ] No prompt text instructs direct `.blueprint/` mutation
- [ ] No command text introduces tracker-backed branching or long-running visible todo flow
- [ ] No "route to requirements" stale language exists anywhere
- [ ] `blueprint_config_get` appears in all new-milestone inventories
- [ ] Historical phase directories and numbering are never deleted, renamed, or renumbered
- [ ] All tests pass
- [ ] `git diff --check` clean

---

## Suggested Implementation Order

If starting from this plan, use this order unless the user names a specific wave:

| Order | Wave | What it does | Why this order |
|---|---|---|---|
| 1 | Wave 0 | Preflight | Setup — prerequisite for everything |
| 2 | Wave 1 | Static contract reconciliation | Gets known sibling drift under control before runtime changes |
| 3 | Wave 2 | Requirement provenance guards | Tightens safety before adding preview complexity |
| 4 | Wave 3 | Preview and confirmation receipts | Makes approval gates auditable |
| 5 | Wave 4 | Numbering, paths, history preservation | Moves safety-critical computation to code |
| 6 | Wave 5 | Starter scaffolds and handoff | Makes scaffolds useful for discuss-phase |
| 7 | Wave 6 | Roadmapper packet | Makes delegation safe |
| 8 | Wave 7 | Response receipts and recovery | Makes partial failure inspectable |
| 9 | Wave 8 | Final verification | Proves everything is coherent |

---

## Future Implementor Prompt

Use this prompt for a future code implementation run after this plan is approved:

```text
You are implementing the approved phase-admin improvement plan in Blueprint for `/blu-new-milestone`, `/blu-add-phase`, and `/blu-insert-phase`.

Do not use GSD or Blueprint slash workflow to do your work. Use Codex tools only.
Create a fresh worktree/branch before editing. Run `npm ci` before any build, typecheck, or tests.

Read first:
- docs/imp/new-milestone/final-unified-phase-based-plan.md (this plan)
- docs/imp/new-milestone/new-milestone-frontier-research-and-improvement-plan.md (research source)
- commands/blu-new-milestone.toml
- commands/blu-add-phase.toml
- commands/blu-insert-phase.toml
- docs/commands/new-milestone.md
- docs/commands/add-phase.md
- docs/commands/insert-phase.md
- skills/blueprint-roadmap-admin/SKILL.md
- skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md
- skills/blueprint-roadmap-admin/references/insert-phase-runtime-contract.md
- agents/blueprint-roadmapper.md
- src/mcp/command-runtime-metadata.ts
- src/mcp/tools/phase.ts
- src/mcp/tools/artifacts.ts
- src/mcp/tools/state.ts
- docs/MCP-TOOLS.md
- docs/RUNTIME-REFERENCE.md
- docs/ARTIFACT-SCHEMA.md
- tests/new-milestone-metadata.test.ts
- tests/add-phase-metadata.test.ts
- tests/insert-phase-metadata.test.ts
- tests/roadmap-tools.test.ts
- tests/command-contract-docs.test.ts
- tests/command-catalog.test.ts
- tests/roadmap-admin-runtime-contract-resource.test.ts

Implement only one approved wave at a time. Start with Wave 1 unless the user explicitly names another wave.
Keep `.blueprint/` persistence MCP-owned. Do not hand-edit `.blueprint/` except inside isolated test fixtures.
Keep all three workflows bounded: no tracker tools, no long-running progress posture, no planned-only follow-up routes, no direct jump to plan/execute shortcuts.
Use returned MCP metadata as authority for phase numbers, prefixes, directories, paths, writes, warnings, and next routes.
Preserve historical phase directories and roadmap numbering history. `/blu-new-milestone` and `/blu-add-phase` start next whole-number phases; `/blu-insert-phase` inserts decimals under an integer anchor and does not renumber later phases.
Only `/blu-new-milestone` may use `blueprint-roadmapper`, and only after `blueprint_config_get(scope=effective)` confirms subagents are enabled.
If adding source behavior, update docs/tests/runtime metadata and run build/typecheck/focused tests in the same branch. Include tracked `dist/` output when required by the build.

Stop and ask if current code conflicts with the plan in a way that would require changing routing semantics, adding host-global state, adding a durable receipt store, adding a new `.blueprint/` write surface, or widening beyond the named wave.
```

---

## Risk and Rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| **Scope drift** — shared plan blurs three distinct commands | Keep command-specific semantics explicit in every wave | Roll back any wave that removes command-specific semantics or turns add/insert into generic roadmapper-assisted workflows |
| **Requirement traceability** — tightening add-phase validation exposes weak fixtures | Add behavior tests before tightening validation | Roll back source behavior and keep docs/tests in failed branch until fixtures updated |
| **New-milestone overreach** — transition packets become planning ceremonies | Over-authoring guardrails limit packet to 12-18 bullets, starter-only | Roll back packet fields that create final decisions owned by `/blu-discuss-phase` or `/blu-plan-phase` |
| **MCP overpromise** — docs describe fields tools don't return | Only document fields that tools actually return or that are model-built and labeled as such | Roll back docs or implement fields with tests before merge |
| **Runtime-input regression** — adding docs paths to roadmap-admin inputs | `tests/roadmap-admin-runtime-contract-resource.test.ts` is a required gate | Keep docless guarantee; revert any wave that breaks it |
| **Historical evidence** — any implementation deletes/renames/renumbers phases | Negative tests for all three commands report `deletedPhaseDirectories: []`, `renamedPhaseDirectories: []` | Add negative tests before merging runtime guard work |
| **Receipt complexity** — durable receipt storage becomes second source of truth | Start with response receipts only; plan durable receipts in separate approved wave | Revert any accidental durable receipt store introduction |
| **Schema drift** — adding handoff field to `phase.context` affects schema, renderer, validation, docs, tests | Prefer mapping to existing sections unless a concrete consumer requires new field | If schema change needed, update renderer, schema asset tests, model validation, and built assets together |
| **Rollback mechanics** | Revert one wave at a time | For source waves, revert source, docs, tests, and `dist/` together. Never repair a failed rollout by manually rewriting `.blueprint/` artifacts |


