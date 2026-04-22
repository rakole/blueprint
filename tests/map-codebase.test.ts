import test from "node:test";
import assert from "node:assert/strict";
import {
  access,
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import {
  CODEBASE_ARTIFACTS,
  blueprintArtifactList,
  blueprintArtifactScaffold,
  blueprintArtifactSummaryDigest,
  blueprintCodebaseArtifactWrite,
  blueprintArtifactValidate
} from "../src/mcp/tools/artifacts.js";
import { blueprintProjectInit, blueprintProjectStatus } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();
const fixtureRoot = path.join(repoRoot, "tests/fixtures/map-codebase");

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function copyFixtureContents(sourcePath: string, targetPath: string): Promise<void> {
  const entries = await readdir(sourcePath, { withFileTypes: true });

  for (const entry of entries) {
    const sourceEntry = path.join(sourcePath, entry.name);
    const targetEntry = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      await mkdir(targetEntry, { recursive: true });
      await copyFixtureContents(sourceEntry, targetEntry);
      continue;
    }

    const sourceStats = await stat(sourceEntry);
    await mkdir(path.dirname(targetEntry), { recursive: true });
    await copyFile(sourceEntry, targetEntry);
    await import("node:fs/promises").then(({ chmod }) =>
      chmod(targetEntry, sourceStats.mode)
    );
  }
}

async function createRepoFromFixture(fixtureName: string): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-map-codebase-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(repoPath, { recursive: true });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await copyFixtureContents(path.join(fixtureRoot, fixtureName), repoPath);

  return repoPath;
}

async function listRelativeFiles(rootPath: string, projectRoot: string): Promise<string[]> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listRelativeFiles(absolutePath, projectRoot)));
      continue;
    }

    files.push(path.relative(projectRoot, absolutePath).split(path.sep).join("/"));
  }

  return files.sort();
}

async function collectRepoEvidence(repoPath: string): Promise<{
  sourceFiles: string[];
  testFiles: string[];
  docFiles: string[];
  trackedFiles: string[];
}> {
  const sourceFiles = await listRelativeFiles(path.join(repoPath, "src"), repoPath);
  const testFiles = await listRelativeFiles(path.join(repoPath, "tests"), repoPath);
  const docFiles = await listRelativeFiles(path.join(repoPath, "docs"), repoPath);
  const trackedFiles = await listRelativeFiles(repoPath, repoPath);

  return {
    sourceFiles,
    testFiles,
    docFiles,
    trackedFiles: trackedFiles.filter((file) => !file.startsWith(".blueprint/"))
  };
}

