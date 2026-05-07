import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintArtifactList } from "../src/mcp/tools/artifacts.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import {
  blueprintReviewAuthoringContext,
  blueprintReviewLoadFindings,
  blueprintReviewRecord,
  blueprintReviewValidateModel
} from "../src/mcp/tools/review.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

const repoRoot = process.cwd();

type SecurePhaseRepoOptions = {
  withPlan?: boolean;
  withSummary?: boolean;
  withThreatModel?: boolean;
  threatModelFormat?: "heading" | "xml";
  extraPendingPlan?: boolean;
  extraCompletedPlan?: boolean;
  extraCompletedPlanThreatId?: string;
  threatId?: string;
  threatMitigation?: string;
};

function securityPlanContent(
  withThreatModel = true,
  options: {
    planId?: string;
    threatId?: string;
    mitigation?: string;
    threatModelFormat?: "heading" | "xml";
  } = {}
): string {
  const planId = options.planId ?? "01";
  const threatId = options.threatId ?? "T-01";
  const mitigation = options.mitigation ?? "Persist security evidence through MCP review record.";
  const threatTable = `| Threat ID | Category | Component | Disposition | Mitigation |
|-----------|----------|-----------|-------------|------------|
| ${threatId} | Tampering | Review substrate | mitigate | ${mitigation} |`;
  const threatModel = withThreatModel
    ? options.threatModelFormat === "xml"
      ? `
<threat_model>
${threatTable}
</threat_model>
`
      : `
## Threat Model

${threatTable}
`
    : "";

  return `---
phase: 5
plan_id: "${planId}"
title: "Security Audit"
wave: 1
status: planned
objective: "Capture a durable security audit for the completed phase."
depends_on: []
requirements:
  - SEC-01
files_modified:
  - src/security.ts
read_first:
  - src/security.ts
acceptance_criteria:
  - npm test -- tests/security.test.ts exits 0
autonomous: true
---

# Phase 05: Security Audit - Plan ${planId}

## Goal

Capture a durable security audit for the completed phase.

## Scope

- Review declared threat mitigations only.
${threatModel}
## Tasks

### Task 1: Persist security evidence

#### Read First

- src/security.ts

#### Action

- Persist the phase-scoped security review through MCP.

#### Acceptance Criteria

- npm test -- tests/security.test.ts exits 0

## Verification

- Run the security fixture.

## Must Haves

- Keep security evidence MCP-owned.

## Requirement Coverage

| Requirement | Status | Covered By Tasks | Evidence | Rationale |
|-------------|--------|------------------|----------|-----------|
| SEC-01 | covered | task-1 | tests/secure-phase-slice.test.ts | The security phase fixture covers saved security evidence routing. |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| src/security.ts | used | The source fixture grounds the threat model review. |

## File / Surface Coverage

| Surface | Covered By Tasks | Verification | Rationale |
|---------|------------------|--------------|-----------|
| src/security.ts | task-1 | npm test -- tests/security.test.ts exits 0 | The focused security fixture covers the declared source surface. |

## Unknowns And Deferrals

| Item | Disposition | Rationale | Follow-Up |
|------|-------------|-----------|-----------|
| No open unknowns for security plan ${planId}. | none | The fixture has the threat evidence needed by the tests. | No follow-up required after the focused test passes. |
`;
}

function completedSecuritySummaryContent(planId = "01"): string {
  return `# Phase 05: Security Audit - Summary ${planId}

**Plan:** \`.blueprint/phases/05-security-audit/05-${planId}-PLAN.md\`
**Status:** COMPLETED
**Readiness:** ready-for-validation
**Completion State:** complete
**Next Safe Action:** /blu-validate-phase 5

## Outcome

- Execution finished and produced the security review substrate.

## Changes Made

- Added MCP-owned security review persistence in src/security.ts.

## Verification

| Check | Command | Result | Evidence | Notes |
|-------|---------|--------|----------|-------|
| npm test -- tests/security.test.ts exits 0 | npm test -- tests/security.test.ts | pass | Focused security fixture passed. | The selected acceptance criterion passed. |

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
| artifact | .blueprint/phases/05-security-audit/05-${planId}-SUMMARY.md | Saved summary artifact. |
`;
}

async function createSecurePhaseRepo(
  options: SecurePhaseRepoOptions = {}
): Promise<string> {
  const {
    withPlan = true,
    withSummary = true,
    withThreatModel = true,
    threatModelFormat = "heading",
    extraPendingPlan = false,
    extraCompletedPlan = false,
    extraCompletedPlanThreatId = "T-01",
    threatId = "T-01",
    threatMitigation = "Persist security evidence through MCP review record."
  } = options;
  const repoPath = await createGitRepo("blueprint-secure-phase-");
  const phaseDir = path.join(repoPath, ".blueprint/phases/05-security-audit");

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, "src/security.ts"), "export const securityReview = true;\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Secure Phase Fixture

