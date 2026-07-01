import test from "node:test";
import assert from "node:assert/strict";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  blueprintGodReviewAppend,
  blueprintGodReviewLoadFindings,
  blueprintGodReviewStart
} from "../src/mcp/tools/god-review.js";
import { blueprintReviewLoadFindings } from "../src/mcp/tools/review.js";
import {
  createCommittedGitRepo,
  runGit
} from "./helpers/git-fixtures.js";

const PHASE_DIR = ".blueprint/phases/05-god-review-load";

async function writeRepo(): Promise<string> {
  const repoPath = await createCommittedGitRepo("blueprint-god-review-load-");

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await mkdir(path.join(repoPath, ".blueprint/reports"), { recursive: true });
  await writeFile(
    path.join(repoPath, "src/feature.ts"),
    "export const featureValue = 1;\n",
    "utf8"
  );
  await runGit(["add", "."], repoPath);
  await runGit(["commit", "-m", "feature"], repoPath);

  return repoPath;
}

async function writePhaseRepo(): Promise<string> {
  const repoPath = await createCommittedGitRepo("blueprint-god-review-load-phase-");
  const phaseDir = path.join(repoPath, PHASE_DIR);

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/REQUIREMENTS.md"),
    "# Requirements\n\n- GOD-01: Review changed files.\n",
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: God Review Load Fixture

## Milestone

- Active milestone: v1

## Phases

- [x] **Phase 5: God Review Load** - Completed implementation ready for review

## Phase Details

### Phase 5: God Review Load
**Goal**: Load phase findings in god mode.
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
    "export const featureValue = 1;\n",
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-01-PLAN.md"),
    `---
phase: 5
plan_id: "01"
title: "God Review Load Scope"
wave: 1
status: done
objective: "Review the changed repo files."
depends_on: []
requirements:
  - GOD-01
files_modified:
  - src/feature.ts
read_first:
  - src/feature.ts
acceptance_criteria:
  - npm test
autonomous: true
---

# Phase 05: God Review Load Scope - Plan 01
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-01-SUMMARY.md"),
    "# Phase 05 Summary\n\n## Status\n\nCOMPLETED\n\n## Changes Made\n\n- Updated `src/feature.ts`.\n",
    "utf8"
  );
  await runGit(["add", "."], repoPath);
  await runGit(["commit", "-m", "phase fixture"], repoPath);

  return repoPath;
}

async function startAndAppendReport(
  repoPath: string,
  runId = "god-load"
): Promise<{
  reportPath: string;
  sessionPath: string;
}> {
  const start = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: `/blu-code-review --feels-like-god --files src/feature.ts --run-id ${runId}`,
    scopeKind: "explicit-files",
    files: ["src/feature.ts"],
    runId
  });
  assert.equal(start.status, "started");
  const append = await blueprintGodReviewAppend({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: `/blu-code-review --feels-like-god --run-id ${runId} --continue`,
    runId,
    groupId: "correctness-contracts",
    status: "completed",
    findings: [
      {
        title: "Actionable defect",
        severity: "high",
        disposition: "follow-up",
        confidence: "high",
        files: ["src/feature.ts:1"],
        evidence: "The fixture exposes a simple defect.",
        impact: "Runtime behavior can drift.",
        recommendation: "Fix the defect.",
        fixEligibility: "eligible"
      },
      {
        title: "Accepted risk note",
        severity: "low",
        disposition: "accepted risk",
        confidence: "low",
        files: ["src/feature.ts"],
        evidence: "The risk is explicit.",
        impact: "No immediate remediation.",
        recommendation: "Track only."
      }
    ]
  });
  assert.equal(append.status, "appended");

  await appendFile(
    path.join(repoPath, start.reportPath!),
    `
## Remediation Log

### GOD-FIX-001: GOD-COR-001
- Status: skipped
- Finding: GOD-COR-001
- Selected By: explicit-id
- Files Changed: none
- Verification: not run
- Evidence: First attempt deferred.
- Follow-Up: retry

### GOD-FIX-002: GOD-COR-001
- Status: stale
- Finding: GOD-COR-001
- Selected By: default
- Files Changed: \`src/feature.ts\`
- Verification: \`npm test\` - blocked
- Evidence: Saved evidence no longer matched.
- Follow-Up: start a fresh review
`,
    "utf8"
  );

  return {
    reportPath: start.reportPath!,
    sessionPath: start.sessionPath!
  };
}

