import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import {
  CODEBASE_ARTIFACTS,
  blueprintArtifactScaffold,
  blueprintCodebaseArtifactWrite
} from "../src/mcp/tools/artifacts.js";
import {
  phaseToolDefinitions,
  blueprintPhaseCheckpointDelete,
  blueprintPhaseCheckpointGet,
  blueprintPhaseContext,
  blueprintPhaseCheckpointPut,
  blueprintPhaseLocate,
  blueprintPhasePlanIndex,
  blueprintPhaseResearchStatus,
  blueprintRoadmapRead
} from "../src/mcp/tools/phase.js";

async function createPhaseRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-phase-tools-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/PROJECT.md"),
    `# Project: Blueprint Phase Discovery

## Vision

- Capture durable phase context before planning starts.

## Audience

- Blueprint operators
- Future planning agents

## Constraints

- Keep persistent state inside .blueprint/.
- Keep commands thin and MCP-owned.

## Current Milestone

- v1

## Non-Goals

- Do not mutate command manifests from discovery.
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/REQUIREMENTS.md"),
    `# Requirements: Blueprint Discovery Traceability

## Requirements Table

| ID | Scope | Requirement | Status | Notes |
|----|-------|-------------|--------|-------|
| LIFE-01 | committed | Capture real discovery context before planning. | ready | Use actual repository evidence. |
| LIFE-02 | committed | Ground questions in project and requirements docs. | ready | Keep prompt-facing contracts truthful. |
| LIFE-03 | committed | Surface workflow posture before asking follow-up questions. | ready | Use effective config and state. |

## Traceability Notes

- Discovery should point at the canonical project brief and workflow posture.

## Acceptance Notes

- Phase context output should tell the model which requirements matter now.

## Deferred Items

- Follow-up contract refinements can happen after the grounded snapshot exists.
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Fixture

## Milestone

- Active milestone: v1

## Phases

- [x] **Phase 2: Router Health**
- [ ] **Phase 3: Phase Discovery** - Add the discovery command slice

## Phase Details

### Phase 3: Phase Discovery
**Goal**: Add discovery tooling.
**Success Criteria**: Planner sees roadmap goal and readiness gates before writing.
**Requirements**: LIFE-01, LIFE-02, LIFE-03
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 3
- Active command: /blu-discuss-phase
- Next action: Run /blu-discuss-phase 3 to rebuild the current phase context
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

  return repoPath;
}

async function writeMappedCodebaseBundle(repoPath: string): Promise<void> {
  const authoredBundle: Record<
    | "codebase.stack"
    | "codebase.architecture"
    | "codebase.structure"
    | "codebase.conventions"
    | "codebase.testing"
    | "codebase.integrations"
    | "codebase.concerns",
    string
  > = {
    "codebase.stack": "# Stack\n\nTypeScript runtime with MCP-facing tooling.\n",
    "codebase.architecture":
      "# Architecture\n\nMCP tools and command manifests anchor the runtime layout.\n",
    "codebase.structure":
      "# Structure\n\nBlueprint runtime code lives in src/, with tests under tests/.\n",
    "codebase.conventions":
      "# Conventions\n\nBlueprint keeps runtime tool names explicit and persistence inside MCP.\n",
    "codebase.testing":
      "# Testing\n\nThe repo uses node:test via tsx and fixture-backed integration coverage.\n",
    "codebase.integrations":
      "# Integrations\n\nThe runtime integrates through @modelcontextprotocol/sdk and related command surfaces.\n",
    "codebase.concerns":
      "# Concerns\n\nPlaceholder codebase docs should not be treated as authoritative mapped context.\n"
  };

  for (const [artifactId, content] of Object.entries(authoredBundle)) {
    const result = await blueprintCodebaseArtifactWrite({
      cwd: repoPath,
      artifactId: artifactId as keyof typeof authoredBundle,
      content
    });
    assert.notEqual(result.status, "invalid", JSON.stringify(result));
  }
}

