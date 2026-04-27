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

type MilestoneAuditReportArgs = {
  verdict: "READY_TO_CLOSE" | "FOLLOW_UP" | "BLOCKED";
  requirementGaps?: string[];
  integrationGaps?: string[];
  flowGaps?: string[];
  optionalGaps?: string[];
  blockers?: string[];
  nextSafeAction: string;
};

function renderGapRows(gapIds: string[], surfacePrefix: string): string {
  const rows = gapIds.length > 0 ? gapIds : ["none"];

  return rows
    .map((gapId) => {
      const isNone = gapId === "none";
      const surface = isNone ? "none" : `${surfacePrefix} surface`;
      const evidence = isNone ? "none" : `${surfacePrefix} evidence`;
      const repair = isNone ? "none" : `${surfacePrefix} repair`;

      return `| ${gapId} | ${surface} | ${evidence} | ${repair} |`;
    })
    .join("\n");
}

function renderMilestoneAuditReport(args: MilestoneAuditReportArgs): string {
  const blockers =
    args.blockers && args.blockers.length > 0
      ? args.blockers.map((blocker) => `- ${blocker}`).join("\n")
      : "- none";
  const requirementGapRows = renderGapRows(args.requirementGaps ?? [], "requirement");
  const integrationGapRows = renderGapRows(args.integrationGaps ?? [], "integration");
  const flowGapRows = renderGapRows(args.flowGaps ?? [], "flow");
  const optionalGapRows = renderGapRows(args.optionalGaps ?? [], "optional");
  const summarize = (label: string, rows: string[]): string =>
    `${label}: ${rows.length > 0 ? rows.join(", ") : "none"}`;
  const requirementSummary = summarize("Requirement gaps", args.requirementGaps ?? []);
  const integrationSummary = summarize("Integration gaps", args.integrationGaps ?? []);
  const flowSummary = summarize("Flow gaps", args.flowGaps ?? []);
  const optionalSummary = summarize("Optional gaps", args.optionalGaps ?? []);

  return `# Milestone Audit: v2

**Verdict:** ${args.verdict}
**Evidence Dimensions:** roadmap, validation, UAT, carry-forward

## Audit Verdict

- Verdict: ${args.verdict}
- Rationale: ${
    args.verdict === "READY_TO_CLOSE"
      ? "All milestone phases have validation and UAT evidence, so the milestone can close."
      : "Open gaps or blockers keep milestone closeout from moving forward yet."
  }
- Decision basis: ROADMAP, verification, UAT, and summary evidence remain aligned.

## Milestone Evidence Dimensions

| Dimension | Evidence | Status | Notes |
|-----------|----------|--------|-------|
| Roadmap intent | .blueprint/ROADMAP.md | PASS | The milestone intent and phase list are locked. |
| Validation evidence | .blueprint/phases/04-release-readiness/04-VERIFICATION.md | PASS | The release-readiness phase has durable validation evidence. |
| UAT evidence | .blueprint/phases/04-release-readiness/04-UAT.md | PASS | The UAT closeout evidence is saved. |
| Carry-forward evidence | .blueprint/phases/04-release-readiness/04-01-SUMMARY.md | PASS | The summary is ready to seed milestone completion. |

## Original Intent Snapshot

- Validate that milestone v2 outcomes match the planned roadmap intent.

## Roadmap And Phase Evidence

- .blueprint/ROADMAP.md
- .blueprint/phases/03-execution/03-VERIFICATION.md
- .blueprint/phases/03-execution/03-UAT.md
- .blueprint/phases/04-release-readiness/04-VERIFICATION.md
- .blueprint/phases/04-release-readiness/04-UAT.md

## Requirement Gaps

| Gap ID | Surface | Evidence | Repair |
|--------|---------|----------|--------|
${requirementGapRows}

## Integration Gaps

| Gap ID | Surface | Evidence | Repair |
|--------|---------|----------|--------|
${integrationGapRows}

## Flow Gaps

| Gap ID | Surface | Evidence | Repair |
|--------|---------|----------|--------|
${flowGapRows}

## Optional Gaps

| Gap ID | Surface | Evidence | Repair |
|--------|---------|----------|--------|
${optionalGapRows}

## Gaps Found

- ${requirementSummary}
- ${integrationSummary}
- ${flowSummary}
- ${optionalSummary}

## Archival Blockers

${blockers}

## Next Safe Action

- ${args.nextSafeAction}
`;
}

