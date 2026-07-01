import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { blueprintPhaseValidationWrite } from "../src/mcp/tools/phase.js";
import { blueprintProjectStatus } from "../src/mcp/tools/project.js";
import {
  buildPhaseQualityGateNextAction,
  evaluatePhaseQualityGates,
  formatPhaseQualityGateDebtReason
} from "../src/mcp/tools/quality-gates.js";
import { blueprintStateLoad, blueprintStateSync } from "../src/mcp/tools/state.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

type PhaseFixture = {
  phase: number;
  title: string;
  slug: string;
  completed: boolean;
  withContext?: boolean;
  withPlan?: boolean;
  withSummary?: boolean;
  withVerification?: boolean;
  withUat?: boolean;
  withUiSpec?: boolean;
  withUiReview?: boolean;
  withReview?: boolean;
  withReviewFix?: boolean;
  withSecurity?: boolean;
  uiSpecMode?: "contract" | "skip-rationale";
  reviewVerdict?: "PASS" | "FOLLOW_UP" | "BLOCKED";
  uiReviewVerdict?: "PASS" | "FOLLOW_UP" | "BLOCKED";
  reviewNextSafeAction?: string;
  uiReviewNextSafeAction?: string;
  reviewFixStatus?: "COMPLETED" | "PARTIAL" | "BLOCKED";
  reviewFixCompletionState?: "complete" | "pending" | "blocked";
  reviewFixNextSafeAction?: string;
  securityStatus?: "COMPLETED" | "PARTIAL" | "BLOCKED";
  securityCompletionState?: "complete" | "partial" | "blocked" | "pending";
  securityNextSafeAction?: string;
  securityOpenThreat?: boolean;
  securityPendingOpenThreatStatus?: string;
  reviewFindings?: string[];
  reviewFollowUps?: string[];
  reviewFixFindingsAddressed?: string[];
  planModifiedFiles?: string[];
  summaryChangedFiles?: string[];
  summaryOutcomeLines?: string[];
};

const modifiedFiles = [
  "src/feature.ts",
  "src/main/java/com/example/Feature.java",
  "scripts/tool.mjs"
];

function phasePrefix(phase: number): string {
  return String(phase).padStart(2, "0");
}

function phaseDirectoryName(phase: PhaseFixture): string {
  return `${phasePrefix(phase.phase)}-${phase.slug}`;
}

function phaseTitle(phase: PhaseFixture): string {
  return `Phase ${phasePrefix(phase.phase)}: ${phase.title}`;
}

function phaseArtifactPath(phase: PhaseFixture, suffix: string): string {
  return `.blueprint/phases/${phaseDirectoryName(phase)}/${phasePrefix(phase.phase)}${suffix}`;
}

function planContent(phase: PhaseFixture): string {
  const filesModified = phase.planModifiedFiles ?? modifiedFiles;

  return `---
phase: ${phase.phase}
plan_id: "01"
title: "${phase.title} Plan 01"
wave: 1
status: done
objective: "Deliver the quality-gated delivery increment."
depends_on: []
requirements:
  - QG-01
files_modified:
${filesModified.map((file) => `  - ${file}`).join("\n")}
read_first:
  - src/feature.ts
acceptance_criteria:
  - tests/quality-gate-routing.test.ts exits 0
autonomous: true
---

# ${phaseTitle(phase)} - Plan 01

## Goal

Deliver the quality-gated delivery increment.

## Scope

- Change source, Java, and repo runtime files that require post-UAT quality gates.

## Tasks

### Task 1: Deliver quality-gated code changes

#### Read First

- src/feature.ts

#### Action

- Implement the source, Java, and repo runtime changes for the phase.

#### Acceptance Criteria

- tests/quality-gate-routing.test.ts exits 0

## Verification

- Run the focused quality-gate routing tests.

## Must Haves

- UAT completion must not bypass mandatory review and security gates.

## Requirement Coverage

| Requirement | Planned Coverage | Evidence |
| --- | --- | --- |
| QG-01 | Cover mandatory post-UAT quality gates for changed code files. | tests/quality-gate-routing.test.ts exits 0 |

## Evidence Coverage

| Evidence | How It Will Be Produced | Owner |
| --- | --- | --- |
| Source, Java, and repo code changes | Saved execution summary and quality gates. | Blueprint tests |

## File / Surface Coverage

| File / Surface | Expected Change | Verification |
| --- | --- | --- |
${filesModified.map((file) => `| ${file} | Quality-gated fixture change. | Focused routing regression tests |`).join("\n")}

## Unknowns And Deferrals

| Unknown / Deferral | Handling | Follow-Up |
| --- | --- | --- |
| none | none | none |
`;
}

function summaryContent(phase: PhaseFixture): string {
  const changedFiles = phase.summaryChangedFiles ?? modifiedFiles;
  const outcomeLines = phase.summaryOutcomeLines ?? [
    "- Execution completed and produced source, Java, and repo runtime changes."
  ];

  return `# ${phaseTitle(phase)} - Summary 01

**Plan:** \`${phasePrefix(phase.phase)}-01-PLAN.md\`
**Status:** COMPLETED
**Readiness:** ready-for-validation
**Completion State:** complete
**Next Safe Action:** /blu-validate-phase ${phase.phase}

## Outcome

${outcomeLines.join("\n")}

## Changes Made

${changedFiles.map((file) => `- Updated \`${file}\`.`).join("\n")}

## Verification

| Check | Command | Result | Evidence | Notes |
|-------|---------|--------|----------|-------|
| tests/quality-gate-routing.test.ts exits 0 | npx tsx --test tests/quality-gate-routing.test.ts | pass | Saved summary fixture. | The selected acceptance criterion passed. |

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
| artifact | ${phaseArtifactPath(phase, "-01-SUMMARY.md")} | Saved summary artifact. |
`;
}

function verificationContent(phase: PhaseFixture): string {
  return `# ${phaseTitle(phase)} - Verification

**Coverage:** Reviewed \`${phasePrefix(phase.phase)}-01-SUMMARY.md\` for the completed quality-gated plan.
**Gate State:** PASS
**Sign-off:** verified by the Blueprint verifier

## Validation Summary

- The validated implementation is ready for UAT.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| QG-01 | Confirm source, Java, and repo code changes are covered. | ${phaseArtifactPath(phase, "-01-SUMMARY.md")} | PASS | Summary evidence is complete. |

## Evidence Reviewed

- ${phaseArtifactPath(phase, "-01-SUMMARY.md")}

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
- Sign-off: verified
- Readiness: ready for UAT

## Gap Classification

| Gap class | Scope | Evidence | Repair |
|-----------|-------|----------|--------|
| none | none | none | none |

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- Continue with \`/blu-verify-work ${phase.phase}\`.
`;
}

function uatContent(phase: PhaseFixture): string {
  return `# ${phaseTitle(phase)} - UAT

**Status:** PASS
**Resume State:** NEW
**Checkpoint:** none

## UAT Summary

- The user acceptance run passed against \`${phaseArtifactPath(phase, "-01-SUMMARY.md")}\` with ready verification evidence.

## Session State

- Resume source: \`${phaseArtifactPath(phase, "-01-SUMMARY.md")}\`
- Current session step: Close the UAT pass.
- Continuity notes: Keep the quality-gated behavior stable if the session resumes.

## Current Test

- Number: testing complete
- Name: none
- Expected: Keep the quality-gated behavior stable.
- Awaiting: none

## Test Matrix

| # | Test | Expected Behavior | Evidence | Result | Notes |
|---|------|-------------------|----------|--------|-------|
| 1 | Quality gate UAT smoke | Keep the quality-gated behavior stable. | ${phaseArtifactPath(phase, "-01-SUMMARY.md")} | pass | none |

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

- The observed behavior matched \`${phaseArtifactPath(phase, "-01-SUMMARY.md")}\` with ready verification evidence.

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
`;
}

function blockingUatContent(
  phase: PhaseFixture,
  nextSafeAction = `/blu-verify-work ${phase.phase}`
): string {
  return uatContent(phase)
    .replace("**Status:** PASS", "**Status:** PARTIAL")
    .replace("**Resume State:** NEW", "**Resume State:** RESUMED")
    .replace("**Checkpoint:** none", "**Checkpoint:** resume-uat-follow-up")
    .replace("- Number: testing complete", "- Number: 1")
    .replace("- Name: none", "- Name: Quality gate UAT smoke")
    .replace("- Awaiting: none", "- Awaiting: follow-up review")
    .replace(
      "| 1 | Quality gate UAT smoke | Keep the quality-gated behavior stable. | .blueprint/phases/01-quality-gate/01-01-SUMMARY.md | pass | none |",
      "| 1 | Quality gate UAT smoke | Keep the quality-gated behavior stable. | .blueprint/phases/01-quality-gate/01-01-SUMMARY.md | issue | Follow-up review remains open. |"
    )
    .replace("- Passed: 1", "- Passed: 0")
    .replace("- Issues: 0", "- Issues: 1")
    .replace("- none\n\n## Structured Gaps", "- One UAT follow-up remains open.\n\n## Structured Gaps")
    .replace(
      "| none | none | none | none | none | none |",
      `| 1 | Keep the quality-gated behavior stable. | partial | major | Follow-up review remains open. | Resume \`${nextSafeAction}\` after repair. |`
    )
    .replace("- none\n\n## Follow-Up Fixes", `- Resume \`${nextSafeAction}\` after repair.\n\n## Follow-Up Fixes`)
    .replace("- none\n\n## Next Safe Action", `- Resume \`${nextSafeAction}\` after repair.\n\n## Next Safe Action`)
    .replace("- Return to `/blu-progress` for the next safe implemented action.", `- Continue with \`${nextSafeAction}\`.`);
}

function malformedPassUatContent(phase: PhaseFixture): string {
  return uatContent(phase).replace("**Checkpoint:** none", "**Checkpoint:** resume-uat-follow-up");
}

function uiSpecContent(phase: PhaseFixture): string {
  if (phase.uiSpecMode === "skip-rationale") {
    return `# ${phaseTitle(phase)} - UI Spec

## Outcome Mode

- Explicit skip rationale

## Rationale

- No frontend surface changes are in scope for this phase.
`;
  }

  return `# ${phaseTitle(phase)} - UI Spec

## Outcome Mode

- UI Contract

## Contract

- Preserve the shipped frontend hierarchy across desktop and mobile breakpoints.
`;
}

