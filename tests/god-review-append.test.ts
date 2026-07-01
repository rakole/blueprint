import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  blueprintArtifactsTestHooks,
  type BlueprintArtifactsJsonFileSystemForTest
} from "../src/mcp/tools/artifacts.js";
import {
  blueprintGodReviewAppend,
  blueprintGodReviewNext,
  blueprintGodReviewStart,
  godReviewSessionSchema
} from "../src/mcp/tools/god-review.js";
import {
  createCommittedGitRepo,
  runGit
} from "./helpers/git-fixtures.js";

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

async function writeAppendFixtureRepo(): Promise<string> {
  const repoPath = await createCommittedGitRepo("blueprint-god-review-append-");

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await writeFile(
    path.join(repoPath, "src/feature.ts"),
    "export function featureValue(input: number) {\n  return input + 1;\n}\n",
    "utf8"
  );
  await runGit(["add", "."], repoPath);
  await runGit(["commit", "-m", "feature"], repoPath);

  return repoPath;
}

async function readRelative(repoPath: string, relativePath: string): Promise<string> {
  return readFile(path.join(repoPath, relativePath), "utf8");
}

async function startExplicitGodReview(repoPath: string, runId: string) {
  const result = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: `/blu-code-review --feels-like-god --files src/feature.ts --run-id ${runId}`,
    scopeKind: "explicit-files",
    files: ["src/feature.ts"],
    runId
  });

  assert.equal(result.status, "started");
  return result;
}

