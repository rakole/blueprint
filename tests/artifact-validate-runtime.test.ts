import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  blueprintArtifactValidate,
  inspectBootstrapArtifacts,
  validateUatArtifactContent,
  validateVerificationArtifactContent
} from "../src/mcp/tools/artifacts.js";
import { createCommittedGitRepo } from "./helpers/git-fixtures.js";

async function createVerifyWorkFixtureRepo(): Promise<string> {
  const repoPath = await createCommittedGitRepo("blueprint-verify-work-");

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-validation"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "# Roadmap\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/STATE.md"), "# Blueprint State\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-validation/03-CONTEXT.md"),
    `# Phase 03: Validation - Context

## Decisions

- Validation keeps saved evidence and resumable session state explicit.
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-validation/03-01-SUMMARY.md"),
    `# Phase 03: Validation - Summary

## Result

- Saved execution evidence exists for validate-phase and verify-work.
`,
    "utf8"
  );

  return repoPath;
}

async function createThinBootstrapFixtureRepo(
  includePhaseArtifact = false
): Promise<string> {
  const repoPath = await createCommittedGitRepo("blueprint-bootstrap-validate-");

  await mkdir(path.join(repoPath, ".blueprint/phases"), { recursive: true });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "# Roadmap\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/STATE.md"), "# Blueprint State\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");

  if (includePhaseArtifact) {
    await mkdir(path.join(repoPath, ".blueprint/phases/01-phase-bootstrap"), {
      recursive: true
    });
    await writeFile(
      path.join(repoPath, ".blueprint/phases/01-phase-bootstrap/01-CONTEXT.md"),
      `# Phase 01: Bootstrap - Context

## Decisions

- Preserve the bootstrap compatibility path for in-progress repos.
`,
      "utf8"
    );
  }

  return repoPath;
}

async function createLegacyCompatibilityFixtureRepo(
  includeDiscoveryPhase = false
): Promise<string> {
  const repoPath = await createCommittedGitRepo("blueprint-compat-validate-");

  await mkdir(path.join(repoPath, ".blueprint/phases"), { recursive: true });
  await writeFile(
    path.join(repoPath, ".blueprint/PROJECT.md"),
    "# Project\n\n## Vision\n\nKeep runtime and tests aligned.\n",
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/REQUIREMENTS.md"),
    `# Requirements

## Requirements Table

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| LEG-01 | Keep runtime validation compatible with initialized repos. | Done | Legacy fixture |
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap

## Phases

- [ ] Phase 2: Keep validation stable
`,
    "utf8"
  );
  await writeFile(path.join(repoPath, ".blueprint/STATE.md"), "# Blueprint State\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");

  const phaseRoot = includeDiscoveryPhase
    ? path.join(repoPath, ".blueprint/phases/03-phase-discovery")
    : path.join(repoPath, ".blueprint/phases/02-router-health-and-mapping");

  await mkdir(phaseRoot, { recursive: true });
  await writeFile(
    path.join(
      phaseRoot,
      includeDiscoveryPhase ? "03-CONTEXT.md" : "02-CONTEXT.md"
    ),
    includeDiscoveryPhase
      ? `# Phase 03: Phase Discovery - Context

## Phase Boundary

- Discovery remains in progress for Phase 03.

## Discovery Grounding

- Saved roadmap and requirements keep this phase grounded.

## Implementation Decisions

- Preserve initialized-repo validation compatibility.

## Specific Ideas

- Continue discovery without treating the fixture as malformed.

## Existing Code Insights

- Legacy fixtures may contain older roadmap shells.

## Dependencies

- .blueprint/ROADMAP.md remains the saved source for the legacy phase boundary.

## Open Questions

- No unresolved compatibility questions remain for this initialized fixture.

## Deferred Ideas

- No deferred discovery ideas are needed for this initialized fixture.

## Canonical References

- .blueprint/ROADMAP.md - legacy roadmap fixture.
`
      : `# Phase 02: Router Health And Mapping - Context

## Phase Boundary

- The repository already has durable phase evidence.

## Discovery Grounding

- Saved roadmap and requirements keep this phase grounded.

## Implementation Decisions

- Preserve initialized-repo validation compatibility.

## Specific Ideas

- Continue validation without treating the fixture as malformed.

## Existing Code Insights

- Legacy fixtures may contain older roadmap shells.

## Dependencies

- .blueprint/ROADMAP.md remains the saved source for the legacy phase boundary.

## Open Questions

- No unresolved compatibility questions remain for this initialized fixture.

## Deferred Ideas

- No deferred discovery ideas are needed for this initialized fixture.

## Canonical References

- .blueprint/ROADMAP.md - legacy roadmap fixture.
`,
    "utf8"
  );

  if (includeDiscoveryPhase) {
    await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery"), {
      recursive: true
    });
    await writeFile(
      path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"),
      `# Phase 03: Phase Discovery - Context

## Phase Boundary

- Discovery remains in progress for Phase 03.

## Discovery Grounding

- Saved roadmap and requirements keep this phase grounded.

## Implementation Decisions

- Preserve initialized-repo validation compatibility.

## Specific Ideas

- Continue discovery without treating the fixture as malformed.

## Existing Code Insights

- Legacy fixtures may contain older roadmap shells.

## Dependencies

- .blueprint/ROADMAP.md remains the saved source for the legacy phase boundary.

## Open Questions

- No unresolved compatibility questions remain for this initialized fixture.

## Deferred Ideas

- No deferred discovery ideas are needed for this initialized fixture.

## Canonical References

- .blueprint/ROADMAP.md - legacy roadmap fixture.
`,
      "utf8"
    );
  }

  return repoPath;
}

function createBootstrapProjectContent(): string {
  return `# Project: Bootstrap Seed

## Vision

Build a bootstrap workflow that keeps requirements, roadmap, and validation traceable.

## Audience

- Primary: Repository maintainers
- Secondary: Contributors

## Constraints

- Keep bootstrap edits small and deterministic.
- Preserve requirement identifiers across artifacts.

## Current Milestone

- v1 bootstrap seed

## Bootstrap Shape

- Repository shape: greenfield
- Codebase mapping: pending
- Bootstrap posture: deterministic and traceable

## Scope Posture

- Committed v1: RQ-01, RQ-02
- Deferred: RQ-03
- Out-of-scope: RQ-04

## Non-Goals

- Full implementation planning
- Execution backlog generation

## Assumptions

- The repo still needs a canonical bootstrap baseline.
`;
}

function createBootstrapRequirementsContent(options: {
  scopeSummary?: string;
  committedScope?: string;
  deferredScope?: string;
  outOfScope?: string;
} = {}): string {
  const scopeSummary =
    options.scopeSummary ??
    `- Committed v1: RQ-01, RQ-02
- Deferred: RQ-03
- Out-of-scope: RQ-04`;
  const committedScope =
    options.committedScope ??
    `### Product direction

- \`RQ-01\`: Define the product outcome and first milestone goals.
  - Status: Pending
  - Notes: Bootstrap draft requirement.

### Delivery boundaries

- \`RQ-02\`: Record durable constraints, non-goals, and acceptance boundaries.
  - Status: Pending
  - Notes: Keeps later discovery grounded.`;
  const deferredScope =
    options.deferredScope ??
    `### Follow-through planning

- \`RQ-03\`: Prepare the repo for lifecycle commands with stable traceability.
  - Status: Pending
  - Notes: Foundation requirement for later phases.`;
  const outOfScope =
    options.outOfScope ??
    `### Explicit bootstrap cuts

- \`RQ-04\`: Do not turn the bootstrap draft into a full implementation backlog.
  - Status: Pending
  - Notes: Keeps v1 bootstrap narrower than later work streams.`;

  return `# Requirements: Bootstrap Seed

## Requirements Table

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| RQ-01 | Define the product outcome and first milestone goals. | Pending | Bootstrap draft requirement. |
| RQ-02 | Record durable constraints, non-goals, and acceptance boundaries. | Pending | Keeps later discovery grounded. |
| RQ-03 | Prepare the repo for lifecycle commands with stable traceability. | Pending | Foundation requirement for later phases. |
| RQ-04 | Do not turn the bootstrap draft into a full implementation backlog. | Pending | Keeps v1 bootstrap narrower than later work streams. |

## Scope Summary

${scopeSummary}

## Committed V1 Scope

${committedScope}

## Deferred Scope

${deferredScope}

## Out-of-Scope Cuts

${outOfScope}

## Traceability Notes

- Keep every requirement ID referenced from .blueprint/ROADMAP.md before execution planning begins.
- Preserve requirement IDs across later phase artifacts instead of silently renumbering them.
- Use these requirements as the durable baseline for later discovery and planning.

## Open Questions

- Should the bootstrap seed remain minimal if the repo grows additional lifecycle commands?
`;
}

