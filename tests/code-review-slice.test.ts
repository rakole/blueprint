import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import {
  blueprintReviewLoadFindings,
  blueprintReviewRecord,
  blueprintReviewScope
} from "../src/mcp/tools/review.js";
import { blueprintStateLoad } from "../src/mcp/tools/state.js";

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
  const codebaseDir = path.join(repoPath, ".blueprint/codebase");

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await mkdir(path.join(repoPath, "tests"), { recursive: true });
  await mkdir(phaseDir, { recursive: true });
  await mkdir(codebaseDir, { recursive: true });
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
  for (const artifact of [
    "STACK.md",
    "ARCHITECTURE.md",
    "STRUCTURE.md",
    "CONVENTIONS.md",
    "TESTING.md",
    "INTEGRATIONS.md",
    "CONCERNS.md"
  ]) {
    await writeFile(path.join(codebaseDir, artifact), `# ${artifact.replace(/\.md$/, "")}\n\n- mapped\n`, "utf8");
  }
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

  for (const candidateFile of new Set([...summaryChangedFiles, ...planFilesModified])) {
    if (candidateFile.startsWith(".blueprint/")) {
      continue;
    }

    const absolutePath = path.join(repoPath, candidateFile);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, `export const ${path.basename(candidateFile, path.extname(candidateFile)).replace(/[^a-zA-Z0-9_]/g, "_")} = true;\n`, "utf8");
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

function createStructuredCodeReviewModel(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    verdict: "FOLLOW_UP",
    depth: "standard",
    scopeSource: "phase-evidence",
    reviewSummary: [
      "Phase 5 standard review covered the source and test files with one high follow-up."
    ],
    scopeReviewed: ["src/feature.ts", "tests/feature.test.ts"],
    evidenceReviewed: [
      ".blueprint/phases/05-review-scope/05-01-PLAN.md",
      ".blueprint/phases/05-review-scope/05-01-SUMMARY.md",
      ".blueprint/phases/05-review-scope/05-VERIFICATION.md"
    ],
    evidenceDeferrals: [],
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
        recommendation: "Add a negative-input guard and matching regression test."
      }
    ],
    followUps: ["Add a negative-input regression test before shipping."],
    nextSafeAction: "/blu-code-review-fix 5",
    ...overrides
  };
}

