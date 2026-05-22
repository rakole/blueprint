# Phase Lifecycle Persistence / Routing Parity Defects

Date: 2026-05-23

Scope reviewed:
- `new-project`
- `discuss-phase`
- `plan-phase`
- `execute-phase`
- `validate-phase`
- `verify-work`
- `add-tests`

Method:
- Read runtime-owned metadata first: `src/mcp/command-runtime-metadata.ts`
- Read command manifests and runtime contracts for the scoped lifecycle commands
- Treated MCP tools as the persistence source of truth
- Used temp-dir repos only for live repros; no real `.blueprint/` or host-global state was mutated
- Ran the requested typecheck and focused test surface after `npm ci` in a fresh worktree

Result:
- 2 confirmed defects
- 1 confirmed coverage gap
- No additional evidence-backed persistence/routing defect was confirmed in `new-project`, `discuss-phase`, `plan-phase`, `execute-phase`, or `validate-phase` beyond the gap listed below

## Ranked Findings

| Rank | Severity | Classification | Title |
| --- | --- | --- | --- |
| 1 | High | Confirmed defect | `blueprintPhaseValidationWrite` accepts a status-closing UAT replacement without explicit overwrite confirmation and advances lifecycle routing |
| 2 | High | Confirmed defect | `report.add-tests` hard-codes follow-up routes that reject the real synced milestone-closeout action |
| 3 | Medium | Coverage gap | Focused tests bless both sides of the routing drift separately and never assert cross-surface parity |

## 1. `verify-work` accepts a status-closing replacement without the promised overwrite gate

Severity: High

Classification: Confirmed defect

Owning surface:
- `commands/blu-verify-work.toml`
- `skills/blueprint-phase-validation/references/verify-work-runtime-contract.md`
- `src/mcp/tools/phase.ts`
- `src/mcp/tools/state.ts`
- `tests/verify-work-roadmap-sync.test.ts`

Exact evidence:
- `src/mcp/command-runtime-metadata.ts:1781-1805` describes `verify-work` as a resumable UAT writer that mutates `XX-UAT.md`, `ROADMAP.md`, and `STATE.md`.
- `commands/blu-verify-work.toml:19-26` says an existing valid incomplete UAT should default to view or resume, while replacement requires explicit overwrite confirmation before persistence.
- `skills/blueprint-phase-validation/references/verify-work-runtime-contract.md:81-85` repeats that valid incomplete UAT defaults to view or resume and that replacement requires an explicit update path plus overwrite confirmation.
- `src/mcp/tools/phase.ts:9367-9385` implements `resumableUatContinuation` with only these checks:
  - saved UAT is valid
  - saved UAT is incomplete
  - incoming UAT parses successfully
  - incoming `resumeState` is not `NEW`
- `src/mcp/tools/phase.ts:9367-9385` does not check whether the new content merely continues the saved checkpoint versus replacing it by clearing the checkpoint, closing issues, and changing the next action.
- `src/mcp/tools/state.ts:2888-2895` routes an all-complete milestone to `/blu-audit-milestone <milestone>`.
- `tests/verify-work-roadmap-sync.test.ts:708-748` already codifies the off-contract path by writing a `PARTIAL` saved UAT to a `PASS`/`CONTINUED` artifact without `overwrite`, then asserting:
  - `result.status === "updated"`
  - `result.overwritten === true`
  - warning contains `without the replace path`
  - saved read is `complete === true`

Live repro path:
1. Create a temp repo with valid phase context, research, UI-spec, plan, summary, verification, and a valid incomplete UAT whose `Next Safe Action` is `/blu-verify-work 4`.
2. Call `blueprintPhaseValidationWrite({ phase: "4", artifact: "uat", content: resumedPass })` without `overwrite`.
3. Read project status again from persisted artifacts.

Observed repro result:
- Before write: `projectStatus.nextAction === "/blu-verify-work 4"`
- Write result: `status === "updated"`
- Write warnings include:
  - `Continuing the existing incomplete UAT artifact ... without the replace path ...`
  - `Replaced existing uat artifact: ...`
- After write: synced routing advanced to `Run /blu-audit-milestone v2 to audit milestone completion before archiving`

Expected behavior:
- A saved incomplete UAT that is being replaced by a completion-closing artifact should require explicit overwrite confirmation before persistence or route advancement.

Actual behavior:
- Any valid incomplete saved UAT can be replaced without `overwrite` as long as the incoming artifact uses a non-`NEW` resume state, even when the write clears the checkpoint, closes the remaining follow-up, and advances lifecycle routing.

Why this matters:
- Tool-owned truth changes from "resume verify-work" to "milestone ready for audit" without the overwrite gate promised by the manifest and runtime contract.

## 2. `add-tests` report schema rejects the real synced closeout route

Severity: High

Classification: Confirmed defect