function reviewContent(phase: PhaseFixture): string {
  const verdict = phase.reviewVerdict ?? "PASS";
  const isFollowUp = verdict === "FOLLOW_UP";
  const isBlocked = verdict === "BLOCKED";
  const summaryLine = isFollowUp
    ? "- The changed source, Java, and repo runtime files were reviewed with one follow-up finding pending remediation."
    : isBlocked
      ? "- The changed source, Java, and repo runtime files were reviewed, but one finding remains blocked on follow-up repair or validation."
      : "- The changed source, Java, and repo runtime files were reviewed with no follow-up findings.";
  const findingsRow = isFollowUp
    ? "| high | follow-up | src/feature.ts:1 | Missing guard for invalid input remains in the implementation. | Invalid input can still be treated as successful behavior. | Apply the saved fix and rerun focused validation. |"
    : isBlocked
      ? "| high | blocked | src/feature.ts:1 | The changed behavior still lacks required proof after review. | Advancing would rely on unverified behavior. | Repair or validate the blocked review finding before proceeding. |"
      : "| none | none | none | none | none | none |";
  const followUpLine = isFollowUp
    ? "- Apply the saved code-review remediation before phase closeout."
    : isBlocked
      ? "- Repair or validate the blocked review finding before phase closeout."
      : "- none";
  const findingsSection =
    phase.reviewFindings?.length
      ? phase.reviewFindings.map((item) => `- ${item}`).join("\n")
      : `| Severity | Disposition | Location | Evidence | Impact | Recommendation |
|----------|-------------|----------|----------|--------|----------------|
${findingsRow}`;
  const followUpsSection =
    phase.reviewFollowUps?.length
      ? phase.reviewFollowUps.map((item) => `- ${item}`).join("\n")
      : followUpLine;

  return `# ${phaseTitle(phase)} - Code Review

**Verdict:** ${verdict}
**Readiness:** ready-for-security

## Review Summary

${summaryLine}

## Positive Signals

- Saved plan, summary, verification, and UAT evidence are aligned.

## Findings

${findingsSection}

## Evidence Coverage

| Evidence | Status | Rationale |
|----------|--------|-----------|
| ${phaseArtifactPath(phase, "-01-PLAN.md")} | used | The plan declares changed code files. |
| ${phaseArtifactPath(phase, "-01-SUMMARY.md")} | used | The summary records completed implementation evidence. |
| ${phaseArtifactPath(phase, "-VERIFICATION.md")} | used | Verification passed before UAT. |
| ${phaseArtifactPath(phase, "-UAT.md")} | used | UAT passed before review routing. |

## Follow-Ups

${followUpsSection}

## Next Safe Action

- ${phase.reviewNextSafeAction ?? "/blu-progress"}
`;
}

function reviewFixContent(phase: PhaseFixture): string {
  const status = phase.reviewFixStatus ?? "COMPLETED";
  const readiness =
    status === "PARTIAL"
      ? "not-ready-for-validation"
      : status === "BLOCKED"
        ? "blocked"
        : "ready-for-validation";
  const completionState = phase.reviewFixCompletionState ?? "complete";
  const nextSafeAction = phase.reviewFixNextSafeAction ?? `/blu-validate-phase ${phase.phase}`;
  const findingsAddressedSection =
    phase.reviewFixFindingsAddressed?.length
      ? phase.reviewFixFindingsAddressed.map((item) => `- ${item}`).join("\n")
      : "- QG-REVIEW-001 fixed.";

  return `# ${phaseTitle(phase)} - Review Fix

**Status:** ${status}
**Readiness:** ${readiness}
**Completion State:** ${completionState}
**Source Review:** ${phaseArtifactPath(phase, "-REVIEW.md")}
**Next Safe Action:** ${nextSafeAction}

## Remediation Summary

- The selected saved review finding was fixed and verified.

## Findings Addressed

${findingsAddressedSection}

## Changes Made

| File | Summary |
|------|---------|
| src/feature.ts | Applied the review remediation. |

## Verification

| Check | Command | Result | Evidence |
|-------|---------|--------|----------|
| focused quality-gate test | npm exec -- tsx --test tests/quality-gate-routing.test.ts | pass | Saved review-fix fixture. |

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
| review | ${phaseArtifactPath(phase, "-REVIEW.md")} | Saved review findings baseline. |

## Next Safe Action

- ${nextSafeAction}
`;
}

function securityContent(phase: PhaseFixture): string {
  const status = phase.securityStatus ?? "COMPLETED";
  const completionState = phase.securityCompletionState ?? "complete";
  const nextSafeAction = phase.securityNextSafeAction ?? "/blu-progress";
  const hasOpenThreat = phase.securityOpenThreat ?? status === "BLOCKED";
  const summaryLine =
    status === "COMPLETED"
      ? "- The changed code files have no open threat mitigation follow-ups."
      : status === "PARTIAL"
        ? "- The changed code files still have security follow-up work before closeout."
        : "- The changed code files still have an open threat blocking closeout.";
  const threatRegisterRow = hasOpenThreat
    ? `| T-01 | ${phaseArtifactPath(phase, "-01-PLAN.md")} | data-integrity | src/feature.ts | unaccepted | Saved mitigation evidence required. | open | Missing saved mitigation evidence for the declared threat. | Open threat blocks next-step routing. |`
    : "| none | none | none | none | none | none | none | none | none |";
  const findingsRow =
    status === "COMPLETED"
      ? "| none | none | none | none | none | none |"
      : status === "PARTIAL"
        ? "| hardening-follow-up | low | T-01 | follow-up | Saved security evidence is incomplete. | Finish the saved repair route. |"
        : "| open-threat | high | T-01 | open | Missing saved mitigation evidence for the declared threat. | Verify or accept the open threat. |";
  const manualWorkRow =
    status === "COMPLETED"
      ? "| none | none | none | NONE |"
      : `| Security follow-up | Saved security evidence is ${status.toLowerCase()}. | ${nextSafeAction} | DEFERRED |`;
  const gapRouteRow =
    status === "COMPLETED"
      ? "| none | none | none | NONE |"
      : `| Security closeout | Saved security evidence is ${status.toLowerCase()}. | ${nextSafeAction} | OPEN |`;
  const followUpLine =
    status === "COMPLETED"
      ? "- none"
      : `- Continue with \`${nextSafeAction}\` before claiming security closeout.`;
  const pendingOpenThreatStatus =
    phase.securityPendingOpenThreatStatus ?? (hasOpenThreat ? "still-open" : "none");
  const verifierNote = hasOpenThreat
    ? "Open threat blocks next-step routing."
    : status === "COMPLETED"
      ? "no open security follow-up remains."
      : "security follow-up remains open.";

  return `# ${phaseTitle(phase)} - Security

**Status:** ${status}
**Readiness:** ${status === "COMPLETED" ? "ready-for-routing" : status === "PARTIAL" ? "needs-follow-up" : "blocked"}
**Completion State:** ${completionState}
**Next Safe Action:** ${nextSafeAction}

## Security Summary

${summaryLine}

## Evidence Reviewed

| Evidence | Status | Rationale |
|----------|--------|-----------|
| ${phaseArtifactPath(phase, "-01-PLAN.md")} | used | The plan declares the changed code files. |
| ${phaseArtifactPath(phase, "-01-SUMMARY.md")} | used | The summary records completed implementation evidence. |
| ${phaseArtifactPath(phase, "-REVIEW.md")} | used | The saved review gate passed before security routing. |

## Threat Register

| Threat ID | Source Plan | Category | Component | Disposition | Mitigation | Status | Evidence | Verifier Note |
|-----------|-------------|----------|-----------|-------------|------------|--------|----------|---------------|
${threatRegisterRow}

## Accepted Risks

| Threat ID | Rationale | Accepted By | Accepted At | Evidence |
|-----------|-----------|-------------|-------------|----------|
| none | none | none | none | none |

## Findings

| Kind | Severity | Threat ID | Status | Evidence | Recommendation |
|------|----------|-----------|--------|----------|----------------|
${findingsRow}

## Manual / Deferred Work

| Item | Reason | Follow-Up | Status |
|------|--------|-----------|--------|
${manualWorkRow}

## Gap / Repair Routes

| Gap | Evidence | Repair | Status |
|-----|----------|--------|--------|
${gapRouteRow}

## Follow-Ups

${followUpLine}

## Security Audit Trail

- Audit date: 2026-05-07
- Execution mode: inline
- Overwrite gate: not-needed
- Verify-or-accept decision: verified
- Pending-open-threat status: ${pendingOpenThreatStatus}
- Verifier note: ${verifierNote}

## Next Safe Action

- ${nextSafeAction}
`;
}

function uiReviewContent(phase: PhaseFixture): string {
  const verdict = phase.uiReviewVerdict ?? "PASS";
  const nextSafeAction = phase.uiReviewNextSafeAction ?? "/blu-progress";
  const summaryLine =
    verdict === "PASS"
      ? "- The shipped UI work satisfies the saved phase UI contract."
      : verdict === "FOLLOW_UP"
        ? "- The shipped UI work has a follow-up finding that must be repaired before closeout."
        : "- The shipped UI work has a blocking UI review finding before closeout.";
  const findingsRow =
    verdict === "PASS"
      ? `| hierarchy | pass | ${phaseArtifactPath(phase, "-UI-SPEC.md")} | The responsive hierarchy matches the saved UI contract. |`
      : verdict === "FOLLOW_UP"
        ? `| hierarchy | follow-up | ${phaseArtifactPath(phase, "-UI-SPEC.md")} | Repair the saved UI hierarchy follow-up before closeout. |`
        : `| hierarchy | blocked | ${phaseArtifactPath(phase, "-UI-SPEC.md")} | Blocking UI evidence must be repaired before closeout. |`;

  return `# ${phaseTitle(phase)} - UI Review

**Verdict:** ${verdict}
**Readiness:** ${verdict === "PASS" ? "ready-for-closeout" : verdict === "FOLLOW_UP" ? "needs-follow-up" : "blocked"}

## Review Summary

${summaryLine}

## Evidence Coverage

| Evidence | Status | Rationale |
|----------|--------|-----------|
| ${phaseArtifactPath(phase, "-UI-SPEC.md")} | used | The phase UI contract defines the surface under audit. |
| ${phaseArtifactPath(phase, "-UAT.md")} | used | UAT confirms the audited UI state is the shipped behavior. |

## Findings

| Pillar | Result | Evidence | Notes |
|--------|--------|----------|-------|
${findingsRow}

## Next Safe Action

- ${nextSafeAction}
`;
}

async function writeCodebaseMapping(repoPath: string): Promise<void> {
  const codebaseDir = path.join(repoPath, ".blueprint/codebase");

  await mkdir(codebaseDir, { recursive: true });

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
}