## Milestone

- Active milestone: v3

## Phases

- [x] **Phase 5: Security Audit** - Review threat mitigations for the delivered phase

## Phase Details

### Phase 5: Security Audit
**Goal**: Capture a durable security audit for the completed phase.
**Requirements**: SEC-01
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v3
- Current phase: 5
- Active command: /blu-secure-phase
- Next action: Run /blu-secure-phase 5
- Last updated: 2026-04-30T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");

  if (withPlan) {
    await writeFile(
      path.join(phaseDir, "05-01-PLAN.md"),
      securityPlanContent(withThreatModel, {
        threatId,
        mitigation: threatMitigation,
        threatModelFormat
      }),
      "utf8"
    );
  }

  if (extraPendingPlan) {
    await writeFile(
      path.join(phaseDir, "05-02-PLAN.md"),
      securityPlanContent(true, { planId: "02", threatId: "T-02" }),
      "utf8"
    );
  }

  if (extraCompletedPlan) {
    await writeFile(
      path.join(phaseDir, "05-02-PLAN.md"),
      securityPlanContent(true, { planId: "02", threatId: extraCompletedPlanThreatId }),
      "utf8"
    );
    await writeFile(
      path.join(phaseDir, "05-02-SUMMARY.md"),
      completedSecuritySummaryContent("02"),
      "utf8"
    );
  }

  if (withSummary) {
    await writeFile(
      path.join(phaseDir, "05-01-SUMMARY.md"),
      completedSecuritySummaryContent(),
      "utf8"
    );
  }

  return repoPath;
}

function createSecurityModel(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    status: "COMPLETED",
    readiness: "ready-for-routing",
    completionState: "complete",
    securitySummary: [
      "The declared threat was checked against completed execution evidence and has no open gap."
    ],
    evidenceCoverage: {
      ".blueprint/phases/05-security-audit/05-01-PLAN.md": {
        status: "used",
        rationale: "Plan 01 declared tampering risk for the review substrate."
      },
      ".blueprint/phases/05-security-audit/05-01-SUMMARY.md": {
        status: "used",
        rationale: "Summary 01 records MCP review persistence as delivered work."
      }
    },
    threatRegister: [
      {
        threatId: "T-01",
        status: "closed",
        evidence: "Summary 01 records the MCP review record path as completed.",
        verifierNote: "The mitigation evidence matches the saved threat register."
      }
    ],
    acceptedRisks: [],
    findings: [],
    manualOrDeferredWork: [],
    gapRoutes: [],
    followUps: [],
    auditTrail: {
      auditDate: "2026-04-30",
      executionMode: "inline",
      overwriteGate: "not-needed",
      verifyOrAcceptDecision: "verified",
      pendingOpenThreatStatus: "none",
      verifierNote: "The single declared tampering row was reconciled with summary evidence."
    },
    nextSafeAction: "/blu-validate-phase 5",
    ...overrides
  };
}

function createNoThreatModelPartialModel(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return createSecurityModel({
    status: "PARTIAL",
    readiness: "needs-follow-up",
    completionState: "partial",
    securitySummary: [
      "Completed execution evidence exists, but no saved threat model was available in the linked plan."
    ],
    threatRegister: [],
    acceptedRisks: [],
    findings: [
      {
        kind: "missing-control",
        severity: "unknown",
        threatId: "unregistered",
        evidence: "The linked plan did not declare a threat model.",
        recommendation: "Add a saved threat model before claiming completed security coverage.",
        status: "follow-up"
      }
    ],
    manualOrDeferredWork: [
      {
        item: "Saved threat model review",
        reason: "The linked plan did not declare one.",
        followUp: "/blu-progress",
        status: "DEFERRED"
      }
    ],
    gapRoutes: [
      {
        gap: "Missing saved threat model",
        evidence: "No Threat Model section appeared in the linked plan.",
        repair: "Add declared threats or record explicit no-threat rationale.",
        status: "OPEN"
      }
    ],
    followUps: ["Add declared threat-model evidence before claiming full security completion."],
    auditTrail: {
      auditDate: "2026-04-30",
      executionMode: "inline",
      overwriteGate: "not-needed",
      verifyOrAcceptDecision: "none",
      pendingOpenThreatStatus: "none",
      verifierNote: "No declared threats were available to close."
    },
    nextSafeAction: "/blu-progress",
    ...overrides
  });
}

function createNoThreatCompletedModel(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return createSecurityModel({
    status: "COMPLETED",
    readiness: "ready-for-routing",
    completionState: "complete",
    securitySummary: [
      "The linked plans explicitly declared no in-scope threats, and completed execution evidence stayed within that saved scope."
    ],
    threatRegister: [],
    acceptedRisks: [],
    findings: [],
    manualOrDeferredWork: [],
    gapRoutes: [],
    followUps: [],
    auditTrail: {
      auditDate: "2026-04-30",
      executionMode: "inline",
      overwriteGate: "not-needed",
      verifyOrAcceptDecision: "none",
      pendingOpenThreatStatus: "none",
      verifierNote: "Saved plan evidence explicitly declared no threats for this completed phase."
    },
    nextSafeAction: "/blu-validate-phase 5",
    ...overrides
  });
}

