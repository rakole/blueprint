import { type ErrorObject } from "ajv/dist/2020.js";

import { readArtifactContract } from "../artifact-contracts/index.js";
import { collectModelStringValues, asJsonObject } from "./phase-json-helpers.js";
import { uniquePreservingOrder } from "./phase-collection-helpers.js";
import {
  ajvAllowedValues,
  ajvInstancePathToModelPath,
  appendJsonPointerSegment,
  getValueAtJsonPointer,
  modelPathToJsonPointer
} from "./phase-schema-paths.js";

export type PhasePlanModelDiagnosticSource = "scope" | "schema" | "residual" | "markdown";
export type PhasePlanModelDiagnosticSeverity = "error" | "warning";
export type PhasePlanModelRepairAction =
  | "add"
  | "remove"
  | "replace"
  | "dedupe"
  | "reroute"
  | "make-verifiable"
  | "re-read-context";

export type PhasePlanModelPatchHint = {
  op: "add" | "remove" | "replace";
  path: string;
  value?: unknown;
};

export type PhasePlanModelDiagnostic = {
  id?: string;
  severity?: PhasePlanModelDiagnosticSeverity;
  source: PhasePlanModelDiagnosticSource;
  path: string;
  modelPath?: string;
  jsonPointer?: string | null;
  markdownPath?: string;
  code: string;
  message: string;
  context: Record<string, unknown>;
  expected?: unknown;
  actual?: unknown;
  allowedValues?: unknown[];
  repairAction?: PhasePlanModelRepairAction;
  patchHint?: PhasePlanModelPatchHint;
  suggestion: string;
};

export type PhasePlanRepairSummary = {
  blockingCount: number;
  firstPassActions: string[];
  reReadAuthoringContext: boolean;
  retryInstruction: string;
};

export type PhasePlanDiagnosticCounts = {
  total: number;
  bySource: Record<PhasePlanModelDiagnosticSource, number>;
  byCode: Record<string, number>;
};

export function phasePlanDiagnostic(
  args: PhasePlanModelDiagnostic
): PhasePlanModelDiagnostic {
  const modelPath =
    args.modelPath ?? (args.path === "model" || args.path.startsWith("model.") ? args.path : undefined);
  const jsonPointer =
    args.jsonPointer !== undefined
      ? args.jsonPointer
      : modelPath
        ? modelPathToJsonPointer(modelPath)
        : null;

  return {
    severity: "error",
    ...args,
    modelPath,
    jsonPointer
  };
}

export function emptyPhasePlanDiagnosticCounts(): PhasePlanDiagnosticCounts {
  return {
    total: 0,
    bySource: {
      scope: 0,
      schema: 0,
      residual: 0,
      markdown: 0
    },
    byCode: {}
  };
}

export function countPhasePlanDiagnostics(
  diagnostics: PhasePlanModelDiagnostic[]
): PhasePlanDiagnosticCounts {
  const counts = emptyPhasePlanDiagnosticCounts();

  for (const diagnostic of diagnostics) {
    counts.total += 1;
    counts.bySource[diagnostic.source] += 1;
    counts.byCode[diagnostic.code] = (counts.byCode[diagnostic.code] ?? 0) + 1;
  }

  return counts;
}

export function summarizePhasePlanRepairs(
  diagnostics: PhasePlanModelDiagnostic[]
): PhasePlanRepairSummary {
  const firstPassActions = uniquePreservingOrder(
    diagnostics.map((diagnostic) => diagnostic.repairAction ?? "replace")
  );
  const reReadAuthoringContext = diagnostics.some(
    (diagnostic) =>
      diagnostic.repairAction === "re-read-context" ||
      diagnostic.code === "schema.exactCoverage" ||
      diagnostic.source === "scope"
  );
  const retryInstruction =
    diagnostics.length === 0
      ? "No repair is required; the model is ready to render."
      : reReadAuthoringContext
        ? "Re-read blueprint_phase_plan_authoring_context, repair every diagnostic in the returned model, then retry validation once."
        : "Repair every diagnostic in the returned model before retrying validation once.";

  return {
    blockingCount: diagnostics.filter((diagnostic) => diagnostic.severity !== "warning").length,
    firstPassActions,
    reReadAuthoringContext,
    retryInstruction
  };
}

