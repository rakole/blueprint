# Phase Admin Reconciliation Report

Date: 2026-05-12
Branch/worktree: `codex/phase-admin-reconciliation-report` at `/Users/rhishi/dev/repositories/blueprint-phase-admin-reconciliation`
Scope: discovery only. No source, manifest, skill, test, generated asset, or runtime behavior fixes were applied.

## Question

Reconcile how phases are created, inserted, and removed through:

- `/blu-new-project`
- `/blu-add-phase`
- `/blu-insert-phase`
- `/blu-remove-phase`

The audit focused on document creation, mandatory fields, requirement mapping, phase ID generation, validation strategy, and cross-flow discrepancies.

## Method

- Created a fresh worktree and branch from `origin/main`.
- Ran `npm ci` in the fresh worktree before build/test commands.
- Used four GPT-5.4 high subagents, capped at four in parallel and closed as soon as each completed:
  - `new-project` bootstrap writer and validation walkthrough.
  - `add-phase` / `insert-phase` / `remove-phase` implementation walkthrough.
  - artifact contract and validator parity walkthrough.
  - temp-repo simulation walkthrough.
- Main-thread verification inspected the same source paths with `rg`, `nl -ba`, and targeted temp-repo simulations.
- Main-thread verification commands:
  - `npm run build --silent`: passed.
  - `npx tsx --test tests/new-project.test.ts tests/roadmap-tools.test.ts tests/artifact-validate-runtime.test.ts tests/artifact-contracts.test.ts`: 84 tests passed, 0 failed.

## Flow Map

| Flow | Runtime write owner | Created or mutated docs | Phase ID strategy | Requirement strategy |
|---|---|---|---|---|
| `new-project` | `blueprint_project_init` | Creates `.blueprint/PROJECT.md`, `.blueprint/REQUIREMENTS.md`, `.blueprint/ROADMAP.md`, `.blueprint/phases/`, first phase `XX-CONTEXT.md`, `.blueprint/STATE.md`, `.blueprint/config.json` | Uses the first seed roadmap phase, normalizes `1.0` to `1`, formats directory prefix as `01`, `02.1`, etc. | Preflight requires durable IDs, no duplicate phase refs, committed requirements mapped exactly once, explicit phase `requirementIds`, and 2-5 success criteria. |
| `add-phase` | `blueprint_roadmap_add_phase` plus command-level scaffold/state calls | MCP tool appends `.blueprint/ROADMAP.md` and materializes the phase directory. Command contract then scaffolds `${phaseDir}/${phasePrefix}-CONTEXT.md` and updates state. | Next integer after highest base phase number, ignoring decimal suffixes. | Requires non-empty `requirementIds`, concrete `goal`, and 2-5 `successCriteria`, but plain add does not validate IDs against `REQUIREMENTS.md`. |
| `insert-phase` | `blueprint_roadmap_insert_phase` plus command-level scaffold/state calls | MCP tool mutates `.blueprint/ROADMAP.md`, updates `.blueprint/REQUIREMENTS.md` row notes, and materializes the decimal phase directory. Command contract then scaffolds context and updates state. | Next decimal under an existing integer anchor, for example `2`, `2.1` -> `2.2`. Later phases are not renumbered. | Requires at least one declared `REQUIREMENTS.md` ID, rejects already mapped IDs, rejects decimal anchors, requires `goal` and 2-5 `successCriteria`. |
| `remove-phase` | `blueprint_roadmap_remove_phase` plus command-level state call | MCP tool removes the target phase dir, rewrites `.blueprint/ROADMAP.md`, renames later phase dirs/files. Command contract then updates state. | Removes target and shifts every later roadmap phase left into the previous phase number. | No requirement-row rewrite. Requires target be future relative to `STATE.md`; force required if execution evidence exists. |

Primary code references:

- `blueprintProjectInit`: `src/mcp/tools/project.ts:1200`
- bootstrap phase context renderer: `src/mcp/tools/project.ts:269`
- bootstrap seed/renderers: `src/mcp/tools/artifacts.ts:1517`, `src/mcp/tools/artifacts.ts:1798`, `src/mcp/tools/artifacts.ts:1883`
- phase path and numbering helpers: `src/mcp/tools/phase.ts:1439`, `src/mcp/tools/phase.ts:1449`, `src/mcp/tools/phase.ts:1595`
- `blueprintRoadmapAddPhase`: `src/mcp/tools/phase.ts:5522`
- `blueprintRoadmapInsertPhase`: `src/mcp/tools/phase.ts:5722`
- `blueprintRoadmapRemovePhase`: `src/mcp/tools/phase.ts:6001`

