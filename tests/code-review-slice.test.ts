import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { promises as fs } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { Ajv2020 } from "ajv/dist/2020.js";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import {
  blueprintReviewLoadFindings,
  blueprintReviewRecord,
  blueprintReviewScope,
  blueprintReviewValidateModel
} from "../src/mcp/tools/review.js";
import { blueprintStateLoad } from "../src/mcp/tools/state.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

const repoRoot = process.cwd();
const execFileAsync = promisify(execFileCallback);

async function readSchemaFile(relativePath: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8")) as Record<string, unknown>;
}

function reviewResultMessages(result: {
  warnings?: string[];
  diagnostics?: Array<{ message: string }>;
}): string {
  return [
    ...(result.warnings ?? []),
    ...((result.diagnostics ?? []).map((diagnostic) => diagnostic.message))
  ].join("\n");
}

function isBundledPath(value: unknown, relativePath: string): boolean {
  if (value instanceof URL) {
    return value.pathname.endsWith(`/${relativePath}`);
  }

  return typeof value === "string" && value.endsWith(relativePath);
}

function makeBundledDocsUnavailable(t: TestContext): void {
  const unavailableDocs = [
    "docs/COMMAND-CATALOG.md",
    "docs/RUNTIME-REFERENCE.md",
    "docs/commands/code-review.md"
  ];
  const originalReadFile = fs.readFile;

  fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
    if (unavailableDocs.some((relativePath) => isBundledPath(args[0], relativePath))) {
      const error = new Error("ENOENT");
      (error as NodeJS.ErrnoException).code = "ENOENT";
      throw error;
    }

    return originalReadFile(...args);
  }) as typeof fs.readFile;

  t.after(() => {
    fs.readFile = originalReadFile;
  });
}

type CodeReviewRepoOptions = {
  withPlan?: boolean;
  withSummary?: boolean;
  planFilesModified?: string[];
  summaryChangedFiles?: string[];
  configPatch?: Record<string, unknown>;
};

function completedSummaryContent(): string {
  return `# Phase 05: Code Review Scope - Summary 01

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
`;
}

async function createCodeReviewRepo(
  options: CodeReviewRepoOptions = {}
): Promise<string> {
  const {
    withPlan = true,
    withSummary = true,
    planFilesModified = [
      "src/feature.ts",
      "tests/feature.test.ts",
      ".blueprint/phases/05-review-scope/05-REVIEW.md"
    ],
    summaryChangedFiles = [],
    configPatch = {}
  } = options;
  const repoPath = await createGitRepo("blueprint-code-review-");
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
    `${JSON.stringify({ version: 2, ...configPatch }, null, 2)}\n`,
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

  for (const candidateFile of new Set([...summaryChangedFiles, ...planFilesModified])) {
    if (candidateFile.startsWith(".blueprint/")) {
      continue;
    }

    const absolutePath = path.join(repoPath, candidateFile);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, `export const ${path.basename(candidateFile, path.extname(candidateFile)).replace(/[^a-zA-Z0-9_]/g, "_")} = true;\n`, "utf8");
  }

  if (withPlan) {
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
${planFilesModified.map((file) => `  - ${file}`).join("\n")}
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
${planFilesModified.map((file) => `| ${file} | task-1 | rg "calculateValue" src/feature.ts | The code-review scope fixture includes this declared file. |`).join("\n")}

## Unknowns And Deferrals

| Item | Disposition | Rationale | Follow-Up |
|------|-------------|-----------|-----------|
| No open unknowns for the code review scope fixture. | none | The fixture only seeds deterministic review scope evidence. | No follow-up required after the focused test passes. |
`,
      "utf8"
    );
  }

  await writeFile(
    path.join(phaseDir, "05-VERIFICATION.md"),
    `# Phase 05: Code Review Scope - Verification

## Result

- Validation evidence is available.
`,
    "utf8"
  );

  if (withSummary) {
    const summaryChanges =
      summaryChangedFiles.length > 0
        ? summaryChangedFiles.map((file) => `- \`${file}\``).join("\n")
        : "- Updated the source and test files for the feature slice.";

    await writeFile(
      path.join(phaseDir, "05-01-SUMMARY.md"),
      `# Phase 05: Code Review Scope - Summary 01

## Result

- Completed the review-ready feature slice.

## Changes Made

${summaryChanges}

## Evidence

- Summary evidence captured for this phase.
`,
      "utf8"
    );
  }

  return repoPath;
}

function createStructuredCodeReviewModel(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    verdict: "FOLLOW_UP",
    reviewSummary: [
      "Phase 5 standard review covered the source and test files with one high follow-up."
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
      ".blueprint/phases/05-review-scope/05-01-PLAN.md": {
        status: "used",
        rationale: "Plan metadata defined the reviewed source and test files."
      },
      ".blueprint/phases/05-review-scope/05-01-SUMMARY.md": {
        status: "used",
        rationale: "Summary evidence confirmed the completed delivery increment."
      },
      ".blueprint/phases/05-review-scope/05-VERIFICATION.md": {
        status: "used",
        rationale: "Verification evidence confirmed the saved phase was review-ready."
      }
    },
    followUps: ["Add a negative-input regression test before shipping."],
    nextSafeAction: "/blu-code-review-fix 5",
    ...overrides
  };
}

test("code-review catalog, runtime contract, and next-action validation survive bundled docs being unavailable", async (t) => {
  makeBundledDocsUnavailable(t);

  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const catalog = await blueprintCommandCatalog();
  const implementedCommands = Object.entries(catalog.commands)
    .filter(([, entry]) => entry.implemented)
    .map(([commandName]) => commandName);

  assert.ok(implementedCommands.includes("code-review"));
  assert.ok(implementedCommands.includes("code-review-fix"));
  assert.ok(implementedCommands.includes("secure-phase"));
  assert.ok(implementedCommands.includes("validate-phase"));
  assert.ok(implementedCommands.includes("verify-work"));
  assert.ok(implementedCommands.includes("add-tests"));
  assert.ok(implementedCommands.includes("progress"));
  assert.equal(
    catalog.commands["code-review"].specPath,
    "src/mcp/command-runtime-metadata.ts#code-review"
  );

  const contract = await buildBlueprintCommandRuntimeContractResource("code-review");
  assert.equal(contract.catalog.status, "implemented");
  assert.equal(
    contract.spec?.path,
    "src/mcp/command-runtime-metadata.ts#code-review"
  );
  assert.equal(contract.runtimeReference?.path, "src/mcp/command-runtime-metadata.ts#code-review");
  assert.deepEqual(contract.skillInputs.effective, [
    "commands/blu-code-review.toml",
    "skills/blueprint-review/references/code-review-runtime-contract.md"
  ]);

  const scoped = await blueprintReviewScope({
    cwd: repoPath,
    phase: "5",
    files: ["src/feature.ts", "tests/feature.test.ts"],
    includeAuthoringContext: true
  });
  assert.equal(scoped.status, "ready");
  assert.ok(scoped.authoringContext.allowedNextActions.includes("/blu-code-review-fix 5"));
  assert.ok(scoped.authoringContext.allowedNextActions.includes("/blu-secure-phase 5"));
  assert.ok(scoped.authoringContext.allowedNextActions.includes("/blu-progress"));

  const validation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    files: ["src/feature.ts", "tests/feature.test.ts"],
    model: createStructuredCodeReviewModel({
      nextSafeAction: "/blu-code-review-fix 5"
    })
  });

  assert.equal(validation.status, "valid");
  assert.equal(validation.valid, true);
  assert.equal(validation.diagnosticCounts.total, 0);
});

