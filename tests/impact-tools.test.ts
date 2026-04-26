import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { blueprintToolNames, blueprintToolRegistry } from "../src/mcp/server.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import {
  blueprintImpactAnalyze,
  blueprintImpactConfigGet,
  blueprintImpactContextLoad,
  blueprintImpactOutputRender,
  blueprintImpactReportWrite,
  blueprintImpactScopeResolve
} from "../src/mcp/tools/impact.js";

const repoRoot = process.cwd();
const execFileAsync = promisify(execFileCallback);

const IMPACT_TOOL_NAMES = [
  "blueprint_impact_config_get",
  "blueprint_impact_scope_resolve",
  "blueprint_impact_context_load",
  "blueprint_impact_analyze",
  "blueprint_impact_report_write",
  "blueprint_impact_output_render"
] as const;

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

async function writeRepoFile(repoPath: string, relativePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(path.join(repoPath, relativePath)), { recursive: true });
  await writeFile(path.join(repoPath, relativePath), content);
}

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "blueprint-impact-"));
}

async function createTempRepo(): Promise<string> {
  const repoPath = await createTempDir();

  await git(repoPath, ["init"]);
  await git(repoPath, ["branch", "-M", "main"]);
  await git(repoPath, ["config", "user.email", "codex@example.com"]);
  await git(repoPath, ["config", "user.name", "Codex"]);
  await writeRepoFile(repoPath, "src/app.ts", "export const value = 1;\n");
  await git(repoPath, ["add", "."]);
  await git(repoPath, ["commit", "-m", "baseline"]);

  return repoPath;
}

function surfaceFor(
  analysis: Awaited<ReturnType<typeof blueprintImpactAnalyze>>,
  filePath: string
): (typeof analysis.surfaces)[number] {
  const surface = analysis.surfaces.find((entry) => entry.path === filePath);

  assert.ok(surface, `${filePath} should have a classified surface`);
  return surface;
}

type ImpactAnalysis = Awaited<ReturnType<typeof blueprintImpactAnalyze>>;

function lowNoiseConfig(): Record<string, unknown> {
  return {
    ownership: {
      sources: [],
      fallbackReviewers: ["@reviewer"]
    },
    dependencyGraph: {
      sources: []
    }
  };
}

function minimalPhase6Context(
  commands: Record<string, Record<string, unknown>>
): Record<string, unknown> {
  return {
    catalog: {
      commands
    },
    runtime: {
      registeredTools: [
        "blueprint_command_catalog",
        "blueprint_project_status",
        ...IMPACT_TOOL_NAMES
      ]
    },
    artifactContracts: []
  };
}

function findingByCheck(analysis: ImpactAnalysis, checkId: string) {
  return analysis.findings.find((finding) => finding.checkId === checkId);
}

function obligationTitles(analysis: ImpactAnalysis): string[] {
  return analysis.obligations.map((obligation) => obligation.title);
}

function assertHasObligation(analysis: ImpactAnalysis, title: string): void {
  assert.ok(
    obligationTitles(analysis).includes(title),
    `Expected obligation title: ${title}\nActual: ${obligationTitles(analysis).join("\n")}`
  );
}

function assertEveryEvidenceRefIsNonEmpty(analysis: ImpactAnalysis): void {
  for (const finding of analysis.findings) {
    assert.ok(finding.evidenceRefs.length > 0, `${finding.id} should include evidence refs`);
  }

  for (const obligation of analysis.obligations) {
    assert.ok(obligation.evidenceRefs.length > 0, `${obligation.id} should include evidence refs`);
  }

  for (const unknown of analysis.unknowns) {
    assert.ok(unknown.evidenceRefs.length > 0, `${unknown.id} should include evidence refs`);
  }
}

test("impact MCP skeleton tools are registered and satisfy the planned command tool substrate", async () => {
  for (const toolName of IMPACT_TOOL_NAMES) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
    assert.ok(blueprintToolRegistry[toolName], `${toolName} should have a registry entry`);
  }

  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands.impact;

  assert.equal(entry.declaredStatus, "planned");
  assert.equal(entry.status, "blocked");
  assert.equal(entry.implemented, false);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.deepEqual(entry.requiredTools, [...IMPACT_TOOL_NAMES]);
  assert.match(
    entry.blockedBy.join("\n"),
    /Missing command manifest: commands\/blu-impact\.toml/
  );
  assert.match(entry.blockedBy.join("\n"), /Missing primary skill: skills\/blueprint-impact\/SKILL\.md/);
  assert.doesNotMatch(entry.blockedBy.join("\n"), /Missing required MCP tool: blueprint_impact_/);
});

test("impact input schemas accept intended shapes and reject unsafe enum/id values", () => {
  assert.equal(
    blueprintToolRegistry.blueprint_impact_scope_resolve.inputSchema.mode.safeParse("staged")
      .success,
    true
  );
  assert.equal(
    blueprintToolRegistry.blueprint_impact_scope_resolve.inputSchema.mode.safeParse("everything")
      .success,
    false
  );
  assert.equal(
    blueprintToolRegistry.blueprint_impact_report_write.inputSchema.impactId.safeParse(
      "impact-abc123"
    ).success,
    true
  );
  assert.equal(
    blueprintToolRegistry.blueprint_impact_report_write.inputSchema.impactId.safeParse(
      "../escape"
    ).success,
    false
  );
  assert.equal(
    blueprintToolRegistry.blueprint_impact_output_render.inputSchema.mode.safeParse("pr-comment")
      .success,
    true
  );
});

