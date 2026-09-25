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
import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { MAP_CODEBASE_RUNTIME_METADATA } from "../src/mcp/command-runtime-metadata.js";
import {
  CODEBASE_ARTIFACTS,
  blueprintArtifactList,
  blueprintArtifactMutateIndex,
  blueprintArtifactReportWrite,
  blueprintArtifactScaffold,
  blueprintArtifactSummaryDigest,
  blueprintCodebaseArtifactWrite,
  blueprintArtifactValidate
} from "../src/mcp/tools/artifacts.js";
import { blueprintProjectStatus } from "../src/mcp/tools/project.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

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
  const repoPath = await createGitRepo("blueprint-map-codebase-");
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

  const scaffold = await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [...CODEBASE_ARTIFACTS]
  });
  const artifacts = await blueprintArtifactList({ cwd: repoPath });
  const blueprintFiles = await listRelativeFiles(path.join(repoPath, ".blueprint"), repoPath);
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
  assert.deepEqual(blueprintFiles, [...CODEBASE_ARTIFACTS].sort());

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

test("starter scaffolding no longer qualifies as a map-first brownfield repo", async (t) => {
  const repoPath = await createGitRepo("blueprint-map-codebase-scaffold-only-");
  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await mkdir(path.join(repoPath, "docs"), { recursive: true });
  await writeFile(
    path.join(repoPath, "package.json"),
    JSON.stringify({ name: "map-codebase-scaffold-only", private: true }, null, 2),
    "utf8"
  );
  await writeFile(path.join(repoPath, "docs/SPEC.md"), "# Product Spec\n", "utf8");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const validation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(status.status, "uninitialized");
  assert.equal(status.bootstrap.repoShape, "scaffold-only");
  assert.equal(status.bootstrap.brownfieldDetected, false);
  assert.match(status.nextAction, /\/blu-new-project/);
  assert.doesNotMatch(status.nextAction, /\/blu-map-codebase/);
  assert.match(validation.suggestedRepairs.join("\n"), /\/blu-new-project/);
  assert.doesNotMatch(validation.suggestedRepairs.join("\n"), /\/blu-map-codebase/);
});

test("map-codebase keeps scaffold-only bundles provisional and authored bundles complete", async (t) => {
  const repoPath = await createRepoFromFixture("brownfield-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [...CODEBASE_ARTIFACTS]
  });

  const scaffoldStatus = await blueprintProjectStatus({ cwd: repoPath });

  assert.equal(scaffoldStatus.status, "mapping-incomplete");
  assert.equal(scaffoldStatus.bootstrap.repoShape, "brownfield");
  assert.equal(scaffoldStatus.bootstrap.brownfieldDetected, true);
  assert.equal(scaffoldStatus.bootstrap.codebaseMapped, false);
  assert.match(scaffoldStatus.bootstrap.recommendedNextAction, /\/blu-map-codebase/);
  assert.match(scaffoldStatus.nextAction, /\/blu-map-codebase/);
  assert.match(
    scaffoldStatus.bootstrap.traceabilityWarnings.join("\n"),
    /provisional until `\/blu-map-codebase` captures the existing codebase/i
  );

  const scaffoldCapture = await blueprintArtifactMutateIndex({
    cwd: repoPath,
    target: "note",
    action: "append",
    description: "This note must wait until core bootstrap exists."
  });

  assert.equal(scaffoldCapture.status, "project_missing");
  assert.match(scaffoldCapture.warnings.join("\n"), /\/blu-map-codebase/);
  assert.equal(await pathExists(path.join(repoPath, ".blueprint/notes/NOTES.md")), false);
  await assert.rejects(
    blueprintArtifactReportWrite({
      cwd: repoPath,
      reportName: "pre-bootstrap-report",
      content: "# Pre Bootstrap Report\n\nThis report must wait until core bootstrap exists.\n"
    }),
    /initialized core project artifacts/i
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/reports/pre-bootstrap-report.md")),
    false
  );

  await writeAuthoredCodebaseBundle(repoPath);

  const authoredStatus = await blueprintProjectStatus({ cwd: repoPath });

  assert.equal(authoredStatus.bootstrap.repoShape, "brownfield");
  assert.equal(authoredStatus.status, "mapped-only");
  assert.equal(authoredStatus.bootstrap.brownfieldDetected, true);
  assert.equal(authoredStatus.bootstrap.codebaseMapped, true);
  assert.match(authoredStatus.bootstrap.recommendedNextAction, /\/blu-new-project/);
  assert.match(authoredStatus.nextAction, /\/blu-new-project/);
  assert.doesNotMatch(
    authoredStatus.bootstrap.traceabilityWarnings.join("\n"),
    /provisional until `\/blu-map-codebase` captures the existing codebase/i
  );

  const authoredCapture = await blueprintArtifactMutateIndex({
    cwd: repoPath,
    target: "todo",
    action: "append",
    description: "This todo must wait until core bootstrap exists."
  });

  assert.equal(authoredCapture.status, "project_missing");
  assert.match(authoredCapture.warnings.join("\n"), /\/blu-new-project/);
  assert.equal(await pathExists(path.join(repoPath, ".blueprint/todos/TODO.md")), false);
});

