import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  readArtifactContract,
  type ArtifactContractReadResult
} from "../artifact-contracts/index.js";
import {
  isBootstrapStarterContext,
  CODEBASE_ARTIFACTS,
  BLUEPRINT_BACKLOG_INDEX_PATH,
  BLUEPRINT_DIR,
  BLUEPRINT_PHASES_PATH,
  DURABLE_REQUIREMENT_ID_PATTERN,
  type PhaseArtifactValidationDiagnostic,
  blueprintArtifactScaffold,
  ensureParentDirectory,
  ensureRepoRoot,
  inspectBlueprintArtifacts,
  extractMarkdownTableRows,
  isVerificationArtifactReadyForUat,
  parseCaptureIndexDocument,
  validatePhaseArtifactContent,
  validatePlanArtifactContent,
  extractSummaryPlanReference,
  extractSummaryStatus,
  extractSummaryMarkerValue,
  canonicalizeResearchHeadingLines,
  readUatArtifactState,
  validateStrictSummaryArtifactContent,
  validateUatArtifactContent,
  validateVerificationArtifactContent,
  resolveBlueprintPath,
  toRepoRelativePath,
  writeJsonFile,
  withBlueprintRepoLock,
  writeTextFile
} from "./artifacts.js";
import { blueprintConfigGet } from "./config.js";
import { loadBlueprintState } from "./state.js";
import { blueprintStateLoad } from "./state.js";
import {
  prepareTextForPersistence,
  safeJsonParseObject
} from "../../shared/security.js";
import {
  evaluatePhaseQualityGates,
  formatPhaseQualityGateDebtReason
} from "./quality-gates.js";
import {
  basePhaseNumber,
  comparePhaseNumbers,
  computeNextWholePhaseNumber,
  extractExactPhaseNumberToken,
  extractPhaseNumberToken,
  formatPhasePrefix,
  isIntegerPhaseNumber,
  normalizeBlueprintInput,
  normalizePhaseDescription,
  normalizePhaseNumber,
  slugifyPhaseName,
  slugToTitle,
  type NumericInput
} from "./phase-numbering.js";
import {
  parseRoadmapDocument,
  type ParsedRoadmapPhase
} from "./phase-roadmap-parser.js";
import {
  type PhaseCheckpointOwnerCommand,
  type PhaseCheckpointRecord,
  type PhaseCheckpointResumeMode,
  type PhaseCheckpointWriteRecord
} from "./phase-checkpoint-records.js";
import {
  blueprintPhaseCheckpointDelete,
  blueprintPhaseCheckpointGet,
  blueprintPhaseCheckpointPut
} from "./phase-checkpoints.js";
export {
  blueprintPhaseCheckpointDelete,
  blueprintPhaseCheckpointGet,
  blueprintPhaseCheckpointPut
} from "./phase-checkpoints.js";
import {
  blueprintPhaseContext as blueprintPhaseContextImpl,
  blueprintPhaseLocate as blueprintPhaseLocateImpl,
  blueprintPhaseResearchStatus as blueprintPhaseResearchStatusImpl,
  buildPhaseContext,
  buildPhasePlanningReadiness,
  buildPhaseResearchStatusFromContext
} from "./phase-context-tools.js";
import {
  extractMarkdownHeading,
  extractMarkdownSection,
  normalizeTextContent,
  sectionToList,
  summarizeContextPieces,
  summarizeSavedArtifact
} from "./phase-markdown.js";
import {
  collectInvalidPlanDependencyIssues,
  extractHeadingText,
  extractReferencedPlanId,
  normalizeMaybePlanId,
  normalizePlanId,
  parseCanonicalPlanArtifactPath,
  parsePlanArtifactPath,
  planPathFor,
  reconcileAutoAssignedPlanContent
} from "./phase-plan-identifiers.js";
import {
  artifactPathFor,
  buildArtifactPath,
  checkpointPathFor,
  findPhaseArtifact,
  findPhaseSpecArtifact,
  findPhaseValidationArtifact,
  findPhaseDirectory,
  listPhaseArtifacts,
  materializePhaseDirectory,
  pathExists,
  readMarkdownDocument,
  readRoadmap,
  validationArtifactPathFor,
  type ParsedRoadmap,
  type PhaseArtifactKind,
  type PhaseValidationArtifactKind
} from "./phase-locations.js";
import {
  PHASE_TOPOLOGY_LOCK_NAME,
  phaseTopologyFingerprintFromLocation,
  type PhaseTopologyFingerprint
} from "./phase-topology-lock.js";
import {
  assertFreshPhaseTopology,
  buildLocateRecovery,
  locatePhaseFromRoadmap,
  phaseLocateFailureFromError,
  phaseSelectionFromLocate,
  resolveLocatedPhaseForMutation,
  resolveLocatedPhaseForRead,
  resolvePhaseRuntimeSnapshot,
  resolvePlannedContextScaffoldPhase,
  toResolvedPhaseLocation,
  withFreshPhaseTopologyForMutation
} from "./phase-resolution.js";
export {
  resolvePhaseTopologySnapshot,
  type PhaseTopologySnapshot
} from "./phase-resolution.js";
export {
  blueprintPhaseArtifactRead,
  blueprintPhaseArtifactScaffold,
  blueprintPhaseArtifactWrite,
  blueprintPhaseUiSkipWrite
} from "./phase-artifacts.js";
import {
  asJsonObject,
  cloneJsonObject,
  collectModelStringValues,
  createAjvValidator,
  getJsonObjectProperty
} from "./phase-json-helpers.js";
import {
  phaseUatModelSchemas,
  phaseVerificationModelSchemas
} from "./phase-validation-schemas.js";
import {
  buildPhasePlanTaskSchema
} from "./phase-plan-schemas.js";
import {
  modelPathToJsonPointer
} from "./phase-schema-paths.js";
import {
  normalizeExecutionSurfacePath,
  sharedExecutionSurfaces,
  uniqueSortedStrings,
  type PhaseExecutionTargetConflictSurface
} from "./phase-execution-surfaces.js";
import {
  completedRouteAfterSelectedCompletion,
  dependencyPlanRowsForPlan,
  extractPhaseSummaryMarkerValue,
  formatCompletedSummaryRoute,
  normalizeDependencyPlanIds,
  parseSummaryArtifactPath,
  phaseSummaryCompletedRoute,
  routesMatch,
  summaryPathFor,
  type PhaseSummaryCompletedRouteValidation
} from "./phase-summary-routing.js";
import {
  normalizePhaseSummaryModel,
  renderPhaseSummaryModelContent,
  type PhaseSummaryStructuredModel
} from "./phase-summary-rendering.js";
import {
  countPhaseSummaryDiagnostics,
  formatPhaseSummaryDiagnostic,
  phaseSummaryDiagnostic,
  type PhaseSummaryDiagnosticCounts,
  type PhaseSummaryModelDiagnostic
} from "./phase-summary-diagnostics.js";
import {
  normalizeVerificationStructuredModel,
  renderUatContent,
  renderVerificationContent,
  uatPayloadIssues,
  verificationPayloadIssues,
  type PhaseUatStructuredModel,
  type PhaseValidationRenderArgs,
  type PhaseVerificationStructuredModel
} from "./phase-validation-rendering.js";
import {
  PHASE_VALIDATION_ALLOWED_VALUES,
  clonePhaseValidationAllowedValues,
  validationArtifactContract,
  validationArtifactContractId,
  type PhaseValidationAllowedValues
} from "./phase-validation-contracts.js";
import {
  countPhaseValidationDiagnostics,
  formatPhaseValidationDiagnostic,
  phaseValidationDiagnostic,
  phaseValidationResidualDiagnostics,
  schemaDiagnosticFromPhaseValidationAjvError,
  type PhaseValidationDiagnosticCounts,
  type PhaseValidationModelDiagnostic
} from "./phase-validation-diagnostics.js";
import {
  renderPhasePlanModelContent,
  type PhasePlanExternalServicePrerequisite,
  type PhasePlanStructuredModel
} from "./phase-plan-rendering.js";
import {
  blueprintPhaseArtifactRead,
  blueprintPhaseArtifactScaffold,
  blueprintPhaseArtifactWrite,
  blueprintPhaseUiSkipWrite,
  phaseArtifactSuggestedRepairs
} from "./phase-artifacts.js";
import {
  blueprintPhaseValidationAuthoringContext as blueprintPhaseValidationAuthoringContextImpl,
  blueprintPhaseValidationRead as blueprintPhaseValidationReadImpl,
  blueprintPhaseValidationRender as blueprintPhaseValidationRenderImpl,
  blueprintPhaseValidationValidateModel as blueprintPhaseValidationValidateModelImpl,
  blueprintPhaseValidationWrite as blueprintPhaseValidationWriteImpl,
  trimPhaseValidationStandaloneValidateModelResult,
  type PhaseValidationToolRuntimeDependencies
} from "./phase-validation-tools.js";
import {
  buildPhaseSummaryAllowedNextActions,
  collectReferencedValidatedSummaryPaths,
  collectValidatedSummaryPaths,
  completedSummaryRecords,
  loadPhaseSummaryInventory,
  loadResolvedPhaseSummaryContext,
  phaseSummaryReadFromInventory
} from "./phase-summary-inventory.js";
import {
  countPhasePlanDiagnostics,
  formatPhasePlanDiagnostic,
  isBlockingPhasePlanDiagnostic,
  isExactCoverageConstFallout,
  partitionPhasePlanDiagnostics,
  phasePlanDiagnostic,
  phasePlanModelResidualDiagnostics,
  schemaDiagnosticFromPhasePlanAjvError,
  summarizePhasePlanRepairs,
  type PhasePlanDiagnosticCounts,
  type PhasePlanModelDiagnostic,
  type PhasePlanRepairSummary
} from "./phase-plan-diagnostics.js";
import {
  extractBlueprintDirectCommands,
  filterImplementedBlueprintActions,
  getPhasePlanImplementedCommandNames
} from "./phase-command-actions.js";
import {
  detectStrongExplicitNoUiSignal
} from "./phase-no-ui-signals.js";
import {
  appendPhaseDetailsToRoadmap,
  appendPhaseLineToRoadmap,
  buildBlueprintPhaseDirectoryPath,
  insertPhaseDetailsToRoadmap,
  insertPhaseLineToRoadmap,
  nextDecimalPhaseNumber,
  nextIntegerPhaseNumber,
  normalizeRoadmapDetailList,
  normalizeRoadmapGoal,
  normalizeRoadmapSuccessCriteriaList,
  normalizeRoadmapSuccessCriteriaString,
  previousIntegerPhaseNumber,
  removePhaseDetailsFromRoadmap,
  removePhaseLineFromRoadmap,
  replacePhaseDetailStatus,
  replacePhaseLineCompletionMarker,
  requireConfirmedRoadmapMutation,
  requireRoadmapPhaseMetadata,
  rewriteRoadmapPhaseReferences
} from "./phase-roadmap-mutations.js";
import {
  mapRequirementsToInsertedPhase,
  repairRequirementsTraceability,
  requireDeclaredRequirementIds,
  requireUnassignedRoadmapRequirements
} from "./phase-roadmap-requirements.js";
import {
  phaseArtifactInputSchema,
  phaseArtifactScaffoldInputSchema,
  phaseArtifactWriteInputSchema,
  phaseCheckpointDeleteInputSchema,
  phaseCheckpointGetInputSchema,
  phaseCheckpointPutInputSchema,
  phaseExecutionTargetsInputSchema,
  phaseLookupInputSchema,
  phasePlanAuthoringContextInputSchema,
  phasePlanInputSchema,
  phasePlanReadinessInputSchema,
  phasePlanReadInputSchema,
  phasePlanValidateInputSchema,
  phasePlanValidateModelInputSchema,
  phasePlanWriteInputSchema,
  phaseSummaryAuthoringContextInputSchema,
  phaseSummaryReadInputSchema,
  phaseSummaryValidateModelInputSchema,
  phaseSummaryWriteInputSchema,
  phaseUiSkipWriteInputSchema,
  phaseValidationArtifactInputSchema,
  phaseValidationAuthoringContextInputSchema,
  phaseValidationRenderInputSchema,
  phaseValidationValidateModelInputSchema,
  phaseValidationWriteInputSchema,
  roadmapAddPhaseInputSchema,
  roadmapInsertPhaseInputSchema,
  roadmapPromoteBacklogInputSchema,
  roadmapReadInputSchema,
  roadmapRemovePhaseInputSchema
} from "./phase-input-schemas.js";
import type {
  LoadedPhasePlanArtifact,
  LoadedPhaseSummaryInventoryRecord,
  PhaseArtifactReadArgs,
  PhaseArtifactReadResult,
  PhaseArtifactRetryPlan,
  PhaseArtifactScaffoldArgs,
  PhaseArtifactScaffoldResult,
  PhaseArtifactWriteArgs,
  PhaseArtifactWriteResult,
  PhaseCheckpointDeleteArgs,
  PhaseCheckpointGetArgs,
  PhaseCheckpointPutArgs,
  PhaseContextResult,
  PhaseExecutionExternalServicePrerequisite,
  PhaseExecutionTargetConflictGroup,
  PhaseExecutionTargetPlan,
  PhaseExecutionTargetSummary,
  PhaseExecutionTargetsArgs,
  PhaseExecutionTargetsResult,
  PhaseLocateResult,
  PhaseLookupArgs,
  PhasePlanAuthoringContextArgs,
  PhasePlanAuthoringContextBuildInput,
  PhasePlanAuthoringContextResult,
  PhasePlanIndexBuildInput,
  PhasePlanIndexResult,
  PhasePlanReadArgs,
  PhasePlanReadResult,
  PhasePlanReadSetEntry,
  PhasePlanReadinessArgs,
  PhasePlanReadinessBody,
  PhasePlanReadinessResult,
  PhasePlanRecord,
  PhasePlanSetValidationSummary,
  PhasePlanStandaloneValidateModelResult,
  PhasePlanValidateArgs,
  PhasePlanValidateModelArgs,
  PhasePlanValidateModelResult,
  PhasePlanValidateModelTarget,
  PhasePlanValidationResult,
  PhasePlanWriteArgs,
  PhasePlanWriteModelValidationResult,
  PhasePlanWriteResult,
  PhasePlanningReadiness,
  PhaseResearchStatusResult,
  PhaseSelectionResult,
  PhaseSummaryAuthoringContextArgs,
  PhaseSummaryAuthoringContextResult,
  PhaseSummaryIndexResult,
  PhaseSummaryInventory,
  PhaseSummaryReadArgs,
  PhaseSummaryReadResult,
  PhaseSummaryRecord,
  PhaseSummaryStandaloneValidateModelResult,
  PhaseSummaryValidateModelArgs,
  PhaseSummaryValidateModelResult,
  PhaseSummaryWriteArgs,
  PhaseSummaryWriteResult,
  PhaseUiSkipWriteArgs,
  PhaseValidationAuthoringContextArgs,
  PhaseValidationAuthoringContextResult,
  PhaseValidationReadArgs,
  PhaseValidationReadResult,
  PhaseValidationRenderResult,
  PhaseValidationStandaloneValidateModelResult,
  PhaseValidationSummaryEvidence,
  PhaseValidationValidateModelArgs,
  PhaseValidationValidateModelResult,
  PhaseValidationWriteArgs,
  PhaseValidationWriteResult,
  PlanIndexArgs,
  ResearchExternalSourcesMode,
  ResolvedPhaseLocation,
  ResolvedPhaseRuntimeSnapshot,
  RoadmapAddPhaseArgs,
  RoadmapAddPhaseResult,
  RoadmapAuditBackedDetails,
  RoadmapInsertPhaseArgs,
  RoadmapInsertPhaseRequirementMappingStatus,
  RoadmapInsertPhaseResult,
  RoadmapPromoteBacklogArgs,
  RoadmapPromoteBacklogResult,
  RoadmapPromotionPreviewItem,
  RoadmapReadArgs,
  RoadmapReadResult,
  RoadmapRemovePhaseArgs,
  RoadmapRemovePhaseResult
} from "./phase-tool-types.js";
export { buildBlueprintPhaseDirectoryPath } from "./phase-roadmap-mutations.js";

function normalizedPhaseText(value: string | null | undefined): string {
  return normalizePhaseDescription(value ?? "").toLowerCase();
}

function findMatchingAuditBackedPhase(
  phases: ParsedRoadmapPhase[],
  phaseName: string,
  auditBackedDetails: RoadmapAuditBackedDetails | null
): ParsedRoadmapPhase | null {
  if (!auditBackedDetails) {
    return null;
  }

  const expectedRequirements = auditBackedDetails.repairRequirementIds ?? [];
  const expectedGoal = normalizedPhaseText(auditBackedDetails.goal);

  return phases.find((phase) => {
    if (normalizedPhaseText(phase.phaseName) !== normalizedPhaseText(phaseName)) {
      return false;
    }

    if (expectedRequirements.length > 0) {
      return expectedRequirements.every((requirementId) =>
        phase.requirements.includes(requirementId)
      );
    }

    return expectedGoal.length > 0 && normalizedPhaseText(phase.goal) === expectedGoal;
  }) ?? null;
}

async function reuseAuditBackedPhase(
  projectRoot: string,
  roadmap: ParsedRoadmap,
  phase: ParsedRoadmapPhase,
  auditBackedDetails: RoadmapAuditBackedDetails
): Promise<RoadmapAddPhaseResult> {
  const locatedPhaseDir = await findPhaseDirectory(projectRoot, phase.phaseNumber);

  if (locatedPhaseDir.reason === "ambiguous") {
    throw new Error(
      `Phase ${phase.phaseNumber} has multiple matching directories under ${BLUEPRINT_PHASES_PATH}. Resolve the drift before reusing the audit-backed phase.`
    );
  }

  const phaseDir =
    locatedPhaseDir.phaseDir ??
    buildBlueprintPhaseDirectoryPath(phase.phaseNumber, phase.phaseName);
  const phaseDirState = await materializePhaseDirectory(projectRoot, phaseDir);
  const requirementsPath = `${BLUEPRINT_DIR}/REQUIREMENTS.md`;
  const requirementsAbsolutePath = resolveBlueprintPath(projectRoot, requirementsPath);
  const warnings = [
    `Reused existing audit-backed Phase ${phase.phaseNumber} instead of appending a duplicate.`
  ];
  const requirementRepair = auditBackedDetails.repairRequirementIds?.length
    ? await repairRequirementsTraceability(
        projectRoot,
        auditBackedDetails.repairRequirementIds,
        phase.phaseNumber,
        phase.phaseName,
        auditBackedDetails.sourceReportPath
      )
    : null;
  const originalRequirements = requirementRepair
    ? await fs.readFile(requirementsAbsolutePath, "utf8")
    : null;
  const preparedRequirements = requirementRepair
    ? prepareTextForPersistence(requirementRepair.content, {
        label: requirementsPath
      })
    : null;

  warnings.push(...phaseDirState.warnings);
  warnings.push(...(preparedRequirements?.warnings ?? []));

  try {
    if (requirementRepair) {
      warnings.push(...requirementRepair.warnings);
      warnings.push(
        ...await writeTextFile(
          requirementsAbsolutePath,
          preparedRequirements?.content ?? requirementRepair.content,
          {
            label: requirementsPath,
            enforcePromptBoundary: false
          }
        )
      );
    }
  } catch (error) {
    if (originalRequirements !== null) {
      await writeTextFile(requirementsAbsolutePath, originalRequirements, {
        label: requirementsPath,
        enforcePromptBoundary: false
      }).catch(() => undefined);
    }

    if (phaseDirState.created) {
      await fs.rm(phaseDirState.phaseDirPath, {
        recursive: true,
        force: true
      }).catch(() => undefined);
    }

    throw error;
  }

  return {
    phaseNumber: phase.phaseNumber,
    phasePrefix: phase.phasePrefix,
    phaseName: phase.phaseName,
    slug: slugifyPhaseName(phase.phaseName),
    phaseDir,
    contextPath: buildArtifactPath(phaseDir, phase.phasePrefix, "-CONTEXT.md"),
    roadmapPath: roadmap.path,
    milestone: roadmap.milestone,
    requirementValidationStatus:
      auditBackedDetails.repairRequirementIds?.length ? "traceability-repaired" : "declared",
    createdPhaseDir: phaseDirState.created,
    idempotencyStatus: "reused-existing-phase",
    written: true,
    warnings
  };
}

async function syncRoadmapPhaseCompletion(
  projectRoot: string,
  resolved: ResolvedPhaseLocation,
  options: { noUat?: boolean } = {}
): Promise<string[]> {
  const roadmapPath = resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/ROADMAP.md`);

  if (!(await pathExists(roadmapPath))) {
    return [];
  }

  const phaseArtifacts = await listPhaseArtifacts(
    resolveBlueprintPath(projectRoot, resolved.phaseDir),
    projectRoot
  );
  const summaryIndex = await blueprintPhaseSummaryIndex({
    cwd: projectRoot,
    phase: resolved.phaseNumber
  });
  const completedSummaryPlanIds = new Set(summaryIndex.completedPlans);
  const { summaryPaths, warnings: summaryWarnings } = await collectValidatedSummaryPaths(
    projectRoot,
    completedSummaryRecords(summaryIndex.summaries, completedSummaryPlanIds)
  );
  const validationWarnings: string[] = [];
  let hasValidVerification = false;
  let verificationReadyForUat = false;
  let hasCompleteUat = false;
  let hasBlockingUat = false;

  for (const artifact of ["verification", "uat"] as const) {
    const artifactPath = validationArtifactPathFor(resolved, artifact);

    if (!phaseArtifacts.includes(artifactPath)) {
      continue;
    }

    const content = await fs.readFile(resolveBlueprintPath(projectRoot, artifactPath), "utf8");
    const validation =
      artifact === "verification"
        ? validateVerificationArtifactContent(content, summaryPaths, {
            noUat: options.noUat === true
          })
        : validateUatArtifactContent(content, summaryPaths, {
            requireReadyVerificationEvidence: true
          });

    if (validation.valid) {
      if (artifact === "verification") {
        hasValidVerification = true;
        verificationReadyForUat = isVerificationArtifactReadyForUat(content);
        if (!verificationReadyForUat) {
          validationWarnings.push(
            `${artifactPath}: verification artifact is valid but does not declare ready for UAT, so the phase cannot complete yet.`
          );
        }
      } else {
        const uatState = readUatArtifactState(content);

        if (uatState.complete) {
          hasCompleteUat = true;
        } else {
          hasBlockingUat = true;
          validationWarnings.push(
            `${artifactPath}: UAT artifact is valid but remains incomplete (${uatState.status ?? "unknown status"} with checkpoint ${uatState.checkpoint ?? "missing"}), so the phase cannot complete yet.`
          );
        }
      }
      continue;
    }

    validationWarnings.push(
      `${artifactPath}: ${artifact.toUpperCase()} artifact is invalid and does not count as completed validation evidence.`
    );
    if (artifact === "uat") {
      hasBlockingUat = true;
    }
    validationWarnings.push(...validation.issues.map((issue) => `${artifactPath}: ${issue}`));
    validationWarnings.push(...validation.warnings.map((warning) => `${artifactPath}: ${warning}`));
  }

  const qualityGateEvaluation = await evaluatePhaseQualityGates({
    projectRoot,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseDir: resolved.phaseDir,
    artifacts: phaseArtifacts
  });
  const requiresQualityGate =
    (qualityGateEvaluation as { requiresQualityGate?: boolean }).requiresQualityGate ??
    qualityGateEvaluation.requiresCodeReview;

  validationWarnings.push(...qualityGateEvaluation.warnings);

  if (
    (hasCompleteUat || (options.noUat === true && !hasBlockingUat)) &&
    requiresQualityGate &&
    !qualityGateEvaluation.gatesSatisfied
  ) {
    const debtReason = formatPhaseQualityGateDebtReason(qualityGateEvaluation);

    validationWarnings.push(
      debtReason === null
        ? `Phase ${resolved.phaseNumber} remains open in ${BLUEPRINT_DIR}/ROADMAP.md because quality-gate closeout evidence is still incomplete for ${qualityGateEvaluation.reviewableFiles.length} reviewable file(s).`
        : `Phase ${resolved.phaseNumber} remains open in ${BLUEPRINT_DIR}/ROADMAP.md because ${debtReason}`
    );
  }

  const completed =
    summaryIndex.pendingPlans.length === 0 &&
    summaryPaths.length > 0 &&
    hasValidVerification &&
    verificationReadyForUat &&
    (hasCompleteUat || (options.noUat === true && !hasBlockingUat)) &&
    (!requiresQualityGate || qualityGateEvaluation.gatesSatisfied);
  const rawRoadmap = await fs.readFile(roadmapPath, "utf8");
  const phaseLineSync = replacePhaseLineCompletionMarker(
    rawRoadmap,
    resolved.phaseNumber,
    completed
  );

  if (!phaseLineSync.found) {
    return [
      `ROADMAP completion sync could not find Phase ${resolved.phaseNumber} in ${BLUEPRINT_DIR}/ROADMAP.md.`
    ];
  }

  const detailStatus =
    completed
      ? replacePhaseDetailStatus(phaseLineSync.content, resolved.phaseNumber, "completed")
      : replacePhaseDetailStatus(phaseLineSync.content, resolved.phaseNumber, "in_progress");

  if (!phaseLineSync.changed && !detailStatus.changed) {
    return [];
  }

  const warnings = await writeTextFile(roadmapPath, detailStatus.content, {
    label: `${BLUEPRINT_DIR}/ROADMAP.md`
  });

  warnings.push(...summaryWarnings, ...validationWarnings);
  warnings.push(
    completed
      ? `Marked Phase ${resolved.phaseNumber} completed in ${BLUEPRINT_DIR}/ROADMAP.md.`
      : `Reopened Phase ${resolved.phaseNumber} in ${BLUEPRINT_DIR}/ROADMAP.md until validation evidence is complete.`
  );

  return warnings;
}

function normalizeBacklogReviewStatus(value: string | null): string {
  return value?.trim().toLowerCase() ?? "backlog";
}

function backlogStatusBlocksPromotion(value: string | null): boolean {
  return ["promoted", "done", "completed", "archived", "removed", "discarded"].includes(
    normalizeBacklogReviewStatus(value)
  );
}

async function readBacklogPromotionCandidates(projectRoot: string): Promise<{
  status: "ready" | "project_missing" | "missing";
  backlogItems: RoadmapPromotionPreviewItem[];
  warnings: string[];
}> {
  const projectPath = resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/PROJECT.md`);
  const roadmapPath = resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/ROADMAP.md`);
  const backlogPath = resolveBlueprintPath(projectRoot, BLUEPRINT_BACKLOG_INDEX_PATH);

  if (!(await pathExists(projectPath)) || !(await pathExists(roadmapPath))) {
    return {
      status: "project_missing",
      backlogItems: [],
      warnings: [
        "Blueprint review-backlog requires an initialized project. Run /blu-new-project before promoting backlog items."
      ]
    };
  }

  if (!(await pathExists(backlogPath))) {
    return {
      status: "missing",
      backlogItems: [],
      warnings: ["No backlog index exists yet. Run /blu-add-backlog before reviewing backlog items."]
    };
  }

  const rawBacklog = await fs.readFile(backlogPath, "utf8");
  const parsedBacklog = parseCaptureIndexDocument(rawBacklog, "backlog");
  const warnings = parsedBacklog.malformed
    ? [
        `Recovered non-canonical backlog index content while reading ${BLUEPRINT_BACKLOG_INDEX_PATH}.`
      ]
    : [];

  return {
    status: "ready",
    backlogItems: parsedBacklog.rows.map((row) => ({
      backlogId: row.id,
      description: row.description,
      status: row.status,
      reservedPhase: row.reservedPhase
    })),
    warnings
  };
}

function extractRequirementIdsFromRequirementsTable(section: string): string[] {
  return extractMarkdownTableRows(section)
    .map((row) => row[0]?.trim() ?? "")
    .filter((id) => DURABLE_REQUIREMENT_ID_PATTERN.test(id));
}

function formatRoadmapPhaseCandidate(phase: ParsedRoadmapPhase): string {
  return `Phase ${phase.phaseNumber}: ${phase.phaseName}`;
}

function buildRemovePhaseRecovery(
  targetPhaseNumber: string,
  roadmap: {
    milestone: string | null;
    phases: ParsedRoadmapPhase[];
  }
): string[] {
  const orderedPhases = [...roadmap.phases].sort((left, right) =>
    comparePhaseNumbers(left.phaseNumber, right.phaseNumber)
  );
  const lowerCandidates = orderedPhases.filter(
    (phase) => comparePhaseNumbers(phase.phaseNumber, targetPhaseNumber) < 0
  );
  const higherCandidates = orderedPhases.filter(
    (phase) => comparePhaseNumbers(phase.phaseNumber, targetPhaseNumber) > 0
  );
  const nearestCandidates = [lowerCandidates.at(-1), higherCandidates[0]].filter(
    (phase): phase is ParsedRoadmapPhase => phase !== undefined
  );
  const recovery: string[] = [];

  if (nearestCandidates.length > 0) {
    recovery.push(
      `Nearest valid phase candidate${nearestCandidates.length > 1 ? "s" : ""}: ${nearestCandidates
        .map((phase) => formatRoadmapPhaseCandidate(phase))
        .join("; ")}`
    );
  }

  if (roadmap.milestone) {
    recovery.push(`Active milestone candidate: ${roadmap.milestone}`);
  }

  recovery.push(
    "Use /blu-progress to confirm the safest currently implemented next action."
  );

  return recovery;
}

function extractHeadingPhaseDetails(
  heading: string | null
): {
  phaseNumber: string | null;
  phaseName: string | null;
} {
  if (!heading) {
    return {
      phaseNumber: null,
      phaseName: null
    };
  }

  const match = heading.match(/^Phase\s+(\d+(?:\.\d+)?):\s+(.+?)\s+-\s+Plan\s+\S+\s*$/);

  if (!match) {
    return {
      phaseNumber: null,
      phaseName: null
    };
  }

  return {
    phaseNumber: normalizePhaseNumber(match[1]),
    phaseName: match[2]?.trim() ?? null
  };
}

async function readPhaseRoadmapRequirements(
  projectRoot: string,
  phaseNumber: string
): Promise<string[]> {
  const roadmapPath = resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/ROADMAP.md`);

  if (!(await pathExists(roadmapPath))) {
    return [];
  }

  const roadmap = parseRoadmapDocument(await fs.readFile(roadmapPath, "utf8"));
  const matchedPhase = roadmap.phases.find(
    (phase) => normalizePhaseNumber(phase.phaseNumber) === normalizePhaseNumber(phaseNumber)
  );

  return matchedPhase?.requirements ?? [];
}