export function formatPhasePlanDiagnostic(diagnostic: PhasePlanModelDiagnostic): string {
  const pathHint = diagnostic.jsonPointer
    ? `${diagnostic.path} (${diagnostic.jsonPointer})`
    : diagnostic.path;
  const actionHint = diagnostic.repairAction ? ` Action: ${diagnostic.repairAction}.` : "";

  return `${diagnostic.source}:${pathHint}:${diagnostic.code}: ${diagnostic.message}${actionHint} Suggestion: ${diagnostic.suggestion}`;
}

function phasePlanSchemaRepairAction(error: ErrorObject): PhasePlanModelRepairAction {
  if (error.keyword === "required" || error.keyword === "contains" || error.keyword === "minItems") {
    return "add";
  }

  if (error.keyword === "additionalProperties" || error.keyword === "maxItems") {
    return "remove";
  }

  if (error.keyword === "uniqueItems") {
    return "dedupe";
  }

  return "replace";
}

function phasePlanSchemaExpected(error: ErrorObject, allowedValues?: unknown[]): unknown {
  if (allowedValues && allowedValues.length > 0) {
    return allowedValues;
  }

  if (error.keyword === "pattern" && "pattern" in error.params) {
    return `Value matching pattern ${String(error.params.pattern)}`;
  }

  if (error.keyword === "minItems" && "limit" in error.params) {
    return `At least ${String(error.params.limit)} item(s)`;
  }

  if (error.keyword === "maxItems" && "limit" in error.params) {
    return `At most ${String(error.params.limit)} item(s)`;
  }

  return error.keyword;
}

function schemaDiagnosticFromAjvError(
  error: ErrorObject,
  model: unknown
): PhasePlanModelDiagnostic {
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
  const basePath = ajvInstancePathToModelPath(error.instancePath);
  const pathValue =
    missingProperty !== null
      ? `${basePath}.${missingProperty}`
      : additionalProperty !== null
        ? `${basePath}.${additionalProperty}`
        : basePath;
  const jsonPointer =
    missingProperty !== null
      ? appendJsonPointerSegment(error.instancePath, missingProperty)
      : additionalProperty !== null
        ? appendJsonPointerSegment(error.instancePath, additionalProperty)
        : error.instancePath;
  const allowedValues = ajvAllowedValues(error);
  const actual = getValueAtJsonPointer(model, jsonPointer);
  const repairAction = phasePlanSchemaRepairAction(error);
  const patchHint =
    additionalProperty !== null
      ? { op: "remove" as const, path: jsonPointer }
      : allowedValues && allowedValues.length > 0 && actual !== undefined
        ? { op: "replace" as const, path: jsonPointer, value: allowedValues[0] }
        : undefined;

  return phasePlanDiagnostic({
    source: "schema",
    path: pathValue,
    modelPath: pathValue,
    jsonPointer,
    code: `schema.${error.keyword}`,
    message: error.message ?? "Model does not match the phase.plan task schema.",
    context: {
      keyword: error.keyword,
      params: error.params,
      schemaPath: error.schemaPath
    },
    expected: phasePlanSchemaExpected(error, allowedValues),
    actual,
    allowedValues,
    repairAction,
    patchHint,
    suggestion:
      missingProperty !== null
        ? `Add required field ${missingProperty}.`
        : additionalProperty !== null
          ? `Remove unsupported field ${additionalProperty}.`
          : allowedValues && allowedValues.length > 0
            ? `Replace the value at ${pathValue} with one of: ${allowedValues.join(", ")}.`
          : "Revise the model to satisfy the narrowed task schema returned by blueprint_phase_plan_authoring_context."
  });
}

