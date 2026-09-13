import * as z from "zod/v4";
import type { ValidateFunction } from "ajv";
import { readArtifactContract } from "../artifact-contracts/index.js";
import {
  type PhaseArtifactValidationDiagnostic,
  validatePhaseArtifactContent,
} from "./artifacts.js";
import { asJsonObject, createAjvValidator } from "./phase-json-helpers.js";
import { markdownTableCell } from "./phase-markdown.js";

// The contract is source-owned and immutable during a runtime process. Compile
// lazily once; consume AJV diagnostics synchronously before the next call.
export const phaseContextAuthoringSchema = z.fromJSONSchema(
  readArtifactContract("phase.context").modelContract!
    .jsonSchema as z.core.JSONSchema.JSONSchema,
);

let contextModelValidator: ValidateFunction | undefined;

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

function contextInline(value: string): string {
  return value.replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim()).join("<br>");
}

export type PhaseContextModelDefaults = Partial<Omit<PhaseContextStructuredModel, "phaseBoundary" | "discoveryGrounding" | "dependencies">> & {
  phaseBoundary?: Partial<PhaseContextStructuredModel["phaseBoundary"]>;
  discoveryGrounding?: Partial<PhaseContextStructuredModel["discoveryGrounding"]>;
  dependencies?: Partial<PhaseContextStructuredModel["dependencies"]>;
};

const emptyAlias = /^(?:none|n\/a|na|not applicable|nothing(?: (?:deferred|open))?|no (?:open questions?|deferred ideas?|dependencies|references?))(?:[.!])?$/i;

function renderContextBulletList(items: string[]): string {
  return items.map((item) => `- ${contextInline(item)}`).join("\n");
}

function renderContextOptionalBulletList(
  items: string[],
  options?: { allowNoneAlias?: boolean },
): string {
  if (items.length === 0) {
    return "- none";
  }

  if (
    options?.allowNoneAlias &&
    items.length === 1 &&
    items[0].trim().toLowerCase() === "none"
  ) {
    return "- none";
  }

  return renderContextBulletList(items);
}