async function collectPhasePlanArtifacts(
  projectRoot: string,
  resolved: ResolvedPhaseLocation,
  overrides: ReadonlyMap<string, string> = new Map()
): Promise<{
  plans: LoadedPhasePlanArtifact[];
  nonCanonicalPlanPaths: string[];
}> {
  const phaseRoot = resolveBlueprintPath(projectRoot, resolved.phaseDir);
  const planPaths = new Set<string>();

  if (await pathExists(phaseRoot)) {
    const entries = await fs.readdir(phaseRoot, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith("-PLAN.md")) {
        continue;
      }

      planPaths.add(`${resolved.phaseDir}/${entry.name}`);
    }
  }

  for (const planPath of overrides.keys()) {
    if (planPath.endsWith("-PLAN.md")) {
      planPaths.add(planPath);
    }
  }

  const plans: LoadedPhasePlanArtifact[] = [];
  const nonCanonicalPlanPaths: string[] = [];

  for (const planPath of [...planPaths].sort((left, right) => left.localeCompare(right))) {
    const planIdFromPath = parsePlanArtifactPath(planPath, resolved.phasePrefix);

    if (!planIdFromPath) {
      nonCanonicalPlanPaths.push(planPath);
      continue;
    }

    const content = overrides.get(planPath)
      ?? await fs.readFile(resolveBlueprintPath(projectRoot, planPath), "utf8");
    const validation = validatePlanArtifactContent(content, resolved.phaseNumber);

    plans.push({
      path: planPath,
      planIdFromPath,
      content,
      heading: extractHeadingText(content),
      metadata: validation.metadata,
      validation,
      normalizedFrontmatterPlanId: normalizeMaybePlanId(validation.metadata.planId)
    });
  }

  return {
    plans,
    nonCanonicalPlanPaths
  };
}

function detectDependencyCycles(graph: ReadonlyMap<string, string[]>): string[][] {
  const cycles = new Set<string>();
  const state = new Map<string, "visiting" | "visited">();
  const stack: string[] = [];

  const visit = (planId: string): void => {
    const currentState = state.get(planId);

    if (currentState === "visiting") {
      const cycleStart = stack.indexOf(planId);

      if (cycleStart >= 0) {
        const cycle = [...stack.slice(cycleStart), planId];
        cycles.add(cycle.join("->"));
      }

      return;
    }

    if (currentState === "visited") {
      return;
    }

    state.set(planId, "visiting");
    stack.push(planId);

    for (const dependency of graph.get(planId) ?? []) {
      if (!graph.has(dependency)) {
        continue;
      }

      visit(dependency);
    }

    stack.pop();
    state.set(planId, "visited");
  };

  for (const planId of graph.keys()) {
    visit(planId);
  }

  return [...cycles]
    .map((cycle) => cycle.split("->"))
    .sort((left, right) => left.join("->").localeCompare(right.join("->")));
}

async function validatePhasePlanSet(
  projectRoot: string,
  resolved: ResolvedPhaseLocation,
  options: {
    overrides?: ReadonlyMap<string, string>;
    roadmapCoverageSeverity?: "issue" | "warning" | "ignore";
  } = {}
): Promise<PhasePlanValidationResult> {
  const coverageSeverity = options.roadmapCoverageSeverity ?? "issue";
  const { plans, nonCanonicalPlanPaths } = await collectPhasePlanArtifacts(
    projectRoot,
    resolved,
    options.overrides
  );
  const issues: string[] = [];
  const warnings: string[] = [];
  const roadmapRequirementIds = await readPhaseRoadmapRequirements(projectRoot, resolved.phaseNumber);
  const coveredRequirementIds = new Set<string>();
  const unexpectedRequirementIds = new Set<string>();
  const missingDependencyIds = new Set<string>();
  const dependencyGraph = new Map<string, string[]>();
  const plansById = new Map<string, LoadedPhasePlanArtifact>();
  const frontmatterPlanPaths = new Map<string, string[]>();

  for (const planPath of nonCanonicalPlanPaths) {
    issues.push(
      `${planPath}: plan artifact path must match ${resolved.phasePrefix}-YY-PLAN.md for Phase ${resolved.phaseNumber}.`
    );
  }

  for (const plan of plans) {
    dependencyGraph.set(plan.planIdFromPath, []);
    plansById.set(plan.planIdFromPath, plan);

    for (const requirementId of plan.metadata.requirements) {
      coveredRequirementIds.add(requirementId);

      if (roadmapRequirementIds.length > 0 && !roadmapRequirementIds.includes(requirementId)) {
        unexpectedRequirementIds.add(requirementId);
      }
    }

    if (plan.normalizedFrontmatterPlanId) {
      frontmatterPlanPaths.set(plan.normalizedFrontmatterPlanId, [
        ...(frontmatterPlanPaths.get(plan.normalizedFrontmatterPlanId) ?? []),
        plan.path
      ]);
    }

    for (const issue of plan.validation.issues) {
      issues.push(`${plan.path}: ${issue}`);
    }
    for (const warning of plan.validation.warnings) {
      warnings.push(`${plan.path}: ${warning}`);
    }

    if (
      plan.normalizedFrontmatterPlanId &&
      plan.normalizedFrontmatterPlanId !== plan.planIdFromPath
    ) {
      issues.push(
        `${plan.path}: frontmatter plan_id "${plan.metadata.planId}" must match the path plan id "${plan.planIdFromPath}".`
      );
    }

    const titlePlanId = extractReferencedPlanId(plan.metadata.title);

    if (titlePlanId === "YY") {
      issues.push(
        `${plan.path}: frontmatter title must replace placeholder plan id YY with "${plan.planIdFromPath}".`
      );
    } else if (titlePlanId && titlePlanId !== plan.planIdFromPath) {
      issues.push(
        `${plan.path}: frontmatter title references plan ${titlePlanId}, which does not match path plan id "${plan.planIdFromPath}".`
      );
    }

    const headingPlanId = extractReferencedPlanId(plan.heading);

    if (headingPlanId === "YY") {
      issues.push(
        `${plan.path}: plan heading must replace placeholder plan id YY with "${plan.planIdFromPath}".`
      );
    } else if (headingPlanId && headingPlanId !== plan.planIdFromPath) {
      issues.push(
        `${plan.path}: plan heading references plan ${headingPlanId}, which does not match path plan id "${plan.planIdFromPath}".`
      );
    }

    const headingPhase = extractHeadingPhaseDetails(plan.heading);

    if (
      headingPhase.phaseNumber &&
      normalizePhaseNumber(headingPhase.phaseNumber) !== normalizePhaseNumber(resolved.phaseNumber)
    ) {
      issues.push(
        `${plan.path}: plan heading phase ${headingPhase.phaseNumber} must match Phase ${resolved.phaseNumber}.`
      );
    }

    if (headingPhase.phaseName && headingPhase.phaseName !== resolved.phaseName) {
      issues.push(
        `${plan.path}: plan heading phase name "${headingPhase.phaseName}" must match "${resolved.phaseName}".`
      );
    }
  }

  for (const [frontmatterPlanId, planPaths] of frontmatterPlanPaths) {
    if (planPaths.length > 1) {
      issues.push(
        `Frontmatter plan_id "${frontmatterPlanId}" is declared by multiple plan files: ${planPaths.join(", ")}.`
      );
    }
  }

  for (const plan of plans) {
    const dependencyIds = plan.metadata.dependsOn
      .map((dependency) => normalizeMaybePlanId(dependency))
      .filter((dependency): dependency is string => dependency !== null);

    dependencyGraph.set(plan.planIdFromPath, dependencyIds);

    for (const dependencyId of dependencyIds) {
      const dependencyPlan = plansById.get(dependencyId);

      if (!dependencyPlan) {
        missingDependencyIds.add(dependencyId);
        issues.push(
          `${plan.path}: depends_on references missing plan "${dependencyId}".`
        );
        continue;
      }

      if (
        typeof plan.metadata.wave === "number" &&
        typeof dependencyPlan.metadata.wave === "number" &&
        dependencyPlan.metadata.wave >= plan.metadata.wave
      ) {
        issues.push(
          `${plan.path}: wave ${plan.metadata.wave} must come after dependency ${dependencyId} in wave ${dependencyPlan.metadata.wave}.`
        );
      }
    }
  }

  const cyclicDependencyPlanIds = detectDependencyCycles(dependencyGraph);

  for (const cycle of cyclicDependencyPlanIds) {
    issues.push(`Plan dependency cycle detected: ${cycle.join(" -> ")}.`);
  }

  const uncoveredRequirementIds = roadmapRequirementIds.filter(
    (requirementId) => !coveredRequirementIds.has(requirementId)
  );

  if (roadmapRequirementIds.length === 0) {
    const message =
      coverageSeverity === "warning"
        ? `Final plan-set validation is still invalid: Phase ${resolved.phaseNumber} has no roadmap requirements. Add roadmap requirement grounding before treating /blu-plan-phase as complete.`
        : `Phase ${resolved.phaseNumber} has no roadmap requirements; phase plan set cannot be final-valid without requirement grounding.`;

    if (coverageSeverity === "issue") {
      issues.push(message);
    } else if (coverageSeverity === "warning") {
      warnings.push(message);
    }
  }

  if (uncoveredRequirementIds.length > 0) {
    const message =
      coverageSeverity === "warning"
        ? `Final plan-set validation is still invalid: Phase ${resolved.phaseNumber} plan set does not yet cover roadmap requirements: ${uncoveredRequirementIds.join(", ")}. Add or revise plans before treating /blu-plan-phase as complete.`
        : `Phase ${resolved.phaseNumber} plan set does not cover roadmap requirements: ${uncoveredRequirementIds.join(", ")}.`;

    if (coverageSeverity === "issue") {
      issues.push(message);
    } else if (coverageSeverity === "warning") {
      warnings.push(message);
    }
  }

  if (unexpectedRequirementIds.size > 0) {
    warnings.push(
      `Phase ${resolved.phaseNumber} plans reference requirements not declared for this roadmap phase: ${[...unexpectedRequirementIds]
        .sort((left, right) => left.localeCompare(right))
        .join(", ")}.`
    );
  }

  return {
    phaseFound: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    status: issues.length === 0 ? "valid" : "invalid",
    issues,
    warnings,
    planCount: plans.length,
    planIds: plans.map((plan) => plan.planIdFromPath),
    roadmapRequirementIds,
    coveredRequirementIds: [...coveredRequirementIds].sort((left, right) => left.localeCompare(right)),
    uncoveredRequirementIds,
    unexpectedRequirementIds: [...unexpectedRequirementIds].sort((left, right) => left.localeCompare(right)),
    missingDependencyIds: [...missingDependencyIds].sort((left, right) => left.localeCompare(right)),
    cyclicDependencyPlanIds
  };
}

function selectRelevantPlanValidationIssues(
  validation: PhasePlanValidationResult,
  pathValue: string,
  planId: string
): string[] {
  return validation.issues.filter((issue) => {
    const normalizedIssue = issue.replace(/^[^:]+:\s*/, "");

    if (isPhasePlanMarkdownVerifiabilityHeuristicIssue(normalizedIssue)) {
      return false;
    }

    if (issue.startsWith(`${pathValue}:`) || issue.includes(pathValue)) {
      return true;
    }

    if (issue.startsWith("Plan dependency cycle detected:")) {
      const cycle = issue
        .replace(/^Plan dependency cycle detected:\s*/, "")
        .replace(/\.$/, "")
        .split(/\s*->\s*/);

      return cycle.includes(planId);
    }

    return (
      issue.includes(`dependency ${planId} `) ||
      issue.includes(`plan "${planId}"`) ||
      issue.includes(`plan ${planId}`) ||
      issue.includes(`plan_id "${planId}"`) ||
      issue.includes(`path plan id "${planId}"`)
    );
  });
}

async function validateProspectivePhasePlanSetForPath(
  projectRoot: string,
  resolved: ResolvedPhaseLocation,
  pathValue: string,
  planId: string,
  renderedContent: string
): Promise<{
  blockingIssues: string[];
  warnings: string[];
}> {
  const prospectiveValidation = await validatePhasePlanSet(projectRoot, resolved, {
    overrides: new Map([[pathValue, renderedContent]]),
    roadmapCoverageSeverity: "warning"
  });

  return {
    blockingIssues: selectRelevantPlanValidationIssues(
      prospectiveValidation,
      pathValue,
      planId
    ),
    warnings: prospectiveValidation.warnings
  };
}

function summarizePhasePlanSetValidation(
  validation: PhasePlanValidationResult
): PhasePlanSetValidationSummary {
  return {
    status: validation.status,
    issueCount: validation.issues.length,
    warningCount: validation.warnings.length,
    issues: validation.issues,
    warnings: validation.warnings,
    planCount: validation.planCount,
    planIds: validation.planIds,
    roadmapRequirementIds: validation.roadmapRequirementIds,
    coveredRequirementIds: validation.coveredRequirementIds,
    uncoveredRequirementIds: validation.uncoveredRequirementIds,
    unexpectedRequirementIds: validation.unexpectedRequirementIds,
    missingDependencyIds: validation.missingDependencyIds,
    cyclicDependencyPlanIds: validation.cyclicDependencyPlanIds
  };
}

function isPhasePlanSetCompletionReady(validation: PhasePlanValidationResult): boolean {
  return (
    validation.issues.length === 0 &&
    validation.roadmapRequirementIds.length > 0 &&
    validation.uncoveredRequirementIds.length === 0 &&
    validation.missingDependencyIds.length === 0 &&
    validation.cyclicDependencyPlanIds.length === 0
  );
}

function phasePlanWriteCompletionFields(args: {
  prospectiveValidation: PhasePlanValidationResult;
  includeSummary: boolean;
  saved: boolean;
}): Pick<
  PhasePlanWriteResult,
  "planSetValidationSummary" | "completionReady" | "incrementalCheckpoint"
> {
  const completionReady = isPhasePlanSetCompletionReady(args.prospectiveValidation);

  return {
    planSetValidationSummary: args.includeSummary
      ? summarizePhasePlanSetValidation(args.prospectiveValidation)
      : null,
    completionReady,
    incrementalCheckpoint: args.saved && !completionReady
  };
}

function toPhasePlanRecord(
  planId: string,
  pathValue: string,
  content: string,
  expectedPhase: string
): PhasePlanRecord {
  const validation = validatePlanArtifactContent(content, expectedPhase);

  return {
    planId,
    path: pathValue,
    title: validation.metadata.title,
    wave: validation.metadata.wave,
    gapClosure: validation.metadata.gapClosure,
    status: validation.metadata.status,
    objective: validation.metadata.objective,
    dependsOn: validation.metadata.dependsOn,
    requirements: validation.metadata.requirements,
    filesModified: validation.metadata.filesModified,
    readFirst: validation.metadata.readFirst,
    acceptanceCriteria: validation.metadata.acceptanceCriteria,
    externalServicePrerequisites: validation.metadata.externalServicePrerequisites,
    autonomous: validation.metadata.autonomous,
    valid: validation.valid,
    issues: validation.issues,
    warnings: validation.warnings
  };
}

function collectMissingDependencyPlanPaths(
  dependsOn: string[],
  availablePlanIds: ReadonlySet<string>,
  resolved: Pick<ResolvedPhaseLocation, "phaseDir" | "phasePrefix">
): string[] {
  return dependsOn.flatMap((dependency) => {
    try {
      const normalizedDependency = normalizePlanId(dependency);

      return availablePlanIds.has(normalizedDependency)
        ? []
        : [planPathFor(resolved, normalizedDependency)];
    } catch {
      return [];
    }
  });
}

function consumeExpectedInventoryValues(actualValues: string[], expectedValues: string[]): {
  missing: string[];
  unexpected: string[];
} {
  const remainingExpected = new Map<string, number>();

  for (const expected of expectedValues) {
    remainingExpected.set(expected, (remainingExpected.get(expected) ?? 0) + 1);
  }

  const unexpected: string[] = [];

  for (const actual of actualValues) {
    const remaining = remainingExpected.get(actual) ?? 0;

    if (remaining > 0) {
      remainingExpected.set(actual, remaining - 1);
    } else {
      unexpected.push(actual);
    }
  }

  const missing = [...remainingExpected.entries()].flatMap(([value, count]) =>
    Array.from({ length: count }, () => value)
  );

  return { missing, unexpected };
}

function collectExactInventoryIssues(
  actualValues: string[],
  expectedValues: string[],
  label: string
): string[] {
  const issues: string[] = [];
  const { missing, unexpected } = consumeExpectedInventoryValues(actualValues, expectedValues);

  if (actualValues.length !== expectedValues.length) {
    issues.push(
      `Summary artifact ${label} must contain exactly ${expectedValues.length} row(s); found ${actualValues.length}.`
    );
  }

  if (missing.length > 0) {
    issues.push(
      `Summary artifact ${label} is missing live plan value(s): ${uniqueSortedStrings(missing).join(", ")}.`
    );
  }

  if (unexpected.length > 0) {
    issues.push(
      `Summary artifact ${label} contains out-of-scope value(s): ${uniqueSortedStrings(unexpected).join(", ")}.`
    );
  }

  return issues;
}

function validateSummaryAgainstLivePlanInventory(
  content: string,
  args: {
    resolved: Pick<ResolvedPhaseLocation, "phaseNumber" | "phaseDir" | "phasePrefix">;
    planId: string;
    plan: PhasePlanRecord | null;
    knownPlanIds: ReadonlySet<string>;
    completedDependencyPlanIds?: ReadonlySet<string>;
    completedRouteValidation?: PhaseSummaryCompletedRouteValidation;
  }
): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];
  const normalizedContent = content.replace(/\r\n/g, "\n");
  const status = extractSummaryStatus(normalizedContent);
  const readiness = extractPhaseSummaryMarkerValue(normalizedContent, "Readiness");
  const nextSafeAction = extractPhaseSummaryMarkerValue(normalizedContent, "Next Safe Action");

  if (status) {
    if (status === "COMPLETED") {
      const routeValidation = args.completedRouteValidation ?? {
        mode: "exact",
        route: phaseSummaryCompletedRoute({
          phaseNumber: args.resolved.phaseNumber,
          hasRemainingPendingPlans: false
        })
      };

      if (routeValidation.mode !== "skip") {
        const expectedRoutes =
          routeValidation.mode === "exact"
            ? [routeValidation.route]
            : [
                phaseSummaryCompletedRoute({
                  phaseNumber: args.resolved.phaseNumber,
                  hasRemainingPendingPlans: false
                }),
                phaseSummaryCompletedRoute({
                  phaseNumber: args.resolved.phaseNumber,
                  hasRemainingPendingPlans: true
                })
              ];
        const uniqueExpectedRoutes = expectedRoutes.filter(
          (route, index, routes) =>
            routes.findIndex(
              (candidate) =>
                candidate.readiness === route.readiness &&
                candidate.nextSafeAction === route.nextSafeAction
            ) === index
        );

        if (
          readiness !== null &&
          nextSafeAction !== null &&
          !uniqueExpectedRoutes.some((route) => routesMatch({ readiness, nextSafeAction }, route))
        ) {
          warnings.push(
            `Summary artifact status ${status} should use ${uniqueExpectedRoutes
              .map(formatCompletedSummaryRoute)
              .join(" or ")} for phase ${args.resolved.phaseNumber}.`
          );
        }
      }
    } else {
      const expectedNextSafeAction = {
        PARTIAL: `/blu-execute-phase ${args.resolved.phaseNumber}`,
        BLOCKED: "/blu-progress"
      }[status];

      if (nextSafeAction !== null && nextSafeAction !== expectedNextSafeAction) {
        warnings.push(
          `Summary artifact status ${status} should use **Next Safe Action:** ${expectedNextSafeAction} for phase ${args.resolved.phaseNumber}.`
        );
      }
    }
  }

  if (!args.plan) {
    issues.push(
      `Summary artifact ${args.planId} must be linked to an existing live plan artifact before it can count as execution evidence.`
    );
    return { valid: issues.length === 0, issues, warnings };
  }

  if (!args.plan.valid) {
    warnings.push(
      `linked plan ${args.plan.path} has validation issues; existing summary evidence remains usable, but execute-phase should repair the plan before new writes.`
    );
  }

  const missingDependencyPlans = collectMissingDependencyPlanPaths(
    args.plan.dependsOn,
    args.knownPlanIds,
    args.resolved
  );

  if (missingDependencyPlans.length > 0) {
    issues.push(
      `linked plan ${args.plan.path} is missing dependency plan artifacts: ${missingDependencyPlans.join(", ")}.`
    );
  }

  if (status !== "COMPLETED") {
    return { valid: issues.length === 0, issues, warnings };
  }

  const verificationRows = extractMarkdownTableRows(
    extractMarkdownSection(normalizedContent, "Verification")
  );
  const verificationChecks = verificationRows.map((row) => row[0] ?? "");

  warnings.push(
    ...collectExactInventoryIssues(
      verificationChecks,
      args.plan.acceptanceCriteria,
      "Verification checks"
    )
  );

  const dependencyRows = extractMarkdownTableRows(
    extractMarkdownSection(normalizedContent, "Dependency Plans")
  );
  const expectedDependencyPlans = dependencyPlanRowsForPlan(
    args.plan.dependsOn,
    args.knownPlanIds,
    args.resolved
  );

  if (expectedDependencyPlans.length === 0) {
    const isExactNoneSentinel =
      dependencyRows.length === 1 &&
      dependencyRows[0]?.length === 3 &&
      dependencyRows[0][0] === "none" &&
      dependencyRows[0][1] === "none" &&
      dependencyRows[0][2] === "none";

    if (!isExactNoneSentinel) {
      warnings.push(
        "Summary artifact Dependency Plans section should use the none | none | none sentinel when the live plan has no dependencies."
      );
    }
  } else {
    const expectedDependencyCells = expectedDependencyPlans.map(
      (dependency) => `${dependency.planId} (${dependency.path})`
    );
    const actualDependencyCells = dependencyRows.map((row) => row[0] ?? "");

    warnings.push(
      ...collectExactInventoryIssues(
        actualDependencyCells,
        expectedDependencyCells,
        "Dependency Plans"
      )
    );

    for (const row of dependencyRows) {
      if (row[1] !== "satisfied") {
        warnings.push(
          "Summary artifact Dependency Plans rows for live dependencies should use status satisfied."
        );
      }
    }
  }

  if (args.completedDependencyPlanIds) {
    const unsatisfiedDependencyPlanIds = normalizeDependencyPlanIds(args.plan.dependsOn).filter(
      (dependencyPlanId) =>
        args.knownPlanIds.has(dependencyPlanId) &&
        !args.completedDependencyPlanIds?.has(dependencyPlanId)
    );

    if (unsatisfiedDependencyPlanIds.length > 0) {
      issues.push(
        `linked plan ${args.plan.path} depends on incomplete execution plan(s): ${uniqueSortedStrings(unsatisfiedDependencyPlanIds).join(", ")}.`
      );
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}

function phaseSummaryLifecycleRepairSuggestion(issue: string): string | null {
  if (
    /depends on incomplete execution plan\(s\):/i.test(issue) ||
    /linked dependency plan summaries are not completed yet:/i.test(issue)
  ) {
    return (
      "Do not use Status: COMPLETED yet. Use Status: PARTIAL or Status: BLOCKED, " +
      "update Readiness, Completion State, Next Safe Action, Verification, Gap / Repair Routes, " +
      "and Follow-Ups to match, and keep the dependency blocker explicit until the dependency summary exists."
    );
  }

  if (
    /COMPLETED status cannot include explicit fail, blocked, or not-run Verification results/i.test(issue) ||
    /COMPLETED status cannot declare blocked Readiness/i.test(issue) ||
    /COMPLETED status cannot declare a non-complete Completion State/i.test(issue)
  ) {
    return (
      "Do not use Status: COMPLETED yet. Use Status: PARTIAL or Status: BLOCKED, " +
      "update Readiness, Completion State, Next Safe Action, Verification, Gap / Repair Routes, " +
      "and Follow-Ups to match the remaining blocker, and keep the open repair route explicit."
    );
  }

  return null;
}

function phaseSummaryMarkdownIssueSuggestion(issue: string): string {
  const lifecycleRepair = phaseSummaryLifecycleRepairSuggestion(issue);

  if (lifecycleRepair) {
    return lifecycleRepair;
  }

  return "Repair the summary so semantic completion evidence is truthful.";
}

function formatPhaseSummaryWriteIssue(issue: string): string {
  const lifecycleRepair = phaseSummaryLifecycleRepairSuggestion(issue);

  return lifecycleRepair && !issue.includes(lifecycleRepair)
    ? `${issue} ${lifecycleRepair}`
    : issue;
}


function phasePlanValidateModelTarget(args: {
  phase: ResolvedPhaseLocation | null;
  planId: string | null;
  path: string | null;
  schemaPath: string | null;
}): PhasePlanValidateModelTarget {
  return {
    artifact: "phase.plan",
    phaseNumber: args.phase?.phaseNumber ?? null,
    phasePrefix: args.phase?.phasePrefix ?? null,
    phaseName: args.phase?.phaseName ?? null,
    planId: args.planId,
    path: args.path,
    schemaPath: args.schemaPath
  };
}

async function validatePhasePlanModelCommands(model: Record<string, unknown>): Promise<string[]> {
  const commands = [
    ...new Set(collectModelStringValues(model).flatMap((value) => extractBlueprintDirectCommands(value)))
  ];

  if (commands.length === 0) {
    return [];
  }

  const implementedCommands = await getPhasePlanImplementedCommandNames();

  if (implementedCommands === null || implementedCommands.size === 0) {
    return [
      "Phase plan model Blueprint command references could not be checked because the implemented command catalog was unavailable."
    ];
  }

  const nonImplementedCommands = commands.filter((command) => !implementedCommands.has(command));

  return nonImplementedCommands.length > 0
    ? [
        `Phase plan model references non-implemented Blueprint command(s): ${nonImplementedCommands.join(", ")}.`
      ]
    : [];
}

function phasePlanAuthoringContextBlockers(
  context: Awaited<ReturnType<typeof resolvePhasePlanAuthoringContextData>>
): string[] {
  return context.knownRequirements.length === 0
    ? [
        `Phase ${context.resolved.phaseNumber} has no roadmap requirements; phase.plan model authoring cannot invent requirement coverage.`
      ]
    : [];
}

function invalidPhasePlanningReadiness(blocker: string): PhasePlanningReadiness {
  return {
    workflowResearchRequired: false,
    workflowUiPhaseRequired: false,
    workflowUiSafetyGateEnabled: false,
    readyForPlanPhase: false,
    nextSafeAction: "Run /blu-progress to review the next safe Blueprint action",
    blockers: [blocker]
  };
}

function buildPhasePlanAuthoringReadinessReason(
  planningReadiness: PhasePlanningReadiness
): string {
  const detail =
    planningReadiness.blockers.length > 0
      ? planningReadiness.blockers.join(" ")
      : (planningReadiness.diagnostics ?? []).map((diagnostic) => diagnostic.message).join(" ");
  const detailWithPunctuation =
    detail.length === 0
      ? "Phase planning is not ready for /blu-plan-phase."
      : /[.!?]$/.test(detail)
        ? detail
        : `${detail}.`;
  const action = planningReadiness.nextSafeAction.trim();

  if (action.length === 0) {
    return detailWithPunctuation;
  }

  return `${detailWithPunctuation} Next safe action: ${action}${/[.!?]$/.test(action) ? "" : "."}`;
}

function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function buildReadinessHashEntry(args: {
  pathValue: string;
  kind: string;
  value: unknown;
  reason?: string;
}): PhasePlanReadSetEntry {
  const serialized = typeof args.value === "string"
    ? args.value
    : (JSON.stringify(args.value) ?? "undefined");

  return {
    path: args.pathValue,
    kind: args.kind,
    hash: hashString(serialized),
    sizeBytes: Buffer.byteLength(serialized, "utf8"),
    truncated: false,
    included: false,
    reason: args.reason ?? "freshness-metadata"
  };
}

function truncateForReadiness(content: string, maxBodyBytes: number): {
  content: string;
  truncated: boolean;
} {
  const buffer = Buffer.from(content, "utf8");

  if (buffer.byteLength <= maxBodyBytes) {
    return {
      content,
      truncated: false
    };
  }

  return {
    content: buffer.subarray(0, maxBodyBytes).toString("utf8"),
    truncated: true
  };
}

async function readReadinessPath(args: {
  projectRoot: string;
  pathValue: string;
  kind: string;
  includeContent: boolean;
  maxBodyBytes: number;
  reason?: string;
}): Promise<{
  readSet: PhasePlanReadSetEntry;
  body: PhasePlanReadinessBody;
  raw: string | null;
}> {
  const absolutePath = resolveBlueprintPath(args.projectRoot, args.pathValue);

  if (!(await pathExists(absolutePath))) {
    return {
      readSet: {
        path: args.pathValue,
        kind: args.kind,
        hash: "missing",
        sizeBytes: 0,
        truncated: false,
        included: false,
        reason: args.reason ?? "missing"
      },
      body: {
        path: args.pathValue,
        summary: null,
        hash: null,
        sizeBytes: 0,
        truncated: false,
        omittedReason: args.reason ?? "missing",
        warnings: []
      },
      raw: null
    };
  }

  const raw = await fs.readFile(absolutePath, "utf8");
  const rawSizeBytes = Buffer.byteLength(raw, "utf8");
  const hash = hashString(raw);
  const summary = summarizeSavedArtifact(raw);
  const truncatedContent = truncateForReadiness(raw, args.maxBodyBytes);
  const contentIncluded = args.includeContent;

  return {
    readSet: {
      path: args.pathValue,
      kind: args.kind,
      hash,
      sizeBytes: rawSizeBytes,
      truncated: contentIncluded ? truncatedContent.truncated : false,
      included: contentIncluded,
      reason: args.reason ?? (contentIncluded ? undefined : "summary-only")
    },
    body: {
      path: args.pathValue,
      ...(contentIncluded ? { content: truncatedContent.content } : {}),
      summary: `${summary.title}: ${summary.summary}`,
      hash,
      sizeBytes: rawSizeBytes,
      truncated: contentIncluded ? truncatedContent.truncated : false,
      ...(contentIncluded
        ? {}
        : { omittedReason: args.reason ?? "bodyMode summary" }),
      warnings: []
    },
    raw
  };
}

function dedupeReadSet(readSet: PhasePlanReadSetEntry[]): PhasePlanReadSetEntry[] {
  const entries = new Map<string, PhasePlanReadSetEntry>();

  for (const entry of readSet) {
    entries.set(`${entry.kind}:${entry.path}`, entry);
  }

  return [...entries.values()].sort((left, right) =>
    `${left.kind}:${left.path}`.localeCompare(`${right.kind}:${right.path}`)
  );
}

function compareReadSetFreshness(
  currentReadSet: PhasePlanReadSetEntry[],
  previousReadSet?: PhasePlanReadinessArgs["previousReadSet"]
): PhasePlanReadinessResult["freshness"] {
  if (!previousReadSet || previousReadSet.length === 0) {
    return {
      checked: false,
      fresh: true,
      stalePaths: []
    };
  }

  const currentByKey = new Map(
    currentReadSet.map((entry) => [`${entry.kind}:${entry.path}`, entry])
  );
  const previousByKey = new Map(
    previousReadSet.map((entry) => [`${entry.kind}:${entry.path}`, entry])
  );
  const previousByPathAndHash = new Set(
    previousReadSet.map((entry) => `${entry.path}:${entry.hash}`)
  );
  const stalePaths = previousReadSet.flatMap((entry) => {
    const current = currentByKey.get(`${entry.kind}:${entry.path}`);

    return current && current.hash === entry.hash ? [] : [entry.path];
  });
  const missingPreviousPaths = currentReadSet.flatMap((entry) =>
    previousByKey.has(`${entry.kind}:${entry.path}`) ||
    entry.hash === "missing" ||
    (
      entry.kind === "phase.plan.body" &&
      previousByPathAndHash.has(`${entry.path}:${entry.hash}`)
    )
      ? []
      : [entry.path]
  );

  return {
    checked: true,
    fresh: stalePaths.length === 0 && missingPreviousPaths.length === 0,
    stalePaths: [...new Set([...stalePaths, ...missingPreviousPaths])].sort((left, right) =>
      left.localeCompare(right)
    )
  };
}

function phasePlanAuthoringContextFromData(args: {
  context: Awaited<ReturnType<typeof buildPhasePlanAuthoringContextData>>;
  planningReadiness: PhasePlanningReadiness;
}): PhasePlanAuthoringContextResult {
  const authoringBlockers = phasePlanAuthoringContextBlockers(args.context);
  const ready = authoringBlockers.length === 0 && args.planningReadiness.readyForPlanPhase;

  return {
    status: ready ? "ready" : "invalid",
    phase: args.context.resolved,
    planId: args.context.planId,
    path: args.context.pathValue,
    schemaPath: args.context.schemaPath,
    baseSchema: args.context.baseSchema,
    taskSchema: args.context.taskSchema,
    knownRequirements: args.context.knownRequirements,
    knownEvidenceArtifacts: args.context.knownEvidenceArtifacts,
    allowedDependencyPlanIds: args.context.allowedDependencyPlanIds,
    planningReadiness: args.planningReadiness,
    modelOnly: true,
    reason:
      authoringBlockers.length > 0
        ? authoringBlockers.join(" ")
        : args.planningReadiness.readyForPlanPhase
          ? null
          : buildPhasePlanAuthoringReadinessReason(args.planningReadiness),
    warnings: []
  };
}

function emptyReadinessReviewSeverityCounts(): Record<string, number> {
  return {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0
  };
}

function normalizeReadinessReviewSeverity(value: string): string | null {
  const normalized = value.trim().toLowerCase();

  return ["critical", "high", "medium", "low", "unknown"].includes(normalized)
    ? normalized
    : null;
}

function countReviewSeverities(content: string): Record<string, number> {
  const counts = emptyReadinessReviewSeverityCounts();

  for (const match of content.matchAll(
    /(?:^|\n)\s*(?:[-*]\s*)?(?:\*\*)?Severity(?:\*\*)?\s*[:|-]\s*`?(critical|high|medium|low|unknown)`?/gi
  )) {
    const severity = normalizeReadinessReviewSeverity(match[1] ?? "");

    if (severity) {
      counts[severity] += 1;
    }
  }

  const tableRows = extractMarkdownTableRows(content);
  let severityIndex = -1;

  for (const row of tableRows) {
    const normalizedCells = row.map((cell) => cell.trim().toLowerCase());

    if (severityIndex < 0) {
      severityIndex = normalizedCells.findIndex((cell) => cell === "severity");
      continue;
    }

    const severity = normalizeReadinessReviewSeverity(row[severityIndex] ?? "");

    if (severity) {
      counts[severity] += 1;
    }
  }

  return counts;
}

function extractReviewFindingIds(content: string): string[] {
  return [
    ...new Set(
      [...content.matchAll(/\b(?:F|FU)-[A-Z0-9][A-Z0-9._-]*\b/g)].map((match) => match[0])
    )
  ].sort((left, right) => left.localeCompare(right));
}

function firstNonNull<T>(values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value;
    }
  }

  return null;
}

