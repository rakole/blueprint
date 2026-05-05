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
const peerReviewPlanPath = ".blueprint/phases/03-review-phase/03-01-PLAN.md";
const peerReviewPath = ".blueprint/phases/03-review-phase/03-REVIEWS.md";

function peerReviewEvidenceCoverage(
  extra: Record<string, { status: string; rationale: string }> = {}
): Record<string, { status: string; rationale: string }> {
  return {
    ".blueprint/REQUIREMENTS.md": {
      status: "used",
      rationale: "The saved requirements defined the peer-review acceptance target."
    },
    ".blueprint/ROADMAP.md": {
      status: "used",
      rationale: "The saved roadmap supplied the phase goal and current rollout context."
    },
    [peerReviewPlanPath]: {
      status: "used",
      rationale: "The saved phase plan was the peer-review source of truth."
    },
    ...extra
  };
}

async function createPeerReviewRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-peer-review-");
  const phaseDir = path.join(repoPath, ".blueprint/phases/03-review-phase");

  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Peer Review Fixture

## Milestone

- Active milestone: v2

## Phases

- [ ] **Phase 3: Review Phase** - Finalize the saved plan set before execution

## Phase Details

### Phase 3: Review Phase
**Goal**: Collect cross-CLI peer review of the saved phase plans.
**Requirements**: REV-01
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v2
- Current phase: 3
- Active command: /blu-plan-phase
- Next action: Run /blu-review 3
- Last updated: 2026-04-13T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");
  await writeFile(
    path.join(phaseDir, "03-01-PLAN.md"),
    `---
phase: 3
plan_id: "01"
title: "Peer Review Plan"
wave: 1
status: planned
objective: "Finalize the saved plan set before execution."
depends_on: []
requirements: ["REV-01"]
files_modified: ["src/mcp/tools/project.ts"]
read_first: ["docs/commands/plan-phase.md"]
acceptance_criteria: ["npm test -- tests/review-slice.test.ts exits 0"]
autonomous: true
---

# Phase 03: Review Phase - Plan 01

## Goal

Capture cross-CLI peer review for the saved plan.

## Scope

- Update peer-review MCP persistence and metadata tests.

## Tasks

### Task 1: Persist peer review

#### Read First

- docs/commands/review.md

#### Action

- Keep peer review evidence MCP-owned.

#### Acceptance Criteria

- npm test -- tests/review-slice.test.ts exits 0

## Verification

- npm test -- tests/review-slice.test.ts

## Must Haves

- Peer review persistence remains phase-scoped.

## Requirement Coverage

| Requirement | Status | Covered By Tasks | Evidence | Rationale |
|-------------|--------|------------------|----------|-----------|
| REV-01 | covered | task-1 | tests/review-slice.test.ts | Peer review persistence is exercised by the focused review slice. |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| docs/commands/review.md | used | The command spec defines the peer review persistence route. |

## File / Surface Coverage

| Surface | Covered By Tasks | Verification | Rationale |
|---------|------------------|--------------|-----------|
| src/mcp/tools/project.ts | task-1 | npm test -- tests/review-slice.test.ts | The focused test covers the peer-review routing surface. |

## Unknowns And Deferrals

| Item | Disposition | Rationale | Follow-Up |
|------|-------------|-----------|-----------|
| No open unknowns for the peer review fixture. | none | The fixture only seeds saved review evidence. | No follow-up required after the focused test passes. |
`,
    "utf8"
  );

  return repoPath;
}

function validPeerReviewModel(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: "COMPLETED",
    readiness: "ready-for-routing",
    completionState: "complete",
    reviewSummary: [
      "Codex reviewed the saved plan and found the peer-review packet ready for execution."
    ],
    reviewerCoverage: [
      {
        reviewer: "codex",
        status: "completed",
        summary: "Saved plan evidence was reviewed with no blocking concerns."
      }
    ],
    planReviews: [
      {
        planId: "01",
        path: peerReviewPlanPath,
        goalFit: "achieves-goal",
        summary: "The saved plan has a clear objective and acceptance criterion."
      }
    ],
    findings: [
      {
        severity: "unknown",
        source: "none",
        evidence: "none",
        recommendation: "none",
        status: "NONE"
      }
    ],
    consensus: [
      "The available reviewer found the saved plan ready for execution."
    ],
    disagreements: ["none"],
    riskAssessment: {
      level: "LOW",
      summary: "No peer-review blockers remain for the saved plan."
    },
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
    evidenceCoverage: peerReviewEvidenceCoverage(),
    nextSafeAction: "/blu-execute-phase 3",
    ...patch
  };
}

