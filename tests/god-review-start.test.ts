import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { constants as fsConstants, promises as fs } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { withBlueprintRepoLock } from "../src/mcp/tools/artifacts.js";
import { PHASE_TOPOLOGY_LOCK_NAME } from "../src/mcp/tools/phase-topology-lock.js";
import { evaluatePhaseQualityGates } from "../src/mcp/tools/quality-gates.js";
import { blueprintProjectStatus } from "../src/mcp/tools/project.js";
import { blueprintStateLoad } from "../src/mcp/tools/state.js";
import {
  blueprintGodReviewStart,
  godReviewSessionSchema
} from "../src/mcp/tools/god-review.js";
import {
  createCommittedGitRepo,
  runGit
} from "./helpers/git-fixtures.js";

const PHASE_DIR = ".blueprint/phases/05-god-review";
const REPLACEMENT_PHASE_DIR = ".blueprint/phases/05-god-review-replacement";

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

async function writeGodReviewFixtureRepo(): Promise<string> {
  const repoPath = await createCommittedGitRepo("blueprint-god-review-start-");
  const phaseDir = path.join(repoPath, PHASE_DIR);

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await mkdir(path.join(repoPath, "tests"), { recursive: true });
  await mkdir(phaseDir, { recursive: true });
  await writeFile(
    path.join(repoPath, ".blueprint/PROJECT.md"),
    "# Project\n\nBlueprint god-review fixture.\n",
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/REQUIREMENTS.md"),
    "# Requirements\n\n- GOD-01: Review changed files.\n",
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: God Review Fixture

## Milestone

- Active milestone: v1

## Phases

- [x] **Phase 5: God Review** - Completed implementation ready for review

## Phase Details

### Phase 5: God Review
**Goal**: Review changed files in god mode.
**Requirements**: GOD-01
**Status**: completed
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 5
- Active command: /blu-progress
- Next action: Run /blu-code-review 5
- Last updated: 2026-05-11T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    `${JSON.stringify({ version: 2 }, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, "src/feature.ts"),
    "export function featureValue(input: number) {\n  return input + 1;\n}\n",
    "utf8"
  );
  await writeFile(
    path.join(repoPath, "tests/feature.test.ts"),
    "import assert from 'node:assert/strict';\n\nassert.equal(1 + 1, 2);\n",
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-01-PLAN.md"),
    `---
phase: 5
plan_id: "01"
title: "God Review Scope"
wave: 1
status: done
objective: "Review the changed repo files."
depends_on: []
requirements:
  - GOD-01
files_modified:
  - src/feature.ts
  - tests/feature.test.ts
read_first:
  - src/feature.ts
acceptance_criteria:
  - npm test -- tests/feature.test.ts
autonomous: true
---

# Phase 05: God Review Scope - Plan 01

## Goal

Review the changed repo files.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-01-SUMMARY.md"),
    `# Phase 05 Summary

## Status

COMPLETED

## Changes Made

- Updated \`src/feature.ts\`.
- Updated \`tests/feature.test.ts\`.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-REVIEW.md"),
    "# Existing Normal Review\n\nunchanged\n",
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-REVIEW-FIX.md"),
    "# Existing Normal Review Fix\n\nunchanged\n",
    "utf8"
  );
  await runGit(["add", "."], repoPath);
  await runGit(["commit", "-m", "fixture"], repoPath);

  return repoPath;
}

async function readRelative(repoPath: string, relativePath: string): Promise<string> {
  return readFile(path.join(repoPath, relativePath), "utf8");
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function waitFor<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} timed out after 5000ms`)),
          5000
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

function fsPathForMock(value: unknown): string {
  return typeof value === "string" ? value : path.resolve(String(value));
}

function pauseFirstMkdirToPath(
  t: TestContext,
  targetPath: string
): {
  paused: Promise<void>;
  resume(): void;
} {
  const realMkdir = fs.mkdir.bind(fs);
  const paused = deferred<void>();
  const resume = deferred<void>();
  let hasPaused = false;

  t.mock.method(fs, "mkdir", async (target, options) => {
    if (!hasPaused && path.resolve(fsPathForMock(target)) === path.resolve(targetPath)) {
      hasPaused = true;
      paused.resolve();
      await resume.promise;
    }

    return realMkdir(
      target as Parameters<typeof fs.mkdir>[0],
      options as Parameters<typeof fs.mkdir>[1]
    );
  });

  t.after(() => {
    resume.resolve();
  });

  return {
    paused: paused.promise,
    resume: () => resume.resolve()
  };
}