function normalizePhasePlanModelSurface(value: string): string {
  return normalizeExecutionSurfacePath(value);
}

function listDuplicateValues(values: string[]): string[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort((left, right) => left.localeCompare(right));
}

function isPhasePlanEvidenceArtifact(artifactPath: string, targetPath: string): boolean {
  const normalized = normalizePhasePlanModelSurface(artifactPath);

  if (normalized === normalizePhasePlanModelSurface(targetPath)) {
    return false;
  }

  return normalized.startsWith(`${BLUEPRINT_PHASES_PATH}/`) && normalized.endsWith(".md");
}

function isCanonicalPhasePlanArtifactPath(
  artifactPath: string,
  resolved: Pick<ResolvedPhaseLocation, "phaseDir" | "phasePrefix">
): boolean {
  return parseCanonicalPlanArtifactPath(artifactPath, resolved) !== null;
}

function isCanonicalPhaseSummaryArtifactPath(
  artifactPath: string,
  resolved: Pick<ResolvedPhaseLocation, "phaseDir" | "phasePrefix">
): boolean {
  return (
    path.posix.dirname(artifactPath) === resolved.phaseDir &&
    parseSummaryArtifactPath(artifactPath, resolved.phasePrefix) !== null
  );
}

function isCanonicalPhaseSpecArtifactPath(
  artifactPath: string,
  resolved: Pick<ResolvedPhaseLocation, "phaseDir" | "phasePrefix">
): boolean {
  return artifactPath === artifactPathFor(resolved, "spec");
}

function isNoncanonicalPhaseSpecLookalikePath(
  artifactPath: string,
  resolved: Pick<ResolvedPhaseLocation, "phaseDir" | "phasePrefix">
): boolean {
  const basename = path.posix.basename(artifactPath);
  const canonicalSpecFileName = `${resolved.phasePrefix}-SPEC.md`;
  const uiSpecFileName = `${resolved.phasePrefix}-UI-SPEC.md`;

  if (isCanonicalPhaseSpecArtifactPath(artifactPath, resolved)) {
    return false;
  }

  if (basename === uiSpecFileName) {
    return false;
  }

  return (
    basename === canonicalSpecFileName ||
    (basename.startsWith(`${resolved.phasePrefix}-`) && basename.endsWith("-SPEC.md"))
  );
}

function isCanonicalPhaseEvidenceArtifactPath(
  artifactPath: string,
  resolved: Pick<ResolvedPhaseLocation, "phaseDir" | "phasePrefix">
): boolean {
  if (isCanonicalPhasePlanArtifactPath(artifactPath, resolved)) {
    return true;
  }

  if (isCanonicalPhaseSummaryArtifactPath(artifactPath, resolved)) {
    return true;
  }

  return (
    artifactPath === artifactPathFor(resolved, "context") ||
    artifactPath === artifactPathFor(resolved, "discussion-log") ||
    artifactPath === artifactPathFor(resolved, "research") ||
    artifactPath === artifactPathFor(resolved, "spec") ||
    artifactPath === artifactPathFor(resolved, "ui-spec") ||
    artifactPath === validationArtifactPathFor(resolved, "verification") ||
    artifactPath === validationArtifactPathFor(resolved, "uat") ||
    artifactPath === buildArtifactPath(resolved.phaseDir, resolved.phasePrefix, "-REVIEW.md")
  );
}

function canonicalPhaseReadinessInventory(
  artifacts: readonly string[],
  resolved: Pick<ResolvedPhaseLocation, "phaseDir" | "phasePrefix">
): string[] {
  return artifacts
    .filter((artifact) => isCanonicalPhaseEvidenceArtifactPath(artifact, resolved))
    .sort((left, right) => left.localeCompare(right));
}

function isPhasePlanAcceptanceCriterionVerifiable(value: string): boolean {
  return (
    /\b(?:test|tests|grep|rg|command|file-read|artifact-validation|validate|validation|typecheck|build)\b/i.test(
      value
    ) ||
    /^(?:npm|pnpm|yarn|node|git|bash|sh)\s+\S+/i.test(value) ||
    /(?:^|[\s"`'])?(?:src|tests|docs|skills|agents|commands|\.blueprint)\/[^\s`'"()]+/.test(
      value
    ) ||
    /`[^`]+`/.test(value)
  );
}

function isPhasePlanMarkdownVerifiabilityHeuristicIssue(issue: string): boolean {
  return (
    /must use grep\/test-verifiable or otherwise objectively checkable bullets:/i.test(issue)
  );
}

function partitionPhasePlanMarkdownValidationIssues(issues: readonly string[]): {
  blockingIssues: string[];
  warningIssues: string[];
} {
  const blockingIssues: string[] = [];
  const warningIssues: string[] = [];

  for (const issue of issues) {
    if (isPhasePlanMarkdownVerifiabilityHeuristicIssue(issue)) {
      warningIssues.push(issue);
    } else {
      blockingIssues.push(issue);
    }
  }

  return { blockingIssues, warningIssues };
}

function phasePlanMarkdownDiagnosticFromIssue(issue: string): PhasePlanModelDiagnostic {
  const heuristicGuidance = isPhasePlanMarkdownVerifiabilityHeuristicIssue(issue);

  return phasePlanDiagnostic({
    severity: heuristicGuidance ? "warning" : "error",
    source: "markdown",
    path: "renderPreview",
    code: heuristicGuidance ? "markdown.verifiability_guidance" : "markdown.invalid_render",
    message: issue,
    context: {},
    repairAction: heuristicGuidance ? "make-verifiable" : undefined,
    suggestion: heuristicGuidance
      ? "Prefer an objective command, file-read, grep, test, or artifact-validation check when possible, but do not rewrite domain-specific criteria solely to satisfy keyword matching."
      : "Repair the model so MCP-rendered Markdown satisfies the phase.plan artifact contract."
  });
}

async function collectKnownPhasePlanEvidenceArtifacts(
  projectRoot: string,
  resolved: ResolvedPhaseLocation,
  targetPath: string,
  artifacts?: string[]
): Promise<string[]> {
  const phaseArtifacts =
    artifacts ??
    (await resolvePhaseRuntimeSnapshot({
      cwd: projectRoot,
      phase: resolved.phaseNumber
    })).artifacts;
  const canonicalSpecPath = findPhaseSpecArtifact(
    phaseArtifacts,
    resolved.phaseDir,
    resolved.phasePrefix
  );
  const canonicalSpecFileName = `${resolved.phasePrefix}-SPEC.md`;

  return phaseArtifacts.filter((artifact) => {
    if (!isPhasePlanEvidenceArtifact(artifact, targetPath)) {
      return false;
    }

    if (!isCanonicalPhaseEvidenceArtifactPath(artifact, resolved)) {
      return false;
    }

    if (isNoncanonicalPhaseSpecLookalikePath(artifact, resolved)) {
      return false;
    }

    if (path.posix.basename(artifact) === canonicalSpecFileName) {
      return canonicalSpecPath !== null && isCanonicalPhaseSpecArtifactPath(artifact, resolved);
    }

    return true;
  });
}

async function resolvePhasePlanAuthoringContextData(
  args: PhasePlanAuthoringContextArgs
): Promise<Awaited<ReturnType<typeof buildPhasePlanAuthoringContextData>>> {
  return buildPhasePlanAuthoringContextData({
    snapshot: await resolvePhaseRuntimeSnapshot(args),
    planId: args.planId
  });
}

async function buildPhasePlanAuthoringContextData(
  input: PhasePlanAuthoringContextBuildInput
): Promise<{
  projectRoot: string;
  resolved: ResolvedPhaseLocation;
  planId: string;
  pathValue: string;
  schemaPath: string;
  baseSchema: Record<string, unknown>;
  taskSchema: Record<string, unknown>;
  knownRequirements: string[];
  knownEvidenceArtifacts: string[];
  allowedDependencyPlanIds: string[];
}> {
  const { snapshot } = input;
  const { projectRoot, resolved } = snapshot;

  if (!resolved) {
    throw new Error(snapshot.located.reason ?? "Phase could not be resolved for plan authoring.");
  }

  const existingIndex = await buildPhasePlanIndexFromResolved({
    projectRoot,
    resolved,
    artifacts: snapshot.artifacts
  });
  const nextPlanNumber =
    existingIndex.plans.length === 0
      ? 1
      : Math.max(...existingIndex.plans.map((plan) => Number.parseInt(plan.planId, 10))) + 1;
  const planId = input.planId
    ? normalizePlanId(input.planId)
    : normalizePlanId(String(nextPlanNumber));
  const pathValue = planPathFor(resolved, planId);
  const modelContract = readArtifactContract("phase.plan").modelContract;

  if (!modelContract) {
    throw new Error("phase.plan does not expose a modelContract.");
  }
  if (!modelContract.schemaPath) {
    throw new Error("phase.plan modelContract does not expose a schemaPath.");
  }

  const knownRequirements = snapshot.matchedPhase?.requirements ?? [];
  const knownEvidenceArtifacts = await collectKnownPhasePlanEvidenceArtifacts(
    projectRoot,
    resolved,
    pathValue,
    snapshot.artifacts
  );
  const allowedDependencyPlanIds = existingIndex.plans
    .map((plan) => plan.planId)
    .filter((existingPlanId) => existingPlanId !== planId);
  const baseSchema = cloneJsonObject(modelContract.jsonSchema);
  const taskSchema = buildPhasePlanTaskSchema({
    baseSchema,
    knownRequirements,
    knownEvidenceArtifacts,
    allowedDependencyPlanIds
  });

  return {
    projectRoot,
    resolved,
    planId,
    pathValue,
    schemaPath: modelContract.schemaPath,
    baseSchema,
    taskSchema,
    knownRequirements,
    knownEvidenceArtifacts,
    allowedDependencyPlanIds
  };
}

function validatePhasePlanStructuredModelCoverage(
  model: PhasePlanStructuredModel
): { issues: string[]; warnings: string[] } {
  const issues: string[] = [];
  const warnings: string[] = [];
  const taskIds = model.tasks.map((task) => task.id);
  const taskIdSet = new Set(taskIds);
  const declaredRequirements = new Set(model.requirements);
  const declaredFiles = model.filesModified.map((filePath) => normalizePhasePlanModelSurface(filePath));
  const declaredFileSet = new Set(declaredFiles);
  const requirementRows = model.requirementCoverage.map((row) => row.requirement);
  const duplicateTaskIds = listDuplicateValues(taskIds);
  const duplicateRequirementRows = listDuplicateValues(requirementRows);
  const duplicateDeclaredFiles = listDuplicateValues(declaredFiles);
  const fileSurfaceRows = model.fileSurfaceCoverage.map((row) =>
    normalizePhasePlanModelSurface(row.surface)
  );
  const duplicateFileSurfaceRows = listDuplicateValues(fileSurfaceRows);

  for (const duplicate of duplicateTaskIds) {
    issues.push(`Phase plan model task id "${duplicate}" must be unique.`);
  }

  for (const duplicate of duplicateRequirementRows) {
    issues.push(`Phase plan model requirementCoverage duplicates requirement "${duplicate}".`);
  }

  for (const duplicate of duplicateDeclaredFiles) {
    issues.push(`Phase plan model filesModified duplicates surface "${duplicate}".`);
  }

  for (const duplicate of duplicateFileSurfaceRows) {
    issues.push(`Phase plan model fileSurfaceCoverage duplicates surface "${duplicate}".`);
  }

  for (const row of model.requirementCoverage) {
    for (const taskId of row.coveredByTasks) {
      if (!taskIdSet.has(taskId)) {
        issues.push(
          `Requirement coverage for ${row.requirement} references unknown task id "${taskId}".`
        );
      }
    }

    if (row.status === "covered") {
      if (!declaredRequirements.has(row.requirement)) {
        issues.push(
          `Requirement coverage for ${row.requirement} is covered but the requirement is absent from top-level requirements.`
        );
      }

      if (row.coveredByTasks.length === 0) {
        issues.push(
          `Requirement coverage for ${row.requirement} is covered but does not list any coveredByTasks.`
        );
      }

      for (const taskId of row.coveredByTasks) {
        const task = model.tasks.find((candidate) => candidate.id === taskId);

        if (task && !task.requirements.includes(row.requirement)) {
          issues.push(
            `Requirement coverage for ${row.requirement} references task "${taskId}", but that task does not list the requirement.`
          );
        }
      }
    }
  }

  for (const requirementId of model.requirements) {
    const coverage = model.requirementCoverage.find((row) => row.requirement === requirementId);

    if (!coverage) {
      issues.push(
        `Top-level requirement ${requirementId} is missing from requirementCoverage.`
      );
    } else if (coverage.status !== "covered") {
      issues.push(
        `Top-level requirement ${requirementId} must have covered status in requirementCoverage.`
      );
    }
  }

  for (const task of model.tasks) {
    for (const requirementId of task.requirements) {
      if (!declaredRequirements.has(requirementId)) {
        issues.push(
          `Task ${task.id} references requirement ${requirementId}, which is absent from top-level requirements.`
        );
      }
    }

    for (const filePath of task.filesModified) {
      const normalizedFile = normalizePhasePlanModelSurface(filePath);

      if (!declaredFileSet.has(normalizedFile)) {
        issues.push(
          `Task ${task.id} modifies ${normalizedFile}, which is absent from top-level filesModified.`
        );
      }
    }

    for (const criterion of task.acceptanceCriteria) {
      if (!isPhasePlanAcceptanceCriterionVerifiable(criterion)) {
        warnings.push(
          `Task ${task.id} acceptance criterion is not objectively verifiable: ${criterion}.`
        );
      }
    }
  }

  for (const filePath of declaredFiles) {
    const taskCoverage = model.tasks.filter((task) =>
      task.filesModified.some(
        (taskFilePath) => normalizePhasePlanModelSurface(taskFilePath) === filePath
      )
    );
    const surfaceRows = model.fileSurfaceCoverage.filter(
      (row) => normalizePhasePlanModelSurface(row.surface) === filePath
    );

    if (taskCoverage.length === 0) {
      issues.push(`Modified file ${filePath} is not covered by any task filesModified list.`);
    }

    if (surfaceRows.length === 0) {
      issues.push(`Modified file ${filePath} is missing from fileSurfaceCoverage.`);
    }
  }

  for (const row of model.fileSurfaceCoverage) {
    const normalizedSurface = normalizePhasePlanModelSurface(row.surface);

    if (!declaredFileSet.has(normalizedSurface)) {
      issues.push(
        `File surface coverage for ${normalizedSurface} does not match any top-level filesModified entry.`
      );
    }

    for (const taskId of row.coveredByTasks) {
      const task = model.tasks.find((candidate) => candidate.id === taskId);

      if (!task) {
        issues.push(
          `File surface coverage for ${normalizedSurface} references unknown task id "${taskId}".`
        );
        continue;
      }

      if (
        !task.filesModified.some(
          (taskFilePath) => normalizePhasePlanModelSurface(taskFilePath) === normalizedSurface
        )
      ) {
        issues.push(
          `File surface coverage for ${normalizedSurface} references task "${taskId}", but that task does not modify the surface.`
        );
      }
    }

    if (!isPhasePlanAcceptanceCriterionVerifiable(row.verification)) {
      warnings.push(
        `File surface coverage for ${normalizedSurface} has unverifiable verification: ${row.verification}.`
      );
    }
  }

  for (const verification of model.verification) {
    if (!isPhasePlanAcceptanceCriterionVerifiable(verification.evidence)) {
      warnings.push(
        `Verification item "${verification.item}" has evidence that is not objectively verifiable: ${verification.evidence}.`
      );
    }
  }

  for (const row of model.unknownsAndDeferrals) {
    if (
      row.disposition === "none" &&
      (/^(?:none|n\/a|na|not applicable)$/i.test(row.item.trim()) ||
        /^(?:none|n\/a|na|not applicable)$/i.test(row.followUp.trim()))
    ) {
      issues.push(
        "Unknowns and deferrals rows with disposition none must still use concrete item and follow-up text instead of generic none values."
      );
    }
  }

  return { issues, warnings };
}

function findPhasePlanTaskIndex(model: PhasePlanStructuredModel, taskId: string): number {
  return model.tasks.findIndex((task) => task.id === taskId);
}

function findPhasePlanRequirementCoverageIndex(
  model: PhasePlanStructuredModel,
  requirementId: string
): number {
  return model.requirementCoverage.findIndex((row) => row.requirement === requirementId);
}

function findPhasePlanFileSurfaceCoverageIndex(
  model: PhasePlanStructuredModel,
  surface: string
): number {
  const normalizedSurface = normalizePhasePlanModelSurface(surface);

  return model.fileSurfaceCoverage.findIndex(
    (row) => normalizePhasePlanModelSurface(row.surface) === normalizedSurface
  );
}

function phasePlanCoverageDiagnosticFromIssue(
  issue: string,
  model: PhasePlanStructuredModel
): PhasePlanModelDiagnostic {
  const taskCriterionMatch = issue.match(
    /^Task (.+?) acceptance criterion is not objectively verifiable: (.+)\.$/
  );
  if (taskCriterionMatch) {
    const taskId = taskCriterionMatch[1] ?? "";
    const criterion = taskCriterionMatch[2] ?? "";
    const taskIndex = findPhasePlanTaskIndex(model, taskId);
    const criterionIndex =
      taskIndex >= 0
        ? model.tasks[taskIndex].acceptanceCriteria.findIndex((item) => item === criterion)
        : -1;
    const pathValue =
      taskIndex >= 0 && criterionIndex >= 0
        ? `model.tasks[${taskIndex}].acceptanceCriteria[${criterionIndex}]`
        : "model.tasks";

    return phasePlanDiagnostic({
      severity: "warning",
      source: "residual",
      path: pathValue,
      code: "coverage.unverifiable_acceptance_criterion",
      message: issue,
      context: { taskId, criterion },
      actual: criterion,
      expected:
        "A grep, test, command, file-read, or artifact-validation-verifiable acceptance criterion.",
      repairAction: "make-verifiable",
      patchHint:
        taskIndex >= 0 && criterionIndex >= 0
          ? {
              op: "replace",
              path: modelPathToJsonPointer(pathValue) ?? "",
              value: "npm test -- tests/<focused-test>.test.ts exits 0"
            }
          : undefined,
      suggestion:
        "Replace the vague acceptance criterion with an objective command, file-read, grep, test, or artifact-validation check."
    });
  }

  const missingSurfaceMatch = issue.match(
    /^Modified file (.+) is missing from fileSurfaceCoverage\.$/
  );
  if (missingSurfaceMatch) {
    const surface = missingSurfaceMatch[1] ?? "";
    const coveringTask = model.tasks.find((task) =>
      task.filesModified.some(
        (filePath) => normalizePhasePlanModelSurface(filePath) === surface
      )
    );

    return phasePlanDiagnostic({
      source: "residual",
      path: "model.fileSurfaceCoverage",
      code: "coverage.missing_file_surface",
      message: issue,
      context: { surface, suggestedTaskId: coveringTask?.id ?? null },
      actual: model.fileSurfaceCoverage.map((row) => row.surface),
      expected: surface,
      repairAction: "add",
      patchHint: {
        op: "add",
        path: "/fileSurfaceCoverage/-",
        value: {
          surface,
          coveredByTasks: coveringTask ? [coveringTask.id] : [],
          verification: `file-read ${surface}`,
          rationale: "This row proves the declared modified surface is owned and verifiable."
        }
      },
      suggestion:
        "Add exactly one fileSurfaceCoverage row for the modified file and point it at a task that modifies that file."
    });
  }

  const topLevelRequirementStatusMatch = issue.match(
    /^Top-level requirement (.+) must have covered status in requirementCoverage\.$/
  );
  if (topLevelRequirementStatusMatch) {
    const requirementId = topLevelRequirementStatusMatch[1] ?? "";
    const coverageIndex = findPhasePlanRequirementCoverageIndex(model, requirementId);
    const pathValue =
      coverageIndex >= 0
        ? `model.requirementCoverage[${coverageIndex}].status`
        : "model.requirementCoverage";

    return phasePlanDiagnostic({
      source: "residual",
      path: pathValue,
      code: "coverage.top_level_requirement_not_covered",
      message: issue,
      context: { requirementId },
      actual: coverageIndex >= 0 ? model.requirementCoverage[coverageIndex].status : undefined,
      expected:
        "Top-level requirements may include only requirements this plan covers now; deferred or irrelevant requirements belong only in requirementCoverage.",
      repairAction: "remove",
      suggestion:
        `Remove ${requirementId} from top-level requirements, or change its requirementCoverage row to covered and attach concrete coveredByTasks.`
    });
  }

  const coverageTaskRequirementMismatch = issue.match(
    /^Requirement coverage for (.+) references task "(.+)", but that task does not list the requirement\.$/
  );
  if (coverageTaskRequirementMismatch) {
    const requirementId = coverageTaskRequirementMismatch[1] ?? "";
    const taskId = coverageTaskRequirementMismatch[2] ?? "";
    const taskIndex = findPhasePlanTaskIndex(model, taskId);
    const pathValue = taskIndex >= 0 ? `model.tasks[${taskIndex}].requirements` : "model.tasks";

    return phasePlanDiagnostic({
      source: "residual",
      path: pathValue,
      code: "coverage.task_requirement_mismatch",
      message: issue,
      context: { requirementId, taskId },
      actual: taskIndex >= 0 ? model.tasks[taskIndex].requirements : undefined,
      expected: requirementId,
      repairAction: "add",
      suggestion:
        `Add ${requirementId} to task ${taskId}.requirements, or remove ${taskId} from that requirementCoverage row.`
    });
  }

  const fileSurfaceVerificationMatch = issue.match(
    /^File surface coverage for (.+) has unverifiable verification: (.+)\.$/
  );
  if (fileSurfaceVerificationMatch) {
    const surface = fileSurfaceVerificationMatch[1] ?? "";
    const verification = fileSurfaceVerificationMatch[2] ?? "";
    const rowIndex = findPhasePlanFileSurfaceCoverageIndex(model, surface);
    const pathValue =
      rowIndex >= 0 ? `model.fileSurfaceCoverage[${rowIndex}].verification` : "model.fileSurfaceCoverage";

    return phasePlanDiagnostic({
      severity: "warning",
      source: "residual",
      path: pathValue,
      code: "coverage.unverifiable_file_surface",
      message: issue,
      context: { surface, verification },
      actual: verification,
      expected: "A command, grep, file-read, test, or artifact-validation check.",
      repairAction: "make-verifiable",
      suggestion:
        "Replace the file surface verification with an objective check such as a focused test command or file-read assertion."
    });
  }

  const verificationEvidenceMatch = issue.match(
    /^Verification item "(.+)" has evidence that is not objectively verifiable: (.+)\.$/
  );
  if (verificationEvidenceMatch) {
    const item = verificationEvidenceMatch[1] ?? "";
    const evidence = verificationEvidenceMatch[2] ?? "";
    const rowIndex = model.verification.findIndex((row) => row.item === item);
    const pathValue =
      rowIndex >= 0 ? `model.verification[${rowIndex}].evidence` : "model.verification";

    return phasePlanDiagnostic({
      severity: "warning",
      source: "residual",
      path: pathValue,
      code: "coverage.unverifiable_verification_evidence",
      message: issue,
      context: { item, evidence },
      actual: evidence,
      expected: "A command, grep, file-read, test, or artifact-validation check.",
      repairAction: "make-verifiable",
      suggestion:
        "Prefer evidence grounded in a concrete command, grep, file-read, test, or artifact-validation check when the plan can name one."
    });
  }

  return phasePlanDiagnostic({
    source: "residual",
    path: "model",
    code: "coverage.invalid",
    message: issue,
    context: {},
    repairAction: "replace",
    suggestion:
      "Repair the cross-field requirement, task, file, verification, or deferral coverage named in the diagnostic."
  });
}

function normalizeSpecBoundaryComparisonValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMarkdownSubsection(markdown: string, heading: string): string {
  const expectedHeading = normalizeSpecBoundaryComparisonValue(heading);
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let startIndex = -1;
  let startLevel = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{2,6})\s+(.+?)\s*#*\s*$/);

    if (match && normalizeSpecBoundaryComparisonValue(match[2] ?? "") === expectedHeading) {
      startIndex = index + 1;
      startLevel = match[1].length;
      break;
    }
  }

  if (startIndex < 0) {
    return "";
  }

  let endIndex = lines.length;

  for (let index = startIndex; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{2,6})\s+/);

    if (match && match[1].length <= startLevel) {
      endIndex = index;
      break;
    }
  }

  return lines.slice(startIndex, endIndex).join("\n").trim();
}

function extractBoldLabelSection(markdown: string, label: string): string {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(
    new RegExp(
      `(?:^|\\n)\\*\\*${escapedLabel}:\\*\\*\\s*\\n([\\s\\S]*?)(?=\\n\\*\\*[^\\n]+:\\*\\*|\\n#{2,6}\\s+|$)`,
      "i"
    )
  );

  return match?.[1]?.trim() ?? "";
}

