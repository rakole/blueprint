import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  blueprintArtifactsTestHooks,
  blueprintArtifactMutateIndex,
  blueprintArtifactReportWrite,
  type BlueprintArtifactsJsonFileSystemForTest,
  withBlueprintRepoLock,
  writeJsonFile
} from "../src/mcp/tools/artifacts.js";
import { blueprintReviewRecord } from "../src/mcp/tools/review.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

type Deferred<T> = {
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
      new Promise<never>((_, reject) => {
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

async function createBlueprintProject(prefix: string): Promise<string> {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await fs.mkdir(path.join(projectRoot, ".blueprint"), { recursive: true });
  return projectRoot;
}

async function createInitializedBlueprintRepo(prefix: string): Promise<string> {
  const repoPath = await createGitRepo(prefix);

  await fs.mkdir(path.join(repoPath, ".blueprint/phases"), { recursive: true });
  await fs.writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await fs.writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await fs.writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap

## Milestone

- Active milestone: v1

## Phases

- [x] **Phase 1: Fixture** - Ready for persistence tests
`,
    "utf8"
  );
  await fs.writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 1
- Active command: /blu-progress
- Next action: Run /blu-progress
- Last updated: 2026-06-29T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await fs.writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    `${JSON.stringify({ version: 2 }, null, 2)}\n`,
    "utf8"
  );

  return repoPath;
}

async function createCodeReviewRepo(): Promise<string> {
  const repoPath = await createInitializedBlueprintRepo("blueprint-review-locking-");
  const phaseDir = path.join(repoPath, ".blueprint/phases/05-review-scope");
  const codebaseDir = path.join(repoPath, ".blueprint/codebase");

  await fs.mkdir(path.join(repoPath, "src"), { recursive: true });
  await fs.mkdir(path.join(repoPath, "tests"), { recursive: true });
  await fs.mkdir(phaseDir, { recursive: true });
  await fs.mkdir(codebaseDir, { recursive: true });
  await fs.writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Code Review Fixture

## Milestone

- Active milestone: v1

## Phases

- [x] **Phase 5: Review Scope** - Completed implementation ready for review

## Phase Details

### Phase 5: Review Scope
**Goal**: Review the repo files changed during the completed phase.
**Requirements**: REV-01
`,
    "utf8"
  );
  await fs.writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 5
- Active command: /blu-execute-phase
- Next action: Run /blu-code-review 5
- Last updated: 2026-06-29T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );

  for (const artifact of [
    "STACK.md",
    "ARCHITECTURE.md",
    "STRUCTURE.md",
    "CONVENTIONS.md",
    "TESTING.md",
    "INTEGRATIONS.md",
    "CONCERNS.md"
  ]) {
    await fs.writeFile(
      path.join(codebaseDir, artifact),
      `# ${artifact.replace(/\.md$/, "")}\n\n- mapped\n`,
      "utf8"
    );
  }

  await fs.writeFile(
    path.join(repoPath, "src/feature.ts"),
    "export function calculateValue(input: number) {\n  return input * 2;\n}\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(repoPath, "tests/feature.test.ts"),
    "import assert from 'node:assert/strict';\n\nassert.equal(2 * 2, 4);\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(phaseDir, "05-01-PLAN.md"),
    `---
phase: 5
plan_id: "01"
title: "Code Review Scope"
wave: 4
status: done
objective: "Review the changed repo files."
depends_on: []
requirements:
  - REV-01
files_modified:
  - src/feature.ts
  - tests/feature.test.ts
read_first:
  - src/feature.ts
acceptance_criteria:
  - rg "calculateValue" src/feature.ts
autonomous: true
---

# Phase 05: Code Review Scope - Plan 01

## Goal

Review the changed repo files.

## Scope

- Source plus tests only.

## Tasks

### Task 1

#### Read First

- src/feature.ts

#### Action

- Review the changed code.

#### Acceptance Criteria

- rg "calculateValue" src/feature.ts

## Verification

- Confirm the review scope excludes Blueprint artifacts.

## Must Haves

- Keep review scope deterministic.

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| src/feature.ts | used | The source fixture defines the file under review. |
| tests/feature.test.ts | used | The test fixture defines the reviewed test file. |
`,
    "utf8"
  );
  await fs.writeFile(
    path.join(phaseDir, "05-01-SUMMARY.md"),
    `# Phase 05: Code Review Scope - Summary 01

## Result

- Completed the review-ready feature slice.

## Changes Made

- Updated the source and test files for the feature slice.

## Evidence

- Summary evidence captured for this phase.
`,
    "utf8"
  );
  await fs.writeFile(
    path.join(phaseDir, "05-VERIFICATION.md"),
    `# Phase 05: Code Review Scope - Verification

## Result

- Validation evidence is available.
`,
    "utf8"
  );

  return repoPath;
}

function createStructuredCodeReviewModel(
  recommendation = "Add a negative-input guard and matching regression test."
): Record<string, unknown> {
  return {
    verdict: "FOLLOW_UP",
    reviewSummary: [
      "Phase 5 standard review covered the source and test files with one high follow-up."
    ],
    positiveSignals: [
      "Saved plan and summary evidence agree on the bounded source and test scope."
    ],
    findings: [
      {
        severity: "high",
        disposition: "follow-up",
        location: "src/feature.ts:1",
        evidence: "The feature implementation has no negative-input guard.",
        impact: "Invalid input can be processed as a successful value.",
        recommendation
      }
    ],
    evidenceCoverage: {
      ".blueprint/phases/05-review-scope/05-01-PLAN.md": {
        status: "used",
        rationale: "Plan metadata defined the reviewed source and test files."
      },
      ".blueprint/phases/05-review-scope/05-01-SUMMARY.md": {
        status: "used",
        rationale: "Summary evidence confirmed the completed delivery increment."
      },
      ".blueprint/phases/05-review-scope/05-VERIFICATION.md": {
        status: "used",
        rationale: "Verification evidence confirmed the saved phase was review-ready."
      }
    },
    followUps: [recommendation],
    nextSafeAction: "/blu-code-review-fix 5"
  };
}

function repoLockPath(projectRoot: string, lockName: string): string {
  return path.join(projectRoot, ".blueprint", "locks", `${lockName}.lock`);
}

function repoLockRecoveryPath(projectRoot: string, lockName: string): string {
  return `${repoLockPath(projectRoot, lockName)}.recovery`;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

type Observed<T> =
  | { status: "fulfilled"; value: T }
  | { status: "rejected"; reason: unknown };

function observe<T>(promise: Promise<T>): Promise<Observed<T>> {
  return promise.then(
    (value) => ({ status: "fulfilled", value }),
    (reason: unknown) => ({ status: "rejected", reason })
  );
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

function fulfilledValue<T>(observed: Observed<T>): T {
  assert.equal(
    observed.status,
    "fulfilled",
    observed.status === "rejected" && observed.reason instanceof Error
      ? observed.reason.message
      : "expected promise to fulfill"
  );
  return observed.value;
}

function rejectedReason<T>(observed: Observed<T>): unknown {
  assert.equal(observed.status, "rejected", "expected promise to reject");
  return observed.reason;
}

function reasonMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function pauseNextRenameTo(t: TestContext, targetPath: string): {
  paused: Deferred<void>;
  resume: Deferred<void>;
} {
  const paused = deferred();
  const resume = deferred();
  const originalRename = fs.rename;
  let hasPaused = false;

  fs.rename = (async (...args: Parameters<typeof fs.rename>) => {
    const [, newPath] = args;

    if (!hasPaused && path.resolve(String(newPath)) === path.resolve(targetPath)) {
      hasPaused = true;
      paused.resolve();
      await resume.promise;
    }

    return originalRename(...args);
  }) as typeof fs.rename;

  t.after(() => {
    resume.resolve();
    fs.rename = originalRename;
  });

  return { paused, resume };
}

test("writeJsonFile preserves existing JSON when the atomic rename fails", async (t) => {
  const projectRoot = await createBlueprintProject("blueprint-json-atomic-");
  t.after(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  const targetPath = path.join(projectRoot, ".blueprint", "config.json");
  const original = `${JSON.stringify({ version: 1, kept: true }, null, 2)}\n`;
  await fs.writeFile(targetPath, original, "utf8");

  const injectedFileSystem: BlueprintArtifactsJsonFileSystemForTest = {
    writeFile: (filePath, contents, encoding) => fs.writeFile(filePath, contents, encoding),
    rename: async () => {
      throw new Error("Injected JSON rename failure");
    },
    rm: (filePath, options) => fs.rm(filePath, options)
  };
  const restoreFileSystem =
    blueprintArtifactsTestHooks.setJsonFileSystemForTest(injectedFileSystem);
  t.after(() => {
    restoreFileSystem();
  });

  await assert.rejects(
    writeJsonFile(targetPath, { version: 2, kept: false }),
    /Injected JSON rename failure/
  );

  assert.equal(await fs.readFile(targetPath, "utf8"), original);
  assert.deepEqual(
    (await fs.readdir(path.dirname(targetPath))).filter((entry) => entry.endsWith(".tmp")),
    []
  );
});

test("withBlueprintRepoLock keeps a live writer from being stolen after the stale interval", async (t) => {
  const projectRoot = await createBlueprintProject("blueprint-repo-lock-lease-");
  t.after(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });
  const restoreTiming = blueprintArtifactsTestHooks.setRepoLockTimingForTest({
    retryMs: 10,
    staleMs: 80,
    heartbeatMs: 20
  });
  t.after(() => {
    restoreTiming();
  });

  const firstEntered = deferred();
  const releaseFirst = deferred();
  const events: string[] = [];

  const firstLock = withBlueprintRepoLock(projectRoot, "lease-refresh", async () => {
    events.push("first-enter");
    firstEntered.resolve();
    await releaseFirst.promise;
    events.push("first-exit");
  });

  await firstEntered.promise;
  await sleep(140);

  const secondLock = withBlueprintRepoLock(projectRoot, "lease-refresh", async () => {
    events.push("second-enter");
  });

  await sleep(140);
  assert.deepEqual(events, ["first-enter"]);

  releaseFirst.resolve();
  await Promise.all([firstLock, secondLock]);
  assert.deepEqual(events, ["first-enter", "first-exit", "second-enter"]);
});

test("withBlueprintRepoLock old owner release does not remove a replacement lock", async (t) => {
  const projectRoot = await createBlueprintProject("blueprint-repo-lock-owner-");
  t.after(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  const lockPath = repoLockPath(projectRoot, "owner-safe");

  await withBlueprintRepoLock(projectRoot, "owner-safe", async () => {
    await fs.rm(lockPath, { recursive: true, force: true });
    await fs.mkdir(lockPath, { recursive: true });
    await fs.writeFile(path.join(lockPath, "owner"), "replacement-owner\n", "utf8");
    await fs.writeFile(path.join(lockPath, "lease"), "replacement-owner\n", "utf8");
  });

  assert.equal(await fs.readFile(path.join(lockPath, "owner"), "utf8"), "replacement-owner\n");
  assert.equal(await fs.readFile(path.join(lockPath, "lease"), "utf8"), "replacement-owner\n");
});

test("withBlueprintRepoLock preserves a replacement owner acquired during stale quarantine", async (t) => {
  const projectRoot = await createBlueprintProject("blueprint-repo-lock-replacement-");
  t.after(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });
  const restoreTiming = blueprintArtifactsTestHooks.setRepoLockTimingForTest({
    retryMs: 5,
    staleMs: 80,
    heartbeatMs: 20
  });
  t.after(() => {
    restoreTiming();
  });

  const lockName = "replacement-during-quarantine";
  const lockPath = repoLockPath(projectRoot, lockName);
  await fs.mkdir(lockPath, { recursive: true });
  await fs.writeFile(path.join(lockPath, "owner"), "abandoned-owner\n", "utf8");
  await fs.writeFile(path.join(lockPath, "lease"), "abandoned-owner\n", "utf8");
  await sleep(130);

  const replacementEntered = deferred();
  const releaseReplacement = deferred();
  const waiterEntered = deferred();
  let replacementLock: Promise<void> | null = null;
  let quarantineAttempts = 0;

  t.after(() => {
    releaseReplacement.resolve();
  });

  const restoreRecoveryHooks = blueprintArtifactsTestHooks.setRepoLockRecoveryHooksForTest({
    beforeStaleLockQuarantine: async (observedLockPath) => {
      assert.equal(observedLockPath, lockPath);
      quarantineAttempts += 1;
      assert.equal(quarantineAttempts, 1);

      await fs.rm(lockPath, { recursive: true, force: true });
      replacementLock = withBlueprintRepoLock(projectRoot, lockName, async () => {
        replacementEntered.resolve();
        await releaseReplacement.promise;
      });
      await replacementEntered.promise;
    }
  });
  t.after(() => {
    restoreRecoveryHooks();
  });

  const waiter = observe(
    withBlueprintRepoLock(projectRoot, lockName, async () => {
      waiterEntered.resolve();
    })
  );

  await waitFor(replacementEntered.promise, "replacement repo lock callback");
  await assertStillPending(waiter, "waiter while replacement repo lock is active", 40);
  await assertStillPending(waiterEntered.promise, "waiter callback", 40);

  assert.notEqual(
    (await fs.readFile(path.join(lockPath, "owner"), "utf8")).trim(),
    "abandoned-owner"
  );

  releaseReplacement.resolve();
  await waitFor(replacementLock ?? Promise.resolve(), "replacement repo lock release");
  fulfilledValue(await waitFor(waiter, "repo lock waiter after replacement release"));

  assert.equal(quarantineAttempts, 1);
  assert.equal(await pathExists(lockPath), false);
});

test("withBlueprintRepoLock aborts stale quarantine when the same owner refreshes its lease", async (t) => {
  const projectRoot = await createBlueprintProject("blueprint-repo-lock-refresh-");
  t.after(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });
  const restoreTiming = blueprintArtifactsTestHooks.setRepoLockTimingForTest({
    retryMs: 5,
    staleMs: 120,
    heartbeatMs: 30
  });
  t.after(() => {
    restoreTiming();
  });

  const lockName = "same-owner-refresh";
  const lockPath = repoLockPath(projectRoot, lockName);
  const ownerPath = path.join(lockPath, "owner");
  const leasePath = path.join(lockPath, "lease");
  await fs.mkdir(lockPath, { recursive: true });
  await fs.writeFile(ownerPath, "abandoned-owner\n", "utf8");
  await fs.writeFile(leasePath, "abandoned-owner\n", "utf8");
  await sleep(170);

  const quarantineObserved = deferred();
  const waiterEntered = deferred();
  let quarantineAttempts = 0;

  const restoreRecoveryHooks = blueprintArtifactsTestHooks.setRepoLockRecoveryHooksForTest({
    beforeStaleLockQuarantine: async (observedLockPath) => {
      assert.equal(observedLockPath, lockPath);
      quarantineAttempts += 1;
      assert.equal(quarantineAttempts, 1);

      await fs.writeFile(leasePath, "abandoned-owner\n", "utf8");
      quarantineObserved.resolve();
    }
  });
  t.after(() => {
    restoreRecoveryHooks();
  });

  const waiter = observe(
    withBlueprintRepoLock(projectRoot, lockName, async () => {
      waiterEntered.resolve();
    })
  );

  await waitFor(quarantineObserved.promise, "same-owner lease refresh");
  await assertStillPending(waiter, "waiter after same-owner lease refresh", 40);
  await assertStillPending(waiterEntered.promise, "waiter callback", 40);

  assert.equal(await fs.readFile(ownerPath, "utf8"), "abandoned-owner\n");
  assert.equal(await fs.readFile(leasePath, "utf8"), "abandoned-owner\n");

  await fs.rm(lockPath, { recursive: true, force: true });
  fulfilledValue(await waitFor(waiter, "repo lock waiter after refreshed lock cleanup"));

  assert.equal(quarantineAttempts, 1);
  assert.equal(await pathExists(lockPath), false);
});

test("withBlueprintRepoLock recovers an abandoned lock after its lease goes stale", async (t) => {
  const projectRoot = await createBlueprintProject("blueprint-repo-lock-stale-");
  t.after(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });
  const restoreTiming = blueprintArtifactsTestHooks.setRepoLockTimingForTest({
    retryMs: 5,
    staleMs: 30,
    heartbeatMs: 10
  });
  t.after(() => {
    restoreTiming();
  });

  const lockPath = repoLockPath(projectRoot, "abandoned");
  await fs.mkdir(lockPath, { recursive: true });
  await fs.writeFile(path.join(lockPath, "owner"), "abandoned-owner\n", "utf8");
  await fs.writeFile(path.join(lockPath, "lease"), "abandoned-owner\n", "utf8");
  await sleep(70);

  let entered = false;
  await withBlueprintRepoLock(projectRoot, "abandoned", async () => {
    entered = true;
  });

  assert.equal(entered, true);
  assert.equal(await pathExists(lockPath), false);
});

test("withBlueprintRepoLock serializes concurrent waiters recovering the same stale lock", async (t) => {
  const projectRoot = await createBlueprintProject("blueprint-repo-lock-stale-race-");
  t.after(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });
  const restoreTiming = blueprintArtifactsTestHooks.setRepoLockTimingForTest({
    retryMs: 5,
    staleMs: 30,
    heartbeatMs: 10
  });
  t.after(() => {
    restoreTiming();
  });

  const lockName = "abandoned-contended";
  const lockPath = repoLockPath(projectRoot, lockName);
  await fs.mkdir(lockPath, { recursive: true });
  await fs.writeFile(path.join(lockPath, "owner"), "abandoned-owner\n", "utf8");
  await fs.writeFile(path.join(lockPath, "lease"), "abandoned-owner\n", "utf8");
  await sleep(70);

  const bothWaitersObservedStale = deferred();
  const firstCallbackEntered = deferred();
  const releaseFirstCallback = deferred();
  let staleRecoveryAttempts = 0;

  const restoreRecoveryHooks = blueprintArtifactsTestHooks.setRepoLockRecoveryHooksForTest({
    beforeStaleRecoveryClaim: async (observedLockPath) => {
      assert.equal(observedLockPath, lockPath);

      const attempt = ++staleRecoveryAttempts;

      if (attempt === 2) {
        bothWaitersObservedStale.resolve();
      }

      await bothWaitersObservedStale.promise;

      if (attempt > 1) {
        await firstCallbackEntered.promise;
      }
    }
  });
  t.after(() => {
    restoreRecoveryHooks();
  });

  let activeCallbacks = 0;
  let maxActiveCallbacks = 0;
  const events: string[] = [];

  const runWaiter = (label: string) =>
    withBlueprintRepoLock(projectRoot, lockName, async () => {
      activeCallbacks += 1;
      maxActiveCallbacks = Math.max(maxActiveCallbacks, activeCallbacks);
      events.push(`${label}-enter`);

      const enterCount = events.filter((event) => event.endsWith("-enter")).length;

      if (enterCount === 1) {
        firstCallbackEntered.resolve();
        await releaseFirstCallback.promise;
      } else {
        await sleep(10);
      }

      events.push(`${label}-exit`);
      activeCallbacks -= 1;
    });

  const waiterA = runWaiter("a");
  const waiterB = runWaiter("b");
  const waiters = Promise.all([waiterA, waiterB]);
  let preReleaseError: unknown;

  try {
    await waitFor(firstCallbackEntered.promise, "first recovered lock callback");
    await sleep(80);
    assert.equal(maxActiveCallbacks, 1);
    assert.equal(events.filter((event) => event.endsWith("-enter")).length, 1);
  } catch (error) {
    preReleaseError = error;
  } finally {
    releaseFirstCallback.resolve();
  }

  await waitFor(waiters, "stale lock waiters");

  if (preReleaseError !== undefined) {
    throw preReleaseError;
  }

  assert.ok(
    staleRecoveryAttempts >= 2,
    `expected both waiters to observe stale recovery; saw ${staleRecoveryAttempts}`
  );
  assert.equal(maxActiveCallbacks, 1);
  assert.equal(activeCallbacks, 0);
  assert.equal(await pathExists(lockPath), false);
  assert.deepEqual(
    (await fs.readdir(path.dirname(lockPath))).filter((entry) =>
      entry.includes(`${lockName}.lock`)
    ),
    []
  );
});

