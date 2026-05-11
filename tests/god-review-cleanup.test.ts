import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  GOD_REVIEW_GROUPS,
  type GodReviewAppendResult,
  blueprintGodReviewAppend,
  blueprintGodReviewCleanup,
  blueprintGodReviewRecordFix,
  blueprintGodReviewStart
} from "../src/mcp/tools/god-review.js";
import {
  createCommittedGitRepo,
  runGit
} from "./helpers/git-fixtures.js";

async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function writeCleanupRepo(): Promise<string> {
  const repoPath = await createCommittedGitRepo("blueprint-god-review-cleanup-");

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await writeFile(
    path.join(repoPath, "src/feature.ts"),
    "export const featureValue = 1;\n",
    "utf8"
  );
  await runGit(["add", "."], repoPath);
  await runGit(["commit", "-m", "feature"], repoPath);

  return repoPath;
}

async function startCleanupRun(repoPath: string): Promise<{
  reportPath: string;
  sessionPath: string;
  humanStatePath: string;
  nextGroupId: string | null;
}> {
  const start = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --files src/feature.ts",
    scopeKind: "explicit-files",
    files: ["src/feature.ts"],
    runId: "god-cleanup"
  });
  assert.equal(start.status, "started");

  return {
    reportPath: start.reportPath!,
    sessionPath: start.sessionPath!,
    humanStatePath: start.humanStatePath!,
    nextGroupId: start.nextGroupId
  };
}

async function appendRemainingGroups(args: {
  repoPath: string;
  nextGroupId: string | null;
  firstFinding?: boolean;
}): Promise<GodReviewAppendResult> {
  let nextGroupId = args.nextGroupId;
  let lastAppend: GodReviewAppendResult | null = null;

  while (nextGroupId !== null) {
    const findings =
      args.firstFinding === true && nextGroupId === "correctness-contracts"
        ? [
            {
              title: "Fixable cleanup defect",
              severity: "high",
              disposition: "follow-up",
              confidence: "high",
              files: ["src/feature.ts:1"],
              evidence: "Current code contains `featureValue`.",
              impact: "High impact.",
              recommendation: "Fix the defect.",
              fixEligibility: "eligible"
            }
          ]
        : [];

    lastAppend = await blueprintGodReviewAppend({
      cwd: args.repoPath,
      activeCommand: "/blu-code-review",
      rawInvocation: "/blu-code-review --feels-like-god --run-id god-cleanup --continue",
      runId: "god-cleanup",
      groupId: nextGroupId as (typeof GOD_REVIEW_GROUPS)[number]["id"],
      status: "completed",
      findings
    });
    assert.equal(lastAppend.status, "appended");
    nextGroupId = lastAppend.nextGroupId;
  }

  assert.ok(lastAppend);
  return lastAppend;
}

test("blueprint_god_review_cleanup blocks before terminal hidden review", async () => {
  const repoPath = await writeCleanupRepo();
  const { reportPath, sessionPath, humanStatePath } = await startCleanupRun(repoPath);

  const cleanup = await blueprintGodReviewCleanup({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation: "/blu-code-review-fix --feels-like-god --run-id god-cleanup",
    runId: "god-cleanup"
  });

  assert.equal(cleanup.status, "blocked");
  assert.match(cleanup.reason ?? "", /hidden review is terminal/);
  assert.equal(await pathExists(path.join(repoPath, reportPath)), true);
  assert.equal(await pathExists(path.join(repoPath, sessionPath)), true);
  assert.equal(await pathExists(path.join(repoPath, humanStatePath)), true);
});

