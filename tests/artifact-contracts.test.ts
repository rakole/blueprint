import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  artifactContractIds,
  listArtifactContracts,
  readArtifactContract,
  resolveReportContractId
} from "../src/mcp/artifact-contracts/index.js";
import { blueprintToolNames } from "../src/mcp/server.js";
import {
  blueprintArtifactContractRead,
  validatePhaseArtifactContent,
  validateReportArtifactContent,
  validateResearchArtifactContent,
  validateReviewArtifactContent,
  validateUatArtifactContent,
  validateVerificationArtifactContent
} from "../src/mcp/tools/artifacts.js";

function canonicalResearchContent(summary: string, requirementRows: string): string {
  return `# Phase 03: Discovery - Research

**Researched:** 2026-04-18
**Domain:** blueprint contracts
**Confidence:** HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
${requirementRows}

## Summary

- ${summary}

## Locked Decisions From Context

- Keep the phase research contract MCP-owned and planner-facing.

## User Constraints

- Keep commands thin and MCP-owned.

## Standard Stack

- TypeScript, MCP tools, markdown artifacts.

### Dependency / Tool Evaluation

| Decision ID | Need | Candidate | Decision | Official Source Or Repo Evidence | Package Ecosystem | Install Scope | Current / Wanted / Latest Evidence | Maintenance Signal | Vulnerability Signal | License | Provenance / Signature Signal | Transitive Footprint | Existing / Standard-Library Alternative | Update Posture | Residual Risk And Mitigation |
|-------------|------|-----------|----------|----------------------------------|-------------------|---------------|------------------------------------|--------------------|----------------------|---------|-------------------------------|---------------------|------------------------------------------|----------------|-------------------------------|
| DEP-001 | Research artifact validation | Existing MCP artifact validator | use_existing | src/mcp/tools/artifacts.ts | repo-local | none | local source observed | maintained in repo tests | unchecked - repo-only fixture | repository license context | unchecked - repo-only fixture | none | existing dependency and repo validator | focused tests plus normal build | Low risk; keep validation fixture coverage. |

## Installation And Setup

- Build the repo and validate fixtures through the standard test harness.

### Setup And Update Posture

| Decision ID | Manifest / Lockfile Impact | Install Command Or Path | Install Scope | Side Effects | Verification Command | Update / Monitoring Plan | Manual Review Required |
|-------------|----------------------------|-------------------------|---------------|--------------|----------------------|--------------------------|------------------------|
| DEP-001 | none | none | none | none | npx tsx --test tests/phase-discovery-research.test.ts | normal repo dependency maintenance | no - existing repo validator only |

## Alternatives Considered

- Prompt-local templates were rejected because they drift from the MCP contract.

### Dependency Alternatives

| Decision ID | Need | No New Dependency | Existing Dependency | Standard Library / Platform API | Candidate Package / Tool | Custom Implementation | Decision | Rationale |
|-------------|------|-------------------|---------------------|---------------------------------|--------------------------|----------------------|----------|-----------|
| DEP-001 | Research artifact validation | viable - keep existing validator | viable - current MCP validator exists | insufficient alone - markdown semantics are project-specific | rejected - no new package needed | rejected - duplicate validation logic would drift | use_existing | Existing validator already owns the phase.research contract. |

## Architecture Patterns

- Runtime-owned contract registry with read-only access.

## Don't Hand-Roll

- Avoid copying templates into command prompts.

### Library Vs Custom Decision

| Decision ID | Capability | Domain Risk | Proven Library / Existing Option | Custom Path Allowed? | Rationale | Required Tests / Validation | Maintenance / Update Owner |
|-------------|------------|-------------|----------------------------------|----------------------|-----------|-----------------------------|----------------------------|
| DEP-001 | Research artifact validation | low-risk-project-specific | Existing MCP validator | no | A second custom path would drift from MCP-owned validation. | phase discovery research tests | Blueprint runtime maintainers |

## Anti-Patterns

- Treating scaffold-shaped output as sufficient research evidence.

## State Of The Art

- Not externally checked; this unit fixture validates local contract behavior only.
- Template-driven drafting keeps the agent aligned with the live runtime contract.

## Common Pitfalls

- Drift between docs, skills, and validators.

## Open Questions

- Should critical external claims eventually require multi-source support?

## Confidence Breakdown

| Topic | Confidence | Why |
|-------|------------|-----|
| Contract parity | HIGH | The canonical contract is enforced by runtime code and test fixtures. |

## Code Examples

\`\`\`text
Read the contract, then normalize before writing.
\`\`\`

## Recommendations

- Fetch the canonical contract before persistence.

## Sources

- \`src/mcp/artifact-contracts/index.ts\` - canonical registry implementation.

### Supply Chain Evidence

- Supply-chain evidence: repo-local validator, \`src/mcp/tools/artifacts.ts\`, accessed/observed 2026-04-11, signal=version, supports=DEP-001; source policy=off.

## Additional Context

- Extra top-level notes stay allowed when the contract policy says so.
`;
}

test("artifact contract read exposes structured model contracts for phase plan, phase summary, phase UAT, quick run, add-tests, and audit-fix", async () => {
  const planContract = await blueprintArtifactContractRead({ artifactId: "phase.plan" });
  const summaryContract = await blueprintArtifactContractRead({ artifactId: "phase.summary" });
  const uatContract = await blueprintArtifactContractRead({ artifactId: "phase.uat" });
  const quickRunContract = await blueprintArtifactContractRead({
    artifactId: "report.quick-run"
  });
  const addTestsContract = await blueprintArtifactContractRead({
    artifactId: "report.add-tests"
  });
  const auditFixReportContract = await blueprintArtifactContractRead({
    artifactId: "report.audit-fix"
  });
  const listedContracts = await blueprintArtifactContractRead({});
  const listedPlanContract = listedContracts.contracts.find(
    (contract) => contract.id === "phase.plan"
  );
  const listedSummaryContract = listedContracts.contracts.find(
    (contract) => contract.id === "phase.summary"
  );
  const listedQuickRunContract = listedContracts.contracts.find(
    (contract) => contract.id === "report.quick-run"
  );
  const listedAddTestsContract = listedContracts.contracts.find(
    (contract) => contract.id === "report.add-tests"
  );
  const listedAuditFixContract = listedContracts.contracts.find(
    (contract) => contract.id === "report.audit-fix"
  );
  const listedUatContract = listedContracts.contracts.find(
    (contract) => contract.id === "phase.uat"
  );

  assert.equal(planContract.contract.modelContract?.schemaId, "blueprint.phase.plan.model");
  assert.equal(planContract.contract.modelContract?.schemaVersion, "1.0.0");
  assert.equal(
    planContract.contract.modelContract?.schemaPath,
    "src/mcp/artifact-contracts/schemas/phase.plan.model.schema.json"
  );
  assert.deepEqual(
    (planContract.contract.modelContract?.jsonSchema.required as string[]).slice(0, 4),
    ["title", "wave", "status", "objective"]
  );
  const expectedPlanHeadings = [
    "Goal",
    "Scope",
    "Tasks",
    "Verification",
    "Must Haves",
    "Requirement Coverage",
    "Evidence Coverage",
    "File / Surface Coverage",
    "Unknowns And Deferrals"
  ];
  assert.deepEqual(planContract.contract.requiredHeadings, expectedPlanHeadings);
  assert.deepEqual(planContract.contract.modelContract?.renderedHeadings, expectedPlanHeadings);
  for (const heading of expectedPlanHeadings) {
    assert.match(planContract.contract.authoringTemplate, new RegExp(`## ${heading}`));
  }
  assert.ok(
    planContract.contract.modelContract?.contextBindings.some((binding) =>
      /auto-assigned by the existing phase plan writer/i.test(binding)
    )
  );
  const planModelProperties = planContract.contract.modelContract?.jsonSchema.properties as
    | Record<string, unknown>
    | undefined;
  assert.equal(Boolean(planModelProperties && "planId" in planModelProperties), false);
  assert.ok(planModelProperties && "requirementCoverage" in planModelProperties);
  assert.ok(planModelProperties && "fileSurfaceCoverage" in planModelProperties);
  assert.match(
    JSON.stringify(planModelProperties?.requirements),
    /covers now.*requirementCoverage accounts for every known phase requirement exactly once/i
  );
  assert.match(
    JSON.stringify(planModelProperties?.evidenceCoverage),
    /runtime-narrowed.*saved plan files can become evidence artifacts/i
  );

  assert.equal(uatContract.contract.modelContract?.schemaId, "blueprint.phase.uat.model");
  assert.equal(uatContract.contract.modelContract?.schemaVersion, "1.0.0");
  assert.equal(
    uatContract.contract.modelContract?.schemaPath,
    "src/mcp/artifact-contracts/schemas/phase.uat.model.schema.json"
  );
  assert.deepEqual(
    (uatContract.contract.modelContract?.jsonSchema.required as string[]).slice(0, 4),
    ["status", "resumeState", "checkpoint", "uatSummary"]
  );
  assert.ok(
    uatContract.contract.modelContract?.renderedHeadings.includes("Test Matrix")
  );
  assert.ok(
    uatContract.contract.modelContract?.renderedHeadings.includes("Structured Gaps")
  );

  assert.equal(summaryContract.contract.modelContract, undefined);
  assert.ok(
    summaryContract.contract.notes.some((note) =>
      /Markdown-first/i.test(note)
    )
  );

  assert.equal(
    quickRunContract.contract.modelContract?.schemaId,
    "blueprint.report.quick-run.model"
  );
  assert.equal(quickRunContract.contract.modelContract?.schemaVersion, "1.0.0");
  assert.deepEqual(
    (quickRunContract.contract.modelContract?.jsonSchema.required as string[]).slice(0, 3),
    ["taskSummary", "changedSurfaces", "evidenceUsed"]
  );
  assert.ok(
    quickRunContract.contract.modelContract?.renderedHeadings.includes("Changed Surfaces")
  );
  assert.ok(quickRunContract.contract.modelContract?.renderedHeadings.includes("Evidence Used"));
  assert.ok(
    quickRunContract.contract.modelContract?.qualityRules.some((rule) =>
      /bounded enough for a quick run/i.test(rule)
    )
  );

  assert.equal(listedPlanContract?.modelContract?.schemaId, "blueprint.phase.plan.model");
  assert.equal(listedUatContract?.modelContract?.schemaId, "blueprint.phase.uat.model");
  assert.equal(listedSummaryContract?.modelContract, undefined);
  assert.equal(
    listedQuickRunContract?.modelContract?.schemaId,
    "blueprint.report.quick-run.model"
  );

  assert.equal(
    addTestsContract.contract.modelContract?.schemaId,
    "blueprint.report.add-tests.model"
  );
  assert.equal(addTestsContract.contract.modelContract?.schemaVersion, "1.0.0");
  assert.equal(
    addTestsContract.contract.modelContract?.schemaPath,
    "src/mcp/artifact-contracts/schemas/report.add-tests.model.schema.json"
  );
  assert.deepEqual(
    (addTestsContract.contract.modelContract?.jsonSchema.required as string[]).slice(0, 4),
    ["status", "readiness", "completionState", "coverageGoal"]
  );
  assert.ok(
    addTestsContract.contract.modelContract?.renderedHeadings.includes(
      "Classification And Test Plan"
    )
  );
  assert.ok(
    addTestsContract.contract.modelContract?.qualityRules.some((rule) =>
      /COMPLETED add-tests reports require/i.test(rule)
    )
  );
  assert.ok(
    addTestsContract.contract.modelContract?.contextBindings.some((binding) =>
      /validation or UAT artifact is required upstream context/i.test(binding)
    )
  );
  const addTestsModelProperties = addTestsContract.contract.modelContract?.jsonSchema.properties as
    | Record<string, unknown>
    | undefined;
  assert.equal(Boolean(addTestsModelProperties && "phase" in addTestsModelProperties), false);
  assert.equal(Boolean(addTestsModelProperties && "reportPath" in addTestsModelProperties), false);
  assert.ok(addTestsModelProperties && "summaryEvidence" in addTestsModelProperties);
  assert.equal(
    listedAddTestsContract?.modelContract?.schemaId,
    "blueprint.report.add-tests.model"
  );

  assert.equal(
    auditFixReportContract.contract.modelContract?.schemaId,
    "blueprint.report.audit-fix.model"
  );
  assert.equal(auditFixReportContract.contract.modelContract?.schemaVersion, "1.0.0");
  assert.equal(
    auditFixReportContract.contract.modelContract?.schemaPath,
    "src/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json"
  );
  assert.deepEqual(
    (auditFixReportContract.contract.modelContract?.jsonSchema.required as string[]).slice(0, 4),
    ["status", "readiness", "completionState", "remediationSummary"]
  );
  assert.ok(
    auditFixReportContract.contract.modelContract?.renderedHeadings.includes("Summary Evidence")
  );
  assert.ok(
    auditFixReportContract.contract.modelContract?.renderedHeadings.includes("Follow-Up Fixes")
  );
  assert.ok(
    auditFixReportContract.contract.modelContract?.qualityRules.some((rule) =>
      /auditFixContext/i.test(rule)
    )
  );
  assert.ok(
    auditFixReportContract.contract.modelContract?.contextBindings.some((binding) =>
      /auditFixContext/i.test(binding)
    )
  );
  assert.equal(
    auditFixReportContract.contract.placeholderSignals.includes("src/mcp/tools/review.ts"),
    false
  );
  assert.equal(
    auditFixReportContract.contract.modelContract?.exampleLeakageSignals.includes(
      "src/mcp/tools/review.ts"
    ) ?? false,
    false
  );
  const auditFixModelProperties =
    auditFixReportContract.contract.modelContract?.jsonSchema.properties as
      | Record<string, unknown>
      | undefined;
  const auditFixModelDefs = auditFixReportContract.contract.modelContract?.jsonSchema.$defs as
    | Record<string, Record<string, unknown>>
    | undefined;
  assert.equal(Boolean(auditFixModelProperties && "auditFixContext" in auditFixModelProperties), false);
  assert.ok(auditFixModelProperties && "summaryEvidence" in auditFixModelProperties);
  assert.ok(auditFixModelProperties && "todoCapture" in auditFixModelProperties);
  assert.equal(
    auditFixModelDefs?.tableCellString?.pattern,
    "^(?=.*\\S)[^\\r\\n]+$"
  );
  assert.ok(
    Array.isArray(auditFixModelDefs?.commitShaOrNone?.oneOf) &&
      auditFixModelDefs.commitShaOrNone.oneOf.some(
        (entry) => typeof entry === "object" && entry !== null && "const" in entry && entry.const === "unknown"
      )
  );
  assert.equal(
    listedAuditFixContract?.modelContract?.schemaId,
    "blueprint.report.audit-fix.model"
  );
});

