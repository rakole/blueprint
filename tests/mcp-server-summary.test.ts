import test from "node:test";
import assert from "node:assert/strict";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import {
  BLUEPRINT_COMMAND_CATALOG_RESOURCE_URI,
  BLUEPRINT_COMMAND_RUNTIME_CONTRACT_URI_TEMPLATE,
  listBlueprintCommandRuntimeContractCommands
} from "../src/mcp/command-resources.js";
import { NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID } from "../src/mcp/command-runtime-metadata.js";
import { createBlueprintServer } from "../src/mcp/server.js";
import {
  createToolResponseContent,
  summarizeToolResult
} from "../src/mcp/server.js";

function expectedStructuredContentText(
  toolName: string,
  result: Record<string, unknown>
): string {
  return `${summarizeToolResult(toolName, result)} Detailed data is available in structuredContent.`;
}

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

test("schema-first authoring and validation tools point to structuredContent", () => {
  const summaryAuthoringResult = {
    status: "ready",
    phaseNumber: "3",
    planId: "01",
    taskSchema: { properties: { status: { enum: ["COMPLETED"] } } }
  };
  const reportValidationResult = {
    status: "invalid",
    valid: false,
    reportName: "audit-fix-3",
    taskSchema: { properties: { reportStatus: { enum: ["BLOCKED"] } } },
    normalizedModel: { reportStatus: "BLOCKED" },
    diagnostics: [
      {
        message: "report.add-tests model is missing required evidence coverage."
      }
    ]
  };
  const summaryAuthoringText = createToolResponseContent(
    "blueprint_phase_summary_authoring_context",
    summaryAuthoringResult
  )[0].text;
  const reportValidationText = createToolResponseContent(
    "blueprint_artifact_report_validate_model",
    reportValidationResult
  )[0].text;

  assert.equal(
    summaryAuthoringText,
    expectedStructuredContentText(
      "blueprint_phase_summary_authoring_context",
      summaryAuthoringResult
    )
  );
  assert.equal(
    reportValidationText,
    expectedStructuredContentText(
      "blueprint_artifact_report_validate_model",
      reportValidationResult
    )
  );
  assert.doesNotMatch(summaryAuthoringText, /taskSchema|COMPLETED/);
  assert.doesNotMatch(reportValidationText, /normalizedModel|BLOCKED|taskSchema/);
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
    "Did not save Phase 3 verification at `.blueprint/phases/03-validation-engine/03-VERIFICATION.md` status: invalid (1 summary links, 1 warnings). Diagnostics: Missing required sections."
  );
});

test("invalid write summaries surface nested validation issues", () => {
  const summary = summarizeToolResult("blueprint_phase_plan_write", {
    phaseNumber: "3",
    planId: "01",
    path: ".blueprint/phases/03-validation-engine/03-01-PLAN.md",
    written: false,
    created: false,
    overwritten: false,
    status: "invalid",
    validation: {
      valid: false,
      issues: [
        "Phase plan model requirementCoverage must include exactly one row for LIFE-02.",
        "Modified file src/mcp/tools/phase.ts is missing from fileSurfaceCoverage.",
        "Plan dependency cycle detected: 01 -> 02 -> 01.",
        "Acceptance criterion is not objectively verifiable."
      ],
      warnings: []
    },
    warnings: []
  });

  assert.equal(
    summary,
    "Did not save Phase 3 plan 01 at `.blueprint/phases/03-validation-engine/03-01-PLAN.md` status: invalid. Diagnostics: Phase plan model requirementCoverage must include exactly one row for LIFE-02; Modified file src/mcp/tools/phase.ts is missing from fileSurfaceCoverage; Plan dependency cycle detected: 01 -> 02 -> 01 (+1 more)."
  );
});

test("invalid model validation summaries surface diagnostic messages", () => {
  const summary = summarizeToolResult("blueprint_phase_plan_validate_model", {
    status: "invalid",
    valid: false,
    phase: null,
    planId: "01",
    path: ".blueprint/phases/03-validation-engine/03-01-PLAN.md",
    diagnostics: [
      {
        source: "schema",
        path: "model.evidenceCoverage",
        code: "schema.exactCoverage",
        message:
          "Phase plan model evidenceCoverage must include exactly one row for known saved evidence artifact .blueprint/phases/03-validation-engine/03-CONTEXT.md."
      }
    ],
    warnings: []
  });

  assert.equal(
    summary,
    "Completed phase plan validate model at `.blueprint/phases/03-validation-engine/03-01-PLAN.md` status: invalid. Diagnostics: Phase plan model evidenceCoverage must include exactly one row for known saved evidence artifact .blueprint/phases/03-validation-engine/03-CONTEXT.md."
  );
});