function createBootstrapRoadmapContent(options: {
  requirementCoverage?: string;
  phases?: string;
  notes?: string;
} = {}): string {
  const requirementCoverage =
    options.requirementCoverage ??
    `- Committed v1: RQ-01, RQ-02
- Deferred: RQ-03
- Out-of-scope: RQ-04`;
  const phases =
    options.phases ??
    `- [ ] Phase 1: Bootstrap Seed (Requirements: RQ-01)
  - Objective: Seed the first milestone.
  - Success Criteria:
    - Bootstrap requirements are traceable.
    - The bootstrap contract stays coherent.
  - Notes:
    - Keep traceability consistent.

- [ ] Phase 2: Traceable Follow-Through (Requirements: RQ-02, RQ-03)
  - Objective: Turn the bootstrap draft into durable planning inputs.
  - Success Criteria:
    - Requirement coverage stays aligned with the canonical requirements table.
    - Later planning can proceed without renumbering.
  - Notes:
    - Keep the roadmap ready for later execution-oriented phases.`;
  const notes =
    options.notes ??
    `- Keep traceability consistent.
- Treat later planning as provisional until the bootstrap seed is stable.`;

  return `# Roadmap: Bootstrap Seed

## Milestone

- Active milestone: v1

## Bootstrap Status

- Repository shape: greenfield
- Codebase mapping: pending
- Roadmap confidence: provisional

## Requirement Coverage

${requirementCoverage}

## Phases

${phases}

## Notes

${notes}
`;
}

