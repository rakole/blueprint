# Review-to-Ship Evidence Parity

## Scope And Method

- Runtime surfaces reviewed:
  - `src/mcp/tools/review.ts`
  - `src/mcp/tools/state.ts`
  - `src/mcp/tools/artifacts.ts`
  - `src/mcp/tools/workspace.ts`
  - `src/mcp/tools/quality-gates.ts`
- Prompt and contract surfaces reviewed:
  - `commands/blu-code-review.toml`
  - `commands/blu-code-review-fix.toml`
  - `commands/blu-audit-fix.toml`
  - `commands/blu-secure-phase.toml`
  - `commands/blu-review.toml`
  - `commands/blu-ui-review.toml`
  - `commands/blu-pr-branch.toml`
  - `commands/blu-ship.toml`
  - `commands/blu-undo.toml`
  - `commands/blu-cleanup.toml`
  - `commands/blu-reapply-patches.toml`
  - `skills/blueprint-review/SKILL.md`
  - `skills/blueprint-maintenance/SKILL.md`
- Requested focused suites passed:
  - `npx tsx --test tests/code-review-slice.test.ts tests/code-review-fix-slice.test.ts tests/review-slice.test.ts tests/ui-review-slice.test.ts tests/security-hardening.test.ts tests/review-runtime-contract-resource.test.ts`
  - `npx tsx --test tests/ship-metadata.test.ts tests/undo-metadata.test.ts tests/pr-branch-metadata.test.ts tests/reapply-patches-metadata.test.ts tests/cleanup-metadata.test.ts tests/cleanup-behavior.test.ts`
- Extra directly relevant suites also passed:
  - `npx tsx --test tests/quality-gate-routing.test.ts tests/patch-tools.test.ts`
- Live repros were run only in disposable temporary git repos created under the local temp root. No real project `.blueprint/` state, host-global state, installed extension directory, or Blueprint slash-command surface was mutated.

## Findings At A Glance

| Classification | Severity | Surface | Headline |
| --- | --- | --- | --- |
| Confirmed defect | High | `state.ts` | Invalid saved UAT can route state into unrelated implemented high-risk commands. |
| Confirmed defect | Medium | `quality-gates.ts` | `PARTIAL` `REVIEW-FIX` next-step evidence is ignored, so routing falls back to stale `REVIEW`. |
| Confirmed defect | Medium | `review.ts` | Reloading saved `REVIEW-FIX` evidence strips structured finding metadata and all `followUpTargets`. |
| Confirmed defect | High | `artifacts.ts` | `audit-fix` authoring accepts caller-widened `scopeFiles` instead of enforcing saved review scope parity. |
| Coverage gap | Medium | maintenance command tests | `pr-branch`, `ship`, and `undo` are metadata-tested but lack execution-path proof for report-before-mutate and confirmation-gated behavior. |
| Suspicion | Medium | `workspace.ts` | Implicit patch replay compatibility ignores recorded `sourceVersion`, so same-repo history drift can escape replay selection boundaries. |

## 1. Confirmed Defect: Invalid UAT Next Action Can Route Into Unrelated High-Risk Commands

**Severity:** High

**Exact evidence**

- `src/mcp/tools/artifacts.ts:7745-7773` validates incomplete UAT next actions and explicitly restricts them to `/blu-verify-work`, `/blu-audit-fix`, or `/blu-add-tests`.
- `commands/blu-secure-phase.toml:43-44` and `commands/blu-ui-review.toml:30-31` both promise that saved invalid, `FAIL`, `PARTIAL`, or otherwise incomplete UAT should stay on the saved implemented repair action or fall back to `/blu-verify-work <phase>`.
- `src/mcp/tools/state.ts:1271-1286` extracts `blockingUatNextSafeAction` from the raw artifact before checking validity.
- `src/mcp/tools/state.ts:1313-1318` still marks invalid UAT as blocking.
- `src/mcp/tools/state.ts:1424-1443` accepts any implemented non-`/blu-progress` Blueprint command as a blocking UAT next action.
- `src/mcp/tools/state.ts:2751-2766` returns that accepted action before falling back to `/blu-verify-work`.