test("impact config get merges layers, reports provenance, and validates invalid config", async () => {
  const repoPath = await createTempRepo();

  try {
    await mkdir(path.join(repoPath, ".blueprint", "impact"), { recursive: true });
    await writeFile(
      path.join(repoPath, ".blueprint", "impact", "config.json"),
      JSON.stringify({
        baseBranches: ["trunk"],
        paths: {
          ignore: ["node_modules/**", "tmp/**"]
        },
        reporting: {
          defaultVerbosity: "detailed"
        },
        extraTopLevel: true
      })
    );
    await writeFile(
      path.join(repoPath, "impact.override.json"),
      JSON.stringify({
        risk: {
          warnBelowConfidence: 0.42
        }
      })
    );

    const config = await blueprintImpactConfigGet({
      cwd: repoPath,
      configPath: "impact.override.json",
      overrides: {
        ownership: {
          fallbackReviewers: ["@blueprint/reviewers"]
        }
      }
    });

    assert.equal(config.status, "ok");
    assert.deepEqual(config.config.baseBranches, ["trunk"]);
    assert.deepEqual(config.config.paths.ignore, ["node_modules/**", "tmp/**"]);
    assert.equal(config.config.reporting.defaultVerbosity, "detailed");
    assert.equal(config.config.risk.warnBelowConfidence, 0.42);
    assert.deepEqual(config.config.ownership.fallbackReviewers, ["@blueprint/reviewers"]);
    assert.ok(config.provenance.layersApplied.includes("project"));
    assert.ok(config.provenance.layersApplied.includes("invocation"));
    assert.ok(config.provenance.layersApplied.includes("overrides"));
    assert.equal(config.provenance.projectPath, ".blueprint/impact/config.json");
    assert.equal(config.provenance.invocationPath, "impact.override.json");
    assert.match(config.warnings.join("\n"), /Unknown impact config key.*extraTopLevel/);
    assert.equal(config.configHash.length, 12);

    const invalidConfig = await blueprintImpactConfigGet({
      cwd: repoPath,
      overrides: {
        paths: {
          ignore: ["../outside"]
        }
      }
    });

    assert.equal(invalidConfig.status, "invalid");
    assert.match(invalidConfig.errors.join("\n"), /escapes the repository/);

    const invalidSchemaConfig = await blueprintImpactConfigGet({
      cwd: repoPath,
      overrides: {
        schemaVersion: "blueprint.impact.config.v0"
      }
    });

    assert.equal(invalidSchemaConfig.status, "invalid");
    assert.match(invalidSchemaConfig.errors.join("\n"), /schemaVersion/);

    await assert.rejects(
      blueprintImpactConfigGet({
        cwd: repoPath,
        configPath: "../outside.json"
      }),
      /escapes the allowed root/
    );
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact scope resolves staged and working-tree diffs without leaking file contents", async () => {
  const stagedRepoPath = await createTempRepo();
  const workingRepoPath = await createTempRepo();

  try {
    await writeRepoFile(
      stagedRepoPath,
      "src/app.ts",
      "export const value = 'SECRET_TOKEN_SHOULD_NOT_APPEAR';\n"
    );
    await git(stagedRepoPath, ["add", "src/app.ts"]);

    const stagedScope = await blueprintImpactScopeResolve({
      cwd: stagedRepoPath,
      mode: "auto"
    });

    assert.equal(stagedScope.status, "resolved");
    assert.equal(stagedScope.scope.kind, "staged");
    assert.deepEqual(stagedScope.changedFiles, ["src/app.ts"]);
    assert.equal(stagedScope.diffStats.filesChanged, 1);
    assert.equal(stagedScope.patchHash?.length, 12);
    assert.doesNotMatch(JSON.stringify(stagedScope), /SECRET_TOKEN_SHOULD_NOT_APPEAR/);

    await writeRepoFile(workingRepoPath, "src/app.ts", "export const value = 2;\n");
    const workingScope = await blueprintImpactScopeResolve({
      cwd: workingRepoPath,
      mode: "auto"
    });

    assert.equal(workingScope.status, "resolved");
    assert.equal(workingScope.scope.kind, "working-tree");
    assert.deepEqual(workingScope.changedFiles, ["src/app.ts"]);
    assert.equal(workingScope.diffStats.filesChanged, 1);
    assert.equal(workingScope.patchHash?.length, 12);
  } finally {
    await rm(stagedRepoPath, { recursive: true, force: true });
    await rm(workingRepoPath, { recursive: true, force: true });
  }
});

test("impact scope resolves range and base-head diffs", async () => {
  const repoPath = await createTempRepo();

  try {
    await writeRepoFile(repoPath, "src/range.ts", "export const range = true;\n");
    await git(repoPath, ["add", "."]);
    await git(repoPath, ["commit", "-m", "range change"]);

    const rangeScope = await blueprintImpactScopeResolve({
      cwd: repoPath,
      mode: "range",
      range: "HEAD^..HEAD"
    });
    const autoRangeScope = await blueprintImpactScopeResolve({
      cwd: repoPath,
      range: "HEAD^..HEAD"
    });
    const baseHeadScope = await blueprintImpactScopeResolve({
      cwd: repoPath,
      mode: "base-head",
      base: "HEAD^",
      head: "HEAD"
    });

    assert.equal(rangeScope.status, "resolved");
    assert.equal(rangeScope.scope.kind, "range");
    assert.deepEqual(rangeScope.changedFiles, ["src/range.ts"]);
    assert.equal(rangeScope.git.range, "HEAD^..HEAD");
    assert.equal(autoRangeScope.status, "resolved");
    assert.equal(autoRangeScope.scope.kind, "range");
    assert.equal(autoRangeScope.git.mode, "range");
    assert.equal(baseHeadScope.status, "resolved");
    assert.equal(baseHeadScope.scope.kind, "base-head");
    assert.deepEqual(baseHeadScope.changedFiles, ["src/range.ts"]);
    assert.equal(baseHeadScope.git.base, "HEAD^");
    assert.equal(baseHeadScope.git.head, "HEAD");
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact scope resolves explicit files and rejects escaping paths", async () => {
  const repoPath = await createTempRepo();

  try {
    const filesScope = await blueprintImpactScopeResolve({
      cwd: repoPath,
      mode: "files",
      files: ["src/app.ts", "src/app.ts"]
    });

    assert.equal(filesScope.status, "resolved");
    assert.equal(filesScope.scope.kind, "files");
    assert.deepEqual(filesScope.changedFiles, ["src/app.ts"]);
    assert.equal(filesScope.confidence.level, "high");

    await assert.rejects(
      blueprintImpactScopeResolve({
        cwd: repoPath,
        mode: "files",
        files: ["../escape.ts"]
      }),
      /escapes the allowed root/
    );
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact scope resolves diff-file inputs", async () => {
  const repoPath = await createTempRepo();

  try {
    await writeRepoFile(
      repoPath,
      "change.patch",
      [
        "diff --git a/src/patch.ts b/src/patch.ts",
        "new file mode 100644",
        "index 0000000..1111111",
        "--- /dev/null",
        "+++ b/src/patch.ts",
        "@@ -0,0 +1 @@",
        "+export const patched = true;"
      ].join("\n")
    );

    const diffFileScope = await blueprintImpactScopeResolve({
      cwd: repoPath,
      mode: "diff-file",
      diffFile: "change.patch"
    });

    assert.equal(diffFileScope.status, "resolved");
    assert.equal(diffFileScope.scope.kind, "diff-file");
    assert.deepEqual(diffFileScope.changedFiles, ["src/patch.ts"]);
    assert.equal(diffFileScope.diffStats.additions, 1);
    assert.equal(diffFileScope.patchHash?.length, 12);
    assert.doesNotMatch(JSON.stringify(diffFileScope), /patched = true/);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact scope returns unresolved for clean repos and low-confidence description for non-git dirs", async () => {
  const repoPath = await createTempRepo();
  const nonGitPath = await createTempDir();

  try {
    const cleanScope = await blueprintImpactScopeResolve({
      cwd: repoPath,
      mode: "auto"
    });

    assert.equal(cleanScope.status, "unresolved");
    assert.equal(cleanScope.scope.kind, "unresolved");
    assert.equal(cleanScope.confidence.level, "low");
    assert.match(cleanScope.warnings.join("\n"), /No staged, working-tree, branch, CI, or description scope/);

    const descriptionScope = await blueprintImpactScopeResolve({
      cwd: nonGitPath,
      mode: "description",
      description: "Add checkout payment retry support"
    });

    assert.equal(descriptionScope.status, "resolved");
    assert.equal(descriptionScope.scope.kind, "description");
    assert.equal(descriptionScope.confidence.level, "low");
    assert.equal(descriptionScope.confidence.score < 0.5, true);
    assert.match(descriptionScope.warnings.join("\n"), /No git repository/);
    assert.match(descriptionScope.warnings.join("\n"), /cannot be marked as a high-confidence PASS/);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
    await rm(nonGitPath, { recursive: true, force: true });
  }
});

test("impact context load honors toggles without marking omitted optional sections partial", async () => {
  const context = await blueprintImpactContextLoad({
    cwd: repoRoot,
    includeRuntime: false,
    includeCatalog: false,
    includeArtifacts: false
  });

  assert.equal(context.status, "loaded");
  assert.equal("runtime" in context, false);
  assert.equal("catalog" in context, false);
  assert.equal("commandAssets" in context, false);
  assert.equal("artifactContracts" in context, false);
  assert.equal(context.repoHints.cwdAccepted, true);
  assert.equal(context.repoHints.artifactContractsLoaded, false);
  assert.match(context.warnings.join("\n"), /includeRuntime=false/);
  assert.match(context.warnings.join("\n"), /includeCatalog=false/);
  assert.match(context.warnings.join("\n"), /includeArtifacts=false/);
});

test("impact context load returns partial for requested target failures and malformed package metadata", async () => {
  const phaseContext = await blueprintImpactContextLoad({
    cwd: repoRoot,
    phase: "999999"
  });

  assert.equal(phaseContext.status, "partial");
  assert.match(phaseContext.warnings.join("\n"), /Requested impact phase target/);

  const repoPath = await createTempRepo();

  try {
    await writeRepoFile(repoPath, "package.json", "{not json\n");

    const malformedContext = await blueprintImpactContextLoad({
      cwd: repoPath,
      includeCatalog: false
    });

    assert.equal(malformedContext.status, "partial");
    assert.equal(malformedContext.repoHints.packageMetadataLoaded, false);
    assert.match(malformedContext.warnings.join("\n"), /Could not parse package\.json/);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact context load resolves phase and roadmapItem targets independently with deterministic dedupe", async () => {
  const repoPath = await createTempRepo();

  try {
    await writeRepoFile(
      repoPath,
      ".blueprint/ROADMAP.md",
      [
        "# Roadmap",
        "",
        "- Active milestone: v1",
        "",
        "## Phases",
        "",
        "- [ ] **Phase 2: Second Slice** - Later work",
        "- [ ] **Phase 1: First Slice** - Initial work",
        "",
        "## Phase Details",
        "",
        "### Phase 1: First Slice",
        "",
        "**Goal**: Build first slice",
        "**Requirements**: RQ-01",
        "",
        "### Phase 2: Second Slice",
        "",
        "**Goal**: Build second slice",
        "**Requirements**: RQ-02"
      ].join("\n")
    );
    await mkdir(path.join(repoPath, ".blueprint", "phases", "01-first-slice"), {
      recursive: true
    });
    await mkdir(path.join(repoPath, ".blueprint", "phases", "02-second-slice"), {
      recursive: true
    });

    const sortedContext = await blueprintImpactContextLoad({
      cwd: repoPath,
      phase: "2",
      roadmapItem: "RQ-01",
      includeCatalog: false
    });

    assert.equal(sortedContext.status, "loaded");
    assert.deepEqual(
      sortedContext.phases.map((phase) => phase.phaseNumber),
      ["1", "2"]
    );

    const dedupedContext = await blueprintImpactContextLoad({
      cwd: repoPath,
      phase: "1",
      roadmapItem: "First Slice",
      includeCatalog: false
    });

    assert.equal(dedupedContext.status, "loaded");
    assert.deepEqual(
      dedupedContext.phases.map((phase) => phase.phaseNumber),
      ["1"]
    );
    assert.deepEqual(dedupedContext.phases[0]?.requestedBy, ["phase", "roadmapItem"]);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact analyze normalizes all file input shapes with mismatch union warnings and deterministic ids", async () => {
  const normalizationConfig = {
    ...lowNoiseConfig(),
    risk: {
      blockBelowConfidenceForSensitiveAreas: 0
    }
  };
  const first = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["src/app.ts", "commands/blu-impact.toml"],
    files: ["docs/commands/impact.md"],
    config: normalizationConfig,
    scope: {
      files: ["package.json", "src/app.ts"],
      changedFiles: ["tests/impact-tools.test.ts"]
    }
  });
  const second = await blueprintImpactAnalyze({
    cwd: repoRoot,
    files: ["tests/impact-tools.test.ts", "package.json"],
    config: normalizationConfig,
    scope: {
      changedFiles: ["commands/blu-impact.toml"],
      files: ["docs/commands/impact.md", "src/app.ts"]
    }
  });

  assert.equal(first.impactStatus, "WARN");
  assert.deepEqual(
    first.surfaces.map((surface) => surface.path),
    [
      "commands/blu-impact.toml",
      "docs/commands/impact.md",
      "package.json",
      "src/app.ts",
      "tests/impact-tools.test.ts"
    ]
  );
  assert.match(first.warnings.join("\n"), /file inputs differed/);
  assert.equal(first.impactId, second.impactId);
  assert.deepEqual(first.surfaces, second.surfaces);
});

test("impact analyze classifies the surface matrix overlaps deterministically", async () => {
  const analysis = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: [
      "secrets/prod.token",
      ".env.local",
      "docs/COMMAND-CATALOG.md",
      "docs/RUNTIME-REFERENCE.md",
      "commands/blu-impact.toml",
      "docs/commands/impact.md",
      "src/mcp/server.ts",
      "src/mcp/tools/impact.ts",
      "src/mcp/command-resources.ts",
      "src/mcp/artifact-contracts/index.ts",
      "skills/blueprint-impact/SKILL.md",
      "agents/blueprint-reviewer.md",
      "gemini-extension.json",
      "hooks/hooks.json",
      "src/hooks/read-before-edit.ts",
      "tests/impact-tools.test.ts",
      "docs/MCP-TOOLS.md",
      "package.json",
      "package-lock.json",
      "tsconfig.json",
      "scripts/build.mjs",
      "dist/mcp/server.js",
      "src/generated/client.generated.ts",
      "config/app.yaml",
      "src/app.ts",
      "ROOTFILE",
      "assets/logo.png"
    ]
  });

  assert.deepEqual(surfaceFor(analysis, "secrets/prod.token").surfaces, [
    "secret-sensitive"
  ]);
  assert.deepEqual(surfaceFor(analysis, ".env.local").surfaces, [
    "env-config",
    "config",
    "repo-root"
  ]);
  assert.deepEqual(surfaceFor(analysis, "docs/COMMAND-CATALOG.md").surfaces, [
    "command-catalog",
    "docs"
  ]);
  assert.deepEqual(surfaceFor(analysis, "docs/RUNTIME-REFERENCE.md").surfaces, [
    "runtime-reference",
    "docs"
  ]);
  assert.deepEqual(surfaceFor(analysis, "commands/blu-impact.toml").surfaces, [
    "command-manifest",
    "config"
  ]);
  assert.deepEqual(surfaceFor(analysis, "docs/commands/impact.md").surfaces, [
    "command-doc",
    "docs"
  ]);
  assert.deepEqual(surfaceFor(analysis, "src/mcp/server.ts").surfaces, [
    "mcp-server",
    "source"
  ]);
  assert.deepEqual(surfaceFor(analysis, "src/mcp/tools/impact.ts").surfaces, [
    "mcp-tool",
    "source"
  ]);
  assert.deepEqual(surfaceFor(analysis, "src/mcp/command-resources.ts").surfaces, [
    "mcp-resource",
    "source"
  ]);
  assert.deepEqual(surfaceFor(analysis, "src/mcp/artifact-contracts/index.ts").surfaces, [
    "artifact-contract",
    "source"
  ]);
  assert.deepEqual(surfaceFor(analysis, "skills/blueprint-impact/SKILL.md").surfaces, [
    "skill",
    "docs"
  ]);
  assert.deepEqual(surfaceFor(analysis, "agents/blueprint-reviewer.md").surfaces, [
    "agent",
    "docs"
  ]);
  assert.deepEqual(surfaceFor(analysis, "gemini-extension.json").surfaces, [
    "extension-manifest",
    "config",
    "repo-root"
  ]);
  assert.deepEqual(surfaceFor(analysis, "hooks/hooks.json").surfaces, [
    "hook",
    "config"
  ]);
  assert.deepEqual(surfaceFor(analysis, "src/hooks/read-before-edit.ts").surfaces, [
    "hook",
    "source"
  ]);
  assert.deepEqual(surfaceFor(analysis, "tests/impact-tools.test.ts").surfaces, [
    "test"
  ]);
  assert.deepEqual(surfaceFor(analysis, "docs/MCP-TOOLS.md").surfaces, ["docs"]);
  assert.deepEqual(surfaceFor(analysis, "package.json").surfaces, [
    "package-runtime",
    "config",
    "repo-root"
  ]);
  assert.deepEqual(surfaceFor(analysis, "package-lock.json").surfaces, [
    "package-runtime",
    "config",
    "repo-root"
  ]);
  assert.deepEqual(surfaceFor(analysis, "tsconfig.json").surfaces, [
    "build-config",
    "config",
    "repo-root"
  ]);
  assert.deepEqual(surfaceFor(analysis, "scripts/build.mjs").surfaces, [
    "build-config",
    "config"
  ]);
  assert.deepEqual(surfaceFor(analysis, "dist/mcp/server.js").surfaces, ["generated"]);
  assert.deepEqual(surfaceFor(analysis, "src/generated/client.generated.ts").surfaces, [
    "generated",
    "source"
  ]);
  assert.deepEqual(surfaceFor(analysis, "config/app.yaml").surfaces, ["config"]);
  assert.deepEqual(surfaceFor(analysis, "src/app.ts").surfaces, ["source"]);
  assert.deepEqual(surfaceFor(analysis, "ROOTFILE").surfaces, ["repo-root"]);
  assert.deepEqual(surfaceFor(analysis, "assets/logo.png").surfaces, ["unknown"]);
  assert.equal(analysis.surfaceSummary[0]?.name, "secret-sensitive");
  assert.equal(analysis.areaSummary[0]?.name, "sensitive-config");
  assert.deepEqual(
    analysis.surfaces.map((surface) => surface.path),
    [...analysis.surfaces.map((surface) => surface.path)].sort()
  );
});

test("impact downstream handlers stay read-only while analysis classification is active", async () => {
  const config = await blueprintImpactConfigGet({ cwd: repoRoot });
  const scope = await blueprintImpactScopeResolve({
    cwd: repoRoot,
    mode: "description",
    description: "Add checkout payment retry support"
  });
  const analysis = await blueprintImpactAnalyze({
    cwd: repoRoot,
    scope: scope.scope,
    config: config.config
  });
  const write = await blueprintImpactReportWrite({
    cwd: repoRoot,
    impactId: "impact-abc123",
    report: analysis.report
  });

  assert.equal(config.status, "ok");
  assert.equal(config.configHash.length, 12);
  assert.equal(scope.status, "resolved");
  assert.equal(scope.scope.kind, "description");
  assert.equal(scope.confidence.level, "low");
  assert.equal(analysis.impactStatus, "WARN");
  assert.equal(analysis.phaseStatus, "scored-report-modeled");
  assert.equal(analysis.confidence.level, "low");
  assert.ok(
    analysis.unknowns.some((unknown) => unknown.id === "unknown.scope.file-backed")
  );
  assert.equal(write.status, "disabled");
  assert.equal(write.written, false);
  assert.deepEqual(write.paths, {
    impactMarkdown: null,
    impactJson: null,
    summaryJson: null,
    evidenceJsonl: null,
    reviewChecklist: null,
    questions: null
  });
  await assert.rejects(access(path.join(repoRoot, ".blueprint", "impact", "impact-abc123")));
});

test("impact analyze can produce PASS with stable normalized Phase 7 report data", async () => {
  const first = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["tests/impact-tools.test.ts"],
    config: lowNoiseConfig()
  });
  const second = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["tests/impact-tools.test.ts"],
    config: lowNoiseConfig()
  });

  assert.equal(first.status, "PASS");
  assert.equal(first.impactStatus, "PASS");
  assert.equal(first.risk.level, "low");
  assert.equal(first.confidence.level, "high");
  assert.equal(first.report.status, "PASS");
  assert.equal(first.report.impactStatus, "PASS");
  assert.equal(first.report.scoring.status, "PASS");
  assert.equal(first.report.scoring.riskLevel, "low");
  assert.deepEqual(first.report.requiredReviewers, ["@reviewer"]);
  assert.deepEqual(first.report.requiredTests, []);
  assert.deepEqual(first.report.blockingFindings, []);
  assert.deepEqual(first.report.warningFindings, []);
  assert.ok(first.report.scope.fingerprint.length > 0);
  assert.ok(
    first.evidence.some((evidence) => evidence.source === "phase-7-scoring")
  );
  assert.deepEqual(first.impactId, second.impactId);
  assert.deepEqual(first.report, second.report);
});