test("secure-phase docs and catalog metadata keep the security review slice implemented and spine-aligned", async () => {
  const [catalogMarkdown, skillsMarkdown, commandDoc, runtimeReference] = await Promise.all([
    readFile(path.join(repoRoot, "docs/COMMAND-CATALOG.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/SKILLS-AND-AGENTS.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/commands/secure-phase.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  assert.match(
    catalogMarkdown,
    /\| `secure-phase` \| 4 \| `Quality And Shipping` \| `blueprint-review` \| `implemented` \| `phase XX-SECURITY\.md` \| `Low: audit artifact only\.` \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-review` \| `implemented` \| Reviews, bounded remediation, security, UI, peer review \| `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `ui-review`, `review` \|/
  );
  assert.match(commandDoc, /review\.security JSON model/i);
  assert.match(commandDoc, /Markdown content fallback is not supported/i);
  assert.match(commandDoc, /`pending-open-threat`/i);
  assert.match(commandDoc, /saved plan evidence only/i);
  assert.match(runtimeReference, /`secure-phase`[\s\S]*model-only/i);
});

test("blueprint_review_record validates model-only security artifacts and MCP renders none rows for empty arrays", async (t) => {
  const repoPath = await createSecurePhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const context = await blueprintReviewAuthoringContext({
    cwd: repoPath,
    phase: "5",
    artifact: "security"
  });
  const validation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: createSecurityModel()
  });
  const written = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: createSecurityModel()
  });

  assert.equal(context.status, "ready");
  assert.deepEqual(
    context.authoringContext && "declaredThreats" in context.authoringContext
      ? context.authoringContext.declaredThreats.map((threat) => threat.threatId)
      : [],
    ["T-01"]
  );
  assert.equal(validation.status, "valid");
  assert.match(validation.renderPreview ?? "", /\*\*Status:\*\* COMPLETED/);
  assert.match(validation.renderPreview ?? "", /## Accepted Risks[\s\S]*\| none \|/);
  assert.match(validation.renderPreview ?? "", /## Findings[\s\S]*\| none \|/);
  assert.match(validation.renderPreview ?? "", /## Follow-Ups[\s\S]*- none/);
  assert.equal(written.status, "created");
  assert.equal(written.reportPath, ".blueprint/phases/05-security-audit/05-SECURITY.md");
  assert.equal(written.counts.findings, 0);
  assert.equal(written.counts.followUps, 0);

  const saved = await readFile(path.join(repoPath, written.reportPath), "utf8");
  assert.match(saved, /\*\*Status:\*\* COMPLETED/);
  assert.match(saved, /\.blueprint\/phases\/05-security-audit\/05-01-PLAN\.md/);
  assert.match(saved, /Tampering/);
  assert.match(saved, /Review substrate/);
  assert.match(saved, /## Accepted Risks[\s\S]*\| none \|/);
  assert.match(saved, /## Gap \/ Repair Routes[\s\S]*\| none \|/);
  assert.match(saved, /## Follow-Ups[\s\S]*- none/);

  const artifactList = await blueprintArtifactList({ cwd: repoPath });
  assert.ok(
    artifactList.artifacts.phases.includes(".blueprint/phases/05-security-audit/05-SECURITY.md")
  );
});

test("security authoring context parses explicit threat_model blocks", async (t) => {
  const repoPath = await createSecurePhaseRepo({ threatModelFormat: "xml" });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const context = await blueprintReviewAuthoringContext({
    cwd: repoPath,
    phase: "5",
    artifact: "security"
  });
  const validation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: createSecurityModel()
  });

  assert.equal(context.status, "ready");
  assert.deepEqual(
    context.authoringContext && "declaredThreats" in context.authoringContext
      ? context.authoringContext.declaredThreats.map((threat) => threat.threatId)
      : [],
    ["T-01"]
  );
  assert.equal(validation.status, "valid");
});

test("security validation requires completed summary threat flags to be covered", async (t) => {
  const repoPath = await createSecurePhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeFile(
    path.join(repoPath, ".blueprint/phases/05-security-audit/05-01-SUMMARY.md"),
    `${completedSecuritySummaryContent()}
## Threat Flags

- External webhook authentication was not represented in the saved threat model.
`,
    "utf8"
  );

  const context = await blueprintReviewAuthoringContext({
    cwd: repoPath,
    phase: "5",
    artifact: "security"
  });
  const ignored = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: createSecurityModel()
  });
  const unregisteredThreatFlagModel = (findingEvidence: string): Record<string, unknown> =>
    createSecurityModel({
      status: "PARTIAL",
      readiness: "needs-follow-up",
      completionState: "partial",
      findings: [
        {
          kind: "unregistered-flag",
          severity: "medium",
          threatId: "unregistered",
          evidence: findingEvidence,
          recommendation: "Add a saved threat row or route a focused hardening follow-up.",
          status: "follow-up"
        }
      ],
      manualOrDeferredWork: [
        {
          item: "External webhook threat registration",
          reason: "Completed summary raised an unregistered threat flag.",
          followUp: "/blu-progress",
          status: "DEFERRED"
        }
      ],
      gapRoutes: [
        {
          gap: "Unregistered summary threat flag",
          evidence: "External webhook authentication was not represented in the saved threat model.",
          repair: "Add the threat to saved plan evidence or route hardening follow-up.",
          status: "OPEN"
        }
      ],
      followUps: ["Register or route the external webhook threat flag."],
      auditTrail: {
        auditDate: "2026-04-30",
        executionMode: "inline",
        overwriteGate: "not-needed",
        verifyOrAcceptDecision: "none",
        pendingOpenThreatStatus: "none",
        verifierNote: "Unregistered summary flag is carried as a follow-up finding."
      },
      nextSafeAction: "/blu-progress"
    });
  const unrelatedFinding = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: unregisteredThreatFlagModel("A generic hardening review remains for a different surface.")
  });
  const covered = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: unregisteredThreatFlagModel(
      "External webhook authentication was not represented in the saved threat model."
    )
  });

  assert.equal(context.status, "ready");
  assert.deepEqual(
    context.authoringContext && "summaryThreatFlags" in context.authoringContext
      ? context.authoringContext.summaryThreatFlags.map((flag) => flag.evidence)
      : [],
    ["External webhook authentication was not represented in the saved threat model."]
  );
  assert.equal(ignored.status, "invalid");
  assert.match(
    ignored.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /unregistered.*threat flag|summary threat flag/i
  );
  assert.equal(unrelatedFinding.status, "valid");
  assert.match(
    unrelatedFinding.warnings.join("\n"),
    /unregistered.*threat flag|summary threat flag/i
  );
  assert.equal(covered.status, "valid");
});