function extractPhaseSpecOutOfScopeItems(specContent: string): string[] {
  const boundariesSection = extractMarkdownSection(specContent, "Boundaries");
  const boundedContent = boundariesSection || specContent;
  const subsection =
    extractMarkdownSubsection(boundedContent, "Out of scope") ||
    extractBoldLabelSection(boundedContent, "Out of scope");

  return subsection ? uniqueSortedStrings(sectionToList(subsection)) : [];
}

type PhasePlanSpecBoundarySignal = {
  display: string;
  normalized: string;
  sourceItem: string;
};

type PhasePlanComparableString = {
  path: string;
  value: string;
  normalized: string;
};

function buildPhasePlanSpecBoundarySignals(items: string[]): PhasePlanSpecBoundarySignal[] {
  const signals = new Map<string, PhasePlanSpecBoundarySignal>();

  const addSignal = (candidate: string, sourceItem: string): void => {
    const display = candidate.trim();
    const normalized = normalizeSpecBoundaryComparisonValue(display);

    if (!normalized) {
      return;
    }

    const wordCount = normalized.split(" ").filter((word) => word.length > 0).length;
    const isPreciseToken =
      /\/blu-[a-z0-9-]+/i.test(display) ||
      /(?:^|\/)[^/\s]+\.(?:md|ts|tsx|js|jsx|mjs|json|toml)$/i.test(display);

    if (!isPreciseToken && (wordCount < 4 || normalized.length < 20)) {
      return;
    }

    if (!signals.has(normalized)) {
      signals.set(normalized, {
        display,
        normalized,
        sourceItem
      });
    }
  };

  for (const item of items) {
    const trimmed = item.trim();

    if (!trimmed) {
      continue;
    }

    addSignal(trimmed.split(/\s[-–—]\s/, 1)[0] ?? trimmed, trimmed);

    for (const match of trimmed.matchAll(
      /(?:^|[\s`(])((?:\/blu-[a-z0-9-]+)|(?:\.?[\w./-]+?\.(?:md|ts|tsx|js|jsx|mjs|json|toml)))/gi
    )) {
      addSignal(match[1] ?? "", trimmed);
    }
  }

  return [...signals.values()];
}

function collectPhasePlanComparableStrings(
  model: PhasePlanStructuredModel
): PhasePlanComparableString[] {
  const strings: PhasePlanComparableString[] = [];
  const push = (pathValue: string, value: string | undefined): void => {
    if (typeof value !== "string") {
      return;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return;
    }

    strings.push({
      path: pathValue,
      value: trimmed,
      normalized: normalizeSpecBoundaryComparisonValue(trimmed)
    });
  };

  push("model.title", model.title);
  push("model.objective", model.objective);
  push("model.goal", model.goal);
  model.scope.forEach((value, index) => push(`model.scope[${index}]`, value));
  model.filesModified.forEach((value, index) => push(`model.filesModified[${index}]`, value));
  model.readFirst.forEach((value, index) => push(`model.readFirst[${index}]`, value));
  model.mustHaves.forEach((value, index) => push(`model.mustHaves[${index}]`, value));
  model.tasks.forEach((task, taskIndex) => {
    push(`model.tasks[${taskIndex}].title`, task.title);
    task.readFirst.forEach((value, index) =>
      push(`model.tasks[${taskIndex}].readFirst[${index}]`, value)
    );
    task.action.forEach((value, index) =>
      push(`model.tasks[${taskIndex}].action[${index}]`, value)
    );
    task.acceptanceCriteria.forEach((value, index) =>
      push(`model.tasks[${taskIndex}].acceptanceCriteria[${index}]`, value)
    );
    task.filesModified.forEach((value, index) =>
      push(`model.tasks[${taskIndex}].filesModified[${index}]`, value)
    );
  });
  model.verification.forEach((row, index) => {
    push(`model.verification[${index}].item`, row.item);
    push(`model.verification[${index}].evidence`, row.evidence);
  });
  model.evidenceCoverage.forEach((row, index) => {
    push(`model.evidenceCoverage[${index}].artifact`, row.artifact);
    push(`model.evidenceCoverage[${index}].rationale`, row.rationale);
  });
  model.fileSurfaceCoverage.forEach((row, index) => {
    push(`model.fileSurfaceCoverage[${index}].surface`, row.surface);
    push(`model.fileSurfaceCoverage[${index}].verification`, row.verification);
    push(`model.fileSurfaceCoverage[${index}].rationale`, row.rationale);
  });
  model.unknownsAndDeferrals.forEach((row, index) => {
    push(`model.unknownsAndDeferrals[${index}].item`, row.item);
    push(`model.unknownsAndDeferrals[${index}].rationale`, row.rationale);
    push(`model.unknownsAndDeferrals[${index}].followUp`, row.followUp);
  });

  return strings;
}

function phasePlanSpecBoundaryDiagnostics(args: {
  model: PhasePlanStructuredModel;
  specContent: string;
  specPath: string;
}): PhasePlanModelDiagnostic[] {
  const signals = buildPhasePlanSpecBoundarySignals(
    extractPhaseSpecOutOfScopeItems(args.specContent)
  );

  if (signals.length === 0) {
    return [];
  }

  const diagnostics: PhasePlanModelDiagnostic[] = [];
  const seen = new Set<string>();
  const comparableStrings = collectPhasePlanComparableStrings(args.model);

  for (const candidate of comparableStrings) {
    for (const signal of signals) {
      if (!candidate.normalized.includes(signal.normalized)) {
        continue;
      }

      const key = `${candidate.path}:${signal.normalized}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      diagnostics.push(
        phasePlanDiagnostic({
          source: "scope",
          path: candidate.path,
          code: "scope.spec_out_of_scope_conflict",
          message:
            `Saved phase spec ${args.specPath} marks "${signal.sourceItem}" as out of scope, ` +
            `but ${candidate.path} includes "${candidate.value}".`,
          context: {
            specPath: args.specPath,
            outOfScope: signal.sourceItem,
            modelValue: candidate.value
          },
          actual: candidate.value,
          expected: `Avoid planned work that conflicts with saved out-of-scope spec boundary: ${signal.display}`,
          repairAction: "replace",
          suggestion:
            "Remove or defer the conflicting plan item, or update the saved XX-SPEC.md boundary before authoring the phase plan."
        })
      );

      if (diagnostics.length >= 5) {
        return diagnostics;
      }
    }
  }

  return diagnostics;
}

async function validatePhasePlanModelAgainstSavedSpec(args: {
  projectRoot: string;
  resolved: ResolvedPhaseLocation;
  model: PhasePlanStructuredModel;
}): Promise<PhasePlanModelDiagnostic[]> {
  const specPath = artifactPathFor(args.resolved, "spec");
  const specContent = await readMarkdownDocument(args.projectRoot, specPath);

  if (!specContent) {
    return [];
  }

  return phasePlanSpecBoundaryDiagnostics({
    model: args.model,
    specContent,
    specPath
  });
}

function phasePlanPreflightDiagnosticFromIssue(issue: string): PhasePlanModelDiagnostic {
  const dependencyRelated =
    issue.startsWith("Plan dependency cycle detected:") ||
    issue.includes("depends_on references missing plan") ||
    issue.includes(" must come after dependency ");

  return phasePlanDiagnostic({
    source: "residual",
    path: dependencyRelated ? "model.dependsOn" : "model",
    code: "plan_set.invalid",
    message: issue,
    context: { stage: "prospective-plan-set-preflight" },
    repairAction: "replace",
    suggestion: dependencyRelated
      ? "Repair model.dependsOn so the rendered preview fits the saved plan set without missing dependencies, cycles, or invalid wave ordering."
      : "Repair the structured model so its rendered preview remains coherent with the saved phase plan set before writing."
  });
}

async function validatePhasePlanModelWithContext(args: {
  model: unknown;
  context: Awaited<ReturnType<typeof resolvePhasePlanAuthoringContextData>>;
}): Promise<PhasePlanValidateModelResult> {
  const diagnostics: PhasePlanModelDiagnostic[] = phasePlanAuthoringContextBlockers(
    args.context
  ).map((message) =>
    phasePlanDiagnostic({
      source: "scope",
      path: "phase.requirements",
      code: "scope.missing_requirements",
      message,
      context: { phase: args.context.resolved.phaseNumber },
      suggestion:
        "Add roadmap requirements for the selected phase before authoring a phase.plan model."
    })
  );
  const modelObject = asJsonObject(args.model);

  if (!modelObject) {
    diagnostics.push(
      phasePlanDiagnostic({
        source: "schema",
        path: "model",
        code: "schema.type",
        message: "Phase plan model must be a JSON object.",
        context: { receivedType: Array.isArray(args.model) ? "array" : typeof args.model },
        suggestion: "Return a JSON object that matches taskSchema."
      })
    );
  }

  let normalizedModel: PhasePlanStructuredModel | null = null;

  if (modelObject) {
    const validate = createAjvValidator().compile(args.context.taskSchema);
    const schemaValid = validate(modelObject);
    const schemaErrors = (validate.errors ?? []).filter(
      (error) => !isExactCoverageConstFallout(error)
    );
    if (!schemaValid) {
      diagnostics.push(
        ...schemaErrors.map((error) =>
          schemaDiagnosticFromPhasePlanAjvError(error, args.context.taskSchema, args.model)
        )
      );
    }

    diagnostics.push(...phasePlanModelResidualDiagnostics(modelObject));

    for (const issue of await validatePhasePlanModelCommands(modelObject)) {
      diagnostics.push(
        phasePlanDiagnostic({
          source: "residual",
          path: "model",
          code: "content.non_implemented_command",
          message: issue,
          context: {},
          suggestion: "Use only implemented Blueprint command references, or route to /blu-progress."
        })
      );
    }

    if (!schemaValid) {
      diagnostics.push(
        phasePlanDiagnostic({
          severity: "warning",
          source: "schema",
          path: "model",
          code: "schema.deeper_checks_skipped",
          message:
            "Schema validation failed, so cross-field coverage checks and rendered Markdown validation were skipped for this attempt.",
          context: {},
          suggestion:
            "Repair the schema diagnostics first, then retry validation to run the deeper coverage and render checks."
        })
      );
    }

    if (schemaValid) {
      normalizedModel = modelObject as PhasePlanStructuredModel;
      const coverage = validatePhasePlanStructuredModelCoverage(normalizedModel);

      for (const issue of coverage.issues) {
        diagnostics.push(phasePlanCoverageDiagnosticFromIssue(issue, normalizedModel));
      }

      for (const warning of coverage.warnings) {
        diagnostics.push(phasePlanCoverageDiagnosticFromIssue(warning, normalizedModel));
      }

      diagnostics.push(
        ...(await validatePhasePlanModelAgainstSavedSpec({
          projectRoot: args.context.projectRoot,
          resolved: args.context.resolved,
          model: normalizedModel
        }))
      );
    }
  }

  let renderPreview: string | null = null;

  if (!diagnostics.some(isBlockingPhasePlanDiagnostic) && normalizedModel) {
    const rendered = renderPhasePlanModelContent(
      normalizedModel,
      args.context.resolved,
      args.context.planId
    );
    const validation = validatePlanArtifactContent(rendered, args.context.resolved.phaseNumber, {
      strict: true
    });
    const markdownDiagnostics = [
      ...validation.issues.map(phasePlanMarkdownDiagnosticFromIssue),
      ...validation.warnings.map(phasePlanMarkdownDiagnosticFromIssue)
    ];
    diagnostics.push(...markdownDiagnostics);

    if (!markdownDiagnostics.some(isBlockingPhasePlanDiagnostic)) {
      renderPreview = rendered;
    }
  }

  const blockingDiagnostics = diagnostics.filter(isBlockingPhasePlanDiagnostic);

  return {
    status: blockingDiagnostics.length === 0 ? "valid" : "invalid",
    valid: blockingDiagnostics.length === 0,
    target: phasePlanValidateModelTarget({
      phase: args.context.resolved,
      planId: args.context.planId,
      path: args.context.pathValue,
      schemaPath: args.context.schemaPath
    }),
    repairBudget: {
      maxAttempts: 2,
      recommendedStrategy: "repair-all-diagnostics-before-retry"
    },
    repairSummary: summarizePhasePlanRepairs(diagnostics),
    phase: args.context.resolved,
    planId: args.context.planId,
    path: args.context.pathValue,
    schemaPath: args.context.schemaPath,
    taskSchema: args.context.taskSchema,
    diagnostics,
    diagnosticCounts: countPhasePlanDiagnostics(diagnostics),
    normalizedModel: diagnostics.some(
      (diagnostic) => diagnostic.source === "schema" && isBlockingPhasePlanDiagnostic(diagnostic)
    )
      ? null
      : normalizedModel,
    renderPreview,
    warnings: []
  };
}

async function phasePlanModelToContent(
  model: unknown,
  context: Awaited<ReturnType<typeof resolvePhasePlanAuthoringContextData>>
): Promise<{
  content: string | null;
  issues: string[];
  warnings: string[];
  validation: PhasePlanValidateModelResult;
}> {
  const validation = await validatePhasePlanModelWithContext({ model, context });
  const partitionedDiagnostics = partitionPhasePlanDiagnostics(validation.diagnostics);

  return {
    content: validation.renderPreview,
    issues: partitionedDiagnostics.blocking.map(formatPhasePlanDiagnostic),
    warnings: [
      ...validation.warnings,
      ...partitionedDiagnostics.warnings.map(formatPhasePlanDiagnostic)
    ],
    validation
  };
}

function trimPhasePlanWriteModelValidation(
  validation: PhasePlanValidateModelResult
): PhasePlanWriteModelValidationResult {
  const {
    taskSchema: _taskSchema,
    normalizedModel: _normalizedModel,
    renderPreview: _renderPreview,
    ...trimmed
  } = validation;

  return trimmed;
}

function trimPhasePlanStandaloneValidateModelResult(
  validation: PhasePlanValidateModelResult
): PhasePlanStandaloneValidateModelResult {
  const {
    taskSchema: _taskSchema,
    normalizedModel: _normalizedModel,
    renderPreview: _renderPreview,
    ...trimmed
  } = validation;

  return trimmed;
}

function trimPhaseSummaryStandaloneValidateModelResult(
  validation: PhaseSummaryValidateModelResult
): PhaseSummaryStandaloneValidateModelResult {
  const {
    taskSchema: _taskSchema,
    normalizedModel: _normalizedModel,
    renderPreview: _renderPreview,
    ...trimmed
  } = validation;

  return trimmed;
}

const phaseValidationToolDeps: PhaseValidationToolRuntimeDependencies = {
  readSummaryIndex: (args) => blueprintPhaseSummaryIndex(args),
  syncRoadmapPhaseCompletion
};

export async function blueprintPhaseValidationAuthoringContext(
  args: PhaseValidationAuthoringContextArgs
): Promise<PhaseValidationAuthoringContextResult> {
  return blueprintPhaseValidationAuthoringContextImpl(args, phaseValidationToolDeps);
}

export async function blueprintPhaseValidationValidateModel(
  args: PhaseValidationValidateModelArgs
): Promise<PhaseValidationValidateModelResult> {
  return blueprintPhaseValidationValidateModelImpl(args, phaseValidationToolDeps);
}

export async function blueprintPhaseValidationRender(
  args: PhaseValidationRenderArgs
): Promise<PhaseValidationRenderResult> {
  return blueprintPhaseValidationRenderImpl(args, phaseValidationToolDeps);
}

export async function blueprintRoadmapRead(
  args: RoadmapReadArgs = {}
): Promise<RoadmapReadResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  let roadmap;

  try {
    roadmap = await readRoadmap(projectRoot);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    return {
      roadmap: {
        path: `${BLUEPRINT_DIR}/ROADMAP.md`,
        phaseCount: 0
      },
      milestone: null,
      warnings: [reason],
      recovery: buildLocateRecovery(reason),
      phases: []
    };
  }
  const phases = await Promise.all(
    roadmap.phases.map(async (phase) => {
      const locatedPhaseDir = await findPhaseDirectory(projectRoot, phase.phaseNumber);

      return {
        ...phase,
        phaseDir: locatedPhaseDir.phaseDir
      };
    })
  );

  return {
    roadmap: {
      path: roadmap.path,
      phaseCount: phases.length
    },
    milestone: roadmap.milestone,
    warnings: [],
    recovery: [],
    phases
  };
}

export async function blueprintRoadmapAddPhase(
  args: RoadmapAddPhaseArgs
): Promise<RoadmapAddPhaseResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const normalizedDescription = normalizePhaseDescription(args.description);
  const normalizedRepairRequirementIds = normalizeRoadmapDetailList(
    args.auditBackedDetails?.repairRequirementIds
  );
  const normalizedRequirementIds = normalizeRoadmapDetailList(args.requirementIds);
  const effectiveRequirementIds =
    normalizedRepairRequirementIds.length > 0
      ? normalizedRepairRequirementIds
      : normalizedRequirementIds;
  const effectiveGoal = normalizeRoadmapGoal(args.auditBackedDetails?.goal ?? args.goal);
  const effectiveSuccessCriteria = args.auditBackedDetails
    ? normalizeRoadmapSuccessCriteriaString(args.auditBackedDetails.successCriteria)
    : normalizeRoadmapSuccessCriteriaList(args.successCriteria);
  const auditBackedDetails = args.auditBackedDetails
    ? {
        ...args.auditBackedDetails,
        goal: effectiveGoal,
        successCriteria: effectiveSuccessCriteria.join("; "),
        repairRequirementIds:
          normalizedRepairRequirementIds.length > 0
            ? normalizedRepairRequirementIds
            : args.auditBackedDetails.repairRequirementIds
      }
    : null;

  if (normalizedDescription.length === 0) {
    throw new Error(
      "Phase description required. Re-run /blu-add-phase with a concise description."
    );
  }

  if (effectiveRequirementIds.length === 0) {
    throw new Error(
      "Requirement IDs required. Re-run /blu-add-phase with at least one durable requirement ID from ROADMAP/REQUIREMENTS in requirementIds."
    );
  }

  requireRoadmapPhaseMetadata({
    command: "/blu-add-phase",
    goal: effectiveGoal,
    successCriteria: effectiveSuccessCriteria
  });

  return withBlueprintRepoLock(projectRoot, PHASE_TOPOLOGY_LOCK_NAME, async () => {
    const roadmap = await readRoadmap(projectRoot);
    const existingAuditBackedPhase = findMatchingAuditBackedPhase(
      roadmap.phases,
      normalizedDescription,
      auditBackedDetails
    );
    const phaseNumber = computeNextWholePhaseNumber(roadmap.phases);

    if (
      !existingAuditBackedPhase &&
      args.expectedPhaseNumber &&
      normalizePhaseNumber(args.expectedPhaseNumber) !== phaseNumber
    ) {
      throw new Error(
        `Confirmed next phase ${normalizePhaseNumber(args.expectedPhaseNumber)} no longer matches the live next phase ${phaseNumber}. Re-run /blu-add-phase after re-reading the roadmap.`
      );
    }

    requireConfirmedRoadmapMutation({
      command: "/blu-add-phase",
      confirmed: args.confirmed,
      gate: "phase-number-confirmation",
      mutation: existingAuditBackedPhase
        ? `reusing audit-backed Phase ${existingAuditBackedPhase.phaseNumber}`
        : `creating Phase ${phaseNumber}`
    });

    if (
      existingAuditBackedPhase &&
      (!args.expectedPhaseNumber ||
        normalizePhaseNumber(args.expectedPhaseNumber) === existingAuditBackedPhase.phaseNumber)
    ) {
      return reuseAuditBackedPhase(
        projectRoot,
        roadmap,
        existingAuditBackedPhase,
        auditBackedDetails as RoadmapAuditBackedDetails
      );
    }

    if (
      args.expectedPhaseNumber &&
      normalizePhaseNumber(args.expectedPhaseNumber) !== phaseNumber
    ) {
      throw new Error(
        `Confirmed next phase ${normalizePhaseNumber(args.expectedPhaseNumber)} no longer matches the live next phase ${phaseNumber}. Re-run /blu-add-phase after re-reading the roadmap.`
      );
    }

    if (normalizedRepairRequirementIds.length === 0) {
      await requireDeclaredRequirementIds(projectRoot, effectiveRequirementIds, {
        missingFileMessage: `Cannot add Phase ${phaseNumber} because ${BLUEPRINT_DIR}/REQUIREMENTS.md is missing.`,
        malformedMessage: `Cannot add Phase ${phaseNumber} because ${BLUEPRINT_DIR}/REQUIREMENTS.md is missing a usable "## Requirements Table" section.`,
        undeclaredMessage: (undeclaredRequirementIds) =>
          `Cannot add Phase ${phaseNumber} because requirement IDs are not declared in ${BLUEPRINT_DIR}/REQUIREMENTS.md Requirements Table: ${undeclaredRequirementIds.join(", ")}`
      });
    }

    const phasePrefix = formatPhasePrefix(phaseNumber);
    const slug = slugifyPhaseName(normalizedDescription);
    const phaseDir = buildBlueprintPhaseDirectoryPath(phaseNumber, normalizedDescription);
    const roadmapPath = resolveBlueprintPath(projectRoot, roadmap.path);
    const rawRoadmap = await fs.readFile(roadmapPath, "utf8");
    const requirementRepair = auditBackedDetails?.repairRequirementIds?.length
      ? await repairRequirementsTraceability(
          projectRoot,
          auditBackedDetails.repairRequirementIds,
          phaseNumber,
          normalizedDescription,
          auditBackedDetails.sourceReportPath
        )
      : null;
    const dependsOnPhaseNumber = previousIntegerPhaseNumber(phaseNumber);
    const updatedRoadmap = auditBackedDetails
      ? appendPhaseDetailsToRoadmap(
          appendPhaseLineToRoadmap(
            rawRoadmap,
            phaseNumber,
            normalizedDescription,
            {
              requirementIds: effectiveRequirementIds,
              goal: effectiveGoal,
              successCriteria: effectiveSuccessCriteria
            }
          ),
          phaseNumber,
          normalizedDescription,
          {
            dependsOnPhaseNumber,
            goal: effectiveGoal,
            requirements: effectiveRequirementIds,
            successCriteria: effectiveSuccessCriteria.join("; "),
            auditBackedDetails
          }
        )
      : appendPhaseLineToRoadmap(
          rawRoadmap,
          phaseNumber,
          normalizedDescription,
          {
            requirementIds: effectiveRequirementIds,
            goal: effectiveGoal,
            successCriteria: effectiveSuccessCriteria
          }
        );
    const warnings: string[] = [];
    const preparedRoadmap = prepareTextForPersistence(updatedRoadmap, {
      label: roadmap.path
    });
    const requirementsPath = `${BLUEPRINT_DIR}/REQUIREMENTS.md`;
    const requirementsAbsolutePath = resolveBlueprintPath(projectRoot, requirementsPath);
    const preparedRequirements = requirementRepair
      ? prepareTextForPersistence(requirementRepair.content, {
          label: requirementsPath
        })
      : null;
    const originalRequirements = requirementRepair
      ? await fs.readFile(requirementsAbsolutePath, "utf8")
      : null;

    warnings.push(...preparedRoadmap.warnings);
    warnings.push(...(preparedRequirements?.warnings ?? []));
    const materializedPhaseDir = await materializePhaseDirectory(projectRoot, phaseDir);

    warnings.push(...materializedPhaseDir.warnings);

    try {
      if (requirementRepair) {
        warnings.push(...requirementRepair.warnings);
        warnings.push(
          ...await writeTextFile(
            requirementsAbsolutePath,
            preparedRequirements?.content ?? requirementRepair.content,
            {
              label: requirementsPath,
              enforcePromptBoundary: false
            }
          )
        );
      }

      warnings.push(
        ...await writeTextFile(roadmapPath, preparedRoadmap.content, {
          label: roadmap.path,
          enforcePromptBoundary: false
        })
      );
    } catch (error) {
      if (requirementRepair && originalRequirements !== null) {
        await writeTextFile(requirementsAbsolutePath, originalRequirements, {
          label: requirementsPath,
          enforcePromptBoundary: false
        }).catch(() => undefined);
      }

      if (materializedPhaseDir.created) {
        await fs.rm(materializedPhaseDir.phaseDirPath, {
          recursive: true,
          force: true
        }).catch(() => undefined);
      }

      throw error;
    }

    return {
      phaseNumber,
      phasePrefix,
      phaseName: normalizedDescription,
      slug,
      phaseDir,
      contextPath: buildArtifactPath(phaseDir, phasePrefix, "-CONTEXT.md"),
      roadmapPath: roadmap.path,
      milestone: roadmap.milestone,
      requirementValidationStatus:
        normalizedRepairRequirementIds.length > 0 ? "traceability-repaired" : "declared",
      createdPhaseDir: materializedPhaseDir.created,
      idempotencyStatus: "created",
      written: true,
      warnings
    };
  });
}

export async function blueprintRoadmapInsertPhase(
  args: RoadmapInsertPhaseArgs
): Promise<RoadmapInsertPhaseResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const normalizedDescription = normalizePhaseDescription(args.description);
  const normalizedRequirementIds = normalizeRoadmapDetailList(args.requirementIds);
  const effectiveGoal = normalizeRoadmapGoal(args.goal);
  const effectiveSuccessCriteria = normalizeRoadmapSuccessCriteriaList(args.successCriteria);

  if (normalizedDescription.length === 0) {
    throw new Error(
      "Phase description required. Re-run /blu-insert-phase with an integer phase number such as 3 and a concise description."
    );
  }

  const afterPhaseNumber = extractExactPhaseNumberToken(args.after ?? "");

  if (!afterPhaseNumber) {
    const afterInput = normalizeBlueprintInput(args.after ?? "").trim();

    if (afterInput.length === 0) {
      throw new Error(
        "Phase number required. Re-run /blu-insert-phase with an integer phase number such as 3."
      );
    }

    throw new Error(
      `Phase ${afterInput} is not a valid Blueprint integer phase number. Re-run /blu-insert-phase with an existing integer phase number such as 3.`
    );
  }

  if (!isIntegerPhaseNumber(afterPhaseNumber)) {
    throw new Error(
      `Phase ${afterPhaseNumber} cannot be used as an insertion target. Re-run /blu-insert-phase with an existing integer phase number such as ${basePhaseNumber(afterPhaseNumber)}.`
    );
  }

  if (normalizedRequirementIds.length === 0) {
    throw new Error(
      "Requirement IDs required. Re-run /blu-insert-phase with at least one durable requirement ID from REQUIREMENTS.md in requirementIds."
    );
  }

  requireRoadmapPhaseMetadata({
    command: "/blu-insert-phase",
    goal: effectiveGoal,
    successCriteria: effectiveSuccessCriteria
  });

  return withBlueprintRepoLock(projectRoot, PHASE_TOPOLOGY_LOCK_NAME, async () => {
    const roadmap = await readRoadmap(projectRoot);
    const targetPhase = roadmap.phases.find((phase) => phase.phaseNumber === afterPhaseNumber);

    if (!targetPhase) {
      throw new Error(
        `Phase ${afterPhaseNumber} does not exist in ${BLUEPRINT_DIR}/ROADMAP.md.`
      );
    }

    const targetPhaseDirectory = await findPhaseDirectory(projectRoot, afterPhaseNumber);

    if (!targetPhaseDirectory.phaseDir) {
      throw new Error(
        targetPhaseDirectory.reason === "ambiguous"
          ? `Phase ${afterPhaseNumber} has multiple matching directories under ${BLUEPRINT_PHASES_PATH}. Resolve the drift before inserting a decimal phase after it.`
          : `Phase ${afterPhaseNumber} is missing a matching directory under ${BLUEPRINT_PHASES_PATH}. Resolve the drift before inserting a decimal phase after it.`
      );
    }

    const phaseNumber = nextDecimalPhaseNumber(roadmap.phases, afterPhaseNumber);
    const phasePrefix = formatPhasePrefix(phaseNumber);
    const slug = slugifyPhaseName(normalizedDescription);
    const phaseDir = buildBlueprintPhaseDirectoryPath(phaseNumber, normalizedDescription);
    const existingDecimalDirectory = await findPhaseDirectory(projectRoot, phaseNumber);

    requireUnassignedRoadmapRequirements(roadmap, normalizedRequirementIds, phaseNumber);

    if (
      existingDecimalDirectory.reason === "ambiguous" ||
      (existingDecimalDirectory.phaseDir && existingDecimalDirectory.phaseDir !== phaseDir)
    ) {
      throw new Error(
        existingDecimalDirectory.reason === "ambiguous"
          ? `Phase ${phaseNumber} already has multiple matching directories under ${BLUEPRINT_PHASES_PATH}. Resolve the drift before inserting it into the roadmap.`
          : `Phase ${phaseNumber} already has a conflicting directory under ${BLUEPRINT_PHASES_PATH}: ${existingDecimalDirectory.phaseDir}. Resolve the drift before inserting it into the roadmap.`
      );
    }

    requireConfirmedRoadmapMutation({
      command: "/blu-insert-phase",
      confirmed: args.confirmed,
      gate: "phase-insert-confirmation",
      mutation: `inserting Phase ${phaseNumber} after Phase ${afterPhaseNumber}`
    });

    const groupPhases = roadmap.phases.filter(
      (phase) => basePhaseNumber(phase.phaseNumber) === afterPhaseNumber
    );
    const insertionAnchor = groupPhases.at(-1)?.phaseNumber ?? afterPhaseNumber;
    const insertionAnchorIndex = roadmap.phases.findIndex(
      (phase) => phase.phaseNumber === insertionAnchor
    );

    if (insertionAnchorIndex === -1) {
      throw new Error(
        `Phase ${afterPhaseNumber} could not be located in the roadmap phases list.`
      );
    }

    const roadmapPath = resolveBlueprintPath(projectRoot, roadmap.path);
    const rawRoadmap = await fs.readFile(roadmapPath, "utf8");
    const insertedPhaseLines = insertPhaseLineToRoadmap(
      rawRoadmap,
      insertionAnchor,
      phaseNumber,
      normalizedDescription,
      {
        requirementIds: normalizedRequirementIds,
        goal: effectiveGoal,
        successCriteria: effectiveSuccessCriteria
      }
    );
    const updatedRoadmap = insertPhaseDetailsToRoadmap(
      insertedPhaseLines,
      groupPhases.map((phase) => phase.phaseNumber),
      phaseNumber,
      normalizedDescription,
      afterPhaseNumber,
      {
        requirements: normalizedRequirementIds,
        goal: effectiveGoal,
        successCriteria: effectiveSuccessCriteria.join("; ")
      }
    );
    const requirementMapping = await mapRequirementsToInsertedPhase(
      projectRoot,
      normalizedRequirementIds,
      phaseNumber,
      normalizedDescription
    );
    const preparedRoadmap = prepareTextForPersistence(updatedRoadmap, {
      label: roadmap.path
    });
    const requirementsPath = `${BLUEPRINT_DIR}/REQUIREMENTS.md`;
    const requirementsAbsolutePath = resolveBlueprintPath(projectRoot, requirementsPath);
    const preparedRequirements = prepareTextForPersistence(requirementMapping.content, {
      label: requirementsPath
    });
    const originalRequirements = await fs.readFile(requirementsAbsolutePath, "utf8");
    const warnings: string[] = [...preparedRoadmap.warnings];
    warnings.push(...preparedRequirements.warnings);
    const materializedPhaseDir = await materializePhaseDirectory(projectRoot, phaseDir);

    warnings.push(...materializedPhaseDir.warnings);

    try {
      warnings.push(...requirementMapping.warnings);
      warnings.push(
        ...await writeTextFile(requirementsAbsolutePath, preparedRequirements.content, {
          label: requirementsPath,
          enforcePromptBoundary: false
        })
      );
      warnings.push(
        ...await writeTextFile(roadmapPath, preparedRoadmap.content, {
          label: roadmap.path,
          enforcePromptBoundary: false
        })
      );
    } catch (error) {
      await writeTextFile(requirementsAbsolutePath, originalRequirements, {
        label: requirementsPath,
        enforcePromptBoundary: false
      }).catch(() => undefined);

      if (materializedPhaseDir.created) {
        await fs.rm(materializedPhaseDir.phaseDirPath, {
          recursive: true,
          force: true
        }).catch(() => undefined);
      }

      throw error;
    }

    return {
      afterPhaseNumber,
      phaseNumber,
      phasePrefix,
      phaseName: normalizedDescription,
      slug,
      phaseDir,
      contextPath: buildArtifactPath(phaseDir, phasePrefix, "-CONTEXT.md"),
      roadmapPath: roadmap.path,
      milestone: roadmap.milestone,
      requirementMappingStatus: requirementMapping.mappingStatus,
      createdPhaseDir: materializedPhaseDir.created,
      written: true,
      warnings
    };
  });
}

