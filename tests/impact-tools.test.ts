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

test("impact downstream placeholder handlers still avoid writing report artifacts", async () => {
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
  assert.equal(analysis.confidence.level, "low");
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