## Final Findings

### F1. Plain `add-phase` can persist undeclared requirement IDs

Severity: high
Confidence: confirmed
Surface: MCP tool / ROADMAP contract

The add-phase docs and runtime contract say plain adds must use durable requirement IDs from `.blueprint/ROADMAP.md` or `.blueprint/REQUIREMENTS.md`:

- `commands/blu-add-phase.toml:12`
- `docs/commands/add-phase.md:37`
- `skills/blueprint-roadmap-admin/SKILL.md:134`

The implementation only normalizes and checks that IDs are non-empty:

- schema: `src/mcp/tools/phase.ts:1163`
- non-empty check: `src/mcp/tools/phase.ts:5557`

Unlike insert-phase, plain add-phase does not check that IDs are declared in `.blueprint/REQUIREMENTS.md` or already represented in roadmap requirement coverage.

Temp-repo simulation:

```json
{
  "addWritten": true,
  "phaseNumber": "2",
  "phaseDir": ".blueprint/phases/02-unknown-requirement-phase",
  "roadmapHasUnknown": true,
  "validationValid": false,
  "validationIssues": [
    ".blueprint/ROADMAP.md: Roadmap artifact Phase 2 field Requirements references unknown IDs RQ-99. Repair by adding those IDs to Requirement Coverage or replacing them with declared requirement IDs.",
    ".blueprint/ROADMAP.md: Phase 2 (Unknown Requirement Phase) references requirement RQ-99 which is not declared in Requirement Coverage. Repair Phase 2 field Requirements by adding RQ-99 to Requirement Coverage or replacing it with a declared requirement ID.",
    "ROADMAP.md references requirement RQ-99 which is not declared in REQUIREMENTS.md."
  ]
}
```

Result: the mutation succeeds and creates an invalid roadmap. The smallest repair later is to make plain add-phase validate IDs against the same declaration source used by insert-phase, before writing.

### F2. `new-project` creates future roadmap phases without matching phase directories

Severity: medium
Confidence: confirmed
Surface: flow consistency

`blueprintProjectInit` can write multiple roadmap phases from `bootstrapSeed.roadmapPhases`, but it only materializes the first phase directory and first context path:

- first phase derivation: `src/mcp/tools/project.ts:1273`
- scaffold artifacts include one `initialPhaseContextPath`: `src/mcp/tools/project.ts:1299`

Insert-phase requires the integer anchor to have a matching phase directory:

- target directory guard: `src/mcp/tools/phase.ts:5781`

Simulation result from a fresh bootstrap:

- `blueprintRoadmapRead()` reported Phase 2 from `ROADMAP.md` with `phaseDir: null`.
- `blueprintRoadmapInsertPhase({ after: "2", ... })` failed with: `Phase 2 is missing a matching directory under .blueprint/phases. Resolve the drift before inserting a decimal phase after it.`

This means new-project can produce a roadmap state that is valid by bootstrap validation but unusable as an insert anchor for later seeded phases until some separate scaffold creates the future phase directory. That is a creation-strategy discrepancy: `ROADMAP.md` says the phase exists, but phase-admin insertion treats it as drift.

### F3. `remove-phase` is not protected by the repo mutation lock used by add/insert

Severity: medium
Confidence: likely
Surface: MCP tool concurrency

`add-phase` and `insert-phase` both wrap roadmap writes in `withBlueprintRepoLock`:

- add: `src/mcp/tools/phase.ts:5569`
- insert: `src/mcp/tools/phase.ts:5771`
- lock primitive: `src/mcp/tools/artifacts.ts:2498`

`remove-phase` starts at `src/mcp/tools/phase.ts:6001` and performs destructive multi-step mutation without the same lock:

- reads roadmap/state
- deletes target phase directory
- renames later directories and artifact filenames
- rewrites roadmap references
- writes `.blueprint/ROADMAP.md`

This is a cross-command strategy mismatch. It is especially risky because remove-phase has the largest mutation scope.

### F4. `remove-phase` leaves requirement traceability notes stale after removing inserted phases

Severity: medium
Confidence: confirmed
Surface: `.blueprint/REQUIREMENTS.md` traceability

Insert-phase updates matching requirement rows through `mapRequirementsToInsertedPhase`:

- call site: `src/mcp/tools/phase.ts:5849`
- helper: `src/mcp/tools/phase.ts:2152`

Remove-phase does not update `.blueprint/REQUIREMENTS.md`; it only removes/renumbers roadmap and phase paths:

