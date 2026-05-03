import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  NEW_PROJECT_RUNTIME_METADATA,
  NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID
} from "../src/mcp/command-runtime-metadata.js";
import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import {
  blueprintToolNames,
  createToolResponseContent,
  executeToolHandlerWithFailureLogging,
  summarizeToolResult
} from "../src/mcp/server.js";
import {
  blueprintProjectInit,
  blueprintProjectStatus,
  projectToolDefinitions
} from "../src/mcp/tools/project.js";
import {
  CODEBASE_ARTIFACTS,
  blueprintArtifactContractRead,
  blueprintArtifactValidate,
  blueprintCodebaseArtifactWrite,
  type BootstrapSeed
} from "../src/mcp/tools/artifacts.js";
import { blueprintConfigGet, blueprintConfigSet } from "../src/mcp/tools/config.js";
import { blueprintStateUpdate } from "../src/mcp/tools/state.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

const repoRoot = process.cwd();
const fixtureRoot = path.join(repoRoot, "tests/fixtures/new-project");

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function createRepoFromFixture(fixtureName: string): Promise<string> {
  const repoPath = await createGitRepo("blueprint-new-project-");

  const sourcePath = path.join(fixtureRoot, fixtureName);

  if (await pathExists(sourcePath)) {
    await cpFixtureContents(sourcePath, repoPath);
  }

  return repoPath;
}

async function cpFixtureContents(sourcePath: string, targetPath: string): Promise<void> {
  const { readdir, stat, copyFile, mkdir: makeDir } = await import("node:fs/promises");
  const entries = await readdir(sourcePath, { withFileTypes: true });

  for (const entry of entries) {
    const sourceEntry = path.join(sourcePath, entry.name);
    const targetEntry = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      await makeDir(targetEntry, { recursive: true });
      await cpFixtureContents(sourceEntry, targetEntry);
      continue;
    }

    const sourceStats = await stat(sourceEntry);
    await makeDir(path.dirname(targetEntry), { recursive: true });
    await copyFile(sourceEntry, targetEntry);
    await import("node:fs/promises").then(({ chmod }) =>
      chmod(targetEntry, sourceStats.mode)
    );
  }
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function buildAutoBootstrapSeed(overrides: Partial<BootstrapSeed> = {}): BootstrapSeed {
  return {
    vision:
      "Establish the fresh repo fixture with durable Blueprint planning context for the first milestone.",
    currentMilestone: "v1",
    requirements: [
      {
        id: "RQ-01",
        scope: "committed",
        group: "Product direction",
        requirement: "Define the product outcome and first-milestone goals for the fresh repo fixture.",
        status: "Pending",
        notes: "Bootstrap draft requirement."
      },
      {
        id: "RQ-02",
        scope: "committed",
        group: "Delivery boundaries",
        requirement:
          "Record durable constraints, non-goals, and acceptance boundaries before detailed planning starts.",
        status: "Pending",
        notes: "Keeps later discovery and planning grounded."
      },
      {
        id: "RQ-03",
        scope: "deferred",
        group: "Follow-through planning",
        requirement:
          "Prepare the repo for Blueprint lifecycle commands with stable requirement and roadmap traceability.",
        status: "Pending",
        notes: "Foundation requirement for later phases."
      },
      {
        id: "RQ-04",
        scope: "out_of_scope",
        group: "Explicit bootstrap cuts",
        requirement: "Do not turn the bootstrap draft into a full implementation backlog or execution plan.",
        status: "Pending",
        notes: "Keeps v1 bootstrap narrower than later work streams."
      }
    ],
    roadmapPhases: [
      {
        phase: "1",
        title: "Discovery And Definition",
        objective:
          "Confirm product intent, user constraints, and first-milestone scope before deeper lifecycle commands run.",
        requirementIds: ["RQ-01"],
        successCriteria: [
          "PROJECT.md names the product audience, value, constraints, and first milestone.",
          "REQUIREMENTS.md records committed product-direction requirements with durable IDs."
        ]
      },
      {
        phase: "2",
        title: "Foundation Bootstrap",
        objective:
          "Turn the bootstrap draft into durable planning inputs for later execution-oriented phases.",
        requirementIds: ["RQ-02"],
        successCriteria: [
          "ROADMAP.md maps delivery-boundary requirements to concrete follow-up phases.",
          "STATE.md routes maintainers to `/blu-progress` after bootstrap validation passes."
        ]
      }
    ],
    assumptions: ["The first milestone should stay small enough to validate Blueprint's workflow on this repo."],
    ...overrides
  };
}