async function writeBootstrapArtifacts(
  repoPath: string,
  options: {
    projectContent?: string;
    requirementsContent?: string;
    roadmapContent?: string;
  } = {}
): Promise<void> {
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), options.projectContent ?? createBootstrapProjectContent(), "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/REQUIREMENTS.md"),
    options.requirementsContent ?? createBootstrapRequirementsContent(),
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    options.roadmapContent ?? createBootstrapRoadmapContent(),
    "utf8"
  );
}

test("blueprint artifact validation inspects UAT and verification content and proposes repairs", async (t) => {
  const repoPath = await createVerifyWorkFixtureRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const summaryPath = ".blueprint/phases/03-phase-validation/03-01-SUMMARY.md";
  const verificationContent = `# Phase 03: Validation - Verification

**Coverage:** Reviewed \`${summaryPath}\` and any other saved phase summaries for validation evidence.
**Gate State:** PASS
**Sign-off:** validation lead

## Validation Summary

- Execution evidence matches the expected phase outcome.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| VAL-01 | Confirm execution evidence exists | \`${summaryPath}\` | PASS | Saved summaries back the verification pass. |

## Evidence Reviewed

- none

## Test Infrastructure / Evidence Metadata

- Harness: node:test
- Commands: npm test
- Evidence type: saved execution summary
- Test infrastructure status: available

## Manual-Only or Deferred Coverage

| Item | Why manual or deferred | Follow-Up | Status |
|------|------------------------|-----------|--------|
| none | none | none | none |

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
`;
  const uatContent = `# Phase 03: Validation - UAT

**Status:** PASS
**Resume State:** RESUMED
**Checkpoint:** pending

## UAT Summary

- The user acceptance run passed.

## Session State

- Resume source: pending
- Current session step: Confirm the saved behavior still matches the approved outcome.
- Continuity notes: Keep the verified behavior stable between sessions.

## Questions Asked

- Did the validated feature behave as expected for the saved execution summary?

## Observed Behavior

- The observed behavior matched the saved verification artifact.

## Unresolved Gaps

- none

## Follow-Up Fixes

- none

## Next Safe Action

- /blu-progress
`;

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-validation/03-VERIFICATION.md"),
    verificationContent,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-validation/03-UAT.md"),
    uatContent,
    "utf8"
  );

  const verificationValidation = validateVerificationArtifactContent(verificationContent, [
    summaryPath
  ]);
  const uatValidation = validateUatArtifactContent(uatContent, [summaryPath]);
  const runtimeValidation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(verificationValidation.valid, false);
  assert.match(
    verificationValidation.issues.join("\n"),
    /must cite at least one saved execution summary path or filename/
  );
  assert.equal(uatValidation.valid, false);
  assert.match(
    uatValidation.issues.join("\n"),
    /must cite at least one saved execution summary path or filename/
  );
  assert.equal(uatValidation.warnings.length, 0);
  assert.equal(runtimeValidation.valid, false);
  assert.match(
    runtimeValidation.issues.join("\n"),
    /03-VERIFICATION\.md: Verification artifact must cite at least one saved execution summary path or filename/
  );
  assert.match(
    runtimeValidation.issues.join("\n"),
    /03-UAT\.md: UAT artifact must cite at least one saved execution summary path or filename/
  );
  assert.match(runtimeValidation.suggestedRepairs.join("\n"), /\/blu-validate-phase/);
  assert.match(runtimeValidation.suggestedRepairs.join("\n"), /\/blu-verify-work/);
});