async function writeAuthoredCodebaseBundle(repoPath: string): Promise<void> {
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
    "codebase.stack": `# Stack

## Purpose

- Capture the mapped repo evidence for this codebase area.

## Runtime

- Primary language or runtime: TypeScript on Node.js.
- Module system or platform: ESM package layout via package.json.
- Package manager or build entrypoint: npm scripts in package.json.

## Tooling

- Build command: npm run build.
- Test command: npm test.
- Lint or format command: No dedicated lint script is currently declared.

## Dependencies

- Core dependencies: @modelcontextprotocol/sdk and zod.
- Notable dev dependencies: typescript, tsx, and @types/node.
- Generated or vendored tooling: scripts/build.mjs drives the build.

## Notes

- Evidence comes from package.json, README.md, and tracked source files.
`,
    "codebase.architecture": `# Architecture

## Purpose

- Capture the mapped repo evidence for this codebase area.

## Overview

- The CLI extension centers on thin command manifests plus MCP-backed runtime tools.
- The runtime surface is split across project, artifact, phase, review, and state tool modules.

## Boundaries

- Primary subsystems or layers: src/mcp/tools, src/mcp/artifact-contracts, and command metadata.
- Cross-cutting concerns or shared services: shared security helpers and runtime vocabulary.

## Flow

- Entry points and request path: command manifests route into MCP tool-backed flows.
- Data flow or orchestration path: phase and project tools read and write .blueprint state through MCP handlers.

## Notes

- Evidence: src/mcp/server.ts, src/mcp/tools/artifacts.ts, and src/mcp/tools/project.ts.
`,
    "codebase.structure": `# Structure

## Purpose

- Capture the mapped repo evidence for this codebase area.

## Directory Map

- \`src/mcp/tools\`: runtime MCP tool handlers and validations.
- \`tests\`: behavior and metadata regression coverage.

## Key Files

- \`src/mcp/server.ts\`: tool registration and mutation tracking.
- \`src/mcp/tools/artifacts.ts\`: scaffold, digest, validation, and codebase-write logic.

## Seams

- Important refactor or ownership seam: codebase mapping flows are separated from phase-scoped artifact writing.
- Additional seam or boundary: contract metadata lives in src/mcp/artifact-contracts/index.ts.

## Notes

- Evidence: tracked source files and the map-codebase fixture.
`,
    "codebase.conventions": `# Conventions

## Purpose

- Capture the mapped repo evidence for this codebase area.

## Naming

- File, type, and module naming conventions: tool handlers use Blueprint-prefixed internal names.
- Repo-specific vocabulary or prefixes: command, phase, review, and report artifact families stay explicit.

## Module Boundaries

- Import/export or package boundary rules: runtime tool modules own mutation logic instead of shell scripts.
- Directory ownership or layering rule: artifact contracts and tool handlers stay separate from tests and docs.

## Error Handling

- Error and logging pattern: write helpers return warnings or invalid statuses instead of silently mutating.
- Retry, guard, or failure conventions: overwrite paths require explicit confirmation flags.

## Documentation

- Commenting or README style: command docs and runtime references must stay aligned with shipped tools.
- Where durable notes should live: .blueprint/ remains the project-local state root.

## Notes

- Evidence: README.md, docs/, and src/mcp/server.ts.
`,
    "codebase.testing": `# Testing

## Purpose

- Capture the mapped repo evidence for this codebase area.

## Framework

- Primary test runner: node:test through tsx.
- Assertion or mocking stack: node:assert/strict with fixture-based repo tests.

## Commands

- Full test command: npm test.
- Focused or watch command: tsx --test tests/map-codebase.test.ts.

## Coverage

- Key coverage signal: map-codebase has dedicated behavior and metadata tests.
- Gap or limitation that still needs attention: command-host integration still depends on manifest accuracy.

## Notes

- Evidence: package.json, tests/map-codebase.test.ts, and docs/testing.md.
`,
    "codebase.integrations": `# Integrations

## Purpose

- Capture the mapped repo evidence for this codebase area.

## External Systems

- Service, provider, or backend dependency: GitHub flows appear through the enabled GitHub plugin and related tests.
- Additional external surface: MCP server registration depends on @modelcontextprotocol/sdk.

## SDKs And APIs

- SDK or API surface: @modelcontextprotocol/sdk provides MCP transport and server types.
- Integration entrypoint or client wrapper: src/mcp/server.ts wires runtime tool definitions into the MCP server.

## Authentication And Secrets

- Auth flow, credentials, or secrets handling: integrations rely on host/plugin configuration rather than repo-owned secrets.
- Operational boundary or environment note: write safety is enforced in MCP handlers before persistence.

## Notes

- Evidence: package.json and src/mcp/server.ts.
`,
    "codebase.concerns": `# Concerns

## Purpose

- Capture the mapped repo evidence for this codebase area.

## Risks

- Current risk that could slow mapping or delivery: manifest/doc drift can misrepresent the shipped MCP surface.
- Additional risk or unknown: placeholder-only bundle content can mislead later lifecycle flows if validation is bypassed.

## Gaps

- Thin area, missing evidence, or unknown: focus-area deepening still depends on the supplied repo evidence set.
- Follow-up evidence still needed: end-to-end host command execution should keep validating the map-codebase contract.

## Follow-Ups

- Next concrete follow-up: validate the resulting codebase bundle after substantive writes.
- Later revisit item: broaden focused mapping heuristics if more subsystem-specific fixtures are added.

## Questions

- Open question that still needs an answer: which additional focused areas deserve dedicated fixture coverage next?
- Additional question or assumption to verify: whether future command-host UX wants more structured refresh choices.

## Notes

- Reuse decisions should stay tied to actual tracked repo evidence.
`
  };

  for (const [artifactId, content] of Object.entries(authoredBundle)) {
    const result = await blueprintCodebaseArtifactWrite({
      cwd: repoPath,
      artifactId: artifactId as keyof typeof authoredBundle,
      content: String(content)
    });
    assert.notEqual(result.status, "invalid", JSON.stringify(result));
  }
}

test("map-codebase scaffolds the stable codebase bundle and builds deterministic digests", async (t) => {
  const repoPath = await createRepoFromFixture("brownfield-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({ cwd: repoPath });
  const scaffold = await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [...CODEBASE_ARTIFACTS]
  });
  const artifacts = await blueprintArtifactList({ cwd: repoPath });
  const evidence = await collectRepoEvidence(repoPath);
  const digest = await blueprintArtifactSummaryDigest({
    cwd: repoPath,
    focusArea: "mcp",
    packageJsonPath: "package.json",
    readmePath: "README.md",
    sourceFiles: evidence.sourceFiles,
    testFiles: evidence.testFiles,
    docFiles: evidence.docFiles,
    trackedFiles: evidence.trackedFiles
  });

  assert.deepEqual(scaffold.createdFiles, [...CODEBASE_ARTIFACTS]);

  for (const artifact of CODEBASE_ARTIFACTS) {
    assert.equal(
      await pathExists(path.join(repoPath, artifact)),
      true,
      `${artifact} should exist`
    );
  }

  assert.deepEqual(artifacts.artifacts.codebase, [...CODEBASE_ARTIFACTS]);
  assert.equal(digest.digest.length, CODEBASE_ARTIFACTS.length);
  assert.deepEqual(
    digest.digest.map((section) => section.artifact),
    [...CODEBASE_ARTIFACTS]
  );
  assert.ok(digest.inputsUsed.includes("package.json"));
  assert.ok(digest.inputsUsed.includes("README.md"));
  assert.ok(digest.inputsUsed.includes("docs/architecture.md"));

  const summaries = digest.digest.map((section) => section.summary).join("\n");
  assert.match(summaries, /TypeScript/);
  assert.match(summaries, /node:test/);
  assert.match(summaries, /docs\//);
  assert.match(summaries, /@octokit\/rest|src\/integrations\/github\.ts/);
});