**Proof / repro**

- Disposable repo setup:
  - valid completed summary
  - valid verification that is ready for UAT
  - intentionally invalid `04-UAT.md` whose `## Next Safe Action` contains `/blu-cleanup`
- Public runtime call:

```json
{
  "tool": "blueprintProjectStatus",
  "result": {
    "currentPhase": "4",
    "nextAction": "/blu-cleanup"
  }
}
```

- This is a direct parity break: the UAT validator rejects `/blu-cleanup`, but state routing still promotes it as the next safe action.

**Expected vs actual**

- Expected: invalid or incomplete UAT should stay on the command-local repair path promised by the review/security/UAT contracts, with `/blu-verify-work <phase>` as the fallback.
- Actual: any implemented command, including a high-risk maintenance command like `/blu-cleanup`, can be surfaced from invalid saved UAT.

**Smallest follow-up test gap**

- Add a focused state-routing or `blueprintProjectStatus` test where invalid saved UAT contains an implemented but unsupported command such as `/blu-cleanup`, and assert fallback to `/blu-verify-work <phase>` instead of the raw saved command.

**Owning surface**

- `src/mcp/tools/state.ts`

## 2. Confirmed Defect: `PARTIAL` `REVIEW-FIX` Next-Step Evidence Is Ignored

**Severity:** Medium

**Exact evidence**

- `src/mcp/tools/quality-gates.ts:847-902` reads `REVIEW-FIX` next action only when `Status: COMPLETED` and `Completion State: complete`.
- `src/mcp/tools/quality-gates.ts:1006-1008` falls back to the older `REVIEW` next action whenever the saved `REVIEW-FIX` is not treated as completed.
- `tests/quality-gate-routing.test.ts:1199-1227` proves the current suite covers the completed case only: completed `REVIEW-FIX` outranks stale `REVIEW`.

**Proof / repro**

- Disposable repo setup:
  - completed summary
  - saved `05-REVIEW.md` with `Verdict: FOLLOW_UP` and `Next Safe Action: /blu-code-review-fix 5`
  - saved `05-SECURITY.md`
  - saved `05-REVIEW-FIX.md` with `Status: PARTIAL`, `Completion State: pending`, and `Next Safe Action: /blu-add-tests 5`
- Runtime call:

```json
{
  "tool": "evaluatePhaseQualityGates",
  "result": {
    "gatesSatisfied": false,
    "missingGate": null,
    "reviewNextSafeAction": "/blu-code-review-fix 5",
    "reviewableFiles": ["src/feature.ts"],
    "warnings": []
  }
}
```

- The saved `REVIEW-FIX` explicitly says `/blu-add-tests 5`, but quality-gate routing ignores it and revives the stale `REVIEW` route.

**Expected vs actual**

- Expected: partial remediation evidence should still steer the next safe action when it contains the newest saved follow-up state.
- Actual: only a fully completed `REVIEW-FIX` participates in routing, so partial remediation state disappears from the handoff.

**Smallest follow-up test gap**

- Extend `tests/quality-gate-routing.test.ts` with a `PARTIAL` or `BLOCKED` `REVIEW-FIX` fixture whose next action differs from the original `REVIEW`, and assert that the newest saved remediation route wins when the contract intends it to.

**Owning surface**

- `src/mcp/tools/quality-gates.ts`

## 3. Confirmed Defect: Reloading `REVIEW-FIX` Evidence Drops Structured Finding And Follow-Up Data

**Severity:** Medium

**Exact evidence**

- `commands/blu-code-review-fix.toml:26-39` requires `blueprint_review_load_findings`, exact selected `targetIds`, and persistence of the same narrowed remediation baseline through validation and record.
- `skills/blueprint-review/SKILL.md:119-121` repeats that `review-fix` authoring, validation, and record should carry the exact selected target ids and use the returned findings payload as the authoritative baseline.
- `src/mcp/tools/review.ts:5267-5281` renders each saved `REVIEW-FIX` finding as a single bullet string that inlines evidence and disposition into prose.
- `src/mcp/tools/review.ts:4767-4946` reparses `review-fix` findings from those bullets, but hardcodes `followUpTargets: []` and does not repopulate rich fields such as location, disposition, evidence, impact, recommendation, or classification from the saved bullet text.
- `src/mcp/tools/review.ts:10247-10328` returns that lossy parsed structure directly from `blueprintReviewLoadFindings`.
- `tests/code-review-fix-slice.test.ts:504-571` codifies the current behavior: the suite passes while asserting that a reloaded finding has only `id`, `severity`, and a summary string that now contains the appended evidence and disposition prose, and it asserts `loaded.followUps` only.

