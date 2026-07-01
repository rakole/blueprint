import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { constants as fsConstants, promises as fs } from "node:fs";
import {
  access,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import {
  blueprintArtifactReportAuthoringContext,
  blueprintArtifactReportWrite,
  SCAFFOLD_GENERATED_MARKER,
  withBlueprintRepoLock
} from "../src/mcp/tools/artifacts.js";
import { PHASE_TOPOLOGY_LOCK_NAME } from "../src/mcp/tools/phase-topology-lock.js";
import {
  blueprintPhaseArtifactScaffold,
  blueprintPhaseArtifactWrite,
  blueprintPhaseCheckpointDelete,
  blueprintPhaseCheckpointPut,
  blueprintPhasePlanWrite,
  blueprintPhaseSummaryIndex,
  blueprintPhaseSummaryWrite,
  blueprintPhaseUiSkipWrite,
  blueprintPhaseValidationWrite,
  blueprintRoadmapRemovePhase
} from "../src/mcp/tools/phase.js";
import { blueprintReviewRecord } from "../src/mcp/tools/review.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

type Deferred<T = void> = {
  promise: Promise<T>;
  resolve(value: T | PromiseLike<T>): void;
  reject(error: unknown): void;
};

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function fsPathForMock(value: unknown): string {
  return typeof value === "string" ? value : path.resolve(String(value));
}

async function waitFor<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${label}.`));
    }, 5000);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function pauseFirstMkdirToPath(
  t: TestContext,
  targetPath: string
): {
  paused: Promise<void>;
  resume(): void;
} {
  const realMkdir = fs.mkdir.bind(fs);
  const paused = deferred<void>();
  const resume = deferred<void>();
  let hasPaused = false;

  t.mock.method(fs, "mkdir", async (target, options) => {
    if (!hasPaused && path.resolve(fsPathForMock(target)) === path.resolve(targetPath)) {
      hasPaused = true;
      paused.resolve();
      await resume.promise;
    }

    return realMkdir(
      target as Parameters<typeof fs.mkdir>[0],
      options as Parameters<typeof fs.mkdir>[1]
    );
  });

  t.after(() => {
    resume.resolve();
  });

  return {
    paused: paused.promise,
    resume: () => resume.resolve()
  };
}

function phaseTopologyLockPath(repoPath: string): string {
  return path.join(repoPath, ".blueprint/locks", `${PHASE_TOPOLOGY_LOCK_NAME}.lock`);
}

async function assertNoAmbiguousPhaseDirectories(repoPath: string): Promise<void> {
  const phaseRoot = path.join(repoPath, ".blueprint/phases");
  const directories = (await readdir(phaseRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const phaseNumbers = new Map<string, string[]>();

  for (const directory of directories) {
    const phaseNumber = directory.match(/^(\d+(?:\.\d+)?)-/)?.[1];

    if (!phaseNumber) {
      continue;
    }

    phaseNumbers.set(phaseNumber, [...(phaseNumbers.get(phaseNumber) ?? []), directory]);
  }

  for (const [phaseNumber, matches] of phaseNumbers) {
    assert.equal(
      matches.length,
      1,
      `Phase ${phaseNumber} has ambiguous directories: ${matches.join(", ")}`
    );
  }
}

function targetPlanContent(): string {
  return `---
phase: 2.2
plan_id: "01"
title: "Target Plan 01"
wave: 1
status: done
objective: "Exercise stale topology writer protection."
depends_on: []
requirements:
  - TP-01
files_modified:
  - src/feature.ts
read_first:
  - src/feature.ts
acceptance_criteria:
  - tests/phase-topology-stale-writers.test.ts exits 0
autonomous: true
---

# Phase 02.2: Target Phase - Plan 01

## Goal

Exercise stale topology writer protection.

## Scope

- Persist phase-scoped evidence only when the phase topology is fresh.

## Requirement Coverage

| Requirement | Status | Covered By | Evidence |
|-------------|--------|------------|----------|
| TP-01 | covered | Task 1 | src/feature.ts |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| .blueprint/phases/02.2-target-phase/02.2-CONTEXT.md | used | Captures the target phase scope. |

## File / Surface Coverage

| File / Surface | Covered By | Verification |
|----------------|------------|--------------|
| src/feature.ts | Task 1 | tests/phase-topology-stale-writers.test.ts exits 0 |

## Unknowns And Deferrals

| Item | Disposition | Follow-up |
|------|-------------|-----------|
| none | none | Run /blu-progress after validation. |

## Tasks

### Task 1: Guard stale topology writes

#### Read First

- src/feature.ts

#### Action

- Keep writes bound to the target phase identity.

#### Acceptance Criteria

- tests/phase-topology-stale-writers.test.ts exits 0

## External Service Prerequisites

| Service | Category | Purpose | User Setup / Startup | Readiness Check | Can Agent Proceed Without It |
|---------|----------|---------|----------------------|-----------------|------------------------------|
| none | none | No external services are required. | No user setup required. | Repo-local execution only. | yes |

## Verification

- Run the stale writer regression test.

## Must Haves

- Stale phase topology writes must fail before persistence.
`;
}

function replacementTargetPlanContent(): string {
  return targetPlanContent()
    .replace(
      "Exercise stale topology writer protection.",
      "Attempt to persist a stale replacement draft."
    )
    .replace(
      "Keep writes bound to the target phase identity.",
      "This stale draft must not replace the original target plan."
    );
}

function targetDiscussCheckpoint(): Record<string, unknown> {
  return {
    schemaVersion: 2,
    ownerCommand: "/blu-discuss-phase",
    mode: "discuss",
    progress: {},
    areaQueue: [
      {
        areaId: "phase-boundary",
        title: "Phase boundary",
        state: "questioning",
        currentQuestion: "What context remains before planning?"
      }
    ],
    carryForward: {},
    readSet: []
  };
}

function targetSummaryContent(): string {
  return `# Phase 02.2: Target Phase - Summary 01

**Plan:** \`02.2-01-PLAN.md\`
**Status:** COMPLETED
**Readiness:** ready-for-validation
**Completion State:** complete
**Next Safe Action:** /blu-validate-phase 2.2

## Outcome

- Execution finished and produced a summary artifact.

## Changes Made

- Added the target feature slice.

## Verification

| Check | Command | Result | Evidence | Notes |
|-------|---------|--------|----------|-------|
| stale writer regression exits 0 | npx tsx --test tests/phase-topology-stale-writers.test.ts | pass | Ran the focused stale writer test. | The selected acceptance criterion passed. |

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
| artifact | .blueprint/phases/02.2-target-phase/02.2-01-SUMMARY.md | Saved summary artifact. |
`;
}