test("state load follows the saved code-review next safe action once review evidence exists", async (t) => {
  const repoPath = await createCodeReviewRepo({
    configPatch: {
      workflow: {
        research: false,
        ui_phase: false
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const phaseDir = path.join(repoPath, ".blueprint/phases/05-review-scope");

  await writeFile(
    path.join(phaseDir, "05-CONTEXT.md"),
    `# Phase 05: Code Review Scope - Context

## Goal

- Review the changed feature slice with saved Blueprint evidence.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-01-PLAN.md"),
    `---
phase: 5
plan_id: "01"
title: "Code Review Plan 01"
wave: 1
status: done
objective: "Exercise code-review follow-up routing."
depends_on: []
requirements:
  - REV-01
files_modified:
  - src/feature.ts
  - tests/feature.test.ts
read_first:
  - src/feature.ts
acceptance_criteria:
  - tests/code-review-slice.test.ts exits 0
autonomous: true
---

# Phase 05: Code Review Scope - Plan 01

## Goal

Exercise code-review follow-up routing.

## Scope

- Persist saved review evidence for the completed feature slice.

## Tasks

### Task 1: Capture review-ready evidence

#### Read First

- src/feature.ts

#### Action

- Keep the completed review scope grounded in the saved repo files and evidence.

#### Acceptance Criteria

- tests/code-review-slice.test.ts exits 0

## Verification

- Re-run the code-review slice after writing the saved review evidence.

## Must Haves

- Keep review routing grounded in the saved review artifact.
`,
    "utf8"
  );

  await writeFile(
    path.join(phaseDir, "05-VERIFICATION.md"),
    `# Phase 05: Code Review Scope - Verification

**Coverage:** Reviewed \`.blueprint/phases/05-review-scope/05-01-SUMMARY.md\` for completed execution evidence.
**Gate State:** PASS
**Sign-off:** validation lead

## Validation Summary

- Execution evidence matches the expected phase outcome.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| REV-01 | Confirm execution evidence exists | .blueprint/phases/05-review-scope/05-01-SUMMARY.md | PASS | Saved summaries back the verification pass. |

## Evidence Reviewed

- .blueprint/phases/05-review-scope/05-01-SUMMARY.md

## Test Infrastructure / Evidence Metadata

- Harness: node:test
- Commands: npm test
- Evidence type: saved execution summary
- Test infrastructure status: available

## Manual-Only or Deferred Coverage

| Item | Why manual or deferred | Follow-Up | Status |
|------|------------------------|-----------|--------|
| none | none | none | NONE |

## Gate State

- Gate: PASS
- Sign-off: validation lead
- Readiness: ready for UAT

## Gap Classification

| Gap class | Scope | Evidence | Repair |
|-----------|-------|----------|--------|
| none | none | .blueprint/phases/05-review-scope/05-01-SUMMARY.md | none |

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- Continue with conversational UAT through \`/blu-verify-work 5\`.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-01-SUMMARY.md"),
    `# Phase 05: Code Review Scope - Summary 01

**Plan:** \`05-01-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Execution finished and produced a summary artifact.

## Changes Made

- Added the review-ready feature slice.

## Verification

- Ran the saved summary tooling slice.

## Follow-Ups

- none

## Evidence

- \`.blueprint/phases/05-review-scope/05-01-SUMMARY.md\`
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-UAT.md"),
    `# Phase 05: Code Review Scope - UAT

**Status:** PASS
**Resume State:** NEW
**Checkpoint:** none

## UAT Summary

- UAT closed without blocking issues against \`.blueprint/phases/05-review-scope/05-01-SUMMARY.md\`.

## Session State

- Resume source: \`.blueprint/phases/05-review-scope/05-01-SUMMARY.md\`
- Current session step: Close the initial UAT pass.
- Continuity notes: Keep the validated summary-backed behavior stable if the session resumes.

## Current Test

- Number: testing complete
- Name: none
- Expected: Keep the validated summary-backed behavior stable.
- Awaiting: none

## Test Matrix

| # | Test | Expected Behavior | Evidence | Result | Notes |
|---|------|-------------------|----------|--------|-------|
| 1 | Review scope UAT smoke | Keep the validated summary-backed behavior stable. | .blueprint/phases/05-review-scope/05-01-SUMMARY.md | pass | none |

## Result Summary

- Total: 1
- Passed: 1
- Issues: 0
- Pending: 0
- Skipped: 0
- Blocked: 0

## Questions Asked

- Did the delivered behavior match the saved execution summary?

## Observed Behavior

- The observed behavior matched \`.blueprint/phases/05-review-scope/05-01-SUMMARY.md\`.

## Unresolved Gaps

- none

## Structured Gaps

| Test | Truth | Status | Severity | Reason | Follow-Up |
|------|-------|--------|----------|--------|-----------|
| none | none | none | none | none | none |

## Follow-Up Fixes

- none

## Next Safe Action

- Return to \`/blu-progress\` for the next safe implemented action.
`,
    "utf8"
  );

  await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    content: `# Phase 05: Code Review Scope - Review

**Verdict:** FOLLOW_UP

## Review Summary

- Phase 5 standard review over one source file and one test file with two follow-up findings.

## Scope Reviewed

- src/feature.ts
- tests/feature.test.ts

## Evidence Reviewed

- .blueprint/phases/05-review-scope/05-01-PLAN.md
- .blueprint/phases/05-review-scope/05-01-SUMMARY.md
- .blueprint/phases/05-review-scope/05-VERIFICATION.md
- .blueprint/phases/05-review-scope/05-UAT.md

## Positive Signals

- Summary and plan evidence agree on the bounded review scope.

## Severity Summary

- critical: 0
- high: 1
- medium: 1
- low: 0
- unknown: 0

## Findings

- [high][follow-up] \`src/feature.ts:1\` - Negative-input behavior is undocumented and untested.
- [medium][observation] \`tests/feature.test.ts:1\` - The saved evidence does not prove edge-case coverage.

## Follow-Ups

- Add a negative-input regression test before shipping.

## Next Safe Action

- /blu-code-review-fix 5
`,
    scopeFiles: ["src/feature.ts", "tests/feature.test.ts"]
  });

  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.match(state.derivedStatus.nextAction, /\/blu-code-review-fix 5/);
});

test("code-review docs and catalog metadata promote the review scope slice to implemented", async () => {
  const [catalogMarkdown, skillsMarkdown, commandDoc] = await Promise.all([
    readFile(path.join(repoRoot, "docs/COMMAND-CATALOG.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/SKILLS-AND-AGENTS.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/commands/code-review.md"), "utf8")
  ]);

  assert.match(
    catalogMarkdown,
    /\| `code-review` \| 4 \| `Quality And Shipping` \| `blueprint-review` \| `implemented` \| `phase XX-REVIEW\.md` \| `Low: review artifact generation only\.` \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-reviewer` \| `implemented` \| Produce bounded code review findings from a resolved Blueprint scope \|/
  );
  assert.match(commandDoc, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(commandDoc, /## Shared Runtime Contract/);
  assert.match(commandDoc, /## In-Flight Progress Contract/);
  assert.match(
    commandDoc,
    /skills\/blueprint-review\/references\/code-review-runtime-contract\.md/
  );
  assert.match(commandDoc, /`blueprint_artifact_contract_read` ->/);
  assert.match(commandDoc, /## Depth And Output Quality Contract/);
  assert.match(commandDoc, /## Subagent And Fallback Contract/);
  assert.match(commandDoc, /shared review posture from the runtime contract/i);
  assert.match(commandDoc, /`update_topic` tool and keep a compact review checklist with `write_todos`/);
});

test("blueprint_review_scope merges summary and plan evidence when no explicit scope is provided", async (t) => {
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
  assert.deepEqual(scoped.files, ["src/plan.ts", "src/summary.ts", "tests/plan.test.ts"]);
  assert.equal(scoped.reviewMode.depth, "standard");
  assert.equal(scoped.reviewMode.source, "phase-evidence");
  assert.equal(scoped.confirmationRecommended.recommended, false);
  assert.deepEqual(scoped.artifacts.plans, [".blueprint/phases/05-review-scope/05-01-PLAN.md"]);
  assert.deepEqual(scoped.artifacts.summaries, [
    ".blueprint/phases/05-review-scope/05-01-SUMMARY.md"
  ]);
  assert.equal(
    scoped.artifacts.verification,
    ".blueprint/phases/05-review-scope/05-VERIFICATION.md"
  );
});

test("blueprint_review_scope reports phase-summaries when summary evidence alone defines the scope", async (t) => {
  const repoPath = await createCodeReviewRepo({
    withPlan: false,
    summaryChangedFiles: ["src/summary.ts"]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const scoped = await blueprintReviewScope({
    cwd: repoPath,
    phase: "5"
  });

  assert.equal(scoped.status, "ready");
  assert.deepEqual(scoped.files, ["src/summary.ts"]);
  assert.equal(scoped.reviewMode.source, "phase-summaries");
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

test("blueprint_review_scope rejects explicit scope when any requested file path is invalid", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const scoped = await blueprintReviewScope({
    cwd: repoPath,
    phase: "5",
    files: ["src/feature.ts", ".blueprint/phases/05-review-scope/05-REVIEW.md"]
  });

  assert.equal(scoped.status, "invalid");
  assert.deepEqual(scoped.files, []);
  assert.equal(scoped.reviewMode.source, "explicit-files");
  assert.match(scoped.reason ?? "", /invalid `--files` entries/i);
  assert.match(scoped.warnings.join("\n"), /\.blueprint artifacts are not reviewable repo files/i);
});

test("blueprint_review_scope ignores file-looking paths under summary Evidence sections", async (t) => {
  const repoPath = await createCodeReviewRepo({
    planFilesModified: ["src/plan.ts"]
  });
  const phaseDir = path.join(repoPath, ".blueprint/phases/05-review-scope");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, "tests/evidence.test.ts"),
    "export const evidence_test = true;\n",
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-01-SUMMARY.md"),
    `# Phase 05: Code Review Scope - Summary 01

## Result

- Completed the review-ready feature slice.

## Changes Made

- Updated scope bookkeeping only.

## Evidence

- \`tests/evidence.test.ts\`
`,
    "utf8"
  );

  const scoped = await blueprintReviewScope({
    cwd: repoPath,
    phase: "5"
  });

  assert.equal(scoped.status, "ready");
  assert.deepEqual(scoped.files, ["src/plan.ts"]);
  assert.doesNotMatch(scoped.files.join("\n"), /tests\/evidence\.test\.ts/);
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

test("blueprint_review_scope surfaces deterministic confirmation metadata for broad, multi-plan, and deep scopes", async (t) => {
  const repoPath = await createCodeReviewRepo({
    summaryChangedFiles: ["src/one.ts", "src/two.ts", "src/three.ts"],
    planFilesModified: ["src/four.ts", "src/five.ts"]
  });
  const phaseDir = path.join(repoPath, ".blueprint/phases/05-review-scope");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, "src/six.ts"),
    "export const six = true;\n",
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-02-PLAN.md"),
    `---
phase: 5
plan_id: "02"
title: "Additional Review Scope"
wave: 4
status: done
objective: "Expand the changed repo files."
depends_on: []
requirements:
  - REV-01
files_modified:
  - src/six.ts
read_first:
  - src/six.ts
acceptance_criteria:
  - rg "six" src/six.ts
autonomous: true
---

# Phase 05: Code Review Scope - Plan 02

## Goal

Expand the changed repo files.

## Scope

- Additional source file.

## Tasks

### Task 1

#### Read First

- src/six.ts

#### Action

- Review the additional file.

#### Acceptance Criteria

- rg "six" src/six.ts

## Verification

- Confirm the extra file is represented in saved scope evidence.

## Must Haves

- Keep review scope deterministic.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-02-SUMMARY.md"),
    `# Phase 05: Code Review Scope - Summary 02

## Result

- Added a second executed plan for scope confirmation coverage.

## Changes Made

- \`src/six.ts\`

## Evidence

- Saved scope evidence remains deterministic.
`,
    "utf8"
  );

  const scoped = await blueprintReviewScope({
    cwd: repoPath,
    phase: "5",
    depth: "deep"
  });

  assert.equal(scoped.status, "ready");
  assert.equal(scoped.confirmationRecommended.recommended, true);
  assert.equal(scoped.confirmationRecommended.pendingGate, "scope-confirmation");
  assert.deepEqual(scoped.confirmationRecommended.thresholds, {
    broadFileCount: 5,
    multiPlanCount: 2,
    deepFileCount: 3
  });
  assert.equal(scoped.confirmationRecommended.signals.fileCount, 6);
  assert.equal(scoped.confirmationRecommended.signals.summaryCount, 2);
  assert.equal(scoped.confirmationRecommended.signals.matchedPlanCount, 2);
  assert.match(scoped.confirmationRecommended.reasons.join("\n"), /broad-scope confirmation threshold/i);
  assert.match(scoped.confirmationRecommended.reasons.join("\n"), /multi-plan confirmation threshold/i);
  assert.match(scoped.confirmationRecommended.reasons.join("\n"), /deep-review confirmation threshold/i);
});

test("blueprint_review_record persists code-review artifacts, strips disposition markers, and tracks overwrite status", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const initialContent = `# Phase 05: Code Review Scope - Code Review

**Verdict:** FOLLOW_UP

## Review Summary

- Phase 5 standard review over one source file and one test file with two follow-up findings.

## Scope Reviewed

- src/feature.ts
- tests/feature.test.ts

## Evidence Reviewed

- .blueprint/phases/05-review-scope/05-01-PLAN.md
- .blueprint/phases/05-review-scope/05-01-SUMMARY.md
- .blueprint/phases/05-review-scope/05-VERIFICATION.md

## Positive Signals

- Summary and plan evidence agree on the bounded review scope.

## Severity Summary

- critical: 0
- high: 1
- medium: 1
- low: 0
- unknown: 0

## Findings

- [high][follow-up] \`src/feature.ts:1\` - Negative-input behavior is undocumented and untested.
- [medium][observation] \`tests/feature.test.ts:1\` - The saved evidence does not prove edge-case coverage.

## Follow-Ups

- Add a negative-input regression test before shipping.

## Next Safe Action

- /blu-code-review-fix 5
`;
  const updatedContent = initialContent.replace(
    "Add a negative-input regression test before shipping.",
    "Add a negative-input regression test and rerun focused verification before shipping."
  );

  const created = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    content: initialContent,
    scopeFiles: ["src/feature.ts", "tests/feature.test.ts"]
  });

  assert.equal(created.status, "created");
  assert.equal(created.reportPath, ".blueprint/phases/05-review-scope/05-REVIEW.md");
  assert.deepEqual(created.counts, {
    sections: 9,
    findings: 2,
    followUps: 1
  });

  const loaded = await blueprintReviewLoadFindings({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review"
  });

  assert.equal(loaded.found, true);
  assert.deepEqual(
    loaded.findings.map((finding) => [finding.severity, finding.summary]),
    [
      ["high", "`src/feature.ts:1` - Negative-input behavior is undocumented and untested."],
      ["medium", "`tests/feature.test.ts:1` - The saved evidence does not prove edge-case coverage."]
    ]
  );
  assert.deepEqual(loaded.followUps, ["Add a negative-input regression test before shipping."]);

  const reused = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    content: initialContent
  });

  assert.equal(reused.status, "reused");
  assert.match(reused.warnings.join("\n"), /Preserved existing review artifact/i);

  await assert.rejects(
    () =>
      blueprintReviewRecord({
        cwd: repoPath,
        phase: "5",
        artifact: "code-review",
        content: updatedContent
      }),
    /already exists\. Re-run only after explicit overwrite confirmation/i
  );

  const updated = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    content: updatedContent,
    overwrite: true
  });

  assert.equal(updated.status, "updated");
  assert.equal(updated.overwritten, true);
  assert.match(updated.warnings.join("\n"), /Replaced existing review artifact/i);
});