- renumber setup: `src/mcp/tools/phase.ts:6075`
- roadmap write: `src/mcp/tools/phase.ts:6169`

Simulation result:

- Before removal: `ROADMAP.md` had `Phase 2.1: API Stabilization (Requirements: RQ-04)` and `REQUIREMENTS.md` had `RQ-04 ... Mapped to inserted Phase 2.1 (API Stabilization).`
- After `blueprintRoadmapRemovePhase({ phase: "2.1" })`, `ROADMAP.md` renumbered Phase 3 `Launch Prep` to `2.1`, but `REQUIREMENTS.md` still said `RQ-04 ... Mapped to inserted Phase 2.1 (API Stabilization).`

The stale note now points at a phase number reused by different work.

### F5. `remove-phase` renames artifact files but not internal phase labels

Severity: medium
Confidence: confirmed
Surface: phase artifacts

`renamePhaseArtifactsInPlace` only renames filesystem entries whose leading token matches the old phase number:

- helper: `src/mcp/tools/phase.ts:5929`

Simulation result:

- `.blueprint/phases/03-launch-prep/03-CONTEXT.md` became `.blueprint/phases/02.1-launch-prep/02.1-CONTEXT.md`.
- The file body still began `# Phase 03: Launch Prep - Context`.

That leaves path metadata and visible artifact content inconsistent after renumbering.

### F6. `bootstrap.requirements` contract required headings are stricter than validation

Severity: medium
Confidence: confirmed
Surface: artifact contract / validator

The contract registry says `bootstrap.requirements` requires:

- `Requirements Table`
- `Scope Summary`
- `Committed V1 Scope`
- `Deferred Scope`
- `Out-of-Scope Cuts`
- `Traceability Notes`
- `Open Questions`

Reference:

- `src/mcp/artifact-contracts/index.ts:3656`

The validator hard-codes a smaller required set and treats `Deferred Scope` and `Out-of-Scope Cuts` as optional when the scope summary says `none`:

- smaller required set: `src/mcp/tools/artifacts.ts:4056`
- optional scope entries: `src/mcp/tools/artifacts.ts:4099`
- missing section check only when scope has entries: `src/mcp/tools/artifacts.ts:4142`

Existing test evidence confirms the validator accepts committed-only requirements without those headings:

- `tests/new-project.test.ts:1123`
- `tests/new-project.test.ts:1171`

This is a source-of-truth mismatch: `blueprint_artifact_contract_read` can tell an author those headings are mandatory, while `blueprint_artifact_validate` accepts an artifact without them.

### F7. Roadmap schema/validator still allow empty inserted requirement grounding

Severity: medium
Confidence: confirmed
Surface: artifact schema / validator / insert contract

Current insert-phase command surfaces reject empty requirement grounding:

- `commands/blu-insert-phase.toml:29`
- `docs/commands/insert-phase.md:39`
- `skills/blueprint-roadmap-admin/SKILL.md:150`
- tool schema minimum: `src/mcp/tools/phase.ts:1194`
- runtime non-empty check: `src/mcp/tools/phase.ts:5759`

But the roadmap model contract and validator still allow inserted decimal phases to have no requirement IDs:

- schema description: `src/mcp/artifact-contracts/schemas/bootstrap.roadmap.model.schema.json:178`
- quality rule: `src/mcp/artifact-contracts/index.ts:341`
- validator allowance: `src/mcp/tools/artifacts.ts:4466`
- stale doc note: `docs/ARTIFACT-SCHEMA.md:123`

Temp-repo simulation added a decimal phase with `**Requirements**: none yet`; artifact validation returned:

```json
{
  "valid": true,
  "issues": [],
  "diagnostics": []
}
```

That makes the command-level rule stricter than the artifact-level rule, so manually authored or repaired ROADMAPs can pass validation while violating insert-phase's current requirement strategy.

### F8. `new-project` docs and command catalog underreport the first context file

Severity: low
Confidence: confirmed
Surface: docs

Runtime always seeds the first phase context file:

- path derivation: `src/mcp/tools/project.ts:1281`
- scaffold call: `src/mcp/tools/project.ts:1299`
- test assertion: `tests/new-project.test.ts:393`

Docs/catalog mention `.blueprint/phases/` but do not clearly list the actual `.blueprint/phases/<NN>-<slug>/<NN>-CONTEXT.md` file:

- `docs/commands/new-project.md:80`
- `docs/COMMAND-CATALOG.md:33`

This is doc drift, not a runtime mutation bug.

### F9. `docs/ARTIFACT-SCHEMA.md` is stale for `REQUIREMENTS.md`