function renameLeadingPhaseToken(
  entryName: string,
  phaseNumber: string,
  replacementPrefix: string
): string | null {
  const match = entryName.match(/^(\d+(?:\.\d+)?)(.*)$/);

  if (!match || normalizePhaseNumber(match[1]) !== phaseNumber) {
    return null;
  }

  return `${replacementPrefix}${match[2]}`;
}

type PhaseTopologyMoveJournalEntry = {
  fromPath: string;
  toPath: string;
};

type PhaseArtifactRenamePlan = {
  fromPath: string;
  toPath: string;
  originalPath: string;
  originalDestinationPath: string;
  from: string;
  to: string;
};

async function assertExistingPhaseTopologyDirectory(
  directoryPath: string,
  repoRelativeDirectory: string
): Promise<void> {
  let stats;

  try {
    stats = await fs.stat(directoryPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ENOENT") {
      throw new Error(
        `Phase topology source directory is missing before mutation: ${repoRelativeDirectory}. Resolve the drift before mutating the roadmap.`
      );
    }

    throw error;
  }

  if (!stats.isDirectory()) {
    throw new Error(
      `Phase topology source path is not a directory before mutation: ${repoRelativeDirectory}. Resolve the drift before mutating the roadmap.`
    );
  }
}

async function assertPhaseTopologyDestinationAvailable(
  destinationPath: string,
  repoRelativeDestination: string
): Promise<void> {
  if (await pathExists(destinationPath)) {
    throw new Error(
      `Phase topology destination already exists before mutation: ${repoRelativeDestination}. Resolve the collision before mutating the roadmap.`
    );
  }
}

async function collectPhaseArtifactRenamePlans(options: {
  projectRoot: string;
  sourceRootPath: string;
  destinationRootPath: string;
  oldPhaseNumber: string;
  newPhasePrefix: string;
  sourceRelativePath?: string;
  executionRelativePath?: string;
}): Promise<PhaseArtifactRenamePlan[]> {
  const sourceRelativePath = options.sourceRelativePath ?? "";
  const executionRelativePath = options.executionRelativePath ?? "";
  const scanDirectoryPath = sourceRelativePath
    ? path.join(options.sourceRootPath, sourceRelativePath)
    : options.sourceRootPath;
  const entries = await fs.readdir(scanDirectoryPath, { withFileTypes: true });
  const plans: PhaseArtifactRenamePlan[] = [];

  for (const entry of entries) {
    const originalRelativePath = sourceRelativePath
      ? path.join(sourceRelativePath, entry.name)
      : entry.name;
    const executionFromRelativePath = executionRelativePath
      ? path.join(executionRelativePath, entry.name)
      : entry.name;
    const renamedEntry = renameLeadingPhaseToken(
      entry.name,
      options.oldPhaseNumber,
      options.newPhasePrefix
    );
    const executionToRelativePath = executionRelativePath
      ? path.join(executionRelativePath, renamedEntry ?? entry.name)
      : renamedEntry ?? entry.name;

    if (renamedEntry) {
      const fromPath = path.join(options.destinationRootPath, executionFromRelativePath);
      const toPath = path.join(options.destinationRootPath, executionToRelativePath);

      plans.push({
        fromPath,
        toPath,
        originalPath: path.join(options.sourceRootPath, originalRelativePath),
        originalDestinationPath: path.join(options.sourceRootPath, executionToRelativePath),
        from: toRepoRelativePath(options.projectRoot, fromPath),
        to: toRepoRelativePath(options.projectRoot, toPath)
      });
    }

    if (entry.isDirectory()) {
      plans.push(
        ...(await collectPhaseArtifactRenamePlans({
          ...options,
          sourceRelativePath: originalRelativePath,
          executionRelativePath: executionToRelativePath
        }))
      );
    }
  }

  return plans;
}

async function preflightPhaseArtifactRenamePlans(
  plans: PhaseArtifactRenamePlan[]
): Promise<void> {
  const destinationPaths = new Set<string>();

  for (const plan of plans) {
    const normalizedDestinationPath = path.resolve(plan.toPath);

    if (destinationPaths.has(normalizedDestinationPath)) {
      throw new Error(
        `Phase artifact rename plan has a duplicate destination before mutation: ${plan.to}.`
      );
    }

    destinationPaths.add(normalizedDestinationPath);

    if (
      path.resolve(plan.originalDestinationPath) !== path.resolve(plan.originalPath) &&
      (await pathExists(plan.originalDestinationPath))
    ) {
      throw new Error(
        `Phase artifact destination already exists before mutation: ${plan.to}. Resolve the collision before mutating the roadmap.`
      );
    }
  }
}

async function renameWithPhaseTopologyRollback(
  fromPath: string,
  toPath: string,
  journal: PhaseTopologyMoveJournalEntry[]
): Promise<void> {
  await fs.rename(fromPath, toPath);
  journal.push({ fromPath, toPath });
}

async function rollbackPhaseTopologyMoves(
  journal: PhaseTopologyMoveJournalEntry[]
): Promise<string[]> {
  const failures: string[] = [];

  for (const entry of [...journal].reverse()) {
    if (!(await pathExists(entry.toPath))) {
      continue;
    }

    if (await pathExists(entry.fromPath)) {
      failures.push(
        `Could not roll back ${entry.toPath} because ${entry.fromPath} already exists.`
      );
      continue;
    }

    const failureCountBeforeMkdir = failures.length;

    await fs.mkdir(path.dirname(entry.fromPath), { recursive: true }).catch((error) => {
      failures.push(
        `Could not recreate rollback parent ${path.dirname(entry.fromPath)}: ${error instanceof Error ? error.message : String(error)}`
      );
    });

    if (failures.length > failureCountBeforeMkdir) {
      continue;
    }

    try {
      await fs.rename(entry.toPath, entry.fromPath);
    } catch (error) {
      failures.push(
        `Could not roll back ${entry.toPath} to ${entry.fromPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return failures;
}

async function applyPhaseArtifactRenamePlans(
  plans: PhaseArtifactRenamePlan[],
  journal: PhaseTopologyMoveJournalEntry[]
): Promise<Array<{ from: string; to: string }>> {
  const renamedArtifacts: Array<{ from: string; to: string }> = [];

  for (const plan of plans) {
    await renameWithPhaseTopologyRollback(plan.fromPath, plan.toPath, journal);
    renamedArtifacts.push({
      from: plan.from,
      to: plan.to
    });
  }

  return renamedArtifacts;
}

async function renamePhaseArtifactsInPlace(
  projectRoot: string,
  rootDirectoryPath: string,
  oldPhaseNumber: string,
  newPhasePrefix: string
): Promise<Array<{ from: string; to: string }>> {
  const plans = await collectPhaseArtifactRenamePlans({
    projectRoot,
    sourceRootPath: rootDirectoryPath,
    destinationRootPath: rootDirectoryPath,
    oldPhaseNumber,
    newPhasePrefix
  });
  const journal: PhaseTopologyMoveJournalEntry[] = [];

  await preflightPhaseArtifactRenamePlans(plans);

  try {
    return await applyPhaseArtifactRenamePlans(plans, journal);
  } catch (error) {
    const rollbackFailures = await rollbackPhaseTopologyMoves(journal);

    if (rollbackFailures.length > 0) {
      throw new Error(
        [
          error instanceof Error ? error.message : String(error),
          "Rollback failures:",
          ...rollbackFailures
        ].join("\n")
      );
    }

    throw error;
  }
}

function findPhaseRenumberTargets(
  phases: ParsedRoadmapPhase[],
  targetPhaseNumber: string
): Array<{
  previousPhase: ParsedRoadmapPhase;
  newPhaseNumber: string;
}> {
  const targetIndex = phases.findIndex((phase) => phase.phaseNumber === targetPhaseNumber);

  if (targetIndex === -1) {
    throw new Error(
      `Phase ${targetPhaseNumber} does not exist in ${BLUEPRINT_DIR}/ROADMAP.md.`
    );
  }

  const [targetBase, targetDecimal] = targetPhaseNumber.split(".");
  const renumberTargets: Array<{
    previousPhase: ParsedRoadmapPhase;
    newPhaseNumber: string;
  }> = [];
  const isDecimalRemoval = targetDecimal !== undefined;

  for (let index = targetIndex + 1; index < phases.length; index += 1) {
    const candidatePhase = phases[index];

    if (!candidatePhase) {
      continue;
    }

    if (isDecimalRemoval) {
      const [candidateBase, candidateDecimal] = candidatePhase.phaseNumber.split(".");

      if (candidateBase !== targetBase || candidateDecimal === undefined) {
        break;
      }
    }

    renumberTargets.push({
      previousPhase: candidatePhase,
      newPhaseNumber:
        index === targetIndex + 1
          ? targetPhaseNumber
          : phases[index - 1]?.phaseNumber ?? targetPhaseNumber
    });
  }

  return renumberTargets;
}

function findWholePhaseDecimalChildren(
  phases: ParsedRoadmapPhase[],
  targetPhaseNumber: string
): ParsedRoadmapPhase[] {
  if (!isIntegerPhaseNumber(targetPhaseNumber)) {
    return [];
  }

  const targetIndex = phases.findIndex((phase) => phase.phaseNumber === targetPhaseNumber);

  if (targetIndex === -1) {
    return [];
  }

  return phases.slice(targetIndex + 1).filter((phase) => {
    const [phaseBase, phaseDecimal] = phase.phaseNumber.split(".");

    return phaseBase === targetPhaseNumber && phaseDecimal !== undefined;
  });
}

function phaseTopologyTransactionRootPath(
  projectRoot: string,
  operation: string,
  phaseNumber: string
): string {
  const safePhaseNumber = phaseNumber.replace(/[^0-9.]/g, "_");

  return resolveBlueprintPath(
    projectRoot,
    `${BLUEPRINT_DIR}/locks/${PHASE_TOPOLOGY_LOCK_NAME}-${operation}-${safePhaseNumber}-${process.pid}-${Date.now()}-${process.hrtime.bigint()}.txn`
  );
}

type PhaseDirectoryRenumberPlan = {
  previousPhase: ParsedRoadmapPhase;
  newPhaseNumber: string;
  newPhasePrefix: string;
  previousPhaseDir: string;
  newPhaseDir: string;
  previousPhaseDirPath: string;
  newPhaseDirPath: string;
  artifactRenamePlans: PhaseArtifactRenamePlan[];
};

export async function blueprintRoadmapRemovePhase(
  args: RoadmapRemovePhaseArgs
): Promise<RoadmapRemovePhaseResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const targetPhaseNumber = extractPhaseNumberToken(args.phase ?? "");

  if (!targetPhaseNumber) {
    throw new Error(
      "Phase number required. Re-run /blu-remove-phase with a phase number such as 7."
    );
  }

  return withBlueprintRepoLock(projectRoot, PHASE_TOPOLOGY_LOCK_NAME, async () => {
    const roadmap = await readRoadmap(projectRoot);
    const targetPhase = roadmap.phases.find((phase) => phase.phaseNumber === targetPhaseNumber);

    if (!targetPhase) {
      const recovery = buildRemovePhaseRecovery(targetPhaseNumber, roadmap);

      throw new Error(
        [`Phase ${targetPhaseNumber} does not exist in ${BLUEPRINT_DIR}/ROADMAP.md.`,
          "Recovery:",
          ...recovery.map((entry) => `- ${entry}`)
        ].join("\n")
      );
    }

    const currentState = await loadBlueprintState(projectRoot);
    const currentPhaseNumber = extractPhaseNumberToken(currentState.currentPhase);

    if (!currentPhaseNumber) {
      throw new Error(
        `Cannot validate future-phase removal because ${BLUEPRINT_DIR}/STATE.md does not contain a usable current phase.`
      );
    }

    if (comparePhaseNumbers(targetPhaseNumber, currentPhaseNumber) <= 0) {
      throw new Error(
        `Cannot remove Phase ${targetPhaseNumber}. Only future phases can be removed; current phase is ${currentPhaseNumber}.`
      );
    }

    const targetPhaseDirectory = await findPhaseDirectory(projectRoot, targetPhaseNumber);

    if (!targetPhaseDirectory.phaseDir) {
      throw new Error(
        targetPhaseDirectory.reason === "ambiguous"
          ? `Phase ${targetPhaseNumber} has multiple matching directories under ${BLUEPRINT_PHASES_PATH}. Resolve the drift before removing it.`
          : `Phase ${targetPhaseNumber} is missing a matching directory under ${BLUEPRINT_PHASES_PATH}. Resolve the drift before removing it.`
      );
    }

    const targetPhaseDirPath = resolveBlueprintPath(projectRoot, targetPhaseDirectory.phaseDir);
    await assertExistingPhaseTopologyDirectory(
      targetPhaseDirPath,
      targetPhaseDirectory.phaseDir
    );
    const removedArtifacts = await listPhaseArtifacts(targetPhaseDirPath, projectRoot);
    const executionArtifacts = removedArtifacts.filter(
      (artifactPath) =>
        /-SUMMARY\.md$/i.test(artifactPath) ||
        /-VERIFICATION\.md$/i.test(artifactPath) ||
        /-UAT\.md$/i.test(artifactPath)
    );

    const warnings: string[] = [];

    requireConfirmedRoadmapMutation({
      command: "/blu-remove-phase",
      confirmed: args.confirmed,
      gate: "remove-phase-confirmation",
      mutation: `removing Phase ${targetPhaseNumber}`
    });

    if (executionArtifacts.length > 0) {
      if (!args.force) {
        throw new Error(
          `Phase ${targetPhaseNumber} already has execution evidence (${executionArtifacts.join(", ")}). Re-run /blu-remove-phase with explicit force confirmation if you intend to remove it anyway.`
        );
      }

      warnings.push(
        `Phase ${targetPhaseNumber} was removed with execution evidence (${executionArtifacts.join(", ")}) because explicit force confirmation was provided.`
      );
    }

    const decimalChildPhases = findWholePhaseDecimalChildren(
      roadmap.phases,
      targetPhaseNumber
    );

    if (decimalChildPhases.length > 0) {
      throw new Error(
        [
          `Cannot remove whole Phase ${targetPhaseNumber} because it has decimal child phases: ${decimalChildPhases
            .map((phase) => phase.phaseNumber)
            .join(", ")}.`,
          "Whole-phase removal with decimal child phases is currently unsupported because it would corrupt later phase identity during renumbering.",
          "Remove or resolve the child phases first, then re-run /blu-remove-phase."
        ].join(" ")
      );
    }

    const renumberTargets = findPhaseRenumberTargets(roadmap.phases, targetPhaseNumber);
    const renumberMap = new Map(
      renumberTargets.map(({ previousPhase, newPhaseNumber }) => [
        previousPhase.phaseNumber,
        newPhaseNumber
      ])
    );
    const roadmapPath = resolveBlueprintPath(projectRoot, roadmap.path);
    const rawRoadmap = await fs.readFile(roadmapPath, "utf8");
    const removedPhaseLine = removePhaseLineFromRoadmap(rawRoadmap, targetPhaseNumber);

    if (!removedPhaseLine.removed) {
      throw new Error(
        `Phase ${targetPhaseNumber} could not be removed from the roadmap phases list.`
      );
    }

    const removedPhaseDetails = removePhaseDetailsFromRoadmap(
      removedPhaseLine.content,
      targetPhaseNumber
    );

    if (!removedPhaseDetails.removed) {
      warnings.push(
        `Phase ${targetPhaseNumber} did not have a matching entry under the roadmap's "## Phase Details" section.`
      );
    }

    const updatedRoadmap = rewriteRoadmapPhaseReferences(
      removedPhaseDetails.content,
      renumberMap
    );
    const renumberedPhases: RoadmapRemovePhaseResult["renumberedPhases"] = [];
    const preparedRenumberTargets: PhaseDirectoryRenumberPlan[] = [];

    for (const { previousPhase, newPhaseNumber } of renumberTargets) {
      const locatedPhaseDirectory = await findPhaseDirectory(projectRoot, previousPhase.phaseNumber);

      if (!locatedPhaseDirectory.phaseDir) {
        throw new Error(
          locatedPhaseDirectory.reason === "ambiguous"
            ? `Phase ${previousPhase.phaseNumber} has multiple matching directories under ${BLUEPRINT_PHASES_PATH}. Resolve the drift before removing ${targetPhaseNumber}.`
            : `Phase ${previousPhase.phaseNumber} is missing a matching directory under ${BLUEPRINT_PHASES_PATH}. Resolve the drift before removing ${targetPhaseNumber}.`
        );
      }

      const previousPhaseDir = locatedPhaseDirectory.phaseDir;
      const previousPhaseDirPath = resolveBlueprintPath(projectRoot, previousPhaseDir);
      const previousDirectoryName = path.basename(previousPhaseDirPath);
      const newPhasePrefix = formatPhasePrefix(newPhaseNumber);
      const renamedDirectoryName = renameLeadingPhaseToken(
        previousDirectoryName,
        previousPhase.phaseNumber,
        newPhasePrefix
      );

      if (!renamedDirectoryName) {
        throw new Error(
          `Phase directory ${previousPhaseDir} does not start with the expected phase number ${previousPhase.phaseNumber}.`
        );
      }

      const newPhaseDirPath = path.join(path.dirname(previousPhaseDirPath), renamedDirectoryName);
      const newPhaseDir = toRepoRelativePath(projectRoot, newPhaseDirPath);

      await assertExistingPhaseTopologyDirectory(previousPhaseDirPath, previousPhaseDir);
      if (path.resolve(newPhaseDirPath) !== path.resolve(targetPhaseDirPath)) {
        await assertPhaseTopologyDestinationAvailable(newPhaseDirPath, newPhaseDir);
      }
      const artifactRenamePlans = await collectPhaseArtifactRenamePlans({
        projectRoot,
        sourceRootPath: previousPhaseDirPath,
        destinationRootPath: newPhaseDirPath,
        oldPhaseNumber: previousPhase.phaseNumber,
        newPhasePrefix
      });
      await preflightPhaseArtifactRenamePlans(artifactRenamePlans);

      preparedRenumberTargets.push({
        previousPhase,
        newPhaseNumber,
        newPhasePrefix,
        previousPhaseDir,
        newPhaseDir,
        previousPhaseDirPath,
        newPhaseDirPath,
        artifactRenamePlans
      });
    }

    const transactionRootPath = phaseTopologyTransactionRootPath(
      projectRoot,
      "remove",
      targetPhaseNumber
    );
    const transactionRootRelativePath = toRepoRelativePath(projectRoot, transactionRootPath);
    const tombstonePhaseDirPath = path.join(
      transactionRootPath,
      path.basename(targetPhaseDirPath)
    );
    const journal: PhaseTopologyMoveJournalEntry[] = [];
    let committed = false;

    await assertPhaseTopologyDestinationAvailable(
      transactionRootPath,
      transactionRootRelativePath
    );

    try {
      await fs.mkdir(transactionRootPath, { recursive: true });
      await renameWithPhaseTopologyRollback(
        targetPhaseDirPath,
        tombstonePhaseDirPath,
        journal
      );

      for (const plan of preparedRenumberTargets) {
        await renameWithPhaseTopologyRollback(
          plan.previousPhaseDirPath,
          plan.newPhaseDirPath,
          journal
        );
        const renamedArtifacts = await applyPhaseArtifactRenamePlans(
          plan.artifactRenamePlans,
          journal
        );

        renumberedPhases.push({
          previousPhaseNumber: plan.previousPhase.phaseNumber,
          newPhaseNumber: plan.newPhaseNumber,
          previousPhasePrefix: plan.previousPhase.phasePrefix,
          newPhasePrefix: plan.newPhasePrefix,
          phaseName: plan.previousPhase.phaseName,
          previousPhaseDir: plan.previousPhaseDir,
          newPhaseDir: plan.newPhaseDir,
          renamedArtifacts
        });
      }

      warnings.push(
        ...await writeTextFile(roadmapPath, updatedRoadmap, {
          label: roadmap.path
        })
      );
      committed = true;
    } catch (error) {
      const rollbackFailures = await rollbackPhaseTopologyMoves(journal);

      if (rollbackFailures.length === 0) {
        await fs.rm(transactionRootPath, { recursive: true, force: true }).catch(() => undefined);
        throw error;
      }

      throw new Error(
        [
          error instanceof Error ? error.message : String(error),
          "Rollback failures:",
          ...rollbackFailures
        ].join("\n")
      );
    }

    if (committed) {
      await fs.rm(transactionRootPath, { recursive: true, force: true }).catch((error) => {
        warnings.push(
          `Phase ${targetPhaseNumber} was removed, but cleanup of transaction tombstone ${transactionRootRelativePath} failed: ${error instanceof Error ? error.message : String(error)}`
        );
      });
    }

    return {
      removedPhase: {
        phaseNumber: targetPhase.phaseNumber,
        phasePrefix: targetPhase.phasePrefix,
        phaseName: targetPhase.phaseName,
        phaseDir: targetPhaseDirectory.phaseDir,
        removedArtifacts
      },
      renumberedPhases,
      roadmapPath: roadmap.path,
      milestone: roadmap.milestone,
      written: true,
      warnings
    };
  });
}

async function materializePromotedBacklogPhaseDirectory(
  projectRoot: string,
  item: RoadmapPromotionPreviewItem,
  phasePrefix: string,
  phaseName: string
): Promise<{
  phaseDir: string;
  createdPhaseDir: boolean;
  reusedReservedPhaseDir: boolean;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const desiredPhaseDir = buildBlueprintPhaseDirectoryPath(phasePrefix, phaseName);
  const desiredPhaseDirPath = resolveBlueprintPath(projectRoot, desiredPhaseDir);

  if (item.reservedPhase) {
    const reservedDirectory = await findPhaseDirectory(projectRoot, item.reservedPhase);

    if (reservedDirectory.reason === "ambiguous") {
      throw new Error(
        `Backlog item ${item.backlogId} maps to reserved phase ${item.reservedPhase}, but multiple matching directories exist under ${BLUEPRINT_PHASES_PATH}. Resolve the drift before promoting it.`
      );
    }

    if (reservedDirectory.phaseDir) {
      const reservedPhaseDirPath = resolveBlueprintPath(projectRoot, reservedDirectory.phaseDir);
      const renamedDirectoryName = renameLeadingPhaseToken(
        path.basename(reservedPhaseDirPath),
        item.reservedPhase,
        phasePrefix
      );

      if (!renamedDirectoryName) {
        throw new Error(
          `Reserved phase directory ${reservedDirectory.phaseDir} does not start with ${item.reservedPhase}.`
        );
      }

      const promotedPhaseDirPath = path.join(
        path.dirname(reservedPhaseDirPath),
        renamedDirectoryName
      );

      if (
        promotedPhaseDirPath !== reservedPhaseDirPath &&
        (await pathExists(promotedPhaseDirPath))
      ) {
        throw new Error(
          `Promoted phase directory already exists for backlog item ${item.backlogId}: ${toRepoRelativePath(projectRoot, promotedPhaseDirPath)}.`
        );
      }

      const journal: PhaseTopologyMoveJournalEntry[] = [];

      try {
        if (promotedPhaseDirPath !== reservedPhaseDirPath) {
          await renameWithPhaseTopologyRollback(
            reservedPhaseDirPath,
            promotedPhaseDirPath,
            journal
          );
        }

        await renamePhaseArtifactsInPlace(
          projectRoot,
          promotedPhaseDirPath,
          item.reservedPhase,
          phasePrefix
        );
      } catch (error) {
        const rollbackFailures = await rollbackPhaseTopologyMoves(journal);

        if (rollbackFailures.length > 0) {
          throw new Error(
            [
              error instanceof Error ? error.message : String(error),
              "Rollback failures:",
              ...rollbackFailures
            ].join("\n")
          );
        }

        throw error;
      }

      return {
        phaseDir: toRepoRelativePath(projectRoot, promotedPhaseDirPath),
        createdPhaseDir: true,
        reusedReservedPhaseDir: true,
        warnings
      };
    }

    warnings.push(
      `Reserved phase ${item.reservedPhase} did not have a matching directory; created a new active phase directory instead.`
    );
  }

  if (await pathExists(desiredPhaseDirPath)) {
    warnings.push(`Phase directory already exists and was reused: ${desiredPhaseDir}`);

    return {
      phaseDir: desiredPhaseDir,
      createdPhaseDir: false,
      reusedReservedPhaseDir: false,
      warnings
    };
  }

  await fs.mkdir(desiredPhaseDirPath, { recursive: true });

  return {
    phaseDir: desiredPhaseDir,
    createdPhaseDir: true,
    reusedReservedPhaseDir: false,
    warnings
  };
}

