import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  blueprintPhasePlanRead,
  blueprintPhasePlanValidate,
  blueprintPhasePlanValidateModel,
  blueprintPhasePlanWrite
} from "../src/mcp/tools/phase.js";
import { blueprintProjectStatus } from "../src/mcp/tools/project.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function createPhaseRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-plan-hardening-");

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Fixture

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 3: Phase Discovery** - Harden plan validation

## Phase Details

### Phase 3: Phase Discovery
**Goal**: Harden plan validation.
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
- Next action: Run /blu-plan-phase 3
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

- Planning validation should reject scaffold-only plans.
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-RESEARCH.md"),
    `# Phase 03: Phase Discovery - Research

**Researched:** 2026-04-11
**Domain:** plan validation hardening
**Confidence:** HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIFE-01 | Harden plan validation. | Plan writes should reject path misuse, placeholder subsections, and non-objective checks. |

## Summary

- Planning should stay execution-ready and objectively checkable.

## Locked Decisions From Context

- Plan writes should only accept concrete repo-relative paths and checkable acceptance criteria.

## User Constraints

- Keep writes inside .blueprint/.

## Standard Stack

- TypeScript

## Installation And Setup

- Run the plan validation tests after seeding the phase fixture.

## Alternatives Considered

- Accepting scaffold-only plan text was rejected because it weakens the contract.

## Architecture Patterns

- Commands stay thin; MCP tools own persistence.

## Don't Hand-Roll

- Reuse the plan write validator instead of custom file edits.

## Anti-Patterns

- Leaving paths absolute or dependencies incoherent.

## State Of The Art

- Plan writes should reject content that cannot be verified from the artifact itself.

## Common Pitfalls

- Treating vague plan text as execution-ready.

## Open Questions

- Should later waves require more explicit dependency metadata?

## Confidence Breakdown

| Topic | Confidence | Why |
|-------|------------|-----|
| Validation hardening | HIGH | The fixture can exercise the live write path directly. |

## Code Examples

\`\`\`ts
await blueprintPhasePlanWrite({ cwd: repoPath, phase: "3", content, overwrite: true });
\`\`\`

## Recommendations

- Keep plan validation strict enough to reject weak planning artifacts.

## Sources

- \`src/mcp/tools/artifacts.ts\` - plan validation lives here.
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

function validPlanContent(planId: string, wave: number): string {
  return `---
phase: 3
plan_id: "${planId}"
title: "Plan ${planId}"
wave: ${wave}
status: planned
objective: "Harden plan validation."
depends_on: []
requirements:
  - LIFE-01
files_modified:
  - src/mcp/tools/artifacts.ts
read_first:
  - src/mcp/tools/artifacts.ts
acceptance_criteria:
  - tests/phase-plan-validation-hardening.test.ts exits 0
autonomous: true
---

# Phase 03: Phase Discovery - Plan ${planId}

## Goal

Harden plan validation.

## Scope

- Tighten plan write checks without changing the contract shape.

## Requirement Coverage

| Requirement | Status | Covered By | Evidence |
|-------------|--------|------------|----------|
| LIFE-01 | covered | Task 1 | src/mcp/tools/artifacts.ts |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| .blueprint/phases/03-phase-discovery/03-CONTEXT.md | used | Captures the validation hardening decision. |
| .blueprint/phases/03-phase-discovery/03-RESEARCH.md | used | Supplies the validation hardening evidence. |

## File / Surface Coverage

| File / Surface | Covered By | Verification |
|----------------|------------|--------------|
| src/mcp/tools/artifacts.ts | Task 1 | tests/phase-plan-validation-hardening.test.ts exits 0 |

## Unknowns And Deferrals

| Item | Disposition | Follow-up |
|------|-------------|-----------|
| No open validation-hardening unknowns remain. | none | Keep focused validation tests green. |

## Tasks

### Task 1: Strengthen plan validation

#### Read First

- src/mcp/tools/artifacts.ts

#### Action

- Tighten the plan write validator around repo-relative paths, concrete task content, and checkable acceptance criteria.

#### Acceptance Criteria

- src/mcp/tools/artifacts.ts contains validatePlanArtifactContent and the new checks pass under a strict write.

## Verification

- tests/phase-plan-validation-hardening.test.ts exits 0

## Must Haves

- Keep the existing required headings and frontmatter contract intact.
`;
}

function planWithPathViolations(): string {
  return `---
phase: 3
plan_id: "01"
title: "Path Violations"
wave: 2
status: planned
objective: "Harden plan validation."
depends_on: []
requirements:
  - LIFE-01
