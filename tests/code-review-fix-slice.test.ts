import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import {
  blueprintReviewLoadFindings,
  blueprintReviewRecord
} from "../src/mcp/tools/review.js";

const repoRoot = process.cwd();

async function createCodeReviewFixRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-code-review-fix-"));
  const repoPath = path.join(tempRoot, "repo");
  const phaseDir = path.join(repoPath, ".blueprint/phases/05-review-fix");

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Code Review Fix Fixture

## Milestone

- Active milestone: v4

## Phases

- [x] **Phase 5: Review Fix** - Completed review with follow-up fixes

## Phase Details

### Phase 5: Review Fix
**Goal**: Remediate the saved review findings.
**Requirements**: REVFIX-01
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v4
- Current phase: 5
- Active command: /blu-code-review
- Next action: Run /blu-code-review-fix 5
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
    path.join(phaseDir, "05-REVIEW.md"),
    `# Phase 05: Review Fix - Review

**Status:** FOLLOW_UP

## Findings

- [high] Handle negative inputs explicitly in src/feature.ts.
- [medium] Add a regression test for negative-input behavior.

## Follow-Ups

- Re-run focused validation after the negative-input guard lands.
`,
    "utf8"
  );

  return repoPath;
}

test("code-review-fix docs and catalog metadata promote the review-remediation slice to implemented", async () => {
  const [catalogMarkdown, implementationOrder, commandDoc, runtimeReference] = await Promise.all([
    readFile(path.join(repoRoot, "docs/COMMAND-CATALOG.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/IMPLEMENTATION-ORDER.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/commands/code-review-fix.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  assert.match(
    catalogMarkdown,
    /\| `code-review-fix` \| 4 \| `Quality And Shipping` \| `blueprint-review` \| `implemented` \| `phase XX-REVIEW-FIX\.md; code changes for selected findings; \.blueprint\/STATE\.md` \| `High: selected findings can trigger bounded repo remediation plus review-fix\/state updates\.` \|/
  );
  assert.match(
    implementationOrder,
    /Shipped in this wave: `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `review`, `ui-review`, `docs-update`, `add-tests`, `pr-branch`, `ship`, and `undo`\./
  );
  assert.match(commandDoc, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(commandDoc, /## Shared Runtime Contract/);
  assert.match(commandDoc, /## In-Flight Progress Contract/);
  assert.match(
    commandDoc,
    /selected finding ids, selected-finding mode \(`explicit`, `--all`, or bounded `--auto`\), active stage, pending gate, execution mode, remediation progress, verification progress, deferred findings, artifact status, and next safe action/i
  );
  assert.match(commandDoc, /`update_topic` tool and keep a compact remediation checklist with `write_todos`/);
  assert.match(
    runtimeReference,
    /`code-review-fix`[\s\S]*Long-running-mutation profile for bounded review remediation[\s\S]*confirm overwrite or finding selection explicitly before mutation[\s\S]*explicit selection, `--all`, or bounded `--auto`/i
  );
});

test("blueprint_review_load_findings parses structured findings and severity counts from a saved review artifact", async (t) => {
  const repoPath = await createCodeReviewFixRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const loaded = await blueprintReviewLoadFindings({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review"
  });

  assert.equal(loaded.phaseFound, true);
  assert.equal(loaded.found, true);
  assert.equal(loaded.path, ".blueprint/phases/05-review-fix/05-REVIEW.md");
  assert.equal(loaded.findings.length, 2);
  assert.deepEqual(
    loaded.findings.map((finding) => [finding.id, finding.severity, finding.summary]),
    [
      ["F-01", "high", "Handle negative inputs explicitly in src/feature.ts."],
      ["F-02", "medium", "Add a regression test for negative-input behavior."]
    ]
  );
  assert.deepEqual(loaded.severityCounts, {
    critical: 0,
    high: 1,
    medium: 1,
    low: 0,
    unknown: 0
  });
  assert.deepEqual(loaded.followUps, [
    "Re-run focused validation after the negative-input guard lands."
  ]);
});

test("blueprint_review_record and blueprint_review_load_findings use the canonical review-fix findings heading", async (t) => {
  const repoPath = await createCodeReviewFixRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const recorded = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix",
    content: `# Phase 05: Review Fix - Review Fix

**Status:** APPLIED

## Findings Addressed

- [high] Handle negative inputs explicitly in src/feature.ts.
- [medium] Add a regression test for negative-input behavior.

## Changes Made

- Added the negative-input guard and matching regression coverage.

## Verification

- node --test tests/code-review-fix-slice.test.ts

## Follow-Ups

- Re-run focused validation after the negative-input guard lands.

## Next Safe Action

- /blu-progress
`
  });

  assert.equal(recorded.status, "created");
  assert.equal(recorded.reportPath, ".blueprint/phases/05-review-fix/05-REVIEW-FIX.md");
  assert.deepEqual(recorded.counts, {
    sections: 6,
    findings: 2,
    followUps: 1
  });
  assert.deepEqual(recorded.followUps, [
    "Re-run focused validation after the negative-input guard lands."
  ]);

  const loaded = await blueprintReviewLoadFindings({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix"
  });

  assert.equal(loaded.phaseFound, true);
  assert.equal(loaded.found, true);
  assert.equal(loaded.path, ".blueprint/phases/05-review-fix/05-REVIEW-FIX.md");
  assert.deepEqual(
    loaded.findings.map((finding) => [finding.id, finding.severity, finding.summary]),
    [
      ["F-01", "high", "Handle negative inputs explicitly in src/feature.ts."],
      ["F-02", "medium", "Add a regression test for negative-input behavior."]
    ]
  );
  assert.deepEqual(loaded.severityCounts, {
    critical: 0,
    high: 1,
    medium: 1,
    low: 0,
    unknown: 0
  });
  assert.deepEqual(loaded.followUps, [
    "Re-run focused validation after the negative-input guard lands."
  ]);
});

test("code-review-fix is exposed as an implemented remediation command with the findings tool", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["code-review-fix"];

  assert.ok(blueprintToolNames.includes("blueprint_review_load_findings"));
  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.manifestPath, "commands/blu-code-review-fix.toml");
  assert.deepEqual(entry.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_review_load_findings",
    "blueprint_artifact_contract_read",
    "blueprint_review_record",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-reviewer"]);
});
