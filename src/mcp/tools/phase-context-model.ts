import { readArtifactContract } from "../artifact-contracts/index.js";
import {
  type PhaseArtifactValidationDiagnostic,
  validatePhaseArtifactContent
} from "./artifacts.js";
import { asJsonObject, createAjvValidator } from "./phase-json-helpers.js";
import { markdownTableCell } from "./phase-markdown.js";

type PhaseContextResolvedLocation = {
  phasePrefix: string;
  phaseName: string;
};

export type PhaseContextStructuredModel = {
  phaseBoundary: {
    goal: string;
    inScope: string[];
    outOfScope: string[];
    successCriteria: string[];
  };
  discoveryGrounding: {
    projectBrief: string;
    requirementsGrounding: string[];
    workflowPosture: string;
    confirmedDecisions: string[];
  };
  implementationDecisions: Array<{
    decision: string;
    tradeoffOrConstraint: string;
  }>;
  specificIdeas: string[];
  existingCodeInsights: string[];
  dependencies: {
    priorPhaseArtifacts: string[];
    externalConstraints: string[];
    requiredFollowUpReads: string[];
  };
  openQuestions: string[];
  deferredIdeas: string[];
  canonicalReferences: Array<{
    source: string;
    relevance: string;
  }>;
};

function renderContextBulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function renderContextOptionalBulletList(
  items: string[],
  options?: { allowNoneAlias?: boolean }
): string {
  if (items.length === 0) {
    return "- none";
  }

  if (options?.allowNoneAlias && items.length === 1 && items[0].trim().toLowerCase() === "none") {
    return "- none";
  }

  return renderContextBulletList(items);
}

function renderContextTable(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.map(markdownTableCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(markdownTableCell).join(" | ")} |`)
  ].join("\n");
}

export function renderPhaseContextModelContent(args: {
  resolved: PhaseContextResolvedLocation;
  model: PhaseContextStructuredModel;
}): string {
  return `# Phase ${args.resolved.phasePrefix}: ${args.resolved.phaseName} - Context

## Phase Boundary

- **Goal** ${args.model.phaseBoundary.goal}
- **In scope**
${renderContextBulletList(args.model.phaseBoundary.inScope)}
- **Out of scope**
${renderContextBulletList(args.model.phaseBoundary.outOfScope)}
- **Success criteria**
${renderContextBulletList(args.model.phaseBoundary.successCriteria)}

## Discovery Grounding

- **Project brief** ${args.model.discoveryGrounding.projectBrief}
- **Requirements grounding**
${renderContextBulletList(args.model.discoveryGrounding.requirementsGrounding)}
- **Workflow posture** ${args.model.discoveryGrounding.workflowPosture}
- **Confirmed decisions**
${renderContextBulletList(args.model.discoveryGrounding.confirmedDecisions)}

## Implementation Decisions

${renderContextTable(
  ["Decision", "Tradeoff Or Constraint"],
  args.model.implementationDecisions.map((row) => [
    row.decision,
    row.tradeoffOrConstraint
  ])
)}

## Specific Ideas

${renderContextBulletList(args.model.specificIdeas)}

## Existing Code Insights

${renderContextBulletList(args.model.existingCodeInsights)}

## Dependencies

- Prior phase artifacts:
${renderContextOptionalBulletList(args.model.dependencies.priorPhaseArtifacts)}
- External constraints:
${renderContextOptionalBulletList(args.model.dependencies.externalConstraints)}
- Required follow-up reads:
${renderContextBulletList(args.model.dependencies.requiredFollowUpReads)}

## Open Questions

${renderContextOptionalBulletList(args.model.openQuestions, { allowNoneAlias: true })}

## Deferred Ideas

${renderContextOptionalBulletList(args.model.deferredIdeas)}

## Canonical References

${renderContextTable(
  ["Source", "Relevance"],
  args.model.canonicalReferences.map((row) => [row.source, row.relevance])
)}
`;
}

export function validatePhaseContextModelInput(
  model: unknown
):
  | { model: null; validation: ReturnType<typeof validatePhaseArtifactContent> }
  | { model: PhaseContextStructuredModel; validation: null } {
  const modelObject = asJsonObject(model);
  const diagnostics: PhaseArtifactValidationDiagnostic[] = [];

  if (!modelObject) {
    diagnostics.push({
      path: "model",
      code: "schema.type",
      message: "phase.context model must be a JSON object.",
      repair: "Pass a JSON object matching phase.context.modelContract.",
      retryable: true,
      nextTool: "blueprint_phase_artifact_write"
    });
  } else {
    const contract = readArtifactContract("phase.context");
    const schema = contract.modelContract?.jsonSchema;

    if (!schema) {
      diagnostics.push({
        path: "model",
        code: "schema.missing",
        message: "phase.context does not expose a model schema.",
        repair: "Read blueprint_artifact_contract_read for phase.context before retrying.",
        retryable: true,
        nextTool: "blueprint_phase_artifact_write"
      });
    } else {
      const validate = createAjvValidator().compile(schema);
      const valid = validate(modelObject);

      if (!valid) {
        diagnostics.push(
          ...(validate.errors ?? []).map((error) => {
            const missingProperty =
              typeof error.params === "object" &&
              error.params !== null &&
              "missingProperty" in error.params &&
              typeof error.params.missingProperty === "string"
                ? error.params.missingProperty
                : null;
            const additionalProperty =
              typeof error.params === "object" &&
              error.params !== null &&
              "additionalProperty" in error.params &&
              typeof error.params.additionalProperty === "string"
                ? error.params.additionalProperty
                : null;
            const basePath =
              error.instancePath.length === 0
                ? "model"
                : `model${error.instancePath.replace(/\//g, ".")}`;
            const pathValue =
              missingProperty !== null
                ? `${basePath}.${missingProperty}`
                : additionalProperty !== null
                  ? `${basePath}.${additionalProperty}`
                  : basePath;

            return {
              path: pathValue,
              code: `schema.${error.keyword}`,
              message: `phase.context model schema violation at ${pathValue}: ${error.message ?? error.keyword}.`,
              missing: missingProperty ? [missingProperty] : undefined,
              repair: phaseContextModelSchemaRepair(error.keyword, pathValue, missingProperty),
              retryable: true,
              nextTool: "blueprint_phase_artifact_write"
            };
          })
        );
      }
    }
  }

  if (diagnostics.length > 0) {
    return {
      model: null,
      validation: {
        valid: false,
        issues: diagnostics.map((diagnostic) => diagnostic.message),
        warnings: [],
        diagnostics
      }
    };
  }

  diagnostics.push(
    ...phaseContextModelSentinelDiagnostics(
      modelObject as unknown as PhaseContextStructuredModel
    )
  );

  if (diagnostics.length > 0) {
    return {
      model: null,
      validation: {
        valid: false,
        issues: diagnostics.map((diagnostic) => diagnostic.message),
        warnings: [],
        diagnostics
      }
    };
  }

  return {
    model: modelObject as unknown as PhaseContextStructuredModel,
    validation: null
  };
}