files_modified:
  - /tmp/blueprint.ts
read_first:
  - ../src/mcp/tools/artifacts.ts
acceptance_criteria:
  - tests/phase-plan-validation-hardening.test.ts exits 0
autonomous: true
---

# Phase 03: Phase Discovery - Plan 01

## Goal

Harden plan validation.

## Scope

- Reject non-repo-relative paths.

## Requirement Coverage

| Requirement | Status | Covered By | Evidence |
|-------------|--------|------------|----------|
| LIFE-01 | covered | Task 1 | src/mcp/tools/artifacts.ts |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| .blueprint/phases/03-phase-discovery/03-CONTEXT.md | used | Captures the validation hardening decision. |
| .blueprint/phases/03-phase-discovery/03-RESEARCH.md | used | Supplies the validation hardening evidence. |

## File / Surface Coverage

| File / Surface | Covered By | Verification |
|----------------|------------|--------------|
| src/mcp/tools/artifacts.ts | Task 1 | tests/phase-plan-validation-hardening.test.ts exits 0 |

## Unknowns And Deferrals

| Item | Disposition | Follow-up |
|------|-------------|-----------|
| Path violation remains intentional for this invalid fixture. | open | Replace outside-repo paths before strict persistence. |

## Tasks

### Task 1: Check path handling

#### Read First

- ../src/mcp/tools/artifacts.ts

#### Action

- Reject absolute and traversing paths.

#### Acceptance Criteria

- src/mcp/tools/artifacts.ts contains validatePlanArtifactContent.

## Verification

- tests/phase-plan-validation-hardening.test.ts exits 0

## Must Haves

- Keep the contract strict.
`;
}

function planWithTaskPathViolations(): string {
  return `---
phase: 3
plan_id: "06"
title: "Task Path Violations"
wave: 2
status: planned
objective: "Harden plan validation."
depends_on: []
requirements:
  - LIFE-01
files_modified:
  - src/mcp/tools/artifacts.ts
read_first:
  - src/mcp/tools/artifacts.ts
acceptance_criteria:
  - tests/phase-plan-validation-hardening.test.ts exits 0
autonomous: true
---

# Phase 03: Phase Discovery - Plan 06

## Goal

Harden plan validation.

## Scope

- Reject obvious outside-repo task file references.

## Requirement Coverage

| Requirement | Status | Covered By | Evidence |
|-------------|--------|------------|----------|
| LIFE-01 | covered | Task 1 | src/mcp/tools/artifacts.ts |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| .blueprint/phases/03-phase-discovery/03-CONTEXT.md | used | Captures the validation hardening decision. |
| .blueprint/phases/03-phase-discovery/03-RESEARCH.md | used | Supplies the validation hardening evidence. |

## File / Surface Coverage

| File / Surface | Covered By | Verification |
|----------------|------------|--------------|
| src/mcp/tools/artifacts.ts | Task 1 | tests/phase-plan-validation-hardening.test.ts exits 0 |

## Unknowns And Deferrals

| Item | Disposition | Follow-up |
|------|-------------|-----------|
| Task path violation remains intentional for this invalid fixture. | open | Replace task path escapes before strict persistence. |

## Tasks

### Task 1: Reject task file escapes

#### Read First

- ../src/mcp/tools/artifacts.ts

#### Action

- Inspect /tmp/blueprint.ts before updating the validator.

#### Acceptance Criteria

- src/mcp/tools/artifacts.ts contains validatePlanArtifactContent.

## Verification

- tests/phase-plan-validation-hardening.test.ts exits 0

## Must Haves

- Keep task file references repo-relative.
`;
}

function planWithConcretePlaceholderTaskHeading(): string {
  return validPlanContent("12", 2).replace(
    "### Task 1: Strengthen plan validation",
    "### Task 1: Create the six placeholder classes for project package skeleton"
  );
}

function planWithConcreteReplaceWithAction(): string {
  return validPlanContent("13", 2).replace(
    "- Tighten the plan write validator around repo-relative paths, concrete task content, and checkable acceptance criteria.",
    "- Use the package codemod to replace with ProjectPackageSkeleton when imports resolve."
  );
}

function planWithCommandMentionsInTaskText(): string {
  return `---
phase: 3
plan_id: "07"
title: "Command Mentions"
wave: 2
status: planned
objective: "Harden plan validation."
depends_on: []
requirements:
  - LIFE-01
files_modified:
  - src/mcp/tools/artifacts.ts
