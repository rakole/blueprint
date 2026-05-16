import { type ErrorObject } from "ajv/dist/2020.js";

import { type ArtifactContractReadResult } from "../artifact-contracts/index.js";
import { type PhaseValidationArtifactKind } from "./phase-locations.js";
import { asJsonObject } from "./phase-json-helpers.js";
import {
  ajvAllowedValues,
  ajvInstancePathToModelPath,
  getValueAtJsonPointer
} from "./phase-schema-paths.js";
import { validationArtifactContractId } from "./phase-validation-contracts.js";

export type PhaseValidationDiagnosticSource = "scope" | "schema" | "residual" | "markdown";

export type PhaseValidationModelDiagnostic = {
  source: PhaseValidationDiagnosticSource;
  path: string;
  code: string;
  message: string;
  context: Record<string, unknown>;
  suggestion: string;
};

export type PhaseValidationDiagnosticCounts = {
  total: number;
  bySource: Record<PhaseValidationDiagnosticSource, number>;
  byCode: Record<string, number>;
};

export function phaseValidationDiagnostic(
  args: PhaseValidationModelDiagnostic
): PhaseValidationModelDiagnostic {
  return args;
}

export function emptyPhaseValidationDiagnosticCounts(): PhaseValidationDiagnosticCounts {
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

export function countPhaseValidationDiagnostics(
  diagnostics: PhaseValidationModelDiagnostic[]
): PhaseValidationDiagnosticCounts {
  const counts = emptyPhaseValidationDiagnosticCounts();

  for (const diagnostic of diagnostics) {
    counts.total += 1;
    counts.bySource[diagnostic.source] += 1;
    counts.byCode[diagnostic.code] = (counts.byCode[diagnostic.code] ?? 0) + 1;
  }

  return counts;
}

export function formatPhaseValidationDiagnostic(
  diagnostic: PhaseValidationModelDiagnostic
): string {
  return `${diagnostic.source}:${diagnostic.path}:${diagnostic.code}: ${diagnostic.message} Suggestion: ${diagnostic.suggestion}`;
}

function phaseValidationRouteDiagnostic(
  error: ErrorObject,
  pathValue: string,
  taskSchema: Record<string, unknown>,
  model: unknown
): PhaseValidationModelDiagnostic | null {
  const runtimeContext = asJsonObject(taskSchema["x-blueprint-runtimeContext"]);
  const gateState = getValueAtJsonPointer(model, "/gateState");
  const status = getValueAtJsonPointer(model, "/status");
  const nextSafeAction = getValueAtJsonPointer(model, "/nextSafeAction");
  const readyAction =
    typeof runtimeContext?.readyAction === "string" ? runtimeContext.readyAction : null;
  const repairActions = Array.isArray(runtimeContext?.repairActions)
    ? runtimeContext.repairActions.filter((value): value is string => typeof value === "string")
    : [];
  const completeAction =
    typeof runtimeContext?.completeAction === "string" ? runtimeContext.completeAction : null;
  const continuationActions = Array.isArray(runtimeContext?.continuationActions)
    ? runtimeContext.continuationActions.filter((value): value is string => typeof value === "string")
    : [];

  if (
    pathValue === "model.nextSafeAction" &&
    (error.keyword === "const" || error.keyword === "enum")
  ) {
    if (gateState === "PASS" && readyAction) {
      return phaseValidationDiagnostic({
        source: "schema",
        path: pathValue,
        code: `schema.${error.keyword}`,
        message: `When gateState is PASS, model.nextSafeAction must be ${readyAction}.`,
        context: {
          keyword: error.keyword,
          params: error.params,
          schemaPath: error.schemaPath,
          expectedAction: readyAction
        },
        suggestion: `Set model.nextSafeAction to ${readyAction}.`
      });
    }

    if ((gateState === "PARTIAL" || gateState === "BLOCKED") && repairActions.length > 0) {
      return phaseValidationDiagnostic({
        source: "schema",
        path: pathValue,
        code: `schema.${error.keyword}`,
        message: `When gateState is ${gateState}, model.nextSafeAction must be one of: ${repairActions.join(", ")}.`,
        context: {
          keyword: error.keyword,
          params: error.params,
          schemaPath: error.schemaPath,
          allowedActions: repairActions
        },
        suggestion: `Set model.nextSafeAction to one of: ${repairActions.join(", ")}.`
      });
    }

    if (status === "PASS" && completeAction) {
      return phaseValidationDiagnostic({
        source: "schema",
        path: pathValue,
        code: `schema.${error.keyword}`,
        message: `When status is PASS, model.nextSafeAction must be ${completeAction}.`,
        context: {
          keyword: error.keyword,
          params: error.params,
          schemaPath: error.schemaPath,
          expectedAction: completeAction
        },
        suggestion: `Set model.nextSafeAction to ${completeAction}.`
      });
    }

    if ((status === "FAIL" || status === "PARTIAL") && continuationActions.length > 0) {
      return phaseValidationDiagnostic({
        source: "schema",
        path: pathValue,
        code: `schema.${error.keyword}`,
        message: `When status is ${status}, model.nextSafeAction must be one of: ${continuationActions.join(", ")}.`,
        context: {
          keyword: error.keyword,
          params: error.params,
          schemaPath: error.schemaPath,
          allowedActions: continuationActions
        },
        suggestion: `Set model.nextSafeAction to one of: ${continuationActions.join(", ")}.`
      });
    }
  }

  if (error.keyword === "if") {
    if (gateState === "PASS" && readyAction && nextSafeAction !== readyAction) {
      return phaseValidationDiagnostic({
        source: "schema",
        path: "model.nextSafeAction",
        code: "schema.if",
        message: `PASS verification models must route to ${readyAction} before UAT.`,
        context: {
          keyword: error.keyword,
          params: error.params,
          schemaPath: error.schemaPath,
          expectedAction: readyAction
        },
        suggestion: `Keep PASS-only coverage rows and gap ledgers clean, then set model.nextSafeAction to ${readyAction}.`
      });
    }

    if (status === "PASS" && completeAction && nextSafeAction !== completeAction) {
      return phaseValidationDiagnostic({
        source: "schema",
        path: "model.nextSafeAction",
        code: "schema.if",
        message: `PASS UAT models must route to ${completeAction}.`,
        context: {
          keyword: error.keyword,
          params: error.params,
          schemaPath: error.schemaPath,
          expectedAction: completeAction
        },
        suggestion: `Keep PASS-only UAT gap rows empty, then set model.nextSafeAction to ${completeAction}.`
      });
    }
  }

  return null;
}

export function schemaDiagnosticFromPhaseValidationAjvError(
  error: ErrorObject,
  taskSchema: Record<string, unknown>,
  model: unknown
): PhaseValidationModelDiagnostic {
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
  const routeDiagnostic = phaseValidationRouteDiagnostic(error, pathValue, taskSchema, model);

  if (routeDiagnostic) {
    return routeDiagnostic;
  }
  const allowedValues = ajvAllowedValues(error);

  return phaseValidationDiagnostic({
    source: "schema",
    path: pathValue,
    code: `schema.${error.keyword}`,
    message: error.message ?? "Model does not match the phase validation task schema.",
    context: {
      keyword: error.keyword,
      params: error.params,
      schemaPath: error.schemaPath,
      allowedValues
    },
    suggestion:
      missingProperty !== null
        ? `Add required field ${missingProperty}.`
        : additionalProperty !== null
          ? `Remove unsupported field ${additionalProperty}.`
          : allowedValues && allowedValues.length > 0
            ? `Replace ${pathValue} with one of: ${allowedValues.join(", ")}.`
          : "Revise the model to satisfy the narrowed task schema returned by blueprint_phase_validation_authoring_context."
  });
}

function collectModelStringEntries(
  value: unknown,
  pathValue = "model"
): Array<{ path: string; value: string }> {
  if (typeof value === "string") {
    return [{ path: pathValue, value }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectModelStringEntries(item, `${pathValue}[${index}]`)
    );
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      collectModelStringEntries(item, `${pathValue}.${key}`)
    );
  }

  return [];
}