test("blueprint_god_review_load_findings parses god-review findings and multiple remediation attempts from the report only", async () => {
  const repoPath = await writeRepo();
  await startAndAppendReport(repoPath);
  const result = await blueprintGodReviewLoadFindings({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation: "/blu-code-review-fix --feels-like-god --run-id god-load",
    runId: "god-load"
  });

  assert.equal(result.status, "found");
  assert.equal(result.findings.length, 2);
  assert.equal(result.remediations.length, 2);
  assert.deepEqual(
    result.findings.map((finding) => [
      finding.id,
      finding.severity,
      finding.disposition,
      finding.fixEligibility
    ]),
    [
      ["GOD-COR-001", "high", "follow-up", "eligible"],
      ["GOD-COR-002", "low", "accepted-risk", "not-eligible"]
    ]
  );
  assert.equal(result.findings[0].remediationAttempts?.length, 2);
  assert.equal(result.findings[0].remediated, false);
  assert.equal(result.findings[0].stale, true);
});

test("blueprint_god_review_load_findings ignores normal review artifacts", async () => {
  const repoPath = await writeRepo();
  const { reportPath } = await startAndAppendReport(repoPath);
  await mkdir(path.join(repoPath, ".blueprint/phases/05-load"), { recursive: true });
  await writeFile(
    path.join(repoPath, ".blueprint/phases/05-load/05-REVIEW.md"),
    `# Normal Review

#### GOD-COR-999: This belongs to normal review and must be ignored
- Severity: high
- Disposition: follow-up
`,
    "utf8"
  );

  const result = await blueprintGodReviewLoadFindings({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --run-id god-load",
    reportPath
  });

  assert.equal(result.status, "found");
  assert.deepEqual(result.findings.map((finding) => finding.id), [
    "GOD-COR-001",
    "GOD-COR-002"
  ]);
});

test("blueprint_god_review_load_findings rejects explicit non-god-review report paths", async () => {
  const repoPath = await writeRepo();
  await mkdir(path.join(repoPath, ".blueprint/phases/05-load"), { recursive: true });
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    "# Blueprint State\n",
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/05-load/05-REVIEW.md"),
    `# Normal Review

#### GOD-COR-999: Normal review finding
- Severity: high
- Disposition: follow-up
`,
    "utf8"
  );

  for (const reportPath of [
    ".blueprint/STATE.md",
    ".blueprint/phases/05-load/05-REVIEW.md"
  ]) {
    const result = await blueprintGodReviewLoadFindings({
      cwd: repoPath,
      activeCommand: "/blu-code-review",
      rawInvocation: "/blu-code-review --feels-like-god",
      reportPath
    });

    assert.equal(result.status, "invalid", reportPath);
    assert.match(result.reason ?? "", /generated hidden god-review report path/);
  }
});