read_first:
  - src/mcp/tools/artifacts.ts
acceptance_criteria:
  - tests/phase-plan-validation-hardening.test.ts exits 0
autonomous: true
---

# Phase 03: Phase Discovery - Plan 07

## Goal

Harden plan validation.

## Scope

- Keep command mentions textual inside task guidance.

## Requirement Coverage

| Requirement | Status | Covered By | Evidence |
|-------------|--------|------------|----------|
| LIFE-01 | covered | Task 1 | src/mcp/tools/artifacts.ts |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| .blueprint/phases/03-phase-discovery/03-CONTEXT.md | used | Captures the validation hardening decision. |
| .blueprint/phases/03-phase-discovery/03-RESEARCH.md | used | Supplies the validation hardening evidence. |

## File / Surface Coverage

| File / Surface | Covered By | Verification |
|----------------|------------|--------------|
| src/mcp/tools/artifacts.ts | Task 1 | tests/phase-plan-validation-hardening.test.ts exits 0 |

## Unknowns And Deferrals

| Item | Disposition | Follow-up |
|------|-------------|-----------|
| No open command-mention unknowns remain. | none | Keep /blu-progress as prose, not a path. |

## Tasks

### Task 1: Confirm command mentions stay valid

#### Read First

- src/mcp/tools/artifacts.ts

#### Action

- Run /blu-progress before tightening the validator.

#### Acceptance Criteria

- src/mcp/tools/artifacts.ts contains validatePlanArtifactContent.

## Verification

- tests/phase-plan-validation-hardening.test.ts exits 0

## Must Haves

- Keep /blu-progress available as a command mention, not a filesystem path.
`;
}

function planWithWeakTaskAndAcceptanceCriteria(): string {
  return `---
phase: 3
plan_id: "02"
title: "Weak Task Content"
wave: 2
status: planned
objective: "Harden plan validation."
depends_on: []
requirements:
  - LIFE-01
files_modified:
  - src/mcp/tools/artifacts.ts
read_first:
  - src/mcp/tools/artifacts.ts
acceptance_criteria:
  - looks good to me
autonomous: true
---

# Phase 03: Phase Discovery - Plan 02

## Goal

Harden plan validation.

## Scope

- Keep the plan body honest.

## Requirement Coverage

| Requirement | Status | Covered By | Evidence |
|-------------|--------|------------|----------|
| LIFE-01 | covered | Task 1 | src/mcp/tools/artifacts.ts |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| .blueprint/phases/03-phase-discovery/03-CONTEXT.md | used | Captures the validation hardening decision. |
| .blueprint/phases/03-phase-discovery/03-RESEARCH.md | used | Supplies the validation hardening evidence. |

## File / Surface Coverage

| File / Surface | Covered By | Verification |
|----------------|------------|--------------|
| src/mcp/tools/artifacts.ts | Task 1 | tests/phase-plan-validation-hardening.test.ts exits 0 |

## Unknowns And Deferrals

| Item | Disposition | Follow-up |
|------|-------------|-----------|
| Weak task prose remains intentional for this invalid fixture. | open | Replace placeholder prose before strict persistence. |

## Tasks

### Task 1: Placeholder

#### Read First

- Replace with

#### Action

- Placeholder

#### Acceptance Criteria

- The result feels better.

## Verification

- tests/phase-plan-validation-hardening.test.ts exits 0

## Must Haves

- Replace with the goal-backward must-haves this plan cannot drop.
`;
}

function planWithMalformedDependsOn(planId: string): string {
  return `---
phase: 3
plan_id: "${planId}"
title: "Malformed Depends On"
wave: 2
status: planned
objective: "Harden plan validation."
depends_on:
  - bogus
requirements:
  - LIFE-01
files_modified:
  - src/mcp/tools/artifacts.ts
read_first:
  - src/mcp/tools/artifacts.ts
acceptance_criteria:
  - tests/phase-plan-validation-hardening.test.ts exits 0
autonomous: true
---

# Phase 03: Phase Discovery - Plan ${planId}

## Goal

Harden plan validation.

## Scope

- Keep malformed dependency metadata visible without blocking warn-mode writes.

## Requirement Coverage

| Requirement | Status | Covered By | Evidence |
|-------------|--------|------------|----------|
| LIFE-01 | covered | Task 1 | src/mcp/tools/artifacts.ts |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| .blueprint/phases/03-phase-discovery/03-CONTEXT.md | used | Captures the validation hardening decision. |
| .blueprint/phases/03-phase-discovery/03-RESEARCH.md | used | Supplies the validation hardening evidence. |

