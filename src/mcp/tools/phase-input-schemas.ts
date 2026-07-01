import * as z from "zod/v4";

import {
  phaseCheckpointOwnerCommandSchema,
  phaseCheckpointResumeModeSchema,
  phaseCheckpointWriteSchema
} from "./phase-checkpoint-records.js";

export const roadmapReadInputSchema = {
  cwd: z.string().optional()
};

export const roadmapAddPhaseInputSchema = {
  cwd: z.string().optional(),
  description: z.string(),
  expectedPhaseNumber: z.string().optional(),
  confirmed: z.boolean().optional(),
  goal: z.string().optional(),
  requirementIds: z.array(z.string()).optional(),
  successCriteria: z.array(z.string()).optional(),
  auditBackedDetails: z
    .object({
      sourceReportPath: z.string().optional(),
      goal: z.string().optional(),
      successCriteria: z.string().optional(),
      repairRequirementIds: z.array(z.string()).optional(),
      gapGroups: z
        .array(
          z.object({
            category: z.enum(["requirement", "integration", "flow", "optional"]),
            rows: z.array(
              z.object({
                gapId: z.string(),
                surface: z.string(),
                evidence: z.string(),
                repair: z.string()
              })
            )
          })
        )
        .optional()
    })
    .optional()
};

export const roadmapInsertPhaseInputSchema = {
  cwd: z.string().optional(),
  after: z.union([z.string(), z.number()]),
  description: z.string(),
  confirmed: z.boolean().optional(),
  goal: z.string().optional(),
  requirementIds: z.array(z.string()).min(1),
  successCriteria: z.array(z.string()).optional()
};

export const roadmapRemovePhaseInputSchema = {
  cwd: z.string().optional(),
  phase: z.union([z.string(), z.number()]),
  confirmed: z.boolean().optional(),
  force: z.boolean().optional()
};

export const roadmapPromoteBacklogInputSchema = {
  cwd: z.string().optional(),
  backlogIds: z.array(z.string()).optional(),
  previewOnly: z.boolean().optional()
};

const numericBlueprintInputSchema = z.union([z.string(), z.number()]);

export const phaseLookupInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional()
};

export const phaseArtifactInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum(["context", "discussion-log", "research", "spec", "ui-spec"])
};

export const phaseArtifactScaffoldInputSchema = {
  ...phaseArtifactInputSchema,
  overwrite: z.boolean().optional()
};

export const phaseValidationArtifactInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum(["verification", "uat"])
};

export const phaseValidationAuthoringContextInputSchema =
  phaseValidationArtifactInputSchema;

export const phasePlanInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional()
};

export const phaseExecutionTargetsInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  wave: z.number().int().positive().optional(),
  gapsOnly: z.boolean().optional(),
  includeConflicts: z.boolean().optional(),
  externalServiceConfirmed: z.boolean().optional()
};

export const phaseArtifactWriteInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum(["context", "discussion-log", "research", "spec", "ui-spec"]),
  content: z.string().optional(),
  model: z.record(z.string(), z.unknown()).optional(),
  overwrite: z.boolean().optional(),
  validationMode: z.enum(["strict", "warn"]).optional()
};

export const phaseUiSkipWriteInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  skipRationale: z.string(),
  overwrite: z.boolean().optional()
};

export const phaseValidationWriteInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum(["verification", "uat"]),
  content: z.string().optional(),
  model: z.record(z.string(), z.unknown()).optional(),
  authoringMode: z.enum(["content-compatible", "model-only"]).optional(),
  overwrite: z.boolean().optional()
};

export const phaseValidationValidateModelInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum(["verification", "uat"]),
  model: z.unknown()
};

