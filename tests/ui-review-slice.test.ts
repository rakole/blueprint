import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { UI_REVIEW_RUNTIME_METADATA } from "../src/mcp/command-runtime-metadata.js";
import { blueprintToolNames } from "../src/mcp/server.js";
import { readArtifactContract } from "../src/mcp/artifact-contracts/index.js";
import {
  blueprintArtifactList,
  validateReviewArtifactContent
} from "../src/mcp/tools/artifacts.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import {
  blueprintReviewAuthoringContext,
  blueprintReviewLoadFindings,
  blueprintReviewRecord,
  blueprintReviewValidateModel
} from "../src/mcp/tools/review.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

const repoRoot = process.cwd();

async function createUiReviewRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-ui-review-");
  const phaseDir = path.join(repoPath, ".blueprint/phases/06-ui-audit");

  await mkdir(phaseDir, { recursive: true });
  await mkdir(path.join(repoPath, "src/ui"), { recursive: true });
  await writeFile(path.join(repoPath, "src/ui/dashboard.tsx"), "export const Dashboard = () => null;\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: UI Review Fixture

## Milestone

- Active milestone: v4

## Phases

- [x] **Phase 6: UI Audit** - Completed frontend implementation ready for UI review

## Phase Details

### Phase 6: UI Audit
**Goal**: Capture a durable UI audit for the completed frontend phase.
**Requirements**: UI-01
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v4
- Current phase: 6
- Active command: /blu-execute-phase
- Next action: Run /blu-ui-review 6
- Last updated: 2026-04-13T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");
  await writeFile(path.join(phaseDir, "06-01-PLAN.md"), uiReviewPlanContent(), "utf8");
  await writeFile(
    path.join(phaseDir, "06-UI-SPEC.md"),
    `# Phase 06: UI Audit - UI Spec

## Outcome Mode

- UI Contract

## Contract

- Desktop and mobile layouts must both preserve hierarchy.
`,
    "utf8"
  );
  await writeFile(path.join(phaseDir, "06-01-SUMMARY.md"), validSummaryContent(), "utf8");

  return repoPath;
}

function uiReviewPlanContent(planId = "01", dependsOn: string[] = [], wave = 1): string {
  return `---
phase: 6
plan_id: "${planId}"
title: "UI audit implementation"
wave: ${wave}
status: planned
objective: "Ship the dashboard UI surface for review."
depends_on: [${dependsOn.map((dependency) => `"${dependency}"`).join(", ")}]
requirements:
  - UI-01
files_modified:
  - src/ui/dashboard.tsx
read_first:
  - src/ui/dashboard.tsx
acceptance_criteria:
  - npm test -- tests/ui-review-slice.test.ts exits 0
autonomous: true
---

# Phase 06: UI Audit - Plan ${planId}

## Goal

Ship the dashboard UI surface for review.

## Scope

- Implement the dashboard UI and responsive hierarchy.

## Tasks

### Task 1: Implement dashboard surface

#### Read First

- src/ui/dashboard.tsx

#### Action

- Refine dashboard copy, responsive hierarchy, and spacing.

#### Acceptance Criteria

- npm test -- tests/ui-review-slice.test.ts exits 0

## Verification

- Run the focused UI review slice test.

## Must Haves

- Preserve desktop and mobile hierarchy.

## Requirement Coverage

| Requirement | Status | Covered By Tasks | Evidence | Rationale |
|-------------|--------|------------------|----------|-----------|
| UI-01 | covered | task-1 | tests/ui-review-slice.test.ts | The UI review fixture covers the dashboard review requirement. |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| src/ui/dashboard.tsx | used | The dashboard source fixture grounds the UI audit. |

## File / Surface Coverage

| Surface | Covered By Tasks | Verification | Rationale |
|---------|------------------|--------------|-----------|
| src/ui/dashboard.tsx | task-1 | npm test -- tests/ui-review-slice.test.ts exits 0 | The focused UI review test covers the declared dashboard surface. |

## Unknowns And Deferrals

| Item | Disposition | Rationale | Follow-Up |
|------|-------------|-----------|-----------|
| No open unknowns for UI review plan ${planId}. | none | The fixture only seeds deterministic UI review evidence. | No follow-up required after the focused test passes. |
`;
}