test("blueprint artifact validation rejects thin bootstrap PROJECT, REQUIREMENTS, and ROADMAP docs", async (t) => {
  const repoPath = await createThinBootstrapFixtureRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const runtimeValidation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(runtimeValidation.valid, false);
  assert.match(
    runtimeValidation.issues.join("\n"),
    /PROJECT\.md: Project artifact section Vision must contain substantive project direction\./
  );
  assert.match(
    runtimeValidation.issues.join("\n"),
    /REQUIREMENTS\.md: Requirements artifact section Requirements Table must include at least one populated requirement row\./
  );
  assert.match(
    runtimeValidation.issues.join("\n"),
    /ROADMAP\.md: Roadmap artifact section Phases must include at least one concrete phase entry\./
  );
  assert.match(
    runtimeValidation.suggestedRepairs.join("\n"),
    /Re-run \/blu-new-project or \/blu-health --repair to regenerate the bootstrap artifacts from the canonical contract\./
  );
});

test("blueprint artifact validation still inspects bootstrap docs when phase artifacts already exist", async (t) => {
  const repoPath = await createThinBootstrapFixtureRepo(true);
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const runtimeValidation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(runtimeValidation.valid, false);
  assert.match(
    runtimeValidation.issues.join("\n"),
    /REQUIREMENTS\.md: Requirements artifact section Requirements Table must include at least one populated requirement row\./
  );
  assert.match(
    runtimeValidation.issues.join("\n"),
    /ROADMAP\.md: Roadmap artifact section Phases must include at least one concrete phase entry\./
  );
});

test("bootstrap traceability warnings reject roadmap requirement refs that are not declared in REQUIREMENTS.md", async (t) => {
  const repoPath = await createThinBootstrapFixtureRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/REQUIREMENTS.md"),
    `# Requirements: Bootstrap Seed

## Requirements Table

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| RQ-01 | Keep the bootstrap contract traceable. | Done | Valid requirement identifier |

## Scope Summary

- Committed v1: RQ-01
- Deferred: none
- Out-of-scope: none

## Committed V1 Scope

### Traceability

- \`RQ-01\`: Keep the bootstrap contract traceable.

## Traceability Notes

- Traceability is recorded in .blueprint/ROADMAP.md.

## Open Questions

- none
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Bootstrap Seed

## Milestone

- v1

## Bootstrap Status

- Repository shape: greenfield
- Codebase mapping: pending
- Roadmap confidence: provisional

## Requirement Coverage

- Committed v1: BP-99
- Deferred: none
- Out-of-scope: none

## Phases

- [ ] Phase 1: Bootstrap Seed (Requirements: RQ-01)
  - Objective: Seed the first milestone.

## Notes

- Keep traceability consistent.
`,
    "utf8"
  );

  const diagnostics = await inspectBootstrapArtifacts(repoPath);

  assert.match(
    diagnostics.traceabilityWarnings.join("\n"),
    /ROADMAP\.md references requirement BP-99 which is not declared in REQUIREMENTS\.md\./
  );
});