test("state load follows the saved code-review next safe action once review evidence exists", async (t) => {
  const repoPath = await createCodeReviewRepo({
    configPatch: {
      workflow: {
        research: false,
        ui_phase: false
      }
    }
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const phaseDir = path.join(repoPath, ".blueprint/phases/05-review-scope");

  await writeFile(
    path.join(phaseDir, "05-CONTEXT.md"),
    `# Phase 05: Code Review Scope - Context

## Goal

- Review the changed feature slice with saved Blueprint evidence.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-01-PLAN.md"),
    `---
phase: 5
plan_id: "01"
title: "Code Review Plan 01"
wave: 1
status: done
objective: "Exercise code-review follow-up routing."
depends_on: []
requirements:
  - REV-01
files_modified:
  - src/feature.ts
  - tests/feature.test.ts
read_first:
  - src/feature.ts
acceptance_criteria:
  - tests/code-review-slice.test.ts exits 0
autonomous: true
---

# Phase 05: Code Review Scope - Plan 01

## Goal

Exercise code-review follow-up routing.

## Scope

- Persist saved review evidence for the completed feature slice.

## Tasks

### Task 1: Capture review-ready evidence

#### Read First

- src/feature.ts

#### Action

- Keep the completed review scope grounded in the saved repo files and evidence.

#### Acceptance Criteria

- tests/code-review-slice.test.ts exits 0

## Verification

- Re-run the code-review slice after writing the saved review evidence.

## Must Haves

- Keep review routing grounded in the saved review artifact.

## Requirement Coverage

| Requirement | Status | Covered By Tasks | Evidence | Rationale |
|-------------|--------|------------------|----------|-----------|
| REV-01 | covered | task-1 | tests/code-review-slice.test.ts | The saved review evidence covers the review routing requirement. |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| src/feature.ts | used | The saved source fixture grounds the review scope. |

## File / Surface Coverage

| Surface | Covered By Tasks | Verification | Rationale |
|---------|------------------|--------------|-----------|
| src/feature.ts | task-1 | tests/code-review-slice.test.ts exits 0 | The focused test covers the source routing surface. |
| tests/feature.test.ts | task-1 | tests/code-review-slice.test.ts exits 0 | The focused test covers the test routing surface. |

## Unknowns And Deferrals

| Item | Disposition | Rationale | Follow-Up |
|------|-------------|-----------|-----------|
| No open unknowns for saved review evidence. | none | The fixture has complete plan and summary artifacts. | No follow-up required after the focused test passes. |
`,
    "utf8"
  );

  await writeFile(
    path.join(phaseDir, "05-VERIFICATION.md"),
    `# Phase 05: Code Review Scope - Verification

**Coverage:** Reviewed \`.blueprint/phases/05-review-scope/05-01-SUMMARY.md\` for completed execution evidence.
**Gate State:** PASS
**Sign-off:** validation lead

## Validation Summary

- Execution evidence matches the expected phase outcome.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| REV-01 | Confirm execution evidence exists | .blueprint/phases/05-review-scope/05-01-SUMMARY.md | PASS | Saved summaries back the verification pass. |

## Evidence Reviewed

- .blueprint/phases/05-review-scope/05-01-SUMMARY.md

## Test Infrastructure / Evidence Metadata

- Harness: node:test
- Commands: npm test
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

- Continue with conversational UAT through \`/blu-verify-work 5\`.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-01-SUMMARY.md"),
    completedSummaryContent(),
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-UAT.md"),
    `# Phase 05: Code Review Scope - UAT

**Status:** PASS
**Resume State:** NEW
**Checkpoint:** none

## UAT Summary

- UAT closed without blocking issues against the ready verification evidence in \`.blueprint/phases/05-review-scope/05-01-SUMMARY.md\`.

## Session State

- Resume source: \`.blueprint/phases/05-review-scope/05-01-SUMMARY.md\`
- Current session step: Close the initial UAT pass.
- Continuity notes: Keep the validated summary-backed behavior stable if the session resumes.

## Current Test

- Number: testing complete
- Name: none
- Expected: Keep the validated summary-backed behavior stable.
- Awaiting: none

## Test Matrix

| # | Test | Expected Behavior | Evidence | Result | Notes |
|---|------|-------------------|----------|--------|-------|
| 1 | Review scope UAT smoke | Keep the validated summary-backed behavior stable. | .blueprint/phases/05-review-scope/05-01-SUMMARY.md | pass | none |

## Result Summary

- Total: 1
- Passed: 1
- Issues: 0
- Pending: 0
- Skipped: 0
- Blocked: 0

## Questions Asked

- Did the delivered behavior match the saved execution summary?

## Observed Behavior

- The observed behavior matched the ready verification evidence in \`.blueprint/phases/05-review-scope/05-01-SUMMARY.md\`.

## Unresolved Gaps

- none

## Structured Gaps

| Test | Truth | Status | Severity | Reason | Follow-Up |
|------|-------|--------|----------|--------|-----------|
| none | none | none | none | none | none |

## Follow-Up Fixes

- none

## Next Safe Action

- Return to \`/blu-progress\` for the next safe implemented action.
`,
    "utf8"
  );

  await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    model: createStructuredCodeReviewModel({
      reviewSummary: [
        "Phase 5 standard review over one source file and one test file with two follow-up findings."
      ],
      findings: [
        {
          severity: "high",
          disposition: "follow-up",
          location: "src/feature.ts:1",
          evidence: "Negative-input behavior is undocumented and untested.",
          impact: "Invalid input can be processed as successful behavior.",
          recommendation: "Add a negative-input regression test before shipping."
        },
        {
          severity: "medium",
          disposition: "observation",
          location: "tests/feature.test.ts:1",
          evidence: "The saved evidence does not prove edge-case coverage.",
          impact: "Regression confidence remains lower for boundary behavior.",
          recommendation: "Extend focused tests for edge-case coverage."
        }
      ],
      evidenceCoverage: {
        ".blueprint/phases/05-review-scope/05-01-PLAN.md": {
          status: "used",
          rationale: "Plan metadata defined the reviewed source and test files."
        },
        ".blueprint/phases/05-review-scope/05-01-SUMMARY.md": {
          status: "used",
          rationale: "Summary evidence confirmed the completed delivery increment."
        },
        ".blueprint/phases/05-review-scope/05-VERIFICATION.md": {
          status: "used",
          rationale: "Verification evidence confirmed the saved phase was review-ready."
        },
        ".blueprint/phases/05-review-scope/05-UAT.md": {
          status: "used",
          rationale: "UAT evidence confirmed the phase behavior was accepted."
        }
      }
    }),
    scopeFiles: ["src/feature.ts", "tests/feature.test.ts"],
    scopeSource: "explicit-files"
  });
  await writeFile(
    path.join(repoPath, ".blueprint/phases/05-review-scope/05-SECURITY.md"),
    `# Phase 05: Code Review Scope - Security

## Findings

- none

## Next Safe Action

- Return to \`/blu-progress\` after security review.
`,
    "utf8"
  );

  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.match(state.derivedStatus.nextAction, /\/blu-code-review-fix 5/);
});

