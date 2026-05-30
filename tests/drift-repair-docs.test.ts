import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

import { readArtifactContract } from "../src/mcp/artifact-contracts/index.js";
import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import {
  getRuntimeOwnedCommandMetadata,
  listRuntimeOwnedCommandMetadata
} from "../src/mcp/command-runtime-metadata.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

function isControlPlaneDocPath(value: string): boolean {
  return /^docs\//.test(value);
}

test("runtime catalog keeps shipped lifecycle, roadmap-admin, and maintenance commands source-owned", async () => {
  const catalog = await blueprintCommandCatalog();

  for (const commandName of [
    "map-codebase",
    "next",
    "execute-phase",
    "insert-phase",
    "remove-phase",
    "audit-milestone",
    "complete-milestone",
    "milestone-summary",
    "new-milestone",
    "pause-work",
    "resume-work",
    "plan-milestone-gaps",
    "new-workspace",
    "remove-workspace",
    "workstreams",
    "update",
    "cleanup",
    "reapply-patches"
  ]) {
    const entry = catalog.commands[commandName];

    assert.equal(entry.declaredStatus, "implemented");
    assert.equal(entry.status, "implemented");
    assert.equal(entry.implemented, true);
    assert.ok(entry.specPath);
    assert.equal(isControlPlaneDocPath(entry.specPath ?? ""), false);
  }

  const doEntry = catalog.commands.do;

  assert.equal(getRuntimeOwnedCommandMetadata("do"), null);
  assert.equal(doEntry.declaredStatus, "planned");
  assert.equal(doEntry.status, "repairing");
  assert.equal(doEntry.implemented, false);
  assert.equal(doEntry.manifestPath, null);
  assert.equal(doEntry.specPath, null);
  assert.match(doEntry.blockedBy.join("\n"), /Missing command manifest: commands\/blu-do\.toml/);
});

test("runtime-contract resources stay implemented when control-plane docs are unavailable", async (t) => {
  const realReadFile = fs.readFile.bind(fs);

  t.mock.method(fs, "readFile", async (filePath, options) => {
    const normalizedPath =
      filePath instanceof URL ? filePath.pathname : path.resolve(String(filePath));

    if (/\/docs\/.+\.md$/.test(normalizedPath)) {
      const error = new Error("simulated control-plane docs absence") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    }

    return realReadFile(
      filePath as Parameters<typeof fs.readFile>[0],
      options as Parameters<typeof fs.readFile>[1]
    );
  });

  for (const commandName of ["help", "code-review-fix", "audit-fix"]) {
    const contract = await buildBlueprintCommandRuntimeContractResource(commandName);

    assert.equal(contract.catalog.status, "implemented");
    assert.equal(contract.catalog.implemented, true);
    assert.ok(contract.spec?.path);
    assert.ok(contract.runtimeReference?.path);
    assert.equal(isControlPlaneDocPath(contract.spec?.path ?? ""), false);
    assert.equal(isControlPlaneDocPath(contract.runtimeReference?.path ?? ""), false);
    assert.equal(
      contract.skillInputs.effective.some((input) => isControlPlaneDocPath(input)),
      false
    );
  }
});

test("artifact contracts keep report inventory and context ownership runtime-owned", () => {
  const contextContract = readArtifactContract("phase.context");
  const pauseWork = readArtifactContract("report.pause-work");
  const milestoneComplete = readArtifactContract("report.milestone-complete");
  const milestoneSummary = readArtifactContract("report.milestone-summary");

  assert.equal(contextContract.canonicalFilePattern, ".blueprint/phases/<phase-slug>/XX-CONTEXT.md");
  assert.match(contextContract.notes.join("\n"), /phase-scoped and MCP-owned/i);
  assert.equal(pauseWork.canonicalFilePattern, ".blueprint/reports/pause-work-latest.md");
  assert.equal(milestoneComplete.canonicalFilePattern, ".blueprint/reports/milestone-complete-<milestone>.md");
  assert.equal(milestoneSummary.canonicalFilePattern, ".blueprint/reports/milestone-summary-<milestone>.md");
  assert.equal(
    listRuntimeOwnedCommandMetadata().every((metadata) => !isControlPlaneDocPath(metadata.sourceId)),
    true
  );
});