test("blueprint_review_record persists structured code-review models as canonical markdown", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const created = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    model: createStructuredCodeReviewModel(),
    scopeFiles: ["src/feature.ts", "tests/feature.test.ts"]
  });

  assert.equal(created.status, "created");
  assert.equal(created.reportPath, ".blueprint/phases/05-review-scope/05-REVIEW.md");
  assert.deepEqual(created.counts, {
    sections: 9,
    findings: 1,
    followUps: 1
  });

  const saved = await readFile(path.join(repoPath, created.reportPath), "utf8");
  assert.match(saved, /\*\*Verdict:\*\* FOLLOW_UP/);
  assert.match(saved, /- Depth: standard/);
  assert.match(saved, /- Scope source: phase-evidence/);
  assert.match(saved, /- high: 1/);
  assert.match(saved, /\.blueprint\/phases\/05-review-scope\/05-VERIFICATION\.md/);
  assert.match(
    saved,
    /\[high\]\[follow-up\] `src\/feature\.ts:1` - Evidence: The feature implementation has no negative-input guard\./
  );

  const loaded = await blueprintReviewLoadFindings({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review"
  });

  assert.equal(loaded.findings.length, 1);
  assert.deepEqual(loaded.severityCounts, {
    critical: 0,
    high: 1,
    medium: 0,
    low: 0,
    unknown: 0
  });
});