test("code-review docs and catalog metadata promote the review scope slice to implemented", async () => {
  const [catalogMarkdown, skillsMarkdown, commandDoc] = await Promise.all([
    readFile(path.join(repoRoot, "docs/COMMAND-CATALOG.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/SKILLS-AND-AGENTS.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/commands/code-review.md"), "utf8")
  ]);

  assert.match(
    catalogMarkdown,
    /\| `code-review` \| 4 \| `Quality And Shipping` \| `blueprint-review` \| `implemented` \| `phase XX-REVIEW\.md` \| `Low: review artifact generation only\.` \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-reviewer` \| `implemented` \| Produce bounded code review findings from a resolved Blueprint scope \|/
  );
  assert.match(commandDoc, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(commandDoc, /## Shared Runtime Contract/);
  assert.match(commandDoc, /## In-Flight Progress Contract/);
  assert.match(
    commandDoc,
    /skills\/blueprint-review\/references\/code-review-runtime-contract\.md/
  );
  assert.match(commandDoc, /`blueprint_artifact_contract_read` ->/);
  assert.match(commandDoc, /## Depth And Output Quality Contract/);
  assert.match(commandDoc, /## Subagent And Fallback Contract/);
  assert.match(commandDoc, /shared review posture from the runtime contract/i);
  assert.match(commandDoc, /`update_topic` tool and keep a compact review checklist with `write_todos`/);
});

test("blueprint_review_scope merges summary and plan evidence when no explicit scope is provided", async (t) => {
  const repoPath = await createCodeReviewRepo({
    summaryChangedFiles: ["src/summary.ts"],
    planFilesModified: [
      "src/plan.ts",
      "tests/plan.test.ts",
      ".blueprint/phases/05-review-scope/05-REVIEW.md"
    ]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const scoped = await blueprintReviewScope({
    cwd: repoPath,
    phase: "5"
  });

  assert.equal(scoped.status, "ready");
  assert.equal(scoped.phase?.phaseNumber, "5");
  assert.deepEqual(scoped.files, ["src/plan.ts", "src/summary.ts", "tests/plan.test.ts"]);
  assert.equal(scoped.reviewMode.depth, "standard");
  assert.equal(scoped.reviewMode.source, "phase-evidence");
  assert.equal(scoped.confirmationRecommended.recommended, false);
  assert.deepEqual(scoped.artifacts.plans, [".blueprint/phases/05-review-scope/05-01-PLAN.md"]);
  assert.deepEqual(scoped.artifacts.summaries, [
    ".blueprint/phases/05-review-scope/05-01-SUMMARY.md"
  ]);
  assert.equal(
    scoped.artifacts.verification,
    ".blueprint/phases/05-review-scope/05-VERIFICATION.md"
  );
});

test("blueprint_review_scope returns model authoring context with narrowed task schema", async (t) => {
  const repoPath = await createCodeReviewRepo({
    summaryChangedFiles: ["src/summary.ts"],
    planFilesModified: ["src/plan.ts", "tests/plan.test.ts"]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const scoped = await blueprintReviewScope({
    cwd: repoPath,
    phase: "5",
    includeAuthoringContext: true
  });

  assert.equal(scoped.status, "ready");
  assert.ok(scoped.authoringContext);
  assert.deepEqual(scoped.authoringContext.files, [
    "src/plan.ts",
    "src/summary.ts",
    "tests/plan.test.ts"
  ]);
  assert.deepEqual(scoped.authoringContext.knownEvidenceArtifacts, [
    ".blueprint/phases/05-review-scope/05-01-PLAN.md",
    ".blueprint/phases/05-review-scope/05-01-SUMMARY.md",
    ".blueprint/phases/05-review-scope/05-VERIFICATION.md"
  ]);
  assert.equal(
    scoped.authoringContext.schemaPath,
    "src/mcp/artifact-contracts/schemas/review.code-review.model.schema.json"
  );
  assert.match(
    JSON.stringify(scoped.authoringContext.baseSchema),
    /Model-authored payload|examples|evidenceCoverage/
  );
  assert.deepEqual(
    (scoped.authoringContext.taskSchema.properties as Record<string, unknown>).evidenceCoverage,
    {
      type: "object",
      description:
        "Exhaustive coverage decisions for the exact known evidence artifacts in this phase.",
      additionalProperties: false,
      required: [
        ".blueprint/phases/05-review-scope/05-01-PLAN.md",
        ".blueprint/phases/05-review-scope/05-01-SUMMARY.md",
        ".blueprint/phases/05-review-scope/05-VERIFICATION.md"
      ],
      properties: {
        ".blueprint/phases/05-review-scope/05-01-PLAN.md": {
          $ref: "#/$defs/evidenceCoverageEntry"
        },
        ".blueprint/phases/05-review-scope/05-01-SUMMARY.md": {
          $ref: "#/$defs/evidenceCoverageEntry"
        },
        ".blueprint/phases/05-review-scope/05-VERIFICATION.md": {
          $ref: "#/$defs/evidenceCoverageEntry"
        }
      }
    }
  );
  assert.ok(scoped.authoringContext.allowedNextActions.includes("/blu-code-review-fix 5"));
  assert.ok(scoped.authoringContext.allowedNextActions.includes("/blu-progress"));
});

test("blueprint_review_scope reports phase-summaries when summary evidence alone defines the scope", async (t) => {
  const repoPath = await createCodeReviewRepo({
    withPlan: false,
    summaryChangedFiles: ["src/summary.ts"]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const scoped = await blueprintReviewScope({
    cwd: repoPath,
    phase: "5"
  });

  assert.equal(scoped.status, "ready");
  assert.deepEqual(scoped.files, ["src/summary.ts"]);
  assert.equal(scoped.reviewMode.source, "phase-summaries");
});

test("blueprint_review_scope keeps explicit files scoped exactly to the explicit list", async (t) => {
  const repoPath = await createCodeReviewRepo({
    summaryChangedFiles: ["src/summary.ts"],
    planFilesModified: [
      "src/plan.ts",
      "tests/plan.test.ts",
      ".blueprint/phases/05-review-scope/05-REVIEW.md"
    ]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const scoped = await blueprintReviewScope({
    cwd: repoPath,
    phase: "5",
    files: ["src/feature.ts"]
  });

  assert.equal(scoped.status, "ready");
  assert.deepEqual(scoped.files, ["src/feature.ts"]);
  assert.equal(scoped.reviewMode.source, "explicit-files");
  assert.equal(scoped.reviewMode.depth, "standard");
});

test("blueprint_review_scope rejects explicit scope when any requested file path is invalid", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const scoped = await blueprintReviewScope({
    cwd: repoPath,
    phase: "5",
    files: ["src/feature.ts", ".blueprint/phases/05-review-scope/05-REVIEW.md"]
  });

  assert.equal(scoped.status, "invalid");
  assert.deepEqual(scoped.files, []);
  assert.equal(scoped.reviewMode.source, "explicit-files");
  assert.match(scoped.reason ?? "", /invalid `--files` entries/i);
  assert.match(scoped.warnings.join("\n"), /\.blueprint artifacts are not reviewable repo files/i);
});

test("blueprint_review_scope ignores file-looking paths under summary Evidence sections", async (t) => {
  const repoPath = await createCodeReviewRepo({
    planFilesModified: ["src/plan.ts"]
  });
  const phaseDir = path.join(repoPath, ".blueprint/phases/05-review-scope");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, "tests/evidence.test.ts"),
    "export const evidence_test = true;\n",
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-01-SUMMARY.md"),
    `# Phase 05: Code Review Scope - Summary 01

## Result

- Completed the review-ready feature slice.

## Changes Made

- Updated scope bookkeeping only.

## Evidence

- \`tests/evidence.test.ts\`
`,
    "utf8"
  );

  const scoped = await blueprintReviewScope({
    cwd: repoPath,
    phase: "5"
  });

  assert.equal(scoped.status, "ready");
  assert.deepEqual(scoped.files, ["src/plan.ts"]);
  assert.doesNotMatch(scoped.files.join("\n"), /tests\/evidence\.test\.ts/);
});