export const phaseValidationRenderInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum(["verification", "uat"]),
  coverageSummary: z.string().optional(),
  gateState: z.string().optional(),
  signOff: z.string().optional(),
  validationSummary: z.union([z.string(), z.array(z.string())]).optional(),
  requirementCoverage: z
    .array(
      z.object({
        requirement: z.string().optional(),
        taskOrCheck: z.string().optional(),
        evidence: z.string().optional(),
        coverageState: z.string().optional(),
        notes: z.string().optional()
      })
    )
    .optional(),
  evidenceReviewedSummaryPaths: z.array(z.string()).optional(),
  evidenceMetadata: z.array(z.string()).optional(),
  manualOrDeferredCoverage: z
    .array(
      z.object({
        item: z.string().optional(),
        whyManualOrDeferred: z.string().optional(),
        followUp: z.string().optional(),
        status: z.string().optional()
      })
    )
    .optional(),
  gapClassification: z
    .array(
      z.object({
        gapClass: z.string().optional(),
        scope: z.string().optional(),
        evidence: z.string().optional(),
        repair: z.string().optional()
      })
    )
    .optional(),
  gapsFound: z.array(z.string()).optional(),
  suggestedRepairs: z.array(z.string()).optional(),
  nextSafeAction: z.string().optional(),
  status: z.string().optional(),
  resumeState: z.string().optional(),
  checkpoint: z.string().optional(),
  uatSummary: z.array(z.string()).optional(),
  sessionState: z.array(z.string()).optional(),
  currentTest: z
    .object({
      number: z.string().optional(),
      name: z.string().optional(),
      expected: z.string().optional(),
      awaiting: z.string().optional()
    })
    .optional(),
  testMatrix: z
    .array(
      z.object({
        number: z.string().optional(),
        test: z.string().optional(),
        expectedBehavior: z.string().optional(),
        evidence: z.string().optional(),
        result: z.string().optional(),
        notes: z.string().optional()
      })
    )
    .optional(),
  resultSummary: z
    .object({
      total: z.number().int().nonnegative().optional(),
      passed: z.number().int().nonnegative().optional(),
      issues: z.number().int().nonnegative().optional(),
      pending: z.number().int().nonnegative().optional(),
      skipped: z.number().int().nonnegative().optional(),
      blocked: z.number().int().nonnegative().optional()
    })
    .optional(),
  questionsAsked: z.array(z.string()).optional(),
  observedBehavior: z.array(z.string()).optional(),
  unresolvedGaps: z.array(z.string()).optional(),
  structuredGaps: z
    .array(
      z.object({
        test: z.string().optional(),
        truth: z.string().optional(),
        status: z.string().optional(),
        severity: z.string().optional(),
        reason: z.string().optional(),
        followUp: z.string().optional()
      })
    )
    .optional(),
  followUpFixes: z.array(z.string()).optional()
};

export const phasePlanReadInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema
};

export const phasePlanValidateInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional()
};

export const phasePlanAuthoringContextInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema.optional()
};

export const phasePlanReadinessInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema.optional(),
  readMode: z.enum(["full", "hashes-only"]).optional(),
  bodyMode: z.enum(["summary", "bounded"]).optional(),
  maxBodyBytes: z.number().int().positive().max(128 * 1024).optional(),
  includeSavedPlanBodies: z.enum(["none", "target"]).optional(),
  includeReviewFindings: z.boolean().optional(),
  includeValidationEvidence: z.boolean().optional(),
  previousReadSet: z
    .array(
      z.object({
        path: z.string(),
        kind: z.string(),
        hash: z.string()
      })
    )
    .optional()
};

export const phasePlanValidateModelInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema.optional(),
  model: z.unknown()
};

export const phasePlanWriteInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema.optional(),
  content: z.string().optional(),
  model: z.unknown().optional(),
  authoringMode: z.enum(["content-compatible", "model-only"]).optional(),
  overwrite: z.boolean().optional(),
  validationMode: z.enum(["strict", "warn"]).optional(),
  returnPlanSetValidation: z.boolean().optional(),
  returnNextAuthoringContext: z.boolean().optional(),
  expectedReadSet: z
    .array(
      z.object({
        path: z.string(),
        kind: z.string(),
        hash: z.string()
      })
    )
    .optional()
};

export const phaseSummaryReadInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema
};

export const phaseSummaryAuthoringContextInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema
};

export const phaseSummaryValidateModelInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema,
  content: z.string().optional(),
  model: z.unknown().optional()
};

export const phaseSummaryWriteInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema,
  content: z.string().optional(),
  model: z.unknown().optional(),
  authoringMode: z.enum(["content-compatible", "model-only"]).optional(),
  overwrite: z.boolean().optional()
};

export const phaseCheckpointGetInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  expectedOwnerCommand: phaseCheckpointOwnerCommandSchema.optional(),
  expectedMode: phaseCheckpointResumeModeSchema.optional()
};

export const phaseCheckpointPutInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  checkpoint: phaseCheckpointWriteSchema
};

export const phaseCheckpointDeleteInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  expectedOwnerCommand: phaseCheckpointOwnerCommandSchema.optional(),
  expectedMode: phaseCheckpointResumeModeSchema.optional()
};
