import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  NEW_PROJECT_RUNTIME_METADATA,
  NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID
} from "../src/mcp/command-runtime-metadata.js";
import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();
const newProjectRuntimeInputBundle = [
  "skills/blueprint-bootstrap/references/bootstrap-runtime-contract.md"
];

test("new-project normal path is compact and exposes the runtime-owned authoring flow", async () => {
  const manifest = await readFile(path.join(repoRoot, "commands/blu-new-project.toml"), "utf8");
  const skill = await readFile(path.join(repoRoot, "skills/blueprint-bootstrap/SKILL.md"), "utf8");
  const guide = await readFile(path.join(repoRoot, newProjectRuntimeInputBundle[0]!), "utf8");
  const contract = await buildBlueprintCommandRuntimeContractResource("new-project");
  assert.ok(Buffer.byteLength(manifest + skill + guide) < 11000);
  assert.deepEqual(contract.skillInputs.effective, newProjectRuntimeInputBundle);
  assert.deepEqual(NEW_PROJECT_RUNTIME_METADATA.requiredInputPaths, newProjectRuntimeInputBundle);
  assert.equal(contract.catalog.implemented, true);
  assert.equal(contract.spec?.path, NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID);
  assert.equal(contract.spec?.executionProfile, "long-running-mutation");
  for (const tool of NEW_PROJECT_RUNTIME_METADATA.requiredTools) assert.match(skill + guide, new RegExp(blueprintRuntimeToolFqn(tool)));
  assert.match(manifest, /Ask a focused clarifying question and wait/);
  assert.match(guide, /Neither\s+saved `mode: auto`/);
  assert.match(guide, /Only|only/);
  assert.match(guide, /actual `clarification`/);
  assert.match(guide, /same bootstrapModel for preview and creation/);
  assert.doesNotMatch(manifest + skill + guide, /at least six meaningful words|must include 2-5/);
});

test("new-project remains implemented from runtime-owned metadata when docs are unavailable", async (t) => {
  const realReadFile = fs.readFile.bind(fs);

  t.mock.method(fs, "readFile", async (filePath, options) => {
    const normalizedPath =
      filePath instanceof URL ? fileURLToPath(filePath) : path.resolve(String(filePath));

    if (/\/docs\/.+\.md$/.test(normalizedPath)) {
      const error = new Error("simulated docs absence") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    }

    return realReadFile(
      filePath as Parameters<typeof fs.readFile>[0],
      options as Parameters<typeof fs.readFile>[1]
    );
  });

  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["new-project"];
  const contract = await buildBlueprintCommandRuntimeContractResource("new-project");

  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.specPath, NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID);
  assert.deepEqual(entry.requiredTools, [...NEW_PROJECT_RUNTIME_METADATA.requiredTools]);
  assert.deepEqual(entry.optionalAgents, [...NEW_PROJECT_RUNTIME_METADATA.optionalAgents]);
  assert.equal(contract.spec?.path, NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID);
  assert.equal(
    contract.runtimeReference?.commandSpecPath,
    NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID
  );
  assert.deepEqual(contract.skillInputs.shared, []);
  assert.deepEqual(contract.skillInputs.commandSpecific, newProjectRuntimeInputBundle);
  assert.deepEqual(contract.skillInputs.effective, newProjectRuntimeInputBundle);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
});

test("new-project is not implemented when a bundled bootstrap runtime input is missing", async (t) => {
  const runtimeInputPath = NEW_PROJECT_RUNTIME_METADATA.requiredInputPaths?.[0];
  const originalAccess = fs.access;

  assert.ok(runtimeInputPath);

  fs.access = (async (...args: Parameters<typeof fs.access>) => {
    const normalizedPath =
      args[0] instanceof URL ? fileURLToPath(args[0]) : path.resolve(String(args[0]));

    if (normalizedPath.endsWith(runtimeInputPath)) {
      const error = new Error("ENOENT");
      (error as NodeJS.ErrnoException).code = "ENOENT";
      throw error;
    }

    return originalAccess(...args);
  }) as typeof fs.access;
  t.after(() => {
    fs.access = originalAccess;
  });

  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["new-project"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "repairing");
  assert.equal(entry.implemented, false);
  assert.equal(entry.specPath, null);
  assert.match(
    entry.blockedBy.join("\n"),
    /Missing runtime input: skills\/blueprint-bootstrap\/references\/bootstrap-runtime-contract\.md/
  );
  await assert.rejects(
    () => buildBlueprintCommandRuntimeContractResource("new-project"),
    /Blueprint runtime-contract resources are available only for implemented commands: new-project/
  );
});

test("bootstrap contract keeps approval, mapping and optional-agent boundaries with first-pass authoring", async () => {
  const guide = await readFile(path.join(repoRoot, newProjectRuntimeInputBundle[0]!), "utf8");
  const skill = await readFile(path.join(repoRoot, "skills/blueprint-bootstrap/SKILL.md"), "utf8");
  assert.match(guide, /Unmapped brownfield/);
  assert.match(guide, /preserving `.blueprint\/codebase\/\*\.md`/);
  assert.match(guide, /explicit overwrite approval/);
  assert.match(guide, /Obtain explicit approval before interactive creation/);
  assert.match(guide, /Cancellation makes no writes/);
  assert.match(guide, /savedDefaultsPolicy: "skip"/);
  assert.match(guide, /Updating global saved defaults requires explicit/);
  assert.match(guide, /one precise\ncriterion is enough/);
  assert.match(skill, /workflow.subagents/);
  assert.match(skill, /Otherwise synthesize inline/);
  assert.match(skill, /only when discovery is difficult/);
  assert.match(skill, /only for recovery or unfamiliar host behavior/);
});
