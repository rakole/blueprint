import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import {
  blueprintArtifactList,
  blueprintArtifactSummaryDigest,
  blueprintArtifactReportWrite
} from "../src/mcp/tools/artifacts.js";
import { blueprintProjectStatus } from "../src/mcp/tools/project.js";
import { blueprintStateLoad } from "../src/mcp/tools/state.js";

const repoRoot = process.cwd();

function milestoneAuditReportContent(additional = ""): string {
  return `# Milestone Audit: v2

## Original Intent Snapshot

- Validate that milestone v2 outcomes match the planned roadmap intent.

## Roadmap And Phase Evidence

- .blueprint/ROADMAP.md
- .blueprint/phases/03-execution/03-VERIFICATION.md
- .blueprint/phases/03-execution/03-UAT.md
- .blueprint/phases/04-release-readiness/04-VERIFICATION.md
- .blueprint/phases/04-release-readiness/04-UAT.md

## Gaps Found

- none

## Archival Blockers

- none

## Next Safe Action

- /blu-complete-milestone v2
${additional}`;
}

async function createMilestoneAuditRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-audit-milestone-"));
  const repoPath = path.join(tempRoot, "repo");
  const priorPhaseDir = path.join(repoPath, ".blueprint/phases/03-execution");
  const phaseDir = path.join(repoPath, ".blueprint/phases/04-release-readiness");

  await mkdir(priorPhaseDir, { recursive: true });
  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Audit Fixture

## Milestone

- Active milestone: v2

## Phases

- [x] **Phase 3: Execution**
- [x] **Phase 4: Release Readiness**

## Phase Details

### Phase 4: Release Readiness
**Goal**: Close milestone validation evidence and prepare for audit.
**Requirements**: MILESTONE-01
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v2
- Current phase: 4
- Active command: /blu-verify-work
- Next action: Run /blu-verify-work 4
- Last updated: 2026-04-12T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    JSON.stringify({ version: 2 }, null, 2),
    "utf8"
  );
  await writeFile(
    path.join(priorPhaseDir, "03-VERIFICATION.md"),
    `# Phase 03: Execution - Verification

**Coverage:** Reviewed any saved execution evidence for validation completeness.
**Gate State:** PASS
**Sign-off:** validation lead

## Validation Summary

- Execution evidence for the earlier milestone phase is complete.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| MILESTONE-00 | Preserve earlier validation evidence | saved phase evidence | PASS | Earlier milestone evidence remains durable. |

## Evidence Reviewed

- saved phase evidence

## Test Infrastructure / Evidence Metadata

- Harness: node:test
- Commands: tsx --test
- Evidence type: saved execution evidence
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
| none | none | saved phase evidence | none |

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- /blu-verify-work 3
`,
    "utf8"
  );
  await writeFile(
    path.join(priorPhaseDir, "03-UAT.md"),
    `# Phase 03: Execution - UAT

**Status:** PASS
**Resume State:** NEW
**Checkpoint:** none

## UAT Summary

- Earlier milestone UAT closed without blocking issues.

## Session State

- Resume source: saved phase evidence
- Current session step: none
- Continuity notes: none

## Questions Asked

- none

## Observed Behavior

- The accepted behavior matched the saved phase evidence.

## Unresolved Gaps

- none

## Follow-Up Fixes

- none

## Next Safe Action

- /blu-progress
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "04-01-PLAN.md"),
    `---
phase: 4
plan_id: "01"
title: "Release Readiness Plan 01"
wave: 1
status: done
objective: "Prepare the milestone for the final audit."
depends_on: []
requirements: ["MILESTONE-01"]
files_modified: []
read_first: []
acceptance_criteria: []
autonomous: true
---

# Phase 04: Release Readiness - Plan 01

## Goal

Prepare the milestone for the final audit.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "04-01-SUMMARY.md"),
    `# Phase 04: Release Readiness - Summary 01

## Result

- Execution finished and left durable implementation evidence.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "04-CONTEXT.md"),
    `# Phase 04: Release Readiness - Context

## Decisions