test("impact analyze raises WARN for obligations without conflating risk and confidence", async () => {
  const analysis = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["docs/commands/impact.md"],
    config: lowNoiseConfig(),
    context: minimalPhase6Context({})
  });

  assert.equal(analysis.status, "WARN");
  assert.notEqual(analysis.risk.level, analysis.confidence.level);
  assert.equal(analysis.report.scoring.status, "WARN");
  assert.ok(analysis.report.requiredTests.length > 0);
  assertHasObligation(analysis, "Command metadata tests must cover command contract changes");
});

test("impact analyze keeps description-only scope low-confidence and non-PASS", async () => {
  const scope = await blueprintImpactScopeResolve({
    cwd: repoRoot,
    mode: "description",
    description: "Add checkout payment retry support"
  });
  const analysis = await blueprintImpactAnalyze({
    cwd: repoRoot,
    scope: scope.scope,
    config: lowNoiseConfig()
  });

  assert.equal(scope.confidence.level, "low");
  assert.equal(analysis.status, "WARN");
  assert.equal(analysis.risk.level, "unknown");
  assert.equal(analysis.confidence.level, "low");
  assert.equal(analysis.report.scope.kind, "description");
  assert.ok(
    analysis.unknowns.some((unknown) => unknown.id === "unknown.scope.file-backed")
  );
});