test("artifact contract registry exposes canonical contract ids and templates", async () => {
  assert.ok(blueprintToolNames.includes("blueprint_artifact_contract_read"));
  assert.ok(artifactContractIds.includes("bootstrap.project"));
  assert.ok(artifactContractIds.includes("bootstrap.requirements"));
  assert.ok(artifactContractIds.includes("bootstrap.roadmap"));
  assert.ok(artifactContractIds.includes("phase.research"));
  assert.ok(artifactContractIds.includes("phase.verification"));
  assert.ok(artifactContractIds.includes("review.code-review"));
  assert.ok(artifactContractIds.includes("report.pause-work"));
  assert.ok(artifactContractIds.includes("report.impact"));

  const single = await blueprintArtifactContractRead({ artifactId: "phase.research" });
  const listed = await blueprintArtifactContractRead({});
  const projectContract = readArtifactContract("bootstrap.project");
  const requirementsContract = readArtifactContract("bootstrap.requirements");
  const roadmapContract = readArtifactContract("bootstrap.roadmap");
  const researchContract = readArtifactContract("phase.research");
  const contextContract = readArtifactContract("phase.context");
  const discussionLogContract = readArtifactContract("phase.discussion-log");
  const uiContract = readArtifactContract("phase.ui-spec");
  const summaryContract = readArtifactContract("phase.summary");
  const pauseContract = readArtifactContract("report.pause-work");
  const reviewContract = readArtifactContract("review.code-review");
  const peerReviewContract = readArtifactContract("review.peer-review");
  const reviewFixContract = readArtifactContract("review.review-fix");
  const securityContract = readArtifactContract("review.security");
  const verificationContract = readArtifactContract("phase.verification");
  const uatContract = readArtifactContract("phase.uat");
  const milestoneAuditContract = readArtifactContract("report.milestone-audit");
  const milestoneCompleteContract = readArtifactContract("report.milestone-complete");
  const milestoneSummaryContract = readArtifactContract("report.milestone-summary");
  const impactContract = readArtifactContract("report.impact");

  assert.equal(single.artifactId, "phase.research");
  assert.match(single.contract.authoringTemplate, /^# Phase XX: <Phase Name> - Research$/m);
  assert.match(single.contract.scaffoldTemplate, /\*Generated by `blueprint_artifact_scaffold`\*/);
  assert.match(researchContract.authoringTemplate, /### Dependency \/ Tool Evaluation/);
  assert.match(researchContract.authoringTemplate, /Current \/ Wanted \/ Latest Evidence/);
  assert.match(researchContract.authoringTemplate, /### Setup And Update Posture/);
  assert.match(researchContract.authoringTemplate, /### Dependency Alternatives/);
  assert.match(researchContract.authoringTemplate, /### Library Vs Custom Decision/);
  assert.match(researchContract.authoringTemplate, /### Supply Chain Evidence/);
  assert.deepEqual(projectContract.requiredHeadings, [
    "Vision",
    "Audience",
    "Constraints",
    "Current Milestone",
    "Bootstrap Shape",
    "Scope Posture",
    "Non-Goals",
    "Assumptions"
  ]);
  assert.match(projectContract.authoringTemplate, /# <project name>/);
  assert.match(projectContract.authoringTemplate, /## Bootstrap Shape/);
  assert.deepEqual(requirementsContract.requiredHeadings, [
    "Requirements Table",
    "Scope Summary",
    "Committed V1 Scope",
    "Traceability Notes",
    "Open Questions"
  ]);
  assert.match(requirementsContract.notes.join("\n"), /conditionally required/i);
  assert.match(requirementsContract.authoringTemplate, /## Requirements Table/);
  assert.match(requirementsContract.authoringTemplate, /## Traceability Notes/);
  assert.deepEqual(roadmapContract.requiredHeadings, [
    "Milestone",
    "Bootstrap Status",
    "Requirement Coverage",
    "Phases",
    "Notes"
  ]);
  assert.equal(
    roadmapContract.modelContract?.schemaId,
    "blueprint.bootstrap.roadmap.model"
  );
  assert.equal(roadmapContract.modelContract?.schemaVersion, "1.0.0");
  assert.equal(
    roadmapContract.modelContract?.schemaPath,
    "src/mcp/artifact-contracts/schemas/bootstrap.roadmap.model.schema.json"
  );
  assert.deepEqual(roadmapContract.modelContract?.renderedHeadings, [
    "Milestone",
    "Bootstrap Status",
    "Requirement Coverage",
    "Phases",
    "Phase Details",
    "Notes"
  ]);
  assert.deepEqual(
    (roadmapContract.modelContract?.jsonSchema.required as string[]).slice(0, 5),
    ["schemaVersion", "milestone", "bootstrapStatus", "requirementCoverage", "phases"]
  );
  assert.ok(
    roadmapContract.modelContract?.qualityRules.some((rule) =>
      /success criteria/i.test(rule)
    )
  );
  assert.match(roadmapContract.authoringTemplate, /## Bootstrap Status/);
  assert.match(roadmapContract.authoringTemplate, /## Phases/);
  assert.deepEqual(researchContract.requiredHeadings, [
    "Phase Requirements",
    "Summary",
    "Locked Decisions From Context",
    "User Constraints",
    "Standard Stack",
    "Installation And Setup",
    "Alternatives Considered",
    "Architecture Patterns",
    "Don't Hand-Roll",
    "Anti-Patterns",
    "State Of The Art",
    "Common Pitfalls",
    "Open Questions",
    "Confidence Breakdown",
    "Code Examples",
    "Recommendations",
    "Sources"
  ]);
  assert.deepEqual(contextContract.requiredHeadings, [
    "Phase Boundary",
    "Discovery Grounding",
    "Implementation Decisions",
    "Specific Ideas",
    "Existing Code Insights",
    "Dependencies",
    "Open Questions",
    "Deferred Ideas",
    "Canonical References"
  ]);
  assert.notEqual(contextContract.authoringTemplate, contextContract.scaffoldTemplate);
  assert.match(contextContract.scaffoldTemplate, /## Discovery Grounding/);
  assert.match(contextContract.scaffoldTemplate, /Project brief:/);
  assert.match(contextContract.scaffoldTemplate, /Requirements grounding:/);
  assert.match(contextContract.scaffoldTemplate, /\*Generated by `blueprint_artifact_scaffold`\*/);
  assert.match(contextContract.authoringTemplate, /## Discovery Grounding/);
  assert.match(
    contextContract.authoringTemplate,
    /Final saved content only\./
  );
  assert.match(
    contextContract.authoringTemplate,
    /Replace every section below with the real phase goal, grounding, decisions, ideas, code insights, dependencies, deferred ideas, and canonical references\./
  );
  assert.doesNotMatch(contextContract.authoringTemplate, /Project brief:/);
  assert.doesNotMatch(contextContract.authoringTemplate, /Requirements grounding:/);
  assert.doesNotMatch(contextContract.authoringTemplate, /Workflow posture:/);
  assert.doesNotMatch(contextContract.authoringTemplate, /Confirmed decisions:/);
  assert.doesNotMatch(
    contextContract.authoringTemplate,
    /\*Generated by `blueprint_artifact_scaffold`\*/
  );
  assert.match(contextContract.authoringTemplate, /## Implementation Decisions/);
  assert.doesNotMatch(contextContract.authoringTemplate, /<implementation decision 1>/);
  assert.match(contextContract.authoringTemplate, /## Specific Ideas/);
  assert.doesNotMatch(contextContract.authoringTemplate, /<specific idea 1>/);
  assert.match(contextContract.authoringTemplate, /## Existing Code Insights/);
  assert.doesNotMatch(contextContract.authoringTemplate, /<existing code insight 1>/);
  assert.doesNotMatch(contextContract.authoringTemplate, /<prior phase artifacts>/);
  assert.match(
    contextContract.authoringTemplate,
    /use the exact sentinel `- none` when nothing remains open/i
  );
  assert.doesNotMatch(contextContract.authoringTemplate, /<open question 1 or none>/);
  assert.match(contextContract.authoringTemplate, /## Deferred Ideas/);
  assert.match(contextContract.authoringTemplate, /## Canonical References/);
  assert.deepEqual(discussionLogContract.requiredHeadings, ["Summary", "Notes", "Follow-Ups"]);
  assert.notEqual(
    discussionLogContract.authoringTemplate,
    discussionLogContract.scaffoldTemplate
  );
  assert.match(
    discussionLogContract.scaffoldTemplate,
    /Record the major discussion outcomes and unresolved questions here\./
  );
  assert.match(
    discussionLogContract.scaffoldTemplate,
    /\*Generated by `blueprint_artifact_scaffold`\*/
  );
  assert.match(
    discussionLogContract.authoringTemplate,
    /Replace the sections below with the actual discussion outcomes, attributable notes, and concrete follow-ups worth preserving\./
  );
  assert.doesNotMatch(
    discussionLogContract.authoringTemplate,
    /Record the major discussion outcomes and unresolved questions here\./
  );
  assert.doesNotMatch(
    discussionLogContract.authoringTemplate,
    /\*Generated by `blueprint_artifact_scaffold`\*/
  );
  assert.equal(
    contextContract.sectionValidations?.["Open Questions"]?.exactEmptySentinel,
    "- none"
  );
  assert.ok(contextContract.placeholderSignals.includes("<implementation decision 1>"));
  assert.ok(contextContract.placeholderSignals.includes("<specific idea 1>"));
  assert.ok(contextContract.placeholderSignals.includes("<existing code insight 1>"));
  assert.ok(contextContract.placeholderSignals.includes("<prior phase artifacts>"));
  assert.ok(contextContract.placeholderSignals.includes("<open question 1 or none>"));
  assert.ok(contextContract.placeholderSignals.includes("<deferred idea>"));
  assert.ok(contextContract.placeholderSignals.includes("<source 1>"));
  assert.ok(
    contextContract.modelContract?.qualityRules.some((rule) =>
      /exact string `none` only when the section has no unresolved questions left/i.test(rule)
    )
  );
  assert.match(contextContract.notes.join("\n"), /Scaffold rendering is for first-write seeding/i);
  assert.match(contextContract.notes.join("\n"), /Authoring rendering preserves the canonical headings/i);
  assert.match(contextContract.notes.join("\n"), /exact `- none` sentinel/i);
  assert.match(contextContract.notes.join("\n"), /downstream planning/i);
  const contextAuthoringValidation = validatePhaseArtifactContent(
    contextContract.authoringTemplate,
    "context"
  );
  assert.equal(contextAuthoringValidation.valid, false);
  assert.match(
    contextAuthoringValidation.issues.join("\n"),
    /missing required contract sections|must contain substantive downstream-planning detail/i
  );
  assert.ok(Array.isArray(listed.contracts));
  assert.ok(listed.contracts.length >= 10);
  assert.deepEqual(uiContract.requiredHeadings, [
    "Outcome Mode",
    "User Experience Goals",
    "Visual Design Decisions",
    "Screens And States",
    "Components And Constraints",
    "Accessibility And Content",
    "Registry And Design-System Safety",
    "Next Safe Action"
  ]);
  assert.match(uiContract.authoringTemplate, /Spacing and layout:/);
  assert.match(uiContract.authoringTemplate, /Typography:/);
  assert.match(uiContract.authoringTemplate, /Color and contrast:/);
  assert.match(uiContract.authoringTemplate, /Copy and content:/);
  assert.match(uiContract.authoringTemplate, /Design-system evidence:/);
  assert.match(uiContract.authoringTemplate, /Typography limits:/);
  assert.match(uiContract.authoringTemplate, /Color hierarchy:/);
  assert.match(uiContract.authoringTemplate, /Copywriting contract:/);
  assert.match(uiContract.authoringTemplate, /## Checker Review/);
  assert.match(uiContract.authoringTemplate, /## Rationale/);
  assert.match(uiContract.authoringTemplate, /Registry and design-system safety:/);
  assert.match(uiContract.notes.join("\n"), /spacing, typography, color, copy\/content/i);
  assert.match(uiContract.notes.join("\n"), /optional `## Rationale` branch/i);
  assert.match(uiContract.notes.join("\n"), /ui-phase-runtime-contract\.md/i);
  assert.match(uiContract.notes.join("\n"), /six UI dimensions/i);
  assert.match(summaryContract.notes.join("\n"), /`COMPLETED` is the only status that closes execution debt/);
  assert.match(summaryContract.notes.join("\n"), /`PARTIAL` and `BLOCKED` are truthful carry-forward evidence/);
  assert.deepEqual(summaryContract.requiredHeadings, [
    "Outcome",
    "Changes Made",
    "Verification",
    "Dependency Plans",
    "Manual / Deferred Work",
    "Gap / Repair Routes",
    "Follow-Ups",
    "Evidence"
  ]);
  assert.match(summaryContract.authoringTemplate, /## Gap \/ Repair Routes/);
  assert.equal(impactContract.ownerTool, "blueprint_impact_report_write");
  assert.equal(impactContract.pathOwner, "blueprint_impact_report_write");
  assert.equal(impactContract.canonicalFilePattern, ".blueprint/impact/<impact-id>/IMPACT.md");
  assert.equal(impactContract.modelContract?.schemaId, "blueprint.report.impact.model");
  assert.equal(
    impactContract.modelContract?.schemaPath,
    "src/mcp/artifact-contracts/schemas/report.impact.model.schema.json"
  );
  assert.deepEqual((impactContract.modelContract?.jsonSchema.required as string[]).slice(0, 4), [
    "schemaVersion",
    "impactId",
    "status",
    "impactStatus"
  ]);
  assert.deepEqual(impactContract.requiredHeadings, [
    "Summary",
    "Change Scope",
    "Top Impacted Areas",
    "Required Reviewers",
    "Required Tests",
    "Blocking Findings",
    "Warnings",
    "Contract And Compatibility Impact",
    "Database, Config, Infra, And Deployment Impact",
    "Unknowns And Missing Metadata",
    "Evidence",
    "Suggested Next Actions"
  ]);
  assert.match(impactContract.authoringTemplate, /^# Impact Report:/);
  assert.match(impactContract.notes.join("\n"), /implemented as an advisory command/);
  assert.match(impactContract.notes.join("\n"), /do not mutate source, roadmap, PR, deployment, command-catalog, or installed-extension state/);
  assert.ok(
    uiContract.placeholderSignals.includes(
      "Spacing and layout: <grid, rhythm, or layout constraints>"
    )
  );
  assert.ok(
    uiContract.placeholderSignals.includes(
      "Typography: <type scale, emphasis, or readability decisions>"
    )
  );
  assert.ok(
    uiContract.placeholderSignals.includes(
      "Registry and design-system safety: <how the draft avoids forking the registry or design system>"
    )
  );
  assert.ok(
    uiContract.placeholderSignals.includes(
      "Copywriting: <PASS, FLAG, BLOCK, or not yet reviewed, with evidence>"
    )
  );
  assert.deepEqual(verificationContract.requiredHeadings, [
    "Validation Summary",
    "Requirement / Task Coverage",
    "Evidence Reviewed",
    "Test Infrastructure / Evidence Metadata",
    "Manual-Only or Deferred Coverage",
    "Gate State",
    "Gap Classification",
    "Gaps Found",
    "Suggested Repairs",
    "Next Safe Action"
  ]);
  assert.match(
    verificationContract.authoringTemplate,
    /## Requirement \/ Task Coverage/
  );
  assert.match(
    verificationContract.authoringTemplate,
    /## Test Infrastructure \/ Evidence Metadata/
  );
  assert.match(
    verificationContract.authoringTemplate,
    /## Manual-Only or Deferred Coverage/
  );
  assert.match(verificationContract.authoringTemplate, /## Gate State/);
  assert.match(
    verificationContract.authoringTemplate,
    /## Gap Classification/
  );
  assert.match(verificationContract.authoringTemplate, /\*\*Gate State:\*\*/);
  assert.match(verificationContract.authoringTemplate, /\*\*Sign-off:\*\*/);
  assert.equal(verificationContract.modelContract?.schemaId, "blueprint.phase.verification.model");
  assert.equal(verificationContract.modelContract?.schemaVersion, "1.1.0");
  assert.equal(
    verificationContract.modelContract?.schemaPath,
    "src/mcp/artifact-contracts/schemas/phase.verification.model.schema.json"
  );
  assert.ok(
    verificationContract.modelContract?.renderedHeadings.includes(
      "Requirement / Task Coverage"
    )
  );
  assert.ok(
    verificationContract.modelContract?.renderedHeadings.includes(
      "Validation Test Matrix"
    )
  );
  assert.ok(
    verificationContract.modelContract?.qualityRules.some((rule) =>
      /Do not include model-owned identity keys/i.test(rule)
    )
  );
  assert.deepEqual(
    (verificationContract.modelContract?.jsonSchema.required as string[]).slice(0, 3),
    ["coverageSummary", "status", "gateState"]
  );
  assert.deepEqual(verificationContract.lockedMarkers, [
    "**Coverage:**",
    "**Gate State:**",
    "**Sign-off:**"
  ]);
  assert.deepEqual(uatContract.requiredHeadings, [
    "UAT Summary",
    "Session State",
    "Current Test",
    "Test Matrix",
    "Result Summary",
    "Questions Asked",
    "Observed Behavior",
    "Unresolved Gaps",
    "Structured Gaps",
    "Follow-Up Fixes",
    "Next Safe Action"
  ]);
  assert.deepEqual(uatContract.lockedMarkers, [
    "**Status:**",
    "**Resume State:**",
    "**Checkpoint:**"
  ]);
  assert.equal(uatContract.modelContract?.schemaId, "blueprint.phase.uat.model");
  assert.equal(uatContract.modelContract?.schemaVersion, "1.0.0");
  assert.deepEqual(
    (uatContract.modelContract?.jsonSchema.required as string[]).slice(0, 4),
    ["status", "resumeState", "checkpoint", "uatSummary"]
  );
  assert.ok(uatContract.modelContract?.renderedHeadings.includes("Structured Gaps"));
  assert.ok(
    uatContract.modelContract?.qualityRules.some((rule) =>
      /Ground UAT summary, session state, test matrix, and observed behavior/i.test(rule)
    )
  );
  assert.ok(
    uatContract.modelContract?.contextBindings.some((binding) =>
      /ready verification content/i.test(binding)
    )
  );
  const uatModelSchema = uatContract.modelContract?.jsonSchema as
    | {
        properties?: Record<string, Record<string, unknown>>;
        allOf?: Array<{ then?: { properties?: Record<string, unknown> } }>;
      }
    | undefined;
  assert.equal(uatModelSchema?.properties?.questionsAsked?.minItems, 1);
  assert.equal(
    Boolean(uatModelSchema?.allOf?.[1]?.then?.properties?.followUpFixes),
    false
  );
  assert.deepEqual(milestoneAuditContract.requiredHeadings, [
    "Audit Verdict",
    "Milestone Evidence Dimensions",
    "Original Intent Snapshot",
    "Roadmap And Phase Evidence",
    "Requirement Gaps",
    "Integration Gaps",
    "Flow Gaps",
    "Optional Gaps",
    "Gaps Found",
    "Archival Blockers",
    "Next Safe Action"
  ]);
  assert.deepEqual(milestoneAuditContract.lockedMarkers, [
    "**Verdict:**",
    "**Evidence Dimensions:**"
  ]);
  assert.match(
    milestoneAuditContract.authoringTemplate,
    /\*\*Verdict:\*\* READY_TO_CLOSE\|FOLLOW_UP\|BLOCKED/
  );
  assert.match(milestoneAuditContract.authoringTemplate, /## Audit Verdict/);
  assert.match(milestoneAuditContract.authoringTemplate, /## Milestone Evidence Dimensions/);
  assert.match(milestoneAuditContract.authoringTemplate, /## Requirement Gaps/);
  assert.match(milestoneAuditContract.authoringTemplate, /## Integration Gaps/);
  assert.match(milestoneAuditContract.authoringTemplate, /## Flow Gaps/);
  assert.match(milestoneAuditContract.authoringTemplate, /## Optional Gaps/);
  assert.match(milestoneAuditContract.authoringTemplate, /\| Gap ID \| Surface \| Evidence \| Repair \|/);
  assert.match(
    milestoneAuditContract.notes.join("\n"),
    /concrete verdict and milestone-level evidence dimensions/i
  );
  assert.deepEqual(milestoneCompleteContract.requiredHeadings, [
    "Completion Decision",
    "Audit Report Used",
    "Milestone Evidence Ledger",
    "Residual Watch Items",
    "Next Safe Action"
  ]);
  assert.deepEqual(milestoneCompleteContract.lockedMarkers, [
    "**Decision:**",
    "**Audit Report Used:**",
    "**Evidence Ledger:**"
  ]);
  assert.match(milestoneCompleteContract.authoringTemplate, /## Milestone Evidence Ledger/);
  assert.match(milestoneCompleteContract.authoringTemplate, /\*\*Decision:\*\* READY_TO_CLOSE\|FOLLOW_UP\|BLOCKED/);
  assert.match(milestoneCompleteContract.authoringTemplate, /<saved milestone audit report path>/);
  assert.deepEqual(milestoneSummaryContract.requiredHeadings, [
    "Scope Summary",
    "Source Reports Used",
    "Milestone Evidence Ledger",
    "Shipped Outcomes",
    "Deferred Follow-Ups",
    "Recommended Carry-Forward Context",
    "Next Safe Action"
  ]);
  assert.deepEqual(milestoneSummaryContract.lockedMarkers, [
    "**Sources Reviewed:**",
    "**Evidence Ledger:**",
    "**Carry-Forward Context:**"
  ]);
  assert.match(milestoneSummaryContract.authoringTemplate, /## Milestone Evidence Ledger/);
  assert.match(
    milestoneSummaryContract.authoringTemplate,
    /<saved audit report, completion report, and roadmap evidence>/
  );
  assert.match(milestoneSummaryContract.authoringTemplate, /\/blu-new-milestone/);
  assert.match(uatContract.authoringTemplate, /\*\*Resume State:\*\* RESUMED\|NEW\|CONTINUED/);
  assert.match(uatContract.authoringTemplate, /\*\*Checkpoint:\*\* <current checkpoint label or none>/);
  assert.match(uatContract.authoringTemplate, /## Session State/);
  assert.match(
    uatContract.authoringTemplate,
    /Resume source: <saved summary path, in-artifact checkpoint, or none>/
  );
  assert.match(
    uatContract.authoringTemplate,
    /Continuity notes: <what must remain stable between sessions>/
  );
  assert.match(uatContract.notes.join("\n"), /resumable across sessions/i);
  assert.match(
    uatContract.notes.join("\n"),
    /saved summaries inside UAT Summary, Session State, or Observed Behavior/i
  );
  assert.deepEqual(reviewContract.requiredHeadings, [
    "Review Summary",
    "Scope Reviewed",
    "Evidence Reviewed",
    "Positive Signals",
    "Severity Summary",
    "Findings",
    "Follow-Ups",
    "Next Safe Action"
  ]);
  assert.deepEqual(securityContract.requiredHeadings, [
    "Security Summary",
    "Evidence Reviewed",
    "Threat Register",
    "Accepted Risks",
    "Findings",
    "Manual / Deferred Work",
    "Gap / Repair Routes",
    "Follow-Ups",
    "Security Audit Trail",
    "Next Safe Action"
  ]);
  assert.match(reviewContract.authoringTemplate, /\*\*Verdict:\*\* PASS\|FOLLOW_UP\|BLOCKED/);
  assert.match(reviewContract.authoringTemplate, /## Review Summary/);
  assert.match(reviewContract.authoringTemplate, /## Evidence Reviewed/);
  assert.match(reviewContract.authoringTemplate, /## Positive Signals/);
  assert.match(reviewContract.authoringTemplate, /## Severity Summary/);
  assert.equal(reviewContract.modelContract?.schemaId, "blueprint.review.code-review.model");
  assert.equal(reviewContract.modelContract?.schemaVersion, "1.0.0");
  assert.equal(
    reviewContract.modelContract?.schemaPath,
    "src/mcp/artifact-contracts/schemas/review.code-review.model.schema.json"
  );
  assert.ok(reviewContract.modelContract?.renderedHeadings.includes("Scope Reviewed"));
  assert.ok(
    reviewContract.modelContract?.qualityRules.some((rule) =>
      /narrowed taskSchema returned by blueprint_review_scope/i.test(rule)
    )
  );
  assert.deepEqual(
    (reviewContract.modelContract?.jsonSchema.required as string[]).slice(0, 4),
    ["verdict", "reviewSummary", "positiveSignals", "findings"]
  );
  const reviewModelSchema = reviewContract.modelContract?.jsonSchema as {
    $defs?: {
      lineLocation?: {
        pattern?: string;
      };
    };
  };
  assert.equal(
    reviewModelSchema.$defs?.lineLocation?.pattern,
    "^(?:(?:[A-Za-z0-9._-]+/)+[A-Za-z0-9._-]+(?:\\.[A-Za-z0-9._-]+)?|[A-Za-z0-9._-]*\\.[A-Za-z0-9._-]+):\\d+(?:-\\d+)?$"
  );
  assert.match(JSON.stringify(reviewContract.modelContract?.jsonSchema), /examples|evidenceCoverage/);
  assert.deepEqual(peerReviewContract.requiredHeadings, [
    "Review Summary",
    "Reviewer Coverage",
    "Reviewer Results",
    "Plan Reviews",
    "Findings",
    "Consensus",
    "Disagreements",
    "Risk Assessment",
    "Manual / Deferred Work",
    "Gap / Repair Routes",
    "Follow-Ups",
    "Evidence Reviewed",
    "Next Safe Action"
  ]);
  assert.equal(peerReviewContract.modelContract?.schemaId, "blueprint.review.peer-review.model");
  assert.equal(peerReviewContract.modelContract?.schemaVersion, "1.0.0");
  assert.equal(
    peerReviewContract.modelContract?.schemaPath,
    "src/mcp/artifact-contracts/schemas/review.peer-review.model.schema.json"
  );
  assert.ok(peerReviewContract.modelContract?.renderedHeadings.includes("Plan Reviews"));
  assert.ok(
    peerReviewContract.modelContract?.qualityRules.some((rule) =>
      /narrowed taskSchema returned by blueprint_review_authoring_context/i.test(rule)
    )
  );
  assert.deepEqual(
    (peerReviewContract.modelContract?.jsonSchema.required as string[]).slice(0, 4),
    ["status", "readiness", "completionState", "reviewSummary"]
  );
  assert.match(
    JSON.stringify(peerReviewContract.modelContract?.jsonSchema),
    /reviewerCoverage|failed|evidenceCoverage|manualOrDeferredWork/
  );
  assert.deepEqual(reviewFixContract.requiredHeadings, [
    "Remediation Summary",
    "Findings Addressed",
    "Changes Made",
    "Verification",
    "Dependency Plans",
    "Manual / Deferred Work",
    "Gap / Repair Routes",
    "Follow-Ups",
    "Evidence",
    "Next Safe Action"
  ]);
  assert.deepEqual(reviewFixContract.lockedMarkers, [
    "**Status:**",
    "**Readiness:**",
    "**Completion State:**",
    "**Next Safe Action:**"
  ]);
  assert.equal(reviewFixContract.modelContract?.schemaId, "blueprint.review.review-fix.model");
  assert.equal(reviewFixContract.modelContract?.schemaVersion, "1.0.0");
  assert.equal(
    reviewFixContract.modelContract?.schemaPath,
    "src/mcp/artifact-contracts/schemas/review.review-fix.model.schema.json"
  );
  assert.ok(reviewFixContract.modelContract?.renderedHeadings.includes("Dependency Plans"));
  assert.ok(
    reviewFixContract.modelContract?.qualityRules.some((rule) =>
      /COMPLETED review-fix models require every selected saved finding fixed/i.test(rule)
    )
  );
  assert.deepEqual(
    (reviewFixContract.modelContract?.jsonSchema.required as string[]).slice(0, 4),
    ["status", "readiness", "completionState", "remediationSummary"]
  );
  assert.match(securityContract.authoringTemplate, /\*\*Status:\*\* COMPLETED\|PARTIAL\|BLOCKED/);
  assert.match(securityContract.authoringTemplate, /\*\*Readiness:\*\* ready-for-routing\|needs-follow-up\|blocked/);
  assert.match(securityContract.authoringTemplate, /\*\*Completion State:\*\* complete\|partial\|blocked/);
  assert.match(securityContract.authoringTemplate, /## Threat Register/);
  assert.match(
    securityContract.authoringTemplate,
    /\| Threat ID \| Status \| Evidence \| Verifier Note \|/
  );
  assert.match(securityContract.authoringTemplate, /## Accepted Risks/);
  assert.match(securityContract.authoringTemplate, /## Manual \/ Deferred Work/);
  assert.match(securityContract.authoringTemplate, /## Gap \/ Repair Routes/);
  assert.match(securityContract.authoringTemplate, /## Security Audit Trail/);
  assert.equal(securityContract.modelContract?.schemaId, "blueprint.review.security.model");
  assert.equal(securityContract.modelContract?.schemaVersion, "1.0.0");
  assert.equal(
    securityContract.modelContract?.schemaPath,
    "src/mcp/artifact-contracts/schemas/review.security.model.schema.json"
  );
  assert.ok(securityContract.modelContract?.renderedHeadings.includes("Manual / Deferred Work"));
  assert.ok(
    securityContract.modelContract?.qualityRules.some((rule) =>
      /COMPLETED security reviews require every declared threat to be closed or accepted/i.test(rule)
    )
  );
  assert.deepEqual(
    (securityContract.modelContract?.jsonSchema.required as string[]).slice(0, 4),
    ["status", "readiness", "completionState", "securitySummary"]
  );
  assert.deepEqual(
    pauseContract.requiredHeadings,
    [
      "Current State",
      "Completed Work",
      "Remaining Work",
      "Decisions",
      "Blockers",
      "Human Actions Pending",
      "Modified Files",
      "Blueprint Snapshot",
      "Next Action",
      "Context Notes"
    ]
  );
});

test("bootstrap PROJECT.md docs stay aligned with the runtime Markdown contract", async () => {
  const projectContract = readArtifactContract("bootstrap.project");
  const artifactSchemaDoc = await readFile(
    new URL("../docs/ARTIFACT-SCHEMA.md", import.meta.url),
    "utf8"
  );
  const mcpToolsDoc = await readFile(new URL("../docs/MCP-TOOLS.md", import.meta.url), "utf8");
  const commandDoc = await readFile(
    new URL("../docs/commands/new-project.md", import.meta.url),
    "utf8"
  );

  const projectSection = artifactSchemaDoc.match(
    /### `PROJECT\.md`[\s\S]*?(?=### `REQUIREMENTS\.md`)/
  )?.[0];

  assert.ok(projectSection, "ARTIFACT-SCHEMA.md must document PROJECT.md");
  assert.equal(projectContract.modelContract, undefined);
  for (const heading of projectContract.requiredHeadings) {
    assert.match(projectSection, new RegExp(`- \`${heading}\``));
  }
  assert.match(projectSection, /Markdown artifact contract/i);
  assert.match(projectSection, /does not expose a `modelContract`/);
  assert.match(mcpToolsDoc, /bootstrap contracts such as `bootstrap\.project` are not schema-first/i);
  assert.match(mcpToolsDoc, /`diagnostics` gives structured repair metadata/i);
  assert.match(commandDoc, /`bootstrap\.project` is Markdown-contract-backed/i);
  assert.match(commandDoc, /recoverable seed\/preflight invalid/i);
});

test("canonical lifecycle contracts allow additional top-level headings without breaking validation", () => {
  const research = canonicalResearchContent(
    "One registry reduces retry loops.",
    "| R-1 | Centralize templates | Use one MCP-owned registry for authoring and validation. |\n"
  );
  const verification = `# Phase 03: Discovery - Verification

**Coverage:** Reviewed \`03-01-SUMMARY.md\` and related saved summaries.
**Gate State:** PASS
**Sign-off:** validation lead

## Validation Summary

- Validation coverage is sufficient for UAT.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| VALID-01 | Confirm saved execution summaries exist | .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md | PASS | Summary-backed coverage is present. |

## Evidence Reviewed

- .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md

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
- Sign-off: validation lead
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

- /blu-verify-work 3

## Additional Context

- Extra validator notes are allowed here.
`;
  const uat = `# Phase 03: Discovery - UAT

**Status:** PASS
**Resume State:** RESUMED
**Checkpoint:** none

## UAT Summary

- The saved behavior matched the accepted summary evidence.

## Session State

- Resume source: saved summary evidence
- Current session step: Confirm the accepted behavior still holds after a pause.
- Continuity notes: Keep the same summary-backed outcome when the session resumes.

## Current Test

- Number: testing complete
- Name: none
- Expected: Keep the accepted summary-backed behavior stable.
- Awaiting: none

## Test Matrix

| # | Test | Expected Behavior | Evidence | Result | Notes |
|---|------|-------------------|----------|--------|-------|
| 1 | Discovery UAT smoke | Keep the accepted summary-backed behavior stable. | .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md | pass | none |

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

- The observed behavior matched .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md.

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

## Additional Context

- Extra UAT notes remain valid.
`;

  const researchValidation = validateResearchArtifactContent(research);
  const verificationValidation = validateVerificationArtifactContent(verification, [
    ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"
  ]);
  const uatValidation = validateUatArtifactContent(uat, [
    ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"
  ]);
  const invalidCheckpointUat = uat.replace("**Checkpoint:** none", "**Checkpoint:**");
  const invalidCheckpointValidation = validateUatArtifactContent(invalidCheckpointUat, [
    ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"
  ]);

  assert.equal(researchValidation.valid, true, researchValidation.issues.join("\n"));
  assert.equal(verificationValidation.valid, true, verificationValidation.issues.join("\n"));
  assert.equal(uatValidation.valid, true, uatValidation.issues.join("\n"));
  assert.equal(invalidCheckpointValidation.valid, false, invalidCheckpointValidation.issues.join("\n"));
  assert.match(
    invalidCheckpointValidation.issues.join("\n"),
    /non-empty in-artifact checkpoint label|Checkpoint:\*\* with `none`/
  );

  const contradictoryVerification = verification
    .replace("**Gate State:** PASS", "**Gate State:** PASS with follow-up")
    .replace("- Gate: PASS", "- Gate: BLOCKED")
    .replace("- Readiness: ready for UAT", "- Readiness: not ready for UAT");
  const contradictoryValidation = validateVerificationArtifactContent(contradictoryVerification, [
    ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"
  ]);

  assert.equal(contradictoryValidation.valid, false, contradictoryValidation.issues.join("\n"));
  assert.match(
    contradictoryValidation.issues.join("\n"),
    /must declare \*\*Gate State:\*\* as PASS, PARTIAL, or BLOCKED|must keep the top \*\*Gate State:\*\* marker and the Gate section value consistent|must keep the Gate section Readiness value aligned with the Gate state/
  );
});

test("research contract rejects skeleton content that lacks substantive section detail", () => {
  const skeletalResearch = canonicalResearchContent("Keep registry updates aligned with MCP.", "");

  const validation = validateResearchArtifactContent(skeletalResearch);

  assert.equal(validation.valid, false, validation.issues.join("\n"));
  assert.match(
    validation.issues.join("\n"),
    /Phase Requirements must include at least one populated requirement row|substantive content/i
  );
});

test("research contract allows intentional placeholder token prose", () => {
  const research = canonicalResearchContent(
    "Keep placeholder {url}.{portNumber} as a documented interim token until endpoint wiring replaces it.",
    "| LIFE-01 | Keep endpoint research grounded. | The interim token is explicitly scoped to later wiring. |"
  );

  const validation = validateResearchArtifactContent(research);

  assert.equal(validation.valid, true, validation.issues.join("\n"));
  assert.doesNotMatch(validation.issues.join("\n"), /placeholder scaffold text/i);
});

test("research contract ignores scaffold placeholder tokens inside fenced code examples", () => {
  const research = canonicalResearchContent(
    "Keep scaffold placeholder markers allowed inside fenced code examples when surrounding prose is fully authored.",
    "| LIFE-01 | Keep endpoint research grounded. | Fenced snippets remain valid examples even when they quote scaffold-shaped tokens. |"
  ).replace(
    /## Code Examples[\s\S]*?\n## Recommendations/,
    `## Code Examples

\`\`\`md
- title: <title>
- reason: <reason>
- source: <URL>
\`\`\`

## Recommendations`
  );

  const validation = validateResearchArtifactContent(research);

  assert.equal(validation.valid, true, validation.issues.join("\n"));
  assert.doesNotMatch(validation.issues.join("\n"), /placeholder scaffold text/i);
});

test("research contract accepts table-only claim-addressable source evidence", () => {
  const research = canonicalResearchContent(
    "Keep table-only claim-addressable source evidence valid when the rows cite concrete repo material.",
    "| LIFE-01 | Keep endpoint research grounded. | Structured source tables capture concrete evidence. |"
  ).replace(
    /## Sources[\s\S]*?\n## Additional Context/,
    `## Sources

### Source Register

| Source ID | Lane | Path Or URL | Accessed | Repo Line Or Symbol | Source Type | Used For Claims | Limitations |
|-----------|------|-------------|----------|---------------------|-------------|-----------------|-------------|
| SRC-001 | repo | src/mcp/tools/artifacts.ts | observed 2026-04-18 | validateResearchArtifactContent | repo_file | CLM-001 | local fixture evidence |

### Repo Evidence

| Evidence ID | Claim ID | Source Ref | Role | Retrieval Context | Support Span | Claim Class | Downstream Use | Limitations |
|-------------|----------|------------|------|-------------------|--------------|-------------|----------------|-------------|
| EVID-001 | CLM-001 | SRC-001 | mcp-handler | manual-read; MCP handler | validateResearchArtifactContent enforces the research source gate | directly_supported | REC-001 | local checkout only |

### External Sources

| Evidence ID | Claim ID | Source Type | Authority Tier | Source Title | Source Ref | Accessed | Support Span | Claim Class | Retrieval Context | Limitations | Downstream Use |
|-------------|----------|-------------|----------------|--------------|------------|----------|--------------|-------------|-------------------|-------------|----------------|
| EVID-002 | CLM-002 | supplied_reference | unknown | Repo-only fixture | SRC-001 | supplied-unchecked | no live external lookup used | out_of_scope | source policy off | repo-only fixture | do not use as support |

### Inference Notes

| Evidence ID | Claim ID | Derived From | Claim Class | Derivation / Attribution | Limitations | Downstream Use |
|-------------|----------|--------------|-------------|--------------------------|-------------|----------------|
| EVID-003 | CLM-003 | EVID-001 | inferred_from_supported | The validator can accept table-only structured source evidence. | verify in focused tests | REC-001 |

## Additional Context`
  );

  const validation = validateResearchArtifactContent(research);

  assert.equal(validation.valid, true, validation.issues.join("\n"));
});

test("research contract emits dependency/tool warnings without invalidating the artifact", () => {
  const research = canonicalResearchContent(
    "Add a package dependency for artifact validation without enough supply-chain detail.",
    "| LIFE-01 | Keep endpoint research grounded. | Add a package dependency for validation. |"
  )
    .replace(/### Dependency \/ Tool Evaluation[\s\S]*?\n## Installation And Setup/, "## Installation And Setup")
    .replace(/### Setup And Update Posture[\s\S]*?\n## Alternatives Considered/, "## Alternatives Considered")
    .replace(/### Dependency Alternatives[\s\S]*?\n## Architecture Patterns/, "## Architecture Patterns")
    .replace(/### Library Vs Custom Decision[\s\S]*?\n## Anti-Patterns/, "## Anti-Patterns")
    .replace(/### Supply Chain Evidence[\s\S]*?\n## Additional Context/, "## Additional Context");

  const validation = validateResearchArtifactContent(research);

  assert.equal(validation.valid, true, validation.issues.join("\n"));
  assert.match(validation.warnings.join("\n"), /Dependency \/ Tool Evaluation/i);
  assert.match(validation.warnings.join("\n"), /no-new-dependency/i);
});

test("research contract does not treat generic npm install setup text as a dependency choice", () => {
  const research = canonicalResearchContent(
    "Run npm install before local verification so the usual repo tooling is available.",
    "| LIFE-01 | Keep endpoint research grounded. | Local verification should use the standard repo setup flow. |"
  )
    .replace(
      /## Standard Stack[\s\S]*?\n## Installation And Setup/,
      `## Standard Stack

- TypeScript, MCP tools, markdown artifacts.

## Installation And Setup`
    )
    .replace(
      /## Installation And Setup[\s\S]*?\n## Alternatives Considered/,
      `## Installation And Setup

- Run npm install before local verification.

## Alternatives Considered`
    )
    .replace(
      /## Alternatives Considered[\s\S]*?\n## Architecture Patterns/,
      `## Alternatives Considered

- Prompt-local templates were rejected because they drift from the MCP contract.

## Architecture Patterns`
    )
    .replace(
      /## Don't Hand-Roll[\s\S]*?\n## Anti-Patterns/,
      `## Don't Hand-Roll

- Avoid copying templates into command prompts.

## Anti-Patterns`
    )
    .replace(/### Supply Chain Evidence[\s\S]*?\n## Additional Context/, "## Additional Context");

  const validation = validateResearchArtifactContent(research);

  assert.equal(validation.valid, true, validation.issues.join("\n"));
  assert.doesNotMatch(validation.warnings.join("\n"), /Dependency \/ Tool Evaluation/i);
  assert.doesNotMatch(validation.warnings.join("\n"), /no-new-dependency/i);
});

test("research contract warns when a later real install command follows generic setup text", () => {
  const research = canonicalResearchContent(
    "Run npm install before local verification. If DOM parsing is needed later, npm install jsdom.",
    "| LIFE-01 | Keep endpoint research grounded. | Repo-default setup stays first, but later DOM parsing may need jsdom. |"
  )
    .replace(
      /## Standard Stack[\s\S]*?\n## Installation And Setup/,
      `## Standard Stack

- TypeScript, MCP tools, markdown artifacts.

## Installation And Setup`
    )
    .replace(
      /## Installation And Setup[\s\S]*?\n## Alternatives Considered/,
      `## Installation And Setup

- Run npm install before local verification.
- If DOM parsing is needed later, npm install jsdom.

## Alternatives Considered`
    )
    .replace(
      /## Alternatives Considered[\s\S]*?\n## Architecture Patterns/,
      `## Alternatives Considered

- Prompt-local templates were rejected because they drift from the MCP contract.

## Architecture Patterns`
    )
    .replace(
      /## Don't Hand-Roll[\s\S]*?\n## Anti-Patterns/,
      `## Don't Hand-Roll

- Avoid copying templates into command prompts.

## Anti-Patterns`
    )
    .replace(/### Supply Chain Evidence[\s\S]*?\n## Additional Context/, "## Additional Context");

  const validation = validateResearchArtifactContent(research);

  assert.equal(validation.valid, true, validation.issues.join("\n"));
  assert.match(validation.warnings.join("\n"), /Dependency \/ Tool Evaluation/i);
  assert.match(validation.warnings.join("\n"), /no-new-dependency/i);
});

test("review and report contracts validate canonical sections while keeping extra headings compatible", () => {
  const review = `# Phase 05: Security - Code Review

**Verdict:** FOLLOW_UP

## Review Summary

- Severity summary: critical 0, high 1, medium 0, low 0, unknown 0.

## Scope Reviewed

- src/mcp/tools/review.ts

## Evidence Reviewed

- .blueprint/phases/05-review-scope/05-01-PLAN.md
- .blueprint/phases/05-review-scope/05-01-SUMMARY.md

## Positive Signals

- Review scope stayed bounded to the saved plan outputs.

## Severity Summary

- critical: 0
- high: 1
- medium: 0
- low: 0
- unknown: 0

## Findings

- [high][follow-up] \`F-01\` \`src/mcp/tools/review.ts:1\` - Evidence: Missing contract validation would let malformed review artifacts persist. Impact: Invalid review artifacts could be saved. Fix/verification: Add canonical review validation before persistence.

## Follow-Ups

- Add canonical review validation before persistence.

## Next Safe Action

- /blu-progress

## Additional Context

- Extra reviewer notes are allowed.
`;
  const thinReview = `# Phase 05: Security - Code Review

**Verdict:** FOLLOW_UP

## Scope Reviewed

- src/mcp/tools/review.ts

## Findings

- [high] Missing contract validation would let malformed review artifacts persist.

## Follow-Ups

- Add canonical review validation before persistence.

## Next Safe Action

- /blu-progress
`;
  const legacyReview = `# Phase 05: Security - Code Review

**Verdict:** FOLLOW_UP

## Review Summary

- Severity summary: critical 0, high 1, medium 0, low 0, unknown 0.

## Scope Reviewed

- src/mcp/tools/review.ts

## Evidence Reviewed

- .blueprint/phases/05-review-scope/05-01-PLAN.md

## Positive Signals

- Review scope stayed bounded to the saved plan outputs.

## Severity Summary

- critical: 0
- high: 1
- medium: 0
- low: 0
- unknown: 0

## Findings

- [high] \`src/mcp/tools/review.ts:1\` - Missing contract validation would let malformed review artifacts persist.

## Follow-Ups

- Add canonical review validation before persistence.

## Next Safe Action

- /blu-progress
`;
  const securityContract = readArtifactContract("review.security");
  const auditFixContract = readArtifactContract("report.audit-fix", {
    phaseNumber: "04",
    phasePrefix: "04"
  });
  const milestoneAuditContract = readArtifactContract("report.milestone-audit");
  const securityScaffoldValidation = validateReviewArtifactContent(
    securityContract.authoringTemplate,
    "security"
  );
  const thinSecurityReview = `# Phase 05: Security - Security Review

**Posture:** PASS

## Security Summary

- Saved evidence looks stable.

## Evidence Reviewed

- .blueprint/phases/05-review-scope/05-01-SUMMARY.md

## Findings

- none

## Follow-Ups

- none

## Next Safe Action

- /blu-progress
`;
  const thinSecurityValidation = validateReviewArtifactContent(thinSecurityReview, "security");
  const report = `# Debug Report

## Problem Statement

- Validation drift caused repeated MCP write retries.

## Evidence Collected

- Saved artifacts and repeated invalid write outcomes.

## Hypotheses

- Commands were drafting against stale inline templates.

## Actions Taken

- Introduced a canonical contract registry.

## Next Safe Action

- /blu-progress

## Additional Context

- Extra operational notes are allowed.
`;
  const thinAuditFixReport = `# Audit Fix Report: Phase 04

## Evidence Used

- .blueprint/phases/04-release-readiness/04-01-SUMMARY.md
`;
  const milestoneAuditReport = `# Milestone v2 - Audit

**Verdict:** READY_TO_CLOSE
**Evidence Dimensions:** roadmap, validation, UAT, carry-forward

## Audit Verdict

- Verdict: READY_TO_CLOSE
- Rationale: All milestone phases have validation and UAT evidence, so the milestone can close.
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
- .blueprint/phases/04-release-readiness/04-VERIFICATION.md
- .blueprint/phases/04-release-readiness/04-UAT.md

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

- /blu-complete-milestone v2
`;
  const thinMilestoneAuditReport = `# Milestone v2 - Audit

## Original Intent Snapshot

- .blueprint/ROADMAP.md

## Roadmap And Phase Evidence

- .blueprint/phases/04-release-readiness/04-VERIFICATION.md

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

- /blu-complete-milestone v2
`;
  const milestoneCompleteReport = `# Milestone v2 - Completion

**Decision:** READY_TO_CLOSE
**Audit Report Used:** .blueprint/reports/milestone-audit-v2.md
**Evidence Ledger:** roadmap, validation, UAT, carry-forward

## Completion Decision

- Decision: READY_TO_CLOSE
- Rationale: The saved roadmap, verification, UAT, and carry-forward evidence all support closing the milestone.
- Closeout basis: .blueprint/reports/milestone-audit-v2.md

## Audit Report Used

- .blueprint/reports/milestone-audit-v2.md

## Milestone Evidence Ledger

| Dimension | Evidence | Status | Notes |
|-----------|----------|--------|-------|
| Roadmap intent | .blueprint/ROADMAP.md | PASS | The roadmap intent and phase list are locked. |
| Validation evidence | .blueprint/phases/04-release-readiness/04-VERIFICATION.md | PASS | The verification evidence is durable. |
| UAT evidence | .blueprint/phases/04-release-readiness/04-UAT.md | PASS | The UAT evidence is durable. |
| Carry-forward evidence | .blueprint/phases/04-release-readiness/04-01-SUMMARY.md | PASS | The closeout evidence can seed the next milestone. |

## Residual Watch Items

- none

## Next Safe Action

- /blu-milestone-summary v2
`;
  const thinMilestoneCompleteReport = `# Milestone v2 - Completion

**Decision:** READY_TO_CLOSE
**Audit Report Used:** none
**Evidence Ledger:** roadmap, validation, UAT, carry-forward

## Completion Decision

- Decision: READY_TO_CLOSE

## Audit Report Used

- none

## Milestone Evidence Ledger

| Dimension | Evidence | Status | Notes |
|-----------|----------|--------|-------|
| Roadmap intent | .blueprint/ROADMAP.md | PASS | The roadmap intent and phase list are locked. |

## Residual Watch Items

- none

## Next Safe Action

- /blu-milestone-summary v2
`;
  const milestoneSummaryReport = `# Milestone v2 - Summary

**Sources Reviewed:** .blueprint/reports/milestone-audit-v2.md, .blueprint/reports/milestone-complete-v2.md, roadmap evidence
**Evidence Ledger:** audit, completion, roadmap, carry-forward
**Carry-Forward Context:** seed for /blu-new-milestone

## Scope Summary

- Milestone v2 closed with saved audit and completion evidence.

## Source Reports Used

- .blueprint/reports/milestone-audit-v2.md
- .blueprint/reports/milestone-complete-v2.md

## Milestone Evidence Ledger

| Dimension | Evidence | Status | Notes |
|-----------|----------|--------|-------|
| Audit report | .blueprint/reports/milestone-audit-v2.md | PASS | The audit report exists and supports closeout. |
| Completion report | .blueprint/reports/milestone-complete-v2.md | PASS | The completion report exists and supports handoff. |
| Roadmap context | .blueprint/ROADMAP.md | PASS | The roadmap context is still aligned. |
| Carry-forward context | .blueprint/phases/04-release-readiness/04-01-SUMMARY.md | PASS | The carry-forward context can seed the next milestone. |

## Shipped Outcomes

- Milestone closeout artifacts were saved for carry-forward planning.

## Deferred Follow-Ups

- none

## Recommended Carry-Forward Context

- Use the audit and completion reports to seed the next milestone.

## Next Safe Action

- /blu-new-milestone
`;
  const thinMilestoneSummaryReport = `# Milestone v2 - Summary

**Sources Reviewed:** .blueprint/reports/milestone-audit-v2.md
**Evidence Ledger:** audit, completion, roadmap, carry-forward
**Carry-Forward Context:** seed for /blu-new-milestone

## Scope Summary

- Milestone v2 is done.

## Source Reports Used

- .blueprint/reports/milestone-audit-v2.md

## Milestone Evidence Ledger

| Dimension | Evidence | Status | Notes |
|-----------|----------|--------|-------|
| Audit report | .blueprint/reports/milestone-audit-v2.md | PASS | The audit report exists. |

## Shipped Outcomes

- none

## Deferred Follow-Ups

- none

## Recommended Carry-Forward Context

- none

## Next Safe Action

- /blu-new-milestone
`;
  const invalidVerdictMilestoneAuditReport = `# Milestone v2 - Audit

**Verdict:** READY_TO_CLOSE
**Evidence Dimensions:** roadmap, validation, UAT, carry-forward

## Audit Verdict

- Rationale: The milestone needs one more pass before closeout.
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
- .blueprint/phases/04-release-readiness/04-VERIFICATION.md
- .blueprint/phases/04-release-readiness/04-UAT.md

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

- /blu-complete-milestone v2
`;
  const customReport = `# Team Notes

- Non-contract report payloads stay permissive.
`;
  const reviewValidation = validateReviewArtifactContent(review, "code-review");
  const legacyReviewValidation = validateReviewArtifactContent(legacyReview, "code-review");
  const thinReviewValidation = validateReviewArtifactContent(thinReview, "code-review");
  const reviewScaffoldValidation = validateReviewArtifactContent(
    readArtifactContract("review.code-review").authoringTemplate,
    "code-review"
  );
  const milestoneAuditScaffoldValidation = validateReportArtifactContent(
    milestoneAuditContract.authoringTemplate,
    "milestone-audit-v2"
  );
  const milestoneAuditValidation = validateReportArtifactContent(
    milestoneAuditReport,
    "milestone-audit-v2"
  );
  const legacyMilestoneAuditReport = `# Milestone v2 - Audit

**Verdict:** READY_TO_CLOSE
**Evidence Dimensions:** roadmap, validation, UAT, carry-forward

## Audit Verdict

- Verdict: READY_TO_CLOSE
- Rationale: The milestone is ready to close.
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
- .blueprint/phases/04-release-readiness/04-VERIFICATION.md
- .blueprint/phases/04-release-readiness/04-UAT.md

## Gaps Found

- none

## Archival Blockers

- none

## Next Safe Action

- /blu-complete-milestone v2
`;
  const invalidVerdictMilestoneAuditValidation = validateReportArtifactContent(
    invalidVerdictMilestoneAuditReport,
    "milestone-audit-v2"
  );
  const invalidStatusMilestoneAuditReport = milestoneAuditReport.replace(
    "| Roadmap intent | .blueprint/ROADMAP.md | PASS | The milestone intent and phase list are locked. |",
    "| Roadmap intent | .blueprint/ROADMAP.md | PASS|GAP|BLOCKED | The milestone intent and phase list are locked. |"
  );
  const invalidStatusMilestoneAuditValidation = validateReportArtifactContent(
    invalidStatusMilestoneAuditReport,
    "milestone-audit-v2"
  );
  const thinMilestoneAuditValidation = validateReportArtifactContent(
    thinMilestoneAuditReport,
    "milestone-audit-v2"
  );
  const milestoneCompleteValidation = validateReportArtifactContent(
    milestoneCompleteReport,
    "milestone-complete-v2"
  );
  const thinMilestoneCompleteValidation = validateReportArtifactContent(
    thinMilestoneCompleteReport,
    "milestone-complete-v2"
  );
  const milestoneSummaryValidation = validateReportArtifactContent(
    milestoneSummaryReport,
    "milestone-summary-v2"
  );
  const thinMilestoneSummaryValidation = validateReportArtifactContent(
    thinMilestoneSummaryReport,
    "milestone-summary-v2"
  );
  assert.match(
    securityContract.authoringTemplate,
    /\*\*Status:\*\* COMPLETED\|PARTIAL\|BLOCKED/
  );
  assert.deepEqual(auditFixContract.requiredHeadings, [
    "Evidence Used",
    "Fix Scope",
    "Changes Applied",
    "Remaining Gaps",
    "Next Safe Action"
  ]);
  assert.deepEqual(auditFixContract.lockedMarkers, [
    "**Status:**",
    "**Readiness:**",
    "**Completion State:**",
    "**Source:**",
    "**Severity Filter:**",
    "**Max Attempts:**",
    "**Dry Run:**",
    "**Next Safe Action:**"
  ]);
  assert.equal(auditFixContract.modelContract?.schemaId, "blueprint.report.audit-fix.model");
  assert.equal(auditFixContract.modelContract?.schemaVersion, "1.0.0");
  assert.equal(
    auditFixContract.modelContract?.schemaPath,
    "src/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json"
  );
  assert.deepEqual(
    (auditFixContract.modelContract?.jsonSchema.required as string[]).slice(0, 4),
    ["status", "readiness", "completionState", "remediationSummary"]
  );
  assert.match(auditFixContract.authoringTemplate, /\*\*Source:\*\* review\|security\|verification\|uat\|all/);
  assert.match(
    auditFixContract.authoringTemplate,
    /\| Finding ID \| Evidence Source \| Severity \| Classification \|/
  );
  assert.match(auditFixContract.authoringTemplate, /### Summary Evidence/);
  assert.match(auditFixContract.authoringTemplate, /### Evidence Ledger/);
  assert.match(auditFixContract.authoringTemplate, /### Follow-Up Fixes/);
  assert.match(
    auditFixContract.authoringTemplate,
    /pre-fix HEAD <sha\|unknown\|none>; created commits <sha list\|unknown\|none>/
  );
  assert.match(
    auditFixContract.authoringTemplate,
    /Todo capture: <captured\|declined\|not-needed\|blocked>/
  );
  assert.equal(securityScaffoldValidation.valid, false);
  assert.match(securityScaffoldValidation.issues.join("\n"), /placeholder scaffold text/i);
  assert.equal(milestoneAuditScaffoldValidation.valid, false);
  assert.match(milestoneAuditScaffoldValidation.issues.join("\n"), /placeholder scaffold text/i);
  assert.equal(thinSecurityValidation.valid, false);
  assert.match(thinSecurityValidation.issues.join("\n"), /Threat Register/);
  assert.match(thinSecurityValidation.issues.join("\n"), /Accepted Risks/);
  assert.match(thinSecurityValidation.issues.join("\n"), /Security Audit Trail/);
  const reportValidation = validateReportArtifactContent(report, "debug-latest");
  const thinAuditFixValidation = validateReportArtifactContent(thinAuditFixReport, "audit-fix-04");
  const customReportValidation = validateReportArtifactContent(customReport, "custom-team-notes");

  assert.equal(reviewValidation.valid, true, reviewValidation.issues.join("\n"));
  assert.equal(legacyReviewValidation.valid, false);
  assert.match(legacyReviewValidation.issues.join("\n"), /canonical MCP-rendered shape/);
  assert.equal(thinReviewValidation.valid, false);
  assert.equal(reviewScaffoldValidation.valid, false, reviewScaffoldValidation.issues.join("\n"));
  assert.match(
    reviewScaffoldValidation.issues.join("\n"),
    /PASS\|FOLLOW_UP\|BLOCKED|Repo-relative file path reviewed|path\/to\/file\.ts:42/
  );
  assert.match(thinReviewValidation.issues.join("\n"), /Review Summary/);
  assert.match(thinReviewValidation.issues.join("\n"), /Evidence Reviewed/);
  assert.match(thinReviewValidation.issues.join("\n"), /Positive Signals/);
  assert.match(thinReviewValidation.issues.join("\n"), /Severity Summary/);
  assert.equal(reportValidation.valid, true, reportValidation.issues.join("\n"));
  assert.equal(thinAuditFixValidation.valid, false);
  assert.match(thinAuditFixValidation.issues.join("\n"), /Fix Scope/);
  assert.match(thinAuditFixValidation.issues.join("\n"), /Changes Applied/);
  assert.match(thinAuditFixValidation.issues.join("\n"), /Remaining Gaps/);
  assert.match(thinAuditFixValidation.issues.join("\n"), /Next Safe Action/);
  assert.equal(milestoneAuditValidation.valid, true, milestoneAuditValidation.issues.join("\n"));
  assert.equal(
    validateReportArtifactContent(legacyMilestoneAuditReport, "milestone-audit-v2").valid,
    true
  );
  assert.equal(invalidVerdictMilestoneAuditValidation.valid, false);
  assert.match(
    invalidVerdictMilestoneAuditValidation.issues.join("\n"),
    /Verdict line/
  );
  assert.equal(invalidStatusMilestoneAuditValidation.valid, false);
  assert.match(
    invalidStatusMilestoneAuditValidation.issues.join("\n"),
    /keep each evidence row in the Dimension, Evidence, Status, and Notes columns/
  );
  assert.equal(resolveReportContractId("milestone audit v2"), null);
  assert.equal(resolveReportContractId("milestone complete v2"), null);
  assert.equal(resolveReportContractId("milestone summary v2"), null);
  assert.equal(thinMilestoneAuditValidation.valid, false);
  assert.match(thinMilestoneAuditValidation.issues.join("\n"), /Audit Verdict/);
  assert.match(thinMilestoneAuditValidation.issues.join("\n"), /Milestone Evidence Dimensions/);
  assert.equal(
    milestoneCompleteValidation.valid,
    true,
    milestoneCompleteValidation.issues.join("\n")
  );
  assert.equal(thinMilestoneCompleteValidation.valid, false);
  assert.match(thinMilestoneCompleteValidation.issues.join("\n"), /Audit Report Used/);
  assert.match(thinMilestoneCompleteValidation.issues.join("\n"), /Milestone Evidence Ledger/);
  assert.match(thinMilestoneCompleteValidation.issues.join("\n"), /must reference milestone-audit/i);
  assert.equal(
    milestoneSummaryValidation.valid,
    true,
    milestoneSummaryValidation.issues.join("\n")
  );
  assert.equal(thinMilestoneSummaryValidation.valid, false);
  assert.match(thinMilestoneSummaryValidation.issues.join("\n"), /Source Reports Used/);
  assert.match(thinMilestoneSummaryValidation.issues.join("\n"), /Milestone Evidence Ledger/);
  assert.match(thinMilestoneSummaryValidation.issues.join("\n"), /must reference milestone-complete/i);
  assert.equal(customReportValidation.valid, true, customReportValidation.issues.join("\n"));
});

test("verification and UAT contracts reject evidence that does not link to a valid summary", () => {
  const verification = `# Phase 03: Discovery - Verification

**Coverage:** Reviewed the saved execution evidence for the completed phase.

## Validation Summary

- Validation coverage is sufficient for UAT.

## Evidence Reviewed

- unrelated-note.md

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- /blu-verify-work 3
`;
  const uat = `# Phase 03: Discovery - UAT

**Status:** PASS

## UAT Summary

- The saved behavior matched the expected outcome.

## Questions Asked

- Did the observed behavior align with the completed execution evidence?

## Observed Behavior

- The observed behavior remained consistent with the reported outcome.

## Unresolved Gaps

- none

## Follow-Up Fixes

- none

## Next Safe Action

- /blu-progress
`;
  const verificationValidation = validateVerificationArtifactContent(verification, [
    ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"
  ]);
  const uatValidation = validateUatArtifactContent(uat, [
    ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"
  ]);

  assert.equal(verificationValidation.valid, false, verificationValidation.issues.join("\n"));
  assert.equal(uatValidation.valid, false, uatValidation.issues.join("\n"));
  assert.match(
    verificationValidation.issues.join("\n"),
    /must cite at least one saved execution summary path or filename/i
  );
  assert.match(
    uatValidation.issues.join("\n"),
    /must (?:cite|reference) at least one saved execution summary path or filename/i
  );
});

test("verification and UAT contracts reject headings that are not the first bytes in the file", () => {
  const prefacedVerification = `Preamble text that should fail.

# Phase 03: Discovery - Verification

**Coverage:** Reviewed the saved execution evidence for the completed phase.

## Validation Summary

- Validation coverage is sufficient for UAT.

## Evidence Reviewed

- .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- /blu-verify-work 3
`;
  const prefacedUat = `Preamble text that should fail.

# Phase 03: Discovery - UAT

**Status:** PASS

## UAT Summary

- The saved behavior matched the expected outcome.

## Questions Asked

- Did the observed behavior align with the completed execution evidence?

## Observed Behavior

- The observed behavior matched .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md.

## Unresolved Gaps

- none

## Follow-Up Fixes

- none

## Next Safe Action

- /blu-progress
`;
  const verificationValidation = validateVerificationArtifactContent(prefacedVerification, [
    ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"
  ]);
  const uatValidation = validateUatArtifactContent(prefacedUat, [
    ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"
  ]);

  assert.equal(verificationValidation.valid, false, verificationValidation.issues.join("\n"));
  assert.equal(uatValidation.valid, false, uatValidation.issues.join("\n"));
  assert.match(verificationValidation.issues.join("\n"), /must start with a '# \.\.\. - Verification' heading/i);
  assert.match(uatValidation.issues.join("\n"), /must start with a '# \.\.\. - UAT' heading/i);
});

test("contract registry remains listable through the direct helper", () => {
  const contracts = listArtifactContracts();

  assert.ok(contracts.some((contract) => contract.id === "phase.research"));
  assert.ok(contracts.some((contract) => contract.id === "review.security"));
  assert.ok(contracts.some((contract) => contract.id === "report.debug"));
});