test("map-codebase keeps scaffold-only bundles provisional and authored bundles complete", async (t) => {
  const repoPath = await createRepoFromFixture("brownfield-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({ cwd: repoPath });
  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [...CODEBASE_ARTIFACTS]
  });

  const scaffoldStatus = await blueprintProjectStatus({ cwd: repoPath });

  assert.equal(scaffoldStatus.bootstrap.repoShape, "brownfield");
  assert.equal(scaffoldStatus.bootstrap.brownfieldDetected, true);
  assert.equal(scaffoldStatus.bootstrap.codebaseMapped, false);
  assert.match(scaffoldStatus.bootstrap.recommendedNextAction, /\/blu-map-codebase/);
  assert.match(scaffoldStatus.nextAction, /\/blu-map-codebase/);
  assert.match(
    scaffoldStatus.bootstrap.traceabilityWarnings.join("\n"),
    /provisional until `\/blu-map-codebase` captures the existing codebase/i
  );

  await writeAuthoredCodebaseBundle(repoPath);

  const authoredStatus = await blueprintProjectStatus({ cwd: repoPath });

  assert.equal(authoredStatus.bootstrap.repoShape, "brownfield");
  assert.equal(authoredStatus.bootstrap.brownfieldDetected, true);
  assert.equal(authoredStatus.bootstrap.codebaseMapped, true);
  assert.match(authoredStatus.bootstrap.recommendedNextAction, /\/blu-progress/);
  assert.match(authoredStatus.nextAction, /\/blu-progress/);
  assert.doesNotMatch(
    authoredStatus.bootstrap.traceabilityWarnings.join("\n"),
    /provisional until `\/blu-map-codebase` captures the existing codebase/i
  );
});

test("artifact validation does not require an absent codebase bundle", async (t) => {
  const repoPath = await createRepoFromFixture("brownfield-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({ cwd: repoPath });

  const validation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(validation.valid, true);
  assert.doesNotMatch(
    validation.issues.join("\n"),
    /Codebase artifact bundle is incomplete or non-canonical/i
  );
});

test("artifact summary digest combines saved artifact summaries with live repo evidence inputs", async (t) => {
  const repoPath = await createRepoFromFixture("brownfield-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({ cwd: repoPath });
  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [...CODEBASE_ARTIFACTS]
  });
  await writeFile(
    path.join(repoPath, ".blueprint/codebase/STACK.md"),
    "# Stack\n\nHand-edited stack notes.\n",
    "utf8"
  );
  const evidence = await collectRepoEvidence(repoPath);
  const digest = await blueprintArtifactSummaryDigest({
    cwd: repoPath,
    artifactPaths: [
      ".blueprint/codebase/STACK.md",
      ".blueprint/codebase/ARCHITECTURE.md"
    ],
    packageJsonPath: "package.json",
    docFiles: evidence.docFiles,
    sourceFiles: evidence.sourceFiles,
    testFiles: evidence.testFiles,
    trackedFiles: evidence.trackedFiles
  });

  assert.ok(
    digest.digest.some((section) => section.artifact === ".blueprint/codebase/STACK.md")
  );
  assert.match(
    digest.digest.find((section) => section.artifact === ".blueprint/codebase/STACK.md")?.summary ?? "",
    /Hand-edited stack notes/i
  );
  assert.ok(digest.digest.some((section) => section.artifact === "repo-evidence/source"));
  assert.ok(digest.digest.some((section) => section.artifact === "repo-evidence/docs"));
  assert.ok(digest.digest.some((section) => section.artifact === "repo-evidence/tests"));
  assert.ok(digest.digest.some((section) => section.artifact === "repo-evidence/tracked"));
  assert.ok(digest.inputsUsed.includes(".blueprint/codebase/STACK.md"));
  assert.ok(digest.inputsUsed.includes("package.json"));
  assert.ok(digest.inputsUsed.includes("docs/architecture.md"));
});