test("review docs and catalog metadata promote the peer-review slice to implemented", async () => {
  const [catalogMarkdown, implementationOrder, commandDoc, runtimeReference] = await Promise.all([
    readFile(path.join(repoRoot, "docs/COMMAND-CATALOG.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/IMPLEMENTATION-ORDER.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/commands/review.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  assert.match(
    catalogMarkdown,
    /\| `review` \| 4 \| `Quality And Shipping` \| `blueprint-review` \| `implemented` \| `phase XX-REVIEWS\.md` \| `Medium: external reviewer orchestration without default repo mutation\.` \|/
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
    /requested reviewer set, reviewer availability, disagreement posture, pending gate, execution mode, artifact status, and next safe action/i
  );
  assert.match(commandDoc, /`update_topic` tool and keep a compact peer-review checklist with `write_todos`/i);
  assert.match(commandDoc, /`reviewer-availability`/i);
  assert.match(commandDoc, /next-step guidance stays on `\/blu-review <phase>`/i);
  assert.match(
    runtimeReference,
    /`review`[\s\S]*Long-running-mutation profile for phase-plan peer review/i
  );
  assert.match(
    runtimeReference,
    /`review`[\s\S]*`update_topic` and `write_todos` for non-trivial review runs/i
  );
  assert.match(
    runtimeReference,
    /`review`[\s\S]*reviewer availability, partial reviewer coverage, disagreement posture, and artifact reuse or revision status explicit/i
  );
  assert.match(
    runtimeReference,
    /`review`[\s\S]*`reviewer-availability` waiting state/i
  );
});

test("peer-review model validates and records a phase-scoped artifact with MCP-owned provenance", async (t) => {
  const repoPath = await createPeerReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const context = await blueprintReviewAuthoringContext({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review"
  });
  const validation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review",
    model: validPeerReviewModel()
  });

  const written = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review",
    model: validPeerReviewModel()
  });
  const peerReviewContext = context.authoringContext as {
    knownEvidenceArtifacts: string[];
    completedNextSafeActions: string[];
  };

  assert.equal(context.status, "ready");
  assert.equal(context.schemaPath, "src/mcp/artifact-contracts/schemas/review.peer-review.model.schema.json");
  assert.match(JSON.stringify(context.taskSchema), /03-01-PLAN\.md/);
  assert.deepEqual(peerReviewContext.completedNextSafeActions, ["/blu-execute-phase 3"]);
  assert.ok(peerReviewContext.knownEvidenceArtifacts.includes(".blueprint/ROADMAP.md"));
  assert.ok(peerReviewContext.knownEvidenceArtifacts.includes(".blueprint/REQUIREMENTS.md"));
  assert.equal(validation.status, "valid");
  assert.match(validation.renderPreview ?? "", /\*\*Status:\*\* COMPLETED/);
  assert.match(validation.renderPreview ?? "", /03-01-PLAN\.md/);
  assert.equal(written.status, "created");
  assert.equal(written.reportPath, ".blueprint/phases/03-review-phase/03-REVIEWS.md");
  assert.equal(written.counts.findings, 0);
  assert.equal(written.counts.followUps, 0);
  assert.deepEqual(written.followUps, []);

  const saved = await readFile(path.join(repoPath, written.reportPath), "utf8");
  assert.match(saved, /\*\*Reviewers:\*\* codex/);
  assert.match(saved, /\| 01 \(\.blueprint\/phases\/03-review-phase\/03-01-PLAN\.md\) \| achieves-goal \|/);
  assert.match(saved, /\| \.blueprint\/ROADMAP\.md \| used \|/);

  const replacementContext = await blueprintReviewAuthoringContext({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review"
  });
  const replacementPeerReviewContext = replacementContext.authoringContext as {
    knownEvidenceArtifacts: string[];
  };
  assert.ok(replacementPeerReviewContext.knownEvidenceArtifacts.includes(peerReviewPath));

  await assert.rejects(
    () =>
      blueprintReviewRecord({
        cwd: repoPath,
        phase: "3",
        artifact: "peer-review",
        model: validPeerReviewModel({
          reviewSummary: [
            "Codex reviewed the saved plan and found a slightly different peer-review result."
          ],
          evidenceCoverage: peerReviewEvidenceCoverage({
            [peerReviewPath]: {
              status: "used",
              rationale: "The existing peer-review report was reviewed as the overwrite baseline."
            }
          })
        })
      }),
    /explicit overwrite confirmation/
  );

  const markdownRejected = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review",
    content: saved,
    overwrite: true
  });
  assert.equal(markdownRejected.status, "invalid");
  assert.match(markdownRejected.warnings.join("\n"), /model-only|content is invalid/i);

  const artifactList = await blueprintArtifactList({ cwd: repoPath });
  assert.ok(
    artifactList.artifacts.phases.includes(".blueprint/phases/03-review-phase/03-REVIEWS.md")
  );
});