function targetResearchContent(): string {
  return `# Phase 02.2: Target Phase - Research

**Researched:** 2026-06-30
**Domain:** stale topology persistence
**Confidence:** HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TP-01 | Stale phase-scoped writers must reject renumbered topology. | Use topology fingerprint checks before persistence. |

## Summary

- The stale writer must fail instead of recreating the old target phase directory.

## Locked Decisions From Context

- Keep phase evidence under the live phase directory only.

## User Constraints

- Preserve dirty worktree edits and avoid broad refactors.

## Standard Stack

- TypeScript
- node:test via tsx --test

## Installation And Setup

- Dependencies are installed in the shared worktree.

## Alternatives Considered

- Retrying against the replacement numeric phase was rejected because it can write evidence to the wrong phase.

## Architecture Patterns

- Use the shared phase-topology lock before phase-scoped persistence.

## Don't Hand-Roll

- Reuse Blueprint path and lock helpers.

## Anti-Patterns

- Writing to a path resolved before topology mutation.

## State Of The Art

- Core add, insert, remove, and promote mutations share the phase-topology lock.

## Common Pitfalls

- Numeric phase references can point to a different phase after renumbering.

## Open Questions

- none

## Confidence Breakdown

| Topic | Confidence | Why |
|-------|------------|-----|
| stale writer guard | HIGH | The regression controls the topology interleaving deterministically. |

## Code Examples

\`\`\`ts
await blueprintPhaseArtifactWrite({ phase: "2.2", artifact: "research", content });
\`\`\`

## Recommendations

- Reject stale topology before persistence.

## Sources

- \`src/mcp/tools/phase.ts\` - phase writer implementation.
`;
}

function targetVerificationContent(): string {
  return `# Phase 02.2: Target Phase - Verification

**Coverage:** Reviewed \`.blueprint/phases/02.2-target-phase/02.2-01-SUMMARY.md\` for completed execution evidence.
**Gate State:** PASS
**Sign-off:** validation lead

## Validation Summary

- Execution evidence matches the expected phase outcome.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| TP-01 | Confirm stale topology protection | .blueprint/phases/02.2-target-phase/02.2-01-SUMMARY.md | PASS | Saved summary backs the verification pass. |

## Evidence Reviewed

- .blueprint/phases/02.2-target-phase/02.2-01-SUMMARY.md

## Test Infrastructure / Evidence Metadata

- Harness: node:test
- Commands: npx tsx --test tests/phase-topology-stale-writers.test.ts
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

- Continue with \`/blu-progress\`.
`;
}

function codeReviewModel(): Record<string, unknown> {
  return {
    verdict: "FOLLOW_UP",
    reviewSummary: [
      "Phase 2.2 stale writer review covered the source file with one high follow-up."
    ],
    positiveSignals: [
      "Saved plan and summary evidence agree on the bounded source and test scope."
    ],
    findings: [
      {
        severity: "high",
        disposition: "follow-up",
        location: "src/feature.ts:1",
        evidence: "The feature implementation has no negative-input guard.",
        impact: "Invalid input can be processed as a successful value.",
        recommendation: "Add a negative-input guard and matching regression test."
      }
    ],
    evidenceCoverage: {
      ".blueprint/phases/02.2-target-phase/02.2-01-PLAN.md": {
        status: "used",
        rationale: "Plan metadata defined the reviewed source file."
      },
      ".blueprint/phases/02.2-target-phase/02.2-01-SUMMARY.md": {
        status: "used",
        rationale: "Summary evidence confirmed the completed delivery increment."
      },
      ".blueprint/phases/02.2-target-phase/02.2-VERIFICATION.md": {
        status: "used",
        rationale: "Verification evidence confirmed the saved phase was review-ready."
      }
    },
    followUps: ["Add a negative-input regression test before shipping."],
    nextSafeAction: "/blu-code-review-fix 2.2"
  };
}