test("blueprint_review_record accepts structured code-review findings for root-level files", async (t) => {
  const repoPath = await createCodeReviewRepo({
    planFilesModified: ["package.json"],
    summaryChangedFiles: ["package.json"]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const created = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    model: createStructuredCodeReviewModel({
      reviewSummary: [
        "Phase 5 standard review covered one root-level package metadata file with one high follow-up."
      ],
      scopeReviewed: ["package.json"],
      positiveSignals: [
        "Saved phase evidence narrowed the review to the root-level package metadata file."
      ],
      findings: [
        {
          severity: "high",
          disposition: "follow-up",
          location: "package.json:1",
          evidence: "The package metadata fixture records a reviewable root-level change.",
          impact: "Review evidence for root-level files must remain persistable.",
          recommendation: "Keep root-level file:line citations valid in structured reviews."
        }
      ],
      followUps: ["Keep root-level file citations covered by code-review regression tests."]
    }),
    scopeFiles: ["package.json"]
  });

  assert.equal(created.status, "created");
  const saved = await readFile(path.join(repoPath, created.reportPath), "utf8");
  assert.match(saved, /- package\.json/);
  assert.match(saved, /`package\.json:1`/);
});

test("blueprint_review_record rejects invalid structured code-review models before persistence", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const missingEvidence = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    model: createStructuredCodeReviewModel({
      evidenceReviewed: [
        ".blueprint/phases/05-review-scope/05-01-PLAN.md",
        ".blueprint/phases/05-review-scope/05-01-SUMMARY.md"
      ]
    }),
    scopeFiles: ["src/feature.ts", "tests/feature.test.ts"]
  });

  assert.equal(missingEvidence.status, "invalid");
  assert.equal(missingEvidence.written, false);
  assert.match(missingEvidence.warnings.join("\n"), /05-VERIFICATION\.md/);

  const genericFindingFields = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    model: createStructuredCodeReviewModel({
      positiveSignals: ["none"],
      findings: [
        {
          severity: "high",
          disposition: "follow-up",
          location: "src/feature.ts:1",
          evidence: "n/a",
          impact: "none",
          recommendation: "not applicable"
        }
      ]
    }),
    scopeFiles: ["src/feature.ts", "tests/feature.test.ts"]
  });

  assert.equal(genericFindingFields.status, "invalid");
  const genericWarnings = genericFindingFields.warnings.join("\n");
  assert.match(genericWarnings, /positiveSignals cannot use generic none values/i);
  assert.match(genericWarnings, /findings\.0\.evidence must be concrete/i);
  assert.match(genericWarnings, /findings\.0\.impact must be concrete/i);
  assert.match(genericWarnings, /findings\.0\.recommendation must be concrete/i);

  const bothInputs = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    content: "# ignored\n",
    model: createStructuredCodeReviewModel(),
    scopeFiles: ["src/feature.ts", "tests/feature.test.ts"]
  });

  assert.equal(bothInputs.status, "invalid");
  assert.match(bothInputs.warnings.join("\n"), /exactly one of content or model/i);
});