test("impact analyze emits structured ownership unknowns without inventing owners", async () => {
  const repoPath = await createTempRepo();

  try {
    const analysis = await blueprintImpactAnalyze({
      cwd: repoPath,
      changedFiles: ["src/app.ts"],
      config: {
        ownership: {
          sources: [],
          fallbackReviewers: []
        },
        dependencyGraph: {
          sources: []
        }
      }
    });

    const match = analysis.ownership.matches.find((entry) => entry.path === "src/app.ts");

    assert.equal(analysis.status, "WARN");
    assert.equal(match?.ownerMissing, true);
    assert.deepEqual(match?.owners, []);
    assert.ok(analysis.unknowns.some((unknown) => unknown.id === "unknown.ownership.src-app-ts"));
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact analyze blocks sensitive missing owner when configured", async () => {
  const repoPath = await createTempRepo();

  try {
    const analysis = await blueprintImpactAnalyze({
      cwd: repoPath,
      changedFiles: ["secrets/prod.token"],
      config: {
        ownership: {
          sources: [],
          fallbackReviewers: []
        },
        dependencyGraph: {
          sources: []
        },
        risk: {
          blockOnSensitiveUnknownOwner: true
        }
      }
    });

    assert.equal(analysis.status, "BLOCK");
    assert.equal(analysis.impactStatus, "BLOCK");
    assert.equal(analysis.risk.level, "critical");
    assert.equal(analysis.confidence.level, "low");
    assert.equal(analysis.report.scoring.blocking, true);
    assert.ok(
      analysis.findings.some(
        (finding) =>
          finding.checkId === "ownership.sensitive-owner" &&
          finding.status === "BLOCK" &&
          finding.evidenceRefs.length > 0
      )
    );
    assert.ok(
      analysis.unknowns.some(
        (unknown) =>
          unknown.id === "unknown.ownership.secrets-prod-token" &&
          unknown.category === "ownership"
      )
    );
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact analyze honors configured CODEOWNERS discovery order and last matching rule", async () => {
  const repoPath = await createTempRepo();

  try {
    await writeRepoFile(repoPath, "CODEOWNERS", "src/* @root/team\n");
    await writeRepoFile(
      repoPath,
      ".github/CODEOWNERS",
      ["*.ts @first/team", "src/* @last/team # inline comment", ""].join("\n")
    );

    const analysis = await blueprintImpactAnalyze({
      cwd: repoPath,
      changedFiles: ["src/app.ts"],
      config: {
        ownership: {
          sources: [".github/CODEOWNERS", "CODEOWNERS"],
          fallbackReviewers: []
        },
        dependencyGraph: {
          sources: []
        }
      }
    });
    const match = analysis.ownership.matches.find((entry) => entry.path === "src/app.ts");

    assert.equal(analysis.ownership.codeownersPath, ".github/CODEOWNERS");
    assert.deepEqual(match?.owners, ["@last/team"]);
    assert.equal(match?.matchedRules[0]?.pattern, "src/*");
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact analyze strips CODEOWNERS inline comments from owner tokens", async () => {
  const repoPath = await createTempRepo();

  try {
    await writeRepoFile(repoPath, "CODEOWNERS", "src/* @team # comment\n");

    const analysis = await blueprintImpactAnalyze({
      cwd: repoPath,
      changedFiles: ["src/app.ts"],
      config: {
        ownership: {
          sources: ["CODEOWNERS"],
          fallbackReviewers: []
        },
        dependencyGraph: {
          sources: []
        }
      }
    });
    const match = analysis.ownership.matches.find((entry) => entry.path === "src/app.ts");

    assert.deepEqual(match?.owners, ["@team"]);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact analyze applies ownership metadata rules and fallback reviewer precedence", async () => {
  const repoPath = await createTempRepo();

  try {
    await writeRepoFile(
      repoPath,
      ".blueprint/impact/ownership.json",
      JSON.stringify({
        schemaVersion: "blueprint.impact.ownership.v1",
        rules: [
          {
            pattern: "src/owned.ts",
            owners: ["@metadata/owner"],
            sensitive: true
          }
        ],
        fallbackReviewers: ["@metadata/fallback"]
      })
    );

    const analysis = await blueprintImpactAnalyze({
      cwd: repoPath,
      changedFiles: ["src/owned.ts", "src/unmatched.ts"],
      config: {
        ownership: {
          sources: [".blueprint/impact/ownership.json"],
          fallbackReviewers: ["@config/fallback"]
        },
        dependencyGraph: {
          sources: []
        }
      }
    });
    const owned = analysis.ownership.matches.find((entry) => entry.path === "src/owned.ts");
    const unmatched = analysis.ownership.matches.find(
      (entry) => entry.path === "src/unmatched.ts"
    );

    assert.deepEqual(owned?.owners, ["@metadata/owner"]);
    assert.equal(owned?.sensitive, true);
    assert.deepEqual(unmatched?.owners, ["@config/fallback"]);
    assert.equal(unmatched?.fallbackUsed, true);
    assert.deepEqual(analysis.ownership.coverage.fallbackReviewers, ["@config/fallback"]);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact analyze handles disabled, malformed, and escaping ownership config sources", async () => {
  const repoPath = await createTempRepo();

  try {
    await writeRepoFile(repoPath, ".blueprint/impact/ownership.json", "{not json\n");

    const disabled = await blueprintImpactAnalyze({
      cwd: repoPath,
      changedFiles: ["src/app.ts"],
      config: {
        ownership: {
          sources: [],
          fallbackReviewers: []
        },
        dependencyGraph: {
          sources: []
        }
      }
    });

    assert.doesNotMatch(disabled.warnings.join("\n"), /ownership metadata/i);

    const malformed = await blueprintImpactAnalyze({
      cwd: repoPath,
      changedFiles: ["src/app.ts"],
      config: {
        ownership: {
          sources: [".blueprint/impact/ownership.json"],
          fallbackReviewers: []
        },
        dependencyGraph: {
          sources: []
        }
      }
    });

    assert.match(malformed.warnings.join("\n"), /Impact ownership metadata/);
    assert.ok(
      malformed.unknowns.some((unknown) => unknown.id.includes("unknown.ownership.metadata"))
    );

    await assert.rejects(
      blueprintImpactAnalyze({
        cwd: repoPath,
        changedFiles: ["src/app.ts"],
        config: {
          ownership: {
            sources: ["../ownership.json"],
            fallbackReviewers: []
          }
        }
      }),
      /escapes the repository|escapes the allowed root/
    );
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact analyze reports missing reverse dependency coverage without limited-impact wording", async () => {
  const repoPath = await createTempRepo();

  try {
    const analysis = await blueprintImpactAnalyze({
      cwd: repoPath,
      changedFiles: ["package.json", "src/app.ts"],
      config: {
        ownership: {
          fallbackReviewers: ["@reviewer"]
        },
        dependencyGraph: {
          sources: []
        }
      }
    });
    const serialized = JSON.stringify(analysis);

    assert.equal(analysis.dependencyGraph.coverage.status, "none");
    assert.ok(
      analysis.unknowns.some((unknown) =>
        unknown.id.startsWith("unknown.reverseDependencies.package-runtime")
      )
    );
    assert.ok(
      analysis.unknowns.some((unknown) =>
        unknown.id.startsWith("unknown.reverseDependencies.source")
      )
    );
    assert.doesNotMatch(serialized, /limited impact/i);
    assert.doesNotMatch(serialized, /limited-impact/i);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact analyze handles disabled, malformed, and escaping dependency graph sources", async () => {
  const repoPath = await createTempRepo();

  try {
    await writeRepoFile(repoPath, ".blueprint/impact/dependency-graph.json", "{not json\n");

    const disabled = await blueprintImpactAnalyze({
      cwd: repoPath,
      changedFiles: ["src/app.ts"],
      config: {
        ownership: {
          fallbackReviewers: ["@reviewer"]
        },
        dependencyGraph: {
          sources: [],
          customGraphFiles: [".blueprint/impact/dependency-graph.json"]
        }
      }
    });

    assert.doesNotMatch(disabled.warnings.join("\n"), /dependency graph/i);

    const malformed = await blueprintImpactAnalyze({
      cwd: repoPath,
      changedFiles: ["src/app.ts"],
      config: {
        ownership: {
          fallbackReviewers: ["@reviewer"]
        },
        dependencyGraph: {
          sources: ["custom-graph"],
          customGraphFiles: [".blueprint/impact/dependency-graph.json"]
        }
      }
    });

    assert.match(malformed.warnings.join("\n"), /Impact dependency graph/);
    assert.ok(
      malformed.unknowns.some((unknown) => unknown.id.includes("unknown.dependency.metadata"))
    );

    await assert.rejects(
      blueprintImpactAnalyze({
        cwd: repoPath,
        changedFiles: ["src/app.ts"],
        config: {
          dependencyGraph: {
            customGraphFiles: ["../dependency-graph.json"]
          }
        }
      }),
      /escapes the repository|escapes the allowed root/
    );
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact analyze reports partial custom graph reverse dependents and coverage gaps", async () => {
  const repoPath = await createTempRepo();

  try {
    await writeRepoFile(
      repoPath,
      ".blueprint/impact/dependency-graph.json",
      JSON.stringify({
        schemaVersion: "blueprint.impact.dependency-graph.v1",
        nodes: [
          { id: "file:src/a.ts", path: "src/a.ts" },
          { id: "file:src/b.ts", path: "src/b.ts" }
        ],
        edges: [{ from: "file:src/b.ts", to: "file:src/a.ts", type: "imports" }]
      })
    );

    const analysis = await blueprintImpactAnalyze({
      cwd: repoPath,
      changedFiles: ["src/a.ts", "src/c.ts"],
      config: {
        ownership: {
          fallbackReviewers: ["@reviewer"]
        },
        dependencyGraph: {
          sources: ["custom-graph"],
          customGraphFiles: [".blueprint/impact/dependency-graph.json"]
        }
      }
    });

    assert.equal(analysis.dependencyGraph.coverage.status, "partial");
    assert.deepEqual(analysis.dependencyGraph.reverseDependentsByPath["src/a.ts"], [
      "src/b.ts"
    ]);
    assert.ok(analysis.dependencyGraph.coverage.filesUncovered.includes("src/c.ts"));
    assert.ok(
      analysis.unknowns.some((unknown) => unknown.id === "unknown.reverseDependencies.source.src-c-ts")
    );
    assert.equal(
      analysis.unknowns.some((unknown) => unknown.id === "unknown.reverseDependencies.source.src-a-ts"),
      false
    );
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact analyze keeps reverse dependency unknowns when graph nodes have no incoming dependents", async () => {
  const repoPath = await createTempRepo();

  try {
    await writeRepoFile(
      repoPath,
      ".blueprint/impact/dependency-graph.json",
      JSON.stringify({
        schemaVersion: "blueprint.impact.dependency-graph.v1",
        nodes: [{ id: "file:src/app.ts", path: "src/app.ts" }],
        edges: []
      })
    );

    const analysis = await blueprintImpactAnalyze({
      cwd: repoPath,
      changedFiles: ["src/app.ts"],
      config: {
        ownership: {
          fallbackReviewers: ["@reviewer"]
        },
        dependencyGraph: {
          sources: ["custom-graph"],
          customGraphFiles: [".blueprint/impact/dependency-graph.json"]
        }
      }
    });

    assert.equal(analysis.dependencyGraph.coverage.status, "partial");
    assert.deepEqual(analysis.dependencyGraph.reverseDependentsByPath["src/app.ts"], []);
    assert.ok(
      analysis.dependencyGraph.coverage.gaps.includes(
        "Reverse dependency coverage is absent for src/app.ts."
      )
    );
    assert.ok(
      analysis.unknowns.some(
        (unknown) => unknown.id === "unknown.reverseDependencies.source.src-app-ts"
      )
    );
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact analyze reports high confidence when ownership and reverse dependencies are covered", async () => {
  const repoPath = await createTempRepo();

  try {
    await writeRepoFile(
      repoPath,
      ".blueprint/impact/dependency-graph.json",
      JSON.stringify({
        schemaVersion: "blueprint.impact.dependency-graph.v1",
        nodes: [
          { id: "file:src/app.ts", path: "src/app.ts" },
          { id: "file:src/consumer.ts", path: "src/consumer.ts" }
        ],
        edges: [{ from: "file:src/consumer.ts", to: "file:src/app.ts", type: "imports" }]
      })
    );

    const analysis = await blueprintImpactAnalyze({
      cwd: repoPath,
      changedFiles: ["src/app.ts"],
      config: {
        ownership: {
          fallbackReviewers: ["@reviewer"]
        },
        dependencyGraph: {
          sources: ["custom-graph"],
          customGraphFiles: [".blueprint/impact/dependency-graph.json"]
        }
      }
    });

    assert.equal(analysis.dependencyGraph.coverage.status, "complete-ish");
    assert.ok(analysis.confidence.score >= 0.8);
    assert.equal(analysis.confidence.level, "high");
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact analyze treats nested workspace src files as source for reverse coverage unknowns", async () => {
  const repoPath = await createTempRepo();

  try {
    const analysis = await blueprintImpactAnalyze({
      cwd: repoPath,
      changedFiles: ["packages/a/src/index.ts"],
      config: {
        ownership: {
          fallbackReviewers: ["@reviewer"]
        },
        dependencyGraph: {
          sources: []
        }
      }
    });

    assert.deepEqual(surfaceFor(analysis, "packages/a/src/index.ts").surfaces, [
      "source"
    ]);
    assert.ok(
      analysis.unknowns.some(
        (unknown) =>
          unknown.id === "unknown.reverseDependencies.source.packages-a-src-index-ts"
      )
    );
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact analyze detects simple workspaces and TS import reverse relationships", async () => {
  const repoPath = await createTempRepo();

  try {
    await writeRepoFile(
      repoPath,
      "package.json",
      JSON.stringify({
        name: "@repo/root",
        workspaces: ["packages/*"],
        scripts: {
          test: "node --test"
        }
      })
    );
    await writeRepoFile(
      repoPath,
      "packages/a/package.json",
      JSON.stringify({
        name: "@repo/a",
        dependencies: {
          "@repo/b": "workspace:*"
        }
      })
    );
    await writeRepoFile(
      repoPath,
      "packages/b/package.json",
      JSON.stringify({
        name: "@repo/b"
      })
    );
    await writeRepoFile(
      repoPath,
      "packages/a/src/index.ts",
      "import { value } from '@repo/b';\nexport const a = value;\n"
    );
    await writeRepoFile(repoPath, "packages/b/src/index.ts", "export const value = 1;\n");

    const analysis = await blueprintImpactAnalyze({
      cwd: repoPath,
      changedFiles: ["packages/b/src/index.ts"],
      config: {
        ownership: {
          fallbackReviewers: ["@reviewer"]
        },
        dependencyGraph: {
          sources: ["package-json", "ts-import-scan"]
        }
      }
    });

    assert.ok(analysis.dependencyGraph.nodes.some((node) => node.id === "package:@repo/a"));
    assert.ok(analysis.dependencyGraph.nodes.some((node) => node.id === "package:@repo/b"));
    assert.ok(
      analysis.dependencyGraph.edges.some(
        (edge) =>
          edge.from === "package:@repo/a" &&
          edge.to === "package:@repo/b" &&
          edge.type === "workspace-package-dependency"
      )
    );
    assert.ok(
      analysis.dependencyGraph.reverseDependentsByPath["packages/b/src/index.ts"]?.includes(
        "packages/a"
      )
    );
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact analyze resolves extensionless TS imports to existing source files", async () => {
  const repoPath = await createTempRepo();

  try {
    await writeRepoFile(
      repoPath,
      "src/a.ts",
      "import { value } from './b';\nexport const a = value;\n"
    );
    await writeRepoFile(repoPath, "src/b.ts", "export const value = 1;\n");

    const analysis = await blueprintImpactAnalyze({
      cwd: repoPath,
      changedFiles: ["src/b.ts"],
      config: {
        ownership: {
          fallbackReviewers: ["@reviewer"]
        },
        dependencyGraph: {
          sources: ["ts-import-scan"]
        }
      }
    });

    assert.ok(
      analysis.dependencyGraph.reverseDependentsByPath["src/b.ts"]?.includes("src/a.ts")
    );
    assert.equal(
      analysis.unknowns.some((unknown) => unknown.id === "unknown.reverseDependencies.source.src-b-ts"),
      false
    );
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact analyze keeps source as driver for mixed generated and source changes", async () => {
  const repoPath = await createTempRepo();

  try {
    const analysis = await blueprintImpactAnalyze({
      cwd: repoPath,
      changedFiles: ["dist/app.js", "src/app.ts"],
      config: {
        ownership: {
          fallbackReviewers: ["@reviewer"]
        },
        dependencyGraph: {
          sources: []
        }
      }
    });

    assert.deepEqual(surfaceFor(analysis, "dist/app.js").surfaces, ["generated"]);
    assert.deepEqual(surfaceFor(analysis, "src/app.ts").surfaces, ["source"]);
    assert.ok(
      analysis.unknowns.some(
        (unknown) => unknown.id === "unknown.reverseDependencies.mixed-generated-source"
      )
    );
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact analyze skips secret-like source import scanning without leaking import text", async () => {
  const repoPath = await createTempRepo();

  try {
    await writeRepoFile(
      repoPath,
      "src/secrets/api.ts",
      "import 'SECRET_IMPORT_SHOULD_NOT_APPEAR';\nexport const secret = true;\n"
    );

    const analysis = await blueprintImpactAnalyze({
      cwd: repoPath,
      changedFiles: ["src/secrets/api.ts"],
      config: {
        ownership: {
          fallbackReviewers: ["@security"]
        },
        dependencyGraph: {
          sources: ["ts-import-scan"]
        }
      }
    });
    const serialized = JSON.stringify(analysis);

    assert.ok(
      analysis.evidence.some(
        (evidence) =>
          evidence.source === "ts-import-scan" &&
          evidence.data?.skippedSecretFileCount === 1
      )
    );
    assert.doesNotMatch(serialized, /SECRET_IMPORT_SHOULD_NOT_APPEAR/);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact analyze blocks implemented command substrate gaps from injected catalog context", async () => {
  const analysis = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["docs/commands/custom-command.md"],
    config: lowNoiseConfig(),
    context: minimalPhase6Context({
      "custom-command": {
        declaredStatus: "implemented",
        status: "repairing",
        implemented: false,
        manifestPath: null,
        specPath: "docs/commands/custom-command.md",
        skillPath: null,
        primarySkill: "blueprint-custom",
        requiredTools: ["blueprint_missing_tool"],
        requiredToolsSatisfied: false,
        blockedBy: [
          "Missing command manifest: commands/blu-custom-command.toml",
          "Missing primary skill: skills/blueprint-custom/SKILL.md",
          "Missing required MCP tool: blueprint_missing_tool"
        ]
      }
    })
  });

  assert.equal(analysis.status, "BLOCK");
  assert.equal(findingByCheck(analysis, "contract.command.manifest")?.status, "BLOCK");
  assert.equal(findingByCheck(analysis, "contract.command.skill")?.status, "BLOCK");
  assert.equal(findingByCheck(analysis, "contract.command.required-tools")?.status, "BLOCK");
  const requiredToolFinding = findingByCheck(analysis, "contract.command.required-tools");
  const requiredToolEvidence = analysis.evidence.find(
    (entry) => entry.id === requiredToolFinding?.evidenceRefs[0]
  );

  assert.match(
    JSON.stringify(requiredToolEvidence),
    /Missing required MCP tool: blueprint_missing_tool/
  );
});

test("impact analyze consumes registeredImpactTools runtime context for required tool gaps", async () => {
  const analysis = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["docs/commands/custom-command.md"],
    config: lowNoiseConfig(),
    context: {
      catalog: {
        commands: {
          "custom-command": {
            declaredStatus: "implemented",
            status: "implemented",
            implemented: true,
            manifestPath: "commands/blu-custom-command.toml",
            specPath: "docs/commands/custom-command.md",
            skillPath: "skills/blueprint-custom/SKILL.md",
            primarySkill: "blueprint-custom",
            requiredTools: ["blueprint_missing_runtime_tool"],
            requiredToolsSatisfied: true,
            blockedBy: []
          }
        }
      },
      runtime: {
        registeredImpactTools: [...IMPACT_TOOL_NAMES]
      },
      artifactContracts: []
    }
  });

  const requiredToolFinding = findingByCheck(analysis, "contract.command.required-tools");
  const requiredToolEvidence = analysis.evidence.find(
    (entry) => entry.id === requiredToolFinding?.evidenceRefs[0]
  );

  assert.equal(analysis.status, "BLOCK");
  assert.equal(requiredToolFinding?.status, "BLOCK");
  assert.match(JSON.stringify(requiredToolEvidence), /blueprint_missing_runtime_tool/);
  assert.doesNotMatch(JSON.stringify(requiredToolEvidence), /Missing required MCP tool:/);
});

test("impact analyze keeps planned impact missing manifest and skill expected", async () => {
  const analysis = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["commands/blu-impact.toml"],
    config: lowNoiseConfig(),
    context: minimalPhase6Context({
      impact: {
        declaredStatus: "planned",
        status: "blocked",
        implemented: false,
        manifestPath: null,
        specPath: "docs/commands/impact.md",
        skillPath: null,
        requiredTools: [...IMPACT_TOOL_NAMES],
        requiredToolsSatisfied: true,
        blockedBy: [
          "Missing command manifest: commands/blu-impact.toml",
          "Missing primary skill: skills/blueprint-impact/SKILL.md"
        ]
      }
    })
  });

  assert.equal(analysis.status, "WARN");
  assert.equal(
    analysis.findings.some((finding) => finding.checkId.startsWith("contract.command")),
    false
  );
  assertHasObligation(analysis, "Command contract review required");
});

test("impact analyze emits explicit unknowns for omitted or malformed impact context", async () => {
  const omitted = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["commands/blu-custom.toml"],
    config: lowNoiseConfig(),
    context: {}
  });
  const malformed = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["src/mcp/artifact-contracts/index.ts", "src/mcp/tools/impact.ts"],
    config: lowNoiseConfig(),
    context: {
      catalog: {
        commands: "not an object"
      },
      runtime: "not an object",
      artifactContracts: {
        bad: true
      }
    }
  });

  assert.ok(
    omitted.unknowns.some((unknown) => unknown.id === "unknown.contract.catalog-context-missing")
  );
  assert.match(omitted.warnings.join("\n"), /omitted catalog data/);
  assert.ok(
    malformed.unknowns.some(
      (unknown) => unknown.id === "unknown.contract.runtime-context-malformed"
    )
  );
  assert.ok(
    malformed.unknowns.some(
      (unknown) => unknown.id === "unknown.contract.artifact-contract-context-malformed"
    )
  );
  assert.match(malformed.warnings.join("\n"), /context\.runtime was not an object/);
});

test("impact analyze requires runtime context for command manifest surfaces", async () => {
  const analysis = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["commands/blu-custom-command.toml"],
    config: lowNoiseConfig(),
    context: {
      catalog: {
        commands: {
          "custom-command": {
            declaredStatus: "implemented",
            status: "implemented",
            implemented: true,
            manifestPath: "commands/blu-custom-command.toml",
            specPath: "docs/commands/custom-command.md",
            skillPath: "skills/blueprint-custom/SKILL.md",
            primarySkill: "blueprint-custom",
            requiredTools: ["blueprint_custom_tool"],
            requiredToolsSatisfied: true,
            blockedBy: []
          }
        }
      },
      artifactContracts: []
    }
  });

  assert.ok(
    analysis.unknowns.some((unknown) => unknown.id === "unknown.contract.runtime-context-missing")
  );
  assert.match(analysis.warnings.join("\n"), /omitted runtime data/);
});

test("impact analyze blocks router planned-command exposure review but not benign guardrail docs", async () => {
  const context = minimalPhase6Context({
    impact: {
      declaredStatus: "planned",
      status: "blocked",
      implemented: false,
      blockedBy: ["Missing command manifest: commands/blu-impact.toml"]
    }
  });
  const router = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["commands/blu.toml"],
    config: lowNoiseConfig(),
    context
  });
  const guardrailDoc = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["docs/commands/impact.md"],
    config: lowNoiseConfig(),
    context
  });
  const rootRouterDoc = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["docs/commands/root-router.md"],
    config: lowNoiseConfig(),
    context
  });

  assert.equal(
    findingByCheck(router, "contract.planned-command-exposure")?.title,
    "planned command exposure requires review"
  );
  assert.equal(findingByCheck(router, "contract.planned-command-exposure")?.status, "BLOCK");
  assert.equal(
    findingByCheck(rootRouterDoc, "contract.planned-command-exposure")?.status,
    "BLOCK"
  );
  assert.equal(findingByCheck(guardrailDoc, "contract.planned-command-exposure"), undefined);
});

