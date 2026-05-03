import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  blueprintArtifactList,
  blueprintArtifactReportWrite,
  blueprintArtifactSummaryDigest
} from "../src/mcp/tools/artifacts.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

function cleanupReportContent(nextSafeAction = "/blu-progress"): string {
  return `# Cleanup Report

## Selected Phase Directories

- .blueprint/phases/01-bug-taxonomy-and-reporting-harness

## Protected Exclusions

- .blueprint/phases/06-workspace-maintenance-audit

## Archive Destination

- .blueprint/archive/v1

## Mutation Outcome

- pending

## Next Safe Action

- ${nextSafeAction}
`;
}

async function createCleanupFixtureRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-cleanup-tools-");
  const reportsDir = path.join(repoPath, ".blueprint/reports");
  const phaseDir = path.join(
    repoPath,
    ".blueprint/phases/05-review-quality-impact-shipping-audit"
  );

  await mkdir(reportsDir, { recursive: true });
  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap

## Milestone

- Active milestone: v1

## Phases

- [x] **Phase 5: Review Quality Impact Shipping Audit**
- [ ] **Phase 6: Workspace Maintenance Audit**
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 6
- Active command: /blu-cleanup
- Next action: Run /blu-cleanup
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    JSON.stringify({ version: 2 }, null, 2),
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-05-SUMMARY.md"),
    `# Phase 05 Summary

## Outcome

- Review and shipping closeout evidence is complete.

## Verification

- npx tsx --test tests/ship-metadata.test.ts passed.
`,
    "utf8"
  );
  await writeFile(
    path.join(reportsDir, "milestone-summary-v1.md"),
    `# Milestone Summary

## Scope Summary

- Milestone v1 completed and is ready for archival review.

## Recommended Carry-Forward Context

- Preserve cleanup evidence before archiving old phases.
`,
    "utf8"
  );

  return repoPath;
}

test("cleanup report write persists canonical cleanup-latest reports with explicit overwrite protection", async (t) => {
  const repoPath = await createCleanupFixtureRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const created = await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "cleanup-latest",
    content: cleanupReportContent()
  });
  const listed = await blueprintArtifactList({ cwd: repoPath });
  const savedPath = path.join(repoPath, created.path);
  const saved = await readFile(savedPath, "utf8");
  const reused = await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "cleanup-latest",
    content: saved
  });

  await assert.rejects(
    () =>
      blueprintArtifactReportWrite({
        cwd: repoPath,
        reportName: "cleanup-latest",
        content: cleanupReportContent("/blu-new-milestone")
      }),
    /already exists.*explicit overwrite confirmation/i
  );

  const updated = await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "cleanup-latest",
    content: cleanupReportContent("/blu-new-milestone"),
    overwrite: true
  });
  const updatedBody = await readFile(savedPath, "utf8");

  assert.equal(created.path, ".blueprint/reports/cleanup-latest.md");
  assert.equal(created.status, "created");
  assert.ok(listed.reports.includes(".blueprint/reports/cleanup-latest.md"));
  assert.match(saved, /## Selected Phase Directories/);
  assert.match(saved, /## Protected Exclusions/);
  assert.match(saved, /## Archive Destination/);
  assert.equal(reused.status, "reused");
  assert.equal(updated.status, "updated");
  assert.match(updatedBody, /\/blu-new-milestone/);
});

test("cleanup report write rejects reports that omit required cleanup headings", async (t) => {
  const repoPath = await createCleanupFixtureRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalid = await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "cleanup-latest",
    content: `# Cleanup Report

## Selected Phase Directories

- .blueprint/phases/01-bug-taxonomy-and-reporting-harness
`
  });

  assert.equal(invalid.status, "invalid");
  assert.equal(invalid.written, false);
  assert.match(invalid.issues.join("\n"), /Protected Exclusions/);
  assert.match(invalid.issues.join("\n"), /Archive Destination/);
  assert.match(invalid.issues.join("\n"), /Mutation Outcome/);
  assert.match(invalid.issues.join("\n"), /Next Safe Action/);
});

test("cleanup digest preserves the explicit artifact scope used to build archival evidence", async (t) => {
  const repoPath = await createCleanupFixtureRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "cleanup-latest",
    content: cleanupReportContent()
  });

  const artifactPaths = [
    ".blueprint/phases/05-review-quality-impact-shipping-audit/05-05-SUMMARY.md",
    ".blueprint/reports/milestone-summary-v1.md",
    ".blueprint/reports/cleanup-latest.md"
  ];
  const digest = await blueprintArtifactSummaryDigest({
    cwd: repoPath,
    artifactPaths
  });

  assert.deepEqual(digest.inputsUsed, [...artifactPaths].sort());
  assert.equal(digest.digest.length, artifactPaths.length);
  assert.equal(
    digest.digest.find((section) => section.artifact === ".blueprint/reports/cleanup-latest.md")
      ?.artifact,
    ".blueprint/reports/cleanup-latest.md"
  );
  assert.match(
    digest.digest.map((section) => section.summary).join("\n"),
    /cleanup|archive|carry-forward|verification/i
  );
});
