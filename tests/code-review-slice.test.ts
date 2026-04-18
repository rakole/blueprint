import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import { blueprintReviewScope } from "../src/mcp/tools/review.js";

const repoRoot = process.cwd();
const execFileAsync = promisify(execFileCallback);

type CodeReviewRepoOptions = {
  withPlan?: boolean;
  withSummary?: boolean;
  planFilesModified?: string[];
  summaryChangedFiles?: string[];
  configPatch?: Record<string, unknown>;
};

async function createCodeReviewRepo(
  options: CodeReviewRepoOptions = {}
): Promise<string> {
  const {
    withPlan = true,
    withSummary = true,
    planFilesModified = [
      "src/feature.ts",
      "tests/feature.test.ts",
      ".blueprint/phases/05-review-scope/05-REVIEW.md"
    ],
    summaryChangedFiles = [],
    configPatch = {}
  } = options;
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-code-review-"));
  const repoPath = path.join(tempRoot, "repo");
  const phaseDir = path.join(repoPath, ".blueprint/phases/05-review-scope");

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await mkdir(path.join(repoPath, "tests"), { recursive: true });
  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Code Review Fixture

## Milestone

- Active milestone: v4

## Phases

- [x] **Phase 5: Review Scope** - Completed implementation ready for review

## Phase Details

### Phase 5: Review Scope
**Goal**: Review the repo files changed during the completed phase.
**Requirements**: REV-01
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v4
- Current phase: 5
- Active command: /blu-execute-phase
- Next action: Run /blu-code-review 5
- Last updated: 2026-04-13T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    `${JSON.stringify({ version: 2, ...configPatch }, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, "src/feature.ts"),
    "export function calculateValue(input: number) {\n  return input * 2;\n}\n",
    "utf8"
  );
  await writeFile(
    path.join(repoPath, "tests/feature.test.ts"),
    "import assert from 'node:assert/strict';\n\nassert.equal(2 * 2, 4);\n",
    "utf8"
  );

  for (const candidateFile of summaryChangedFiles) {
    if (candidateFile.startsWith(".blueprint/")) {
      continue;
    }

    const absolutePath = path.join(repoPath, candidateFile);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(
      absolutePath,
      `export const ${path.basename(candidateFile, path.extname(candidateFile)).replace(/[^a-zA-Z0-9_]/g, "_")} = true;\n`,
      "utf8"
    );
  }

  if (withPlan) {
    await writeFile(
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
${planFilesModified.map((file) => `  - ${file}`).join("\n")}
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
`,
      "utf8"
    );
  }

  await writeFile(
    path.join(phaseDir, "05-VERIFICATION.md"),
    `# Phase 05: Code Review Scope - Verification

## Result

- Validation evidence is available.
`,
    "utf8"
  );

  if (withSummary) {
    const summaryChanges =
      summaryChangedFiles.length > 0
        ? summaryChangedFiles.map((file) => `- \`${file}\``).join("\n")
        : "- Updated the source and test files for the feature slice.";

    await writeFile(
      path.join(phaseDir, "05-01-SUMMARY.md"),
      `# Phase 05: Code Review Scope - Summary 01

## Result

- Completed the review-ready feature slice.

## Changes Made

${summaryChanges}

## Evidence

- Summary evidence captured for this phase.
`,
      "utf8"
    );
  }

  return repoPath;
}