test("security validation accepts paraphrased but concrete declared summary threat-flag evidence", async (t) => {
  const repoPath = await createSecurePhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeFile(
    path.join(repoPath, ".blueprint/phases/05-security-audit/05-01-SUMMARY.md"),
    `${completedSecuritySummaryContent()}
## Threat Flags

| Threat ID | Evidence |
|-----------|----------|
| T-01 | External webhook authentication drifted after execution. |
`,
    "utf8"
  );

  const ignored = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: createSecurityModel()
  });
  const covered = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: createSecurityModel({
      threatRegister: [
        {
          threatId: "T-01",
          status: "closed",
          evidence: "Completed summary threat flag shows external webhook authentication drift after execution.",
          verifierNote: "The summary threat flag was explicitly reconciled with saved mitigation evidence."
        }
      ]
    })
  });

  assert.equal(ignored.status, "valid");
  assert.match(
    ignored.warnings.join("\n"),
    /maps to declared threat T-01|summary threat flag/i
  );
  assert.equal(covered.status, "valid");
});

test("security authoring context disambiguates duplicate threat ids across plans", async (t) => {
  const repoPath = await createSecurePhaseRepo({
    extraCompletedPlan: true,
    extraCompletedPlanThreatId: "T-01"
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const context = await blueprintReviewAuthoringContext({
    cwd: repoPath,
    phase: "5",
    artifact: "security"
  });
  const duplicateAwareModel = createSecurityModel({
    evidenceCoverage: {
      ".blueprint/phases/05-security-audit/05-01-PLAN.md": {
        status: "used",
        rationale: "Plan 01 declared tampering risk for the review substrate."
      },
      ".blueprint/phases/05-security-audit/05-01-SUMMARY.md": {
        status: "used",
        rationale: "Summary 01 records MCP review persistence as delivered work."
      },
      ".blueprint/phases/05-security-audit/05-02-PLAN.md": {
        status: "used",
        rationale: "Plan 02 reused the local threat identifier and needs plan-scoped provenance."
      },
      ".blueprint/phases/05-security-audit/05-02-SUMMARY.md": {
        status: "used",
        rationale: "Summary 02 records the second completed plan as security evidence."
      }
    },
    threatRegister: [
      {
        threatId: "T-01",
        status: "closed",
        evidence: "Summary 01 records the MCP review record path as completed.",
        verifierNote: "The mitigation evidence matches the first saved threat register."
      },
      {
        threatId: "05-02-T-01",
        status: "closed",
        evidence: "Summary 02 records the MCP review record path as completed.",
        verifierNote: "The mitigation evidence matches the second saved threat register."
      }
    ]
  });
  const collapsedModel = createSecurityModel({
    evidenceCoverage: duplicateAwareModel.evidenceCoverage,
    threatRegister: [
      {
        threatId: "T-01",
        status: "closed",
        evidence: "Only one row would collapse duplicate plan threats.",
        verifierNote: "This should fail because plan 02 also declared T-01."
      }
    ]
  });

  const collapsedValidation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: collapsedModel
  });
  const duplicateAwareValidation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: duplicateAwareModel
  });

  assert.equal(context.status, "ready");
  assert.deepEqual(
    context.authoringContext && "declaredThreats" in context.authoringContext
      ? context.authoringContext.declaredThreats.map((threat) => threat.threatId)
      : [],
    ["T-01", "05-02-T-01"]
  );
  assert.equal(collapsedValidation.status, "invalid");
  assert.match(
    collapsedValidation.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must NOT have fewer than 2 items|must contain at least 1 valid item/i
  );
  assert.equal(duplicateAwareValidation.status, "valid");
});