type ArtifactReportAuthoringContext = Awaited<
  ReturnType<typeof blueprintArtifactReportAuthoringContext>
>;

function addTestsReportModel(
  context: ArtifactReportAuthoringContext
): Record<string, unknown> {
  const summaryEvidence = Object.fromEntries(
    context.completedSummaries.map((summary) => [
      summary.path,
      {
        planId: summary.planId,
        linkedPlanPath: summary.linkedPlanPath,
        summaryStatus: "COMPLETED",
        targetedVerification: summary.targetedVerification,
        coverageNote: `Generated tests cover completed plan ${summary.planId}.`
      }
    ])
  );

  return {
    status: "COMPLETED",
    readiness: "ready-for-routing",
    completionState: "complete",
    coverageGoal: [
      "Add focused stale-topology report coverage for the completed phase evidence."
    ],
    evidenceUsed: [
      ...context.completedSummaries.map((summary) => summary.path),
      ...context.validationEvidencePaths
    ],
    summaryEvidence,
    pendingPlans: context.pendingPlans,
    dependencyPlans: context.dependencyPlans.map((dependency) => ({
      ...dependency,
      status: "satisfied",
      evidence: `Dependency plan ${dependency.planId} already has completed summary evidence.`
    })),
    classification: [
      {
        target: "tests/phase-topology-stale-writers.test.ts",
        category: "Integration / API",
        reason: "The focused stale-writer test exercises phase topology report persistence."
      }
    ],
    testPlan: [
      {
        target: "tests/phase-topology-stale-writers.test.ts",
        scenario: "Reject a stale add-tests report write after phase topology changes.",
        expectedAssertion: "The stale report is not created under .blueprint/reports.",
        command: "npx tsx --test tests/phase-topology-stale-writers.test.ts"
      }
    ],
    testsAddedOrUpdated: [
      {
        path: "tests/phase-topology-stale-writers.test.ts",
        summary: "Added phase-backed report stale-topology coverage."
      }
    ],
    targetedCommands: [
      {
        command: "npx tsx --test tests/phase-topology-stale-writers.test.ts",
        result: "pass",
        evidence: "The focused stale writer regression exits 0."
      }
    ],
    resultCounts: {
      generated: 1,
      passing: 1,
      failing: 0,
      blocked: 0
    },
    bugsOrBlockers: [
      {
        item: "none",
        evidence: "none",
        status: "NONE"
      }
    ],
    manualOrDeferredWork: [
      {
        item: "none",
        reason: "none",
        followUp: "none",
        status: "NONE"
      }
    ],
    remainingGaps: [
      {
        gap: "none",
        evidence: "none",
        repair: "none",
        status: "NONE"
      }
    ],
    followUpFixes: ["none"],
    verificationWrite: {
      status: "written",
      evidence: ".blueprint/phases/02.2-target-phase/02.2-VERIFICATION.md exists."
    },
    nextSafeAction: context.allowedNextActions[0] ?? "/blu-progress"
  };
}

function auditFixRuntimeContext() {
  return {
    source: "verification" as const,
    severity: "high" as const,
    maxAttempts: 1,
    dryRun: false,
    scopeFiles: ["src/feature.ts"]
  };
}

function auditFixReportModel(
  context: ArtifactReportAuthoringContext
): Record<string, unknown> {
  const summaryEvidence = Object.fromEntries(
    context.completedSummaries.map((summary) => [
      summary.path,
      {
        planId: summary.planId,
        linkedPlanPath: summary.linkedPlanPath,
        summaryStatus: "COMPLETED",
        targetedVerification: summary.targetedVerification,
        coverageNote: `Saved summary ${summary.planId} proves the stale topology regression scope.`
      }
    ])
  );
  const selectedEvidencePath =
    context.selectedEvidencePaths[0] ??
    ".blueprint/phases/02.2-target-phase/02.2-VERIFICATION.md";
  const scopeFile = context.scopeFiles[0] ?? "src/feature.ts";

  return {
    status: "COMPLETED",
    readiness: "ready-for-routing",
    completionState: "complete",
    remediationSummary: [
      "The bounded audit-fix run resolved the verification-backed gap without widening scope."
    ],
    summaryEvidence,
    classification: [
      {
        findingId: "AF-02-2-01",
        evidenceSource: selectedEvidencePath,
        severity: "high",
        classification: "auto-fixable",
        reason: "The saved verification evidence maps to one scoped repo file.",
        implicatedFiles: [scopeFile],
        narrowVerification: "npx tsx --test tests/phase-topology-stale-writers.test.ts"
      }
    ],
    changesApplied: [
      {
        findingId: "AF-02-2-01",
        status: "fixed",
        changedFiles: [scopeFile],
        summary: "Added the bounded remediation guard for the saved verification gap."
      }
    ],
    verification: [
      {
        findingId: "AF-02-2-01",
        check: "phase topology stale writer regression",
        command: "npx tsx --test tests/phase-topology-stale-writers.test.ts",
        result: "pass",
        evidence: "The focused stale writer regression exits 0."
      }
    ],
    pendingPlans: context.pendingPlans,
    dependencyPlans: context.dependencyPlans.map((dependency) => ({
      ...dependency
    })),
    manualOrDeferredWork: [
      {
        item: "none",
        status: "NONE",
        reason: "none",
        followUp: "none"
      }
    ],
    gapRoutes: [
      {
        gap: "none",
        status: "NONE",
        evidence: "none",
        repair: "none"
      }
    ],
    followUpFixes: ["none"],
    evidence: [
      {
        kind: "verification",
        source: selectedEvidencePath,
        summary: "Saved verification evidence selected by the audit-fix source filter."
      },
      ...context.completedSummaries.map((summary) => ({
        kind: "summary" as const,
        source: summary.path,
        summary: `Completed summary ${summary.planId} proves linked plan provenance.`
      })),
      {
        kind: "scope",
        source: scopeFile,
        summary: "Scoped repo file inspected for the bounded remediation."
      }
    ],
    commitTraceability: {
      preFixHead: "unknown",
      createdCommits: ["none"]
    },
    todoCapture: {
      status: "not-needed",
      evidence: "No follow-up index entry was required."
    },
    nextSafeAction: "/blu-validate-phase 2.2"
  };
}