function validContextContent(): string {
  return `# Phase 03: Phase Discovery - Context

## Phase Boundary
- Keep discovery scoped to phase 3 and the saved artifacts in .blueprint/phases/03-phase-discovery/.
- Capture durable context before planning begins.
- Preserve implemented-only routing for the next lifecycle step.

## Discovery Grounding
- Project brief - discovery should stay phase-scoped and resumable.
- Requirements grounding - keep LIFE-01, LIFE-02, and LIFE-03 visible to downstream planning.
- Workflow posture - route through enabled research and UI gates before planning.
- Prior-context sweep - review existing artifacts before asking fresh questions.

## Implementation Decisions
- Use the refreshed state next action as the end-of-discussion handoff.
- Do not infer a direct plan-phase route when enabled gates still require research or UI artifacts.
- Keep MCP tools responsible for durable state updates and routing.

## Specific Ideas
- Make planning readiness explicit so command prompts do not guess from missing artifact lists.

## Existing Code Insights
- The state loader already derives next action from effective workflow config.
- The research-status tool can expose the same gate to plan-phase.

## Dependencies
- .blueprint/STATE.md controls the final handoff after discuss-phase.
- .blueprint/config.json controls whether research and UI artifacts are required before planning.

## Open Questions
- None that block this fixture.

## Deferred Ideas
- Broader lifecycle routing cleanup can happen outside this regression.

## Canonical References
- .blueprint/ROADMAP.md defines phase 3.
- .blueprint/config.json defines workflow gates.
`;
}

async function createLegacyDecimalPhaseRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-phase-tools-legacy-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(path.join(repoPath, ".blueprint/phases/01-legacy-bootstrap"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Legacy Fixture

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 1.0: Legacy Bootstrap** - Old whole-number decimal format

## Phase Details

### Phase 1.0: Legacy Bootstrap
**Goal**: Preserve compatibility for older roadmaps.
**Requirements**: LEG-01
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 1.0
- Active command: /blu-progress
- Next action: Run /blu-progress
- Last updated: 2026-04-13T00:00:00.000Z

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

  return repoPath;
}

test("phase discovery MCP tools are registered in the Blueprint server", () => {
  for (const toolName of [
    "blueprint_roadmap_read",
    "blueprint_phase_locate",
    "blueprint_phase_context",
    "blueprint_phase_research_status"
  ]) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
  }
});

test("phase lifecycle tool schemas accept numeric JSON phase refs and plan ids", () => {
  const tool = (name: string) => phaseToolDefinitions.find((definition) => definition.name === name);

  for (const toolName of [
    "blueprint_phase_plan_index",
    "blueprint_phase_execution_targets",
    "blueprint_phase_plan_validate",
    "blueprint_phase_artifact_read",
    "blueprint_phase_artifact_write",
    "blueprint_phase_validation_read",
    "blueprint_phase_validation_write",
    "blueprint_phase_checkpoint_get",
    "blueprint_phase_checkpoint_put",
    "blueprint_phase_checkpoint_delete",
    "blueprint_phase_summary_index"
  ]) {
    const definition = tool(toolName);
    assert.ok(definition, `${toolName} should exist`);
    assert.equal(definition.inputSchema.phase.safeParse(3).success, true, `${toolName} should accept numeric phase refs`);
  }

  const executionTargets = tool("blueprint_phase_execution_targets");
  assert.ok(executionTargets, "blueprint_phase_execution_targets should exist");
  assert.equal(executionTargets.inputSchema.wave.safeParse(2).success, true, "blueprint_phase_execution_targets should accept numeric waves");
  assert.equal(executionTargets.inputSchema.gapsOnly.safeParse(true).success, true, "blueprint_phase_execution_targets should accept gapsOnly");

  for (const toolName of [
    "blueprint_phase_plan_read",
    "blueprint_phase_plan_write",
    "blueprint_phase_summary_read",
    "blueprint_phase_summary_write"
  ]) {
    const definition = tool(toolName);
    assert.ok(definition, `${toolName} should exist`);
    assert.equal(definition.inputSchema.planId.safeParse(3).success, true, `${toolName} should accept numeric plan ids`);
  }
});