test("phase plan model tools keep rich schema details out of MCP text", () => {
  const planDiagnostics = [
    {
      source: "schema",
      path: "model.requirementCoverage",
      code: "schema.exactCoverage",
      message: "Phase plan model requirementCoverage must include exactly one row for LIFE-02.",
      suggestion: "Add a requirementCoverage row for LIFE-02."
    },
    {
      source: "schema",
      path: "model.fileSurfaceCoverage",
      code: "schema.exactCoverage",
      message: "Modified file src/mcp/tools/phase.ts is missing from fileSurfaceCoverage.",
      suggestion: "Add src/mcp/tools/phase.ts to fileSurfaceCoverage."
    },
    {
      source: "scope",
      path: "model.dependsOn",
      code: "scope.dependencyCycle",
      message: "Plan dependency cycle detected: 01 -> 02 -> 01.",
      suggestion: "Remove the cyclic dependency."
    },
    {
      source: "residual",
      path: "model.tasks[0].acceptanceCriteria[0]",
      code: "residual.verifiability",
      message: "Acceptance criterion is not objectively verifiable.",
      suggestion: "Rewrite the acceptance criterion as an observable check."
    }
  ];
  const repairSummary = {
    blockingCount: 4,
    firstPassActions: ["add", "remove", "make-verifiable"],
    reReadAuthoringContext: true,
    retryInstruction:
      "Repair all diagnostics against the runtime task schema, then re-read authoring context before retrying."
  };
  const taskSchema = {
    properties: {
      requirements: { items: { enum: ["LIFE-01", "LIFE-02"] } },
      dependsOn: { items: { enum: ["02"] } }
    }
  };
  const authoringResult = {
    status: "invalid",
    phase: { phaseNumber: "3" },
    planId: "01",
    path: ".blueprint/phases/03-validation-engine/03-01-PLAN.md",
    schemaPath: "schemas/phase-plan.schema.json",
    knownRequirements: ["LIFE-01", "LIFE-02"],
    knownEvidenceArtifacts: [
      ".blueprint/phases/03-validation-engine/03-CONTEXT.md",
      ".blueprint/phases/03-validation-engine/03-RESEARCH.md"
    ],
    allowedDependencyPlanIds: ["02"],
    baseSchema: { $id: "blueprint.phase.plan.model" },
    taskSchema,
    reason: "Phase plan authoring requires at least one roadmap requirement."
  };
  const validateResult = {
    status: "invalid",
    valid: false,
    target: {
      artifact: "phase.plan",
      phaseNumber: "3",
      phasePrefix: "03",
      phaseName: "Validation Engine",
      planId: "01",
      path: ".blueprint/phases/03-validation-engine/03-01-PLAN.md",
      schemaPath: "schemas/phase-plan.schema.json"
    },
    repairSummary,
    phase: { phaseNumber: "3" },
    planId: "01",
    path: ".blueprint/phases/03-validation-engine/03-01-PLAN.md",
    schemaPath: "schemas/phase-plan.schema.json",
    taskSchema,
    diagnostics: planDiagnostics,
    diagnosticCounts: {
      total: 4,
      bySource: { schema: 2, scope: 1, residual: 1 },
      byCode: {
        "schema.exactCoverage": 2,
        "scope.dependencyCycle": 1,
        "residual.verifiability": 1
      }
    },
    normalizedModel: { title: "Repair validation plan" },
    renderPreview: "# Phase 03: Validation Engine - Plan 01\n",
    warnings: []
  };
  const writeResult = {
    phaseNumber: "3",
    planId: "01",
    path: ".blueprint/phases/03-validation-engine/03-01-PLAN.md",
    written: false,
    created: false,
    overwritten: false,
    status: "invalid",
    validation: {
      valid: false,
      issues: planDiagnostics.map((diagnostic) => diagnostic.message),
      warnings: []
    },
    modelValidation: {
      diagnostics: planDiagnostics,
      repairSummary,
      taskSchema
    },
    warnings: []
  };
  const authoringText = createToolResponseContent(
    "blueprint_phase_plan_authoring_context",
    authoringResult
  )[0].text;
  const validateText = createToolResponseContent(
    "blueprint_phase_plan_validate_model",
    validateResult
  )[0].text;
  const writeText = createToolResponseContent("blueprint_phase_plan_write", writeResult)[0].text;

  assert.equal(
    authoringText,
    expectedStructuredContentText("blueprint_phase_plan_authoring_context", authoringResult)
  );
  assert.doesNotMatch(authoringText, /## Runtime Task Schema/);
  assert.doesNotMatch(authoringText, /## Base Model Schema/);
  assert.doesNotMatch(authoringText, /## Invalid Reason/);
  assert.equal(
    validateText,
    expectedStructuredContentText("blueprint_phase_plan_validate_model", validateResult)
  );
  assert.doesNotMatch(validateText, /## Diagnostics/);
  assert.doesNotMatch(validateText, /## Diagnostic Counts/);
  assert.doesNotMatch(validateText, /## Repair Summary/);
  assert.doesNotMatch(validateText, /## Target/);
  assert.doesNotMatch(validateText, /## Runtime Task Schema/);
  assert.doesNotMatch(validateText, /## Normalized Model/);
  assert.doesNotMatch(validateText, /## Render Preview/);
  assert.equal(
    writeText,
    expectedStructuredContentText("blueprint_phase_plan_write", writeResult)
  );
  assert.doesNotMatch(writeText, /## Model Diagnostics/);
  assert.doesNotMatch(writeText, /## Model Repair Summary/);
  assert.doesNotMatch(writeText, /## Model Runtime Task Schema/);
});

test("review model tools keep authoring context and repair details out of MCP text", () => {
  const authoringResult = {
    status: "ready",
    artifact: "security",
    phase: { phaseNumber: "5" },
    authoringContext: {
      knownEvidenceArtifacts: [
        ".blueprint/phases/05-security-audit/05-01-PLAN.md",
        ".blueprint/phases/05-security-audit/05-01-SUMMARY.md"
      ],
      allowedNextActions: ["/blu-validate-phase 5", "Blocked: pending-open-threat"],
      declaredThreats: [{ threatId: "T-01", sourcePlan: "05-01-PLAN.md" }],
      taskSchema: { omittedFromCompactContext: true },
      baseSchema: { omittedFromCompactContext: true }
    },
    taskSchema: {
      properties: {
        evidenceCoverage: {
          properties: {
            ".blueprint/phases/05-security-audit/05-01-PLAN.md": {}
          }
        }
      }
    },
    prerequisiteBlockers: []
  };
  const validateResult = {
    status: "invalid",
    valid: false,
    phase: { phaseNumber: "5" },
    artifact: "security",
    diagnostics: [
      {
        source: "schema",
        path: "model.evidenceCoverage[\".blueprint/phases/05-security-audit/05-01-PLAN.md\"].status",
        code: "schema.enum",
        message:
          "model.evidenceCoverage[\".blueprint/phases/05-security-audit/05-01-PLAN.md\"].status must be equal to one of the allowed values: used, deferred, unavailable.",
        allowedValues: ["used", "deferred", "unavailable"],
        repair:
          "Set model.evidenceCoverage[\".blueprint/phases/05-security-audit/05-01-PLAN.md\"].status to one of the allowed values."
      }
    ],
    diagnosticCounts: {
      total: 1,
      bySource: { schema: 1 },
      byCode: { "schema.enum": 1 }
    },
    repairSummary: {
      topBlockers: [
        "model.evidenceCoverage[\".blueprint/phases/05-security-audit/05-01-PLAN.md\"].status: invalid status"
      ],
      fieldsToChange: [
        "model.evidenceCoverage[\".blueprint/phases/05-security-audit/05-01-PLAN.md\"].status"
      ],
      firstPassActions: ["replace"],
      action: "retry_validation",
      retryable: true,
      retryInstruction: "Repair every diagnostic by exact path."
    },
    normalizedModel: null,
    renderPreview: null
  };
  const recordResult = {
    phaseNumber: "5",
    artifact: "security",
    reportPath: ".blueprint/phases/05-security-audit/05-SECURITY.md",
    written: false,
    created: false,
    overwritten: false,
    status: "invalid",
    diagnostics: [
      {
        source: "schema",
        path: "model.nextSafeAction",
        code: "schema.enum",
        message: "model.nextSafeAction must be equal to one of the allowed values: /blu-progress.",
        repair: "Set model.nextSafeAction to /blu-progress."
      }
    ],
    repairSummary: {
      topBlockers: ["model.nextSafeAction: invalid route"],
      fieldsToChange: ["model.nextSafeAction"],
      firstPassActions: ["replace"],
      action: "retry_validation",
      retryable: true,
      retryInstruction: "Repair every diagnostic by exact path."
    },
    warnings: []
  };
  const authoringText = createToolResponseContent(
    "blueprint_review_authoring_context",
    authoringResult
  )[0].text;
  const validateText = createToolResponseContent(
    "blueprint_review_validate_model",
    validateResult
  )[0].text;
  const recordText = createToolResponseContent("blueprint_review_record", recordResult)[0].text;

  assert.equal(
    authoringText,
    expectedStructuredContentText("blueprint_review_authoring_context", authoringResult)
  );
  assert.doesNotMatch(authoringText, /## Review Authoring Context/);
  assert.doesNotMatch(authoringText, /## Evidence Coverage Keys/);
  assert.doesNotMatch(authoringText, /## Allowed Next Actions/);
  assert.doesNotMatch(authoringText, /## Declared Threat IDs/);
  assert.doesNotMatch(authoringText, /## Runtime Task Schema/);
  assert.equal(
    validateText,
    expectedStructuredContentText("blueprint_review_validate_model", validateResult)
  );
  assert.doesNotMatch(validateText, /## Diagnostics/);
  assert.doesNotMatch(validateText, /## Repair Summary/);
  assert.doesNotMatch(validateText, /## Normalized Model/);
  assert.equal(
    recordText,
    expectedStructuredContentText("blueprint_review_record", recordResult)
  );
  assert.doesNotMatch(recordText, /## Model Diagnostics/);
  assert.doesNotMatch(recordText, /## Model Repair Summary/);
});

test("schema-first validation tools keep task schemas, previews, and evidence bodies out of MCP text", () => {
  const contractResult = {
    artifactId: "phase.verification",
    contract: {
      authoringTemplate: "# Phase {{phasePrefix}}: {{phaseName}} - Verification\n",
      modelContract: {
        schemaVersion: "1.1.0",
        schemaId: "blueprint.phase.verification.model",
        jsonSchema: {
          required: ["coverageSummary", "status", "gateState"]
        }
      }
    }
  };
  const authoringResult = {
    status: "ready",
    phaseFound: true,
    phaseNumber: "3",
    artifact: "verification",
    path: ".blueprint/phases/03-validation-engine/03-VERIFICATION.md",
    allowedValues: { verification: { coverageStates: ["PASS", "COVERED"] } },
    summaryEvidence: [{ path: ".blueprint/phases/03-validation-engine/03-01-SUMMARY.md" }],
    baseSchema: { $id: "blueprint.phase.verification.model" },
    taskSchema: {
      properties: {
        evidenceReviewedSummaryPaths: {
          items: {
            enum: [".blueprint/phases/03-validation-engine/03-01-SUMMARY.md"]
          }
        }
      }
    },
    contract: {
      modelContract: {
        jsonSchema: {
          required: ["coverageSummary", "status", "gateState"]
        }
      }
    },
    existing: {
      content: "# Phase 03: Validation Engine - Verification\n"
    }
  };
  const validateResult = {
    status: "invalid",
    valid: false,
    phase: { phaseNumber: "3" },
    artifact: "verification",
    path: ".blueprint/phases/03-validation-engine/03-VERIFICATION.md",
    taskSchema: { additionalProperties: false },
    diagnostics: [
      {
        source: "schema",
        path: "model.status",
        code: "schema.required",
        message: "must have required property status"
      },
      {
        source: "schema",
        path: "model.validationSummary",
        code: "schema.oneOf",
        message: "must match exactly one schema in oneOf"
      }
    ],
    diagnosticCounts: {
      total: 2,
      bySource: { schema: 2 },
      byCode: { "schema.required": 1, "schema.oneOf": 1 }
    },
    normalizedModel: null,
    renderPreview: "# Phase 03: Validation Engine - Verification\n"
  };
  const contractText = createToolResponseContent("blueprint_artifact_contract_read", contractResult)[0].text;
  const authoringText = createToolResponseContent(
    "blueprint_phase_validation_authoring_context",
    authoringResult
  )[0].text;
  const validateText = createToolResponseContent(
    "blueprint_phase_validation_validate_model",
    validateResult
  )[0].text;

  assert.equal(
    contractText,
    expectedStructuredContentText("blueprint_artifact_contract_read", contractResult)
  );
  assert.doesNotMatch(contractText, /## Authoring Template/);
  assert.doesNotMatch(contractText, /## Model Contract/);
  assert.doesNotMatch(contractText, /## Model JSON Schema/);
  assert.equal(
    authoringText,
    expectedStructuredContentText("blueprint_phase_validation_authoring_context", authoringResult)
  );
  assert.doesNotMatch(authoringText, /## Runtime Task Schema/);
  assert.doesNotMatch(authoringText, /## Model JSON Schema/);
  assert.doesNotMatch(authoringText, /## Existing Validation Artifact/);
  assert.equal(
    validateText,
    expectedStructuredContentText("blueprint_phase_validation_validate_model", validateResult)
  );
  assert.doesNotMatch(validateText, /## Diagnostics/);
  assert.doesNotMatch(validateText, /## Runtime Task Schema/);
  assert.doesNotMatch(validateText, /## Render Preview/);
});

test("summary and validation reads keep artifact bodies out of MCP text", () => {
  const summaryResult = {
    phaseFound: true,
    found: true,
    phaseNumber: "3",
    planId: "01",
    path: ".blueprint/phases/03-validation-engine/03-01-SUMMARY.md",
    content: "# Phase 03: Validation Engine - Summary 01\n\n## Outcome\n\n- Done.\n",
    validation: { valid: true, issues: [], warnings: [] },
    metadata: { status: "COMPLETED" }
  };
  const validationResult = {
    phaseFound: true,
    found: true,
    phaseNumber: "3",
    artifact: "verification",
    path: ".blueprint/phases/03-validation-engine/03-VERIFICATION.md",
    content: "# Phase 03: Validation Engine - Verification\n\n## Validation Summary\n\n- Done.\n",
    validation: { valid: true, issues: [], warnings: [] },
    verificationReadyForUat: true,
    summaryPaths: [".blueprint/phases/03-validation-engine/03-01-SUMMARY.md"]
  };
  const summaryText = createToolResponseContent("blueprint_phase_summary_read", summaryResult)[0].text;
  const validationText = createToolResponseContent(
    "blueprint_phase_validation_read",
    validationResult
  )[0].text;

  assert.equal(
    summaryText,
    expectedStructuredContentText("blueprint_phase_summary_read", summaryResult)
  );
  assert.doesNotMatch(summaryText, /## Summary Artifact Body/);
  assert.doesNotMatch(summaryText, /## Summary Validation/);
  assert.equal(
    validationText,
    expectedStructuredContentText("blueprint_phase_validation_read", validationResult)
  );
  assert.doesNotMatch(validationText, /## Validation Artifact Body/);
  assert.doesNotMatch(validationText, /## Validation State/);
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
    assert.doesNotMatch(
      runtimeContractTemplate?.description ?? "",
      /review.*excluded|excluded.*review/i
    );
    assert.match(
      helpRuntimeContractResource?.description ?? "",
      /implemented Blueprint command/i
    );
    assert.doesNotMatch(
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
    assert.ok(runtimeContractResources.includes("blueprint://commands/review/runtime-contract"));
    assert.ok(!runtimeContractResources.includes("blueprint://commands/do/runtime-contract"));

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
      if (contractPayload.command === "new-project") {
        assert.equal(contractPayload.runtimeReference.path, NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID);
        assert.deepEqual(contractPayload.runtimeReference.evidenceState, [
          "locked",
          "runtime-owned",
          "needs-behavior-audit"
        ]);
      }
    }
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
});