test("bootstrap traceability ignores unrelated ticket IDs outside requirement coverage and phase mappings", async (t) => {
  const repoPath = await createThinBootstrapFixtureRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeBootstrapArtifacts(repoPath, {
    roadmapContent: createBootstrapRoadmapContent({
      notes: `- Keep traceability consistent.
- Ticket ABC-123 is discussed here but should not be treated as a requirement reference.`
    })
  });

  const diagnostics = await inspectBootstrapArtifacts(repoPath);
  const runtimeValidation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(diagnostics.traceabilityWarnings.length, 0);
  assert.equal(runtimeValidation.valid, true);
});

test("bootstrap roadmap validation requires per-phase requirement mapping and success criteria", async (t) => {
  const repoPath = await createThinBootstrapFixtureRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeBootstrapArtifacts(repoPath, {
    roadmapContent: createBootstrapRoadmapContent({
      phases: `- [ ] Phase 1: Bootstrap Seed
  - Objective: Seed the first milestone.
  - Notes:
    - Keep traceability consistent.`
    })
  });

  const validation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(validation.valid, false);
  assert.match(
    validation.issues.join("\n"),
    /ROADMAP\.md: Roadmap artifact Phase 1 field Requirements is missing requirement IDs\. Repair by adding a Requirements clause with IDs from Requirement Coverage\./
  );
  assert.match(
    validation.issues.join("\n"),
    /ROADMAP\.md: Phase 1 \(Bootstrap Seed\) must include at least two success criteria\. Repair Phase 1 field Success Criteria by listing 2-5 observable criteria\./
  );
});

test("bootstrap roadmap validation treats bold and unbolded phase lines consistently", async (t) => {
  const boldRepoPath = await createThinBootstrapFixtureRepo();
  const unboldedRepoPath = await createThinBootstrapFixtureRepo();

  t.after(async () => {
    await rm(path.dirname(boldRepoPath), { recursive: true, force: true });
    await rm(path.dirname(unboldedRepoPath), { recursive: true, force: true });
  });

  const unboldedPhases = `- [ ] Phase 1: Bootstrap Seed (Requirements: RQ-01, RQ-04)
  - Objective: Seed the first milestone.
  - Success Criteria:
    - Bootstrap requirements are traceable.
    - The bootstrap contract stays coherent.

- [ ] Phase 2: Traceable Follow-Through (Requirements: RQ-02, RQ-03)
  - Objective: Turn the bootstrap draft into durable planning inputs.
  - Success Criteria:
    - Requirement coverage stays aligned with the canonical requirements table.
    - Later planning can proceed without renumbering.`;
  const boldPhases = unboldedPhases.replace(
    /^- \[ \] Phase ([^\n(]+)( \(Requirements: [^)]+\))/gm,
    "- [ ] **Phase $1**$2"
  );

  await writeBootstrapArtifacts(unboldedRepoPath, {
    roadmapContent: createBootstrapRoadmapContent({ phases: unboldedPhases })
  });
  await writeBootstrapArtifacts(boldRepoPath, {
    roadmapContent: createBootstrapRoadmapContent({ phases: boldPhases })
  });

  const unboldedValidation = await blueprintArtifactValidate({ cwd: unboldedRepoPath });
  const boldValidation = await blueprintArtifactValidate({ cwd: boldRepoPath });

  assert.equal(unboldedValidation.valid, true);
  assert.deepEqual(boldValidation.issues, unboldedValidation.issues);
  assert.equal(boldValidation.valid, unboldedValidation.valid);
});

