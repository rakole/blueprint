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

async function startAndAppendReport(repoPath: string): Promise<{
  reportPath: string;
}> {
  const start = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --files src/feature.ts",
    scopeKind: "explicit-files",
    files: ["src/feature.ts"],
    runId: "god-load"
  });
  assert.equal(start.status, "started");
  const append = await blueprintGodReviewAppend({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --run-id god-load --continue",
    runId: "god-load",
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

  return { reportPath: start.reportPath! };
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

test("blueprint_god_review_load_findings rejects duplicate god-review finding IDs", async () => {
  const repoPath = await writeRepo();
  const reportPath = ".blueprint/reports/god-review-duplicate.md";

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
    rawInvocation: "/blu-code-review --feels-like-god --session duplicate",
    reportPath
  });

  assert.equal(result.status, "invalid");
  assert.match(result.reason ?? "", /Duplicate god-review finding IDs/);
});

test("blueprint_god_review_load_findings preserves observation, accepted-risk, and blocked dispositions", async () => {
  const repoPath = await writeRepo();
  const reportPath = ".blueprint/reports/god-review-dispositions.md";

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
    rawInvocation: "/blu-code-review --feels-like-god --session dispositions",
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

- [x] Phase 5: Load

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