function validSummaryContent(planId = "01"): string {
  return `# Phase 06: UI Audit - Summary ${planId}

**Plan:** \`06-${planId}-PLAN.md\`
**Status:** COMPLETED
**Readiness:** ready-for-validation
**Completion State:** complete
**Next Safe Action:** /blu-validate-phase 6

## Outcome

- Dashboard UI implementation completed with durable execution summary evidence.

## Changes Made

- Updated the dashboard UI surface, responsive hierarchy, and spacing.

## Verification

| Check | Command | Result | Evidence | Notes |
|-------|---------|--------|----------|-------|
| npm test -- tests/ui-review-slice.test.ts exits 0 | npm test -- tests/ui-review-slice.test.ts | pass | Focused UI review slice tests passed. | The selected acceptance criterion passed. |

## Dependency Plans

| Plan | Status | Evidence |
|------|--------|----------|
| none | none | none |

## Manual / Deferred Work

| Item | Reason | Follow-Up | Status |
|------|--------|-----------|--------|
| none | none | none | NONE |

## Gap / Repair Routes

| Gap | Evidence | Repair | Status |
|-----|----------|--------|--------|
| none | none | none | NONE |

## Follow-Ups

- none

## Evidence

| Kind | Source | Summary |
|------|--------|---------|
| test | npm test -- tests/ui-review-slice.test.ts | Targeted verification evidence for plan ${planId}. |
`;
}

function partialUatContent(nextSafeAction = "/blu-verify-work 6"): string {
  return `# Phase 06: UI Audit - UAT

**Status:** PARTIAL
**Resume State:** RESUMED
**Checkpoint:** resume-ui-follow-up

## UAT Summary

- The user acceptance run found a remaining follow-up against \`.blueprint/phases/06-ui-audit/06-01-SUMMARY.md\` with ready verification evidence.

## Session State

- Resume source: \`.blueprint/phases/06-ui-audit/06-01-SUMMARY.md\`
- Current session step: Resume the UI follow-up after repair.
- Continuity notes: Keep the dashboard evidence aligned with the saved summary while the follow-up remains open.

## Current Test

- Number: 1
- Name: Dashboard UI smoke
- Expected: Preserve the completed dashboard hierarchy.
- Awaiting: follow-up verification

## Test Matrix

| # | Test | Expected Behavior | Evidence | Result | Notes |
|---|------|-------------------|----------|--------|-------|
| 1 | Dashboard UI smoke | Preserve the completed dashboard hierarchy. | .blueprint/phases/06-ui-audit/06-01-SUMMARY.md | issue | One UI follow-up remains open. |

## Result Summary

- Total: 1
- Passed: 0
- Issues: 1
- Pending: 0
- Skipped: 0
- Blocked: 0

## Questions Asked

- Did the dashboard behavior still match the saved execution summary?

## Observed Behavior

- The dashboard hierarchy still needs one follow-up against \`.blueprint/phases/06-ui-audit/06-01-SUMMARY.md\` with ready verification evidence.

## Unresolved Gaps

- Resume \`${nextSafeAction}\` after the saved follow-up is repaired.

## Structured Gaps

| Test | Truth | Status | Severity | Reason | Follow-Up |
|------|-------|--------|----------|--------|-----------|
| 1 | Preserve the completed dashboard hierarchy. | partial | major | One UI follow-up remains open. | Resume \`${nextSafeAction}\` after repair. |

## Follow-Up Fixes

- Resume \`${nextSafeAction}\` after repair.

## Next Safe Action

- Continue with \`${nextSafeAction}\`.
`;
}