## File / Surface Coverage

| File / Surface | Covered By | Verification |
|----------------|------------|--------------|
| src/mcp/tools/artifacts.ts | Task 1 | tests/phase-plan-validation-hardening.test.ts exits 0 |

## Unknowns And Deferrals

| Item | Disposition | Follow-up |
|------|-------------|-----------|
| Malformed dependency remains intentional for warn-mode coverage. | open | Replace bogus depends_on values before strict persistence. |

## Tasks

### Task 1: Surface malformed depends_on in warn mode

#### Read First

- src/mcp/tools/artifacts.ts

#### Action

- Preserve the write path while surfacing dependency invalidity in validation output.

#### Acceptance Criteria

- src/mcp/tools/artifacts.ts contains validatePlanArtifactContent.

## Verification

- tests/phase-plan-validation-hardening.test.ts exits 0

## Must Haves

- Warn mode should keep the saved artifact and report the issue.
`;
}

function planWithWaveDependencyIncoherence(): string {
  return `---
phase: 3
plan_id: "03"
title: "Wave Dependency Incoherence"
wave: 1
status: planned
objective: "Harden plan validation."
depends_on:
  - 01
requirements:
  - LIFE-01
files_modified:
  - src/mcp/tools/artifacts.ts
read_first:
  - src/mcp/tools/artifacts.ts
acceptance_criteria:
  - tests/phase-plan-validation-hardening.test.ts exits 0
autonomous: true
---

# Phase 03: Phase Discovery - Plan 03

## Goal

Harden plan validation.

## Scope

- Keep the wave/dependency model coherent.

## Requirement Coverage

| Requirement | Status | Covered By | Evidence |
|-------------|--------|------------|----------|
| LIFE-01 | covered | Task 1 | src/mcp/tools/artifacts.ts |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| .blueprint/phases/03-phase-discovery/03-CONTEXT.md | used | Captures the validation hardening decision. |
| .blueprint/phases/03-phase-discovery/03-RESEARCH.md | used | Supplies the validation hardening evidence. |

## File / Surface Coverage

| File / Surface | Covered By | Verification |
|----------------|------------|--------------|
| src/mcp/tools/artifacts.ts | Task 1 | tests/phase-plan-validation-hardening.test.ts exits 0 |

## Unknowns And Deferrals

| Item | Disposition | Follow-up |
|------|-------------|-----------|
| Wave dependency incoherence remains intentional for this invalid fixture. | open | Move dependencies to a later coherent wave. |

## Tasks

### Task 1: Check wave coherence

#### Read First

- src/mcp/tools/artifacts.ts

#### Action

- Validate that wave 1 plans do not declare depends_on entries.

#### Acceptance Criteria

- src/mcp/tools/artifacts.ts contains validatePlanArtifactContent.

## Verification

- tests/phase-plan-validation-hardening.test.ts exits 0

## Must Haves

- Wave order must stay coherent within the artifact itself.
`;
}

function planWithGlobPathViolations(): string {
  return `---
phase: 3
plan_id: "04"
title: "Glob Path Violations"
wave: 2
status: planned
objective: "Harden plan validation."
depends_on: []
requirements:
  - LIFE-01
files_modified:
  - src/**/*.ts
read_first:
  - src/**/artifacts.ts
acceptance_criteria:
  - tests/phase-plan-validation-hardening.test.ts exits 0
autonomous: true
---

# Phase 03: Phase Discovery - Plan 04

## Goal

Harden plan validation.

## Scope

- Reject glob-style path entries.

## Requirement Coverage

| Requirement | Status | Covered By | Evidence |
|-------------|--------|------------|----------|
| LIFE-01 | covered | Task 1 | src/mcp/tools/artifacts.ts |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| .blueprint/phases/03-phase-discovery/03-CONTEXT.md | used | Captures the validation hardening decision. |
| .blueprint/phases/03-phase-discovery/03-RESEARCH.md | used | Supplies the validation hardening evidence. |

## File / Surface Coverage

| File / Surface | Covered By | Verification |
|----------------|------------|--------------|
| src/mcp/tools/artifacts.ts | Task 1 | tests/phase-plan-validation-hardening.test.ts exits 0 |

## Unknowns And Deferrals

| Item | Disposition | Follow-up |
|------|-------------|-----------|
| Glob path violation remains intentional for this invalid fixture. | open | Replace glob paths with concrete repo-relative paths. |

## Tasks

### Task 1: Check glob handling

#### Read First