test("blueprint_god_review_cleanup blocks before terminal hidden fix", async () => {
  const repoPath = await writeCleanupRepo();
  const { reportPath, sessionPath, humanStatePath, nextGroupId } =
    await startCleanupRun(repoPath);
  await appendRemainingGroups({ repoPath, nextGroupId });

  const cleanup = await blueprintGodReviewCleanup({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation: "/blu-code-review-fix --feels-like-god --run-id god-cleanup",
    runId: "god-cleanup"
  });

  assert.equal(cleanup.status, "blocked");
  assert.match(cleanup.reason ?? "", /hidden fix mode reaches a terminal result/);
  assert.equal(cleanup.reviewTerminal, true);
  assert.equal(cleanup.godFixTerminal, false);
  assert.equal(await pathExists(path.join(repoPath, reportPath)), true);
  assert.equal(await pathExists(path.join(repoPath, sessionPath)), true);
  assert.equal(await pathExists(path.join(repoPath, humanStatePath)), true);
});

test("blueprint_god_review_cleanup succeeds after no-op terminal hidden fix with no eligible findings", async () => {
  const repoPath = await writeCleanupRepo();
  const { reportPath, sessionPath, humanStatePath, nextGroupId } =
    await startCleanupRun(repoPath);
  await appendRemainingGroups({ repoPath, nextGroupId });

  const cleanup = await blueprintGodReviewCleanup({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation: "/blu-code-review-fix --feels-like-god --run-id god-cleanup",
    runId: "god-cleanup",
    noEligibleFindingsTerminal: true
  });

  assert.equal(cleanup.status, "cleaned");
  assert.equal(cleanup.cleanupEligible, true);
  assert.deepEqual(cleanup.deletedPaths.sort(), [humanStatePath, sessionPath].sort());
  assert.deepEqual(cleanup.preservedPaths, [reportPath]);
  assert.equal(await pathExists(path.join(repoPath, reportPath)), true);
  assert.equal(await pathExists(path.join(repoPath, sessionPath)), false);
  assert.equal(await pathExists(path.join(repoPath, humanStatePath)), false);
  assert.doesNotMatch(await readFile(path.join(repoPath, reportPath), "utf8"), /XX-REVIEW-FIX/);
});

test("blueprint_god_review_cleanup preserves durable report and normal Blueprint artifacts", async () => {
  const repoPath = await writeCleanupRepo();
  const { reportPath, sessionPath, humanStatePath, nextGroupId } =
    await startCleanupRun(repoPath);
  await appendRemainingGroups({ repoPath, nextGroupId, firstFinding: true });
  await mkdir(path.join(repoPath, ".blueprint/phases/05-cleanup"), { recursive: true });
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    "# Blueprint State\n\n- Active command: /blu-progress\n",
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/05-cleanup/05-REVIEW.md"),
    "# Normal Review\n",
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/05-cleanup/05-REVIEW-FIX.md"),
    "# Normal Review Fix\n",
    "utf8"
  );

  const recorded = await blueprintGodReviewRecordFix({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation:
      "/blu-code-review-fix --feels-like-god --run-id god-cleanup --finding GOD-COR-001",
    runId: "god-cleanup",
    findingId: "GOD-COR-001",
    status: "fixed",
    selectedBy: "explicit-id",
    filesChanged: ["src/feature.ts"],
    verification: "`npm test` - passed",
    evidence: "Cleanup test fix recorded.",
    followUp: "none",
    terminal: true
  });
  assert.equal(recorded.status, "recorded");
  assert.equal(recorded.cleanupEligible, true);

  const cleanup = await blueprintGodReviewCleanup({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation: "/blu-code-review-fix --feels-like-god --run-id god-cleanup",
    runId: "god-cleanup"
  });

  assert.equal(cleanup.status, "cleaned");
  assert.deepEqual(cleanup.deletedPaths.sort(), [humanStatePath, sessionPath].sort());
  assert.equal(await pathExists(path.join(repoPath, reportPath)), true);
  assert.match(await readFile(path.join(repoPath, reportPath), "utf8"), /GOD-FIX-001/);
  assert.equal(await pathExists(path.join(repoPath, ".blueprint/STATE.md")), true);
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/05-cleanup/05-REVIEW.md")),
    true
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/05-cleanup/05-REVIEW-FIX.md")),
    true
  );
});
