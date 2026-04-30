import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintPhaseSummaryWrite } from "../src/mcp/tools/phase.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import {
  blueprintReviewAuthoringContext,
  blueprintReviewLoadFindings,
  blueprintReviewRecord,
  blueprintReviewValidateModel
} from "../src/mcp/tools/review.js";

const repoRoot = process.cwd();

async function createCodeReviewFixRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-code-review-fix-"));
  const repoPath = path.join(tempRoot, "repo");
  const phaseDir = path.join(repoPath, ".blueprint/phases/05-review-fix");

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Code Review Fix Fixture

## Milestone

- Active milestone: v4

## Phases

- [x] **Phase 5: Review Fix** - Completed review with follow-up fixes

## Phase Details

### Phase 5: Review Fix
**Goal**: Remediate the saved review findings.
**Requirements**: REVFIX-01
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v4
- Current phase: 5
- Active command: /blu-code-review
- Next action: Run /blu-code-review-fix 5
- Last updated: 2026-04-13T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");
  await writeFile(
    path.join(repoPath, "src/feature.ts"),
    "export function calculateValue(input: number) {\n  return input * 2;\n}\n",
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-01-PLAN.md"),
    `---
phase: 5
plan_id: "01"
title: "Review Fix Plan"
wave: 1
status: ready
objective: "Seed completed execution evidence for review-fix tests."
depends_on: []
requirements: ["REVFIX-01"]
files_modified: ["src/feature.ts"]
read_first: ["src/feature.ts"]
acceptance_criteria:
  - "tests/code-review-fix-slice.test.ts exits 0"
autonomous: true
---

# Phase 05: Review Fix - Plan 01

## Goal

Seed completed execution evidence for review-fix tests.

## Scope

- Keep the review-fix fixture source and evidence bounded to the saved review finding.

## Tasks

### Task 1: Implement fixture

#### Read First

- src/feature.ts

#### Action

- Keep the fixture source readable for review-fix validation.

#### Acceptance Criteria

- tests/code-review-fix-slice.test.ts exits 0

## Verification

- npm test -- tests/code-review-fix-slice.test.ts exits 0

## Must Haves

- Review-fix validation can cite a completed execution summary.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-REVIEW.md"),
    `# Phase 05: Review Fix - Review

**Status:** FOLLOW_UP

## Findings

- [high] Handle negative inputs explicitly in src/feature.ts.
- [medium] Add a regression test for negative-input behavior.

## Follow-Ups

- Re-run focused validation after the negative-input guard lands.
`,
    "utf8"
  );
  const summaryWrite = await blueprintPhaseSummaryWrite({
    cwd: repoPath,
    phase: "5",
    planId: "01",
    model: {
      status: "COMPLETED",
      readiness: "ready-for-validation",
      completionState: "complete",
      outcome: ["Execution evidence exists for review-fix remediation."],
      changesMade: ["Seeded the review-fix fixture source."],
      targetedVerification: [
        {
          check: "tests/code-review-fix-slice.test.ts exits 0",
          command: "npm test -- tests/code-review-fix-slice.test.ts",
          result: "pass",
          evidence: "Fixture summary proves the prerequisite plan is complete.",
          notes: "Review-fix can cite this summary."
        }
      ],
      dependencyPlans: [],
      manualOrDeferredWork: [
        {
          item: "none",
          reason: "none",
          followUp: "none",
          status: "NONE"
        }
      ],
      gapRoutes: [
        {
          gap: "none",
          evidence: "none",
          repair: "none",
          status: "NONE"
        }
      ],
      followUps: ["none"],
      evidence: [
        {
          kind: "artifact",
          source: ".blueprint/phases/05-review-fix/05-01-SUMMARY.md",
          summary: "Saved summary artifact."
        }
      ],
      nextSafeAction: "/blu-validate-phase 5"
    }
  });
  assert.notEqual(summaryWrite.status, "invalid", summaryWrite.issues.join("\n"));

  return repoPath;
}

function validReviewFixModel(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: "COMPLETED",
    readiness: "ready-for-validation",
    completionState: "complete",
    remediationSummary: [
      "The selected negative-input finding was fixed and verified against the focused fixture."
    ],
    findingsAddressed: [
      {
        findingId: "F-01",
        status: "fixed",
        evidence: "The source now guards negative inputs before returning a calculated value.",
        disposition: "Focused remediation completed for the saved high-severity finding."
      },
      {
        findingId: "F-02",
        status: "fixed",
        evidence: "Regression coverage was added for negative-input behavior.",
        disposition: "The selected medium-severity test gap was closed."
      },
      {
        findingId: "FU-01",
        status: "fixed",
        evidence: "Focused validation was rerun after the negative-input guard landed.",
        disposition: "The saved follow-up was completed."
      }
    ],
    changesMade: [
      {
        file: "src/feature.ts",
        summary: "Added explicit negative-input handling for the saved review finding."
      }
    ],
    verification: [
      {
        check: "Focused review-fix fixture passes",
        command: "npm test -- tests/code-review-fix-slice.test.ts",
        result: "pass",
        evidence: "The focused review-fix fixture passed after remediation."
      }
    ],
    dependencyPlans: [],
    manualOrDeferredWork: [
      {
        item: "none",
        reason: "none",
        followUp: "none",
        status: "NONE"
      }
    ],
    gapRoutes: [
      {
        gap: "none",
        evidence: "none",
        repair: "none",
        status: "NONE"
      }
    ],
    followUps: ["none"],
    evidence: [
      {
        kind: "review",
        source: ".blueprint/phases/05-review-fix/05-REVIEW.md",
        summary: "Saved review findings supplied the selected remediation targets."
      },
      {
        kind: "plan",
        source: ".blueprint/phases/05-review-fix/05-01-PLAN.md",
        summary: "Saved plan evidence supplied the affected source path."
      },
      {
        kind: "summary",
        source: ".blueprint/phases/05-review-fix/05-01-SUMMARY.md",
        summary: "Completed summary evidence supplied the execution baseline."
      }
    ],
    nextSafeAction: "/blu-validate-phase 5",
    ...overrides
  };
}

async function addPendingReviewFixPlan(repoPath: string, planId = "02"): Promise<void> {
  const phaseDir = path.join(repoPath, ".blueprint/phases/05-review-fix");
  await writeFile(
    path.join(phaseDir, `05-${planId}-PLAN.md`),
    `---
phase: 5
plan_id: "${planId}"
title: "Pending Review Fix Plan"
wave: 1
status: ready
objective: "Leave a pending execution plan for review-fix debt checks."
depends_on: []
requirements: ["REVFIX-01"]
files_modified: ["src/feature.ts"]
read_first: ["src/feature.ts"]
acceptance_criteria:
  - "Pending execution evidence is routed through execute-phase"
autonomous: true
---

# Phase 05: Review Fix - Plan ${planId}

## Goal

Leave a pending execution plan for review-fix debt checks.

## Scope

- Keep pending execution debt visible without blocking review-fix authoring.

## Tasks

### Task 1: Preserve pending debt

#### Read First

- src/feature.ts

#### Action

- Do not write a completed summary for this plan in the fixture.

#### Acceptance Criteria

- Pending execution evidence is routed through execute-phase

## Verification

- /blu-execute-phase 5 should be the next safe repair route for this pending plan.

## Must Haves

- Review-fix authoring remains available while COMPLETED review-fix status is disallowed.
`,
    "utf8"
  );
}

test("code-review-fix docs and catalog metadata promote the review-remediation slice to implemented", async () => {
  const [catalogMarkdown, implementationOrder, commandDoc, runtimeReference] = await Promise.all([
    readFile(path.join(repoRoot, "docs/COMMAND-CATALOG.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/IMPLEMENTATION-ORDER.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/commands/code-review-fix.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  assert.match(
    catalogMarkdown,
    /\| `code-review-fix` \| 4 \| `Quality And Shipping` \| `blueprint-review` \| `implemented` \| `phase XX-REVIEW-FIX\.md; code changes for selected findings; \.blueprint\/STATE\.md` \| `High: selected findings can trigger bounded repo remediation plus review-fix\/state updates\.` \|/
  );
  assert.match(
    implementationOrder,
    /Shipped in this wave: `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `review`, `ui-review`, `docs-update`, `add-tests`, `pr-branch`, `ship`, and `undo`\./
  );
  assert.match(commandDoc, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(commandDoc, /## Shared Runtime Contract/);
  assert.match(commandDoc, /## In-Flight Progress Contract/);
  assert.match(
    commandDoc,
    /resolved scope, selected finding ids, selected-finding mode \(`explicit`, `--all`, or bounded `--auto`\), active stage, pending gate, execution mode, remediation progress, verification progress, deferred findings, artifact status, and next safe action/i
  );
  assert.match(commandDoc, /`update_topic` tool and keep a compact remediation checklist with `write_todos`/);
  assert.match(commandDoc, /auto-fixer behavior/i);
  assert.match(
    runtimeReference,
    /`code-review-fix`[\s\S]*Long-running-mutation profile for bounded review remediation[\s\S]*explicit finding-selection gate[\s\S]*No auto-fixer behavior, implicit commits or branches, or hidden iterative re-review loops are shipped\./i
  );
});

test("blueprint_review_load_findings parses structured findings and severity counts from a saved review artifact", async (t) => {
  const repoPath = await createCodeReviewFixRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const loaded = await blueprintReviewLoadFindings({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review"
  });

  assert.equal(loaded.phaseFound, true);
  assert.equal(loaded.found, true);
  assert.equal(loaded.path, ".blueprint/phases/05-review-fix/05-REVIEW.md");
  assert.equal(loaded.findings.length, 2);
  assert.deepEqual(
    loaded.findings.map((finding) => [finding.id, finding.severity, finding.summary]),
    [
      ["F-01", "high", "Handle negative inputs explicitly in src/feature.ts."],
      ["F-02", "medium", "Add a regression test for negative-input behavior."]
    ]
  );
  assert.deepEqual(loaded.severityCounts, {
    critical: 0,
    high: 1,
    medium: 1,
    low: 0,
    unknown: 0
  });
  assert.deepEqual(loaded.followUps, [
    "Re-run focused validation after the negative-input guard lands."
  ]);
});

test("blueprint_review_record persists model-only review-fix artifacts and load_findings remains compatible", async (t) => {
  const repoPath = await createCodeReviewFixRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const validation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix",
    model: validReviewFixModel()
  });

  assert.equal(validation.status, "valid");
  assert.equal(validation.valid, true);
  assert.match(validation.renderPreview ?? "", /\*\*Status:\*\* COMPLETED/);
  assert.match(validation.renderPreview ?? "", /## Dependency Plans/);

  const recorded = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix",
    model: validReviewFixModel()
  });

  assert.equal(recorded.status, "created");
  assert.equal(recorded.reportPath, ".blueprint/phases/05-review-fix/05-REVIEW-FIX.md");
  assert.deepEqual(recorded.counts, {
    sections: 11,
    findings: 3,
    followUps: 0
  });
  assert.deepEqual(recorded.followUps, []);
  const saved = await readFile(path.join(repoPath, recorded.reportPath), "utf8");
  assert.match(saved, /\*\*Readiness:\*\* ready-for-validation/);
  assert.match(saved, /\*\*Completion State:\*\* complete/);
  assert.match(saved, /`F-01` - Handle negative inputs explicitly/);

  const loaded = await blueprintReviewLoadFindings({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix"
  });

  assert.equal(loaded.phaseFound, true);
  assert.equal(loaded.found, true);
  assert.equal(loaded.path, ".blueprint/phases/05-review-fix/05-REVIEW-FIX.md");
  assert.deepEqual(
    loaded.findings.map((finding) => [finding.id, finding.severity, finding.summary]),
    [
      [
        "F-01",
        "high",
        "Handle negative inputs explicitly in src/feature.ts. Evidence: The source now guards negative inputs before returning a calculated value. Disposition: Focused remediation completed for the saved high-severity finding."
      ],
      [
        "F-02",
        "medium",
        "Add a regression test for negative-input behavior. Evidence: Regression coverage was added for negative-input behavior. Disposition: The selected medium-severity test gap was closed."
      ],
      [
        "FU-01",
        "unknown",
        "Re-run focused validation after the negative-input guard lands. Evidence: Focused validation was rerun after the negative-input guard landed. Disposition: The saved follow-up was completed."
      ]
    ]
  );
  assert.deepEqual(loaded.severityCounts, {
    critical: 0,
    high: 1,
    medium: 1,
    low: 0,
    unknown: 1
  });
  assert.deepEqual(loaded.followUps, []);
});