Owning surface:
- `commands/blu-add-tests.toml`
- `skills/blueprint-phase-validation/references/add-tests-runtime-contract.md`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/state.ts`
- `tests/execute-phase-summary-tools.test.ts`
- `tests/lifecycle-pilot-integration.test.ts`

Exact evidence:
- `src/mcp/command-runtime-metadata.ts:2067-2094` describes `add-tests` as persisting repo tests, verification, report, and state through MCP tools.
- `commands/blu-add-tests.toml:35-38` requires re-reading report authoring context after verification persistence so the task schema reflects the latest evidence, then syncing state from the updated artifact inventory.
- `skills/blueprint-phase-validation/references/add-tests-runtime-contract.md:219-231` says add-tests must route only to implemented commands and that post-write routing should match the saved status after state sync.
- `src/mcp/tools/artifacts.ts:12896-12914` hard-codes add-tests follow-up actions:
  - completed: `/blu-code-review <phase>` or `/blu-progress`
  - partial: `/blu-progress`
  - blocked: `/blu-progress`
- `src/mcp/tools/artifacts.ts:13056-13096` then forces `nextSafeAction` to those hard-coded values inside the runtime task schema.
- `src/mcp/tools/artifacts.ts:13650-13680` exposes those same values through `allowedNextActions`.
- `src/mcp/tools/state.ts:2888-2895` independently routes a fully ready milestone to `/blu-audit-milestone <milestone>`.
- `tests/execute-phase-summary-tools.test.ts:1951-1960` blesses `/blu-code-review 3` as the validated add-tests model route.
- `tests/lifecycle-pilot-integration.test.ts:808-842` separately proves that after lifecycle completion plus add-tests follow-up, synced routing is `/blu-audit-milestone v1`.

Live repro path:
1. Create a temp lifecycle repo with valid context, research, UI-spec, plan, completed summary, verification, and UAT.
2. Call `blueprintArtifactReportAuthoringContext({ reportName: "add-tests-3" })`.
3. Read `blueprintProjectStatus()` from the same saved artifact inventory.
4. Validate two report models:
   - one using the actual synced route command extracted from project status
   - one using `context.allowedNextActions[0]`

Observed repro result:
- `allowedNextActions === ["/blu-code-review 3", "/blu-progress"]`
- `projectStatus.nextAction === "Run /blu-audit-milestone v1 to audit milestone completion before archiving"`
- Validating a model with `nextSafeAction: "/blu-audit-milestone v1"` returns `status === "invalid"`
- Validating the same model with `nextSafeAction: "/blu-code-review 3"` returns `status === "valid"`

Expected behavior:
- The add-tests report schema should allow the same implemented next action that synced state derives from the saved artifact inventory at the same point in time.

Actual behavior:
- The schema rejects the real closeout route and validates a different follow-up, so a durable add-tests report cannot faithfully represent the synced lifecycle route.

Why this matters:
- Report truth and synced state truth can diverge even when all MCP writes succeed, leaving the saved add-tests report to advertise the wrong next action.

## 3. Focused tests miss the parity assertions that would catch both drifts

Severity: Medium

Classification: Coverage gap

Owning surface:
- `tests/verify-work-roadmap-sync.test.ts`
- `tests/execute-phase-summary-tools.test.ts`
- `tests/lifecycle-pilot-integration.test.ts`

Exact evidence:
- `tests/verify-work-roadmap-sync.test.ts:708-748` explicitly treats the non-overwrite `PARTIAL -> PASS/CONTINUED` UAT replacement as expected behavior and does not assert the manifest/contract overwrite requirement.
- `tests/execute-phase-summary-tools.test.ts:1951-1960` explicitly treats `/blu-code-review 3` as the valid add-tests route.
- `tests/lifecycle-pilot-integration.test.ts:808-842` explicitly treats `/blu-audit-milestone v1` as the synced lifecycle route after the add-tests follow-up.
- No focused test in the requested validation surface compares:
  - `blueprint_artifact_report_authoring_context.allowedNextActions`
  - against synced `blueprintProjectStatus` / `blueprintStateLoad`
  - for the same saved artifact inventory
- No focused test asserts that a status-closing UAT replacement must fail without explicit overwrite confirmation.

Expected behavior:
- The focused suites should fail when report-authoring routes disagree with synced lifecycle routing or when a completion-closing UAT replacement skips the promised overwrite gate.

Actual behavior:
- The suites pass while each side of the drift is asserted independently, which lets the contract mismatch ship unnoticed.

Why this matters:
- These are semantic parity defects, not broad compile/test failures, so they need direct parity assertions to stay caught.

## Validation Surface Run

All requested validation commands passed in the fresh worktree after `npm ci`:

- `npm run typecheck --silent`
- `npx tsx --test tests/new-project.test.ts tests/new-project-metadata.test.ts tests/phase-discovery-tools.test.ts tests/context-contract-parity.test.ts`
  - pass: 77
- `npx tsx --test tests/phase-planning-tools.test.ts tests/plan-phase-metadata.test.ts tests/phase-planning-contract.test.ts`
  - pass: 64
- `npx tsx --test tests/execute-phase-summary-tools.test.ts tests/validate-phase-tools.test.ts tests/verify-work-roadmap-sync.test.ts tests/verify-work-metadata.test.ts tests/add-tests-metadata.test.ts tests/add-tests-slice.test.ts tests/lifecycle-pilot-integration.test.ts`
  - pass: 99

Interpretation:
- The current focused validation surface is green even though the persistence/routing parity defects above are real.
- That makes Finding 3 especially important: the relevant suites are exercising these surfaces but not asserting the cross-surface contract invariants that would fail on the current behavior.
