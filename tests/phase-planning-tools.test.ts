import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintProjectStatus } from "../src/mcp/tools/project.js";
import {
  blueprintPhasePlanIndex,
  blueprintPhasePlanRead,
  blueprintPhasePlanWrite
} from "../src/mcp/tools/phase.js";

async function createPhaseRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-plan-phase-"));
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
    validResearchContent(),
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-UI-SPEC.md"),
    `# Phase 03: Phase Discovery - UI Spec

## Outcome Mode

- Explicit skip rationale

## User Experience Goals

- No user-facing UI changes are in scope for this phase.
`,
    "utf8"
  );

  return repoPath;
}

function validResearchContent(): string {
  return `# Phase 03: Phase Discovery - Research

**Researched:** 2026-04-11
**Domain:** plan-phase runtime
**Confidence:** HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIFE-01 | Implement plan tooling. | Use MCP-owned plan indexing and validation. |

## Summary

- The plan-phase command needs first-class plan artifact tooling.

## Locked Decisions From Context

- Planning must preserve implemented-only routing and MCP-owned persistence.

## User Constraints

- Keep writes inside .blueprint/.

## Standard Stack

- TypeScript
- node:test via tsx --test

## Installation And Setup

- Run plan-phase fixtures after seeding context and research under .blueprint/phases/.

## Alternatives Considered

- Planner-generated fallback research was rejected because it weakens the discovery contract.

## Architecture Patterns

- Commands stay thin; MCP tools own persistence.

## Don't Hand-Roll

- Reuse existing phase resolution helpers and state sync flows.

## Anti-Patterns

- Letting plan generation normalize away missing or weak research evidence.

## State Of The Art

- Plan-phase consumes saved discovery artifacts through MCP-backed readiness checks.

## Common Pitfalls

- Accepting scaffold-only plans as real outputs.

## Open Questions

- Should future planning parity require explicit alternatives carry-forward in plan text?

## Confidence Breakdown

| Topic | Confidence | Why |
|-------|------------|-----|
| Planning readiness | HIGH | The fixture controls the exact research content supplied to the planner. |

## Code Examples

\`\`\`ts
await blueprintPhasePlanWrite({ phase: "3", content, overwrite: true });
\`\`\`

## Recommendations

- Validate every plan before treating it as execution-ready.

## Sources

- \`src/mcp/tools/phase.ts\` - current phase tool substrate.
`;
}

function validPlanContent(planId: string, wave: number, dependsOn: string[] = []): string {
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
  - tests/phase-planning-tools.test.ts exits 0
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

function hollowPlanContent(planId: string, wave: number): string {
  return `---
phase: 3
plan_id: "${planId}"
title: "Plan ${planId}"
wave: ${wave}
status: planned
objective: "Ship the plan-phase runtime."
depends_on: []
requirements:
  - LIFE-01
files_modified:
  - src/mcp/tools/phase.ts
read_first:
  - src/mcp/tools/phase.ts
acceptance_criteria:
  - tests/phase-planning-tools.test.ts exits 0
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

- Replace with the exact checks that prove this plan is complete.

## Must Haves

- Replace with the goal-backward must-haves this plan cannot drop.
`;
}

test("phase planning MCP tools are registered in the Blueprint server", () => {
  for (const toolName of [
    "blueprint_phase_plan_index",
    "blueprint_phase_plan_read",
    "blueprint_phase_plan_write"
  ]) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
  }
});