test("code-review docs and catalog metadata promote the review scope slice to implemented", async () => {
  const [catalogMarkdown, skillsMarkdown] = await Promise.all([
    readFile(path.join(repoRoot, "docs/COMMAND-CATALOG.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/SKILLS-AND-AGENTS.md"), "utf8")
  ]);

  assert.match(
    catalogMarkdown,
    /\| `code-review` \| 4 \| `Quality And Shipping` \| `blueprint-review` \| `implemented` \| `phase XX-REVIEW\.md` \| `Low: review artifact generation only\.` \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-reviewer` \| `implemented` \| Produce bounded code review findings from a resolved Blueprint scope \|/
  );
});

test("blueprint_review_scope prefers summary changed files over plan files when no explicit scope is provided", async (t) => {
  const repoPath = await createCodeReviewRepo({
    summaryChangedFiles: ["src/summary.ts"],
    planFilesModified: [
      "src/plan.ts",
      "tests/plan.test.ts",
      ".blueprint/phases/05-review-scope/05-REVIEW.md"
    ]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const scoped = await blueprintReviewScope({
    cwd: repoPath,
    phase: "5"
  });

  assert.equal(scoped.status, "ready");
  assert.equal(scoped.phase?.phaseNumber, "5");
  assert.deepEqual(scoped.files, ["src/summary.ts"]);
  assert.equal(scoped.reviewMode.depth, "standard");
  assert.equal(scoped.reviewMode.source, "phase-plans");
  assert.deepEqual(scoped.artifacts.plans, [".blueprint/phases/05-review-scope/05-01-PLAN.md"]);
  assert.deepEqual(scoped.artifacts.summaries, [
    ".blueprint/phases/05-review-scope/05-01-SUMMARY.md"
  ]);
  assert.equal(
    scoped.artifacts.verification,
    ".blueprint/phases/05-review-scope/05-VERIFICATION.md"
  );
});

test("blueprint_review_scope keeps explicit files scoped exactly to the explicit list", async (t) => {
  const repoPath = await createCodeReviewRepo({
    summaryChangedFiles: ["src/summary.ts"],
    planFilesModified: [
      "src/plan.ts",
      "tests/plan.test.ts",
      ".blueprint/phases/05-review-scope/05-REVIEW.md"
    ]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const scoped = await blueprintReviewScope({
    cwd: repoPath,
    phase: "5",
    files: ["src/feature.ts"]
  });

  assert.equal(scoped.status, "ready");
  assert.deepEqual(scoped.files, ["src/feature.ts"]);
  assert.equal(scoped.reviewMode.source, "explicit-files");
  assert.equal(scoped.reviewMode.depth, "standard");
});

test("blueprint_review_scope honors workflow.code_review and workflow.code_review_depth from config", async (t) => {
  const disabledRepoPath = await createCodeReviewRepo({
    configPatch: { workflow: { code_review: false } }
  });
  const depthRepoPath = await createCodeReviewRepo({
    configPatch: { workflow: { code_review_depth: "deep" } }
  });

  t.after(async () => {
    await rm(path.dirname(disabledRepoPath), { recursive: true, force: true });
    await rm(path.dirname(depthRepoPath), { recursive: true, force: true });
  });

  const disabled = await blueprintReviewScope({
    cwd: disabledRepoPath,
    phase: "5"
  });
  const deepDefault = await blueprintReviewScope({
    cwd: depthRepoPath,
    phase: "5"
  });

  assert.equal(disabled.status, "invalid");
  assert.match(disabled.reason ?? "", /workflow\.code_review is disabled/i);
  assert.equal(deepDefault.status, "ready");
  assert.equal(deepDefault.reviewMode.depth, "deep");
});

test("blueprint_review_scope falls back to git diff when summary evidence does not provide changed files", async (t) => {
  const repoPath = await createCodeReviewRepo({
    withSummary: false,
    planFilesModified: []
  });

  await writeFile(
    path.join(repoPath, "src/git-fallback.ts"),
    "export const gitFallback = 1;\n",
    "utf8"
  );
  await rm(path.join(repoPath, ".git"), { force: true, recursive: true });
  await execFileAsync("git", ["init"], { cwd: repoPath });
  await execFileAsync("git", ["config", "user.email", "codex@example.com"], { cwd: repoPath });
  await execFileAsync("git", ["config", "user.name", "Codex"], { cwd: repoPath });
  await execFileAsync("git", ["add", "."], { cwd: repoPath });
  await execFileAsync("git", ["commit", "-m", "baseline"], { cwd: repoPath });
  await writeFile(
    path.join(repoPath, "src/git-fallback.ts"),
    "export const gitFallback = 2;\n",
    "utf8"
  );

  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const scoped = await blueprintReviewScope({
    cwd: repoPath,
    phase: "5"
  });

  assert.equal(scoped.status, "ready");
  assert.deepEqual(scoped.files, ["src/git-fallback.ts"]);
  assert.equal(scoped.reviewMode.source, "git-diff");
});

test("blueprint_review_scope reports invalid when no executed evidence or explicit files exist", async (t) => {
  const repoPath = await createCodeReviewRepo({
    withPlan: false,
    withSummary: false
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const scoped = await blueprintReviewScope({
    cwd: repoPath,
    phase: "5"
  });

  assert.equal(scoped.status, "invalid");
  assert.equal(scoped.files.length, 0);
  assert.match(scoped.reason ?? "", /could not derive any reviewable repo files/i);
  assert.match(scoped.warnings.join("\n"), /git diff fallback could not be read/i);
});

test("code-review is exposed as an implemented review command with the scope tool and reviewer agent", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["code-review"];

  assert.ok(blueprintToolNames.includes("blueprint_review_scope"));
  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.manifestPath, "commands/blu-code-review.toml");
  assert.deepEqual(entry.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_review_scope",
    "blueprint_review_record",
    "blueprint_artifact_list"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-reviewer"]);
});