test("review-fix evidence allows required upstream rows plus extra safe provenance", async (t) => {
  const repoPath = await createCodeReviewFixRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const baseEvidence = validReviewFixModel().evidence as Array<Record<string, unknown>>;
  const model = validReviewFixModel({
    evidence: [
      ...baseEvidence,
      {
        kind: "repo-path",
        source: "src/feature.ts",
        summary: "Changed source file supplied extra remediation provenance."
      },
      {
        kind: "command",
        source: "npm test -- tests/code-review-fix-slice.test.ts",
        summary: "Focused command evidence remained sink-safe in the evidence table."
      }
    ]
  });

  const validation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix",
    model
  });

  assert.equal(
    validation.status,
    "valid",
    validation.diagnostics.map((diagnostic) => diagnostic.message).join("\n")
  );

  const mislabeledUpstreamEvidence = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix",
    model: validReviewFixModel({
      evidence: [
        {
          kind: "command",
          source: ".blueprint/phases/05-review-fix/05-REVIEW.md",
          summary: "Mislabeled source review evidence must not satisfy the upstream review row."
        },
        {
          kind: "other",
          source: ".blueprint/phases/05-review-fix/05-01-PLAN.md",
          summary: "Mislabeled plan evidence must not satisfy the upstream plan row."
        },
        {
          kind: "repo-path",
          source: ".blueprint/phases/05-review-fix/05-01-SUMMARY.md",
          summary: "Mislabeled summary evidence must not satisfy the upstream summary row."
        },
        {
          kind: "summary",
          source: ".blueprint/phases/05-review-fix/05-99-SUMMARY.md",
          summary: "Invented upstream-looking summary evidence must be rejected."
        }
      ]
    })
  });

  assert.equal(mislabeledUpstreamEvidence.status, "invalid");
  assert.ok(
    mislabeledUpstreamEvidence.diagnostics.some((diagnostic) => diagnostic.source === "schema"),
    mislabeledUpstreamEvidence.diagnostics.map((diagnostic) => diagnostic.message).join("\n")
  );

  const recorded = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix",
    model
  });

  assert.equal(recorded.status, "created");
  const saved = await readFile(path.join(repoPath, recorded.reportPath), "utf8");
  assert.match(saved, /src\/feature\.ts/);
  assert.match(saved, /npm test -- tests\/code-review-fix-slice\.test\.ts/);
});