export async function blueprintRoadmapPromoteBacklog(
  args: RoadmapPromoteBacklogArgs = {}
): Promise<RoadmapPromoteBacklogResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const backlogPath = BLUEPRINT_BACKLOG_INDEX_PATH;
  const roadmapPath = `${BLUEPRINT_DIR}/ROADMAP.md`;
  const backlog = await readBacklogPromotionCandidates(projectRoot);

  if (backlog.status === "project_missing") {
    return {
      status: "project_missing",
      backlogPath,
      roadmapPath,
      backlogItems: [],
      selectedBacklogIds: [],
      promotedItems: [],
      createdPhaseDirs: [],
      warnings: backlog.warnings
    };
  }

  if (backlog.status === "missing") {
    return {
      status: "invalid",
      backlogPath,
      roadmapPath,
      backlogItems: [],
      selectedBacklogIds: [],
      promotedItems: [],
      createdPhaseDirs: [],
      warnings: backlog.warnings
    };
  }

  const requestedBacklogIds = [...new Set((args.backlogIds ?? []).map((value) => value.trim().toUpperCase()).filter((value) => value.length > 0))];

  if ((args.previewOnly ?? false) || requestedBacklogIds.length === 0) {
    return {
      status: "preview",
      backlogPath,
      roadmapPath,
      backlogItems: backlog.backlogItems,
      selectedBacklogIds: [],
      promotedItems: [],
      createdPhaseDirs: [],
      warnings: backlog.warnings
    };
  }

  const warnings = [...backlog.warnings];
  const selectedItems: RoadmapPromotionPreviewItem[] = [];

  for (const backlogId of requestedBacklogIds) {
    const matched = backlog.backlogItems.find((item) => item.backlogId === backlogId);

    if (!matched) {
      warnings.push(`Backlog item ${backlogId} was not found in ${backlogPath}.`);
      continue;
    }

    if (backlogStatusBlocksPromotion(matched.status)) {
      warnings.push(
        `Backlog item ${backlogId} is already ${normalizeBacklogReviewStatus(matched.status)} and was skipped.`
      );
      continue;
    }

    selectedItems.push(matched);
  }

  if (selectedItems.length === 0) {
    return {
      status: "invalid",
      backlogPath,
      roadmapPath,
      backlogItems: backlog.backlogItems,
      selectedBacklogIds: requestedBacklogIds,
      promotedItems: [],
      createdPhaseDirs: [],
      warnings
    };
  }

  return withBlueprintRepoLock(projectRoot, PHASE_TOPOLOGY_LOCK_NAME, async () => {
    const roadmap = await readRoadmap(projectRoot);
    const roadmapAbsolutePath = resolveBlueprintPath(projectRoot, roadmap.path);
    let roadmapBody = await fs.readFile(roadmapAbsolutePath, "utf8");
    const roadmapPhases = [...roadmap.phases];
    const promotedItems: RoadmapPromoteBacklogResult["promotedItems"] = [];
    const createdPhaseDirs: string[] = [];

    for (const item of selectedItems) {
      const phaseNumber = nextIntegerPhaseNumber(roadmapPhases);
      const phasePrefix = formatPhasePrefix(phaseNumber);
      const phaseName = normalizePhaseDescription(item.description);
      const dependsOnPhaseNumber = previousIntegerPhaseNumber(phaseNumber);
      const phaseDirectory = await materializePromotedBacklogPhaseDirectory(
        projectRoot,
        item,
        phasePrefix,
        phaseName
      );

      roadmapBody = appendPhaseDetailsToRoadmap(
        appendPhaseLineToRoadmap(roadmapBody, phaseNumber, phaseName, {
          goal: `Promote backlog item ${item.backlogId}: ${phaseName}.`,
          successCriteria: [
            `Backlog item ${item.backlogId} has an authored phase context.`,
            `The promoted phase can move through planning with explicit scope decisions.`
          ]
        }),
        phaseNumber,
        phaseName,
        {
          dependsOnPhaseNumber,
          goal: `Promote backlog item ${item.backlogId}: ${phaseName}.`,
          successCriteria:
            `Backlog item ${item.backlogId} has an authored phase context.; The promoted phase can move through planning with explicit scope decisions.`
        }
      );
      roadmapPhases.push({
        phaseNumber,
        phasePrefix,
        phaseName,
        completed: false,
        summary: null,
        goal: null,
        successCriteria: null,
        requirements: []
      });
      promotedItems.push({
        backlogId: item.backlogId,
        phaseNumber,
        phasePrefix,
        phaseName,
        reservedPhase: item.reservedPhase,
        phaseDir: phaseDirectory.phaseDir,
        createdPhaseDir: phaseDirectory.createdPhaseDir,
        reusedReservedPhaseDir: phaseDirectory.reusedReservedPhaseDir
      });
      if (phaseDirectory.createdPhaseDir) {
        createdPhaseDirs.push(phaseDirectory.phaseDir);
      }
      warnings.push(...phaseDirectory.warnings);
    }

    warnings.push(
      ...await writeTextFile(roadmapAbsolutePath, roadmapBody, {
        label: roadmapPath
      })
    );

    return {
      status: "updated",
      backlogPath,
      roadmapPath,
      backlogItems: backlog.backlogItems,
      selectedBacklogIds: selectedItems.map((item) => item.backlogId),
      promotedItems,
      createdPhaseDirs,
      warnings
    };
  });
}

export async function blueprintPhaseLocate(
  args: PhaseLookupArgs = {}
): Promise<PhaseLocateResult> {
  return blueprintPhaseLocateImpl(args);
}

export async function blueprintPhaseContext(
  args: PhaseLookupArgs = {}
): Promise<PhaseContextResult> {
  return blueprintPhaseContextImpl(args);
}

export async function blueprintPhaseResearchStatus(
  args: PhaseLookupArgs = {}
): Promise<PhaseResearchStatusResult> {
  return blueprintPhaseResearchStatusImpl(args);
}

export async function blueprintPhaseValidationRead(
  args: PhaseValidationReadArgs
): Promise<PhaseValidationReadResult> {
  return blueprintPhaseValidationReadImpl(args, phaseValidationToolDeps);
}

export async function blueprintPhaseValidationWrite(
  args: PhaseValidationWriteArgs
): Promise<PhaseValidationWriteResult> {
  return blueprintPhaseValidationWriteImpl(args, phaseValidationToolDeps);
}

async function buildPhasePlanIndexFromResolved(
  input: PhasePlanIndexBuildInput
): Promise<PhasePlanIndexResult> {
  const { projectRoot, resolved } = input;
  const planPaths = input.artifacts
    .filter((artifact) => artifact.endsWith("-PLAN.md"))
    .sort((left, right) => left.localeCompare(right));
  const plans: PhasePlanRecord[] = [];
  const waves: Record<string, string[]> = {};
  const warnings: string[] = [...(input.warnings ?? [])];
  const knownPlanIds = new Set<string>();
  const gapClosurePlans = new Set<string>();

  for (const planPath of planPaths) {
    const planId = parseCanonicalPlanArtifactPath(planPath, resolved);

    if (!planId) {
      if (path.posix.dirname(planPath) === resolved.phaseDir) {
        warnings.push(`Ignoring non-canonical plan artifact name: ${planPath}`);
      }
      continue;
    }

    knownPlanIds.add(planId);
    const content = await fs.readFile(resolveBlueprintPath(projectRoot, planPath), "utf8");
    const record = toPhasePlanRecord(planId, planPath, content, resolved.phaseNumber);
    const dependencyIssues = collectInvalidPlanDependencyIssues(planPath, record.dependsOn);

    if (dependencyIssues.length > 0) {
      record.issues.push(...dependencyIssues);
      record.valid = false;
    }

    plans.push(record);

    if (record.valid && record.gapClosure) {
      gapClosurePlans.add(planId);
    }

    const waveKey = String(record.wave ?? "unassigned");
    waves[waveKey] ??= [];
    waves[waveKey].push(planPath);
  }

  const missingPlans =
    plans.length === 0
      ? [planPathFor(resolved, "01")]
      : plans.flatMap((plan) =>
          collectMissingDependencyPlanPaths(plan.dependsOn, knownPlanIds, resolved)
        );

  for (const plan of plans) {
    for (const issue of plan.issues) {
      warnings.push(`${plan.path}: ${issue}`);
    }
    for (const warning of plan.warnings) {
      warnings.push(`${plan.path}: ${warning}`);
    }
  }

  return {
    phaseFound: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    plans,
    waves,
    missingPlans: [...new Set(missingPlans)],
    gapClosurePlans: [...gapClosurePlans].sort((left, right) => left.localeCompare(right)),
    warnings
  };
}

async function buildPhasePlanIndexFromLocated(args: {
  projectRoot: string;
  located: PhaseLocateResult;
  resolved: ResolvedPhaseLocation;
}): Promise<PhasePlanIndexResult> {
  const { projectRoot, located, resolved } = args;

  return buildPhasePlanIndexFromResolved({
    projectRoot,
    resolved,
    artifacts: located.artifacts,
    warnings: located.reason ? [located.reason] : []
  });
}

export async function blueprintPhasePlanIndex(
  args: PlanIndexArgs = {}
): Promise<PhasePlanIndexResult> {
  const snapshot = await resolvePhaseRuntimeSnapshot(args);
  const { located, resolved } = snapshot;

  if (!resolved) {
    return {
      phaseFound: false,
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName,
      phaseDir: located.phaseDir,
      plans: [],
      waves: {},
      missingPlans: [],
      gapClosurePlans: [],
      warnings: located.reason ? [located.reason] : []
    };
  }

  return buildPhasePlanIndexFromResolved({
    projectRoot: snapshot.projectRoot,
    resolved,
    artifacts: snapshot.artifacts,
    warnings: located.reason ? [located.reason] : []
  });
}

export async function blueprintPhasePlanRead(
  args: PhasePlanReadArgs
): Promise<PhasePlanReadResult> {
  const snapshot = await resolvePhaseRuntimeSnapshot(args);
  const { projectRoot, located, resolved } = snapshot;

  if (!resolved) {
    return {
      phaseFound: false,
      found: false,
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName,
      phaseDir: located.phaseDir,
      planId: null,
      path: null,
      content: null,
      metadata: null,
      validation: null,
      reason: located.reason
    };
  }

  return readPhasePlanFromResolved({
    projectRoot,
    resolved,
    planId: normalizePlanId(args.planId)
  });
}

async function readPhasePlanFromResolved(args: {
  projectRoot: string;
  resolved: ResolvedPhaseLocation;
  planId: string;
}): Promise<PhasePlanReadResult> {
  const { projectRoot, resolved, planId } = args;
  const pathValue = planPathFor(resolved, planId);
  const absolutePath = resolveBlueprintPath(projectRoot, pathValue);

  if (!(await pathExists(absolutePath))) {
    return {
      phaseFound: true,
      found: false,
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      planId,
      path: pathValue,
      content: null,
      metadata: null,
      validation: null,
      reason: `${pathValue} does not exist yet.`
    };
  }

  const content = await fs.readFile(absolutePath, "utf8");
  const record = toPhasePlanRecord(planId, pathValue, content, resolved.phaseNumber);
  const dependencyIssues = collectInvalidPlanDependencyIssues(pathValue, record.dependsOn);

  return {
    phaseFound: true,
    found: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    planId,
    path: pathValue,
    content,
    metadata: {
      title: record.title,
      wave: record.wave,
      gapClosure: record.gapClosure,
      status: record.status,
      objective: record.objective,
      dependsOn: record.dependsOn,
      requirements: record.requirements,
      filesModified: record.filesModified,
      readFirst: record.readFirst,
      acceptanceCriteria: record.acceptanceCriteria,
      externalServicePrerequisites: record.externalServicePrerequisites,
      autonomous: record.autonomous
    },
    validation: {
      valid: record.valid && dependencyIssues.length === 0,
      issues: [...record.issues, ...dependencyIssues],
      warnings: record.warnings
    },
    reason: null
  };
}

export async function blueprintPhasePlanValidate(
  args: PhasePlanValidateArgs = {}
): Promise<PhasePlanValidationResult> {
  const snapshot = await resolvePhaseRuntimeSnapshot(args);
  const { projectRoot, located, resolved } = snapshot;

  if (!resolved) {
    return {
      phaseFound: false,
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName,
      phaseDir: located.phaseDir,
      status: "invalid",
      issues: [],
      warnings: [
        ...located.warnings,
        ...(located.reason ? [located.reason] : [])
      ],
      planCount: 0,
      planIds: [],
      roadmapRequirementIds: [],
      coveredRequirementIds: [],
      uncoveredRequirementIds: [],
      unexpectedRequirementIds: [],
      missingDependencyIds: [],
      cyclicDependencyPlanIds: []
    };
  }

  return validatePhasePlanSet(projectRoot, resolved);
}

export async function blueprintPhasePlanAuthoringContext(
  args: PhasePlanAuthoringContextArgs = {}
): Promise<PhasePlanAuthoringContextResult> {
  try {
    const context = await resolvePhasePlanAuthoringContextData(args);
    const phaseContext = await buildPhaseContext(context.projectRoot, {
      cwd: context.projectRoot,
      phase: context.resolved.phaseNumber
    });
    const planningReadiness = (
      await buildPhaseResearchStatusFromContext(context.projectRoot, phaseContext)
    ).planningReadiness;

    return phasePlanAuthoringContextFromData({
      context,
      planningReadiness
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    return {
      status: "invalid",
      phase: null,
      planId: null,
      path: null,
      schemaPath: null,
      baseSchema: null,
      taskSchema: null,
      knownRequirements: [],
      knownEvidenceArtifacts: [],
      allowedDependencyPlanIds: [],
      planningReadiness: invalidPhasePlanningReadiness(reason),
      modelOnly: true,
      reason,
      warnings: []
    };
  }
}

export async function blueprintPhasePlanReadiness(
  args: PhasePlanReadinessArgs = {}
): Promise<PhasePlanReadinessResult> {
  const maxBodyBytes = args.maxBodyBytes ?? 8192;
  const includeContent = args.bodyMode === "bounded" && args.readMode !== "hashes-only";
  const snapshot = await resolvePhaseRuntimeSnapshot(args);
  const projectRoot = snapshot.projectRoot;
  const state = await blueprintStateLoad({ cwd: projectRoot });
  const config = await blueprintConfigGet({
    cwd: projectRoot,
    scope: "effective"
  });
  const context = await buildPhaseContext(projectRoot, args);
  const researchStatus = await buildPhaseResearchStatusFromContext(projectRoot, context);
  const resolved = snapshot.resolved;
  const located = snapshot.located;
  const phaseSelection = phaseSelectionFromLocate(located);
  const contract = readArtifactContract("phase.plan");
  const modelContract = contract.modelContract ?? null;
  const readSet: PhasePlanReadSetEntry[] = [];

  for (const [pathValue, kind] of [
    [`${BLUEPRINT_DIR}/ROADMAP.md`, "roadmap"],
    [`${BLUEPRINT_DIR}/STATE.md`, "state"],
    [`${BLUEPRINT_DIR}/config.json`, "config.project"]
  ] as const) {
    const read = await readReadinessPath({
      projectRoot,
      pathValue,
      kind,
      includeContent: false,
      maxBodyBytes,
      reason: "freshness-metadata"
    });
    readSet.push(read.readSet);
  }
  readSet.push(
    buildReadinessHashEntry({
      pathValue: "effective-config",
      kind: "config.effective",
      value: config.config
    })
  );

  const invalidAuthoringContext: PhasePlanAuthoringContextResult = {
    status: "invalid",
    phase: null,
    planId: null,
    path: null,
    schemaPath: null,
    baseSchema: null,
    taskSchema: null,
    knownRequirements: [],
    knownEvidenceArtifacts: [],
    allowedDependencyPlanIds: [],
    planningReadiness: invalidPhasePlanningReadiness(
      located.reason ?? "Phase could not be resolved for plan readiness."
    ),
    modelOnly: true,
    reason: located.reason ?? "Phase could not be resolved for plan readiness.",
    warnings: []
  };
  let planIndex: PhasePlanIndexResult = {
    phaseFound: false,
    phaseNumber: located.phaseNumber,
    phasePrefix: located.phasePrefix,
    phaseName: located.phaseName,
    phaseDir: located.phaseDir,
    plans: [],
    waves: {},
    missingPlans: [],
    gapClosurePlans: [],
    warnings: located.reason ? [located.reason] : []
  };
  let authoringContext = invalidAuthoringContext;

  if (resolved) {
    readSet.push(
      buildReadinessHashEntry({
        pathValue: resolved.phaseDir,
        kind: "phase.artifact.inventory",
        value: canonicalPhaseReadinessInventory(snapshot.artifacts, resolved)
      })
    );
    planIndex = await buildPhasePlanIndexFromResolved({
      projectRoot,
      resolved,
      artifacts: snapshot.artifacts
    });
    const authoringData = await buildPhasePlanAuthoringContextData({
      snapshot,
      planId: args.planId
    });
    authoringContext = phasePlanAuthoringContextFromData({
      context: authoringData,
      planningReadiness: researchStatus.planningReadiness
    });

    for (const plan of planIndex.plans) {
      const read = await readReadinessPath({
        projectRoot,
        pathValue: plan.path,
        kind: "phase.plan",
        includeContent: false,
        maxBodyBytes,
        reason: "plan-index"
      });
      readSet.push(read.readSet);
    }
  }

  const artifactBodies: PhasePlanReadinessResult["artifactBodies"] = {};
  const contextPath = context.phase?.artifacts.context ?? null;
  const researchPath = context.phase?.artifacts.research ?? null;
  const specPath = context.phase?.artifacts.spec ?? null;
  const uiSpecPath = context.phase?.artifacts.uiSpec ?? null;
  const expectedArtifactPaths = resolved
    ? {
        context: artifactPathFor(resolved, "context"),
        research: artifactPathFor(resolved, "research"),
        spec: artifactPathFor(resolved, "spec"),
        uiSpec: artifactPathFor(resolved, "ui-spec"),
        verification: validationArtifactPathFor(resolved, "verification"),
        uat: validationArtifactPathFor(resolved, "uat"),
        review: buildArtifactPath(resolved.phaseDir, resolved.phasePrefix, "-REVIEW.md")
      }
    : null;

  for (const [key, pathValue, kind, relevant] of [
    ["context", contextPath, "phase.context", true],
    ["research", researchPath, "phase.research", config.config.workflow.research],
    ["spec", specPath, "phase.spec", true],
    ["uiSpec", uiSpecPath, "phase.uiSpec", config.config.workflow.ui_phase]
  ] as const) {
    const expectedPath = expectedArtifactPaths?.[key] ?? null;
    const omittedReason = relevant
      ? "artifact absent"
      : "disabled or not relevant under effective config";

    if (!pathValue) {
      if (key === "spec") {
        continue;
      }

      if (expectedPath) {
        const missingRead = await readReadinessPath({
          projectRoot,
          pathValue: expectedPath,
          kind,
          includeContent: false,
          maxBodyBytes,
          reason: omittedReason
        });
        readSet.push(missingRead.readSet);
      }
      artifactBodies[key] = {
        path: expectedPath,
        summary: null,
        hash: null,
        sizeBytes: 0,
        truncated: false,
        omittedReason,
        warnings: []
      };
      continue;
    }

    const read = await readReadinessPath({
      projectRoot,
      pathValue,
      kind,
      includeContent: includeContent && relevant,
      maxBodyBytes,
      reason: relevant ? undefined : "disabled or not relevant under effective config"
    });
    readSet.push(read.readSet);
    artifactBodies[key] = read.body;
  }

  const validationPaths = [
    context.phase?.artifacts.verification,
    context.phase?.artifacts.uat
  ].filter((value): value is string => Boolean(value));
  for (const expectedPath of [
    expectedArtifactPaths?.verification,
    expectedArtifactPaths?.uat
  ].filter((value): value is string => Boolean(value))) {
    if (!validationPaths.includes(expectedPath)) {
      const missingRead = await readReadinessPath({
        projectRoot,
        pathValue: expectedPath,
        kind: "phase.validation",
        includeContent: false,
        maxBodyBytes,
        reason: "artifact absent"
      });
      readSet.push(missingRead.readSet);
    }
  }
  const includeValidationEvidence =
    args.includeValidationEvidence ?? validationPaths.length > 0;
  const validationEvidence: PhasePlanReadinessResult["validationEvidence"] =
    includeValidationEvidence && validationPaths.length > 0
      ? {
          found: true,
          paths: validationPaths,
          summaryPaths: context.phase?.artifacts.summaries ?? []
        }
      : {
          found: false,
          reason: validationPaths.length === 0
            ? "No XX-VERIFICATION.md or XX-UAT.md artifact present."
            : "Validation evidence expansion disabled by request.",
          paths: [],
          summaryPaths: []
        };

  if (validationEvidence.found) {
    const validationReads = await Promise.all(
      validationEvidence.paths.map((pathValue) =>
        readReadinessPath({
          projectRoot,
          pathValue,
          kind: "phase.validation",
          includeContent,
          maxBodyBytes
        })
      )
    );
    readSet.push(...validationReads.map((read) => read.readSet));
    validationEvidence.contentHash = hashString(
      validationReads.map((read) => read.raw ?? "").join("\n--- blueprint-validation-evidence ---\n")
    );
    if (includeContent) {
      validationEvidence.content = validationReads
        .map((read) => read.body.content)
        .filter((value): value is string => Boolean(value))
        .join("\n\n");
    }
  }

  const reviewPath =
    expectedArtifactPaths?.review && context.phase?.artifacts.all.includes(expectedArtifactPaths.review)
      ? expectedArtifactPaths.review
      : null;
  if (expectedArtifactPaths?.review && !reviewPath) {
    const missingRead = await readReadinessPath({
      projectRoot,
      pathValue: expectedArtifactPaths.review,
      kind: "phase.review",
      includeContent: false,
      maxBodyBytes,
      reason: "artifact absent"
    });
    readSet.push(missingRead.readSet);
  }
  const includeReviewFindings = args.includeReviewFindings ?? Boolean(reviewPath);
  const reviewFindings: PhasePlanReadinessResult["reviewFindings"] =
    includeReviewFindings && reviewPath
      ? {
          found: true,
          path: reviewPath,
          severityCounts: {},
          findingIds: []
        }
      : {
          found: false,
          reason: reviewPath
            ? "Review findings expansion disabled by request."
            : "No XX-REVIEW.md artifact present.",
          path: reviewPath,
          severityCounts: {},
          findingIds: []
        };

  if (reviewFindings.found && reviewPath) {
    const read = await readReadinessPath({
      projectRoot,
      pathValue: reviewPath,
      kind: "phase.review",
      includeContent,
      maxBodyBytes
    });
    readSet.push(read.readSet);
    const raw = read.raw ?? "";
    reviewFindings.severityCounts = countReviewSeverities(raw);
    reviewFindings.findingIds = extractReviewFindingIds(raw);
    if (includeContent) {
      reviewFindings.findings = raw
        .replace(/\r\n/g, "\n")
        .split("\n")
        .filter((line) => /\b(?:F|FU)-[A-Z0-9][A-Z0-9._-]*\b/.test(line))
        .slice(0, 20);
    }
  }

  const savedPlanBodies: PhasePlanReadinessResult["savedPlanBodies"] = [];
  if (args.includeSavedPlanBodies === "target" && authoringContext.planId) {
    const targetPlan = planIndex.plans.find((plan) => plan.planId === authoringContext.planId);

    if (targetPlan) {
      const read = await readReadinessPath({
        projectRoot,
        pathValue: targetPlan.path,
        kind: "phase.plan.body",
        includeContent: true,
        maxBodyBytes
      });
      readSet.push(read.readSet);
      savedPlanBodies.push({
        planId: targetPlan.planId,
        path: targetPlan.path,
        content: read.body.content ?? "",
        hash: read.readSet.hash,
        validation: {
          valid: targetPlan.valid,
          issues: targetPlan.issues,
          warnings: targetPlan.warnings
        }
      });
    } else if (authoringContext.path) {
      const missingRead = await readReadinessPath({
        projectRoot,
        pathValue: authoringContext.path,
        kind: "phase.plan.body",
        includeContent: false,
        maxBodyBytes,
        reason: "artifact absent"
      });
      readSet.push(missingRead.readSet);
    }
  }

  const finalReadSet = dedupeReadSet(readSet);
  const freshness = compareReadSetFreshness(finalReadSet, args.previousReadSet);
  const status: PhasePlanReadinessResult["status"] =
    !resolved ? "invalid" : authoringContext.status === "ready" ? "ready" : "blocked";
  const hashesOnly = args.readMode === "hashes-only";
  const returnedAuthoringContext = hashesOnly
    ? {
        ...authoringContext,
        baseSchema: null,
        taskSchema: null
      }
    : authoringContext;

  return {
    status,
    phaseSelection,
    context: hashesOnly ? null : context,
    researchStatus: hashesOnly ? null : researchStatus,
    planIndex: hashesOnly ? null : planIndex,
    authoringContext: returnedAuthoringContext,
    effectiveConfig: config.config,
    stateSnapshot: {
      projectStatus: state.derivedStatus.projectStatus,
      currentMilestone: state.state.currentMilestone,
      currentPhase: state.derivedStatus.currentPhase,
      activeCommand: state.state.activeCommand,
      nextAction: state.derivedStatus.nextAction,
      blockers: state.blockers
    },
    contract: {
      artifactId: "phase.plan",
      schemaPath: modelContract?.schemaPath ?? null,
      modelContract: {
        schemaPath: modelContract?.schemaPath ?? null,
        jsonSchema: hashesOnly || !modelContract
          ? null
          : cloneJsonObject(modelContract.jsonSchema)
      },
      ...(hashesOnly ? {} : { authoringTemplate: contract.authoringTemplate }),
      contractHash: hashString(
        JSON.stringify({
          schemaPath: modelContract?.schemaPath ?? null,
          jsonSchema: modelContract?.jsonSchema ?? null,
          authoringTemplate: contract.authoringTemplate
        })
      )
    },
    artifactBodies,
    validationEvidence,
    reviewFindings,
    savedPlanBodies: hashesOnly ? [] : savedPlanBodies,
    readSet: finalReadSet,
    freshness,
    nextSafeAction:
      authoringContext.planningReadiness.nextSafeAction ||
      firstNonNull([state.derivedStatus.nextAction, "Run /blu-progress"]) ||
      "Run /blu-progress",
    warnings: [
      ...config.warnings,
      ...context.warnings,
      ...researchStatus.warnings,
      ...planIndex.warnings,
      ...(freshness.checked && !freshness.fresh
        ? [`Read-set freshness check failed for: ${freshness.stalePaths.join(", ")}.`]
        : [])
    ]
  };
}

export async function blueprintPhasePlanValidateModel(
  args: PhasePlanValidateModelArgs
): Promise<PhasePlanStandaloneValidateModelResult> {
  let context: Awaited<ReturnType<typeof resolvePhasePlanAuthoringContextData>>;

  try {
    context = await resolvePhasePlanAuthoringContextData(args);
  } catch (error) {
    const diagnostics = [
      phasePlanDiagnostic({
        source: "scope",
        path: "phase",
        code: "scope.invalid",
        message: error instanceof Error ? error.message : String(error),
        context: {},
        suggestion: "Resolve a valid phase and plan slot before authoring a phase.plan model."
      })
    ];

    return trimPhasePlanStandaloneValidateModelResult({
      status: "invalid",
      valid: false,
      target: phasePlanValidateModelTarget({
        phase: null,
        planId: null,
        path: null,
        schemaPath: null
      }),
      repairBudget: {
        maxAttempts: 2,
        recommendedStrategy: "repair-all-diagnostics-before-retry"
      },
      repairSummary: summarizePhasePlanRepairs(diagnostics),
      phase: null,
      planId: null,
      path: null,
      schemaPath: null,
      taskSchema: null,
      diagnostics,
      diagnosticCounts: countPhasePlanDiagnostics(diagnostics),
      normalizedModel: null,
      renderPreview: null,
      warnings: []
    });
  }

  const validation = await validatePhasePlanModelWithContext({
    model: args.model,
    context
  });

  const diagnostics = [...validation.diagnostics];
  const warnings = [...validation.warnings];

  if (validation.renderPreview) {
    const prospectiveValidation = await validateProspectivePhasePlanSetForPath(
      context.projectRoot,
      context.resolved,
      context.pathValue,
      context.planId,
      validation.renderPreview
    );

    diagnostics.push(
      ...prospectiveValidation.blockingIssues.map(phasePlanPreflightDiagnosticFromIssue)
    );
    warnings.push(...prospectiveValidation.warnings);
  }

  const blockingDiagnostics = diagnostics.filter(isBlockingPhasePlanDiagnostic);
  const enhancedValidation: PhasePlanValidateModelResult = {
    ...validation,
    status: blockingDiagnostics.length === 0 ? "valid" : "invalid",
    valid: blockingDiagnostics.length === 0,
    repairSummary: summarizePhasePlanRepairs(diagnostics),
    diagnostics,
    diagnosticCounts: countPhasePlanDiagnostics(diagnostics),
    warnings
  };

  return trimPhasePlanStandaloneValidateModelResult(enhancedValidation);
}

export async function blueprintPhasePlanWrite(
  args: PhasePlanWriteArgs
): Promise<PhasePlanWriteResult> {
  const { projectRoot, resolved: initialResolved, matchedPhase } = await resolveLocatedPhaseForMutation(args);
  const expectedTopology = phaseTopologyFingerprintFromLocation(initialResolved, matchedPhase);
  const hasContent = args.content !== undefined;
  const hasModel = args.model !== undefined;
  const modelOnly = args.authoringMode === "model-only";
  const strictValidation = (args.validationMode ?? "strict") === "strict";
  const shouldReturnPlanSetValidation = args.returnPlanSetValidation ?? hasModel;

  return withFreshPhaseTopologyForMutation(
    projectRoot,
    args,
    expectedTopology,
    "Phase plan write",
    async ({ resolved: latestResolved }) => withBlueprintRepoLock(projectRoot, "phase-plan-write", async () => {
    let freshness: PhasePlanWriteResult["freshness"];
    const lockedSnapshot = await resolvePhaseRuntimeSnapshot({
      cwd: projectRoot,
      phase: latestResolved.phaseNumber
    });
    const resolved = lockedSnapshot.resolved;

    if (!resolved) {
      throw new Error(lockedSnapshot.located.reason ?? "Phase could not be resolved for plan writing.");
    }

    assertFreshPhaseTopology({
      operation: "Phase plan write",
      expected: expectedTopology,
      resolved,
      matchedPhase: lockedSnapshot.matchedPhase
    });

    const existingIndex = await buildPhasePlanIndexFromResolved({
      projectRoot,
      resolved,
      artifacts: lockedSnapshot.artifacts
    });
    const nextPlanNumber =
      existingIndex.plans.length === 0
        ? 1
        : Math.max(
            ...existingIndex.plans.map((plan) => Number.parseInt(plan.planId, 10))
          ) + 1;
    const planId = args.planId
      ? normalizePlanId(args.planId)
      : normalizePlanId(String(nextPlanNumber));
    const pathValue = planPathFor(resolved, planId);
    const absolutePath = resolveBlueprintPath(projectRoot, pathValue);

    if (hasContent === hasModel) {
      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        planId,
        path: pathValue,
        written: false,
        created: false,
        overwritten: false,
        status: "invalid",
        validation: {
          valid: false,
          issues: ["Phase plan writes must supply exactly one of content or model."],
          warnings: []
        },
        warnings: []
      };
    }

    if (modelOnly && hasContent) {
      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        planId,
        path: pathValue,
        written: false,
        created: false,
        overwritten: false,
        status: "invalid",
        validation: {
          valid: false,
          issues: [
            "Phase plan model-only writes must supply the validated structured model, not Markdown content."
          ],
          warnings: []
        },
        warnings: []
      };
    }

    if (args.expectedReadSet && args.expectedReadSet.length > 0) {
      const readiness = await blueprintPhasePlanReadiness({
        cwd: projectRoot,
        phase: resolved.phaseNumber,
        planId,
        readMode: "hashes-only",
        includeSavedPlanBodies: "target",
        previousReadSet: args.expectedReadSet
      });
      freshness = readiness.freshness;

      if (!readiness.freshness.fresh) {
        return {
          phaseNumber: resolved.phaseNumber,
          phasePrefix: resolved.phasePrefix,
          phaseName: resolved.phaseName,
          phaseDir: resolved.phaseDir,
          planId,
          path: pathValue,
          written: false,
          created: false,
          overwritten: false,
          status: "invalid",
          validation: {
            valid: false,
            issues: [
              `Read-set freshness check failed for: ${readiness.freshness.stalePaths.join(", ")}.`
            ],
            warnings: readiness.warnings
          },
          completionReady: false,
          incrementalCheckpoint: false,
          freshness: readiness.freshness,
          warnings: readiness.warnings
        };
      }
    }

    let normalizedContent: string;
    let modelCoverageIssues: string[] = [];
    let modelWarnings: string[] = [];
    let modelValidation: PhasePlanWriteModelValidationResult | null = null;

    if (hasModel) {
      const authoringContext = await buildPhasePlanAuthoringContextData({
        snapshot: lockedSnapshot,
        planId
      });
      const modelRender = await phasePlanModelToContent(args.model, authoringContext);
      modelValidation = trimPhasePlanWriteModelValidation(modelRender.validation);

      if (!modelRender.content) {
        return {
          phaseNumber: resolved.phaseNumber,
          phasePrefix: resolved.phasePrefix,
          phaseName: resolved.phaseName,
          phaseDir: resolved.phaseDir,
          planId,
          path: pathValue,
          written: false,
          created: false,
          overwritten: false,
          status: "invalid",
          validation: {
            valid: false,
            issues: modelRender.issues,
            warnings: modelRender.warnings
          },
          modelValidation,
          warnings: modelRender.warnings
        };
      }

      normalizedContent = normalizeTextContent(modelRender.content);
      modelCoverageIssues = modelRender.issues;
      modelWarnings = modelRender.warnings;
    } else {
      normalizedContent = normalizeTextContent(args.content ?? "");
    }

    const contentForValidation =
      !hasModel && args.planId === undefined
        ? reconcileAutoAssignedPlanContent(normalizedContent, planId)
        : normalizedContent;
    const preparedContent = prepareTextForPersistence(contentForValidation, {
      label: pathValue
    });
    const validation = validatePlanArtifactContent(preparedContent.content, resolved.phaseNumber, {
      strict: strictValidation
    });
    const contentValidationIssues = partitionPhasePlanMarkdownValidationIssues(validation.issues);
    const dependencyIssues = collectInvalidPlanDependencyIssues(
      pathValue,
      validation.metadata.dependsOn
    );
    const normalizedFrontmatterPlanId =
      validation.metadata.planId && /^\d+$/.test(validation.metadata.planId)
        ? normalizePlanId(validation.metadata.planId)
        : null;
    const validationIssues = [
      ...modelCoverageIssues,
      ...contentValidationIssues.blockingIssues,
      ...dependencyIssues
    ];
    const warnings: string[] = [
      ...modelWarnings,
      ...preparedContent.warnings,
      ...contentValidationIssues.warningIssues,
      ...validation.warnings
    ];

    if (dependencyIssues.length > 0 && strictValidation) {
      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        planId,
        path: pathValue,
        written: false,
        created: false,
        overwritten: false,
        status: "invalid",
        validation: {
          valid: false,
          issues: validationIssues,
          warnings
        },
        warnings: dependencyIssues
      };
    }

    if (normalizedFrontmatterPlanId && normalizedFrontmatterPlanId !== planId) {
      const issue = `Plan frontmatter plan_id "${validation.metadata.planId}" must match the requested planId "${planId}".`;

      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        planId,
        path: pathValue,
        written: false,
        created: false,
        overwritten: false,
        status: "invalid",
        validation: {
          valid: false,
          issues: [...contentValidationIssues.blockingIssues, issue],
          warnings
        },
        warnings: []
      };
    }

    if (modelCoverageIssues.length > 0) {
      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        planId,
        path: pathValue,
        written: false,
        created: false,
        overwritten: false,
        status: "invalid",
        validation: {
          valid: false,
          issues: validationIssues,
          warnings
        },
        modelValidation,
        warnings
      };
    }

    if (contentValidationIssues.blockingIssues.length > 0 && strictValidation) {
      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        planId,
        path: pathValue,
        written: false,
        created: false,
        overwritten: false,
        status: "invalid",
        validation: {
          valid: false,
          issues: validationIssues,
          warnings
        },
        warnings
      };
    }

    const prospectiveValidation = await validatePhasePlanSet(projectRoot, resolved, {
      overrides: new Map([[pathValue, preparedContent.content]]),
      roadmapCoverageSeverity: "warning"
    });
    const blockingIssues = selectRelevantPlanValidationIssues(
      prospectiveValidation,
      pathValue,
      planId
    );

    if (blockingIssues.length > 0 && strictValidation) {
      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        planId,
        path: pathValue,
        written: false,
        created: false,
        overwritten: false,
        status: "invalid",
        validation: {
          valid: false,
          issues: blockingIssues,
          warnings: prospectiveValidation.warnings
        },
        ...phasePlanWriteCompletionFields({
          prospectiveValidation,
          includeSummary: shouldReturnPlanSetValidation,
          saved: false
        }),
        warnings: [...warnings, ...prospectiveValidation.warnings]
      };
    }

    const exists = await pathExists(absolutePath);
    const normalizePersistedText = (value: string): string =>
      value.replace(/\r\n/g, "\n").replace(/^---\n([\s\S]*?)\n---\n+/, "---\n$1\n---\n").trimEnd();

    if (exists) {
      const existingContent = await fs.readFile(absolutePath, "utf8");

      if (normalizePersistedText(existingContent) === normalizePersistedText(preparedContent.content)) {
        warnings.push(`Preserved existing plan artifact because the content was unchanged.`);

        return {
          phaseNumber: resolved.phaseNumber,
          phasePrefix: resolved.phasePrefix,
          phaseName: resolved.phaseName,
          phaseDir: resolved.phaseDir,
          planId,
          path: pathValue,
          written: false,
          created: false,
          overwritten: false,
          status: "reused",
          validation: {
            valid: blockingIssues.length === 0,
            issues: blockingIssues,
            warnings: [...contentValidationIssues.warningIssues, ...prospectiveValidation.warnings]
          },
          modelValidation,
          ...phasePlanWriteCompletionFields({
            prospectiveValidation,
            includeSummary: shouldReturnPlanSetValidation,
            saved: true
          }),
          ...(freshness ? { freshness } : {}),
          ...(args.returnNextAuthoringContext
            ? {
                nextAuthoringContext: await blueprintPhasePlanAuthoringContext({
                  cwd: projectRoot,
                  phase: resolved.phaseNumber
                })
              }
            : {}),
          warnings: [...warnings, ...prospectiveValidation.warnings]
        };
      }

      if (!(args.overwrite ?? false)) {
        throw new Error(
          `${pathValue} already exists. Re-run only after explicit overwrite confirmation.`
        );
      }
    }

    warnings.push(
      ...(await writeTextFile(absolutePath, preparedContent.content, {
        label: pathValue
      }))
    );

    if (exists) {
      warnings.push(`Replaced existing plan artifact: ${pathValue}`);
    }

    return {
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      planId,
      path: pathValue,
      written: true,
      created: !exists,
      overwritten: exists,
      status: exists ? "updated" : "created",
      validation: {
        valid: blockingIssues.length === 0,
        issues: blockingIssues,
        warnings: [...contentValidationIssues.warningIssues, ...prospectiveValidation.warnings]
      },
      modelValidation,
      ...phasePlanWriteCompletionFields({
        prospectiveValidation,
        includeSummary: shouldReturnPlanSetValidation,
        saved: true
      }),
      ...(freshness ? { freshness } : {}),
      ...(args.returnNextAuthoringContext
        ? {
            nextAuthoringContext: await blueprintPhasePlanAuthoringContext({
              cwd: projectRoot,
              phase: resolved.phaseNumber
            })
          }
        : {}),
      warnings: [...warnings, ...prospectiveValidation.warnings]
    };
    })
  );
}