function phaseTopologyLockPath(repoPath: string): string {
  return path.join(repoPath, ".blueprint/locks", `${PHASE_TOPOLOGY_LOCK_NAME}.lock`);
}

function assertReportScopedPaths(result: {
  sessionPath: string | null;
  humanStatePath: string | null;
  reportPath: string | null;
}): void {
  assert.match(result.sessionPath ?? "", /^\.blueprint\/reports\/\.god-review-/);
  assert.match(result.humanStatePath ?? "", /^\.blueprint\/reports\/.+\.god-review-state\.md$/);
  assert.match(result.reportPath ?? "", /^\.blueprint\/reports\/god-review-/);
}

async function assertNormalArtifactsUnchanged(repoPath: string, before: {
  state: string;
  review: string;
  reviewFix: string;
}): Promise<void> {
  assert.equal(await readRelative(repoPath, ".blueprint/STATE.md"), before.state);
  assert.equal(await readRelative(repoPath, `${PHASE_DIR}/05-REVIEW.md`), before.review);
  assert.equal(
    await readRelative(repoPath, `${PHASE_DIR}/05-REVIEW-FIX.md`),
    before.reviewFix
  );
}

async function replacePhaseTopologyUnderLock(repoPath: string): Promise<void> {
  await withBlueprintRepoLock(repoPath, PHASE_TOPOLOGY_LOCK_NAME, async () => {
    await fs.rename(path.join(repoPath, PHASE_DIR), path.join(repoPath, REPLACEMENT_PHASE_DIR));

    const roadmapPath = path.join(repoPath, ".blueprint/ROADMAP.md");
    const roadmap = await readFile(roadmapPath, "utf8");
    await writeFile(
      roadmapPath,
      roadmap
        .replace(/\*\*Phase 5: God Review\*\*/g, "**Phase 5: God Review Replacement**")
        .replace(/### Phase 5: God Review/g, "### Phase 5: God Review Replacement")
        .replace(
          "Review changed files in god mode.",
          "Review changed files after topology replacement."
        ),
      "utf8"
    );
  });
}

test("blueprint_god_review_start creates a phase-scoped session without normal review side effects", async () => {
  const repoPath = await writeGodReviewFixtureRepo();
  const before = {
    state: await readRelative(repoPath, ".blueprint/STATE.md"),
    review: await readRelative(repoPath, `${PHASE_DIR}/05-REVIEW.md`),
    reviewFix: await readRelative(repoPath, `${PHASE_DIR}/05-REVIEW-FIX.md`)
  };
  const result = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review 5 --feels-like-god",
    scopeKind: "phase",
    phase: 5
  });

  assert.equal(result.status, "started");
  assert.equal(result.scopeKind, "phase");
  assert.equal(result.sessionPath, `${PHASE_DIR}/.god-review-session.json`);
  assert.equal(result.humanStatePath, `${PHASE_DIR}/.god-review-state.md`);
  assert.equal(result.reportPath, `${PHASE_DIR}/05-GOD-REVIEW.md`);
  assert.deepEqual(result.files, ["src/feature.ts", "tests/feature.test.ts"]);
  assert.equal(result.nextGroupId, "correctness-contracts");
  assert.equal(result.written, true);

  const session = godReviewSessionSchema.parse(
    JSON.parse(await readRelative(repoPath, result.sessionPath!))
  );
  assert.equal(session.schemaVersion, 1);
  assert.equal(session.scopeKind, "phase");
  assert.equal(session.phase, "5");
  assert.equal(session.phaseTopologyFingerprint?.phaseNumber, "5");
  assert.equal(session.phaseTopologyFingerprint?.phaseDir, PHASE_DIR);
  assert.equal(session.phaseTopologyFingerprint?.roadmapEntry?.goal, "Review changed files in god mode.");
  assert.match(await readRelative(repoPath, result.reportPath!), /# God Review: god-5/);
  assert.match(
    await readRelative(repoPath, result.humanStatePath!),
    /Next hidden command: \/blu-code-review 5 --feels-like-god --continue/
  );
  await assertNormalArtifactsUnchanged(repoPath, before);

  const reused = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review 5 --feels-like-god",
    scopeKind: "phase",
    phase: 5
  });

  assert.equal(reused.status, "reused");
  assert.equal(reused.written, false);
});