test("impact analyze creates command review, docs, and metadata-test obligations", async () => {
  const analysis = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["commands/blu-code-review.toml"],
    config: lowNoiseConfig(),
    context: minimalPhase6Context({})
  });

  assertHasObligation(analysis, "Command contract review required");
  assertHasObligation(analysis, "Command documentation and runtime reference must be reviewed");
  assertHasObligation(
    analysis,
    "Command metadata tests must cover command contract changes"
  );
});

test("impact analyze creates docs and tests obligations for runtime reference changes", async () => {
  const analysis = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["docs/RUNTIME-REFERENCE.md"],
    config: lowNoiseConfig(),
    context: minimalPhase6Context({})
  });

  assertHasObligation(analysis, "Command documentation and runtime reference must be reviewed");
  assertHasObligation(
    analysis,
    "Command metadata tests must cover command contract changes"
  );
});

test("impact analyze creates MCP docs, tests, and dist/build obligations", async () => {
  const analysis = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["src/mcp/tools/impact.ts"],
    config: lowNoiseConfig()
  });

  assertHasObligation(analysis, "MCP tool documentation must be reviewed");
  assertHasObligation(analysis, "MCP registry and contract tests must cover runtime changes");
  assertHasObligation(analysis, "Runtime source changes require generated dist review");
});