function milestoneAuditReportContent(additional = ""): string {
  return `${renderMilestoneAuditReport({
    verdict: "READY_TO_CLOSE",
    nextSafeAction: "/blu-complete-milestone v2"
  })}${additional}`;
}

function milestoneAuditReportContentWithFindings(args: {
  requirementGaps?: string[];
  integrationGaps?: string[];
  flowGaps?: string[];
  optionalGaps?: string[];
  blockers: string[];
  nextSafeAction: string;
}): string {
  return renderMilestoneAuditReport({
    verdict: "BLOCKED",
    requirementGaps: args.requirementGaps,
    integrationGaps: args.integrationGaps,
    flowGaps: args.flowGaps,
    optionalGaps: args.optionalGaps,
    blockers: args.blockers,
    nextSafeAction: args.nextSafeAction
  });
}

function milestoneAuditReportContentWithoutVerdict(nextSafeAction: string): string {
  return `# Milestone Audit: v2

**Evidence Dimensions:** roadmap, validation, UAT, carry-forward

## Audit Verdict

- Rationale: The report is malformed because it never states a verdict.
- Decision basis: The follow-up should stay on the saved audit's safe action path.

## Milestone Evidence Dimensions

| Dimension | Evidence | Status | Notes |
|-----------|----------|--------|-------|
| Roadmap intent | .blueprint/ROADMAP.md | PASS | The milestone intent and phase list are locked. |
| Validation evidence | .blueprint/phases/04-release-readiness/04-VERIFICATION.md | PASS | The release-readiness phase has durable validation evidence. |
| UAT evidence | .blueprint/phases/04-release-readiness/04-UAT.md | PASS | The UAT closeout evidence is saved. |
| Carry-forward evidence | .blueprint/phases/04-release-readiness/04-01-SUMMARY.md | PASS | The summary exists, but the audit still needs a verdict. |

## Original Intent Snapshot

- Validate that milestone v2 outcomes match the planned roadmap intent.

## Roadmap And Phase Evidence

- .blueprint/ROADMAP.md

## Gaps Found

- none

## Archival Blockers

- none

## Next Safe Action

- ${nextSafeAction}
`;
}

function milestoneCompleteReportContent(): string {
  return `# Milestone v2 - Completion

**Decision:** READY_TO_CLOSE
**Audit Report Used:** .blueprint/reports/milestone-audit-v2.md
**Evidence Ledger:** roadmap, validation, UAT, carry-forward evidence ledger

## Framing Notes

- This leading section should not swallow the closeout signal.

## Completion Decision

- Decision: READY_TO_CLOSE
- Rationale: Milestone v2 is ready to close.
- Closeout basis: Saved milestone audit evidence covers the roadmap, validation, UAT, and carry-forward chain.

## Audit Report Used

- .blueprint/reports/milestone-audit-v2.md

## Completion Rationale

- Closeout is grounded in saved audit evidence and the milestone audit report.

## Milestone Evidence Ledger

| Dimension | Evidence | Status | Notes |
|-----------|----------|--------|-------|
| Roadmap intent | .blueprint/ROADMAP.md | PASS | The milestone intent and phase list are locked. |
| Validation evidence | .blueprint/phases/04-release-readiness/04-VERIFICATION.md | PASS | The release-readiness phase has durable validation evidence. |
| UAT evidence | .blueprint/phases/04-release-readiness/04-UAT.md | PASS | The UAT closeout evidence is saved. |
| Carry-forward evidence | .blueprint/phases/04-release-readiness/04-01-SUMMARY.md | PASS | The summary is ready to seed milestone completion. |

## Residual Watch Items

- none

## Next Safe Action

- /blu-milestone-summary v2
`;
}