function validUiReviewModel(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    verdict: "FOLLOW_UP",
    readiness: "needs-follow-up",
    completionState: "partial",
    uiReviewSummary: [
      "The shipped dashboard honors the saved UI contract, but mobile empty states still need polish with an 18/24 code/static-evidence score."
    ],
    overallScore: 18,
    evidenceCoverage: {
      ".blueprint/phases/06-ui-audit/06-01-SUMMARY.md": {
        status: "used",
        rationale: "Completed summary evidence identifies the implemented dashboard surface."
      },
      ".blueprint/phases/06-ui-audit/06-UI-SPEC.md": {
        status: "used",
        rationale: "UI spec evidence supplies the desktop and mobile hierarchy baseline."
      }
    },
    pillarScores: [
      {
        pillar: "Copywriting",
        score: 3,
        evidence: ".blueprint/phases/06-ui-audit/06-01-SUMMARY.md",
        keyFinding: "Copy is mostly clear for the completed dashboard surface."
      },
      {
        pillar: "Visual Hierarchy",
        score: 3,
        evidence: ".blueprint/phases/06-ui-audit/06-UI-SPEC.md",
        keyFinding: "Desktop hierarchy matches the saved contract."
      },
      {
        pillar: "Color",
        score: 4,
        evidence: ".blueprint/phases/06-ui-audit/06-UI-SPEC.md",
        keyFinding: "No semantic color drift was found in saved evidence."
      },
      {
        pillar: "Typography",
        score: 3,
        evidence: ".blueprint/phases/06-ui-audit/06-UI-SPEC.md",
        keyFinding: "Type scale stays consistent with the UI spec."
      },
      {
        pillar: "Spacing",
        score: 2,
        evidence: ".blueprint/phases/06-ui-audit/06-UI-SPEC.md",
        keyFinding: "Mobile empty-state spacing needs polish."
      },
      {
        pillar: "Experience Design",
        score: 3,
        evidence: ".blueprint/phases/06-ui-audit/06-01-SUMMARY.md",
        keyFinding: "Responsive behavior is implemented with one follow-up."
      }
    ],
    priorityFixes: [
      {
        item: "Mobile empty-state spacing is weak",
        userImpact: "Reduced scanability on narrow screens",
        repair: "Tighten spacing and affordance copy",
        status: "OPEN"
      }
    ],
    findings: [
      {
        pillar: "Spacing",
        severity: "medium",
        evidence: ".blueprint/phases/06-ui-audit/06-UI-SPEC.md",
        userImpact: "Mobile empty states are harder to scan",
        recommendation: "Tighten empty-state spacing and affordance copy",
        status: "OPEN"
      }
    ],
    followUps: [
      "Tighten mobile empty-state spacing and affordance copy."
    ],
    auditTrail: {
      auditDate: "2026-04-13",
      executionMode: "inline",
      existingReviewPosture: "none",
      visualEvidence: "not-supplied",
      auditorPath: "no-subagent-fallback",
      scoreConsistencyNote: "Score total was recalculated from all six pillar rows.",
      confidenceLimitations: "Screenshots were not supplied, so this is a code/static-evidence audit."
    },
    nextSafeAction: "/blu-progress",
    ...patch
  };
}

test("ui-review runtime metadata, manifest, and local contract stay source-owned", async () => {
  const [catalog, contract, commandFile, referenceFile] = await Promise.all([
    blueprintCommandCatalog(),
    buildBlueprintCommandRuntimeContractResource("ui-review"),
    readFile(path.join(repoRoot, "commands/blu-ui-review.toml"), "utf8"),
    readFile(
      path.join(repoRoot, "skills/blueprint-review/references/ui-review-runtime-contract.md"),
      "utf8"
    )
  ]);
  const entry = catalog.commands["ui-review"];

  assert.equal(entry.specPath, UI_REVIEW_RUNTIME_METADATA.sourceId);
  assert.deepEqual(entry.requiredTools, [...UI_REVIEW_RUNTIME_METADATA.requiredTools]);
  assert.equal(contract.catalog.specPath, UI_REVIEW_RUNTIME_METADATA.sourceId);
  assert.equal(contract.spec?.executionProfile, "long-running-mutation");
  assert.deepEqual(contract.spec?.writes, [...UI_REVIEW_RUNTIME_METADATA.spec.writes]);
  assert.equal(contract.runtimeReference?.path, UI_REVIEW_RUNTIME_METADATA.sourceId);
  assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
    ...UI_REVIEW_RUNTIME_METADATA.requiredTools
  ]);
  assert.deepEqual(contract.skillInputs.effective, [
    "commands/blu-ui-review.toml",
    "skills/blueprint-review/references/ui-review-runtime-contract.md"
  ]);
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(
    commandFile,
    /saved execution and UI-spec coverage, active stage, pending gate, execution mode/i
  );
  assert.match(commandFile, /created, reused, or revised/i);
  assert.match(commandFile, /overall score out of 24/i);
  assert.match(commandFile, /Copywriting, Visual Hierarchy, Color, Typography, Spacing, and Experience Design/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_contract_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_review_authoring_context/);
  assert.match(commandFile, /mcp_blueprint_blueprint_review_validate_model/);
  assert.match(referenceFile, /actual frontend surface/i);
  assert.match(referenceFile, /no-subagent fallback/i);
  assert.match(referenceFile, /browser-only, web-search-only, shell-only, or generic helpers/i);
  assert.match(referenceFile, /retry through `blueprint_review_validate_model` and[\s\S]*`blueprint_review_record`/i);
  assert.match(referenceFile, /1\/4[\s\S]*4\/4/i);
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /Long-running-mutation profile for phase-scoped UI audit/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /saved execution evidence, UI-spec coverage, visual-evidence limits, overwrite confirmation, inline versus blueprint-ui-auditor execution mode, scored findings posture, active stage, and next safe action explicit/i
  );
});

