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
  const openQuestions =
    args.model.openQuestions.length === 1 &&
    args.model.openQuestions[0].trim().toLowerCase() === "none"
      ? "- none"
      : renderContextBulletList(args.model.openQuestions);

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
${renderContextBulletList(args.model.dependencies.priorPhaseArtifacts)}
- External constraints:
${renderContextBulletList(args.model.dependencies.externalConstraints)}
- Required follow-up reads:
${renderContextBulletList(args.model.dependencies.requiredFollowUpReads)}

## Open Questions

${openQuestions}

## Deferred Ideas

${renderContextBulletList(args.model.deferredIdeas)}

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
              repair: "Repair the structured phase.context model against contract.modelContract.jsonSchema before retrying.",
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

  return {
    model: modelObject as unknown as PhaseContextStructuredModel,
    validation: null
  };
}