- src/**/artifacts.ts

#### Action

- Reject wildcard path entries before they reach persistence.

#### Acceptance Criteria

- src/mcp/tools/artifacts.ts contains validatePlanArtifactContent.

## Verification

- tests/phase-plan-validation-hardening.test.ts exits 0

## Must Haves

- Keep the contract strict.
`;
}

function planWithRouteAndCodeExamples(): string {
  return `---
phase: 3
plan_id: "08"
title: "Route And Code Examples"
wave: 2
status: planned
objective: "Harden plan validation without blocking route examples."
depends_on: []
requirements:
  - LIFE-01
files_modified:
  - backend/src/.
read_first:
  - backend/.
  - ./pages/
acceptance_criteria:
  - H2 console at /h2-console shows tables INVOICE, VALIDATION_RULE, VALIDATION_RESULT.
autonomous: true
---

# Phase 03: Phase Discovery - Plan 08

## Goal

Harden plan validation without blocking route examples.

## Scope

- Keep repo path lists concrete while allowing endpoint and code examples in task prose.

## Requirement Coverage

| Requirement | Status | Covered By | Evidence |
|-------------|--------|------------|----------|
| LIFE-01 | covered | Task 1 | src/mcp/tools/artifacts.ts |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| .blueprint/phases/03-phase-discovery/03-CONTEXT.md | used | Captures the validation hardening decision. |
| .blueprint/phases/03-phase-discovery/03-RESEARCH.md | used | Supplies the validation hardening evidence. |

## File / Surface Coverage

| File / Surface | Covered By | Verification |
|----------------|------------|--------------|
| src/mcp/tools/artifacts.ts | Task 1 | tests/phase-plan-validation-hardening.test.ts exits 0 |

## Unknowns And Deferrals

| Item | Disposition | Follow-up |
|------|-------------|-----------|
| No open route-example unknowns remain. | none | Keep endpoint strings distinct from repo path lists. |

## Tasks

### Task 1: Preserve endpoint examples in action text

#### Read First

- backend/.
- ./pages/

#### Action

- Register route examples such as /api/invoices, /api/rules, and /api/results in the prose without treating them as repo paths.
- Keep \`registry.addMapping("/api/**").allowedOrigins("*").allowedMethods(...)\` examples available for CORS guidance.
- Run \`rg "Invoice" ./src/**/*.{ts,tsx}\` before finalizing the validator changes.
- MockMvc.perform(get("/api/invoices")).andExpect(status().isOk()) captures the expected integration behavior.

#### Acceptance Criteria

- H2 console at /h2-console shows tables INVOICE, VALIDATION_RULE, VALIDATION_RESULT.

## Verification

- tests/phase-plan-validation-hardening.test.ts exits 0

## Must Haves

- Keep endpoint strings and command globs distinct from repo path lists.
`;
}

function planWithMarkupExamples(): string {
  return `---
phase: 3
plan_id: "10"
title: "Markup Examples In Task Prose"
wave: 2
status: planned
objective: "Allow legitimate XML and template placeholders in task prose."
depends_on: []
requirements:
  - LIFE-01
files_modified:
  - pom.xml
  - src/mcp/tools/artifacts.ts
read_first:
  - pom.xml
  - src/mcp/tools/artifacts.ts
acceptance_criteria:
  - tests/phase-plan-validation-hardening.test.ts exits 0
autonomous: true
---

# Phase 03: Phase Discovery - Plan 10

## Goal

Allow legitimate XML and template placeholders in task prose.

## Scope

- Keep repo path lists concrete while allowing XML snippets in action guidance.

## Requirement Coverage

| Requirement | Status | Covered By | Evidence |
|-------------|--------|------------|----------|
| LIFE-01 | covered | Task 1 | src/mcp/tools/artifacts.ts |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| .blueprint/phases/03-phase-discovery/03-CONTEXT.md | used | Captures the validation hardening decision. |
| .blueprint/phases/03-phase-discovery/03-RESEARCH.md | used | Supplies the validation hardening evidence. |

## File / Surface Coverage

| File / Surface | Covered By | Verification |
|----------------|------------|--------------|
| src/mcp/tools/artifacts.ts | Task 1 | tests/phase-plan-validation-hardening.test.ts exits 0 |

## Unknowns And Deferrals

| Item | Disposition | Follow-up |
|------|-------------|-----------|
| none | none | none |

## Tasks

### Task 1: Preserve markup examples in action text

#### Read First

- pom.xml
- src/mcp/tools/artifacts.ts

#### Action

- Preserve the placeholder \`<release>\${java.version}</release>\` in the task prose without treating it as a repo path.
- Keep \`<pluginManagement>...</pluginManagement>\` examples available for Maven guidance.
- Document the closing tag \`</dependencyManagement>\` in the explanation for the XML change.

#### Acceptance Criteria

- tests/phase-plan-validation-hardening.test.ts exits 0

## Verification

- tests/phase-plan-validation-hardening.test.ts exits 0

## Must Haves

- Markup examples must not be misclassified as repo-relative paths.
`;
}

