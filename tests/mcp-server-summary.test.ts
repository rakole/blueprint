import test from "node:test";
import assert from "node:assert/strict";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import {
  BLUEPRINT_COMMAND_CATALOG_RESOURCE_URI,
  BLUEPRINT_COMMAND_RUNTIME_CONTRACT_URI_TEMPLATE,
  listBlueprintCommandRuntimeContractCommands
} from "../src/mcp/command-resources.js";
import { createBlueprintServer } from "../src/mcp/server.js";
import {
  createToolResponseContent,
  summarizeToolResult
} from "../src/mcp/server.js";

test("artifact read summaries keep the transcript concise", () => {
  const result = {
    phaseFound: true,
    found: true,
    phaseNumber: "1",
    phasePrefix: "01",
    phaseName: "Core Game (Requirements: R-01, R-02, R-03)",
    phaseDir: ".blueprint/phases/01-core-game",
    artifact: "context",
    path: ".blueprint/phases/01-core-game/01-CONTEXT.md",
    content: "# Phase 1 Context\n\n## Objective\nShip the playable game.\n",
    reason: null
  };

  const summary = summarizeToolResult("blueprint_phase_artifact_read", result);

  assert.equal(
    summary,
    "Loaded Phase 1 context at `.blueprint/phases/01-core-game/01-CONTEXT.md` (56 B)."
  );
  assert.doesNotMatch(summary, /Ship the playable game/);
  assert.doesNotMatch(summary, /\"phaseFound\"/);
});

test("tool response content returns the compact summary instead of pretty JSON", () => {
  const content = createToolResponseContent("blueprint_phase_artifact_read", {
    phaseFound: true,
    found: true,
    phaseNumber: "1",
    artifact: "context",
    path: ".blueprint/phases/01-core-game/01-CONTEXT.md",
    content: "# Phase 1 Context\n"
  });

  assert.deepEqual(content, [
    {
      type: "text",
      text: "Loaded Phase 1 context at `.blueprint/phases/01-core-game/01-CONTEXT.md` (18 B)."
    }
  ]);
});

test("missing reads surface the reason without dumping the result object", () => {
  const summary = summarizeToolResult("blueprint_phase_artifact_read", {
    phaseFound: true,
    found: false,
    phaseNumber: "7",
    artifact: "research",
    reason: "Artifact file does not exist yet."
  });

  assert.equal(summary, "No Phase 7 research found: Artifact file does not exist yet.");
});

test("invalid write results do not claim an artifact was saved", () => {
  const summary = summarizeToolResult("blueprint_phase_validation_write", {
    phaseNumber: "3",
    artifact: "verification",
    path: ".blueprint/phases/03-validation-engine/03-VERIFICATION.md",
    summaryPaths: [".blueprint/phases/03-validation-engine/03-01-SUMMARY.md"],
    written: false,
    created: false,
    overwritten: false,
    status: "invalid",
    issues: ["Missing required sections."],
    warnings: ["Validation contract mismatch."]
  });

  assert.equal(
    summary,
    "Did not save Phase 3 verification at `.blueprint/phases/03-validation-engine/03-VERIFICATION.md` status: invalid (1 summary links, 1 warnings)."
  );
});

test("reused write results report preservation instead of a fresh save", () => {
  const summary = summarizeToolResult("blueprint_phase_validation_write", {
    phaseNumber: "3",
    artifact: "verification",
    path: ".blueprint/phases/03-validation-engine/03-VERIFICATION.md",
    summaryPaths: [".blueprint/phases/03-validation-engine/03-01-SUMMARY.md"],
    written: false,
    created: false,
    overwritten: false,
    status: "reused",
    issues: [],
    warnings: ["Preserved existing verification artifact because the content was unchanged."]
  });

  assert.equal(
    summary,
    "Reused existing Phase 3 verification at `.blueprint/phases/03-validation-engine/03-VERIFICATION.md` status: reused (1 summary links, 1 warnings)."
  );
});

test("update summaries stay concise for advisory check and checklist persistence", () => {
  const checkSummary = summarizeToolResult("blueprint_update_check", {
    host: "gemini",
    extensionPath: "/Users/example/.gemini/extensions/blueprint",
    installedVersion: "0.1.0",
    latestVersionLookupStatus: "manual_only",
    updateAvailable: null,
    warnings: ["Blueprint update inspection could not find a git remote for the installed extension; use the manual update checklist."]
  });
  const planSummary = summarizeToolResult("blueprint_update_plan", {
    mode: "manual",
    metadataPath: "/Users/example/.gemini/blueprint/updates/update-plan-latest.json",
    checklistPath: "/Users/example/.gemini/blueprint/updates/update-plan-latest.md",
    status: "created",
    steps: Array.from({ length: 7 }, () => "step"),
    notes: ["note 1", "note 2"],
    warnings: ["Latest version lookup unavailable."],
    requiresRestart: true
  });

  assert.equal(checkSummary, "Checked Blueprint update status (1 warnings).");
  assert.equal(
    planSummary,
    "Prepared Blueprint update plan at `/Users/example/.gemini/blueprint/updates/update-plan-latest.json` status: created (7 steps, 2 notes)."
  );
});

test("server exposes read-only command resources without changing tool summaries", async () => {
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-resource-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const expectedRuntimeContractUris = (
    await listBlueprintCommandRuntimeContractCommands()
  ).map((command) => `blueprint://commands/${encodeURIComponent(command)}/runtime-contract`);

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const [resources, templates, catalogRead] = await Promise.all([
      client.listResources(),
      client.listResourceTemplates(),
      client.readResource({ uri: BLUEPRINT_COMMAND_CATALOG_RESOURCE_URI })
    ]);

    assert.ok(
      resources.resources.some((resource) => resource.uri === BLUEPRINT_COMMAND_CATALOG_RESOURCE_URI)
    );
    assert.ok(
      templates.resourceTemplates.some(
        (resourceTemplate) =>
          resourceTemplate.uriTemplate === BLUEPRINT_COMMAND_RUNTIME_CONTRACT_URI_TEMPLATE
      )
    );
    const runtimeContractTemplate = templates.resourceTemplates.find(
      (resourceTemplate) =>
        resourceTemplate.uriTemplate === BLUEPRINT_COMMAND_RUNTIME_CONTRACT_URI_TEMPLATE
    );
    const helpRuntimeContractResource = resources.resources.find(
      (resource) => resource.uri === "blueprint://commands/help/runtime-contract"
    );

    assert.match(
      runtimeContractTemplate?.description ?? "",
      /implemented Blueprint command/i
    );
    assert.match(
      runtimeContractTemplate?.description ?? "",
      /review.*excluded|excluded.*review/i
    );
    assert.match(
      helpRuntimeContractResource?.description ?? "",
      /implemented Blueprint command/i
    );
    assert.match(
      helpRuntimeContractResource?.description ?? "",
      /review.*excluded|excluded.*review/i
    );

    const runtimeContractResources = resources.resources
      .map((resource) => resource.uri)
      .filter((uri) => uri.startsWith("blueprint://commands/") && uri.endsWith("/runtime-contract"))
      .sort();

    assert.deepEqual(
      [...runtimeContractResources].sort((left, right) => left.localeCompare(right)),
      [...expectedRuntimeContractUris].sort((left, right) => left.localeCompare(right))
    );
    assert.ok(runtimeContractResources.includes("blueprint://commands/help/runtime-contract"));
    assert.ok(!runtimeContractResources.includes("blueprint://commands/do/runtime-contract"));
    assert.ok(!runtimeContractResources.includes("blueprint://commands/review/runtime-contract"));

    const catalogPayload = JSON.parse(catalogRead.contents[0].text);
    assert.equal(catalogPayload.commands.help.status, "implemented");
    assert.equal(catalogPayload.commands.help.implemented, true);

    const helpContractRead = await client.readResource({
      uri: "blueprint://commands/help/runtime-contract"
    });
    const helpContractPayload = JSON.parse(helpContractRead.contents[0].text);

    assert.equal(helpContractPayload.command, "help");
    assert.equal(helpContractPayload.catalog.status, "implemented");
    assert.equal(helpContractPayload.catalog.implemented, true);

    await assert.rejects(
      client.readResource({ uri: "blueprint://commands/do/runtime-contract" }),
      /Blueprint runtime-contract resources are available only for implemented commands: do/
    );
    await assert.rejects(
      client.readResource({ uri: "blueprint://commands/review/runtime-contract" }),
      /Blueprint runtime-contract resources intentionally exclude this command today: review/
    );

    const contractReads = await Promise.all(
      runtimeContractResources.map((uri) => client.readResource({ uri }))
    );

    for (const contractRead of contractReads) {
      const contractPayload = JSON.parse(contractRead.contents[0].text);

      assert.equal(
        contractPayload.uri,
        `blueprint://commands/${encodeURIComponent(contractPayload.command)}/runtime-contract`
      );
      assert.equal(contractPayload.catalog.status, "implemented");
      assert.equal(contractPayload.catalog.implemented, true);
      assert.ok(contractPayload.spec);
      assert.equal(contractPayload.spec.path, contractPayload.catalog.specPath);
      assert.ok(contractPayload.runtimeReference);
      assert.equal(contractPayload.runtimeReference.command, contractPayload.command);
      assert.equal(
        contractPayload.runtimeReference.commandSpecPath,
        contractPayload.catalog.specPath
      );
    }
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
});