test("blueprint_god_review_start rejects stale phase topology before writing phase artifacts", async (t) => {
  const repoPath = await writeGodReviewFixtureRepo();
  const pause = pauseFirstMkdirToPath(t, phaseTopologyLockPath(repoPath));
  const start = blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review 5 --feels-like-god",
    scopeKind: "phase",
    phase: 5
  });

  await waitFor(pause.paused, "god-review start phase-topology lock attempt");
  await replacePhaseTopologyUnderLock(repoPath);
  pause.resume();

  const result = await start;

  assert.equal(result.status, "stale");
  assert.equal(result.written, false);
  assert.equal(result.sessionPath, null);
  assert.match(result.reason ?? "", /God-review start rejected stale phase topology/);
  assert.equal(
    await pathExists(path.join(repoPath, PHASE_DIR, ".god-review-session.json")),
    false
  );
  assert.equal(
    await pathExists(path.join(repoPath, PHASE_DIR, ".god-review-state.md")),
    false
  );
  assert.equal(
    await pathExists(path.join(repoPath, PHASE_DIR, "05-GOD-REVIEW.md")),
    false
  );
  assert.equal(
    await pathExists(path.join(repoPath, REPLACEMENT_PHASE_DIR, ".god-review-session.json")),
    false
  );
  assert.equal(
    await pathExists(path.join(repoPath, REPLACEMENT_PHASE_DIR, ".god-review-state.md")),
    false
  );
  assert.equal(
    await pathExists(path.join(repoPath, REPLACEMENT_PHASE_DIR, "05-GOD-REVIEW.md")),
    false
  );
});

test("blueprint_god_review_start creates report-scoped explicit-file sessions", async () => {
  const repoPath = await writeGodReviewFixtureRepo();
  const result = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --files src/feature.ts",
    scopeKind: "explicit-files",
    files: ["src/feature.ts"],
    runId: "god-explicit-test"
  });

  assert.equal(result.status, "started");
  assert.equal(result.scopeKind, "explicit-files");
  assertReportScopedPaths(result);
  assert.deepEqual(result.files, ["src/feature.ts"]);
  assert.equal(result.phase, null);
  assert.equal(result.scopeFingerprint?.diffHash, null);
  assert.equal(
    godReviewSessionSchema.parse(JSON.parse(await readRelative(repoPath, result.sessionPath!)))
      .runId,
    "god-explicit-test"
  );
});

test("blueprint_god_review_start parses raw --files scope without structured files", async () => {
  const repoPath = await writeGodReviewFixtureRepo();
  const result = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation:
      "/blu-code-review --feels-like-god --files src/feature.ts tests/feature.test.ts --run-id god-raw-files",
    runId: "god-raw-files"
  });

  assert.equal(result.status, "started");
  assert.equal(result.scopeKind, "explicit-files");
  assert.deepEqual(result.files, ["src/feature.ts", "tests/feature.test.ts"]);
  assert.equal(result.phase, null);
});

test("blueprint_god_review_start rejects fix-mode active command for review sessions", async () => {
  const repoPath = await writeGodReviewFixtureRepo();
  const result = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation:
      "/blu-code-review-fix --feels-like-god --files src/feature.ts --run-id god-wrong-mode",
    files: ["src/feature.ts"],
    runId: "god-wrong-mode"
  } as never);

  assert.equal(result.status, "invalid");
  assert.equal(result.activated, false);
  assert.equal(result.written, false);
});

test("blueprint_god_review_start rejects existing session reuse when requested scope changes", async () => {
  const repoPath = await writeGodReviewFixtureRepo();
  const first = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation:
      "/blu-code-review --feels-like-god --files src/feature.ts --run-id god-reuse-mismatch",
    files: ["src/feature.ts"],
    runId: "god-reuse-mismatch"
  });
  assert.equal(first.status, "started");

  const second = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation:
      "/blu-code-review --feels-like-god --files tests/feature.test.ts --run-id god-reuse-mismatch",
    files: ["tests/feature.test.ts"],
    runId: "god-reuse-mismatch"
  });

  assert.equal(second.status, "invalid");
  assert.match(second.reason ?? "", /does not match the requested scope/);
  assert.match(second.warnings.join("\n"), /files changed|fileSetHash changed/);
  assert.equal(second.written, false);
});