function validPlanModel() {
  return {
    title: "Plan 14",
    wave: 2,
    status: "planned",
    objective: "Harden plan validation.",
    dependsOn: [],
    requirements: ["LIFE-01"],
    filesModified: ["src/mcp/tools/artifacts.ts"],
    readFirst: ["src/mcp/tools/artifacts.ts"],
    autonomous: true,
    goal: "Harden plan validation.",
    scope: ["Tighten plan write checks without changing the contract shape."],
    tasks: [
      {
        id: "task-1",
        title: "Strengthen plan validation",
        readFirst: ["src/mcp/tools/artifacts.ts"],
        action: [
          "Tighten the plan write validator around repo-relative paths, concrete task content, and checkable acceptance criteria."
        ],
        acceptanceCriteria: ["tests/phase-plan-validation-hardening.test.ts exits 0"],
        requirements: ["LIFE-01"],
        filesModified: ["src/mcp/tools/artifacts.ts"]
      }
    ],
    verification: [
      {
        item: "Focused hardening test",
        method: "test",
        evidence: "tests/phase-plan-validation-hardening.test.ts exits 0"
      }
    ],
    mustHaves: ["Keep the existing required headings and frontmatter contract intact."],
    requirementCoverage: [
      {
        requirement: "LIFE-01",
        status: "covered",
        coveredByTasks: ["task-1"],
        evidence: "src/mcp/tools/artifacts.ts",
        rationale: "Task 1 covers the live validator path."
      }
    ],
    evidenceCoverage: [
      {
        artifact: ".blueprint/phases/03-phase-discovery/03-CONTEXT.md",
        status: "used",
        rationale: "Captures the validation hardening decision."
      },
      {
        artifact: ".blueprint/phases/03-phase-discovery/03-RESEARCH.md",
        status: "used",
        rationale: "Supplies the validation hardening evidence."
      },
      {
        artifact: ".blueprint/phases/03-phase-discovery/03-UI-SPEC.md",
        status: "used",
        rationale: "Records the explicit UI skip rationale."
      }
    ],
    fileSurfaceCoverage: [
      {
        surface: "src/mcp/tools/artifacts.ts",
        coveredByTasks: ["task-1"],
        verification: "tests/phase-plan-validation-hardening.test.ts exits 0",
        rationale: "This row proves the declared modified surface is owned and verifiable."
      }
    ],
    unknownsAndDeferrals: [
      {
        item: "No open validation-hardening unknowns remain.",
        disposition: "none",
        rationale: "The current slice is fully bounded.",
        followUp: "Keep focused validation tests green."
      }
    ]
  };
}

function planModelMissingExactCoverage() {
  return {
    ...validPlanModel(),
    requirementCoverage: [],
    evidenceCoverage: []
  };
}

function planModelWithDomainSpecificVerifiabilityText() {
  const model = validPlanModel();

  model.tasks[0].acceptanceCriteria = [
    "Demonstrate the phase-specific migration outcome for the admin packet."
  ];
  model.verification[0] = {
    item: "Admin packet verification narrative",
    method: "command",
    evidence: "Reviewer notes confirm the phase-specific migration outcome."
  };
  model.fileSurfaceCoverage[0].verification =
    "Inspect the admin packet change for the intended migration outcome.";

  return model;
}

test("phase plan model validation suppresses exact-coverage const fallout and adds staged notice", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintPhasePlanValidateModel({
    cwd: repoPath,
    phase: "3",
    planId: "14",
    model: planModelMissingExactCoverage()
  });

  assert.equal(result.status, "invalid");
  assert.equal(result.valid, false);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "schema.exactCoverage"));
  assert.ok(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "schema.deeper_checks_skipped" && diagnostic.severity === "warning"
    ),
    JSON.stringify(result.diagnostics, null, 2)
  );
  assert.equal(
    result.diagnostics.some((diagnostic) => diagnostic.code === "schema.const"),
    false,
    JSON.stringify(result.diagnostics, null, 2)
  );
});