function isGenericNoneValue(value: string): boolean {
  return /^(?:none|n\/a|na|not applicable)$/i.test(value.trim());
}

function hasPhaseValidationPlaceholderLanguage(value: string): boolean {
  return /\b(?:todo|tbd|placeholder|replace with|replace me|fill in|insert here|coming soon|static for now)\b/i.test(
    value
  );
}

export function phaseValidationResidualDiagnostics(
  model: Record<string, unknown>,
  modelContract: ArtifactContractReadResult["modelContract"],
  artifact: PhaseValidationArtifactKind
): PhaseValidationModelDiagnostic[] {
  const diagnostics: PhaseValidationModelDiagnostic[] = [];
  const contractId = validationArtifactContractId(artifact);
  const artifactLabel = artifact === "verification" ? "verification" : "UAT";

  if (!modelContract) {
    return [
      phaseValidationDiagnostic({
        source: "scope",
        path: "model",
        code: "contract.missing",
        message: `${contractId} does not support structured model writes.`,
        context: {},
        suggestion: `Read the live ${contractId} artifact contract before authoring.`
      })
    ];
  }

  const modelStrings = collectModelStringEntries(model);
  const leakedSignals = modelContract.exampleLeakageSignals.filter((signal) =>
    modelStrings.some((entry) => entry.value.includes(signal))
  );

  for (const signal of leakedSignals) {
    diagnostics.push(
      phaseValidationDiagnostic({
        source: "residual",
        path: "model",
        code: "content.example_leakage",
        message: `Phase ${artifactLabel} model copied example leakage signal from ${modelContract.schemaId}: ${signal}.`,
        context: { signal },
        suggestion: "Replace copied example wording with evidence from the selected phase summaries."
      })
    );
  }

  for (const entry of modelStrings) {
    if (hasPhaseValidationPlaceholderLanguage(entry.value)) {
      diagnostics.push(
        phaseValidationDiagnostic({
          source: "residual",
          path: entry.path,
          code: "content.placeholder",
          message: `Phase ${artifactLabel} model contains placeholder language: ${entry.value}.`,
          context: { value: entry.value },
          suggestion: "Replace placeholder language with concrete phase evidence."
        })
      );
    }
  }

  const genericNoneRequiredEvidencePaths =
    artifact === "verification"
      ? ["model.coverageSummary", "model.signOff", "model.validationSummary"]
      : ["model.uatSummary", "model.sessionState", "model.observedBehavior"];

  for (const entry of modelStrings.filter((candidate) =>
    genericNoneRequiredEvidencePaths.some((pathPrefix) =>
      candidate.path.startsWith(pathPrefix)
    )
  )) {
    if (!isGenericNoneValue(entry.value)) {
      continue;
    }

    diagnostics.push(
      phaseValidationDiagnostic({
        source: "residual",
        path: entry.path,
        code: "content.generic_text",
        message: `Phase ${artifactLabel} model must use concrete evidence text instead of generic none.`,
        context: { value: entry.value },
        suggestion: "Replace the generic value with a specific saved-summary-backed claim."
      })
    );
  }

  return diagnostics;
}