export function schemaDiagnosticFromPhasePlanAjvError(
  error: ErrorObject,
  taskSchema: Record<string, unknown>,
  model: unknown
): PhasePlanModelDiagnostic {
  const runtimeContext = asJsonObject(taskSchema["x-blueprint-runtimeContext"]);
  const knownRequirements = Array.isArray(runtimeContext?.knownRequirements)
    ? runtimeContext.knownRequirements.filter((value): value is string => typeof value === "string")
    : [];
  const knownEvidenceArtifacts = Array.isArray(runtimeContext?.knownEvidenceArtifacts)
    ? runtimeContext.knownEvidenceArtifacts.filter(
        (value): value is string => typeof value === "string"
      )
    : [];
  const exactContainsMatch = error.schemaPath.match(
    /\/properties\/(requirementCoverage|evidenceCoverage)\/allOf\/(\d+)/
  );

  if (error.keyword === "contains" && exactContainsMatch) {
    const collection = exactContainsMatch[1] ?? "";
    const index = Number.parseInt(exactContainsMatch[2] ?? "", 10);
    const requiredValue =
      collection === "requirementCoverage"
        ? knownRequirements[index]
        : knownEvidenceArtifacts[index];

    if (requiredValue) {
      const noun =
        collection === "requirementCoverage"
          ? "known roadmap requirement"
          : "known saved evidence artifact";

      return phasePlanDiagnostic({
        source: "schema",
        path: `model.${collection}`,
        modelPath: `model.${collection}`,
        jsonPointer: `/${collection}`,
        code: "schema.exactCoverage",
        message: `Phase plan model ${collection} must include exactly one row for ${noun} ${requiredValue}.`,
        context: {
          requiredValue,
          keyword: error.keyword,
          params: error.params,
          schemaPath: error.schemaPath
        },
        expected:
          collection === "requirementCoverage"
            ? {
                requirement: requiredValue,
                status: "deferred",
                coveredByTasks: [],
                evidence: "Concrete evidence or rationale from the selected phase.",
                rationale: "Explain why this requirement is deferred, irrelevant, or covered."
              }
            : {
                artifact: requiredValue,
                status: "used",
                rationale: "Explain how this saved evidence artifact informed the plan."
              },
        actual: getValueAtJsonPointer(model, `/${collection}`),
        repairAction: collection === "evidenceCoverage" ? "re-read-context" : "add",
        patchHint: {
          op: "add",
          path: `/${collection}/-`,
          value:
            collection === "requirementCoverage"
              ? {
                  requirement: requiredValue,
                  status: "deferred",
                  coveredByTasks: [],
                  evidence: "Concrete evidence or rationale from the selected phase.",
                  rationale: "Explain why this requirement is deferred, irrelevant, or covered."
                }
              : {
                  artifact: requiredValue,
                  status: "used",
                  rationale: "Explain how this saved evidence artifact informed the plan."
                }
        },
        suggestion:
          collection === "evidenceCoverage"
            ? `Re-read blueprint_phase_plan_authoring_context and add one evidenceCoverage row for saved artifact ${requiredValue}, or remove duplicate rows for that artifact.`
            : `Add one ${collection} row for ${requiredValue}, or remove duplicate rows for that value.`
      });
    }
  }

  return schemaDiagnosticFromAjvError(error, model);
}

export function phasePlanModelResidualDiagnostics(
  model: Record<string, unknown>
): PhasePlanModelDiagnostic[] {
  const diagnostics: PhasePlanModelDiagnostic[] = [];
  const modelContract = readArtifactContract("phase.plan").modelContract;

  if (!modelContract) {
    return [
      phasePlanDiagnostic({
        source: "scope",
        path: "model",
        code: "contract.missing",
        message: "phase.plan does not support structured model writes.",
        context: {},
        suggestion: "Read the live phase.plan artifact contract before authoring."
      })
    ];
  }

  const modelStrings = collectModelStringValues(model);
  const leakedSignals = modelContract.exampleLeakageSignals.filter((signal) =>
    modelStrings.some((value) => value.includes(signal))
  );

  for (const signal of leakedSignals) {
    diagnostics.push(
      phasePlanDiagnostic({
        source: "residual",
        path: "model",
        code: "content.example_leakage",
        message: `Phase plan model copied example leakage signal from ${modelContract.schemaId}: ${signal}.`,
        context: { signal },
        suggestion: "Replace copied example wording with evidence from the selected phase."
      })
    );
  }

  return diagnostics;
}
