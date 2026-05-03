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
  const runtimeReference = await readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8");
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
    runtimeReference,
    /\| `help` \| `src\/mcp\/command-runtime-metadata\.ts#help` \| `blueprint-router` \| `blueprint_command_catalog`<br>`blueprint_project_status` \|/
  );
  assert.match(
    runtimeReference,
    /Router profile; report the waiting state from project status, keep the next safe action explicit, and never present planned or blocked commands as runnable\./
  );
  assert.match(
    runtimeReference,
    /\| `help` [^\n]+ \| `locked`; `source-owned`; `needs-behavior-audit` \|/
  );
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

    if (
      normalizedPath.endsWith("/docs/COMMAND-CATALOG.md") ||
      normalizedPath.endsWith("/docs/RUNTIME-REFERENCE.md") ||
      normalizedPath.endsWith("/docs/commands/help.md")
    ) {
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