test("bootstrap roadmap validation reports phase-specific success criteria count diagnostics", async (t) => {
  const repoPath = await createThinBootstrapFixtureRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeBootstrapArtifacts(repoPath, {
    roadmapContent: createBootstrapRoadmapContent({
      phases: `- [ ] Phase 1: Bootstrap Seed (Requirements: RQ-01, RQ-04)
  - Objective: Seed the first milestone.
  - Success Criteria:

- [ ] Phase 2: Traceable Follow-Through (Requirements: RQ-02, RQ-03)
  - Objective: Turn the bootstrap draft into durable planning inputs.
  - Success Criteria:
    - Criterion one.
    - Criterion two.
    - Criterion three.
    - Criterion four.
    - Criterion five.
    - Criterion six.`
    })
  });

  const validation = await blueprintArtifactValidate({ cwd: repoPath });
  const issues = validation.issues.join("\n");

  assert.equal(validation.valid, false);
  assert.match(
    issues,
    /ROADMAP\.md: Phase 1 \(Bootstrap Seed\) must include at least two success criteria\. Repair Phase 1 field Success Criteria by listing 2-5 observable criteria\./
  );
  assert.match(
    issues,
    /ROADMAP\.md: Phase 2 \(Traceable Follow-Through\) must include no more than five success criteria\. Repair Phase 2 field Success Criteria by trimming it to 2-5 observable criteria\./
  );
});

test("bootstrap roadmap validation names offending undeclared requirement IDs and phase numbers", async (t) => {
  const repoPath = await createThinBootstrapFixtureRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeBootstrapArtifacts(repoPath, {
    roadmapContent: createBootstrapRoadmapContent({
      requirementCoverage: `- Committed v1: RQ-01, RQ-02
- Deferred: RQ-03
- Out-of-scope: RQ-04`,
      phases: `- [ ] Phase 1: Bootstrap Seed (Requirements: RQ-01, RQ-99)
  - Objective: Seed the first milestone.
  - Success Criteria:
    - Bootstrap requirements are traceable.
    - The bootstrap contract stays coherent.

- [ ] Phase 3: Traceable Follow-Through (Requirements: RQ-02, RQ-03, RQ-04)
  - Objective: Turn the bootstrap draft into durable planning inputs.
  - Success Criteria:
    - Requirement coverage stays aligned with the canonical requirements table.
    - Later planning can proceed without renumbering.`
    })
  });

  const validation = await blueprintArtifactValidate({ cwd: repoPath });
  const issues = validation.issues.join("\n");

  assert.equal(validation.valid, false);
  assert.match(
    issues,
    /ROADMAP\.md: Roadmap artifact Phase 1 field Requirements references unknown IDs RQ-99\. Repair by adding those IDs to Requirement Coverage or replacing them with declared requirement IDs\./
  );
  assert.match(
    issues,
    /ROADMAP\.md references requirement RQ-99 which is not declared in REQUIREMENTS\.md\./
  );
});

test("bootstrap requirements validation reconciles requirement IDs across summary and grouped scope sections", async (t) => {
  const repoPath = await createThinBootstrapFixtureRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeBootstrapArtifacts(repoPath, {
    requirementsContent: createBootstrapRequirementsContent({
      deferredScope: `### Follow-through planning

- \`RQ-02\`: Prepare the repo for lifecycle commands with stable traceability.
  - Status: Pending
  - Notes: Foundation requirement for later phases.`
    })
  });

  const validation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(validation.valid, false);
  assert.match(
    validation.issues.join("\n"),
    /REQUIREMENTS\.md: Requirements artifact section Deferred Scope must list the same requirement IDs as Scope Summary\./
  );
});

test("blueprint artifact validation stays compatible with legacy initialized and in-progress discovery repos", async (t) => {
  const legacyRepoPath = await createLegacyCompatibilityFixtureRepo();
  const discoveryRepoPath = await createLegacyCompatibilityFixtureRepo(true);

  t.after(async () => {
    await rm(path.dirname(legacyRepoPath), { recursive: true, force: true });
    await rm(path.dirname(discoveryRepoPath), { recursive: true, force: true });
  });

  const legacyValidation = await blueprintArtifactValidate({ cwd: legacyRepoPath });
  const discoveryValidation = await blueprintArtifactValidate({ cwd: discoveryRepoPath });

  assert.equal(legacyValidation.valid, true);
  assert.deepEqual(legacyValidation.issues, []);
  assert.equal(discoveryValidation.valid, true);
  assert.deepEqual(discoveryValidation.issues, []);
});
