import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  qualityShippingFingerprint,
  qualityShippingSha256,
  qualityShippingStableSerialize,
  tryAcquireQualityShippingOperationLock,
  withQualityShippingOperationLock,
  type QualityShippingOperation,
  type QualityShippingProcessResult,
  type QualityShippingProcessRunner
} from "../src/mcp/quality-shipping-safety.js";
import { blueprintConfigGet } from "../src/mcp/tools/config.js";
import {
  blueprintPrBranchExecute,
  blueprintPrBranchPreview,
  prBranchToolTestHooks
} from "../src/mcp/tools/pr-branch.js";
import {
  blueprintShipExecute,
  blueprintShipPreview,
  shipToolTestHooks
} from "../src/mcp/tools/ship.js";
import {
  blueprintUndoExecute,
  blueprintUndoPreview,
  undoToolTestHooks
} from "../src/mcp/tools/undo.js";
import { createQualityShippingGitFixture } from "./helpers/quality-shipping-git-fixture.js";

const operations = ["undo", "pr-branch", "ship"] as const satisfies readonly QualityShippingOperation[];

function processResult(exitCode: number | null, stdout = "", stderr = ""): QualityShippingProcessResult {
  return { exitCode, stdout, stderr, signal: null, timedOut: false };
}

test("Quality Shipping locks exclude every operation kind within one repository identity", async () => {
  for (const holder of operations) {
    for (const contender of operations) {
      const identity = `/canonical/common/${holder}/${contender}`;
      const release = tryAcquireQualityShippingOperationLock(holder, identity);
      assert.ok(release, `${holder} should acquire ${identity}`);
      try {
        assert.equal(tryAcquireQualityShippingOperationLock(contender, identity), null, `${contender} overlapped ${holder}`);
        const otherRelease = tryAcquireQualityShippingOperationLock(contender, `${identity}/other-repository`);
        assert.ok(otherRelease, "a different repository identity should remain independent");
        otherRelease();
        otherRelease();
      } finally {
        release();
        release();
      }
      const reacquired = tryAcquireQualityShippingOperationLock(contender, identity);
      assert.ok(reacquired, "release should permit a later acquisition");
      reacquired();
    }
  }

  let releaseHolder!: () => void;
  const holderEntered = new Promise<void>((resolve) => { releaseHolder = resolve; });
  let allowHolderToFinish!: () => void;
  const holderCanFinish = new Promise<void>((resolve) => { allowHolderToFinish = resolve; });
  const held = withQualityShippingOperationLock("undo", "/canonical/common/with-helper", async () => {
    releaseHolder();
    await holderCanFinish;
  });
  await holderEntered;
  await assert.rejects(
    withQualityShippingOperationLock("ship", "/canonical/common/with-helper", async () => undefined),
    /Another Quality Shipping operation.*ship did not start/i
  );
  allowHolderToFinish();
  await held;
});