test("blueprint_god_review_append appends exactly one ordered group and advances session state", async () => {
  const repoPath = await writeAppendFixtureRepo();
  const start = await startExplicitGodReview(repoPath, "god-append-main");
  const append = await blueprintGodReviewAppend({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --run-id god-append-main --continue",
    runId: "god-append-main",
    groupId: "correctness-contracts",
    status: "completed",
    findings: [
      {
        title: "Missing guard before mutation",
        severity: "High",
        disposition: "follow up",
        confidence: "High",
        files: ["src/feature.ts:1"],
        evidence: "featureValue accepts every input without a guard.",
        impact: "Invalid state can flow through the feature boundary.",
        recommendation: "Add a guard before returning.",
        fixEligibility: "Eligible"
      },
      {
        title: "Naming could be clearer",
        severity: "low",
        disposition: "observation",
        files: ["src/feature.ts"],
        evidence: "The fixture name is intentionally generic.",
        impact: "Maintainers need a little more context.",
        recommendation: "Consider a clearer name later."
      }
    ]
  });

  assert.equal(append.status, "appended");
  assert.equal(append.groupId, "correctness-contracts");
  assert.equal(append.groupStatus, "completed");
  assert.deepEqual(append.findingIds, ["GOD-COR-001", "GOD-COR-002"]);
  assert.equal(append.nextGroupId, "security-privacy-auth");
  assert.equal(append.written, true);
  assert.deepEqual(
    append.findings.map((finding) => [
      finding.id,
      finding.severity,
      finding.disposition,
      finding.fixEligibility
    ]),
    [
      ["GOD-COR-001", "high", "follow-up", "eligible"],
      ["GOD-COR-002", "low", "observation", "not-eligible"]
    ]
  );

  const report = await readRelative(repoPath, start.reportPath!);
  assert.match(report, /## GOD-COR Correctness And Contracts/);
  assert.match(report, /#### GOD-COR-001: Missing guard before mutation/);
  assert.match(report, /#### GOD-COR-002: Naming could be clearer/);
  const session = godReviewSessionSchema.parse(
    JSON.parse(await readRelative(repoPath, start.sessionPath!))
  );
  assert.equal(session.groups[0].status, "completed");
  assert.deepEqual(session.groups[0].findingIds, ["GOD-COR-001", "GOD-COR-002"]);
  assert.equal(session.nextGroupId, "security-privacy-auth");
  assert.match(
    await readRelative(repoPath, start.humanStatePath!),
    /Next group: security-privacy-auth/
  );

  const next = await blueprintGodReviewNext({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --run-id god-append-main --continue",
    runId: "god-append-main"
  });
  assert.equal(next.status, "ready");
  assert.equal(next.nextGroup?.id, "security-privacy-auth");
});

test("blueprint_god_review_append rejects fix-mode active command", async () => {
  const result = await blueprintGodReviewAppend({
    activeCommand: "/blu-code-review-fix",
    rawInvocation: "/blu-code-review-fix --feels-like-god --run-id god-wrong-mode",
    groupId: "correctness-contracts",
    status: "completed",
    findings: []
  } as never);

  assert.equal(result.status, "invalid");
  assert.equal(result.activated, false);
});

test("blueprint_god_review_append rejects out-of-order groups without rewriting the report", async () => {
  const repoPath = await writeAppendFixtureRepo();
  const start = await startExplicitGodReview(repoPath, "god-append-order");
  const reportBefore = await readRelative(repoPath, start.reportPath!);
  const append = await blueprintGodReviewAppend({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --run-id god-append-order --continue",
    runId: "god-append-order",
    groupId: "security-privacy-auth",
    status: "completed",
    findings: []
  });

  assert.equal(append.status, "invalid");
  assert.match(append.reason ?? "", /session order/);
  assert.equal(await readRelative(repoPath, start.reportPath!), reportBefore);
});

test("blueprint_god_review_append serializes concurrent writes for one pending group", async () => {
  const repoPath = await writeAppendFixtureRepo();
  const start = await startExplicitGodReview(repoPath, "god-append-concurrent");

  const attempts = await Promise.all([
    blueprintGodReviewAppend({
      cwd: repoPath,
      activeCommand: "/blu-code-review",
      rawInvocation:
        "/blu-code-review --feels-like-god --run-id god-append-concurrent --continue",
      runId: "god-append-concurrent",
      groupId: "correctness-contracts",
      status: "completed",
      findings: [
        {
          title: "Concurrent first finding",
          severity: "high",
          disposition: "follow-up"
        }
      ]
    }),
    blueprintGodReviewAppend({
      cwd: repoPath,
      activeCommand: "/blu-code-review",
      rawInvocation:
        "/blu-code-review --feels-like-god --run-id god-append-concurrent --continue",
      runId: "god-append-concurrent",
      groupId: "correctness-contracts",
      status: "completed",
      findings: [
        {
          title: "Concurrent second finding",
          severity: "medium",
          disposition: "follow-up"
        }
      ]
    })
  ]);

  assert.equal(attempts.filter((attempt) => attempt.status === "appended").length, 1);
  assert.equal(attempts.filter((attempt) => attempt.status === "invalid").length, 1);

  const report = await readRelative(repoPath, start.reportPath!);
  assert.equal((report.match(/^## GOD-COR Correctness And Contracts$/gm) ?? []).length, 1);
  assert.equal((report.match(/^#### GOD-COR-001:/gm) ?? []).length, 1);
  assert.equal((report.match(/^#### GOD-COR-002:/gm) ?? []).length, 0);
});

test("blueprint_god_review_start holds the session lock until the initial report is durable", async (t) => {
  const repoPath = await writeAppendFixtureRepo();
  const runId = "god-start-append";
  const sessionPath = path.join(
    repoPath,
    ".blueprint/reports/.god-review-god-start-append.json"
  );
  const paused = deferred();
  const resume = deferred();
  let hasPaused = false;
  const injectedFileSystem: BlueprintArtifactsJsonFileSystemForTest = {
    writeFile: (filePath, contents, encoding) => fs.writeFile(filePath, contents, encoding),
    rename: async (oldPath, newPath) => {
      if (!hasPaused && path.resolve(newPath) === path.resolve(sessionPath)) {
        hasPaused = true;
        paused.resolve();
        await resume.promise;
      }

      return fs.rename(oldPath, newPath);
    },
    rm: (filePath, options) => fs.rm(filePath, options)
  };
  const restoreFileSystem =
    blueprintArtifactsTestHooks.setJsonFileSystemForTest(injectedFileSystem);
  t.after(() => {
    resume.resolve();
    restoreFileSystem();
  });

  const start = blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: `/blu-code-review --feels-like-god --files src/feature.ts --run-id ${runId}`,
    scopeKind: "explicit-files",
    files: ["src/feature.ts"],
    runId
  });

  await waitFor(paused.promise, "god-review session publication");

  const append = blueprintGodReviewAppend({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: `/blu-code-review --feels-like-god --run-id ${runId} --continue`,
    runId,
    groupId: "correctness-contracts",
    status: "completed",
    findings: [
      {
        title: "Append must survive start completion",
        severity: "high",
        disposition: "follow-up"
      }
    ]
  });

  await assertStillPending(append, "append waiting for god-review start");
  resume.resolve();

  const [started, appended] = await Promise.all([start, append]);

  assert.equal(started.status, "started");
  assert.equal(appended.status, "appended");

  const report = await readRelative(repoPath, started.reportPath!);
  assert.match(report, /# God Review: god-start-append/);
  assert.equal((report.match(/^## GOD-COR Correctness And Contracts$/gm) ?? []).length, 1);
  assert.equal((report.match(/^#### GOD-COR-001:/gm) ?? []).length, 1);
  assert.match(report, /Append must survive start completion/);
});

test("blueprint_god_review_append enforces one-call-one-group input", async () => {
  const repoPath = await writeAppendFixtureRepo();
  await startExplicitGodReview(repoPath, "god-append-one-group");
  const append = await blueprintGodReviewAppend({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation:
      "/blu-code-review --feels-like-god --run-id god-append-one-group --continue",
    runId: "god-append-one-group",
    groupId: "correctness-contracts",
    status: "completed",
    findings: [],
    groups: [{ groupId: "correctness-contracts" }, { groupId: "security-privacy-auth" }]
  });

  assert.equal(append.status, "invalid");
  assert.match(append.reason ?? "", /exactly one group/);
});

test("blueprint_god_review_append rejects unsupported severity and disposition vocabulary", async () => {
  const repoPath = await writeAppendFixtureRepo();
  const start = await startExplicitGodReview(repoPath, "god-append-vocab");
  const reportBefore = await readRelative(repoPath, start.reportPath!);
  const append = await blueprintGodReviewAppend({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --run-id god-append-vocab --continue",
    runId: "god-append-vocab",
    groupId: "correctness-contracts",
    status: "completed",
    findings: [
      {
        title: "Unsupported vocabulary",
        severity: "p0",
        disposition: "todo"
      }
    ]
  });

  assert.equal(append.status, "invalid");
  assert.match(append.warnings.join("\n"), /Unsupported severity: p0/);
  assert.match(append.warnings.join("\n"), /Unsupported disposition: todo/);
  assert.equal(await readRelative(repoPath, start.reportPath!), reportBefore);
});

test("blueprint_god_review_append refuses to rewrite completed group sections", async () => {
  const repoPath = await writeAppendFixtureRepo();
  const start = await startExplicitGodReview(repoPath, "god-append-no-rewrite");
  const first = await blueprintGodReviewAppend({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation:
      "/blu-code-review --feels-like-god --run-id god-append-no-rewrite --continue",
    runId: "god-append-no-rewrite",
    groupId: "correctness-contracts",
    status: "completed",
    findings: [
      {
        title: "First finding",
        severity: "medium",
        disposition: "follow-up"
      }
    ]
  });
  assert.equal(first.status, "appended");
  assert.deepEqual(first.findingIds, ["GOD-COR-001"]);
  const reportBefore = await readRelative(repoPath, start.reportPath!);
  const second = await blueprintGodReviewAppend({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation:
      "/blu-code-review --feels-like-god --run-id god-append-no-rewrite --continue",
    runId: "god-append-no-rewrite",
    groupId: "correctness-contracts",
    status: "completed",
    findings: [
      {
        title: "Second finding",
        severity: "high",
        disposition: "follow-up"
      }
    ]
  });

  assert.equal(second.status, "invalid");
  assert.match(second.reason ?? "", /session order|already been appended/);
  assert.equal(await readRelative(repoPath, start.reportPath!), reportBefore);
});

test("blueprint_god_review_append rolls back report updates when session persistence fails", async (t) => {
  const repoPath = await writeAppendFixtureRepo();
  const start = await startExplicitGodReview(repoPath, "god-append-rollback");
  const sessionAbsolutePath = path.join(repoPath, start.sessionPath!);
  const reportBefore = await readRelative(repoPath, start.reportPath!);
  const sessionBefore = await readRelative(repoPath, start.sessionPath!);
  const humanStateBefore = await readRelative(repoPath, start.humanStatePath!);
  let failSessionRename = true;
  const injectedFileSystem: BlueprintArtifactsJsonFileSystemForTest = {
    writeFile: (filePath, contents, encoding) => fs.writeFile(filePath, contents, encoding),
    rename: async (oldPath, newPath) => {
      if (failSessionRename && path.resolve(newPath) === path.resolve(sessionAbsolutePath)) {
        failSessionRename = false;
        throw new Error("injected session persistence failure");
      }

      return fs.rename(oldPath, newPath);
    },
    rm: (filePath, options) => fs.rm(filePath, options)
  };
  const restoreFileSystem =
    blueprintArtifactsTestHooks.setJsonFileSystemForTest(injectedFileSystem);
  t.after(restoreFileSystem);

  await assert.rejects(
    blueprintGodReviewAppend({
      cwd: repoPath,
      activeCommand: "/blu-code-review",
      rawInvocation: "/blu-code-review --feels-like-god --run-id god-append-rollback --continue",
      runId: "god-append-rollback",
      groupId: "correctness-contracts",
      status: "completed",
      findings: [
        {
          title: "Rollback finding",
          severity: "high",
          disposition: "follow-up"
        }
      ]
    }),
    /injected session persistence failure/
  );

  assert.equal(await readRelative(repoPath, start.reportPath!), reportBefore);
  assert.equal(await readRelative(repoPath, start.sessionPath!), sessionBefore);
  assert.equal(await readRelative(repoPath, start.humanStatePath!), humanStateBefore);

  const retry = await blueprintGodReviewAppend({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --run-id god-append-rollback --continue",
    runId: "god-append-rollback",
    groupId: "correctness-contracts",
    status: "completed",
    findings: [
      {
        title: "Rollback finding",
        severity: "high",
        disposition: "follow-up"
      }
    ]
  });

  assert.equal(retry.status, "appended");
  const report = await readRelative(repoPath, start.reportPath!);
  assert.equal((report.match(/^## GOD-COR Correctness And Contracts$/gm) ?? []).length, 1);
  assert.equal((report.match(/^#### GOD-COR-001:/gm) ?? []).length, 1);
});
