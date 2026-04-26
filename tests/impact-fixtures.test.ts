import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import {
  access,
  appendFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  unlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import * as z from "zod/v4";

import { listArtifactContracts } from "../src/mcp/artifact-contracts/index.js";
import {
  blueprintImpactAnalyze,
  blueprintImpactOutputRender,
  blueprintImpactReportWrite,
  blueprintImpactScopeResolve
} from "../src/mcp/tools/impact.js";

const repoRoot = process.cwd();
const fixtureRoot = path.join(repoRoot, "tests/fixtures/impact");
const baseFixtureRoot = path.join(fixtureRoot, "base-repo");
const execFileAsync = promisify(execFileCallback);

const IMPACT_TOOL_NAMES = [
  "blueprint_impact_config_get",
  "blueprint_impact_scope_resolve",
  "blueprint_impact_context_load",
  "blueprint_impact_analyze",
  "blueprint_impact_report_write",
  "blueprint_impact_output_render"
] as const;

const requiredScenarioIds = [
  "clean-repo-no-diff",
  "staged-diff",
  "working-tree-diff",
  "commit-range",
  "base-head",
  "explicit-files",
  "diff-file",
  "description-only",
  "command-manifest-change",
  "command-doc-change",
  "mcp-tool-change",
  "artifact-contract-change",
  "skill-change",
  "agent-change",
  "runtime-reference-change",
  "extension-manifest-change",
  "hook-change",
  "docs-only-change",
  "package-config-change",
  "security-sensitive-path",
  "missing-ownership",
  "missing-dependency-graph",
  "generated-only-change",
  "generated-plus-source-change",
  "runtime-source-without-dist-coverage",
  "missing-dist-entrypoint",
  "report-write-rerun"
] as const;
const executableScopeScenarioIds = [
  "clean-repo-no-diff",
  "staged-diff",
  "working-tree-diff",
  "commit-range",
  "base-head",
  "explicit-files",
  "diff-file",
  "description-only"
] as const;
const executableSurfaceScenarioIds = [
  "command-manifest-change",
  "command-doc-change",
  "mcp-tool-change",
  "artifact-contract-change",
  "skill-change",
  "agent-change",
  "runtime-reference-change",
  "extension-manifest-change",
  "hook-change",
  "docs-only-change",
  "package-config-change",
  "security-sensitive-path",
  "missing-ownership",
  "missing-dependency-graph",
  "generated-only-change",
  "generated-plus-source-change",
  "runtime-source-without-dist-coverage",
  "missing-dist-entrypoint"
] as const;
const executableReportScenarioIds = ["report-write-rerun"] as const;
const executableScenarioIds = [
  ...executableScopeScenarioIds,
  ...executableSurfaceScenarioIds,
  ...executableReportScenarioIds
] as const;

const scenarioManifestSchema = z.object({
  schemaVersion: z.literal("blueprint.impact.fixture-scenarios.v1"),
  scenarios: z
    .array(
      z.object({
        id: z.string().min(1),
        group: z.enum(["scope", "surface", "metadata", "report"]),
        scopeMode: z.enum([
          "auto",
          "staged",
          "working-tree",
          "range",
          "base-head",
          "files",
          "diff-file",
          "description"
        ]),
        expectedScopeKind: z.string().min(1),
        writeExpectation: z.enum(["none", "write"]),
        requiresContext: z.boolean(),
        rerunExpectation: z.enum(["none", "reuse-and-overwrite-gate"]),
        requiredWarningCategories: z.array(z.string()),
        requiredUnknownCategories: z.array(z.string()),
        requiredObligationCategories: z.array(z.string())
      })
    )
    .length(requiredScenarioIds.length)
});

type ImpactAnalysis = Awaited<ReturnType<typeof blueprintImpactAnalyze>>;
type ImpactScope = Awaited<ReturnType<typeof blueprintImpactScopeResolve>>;
type ScenarioManifest = z.infer<typeof scenarioManifestSchema>;
type ImpactScenario = ScenarioManifest["scenarios"][number];

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_EMAIL: "codex@example.com",
      GIT_AUTHOR_NAME: "Codex",
      GIT_COMMITTER_EMAIL: "codex@example.com",
      GIT_COMMITTER_NAME: "Codex",
      GIT_TERMINAL_PROMPT: "0"
    }
  });

  return stdout.trim();
}

async function createFixtureRepo(): Promise<string> {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "blueprint-impact-fixture-"));

  await cp(baseFixtureRoot, repoPath, { recursive: true });
  await git(repoPath, ["init"]);
  await git(repoPath, ["branch", "-M", "main"]);
  await git(repoPath, ["config", "user.email", "codex@example.com"]);
  await git(repoPath, ["config", "user.name", "Codex"]);
  await git(repoPath, ["add", "."]);
  await git(repoPath, ["commit", "-m", "baseline fixture"]);

  return repoPath;
}