async function writeAuthoredCodebaseBundle(repoPath: string): Promise<void> {
  const authoredBundle = {
    "codebase.stack": `# Stack

## Purpose

- Capture the mapped repo evidence for this codebase area.

## Runtime

- Primary language or runtime: TypeScript on Node.js.
- Module system or platform: ESM package layout.
- Package manager or build entrypoint: npm scripts in package.json.

## Tooling

- Build command: npm run build.
- Test command: npm test.
- Lint or format command: No dedicated lint script is declared.

## Dependencies

- Core dependencies: local runtime modules.
- Notable dev dependencies: node:test fixtures.
- Generated or vendored tooling: none identified.

## Notes

- Evidence comes from the brownfield fixture.
`,
    "codebase.architecture": `# Architecture

## Purpose

- Capture the mapped repo evidence for this codebase area.

## Overview

- The existing repo has a package manifest and source entrypoint.
- Blueprint mapping is saved before project bootstrap.

## Boundaries

- Primary subsystems or layers: src and package metadata.
- Cross-cutting concerns or shared services: bootstrap routing.

## Flow

- Entry points and request path: package scripts and source files.
- Data flow or orchestration path: map first, bootstrap second.

## Notes

- Evidence comes from README.md and src/index.ts.
`,
    "codebase.structure": `# Structure

## Purpose

- Capture the mapped repo evidence for this codebase area.

## Directory Map

- \`src\`: implementation source files.
- \`docs\`: optional documentation when present.

## Key Files

- \`package.json\`: package metadata.
- \`src/index.ts\`: source entrypoint.

## Seams

- Important refactor or ownership seam: mapping remains separate from bootstrap artifacts.
- Additional seam or boundary: codebase docs are preserved by new-project.

## Notes

- Evidence comes from tracked fixture files.
`,
    "codebase.conventions": `# Conventions

## Purpose

- Capture the mapped repo evidence for this codebase area.

## Naming

- File, type, and module naming conventions: TypeScript source files use concise names.
- Repo-specific vocabulary or prefixes: Blueprint state stays under .blueprint.

## Module Boundaries

- Import/export or package boundary rules: source code is separated from planning artifacts.
- Directory ownership or layering rule: codebase mapping lives under .blueprint/codebase.

## Error Handling

- Error and logging pattern: no dedicated pattern is visible in the fixture.
- Retry, guard, or failure conventions: bootstrap must preserve mapped docs.

## Documentation

- Commenting or README style: README carries repo intent.
- Where durable notes should live: .blueprint/ carries Blueprint state.

## Notes

- Evidence comes from README.md and source layout.
`,
    "codebase.testing": `# Testing

## Purpose

- Capture the mapped repo evidence for this codebase area.

## Framework

- Primary test runner: node:test where tests are present.
- Assertion or mocking stack: node:assert/strict.

## Commands

- Full test command: npm test.
- Focused or watch command: no focused command is declared.

## Coverage

- Key coverage signal: mapping-first bootstrap has fixture coverage.
- Gap or limitation that still needs attention: package scripts may be minimal.

## Notes

- Evidence comes from package.json.
`,
    "codebase.integrations": `# Integrations

## Purpose

- Capture the mapped repo evidence for this codebase area.

## External Systems

- Service, provider, or backend dependency: none visible in the fixture.
- Additional external surface: package manager metadata.

## SDKs And APIs

- SDK or API surface: local TypeScript modules.
- Integration entrypoint or client wrapper: src/index.ts.

## Authentication And Secrets

- Auth flow, credentials, or secrets handling: none visible.
- Operational boundary or environment note: no secret-bearing files are part of the map.

## Notes

- Evidence comes from package.json and source files.
`,
    "codebase.concerns": `# Concerns

## Purpose

- Capture the mapped repo evidence for this codebase area.

## Risks

- Current risk that could slow mapping or delivery: bootstrap could overwrite mapping docs if not guarded.
- Additional risk or unknown: partial mapping bundles need a recovery route.

## Gaps

- Thin area, missing evidence, or unknown: deeper architecture evidence is limited.
- Follow-up evidence still needed: project bootstrap seed should add product context.

## Follow-Ups

- Next concrete follow-up: run /blu-new-project with an explicit bootstrap seed.
- Later revisit item: refine roadmap once codebase evidence and product intent are both present.

## Questions

- Open question that still needs an answer: which milestone should own the first implementation change?
- Additional question or assumption to verify: whether package scripts need expansion.

## Notes

- Map-first state should stay healthy before bootstrap.
`
  } as const;

  for (const [artifactId, content] of Object.entries(authoredBundle)) {
    const result = await blueprintCodebaseArtifactWrite({
      cwd: repoPath,
      artifactId: artifactId as keyof typeof authoredBundle,
      content
    });
    assert.notEqual(result.status, "invalid", JSON.stringify(result));
  }

  for (const artifact of CODEBASE_ARTIFACTS) {
    assert.equal(await pathExists(path.join(repoPath, artifact)), true);
  }
}