test("impact analyze creates artifact schema, tests, and migration obligations", async () => {
  const analysis = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["src/mcp/artifact-contracts/index.ts"],
    config: lowNoiseConfig()
  });

  assertHasObligation(analysis, "Artifact schema documentation must be reviewed");
  assertHasObligation(analysis, "Artifact contract tests must cover schema changes");
  assertHasObligation(analysis, "Artifact compatibility and migration review required");
});

test("impact analyze creates skill and agent contract and metadata-test obligations", async () => {
  const analysis = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["skills/blueprint-review/SKILL.md", "agents/blueprint-reviewer.md"],
    config: lowNoiseConfig()
  });

  assertHasObligation(analysis, "Skill and agent contract review required");
  assertHasObligation(analysis, "Skill and agent metadata tests must cover contract changes");
});

test("impact analyze creates extension deployment smoke and built-entrypoint obligations", async () => {
  const analysis = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["gemini-extension.json"],
    config: lowNoiseConfig()
  });

  assertHasObligation(analysis, "Extension deployment install smoke required");
  assertHasObligation(analysis, "Built entrypoint must be verified");
});

test("impact analyze blocks missing dist/mcp/server.js for extension runtime readiness", async () => {
  const repoPath = await createTempRepo();

  try {
    const analysis = await blueprintImpactAnalyze({
      cwd: repoPath,
      changedFiles: ["gemini-extension.json"],
      config: lowNoiseConfig()
    });

    assert.equal(analysis.status, "BLOCK");
    assert.equal(findingByCheck(analysis, "build.dist-entrypoint")?.status, "BLOCK");
    assert.match(
      findingByCheck(analysis, "build.dist-entrypoint")?.title ?? "",
      /Missing built entrypoint/
    );
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("impact analyze warns when runtime source changes lack dist coverage", async () => {
  const analysis = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["src/mcp/tools/impact.ts"],
    config: lowNoiseConfig()
  });

  assert.equal(findingByCheck(analysis, "build.dist-coverage")?.status, "WARN");
  assert.ok(
    analysis.unknowns.some(
      (unknown) => unknown.id === "unknown.obligation.build-dist-coverage"
    )
  );
  assert.match(
    analysis.warnings.join("\n"),
    /without corresponding dist\/\*\* runtime bundle coverage/
  );
});

test("impact analyze does not count declaration-only dist output as runtime bundle coverage", async () => {
  const analysis = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["src/mcp/tools/impact.ts", "dist/mcp/tools/impact.d.ts"],
    config: lowNoiseConfig()
  });

  assert.equal(findingByCheck(analysis, "build.dist-coverage")?.status, "WARN");
  assert.ok(
    analysis.unknowns.some(
      (unknown) => unknown.id === "unknown.obligation.build-dist-coverage"
    )
  );
});