function milestoneSummaryReportContent(): string {
  return `# Milestone v2 - Summary

**Sources Reviewed:** .blueprint/reports/milestone-audit-v2.md, .blueprint/reports/milestone-complete-v2.md
**Evidence Ledger:** audit, completion, roadmap, carry-forward evidence ledger
**Carry-Forward Context:** Preserve the closeout evidence trail when seeding the next milestone.

## Framing Notes

- This section is intentionally generic.

## Scope Summary

- Milestone v2 closed the loop on the release-readiness evidence chain.

## Source Reports Used

- .blueprint/reports/milestone-audit-v2.md
- .blueprint/reports/milestone-complete-v2.md

## Shipped Outcomes

- Saved closeout evidence now feeds the next milestone.

## Deferred Follow-Ups

- none

## Recommended Carry-Forward Context

- Preserve the closeout evidence trail when seeding the next milestone.

## Milestone Evidence Ledger

| Dimension | Evidence | Status | Notes |
|-----------|----------|--------|-------|
| Audit report | .blueprint/reports/milestone-audit-v2.md | PASS | The audit report captures the closeout verdict. |
| Completion report | .blueprint/reports/milestone-complete-v2.md | PASS | The completion report records the final decision. |
| Roadmap context | .blueprint/ROADMAP.md | PASS | The milestone scope remains traceable to the roadmap. |
| Carry-forward context | .blueprint/reports/milestone-summary-v2.md | PASS | The summary can seed the next milestone. |

## Next Safe Action

- /blu-new-milestone
`;
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
    path.join(priorPhaseDir, "03-01-PLAN.md"),
    `---
phase: 3
plan_id: "01"
title: "Execution Plan 01"
wave: 1
status: done
objective: "Preserve earlier milestone execution evidence."
depends_on: []
requirements: []
files_modified: []
read_first: []
acceptance_criteria: []
autonomous: true
---

# Phase 03: Execution - Plan 01
`,
    "utf8"
  );
  await writeFile(
    path.join(priorPhaseDir, "03-01-SUMMARY.md"),
    `# Phase 03: Execution - Summary 01

**Plan:** \`03-01-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Execution completed and left durable evidence for the earlier milestone phase.

## Changes Made

- Captured the completed earlier-phase execution in the phase summary.

## Verification

- Wrote the summary artifact at \`.blueprint/phases/03-execution/03-01-SUMMARY.md\`.

## Follow-Ups

- none

## Evidence

- \`.blueprint/phases/03-execution/03-01-SUMMARY.md\`
`,
    "utf8"
  );
  await writeFile(
    path.join(priorPhaseDir, "03-VERIFICATION.md"),
    `# Phase 03: Execution - Verification

**Coverage:** Reviewed \`03-01-SUMMARY.md\` for completed execution evidence.
**Gate State:** PASS
**Sign-off:** validation lead

## Validation Summary

- Execution evidence for the earlier milestone phase is complete.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| MILESTONE-00 | Preserve earlier validation evidence | .blueprint/phases/03-execution/03-01-SUMMARY.md | PASS | Earlier milestone evidence remains durable. |

## Evidence Reviewed

- .blueprint/phases/03-execution/03-01-SUMMARY.md

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
| none | none | .blueprint/phases/03-execution/03-01-SUMMARY.md | none |

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

- Earlier milestone UAT closed without blocking issues against \`.blueprint/phases/03-execution/03-01-SUMMARY.md\`.

## Session State

- Resume source: \`.blueprint/phases/03-execution/03-01-SUMMARY.md\`
- Current session step: none
- Continuity notes: none

## Current Test

- Number: testing complete
- Name: none
- Expected: Keep the accepted behavior stable.
- Awaiting: none

## Test Matrix

| # | Test | Expected Behavior | Evidence | Result | Notes |
|---|------|-------------------|----------|--------|-------|
| 1 | Execution milestone UAT smoke | Keep the accepted behavior stable. | .blueprint/phases/03-execution/03-01-SUMMARY.md | pass | none |

## Result Summary

- Total: 1
- Passed: 1
- Issues: 0
- Pending: 0
- Skipped: 0
- Blocked: 0

## Questions Asked

- none

## Observed Behavior

- The accepted behavior matched \`.blueprint/phases/03-execution/03-01-SUMMARY.md\`.

## Unresolved Gaps

- none

## Structured Gaps

| Test | Truth | Status | Severity | Reason | Follow-Up |
|------|-------|--------|----------|--------|-----------|
| none | none | none | none | none | none |

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

**Plan:** \`04-01-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Execution finished and left durable implementation evidence.

## Changes Made

- Captured the completed release-readiness execution in the phase summary.

## Verification

- Wrote the summary artifact at \`.blueprint/phases/04-release-readiness/04-01-SUMMARY.md\`.

## Follow-Ups

- none

## Evidence

- \`.blueprint/phases/04-release-readiness/04-01-SUMMARY.md\`
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

## Current Test

- Number: testing complete
- Name: none
- Expected: Keep the accepted behavior stable.
- Awaiting: none

## Test Matrix

| # | Test | Expected Behavior | Evidence | Result | Notes |
|---|------|-------------------|----------|--------|-------|
| 1 | Release readiness UAT smoke | Keep the accepted behavior stable. | .blueprint/phases/04-release-readiness/04-01-SUMMARY.md | pass | none |

## Result Summary

- Total: 1
- Passed: 1
- Issues: 0
- Pending: 0
- Skipped: 0
- Blocked: 0

## Questions Asked

- none

## Observed Behavior

- The accepted behavior matched \`.blueprint/phases/04-release-readiness/04-01-SUMMARY.md\`.

## Unresolved Gaps

- none

## Structured Gaps

| Test | Truth | Status | Severity | Reason | Follow-Up |
|------|-------|--------|----------|--------|-----------|
| none | none | none | none | none | none |

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

  await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "milestone-audit-v2",
    content: milestoneAuditReportContent()
  });

  const digest = await blueprintArtifactSummaryDigest({
    cwd: repoPath,
    artifactPaths: [
      ".blueprint/ROADMAP.md",
      ".blueprint/phases/04-release-readiness/04-VERIFICATION.md",
      ".blueprint/phases/04-release-readiness/04-UAT.md",
      ".blueprint/reports/milestone-audit-v2.md"
    ]
  });

  assert.equal(digest.digest.length, 4);
  assert.ok(digest.inputsUsed.includes(".blueprint/ROADMAP.md"));
  assert.ok(digest.inputsUsed.includes(".blueprint/phases/04-release-readiness/04-VERIFICATION.md"));
  assert.ok(digest.inputsUsed.includes(".blueprint/phases/04-release-readiness/04-UAT.md"));
  assert.ok(digest.inputsUsed.includes(".blueprint/reports/milestone-audit-v2.md"));
  assert.match(
    digest.digest.map((section) => section.summary).join("\n"),
    /Verdict: READY_TO_CLOSE|Roadmap intent: PASS|Validation evidence: PASS|UAT evidence: PASS/
  );
  assert.match(
    digest.digest.map((section) => section.title).join("\n"),
    /Verification|UAT|Audit Fixture|Milestone Audit/
  );
});

test("artifact summary digest preserves milestone closeout evidence beyond the first two sections", async (t) => {
  const repoPath = await createMilestoneAuditRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "milestone-audit-v2",
    content: milestoneAuditReportContent()
  });
  await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "milestone-complete-v2",
    content: milestoneCompleteReportContent()
  });
  await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "milestone-summary-v2",
    content: milestoneSummaryReportContent()
  });

  const digest = await blueprintArtifactSummaryDigest({
    cwd: repoPath,
    artifactPaths: [
      ".blueprint/reports/milestone-audit-v2.md",
      ".blueprint/reports/milestone-complete-v2.md",
      ".blueprint/reports/milestone-summary-v2.md"
    ]
  });

  const auditSummary =
    digest.digest.find((section) => section.artifact === ".blueprint/reports/milestone-audit-v2.md")
      ?.summary ?? "";
  const completionSummary =
    digest.digest.find((section) => section.artifact === ".blueprint/reports/milestone-complete-v2.md")
      ?.summary ?? "";
  const summarySummary =
    digest.digest.find((section) => section.artifact === ".blueprint/reports/milestone-summary-v2.md")
      ?.summary ?? "";

  assert.match(auditSummary, /Verdict: READY_TO_CLOSE/);
  assert.match(auditSummary, /Roadmap intent: PASS/);
  assert.match(auditSummary, /Validation evidence: PASS/);
  assert.match(auditSummary, /UAT evidence: PASS/);
  assert.match(auditSummary, /Carry-forward evidence: PASS/);
  assert.match(auditSummary, /Next Safe Action: \/blu-complete-milestone v2/);
  assert.match(completionSummary, /Decision: READY_TO_CLOSE/);
  assert.match(completionSummary, /Audit Report Used: \.blueprint\/reports\/milestone-audit-v2\.md/);
  assert.match(completionSummary, /Milestone Evidence Ledger: Roadmap intent: PASS/);
  assert.match(completionSummary, /Next Safe Action: \/blu-milestone-summary v2/);
  assert.match(
    summarySummary,
    /\*\*Sources Reviewed:\*\* .*milestone-audit-v2\.md, .*milestone-complete-v2\.md/
  );
  assert.match(summarySummary, /Scope Summary: Milestone v2 closed the loop/);
  assert.match(summarySummary, /Milestone Evidence Ledger: Audit report: PASS/);
  assert.match(summarySummary, /Recommended Carry-Forward Context: Preserve the closeout evidence trail/);
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

test("project status keeps milestone closeout blocked when an earlier verification is valid but not ready for UAT", async (t) => {
  const repoPath = await createMilestoneAuditRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-execution/03-VERIFICATION.md"),
    `# Phase 03: Execution - Verification

**Coverage:** Reviewed \`03-01-SUMMARY.md\` for completed execution evidence.
**Gate State:** PARTIAL
**Sign-off:** validation lead

## Validation Summary

- The earlier phase still needs validation repair before milestone closeout.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| MILESTONE-00 | Preserve earlier validation evidence | .blueprint/phases/03-execution/03-01-SUMMARY.md | DEFERRED | The verification pass is valid but not ready for UAT. |

## Evidence Reviewed

- .blueprint/phases/03-execution/03-01-SUMMARY.md

## Test Infrastructure / Evidence Metadata

- Harness: node:test
- Commands: tsx --test
- Evidence type: saved execution evidence
- Test infrastructure status: available

## Manual-Only or Deferred Coverage

| Item | Why manual or deferred | Follow-Up | Status |
|------|------------------------|-----------|--------|
| follow-up confirmation | Requires validation repair before UAT | Re-run /blu-validate-phase 3 | DEFERRED |

## Gate State

- Gate: PARTIAL
- Sign-off: validation lead
- Readiness: not ready for UAT

## Gap Classification

| Gap class | Scope | Evidence | Repair |
|-----------|-------|----------|--------|
| deferred | Follow-up confirmation | .blueprint/phases/03-execution/03-01-SUMMARY.md | Re-run /blu-validate-phase 3 |

## Gaps Found

- Capture the follow-up confirmation during validation repair.

## Suggested Repairs

- Re-run \`/blu-validate-phase 3\` before milestone closeout.

## Next Safe Action

- Continue with \`/blu-validate-phase 3\`.
`,
    "utf8"
  );

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-validate-phase 3/);
  assert.match(state.derivedStatus.nextAction, /\/blu-validate-phase 3/);
  assert.doesNotMatch(status.nextAction, /\/blu-audit-milestone v2/);
  assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-complete-milestone v2/);
});