test("blueprint_god_review_start rejects unsafe explicit file scopes without writes", async () => {
  const repoPath = await writeGodReviewFixtureRepo();
  await mkdir(path.join(repoPath, "src/directory"), { recursive: true });

  for (const [label, files] of [
    ["absolute", [path.join(repoPath, "src/feature.ts")]],
    ["glob", ["src/*.ts"]],
    ["missing", ["src/missing.ts"]],
    ["blueprint", [".blueprint/STATE.md"]],
    ["directory", ["src/directory"]]
  ] as const) {
    const result = await blueprintGodReviewStart({
      cwd: repoPath,
      activeCommand: "/blu-code-review",
      rawInvocation: `/blu-code-review --feels-like-god --files ${label}`,
      scopeKind: "explicit-files",
      files,
      runId: `god-invalid-${label}`
    });

    assert.equal(result.status, "invalid", label);
    assert.equal(result.written, false, label);
    assert.equal(result.sessionPath, null, label);
  }
});

test("blueprint_god_review_start rejects conflicting raw and structured scope selectors", async () => {
  const repoPath = await writeGodReviewFixtureRepo();

  const filesConflict = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation:
      "/blu-code-review --feels-like-god --files tests/feature.test.ts --run-id god-files-conflict",
    files: ["src/feature.ts"],
    runId: "god-files-conflict"
  });
  assert.equal(filesConflict.status, "invalid");
  assert.match(filesConflict.reason ?? "", /conflict/i);

  const mixedSelectors = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation:
      "/blu-code-review --feels-like-god --pr 7 --files src/feature.ts --run-id god-mixed-scope",
    runId: "god-mixed-scope"
  });
  assert.equal(mixedSelectors.status, "invalid");
  assert.match(mixedSelectors.reason ?? "", /conflicting scope selectors/);
});

test("blueprint_god_review_start rejects bare raw --pr without falling back to phase scope", async () => {
  const repoPath = await writeGodReviewFixtureRepo();
  const result = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --pr --run-id god-bare-pr",
    runId: "god-bare-pr"
  });

  assert.equal(result.status, "invalid");
  assert.match(result.reason ?? "", /Raw --pr god-review scope must name a positive integer/);
  assert.equal(result.scopeKind, null);
  assert.equal(result.phase, null);
  assert.equal(result.written, false);
  assert.equal(result.sessionPath, null);
});

test("blueprint_god_review_start creates report-scoped current-diff sessions", async () => {
  const repoPath = await writeGodReviewFixtureRepo();
  await writeFile(
    path.join(repoPath, "src/feature.ts"),
    "export function featureValue(input: number) {\n  return input + 2;\n}\n",
    "utf8"
  );

  const result = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --current-diff",
    scopeKind: "current-diff",
    runId: "god-current-diff-test"
  });

  assert.equal(result.status, "started");
  assert.equal(result.scopeKind, "current-diff");
  assertReportScopedPaths(result);
  assert.deepEqual(result.files, ["src/feature.ts"]);
  assert.match(result.scopeFingerprint?.diffHash ?? "", /^sha256:/);
  assert.equal(result.phase, null);
});

test("blueprint_god_review_start keeps deleted current-diff files reviewable", async () => {
  const repoPath = await writeGodReviewFixtureRepo();
  await rm(path.join(repoPath, "src/feature.ts"));

  const result = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --current-diff",
    runId: "god-current-deleted"
  });

  assert.equal(result.status, "started");
  assert.equal(result.scopeKind, "current-diff");
  assert.deepEqual(result.files, ["src/feature.ts"]);
  assert.deepEqual(result.skippedFiles, []);
});