test("blueprint_god_review_load_findings requires explicit report path to match session or run id", async () => {
  const repoPath = await writeRepo();
  const { sessionPath } = await startAndAppendReport(repoPath);
  const otherReportPath = ".blueprint/reports/god-review-other.md";
  await writeFile(
    path.join(repoPath, otherReportPath),
    "# God Review: other\n",
    "utf8"
  );

  const sessionMismatch = await blueprintGodReviewLoadFindings({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --run-id god-load",
    sessionPath,
    reportPath: otherReportPath
  });
  assert.equal(sessionMismatch.status, "invalid");
  assert.match(sessionMismatch.reason ?? "", /must match the report recorded by the saved session/);

  const rawSessionMismatch = await blueprintGodReviewLoadFindings({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: `/blu-code-review --feels-like-god --session ${sessionPath}`,
    reportPath: otherReportPath
  });
  assert.equal(rawSessionMismatch.status, "invalid");
  assert.match(rawSessionMismatch.reason ?? "", /must match the report recorded by the saved session/);

  const runMismatch = await blueprintGodReviewLoadFindings({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --run-id god-load",
    runId: "god-load",
    reportPath: otherReportPath
  });
  assert.equal(runMismatch.status, "invalid");
  assert.match(runMismatch.reason ?? "", /must match the generated report path/);

  const rawRunMismatch = await blueprintGodReviewLoadFindings({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --run-id god-load",
    reportPath: otherReportPath
  });
  assert.equal(rawRunMismatch.status, "invalid");
  assert.match(rawRunMismatch.reason ?? "", /must match the generated report path/);
});

test("blueprint_god_review_load_findings rejects generated report paths without a saved session identity", async () => {
  const repoPath = await writeRepo();
  const { reportPath } = await startAndAppendReport(repoPath, "god-raw-report-only");

  const result = await blueprintGodReviewLoadFindings({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god",
    reportPath
  });

  assert.equal(result.status, "invalid");
  assert.equal(result.sessionPath, null);
  assert.match(result.reason ?? "", /saved session identity/i);
});

test("blueprint_god_review_load_findings loads reportPath plus runId through the saved session", async () => {
  const repoPath = await writeRepo();
  const runId = "god-report-run";
  const { reportPath, sessionPath } = await startAndAppendReport(repoPath, runId);

  const result = await blueprintGodReviewLoadFindings({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: `/blu-code-review --feels-like-god --run-id ${runId}`,
    reportPath
  });

  assert.equal(result.status, "found");
  assert.equal(result.sessionPath, sessionPath);
  assert.deepEqual(result.findings.map((finding) => finding.id), [
    "GOD-COR-001",
    "GOD-COR-002"
  ]);
});

test("blueprint_god_review_load_findings rejects reportPath plus runId when the saved session is missing", async () => {
  const repoPath = await writeRepo();
  const runId = "god-missing-session";
  const reportPath = `.blueprint/reports/god-review-${runId}.md`;
  await writeFile(
    path.join(repoPath, reportPath),
    "# God Review: god-missing-session\n",
    "utf8"
  );

  const result = await blueprintGodReviewLoadFindings({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: `/blu-code-review --feels-like-god --run-id ${runId}`,
    reportPath
  });

  assert.equal(result.status, "invalid");
  assert.equal(result.sessionPath, `.blueprint/reports/.god-review-${runId}.json`);
  assert.match(result.reason ?? "", /does not exist/);
});

test("blueprint_god_review_load_findings rejects stale saved sessions in review mode", async () => {
  const repoPath = await writeRepo();
  const runId = "god-stale-review";
  const { reportPath, sessionPath } = await startAndAppendReport(repoPath, runId);
  await writeFile(
    path.join(repoPath, "src/feature.ts"),
    "export const featureValue = 2;\n",
    "utf8"
  );

  const result = await blueprintGodReviewLoadFindings({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: `/blu-code-review --feels-like-god --run-id ${runId}`,
    reportPath
  });

  assert.equal(result.status, "invalid");
  assert.equal(result.sessionPath, sessionPath);
  assert.match(result.reason ?? "", /scope fingerprint changed/i);
  assert.match(result.warnings.join("\n"), /fileSetHash changed/);
});

