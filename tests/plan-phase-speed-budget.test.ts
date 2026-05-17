import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { createGitRepo } from "./helpers/git-fixtures.js";

const repoRoot = process.cwd();

type PromptSurface = {
  id: string;
  filePath: string;
  baselineBytes: number;
  activeRuntime: boolean;
};

const promptSurfaces: PromptSurface[] = [
  {
    id: "command-manifest",
    filePath: "commands/blu-plan-phase.toml",
    baselineBytes: 12887,
    activeRuntime: true
  },
  {
    id: "primary-skill",
    filePath: "skills/blueprint-phase-planning/SKILL.md",
    baselineBytes: 13168,
    activeRuntime: true
  },
  {
    id: "runtime-contract",
    filePath: "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md",
    baselineBytes: 33740,
    activeRuntime: true
  },
  {
    id: "command-docs",
    filePath: "docs/commands/plan-phase.md",
    baselineBytes: 16430,
    activeRuntime: false
  },
  {
    id: "planner-agent",
    filePath: "agents/blueprint-planner.md",
    baselineBytes: 10073,
    activeRuntime: false
  },
  {
    id: "checker-agent",
    filePath: "agents/blueprint-checker.md",
    baselineBytes: 10985,
    activeRuntime: false
  }
];

const promptBudgetThresholds = {
  commandManifestBytes: 9000,
  primarySkillBytes: 9000,
  activeRuntimeBundleBytes: 52000
} as const;

function countMatches(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length;
}

async function createMeasuredPhaseRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-plan-speed-baseline-");

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Speed Fixture

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 3: Phase Discovery** - Measure plan-phase reads

## Phase Details

### Phase 3: Phase Discovery
**Goal**: Measure the plan-phase read pattern.
**Requirements**: SPEED-01, SPEED-02
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 3
- Active command: /blu-progress
- Next action: Run /blu-progress
- Last updated: 2026-05-17T00:00:00.000Z

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
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"),
    `# Phase 03: Phase Discovery - Context

## Phase Boundary
- Measure read duplication without changing production behavior.

## Discovery Grounding
- Keep SPEED-01 and SPEED-02 visible while planning.

## Implementation Decisions
- Use MCP-owned plan writes.

## Specific Ideas
- Add a readiness packet later.

## Existing Code Insights
- Plan-phase currently reads several artifacts across separate calls.

## Dependencies
- .blueprint/ROADMAP.md defines the phase.

## Open Questions
- none

## Deferred Ideas
- none

## Canonical References
- .blueprint/ROADMAP.md
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-RESEARCH.md"),
    `# Phase 03: Phase Discovery - Research

**Researched:** 2026-05-17
**Domain:** plan-phase speed
**Confidence:** HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SPEED-01 | Measure read duplication. | Instrument test reads around current tool calls. |

## Summary

- Plan-phase speed work starts with measurement.

## Locked Decisions From Context

- Preserve MCP-owned persistence.

## User Constraints

- Do not dilute final validation.

## Standard Stack

- TypeScript

## Installation And Setup

- Use node:test fixtures.

## Alternatives Considered

- Static-only source greps were rejected as insufficient.

## Architecture Patterns

- Commands stay thin; MCP owns state.

## Don't Hand-Roll

- Reuse existing plan tools.

## Anti-Patterns

- Process-wide stale caches.

## State Of The Art

- Read-only composite packets can reduce model-mediated calls.

## Common Pitfalls

- Treating write success as completion.

## Open Questions

- none

## Confidence Breakdown

| Topic | Confidence | Why |
|-------|------------|-----|
| Measurement | HIGH | The fixture controls the files read by the tools. |

## Code Examples

\`\`\`ts
await blueprintPhasePlanWrite({ phase: "3", content, overwrite: true });
\`\`\`

## Recommendations

- Keep final validation separate.

## Sources

- \`src/mcp/tools/phase.ts\`
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-UI-SPEC.md"),
    `# Phase 03: Phase Discovery - UI Spec

## Outcome Mode

- Explicit skip rationale

## Rationale

- No user-facing UI changes are in scope.

## User Experience Goals

- No user-facing UI changes are in scope.
`,
    "utf8"
  );

  return repoPath;
}

function measuredPlanContent(): string {
  return `---