test("phase tools resolve roadmap-backed phase details and artifact paths", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [
      ".blueprint/phases/03-phase-discovery/03-CONTEXT.md",
      ...CODEBASE_ARTIFACTS
    ]
  });
  await writeMappedCodebaseBundle(repoPath);

  const roadmap = await blueprintRoadmapRead({ cwd: repoPath });
  const located = await blueprintPhaseLocate({ cwd: repoPath, phase: "03" });
  const context = await blueprintPhaseContext({ cwd: repoPath, phase: "3" });

  assert.equal(roadmap.milestone, "v1");
  assert.equal(roadmap.phases.at(-1)?.phaseNumber, "3");
  assert.equal(roadmap.phases.at(-1)?.phasePrefix, "03");
  assert.equal(located.found, true);
  assert.equal(located.phaseName, "Phase Discovery");
  assert.equal(located.phaseDir, ".blueprint/phases/03-phase-discovery");
  assert.ok(
    located.artifacts.includes(".blueprint/phases/03-phase-discovery/03-CONTEXT.md")
  );
  assert.deepEqual(context.phase?.roadmap, {
    completed: false,
    summary: "Add the discovery command slice",
    goal: "Add discovery tooling.",
    successCriteria: "Planner sees roadmap goal and readiness gates before writing."
  });
  assert.equal(context.projectBrief.found, true);
  assert.equal(context.projectBrief.title, "Project: Blueprint Phase Discovery");
  assert.ok(context.projectBrief.summary.includes("Capture durable phase context"));
  assert.deepEqual(context.projectBrief.vision, [
    "Capture durable phase context before planning starts."
  ]);
  assert.deepEqual(context.requirementsGrounding.canonicalRequirementIds, [
    "LIFE-01",
    "LIFE-02",
    "LIFE-03"
  ]);
  assert.deepEqual(context.requirementsGrounding.roadmapRequirementIds, [
    "LIFE-01",
    "LIFE-02",
    "LIFE-03"
  ]);
  assert.match(context.requirementsGrounding.summary, /canonical requirements: LIFE-01, LIFE-02, LIFE-03/);
  assert.equal(context.workflowPosture.projectStatus, "initialized");
  assert.equal(context.workflowPosture.currentPhase, "3");
  assert.equal(context.workflowPosture.nextAction, "Run /blu-research-phase 3 to capture phase research");
  assert.equal(context.workflowPosture.workflow.discussMode, "discuss");
  assert.equal(context.workflowPosture.workflow.skipDiscuss, false);
  assert.equal(context.workflowPosture.workflow.researchBeforeQuestions, false);
  assert.deepEqual(context.requirements, ["LIFE-01", "LIFE-02", "LIFE-03"]);
  assert.ok(
    context.missingArtifacts.includes(".blueprint/phases/03-phase-discovery/03-RESEARCH.md")
  );
  assert.equal(
    context.phase?.artifacts.context,
    ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"
  );
  assert.equal(context.codebase.mapped, true);
  assert.ok(context.codebase.artifacts.includes(".blueprint/codebase/ARCHITECTURE.md"));
  assert.equal(context.codebase.digest.length, CODEBASE_ARTIFACTS.length);
  assert.match(
    context.codebase.digest.find((entry) => entry.artifact.endsWith("ARCHITECTURE.md"))?.summary ?? "",
    /MCP tools and command manifests anchor the runtime layout/i
  );
  assert.match(context.warnings.join("\n"), /Mapped codebase summaries are available/i);
});

test("phase locate reports missing roadmap phases without escaping the Blueprint root", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const missing = await blueprintPhaseLocate({ cwd: repoPath, phase: "99" });

  assert.equal(missing.found, false);
  assert.match(missing.reason ?? "", /not found/i);
  assert.ok(missing.recovery.length > 0);
  assert.equal(missing.phaseDir, null);
});

test("phase locate resolves integer requests against legacy whole-number decimal roadmap entries", async (t) => {
  const repoPath = await createLegacyDecimalPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const roadmap = await blueprintRoadmapRead({ cwd: repoPath });
  const located = await blueprintPhaseLocate({ cwd: repoPath, phase: "1" });

  assert.equal(roadmap.phases[0]?.phaseNumber, "1");
  assert.equal(roadmap.phases[0]?.phasePrefix, "01");
  assert.equal(located.found, true);
  assert.equal(located.phaseNumber, "1");
  assert.equal(located.phasePrefix, "01");
  assert.equal(located.phaseDir, ".blueprint/phases/01-legacy-bootstrap");
});