async function appendRepoFile(repoPath: string, relativePath: string, content: string): Promise<void> {
  await appendFile(path.join(repoPath, relativePath), content);
}

async function writeRepoFile(repoPath: string, relativePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(path.join(repoPath, relativePath)), { recursive: true });
  await writeFile(path.join(repoPath, relativePath), content);
}

async function mutateJsonFile(
  repoPath: string,
  relativePath: string,
  mutate: (value: Record<string, unknown>) => void
): Promise<void> {
  const filePath = path.join(repoPath, relativePath);
  const payload = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;

  mutate(payload);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

async function readScenarioManifest(): Promise<ScenarioManifest> {
  const raw = await readFile(path.join(fixtureRoot, "scenarios.json"), "utf8");

  return scenarioManifestSchema.parse(JSON.parse(raw));
}

function fixtureConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ownership: {
      sources: ["CODEOWNERS", ".blueprint/impact/ownership.json"],
      fallbackReviewers: ["@fixture/fallback"]
    },
    dependencyGraph: {
      sources: ["custom-graph", "ts-import-scan"],
      customGraphFiles: [".blueprint/impact/dependency-graph.json"]
    },
    risk: {
      blockOnSensitiveUnknownOwner: true
    },
    ...overrides
  };
}

function noOwnershipConfig(): Record<string, unknown> {
  return fixtureConfig({
    ownership: {
      sources: [],
      fallbackReviewers: []
    },
    dependencyGraph: {
      sources: []
    }
  });
}

function noDependencyGraphConfig(): Record<string, unknown> {
  return fixtureConfig({
    dependencyGraph: {
      sources: []
    }
  });
}

function contractContext(): Record<string, unknown> {
  return {
    catalog: {
      commands: {
        example: {
          declaredStatus: "implemented",
          status: "implemented",
          implemented: true,
          manifestPath: "commands/blu-example.toml",
          specPath: "docs/commands/example.md",
          skillPath: "skills/blueprint-example/SKILL.md",
          primarySkill: "blueprint-example",
          requiredTools: ["blueprint_example_tool"],
          requiredToolsSatisfied: true,
          blockedBy: []
        },
        plannedExample: {
          declaredStatus: "planned",
          status: "blocked",
          implemented: false,
          blockedBy: ["Missing command manifest: commands/blu-planned-example.toml"]
        }
      }
    },
    commandAssets: {
      nonRoutableCommands: ["plannedExample"]
    },
    runtime: {
      registeredTools: ["blueprint_example_tool", ...IMPACT_TOOL_NAMES],
      registeredImpactTools: [...IMPACT_TOOL_NAMES],
      implementationPhase: 10,
      readOnly: true
    },
    artifactContracts: listArtifactContracts()
  };
}

function surfaceFor(analysis: ImpactAnalysis, filePath: string): ImpactAnalysis["surfaces"][number] {
  const surface = analysis.surfaces.find((entry) => entry.path === filePath);

  assert.ok(surface, `${filePath} should be classified`);
  return surface;
}

function obligationCategories(analysis: ImpactAnalysis): Set<string> {
  return new Set(analysis.obligations.map((obligation) => obligation.category));
}

function unknownCategories(analysis: ImpactAnalysis): Set<string> {
  return new Set(analysis.unknowns.map((unknown) => unknown.category));
}

function findingCheckIds(analysis: ImpactAnalysis): Set<string> {
  return new Set(analysis.findings.map((finding) => finding.checkId));
}

function sortedValues(values: string[] | undefined): string[] {
  return [...(values ?? [])].sort();
}

function scenarioById(manifest: ScenarioManifest, id: string): ImpactScenario {
  const scenario = manifest.scenarios.find((entry) => entry.id === id);

  assert.ok(scenario, `Missing impact fixture scenario: ${id}`);
  return scenario;
}

function hasRequiredWarningCategory(
  category: string,
  scope: ImpactScope | null,
  analysis: ImpactAnalysis | null
): boolean {
  const warningText = [scope?.warnings.join("\n") ?? "", analysis?.warnings.join("\n") ?? ""]
    .join("\n")
    .toLowerCase();
  const checks = analysis ? findingCheckIds(analysis) : new Set<string>();

  if (category === "scope") {
    return /no staged, working-tree, branch, ci, or description scope/u.test(warningText);
  }

  if (category === "low-confidence") {
    return (
      scope?.confidence.level === "low" ||
      analysis?.confidence.level === "low" ||
      /low confidence|high-confidence pass/u.test(warningText)
    );
  }

  if (category === "dist-coverage") {
    return checks.has("build.dist-coverage") || /dist\/\*\* runtime bundle coverage/u.test(warningText);
  }

  if (category === "generated-provenance") {
    return checks.has("build.generated-provenance") || /generated dist output/u.test(warningText);
  }

  if (category === "dist-entrypoint") {
    return checks.has("build.dist-entrypoint") || /dist\/mcp\/server\.js is missing/u.test(warningText);
  }

  return warningText.includes(category.toLowerCase());
}