**Proof / repro**

- The focused `code-review-fix` slice already proves the current reload shape without failing:
  - `tests/code-review-fix-slice.test.ts:544-570` expects `loaded.findings` to contain a single summary string with embedded `Evidence:` and `Disposition:` text.
  - The same test does not assert any structured `followUpTargets`, location, or disposition continuity because the loader does not return them.

**Expected vs actual**

- Expected: saved `REVIEW-FIX` evidence should remain structured enough for later remediation, auditing, or replay consumers to recover the chosen targets and their finding metadata without reparsing prose.
- Actual: target ids survive only as inline finding ids, while follow-up target structure and rich fields are flattened or dropped on reload.

**Smallest follow-up test gap**

- Strengthen the existing `code-review-fix` slice to assert structured continuity for at least `disposition`, `location`, and `followUpTargets`, not just string-compatible summaries.

**Owning surface**

- `src/mcp/tools/review.ts`

## 4. Confirmed Defect: `audit-fix` Scope Can Widen Beyond The Saved Review Scope

**Severity:** High

**Exact evidence**

- `commands/blu-audit-fix.toml:35-37` requires the full `auditFixContext {source, severity, maxAttempts, dryRun, scopeFiles}` to be passed through authoring and validation.
- `skills/blueprint-review/SKILL.md:124,127-128` says `audit-fix` should keep saved evidence MCP-owned, avoid guessing review scope from drift, and keep repo mutation tightly bounded to the resolved review scope.
- `src/mcp/tools/artifacts.ts:12524-12560` validates `scopeFiles` only as repo-relative file paths outside `.blueprint/`; it does not compare them to the saved review scope or `scopeSource`.
- `src/mcp/tools/artifacts.ts:13212-13264` accepts raw caller `auditFixContext.scopeFiles`, validates those files independently, then separately computes `selectedEvidencePaths`; there is no parity check between the saved evidence and the caller scope.
- `src/mcp/tools/artifacts.ts:13341-13374` narrows `classificationRow.implicatedFiles` and `changeRow.changedFiles` from caller `scopeFiles`, not from the saved review scope.

**Proof / repro**

- Disposable repo setup:
  - saved code-review scope is exactly `["src/feature.ts"]`
  - review `scopeSource` is `explicit-files`
  - extra unrelated file exists at `src/unrelated.ts`
- Runtime call:

```json
{
  "tool": "blueprintArtifactReportAuthoringContext",
  "result": {
    "contextStatus": "ready",
    "contextScopeFiles": ["src/feature.ts", "src/unrelated.ts"],
    "selectedEvidencePaths": [".blueprint/phases/05-review-fix/05-REVIEW.md"],
    "implicatedFilesChoices": ["src/feature.ts", "src/unrelated.ts", "none"],
    "blockers": []
  }
}
```

- The saved review evidence covers only `src/feature.ts`, but the authoring context still accepts and propagates `src/unrelated.ts` into the report schema.

**Expected vs actual**

- Expected: `audit-fix` should be bounded by the saved review scope and its recorded source, or explicitly reject a mismatch.
- Actual: the caller can widen `scopeFiles` away from the saved review baseline without any parity failure.

**Smallest follow-up test gap**

- Add an `audit-fix` authoring-context test that saves a narrow code-review scope, passes a wider `auditFixContext.scopeFiles`, and asserts a blocker or mismatch warning instead of a ready context.

**Owning surface**

- `src/mcp/tools/artifacts.ts`

## 5. Coverage Gap: `pr-branch`, `ship`, And `undo` Lack Execution-Path Proof