async function writePhaseArtifacts(repoPath: string, phase: PhaseFixture): Promise<void> {
  const phaseDir = path.join(repoPath, ".blueprint/phases", phaseDirectoryName(phase));

  await mkdir(phaseDir, { recursive: true });

  if (phase.withContext) {
    await writeFile(
      path.join(phaseDir, `${phasePrefix(phase.phase)}-CONTEXT.md`),
      `# ${phaseTitle(phase)} - Context\n\n## Goal\n\n- Deliver the quality-gated fixture phase.\n`,
      "utf8"
    );
  }

  if (phase.withPlan) {
    await writeFile(
      path.join(phaseDir, `${phasePrefix(phase.phase)}-01-PLAN.md`),
      planContent(phase),
      "utf8"
    );
  }

  if (phase.withSummary) {
    await writeFile(
      path.join(phaseDir, `${phasePrefix(phase.phase)}-01-SUMMARY.md`),
      summaryContent(phase),
      "utf8"
    );
  }

  if (phase.withVerification) {
    await writeFile(
      path.join(phaseDir, `${phasePrefix(phase.phase)}-VERIFICATION.md`),
      verificationContent(phase),
      "utf8"
    );
  }

  if (phase.withUat) {
    await writeFile(
      path.join(phaseDir, `${phasePrefix(phase.phase)}-UAT.md`),
      uatContent(phase),
      "utf8"
    );
  }

  if (phase.withUiSpec) {
    await writeFile(
      path.join(phaseDir, `${phasePrefix(phase.phase)}-UI-SPEC.md`),
      uiSpecContent(phase),
      "utf8"
    );
  }

  if (phase.withReview) {
    await writeFile(
      path.join(phaseDir, `${phasePrefix(phase.phase)}-REVIEW.md`),
      reviewContent(phase),
      "utf8"
    );
  }

  if (phase.withReviewFix) {
    await writeFile(
      path.join(phaseDir, `${phasePrefix(phase.phase)}-REVIEW-FIX.md`),
      reviewFixContent(phase),
      "utf8"
    );
  }

  if (phase.withSecurity) {
    await writeFile(
      path.join(phaseDir, `${phasePrefix(phase.phase)}-SECURITY.md`),
      securityContent(phase),
      "utf8"
    );
  }

  if (phase.withUiReview) {
    await writeFile(
      path.join(phaseDir, `${phasePrefix(phase.phase)}-UI-REVIEW.md`),
      uiReviewContent(phase),
      "utf8"
    );
  }
}

async function createQualityGateRepo(options: {
  phases: PhaseFixture[];
  currentPhase?: number;
  configPatch?: Record<string, unknown>;
}): Promise<string> {
  const repoPath = await createGitRepo("blueprint-quality-gates-");
  const currentPhase =
    options.currentPhase ??
    options.phases.find((phase) => !phase.completed)?.phase ??
    options.phases.at(-1)?.phase ??
    1;

  await mkdir(path.join(repoPath, ".blueprint/phases"), { recursive: true });
  await mkdir(path.join(repoPath, "src/main/java/com/example"), { recursive: true });
  await mkdir(path.join(repoPath, "scripts"), { recursive: true });
  await writeFile(path.join(repoPath, "src/feature.ts"), "export const featureValue = 42;\n", "utf8");
  await writeFile(
    path.join(repoPath, "src/main/java/com/example/Feature.java"),
    "package com.example;\n\npublic final class Feature {}\n",
    "utf8"
  );
  await writeFile(path.join(repoPath, "scripts/tool.mjs"), "export const tool = true;\n", "utf8");
  await writeCodebaseMapping(repoPath);
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Quality Gate Fixture

## Milestone

- Active milestone: v1

## Phases

${options.phases.map((phase) => `- [${phase.completed ? "x" : " "}] **Phase ${phase.phase}: ${phase.title}** - ${phase.title}`).join("\n")}

## Phase Details

${options.phases.map((phase) => `### Phase ${phase.phase}: ${phase.title}
**Goal**: ${phase.title}
**Requirements**: QG-01
**Status**: ${phase.completed ? "completed" : "planned"}`).join("\n\n")}
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: ${currentPhase}
- Active command: /blu-progress
- Next action: Run /blu-progress
- Last updated: 2026-05-07T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  const configPatch = options.configPatch ?? {};
  const workflowPatch =
    typeof configPatch.workflow === "object" &&
    configPatch.workflow !== null &&
    !Array.isArray(configPatch.workflow)
      ? configPatch.workflow as Record<string, unknown>
      : {};
  const config = {
    version: 2,
    ...configPatch,
    workflow: {
      research: false,
      ui_phase: false,
      ...workflowPatch
    }
  };

  await writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8"
  );

  for (const phase of options.phases) {
    await writePhaseArtifacts(repoPath, phase);
  }

  return repoPath;
}

async function writeRepoFile(repoPath: string, relativePath: string, content: string): Promise<void> {
  const absolutePath = path.join(repoPath, relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

function implementedPhase(overrides: Partial<PhaseFixture> = {}): PhaseFixture {
  return {
    phase: 1,
    title: "Quality Gate",
    slug: "quality-gate",
    completed: false,
    withContext: true,
    withPlan: true,
    withSummary: true,
    withVerification: true,
    withUat: true,
    ...overrides
  };
}

test("UAT-complete code changes without REVIEW route to code-review before completion", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [implementedPhase()]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-code-review 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-audit-milestone|\/blu-discuss-phase 2/);
});

test("workflow.no_uat routes ready verification to quality gates instead of verify-work", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        withUat: false
      })
    ],
    configPatch: {
      workflow: {
        no_uat: true
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-code-review 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-verify-work 1/);
});

