import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  blueprintPhasePlanIndex,
  blueprintPhasePlanRead,
  blueprintPhasePlanWrite
} from "../src/mcp/tools/phase.js";

async function createPhaseRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-plan-write-locking-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Fixture

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 3: Phase Discovery** - Add the planning slice

## Phase Details

### Phase 3: Phase Discovery
**Goal**: Add a plan-phase runtime.
**Requirements**: LIFE-01, LIFE-02
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
- Last updated: 2026-04-11T00:00:00.000Z

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
        mode: "interactive",
        granularity: "standard",
        model_profile: "balanced",
        project_code: null,
        phase_naming: "sequential",
        response_language: null,
        planning: { commit_docs: true, search_gitignored: false },
        workflow: {
          research: true,
          plan_check: true,
          verifier: true,
          nyquist_validation: true,
          ui_phase: true,
          ui_safety_gate: true,
          code_review: true,
          code_review_depth: "standard",
          auto_advance: false,
          research_before_questions: false,
          discuss_mode: "discuss",
          skip_discuss: false,
          use_worktrees: true,
          subagent_timeout: 300000
        },
        parallelization: {
          enabled: true,
          plan_level: true,
          task_level: false,
          skip_checkpoints: true,
          max_concurrent_agents: 3,
          min_plans_for_parallel: 2
        },
        git: {
          branching_strategy: "none",
          base_branch: null,
          phase_branch_template: "blu/phase-{phase}-{slug}",
          milestone_branch_template: "blu/{milestone}-{slug}",
          quick_branch_template: null
        },
        gates: {
          confirm_project: true,
          confirm_phases: true,
          confirm_roadmap: true,
          confirm_breakdown: true,
          confirm_plan: true,
          execute_next_plan: true,
          issues_review: true,
          confirm_transition: true
        },
        safety: {
          always_confirm_destructive: true,
          always_confirm_external_services: true
        },
        maintenance: {
          patch_registry: "~/.gemini/blueprint/patches",
          workspace_root: "~/blueprint-workspaces"
        },
        agent_skills: {}
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"),
    `# Phase 03: Phase Discovery - Context

## Decisions
- Planning should write execution-ready plan artifacts through MCP.
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-RESEARCH.md"),
    `# Phase 03: Phase Discovery - Research

**Researched:** 2026-04-11
**Domain:** plan-phase runtime
**Confidence:** HIGH

## Summary

- The plan-phase command needs first-class plan artifact tooling.

## Locked Decisions From Context

- Planning must preserve implemented-only routing and MCP-owned persistence.
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-UI-SPEC.md"),
    `# Phase 03: Phase Discovery - UI Spec

## Outcome Mode

- Explicit skip rationale
`,
    "utf8"
  );

  return repoPath;
}

function planContent(planId: string, wave: number, dependsOn: string[] = []): string {
  return `---
phase: 3
plan_id: "${planId}"
title: "Plan ${planId}"
wave: ${wave}
status: planned
objective: "Ship the plan-phase runtime."
depends_on: ${dependsOn.length === 0 ? "[]" : `[${dependsOn.join(", ")}]`}
requirements:
  - LIFE-01
files_modified:
  - src/mcp/tools/phase.ts
read_first:
  - src/mcp/tools/phase.ts
acceptance_criteria:
  - tests/phase-plan-write-locking.test.ts exits 0
autonomous: true
---

# Phase 03: Phase Discovery - Plan ${planId}

## Goal

Ship the plan-phase runtime.

## Scope

- Add phase plan indexing and writing support.

## Tasks

### Task 1: Add the MCP plan tools

#### Read First

- src/mcp/tools/phase.ts

#### Action

- Add Blueprint plan index, read, and write support with overwrite protection.

#### Acceptance Criteria

- src/mcp/tools/phase.ts contains blueprintPhasePlanWrite

## Verification

- npm test passes for phase planning coverage

## Must Haves

- The phase can persist execution-ready plans through MCP.
`;
}

function invalidDependsOnPlanContent(planId: string, wave: number): string {
  return planContent(planId, wave, ["bogus"]);
}

test("phase plan writes keep auto-assigned slots unique under the repo lock", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const concurrent = await Promise.all(
    Array.from({ length: 6 }, () =>
      blueprintPhasePlanWrite({
        cwd: repoPath,
        phase: 3,
        content: planContent("00", 1, []),
        overwrite: true
      })
    )
  );
  const index = await blueprintPhasePlanIndex({ cwd: repoPath, phase: 3 });

  assert.deepEqual(
    concurrent.map((result) => result.planId).sort(),
    ["01", "02", "03", "04", "05", "06"]
  );
  assert.ok(concurrent.every((result) => result.status === "created"));
  assert.deepEqual(
    index.plans.map((plan) => plan.planId),
    ["01", "02", "03", "04", "05", "06"]
  );
  for (const result of concurrent) {
    const written = await readFile(path.join(repoPath, result.path), "utf8");
    assert.match(written, new RegExp(`^---[\\s\\S]*?plan_id: "${result.planId}"`, "m"));
    assert.match(written, new RegExp(`^---[\\s\\S]*?title: "Plan ${result.planId}"`, "m"));
    assert.match(written, new RegExp(`^# Phase 03: Phase Discovery - Plan ${result.planId}$`, "m"));
    assert.doesNotMatch(written, /Plan 00/);
  }
});

test("phase plan indexing and reads surface malformed depends_on as invalid", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-01-PLAN.md"),
    invalidDependsOnPlanContent("01", 1),
    "utf8"
  );

  const index = await blueprintPhasePlanIndex({ cwd: repoPath, phase: 3 });
  const read = await blueprintPhasePlanRead({
    cwd: repoPath,
    phase: 3,
    planId: 1
  });

  assert.equal(index.plans.length, 1);
  assert.equal(index.plans[0]?.valid, false);
  assert.match(index.plans[0]?.issues.join("\n") ?? "", /invalid depends_on reference/i);
  assert.match(index.warnings.join("\n") ?? "", /invalid depends_on reference/i);
  assert.equal(read.validation?.valid, false);
  assert.match(read.validation?.issues.join("\n") ?? "", /invalid depends_on reference/i);
});
