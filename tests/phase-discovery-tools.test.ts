import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintArtifactScaffold } from "../src/mcp/tools/artifacts.js";
import {
  blueprintPhaseContext,
  blueprintPhaseLocate,
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
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
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
- Active command: /blu:progress
- Next action: Run /blu:progress
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

test("phase tools resolve roadmap-backed phase details and artifact paths", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

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
  assert.deepEqual(context.requirements, ["LIFE-01", "LIFE-02", "LIFE-03"]);
  assert.ok(
    context.missingArtifacts.includes(".blueprint/phases/03-phase-discovery/03-RESEARCH.md")
  );
  assert.equal(
    context.phase?.artifacts.context,
    ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"
  );
});

test("phase locate reports missing roadmap phases without escaping the Blueprint root", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const missing = await blueprintPhaseLocate({ cwd: repoPath, phase: "99" });

  assert.equal(missing.found, false);
  assert.match(missing.reason ?? "", /not found/i);
  assert.equal(missing.phaseDir, null);
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
  assert.equal(after.hasContext, true);
  assert.equal(after.hasResearch, true);
  assert.equal(after.hasUiSpec, true);
  assert.match(uiSpec, /Outcome Mode/);
});