test("phase research status reflects context, research, and UI-spec presence", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const before = await blueprintPhaseResearchStatus({ cwd: repoPath, phase: "3" });
  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [
      ".blueprint/phases/03-phase-discovery/03-CONTEXT.md",
      ".blueprint/phases/03-phase-discovery/03-RESEARCH.md",
      ".blueprint/phases/03-phase-discovery/03-UI-SPEC.md"
    ]
  });
  const after = await blueprintPhaseResearchStatus({ cwd: repoPath, phase: "03" });
  const uiSpec = await readFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-UI-SPEC.md"),
    "utf8"
  );

  assert.equal(before.hasContext, false);
  assert.equal(before.hasResearch, false);
  assert.equal(before.hasUiSpec, false);
  assert.equal(before.hasUsableContext, false);
  assert.equal(before.hasUsableResearch, false);
  assert.equal(before.hasUsableUiSpec, false);
  assert.equal(before.contextValid, null);
  assert.equal(before.uiSpecValid, null);
  assert.equal(after.hasContext, true);
  assert.equal(after.hasResearch, true);
  assert.equal(after.hasUiSpec, true);
  assert.equal(after.hasUsableContext, false);
  assert.equal(after.hasUsableResearch, false);
  assert.equal(after.hasUsableUiSpec, false);
  assert.equal(after.contextValid, false);
  assert.equal(after.researchValid, false);
  assert.equal(after.uiSpecValid, false);
  assert.match(after.contextIssues.join("\n"), /placeholder/i);
  assert.match(after.researchIssues.join("\n"), /placeholder/i);
  assert.match(after.uiSpecIssues.join("\n"), /placeholder|Outcome Mode/i);
  assert.match(after.suggestedRepairs.join("\n"), /discuss-phase/i);
  assert.match(after.suggestedRepairs.join("\n"), /ui-phase/i);
  assert.match(uiSpec, /Outcome Mode/);
});

test("phase research status exposes config-aware plan-phase readiness", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"),
    validContextContent(),
    "utf8"
  );

  const defaultStatus = await blueprintPhaseResearchStatus({ cwd: repoPath, phase: "3" });

  assert.equal(defaultStatus.hasUsableContext, true);
  assert.equal(defaultStatus.hasResearch, false);
  assert.equal(defaultStatus.hasUiSpec, false);
  assert.equal(defaultStatus.planningReadiness.workflowResearchRequired, true);
  assert.equal(defaultStatus.planningReadiness.workflowUiPhaseRequired, true);
  assert.equal(defaultStatus.planningReadiness.readyForPlanPhase, false);
  assert.equal(
    defaultStatus.planningReadiness.nextSafeAction,
    "Run /blu-research-phase 3 to capture phase research"
  );
  assert.match(defaultStatus.planningReadiness.blockers.join("\n"), /workflow\.research=true/);

  const configPath = path.join(repoPath, ".blueprint/config.json");
  const config = JSON.parse(await readFile(configPath, "utf8")) as {
    workflow: { research: boolean; ui_phase: boolean };
  };
  config.workflow.research = false;
  config.workflow.ui_phase = false;
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  const disabledGateStatus = await blueprintPhaseResearchStatus({ cwd: repoPath, phase: "3" });

  assert.equal(disabledGateStatus.planningReadiness.workflowResearchRequired, false);
  assert.equal(disabledGateStatus.planningReadiness.workflowUiPhaseRequired, false);
  assert.equal(disabledGateStatus.planningReadiness.readyForPlanPhase, true);
  assert.equal(
    disabledGateStatus.planningReadiness.nextSafeAction,
    "Run /blu-plan-phase 3 to create execution-ready phase plans"
  );
  assert.deepEqual(disabledGateStatus.planningReadiness.blockers, []);
});

test("phase research status returns warnings instead of throwing for unreadable saved research paths", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await symlink(
    "missing-research-target.md",
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-RESEARCH.md")
  );

  const status = await blueprintPhaseResearchStatus({ cwd: repoPath, phase: "3" });

  assert.equal(status.hasResearch, true);
  assert.equal(status.researchValid, false);
  assert.match(status.researchIssues.join("\n"), /could not be read/i);
  assert.match(status.warnings.join("\n"), /stale|deleted|unreadable/i);
  assert.match(status.suggestedRepairs.join("\n"), /restore or regenerate/i);
});