test("review-fix authoring context narrows selected findings, required evidence subset, and empty dependency shape", async (t) => {
  const repoPath = await createCodeReviewFixRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const context = await blueprintReviewAuthoringContext({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix",
    targetIds: ["F-01"]
  });

  assert.equal(context.status, "ready");
  assert.equal(context.modelOnly, true);
  assert.equal(context.schemaPath, "src/mcp/artifact-contracts/schemas/review.review-fix.model.schema.json");
  assert.ok(context.authoringContext);
  const authoringContext = context.authoringContext as {
    selectedTargetIds: string[];
    knownEvidenceArtifacts: string[];
    taskSchema: { properties?: Record<string, Record<string, unknown>> };
  };

  assert.deepEqual(authoringContext.selectedTargetIds, ["F-01"]);
  assert.deepEqual(authoringContext.knownEvidenceArtifacts, [
    ".blueprint/phases/05-review-fix/05-01-PLAN.md",
    ".blueprint/phases/05-review-fix/05-01-SUMMARY.md",
    ".blueprint/phases/05-review-fix/05-REVIEW.md"
  ]);
  assert.deepEqual(authoringContext.taskSchema.properties?.dependencyPlans, {
    type: "array",
    description:
      "Dependency plan rows rendered into the Dependency Plans table. The task schema narrows this to exact live dependency plans, or the exact empty shape when no dependency plans exist.",
    minItems: 0,
    maxItems: 0
  });

  const invalid = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix",
    targetIds: ["F-01"],
    model: validReviewFixModel({
      findingsAddressed: [
        {
          findingId: "F-02",
          status: "fixed",
          evidence: "The wrong saved finding id is intentionally cited.",
          disposition: "This must be rejected by the narrowed task schema."
        }
      ],
      evidence: [
        {
          kind: "review",
          source: ".blueprint/phases/05-review-fix/05-REVIEW.md",
          summary: "Saved review findings supplied the selected remediation target."
        },
        {
          kind: "plan",
          source: ".blueprint/phases/05-review-fix/05-01-PLAN.md",
          summary: "Saved plan evidence supplied the affected source path."
        },
        {
          kind: "summary",
          source: ".blueprint/phases/05-review-fix/05-01-SUMMARY.md",
          summary: "Completed summary evidence supplied the execution baseline."
        }
      ]
    })
  });

  assert.equal(invalid.status, "invalid");
  assert.match(
    invalid.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /constant|valid item/i
  );

  const selectedModel = validReviewFixModel({
    findingsAddressed: [
      {
        findingId: "F-01",
        status: "fixed",
        evidence: "The source now guards negative inputs before returning a calculated value.",
        disposition: "Focused remediation completed for the selected saved finding."
      }
    ]
  });
  const selectedValidation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix",
    targetIds: ["F-01"],
    model: selectedModel
  });

  assert.equal(
    selectedValidation.status,
    "valid",
    selectedValidation.diagnostics.map((diagnostic) => diagnostic.message).join("\n")
  );
  const selectedRecord = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix",
    targetIds: ["F-01"],
    model: selectedModel
  });

  assert.equal(selectedRecord.status, "created");
  const selectedLoaded = await blueprintReviewLoadFindings({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix"
  });

  assert.deepEqual(selectedLoaded.findings.map((finding) => finding.id), ["F-01"]);
});