**Severity:** Medium

**Exact evidence**

- `tests/pr-branch-metadata.test.ts:24-40`, `tests/ship-metadata.test.ts:20-44`, and `tests/undo-metadata.test.ts:31-46` validate manifests, tool references, confirmation wording, report names, and overwrite language.
- The current maintenance behavior proof is uneven:
  - `tests/cleanup-behavior.test.ts:585-765` executes cleanup behavior, verifies report-before-filesystem-mutation ordering, and checks blocked overwrite and partial-failure cases.
  - `tests/patch-tools.test.ts:90-130`, `tests/patch-tools.test.ts:235-267`, and `tests/patch-tools.test.ts:435-461` execute patch replay preview, compatibility mismatch blocking, and implicit replay bounding.
- By contrast, the shipping surfaces in this audit have no analogous behavior suite proving the live `report-before-mutate`, confirmation gate, and post-mutation overwrite flow for:
  - `pr-branch`
  - `ship`
  - `undo`

**Proof / repro**

- All requested maintenance metadata suites passed.
- The extra directly relevant behavior suites that currently exist are `cleanup` and patch replay, not `pr-branch`, `ship`, or `undo`.
- I did not find an execution-path test in `tests/` for those three commands that actually performs the approved mutation sequence and proves the report ordering around it.

**Expected vs actual**

- Expected: every high-risk shipping surface that promises explicit confirmation and durable report-before-mutate behavior should have execution-path proof comparable to `cleanup` and patch replay.
- Actual: `pr-branch`, `ship`, and `undo` are validated primarily through metadata, runtime-contract, and report-schema assertions.

**Smallest follow-up test gap**

- Add one happy-path behavior test and one blocked-path test each for `pr-branch`, `ship`, and `undo`, covering:
  - explicit confirmation gating
  - durable report persistence before destructive git mutation
  - overwrite handling for `*-latest`
  - post-mutation report refresh with actual outcome

**Owning surface**

- maintenance command execution-path tests

## 6. Suspicion: Implicit Patch Replay Ignores Recorded `sourceVersion`

**Severity:** Medium

**Exact evidence**

- `src/mcp/tools/workspace.ts:2006-2045` computes compatibility from host, repo root name, and remote URL only.
- `src/mcp/tools/workspace.ts:2068-2086` auto-selects every patch whose compatibility status is `"compatible"` when the caller does not pass explicit patch ids.
- `src/mcp/tools/workspace.ts:3329-3346` records `sourceVersion` into the patch manifest.
- `tests/patch-tools.test.ts:337-433` proves `sourceVersion` is preserved in the stored manifest and audit flow.
- `tests/patch-tools.test.ts:435-461` proves implicit replay currently stays bounded only by the compatibility result.
- `tests/patch-tools.test.ts:235-267` proves the mismatch guard on a repo-name boundary, not on same-repo history drift.

**Proof / repro**

- I did not execute a same-repo, same-remote, different-`HEAD` replay that misapplies a patch, so this remains suspicion rather than a confirmed live defect.
- The source evidence is still notable because the system records `sourceVersion`, but the implicit replay selection path does not consult it.

**Expected vs actual**

- Expected: if `sourceVersion` is recorded as provenance for replay safety, implicit compatibility should either consider it or require explicit patch ids when the target history has drifted.
- Actual: implicit replay compatibility ignores `sourceVersion`, so replay selection may stay wider than the stored provenance suggests.

**Smallest follow-up test gap**

- Add a `patch-tools` fixture with two patches from the same repo and remote but different source histories, then assert that implicit replay does not auto-select a patch whose recorded `sourceVersion` no longer matches the intended target history.

**Owning surface**

- `src/mcp/tools/workspace.ts`

## Bottom Line

- The most credible live parity failures are:
  - invalid UAT routing leaking into unrelated high-risk commands
  - `PARTIAL` `REVIEW-FIX` routing being ignored
  - `audit-fix` scope widening away from the saved review baseline
- The most important non-live gap is shipping-path proof: `pr-branch`, `ship`, and `undo` still do not have the same execution-path coverage that `cleanup` and patch replay already have.