async function createStaleWriterRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-phase-topology-stale-writers-");

  for (const phaseDir of [
    "01-foundation",
    "02.1-removable",
    "02.2-target-phase",
    "02.3-replacement-phase"
  ]) {
    await mkdir(path.join(repoPath, ".blueprint/phases", phaseDir), {
      recursive: true
    });
  }

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await writeFile(path.join(repoPath, "src/feature.ts"), "export const feature = true;\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/REQUIREMENTS.md"),
    `# Requirements

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| TP-01 | Guard stale topology writes. | Pending | Phase 2.2 coverage. |
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Stale Writers

## Milestone

- Active milestone: v1

## Phases

- [x] **Phase 1: Foundation** - Baseline initialization
- [ ] **Phase 2.1: Removable** - Remove to force a renumber
- [ ] **Phase 2.2: Target Phase** - Original writer target
- [ ] **Phase 2.3: Replacement Phase** - Replacement numeric slot after renumber

## Phase Details

### Phase 1: Foundation
**Goal**: Baseline initialization.
**Requirements**: TP-01
**Status**: completed

### Phase 2.1: Removable
**Goal**: Remove to force a renumber.
**Requirements**: TP-01

### Phase 2.2: Target Phase
**Goal**: Original writer target.
**Requirements**: TP-01

### Phase 2.3: Replacement Phase
**Goal**: Replacement numeric slot after renumber.
**Requirements**: TP-01
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 1
- Active command: /blu-progress
- Next action: Run /blu-progress
- Last updated: 2026-06-30T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    JSON.stringify(
      {
        version: 2,
        workflow: {
          no_uat: true,
          code_review: false,
          ui_safety_gate: false
        }
      },
      null,
      2
    ),
    "utf8"
  );

  const contextByPrefix = new Map([
    ["01-foundation", "01"],
    ["02.1-removable", "02.1"],
    ["02.2-target-phase", "02.2"],
    ["02.3-replacement-phase", "02.3"]
  ]);

  for (const [phaseDir, prefix] of contextByPrefix) {
    await writeFile(
      path.join(repoPath, ".blueprint/phases", phaseDir, `${prefix}-CONTEXT.md`),
      `# Phase ${prefix}: ${phaseDir} - Context\n\n## Phase Boundary\n\n- Fixture context.\n`,
      "utf8"
    );
  }

  await writeFile(
    path.join(repoPath, ".blueprint/phases/02.2-target-phase/02.2-01-PLAN.md"),
    targetPlanContent(),
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/02.2-target-phase/02.2-01-SUMMARY.md"),
    targetSummaryContent(),
    "utf8"
  );

  return repoPath;
}

async function runWriterAcrossRenumber(
  t: TestContext,
  repoPath: string,
  startWriter: () => Promise<unknown>
): Promise<void> {
  const pause = pauseFirstMkdirToPath(t, phaseTopologyLockPath(repoPath));
  const writer = startWriter();

  await waitFor(pause.paused, "stale writer topology lock attempt");
  await blueprintRoadmapRemovePhase({
    cwd: repoPath,
    phase: "2.1",
    confirmed: true
  });
  pause.resume();
  await assert.rejects(writer, /stale phase topology/i);
}