test("blueprint_review_record rejects code-review scaffold prose even after the verdict marker changes", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalid = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    content: `# Phase 05: Code Review Scope - Code Review

**Verdict:** PASS

## Review Summary

- Phase, effective depth, scope source, file count, verdict rationale, and severity counts.

## Scope Reviewed

- Repo-relative file path reviewed, one per bullet or table row.

## Evidence Reviewed

- Saved summaries, plans, validation, UAT, security, existing review, or repo-file evidence that influenced the result.

## Positive Signals

- Concrete pass evidence, safeguards, tests, or coverage strengths; use \`none\` only when no positive signal was checked.

## Severity Summary

- critical: 0
- high: 0
- medium: 0
- low: 0
- unknown: 0

## Findings

- [high][follow-up] \`path/to/file.ts:42\` - Evidence, impact, and concrete fix or verification guidance.

## Follow-Ups

- Actionable fix, test gap, validation step, or \`none\`.

## Next Safe Action

- /blu-progress
`
  });

  assert.equal(invalid.status, "invalid");
  assert.equal(invalid.written, false);
  assert.match(
    invalid.warnings.join("\n"),
    /Repo-relative file path reviewed|path\/to\/file\.ts:42|Phase, effective depth, scope source, file count/i
  );
});

test("blueprint_review_record rejects code-review findings without line evidence or matching severity counts", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalid = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    content: `# Phase 05: Code Review Scope - Code Review

**Verdict:** FOLLOW_UP

## Review Summary

- Phase 5 standard review over one source file with one follow-up finding.

## Scope Reviewed

- src/feature.ts

## Evidence Reviewed

- .blueprint/phases/05-review-scope/05-01-PLAN.md
- .blueprint/phases/05-review-scope/05-01-SUMMARY.md
- .blueprint/phases/05-review-scope/05-VERIFICATION.md

## Positive Signals

- Existing saved evidence narrowed the review to one source file.

## Severity Summary

- critical: 0
- high: 0
- medium: 0
- low: 0
- unknown: 0

## Findings

- [high][follow-up] Negative-input behavior is undocumented and untested.

## Follow-Ups

- Add a negative-input regression test before shipping.

## Next Safe Action

- /blu-code-review-fix 5
`
  });

  assert.equal(invalid.status, "invalid");
  assert.match(
    invalid.warnings.join("\n"),
    /must include repo-relative file:line evidence/i
  );
  assert.match(
    invalid.warnings.join("\n"),
    /Severity Summary reports high: 0, but Findings contains 1 high item/i
  );
});