test("review-fix authoring blocks when required upstream context is missing", async (t) => {
  const repoPath = await createCodeReviewFixRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await rm(path.join(repoPath, ".blueprint/phases/05-review-fix/05-REVIEW.md"));

  const context = await blueprintReviewAuthoringContext({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix"
  });

  assert.equal(context.status, "invalid");
  assert.match(context.reason ?? "", /does not have a saved -REVIEW\.md artifact/i);

  const validation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix",
    model: validReviewFixModel()
  });

  assert.equal(validation.status, "invalid");
  assert.equal(validation.diagnostics[0]?.source, "scope");
});

test("review-fix pending execution debt keeps authoring ready and blocks completed status", async (t) => {
  const repoPath = await createCodeReviewFixRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await addPendingReviewFixPlan(repoPath);

  const context = await blueprintReviewAuthoringContext({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix"
  });

  assert.equal(context.status, "ready");
  assert.ok(context.authoringContext);
  const authoringContext = context.authoringContext as {
    allowCompleted: boolean;
    blockedNextSafeActions: string[];
    blockedRequiredNextSafeAction: string | null;
    executionDebt: {
      pendingPlans: string[];
      blockers: string[];
    };
    knownEvidenceArtifacts: string[];
    taskSchema: { properties?: Record<string, Record<string, unknown>> };
  };

  assert.equal(authoringContext.allowCompleted, false);
  assert.deepEqual(authoringContext.executionDebt.pendingPlans, ["02"]);
  assert.match(authoringContext.executionDebt.blockers.join("\n"), /pending execution plans: 02/);
  assert.ok(authoringContext.blockedNextSafeActions.includes("/blu-execute-phase 5"));
  assert.equal(authoringContext.blockedRequiredNextSafeAction, "/blu-execute-phase 5");
  assert.deepEqual(authoringContext.taskSchema.properties?.status.enum, ["PARTIAL", "BLOCKED"]);

  const requiredEvidence = [
    {
      kind: "review",
      source: ".blueprint/phases/05-review-fix/05-REVIEW.md",
      summary: "Saved review findings supplied the selected remediation targets."
    },
    {
      kind: "plan",
      source: ".blueprint/phases/05-review-fix/05-01-PLAN.md",
      summary: "Completed plan evidence supplied the original execution baseline."
    },
    {
      kind: "summary",
      source: ".blueprint/phases/05-review-fix/05-01-SUMMARY.md",
      summary: "Completed summary evidence supplied the execution baseline."
    },
    {
      kind: "plan",
      source: ".blueprint/phases/05-review-fix/05-02-PLAN.md",
      summary: "Pending plan evidence forces a follow-up execute-phase route."
    }
  ];
  assert.deepEqual(
    authoringContext.knownEvidenceArtifacts,
    requiredEvidence.map((row) => row.source).sort()
  );

  const invalidCompleted = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix",
    model: validReviewFixModel({
      evidence: requiredEvidence
    })
  });

  assert.equal(invalidCompleted.status, "invalid");
  assert.ok(
    invalidCompleted.diagnostics.some((diagnostic) =>
      diagnostic.source === "schema" && diagnostic.path === "model.status"
    )
  );

  const blockedModel = validReviewFixModel({
    status: "BLOCKED",
    readiness: "blocked",
    completionState: "blocked",
    findingsAddressed: [
      {
        findingId: "F-01",
        status: "deferred",
        evidence: "Pending plan 02 must complete before this saved finding can be closed.",
        disposition: "Carry the selected implementation finding through execute-phase."
      },
      {
        findingId: "F-02",
        status: "deferred",
        evidence: "Pending plan 02 must complete before test coverage can be declared closed.",
        disposition: "Carry the selected regression finding through execute-phase."
      },
      {
        findingId: "FU-01",
        status: "skipped",
        evidence: "Focused validation waits on pending plan 02 execution evidence.",
        disposition: "Re-run validation after execute-phase completes the pending plan."
      }
    ],
    changesMade: [
      {
        file: "none",
        summary: "none"
      }
    ],
    verification: [
      {
        check: "Pending plan 02 execution evidence exists",
        command: "/blu-execute-phase 5",
        result: "blocked",
        evidence: "Plan 02 has not produced a completed summary yet."
      }
    ],
    manualOrDeferredWork: [
      {
        item: "Complete pending execution plan 02",
        reason: "Review-fix completion cannot be truthful until pending execution evidence exists.",
        followUp: "/blu-execute-phase 5",
        status: "DEFERRED"
      }
    ],
    gapRoutes: [
      {
        gap: "Pending plan 02 execution summary",
        evidence: "The live plan inventory includes 05-02-PLAN.md without a completed summary.",
        repair: "Run /blu-execute-phase 5 to produce the missing execution evidence.",
        status: "BLOCKED"
      }
    ],
    followUps: ["Run /blu-execute-phase 5 to close pending execution debt."],
    evidence: [
      ...requiredEvidence,
      {
        kind: "command",
        source: "/blu-execute-phase 5",
        summary: "Execution repair command is the required blocked route."
      }
    ],
    nextSafeAction: "/blu-execute-phase 5"
  });

  const blockedValidation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix",
    model: blockedModel
  });

  assert.equal(
    blockedValidation.status,
    "valid",
    blockedValidation.diagnostics.map((diagnostic) => diagnostic.message).join("\n")
  );

  const recorded = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix",
    model: blockedModel
  });

  assert.equal(recorded.status, "created");
});