async function replaceTargetRoadmapIdentity(repoPath: string): Promise<void> {
  const roadmapPath = path.join(repoPath, ".blueprint/ROADMAP.md");
  const roadmap = await readFile(roadmapPath, "utf8");
  const targetDetails = `### Phase 2.2: Target Phase
**Goal**: Original writer target.
**Requirements**: TP-01`;
  const replacementDetails = `### Phase 2.2: Target Phase
**Goal**: Replacement roadmap intent for the same numbered slot.
**Requirements**: TP-REPLACED`;

  assert.match(roadmap, /- \[ \] \*\*Phase 2\.2: Target Phase\*\* - Original writer target/);
  assert.ok(roadmap.includes(targetDetails));

  await writeFile(
    roadmapPath,
    roadmap
      .replace(
        "- [ ] **Phase 2.2: Target Phase** - Original writer target",
        "- [ ] **Phase 2.2: Target Phase** - Replacement roadmap intent"
      )
      .replace(targetDetails, replacementDetails),
    "utf8"
  );
}

async function manuallyRenumberTargetSlotAfterRemovingPhase21(repoPath: string): Promise<void> {
  await withBlueprintRepoLock(repoPath, PHASE_TOPOLOGY_LOCK_NAME, async () => {
    const roadmapPath = path.join(repoPath, ".blueprint/ROADMAP.md");
    const roadmap = await readFile(roadmapPath, "utf8");
    const removableDetails = `### Phase 2.1: Removable
**Goal**: Remove to force a renumber.
**Requirements**: TP-01

`;

    assert.match(roadmap, /- \[ \] \*\*Phase 2\.1: Removable\*\*/);
    assert.match(roadmap, /- \[ \] \*\*Phase 2\.2: Target Phase\*\*/);
    assert.match(roadmap, /- \[ \] \*\*Phase 2\.3: Replacement Phase\*\*/);
    assert.ok(roadmap.includes(removableDetails));

    await writeFile(
      roadmapPath,
      roadmap
        .replace("- [ ] **Phase 2.1: Removable** - Remove to force a renumber\n", "")
        .replace(
          "- [ ] **Phase 2.2: Target Phase** - Original writer target",
          "- [ ] **Phase 2.1: Target Phase** - Original writer target"
        )
        .replace(
          "- [ ] **Phase 2.3: Replacement Phase** - Replacement numeric slot after renumber",
          "- [ ] **Phase 2.2: Replacement Phase** - Replacement numeric slot after renumber"
        )
        .replace(removableDetails, "")
        .replace("### Phase 2.2: Target Phase", "### Phase 2.1: Target Phase")
        .replace("### Phase 2.3: Replacement Phase", "### Phase 2.2: Replacement Phase"),
      "utf8"
    );

    await rm(path.join(repoPath, ".blueprint/phases/02.1-removable"), {
      recursive: true,
      force: true
    });
    await fs.rename(
      path.join(repoPath, ".blueprint/phases/02.3-replacement-phase"),
      path.join(repoPath, ".blueprint/phases/02.2-replacement-phase")
    );
    await fs.rename(
      path.join(repoPath, ".blueprint/phases/02.2-replacement-phase/02.3-CONTEXT.md"),
      path.join(repoPath, ".blueprint/phases/02.2-replacement-phase/02.2-CONTEXT.md")
    );
  });
}

async function runWriterAcrossSameSlotIdentitySwap(
  t: TestContext,
  repoPath: string,
  startWriter: () => Promise<unknown>
): Promise<void> {
  const pause = pauseFirstMkdirToPath(t, phaseTopologyLockPath(repoPath));
  const writer = startWriter();

  await waitFor(pause.paused, "stale writer topology lock attempt");
  await replaceTargetRoadmapIdentity(repoPath);
  pause.resume();
  await assert.rejects(writer, /stale phase topology/i);
}

async function runPlannedContextScaffoldAcrossManualRenumber(
  t: TestContext,
  repoPath: string,
  startWriter: () => Promise<unknown>
): Promise<void> {
  const pause = pauseFirstMkdirToPath(t, phaseTopologyLockPath(repoPath));
  const writer = startWriter();

  await waitFor(pause.paused, "planned scaffold topology lock attempt");
  await manuallyRenumberTargetSlotAfterRemovingPhase21(repoPath);
  pause.resume();
  await assert.rejects(writer, /stale phase topology|stale planned phase topology/i);
}

test("phase artifact write rejects same-slot roadmap identity swaps", async (t) => {
  const repoPath = await createStaleWriterRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await runWriterAcrossSameSlotIdentitySwap(t, repoPath, () =>
    blueprintPhaseArtifactWrite({
      cwd: repoPath,
      phase: "2.2",
      artifact: "research",
      content: targetResearchContent(),
      overwrite: true
    })
  );

  const roadmap = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");
  assert.match(roadmap, /Replacement roadmap intent/);
  assert.equal(
    await pathExists(
      path.join(repoPath, ".blueprint/phases/02.2-target-phase/02.2-RESEARCH.md")
    ),
    false
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/02.2-target-phase")),
    true
  );
  await assertNoAmbiguousPhaseDirectories(repoPath);
});