function assertScenarioManifestExpectations(
  scenario: ImpactScenario,
  options: {
    scope?: ImpactScope;
    analysis?: ImpactAnalysis;
    expectedObligationCategories?: string[];
    expectedUnknownCategories?: string[];
    expectedWarningCategories?: string[];
  } = {}
): void {
  assert.deepEqual(
    sortedValues(scenario.requiredObligationCategories),
    sortedValues(options.expectedObligationCategories),
    `${scenario.id} manifest/test obligation categories drifted`
  );
  assert.deepEqual(
    sortedValues(scenario.requiredUnknownCategories),
    sortedValues(options.expectedUnknownCategories),
    `${scenario.id} manifest/test unknown categories drifted`
  );
  assert.deepEqual(
    sortedValues(scenario.requiredWarningCategories),
    sortedValues(options.expectedWarningCategories),
    `${scenario.id} manifest/test warning categories drifted`
  );

  const analysis = options.analysis ?? null;
  const scope = options.scope ?? null;

  if (analysis) {
    for (const category of scenario.requiredObligationCategories) {
      assert.ok(
        obligationCategories(analysis).has(category),
        `${scenario.id} manifest requires ${category} obligation`
      );
    }

    for (const category of scenario.requiredUnknownCategories) {
      assert.ok(
        unknownCategories(analysis).has(category),
        `${scenario.id} manifest requires ${category} unknown`
      );
    }
  }

  for (const category of scenario.requiredWarningCategories) {
    assert.ok(
      hasRequiredWarningCategory(category, scope, analysis),
      `${scenario.id} manifest requires ${category} warning signal`
    );
  }
}