test("phase plan indexing and checkpoint persistence accept numeric inputs with the richer resumability shape", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const checkpoint = await blueprintPhaseCheckpointPut({
    cwd: repoPath,
    phase: 3,
    checkpoint: {
      ownerCommand: "/blu-discuss-phase",
      completedAreas: ["Phase boundary and discovery grounding"],
      remainingAreas: ["Dependency scan", "Open questions"],
      decisions: [
        {
          topic: "Scope",
          decision: "Keep discuss-phase focused on discovery boundary",
          rationale: "The checkpoint needs to resume the next discovery question quickly."
        }
      ],
      deferredIdeas: [
        {
          idea: "Revisit alias cleanup",
          reason: "It is outside the current discovery boundary.",
          revisitWhen: "After the phase context is captured"
        }
      ],
      canonicalReferences: [
        {
          label: "Project brief",
          target: ".blueprint/PROJECT.md",
          note: "Canonical project intent"
        },
        {
          label: "Requirements",
          target: ".blueprint/REQUIREMENTS.md"
        }
      ],
      resumeMeta: {
        mode: "discuss",
        pendingTopics: ["Open questions"],
        completedTopics: ["Phase boundary"],
        currentQuestion: "What still needs to be grounded before planning starts?",
        notes: ["Capture the durable context before moving on."],
        resumeHint: "Resume with the remaining discovery questions.",
        updatedAt: "2026-04-19T00:00:00.000Z"
      }
    }
  });
  const indexed = await blueprintPhasePlanIndex({ cwd: repoPath, phase: 3 });

  assert.equal(checkpoint.updated, true);
  assert.equal(checkpoint.path, ".blueprint/phases/03-phase-discovery/03-DISCUSS-CHECKPOINT.json");
  assert.equal(indexed.phaseFound, true);
  assert.deepEqual(indexed.missingPlans, [
    ".blueprint/phases/03-phase-discovery/03-01-PLAN.md"
  ]);
});

test("checkpoint persistence rejects legacy-style resumability fragments without the stronger shape", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await assert.rejects(
    blueprintPhaseCheckpointPut({
      cwd: repoPath,
      phase: 3,
      checkpoint: {
        mode: "discuss",
        pendingTopics: ["Scope boundaries"],
        completedTopics: ["Phase boundary"],
        updatedAt: "2026-04-19T00:00:00.000Z"
      }
    }),
    /structured discuss checkpoint/i
  );
});

test("checkpoint reads remain compatible with legacy object-shaped saves", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const checkpointPath = path.join(
    repoPath,
    ".blueprint/phases/03-phase-discovery/03-DISCUSS-CHECKPOINT.json"
  );
  const legacyCheckpoint = {
    mode: "discuss",
    pendingTopics: ["Scope boundaries"],
    currentQuestion: "What remains to be clarified?",
    updatedAt: "2026-04-19T00:00:00.000Z"
  };

  await writeFile(checkpointPath, `${JSON.stringify(legacyCheckpoint, null, 2)}\n`, "utf8");

  const checkpoint = await blueprintPhaseCheckpointGet({ cwd: repoPath, phase: 3 });

  assert.equal(checkpoint.found, true);
  assert.deepEqual(checkpoint.checkpoint, legacyCheckpoint);
});

test("checkpoint writes refuse to overwrite a foreign shared checkpoint", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintPhaseCheckpointPut({
    cwd: repoPath,
    phase: 3,
    checkpoint: {
      ownerCommand: "/blu-discuss-phase",
      completedAreas: ["Scope boundaries"],
      remainingAreas: ["Open questions"],
      decisions: [],
      deferredIdeas: [],
      canonicalReferences: [],
      resumeMeta: {
        mode: "discuss",
        pendingTopics: ["Open questions"],
        completedTopics: ["Scope boundaries"],
        notes: [],
        updatedAt: "2026-04-19T00:00:06.000Z"
      }
    }
  });

  await assert.rejects(
    blueprintPhaseCheckpointPut({
      cwd: repoPath,
      phase: 3,
      checkpoint: {
        ownerCommand: "/blu-research-phase",
        completedAreas: ["Dependency scan"],
        remainingAreas: ["Recommendation synthesis"],
        decisions: [],
        deferredIdeas: [],
        canonicalReferences: [],
        resumeMeta: {
          mode: "research",
          pendingTopics: ["Recommendation synthesis"],
          completedTopics: ["Dependency scan"],
          notes: [],
          updatedAt: "2026-04-19T00:00:07.000Z"
        }
      }
    }),
    /Refusing to overwrite .*belongs to \/blu-discuss-phase, not \/blu-research-phase/i
  );
});