test("review.ui-review contract template carries rich scoring guidance without changing path ownership", () => {
  const contract = readArtifactContract("review.ui-review");

  assert.equal(contract.ownerTool, "blueprint_review_record");
  assert.equal(contract.pathOwner, "blueprint_review_record");
  const renderedHeadings = contract.modelContract?.renderedHeadings ?? [];
  assert.deepEqual(contract.requiredHeadings, renderedHeadings);
  assert.deepEqual(renderedHeadings, [
    "UI Review Summary",
    "Evidence Reviewed",
    "Pillar Scores",
    "Priority Fixes",
    "Findings",
    "Follow-Ups",
    "Audit Trail",
    "Next Safe Action"
  ]);
  assert.match(contract.authoringTemplate, /## Pillar Scores/);
  assert.match(contract.authoringTemplate, /## Priority Fixes/);
  assert.match(contract.authoringTemplate, /## Audit Trail/);
  assert.match(contract.authoringTemplate, /Copywriting/);
  assert.match(contract.authoringTemplate, /Experience Design/);
  assert.match(contract.notes.join("\n"), /scored six-pillar evidence/);
  assert.ok(contract.modelContract);
  assert.equal(
    contract.modelContract?.schemaPath,
    "src/mcp/artifact-contracts/schemas/review.ui-review.model.schema.json"
  );
  assert.match(contract.modelContract?.qualityRules.join("\n") ?? "", /PASS[\s\S]*FOLLOW_UP[\s\S]*BLOCKED/);
});

test("review.ui-review validation rejects truncated markdown missing rendered model sections", () => {
  const truncated = `# Phase 06: UI Audit - UI Review

**Verdict:** FOLLOW_UP

## UI Review Summary

- Dashboard audit needs a follow-up.

## Evidence Reviewed

- .blueprint/phases/06-ui-audit/06-01-SUMMARY.md

## Findings

- Mobile spacing needs polish.

## Follow-Ups

- Tighten mobile spacing.

## Next Safe Action

- /blu-progress
`;

  const validation = validateReviewArtifactContent(truncated, "ui-review");

  assert.equal(validation.valid, false);
  assert.match(validation.issues.join("\n"), /Pillar Scores/);
  assert.match(validation.issues.join("\n"), /Priority Fixes/);
  assert.match(validation.issues.join("\n"), /Audit Trail/);
});

test("blueprint_review_record writes a model-authored phase-scoped UI review artifact with follow-up counts", async (t) => {
  const repoPath = await createUiReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const context = await blueprintReviewAuthoringContext({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review"
  });
  const validation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    model: validUiReviewModel()
  });

  assert.equal(context.status, "ready");
  assert.deepEqual(
    (context.authoringContext as { completedSummaries: string[] }).completedSummaries,
    [".blueprint/phases/06-ui-audit/06-01-SUMMARY.md"]
  );
  assert.deepEqual(
    (context.authoringContext as { completedPlans: Array<{ planId: string; path: string }> }).completedPlans,
    [{ planId: "01", path: ".blueprint/phases/06-ui-audit/06-01-PLAN.md" }]
  );
  assert.deepEqual(
    (context.authoringContext as { dependencyPlans: Array<{ planId: string; path: string }> }).dependencyPlans,
    []
  );
  assert.equal((context.authoringContext as { verification: string | null }).verification, null);
  assert.deepEqual(
    (context.authoringContext as { optionalEvidenceArtifacts: string[] }).optionalEvidenceArtifacts,
    []
  );
  assert.equal(validation.status, "valid", JSON.stringify(validation.diagnostics, null, 2));
  assert.match(validation.renderPreview ?? "", /\*\*Verdict:\*\* FOLLOW_UP/);
  const impossibleNewArtifactPosture = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    model: validUiReviewModel({
      auditTrail: {
        ...(validUiReviewModel().auditTrail as Record<string, unknown>),
        existingReviewPosture: "overwrite-confirmed"
      }
    })
  });
  assert.equal(impossibleNewArtifactPosture.status, "invalid");
  assert.match(
    impossibleNewArtifactPosture.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must be equal to one of the allowed values/i
  );
  const newArtifactSelfCitation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    model: validUiReviewModel({
      pillarScores: [
        {
          ...((validUiReviewModel().pillarScores as Record<string, unknown>[])[0]),
          evidence: ".blueprint/phases/06-ui-audit/06-UI-REVIEW.md"
        },
        ...(validUiReviewModel().pillarScores as Record<string, unknown>[]).slice(1)
      ]
    })
  });
  assert.equal(newArtifactSelfCitation.status, "invalid");
  assert.match(
    newArtifactSelfCitation.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must match a schema in anyOf/i
  );

  const written = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    model: validUiReviewModel()
  });

  assert.equal(written.status, "created");
  assert.equal(written.reportPath, ".blueprint/phases/06-ui-audit/06-UI-REVIEW.md");
  assert.equal(written.counts.findings, 1);
  assert.equal(written.counts.followUps, 1);
  assert.deepEqual(written.followUps, [
    "Tighten mobile empty-state spacing and affordance copy."
  ]);

  const saved = await readFile(path.join(repoPath, written.reportPath), "utf8");
  assert.match(saved, /\*\*Verdict:\*\* FOLLOW_UP/);
  const loadedFindings = await blueprintReviewLoadFindings({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review"
  });
  assert.equal(loadedFindings.found, true);
  assert.equal(loadedFindings.findings.length, 1);
  assert.equal(loadedFindings.severityCounts.medium, 1);
  assert.match(loadedFindings.findings[0].summary, /Spacing OPEN/i);
  assert.match(loadedFindings.findings[0].summary, /Mobile empty states are harder to scan/i);
  assert.ok(
    loadedFindings.followUps.includes("Tighten mobile empty-state spacing and affordance copy.")
  );

  const postWriteContext = await blueprintReviewAuthoringContext({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review"
  });
  const postWriteAuthoringContext = postWriteContext.authoringContext as {
    existingUiReview: string | null;
    knownEvidenceArtifacts: string[];
    optionalEvidenceArtifacts: string[];
  };
  assert.equal(
    postWriteAuthoringContext.existingUiReview,
    ".blueprint/phases/06-ui-audit/06-UI-REVIEW.md"
  );
  assert.ok(
    !postWriteAuthoringContext.knownEvidenceArtifacts.includes(
      ".blueprint/phases/06-ui-audit/06-UI-REVIEW.md"
    ),
    "the overwritten UI review path must not be required as evidence because it would self-cite"
  );
  assert.deepEqual(postWriteAuthoringContext.optionalEvidenceArtifacts, [
    ".blueprint/phases/06-ui-audit/06-UI-REVIEW.md"
  ]);
  const priorReviewCitationModel = validUiReviewModel({
    uiReviewSummary: [
      "The UI review rerun compared the prior UI review with the saved summary baseline and kept the 18/24 follow-up posture."
    ],
    pillarScores: [
      {
        ...((validUiReviewModel().pillarScores as Record<string, unknown>[])[0]),
        evidence: ".blueprint/phases/06-ui-audit/06-UI-REVIEW.md"
      },
      ...(validUiReviewModel().pillarScores as Record<string, unknown>[]).slice(1)
    ],
    auditTrail: {
      ...(validUiReviewModel().auditTrail as Record<string, unknown>),
      existingReviewPosture: "overwrite-confirmed",
      scoreConsistencyNote: "The rerun compared prior UI-review evidence and recomputed the same pillar total."
    }
  });
  const priorReviewCitation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    model: priorReviewCitationModel
  });
  assert.equal(priorReviewCitation.status, "valid", JSON.stringify(priorReviewCitation.diagnostics, null, 2));
  const priorOverwrite = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    overwrite: true,
    model: priorReviewCitationModel
  });
  assert.equal(priorOverwrite.status, "updated");
  const priorSaved = await readFile(path.join(repoPath, priorOverwrite.reportPath), "utf8");
  assert.match(
    priorSaved,
    /## Evidence Reviewed[\s\S]*06-UI-REVIEW\.md - cited by pillar or finding evidence\./
  );
  assert.doesNotMatch(priorSaved, /06-UI-REVIEW\.md - used:/);

  const impossibleExistingReviewPosture = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    model: validUiReviewModel()
  });
  assert.equal(impossibleExistingReviewPosture.status, "invalid");
  assert.match(
    impossibleExistingReviewPosture.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must be equal to one of the allowed values/i
  );

  const changedOverwriteModel = validUiReviewModel({
    uiReviewSummary: [
      "The shipped dashboard still needs a revised mobile empty-state polish pass with the same 18/24 score."
    ],
    auditTrail: {
      ...(validUiReviewModel().auditTrail as Record<string, unknown>),
      existingReviewPosture: "overwrite-confirmed",
      scoreConsistencyNote: "The rerun recomputed the same pillar total."
    }
  });
  const changedButClaimedReused = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    overwrite: true,
    model: validUiReviewModel({
      uiReviewSummary: [
        "The shipped dashboard still needs a revised mobile empty-state polish pass with the same 18/24 score."
      ],
      auditTrail: {
        ...(validUiReviewModel().auditTrail as Record<string, unknown>),
        existingReviewPosture: "reused",
        scoreConsistencyNote: "The rerun recomputed the same pillar total."
      }
    })
  });
  assert.equal(changedButClaimedReused.status, "invalid");
  assert.match(
    changedButClaimedReused.warnings.join("\n"),
    /existingReviewPosture must be "overwrite-confirmed"/
  );

  await assert.rejects(
    () =>
      blueprintReviewRecord({
        cwd: repoPath,
        phase: "6",
        artifact: "ui-review",
        model: changedOverwriteModel
      }),
    /explicit overwrite confirmation/
  );

  const overwritten = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    overwrite: true,
    model: changedOverwriteModel
  });
  assert.equal(overwritten.status, "updated");
  const overwrittenSaved = await readFile(path.join(repoPath, overwritten.reportPath), "utf8");
  assert.doesNotMatch(
    overwrittenSaved,
    /06-UI-REVIEW\.md - used:/,
    "overwritten UI review content must not cite itself as reviewed evidence"
  );

  const artifactList = await blueprintArtifactList({ cwd: repoPath });
  assert.ok(
    artifactList.artifacts.phases.includes(".blueprint/phases/06-ui-audit/06-UI-REVIEW.md")
  );
});