test("withBlueprintRepoLock stale recovery cleanup preserves a successor guard and fresh lock", async (t) => {
  const projectRoot = await createBlueprintProject("blueprint-repo-lock-recovery-guard-");
  t.after(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });
  const restoreTiming = blueprintArtifactsTestHooks.setRepoLockTimingForTest({
    retryMs: 5,
    staleMs: 80,
    heartbeatMs: 20
  });
  t.after(() => {
    restoreTiming();
  });

  const lockName = "recovery-successor";
  const lockPath = repoLockPath(projectRoot, lockName);
  const recoveryPath = repoLockRecoveryPath(projectRoot, lockName);
  await fs.mkdir(lockPath, { recursive: true });
  await fs.writeFile(path.join(lockPath, "owner"), "abandoned-owner\n", "utf8");
  await fs.writeFile(path.join(lockPath, "lease"), "abandoned-owner\n", "utf8");
  await sleep(130);

  const originalRecoveryPaused = deferred();
  const resumeOriginalRecovery = deferred();
  const successorRecoveryPaused = deferred();
  const allowSuccessorRecovery = deferred();
  const originalCleanupObserved = deferred();
  let quarantineAttempts = 0;
  let successorRecoveryHolding = false;
  let successorRecoveryAllowed = false;

  const restoreRecoveryHooks = blueprintArtifactsTestHooks.setRepoLockRecoveryHooksForTest({
    beforeStaleLockQuarantine: async (observedLockPath) => {
      assert.equal(observedLockPath, lockPath);

      const attempt = ++quarantineAttempts;

      if (attempt === 1) {
        originalRecoveryPaused.resolve();
        await resumeOriginalRecovery.promise;
        return;
      }

      if (attempt === 2) {
        successorRecoveryHolding = true;
        successorRecoveryPaused.resolve();
        await allowSuccessorRecovery.promise;
        successorRecoveryHolding = false;
      }
    },
    afterRecoveryGuardRelease: (observedLockPath) => {
      assert.equal(observedLockPath, lockPath);

      if (successorRecoveryHolding && !successorRecoveryAllowed) {
        originalCleanupObserved.resolve();
      }
    }
  });
  t.after(() => {
    restoreRecoveryHooks();
  });

  let activeCallbacks = 0;
  let maxActiveCallbacks = 0;
  const events: string[] = [];
  const firstCallbackEntered = deferred();
  const releaseFirstCallback = deferred();

  const runWaiter = (label: string) =>
    withBlueprintRepoLock(projectRoot, lockName, async () => {
      activeCallbacks += 1;
      maxActiveCallbacks = Math.max(maxActiveCallbacks, activeCallbacks);
      events.push(`${label}-enter`);

      const enterCount = events.filter((event) => event.endsWith("-enter")).length;

      if (enterCount === 1) {
        firstCallbackEntered.resolve();
        await releaseFirstCallback.promise;
      } else {
        await sleep(10);
      }

      events.push(`${label}-exit`);
      activeCallbacks -= 1;
    });

  const originalWaiter = runWaiter("original");
  await waitFor(originalRecoveryPaused.promise, "original stale recovery pause");
  await sleep(130);

  const successorWaiter = runWaiter("successor");
  const waiters = Promise.all([originalWaiter, successorWaiter]);
  let preReleaseError: unknown;

  try {
    await waitFor(successorRecoveryPaused.promise, "successor recovery guard acquisition");
    resumeOriginalRecovery.resolve();
    await waitFor(originalCleanupObserved.promise, "original recovery cleanup");

    assert.equal(await pathExists(recoveryPath), true);
    assert.equal(await pathExists(lockPath), true);

    successorRecoveryAllowed = true;
    allowSuccessorRecovery.resolve();

    await waitFor(firstCallbackEntered.promise, "first callback after successor recovery");
    await sleep(130);
    assert.equal(maxActiveCallbacks, 1);
    assert.equal(events.filter((event) => event.endsWith("-enter")).length, 1);
    assert.equal(await pathExists(lockPath), true);
  } catch (error) {
    preReleaseError = error;
  } finally {
    resumeOriginalRecovery.resolve();
    successorRecoveryAllowed = true;
    allowSuccessorRecovery.resolve();
    releaseFirstCallback.resolve();
  }

  await waitFor(waiters, "successor guard recovery waiters");

  if (preReleaseError !== undefined) {
    throw preReleaseError;
  }

  assert.equal(quarantineAttempts, 2);
  assert.equal(maxActiveCallbacks, 1);
  assert.equal(activeCallbacks, 0);
  assert.equal(await pathExists(lockPath), false);
  assert.deepEqual(
    (await fs.readdir(path.dirname(lockPath))).filter((entry) =>
      entry.includes(`${lockName}.lock`)
    ),
    []
  );
});

