import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { NEXT_RUNTIME_METADATA } from "../src/mcp/command-runtime-metadata.js";
import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

test("next command manifest references only registered read-oriented router tools", async () => {
  const raw = await readFile(path.join(repoRoot, "commands/blu-next.toml"), "utf8");
  const expectedTools = [
    "blueprint_project_status",
    "blueprint_state_load",
    "blueprint_artifact_list",
    "blueprint_command_catalog"
  ];

  for (const toolName of expectedTools) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
    assert.match(raw, new RegExp(toolName));
  }

  assert.doesNotMatch(raw, /blueprint_state_update|blueprint_config_set|blueprint_artifact_scaffold/);
});

test("next command manifest preserves safe fallback and routing guarantees", async () => {
  const raw = await readFile(path.join(repoRoot, "commands/blu-next.toml"), "utf8");

  assert.match(raw, /\/blu-new-project/);
  assert.match(raw, /\/blu-health/);
  assert.match(
    raw,
    /Recommend `?\/blu-spec-phase <phase>`? only when its catalog entry is `implemented: true`/i
  );
  assert.match(raw, /implemented: true/);
  assert.match(raw, /Do not turn a missing spec alone into a normal lifecycle blocker/i);
  assert.match(raw, /waiting-state reporting/);
  assert.match(raw, /next safe follow-up/);
  assert.match(raw, /Do not write files, mutate config, or call write-oriented MCP tools/);
  assert.match(raw, /Never rely on slash-command chaining, hidden aliases, or implicit destructive behavior/);
});

test("next runtime reference preserves waiting-state and fallback alignment", async () => {
  const runtimeReference = await readFile(
    path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"),
    "utf8"
  );

  assert.match(
    runtimeReference,
    /`next`[\s\S]*report waiting state and the next safe follow-up explicitly/i
  );
  assert.match(
    runtimeReference,
    /\|\s*`next`\s*\|\s*`src\/mcp\/command-runtime-metadata\.ts#next`\s*\|/
  );
  assert.match(runtimeReference, /never hide destructive behavior behind implicit routing\./);
  assert.match(
    runtimeReference,
    /Recommend `?\/blu-spec-phase <phase>`? only after `?blueprint_command_catalog`? proves it implemented/i
  );
  assert.match(
    runtimeReference,
    /do not treat missing `?XX-SPEC\.md`? alone as a normal lifecycle blocker/i
  );
  assert.match(
    runtimeReference,
    /\| `next` [^\n]+ \| `locked`; `source-owned`; `needs-behavior-audit` \|/
  );
});

test("next is exposed as an implemented router command with no blockers", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["next"];

  assert.equal(entry.implemented, true);
  assert.equal(entry.status, "implemented");
  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, "commands/blu-next.toml");
  assert.equal(entry.specPath, NEXT_RUNTIME_METADATA.sourceId);
  assert.deepEqual(entry.blockedBy, []);
});

test("next runtime contract is source-owned and uses only the command manifest as active input", async () => {
  const contract = await buildBlueprintCommandRuntimeContractResource("next");

  assert.equal(contract.spec?.path, NEXT_RUNTIME_METADATA.sourceId);
  assert.equal(contract.spec?.executionProfile, "router");
  assert.equal(contract.spec?.primarySkill, "blueprint-router");
  assert.deepEqual(contract.spec?.requiredTools, [...NEXT_RUNTIME_METADATA.requiredTools]);
  assert.deepEqual(contract.spec?.writes, []);
  assert.equal(contract.runtimeReference?.path, NEXT_RUNTIME_METADATA.sourceId);
  assert.equal(contract.runtimeReference?.commandSpecPath, NEXT_RUNTIME_METADATA.sourceId);
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
    commandSpecific: ["commands/blu-next.toml"],
    effective: ["commands/blu-next.toml"]
  });
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
});

test("next remains implemented when docs-backed command specs are unavailable", async (t) => {
  const realReadFile = fs.readFile.bind(fs);

  t.mock.method(fs, "readFile", async (filePath, options) => {
    const normalizedPath =
      filePath instanceof URL ? filePath.pathname : path.resolve(String(filePath));

    if (
      normalizedPath.endsWith("/docs/COMMAND-CATALOG.md") ||
      normalizedPath.endsWith("/docs/RUNTIME-REFERENCE.md") ||
      normalizedPath.endsWith("/docs/commands/next.md")
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
  const contract = await buildBlueprintCommandRuntimeContractResource("next");

  assert.equal(catalog.commands.next.status, "implemented");
  assert.equal(catalog.commands.next.implemented, true);
  assert.equal(catalog.commands.next.specPath, NEXT_RUNTIME_METADATA.sourceId);
  assert.equal(contract.spec?.path, NEXT_RUNTIME_METADATA.sourceId);
  assert.deepEqual(contract.skillInputs.effective, ["commands/blu-next.toml"]);
});
