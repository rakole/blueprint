import {
  type ArtifactContractReadResult
} from "../artifact-contracts/index.js";
import {
  filterImplementedBlueprintActions,
  getPhasePlanImplementedCommandNames
} from "./phase-command-actions.js";
import { uniquePreservingOrder } from "./phase-collection-helpers.js";
import {
  cloneJsonObject,
  getJsonObjectProperty
} from "./phase-json-helpers.js";
import {
  allowOnlyEmptyArray,
  exactStringArrayContains,
  objectPropertyContainsAtLeast
} from "./phase-task-schema-helpers.js";

async function buildPhaseVerificationAllowedNextActions(phaseNumber: string): Promise<{
  readyAction: string;
  repairActions: string[];
  allowedActions: string[];
}> {
  const readyAction = `/blu-verify-work ${phaseNumber}`;
  const repairActions = [`/blu-add-tests ${phaseNumber}`, `/blu-audit-fix ${phaseNumber}`];
  const implementedCommands = await getPhasePlanImplementedCommandNames();

  if (implementedCommands === null || implementedCommands.size === 0) {
    return {
      readyAction,
      repairActions,
      allowedActions: [readyAction, ...repairActions]
    };
  }

  const implementedReady =
    filterImplementedBlueprintActions([readyAction], implementedCommands)[0] ?? readyAction;
  const implementedRepairs = filterImplementedBlueprintActions(
    repairActions,
    implementedCommands
  );

  return {
    readyAction: implementedReady,
    repairActions: implementedRepairs.length > 0 ? implementedRepairs : repairActions,
    allowedActions: [implementedReady, ...(implementedRepairs.length > 0 ? implementedRepairs : repairActions)]
  };
}

function buildPhaseVerificationTaskSchema(args: {
  baseSchema: Record<string, unknown>;
  summaryPaths: string[];
  readyAction: string;
  repairActions: string[];
  allowedActions: string[];
}): Record<string, unknown> {
  const schema = cloneJsonObject(args.baseSchema);
  const properties = getJsonObjectProperty(schema, "properties");

  if (properties) {
    const evidenceReviewedSummaryPaths = getJsonObjectProperty(
      properties,
      "evidenceReviewedSummaryPaths"
    );
    if (evidenceReviewedSummaryPaths) {
      evidenceReviewedSummaryPaths.minItems = args.summaryPaths.length;
      evidenceReviewedSummaryPaths.maxItems = args.summaryPaths.length;
      evidenceReviewedSummaryPaths.uniqueItems = true;
      evidenceReviewedSummaryPaths.items = args.summaryPaths.length > 0
        ? { type: "string", enum: args.summaryPaths }
        : { type: "string" };
      if (args.summaryPaths.length > 0) {
        evidenceReviewedSummaryPaths.allOf = args.summaryPaths.map(exactStringArrayContains);
      } else {
        delete evidenceReviewedSummaryPaths.allOf;
      }
    }

    const nextSafeAction = getJsonObjectProperty(properties, "nextSafeAction");
    if (nextSafeAction) {
      nextSafeAction.enum = args.allowedActions;
    }
  }

  const existingAllOf = Array.isArray(schema.allOf) ? schema.allOf : [];
  schema.allOf = [
    ...existingAllOf,
    {
      if: {
        required: ["gateState"],
        properties: {
          gateState: { const: "PASS" }
        }
      },
      then: {
        properties: {
          requirementCoverage: {
            items: {
              type: "object",
              required: ["coverageState"],
              properties: {
                coverageState: { enum: ["PASS", "COVERED", "covered"] }
              }
            }
          },
          nextSafeAction: { const: args.readyAction },
          manualOrDeferredCoverage: {
            items: {
              type: "object",
              required: ["item", "whyManualOrDeferred", "followUp", "status"],
              properties: {
                item: { const: "none" },
                whyManualOrDeferred: { const: "none" },
                followUp: { const: "none" },
                status: { const: "NONE" }
              }
            }
          },
          gapClassification: {
            items: {
              type: "object",
              required: ["gapClass", "scope", "evidence", "repair"],
              properties: {
                gapClass: { const: "none" },
                scope: { const: "none" },
                evidence: { const: "none" },
                repair: { const: "none" }
              }
            }
          },
          gapsFound: {
            items: { const: "none" }
          },
          suggestedRepairs: {
            items: { const: "none" }
          }
        }
      }
    },
    {
      if: {
        required: ["gateState"],
        properties: {
          gateState: { enum: ["PARTIAL", "BLOCKED"] }
        }
      },
      then: {
        properties: {
          nextSafeAction: { enum: args.repairActions },
          manualOrDeferredCoverage: {
            minItems: 1
          },
          gapClassification: {
            contains: {
              type: "object",
              required: ["gapClass"],
              properties: {
                gapClass: {
                  enum: [
                    "missing-evidence",
                    "partial-coverage",
                    "manual-only",
                    "deferred-test",
                    "contradiction"
                  ]
                }
              }
            },
            minContains: 1
          },
          gapsFound: {
            contains: { not: { const: "none" } },
            minContains: 1
          },
          suggestedRepairs: {
            contains: { not: { const: "none" } },
            minContains: 1
          }
        }
      }
    }
  ];

  schema["x-blueprint-runtimeContext"] = {
    summaryPaths: args.summaryPaths,
    readyAction: args.readyAction,
    repairActions: args.repairActions,
    allowedActions: args.allowedActions
  };

  return schema;
}