phase: 3
plan_id: "01"
title: "Plan 01"
wave: 1
status: planned
objective: "Measure plan-phase read duplication."
depends_on: []
requirements:
  - SPEED-01
files_modified:
  - src/mcp/tools/phase.ts
read_first:
  - src/mcp/tools/phase.ts
acceptance_criteria:
  - tests/plan-phase-speed-budget.test.ts exits 0
autonomous: true
---

# Phase 03: Phase Discovery - Plan 01

## Goal

Measure plan-phase read duplication.

## Scope

- Add deterministic test measurement for plan-phase read calls.

## Requirement Coverage

| Requirement | Status | Covered By | Evidence |
|-------------|--------|------------|----------|
| SPEED-01 | covered | Task 1 | tests/plan-phase-speed-budget.test.ts |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| .blueprint/phases/03-phase-discovery/03-CONTEXT.md | used | Context grounds the measurement plan. |
| .blueprint/phases/03-phase-discovery/03-RESEARCH.md | used | Research records the measurement rationale. |

## File / Surface Coverage

| File / Surface | Covered By | Verification |
|----------------|------------|--------------|
| tests/plan-phase-speed-budget.test.ts | Task 1 | npx tsx --test tests/plan-phase-speed-budget.test.ts |

## Unknowns And Deferrals

| Item | Disposition | Follow-up |
|------|-------------|-----------|
| SPEED-02 remains uncovered until a later plan slot. | deferred | Keep final validation on /blu-plan-phase. |

## Tasks

### Task 1: Record the read baseline

#### Read First

- src/mcp/tools/phase.ts

#### Action

- Measure the existing plan-phase read path in tests.

#### Acceptance Criteria

- tests/plan-phase-speed-budget.test.ts exits 0

## External Service Prerequisites

| Service | Category | Purpose | User Setup / Startup | Readiness Check | Can Agent Proceed Without It |
|---------|----------|---------|----------------------|-----------------|------------------------------|
| none | none | No external services are required for this plan. | No user setup required. | Repo-local execution only. | yes |

## Verification

- npx tsx --test tests/plan-phase-speed-budget.test.ts

## Must Haves

