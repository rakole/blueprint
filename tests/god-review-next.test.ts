import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  blueprintGodReviewNext,
  blueprintGodReviewStart,
  godReviewSessionSchema
} from "../src/mcp/tools/god-review.js";
import {
  createCommittedGitRepo,
  runGit
} from "./helpers/git-fixtures.js";

const PHASE_DIR = ".blueprint/phases/05-god-review";

async function writeFixtureRepo(): Promise<string> {
  const repoPath = await createCommittedGitRepo("blueprint-god-review-next-");
  const phaseDir = path.join(repoPath, PHASE_DIR);

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await mkdir(path.join(repoPath, "tests"), { recursive: true });
  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
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
  await runGit(["add", "."], repoPath);
  await runGit(["commit", "-m", "fixture"], repoPath);

  return repoPath;
}

async function readRelative(repoPath: string, relativePath: string): Promise<string> {
  return readFile(path.join(repoPath, relativePath), "utf8");
}

async function writeFakeGh(t: TestContext): Promise<void> {
  const binDir = await mkdtemp(path.join(os.tmpdir(), "blueprint-gh-next-"));
  const ghPath = path.join(binDir, "gh");
  const originalPath = process.env.PATH;
  const originalVariant = process.env.BLUEPRINT_TEST_GH_VARIANT;

  await writeFile(
    ghPath,
    `#!/bin/sh
variant="$BLUEPRINT_TEST_GH_VARIANT"
if [ "$1" = "pr" ] && [ "$2" = "diff" ] && [ "$3" = "7" ] && [ "$4" = "--name-only" ]; then
  printf 'src/feature.ts\\n'
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "diff" ] && [ "$3" = "7" ]; then
  if [ "$variant" = "two" ]; then
    printf 'diff --git a/src/feature.ts b/src/feature.ts\\n+two\\n'
  else
    printf 'diff --git a/src/feature.ts b/src/feature.ts\\n+one\\n'
  fi
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "view" ] && [ "$3" = "7" ]; then
  if [ "$variant" = "two" ]; then
    printf '{"baseRefOid":"base123","headRefOid":"head789"}\\n'
  else
    printf '{"baseRefOid":"base123","headRefOid":"head456"}\\n'
  fi
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
    process.env.BLUEPRINT_TEST_GH_VARIANT = originalVariant;
  });
}

test("blueprint_god_review_next returns the frozen pending group without rediscovering phase scope", async () => {
  const repoPath = await writeFixtureRepo();
  const start = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review 5 --feels-like-god",
    scopeKind: "phase",
    phase: 5
  });
  assert.equal(start.status, "started");

  const sessionBefore = await readRelative(repoPath, start.sessionPath!);
  const reportBefore = await readRelative(repoPath, start.reportPath!);
  await writeFile(
    path.join(repoPath, "src/extra.ts"),
    "export const extra = true;\n",
    "utf8"
  );
  await writeFile(
    path.join(repoPath, `${PHASE_DIR}/05-01-PLAN.md`),
    `${await readRelative(repoPath, `${PHASE_DIR}/05-01-PLAN.md`)}  - src/extra.ts\n`,
    "utf8"
  );

  const next = await blueprintGodReviewNext({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review 5 --feels-like-god --continue",
    phase: 5
  });

  assert.equal(next.status, "ready");
  assert.deepEqual(next.files, ["src/feature.ts", "tests/feature.test.ts"]);
  assert.equal(next.nextGroup?.id, "correctness-contracts");
  assert.equal(next.written, false);
  assert.equal(await readRelative(repoPath, start.sessionPath!), sessionBefore);
  assert.equal(await readRelative(repoPath, start.reportPath!), reportBefore);
});

test("blueprint_god_review_next blocks changed explicit file-set fingerprints without rewriting artifacts", async () => {
  const repoPath = await writeFixtureRepo();
  await writeFile(path.join(repoPath, "src/extra.ts"), "export const extra = true;\n", "utf8");
  const start = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --files src/feature.ts",
    scopeKind: "explicit-files",
    files: ["src/feature.ts"],
    runId: "god-explicit-next"
  });
  assert.equal(start.status, "started");

  const session = godReviewSessionSchema.parse(
    JSON.parse(await readRelative(repoPath, start.sessionPath!))
  );
  await writeFile(
    path.join(repoPath, start.sessionPath!),
    `${JSON.stringify({ ...session, files: [...session.files, "src/extra.ts"] }, null, 2)}\n`,
    "utf8"
  );
  const sessionBefore = await readRelative(repoPath, start.sessionPath!);
  const reportBefore = await readRelative(repoPath, start.reportPath!);

  const next = await blueprintGodReviewNext({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --run-id god-explicit-next --continue",
    runId: "god-explicit-next"
  });

  assert.equal(next.status, "stale");
  assert.match(next.staleReasons.join("\n"), /fileSetHash changed/);
  assert.equal(next.written, false);
  assert.equal(await readRelative(repoPath, start.sessionPath!), sessionBefore);
  assert.equal(await readRelative(repoPath, start.reportPath!), reportBefore);
});

test("blueprint_god_review_next blocks uncommitted explicit-file content drift", async () => {
  const repoPath = await writeFixtureRepo();
  const start = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --files src/feature.ts",
    scopeKind: "explicit-files",
    files: ["src/feature.ts"],
    runId: "god-explicit-content-next"
  });
  assert.equal(start.status, "started");

  const sessionBefore = await readRelative(repoPath, start.sessionPath!);
  const reportBefore = await readRelative(repoPath, start.reportPath!);
  await writeFile(
    path.join(repoPath, "src/feature.ts"),
    "export function featureValue(input: number) {\n  return input + 99;\n}\n",
    "utf8"
  );

  const next = await blueprintGodReviewNext({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation:
      "/blu-code-review --feels-like-god --run-id god-explicit-content-next --continue",
    runId: "god-explicit-content-next"
  });

  assert.equal(next.status, "stale");
  assert.match(next.staleReasons.join("\n"), /fileSetHash changed/);
  assert.equal(next.written, false);
  assert.equal(await readRelative(repoPath, start.sessionPath!), sessionBefore);
  assert.equal(await readRelative(repoPath, start.reportPath!), reportBefore);
});

test("blueprint_god_review_next blocks changed current-diff fingerprints and preserves artifacts", async () => {
  const repoPath = await writeFixtureRepo();
  await writeFile(
    path.join(repoPath, "src/feature.ts"),
    "export function featureValue(input: number) {\n  return input + 2;\n}\n",
    "utf8"
  );
  const start = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --current-diff",
    scopeKind: "current-diff",
    runId: "god-current-next"
  });
  assert.equal(start.status, "started");

  const sessionBefore = await readRelative(repoPath, start.sessionPath!);
  const reportBefore = await readRelative(repoPath, start.reportPath!);
  await writeFile(
    path.join(repoPath, "src/feature.ts"),
    "export function featureValue(input: number) {\n  return input + 3;\n}\n",
    "utf8"
  );

  const next = await blueprintGodReviewNext({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --run-id god-current-next --continue",
    runId: "god-current-next"
  });

  assert.equal(next.status, "stale");
  assert.match(next.staleReasons.join("\n"), /diffHash changed/);
  assert.equal(next.written, false);
  assert.equal(await readRelative(repoPath, start.sessionPath!), sessionBefore);
  assert.equal(await readRelative(repoPath, start.reportPath!), reportBefore);
});

test("blueprint_god_review_next blocks changed PR fingerprints and preserves artifacts", async (t) => {
  const repoPath = await writeFixtureRepo();
  await writeFakeGh(t);
  process.env.BLUEPRINT_TEST_GH_VARIANT = "one";
  const start = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --pr 7",
    scopeKind: "pr",
    prNumber: 7,
    runId: "god-pr-next"
  });
  assert.equal(start.status, "started");

  const sessionBefore = await readRelative(repoPath, start.sessionPath!);
  const reportBefore = await readRelative(repoPath, start.reportPath!);
  process.env.BLUEPRINT_TEST_GH_VARIANT = "two";

  const next = await blueprintGodReviewNext({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --run-id god-pr-next --continue",
    runId: "god-pr-next"
  });

  assert.equal(next.status, "stale");
  assert.match(next.staleReasons.join("\n"), /headSha changed|diffHash changed/);
  assert.equal(next.written, false);
  assert.equal(await readRelative(repoPath, start.sessionPath!), sessionBefore);
  assert.equal(await readRelative(repoPath, start.reportPath!), reportBefore);
});