test("phase UI skip write rejects same-slot roadmap identity swaps without creating a skip artifact", async (t) => {
  const repoPath = await createStaleWriterRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await runWriterAcrossSameSlotIdentitySwap(t, repoPath, () =>
    blueprintPhaseUiSkipWrite({
      cwd: repoPath,
      phase: "2.2",
      skipRationale: "No user-facing UI changes are needed for the original target phase.",
      overwrite: true
    })
  );

  const roadmap = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");
  assert.match(roadmap, /Replacement roadmap intent/);
  assert.equal(
    await pathExists(
      path.join(repoPath, ".blueprint/phases/02.2-target-phase/02.2-UI-SPEC.md")
    ),
    false
  );
  assert.equal(
    await pathExists(
      path.join(repoPath, ".blueprint/phases/02.3-replacement-phase/02.3-UI-SPEC.md")
    ),
    false
  );
  await assertNoAmbiguousPhaseDirectories(repoPath);
});

test("phase plan write rejects stale topology without writing under the replacement phase", async (t) => {
  const repoPath = await createStaleWriterRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await runWriterAcrossRenumber(t, repoPath, () =>
    blueprintPhasePlanWrite({
      cwd: repoPath,
      phase: "2.2",
      planId: "01",
      content: replacementTargetPlanContent(),
      overwrite: true
    })
  );

  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/02.2-target-phase")),
    false
  );
  assert.equal(
    await pathExists(
      path.join(repoPath, ".blueprint/phases/02.2-replacement-phase/02.2-01-PLAN.md")
    ),
    false
  );
  await assertNoAmbiguousPhaseDirectories(repoPath);
});

test("phase plan write rejects same-slot roadmap identity swaps without replacing the target plan", async (t) => {
  const repoPath = await createStaleWriterRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const planPath = path.join(repoPath, ".blueprint/phases/02.2-target-phase/02.2-01-PLAN.md");
  const originalPlan = await readFile(planPath, "utf8");

  await runWriterAcrossSameSlotIdentitySwap(t, repoPath, () =>
    blueprintPhasePlanWrite({
      cwd: repoPath,
      phase: "2.2",
      planId: "01",
      content: replacementTargetPlanContent(),
      overwrite: true
    })
  );

  assert.equal(await readFile(planPath, "utf8"), originalPlan);
  await assertNoAmbiguousPhaseDirectories(repoPath);
});

test("checkpoint put rejects stale topology without recreating the old phase directory", async (t) => {
  const repoPath = await createStaleWriterRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await runWriterAcrossRenumber(t, repoPath, () =>
    blueprintPhaseCheckpointPut({
      cwd: repoPath,
      phase: "2.2",
      checkpoint: targetDiscussCheckpoint()
    })
  );

  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/02.2-target-phase")),
    false
  );
  assert.equal(
    await pathExists(
      path.join(repoPath, ".blueprint/phases/02.2-replacement-phase/02.2-DISCUSS-CHECKPOINT.json")
    ),
    false
  );
  await assertNoAmbiguousPhaseDirectories(repoPath);
});

test("checkpoint put rejects same-slot roadmap identity swaps without writing a checkpoint", async (t) => {
  const repoPath = await createStaleWriterRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await runWriterAcrossSameSlotIdentitySwap(t, repoPath, () =>
    blueprintPhaseCheckpointPut({
      cwd: repoPath,
      phase: "2.2",
      checkpoint: targetDiscussCheckpoint()
    })
  );

  assert.equal(
    await pathExists(
      path.join(repoPath, ".blueprint/phases/02.2-target-phase/02.2-DISCUSS-CHECKPOINT.json")
    ),
    false
  );
  await assertNoAmbiguousPhaseDirectories(repoPath);
});

test("checkpoint delete rejects stale topology without deleting the replacement checkpoint slot", async (t) => {
  const repoPath = await createStaleWriterRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintPhaseCheckpointPut({
    cwd: repoPath,
    phase: "2.2",
    checkpoint: targetDiscussCheckpoint()
  });

  await runWriterAcrossRenumber(t, repoPath, () =>
    blueprintPhaseCheckpointDelete({
      cwd: repoPath,
      phase: "2.2",
      expectedOwnerCommand: "/blu-discuss-phase",
      expectedMode: "discuss"
    })
  );

  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/02.2-target-phase")),
    false
  );
  assert.equal(
    await pathExists(
      path.join(repoPath, ".blueprint/phases/02.2-replacement-phase/02.2-DISCUSS-CHECKPOINT.json")
    ),
    false
  );
  await assertNoAmbiguousPhaseDirectories(repoPath);
});

test("planned context scaffold rejects stale topology without materializing the stale phase directory", async (t) => {
  const repoPath = await createStaleWriterRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await rm(path.join(repoPath, ".blueprint/phases/02.2-target-phase"), {
    recursive: true,
    force: true
  });

  await runPlannedContextScaffoldAcrossManualRenumber(t, repoPath, () =>
    blueprintPhaseArtifactScaffold({
      cwd: repoPath,
      phase: "2.2",
      artifact: "context"
    })
  );

  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/02.2-target-phase")),
    false
  );
  assert.equal(
    (
      await readFile(
      path.join(repoPath, ".blueprint/phases/02.2-replacement-phase/02.2-CONTEXT.md"),
      "utf8"
      )
    ).includes(SCAFFOLD_GENERATED_MARKER),
    false
  );
  await assertNoAmbiguousPhaseDirectories(repoPath);
});