Severity: low
Confidence: confirmed
Surface: docs

The docs list generic locked sections such as `acceptance notes` and `deferred items`:

- `docs/ARTIFACT-SCHEMA.md:99`

The runtime contract and validator revolve around `Requirements Table`, `Scope Summary`, scope sections, `Traceability Notes`, and `Open Questions`:

- `src/mcp/artifact-contracts/index.ts:3656`
- `src/mcp/tools/artifacts.ts:4039`
- `src/mcp/tools/artifacts.ts:4202`

This can mislead authors comparing docs against contract reads and validation diagnostics.

## Non-Findings And Clarifications

- `ROADMAP.md` `## Phase Details` is optional by current design. The contract template and model contract expose it, insert-phase always creates it when needed, and audit-backed add-phase can append it. New-project and plain add-phase can remain list-only and still pass validation.
- `ROADMAP.md` `## Notes` is enforced by validation. One subagent suspected it was not enforced, but main-thread inspection found the check at `src/mcp/tools/artifacts.ts:4593`.
- `add-phase`, `insert-phase`, and `new-project` are aligned on concrete `goal` and 2-5 `successCriteria`.
- `insert-phase` is stricter than add-phase on requirement provenance by design, but add-phase's current lack of provenance validation contradicts its own docs and can create invalid artifacts.
- The MCP mutation tools intentionally stop before command-level state updates; command manifests and skill contracts own the follow-up `blueprint_state_update` call. The gap is that end-to-end command-layer sequencing is mostly metadata-tested rather than behavior-tested.

## Intermediate Agent Notes

### New-project lane

- Confirmed `blueprint_project_init` creates `.blueprint/PROJECT.md`, `.blueprint/REQUIREMENTS.md`, `.blueprint/ROADMAP.md`, `.blueprint/phases/`, the first phase `XX-CONTEXT.md`, `.blueprint/STATE.md`, and `.blueprint/config.json`.
- Confirmed first context is a bootstrap starter, valid for resolution but not usable planning context.
- Found doc drift where docs/catalog underreport the first context file.
- Reported an accidental full-suite run through `npm test` with 1214 passing and 0 failing.

### Phase-admin implementation lane

- Found missing `withBlueprintRepoLock` around remove-phase.
- Found plain add-phase weaker than insert-phase on requirement declaration validation.
- Mapped all helper functions for numbering, slugging, details insertion, requirement row updates, and removal renumbering.
- Noted command-layer scaffold/state sequencing is metadata-tested, while behavior tests call MCP mutation functions directly.

### Contract/validator lane

- Found `bootstrap.requirements` required-heading drift between the registry and validator.
- Flagged `docs/ARTIFACT-SCHEMA.md` as stale for `REQUIREMENTS.md`.
- Flagged roadmap contract breadth around optional `Phase Details`; main-thread review treats that as intentional optionality, not a defect by itself.

### Simulation lane

- Confirmed fresh `new-project` can create Phase 2 in `ROADMAP.md` without a Phase 2 directory, causing insert-after-2 to fail.
- Confirmed remove-after-insert leaves stale `REQUIREMENTS.md` notes.
- Confirmed renumbered phase context filenames change while internal headings remain stale.
- Confirmed plain add-phase creates only the phase directory; command-level scaffold is required for the context file.

## Suggested Repair Order

1. Make plain `blueprint_roadmap_add_phase` validate `requirementIds` against declared requirements/coverage before writing.
2. Decide whether bootstrap should materialize directories/context scaffolds for every seed roadmap phase or whether insert-phase should tolerate roadmap-only future anchors by materializing the anchor directory on demand.
3. Wrap `blueprint_roadmap_remove_phase` in the same repo mutation lock used by add/insert.
4. On remove/renumber, rewrite affected `REQUIREMENTS.md` inserted-phase traceability notes or explicitly remove obsolete inserted-phase mapping notes.
5. On remove/renumber, update internal phase labels in renamed artifacts or report them as intentional stale content needing `/blu-discuss-phase` repair.
6. Align `bootstrap.requirements.requiredHeadings` with validator behavior, or make validation enforce the registry exactly.
7. Align roadmap schema/validator/docs with the current inserted-phase no-empty-requirements rule.
8. Refresh docs for `new-project` outputs and `REQUIREMENTS.md` locked sections.

## Verification Commands

```bash
npm ci
npm run build --silent
npx tsx --test tests/new-project.test.ts tests/roadmap-tools.test.ts tests/artifact-validate-runtime.test.ts tests/artifact-contracts.test.ts
```

Observed main-thread result: 84 passing tests, 0 failures.