test("blueprint_review_scope honors workflow.code_review and workflow.code_review_depth from config", async (t) => {
  const disabledRepoPath = await createCodeReviewRepo({
    configPatch: { workflow: { code_review: false } }
  });
  const depthRepoPath = await createCodeReviewRepo({
    configPatch: { workflow: { code_review_depth: "deep" } }
  });

  t.after(async () => {
    await rm(path.dirname(disabledRepoPath), { recursive: true, force: true });
    await rm(path.dirname(depthRepoPath), { recursive: true, force: true });
  });

  const disabled = await blueprintReviewScope({
    cwd: disabledRepoPath,
    phase: "5"
  });
  const deepDefault = await blueprintReviewScope({
    cwd: depthRepoPath,
    phase: "5"
  });

  assert.equal(disabled.status, "invalid");
  assert.match(disabled.reason ?? "", /workflow\.code_review is disabled/i);
  assert.equal(deepDefault.status, "ready");
  assert.equal(deepDefault.reviewMode.depth, "deep");
});

test("blueprint_review_scope surfaces deterministic confirmation metadata for broad, multi-plan, and deep scopes", async (t) => {
  const repoPath = await createCodeReviewRepo({
    summaryChangedFiles: ["src/one.ts", "src/two.ts", "src/three.ts"],
    planFilesModified: ["src/four.ts", "src/five.ts"]
  });
  const phaseDir = path.join(repoPath, ".blueprint/phases/05-review-scope");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, "src/six.ts"),
    "export const six = true;\n",
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-02-PLAN.md"),
    `---
phase: 5
plan_id: "02"
title: "Additional Review Scope"
wave: 4
status: done
objective: "Expand the changed repo files."
depends_on: []
requirements:
  - REV-01
files_modified:
  - src/six.ts
read_first:
  - src/six.ts
acceptance_criteria:
  - rg "six" src/six.ts
autonomous: true
---

# Phase 05: Code Review Scope - Plan 02

## Goal

Expand the changed repo files.

## Scope

- Additional source file.

## Tasks

### Task 1

#### Read First

- src/six.ts

#### Action

- Review the additional file.

#### Acceptance Criteria

- rg "six" src/six.ts

## Verification

- Confirm the extra file is represented in saved scope evidence.

## Must Haves

- Keep review scope deterministic.

## Requirement Coverage

| Requirement | Status | Covered By Tasks | Evidence | Rationale |
|-------------|--------|------------------|----------|-----------|
| REV-01 | covered | task-1 | tests/code-review-slice.test.ts | The additional review plan covers the declared review requirement. |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| src/six.ts | used | The additional source fixture defines the expanded review scope. |

## File / Surface Coverage

| Surface | Covered By Tasks | Verification | Rationale |
|---------|------------------|--------------|-----------|
| src/six.ts | task-1 | rg "six" src/six.ts | The focused grep covers the added source file. |

## Unknowns And Deferrals

| Item | Disposition | Rationale | Follow-Up |
|------|-------------|-----------|-----------|
| No open unknowns for the additional review fixture. | none | The fixture only expands deterministic scope evidence. | No follow-up required after the focused test passes. |
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "05-02-SUMMARY.md"),
    `# Phase 05: Code Review Scope - Summary 02

## Result

- Added a second executed plan for scope confirmation coverage.

## Changes Made

- \`src/six.ts\`

## Evidence

- Saved scope evidence remains deterministic.
`,
    "utf8"
  );

  const scoped = await blueprintReviewScope({
    cwd: repoPath,
    phase: "5",
    depth: "deep"
  });

  assert.equal(scoped.status, "ready");
  assert.equal(scoped.confirmationRecommended.recommended, true);
  assert.equal(scoped.confirmationRecommended.pendingGate, "scope-confirmation");
  assert.deepEqual(scoped.confirmationRecommended.thresholds, {
    broadFileCount: 5,
    multiPlanCount: 2,
    deepFileCount: 3
  });
  assert.equal(scoped.confirmationRecommended.signals.fileCount, 6);
  assert.equal(scoped.confirmationRecommended.signals.summaryCount, 2);
  assert.equal(scoped.confirmationRecommended.signals.matchedPlanCount, 2);
  assert.match(scoped.confirmationRecommended.reasons.join("\n"), /broad-scope confirmation threshold/i);
  assert.match(scoped.confirmationRecommended.reasons.join("\n"), /multi-plan confirmation threshold/i);
  assert.match(scoped.confirmationRecommended.reasons.join("\n"), /deep-review confirmation threshold/i);
});

test("blueprint_review_record persists model-only code-review artifacts and tracks overwrite status", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const initialModel = createStructuredCodeReviewModel({
    reviewSummary: [
      "Phase 5 standard review over one source file and one test file with two follow-up findings."
    ],
    findings: [
      {
        severity: "high",
        disposition: "follow-up",
        location: "src/feature.ts:1",
        evidence: "Negative-input behavior is undocumented and untested.",
        impact: "Invalid input can be processed as successful behavior.",
        recommendation: "Add a negative-input regression test before shipping."
      },
      {
        severity: "medium",
        disposition: "observation",
        location: "tests/feature.test.ts:1",
        evidence: "The saved evidence does not prove edge-case coverage.",
        impact: "Regression confidence remains lower for boundary behavior.",
        recommendation: "Extend focused tests for edge-case coverage."
      }
    ]
  });
  const updatedModel = createStructuredCodeReviewModel({
    reviewSummary: [
      "Phase 5 standard review over one source file and one test file with two follow-up findings."
    ],
    findings: [
      {
        severity: "high",
        disposition: "follow-up",
        location: "src/feature.ts:1",
        evidence: "Negative-input behavior is undocumented and untested.",
        impact: "Invalid input can be processed as successful behavior.",
        recommendation:
          "Add a negative-input regression test and rerun focused verification before shipping."
      },
      {
        severity: "medium",
        disposition: "observation",
        location: "tests/feature.test.ts:1",
        evidence: "The saved evidence does not prove edge-case coverage.",
        impact: "Regression confidence remains lower for boundary behavior.",
        recommendation: "Extend focused tests for edge-case coverage."
      }
    ],
    followUps: [
      "Add a negative-input regression test and rerun focused verification before shipping."
    ]
  });

  const created = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    model: initialModel,
    scopeFiles: ["src/feature.ts", "tests/feature.test.ts"],
    scopeSource: "explicit-files"
  });

  assert.equal(created.status, "created");
  assert.equal(created.reportPath, ".blueprint/phases/05-review-scope/05-REVIEW.md");
  assert.deepEqual(created.counts, {
    sections: 9,
    findings: 2,
    followUps: 1
  });

  const loaded = await blueprintReviewLoadFindings({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review"
  });

  assert.equal(loaded.found, true);
  assert.deepEqual(
    loaded.findings.map((finding) => [finding.severity, finding.summary]),
    [
      [
        "high",
        "Add a negative-input regression test before shipping."
      ],
      [
        "medium",
        "Extend focused tests for edge-case coverage."
      ]
    ]
  );
  assert.deepEqual(loaded.followUps, ["Add a negative-input regression test before shipping."]);

  const reused = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    model: initialModel,
    scopeFiles: ["src/feature.ts", "tests/feature.test.ts"],
    scopeSource: "explicit-files"
  });

  assert.equal(reused.status, "reused");
  assert.match(reused.warnings.join("\n"), /Preserved existing review artifact/i);

  await assert.rejects(
    () =>
      blueprintReviewRecord({
        cwd: repoPath,
        phase: "5",
        artifact: "code-review",
        model: updatedModel,
        scopeFiles: ["src/feature.ts", "tests/feature.test.ts"],
        scopeSource: "explicit-files"
      }),
    /already exists\. Re-run only after explicit overwrite confirmation/i
  );

  const updated = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    model: updatedModel,
    scopeFiles: ["src/feature.ts", "tests/feature.test.ts"],
    scopeSource: "explicit-files",
    overwrite: true
  });

  assert.equal(updated.status, "updated");
  assert.equal(updated.overwritten, true);
  assert.match(updated.warnings.join("\n"), /Replaced existing review artifact/i);
});