test("ui-review renders repo-line, screenshot, and visual-observation evidence in Evidence Reviewed", async (t) => {
  const repoPath = await createUiReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const base = validUiReviewModel();
  const model = validUiReviewModel({
    pillarScores: (base.pillarScores as Record<string, unknown>[]).map((row, index) =>
      index === 0
        ? { ...row, evidence: "src/ui/dashboard.tsx:1" }
        : index === 1
          ? { ...row, evidence: "screenshot: dashboard-mobile.png" }
          : row
    ),
    findings: (base.findings as Record<string, unknown>[]).map((row) => ({
      ...row,
      evidence: "visual observation: Mobile empty-state gaps collapse on narrow viewport"
    }))
  });

  const written = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    model
  });
  const saved = await readFile(path.join(repoPath, written.reportPath), "utf8");

  assert.equal(written.status, "created");
  assert.match(saved, /## Evidence Reviewed[\s\S]*src\/ui\/dashboard\.tsx:1 - cited by pillar or finding evidence\./);
  assert.match(saved, /## Evidence Reviewed[\s\S]*screenshot: dashboard-mobile\.png - cited by pillar or finding evidence\./);
  assert.match(saved, /## Evidence Reviewed[\s\S]*visual observation: Mobile empty-state gaps collapse on narrow viewport - cited by pillar or finding evidence\./);
  assert.equal((saved.match(/06-UI-SPEC\.md - used:/g) ?? []).length, 1);
});

test("ui-review residual validation rejects fabricated repo-line evidence", async (t) => {
  const repoPath = await createUiReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const withPillarEvidence = (evidence: string): Record<string, unknown> =>
    validUiReviewModel({
      pillarScores: [
        {
          ...((validUiReviewModel().pillarScores as Record<string, unknown>[])[0]),
          evidence
        },
        ...(validUiReviewModel().pillarScores as Record<string, unknown>[]).slice(1)
      ]
    });
  const withFindingEvidence = (evidence: string): Record<string, unknown> =>
    validUiReviewModel({
      findings: (validUiReviewModel().findings as Record<string, unknown>[]).map((row) => ({
        ...row,
        evidence
      }))
    });

  const missingFile = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    model: withPillarEvidence("src/ui/missing.tsx:1")
  });
  const escapedPath = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    model: withPillarEvidence("../outside.tsx:1")
  });
  const outOfRange = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    model: withFindingEvidence("src/ui/dashboard.tsx:99")
  });

  assert.equal(missingFile.status, "invalid");
  assert.match(
    missingFile.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /file that does not exist/i
  );
  assert.equal(escapedPath.status, "invalid");
  assert.match(
    escapedPath.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /Path traversal is not allowed/i
  );
  assert.equal(outOfRange.status, "invalid");
  assert.match(
    outOfRange.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /line range exceeds/i
  );
});

