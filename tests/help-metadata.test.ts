import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { HELP_RUNTIME_METADATA } from "../src/mcp/command-runtime-metadata.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

test("help manifest and runtime reference stay aligned on router profile and waiting-state guidance", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-help.toml"), "utf8");
  const runtimeContract = await buildBlueprintCommandRuntimeContractResource("help");
  const manifestTools = [
    ...new Set(
      [...commandFile.matchAll(/mcp_blueprint_blueprint_[a-z0-9_]+/g)].map((match) => match[0])
    )
  ].sort();

  assert.match(commandFile, /Execution profile: router\./);
  assert.match(commandFile, /blueprint-router/);
  assert.deepEqual(manifestTools, [
    "mcp_blueprint_blueprint_command_catalog",
    "mcp_blueprint_blueprint_project_status"
  ]);
  assert.match(commandFile, /implemented: true/);
  assert.match(commandFile, /\/blu-new-project/);
  assert.match(commandFile, /\/blu-health/);
  assert.match(
    commandFile,
    /Return concise routing guidance for the commands that are safe and relevant in the current repo state, including what Blueprint is waiting on and the next safe action\./
  );
  assert.match(
    commandFile,
    /partial repo repair, missing artifact, verification debt, or blocked substrate/
  );
  assert.match(
    commandFile,
    /Explain blocked commands as blocked; do not present them as runnable\./
  );

  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /report the waiting state from project status/i
  );
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /keep the next safe action explicit/i
  );
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /Recommend `?\/blu-spec-phase <phase>`? only after `?blueprint_command_catalog`? proves it implemented/i
  );
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /do not treat missing `?XX-SPEC\.md`? alone as a normal lifecycle blocker/i
  );
  assert.deepEqual(runtimeContract.runtimeReference?.evidenceState, [
    "locked",
    "source-owned",
    "needs-behavior-audit"
  ]);
});

test("help runtime contract is source-owned and uses only the command manifest as active input", async () => {
  const [catalog, contract] = await Promise.all([
    blueprintCommandCatalog(),
    buildBlueprintCommandRuntimeContractResource("help")
  ]);
  const entry = catalog.commands.help;

  assert.equal(entry.specPath, HELP_RUNTIME_METADATA.sourceId);
  assert.deepEqual(entry.requiredTools, [...HELP_RUNTIME_METADATA.requiredTools]);
  assert.equal(contract.spec?.path, HELP_RUNTIME_METADATA.sourceId);
  assert.equal(contract.spec?.executionProfile, "router");
  assert.equal(contract.spec?.primarySkill, "blueprint-router");
  assert.deepEqual(contract.spec?.requiredTools, [...HELP_RUNTIME_METADATA.requiredTools]);
  assert.deepEqual(contract.spec?.writes, []);
  assert.equal(contract.runtimeReference?.path, HELP_RUNTIME_METADATA.sourceId);
  assert.equal(contract.runtimeReference?.commandSpecPath, HELP_RUNTIME_METADATA.sourceId);
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /\/blu-spec-phase <phase>[\s\S]*blueprint_command_catalog[\s\S]*implemented/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /missing XX-SPEC\.md alone as a normal lifecycle blocker/i
  );
  assert.deepEqual(contract.runtimeReference?.evidenceState, [
    "locked",
    "source-owned",
    "needs-behavior-audit"
  ]);
  assert.deepEqual(contract.skillInputs, {
    skill: "blueprint-router",
    shared: [],
    commandSpecific: ["commands/blu-help.toml"],
    effective: ["commands/blu-help.toml"]
  });
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
});

test("help remains implemented when docs-backed command specs are unavailable", async (t) => {
  const realReadFile = fs.readFile.bind(fs);

  t.mock.method(fs, "readFile", async (filePath, options) => {
    const normalizedPath =
      filePath instanceof URL ? filePath.pathname : path.resolve(String(filePath));

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
  const contract = await buildBlueprintCommandRuntimeContractResource("help");

  assert.equal(catalog.commands.help.status, "implemented");
  assert.equal(catalog.commands.help.implemented, true);
  assert.equal(catalog.commands.help.specPath, HELP_RUNTIME_METADATA.sourceId);
  assert.equal(contract.spec?.path, HELP_RUNTIME_METADATA.sourceId);
  assert.deepEqual(contract.skillInputs.effective, ["commands/blu-help.toml"]);
});