function phaseContextModelSchemaRepair(
  keyword: string,
  pathValue: string,
  missingProperty: string | null
): string {
  if (keyword === "required" && missingProperty) {
    return `Add ${pathValue} using the phase.context model contract before retrying.`;
  }

  if (keyword === "type") {
    if (pathValue === "model.openQuestions") {
      return "Set model.openQuestions to an array. Use openQuestions: [] when no open questions remain; MCP renders the canonical - none sentinel. Keep openQuestions: [\"none\"] only as compatibility for older saved model inputs.";
    }

    return `Set ${pathValue} to the type required by phase.context.modelContract; use arrays for list fields and objects for grouped sections.`;
  }

  if (keyword === "minItems") {
    if (pathValue === "model.openQuestions") {
      return "Use openQuestions: [] when no open questions remain; MCP renders the canonical - none sentinel. Keep openQuestions: [\"none\"] only as compatibility for older saved model inputs.";
    }

    if (pathValue === "model.deferredIdeas") {
      return "Use deferredIdeas: [] when nothing is deferred; MCP renders the canonical - none sentinel.";
    }

    return `Populate ${pathValue} with at least one substantive item required by phase.context.modelContract.`;
  }

  if (keyword === "additionalProperties") {
    return `Remove unsupported field ${pathValue}; MCP owns identity, artifact kind, paths, and final Markdown persistence.`;
  }

  return "Repair the structured phase.context model against contract.modelContract.jsonSchema before retrying.";
}

function phaseContextModelSentinelDiagnostics(
  model: PhaseContextStructuredModel
): PhaseArtifactValidationDiagnostic[] {
  const diagnostics: PhaseArtifactValidationDiagnostic[] = [];

  const aliasSensitiveFields: Array<{
    path: string;
    items: string[];
    repair: string;
  }> = [
    {
      path: "model.dependencies.priorPhaseArtifacts",
      items: model.dependencies.priorPhaseArtifacts,
      repair:
        "Use dependencies.priorPhaseArtifacts: [] when no prior artifacts apply; do not pass [\"none\"] as model content."
    },
    {
      path: "model.dependencies.externalConstraints",
      items: model.dependencies.externalConstraints,
      repair:
        "Use dependencies.externalConstraints: [] when no external constraints apply; do not pass [\"none\"] as model content."
    },
    {
      path: "model.deferredIdeas",
      items: model.deferredIdeas,
      repair:
        "Use deferredIdeas: [] when nothing is deferred; do not pass [\"none\"] as model content."
    }
  ];

  for (const field of aliasSensitiveFields) {
    if (field.items.length === 1 && field.items[0].trim().toLowerCase() === "none") {
      diagnostics.push({
        path: field.path,
        code: "schema.none_alias_forbidden",
        message: `phase.context model field ${field.path} must use an empty array for the canonical none state; [\"none\"] is reserved for Open Questions compatibility only.`,
        repair: field.repair,
        retryable: true,
        nextTool: "blueprint_phase_artifact_write"
      });
    }
  }

  return diagnostics;
}