test("ui-review authoring context exposes plan dependency and verification provenance", async (t) => {
  const repoPath = await createUiReviewRepo();
  const phaseDir = path.join(repoPath, ".blueprint/phases/06-ui-audit");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeFile(path.join(phaseDir, "06-02-PLAN.md"), uiReviewPlanContent("02", ["01"], 2), "utf8");
  await writeFile(path.join(phaseDir, "06-02-SUMMARY.md"), validSummaryContent("02"), "utf8");
  await writeFile(
    path.join(phaseDir, "06-VERIFICATION.md"),
    "# Phase 06: UI Audit - Verification\n\n## Verification Summary\n\n- Focused validation passed.\n",
    "utf8"
  );

  const context = await blueprintReviewAuthoringContext({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review"
  });
  assert.equal(context.status, "ready", context.reason ?? "");
  assert.ok(context.taskSchema);
  const authoringContext = context.authoringContext as {
    completedPlans: Array<{ planId: string; path: string }>;
    dependencyPlans: Array<{ planId: string; path: string }>;
    verification: string | null;
    knownEvidenceArtifacts: string[];
  };
  const runtimeContext = (context.taskSchema as Record<string, unknown>)["x-blueprint-runtimeContext"] as {
    completedPlans: Array<{ planId: string; path: string }>;
    dependencyPlans: Array<{ planId: string; path: string }>;
    verificationArtifact: string | null;
  };

  assert.deepEqual(authoringContext.completedPlans, [
    { planId: "01", path: ".blueprint/phases/06-ui-audit/06-01-PLAN.md" },
    { planId: "02", path: ".blueprint/phases/06-ui-audit/06-02-PLAN.md" }
  ]);
  assert.deepEqual(authoringContext.dependencyPlans, [
    { planId: "01", path: ".blueprint/phases/06-ui-audit/06-01-PLAN.md" }
  ]);
  assert.equal(authoringContext.verification, ".blueprint/phases/06-ui-audit/06-VERIFICATION.md");
  assert.ok(
    authoringContext.knownEvidenceArtifacts.includes(".blueprint/phases/06-ui-audit/06-VERIFICATION.md")
  );
  assert.deepEqual(runtimeContext.completedPlans, authoringContext.completedPlans);
  assert.deepEqual(runtimeContext.dependencyPlans, authoringContext.dependencyPlans);
  assert.equal(runtimeContext.verificationArtifact, authoringContext.verification);
});