test("new-project initializes deterministic .blueprint artifacts", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintProjectInit({
    cwd: repoPath,
    bootstrapMode: "auto",
    bootstrapSeed: buildAutoBootstrapSeed()
  });
  const config = await readJsonFile<Record<string, unknown>>(
    path.join(repoPath, ".blueprint/config.json")
  );
  const projectDoc = await readFile(path.join(repoPath, ".blueprint/PROJECT.md"), "utf8");
  const requirementsDoc = await readFile(
    path.join(repoPath, ".blueprint/REQUIREMENTS.md"),
    "utf8"
  );
  const roadmapDoc = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");
  const validation = await blueprintArtifactValidate({ cwd: repoPath });

  for (const relativePath of [
    ".blueprint/PROJECT.md",
    ".blueprint/REQUIREMENTS.md",
    ".blueprint/ROADMAP.md",
    ".blueprint/STATE.md",
    ".blueprint/config.json",
    ".blueprint/phases"
  ]) {
    assert.equal(
      await pathExists(path.join(repoPath, relativePath)),
      true,
      `${relativePath} should exist`
    );
  }

  assert.deepEqual(result.createdPaths, [
    ".blueprint/PROJECT.md",
    ".blueprint/REQUIREMENTS.md",
    ".blueprint/ROADMAP.md",
    ".blueprint/phases/",
    ".blueprint/STATE.md",
    ".blueprint/config.json"
  ]);
  assert.equal(config.version, 2);
  assert.ok("workflow" in config);
  assert.ok("parallelization" in config);
  assert.ok("safety" in config);
  assert.ok("maintenance" in config);
  assert.equal("hooks" in config, false);
  assert.equal(result.brownfield.repoShape, "greenfield");
  assert.match(result.nextAction, /\/blu-progress/);
  assert.deepEqual(result.bootstrapDiagnostics.placeholderArtifacts, []);
  assert.equal(result.bootstrapDiagnostics.traceabilityWarnings.length, 0);
  assert.doesNotMatch(
    projectDoc,
    /Describe the product outcome Blueprint should help this repository reach\./
  );
  assert.doesNotMatch(
    requirementsDoc,
    /Replace this placeholder with the first real requirement\./
  );
  assert.doesNotMatch(
    roadmapDoc,
    /Replace this starter roadmap with real phase goals before execution\./
  );
  assert.match(projectDoc, /## Bootstrap Shape/);
  assert.match(projectDoc, /## Scope Posture/);
  assert.match(requirementsDoc, /\| RQ-01 \|/);
  assert.match(requirementsDoc, /## Scope Summary/);
  assert.match(requirementsDoc, /## Committed V1 Scope/);
  assert.match(requirementsDoc, /## Deferred Scope/);
  assert.match(requirementsDoc, /## Out-of-Scope Cuts/);
  assert.match(requirementsDoc, /## Traceability Notes/);
  assert.match(roadmapDoc, /Requirements: RQ-01/);
  assert.match(roadmapDoc, /Requirements: RQ-02/);
  assert.match(roadmapDoc, /Success Criteria:/);
  assert.match(
    roadmapDoc,
    /PROJECT\.md names the product audience, value, constraints, and first milestone\./
  );
  assert.match(roadmapDoc, /Roadmap confidence: ready for progress review/);
  assert.match(roadmapDoc, /Phase 1: Discovery And Definition/);
  assert.match(roadmapDoc, /Phase 2: Foundation Bootstrap/);
  assert.doesNotMatch(roadmapDoc, /Phase 1\.0:|Phase 2\.0:/);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.issues, []);
});

test("new-project host workflow path reads contracts, previews approval, initializes, refines, validates, and routes", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const initialStatus = await blueprintProjectStatus({ cwd: repoPath });
  const initialConfig = await blueprintConfigGet({ cwd: repoPath, scope: "effective" });
  const contracts = await Promise.all([
    blueprintArtifactContractRead({ artifactId: "bootstrap.project" }),
    blueprintArtifactContractRead({ artifactId: "bootstrap.requirements" }),
    blueprintArtifactContractRead({ artifactId: "bootstrap.roadmap" })
  ]);
  const bootstrapSeed = {
    vision:
      "Help platform maintainers create reviewable Blueprint project artifacts before planning implementation work.",
    currentMilestone: "v1-host-workflow",
    requirements: [
      {
        id: "HW-01",
        scope: "committed" as const,
        group: "Bootstrap flow",
        requirement:
          "Show maintainers a visible project brief and roadmap preview before persistent bootstrap writes.",
        status: "Pending",
        notes: "Approval preview requirement."
      },
      {
        id: "HW-02",
        scope: "committed" as const,
        group: "Runtime validation",
        requirement:
          "Validate the generated Blueprint artifacts before routing to the next implemented command.",
        status: "Pending",
        notes: "Post-write routing requirement."
      },
      {
        id: "HW-03",
        scope: "deferred" as const,
        group: "Future automation",
        requirement:
          "Defer automatic implementation planning until the bootstrap artifacts are accepted.",
        status: "Pending",
        notes: "Keeps this command advisory around implementation."
      }
    ],
    roadmapPhases: [
      {
        phase: "1",
        title: "Review Bootstrap Proposal",
        objective: "Render the host-visible bootstrap proposal and capture approval.",
        requirementIds: ["HW-01"],
        successCriteria: [
          "The main conversation contains a project brief with audience and first milestone.",
          "The approval preview names the roadmap phase table before initialization."
        ]
      },
      {
        phase: "2",
        title: "Validate Bootstrap Artifacts",
        objective: "Persist and validate the initialized Blueprint artifacts.",
        requirementIds: ["HW-02", "HW-03"],
        successCriteria: [
          "Artifact validation reports no bootstrap contract issues after initialization.",
          "The final status routes maintainers to `/blu-progress` for the next safe step."
        ]
      }
    ],
    assumptions: ["Host helpers are session-local and Blueprint MCP remains the state owner."]
  };
  const approvalPreview = [
    "## Project Brief",
    bootstrapSeed.vision,
    "## Roadmap Preview",
    ...bootstrapSeed.roadmapPhases.map(
      (phase) => `- Phase ${phase.phase}: ${phase.title} (${phase.requirementIds.join(", ")})`
    )
  ].join("\n");

  assert.equal(initialStatus.initialized, false);
  assert.match(initialStatus.nextAction, /\/blu-new-project/);
  assert.equal(initialConfig.provenance.layersApplied.includes("hardcoded"), true);
  assert.deepEqual(
    contracts.map((contract) => contract.artifactId),
    ["bootstrap.project", "bootstrap.requirements", "bootstrap.roadmap"]
  );
  assert.match(contracts[0].contract.authoringTemplate, /## Vision/);
  assert.match(contracts[1].contract.authoringTemplate, /## Requirements Table/);
  assert.match(contracts[2].contract.authoringTemplate, /## Requirement Coverage/);
  assert.match(approvalPreview, /## Project Brief/);
  assert.match(approvalPreview, /Phase 1: Review Bootstrap Proposal \(HW-01\)/);

  const initResult = await blueprintProjectInit({ cwd: repoPath, bootstrapSeed });
  const configRefinement = await blueprintConfigSet({
    cwd: repoPath,
    scope: "project",
    patch: {
      ux: {
        progress_mode: "stage"
      }
    }
  });
  const stateRefinement = await blueprintStateUpdate({
    cwd: repoPath,
    patch: {
      activeCommand: "/blu-new-project",
      nextAction: "/blu-progress to review the next safe Blueprint action"
    }
  });
  const validation = await blueprintArtifactValidate({ cwd: repoPath });
  const finalStatus = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(initResult.nextAction, /\/blu-progress/);
  assert.deepEqual(initResult.bootstrapDiagnostics.placeholderArtifacts, []);
  assert.deepEqual(initResult.bootstrapDiagnostics.traceabilityWarnings, []);
  assert.deepEqual(configRefinement.updatedKeys, ["ux.progress_mode"]);
  assert.ok(stateRefinement.updatedFields.includes("nextAction"));
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.issues, []);
  assert.equal(finalStatus.initialized, true);
  assert.equal(finalStatus.currentMilestone, "v1-host-workflow");
  assert.match(finalStatus.nextAction, /\/blu-progress/);
});

test("new-project fails from a nested directory with a precise repo-root error", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  const nestedPath = path.join(repoPath, "nested");
  await mkdir(nestedPath, { recursive: true });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await assert.rejects(
    blueprintProjectInit({ cwd: nestedPath }),
    /must run from the repository root/i
  );
});

test("new-project protects partial .blueprint trees from accidental overwrite", async (t) => {
  const repoPath = await createRepoFromFixture("partial-blueprint");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await assert.rejects(
    blueprintProjectInit({ cwd: repoPath }),
    /\/blu-health/i
  );
});

test("new-project interactive mode rejects missing bootstrapSeed before writes", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await assert.rejects(
    blueprintProjectInit({ cwd: repoPath }),
    /Interactive project bootstrap requires a sufficient bootstrapSeed/i
  );

  assert.equal(await pathExists(path.join(repoPath, ".blueprint")), false);
});

test("new-project interactive mode rejects insufficient bootstrapSeed before writes", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await assert.rejects(
    blueprintProjectInit({
      cwd: repoPath,
      bootstrapSeed: {
        vision: "A thin seed without durable requirements or roadmap phases.",
        currentMilestone: "v1"
      }
    }),
    /Interactive project bootstrap requires a sufficient bootstrapSeed/i
  );

  assert.equal(await pathExists(path.join(repoPath, ".blueprint")), false);
});

test("new-project auto mode rejects missing supplied or repo-derived context before writes", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  await rm(path.join(repoPath, "README.md"));
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await assert.rejects(
    blueprintProjectInit({ cwd: repoPath, bootstrapMode: "auto" }),
    /Automatic project bootstrap requires a substantive supplied or repo-derived brief/i
  );

  assert.equal(await pathExists(path.join(repoPath, ".blueprint")), false);
});

test("new-project rejects seeds with duplicate committed mappings before writes", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await assert.rejects(
    blueprintProjectInit({
      cwd: repoPath,
      bootstrapSeed: {
        vision:
          "Create a reliable project bootstrap workflow with durable requirement traceability.",
        currentMilestone: "v1",
        requirements: [
          {
            id: "PF-01",
            scope: "committed",
            group: "Traceability",
            requirement:
              "Map each committed requirement to a single roadmap phase before persistence.",
            status: "Pending",
            notes: "Duplicate mapping guard."
          }
        ],
        roadmapPhases: [
          {
            phase: "1",
            title: "First Mapping Pass",
            objective: "Map committed requirements into the first roadmap phase.",
            requirementIds: ["PF-01"],
            successCriteria: [
              "The first phase names the committed requirement selected for bootstrap.",
              "The preview shows the requirement mapping before the write starts."
            ]
          },
          {
            phase: "2",
            title: "Second Mapping Pass",
            objective: "Accidentally map the same committed requirement again.",
            requirementIds: ["PF-01"],
            successCriteria: [
              "The second phase repeats the committed requirement for regression coverage.",
              "The preflight rejects duplicate committed coverage before artifacts exist."
            ]
          }
        ]
      }
    }),
    /Committed requirement PF-01 must be mapped to exactly one roadmap phase/i
  );

  assert.equal(await pathExists(path.join(repoPath, ".blueprint")), false);
});

test("new-project can retry after a preflight failure leaves only the MCP failure log", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await assert.rejects(
    executeToolHandlerWithFailureLogging(
      {
        name: "blueprint_project_init",
        description: "fixture",
        handler: async (args: Record<string, unknown>) =>
          blueprintProjectInit(args as Parameters<typeof blueprintProjectInit>[0])
      },
      {
        cwd: repoPath,
        bootstrapSeed: {
          vision:
            "Create a reliable project bootstrap workflow with durable requirement traceability.",
          currentMilestone: "v1",
          requirements: [
            {
              id: "PF-31",
              scope: "committed",
              group: "Traceability",
              requirement:
                "Let maintainers retry project bootstrap after seed preflight failures without deleting operational logs.",
              status: "Pending",
              notes: "Retryability guard."
            }
          ],
          roadmapPhases: [
            {
              phase: "1",
              title: "First Mapping Pass",
              objective: "Map committed requirements into the first roadmap phase.",
              requirementIds: ["PF-31"],
              successCriteria: [
                "The first phase names the committed requirement selected for bootstrap.",
                "The preview shows the requirement mapping before the write starts."
              ]
            },
            {
              phase: "2",
              title: "Second Mapping Pass",
              objective: "Accidentally map the same committed requirement again.",
              requirementIds: ["PF-31"],
              successCriteria: [
                "The second phase repeats the committed requirement for regression coverage.",
                "The preflight rejects duplicate committed coverage before artifacts exist."
              ]
            }
          ]
        }
      }
    ),
    /Committed requirement PF-31 must be mapped to exactly one roadmap phase/i
  );

  const failureLogPath = path.join(repoPath, ".blueprint/mcp-write-failures.ndjson");
  const retryableStatus = await blueprintProjectStatus({ cwd: repoPath });
  const retryableValidation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(await pathExists(failureLogPath), true);
  assert.equal(retryableStatus.status, "uninitialized");
  assert.match(retryableStatus.nextAction, /\/blu-new-project/);
  assert.match(retryableValidation.suggestedRepairs.join("\n"), /\/blu-new-project/);
  assert.doesNotMatch(retryableValidation.suggestedRepairs.join("\n"), /\/blu-health/);

  const retryResult = await blueprintProjectInit({
    cwd: repoPath,
    bootstrapSeed: buildAutoBootstrapSeed()
  });
  const finalStatus = await blueprintProjectStatus({ cwd: repoPath });
  const finalValidation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(await pathExists(failureLogPath), true);
  assert.match(retryResult.nextAction, /\/blu-progress/);
  assert.equal(finalStatus.status, "initialized");
  assert.equal(finalValidation.valid, true);
});

test("new-project rejects duplicate phase refs and generic success criteria before writes", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await assert.rejects(
    blueprintProjectInit({
      cwd: repoPath,
      bootstrapSeed: {
        vision:
          "Create a reliable project bootstrap workflow with durable requirement traceability.",
        currentMilestone: "v1",
        requirements: [
          {
            id: "PF-11",
            scope: "committed",
            group: "Traceability",
            requirement:
              "Prevent duplicate phase identifiers from reaching persisted roadmap artifacts.",
            status: "Pending",
            notes: "Duplicate phase guard."
          },
          {
            id: "PF-12",
            scope: "committed",
            group: "Quality",
            requirement:
              "Require observable success criteria before bootstrap artifacts are written.",
            status: "Pending",
            notes: "Generic criterion guard."
          }
        ],
        roadmapPhases: [
          {
            phase: "1",
            title: "Preflight Quality",
            objective: "Validate roadmap quality before persistence.",
            requirementIds: ["PF-11"],
            successCriteria: [
              "Complete phase.",
              "The preflight rejects duplicate phase identifiers before artifacts exist."
            ]
          },
          {
            phase: "1.0",
            title: "Duplicate Preflight Quality",
            objective: "Duplicate the normalized first phase reference.",
            requirementIds: ["PF-12"],
            successCriteria: [
              "The duplicate phase reference is detected before roadmap persistence.",
              "The command leaves `.blueprint/` absent when preflight validation fails."
            ]
          }
        ]
      }
    }),
    /(?=.*duplicate phase reference 1\.0)(?=.*generic success criterion)/is
  );

  assert.equal(await pathExists(path.join(repoPath, ".blueprint")), false);
});