export async function blueprintPhaseSummaryIndex(
  args: PlanIndexArgs = {}
): Promise<PhaseSummaryIndexResult> {
  const { projectRoot, located, resolved } = await resolveLocatedPhaseForRead(args);

  if (!resolved) {
    return {
      phaseFound: false,
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName,
      phaseDir: located.phaseDir,
      summaries: [],
      completedPlans: [],
      pendingPlans: [],
      warnings: located.reason ? [located.reason] : []
    };
  }

  const { summaryInventory } = await loadResolvedPhaseSummaryContext({
    projectRoot,
    located,
    resolved,
    buildPhasePlanIndexFromLocated,
    validateSummaryAgainstLivePlanInventory
  });

  return summaryInventory.summaryIndex;
}

async function resolvePhaseSummaryAuthoringData(
  args: PhaseSummaryAuthoringContextArgs
): Promise<{
  projectRoot: string;
  located: PhaseLocateResult;
  resolved: ResolvedPhaseLocation | null;
  matchedPhase: ParsedRoadmapPhase | null;
  planId: string;
  summaryPath: string | null;
  planRead: PhasePlanReadResult | null;
  planIndex: PhasePlanIndexResult | null;
  summaryInventory: PhaseSummaryInventory | null;
  existingSummary: PhaseSummaryReadResult | null;
  indexedPlan: PhasePlanRecord | null;
  knownPlanIds: Set<string>;
  dependencyPlans: Array<{ planId: string; path: string }>;
  missingDependencyPlans: string[];
  acceptanceCriteria: string[];
}> {
  const planId = normalizePlanId(args.planId);
  const snapshot = await resolvePhaseRuntimeSnapshot(args);
  const { projectRoot, located, resolved, matchedPhase } = snapshot;

  if (!resolved) {
    return {
      projectRoot,
      located,
      resolved: null,
      matchedPhase,
      planId,
      summaryPath: null,
      planRead: null,
      planIndex: null,
      summaryInventory: null,
      existingSummary: null,
      indexedPlan: null,
      knownPlanIds: new Set<string>(),
      dependencyPlans: [],
      missingDependencyPlans: [],
      acceptanceCriteria: []
    };
  }

  const [planRead, summaryContext] = await Promise.all([
    readPhasePlanFromResolved({
      projectRoot,
      resolved,
      planId
    }),
    loadResolvedPhaseSummaryContext({
      projectRoot,
      located,
      resolved,
      buildPhasePlanIndexFromLocated,
      validateSummaryAgainstLivePlanInventory
    })
  ]);
  const { planIndex, summaryInventory } = summaryContext;
  const indexedPlan = planIndex.plans.find((candidate) => candidate.planId === planId) ?? null;
  const knownPlanIds = new Set(planIndex.plans.map((candidate) => candidate.planId));
  const dependsOn = indexedPlan?.dependsOn ?? planRead.metadata?.dependsOn ?? [];

  return {
    projectRoot,
    located,
    resolved,
    matchedPhase,
    planId,
    summaryPath: summaryPathFor(resolved, planId),
    planRead,
    planIndex,
    summaryInventory,
    existingSummary: phaseSummaryReadFromInventory({
      resolved,
      planId,
      inventory: summaryInventory,
      validateSummaryAgainstLivePlanInventory
    }),
    indexedPlan,
    knownPlanIds,
    dependencyPlans: dependencyPlanRowsForPlan(dependsOn, knownPlanIds, resolved),
    missingDependencyPlans: collectMissingDependencyPlanPaths(dependsOn, knownPlanIds, resolved),
    acceptanceCriteria:
      indexedPlan?.acceptanceCriteria ?? planRead.metadata?.acceptanceCriteria ?? []
  };
}

function buildPhaseSummaryAuthoringPrerequisites(args: {
  resolved: ResolvedPhaseLocation;
  planId: string;
  planRead: PhasePlanReadResult | null;
  planIndex: PhasePlanIndexResult | null;
  summaryInventory: PhaseSummaryInventory | null;
  indexedPlan: PhasePlanRecord | null;
  dependencyPlans: Array<{ planId: string; path: string }>;
  missingDependencyPlans: string[];
}): {
  linkedPlanPath: string;
  blockers: string[];
  warnings: string[];
  unsatisfiedDependencyPlans: Array<{ planId: string; path: string }>;
  completedDependencyPlanIds: Set<string>;
} {
  const linkedPlanPath =
    args.planRead?.path ?? args.indexedPlan?.path ?? planPathFor(args.resolved, args.planId);
  const completedDependencyPlanIds = new Set(
    args.summaryInventory?.summaryIndex.completedPlans ?? []
  );
  const unsatisfiedDependencyPlans = args.dependencyPlans.filter(
    (dependency) => !completedDependencyPlanIds.has(dependency.planId)
  );
  const blockers: string[] = [];
  const warnings = [
    ...(args.planIndex?.warnings ?? []),
    ...(args.summaryInventory?.summaryIndex.warnings ?? [])
  ];

  if (!args.planRead) {
    blockers.push("Phase summary authoring prerequisites could not be loaded.");
  } else if (!args.planRead.found || !args.planRead.path) {
    blockers.push(
      `${linkedPlanPath} does not exist yet. Create the matching plan before authoring a summary.`
    );
  } else if (!args.planRead.validation?.valid) {
    const planIssues = args.planRead.validation?.issues.length
      ? args.planRead.validation.issues
      : ["Linked plan artifact is invalid and must be repaired before execution can be summarized."];
    blockers.push(...planIssues.map((issue) => `${args.planRead?.path}: ${issue}`));
  }

  if (args.missingDependencyPlans.length > 0) {
    blockers.push(
      `${linkedPlanPath}: linked plan is missing dependency plan artifacts: ${args.missingDependencyPlans.join(", ")}`
    );
  }

  if (unsatisfiedDependencyPlans.length > 0) {
    warnings.push(
      `${linkedPlanPath}: a COMPLETED summary cannot close until linked dependency plan summaries are completed: ${unsatisfiedDependencyPlans
        .map((dependency) => `${dependency.planId} (${dependency.path})`)
        .join(", ")}. Use Status: PARTIAL or BLOCKED, update Readiness, Completion State, Next Safe Action, Verification, Gap / Repair Routes, and Follow-Ups to match, and keep the dependency blocker explicit until those dependency summaries exist.`
    );
  }

  return {
    linkedPlanPath,
    blockers,
    warnings,
    unsatisfiedDependencyPlans,
    completedDependencyPlanIds
  };
}

export async function blueprintPhaseSummaryAuthoringContext(
  args: PhaseSummaryAuthoringContextArgs
): Promise<PhaseSummaryAuthoringContextResult> {
  const data = await resolvePhaseSummaryAuthoringData(args);
  const {
    located,
    resolved,
    planId,
    summaryPath,
    planRead,
    planIndex,
    summaryInventory,
    existingSummary,
    indexedPlan,
    dependencyPlans,
    missingDependencyPlans,
    acceptanceCriteria
  } = data;

  if (!resolved) {
    const reason = located.reason ?? "Phase could not be resolved for summary authoring.";

    return {
      status: "invalid",
      phase: null,
      planId,
      path: null,
      linkedPlanPath: null,
      plan: null,
      existing: null,
      dependencyPlans: [],
      acceptanceCriteria: [],
      allowedNextActions: [],
      schemaPath: null,
      baseSchema: null,
      taskSchema: null,
      modelOnly: false,
      prerequisiteBlockers: [reason],
      reason,
      warnings: []
    };
  }

  const { linkedPlanPath, blockers, warnings } = buildPhaseSummaryAuthoringPrerequisites({
    resolved,
    planId,
    planRead,
    planIndex,
    summaryInventory,
    indexedPlan,
    dependencyPlans,
    missingDependencyPlans
  });

  const allowedNextActions = await buildPhaseSummaryAllowedNextActions(resolved.phaseNumber);

  return {
    status: blockers.length === 0 ? "ready" : "invalid",
    phase: resolved,
    planId,
    path: summaryPath,
    linkedPlanPath,
    plan: indexedPlan,
    existing: existingSummary,
    dependencyPlans,
    acceptanceCriteria,
    allowedNextActions: allowedNextActions.allowedActions,
    schemaPath: null,
    baseSchema: null,
    taskSchema: null,
    modelOnly: false,
    prerequisiteBlockers: blockers,
    reason: blockers.length > 0 ? blockers.join(" ") : null,
    warnings
  };
}

export async function blueprintPhaseSummaryValidateModel(
  args: PhaseSummaryValidateModelArgs
): Promise<PhaseSummaryValidateModelResult> {
  const data = await resolvePhaseSummaryAuthoringData({
    cwd: args.cwd,
    phase: args.phase,
    planId: args.planId
  });
  const {
    located,
    resolved,
    planId,
    summaryPath,
    planRead,
    planIndex,
    summaryInventory,
    indexedPlan,
    dependencyPlans,
    missingDependencyPlans
  } = data;
  const prerequisiteData = resolved
    ? buildPhaseSummaryAuthoringPrerequisites({
        resolved,
        planId,
        planRead,
        planIndex,
        summaryInventory,
        indexedPlan,
        dependencyPlans,
        missingDependencyPlans
      })
    : null;
  const prerequisiteBlockers = prerequisiteData?.blockers ?? [
    located.reason ?? "Phase could not be resolved for summary authoring."
  ];
  const diagnostics: PhaseSummaryModelDiagnostic[] = prerequisiteBlockers.map((message) =>
    phaseSummaryDiagnostic({
      source: "scope",
      path: "phase.plan",
      code: "scope.prerequisite_blocker",
      message,
      context: { phase: resolved?.phaseNumber ?? null, planId },
      suggestion:
        "Repair the selected saved plan and dependency inventory before authoring phase.summary evidence."
    })
  );
  const hasContent = args.content !== undefined;
  const hasModel = args.model !== undefined;

  if (hasContent === hasModel) {
    diagnostics.push(
      phaseSummaryDiagnostic({
        source: "scope",
        path: "summary",
        code: "scope.input_mode",
        message: "Phase summary draft validation expects exactly one of Markdown content or legacy model.",
        context: { hasContent, hasModel },
        suggestion: "Pass Markdown content for the streamlined summary path."
      })
    );
  }

  let normalizedModel: PhaseSummaryStructuredModel | null = null;
  let renderPreview: string | null = null;
  const draftWarnings: string[] = [];

  if (hasContent && typeof args.content === "string") {
    renderPreview = normalizeTextContent(args.content);
  } else if (hasModel) {
    const modelObject = asJsonObject(args.model);

    if (!modelObject) {
      diagnostics.push(
        phaseSummaryDiagnostic({
          source: "schema",
          path: "model",
          code: "schema.type",
          message: "Legacy phase summary model must be a JSON object.",
          context: { receivedType: Array.isArray(args.model) ? "array" : typeof args.model },
          suggestion: "Pass Markdown content instead of a structured summary model."
        })
      );
    } else {
      normalizedModel = normalizePhaseSummaryModel(modelObject);

      if (!normalizedModel) {
        diagnostics.push(
          phaseSummaryDiagnostic({
            source: "schema",
            path: "model",
            code: "schema.legacy_shape",
            message: "Legacy phase summary model cannot be rendered as Markdown.",
            context: {},
            suggestion:
              "Pass Markdown content, or provide the legacy model fields needed for rendering."
          })
        );
      } else if (resolved && summaryPath) {
        const linkedPlanPath =
          planRead?.path ?? indexedPlan?.path ?? planPathFor(resolved, planId);
        renderPreview = renderPhaseSummaryModelContent({
          model: normalizedModel,
          resolved,
          planId,
          linkedPlanPath,
          summaryPath
        });
      }
    }
  }

  if (renderPreview && resolved && summaryPath) {
    const {
      linkedPlanPath,
      warnings: prerequisiteWarnings,
      completedDependencyPlanIds
    } = prerequisiteData ?? buildPhaseSummaryAuthoringPrerequisites({
      resolved,
      planId,
      planRead,
      planIndex,
      summaryInventory,
      indexedPlan,
      dependencyPlans,
      missingDependencyPlans
    });
    const statusMarker = extractSummaryMarkerValue(renderPreview, "Status");
    const status = extractSummaryStatus(renderPreview);

    if (!statusMarker) {
      diagnostics.push(
        phaseSummaryDiagnostic({
          source: "markdown",
          path: "content",
          code: "markdown.missing_status",
          message: "New phase summaries must include an explicit Status marker.",
          context: {},
          suggestion: "Add Status: COMPLETED, Status: PARTIAL, or Status: BLOCKED near the top of the summary."
        })
      );
    } else if (!status) {
      diagnostics.push(
        phaseSummaryDiagnostic({
          source: "markdown",
          path: "content",
          code: "markdown.invalid_status",
          message: "Phase summary Status marker must be COMPLETED, PARTIAL, or BLOCKED.",
          context: { status: statusMarker },
          suggestion: "Use one of the supported status values."
        })
      );
    }

    const validation = validateStrictSummaryArtifactContent(renderPreview, {
      linkedPlanPath,
      requirePlanMarker: true
    });
    const completedRoute = completedRouteAfterSelectedCompletion({
      phaseNumber: resolved.phaseNumber,
      planIds: planIndex?.plans.map((plan) => plan.planId) ?? [],
      completedPlanIds: completedDependencyPlanIds,
      selectedPlanId: planId
    });
    const livePlanValidation = validateSummaryAgainstLivePlanInventory(renderPreview, {
      resolved,
      planId,
      plan: indexedPlan,
      knownPlanIds: new Set(planIndex?.plans.map((plan) => plan.planId) ?? []),
      completedDependencyPlanIds,
      completedRouteValidation: {
        mode: "exact",
        route: completedRoute
      }
    });
    const markdownIssues = [...validation.issues, ...livePlanValidation.issues];
    draftWarnings.push(
      ...prerequisiteWarnings,
      ...validation.warnings,
      ...livePlanValidation.warnings
    );

    for (const issue of markdownIssues) {
      diagnostics.push(
        phaseSummaryDiagnostic({
          source: "markdown",
          path: "content",
          code: "markdown.invalid_render",
          message: issue,
          context: {},
          suggestion: phaseSummaryMarkdownIssueSuggestion(issue)
        })
      );
    }
  }

  return {
    status: diagnostics.length === 0 ? "valid" : "invalid",
    valid: diagnostics.length === 0,
    phase: resolved,
    planId,
    path: summaryPath,
    linkedPlanPath: resolved ? planRead?.path ?? indexedPlan?.path ?? planPathFor(resolved, planId) : null,
    schemaPath: null,
    taskSchema: null,
    diagnostics,
    diagnosticCounts: countPhaseSummaryDiagnostics(diagnostics),
    normalizedModel,
    renderPreview: diagnostics.length === 0 ? renderPreview : null,
    warnings: hasModel
      ? [
          ...(prerequisiteData?.warnings ?? []),
          ...draftWarnings,
          "phase.summary structured models are deprecated; Markdown content is now the primary summary authoring path."
        ]
      : [...(prerequisiteData?.warnings ?? []), ...draftWarnings]
  };
}

export async function blueprintPhaseSummaryRead(
  args: PhaseSummaryReadArgs
): Promise<PhaseSummaryReadResult> {
  const { projectRoot, located, resolved } = await resolveLocatedPhaseForRead(args);

  if (!resolved) {
    return {
      phaseFound: false,
      found: false,
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName,
      phaseDir: located.phaseDir,
      planId: null,
      path: null,
      content: null,
      metadata: null,
      validation: null,
      reason: located.reason
    };
  }

  const planId = normalizePlanId(args.planId);
  const pathValue = summaryPathFor(resolved, planId);
  const absolutePath = resolveBlueprintPath(projectRoot, pathValue);

  if (!(await pathExists(absolutePath))) {
    return {
      phaseFound: true,
      found: false,
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      planId,
      path: pathValue,
      content: null,
      metadata: null,
      validation: null,
      reason: `${pathValue} does not exist yet.`
    };
  }

  const { summaryInventory } = await loadResolvedPhaseSummaryContext({
    projectRoot,
    located,
    resolved,
    buildPhasePlanIndexFromLocated,
    validateSummaryAgainstLivePlanInventory
  });

  return phaseSummaryReadFromInventory({
    resolved,
    planId,
    inventory: summaryInventory,
    validateSummaryAgainstLivePlanInventory
  });
}

function formatExternalServicePrerequisiteReason(
  prerequisite: PhaseExecutionExternalServicePrerequisite
): string {
  return `${prerequisite.planId} (${prerequisite.planPath}) requires external service "${prerequisite.service}" [${prerequisite.category}] for ${prerequisite.purpose}. User setup/startup: ${prerequisite.userSetup}. Readiness check: ${prerequisite.readinessCheck}.`;
}

function selectedPlanExternalServicePrerequisites(
  plans: PhaseExecutionTargetPlan[]
): PhaseExecutionExternalServicePrerequisite[] {
  return plans.flatMap((plan) =>
    plan.externalServicePrerequisites.map((prerequisite) => ({
      ...prerequisite,
      planId: plan.planId,
      planPath: plan.path,
      wave: plan.wave
    }))
  );
}