- The milestone is ready for final audit once UAT closes.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "04-RESEARCH.md"),
    `# Phase 04: Release Readiness - Research

**Researched:** 2026-04-12
**Domain:** milestone audit routing
**Confidence:** HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MILESTONE-01 | Audit the milestone after validation and UAT close. | Use durable summary, verification, and UAT evidence plus a milestone report. |

## Summary

- The final completed phase should route to a milestone audit once validation and UAT exist.

## Locked Decisions From Context

- Audit reports should stay evidence-backed and phase-scoped.

## User Constraints

- Keep writes inside .blueprint/reports/.

## Standard Stack

- TypeScript on Node.js

## Installation And Setup

- Run audit fixtures with the phase research artifact already saved under .blueprint/.

## Alternatives Considered

- Recomputing discovery context from scratch during audit was rejected as needlessly lossy.

## Architecture Patterns

- Commands stay thin and MCP tools own report persistence.

## Don't Hand-Roll

- Do not write reports outside the Blueprint artifact tool surface.

## Anti-Patterns

- Auditing milestone completion without reading the saved discovery trail.

## State Of The Art

- Milestone audits now consume the saved Blueprint artifact graph instead of ad hoc notes.

## Common Pitfalls

- Recommending phase discovery after the milestone is already complete.

## Open Questions

- Should milestone audits call out stale research validity separately from missing research?

## Confidence Breakdown

| Topic | Confidence | Why |
|-------|------------|-----|
| Milestone audit routing | HIGH | The fixture controls the saved audit and research evidence path. |

## Code Examples

\`\`\`ts
await blueprintArtifactReportWrite({ cwd: repoPath, reportName: "milestone-audit-v2", content });
\`\`\`

## Recommendations

- Route to /blu-audit-milestone once every roadmap phase is complete and each completed phase has validation plus UAT evidence.

## Sources

- \`src/mcp/tools/state.ts\` - milestone readiness and next-action routing logic.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "04-UI-SPEC.md"),
    `# Phase 04: Release Readiness - UI Spec

## Outcome Mode

- Explicit skip rationale
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "04-VERIFICATION.md"),
    `# Phase 04: Release Readiness - Verification

**Coverage:** Reviewed \`04-01-SUMMARY.md\` for completed execution evidence.
**Gate State:** PASS
**Sign-off:** validation lead

## Validation Summary

- Validation confirms the milestone is ready for UAT closeout.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| MILESTONE-01 | Confirm release-readiness evidence exists | .blueprint/phases/04-release-readiness/04-01-SUMMARY.md | PASS | Milestone readiness is grounded in the saved summary. |

## Evidence Reviewed

- .blueprint/phases/04-release-readiness/04-01-SUMMARY.md

## Test Infrastructure / Evidence Metadata

- Harness: node:test
- Commands: tsx --test
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
| none | none | .blueprint/phases/04-release-readiness/04-01-SUMMARY.md | none |

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- /blu-verify-work 4
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "04-UAT.md"),
    `# Phase 04: Release Readiness - UAT

**Status:** PASS
**Resume State:** NEW
**Checkpoint:** none

## UAT Summary

- UAT closed with no blocking issues against \`.blueprint/phases/04-release-readiness/04-01-SUMMARY.md\`.

## Session State

- Resume source: \`.blueprint/phases/04-release-readiness/04-01-SUMMARY.md\`
- Current session step: none
- Continuity notes: none

## Questions Asked

- none

## Observed Behavior

- The accepted behavior matched \`.blueprint/phases/04-release-readiness/04-01-SUMMARY.md\`.

## Unresolved Gaps

- none

## Follow-Up Fixes

- none

## Next Safe Action

- /blu-progress
`,
    "utf8"
  );

  return repoPath;
}