test("planned context scaffold rejects same-slot roadmap identity swaps without creating a directory", async (t) => {
  const repoPath = await createStaleWriterRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await rm(path.join(repoPath, ".blueprint/phases/02.2-target-phase"), {
    recursive: true,
    force: true
  });

  await runWriterAcrossSameSlotIdentitySwap(t, repoPath, () =>
    blueprintPhaseArtifactScaffold({
      cwd: repoPath,
      phase: "2.2",
      artifact: "context"
    })
  );

  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/02.2-target-phase")),
    false
  );
  await assertNoAmbiguousPhaseDirectories(repoPath);
});

test("planned context scaffold rolls back a newly materialized directory when scaffold writing fails", async (t) => {
  const repoPath = await createStaleWriterRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await rm(path.join(repoPath, ".blueprint/phases/02.2-target-phase"), {
    recursive: true,
    force: true
  });

  const realWriteFile = fs.writeFile.bind(fs);
  t.mock.method(fs, "writeFile", async (target, contents, options) => {
    const targetPath = fsPathForMock(target);

    if (targetPath.includes(`${path.sep}02.2-target-phase${path.sep}.02.2-CONTEXT.md.`)) {
      throw new Error("injected context scaffold write failure");
    }

    return realWriteFile(
      target as Parameters<typeof fs.writeFile>[0],
      contents as Parameters<typeof fs.writeFile>[1],
      options as Parameters<typeof fs.writeFile>[2]
    );
  });

  await assert.rejects(
    blueprintPhaseArtifactScaffold({
      cwd: repoPath,
      phase: "2.2",
      artifact: "context",
      overwrite: true
    }),
    /injected context scaffold write failure/
  );

  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/02.2-target-phase")),
    false
  );
  await assertNoAmbiguousPhaseDirectories(repoPath);
});

test("review record rejects stale topology after phase renumber without writing replacement review", async (t) => {
  const repoPath = await createStaleWriterRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/02.2-target-phase/02.2-VERIFICATION.md"),
    targetVerificationContent(),
    "utf8"
  );

  await runWriterAcrossRenumber(t, repoPath, () =>
    blueprintReviewRecord({
      cwd: repoPath,
      phase: "2.2",
      artifact: "code-review",
      model: codeReviewModel(),
      scopeFiles: ["src/feature.ts"],
      scopeSource: "explicit-files"
    })
  );

  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/02.2-target-phase")),
    false
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/02.2-replacement-phase/02.2-REVIEW.md")),
    false
  );
  await assertNoAmbiguousPhaseDirectories(repoPath);
});

test("artifact report write rejects stale phase-backed add-tests reports after phase renumber", async (t) => {
  const repoPath = await createStaleWriterRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeFile(
    path.join(repoPath, ".blueprint/phases/02.2-target-phase/02.2-VERIFICATION.md"),
    targetVerificationContent(),
    "utf8"
  );
  const context = await blueprintArtifactReportAuthoringContext({
    cwd: repoPath,
    reportName: "add-tests-2.2"
  });

  assert.equal(context.status, "ready", context.reason ?? context.warnings.join("\n"));

  await runWriterAcrossRenumber(t, repoPath, () =>
    blueprintArtifactReportWrite({
      cwd: repoPath,
      reportName: "add-tests-2.2",
      model: addTestsReportModel(context)
    })
  );

  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/reports/add-tests-2-2.md")),
    false
  );
  await assertNoAmbiguousPhaseDirectories(repoPath);
});

test("artifact report write rejects stale phase-backed audit-fix reports after phase renumber", async (t) => {
  const repoPath = await createStaleWriterRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeFile(
    path.join(repoPath, ".blueprint/phases/02.2-target-phase/02.2-VERIFICATION.md"),
    targetVerificationContent(),
    "utf8"
  );
  const auditFixContext = auditFixRuntimeContext();
  const context = await blueprintArtifactReportAuthoringContext({
    cwd: repoPath,
    reportName: "audit-fix-2.2",
    auditFixContext
  });

  assert.equal(context.status, "ready", context.reason ?? context.warnings.join("\n"));

  await runWriterAcrossRenumber(t, repoPath, () =>
    blueprintArtifactReportWrite({
      cwd: repoPath,
      reportName: "audit-fix-2.2",
      model: auditFixReportModel(context),
      auditFixContext
    })
  );

  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/reports/audit-fix-2-2.md")),
    false
  );
  await assertNoAmbiguousPhaseDirectories(repoPath);
});

test("artifact report write rejects same-slot phase-backed add-tests identity swaps", async (t) => {
  const repoPath = await createStaleWriterRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeFile(
    path.join(repoPath, ".blueprint/phases/02.2-target-phase/02.2-VERIFICATION.md"),
    targetVerificationContent(),
    "utf8"
  );
  const context = await blueprintArtifactReportAuthoringContext({
    cwd: repoPath,
    reportName: "add-tests-2.2"
  });

  assert.equal(context.status, "ready", context.reason ?? context.warnings.join("\n"));

  await runWriterAcrossSameSlotIdentitySwap(t, repoPath, () =>
    blueprintArtifactReportWrite({
      cwd: repoPath,
      reportName: "add-tests-2.2",
      model: addTestsReportModel(context)
    })
  );

  const roadmap = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");
  assert.match(roadmap, /Replacement roadmap intent/);
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/reports/add-tests-2-2.md")),
    false
  );
  await assertNoAmbiguousPhaseDirectories(repoPath);
});