test("workflow.no_uat still blocks on saved partial UAT and prefers its repair action", async (t) => {
  const phase = implementedPhase({
    withReview: false,
    withSecurity: false
  });
  const repoPath = await createQualityGateRepo({
    phases: [phase],
    configPatch: {
      workflow: {
        no_uat: true
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeFile(
    path.join(repoPath, ".blueprint/phases/01-quality-gate/01-UAT.md"),
    blockingUatContent(phase, "/blu-audit-fix 1"),
    "utf8"
  );

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-audit-fix 1/);
  assert.match(state.derivedStatus.nextAction, /\/blu-audit-fix 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-code-review 1|\/blu-audit-milestone/);
  assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-code-review 1|\/blu-audit-milestone/);
});

test("workflow.no_uat keeps saved partial UAT add-tests routes", async (t) => {
  const phase = implementedPhase({
    withReview: false,
    withSecurity: false
  });
  const repoPath = await createQualityGateRepo({
    phases: [phase],
    configPatch: {
      workflow: {
        no_uat: true
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeFile(
    path.join(repoPath, ".blueprint/phases/01-quality-gate/01-UAT.md"),
    blockingUatContent(phase, "/blu-add-tests 1"),
    "utf8"
  );

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-add-tests 1/);
  assert.match(state.derivedStatus.nextAction, /\/blu-add-tests 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-verify-work 1|\/blu-code-review 1/);
  assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-verify-work 1|\/blu-code-review 1/);
});

test("workflow.no_uat falls back from unsupported saved partial UAT routes to verify-work", async (t) => {
  const phase = implementedPhase({
    withReview: false,
    withSecurity: false
  });
  const repoPath = await createQualityGateRepo({
    phases: [phase],
    configPatch: {
      workflow: {
        no_uat: true
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeFile(
    path.join(repoPath, ".blueprint/phases/01-quality-gate/01-UAT.md"),
    blockingUatContent(phase, "/blu-cleanup"),
    "utf8"
  );

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-verify-work 1/);
  assert.match(state.derivedStatus.nextAction, /\/blu-verify-work 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-cleanup|\/blu-code-review 1|\/blu-audit-milestone/);
  assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-cleanup|\/blu-code-review 1|\/blu-audit-milestone/);
});

test("workflow.no_uat lets milestone routing ignore missing UAT after quality gates pass", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        completed: true,
        withUat: false,
        withReview: true,
        withSecurity: true
      })
    ],
    configPatch: {
      workflow: {
        no_uat: true
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-audit-milestone v1/);
  assert.doesNotMatch(status.nextAction, /\/blu-verify-work 1/);
});

test("workflow.no_uat milestone closeout stays blocked by malformed saved UAT", async (t) => {
  const phase = implementedPhase({
    completed: true,
    withReview: true,
    withSecurity: true
  });
  const repoPath = await createQualityGateRepo({
    phases: [phase],
    configPatch: {
      workflow: {
        no_uat: true
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeFile(
    path.join(repoPath, ".blueprint/phases/01-quality-gate/01-UAT.md"),
    malformedPassUatContent(phase),
    "utf8"
  );

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-verify-work 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-audit-milestone v1|\/blu-complete-milestone|\/blu-new-milestone/);
});

test("workflow.no_uat milestone closeout keeps saved partial UAT audit-fix routes", async (t) => {
  const phase = implementedPhase({
    completed: true,
    withReview: true,
    withSecurity: true
  });
  const repoPath = await createQualityGateRepo({
    phases: [phase],
    configPatch: {
      workflow: {
        no_uat: true
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeFile(
    path.join(repoPath, ".blueprint/phases/01-quality-gate/01-UAT.md"),
    blockingUatContent(phase, "/blu-audit-fix 1"),
    "utf8"
  );

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-audit-fix 1/);
  assert.match(state.derivedStatus.nextAction, /\/blu-audit-fix 1/);
  assert.doesNotMatch(
    status.nextAction,
    /\/blu-verify-work 1|\/blu-audit-milestone v1|\/blu-complete-milestone|\/blu-new-milestone/
  );
  assert.doesNotMatch(
    state.derivedStatus.nextAction,
    /\/blu-verify-work 1|\/blu-audit-milestone v1|\/blu-complete-milestone|\/blu-new-milestone/
  );
});

test("workflow.no_uat milestone closeout keeps saved partial UAT add-tests routes", async (t) => {
  const phase = implementedPhase({
    completed: true,
    withReview: true,
    withSecurity: true
  });
  const repoPath = await createQualityGateRepo({
    phases: [phase],
    configPatch: {
      workflow: {
        no_uat: true
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeFile(
    path.join(repoPath, ".blueprint/phases/01-quality-gate/01-UAT.md"),
    blockingUatContent(phase, "/blu-add-tests 1"),
    "utf8"
  );

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-add-tests 1/);
  assert.match(state.derivedStatus.nextAction, /\/blu-add-tests 1/);
  assert.doesNotMatch(
    status.nextAction,
    /\/blu-verify-work 1|\/blu-audit-milestone v1|\/blu-complete-milestone|\/blu-new-milestone/
  );
  assert.doesNotMatch(
    state.derivedStatus.nextAction,
    /\/blu-verify-work 1|\/blu-audit-milestone v1|\/blu-complete-milestone|\/blu-new-milestone/
  );
});

test("workflow.no_uat milestone closeout falls back from unsupported saved UAT routes to verify-work", async (t) => {
  const phase = implementedPhase({
    completed: true,
    withReview: true,
    withSecurity: true
  });
  const repoPath = await createQualityGateRepo({
    phases: [phase],
    configPatch: {
      workflow: {
        no_uat: true
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeFile(
    path.join(repoPath, ".blueprint/phases/01-quality-gate/01-UAT.md"),
    blockingUatContent(phase, "/blu-cleanup"),
    "utf8"
  );

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-verify-work 1/);
  assert.match(state.derivedStatus.nextAction, /\/blu-verify-work 1/);
  assert.doesNotMatch(
    status.nextAction,
    /\/blu-cleanup|\/blu-audit-milestone v1|\/blu-complete-milestone|\/blu-new-milestone/
  );
  assert.doesNotMatch(
    state.derivedStatus.nextAction,
    /\/blu-cleanup|\/blu-audit-milestone v1|\/blu-complete-milestone|\/blu-new-milestone/
  );
});

test("summary-derived source evidence is unioned with non-reviewable plan evidence", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        planModifiedFiles: ["README.md"],
        summaryChangedFiles: ["src/summary-source.ts"]
      })
    ]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeRepoFile(repoPath, "README.md", "# Fixture\n");
  await writeRepoFile(
    repoPath,
    "src/summary-source.ts",
    "export const summarySource = true;\n"
  );

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-code-review 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-audit-milestone|\/blu-discuss-phase 2/);
});

test("quality gates ignore XML and template snippets in summary-derived reviewable files", async (t) => {
  const phase = implementedPhase({
    planModifiedFiles: ["README.md"],
    summaryChangedFiles: ["src/summary-source.ts"]
  });
  const repoPath = await createQualityGateRepo({
    phases: [phase]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeRepoFile(repoPath, "README.md", "# Fixture\n");
  await writeRepoFile(
    repoPath,
    "src/summary-source.ts",
    "export const summarySource = true;\n"
  );
  await writeFile(
    path.join(
      repoPath,
      ".blueprint/phases",
      phaseDirectoryName(phase),
      `${phasePrefix(phase.phase)}-01-SUMMARY.md`
    ),
    `# ${phaseTitle(phase)} - Summary 01

**Plan:** \`${phasePrefix(phase.phase)}-01-PLAN.md\`
**Status:** COMPLETED
**Readiness:** ready-for-validation
**Completion State:** complete
**Next Safe Action:** /blu-validate-phase ${phase.phase}

## Outcome

- Execution completed and produced source changes.

## Changes Made

- Updated \`src/summary-source.ts\`.
- Preserved the placeholder \`<release>\${java.version}</release>\` in the Maven example.
- Documented the closing tag \`</dependencyManagement>\` for the XML guidance.

## Verification

| Check | Command | Result | Evidence | Notes |
|-------|---------|--------|----------|-------|
| tests/quality-gate-routing.test.ts exits 0 | npx tsx --test tests/quality-gate-routing.test.ts | pass | Saved summary fixture. | The selected acceptance criterion passed. |

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
| artifact | ${phaseArtifactPath(phase, "-01-SUMMARY.md")} | Saved summary artifact. |
`,
    "utf8"
  );

  const evaluation = await evaluatePhaseQualityGates({
    projectRoot: repoPath,
    phaseNumber: String(phase.phase),
    phasePrefix: phasePrefix(phase.phase),
    phaseDir: phaseDirectoryName(phase)
  });

  assert.deepEqual(evaluation.reviewableFiles, ["src/summary-source.ts"]);
  assert.doesNotMatch(evaluation.warnings.join("\n"), /java\.version|dependencyManagement/);
});

test("doc-only plan does not force review from prose outside summary Changes Made", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        planModifiedFiles: ["docs/guide.md"],
        summaryChangedFiles: ["docs/guide.md"],
        summaryOutcomeLines: [
          "- Documentation changed only.",
          "- Related future example: src/example.ts."
        ]
      })
    ]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeRepoFile(repoPath, "docs/guide.md", "# Guide\n");
  await writeRepoFile(repoPath, "src/example.ts", "export const example = true;\n");

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.doesNotMatch(status.nextAction, /\/blu-code-review 1|\/blu-secure-phase 1/);
});

test("UAT completion does not mark ROADMAP phase complete until review gate is satisfied", async (t) => {
  const phase = implementedPhase({
    withVerification: false,
    withUat: false
  });
  const repoPath = await createQualityGateRepo({
    phases: [phase]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const verification = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: String(phase.phase),
    artifact: "verification",
    content: verificationContent(phase)
  });
  const uat = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: String(phase.phase),
    artifact: "uat",
    content: uatContent(phase)
  });
  const roadmap = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");

  assert.equal(verification.status, "created", JSON.stringify(verification, null, 2));
  assert.equal(uat.status, "created", JSON.stringify(uat, null, 2));
  assert.match(roadmap, /- \[ \] \*\*Phase 1: Quality Gate\*\*/);
  assert.doesNotMatch(roadmap, /### Phase 1: Quality Gate[\s\S]*\*\*Status\*\*: completed/);
});

test("review fix follow-up blocks UAT completion even after review and security gates exist", async (t) => {
  const phase = implementedPhase({
    withVerification: false,
    withUat: false,
    withReview: true,
    withSecurity: true,
    reviewNextSafeAction: "/blu-code-review-fix 1"
  });
  const repoPath = await createQualityGateRepo({
    phases: [phase]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const verification = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: String(phase.phase),
    artifact: "verification",
    content: verificationContent(phase)
  });
  const uat = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: String(phase.phase),
    artifact: "uat",
    content: uatContent(phase)
  });
  const roadmap = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");
  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.equal(verification.status, "created", JSON.stringify(verification, null, 2));
  assert.equal(uat.status, "created", JSON.stringify(uat, null, 2));
  assert.match(status.nextAction, /\/blu-code-review-fix 1/);
  assert.match(
    uat.warnings.join("\n"),
    /Saved review remediation debt remains for 3 reviewable file\(s\)\./
  );
  assert.doesNotMatch(uat.warnings.join("\n"), /SECURITY evidence is missing/i);
  assert.match(roadmap, /- \[ \] \*\*Phase 1: Quality Gate\*\*/);
  assert.doesNotMatch(roadmap, /### Phase 1: Quality Gate[\s\S]*\*\*Status\*\*: completed/);
});

test("repo-wide progress routes saved review remediation debt after security even before validation and UAT exist", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        withVerification: false,
        withUat: false,
        withReview: true,
        withSecurity: true,
        reviewNextSafeAction: "/blu-code-review-fix 1",
        securityNextSafeAction: "/blu-validate-phase 1"
      })
    ]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const evaluation = await evaluatePhaseQualityGates({
    projectRoot: repoPath,
    phaseNumber: "1",
    phasePrefix: "01",
    phaseDir: "01-quality-gate"
  });
  const status = await blueprintProjectStatus({ cwd: repoPath });
  const syncResult = await blueprintStateSync({ cwd: repoPath });
  const debtReason = formatPhaseQualityGateDebtReason(evaluation);

  assert.equal(
    debtReason,
    "Saved review remediation debt remains for 3 reviewable file(s)."
  );
  assert.equal(evaluation.missingGate, null);
  assert.equal(evaluation.hasSecurity, true);
  assert.match(status.nextAction, /\/blu-code-review-fix 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-validate-phase 1|\/blu-verify-work 1/);
  assert.match(
    syncResult.warnings.join("\n"),
    /Current phase 1 has quality gate debt: Saved review remediation debt remains for 3 reviewable file\(s\)\./
  );
  assert.doesNotMatch(syncResult.warnings.join("\n"), /SECURITY evidence is missing/i);
});

test("completed REVIEW-FIX next action outranks stale REVIEW follow-up", async (t) => {
  const phase = implementedPhase({
    withReview: true,
    withReviewFix: true,
    withSecurity: true,
    reviewNextSafeAction: "/blu-code-review-fix 1",
    reviewFixNextSafeAction: "/blu-validate-phase 1"
  });
  const repoPath = await createQualityGateRepo({
    phases: [phase]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const evaluation = await evaluatePhaseQualityGates({
    projectRoot: repoPath,
    phaseNumber: String(phase.phase),
    phasePrefix: phasePrefix(phase.phase),
    phaseDir: phaseDirectoryName(phase)
  });
  const nextAction = buildPhaseQualityGateNextAction({
    phaseNumber: String(phase.phase),
    evaluation,
    implementedCommandNames: new Set(["validate-phase", "code-review-fix"])
  });

  assert.equal(evaluation.reviewNextSafeAction, "/blu-validate-phase 1");
  assert.equal(evaluation.reviewDebtKind, null);
  assert.equal(evaluation.gatesSatisfied, true);
  assert.equal(nextAction, "Run /blu-validate-phase 1.");
});

test("completed REVIEW-FIX that addresses only a subset of actionable saved review ids keeps remediation debt open", async (t) => {
  const phase = implementedPhase({
    withReview: true,
    withReviewFix: true,
    withSecurity: true,
    reviewVerdict: "FOLLOW_UP",
    reviewNextSafeAction: "/blu-code-review-fix 1",
    reviewFindings: [
      "[high][follow-up] `F-01` `src/feature.ts:1` - Evidence: Missing guard for invalid input remains in the implementation. Impact: Invalid input can still be treated as successful behavior. Fix/verification: Apply the saved source remediation before phase closeout."
    ],
    reviewFollowUps: ["`FU-01` Apply the saved source remediation before phase closeout."],
    reviewFixFindingsAddressed: ["`F-01` fixed."]
  });
  const repoPath = await createQualityGateRepo({
    phases: [phase]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const evaluation = await evaluatePhaseQualityGates({
    projectRoot: repoPath,
    phaseNumber: String(phase.phase),
    phasePrefix: phasePrefix(phase.phase),
    phaseDir: phaseDirectoryName(phase)
  });
  const nextAction = buildPhaseQualityGateNextAction({
    phaseNumber: String(phase.phase),
    evaluation,
    implementedCommandNames: new Set(["code-review-fix", "validate-phase"])
  });

  assert.equal(evaluation.reviewNextSafeAction, null);
  assert.equal(evaluation.reviewDebtKind, "remediation");
  assert.equal(evaluation.gatesSatisfied, false);
  assert.match(evaluation.warnings.join("\n"), /Missing: FU-01\./);
  assert.equal(
    formatPhaseQualityGateDebtReason(evaluation),
    "Saved review remediation debt remains for 3 reviewable file(s)."
  );
  assert.equal(
    nextAction,
    "Run /blu-code-review-fix 1 to continue resolving saved review remediation debt."
  );
});

test("completed REVIEW-FIX that addresses every actionable saved review id keeps the happy path", async (t) => {
  const phase = implementedPhase({
    withReview: true,
    withReviewFix: true,
    withSecurity: true,
    reviewVerdict: "FOLLOW_UP",
    reviewNextSafeAction: "/blu-code-review-fix 1",
    reviewFindings: [
      "[high][follow-up] `F-01` `src/feature.ts:1` - Evidence: Missing guard for invalid input remains in the implementation. Impact: Invalid input can still be treated as successful behavior. Fix/verification: Apply the saved source remediation before phase closeout."
    ],
    reviewFollowUps: ["`FU-01` Apply the saved source remediation before phase closeout."],
    reviewFixFindingsAddressed: ["`F-01` fixed.", "`FU-01` fixed."]
  });
  const repoPath = await createQualityGateRepo({
    phases: [phase]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const evaluation = await evaluatePhaseQualityGates({
    projectRoot: repoPath,
    phaseNumber: String(phase.phase),
    phasePrefix: phasePrefix(phase.phase),
    phaseDir: phaseDirectoryName(phase)
  });
  const nextAction = buildPhaseQualityGateNextAction({
    phaseNumber: String(phase.phase),
    evaluation,
    implementedCommandNames: new Set(["code-review-fix", "validate-phase"])
  });

  assert.equal(evaluation.reviewNextSafeAction, "/blu-validate-phase 1");
  assert.equal(evaluation.reviewDebtKind, null);
  assert.equal(evaluation.gatesSatisfied, true);
  assert.doesNotMatch(evaluation.warnings.join("\n"), /Missing: /);
  assert.equal(nextAction, "Run /blu-validate-phase 1.");
});

test("completed REVIEW-FIX without explicit addressed ids keeps remediation debt open when saved review has actionable ids", async (t) => {
  const phase = implementedPhase({
    withReview: true,
    withReviewFix: true,
    withSecurity: true,
    reviewVerdict: "FOLLOW_UP",
    reviewNextSafeAction: "/blu-code-review-fix 1",
    reviewFindings: [
      "[high][follow-up] `F-01` `src/feature.ts:1` - Evidence: Missing guard for invalid input remains in the implementation. Impact: Invalid input can still be treated as successful behavior. Fix/verification: Apply the saved source remediation before phase closeout."
    ],
    reviewFollowUps: ["`FU-01` Apply the saved source remediation before phase closeout."],
    reviewFixFindingsAddressed: ["Resolved the selected saved review work."]
  });
  const repoPath = await createQualityGateRepo({
    phases: [phase]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const evaluation = await evaluatePhaseQualityGates({
    projectRoot: repoPath,
    phaseNumber: String(phase.phase),
    phasePrefix: phasePrefix(phase.phase),
    phaseDir: phaseDirectoryName(phase)
  });
  const nextAction = buildPhaseQualityGateNextAction({
    phaseNumber: String(phase.phase),
    evaluation,
    implementedCommandNames: new Set(["code-review-fix", "validate-phase"])
  });

  assert.equal(evaluation.reviewNextSafeAction, null);
  assert.equal(evaluation.reviewDebtKind, "remediation");
  assert.equal(evaluation.gatesSatisfied, false);
  assert.match(
    evaluation.warnings.join("\n"),
    /lacks explicit parseable addressed ids in Findings Addressed while the source Review artifact has 2 actionable saved review target id\(s\); quality-gate routing will keep remediation debt open\. Missing: F-01, FU-01\./i
  );
  assert.equal(
    formatPhaseQualityGateDebtReason(evaluation),
    "Saved review remediation debt remains for 3 reviewable file(s)."
  );
  assert.equal(
    nextAction,
    "Run /blu-code-review-fix 1 to continue resolving saved review remediation debt."
  );
});

test("partial REVIEW-FIX add-tests route outranks stale REVIEW follow-up and keeps remediation debt visible", async (t) => {
  const phase = implementedPhase({
    withReview: true,
    withReviewFix: true,
    withSecurity: true,
    reviewNextSafeAction: "/blu-code-review-fix 1",
    reviewFixStatus: "PARTIAL",
    reviewFixCompletionState: "pending",
    reviewFixNextSafeAction: "/blu-add-tests 1"
  });
  const repoPath = await createQualityGateRepo({
    phases: [phase]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const evaluation = await evaluatePhaseQualityGates({
    projectRoot: repoPath,
    phaseNumber: String(phase.phase),
    phasePrefix: phasePrefix(phase.phase),
    phaseDir: phaseDirectoryName(phase)
  });
  const nextAction = buildPhaseQualityGateNextAction({
    phaseNumber: String(phase.phase),
    evaluation,
    implementedCommandNames: new Set(["add-tests", "code-review-fix"])
  });

  assert.equal(evaluation.reviewNextSafeAction, "/blu-add-tests 1");
  assert.equal(evaluation.reviewDebtKind, "remediation");
  assert.equal(evaluation.gatesSatisfied, false);
  assert.equal(
    formatPhaseQualityGateDebtReason(evaluation),
    "Saved review remediation debt remains for 3 reviewable file(s)."
  );
  assert.equal(nextAction, "Run /blu-add-tests 1.");
});

test("blocked REVIEW-FIX progress route does not clear remediation debt or revive stale REVIEW routing", async (t) => {
  const phase = implementedPhase({
    withReview: true,
    withReviewFix: true,
    withSecurity: true,
    reviewNextSafeAction: "/blu-code-review-fix 1",
    reviewFixStatus: "BLOCKED",
    reviewFixCompletionState: "blocked",
    reviewFixNextSafeAction: "/blu-progress"
  });
  const repoPath = await createQualityGateRepo({
    phases: [phase]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const evaluation = await evaluatePhaseQualityGates({
    projectRoot: repoPath,
    phaseNumber: String(phase.phase),
    phasePrefix: phasePrefix(phase.phase),
    phaseDir: phaseDirectoryName(phase)
  });
  const nextAction = buildPhaseQualityGateNextAction({
    phaseNumber: String(phase.phase),
    evaluation,
    implementedCommandNames: new Set(["code-review-fix", "progress"])
  });

  assert.equal(evaluation.reviewNextSafeAction, null);
  assert.equal(evaluation.reviewDebtKind, "remediation");
  assert.equal(evaluation.gatesSatisfied, false);
  assert.match(evaluation.warnings.join("\n"), /will not treat \/blu-progress as debt-clearing/i);
  assert.equal(
    formatPhaseQualityGateDebtReason(evaluation),
    "Saved review remediation debt remains for 3 reviewable file(s)."
  );
  assert.equal(
    nextAction,
    "Run /blu-code-review-fix 1 to continue resolving saved review remediation debt."
  );
});

test("newest REVIEW-FIX with non-Blueprint next action suppresses stale REVIEW routing and keeps debt-aware fallback behavior", async (t) => {
  const phase = implementedPhase({
    withReview: true,
    withReviewFix: true,
    withSecurity: true,
    reviewNextSafeAction: "/blu-code-review-fix 1",
    reviewFixStatus: "PARTIAL",
    reviewFixCompletionState: "pending",
    reviewFixNextSafeAction: "Blocked: pending external validation"
  });
  const repoPath = await createQualityGateRepo({
    phases: [phase]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const evaluation = await evaluatePhaseQualityGates({
    projectRoot: repoPath,
    phaseNumber: String(phase.phase),
    phasePrefix: phasePrefix(phase.phase),
    phaseDir: phaseDirectoryName(phase)
  });
  const nextAction = buildPhaseQualityGateNextAction({
    phaseNumber: String(phase.phase),
    evaluation,
    implementedCommandNames: new Set(["code-review-fix", "progress"])
  });

  assert.equal(evaluation.reviewNextSafeAction, null);
  assert.equal(evaluation.reviewDebtKind, "remediation");
  assert.equal(evaluation.gatesSatisfied, false);
  assert.match(evaluation.warnings.join("\n"), /does not contain a Blueprint command/i);
  assert.equal(
    formatPhaseQualityGateDebtReason(evaluation),
    "Saved review remediation debt remains for 3 reviewable file(s)."
  );
  assert.equal(
    nextAction,
    "Run /blu-code-review-fix 1 to continue resolving saved review remediation debt."
  );
});

test("default workflow.secure_phase off does not route saved REVIEW with missing SECURITY to secure-phase", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        withReview: true,
        reviewNextSafeAction: "/blu-progress"
      })
    ]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const evaluation = await evaluatePhaseQualityGates({
    projectRoot: repoPath,
    phaseNumber: "1",
    phasePrefix: "01",
    phaseDir: "01-quality-gate"
  });
  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.equal(evaluation.codeReviewEnabled, true);
  assert.equal(evaluation.requiresCodeReview, true);
  assert.equal(evaluation.hasReview, true);
  assert.equal(evaluation.hasSecurity, false);
  assert.equal(evaluation.missingGate, null);
  assert.equal(evaluation.gatesSatisfied, true);
  assert.doesNotMatch(status.nextAction, /\/blu-secure-phase 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-code-review 1/);
  assert.match(status.nextAction, /\/blu-progress\b|\/blu-audit-milestone v1/);
  assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-secure-phase 1/);
  assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-code-review 1/);
  assert.match(state.derivedStatus.nextAction, /\/blu-progress\b|\/blu-audit-milestone v1/);
});

test("workflow.code_review false and workflow.secure_phase true keep REVIEW without SECURITY on non-secure routing", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        withReview: true,
        reviewNextSafeAction: "/blu-progress"
      })
    ],
    configPatch: {
      workflow: {
        code_review: false,
        secure_phase: true
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const evaluation = await evaluatePhaseQualityGates({
    projectRoot: repoPath,
    phaseNumber: "1",
    phasePrefix: "01",
    phaseDir: "01-quality-gate"
  });
  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.equal(evaluation.codeReviewEnabled, false);
  assert.equal(evaluation.securePhaseEnabled, true);
  assert.equal(evaluation.requiresCodeReview, false);
  assert.equal(evaluation.requiresSecurePhase, false);
  assert.equal(evaluation.requiresQualityGate, false);
  assert.equal(evaluation.hasReview, true);
  assert.equal(evaluation.hasSecurity, false);
  assert.equal(evaluation.missingGate, null);
  assert.equal(evaluation.gatesSatisfied, true);
  assert.doesNotMatch(status.nextAction, /\/blu-secure-phase 1|\/blu-code-review 1/);
  assert.match(status.nextAction, /\/blu-progress\b|\/blu-audit-milestone v1/);
  assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-secure-phase 1|\/blu-code-review 1/);
  assert.match(state.derivedStatus.nextAction, /\/blu-progress\b|\/blu-audit-milestone v1/);
});

test("workflow.code_review true and workflow.secure_phase false require review but not secure-phase", async (t) => {
  const missingReviewRepoPath = await createQualityGateRepo({
    phases: [implementedPhase()],
    configPatch: {
      workflow: {
        code_review: true,
        secure_phase: false
      }
    }
  });
  const reviewedRepoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        withReview: true,
        reviewNextSafeAction: "/blu-progress"
      })
    ],
    configPatch: {
      workflow: {
        code_review: true,
        secure_phase: false
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(missingReviewRepoPath), { recursive: true, force: true });
    await rm(path.dirname(reviewedRepoPath), { recursive: true, force: true });
  });

  const missingReviewEvaluation = await evaluatePhaseQualityGates({
    projectRoot: missingReviewRepoPath,
    phaseNumber: "1",
    phasePrefix: "01",
    phaseDir: "01-quality-gate"
  });
  const reviewedEvaluation = await evaluatePhaseQualityGates({
    projectRoot: reviewedRepoPath,
    phaseNumber: "1",
    phasePrefix: "01",
    phaseDir: "01-quality-gate"
  });
  const missingReviewStatus = await blueprintProjectStatus({ cwd: missingReviewRepoPath });
  const reviewedStatus = await blueprintProjectStatus({ cwd: reviewedRepoPath });
  const reviewedState = await blueprintStateLoad({ cwd: reviewedRepoPath });

  assert.equal(missingReviewEvaluation.codeReviewEnabled, true);
  assert.equal(missingReviewEvaluation.requiresCodeReview, true);
  assert.equal(missingReviewEvaluation.missingGate, "review");
  assert.equal(missingReviewEvaluation.gatesSatisfied, false);
  assert.match(missingReviewStatus.nextAction, /\/blu-code-review 1/);
  assert.doesNotMatch(missingReviewStatus.nextAction, /\/blu-secure-phase 1/);

  assert.equal(reviewedEvaluation.codeReviewEnabled, true);
  assert.equal(reviewedEvaluation.requiresCodeReview, true);
  assert.equal(reviewedEvaluation.hasReview, true);
  assert.equal(reviewedEvaluation.hasSecurity, false);
  assert.equal(reviewedEvaluation.missingGate, null);
  assert.equal(reviewedEvaluation.gatesSatisfied, true);
  assert.doesNotMatch(reviewedStatus.nextAction, /\/blu-code-review 1/);
  assert.doesNotMatch(reviewedStatus.nextAction, /\/blu-secure-phase 1/);
  assert.match(reviewedStatus.nextAction, /\/blu-progress\b|\/blu-audit-milestone v1/);
  assert.doesNotMatch(reviewedState.derivedStatus.nextAction, /\/blu-code-review 1/);
  assert.doesNotMatch(reviewedState.derivedStatus.nextAction, /\/blu-secure-phase 1/);
  assert.match(reviewedState.derivedStatus.nextAction, /\/blu-progress\b|\/blu-audit-milestone v1/);
});

test("workflow.code_review true and workflow.secure_phase true require review first and secure-phase after review exists", async (t) => {
  const missingReviewRepoPath = await createQualityGateRepo({
    phases: [implementedPhase()],
    configPatch: {
      workflow: {
        code_review: true,
        secure_phase: true
      }
    }
  });
  const reviewedRepoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        withReview: true,
        reviewNextSafeAction: "/blu-progress"
      })
    ],
    configPatch: {
      workflow: {
        code_review: true,
        secure_phase: true
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(missingReviewRepoPath), { recursive: true, force: true });
    await rm(path.dirname(reviewedRepoPath), { recursive: true, force: true });
  });

  const missingReviewEvaluation = await evaluatePhaseQualityGates({
    projectRoot: missingReviewRepoPath,
    phaseNumber: "1",
    phasePrefix: "01",
    phaseDir: "01-quality-gate"
  });
  const reviewedEvaluation = await evaluatePhaseQualityGates({
    projectRoot: reviewedRepoPath,
    phaseNumber: "1",
    phasePrefix: "01",
    phaseDir: "01-quality-gate"
  });
  const missingReviewStatus = await blueprintProjectStatus({ cwd: missingReviewRepoPath });
  const reviewedStatus = await blueprintProjectStatus({ cwd: reviewedRepoPath });
  const reviewedState = await blueprintStateLoad({ cwd: reviewedRepoPath });

  assert.equal(missingReviewEvaluation.codeReviewEnabled, true);
  assert.equal(missingReviewEvaluation.requiresCodeReview, true);
  assert.equal(missingReviewEvaluation.missingGate, "review");
  assert.equal(missingReviewEvaluation.gatesSatisfied, false);
  assert.match(missingReviewStatus.nextAction, /\/blu-code-review 1/);
  assert.doesNotMatch(missingReviewStatus.nextAction, /\/blu-secure-phase 1/);

  assert.equal(reviewedEvaluation.codeReviewEnabled, true);
  assert.equal(reviewedEvaluation.requiresCodeReview, true);
  assert.equal(reviewedEvaluation.hasReview, true);
  assert.equal(reviewedEvaluation.hasSecurity, false);
  assert.equal(reviewedEvaluation.missingGate, "security");
  assert.equal(reviewedEvaluation.gatesSatisfied, false);
  assert.match(reviewedStatus.nextAction, /\/blu-secure-phase 1/);
  assert.doesNotMatch(reviewedStatus.nextAction, /\/blu-audit-milestone v1/);
  assert.match(reviewedState.derivedStatus.nextAction, /\/blu-secure-phase 1/);
  assert.doesNotMatch(reviewedState.derivedStatus.nextAction, /\/blu-audit-milestone v1/);
});