test("blueprint_review_record rejects code-review artifacts that omit resolved scoped files", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalid = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    scopeFiles: ["src/feature.ts", "tests/feature.test.ts"],
    content: `# Phase 05: Code Review Scope - Code Review

**Verdict:** FOLLOW_UP

## Review Summary

- Phase 5 standard review over one source file with one follow-up finding.

## Scope Reviewed

- src/feature.ts

## Evidence Reviewed

- .blueprint/phases/05-review-scope/05-01-PLAN.md
- .blueprint/phases/05-review-scope/05-01-SUMMARY.md
- .blueprint/phases/05-review-scope/05-VERIFICATION.md

## Positive Signals

- Saved evidence narrowed the review to the expected source file group.

## Severity Summary

- critical: 0
- high: 1
- medium: 0
- low: 0
- unknown: 0

## Findings

- [high][follow-up] \`src/feature.ts:1\` - Negative-input behavior is undocumented and untested.

## Follow-Ups

- Add a negative-input regression test before shipping.

## Next Safe Action

- /blu-code-review-fix 5
`
  });

  assert.equal(invalid.status, "invalid");
  assert.match(
    invalid.warnings.join("\n"),
    /must list every resolved scoped file\. Missing: tests\/feature\.test\.ts/i
  );
});

test("blueprint_review_record rejects code-review artifacts with non-implemented next actions", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalid = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    scopeFiles: ["src/feature.ts", "tests/feature.test.ts"],
    content: `# Phase 05: Code Review Scope - Code Review

**Verdict:** PASS

## Review Summary

- Phase 5 standard review over the resolved source and test scope found no follow-up findings.

## Scope Reviewed

- src/feature.ts
- tests/feature.test.ts

## Evidence Reviewed

- .blueprint/phases/05-review-scope/05-01-PLAN.md
- .blueprint/phases/05-review-scope/05-01-SUMMARY.md
- .blueprint/phases/05-review-scope/05-VERIFICATION.md

## Positive Signals

- Saved evidence and scoped file reads did not expose a follow-up finding.

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
- /blu-do 5
`
  });

  assert.equal(invalid.status, "invalid");
  assert.match(
    invalid.warnings.join("\n"),
    /Next Safe Action points to non-implemented command\(s\): \/blu-do/i
  );
});

test("blueprint_review_scope does not use live git drift when saved summary and plan evidence are missing", async (t) => {
  const repoPath = await createCodeReviewRepo({
    withPlan: false,
    withSummary: false
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

  const warnings = scoped.warnings.join("\n");
  assert.equal(scoped.status, "invalid");
  assert.deepEqual(scoped.files, []);
  assert.equal(scoped.reviewMode.source, "phase-plans");
  assert.match(scoped.reason ?? "", /saved SUMMARY and PLAN artifacts were missing/i);
  assert.match(warnings, /No saved SUMMARY artifacts were found/i);
  assert.match(warnings, /No saved PLAN artifacts were found/i);
  assert.doesNotMatch(warnings, /git diff fallback/i);
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
  assert.match(scoped.reason ?? "", /saved SUMMARY and PLAN artifacts were missing/i);
  assert.match(scoped.warnings.join("\n"), /No saved SUMMARY artifacts were found/i);
  assert.match(scoped.warnings.join("\n"), /No saved PLAN artifacts were found/i);
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
    "blueprint_artifact_contract_read",
    "blueprint_review_scope",
    "blueprint_review_load_findings",
    "blueprint_review_record",
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-reviewer"]);
});