test("peer-review schema rejects unsupported, missing, unsafe, and out-of-scope model data", async (t) => {
  const repoPath = await createPeerReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const unsupported = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review",
    model: validPeerReviewModel({ reportPath: ".blueprint/phases/03-review-phase/03-REVIEWS.md" })
  });
  const missingModel = validPeerReviewModel();
  delete missingModel.evidenceCoverage;
  const missingRepoEvidenceModel = validPeerReviewModel();
  delete (
    missingRepoEvidenceModel.evidenceCoverage as Record<string, unknown>
  )[".blueprint/ROADMAP.md"];
  const missing = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review",
    model: missingModel
  });
  const missingRepoEvidence = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review",
    model: missingRepoEvidenceModel
  });
  const injected = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review",
    model: validPeerReviewModel({
      reviewerCoverage: [
        {
          reviewer: "codex",
          status: "completed",
          summary: "Reviewed successfully.\n## Injected"
        }
      ]
    })
  });
  const outOfScope = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review",
    model: validPeerReviewModel({
      planReviews: [
        {
          planId: "99",
          path: ".blueprint/phases/03-review-phase/03-99-PLAN.md",
          goalFit: "achieves-goal",
          summary: "Invented plan row."
        }
      ]
    })
  });
  const completedCodeReviewRoute = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review",
    model: validPeerReviewModel({
      nextSafeAction: "/blu-code-review 3"
    })
  });
  const completedProgressRoute = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review",
    model: validPeerReviewModel({
      nextSafeAction: "/blu-progress"
    })
  });

  assert.equal(unsupported.status, "invalid");
  assert.match(
    unsupported.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /additional properties|identity field reportPath/i
  );
  assert.equal(missing.status, "invalid");
  assert.match(
    missing.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must have required property 'evidenceCoverage'/i
  );
  assert.equal(missingRepoEvidence.status, "invalid");
  assert.match(
    missingRepoEvidence.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /\.blueprint\/ROADMAP\.md/i
  );
  assert.equal(injected.status, "invalid");
  assert.match(
    injected.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must match pattern/i
  );
  assert.equal(outOfScope.status, "invalid");
  assert.match(
    outOfScope.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /allowed values|must contain at least 1 and no more than 1 valid item/i
  );
  assert.equal(completedCodeReviewRoute.status, "invalid");
  assert.match(
    completedCodeReviewRoute.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /allowed values/i
  );
  assert.equal(completedProgressRoute.status, "invalid");
  assert.match(
    completedProgressRoute.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /allowed values/i
  );
});