test("blueprint_review_record persists structured code-review models as canonical markdown", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const model = createStructuredCodeReviewModel();

  const validation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    files: ["src/feature.ts", "tests/feature.test.ts"],
    model
  });

  assert.equal(validation.status, "valid");
  assert.equal(validation.valid, true);
  assert.equal(validation.diagnosticCounts.total, 0);
  assert.ok(validation.normalizedModel);
  assert.match(validation.renderPreview ?? "", /## Scope Reviewed/);

  const created = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    model,
    scopeFiles: ["src/feature.ts", "tests/feature.test.ts"],
    scopeSource: "explicit-files"
  });

  assert.equal(created.status, "created");
  assert.equal(created.reportPath, ".blueprint/phases/05-review-scope/05-REVIEW.md");
  assert.deepEqual(created.counts, {
    sections: 9,
    findings: 1,
    followUps: 1
  });

  const saved = await readFile(path.join(repoPath, created.reportPath), "utf8");
  assert.match(saved, /\*\*Verdict:\*\* FOLLOW_UP/);
  assert.match(saved, /- Depth: standard/);
  assert.match(saved, /- Scope source: explicit-files/);
  assert.match(saved, /- high: 1/);
  assert.match(saved, /\.blueprint\/phases\/05-review-scope\/05-VERIFICATION\.md/);
  assert.match(
    saved,
    /\[high\]\[follow-up\] `F-01` `src\/feature\.ts:1` - Evidence: The feature implementation has no negative-input guard\./
  );
  assert.match(saved, /`FU-01` - Add a negative-input regression test before shipping\./);

  const loaded = await blueprintReviewLoadFindings({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review"
  });

  assert.equal(loaded.findings.length, 1);
  assert.deepEqual(loaded.findings.map((finding) => finding.id), ["F-01"]);
  assert.deepEqual(loaded.followUps, ["Add a negative-input regression test before shipping."]);
  assert.deepEqual(loaded.severityCounts, {
    critical: 0,
    high: 1,
    medium: 0,
    low: 0,
    unknown: 0
  });
});

test("blueprint_review_record preserves distinct critical and high counts when finding prose mentions another severity", async (t) => {
  const scopeFiles = [
    "src/feature.ts",
    "src/cache.ts",
    "src/error.ts",
    "tests/feature.test.ts",
    "tests/error.test.ts"
  ];
  const repoPath = await createCodeReviewRepo({
    planFilesModified: scopeFiles
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const model = createStructuredCodeReviewModel({
    reviewSummary: [
      "Phase 5 review found one critical issue and four high issues across the scoped files."
    ],
    findings: [
      {
        severity: "critical",
        disposition: "follow-up",
        location: "src/feature.ts:1",
        evidence: "The write path can silently drop user data.",
        impact: "Users can lose committed work without any recovery path.",
        recommendation: "Block the write until the data-loss path is repaired."
      },
      {
        severity: "high",
        disposition: "follow-up",
        location: "src/cache.ts:1",
        evidence: "The cache path can reuse stale phase evidence.",
        impact: "A critical path can be reviewed against the wrong inputs.",
        recommendation: "Invalidate cached evidence before reviewing the changed files."
      },
      {
        severity: "high",
        disposition: "follow-up",
        location: "src/error.ts:1",
        evidence: "The error path hides failed persistence.",
        impact: "Operators can believe a high-risk write succeeded when it did not.",
        recommendation: "Surface the persistence failure before routing forward."
      },
      {
        severity: "high",
        disposition: "follow-up",
        location: "tests/feature.test.ts:1",
        evidence: "The regression suite lacks coverage for the failed write branch.",
        impact: "The critical recovery behavior can regress unnoticed.",
        recommendation: "Add a focused regression test for failed persistence."
      },
      {
        severity: "high",
        disposition: "follow-up",
        location: "tests/error.test.ts:1",
        evidence: "The error fixture does not assert user-visible repair guidance.",
        impact: "High-severity operator guidance can disappear without a failing test.",
        recommendation: "Assert the repair guidance in the error-path test."
      }
    ],
    followUps: [
      "Repair the data-loss write path.",
      "Invalidate cached evidence before review.",
      "Surface persistence failures.",
      "Add failed-write regression coverage.",
      "Assert error-path repair guidance."
    ]
  });

  const validation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    files: scopeFiles,
    model
  });

  assert.equal(validation.status, "valid", reviewResultMessages(validation));
  assert.match(validation.renderPreview ?? "", /- critical: 1/);
  assert.match(validation.renderPreview ?? "", /- high: 4/);

  const created = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    model,
    scopeFiles,
    scopeSource: "explicit-files"
  });
  assert.equal(created.status, "created");

  const saved = await readFile(path.join(repoPath, created.reportPath), "utf8");
  assert.match(saved, /- critical: 1/);
  assert.match(saved, /- high: 4/);

  const loaded = await blueprintReviewLoadFindings({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review"
  });
  assert.deepEqual(loaded.severityCounts, {
    critical: 1,
    high: 4,
    medium: 0,
    low: 0,
    unknown: 0
  });
});

test("blueprint_review_load_findings derives stable ids for legacy code-review markdown without visible ids", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const reviewPath = path.join(repoPath, ".blueprint/phases/05-review-scope/05-REVIEW.md");

  await writeFile(
    reviewPath,
    `# Phase 05: Code Review Scope - Code Review

**Verdict:** FOLLOW_UP

## Findings

- [high][follow-up] \`src/feature.ts:1\` - Evidence: Legacy review finding one. Impact: It matters. Fix/verification: Fix it.
- [medium][observation] \`tests/feature.test.ts:1\` - Evidence: Legacy review finding two. Impact: It matters less. Fix/verification: Cover it.

## Follow-Ups

- Re-run focused validation.
`,
    "utf8"
  );

  const loaded = await blueprintReviewLoadFindings({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review"
  });

  assert.equal(loaded.found, true);
  assert.equal(loaded.findings.length, 2);
  assert.match(loaded.findings[0]?.id ?? "", /^F-LEGACY-[A-F0-9]{10}$/);
  assert.match(loaded.findings[1]?.id ?? "", /^F-LEGACY-[A-F0-9]{10}$/);
  assert.notEqual(loaded.findings[0]?.id, loaded.findings[1]?.id);
  assert.deepEqual(
    loaded.findings.map((finding) => [finding.legacyDerived, finding.severity]),
    [
      [true, "high"],
      [true, "medium"]
    ]
  );
  assert.deepEqual(loaded.followUps, ["Re-run focused validation."]);
});