test("phase plan model validation and writes treat weak verifiability heuristics as warnings", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const model = planModelWithDomainSpecificVerifiabilityText();
  const validation = await blueprintPhasePlanValidateModel({
    cwd: repoPath,
    phase: "3",
    planId: "14",
    model
  });

  assert.equal(validation.status, "valid", JSON.stringify(validation, null, 2));
  assert.equal(validation.valid, true, JSON.stringify(validation, null, 2));
  assert.ok(
    validation.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "coverage.unverifiable_acceptance_criterion" &&
        diagnostic.severity === "warning"
    ),
    JSON.stringify(validation.diagnostics, null, 2)
  );
  assert.ok(
    validation.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "coverage.unverifiable_file_surface" &&
        diagnostic.severity === "warning"
    ),
    JSON.stringify(validation.diagnostics, null, 2)
  );
  assert.ok(
    validation.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "coverage.unverifiable_verification_evidence" &&
        diagnostic.severity === "warning"
    ),
    JSON.stringify(validation.diagnostics, null, 2)
  );
  assert.ok(
    validation.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "markdown.verifiability_guidance" &&
        diagnostic.severity === "warning"
    ),
    JSON.stringify(validation.diagnostics, null, 2)
  );

  const writeResult = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "14",
    model,
    authoringMode: "model-only",
    overwrite: true
  });

  assert.equal(writeResult.status, "created", JSON.stringify(writeResult, null, 2));
  assert.equal(writeResult.written, true, JSON.stringify(writeResult, null, 2));
  assert.equal(writeResult.validation.valid, true, JSON.stringify(writeResult, null, 2));
  assert.equal(writeResult.modelValidation?.valid, true, JSON.stringify(writeResult, null, 2));
  assert.equal(writeResult.modelValidation?.repairSummary.blockingCount, 0);
  assert.match(
    writeResult.validation.warnings.join("\n"),
    /verifiability|objectively checkable|grep\/test-verifiable/i
  );

  const readResult = await blueprintPhasePlanRead({
    cwd: repoPath,
    phase: "3",
    planId: "14"
  });
  assert.equal(readResult.validation?.valid, true, JSON.stringify(readResult, null, 2));
  assert.match(
    readResult.validation?.warnings.join("\n") ?? "",
    /verifiability|objectively checkable|grep\/test-verifiable/i
  );

  const planSetValidation = await blueprintPhasePlanValidate({
    cwd: repoPath,
    phase: "3"
  });
  assert.equal(planSetValidation.status, "valid", JSON.stringify(planSetValidation, null, 2));
  assert.equal(planSetValidation.issues.length, 0, JSON.stringify(planSetValidation, null, 2));
  assert.match(
    planSetValidation.warnings.join("\n"),
    /verifiability|objectively checkable|grep\/test-verifiable/i
  );

  const projectStatus = await blueprintProjectStatus({ cwd: repoPath });
  assert.match(projectStatus.nextAction, /\/blu-execute-phase 3/);
});

test("strict plan writes reject absolute and traversing repo paths", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    content: planWithPathViolations(),
    overwrite: true
  });

  assert.equal(result.status, "invalid");
  assert.equal(result.written, false);
  assert.match(result.validation?.issues.join("\n") ?? "", /repo-relative path/i);
  assert.match(result.validation?.issues.join("\n") ?? "", /absolute or traversing path/i);
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-01-PLAN.md")),
    false
  );
});

test("strict plan writes reject absolute and traversing task file references", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "06",
    content: planWithTaskPathViolations(),
    overwrite: true
  });

  assert.equal(result.status, "invalid");
  assert.equal(result.written, false);
  assert.match(result.validation?.issues.join("\n") ?? "", /Task 1 subsection Read First/i);
  assert.match(result.validation?.issues.join("\n") ?? "", /Task 1 subsection Action/i);
  assert.match(result.validation?.issues.join("\n") ?? "", /absolute or traversing path/i);
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-06-PLAN.md")),
    false
  );
});

test("strict plan writes allow /blu command mentions in task text but still reject outside-repo paths", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const commandMentionResult = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "07",
    content: planWithCommandMentionsInTaskText(),
    overwrite: true
  });

  assert.equal(commandMentionResult.status, "created");
  assert.equal(commandMentionResult.written, true);
  assert.equal(commandMentionResult.validation?.valid, true);
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-07-PLAN.md")),
    true
  );

  const outsideRepoResult = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "06",
    content: planWithTaskPathViolations(),
    overwrite: true
  });

  assert.equal(outsideRepoResult.status, "invalid");
  assert.equal(outsideRepoResult.written, false);
  assert.match(outsideRepoResult.validation?.issues.join("\n") ?? "", /absolute or traversing path/i);
  assert.doesNotMatch(outsideRepoResult.validation?.issues.join("\n") ?? "", /\/blu-progress/);
});