test("UAT-complete UI phase routes to ui-review after review and security gates are satisfied", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        withUiSpec: true,
        withReview: true,
        withSecurity: true
      })
    ]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-ui-review 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-audit-milestone|\/blu-discuss-phase 2/);
});

test("workflow.code_review false still routes UAT-complete UI phases to ui-review", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        withUiSpec: true
      })
    ],
    configPatch: {
      workflow: {
        code_review: false
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-ui-review 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-code-review|\/blu-secure-phase/);
});

test("workflow.code_review false ignores saved review remediation debt", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        withVerification: false,
        withUat: false,
        withReview: true,
        withSecurity: true,
        reviewNextSafeAction: "/blu-code-review-fix 1"
      })
    ],
    configPatch: {
      workflow: {
        code_review: false
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-validate-phase 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-code-review-fix|\/blu-secure-phase/);
});

test("UAT-complete UI phase with no reviewable files still routes to ui-review", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        withUiSpec: true,
        planModifiedFiles: ["docs/guide.md"],
        summaryChangedFiles: ["docs/guide.md"],
        summaryOutcomeLines: ["- Documentation changed only."]
      })
    ]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeRepoFile(repoPath, "docs/guide.md", "# Guide\n");

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-ui-review 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-code-review|\/blu-secure-phase/);
});

