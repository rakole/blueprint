import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  blueprintGodReviewAppend,
  blueprintGodReviewLoadFindings,
  blueprintGodReviewStart
} from "../src/mcp/tools/god-review.js";
import {
  createCommittedGitRepo,
  runGit
} from "./helpers/git-fixtures.js";

const repoRoot = process.cwd();

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function writeSelectionRepo(): Promise<string> {
  const repoPath = await createCommittedGitRepo("blueprint-god-review-selection-");

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await writeFile(
    path.join(repoPath, "src/feature.ts"),
    [
      "export const featureValue = 1;",
      "export const mediumValue = 2;",
      "export const lowValue = 3;",
      "export const unknownValue = 4;",
      "export const noteValue = 5;",
      "export const acceptedValue = 6;",
      "export const blockedValue = 7;",
      "export const ineligibleValue = 8;",
      ""
    ].join("\n"),
    "utf8"
  );
  await runGit(["add", "."], repoPath);
  await runGit(["commit", "-m", "feature"], repoPath);

  return repoPath;
}

async function startSelectionReport(repoPath: string): Promise<{
  reportPath: string;
  sessionPath: string;
}> {
  const start = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --files src/feature.ts",
    scopeKind: "explicit-files",
    files: ["src/feature.ts"],
    runId: "god-select"
  });
  assert.equal(start.status, "started");

  const append = await blueprintGodReviewAppend({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --run-id god-select --continue",
    runId: "god-select",
    groupId: "correctness-contracts",
    status: "completed",
    findings: [
      {
        title: "High actionable defect",
        severity: "high",
        disposition: "follow-up",
        confidence: "high",
        files: ["src/feature.ts:1"],
        evidence: "Current code still contains `featureValue`.",
        impact: "High impact.",
        recommendation: "Fix high defect.",
        fixEligibility: "eligible"
      },
      {
        title: "Medium actionable defect",
        severity: "medium",
        disposition: "follow-up",
        confidence: "high",
        files: ["src/feature.ts:2"],
        evidence: "Current code still contains `mediumValue`.",
        impact: "Medium impact.",
        recommendation: "Fix medium defect.",
        fixEligibility: "eligible"
      },
      {
        title: "Low actionable defect",
        severity: "low",
        disposition: "follow-up",
        confidence: "medium",
        files: ["src/feature.ts:3"],
        evidence: "Current code still contains `lowValue`.",
        impact: "Low impact.",
        recommendation: "Fix low defect.",
        fixEligibility: "eligible"
      },
      {
        title: "Unknown actionable defect",
        severity: "unknown",
        disposition: "follow-up",
        confidence: "low",
        files: ["src/feature.ts:4"],
        evidence: "Current code still contains `unknownValue`.",
        impact: "Unknown impact.",
        recommendation: "Investigate.",
        fixEligibility: "eligible"
      },
      {
        title: "Observation note",
        severity: "high",
        disposition: "observation",
        confidence: "medium",
        files: ["src/feature.ts:5"],
        evidence: "Current code still contains `noteValue`.",
        impact: "Informational.",
        recommendation: "Observe only.",
        fixEligibility: "eligible"
      },
      {
        title: "Accepted risk note",
        severity: "medium",
        disposition: "accepted-risk",
        confidence: "medium",
        files: ["src/feature.ts:6"],
        evidence: "Current code still contains `acceptedValue`.",
        impact: "Accepted.",
        recommendation: "No edit.",
        fixEligibility: "eligible"
      },
      {
        title: "Blocked note",
        severity: "high",
        disposition: "blocked",
        confidence: "medium",
        files: ["src/feature.ts:7"],
        evidence: "Current code still contains `blockedValue`.",
        impact: "Blocked.",
        recommendation: "Wait.",
        fixEligibility: "eligible"
      },
      {
        title: "Ineligible follow-up",
        severity: "high",
        disposition: "follow-up",
        confidence: "high",
        files: ["src/feature.ts:8"],
        evidence: "Current code still contains `ineligibleValue`.",
        impact: "High impact.",
        recommendation: "Do not auto-fix.",
        fixEligibility: "not-eligible"
      }
    ]
  });
  assert.equal(append.status, "appended");

  return {
    reportPath: start.reportPath!,
    sessionPath: start.sessionPath!
  };
}

function selectedIds(result: Awaited<ReturnType<typeof blueprintGodReviewLoadFindings>>): string[] {
  return result.selection?.targets.map((target) => target.id) ?? [];
}