test("review-fix writer rejects markdown fallback for model-only persistence", async (t) => {
  const repoPath = await createCodeReviewFixRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const rejected = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix",
    content: "# Phase 05: Review Fix - Review Fix\n"
  });

  assert.equal(rejected.status, "invalid");
  assert.equal(rejected.written, false);
  assert.match(rejected.warnings.join("\n"), /review\.review-fix is model-only; content is invalid/i);
});

test("review-fix schema rejects unsupported fields, missing required fields, and unsafe table delimiters", async (t) => {
  const repoPath = await createCodeReviewFixRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const model = validReviewFixModel({
    unsupportedField: "must be rejected",
    changesMade: [
      {
        file: "src/feature.ts",
        summary: "Injected | delimiter must stay out of table cells."
      }
    ]
  });
  delete model.evidence;

  const invalid = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix",
    model
  });

  assert.equal(invalid.status, "invalid");
  assert.ok(invalid.diagnostics.some((diagnostic) => diagnostic.code === "schema.additionalProperties"));
  assert.ok(invalid.diagnostics.some((diagnostic) => diagnostic.code === "schema.required"));
  assert.ok(invalid.diagnostics.some((diagnostic) => diagnostic.code === "schema.pattern"));
});

test("review-fix truth table rejects completed models with active gaps and accepts partial follow-up shape", async (t) => {
  const repoPath = await createCodeReviewFixRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalidCompleted = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix",
    model: validReviewFixModel({
      gapRoutes: [
        {
          gap: "Focused regression still fails",
          evidence: "npm test reported a failing assertion",
          repair: "Fix the regression before validation",
          status: "OPEN"
        }
      ]
    })
  });

  assert.equal(invalidCompleted.status, "invalid");
  assert.ok(invalidCompleted.diagnostics.some((diagnostic) => diagnostic.source === "schema"));

  const partial = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix",
    model: validReviewFixModel({
      status: "PARTIAL",
      readiness: "not-ready-for-validation",
      completionState: "pending",
      findingsAddressed: [
        {
          findingId: "F-01",
          status: "fixed",
          evidence: "The implementation finding was fixed.",
          disposition: "Code remediation completed but tests still need follow-up."
        },
        {
          findingId: "F-02",
          status: "deferred",
          evidence: "Regression test coverage is not complete yet.",
          disposition: "Route to add-tests after this partial review-fix artifact."
        },
        {
          findingId: "FU-01",
          status: "deferred",
          evidence: "Focused validation waits on the missing regression test.",
          disposition: "Carry forward the saved follow-up."
        }
      ],
      verification: [
        {
          check: "Focused review-fix fixture passes",
          command: "npm test -- tests/code-review-fix-slice.test.ts",
          result: "not-run",
          evidence: "The test gap must be closed before validation can pass."
        }
      ],
      manualOrDeferredWork: [
        {
          item: "Negative-input regression coverage",
          reason: "The current pass only applied the implementation guard.",
          followUp: "/blu-add-tests 5",
          status: "DEFERRED"
        }
      ],
      gapRoutes: [
        {
          gap: "Missing regression coverage",
          evidence: "Saved review finding F-02 remains deferred.",
          repair: "Run /blu-add-tests 5 to add focused coverage.",
          status: "OPEN"
        }
      ],
      followUps: ["Add the missing negative-input regression coverage."],
      nextSafeAction: "/blu-add-tests 5"
    })
  });

  assert.equal(partial.status, "valid");
});