async function setupSharedApprovals(t: TestContext) {
  const fixture = await createQualityShippingGitFixture("blueprint quality shipping cross ");
  t.after(() => fixture.cleanup());
  const remotePath = path.join(fixture.root, "cross remote.git");
  const mutationCalls: Array<{ command: string; argv: string[] }> = [];
  const runGit = async (argv: readonly string[], cwd = fixture.repoPath) => {
    const receipt = await fixture.runner("git", argv, cwd, fixture.env);
    assert.equal(receipt.exitCode, 0, `${argv.join(" ")}: ${receipt.stderr}`);
    return receipt.stdout.trim();
  };
  await fixture.commitFile(
    ".blueprint/config.json",
    `${JSON.stringify({ version: 2, workflow: { code_review: true, secure_phase: true, no_uat: false } }, null, 2)}\n`,
    "test: require cross-command quality gates"
  );
  await runGit(["init", "--bare", remotePath]);
  await runGit(["remote", "add", "origin", remotePath]);
  await runGit(["push", "-u", "origin", "main:refs/heads/main"]);
  const base = await runGit(["rev-parse", "HEAD"]);
  await runGit(["switch", "-c", "codex/cross-command"]);
  await runGit(["push", "-u", "origin", "codex/cross-command:refs/heads/codex/cross-command"]);
  await fixture.commitFile("src/cross.ts", "cross\n", "feat: cross-command target");
  const phaseDir = ".blueprint/phases/01-cross";
  const planPath = `${phaseDir}/01-01-PLAN.md`;
  const summaryPath = `${phaseDir}/01-01-SUMMARY.md`;
  const reviewPath = `${phaseDir}/01-REVIEW.md`;
  const securityPath = `${phaseDir}/01-SECURITY.md`;
  const verificationPath = `${phaseDir}/01-VERIFICATION.md`;
  const prBranchReportPath = ".blueprint/reports/pr-branch-latest.md";
  const shipEvidence = [
    { path: reviewPath, kind: "review" as const },
    { path: securityPath, kind: "security" as const },
    { path: verificationPath, kind: "verification" as const },
    { path: prBranchReportPath, kind: "pr-branch" as const }
  ];
  await writeFile(path.join(fixture.repoPath, ".git/info/exclude"), ".blueprint/phases/\n", { flag: "a" });
  await mkdir(path.join(fixture.repoPath, phaseDir), { recursive: true });
  await mkdir(path.join(fixture.repoPath, ".blueprint/reports"), { recursive: true });
  await writeFile(path.join(fixture.repoPath, planPath), `# Phase 01 Plan 01: Cross-command proof

## Objective

- Exercise deterministic Quality Shipping approval boundaries.

## Files Modified

- \`src/cross.ts\`
`, "utf8");
  await writeFile(path.join(fixture.repoPath, summaryPath), `# Phase 01: Cross-command proof - Summary

**Status:** COMPLETED

## Changes Made

- \`src/cross.ts\`
`, "utf8");
  await writeFile(path.join(fixture.repoPath, reviewPath), `# Phase 01: Cross-command proof - Code Review

**Verdict:** PASS

## Review Summary

- Severity summary: critical 0, high 0, medium 0, low 0, unknown 0.

## Scope Reviewed

- src/cross.ts

## Evidence Reviewed

- ${summaryPath}

## Positive Signals

- Current scope is clean and reviewable.

## Severity Summary

- critical: 0
- high: 0
- medium: 0
- low: 0
- unknown: 0

## Findings

- none

## Follow-Ups

- none

## Next Safe Action

- /blu-progress
`, "utf8");
  await writeFile(path.join(fixture.repoPath, securityPath), `# Phase 01: Cross-command proof - Security

**Status:** COMPLETED
**Readiness:** ready-for-routing
**Completion State:** complete
**Next Safe Action:** /blu-verify-work 1

## Security Summary

- Security review completed without open threat debt.

## Evidence Reviewed

| Evidence | Status | Rationale |
|----------|--------|-----------|
| ${summaryPath} | used | Saved implementation evidence was reviewed. |
| ${reviewPath} | used | The code review gate passed. |

## Threat Register

| Threat ID | Source Plan | Category | Component | Disposition | Mitigation | Status | Evidence | Verifier Note |
|-----------|-------------|----------|-----------|-------------|------------|--------|----------|---------------|
| none | none | none | none | none | none | NONE | none | none |

## Accepted Risks

| Threat ID | Rationale | Accepted By | Accepted At | Evidence |
|-----------|-----------|-------------|-------------|----------|
| none | none | none | none | none |

## Findings

| Kind | Severity | Threat ID | Status | Evidence | Recommendation |
|------|----------|-----------|--------|----------|----------------|
| none | none | none | NONE | none | none |

## Manual / Deferred Work

| Item | Reason | Follow-Up | Status |
|------|--------|-----------|--------|
| none | none | none | NONE |

## Gap / Repair Routes

| Gap | Evidence | Repair | Status |
|-----|----------|--------|--------|
| none | none | none | NONE |

## Follow-Ups

- none

## Security Audit Trail

- Audit date: 2026-07-15
- Execution mode: inline
- Overwrite gate: not-needed
- Verify-or-accept decision: verified
- Pending-open-threat status: none
- Verifier note: no open security follow-up remains.

## Next Safe Action

- /blu-verify-work 1
`, "utf8");
  await writeFile(path.join(fixture.repoPath, verificationPath), `# Phase 01: Cross-command proof - Verification

**Coverage:** Reviewed \`01-01-SUMMARY.md\` for completed shipping evidence.
**Gate State:** PASS
**Sign-off:** test verifier

## Validation Summary

- Saved execution evidence passes validation.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| SHIP-01 | Verify cross-command fixture | ${summaryPath} | PASS | Saved summary backs this row. |

## Evidence Reviewed

- ${summaryPath}

## Test Infrastructure / Evidence Metadata

- Harness: node:test
- Commands: npm run test:focused
- Evidence type: saved execution summary
- Test infrastructure status: available

## Manual-Only or Deferred Coverage

| Item | Why manual or deferred | Follow-Up | Status |
|------|------------------------|-----------|--------|
| none | none | none | NONE |

## Gate State

- Gate: PASS
- Sign-off: test verifier
- Readiness: ready for UAT

## Gap Classification

| Gap class | Scope | Evidence | Repair |
|-----------|-------|----------|--------|
| none | none | none | none |

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- /blu-verify-work 1
`, "utf8");

  const mutationVerbs = new Set(["revert", "switch", "cherry-pick", "apply", "commit", "push"]);
  const runner: QualityShippingProcessRunner = async (command, argv, cwd, env) => {
    if ((command === "git" && mutationVerbs.has(argv[0] ?? "")) || (command === "gh" && argv[0] === "pr" && argv[1] === "create")) {
      mutationCalls.push({ command, argv: [...argv] });
    }
    if (command === "git") return fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
    if (argv[0] === "--version") return processResult(0, "gh version 9.9.9\n");
    if (argv[0] === "auth" && argv[1] === "status") return processResult(0, "authenticated\n");
    if (argv[0] === "repo" && argv[1] === "view") {
      return processResult(0, `${JSON.stringify({ nameWithOwner: "blueprint/tests", url: "https://example.test/blueprint/tests" })}\n`);
    }
    if (argv[0] === "pr" && argv[1] === "view") return processResult(1, "", "no pull requests found");
    return processResult(2, "", `unexpected gh argv ${JSON.stringify(argv)}`);
  };

  undoToolTestHooks.clearApprovalsForTest();
  prBranchToolTestHooks.clearApprovalsForTest();
  shipToolTestHooks.clearApprovalsForTest();
  const restores = [
    undoToolTestHooks.setProcessRunnerForTest(runner),
    prBranchToolTestHooks.setProcessRunnerForTest(runner),
    prBranchToolTestHooks.setEffectiveConfigReaderForTest((args) => blueprintConfigGet({ cwd: args.cwd, scope: "project" })),
    shipToolTestHooks.setProcessRunnerForTest(runner),
    shipToolTestHooks.setConfigReaderForTest((args) => blueprintConfigGet({ cwd: args.cwd, scope: "project" })),
    shipToolTestHooks.setRemoteSelectorResolverForTest((url) => url === remotePath ? "example.test/blueprint/tests" : null)
  ];
  t.after(() => {
    for (const restore of restores.reverse()) restore();
    undoToolTestHooks.clearApprovalsForTest();
    prBranchToolTestHooks.clearApprovalsForTest();
    shipToolTestHooks.clearApprovalsForTest();
  });

  const receiptPreview = await blueprintPrBranchPreview({
    cwd: fixture.repoPath,
    baseRef: "main",
    reviewBranch: "review/cross-command",
    blueprintPolicy: "exclude",
    evidencePaths: [reviewPath, securityPath, verificationPath],
    stayOnReviewBranch: true,
    overwriteReport: true
  });
  assert.equal(receiptPreview.status, "ready", receiptPreview.blockers.join("\n"));
  const receiptOutcome = await blueprintPrBranchExecute({
    operationId: receiptPreview.operationId!,
    fingerprint: receiptPreview.fingerprint!,
    confirmed: true
  });
  assert.equal(receiptOutcome.status, "succeeded", receiptOutcome.blockers.join("\n"));
  const branch = await runGit(["branch", "--show-current"]);
  const target = await runGit(["rev-parse", "HEAD"]);
  assert.equal(branch, "review/cross-command");
  await runGit(["push", "origin", `${base}:refs/heads/${branch}`]);
  await runGit(["branch", "--set-upstream-to", `origin/${branch}`, branch]);

  const prBranchReceipt = await readFile(path.join(fixture.repoPath, prBranchReportPath));
  const prBranchReceiptText = prBranchReceipt.toString("utf8");
  assert.match(prBranchReceiptText, new RegExp(`^- Created branch: ${branch} \\(${target}\\)$`, "m"));
  assert.match(prBranchReceiptText, new RegExp(`^- Base branch: main \\(${base}\\)$`, "m"));
  assert.match(prBranchReceiptText, /^- Clean review branch status: clean$/m);
  assert.match(prBranchReceiptText, /^- Clean final checkout status: clean$/m);
  assert.match(prBranchReceiptText, /^- Recovery or blocker: blockers=none; recovery=none$/m);
  for (const evidencePath of [reviewPath, securityPath, verificationPath]) {
    const bytes = await readFile(path.join(fixture.repoPath, evidencePath));
    assert.ok(prBranchReceiptText.includes(`${evidencePath}:${qualityShippingSha256(bytes)}`));
  }

  const undo = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: target }],
    reason: "Cross-command lock and freshness proof",
    evidencePaths: ["README.md"]
  });
  const prBranch = await blueprintPrBranchPreview({
    cwd: fixture.repoPath,
    baseRef: "main",
    reviewBranch: "review/cross-command-next",
    blueprintPolicy: "exclude",
    evidencePaths: [reviewPath, securityPath, verificationPath],
    overwriteReport: true
  });
  const ship = await blueprintShipPreview({
    cwd: fixture.repoPath,
    baseBranch: "main",
    remoteName: "origin",
    ghRepository: "example.test/blueprint/tests",
    posture: "ready",
    push: true,
    createPr: true,
    title: "Cross-command fixture",
    body: "Cross-command behavior evidence",
    evidence: shipEvidence,
    overwriteReport: true
  });
  assert.equal(undo.status, "ready", undo.blockers.join("\n"));
  assert.equal(prBranch.status, "ready", prBranch.blockers.join("\n"));
  assert.equal(ship.status, "ready", ship.blockers.join("\n"));
  mutationCalls.length = 0;
  return { fixture, undo, prBranch, ship, mutationCalls, shipEvidence, target, branch, remotePath };
}

