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
  blueprintGodReviewStart,
  godReviewPersistenceTestHooks
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

type Deferred<T = void> = {
  promise: Promise<T>;
  resolve(value: T | PromiseLike<T>): void;
  reject(error: unknown): void;
};

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function waitFor<T>(
  promise: Promise<T>,
  label: string,
  timeoutMs = 1_500
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
        timeout.unref?.();
      })
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

async function assertStillPending<T>(
  promise: Promise<T>,
  label: string,
  delayMs = 80
): Promise<void> {
  const pending = Symbol("pending");
  const result = await Promise.race([
    promise,
    sleep(delayMs).then(() => pending)
  ]);

  assert.equal(result, pending, `${label} should still be pending`);
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

test("blueprint_god_review_cleanup waits for an in-flight session writer", async (t) => {
  const repoPath = await writeCleanupRepo();
  const { reportPath, sessionPath, humanStatePath, nextGroupId } =
    await startCleanupRun(repoPath);
  await appendRemainingGroups({ repoPath, nextGroupId, firstFinding: true });
  const paused = deferred();
  const resume = deferred();
  let shouldPauseHumanState = true;
  const restoreHook = godReviewPersistenceTestHooks.setBeforeBundleWriteForTest(
    async ({ step }) => {
      if (shouldPauseHumanState && step === "human-state") {
        shouldPauseHumanState = false;
        paused.resolve();
        await resume.promise;
      }
    }
  );
  t.after(() => {
    resume.resolve();
    restoreHook();
  });

  const recordFix = blueprintGodReviewRecordFix({
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
    evidence: "Cleanup waits for this writer.",
    followUp: "none",
    terminal: true
  });

  await waitFor(paused.promise, "record-fix human state pause");

  const cleanup = blueprintGodReviewCleanup({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation: "/blu-code-review-fix --feels-like-god --run-id god-cleanup",
    runId: "god-cleanup"
  });

  await assertStillPending(cleanup, "cleanup waiting for god-review writer");
  resume.resolve();

  const [recorded, cleaned] = await Promise.all([recordFix, cleanup]);

  assert.equal(recorded.status, "recorded");
  assert.equal(cleaned.status, "cleaned");
  assert.deepEqual(cleaned.deletedPaths.sort(), [humanStatePath, sessionPath].sort());
  assert.equal(await pathExists(path.join(repoPath, reportPath)), true);
  assert.equal(await pathExists(path.join(repoPath, sessionPath)), false);
  assert.equal(await pathExists(path.join(repoPath, humanStatePath)), false);
});

test("blueprint_god_review_cleanup blocks terminal fix state while eligible findings remain unresolved", async () => {
  const repoPath = await writeCleanupRepo();
  const { reportPath, sessionPath, humanStatePath, nextGroupId } =
    await startCleanupRun(repoPath);
  let pendingGroupId = nextGroupId;

  while (pendingGroupId !== null) {
    const findings =
      pendingGroupId === "correctness-contracts"
        ? [
            {
              title: "First cleanup defect",
              severity: "high",
              disposition: "follow-up",
              confidence: "high",
              files: ["src/feature.ts:1"],
              evidence: "Current code contains `featureValue`.",
              impact: "High impact.",
              recommendation: "Fix the first defect.",
              fixEligibility: "eligible"
            },
            {
              title: "Second cleanup defect",
              severity: "medium",
              disposition: "follow-up",
              confidence: "medium",
              files: ["src/feature.ts:1"],
              evidence: "Current code contains `featureValue`.",
              impact: "Medium impact.",
              recommendation: "Fix the second defect.",
              fixEligibility: "eligible"
            }
          ]
        : [];
    const append = await blueprintGodReviewAppend({
      cwd: repoPath,
      activeCommand: "/blu-code-review",
      rawInvocation: "/blu-code-review --feels-like-god --run-id god-cleanup --continue",
      runId: "god-cleanup",
      groupId: pendingGroupId as (typeof GOD_REVIEW_GROUPS)[number]["id"],
      status: "completed",
      findings
    });
    assert.equal(append.status, "appended");
    pendingGroupId = append.nextGroupId;
  }

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
    evidence: "Only the first finding was fixed.",
    followUp: "fix the second finding",
    terminal: true
  });

  assert.equal(recorded.status, "recorded");
  assert.equal(recorded.terminal, false);
  assert.equal(recorded.cleanupEligible, false);
  assert.match(recorded.warnings.join("\n"), /GOD-COR-002/);

  const session = JSON.parse(await readFile(path.join(repoPath, sessionPath), "utf8"));
  await writeFile(
    path.join(repoPath, sessionPath),
    `${JSON.stringify(
      {
        ...session,
        cleanup: {
          ...session.cleanup,
          godFixTerminal: true,
          eligible: true
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const cleanup = await blueprintGodReviewCleanup({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation: "/blu-code-review-fix --feels-like-god --run-id god-cleanup",
    runId: "god-cleanup"
  });

  assert.equal(cleanup.status, "blocked");
  assert.match(cleanup.reason ?? "", /GOD-COR-002/);
  assert.equal(await pathExists(path.join(repoPath, reportPath)), true);
  assert.equal(await pathExists(path.join(repoPath, sessionPath)), true);
  assert.equal(await pathExists(path.join(repoPath, humanStatePath)), true);
});

test("blueprint_god_review_cleanup refuses session paths outside generated god-review state", async () => {
  const repoPath = await writeCleanupRepo();
  const { reportPath, sessionPath, humanStatePath, nextGroupId } =
    await startCleanupRun(repoPath);
  await appendRemainingGroups({ repoPath, nextGroupId });
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    "# Blueprint State\n\n- Active command: /blu-progress\n",
    "utf8"
  );
  const session = JSON.parse(await readFile(path.join(repoPath, sessionPath), "utf8"));
  await writeFile(
    path.join(repoPath, sessionPath),
    `${JSON.stringify({ ...session, humanStatePath: ".blueprint/STATE.md" }, null, 2)}\n`,
    "utf8"
  );

  const cleanup = await blueprintGodReviewCleanup({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation: "/blu-code-review-fix --feels-like-god --run-id god-cleanup",
    runId: "god-cleanup",
    noEligibleFindingsTerminal: true
  });

  assert.equal(cleanup.status, "invalid");
  assert.match(cleanup.reason ?? "", /not a valid god-review session/);
  assert.equal(await pathExists(path.join(repoPath, ".blueprint/STATE.md")), true);
  assert.equal(await pathExists(path.join(repoPath, sessionPath)), true);
  assert.equal(await pathExists(path.join(repoPath, humanStatePath)), true);
  assert.equal(await pathExists(path.join(repoPath, reportPath)), true);
});