test("impact analyze does not count unrelated hook bundles as MCP runtime coverage", async () => {
  const analysis = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["src/mcp/tools/impact.ts", "dist/hooks/read-before-edit.js"],
    config: lowNoiseConfig()
  });

  assert.equal(findingByCheck(analysis, "build.dist-coverage")?.status, "WARN");
  assert.ok(
    analysis.unknowns.some(
      (unknown) => unknown.id === "unknown.obligation.build-dist-coverage"
    )
  );
});

test("impact analyze warns on generated-only dist provenance", async () => {
  const analysis = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["dist/mcp/server.js"],
    config: lowNoiseConfig()
  });

  assert.equal(findingByCheck(analysis, "build.generated-provenance")?.status, "WARN");
  assert.ok(
    analysis.unknowns.some(
      (unknown) => unknown.id === "unknown.obligation.generated-dist-provenance"
    )
  );
  assertHasObligation(analysis, "Generated output provenance must be verified");
});

test("impact analyze warns on generated-only hook bundle provenance", async () => {
  const analysis = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["dist/hooks/read-before-edit.js"],
    config: lowNoiseConfig()
  });

  assert.equal(findingByCheck(analysis, "build.generated-provenance")?.status, "WARN");
  assert.ok(
    analysis.unknowns.some(
      (unknown) => unknown.id === "unknown.obligation.generated-dist-provenance"
    )
  );
  assertHasObligation(analysis, "Generated output provenance must be verified");
});