test("review-fix blocked status can carry real changed file rows", async (t) => {
  const repoPath = await createCodeReviewFixRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const blocked = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix",
    model: validReviewFixModel({
      status: "BLOCKED",
      readiness: "blocked",
      completionState: "blocked",
      findingsAddressed: [
        {
          findingId: "F-01",
          status: "deferred",
          evidence: "The source guard was started but cannot be closed until validation is unblocked.",
          disposition: "Keep the selected implementation finding open."
        },
        {
          findingId: "F-02",
          status: "deferred",
          evidence: "Regression coverage still waits on the blocked validation path.",
          disposition: "Keep the selected test finding open."
        },
        {
          findingId: "FU-01",
          status: "skipped",
          evidence: "Focused validation could not be rerun while the blocker remains.",
          disposition: "Carry the saved follow-up forward."
        }
      ],
      changesMade: [
        {
          file: "src/feature.ts",
          summary: "Started the negative-input guard before validation became blocked."
        }
      ],
      verification: [
        {
          check: "Focused review-fix fixture passes",
          command: "npm test -- tests/code-review-fix-slice.test.ts",
          result: "blocked",
          evidence: "Validation could not complete because the focused fixture is blocked."
        }
      ],
      manualOrDeferredWork: [
        {
          item: "Complete blocked validation",
          reason: "The source changed but verification has not completed.",
          followUp: "/blu-progress",
          status: "DEFERRED"
        }
      ],
      gapRoutes: [
        {
          gap: "Blocked validation for changed source",
          evidence: "src/feature.ts has a started remediation but no passing validation yet.",
          repair: "Resolve the validation blocker before marking review-fix completed.",
          status: "BLOCKED"
        }
      ],
      followUps: ["Resolve the blocked validation path for src/feature.ts."],
      nextSafeAction: "/blu-progress"
    })
  });

  assert.equal(
    blocked.status,
    "valid",
    blocked.diagnostics.map((diagnostic) => diagnostic.message).join("\n")
  );
});