test("blueprint_god_review_start creates report-scoped PR sessions from gh read access", async (t) => {
  const repoPath = await writeGodReviewFixtureRepo();
  const binDir = await mkdtemp(path.join(os.tmpdir(), "blueprint-gh-fixture-"));
  const ghPath = path.join(binDir, "gh");
  const originalPath = process.env.PATH;

  await writeFile(
    ghPath,
    `#!/bin/sh
if [ "$1" = "pr" ] && [ "$2" = "diff" ] && [ "$3" = "7" ] && [ "$4" = "--name-only" ]; then
  printf 'src/feature.ts\\n'
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "diff" ] && [ "$3" = "7" ]; then
  printf 'diff --git a/src/feature.ts b/src/feature.ts\\n'
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "view" ] && [ "$3" = "7" ]; then
  printf '{"baseRefOid":"base123","headRefOid":"head456"}\\n'
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "diff" ] && [ "$3" = "8" ] && [ "$4" = "--name-only" ]; then
  printf 'src/deleted.ts\\n'
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "diff" ] && [ "$3" = "8" ]; then
  printf 'diff --git a/src/deleted.ts b/src/deleted.ts\\ndeleted file mode 100644\\n'
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "view" ] && [ "$3" = "8" ]; then
  printf '{"baseRefOid":"base789","headRefOid":"head999"}\\n'
  exit 0
fi
exit 2
`,
    "utf8"
  );
  await chmod(ghPath, 0o755);
  process.env.PATH = `${binDir}${path.delimiter}${originalPath ?? ""}`;
  t.after(() => {
    process.env.PATH = originalPath;
  });

  const result = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --pr 7",
    scopeKind: "pr",
    prNumber: 7,
    runId: "god-pr-test"
  });

  assert.equal(result.status, "started");
  assert.equal(result.scopeKind, "pr");
  assertReportScopedPaths(result);
  assert.deepEqual(result.files, ["src/feature.ts"]);
  assert.equal(result.scopeFingerprint?.prNumber, 7);
  assert.equal(result.scopeFingerprint?.baseSha, "base123");
  assert.equal(result.scopeFingerprint?.headSha, "head456");

  const rawOnly = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --pr 7 --run-id god-pr-raw",
    runId: "god-pr-raw"
  });
  assert.equal(rawOnly.status, "started");
  assert.equal(rawOnly.scopeKind, "pr");
  assert.equal(rawOnly.scopeFingerprint?.prNumber, 7);

  const deleted = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation:
      "/blu-code-review --feels-like-god --pr 8 --run-id god-pr-deleted",
    runId: "god-pr-deleted"
  });
  assert.equal(deleted.status, "started");
  assert.equal(deleted.scopeKind, "pr");
  assert.deepEqual(deleted.files, ["src/deleted.ts"]);
  assert.deepEqual(deleted.skippedFiles, []);

  const collisionFirst = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation:
      "/blu-code-review --feels-like-god --pr 7 --run-id god-pr-collision",
    runId: "god-pr-collision"
  });
  assert.equal(collisionFirst.status, "started");

  const collisionSecond = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation:
      "/blu-code-review --feels-like-god --pr 8 --run-id god-pr-collision",
    runId: "god-pr-collision"
  });
  assert.equal(collisionSecond.status, "invalid");
  assert.match(collisionSecond.reason ?? "", /does not match the requested scope/);
  assert.match(collisionSecond.warnings.join("\n"), /prNumber changed|fileSetHash changed/);
});

test("normal progress, next, and quality-gate routing ignore god-review state files", async () => {
  const repoPath = await writeGodReviewFixtureRepo();
  const before = {
    state: await readRelative(repoPath, ".blueprint/STATE.md"),
    review: await readRelative(repoPath, `${PHASE_DIR}/05-REVIEW.md`),
    reviewFix: await readRelative(repoPath, `${PHASE_DIR}/05-REVIEW-FIX.md`)
  };
  const beforeQualityGates = await evaluatePhaseQualityGates({
    projectRoot: repoPath,
    phaseNumber: "5",
    phasePrefix: "05",
    phaseDir: PHASE_DIR
  });

  await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review 5 --feels-like-god",
    scopeKind: "phase",
    phase: 5
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });
  const qualityGates = await evaluatePhaseQualityGates({
    projectRoot: repoPath,
    phaseNumber: "5",
    phasePrefix: "05",
    phaseDir: PHASE_DIR
  });

  assert.doesNotMatch(status.nextAction, /god-review|feels-like-god|GOD-REVIEW/i);
  assert.doesNotMatch(
    state.derivedStatus.nextAction,
    /god-review|feels-like-god|GOD-REVIEW/i
  );
  assert.equal(qualityGates.reviewPath, `${PHASE_DIR}/05-REVIEW.md`);
  assert.equal(qualityGates.hasReview, beforeQualityGates.hasReview);
  assert.equal(qualityGates.gatesSatisfied, beforeQualityGates.gatesSatisfied);
  assert.equal(qualityGates.missingGate, beforeQualityGates.missingGate);
  await assertNormalArtifactsUnchanged(repoPath, before);
});