test("impact analyze keeps stable ids, deterministic sorting, and non-empty evidence refs", async () => {
  const first = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: [
      "src/mcp/tools/impact.ts",
      "dist/mcp/server.js",
      "commands/blu-code-review.toml"
    ],
    config: lowNoiseConfig()
  });
  const second = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: [
      "commands/blu-code-review.toml",
      "dist/mcp/server.js",
      "src/mcp/tools/impact.ts"
    ],
    config: lowNoiseConfig()
  });
  const sortKeys = first.obligations.map(
    (obligation) =>
      `${obligation.status}:${obligation.severity}:${obligation.category}:${obligation.title}:${obligation.id}`
  );

  assert.deepEqual(
    first.findings.map((finding) => finding.id),
    second.findings.map((finding) => finding.id)
  );
  assert.deepEqual(
    first.obligations.map((obligation) => obligation.id),
    second.obligations.map((obligation) => obligation.id)
  );
  assert.deepEqual(sortKeys, [...sortKeys].sort());
  assertEveryEvidenceRefIsNonEmpty(first);
});

test("impact analyze creates security, deployment, release, and test obligations for sensitive runtime surfaces", async () => {
  const analysis = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: [".env.local", "package.json", "scripts/build.mjs", "hooks/hooks.json"],
    config: lowNoiseConfig()
  });
  const categories = new Set(analysis.obligations.map((obligation) => obligation.category));

  assert.ok(categories.has("security"));
  assert.ok(categories.has("deployment"));
  assert.ok(categories.has("release"));
  assert.ok(categories.has("tests"));
});

test("impact report writer and output renderer remain disabled placeholders for Phase 7 reports", async () => {
  const analysis = await blueprintImpactAnalyze({
    cwd: repoRoot,
    changedFiles: ["src/mcp/tools/impact.ts"],
    config: {
      ownership: {
        fallbackReviewers: ["@reviewer"]
      },
      dependencyGraph: {
        sources: []
      }
    }
  });
  const write = await blueprintImpactReportWrite({
    cwd: repoRoot,
    impactId: analysis.impactId,
    report: analysis.report
  });
  const rendered = await blueprintImpactOutputRender({
    cwd: repoRoot,
    mode: "json",
    impactId: analysis.impactId,
    report: analysis.report
  });

  assert.equal(write.status, "disabled");
  assert.equal(write.written, false);
  assert.equal(rendered.phaseStatus, "placeholder");
  assert.match(rendered.content, /Phase 7/);
});