export async function phaseVerificationModelSchemas(args: {
  contract: ArtifactContractReadResult;
  phaseNumber: string;
  summaryPaths: string[];
}): Promise<{
  schemaPath: string;
  baseSchema: Record<string, unknown>;
  taskSchema: Record<string, unknown>;
}> {
  const modelContract = args.contract.modelContract;

  if (!modelContract) {
    throw new Error("phase.verification does not expose a modelContract.");
  }
  if (!modelContract.schemaPath) {
    throw new Error("phase.verification modelContract does not expose a schemaPath.");
  }

  const baseSchema = cloneJsonObject(modelContract.jsonSchema);
  const allowedNextActions = await buildPhaseVerificationAllowedNextActions(args.phaseNumber);
  const taskSchema = buildPhaseVerificationTaskSchema({
    baseSchema,
    summaryPaths: args.summaryPaths,
    ...allowedNextActions
  });

  return {
    schemaPath: modelContract.schemaPath,
    baseSchema,
    taskSchema
  };
}

async function buildPhaseUatAllowedNextActions(phaseNumber: string): Promise<{
  completeAction: string;
  continuationActions: string[];
  allowedActions: string[];
}> {
  const completeAction = "/blu-progress";
  const continuationActions = [
    `/blu-verify-work ${phaseNumber}`,
    `/blu-audit-fix ${phaseNumber}`,
    `/blu-add-tests ${phaseNumber}`
  ];
  const implementedCommands = await getPhasePlanImplementedCommandNames();

  if (implementedCommands === null || implementedCommands.size === 0) {
    return {
      completeAction,
      continuationActions,
      allowedActions: [completeAction, ...continuationActions]
    };
  }

  const implementedComplete =
    filterImplementedBlueprintActions([completeAction], implementedCommands)[0] ?? completeAction;
  const implementedContinuation = filterImplementedBlueprintActions(
    continuationActions,
    implementedCommands
  );
  const continuation =
    implementedContinuation.length > 0 ? implementedContinuation : continuationActions;

  return {
    completeAction: implementedComplete,
    continuationActions: continuation,
    allowedActions: [implementedComplete, ...continuation]
  };
}

function buildPhaseUatTaskSchema(args: {
  baseSchema: Record<string, unknown>;
  summaryPaths: string[];
  verificationPath: string | null;
  completeAction: string;
  continuationActions: string[];
  allowedActions: string[];
}): Record<string, unknown> {
  const schema = cloneJsonObject(args.baseSchema);
  const properties = getJsonObjectProperty(schema, "properties");
  const defs = getJsonObjectProperty(schema, "$defs");
  const testMatrixRow = defs ? getJsonObjectProperty(defs, "testMatrixRow") : null;
  const testMatrixRowProperties = testMatrixRow
    ? getJsonObjectProperty(testMatrixRow, "properties")
    : null;
  const evidencePaths = uniquePreservingOrder([
    ...args.summaryPaths,
    ...(args.verificationPath ? [args.verificationPath] : [])
  ]);
  const requiredEvidencePaths = evidencePaths;

  if (properties) {
    const testMatrix = getJsonObjectProperty(properties, "testMatrix");
    const evidence = testMatrixRowProperties
      ? getJsonObjectProperty(testMatrixRowProperties, "evidence")
      : null;

    if (requiredEvidencePaths.length > 0) {
      if (evidence) {
        evidence.enum = evidencePaths;
      }
      if (testMatrix) {
        testMatrix.allOf = requiredEvidencePaths.map((evidencePath) =>
          objectPropertyContainsAtLeast("evidence", evidencePath)
        );
      }
    } else {
      allowOnlyEmptyArray(testMatrix);
    }

    const nextSafeAction = getJsonObjectProperty(properties, "nextSafeAction");
    if (nextSafeAction) {
      nextSafeAction.enum = args.allowedActions;
    }
  }

  const existingAllOf = Array.isArray(schema.allOf) ? schema.allOf : [];
  schema.allOf = [
    ...existingAllOf,
    {
      if: {
        required: ["status"],
        properties: {
          status: { const: "PASS" }
        }
      },
      then: {
        properties: {
          nextSafeAction: { const: args.completeAction }
        }
      }
    },
    {
      if: {
        required: ["status"],
        properties: {
          status: { enum: ["FAIL", "PARTIAL"] }
        }
      },
      then: {
        properties: {
          nextSafeAction: { enum: args.continuationActions }
        }
      }
    }
  ];

  schema["x-blueprint-runtimeContext"] = {
    summaryPaths: args.summaryPaths,
    verificationPath: args.verificationPath,
    evidencePaths,
    completeAction: args.completeAction,
    continuationActions: args.continuationActions,
    allowedActions: args.allowedActions,
    upstreamContext: {
      summaryPaths: "required upstream context",
      verificationPath: "required upstream context"
    }
  };

  return schema;
}

export async function phaseUatModelSchemas(args: {
  contract: ArtifactContractReadResult;
  phaseNumber: string;
  summaryPaths: string[];
  verificationPath: string | null;
}): Promise<{
  schemaPath: string;
  baseSchema: Record<string, unknown>;
  taskSchema: Record<string, unknown>;
}> {
  const modelContract = args.contract.modelContract;

  if (!modelContract) {
    throw new Error("phase.uat does not expose a modelContract.");
  }
  if (!modelContract.schemaPath) {
    throw new Error("phase.uat modelContract does not expose a schemaPath.");
  }

  const baseSchema = cloneJsonObject(modelContract.jsonSchema);
  const allowedNextActions = await buildPhaseUatAllowedNextActions(args.phaseNumber);
  const taskSchema = buildPhaseUatTaskSchema({
    baseSchema,
    summaryPaths: args.summaryPaths,
    verificationPath: args.verificationPath,
    ...allowedNextActions
  });

  return {
    schemaPath: modelContract.schemaPath,
    baseSchema,
    taskSchema
  };
}