test("blueprint_review_load_findings preserves structured code-review finding fields for remediation handoff", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const created = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    model: createStructuredCodeReviewModel({
      findings: [
        {
          severity: "high",
          disposition: "follow-up",
          location: "src/feature.ts:1",
          evidence: "The feature implementation has no negative-input guard.",
          impact: "Invalid input can be treated as successful behavior.",
          recommendation: "Add an explicit negative-input guard before validation reruns."
        }
      ]
    }),
    scopeFiles: ["src/feature.ts", "tests/feature.test.ts"],
    scopeSource: "explicit-files"
  });

  assert.equal(created.status, "created");

  const loaded = await blueprintReviewLoadFindings({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review"
  });

  const finding = (loaded.findings as Array<{
    id: string;
    severity: string;
    disposition?: string;
    summary: string;
    evidence?: string;
    location?: {
      display?: string;
      file?: string;
      startLine?: number;
      endLine?: number | null;
    };
  }>)[0];

  assert.deepEqual(
    {
      id: finding.id,
      severity: finding.severity,
      disposition: finding.disposition,
      summary: finding.summary,
      evidence: finding.evidence,
      location: finding.location
    },
    {
      id: "F-01",
      severity: "high",
      disposition: "follow-up",
      summary: "Add an explicit negative-input guard before validation reruns.",
      evidence: "The feature implementation has no negative-input guard.",
      location: {
        display: "src/feature.ts:1",
        file: "src/feature.ts",
        startLine: 1,
        endLine: 1
      }
    }
  );
});

test("blueprint_review_record keeps no-follow-up sentinel unnumbered", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const created = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    model: createStructuredCodeReviewModel({
      verdict: "PASS",
      findings: [],
      followUps: ["none"],
      nextSafeAction: "/blu-progress"
    }),
    scopeFiles: ["src/feature.ts", "tests/feature.test.ts"],
    scopeSource: "explicit-files"
  });

  assert.equal(created.status, "created");
  assert.equal(created.counts.followUps, 0);
  const saved = await readFile(path.join(repoPath, created.reportPath), "utf8");
  assert.match(saved, /## Follow-Ups\n\n- none/);
  assert.doesNotMatch(saved, /FU-01/);
});

test("blueprint_review_record preserves implicit phase-evidence scope source when replaying validated files", async (t) => {
  const repoPath = await createCodeReviewRepo({
    summaryChangedFiles: ["src/feature.ts", "tests/feature.test.ts"]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const model = createStructuredCodeReviewModel();

  const validation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    model
  });

  assert.equal(validation.status, "valid");
  assert.equal(validation.reviewMode.source, "phase-evidence");

  const created = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    model,
    scopeFiles: validation.files,
    scopeSource: "phase-evidence"
  });

  assert.equal(created.status, "created");
  const saved = await readFile(path.join(repoPath, created.reportPath), "utf8");
  assert.match(saved, /- Scope source: phase-evidence/);
  assert.doesNotMatch(saved, /- Scope source: explicit-files/);
});

test("blueprint_review_record requires scopeSource whenever scoped files are supplied", async (t) => {
  const repoPath = await createCodeReviewRepo({
    summaryChangedFiles: ["src/feature.ts", "tests/feature.test.ts"]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalid = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    model: createStructuredCodeReviewModel(),
    scopeFiles: ["src/feature.ts", "tests/feature.test.ts"]
  });

  assert.equal(invalid.status, "invalid");
  assert.match(
    reviewResultMessages(invalid as { warnings?: string[]; diagnostics?: Array<{ message: string }> }),
    /scopeSource/i
  );
});

test("blueprint_review_record preserves explicit-files when explicit scope equals implicit scope", async (t) => {
  const repoPath = await createCodeReviewRepo({
    summaryChangedFiles: ["src/feature.ts", "tests/feature.test.ts"]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const created = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    model: createStructuredCodeReviewModel(),
    scopeFiles: ["src/feature.ts", "tests/feature.test.ts"],
    scopeSource: "explicit-files"
  });

  assert.equal(created.status, "created");
  const saved = await readFile(path.join(repoPath, created.reportPath), "utf8");
  assert.match(saved, /- Scope source: explicit-files/);
});

test("blueprint_review_record accepts structured code-review findings for root-level files", async (t) => {
  const repoPath = await createCodeReviewRepo({
    planFilesModified: ["package.json"],
    summaryChangedFiles: ["package.json"]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const created = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    model: createStructuredCodeReviewModel({
      reviewSummary: [
        "Phase 5 standard review covered one root-level package metadata file with one high follow-up."
      ],
      positiveSignals: [
        "Saved phase evidence narrowed the review to the root-level package metadata file."
      ],
      findings: [
        {
          severity: "high",
          disposition: "follow-up",
          location: "package.json:1",
          evidence: "The package metadata fixture records a reviewable root-level change.",
          impact: "Review evidence for root-level files must remain persistable.",
          recommendation: "Keep root-level file:line citations valid in structured reviews."
        }
      ],
      followUps: ["Keep root-level file citations covered by code-review regression tests."]
    }),
    scopeFiles: ["package.json"],
    scopeSource: "explicit-files"
  });

  assert.equal(created.status, "created");
  const saved = await readFile(path.join(repoPath, created.reportPath), "utf8");
  assert.match(saved, /- package\.json/);
  assert.match(saved, /`package\.json:1`/);
});

test("blueprint_review_scope task schema accepts scoped root extensionless file citations", async (t) => {
  const repoPath = await createCodeReviewRepo({
    planFilesModified: ["Dockerfile"],
    summaryChangedFiles: ["Dockerfile"]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const scoped = await blueprintReviewScope({
    cwd: repoPath,
    phase: "5",
    includeAuthoringContext: true
  });
  assert.equal(scoped.status, "ready");
  assert.deepEqual(scoped.files, ["Dockerfile"]);
  assert.ok(scoped.authoringContext);

  const validate = new Ajv2020({
    allErrors: true,
    strict: false,
    validateSchema: true
  }).compile(scoped.authoringContext.taskSchema);
  const valid = validate(
    createStructuredCodeReviewModel({
      reviewSummary: [
        "Phase 5 standard review covered one root-level Dockerfile with one high follow-up."
      ],
      positiveSignals: [
        "Saved phase evidence narrowed the review to the root-level Dockerfile."
      ],
      findings: [
        {
          severity: "high",
          disposition: "follow-up",
          location: "Dockerfile:1",
          evidence: "The Dockerfile fixture records a reviewable root-level extensionless change.",
          impact: "Review evidence for extensionless root files must remain valid.",
          recommendation: "Keep root-level extensionless file:line citations valid in structured reviews."
        }
      ],
      followUps: ["Keep extensionless root file citations covered by code-review regression tests."]
    })
  );

  assert.equal(valid, true, JSON.stringify(validate.errors, null, 2));
});

test("blueprint_review_record rejects invalid structured code-review models before persistence", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const missingEvidence = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    model: createStructuredCodeReviewModel({
      evidenceCoverage: {
        ".blueprint/phases/05-review-scope/05-01-PLAN.md": {
          status: "used",
          rationale: "Plan metadata defined the reviewed source and test files."
        },
        ".blueprint/phases/05-review-scope/05-01-SUMMARY.md": {
          status: "used",
          rationale: "Summary evidence confirmed the completed delivery increment."
        }
      }
    }),
    scopeFiles: ["src/feature.ts", "tests/feature.test.ts"],
    scopeSource: "explicit-files"
  });

  assert.equal(missingEvidence.status, "invalid");
  assert.equal(missingEvidence.written, false);
  assert.match(missingEvidence.warnings.join("\n"), /05-VERIFICATION\.md/);

  const genericFindingFields = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    model: createStructuredCodeReviewModel({
      positiveSignals: ["none"],
      findings: [
        {
          severity: "high",
          disposition: "follow-up",
          location: "src/feature.ts:1",
          evidence: "n/a",
          impact: "none",
          recommendation: "not applicable"
        }
      ]
    }),
    scopeFiles: ["src/feature.ts", "tests/feature.test.ts"],
    scopeSource: "explicit-files"
  });

  assert.equal(genericFindingFields.status, "invalid");
  const genericWarnings = genericFindingFields.warnings.join("\n");
  assert.match(genericWarnings, /positiveSignals cannot use generic none values/i);
  assert.match(genericWarnings, /findings\.0\.evidence must be concrete/i);
  assert.match(genericWarnings, /findings\.0\.impact must be concrete/i);
  assert.match(genericWarnings, /findings\.0\.recommendation must be concrete/i);

  const bothInputs = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    content: "# ignored\n",
    model: createStructuredCodeReviewModel(),
    scopeFiles: ["src/feature.ts", "tests/feature.test.ts"],
    scopeSource: "explicit-files"
  });

  assert.equal(bothInputs.status, "invalid");
  assert.match(bothInputs.warnings.join("\n"), /model-only; content is invalid/i);
});

