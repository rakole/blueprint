import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { blueprintPhaseValidationWrite } from "../src/mcp/tools/phase.js";
import { blueprintProjectStatus } from "../src/mcp/tools/project.js";
import {
  buildPhaseQualityGateNextAction,
  evaluatePhaseQualityGates
} from "../src/mcp/tools/quality-gates.js";
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
  reviewNextSafeAction?: string;
  reviewFixNextSafeAction?: string;
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

  return `# ${phaseTitle(phase)} - Code Review

**Verdict:** ${verdict}
**Readiness:** ready-for-security

## Review Summary

${summaryLine}

## Positive Signals

- Saved plan, summary, verification, and UAT evidence are aligned.

## Findings

| Severity | Disposition | Location | Evidence | Impact | Recommendation |
|----------|-------------|----------|----------|--------|----------------|
${findingsRow}

## Evidence Coverage

| Evidence | Status | Rationale |
|----------|--------|-----------|
| ${phaseArtifactPath(phase, "-01-PLAN.md")} | used | The plan declares changed code files. |
| ${phaseArtifactPath(phase, "-01-SUMMARY.md")} | used | The summary records completed implementation evidence. |
| ${phaseArtifactPath(phase, "-VERIFICATION.md")} | used | Verification passed before UAT. |
| ${phaseArtifactPath(phase, "-UAT.md")} | used | UAT passed before review routing. |

## Follow-Ups

${followUpLine}

## Next Safe Action

- ${phase.reviewNextSafeAction ?? "/blu-progress"}
`;
}

function reviewFixContent(phase: PhaseFixture): string {
  const nextSafeAction = phase.reviewFixNextSafeAction ?? `/blu-validate-phase ${phase.phase}`;

  return `# ${phaseTitle(phase)} - Review Fix

**Status:** COMPLETED
**Readiness:** ready-for-validation
**Completion State:** complete
**Source Review:** ${phaseArtifactPath(phase, "-REVIEW.md")}
**Next Safe Action:** ${nextSafeAction}

## Remediation Summary

- The selected saved review finding was fixed and verified.

## Findings Addressed

- QG-REVIEW-001 fixed.

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
  return `# ${phaseTitle(phase)} - Security

**Status:** COMPLETED
**Readiness:** ready-for-routing
**Completion State:** complete

## Security Summary

- The changed code files have no open threat mitigation follow-ups.

## Evidence Coverage

| Evidence | Status | Rationale |
|----------|--------|-----------|
| ${phaseArtifactPath(phase, "-01-PLAN.md")} | used | The plan declares the changed code files. |
| ${phaseArtifactPath(phase, "-01-SUMMARY.md")} | used | The summary records completed implementation evidence. |
| ${phaseArtifactPath(phase, "-REVIEW.md")} | used | The saved review gate passed before security routing. |

## Threat Register

| Threat ID | Status | Evidence | Verifier Note |
|-----------|--------|----------|---------------|
| none | none | none | none |

## Accepted Risks

| Threat ID | Rationale | Accepted By | Accepted At | Evidence |
|-----------|-----------|-------------|-------------|----------|
| none | none | none | none | none |

## Findings

| Kind | Severity | Threat ID | Evidence | Recommendation | Status |
|------|----------|-----------|----------|----------------|--------|
| none | none | none | none | none | none |

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

## Security Audit Trail

- Audit date: 2026-05-07
- Execution mode: inline
- Overwrite gate: not-needed
- Verify or accept decision: verified
- Pending open threat status: none
- Verifier note: no open security follow-up remains.

## Next Safe Action

- /blu-progress
`;
}

function uiReviewContent(phase: PhaseFixture): string {
  return `# ${phaseTitle(phase)} - UI Review

**Verdict:** PASS
**Readiness:** ready-for-closeout

## Review Summary

- The shipped UI work satisfies the saved phase UI contract.

## Evidence Coverage

| Evidence | Status | Rationale |
|----------|--------|-----------|
| ${phaseArtifactPath(phase, "-UI-SPEC.md")} | used | The phase UI contract defines the surface under audit. |
| ${phaseArtifactPath(phase, "-UAT.md")} | used | UAT confirms the audited UI state is the shipped behavior. |

## Findings

| Pillar | Result | Evidence | Notes |
|--------|--------|----------|-------|
| hierarchy | pass | ${phaseArtifactPath(phase, "-UI-SPEC.md")} | The responsive hierarchy matches the saved UI contract. |

## Next Safe Action

- /blu-progress
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

${options.phases.map((phase) => `- [${phase.completed ? "x" : " "}] Phase ${phase.phase}: ${phase.title} (Requirements: QG-01)`).join("\n")}

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
        reviewNextSafeAction: "/blu-code-review-fix 1"
      })
    ]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-code-review-fix 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-validate-phase 1|\/blu-verify-work 1/);
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
  assert.equal(nextAction, "Run /blu-validate-phase 1.");
});

test("saved REVIEW with missing SECURITY routes to secure-phase", async (t) => {
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

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-secure-phase 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-progress\b/);
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

test("missing SECURITY outranks saved code-review-fix follow-up", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        withReview: true,
        reviewNextSafeAction: "/blu-code-review-fix 1"
      })
    ]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-secure-phase 1/);
  assert.doesNotMatch(status.nextAction, /\/blu-code-review-fix 1/);
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

test("workflow.code_review false preserves pre-gate milestone routing", async (t) => {
  const repoPath = await createQualityGateRepo({
    phases: [
      implementedPhase({
        completed: true
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

  assert.match(status.nextAction, /\/blu-audit-milestone v1/);
  assert.doesNotMatch(status.nextAction, /\/blu-code-review|\/blu-secure-phase/);
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