test("phase artifact write rejects stale topology without recreating the old phase directory", async (t) => {
  const repoPath = await createStaleWriterRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await runWriterAcrossRenumber(t, repoPath, () =>
    blueprintPhaseArtifactWrite({
      cwd: repoPath,
      phase: "2.2",
      artifact: "research",
      content: targetResearchContent(),
      overwrite: true
    })
  );

  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/02.2-target-phase")),
    false
  );
  assert.equal(
    await pathExists(
      path.join(repoPath, ".blueprint/phases/02.2-replacement-phase/02.2-RESEARCH.md")
    ),
    false
  );
  await assertNoAmbiguousPhaseDirectories(repoPath);
});

test("phase summary write rejects stale topology without writing under the replacement phase", async (t) => {
  const repoPath = await createStaleWriterRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await rm(path.join(repoPath, ".blueprint/phases/02.2-target-phase/02.2-01-SUMMARY.md"));

  await runWriterAcrossRenumber(t, repoPath, () =>
    blueprintPhaseSummaryWrite({
      cwd: repoPath,
      phase: "2.2",
      planId: "01",
      content: targetSummaryContent(),
      overwrite: true
    })
  );

  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/02.2-target-phase")),
    false
  );
  assert.equal(
    await pathExists(
      path.join(repoPath, ".blueprint/phases/02.2-replacement-phase/02.2-01-SUMMARY.md")
    ),
    false
  );
  await assertNoAmbiguousPhaseDirectories(repoPath);
});

test("phase summary write rejects stale linked plan changes without completing the plan", async (t) => {
  const repoPath = await createStaleWriterRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const planPath = path.join(repoPath, ".blueprint/phases/02.2-target-phase/02.2-01-PLAN.md");
  const summaryPath = path.join(repoPath, ".blueprint/phases/02.2-target-phase/02.2-01-SUMMARY.md");
  await rm(summaryPath);

  const pause = pauseFirstMkdirToPath(t, phaseTopologyLockPath(repoPath));
  const writer = blueprintPhaseSummaryWrite({
    cwd: repoPath,
    phase: "2.2",
    planId: "01",
    content: targetSummaryContent(),
    overwrite: true
  });

  await waitFor(pause.paused, "summary write topology lock attempt");
  await writeFile(
    planPath,
    `${await readFile(planPath, "utf8")}\n<!-- changed after summary authoring -->\n`,
    "utf8"
  );
  pause.resume();

  const result = await writer;
  const index = await blueprintPhaseSummaryIndex({ cwd: repoPath, phase: "2.2" });

  assert.equal(result.status, "invalid");
  assert.equal(result.written, false);
  assert.match(result.issues.join("\n"), /linked plan changed since summary authoring context/i);
  assert.equal(await pathExists(summaryPath), false);
  assert.equal(index.completedPlans.includes("01"), false);
  assert.ok(index.pendingPlans.includes("01"));
});

test("phase summary write rejects stale linked plan changes before reusing an existing summary", async (t) => {
  const repoPath = await createStaleWriterRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const planPath = path.join(repoPath, ".blueprint/phases/02.2-target-phase/02.2-01-PLAN.md");

  const pause = pauseFirstMkdirToPath(t, phaseTopologyLockPath(repoPath));
  const writer = blueprintPhaseSummaryWrite({
    cwd: repoPath,
    phase: "2.2",
    planId: "01",
    content: targetSummaryContent(),
    overwrite: true
  });

  await waitFor(pause.paused, "summary reuse topology lock attempt");
  await writeFile(
    planPath,
    `${await readFile(planPath, "utf8")}\n<!-- changed before summary reuse -->\n`,
    "utf8"
  );
  pause.resume();

  const result = await writer;

  assert.equal(result.status, "invalid");
  assert.notEqual(result.status, "reused");
  assert.equal(result.written, false);
  assert.match(result.issues.join("\n"), /linked plan changed since summary authoring context/i);
});

test("phase validation write rejects stale topology and does not complete the replacement phase", async (t) => {
  const repoPath = await createStaleWriterRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await runWriterAcrossRenumber(t, repoPath, () =>
    blueprintPhaseValidationWrite({
      cwd: repoPath,
      phase: "2.2",
      artifact: "verification",
      content: targetVerificationContent(),
      overwrite: true
    })
  );

  const roadmap = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");
  assert.match(roadmap, /- \[ \] \*\*Phase 2\.2: Replacement Phase\*\*/);
  assert.doesNotMatch(roadmap, /- \[x\] \*\*Phase 2\.2: Replacement Phase\*\*/);
  assert.equal(
    await pathExists(
      path.join(repoPath, ".blueprint/phases/02.2-replacement-phase/02.2-VERIFICATION.md")
    ),
    false
  );
  await assertNoAmbiguousPhaseDirectories(repoPath);
});
