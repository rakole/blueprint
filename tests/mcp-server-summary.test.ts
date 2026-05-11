import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import {
  BLUEPRINT_COMMAND_CATALOG_RESOURCE_URI,
  BLUEPRINT_COMMAND_RUNTIME_CONTRACT_URI_TEMPLATE,
  listBlueprintCommandRuntimeContractCommands
} from "../src/mcp/command-resources.js";
import { readArtifactContract } from "../src/mcp/artifact-contracts/index.js";
import { NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID } from "../src/mcp/command-runtime-metadata.js";
import { createBlueprintServer } from "../src/mcp/server.js";
import {
  blueprintToolRegistry,
  createToolResponseContent,
  sanitizeToolResultForPublicResponse,
  summarizeToolResult
} from "../src/mcp/server.js";
import {
  blueprintArtifactReportAuthoringContext,
  blueprintArtifactValidate
} from "../src/mcp/tools/artifacts.js";
import { blueprintConfigSetProfile } from "../src/mcp/tools/config.js";
import { blueprintProjectInit } from "../src/mcp/tools/project.js";
import { impactToolDefinitions } from "../src/mcp/tools/impact.js";
import {
  blueprintPhaseArtifactWrite,
  blueprintPhaseCheckpointDelete,
  blueprintPhaseCheckpointGet,
  blueprintPhaseCheckpointPut,
  blueprintPhasePlanWrite,
  blueprintPhaseResearchStatus
} from "../src/mcp/tools/phase.js";
import { blueprintReviewLoadFindings } from "../src/mcp/tools/review.js";
import { blueprintStateSync, blueprintStateUpdate } from "../src/mcp/tools/state.js";
import { blueprintWorkstreamList, blueprintWorkstreamMutate } from "../src/mcp/tools/workspace.js";
import { validPhaseContextModel } from "./helpers/context-model.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();
const impactFixtureBaseRepo = path.join(repoRoot, "tests/fixtures/impact/base-repo");

function expectedStructuredContentJson(result: Record<string, unknown>): string {
  return JSON.stringify(result);
}

async function runGit(args: string[], cwd?: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

async function withEnvOverrides<T>(
  overrides: Record<string, string | undefined>,
  callback: () => Promise<T>
): Promise<T> {
  const previousEntries = Object.fromEntries(
    Object.keys(overrides).map((key) => [key, process.env[key]])
  );

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previousEntries)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function createInstalledExtensionFixture(
  tempRoot: string,
  host: "gemini" | "tabnine" = "gemini"
): Promise<string> {
  const extensionPath = path.join(tempRoot, "installed-extension");
  const manifestFileName = host === "gemini" ? "gemini-extension.json" : "tabnine-extension.json";
  const contextFileName = host === "gemini" ? "GEMINI.md" : "TABNINE.md";

  await mkdir(extensionPath, { recursive: true });
  await writeFile(
    path.join(extensionPath, "package.json"),
    JSON.stringify(
      {
        name: "blueprint",
        version: "0.1.0"
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    path.join(extensionPath, manifestFileName),
    JSON.stringify(
      {
        name: "blueprint",
        version: "0.1.0",
        contextFileName
      },
      null,
      2
    ),
    "utf8"
  );

  return extensionPath;
}

async function createGitShim(tempRoot: string): Promise<string> {
  const binDir = path.join(tempRoot, "bin");
  const gitPath = path.join(binDir, "git");

  await mkdir(binDir, { recursive: true });
  await writeFile(
    gitPath,
    `#!/bin/sh
if [ "$1" = "-C" ] && [ "$3" = "branch" ] && [ "$4" = "--show-current" ]; then
  printf 'main\\n'
  exit 0
fi

if [ "$1" = "-C" ] && [ "$3" = "rev-parse" ] && [ "$4" = "HEAD" ]; then
  printf 'abc123\\n'
  exit 0
fi

if [ "$1" = "-C" ] && [ "$3" = "config" ] && [ "$4" = "--get" ] && [ "$5" = "remote.origin.url" ]; then
  printf 'https://github.com/example/blueprint.git\\n'
  exit 0
fi

if [ "$1" = "ls-remote" ] && [ "$2" = "--symref" ] && [ "$3" = "https://github.com/example/blueprint.git" ] && [ "$4" = "HEAD" ]; then
  printf 'ref: refs/heads/main\\tHEAD\\nabc123\\tHEAD\\n'
  exit 0
fi

echo "unexpected git args: $*" >&2
exit 1
`,
    { mode: 0o755 }
  );

  return binDir;
}

async function withMockFetch<T>(
  implementation: typeof globalThis.fetch,
  callback: () => Promise<T>
): Promise<T> {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = implementation;

  try {
    return await callback();
  } finally {
    globalThis.fetch = previousFetch;
  }
}

async function createImpactFixtureRepo(): Promise<string> {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "blueprint-impact-fixture-summary-"));

  await cp(impactFixtureBaseRepo, repoPath, { recursive: true });
  await runGit(["init"], repoPath);
  await runGit(["branch", "-M", "main"], repoPath);
  await runGit(["config", "user.email", "codex@example.com"], repoPath);
  await runGit(["config", "user.name", "Codex"], repoPath);
  await runGit(["add", "."], repoPath);
  await runGit(["commit", "-m", "baseline fixture"], repoPath);

  return repoPath;
}

async function createUninitializedProjectStatusRepo(): Promise<string> {
  return createGitRepo("blueprint-project-status-uninitialized-");
}

async function createCodeReviewSummaryRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-review-record-public-");
  const phaseDir = path.join(repoPath, ".blueprint/phases/05-review-scope");
  const codebaseDir = path.join(repoPath, ".blueprint/codebase");

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await mkdir(path.join(repoPath, "tests"), { recursive: true });
  await mkdir(phaseDir, { recursive: true });
  await mkdir(codebaseDir, { recursive: true });

  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Code Review Fixture

## Milestone

- Active milestone: v4

## Phases

- [x] **Phase 5: Review Scope** - Completed implementation ready for review

## Phase Details

### Phase 5: Review Scope
**Goal**: Review the repo files changed during the completed phase.
**Requirements**: REV-01
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v4
- Current phase: 5
- Active command: /blu-execute-phase
- Next action: Run /blu-code-review 5
- Last updated: 2026-04-13T00:00:00.000Z

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

  for (const artifact of [
    "STACK.md",
    "ARCHITECTURE.md",
    "STRUCTURE.md",
    "CONVENTIONS.md",
    "TESTING.md",
    "INTEGRATIONS.md",
    "CONCERNS.md"
  ]) {
    await writeFile(path.join(codebaseDir, artifact), `# ${artifact.replace(/\.md$/, "")}\n\n- mapped\n`, "utf8");
  }

  await writeFile(
    path.join(repoPath, "src/feature.ts"),
    "export function calculateValue(input: number) {\n  return input * 2;\n}\n",
    "utf8"
  );
  await writeFile(
    path.join(repoPath, "tests/feature.test.ts"),
    "import assert from 'node:assert/strict';\n\nassert.equal(2 * 2, 4);\n",
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-01-SUMMARY.md"),
    `# Phase 05: Code Review Scope - Summary 01

**Plan:** \`05-01-PLAN.md\`
**Status:** COMPLETED
**Readiness:** ready-for-validation
**Completion State:** complete
**Next Safe Action:** /blu-validate-phase 5

## Outcome

- Execution finished and produced a summary artifact.

## Changes Made

- Added the review-ready feature slice.

## Verification

| Check | Command | Result | Evidence | Notes |
|-------|---------|--------|----------|-------|
| tests/code-review-slice.test.ts exits 0 | npx tsx --test tests/code-review-slice.test.ts | pass | Ran the saved summary tooling slice. | The selected acceptance criterion passed. |

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
| artifact | .blueprint/phases/05-review-scope/05-01-SUMMARY.md | Saved summary artifact. |

## Files Changed

- src/feature.ts
- tests/feature.test.ts
`,
    "utf8"
  );

  return repoPath;
}

function executionTargetsPlanContent(planId: string, wave: number): string {
  return `---
phase: 3
plan_id: "${planId}"
title: "Execution Plan ${planId}"
wave: ${wave}
status: planned
objective: "Ship the execution target selection."
depends_on: []
requirements:
  - EXEC-01
files_modified:
  - src/mcp/server.ts
read_first:
  - src/mcp/server.ts
acceptance_criteria:
  - Public MCP responses trim derivable duplicate arrays only.
autonomous: true
---

# Phase 03: Execution Targets - Plan ${planId}

## Goal

Ship the execution target selection.

## Scope

- Keep the handler payload intact while trimming redundant public MCP fields.

## Tasks

### Task 1: Select targets

#### Read First

- src/mcp/server.ts

#### Action

- Ensure execution targets stay routable with plan-aware metadata.

#### Acceptance Criteria

- The selected and candidate plan arrays remain execution-ready.

## Verification

- The MCP server trims only derivable duplicate arrays in public responses.

## Must Haves

- Preserve direct handler output for downstream callers.

## Requirement Coverage

| Requirement | Planned Coverage | Evidence |
| --- | --- | --- |
| EXEC-01 | Verify direct handler and public MCP boundaries independently. | tests/mcp-server-summary.test.ts |

## Evidence Coverage

| Evidence | How It Will Be Produced | Owner |
| --- | --- | --- |
| Target selection output | Call the execution-target tool directly and through the MCP server. | Blueprint MCP tests |

## File / Surface Coverage

| File / Surface | Expected Change | Verification |
| --- | --- | --- |
| src/mcp/server.ts | Public response trimming only. | tests/mcp-server-summary.test.ts |

## Unknowns And Deferrals

| Unknown / Deferral | Handling | Follow-Up |
| --- | --- | --- |
| none | none | none |
`;
}

async function createPhaseExecutionTargetsRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-mcp-phase-execution-targets-");
  const phaseDir = path.join(repoPath, ".blueprint/phases/03-execution-targets");

  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Execution Target Fixture

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 3: Execution Targets** - Select the next runnable plan set
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 3
- Active command: /blu-execute-phase
- Next action: Run /blu-execute-phase 3
- Last updated: 2026-05-09T00:00:00.000Z

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
    path.join(phaseDir, "03-01-PLAN.md"),
    executionTargetsPlanContent("01", 1),
    "utf8"
  );

  return repoPath;
}

async function writeReviewLoadFindingsArtifact(
  repoPath: string,
  content: string
): Promise<string> {
  const artifactPath = path.join(
    repoPath,
    ".blueprint/phases/05-review-scope/05-REVIEW.md"
  );

  await writeFile(artifactPath, content, "utf8");

  return artifactPath;
}

async function writeEmptyReviewLoadFindingsArtifact(repoPath: string): Promise<string> {
  return writeReviewLoadFindingsArtifact(
    repoPath,
    `# Phase 05: Review Scope - Code Review

## Findings

- none

## Follow-Ups

- none
`
  );
}

async function writePopulatedReviewLoadFindingsArtifact(repoPath: string): Promise<string> {
  return writeReviewLoadFindingsArtifact(
    repoPath,
    `# Phase 05: Review Scope - Code Review

## Findings

- [REV-01] \`src/feature.ts:1\` Fix/verification: Add a regression test for calculateValue before changing behavior.

## Follow-Ups

- Add the regression test before refactoring.
`
  );
}

async function createRoadmapReadRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-roadmap-read-public-");

  await mkdir(path.join(repoPath, ".blueprint/phases/01-discovery"), { recursive: true });
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Public Trim Fixture

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 1: Discovery** - Map the current defect surface

## Phase Details

### Phase 1: Discovery
**Goal**: Map the current defect surface.
**Requirements**: DEF-01
`,
    "utf8"
  );

  return repoPath;
}

async function createPhaseContextTrimRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-phase-context-public-");
  const phaseDir = path.join(repoPath, ".blueprint/phases/01-discovery");
  const codebaseDir = path.join(repoPath, ".blueprint/codebase");

  await mkdir(phaseDir, { recursive: true });
  await mkdir(codebaseDir, { recursive: true });
  await writeFile(
    path.join(repoPath, ".blueprint/PROJECT.md"),
    `# Project

## Vision

- Capture the current defect surface.
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/REQUIREMENTS.md"),
    `# Requirements

## Requirements Table

| ID | Requirement | Status | Notes |
| --- | --- | --- | --- |
| DEF-01 | Capture the current defect surface. | active | Fixture requirement. |
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Phase Context Trim Fixture

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 1: Discovery** - Map the current defect surface

## Phase Details

### Phase 1: Discovery
**Goal**: Map the current defect surface.
**Requirements**: DEF-01
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 1
- Active command: /blu-discuss-phase
- Next action: Run /blu-discuss-phase 1
- Last updated: 2026-05-09T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    `${JSON.stringify(
      {
        version: 2,
        workflow: {
          research: true,
          plan_check: true,
          verifier: true,
          nyquist_validation: true,
          ui_phase: true,
          ui_safety_gate: true,
          code_review: true,
          auto_advance: false,
          research_before_questions: false,
          discuss_mode: "full",
          skip_discuss: false,
          use_worktrees: true
        },
        research: {
          external_sources: "allowed"
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  for (const artifact of [
    "STACK.md",
    "ARCHITECTURE.md",
    "STRUCTURE.md",
    "CONVENTIONS.md",
    "TESTING.md",
    "INTEGRATIONS.md",
    "CONCERNS.md"
  ]) {
    await writeFile(
      path.join(codebaseDir, artifact),
      `# ${artifact.replace(/\.md$/, "")}\n\n- mapped\n`,
      "utf8"
    );
  }

  return repoPath;
}

async function createReviewScopeRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-review-scope-public-");
  const phaseDir = path.join(repoPath, ".blueprint/phases/05-review-scope");
  const codebaseDir = path.join(repoPath, ".blueprint/codebase");
  const planFilesModified = ["src/plan.ts", "tests/plan.test.ts"];
  const summaryChangedFiles = ["src/summary.ts"];

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await mkdir(path.join(repoPath, "tests"), { recursive: true });
  await mkdir(phaseDir, { recursive: true });
  await mkdir(codebaseDir, { recursive: true });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Code Review Fixture

## Milestone

- Active milestone: v4

## Phases

- [x] **Phase 5: Review Scope** - Completed implementation ready for review

## Phase Details

### Phase 5: Review Scope
**Goal**: Review the repo files changed during the completed phase.
**Requirements**: REV-01
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v4
- Current phase: 5
- Active command: /blu-execute-phase
- Next action: Run /blu-code-review 5
- Last updated: 2026-04-13T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    `${JSON.stringify(
      {
        version: 2,
        workflow: {
          code_review: true,
          code_review_depth: "standard"
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  for (const artifact of [
    "STACK.md",
    "ARCHITECTURE.md",
    "STRUCTURE.md",
    "CONVENTIONS.md",
    "TESTING.md",
    "INTEGRATIONS.md",
    "CONCERNS.md"
  ]) {
    await writeFile(
      path.join(codebaseDir, artifact),
      `# ${artifact.replace(/\.md$/, "")}\n\n- mapped\n`,
      "utf8"
    );
  }

  for (const candidateFile of [...summaryChangedFiles, ...planFilesModified]) {
    const absolutePath = path.join(repoPath, candidateFile);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(
      absolutePath,
      `export const ${path.basename(candidateFile, path.extname(candidateFile)).replace(/[^a-zA-Z0-9_]/g, "_")} = true;\n`,
      "utf8"
    );
  }

  await writeFile(
    path.join(phaseDir, "05-01-PLAN.md"),
    `---
phase: 5
plan_id: "01"
title: "Code Review Scope"
wave: 4
status: done
objective: "Review the changed repo files."
depends_on: []
requirements:
  - REV-01
files_modified:
  - src/plan.ts
  - tests/plan.test.ts
read_first:
  - src/feature.ts
acceptance_criteria:
  - rg "calculateValue" src/feature.ts
autonomous: true
---

# Phase 05: Code Review Scope - Plan 01

## Goal

Review the changed repo files.

## Scope

- Source plus tests only.

## Tasks

### Task 1

#### Read First

- src/feature.ts

#### Action

- Review the changed code.

#### Acceptance Criteria

- rg "calculateValue" src/feature.ts

## Verification

- Confirm the review scope excludes Blueprint artifacts.

## Must Haves

- Keep review scope deterministic.

## Requirement Coverage

| Requirement | Status | Covered By Tasks | Evidence | Rationale |
|-------------|--------|------------------|----------|-----------|
| REV-01 | covered | task-1 | tests/code-review-slice.test.ts | The review scope fixture covers the declared review requirement. |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| src/feature.ts | used | The source fixture defines the file under review. |

## File / Surface Coverage

| Surface | Covered By Tasks | Verification | Rationale |
|---------|------------------|--------------|-----------|
| src/plan.ts | task-1 | rg "calculateValue" src/feature.ts | The code-review scope fixture includes this declared file. |
| tests/plan.test.ts | task-1 | rg "calculateValue" src/feature.ts | The code-review scope fixture includes this declared file. |

## Unknowns And Deferrals

| Item | Disposition | Rationale | Follow-Up |
|------|-------------|-----------|-----------|
| No open unknowns for the code review scope fixture. | none | The fixture only seeds deterministic review scope evidence. | No follow-up required after the focused test passes. |
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-VERIFICATION.md"),
    `# Phase 05: Code Review Scope - Verification

## Result

- Validation evidence is available.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-01-SUMMARY.md"),
    `# Phase 05: Code Review Scope - Summary 01

## Result

- Completed the review-ready feature slice.

## Changes Made

- \`src/summary.ts\`

## Evidence

- Summary evidence captured for this phase.
`,
    "utf8"
  );

  return repoPath;
}

async function createPhasePlanWriteRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-phase-plan-write-public-");
  const phaseDir = path.join(repoPath, ".blueprint/phases/03-phase-discovery");

  await mkdir(phaseDir, { recursive: true });
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
**Requirements**: LIFE-01
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
  await writeFile(path.join(repoPath, ".blueprint/config.json"), '{\n  "version": 2\n}\n', "utf8");
  await writeFile(
    path.join(phaseDir, "03-CONTEXT.md"),
    `# Phase 03: Phase Discovery - Context

## Decisions

- Planning should write execution-ready plan artifacts through MCP.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "03-RESEARCH.md"),
    `# Phase 03: Phase Discovery - Research

**Researched:** 2026-04-11
**Domain:** plan-phase runtime
**Confidence:** HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIFE-01 | Implement plan tooling. | Use MCP-owned plan indexing and validation. |

## Summary

- The plan-phase command needs first-class plan artifact tooling.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "03-UI-SPEC.md"),
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

async function createPhaseResearchStatusTrimRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-phase-research-status-public-");
  const phaseDir = path.join(repoPath, ".blueprint/phases/03-phase-discovery");

  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Fixture

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 3: Phase Discovery**
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
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");
  await writeFile(
    path.join(phaseDir, "03-CONTEXT.md"),
    `# Phase 03: Phase Discovery - Context

## Phase Boundary

- Keep discovery scoped to this phase.
`,
    "utf8"
  );

  return repoPath;
}

async function createPauseHandoffWriteRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-pause-handoff-write-public-");
  const phaseDir = path.join(repoPath, ".blueprint/phases/03-phase-discovery");

  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Pause Fixture

## Milestone

- Active milestone: v1

## Phases

- [x] **Phase 2: Discovery**
- [ ] **Phase 3: Phase Discovery** - Execute the prepared plans
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
- Last updated: 2026-05-09T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(path.join(repoPath, ".blueprint/config.json"), '{\n  "version": 2\n}\n', "utf8");
  await writeFile(
    path.join(phaseDir, "03-CONTEXT.md"),
    `# Phase 03: Phase Discovery - Context

## Decisions

- Execution should resume from the existing plan inventory.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "03-RESEARCH.md"),
    `# Phase 03: Phase Discovery - Research

**Researched:** 2026-05-09
**Domain:** pause-work runtime
**Confidence:** HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PW-01 | Persist a resumable pause handoff. | Use MCP-owned report writes. |

## Summary

- The phase is execution-ready and should normally route to execute-phase.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "03-UI-SPEC.md"),
    `# Phase 03: Phase Discovery - UI Spec

## Outcome Mode

- Explicit skip rationale
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "03-01-PLAN.md"),
    `---
phase: 3
plan_id: "01"
title: "Execution Plan 01"
wave: 1
status: planned
objective: "Exercise the pause-work router."
depends_on: []
requirements: []
files_modified: []
read_first: []
acceptance_criteria: []
autonomous: true
---

# Phase 03: Phase Discovery - Plan 01

## Goal

Exercise the pause-work router.

## Scope

- Persist a handoff.

## Tasks

- Write the pause report.

## Verification

- Confirm routing and report content.

## Must Haves

- Keep writes inside .blueprint/.

## Requirement Coverage

| Requirement | Status | Covered By Tasks | Evidence | Rationale |
|-------------|--------|------------------|----------|-----------|
| pause-work fixture route | covered | task-1 | tests/mcp-server-summary.test.ts | The fixture covers the pause-work report route. |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| .blueprint/phases/03-phase-discovery/03-UI-SPEC.md | used | The UI spec fixture provides saved phase evidence. |

## File / Surface Coverage

| Surface | Covered By Tasks | Verification | Rationale |
|---------|------------------|--------------|-----------|
| .blueprint/ | task-1 | Confirm routing and report content. | The pause fixture only writes Blueprint-owned artifacts. |

## Unknowns And Deferrals

| Item | Disposition | Rationale | Follow-Up |
|------|-------------|-----------|-----------|
| No open unknowns for the pause-work fixture. | none | The fixture only seeds a handoff route. | No follow-up required after the focused test passes. |
`,
    "utf8"
  );

  return repoPath;
}

async function createWorkstreamRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-workstream-public-");

  await mkdir(path.join(repoPath, ".blueprint"), { recursive: true });
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: active
- Current milestone: v1
- Current phase: 1
- Active command: /blu-plan-phase
- Next action: Run /blu-execute-phase 1
- Last updated: 2026-05-09T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );

  return repoPath;
}

async function createStateLoadRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-state-load-public-");

  await mkdir(path.join(repoPath, ".blueprint/phases"), { recursive: true });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "# Roadmap\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    JSON.stringify({ version: 2 }, null, 2),
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: active
- Current milestone: v1
- Current phase: 2
- Active command: /blu-execute-phase
- Next action: Run /blu-validate-phase 2
- Last updated: 2026-05-09T00:00:00.000Z

## Blockers

- Waiting on verification evidence
- Pending stakeholder sign-off
`,
    "utf8"
  );

  return repoPath;
}

async function createWorkspaceRoundTripFixture(): Promise<{
  globalHome: string;
  repoPath: string;
  workspacePath: string;
}> {
  const repoPath = await createGitRepo("blueprint-workspace-public-");
  const tempRoot = path.dirname(repoPath);
  const globalHome = path.join(tempRoot, "global-home");
  const workspacePath = path.join(tempRoot, "workspaces", "feature-a");

  await runGit(["config", "user.name", "Blueprint Tests"], repoPath);
  await runGit(["config", "user.email", "blueprint-tests@example.com"], repoPath);
  await writeFile(path.join(repoPath, "README.md"), "# workspace fixture\n", "utf8");
  await runGit(["add", "README.md"], repoPath);
  await runGit(["commit", "-m", "init"], repoPath);

  return {
    globalHome,
    repoPath,
    workspacePath
  };
}

async function createPatchResponseRepo(): Promise<{
  globalHome: string;
  patch: string;
  repoPath: string;
}> {
  const repoPath = await createGitRepo("blueprint-patch-public-");
  const globalHome = path.join(path.dirname(repoPath), "global-home");

  await runGit(["config", "user.name", "Blueprint Tests"], repoPath);
  await runGit(["config", "user.email", "blueprint-tests@example.com"], repoPath);
  await writeFile(path.join(repoPath, "README.md"), "# repo\n", "utf8");
  await runGit(["add", "README.md"], repoPath);
  await runGit(["commit", "-m", "init"], repoPath);
  await writeFile(path.join(repoPath, "README.md"), "# repo\npatched line\n", "utf8");

  return {
    globalHome,
    patch: await runGit(["diff", "--binary", "HEAD", "--", "README.md"], repoPath),
    repoPath
  };
}

async function createAddTestsReportValidationRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-add-tests-report-public-");
  const phaseDir = path.join(repoPath, ".blueprint/phases/03-phase-discovery");

  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Report Validation Fixture

## Milestone

- Active milestone: v1

## Phases

- [x] **Phase 3: Phase Discovery** - Completed implementation ready for validation follow-up

## Phase Details

### Phase 3: Phase Discovery
**Goal**: Validate public add-tests report MCP responses.
**Requirements**: LIFE-01
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 3
- Active command: /blu-add-tests
- Next action: Run /blu-add-tests 3
- Last updated: 2026-05-09T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(path.join(repoPath, ".blueprint/config.json"), '{\n  "version": 2\n}\n', "utf8");
  await writeFile(path.join(phaseDir, "03-01-PLAN.md"), validPhasePlanWriteContent("01"), "utf8");
  await writeFile(path.join(phaseDir, "03-01-SUMMARY.md"), validPhaseSummaryWriteContent("01"), "utf8");
  await writeFile(
    path.join(phaseDir, "03-VERIFICATION.md"),
    validAddTestsVerificationContent(".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"),
    "utf8"
  );

  return repoPath;
}

async function createCaptureRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-capture-public-");

  await mkdir(path.join(repoPath, ".blueprint/phases"), { recursive: true });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "# Roadmap\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 1
- Active command: /blu-progress
- Next action: Run /blu-progress
- Last updated: 2026-05-09T00:00:00.000Z

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

async function createConfigSetRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-config-set-public-");

  await mkdir(path.join(repoPath, ".blueprint"), { recursive: true });
  await writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    JSON.stringify({ version: 2 }, null, 2),
    "utf8"
  );

  return repoPath;
}

async function createRoadmapPromoteBacklogRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-roadmap-promote-public-");

  await mkdir(path.join(repoPath, ".blueprint/phases/01-foundation"), {
    recursive: true
  });
  await mkdir(path.join(repoPath, ".blueprint/phases/02-planning"), {
    recursive: true
  });
  await mkdir(path.join(repoPath, ".blueprint/phases/999.1-offline-mode"), {
    recursive: true
  });
  await mkdir(path.join(repoPath, ".blueprint/backlog"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Promote Backlog Fixture

## Milestone

- Active milestone: v1

## Phases

- [x] **Phase 1: Foundation** - Baseline initialization
- [ ] **Phase 2: Planning** - Prepare the next roadmap slices

## Phase Details

### Phase 1: Foundation
**Goal**: Baseline initialization.
**Requirements**: RQ-01

### Phase 2: Planning
**Goal**: Prepare the next roadmap slices.
**Requirements**: RQ-02
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 2
- Active command: /blu-review-backlog
- Next action: Run /blu-review-backlog
- Last updated: 2026-05-09T00:00:00.000Z

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
    path.join(repoPath, ".blueprint/backlog/BACKLOG.md"),
    `# Backlog

## Parking Lot

### BACKLOG-001
- Added: 2026-05-09
- Status: backlog
- Reserved Phase: 999.1
- Description: Offline mode

### BACKLOG-002
- Added: 2026-05-09
- Status: backlog
- Description: Export telemetry report
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/999.1-offline-mode/999.1-CONTEXT.md"),
    "# Context\n",
    "utf8"
  );

  return repoPath;
}

async function createRoadmapPhaseMutationRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-roadmap-phase-public-");

  await mkdir(path.join(repoPath, ".blueprint/phases/01-foundation"), {
    recursive: true
  });
  await mkdir(path.join(repoPath, ".blueprint/phases/02-planning"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/REQUIREMENTS.md"),
    `# Requirements: Phase Mutation Fixture

## Requirements Table

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| RQ-01 | Keep the foundation traceable. | Pending | Phase 1 coverage. |
| RQ-02 | Keep planning traceable. | Pending | Phase 2 coverage. |
| RQ-03 | Add offline mode. | Pending | Reserved for appended phase. |
| RQ-04 | Add research follow-up. | Pending | Reserved for inserted phase. |
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Phase Mutation Fixture

## Milestone

- Active milestone: v1

## Phases

- [x] **Phase 1: Foundation** - Baseline initialization
- [ ] **Phase 2: Planning** - Prepare the next roadmap slices

## Phase Details

### Phase 1: Foundation
**Goal**: Baseline initialization.
**Requirements**: RQ-01

### Phase 2: Planning
**Goal**: Prepare the next roadmap slices.
**Requirements**: RQ-02
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 2
- Active command: /blu-progress
- Next action: Run /blu-progress
- Last updated: 2026-05-09T00:00:00.000Z

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

async function createRoadmapRemovePhaseRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-roadmap-remove-phase-public-");

  await mkdir(path.join(repoPath, ".blueprint/phases/01-foundation"), {
    recursive: true
  });
  await mkdir(path.join(repoPath, ".blueprint/phases/02-planning"), {
    recursive: true
  });
  await mkdir(path.join(repoPath, ".blueprint/phases/03-research"), {
    recursive: true
  });
  await mkdir(path.join(repoPath, ".blueprint/phases/04-delivery"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Remove Phase Fixture

## Milestone

- Active milestone: v1

## Phases

- [x] **Phase 1: Foundation** - Baseline initialization
- [ ] **Phase 2: Planning** - Prepare the next roadmap slices
- [ ] **Phase 3: Research** - Validate the next slice
- [ ] **Phase 4: Delivery** - Ship the approved work

## Phase Details

### Phase 1: Foundation
**Goal**: Baseline initialization.
**Requirements**: RQ-01

### Phase 2: Planning
**Goal**: Prepare the next roadmap slices.
**Requirements**: RQ-02

### Phase 3: Research
**Goal**: Validate the next slice.
**Requirements**: RQ-03

### Phase 4: Delivery
**Goal**: Ship the approved work.
**Requirements**: RQ-04
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 2
- Active command: /blu-progress
- Next action: Run /blu-progress
- Last updated: 2026-05-09T00:00:00.000Z

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
    path.join(repoPath, ".blueprint/phases/04-delivery/04-PLAN.md"),
    "# Delivery Plan\n",
    "utf8"
  );

  return repoPath;
}

async function createProjectInitRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-project-init-public-");

  await writeFile(
    path.join(repoPath, "README.md"),
    `# Project Init Fixture

This fixture exercises successful Blueprint project bootstrap responses through the MCP server.
`,
    "utf8"
  );

  return repoPath;
}

async function initializeProjectInitRepo(repoPath: string): Promise<void> {
  await blueprintProjectInit({
    cwd: repoPath,
    bootstrapMode: "interactive",
    bootstrapSeed: {
      vision:
        "Create a focused fixture that validates public Blueprint state MCP responses.",
      currentMilestone: "v1",
      constraints: ["Keep successful MCP state payloads concise and actionable."],
      assumptions: ["The repo fixture starts without Blueprint artifacts."],
      requirements: [
        {
          id: "STATE-01",
          scope: "committed",
          group: "State",
          requirement:
            "Expose successful state MCP responses without leaking the top-level state path.",
          status: "planned",
          notes: "Trim only the shared public boundary response."
        }
      ],
      roadmapPhases: [
        {
          phase: "1",
          title: "State Response Trim",
          objective:
            "Initialize the repo and preserve only actionable success-path state update details.",
          requirementIds: ["STATE-01"],
          successCriteria: [
            "Blueprint bootstrap artifacts are written for the repo.",
            "The public MCP response keeps field updates while omitting the top-level state path."
          ]
        }
      ]
    }
  });
}

function validPhasePlanWriteContent(planId: string): string {
  return `---
phase: 3
plan_id: "${planId}"
title: "Plan ${planId}"
wave: 1
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
  - tests/mcp-server-summary.test.ts exits 0
autonomous: true
---

# Phase 03: Phase Discovery - Plan ${planId}

## Goal

Ship the plan-phase runtime.

## Scope

- Add phase plan writing support.

## Requirement Coverage

| Requirement | Status | Covered By | Evidence |
|-------------|--------|------------|----------|
| LIFE-01 | covered | Task 1 | src/mcp/tools/phase.ts |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| .blueprint/phases/03-phase-discovery/03-CONTEXT.md | used | Captures the MCP-owned planning decision. |
| .blueprint/phases/03-phase-discovery/03-RESEARCH.md | used | Supplies the plan-phase runtime evidence. |

## File / Surface Coverage

| File / Surface | Covered By | Verification |
|----------------|------------|--------------|
| src/mcp/tools/phase.ts | Task 1 | tests/mcp-server-summary.test.ts exits 0 |

## Unknowns And Deferrals

| Item | Disposition | Follow-up |
|------|-------------|-----------|
| No open planning-runtime unknowns remain. | none | Run /blu-progress after execution. |

## Tasks

### Task 1: Add the MCP plan write tool

#### Read First

- src/mcp/tools/phase.ts

#### Action

- Persist a valid plan artifact.

#### Acceptance Criteria

- tests/mcp-server-summary.test.ts exits 0

## Verification

- Run \`npx tsx --test tests/mcp-server-summary.test.ts\` and confirm the public MCP payload omits successful plan-write validation details.

## Must Haves

- Keep invalid plan-write diagnostics intact so repair flows still receive the full validation object.
`;
}

function validPhaseArtifactWriteContent(): string {
  return `# Phase 03: Phase Discovery - Context

## Phase Boundary
- Phase goal - keep discovery artifacts substantive and phase-scoped.
- Included work - save MCP-owned context that downstream planning can trust.
- Excluded work - editing later lifecycle artifacts during discovery.
- Success target - the saved context preserves next-step inputs for planning.

## Discovery Grounding
- Product brief - Blueprint stores discovery artifacts under .blueprint/phases/.
- Requirements trace - planning depends on durable context with concrete evidence.
- Workflow stance - discuss and research feed MCP-owned artifact writes.
- Locked decisions - validation must enforce canonical headings and substantive detail.

## Implementation Decisions
- Decision: Trim validation from successful public responses at the MCP boundary only.
- Tradeoff or constraint: Invalid responses still need full diagnostics for repair loops.

## Specific Ideas
- Specific idea 1: Reuse the existing plan-write public trim rule for phase artifact writes.
- Specific idea 2: Keep the trim rule limited to successful validated writes.
- Later follow-up: Apply the same boundary pattern only when a future tool truly needs it.

## Existing Code Insights
- Existing code insight 1: Public MCP text mirrors structuredContent from the server response.
- Reusable pattern: Success-only trimming already exists for blueprint_phase_plan_write.
- Known gap or caution: Invalid writes must keep validation, suggested repairs, and retry guidance.

## Dependencies
- Prior phase artifacts: .blueprint/phases/03-phase-discovery/03-RESEARCH.md
- External constraints: Routing and repair workflows depend on invalid validation details staying intact.
- Required follow-up reads: src/mcp/server.ts and tests/mcp-server-summary.test.ts

## Open Questions
- none

## Deferred Ideas
- Scope creep or later follow-up: Consider a shared helper only if more public write tools need the same trim behavior.
- Ideas to revisit after this phase: Audit whether other successful write payloads are too verbose.

## Canonical References
- Source 1: src/mcp/server.ts
- Source 2: tests/mcp-server-summary.test.ts`;
}

function validCodebaseArchitectureContent(): string {
  return `# Architecture

MCP tools and command manifests anchor the runtime layout.
`;
}

function validCleanupReportContent(nextSafeAction = "/blu-progress"): string {
  return `# Cleanup Report

## Selected Phase Directories

- .blueprint/phases/01-bug-taxonomy-and-reporting-harness

## Protected Exclusions

- .blueprint/phases/06-workspace-maintenance-audit

## Archive Destination

- .blueprint/archive/v1

## Mutation Outcome

- pending

## Next Safe Action

- ${nextSafeAction}
`;
}

function validPhaseSummaryWriteContent(planId: string): string {
  return `# Phase 03: Phase Discovery - Summary ${planId}

**Plan:** \`03-${planId}-PLAN.md\`
**Status:** COMPLETED
**Readiness:** ready-for-validation
**Completion State:** complete
**Next Safe Action:** /blu-validate-phase 3

## Outcome

- Completed the MCP response-trimming summary slice.

## Changes Made

- Trimmed the public success payload for summary writes when issues are empty.

## Verification

| Check | Command | Result | Evidence | Notes |
|-------|---------|--------|----------|-------|
| Focused summary/server tests | npx tsx --test tests/mcp-server-summary.test.ts | pass | Confirms successful public payloads stay concise. | Invalid writes still expose repair diagnostics. |

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
| test | tests/mcp-server-summary.test.ts | Covers the public summary-write boundary behavior. |

## Files Changed

- src/mcp/server.ts
- tests/mcp-server-summary.test.ts`;
}

function validAddTestsVerificationContent(summaryPath: string): string {
  return `# Phase 03: Phase Discovery - Verification

**Coverage:** Reviewed \`${summaryPath}\` for completed execution evidence.
**Gate State:** PASS
**Sign-off:** validation lead

## Validation Summary

- Completed execution evidence is ready for follow-up validation and test generation.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| LIFE-01 | Confirm completed execution evidence exists | \`${summaryPath}\` | PASS | The completed summary is saved and reviewable. |

## Evidence Reviewed

- \`${summaryPath}\`

## Test Infrastructure / Evidence Metadata

- Harness: node:test
- Commands: npx tsx --test tests/mcp-server-summary.test.ts
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
}

test("artifact read summaries keep the transcript concise", () => {
  const result = {
    phaseFound: true,
    found: true,
    phaseNumber: "1",
    phasePrefix: "01",
    phaseName: "Core Game (Requirements: R-01, R-02, R-03)",
    phaseDir: ".blueprint/phases/01-core-game",
    artifact: "context",
    path: ".blueprint/phases/01-core-game/01-CONTEXT.md",
    content: "# Phase 1 Context\n\n## Objective\nShip the playable game.\n",
    reason: null
  };

  const summary = summarizeToolResult("blueprint_phase_artifact_read", result);

  assert.equal(
    summary,
    "Loaded Phase 1 context at `.blueprint/phases/01-core-game/01-CONTEXT.md` (56 B)."
  );
  assert.doesNotMatch(summary, /Ship the playable game/);
  assert.doesNotMatch(summary, /\"phaseFound\"/);
});

test("tool response content mirrors structuredContent as compact JSON", () => {
  const result = {
    phaseFound: true,
    found: true,
    phaseNumber: "1",
    artifact: "context",
    path: ".blueprint/phases/01-core-game/01-CONTEXT.md",
    content: "# Phase 1 Context\n"
  };
  const content = createToolResponseContent("blueprint_phase_artifact_read", result);

  assert.deepEqual(content, [
    {
      type: "text",
      text: expectedStructuredContentJson(result)
    }
  ]);
  assert.deepEqual(JSON.parse(content[0].text), result);
});

test("public config set response trims config and provenance payloads", () => {
  const result = {
    scope: "project",
    updatedKeys: ["model_profile", "ux.progress_mode"],
    config: {
      version: 2,
      model_profile: "quality",
      ux: { progress_mode: "stage" }
    },
    provenance: {
      layersApplied: ["hardcoded", "project"],
      defaultsPath: null,
      projectPath: ".blueprint/config.json",
      defaultsApplied: false,
      projectApplied: true
    },
    configPath: ".blueprint/config.json",
    warnings: ["Migrated legacy config key commit_docs to planning.commit_docs"]
  };

  const content = createToolResponseContent("blueprint_config_set", result);
  const parsed = JSON.parse(content[0].text);

  assert.deepEqual(parsed, {
    scope: "project",
    updatedKeys: ["model_profile", "ux.progress_mode"],
    configPath: ".blueprint/config.json",
    warnings: ["Migrated legacy config key commit_docs to planning.commit_docs"]
  });
  assert.ok(!("config" in parsed));
  assert.ok(!("provenance" in parsed));
});

test("public config get response trims duplicate sourcePath only when provenance already carries the same path", () => {
  const duplicateProjectResult = {
    scope: "project",
    config: {
      version: 2,
      model_profile: "balanced"
    },
    provenance: {
      layersApplied: ["hardcoded", "project"],
      defaultsPath: "~/.gemini/blueprint/defaults.json",
      projectPath: ".blueprint/config.json",
      defaultsApplied: false,
      projectApplied: true
    },
    sourcePath: ".blueprint/config.json",
    warnings: ["Project warning"]
  };
  const duplicateDefaultsResult = {
    scope: "defaults",
    config: {
      version: 2,
      model_profile: "quality"
    },
    provenance: {
      layersApplied: ["hardcoded", "defaults"],
      defaultsPath: "~/.gemini/blueprint/defaults.json",
      projectPath: null,
      defaultsApplied: true,
      projectApplied: false
    },
    sourcePath: "~/.gemini/blueprint/defaults.json",
    warnings: []
  };
  const distinctResult = {
    ...duplicateProjectResult,
    sourcePath: ".blueprint/config.override.json"
  };
  const nullSourcePathResult = {
    scope: "project",
    config: {
      version: 2,
      model_profile: "balanced"
    },
    provenance: {
      layersApplied: ["hardcoded"],
      defaultsPath: "~/.gemini/blueprint/defaults.json",
      projectPath: null,
      defaultsApplied: false,
      projectApplied: false
    },
    sourcePath: null,
    warnings: ["Project config does not exist yet; returning hardcoded defaults."]
  };

  const duplicateProjectPublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_config_get",
    duplicateProjectResult
  );
  const duplicateDefaultsPublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_config_get",
    duplicateDefaultsResult
  );
  const distinctPublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_config_get",
    distinctResult
  );
  const nullSourcePathPublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_config_get",
    nullSourcePathResult
  );
  const duplicateProjectText = createToolResponseContent(
    "blueprint_config_get",
    duplicateProjectResult
  )[0].text;
  const duplicateDefaultsText = createToolResponseContent(
    "blueprint_config_get",
    duplicateDefaultsResult
  )[0].text;
  const distinctText = createToolResponseContent("blueprint_config_get", distinctResult)[0].text;
  const nullSourcePathText = createToolResponseContent(
    "blueprint_config_get",
    nullSourcePathResult
  )[0].text;

  assert.ok(!("sourcePath" in duplicateProjectPublicResult));
  assert.ok(!("sourcePath" in duplicateDefaultsPublicResult));
  assert.deepEqual(duplicateProjectPublicResult.config, duplicateProjectResult.config);
  assert.deepEqual(duplicateProjectPublicResult.provenance, duplicateProjectResult.provenance);
  assert.deepEqual(duplicateProjectPublicResult.warnings, duplicateProjectResult.warnings);
  assert.deepEqual(duplicateDefaultsPublicResult.config, duplicateDefaultsResult.config);
  assert.deepEqual(duplicateDefaultsPublicResult.provenance, duplicateDefaultsResult.provenance);
  assert.deepEqual(duplicateDefaultsPublicResult.warnings, duplicateDefaultsResult.warnings);
  assert.doesNotMatch(duplicateProjectText, /"sourcePath":/);
  assert.doesNotMatch(duplicateDefaultsText, /"sourcePath":/);

  assert.equal(distinctPublicResult.sourcePath, distinctResult.sourcePath);
  assert.equal(nullSourcePathPublicResult.sourcePath, null);
  assert.match(distinctText, /"sourcePath":"\.blueprint\/config\.override\.json"/);
  assert.match(nullSourcePathText, /"sourcePath":null/);
});

test("public config set response omits empty top-level warnings while preserving non-empty warnings", () => {
  const emptyWarningsResult = {
    scope: "project",
    updatedKeys: ["model_profile"],
    configPath: ".blueprint/config.json",
    warnings: []
  };
  const warnedResult = {
    scope: "project",
    updatedKeys: ["planning.commit_docs"],
    configPath: ".blueprint/config.json",
    warnings: ["Migrated legacy config key commit_docs to planning.commit_docs"]
  };

  const emptyWarningsText = createToolResponseContent("blueprint_config_set", emptyWarningsResult)[0].text;
  const warnedText = createToolResponseContent("blueprint_config_set", warnedResult)[0].text;
  const emptyWarningsParsed = JSON.parse(emptyWarningsText);
  const warnedParsed = JSON.parse(warnedText);

  assert.ok(!("warnings" in emptyWarningsParsed));
  assert.doesNotMatch(emptyWarningsText, /"warnings":/);
  assert.deepEqual(warnedParsed.warnings, warnedResult.warnings);
  assert.match(warnedText, /"warnings":\[/);
});

test("public roadmap read response trims redundant phaseCount and empty arrays only at the MCP boundary", () => {
  const result = {
    roadmap: {
      path: ".blueprint/ROADMAP.md",
      phaseCount: 1
    },
    milestone: "v1",
    warnings: [],
    recovery: [],
    phases: [
      {
        phaseNumber: "1",
        title: "Discovery",
        status: "planned",
        description: "Map the current defect surface.",
        phaseDir: ".blueprint/phases/01-discovery"
      }
    ]
  };

  const publicResult = sanitizeToolResultForPublicResponse("blueprint_roadmap_read", result);
  const text = createToolResponseContent("blueprint_roadmap_read", result)[0].text;
  const parsed = JSON.parse(text);

  assert.equal(result.roadmap.phaseCount, 1);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.recovery, []);
  assert.deepEqual(publicResult, parsed);
  assert.equal(parsed.roadmap.path, ".blueprint/ROADMAP.md");
  assert.equal(parsed.milestone, "v1");
  assert.equal(parsed.phases.length, 1);
  assert.ok(!("phaseCount" in parsed.roadmap));
  assert.ok(!("warnings" in parsed));
  assert.ok(!("recovery" in parsed));
  assert.doesNotMatch(text, /"phaseCount":/);
  assert.doesNotMatch(text, /"warnings":/);
  assert.doesNotMatch(text, /"recovery":/);
});

test("public phase locate response omits only empty top-level warnings and recovery while preserving populated arrays", () => {
  const successResult = {
    found: true,
    phaseNumber: "1",
    phasePrefix: "01",
    phaseName: "Discovery",
    phaseDir: ".blueprint/phases/01-discovery",
    artifacts: [],
    milestone: "v1",
    resolvedFrom: "roadmap",
    reason: null,
    recovery: [],
    warnings: []
  };
  const failureResult = {
    found: false,
    phaseNumber: null,
    phasePrefix: null,
    phaseName: null,
    phaseDir: null,
    artifacts: [],
    milestone: "v1",
    resolvedFrom: "roadmap",
    reason: "No phase could be inferred from the request, state, or roadmap.",
    recovery: ["Run /blu-progress to confirm the active phase before retrying."],
    warnings: ["STATE.md is missing, so roadmap inference may be stale."]
  };

  const successPublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_phase_locate",
    successResult
  );
  const failurePublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_phase_locate",
    failureResult
  );
  const successText = createToolResponseContent("blueprint_phase_locate", successResult)[0].text;
  const failureText = createToolResponseContent("blueprint_phase_locate", failureResult)[0].text;
  const successParsed = JSON.parse(successText);
  const failureParsed = JSON.parse(failureText);

  assert.deepEqual(successResult.warnings, []);
  assert.deepEqual(successResult.recovery, []);
  assert.deepEqual(successPublicResult, successParsed);
  assert.ok(!("warnings" in successParsed));
  assert.ok(!("recovery" in successParsed));
  assert.doesNotMatch(successText, /"warnings":/);
  assert.doesNotMatch(successText, /"recovery":/);

  assert.deepEqual(failurePublicResult, failureParsed);
  assert.deepEqual(failureParsed.warnings, failureResult.warnings);
  assert.deepEqual(failureParsed.recovery, failureResult.recovery);
  assert.match(failureText, /"warnings":\[/);
  assert.match(failureText, /"recovery":\[/);
});

test("public artifact list response omits only empty top-level warnings from MCP text while direct handler keeps the tool contract", async () => {
  const repoPath = await createProjectInitRepo();

  try {
    await initializeProjectInitRepo(repoPath);

    const result = await blueprintToolRegistry.blueprint_artifact_list.handler({
      cwd: repoPath
    });
    const publicResult = sanitizeToolResultForPublicResponse("blueprint_artifact_list", result);
    const text = createToolResponseContent("blueprint_artifact_list", result)[0].text;
    const parsed = JSON.parse(text);

    assert.deepEqual(result.warnings, []);
    assert.ok("warnings" in result);
    assert.ok(!("warnings" in publicResult));
    assert.ok(!("warnings" in parsed));
    assert.deepEqual(parsed.artifacts, result.artifacts);
    assert.deepEqual(parsed.reports, result.reports);
    assert.deepEqual(parsed.missing, result.missing);
    assert.doesNotMatch(text, /"warnings":/);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("public phase summary index response omits only empty top-level warnings from MCP text while direct handler keeps the tool contract", async () => {
  const repoPath = await createPhasePlanWriteRepo();

  try {
    await blueprintPhasePlanWrite({
      cwd: repoPath,
      phase: "3",
      content: validPhasePlanWriteContent("03-01"),
      overwrite: true
    });

    const result = await blueprintToolRegistry.blueprint_phase_summary_index.handler({
      cwd: repoPath,
      phase: "3"
    });
    const publicResult = sanitizeToolResultForPublicResponse("blueprint_phase_summary_index", result);
    const text = createToolResponseContent("blueprint_phase_summary_index", result)[0].text;
    const parsed = JSON.parse(text);

    assert.deepEqual(result.warnings, []);
    assert.ok("warnings" in result);
    assert.ok(!("warnings" in publicResult));
    assert.ok(!("warnings" in parsed));
    assert.equal(parsed.phaseFound, true);
    assert.equal(parsed.phaseNumber, "3");
    assert.deepEqual(parsed.summaries, result.summaries);
    assert.deepEqual(parsed.completedPlans, result.completedPlans);
    assert.deepEqual(parsed.pendingPlans, result.pendingPlans);
    assert.doesNotMatch(text, /"warnings":/);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("public patch record trims top-level paths at the MCP boundary", () => {
  const recordResult = {
    patchId: "readme-fix",
    registryPath: "/tmp/global-home/patches",
    manifestPath: "/tmp/global-home/patches/readme-fix/manifest.json",
    patchPath: "/tmp/global-home/patches/readme-fix/patch.diff",
    auditPath: "/tmp/global-home/patches/readme-fix/audit.ndjson",
    trackedFiles: ["README.md"],
    updated: true
  };
  const recordText = createToolResponseContent("blueprint_patch_record", recordResult)[0].text;
  const record = JSON.parse(recordText);

  assert.equal(record.patchId, "readme-fix");
  assert.deepEqual(record.trackedFiles, ["README.md"]);
  assert.equal(record.updated, true);
  assert.ok(!("registryPath" in record));
  assert.ok(!("manifestPath" in record));
  assert.ok(!("patchPath" in record));
  assert.ok(!("auditPath" in record));
  assert.doesNotMatch(recordText, /"registryPath":/);
  assert.doesNotMatch(recordText, /"manifestPath":/);
  assert.doesNotMatch(recordText, /"patchPath":/);
  assert.doesNotMatch(recordText, /"auditPath":/);
});

test("public patch list trims top-level registryPath and nested patch file paths while retaining useful patch metadata", () => {
  const listResult = {
    registryPath: "/tmp/global-home/patches",
    patches: [
      {
        patchId: "readme-fix",
        label: "README fix",
        createdAt: "2026-05-09T00:00:00.000Z",
        sourceVersion: "0.1.0",
        trackedFiles: ["README.md"],
        manifestPath: "/tmp/global-home/patches/readme-fix/manifest.json",
        patchPath: "/tmp/global-home/patches/readme-fix/patch.diff",
        auditPath: "/tmp/global-home/patches/readme-fix/audit.ndjson",
        lastAppliedAt: null,
        lastOutcome: null,
        compatibility: {
          status: "compatible",
          reasons: []
        }
      }
    ]
  };

  const listText = createToolResponseContent("blueprint_patch_list", listResult)[0].text;
  const listed = JSON.parse(listText);

  assert.ok(!("registryPath" in listed));
  assert.doesNotMatch(listText, /"registryPath":/);
  assert.equal(listed.patches.length, 1);
  assert.equal(listed.patches[0].patchId, "readme-fix");
  assert.equal(listed.patches[0].label, "README fix");
  assert.equal(listed.patches[0].createdAt, "2026-05-09T00:00:00.000Z");
  assert.equal(listed.patches[0].sourceVersion, "0.1.0");
  assert.deepEqual(listed.patches[0].trackedFiles, ["README.md"]);
  assert.equal(listed.patches[0].lastAppliedAt, null);
  assert.equal(listed.patches[0].lastOutcome, null);
  assert.deepEqual(listed.patches[0].compatibility, {
    status: "compatible",
    reasons: []
  });
  assert.ok(!("manifestPath" in listed.patches[0]));
  assert.ok(!("patchPath" in listed.patches[0]));
  assert.ok(!("auditPath" in listed.patches[0]));
  assert.doesNotMatch(listText, /"manifestPath":/);
  assert.doesNotMatch(listText, /"patchPath":/);
  assert.doesNotMatch(listText, /"auditPath":/);
});

test("public patch reapply responses trim registryPath at the MCP boundary", () => {
  const result = {
    registryPath: "/tmp/global-home/patches",
    appliedPatches: ["readme-fix"],
    skippedPatches: [],
    conflicts: [],
    preview: false,
    targetHead: "abc123"
  };

  const text = createToolResponseContent("blueprint_patch_reapply", result)[0].text;
  const parsed = JSON.parse(text);

  assert.ok(!("registryPath" in parsed));
  assert.doesNotMatch(text, /"registryPath":/);
  assert.deepEqual(parsed, {
    appliedPatches: ["readme-fix"],
    skippedPatches: [],
    conflicts: [],
    preview: false,
    targetHead: "abc123"
  });
});

test("public state update responses trim top-level statePath and preserve non-empty warnings at the MCP boundary", () => {
  const result = {
    updatedFields: ["currentPhase", "nextAction", "lastUpdated"],
    statePath: ".blueprint/STATE.md",
    warnings: ["Preserved existing pause handoff because the content was unchanged."]
  };

  const text = createToolResponseContent("blueprint_state_update", result)[0].text;
  const parsed = JSON.parse(text);

  assert.ok(!("statePath" in parsed));
  assert.doesNotMatch(text, /"statePath":/);
  assert.deepEqual(parsed, {
    updatedFields: ["currentPhase", "nextAction", "lastUpdated"],
    warnings: ["Preserved existing pause handoff because the content was unchanged."]
  });
});

test("public state update responses omit empty top-level warnings at the MCP boundary", () => {
  const result = {
    updatedFields: ["currentPhase", "nextAction", "lastUpdated"],
    statePath: ".blueprint/STATE.md",
    warnings: []
  };

  const text = createToolResponseContent("blueprint_state_update", result)[0].text;
  const parsed = JSON.parse(text);

  assert.ok(!("statePath" in parsed));
  assert.ok(!("warnings" in parsed));
  assert.doesNotMatch(text, /"statePath":/);
  assert.doesNotMatch(text, /"warnings":/);
  assert.deepEqual(parsed, {
    updatedFields: ["currentPhase", "nextAction", "lastUpdated"]
  });
});

test("public state sync responses trim top-level statePath and preserve non-empty warnings at the MCP boundary", () => {
  const result = {
    syncedFields: ["currentPhase", "nextAction"],
    statePath: ".blueprint/STATE.md",
    warnings: ["STATE.md was missing and has been reconstructed from surviving artifacts."]
  };

  const text = createToolResponseContent("blueprint_state_sync", result)[0].text;
  const parsed = JSON.parse(text);

  assert.ok(!("statePath" in parsed));
  assert.doesNotMatch(text, /"statePath":/);
  assert.deepEqual(parsed, {
    syncedFields: ["currentPhase", "nextAction"],
    warnings: ["STATE.md was missing and has been reconstructed from surviving artifacts."]
  });
});

test("public state sync responses omit empty top-level warnings at the MCP boundary", () => {
  const result = {
    syncedFields: ["currentPhase", "nextAction"],
    statePath: ".blueprint/STATE.md",
    warnings: []
  };

  const text = createToolResponseContent("blueprint_state_sync", result)[0].text;
  const parsed = JSON.parse(text);

  assert.ok(!("statePath" in parsed));
  assert.ok(!("warnings" in parsed));
  assert.doesNotMatch(text, /"statePath":/);
  assert.doesNotMatch(text, /"warnings":/);
  assert.deepEqual(parsed, {
    syncedFields: ["currentPhase", "nextAction"]
  });
});

test("public project init success trims redundant config provenance and bootstrap diagnostics", () => {
  const result = {
    projectRoot: "/tmp/blueprint-project-init-public",
    createdPaths: [
      ".blueprint/PROJECT.md",
      ".blueprint/REQUIREMENTS.md",
      ".blueprint/ROADMAP.md",
      ".blueprint/STATE.md",
      ".blueprint/config.json"
    ],
    seededState: {
      updatedFields: ["projectStatus", "currentMilestone", "currentPhase", "nextAction"],
      statePath: ".blueprint/STATE.md"
    },
    configPath: ".blueprint/config.json",
    configProvenance: {
      layersApplied: ["hardcoded"],
      defaultsPath: null,
      projectPath: ".blueprint/config.json",
      defaultsApplied: false,
      projectApplied: true
    },
    brownfield: {
      repoShape: "greenfield",
      codebaseMapped: false,
      provisionalRoadmap: false,
      recommendedNextAction: "Run /blu-discuss-phase 1",
      reasons: []
    },
    bootstrapDiagnostics: {
      placeholderArtifacts: [".blueprint/PROJECT.md", ".blueprint/REQUIREMENTS.md"],
      traceabilityWarnings: ["Traceability is already reflected in top-level warnings."],
      brownfield: {
        repoShape: "greenfield",
        codebaseMapped: false,
        provisionalRoadmap: false,
        recommendedNextAction: "Run /blu-discuss-phase 1",
        reasons: []
      }
    },
    nextAction: "Run /blu-discuss-phase 1",
    warnings: ["Traceability is already reflected in top-level warnings."]
  };

  const content = createToolResponseContent("blueprint_project_init", result);
  const parsed = JSON.parse(content[0].text);

  assert.deepEqual(parsed, {
    projectRoot: "/tmp/blueprint-project-init-public",
    createdPaths: [
      ".blueprint/PROJECT.md",
      ".blueprint/REQUIREMENTS.md",
      ".blueprint/ROADMAP.md",
      ".blueprint/STATE.md",
      ".blueprint/config.json"
    ],
    seededState: {
      updatedFields: ["projectStatus", "currentMilestone", "currentPhase", "nextAction"],
      statePath: ".blueprint/STATE.md"
    },
    configPath: ".blueprint/config.json",
    brownfield: {
      repoShape: "greenfield",
      codebaseMapped: false,
      provisionalRoadmap: false,
      recommendedNextAction: "Run /blu-discuss-phase 1",
      reasons: []
    },
    bootstrapDiagnostics: {
      placeholderArtifacts: [".blueprint/PROJECT.md", ".blueprint/REQUIREMENTS.md"]
    },
    nextAction: "Run /blu-discuss-phase 1",
    warnings: ["Traceability is already reflected in top-level warnings."]
  });
  assert.ok(!("configProvenance" in parsed));
  assert.ok(!("traceabilityWarnings" in parsed.bootstrapDiagnostics));
  assert.ok(!("brownfield" in parsed.bootstrapDiagnostics));
});

test("public project init response omits empty top-level warnings while preserving non-empty warnings", () => {
  const emptyWarningsResult = {
    projectRoot: "/tmp/blueprint-project-init-public",
    createdPaths: [".blueprint/PROJECT.md"],
    seededState: {
      updatedFields: ["projectStatus"],
      statePath: ".blueprint/STATE.md"
    },
    configPath: ".blueprint/config.json",
    brownfield: {
      repoShape: "greenfield",
      codebaseMapped: false,
      provisionalRoadmap: false,
      recommendedNextAction: "Run /blu-discuss-phase 1",
      reasons: []
    },
    bootstrapDiagnostics: {
      placeholderArtifacts: [".blueprint/PROJECT.md"]
    },
    nextAction: "Run /blu-discuss-phase 1",
    warnings: []
  };
  const warnedResult = {
    ...emptyWarningsResult,
    warnings: ["Traceability is already reflected in top-level warnings."]
  };

  const emptyWarningsText = createToolResponseContent("blueprint_project_init", emptyWarningsResult)[0].text;
  const warnedText = createToolResponseContent("blueprint_project_init", warnedResult)[0].text;
  const emptyWarningsParsed = JSON.parse(emptyWarningsText);
  const warnedParsed = JSON.parse(warnedText);

  assert.ok(!("warnings" in emptyWarningsParsed));
  assert.doesNotMatch(emptyWarningsText, /"warnings":/);
  assert.deepEqual(warnedParsed.warnings, warnedResult.warnings);
  assert.match(warnedText, /"warnings":\[/);
});

test("public project status trims bootstrap recommended next action only when redundant", () => {
  const redundantResult = {
    status: "initialized",
    initialized: true,
    currentPhase: "1",
    currentMilestone: "v1",
    nextAction: "Run /blu-progress",
    bootstrap: {
      repoShape: "greenfield",
      brownfieldDetected: false,
      codebaseMapped: false,
      placeholderArtifacts: [],
      traceabilityWarnings: [],
      recommendedNextAction: "Run /blu-progress"
    },
    health: {
      missingArtifacts: [],
      warnings: []
    }
  };
  const distinctResult = {
    ...redundantResult,
    nextAction: "Run /blu-discuss-phase 1"
  };

  const trimmedText = createToolResponseContent("blueprint_project_status", redundantResult)[0].text;
  const untrimmedText = createToolResponseContent("blueprint_project_status", distinctResult)[0].text;

  const trimmed = JSON.parse(trimmedText);
  const untrimmed = JSON.parse(untrimmedText);

  assert.ok(!("recommendedNextAction" in trimmed.bootstrap));
  assert.doesNotMatch(trimmedText, /"recommendedNextAction":/);
  assert.equal(untrimmed.bootstrap.recommendedNextAction, "Run /blu-progress");
});

test("schema-first authoring and validation tools mirror structuredContent in MCP text", () => {
  const summaryAuthoringResult = {
    status: "ready",
    phaseNumber: "3",
    planId: "01",
    taskSchema: { properties: { status: { enum: ["COMPLETED"] } } }
  };
  const reportValidationToolResult = {
    status: "invalid",
    valid: false,
    reportName: "audit-fix-3",
    diagnostics: [
      {
        message: "report.add-tests model is missing required evidence coverage."
      }
    ]
  };
  const summaryAuthoringText = createToolResponseContent(
    "blueprint_phase_summary_authoring_context",
    summaryAuthoringResult
  )[0].text;
  const reportValidationText = createToolResponseContent(
    "blueprint_artifact_report_validate_model",
    reportValidationToolResult
  )[0].text;

  assert.equal(
    summaryAuthoringText,
    expectedStructuredContentJson(summaryAuthoringResult)
  );
  assert.equal(
    reportValidationText,
    expectedStructuredContentJson(reportValidationToolResult)
  );
  assert.match(summaryAuthoringText, /taskSchema|COMPLETED/);
  assert.match(reportValidationText, /diagnostics|reportName/);
  assert.doesNotMatch(reportValidationText, /taskSchema|BLOCKED/);
  assert.doesNotMatch(reportValidationText, /normalizedModel|renderPreview/);
});

test("missing reads surface the reason without dumping the result object", () => {
  const summary = summarizeToolResult("blueprint_phase_artifact_read", {
    phaseFound: true,
    found: false,
    phaseNumber: "7",
    artifact: "research",
    reason: "Artifact file does not exist yet."
  });

  assert.equal(summary, "No Phase 7 research found: Artifact file does not exist yet.");
});

test("invalid write results do not claim an artifact was saved", () => {
  const summary = summarizeToolResult("blueprint_phase_validation_write", {
    phaseNumber: "3",
    artifact: "verification",
    path: ".blueprint/phases/03-validation-engine/03-VERIFICATION.md",
    summaryPaths: [".blueprint/phases/03-validation-engine/03-01-SUMMARY.md"],
    written: false,
    created: false,
    overwritten: false,
    status: "invalid",
    issues: ["Missing required sections."],
    warnings: ["Validation contract mismatch."]
  });

  assert.equal(
    summary,
    "Did not save Phase 3 verification at `.blueprint/phases/03-validation-engine/03-VERIFICATION.md` status: invalid (1 summary links, 1 warnings). Diagnostics: Missing required sections."
  );
});

test("invalid write summaries surface nested validation issues", () => {
  const summary = summarizeToolResult("blueprint_phase_plan_write", {
    phaseNumber: "3",
    planId: "01",
    path: ".blueprint/phases/03-validation-engine/03-01-PLAN.md",
    written: false,
    created: false,
    overwritten: false,
    status: "invalid",
    validation: {
      valid: false,
      issues: [
        "Phase plan model requirementCoverage must include exactly one row for LIFE-02.",
        "Modified file src/mcp/tools/phase.ts is missing from fileSurfaceCoverage.",
        "Plan dependency cycle detected: 01 -> 02 -> 01.",
        "Acceptance criterion is not objectively verifiable."
      ],
      warnings: []
    },
    warnings: []
  });

  assert.equal(
    summary,
    "Did not save Phase 3 plan 01 at `.blueprint/phases/03-validation-engine/03-01-PLAN.md` status: invalid. Diagnostics: Phase plan model requirementCoverage must include exactly one row for LIFE-02; Modified file src/mcp/tools/phase.ts is missing from fileSurfaceCoverage; Plan dependency cycle detected: 01 -> 02 -> 01 (+1 more)."
  );
});

test("invalid model validation summaries surface diagnostic messages", () => {
  const summary = summarizeToolResult("blueprint_phase_plan_validate_model", {
    status: "invalid",
    valid: false,
    phase: null,
    planId: "01",
    path: ".blueprint/phases/03-validation-engine/03-01-PLAN.md",
    diagnostics: [
      {
        source: "schema",
        path: "model.evidenceCoverage",
        code: "schema.exactCoverage",
        message:
          "Phase plan model evidenceCoverage must include exactly one row for known saved evidence artifact .blueprint/phases/03-validation-engine/03-CONTEXT.md."
      }
    ],
    warnings: []
  });

  assert.equal(
    summary,
    "Completed phase plan validate model at `.blueprint/phases/03-validation-engine/03-01-PLAN.md` status: invalid. Diagnostics: Phase plan model evidenceCoverage must include exactly one row for known saved evidence artifact .blueprint/phases/03-validation-engine/03-CONTEXT.md."
  );
});

test("diagnostic summaries truncate overly long messages", () => {
  const longMessage = "A".repeat(5000);
  const summary = summarizeToolResult("blueprint_phase_plan_validate_model", {
    status: "invalid",
    valid: false,
    planId: "01",
    path: ".blueprint/phases/03-validation-engine/03-01-PLAN.md",
    diagnostics: [
      {
        source: "schema",
        path: "model.summary",
        code: "schema.longMessage",
        message: longMessage
      }
    ],
    warnings: []
  });

  assert.match(summary, /Diagnostics: A+/);
  assert.match(summary, /\.\.\.$/);
  assert.ok(summary.length < longMessage.length);
});

test("phase plan model tools mirror rich schema details into MCP text", () => {
  const planDiagnostics = [
    {
      source: "schema",
      path: "model.requirementCoverage",
      code: "schema.exactCoverage",
      message: "Phase plan model requirementCoverage must include exactly one row for LIFE-02.",
      suggestion: "Add a requirementCoverage row for LIFE-02."
    },
    {
      source: "schema",
      path: "model.fileSurfaceCoverage",
      code: "schema.exactCoverage",
      message: "Modified file src/mcp/tools/phase.ts is missing from fileSurfaceCoverage.",
      suggestion: "Add src/mcp/tools/phase.ts to fileSurfaceCoverage."
    },
    {
      source: "scope",
      path: "model.dependsOn",
      code: "scope.dependencyCycle",
      message: "Plan dependency cycle detected: 01 -> 02 -> 01.",
      suggestion: "Remove the cyclic dependency."
    },
    {
      source: "residual",
      path: "model.tasks[0].acceptanceCriteria[0]",
      code: "residual.verifiability",
      message: "Acceptance criterion is not objectively verifiable.",
      suggestion: "Rewrite the acceptance criterion as an observable check."
    }
  ];
  const repairSummary = {
    blockingCount: 4,
    firstPassActions: ["add", "remove", "make-verifiable"],
    reReadAuthoringContext: true,
    retryInstruction:
      "Repair all diagnostics against the runtime task schema, then re-read authoring context before retrying."
  };
  const taskSchema = {
    properties: {
      requirements: { items: { enum: ["LIFE-01", "LIFE-02"] } },
      dependsOn: { items: { enum: ["02"] } }
    }
  };
  const authoringResult = {
    status: "invalid",
    phase: { phaseNumber: "3" },
    planId: "01",
    path: ".blueprint/phases/03-validation-engine/03-01-PLAN.md",
    schemaPath: "schemas/phase-plan.schema.json",
    knownRequirements: ["LIFE-01", "LIFE-02"],
    knownEvidenceArtifacts: [
      ".blueprint/phases/03-validation-engine/03-CONTEXT.md",
      ".blueprint/phases/03-validation-engine/03-RESEARCH.md"
    ],
    allowedDependencyPlanIds: ["02"],
    baseSchema: { $id: "blueprint.phase.plan.model" },
    taskSchema,
    reason: "Phase plan authoring requires at least one roadmap requirement."
  };
  const validateResult = {
    status: "invalid",
    valid: false,
    target: {
      artifact: "phase.plan",
      phaseNumber: "3",
      phasePrefix: "03",
      phaseName: "Validation Engine",
      planId: "01",
      path: ".blueprint/phases/03-validation-engine/03-01-PLAN.md",
      schemaPath: "schemas/phase-plan.schema.json"
    },
    repairSummary,
    phase: { phaseNumber: "3" },
    planId: "01",
    path: ".blueprint/phases/03-validation-engine/03-01-PLAN.md",
    schemaPath: "schemas/phase-plan.schema.json",
    diagnostics: planDiagnostics,
    diagnosticCounts: {
      total: 4,
      bySource: { schema: 2, scope: 1, residual: 1 },
      byCode: {
        "schema.exactCoverage": 2,
        "scope.dependencyCycle": 1,
        "residual.verifiability": 1
      }
    },
    warnings: []
  };
  const writeResult = {
    phaseNumber: "3",
    planId: "01",
    path: ".blueprint/phases/03-validation-engine/03-01-PLAN.md",
    written: false,
    created: false,
    overwritten: false,
    status: "invalid",
    validation: {
      valid: false,
      issues: planDiagnostics.map((diagnostic) => diagnostic.message),
      warnings: []
    },
    modelValidation: {
      status: "invalid",
      valid: false,
      target: {
        artifact: "phase.plan",
        phaseNumber: "3",
        phasePrefix: "03",
        phaseName: "Validation Engine",
        planId: "01",
        path: ".blueprint/phases/03-validation-engine/03-01-PLAN.md",
        schemaPath: "schemas/phase-plan.schema.json"
      },
      repairBudget: {
        maxAttempts: 2,
        recommendedStrategy: "repair-all-diagnostics-before-retry"
      },
      phase: { phaseNumber: "3", phasePrefix: "03", phaseName: "Validation Engine", phaseDir: ".blueprint/phases/03-validation-engine" },
      planId: "01",
      path: ".blueprint/phases/03-validation-engine/03-01-PLAN.md",
      schemaPath: "schemas/phase-plan.schema.json",
      diagnostics: planDiagnostics,
      diagnosticCounts: {
        total: 4,
        bySource: { schema: 2, scope: 1, residual: 1, markdown: 0 },
        byCode: {
          "schema.exactCoverage": 2,
          "scope.dependencyCycle": 1,
          "residual.verifiability": 1
        }
      },
      repairSummary,
      warnings: []
    },
    warnings: []
  };
  const authoringText = createToolResponseContent(
    "blueprint_phase_plan_authoring_context",
    authoringResult
  )[0].text;
  const validateText = createToolResponseContent(
    "blueprint_phase_plan_validate_model",
    validateResult
  )[0].text;
  const writeText = createToolResponseContent("blueprint_phase_plan_write", writeResult)[0].text;

  assert.equal(
    authoringText,
    expectedStructuredContentJson(authoringResult)
  );
  assert.match(authoringText, /knownRequirements|taskSchema|baseSchema/);
  assert.equal(
    validateText,
    expectedStructuredContentJson(validateResult)
  );
  assert.match(validateText, /diagnostics|diagnosticCounts|repairSummary|target/);
  assert.doesNotMatch(validateText, /taskSchema|normalizedModel|renderPreview/);
  assert.equal(
    writeText,
    expectedStructuredContentJson({
      ...writeResult,
      warnings: undefined
    })
  );
  const parsedWriteResult = JSON.parse(writeText);

  assert.ok(!("warnings" in parsedWriteResult));
  assert.deepEqual(parsedWriteResult.validation?.warnings, []);
  assert.deepEqual(parsedWriteResult.modelValidation?.warnings, []);
  assert.match(writeText, /modelValidation|diagnostics|repairSummary/);
  assert.doesNotMatch(writeText, /taskSchema|normalizedModel|renderPreview/);
});

test("public phase plan write success trims validation and empty warnings from MCP text while preserving non-empty warnings", () => {
  const writeResult = {
    phaseNumber: "3",
    phasePrefix: "03",
    phaseName: "Validation Engine",
    phaseDir: ".blueprint/phases/03-validation-engine",
    planId: "01",
    path: ".blueprint/phases/03-validation-engine/03-01-PLAN.md",
    written: true,
    created: true,
    overwritten: false,
    status: "created",
    validation: {
      valid: true,
      issues: [],
      warnings: []
    },
    warnings: []
  };
  const warnedResult = {
    ...writeResult,
    status: "reused",
    warnings: ["Preserved existing plan artifact because the content was unchanged."]
  };
  const writeText = createToolResponseContent("blueprint_phase_plan_write", writeResult)[0].text;
  const warnedText = createToolResponseContent("blueprint_phase_plan_write", warnedResult)[0].text;
  const parsed = JSON.parse(writeText);
  const warnedParsed = JSON.parse(warnedText);

  assert.equal(parsed.status, "created");
  assert.equal(parsed.path, writeResult.path);
  assert.ok(!("validation" in parsed));
  assert.ok(!("warnings" in parsed));
  assert.doesNotMatch(writeText, /"validation":/);
  assert.doesNotMatch(writeText, /"warnings":/);
  assert.ok(!("validation" in warnedParsed));
  assert.deepEqual(warnedParsed.warnings, warnedResult.warnings);
  assert.match(warnedText, /"warnings":\[/);
});

test("public phase plan index trim omits waves only when they are exactly derivable from plans", () => {
  const result = {
    phaseFound: true,
    phaseNumber: "3",
    phasePrefix: "03",
    phaseName: "Phase Discovery",
    phaseDir: ".blueprint/phases/03-phase-discovery",
    plans: [
      {
        planId: "01",
        path: ".blueprint/phases/03-phase-discovery/03-01-PLAN.md",
        title: "Plan 01",
        wave: 1,
        gapClosure: false,
        status: "planned",
        objective: "Ship the first slice.",
        dependsOn: [],
        requirements: ["LIFE-01"],
        filesModified: ["src/mcp/server.ts"],
        readFirst: ["src/mcp/server.ts"],
        acceptanceCriteria: ["Derivable waves are trimmed only at the public boundary."],
        autonomous: true,
        valid: true,
        issues: [],
        warnings: []
      },
      {
        planId: "02",
        path: ".blueprint/phases/03-phase-discovery/03-02-PLAN.md",
        title: "Plan 02",
        wave: null,
        gapClosure: false,
        status: "planned",
        objective: "Ship the second slice.",
        dependsOn: [],
        requirements: ["LIFE-02"],
        filesModified: ["tests/mcp-server-summary.test.ts"],
        readFirst: ["tests/mcp-server-summary.test.ts"],
        acceptanceCriteria: ["Unassigned plans contribute to the derived grouping."],
        autonomous: true,
        valid: true,
        issues: [],
        warnings: []
      }
    ],
    waves: {
      "1": [".blueprint/phases/03-phase-discovery/03-01-PLAN.md"],
      unassigned: [".blueprint/phases/03-phase-discovery/03-02-PLAN.md"]
    },
    missingPlans: [],
    gapClosurePlans: [],
    warnings: []
  };

  const publicResult = sanitizeToolResultForPublicResponse(
    "blueprint_phase_plan_index",
    result
  );
  const publicText = createToolResponseContent("blueprint_phase_plan_index", result)[0].text;

  assert.ok(!("waves" in publicResult));
  assert.doesNotMatch(publicText, /"waves":/);
});

test("public phase plan index trim preserves waves when they are distinct or malformed", () => {
  const baseResult = {
    phaseFound: true,
    phaseNumber: "3",
    phasePrefix: "03",
    phaseName: "Phase Discovery",
    phaseDir: ".blueprint/phases/03-phase-discovery",
    plans: [
      {
        planId: "01",
        path: ".blueprint/phases/03-phase-discovery/03-01-PLAN.md",
        title: "Plan 01",
        wave: 1,
        gapClosure: false,
        status: "planned",
        objective: "Ship the first slice.",
        dependsOn: [],
        requirements: ["LIFE-01"],
        filesModified: ["src/mcp/server.ts"],
        readFirst: ["src/mcp/server.ts"],
        acceptanceCriteria: ["Distinct or malformed waves stay public."],
        autonomous: true,
        valid: true,
        issues: [],
        warnings: []
      }
    ],
    missingPlans: [],
    gapClosurePlans: [],
    warnings: []
  };

  const distinctResult = sanitizeToolResultForPublicResponse(
    "blueprint_phase_plan_index",
    {
      ...baseResult,
      waves: {
        "2": [".blueprint/phases/03-phase-discovery/03-01-PLAN.md"]
      }
    }
  );
  const malformedResult = sanitizeToolResultForPublicResponse(
    "blueprint_phase_plan_index",
    {
      ...baseResult,
      waves: {
        "1": ".blueprint/phases/03-phase-discovery/03-01-PLAN.md"
      }
    }
  );

  assert.deepEqual(distinctResult.waves, {
    "2": [".blueprint/phases/03-phase-discovery/03-01-PLAN.md"]
  });
  assert.deepEqual(malformedResult.waves, {
    "1": ".blueprint/phases/03-phase-discovery/03-01-PLAN.md"
  });
});

test("public phase execution targets trim duplicated selected and candidate plan arrays only when derivable", () => {
  const redundantResult = {
    phaseFound: true,
    phaseNumber: "3",
    phasePrefix: "03",
    phaseName: "Execution Targets",
    phaseDir: ".blueprint/phases/03-execution-targets",
    pendingPlanIds: ["01", "02"],
    candidatePlanIds: ["01", "02"],
    candidatePlanPaths: [
      ".blueprint/phases/03-execution-targets/03-01-PLAN.md",
      ".blueprint/phases/03-execution-targets/03-02-PLAN.md"
    ],
    selectedPlanIds: ["01"],
    selectedPlanPaths: [
      ".blueprint/phases/03-execution-targets/03-01-PLAN.md"
    ],
    candidatePlans: [
      {
        planId: "01",
        path: ".blueprint/phases/03-execution-targets/03-01-PLAN.md",
        wave: 1
      },
      {
        planId: "02",
        path: ".blueprint/phases/03-execution-targets/03-02-PLAN.md",
        wave: 2
      }
    ],
    selectedPlans: [
      {
        planId: "01",
        path: ".blueprint/phases/03-execution-targets/03-01-PLAN.md",
        wave: 1
      }
    ]
  };
  const distinctResult = {
    ...redundantResult,
    candidatePlanIds: ["01"],
    selectedPlanPaths: [".blueprint/phases/03-execution-targets/03-09-PLAN.md"]
  };
  const malformedResult = {
    ...redundantResult,
    candidatePlans: [
      {
        path: ".blueprint/phases/03-execution-targets/03-01-PLAN.md",
        wave: 1
      }
    ],
    selectedPlans: [
      {
        path: ".blueprint/phases/03-execution-targets/03-01-PLAN.md"
      }
    ]
  };

  const redundantPublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_phase_execution_targets",
    redundantResult
  );
  const distinctPublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_phase_execution_targets",
    distinctResult
  );
  const malformedPublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_phase_execution_targets",
    malformedResult
  );
  const redundantText = createToolResponseContent(
    "blueprint_phase_execution_targets",
    redundantResult
  )[0].text;

  assert.ok(!("candidatePlanIds" in redundantPublicResult));
  assert.ok(!("candidatePlanPaths" in redundantPublicResult));
  assert.ok(!("selectedPlanIds" in redundantPublicResult));
  assert.ok(!("selectedPlanPaths" in redundantPublicResult));
  assert.doesNotMatch(redundantText, /"candidatePlanIds":/);
  assert.doesNotMatch(redundantText, /"candidatePlanPaths":/);
  assert.doesNotMatch(redundantText, /"selectedPlanIds":/);
  assert.doesNotMatch(redundantText, /"selectedPlanPaths":/);

  assert.deepEqual(distinctPublicResult.candidatePlanIds, ["01"]);
  assert.deepEqual(distinctPublicResult.selectedPlanPaths, [
    ".blueprint/phases/03-execution-targets/03-09-PLAN.md"
  ]);
  assert.deepEqual(malformedPublicResult.candidatePlanIds, ["01", "02"]);
  assert.deepEqual(malformedPublicResult.candidatePlanPaths, [
    ".blueprint/phases/03-execution-targets/03-01-PLAN.md",
    ".blueprint/phases/03-execution-targets/03-02-PLAN.md"
  ]);
  assert.deepEqual(malformedPublicResult.selectedPlanIds, ["01"]);
  assert.ok(!("selectedPlanPaths" in malformedPublicResult));
});

test("public phase validation render trims duplicated nested validation warnings only from the MCP boundary", () => {
  const result = {
    phaseFound: true,
    phaseNumber: "3",
    phasePrefix: "03",
    phaseName: "Validation Engine",
    phaseDir: ".blueprint/phases/03-validation-engine",
    artifact: "verification",
    path: ".blueprint/phases/03-validation-engine/03-VERIFICATION.md",
    content: "# Phase 03: Validation Engine - Verification\n",
    validation: {
      valid: true,
      issues: [],
      warnings: ["Referenced summary filename was used instead of the repo-relative path."]
    },
    summaryPaths: [".blueprint/phases/03-validation-engine/03-01-SUMMARY.md"],
    referencedSummaryPaths: ["03-01-SUMMARY.md"],
    prerequisiteBlockers: [],
    readyToWrite: true,
    issues: [],
    warnings: [
      "Summary evidence is ready for render.",
      "Referenced summary filename was used instead of the repo-relative path."
    ]
  };

  const publicResult = sanitizeToolResultForPublicResponse(
    "blueprint_phase_validation_render",
    result
  );
  const publicText = createToolResponseContent("blueprint_phase_validation_render", result)[0].text;
  const parsedPublicText = JSON.parse(publicText);

  assert.deepEqual(result.validation.warnings, [
    "Referenced summary filename was used instead of the repo-relative path."
  ]);
  assert.ok(!("warnings" in (publicResult.validation ?? {})));
  assert.ok(!("warnings" in (parsedPublicText.validation ?? {})));
  assert.deepEqual(publicResult.warnings, result.warnings);
  assert.doesNotMatch(publicText, /"validation":\{"valid":true,"issues":\[\],"warnings":/);
});

test("public phase validation render preserves nested validation warnings when top-level warnings do not fully cover them", () => {
  const distinctResult = sanitizeToolResultForPublicResponse(
    "blueprint_phase_validation_render",
    {
      phaseFound: true,
      artifact: "verification",
      validation: {
        valid: true,
        issues: [],
        warnings: ["Nested validation warning"]
      },
      warnings: ["Different top-level warning"]
    }
  );
  const partiallyCoveredResult = sanitizeToolResultForPublicResponse(
    "blueprint_phase_validation_render",
    {
      phaseFound: true,
      artifact: "verification",
      validation: {
        valid: true,
        issues: [],
        warnings: ["Nested warning A", "Nested warning B"]
      },
      warnings: ["Nested warning A"]
    }
  );

  assert.deepEqual(distinctResult.validation?.warnings, ["Nested validation warning"]);
  assert.deepEqual(partiallyCoveredResult.validation?.warnings, [
    "Nested warning A",
    "Nested warning B"
  ]);
});

test("public command catalog trims top-level waves only when exactly derivable from command entry waves", () => {
  const derivableResult = {
    commands: {
      help: {
        command: "help",
        wave: 0,
        status: "implemented"
      },
      review: {
        command: "review",
        wave: 4,
        status: "implemented"
      },
      ship: {
        command: "ship",
        wave: 4,
        status: "implemented"
      }
    },
    waves: {
      "0": ["help"],
      "4": ["review", "ship"]
    },
    aliases: {
      "/blu-help": ["help"]
    }
  };
  const nonDerivableResult = {
    ...derivableResult,
    waves: {
      "0": ["help"],
      "4": ["ship", "review"]
    }
  };

  const derivablePublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_command_catalog",
    derivableResult
  );
  const nonDerivablePublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_command_catalog",
    nonDerivableResult
  );
  const derivableText = createToolResponseContent("blueprint_command_catalog", derivableResult)[0].text;
  const nonDerivableText = createToolResponseContent(
    "blueprint_command_catalog",
    nonDerivableResult
  )[0].text;

  assert.deepEqual(derivableResult.waves, {
    "0": ["help"],
    "4": ["review", "ship"]
  });
  assert.ok(!("waves" in derivablePublicResult));
  assert.doesNotMatch(derivableText, /"waves":/);
  assert.deepEqual(nonDerivablePublicResult.waves, {
    "0": ["help"],
    "4": ["ship", "review"]
  });
  assert.match(nonDerivableText, /"waves":/);
});

test("in-memory MCP trims duplicated phase execution target arrays while the direct handler keeps them", async (t) => {
  const repoPath = await createPhaseExecutionTargetsRepo();
  const directResult = await blueprintToolRegistry.blueprint_phase_execution_targets.handler({
    cwd: repoPath,
    phase: "3"
  });
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-phase-execution-targets-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  t.after(async () => {
    await Promise.all([client.close(), server.close()]);
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  assert.deepEqual(directResult.candidatePlanIds, ["01"]);
  assert.deepEqual(directResult.candidatePlanPaths, [
    ".blueprint/phases/03-execution-targets/03-01-PLAN.md"
  ]);
  assert.deepEqual(directResult.selectedPlanIds, ["01"]);
  assert.deepEqual(directResult.selectedPlanPaths, [
    ".blueprint/phases/03-execution-targets/03-01-PLAN.md"
  ]);

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const response = await client.callTool({
    name: "blueprint_phase_execution_targets",
    arguments: {
      cwd: repoPath,
      phase: "3"
    }
  });

  assert.ok(response.structuredContent);
  assert.equal(
    response.content[0]?.text,
    expectedStructuredContentJson(response.structuredContent)
  );
  assert.ok(!("candidatePlanIds" in response.structuredContent));
  assert.ok(!("candidatePlanPaths" in response.structuredContent));
  assert.ok(!("selectedPlanIds" in response.structuredContent));
  assert.ok(!("selectedPlanPaths" in response.structuredContent));
  assert.deepEqual(
    response.structuredContent.candidatePlans?.map((plan) => plan.planId),
    ["01"]
  );
  assert.deepEqual(
    response.structuredContent.selectedPlans?.map((plan) => plan.planId),
    ["01"]
  );

  const publicResult = JSON.parse(response.content[0]?.text ?? "{}");

  assert.ok(!("candidatePlanIds" in publicResult));
  assert.ok(!("candidatePlanPaths" in publicResult));
  assert.ok(!("selectedPlanIds" in publicResult));
  assert.ok(!("selectedPlanPaths" in publicResult));
});

test("public phase plan validate tool trims taskSchema, normalized model, and render preview", async () => {
  const repoPath = await createPhasePlanWriteRepo();

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-phase-plan-validate-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_phase_plan_validate_model",
      arguments: {
        cwd: repoPath,
        phase: "3",
        planId: "01",
        model: {}
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.status, "invalid");
    assert.equal(response.structuredContent.valid, false);
    assert.ok(!("taskSchema" in response.structuredContent));
    assert.ok(!("normalizedModel" in response.structuredContent));
    assert.ok(!("renderPreview" in response.structuredContent));
    assert.match(
      response.content[0]?.text ?? "",
      /diagnostics|diagnosticCounts|repairSummary|target/
    );
    assert.doesNotMatch(
      response.content[0]?.text ?? "",
      /taskSchema|normalizedModel|renderPreview/
    );
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public phase artifact write success trims validation and empty warnings from MCP text while preserving non-empty warnings", () => {
  const writeResult = {
    phaseNumber: "3",
    phasePrefix: "03",
    phaseName: "Phase Discovery",
    phaseDir: ".blueprint/phases/03-phase-discovery",
    artifact: "context",
    path: ".blueprint/phases/03-phase-discovery/03-CONTEXT.md",
    written: true,
    created: false,
    overwritten: true,
    status: "updated",
    validation: {
      valid: true,
      issues: [],
      warnings: [],
      suggestedRepairs: []
    },
    warnings: []
  };
  const warnedResult = {
    ...writeResult,
    status: "reused",
    warnings: ["Preserved existing context artifact because the content was unchanged."]
  };
  const writeText = createToolResponseContent("blueprint_phase_artifact_write", writeResult)[0].text;
  const warnedText = createToolResponseContent("blueprint_phase_artifact_write", warnedResult)[0].text;
  const parsed = JSON.parse(writeText);
  const warnedParsed = JSON.parse(warnedText);

  assert.equal(parsed.status, "updated");
  assert.equal(parsed.path, writeResult.path);
  assert.ok(!("validation" in parsed));
  assert.ok(!("warnings" in parsed));
  assert.doesNotMatch(writeText, /"validation":/);
  assert.doesNotMatch(writeText, /"warnings":/);
  assert.ok(!("validation" in warnedParsed));
  assert.deepEqual(warnedParsed.warnings, warnedResult.warnings);
  assert.match(warnedText, /"warnings":\[/);
});

test("public phase checkpoint put success omits empty top-level warnings while preserving non-empty warnings", () => {
  const writeResult = {
    phaseNumber: "3",
    phasePrefix: "03",
    phaseName: "Phase Discovery",
    phaseDir: ".blueprint/phases/03-phase-discovery",
    path: ".blueprint/phases/03-phase-discovery/03-CHECKPOINT.json",
    updated: true,
    warnings: []
  };
  const warnedResult = {
    ...writeResult,
    warnings: ["Legacy checkpoint metadata was preserved while updating ownership metadata."]
  };
  const writeText = createToolResponseContent("blueprint_phase_checkpoint_put", writeResult)[0].text;
  const warnedText = createToolResponseContent("blueprint_phase_checkpoint_put", warnedResult)[0].text;
  const parsed = JSON.parse(writeText);
  const warnedParsed = JSON.parse(warnedText);

  assert.equal(parsed.updated, true);
  assert.equal(parsed.path, writeResult.path);
  assert.ok(!("warnings" in parsed));
  assert.doesNotMatch(writeText, /"warnings":/);
  assert.deepEqual(warnedParsed.warnings, warnedResult.warnings);
  assert.match(warnedText, /"warnings":\[/);
});

test("public phase checkpoint get omits only empty top-level warnings while preserving non-empty warnings", () => {
  const missingResult = {
    phaseFound: true,
    found: false,
    phaseNumber: "3",
    phasePrefix: "03",
    phaseName: "Phase Discovery",
    phaseDir: ".blueprint/phases/03-phase-discovery",
    path: ".blueprint/phases/03-phase-discovery/03-DISCUSS-CHECKPOINT.json",
    checkpoint: null,
    ownerCommand: null,
    resumeMode: null,
    safeToResume: false,
    warnings: [],
    reason: ".blueprint/phases/03-phase-discovery/03-DISCUSS-CHECKPOINT.json does not exist."
  };
  const warnedResult = {
    phaseFound: true,
    found: true,
    phaseNumber: "3",
    phasePrefix: "03",
    phaseName: "Phase Discovery",
    phaseDir: ".blueprint/phases/03-phase-discovery",
    path: ".blueprint/phases/03-phase-discovery/03-DISCUSS-CHECKPOINT.json",
    checkpoint: {
      ownerCommand: "/blu-discuss-phase",
      resumeMeta: { mode: "discuss" }
    },
    ownerCommand: "/blu-discuss-phase",
    resumeMode: "discuss",
    safeToResume: false,
    warnings: [
      ".blueprint/phases/03-phase-discovery/03-DISCUSS-CHECKPOINT.json belongs to /blu-discuss-phase, not /blu-research-phase; do not resume it for this command."
    ],
    reason: null
  };

  const missingPublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_phase_checkpoint_get",
    missingResult
  );
  const warnedPublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_phase_checkpoint_get",
    warnedResult
  );
  const missingText = createToolResponseContent(
    "blueprint_phase_checkpoint_get",
    missingResult
  )[0].text;
  const warnedText = createToolResponseContent(
    "blueprint_phase_checkpoint_get",
    warnedResult
  )[0].text;
  const missingParsed = JSON.parse(missingText) as Record<string, unknown>;
  const warnedParsed = JSON.parse(warnedText) as Record<string, unknown>;

  assert.deepEqual(missingResult.warnings, []);
  assert.ok(!("warnings" in missingPublicResult));
  assert.ok(!("warnings" in missingParsed));
  assert.doesNotMatch(missingText, /"warnings":/);

  assert.deepEqual(warnedPublicResult.warnings, warnedResult.warnings);
  assert.deepEqual(warnedParsed.warnings, warnedResult.warnings);
  assert.match(warnedText, /"warnings":\[/);
});

test("public phase summary write success trims empty issues and warnings from MCP text", () => {
  const writeResult = {
    phaseNumber: "3",
    phasePrefix: "03",
    phaseName: "Phase Discovery",
    phaseDir: ".blueprint/phases/03-phase-discovery",
    planId: "01",
    path: ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md",
    linkedPlanPath: ".blueprint/phases/03-phase-discovery/03-01-PLAN.md",
    written: true,
    created: false,
    overwritten: true,
    status: "updated",
    issues: [],
    warnings: []
  };
  const writeText = createToolResponseContent("blueprint_phase_summary_write", writeResult)[0].text;
  const parsed = JSON.parse(writeText);

  assert.equal(parsed.status, "updated");
  assert.equal(parsed.path, writeResult.path);
  assert.ok(!("issues" in parsed));
  assert.ok(!("warnings" in parsed));
  assert.doesNotMatch(writeText, /"issues":/);
  assert.doesNotMatch(writeText, /"warnings":/);
});

test("public phase summary write success preserves non-empty warnings in MCP text", () => {
  const writeResult = {
    phaseNumber: "3",
    phasePrefix: "03",
    phaseName: "Phase Discovery",
    phaseDir: ".blueprint/phases/03-phase-discovery",
    planId: "01",
    path: ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md",
    linkedPlanPath: ".blueprint/phases/03-phase-discovery/03-01-PLAN.md",
    written: false,
    created: false,
    overwritten: false,
    status: "reused",
    issues: [],
    warnings: ["Preserved existing summary artifact because the content was unchanged."]
  };
  const writeText = createToolResponseContent("blueprint_phase_summary_write", writeResult)[0].text;
  const parsed = JSON.parse(writeText);

  assert.equal(parsed.status, "reused");
  assert.equal(parsed.path, writeResult.path);
  assert.ok(!("issues" in parsed));
  assert.deepEqual(parsed.warnings, writeResult.warnings);
  assert.doesNotMatch(writeText, /"issues":/);
  assert.match(writeText, /"warnings":\[/);
});

test("public codebase artifact write success trims empty issues and warnings from MCP text", () => {
  const writeResult = {
    artifact: "architecture",
    path: ".blueprint/codebase/ARCHITECTURE.md",
    status: "reused",
    written: true,
    created: false,
    overwritten: false,
    issues: [],
    diagnostics: [],
    warnings: []
  };
  const writeText = createToolResponseContent("blueprint_codebase_artifact_write", writeResult)[0].text;
  const parsed = JSON.parse(writeText);

  assert.equal(parsed.status, "reused");
  assert.equal(parsed.path, writeResult.path);
  assert.ok(!("issues" in parsed));
  assert.ok(!("warnings" in parsed));
  assert.doesNotMatch(writeText, /"issues":/);
  assert.doesNotMatch(writeText, /"warnings":/);
});

test("public codebase artifact write success preserves non-empty warnings in MCP text", () => {
  const writeResult = {
    artifact: "architecture",
    path: ".blueprint/codebase/ARCHITECTURE.md",
    status: "reused",
    written: false,
    created: false,
    overwritten: false,
    issues: [],
    warnings: ["Preserved existing codebase artifact because the content was unchanged."]
  };
  const writeText = createToolResponseContent("blueprint_codebase_artifact_write", writeResult)[0].text;
  const parsed = JSON.parse(writeText);

  assert.equal(parsed.status, "reused");
  assert.equal(parsed.path, writeResult.path);
  assert.ok(!("issues" in parsed));
  assert.deepEqual(parsed.warnings, writeResult.warnings);
  assert.doesNotMatch(writeText, /"issues":/);
  assert.match(writeText, /"warnings":\[/);
});

test("public codebase artifact write invalid payload keeps issues and diagnostics in MCP text", () => {
  const writeResult = {
    artifact: "architecture",
    path: ".blueprint/codebase/ARCHITECTURE.md",
    status: "invalid",
    issues: ["Missing required Overview heading."],
    diagnostics: [
      {
        section: "Overview",
        message: "Expected heading was not found."
      }
    ],
    suggestedRepairs: ["Restore the required Overview section heading before retrying."]
  };
  const writeText = createToolResponseContent("blueprint_codebase_artifact_write", writeResult)[0].text;
  const parsed = JSON.parse(writeText);

  assert.equal(parsed.status, "invalid");
  assert.deepEqual(parsed.issues, writeResult.issues);
  assert.deepEqual(parsed.diagnostics, writeResult.diagnostics);
  assert.deepEqual(parsed.suggestedRepairs, writeResult.suggestedRepairs);
  assert.match(writeText, /issues|diagnostics|suggestedRepairs/);
});

test("public artifact validate trims empty failure arrays only for valid results", () => {
  const validResult = {
    valid: true,
    issues: [],
    diagnostics: [],
    suggestedRepairs: [],
    warnings: [
      "Existing codebase artifacts are present and should be reused unless replace is explicitly confirmed."
    ]
  };
  const invalidResult = {
    valid: false,
    issues: ["Missing .blueprint/ directory."],
    diagnostics: [],
    suggestedRepairs: ["Run /blu-new-project to initialize Blueprint artifacts."],
    warnings: []
  };

  const publicValidResult = sanitizeToolResultForPublicResponse(
    "blueprint_artifact_validate",
    validResult
  );
  const publicInvalidResult = sanitizeToolResultForPublicResponse(
    "blueprint_artifact_validate",
    invalidResult
  );

  assert.deepEqual(validResult.issues, []);
  assert.deepEqual(validResult.diagnostics, []);
  assert.deepEqual(validResult.suggestedRepairs, []);
  assert.ok(!("issues" in publicValidResult));
  assert.ok(!("diagnostics" in publicValidResult));
  assert.ok(!("suggestedRepairs" in publicValidResult));
  assert.deepEqual(publicValidResult.warnings, validResult.warnings);
  assert.deepEqual(publicInvalidResult, invalidResult);
});

test("public impact analyze trims only top-level fields duplicated under report", () => {
  const directResult = {
    phaseStatus: "scored-report-modeled",
    impactId: "impact-2026-05-09-example",
    status: "WARN",
    impactStatus: "WARN",
    risk: {
      level: "medium",
      reasons: ["Contract evidence is incomplete."]
    },
    confidence: {
      score: 0.6,
      level: "medium",
      reasons: ["Ownership metadata is partial."]
    },
    surfaces: [
      {
        path: "src/index.ts",
        surfaces: ["source"],
        primarySurface: "source",
        area: "runtime",
        reasons: ["Changed source file."]
      }
    ],
    areaSummary: [
      {
        name: "runtime",
        files: ["src/index.ts"],
        count: 1
      }
    ],
    surfaceSummary: [
      {
        name: "source",
        files: ["src/index.ts"],
        count: 1
      }
    ],
    ownership: {
      coverage: {
        status: "partial",
        sourcesConfigured: ["CODEOWNERS"],
        sourcesUsed: ["CODEOWNERS"],
        fallbackReviewers: [],
        filesWithOwners: 1,
        filesMissingOwners: 0,
        gaps: []
      },
      codeownersPath: "CODEOWNERS",
      metadataPaths: [],
      rules: [],
      matches: []
    },
    dependencyGraph: {
      coverage: {
        status: "partial",
        sourcesConfigured: ["package-lock.json"],
        sourcesUsed: ["package-lock.json"],
        filesCovered: ["src/index.ts"],
        filesUncovered: [],
        gaps: []
      },
      nodes: [],
      edges: [],
      reverseDependentsByPath: {}
    },
    findings: [],
    obligations: [],
    unknowns: [],
    evidence: [],
    warnings: ["Scope confidence is reduced until dependency metadata is expanded."],
    advisoryNote: "keep me",
    report: {
      impactId: "impact-2026-05-09-example",
      status: "WARN",
      impactStatus: "WARN",
      risk: {
        level: "medium",
        reasons: ["Contract evidence is incomplete."]
      },
      confidence: {
        score: 0.6,
        level: "medium",
        reasons: ["Ownership metadata is partial."]
      },
      surfaces: [
        {
          path: "src/index.ts",
          surfaces: ["source"],
          primarySurface: "source",
          area: "runtime",
          reasons: ["Changed source file."]
        }
      ],
      areaSummary: [
        {
          name: "runtime",
          files: ["src/index.ts"],
          count: 1
        }
      ],
      surfaceSummary: [
        {
          name: "source",
          files: ["src/index.ts"],
          count: 1
        }
      ],
      ownership: {
        coverage: {
          status: "partial",
          sourcesConfigured: ["CODEOWNERS"],
          sourcesUsed: ["CODEOWNERS"],
          fallbackReviewers: [],
          filesWithOwners: 1,
          filesMissingOwners: 0,
          gaps: []
        },
        codeownersPath: "CODEOWNERS",
        metadataPaths: [],
        rules: [],
        matches: []
      },
      dependencyGraph: {
        coverage: {
          status: "partial",
          sourcesConfigured: ["package-lock.json"],
          sourcesUsed: ["package-lock.json"],
          filesCovered: ["src/index.ts"],
          filesUncovered: [],
          gaps: []
        },
        nodes: [],
        edges: [],
        reverseDependentsByPath: {}
      },
      findings: [],
      obligations: [],
      unknowns: [],
      evidence: []
    }
  };

  const publicResult = sanitizeToolResultForPublicResponse(
    "blueprint_impact_analyze",
    directResult
  );

  assert.equal(publicResult.phaseStatus, directResult.phaseStatus);
  assert.deepEqual(publicResult.report, directResult.report);
  assert.deepEqual(publicResult.warnings, directResult.warnings);
  assert.equal(publicResult.advisoryNote, "keep me");
  assert.ok(!("impactId" in publicResult));
  assert.ok(!("status" in publicResult));
  assert.ok(!("impactStatus" in publicResult));
  assert.ok(!("risk" in publicResult));
  assert.ok(!("confidence" in publicResult));
  assert.ok(!("surfaces" in publicResult));
  assert.ok(!("areaSummary" in publicResult));
  assert.ok(!("surfaceSummary" in publicResult));
  assert.ok(!("ownership" in publicResult));
  assert.ok(!("dependencyGraph" in publicResult));
  assert.ok(!("findings" in publicResult));
  assert.ok(!("obligations" in publicResult));
  assert.ok(!("unknowns" in publicResult));
  assert.ok(!("evidence" in publicResult));
});

test("public impact scope resolve response trims duplicate changedFiles and empty top-level warnings only when redundant", () => {
  const redundantResult = {
    status: "resolved",
    scope: {
      kind: "files",
      description: "Analyze runtime wiring",
      files: ["src/index.ts"],
      source: "explicit-files"
    },
    changedFiles: ["src/index.ts"],
    git: {
      mode: "files",
      range: null,
      base: null,
      head: null
    },
    diffStats: {
      filesChanged: 1,
      additions: null,
      deletions: null
    },
    patchHash: "abc123",
    scopeFingerprint: "scope-1",
    confidence: {
      score: 0.9,
      level: "high",
      reasons: []
    },
    warnings: []
  };
  const distinctResult = {
    ...redundantResult,
    changedFiles: ["src/index.ts", "src/extra.ts"],
    warnings: ["Scope includes a manually-added companion file."]
  };

  const redundantText = createToolResponseContent(
    "blueprint_impact_scope_resolve",
    redundantResult
  )[0].text;
  const distinctText = createToolResponseContent(
    "blueprint_impact_scope_resolve",
    distinctResult
  )[0].text;
  const redundantPublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_impact_scope_resolve",
    redundantResult
  );
  const distinctPublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_impact_scope_resolve",
    distinctResult
  );

  assert.ok(!("changedFiles" in redundantPublicResult));
  assert.ok(!("warnings" in redundantPublicResult));
  assert.doesNotMatch(redundantText, /"changedFiles":/);
  assert.doesNotMatch(redundantText, /"warnings":/);

  assert.deepEqual(distinctPublicResult.changedFiles, distinctResult.changedFiles);
  assert.deepEqual(distinctPublicResult.warnings, distinctResult.warnings);
  assert.match(distinctText, /"changedFiles":\["src\/index\.ts","src\/extra\.ts"\]/);
  assert.match(distinctText, /"warnings":\["Scope includes a manually-added companion file\."\]/);
});

test("public impact output render response omits empty top-level warnings while preserving render fields", () => {
  const emptyWarningsResult = {
    phaseStatus: "rendered",
    mode: "summary",
    status: "PASS",
    impactStatus: "PASS",
    content: "Impact summary content.",
    impactId: "impact-2026-05-09-example",
    warnings: []
  };
  const warnedResult = {
    ...emptyWarningsResult,
    warnings: ["Rendered output omitted low-confidence appendix."]
  };

  const emptyWarningsText = createToolResponseContent(
    "blueprint_impact_output_render",
    emptyWarningsResult
  )[0].text;
  const warnedText = createToolResponseContent("blueprint_impact_output_render", warnedResult)[0].text;
  const emptyWarningsParsed = JSON.parse(emptyWarningsText);
  const warnedParsed = JSON.parse(warnedText);

  assert.deepEqual(emptyWarningsParsed, {
    phaseStatus: "rendered",
    mode: "summary",
    status: "PASS",
    impactStatus: "PASS",
    content: "Impact summary content.",
    impactId: "impact-2026-05-09-example"
  });
  assert.ok(!("warnings" in emptyWarningsParsed));
  assert.doesNotMatch(emptyWarningsText, /"warnings":/);
  assert.deepEqual(warnedParsed.warnings, warnedResult.warnings);
  assert.match(warnedText, /"warnings":\[/);
});

test("public review scope response trims redundant authoring context scope fields and empty top-level warnings only at the MCP boundary", () => {
  const duplicateResult = {
    status: "ready",
    phase: {
      phaseNumber: "5",
      phasePrefix: "05",
      phaseName: "Review Scope",
      phaseDir: ".blueprint/phases/05-review-scope",
      resolvedFrom: "explicit"
    },
    files: ["src/plan.ts", "src/summary.ts", "tests/plan.test.ts"],
    reviewMode: {
      depth: "standard",
      source: "phase-evidence"
    },
    authoringContext: {
      phase: {
        phaseNumber: "5",
        phasePrefix: "05",
        phaseName: "Review Scope",
        phaseDir: ".blueprint/phases/05-review-scope",
        resolvedFrom: "explicit"
      },
      files: ["src/plan.ts", "src/summary.ts", "tests/plan.test.ts"],
      reviewMode: {
        depth: "standard",
        source: "phase-evidence"
      },
      knownEvidenceArtifacts: [
        ".blueprint/phases/05-review-scope/05-01-PLAN.md",
        ".blueprint/phases/05-review-scope/05-01-SUMMARY.md"
      ],
      allowedNextActions: ["/blu-code-review-fix 5", "/blu-progress"]
    },
    warnings: []
  };
  const distinctResult = {
    ...duplicateResult,
    authoringContext: {
      ...duplicateResult.authoringContext,
      files: ["src/plan.ts"],
      reviewMode: {
        depth: "deep",
        source: "phase-evidence"
      }
    },
    warnings: ["Scope requires confirmation before deep review."]
  };

  const duplicatePublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_review_scope",
    duplicateResult
  );
  const distinctPublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_review_scope",
    distinctResult
  );
  const duplicateText = createToolResponseContent("blueprint_review_scope", duplicateResult)[0].text;
  const distinctText = createToolResponseContent("blueprint_review_scope", distinctResult)[0].text;

  assert.ok(!("phase" in (duplicatePublicResult.authoringContext as Record<string, unknown>)));
  assert.ok(!("files" in (duplicatePublicResult.authoringContext as Record<string, unknown>)));
  assert.ok(!("reviewMode" in (duplicatePublicResult.authoringContext as Record<string, unknown>)));
  assert.deepEqual(
    (duplicatePublicResult.authoringContext as Record<string, unknown>).knownEvidenceArtifacts,
    duplicateResult.authoringContext.knownEvidenceArtifacts
  );
  assert.ok(!("warnings" in duplicatePublicResult));
  assert.doesNotMatch(duplicateText, /"authoringContext":\{"phase":/);
  assert.doesNotMatch(duplicateText, /"authoringContext":\{[^}]*"files":/);
  assert.doesNotMatch(duplicateText, /"authoringContext":\{[^}]*"reviewMode":/);
  assert.doesNotMatch(duplicateText, /"warnings":/);

  assert.deepEqual(
    (distinctPublicResult.authoringContext as Record<string, unknown>).files,
    ["src/plan.ts"]
  );
  assert.deepEqual(
    (distinctPublicResult.authoringContext as Record<string, unknown>).reviewMode,
    {
      depth: "deep",
      source: "phase-evidence"
    }
  );
  assert.deepEqual(distinctPublicResult.warnings, distinctResult.warnings);
  assert.match(distinctText, /"authoringContext":\{/);
  assert.match(distinctText, /"files":\["src\/plan\.ts"\]/);
  assert.match(distinctText, /"reviewMode":\{"depth":"deep","source":"phase-evidence"\}/);
  assert.match(distinctText, /"warnings":\["Scope requires confirmation before deep review\."\]/);
});

test("public phase validation write success trims empty issues and warnings from MCP text", () => {
  const writeResult = {
    phaseNumber: "3",
    phasePrefix: "03",
    phaseName: "Phase Discovery",
    phaseDir: ".blueprint/phases/03-phase-discovery",
    artifact: "verification",
    path: ".blueprint/phases/03-phase-discovery/03-VERIFICATION.md",
    summaryPaths: [".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"],
    written: true,
    created: true,
    overwritten: false,
    status: "created",
    issues: [],
    warnings: []
  };
  const writeText = createToolResponseContent("blueprint_phase_validation_write", writeResult)[0].text;
  const parsed = JSON.parse(writeText);

  assert.equal(parsed.status, "created");
  assert.equal(parsed.path, writeResult.path);
  assert.ok(!("issues" in parsed));
  assert.ok(!("warnings" in parsed));
  assert.doesNotMatch(writeText, /"issues":/);
  assert.doesNotMatch(writeText, /"warnings":/);
});

test("public phase validation write success preserves non-empty warnings in MCP text", () => {
  const writeResult = {
    phaseNumber: "3",
    phasePrefix: "03",
    phaseName: "Phase Discovery",
    phaseDir: ".blueprint/phases/03-phase-discovery",
    artifact: "verification",
    path: ".blueprint/phases/03-phase-discovery/03-VERIFICATION.md",
    summaryPaths: [".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"],
    written: false,
    created: false,
    overwritten: false,
    status: "reused",
    issues: [],
    warnings: ["Preserved existing verification artifact because the content was unchanged."]
  };
  const writeText = createToolResponseContent("blueprint_phase_validation_write", writeResult)[0].text;
  const parsed = JSON.parse(writeText);

  assert.equal(parsed.status, "reused");
  assert.equal(parsed.path, writeResult.path);
  assert.ok(!("issues" in parsed));
  assert.deepEqual(parsed.warnings, writeResult.warnings);
  assert.doesNotMatch(writeText, /"issues":/);
  assert.match(writeText, /"warnings":\[/);
});

test("public artifact report write success trims empty issues and warnings from MCP text", () => {
  const writeResult = {
    path: ".blueprint/reports/cleanup-latest.md",
    written: false,
    created: false,
    overwritten: false,
    status: "reused",
    issues: [],
    warnings: []
  };
  const writeText = createToolResponseContent("blueprint_artifact_report_write", writeResult)[0].text;
  const parsed = JSON.parse(writeText);

  assert.equal(parsed.status, "reused");
  assert.equal(parsed.path, writeResult.path);
  assert.ok(!("issues" in parsed));
  assert.ok(!("warnings" in parsed));
  assert.doesNotMatch(writeText, /"issues":/);
  assert.doesNotMatch(writeText, /"warnings":/);
});

test("public artifact report write success preserves non-empty warnings in MCP text", () => {
  const writeResult = {
    path: ".blueprint/reports/cleanup-latest.md",
    written: false,
    created: false,
    overwritten: false,
    status: "reused",
    issues: [],
    warnings: ["Preserved existing report because the content was unchanged."]
  };
  const writeText = createToolResponseContent("blueprint_artifact_report_write", writeResult)[0].text;
  const parsed = JSON.parse(writeText);

  assert.equal(parsed.status, "reused");
  assert.equal(parsed.path, writeResult.path);
  assert.ok(!("issues" in parsed));
  assert.deepEqual(parsed.warnings, writeResult.warnings);
  assert.doesNotMatch(writeText, /"issues":/);
  assert.match(writeText, /"warnings":\[/);
});

test("public artifact report authoring context omits only empty top-level warnings while the raw result shape stays unchanged", () => {
  const emptyWarningsResult = {
    status: "ready",
    reportName: "add-tests-3",
    path: ".blueprint/reports/add-tests-3.md",
    phase: { phaseNumber: "3", phaseDir: ".blueprint/phases/03-phase-discovery" },
    completedSummaries: [],
    pendingPlans: [],
    dependencyPlans: [],
    validationEvidencePaths: [".blueprint/phases/03-phase-discovery/03-VERIFICATION.md"],
    selectedEvidencePaths: [],
    scopeFiles: [],
    auditFixContext: null,
    writeArgs: { reportName: "add-tests-3" },
    allowedNextActions: ["/blu-add-tests 3"],
    schemaPath: "#/$defs/addTestsReportModel",
    baseSchema: { type: "object" },
    taskSchema: { type: "object" },
    modelOnly: true,
    prerequisiteBlockers: [],
    reason: null,
    warnings: [] as string[]
  };
  const warnedResult = {
    ...emptyWarningsResult,
    warnings: ["Verification evidence required basename normalization before narrowing the task schema."]
  };

  const emptyWarningsPublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_artifact_report_authoring_context",
    emptyWarningsResult
  );
  const emptyWarningsText = createToolResponseContent(
    "blueprint_artifact_report_authoring_context",
    emptyWarningsResult
  )[0].text;
  const emptyWarningsParsed = JSON.parse(emptyWarningsText);
  const warnedPublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_artifact_report_authoring_context",
    warnedResult
  );
  const warnedText = createToolResponseContent(
    "blueprint_artifact_report_authoring_context",
    warnedResult
  )[0].text;
  const warnedParsed = JSON.parse(warnedText);

  assert.ok("warnings" in emptyWarningsResult);
  assert.deepEqual(emptyWarningsResult.warnings, []);
  assert.ok(!("warnings" in emptyWarningsPublicResult));
  assert.ok(!("warnings" in emptyWarningsParsed));
  assert.doesNotMatch(emptyWarningsText, /"warnings":/);
  assert.deepEqual(warnedResult.warnings, [
    "Verification evidence required basename normalization before narrowing the task schema."
  ]);
  assert.deepEqual(warnedPublicResult.warnings, warnedResult.warnings);
  assert.deepEqual(warnedParsed.warnings, warnedResult.warnings);
  assert.match(warnedText, /"warnings":\[/);
});

test("public impact report write success trims empty errors and empty warnings from MCP text", () => {
  for (const status of ["written", "overwritten", "reused"] as const) {
    const writeResult = {
      impactId: "impact-2026-05-09",
      impactDir: ".blueprint/impact/impact-2026-05-09",
      paths: {
        report: ".blueprint/impact/impact-2026-05-09/REPORT.json"
      },
      written: status !== "reused",
      status,
      errors: [],
      warnings: []
    };
    const writeText = createToolResponseContent("blueprint_impact_report_write", writeResult)[0].text;
    const parsed = JSON.parse(writeText);

    assert.equal(parsed.status, status);
    assert.equal(parsed.impactId, writeResult.impactId);
    assert.ok(!("errors" in parsed));
    assert.ok(!("warnings" in parsed));
    assert.doesNotMatch(writeText, /"errors":/);
    assert.doesNotMatch(writeText, /"warnings":/);
  }
});

test("public impact report write success preserves non-empty warnings in MCP text", () => {
  for (const status of ["written", "overwritten", "reused"] as const) {
    const writeResult = {
      impactId: "impact-2026-05-09",
      impactDir: ".blueprint/impact/impact-2026-05-09",
      paths: {
        report: ".blueprint/impact/impact-2026-05-09/REPORT.json"
      },
      written: status !== "reused",
      status,
      errors: [],
      warnings: ["Impact bundle already matched the canonical content."]
    };
    const writeText = createToolResponseContent("blueprint_impact_report_write", writeResult)[0].text;
    const parsed = JSON.parse(writeText);

    assert.equal(parsed.status, status);
    assert.equal(parsed.impactId, writeResult.impactId);
    assert.ok(!("errors" in parsed));
    assert.deepEqual(parsed.warnings, writeResult.warnings);
    assert.doesNotMatch(writeText, /"errors":/);
    assert.match(writeText, /"warnings":\["Impact bundle already matched the canonical content."\]/);
  }
});

test("public impact report write invalid response keeps errors while omitting empty top-level warnings in MCP text", () => {
  const writeResult = {
    impactId: "impact-2026-05-09",
    impactDir: ".blueprint/impact/impact-2026-05-09",
    paths: {
      report: ".blueprint/impact/impact-2026-05-09/REPORT.json"
    },
    written: false,
    status: "invalid",
    errors: ["Report summary counts did not match the findings payload."],
    warnings: []
  };
  const writeText = createToolResponseContent("blueprint_impact_report_write", writeResult)[0].text;
  const parsed = JSON.parse(writeText);

  assert.equal(parsed.status, "invalid");
  assert.deepEqual(parsed.errors, writeResult.errors);
  assert.ok(!("warnings" in parsed));
  assert.match(writeText, /"errors":\["Report summary counts did not match the findings payload."\]/);
  assert.doesNotMatch(writeText, /"warnings":/);
});

test("public pause handoff write trims the saved handoff document and omits only empty top-level warnings from MCP text", () => {
  const createdResult = {
    path: ".blueprint/reports/pause-work-latest.md",
    written: true,
    created: true,
    overwritten: false,
    status: "created",
    handoff: {
      reportType: "pause-work",
      schemaVersion: 1,
      status: "paused",
      currentPhase: "3",
      currentState: "Paused after verifying the handoff route."
    },
    warnings: []
  };
  const reusedResult = {
    ...createdResult,
    written: false,
    created: false,
    status: "reused",
    warnings: ["Preserved existing pause handoff because the content was unchanged."]
  };
  const invalidResult = {
    ...createdResult,
    written: false,
    created: false,
    status: "invalid",
    warnings: []
  };
  const invalidWarnedResult = {
    ...invalidResult,
    warnings: ["Validation failed after assembling the pause handoff report."]
  };
  const createdText = createToolResponseContent("blueprint_pause_handoff_write", createdResult)[0].text;
  const reusedText = createToolResponseContent("blueprint_pause_handoff_write", reusedResult)[0].text;
  const invalidText = createToolResponseContent("blueprint_pause_handoff_write", invalidResult)[0].text;
  const invalidWarnedText = createToolResponseContent(
    "blueprint_pause_handoff_write",
    invalidWarnedResult
  )[0].text;
  const createdParsed = JSON.parse(createdText);
  const reusedParsed = JSON.parse(reusedText);
  const invalidParsed = JSON.parse(invalidText);
  const invalidWarnedParsed = JSON.parse(invalidWarnedText);

  assert.equal(createdParsed.status, "created");
  assert.equal(createdParsed.path, createdResult.path);
  assert.equal(createdParsed.created, true);
  assert.ok(!("handoff" in createdParsed));
  assert.ok(!("warnings" in createdParsed));
  assert.doesNotMatch(createdText, /"handoff":/);
  assert.doesNotMatch(createdText, /"warnings":/);

  assert.equal(reusedParsed.status, "reused");
  assert.ok(!("handoff" in reusedParsed));
  assert.deepEqual(reusedParsed.warnings, reusedResult.warnings);
  assert.doesNotMatch(reusedText, /"handoff":/);
  assert.match(reusedText, /"warnings":\[/);

  assert.equal(invalidParsed.status, "invalid");
  assert.ok(!("handoff" in invalidParsed));
  assert.ok(!("warnings" in invalidParsed));
  assert.doesNotMatch(invalidText, /"handoff":/);
  assert.doesNotMatch(invalidText, /"warnings":/);

  assert.equal(invalidWarnedParsed.status, "invalid");
  assert.ok(!("handoff" in invalidWarnedParsed));
  assert.deepEqual(invalidWarnedParsed.warnings, invalidWarnedResult.warnings);
  assert.doesNotMatch(invalidWarnedText, /"handoff":/);
  assert.match(invalidWarnedText, /"warnings":\[/);
});

test("public pause handoff get omits only empty top-level warnings from MCP text", () => {
  const result = {
    found: true,
    path: ".blueprint/reports/pause-work-latest.md",
    content: "# Pause Work Handoff\n",
    handoff: {
      reportType: "pause-work",
      schemaVersion: 1,
      status: "paused",
      currentPhase: "3",
      currentState: "Paused after verifying the public MCP trim."
    },
    warnings: []
  };

  const publicResult = sanitizeToolResultForPublicResponse("blueprint_pause_handoff_get", result);
  const text = createToolResponseContent("blueprint_pause_handoff_get", result)[0].text;
  const parsed = JSON.parse(text);

  assert.deepEqual(result.warnings, []);
  assert.ok(!("warnings" in publicResult));
  assert.ok(!("warnings" in parsed));
  assert.equal(parsed.found, true);
  assert.equal(parsed.path, result.path);
  assert.equal(parsed.content, result.content);
  assert.deepEqual(parsed.handoff, result.handoff);
  assert.doesNotMatch(text, /"warnings":/);
});

test("public artifact mutate index trims duplicate matched entry ids from MCP text", () => {
  const writeResult = {
    status: "listed",
    targetPath: ".blueprint/todos/TODO.md",
    createdEntryIds: [],
    duplicateEntryIds: [],
    matchedEntryIds: ["TODO-002", "TODO-001"],
    updatedCounts: {
      added: 0,
      updated: 0,
      duplicates: 0,
      preserved: 3
    },
    reservedPhase: null,
    entries: [
      { id: "TODO-002", status: "active", description: "Harden auth handoff" },
      { id: "TODO-001", status: "open", description: "Add retry telemetry" }
    ],
    summary: {
      total: 3,
      matched: 2,
      open: 1,
      active: 1,
      completed: 0,
      other: 0
    },
    warnings: []
  };
  const writeText = createToolResponseContent("blueprint_artifact_mutate_index", writeResult)[0].text;
  const parsed = JSON.parse(writeText);

  assert.ok(!("matchedEntryIds" in parsed));
  assert.deepEqual(
    parsed.entries.map((entry: { id: string }) => entry.id),
    ["TODO-002", "TODO-001"]
  );
  assert.doesNotMatch(writeText, /"matchedEntryIds":/);
});

test("public workspace create trims registryPath, duplicate top-level path fields, nested manifestPath, and repoMembers from MCP text", () => {
  const repoMember = {
    name: "blueprint",
    sourcePath: "/repos/blueprint",
    path: "/workspaces/feature-a/blueprint",
    strategy: "worktree",
    branch: "feature-a",
    head: "abc123",
    blueprintProject: true
  };
  const writeResult = {
    workspacePath: "/workspaces/feature-a",
    manifestPath: "/workspaces/feature-a/.blueprint-workspace.json",
    registryPath: "/registry/workspaces.json",
    registryEntry: {
      name: "feature-a",
      path: "/workspaces/feature-a",
      manifestPath: "/workspaces/feature-a/.blueprint-workspace.json",
      strategy: "worktree",
      branch: "feature-a",
      createdAt: "2026-05-09T00:00:00.000Z",
      repos: [repoMember]
    },
    repoMembers: [repoMember]
  };
  const writeText = createToolResponseContent("blueprint_workspace_create", writeResult)[0].text;
  const parsed = JSON.parse(writeText);

  assert.deepEqual(parsed.registryEntry, {
    name: "feature-a",
    path: "/workspaces/feature-a",
    strategy: "worktree",
    branch: "feature-a",
    createdAt: "2026-05-09T00:00:00.000Z",
    repos: [repoMember]
  });
  assert.ok(!("registryPath" in parsed));
  assert.ok(!("workspacePath" in parsed));
  assert.ok(!("manifestPath" in parsed));
  assert.ok(!("manifestPath" in parsed.registryEntry));
  assert.ok(!("repoMembers" in parsed));
  assert.doesNotMatch(writeText, /"registryPath":/);
  assert.doesNotMatch(writeText, /^\{"workspacePath":/);
  assert.doesNotMatch(writeText, /"manifestPath":/);
  assert.doesNotMatch(writeText, /"repoMembers":/);
});

test("public workspace remove trims registryPath, duplicate top-level path fields, nested manifestPath, and keeps members when they differ from removedEntry.repos", () => {
  const removedEntryRepo = {
    name: "blueprint",
    sourcePath: "/repos/blueprint",
    path: "/workspaces/feature-a/blueprint",
    strategy: "worktree",
    branch: "feature-a",
    head: "abc123",
    blueprintProject: true
  };
  const removedMember = {
    ...removedEntryRepo,
    head: "def456"
  };
  const writeResult = {
    removedPath: "/workspaces/feature-a",
    manifestPath: "/workspaces/feature-a/.blueprint-workspace.json",
    registryPath: "/registry/workspaces.json",
    removedEntry: {
      name: "feature-a",
      path: "/workspaces/feature-a",
      manifestPath: "/workspaces/feature-a/.blueprint-workspace.json",
      strategy: "worktree",
      branch: "feature-a",
      createdAt: "2026-05-09T00:00:00.000Z",
      repos: [removedEntryRepo]
    },
    removedMembers: [removedMember],
    skippedMembers: []
  };
  const writeText = createToolResponseContent("blueprint_workspace_remove", writeResult)[0].text;
  const parsed = JSON.parse(writeText);

  assert.deepEqual(parsed.removedEntry, {
    name: "feature-a",
    path: "/workspaces/feature-a",
    strategy: "worktree",
    branch: "feature-a",
    createdAt: "2026-05-09T00:00:00.000Z",
    repos: [removedEntryRepo]
  });
  assert.ok(!("registryPath" in parsed));
  assert.ok(!("removedPath" in parsed));
  assert.ok(!("manifestPath" in parsed));
  assert.ok(!("manifestPath" in parsed.removedEntry));
  assert.deepEqual(parsed.removedMembers, [removedMember]);
  assert.doesNotMatch(writeText, /"registryPath":/);
  assert.doesNotMatch(writeText, /^\{"removedPath":/);
  assert.doesNotMatch(writeText, /"manifestPath":/);
  assert.match(writeText, /"removedMembers":/);
});

test("public workspace create live MCP response trims registryPath, redundant path, nested manifestPath, and repo member fields", async () => {
  const { globalHome, repoPath, workspacePath } = await createWorkspaceRoundTripFixture();
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-workspace-create-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    await withEnvOverrides(
      {
        BLUEPRINT_GLOBAL_HOME: globalHome
      },
      async () => {
        const response = await client.callTool({
          name: "blueprint_workspace_create",
          arguments: {
            cwd: repoPath,
            name: "feature-a",
            path: workspacePath
          }
        });

        assert.equal(response.content[0]?.type, "text");
        assert.ok(response.structuredContent);
        assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
        assert.equal(response.structuredContent.registryEntry?.path, workspacePath);
        assert.equal(response.structuredContent.registryEntry?.name, "feature-a");
        assert.equal(response.structuredContent.registryEntry?.strategy, "worktree");
        assert.equal(response.structuredContent.registryEntry?.branch, null);
        assert.equal(response.structuredContent.registryEntry?.repos.length, 1);
        assert.equal(
          response.structuredContent.registryEntry?.repos?.[0]?.path,
          path.join(workspacePath, path.basename(repoPath).toLowerCase())
        );
        assert.ok(!("registryPath" in response.structuredContent));
        assert.ok(!("workspacePath" in response.structuredContent));
        assert.ok(!("manifestPath" in response.structuredContent));
        assert.ok(!("manifestPath" in (response.structuredContent.registryEntry ?? {})));
        assert.ok(!("repoMembers" in response.structuredContent));
        assert.doesNotMatch(response.content[0]?.text ?? "", /"registryPath":/);
        assert.doesNotMatch(response.content[0]?.text ?? "", /"manifestPath":/);
        assert.doesNotMatch(response.content[0]?.text ?? "", /"repoMembers":/);
      }
    );
  } finally {
    await Promise.all([client.close(), server.close()]);
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public workspace remove live MCP response trims registryPath, redundant path, nested manifestPath, and removed member fields", async () => {
  const { globalHome, repoPath, workspacePath } = await createWorkspaceRoundTripFixture();
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-workspace-remove-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    await withEnvOverrides(
      {
        BLUEPRINT_GLOBAL_HOME: globalHome
      },
      async () => {
        const createResponse = await client.callTool({
          name: "blueprint_workspace_create",
          arguments: {
            cwd: repoPath,
            name: "feature-a",
            path: workspacePath
          }
        });

        assert.equal(createResponse.structuredContent?.registryEntry?.repos.length, 1);

        const response = await client.callTool({
          name: "blueprint_workspace_remove",
          arguments: {
            cwd: repoPath,
            name: "feature-a",
            path: workspacePath
          }
        });

        assert.equal(response.content[0]?.type, "text");
        assert.ok(response.structuredContent);
        assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
        assert.equal(response.structuredContent.removedEntry?.path, workspacePath);
        assert.equal(response.structuredContent.removedEntry?.name, "feature-a");
        assert.equal(response.structuredContent.removedEntry?.strategy, "worktree");
        assert.equal(response.structuredContent.removedEntry?.branch, null);
        assert.equal(response.structuredContent.removedEntry?.repos.length, 1);
        assert.equal(
          response.structuredContent.removedEntry?.repos?.[0]?.path,
          path.join(workspacePath, path.basename(repoPath).toLowerCase())
        );
        assert.ok(!("registryPath" in response.structuredContent));
        assert.ok(!("removedPath" in response.structuredContent));
        assert.ok(!("manifestPath" in response.structuredContent));
        assert.ok(!("manifestPath" in (response.structuredContent.removedEntry ?? {})));
        assert.ok(!("removedMembers" in response.structuredContent));
        assert.doesNotMatch(response.content[0]?.text ?? "", /"registryPath":/);
        assert.doesNotMatch(response.content[0]?.text ?? "", /"manifestPath":/);
        assert.doesNotMatch(response.content[0]?.text ?? "", /"removedMembers":/);
      }
    );
  } finally {
    await Promise.all([client.close(), server.close()]);
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public workspace registry get trims registryPath and nested manifestPath at the MCP boundary", () => {
  const result = {
    registryPath: "/tmp/global-home/workspaces.json",
    workspaces: [
      {
        name: "feature-a",
        path: "/tmp/workspaces/feature-a",
        manifestPath: "/tmp/workspaces/feature-a/.blueprint-workspace.json",
        strategy: "worktree",
        branch: "feature-a",
        createdAt: "2026-05-09T00:00:00.000Z",
        repos: []
      }
    ]
  };
  const text = createToolResponseContent("blueprint_workspace_registry_get", result)[0].text;
  const parsed = JSON.parse(text);

  assert.deepEqual(parsed.workspaces, [
    {
      name: "feature-a",
      path: "/tmp/workspaces/feature-a",
      strategy: "worktree",
      branch: "feature-a",
      createdAt: "2026-05-09T00:00:00.000Z",
      repos: []
    }
  ]);
  assert.equal(parsed.workspaces[0].name, result.workspaces[0].name);
  assert.equal(parsed.workspaces[0].path, result.workspaces[0].path);
  assert.equal(parsed.workspaces[0].strategy, result.workspaces[0].strategy);
  assert.equal(parsed.workspaces[0].branch, result.workspaces[0].branch);
  assert.equal(parsed.workspaces[0].createdAt, result.workspaces[0].createdAt);
  assert.deepEqual(parsed.workspaces[0].repos, result.workspaces[0].repos);
  assert.ok(!("manifestPath" in parsed.workspaces[0]));
  assert.ok(!("registryPath" in parsed));
  assert.doesNotMatch(text, /"registryPath":/);
  assert.doesNotMatch(text, /"manifestPath":/);
});

test("public workspace registry get live MCP response trims registryPath and nested manifestPath while keeping workspace metadata", async () => {
  const { globalHome, repoPath, workspacePath } = await createWorkspaceRoundTripFixture();
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-workspace-registry-get-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    await withEnvOverrides(
      {
        BLUEPRINT_GLOBAL_HOME: globalHome
      },
      async () => {
        await client.callTool({
          name: "blueprint_workspace_create",
          arguments: {
            cwd: repoPath,
            name: "feature-a",
            path: workspacePath
          }
        });

        const response = await client.callTool({
          name: "blueprint_workspace_registry_get",
          arguments: {}
        });

        assert.equal(response.content[0]?.type, "text");
        assert.ok(response.structuredContent);
        assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
        assert.ok(!("registryPath" in response.structuredContent));
        assert.equal(response.structuredContent.workspaces?.length, 1);
        assert.equal(response.structuredContent.workspaces?.[0]?.name, "feature-a");
        assert.equal(response.structuredContent.workspaces?.[0]?.path, workspacePath);
        assert.equal(response.structuredContent.workspaces?.[0]?.strategy, "worktree");
        assert.equal(response.structuredContent.workspaces?.[0]?.branch, null);
        assert.match(
          response.structuredContent.workspaces?.[0]?.createdAt ?? "",
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
        );
        assert.equal(response.structuredContent.workspaces?.[0]?.repos?.length, 1);
        assert.equal(
          response.structuredContent.workspaces?.[0]?.repos?.[0]?.name,
          path.basename(repoPath).toLowerCase()
        );
        assert.match(
          response.structuredContent.workspaces?.[0]?.repos?.[0]?.sourcePath ?? "",
          new RegExp(`${path.basename(repoPath)}$`)
        );
        assert.equal(
          response.structuredContent.workspaces?.[0]?.repos?.[0]?.path,
          path.join(workspacePath, path.basename(repoPath).toLowerCase())
        );
        assert.equal(response.structuredContent.workspaces?.[0]?.repos?.[0]?.strategy, "worktree");
        assert.equal(response.structuredContent.workspaces?.[0]?.repos?.[0]?.branch, null);
        assert.match(
          response.structuredContent.workspaces?.[0]?.repos?.[0]?.head ?? "",
          /^[0-9a-f]{40}$/
        );
        assert.equal(response.structuredContent.workspaces?.[0]?.repos?.[0]?.blueprintProject, false);
        assert.ok(!("manifestPath" in (response.structuredContent.workspaces?.[0] ?? {})));
        assert.doesNotMatch(response.content[0]?.text ?? "", /"registryPath":/);
        assert.doesNotMatch(response.content[0]?.text ?? "", /"manifestPath":/);
      }
    );
  } finally {
    await Promise.all([client.close(), server.close()]);
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public workstream list trims duplicate active and omits empty top-level warnings from MCP text", () => {
  const activeWorkstream = {
    version: 1,
    name: "Alpha Stream",
    slug: "alpha-stream",
    status: "active",
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
    activatedAt: "2026-05-09T00:00:00.000Z",
    completedAt: null,
    stateSnapshot: {
      projectStatus: "active",
      currentMilestone: "v1",
      currentPhase: "1",
      activeCommand: "/blu-plan-phase",
      nextAction: "Run /blu-execute-phase 1",
      blockers: ["none"],
      roadmapEvolutionNotes: []
    },
    statePath: ".blueprint/workstreams/alpha-stream/state.json"
  };
  const listResult = {
    status: "ready",
    rootPath: ".blueprint/workstreams",
    indexPath: ".blueprint/workstreams/WORKSTREAMS.md",
    active: activeWorkstream,
    workstreams: [activeWorkstream],
    summary: {
      total: 1,
      active: 1,
      paused: 0,
      completed: 0,
      nextAction: "Run /blu-progress to inspect the current active workstream."
    },
    warnings: [],
    waitingState: null,
    reason: null
  };
  const writeText = createToolResponseContent("blueprint_workstream_list", listResult)[0].text;
  const parsed = JSON.parse(writeText);

  assert.equal(parsed.status, "ready");
  assert.equal(parsed.workstreams.length, 1);
  assert.deepEqual(parsed.workstreams[0], {
    version: 1,
    name: "Alpha Stream",
    slug: "alpha-stream",
    status: "active",
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
    activatedAt: "2026-05-09T00:00:00.000Z",
    completedAt: null,
    stateSnapshot: {
      projectStatus: "active",
      currentMilestone: "v1",
      currentPhase: "1",
      activeCommand: "/blu-plan-phase",
      nextAction: "Run /blu-execute-phase 1",
      blockers: ["none"],
      roadmapEvolutionNotes: []
    }
  });
  assert.equal(parsed.summary?.active, 1);
  assert.ok(!("active" in parsed));
  assert.ok(!("rootPath" in parsed));
  assert.ok(!("indexPath" in parsed));
  assert.ok(!("warnings" in parsed));
  assert.ok(!("statePath" in parsed.workstreams[0]));
  assert.doesNotMatch(writeText, /"active":\{/);
  assert.doesNotMatch(writeText, /"rootPath":/);
  assert.doesNotMatch(writeText, /"indexPath":/);
  assert.doesNotMatch(writeText, /"warnings":/);
  assert.doesNotMatch(writeText, /"statePath":/);
});

test("public workstream list preserves non-empty top-level warnings in MCP text", () => {
  const activeWorkstream = {
    version: 1,
    name: "Alpha Stream",
    slug: "alpha-stream",
    status: "active",
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
    activatedAt: "2026-05-09T00:00:00.000Z",
    completedAt: null,
    stateSnapshot: {
      projectStatus: "active",
      currentMilestone: "v1",
      currentPhase: "1",
      activeCommand: "/blu-plan-phase",
      nextAction: "Run /blu-execute-phase 1",
      blockers: ["none"],
      roadmapEvolutionNotes: []
    },
    statePath: ".blueprint/workstreams/alpha-stream/state.json"
  };
  const listResult = {
    status: "ready",
    rootPath: ".blueprint/workstreams",
    indexPath: ".blueprint/workstreams/WORKSTREAMS.md",
    active: activeWorkstream,
    workstreams: [activeWorkstream],
    summary: {
      total: 1,
      active: 1,
      paused: 0,
      completed: 0,
      nextAction: "Run /blu-progress to inspect the current active workstream."
    },
    warnings: ["Workstream index was regenerated earlier in this session."],
    waitingState: null,
    reason: null
  };
  const writeText = createToolResponseContent("blueprint_workstream_list", listResult)[0].text;
  const parsed = JSON.parse(writeText);

  assert.deepEqual(parsed.warnings, ["Workstream index was regenerated earlier in this session."]);
  assert.equal(parsed.workstreams.length, 1);
  assert.ok(!("active" in parsed));
  assert.ok(!("rootPath" in parsed));
  assert.ok(!("indexPath" in parsed));
  assert.ok(!("statePath" in parsed.workstreams[0]));
});

test("public workstream mutate trims duplicate active and omits empty top-level warnings from MCP text", () => {
  const activeWorkstream = {
    version: 1,
    name: "Alpha Stream",
    slug: "alpha-stream",
    status: "active",
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
    activatedAt: "2026-05-09T00:00:00.000Z",
    completedAt: null,
    stateSnapshot: {
      projectStatus: "active",
      currentMilestone: "v1",
      currentPhase: "1",
      activeCommand: "/blu-plan-phase",
      nextAction: "Run /blu-execute-phase 1",
      blockers: ["none"],
      roadmapEvolutionNotes: []
    },
    statePath: ".blueprint/workstreams/alpha-stream/state.json"
  };
  const mutateResult = {
    status: "updated",
    operation: "create",
    rootPath: ".blueprint/workstreams",
    indexPath: ".blueprint/workstreams/WORKSTREAMS.md",
    active: activeWorkstream,
    workstreams: [activeWorkstream],
    affectedPaths: [
      ".blueprint/workstreams/WORKSTREAMS.md",
      ".blueprint/workstreams/alpha-stream/state.json"
    ],
    warnings: [],
    waitingState: null,
    nextAction: "Continue the active workstream alpha-stream or inspect repo status with /blu-progress.",
    reason: null,
    statePatch: null
  };
  const writeText = createToolResponseContent("blueprint_workstream_mutate", mutateResult)[0].text;
  const parsed = JSON.parse(writeText);

  assert.equal(parsed.status, "updated");
  assert.equal(parsed.workstreams.length, 1);
  assert.deepEqual(parsed.workstreams[0], {
    version: 1,
    name: "Alpha Stream",
    slug: "alpha-stream",
    status: "active",
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
    activatedAt: "2026-05-09T00:00:00.000Z",
    completedAt: null,
    stateSnapshot: {
      projectStatus: "active",
      currentMilestone: "v1",
      currentPhase: "1",
      activeCommand: "/blu-plan-phase",
      nextAction: "Run /blu-execute-phase 1",
      blockers: ["none"],
      roadmapEvolutionNotes: []
    }
  });
  assert.equal(parsed.nextAction, "Continue the active workstream alpha-stream or inspect repo status with /blu-progress.");
  assert.ok(!("active" in parsed));
  assert.ok(!("rootPath" in parsed));
  assert.ok(!("indexPath" in parsed));
  assert.ok(!("warnings" in parsed));
  assert.ok(!("statePath" in parsed.workstreams[0]));
  assert.doesNotMatch(writeText, /"active":\{/);
  assert.doesNotMatch(writeText, /"rootPath":/);
  assert.doesNotMatch(writeText, /"indexPath":/);
  assert.doesNotMatch(writeText, /"warnings":/);
  assert.doesNotMatch(writeText, /"statePath":/);
});

test("public workstream mutate preserves non-empty top-level warnings in MCP text", () => {
  const activeWorkstream = {
    version: 1,
    name: "Alpha Stream",
    slug: "alpha-stream",
    status: "active",
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
    activatedAt: "2026-05-09T00:00:00.000Z",
    completedAt: null,
    stateSnapshot: {
      projectStatus: "active",
      currentMilestone: "v1",
      currentPhase: "1",
      activeCommand: "/blu-plan-phase",
      nextAction: "Run /blu-execute-phase 1",
      blockers: ["none"],
      roadmapEvolutionNotes: []
    },
    statePath: ".blueprint/workstreams/alpha-stream/state.json"
  };
  const mutateResult = {
    status: "updated",
    operation: "create",
    rootPath: ".blueprint/workstreams",
    indexPath: ".blueprint/workstreams/WORKSTREAMS.md",
    active: activeWorkstream,
    workstreams: [activeWorkstream],
    affectedPaths: [
      ".blueprint/workstreams/WORKSTREAMS.md",
      ".blueprint/workstreams/alpha-stream/state.json"
    ],
    warnings: ["Workstream state reused the existing activation snapshot."],
    waitingState: null,
    nextAction: "Continue the active workstream alpha-stream or inspect repo status with /blu-progress.",
    reason: null,
    statePatch: null
  };
  const writeText = createToolResponseContent("blueprint_workstream_mutate", mutateResult)[0].text;
  const parsed = JSON.parse(writeText);

  assert.deepEqual(parsed.warnings, ["Workstream state reused the existing activation snapshot."]);
  assert.equal(parsed.workstreams.length, 1);
  assert.ok(!("active" in parsed));
  assert.ok(!("rootPath" in parsed));
  assert.ok(!("indexPath" in parsed));
  assert.ok(!("statePath" in parsed.workstreams[0]));
});

test("review model tools mirror authoring context and repair details into MCP text", () => {
  const authoringResult = {
    status: "ready",
    artifact: "security",
    phase: { phaseNumber: "5" },
    authoringContext: {
      knownEvidenceArtifacts: [
        ".blueprint/phases/05-security-audit/05-01-PLAN.md",
        ".blueprint/phases/05-security-audit/05-01-SUMMARY.md"
      ],
      allowedNextActions: ["/blu-validate-phase 5", "Blocked: pending-open-threat"],
      declaredThreats: [{ threatId: "T-01", sourcePlan: "05-01-PLAN.md" }],
      taskSchema: { omittedFromCompactContext: true },
      baseSchema: { omittedFromCompactContext: true }
    },
    taskSchema: {
      properties: {
        evidenceCoverage: {
          properties: {
            ".blueprint/phases/05-security-audit/05-01-PLAN.md": {}
          }
        }
      }
    },
    prerequisiteBlockers: []
  };
  const validateResult = {
    status: "invalid",
    valid: false,
    phase: { phaseNumber: "5" },
    artifact: "security",
    diagnostics: [
      {
        source: "schema",
        path: "model.evidenceCoverage[\".blueprint/phases/05-security-audit/05-01-PLAN.md\"].status",
        code: "schema.enum",
        message:
          "model.evidenceCoverage[\".blueprint/phases/05-security-audit/05-01-PLAN.md\"].status must be equal to one of the allowed values: used, deferred, unavailable.",
        allowedValues: ["used", "deferred", "unavailable"],
        repair:
          "Set model.evidenceCoverage[\".blueprint/phases/05-security-audit/05-01-PLAN.md\"].status to one of the allowed values."
      }
    ],
    diagnosticCounts: {
      total: 1,
      bySource: { schema: 1 },
      byCode: { "schema.enum": 1 }
    },
    repairSummary: {
      topBlockers: [
        "model.evidenceCoverage[\".blueprint/phases/05-security-audit/05-01-PLAN.md\"].status: invalid status"
      ],
      fieldsToChange: [
        "model.evidenceCoverage[\".blueprint/phases/05-security-audit/05-01-PLAN.md\"].status"
      ],
      firstPassActions: ["replace"],
      action: "retry_validation",
      retryable: true,
      retryInstruction: "Repair every diagnostic by exact path."
    },
    normalizedModel: null,
    renderPreview: null
  };
  const recordResult = {
    phaseNumber: "5",
    artifact: "security",
    reportPath: ".blueprint/phases/05-security-audit/05-SECURITY.md",
    written: false,
    created: false,
    overwritten: false,
    status: "invalid",
    diagnostics: [
      {
        source: "schema",
        path: "model.nextSafeAction",
        code: "schema.enum",
        message: "model.nextSafeAction must be equal to one of the allowed values: /blu-progress.",
        repair: "Set model.nextSafeAction to /blu-progress."
      }
    ],
    repairSummary: {
      topBlockers: ["model.nextSafeAction: invalid route"],
      fieldsToChange: ["model.nextSafeAction"],
      firstPassActions: ["replace"],
      action: "retry_validation",
      retryable: true,
      retryInstruction: "Repair every diagnostic by exact path."
    },
    warnings: []
  };
  const authoringText = createToolResponseContent(
    "blueprint_review_authoring_context",
    authoringResult
  )[0].text;
  const validateText = createToolResponseContent(
    "blueprint_review_validate_model",
    validateResult
  )[0].text;
  const recordText = createToolResponseContent("blueprint_review_record", recordResult)[0].text;

  assert.equal(
    authoringText,
    expectedStructuredContentJson(authoringResult)
  );
  assert.match(authoringText, /authoringContext|allowedNextActions|declaredThreats|taskSchema/);
  assert.equal(
    validateText,
    expectedStructuredContentJson(validateResult)
  );
  assert.match(validateText, /diagnostics|repairSummary|normalizedModel/);
  assert.equal(
    recordText,
    expectedStructuredContentJson(recordResult)
  );
  assert.match(recordText, /diagnostics|repairSummary/);
});

test("public review validate tool trims taskSchema, normalized model, and render preview", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-review-validate-public-"));
  const repoPath = path.join(tempRoot, "repo");

  await execFileAsync("git", ["init", repoPath]);

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-review-validate-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_review_validate_model",
      arguments: {
        cwd: repoPath,
        artifact: "security",
        model: {}
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    const publicResult = JSON.parse(response.content[0]?.text ?? "{}");
    assert.ok(!("taskSchema" in publicResult));
    assert.ok(!("normalizedModel" in publicResult));
    assert.ok(!("renderPreview" in publicResult));
    assert.ok(Array.isArray(publicResult.diagnostics));
    assert.equal(publicResult.diagnosticCounts?.total, 1);
    assert.equal(publicResult.repairSummary?.action, "reread_authoring_context");
    assert.match(response.content[0]?.text ?? "", /diagnostics|diagnosticCounts|repairSummary/);
    assert.doesNotMatch(
      response.content[0]?.text ?? "",
      /taskSchema|normalizedModel|renderPreview/
    );
  } finally {
    await client.close();
    await server.close();
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("public pause handoff write live MCP response trims invalid public handoff echoes while leaving the direct handler result unchanged", async () => {
  const directCreatedRepoPath = await createPauseHandoffWriteRepo();
  const publicCreatedRepoPath = await createPauseHandoffWriteRepo();
  const reusedRepoPath = await createPauseHandoffWriteRepo();
  const invalidRepoPath = await createPauseHandoffWriteRepo();
  const handoffArguments = {
    currentState: "Paused after reviewing the execution-ready plan and before starting code changes.",
    completedWork: [
      "Confirmed the phase is execution-ready.",
      "Reviewed the existing plan artifact."
    ],
    remainingWork: ["Run /blu-execute-phase 3 once work resumes."],
    decisions: ["Keep the handoff as a single canonical report in .blueprint/reports/."],
    blockers: ["Waiting for the next implementation session to continue execution work."],
    humanActionsPending: ["Decide when to resume execution for Phase 3."],
    modifiedFiles: ["src/mcp/server.ts", "tests/mcp-server-summary.test.ts"],
    contextNotes:
      "Resume by reviewing the handoff first, then continue with the queued execution step.",
    nextAction:
      "Start by reading .blueprint/reports/pause-work-latest.md and then run /blu-resume-work."
  };
  const directCreatedResult = await blueprintToolRegistry.blueprint_pause_handoff_write.handler({
    cwd: directCreatedRepoPath,
    ...handoffArguments
  });
  await blueprintToolRegistry.blueprint_pause_handoff_write.handler({
    cwd: reusedRepoPath,
    ...handoffArguments
  });
  const directReusedResult = await blueprintToolRegistry.blueprint_pause_handoff_write.handler({
    cwd: reusedRepoPath,
    ...handoffArguments
  });

  assert.deepEqual(directCreatedResult.warnings, []);
  assert.deepEqual(directReusedResult.warnings, [
    "Preserved existing pause handoff because the content was unchanged."
  ]);

  const pauseHandoffTool = blueprintToolRegistry.blueprint_pause_handoff_write;
  const originalPauseHandoffHandler = pauseHandoffTool.handler;
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-pause-handoff-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const createdResponse = await client.callTool({
      name: "blueprint_pause_handoff_write",
      arguments: {
        cwd: publicCreatedRepoPath,
        ...handoffArguments
      }
    });
    const reusedResponse = await client.callTool({
      name: "blueprint_pause_handoff_write",
      arguments: {
        cwd: reusedRepoPath,
        ...handoffArguments
      }
    });
    pauseHandoffTool.handler = async () => ({
      path: ".blueprint/reports/pause-work-latest.md",
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      handoff: {
        reportType: "pause-work",
        schemaVersion: 1,
        status: "paused",
        currentPhase: "3",
        currentState: handoffArguments.currentState
      },
      warnings: []
    });
    const directInvalidResult = await pauseHandoffTool.handler({
      cwd: invalidRepoPath,
      ...handoffArguments
    });
    const invalidResponse = await client.callTool({
      name: "blueprint_pause_handoff_write",
      arguments: {
        cwd: invalidRepoPath,
        ...handoffArguments
      }
    });

    assert.equal(createdResponse.content[0]?.type, "text");
    assert.ok(createdResponse.structuredContent);
    assert.equal(createdResponse.content[0]?.text, JSON.stringify(createdResponse.structuredContent));
    assert.equal(createdResponse.structuredContent.status, "created");
    assert.equal(createdResponse.structuredContent.path, ".blueprint/reports/pause-work-latest.md");
    assert.ok(!("handoff" in createdResponse.structuredContent));
    assert.ok(!("warnings" in createdResponse.structuredContent));
    assert.doesNotMatch(createdResponse.content[0]?.text ?? "", /"handoff":/);
    assert.doesNotMatch(createdResponse.content[0]?.text ?? "", /"warnings":/);

    assert.equal(reusedResponse.content[0]?.type, "text");
    assert.ok(reusedResponse.structuredContent);
    assert.equal(reusedResponse.content[0]?.text, JSON.stringify(reusedResponse.structuredContent));
    assert.equal(reusedResponse.structuredContent.status, "reused");
    assert.ok(!("handoff" in reusedResponse.structuredContent));
    assert.deepEqual(reusedResponse.structuredContent.warnings, directReusedResult.warnings);
    assert.doesNotMatch(reusedResponse.content[0]?.text ?? "", /"handoff":/);
    assert.match(reusedResponse.content[0]?.text ?? "", /"warnings":\[/);

    assert.equal(directInvalidResult.status, "invalid");
    assert.ok("handoff" in directInvalidResult);
    assert.deepEqual(directInvalidResult.warnings, []);

    assert.equal(invalidResponse.content[0]?.type, "text");
    assert.ok(invalidResponse.structuredContent);
    assert.equal(invalidResponse.content[0]?.text, JSON.stringify(invalidResponse.structuredContent));
    assert.equal(invalidResponse.structuredContent.status, "invalid");
    assert.ok(!("handoff" in invalidResponse.structuredContent));
    assert.ok(!("warnings" in invalidResponse.structuredContent));
    assert.doesNotMatch(invalidResponse.content[0]?.text ?? "", /"handoff":/);
    assert.doesNotMatch(invalidResponse.content[0]?.text ?? "", /"warnings":/);
  } finally {
    pauseHandoffTool.handler = originalPauseHandoffHandler;
    await client.close();
    await server.close();
    await Promise.all([
      rm(path.dirname(directCreatedRepoPath), { recursive: true, force: true }),
      rm(path.dirname(publicCreatedRepoPath), { recursive: true, force: true }),
      rm(path.dirname(reusedRepoPath), { recursive: true, force: true }),
      rm(path.dirname(invalidRepoPath), { recursive: true, force: true })
    ]);
  }
});

test("public pause handoff get live MCP response omits empty top-level warnings while the direct handler keeps warnings", async () => {
  const repoPath = await createPauseHandoffWriteRepo();
  const handoffArguments = {
    currentState: "Paused after validating the public read boundary.",
    completedWork: [
      "Confirmed the pause handoff fixture is execution-ready.",
      "Wrote the canonical pause handoff report."
    ],
    remainingWork: ["Resume by reading the saved handoff and continue the queued execution step."],
    decisions: ["Keep the pause handoff as the single durable resume artifact."],
    blockers: ["Waiting for the next implementation session to resume work."],
    humanActionsPending: ["Decide when to resume the queued phase work."],
    modifiedFiles: ["src/mcp/server.ts", "tests/mcp-server-summary.test.ts"],
    contextNotes:
      "Resume by reviewing the saved handoff before continuing the next execution step.",
    nextAction:
      "Start by reading .blueprint/reports/pause-work-latest.md and then run /blu-resume-work."
  };

  await blueprintToolRegistry.blueprint_pause_handoff_write.handler({
    cwd: repoPath,
    ...handoffArguments
  });

  const directResult = await blueprintToolRegistry.blueprint_pause_handoff_get.handler({
    cwd: repoPath
  });

  assert.equal(directResult.found, true);
  assert.deepEqual(directResult.warnings, []);

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-pause-handoff-get-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_pause_handoff_get",
      arguments: {
        cwd: repoPath
      }
    });
    const publicResult = sanitizeToolResultForPublicResponse(
      "blueprint_pause_handoff_get",
      directResult
    );

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.found, true);
    assert.equal(response.structuredContent.path, directResult.path);
    assert.equal(response.structuredContent.content, directResult.content);
    assert.deepEqual(response.structuredContent.handoff, directResult.handoff);
    assert.ok(!("warnings" in response.structuredContent));
    assert.ok(!("warnings" in publicResult));
    assert.doesNotMatch(response.content[0]?.text ?? "", /"warnings":/);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public artifact mutate index live MCP response trims duplicate matched entry ids", async () => {
  const repoPath = await createCaptureRepo();

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-artifact-mutate-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    await client.callTool({
      name: "blueprint_artifact_mutate_index",
      arguments: {
        cwd: repoPath,
        target: "todo",
        entry: {
          text: "Add retry telemetry",
          status: "open"
        }
      }
    });
    await client.callTool({
      name: "blueprint_artifact_mutate_index",
      arguments: {
        cwd: repoPath,
        target: "todo",
        entry: {
          text: "Harden auth handoff",
          status: "active"
        }
      }
    });

    const response = await client.callTool({
      name: "blueprint_artifact_mutate_index",
      arguments: {
        cwd: repoPath,
        target: "todo",
        action: "list"
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.status, "listed");
    assert.equal(response.structuredContent.entries.length, 2);
    assert.deepEqual(
      response.structuredContent.entries.map((entry: { id: string }) => entry.id),
      ["TODO-002", "TODO-001"]
    );
    assert.ok(!("matchedEntryIds" in response.structuredContent));
    assert.doesNotMatch(response.content[0]?.text ?? "", /"matchedEntryIds":/);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public roadmap promote backlog response trims duplicate selected backlog ids and created phase dirs only when redundant", () => {
  const redundantResult = {
    status: "updated",
    backlogPath: ".blueprint/backlog/BACKLOG.md",
    roadmapPath: ".blueprint/ROADMAP.md",
    backlogItems: [
      {
        backlogId: "BACKLOG-001",
        description: "Offline mode",
        status: "backlog",
        reservedPhase: "999.1"
      }
    ],
    selectedBacklogIds: ["BACKLOG-001"],
    promotedItems: [
      {
        backlogId: "BACKLOG-001",
        phaseNumber: "3",
        phasePrefix: "03",
        phaseName: "Offline mode",
        reservedPhase: "999.1",
        phaseDir: ".blueprint/phases/03-offline-mode",
        createdPhaseDir: true,
        reusedReservedPhaseDir: true
      }
    ],
    createdPhaseDirs: [".blueprint/phases/03-offline-mode"],
    warnings: []
  };
  const mismatchedResult = {
    ...redundantResult,
    selectedBacklogIds: ["BACKLOG-001", "BACKLOG-002"],
    createdPhaseDirs: [
      ".blueprint/phases/03-offline-mode",
      ".blueprint/phases/04-background-sync"
    ]
  };
  const warnedResult = {
    ...redundantResult,
    warnings: ["Reserved phase 999.1 did not have a matching directory; created a new active phase directory instead."]
  };

  const trimmedText = createToolResponseContent(
    "blueprint_roadmap_promote_backlog",
    redundantResult
  )[0].text;
  const untrimmedText = createToolResponseContent(
    "blueprint_roadmap_promote_backlog",
    mismatchedResult
  )[0].text;

  const trimmed = JSON.parse(trimmedText);
  const untrimmed = JSON.parse(untrimmedText);

  assert.ok(!("selectedBacklogIds" in trimmed));
  assert.ok(!("createdPhaseDirs" in trimmed));
  assert.doesNotMatch(trimmedText, /"selectedBacklogIds":/);
  assert.doesNotMatch(trimmedText, /"createdPhaseDirs":/);
  assert.ok(!("warnings" in trimmed));
  assert.doesNotMatch(trimmedText, /"warnings":/);
  assert.deepEqual(untrimmed.selectedBacklogIds, ["BACKLOG-001", "BACKLOG-002"]);
  assert.deepEqual(untrimmed.createdPhaseDirs, [
    ".blueprint/phases/03-offline-mode",
    ".blueprint/phases/04-background-sync"
  ]);
  assert.deepEqual(
    sanitizeToolResultForPublicResponse("blueprint_roadmap_promote_backlog", warnedResult).warnings,
    warnedResult.warnings
  );
});

test("public roadmap add and insert phase responses trim redundant slug and omit empty warnings only on successful public responses", () => {
  const addRedundantResult = {
    phaseNumber: "3",
    phasePrefix: "03",
    phaseName: "Offline mode",
    slug: "offline-mode",
    phaseDir: ".blueprint/phases/03-offline-mode",
    roadmapPath: ".blueprint/ROADMAP.md",
    milestone: "v1",
    written: true,
    warnings: []
  };
  const addDistinctResult = {
    ...addRedundantResult,
    phaseDir: ".blueprint/phases/03-manual-directory-name"
  };
  const addWarnedResult = {
    ...addRedundantResult,
    warnings: ["Phase directory already exists and can be reused: .blueprint/phases/03-offline-mode"]
  };
  const insertRedundantResult = {
    afterPhaseNumber: "2",
    phaseNumber: "2.1",
    phasePrefix: "02.1",
    phaseName: "Research follow-up",
    slug: "research-follow-up",
    phaseDir: ".blueprint/phases/02.1-research-follow-up",
    roadmapPath: ".blueprint/ROADMAP.md",
    milestone: "v1",
    written: true,
    warnings: []
  };
  const insertDistinctResult = {
    ...insertRedundantResult,
    phaseDir: ".blueprint/phases/02.1-custom-dir"
  };
  const insertWarnedResult = {
    ...insertRedundantResult,
    warnings: [
      "Phase directory already exists and can be reused: .blueprint/phases/02.1-research-follow-up"
    ]
  };

  const addTrimmed = JSON.parse(
    createToolResponseContent("blueprint_roadmap_add_phase", addRedundantResult)[0].text
  );
  const addUntrimmed = JSON.parse(
    createToolResponseContent("blueprint_roadmap_add_phase", addDistinctResult)[0].text
  );
  const insertTrimmed = JSON.parse(
    createToolResponseContent("blueprint_roadmap_insert_phase", insertRedundantResult)[0].text
  );
  const insertUntrimmed = JSON.parse(
    createToolResponseContent("blueprint_roadmap_insert_phase", insertDistinctResult)[0].text
  );

  assert.ok(!("slug" in addTrimmed));
  assert.equal(addUntrimmed.slug, "offline-mode");
  assert.ok(!("warnings" in addTrimmed));
  assert.ok(!("slug" in insertTrimmed));
  assert.equal(insertUntrimmed.slug, "research-follow-up");
  assert.ok(!("warnings" in insertTrimmed));
  assert.deepEqual(
    sanitizeToolResultForPublicResponse("blueprint_roadmap_add_phase", addWarnedResult).warnings,
    addWarnedResult.warnings
  );
  assert.deepEqual(
    sanitizeToolResultForPublicResponse("blueprint_roadmap_insert_phase", insertWarnedResult).warnings,
    insertWarnedResult.warnings
  );
});

test("public roadmap remove phase responses omit empty top-level warnings while preserving removedPhase, renumberedPhases, and non-empty warnings", () => {
  const emptyWarningsResult = {
    removedPhase: {
      phaseNumber: "3",
      phasePrefix: "03",
      phaseName: "Research",
      phaseDir: ".blueprint/phases/03-research",
      removedArtifacts: []
    },
    renumberedPhases: [
      {
        previousPhaseNumber: "4",
        newPhaseNumber: "3",
        previousPhasePrefix: "04",
        newPhasePrefix: "03",
        phaseName: "Delivery",
        previousPhaseDir: ".blueprint/phases/04-delivery",
        newPhaseDir: ".blueprint/phases/03-delivery",
        renamedArtifacts: [
          {
            from: ".blueprint/phases/03-delivery/04-PLAN.md",
            to: ".blueprint/phases/03-delivery/03-PLAN.md"
          }
        ]
      }
    ],
    roadmapPath: ".blueprint/ROADMAP.md",
    milestone: "v1",
    written: true,
    warnings: []
  };
  const warnedResult = {
    ...emptyWarningsResult,
    warnings: [
      "Phase 3 was removed with execution evidence (.blueprint/phases/03-research/03-01-SUMMARY.md) because explicit force confirmation was provided."
    ]
  };

  const emptyWarningsText = createToolResponseContent(
    "blueprint_roadmap_remove_phase",
    emptyWarningsResult
  )[0].text;
  const warnedText = createToolResponseContent(
    "blueprint_roadmap_remove_phase",
    warnedResult
  )[0].text;
  const emptyWarningsParsed = JSON.parse(emptyWarningsText);
  const warnedParsed = JSON.parse(warnedText);

  assert.ok(!("warnings" in emptyWarningsParsed));
  assert.doesNotMatch(emptyWarningsText, /"warnings":/);
  assert.deepEqual(emptyWarningsParsed.removedPhase, emptyWarningsResult.removedPhase);
  assert.deepEqual(emptyWarningsParsed.renumberedPhases, emptyWarningsResult.renumberedPhases);
  assert.deepEqual(warnedParsed.removedPhase, warnedResult.removedPhase);
  assert.deepEqual(warnedParsed.renumberedPhases, warnedResult.renumberedPhases);
  assert.deepEqual(warnedParsed.warnings, warnedResult.warnings);
  assert.match(warnedText, /"warnings":\[/);
});

test("public roadmap promote backlog live MCP response trims duplicate selected backlog ids and created phase dirs while omitting empty top-level warnings only at the MCP boundary", async () => {
  const directRepoPath = await createRoadmapPromoteBacklogRepo();
  const publicRepoPath = await createRoadmapPromoteBacklogRepo();
  const directResult = await blueprintToolRegistry.blueprint_roadmap_promote_backlog.handler({
    cwd: directRepoPath,
    backlogIds: ["BACKLOG-001", "BACKLOG-002"]
  });

  assert.deepEqual(directResult.warnings, []);

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-roadmap-promote-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_roadmap_promote_backlog",
      arguments: {
        cwd: publicRepoPath,
        backlogIds: ["BACKLOG-001", "BACKLOG-002"]
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.status, "updated");
    assert.deepEqual(
      response.structuredContent.promotedItems.map((item: { backlogId: string }) => item.backlogId),
      ["BACKLOG-001", "BACKLOG-002"]
    );
    assert.ok(!("selectedBacklogIds" in response.structuredContent));
    assert.ok(!("createdPhaseDirs" in response.structuredContent));
    assert.ok(!("warnings" in response.structuredContent));
    assert.doesNotMatch(response.content[0]?.text ?? "", /"selectedBacklogIds":/);
    assert.doesNotMatch(response.content[0]?.text ?? "", /"createdPhaseDirs":/);
    assert.doesNotMatch(response.content[0]?.text ?? "", /"warnings":/);
  } finally {
    await client.close();
    await server.close();
    await Promise.all([
      rm(path.dirname(directRepoPath), { recursive: true, force: true }),
      rm(path.dirname(publicRepoPath), { recursive: true, force: true })
    ]);
  }
});

test("public roadmap add and insert phase live MCP responses trim redundant slug and omit empty top-level warnings only at the MCP boundary", async () => {
  const directAddRepoPath = await createRoadmapPhaseMutationRepo();
  const directInsertRepoPath = await createRoadmapPhaseMutationRepo();
  const publicRepoPath = await createRoadmapPhaseMutationRepo();
  const directAddResult = await blueprintToolRegistry.blueprint_roadmap_add_phase.handler({
    cwd: directAddRepoPath,
    description: "Offline mode",
    expectedPhaseNumber: "3",
    goal: "Add offline mode as traceable roadmap work.",
    requirementIds: ["RQ-03"],
    successCriteria: [
      "Offline mode scope is captured before planning.",
      "Offline mode requirement coverage remains artifact-valid."
    ]
  });
  const directInsertResult = await blueprintToolRegistry.blueprint_roadmap_insert_phase.handler({
    cwd: directInsertRepoPath,
    after: "2",
    description: "Research follow-up",
    goal: "Capture a focused research follow-up before release hardening.",
    requirementIds: ["RQ-04"],
    successCriteria: [
      "Research follow-up scope is captured before planning.",
      "Later phase numbering remains unchanged."
    ]
  });

  assert.deepEqual(directAddResult.warnings, []);
  assert.deepEqual(directInsertResult.warnings, []);

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-roadmap-phase-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const addResponse = await client.callTool({
      name: "blueprint_roadmap_add_phase",
      arguments: {
        cwd: publicRepoPath,
        description: "Offline mode",
        expectedPhaseNumber: "3",
        goal: "Add offline mode as traceable roadmap work.",
        requirementIds: ["RQ-03"],
        successCriteria: [
          "Offline mode scope is captured before planning.",
          "Offline mode requirement coverage remains artifact-valid."
        ]
      }
    });

    assert.equal(addResponse.content[0]?.type, "text");
    assert.ok(addResponse.structuredContent);
    assert.equal(addResponse.content[0]?.text, JSON.stringify(addResponse.structuredContent));
    assert.equal(addResponse.structuredContent.phaseName, "Offline mode");
    assert.equal(addResponse.structuredContent.phaseDir, ".blueprint/phases/03-offline-mode");
    assert.ok(!("slug" in addResponse.structuredContent));
    assert.ok(!("warnings" in addResponse.structuredContent));
    assert.doesNotMatch(addResponse.content[0]?.text ?? "", /"slug":/);
    assert.doesNotMatch(addResponse.content[0]?.text ?? "", /"warnings":/);

    const insertResponse = await client.callTool({
      name: "blueprint_roadmap_insert_phase",
      arguments: {
        cwd: publicRepoPath,
        after: "2",
        description: "Research follow-up",
        goal: "Capture a focused research follow-up before release hardening.",
        requirementIds: ["RQ-04"],
        successCriteria: [
          "Research follow-up scope is captured before planning.",
          "Later phase numbering remains unchanged."
        ]
      }
    });

    assert.equal(insertResponse.content[0]?.type, "text");
    assert.ok(insertResponse.structuredContent);
    assert.equal(
      insertResponse.content[0]?.text,
      JSON.stringify(insertResponse.structuredContent)
    );
    assert.equal(insertResponse.structuredContent.phaseName, "Research follow-up");
    assert.equal(
      insertResponse.structuredContent.phaseDir,
      ".blueprint/phases/02.1-research-follow-up"
    );
    assert.ok(!("slug" in insertResponse.structuredContent));
    assert.ok(!("warnings" in insertResponse.structuredContent));
    assert.doesNotMatch(insertResponse.content[0]?.text ?? "", /"slug":/);
    assert.doesNotMatch(insertResponse.content[0]?.text ?? "", /"warnings":/);
  } finally {
    await client.close();
    await server.close();
    await Promise.all([
      rm(path.dirname(directAddRepoPath), { recursive: true, force: true }),
      rm(path.dirname(directInsertRepoPath), { recursive: true, force: true }),
      rm(path.dirname(publicRepoPath), { recursive: true, force: true })
    ]);
  }
});

test("public artifact scaffold response omits empty top-level warnings while preserving createdFiles, reusedFiles, and non-empty warnings", () => {
  const emptyWarningsResult = {
    createdFiles: [".blueprint/PROJECT.md"],
    reusedFiles: [".blueprint/phases/"],
    warnings: []
  };
  const warnedResult = {
    createdFiles: [".blueprint/PROJECT.md"],
    reusedFiles: [".blueprint/phases/"],
    warnings: ["Preserved existing artifact metadata."]
  };

  const emptyWarningsText = createToolResponseContent(
    "blueprint_artifact_scaffold",
    emptyWarningsResult
  )[0].text;
  const warnedText = createToolResponseContent("blueprint_artifact_scaffold", warnedResult)[0].text;
  const emptyWarningsParsed = JSON.parse(emptyWarningsText) as Record<string, unknown>;
  const warnedParsed = JSON.parse(warnedText) as Record<string, unknown>;

  assert.deepEqual(
    sanitizeToolResultForPublicResponse("blueprint_artifact_scaffold", emptyWarningsResult),
    {
      createdFiles: [".blueprint/PROJECT.md"],
      reusedFiles: [".blueprint/phases/"]
    }
  );
  assert.ok(!("warnings" in emptyWarningsParsed));
  assert.deepEqual(emptyWarningsParsed.createdFiles, emptyWarningsResult.createdFiles);
  assert.deepEqual(emptyWarningsParsed.reusedFiles, emptyWarningsResult.reusedFiles);
  assert.doesNotMatch(emptyWarningsText, /"warnings":/);

  assert.deepEqual(warnedParsed.createdFiles, warnedResult.createdFiles);
  assert.deepEqual(warnedParsed.reusedFiles, warnedResult.reusedFiles);
  assert.deepEqual(warnedParsed.warnings, warnedResult.warnings);
  assert.match(warnedText, /"warnings":\[/);
});

test("public artifact scaffold live MCP response omits empty top-level warnings only at the boundary while preserving createdFiles and reusedFiles", async () => {
  const directRepoPath = await createGitRepo("blueprint-artifact-scaffold-direct-");
  const publicRepoPath = await createGitRepo("blueprint-artifact-scaffold-public-");

  await mkdir(path.join(directRepoPath, ".blueprint/phases"), { recursive: true });
  await mkdir(path.join(publicRepoPath, ".blueprint/phases"), { recursive: true });

  const args = {
    artifacts: [".blueprint/phases/", ".blueprint/PROJECT.md"]
  };
  const directResult = await blueprintToolRegistry.blueprint_artifact_scaffold.handler({
    cwd: directRepoPath,
    ...args
  });

  assert.deepEqual(directResult.createdFiles, [".blueprint/PROJECT.md"]);
  assert.deepEqual(directResult.reusedFiles, [".blueprint/phases/"]);
  assert.deepEqual(directResult.warnings, []);

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-artifact-scaffold-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_artifact_scaffold",
      arguments: {
        cwd: publicRepoPath,
        ...args
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.deepEqual(response.structuredContent.createdFiles, [".blueprint/PROJECT.md"]);
    assert.deepEqual(response.structuredContent.reusedFiles, [".blueprint/phases/"]);
    assert.ok(!("warnings" in response.structuredContent));
    assert.doesNotMatch(response.content[0]?.text ?? "", /"warnings":/);
  } finally {
    await client.close();
    await server.close();
    await Promise.all([
      rm(path.dirname(directRepoPath), { recursive: true, force: true }),
      rm(path.dirname(publicRepoPath), { recursive: true, force: true })
    ]);
  }
});

test("public roadmap remove phase live MCP response omits empty top-level warnings while preserving removedPhase and renumberedPhases", async () => {
  const directRepoPath = await createRoadmapRemovePhaseRepo();
  const publicRepoPath = await createRoadmapRemovePhaseRepo();
  const directResult = await blueprintToolRegistry.blueprint_roadmap_remove_phase.handler({
    cwd: directRepoPath,
    phase: "3"
  });

  assert.deepEqual(directResult.warnings, []);
  assert.equal(directResult.removedPhase.phaseNumber, "3");
  assert.equal(directResult.renumberedPhases.length, 1);
  assert.equal(directResult.renumberedPhases[0]?.newPhaseNumber, "3");

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-roadmap-remove-phase-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_roadmap_remove_phase",
      arguments: {
        cwd: publicRepoPath,
        phase: "3"
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.removedPhase.phaseNumber, "3");
    assert.equal(response.structuredContent.removedPhase.phaseDir, ".blueprint/phases/03-research");
    assert.deepEqual(response.structuredContent.removedPhase.removedArtifacts, []);
    assert.equal(response.structuredContent.renumberedPhases.length, 1);
    assert.deepEqual(response.structuredContent.renumberedPhases[0], {
      previousPhaseNumber: "4",
      newPhaseNumber: "3",
      previousPhasePrefix: "04",
      newPhasePrefix: "03",
      phaseName: "Delivery",
      previousPhaseDir: ".blueprint/phases/04-delivery",
      newPhaseDir: ".blueprint/phases/03-delivery",
      renamedArtifacts: [
        {
          from: ".blueprint/phases/03-delivery/04-PLAN.md",
          to: ".blueprint/phases/03-delivery/03-PLAN.md"
        }
      ]
    });
    assert.ok(!("warnings" in response.structuredContent));
    assert.doesNotMatch(response.content[0]?.text ?? "", /"warnings":/);
  } finally {
    await client.close();
    await server.close();
    await Promise.all([
      rm(path.dirname(directRepoPath), { recursive: true, force: true }),
      rm(path.dirname(publicRepoPath), { recursive: true, force: true })
    ]);
  }
});

test("public workstream mutate live MCP response trims duplicate active summary and omits empty top-level warnings only at the MCP boundary", async () => {
  const repoPath = await createWorkstreamRepo();
  const directRepoPath = await createWorkstreamRepo();
  const directResult = await blueprintWorkstreamMutate({
    cwd: directRepoPath,
    operation: "create",
    workstream: "Alpha Stream"
  });

  assert.deepEqual(directResult.warnings, []);
  assert.equal(directResult.workstreams.length, 1);

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-workstream-mutate-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_workstream_mutate",
      arguments: {
        cwd: repoPath,
        operation: "create",
        workstream: "Alpha Stream"
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.status, "updated");
    assert.equal(response.structuredContent.operation, "create");
    assert.equal(response.structuredContent.workstreams.length, 1);
    assert.deepEqual(response.structuredContent.workstreams[0], {
      version: 1,
      name: "Alpha Stream",
      slug: "alpha-stream",
      status: "active",
      createdAt: response.structuredContent.workstreams[0]?.createdAt,
      updatedAt: response.structuredContent.workstreams[0]?.updatedAt,
      activatedAt: response.structuredContent.workstreams[0]?.activatedAt,
      completedAt: null,
      stateSnapshot: {
        projectStatus: "active",
        currentMilestone: "v1",
        currentPhase: "1",
        activeCommand: "/blu-plan-phase",
        nextAction: "Run /blu-execute-phase 1",
        lastUpdated: "2026-05-09T00:00:00.000Z",
        blockers: [],
        roadmapEvolutionNotes: []
      }
    });
    assert.equal(
      response.structuredContent.nextAction,
      "Continue the active workstream alpha-stream or inspect repo status with /blu-progress."
    );
    assert.ok(!("active" in response.structuredContent));
    assert.ok(!("rootPath" in response.structuredContent));
    assert.ok(!("indexPath" in response.structuredContent));
    assert.ok(!("warnings" in response.structuredContent));
    assert.ok(!("statePath" in response.structuredContent.workstreams[0]));
    assert.doesNotMatch(response.content[0]?.text ?? "", /"active":\{/);
    assert.doesNotMatch(response.content[0]?.text ?? "", /"rootPath":/);
    assert.doesNotMatch(response.content[0]?.text ?? "", /"indexPath":/);
    assert.doesNotMatch(response.content[0]?.text ?? "", /"warnings":/);
    assert.doesNotMatch(response.content[0]?.text ?? "", /"statePath":/);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
    await rm(path.dirname(directRepoPath), { recursive: true, force: true });
  }
});

test("public workstream list live MCP response trims duplicate active summary and omits empty top-level warnings only at the MCP boundary", async () => {
  const repoPath = await createWorkstreamRepo();
  const directRepoPath = await createWorkstreamRepo();
  const seededResult = await blueprintWorkstreamMutate({
    cwd: directRepoPath,
    operation: "create",
    workstream: "Alpha Stream"
  });

  assert.deepEqual(seededResult.warnings, []);

  const directResult = await blueprintWorkstreamList({ cwd: directRepoPath });

  assert.deepEqual(directResult.warnings, []);
  assert.equal(directResult.workstreams.length, 1);

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-workstream-list-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const createResponse = await client.callTool({
      name: "blueprint_workstream_mutate",
      arguments: {
        cwd: repoPath,
        operation: "create",
        workstream: "Alpha Stream"
      }
    });
    assert.equal(createResponse.structuredContent?.status, "updated");

    const response = await client.callTool({
      name: "blueprint_workstream_list",
      arguments: {
        cwd: repoPath
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.status, "ready");
    assert.equal(response.structuredContent.workstreams.length, 1);
    assert.deepEqual(response.structuredContent.workstreams[0], {
      version: 1,
      name: "Alpha Stream",
      slug: "alpha-stream",
      status: "active",
      createdAt: response.structuredContent.workstreams[0]?.createdAt,
      updatedAt: response.structuredContent.workstreams[0]?.updatedAt,
      activatedAt: response.structuredContent.workstreams[0]?.activatedAt,
      completedAt: null,
      stateSnapshot: {
        projectStatus: "active",
        currentMilestone: "v1",
        currentPhase: "1",
        activeCommand: "/blu-plan-phase",
        nextAction: "Run /blu-execute-phase 1",
        lastUpdated: "2026-05-09T00:00:00.000Z",
        blockers: [],
        roadmapEvolutionNotes: []
      }
    });
    assert.equal(response.structuredContent.summary?.active, 1);
    assert.ok(!("active" in response.structuredContent));
    assert.ok(!("rootPath" in response.structuredContent));
    assert.ok(!("indexPath" in response.structuredContent));
    assert.ok(!("warnings" in response.structuredContent));
    assert.ok(!("statePath" in response.structuredContent.workstreams[0]));
    assert.doesNotMatch(response.content[0]?.text ?? "", /"active":\{/);
    assert.doesNotMatch(response.content[0]?.text ?? "", /"rootPath":/);
    assert.doesNotMatch(response.content[0]?.text ?? "", /"indexPath":/);
    assert.doesNotMatch(response.content[0]?.text ?? "", /"warnings":/);
    assert.doesNotMatch(response.content[0]?.text ?? "", /"statePath":/);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
    await rm(path.dirname(directRepoPath), { recursive: true, force: true });
  }
});

test("public phase summary validate tool trims taskSchema, normalized model, and render preview", async () => {
  const repoPath = await createCodeReviewSummaryRepo();

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-phase-summary-validate-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_phase_summary_validate_model",
      arguments: {
        cwd: repoPath,
        phase: "5",
        planId: "01",
        model: {}
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.ok(!("taskSchema" in response.structuredContent));
    assert.ok(!("normalizedModel" in response.structuredContent));
    assert.ok(!("renderPreview" in response.structuredContent));
    assert.match(
      response.content[0]?.text ?? "",
      /diagnostics|diagnosticCounts|planId|linkedPlanPath/
    );
    assert.doesNotMatch(
      response.content[0]?.text ?? "",
      /taskSchema|normalizedModel|renderPreview/
    );
  } finally {
    await client.close();
    await server.close();
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("public review record tool trims taskSchema from invalid results", async () => {
  const repoPath = await createCodeReviewSummaryRepo();

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-review-record-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_review_record",
      arguments: {
        cwd: repoPath,
        phase: "5",
        artifact: "code-review",
        model: {
          verdict: "PASS"
        },
        scopeFiles: ["src/feature.ts", "tests/feature.test.ts"]
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.status, "invalid");
    assert.ok(!("taskSchema" in response.structuredContent));
    assert.match(response.content[0]?.text ?? "", /diagnostics|diagnosticCounts|repairSummary/);
    assert.doesNotMatch(response.content[0]?.text ?? "", /taskSchema/);
    assert.match(response.content[0]?.text ?? "", /scopeSource/);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public report validate tool trims taskSchema from invalid results", async () => {
  const repoPath = await createAddTestsReportValidationRepo();

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-report-validate-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_artifact_report_validate_model",
      arguments: {
        cwd: repoPath,
        reportName: "add-tests-3",
        model: {}
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.status, "invalid");
    assert.equal(response.structuredContent.valid, false);
    assert.ok(!("taskSchema" in response.structuredContent));
    assert.match(response.content[0]?.text ?? "", /diagnostics|repairSummary|reportName/);
    assert.doesNotMatch(response.content[0]?.text ?? "", /"taskSchema":|"normalizedModel":|"renderPreview":/);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public phase plan write tool trims validation on success and trims empty invalid warnings at the MCP boundary only", async () => {
  const repoPath = await createPhasePlanWriteRepo();
  const directSuccessResult = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    content: validPhasePlanWriteContent("01"),
    overwrite: true
  });
  const directInvalidResult = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "02",
    content: "# invalid plan\n",
    overwrite: true
  });

  assert.deepEqual(directSuccessResult.warnings, []);
  assert.ok("validation" in directSuccessResult);
  assert.deepEqual(directInvalidResult.warnings, []);
  assert.ok("validation" in directInvalidResult);

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-phase-plan-write-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const successResponse = await client.callTool({
      name: "blueprint_phase_plan_write",
      arguments: {
        cwd: repoPath,
        phase: "3",
        content: validPhasePlanWriteContent("01"),
        overwrite: true
      }
    });
    const invalidResponse = await client.callTool({
      name: "blueprint_phase_plan_write",
      arguments: {
        cwd: repoPath,
        phase: "3",
        planId: "02",
        content: "# invalid plan\n",
        overwrite: true
      }
    });

    assert.equal(successResponse.content[0]?.type, "text");
    assert.ok(successResponse.structuredContent);
    assert.equal(successResponse.content[0]?.text, JSON.stringify(successResponse.structuredContent));
    assert.equal(successResponse.structuredContent.status, "created");
    assert.ok(!("validation" in successResponse.structuredContent));
    assert.ok(!("warnings" in successResponse.structuredContent));
    assert.doesNotMatch(successResponse.content[0]?.text ?? "", /"validation":/);
    assert.doesNotMatch(successResponse.content[0]?.text ?? "", /"warnings":/);

    assert.equal(invalidResponse.content[0]?.type, "text");
    assert.ok(invalidResponse.structuredContent);
    assert.equal(invalidResponse.content[0]?.text, JSON.stringify(invalidResponse.structuredContent));
    assert.equal(invalidResponse.structuredContent.status, "invalid");
    assert.ok("validation" in invalidResponse.structuredContent);
    assert.ok(!("warnings" in invalidResponse.structuredContent));
    assert.deepEqual(invalidResponse.structuredContent.validation?.warnings, []);
    assert.match(invalidResponse.content[0]?.text ?? "", /validation|issues/);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public config set tool trims config and provenance on successful MCP responses", async () => {
  const directRepoPath = await createConfigSetRepo();
  const repoPath = await createConfigSetRepo();
  const directResult = await blueprintToolRegistry.blueprint_config_set.handler({
    cwd: directRepoPath,
    scope: "project",
    patch: {
      model_profile: "quality",
      ux: {
        progress_mode: "stage"
      }
    }
  });

  assert.deepEqual(directResult.warnings, []);

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-config-set-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_config_set",
      arguments: {
        cwd: repoPath,
        scope: "project",
        patch: {
          model_profile: "quality",
          ux: {
            progress_mode: "stage"
          }
        }
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.deepEqual(response.structuredContent, {
      scope: "project",
      updatedKeys: ["model_profile", "ux.progress_mode"],
      configPath: ".blueprint/config.json"
    });
    assert.ok(!("warnings" in response.structuredContent));
    assert.ok(!("config" in response.structuredContent));
    assert.ok(!("provenance" in response.structuredContent));
    assert.doesNotMatch(response.content[0]?.text ?? "", /"warnings":|"config":|"provenance":/);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(directRepoPath), { recursive: true, force: true });
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public config set profile live MCP response already matches the direct compact contract", async () => {
  const directRepoPath = await createConfigSetRepo();
  const repoPath = await createConfigSetRepo();
  const directResult = await blueprintConfigSetProfile({
    cwd: directRepoPath,
    profile: "quality"
  });

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-config-set-profile-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_config_set_profile",
      arguments: {
        cwd: repoPath,
        profile: "quality"
      }
    });

    assert.deepEqual(directResult, {
      profile: "quality",
      updatedKeys: ["model_profile"],
      configPath: ".blueprint/config.json"
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.deepEqual(response.structuredContent, directResult);
    assert.deepEqual(Object.keys(response.structuredContent).sort(), [
      "configPath",
      "profile",
      "updatedKeys"
    ]);
    assert.ok(!("warnings" in response.structuredContent));
    assert.ok(!("config" in response.structuredContent));
    assert.ok(!("provenance" in response.structuredContent));
    assert.doesNotMatch(
      response.content[0]?.text ?? "",
      /"warnings":|"config":|"provenance":/
    );
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(directRepoPath), { recursive: true, force: true });
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public config get tool trims duplicate sourcePath only at the MCP boundary while direct handler preserves it", async () => {
  const directRepoPath = await createConfigSetRepo();
  const repoPath = await createConfigSetRepo();
  const nullRepoPath = await createUninitializedProjectStatusRepo();
  const directDefaultsPath = path.join(path.dirname(directRepoPath), "blueprint-defaults.json");
  const defaultsPath = path.join(path.dirname(repoPath), "blueprint-defaults.json");
  const nullDefaultsPath = path.join(path.dirname(nullRepoPath), "blueprint-defaults.json");

  await writeFile(
    directDefaultsPath,
    JSON.stringify({ version: 2, model_profile: "quality" }, null, 2),
    "utf8"
  );
  await writeFile(
    defaultsPath,
    JSON.stringify({ version: 2, model_profile: "quality" }, null, 2),
    "utf8"
  );
  await writeFile(
    nullDefaultsPath,
    JSON.stringify({ version: 2, model_profile: "quality" }, null, 2),
    "utf8"
  );

  const directProjectResult = await blueprintToolRegistry.blueprint_config_get.handler({
    cwd: directRepoPath,
    scope: "project",
    defaultsPath: directDefaultsPath
  });
  const directDefaultsResult = await blueprintToolRegistry.blueprint_config_get.handler({
    cwd: directRepoPath,
    scope: "defaults",
    defaultsPath: directDefaultsPath
  });
  const directNullSourcePathResult = await blueprintToolRegistry.blueprint_config_get.handler({
    cwd: nullRepoPath,
    scope: "project",
    defaultsPath: nullDefaultsPath
  });

  assert.equal(directProjectResult.sourcePath, ".blueprint/config.json");
  assert.equal(directDefaultsResult.sourcePath, directDefaultsPath);
  assert.equal(directNullSourcePathResult.sourcePath, null);

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-config-get-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const projectResponse = await client.callTool({
      name: "blueprint_config_get",
      arguments: {
        cwd: repoPath,
        scope: "project",
        defaultsPath
      }
    });
    const defaultsResponse = await client.callTool({
      name: "blueprint_config_get",
      arguments: {
        cwd: repoPath,
        scope: "defaults",
        defaultsPath
      }
    });
    const nullSourcePathResponse = await client.callTool({
      name: "blueprint_config_get",
      arguments: {
        cwd: nullRepoPath,
        scope: "project",
        defaultsPath: nullDefaultsPath
      }
    });

    assert.equal(projectResponse.content[0]?.type, "text");
    assert.ok(projectResponse.structuredContent);
    assert.equal(projectResponse.content[0]?.text, JSON.stringify(projectResponse.structuredContent));
    assert.ok(!("sourcePath" in projectResponse.structuredContent));
    assert.equal(projectResponse.structuredContent.provenance?.projectPath, ".blueprint/config.json");
    assert.doesNotMatch(projectResponse.content[0]?.text ?? "", /"sourcePath":/);

    assert.equal(defaultsResponse.content[0]?.type, "text");
    assert.ok(defaultsResponse.structuredContent);
    assert.equal(defaultsResponse.content[0]?.text, JSON.stringify(defaultsResponse.structuredContent));
    assert.ok(!("sourcePath" in defaultsResponse.structuredContent));
    assert.equal(defaultsResponse.structuredContent.provenance?.defaultsPath, defaultsPath);
    assert.doesNotMatch(defaultsResponse.content[0]?.text ?? "", /"sourcePath":/);

    assert.equal(nullSourcePathResponse.content[0]?.type, "text");
    assert.ok(nullSourcePathResponse.structuredContent);
    assert.equal(
      nullSourcePathResponse.content[0]?.text,
      JSON.stringify(nullSourcePathResponse.structuredContent)
    );
    assert.equal(nullSourcePathResponse.structuredContent.sourcePath, null);
    assert.match(nullSourcePathResponse.content[0]?.text ?? "", /"sourcePath":null/);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(directRepoPath), { recursive: true, force: true });
    await rm(path.dirname(repoPath), { recursive: true, force: true });
    await rm(path.dirname(nullRepoPath), { recursive: true, force: true });
  }
});

test("public impact context load tool trims nested config provenance and sourcePath on live MCP responses", async () => {
  const repoPath = await createImpactFixtureRepo();

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-impact-context-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_impact_context_load",
      arguments: {
        cwd: repoPath
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.ok(response.structuredContent.config);
    assert.ok(response.structuredContent.config.config);
    assert.ok(!("provenance" in response.structuredContent.config));
    assert.ok(!("sourcePath" in response.structuredContent.config));
    assert.doesNotMatch(JSON.stringify(response.structuredContent.config), /"provenance":|"sourcePath":/);
  } finally {
    await client.close();
    await server.close();
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("public project init tool trims redundant success-path diagnostics on live MCP responses", async () => {
  const repoPath = await createProjectInitRepo();
  const defaultsPath = path.join(path.dirname(repoPath), "blueprint-defaults.json");
  const directResult = await blueprintProjectInit({
    cwd: repoPath,
    defaultsPath,
    bootstrapMode: "interactive",
    bootstrapSeed: {
      vision:
        "Create a focused fixture that validates public Blueprint project init MCP responses.",
      currentMilestone: "v1",
      constraints: ["Keep successful MCP bootstrap payloads concise and actionable."],
      assumptions: ["The repo fixture starts without Blueprint artifacts."],
      requirements: [
        {
          id: "BP-01",
          scope: "committed",
          group: "Bootstrap",
          requirement:
            "Expose successful project init MCP responses without redundant configuration provenance.",
          status: "planned",
          notes: "Trim only the shared public boundary response."
        }
      ],
      roadmapPhases: [
        {
          phase: "1",
          title: "Bootstrap Response Trim",
          objective:
            "Initialize the repo and preserve only actionable success-path bootstrap context.",
          requirementIds: ["BP-01"],
          successCriteria: [
            "Blueprint bootstrap artifacts are written for the repo.",
            "The public MCP response keeps next-step guidance while omitting redundant success metadata."
          ]
        }
      ]
    }
  });

  assert.deepEqual(directResult.warnings, []);

  await rm(path.join(repoPath, ".blueprint"), { recursive: true, force: true });

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-project-init-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_project_init",
      arguments: {
        cwd: repoPath,
        defaultsPath,
        bootstrapMode: "interactive",
        bootstrapSeed: {
          vision:
            "Create a focused fixture that validates public Blueprint project init MCP responses.",
          currentMilestone: "v1",
          constraints: ["Keep successful MCP bootstrap payloads concise and actionable."],
          assumptions: ["The repo fixture starts without Blueprint artifacts."],
          requirements: [
            {
              id: "BP-01",
              scope: "committed",
              group: "Bootstrap",
              requirement:
                "Expose successful project init MCP responses without redundant configuration provenance.",
              status: "planned",
              notes: "Trim only the shared public boundary response."
            }
          ],
          roadmapPhases: [
            {
              phase: "1",
              title: "Bootstrap Response Trim",
              objective:
                "Initialize the repo and preserve only actionable success-path bootstrap context.",
              requirementIds: ["BP-01"],
              successCriteria: [
                "Blueprint bootstrap artifacts are written for the repo.",
                "The public MCP response keeps next-step guidance while omitting redundant success metadata."
              ]
            }
          ]
        }
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.projectRoot, repoPath);
    assert.equal(response.structuredContent.configPath, ".blueprint/config.json");
    assert.equal(
      response.structuredContent.seededState?.statePath,
      ".blueprint/STATE.md"
    );
    assert.equal(
      response.structuredContent.nextAction,
      "Run /blu-discuss-phase 1"
    );
    assert.ok("brownfield" in response.structuredContent);
    assert.ok("bootstrapDiagnostics" in response.structuredContent);
    assert.ok(Array.isArray(response.structuredContent.bootstrapDiagnostics?.placeholderArtifacts));
    assert.ok(!("warnings" in response.structuredContent));
    assert.ok(!("configProvenance" in response.structuredContent));
    assert.ok(!("traceabilityWarnings" in response.structuredContent.bootstrapDiagnostics));
    assert.ok(!("brownfield" in response.structuredContent.bootstrapDiagnostics));
    assert.doesNotMatch(
      response.content[0]?.text ?? "",
      /"configProvenance":|"traceabilityWarnings":|"bootstrapDiagnostics":\{"brownfield":/
    );
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public state update tool trims top-level statePath and omits empty top-level warnings on live MCP responses only", async () => {
  const repoPath = await createProjectInitRepo();
  await initializeProjectInitRepo(repoPath);

  const directResult = await blueprintStateUpdate({
    cwd: repoPath,
    patch: {
      currentPhase: "2",
      nextAction: "Run /blu-progress"
    }
  });

  assert.equal(directResult.statePath, ".blueprint/STATE.md");
  assert.ok(Array.isArray(directResult.updatedFields));
  assert.deepEqual(directResult.warnings, []);

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-state-update-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_state_update",
      arguments: {
        cwd: repoPath,
        patch: {
          currentPhase: "3",
          nextAction: "Run /blu-progress"
        }
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.ok(!("statePath" in response.structuredContent));
    assert.ok(!("warnings" in response.structuredContent));
    assert.ok(Array.isArray(response.structuredContent.updatedFields));
    assert.ok(response.structuredContent.updatedFields.includes("currentPhase"));
    assert.ok(response.structuredContent.updatedFields.includes("lastUpdated"));
    assert.doesNotMatch(response.content[0]?.text ?? "", /"statePath":/);
    assert.doesNotMatch(response.content[0]?.text ?? "", /"warnings":/);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public state sync tool trims top-level statePath and preserves non-empty top-level warnings on live MCP responses only", async () => {
  const repoPath = await createProjectInitRepo();
  await initializeProjectInitRepo(repoPath);
  await blueprintStateUpdate({
    cwd: repoPath,
    patch: {
      currentPhase: "2",
      nextAction: "Run /blu-progress"
    }
  });

  const directResult = await blueprintStateSync({ cwd: repoPath });

  assert.equal(directResult.statePath, ".blueprint/STATE.md");
  assert.ok(Array.isArray(directResult.syncedFields));
  assert.deepEqual(directResult.warnings, [
    "STATE.md is ahead of ROADMAP.md: current phase 2 will be used instead of the stale roadmap phase 1.",
    "Blueprint could not resolve a current-phase directory for 2; next action will stay on health until the phase tree is repaired."
  ]);

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-state-sync-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    await client.callTool({
      name: "blueprint_state_update",
      arguments: {
        cwd: repoPath,
        patch: {
          currentPhase: "2",
          nextAction: "Run /blu-progress"
        }
      }
    });

    const response = await client.callTool({
      name: "blueprint_state_sync",
      arguments: {
        cwd: repoPath
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.ok(!("statePath" in response.structuredContent));
    assert.deepEqual(response.structuredContent.warnings, directResult.warnings);
    assert.ok(Array.isArray(response.structuredContent.syncedFields));
    assert.ok(response.structuredContent.syncedFields.includes("nextAction"));
    assert.ok(response.structuredContent.syncedFields.includes("lastUpdated"));
    assert.doesNotMatch(response.content[0]?.text ?? "", /"statePath":/);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public phase research status trims duplicate planning diagnostics on live MCP responses only", async () => {
  const repoPath = await createPhaseResearchStatusTrimRepo();
  const directResult = await blueprintPhaseResearchStatus({ cwd: repoPath, phase: "3" });

  assert.ok(Array.isArray(directResult.planningReadiness.diagnostics));
  assert.deepEqual(directResult.planningReadiness.diagnostics, directResult.contextDiagnostics);

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-phase-research-status-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_phase_research_status",
      arguments: {
        cwd: repoPath,
        phase: "3"
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.deepEqual(response.structuredContent.contextDiagnostics, directResult.contextDiagnostics);
    assert.ok(!("diagnostics" in response.structuredContent.planningReadiness));
    assert.doesNotMatch(response.content[0]?.text ?? "", /"planningReadiness":\{[^}]*"diagnostics":/);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("project status live MCP response preserves distinct bootstrap guidance on an uninitialized repo", async () => {
  const repoPath = await createUninitializedProjectStatusRepo();
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-project-status-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_project_status",
      arguments: {
        cwd: repoPath
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.status, "uninitialized");
    assert.equal(response.structuredContent.initialized, false);
    assert.equal(response.structuredContent.nextAction, "Run /blu-new-project");
    assert.equal(response.structuredContent.bootstrap?.recommendedNextAction, "Run /blu-progress");
    assert.match(response.content[0]?.text ?? "", /"recommendedNextAction":"Run \/blu-progress"/);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public phase artifact write tool trims success validation and preserves context model-only diagnostics", async () => {
  const repoPath = await createPhasePlanWriteRepo();
  const directSuccessResult = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    model: validPhaseContextModel(),
    overwrite: true
  });
  const directInvalidResult = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    content: "# invalid context\n",
    overwrite: true
  });

  assert.ok(Array.isArray(directSuccessResult.warnings));
  assert.ok("validation" in directSuccessResult);
  assert.deepEqual(directInvalidResult.warnings, []);
  assert.ok("validation" in directInvalidResult);

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-phase-artifact-write-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const successResponse = await client.callTool({
      name: "blueprint_phase_artifact_write",
      arguments: {
        cwd: repoPath,
        phase: "3",
        artifact: "context",
        model: validPhaseContextModel(),
        overwrite: true
      }
    });
    const invalidResponse = await client.callTool({
      name: "blueprint_phase_artifact_write",
      arguments: {
        cwd: repoPath,
        phase: "3",
        artifact: "context",
        content: "# invalid context\n",
        overwrite: true
      }
    });

    assert.equal(successResponse.content[0]?.type, "text");
    assert.ok(successResponse.structuredContent);
    assert.equal(successResponse.content[0]?.text, JSON.stringify(successResponse.structuredContent));
    assert.equal(successResponse.structuredContent.status, "reused");
    assert.ok(!("validation" in successResponse.structuredContent));
    assert.ok(Array.isArray(successResponse.structuredContent.warnings));
    assert.ok((successResponse.structuredContent.warnings?.length ?? 0) > 0);
    assert.match(successResponse.structuredContent.warnings.join("\n"), /content was unchanged/i);
    assert.doesNotMatch(successResponse.content[0]?.text ?? "", /"validation":/);
    assert.match(successResponse.content[0]?.text ?? "", /"warnings":\[/);

    assert.equal(invalidResponse.content[0]?.type, "text");
    assert.ok(invalidResponse.structuredContent);
    assert.equal(invalidResponse.content[0]?.text, JSON.stringify(invalidResponse.structuredContent));
    assert.equal(invalidResponse.structuredContent.status, "invalid");
    assert.ok("validation" in invalidResponse.structuredContent);
    assert.ok(!("warnings" in invalidResponse.structuredContent));
    assert.deepEqual(invalidResponse.structuredContent.validation?.warnings, []);
    assert.match(
      invalidResponse.content[0]?.text ?? "",
      /validation|diagnostics|suggestedRepairs|retryPlan|issues/
    );
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public phase summary write tool preserves non-empty warnings while trimming empty issues from successful results", async () => {
  const repoPath = await createPhasePlanWriteRepo();

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-phase-summary-write-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const planWriteResponse = await client.callTool({
      name: "blueprint_phase_plan_write",
      arguments: {
        cwd: repoPath,
        phase: "3",
        content: validPhasePlanWriteContent("01"),
        overwrite: true
      }
    });
    assert.equal(planWriteResponse.structuredContent?.status, "created");

    const successResponse = await client.callTool({
      name: "blueprint_phase_summary_write",
      arguments: {
        cwd: repoPath,
        phase: "3",
        planId: "01",
        content: validPhaseSummaryWriteContent("01"),
        overwrite: true
      }
    });
    const reusedResponse = await client.callTool({
      name: "blueprint_phase_summary_write",
      arguments: {
        cwd: repoPath,
        phase: "3",
        planId: "01",
        content: validPhaseSummaryWriteContent("01"),
        overwrite: true
      }
    });
    const invalidResponse = await client.callTool({
      name: "blueprint_phase_summary_write",
      arguments: {
        cwd: repoPath,
        phase: "3",
        planId: "01",
        content: "# invalid summary\n",
        overwrite: true
      }
    });

    assert.equal(successResponse.content[0]?.type, "text");
    assert.ok(successResponse.structuredContent);
    assert.equal(successResponse.content[0]?.text, JSON.stringify(successResponse.structuredContent));
    assert.equal(successResponse.structuredContent.status, "created");
    assert.ok(!("issues" in successResponse.structuredContent));
    assert.doesNotMatch(successResponse.content[0]?.text ?? "", /"issues":/);
    assert.ok(Array.isArray(successResponse.structuredContent.warnings));
    assert.ok((successResponse.structuredContent.warnings?.length ?? 0) > 0);
    assert.match(successResponse.content[0]?.text ?? "", /"warnings":\[/);

    assert.equal(reusedResponse.content[0]?.type, "text");
    assert.ok(reusedResponse.structuredContent);
    assert.equal(reusedResponse.content[0]?.text, JSON.stringify(reusedResponse.structuredContent));
    assert.equal(reusedResponse.structuredContent.status, "reused");
    assert.ok(!("issues" in reusedResponse.structuredContent));
    assert.ok(Array.isArray(reusedResponse.structuredContent.warnings));
    assert.ok((reusedResponse.structuredContent.warnings?.length ?? 0) > 0);
    assert.doesNotMatch(reusedResponse.content[0]?.text ?? "", /"issues":/);
    assert.match(reusedResponse.content[0]?.text ?? "", /"warnings":\[/);

    assert.equal(invalidResponse.content[0]?.type, "text");
    assert.ok(invalidResponse.structuredContent);
    assert.equal(invalidResponse.content[0]?.text, JSON.stringify(invalidResponse.structuredContent));
    assert.equal(invalidResponse.structuredContent.status, "invalid");
    assert.ok("issues" in invalidResponse.structuredContent);
    assert.match(invalidResponse.content[0]?.text ?? "", /issues|Status|Plan|Next Safe Action/);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public artifact validate live MCP response trims empty failure arrays while the direct handler keeps them", async () => {
  const repoPath = await createProjectInitRepo();
  await initializeProjectInitRepo(repoPath);

  const directResult = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(directResult.valid, true);
  assert.deepEqual(directResult.issues, []);
  assert.deepEqual(directResult.diagnostics, []);
  assert.deepEqual(directResult.suggestedRepairs, []);
  assert.ok(Array.isArray(directResult.warnings));

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-artifact-validate-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_artifact_validate",
      arguments: {
        cwd: repoPath
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.valid, true);
    assert.ok(!("issues" in response.structuredContent));
    assert.ok(!("diagnostics" in response.structuredContent));
    assert.ok(!("suggestedRepairs" in response.structuredContent));
    assert.deepEqual(response.structuredContent.warnings, directResult.warnings);
    assert.doesNotMatch(
      response.content[0]?.text ?? "",
      /"issues":|"diagnostics":|"suggestedRepairs":/
    );
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public codebase artifact write tool preserves non-empty warnings while trimming empty issues from successful results", async () => {
  const repoPath = await createProjectInitRepo();
  await initializeProjectInitRepo(repoPath);
  await mkdir(path.join(repoPath, ".blueprint/codebase"), { recursive: true });

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-codebase-artifact-write-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const createdResponse = await client.callTool({
      name: "blueprint_codebase_artifact_write",
      arguments: {
        cwd: repoPath,
        artifactId: "codebase.architecture",
        content: validCodebaseArchitectureContent()
      }
    });
    const reusedResponse = await client.callTool({
      name: "blueprint_codebase_artifact_write",
      arguments: {
        cwd: repoPath,
        artifactId: "codebase.architecture",
        content: validCodebaseArchitectureContent()
      }
    });

    assert.equal(createdResponse.content[0]?.type, "text");
    assert.ok(createdResponse.structuredContent);
    assert.equal(createdResponse.content[0]?.text, JSON.stringify(createdResponse.structuredContent));
    assert.equal(createdResponse.structuredContent.status, "created");
    assert.equal(createdResponse.structuredContent.path, ".blueprint/codebase/ARCHITECTURE.md");
    assert.ok(!("issues" in createdResponse.structuredContent));
    assert.doesNotMatch(createdResponse.content[0]?.text ?? "", /"issues":/);
    assert.ok(Array.isArray(createdResponse.structuredContent.warnings));
    assert.ok((createdResponse.structuredContent.warnings?.length ?? 0) > 0);
    assert.match(createdResponse.content[0]?.text ?? "", /"warnings":\[/);

    assert.equal(reusedResponse.content[0]?.type, "text");
    assert.ok(reusedResponse.structuredContent);
    assert.equal(reusedResponse.content[0]?.text, JSON.stringify(reusedResponse.structuredContent));
    assert.equal(reusedResponse.structuredContent.status, "reused");
    assert.equal(reusedResponse.structuredContent.path, ".blueprint/codebase/ARCHITECTURE.md");
    assert.ok(!("issues" in reusedResponse.structuredContent));
    assert.ok(Array.isArray(reusedResponse.structuredContent.warnings));
    assert.ok((reusedResponse.structuredContent.warnings?.length ?? 0) > 0);
    assert.doesNotMatch(reusedResponse.content[0]?.text ?? "", /"issues":/);
    assert.match(reusedResponse.content[0]?.text ?? "", /"warnings":\[/);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public phase validation write tool omits empty warnings and preserves non-empty warnings on successful results", async () => {
  const repoPath = await createPhasePlanWriteRepo();

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-phase-validation-write-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const planWriteResponse = await client.callTool({
      name: "blueprint_phase_plan_write",
      arguments: {
        cwd: repoPath,
        phase: "3",
        content: validPhasePlanWriteContent("01"),
        overwrite: true
      }
    });
    assert.equal(planWriteResponse.structuredContent?.status, "created");

    const summaryWriteResponse = await client.callTool({
      name: "blueprint_phase_summary_write",
      arguments: {
        cwd: repoPath,
        phase: "3",
        planId: "01",
        content: validPhaseSummaryWriteContent("01"),
        overwrite: true
      }
    });
    assert.equal(summaryWriteResponse.structuredContent?.status, "created");

    const createdResponse = await client.callTool({
      name: "blueprint_phase_validation_write",
      arguments: {
        cwd: repoPath,
        phase: "3",
        artifact: "verification",
        content: validAddTestsVerificationContent(
          ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"
        ),
        overwrite: true
      }
    });
    const reusedResponse = await client.callTool({
      name: "blueprint_phase_validation_write",
      arguments: {
        cwd: repoPath,
        phase: "3",
        artifact: "verification",
        content: validAddTestsVerificationContent(
          ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"
        ),
        overwrite: true
      }
    });

    assert.equal(createdResponse.content[0]?.type, "text");
    assert.ok(createdResponse.structuredContent);
    assert.equal(createdResponse.content[0]?.text, JSON.stringify(createdResponse.structuredContent));
    assert.equal(createdResponse.structuredContent.status, "created");
    assert.equal(
      createdResponse.structuredContent.path,
      ".blueprint/phases/03-phase-discovery/03-VERIFICATION.md"
    );
    assert.ok(!("issues" in createdResponse.structuredContent));
    assert.ok(!("warnings" in createdResponse.structuredContent));
    assert.doesNotMatch(createdResponse.content[0]?.text ?? "", /"issues":/);
    assert.doesNotMatch(createdResponse.content[0]?.text ?? "", /"warnings":/);

    assert.equal(reusedResponse.content[0]?.type, "text");
    assert.ok(reusedResponse.structuredContent);
    assert.equal(reusedResponse.content[0]?.text, JSON.stringify(reusedResponse.structuredContent));
    assert.equal(reusedResponse.structuredContent.status, "reused");
    assert.equal(
      reusedResponse.structuredContent.path,
      ".blueprint/phases/03-phase-discovery/03-VERIFICATION.md"
    );
    assert.ok(!("issues" in reusedResponse.structuredContent));
    assert.ok(Array.isArray(reusedResponse.structuredContent.warnings));
    assert.ok((reusedResponse.structuredContent.warnings?.length ?? 0) > 0);
    assert.doesNotMatch(reusedResponse.content[0]?.text ?? "", /"issues":/);
    assert.match(reusedResponse.content[0]?.text ?? "", /"warnings":\[/);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public artifact report write tool omits empty warnings and preserves non-empty warnings on successful results", async () => {
  const repoPath = await createProjectInitRepo();
  await initializeProjectInitRepo(repoPath);

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-artifact-report-write-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const createdResponse = await client.callTool({
      name: "blueprint_artifact_report_write",
      arguments: {
        cwd: repoPath,
        reportName: "cleanup-latest",
        content: validCleanupReportContent()
      }
    });
    const reusedResponse = await client.callTool({
      name: "blueprint_artifact_report_write",
      arguments: {
        cwd: repoPath,
        reportName: "cleanup-latest",
        content: validCleanupReportContent()
      }
    });

    assert.equal(createdResponse.content[0]?.type, "text");
    assert.ok(createdResponse.structuredContent);
    assert.equal(createdResponse.content[0]?.text, JSON.stringify(createdResponse.structuredContent));
    assert.equal(createdResponse.structuredContent.status, "created");
    assert.equal(createdResponse.structuredContent.path, ".blueprint/reports/cleanup-latest.md");
    assert.ok(!("issues" in createdResponse.structuredContent));
    assert.ok(!("warnings" in createdResponse.structuredContent));
    assert.doesNotMatch(createdResponse.content[0]?.text ?? "", /"issues":/);
    assert.doesNotMatch(createdResponse.content[0]?.text ?? "", /"warnings":/);

    assert.equal(reusedResponse.content[0]?.type, "text");
    assert.ok(reusedResponse.structuredContent);
    assert.equal(reusedResponse.content[0]?.text, JSON.stringify(reusedResponse.structuredContent));
    assert.equal(reusedResponse.structuredContent.status, "reused");
    assert.equal(reusedResponse.structuredContent.path, ".blueprint/reports/cleanup-latest.md");
    assert.ok(!("issues" in reusedResponse.structuredContent));
    assert.ok(Array.isArray(reusedResponse.structuredContent.warnings));
    assert.ok((reusedResponse.structuredContent.warnings?.length ?? 0) > 0);
    assert.doesNotMatch(reusedResponse.content[0]?.text ?? "", /"issues":/);
    assert.match(reusedResponse.content[0]?.text ?? "", /"warnings":\[/);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("artifact report authoring context live MCP response omits only empty top-level warnings while the direct handler keeps the full tool contract", async () => {
  const repoPath = await createAddTestsReportValidationRepo();
  const directResult = await blueprintArtifactReportAuthoringContext({
    cwd: repoPath,
    reportName: "add-tests-3"
  });
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-artifact-report-authoring-context-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    assert.equal(directResult.status, "ready", directResult.reason ?? directResult.warnings.join("\n"));
    assert.ok("warnings" in directResult);
    assert.deepEqual(directResult.warnings, []);

    const response = await client.callTool({
      name: "blueprint_artifact_report_authoring_context",
      arguments: {
        cwd: repoPath,
        reportName: "add-tests-3"
      }
    });
    const structuredContent = response.structuredContent as Record<string, unknown>;

    assert.equal(response.content[0]?.type, "text");
    assert.ok(structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(structuredContent));
    assert.equal(structuredContent.status, directResult.status);
    assert.equal(structuredContent.reportName, directResult.reportName);
    assert.equal(structuredContent.path, directResult.path);
    assert.deepEqual(structuredContent.phase, directResult.phase);
    assert.deepEqual(structuredContent.completedSummaries, directResult.completedSummaries);
    assert.deepEqual(structuredContent.validationEvidencePaths, directResult.validationEvidencePaths);
    assert.deepEqual(structuredContent.writeArgs, directResult.writeArgs);
    assert.deepEqual(structuredContent.prerequisiteBlockers, directResult.prerequisiteBlockers);
    assert.ok(!("warnings" in structuredContent));
    assert.doesNotMatch(response.content[0]?.text ?? "", /"warnings":/);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public impact report write live MCP response omits empty warnings only on successful responses", async () => {
  const repoPath = await createImpactFixtureRepo();
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-impact-report-write-public-success-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const analyzeResponse = await client.callTool({
      name: "blueprint_impact_analyze",
      arguments: {
        cwd: repoPath,
        changedFiles: ["src/index.ts"]
      }
    });
    const report = (analyzeResponse.structuredContent as Record<string, unknown> | undefined)?.report;

    assert.ok(report, "impact analysis should return a report");

    const response = await client.callTool({
      name: "blueprint_impact_report_write",
      arguments: {
        cwd: repoPath,
        report
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.status, "written");
    assert.ok(!("errors" in response.structuredContent));
    assert.ok(!("warnings" in response.structuredContent));
    assert.doesNotMatch(response.content[0]?.text ?? "", /"errors":/);
    assert.doesNotMatch(response.content[0]?.text ?? "", /"warnings":/);

    const publicResult = JSON.parse(response.content[0]?.text ?? "{}");

    assert.equal(publicResult.status, "written");
    assert.ok(!("errors" in publicResult));
    assert.ok(!("warnings" in publicResult));
  } finally {
    await client.close();
    await server.close();
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("public impact analyze live MCP response trims report-duplicated top-level fields while direct handler keeps full shape", async () => {
  const repoPath = await createImpactFixtureRepo();
  const directResult = await blueprintToolRegistry.blueprint_impact_analyze.handler({
    cwd: repoPath,
    changedFiles: ["src/index.ts"]
  });
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-impact-analyze-public-trim-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    assert.equal(directResult.phaseStatus, "scored-report-modeled");
    assert.ok("impactId" in directResult);
    assert.ok("status" in directResult);
    assert.ok("impactStatus" in directResult);
    assert.ok("risk" in directResult);
    assert.ok("confidence" in directResult);
    assert.ok("surfaces" in directResult);
    assert.ok("areaSummary" in directResult);
    assert.ok("surfaceSummary" in directResult);
    assert.ok("ownership" in directResult);
    assert.ok("dependencyGraph" in directResult);
    assert.ok("findings" in directResult);
    assert.ok("obligations" in directResult);
    assert.ok("unknowns" in directResult);
    assert.ok("evidence" in directResult);
    assert.ok("report" in directResult);
    assert.ok("warnings" in directResult);

    const response = await client.callTool({
      name: "blueprint_impact_analyze",
      arguments: {
        cwd: repoPath,
        changedFiles: ["src/index.ts"]
      }
    });
    const structuredContent = response.structuredContent as Record<string, unknown>;

    assert.equal(response.content[0]?.type, "text");
    assert.ok(structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(structuredContent));
    assert.equal(structuredContent.phaseStatus, directResult.phaseStatus);
    assert.deepEqual(structuredContent.report, directResult.report);
    assert.deepEqual(structuredContent.warnings, directResult.warnings);
    assert.ok(!("impactId" in structuredContent));
    assert.ok(!("status" in structuredContent));
    assert.ok(!("impactStatus" in structuredContent));
    assert.ok(!("risk" in structuredContent));
    assert.ok(!("confidence" in structuredContent));
    assert.ok(!("surfaces" in structuredContent));
    assert.ok(!("areaSummary" in structuredContent));
    assert.ok(!("surfaceSummary" in structuredContent));
    assert.ok(!("ownership" in structuredContent));
    assert.ok(!("dependencyGraph" in structuredContent));
    assert.ok(!("findings" in structuredContent));
    assert.ok(!("obligations" in structuredContent));
    assert.ok(!("unknowns" in structuredContent));
    assert.ok(!("evidence" in structuredContent));
  } finally {
    await client.close();
    await server.close();
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("public impact scope resolve live MCP response trims redundant changedFiles and empty warnings while direct handler keeps the tool contract", async () => {
  const repoPath = await createImpactFixtureRepo();
  const directResult = await blueprintToolRegistry.blueprint_impact_scope_resolve.handler({
    cwd: repoPath,
    mode: "files",
    files: ["src/index.ts"]
  });
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-impact-scope-resolve-public-trim-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    assert.equal(directResult.status, "resolved");
    assert.deepEqual(directResult.scope.files, ["src/index.ts"]);
    assert.deepEqual(directResult.changedFiles, ["src/index.ts"]);
    assert.deepEqual(directResult.warnings, []);

    const response = await client.callTool({
      name: "blueprint_impact_scope_resolve",
      arguments: {
        cwd: repoPath,
        mode: "files",
        files: ["src/index.ts"]
      }
    });
    const structuredContent = response.structuredContent as Record<string, unknown>;

    assert.equal(response.content[0]?.type, "text");
    assert.ok(structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(structuredContent));
    assert.equal(structuredContent.status, "resolved");
    assert.deepEqual(structuredContent.scope, directResult.scope);
    assert.deepEqual(structuredContent.git, directResult.git);
    assert.deepEqual(structuredContent.diffStats, directResult.diffStats);
    assert.equal(structuredContent.patchHash, directResult.patchHash);
    assert.equal(structuredContent.scopeFingerprint, directResult.scopeFingerprint);
    assert.deepEqual(structuredContent.confidence, directResult.confidence);
    assert.ok(!("changedFiles" in structuredContent));
    assert.ok(!("warnings" in structuredContent));
    assert.doesNotMatch(response.content[0]?.text ?? "", /"changedFiles":/);
    assert.doesNotMatch(response.content[0]?.text ?? "", /"warnings":/);
  } finally {
    await client.close();
    await server.close();
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("public review scope live MCP response trims only redundant nested authoring context scope fields while direct handler keeps the full tool contract", async () => {
  const directRepoPath = await createReviewScopeRepo();
  const repoPath = await createReviewScopeRepo();
  const directResult = await blueprintToolRegistry.blueprint_review_scope.handler({
    cwd: directRepoPath,
    phase: "5",
    includeAuthoringContext: true
  });
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-review-scope-public-trim-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    assert.equal(directResult.status, "ready");
    assert.deepEqual(directResult.files, ["src/plan.ts", "src/summary.ts", "tests/plan.test.ts"]);
    assert.deepEqual(directResult.authoringContext?.phase, directResult.phase);
    assert.deepEqual(directResult.authoringContext?.files, directResult.files);
    assert.deepEqual(directResult.authoringContext?.reviewMode, directResult.reviewMode);
    assert.ok(Array.isArray(directResult.warnings));
    assert.ok((directResult.warnings?.length ?? 0) > 0);

    const response = await client.callTool({
      name: "blueprint_review_scope",
      arguments: {
        cwd: repoPath,
        phase: "5",
        includeAuthoringContext: true
      }
    });
    const structuredContent = response.structuredContent as Record<string, unknown>;
    const authoringContext = structuredContent.authoringContext as Record<string, unknown>;

    assert.equal(response.content[0]?.type, "text");
    assert.ok(structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(structuredContent));
    assert.equal(structuredContent.status, "ready");
    assert.deepEqual(structuredContent.phase, directResult.phase);
    assert.deepEqual(structuredContent.files, directResult.files);
    assert.deepEqual(structuredContent.reviewMode, directResult.reviewMode);
    assert.deepEqual(structuredContent.warnings, directResult.warnings);
    assert.ok(authoringContext);
    assert.ok(!("phase" in authoringContext));
    assert.ok(!("files" in authoringContext));
    assert.ok(!("reviewMode" in authoringContext));
    assert.deepEqual(
      authoringContext.knownEvidenceArtifacts,
      directResult.authoringContext?.knownEvidenceArtifacts
    );
    assert.deepEqual(
      authoringContext.allowedNextActions,
      directResult.authoringContext?.allowedNextActions
    );
    assert.equal(
      authoringContext.preferredNextSafeAction,
      directResult.authoringContext?.preferredNextSafeAction
    );
    assert.equal(
      authoringContext.secondaryNextSafeAction,
      directResult.authoringContext?.secondaryNextSafeAction
    );
    assert.doesNotMatch(response.content[0]?.text ?? "", /"authoringContext":\{"phase":/);
    assert.doesNotMatch(response.content[0]?.text ?? "", /"authoringContext":\{[^}]*"files":/);
    assert.doesNotMatch(response.content[0]?.text ?? "", /"authoringContext":\{[^}]*"reviewMode":/);
    assert.match(response.content[0]?.text ?? "", /"warnings":\[/);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
    await rm(path.dirname(directRepoPath), { recursive: true, force: true });
  }
});

test("public impact report write live MCP response preserves non-empty warnings on successful responses", async () => {
  const repoPath = await createImpactFixtureRepo();
  const impactReportWriteDefinition = impactToolDefinitions.find(
    (definition) => definition.name === "blueprint_impact_report_write"
  );

  assert.ok(impactReportWriteDefinition, "impact report write tool definition should exist");

  const originalHandler = impactReportWriteDefinition.handler;
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-impact-report-write-public-warning-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  impactReportWriteDefinition.handler = async () => ({
    status: "written",
    impactId: "impact-2026-05-09",
    impactDir: ".blueprint/impact/impact-2026-05-09",
    paths: {
      report: ".blueprint/impact/impact-2026-05-09/REPORT.json"
    },
    written: true,
    errors: [],
    warnings: ["Impact bundle already matched the canonical content."]
  });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_impact_report_write",
      arguments: {
        cwd: repoPath,
        report: readArtifactContract("report.impact").modelContract?.minimalValidExample
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.status, "written");
    assert.ok(!("errors" in response.structuredContent));
    assert.deepEqual(response.structuredContent.warnings, [
      "Impact bundle already matched the canonical content."
    ]);
    assert.doesNotMatch(response.content[0]?.text ?? "", /"errors":/);
    assert.match(
      response.content[0]?.text ?? "",
      /"warnings":\["Impact bundle already matched the canonical content\."\]/
    );

    const publicResult = JSON.parse(response.content[0]?.text ?? "{}");

    assert.equal(publicResult.status, "written");
    assert.ok(!("errors" in publicResult));
    assert.deepEqual(publicResult.warnings, [
      "Impact bundle already matched the canonical content."
    ]);
  } finally {
    impactReportWriteDefinition.handler = originalHandler;
    await client.close();
    await server.close();
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("public impact report write live MCP response trims empty top-level warnings from invalid responses while preserving direct tool output errors", async () => {
  const repoPath = await createImpactFixtureRepo();
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-impact-report-write-public-invalid-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const invalidReport = structuredClone(
    readArtifactContract("report.impact").modelContract?.minimalValidExample
  ) as Record<string, unknown> | undefined;

  assert.ok(invalidReport, "impact contract should provide a minimal valid example");
  delete invalidReport.summary;

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const directResult = await blueprintToolRegistry.blueprint_impact_report_write.handler({
      cwd: repoPath,
      report: invalidReport
    });
    const response = await client.callTool({
      name: "blueprint_impact_report_write",
      arguments: {
        cwd: repoPath,
        report: invalidReport
      }
    });

    assert.equal(directResult.status, "invalid");
    assert.deepEqual(directResult.warnings, []);
    assert.ok(Array.isArray(directResult.errors));
    assert.ok((directResult.errors.length ?? 0) > 0);

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.status, "invalid");
    assert.ok(!("warnings" in response.structuredContent));
    assert.ok(Array.isArray(response.structuredContent.errors));
    assert.ok((response.structuredContent.errors?.length ?? 0) > 0);
    assert.doesNotMatch(response.content[0]?.text ?? "", /"warnings":/);
    assert.match(response.content[0]?.text ?? "", /"errors":\[/);

    const publicResult = JSON.parse(response.content[0]?.text ?? "{}");

    assert.equal(publicResult.status, "invalid");
    assert.ok(!("warnings" in publicResult));
    assert.ok(Array.isArray(publicResult.errors));
    assert.ok((publicResult.errors?.length ?? 0) > 0);
  } finally {
    await client.close();
    await server.close();
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("public impact output render live MCP response omits empty top-level warnings while preserving direct tool output", async () => {
  const repoPath = await createImpactFixtureRepo();
  const directAnalyzeResult = await blueprintToolRegistry.blueprint_impact_analyze.handler({
    cwd: repoPath,
    changedFiles: ["src/index.ts"]
  });
  const report = (directAnalyzeResult as Record<string, unknown>).report as
    | Record<string, unknown>
    | undefined;
  const directResult = await blueprintToolRegistry.blueprint_impact_output_render.handler({
    cwd: repoPath,
    report,
    mode: "summary"
  });
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-impact-output-render-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    assert.ok(report, "impact analysis should return a report");
    assert.equal(directResult.phaseStatus, "rendered");
    assert.deepEqual(directResult.warnings, []);

    const response = await client.callTool({
      name: "blueprint_impact_output_render",
      arguments: {
        cwd: repoPath,
        report,
        mode: "summary"
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.phaseStatus, "rendered");
    assert.equal(response.structuredContent.mode, directResult.mode);
    assert.equal(response.structuredContent.status, directResult.status);
    assert.equal(response.structuredContent.impactStatus, directResult.impactStatus);
    assert.equal(response.structuredContent.impactId, directResult.impactId);
    assert.equal(response.structuredContent.content, directResult.content);
    assert.ok(!("warnings" in response.structuredContent));
    assert.doesNotMatch(response.content[0]?.text ?? "", /"warnings":/);

    const publicResult = sanitizeToolResultForPublicResponse(
      "blueprint_impact_output_render",
      directResult
    );

    assert.ok(!("warnings" in publicResult));
  } finally {
    await client.close();
    await server.close();
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("public phase checkpoint put live MCP response omits empty top-level warnings while preserving direct tool output", async () => {
  const directRepoPath = await createPhasePlanWriteRepo();
  const repoPath = await createPhasePlanWriteRepo();
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-phase-checkpoint-put-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const checkpoint = {
    ownerCommand: "/blu-discuss-phase",
    completedAreas: [],
    remainingAreas: ["Scope boundaries", "UI expectations"],
    decisions: [],
    deferredIdeas: [],
    canonicalReferences: [],
    resumeMeta: {
      mode: "discuss",
      pendingTopics: ["Scope boundaries", "UI expectations"],
      completedTopics: [],
      notes: [],
      updatedAt: "2026-05-09T00:00:00.000Z"
    }
  };

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const directResult = await blueprintPhaseCheckpointPut({
      cwd: directRepoPath,
      phase: "3",
      checkpoint
    });
    const response = await client.callTool({
      name: "blueprint_phase_checkpoint_put",
      arguments: {
        cwd: repoPath,
        phase: "3",
        checkpoint
      }
    });

    assert.equal(directResult.updated, true);
    assert.deepEqual(directResult.warnings, []);

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.updated, true);
    assert.equal(
      response.structuredContent.path,
      ".blueprint/phases/03-phase-discovery/03-DISCUSS-CHECKPOINT.json"
    );
    assert.ok(!("warnings" in response.structuredContent));
    assert.doesNotMatch(response.content[0]?.text ?? "", /"warnings":/);

    const publicResult = sanitizeToolResultForPublicResponse(
      "blueprint_phase_checkpoint_put",
      directResult
    );

    assert.ok(!("warnings" in publicResult));
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(directRepoPath), { recursive: true, force: true });
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public phase checkpoint get live MCP response omits empty top-level warnings only at the boundary while preserving direct tool output", async () => {
  const repoPath = await createPhasePlanWriteRepo();
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-phase-checkpoint-get-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const checkpoint = {
    ownerCommand: "/blu-discuss-phase",
    completedAreas: [],
    remainingAreas: ["Scope boundaries", "UI expectations"],
    decisions: [],
    deferredIdeas: [],
    canonicalReferences: [],
    resumeMeta: {
      mode: "discuss",
      pendingTopics: ["Scope boundaries", "UI expectations"],
      completedTopics: [],
      notes: [],
      updatedAt: "2026-05-09T00:00:00.000Z"
    }
  };

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const directMissingResult = await blueprintPhaseCheckpointGet({
      cwd: repoPath,
      phase: "3"
    });
    const missingResponse = await client.callTool({
      name: "blueprint_phase_checkpoint_get",
      arguments: {
        cwd: repoPath,
        phase: "3"
      }
    });

    assert.equal(directMissingResult.phaseFound, true);
    assert.equal(directMissingResult.found, false);
    assert.deepEqual(directMissingResult.warnings, []);

    assert.equal(missingResponse.content[0]?.type, "text");
    assert.ok(missingResponse.structuredContent);
    assert.equal(
      missingResponse.content[0]?.text,
      JSON.stringify(missingResponse.structuredContent)
    );
    assert.equal(missingResponse.structuredContent.phaseFound, true);
    assert.equal(missingResponse.structuredContent.found, false);
    assert.ok(!("warnings" in missingResponse.structuredContent));
    assert.doesNotMatch(missingResponse.content[0]?.text ?? "", /"warnings":/);

    await blueprintPhaseCheckpointPut({
      cwd: repoPath,
      phase: "3",
      checkpoint
    });

    const directWarnedResult = await blueprintPhaseCheckpointGet({
      cwd: repoPath,
      phase: "3",
      expectedOwnerCommand: "/blu-research-phase"
    });
    const warnedResponse = await client.callTool({
      name: "blueprint_phase_checkpoint_get",
      arguments: {
        cwd: repoPath,
        phase: "3",
        expectedOwnerCommand: "/blu-research-phase"
      }
    });

    assert.equal(directWarnedResult.found, true);
    assert.equal(directWarnedResult.safeToResume, false);
    assert.ok(Array.isArray(directWarnedResult.warnings));
    assert.ok((directWarnedResult.warnings?.length ?? 0) > 0);

    assert.equal(warnedResponse.content[0]?.type, "text");
    assert.ok(warnedResponse.structuredContent);
    assert.equal(
      warnedResponse.content[0]?.text,
      JSON.stringify(warnedResponse.structuredContent)
    );
    assert.equal(warnedResponse.structuredContent.found, true);
    assert.equal(warnedResponse.structuredContent.safeToResume, false);
    assert.deepEqual(
      warnedResponse.structuredContent.warnings,
      directWarnedResult.warnings
    );
    assert.match(warnedResponse.content[0]?.text ?? "", /"warnings":\[/);

    const publicMissingResult = sanitizeToolResultForPublicResponse(
      "blueprint_phase_checkpoint_get",
      directMissingResult
    );
    const publicWarnedResult = sanitizeToolResultForPublicResponse(
      "blueprint_phase_checkpoint_get",
      directWarnedResult
    );

    assert.ok(!("warnings" in publicMissingResult));
    assert.deepEqual(publicWarnedResult.warnings, directWarnedResult.warnings);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public phase checkpoint delete live MCP response already matches the direct compact contract", async () => {
  const directRepoPath = await createPhasePlanWriteRepo();
  const repoPath = await createPhasePlanWriteRepo();
  const checkpoint = {
    ownerCommand: "/blu-discuss-phase",
    completedAreas: [],
    remainingAreas: ["Scope boundaries", "UI expectations"],
    decisions: [],
    deferredIdeas: [],
    canonicalReferences: [],
    resumeMeta: {
      mode: "discuss",
      pendingTopics: ["Scope boundaries", "UI expectations"],
      completedTopics: [],
      notes: [],
      updatedAt: "2026-05-09T00:00:00.000Z"
    }
  };

  await blueprintPhaseCheckpointPut({
    cwd: directRepoPath,
    phase: "3",
    checkpoint
  });
  await blueprintPhaseCheckpointPut({
    cwd: repoPath,
    phase: "3",
    checkpoint
  });

  const directResult = await blueprintPhaseCheckpointDelete({
    cwd: directRepoPath,
    phase: "3",
    expectedOwnerCommand: "/blu-discuss-phase"
  });

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-phase-checkpoint-delete-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_phase_checkpoint_delete",
      arguments: {
        cwd: repoPath,
        phase: "3",
        expectedOwnerCommand: "/blu-discuss-phase"
      }
    });

    assert.deepEqual(directResult, {
      phaseFound: true,
      phaseNumber: "3",
      phasePrefix: "03",
      phaseName: "Phase Discovery",
      phaseDir: ".blueprint/phases/03-phase-discovery",
      path: ".blueprint/phases/03-phase-discovery/03-DISCUSS-CHECKPOINT.json",
      deleted: true,
      reason: null
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.deepEqual(response.structuredContent, directResult);
    assert.deepEqual(Object.keys(response.structuredContent).sort(), [
      "deleted",
      "path",
      "phaseDir",
      "phaseFound",
      "phaseName",
      "phaseNumber",
      "phasePrefix",
      "reason"
    ]);
    assert.ok(!("warnings" in response.structuredContent));
    assert.ok(!("checkpoint" in response.structuredContent));
    assert.doesNotMatch(response.content[0]?.text ?? "", /"warnings":|"checkpoint":/);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(directRepoPath), { recursive: true, force: true });
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public review load findings response omits only empty top-level warnings while preserving populated warnings", () => {
  const notFoundResult = {
    phaseFound: true,
    found: false,
    phaseNumber: "5",
    phasePrefix: "05",
    phaseName: "Review Scope",
    phaseDir: ".blueprint/phases/05-review-scope",
    artifact: "code-review",
    path: null,
    findings: [],
    severityCounts: { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 },
    followUps: [],
    followUpTargets: [],
    reason: "Phase 5 does not have a saved -REVIEW.md artifact yet.",
    warnings: []
  };
  const successResult = {
    phaseFound: true,
    found: true,
    phaseNumber: "5",
    phasePrefix: "05",
    phaseName: "Review Scope",
    phaseDir: ".blueprint/phases/05-review-scope",
    artifact: "code-review",
    path: ".blueprint/phases/05-review-scope/05-REVIEW.md",
    findings: [
      {
        id: "REV-01",
        visibleId: "REV-01",
        stableId: null,
        legacyDerived: false,
        severity: "medium",
        summary: "Add a regression test for calculateValue before changing behavior.",
        sourceSection: "Findings",
        disposition: "follow-up",
        location: null,
        file: null,
        startLine: null,
        endLine: null,
        evidence: null,
        impact: null,
        recommendation: null,
        classification: "test-gap",
        defaultEligible: true
      }
    ],
    severityCounts: { critical: 0, high: 0, medium: 1, low: 0, unknown: 0 },
    followUps: ["Add the regression test before refactoring."],
    followUpTargets: [],
    reason: null,
    warnings: []
  };
  const warnedResult = {
    ...notFoundResult,
    found: true,
    path: ".blueprint/phases/05-review-scope/05-REVIEW.md",
    reason: null,
    warnings: [
      "No structured findings were parsed from .blueprint/phases/05-review-scope/05-REVIEW.md."
    ]
  };

  const publicNotFoundResult = sanitizeToolResultForPublicResponse(
    "blueprint_review_load_findings",
    notFoundResult
  );
  const publicSuccessResult = sanitizeToolResultForPublicResponse(
    "blueprint_review_load_findings",
    successResult
  );
  const publicWarnedResult = sanitizeToolResultForPublicResponse(
    "blueprint_review_load_findings",
    warnedResult
  );
  const notFoundText = createToolResponseContent(
    "blueprint_review_load_findings",
    notFoundResult
  )[0].text;
  const successText = createToolResponseContent(
    "blueprint_review_load_findings",
    successResult
  )[0].text;
  const warnedText = createToolResponseContent(
    "blueprint_review_load_findings",
    warnedResult
  )[0].text;
  const parsedNotFound = JSON.parse(notFoundText) as Record<string, unknown>;
  const parsedSuccess = JSON.parse(successText) as Record<string, unknown>;
  const parsedWarned = JSON.parse(warnedText) as Record<string, unknown>;

  assert.deepEqual(notFoundResult.warnings, []);
  assert.deepEqual(successResult.warnings, []);
  assert.ok(!("warnings" in publicNotFoundResult));
  assert.ok(!("warnings" in publicSuccessResult));
  assert.ok(!("warnings" in parsedNotFound));
  assert.ok(!("warnings" in parsedSuccess));
  assert.doesNotMatch(notFoundText, /"warnings":/);
  assert.doesNotMatch(successText, /"warnings":/);

  assert.deepEqual(publicWarnedResult.warnings, warnedResult.warnings);
  assert.deepEqual(parsedWarned.warnings, warnedResult.warnings);
  assert.match(warnedText, /"warnings":\[/);
});

test("public review load findings live MCP response trims empty top-level warnings while preserving direct handler warnings and populated warnings", async () => {
  const repoPath = await createCodeReviewSummaryRepo();
  const directNotFoundResult = await blueprintReviewLoadFindings({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review"
  });

  assert.equal(directNotFoundResult.phaseFound, true);
  assert.equal(directNotFoundResult.found, false);
  assert.deepEqual(directNotFoundResult.warnings, []);

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-review-load-findings-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const notFoundResponse = await client.callTool({
      name: "blueprint_review_load_findings",
      arguments: {
        cwd: repoPath,
        phase: "5",
        artifact: "code-review"
      }
    });

    assert.equal(notFoundResponse.content[0]?.type, "text");
    assert.ok(notFoundResponse.structuredContent);
    assert.equal(
      notFoundResponse.content[0]?.text,
      JSON.stringify(notFoundResponse.structuredContent)
    );
    assert.equal(notFoundResponse.structuredContent.phaseFound, true);
    assert.equal(notFoundResponse.structuredContent.found, false);
    assert.ok(!("warnings" in notFoundResponse.structuredContent));
    assert.doesNotMatch(notFoundResponse.content[0]?.text ?? "", /"warnings":/);

    await writeEmptyReviewLoadFindingsArtifact(repoPath);

    const directWarnedResult = await blueprintReviewLoadFindings({
      cwd: repoPath,
      phase: "5",
      artifact: "code-review"
    });
    const warnedResponse = await client.callTool({
      name: "blueprint_review_load_findings",
      arguments: {
        cwd: repoPath,
        phase: "5",
        artifact: "code-review"
      }
    });

    assert.equal(directWarnedResult.phaseFound, true);
    assert.equal(directWarnedResult.found, true);
    assert.ok(Array.isArray(directWarnedResult.warnings));
    assert.ok((directWarnedResult.warnings?.length ?? 0) > 0);

    assert.equal(warnedResponse.content[0]?.type, "text");
    assert.ok(warnedResponse.structuredContent);
    assert.equal(
      warnedResponse.content[0]?.text,
      JSON.stringify(warnedResponse.structuredContent)
    );
    assert.deepEqual(
      warnedResponse.structuredContent.warnings,
      directWarnedResult.warnings
    );
    assert.match(warnedResponse.content[0]?.text ?? "", /"warnings":\[/);

    await writePopulatedReviewLoadFindingsArtifact(repoPath);

    const directSuccessResult = await blueprintReviewLoadFindings({
      cwd: repoPath,
      phase: "5",
      artifact: "code-review"
    });
    const successResponse = await client.callTool({
      name: "blueprint_review_load_findings",
      arguments: {
        cwd: repoPath,
        phase: "5",
        artifact: "code-review"
      }
    });

    assert.equal(directSuccessResult.phaseFound, true);
    assert.equal(directSuccessResult.found, true);
    assert.ok((directSuccessResult.findings?.length ?? 0) > 0);
    assert.deepEqual(directSuccessResult.warnings, []);

    assert.equal(successResponse.content[0]?.type, "text");
    assert.ok(successResponse.structuredContent);
    assert.equal(
      successResponse.content[0]?.text,
      JSON.stringify(successResponse.structuredContent)
    );
    assert.equal(successResponse.structuredContent.found, true);
    assert.ok(Array.isArray(successResponse.structuredContent.findings));
    assert.ok((successResponse.structuredContent.findings?.length ?? 0) > 0);
    assert.ok(!("warnings" in successResponse.structuredContent));
    assert.doesNotMatch(successResponse.content[0]?.text ?? "", /"warnings":/);
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("schema-first validation tools mirror task schemas, previews, and evidence bodies into MCP text", () => {
  const contractResult = {
    artifactId: "phase.verification",
    contract: {
      authoringTemplate: "# Phase {{phasePrefix}}: {{phaseName}} - Verification\n",
      modelContract: {
        schemaVersion: "1.1.0",
        schemaId: "blueprint.phase.verification.model",
        jsonSchema: {
          required: ["coverageSummary", "status", "gateState"]
        }
      }
    }
  };
  const authoringResult = {
    status: "ready",
    phaseFound: true,
    phaseNumber: "3",
    artifact: "verification",
    path: ".blueprint/phases/03-validation-engine/03-VERIFICATION.md",
    allowedValues: { verification: { coverageStates: ["PASS", "COVERED"] } },
    summaryEvidence: [{ path: ".blueprint/phases/03-validation-engine/03-01-SUMMARY.md" }],
    baseSchema: { $id: "blueprint.phase.verification.model" },
    taskSchema: {
      properties: {
        evidenceReviewedSummaryPaths: {
          items: {
            enum: [".blueprint/phases/03-validation-engine/03-01-SUMMARY.md"]
          }
        }
      }
    },
    contract: {
      modelContract: {
        jsonSchema: {
          required: ["coverageSummary", "status", "gateState"]
        }
      }
    },
    existing: {
      content: "# Phase 03: Validation Engine - Verification\n"
    }
  };
  const validateResult = {
    status: "invalid",
    valid: false,
    phase: { phaseNumber: "3" },
    artifact: "verification",
    path: ".blueprint/phases/03-validation-engine/03-VERIFICATION.md",
    diagnostics: [
      {
        source: "schema",
        path: "model.status",
        code: "schema.required",
        message: "must have required property status"
      },
      {
        source: "schema",
        path: "model.validationSummary",
        code: "schema.oneOf",
        message: "must match exactly one schema in oneOf"
      }
    ],
    diagnosticCounts: {
      total: 2,
      bySource: { schema: 2 },
      byCode: { "schema.required": 1, "schema.oneOf": 1 }
    }
  };
  const contractText = createToolResponseContent("blueprint_artifact_contract_read", contractResult)[0].text;
  const authoringText = createToolResponseContent(
    "blueprint_phase_validation_authoring_context",
    authoringResult
  )[0].text;
  const validateText = createToolResponseContent(
    "blueprint_phase_validation_validate_model",
    validateResult
  )[0].text;

  assert.equal(
    contractText,
    expectedStructuredContentJson(contractResult)
  );
  assert.match(contractText, /authoringTemplate/);
  assert.match(contractText, /modelContract/);
  assert.match(contractText, /jsonSchema/);
  assert.equal(
    authoringText,
    expectedStructuredContentJson(authoringResult)
  );
  assert.match(authoringText, /taskSchema|baseSchema|existing/);
  assert.equal(
    validateText,
    expectedStructuredContentJson(validateResult)
  );
  assert.match(validateText, /diagnostics|diagnosticCounts/);
  assert.doesNotMatch(validateText, /taskSchema/);
  assert.doesNotMatch(validateText, /normalizedModel|renderPreview/);
});

test("public phase validation validate tool trims taskSchema, normalized model, and render preview", async () => {
  const repoPath = await createAddTestsReportValidationRepo();

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-phase-validation-validate-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_phase_validation_validate_model",
      arguments: {
        cwd: repoPath,
        phase: "3",
        artifact: "verification",
        model: {}
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.status, "invalid");
    assert.equal(response.structuredContent.valid, false);
    assert.ok(!("taskSchema" in response.structuredContent));
    assert.ok(!("normalizedModel" in response.structuredContent));
    assert.ok(!("renderPreview" in response.structuredContent));
    assert.match(response.content[0]?.text ?? "", /diagnostics|diagnosticCounts|artifact|path/);
    assert.doesNotMatch(
      response.content[0]?.text ?? "",
      /taskSchema|normalizedModel|renderPreview/
    );
  } finally {
    await client.close();
    await server.close();
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("summary and validation reads mirror artifact bodies into MCP text", () => {
  const summaryResult = {
    phaseFound: true,
    found: true,
    phaseNumber: "3",
    planId: "01",
    path: ".blueprint/phases/03-validation-engine/03-01-SUMMARY.md",
    content: "# Phase 03: Validation Engine - Summary 01\n\n## Outcome\n\n- Done.\n",
    validation: { valid: true, issues: [], warnings: [] },
    metadata: { status: "COMPLETED" }
  };
  const validationResult = {
    phaseFound: true,
    found: true,
    phaseNumber: "3",
    artifact: "verification",
    path: ".blueprint/phases/03-validation-engine/03-VERIFICATION.md",
    content: "# Phase 03: Validation Engine - Verification\n\n## Validation Summary\n\n- Done.\n",
    validation: { valid: true, issues: [], warnings: [] },
    verificationReadyForUat: true,
    summaryPaths: [".blueprint/phases/03-validation-engine/03-01-SUMMARY.md"]
  };
  const summaryText = createToolResponseContent("blueprint_phase_summary_read", summaryResult)[0].text;
  const validationText = createToolResponseContent(
    "blueprint_phase_validation_read",
    validationResult
  )[0].text;

  assert.equal(
    summaryText,
    expectedStructuredContentJson(summaryResult)
  );
  assert.match(summaryText, /content|validation|metadata/);
  assert.equal(
    validationText,
    expectedStructuredContentJson(validationResult)
  );
  assert.match(validationText, /content|validation|verificationReadyForUat|summaryPaths/);
});

test("reused write results report preservation instead of a fresh save", () => {
  const summary = summarizeToolResult("blueprint_phase_validation_write", {
    phaseNumber: "3",
    artifact: "verification",
    path: ".blueprint/phases/03-validation-engine/03-VERIFICATION.md",
    summaryPaths: [".blueprint/phases/03-validation-engine/03-01-SUMMARY.md"],
    written: false,
    created: false,
    overwritten: false,
    status: "reused",
    issues: [],
    warnings: ["Preserved existing verification artifact because the content was unchanged."]
  });

  assert.equal(
    summary,
    "Reused existing Phase 3 verification at `.blueprint/phases/03-validation-engine/03-VERIFICATION.md` status: reused (1 summary links, 1 warnings)."
  );
});

test("update summaries stay concise for advisory check and checklist persistence", () => {
  const checkSummary = summarizeToolResult("blueprint_update_check", {
    host: "gemini",
    extensionPath: "/Users/example/.gemini/extensions/blueprint",
    installedVersion: "0.1.0",
    latestVersionLookupStatus: "manual_only",
    updateAvailable: null,
    warnings: ["Blueprint update inspection could not find a git remote for the installed extension; use the manual update checklist."]
  });
  const planSummary = summarizeToolResult("blueprint_update_plan", {
    mode: "manual",
    metadataPath: "/Users/example/.gemini/blueprint/updates/update-plan-latest.json",
    checklistPath: "/Users/example/.gemini/blueprint/updates/update-plan-latest.md",
    status: "created",
    steps: Array.from({ length: 7 }, () => "step"),
    notes: ["note 1", "note 2"],
    warnings: ["Latest version lookup unavailable."],
    requiresRestart: true
  });

  assert.equal(checkSummary, "Checked Blueprint update status (1 warnings).");
  assert.equal(
    planSummary,
    "Prepared Blueprint update plan at `/Users/example/.gemini/blueprint/updates/update-plan-latest.json` status: created (7 steps, 2 notes)."
  );
});

test("public update plan response omits extension manifest path and trims only redundant update-plan paths", () => {
  const redundantResult = {
    mode: "manual",
    path: "/Users/example/.gemini/blueprint/updates/update-plan-latest.json",
    extensionPath: "/Users/example/.gemini/extensions/blueprint",
    extensionManifestPath: "/Users/example/.gemini/extensions/blueprint/gemini-extension.json",
    installedVersion: "0.1.0",
    installProvenance: {
      kind: "extension-path-only",
      source: "/Users/example/.gemini/extensions/blueprint",
      branch: null,
      head: null
    },
    latestVersionLookupStatus: "manual_only",
    savedPaths: {
      updatesDir: "/Users/example/.gemini/blueprint/updates",
      metadataPath: "/Users/example/.gemini/blueprint/updates/update-plan-latest.json",
      checklistPath: "/Users/example/.gemini/blueprint/updates/update-plan-latest.md"
    },
    status: "created",
    steps: Array.from({ length: 7 }, () => "step"),
    notes: ["note 1"],
    requiresRestart: true
  };
  const distinctResult = {
    ...redundantResult,
    path: "/Users/example/.gemini/blueprint/updates/custom-alias.json",
    savedPaths: {
      updatesDir: "/Users/example/.gemini/blueprint/updates",
      metadataPath: "/Users/example/.gemini/blueprint/plan-cache/update-plan-latest.json",
      checklistPath: "/Users/example/.gemini/blueprint/updates/update-plan-latest.md"
    },
    installProvenance: {
      kind: "local-path",
      source: "/Users/example/dev/blueprint",
      branch: "main",
      head: "abc123"
    }
  };

  const trimmedText = createToolResponseContent("blueprint_update_plan", redundantResult)[0].text;
  const untrimmedText = createToolResponseContent("blueprint_update_plan", distinctResult)[0].text;

  const trimmed = JSON.parse(trimmedText);
  const untrimmed = JSON.parse(untrimmedText);

  assert.ok(!("path" in trimmed));
  assert.ok(!("extensionManifestPath" in trimmed));
  assert.ok(!("source" in (trimmed.installProvenance ?? {})));
  assert.doesNotMatch(trimmedText, /"path":/);
  assert.doesNotMatch(trimmedText, /extensionManifestPath/);
  assert.doesNotMatch(trimmedText, /"source":/);
  assert.equal(trimmed.extensionPath, redundantResult.extensionPath);
  assert.equal(trimmed.installedVersion, redundantResult.installedVersion);
  assert.equal(
    trimmed.latestVersionLookupStatus,
    redundantResult.latestVersionLookupStatus
  );
  assert.deepEqual(trimmed.installProvenance, {
    kind: "extension-path-only",
    branch: null,
    head: null
  });
  assert.deepEqual(trimmed.steps, redundantResult.steps);
  assert.deepEqual(trimmed.notes, redundantResult.notes);
  assert.equal(
    trimmed.savedPaths.metadataPath,
    "/Users/example/.gemini/blueprint/updates/update-plan-latest.json"
  );
  assert.equal(
    trimmed.savedPaths.checklistPath,
    "/Users/example/.gemini/blueprint/updates/update-plan-latest.md"
  );
  assert.ok(!("updatesDir" in trimmed.savedPaths));
  assert.equal(trimmed.requiresRestart, true);
  assert.equal(untrimmed.path, "/Users/example/.gemini/blueprint/updates/custom-alias.json");
  assert.ok(!("extensionManifestPath" in untrimmed));
  assert.equal(
    untrimmed.savedPaths.updatesDir,
    "/Users/example/.gemini/blueprint/updates"
  );
  assert.equal(
    untrimmed.savedPaths.metadataPath,
    "/Users/example/.gemini/blueprint/plan-cache/update-plan-latest.json"
  );
  assert.equal(
    untrimmed.savedPaths.checklistPath,
    "/Users/example/.gemini/blueprint/updates/update-plan-latest.md"
  );
  assert.deepEqual(untrimmed.installProvenance, distinctResult.installProvenance);
});

test("public update plan response omits top-level warnings only when empty while preserving steps and notes", () => {
  const baseResult = {
    mode: "manual",
    path: "/Users/example/.gemini/blueprint/updates/update-plan-latest.json",
    extensionPath: "/Users/example/.gemini/extensions/blueprint",
    extensionManifestPath: "/Users/example/.gemini/extensions/blueprint/gemini-extension.json",
    installedVersion: "0.1.0",
    installProvenance: {
      kind: "extension-path-only",
      source: "/Users/example/.gemini/extensions/blueprint",
      branch: null,
      head: null
    },
    latestVersionLookupStatus: "manual_only",
    latestVersion: null,
    latestVersionSource: null,
    updateAvailable: null,
    savedPaths: {
      updatesDir: "/Users/example/.gemini/blueprint/updates",
      metadataPath: "/Users/example/.gemini/blueprint/updates/update-plan-latest.json",
      checklistPath: "/Users/example/.gemini/blueprint/updates/update-plan-latest.md"
    },
    status: "created",
    steps: [{ stage: "Resolve", title: "Resolve host", detail: "detail" }],
    notes: ["note 1"],
    requiresRestart: true
  };
  const emptyWarnings = {
    ...baseResult,
    warnings: []
  };
  const nonEmptyWarnings = {
    ...baseResult,
    warnings: ["Latest version lookup unavailable."]
  };

  const emptyText = createToolResponseContent("blueprint_update_plan", emptyWarnings)[0].text;
  const nonEmptyText = createToolResponseContent("blueprint_update_plan", nonEmptyWarnings)[0].text;
  const emptyPublicResult = JSON.parse(emptyText);
  const nonEmptyPublicResult = JSON.parse(nonEmptyText);

  assert.ok(!("warnings" in emptyPublicResult));
  assert.doesNotMatch(emptyText, /"warnings":/);
  assert.deepEqual(emptyPublicResult.steps, emptyWarnings.steps);
  assert.deepEqual(emptyPublicResult.notes, emptyWarnings.notes);
  assert.equal(emptyPublicResult.extensionPath, emptyWarnings.extensionPath);
  assert.equal(emptyPublicResult.updateAvailable, emptyWarnings.updateAvailable);
  assert.deepEqual(nonEmptyPublicResult.warnings, nonEmptyWarnings.warnings);
  assert.deepEqual(nonEmptyPublicResult.steps, nonEmptyWarnings.steps);
  assert.deepEqual(nonEmptyPublicResult.notes, nonEmptyWarnings.notes);
  assert.equal(nonEmptyPublicResult.extensionPath, nonEmptyWarnings.extensionPath);
  assert.equal(nonEmptyPublicResult.updateAvailable, nonEmptyWarnings.updateAvailable);
});

test("public update check response trims top-level extension manifest path and only removes redundant provenance source", () => {
  const result = {
    host: "gemini",
    extensionPath: "/Users/example/.gemini/extensions/blueprint",
    extensionManifestPath: "/Users/example/.gemini/extensions/blueprint/gemini-extension.json",
    installedVersion: "0.1.0",
    installProvenance: {
      kind: "extension-path-only",
      source: "/Users/example/.gemini/extensions/blueprint",
      branch: null,
      head: null
    },
    latestVersionLookupStatus: "manual_only",
    latestVersion: null,
    latestVersionSource: null,
    updateAvailable: null,
    warnings: ["Blueprint update inspection could not find a git remote for the installed extension; use the manual update checklist."]
  };
  const distinctSourceResult = {
    ...result,
    installProvenance: {
      kind: "local-path",
      source: "/Users/example/dev/blueprint",
      branch: "main",
      head: "abc123"
    }
  };

  const text = createToolResponseContent("blueprint_update_check", result)[0].text;
  const distinctText = createToolResponseContent("blueprint_update_check", distinctSourceResult)[0].text;
  const publicResult = JSON.parse(text);
  const distinctPublicResult = JSON.parse(distinctText);

  assert.ok(!("extensionManifestPath" in publicResult));
  assert.ok(!("source" in (publicResult.installProvenance ?? {})));
  assert.doesNotMatch(text, /extensionManifestPath/);
  assert.doesNotMatch(text, /"source":/);
  assert.equal(publicResult.extensionPath, result.extensionPath);
  assert.equal(publicResult.installedVersion, result.installedVersion);
  assert.deepEqual(publicResult.installProvenance, {
    kind: "extension-path-only",
    branch: null,
    head: null
  });
  assert.equal(
    publicResult.latestVersionLookupStatus,
    result.latestVersionLookupStatus
  );
  assert.equal(publicResult.latestVersionSource, result.latestVersionSource);
  assert.equal(publicResult.updateAvailable, result.updateAvailable);
  assert.deepEqual(distinctPublicResult.installProvenance, distinctSourceResult.installProvenance);
});

test("public update check response omits top-level warnings only when empty while preserving update fields", () => {
  const baseResult = {
    host: "gemini",
    extensionPath: "/Users/example/.gemini/extensions/blueprint",
    extensionManifestPath: "/Users/example/.gemini/extensions/blueprint/gemini-extension.json",
    installedVersion: "0.1.0",
    installProvenance: {
      kind: "extension-path-only",
      source: "/Users/example/.gemini/extensions/blueprint",
      branch: null,
      head: null
    },
    latestVersionLookupStatus: "manual_only",
    latestVersion: null,
    latestVersionSource: null,
    updateAvailable: null
  };
  const emptyWarnings = {
    ...baseResult,
    warnings: []
  };
  const nonEmptyWarnings = {
    ...baseResult,
    warnings: [
      "Blueprint update inspection could not find a git remote for the installed extension; use the manual update checklist."
    ]
  };

  const emptyText = createToolResponseContent("blueprint_update_check", emptyWarnings)[0].text;
  const nonEmptyText = createToolResponseContent("blueprint_update_check", nonEmptyWarnings)[0].text;
  const emptyPublicResult = JSON.parse(emptyText);
  const nonEmptyPublicResult = JSON.parse(nonEmptyText);

  assert.ok(!("warnings" in emptyPublicResult));
  assert.doesNotMatch(emptyText, /"warnings":/);
  assert.equal(emptyPublicResult.extensionPath, emptyWarnings.extensionPath);
  assert.equal(emptyPublicResult.installedVersion, emptyWarnings.installedVersion);
  assert.equal(emptyPublicResult.latestVersionLookupStatus, emptyWarnings.latestVersionLookupStatus);
  assert.equal(emptyPublicResult.updateAvailable, emptyWarnings.updateAvailable);
  assert.deepEqual(nonEmptyPublicResult.warnings, nonEmptyWarnings.warnings);
  assert.equal(nonEmptyPublicResult.extensionPath, nonEmptyWarnings.extensionPath);
  assert.equal(nonEmptyPublicResult.installedVersion, nonEmptyWarnings.installedVersion);
  assert.equal(
    nonEmptyPublicResult.latestVersionLookupStatus,
    nonEmptyWarnings.latestVersionLookupStatus
  );
  assert.equal(nonEmptyPublicResult.updateAvailable, nonEmptyWarnings.updateAvailable);
});

test("public state load response trims duplicate top-level blockers only when redundant", () => {
  const redundantResult = {
    state: {
      projectStatus: "active",
      currentMilestone: "v1",
      currentPhase: "2",
      activeCommand: "/blu-execute-phase",
      nextAction: "Run /blu-validate-phase 2",
      blockers: ["Waiting on verification evidence", "Pending stakeholder sign-off"],
      roadmapEvolutionNotes: [],
      lastUpdated: "2026-05-09T00:00:00.000Z"
    },
    blockers: ["Waiting on verification evidence", "Pending stakeholder sign-off"],
    derivedStatus: {
      projectStatus: "active",
      currentPhase: "2",
      nextAction: "Run /blu-validate-phase 2",
      hasBlockers: true,
      milestoneAudit: {
        found: false,
        verdict: null,
        gapSections: {
          requirement: [],
          integration: [],
          flow: [],
          optional: []
        },
        hasActionableGaps: false,
        hasArchivalBlockers: false,
        nextSafeAction: null,
        readyForCompletion: false
      }
    }
  };
  const distinctResult = {
    ...redundantResult,
    blockers: ["Waiting on verification evidence"]
  };

  const trimmedText = createToolResponseContent("blueprint_state_load", redundantResult)[0].text;
  const untrimmedText = createToolResponseContent("blueprint_state_load", distinctResult)[0].text;

  const trimmed = JSON.parse(trimmedText);
  const untrimmed = JSON.parse(untrimmedText);

  assert.ok(!("blockers" in trimmed));
  assert.ok(!trimmedText.includes('},"blockers":'));
  assert.deepEqual(trimmed.state.blockers, [
    "Waiting on verification evidence",
    "Pending stakeholder sign-off"
  ]);
  assert.deepEqual(untrimmed.blockers, ["Waiting on verification evidence"]);
});

test("public phase research status trims planning readiness diagnostics only when they duplicate top-level context or UI-spec diagnostics", () => {
  const duplicatedContextDiagnostics = [
    {
      source: "artifact",
      path: "content.sections.1",
      code: "context.missing_required_section",
      message: "Missing required section: Goals"
    }
  ];
  const duplicatedUiSpecDiagnostics = [
    {
      source: "artifact",
      path: "content.sections.2",
      code: "ui_spec.outcome_mode_missing",
      message: "Outcome Mode is required."
    }
  ];

  const contextDuplicateText = createToolResponseContent("blueprint_phase_research_status", {
    hasContext: true,
    hasResearch: false,
    hasUiSpec: false,
    contextDiagnostics: duplicatedContextDiagnostics,
    uiSpecDiagnostics: [],
    planningReadiness: {
      readyForPlanPhase: false,
      nextSafeAction: "Run /blu-discuss-phase 3 to rebuild the current phase context",
      blockers: ["Saved phase context exists but is not usable for planning."],
      diagnostics: duplicatedContextDiagnostics
    }
  })[0].text;
  const uiSpecDuplicateText = createToolResponseContent("blueprint_phase_research_status", {
    hasContext: true,
    hasResearch: true,
    hasUiSpec: true,
    contextDiagnostics: [],
    uiSpecDiagnostics: duplicatedUiSpecDiagnostics,
    planningReadiness: {
      readyForPlanPhase: false,
      nextSafeAction: "Run /blu-ui-phase 3 to draft the phase UI contract",
      blockers: ["workflow.ui_phase=true but the saved XX-UI-SPEC.md artifact is not usable."],
      diagnostics: duplicatedUiSpecDiagnostics
    }
  })[0].text;
  const distinctText = createToolResponseContent("blueprint_phase_research_status", {
    hasContext: true,
    hasResearch: true,
    hasUiSpec: true,
    contextDiagnostics: duplicatedContextDiagnostics,
    uiSpecDiagnostics: [],
    planningReadiness: {
      readyForPlanPhase: false,
      nextSafeAction: "Run /blu-discuss-phase 3 to rebuild the current phase context",
      blockers: ["Saved phase context exists but is not usable for planning."],
      diagnostics: [
        ...duplicatedContextDiagnostics,
        {
          source: "artifact",
          path: "planningReadiness",
          code: "planning.extra",
          message: "Additional planning-only diagnostic."
        }
      ]
    }
  })[0].text;

  const contextDuplicate = JSON.parse(contextDuplicateText);
  const uiSpecDuplicate = JSON.parse(uiSpecDuplicateText);
  const distinct = JSON.parse(distinctText);

  assert.ok(!("diagnostics" in contextDuplicate.planningReadiness));
  assert.ok(!("diagnostics" in uiSpecDuplicate.planningReadiness));
  assert.doesNotMatch(contextDuplicateText, /"planningReadiness":\{[^}]*"diagnostics":/);
  assert.doesNotMatch(uiSpecDuplicateText, /"planningReadiness":\{[^}]*"diagnostics":/);
  assert.deepEqual(contextDuplicate.contextDiagnostics, duplicatedContextDiagnostics);
  assert.deepEqual(uiSpecDuplicate.uiSpecDiagnostics, duplicatedUiSpecDiagnostics);
  assert.deepEqual(distinct.planningReadiness.diagnostics, [
    ...duplicatedContextDiagnostics,
    {
      source: "artifact",
      path: "planningReadiness",
      code: "planning.extra",
      message: "Additional planning-only diagnostic."
    }
  ]);
});

test("public phase context trims nested codebase warnings only when they duplicate top-level warnings", () => {
  const duplicateWarning =
    "Mapped codebase summaries are available and should be reused before rereading broad repo surfaces.";
  const duplicateResult = {
    phase: {
      phaseNumber: "1"
    },
    codebase: {
      mapped: true,
      artifacts: [".blueprint/codebase/STACK.md"],
      missingArtifacts: [],
      digest: [],
      warnings: [duplicateWarning]
    },
    warnings: [
      "Research quality will be limited until XX-CONTEXT.md exists.",
      duplicateWarning
    ]
  };
  const distinctResult = {
    ...duplicateResult,
    codebase: {
      ...duplicateResult.codebase,
      warnings: [
        duplicateWarning,
        "Saved codebase docs exist but are not yet valid enough to reuse as authoritative mapped context."
      ]
    }
  };
  const noTopLevelWarningsResult = {
    ...duplicateResult,
    warnings: []
  };

  const duplicatePublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_phase_context",
    duplicateResult
  );
  const distinctPublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_phase_context",
    distinctResult
  );
  const noTopLevelWarningsPublicResult = sanitizeToolResultForPublicResponse(
    "blueprint_phase_context",
    noTopLevelWarningsResult
  );
  const duplicateText = createToolResponseContent("blueprint_phase_context", duplicateResult)[0].text;
  const distinctText = createToolResponseContent("blueprint_phase_context", distinctResult)[0].text;
  const noTopLevelWarningsText = createToolResponseContent(
    "blueprint_phase_context",
    noTopLevelWarningsResult
  )[0].text;

  assert.ok(!("warnings" in (duplicatePublicResult.codebase as Record<string, unknown>)));
  assert.doesNotMatch(duplicateText, /"codebase":\{[^}]*"warnings":/);
  assert.deepEqual(duplicatePublicResult.warnings, duplicateResult.warnings);

  assert.deepEqual(
    (distinctPublicResult.codebase as Record<string, unknown>).warnings,
    distinctResult.codebase.warnings
  );
  assert.match(distinctText, /"codebase":\{.*"warnings":\[/);

  assert.deepEqual(
    (noTopLevelWarningsPublicResult.codebase as Record<string, unknown>).warnings,
    noTopLevelWarningsResult.codebase.warnings
  );
  assert.match(noTopLevelWarningsText, /"codebase":\{.*"warnings":\[/);
});

test("public impact context load trims nested config and roadmap warnings only when fully duplicated", () => {
  const redundantResult = {
    status: "loaded",
    config: {
      status: "updated",
      warnings: ["Config warning A", "Shared warning"]
    },
    roadmap: {
      found: true,
      warnings: ["Shared warning"]
    },
    repoHints: {
      cwdAccepted: true
    },
    phases: [],
    warnings: ["Config warning A", "Shared warning", "Top-level only warning"]
  };
  const distinctResult = {
    ...redundantResult,
    config: {
      status: "updated",
      warnings: ["Config warning A", "Config-only warning"]
    },
    roadmap: {
      found: true,
      warnings: ["Roadmap-only warning"]
    }
  };

  const trimmedText = createToolResponseContent(
    "blueprint_impact_context_load",
    redundantResult
  )[0].text;
  const untrimmedText = createToolResponseContent(
    "blueprint_impact_context_load",
    distinctResult
  )[0].text;

  const trimmed = JSON.parse(trimmedText);
  const untrimmed = JSON.parse(untrimmedText);

  assert.ok(!("warnings" in trimmed.config));
  assert.ok(!("warnings" in trimmed.roadmap));
  assert.doesNotMatch(trimmedText, /"config":\{"status":"updated","warnings":/);
  assert.doesNotMatch(trimmedText, /"roadmap":\{"found":true,"warnings":/);
  assert.deepEqual(trimmed.warnings, [
    "Config warning A",
    "Shared warning",
    "Top-level only warning"
  ]);
  assert.deepEqual(untrimmed.config.warnings, ["Config warning A", "Config-only warning"]);
  assert.deepEqual(untrimmed.roadmap.warnings, ["Roadmap-only warning"]);
});

test("public impact config get trims only the generic Phase 3 success warning while preserving other fields", () => {
  const result = {
    status: "ok",
    config: {
      schemaVersion: "blueprint.impact.config.v1",
      reporting: {
        defaultVerbosity: "normal"
      }
    },
    provenance: {
      layersApplied: ["host-global-defaults", "project"],
      defaultsPath: "~/.gemini/blueprint/impact-config.json",
      projectPath: ".blueprint/impact-config.json",
      invocationPath: null
    },
    warnings: [
      "No project impact config found at .blueprint/impact-config.json; using built-in safe defaults for that layer.",
      "Impact config loaded successfully through the Phase 3 config resolver."
    ],
    errors: [],
    configHash: "abc123"
  };

  const publicResult = sanitizeToolResultForPublicResponse(
    "blueprint_impact_config_get",
    result
  );
  const text = createToolResponseContent("blueprint_impact_config_get", result)[0].text;
  const parsed = JSON.parse(text);

  assert.deepEqual(publicResult, parsed);
  assert.equal(publicResult.status, result.status);
  assert.deepEqual(publicResult.config, result.config);
  assert.deepEqual(publicResult.provenance, result.provenance);
  assert.deepEqual(publicResult.errors, result.errors);
  assert.equal(publicResult.configHash, result.configHash);
  assert.deepEqual(publicResult.warnings, [
    "No project impact config found at .blueprint/impact-config.json; using built-in safe defaults for that layer."
  ]);
  assert.doesNotMatch(text, /Impact config loaded successfully through the Phase 3 config resolver\./);
});

test("public impact context load trims nested config provenance and sourcePath while keeping config payload", () => {
  const result = {
    status: "loaded",
    config: {
      scope: "effective",
      config: {
        model_profile: "balanced",
        workflow: {
          use_worktrees: true
        }
      },
      provenance: {
        defaultsApplied: true,
        defaultsPath: "~/.gemini/blueprint/defaults.json",
        projectApplied: true,
        projectPath: ".blueprint/config.json"
      },
      sourcePath: ".blueprint/config.json",
      warnings: ["Shared config warning"]
    },
    roadmap: {
      found: true,
      warnings: ["Shared roadmap warning"]
    },
    repoHints: {
      cwdAccepted: true
    },
    phases: [],
    warnings: ["Shared config warning", "Shared roadmap warning"]
  };

  const text = createToolResponseContent("blueprint_impact_context_load", result)[0].text;
  const parsed = JSON.parse(text);

  assert.deepEqual(parsed.config.config, result.config.config);
  assert.equal(parsed.config.scope, "effective");
  assert.ok(!("provenance" in parsed.config));
  assert.ok(!("sourcePath" in parsed.config));
  assert.ok(!("warnings" in parsed.config));
  assert.ok(!("warnings" in parsed.roadmap));
  assert.doesNotMatch(text, /"provenance":|"sourcePath":/);
});

test("public impact config get live MCP response trims only the generic success warning at the public boundary", async () => {
  const repoPath = await createImpactFixtureRepo();
  const directResult = await blueprintToolRegistry.blueprint_impact_config_get.handler({
    cwd: repoPath
  });
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-impact-config-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    assert.equal(directResult.status, "ok");
    assert.ok(
      Array.isArray(directResult.warnings) &&
        directResult.warnings.includes(
          "Impact config loaded successfully through the Phase 3 config resolver."
        )
    );

    const expectedWarnings = (directResult.warnings as string[]).filter(
      (warning) =>
        warning !== "Impact config loaded successfully through the Phase 3 config resolver."
    );

    assert.ok(expectedWarnings.length > 0);

    const response = await client.callTool({
      name: "blueprint_impact_config_get",
      arguments: {
        cwd: repoPath
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.status, directResult.status);
    assert.deepEqual(response.structuredContent.config, directResult.config);
    assert.deepEqual(response.structuredContent.provenance, directResult.provenance);
    assert.deepEqual(response.structuredContent.errors, directResult.errors);
    assert.equal(response.structuredContent.configHash, directResult.configHash);
    assert.deepEqual(response.structuredContent.warnings, expectedWarnings);
    assert.doesNotMatch(
      response.content[0]?.text ?? "",
      /Impact config loaded successfully through the Phase 3 config resolver\./
    );
    assert.ok(
      (response.structuredContent.warnings as string[]).every(
        (warning) =>
          warning !== "Impact config loaded successfully through the Phase 3 config resolver."
      )
    );
  } finally {
    await client.close();
    await server.close();
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("public patch record trims top-level paths and patch list trims top-level registryPath plus nested patch file paths in live MCP responses", async () => {
  const { globalHome, patch, repoPath } = await createPatchResponseRepo();
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-patch-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    await withEnvOverrides(
      {
        BLUEPRINT_GLOBAL_HOME: globalHome
      },
      async () => {
        const recordResponse = await client.callTool({
          name: "blueprint_patch_record",
          arguments: {
            cwd: repoPath,
            patchId: "readme-fix",
            patch,
            trackedFiles: ["README.md"],
            label: "README fix"
          }
        });

        assert.equal(recordResponse.content[0]?.type, "text");
        assert.ok(recordResponse.structuredContent);
        assert.equal(
          recordResponse.content[0]?.text,
          JSON.stringify(recordResponse.structuredContent)
        );
        assert.equal(recordResponse.structuredContent.patchId, "readme-fix");
        assert.deepEqual(recordResponse.structuredContent.trackedFiles, ["README.md"]);
        assert.equal(recordResponse.structuredContent.updated, false);
        assert.ok(!("registryPath" in recordResponse.structuredContent));
        assert.ok(!("manifestPath" in recordResponse.structuredContent));
        assert.ok(!("patchPath" in recordResponse.structuredContent));
        assert.ok(!("auditPath" in recordResponse.structuredContent));
        assert.doesNotMatch(recordResponse.content[0]?.text ?? "", /"registryPath":/);
        assert.doesNotMatch(recordResponse.content[0]?.text ?? "", /"manifestPath":/);
        assert.doesNotMatch(recordResponse.content[0]?.text ?? "", /"patchPath":/);
        assert.doesNotMatch(recordResponse.content[0]?.text ?? "", /"auditPath":/);

        const listResponse = await client.callTool({
          name: "blueprint_patch_list",
          arguments: {
            cwd: repoPath
          }
        });

        assert.equal(listResponse.content[0]?.type, "text");
        assert.ok(listResponse.structuredContent);
        assert.equal(
          listResponse.content[0]?.text,
          JSON.stringify(listResponse.structuredContent)
        );
        assert.ok(!("registryPath" in listResponse.structuredContent));
        assert.equal(listResponse.structuredContent.patches.length, 1);
        assert.equal(listResponse.structuredContent.patches[0]?.patchId, "readme-fix");
        assert.equal(listResponse.structuredContent.patches[0]?.label, "README fix");
        assert.deepEqual(listResponse.structuredContent.patches[0]?.trackedFiles, ["README.md"]);
        assert.equal(listResponse.structuredContent.patches[0]?.lastAppliedAt ?? null, null);
        assert.equal(listResponse.structuredContent.patches[0]?.lastOutcome, "recorded");
        assert.deepEqual(listResponse.structuredContent.patches[0]?.compatibility, {
          status: "compatible",
          reasons: []
        });
        assert.ok(!("manifestPath" in listResponse.structuredContent.patches[0]));
        assert.ok(!("patchPath" in listResponse.structuredContent.patches[0]));
        assert.ok(!("auditPath" in listResponse.structuredContent.patches[0]));
        assert.doesNotMatch(listResponse.content[0]?.text ?? "", /"registryPath":/);
        assert.doesNotMatch(listResponse.content[0]?.text ?? "", /"manifestPath":/);
        assert.doesNotMatch(listResponse.content[0]?.text ?? "", /"patchPath":/);
        assert.doesNotMatch(listResponse.content[0]?.text ?? "", /"auditPath":/);
      }
    );
  } finally {
    await Promise.all([client.close(), server.close()]);
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public patch reapply live MCP response trims registryPath", async () => {
  const { globalHome, patch, repoPath } = await createPatchResponseRepo();
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-patch-reapply-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    await withEnvOverrides(
      {
        BLUEPRINT_GLOBAL_HOME: globalHome
      },
      async () => {
        await client.callTool({
          name: "blueprint_patch_record",
          arguments: {
            cwd: repoPath,
            patchId: "readme-fix",
            patch,
            trackedFiles: ["README.md"],
            label: "README fix"
          }
        });

        await runGit(["checkout", "--", "README.md"], repoPath);
        assert.equal(await runGit(["status", "--short"], repoPath), "");

        const targetHead = await runGit(["rev-parse", "HEAD"], repoPath);
        const response = await client.callTool({
          name: "blueprint_patch_reapply",
          arguments: {
            cwd: repoPath
          }
        });

        assert.equal(response.content[0]?.type, "text");
        assert.ok(response.structuredContent);
        assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
        assert.ok(!("registryPath" in response.structuredContent));
        assert.doesNotMatch(response.content[0]?.text ?? "", /"registryPath":/);
        assert.deepEqual(response.structuredContent.appliedPatches, ["readme-fix"]);
        assert.deepEqual(response.structuredContent.conflicts, []);
        assert.equal(response.structuredContent.preview, false);
        assert.equal(response.structuredContent.targetHead, targetHead);
        assert.deepEqual(response.structuredContent.skippedPatches, []);
        assert.match(await readFile(path.join(repoPath, "README.md"), "utf8"), /patched line/);
      }
    );
  } finally {
    await Promise.all([client.close(), server.close()]);
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("public update plan live MCP response preserves non-empty warnings while omitting extension manifest path and redundant top-level metadata path", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-update-plan-public-"));
  const globalHome = path.join(tempRoot, "global-home");
  const extensionPath = await createInstalledExtensionFixture(tempRoot, "tabnine");
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-update-plan-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    await withEnvOverrides(
      {
        BLUEPRINT_HOST: "tabnine",
        BLUEPRINT_GLOBAL_HOME: globalHome,
        BLUEPRINT_EXTENSION_PATH: extensionPath
      },
      async () => {
        const response = await client.callTool({
          name: "blueprint_update_plan",
          arguments: {
            mode: "manual"
          }
        });

        assert.equal(response.content[0]?.type, "text");
        assert.ok(response.structuredContent);
        assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
        assert.equal(response.structuredContent.status, "created");
        assert.ok(!("path" in response.structuredContent));
        assert.ok(!("extensionManifestPath" in response.structuredContent));
        assert.equal(response.structuredContent.extensionPath, extensionPath);
        assert.equal(response.structuredContent.installedVersion, "0.1.0");
        assert.deepEqual(response.structuredContent.installProvenance, {
          kind: "extension-path-only",
          branch: null,
          head: null
        });
        assert.equal(
          response.structuredContent.latestVersionLookupStatus,
          "manual_only"
        );
        assert.ok(Array.isArray(response.structuredContent.steps));
        assert.ok(response.structuredContent.steps.length > 0);
        assert.ok(Array.isArray(response.structuredContent.notes));
        assert.ok(Array.isArray(response.structuredContent.warnings));
        assert.ok((response.structuredContent.warnings?.length ?? 0) > 0);
        assert.equal(
          response.structuredContent.savedPaths?.metadataPath,
          path.join(globalHome, "updates", "update-plan-latest.json")
        );
        assert.equal(
          response.structuredContent.savedPaths?.checklistPath,
          path.join(globalHome, "updates", "update-plan-latest.md")
        );
        assert.ok(!("updatesDir" in (response.structuredContent.savedPaths ?? {})));
        assert.equal(response.structuredContent.requiresRestart, true);
        assert.doesNotMatch(response.content[0]?.text ?? "", /extensionManifestPath/);
        assert.doesNotMatch(response.content[0]?.text ?? "", /"source":/);
        assert.doesNotMatch(response.content[0]?.text ?? "", /updatesDir/);
        assert.match(response.content[0]?.text ?? "", /"warnings":\[/);
      }
    );
  } finally {
    await Promise.all([client.close(), server.close()]);
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("public update plan live MCP response omits empty top-level warnings while preserving steps, notes, and update fields", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-update-plan-public-empty-warnings-"));
  const globalHome = path.join(tempRoot, "global-home");
  const extensionPath = await createInstalledExtensionFixture(tempRoot, "tabnine");
  const gitShimDir = await createGitShim(tempRoot);
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-update-plan-public-empty-warnings-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    await withMockFetch(
      async () =>
        new Response(
          JSON.stringify({
            version: "0.1.1"
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        ),
      async () => {
        await withEnvOverrides(
          {
            BLUEPRINT_HOST: "tabnine",
            BLUEPRINT_GLOBAL_HOME: globalHome,
            BLUEPRINT_EXTENSION_PATH: extensionPath,
            PATH: `${gitShimDir}${path.delimiter}${process.env.PATH ?? ""}`
          },
          async () => {
            const response = await client.callTool({
              name: "blueprint_update_plan",
              arguments: {
                mode: "manual"
              }
            });

            assert.equal(response.content[0]?.type, "text");
            assert.ok(response.structuredContent);
            assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
            assert.ok(!("warnings" in response.structuredContent));
            assert.ok(!("extensionManifestPath" in response.structuredContent));
            assert.equal(response.structuredContent.extensionPath, extensionPath);
            assert.equal(response.structuredContent.installedVersion, "0.1.0");
            assert.equal(response.structuredContent.latestVersionLookupStatus, "available");
            assert.equal(response.structuredContent.latestVersion, "0.1.1");
            assert.equal(response.structuredContent.updateAvailable, true);
            assert.ok(Array.isArray(response.structuredContent.steps));
            assert.ok(response.structuredContent.steps.length > 0);
            assert.ok(Array.isArray(response.structuredContent.notes));
            assert.ok(response.structuredContent.notes.length > 0);
            assert.equal(
              response.structuredContent.savedPaths?.metadataPath,
              path.join(globalHome, "updates", "update-plan-latest.json")
            );
            assert.equal(
              response.structuredContent.savedPaths?.checklistPath,
              path.join(globalHome, "updates", "update-plan-latest.md")
            );
            assert.ok(!("updatesDir" in (response.structuredContent.savedPaths ?? {})));
            assert.doesNotMatch(response.content[0]?.text ?? "", /"warnings":/);
          }
        );
      }
    );
  } finally {
    await Promise.all([client.close(), server.close()]);
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("public state load live MCP response trims duplicate top-level blockers", async () => {
  const repoPath = await createStateLoadRepo();
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-state-load-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const response = await client.callTool({
      name: "blueprint_state_load",
      arguments: {
        cwd: repoPath
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.ok(!("blockers" in response.structuredContent));
    assert.deepEqual(response.structuredContent.state?.blockers, [
      "Waiting on verification evidence",
      "Pending stakeholder sign-off"
    ]);
    assert.equal(response.structuredContent.derivedStatus?.hasBlockers, true);
  } finally {
    await Promise.all([client.close(), server.close()]);
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("roadmap read live MCP response trims only the public boundary while the direct handler keeps the full contract", async () => {
  const repoPath = await createRoadmapReadRepo();
  const directResult = await blueprintToolRegistry["blueprint_roadmap_read"].handler({
    cwd: repoPath
  });
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-roadmap-read-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    assert.equal(directResult.roadmap?.phaseCount, 1);
    assert.deepEqual(directResult.warnings, []);
    assert.deepEqual(directResult.recovery, []);
    assert.equal((directResult.phases as unknown[])?.length, 1);

    const response = await client.callTool({
      name: "blueprint_roadmap_read",
      arguments: {
        cwd: repoPath
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.roadmap?.path, ".blueprint/ROADMAP.md");
    assert.equal(response.structuredContent.milestone, "v1");
    assert.equal(response.structuredContent.phases?.length, 1);
    assert.ok(!("phaseCount" in (response.structuredContent.roadmap ?? {})));
    assert.ok(!("warnings" in response.structuredContent));
    assert.ok(!("recovery" in response.structuredContent));
  } finally {
    await Promise.all([client.close(), server.close()]);
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("phase locate live MCP response trims only the public boundary while the direct handler keeps empty arrays on success", async () => {
  const repoPath = await createRoadmapReadRepo();
  const directResult = await blueprintToolRegistry["blueprint_phase_locate"].handler({
    cwd: repoPath
  });
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-phase-locate-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    assert.equal(directResult.found, true);
    assert.equal(directResult.phaseNumber, "1");
    assert.equal(directResult.phaseDir, ".blueprint/phases/01-discovery");
    assert.deepEqual(directResult.warnings, []);
    assert.deepEqual(directResult.recovery, []);

    const response = await client.callTool({
      name: "blueprint_phase_locate",
      arguments: {
        cwd: repoPath
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.found, true);
    assert.equal(response.structuredContent.phaseNumber, "1");
    assert.equal(response.structuredContent.phaseDir, ".blueprint/phases/01-discovery");
    assert.ok(!("warnings" in response.structuredContent));
    assert.ok(!("recovery" in response.structuredContent));
  } finally {
    await Promise.all([client.close(), server.close()]);
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("command catalog live MCP response trims only the public boundary while the direct handler keeps waves", async () => {
  const directResult = await blueprintToolRegistry["blueprint_command_catalog"].handler({});
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-command-catalog-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    assert.ok(directResult.commands);
    assert.ok(directResult.waves);
    assert.equal(typeof directResult.commands, "object");
    assert.equal(typeof directResult.waves, "object");

    const derivedWaves = Object.entries(
      directResult.commands as Record<string, { wave: number }>
    ).reduce<Record<string, string[]>>((acc, [commandName, entry]) => {
      const waveKey = String(entry.wave);
      acc[waveKey] ??= [];
      acc[waveKey].push(commandName);
      return acc;
    }, {});

    assert.deepEqual(directResult.waves, derivedWaves);

    const response = await client.callTool({
      name: "blueprint_command_catalog",
      arguments: {}
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.deepEqual(response.structuredContent.commands, directResult.commands);
    assert.deepEqual(response.structuredContent.aliases, directResult.aliases);
    assert.ok(!("waves" in response.structuredContent));
    assert.doesNotMatch(response.content[0]?.text ?? "", /"waves":/);
    assert.deepEqual(directResult.waves, derivedWaves);
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
});

test("phase plan index live MCP response trims only the public boundary while the direct handler keeps waves", async () => {
  const repoPath = await createPhasePlanWriteRepo();
  const firstPlanContent = validPhasePlanWriteContent("01");
  const secondPlanContent = validPhasePlanWriteContent("02").replace("wave: 1", "wave: 2");

  await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    content: firstPlanContent,
    overwrite: true
  });
  await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    content: secondPlanContent,
    overwrite: true
  });

  const directResult = await blueprintToolRegistry["blueprint_phase_plan_index"].handler({
    cwd: repoPath,
    phase: "3"
  });
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-phase-plan-index-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    assert.deepEqual(directResult.waves, {
      "1": [".blueprint/phases/03-phase-discovery/03-01-PLAN.md"],
      "2": [".blueprint/phases/03-phase-discovery/03-02-PLAN.md"]
    });
    assert.equal((directResult.plans as unknown[])?.length, 2);

    const response = await client.callTool({
      name: "blueprint_phase_plan_index",
      arguments: {
        cwd: repoPath,
        phase: "3"
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.equal(response.structuredContent.phaseFound, true);
    assert.equal(response.structuredContent.phaseNumber, "3");
    assert.equal(response.structuredContent.plans?.length, 2);
    assert.ok(!("waves" in response.structuredContent));
    assert.doesNotMatch(response.content[0]?.text ?? "", /"waves":/);
    assert.deepEqual(directResult.waves, {
      "1": [".blueprint/phases/03-phase-discovery/03-01-PLAN.md"],
      "2": [".blueprint/phases/03-phase-discovery/03-02-PLAN.md"]
    });
  } finally {
    await Promise.all([client.close(), server.close()]);
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("artifact summary digest live MCP response mirrors structuredContent and keeps only digest evidence plus inputs used", async () => {
  const repoPath = await createProjectInitRepo();

  try {
    await writeFile(
      path.join(repoPath, "package.json"),
      JSON.stringify(
        {
          name: "summary-digest-fixture",
          version: "1.0.0",
          scripts: {
            test: "tsx --test"
          }
        },
        null,
        2
      ),
      "utf8"
    );
    await mkdir(path.join(repoPath, "src"), { recursive: true });
    await mkdir(path.join(repoPath, "tests"), { recursive: true });
    await mkdir(path.join(repoPath, "docs"), { recursive: true });
    await writeFile(path.join(repoPath, "src", "server.ts"), 'export const marker = "mcp";\n', "utf8");
    await writeFile(
      path.join(repoPath, "tests", "server.test.ts"),
      'import assert from "node:assert/strict";\nassert.equal(1, 1);\n',
      "utf8"
    );
    await writeFile(
      path.join(repoPath, "docs", "notes.md"),
      "# Notes\n\nDigest evidence should keep repo context compact.\n",
      "utf8"
    );

    const directResult = await blueprintToolRegistry.blueprint_artifact_summary_digest.handler({
      cwd: repoPath,
      focusArea: "runtime boundary coverage",
      packageJsonPath: "package.json",
      readmePath: "README.md",
      sourceFiles: ["src/server.ts"],
      testFiles: ["tests/server.test.ts"],
      docFiles: ["docs/notes.md"],
      trackedFiles: ["README.md", "package.json", "src/server.ts"]
    });
    const server = createBlueprintServer();
    const client = new Client(
      { name: "blueprint-artifact-summary-digest-public-test-client", version: "1.0.0" },
      { capabilities: {} }
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    try {
      const response = await client.callTool({
        name: "blueprint_artifact_summary_digest",
        arguments: {
          cwd: repoPath,
          focusArea: "runtime boundary coverage",
          packageJsonPath: "package.json",
          readmePath: "README.md",
          sourceFiles: ["src/server.ts"],
          testFiles: ["tests/server.test.ts"],
          docFiles: ["docs/notes.md"],
          trackedFiles: ["README.md", "package.json", "src/server.ts"]
        }
      });
      const structuredContent = response.structuredContent as Record<string, unknown>;

      assert.equal(response.content[0]?.type, "text");
      assert.ok(structuredContent);
      assert.equal(response.content[0]?.text, JSON.stringify(structuredContent));
      assert.deepEqual(structuredContent, directResult);
      assert.deepEqual(Object.keys(structuredContent).sort(), ["digest", "inputsUsed"]);
      assert.ok(Array.isArray(structuredContent.digest));
      assert.equal((structuredContent.digest as unknown[])?.length, 7);
      assert.ok(
        (structuredContent.digest as Array<{ artifact?: string }>).every((section) =>
          String(section.artifact ?? "").startsWith(".blueprint/codebase/")
        )
      );
      assert.deepEqual(
        (structuredContent.digest as Array<{ artifact?: string }>).map((section) => section.artifact),
        [
          ".blueprint/codebase/STACK.md",
          ".blueprint/codebase/ARCHITECTURE.md",
          ".blueprint/codebase/STRUCTURE.md",
          ".blueprint/codebase/CONVENTIONS.md",
          ".blueprint/codebase/TESTING.md",
          ".blueprint/codebase/INTEGRATIONS.md",
          ".blueprint/codebase/CONCERNS.md"
        ]
      );
      assert.ok(
        (structuredContent.digest as Array<{ summary?: string }>).every(
          (section) => typeof section.summary === "string" && section.summary.length > 0
        )
      );
      assert.deepEqual(structuredContent.inputsUsed, [
        "docs/notes.md",
        "package.json",
        "README.md",
        "src/server.ts",
        "tests/server.test.ts"
      ]);
    } finally {
      await Promise.all([client.close(), server.close()]);
    }
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("phase plan read live MCP response mirrors structuredContent and keeps the saved plan payload fields intact", async () => {
  const repoPath = await createPhasePlanWriteRepo();

  try {
    const planContent = validPhasePlanWriteContent("01");
    await blueprintPhasePlanWrite({
      cwd: repoPath,
      phase: "3",
      content: planContent,
      overwrite: true
    });

    const directResult = await blueprintToolRegistry.blueprint_phase_plan_read.handler({
      cwd: repoPath,
      phase: "3",
      planId: "01"
    });
    const server = createBlueprintServer();
    const client = new Client(
      { name: "blueprint-phase-plan-read-public-test-client", version: "1.0.0" },
      { capabilities: {} }
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    try {
      const response = await client.callTool({
        name: "blueprint_phase_plan_read",
        arguments: {
          cwd: repoPath,
          phase: "3",
          planId: "01"
        }
      });
      const structuredContent = response.structuredContent as Record<string, unknown>;

      assert.equal(response.content[0]?.type, "text");
      assert.ok(structuredContent);
      assert.equal(response.content[0]?.text, JSON.stringify(structuredContent));
      assert.deepEqual(structuredContent, directResult);
      assert.deepEqual(Object.keys(structuredContent).sort(), [
        "content",
        "found",
        "metadata",
        "path",
        "phaseDir",
        "phaseFound",
        "phaseName",
        "phaseNumber",
        "phasePrefix",
        "planId",
        "reason",
        "validation"
      ]);
      assert.equal(structuredContent.phaseFound, true);
      assert.equal(structuredContent.found, true);
      assert.equal(structuredContent.planId, "01");
      assert.equal(
        structuredContent.path,
        ".blueprint/phases/03-phase-discovery/03-01-PLAN.md"
      );
      assert.equal(structuredContent.content, directResult.content);
      assert.match(
        String(structuredContent.content),
        /^---\nphase: 3[\s\S]*# Phase 03: Phase Discovery - Plan 01/m
      );
      assert.deepEqual(
        Object.keys((structuredContent.metadata as Record<string, unknown>) ?? {}).sort(),
        [
          "acceptanceCriteria",
          "autonomous",
          "dependsOn",
          "filesModified",
          "gapClosure",
          "objective",
          "readFirst",
          "requirements",
          "status",
          "title",
          "wave"
        ]
      );
      assert.equal((structuredContent.metadata as { title?: string }).title, "Plan 01");
      assert.equal((structuredContent.metadata as { wave?: number }).wave, 1);
      assert.deepEqual(
        (structuredContent.metadata as { requirements?: string[] }).requirements,
        ["LIFE-01"]
      );
      assert.deepEqual(
        Object.keys((structuredContent.validation as Record<string, unknown>) ?? {}).sort(),
        ["issues", "valid", "warnings"]
      );
      assert.equal((structuredContent.validation as { valid?: boolean }).valid, true);
      assert.deepEqual((structuredContent.validation as { issues?: unknown[] }).issues, []);
      assert.deepEqual((structuredContent.validation as { warnings?: unknown[] }).warnings, []);
    } finally {
      await Promise.all([client.close(), server.close()]);
    }
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("artifact list live MCP response omits empty top-level warnings while direct handler keeps the full tool contract", async () => {
  const directRepoPath = await createProjectInitRepo();
  const repoPath = await createProjectInitRepo();

  try {
    await initializeProjectInitRepo(directRepoPath);
    await initializeProjectInitRepo(repoPath);

    const directResult = await blueprintToolRegistry.blueprint_artifact_list.handler({
      cwd: directRepoPath
    });
    const server = createBlueprintServer();
    const client = new Client(
      { name: "blueprint-artifact-list-public-trim-test-client", version: "1.0.0" },
      { capabilities: {} }
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    try {
      assert.deepEqual(directResult.warnings, []);
      assert.ok("warnings" in directResult);

      const response = await client.callTool({
        name: "blueprint_artifact_list",
        arguments: {
          cwd: repoPath
        }
      });
      const structuredContent = response.structuredContent as Record<string, unknown>;

      assert.equal(response.content[0]?.type, "text");
      assert.ok(structuredContent);
      assert.equal(response.content[0]?.text, JSON.stringify(structuredContent));
      assert.deepEqual(structuredContent.artifacts, directResult.artifacts);
      assert.deepEqual(structuredContent.reports, directResult.reports);
      assert.deepEqual(structuredContent.missing, directResult.missing);
      assert.ok(!("warnings" in structuredContent));
      assert.doesNotMatch(response.content[0]?.text ?? "", /"warnings":/);
    } finally {
      await Promise.all([client.close(), server.close()]);
    }
  } finally {
    await rm(directRepoPath, { recursive: true, force: true });
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("phase summary index live MCP response omits empty top-level warnings while direct handler keeps the full tool contract", async () => {
  const directRepoPath = await createPhasePlanWriteRepo();
  const repoPath = await createPhasePlanWriteRepo();

  try {
    await blueprintPhasePlanWrite({
      cwd: directRepoPath,
      phase: "3",
      content: validPhasePlanWriteContent("03-01"),
      overwrite: true
    });
    await blueprintPhasePlanWrite({
      cwd: repoPath,
      phase: "3",
      content: validPhasePlanWriteContent("03-01"),
      overwrite: true
    });

    const directResult = await blueprintToolRegistry.blueprint_phase_summary_index.handler({
      cwd: directRepoPath,
      phase: "3"
    });
    const server = createBlueprintServer();
    const client = new Client(
      { name: "blueprint-phase-summary-index-public-trim-test-client", version: "1.0.0" },
      { capabilities: {} }
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    try {
      assert.deepEqual(directResult.warnings, []);
      assert.ok("warnings" in directResult);

      const response = await client.callTool({
        name: "blueprint_phase_summary_index",
        arguments: {
          cwd: repoPath,
          phase: "3"
        }
      });
      const structuredContent = response.structuredContent as Record<string, unknown>;

      assert.equal(response.content[0]?.type, "text");
      assert.ok(structuredContent);
      assert.equal(response.content[0]?.text, JSON.stringify(structuredContent));
      assert.equal(structuredContent.phaseFound, true);
      assert.equal(structuredContent.phaseNumber, "3");
      assert.deepEqual(structuredContent.summaries, directResult.summaries);
      assert.deepEqual(structuredContent.completedPlans, directResult.completedPlans);
      assert.deepEqual(structuredContent.pendingPlans, directResult.pendingPlans);
      assert.ok(!("warnings" in structuredContent));
      assert.doesNotMatch(response.content[0]?.text ?? "", /"warnings":/);
    } finally {
      await Promise.all([client.close(), server.close()]);
    }
  } finally {
    await rm(directRepoPath, { recursive: true, force: true });
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("phase context live MCP response trims duplicated nested codebase warnings only at the public boundary", async () => {
  const repoPath = await createPhaseContextTrimRepo();
  const directResult = await blueprintToolRegistry["blueprint_phase_context"].handler({
    cwd: repoPath
  });
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-phase-context-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    assert.deepEqual(directResult.codebase?.warnings, [
      "Mapped codebase summaries are available and should be reused before rereading broad repo surfaces."
    ]);
    assert.deepEqual(directResult.warnings, [
      "Research quality will be limited until XX-CONTEXT.md exists.",
      "Mapped codebase summaries are available and should be reused before rereading broad repo surfaces."
    ]);

    const response = await client.callTool({
      name: "blueprint_phase_context",
      arguments: {
        cwd: repoPath
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.deepEqual(response.structuredContent.warnings, directResult.warnings);
    assert.ok(!("warnings" in (response.structuredContent.codebase ?? {})));
    assert.deepEqual(directResult.codebase?.warnings, [
      "Mapped codebase summaries are available and should be reused before rereading broad repo surfaces."
    ]);
  } finally {
    await Promise.all([client.close(), server.close()]);
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("phase validation render live MCP response trims duplicated nested validation warnings only at the public boundary", async () => {
  const originalHandler = blueprintToolRegistry["blueprint_phase_validation_render"].handler;
  const directResult = {
    phaseFound: true,
    phaseNumber: "3",
    phasePrefix: "03",
    phaseName: "Validation Engine",
    phaseDir: ".blueprint/phases/03-validation-engine",
    artifact: "verification",
    path: ".blueprint/phases/03-validation-engine/03-VERIFICATION.md",
    content: "# Phase 03: Validation Engine - Verification\n",
    validation: {
      valid: true,
      issues: [],
      warnings: ["Referenced summary filename was used instead of the repo-relative path."]
    },
    summaryPaths: [".blueprint/phases/03-validation-engine/03-01-SUMMARY.md"],
    referencedSummaryPaths: ["03-01-SUMMARY.md"],
    prerequisiteBlockers: [],
    readyToWrite: true,
    issues: [],
    warnings: [
      "Summary evidence is ready for render.",
      "Referenced summary filename was used instead of the repo-relative path."
    ]
  };

  blueprintToolRegistry["blueprint_phase_validation_render"].handler = async () => directResult;

  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-phase-validation-render-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const directHandlerResult =
      await blueprintToolRegistry["blueprint_phase_validation_render"].handler({
        artifact: "verification"
      });

    assert.deepEqual(directHandlerResult.validation?.warnings, [
      "Referenced summary filename was used instead of the repo-relative path."
    ]);

    const response = await client.callTool({
      name: "blueprint_phase_validation_render",
      arguments: {
        artifact: "verification"
      }
    });

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.deepEqual(response.structuredContent.warnings, directResult.warnings);
    assert.ok(!("warnings" in (response.structuredContent.validation ?? {})));
    assert.doesNotMatch(response.content[0]?.text ?? "", /"validation":\{"valid":true,"issues":\[\],"warnings":/);
    assert.deepEqual(directHandlerResult.validation?.warnings, [
      "Referenced summary filename was used instead of the repo-relative path."
    ]);
  } finally {
    blueprintToolRegistry["blueprint_phase_validation_render"].handler = originalHandler;
    await Promise.all([client.close(), server.close()]);
  }
});

test("public update check live MCP response preserves non-empty warnings while trimming extension manifest path and keeping update fields", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-update-check-public-"));
  const extensionPath = await createInstalledExtensionFixture(tempRoot);
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-update-check-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await withEnvOverrides(
    {
      BLUEPRINT_HOST: "gemini",
      BLUEPRINT_EXTENSION_PATH: extensionPath
    },
    async () => {
      await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    }
  );

  try {
    const response = await withEnvOverrides(
      {
        BLUEPRINT_HOST: "gemini",
        BLUEPRINT_EXTENSION_PATH: extensionPath
      },
      async () =>
        client.callTool({
          name: "blueprint_update_check",
          arguments: {
            cwd: tempRoot
          }
        })
    );

    assert.equal(response.content[0]?.type, "text");
    assert.ok(response.structuredContent);
    assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
    assert.ok(!("extensionManifestPath" in response.structuredContent));
    assert.equal(response.structuredContent.extensionPath, extensionPath);
    assert.equal(response.structuredContent.installedVersion, "0.1.0");
    assert.deepEqual(response.structuredContent.installProvenance, {
      kind: "extension-path-only",
      branch: null,
      head: null
    });
    assert.equal(response.structuredContent.latestVersionLookupStatus, "manual_only");
    assert.equal(response.structuredContent.updateAvailable, null);

    const publicResult = JSON.parse(response.content[0]?.text ?? "{}");

    assert.ok(!("extensionManifestPath" in publicResult));
    assert.equal(publicResult.extensionPath, extensionPath);
    assert.equal(publicResult.installedVersion, "0.1.0");
    assert.deepEqual(publicResult.installProvenance, {
      kind: "extension-path-only",
      branch: null,
      head: null
    });
    assert.equal(publicResult.latestVersionLookupStatus, "manual_only");
    assert.equal(publicResult.updateAvailable, null);
    assert.ok(Array.isArray(response.structuredContent.warnings));
    assert.ok((response.structuredContent.warnings?.length ?? 0) > 0);
    assert.match(response.content[0]?.text ?? "", /"warnings":\[/);
    assert.doesNotMatch(response.content[0]?.text ?? "", /"source":/);
  } finally {
    await Promise.all([client.close(), server.close()]);
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("public update check live MCP response omits empty top-level warnings while preserving update fields", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-update-check-public-empty-warnings-"));
  const extensionPath = await createInstalledExtensionFixture(tempRoot);
  const gitShimDir = await createGitShim(tempRoot);
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-update-check-public-empty-warnings-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await withEnvOverrides(
    {
      BLUEPRINT_HOST: "gemini",
      BLUEPRINT_EXTENSION_PATH: extensionPath,
      PATH: `${gitShimDir}${path.delimiter}${process.env.PATH ?? ""}`
    },
    async () => {
      await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    }
  );

  try {
    await withMockFetch(
      async () =>
        new Response(
          JSON.stringify({
            version: "0.1.1"
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        ),
      async () => {
        const response = await withEnvOverrides(
          {
            BLUEPRINT_HOST: "gemini",
            BLUEPRINT_EXTENSION_PATH: extensionPath,
            PATH: `${gitShimDir}${path.delimiter}${process.env.PATH ?? ""}`
          },
          async () =>
            client.callTool({
              name: "blueprint_update_check",
              arguments: {
                cwd: tempRoot
              }
            })
        );

        assert.equal(response.content[0]?.type, "text");
        assert.ok(response.structuredContent);
        assert.equal(response.content[0]?.text, JSON.stringify(response.structuredContent));
        assert.ok(!("warnings" in response.structuredContent));
        assert.ok(!("extensionManifestPath" in response.structuredContent));
        assert.equal(response.structuredContent.extensionPath, extensionPath);
        assert.equal(response.structuredContent.installedVersion, "0.1.0");
        assert.equal(response.structuredContent.latestVersionLookupStatus, "available");
        assert.equal(response.structuredContent.latestVersion, "0.1.1");
        assert.equal(response.structuredContent.updateAvailable, true);

        const publicResult = JSON.parse(response.content[0]?.text ?? "{}");

        assert.ok(!("warnings" in publicResult));
        assert.ok(!("extensionManifestPath" in publicResult));
        assert.equal(publicResult.extensionPath, extensionPath);
        assert.equal(publicResult.installedVersion, "0.1.0");
        assert.deepEqual(publicResult.installProvenance, {
          kind: "github-remote",
          source: "https://github.com/example/blueprint.git",
          branch: "main",
          head: "abc123"
        });
        assert.equal(publicResult.latestVersionLookupStatus, "available");
        assert.equal(publicResult.latestVersion, "0.1.1");
        assert.equal(publicResult.updateAvailable, true);
        assert.doesNotMatch(response.content[0]?.text ?? "", /"warnings":/);
      }
    );
  } finally {
    await Promise.all([client.close(), server.close()]);
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("server exposes read-only command resources without changing tool summaries", async () => {
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-resource-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const expectedRuntimeContractUris = (
    await listBlueprintCommandRuntimeContractCommands()
  ).map((command) => `blueprint://commands/${encodeURIComponent(command)}/runtime-contract`);

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const [resources, templates, catalogRead] = await Promise.all([
      client.listResources(),
      client.listResourceTemplates(),
      client.readResource({ uri: BLUEPRINT_COMMAND_CATALOG_RESOURCE_URI })
    ]);

    assert.ok(
      resources.resources.some((resource) => resource.uri === BLUEPRINT_COMMAND_CATALOG_RESOURCE_URI)
    );
    assert.ok(
      templates.resourceTemplates.some(
        (resourceTemplate) =>
          resourceTemplate.uriTemplate === BLUEPRINT_COMMAND_RUNTIME_CONTRACT_URI_TEMPLATE
      )
    );
    const runtimeContractTemplate = templates.resourceTemplates.find(
      (resourceTemplate) =>
        resourceTemplate.uriTemplate === BLUEPRINT_COMMAND_RUNTIME_CONTRACT_URI_TEMPLATE
    );
    const helpRuntimeContractResource = resources.resources.find(
      (resource) => resource.uri === "blueprint://commands/help/runtime-contract"
    );

    assert.match(
      runtimeContractTemplate?.description ?? "",
      /implemented Blueprint command/i
    );
    assert.doesNotMatch(
      runtimeContractTemplate?.description ?? "",
      /review.*excluded|excluded.*review/i
    );
    assert.match(
      helpRuntimeContractResource?.description ?? "",
      /implemented Blueprint command/i
    );
    assert.doesNotMatch(
      helpRuntimeContractResource?.description ?? "",
      /review.*excluded|excluded.*review/i
    );

    const runtimeContractResources = resources.resources
      .map((resource) => resource.uri)
      .filter((uri) => uri.startsWith("blueprint://commands/") && uri.endsWith("/runtime-contract"))
      .sort();

    assert.deepEqual(
      [...runtimeContractResources].sort((left, right) => left.localeCompare(right)),
      [...expectedRuntimeContractUris].sort((left, right) => left.localeCompare(right))
    );
    assert.ok(runtimeContractResources.includes("blueprint://commands/help/runtime-contract"));
    assert.ok(runtimeContractResources.includes("blueprint://commands/review/runtime-contract"));
    assert.ok(!runtimeContractResources.includes("blueprint://commands/do/runtime-contract"));

    const catalogPayload = JSON.parse(catalogRead.contents[0].text);
    assert.equal(catalogPayload.commands.help.status, "implemented");
    assert.equal(catalogPayload.commands.help.implemented, true);

    const helpContractRead = await client.readResource({
      uri: "blueprint://commands/help/runtime-contract"
    });
    const helpContractPayload = JSON.parse(helpContractRead.contents[0].text);

    assert.equal(helpContractPayload.command, "help");
    assert.equal(helpContractPayload.catalog.status, "implemented");
    assert.equal(helpContractPayload.catalog.implemented, true);

    await assert.rejects(
      client.readResource({ uri: "blueprint://commands/do/runtime-contract" }),
      /Blueprint runtime-contract resources are available only for implemented commands: do/
    );

    const contractReads = await Promise.all(
      runtimeContractResources.map((uri) => client.readResource({ uri }))
    );

    for (const contractRead of contractReads) {
      const contractPayload = JSON.parse(contractRead.contents[0].text);

      assert.equal(
        contractPayload.uri,
        `blueprint://commands/${encodeURIComponent(contractPayload.command)}/runtime-contract`
      );
      assert.equal(contractPayload.catalog.status, "implemented");
      assert.equal(contractPayload.catalog.implemented, true);
      assert.ok(contractPayload.spec);
      assert.equal(contractPayload.spec.path, contractPayload.catalog.specPath);
      assert.ok(contractPayload.runtimeReference);
      assert.equal(contractPayload.runtimeReference.command, contractPayload.command);
      assert.equal(
        contractPayload.runtimeReference.commandSpecPath,
        contractPayload.catalog.specPath
      );
      if (contractPayload.command === "new-project") {
        assert.equal(contractPayload.runtimeReference.path, NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID);
        assert.deepEqual(contractPayload.runtimeReference.evidenceState, [
          "locked",
          "runtime-owned",
          "needs-behavior-audit"
        ]);
      }
    }
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
});