test("blueprintArtifactMutateIndex serializes concurrent appends for the same capture target", async (t) => {
  const repoPath = await createInitializedBlueprintRepo("blueprint-capture-locking-");
  t.after(async () => {
    await fs.rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const targetPath = path.join(repoPath, ".blueprint/todos/TODO.md");
  const pausedRename = pauseNextRenameTo(t, targetPath);
  const firstAppend = observe(
    blueprintArtifactMutateIndex({
      cwd: repoPath,
      target: "todo",
      entry: {
        text: "First serialized todo",
        addedAt: "2026-06-29"
      }
    })
  );

  await waitFor(pausedRename.paused.promise, "first capture index rename");

  const secondAppend = observe(
    blueprintArtifactMutateIndex({
      cwd: repoPath,
      target: "todo",
      entry: {
        text: "Second serialized todo",
        addedAt: "2026-06-29"
      }
    })
  );

  await assertStillPending(secondAppend, "second capture append");
  pausedRename.resume.resolve();

  const first = fulfilledValue(await firstAppend);
  const second = fulfilledValue(await waitFor(secondAppend, "second capture append"));
  const saved = await fs.readFile(targetPath, "utf8");

  assert.equal(first.status, "created");
  assert.equal(second.status, "updated");
  assert.deepEqual(first.createdEntryIds, ["TODO-001"]);
  assert.deepEqual(second.createdEntryIds, ["TODO-002"]);
  assert.match(saved, /### TODO-001[\s\S]*- Description: First serialized todo/);
  assert.match(saved, /### TODO-002[\s\S]*- Description: Second serialized todo/);
});

test("blueprintArtifactReportWrite serializes same-report overwrite checks", async (t) => {
  const repoPath = await createInitializedBlueprintRepo("blueprint-report-locking-");
  t.after(async () => {
    await fs.rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const reportPath = path.join(repoPath, ".blueprint/reports/custom-health-check.md");
  const pausedRename = pauseNextRenameTo(t, reportPath);
  const firstWrite = observe(
    blueprintArtifactReportWrite({
      cwd: repoPath,
      reportName: "custom-health-check",
      content: `# Custom Health Check

- First report content.
`
    })
  );

  await waitFor(pausedRename.paused.promise, "first report rename");

  const secondWrite = observe(
    blueprintArtifactReportWrite({
      cwd: repoPath,
      reportName: "custom-health-check",
      content: `# Custom Health Check

- Second report content.
`
    })
  );

  await assertStillPending(secondWrite, "second report write");
  pausedRename.resume.resolve();

  const first = fulfilledValue(await firstWrite);
  const secondReason = rejectedReason(await waitFor(secondWrite, "second report write"));
  const saved = await fs.readFile(reportPath, "utf8");

  assert.equal(first.status, "created");
  assert.match(reasonMessage(secondReason), /already exists.*explicit overwrite confirmation/i);
  assert.match(saved, /First report content/);
  assert.doesNotMatch(saved, /Second report content/);
});

test("blueprintReviewRecord serializes same-artifact overwrite checks", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await fs.rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const reportPath = path.join(repoPath, ".blueprint/phases/05-review-scope/05-REVIEW.md");
  const pausedRename = pauseNextRenameTo(t, reportPath);
  const firstWrite = observe(
    blueprintReviewRecord({
      cwd: repoPath,
      phase: "5",
      artifact: "code-review",
      model: createStructuredCodeReviewModel(
        "Add a negative-input guard and matching regression test."
      ),
      scopeFiles: ["src/feature.ts", "tests/feature.test.ts"],
      scopeSource: "explicit-files"
    })
  );

  await waitFor(pausedRename.paused.promise, "first review record rename");

  const secondWrite = observe(
    blueprintReviewRecord({
      cwd: repoPath,
      phase: "5",
      artifact: "code-review",
      model: createStructuredCodeReviewModel(
        "Add a broader input-validation review before shipping."
      ),
      scopeFiles: ["src/feature.ts", "tests/feature.test.ts"],
      scopeSource: "explicit-files"
    })
  );

  await assertStillPending(secondWrite, "second review record write");
  pausedRename.resume.resolve();

  const first = fulfilledValue(await firstWrite);
  const secondReason = rejectedReason(await waitFor(secondWrite, "second review record write"));
  const saved = await fs.readFile(reportPath, "utf8");

  assert.equal(first.status, "created");
  assert.match(reasonMessage(secondReason), /already exists.*explicit overwrite confirmation/i);
  assert.match(saved, /Add a negative-input guard and matching regression test/);
  assert.doesNotMatch(saved, /broader input-validation review/);
});
