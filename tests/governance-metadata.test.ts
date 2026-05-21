import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

const governanceExpectations = {
  settings: {
    commandPath: "/blu-settings",
    manifestPath: "commands/blu-settings.toml",
    referencePath:
      "skills/blueprint-governance/references/settings-runtime-contract.md",
    tools: [
      "blueprint_project_status",
      "blueprint_config_get",
      "blueprint_config_set"
    ],
    manifestPatterns: [
      /explicit opt-in to save the resolved settings/i,
      /Pass a JSON-object `patch` only/i,
      /returned `configPath` as authoritative/i
    ],
    referencePatterns: [
      /## Confirmation Gates/,
      /Saved-defaults writes require explicit opt-in/i,
      /## Write Boundaries/,
      /Patches must be JSON objects/i
    ],
    hookInvolvement: ["read-before-edit", ".blueprint write guard"]
  },
  "set-profile": {
    commandPath: "/blu-set-profile",
    manifestPath: "commands/blu-set-profile.toml",
    referencePath:
      "skills/blueprint-governance/references/set-profile-runtime-contract.md",
    tools: ["blueprint_config_get", "blueprint_config_set_profile"],
    manifestPatterns: [
      /Echo the old `model_profile` value and the requested new value before saving/i,
      /Use this dedicated tool for `model_profile` changes/i,
      /`defaults\.json` was not modified/i
    ],
    referencePatterns: [
      /## Confirmation Gates/,
      /No extra confirmation is required/i,
      /## Write Boundaries/,
      /The only allowed write is `mcp_blueprint_blueprint_config_set_profile`/i
    ],
    hookInvolvement: ["read-before-edit", ".blueprint write guard"]
  },
  health: {
    commandPath: "/blu-health",
    manifestPath: "commands/blu-health.toml",
    referencePath:
      "skills/blueprint-governance/references/health-runtime-contract.md",
    tools: [
      "blueprint_project_status",
      "blueprint_config_get",
      "blueprint_config_set",
      "blueprint_state_load",
      "blueprint_artifact_list",
      "blueprint_artifact_validate",
      "blueprint_state_sync"
    ],
    manifestPatterns: [
      /`--repair` must never imply silent writes/i,
      /use `ask_user` for confirmation/i,
      /Explain exactly which config or state changes will be written/i
    ],
    referencePatterns: [
      /## Confirmation Gates/,
      /Before any repair write/i,
      /## Write Boundaries/,
      /Read-only mode performs no writes/i
    ]
  },
  "pause-work": {
    commandPath: "/blu-pause-work",
    manifestPath: "commands/blu-pause-work.toml",
    referencePath:
      "skills/blueprint-governance/references/pause-work-runtime-contract.md",
    tools: [
      "blueprint_state_load",
      "blueprint_artifact_list",
      "blueprint_pause_handoff_get",
      "blueprint_pause_handoff_write",
      "blueprint_state_update"
    ],
    manifestPatterns: [
      /explicit overwrite confirmation/i,
      /Do not write `\.blueprint\/reports\/` directly/i,
      /Do not create an automatic git commit/i
    ],
    referencePatterns: [
      /## Confirmation Gates/,
      /Replacing an existing active handoff requires explicit overwrite confirmation/i,
      /## Write Boundaries/,
      /Persistent writes are limited to `\.blueprint\/reports\/` and `\.blueprint\/STATE\.md`/i
    ]
  },
  "resume-work": {
    commandPath: "/blu-resume-work",
    manifestPath: "commands/blu-resume-work.toml",
    referencePath:
      "skills/blueprint-governance/references/resume-work-runtime-contract.md",
    tools: [
      "blueprint_project_status",
      "blueprint_state_load",
      "blueprint_artifact_list",
      "blueprint_pause_handoff_get",
      "blueprint_state_update"
    ],
    manifestPatterns: [
      /Preserve the canonical pause handoff report/i,
      /Keep persistent writes limited to `\.blueprint\/STATE\.md`/i,
      /do not rewrite or delete `\.blueprint\/reports\/pause-work-latest\.md`/i
    ],
    referencePatterns: [
      /## Confirmation Gates/,
      /No overwrite or deletion confirmation should be requested/i,
      /## Write Boundaries/,
      /Persistent writes are limited to `\.blueprint\/STATE\.md`/i
    ]
  }
} as const;