function renderContextTable(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.map(markdownTableCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(markdownTableCell).join(" | ")} |`),
  ].join("\n");
}

export function renderPhaseContextModelContent(args: {
  resolved: PhaseContextResolvedLocation;
  model: PhaseContextStructuredModel;
}): string {
  return `# Phase ${args.resolved.phasePrefix}: ${args.resolved.phaseName} - Context

## Phase Boundary

- **Goal** ${contextInline(args.model.phaseBoundary.goal)}
- **In scope**
${renderContextBulletList(args.model.phaseBoundary.inScope)}
- **Out of scope**
${renderContextBulletList(args.model.phaseBoundary.outOfScope)}
- **Success criteria**
${renderContextBulletList(args.model.phaseBoundary.successCriteria)}

## Discovery Grounding

- **Project brief** ${contextInline(args.model.discoveryGrounding.projectBrief)}
- **Requirements grounding**
${renderContextBulletList(args.model.discoveryGrounding.requirementsGrounding)}
- **Workflow posture** ${contextInline(args.model.discoveryGrounding.workflowPosture)}
- **Confirmed decisions**
${renderContextBulletList(args.model.discoveryGrounding.confirmedDecisions)}

## Implementation Decisions

${
  args.model.implementationDecisions.length === 0
    ? "- none"
    : renderContextTable(
        ["Decision", "Tradeoff Or Constraint"],
        args.model.implementationDecisions.map((row) => [
          row.decision,
          row.tradeoffOrConstraint,
        ]),
      )
}

## Specific Ideas

${renderContextOptionalBulletList(args.model.specificIdeas)}

## Existing Code Insights

${renderContextOptionalBulletList(args.model.existingCodeInsights)}

## Dependencies

- Prior phase artifacts:
${renderContextOptionalBulletList(args.model.dependencies.priorPhaseArtifacts)}
- External constraints:
${renderContextOptionalBulletList(args.model.dependencies.externalConstraints)}
- Required follow-up reads:
${renderContextOptionalBulletList(args.model.dependencies.requiredFollowUpReads)}

## Open Questions

${renderContextOptionalBulletList(args.model.openQuestions, { allowNoneAlias: true })}

## Deferred Ideas

${renderContextOptionalBulletList(args.model.deferredIdeas)}

## Canonical References

${renderContextTable(
  ["Source", "Relevance"],
  args.model.canonicalReferences.map((row) => [row.source, row.relevance]),
)}
`;
}

export function validatePhaseContextModelInput(
  model: unknown,
  defaults?: PhaseContextModelDefaults,
):
  | { model: null; validation: ReturnType<typeof validatePhaseArtifactContent> }
  | { model: PhaseContextStructuredModel; validation: null } {
  const modelObject = asJsonObject(structuredClone(model));
  if (modelObject) {
    for (const group of ["phaseBoundary", "discoveryGrounding", "dependencies"] as const) {
      if (modelObject[group] === undefined) modelObject[group] = {};
      const value = asJsonObject(modelObject[group]);
      if (value) modelObject[group] = { ...defaults?.[group], ...value };
    }
    for (const [key, value] of Object.entries(defaults ?? {})) {
      if (modelObject[key] === undefined) modelObject[key] = structuredClone(value);
    }
    const lists: Array<[Record<string, unknown> | null, string[]]> = [
      [modelObject, ["implementationDecisions", "specificIdeas", "existingCodeInsights", "openQuestions", "deferredIdeas", "canonicalReferences"]],
      [asJsonObject(modelObject.phaseBoundary), ["outOfScope"]],
      [asJsonObject(modelObject.discoveryGrounding), ["requirementsGrounding", "confirmedDecisions"]],
      [asJsonObject(modelObject.dependencies), ["priorPhaseArtifacts", "externalConstraints", "requiredFollowUpReads"]],
    ];
    for (const [object, keys] of lists) if (object) for (const key of keys) {
      const value = object[key];
      if (value == null || (!["implementationDecisions", "canonicalReferences"].includes(key) && Array.isArray(value) && value.length === 1 && typeof value[0] === "string" && emptyAlias.test(value[0].trim()))) object[key] = [];
    }
    const grounding = asJsonObject(modelObject.discoveryGrounding);
    if (grounding) for (const key of ["projectBrief", "workflowPosture"]) if (grounding[key] === undefined) grounding[key] = "none";
    for (const [key, field] of [["implementationDecisions", "tradeoffOrConstraint"], ["canonicalReferences", "relevance"]]) {
      if (Array.isArray(modelObject[key])) for (const row of modelObject[key]) {
        const object = asJsonObject(row);
        if (object && object[field] === undefined) object[field] = "none";
      }
    }
  }
  const diagnostics: PhaseArtifactValidationDiagnostic[] = [];

  if (!modelObject) {
    diagnostics.push({
      path: "model",
      code: "schema.type",
      message: "phase.context model must be a JSON object.",
      repair: "Pass a JSON object matching phase.context.modelContract.",
      retryable: true,
      nextTool: "blueprint_phase_artifact_write",
    });
  } else {
    const contract = readArtifactContract("phase.context");
    const schema = contract.modelContract?.jsonSchema;

    if (!schema) {
      diagnostics.push({
        path: "model",
        code: "schema.missing",
        message: "phase.context does not expose a model schema.",
        repair:
          "Read blueprint_artifact_contract_read for phase.context before retrying.",
        retryable: true,
        nextTool: "blueprint_phase_artifact_write",
      });
    } else {
      const validate = (contextModelValidator ??=
        createAjvValidator().compile(schema));
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
              repair: phaseContextModelSchemaRepair(
                error.keyword,
                pathValue,
                missingProperty,
              ),
              retryable: true,
              nextTool: "blueprint_phase_artifact_write",
            };
          }),
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
        diagnostics,
      },
    };
  }

  const boundary = asJsonObject(modelObject?.phaseBoundary);
  for (const key of ["goal", "inScope", "successCriteria"]) {
    const value = boundary?.[key];
    const valid = key === "goal"
      ? typeof value === "string" && value.trim().length > 0 && !emptyAlias.test(value.trim())
      : Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.trim().length > 0 && !emptyAlias.test(item.trim()));
    if (!valid) diagnostics.push({ path: `model.phaseBoundary.${key}`, code: "context.missing_essential_intent", message: `Phase boundary ${key} requires substantive content after grounded defaults.`, repair: `Supply phaseBoundary.${key}.`, retryable: true, nextTool: "blueprint_discuss_finalize" });
  }

  if (diagnostics.length > 0) {
    return {
      model: null,
      validation: {
        valid: false,
        issues: diagnostics.map((diagnostic) => diagnostic.message),
        warnings: [],
        diagnostics,
      },
    };
  }

  return {
    model: modelObject as unknown as PhaseContextStructuredModel,
    validation: null,
  };
}

function phaseContextModelSchemaRepair(
  keyword: string,
  pathValue: string,
  missingProperty: string | null,
): string {
  if (keyword === "required" && missingProperty) {
    return `Add ${pathValue} using the phase.context model contract before retrying.`;
  }

  if (keyword === "type") {
    if (pathValue === "model.openQuestions") {
      return 'Set model.openQuestions to an array. Use openQuestions: [] when no open questions remain; MCP renders the canonical - none sentinel. Keep openQuestions: ["none"] only as compatibility for older saved model inputs.';
    }

    return `Set ${pathValue} to the type required by phase.context.modelContract; use arrays for list fields and objects for grouped sections.`;
  }

  if (keyword === "minItems") {
    if (pathValue === "model.openQuestions") {
      return 'Use openQuestions: [] when no open questions remain; MCP renders the canonical - none sentinel. Keep openQuestions: ["none"] only as compatibility for older saved model inputs.';
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