test("checkpoint delete refuses to remove a foreign shared checkpoint when owner or mode is expected", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintPhaseCheckpointPut({
    cwd: repoPath,
    phase: 3,
    checkpoint: {
      ownerCommand: "/blu-research-phase",
      completedAreas: ["Dependency scan"],
      remainingAreas: ["Recommendation synthesis"],
      decisions: [],
      deferredIdeas: [],
      canonicalReferences: [],
      resumeMeta: {
        mode: "research",
        pendingTopics: ["Recommendation synthesis"],
        completedTopics: ["Dependency scan"],
        notes: [],
        updatedAt: "2026-04-19T00:00:08.000Z"
      }
    }
  });

  const deleted = await blueprintPhaseCheckpointDelete({
    cwd: repoPath,
    phase: 3,
    expectedOwnerCommand: "/blu-discuss-phase",
    expectedMode: "discuss"
  });
  const checkpoint = await blueprintPhaseCheckpointGet({ cwd: repoPath, phase: 3 });

  assert.equal(deleted.deleted, false);
  assert.match(
    deleted.reason ?? "",
    /Refusing to delete .*belongs to \/blu-research-phase, not \/blu-discuss-phase/i
  );
  assert.equal(checkpoint.found, true);
  assert.equal(checkpoint.ownerCommand, "/blu-research-phase");
});

test("checkpoint delete refuses unguarded deletion of a shared checkpoint", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintPhaseCheckpointPut({
    cwd: repoPath,
    phase: 3,
    checkpoint: {
      ownerCommand: "/blu-discuss-phase",
      completedAreas: ["Scope boundaries"],
      remainingAreas: ["Open questions"],
      decisions: [],
      deferredIdeas: [],
      canonicalReferences: [],
      resumeMeta: {
        mode: "discuss",
        pendingTopics: ["Open questions"],
        completedTopics: ["Scope boundaries"],
        notes: [],
        updatedAt: "2026-04-19T00:00:08.000Z"
      }
    }
  });

  const deleted = await blueprintPhaseCheckpointDelete({
    cwd: repoPath,
    phase: 3
  });
  const checkpoint = await blueprintPhaseCheckpointGet({ cwd: repoPath, phase: 3 });

  assert.equal(deleted.deleted, false);
  assert.match(
    deleted.reason ?? "",
    /without expectedOwnerCommand or expectedMode/i
  );
  assert.equal(checkpoint.found, true);
  assert.equal(checkpoint.ownerCommand, "/blu-discuss-phase");
});

test("checkpoint delete remains compatible with legacy mode-owned checkpoints", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const checkpointPath = path.join(
    repoPath,
    ".blueprint/phases/03-phase-discovery/03-DISCUSS-CHECKPOINT.json"
  );
  await writeFile(
    checkpointPath,
    `${JSON.stringify(
      {
        mode: "research",
        pendingTopics: ["Recommendation synthesis"],
        completedTopics: ["Dependency scan"],
        currentQuestion: "Which recommendation is still unverified?",
        updatedAt: "2026-04-19T00:00:09.000Z"
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const deleted = await blueprintPhaseCheckpointDelete({
    cwd: repoPath,
    phase: 3,
    expectedOwnerCommand: "/blu-research-phase",
    expectedMode: "research"
  });
  const checkpoint = await blueprintPhaseCheckpointGet({ cwd: repoPath, phase: 3 });

  assert.equal(deleted.deleted, true);
  assert.equal(checkpoint.found, false);
});

test("phase locate returns structured recovery when ROADMAP.md is missing", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await rm(path.join(repoPath, ".blueprint/ROADMAP.md"));

  const located = await blueprintPhaseLocate({ cwd: repoPath, phase: "3" });

  assert.equal(located.found, false);
  assert.match(located.reason ?? "", /Missing prerequisite artifact/);
  assert.ok(located.recovery.length > 0);
});

test("phase locate returns structured recovery when the roadmap phase directory is missing", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await rm(path.join(repoPath, ".blueprint/phases/03-phase-discovery"), {
    recursive: true,
    force: true
  });

  const located = await blueprintPhaseLocate({ cwd: repoPath, phase: "3" });

  assert.equal(located.found, false);
  assert.match(located.reason ?? "", /no matching directory/i);
  assert.ok(located.recovery.length > 0);
  assert.match(located.recovery.join("\n"), /restore the numbered phase directory|rebuild missing discovery artifacts/i);
});

test("phase locate returns structured recovery when multiple phase directories match", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery-copy"), {
    recursive: true
  });

  const located = await blueprintPhaseLocate({ cwd: repoPath, phase: "03" });

  assert.equal(located.found, false);
  assert.match(located.reason ?? "", /multiple matching directories/i);
  assert.ok(located.recovery.length > 0);
  assert.match(located.recovery.join("\n"), /rename duplicate phase directories|phase tree is normalized/i);
});