test("security schema rejects unsupported fields, missing required fields, and unsafe rendered sinks", async (t) => {
  const repoPath = await createSecurePhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const unsupported = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: createSecurityModel({
      reportPath: ".blueprint/phases/05-security-audit/05-SECURITY.md"
    })
  });
  const missingModel = createSecurityModel();
  delete missingModel.evidenceCoverage;
  const missing = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: missingModel
  });
  const injected = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: createSecurityModel({
      threatRegister: [
        {
          threatId: "T-01",
          status: "closed",
          evidence: "safe evidence\n## Injected",
          verifierNote: "The mitigation evidence matches the saved threat register."
        }
      ]
    })
  });

  assert.equal(unsupported.status, "invalid");
  assert.match(
    unsupported.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must NOT have additional properties|runtime-owned/i
  );
  assert.equal(missing.status, "invalid");
  assert.match(
    missing.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must have required property 'evidenceCoverage'/i
  );
  assert.equal(injected.status, "invalid");
  assert.match(
    injected.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must match pattern/i
  );
});

test("security runtime narrowing returns actionable diagnostics for out-of-scope evidence keys and stale threat ids", async (t) => {
  const repoPath = await createSecurePhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const baseModel = createSecurityModel();
  const staleEvidence = createSecurityModel({
    evidenceCoverage: {
      ...(baseModel.evidenceCoverage as Record<string, unknown>),
      ".blueprint/phases/05-security-audit/05-99-SUMMARY.md": {
        status: "used",
        rationale: "Stale summary should not be accepted."
      }
    }
  });
  const staleThreat = createSecurityModel({
    threatRegister: [
      {
        threatId: "T-99",
        status: "closed",
        evidence: "Invented stale threat evidence.",
        verifierNote: "This threat is not in the saved plan."
      }
    ]
  });

  const staleEvidenceResult = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: staleEvidence
  });
  const staleThreatResult = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: staleThreat
  });

  assert.equal(staleEvidenceResult.status, "valid");
  assert.match(
    staleEvidenceResult.warnings.join("\n"),
    /outside the live phase inventory|knownEvidenceArtifacts/i
  );
  assert.equal(staleThreatResult.status, "invalid");
  assert.match(
    staleThreatResult.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /saved-plan register|declared threat|stale threat id/i
  );
});

test("security authoring context blocks missing required upstream summaries and pending plans early", async (t) => {
  const missingSummaryRepo = await createSecurePhaseRepo({ withSummary: false });
  const pendingRepo = await createSecurePhaseRepo({ extraPendingPlan: true });
  t.after(async () => {
    await rm(path.dirname(missingSummaryRepo), { recursive: true, force: true });
    await rm(path.dirname(pendingRepo), { recursive: true, force: true });
  });

  const missingContext = await blueprintReviewAuthoringContext({
    cwd: missingSummaryRepo,
    phase: "5",
    artifact: "security"
  });
  const missingValidation = await blueprintReviewValidateModel({
    cwd: missingSummaryRepo,
    phase: "5",
    artifact: "security",
    model: createSecurityModel()
  });
  const pendingContext = await blueprintReviewAuthoringContext({
    cwd: pendingRepo,
    phase: "5",
    artifact: "security"
  });

  assert.equal(missingContext.status, "ready");
  assert.notEqual(missingContext.taskSchema, null);
  assert.match(missingContext.warnings.join("\n"), /no valid completed SUMMARY/i);
  assert.equal(missingValidation.status, "invalid");
  assert.match(
    [
      ...missingValidation.diagnostics.map((diagnostic) => diagnostic.message),
      ...missingValidation.warnings
    ].join("\n"),
    /no valid completed SUMMARY|completed phase execution evidence/i
  );
  assert.equal(pendingContext.status, "ready");
  assert.match(pendingContext.warnings.join("\n"), /pending execution plans/i);
});