test("blueprint_review_record rejects markdown content for code-review artifacts", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalid = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    content: "# Phase 05: Code Review Scope - Code Review\n"
  });

  assert.equal(invalid.status, "invalid");
  assert.equal(invalid.written, false);
  assert.match(invalid.warnings.join("\n"), /model-only; content is invalid/i);
});

test("blueprint_review_validate_model aggregates schema and residual diagnostics", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const model = createStructuredCodeReviewModel({
    unsupportedField: "must be rejected",
    positiveSignals: ["todo"],
    findings: [
      {
        severity: "high",
        disposition: "follow-up",
        location: "src/feature.ts:3-2",
        evidence: "n/a",
        impact: "none",
        recommendation: "not applicable"
      }
    ]
  });
  delete model.evidenceCoverage;

  const invalid = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    files: ["src/feature.ts", "tests/feature.test.ts"],
    model
  });

  assert.equal(invalid.status, "invalid");
  assert.equal(invalid.valid, false);
  assert.ok(invalid.diagnosticCounts.bySource.schema > 0);
  assert.ok(invalid.diagnosticCounts.bySource.residual > 0);
  assert.ok(
    invalid.diagnostics.some((diagnostic) => diagnostic.code === "schema.additionalProperties")
  );
  assert.ok(
    invalid.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "schema.required" &&
        diagnostic.path === "model.evidenceCoverage"
    )
  );
  assert.ok(
    invalid.diagnostics.some((diagnostic) => diagnostic.code === "residual.invalid_line_range")
  );
  assert.match(
    invalid.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must NOT have additional properties|invalid line range|placeholder language|must be concrete/i
  );
  assert.ok(
    invalid.diagnostics.every(
      (diagnostic) =>
        diagnostic.source &&
        diagnostic.path &&
        diagnostic.code &&
        diagnostic.message &&
        diagnostic.context &&
        diagnostic.suggestion
    )
  );
});

test("code-review schema rejects multiline scalar fields before Markdown render", async () => {
  const schema = await readSchemaFile(
    "src/mcp/artifact-contracts/schemas/review.code-review.model.schema.json"
  );
  const validate = new Ajv2020({
    allErrors: true,
    strict: false,
    validateSchema: true
  }).compile(schema);
  const valid = validate(
    createStructuredCodeReviewModel({
      reviewSummary: [
        "First line\nSecond line"
      ],
      findings: [
        {
          severity: "high",
          disposition: "follow-up",
          location: "src/feature.ts:1",
          evidence: "Concrete first line\nInjected second line",
          impact: "Invalid input can be processed as successful behavior.",
          recommendation: "Add a negative-input guard and focused test coverage."
        }
      ]
    })
  );

  assert.equal(valid, false);
  assert.match(JSON.stringify(validate.errors, null, 2), /pattern/);
});