test("peer-review authoring blocks missing upstream plan context and stale evidence inventory", async (t) => {
  const repoPath = await createPeerReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await rm(path.join(repoPath, ".blueprint/phases/03-review-phase/03-01-PLAN.md"));

  const context = await blueprintReviewAuthoringContext({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review"
  });
  const validation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review",
    model: validPeerReviewModel()
  });

  assert.equal(context.status, "invalid");
  assert.equal(context.taskSchema, null);
  assert.match(context.reason ?? "", /no saved plan artifacts/i);
  assert.equal(validation.status, "invalid");
  assert.match(
    validation.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /no saved plan artifacts/i
  );
});

test("peer-review lifecycle truth table keeps partial and blocked states resumable", async (t) => {
  const repoPath = await createPeerReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const partial = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review",
    model: validPeerReviewModel({
      status: "PARTIAL",
      readiness: "not-ready-for-routing",
      completionState: "pending",
      reviewerCoverage: [
        {
          reviewer: "codex",
          status: "completed",
          summary: "Plan review completed with a follow-up concern."
        }
      ],
      planReviews: [
        {
          planId: "01",
          path: ".blueprint/phases/03-review-phase/03-01-PLAN.md",
          goalFit: "needs-revision",
          summary: "The plan needs a reviewer availability note."
        }
      ],
      findings: [
        {
          severity: "medium",
          source: "03-01-PLAN.md",
          evidence: "Reviewer availability fallback is not explicit.",
          recommendation: "Add the fallback before execution.",
          status: "OPEN"
        }
      ],
      manualOrDeferredWork: [
        {
          item: "Reviewer fallback note",
          reason: "The plan does not say what happens when a requested reviewer is unavailable.",
          followUp: "/blu-plan-phase 3",
          status: "DEFERRED"
        }
      ],
      gapRoutes: [
        {
          gap: "Reviewer availability fallback missing",
          evidence: "Peer-review concern remains open.",
          repair: "Revise the saved plan and rerun review.",
          status: "OPEN"
        }
      ],
      followUps: ["Revise the saved plan with reviewer availability fallback."],
      nextSafeAction: "/blu-plan-phase 3"
    })
  });
  const blocked = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review",
    model: validPeerReviewModel({
      status: "BLOCKED",
      readiness: "blocked",
      completionState: "blocked",
      reviewerCoverage: [
        {
          reviewer: "codex",
          status: "failed",
          summary: "The requested reviewer launched but returned no usable output."
        },
        {
          reviewer: "claude",
          status: "unavailable",
          summary: "The requested reviewer was not authenticated in this environment."
        }
      ],
      planReviews: [
        {
          planId: "01",
          path: ".blueprint/phases/03-review-phase/03-01-PLAN.md",
          goalFit: "blocked",
          summary: "Plan review is blocked on reviewer availability."
        }
      ],
      findings: [
        {
          severity: "unknown",
          source: "reviewer-availability",
          evidence: "No requested reviewer completed.",
          recommendation: "Authenticate or choose an available reviewer.",
          status: "BLOCKED"
        }
      ],
      manualOrDeferredWork: [
        {
          item: "Reviewer availability",
          reason: "No requested reviewer completed.",
          followUp: "/blu-review 3",
          status: "MANUAL"
        }
      ],
      gapRoutes: [
        {
          gap: "Reviewer coverage unavailable",
          evidence: "No reviewer output exists.",
          repair: "Authenticate a reviewer and retry.",
          status: "BLOCKED"
        }
      ],
      followUps: ["Authenticate or select an available reviewer."],
      nextSafeAction: "/blu-review 3"
    })
  });
  const mixedSentinel = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review",
    model: validPeerReviewModel({
      status: "PARTIAL",
      readiness: "not-ready-for-routing",
      completionState: "pending",
      reviewerCoverage: [
        {
          reviewer: "codex",
          status: "completed",
          summary: "Plan review completed with a follow-up concern."
        }
      ],
      planReviews: [
        {
          planId: "01",
          path: ".blueprint/phases/03-review-phase/03-01-PLAN.md",
          goalFit: "needs-revision",
          summary: "The plan needs a reviewer availability note."
        }
      ],
      findings: [
        {
          severity: "unknown",
          source: "none",
          evidence: "none",
          recommendation: "none",
          status: "NONE"
        },
        {
          severity: "medium",
          source: "03-01-PLAN.md",
          evidence: "Reviewer availability fallback is not explicit.",
          recommendation: "Add the fallback before execution.",
          status: "OPEN"
        }
      ],
      manualOrDeferredWork: [
        {
          item: "none",
          reason: "none",
          followUp: "none",
          status: "NONE"
        },
        {
          item: "Reviewer fallback note",
          reason: "The plan does not say what happens when a requested reviewer is unavailable.",
          followUp: "/blu-plan-phase 3",
          status: "DEFERRED"
        }
      ],
      gapRoutes: [
        {
          gap: "none",
          evidence: "none",
          repair: "none",
          status: "NONE"
        },
        {
          gap: "Reviewer availability fallback missing",
          evidence: "Peer-review concern remains open.",
          repair: "Revise the saved plan and rerun review.",
          status: "OPEN"
        }
      ],
      followUps: ["none", "Revise the saved plan with reviewer availability fallback."],
      nextSafeAction: "/blu-plan-phase 3"
    })
  });
  const contradictory = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review",
    model: validPeerReviewModel({
      status: "PARTIAL",
      readiness: "ready-for-routing",
      completionState: "complete",
      nextSafeAction: "/blu-execute-phase 3"
    })
  });
  const partialUnavailableOnly = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review",
    model: validPeerReviewModel({
      status: "PARTIAL",
      readiness: "not-ready-for-routing",
      completionState: "pending",
      reviewerCoverage: [
        {
          reviewer: "claude",
          status: "unavailable",
          summary: "The requested reviewer was unavailable."
        }
      ],
      planReviews: [
        {
          planId: "01",
          path: peerReviewPlanPath,
          goalFit: "needs-revision",
          summary: "The plan cannot proceed until at least one reviewer completes."
        }
      ],
      findings: [
        {
          severity: "medium",
          source: "reviewer-availability",
          evidence: "No requested reviewer completed.",
          recommendation: "Authenticate or select an available reviewer.",
          status: "OPEN"
        }
      ],
      manualOrDeferredWork: [
        {
          item: "Reviewer availability",
          reason: "No requested reviewer completed.",
          followUp: "/blu-review 3",
          status: "MANUAL"
        }
      ],
      gapRoutes: [
        {
          gap: "Reviewer coverage unavailable",
          evidence: "No completed reviewer row exists.",
          repair: "Authenticate a reviewer and retry.",
          status: "OPEN"
        }
      ],
      followUps: ["Authenticate or select an available reviewer."],
      nextSafeAction: "/blu-review 3"
    })
  });
  const blockedWithCompleted = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review",
    model: validPeerReviewModel({
      status: "BLOCKED",
      readiness: "blocked",
      completionState: "blocked",
      reviewerCoverage: [
        {
          reviewer: "codex",
          status: "completed",
          summary: "This completed reviewer row contradicts the blocked truth table."
        },
        {
          reviewer: "claude",
          status: "unavailable",
          summary: "The requested reviewer was unavailable."
        }
      ],
      planReviews: [
        {
          planId: "01",
          path: peerReviewPlanPath,
          goalFit: "blocked",
          summary: "Plan review is blocked on reviewer availability."
        }
      ],
      findings: [
        {
          severity: "unknown",
          source: "reviewer-availability",
          evidence: "Reviewer coverage is contradictory.",
          recommendation: "Retry without mixing completed rows into BLOCKED state.",
          status: "BLOCKED"
        }
      ],
      manualOrDeferredWork: [
        {
          item: "Reviewer availability",
          reason: "Reviewer coverage is contradictory.",
          followUp: "/blu-review 3",
          status: "MANUAL"
        }
      ],
      gapRoutes: [
        {
          gap: "Contradictory reviewer state",
          evidence: "BLOCKED includes a completed reviewer.",
          repair: "Use PARTIAL for partial fan-out or remove completed rows.",
          status: "BLOCKED"
        }
      ],
      followUps: ["Retry peer review with a consistent reviewer state."],
      nextSafeAction: "/blu-review 3"
    })
  });

  assert.equal(partial.status, "valid");
  assert.equal(blocked.status, "valid");
  assert.match(blocked.renderPreview ?? "", /\*\*Reviewers:\*\* none/);
  const reviewerCoverageSection =
    (blocked.renderPreview ?? "").match(/## Reviewer Coverage\n\n([\s\S]*?)\n\n## Reviewer Results/)?.[1] ?? "";
  const reviewerResultsSection =
    (blocked.renderPreview ?? "").match(/## Reviewer Results\n\n([\s\S]*?)\n\n## Plan Reviews/)?.[1] ?? "";
  assert.match(reviewerCoverageSection, /codex/);
  assert.match(reviewerCoverageSection, /claude/);
  assert.match(reviewerResultsSection, /none/);
  assert.doesNotMatch(reviewerResultsSection, /codex|claude/);
  assert.equal(mixedSentinel.status, "invalid");
  assert.match(
    mixedSentinel.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must NOT be valid|must be equal to constant/i
  );
  assert.equal(contradictory.status, "invalid");
  assert.match(
    contradictory.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must be equal to constant|must be equal to one of the allowed values/i
  );
  assert.equal(partialUnavailableOnly.status, "invalid");
  assert.match(
    partialUnavailableOnly.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must contain at least 1 valid item|must match "then" schema/i
  );
  assert.equal(blockedWithCompleted.status, "invalid");
  assert.match(
    blockedWithCompleted.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must NOT be valid|must match "then" schema/i
  );
});

