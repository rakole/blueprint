import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  blueprintGodReviewAppend,
  blueprintGodReviewLoadFindings,
  blueprintGodReviewRecordFix,
  blueprintGodReviewStart,
  godReviewSessionSchema
} from "../src/mcp/tools/god-review.js";
import {
  createCommittedGitRepo,
  runGit
} from "./helpers/git-fixtures.js";

async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function writeRecordRepo(): Promise<string> {
  const repoPath = await createCommittedGitRepo("blueprint-god-review-record-");

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await writeFile(
    path.join(repoPath, "src/feature.ts"),
    [
      "export const featureValue = 1;",
      "export const deferredValue = 2;",
      ""
    ].join("\n"),
    "utf8"
  );
  await runGit(["add", "."], repoPath);
  await runGit(["commit", "-m", "feature"], repoPath);

  return repoPath;
}

async function startRecordReport(repoPath: string): Promise<{
  reportPath: string;
  sessionPath: string;
  humanStatePath: string;
}> {
  const start = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --files src/feature.ts",
    scopeKind: "explicit-files",
    files: ["src/feature.ts"],
    runId: "god-record"
  });
  assert.equal(start.status, "started");

  const append = await blueprintGodReviewAppend({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --run-id god-record --continue",
    runId: "god-record",
    groupId: "correctness-contracts",
    status: "completed",
    findings: [
      {
        title: "Fixable defect",
        severity: "high",
        disposition: "follow-up",
        confidence: "high",
        files: ["src/feature.ts:1"],
        evidence: "Current code contains `featureValue`.",
        impact: "High impact.",
        recommendation: "Fix the defect.",
        fixEligibility: "eligible"
      },
      {
        title: "Deferred defect",
        severity: "medium",
        disposition: "follow-up",
        confidence: "medium",
        files: ["src/feature.ts:2"],
        evidence: "Current code contains `deferredValue`.",
        impact: "Medium impact.",
        recommendation: "Defer this defect.",
        fixEligibility: "eligible"
      }
    ]
  });
  assert.equal(append.status, "appended");

  return {
    reportPath: start.reportPath!,
    sessionPath: start.sessionPath!,
    humanStatePath: start.humanStatePath!
  };
}