test("blueprint_state_load exposes milestone-audit readiness only for explicit READY_TO_CLOSE verdicts", async (t) => {
  const readyRepo = await createMilestoneAuditRepo();
  const malformedRepo = await createMilestoneAuditRepo();
  t.after(async () => {
    await rm(path.dirname(readyRepo), { recursive: true, force: true });
    await rm(path.dirname(malformedRepo), { recursive: true, force: true });
  });

  await blueprintArtifactReportWrite({
    cwd: readyRepo,
    reportName: "milestone-audit-v2",
    content: milestoneAuditReportContent()
  });

  await mkdir(path.join(malformedRepo, ".blueprint/reports"), { recursive: true });
  await writeFile(
    path.join(malformedRepo, ".blueprint/reports/milestone-audit-v2.md"),
    milestoneAuditReportContentWithoutVerdict("/blu-plan-milestone-gaps"),
    "utf8"
  );

  const readyState = await blueprintStateLoad({ cwd: readyRepo });
  const malformedState = await blueprintStateLoad({ cwd: malformedRepo });

  assert.equal(readyState.derivedStatus.milestoneAudit.found, true);
  assert.equal(readyState.derivedStatus.milestoneAudit.verdict, "READY_TO_CLOSE");
  assert.equal(readyState.derivedStatus.milestoneAudit.readyForCompletion, true);
  assert.match(readyState.derivedStatus.nextAction, /\/blu-complete-milestone v2/);

  assert.equal(malformedState.derivedStatus.milestoneAudit.found, true);
  assert.equal(malformedState.derivedStatus.milestoneAudit.verdict, null);
  assert.equal(malformedState.derivedStatus.milestoneAudit.readyForCompletion, false);
  assert.match(malformedState.derivedStatus.nextAction, /\/blu-plan-milestone-gaps/);
  assert.doesNotMatch(malformedState.derivedStatus.nextAction, /\/blu-complete-milestone/);
});