test("explicit UI skip rationale does not route to ui-review", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        completed: true,
        withUiSpec: true,
        uiSpecMode: "skip-rationale",
        withReview: true,
        withSecurity: true
      })
    ]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-audit-milestone v1/);
  assert.doesNotMatch(status.nextAction, /\/blu-ui-review 1/);
});

test("workflow.code_review true and workflow.secure_phase true routes secure-phase ahead of saved code-review-fix follow-up", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        withReview: true,
        reviewNextSafeAction: "/blu-code-review-fix 1"
      })
    ],
    configPatch: {
      workflow: {
        code_review: true,
        secure_phase: true
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const evaluation = await evaluatePhaseQualityGates({
    projectRoot: repoPath,
    phaseNumber: "1",
    phasePrefix: "01",
    phaseDir: "01-quality-gate"
  });
  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.equal(evaluation.missingGate, "security");
  assert.equal(evaluation.gatesSatisfied, false);
  assert.match(status.nextAction, /\/blu-secure-phase 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-code-review-fix 1/);
});

test("completed SECURITY with progress next action satisfies required secure-phase gate", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        withReview: true,
        withSecurity: true,
        securityStatus: "COMPLETED",
        securityCompletionState: "complete",
        securityNextSafeAction: "/blu-progress",
        securityOpenThreat: false
      })
    ],
    configPatch: {
      workflow: {
        code_review: true,
        secure_phase: true
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const evaluation = await evaluatePhaseQualityGates({
    projectRoot: repoPath,
    phaseNumber: "1",
    phasePrefix: "01",
    phaseDir: "01-quality-gate"
  });

  assert.equal(evaluation.hasSecurity, true);
  assert.equal(evaluation.securityDebtKind, null);
  assert.equal(evaluation.securityNextSafeAction, null);
  assert.equal(evaluation.gatesSatisfied, true);
  assert.doesNotMatch(evaluation.warnings.join("\n"), /illegal Next Safe Action/i);
});

test("completed SECURITY with validate-phase next action satisfies gate before validation exists", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        withVerification: false,
        withUat: false,
        withReview: true,
        withSecurity: true,
        securityStatus: "COMPLETED",
        securityCompletionState: "complete",
        securityNextSafeAction: "/blu-validate-phase 1",
        securityOpenThreat: false
      })
    ],
    configPatch: {
      workflow: {
        code_review: true,
        secure_phase: true
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const evaluation = await evaluatePhaseQualityGates({
    projectRoot: repoPath,
    phaseNumber: "1",
    phasePrefix: "01",
    phaseDir: "01-quality-gate"
  });
  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.equal(evaluation.hasSecurity, true);
  assert.equal(evaluation.securityDebtKind, null);
  assert.equal(evaluation.securityNextSafeAction, null);
  assert.equal(evaluation.gatesSatisfied, true);
  assert.doesNotMatch(evaluation.warnings.join("\n"), /illegal|stale Next Safe Action/i);
  assert.match(status.nextAction, /\/blu-validate-phase 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-secure-phase 1/);
});

test("completed SECURITY with verify-work next action satisfies gate when UAT is required", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        withUat: false,
        withReview: true,
        withSecurity: true,
        securityStatus: "COMPLETED",
        securityCompletionState: "complete",
        securityNextSafeAction: "/blu-verify-work 1",
        securityOpenThreat: false
      })
    ],
    configPatch: {
      workflow: {
        code_review: true,
        secure_phase: true
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const evaluation = await evaluatePhaseQualityGates({
    projectRoot: repoPath,
    phaseNumber: "1",
    phasePrefix: "01",
    phaseDir: "01-quality-gate"
  });
  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.equal(evaluation.hasSecurity, true);
  assert.equal(evaluation.securityDebtKind, null);
  assert.equal(evaluation.securityNextSafeAction, null);
  assert.equal(evaluation.gatesSatisfied, true);
  assert.doesNotMatch(evaluation.warnings.join("\n"), /illegal|stale Next Safe Action/i);
  assert.match(status.nextAction, /\/blu-verify-work 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-secure-phase 1/);
});