test("blueprint_review_validate_model accepts quoted placeholder tokens when the evidence is concrete", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const validation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    files: ["src/feature.ts", "tests/feature.test.ts"],
    model: createStructuredCodeReviewModel({
      findings: [
        {
          severity: "high",
          disposition: "follow-up",
          location: "src/feature.ts:1",
          evidence:
            "The retained source comment literally says \"TODO: remove after migration\" and proves the fallback branch is still active.",
          impact: "The fallback path can keep masking negative-input handling debt.",
          recommendation:
            "Replace the quoted TODO with a completed guard implementation and focused regression coverage."
        }
      ]
    })
  });

  assert.equal(
    validation.status,
    "valid",
    validation.diagnostics.map((diagnostic) => diagnostic.message).join("\n")
  );
  assert.ok(
    validation.diagnostics.every((diagnostic) => diagnostic.code !== "residual.placeholder_text"),
    validation.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`).join("\n")
  );
});

test("blueprint_review_validate_model accepts distinct same-line findings when the evidence is substantively different", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const validation = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    files: ["src/feature.ts", "tests/feature.test.ts"],
    model: createStructuredCodeReviewModel({
      reviewSummary: [
        "Phase 5 review found two distinct issues anchored to the same guardless source line."
      ],
      findings: [
        {
          severity: "high",
          disposition: "follow-up",
          location: "src/feature.ts:1",
          evidence: "Negative inputs are accepted without an early guard.",
          impact: "Invalid input can be processed as successful behavior.",
          recommendation: "Add an explicit negative-input guard."
        },
        {
          severity: "medium",
          disposition: "observation",
          location: "src/feature.ts:1",
          evidence: "The same branch has no inline rationale explaining why the fallback remains.",
          impact: "Future cleanup work can reintroduce the same bug because intent is opaque.",
          recommendation: "Document the retained branch intent while the fix lands."
        }
      ],
      followUps: [
        "Add the negative-input guard before shipping."
      ]
    })
  });

  assert.equal(
    validation.status,
    "valid",
    validation.diagnostics.map((diagnostic) => diagnostic.message).join("\n")
  );
});

test("blueprint_review_validate_model requires explicit files when saved scope evidence has no review files", async (t) => {
  const repoPath = await createCodeReviewRepo({
    withPlan: false,
    withSummary: false
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const omittedFiles = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    model: createStructuredCodeReviewModel({})
  });
  const emptyFiles = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    files: [],
    model: createStructuredCodeReviewModel({})
  });

  for (const validation of [omittedFiles, emptyFiles]) {
    assert.equal(validation.status, "invalid");
    assert.equal(validation.valid, false);
    assert.deepEqual(validation.files, []);
    assert.equal(validation.diagnostics.length, 1);
    assert.deepEqual(validation.diagnosticCounts.bySource, {
      scope: 1,
      schema: 0,
      residual: 0,
      markdown: 0
    });
    assert.equal(validation.diagnostics[0].source, "scope");
    assert.equal(validation.diagnostics[0].code, "scope.files_required");
    assert.equal(validation.diagnostics[0].path, "model.findings[].location");
    assert.match(
      validation.diagnostics[0].message,
      /location scope cannot be validated because no explicit files were passed and no PLAN\/SUMMARY-derived review files were found/i
    );
    assert.doesNotMatch(
      validation.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
      /severity count|severityCounts|markdown|schema/i
    );
  }
});

test("blueprint_review_validate_model rejects explicit finding locations outside files", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalid = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    files: ["src/feature.ts"],
    model: createStructuredCodeReviewModel({
      findings: [
        {
          severity: "high",
          disposition: "follow-up",
          location: "tests/feature.test.ts:1",
          evidence: "The test file is outside the explicitly requested review scope.",
          impact: "The review could report findings outside the user-selected files.",
          recommendation: "Keep finding citations inside the explicit files list."
        }
      ]
    })
  });

  assert.equal(invalid.status, "invalid");
  assert.deepEqual(invalid.files, ["src/feature.ts"]);
  assert.ok(
    invalid.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "residual.location_out_of_scope" &&
        diagnostic.path === "model.findings[0].location" &&
        /outside the resolved review scope/i.test(diagnostic.message)
    )
  );
});

test("blueprint_review_validate_model rejects implicit finding locations outside derived files", async (t) => {
  const repoPath = await createCodeReviewRepo({
    planFilesModified: ["src/feature.ts"],
    summaryChangedFiles: ["src/feature.ts"]
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalid = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    model: createStructuredCodeReviewModel({
      findings: [
        {
          severity: "high",
          disposition: "follow-up",
          location: "tests/feature.test.ts:1",
          evidence: "The test file is outside the saved PLAN/SUMMARY-derived review scope.",
          impact: "The review could report findings outside the resolved implicit scope.",
          recommendation: "Keep finding citations inside the derived review files list."
        }
      ]
    })
  });

  assert.equal(invalid.status, "invalid");
  assert.deepEqual(invalid.files, ["src/feature.ts"]);
  assert.equal(invalid.reviewMode.source, "phase-evidence");
  assert.ok(
    invalid.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "residual.location_out_of_scope" &&
        diagnostic.path === "model.findings[0].location" &&
        /outside the resolved review scope/i.test(diagnostic.message)
    )
  );
});

test("blueprint_review_validate_model rejects authored runtime-owned severity counts", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalid = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    files: ["src/feature.ts", "tests/feature.test.ts"],
    model: createStructuredCodeReviewModel({
      severityCounts: {
        critical: 0,
        high: 1,
        medium: 0,
        low: 0,
        unknown: 0
      }
    })
  });

  assert.equal(invalid.status, "invalid");
  assert.ok(
    invalid.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "residual.runtime_owned_field" &&
        /severityCounts/.test(diagnostic.message)
    )
  );
});

test("blueprint_review_record rejects code-review models with out-of-scope finding locations", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalid = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "code-review",
    scopeFiles: ["src/feature.ts"],
    scopeSource: "explicit-files",
    model: createStructuredCodeReviewModel({
      findings: [
        {
          severity: "high",
          disposition: "follow-up",
          location: "tests/feature.test.ts:1",
          evidence: "The test file is outside the explicit review scope.",
          impact: "The review could claim coverage beyond the confirmed scope.",
          recommendation: "Keep finding citations inside the resolved scope files."
        }
      ]
    })
  });

  assert.equal(invalid.status, "invalid");
  assert.match(
    invalid.warnings.join("\n"),
    /must match pattern|outside the resolved review scope/i
  );
});

test("blueprint_review_validate_model rejects one-past-EOF citations on trailing-newline files", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalid = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    model: createStructuredCodeReviewModel({
      findings: [
        {
          severity: "high",
          disposition: "follow-up",
          location: "src/feature.ts:4",
          evidence: "The feature fixture has three real lines and a terminal newline.",
          impact: "A phantom fourth line would allow citations that do not exist.",
          recommendation: "Reject one-past-EOF locations when the file only ends with a normal trailing newline."
        }
      ]
    })
  });

  assert.equal(invalid.status, "invalid");
  assert.ok(
    invalid.diagnostics.some((diagnostic) => diagnostic.code === "residual.line_range_missing")
  );
});

test("blueprint_review_validate_model rejects blocked reviews that route to progress", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalid = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    model: createStructuredCodeReviewModel({
      verdict: "BLOCKED",
      findings: [
        {
          severity: "high",
          disposition: "blocked",
          location: "src/feature.ts:1",
          evidence: "The review cannot verify the changed behavior from the available scope.",
          impact: "Shipping would rely on unverified behavior.",
          recommendation: "Repair or validate the blocked review evidence before proceeding."
        }
      ],
      followUps: ["Repair the blocked review evidence before proceeding."],
      nextSafeAction: "/blu-progress"
    })
  });

  assert.equal(invalid.status, "invalid");
  assert.ok(
    invalid.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "residual.next_action_contradiction" &&
        /blocked findings or a BLOCKED verdict/i.test(diagnostic.message)
    )
  );
});

test("blueprint_review_validate_model rejects next actions outside the narrowed allowed list", async (t) => {
  const repoPath = await createCodeReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalid = await blueprintReviewValidateModel({
    cwd: repoPath,
    phase: "5",
    files: ["src/feature.ts", "tests/feature.test.ts"],
    model: createStructuredCodeReviewModel({
      nextSafeAction: "/blu-do 5"
    })
  });

  assert.equal(invalid.status, "invalid");
  assert.match(
    invalid.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /allowed values|must be equal to one of/i
  );
});

test("blueprint_review_scope does not use live git drift when saved summary and plan evidence are missing", async (t) => {
  const repoPath = await createCodeReviewRepo({
    withPlan: false,
    withSummary: false
  });

  await writeFile(
    path.join(repoPath, "src/git-fallback.ts"),
    "export const gitFallback = 1;\n",
    "utf8"
  );
  await rm(path.join(repoPath, ".git"), { force: true, recursive: true });
  await execFileAsync("git", ["init"], { cwd: repoPath });
  await execFileAsync("git", ["config", "user.email", "codex@example.com"], { cwd: repoPath });
  await execFileAsync("git", ["config", "user.name", "Codex"], { cwd: repoPath });
  await execFileAsync("git", ["add", "."], { cwd: repoPath });
  await execFileAsync("git", ["commit", "-m", "baseline"], { cwd: repoPath });
  await writeFile(
    path.join(repoPath, "src/git-fallback.ts"),
    "export const gitFallback = 2;\n",
    "utf8"
  );

  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const scoped = await blueprintReviewScope({
    cwd: repoPath,
    phase: "5"
  });

  const warnings = scoped.warnings.join("\n");
  assert.equal(scoped.status, "invalid");
  assert.deepEqual(scoped.files, []);
  assert.equal(scoped.reviewMode.source, "phase-plans");
  assert.match(scoped.reason ?? "", /saved SUMMARY and PLAN artifacts were missing/i);
  assert.match(warnings, /No saved SUMMARY artifacts were found/i);
  assert.match(warnings, /No saved PLAN artifacts were found/i);
  assert.doesNotMatch(warnings, /git diff fallback/i);
});

test("blueprint_review_scope reports invalid when no executed evidence or explicit files exist", async (t) => {
  const repoPath = await createCodeReviewRepo({
    withPlan: false,
    withSummary: false
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const scoped = await blueprintReviewScope({
    cwd: repoPath,
    phase: "5"
  });

  assert.equal(scoped.status, "invalid");
  assert.equal(scoped.files.length, 0);
  assert.match(scoped.reason ?? "", /saved SUMMARY and PLAN artifacts were missing/i);
  assert.match(scoped.warnings.join("\n"), /No saved SUMMARY artifacts were found/i);
  assert.match(scoped.warnings.join("\n"), /No saved PLAN artifacts were found/i);
});

test("code-review is exposed as an implemented review command with the scope tool and reviewer agent", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["code-review"];

  assert.ok(blueprintToolNames.includes("blueprint_review_scope"));
  assert.ok(blueprintToolNames.includes("blueprint_review_validate_model"));
  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.manifestPath, "commands/blu-code-review.toml");
  assert.deepEqual(entry.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_config_get",
    "blueprint_artifact_contract_read",
    "blueprint_review_scope",
    "blueprint_review_load_findings",
    "blueprint_review_validate_model",
    "blueprint_review_record",
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-reviewer"]);
});