test("security missing threat-model context narrows authoring to PARTIAL or BLOCKED and returns actionable diagnostics", async (t) => {
  const repoPath = await createSecurePhaseRepo({ withThreatModel: false });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const context = await blueprintReviewAuthoringContext({
    cwd: repoPath,
    phase: "5",
    artifact: "security"
  });
  const valid = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: createNoThreatModelPartialModel()
  });
  const inventedThreat = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: createNoThreatModelPartialModel({
      threatRegister: [
        {
          threatId: "T-01",
          status: "closed",
          evidence: "Invented threat evidence.",
          verifierNote: "This should not be accepted."
        }
      ]
    })
  });
  const inventedFindingThreat = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: createNoThreatModelPartialModel({
      findings: [
        {
          kind: "missing-control",
          severity: "unknown",
          threatId: "T-999",
          evidence: "The linked plan did not declare a threat model.",
          recommendation: "Add a saved threat model before claiming completed security coverage.",
          status: "follow-up"
        }
      ]
    })
  });
  const pendingPartialDecision = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: createNoThreatModelPartialModel({
      auditTrail: {
        auditDate: "2026-04-30",
        executionMode: "inline",
        overwriteGate: "not-needed",
        verifyOrAcceptDecision: "pending",
        pendingOpenThreatStatus: "none",
        verifierNote: "PARTIAL should route follow-up without holding a pending open-threat gate."
      }
    })
  });
  const falseCompleted = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: createNoThreatModelPartialModel({
      status: "COMPLETED",
      readiness: "ready-for-routing",
      completionState: "complete",
      nextSafeAction: "/blu-validate-phase 5"
    })
  });

  assert.equal(context.status, "ready");
  assert.match(JSON.stringify(context.taskSchema), /"enum":\["PARTIAL","BLOCKED"\]|"PARTIAL"/);
  assert.equal(valid.status, "valid");
  assert.equal(inventedThreat.status, "invalid");
  assert.match(
    inventedThreat.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /no declared threats|leave the threat register empty|saved threat model/i
  );
  assert.equal(inventedFindingThreat.status, "invalid");
  assert.match(
    inventedFindingThreat.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /no declared threats|unregistered findings|saved threat model|No declared threats exist/i
  );
  assert.equal(pendingPartialDecision.status, "invalid");
  assert.match(
    pendingPartialDecision.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /pending.*open threat|verify-or-accept decision/i
  );
  assert.equal(falseCompleted.status, "invalid");
  assert.match(
    falseCompleted.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /PARTIAL|BLOCKED|saved threat model/i
  );
});

test("security threat parser treats N/A threat rows and bullets as explicit no-threat evidence for completed reports", async (t) => {
  const tableRepo = await createSecurePhaseRepo({ threatId: "N/A" });
  const bulletRepo = await createSecurePhaseRepo();
  t.after(async () => {
    await rm(path.dirname(tableRepo), { recursive: true, force: true });
    await rm(path.dirname(bulletRepo), { recursive: true, force: true });
  });
  await writeFile(
    path.join(bulletRepo, ".blueprint/phases/05-security-audit/05-01-PLAN.md"),
    securityPlanContent(false).replace(
      "## Tasks",
      `## Threat Model

- n/a: No saved threat model rows for this plan.

## Tasks`
    ),
    "utf8"
  );

  for (const repoPath of [tableRepo, bulletRepo]) {
    const context = await blueprintReviewAuthoringContext({
      cwd: repoPath,
      phase: "5",
      artifact: "security"
    });
    const validation = await blueprintReviewValidateModel({
      cwd: repoPath,
      phase: "5",
      artifact: "security",
      model: createNoThreatCompletedModel()
    });

    assert.equal(context.status, "ready");
    assert.deepEqual(
      context.authoringContext && "declaredThreats" in context.authoringContext
        ? context.authoringContext.declaredThreats.map((threat) => threat.threatId)
        : [],
      []
    );
    assert.equal(validation.status, "valid");
    assert.match(validation.renderPreview ?? "", /## Threat Register[\s\S]*\| none \|/);
    assert.match(validation.renderPreview ?? "", /## Accepted Risks[\s\S]*\| none \|/);
  }
});

test("security finding table rows are counted and loaded from persisted security artifacts", async (t) => {
  const repoPath = await createSecurePhaseRepo({ withThreatModel: false });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const written = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: createNoThreatModelPartialModel()
  });
  const loaded = await blueprintReviewLoadFindings({
    cwd: repoPath,
    phase: "5",
    artifact: "security"
  });

  assert.equal(written.status, "created");
  assert.equal(written.counts.findings, 1);
  assert.equal(loaded.found, true);
  assert.deepEqual(
    loaded.findings.map((finding) => [finding.severity, finding.sourceSection]),
    [["unknown", "Findings"]]
  );
  assert.match(loaded.findings[0]?.summary ?? "", /missing-control unregistered/i);
  assert.match(loaded.findings[0]?.summary ?? "", /linked plan did not declare a threat model/i);
});

