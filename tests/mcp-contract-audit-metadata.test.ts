import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  artifactContractIds,
  readArtifactContract
} from "../src/mcp/artifact-contracts/index.js";
import {
  buildBlueprintCommandCatalogResource,
  buildBlueprintCommandRuntimeContractResource,
  listBlueprintCommandRuntimeContractCommands
} from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";

const repoRoot = process.cwd();

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function isControlPlaneDocPath(value: string): boolean {
  return /^docs\//.test(value);
}

test("command resources expose only implemented runtime-contract commands from source-owned metadata", async () => {
  const catalog = await buildBlueprintCommandCatalogResource();
  const commands = await listBlueprintCommandRuntimeContractCommands();

  assert.ok(commands.includes("help"));
  assert.ok(commands.includes("impact"));
  assert.ok(commands.includes("execute-phase"));
  assert.equal(commands.includes("do"), false);

  for (const commandName of commands) {
    const entry = catalog.commands[commandName];
    const contract = await buildBlueprintCommandRuntimeContractResource(commandName);

    assert.equal(entry.status, "implemented");
    assert.equal(entry.implemented, true);
    assert.equal(contract.catalog.command, `/blu-${commandName}`);
    assert.equal(contract.catalog.specPath, contract.spec?.path);
    assert.equal(contract.catalog.specPath, contract.runtimeReference?.commandSpecPath);
    assert.equal(isControlPlaneDocPath(contract.catalog.specPath ?? ""), false);
  }
});

test("discovery and execution contracts stay anchored to manifests, skill references, and runtime metadata", async () => {
  for (const commandName of [
    "discuss-phase",
    "research-phase",
    "ui-phase",
    "execute-phase",
    "validate-phase",
    "verify-work",
    "add-tests"
  ]) {
    const metadata = getRuntimeOwnedCommandMetadata(commandName);
    const contract = await buildBlueprintCommandRuntimeContractResource(commandName);

    assert.ok(metadata, `${commandName} should have runtime metadata`);
    assert.equal(contract.spec?.path, metadata?.sourceId);
    assert.equal(contract.runtimeReference?.path, metadata?.sourceId);
    assert.deepEqual(contract.spec?.requiredTools, [...(metadata?.requiredTools ?? [])]);
    assert.deepEqual(
      contract.runtimeReference?.exactMcpDestination,
      [...(metadata?.requiredTools ?? [])]
    );
    assert.equal(
      contract.skillInputs.effective.some((input) => isControlPlaneDocPath(input)),
      false
    );
  }
});

test("review and maintenance contracts stay docs-free while keeping runtime coverage", async () => {
  for (const commandName of [
    "review",
    "code-review",
    "code-review-fix",
    "audit-fix",
    "debug",
    "quick",
    "pr-branch",
    "ship",
    "cleanup"
  ]) {
    const metadata = getRuntimeOwnedCommandMetadata(commandName);
    const contract = await buildBlueprintCommandRuntimeContractResource(commandName);

    assert.ok(metadata, `${commandName} should have runtime metadata`);
    assert.equal(contract.catalog.status, "implemented");
    assert.equal(contract.catalog.implemented, true);
    assert.equal(contract.spec?.path, metadata?.sourceId);
    assert.equal(contract.runtimeReference?.commandSpecPath, metadata?.sourceId);
    assert.deepEqual(contract.spec?.optionalSubagents, [...(metadata?.optionalAgents ?? [])]);
    assert.deepEqual(contract.runtimeReference?.optionalAgents, [
      ...(metadata?.optionalAgents ?? [])
    ]);
  }
});

test("artifact contracts keep canonical runtime-owned shapes without repo docs", async () => {
  const phaseContext = readArtifactContract("phase.context");
  const reviewFix = readArtifactContract("review.review-fix", {
    phaseLabel: "Phase 4: Runtime Repair",
    phasePrefix: "04"
  });
  const pauseWork = readArtifactContract("report.pause-work");
  const milestoneSummary = readArtifactContract("report.milestone-summary");
  const impactReport = readArtifactContract("report.impact");
  const impactRuntimeReference = await readRepoFile(
    "skills/blueprint-impact/references/impact-runtime-contract.md"
  );

  assert.ok(artifactContractIds.includes("phase.context"));
  assert.equal(phaseContext.canonicalFilePattern, ".blueprint/phases/<phase-slug>/XX-CONTEXT.md");
  assert.equal(reviewFix.requiredHeadings.includes("Findings Addressed"), true);
  assert.equal(pauseWork.canonicalFilePattern, ".blueprint/reports/pause-work-latest.md");
  assert.equal(
    milestoneSummary.canonicalFilePattern,
    ".blueprint/reports/milestone-summary-<milestone>.md"
  );
  assert.ok(impactReport.modelContract);
  assert.match(impactRuntimeReference, /## Required MCP Calls/);
  assert.match(impactRuntimeReference, /## Report Quality Rules/);
});