test("map-codebase reuses edited codebase docs by default and warns before replace", async (t) => {
  const repoPath = await createRepoFromFixture("brownfield-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({ cwd: repoPath });
  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [...CODEBASE_ARTIFACTS]
  });

  const stackPath = path.join(repoPath, ".blueprint/codebase/STACK.md");
  await writeFile(stackPath, "# Stack\n\nHand-edited notes.\n", "utf8");

  const reuseResult = await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [...CODEBASE_ARTIFACTS]
  });
  const reusedStack = await readFile(stackPath, "utf8");
  const listedArtifacts = await blueprintArtifactList({ cwd: repoPath });
  const validation = await blueprintArtifactValidate({ cwd: repoPath });
  const replaceResult = await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [...CODEBASE_ARTIFACTS],
    overwrite: true
  });
  const replacedStack = await readFile(stackPath, "utf8");

  assert.equal(reusedStack, "# Stack\n\nHand-edited notes.\n");
  assert.ok(reuseResult.reusedFiles.includes(".blueprint/codebase/STACK.md"));
  assert.match(reuseResult.warnings.join("\n"), /Preserved existing codebase artifact/);
  assert.match(listedArtifacts.warnings.join("\n"), /present but not yet valid/i);
  assert.match(validation.warnings.join("\n"), /present but not yet valid/i);
  assert.match(replaceResult.warnings.join("\n"), /Replaced existing codebase artifact/);
  assert.notEqual(replacedStack, "# Stack\n\nHand-edited notes.\n");
  assert.match(replacedStack, /Generated by `blueprint_artifact_scaffold`/);
});

test("map-codebase scaffold rejects guessed artifact formats with corrective guidance", async (t) => {
  const repoPath = await createRepoFromFixture("brownfield-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({ cwd: repoPath });

  await assert.rejects(
    () =>
      blueprintArtifactScaffold({
        cwd: repoPath,
        artifacts: ["STACK"]
      }),
    /Unsupported Blueprint artifact requested: STACK\..*\.blueprint\/codebase\/STACK\.md.*bare names like `STACK`.*absolute filesystem paths/i
  );

  await assert.rejects(
    () =>
      blueprintArtifactScaffold({
        cwd: repoPath,
        artifacts: [path.join(repoPath, ".blueprint/codebase/STACK.md")]
      }),
    /Unsupported Blueprint artifact requested: .*\.blueprint\/codebase\/STACK\.md\..*repo-relative Blueprint artifact paths/i
  );
});

test("map-codebase command file uses runtime FQNs and explicit repo-relative artifact paths", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-map-codebase.toml"),
    "utf8"
  );
  const requiredTools = [
    "mcp_blueprint_blueprint_project_status",
    "mcp_blueprint_blueprint_artifact_contract_read",
    "mcp_blueprint_blueprint_artifact_scaffold",
    "mcp_blueprint_blueprint_artifact_list",
    "mcp_blueprint_blueprint_artifact_summary_digest",
    "mcp_blueprint_blueprint_codebase_artifact_write",
    "mcp_blueprint_blueprint_artifact_validate"
  ];
  const registeredToolNames = [
    "blueprint_project_status",
    "blueprint_artifact_contract_read",
    "blueprint_artifact_scaffold",
    "blueprint_artifact_list",
    "blueprint_artifact_summary_digest",
    "blueprint_codebase_artifact_write",
    "blueprint_artifact_validate"
  ];

  for (const toolName of registeredToolNames) {
    assert.ok(
      blueprintToolNames.includes(toolName),
      `${toolName} should be registered in the MCP server`
    );
  }

  for (const toolName of requiredTools) {
    assert.match(commandFile, new RegExp(toolName));
  }

  assert.match(commandFile, /STACK\.md/);
  assert.match(commandFile, /ARCHITECTURE\.md/);
  assert.match(commandFile, /STRUCTURE\.md/);
  assert.match(commandFile, /CONCERNS\.md/);
  assert.match(commandFile, /Execution profile: `long-running-mutation`\./);
  assert.match(commandFile, /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/);
  assert.match(commandFile, /resolved scope, active stage, pending gate, execution mode, and next safe action/);
  assert.match(commandFile, /ask_user/i);
  assert.match(commandFile, /blueprint_artifact_contract_read/i);
  assert.match(commandFile, /blueprint_codebase_artifact_write/i);
  assert.match(commandFile, /blueprint_artifact_validate/i);
  assert.match(commandFile, /"artifacts": \["\.blueprint\/codebase\/STACK\.md"/);
  assert.match(commandFile, /Never pass bare names like `"STACK"`/);
  assert.match(commandFile, /never pass absolute filesystem paths/i);
  assert.match(commandFile, /heavily edited/i);
  assert.match(commandFile, /Existing codebase docs should be reused by default\./i);
  assert.match(commandFile, /replace/);
});