test("blueprint_god_review_load_findings rejects stale phase topology before parsing findings", async () => {
  const repoPath = await writePhaseRepo();
  const start = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review 5 --feels-like-god",
    scopeKind: "phase",
    phase: 5
  });
  assert.equal(start.status, "started");
  const append = await blueprintGodReviewAppend({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review 5 --feels-like-god --continue",
    phase: 5,
    groupId: "correctness-contracts",
    status: "completed",
    findings: [
      {
        title: "Phase topology finding",
        severity: "high",
        disposition: "follow-up",
        fixEligibility: "eligible"
      }
    ]
  });
  assert.equal(append.status, "appended");

  const roadmapPath = path.join(repoPath, ".blueprint/ROADMAP.md");
  const roadmap = await readFile(roadmapPath, "utf8");
  await writeFile(
    roadmapPath,
    roadmap.replace(
      "**Goal**: Load phase findings in god mode.",
      "**Goal**: Replacement phase identity for load findings."
    ),
    "utf8"
  );

  const result = await blueprintGodReviewLoadFindings({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation: "/blu-code-review-fix 5 --feels-like-god",
    phase: 5
  });

  assert.equal(result.status, "invalid");
  assert.equal(result.sessionPath, start.sessionPath);
  assert.match(result.warnings.join("\n"), /stale phase topology/i);
});

test("blueprint_god_review_load_findings rejects duplicate god-review finding IDs", async () => {
  const repoPath = await writeRepo();
  const runId = "god-duplicate";
  const { reportPath } = await startAndAppendReport(repoPath, runId);

  await writeFile(
    path.join(repoPath, reportPath),
    `# God Review: duplicate

#### GOD-COR-001: First
- Severity: high
- Disposition: follow-up

#### GOD-COR-001: Duplicate
- Severity: medium
- Disposition: follow-up
`,
    "utf8"
  );

  const result = await blueprintGodReviewLoadFindings({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: `/blu-code-review --feels-like-god --run-id ${runId}`,
    reportPath
  });

  assert.equal(result.status, "invalid");
  assert.match(result.reason ?? "", /Duplicate god-review finding IDs/);
});

test("blueprint_god_review_load_findings preserves observation, accepted-risk, and blocked dispositions", async () => {
  const repoPath = await writeRepo();
  const runId = "god-dispositions";
  const { reportPath } = await startAndAppendReport(repoPath, runId);

  await writeFile(
    path.join(repoPath, reportPath),
    `# God Review: dispositions

#### GOD-COR-001: Observation
- Severity: low
- Disposition: observation
- Confidence: medium
- Fix Eligibility: not-eligible

#### GOD-COR-002: Accepted Risk
- Severity: medium
- Disposition: accepted-risk
- Confidence: low
- Fix Eligibility: not-eligible

#### GOD-COR-003: Blocked
- Severity: unknown
- Disposition: blocked
- Confidence: low
- Fix Eligibility: needs-confirmation
`,
    "utf8"
  );

  const result = await blueprintGodReviewLoadFindings({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: `/blu-code-review --feels-like-god --run-id ${runId}`,
    reportPath
  });

  assert.equal(result.status, "found");
  assert.deepEqual(
    result.findings.map((finding) => finding.disposition),
    ["observation", "accepted-risk", "blocked"]
  );
  assert.deepEqual(
    result.findings.map((finding) => finding.fixEligibility),
    ["not-eligible", "not-eligible", "needs-confirmation"]
  );
});

test("normal review finding loading does not bridge to god-review reports", async () => {
  const repoPath = await writeRepo();
  await mkdir(path.join(repoPath, ".blueprint/phases/05-load"), { recursive: true });
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap

## Milestone

- Active milestone: v1

## Phases

- [x] **Phase 5: Load** - Complete

## Phase Details

### Phase 5: Load
**Goal**: Load findings.
**Requirements**: GOD-01
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
- Next action: Run /blu-progress
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
    path.join(repoPath, ".blueprint/phases/05-load/05-GOD-REVIEW.md"),
    `# God Review

#### GOD-COR-001: Hidden finding
- Severity: high
- Disposition: follow-up
`,
    "utf8"
  );

  const normal = await blueprintReviewLoadFindings({
    cwd: repoPath,
    phase: 5,
    artifact: "code-review"
  });

  assert.equal(normal.found, false);
  assert.deepEqual(normal.findings, []);
});