test("project status keeps blocked milestone audit reports on gap planning instead of completion", async (t) => {
  const repoPath = await createMilestoneAuditRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "milestone-audit-v2",
    content: milestoneAuditReportContentWithFindings({
      requirementGaps: ["MILESTONE-01"],
      integrationGaps: ["release checklist"],
      flowGaps: ["closeout handoff"],
      optionalGaps: ["post-close polish"],
      blockers: ["Milestone closeout must pause until the gap is closed."],
      nextSafeAction: "/blu-plan-milestone-gaps"
    })
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-plan-milestone-gaps/);
  assert.match(state.derivedStatus.nextAction, /\/blu-plan-milestone-gaps/);
  assert.doesNotMatch(status.nextAction, /\/blu-complete-milestone/);
  assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-complete-milestone/);
});

test("project status honors a FOLLOW_UP audit verdict even when the evidence sections are empty", async (t) => {
  const repoPath = await createMilestoneAuditRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "milestone-audit-v2",
    content: `# Milestone Audit: v2

**Verdict:** FOLLOW_UP
**Evidence Dimensions:** roadmap, validation, UAT, carry-forward

## Audit Verdict

- Verdict: FOLLOW_UP
- Rationale: The audit needs a follow-up pass before milestone closeout.
- Decision basis: The explicit verdict keeps the milestone open even though the evidence rows are all marked complete.

## Milestone Evidence Dimensions

| Dimension | Evidence | Status | Notes |
|-----------|----------|--------|-------|
| Roadmap intent | .blueprint/ROADMAP.md | PASS | The milestone intent is locked. |
| Validation evidence | .blueprint/phases/04-release-readiness/04-VERIFICATION.md | PASS | Validation evidence is present. |
| UAT evidence | .blueprint/phases/04-release-readiness/04-UAT.md | PASS | UAT evidence is present. |
| Carry-forward evidence | .blueprint/phases/04-release-readiness/04-01-SUMMARY.md | PASS | The summary exists, but the audit still requires follow-up. |

## Original Intent Snapshot

- Validate that milestone v2 outcomes match the planned roadmap intent.

## Roadmap And Phase Evidence

- .blueprint/ROADMAP.md

## Requirement Gaps

| Gap ID | Surface | Evidence | Repair |
|--------|---------|----------|--------|
| none | none | none | none |

## Integration Gaps

| Gap ID | Surface | Evidence | Repair |
|--------|---------|----------|--------|
| none | none | none | none |

## Flow Gaps

| Gap ID | Surface | Evidence | Repair |
|--------|---------|----------|--------|
| none | none | none | none |

## Optional Gaps

| Gap ID | Surface | Evidence | Repair |
|--------|---------|----------|--------|
| none | none | none | none |

## Gaps Found

- none

## Archival Blockers

- none

## Next Safe Action

- /blu-plan-milestone-gaps
`
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-plan-milestone-gaps/);
  assert.match(state.derivedStatus.nextAction, /\/blu-plan-milestone-gaps/);
  assert.doesNotMatch(status.nextAction, /\/blu-complete-milestone/);
  assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-complete-milestone/);
});