test("artifact report write is registered and persists milestone audit reports with overwrite protection", async (t) => {
  const repoPath = await createMilestoneAuditRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  assert.ok(
    blueprintToolNames.includes("blueprint_artifact_report_write"),
    "blueprint_artifact_report_write should be registered"
  );

  const created = await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "milestone-audit-v2",
    content: milestoneAuditReportContent()
  });
  const reportPath = path.join(repoPath, created.path);
  const createdBody = await readFile(reportPath, "utf8");
  const listed = await blueprintArtifactList({ cwd: repoPath });
  const reused = await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "milestone-audit-v2",
    content: createdBody
  });
  const updated = await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "milestone audit v2",
    content: milestoneAuditReportContent("\n## Recommendations\n\n- Proceed carefully.\n"),
    overwrite: true
  });

  assert.equal(created.path, ".blueprint/reports/milestone-audit-v2.md");
  assert.equal(created.status, "created");
  assert.match(createdBody, /# Milestone Audit: v2/);
  assert.ok(listed.reports.includes(".blueprint/reports/milestone-audit-v2.md"));
  assert.equal(reused.status, "reused");
  assert.equal(updated.status, "updated");
});

test("artifact report write rejects malformed audit-fix reports before persistence", async (t) => {
  const repoPath = await createMilestoneAuditRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalid = await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "audit-fix-04",
    content: `# Audit Fix Report: Phase 04

## Evidence Used

- .blueprint/phases/04-release-readiness/04-01-SUMMARY.md
`
  });

  assert.equal(invalid.path, ".blueprint/reports/audit-fix-04.md");
  assert.equal(invalid.status, "invalid");
  assert.equal(invalid.written, false);
  assert.equal(invalid.created, false);
  assert.equal(invalid.overwritten, false);
  assert.match(invalid.warnings.join("\n"), /Fix Scope/);
  assert.match(invalid.warnings.join("\n"), /Changes Applied/);
  assert.match(invalid.warnings.join("\n"), /Remaining Gaps/);
  assert.match(invalid.warnings.join("\n"), /Next Safe Action/);
  await assert.rejects(() => readFile(path.join(repoPath, invalid.path), "utf8"), /ENOENT/);
});

test("artifact report write keeps non-contract report behavior unchanged", async (t) => {
  const repoPath = await createMilestoneAuditRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const created = await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "custom-health-check",
    content: `# Custom Health Check

- Reports without strict contracts remain writable.
`
  });

  assert.equal(created.path, ".blueprint/reports/custom-health-check.md");
  assert.equal(created.status, "created");
  assert.equal(created.written, true);
});

test("artifact summary digest can summarize explicit milestone artifact paths", async (t) => {
  const repoPath = await createMilestoneAuditRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const digest = await blueprintArtifactSummaryDigest({
    cwd: repoPath,
    artifactPaths: [
      ".blueprint/ROADMAP.md",
      ".blueprint/phases/04-release-readiness/04-VERIFICATION.md",
      ".blueprint/phases/04-release-readiness/04-UAT.md"
    ]
  });

  assert.deepEqual(digest.inputsUsed, [
    ".blueprint/phases/04-release-readiness/04-UAT.md",
    ".blueprint/phases/04-release-readiness/04-VERIFICATION.md",
    ".blueprint/ROADMAP.md"
  ]);
  assert.equal(digest.digest.length, 3);
  assert.match(
    digest.digest.map((section) => section.summary).join("\n"),
    /Active milestone: v2|Audit Fixture/
  );
  assert.match(
    digest.digest.map((section) => section.title).join("\n"),
    /Verification|UAT|Audit Fixture/
  );
});

test("project status routes fully verified milestones to audit-milestone until the audit report exists", async (t) => {
  const repoPath = await createMilestoneAuditRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const beforeStatus = await blueprintProjectStatus({ cwd: repoPath });
  const beforeState = await blueprintStateLoad({ cwd: repoPath });

  assert.match(beforeStatus.nextAction, /\/blu-audit-milestone v2/);
  assert.match(beforeState.derivedStatus.nextAction, /\/blu-audit-milestone v2/);

  await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "milestone-audit-v2",
    content: milestoneAuditReportContent()
  });

  const afterStatus = await blueprintProjectStatus({ cwd: repoPath });
  const afterState = await blueprintStateLoad({ cwd: repoPath });

  assert.doesNotMatch(afterStatus.nextAction, /\/blu-audit-milestone/);
  assert.doesNotMatch(afterState.derivedStatus.nextAction, /\/blu-audit-milestone/);
  assert.match(afterStatus.nextAction, /\/blu-complete-milestone v2/);
  assert.match(afterState.derivedStatus.nextAction, /\/blu-complete-milestone v2/);
});