test("review-fix validation rejects stale upstream evidence inventory", async (t) => {
  const repoPath = await createCodeReviewFixRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeFile(
    path.join(repoPath, ".blueprint/phases/05-review-fix/05-02-PLAN.md"),
    `---
phase: 5
plan_id: "02"
title: "Second Review Fix Plan"
wave: 1
status: ready
objective: "Add a second completed summary to change live evidence inventory."
depends_on: []
requirements: ["REVFIX-01"]
files_modified: ["src/feature.ts"]
read_first: ["src/feature.ts"]
acceptance_criteria:
  - "Second focused fixture exits 0"
autonomous: true
---

# Phase 05: Review Fix - Plan 02

## Goal

Add a second completed summary to change live evidence inventory.

## Scope

- Add a second completed plan and summary for stale evidence checks.

## Tasks

### Task 1: Add second evidence

#### Read First

- src/feature.ts

#### Action

- Keep a second completed evidence row available to review-fix validation.

#### Acceptance Criteria

- Second focused fixture exits 0

## Verification

- npm test -- tests/code-review-fix-slice.test.ts exits 0

## Must Haves

- Review-fix validation must reject stale evidence that omits the second plan and summary.
`,
    "utf8"
  );
  const secondSummaryWrite = await blueprintPhaseSummaryWrite({
    cwd: repoPath,
    phase: "5",
    planId: "02",
    model: {
      status: "COMPLETED",
      readiness: "ready-for-validation",
      completionState: "complete",
      outcome: ["Second completed summary updates the live review-fix evidence inventory."],
      changesMade: ["Confirmed stale evidence rejection."],
      targetedVerification: [
        {
          check: "Second focused fixture exits 0",
          command: "npm test -- tests/code-review-fix-slice.test.ts",
          result: "pass",
          evidence: "Second summary passed.",
          notes: "Stale model must include this."
        }
      ],
      dependencyPlans: [],
      manualOrDeferredWork: [
        {
          item: "none",
          reason: "none",
          followUp: "none",
          status: "NONE"
        }
      ],
      gapRoutes: [
        {
          gap: "none",
          evidence: "none",
          repair: "none",
          status: "NONE"
        }
      ],
      followUps: ["none"],
      evidence: [
        {
          kind: "artifact",
          source: ".blueprint/phases/05-review-fix/05-02-SUMMARY.md",
          summary: "Saved summary artifact."
        }
      ],
      nextSafeAction: "/blu-validate-phase 5"
    }
  });
  assert.notEqual(secondSummaryWrite.status, "invalid", secondSummaryWrite.issues.join("\n"));

  const stale = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    artifact: "review-fix",
    model: validReviewFixModel()
  });

  assert.equal(stale.status, "invalid");
  assert.match(JSON.stringify(stale.taskSchema), /05-02-PLAN\.md/);
  assert.match(JSON.stringify(stale.taskSchema), /05-02-SUMMARY\.md/);
});

test("code-review-fix is exposed as an implemented remediation command with the findings tool", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["code-review-fix"];

  assert.ok(blueprintToolNames.includes("blueprint_review_load_findings"));
  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.manifestPath, "commands/blu-code-review-fix.toml");
  assert.deepEqual(entry.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_review_load_findings",
    "blueprint_review_authoring_context",
    "blueprint_review_validate_model",
    "blueprint_review_record",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-reviewer"]);
});