test("completed SECURITY with stale or illegal next safe action keeps secure-phase debt open", async (t) => {
  const scenarios = [
    {
      name: "stale validation route",
      securityNextSafeAction: "/blu-validate-phase 1"
    },
    {
      name: "stale UAT route",
      securityNextSafeAction: "/blu-verify-work 1"
    },
    {
      name: "repair-like route",
      securityNextSafeAction: "/blu-audit-fix 1"
    },
    {
      name: "non-implemented route",
      securityNextSafeAction: "/blu-not-implemented 1"
    },
    {
      name: "missing Blueprint command",
      securityNextSafeAction: "none"
    }
  ];

  for (const scenario of scenarios) {
    await t.test(scenario.name, async (t) => {
      const repoPath = await createQualityGateRepo({
        phases: [
          implementedPhase({
            withReview: true,
            withSecurity: true,
            securityStatus: "COMPLETED",
            securityCompletionState: "complete",
            securityNextSafeAction: scenario.securityNextSafeAction,
            securityOpenThreat: false
          })
        ],
        configPatch: {
          workflow: {
            code_review: true,
            secure_phase: true
          }
        }
      });
      t.after(async () => {
        await rm(path.dirname(repoPath), { recursive: true, force: true });
      });

      const evaluation = await evaluatePhaseQualityGates({
        projectRoot: repoPath,
        phaseNumber: "1",
        phasePrefix: "01",
        phaseDir: "01-quality-gate"
      });
      const nextAction = buildPhaseQualityGateNextAction({
        phaseNumber: "1",
        evaluation,
        implementedCommandNames: new Set([
          "audit-fix",
          "secure-phase",
          "validate-phase",
          "verify-work"
        ])
      });
      const status = await blueprintProjectStatus({ cwd: repoPath });

      assert.equal(evaluation.hasSecurity, true);
      assert.equal(evaluation.securityDebtKind, "incomplete");
      assert.equal(evaluation.securityNextSafeAction, null);
      assert.equal(evaluation.gatesSatisfied, false);
      assert.match(
        evaluation.warnings.join("\n"),
        /completed Security artifact has a missing, illegal, or stale Next Safe Action/i
      );
      assert.equal(
        formatPhaseQualityGateDebtReason(evaluation),
        "Saved security evidence is not complete for 3 reviewable file(s)."
      );
      assert.equal(
        nextAction,
        "Run /blu-secure-phase 1 to complete the phase security gate."
      );
      assert.match(status.nextAction, /\/blu-secure-phase 1/);
      assert.doesNotMatch(
        status.nextAction,
        /\/blu-audit-fix 1|\/blu-validate-phase 1|\/blu-verify-work 1|\/blu-not-implemented 1/
      );
    });
  }
});

test("SECURITY parser uses renderer status headers and audit label spellings", async (t) => {
  const scenarios = [
    {
      name: "live Threat Register status column blocks routing",
      securityOpenThreat: true,
      securityPendingOpenThreatStatus: "none"
    },
    {
      name: "legacy pending open threat audit label blocks routing",
      securityOpenThreat: false,
      securityPendingOpenThreatStatus: "still-open",
      legacyAuditLabel: true
    },
    {
      name: "live Findings status column detects open independently",
      securityOpenThreat: false,
      securityPendingOpenThreatStatus: "none",
      findingStatus: "open"
    },
    {
      name: "live Findings status column detects blocked independently",
      securityOpenThreat: false,
      securityPendingOpenThreatStatus: "none",
      findingStatus: "blocked"
    }
  ];

  for (const scenario of scenarios) {
    await t.test(scenario.name, async (t) => {
      const repoPath = await createQualityGateRepo({
        phases: [
          implementedPhase({
            withReview: true,
            withSecurity: true,
            securityStatus: "COMPLETED",
            securityCompletionState: "complete",
            securityNextSafeAction: "/blu-progress",
            securityOpenThreat: scenario.securityOpenThreat,
            securityPendingOpenThreatStatus: scenario.securityPendingOpenThreatStatus
          })
        ],
        configPatch: {
          workflow: {
            code_review: true,
            secure_phase: true
          }
        }
      });
      t.after(async () => {
        await rm(path.dirname(repoPath), { recursive: true, force: true });
      });

      if (scenario.legacyAuditLabel || scenario.findingStatus !== undefined) {
        const securityPath = path.join(
          repoPath,
          ".blueprint/phases/01-quality-gate/01-SECURITY.md"
        );
        let content = await readFile(securityPath, "utf8");

        if (scenario.legacyAuditLabel) {
          content = content.replace(
            "Pending-open-threat status:",
            "Pending open threat status:"
          );
        }

        if (scenario.findingStatus !== undefined) {
          const closedFindingsTable = `## Findings

| Kind | Severity | Threat ID | Status | Evidence | Recommendation |
|------|----------|-----------|--------|----------|----------------|
| none | none | none | none | none | none |`;
          const blockingFindingsTable = `## Findings

| Kind | Severity | Threat ID | Status | Evidence | Recommendation |
|------|----------|-----------|--------|----------|----------------|
| hardening-follow-up | high | T-01 | ${scenario.findingStatus} | Missing saved mitigation evidence for the mapped finding. | Verify or accept the finding. |`;
          content = content.replace(
            closedFindingsTable,
            blockingFindingsTable
          );
          assert.match(content, /\*\*Status:\*\* COMPLETED/);
          assert.match(
            content,
            /\| none \| none \| none \| none \| none \| none \| none \| none \| none \|/
          );
          assert.match(
            content,
            new RegExp(
              `\\| hardening-follow-up \\| high \\| T-01 \\| ${scenario.findingStatus} \\|`
            )
          );
        }

        await writeFile(securityPath, content, "utf8");
      }

      const evaluation = await evaluatePhaseQualityGates({
        projectRoot: repoPath,
        phaseNumber: "1",
        phasePrefix: "01",
        phaseDir: "01-quality-gate"
      });
      const status = await blueprintProjectStatus({ cwd: repoPath });

      assert.equal(evaluation.hasSecurity, true);
      assert.equal(evaluation.securityDebtKind, "blocked");
      assert.equal(evaluation.securityNextSafeAction, "/blu-progress");
      assert.equal(evaluation.gatesSatisfied, false);
      assert.match(status.nextAction, /\/blu-secure-phase 1/);
    });
  }
});

test("non-complete SECURITY keeps current-phase routing blocked", async (t) => {
  const scenarios = [
    {
      name: "PARTIAL security rejects arbitrary implemented repair action",
      securityStatus: "PARTIAL" as const,
      securityCompletionState: "partial" as const,
      securityNextSafeAction: "/blu-audit-fix 1",
      securityOpenThreat: false,
      expectedAction: /\/blu-secure-phase 1/,
      rejectedAction: /\/blu-audit-fix 1/,
      expectedDebt: "incomplete" as const,
      expectedWarning: /non-complete Security artifact has a missing, illegal, or stale Next Safe Action/i
    },
    {
      name: "BLOCKED security falls back to secure-phase",
      securityStatus: "BLOCKED" as const,
      securityCompletionState: "blocked" as const,
      securityNextSafeAction: "Blocked: pending-open-threat",
      securityOpenThreat: true,
      expectedAction: /\/blu-secure-phase 1/,
      rejectedAction: /\/blu-audit-fix 1/,
      expectedDebt: "blocked" as const,
      expectedWarning: null
    }
  ];

  for (const scenario of scenarios) {
    await t.test(scenario.name, async (t) => {
      const repoPath = await createQualityGateRepo({
        phases: [
          implementedPhase({
            withReview: true,
            withSecurity: true,
            securityStatus: scenario.securityStatus,
            securityCompletionState: scenario.securityCompletionState,
            securityNextSafeAction: scenario.securityNextSafeAction,
            securityOpenThreat: scenario.securityOpenThreat
          })
        ],
        configPatch: {
          workflow: {
            code_review: true,
            secure_phase: true
          }
        }
      });
      t.after(async () => {
        await rm(path.dirname(repoPath), { recursive: true, force: true });
      });

      const evaluation = await evaluatePhaseQualityGates({
        projectRoot: repoPath,
        phaseNumber: "1",
        phasePrefix: "01",
        phaseDir: "01-quality-gate"
      });
      const status = await blueprintProjectStatus({ cwd: repoPath });
      const state = await blueprintStateLoad({ cwd: repoPath });

      assert.equal(evaluation.hasSecurity, true);
      assert.equal(evaluation.securityDebtKind, scenario.expectedDebt);
      assert.equal(evaluation.gatesSatisfied, false);
      assert.equal(evaluation.securityNextSafeAction, null);
      if (scenario.expectedWarning) {
        assert.match(evaluation.warnings.join("\n"), scenario.expectedWarning);
      }
      assert.match(status.nextAction, scenario.expectedAction);
      assert.match(state.derivedStatus.nextAction, scenario.expectedAction);
      assert.doesNotMatch(status.nextAction, scenario.rejectedAction);
      assert.doesNotMatch(state.derivedStatus.nextAction, scenario.rejectedAction);
      assert.doesNotMatch(status.nextAction, /\/blu-audit-milestone v1|\/blu-discuss-phase 2/);
      assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-audit-milestone v1|\/blu-discuss-phase 2/);
    });
  }
});