test("strict plan writes reject weak task subsections and subjective acceptance criteria", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "02",
    content: planWithWeakTaskAndAcceptanceCriteria(),
    overwrite: true
  });

  assert.equal(result.status, "invalid");
  assert.equal(result.written, false);
  assert.match(result.validation?.issues.join("\n") ?? "", /concrete heading/i);
  assert.match(result.validation?.issues.join("\n") ?? "", /concrete content/i);
  assert.match(result.validation?.issues.join("\n") ?? "", /objectively checkable/i);
  assert.match(result.validation?.issues.join("\n") ?? "", /subjective language/i);
});

test("strict plan writes allow concrete task headings that mention placeholder work", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "12",
    content: planWithConcretePlaceholderTaskHeading(),
    overwrite: true
  });

  assert.equal(result.status, "created", JSON.stringify(result.validation, null, 2));
  assert.equal(result.validation?.valid, true, JSON.stringify(result.validation, null, 2));
});

test("strict plan writes allow replace-with phrasing inside concrete task prose", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "13",
    content: planWithConcreteReplaceWithAction(),
    overwrite: true
  });

  assert.equal(result.status, "created", JSON.stringify(result.validation, null, 2));
  assert.equal(result.validation?.valid, true, JSON.stringify(result.validation, null, 2));
});

test("warn-mode plan writes surface malformed depends_on without blocking the write path", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "05",
    content: planWithMalformedDependsOn("05"),
    overwrite: true,
    validationMode: "warn"
  });
  const written = await readFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-05-PLAN.md"),
    "utf8"
  );

  assert.equal(result.status, "created");
  assert.equal(result.written, true);
  assert.equal(result.validation?.valid, false);
  assert.match(result.validation?.issues.join("\n") ?? "", /depends_on entries must be numeric plan ids/i);
  assert.match(written, /plan_id: "05"/);
});

test("strict plan writes reject wave 1 plans that declare dependencies", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "03",
    content: planWithWaveDependencyIncoherence(),
    overwrite: true
  });

  assert.equal(result.status, "invalid");
  assert.equal(result.written, false);
  assert.equal(result.validation?.valid, false);
  assert.match(result.validation?.issues.join("\n") ?? "", /depends_on references missing plan "01"/);
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-03-PLAN.md")),
    false
  );
});

test("strict plan writes reject glob path entries", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "04",
    content: planWithGlobPathViolations(),
    overwrite: true
  });

  assert.equal(result.status, "invalid");
  assert.equal(result.written, false);
  assert.match(result.validation?.issues.join("\n") ?? "", /concrete repo-relative path/i);
  assert.match(result.validation?.issues.join("\n") ?? "", /glob pattern/i);
});

test("strict plan writes allow route examples, code snippets, command globs, and directory shorthand", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "08",
    content: planWithRouteAndCodeExamples(),
    overwrite: true
  });

  assert.equal(result.status, "created");
  assert.equal(result.written, true);
  assert.equal(result.validation?.valid, true);
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-08-PLAN.md")),
    true
  );
});

test("strict plan writes allow XML and template placeholders in task prose", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(path.join(repoPath, "pom.xml"), "<project />\n", "utf8");

  const result = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "10",
    content: planWithMarkupExamples(),
    overwrite: true
  });

  assert.equal(result.status, "created", JSON.stringify(result, null, 2));
  assert.equal(result.written, true);
  assert.equal(result.validation?.valid, true, JSON.stringify(result.validation, null, 2));
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-10-PLAN.md")),
    true
  );
});

test("phase plan writes normalize accidentally quoted numeric plan ids", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "\"09\"",
    content: validPlanContent("09", 2),
    overwrite: true
  });

  assert.equal(result.status, "created");
  assert.equal(result.written, true);
  assert.equal(result.planId, "09");
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-09-PLAN.md")),
    true
  );
});

test("strict plan writes still accept a concrete execution-ready plan", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "04",
    content: validPlanContent("04", 2),
    overwrite: true
  });

  assert.equal(result.status, "created");
  assert.equal(result.written, true);
  assert.equal(result.validation?.valid, true);
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-04-PLAN.md")),
    true
  );
});