test("governance commands resolve catalog and runtime contracts from docless metadata", async () => {
  const catalog = await blueprintCommandCatalog();
  const skill = await fs.readFile(
    path.join(repoRoot, "skills/blueprint-governance/SKILL.md"),
    "utf8"
  );

  assert.match(skill, /Governance\s+commands do not declare optional agents/i);
  assert.match(skill, /same-named Gemini CLI agent\s+tool/i);
  assert.match(skill, /same-named tool is available in the current host session/i);
  assert.match(skill, /Do not\s+read, inline, or load any separate agent source/i);
  assert.doesNotMatch(skill, /subagent_type/i);
  assert.doesNotMatch(skill, /agent definition/i);
  assert.doesNotMatch(skill, /agents\/blueprint-/i);

  for (const [commandName, expectation] of Object.entries(governanceExpectations)) {
    const metadata = getRuntimeOwnedCommandMetadata(commandName);
    const entry = catalog.commands[commandName];
    const contract = await buildBlueprintCommandRuntimeContractResource(commandName);
    const [manifest, reference] = await Promise.all([
      fs.readFile(path.join(repoRoot, expectation.manifestPath), "utf8"),
      fs.readFile(path.join(repoRoot, expectation.referencePath), "utf8")
    ]);

    assert.ok(metadata, `${commandName} should have runtime-owned metadata`);
    assert.equal(entry.status, "implemented");
    assert.equal(entry.implemented, true);
    assert.equal(entry.specPath, `src/mcp/command-runtime-metadata.ts#${commandName}`);
    assert.equal(entry.specPath, metadata.sourceId);
    assert.deepEqual(entry.requiredTools, expectation.tools);
    assert.deepEqual(entry.requiredTools, [...metadata.requiredTools]);

    assert.equal(contract.spec?.path, metadata.sourceId);
    assert.deepEqual(contract.spec?.requiredTools, expectation.tools);
    assert.equal(contract.runtimeReference?.path, metadata.sourceId);
    assert.equal(contract.runtimeReference?.commandSpecPath, metadata.sourceId);
    assert.deepEqual(contract.runtimeReference?.exactMcpDestination, expectation.tools);
    if ("hookInvolvement" in expectation) {
      assert.deepEqual(
        contract.runtimeReference?.hookInvolvement,
        expectation.hookInvolvement
      );
    }
    assert.match(contract.runtimeReference?.contractNotes ?? "", /Docless manifest\+skill-owned runtime/i);
    assert.match(contract.runtimeReference?.contractNotes ?? "", new RegExp(
      expectation.referencePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    ));

    assert.deepEqual(contract.skillInputs.shared, []);
    assert.deepEqual(contract.skillInputs.commandSpecific, [expectation.referencePath]);
    assert.deepEqual(contract.skillInputs.effective, [expectation.referencePath]);
    assert.equal(
      contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
      false
    );

    for (const pattern of expectation.manifestPatterns) {
      assert.match(manifest, pattern);
    }

    for (const pattern of expectation.referencePatterns) {
      assert.match(reference, pattern);
    }
  }
});

test("governance runtime contracts do not fall back to docs inputs when docs are absent", async (t) => {
  const realReadFile = fs.readFile.bind(fs);
  const commandDocSuffixes = Object.keys(governanceExpectations).map(
    (commandName) => `/docs/commands/${commandName}.md`
  );

  t.mock.method(fs, "readFile", async (filePath, options) => {
    const normalizedPath =
      filePath instanceof URL ? filePath.pathname : path.resolve(String(filePath));

    if (
      normalizedPath.endsWith("/docs/COMMAND-CATALOG.md") ||
      normalizedPath.endsWith("/docs/RUNTIME-REFERENCE.md") ||
      commandDocSuffixes.some((suffix) => normalizedPath.endsWith(suffix))
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

  for (const [commandName, expectation] of Object.entries(governanceExpectations)) {
    const entry = catalog.commands[commandName];
    const contract = await buildBlueprintCommandRuntimeContractResource(commandName);

    assert.equal(entry.status, "implemented");
    assert.equal(entry.implemented, true);
    assert.equal(entry.specPath, `src/mcp/command-runtime-metadata.ts#${commandName}`);
    assert.equal(contract.spec?.path, `src/mcp/command-runtime-metadata.ts#${commandName}`);
    assert.equal(
      contract.runtimeReference?.commandSpecPath,
      `src/mcp/command-runtime-metadata.ts#${commandName}`
    );
    assert.deepEqual(contract.skillInputs.effective, [expectation.referencePath]);
    assert.equal(
      contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
      false
    );
  }
});