test("hidden god-review fix default selection includes only high and medium eligible follow-ups", async () => {
  const repoPath = await writeSelectionRepo();
  await startSelectionReport(repoPath);

  const result = await blueprintGodReviewLoadFindings({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation: "/blu-code-review-fix --feels-like-god --run-id god-select",
    runId: "god-select"
  });

  assert.equal(result.status, "found");
  assert.equal(result.selection?.status, "ready");
  assert.equal(result.selection?.selectedBy, "default");
  assert.deepEqual(selectedIds(result), ["GOD-COR-001", "GOD-COR-002"]);
  assert.equal(result.selection?.fingerprintFresh, true);
  assert.equal(result.selection?.evidenceFresh, true);
  assert.ok(
    result.selection?.excluded.some(
      (entry) => entry.id === "GOD-COR-003" && /severity is low/.test(entry.reason)
    )
  );
  assert.ok(
    result.selection?.excluded.some(
      (entry) => entry.id === "GOD-COR-005" && /disposition is observation/.test(entry.reason)
    )
  );
  assert.ok(
    result.selection?.excluded.some(
      (entry) => entry.id === "GOD-COR-008" && /not-eligible/.test(entry.reason)
    )
  );
});

test("hidden god-review fix explicit selectors widen only the requested target set", async () => {
  const repoPath = await writeSelectionRepo();
  await startSelectionReport(repoPath);

  const lowSeverity = await blueprintGodReviewLoadFindings({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation:
      "/blu-code-review-fix --feels-like-god --run-id god-select --severity low",
    runId: "god-select"
  });
  assert.equal(lowSeverity.selection?.status, "ready");
  assert.equal(lowSeverity.selection?.selectedBy, "severity-filter");
  assert.deepEqual(selectedIds(lowSeverity), ["GOD-COR-003"]);

  const allFollowUps = await blueprintGodReviewLoadFindings({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation: "/blu-code-review-fix --feels-like-god --run-id god-select --all",
    runId: "god-select"
  });
  assert.equal(allFollowUps.selection?.status, "ready");
  assert.equal(allFollowUps.selection?.selectedBy, "all");
  assert.deepEqual(selectedIds(allFollowUps), [
    "GOD-COR-001",
    "GOD-COR-002",
    "GOD-COR-003",
    "GOD-COR-004"
  ]);

  const explicitLow = await blueprintGodReviewLoadFindings({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation:
      "/blu-code-review-fix --feels-like-god --run-id god-select --finding GOD-COR-003",
    runId: "god-select"
  });
  assert.equal(explicitLow.selection?.status, "ready");
  assert.equal(explicitLow.selection?.selectedBy, "explicit-id");
  assert.deepEqual(selectedIds(explicitLow), ["GOD-COR-003"]);

  const missingFinding = await blueprintGodReviewLoadFindings({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation:
      "/blu-code-review-fix --feels-like-god --run-id god-select --finding GOD-COR-999",
    runId: "god-select"
  });
  assert.equal(missingFinding.selection?.status, "invalid");
  assert.match(missingFinding.selection?.reason ?? "", /do not exist: GOD-COR-999/);
  assert.deepEqual(selectedIds(missingFinding), []);
});

test("hidden god-review fix stale evidence prevents edit-ready selection without rewriting artifacts", async () => {
  const repoPath = await writeSelectionRepo();
  const { reportPath, sessionPath } = await startSelectionReport(repoPath);
  const beforeReport = await readFile(path.join(repoPath, reportPath), "utf8");
  const beforeSession = await readFile(path.join(repoPath, sessionPath), "utf8");

  await writeFile(
    path.join(repoPath, "src/feature.ts"),
    "export const renamedValue = 1;\n",
    "utf8"
  );

  const result = await blueprintGodReviewLoadFindings({
    cwd: repoPath,
    activeCommand: "/blu-code-review-fix",
    rawInvocation: "/blu-code-review-fix --feels-like-god --run-id god-select",
    runId: "god-select"
  });

  assert.equal(result.status, "found");
  assert.equal(result.selection?.status, "stale");
  assert.equal(result.selection?.fingerprintFresh, true);
  assert.equal(result.selection?.evidenceFresh, false);
  assert.deepEqual(selectedIds(result), []);
  assert.ok(
    result.selection?.staleReasons.some((reason) =>
      /GOD-COR-001 evidence snippet `featureValue`/.test(reason)
    )
  );
  assert.equal(await readFile(path.join(repoPath, reportPath), "utf8"), beforeReport);
  assert.equal(await readFile(path.join(repoPath, sessionPath), "utf8"), beforeSession);
});

test("hidden code-review-fix branch instructions load private findings selection before edits", async () => {
  const manifest = await readRepoFile("commands/blu-code-review-fix.toml");
  const skill = await readRepoFile("skills/blueprint-review/SKILL.md");

  for (const text of [manifest, skill]) {
    assert.match(text, /mcp_blueprint_blueprint_god_review_load_findings/);
    assert.match(text, /selection\.status/);
    assert.match(text, /--finding/);
    assert.match(text, /--severity/);
    assert.match(text, /--all/);
    assert.match(text, /stale/i);
  }

  assert.match(manifest, /mcp_blueprint_blueprint_god_review_record_fix/);
  assert.match(manifest, /mcp_blueprint_blueprint_god_review_cleanup/);
  assert.match(manifest, /do not write `XX-REVIEW\.md`, `XX-REVIEW-FIX\.md`, `XX-GOD-REVIEW-FIX\.md`/i);
});