- Final plan-set validation remains separate from write success.
`;
}

test("plan-phase prompt and relay surfaces expose an informational size baseline", async (t) => {
  const rows = await Promise.all(
    promptSurfaces.map(async (surface) => {
      const fileStat = await stat(path.join(repoRoot, surface.filePath));

      return {
        id: surface.id,
        filePath: surface.filePath,
        baselineBytes: surface.baselineBytes,
        sizeBytes: fileStat.size,
        activeRuntime: surface.activeRuntime
      };
    })
  );
  const activeRuntimeBundleBytes = rows
    .filter((row) => row.activeRuntime)
    .reduce((sum, row) => sum + row.sizeBytes, 0);
  const allMeasuredBytes = rows.reduce((sum, row) => sum + row.sizeBytes, 0);

  t.diagnostic(
    JSON.stringify(
      {
        activeRuntimeBundleBytes,
        allMeasuredBytes,
        rows
      },
      null,
      2
    )
  );

  assert.equal(rows.length, promptSurfaces.length);
  assert.ok(activeRuntimeBundleBytes > 0);
  assert.ok(allMeasuredBytes >= activeRuntimeBundleBytes);
  const commandManifestRow = rows.find((row) => row.id === "command-manifest");
  const primarySkillRow = rows.find((row) => row.id === "primary-skill");

  assert.ok(commandManifestRow);
  assert.ok(primarySkillRow);
  assert.ok(
    commandManifestRow.sizeBytes <= promptBudgetThresholds.commandManifestBytes,
    "command manifest should stay materially below the pre-deflation 12.9 KB baseline"
  );
  assert.ok(
    primarySkillRow.sizeBytes <= promptBudgetThresholds.primarySkillBytes,
    "primary skill should stay materially below the pre-deflation 13.2 KB baseline"
  );
  assert.ok(
    activeRuntimeBundleBytes <= promptBudgetThresholds.activeRuntimeBundleBytes,
    "active runtime bundle should stay below the Wave 4 deflation budget"
  );
  for (const row of rows) {
    assert.ok(
      row.sizeBytes <= Math.ceil(row.baselineBytes * 1.25),
      `${row.filePath} grew beyond the Wave 0 informational baseline`
    );
  }
}
);

test("phase-plan tool calls expose a duplicated-read runtime baseline", async (t) => {
  const repoPath = await createMeasuredPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const originalReadFile = fs.readFile;
  const originalAccess = fs.access;
  const metrics = {
    repoRootChecks: 0,
    roadmapReads: 0,
    stateReads: 0,
    configReads: 0,
    planArtifactReads: 0,
    discoveryArtifactReads: 0
  };

  (fs as typeof fs & { readFile: typeof fs.readFile }).readFile = async (
    file,
    ...args
  ): ReturnType<typeof fs.readFile> => {
    const filePath = String(file);

    if (filePath.endsWith(`${path.sep}.blueprint${path.sep}ROADMAP.md`)) {
      metrics.roadmapReads += 1;
    } else if (filePath.endsWith(`${path.sep}.blueprint${path.sep}STATE.md`)) {
      metrics.stateReads += 1;
    } else if (filePath.endsWith(`${path.sep}.blueprint${path.sep}config.json`)) {
      metrics.configReads += 1;
    } else if (/-PLAN\.md$/.test(filePath)) {
      metrics.planArtifactReads += 1;
    } else if (/-(CONTEXT|RESEARCH|UI-SPEC)\.md$/.test(filePath)) {
      metrics.discoveryArtifactReads += 1;
    }

    return originalReadFile.call(fs, file, ...args);
  };
  (fs as typeof fs & { access: typeof fs.access }).access = async (
    file,
    ...args
  ): ReturnType<typeof fs.access> => {
    if (String(file).endsWith(`${path.sep}.git`)) {
      metrics.repoRootChecks += 1;
    }

    return originalAccess.call(fs, file, ...args);
  };

  try {
    const {
      blueprintPhasePlanAuthoringContext,
      blueprintPhasePlanIndex,
      blueprintPhasePlanValidate,
      blueprintPhasePlanWrite
    } = await import("../src/mcp/tools/phase.js");

    await blueprintPhasePlanIndex({ cwd: repoPath, phase: "3" });
    await blueprintPhasePlanAuthoringContext({ cwd: repoPath, phase: "3", planId: "01" });
    await blueprintPhasePlanWrite({
      cwd: repoPath,
      phase: "3",
      planId: "01",
      content: measuredPlanContent(),
      overwrite: true
    });
    await blueprintPhasePlanValidate({ cwd: repoPath, phase: "3" });
  } finally {
    (fs as typeof fs & { readFile: typeof fs.readFile }).readFile = originalReadFile;
    (fs as typeof fs & { access: typeof fs.access }).access = originalAccess;
  }

  t.diagnostic(JSON.stringify(metrics, null, 2));

  assert.ok(metrics.repoRootChecks > 0);
  assert.ok(metrics.roadmapReads > 0);
  assert.ok(metrics.stateReads > 0);
  assert.ok(metrics.configReads > 0);
  assert.ok(metrics.planArtifactReads > 0);
  assert.ok(metrics.discoveryArtifactReads > 0);
});

test("phase-plan source hot spots remain visible as a coarse static proxy", async (t) => {
  const source = await readFile(path.join(repoRoot, "src/mcp/tools/phase.ts"), "utf8");
  const metrics = {
    ensureRepoRootCalls: countMatches(source, /\bensureRepoRoot\(/g),
    phaseLocateCalls: countMatches(source, /\bblueprintPhaseLocate\(/g),
    roadmapRequirementReads: countMatches(source, /\breadPhaseRoadmapRequirements\(/g),
    planIndexCalls: countMatches(source, /\bblueprintPhasePlanIndex\(/g),
    authoringContextCalls: countMatches(source, /\bblueprintPhasePlanAuthoringContext\(/g),
    planSetValidationCalls: countMatches(source, /\bvalidatePhasePlanSet\(/g)
  };

  t.diagnostic(JSON.stringify(metrics, null, 2));

  assert.ok(metrics.ensureRepoRootCalls > 0);
  assert.ok(metrics.phaseLocateCalls > 0);
  assert.ok(metrics.roadmapRequirementReads > 0);
  assert.ok(metrics.planIndexCalls > 0);
  assert.ok(metrics.authoringContextCalls > 0);
  assert.ok(metrics.planSetValidationCalls > 0);
});