export async function blueprintPhaseExecutionTargets(
  args: PhaseExecutionTargetsArgs = {}
): Promise<PhaseExecutionTargetsResult> {
  if (
    args.wave !== undefined &&
    (!Number.isInteger(args.wave) || args.wave < 1)
  ) {
    throw new Error("Wave must be a positive integer.");
  }

  const { projectRoot, located, resolved } = await resolveLocatedPhaseForRead(args);

  if (!resolved) {
    return {
      phaseFound: false,
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName,
      phaseDir: located.phaseDir,
      requestedWave: args.wave ?? null,
      gapsOnly: args.gapsOnly ?? false,
      includeConflicts: args.includeConflicts ?? true,
      pendingPlanIds: [],
      gapClosurePlans: [],
      candidatePlanIds: [],
      candidatePlanPaths: [],
      selectedPlanIds: [],
      selectedPlanPaths: [],
      selectedWave: args.wave ?? null,
      lowerWavePendingPlans: [],
      overwriteCandidatePlanIds: [],
      overlapPlanIds: [],
      candidatePlans: [],
      selectedPlans: [],
      overlapPlans: [],
      externalServicePreflight: {
        confirmationRequired: false,
        confirmed: args.externalServiceConfirmed ?? false,
        blocking: false,
        declaredPrerequisites: [],
        blockingPrerequisites: [],
        reasons: []
      },
      existingSummaries: [],
      blockers: {
        executionBlocked: true,
        reasons: located.reason ? [located.reason] : ["Phase could not be resolved."],
        invalidPlanIds: [],
        stalePlanIds: [],
        lowerWavePendingPlanIds: [],
        missingPlanPaths: [],
        planIndexWarnings: [],
        summaryIndexWarnings: located.reason ? [located.reason] : []
      },
      conflicts: null,
      warnings: located.reason ? [located.reason] : []
    };
  }

  const requestedWave = args.wave ?? null;
  const gapsOnly = args.gapsOnly ?? false;
  const includeConflicts = args.includeConflicts ?? true;
  const externalServiceConfirmed = args.externalServiceConfirmed ?? false;
  const [summaryContext, effectiveConfig] = await Promise.all([
    loadResolvedPhaseSummaryContext({
      projectRoot,
      located,
      resolved,
      buildPhasePlanIndexFromLocated,
      validateSummaryAgainstLivePlanInventory
    }),
    blueprintConfigGet({
      cwd: projectRoot,
      scope: "effective"
    })
  ]);
  const { planIndex, summaryInventory } = summaryContext;
  const summaryIndex = summaryInventory.summaryIndex;
  const alwaysConfirmExternalServices =
    effectiveConfig.config?.safety?.always_confirm_external_services === true;
  const pendingPlanIds = summaryIndex.pendingPlans;
  const pendingPlanIdSet = new Set(pendingPlanIds);
  const gapClosurePlanIdSet = new Set(planIndex.gapClosurePlans);
  const knownPlanIds = new Set(planIndex.plans.map((plan) => plan.planId));
  const executionPlans = planIndex.plans.map((plan) => {
    const summaryRead = phaseSummaryReadFromInventory({
      resolved,
      planId: plan.planId,
      inventory: summaryInventory,
      validateSummaryAgainstLivePlanInventory
    });
    const summary = {
      found: summaryRead.found,
      path: summaryRead.path ?? summaryPathFor(resolved, plan.planId),
      linkedPlanPath: summaryRead.metadata?.linkedPlanPath ?? null,
      status: summaryRead.metadata?.status ?? null,
      valid: summaryRead.validation?.valid ?? null,
      issues: summaryRead.validation?.issues ?? [],
      warnings: summaryRead.validation?.warnings ?? [],
      overwriteCandidate: summaryRead.found && pendingPlanIdSet.has(plan.planId)
    } satisfies PhaseExecutionTargetSummary;
    const missingDependencyPlans = collectMissingDependencyPlanPaths(
      plan.dependsOn,
      knownPlanIds,
      resolved
    );

    return {
      ...plan,
      missingDependencyPlans,
      summary
    } satisfies PhaseExecutionTargetPlan;
  });
  const planOrder = new Map(executionPlans.map((plan, index) => [plan.planId, index]));
  const planById = new Map(executionPlans.map((plan) => [plan.planId, plan]));

  let candidatePlanIds = executionPlans
    .map((plan) => plan.planId)
    .filter((planId) => pendingPlanIdSet.has(planId));

  if (gapsOnly) {
    candidatePlanIds = candidatePlanIds.filter((planId) => gapClosurePlanIdSet.has(planId));
  }

  if (requestedWave !== null) {
    candidatePlanIds = candidatePlanIds.filter(
      (planId) => planById.get(planId)?.wave === requestedWave
    );
  }

  const candidatePlans = candidatePlanIds
    .map((planId) => planById.get(planId))
    .filter((plan): plan is PhaseExecutionTargetPlan => plan !== undefined);
  const selectedWave =
    requestedWave ??
    candidatePlans
      .map((plan) => plan.wave)
      .filter((wave): wave is number => typeof wave === "number")
      .sort((left, right) => left - right)[0] ??
    null;
  const selectedPlans =
    requestedWave !== null || selectedWave === null
      ? candidatePlans
      : candidatePlans.filter((plan) => plan.wave === selectedWave);
  const lowerWavePendingPlans =
    selectedWave === null
      ? []
      : executionPlans.filter(
          (plan) =>
            pendingPlanIdSet.has(plan.planId) &&
            typeof plan.wave === "number" &&
            plan.wave < selectedWave
        );
  const invalidPlanIds = selectedPlans.filter((plan) => !plan.valid).map((plan) => plan.planId);
  const stalePlanIds = selectedPlans
    .filter((plan) => plan.missingDependencyPlans.length > 0)
    .map((plan) => plan.planId);
  const blockers: string[] = [];

  if (candidatePlans.length === 0) {
    if (requestedWave !== null && gapsOnly) {
      blockers.push(
        `No pending explicit gap-closure plans remain in wave ${requestedWave} for phase ${resolved.phaseNumber}.`
      );
    } else if (requestedWave !== null) {
      blockers.push(
        `No pending plans remain in wave ${requestedWave} for phase ${resolved.phaseNumber}.`
      );
    } else if (gapsOnly) {
      blockers.push(
        `No pending explicit gap-closure plans remain for phase ${resolved.phaseNumber}.`
      );
    } else {
      blockers.push(`No pending plans remain for phase ${resolved.phaseNumber}.`);
    }
  }

  if (lowerWavePendingPlans.length > 0 && selectedWave !== null) {
    blockers.push(
      `Lower-wave pending plans still block wave ${selectedWave}: ${lowerWavePendingPlans
        .map((plan) => `${plan.planId} (${plan.path})`)
        .join(", ")}.`
    );
  }

  if (invalidPlanIds.length > 0) {
    blockers.push(
      `Selected plans are invalid and must be repaired before execution: ${invalidPlanIds.join(", ")}.`
    );
  }

  if (stalePlanIds.length > 0) {
    blockers.push(
      `Selected plans are stale because dependency plan artifacts are missing: ${stalePlanIds.join(", ")}.`
    );
  }

  const declaredExternalServicePrerequisites =
    selectedPlanExternalServicePrerequisites(selectedPlans);
  const blockingExternalServicePrerequisites = declaredExternalServicePrerequisites.filter(
    (prerequisite) => !prerequisite.canAgentProceedWithoutIt
  );
  const externalServicePreflightReasons =
    alwaysConfirmExternalServices &&
    !externalServiceConfirmed &&
    blockingExternalServicePrerequisites.length > 0
      ? [
          `Selected plans declare blocking external-service prerequisites that must be confirmed before execution because safety.always_confirm_external_services is enabled for phase ${resolved.phaseNumber}.`,
          ...blockingExternalServicePrerequisites.map((prerequisite) =>
            formatExternalServicePrerequisiteReason(prerequisite)
          )
        ]
      : [];

  if (externalServicePreflightReasons.length > 0) {
    blockers.push(...externalServicePreflightReasons);
  }

  const pairConflicts: Array<{
    leftPlanId: string;
    rightPlanId: string;
    sharedSurfaces: PhaseExecutionTargetConflictSurface[];
    warning: string;
  }> = [];

  if (includeConflicts) {
    for (let leftIndex = 0; leftIndex < executionPlans.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < executionPlans.length; rightIndex += 1) {
        const left = executionPlans[leftIndex];
        const right = executionPlans[rightIndex];
        const sharedSurfaces = sharedExecutionSurfaces(left, right);

        if (sharedSurfaces.length === 0) {
          continue;
        }

        pairConflicts.push({
          leftPlanId: left.planId,
          rightPlanId: right.planId,
          sharedSurfaces,
          warning: `${left.path} and ${right.path} overlap on ${sharedSurfaces
            .map((surface) => `${surface.value} (${surface.kinds.join("/")})`)
            .join(", ")}.`
        });
      }
    }
  }

  const selectedPlanIdSet = new Set(selectedPlans.map((plan) => plan.planId));
  const parent = new Map<string, string>();
  const find = (planId: string): string => {
    const current = parent.get(planId) ?? planId;

    if (current === planId) {
      parent.set(planId, planId);
      return planId;
    }

    const root = find(current);
    parent.set(planId, root);
    return root;
  };
  const union = (left: string, right: string): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);

    if (leftRoot !== rightRoot) {
      parent.set(rightRoot, leftRoot);
    }
  };

  for (const pair of pairConflicts) {
    union(pair.leftPlanId, pair.rightPlanId);
  }

  const componentPairs = new Map<string, typeof pairConflicts>();

  for (const pair of pairConflicts) {
    const root = find(pair.leftPlanId);
    const entries = componentPairs.get(root) ?? [];
    entries.push(pair);
    componentPairs.set(root, entries);
  }

  const conflictGroups: PhaseExecutionTargetConflictGroup[] = [];

  for (const pairs of componentPairs.values()) {
    const componentPlanIds = uniqueSortedStrings(
      pairs.flatMap((pair) => [pair.leftPlanId, pair.rightPlanId])
    );

    if (!componentPlanIds.some((planId) => selectedPlanIdSet.has(planId))) {
      continue;
    }

    const sharedSurfaces = new Map<string, PhaseExecutionTargetConflictSurface>();

    for (const pair of pairs) {
      for (const surface of pair.sharedSurfaces) {
        const key = `${surface.value}:${surface.kinds.join(",")}`;

        if (!sharedSurfaces.has(key)) {
          sharedSurfaces.set(key, surface);
        }
      }
    }

    const componentPlans = componentPlanIds
      .map((planId) => planById.get(planId))
      .filter((plan): plan is PhaseExecutionTargetPlan => plan !== undefined)
      .sort((left, right) => (planOrder.get(left.planId) ?? 0) - (planOrder.get(right.planId) ?? 0));

    conflictGroups.push({
      planIds: componentPlans.map((plan) => plan.planId),
      planPaths: componentPlans.map((plan) => plan.path),
      selectedPlanIds: componentPlans
        .map((plan) => plan.planId)
        .filter((planId) => selectedPlanIdSet.has(planId)),
      sharedSurfaces: [...sharedSurfaces.values()].sort((left, right) =>
        left.value.localeCompare(right.value)
      ),
      existingSummaryPaths: componentPlans
        .filter((plan) => plan.summary.found)
        .map((plan) => plan.summary.path),
      warnings: uniqueSortedStrings(pairs.map((pair) => pair.warning))
    });
  }

  const overlapPlanIds = uniqueSortedStrings(
    conflictGroups.flatMap((group) =>
      group.planIds.filter((planId) => !selectedPlanIdSet.has(planId))
    )
  );
  const overlapPlans = overlapPlanIds
    .map((planId) => planById.get(planId))
    .filter((plan): plan is PhaseExecutionTargetPlan => plan !== undefined)
    .sort((left, right) => (planOrder.get(left.planId) ?? 0) - (planOrder.get(right.planId) ?? 0));
  const existingSummaryPlanIds = uniqueSortedStrings([
    ...candidatePlanIds,
    ...overlapPlanIds
  ]).filter((planId) => planById.get(planId)?.summary.found === true);
  const existingSummaries = existingSummaryPlanIds
    .map((planId) => {
      const plan = planById.get(planId);

      if (!plan) {
        return null;
      }

      return {
        planId,
        path: plan.summary.path,
        linkedPlanPath: plan.summary.linkedPlanPath,
        status: plan.summary.status,
        valid: plan.summary.valid,
        issues: plan.summary.issues,
        warnings: plan.summary.warnings,
        overwriteCandidate: plan.summary.overwriteCandidate
      };
    })
    .filter(
      (
        summary
      ): summary is PhaseExecutionTargetsResult["existingSummaries"][number] => summary !== null
    );
  const warnings = uniqueSortedStrings([
    ...planIndex.warnings,
    ...summaryIndex.warnings,
    ...blockers,
    ...conflictGroups.flatMap((group) => group.warnings)
  ]);

  return {
    phaseFound: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    requestedWave,
    gapsOnly,
    includeConflicts,
    pendingPlanIds,
    gapClosurePlans: planIndex.gapClosurePlans,
    candidatePlanIds,
    candidatePlanPaths: candidatePlans.map((plan) => plan.path),
    selectedPlanIds: selectedPlans.map((plan) => plan.planId),
    selectedPlanPaths: selectedPlans.map((plan) => plan.path),
    selectedWave,
    lowerWavePendingPlans: lowerWavePendingPlans.map((plan) => ({
      planId: plan.planId,
      path: plan.path,
      wave: plan.wave
    })),
    overwriteCandidatePlanIds: candidatePlans
      .filter((plan) => plan.summary.overwriteCandidate)
      .map((plan) => plan.planId),
    overlapPlanIds,
    candidatePlans,
    selectedPlans,
    overlapPlans,
    externalServicePreflight: {
      confirmationRequired:
        alwaysConfirmExternalServices && blockingExternalServicePrerequisites.length > 0,
      confirmed: externalServiceConfirmed,
      blocking: externalServicePreflightReasons.length > 0,
      declaredPrerequisites: declaredExternalServicePrerequisites,
      blockingPrerequisites: blockingExternalServicePrerequisites,
      reasons: externalServicePreflightReasons
    },
    existingSummaries,
    blockers: {
      executionBlocked: blockers.length > 0,
      reasons: blockers,
      invalidPlanIds,
      stalePlanIds,
      lowerWavePendingPlanIds: lowerWavePendingPlans.map((plan) => plan.planId),
      missingPlanPaths: uniqueSortedStrings(
        selectedPlans.flatMap((plan) => plan.missingDependencyPlans)
      ),
      planIndexWarnings: planIndex.warnings,
      summaryIndexWarnings: summaryIndex.warnings
    },
    conflicts: includeConflicts
      ? {
          groups: conflictGroups,
          warnings: uniqueSortedStrings(conflictGroups.flatMap((group) => group.warnings))
        }
      : null,
    warnings
  };
}

export async function blueprintPhaseSummaryWrite(
  args: PhaseSummaryWriteArgs
): Promise<PhaseSummaryWriteResult> {
  const projectRootForLock = await ensureRepoRoot(args.cwd);
  const data = await resolvePhaseSummaryAuthoringData({
    ...args,
    cwd: projectRootForLock
  });
  if (!data.resolved) {
    throw new Error(data.located.reason ?? "Phase could not be resolved for a deterministic write.");
  }
  const { projectRoot, resolved } = data;
  const {
    matchedPhase,
    planId,
    summaryPath,
    planRead,
    planIndex,
    summaryInventory,
    indexedPlan,
    knownPlanIds,
    dependencyPlans,
    missingDependencyPlans
  } = data;
  const pathValue = summaryPath ?? summaryPathFor(resolved, planId);
  const expectedTopology = phaseTopologyFingerprintFromLocation(resolved, matchedPhase);
  const prerequisites = buildPhaseSummaryAuthoringPrerequisites({
    resolved,
    planId,
    planRead,
    planIndex,
    summaryInventory,
    indexedPlan,
    dependencyPlans,
    missingDependencyPlans
  });
  const plan = planRead;

  if (!plan || !plan.found || !plan.path) {
    throw new Error(
      `${plan?.path ?? prerequisites.linkedPlanPath} does not exist yet. Create the matching plan before writing a summary.`
    );
  }

  if (!plan.validation?.valid) {
    const planIssues = plan.validation?.issues.length
      ? plan.validation.issues
      : ["Linked plan artifact is invalid and must be repaired before execution can be summarized."];

    return {
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      planId,
      path: pathValue,
      linkedPlanPath: plan.path,
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      issues: planIssues.map((issue) => `${plan.path}: ${issue}`),
      warnings: plan.validation?.warnings ?? []
    };
  }
  const linkedPlanPath = plan.path ?? prerequisites.linkedPlanPath;
  const expectedLinkedPlanHash = plan.content === null ? null : hashString(plan.content);

  if (missingDependencyPlans.length > 0) {
    return {
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      planId,
      path: pathValue,
      linkedPlanPath,
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      issues: [
        `${linkedPlanPath}: linked plan is missing dependency plan artifacts: ${missingDependencyPlans.join(", ")}`
      ],
      warnings: plan.validation?.warnings ?? []
    };
  }

  const hasContent = args.content !== undefined;
  const hasModel = args.model !== undefined;

  if (hasContent === hasModel) {
    return {
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      planId,
      path: pathValue,
      linkedPlanPath,
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      issues: [
        "Phase summary writes must supply exactly one of Markdown content or legacy model."
      ],
      warnings: []
    };
  }

  let normalizedContent: string;
  const modelWarnings: string[] = [];

  if (hasContent && typeof args.content === "string") {
    normalizedContent = normalizeTextContent(args.content);
  } else {
    const modelObject = asJsonObject(args.model);

    if (!modelObject) {
      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        planId,
        path: pathValue,
        linkedPlanPath,
        written: false,
        created: false,
        overwritten: false,
        status: "invalid",
        issues: [
          formatPhaseSummaryDiagnostic(
            phaseSummaryDiagnostic({
              source: "schema",
              path: "model",
              code: "schema.type",
              message: "Legacy phase summary model must be a JSON object.",
              context: {
                receivedType: Array.isArray(args.model) ? "array" : typeof args.model
              },
              suggestion: "Pass Markdown content instead of a structured summary model."
            })
          )
        ],
        warnings: [
          ...prerequisites.warnings,
          "phase.summary structured models are deprecated; Markdown content is now the primary summary authoring path."
        ]
      };
    }

    const normalizedModel = normalizePhaseSummaryModel(modelObject);

    if (!normalizedModel) {
      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        planId,
        path: pathValue,
        linkedPlanPath,
        written: false,
        created: false,
        overwritten: false,
        status: "invalid",
        issues: [
          formatPhaseSummaryDiagnostic(
            phaseSummaryDiagnostic({
              source: "schema",
              path: "model",
              code: "schema.legacy_shape",
              message: "Legacy phase summary model cannot be rendered as Markdown.",
              context: {},
              suggestion:
                "Pass Markdown content, or provide the legacy model fields needed for rendering."
            })
          )
        ],
        warnings: [
          ...prerequisites.warnings,
          "phase.summary structured models are deprecated; Markdown content is now the primary summary authoring path."
        ]
      };
    }

    normalizedContent = normalizeTextContent(
      renderPhaseSummaryModelContent({
        model: normalizedModel,
        resolved,
        planId,
        linkedPlanPath,
        summaryPath: pathValue
      })
    );
    modelWarnings.push(
      ...prerequisites.warnings,
      "phase.summary structured models are deprecated; Markdown content is now the primary summary authoring path."
    );
  }

  const statusMarker = extractSummaryMarkerValue(normalizedContent, "Status");
  const summaryStatus = extractSummaryStatus(normalizedContent);
  const writeModeIssues: string[] = [];

  if (!statusMarker) {
    writeModeIssues.push("New phase summaries must include an explicit Status marker.");
  } else if (!summaryStatus) {
    writeModeIssues.push("Phase summary Status marker must be COMPLETED, PARTIAL, or BLOCKED.");
  }

  if (summaryStatus === "COMPLETED" && prerequisites.unsatisfiedDependencyPlans.length > 0) {
    writeModeIssues.push(
      `${linkedPlanPath}: depends on incomplete execution plan(s): ${prerequisites.unsatisfiedDependencyPlans
        .map((dependency) => `${dependency.planId} (${dependency.path})`)
        .join(", ")}. Do not use Status: COMPLETED yet. Use Status: PARTIAL or Status: BLOCKED, update Readiness, Completion State, Next Safe Action, Verification, Gap / Repair Routes, and Follow-Ups to match, and keep the dependency blocker explicit until those dependency summaries exist.`
    );
  }

  if (writeModeIssues.length > 0) {
    return {
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      planId,
      path: pathValue,
      linkedPlanPath,
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      issues: writeModeIssues,
      warnings: [
        ...modelWarnings,
        ...(plan.validation?.warnings ?? []),
        ...(summaryInventory?.summaryIndex.warnings ?? [])
      ]
    };
  }

  const strictValidation = validateStrictSummaryArtifactContent(normalizedContent, {
    linkedPlanPath,
    requirePlanMarker: true
  });
  const completedRoute = completedRouteAfterSelectedCompletion({
    phaseNumber: resolved.phaseNumber,
    planIds: planIndex?.plans.map((candidate) => candidate.planId) ?? [],
    completedPlanIds: prerequisites.completedDependencyPlanIds,
    selectedPlanId: planId
  });
  const livePlanValidation = validateSummaryAgainstLivePlanInventory(normalizedContent, {
    resolved,
    planId,
    plan: indexedPlan,
    knownPlanIds,
    completedDependencyPlanIds: prerequisites.completedDependencyPlanIds,
    completedRouteValidation: {
      mode: "exact",
      route: completedRoute
    }
  });
  const validation = {
    valid: strictValidation.valid && livePlanValidation.valid,
    issues: [...strictValidation.issues, ...livePlanValidation.issues],
    warnings: [...strictValidation.warnings, ...livePlanValidation.warnings]
  };
  const issues =
    normalizedContent.trim().length === 0
      ? ["Execution summary content must not be empty."]
      : validation.issues;
  const warnings = [...validation.warnings];

  if (!validation.valid) {
    return {
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      planId,
      path: pathValue,
      linkedPlanPath,
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      issues: issues.map(formatPhaseSummaryWriteIssue),
      warnings: [...modelWarnings, ...warnings]
    };
  }

  return withBlueprintRepoLock(projectRoot, PHASE_TOPOLOGY_LOCK_NAME, async () =>
    withBlueprintRepoLock(projectRoot, "phase-plan-write", async () => {
      const resolvedPhaseDirectory = resolveBlueprintPath(projectRoot, resolved.phaseDir);

      if (!(await pathExists(resolvedPhaseDirectory))) {
        assertFreshPhaseTopology({
          operation: "Phase summary write",
          expected: expectedTopology,
          resolved: {
            ...resolved,
            phaseDir: `${resolved.phaseDir} (missing)`
          },
          matchedPhase
        });
      }

      assertFreshPhaseTopology({
        operation: "Phase summary write",
        expected: expectedTopology,
        resolved,
        matchedPhase
      });
      const lockedPlan = await readPhasePlanFromResolved({
        projectRoot,
        resolved,
        planId
      });
      const lockedPlanHash = lockedPlan.content === null ? null : hashString(lockedPlan.content);

      if (
        !lockedPlan.found ||
        !lockedPlan.path ||
        lockedPlan.path !== linkedPlanPath ||
        lockedPlanHash !== expectedLinkedPlanHash
      ) {
        return {
          phaseNumber: resolved.phaseNumber,
          phasePrefix: resolved.phasePrefix,
          phaseName: resolved.phaseName,
          phaseDir: resolved.phaseDir,
          planId,
          path: summaryPathFor(resolved, planId),
          linkedPlanPath,
          written: false,
          created: false,
          overwritten: false,
          status: "invalid",
          issues: [
            `${linkedPlanPath}: linked plan changed since summary authoring context was read. Re-read blueprint_phase_summary_authoring_context and retry before writing the summary.`
          ],
          warnings: [...modelWarnings, ...warnings]
        };
      }

      const lockedPathValue = summaryPathFor(resolved, planId);
      const absolutePath = resolveBlueprintPath(projectRoot, lockedPathValue);
      const exists = await pathExists(absolutePath);

  if (exists) {
    const existingContent = await fs.readFile(absolutePath, "utf8");

    if (existingContent === normalizedContent) {
      warnings.push(`Preserved existing summary artifact because the content was unchanged.`);

      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        planId,
        path: lockedPathValue,
        linkedPlanPath,
        written: false,
        created: false,
        overwritten: false,
        status: "reused",
        issues,
        warnings: [...modelWarnings, ...warnings]
      };
    }

	    if (!(args.overwrite ?? false)) {
	      throw new Error(
	        `${lockedPathValue} already exists. Re-run only after explicit overwrite confirmation.`
	      );
	    }
  }

	  warnings.push(
	    ...await writeTextFile(absolutePath, normalizedContent, {
	      label: lockedPathValue
	    })
	  );

  if (exists) {
    warnings.push(`Replaced existing summary artifact: ${lockedPathValue}`);
  }

  return {
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    planId,
    path: lockedPathValue,
    linkedPlanPath,
    written: true,
    created: !exists,
    overwritten: exists,
    status: exists ? "updated" : "created",
    issues,
    warnings: [...modelWarnings, ...warnings]
  };
    })
  );
}

export const phaseToolDefinitions = [
  {
    name: "blueprint_roadmap_read",
    description:
      "Read the Blueprint roadmap and resolve milestone plus phase inventory without mutating repo state.",
    inputSchema: roadmapReadInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintRoadmapRead(args as RoadmapReadArgs)
  },
  {
    name: "blueprint_roadmap_add_phase",
    description:
      "Append a new integer phase to the active Blueprint roadmap with durable requirement IDs, ignoring decimal insertions when choosing the next phase number.",
    inputSchema: roadmapAddPhaseInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintRoadmapAddPhase(args as RoadmapAddPhaseArgs)
  },
  {
    name: "blueprint_roadmap_insert_phase",
    description:
      "Insert the next decimal Blueprint phase after an existing integer phase and derive the matching phase directory path without renumbering later phases.",
    inputSchema: roadmapInsertPhaseInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintRoadmapInsertPhase(args as RoadmapInsertPhaseArgs)
  },
  {
    name: "blueprint_roadmap_remove_phase",
    description:
      "Remove a future Blueprint phase, delete its phase directory, and renumber subsequent phase directories plus roadmap references.",
    inputSchema: roadmapRemovePhaseInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintRoadmapRemovePhase(args as RoadmapRemovePhaseArgs)
  },
  {
    name: "blueprint_roadmap_promote_backlog",
    description:
      "Preview or promote selected backlog items into appended roadmap phases while reusing reserved 999.x phase stubs when available.",
    inputSchema: roadmapPromoteBacklogInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintRoadmapPromoteBacklog(args as RoadmapPromoteBacklogArgs)
  },
  {
    name: "blueprint_phase_locate",
    description:
      "Resolve a Blueprint phase reference to its phase directory and known artifacts.",
    inputSchema: phaseLookupInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseLocate(args as PhaseLookupArgs)
  },
  {
    name: "blueprint_phase_context",
    description:
      "Summarize a Blueprint phase's roadmap slice, durable discovery artifacts, mapped codebase context, and requirement grounding.",
    inputSchema: phaseLookupInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseContext(args as PhaseLookupArgs)
  },
  {
    name: "blueprint_phase_research_status",
    description:
      "Report whether a Blueprint phase already has context, research, and UI-spec artifacts, and whether each saved input is currently usable for planning.",
    inputSchema: phaseLookupInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseResearchStatus(args as PhaseLookupArgs)
  },
  {
    name: "blueprint_phase_plan_index",
    description:
      "Index phase plan artifacts, dependency waves, and missing plan prerequisites without mutating repo state.",
    inputSchema: phasePlanInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhasePlanIndex(args as PlanIndexArgs)
  },
  {
    name: "blueprint_phase_execution_targets",
    description:
      "Resolve deterministic execute-phase targets, lower-wave blockers, overwrite candidates, and overlap warnings without mutating repo state.",
    inputSchema: phaseExecutionTargetsInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseExecutionTargets(args as PhaseExecutionTargetsArgs)
  },
  {
    name: "blueprint_phase_artifact_read",
    description:
      "Read a phase-scoped discovery artifact such as CONTEXT, DISCUSSION-LOG, RESEARCH, SPEC, or UI-SPEC.",
    inputSchema: phaseArtifactInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseArtifactRead(args as PhaseArtifactReadArgs)
  },
  {
    name: "blueprint_phase_artifact_scaffold",
    description:
      "Seed a phase-scoped discovery artifact placeholder, including SPEC, from the resolved numeric phase and artifact enum.",
    inputSchema: phaseArtifactScaffoldInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseArtifactScaffold(args as PhaseArtifactScaffoldArgs)
  },
  {
    name: "blueprint_phase_artifact_write",
    description:
      "Persist substantive phase-scoped discovery artifacts, including SPEC, with overwrite protection; phase.context is model-only and rendered by MCP.",
    inputSchema: phaseArtifactWriteInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseArtifactWrite(args as PhaseArtifactWriteArgs)
  },
  {
    name: "blueprint_phase_ui_skip_write",
    description:
      "Persist the minimal explicit skip-rationale form of XX-UI-SPEC.md from a phase and skipRationale string without requiring the full UI-contract scaffold.",
    inputSchema: phaseUiSkipWriteInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseUiSkipWrite(args as PhaseUiSkipWriteArgs)
  },
  {
    name: "blueprint_phase_validation_read",
    description:
      "Read a phase-scoped validation artifact such as VERIFICATION or UAT together with execution-summary coverage.",
    inputSchema: phaseValidationArtifactInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseValidationRead(args as PhaseValidationReadArgs)
  },
  {
    name: "blueprint_phase_validation_authoring_context",
    description:
      "Read phase validation authoring inputs, canonical contract metadata, summary evidence, existing baselines, and prerequisite blockers without mutating state.",
    inputSchema: phaseValidationAuthoringContextInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseValidationAuthoringContext(args as PhaseValidationAuthoringContextArgs)
  },
  {
    name: "blueprint_phase_validation_render",
    description:
      "Render canonical VERIFICATION or UAT markdown from structured validation evidence and validate it without writing files.",
    inputSchema: phaseValidationRenderInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseValidationRender(args as PhaseValidationRenderArgs)
  },
  {
    name: "blueprint_phase_validation_validate_model",
    description:
      "Validate a structured phase.verification or phase.uat model against the runtime task schema and return a canonical render preview without writing files.",
    inputSchema: phaseValidationValidateModelInputSchema,
    handler: async (args: Record<string, unknown>) =>
      trimPhaseValidationStandaloneValidateModelResult(
        await blueprintPhaseValidationValidateModel(args as PhaseValidationValidateModelArgs)
      )
  },
  {
    name: "blueprint_phase_validation_write",
    description:
      "Persist a phase-scoped VERIFICATION or UAT artifact from canonical markdown content or a structured model with overwrite protection and execution-aware prerequisite checks.",
    inputSchema: phaseValidationWriteInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseValidationWrite(args as PhaseValidationWriteArgs)
  },
  {
    name: "blueprint_phase_plan_read",
    description:
      "Read a phase-scoped PLAN artifact together with parsed metadata and validation signals.",
    inputSchema: phasePlanReadInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhasePlanRead(args as PhasePlanReadArgs)
  },
  {
    name: "blueprint_phase_plan_validate",
    description:
      "Validate the full saved PLAN set for one phase, including dependency coherence, plan-slot consistency, and roadmap coverage.",
    inputSchema: phasePlanValidateInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhasePlanValidate(args as PhasePlanValidateArgs)
  },
  {
    name: "blueprint_phase_plan_authoring_context",
    description:
      "Return the schema-first phase.plan authoring context, including the base model schema and runtime-narrowed task schema for the selected phase and plan slot.",
    inputSchema: phasePlanAuthoringContextInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhasePlanAuthoringContext(args as PhasePlanAuthoringContextArgs)
  },
  {
    name: "blueprint_phase_plan_readiness",
    description:
      "Read a compact, read-only /blu-plan-phase readiness packet with phase context, config-aware gates, plan index, schema authority, evidence hashes, and read-set freshness metadata.",
    inputSchema: phasePlanReadinessInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhasePlanReadiness(args as PhasePlanReadinessArgs)
  },
  {
    name: "blueprint_phase_plan_validate_model",
    description:
      "Validate a structured phase.plan model against the runtime-narrowed task schema and return a canonical PLAN markdown preview without writing files.",
    inputSchema: phasePlanValidateModelInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhasePlanValidateModel(args as PhasePlanValidateModelArgs)
  },
  {
    name: "blueprint_phase_plan_write",
    description:
      "Persist a phase-scoped PLAN artifact from canonical markdown content or a structured phase.plan model with overwrite protection and validation.",
    inputSchema: phasePlanWriteInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhasePlanWrite(args as PhasePlanWriteArgs)
  },
  {
    name: "blueprint_phase_summary_index",
    description:
      "Index phase SUMMARY artifacts and report which plans still need execution summaries.",
    inputSchema: phasePlanInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseSummaryIndex(args as PlanIndexArgs)
  },
  {
    name: "blueprint_phase_summary_read",
    description:
      "Read a phase-scoped SUMMARY artifact together with its linked plan path, concise metadata, and validation signal.",
    inputSchema: phaseSummaryReadInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseSummaryRead(args as PhaseSummaryReadArgs)
  },
  {
    name: "blueprint_phase_summary_authoring_context",
    description:
      "Return Markdown-first phase.summary authoring context for the selected plan, including linked plan, dependency, acceptance, existing-summary, and allowed next-action guidance.",
    inputSchema: phaseSummaryAuthoringContextInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseSummaryAuthoringContext(args as PhaseSummaryAuthoringContextArgs)
  },
  {
    name: "blueprint_phase_summary_validate_model",
    description:
      "Validate Markdown phase.summary draft content, or render a legacy structured model, and return semantic diagnostics plus a SUMMARY preview without writing files.",
    inputSchema: phaseSummaryValidateModelInputSchema,
    handler: async (args: Record<string, unknown>) =>
      trimPhaseSummaryStandaloneValidateModelResult(
        await blueprintPhaseSummaryValidateModel(args as PhaseSummaryValidateModelArgs)
      )
  },
  {
    name: "blueprint_phase_summary_write",
    description:
      "Persist a phase-scoped SUMMARY artifact from Markdown content for an existing plan with overwrite protection and semantic completion checks.",
    inputSchema: phaseSummaryWriteInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseSummaryWrite(args as PhaseSummaryWriteArgs)
  },
  {
    name: "blueprint_phase_checkpoint_get",
    description:
      "Read the saved phase continuation checkpoint and report whether it is safe for the expected command/mode to resume.",
    inputSchema: phaseCheckpointGetInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseCheckpointGet(args as PhaseCheckpointGetArgs)
  },
  {
    name: "blueprint_phase_checkpoint_put",
    description:
      "Persist an owned phase continuation checkpoint JSON object using the richer resumability contract.",
    inputSchema: phaseCheckpointPutInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseCheckpointPut(args as PhaseCheckpointPutArgs)
  },
  {
    name: "blueprint_phase_checkpoint_delete",
    description:
      "Delete the saved phase continuation checkpoint for a phase, optionally guarding on the expected command owner and resume mode.",
    inputSchema: phaseCheckpointDeleteInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseCheckpointDelete(args as PhaseCheckpointDeleteArgs)
  }
];