test("security writer rejects markdown fallback and preserves overwrite protection", async (t) => {
  const repoPath = await createSecurePhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const markdownRejected = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    content: "# Security\n"
  });
  const created = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: createSecurityModel()
  });
  const reused = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: createSecurityModel()
  });

  assert.equal(markdownRejected.status, "invalid");
  assert.match(markdownRejected.warnings.join("\n"), /model-only|content is invalid/i);
  assert.equal(created.status, "created");
  assert.equal(reused.status, "reused");
  const changedModel = createSecurityModel({
    securitySummary: ["Changed security model content requires overwrite confirmation."]
  });
  await assert.rejects(
    () =>
      blueprintReviewRecord({
        cwd: repoPath,
        phase: "5",
        artifact: "security",
        model: changedModel
      }),
    /explicit overwrite confirmation/
  );
});

test("security residual validation still blocks generic and contradictory accepted-risk content", async (t) => {
  const repoPath = await createSecurePhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const generic = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: createSecurityModel({
      securitySummary: ["none"]
    })
  });
  const contradiction = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: createSecurityModel({
      status: "PARTIAL",
      readiness: "needs-follow-up",
      completionState: "partial",
      threatRegister: [
        {
          threatId: "T-01",
          status: "closed",
          evidence: "The completed summary cites the MCP-owned persistence path.",
          verifierNote: "The mitigation evidence matches the saved threat register."
        }
      ],
      acceptedRisks: [
        {
          threatId: "T-01",
          rationale: "Accepting a risk without an accepted threat row should be rejected.",
          acceptedBy: "security lead",
          acceptedAt: "2026-04-30",
          evidence: "user decision"
        }
      ],
      findings: [
        {
          kind: "hardening-follow-up",
          severity: "low",
          threatId: "T-01",
          evidence: "Follow-up hardening remains useful.",
          recommendation: "Track hardening through progress.",
          status: "follow-up"
        }
      ],
      manualOrDeferredWork: [
        {
          item: "Hardening review",
          reason: "Non-blocking follow-up remains.",
          followUp: "/blu-progress",
          status: "DEFERRED"
        }
      ],
      gapRoutes: [
        {
          gap: "Hardening follow-up",
          evidence: "Review suggested one non-blocking improvement.",
          repair: "Track through progress.",
          status: "OPEN"
        }
      ],
      followUps: ["Track non-blocking hardening."],
      auditTrail: {
        auditDate: "2026-04-30",
        executionMode: "inline",
        overwriteGate: "not-needed",
        verifyOrAcceptDecision: "none",
        pendingOpenThreatStatus: "none",
        verifierNote: "Contradictory accepted risk should be rejected."
      },
      nextSafeAction: "/blu-progress"
    })
  });
  const mixedSentinel = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: createSecurityModel({
      threatRegister: [
        {
          threatId: "T-01",
          status: "accepted",
          evidence: "The user explicitly accepted the residual risk after reviewing the completed summary.",
          verifierNote: "Acceptance is documented with a named owner and date."
        }
      ],
      acceptedRisks: [
        {
          threatId: "none",
          rationale: "none",
          acceptedBy: "none",
          acceptedAt: "none",
          evidence: "none"
        },
        {
          threatId: "T-01",
          rationale: "Residual risk is acceptable for this phase after documented user review.",
          acceptedBy: "security lead",
          acceptedAt: "2026-04-30",
          evidence: "User acceptance recorded in the secure-phase decision."
        }
      ],
      auditTrail: {
        auditDate: "2026-04-30",
        executionMode: "inline",
        overwriteGate: "not-needed",
        verifyOrAcceptDecision: "accepted",
        pendingOpenThreatStatus: "accepted",
        verifierNote: "Mixed sentinel plus real acceptance should be rejected."
      }
    })
  });

  assert.equal(generic.status, "invalid");
  assert.match(
    generic.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /generic none/i
  );
  assert.equal(contradiction.status, "invalid");
  assert.match(
    contradiction.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /Accepted risk rows must map/i
  );
  assert.equal(mixedSentinel.status, "invalid");
  assert.ok(
    mixedSentinel.diagnostics.some((diagnostic) => diagnostic.source === "schema"),
    "mixed sentinel rejection should be owned by JSON Schema"
  );
  assert.match(
    mixedSentinel.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must NOT have more than 1 items|must be equal to constant|must match exactly one schema/i
  );
});