test("new-project rejects bootstrap seed roadmap gaps before writes", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await assert.rejects(
    blueprintProjectInit({
      cwd: repoPath,
      bootstrapSeed: {
        vision:
          "Create a reliable project bootstrap workflow with durable requirement traceability.",
        currentMilestone: "v1",
        requirements: [
          {
            id: "PF-21",
            scope: "committed",
            group: "Traceability",
            requirement:
              "Reject roadmap phases that omit requirement coverage or observable success criteria.",
            status: "Pending",
            notes: "Missing phase detail guard."
          }
        ],
        roadmapPhases: [
          {
            phase: "1",
            title: "Incomplete Roadmap Phase",
            objective: "Show that seed gaps are rejected before persistence."
          }
        ]
      }
    }),
    /must include explicit requirementIds[\s\S]*must include explicit successCriteria/i
  );

  assert.equal(await pathExists(path.join(repoPath, ".blueprint")), false);
});

test("new-project applies valid saved defaults and reports provenance", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  const defaultsPath = path.join(
    fixtureRoot,
    "saved-defaults/valid-defaults.json"
  );
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintProjectInit({
    cwd: repoPath,
    bootstrapMode: "auto",
    bootstrapSeed: buildAutoBootstrapSeed(),
    defaultsPath
  });
  const config = await readJsonFile<Record<string, unknown>>(
    path.join(repoPath, ".blueprint/config.json")
  );

  assert.equal(result.configProvenance.defaultsApplied, true);
  assert.equal(result.configProvenance.defaultsPath, defaultsPath);
  assert.equal(config.mode, "auto");
  assert.equal(
    (config.parallelization as Record<string, unknown>).max_concurrent_agents,
    5
  );
});