test("partial SECURITY accepts the saved blocking UAT repair route", async (t) => {
  const phase = implementedPhase({
    withReview: true,
    withSecurity: true,
    securityStatus: "PARTIAL",
    securityCompletionState: "partial",
    securityNextSafeAction: "/blu-audit-fix 1",
    securityOpenThreat: false
  });
  const repoPath = await createQualityGateRepo({
    phases: [phase],
    configPatch: {
      workflow: {
        code_review: true,
        secure_phase: true
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/01-quality-gate/01-UAT.md"),
    blockingUatContent(phase, "/blu-audit-fix 1"),
    "utf8"
  );

  const evaluation = await evaluatePhaseQualityGates({
    projectRoot: repoPath,
    phaseNumber: "1",
    phasePrefix: "01",
    phaseDir: "01-quality-gate"
  });
  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.equal(evaluation.hasSecurity, true);
  assert.equal(evaluation.securityDebtKind, "incomplete");
  assert.equal(evaluation.securityNextSafeAction, "/blu-audit-fix 1");
  assert.equal(evaluation.gatesSatisfied, false);
  assert.doesNotMatch(
    evaluation.warnings.join("\n"),
    /non-complete Security artifact has a missing, illegal, or stale Next Safe Action/i
  );
  assert.match(status.nextAction, /\/blu-audit-fix 1/);
  assert.match(state.derivedStatus.nextAction, /\/blu-audit-fix 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-secure-phase 1|\/blu-audit-milestone v1/);
  assert.doesNotMatch(
    state.derivedStatus.nextAction,
    /\/blu-secure-phase 1|\/blu-audit-milestone v1/
  );
});

test("non-complete SECURITY blocks completed-phase and milestone routing", async (t) => {
  const earlierPhaseRepoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        completed: true,
        withReview: true,
        withSecurity: true,
        securityStatus: "PARTIAL",
        securityCompletionState: "partial",
        securityNextSafeAction: "/blu-audit-fix 1"
      }),
      {
        phase: 2,
        title: "Later Work",
        slug: "later-work",
        completed: false,
        withContext: false
      }
    ],
    currentPhase: 2,
    configPatch: {
      workflow: {
        code_review: true,
        secure_phase: true
      }
    }
  });
  const milestoneRepoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        completed: true,
        withReview: true,
        withSecurity: true,
        securityStatus: "BLOCKED",
        securityCompletionState: "blocked",
        securityNextSafeAction: "Blocked: pending-open-threat",
        securityOpenThreat: true
      })
    ],
    configPatch: {
      workflow: {
        code_review: true,
        secure_phase: true
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(earlierPhaseRepoPath), { recursive: true, force: true });
    await rm(path.dirname(milestoneRepoPath), { recursive: true, force: true });
  });

  const earlierPhaseStatus = await blueprintProjectStatus({ cwd: earlierPhaseRepoPath });
  const earlierPhaseState = await blueprintStateLoad({ cwd: earlierPhaseRepoPath });
  const milestoneStatus = await blueprintProjectStatus({ cwd: milestoneRepoPath });
  const milestoneState = await blueprintStateLoad({ cwd: milestoneRepoPath });

  assert.match(earlierPhaseStatus.nextAction, /\/blu-secure-phase 1/);
  assert.match(earlierPhaseState.derivedStatus.nextAction, /\/blu-secure-phase 1/);
  assert.doesNotMatch(
    earlierPhaseStatus.nextAction,
    /\/blu-audit-fix 1|\/blu-discuss-phase 2|\/blu-plan-phase 2/
  );
  assert.match(milestoneStatus.nextAction, /\/blu-secure-phase 1/);
  assert.match(milestoneState.derivedStatus.nextAction, /\/blu-secure-phase 1/);
  assert.doesNotMatch(milestoneStatus.nextAction, /\/blu-audit-milestone v1|\/blu-complete-milestone|\/blu-new-milestone/);
});

test("completed phase missing REVIEW blocks later phase routing and surfaces the blocking phase", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        phase: 1,
        title: "Bootstrap Gate",
        slug: "bootstrap-gate",
        completed: true,
        withReview: true,
        withSecurity: true
      }),
      implementedPhase({
        phase: 2,
        title: "Missing Review Gate",
        slug: "missing-review-gate",
        completed: true
      }),
      {
        phase: 3,
        title: "Later Work",
        slug: "later-work",
        completed: false,
        withContext: false
      }
    ],
    currentPhase: 3
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-code-review 2/);
  assert.doesNotMatch(status.nextAction, /\/blu-discuss-phase 3|\/blu-plan-phase 3/);
});

test("workflow.code_review false and workflow.secure_phase false preserve pre-gate milestone routing", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        completed: true
      })
    ],
    configPatch: {
      workflow: {
        code_review: false,
        secure_phase: false
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-audit-milestone v1/);
  assert.doesNotMatch(status.nextAction, /\/blu-code-review|\/blu-secure-phase/);
  assert.match(state.derivedStatus.nextAction, /\/blu-audit-milestone v1/);
  assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-code-review|\/blu-secure-phase/);
});

test("workflow.code_review false ignores workflow.secure_phase for milestone closeout routing", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        completed: true
      })
    ],
    configPatch: {
      workflow: {
        code_review: false,
        secure_phase: true
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const evaluation = await evaluatePhaseQualityGates({
    projectRoot: repoPath,
    phaseNumber: "1",
    phasePrefix: "01",
    phaseDir: "01-quality-gate"
  });
  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.equal(evaluation.codeReviewEnabled, false);
  assert.equal(evaluation.requiresCodeReview, false);
  assert.equal(evaluation.missingGate, null);
  assert.equal(evaluation.gatesSatisfied, true);
  assert.match(status.nextAction, /\/blu-audit-milestone v1/);
  assert.doesNotMatch(status.nextAction, /\/blu-code-review|\/blu-secure-phase/);
  assert.match(state.derivedStatus.nextAction, /\/blu-audit-milestone v1/);
  assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-code-review|\/blu-secure-phase/);
});

test("completed review and security gates allow routing to the next phase or milestone", async (t) => {
  const nextPhaseRepoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        completed: true,
        withReview: true,
        withSecurity: true
      }),
      {
        phase: 2,
        title: "Next Delivery",
        slug: "next-delivery",
        completed: false
      }
    ],
    currentPhase: 2
  });
  const milestoneRepoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        completed: true,
        withReview: true,
        withSecurity: true
      })
    ]
  });
  t.after(async () => {
    await rm(path.dirname(nextPhaseRepoPath), { recursive: true, force: true });
    await rm(path.dirname(milestoneRepoPath), { recursive: true, force: true });
  });

  const nextPhaseStatus = await blueprintProjectStatus({ cwd: nextPhaseRepoPath });
  const milestoneStatus = await blueprintProjectStatus({ cwd: milestoneRepoPath });

  assert.match(nextPhaseStatus.nextAction, /\/blu-discuss-phase 2/);
  assert.doesNotMatch(nextPhaseStatus.nextAction, /\/blu-code-review 1|\/blu-secure-phase 1|\/blu-ui-review 1/);
  assert.match(milestoneStatus.nextAction, /\/blu-audit-milestone v1/);
  assert.doesNotMatch(milestoneStatus.nextAction, /\/blu-code-review 1|\/blu-secure-phase 1|\/blu-ui-review 1/);
});

test("completed UI phase missing UI-REVIEW blocks later phase routing and surfaces the blocking phase", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        phase: 1,
        title: "UI Gate",
        slug: "ui-gate",
        completed: true,
        withUiSpec: true,
        withReview: true,
        withSecurity: true
      }),
      {
        phase: 2,
        title: "Later Work",
        slug: "later-work",
        completed: false,
        withContext: false
      }
    ],
    currentPhase: 2
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-ui-review 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-discuss-phase 2|\/blu-plan-phase 2/);
});

test("non-pass UI-REVIEW keeps current-phase routing blocked", async (t) => {
  const scenarios = [
    {
      name: "FOLLOW_UP uses saved implemented repair action",
      uiReviewVerdict: "FOLLOW_UP" as const,
      uiReviewNextSafeAction: "/blu-audit-fix 1",
      expectedAction: /\/blu-audit-fix 1/
    },
    {
      name: "BLOCKED falls back to ui-review",
      uiReviewVerdict: "BLOCKED" as const,
      uiReviewNextSafeAction: "/blu-progress",
      expectedAction: /\/blu-ui-review 1/
    }
  ];

  for (const scenario of scenarios) {
    await t.test(scenario.name, async (t) => {
      const repoPath = await createQualityGateRepo({
        phases: [
          implementedPhase({
            withUiSpec: true,
            withReview: true,
            withSecurity: true,
            withUiReview: true,
            uiReviewVerdict: scenario.uiReviewVerdict,
            uiReviewNextSafeAction: scenario.uiReviewNextSafeAction
          })
        ]
      });
      t.after(async () => {
        await rm(path.dirname(repoPath), { recursive: true, force: true });
      });

      const status = await blueprintProjectStatus({ cwd: repoPath });
      const state = await blueprintStateLoad({ cwd: repoPath });

      assert.match(status.nextAction, scenario.expectedAction);
      assert.match(state.derivedStatus.nextAction, scenario.expectedAction);
      assert.doesNotMatch(status.nextAction, /\/blu-audit-milestone v1|\/blu-discuss-phase 2/);
      assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-audit-milestone v1|\/blu-discuss-phase 2/);
    });
  }
});

test("non-pass UI-REVIEW blocks completed-phase and milestone routing", async (t) => {
  const earlierPhaseRepoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        phase: 1,
        title: "UI Gate",
        slug: "ui-gate",
        completed: true,
        withUiSpec: true,
        withReview: true,
        withSecurity: true,
        withUiReview: true,
        uiReviewVerdict: "FOLLOW_UP",
        uiReviewNextSafeAction: "/blu-audit-fix 1"
      }),
      {
        phase: 2,
        title: "Later Work",
        slug: "later-work",
        completed: false,
        withContext: false
      }
    ],
    currentPhase: 2
  });
  const milestoneRepoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        completed: true,
        withUiSpec: true,
        withReview: true,
        withSecurity: true,
        withUiReview: true,
        uiReviewVerdict: "BLOCKED",
        uiReviewNextSafeAction: "/blu-progress"
      })
    ]
  });
  t.after(async () => {
    await rm(path.dirname(earlierPhaseRepoPath), { recursive: true, force: true });
    await rm(path.dirname(milestoneRepoPath), { recursive: true, force: true });
  });

  const earlierPhaseStatus = await blueprintProjectStatus({ cwd: earlierPhaseRepoPath });
  const earlierPhaseState = await blueprintStateLoad({ cwd: earlierPhaseRepoPath });
  const milestoneStatus = await blueprintProjectStatus({ cwd: milestoneRepoPath });
  const milestoneState = await blueprintStateLoad({ cwd: milestoneRepoPath });

  assert.match(earlierPhaseStatus.nextAction, /\/blu-audit-fix 1/);
  assert.match(earlierPhaseState.derivedStatus.nextAction, /\/blu-audit-fix 1/);
  assert.doesNotMatch(earlierPhaseStatus.nextAction, /\/blu-discuss-phase 2|\/blu-plan-phase 2/);
  assert.match(milestoneStatus.nextAction, /\/blu-ui-review 1/);
  assert.match(milestoneState.derivedStatus.nextAction, /\/blu-ui-review 1/);
  assert.doesNotMatch(milestoneStatus.nextAction, /\/blu-audit-milestone v1|\/blu-complete-milestone|\/blu-new-milestone/);
});

test("stale secure-phase review follow-up does not loop after security exists", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        completed: true,
        withReview: true,
        withSecurity: true,
        reviewVerdict: "FOLLOW_UP",
        reviewNextSafeAction: "/blu-secure-phase 1"
      })
    ]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-code-review-fix 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-secure-phase 1|\/blu-audit-milestone v1/);
});

test("stale secure-phase pass review does not block advancement after security exists", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        completed: true,
        withReview: true,
        withSecurity: true,
        reviewVerdict: "PASS",
        reviewNextSafeAction: "/blu-secure-phase 1"
      })
    ]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-audit-milestone v1/);
  assert.doesNotMatch(status.nextAction, /\/blu-secure-phase 1|\/blu-code-review-fix 1/);
});