test("blueprint_review_record counts open threat-register rows as security findings", async (t) => {
  const repoPath = await createSecurePhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const blockedModel = createSecurityModel({
    status: "BLOCKED",
    readiness: "blocked",
    completionState: "blocked",
    threatRegister: [
      {
        threatId: "T-01",
        status: "open",
        evidence: "Missing saved mitigation evidence for the declared threat.",
        verifierNote: "The verify-versus-accept decision remains pending."
      }
    ],
    findings: [
      {
        kind: "open-threat",
        severity: "unknown",
        threatId: "T-01",
        evidence: "Missing saved mitigation evidence for the declared threat.",
        recommendation: "Verify the mitigation or explicitly accept the risk before routing onward.",
        status: "open"
      }
    ],
    manualOrDeferredWork: [
      {
        item: "Verify or accept T-01",
        reason: "The declared mitigation is not proven.",
        followUp: "Ask the user for verify-versus-accept decision.",
        status: "MANUAL"
      }
    ],
    gapRoutes: [
      {
        gap: "Open threat T-01",
        evidence: "Missing saved mitigation evidence for the declared threat.",
        repair: "Verify mitigation evidence or accept risk explicitly.",
        status: "BLOCKED"
      }
    ],
    followUps: ["Verify the mitigation or explicitly accept the risk."],
    auditTrail: {
      auditDate: "2026-04-30",
      executionMode: "inline",
      overwriteGate: "not-needed",
      verifyOrAcceptDecision: "pending",
      pendingOpenThreatStatus: "still-open",
      verifierNote: "Open threat blocks next-step routing."
    },
    nextSafeAction: "Blocked: pending-open-threat"
  });
  const written = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: blockedModel
  });
  const loaded = await blueprintReviewLoadFindings({
    cwd: repoPath,
    phase: "5",
    artifact: "security"
  });

  assert.equal(written.status, "created");
  assert.equal(written.counts.findings, 1);
  assert.equal(loaded.found, true);
  assert.deepEqual(
    loaded.findings.map((finding) => [finding.id, finding.severity, finding.summary]),
    [["F-01", "unknown", "Open threat T-01: Missing saved mitigation evidence for the declared threat."]]
  );
});

test("security threat-register parsing preserves escaped pipes before open threat status", async (t) => {
  const repoPath = await createSecurePhaseRepo({
    threatMitigation: "Persist review evidence across API\\|CLI boundaries."
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const written = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    model: createSecurityModel({
      status: "BLOCKED",
      readiness: "blocked",
      completionState: "blocked",
      threatRegister: [
        {
          threatId: "T-01",
          status: "open",
          evidence: "Missing saved mitigation evidence for the declared threat.",
          verifierNote: "The verify-versus-accept decision remains pending."
        }
      ],
      findings: [
        {
          kind: "open-threat",
          severity: "unknown",
          threatId: "T-01",
          evidence: "Missing saved mitigation evidence for the declared threat.",
          recommendation: "Verify the mitigation or explicitly accept the risk before routing onward.",
          status: "open"
        }
      ],
      manualOrDeferredWork: [
        {
          item: "Verify or accept T-01",
          reason: "The declared mitigation is not proven.",
          followUp: "Ask the user for verify-versus-accept decision.",
          status: "MANUAL"
        }
      ],
      gapRoutes: [
        {
          gap: "Open threat T-01",
          evidence: "Missing saved mitigation evidence for the declared threat.",
          repair: "Verify mitigation evidence or accept risk explicitly.",
          status: "BLOCKED"
        }
      ],
      followUps: ["Verify the mitigation or explicitly accept the risk."],
      auditTrail: {
        auditDate: "2026-04-30",
        executionMode: "inline",
        overwriteGate: "not-needed",
        verifyOrAcceptDecision: "pending",
        pendingOpenThreatStatus: "still-open",
        verifierNote: "Open threat blocks next-step routing."
      },
      nextSafeAction: "Blocked: pending-open-threat"
    })
  });
  const saved = await readFile(path.join(repoPath, written.reportPath), "utf8");
  const loaded = await blueprintReviewLoadFindings({
    cwd: repoPath,
    phase: "5",
    artifact: "security"
  });

  assert.match(saved, /API\\\|CLI/);
  assert.equal(loaded.found, true);
  assert.deepEqual(
    loaded.findings.map((finding) => [finding.severity, finding.summary]),
    [["unknown", "Open threat T-01: Missing saved mitigation evidence for the declared threat."]]
  );
});

test("secure-phase is exposed as an implemented review command with the registered review tools", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["secure-phase"];

  assert.ok(blueprintToolNames.includes("blueprint_review_authoring_context"));
  assert.ok(blueprintToolNames.includes("blueprint_review_validate_model"));
  assert.ok(blueprintToolNames.includes("blueprint_review_record"));
  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.manifestPath, "commands/blu-secure-phase.toml");
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_contract_read",
    "blueprint_artifact_list",
    "blueprint_phase_execution_targets",
    "blueprint_phase_locate",
    "blueprint_phase_plan_index",
    "blueprint_phase_plan_read",
    "blueprint_phase_summary_index",
    "blueprint_phase_summary_read",
    "blueprint_review_authoring_context",
    "blueprint_review_record",
    "blueprint_review_validate_model"
  ].sort());
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-security-auditor"]);
});