test("phase planning tools write, read, and index execution-ready plan artifacts", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const beforeStatus = await blueprintProjectStatus({ cwd: repoPath });
  const created = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    content: validPlanContent("01", 1),
    overwrite: true
  });
  const second = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    content: validPlanContent("02", 2, ["01"]),
    overwrite: true
  });
  const index = await blueprintPhasePlanIndex({ cwd: repoPath, phase: "03" });
  const readFirstPlan = await blueprintPhasePlanRead({
    cwd: repoPath,
    phase: "3",
    planId: "1"
  });
  const reused = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    content: validPlanContent("01", 1)
  });
  const invalid = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "02",
    content: "# invalid plan\n",
    overwrite: true
  });
  const afterStatus = await blueprintProjectStatus({ cwd: repoPath });
  const writtenBody = await readFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-02-PLAN.md"),
    "utf8"
  );

  assert.match(beforeStatus.nextAction, /\/blu-plan-phase 3/);
  assert.equal(created.status, "created");
  assert.equal(second.status, "created");
  assert.equal(index.plans.length, 2);
  assert.deepEqual(index.waves["1"], [
    ".blueprint/phases/03-phase-discovery/03-01-PLAN.md"
  ]);
  assert.deepEqual(index.waves["2"], [
    ".blueprint/phases/03-phase-discovery/03-02-PLAN.md"
  ]);
  assert.deepEqual(index.missingPlans, []);
  assert.equal(readFirstPlan.found, true);
  assert.equal(readFirstPlan.validation?.valid, true);
  assert.equal(reused.status, "reused");
  assert.equal(invalid.status, "invalid");
  assert.match(invalid.validation.issues.join("\n"), /frontmatter|required section/i);
  assert.match(afterStatus.nextAction, /\/blu-execute-phase 3/);
  assert.match(writtenBody, /Plan 02/);
});

test("phase planning strict writes reject hollow verification and must-have sections", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const warned = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "03",
    content: hollowPlanContent("03", 3),
    overwrite: true,
    validationMode: "warn"
  });
  const warnedRead = await blueprintPhasePlanRead({
    cwd: repoPath,
    phase: "3",
    planId: "03"
  });
  const rejected = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "04",
    content: hollowPlanContent("04", 4),
    overwrite: true
  });

  assert.equal(warned.status, "created");
  assert.equal(warned.validation?.valid, false);
  assert.match(warned.validation?.issues.join("\n") ?? "", /Verification/);
  assert.match(warned.validation?.issues.join("\n") ?? "", /Must Haves/);
  assert.equal(warnedRead.validation?.valid, false);
  assert.match(warnedRead.validation?.issues.join("\n") ?? "", /Verification/);
  assert.match(warnedRead.validation?.issues.join("\n") ?? "", /Must Haves/);
  assert.equal(rejected.status, "invalid");
  assert.equal(rejected.validation?.valid, false);
  assert.match(rejected.validation?.issues.join("\n") ?? "", /Verification/);
  assert.match(rejected.validation?.issues.join("\n") ?? "", /Must Haves/);
});

test("phase planning writes reject plan_id values that disagree with the target plan slot", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const mismatchedWrite = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    content: validPlanContent("02", 1),
    overwrite: true
  });
  const created = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "02",
    content: validPlanContent("02", 2),
    overwrite: true
  });
  const mismatchedReuse = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: 2,
    content: validPlanContent("03", 2)
  });

  assert.equal(mismatchedWrite.status, "invalid");
  assert.match(mismatchedWrite.validation?.issues.join("\n") ?? "", /must match the requested planId/i);
  assert.equal(created.status, "created");
  assert.equal(mismatchedReuse.status, "invalid");
  assert.match(mismatchedReuse.validation?.issues.join("\n") ?? "", /must match the requested planId/i);
});

test("phase planning tools accept numeric phase and plan identifiers from runtime callers", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const created = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: 3,
    planId: 1,
    content: validPlanContent("01", 1),
    overwrite: true
  });
  const read = await blueprintPhasePlanRead({
    cwd: repoPath,
    phase: "03-phase-discovery",
    planId: 1
  });
  const index = await blueprintPhasePlanIndex({ cwd: repoPath, phase: 3 });

  assert.equal(created.planId, "01");
  assert.equal(created.phaseNumber, "3");
  assert.equal(read.found, true);
  assert.equal(read.planId, "01");
  assert.deepEqual(index.plans.map((plan) => plan.planId), ["01"]);
});