test("new-project falls back to hardcoded defaults when saved defaults are malformed", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  const defaultsPath = path.join(
    fixtureRoot,
    "saved-defaults/malformed-defaults.json"
  );
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintProjectInit({
    cwd: repoPath,
    bootstrapMode: "auto",
    bootstrapSeed: buildAutoBootstrapSeed(),
    defaultsPath
  });
  const config = await readJsonFile<Record<string, unknown>>(
    path.join(repoPath, ".blueprint/config.json")
  );

  assert.equal(result.configProvenance.defaultsApplied, false);
  assert.equal(config.mode, "interactive");
  assert.match(result.warnings.join("\n"), /falling back to hardcoded defaults/i);
});

test("project status reports initialization and a clear next action after bootstrap", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({
    cwd: repoPath,
    bootstrapMode: "auto",
    bootstrapSeed: buildAutoBootstrapSeed()
  });
  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.equal(status.initialized, true);
  assert.equal(status.currentPhase, "1");
  assert.match(status.nextAction, /\/blu-progress/);
  assert.equal(status.bootstrap.brownfieldDetected, false);
  assert.deepEqual(status.bootstrap.placeholderArtifacts, []);
});

test("new-project accepts an explicit bootstrap seed and writes traceable artifacts", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({
    cwd: repoPath,
    bootstrapSeed: {
      vision: "Ship a focused Gemini-native planning workflow for solo maintainers.",
      currentMilestone: "v2",
      requirements: [
        {
          id: "BP-01",
          scope: "committed",
          group: "Workflow",
          requirement: "Capture the solo-maintainer workflow clearly.",
          status: "Pending",
          notes: "Custom seed requirement."
        },
        {
          id: "BP-02",
          scope: "deferred",
          group: "Follow-up planning",
          requirement: "Keep roadmap phases traceable to bootstrap requirements.",
          status: "Pending",
          notes: "Custom traceability requirement."
        },
        {
          id: "BP-03",
          scope: "out_of_scope",
          group: "Explicit cuts",
          requirement: "Avoid turning bootstrap into a full execution backlog.",
          status: "Pending",
          notes: "Custom out-of-scope requirement."
        }
      ],
      roadmapPhases: [
        {
          phase: "1",
          title: "Define Workflow",
          objective: "Turn the custom bootstrap seed into a clear initial milestone.",
          requirementIds: ["BP-01", "BP-02"],
          successCriteria: [
            "The initial milestone scope is explicit and traceable.",
            "The roadmap carries the custom phase criteria into persisted output."
          ]
        }
      ],
      assumptions: ["The initial milestone should stay narrow enough for a single maintainer."]
    }
  });

  const requirementsDoc = await readFile(
    path.join(repoPath, ".blueprint/REQUIREMENTS.md"),
    "utf8"
  );
  const roadmapDoc = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");
  const projectDoc = await readFile(path.join(repoPath, ".blueprint/PROJECT.md"), "utf8");
  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(requirementsDoc, /\| BP-01 \| Capture the solo-maintainer workflow clearly\./);
  assert.match(requirementsDoc, /## Committed V1 Scope/);
  assert.match(requirementsDoc, /## Deferred Scope/);
  assert.match(requirementsDoc, /## Out-of-Scope Cuts/);
  assert.match(requirementsDoc, /### Workflow/);
  assert.match(requirementsDoc, /### Follow-up planning/);
  assert.match(requirementsDoc, /### Explicit cuts/);
  assert.match(roadmapDoc, /Phase 1: Define Workflow \(Requirements: BP-01, BP-02\)/);
  assert.match(roadmapDoc, /The initial milestone scope is explicit and traceable\./);
  assert.match(projectDoc, /## Scope Posture/);
  assert.match(projectDoc, /Committed v1: BP-01/);
  assert.match(projectDoc, /Deferred: BP-02/);
  assert.match(projectDoc, /Out-of-scope: BP-03/);
  assert.equal(status.currentMilestone, "v2");
  assert.equal(status.currentPhase, "1");
});

test("new-project accepts committed-only bootstrap seeds and keeps post-init validation green", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({
    cwd: repoPath,
    bootstrapSeed: {
      vision: "Bootstrap a lightweight planning workflow for a small maintenance repo.",
      currentMilestone: "v1",
      requirements: [
        {
          id: "BP-11",
          scope: "committed",
          group: "Core workflow",
          requirement: "Keep the first milestone focused on durable planning artifacts.",
          status: "Pending",
          notes: "Committed-only seed requirement."
        }
      ],
      roadmapPhases: [
        {
          phase: "1",
          title: "Bootstrap Core Workflow",
          objective: "Capture the initial repo direction with one committed requirement.",
          requirementIds: ["BP-11"],
          successCriteria: [
            "The committed-only requirement is visible in the roadmap.",
            "The bootstrap validation stays green after persistence."
          ]
        }
      ],
      assumptions: ["The first milestone should stay intentionally narrow."]
    }
  });

  const requirementsDoc = await readFile(
    path.join(repoPath, ".blueprint/REQUIREMENTS.md"),
    "utf8"
  );
  const roadmapDoc = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");
  const validation = await blueprintArtifactValidate({ cwd: repoPath });
  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(requirementsDoc, /## Scope Summary/);
  assert.match(requirementsDoc, /Committed v1: BP-11/);
  assert.match(requirementsDoc, /## Committed V1 Scope/);
  assert.doesNotMatch(requirementsDoc, /## Deferred Scope/);
  assert.doesNotMatch(requirementsDoc, /## Out-of-Scope Cuts/);
  assert.match(roadmapDoc, /Phase 1: Bootstrap Core Workflow \(Requirements: BP-11\)/);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.issues, []);
  assert.equal(status.initialized, true);
  assert.match(status.nextAction, /\/blu-progress/);
});

test("new-project bootstrap seed validation rejects non-durable requirement identifiers", () => {
  const projectInitDefinition = projectToolDefinitions.find(
    (definition) => definition.name === "blueprint_project_init"
  );

  assert.ok(projectInitDefinition);

  const validation = projectInitDefinition!.inputSchema.bootstrapSeed.safeParse({
    requirements: [
      {
        id: "legacy requirement",
        requirement: "Keep the first milestone focused on durable planning artifacts.",
        status: "Pending",
        notes: "Invalid seed requirement."
      }
    ]
  });

  assert.equal(validation.success, false);
  assert.match(validation.error.issues[0]?.message ?? "", /durable format like RQ-01 or BP-03/);
});

test("new-project normalizes whole-number decimal roadmap phases from bootstrap seeds", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({
    cwd: repoPath,
    bootstrapMode: "auto",
    bootstrapSeed: buildAutoBootstrapSeed({
      roadmapPhases: [
        {
          phase: "1.0",
          title: "Discovery And Definition",
          objective: "Confirm milestone intent.",
          requirementIds: ["RQ-01"],
          successCriteria: [
            "Phase one keeps the product-direction requirement traceable.",
            "Whole-number decimal phase notation is normalized in ROADMAP.md."
          ]
        },
        {
          phase: "2.0",
          title: "Foundation Bootstrap",
          objective: "Prepare planning inputs.",
          requirementIds: ["RQ-02"],
          successCriteria: [
            "Phase two keeps the delivery-boundary requirement traceable.",
            "Whole-number decimal phase notation is normalized in STATE.md."
          ]
        },
        {
          phase: "2.1",
          title: "Urgent Insert",
          objective: "Handle inserted work.",
          requirementIds: ["RQ-03"],
          successCriteria: [
            "The inserted decimal phase remains visible as a decimal phase.",
            "Deferred follow-through remains traceable without duplicating committed requirements."
          ]
        }
      ]
    })
  });

  const roadmapDoc = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");
  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(roadmapDoc, /Phase 1: Discovery And Definition/);
  assert.match(roadmapDoc, /Phase 2: Foundation Bootstrap/);
  assert.match(roadmapDoc, /Phase 2\.1: Urgent Insert/);
  assert.doesNotMatch(roadmapDoc, /Phase 1\.0:|Phase 2\.0:/);
  assert.equal(status.currentPhase, "1");
});

test("new-project hard-stops on unmapped brownfield before any writes", async (t) => {
  const repoPath = await createRepoFromFixture("brownfield-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await assert.rejects(
    blueprintProjectInit({ cwd: repoPath, bootstrapMode: "auto" }),
    /Brownfield repos must be mapped.*\/blu-map-codebase/i
  );

  const status = await blueprintProjectStatus({ cwd: repoPath });
  assert.match(status.nextAction, /\/blu-map-codebase/);
  assert.equal(status.bootstrap.brownfieldDetected, true);
  assert.equal(status.bootstrap.codebaseMapped, false);
  assert.equal(await pathExists(path.join(repoPath, ".blueprint")), false);
});

test("new-project bootstraps mapped-only brownfield and preserves codebase docs", async (t) => {
  const repoPath = await createRepoFromFixture("brownfield-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeAuthoredCodebaseBundle(repoPath);
  const beforeStack = await readFile(path.join(repoPath, ".blueprint/codebase/STACK.md"), "utf8");
  const mappedStatus = await blueprintProjectStatus({ cwd: repoPath });

  assert.equal(mappedStatus.status, "mapped-only");
  assert.match(mappedStatus.nextAction, /\/blu-new-project/);
  assert.equal(mappedStatus.bootstrap.codebaseMapped, true);

  const result = await blueprintProjectInit({
    cwd: repoPath,
    bootstrapSeed: {
      vision: "Bring the mapped brownfield fixture under Blueprint planning.",
      currentMilestone: "v1-brownfield-bootstrap",
      requirements: [
        {
          id: "BF-01",
          scope: "committed",
          group: "Bootstrap",
          requirement: "Preserve mapped codebase evidence while creating project artifacts.",
          status: "Pending",
          notes: "Map-first bootstrap requirement."
        }
      ],
      roadmapPhases: [
        {
          phase: "1",
          title: "Bootstrap From Map",
          objective: "Create core Blueprint artifacts without replacing codebase docs.",
          requirementIds: ["BF-01"],
          successCriteria: [
            "Mapped codebase evidence remains preserved after bootstrap.",
            "The brownfield bootstrap requirement is traceable in the roadmap."
          ]
        }
      ]
    }
  });
  const afterStack = await readFile(path.join(repoPath, ".blueprint/codebase/STACK.md"), "utf8");
  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.equal(result.brownfield.repoShape, "brownfield");
  assert.equal(result.brownfield.codebaseMapped, true);
  assert.equal(afterStack, beforeStack);
  assert.equal(status.status, "initialized");
  assert.match(status.nextAction, /\/blu-progress/);
});

test("new-project runtime summaries surface the live next action for fresh and brownfield repos", async (t) => {
  const freshRepoPath = await createRepoFromFixture("fresh-repo");
  const brownfieldRepoPath = await createRepoFromFixture("brownfield-repo");

  t.after(async () => {
    await rm(path.dirname(freshRepoPath), { recursive: true, force: true });
    await rm(path.dirname(brownfieldRepoPath), { recursive: true, force: true });
  });

  const freshInit = await blueprintProjectInit({
    cwd: freshRepoPath,
    bootstrapMode: "auto",
    bootstrapSeed: buildAutoBootstrapSeed()
  });
  const freshStatus = await blueprintProjectStatus({ cwd: freshRepoPath });
  await writeAuthoredCodebaseBundle(brownfieldRepoPath);
  const brownfieldInit = await blueprintProjectInit({
    cwd: brownfieldRepoPath,
    bootstrapMode: "auto",
    bootstrapSeed: {
      vision: "Bring the mapped brownfield fixture under Blueprint planning.",
      currentMilestone: "v1-brownfield-bootstrap",
      requirements: [
        {
          id: "BF-01",
          scope: "committed",
          group: "Bootstrap",
          requirement: "Preserve mapped codebase evidence while creating project artifacts.",
          status: "Pending",
          notes: "Map-first bootstrap requirement."
        }
      ],
      roadmapPhases: [
        {
          phase: "1",
          title: "Bootstrap From Map",
          objective: "Create core Blueprint artifacts without replacing codebase docs.",
          requirementIds: ["BF-01"],
          successCriteria: [
            "Mapped codebase evidence remains preserved after bootstrap.",
            "The brownfield bootstrap requirement is traceable in the roadmap."
          ]
        }
      ]
    }
  });
  const brownfieldStatus = await blueprintProjectStatus({ cwd: brownfieldRepoPath });
  const brownfieldProjectDoc = await readFile(
    path.join(brownfieldRepoPath, ".blueprint/PROJECT.md"),
    "utf8"
  );
  const brownfieldRequirementsDoc = await readFile(
    path.join(brownfieldRepoPath, ".blueprint/REQUIREMENTS.md"),
    "utf8"
  );
  const brownfieldRoadmapDoc = await readFile(
    path.join(brownfieldRepoPath, ".blueprint/ROADMAP.md"),
    "utf8"
  );

  assert.match(
    createToolResponseContent("blueprint_project_init", freshInit)[0].text,
    /\/blu-progress/
  );
  assert.match(
    createToolResponseContent("blueprint_project_status", freshStatus)[0].text,
    /\/blu-progress/
  );
  assert.match(
    createToolResponseContent("blueprint_project_init", brownfieldInit)[0].text,
    /\/blu-progress/
  );
  assert.match(
    createToolResponseContent("blueprint_project_status", brownfieldStatus)[0].text,
    /\/blu-progress/
  );
  assert.doesNotMatch(brownfieldRoadmapDoc, /Map Existing Codebase/);
  assert.doesNotMatch(brownfieldRoadmapDoc, /provisional until \/blu-map-codebase/);
  assert.doesNotMatch(
    brownfieldRequirementsDoc,
    /Map the existing codebase before later roadmap phases/i
  );
  assert.match(brownfieldProjectDoc, /saved `\.blueprint\/codebase\/` map/i);
  assert.match(brownfieldRoadmapDoc, /Roadmap confidence: ready for progress review/);
  assert.doesNotMatch(
    createToolResponseContent("blueprint_project_status", freshStatus)[0].text,
    /"nextAction"/
  );
});

test("command contract references the same Phase 1 tool names as the MCP server", async () => {
  const [commandFile, runtimeContract, skillFile, contractRef, guardrailsRef] = await Promise.all([
    readFile(path.join(repoRoot, "commands/blu-new-project.toml"), "utf8"),
    buildBlueprintCommandRuntimeContractResource("new-project"),
    readFile(path.join(repoRoot, "skills/blueprint-bootstrap/SKILL.md"), "utf8"),
    readFile(
      path.join(repoRoot, "skills/blueprint-bootstrap/references/bootstrap-runtime-contract.md"),
      "utf8"
    ),
    readFile(
      path.join(repoRoot, "skills/blueprint-bootstrap/references/runtime-guardrails.md"),
      "utf8"
    )
  ]);
  const requiredTools = [
    "blueprint_project_init",
    "blueprint_project_status",
    "blueprint_config_get",
    "blueprint_config_set",
    "blueprint_state_update",
    "blueprint_artifact_contract_read",
    "blueprint_artifact_validate"
  ];

  for (const toolName of requiredTools) {
    assert.ok(
      blueprintToolNames.includes(toolName),
      `${toolName} should be registered in the MCP server`
    );
    assert.match(`${skillFile}\n${contractRef}`, new RegExp(toolName));
  }

  assert.equal(runtimeContract.catalog.specPath, NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID);
  assert.equal(runtimeContract.spec?.path, NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID);
  assert.equal(runtimeContract.spec?.executionProfile, "long-running-mutation");
  assert.equal(runtimeContract.spec?.rootRoutable, true);
  assert.deepEqual(runtimeContract.spec?.requiredTools, [
    ...NEW_PROJECT_RUNTIME_METADATA.requiredTools
  ]);
  assert.deepEqual(runtimeContract.runtimeReference?.exactMcpDestination, requiredTools);

  assert.match(commandFile, /--auto/);
  assert.match(commandFile, /\.blueprint\/config\.json/);
  assert.doesNotMatch(commandFile, /mcp_blueprint_blueprint_/);
  assert.match(guardrailsRef, /mcp_blueprint_blueprint_project_init/);
  assert.match(guardrailsRef, /Blueprint MCP server is disconnected or undiscovered/i);
  assert.match(guardrailsRef, /Never try to invoke Blueprint MCP tools through shell/i);
  assert.match(skillFile, /Execution profile: `long-running-mutation`/);
  assert.match(contractRef, /Execution profile: `long-running-mutation`/);
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /Long-running-mutation Gemini-native bootstrap/i
  );
});

test("manifest, command files, and build output line up for installation", async () => {
  const manifest = await readJsonFile<{
    contextFileName: string;
    mcpServers: Record<string, { args?: string[] }>;
  }>(path.join(repoRoot, "gemini-extension.json"));
  const mcpArgs = manifest.mcpServers.blueprint.args ?? [];
  const mcpEntrypoint = mcpArgs[0] ?? "";

  assert.equal(manifest.contextFileName, "GEMINI.md");
  assert.equal(await pathExists(path.join(repoRoot, "commands/blu.toml")), true);
  assert.equal(
    await pathExists(path.join(repoRoot, "commands/blu-new-project.toml")),
    true
  );
  assert.match(mcpEntrypoint, /dist\/mcp\/server\.js$/);
  assert.equal(await pathExists(path.join(repoRoot, "dist/mcp/server.js")), true);
});