test("peer-review finding tables round-trip through record counts and load findings", async (t) => {
  const repoPath = await createPeerReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const model = validPeerReviewModel({
    status: "PARTIAL",
    readiness: "not-ready-for-routing",
    completionState: "pending",
    reviewerCoverage: [
      {
        reviewer: "codex",
        status: "completed",
        summary: "Plan review completed with one open plan concern."
      }
    ],
    planReviews: [
      {
        planId: "01",
        path: peerReviewPlanPath,
        goalFit: "needs-revision",
        summary: "The plan needs explicit reviewer fallback handling."
      }
    ],
    findings: [
      {
        severity: "medium",
        source: "03-01-PLAN.md",
        evidence: "Reviewer fallback behavior is not specified.",
        recommendation: "Add reviewer fallback handling before execution.",
        status: "OPEN"
      }
    ],
    manualOrDeferredWork: [
      {
        item: "Reviewer fallback",
        reason: "The saved plan omits reviewer fallback handling.",
        followUp: "/blu-plan-phase 3",
        status: "DEFERRED"
      }
    ],
    gapRoutes: [
      {
        gap: "Reviewer fallback missing",
        evidence: "Peer-review finding remains open.",
        repair: "Revise the saved plan and rerun review.",
        status: "OPEN"
      }
    ],
    followUps: ["Revise the saved plan with reviewer fallback handling."],
    nextSafeAction: "/blu-plan-phase 3"
  });
  const written = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review",
    model
  });
  const loaded = await blueprintReviewLoadFindings({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review"
  });

  assert.equal(written.status, "created");
  assert.equal(written.counts.findings, 1);
  assert.equal(loaded.found, true);
  assert.equal(loaded.findings.length, 1);
  assert.equal(loaded.severityCounts.medium, 1);
  assert.match(loaded.findings[0]?.summary ?? "", /Reviewer fallback behavior is not specified/);
});

test("review is exposed as an implemented peer-review command with the registered review tool", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["review"];

  assert.ok(blueprintToolNames.includes("blueprint_review_record"));
  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.manifestPath, "commands/blu-review.toml");
  assert.deepEqual(entry.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_artifact_list",
    "blueprint_artifact_contract_read",
    "blueprint_phase_plan_index",
    "blueprint_phase_plan_read",
    "blueprint_phase_summary_index",
    "blueprint_phase_summary_read",
    "blueprint_phase_execution_targets",
    "blueprint_review_authoring_context",
    "blueprint_review_validate_model",
    "blueprint_review_record"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-reviewer"]);
});