async function impactBundleDirs(repoPath: string): Promise<string[]> {
  const impactRoot = path.join(repoPath, ".blueprint/impact");
  const entries = await readdir(impactRoot, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory() && /^impact-[a-f0-9]{12}$/u.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

async function assertNoImpactBundles(repoPath: string): Promise<void> {
  assert.deepEqual(await impactBundleDirs(repoPath), []);
}

async function analyzeWorkingTree(
  repoPath: string,
  options: {
    config?: Record<string, unknown>;
    context?: Record<string, unknown>;
  } = {}
): Promise<{
  scope: Awaited<ReturnType<typeof blueprintImpactScopeResolve>>;
  analysis: ImpactAnalysis;
}> {
  const scope = await blueprintImpactScopeResolve({
    cwd: repoPath,
    mode: "working-tree"
  });
  const analysis = await blueprintImpactAnalyze({
    cwd: repoPath,
    scope,
    config: options.config ?? fixtureConfig(),
    ...(options.context ? { context: options.context } : {})
  });

  return { scope, analysis };
}

async function touchScenarioPath(repoPath: string, relativePath: string): Promise<void> {
  await appendRepoFile(repoPath, relativePath, `\n# impact fixture mutation: ${relativePath}\n`);
}

test("impact fixture manifest covers every Phase 10 scenario with review metadata", async () => {
  const manifest = await readScenarioManifest();
  const ids = manifest.scenarios.map((scenario) => scenario.id);

  assert.deepEqual(new Set(ids).size, ids.length, "scenario ids must be unique");
  assert.deepEqual(
    [...ids].sort(),
    [...requiredScenarioIds].sort(),
    "scenario manifest must not grow without executable fixture coverage"
  );
  assert.deepEqual(
    [...executableScenarioIds].sort(),
    [...requiredScenarioIds].sort(),
    "every required scenario id must be exercised by a fixture test case"
  );

  for (const id of requiredScenarioIds) {
    const scenario = manifest.scenarios.find((entry) => entry.id === id);

    assert.ok(scenario, `Missing impact fixture scenario: ${id}`);
    assert.ok(scenario.scopeMode.length > 0, `${id} should record scope mode`);
    assert.ok(scenario.expectedScopeKind.length > 0, `${id} should record expected scope kind`);
    assert.ok(scenario.writeExpectation.length > 0, `${id} should record write expectation`);
    assert.ok(scenario.rerunExpectation.length > 0, `${id} should record rerun expectation`);
  }

  assert.ok(
    manifest.scenarios.some((scenario) => scenario.requiresContext),
    "contract-bearing fixture scenarios should declare context injection"
  );
  assert.ok(
    manifest.scenarios.some((scenario) => scenario.rerunExpectation === "reuse-and-overwrite-gate"),
    "fixture manifest should include report rerun behavior"
  );
});

test("impact fixture scope scenarios resolve all supported repo states without writing reports", async () => {
  const manifest = await readScenarioManifest();
  const cases: Array<{
    id: string;
    expectedManifestScopeMode: ImpactScenario["scopeMode"];
    setup?: (repoPath: string) => Promise<void>;
    resolve: (repoPath: string) => Promise<Awaited<ReturnType<typeof blueprintImpactScopeResolve>>>;
    expectedStatus: "resolved" | "unresolved";
    expectedKind: string;
    expectedFiles?: string[];
  }> = [
    {
      id: "clean-repo-no-diff",
      expectedManifestScopeMode: "auto",
      resolve: (repoPath) => blueprintImpactScopeResolve({ cwd: repoPath, mode: "auto" }),
      expectedStatus: "unresolved",
      expectedKind: "unresolved"
    },
    {
      id: "staged-diff",
      expectedManifestScopeMode: "auto",
      setup: async (repoPath) => {
        await appendRepoFile(repoPath, "src/app.ts", "\nexport const staged = true;\n");
        await git(repoPath, ["add", "src/app.ts"]);
      },
      resolve: (repoPath) => blueprintImpactScopeResolve({ cwd: repoPath, mode: "auto" }),
      expectedStatus: "resolved",
      expectedKind: "staged",
      expectedFiles: ["src/app.ts"]
    },
    {
      id: "working-tree-diff",
      expectedManifestScopeMode: "auto",
      setup: (repoPath) => appendRepoFile(repoPath, "src/app.ts", "\nexport const working = true;\n"),
      resolve: (repoPath) => blueprintImpactScopeResolve({ cwd: repoPath, mode: "auto" }),
      expectedStatus: "resolved",
      expectedKind: "working-tree",
      expectedFiles: ["src/app.ts"]
    },
    {
      id: "commit-range",
      expectedManifestScopeMode: "range",
      setup: async (repoPath) => {
        await appendRepoFile(repoPath, "src/app.ts", "\nexport const ranged = true;\n");
        await git(repoPath, ["add", "src/app.ts"]);
        await git(repoPath, ["commit", "-m", "range fixture"]);
      },
      resolve: (repoPath) =>
        blueprintImpactScopeResolve({ cwd: repoPath, mode: "range", range: "HEAD^..HEAD" }),
      expectedStatus: "resolved",
      expectedKind: "range",
      expectedFiles: ["src/app.ts"]
    },
    {
      id: "base-head",
      expectedManifestScopeMode: "base-head",
      setup: async (repoPath) => {
        await appendRepoFile(repoPath, "src/app.ts", "\nexport const baseHead = true;\n");
        await git(repoPath, ["add", "src/app.ts"]);
        await git(repoPath, ["commit", "-m", "base head fixture"]);
      },
      resolve: (repoPath) =>
        blueprintImpactScopeResolve({
          cwd: repoPath,
          mode: "base-head",
          base: "HEAD^",
          head: "HEAD"
        }),
      expectedStatus: "resolved",
      expectedKind: "base-head",
      expectedFiles: ["src/app.ts"]
    },
    {
      id: "explicit-files",
      expectedManifestScopeMode: "files",
      resolve: (repoPath) =>
        blueprintImpactScopeResolve({
          cwd: repoPath,
          mode: "files",
          files: ["src/app.ts", "src/app.ts"]
        }),
      expectedStatus: "resolved",
      expectedKind: "files",
      expectedFiles: ["src/app.ts"]
    },
    {
      id: "diff-file",
      expectedManifestScopeMode: "diff-file",
      setup: (repoPath) =>
        writeRepoFile(
          repoPath,
          "change.patch",
          [
            "diff --git a/src/diff.ts b/src/diff.ts",
            "new file mode 100644",
            "index 0000000..1111111",
            "--- /dev/null",
            "+++ b/src/diff.ts",
            "@@ -0,0 +1 @@",
            "+export const diffFixture = true;"
          ].join("\n")
        ),
      resolve: (repoPath) =>
        blueprintImpactScopeResolve({
          cwd: repoPath,
          mode: "diff-file",
          diffFile: "change.patch"
        }),
      expectedStatus: "resolved",
      expectedKind: "diff-file",
      expectedFiles: ["src/diff.ts"]
    },
    {
      id: "description-only",
      expectedManifestScopeMode: "description",
      resolve: (repoPath) =>
        blueprintImpactScopeResolve({
          cwd: repoPath,
          mode: "description",
          description: "Plan checkout retry support without a proven diff"
        }),
      expectedStatus: "resolved",
      expectedKind: "description",
      expectedFiles: []
    }
  ];

  assert.deepEqual(
    cases.map((fixtureCase) => fixtureCase.id).sort(),
    [...executableScopeScenarioIds].sort(),
    "scope scenario ids must match executable scope fixture cases"
  );

  for (const fixtureCase of cases) {
    const repoPath = await createFixtureRepo();
    const scenario = scenarioById(manifest, fixtureCase.id);

    try {
      await fixtureCase.setup?.(repoPath);

      const scope = await fixtureCase.resolve(repoPath);

      assert.equal(scope.status, fixtureCase.expectedStatus, fixtureCase.id);
      assert.equal(scope.scope.kind, fixtureCase.expectedKind, fixtureCase.id);
      assert.equal(scenario.scopeMode, fixtureCase.expectedManifestScopeMode, fixtureCase.id);
      assert.equal(scenario.expectedScopeKind, fixtureCase.expectedKind, fixtureCase.id);
      assert.equal(scenario.requiresContext, false, `${fixtureCase.id} should not require context`);
      assert.equal(scenario.writeExpectation, "none", `${fixtureCase.id} should not write`);
      assert.equal(scenario.rerunExpectation, "none", `${fixtureCase.id} should not rerun`);

      if (fixtureCase.expectedFiles) {
        assert.deepEqual(scope.changedFiles, fixtureCase.expectedFiles, fixtureCase.id);
      }

      if (fixtureCase.id === "clean-repo-no-diff") {
        assert.match(scope.warnings.join("\n"), /No staged, working-tree, branch, CI, or description scope/);
      }

      if (fixtureCase.id === "description-only") {
        const analysis = await blueprintImpactAnalyze({
          cwd: repoPath,
          scope,
          config: fixtureConfig()
        });

        assert.equal(scope.confidence.level, "low");
        assert.match(scope.warnings.join("\n"), /cannot be marked as a high-confidence PASS/);
        assertScenarioManifestExpectations(scenario, {
          scope,
          analysis,
          expectedUnknownCategories: ["scope"],
          expectedWarningCategories: ["low-confidence"]
        });
      } else if (fixtureCase.id === "clean-repo-no-diff") {
        assertScenarioManifestExpectations(scenario, {
          scope,
          expectedWarningCategories: ["scope"]
        });
      } else {
        assertScenarioManifestExpectations(scenario, { scope });
      }

      await assertNoImpactBundles(repoPath);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  }
});

test("impact fixture surface scenarios produce expected obligations, context coverage, and no false safety", async () => {
  const manifest = await readScenarioManifest();
  const cases: Array<{
    id: string;
    mutate: (repoPath: string) => Promise<void>;
    expectedFiles: string[];
    expectedSurfaces: Array<[string, string]>;
    expectedStatus?: "PASS" | "WARN" | "BLOCK";
    expectedObligationCategories?: string[];
    expectedUnknownCategories?: string[];
    expectedWarningCategories?: string[];
    expectedFindings?: string[];
    config?: Record<string, unknown>;
    context?: Record<string, unknown>;
  }> = [
    {
      id: "command-manifest-change",
      mutate: (repoPath) => touchScenarioPath(repoPath, "commands/blu-example.toml"),
      expectedFiles: ["commands/blu-example.toml"],
      expectedSurfaces: [["commands/blu-example.toml", "command-manifest"]],
      expectedObligationCategories: ["contract-review", "docs", "tests"],
      context: contractContext()
    },
    {
      id: "command-doc-change",
      mutate: (repoPath) => touchScenarioPath(repoPath, "docs/commands/example.md"),
      expectedFiles: ["docs/commands/example.md"],
      expectedSurfaces: [["docs/commands/example.md", "command-doc"]],
      expectedObligationCategories: ["contract-review", "docs", "tests"],
      context: contractContext()
    },
    {
      id: "mcp-tool-change",
      mutate: (repoPath) => appendRepoFile(repoPath, "src/mcp/tools/example.ts", "\nexport const changed = true;\n"),
      expectedFiles: ["src/mcp/tools/example.ts"],
      expectedSurfaces: [["src/mcp/tools/example.ts", "mcp-tool"]],
      expectedObligationCategories: ["build", "docs", "tests"],
      expectedUnknownCategories: ["obligation"],
      expectedWarningCategories: ["dist-coverage"],
      expectedFindings: ["build.dist-coverage"],
      context: contractContext()
    },
    {
      id: "artifact-contract-change",
      mutate: (repoPath) =>
        appendRepoFile(
          repoPath,
          "src/mcp/artifact-contracts/index.ts",
          "\nexport const fixtureContractMutation = true;\n"
        ),
      expectedFiles: ["src/mcp/artifact-contracts/index.ts"],
      expectedSurfaces: [["src/mcp/artifact-contracts/index.ts", "artifact-contract"]],
      expectedObligationCategories: ["docs", "migration", "tests"],
      expectedUnknownCategories: ["obligation"],
      expectedWarningCategories: ["dist-coverage"],
      expectedFindings: ["build.dist-coverage"],
      context: contractContext()
    },
    {
      id: "skill-change",
      mutate: (repoPath) => touchScenarioPath(repoPath, "skills/blueprint-example/SKILL.md"),
      expectedFiles: ["skills/blueprint-example/SKILL.md"],
      expectedSurfaces: [["skills/blueprint-example/SKILL.md", "skill"]],
      expectedObligationCategories: ["contract-review", "tests"]
    },
    {
      id: "agent-change",
      mutate: (repoPath) => touchScenarioPath(repoPath, "agents/blueprint-reviewer.md"),
      expectedFiles: ["agents/blueprint-reviewer.md"],
      expectedSurfaces: [["agents/blueprint-reviewer.md", "agent"]],
      expectedObligationCategories: ["contract-review", "tests"]
    },
    {
      id: "runtime-reference-change",
      mutate: (repoPath) => touchScenarioPath(repoPath, "docs/RUNTIME-REFERENCE.md"),
      expectedFiles: ["docs/RUNTIME-REFERENCE.md"],
      expectedSurfaces: [["docs/RUNTIME-REFERENCE.md", "runtime-reference"]],
      expectedObligationCategories: ["contract-review", "docs", "tests"],
      context: contractContext()
    },
    {
      id: "extension-manifest-change",
      mutate: (repoPath) =>
        mutateJsonFile(repoPath, "gemini-extension.json", (payload) => {
          payload.description = "changed by impact fixture";
        }),
      expectedFiles: ["gemini-extension.json"],
      expectedSurfaces: [["gemini-extension.json", "extension-manifest"]],
      expectedObligationCategories: ["build", "deployment"],
      expectedUnknownCategories: ["obligation"],
      expectedWarningCategories: ["dist-coverage"],
      expectedFindings: ["build.dist-coverage"],
      context: contractContext()
    },
    {
      id: "hook-change",
      mutate: (repoPath) =>
        mutateJsonFile(repoPath, "hooks/hooks.json", (payload) => {
          payload.fixtureMutation = "hook-change";
        }),
      expectedFiles: ["hooks/hooks.json"],
      expectedSurfaces: [["hooks/hooks.json", "hook"]],
      expectedObligationCategories: ["deployment", "release", "security", "tests"],
      expectedUnknownCategories: ["obligation"],
      expectedWarningCategories: ["dist-coverage"],
      expectedFindings: ["build.dist-coverage"]
    },
    {
      id: "docs-only-change",
      mutate: (repoPath) => touchScenarioPath(repoPath, "docs/overview.md"),
      expectedFiles: ["docs/overview.md"],
      expectedSurfaces: [["docs/overview.md", "docs"]],
      expectedStatus: "PASS",
      expectedObligationCategories: []
    },
    {
      id: "package-config-change",
      mutate: async (repoPath) => {
        await mutateJsonFile(repoPath, "package.json", (payload) => {
          payload.packageManager = "npm@fixture";
        });
        await mutateJsonFile(repoPath, "config/app.json", (payload) => {
          payload.retries = 3;
        });
      },
      expectedFiles: ["config/app.json", "package.json"],
      expectedSurfaces: [
        ["config/app.json", "config"],
        ["package.json", "package-runtime"]
      ],
      expectedObligationCategories: ["deployment", "release", "security", "tests"]
    },
    {
      id: "security-sensitive-path",
      mutate: (repoPath) => writeRepoFile(repoPath, "secrets/prod.placeholder", "placeholder only\n"),
      expectedFiles: ["secrets/prod.placeholder"],
      expectedSurfaces: [["secrets/prod.placeholder", "secret-sensitive"]],
      expectedStatus: "BLOCK",
      expectedObligationCategories: ["deployment", "release", "security", "tests"],
      expectedUnknownCategories: ["ownership"],
      expectedFindings: ["ownership.sensitive-owner"],
      config: noOwnershipConfig()
    },
    {
      id: "missing-ownership",
      mutate: (repoPath) => appendRepoFile(repoPath, "src/app.ts", "\nexport const ownerGap = true;\n"),
      expectedFiles: ["src/app.ts"],
      expectedSurfaces: [["src/app.ts", "source"]],
      expectedStatus: "WARN",
      expectedUnknownCategories: ["ownership"],
      config: noOwnershipConfig()
    },
    {
      id: "missing-dependency-graph",
      mutate: (repoPath) => appendRepoFile(repoPath, "src/app.ts", "\nexport const graphGap = true;\n"),
      expectedFiles: ["src/app.ts"],
      expectedSurfaces: [["src/app.ts", "source"]],
      expectedStatus: "WARN",
      expectedUnknownCategories: ["dependency"],
      config: noDependencyGraphConfig()
    },
    {
      id: "generated-only-change",
      mutate: (repoPath) => appendRepoFile(repoPath, "dist/mcp/server.js", "\nexport const generatedOnly = true;\n"),
      expectedFiles: ["dist/mcp/server.js"],
      expectedSurfaces: [["dist/mcp/server.js", "generated"]],
      expectedObligationCategories: ["build"],
      expectedUnknownCategories: ["obligation"],
      expectedWarningCategories: ["generated-provenance"],
      expectedFindings: ["build.generated-provenance"]
    },
    {
      id: "generated-plus-source-change",
      mutate: async (repoPath) => {
        await appendRepoFile(repoPath, "dist/mcp/server.js", "\nexport const generatedMixed = true;\n");
        await appendRepoFile(repoPath, "src/app.ts", "\nexport const generatedSource = true;\n");
      },
      expectedFiles: ["dist/mcp/server.js", "src/app.ts"],
      expectedSurfaces: [
        ["dist/mcp/server.js", "generated"],
        ["src/app.ts", "source"]
      ],
      expectedObligationCategories: ["build"],
      expectedUnknownCategories: ["dependency"],
      config: noDependencyGraphConfig()
    },
    {
      id: "runtime-source-without-dist-coverage",
      mutate: (repoPath) =>
        appendRepoFile(repoPath, "src/mcp/tools/example.ts", "\nexport const missingDistCoverage = true;\n"),
      expectedFiles: ["src/mcp/tools/example.ts"],
      expectedSurfaces: [["src/mcp/tools/example.ts", "mcp-tool"]],
      expectedObligationCategories: ["build", "docs", "tests"],
      expectedUnknownCategories: ["obligation"],
      expectedWarningCategories: ["dist-coverage"],
      expectedFindings: ["build.dist-coverage"],
      context: contractContext()
    },
    {
      id: "missing-dist-entrypoint",
      mutate: async (repoPath) => {
        await unlink(path.join(repoPath, "dist/mcp/server.js"));
        await mutateJsonFile(repoPath, "gemini-extension.json", (payload) => {
          payload.description = "entrypoint removed fixture";
        });
      },
      expectedFiles: ["dist/mcp/server.js", "gemini-extension.json"],
      expectedSurfaces: [
        ["dist/mcp/server.js", "generated"],
        ["gemini-extension.json", "extension-manifest"]
      ],
      expectedStatus: "BLOCK",
      expectedObligationCategories: ["build", "deployment"],
      expectedWarningCategories: ["dist-entrypoint"],
      expectedFindings: ["build.dist-entrypoint"],
      context: contractContext()
    }
  ];

  assert.deepEqual(
    cases.map((fixtureCase) => fixtureCase.id).sort(),
    [...executableSurfaceScenarioIds].sort(),
    "surface scenario ids must match executable surface fixture cases"
  );

  for (const fixtureCase of cases) {
    const repoPath = await createFixtureRepo();
    const scenario = scenarioById(manifest, fixtureCase.id);

    try {
      await fixtureCase.mutate(repoPath);

      const { scope, analysis } = await analyzeWorkingTree(repoPath, {
        config: fixtureCase.config,
        context: fixtureCase.context
      });

      assert.equal(scope.status, "resolved", fixtureCase.id);
      assert.equal(scope.scope.kind, "working-tree", fixtureCase.id);
      assert.deepEqual(scope.changedFiles, fixtureCase.expectedFiles, fixtureCase.id);
      assert.equal(scenario.scopeMode, "working-tree", fixtureCase.id);
      assert.equal(scenario.expectedScopeKind, "working-tree", fixtureCase.id);
      assert.equal(
        scenario.requiresContext,
        fixtureCase.context !== undefined,
        `${fixtureCase.id} manifest context flag drifted`
      );
      assert.equal(scenario.writeExpectation, "none", `${fixtureCase.id} should not write`);
      assert.equal(scenario.rerunExpectation, "none", `${fixtureCase.id} should not rerun`);
      assertScenarioManifestExpectations(scenario, {
        scope,
        analysis,
        expectedObligationCategories: fixtureCase.expectedObligationCategories,
        expectedUnknownCategories: fixtureCase.expectedUnknownCategories,
        expectedWarningCategories: fixtureCase.expectedWarningCategories
      });

      for (const [filePath, expectedSurface] of fixtureCase.expectedSurfaces) {
        assert.ok(
          surfaceFor(analysis, filePath).surfaces.includes(expectedSurface as never),
          `${fixtureCase.id} should classify ${filePath} as ${expectedSurface}`
        );
      }

      if (fixtureCase.expectedStatus) {
        assert.equal(analysis.status, fixtureCase.expectedStatus, fixtureCase.id);
      }

      for (const category of fixtureCase.expectedObligationCategories ?? []) {
        assert.ok(
          obligationCategories(analysis).has(category),
          `${fixtureCase.id} should produce ${category} obligation`
        );
      }

      for (const category of fixtureCase.expectedUnknownCategories ?? []) {
        assert.ok(
          unknownCategories(analysis).has(category),
          `${fixtureCase.id} should produce ${category} unknown`
        );
      }

      for (const checkId of fixtureCase.expectedFindings ?? []) {
        assert.ok(
          findingCheckIds(analysis).has(checkId),
          `${fixtureCase.id} should produce ${checkId} finding`
        );
      }

      if (fixtureCase.context) {
        assert.doesNotMatch(
          analysis.warnings.join("\n"),
          /omitted catalog data|omitted runtime data|omitted artifactContracts/,
          `${fixtureCase.id} should use injected contract context`
        );
      }

      await assertNoImpactBundles(repoPath);
    } finally {
      await rm(repoPath, { recursive: true, force: true });
    }
  }
});

test("impact fixture report writing persists required files and proves rerun overwrite gates", async () => {
  const repoPath = await createFixtureRepo();
  const manifest = await readScenarioManifest();
  const scenario = scenarioById(manifest, "report-write-rerun");

  assert.deepEqual(
    [...executableReportScenarioIds],
    ["report-write-rerun"],
    "report scenario ids must match executable report fixture cases"
  );

  try {
    await writeRepoFile(repoPath, "secrets/prod.placeholder", "placeholder only\n");

    const { analysis } = await analyzeWorkingTree(repoPath, {
      config: noOwnershipConfig()
    });

    assert.equal(analysis.status, "BLOCK");
    assert.ok(unknownCategories(analysis).has("ownership"));
    assert.equal(scenario.scopeMode, "working-tree");
    assert.equal(scenario.expectedScopeKind, "working-tree");
    assert.equal(scenario.requiresContext, false);
    assert.equal(scenario.writeExpectation, "write");
    assert.equal(scenario.rerunExpectation, "reuse-and-overwrite-gate");
    assertScenarioManifestExpectations(scenario, {
      analysis,
      expectedObligationCategories: ["deployment", "release", "security", "tests"],
      expectedUnknownCategories: ["ownership"]
    });

    const first = await blueprintImpactReportWrite({
      cwd: repoPath,
      report: analysis.report
    });
    const reused = await blueprintImpactReportWrite({
      cwd: repoPath,
      report: analysis.report
    });
    const changedReport = {
      ...analysis.report,
      summary: `${analysis.report.summary} Fixture rerun changed summary.`
    };
    const blocked = await blueprintImpactReportWrite({
      cwd: repoPath,
      report: changedReport
    });

    assert.equal(first.status, "written");
    assert.equal(first.written, true);
    assert.equal(reused.status, "reused");
    assert.equal(reused.written, false);
    assert.equal(blocked.status, "invalid");
    assert.match(blocked.errors.join("\n"), /already exists/);
    assert.match(first.paths.impactMarkdown, /\.blueprint\/impact\/impact-[^/]+\/IMPACT\.md/);
    assert.match(first.paths.impactJson, /\.blueprint\/impact\/impact-[^/]+\/impact\.json/);
    assert.match(first.paths.summaryJson, /\.blueprint\/impact\/impact-[^/]+\/summary\.json/);
    assert.match(first.paths.evidenceJsonl ?? "", /evidence\.jsonl/);
    assert.match(first.paths.reviewChecklist ?? "", /review-checklist\.md/);
    assert.match(first.paths.questions ?? "", /QUESTIONS\.md/);

    await access(path.join(repoPath, first.paths.impactMarkdown));
    await access(path.join(repoPath, first.paths.impactJson));
    await access(path.join(repoPath, first.paths.summaryJson));
    await access(path.join(repoPath, first.paths.evidenceJsonl ?? ""));
    await access(path.join(repoPath, first.paths.reviewChecklist ?? ""));
    await access(path.join(repoPath, first.paths.questions ?? ""));

    const rendered = await blueprintImpactOutputRender({
      cwd: repoPath,
      mode: "summary",
      impactId: analysis.impactId
    });

    assert.match(rendered.content, /^BLOCK impact-/);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});