test("foreign approvals cannot route and cross-command lock-before-consume remains freshness-bound", async (t) => {
  const { fixture, undo, prBranch, ship, mutationCalls, shipEvidence, target, branch, remotePath } = await setupSharedApprovals(t);
  assert.equal(qualityShippingStableSerialize({ b: 2, a: 1 }), qualityShippingStableSerialize({ a: 1, b: 2 }));
  assert.equal(new Set(operations.map((operation) => qualityShippingFingerprint({ schemaVersion: 1, operation, shared: true }))).size, 3);
  assert.deepEqual(undo.packet?.candidates.map((entry) => entry.argv), [["revert", "--no-edit", target]]);
  assert.deepEqual(prBranch.packet?.executionPlan[0]?.argv, ["switch", "-c", "review/cross-command-next", prBranch.packet.baseOid]);
  assert.deepEqual(prBranch.packet?.executionPlan.at(-1)?.argv, ["switch", "--", branch]);
  assert.deepEqual(ship.packet?.executionPlan[0]?.argv, ["push", "--porcelain", "--", remotePath, `${target}:refs/heads/${branch}`]);
  assert.deepEqual(ship.packet?.executionPlan[1]?.argv.slice(0, 7), ["pr", "create", "--repo", "example.test/blueprint/tests", "--base", "main", "--head"]);

  const foreignResults = await Promise.all([
    blueprintPrBranchExecute({ operationId: undo.operationId!, fingerprint: undo.fingerprint!, confirmed: true }),
    blueprintShipExecute({ operationId: undo.operationId!, fingerprint: undo.fingerprint!, confirmed: true }),
    blueprintUndoExecute({ operationId: prBranch.operationId!, fingerprint: prBranch.fingerprint!, confirmed: true }),
    blueprintShipExecute({ operationId: prBranch.operationId!, fingerprint: prBranch.fingerprint!, confirmed: true }),
    blueprintUndoExecute({ operationId: ship.operationId!, fingerprint: ship.fingerprint!, confirmed: true }),
    blueprintPrBranchExecute({ operationId: ship.operationId!, fingerprint: ship.fingerprint!, confirmed: true })
  ]);
  assert.ok(foreignResults.every((result) => result.status === "blocked" || result.status === "stale"));
  assert.equal(mutationCalls.length, 0, "foreign operation ids must not enter mutation");

  const allPlans = [
    ...(undo.packet?.candidates.map((entry) => ({ command: "git", argv: entry.argv })) ?? []),
    ...(prBranch.packet?.executionPlan.map((entry) => ({ command: "git", argv: entry.argv })) ?? []),
    ...(ship.packet?.executionPlan.map((entry) => ({ command: entry.command, argv: entry.argv })) ?? [])
  ];
  assert.ok(allPlans.length > 0);
  for (const entry of allPlans) {
    assert.ok(["git", "gh"].includes(entry.command));
    assert.ok(!entry.argv.some((value) => /(?:^|-)force(?:$|=)|--force-with-lease/.test(value)));
    assert.ok(!["reset", "clean", "rebase"].includes(entry.argv[0] ?? ""));
  }

  const blockedInjection = await Promise.all([
    blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: "--all" }], reason: "reject option", evidencePaths: ["README.md"] }),
    blueprintPrBranchPreview({ cwd: fixture.repoPath, baseRef: "--all", reviewBranch: "review/reject", blueprintPolicy: "exclude", evidencePaths: ["README.md"] }),
    blueprintShipPreview({ cwd: fixture.repoPath, baseBranch: "main", remoteName: "--upload-pack=oops", ghRepository: "example.test/blueprint/tests",
      posture: "ready", push: true, createPr: true, title: "reject", body: "reject", evidence: shipEvidence })
  ]);
  assert.ok(blockedInjection.every((result) => result.status === "blocked" || result.status === "invalid"));
  assert.equal(mutationCalls.length, 0);

  const approvals = [
    { operation: "undo" as const, id: undo.operationId!, fingerprint: undo.fingerprint!, execute: blueprintUndoExecute },
    { operation: "pr-branch" as const, id: prBranch.operationId!, fingerprint: prBranch.fingerprint!, execute: blueprintPrBranchExecute },
    { operation: "ship" as const, id: ship.operationId!, fingerprint: ship.fingerprint!, execute: blueprintShipExecute }
  ];
  for (const approval of approvals) {
    for (const holder of operations) {
      const releaseForeign = tryAcquireQualityShippingOperationLock(holder, undo.packet!.gitCommonDir);
      assert.ok(releaseForeign, `${holder} should acquire the shared repository lock before ${approval.operation}`);
      const blocked = await approval.execute({ operationId: approval.id, fingerprint: approval.fingerprint, confirmed: true });
      assert.equal(blocked.status, "blocked");
      assert.match(blocked.blockers.join("\n"), /Another Quality Shipping operation.*(?:not consumed|unconsumed)/i);
      assert.equal(mutationCalls.length, 0);
      releaseForeign();
      releaseForeign();
    }
  }

  const completedUndo = await blueprintUndoExecute({ operationId: undo.operationId!, fingerprint: undo.fingerprint!, confirmed: true });
  assert.equal(completedUndo.status, "succeeded", completedUndo.blockers.join("\n"));
  assert.deepEqual(mutationCalls, [{ command: "git", argv: ["revert", "--no-edit", target] }]);

  const stalePrBranch = await blueprintPrBranchExecute({ operationId: prBranch.operationId!, fingerprint: prBranch.fingerprint!, confirmed: true });
  const staleShip = await blueprintShipExecute({ operationId: ship.operationId!, fingerprint: ship.fingerprint!, confirmed: true });
  assert.equal(stalePrBranch.status, "stale");
  assert.equal(staleShip.status, "stale");
  assert.match(stalePrBranch.blockers.join("\n"), /source HEAD|working tree/i);
  assert.match(staleShip.blockers.join("\n"), /head|candidate|working tree/i);
  assert.deepEqual(mutationCalls, [{ command: "git", argv: ["revert", "--no-edit", target] }], "stale foreign approvals must not mutate");
});
