import test from "node:test";
import assert from "node:assert/strict";

import { readArtifactContract } from "../src/mcp/artifact-contracts/index.js";

test("phase.context exposes a schema-backed model contract matching the Markdown contract", () => {
  const contract = readArtifactContract("phase.context", {
    phaseLabel: "Phase 07: Context Contract Parity"
  });
  const modelContract = contract.modelContract;

  assert.ok(modelContract);
  assert.equal(modelContract.schemaId, "blueprint.phase.context.model");
  assert.equal(modelContract.schemaVersion, "1.0.0");
  assert.equal(
    modelContract.schemaPath,
    "src/mcp/artifact-contracts/schemas/phase.context.model.schema.json"
  );
  assert.deepEqual(modelContract.renderedHeadings, contract.requiredHeadings);

  for (const heading of contract.requiredHeadings) {
    assert.match(contract.authoringTemplate, new RegExp(`## ${heading}`));
  }

  const required = modelContract.jsonSchema.required as string[];
  assert.deepEqual(required, [
    "phaseBoundary",
    "discoveryGrounding",
    "implementationDecisions",
    "specificIdeas",
    "existingCodeInsights",
    "dependencies",
    "openQuestions",
    "deferredIdeas",
    "canonicalReferences"
  ]);

  const properties = modelContract.jsonSchema.properties as Record<string, unknown>;
  assert.equal("cwd" in properties, false);
  assert.equal("phase" in properties, false);
  assert.equal("phaseDir" in properties, false);
  assert.equal("artifact" in properties, false);
  assert.equal("path" in properties, false);
  assert.equal("content" in properties, false);
  assert.ok("phaseBoundary" in properties);
  assert.ok("canonicalReferences" in properties);

  assert.ok(
    modelContract.contextBindings.some((binding) =>
      /blueprint_phase_locate plus blueprint_phase_artifact_write/i.test(binding)
    )
  );
  assert.ok(
    modelContract.qualityRules.some((rule) =>
      /preserve the exact headings in renderedHeadings/i.test(rule)
    )
  );
  assert.ok(
    modelContract.exampleLeakageSignals.some((signal) =>
      /Renderer-specific model persistence/i.test(signal)
    )
  );
});