test("workflow.no_uat lets ui-review route missing UAT to progress", async (t) => {
  const repoPath = await createUiReviewRepo();
  const phaseDir = path.join(repoPath, ".blueprint/phases/06-ui-audit");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    JSON.stringify(
      {
        version: 2,
        workflow: {
          no_uat: true
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "06-VERIFICATION.md"),
    "# Phase 06: UI Audit - Verification\n\n## Verification Summary\n\n- Focused validation passed.\n",
    "utf8"
  );

  const context = await blueprintReviewAuthoringContext({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review"
  });
  const authoringContext = context.authoringContext as {
    completedNextSafeAction: string;
    allowedNextActions: string[];
  };

  assert.equal(context.status, "ready", context.reason ?? "");
  assert.equal(authoringContext.completedNextSafeAction, "/blu-progress");
  assert.ok(authoringContext.allowedNextActions.includes("/blu-progress"));
  assert.equal(authoringContext.allowedNextActions.includes("/blu-verify-work 6"), false);
});

test("workflow.no_uat keeps ui-review routing on saved blocking UAT repair", async (t) => {
  const repoPath = await createUiReviewRepo();
  const phaseDir = path.join(repoPath, ".blueprint/phases/06-ui-audit");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    JSON.stringify(
      {
        version: 2,
        workflow: {
          no_uat: true
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "06-VERIFICATION.md"),
    "# Phase 06: UI Audit - Verification\n\n## Verification Summary\n\n- Focused validation passed.\n",
    "utf8"
  );
  await writeFile(path.join(phaseDir, "06-UAT.md"), partialUatContent("/blu-audit-fix 6"), "utf8");

  const context = await blueprintReviewAuthoringContext({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review"
  });
  const authoringContext = context.authoringContext as {
    completedNextSafeAction: string;
    followUpNextSafeAction: string;
    allowedNextActions: string[];
  };
  const blockingEvidenceCoverage = {
    ...((validUiReviewModel().evidenceCoverage as Record<string, unknown>) ?? {}),
    ".blueprint/phases/06-ui-audit/06-VERIFICATION.md": {
      status: "used",
      rationale: "Verification evidence is part of the saved blocking UAT chain."
    },
    ".blueprint/phases/06-ui-audit/06-UAT.md": {
      status: "used",
      rationale: "Saved partial UAT evidence keeps the repair route authoritative."
    }
  };
  const invalidProgress = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    model: validUiReviewModel({
      evidenceCoverage: blockingEvidenceCoverage,
      nextSafeAction: "/blu-progress"
    })
  });
  const validRepairRoute = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    model: validUiReviewModel({
      evidenceCoverage: blockingEvidenceCoverage,
      nextSafeAction: "/blu-audit-fix 6"
    })
  });

  assert.equal(context.status, "ready", context.reason ?? "");
  assert.equal(authoringContext.completedNextSafeAction, "/blu-audit-fix 6");
  assert.equal(authoringContext.followUpNextSafeAction, "/blu-audit-fix 6");
  assert.ok(authoringContext.allowedNextActions.includes("/blu-audit-fix 6"));
  assert.equal(invalidProgress.status, "invalid");
  assert.match(
    invalidProgress.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /\/blu-audit-fix 6|must be equal to constant/i
  );
  assert.equal(validRepairRoute.status, "valid", JSON.stringify(validRepairRoute.diagnostics, null, 2));
});

