import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import { blueprintReviewScope } from "../src/mcp/tools/review.js";

const repoRoot = process.cwd();

async function createCodeReviewRepo(withSummary = true): Promise<string> {
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
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");
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
  - src/feature.ts
  - tests/feature.test.ts
  - .blueprint/phases/05-review-scope/05-REVIEW.md
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
  await writeFile(
    path.join(phaseDir, "05-VERIFICATION.md"),
    `# Phase 05: Code Review Scope - Verification

## Result

- Validation evidence is available.
`,
    "utf8"
  );

  if (withSummary) {
    await writeFile(
      path.join(phaseDir, "05-01-SUMMARY.md"),
      `# Phase 05: Code Review Scope - Summary 01

## Result

- Updated the source and test files for the feature slice.
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

test("blueprint_review_scope derives repo files from executed phase plans and filters Blueprint artifacts", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const scoped = await blueprintReviewScope({
    cwd: repoPath,
    phase: "5",
    depth: "deep"
  });

  assert.equal(scoped.status, "ready");
  assert.equal(scoped.phase?.phaseNumber, "5");
  assert.deepEqual(scoped.files, ["src/feature.ts", "tests/feature.test.ts"]);
  assert.equal(scoped.reviewMode.depth, "deep");
  assert.equal(scoped.reviewMode.source, "phase-plans");
  assert.deepEqual(scoped.artifacts.plans, [".blueprint/phases/05-review-scope/05-01-PLAN.md"]);
  assert.deepEqual(scoped.artifacts.summaries, [
    ".blueprint/phases/05-review-scope/05-01-SUMMARY.md"
  ]);
  assert.equal(
    scoped.artifacts.verification,
    ".blueprint/phases/05-review-scope/05-VERIFICATION.md"
  );
  assert.match(scoped.warnings.join("\n"), /Skipped Blueprint artifact path/);
});

test("blueprint_review_scope reports invalid when no executed evidence or explicit files exist", async (t) => {
  const repoPath = await createCodeReviewRepo(false);
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
  assert.match(scoped.warnings.join("\n"), /No execution summaries were found/);
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
