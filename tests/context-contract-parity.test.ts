import test from "node:test";
import assert from "node:assert/strict";

import {
  readArtifactContract,
  renderArtifactAuthoringTemplate
} from "../src/mcp/artifact-contracts/index.js";

test("phase.context exposes a schema-backed model contract without a read-time authoring template", () => {
  const contract = readArtifactContract("phase.context", {
    phaseLabel: "Phase 07: Context Contract Parity"
  });
  const modelContract = contract.modelContract;
  const authoringTemplate = renderArtifactAuthoringTemplate("phase.context", {
    phaseLabel: "Phase 07: Context Contract Parity"
  });

  assert.ok(modelContract);
  assert.equal("authoringTemplate" in contract, false);
  assert.equal(modelContract.schemaId, "blueprint.phase.context.model");
  assert.equal(modelContract.schemaVersion, "1.0.0");
  assert.equal(
    modelContract.schemaPath,
    "src/mcp/artifact-contracts/schemas/phase.context.model.schema.json"
  );
  assert.deepEqual(modelContract.renderedHeadings, contract.requiredHeadings);

  for (const heading of contract.requiredHeadings) {
    assert.match(authoringTemplate, new RegExp(`## ${heading}`));
  }

  assert.equal(
    contract.sectionValidations?.["Open Questions"]?.exactEmptySentinel,
    "- none"
  );
  assert.equal(
    contract.sectionValidations?.["Deferred Ideas"]?.exactEmptySentinel,
    "- none"
  );

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
  assert.match(
    String((properties.openQuestions as { description?: string }).description),
    /use an empty array when no open questions remain/i
  );
  assert.match(
    String((properties.openQuestions as { description?: string }).description),
    /\["none"\].*older saved model inputs/i
  );
  assert.match(
    String((properties.deferredIdeas as { description?: string }).description),
    /empty array only when nothing is deferred/i
  );

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
    modelContract.qualityRules.some((rule) =>
      /openQuestions: \[\].*no unresolved questions left/i.test(rule)
    )
  );
  assert.ok(
    modelContract.exampleLeakageSignals.some((signal) =>
      /Renderer-specific model persistence/i.test(signal)
    )
  );
});

test("phase.verification exposes a schema-backed model contract without a read-time authoring template", () => {
  const contract = readArtifactContract("phase.verification", {
    phaseLabel: "Phase 07: Verification Contract Parity"
  });
  const modelContract = contract.modelContract;
  const authoringTemplate = renderArtifactAuthoringTemplate("phase.verification", {
    phaseLabel: "Phase 07: Verification Contract Parity"
  });

  assert.ok(modelContract);
  assert.equal("authoringTemplate" in contract, false);
  assert.equal(modelContract.schemaId, "blueprint.phase.verification.model");
  assert.equal(modelContract.schemaVersion, "1.1.0");
  assert.equal(
    modelContract.schemaPath,
    "src/mcp/artifact-contracts/schemas/phase.verification.model.schema.json"
  );
  assert.deepEqual(contract.requiredHeadings, [
    "Validation Summary",
    "Requirement / Task Coverage",
    "Evidence Reviewed",
    "Test Infrastructure / Evidence Metadata",
    "Manual-Only or Deferred Coverage",
    "Gate State",
    "Gap Classification",
    "Gaps Found",
    "Suggested Repairs",
    "Next Safe Action"
  ]);
  assert.ok(modelContract.renderedHeadings.includes("Validation Test Matrix"));

  for (const heading of contract.requiredHeadings) {
    assert.match(authoringTemplate, new RegExp(`## ${heading}`));
  }

  assert.match(authoringTemplate, /\*\*Gate State:\*\*/);
  assert.match(authoringTemplate, /\*\*Sign-off:\*\*/);
  assert.ok(
    modelContract.contextBindings.some((binding) =>
      /context\.summaryPaths and context\.summaryEvidence/i.test(binding)
    )
  );
  assert.ok(
    modelContract.qualityRules.some((rule) =>
      /allowed coverage states.*allowedValues/i.test(rule)
    )
  );
});