test("ui-review rejects Markdown fallback for the model-only writer", async (t) => {
  const repoPath = await createUiReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const written = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    content: "# Phase 06: UI Audit - UI Review\n"
  });

  assert.equal(written.status, "invalid");
  assert.match(written.warnings.join("\n"), /model-only|content is invalid/i);
});

test("ui-review task schema rejects unsupported fields, missing required fields, stale evidence, and unsafe sink text", async (t) => {
  const repoPath = await createUiReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const unsupported = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    model: validUiReviewModel({ reportPath: ".blueprint/phases/06-ui-audit/06-UI-REVIEW.md" })
  });
  const missing = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    model: {
      ...validUiReviewModel(),
      pillarScores: undefined
    }
  });
  const staleEvidence = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    model: validUiReviewModel({
      evidenceCoverage: {
        ".blueprint/phases/06-ui-audit/06-01-SUMMARY.md": {
          status: "used",
          rationale: "Completed summary evidence identifies the implemented dashboard surface."
        }
      }
    })
  });
  const unsafe = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    model: validUiReviewModel({
      pillarScores: [
        ...((validUiReviewModel().pillarScores as Record<string, unknown>[]).slice(0, 1).map((row) => ({
          ...row,
          keyFinding: "unsafe | table cell"
        }))),
        ...(validUiReviewModel().pillarScores as Record<string, unknown>[]).slice(1)
      ]
    })
  });

  assert.equal(unsupported.status, "invalid");
  assert.match(
    unsupported.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must NOT have additional properties/i
  );
  assert.equal(missing.status, "invalid");
  assert.match(
    missing.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must have required property 'pillarScores'|must be array/i
  );
  assert.equal(staleEvidence.status, "invalid");
  assert.match(
    staleEvidence.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /06-UI-SPEC\.md|required property/i
  );
  assert.equal(unsafe.status, "invalid");
  assert.match(
    unsafe.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must match pattern/i
  );
});

test("ui-review blocks missing completed summaries before authoring", async (t) => {
  const repoPath = await createUiReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await rm(path.join(repoPath, ".blueprint/phases/06-ui-audit/06-01-SUMMARY.md"));

  const context = await blueprintReviewAuthoringContext({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review"
  });
  const validation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    model: validUiReviewModel()
  });

  assert.equal(context.status, "invalid");
  assert.equal(context.taskSchema, null);
  assert.match(context.reason ?? "", /no valid completed SUMMARY artifacts/i);
  assert.equal(validation.status, "invalid");
  assert.match(
    validation.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /no valid completed SUMMARY artifacts/i
  );
});

test("ui-review runtime narrowing rejects PASS while plans remain pending", async (t) => {
  const repoPath = await createUiReviewRepo();
  const phaseDir = path.join(repoPath, ".blueprint/phases/06-ui-audit");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeFile(path.join(phaseDir, "06-02-PLAN.md"), uiReviewPlanContent("02"), "utf8");

  const context = await blueprintReviewAuthoringContext({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review"
  });
  const taskSchemaText = JSON.stringify(context.taskSchema);
  const passModel = validUiReviewModel({
    verdict: "PASS",
    readiness: "ready-for-routing",
    completionState: "complete",
    overallScore: 21,
    pillarScores: (validUiReviewModel().pillarScores as Record<string, unknown>[]).map((row) => ({
      ...row,
      score: row.pillar === "Spacing" ? 3 : row.score
    })),
    priorityFixes: [
      {
        item: "none",
        userImpact: "none",
        repair: "none",
        status: "NONE"
      }
    ],
    findings: [
      {
        pillar: "none",
        severity: "none",
        evidence: "none",
        userImpact: "none",
        recommendation: "none",
        status: "NONE"
      }
    ],
    followUps: ["none"],
    nextSafeAction: "/blu-validate-phase 6"
  });
  const validation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    model: passModel
  });

  assert.equal(context.status, "ready");
  assert.match(taskSchemaText, /"enum":\["FOLLOW_UP","BLOCKED"\]/);
  assert.equal(validation.status, "invalid");
  assert.match(
    validation.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must be equal to one of the allowed values/i
  );
});

test("ui-review is exposed as an implemented review command with the registered review tool", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["ui-review"];

  assert.ok(blueprintToolNames.includes("blueprint_review_record"));
  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.manifestPath, "commands/blu-ui-review.toml");
  assert.deepEqual(entry.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_artifact_list",
    "blueprint_artifact_contract_read",
    "blueprint_config_get",
    "blueprint_review_authoring_context",
    "blueprint_review_validate_model",
    "blueprint_review_record"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-ui-auditor"]);
});