test("successful mapping produces mapped-only healthy validation and routes to new-project", async (t) => {
  const repoPath = await createRepoFromFixture("brownfield-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeAuthoredCodebaseBundle(repoPath);

  const validation = await blueprintArtifactValidate({ cwd: repoPath });
  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.equal(validation.valid, true);
  assert.equal(status.status, "mapped-only");
  assert.match(status.nextAction, /\/blu-new-project/);
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

test("map-codebase guidance uses the compact parent-owned prepare and submit flow", async () => {
  const [commandFile, skillFile, agentFile, reference] = await Promise.all([
    readFile(path.join(repoRoot, "commands/blu-map-codebase.toml"), "utf8"),
    readFile(path.join(repoRoot, "skills/blueprint-map/SKILL.md"), "utf8"),
    readFile(path.join(repoRoot, "agents/blueprint-mapper.md"), "utf8"),
    readFile(path.join(repoRoot, "skills/blueprint-map/references/map-runtime-contract.md"), "utf8")
  ]);

  for (const toolName of ["blueprint_map_prepare", "blueprint_map_submit"]) {
    assert.ok(
      blueprintToolNames.includes(toolName),
      `${toolName} should be registered in the MCP server`
    );
    assert.match(commandFile, new RegExp(`mcp_blueprint_${toolName}`));
    assert.match(skillFile, new RegExp(`mcp_blueprint_${toolName}`));
  }

  // Do not restore primitive calls or a second contract for runtime-derived Markdown.
  for (const text of [commandFile, skillFile, reference]) {
    assert.doesNotMatch(text, /mcp_blueprint_blueprint_(?:project_status|config_get|artifact_contract_read|artifact_scaffold|artifact_list|artifact_summary_digest|codebase_artifact_write|artifact_validate)/);
    assert.doesNotMatch(text, /contract\.authoringTemplate|exactly\s+one artifact at a time/);
  }
  assert.match(commandFile, /Execution profile: `long-running-mutation`\./);
  assert.match(commandFile, /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/);
  assert.match(commandFile, /resolved scope, active stage, pending gate, execution mode, and next safe action/);
  assert.match(commandFile, /skills\/blueprint-map\/references\/map-runtime-contract\.md/);
  assert.match(commandFile, /call prepare before reading those files or generating/);
  assert.match(commandFile, /opaque `snapshot` unchanged/);
  assert.match(commandFile, /without a reuse-versus-refresh question/);
  assert.match(commandFile, /explicit user request to refresh or replace already authorizes `overwrite: true`/);
  assert.match(commandFile, /do not ask again/);
  assert.match(commandFile, /workflow\.subagents=true/);
  assert.match(commandFile, /parent owns submit/i);
  assert.match(skillFile, /Newly discovered evidence triggered\s+prepare again before authoring/);
  assert.match(skillFile, /single parent authoring pass by default/);
  assert.match(skillFile, /agents never persist the bundle/);
  assert.match(skillFile, /Partial publication\s+was reported honestly/);

  assert.match(agentFile, /Always read-only/);
  assert.match(agentFile, /Cover only assigned keys/);
  assert.match(agentFile, /prepare an expanded snapshot before it is read/);
  assert.match(agentFile, /Do not use browser, web, generic page-inspection, or search-only agents/);
  assert.doesNotMatch(agentFile, /parent delegates persistence|parent explicitly delegates artifact writes/);
});

test("map-codebase runtime metadata mirrors the direct publication contract", async () => {
  const contract = await buildBlueprintCommandRuntimeContractResource("map-codebase");

  assert.equal(MAP_CODEBASE_RUNTIME_METADATA.sourceId, "src/mcp/command-runtime-metadata.ts#map-codebase");
  assert.equal(contract.catalog.specPath, MAP_CODEBASE_RUNTIME_METADATA.sourceId);
  assert.equal(contract.spec?.executionProfile, "long-running-mutation");
  assert.equal(contract.spec?.rootRoutable, true);
  assert.deepEqual(contract.spec?.reads, [
    "Selected repository evidence and generated map state through blueprint_map_prepare"
  ]);
  assert.deepEqual(contract.spec?.writes, [
    ".blueprint/codebase/INDEX.md and its referenced generations/<generation-id>/",
    ".blueprint/codebase/{STACK,ARCHITECTURE,STRUCTURE,CONVENTIONS,TESTING,INTEGRATIONS,CONCERNS}.md compatibility views when applicable",
    "an explicitly selected existing repository instruction file only when linkInstructions is requested"
  ]);
  assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
    "blueprint_map_prepare",
    "blueprint_map_submit"
  ]);
  assert.deepEqual(contract.runtimeReference?.optionalAgents, ["blueprint-mapper"]);
  assert.deepEqual(contract.runtimeReference?.evidenceState, [
    "locked",
    "runtime-owned",
    "behavior-audited"
  ]);
  const notes = contract.runtimeReference?.contractNotes ?? "";
  assert.match(notes, /local map runtime contract/i);
  assert.match(notes, /prepare before reading and authoring/i);
  assert.match(notes, /explicit refresh request authorizes overwrite without a second confirmation/i);
  assert.match(notes, /validates the complete bundle before writes/i);
  assert.match(notes, /Rejected content is never saved/i);
  assert.match(notes, /metadata-only recovery/i);
  assert.match(notes, /successful mapped-only to \/blu-new-project/);
});

test("map-codebase reference keeps evidence and useful content without mandatory filler", async () => {
  const reference = await readFile(
    path.join(repoRoot, "skills/blueprint-map/references/map-runtime-contract.md"),
    "utf8"
  );
  for (const artifact of CODEBASE_ARTIFACTS) {
    const name = path.basename(artifact);
    assert.ok(reference.includes(name), `${name} should have content guidance`);
  }
  assert.match(reference, /Choose actual files, not\s+folders/);
  assert.match(reference, /Adapt to\s+the repository rather than assuming particular languages or directory names/);
  assert.match(reference, /Read the exact\s+selected inputs after prepare/);
  assert.match(reference, /prepare again with the\s+expanded selection/);
  assert.match(reference, /requiredDocuments/);
  assert.match(reference, /`evidencePaths`/);
  assert.match(reference, /Omit irrelevant\s+sections instead of adding filler/);
  assert.match(reference, /capability-gated delegation only when effective `workflow\.subagents=true`/);
  assert.match(reference, /A single parent pass is the\s+fallback/);
  assert.match(reference, /Retry the same snapshot and\s+identical documents/);
  assert.match(reference, /never document bodies/);
  assert.match(reference, /there are no failed-draft archives/);
  assert.match(reference, /do not force a regeneration\s+when publication succeeded/);
  assert.doesNotMatch(reference, /\.planning\//);
  assert.doesNotMatch(reference, /SCAN\.md|INTEL\.md/);
});