test("phase.uat exposes a schema-backed model contract without a read-time authoring template", () => {
  const contract = readArtifactContract("phase.uat", {
    phaseLabel: "Phase 07: UAT Contract Parity"
  });
  const modelContract = contract.modelContract;
  const authoringTemplate = renderArtifactAuthoringTemplate("phase.uat", {
    phaseLabel: "Phase 07: UAT Contract Parity"
  });

  assert.ok(modelContract);
  assert.equal("authoringTemplate" in contract, false);
  assert.equal(modelContract.schemaId, "blueprint.phase.uat.model");
  assert.equal(modelContract.schemaVersion, "1.0.0");
  assert.equal(
    modelContract.schemaPath,
    "src/mcp/artifact-contracts/schemas/phase.uat.model.schema.json"
  );
  assert.deepEqual(contract.requiredHeadings, [
    "UAT Summary",
    "Session State",
    "Current Test",
    "Test Matrix",
    "Result Summary",
    "Questions Asked",
    "Observed Behavior",
    "Unresolved Gaps",
    "Structured Gaps",
    "Follow-Up Fixes",
    "Next Safe Action"
  ]);
  assert.ok(modelContract.renderedHeadings.includes("Test Matrix"));
  assert.ok(modelContract.renderedHeadings.includes("Structured Gaps"));

  for (const heading of contract.requiredHeadings) {
    assert.match(authoringTemplate, new RegExp(`## ${heading}`));
  }

  assert.match(authoringTemplate, /\*\*Status:\*\*/);
  assert.match(authoringTemplate, /\*\*Resume State:\*\*/);
  assert.match(authoringTemplate, /\*\*Checkpoint:\*\*/);
  assert.ok(
    modelContract.contextBindings.some((binding) =>
      /ready verification content/i.test(binding)
    )
  );
  assert.ok(
    modelContract.qualityRules.some((rule) =>
      /Ground UAT summary, session state, test matrix, and observed behavior/i.test(rule)
    )
  );
});

test("report.add-tests exposes a schema-backed model contract without a read-time authoring template", () => {
  const contract = readArtifactContract("report.add-tests", {
    phaseLabel: "Phase 07: Add Tests Contract Parity"
  });
  const modelContract = contract.modelContract;
  const authoringTemplate = renderArtifactAuthoringTemplate("report.add-tests", {
    phaseLabel: "Phase 07: Add Tests Contract Parity"
  });

  assert.ok(modelContract);
  assert.equal("authoringTemplate" in contract, false);
  assert.equal(modelContract.schemaId, "blueprint.report.add-tests.model");
  assert.equal(modelContract.schemaVersion, "1.0.0");
  assert.equal(
    modelContract.schemaPath,
    "src/mcp/artifact-contracts/schemas/report.add-tests.model.schema.json"
  );
  assert.deepEqual(contract.requiredHeadings, [
    "Coverage Goal",
    "Evidence Used",
    "Classification And Test Plan",
    "Tests Added Or Updated",
    "Remaining Gaps",
    "Next Safe Action"
  ]);
  assert.ok(modelContract.renderedHeadings.includes("Classification And Test Plan"));
  assert.ok(modelContract.renderedHeadings.includes("Tests Added Or Updated"));

  for (const heading of contract.requiredHeadings) {
    assert.match(authoringTemplate, new RegExp(`## ${heading}`));
  }

  assert.match(authoringTemplate, /Result counts: generated <N>, passing <N>, failing <N>, blocked <N>/);
  assert.match(authoringTemplate, /Verification write status: <created, updated, reused, invalid, or blocked>\./);
  assert.match(authoringTemplate, /Report write status: <created, updated, reused, invalid, or blocked>\./);
  assert.ok(
    modelContract.contextBindings.some((binding) =>
      /validation or UAT artifact is required upstream context/i.test(binding)
    )
  );
  assert.ok(
    modelContract.qualityRules.some((rule) =>
      /Do not include MCP-owned identity or provenance keys/i.test(rule)
    )
  );
});