test("blueprint_god_review_record_fix appends one remediation entry per attempt without renumbering", async () => {
  const repoPath = await writeRecordRepo();
  const { reportPath, sessionPath } = await startRecordReport(repoPath);

  const fixed = await blueprintGodReviewRecordFix({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation:
      "/blu-code-review-fix --feels-like-god --run-id god-record --finding GOD-COR-001",
    runId: "god-record",
    findingId: "GOD-COR-001",
    status: "fixed",
    selectedBy: "explicit-id",
    filesChanged: ["src/feature.ts"],
    verification: "`npm exec -- tsx --test tests/feature.test.ts` - passed",
    evidence: "Focused verification passed.",
    followUp: "none"
  });
  assert.equal(fixed.status, "recorded");
  assert.equal(fixed.remediationId, "GOD-FIX-001");
  assert.equal(fixed.written, true);

  const skipped = await blueprintGodReviewRecordFix({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation:
      "/blu-code-review-fix --feels-like-god --run-id god-record --finding GOD-COR-001",
    runId: "god-record",
    findingId: "GOD-COR-001",
    status: "skipped",
    selectedBy: "explicit-id",
    verification: "not run",
    evidence: "The later pass skipped this already-fixed target.",
    followUp: "none",
    terminal: true
  });
  assert.equal(skipped.status, "recorded");
  assert.equal(skipped.remediationId, "GOD-FIX-002");
  assert.equal(skipped.cleanupEligible, false);

  const report = await readFile(path.join(repoPath, reportPath), "utf8");
  assert.equal((report.match(/^## Remediation Log$/gm) ?? []).length, 1);
  assert.match(report, /### GOD-FIX-001: GOD-COR-001/);
  assert.match(report, /- Files Changed: `src\/feature\.ts`/);
  assert.match(report, /### GOD-FIX-002: GOD-COR-001/);
  assert.match(report, /- Status: skipped/);
  assert.match(report, /- Files Changed: none/);

  const loaded = await blueprintGodReviewLoadFindings({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation: "/blu-code-review-fix --feels-like-god --run-id god-record",
    runId: "god-record"
  });
  assert.deepEqual(
    loaded.remediations.map((remediation) => [remediation.id, remediation.findingId]),
    [
      ["GOD-FIX-001", "GOD-COR-001"],
      ["GOD-FIX-002", "GOD-COR-001"]
    ]
  );

  const session = godReviewSessionSchema.parse(
    JSON.parse(await readFile(path.join(repoPath, sessionPath), "utf8"))
  );
  assert.equal(session.cleanup.godFixTerminal, true);
  assert.equal(session.cleanup.eligible, false);
});

test("blueprint_god_review_record_fix represents no-edit statuses without claiming changed files", async () => {
  const repoPath = await writeRecordRepo();
  const { reportPath } = await startRecordReport(repoPath);

  for (const [status, expectedId] of [
    ["deferred", "GOD-FIX-001"],
    ["blocked", "GOD-FIX-002"],
    ["skipped", "GOD-FIX-003"]
  ] as const) {
    const recorded = await blueprintGodReviewRecordFix({
      cwd: repoPath,
      activeCommand: "/blu-code-review-fix",
      rawInvocation:
        "/blu-code-review-fix --feels-like-god --run-id god-record --finding GOD-COR-002",
      runId: "god-record",
      findingId: "GOD-COR-002",
      status,
      selectedBy: "explicit-id",
      verification: "not run",
      evidence: `${status} without edits.`,
      followUp: "manual follow-up"
    });

    assert.equal(recorded.status, "recorded");
    assert.equal(recorded.remediationId, expectedId);
    assert.deepEqual(recorded.filesChanged, []);
  }

  const invalid = await blueprintGodReviewRecordFix({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation:
      "/blu-code-review-fix --feels-like-god --run-id god-record --finding GOD-COR-002",
    runId: "god-record",
    findingId: "GOD-COR-002",
    status: "blocked",
    selectedBy: "explicit-id",
    filesChanged: ["src/feature.ts"],
    verification: "not run",
    evidence: "Should not claim edits.",
    followUp: "manual"
  });

  assert.equal(invalid.status, "invalid");
  assert.match(invalid.reason ?? "", /Only fixed god-review remediation entries/);

  const report = await readFile(path.join(repoPath, reportPath), "utf8");
  assert.match(report, /### GOD-FIX-001: GOD-COR-002/);
  assert.match(report, /### GOD-FIX-002: GOD-COR-002/);
  assert.match(report, /### GOD-FIX-003: GOD-COR-002/);
  assert.doesNotMatch(report, /### GOD-FIX-004/);
  assert.equal((report.match(/- Files Changed: none/g) ?? []).length, 3);
});

test("blueprint_god_review_record_fix blocks stale edit records but allows no-edit stale evidence", async () => {
  const repoPath = await writeRecordRepo();
  const { reportPath } = await startRecordReport(repoPath);
  const beforeReport = await readFile(path.join(repoPath, reportPath), "utf8");

  await writeFile(
    path.join(repoPath, "src/feature.ts"),
    "export const renamedValue = 1;\n",
    "utf8"
  );

  const blocked = await blueprintGodReviewRecordFix({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation:
      "/blu-code-review-fix --feels-like-god --run-id god-record --finding GOD-COR-001",
    runId: "god-record",
    findingId: "GOD-COR-001",
    status: "fixed",
    selectedBy: "explicit-id",
    filesChanged: ["src/feature.ts"],
    verification: "not run",
    evidence: "Attempted stale edit.",
    followUp: "start fresh"
  });
  assert.equal(blocked.status, "stale");
  assert.equal(blocked.written, false);
  assert.ok(
    blocked.staleReasons.some((reason) =>
      /fileSetHash changed/.test(reason)
    )
  );
  assert.equal(await readFile(path.join(repoPath, reportPath), "utf8"), beforeReport);

  const stale = await blueprintGodReviewRecordFix({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation:
      "/blu-code-review-fix --feels-like-god --run-id god-record --finding GOD-COR-001",
    runId: "god-record",
    findingId: "GOD-COR-001",
    status: "stale",
    selectedBy: "explicit-id",
    verification: "not run",
    followUp: "start a fresh hidden review",
    terminal: true
  });
  assert.equal(stale.status, "recorded");
  assert.equal(stale.remediationId, "GOD-FIX-001");
  assert.deepEqual(stale.filesChanged, []);
  assert.ok(stale.staleReasons.length > 0);

  const report = await readFile(path.join(repoPath, reportPath), "utf8");
  assert.match(report, /### GOD-FIX-001: GOD-COR-001/);
  assert.match(report, /- Status: stale/);
  assert.match(report, /- Files Changed: none/);
  assert.match(report, /featureValue/);
});

test("blueprint_god_review_record_fix keeps remediation inside the durable god-review report", async () => {
  const repoPath = await writeRecordRepo();
  const { reportPath, humanStatePath } = await startRecordReport(repoPath);

  const recorded = await blueprintGodReviewRecordFix({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation:
      "/blu-code-review-fix --feels-like-god --run-id god-record --finding GOD-COR-001",
    runId: "god-record",
    findingId: "GOD-COR-001",
    status: "fixed",
    selectedBy: "explicit-id",
    filesChanged: ["src/feature.ts"],
    verification: "`npm test` - passed",
    evidence: "No normal review-fix artifact was written.",
    followUp: "none",
    terminal: true
  });

  assert.equal(recorded.status, "recorded");
  assert.equal(recorded.reportPath, reportPath);
  assert.equal(await pathExists(path.join(repoPath, ".blueprint/reports/GOD-REVIEW-FIX.md")), false);
  assert.equal(await pathExists(path.join(repoPath, ".blueprint/reports/god-review-fix.md")), false);
  assert.equal(await pathExists(path.join(repoPath, ".blueprint/STATE.md")), false);
  assert.match(await readFile(path.join(repoPath, humanStatePath), "utf8"), /Hidden fix terminal: yes/);
});
