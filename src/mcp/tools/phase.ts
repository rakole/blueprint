import { promises as fs } from "node:fs";
import path from "node:path";

import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import * as z from "zod/v4";

import {
  readArtifactContract,
  type ArtifactContractReadResult
} from "../artifact-contracts/index.js";
import { blueprintDirectCommand } from "../command-paths.js";
import {
  isBootstrapStarterContext,
  isScaffoldGeneratedArtifact,
  CODEBASE_ARTIFACTS,
  BLUEPRINT_BACKLOG_INDEX_PATH,
  BLUEPRINT_DIR,
  BLUEPRINT_PHASES_PATH,
  DURABLE_REQUIREMENT_ID_PATTERN,
  type PhaseArtifactValidationDiagnostic,
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
import { evaluatePhaseQualityGates } from "./quality-gates.js";
import {
  basePhaseNumber,
  comparePhaseNumbers,
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
  PHASE_CHECKPOINT_OWNER_MODES,
  checkpointExpectedOwnerFromMode,
  checkpointOwnershipBlockerReason,
  ensureCheckpointForPersistence,
  ensureCheckpointObject,
  evaluateCheckpointResumeSafety,
  phaseCheckpointOwnerCommandSchema,
  phaseCheckpointResumeModeSchema,
  phaseCheckpointWriteSchema,
  type PhaseCheckpointOwnerCommand,
  type PhaseCheckpointRecord,
  type PhaseCheckpointResumeMode,
  type PhaseCheckpointWriteRecord
} from "./phase-checkpoint-records.js";
import {
  extractMarkdownHeading,
  extractMarkdownSection,
  markdownCell,
  markdownTableCell,
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
  parsePlanArtifactPath,
  planPathFor,
  reconcileAutoAssignedPlanContent
} from "./phase-plan-identifiers.js";

type RoadmapReadArgs = {
  cwd?: string;
};

type AuditBackedGapCategory = "requirement" | "integration" | "flow" | "optional";

type AuditBackedGapRow = {
  gapId: string;
  surface: string;
  evidence: string;
  repair: string;
};

type AuditBackedGapGroup = {
  category: AuditBackedGapCategory;
  rows: AuditBackedGapRow[];
};

type RoadmapAuditBackedDetails = {
  sourceReportPath?: string;
  goal?: string;
  successCriteria?: string;
  repairRequirementIds?: string[];
  gapGroups?: AuditBackedGapGroup[];
};

type RoadmapAddPhaseArgs = {
  cwd?: string;
  description: string;
  expectedPhaseNumber?: string;
  auditBackedDetails?: RoadmapAuditBackedDetails;
};

type RoadmapInsertPhaseArgs = {
  cwd?: string;
  after: NumericInput;
  description: string;
};

type RoadmapRemovePhaseArgs = {
  cwd?: string;
  phase: NumericInput;
  force?: boolean;
};

type RoadmapPromoteBacklogArgs = {
  cwd?: string;
  backlogIds?: string[];
  previewOnly?: boolean;
};

type PhaseLookupArgs = {
  cwd?: string;
  phase?: NumericInput;
};

type PhaseArtifactKind = "context" | "discussion-log" | "research" | "ui-spec";
type PhaseValidationArtifactKind = "verification" | "uat";

type PlanIndexArgs = PhaseLookupArgs;

type PhaseArtifactReadArgs = PhaseLookupArgs & {
  artifact: PhaseArtifactKind;
};

type PhaseArtifactWriteArgs = PhaseLookupArgs & {
  artifact: PhaseArtifactKind;
  content?: string;
  model?: Record<string, unknown>;
  overwrite?: boolean;
  validationMode?: "strict" | "warn";
};

type PhaseContextStructuredModel = {
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

type PhaseValidationReadArgs = PhaseLookupArgs & {
  artifact: PhaseValidationArtifactKind;
};

type PhaseValidationWriteArgs = PhaseLookupArgs & {
  artifact: PhaseValidationArtifactKind;
  content?: string;
  model?: Record<string, unknown>;
  authoringMode?: "content-compatible" | "model-only";
  overwrite?: boolean;
};

type PhaseValidationAuthoringContextArgs = PhaseLookupArgs & {
  artifact: PhaseValidationArtifactKind;
};

type PhaseValidationSummaryEvidence = {
  planId: string;
  path: string;
  linkedPlanPath: string | null;
  status: "COMPLETED";
  title: string | null;
  summary: string | null;
  outcome: string[];
  changesMade: string[];
  verification: string[];
  followUps: string[];
  evidence: string[];
};

type PhaseValidationAllowedValues = {
  verification: {
    gateStates: string[];
    coverageStates: string[];
    manualCoverageStatuses: string[];
    gapClasses: string[];
    readinessByGate: Record<string, string>;
    readyForUatCommand: string;
    repairCommands: string[];
  };
  uat: {
    statuses: string[];
    resumeStates: string[];
    completeCheckpoint: string;
    testResults: string[];
    structuredGapStatuses: string[];
    structuredGapSeverities: string[];
  };
};

type PhaseValidationAuthoringContextResult = {
  status: "ready" | "invalid";
  phaseFound: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  artifact: PhaseValidationArtifactKind;
  path: string | null;
  contract: ArtifactContractReadResult;
  summaryPaths: string[];
  summaryEvidence: PhaseValidationSummaryEvidence[];
  existing: PhaseValidationReadResult | null;
  verification: PhaseValidationReadResult | null;
  prerequisiteBlockers: string[];
  readyForDraft: boolean;
  schemaPath: string | null;
  baseSchema: Record<string, unknown> | null;
  taskSchema: Record<string, unknown> | null;
  allowedValues: PhaseValidationAllowedValues;
  routingRules: string[];
  warnings: string[];
  reason: string | null;
};

type VerificationRenderCoverageRow = {
  requirement?: string;
  taskOrCheck?: string;
  evidence?: string;
  coverageState?: string;
  notes?: string;
};

type VerificationManualCoverageRow = {
  item?: string;
  whyManualOrDeferred?: string;
  followUp?: string;
  status?: string;
};

type VerificationGapClassificationRow = {
  gapClass?: string;
  scope?: string;
  evidence?: string;
  repair?: string;
};

type VerificationCoverageState =
  | "PASS"
  | "COVERED"
  | "MANUAL"
  | "DEFERRED"
  | "BLOCKED";

type VerificationTestMatrixRow = {
  number?: string;
  test?: string;
  expectedBehavior?: string;
  evidence?: string;
  result?: "pending" | "pass" | "issue" | "skipped" | "blocked";
  notes?: string;
};

type VerificationResultSummary = {
  total?: number;
  passed?: number;
  issues?: number;
  pending?: number;
  skipped?: number;
  blocked?: number;
};

type VerificationStructuredGapRow = {
  test?: string;
  truth?: string;
  status?: "failed" | "partial" | "blocked" | "none";
  severity?: "blocker" | "major" | "minor" | "cosmetic" | "none";
  reason?: string;
  followUp?: string;
};

type VerificationRenderArgs = PhaseLookupArgs & {
  artifact: "verification";
  coverageSummary?: string;
  status?: string;
  gateState?: string;
  signOff?: string;
  validationSummary?: string | string[];
  requirementCoverage?: VerificationRenderCoverageRow[];
  evidenceReviewedSummaryPaths?: string[];
  evidenceMetadata?: string[];
  manualOrDeferredCoverage?: VerificationManualCoverageRow[];
  gapClassification?: VerificationGapClassificationRow[];
  gapsFound?: string[];
  suggestedRepairs?: string[];
  sessionState?: string[];
  checkpoint?: string;
  testMatrix?: VerificationTestMatrixRow[];
  resultSummary?: VerificationResultSummary;
  observedBehavior?: string[];
  unresolvedGaps?: string[];
  structuredGaps?: VerificationStructuredGapRow[];
  followUpFixes?: string[];
  nextSafeAction?: string;
};

type PhaseVerificationStructuredModel = {
  coverageSummary: string;
  status: "PASS" | "PARTIAL" | "BLOCKED";
  gateState: "PASS" | "PARTIAL" | "BLOCKED";
  signOff: string;
  validationSummary: string | string[];
  requirementCoverage: Array<{
    requirement: string;
    taskOrCheck: string;
    evidence: string;
    coverageState: VerificationCoverageState | "covered";
    notes: string;
  }>;
  evidenceReviewedSummaryPaths: string[];
  evidenceMetadata: string[];
  manualOrDeferredCoverage: Array<{
    item: string;
    whyManualOrDeferred: string;
    followUp: string;
    status: "MANUAL" | "DEFERRED" | "NONE";
  }>;
  gapClassification: Array<{
    gapClass:
      | "missing-evidence"
      | "partial-coverage"
      | "manual-only"
      | "deferred-test"
      | "contradiction"
      | "none";
    scope: string;
    evidence: string;
    repair: string;
  }>;
  gapsFound: string[];
  suggestedRepairs: string[];
  sessionState?: string[];
  checkpoint?: string;
  testMatrix?: Array<Required<VerificationTestMatrixRow>>;
  resultSummary?: Required<VerificationResultSummary>;
  observedBehavior?: string[];
  unresolvedGaps?: string[];
  structuredGaps?: Array<Required<VerificationStructuredGapRow>>;
  followUpFixes?: string[];
  nextSafeAction: string;
};

type PhaseUatStructuredModel = {
  status: "PASS" | "FAIL" | "PARTIAL";
  resumeState: "RESUMED" | "NEW" | "CONTINUED";
  checkpoint: string;
  uatSummary: string[];
  sessionState: string[];
  currentTest: {
    number: string;
    name: string;
    expected: string;
    awaiting: string;
  };
  testMatrix: Array<{
    number: string;
    test: string;
    expectedBehavior: string;
    evidence: string;
    result: "pending" | "pass" | "issue" | "skipped" | "blocked";
    notes: string;
  }>;
  resultSummary: {
    total: number;
    passed: number;
    issues: number;
    pending: number;
    skipped: number;
    blocked: number;
  };
  questionsAsked: string[];
  observedBehavior: string[];
  unresolvedGaps: string[];
  structuredGaps: Array<{
    test: string;
    truth: string;
    status: "failed" | "partial" | "blocked" | "none";
    severity: "blocker" | "major" | "minor" | "cosmetic" | "none";
    reason: string;
    followUp: string;
  }>;
  followUpFixes: string[];
  nextSafeAction: string;
};

type PhaseValidationDiagnosticSource = "scope" | "schema" | "residual" | "markdown";

type PhaseValidationModelDiagnostic = {
  source: PhaseValidationDiagnosticSource;
  path: string;
  code: string;
  message: string;
  context: Record<string, unknown>;
  suggestion: string;
};

type PhaseValidationValidateModelArgs = PhaseValidationAuthoringContextArgs & {
  model: unknown;
};

type PhaseValidationValidateModelResult = {
  status: "valid" | "invalid";
  valid: boolean;
  phase: ResolvedPhaseLocation | null;
  artifact: PhaseValidationArtifactKind;
  path: string | null;
  schemaPath: string | null;
  taskSchema: Record<string, unknown> | null;
  diagnostics: PhaseValidationModelDiagnostic[];
  diagnosticCounts: {
    total: number;
    bySource: Record<PhaseValidationDiagnosticSource, number>;
    byCode: Record<string, number>;
  };
  normalizedModel: PhaseVerificationStructuredModel | PhaseUatStructuredModel | null;
  renderPreview: string | null;
  warnings: string[];
};

type PhaseValidationStandaloneValidateModelResult = Omit<
  PhaseValidationValidateModelResult,
  "taskSchema" | "normalizedModel" | "renderPreview"
>;

type UatRenderCurrentTest = {
  number?: string;
  name?: string;
  expected?: string;
  awaiting?: string;
};

type UatRenderTestMatrixRow = {
  number?: string;
  test?: string;
  expectedBehavior?: string;
  evidence?: string;
  result?: string;
  notes?: string;
};

type UatRenderResultSummary = {
  total?: number;
  passed?: number;
  issues?: number;
  pending?: number;
  skipped?: number;
  blocked?: number;
};

type UatRenderStructuredGapRow = {
  test?: string;
  truth?: string;
  status?: string;
  severity?: string;
  reason?: string;
  followUp?: string;
};

type UatRenderArgs = PhaseLookupArgs & {
  artifact: "uat";
  status?: string;
  resumeState?: string;
  checkpoint?: string;
  uatSummary?: string[];
  sessionState?: string[];
  currentTest?: UatRenderCurrentTest;
  testMatrix?: UatRenderTestMatrixRow[];
  resultSummary?: UatRenderResultSummary;
  questionsAsked?: string[];
  observedBehavior?: string[];
  unresolvedGaps?: string[];
  structuredGaps?: UatRenderStructuredGapRow[];
  followUpFixes?: string[];
  nextSafeAction?: string;
};

type PhaseValidationRenderArgs = VerificationRenderArgs | UatRenderArgs;

type PhaseValidationRenderResult = {
  phaseFound: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  artifact: PhaseValidationArtifactKind;
  path: string | null;
  content: string;
  validation: {
    valid: boolean;
    issues: string[];
    warnings: string[];
  };
  summaryPaths: string[];
  referencedSummaryPaths: string[];
  prerequisiteBlockers: string[];
  readyToWrite: boolean;
  issues: string[];
  warnings: string[];
};

type PhaseCheckpointGetArgs = PhaseLookupArgs & {
  expectedOwnerCommand?: PhaseCheckpointOwnerCommand;
  expectedMode?: PhaseCheckpointResumeMode;
};

type PhaseCheckpointPutArgs = PhaseLookupArgs & {
  checkpoint: PhaseCheckpointWriteRecord;
};

type PhaseCheckpointDeleteArgs = PhaseLookupArgs & {
  expectedOwnerCommand?: PhaseCheckpointOwnerCommand;
  expectedMode?: PhaseCheckpointResumeMode;
};

type PhasePlanReadArgs = PhaseLookupArgs & {
  planId: NumericInput;
};

type PhasePlanValidateArgs = PhaseLookupArgs;

type PhaseExecutionTargetsArgs = PhaseLookupArgs & {
  wave?: number;
  gapsOnly?: boolean;
  includeConflicts?: boolean;
};

type PhasePlanWriteArgs = PhaseLookupArgs & {
  planId?: NumericInput;
  content?: string;
  model?: unknown;
  authoringMode?: "content-compatible" | "model-only";
  overwrite?: boolean;
  validationMode?: "strict" | "warn";
};

type PhasePlanAuthoringContextArgs = PhaseLookupArgs & {
  planId?: NumericInput;
};

type PhasePlanValidateModelArgs = PhasePlanAuthoringContextArgs & {
  model: unknown;
};

type PhaseSummaryReadArgs = PhaseLookupArgs & {
  planId: NumericInput;
};

type PhaseSummaryWriteArgs = PhaseLookupArgs & {
  planId: NumericInput;
  content?: string;
  model?: unknown;
  authoringMode?: "content-compatible" | "model-only";
  overwrite?: boolean;
};

type PhaseSummaryAuthoringContextArgs = PhaseLookupArgs & {
  planId: NumericInput;
};

type PhaseSummaryValidateModelArgs = PhaseSummaryAuthoringContextArgs & {
  content?: string;
  model?: unknown;
};

type ResolvedPhaseLocation = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  phaseDir: string;
};

type ParsedRoadmap = {
  path: string;
  milestone: string | null;
  phases: ParsedRoadmapPhase[];
};

type RoadmapAddPhaseResult = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  slug: string;
  phaseDir: string;
  roadmapPath: string;
  milestone: string | null;
  written: boolean;
  warnings: string[];
};

type RoadmapInsertPhaseResult = {
  afterPhaseNumber: string;
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  slug: string;
  phaseDir: string;
  roadmapPath: string;
  milestone: string | null;
  written: boolean;
  warnings: string[];
};

type RoadmapRemovePhaseResult = {
  removedPhase: {
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    phaseDir: string;
    removedArtifacts: string[];
  };
  renumberedPhases: Array<{
    previousPhaseNumber: string;
    newPhaseNumber: string;
    previousPhasePrefix: string;
    newPhasePrefix: string;
    phaseName: string;
    previousPhaseDir: string;
    newPhaseDir: string;
    renamedArtifacts: Array<{
      from: string;
      to: string;
    }>;
  }>;
  roadmapPath: string;
  milestone: string | null;
  written: boolean;
  warnings: string[];
};

type RoadmapPromotionPreviewItem = {
  backlogId: string;
  description: string;
  status: string | null;
  reservedPhase: string | null;
};

type RoadmapPromoteBacklogResult = {
  status: "preview" | "updated" | "project_missing" | "invalid";
  backlogPath: string;
  roadmapPath: string;
  backlogItems: RoadmapPromotionPreviewItem[];
  selectedBacklogIds: string[];
  promotedItems: Array<{
    backlogId: string;
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    reservedPhase: string | null;
    phaseDir: string;
    createdPhaseDir: boolean;
    reusedReservedPhaseDir: boolean;
  }>;
  createdPhaseDirs: string[];
  warnings: string[];
};

type PhaseLocateResult = {
  found: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  artifacts: string[];
  milestone: string | null;
  resolvedFrom: "explicit" | "state" | "roadmap";
  reason: string | null;
  recovery: string[];
  warnings: string[];
};

type ResearchExternalSourcesMode = "off" | "ask" | "auto";

type PhaseContextResult = {
  phase: {
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    phaseDir: string;
    roadmap: {
      completed: boolean;
      summary: string | null;
      goal: string | null;
      successCriteria: string | null;
    };
    artifacts: {
      all: string[];
      context: string | null;
      discussionLog: string | null;
      research: string | null;
      uiSpec: string | null;
      verification: string | null;
      uat: string | null;
      plans: string[];
      summaries: string[];
    };
  } | null;
  projectBrief: {
    found: boolean;
    path: string | null;
    title: string | null;
    summary: string;
    vision: string[];
    audience: string[];
    constraints: string[];
    currentMilestone: string | null;
    nonGoals: string[];
    warnings: string[];
  };
  requirementsGrounding: {
    found: boolean;
    path: string | null;
    canonicalRequirementIds: string[];
    roadmapRequirementIds: string[];
    traceabilityNotes: string[];
    acceptanceNotes: string[];
    deferredItems: string[];
    summary: string;
    warnings: string[];
  };
  workflowPosture: {
    path: string | null;
    projectStatus: string | null;
    currentMilestone: string | null;
    currentPhase: string | null;
    activeCommand: string | null;
    nextAction: string | null;
    blockers: string[];
    workflow: {
      research: boolean;
      planCheck: boolean;
      verifier: boolean;
      nyquistValidation: boolean;
      uiPhase: boolean;
      uiSafetyGate: boolean;
      codeReview: boolean;
      autoAdvance: boolean;
      researchBeforeQuestions: boolean;
      discussMode: string;
      skipDiscuss: boolean;
      useWorktrees: boolean;
    };
    research: {
      externalSources: ResearchExternalSourcesMode;
    };
    summary: string;
    warnings: string[];
  };
  codebase: {
    mapped: boolean;
    artifacts: string[];
    missingArtifacts: string[];
    digest: Array<{
      artifact: string;
      title: string;
      summary: string;
    }>;
    warnings: string[];
  };
  requirements: string[];
  missingArtifacts: string[];
  warnings: string[];
};

type PhaseResearchStatusResult = {
  hasContext: boolean;
  hasResearch: boolean;
  hasUiSpec: boolean;
  hasUsableContext: boolean;
  hasUsableResearch: boolean;
  hasUsableUiSpec: boolean;
  contextPath: string | null;
  researchPath: string | null;
  uiSpecPath: string | null;
  contextValid: boolean | null;
  contextIssues: string[];
  contextDiagnostics: PhaseArtifactValidationDiagnostic[];
  researchValid: boolean | null;
  researchIssues: string[];
  researchDiagnostics: PhaseArtifactValidationDiagnostic[];
  uiSpecValid: boolean | null;
  uiSpecIssues: string[];
  uiSpecDiagnostics: PhaseArtifactValidationDiagnostic[];
  suggestedRepairs: string[];
  planningReadiness: PhasePlanningReadiness;
  warnings: string[];
};

type PhasePlanningReadiness = {
  workflowResearchRequired: boolean;
  workflowUiPhaseRequired: boolean;
  workflowUiSafetyGateEnabled: boolean;
  readyForPlanPhase: boolean;
  nextSafeAction: string;
  blockers: string[];
  diagnostics?: PhaseArtifactValidationDiagnostic[];
};

type PhaseArtifactReadResult = {
  phaseFound: boolean;
  found: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  artifact: PhaseArtifactKind;
  path: string | null;
  content: string | null;
  reason: string | null;
};

type PhaseArtifactWriteResult = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  phaseDir: string;
  artifact: PhaseArtifactKind;
  path: string;
  written: boolean;
  created: boolean;
  overwritten: boolean;
  status: "created" | "updated" | "reused" | "invalid";
  validation: {
    valid: boolean;
    issues: string[];
    warnings: string[];
    suggestedRepairs: string[];
    diagnostics?: PhaseArtifactValidationDiagnostic[];
    retryPlan?: PhaseArtifactRetryPlan | null;
  } | null;
  diagnostics?: PhaseArtifactValidationDiagnostic[];
  suggestedRepairs?: string[];
  retryPlan?: PhaseArtifactRetryPlan | null;
  warnings: string[];
};

type PhaseArtifactRetryPlan = {
  retryable: boolean;
  nextTool: string;
  steps: string[];
};

type PhaseValidationReadResult = {
  phaseFound: boolean;
  found: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  artifact: PhaseValidationArtifactKind;
  path: string | null;
  content: string | null;
  validation: {
    valid: boolean;
    issues: string[];
    warnings: string[];
  } | null;
  verificationReadyForUat: boolean;
  uatStatus: "PASS" | "FAIL" | "PARTIAL" | null;
  resumeState: "RESUMED" | "NEW" | "CONTINUED" | null;
  checkpoint: string | null;
  complete: boolean;
  summaryPaths: string[];
  reason: string | null;
};

type PhaseValidationWriteResult = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  phaseDir: string;
  artifact: PhaseValidationArtifactKind;
  path: string;
  summaryPaths: string[];
  written: boolean;
  created: boolean;
  overwritten: boolean;
  status: "created" | "updated" | "reused" | "invalid";
  issues: string[];
  warnings: string[];
};

type PhaseCheckpointGetResult = {
  phaseFound: boolean;
  found: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  path: string | null;
  checkpoint: Record<string, unknown> | null;
  ownerCommand: string | null;
  resumeMode: string | null;
  safeToResume: boolean;
  warnings: string[];
  reason: string | null;
};

type PhaseCheckpointPutResult = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  phaseDir: string;
  path: string;
  updated: boolean;
  warnings: string[];
};

type PhaseCheckpointDeleteResult = {
  phaseFound: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  path: string | null;
  deleted: boolean;
  reason: string | null;
};

type PhasePlanRecord = {
  planId: string;
  path: string;
  title: string | null;
  wave: number | null;
  gapClosure: boolean;
  status: string | null;
  objective: string | null;
  dependsOn: string[];
  requirements: string[];
  filesModified: string[];
  readFirst: string[];
  acceptanceCriteria: string[];
  autonomous: boolean | null;
  valid: boolean;
  issues: string[];
  warnings: string[];
};

type PhasePlanIndexResult = {
  phaseFound: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  plans: PhasePlanRecord[];
  waves: Record<string, string[]>;
  missingPlans: string[];
  gapClosurePlans: string[];
  warnings: string[];
};

type PhasePlanReadResult = {
  phaseFound: boolean;
  found: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  planId: string | null;
  path: string | null;
  content: string | null;
  metadata: Omit<PhasePlanRecord, "path" | "valid" | "issues" | "warnings" | "planId"> | null;
  validation: {
    valid: boolean;
    issues: string[];
    warnings: string[];
  } | null;
  reason: string | null;
};

type PhasePlanValidationResult = {
  phaseFound: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  status: "valid" | "invalid";
  issues: string[];
  warnings: string[];
  planCount: number;
  planIds: string[];
  roadmapRequirementIds: string[];
  coveredRequirementIds: string[];
  uncoveredRequirementIds: string[];
  unexpectedRequirementIds: string[];
  missingDependencyIds: string[];
  cyclicDependencyPlanIds: string[][];
};

type PhasePlanWriteResult = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  phaseDir: string;
  planId: string;
  path: string;
  written: boolean;
  created: boolean;
  overwritten: boolean;
  status: "created" | "updated" | "reused" | "invalid";
  validation: {
    valid: boolean;
    issues: string[];
    warnings: string[];
  };
  modelValidation?: PhasePlanWriteModelValidationResult | null;
  warnings: string[];
};

type PhasePlanAuthoringContextResult = {
  status: "ready" | "invalid";
  phase: ResolvedPhaseLocation | null;
  planId: string | null;
  path: string | null;
  schemaPath: string | null;
  baseSchema: Record<string, unknown> | null;
  taskSchema: Record<string, unknown> | null;
  knownRequirements: string[];
  knownEvidenceArtifacts: string[];
  allowedDependencyPlanIds: string[];
  modelOnly: boolean;
  reason: string | null;
  warnings: string[];
};

type PhasePlanModelDiagnosticSource = "scope" | "schema" | "residual" | "markdown";
type PhasePlanModelDiagnosticSeverity = "error" | "warning";
type PhasePlanModelRepairAction =
  | "add"
  | "remove"
  | "replace"
  | "dedupe"
  | "reroute"
  | "make-verifiable"
  | "re-read-context";

type PhasePlanModelPatchHint = {
  op: "add" | "remove" | "replace";
  path: string;
  value?: unknown;
};

type PhasePlanModelDiagnostic = {
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

type PhasePlanValidateModelTarget = {
  artifact: "phase.plan";
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  planId: string | null;
  path: string | null;
  schemaPath: string | null;
};

type PhasePlanRepairSummary = {
  blockingCount: number;
  firstPassActions: string[];
  reReadAuthoringContext: boolean;
  retryInstruction: string;
};

type PhasePlanValidateModelResult = {
  status: "valid" | "invalid";
  valid: boolean;
  target: PhasePlanValidateModelTarget;
  repairBudget: {
    maxAttempts: 2;
    recommendedStrategy: "repair-all-diagnostics-before-retry";
  };
  repairSummary: PhasePlanRepairSummary;
  phase: ResolvedPhaseLocation | null;
  planId: string | null;
  path: string | null;
  schemaPath: string | null;
  taskSchema: Record<string, unknown> | null;
  diagnostics: PhasePlanModelDiagnostic[];
  diagnosticCounts: {
    total: number;
    bySource: Record<PhasePlanModelDiagnosticSource, number>;
    byCode: Record<string, number>;
  };
  normalizedModel: PhasePlanStructuredModel | null;
  renderPreview: string | null;
  warnings: string[];
};

type PhasePlanStandaloneValidateModelResult = Omit<
  PhasePlanValidateModelResult,
  "taskSchema" | "normalizedModel" | "renderPreview"
>;

type PhasePlanWriteModelValidationResult = Omit<
  PhasePlanValidateModelResult,
  "taskSchema" | "normalizedModel" | "renderPreview"
>;

type PhaseSummaryRecord = {
  planId: string;
  path: string;
  linkedPlanPath: string | null;
  status: "COMPLETED" | "PARTIAL" | "BLOCKED" | null;
  title: string | null;
  summary: string | null;
};

type PhaseSummaryIndexResult = {
  phaseFound: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  summaries: PhaseSummaryRecord[];
  completedPlans: string[];
  pendingPlans: string[];
  warnings: string[];
};

type PhaseSummaryReadResult = {
  phaseFound: boolean;
  found: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  planId: string | null;
  path: string | null;
  content: string | null;
  metadata: Omit<PhaseSummaryRecord, "path" | "planId"> | null;
  validation: {
    valid: boolean;
    issues: string[];
    warnings: string[];
  } | null;
  reason: string | null;
};

type PhaseSummaryStatus = "COMPLETED" | "PARTIAL" | "BLOCKED";
type PhaseSummaryReadiness = "ready-for-validation" | "not-ready-for-validation" | "blocked";
type PhaseSummaryCompletionState = "complete" | "pending" | "blocked";
type PhaseSummaryVerificationResult = "pass" | "fail" | "blocked" | "not-run";
type PhaseSummaryManualStatus = "MANUAL" | "DEFERRED" | "NONE";
type PhaseSummaryGapStatus = "OPEN" | "BLOCKED" | "NONE";
type PhaseSummaryEvidenceKind = "artifact" | "repo-path" | "command" | "test" | "other";

type PhaseSummaryStructuredModel = {
  status: PhaseSummaryStatus;
  readiness: PhaseSummaryReadiness;
  completionState: PhaseSummaryCompletionState;
  outcome: string[];
  changesMade: string[];
  targetedVerification: Array<{
    check: string;
    command: string;
    result: PhaseSummaryVerificationResult;
    evidence: string;
    notes: string;
  }>;
  dependencyPlans: Array<{
    planId: string;
    path: string;
    status: "satisfied";
    evidence: string;
  }>;
  manualOrDeferredWork: Array<{
    item: string;
    reason: string;
    followUp: string;
    status: PhaseSummaryManualStatus;
  }>;
  gapRoutes: Array<{
    gap: string;
    evidence: string;
    repair: string;
    status: PhaseSummaryGapStatus;
  }>;
  followUps: string[];
  evidence: Array<{
    kind: PhaseSummaryEvidenceKind;
    source: string;
    summary: string;
  }>;
  nextSafeAction: string;
};

type PhaseSummaryCompletedRoute = {
  readiness: Extract<PhaseSummaryReadiness, "ready-for-validation" | "not-ready-for-validation">;
  nextSafeAction: string;
};

type PhaseSummaryCompletedRouteValidation =
  | { mode: "skip" }
  | { mode: "exact"; route: PhaseSummaryCompletedRoute }
  | { mode: "indexed" };

type PhaseSummaryAuthoringContextResult = {
  status: "ready" | "invalid";
  phase: ResolvedPhaseLocation | null;
  planId: string | null;
  path: string | null;
  linkedPlanPath: string | null;
  plan: PhasePlanRecord | null;
  existing: PhaseSummaryReadResult | null;
  dependencyPlans: Array<{
    planId: string;
    path: string;
  }>;
  acceptanceCriteria: string[];
  allowedNextActions: string[];
  schemaPath: string | null;
  baseSchema: Record<string, unknown> | null;
  taskSchema: Record<string, unknown> | null;
  modelOnly: boolean;
  prerequisiteBlockers: string[];
  reason: string | null;
  warnings: string[];
};

type PhaseSummaryModelDiagnosticSource = "scope" | "schema" | "residual" | "markdown";

type PhaseSummaryModelDiagnostic = {
  source: PhaseSummaryModelDiagnosticSource;
  path: string;
  code: string;
  message: string;
  context: Record<string, unknown>;
  suggestion: string;
};

type PhaseSummaryValidateModelResult = {
  status: "valid" | "invalid";
  valid: boolean;
  phase: ResolvedPhaseLocation | null;
  planId: string | null;
  path: string | null;
  linkedPlanPath: string | null;
  schemaPath: string | null;
  taskSchema: Record<string, unknown> | null;
  diagnostics: PhaseSummaryModelDiagnostic[];
  diagnosticCounts: {
    total: number;
    bySource: Record<PhaseSummaryModelDiagnosticSource, number>;
    byCode: Record<string, number>;
  };
  normalizedModel: PhaseSummaryStructuredModel | null;
  renderPreview: string | null;
  warnings: string[];
};

type PhaseSummaryStandaloneValidateModelResult = Omit<
  PhaseSummaryValidateModelResult,
  "taskSchema" | "normalizedModel" | "renderPreview"
>;

type PhaseSummaryWriteResult = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  phaseDir: string;
  planId: string;
  path: string;
  linkedPlanPath: string;
  written: boolean;
  created: boolean;
  overwritten: boolean;
  status: "created" | "updated" | "reused" | "invalid";
  issues: string[];
  warnings: string[];
};

type LoadedPhasePlanArtifact = {
  path: string;
  planIdFromPath: string;
  content: string;
  heading: string | null;
  metadata: ReturnType<typeof validatePlanArtifactContent>["metadata"];
  validation: ReturnType<typeof validatePlanArtifactContent>;
  normalizedFrontmatterPlanId: string | null;
};

type PhaseExecutionTargetSummary = {
  found: boolean;
  path: string;
  linkedPlanPath: string | null;
  status: "COMPLETED" | "PARTIAL" | "BLOCKED" | null;
  valid: boolean | null;
  issues: string[];
  warnings: string[];
  overwriteCandidate: boolean;
};

type PhaseExecutionTargetPlan = PhasePlanRecord & {
  missingDependencyPlans: string[];
  summary: PhaseExecutionTargetSummary;
};

type PhaseExecutionTargetConflictSurface = {
  value: string;
  kinds: Array<"files_modified" | "read_first" | "generated_artifact" | "other">;
};

type PhaseExecutionTargetConflictGroup = {
  planIds: string[];
  planPaths: string[];
  selectedPlanIds: string[];
  sharedSurfaces: PhaseExecutionTargetConflictSurface[];
  existingSummaryPaths: string[];
  warnings: string[];
};

type PhaseExecutionTargetsResult = {
  phaseFound: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  requestedWave: number | null;
  gapsOnly: boolean;
  includeConflicts: boolean;
  pendingPlanIds: string[];
  gapClosurePlans: string[];
  candidatePlanIds: string[];
  candidatePlanPaths: string[];
  selectedPlanIds: string[];
  selectedPlanPaths: string[];
  selectedWave: number | null;
  lowerWavePendingPlans: Array<{
    planId: string;
    path: string;
    wave: number | null;
  }>;
  overwriteCandidatePlanIds: string[];
  overlapPlanIds: string[];
  candidatePlans: PhaseExecutionTargetPlan[];
  selectedPlans: PhaseExecutionTargetPlan[];
  overlapPlans: PhaseExecutionTargetPlan[];
  existingSummaries: Array<{
    planId: string;
    path: string;
    linkedPlanPath: string | null;
    status: "COMPLETED" | "PARTIAL" | "BLOCKED" | null;
    valid: boolean | null;
    issues: string[];
    warnings: string[];
    overwriteCandidate: boolean;
  }>;
  blockers: {
    executionBlocked: boolean;
    reasons: string[];
    invalidPlanIds: string[];
    stalePlanIds: string[];
    lowerWavePendingPlanIds: string[];
    missingPlanPaths: string[];
    planIndexWarnings: string[];
    summaryIndexWarnings: string[];
  };
  conflicts: {
    groups: PhaseExecutionTargetConflictGroup[];
    warnings: string[];
  } | null;
  warnings: string[];
};

type RoadmapReadResult = {
  roadmap: {
    path: string;
    phaseCount: number;
  };
  milestone: string | null;
  warnings: string[];
  recovery: string[];
  phases: Array<{
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    completed: boolean;
    summary: string | null;
    goal: string | null;
    successCriteria: string | null;
    requirements: string[];
    phaseDir: string | null;
  }>;
};

const PHASE_ARTIFACT_SUFFIXES: Record<PhaseArtifactKind, string> = {
  context: "-CONTEXT.md",
  "discussion-log": "-DISCUSSION-LOG.md",
  research: "-RESEARCH.md",
  "ui-spec": "-UI-SPEC.md"
};
const PHASE_VALIDATION_ARTIFACT_SUFFIXES: Record<PhaseValidationArtifactKind, string> = {
  verification: "-VERIFICATION.md",
  uat: "-UAT.md"
};
const PHASE_CHECKPOINT_SUFFIX = "-DISCUSS-CHECKPOINT.json";

const roadmapReadInputSchema = {
  cwd: z.string().optional()
};

const roadmapAddPhaseInputSchema = {
  cwd: z.string().optional(),
  description: z.string(),
  expectedPhaseNumber: z.string().optional(),
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
const roadmapInsertPhaseInputSchema = {
  cwd: z.string().optional(),
  after: z.union([z.string(), z.number()]),
  description: z.string()
};
const roadmapRemovePhaseInputSchema = {
  cwd: z.string().optional(),
  phase: z.union([z.string(), z.number()]),
  force: z.boolean().optional()
};
const roadmapPromoteBacklogInputSchema = {
  cwd: z.string().optional(),
  backlogIds: z.array(z.string()).optional(),
  previewOnly: z.boolean().optional()
};

const numericBlueprintInputSchema = z.union([z.string(), z.number()]);

const phaseLookupInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional()
};

const phaseArtifactInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum(["context", "discussion-log", "research", "ui-spec"])
};
const phaseValidationArtifactInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum(["verification", "uat"])
};
const phaseValidationAuthoringContextInputSchema = phaseValidationArtifactInputSchema;
const phasePlanInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional()
};
const phaseExecutionTargetsInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  wave: z.number().int().positive().optional(),
  gapsOnly: z.boolean().optional(),
  includeConflicts: z.boolean().optional()
};

const phaseArtifactWriteInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum(["context", "discussion-log", "research", "ui-spec"]),
  content: z.string().optional(),
  model: z.record(z.string(), z.unknown()).optional(),
  overwrite: z.boolean().optional(),
  validationMode: z.enum(["strict", "warn"]).optional()
};
const phaseValidationWriteInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum(["verification", "uat"]),
  content: z.string().optional(),
  model: z.record(z.string(), z.unknown()).optional(),
  authoringMode: z.enum(["content-compatible", "model-only"]).optional(),
  overwrite: z.boolean().optional()
};
const phaseValidationValidateModelInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum(["verification", "uat"]),
  model: z.unknown()
};
const phaseValidationRenderInputSchema = {
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
type PhasePlanStructuredModel = {
  title: string;
  wave: number;
  status: "planned";
  objective: string;
  gapClosure?: boolean;
  dependsOn: string[];
  requirements: string[];
  filesModified: string[];
  readFirst: string[];
  autonomous: boolean;
  goal: string;
  scope: string[];
  tasks: Array<{
    id: string;
    title: string;
    readFirst: string[];
    action: string[];
    acceptanceCriteria: string[];
    requirements: string[];
    filesModified: string[];
  }>;
  verification: Array<{
    item: string;
    method: "test" | "grep" | "command" | "file-read" | "artifact-validation";
    evidence: string;
  }>;
  mustHaves: string[];
  requirementCoverage: Array<{
    requirement: string;
    status: "covered" | "deferred" | "irrelevant";
    coveredByTasks: string[];
    evidence: string;
    rationale: string;
  }>;
  evidenceCoverage: Array<{
    artifact: string;
    status: "used" | "deferred" | "irrelevant" | "unavailable";
    rationale: string;
  }>;
  fileSurfaceCoverage: Array<{
    surface: string;
    coveredByTasks: string[];
    verification: string;
    rationale: string;
  }>;
  unknownsAndDeferrals: Array<{
    item: string;
    disposition: "unknown" | "deferred" | "blocked" | "none";
    rationale: string;
    followUp: string;
  }>;
};
const phasePlanReadInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema
};
const phasePlanValidateInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional()
};
const phasePlanAuthoringContextInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema.optional()
};
const phasePlanValidateModelInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema.optional(),
  model: z.unknown()
};
const phasePlanWriteInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema.optional(),
  content: z.string().optional(),
  model: z.unknown().optional(),
  authoringMode: z.enum(["content-compatible", "model-only"]).optional(),
  overwrite: z.boolean().optional(),
  validationMode: z.enum(["strict", "warn"]).optional()
};
const phaseSummaryReadInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema
};
const phaseSummaryAuthoringContextInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema
};
const phaseSummaryValidateModelInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema,
  content: z.string().optional(),
  model: z.unknown().optional()
};
const phaseSummaryWriteInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema,
  content: z.string().optional(),
  model: z.unknown().optional(),
  authoringMode: z.enum(["content-compatible", "model-only"]).optional(),
  overwrite: z.boolean().optional()
};

const phaseCheckpointGetInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  expectedOwnerCommand: phaseCheckpointOwnerCommandSchema.optional(),
  expectedMode: phaseCheckpointResumeModeSchema.optional()
};

const phaseCheckpointPutInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  checkpoint: phaseCheckpointWriteSchema
};
const phaseCheckpointDeleteInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  expectedOwnerCommand: phaseCheckpointOwnerCommandSchema.optional(),
  expectedMode: phaseCheckpointResumeModeSchema.optional()
};

export function buildBlueprintPhaseDirectoryPath(
  phaseNumber: string | number,
  phaseName: string
): string {
  const phasePrefix = formatPhasePrefix(phaseNumber);
  const normalizedPhaseName = normalizePhaseDescription(phaseName);

  return `${BLUEPRINT_PHASES_PATH}/${phasePrefix}-${slugifyPhaseName(normalizedPhaseName)}`;
}

function nextIntegerPhaseNumber(phases: ParsedRoadmapPhase[]): string {
  const basePhaseNumbers = phases
    .map((phase) => phase.phaseNumber)
    .map((phaseNumber) => phaseNumber.split(".")[0] ?? phaseNumber)
    .map((phaseNumber) => Number.parseInt(phaseNumber, 10))
    .filter((phaseNumber) => !Number.isNaN(phaseNumber));

  const maxIntegerPhase = basePhaseNumbers.length === 0
    ? 0
    : Math.max(...basePhaseNumbers);

  return String(maxIntegerPhase + 1);
}

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
    roadmapPath: roadmap.path,
    milestone: roadmap.milestone,
    written: true,
    warnings
  };
}

function previousIntegerPhaseNumber(value: NumericInput): string | null {
  const normalizedPhaseNumber = normalizePhaseNumber(value);

  if (!isIntegerPhaseNumber(normalizedPhaseNumber)) {
    return null;
  }

  const previousPhaseNumber = Number.parseInt(normalizedPhaseNumber, 10) - 1;

  return previousPhaseNumber > 0 ? String(previousPhaseNumber) : null;
}

function nextDecimalPhaseNumber(
  phases: ParsedRoadmapPhase[],
  afterPhaseNumber: string
): string {
  const normalizedAfterPhase = normalizePhaseNumber(afterPhaseNumber);
  const decimalMatcher = new RegExp(`^${escapeForRegex(normalizedAfterPhase)}\\.(\\d+)$`);
  const suffixes = phases
    .map((phase) => phase.phaseNumber)
    .map((phaseNumber) => phaseNumber.match(decimalMatcher)?.[1] ?? null)
    .filter((suffix): suffix is string => suffix !== null)
    .map((suffix) => Number.parseInt(suffix, 10))
    .filter((suffix) => !Number.isNaN(suffix));
  const nextSuffix = suffixes.length === 0 ? 1 : Math.max(...suffixes) + 1;

  return `${normalizedAfterPhase}.${nextSuffix}`;
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceWithPlaceholders(
  value: string,
  replacements: Array<{
    pattern: RegExp;
    replacement: string;
  }>
): string {
  const placeholders = replacements.map((_, index) => `__BLUEPRINT_PHASE_${index}__`);
  let updated = value;

  replacements.forEach((replacement, index) => {
    updated = updated.replace(replacement.pattern, placeholders[index]);
  });

  placeholders.forEach((placeholder, index) => {
    updated = updated.replaceAll(placeholder, replacements[index]?.replacement ?? placeholder);
  });

  return updated;
}

function rewriteDependencyLines(
  value: string,
  renumberMap: ReadonlyMap<string, string>
): string {
  return value.replace(/^(\*\*Depends on\*\*:\s*)(.+)$/gm, (_full, prefix: string, body: string) => {
    const trimmedBody = body.trim();

    if (trimmedBody.length === 0 || ["none", "n/a"].includes(trimmedBody.toLowerCase())) {
      return `${prefix}${body}`;
    }

    const rewritten = body
      .split(",")
      .map((rawEntry) => {
        const entry = rawEntry.trim();
        const phaseNumber = extractPhaseNumberToken(entry);

        if (!phaseNumber) {
          return rawEntry;
        }

        const replacement = renumberMap.get(phaseNumber);

        if (!replacement) {
          return rawEntry;
        }

        const phasePrefix = entry.startsWith("Phase ")
          ? "Phase "
          : entry.startsWith("phase ")
            ? "phase "
            : "";

        return rawEntry.replace(
          new RegExp(`${escapeForRegex(phasePrefix)}${escapeForRegex(phaseNumber)}\\b`),
          `${phasePrefix}${replacement}`
        );
      })
      .join(",");

    return `${prefix}${rewritten}`;
  });
}

function rewriteRoadmapPhaseReferences(
  value: string,
  renumberMap: ReadonlyMap<string, string>
): string {
  const replacements = [...renumberMap.entries()].flatMap(([from, to]) => [
    {
      pattern: new RegExp(`\\bPhase ${escapeForRegex(from)}\\b`, "g"),
      replacement: `Phase ${to}`
    },
    {
      pattern: new RegExp(`\\bphase ${escapeForRegex(from)}\\b`, "g"),
      replacement: `phase ${to}`
    }
  ]);

  return rewriteDependencyLines(replaceWithPlaceholders(value, replacements), renumberMap);
}

function appendPhaseLineToRoadmap(
  raw: string,
  phaseNumber: string,
  phaseName: string
): string {
  const phaseLine = `- [ ] **Phase ${phaseNumber}: ${phaseName}**`;
  const phasesSectionPattern = /(## Phases\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (!phasesSectionPattern.test(raw)) {
    throw new Error(
      `Malformed ${BLUEPRINT_DIR}/ROADMAP.md: missing field "## Phases" while appending Phase ${phaseNumber}. Repair by adding a top-level "## Phases" section containing checkbox phase lines such as "- [ ] Phase ${phaseNumber}: ${phaseName} (Requirements: REQ-01)", then re-run /blu-add-phase.`
    );
  }

  return raw.replace(phasesSectionPattern, (_full, header: string, body: string) => {
    const trimmedBody = body.trimEnd();
    const nextBody = trimmedBody.length === 0 ? phaseLine : `${trimmedBody}\n${phaseLine}`;
    return `${header}${nextBody}\n`;
  });
}

function insertPhaseLineToRoadmap(
  raw: string,
  insertAfterPhaseNumber: string,
  phaseNumber: string,
  phaseName: string
): string {
  const normalizedAnchor = normalizePhaseNumber(insertAfterPhaseNumber);
  const phaseLine = `- [ ] **Phase ${phaseNumber}: ${phaseName}**`;
  const phasesSectionPattern = /(## Phases\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (!phasesSectionPattern.test(raw)) {
    throw new Error(
      `Malformed ${BLUEPRINT_DIR}/ROADMAP.md: missing field "## Phases" while inserting Phase ${phaseNumber} after Phase ${insertAfterPhaseNumber}. Repair by adding a top-level "## Phases" section with checkbox phase lines such as "- [ ] Phase ${insertAfterPhaseNumber}: <title>", then re-run /blu-insert-phase.`
    );
  }

  let inserted = false;

  const content = raw.replace(phasesSectionPattern, (_full, header: string, body: string) => {
    const lines = body
      .split("\n")
      .filter((line) => line.trim().length > 0);
    const anchorIndex = lines.findIndex((line) => {
      const match = line.match(/^- \[[ xX]\] (?:\*\*)?Phase (\d+(?:\.\d+)?): [^\n]+$/);
      return match ? normalizePhaseNumber(match[1]) === normalizedAnchor : false;
    });

    if (anchorIndex === -1) {
      return `${header}${body}`;
    }

    lines.splice(anchorIndex + 1, 0, phaseLine);
    inserted = true;

    return `${header}${lines.join("\n")}\n`;
  });

  if (!inserted) {
    throw new Error(
      `Phase ${insertAfterPhaseNumber} could not be located in ${BLUEPRINT_DIR}/ROADMAP.md field "## Phases" while inserting Phase ${phaseNumber}. Repair by adding or normalizing the anchor line to "- [ ] Phase ${insertAfterPhaseNumber}: <title>" or "- [ ] **Phase ${insertAfterPhaseNumber}: <title>**", then re-run /blu-insert-phase.`
    );
  }

  return content;
}

type PhaseDetailBlockOptions = {
  phaseNumber: string;
  phaseName: string;
  dependsOnPhaseNumber?: string | null;
  insertedMarker?: string | null;
  goal?: string;
  requirements?: string[];
  successCriteria?: string;
  auditBackedDetails?: RoadmapAuditBackedDetails | null;
};

function titleCaseAuditBackedCategory(category: AuditBackedGapCategory): string {
  return category
    .split("-")
    .map((segment) => `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`)
    .join(" ");
}

function normalizeRoadmapDetailList(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0))];
}

function renderAuditBackedGapGroups(gapGroups: AuditBackedGapGroup[] | undefined): string {
  const renderedGroups = (gapGroups ?? [])
    .filter((group) => group.rows.length > 0)
    .map((group) => {
      const rows = group.rows
        .map(
          (row) =>
            `| ${row.gapId.trim()} | ${row.surface.trim()} | ${row.evidence.trim()} | ${row.repair.trim()} |`
        )
        .join("\n");

      return `### ${titleCaseAuditBackedCategory(group.category)} Gaps

| Gap ID | Surface | Evidence | Repair |
|--------|---------|----------|--------|
${rows}`;
    });

  return renderedGroups.join("\n\n");
}

function renderRequirementTraceabilityRepairSection(
  requirementIds: string[] | undefined,
  phaseNumber: string,
  sourceReportPath: string | undefined
): string {
  const ids = normalizeRoadmapDetailList(requirementIds);

  if (ids.length === 0) {
    return "";
  }

  const reportReference = sourceReportPath?.trim() || "milestone audit";
  const rows = ids
    .map(
      (requirementId) =>
        `| ${requirementId} | pending | Phase ${phaseNumber} | Reassigned from ${reportReference}. |`
    )
    .join("\n");

  return `## Requirement Traceability Repair

| Requirement ID | Status | Assignment | Notes |
|----------------|--------|------------|-------|
${rows}`;
}

function normalizeRoadmapSuccessCriteriaField(value: string | undefined): string {
  const criteria = (value?.trim()
    ? value
    : "Persist context, planning, execution, validation, and UAT evidence for this phase.; Keep roadmap requirements, dependencies, and follow-up evidence traceable."
  )
    .split(/\s*;\s*/)
    .map((criterion) => criterion.trim())
    .filter((criterion) => criterion.length > 0);

  if (criteria.length === 0) {
    return [
      "Persist context, planning, execution, validation, and UAT evidence for this phase.",
      "Keep roadmap requirements, dependencies, and follow-up evidence traceable."
    ].join("; ");
  }

  if (criteria.length === 1) {
    criteria.push("Keep roadmap requirements, dependencies, and follow-up evidence traceable.");
  }

  return criteria.slice(0, 5).join("; ");
}

function buildPhaseDetailBlock(options: PhaseDetailBlockOptions): string {
  const goal =
    options.goal?.trim() || "Capture the phase boundary and implementation goal during /blu-discuss-phase.";
  const requirements = normalizeRoadmapDetailList(options.requirements);
  const successCriteria = normalizeRoadmapSuccessCriteriaField(options.successCriteria);
  const auditBackedDetails = options.auditBackedDetails ?? null;
  const auditSections = auditBackedDetails
    ? [
        "## Audit-Backed Gap Details",
        `**Source Audit**: ${auditBackedDetails.sourceReportPath?.trim() || "none"}`,
        `**Traceability Repair**: ${
          normalizeRoadmapDetailList(auditBackedDetails.repairRequirementIds).join(", ") || "none"
        }`,
        renderAuditBackedGapGroups(auditBackedDetails.gapGroups),
        renderRequirementTraceabilityRepairSection(
          auditBackedDetails.repairRequirementIds,
          options.phaseNumber,
          auditBackedDetails.sourceReportPath
        )
      ]
        .filter((section) => section.trim().length > 0)
        .join("\n\n")
    : "";

  return `### Phase ${options.phaseNumber}: ${options.phaseName}
**Goal**: ${goal}
**Requirements**: ${requirements.length > 0 ? requirements.join(", ") : "none yet"}
**Depends on**: ${options.dependsOnPhaseNumber ? `Phase ${options.dependsOnPhaseNumber}` : "none"}
${options.insertedMarker ? `**Inserted**: ${options.insertedMarker}\n` : ""}**Success Criteria**: ${successCriteria}
**Status**: planned
${auditSections ? `\n${auditSections}\n` : ""}`;
}

type RequirementTableRow = {
  id: string;
  requirement: string;
  status: string;
  notes: string;
};

function parseRequirementTableRow(line: string): RequirementTableRow | null {
  if (!/^\|.*\|$/.test(line)) {
    return null;
  }

  const cells = line
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());

  if (cells.length !== 4) {
    return null;
  }

  const [id, requirement, status, notes] = cells;

  if (
    /^id$/i.test(id) &&
    /^requirement$/i.test(requirement) &&
    /^status$/i.test(status) &&
    /^notes$/i.test(notes)
  ) {
    return null;
  }

  if (cells.every((cell) => /^-+$/.test(cell.replace(/:/g, "")))) {
    return null;
  }

  return {
    id,
    requirement,
    status,
    notes
  };
}

function renderRequirementTableRow(row: RequirementTableRow): string {
  return `| ${row.id} | ${row.requirement} | ${row.status} | ${row.notes} |`;
}

async function repairRequirementsTraceability(
  projectRoot: string,
  requirementIds: string[],
  phaseNumber: string,
  phaseName: string,
  sourceReportPath?: string
): Promise<{
  content: string;
  warnings: string[];
}> {
  const normalizedRequirementIds = [
    ...new Set(requirementIds.map((value) => value.trim()).filter((value) => value.length > 0))
  ];

  if (normalizedRequirementIds.length === 0) {
    return {
      content: "",
      warnings: []
    };
  }

  const requirementsPath = resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/REQUIREMENTS.md`);

  if (!(await pathExists(requirementsPath))) {
    throw new Error(
      `Cannot repair requirement traceability because ${BLUEPRINT_DIR}/REQUIREMENTS.md is missing.`
    );
  }

  const rawRequirements = await fs.readFile(requirementsPath, "utf8");
  const requirementsSectionPattern = /(## Requirements Table\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (!requirementsSectionPattern.test(rawRequirements)) {
    throw new Error(
      `Malformed ${BLUEPRINT_DIR}/REQUIREMENTS.md: missing a usable "## Requirements Table" section.`
    );
  }

  const remainingRequirementIds = new Set(normalizedRequirementIds);
  const noteSource = sourceReportPath?.trim() || "the milestone audit report";
  let updated = false;
  const reassignmentNote = `Reassigned to Phase ${phaseNumber} (${phaseName}) from ${noteSource}.`;

  const content = rawRequirements.replace(
    requirementsSectionPattern,
    (_full, header: string, body: string) => {
      const nextBody = body
        .split("\n")
        .map((line) => {
          const row = parseRequirementTableRow(line);

          if (!row || !remainingRequirementIds.has(row.id)) {
            return line;
          }

          remainingRequirementIds.delete(row.id);
          const notes = row.notes.trim();
          const nextNotes = notes.includes(reassignmentNote)
            ? notes
            : notes.length > 0
              ? `${notes} ${reassignmentNote}`
              : reassignmentNote;
          const nextStatus = "pending";

          if (row.status.trim() === nextStatus && nextNotes === row.notes) {
            return line;
          }

          updated = true;

          return renderRequirementTableRow({
            ...row,
            status: nextStatus,
            notes: nextNotes
          });
        })
        .join("\n");

      return `${header}${nextBody}\n`;
    }
  );

  if (remainingRequirementIds.size > 0) {
    throw new Error(
      `Requirement traceability repair could not find requirement IDs in ${BLUEPRINT_DIR}/REQUIREMENTS.md: ${[
        ...remainingRequirementIds
      ].join(", ")}`
    );
  }

  return {
    content,
    warnings: updated
      ? [
          `Reset requirements ${normalizedRequirementIds.join(", ")} to pending and reassigned them to Phase ${phaseNumber}.`
        ]
      : [`Requirements ${normalizedRequirementIds.join(", ")} already reflected the requested repair.`]
  };
}

function appendPhaseDetailsToRoadmap(
  raw: string,
  phaseNumber: string,
  phaseName: string,
  detailOptions: Omit<PhaseDetailBlockOptions, "phaseNumber" | "phaseName"> = {}
): string {
  const detailHeadingPattern = new RegExp(`^### Phase ${escapeForRegex(phaseNumber)}: `, "m");

  if (detailHeadingPattern.test(raw)) {
    return raw;
  }

  const detailBlock = buildPhaseDetailBlock({
    phaseNumber,
    phaseName,
    ...detailOptions
  });
  const phaseDetailsSectionPattern = /(## Phase Details\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (phaseDetailsSectionPattern.test(raw)) {
    return raw.replace(
      phaseDetailsSectionPattern,
      (_full, header: string, body: string) => {
        const trimmedBody = body.trimEnd();
        const nextBody =
          trimmedBody.length === 0 ? detailBlock.trimEnd() : `${trimmedBody}\n\n${detailBlock.trimEnd()}`;
        return `${header}${nextBody}\n`;
      }
    );
  }

  return `${raw.trimEnd()}

## Phase Details

${detailBlock}`;
}

function insertPhaseDetailsToRoadmap(
  raw: string,
  phaseGroupNumbers: string[],
  phaseNumber: string,
  phaseName: string,
  dependsOnPhaseNumber: string,
  detailOptions: Omit<PhaseDetailBlockOptions, "phaseNumber" | "phaseName" | "dependsOnPhaseNumber" | "insertedMarker"> = {}
): string {
  const detailHeadingPattern = new RegExp(`^### Phase ${escapeForRegex(phaseNumber)}: `, "m");

  if (detailHeadingPattern.test(raw)) {
    return raw;
  }

  const detailBlock = buildPhaseDetailBlock({
    phaseNumber,
    phaseName,
    dependsOnPhaseNumber,
    insertedMarker: "yes",
    ...detailOptions
  }).trimEnd();
  const phaseDetailsSectionPattern = /(## Phase Details\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (!phaseDetailsSectionPattern.test(raw)) {
    throw new Error(
      `Malformed ${BLUEPRINT_DIR}/ROADMAP.md: missing field "## Phase Details" while inserting Phase ${phaseNumber}. Repair by adding a top-level "## Phase Details" section with a "### Phase ${dependsOnPhaseNumber}: <title>" block before re-running /blu-insert-phase.`
    );
  }

  const phaseGroupSet = new Set(phaseGroupNumbers.map((value) => normalizePhaseNumber(value)));
  let inserted = false;
  const content = raw.replace(
    phaseDetailsSectionPattern,
    (_full, header: string, body: string) => {
      const blocks = splitRoadmapPhaseDetailBlocks(body);

      let insertIndex = -1;

      for (let index = blocks.length - 1; index >= 0; index -= 1) {
        const blockMatch = blocks[index]?.match(/^### Phase (\d+(?:\.\d+)?): /m);
        const blockPhaseNumber = blockMatch ? normalizePhaseNumber(blockMatch[1]) : null;

        if (blockPhaseNumber && phaseGroupSet.has(blockPhaseNumber)) {
          insertIndex = index + 1;
          break;
        }
      }

      if (insertIndex === -1) {
        throw new Error(
          `Phase ${dependsOnPhaseNumber} is missing field "Phase Details" block under ${BLUEPRINT_DIR}/ROADMAP.md "## Phase Details" while inserting Phase ${phaseNumber}. Repair by adding "### Phase ${dependsOnPhaseNumber}: <title>" with Goal, Requirements, Depends on, Success Criteria, and Status fields, then re-run /blu-insert-phase.`
        );
      }

      blocks.splice(insertIndex, 0, detailBlock);
      inserted = true;

      return `${header}${blocks.join("\n\n")}\n`;
    }
  );

  if (!inserted) {
    throw new Error(
      `Phase ${phaseNumber} could not be inserted into ${BLUEPRINT_DIR}/ROADMAP.md field "## Phase Details". Repair by ensuring Phase ${dependsOnPhaseNumber} and any decimal siblings have valid "### Phase N: <title>" detail headings, then re-run /blu-insert-phase.`
    );
  }

  return content;
}

function splitRoadmapPhaseDetailBlocks(body: string): string[] {
  return body
    .split(/^### Phase /gm)
    .slice(1)
    .map((block) => `### Phase ${block}`.trimEnd());
}

function removePhaseLineFromRoadmap(
  raw: string,
  phaseNumber: string
): {
  content: string;
  removed: boolean;
} {
  const phasesSectionPattern = /(## Phases\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (!phasesSectionPattern.test(raw)) {
    throw new Error(
      `Malformed ${BLUEPRINT_DIR}/ROADMAP.md: missing a usable "## Phases" section.`
    );
  }

  let removed = false;
  const content = raw.replace(phasesSectionPattern, (_full, header: string, body: string) => {
    const nextLines = body
      .split("\n")
      .filter((line) => {
        const match = line.match(/^- \[[ xX]\] (?:\*\*)?Phase (\d+(?:\.\d+)?): [^\n]+$/);

        if (!match) {
          return line.trim().length > 0;
        }

        if (normalizePhaseNumber(match[1]) === phaseNumber) {
          removed = true;
          return false;
        }

        return true;
      })
      .join("\n");

    return `${header}${nextLines.trimEnd()}\n`;
  });

  return {
    content,
    removed
  };
}

function removePhaseDetailsFromRoadmap(
  raw: string,
  phaseNumber: string
): {
  content: string;
  removed: boolean;
} {
  const phaseDetailsSectionPattern = /(## Phase Details\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (!phaseDetailsSectionPattern.test(raw)) {
    return {
      content: raw,
      removed: false
    };
  }

  let removed = false;
  const content = raw.replace(
    phaseDetailsSectionPattern,
    (_full, header: string, body: string) => {
      const blocks = splitRoadmapPhaseDetailBlocks(body);
      const nextBlocks = blocks.filter((block) => {
        const match = block.match(/^### Phase (\d+(?:\.\d+)?): /m);

        if (!match) {
          return true;
        }

        if (normalizePhaseNumber(match[1]) === phaseNumber) {
          removed = true;
          return false;
        }

        return true;
      });
      const nextBody = nextBlocks.join("\n\n");

      return nextBody.length > 0 ? `${header}${nextBody}\n` : `${header}`;
    }
  );

  return {
    content,
    removed
  };
}

function replacePhaseLineCompletionMarker(
  raw: string,
  phaseNumber: string,
  completed: boolean
): {
  content: string;
  found: boolean;
  changed: boolean;
} {
  const marker = completed ? "x" : " ";
  const pattern = new RegExp(
    `^(- \\[)([ xX])(\\] (?:\\*\\*)?Phase ${escapeForRegex(phaseNumber)}: [^\\n]+)$`,
    "m"
  );
  const match = raw.match(pattern);

  if (!match) {
    return {
      content: raw,
      found: false,
      changed: false
    };
  }

  const changed = (match[2]?.toLowerCase() === "x") !== completed;

  return {
    content: raw.replace(pattern, `$1${marker}$3`),
    found: true,
    changed
  };
}

function replacePhaseDetailStatus(
  raw: string,
  phaseNumber: string,
  nextStatus: string
): {
  content: string;
  found: boolean;
  changed: boolean;
} {
  const phaseDetailsSectionPattern = /(## Phase Details\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (!phaseDetailsSectionPattern.test(raw)) {
    return {
      content: raw,
      found: false,
      changed: false
    };
  }

  let found = false;
  let changed = false;
  const content = raw.replace(
    phaseDetailsSectionPattern,
    (_full, header: string, body: string) => {
      const blocks = splitRoadmapPhaseDetailBlocks(body);
      const nextBlocks = blocks.map((block) => {
        const match = block.match(/^### Phase (\d+(?:\.\d+)?): /m);

        if (!match || normalizePhaseNumber(match[1]) !== phaseNumber) {
          return block;
        }

        found = true;

        if (/^\*\*Status\*\*:\s*(.+)$/m.test(block)) {
          const existingStatus = block.match(/^\*\*Status\*\*:\s*(.+)$/m)?.[1]?.trim() ?? "";

          if (existingStatus.toLowerCase() === nextStatus.toLowerCase()) {
            return block;
          }

          changed = true;
          return block.replace(/^\*\*Status\*\*:\s*(.+)$/m, `**Status**: ${nextStatus}`);
        }

        changed = true;
        return `${block}\n**Status**: ${nextStatus}`;
      });

      return `${header}${nextBlocks.join("\n\n")}\n`;
    }
  );

  return {
    content,
    found,
    changed
  };
}

async function syncRoadmapPhaseCompletion(
  projectRoot: string,
  resolved: ResolvedPhaseLocation
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

  for (const artifact of ["verification", "uat"] as const) {
    const artifactPath = validationArtifactPathFor(resolved, artifact);

    if (!phaseArtifacts.includes(artifactPath)) {
      continue;
    }

    const content = await fs.readFile(resolveBlueprintPath(projectRoot, artifactPath), "utf8");
    const validation =
      artifact === "verification"
        ? validateVerificationArtifactContent(content, summaryPaths)
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

  validationWarnings.push(...qualityGateEvaluation.warnings);

  if (
    hasCompleteUat &&
    qualityGateEvaluation.requiresCodeReview &&
    !qualityGateEvaluation.gatesSatisfied
  ) {
    validationWarnings.push(
      `Phase ${resolved.phaseNumber} remains open in ${BLUEPRINT_DIR}/ROADMAP.md because ${qualityGateEvaluation.missingGate === "review" ? "REVIEW evidence is missing" : "SECURITY evidence is missing"} for ${qualityGateEvaluation.reviewableFiles.length} reviewable file(s).`
    );
  }

  const completed =
    summaryIndex.pendingPlans.length === 0 &&
    summaryPaths.length > 0 &&
    hasValidVerification &&
    verificationReadyForUat &&
    hasCompleteUat &&
    qualityGateEvaluation.gatesSatisfied;
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

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function materializePhaseDirectory(
  projectRoot: string,
  phaseDir: string
): Promise<{
  phaseDirPath: string;
  created: boolean;
  warnings: string[];
}> {
  const phaseDirPath = resolveBlueprintPath(projectRoot, phaseDir);

  try {
    const stats = await fs.stat(phaseDirPath);

    if (!stats.isDirectory()) {
      throw new Error(
        `Phase directory path exists but is not a directory: ${phaseDir}. Resolve the drift before mutating the roadmap.`
      );
    }

    return {
      phaseDirPath,
      created: false,
      warnings: [`Phase directory already exists and can be reused: ${phaseDir}`]
    };
  } catch (error) {
    const statError = error as NodeJS.ErrnoException;

    if (statError.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.mkdir(phaseDirPath, { recursive: true });
  return {
    phaseDirPath,
    created: true,
    warnings: []
  };
}

async function listPhaseArtifacts(
  rootPath: string,
  projectRoot: string
): Promise<string[]> {
  if (!(await pathExists(rootPath))) {
    return [];
  }

  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listPhaseArtifacts(absolutePath, projectRoot)));
      continue;
    }

    files.push(toRepoRelativePath(projectRoot, absolutePath));
  }

  return files.sort();
}

async function findPhaseDirectory(
  projectRoot: string,
  phaseNumber: string
): Promise<{
  phaseDir: string | null;
  reason: "missing" | "ambiguous" | null;
}> {
  const phasesRoot = resolveBlueprintPath(projectRoot, BLUEPRINT_PHASES_PATH);

  if (!(await pathExists(phasesRoot))) {
    return {
      phaseDir: null,
      reason: "missing"
    };
  }

  const entries = await fs.readdir(phasesRoot, { withFileTypes: true });
  const target = normalizePhaseNumber(phaseNumber);
  const matches = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((directoryName) => {
      const prefix = extractPhaseNumberToken(directoryName);
      return prefix === target;
    });

  if (matches.length === 0) {
    return {
      phaseDir: null,
      reason: "missing"
    };
  }

  if (matches.length > 1) {
    return {
      phaseDir: null,
      reason: "ambiguous"
    };
  }

  return {
    phaseDir: toRepoRelativePath(projectRoot, path.join(phasesRoot, matches[0])),
    reason: null
  };
}

async function readRoadmap(
  projectRoot: string
): Promise<ParsedRoadmap> {
  const roadmapPath = resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/ROADMAP.md`);

  if (!(await pathExists(roadmapPath))) {
    throw new Error(
      `Missing prerequisite artifact: ${BLUEPRINT_DIR}/ROADMAP.md. Restore it or run /blu-new-project before using phase discovery commands.`
    );
  }

  const raw = await fs.readFile(roadmapPath, "utf8");
  const parsed = parseRoadmapDocument(raw);

  return {
    path: `${BLUEPRINT_DIR}/ROADMAP.md`,
    milestone: parsed.milestone,
    phases: parsed.phases
  };
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

async function resolveRequestedPhase(
  projectRoot: string,
  requestedPhase: NumericInput | undefined,
  phases: ParsedRoadmapPhase[]
): Promise<{
  phaseNumber: string | null;
  resolvedFrom: "explicit" | "state" | "roadmap";
}> {
  const explicit = requestedPhase === undefined ? undefined : normalizeBlueprintInput(requestedPhase).trim();

  if (explicit) {
    return {
      phaseNumber: extractPhaseNumberToken(explicit),
      resolvedFrom: "explicit"
    };
  }

  try {
    const state = await loadBlueprintState(projectRoot);
    const fromState = extractPhaseNumberToken(state.currentPhase);

    if (fromState) {
      return {
        phaseNumber: fromState,
        resolvedFrom: "state"
      };
    }
  } catch {
    // fall back to roadmap-derived selection below
  }

  const nextPhase = phases.find((phase) => !phase.completed) ?? phases[0];

  return {
    phaseNumber: nextPhase?.phaseNumber ?? null,
    resolvedFrom: "roadmap"
  };
}

function buildArtifactPath(phaseDir: string, phasePrefix: string, suffix: string): string {
  return `${phaseDir}/${phasePrefix}${suffix}`;
}

function findArtifact(artifacts: string[], suffix: string): string | null {
  return artifacts.find((artifact) => artifact.endsWith(suffix)) ?? null;
}

function extractRequirementIdsFromRequirementsTable(section: string): string[] {
  return extractMarkdownTableRows(section)
    .map((row) => row[0]?.trim() ?? "")
    .filter((id) => DURABLE_REQUIREMENT_ID_PATTERN.test(id));
}

async function readMarkdownDocument(
  projectRoot: string,
  relativePath: string
): Promise<string | null> {
  const absolutePath = resolveBlueprintPath(projectRoot, relativePath);

  if (!(await pathExists(absolutePath))) {
    return null;
  }

  return await fs.readFile(absolutePath, "utf8");
}

async function readPhaseContextGrounding(
  projectRoot: string,
  matchedPhase: ParsedRoadmapPhase | undefined
): Promise<{
  projectBrief: PhaseContextResult["projectBrief"];
  requirementsGrounding: PhaseContextResult["requirementsGrounding"];
  workflowPosture: PhaseContextResult["workflowPosture"];
}> {
  const projectPath = `${BLUEPRINT_DIR}/PROJECT.md`;
  const requirementsPath = `${BLUEPRINT_DIR}/REQUIREMENTS.md`;
  const statePath = `${BLUEPRINT_DIR}/STATE.md`;
  const [projectContent, requirementsContent, stateResult, configResult] = await Promise.all([
    readMarkdownDocument(projectRoot, projectPath),
    readMarkdownDocument(projectRoot, requirementsPath),
    blueprintStateLoad({ cwd: projectRoot }),
    blueprintConfigGet({
      cwd: projectRoot,
      scope: "effective"
    })
  ]);
  const projectWarnings: string[] = [];
  const requirementsWarnings: string[] = [];
  const workflowWarnings: string[] = [];

  const vision = projectContent ? sectionToList(extractMarkdownSection(projectContent, "Vision")) : [];
  const audience = projectContent ? sectionToList(extractMarkdownSection(projectContent, "Audience")) : [];
  const constraints = projectContent
    ? sectionToList(extractMarkdownSection(projectContent, "Constraints"))
    : [];
  const nonGoals = projectContent ? sectionToList(extractMarkdownSection(projectContent, "Non-Goals")) : [];
  const currentMilestone = projectContent
    ? extractMarkdownSection(projectContent, "Current Milestone") || null
    : null;
  const projectTitle = projectContent ? extractMarkdownHeading(projectContent) : null;

  if (!projectContent) {
    projectWarnings.push(`${projectPath} is missing, so the project brief is unavailable.`);
  } else if (
    vision.length === 0 &&
    audience.length === 0 &&
    constraints.length === 0 &&
    nonGoals.length === 0
  ) {
    projectWarnings.push(`${projectPath} is present but does not yet contain a substantive brief.`);
  }

  const requirementsTable = requirementsContent
    ? extractMarkdownSection(requirementsContent, "Requirements Table")
    : "";
  const traceabilityNotes = requirementsContent
    ? sectionToList(extractMarkdownSection(requirementsContent, "Traceability Notes"))
    : [];
  const acceptanceNotes = requirementsContent
    ? sectionToList(extractMarkdownSection(requirementsContent, "Acceptance Notes"))
    : [];
  const deferredItems = requirementsContent
    ? sectionToList(extractMarkdownSection(requirementsContent, "Deferred Items"))
    : [];
  const canonicalRequirementIds = requirementsContent
    ? extractRequirementIdsFromRequirementsTable(requirementsTable)
    : [];
  const roadmapRequirementIds = matchedPhase?.requirements ?? [];

  if (!requirementsContent) {
    requirementsWarnings.push(`${requirementsPath} is missing, so canonical requirement grounding is unavailable.`);
  } else if (canonicalRequirementIds.length === 0) {
    requirementsWarnings.push(
      `${requirementsPath} is present but does not yet expose canonical requirement identifiers.`
    );
  }

  if (requirementsContent && canonicalRequirementIds.length > 0 && roadmapRequirementIds.length === 0) {
    requirementsWarnings.push(
      `Phase requirements are missing from ROADMAP.md for this phase, so the requirement grounding is only partially linked.`
    );
  }

  const projectBriefSummary = summarizeContextPieces(
    [
      projectTitle ? projectTitle.replace(/^Blueprint\s+/, "") : null,
      currentMilestone ? `current milestone: ${currentMilestone}` : null,
      vision[0] ?? null,
      audience[0] ?? null,
      constraints[0] ?? null
    ].filter((piece): piece is string => piece !== null),
    projectContent
      ? "PROJECT.md is present but does not yet provide a reusable project brief."
      : "PROJECT.md is missing."
  );

  const requirementsSummary = summarizeContextPieces(
    [
      canonicalRequirementIds.length > 0
        ? `canonical requirements: ${canonicalRequirementIds.join(", ")}`
        : null,
      roadmapRequirementIds.length > 0
        ? `phase requirements: ${roadmapRequirementIds.join(", ")}`
        : null,
      traceabilityNotes[0] ?? null,
      acceptanceNotes[0] ?? null
    ].filter((piece): piece is string => piece !== null),
    requirementsContent
      ? "REQUIREMENTS.md is present but does not yet provide reusable grounding."
      : "REQUIREMENTS.md is missing."
  );

  const workflow = configResult.config.workflow;
  const researchConfig = configResult.config.research;
  workflowWarnings.push(...configResult.warnings);
  const workflowSummary = summarizeContextPieces(
    [
      stateResult.derivedStatus.projectStatus
        ? `project status: ${stateResult.derivedStatus.projectStatus}`
        : null,
      stateResult.state.currentMilestone
        ? `milestone: ${stateResult.state.currentMilestone}`
        : null,
      stateResult.derivedStatus.currentPhase
        ? `phase: ${stateResult.derivedStatus.currentPhase}`
        : null,
      workflow.discuss_mode ? `discuss_mode: ${workflow.discuss_mode}` : null,
      workflow.skip_discuss ? "skip_discuss enabled" : "skip_discuss disabled",
      workflow.research_before_questions
        ? "research_before_questions enabled"
        : "research_before_questions disabled",
      `external sources: ${researchConfig.external_sources}`,
      stateResult.derivedStatus.nextAction ? `next action: ${stateResult.derivedStatus.nextAction}` : null
    ].filter((piece): piece is string => piece !== null),
    "Workflow posture is unavailable."
  );

  return {
    projectBrief: {
      found: projectContent !== null,
      path: projectContent ? projectPath : null,
      title: projectTitle,
      summary: projectBriefSummary,
      vision,
      audience,
      constraints,
      currentMilestone,
      nonGoals,
      warnings: projectWarnings
    },
    requirementsGrounding: {
      found: requirementsContent !== null,
      path: requirementsContent ? requirementsPath : null,
      canonicalRequirementIds,
      roadmapRequirementIds,
      traceabilityNotes,
      acceptanceNotes,
      deferredItems,
      summary: requirementsSummary,
      warnings: requirementsWarnings
    },
    workflowPosture: {
      path: statePath,
      projectStatus: stateResult.derivedStatus.projectStatus,
      currentMilestone: stateResult.state.currentMilestone,
      currentPhase: stateResult.derivedStatus.currentPhase,
      activeCommand: stateResult.state.activeCommand,
      nextAction: stateResult.derivedStatus.nextAction,
      blockers: stateResult.blockers,
      workflow: {
        research: workflow.research,
        planCheck: workflow.plan_check,
        verifier: workflow.verifier,
        nyquistValidation: workflow.nyquist_validation,
        uiPhase: workflow.ui_phase,
        uiSafetyGate: workflow.ui_safety_gate,
        codeReview: workflow.code_review,
        autoAdvance: workflow.auto_advance,
        researchBeforeQuestions: workflow.research_before_questions,
        discussMode: workflow.discuss_mode,
        skipDiscuss: workflow.skip_discuss,
        useWorktrees: workflow.use_worktrees
      },
      research: {
        externalSources: researchConfig.external_sources
      },
      summary: workflowSummary,
      warnings: workflowWarnings
    }
  };
}

async function readMappedCodebaseContext(
  projectRoot: string
): Promise<PhaseContextResult["codebase"]> {
  const inspection = await inspectBlueprintArtifacts(projectRoot);
  const artifacts: string[] = [];
  const missingArtifacts: string[] = [];
  const invalidArtifacts = new Set(inspection.codebase.invalid);
  const digest: PhaseContextResult["codebase"]["digest"] = [];

  for (const artifact of CODEBASE_ARTIFACTS) {
    if (invalidArtifacts.has(artifact)) {
      continue;
    }

    const absolutePath = resolveBlueprintPath(projectRoot, artifact);

    try {
      const raw = await fs.readFile(absolutePath, "utf8");
      const summary = summarizeSavedArtifact(raw);
      artifacts.push(artifact);
      digest.push({
        artifact,
        title: summary.title,
        summary: summary.summary
      });
    } catch (error) {
      const missing =
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT";

      if (missing) {
        missingArtifacts.push(artifact);
        continue;
      }

      throw error;
    }
  }

  const mapped = inspection.codebase.mapped;
  const warnings: string[] = [];

  if (artifacts.length > 0 && !mapped) {
    const missingBit = missingArtifacts.length > 0 ? `missing ${missingArtifacts.join(", ")}` : "";
    const invalidBit =
      inspection.codebase.invalid.length > 0
        ? `invalid ${inspection.codebase.invalid.join(", ")}`
        : "";
    warnings.push(
      `Mapped codebase bundle is incomplete or non-canonical: ${[missingBit, invalidBit]
        .filter((value) => value.length > 0)
        .join("; ")}.`
    );
  }

  if (mapped) {
    warnings.push(
      "Mapped codebase summaries are available and should be reused before rereading broad repo surfaces."
    );
  } else if (inspection.codebase.invalid.length > 0) {
    warnings.push(
      "Saved codebase docs exist but are not yet valid enough to reuse as authoritative mapped context."
    );
  }

  return {
    mapped,
    artifacts,
    missingArtifacts,
    digest,
    warnings
  };
}

type PhaseArtifactUsability = {
  present: boolean;
  valid: boolean | null;
  usable: boolean;
  issues: string[];
  diagnostics: PhaseArtifactValidationDiagnostic[];
  warnings: string[];
  unreadable: boolean;
};

async function evaluatePhaseArtifactUsability(
  projectRoot: string,
  artifactPath: string | null,
  artifact: PhaseArtifactKind
): Promise<PhaseArtifactUsability> {
  if (!artifactPath) {
    return {
      present: false,
      valid: null,
      usable: false,
      issues: [],
      diagnostics: [],
      warnings: [],
      unreadable: false
    };
  }

  const absolutePath = resolveBlueprintPath(projectRoot, artifactPath);

  try {
    const raw = await fs.readFile(absolutePath, "utf8");
    const validation = validatePhaseArtifactContent(raw, artifact);
    const bootstrapStarter = artifact === "context" && isBootstrapStarterContext(raw);
    const issues = [...validation.issues];
    const diagnostics = [...validation.diagnostics];
    const warnings = [...validation.warnings];

    if (bootstrapStarter) {
      const issue =
        "Context artifact is still the bootstrap starter and must be replaced through /blu-discuss-phase before planning.";
      issues.push(issue);
      diagnostics.push({
        path: artifactPath,
        code: "context.bootstrap_starter",
        message: issue,
        repair: `Replace ${artifactPath} through /blu-discuss-phase before planning.`,
        retryable: true,
        nextTool: "blueprint_phase_research_status"
      });
      warnings.push(
        `${artifactPath} is still the bootstrap starter context; replace it through /blu-discuss-phase before planning.`
      );
    }

    return {
      present: true,
      valid: validation.valid,
      usable: validation.valid && !bootstrapStarter,
      issues,
      diagnostics,
      warnings,
      unreadable: false
    };
  } catch (error) {
    const reason =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "unknown read failure";

    return {
      present: true,
      valid: false,
      usable: false,
      issues: [`${artifactPath} could not be read: ${reason}.`],
      diagnostics: [
        {
          path: artifactPath,
          code: `${artifact}.unreadable`,
          message: `${artifactPath} could not be read: ${reason}.`,
          repair: `Restore or regenerate ${artifactPath}, then retry the readiness check.`,
          retryable: true,
          nextTool: "blueprint_phase_research_status"
        }
      ],
      warnings: [`${artifactPath} is stale, deleted, or unreadable: ${reason}.`],
      unreadable: true
    };
  }
}

function buildPhasePlanningReadiness(args: {
  context: PhaseContextResult;
  contextStatus: PhaseArtifactUsability;
  researchPath: string | null;
  researchValid: boolean | null;
  uiSpecStatus: PhaseArtifactUsability;
}): PhasePlanningReadiness {
  const phaseNumber = args.context.phase?.phaseNumber ?? null;
  const workflow = args.context.workflowPosture.workflow;
  const phaseSuffix = phaseNumber ? ` ${phaseNumber}` : "";
  const progressAction = "Run /blu-progress to review the next safe Blueprint action";

  if (!phaseNumber) {
    return {
      workflowResearchRequired: workflow.research,
      workflowUiPhaseRequired: workflow.uiPhase,
      workflowUiSafetyGateEnabled: workflow.uiSafetyGate,
      readyForPlanPhase: false,
      nextSafeAction: progressAction,
      blockers: ["Phase planning readiness could not be resolved because the phase was not found."]
    };
  }

  if (!args.contextStatus.usable) {
    const contextIssueBlockers = args.contextStatus.issues.map((issue) => `Context validation: ${issue}`);

    return {
      workflowResearchRequired: workflow.research,
      workflowUiPhaseRequired: workflow.uiPhase,
      workflowUiSafetyGateEnabled: workflow.uiSafetyGate,
      readyForPlanPhase: false,
      nextSafeAction: `Run /blu-discuss-phase${phaseSuffix} to rebuild the current phase context`,
      blockers: [
        args.contextStatus.present
          ? "Saved phase context exists but is not usable for planning."
          : "Phase planning requires a usable XX-CONTEXT.md artifact.",
        ...contextIssueBlockers
      ],
      ...(args.contextStatus.diagnostics.length > 0
        ? { diagnostics: args.contextStatus.diagnostics }
        : {})
    };
  }

  if (workflow.research && args.researchValid !== true) {
    return {
      workflowResearchRequired: workflow.research,
      workflowUiPhaseRequired: workflow.uiPhase,
      workflowUiSafetyGateEnabled: workflow.uiSafetyGate,
      readyForPlanPhase: false,
      nextSafeAction: args.researchPath
        ? `Run /blu-research-phase${phaseSuffix} to repair invalid phase research`
        : `Run /blu-research-phase${phaseSuffix} to capture phase research`,
      blockers: [
        args.researchPath
          ? "workflow.research=true but the saved XX-RESEARCH.md artifact is not usable."
          : "workflow.research=true but no XX-RESEARCH.md artifact is saved."
      ]
    };
  }

  if (workflow.uiPhase && !args.uiSpecStatus.usable) {
    const uiSpecIssueBlockers = args.uiSpecStatus.issues.map((issue) => `UI spec validation: ${issue}`);

    return {
      workflowResearchRequired: workflow.research,
      workflowUiPhaseRequired: workflow.uiPhase,
      workflowUiSafetyGateEnabled: workflow.uiSafetyGate,
      readyForPlanPhase: false,
      nextSafeAction: `Run /blu-ui-phase${phaseSuffix} to draft the phase UI contract`,
      blockers: [
        args.uiSpecStatus.present
          ? "workflow.ui_phase=true but the saved XX-UI-SPEC.md artifact is not usable."
          : "workflow.ui_phase=true but no XX-UI-SPEC.md artifact is saved.",
        ...uiSpecIssueBlockers
      ],
      ...(args.uiSpecStatus.diagnostics.length > 0
        ? { diagnostics: args.uiSpecStatus.diagnostics }
        : {})
    };
  }

  return {
    workflowResearchRequired: workflow.research,
    workflowUiPhaseRequired: workflow.uiPhase,
    workflowUiSafetyGateEnabled: workflow.uiSafetyGate,
    readyForPlanPhase: true,
    nextSafeAction: `Run /blu-plan-phase${phaseSuffix} to create execution-ready phase plans`,
    blockers: []
  };
}

function buildLocateRecovery(reason: string | null): string[] {
  if (!reason) {
    return [];
  }

  if (reason.includes("no matching directory")) {
    return [
      "Create or restore the numbered phase directory under .blueprint/phases/ so it matches ROADMAP.md.",
      "Run /blu-discuss-phase after the directory exists to rebuild missing discovery artifacts."
    ];
  }

  if (reason.includes("multiple matching directories")) {
    return [
      "Rename duplicate phase directories so only one directory matches the requested phase number.",
      "Run /blu-health to confirm the phase tree is normalized before retrying discovery commands."
    ];
  }

  if (reason.includes("ROADMAP.md")) {
    return [
      "Restore .blueprint/ROADMAP.md or reinitialize the project with /blu-new-project.",
      "Run /blu-health after restoring artifacts to confirm Blueprint state is consistent."
    ];
  }

  return [
    "Confirm the requested phase exists in .blueprint/ROADMAP.md and has a matching numbered directory.",
    "Use /blu-progress if you need the safest currently implemented next action."
  ];
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

function fallbackPhaseName(phaseDir: string): string {
  return slugToTitle(path.basename(phaseDir).replace(/^\d+(?:\.\d+)?-/, ""));
}

function toResolvedPhaseLocation(
  located: PhaseLocateResult
): ResolvedPhaseLocation | null {
  if (!located.found || !located.phaseNumber || !located.phasePrefix || !located.phaseDir) {
    return null;
  }

  return {
    phaseNumber: located.phaseNumber,
    phasePrefix: located.phasePrefix,
    phaseName: located.phaseName ?? fallbackPhaseName(located.phaseDir),
    phaseDir: located.phaseDir
  };
}

function artifactPathFor(located: Pick<ResolvedPhaseLocation, "phaseDir" | "phasePrefix">, artifact: PhaseArtifactKind): string {
  return buildArtifactPath(
    located.phaseDir,
    located.phasePrefix,
    PHASE_ARTIFACT_SUFFIXES[artifact]
  );
}

function validationArtifactPathFor(
  located: Pick<ResolvedPhaseLocation, "phaseDir" | "phasePrefix">,
  artifact: PhaseValidationArtifactKind
): string {
  return buildArtifactPath(
    located.phaseDir,
    located.phasePrefix,
    PHASE_VALIDATION_ARTIFACT_SUFFIXES[artifact]
  );
}

function checkpointPathFor(located: Pick<ResolvedPhaseLocation, "phaseDir" | "phasePrefix">): string {
  return buildArtifactPath(located.phaseDir, located.phasePrefix, PHASE_CHECKPOINT_SUFFIX);
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

  if (uncoveredRequirementIds.length > 0) {
    const message = `Phase ${resolved.phaseNumber} plan set does not cover roadmap requirements: ${uncoveredRequirementIds.join(", ")}.`;

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

function parseSummaryArtifactPath(
  pathValue: string,
  phasePrefix: string
): string | null {
  const match = pathValue.match(
    new RegExp(`${phasePrefix.replace(".", "\\.")}-(\\d+)-SUMMARY\\.md$`)
  );

  return match ? normalizePlanId(match[1]) : null;
}

function summaryPathFor(
  located: Pick<ResolvedPhaseLocation, "phaseDir" | "phasePrefix">,
  planId: string
): string {
  return buildArtifactPath(
    located.phaseDir,
    located.phasePrefix,
    `-${normalizePlanId(planId)}-SUMMARY.md`
  );
}

function normalizeExecutionSurfacePath(value: string): string {
  const normalized = value.replaceAll("\\", "/").trim();
  const withoutDotPrefix = normalized.replace(/^\.\//, "");
  const collapsed = path.posix.normalize(withoutDotPrefix);

  if (collapsed === ".") {
    return withoutDotPrefix.replace(/\/+$/u, "");
  }

  return collapsed.replace(/\/+$/u, "");
}

function classifyExecutionSurfaceKind(
  source: "files_modified" | "read_first",
  value: string
): "files_modified" | "read_first" | "generated_artifact" | "other" {
  const normalized = normalizeExecutionSurfacePath(value);

  if (source === "files_modified" && (/^\.blueprint\//u.test(normalized) || /^dist\//u.test(normalized))) {
    return "generated_artifact";
  }

  return source;
}

function executionSurfacePathsOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function executionSurfaceSharedValue(left: string, right: string): string {
  if (left === right) {
    return left;
  }

  return left.startsWith(`${right}/`) ? right : left;
}

function uniqueSortedStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function planExecutionSurfaces(
  plan: PhasePlanRecord
): Array<{
  kind: "files_modified" | "read_first" | "generated_artifact" | "other";
  value: string;
}> {
  const surfaces = [
    ...plan.filesModified.map((value) => ({
      kind: classifyExecutionSurfaceKind("files_modified", value),
      value: normalizeExecutionSurfacePath(value)
    })),
    ...plan.readFirst.map((value) => ({
      kind: classifyExecutionSurfaceKind("read_first", value),
      value: normalizeExecutionSurfacePath(value)
    }))
  ];
  const seen = new Set<string>();

  return surfaces.filter((surface) => {
    if (surface.value.length === 0) {
      return false;
    }

    const key = `${surface.kind}:${surface.value}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function sharedExecutionSurfaces(
  left: PhasePlanRecord,
  right: PhasePlanRecord
): PhaseExecutionTargetConflictSurface[] {
  const shared = new Map<string, PhaseExecutionTargetConflictSurface>();
  const leftSurfaces = planExecutionSurfaces(left);
  const rightSurfaces = planExecutionSurfaces(right);

  for (const leftSurface of leftSurfaces) {
    for (const rightSurface of rightSurfaces) {
      if (!executionSurfacePathsOverlap(leftSurface.value, rightSurface.value)) {
        continue;
      }

      const value = executionSurfaceSharedValue(leftSurface.value, rightSurface.value);
      const kinds = uniqueSortedStrings([leftSurface.kind, rightSurface.kind]) as Array<
        "files_modified" | "read_first" | "generated_artifact" | "other"
      >;
      const key = `${value}:${kinds.join(",")}`;

      if (!shared.has(key)) {
        shared.set(key, { value, kinds });
      }
    }
  }

  return [...shared.values()].sort((leftSurface, rightSurface) =>
    leftSurface.value.localeCompare(rightSurface.value)
  );
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

function normalizeSummaryMarkerValue(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();

  if (
    (trimmed.startsWith("`") && trimmed.endsWith("`")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function phaseSummaryCompletedRoute(args: {
  phaseNumber: string;
  hasRemainingPendingPlans: boolean;
}): PhaseSummaryCompletedRoute {
  return args.hasRemainingPendingPlans
    ? {
        readiness: "not-ready-for-validation",
        nextSafeAction: `/blu-execute-phase ${args.phaseNumber}`
      }
    : {
        readiness: "ready-for-validation",
        nextSafeAction: `/blu-validate-phase ${args.phaseNumber}`
      };
}

function remainingPlanIdsAfterSelectedCompletion(args: {
  planIds: string[];
  completedPlanIds: ReadonlySet<string>;
  selectedPlanId: string;
}): string[] {
  const completedAfterSelection = new Set(args.completedPlanIds);
  completedAfterSelection.add(args.selectedPlanId);

  return args.planIds.filter((planId) => !completedAfterSelection.has(planId));
}

function completedRouteAfterSelectedCompletion(args: {
  phaseNumber: string;
  planIds: string[];
  completedPlanIds: ReadonlySet<string>;
  selectedPlanId: string;
}): PhaseSummaryCompletedRoute {
  return phaseSummaryCompletedRoute({
    phaseNumber: args.phaseNumber,
    hasRemainingPendingPlans:
      remainingPlanIdsAfterSelectedCompletion(args).length > 0
  });
}

function routesMatch(
  actual: { readiness: string | null; nextSafeAction: string | null },
  expected: PhaseSummaryCompletedRoute
): boolean {
  return (
    actual.readiness === expected.readiness &&
    actual.nextSafeAction === expected.nextSafeAction
  );
}

function formatCompletedSummaryRoute(route: PhaseSummaryCompletedRoute): string {
  return `**Readiness:** ${route.readiness} and **Next Safe Action:** ${route.nextSafeAction}`;
}

function extractPhaseSummaryMarkerValue(content: string, marker: string): string | null {
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`^\\*\\*${escapedMarker}:\\*\\*\\s*(.+)$`, "m"));

  return normalizeSummaryMarkerValue(match?.[1] ?? null);
}

function dependencyPlanRowsForPlan(
  dependsOn: string[],
  availablePlanIds: ReadonlySet<string>,
  resolved: Pick<ResolvedPhaseLocation, "phaseDir" | "phasePrefix">
): Array<{ planId: string; path: string }> {
  return dependsOn.flatMap((dependency) => {
    try {
      const normalizedDependency = normalizePlanId(dependency);

      return availablePlanIds.has(normalizedDependency)
        ? [
            {
              planId: normalizedDependency,
              path: planPathFor(resolved, normalizedDependency)
            }
          ]
        : [];
    } catch {
      return [];
    }
  });
}

function normalizeDependencyPlanIds(dependsOn: string[]): string[] {
  return dependsOn.flatMap((dependency) => {
    try {
      return [normalizePlanId(dependency)];
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

function normalizeTextContent(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function summarizeMarkdownContent(content: string): {
  title: string | null;
  summary: string | null;
} {
  const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
  const summary =
    content
      .split("\n")
      .map((line) => line.trim())
      .find(
        (line) =>
          line.length > 0 &&
          !line.startsWith("#") &&
          line !== "---" &&
          !line.startsWith("*Generated by")
      ) ?? null;

  return {
    title,
    summary
  };
}

function toPhaseSummaryRecord(
  planId: string,
  pathValue: string,
  content: string,
  linkedPlanPath: string | null
): PhaseSummaryRecord {
  const metadata = summarizeMarkdownContent(content);
  const status = extractSummaryStatus(content);

  return {
    planId,
    path: pathValue,
    linkedPlanPath,
    status,
    title: metadata.title,
    summary: metadata.summary
  };
}

function isLegacySummaryWithoutStatus(content: string): boolean {
  return extractSummaryMarkerValue(content, "Status") === null;
}

function summaryCountsAsCompleted(status: PhaseSummaryRecord["status"], content: string): boolean {
  return status === "COMPLETED" || (status === null && isLegacySummaryWithoutStatus(content));
}

async function collectValidatedSummaryPaths(
  projectRoot: string,
  summaries: PhaseSummaryRecord[]
): Promise<{
  summaryPaths: string[];
  warnings: string[];
}> {
  const summaryPaths: string[] = [];
  const warnings: string[] = [];

  for (const summary of summaries) {
    const content = await fs.readFile(resolveBlueprintPath(projectRoot, summary.path), "utf8");
    const validation = validateStrictSummaryArtifactContent(content, {
      linkedPlanPath: summary.linkedPlanPath
    });

    if (validation.valid) {
      summaryPaths.push(summary.path);
      continue;
    }

    warnings.push(
      `${summary.path}: summary artifact is invalid and does not count as completed execution evidence.`
    );
    warnings.push(...validation.issues.map((issue) => `${summary.path}: ${issue}`));
    warnings.push(...validation.warnings.map((warning) => `${summary.path}: ${warning}`));
  }

  return { summaryPaths, warnings };
}

function completedSummaryRecords(
  summaries: PhaseSummaryRecord[],
  completedPlanIds?: ReadonlySet<string>
): PhaseSummaryRecord[] {
  return summaries.filter(
    (summary) =>
      (completedPlanIds === undefined || completedPlanIds.has(summary.planId))
  );
}

function collectReferencedValidatedSummaryPaths(
  content: string,
  summaries: PhaseSummaryRecord[],
  completedPlans: ReadonlySet<string>
): string[] {
  const references = new Map<string, number>();

  for (const summary of summaries) {
    if (!completedPlans.has(summary.planId)) {
      continue;
    }

    const fileName = summary.path.split("/").pop() ?? summary.path;
    const firstMatch = [summary.path, fileName]
      .map((candidate) => content.indexOf(candidate))
      .filter((index) => index >= 0)
      .sort((left, right) => left - right)[0];

    if (firstMatch === undefined) {
      continue;
    }

    references.set(summary.path, firstMatch);
  }

  return [...references.entries()]
    .sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0]))
    .map(([summaryPath]) => summaryPath);
}

function phaseSummaryContractContext(
  resolved?: ResolvedPhaseLocation,
  planId?: string
): {
  phaseLabel?: string;
  phasePrefix?: string;
  phaseName?: string;
  phaseDir?: string;
  planId?: string;
  summaryFile?: string;
  summaryPath?: string;
} {
  if (!resolved) {
    return {};
  }

  const normalizedPlanId = planId ? normalizePlanId(planId) : "01";

  return {
    phaseLabel: `Phase ${resolved.phasePrefix}: ${resolved.phaseName}`,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    planId: normalizedPlanId,
    summaryFile: `${resolved.phasePrefix}-${normalizedPlanId}-SUMMARY.md`,
    summaryPath: summaryPathFor(resolved, normalizedPlanId)
  };
}

function phaseSummaryDiagnostic(
  args: PhaseSummaryModelDiagnostic
): PhaseSummaryModelDiagnostic {
  return args;
}

function emptyPhaseSummaryDiagnosticCounts(): PhaseSummaryValidateModelResult["diagnosticCounts"] {
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

function countPhaseSummaryDiagnostics(
  diagnostics: PhaseSummaryModelDiagnostic[]
): PhaseSummaryValidateModelResult["diagnosticCounts"] {
  const counts = emptyPhaseSummaryDiagnosticCounts();

  for (const diagnostic of diagnostics) {
    counts.total += 1;
    counts.bySource[diagnostic.source] += 1;
    counts.byCode[diagnostic.code] = (counts.byCode[diagnostic.code] ?? 0) + 1;
  }

  return counts;
}

function formatPhaseSummaryDiagnostic(diagnostic: PhaseSummaryModelDiagnostic): string {
  return `${diagnostic.source}:${diagnostic.path}:${diagnostic.code}: ${diagnostic.message} Suggestion: ${diagnostic.suggestion}`;
}

async function buildPhaseSummaryAllowedNextActions(phaseNumber: string): Promise<{
  readyAction: string;
  partialAction: string;
  blockedAction: string;
  allowedActions: string[];
}> {
  const readyAction = `/blu-validate-phase ${phaseNumber}`;
  const partialAction = `/blu-execute-phase ${phaseNumber}`;
  const blockedAction = "/blu-progress";
  const fallback = [readyAction, partialAction, blockedAction];
  const implementedCommands = await getPhasePlanImplementedCommandNames();

  if (implementedCommands === null || implementedCommands.size === 0) {
    return {
      readyAction,
      partialAction,
      blockedAction,
      allowedActions: fallback
    };
  }

  const filterImplemented = (actions: string[]): string[] =>
    actions.filter((action) =>
      extractBlueprintDirectCommands(action).every((command) =>
        implementedCommands.has(command)
      )
    );
  const implemented = filterImplemented(fallback);

  return {
    readyAction: implemented.includes(readyAction) ? readyAction : readyAction,
    partialAction: implemented.includes(partialAction) ? partialAction : partialAction,
    blockedAction: implemented.includes(blockedAction) ? blockedAction : blockedAction,
    allowedActions: implemented.length > 0 ? implemented : fallback
  };
}

function normalizeModelStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return null;
  }

  return value.map((item) => item.trim());
}

function normalizePhaseSummaryModel(
  model: Record<string, unknown>
): PhaseSummaryStructuredModel | null {
  const outcome = normalizeModelStringArray(model.outcome);
  const changesMade = normalizeModelStringArray(model.changesMade);
  const followUps = normalizeModelStringArray(model.followUps);
  const targetedVerification = Array.isArray(model.targetedVerification)
    ? model.targetedVerification
    : null;
  const dependencyPlans = Array.isArray(model.dependencyPlans) ? model.dependencyPlans : null;
  const manualOrDeferredWork = Array.isArray(model.manualOrDeferredWork)
    ? model.manualOrDeferredWork
    : null;
  const gapRoutes = Array.isArray(model.gapRoutes) ? model.gapRoutes : null;
  const evidence = Array.isArray(model.evidence) ? model.evidence : null;

  if (
    typeof model.status !== "string" ||
    typeof model.readiness !== "string" ||
    typeof model.completionState !== "string" ||
    outcome === null ||
    changesMade === null ||
    targetedVerification === null ||
    dependencyPlans === null ||
    manualOrDeferredWork === null ||
    gapRoutes === null ||
    followUps === null ||
    evidence === null ||
    typeof model.nextSafeAction !== "string"
  ) {
    return null;
  }

  const normalizedVerification = targetedVerification.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.check === "string" &&
      typeof rowObject.command === "string" &&
      typeof rowObject.result === "string" &&
      typeof rowObject.evidence === "string" &&
      typeof rowObject.notes === "string"
      ? {
          check: rowObject.check.trim(),
          command: rowObject.command.trim(),
          result: rowObject.result as PhaseSummaryVerificationResult,
          evidence: rowObject.evidence.trim(),
          notes: rowObject.notes.trim()
        }
      : null;
  });
  const normalizedDependencies = dependencyPlans.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.planId === "string" &&
      typeof rowObject.path === "string" &&
      typeof rowObject.status === "string" &&
      typeof rowObject.evidence === "string"
      ? {
          planId: rowObject.planId.trim(),
          path: rowObject.path.trim(),
          status: rowObject.status as "satisfied",
          evidence: rowObject.evidence.trim()
        }
      : null;
  });
  const normalizedManual = manualOrDeferredWork.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.item === "string" &&
      typeof rowObject.reason === "string" &&
      typeof rowObject.followUp === "string" &&
      typeof rowObject.status === "string"
      ? {
          item: rowObject.item.trim(),
          reason: rowObject.reason.trim(),
          followUp: rowObject.followUp.trim(),
          status: rowObject.status as PhaseSummaryManualStatus
        }
      : null;
  });
  const normalizedGaps = gapRoutes.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.gap === "string" &&
      typeof rowObject.evidence === "string" &&
      typeof rowObject.repair === "string" &&
      typeof rowObject.status === "string"
      ? {
          gap: rowObject.gap.trim(),
          evidence: rowObject.evidence.trim(),
          repair: rowObject.repair.trim(),
          status: rowObject.status as PhaseSummaryGapStatus
        }
      : null;
  });
  const normalizedEvidence = evidence.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.kind === "string" &&
      typeof rowObject.source === "string" &&
      typeof rowObject.summary === "string"
      ? {
          kind: rowObject.kind as PhaseSummaryEvidenceKind,
          source: rowObject.source.trim(),
          summary: rowObject.summary.trim()
        }
      : null;
  });

  if (
    normalizedVerification.some((row) => row === null) ||
    normalizedDependencies.some((row) => row === null) ||
    normalizedManual.some((row) => row === null) ||
    normalizedGaps.some((row) => row === null) ||
    normalizedEvidence.some((row) => row === null)
  ) {
    return null;
  }

  return {
    status: model.status as PhaseSummaryStatus,
    readiness: model.readiness as PhaseSummaryReadiness,
    completionState: model.completionState as PhaseSummaryCompletionState,
    outcome,
    changesMade,
    targetedVerification: normalizedVerification as PhaseSummaryStructuredModel["targetedVerification"],
    dependencyPlans: normalizedDependencies as PhaseSummaryStructuredModel["dependencyPlans"],
    manualOrDeferredWork: normalizedManual as PhaseSummaryStructuredModel["manualOrDeferredWork"],
    gapRoutes: normalizedGaps as PhaseSummaryStructuredModel["gapRoutes"],
    followUps,
    evidence: normalizedEvidence as PhaseSummaryStructuredModel["evidence"],
    nextSafeAction: model.nextSafeAction.trim()
  };
}

function renderSummaryTable(headers: string[], rows: string[][]): string {
  const separator = headers.map(() => "---");
  const renderedRows = rows.length > 0 ? rows : [headers.map(() => "none")];

  return [headers, separator, ...renderedRows]
    .map((row) => `| ${row.map(markdownCell).join(" | ")} |`)
    .join("\n");
}

function renderPhaseSummaryModelContent(args: {
  model: PhaseSummaryStructuredModel;
  resolved: ResolvedPhaseLocation;
  planId: string;
  linkedPlanPath: string;
  summaryPath: string;
}): string {
  const dependencyRows =
    args.model.dependencyPlans.length > 0
      ? args.model.dependencyPlans.map((row) => [
          `${row.planId} (${row.path})`,
          row.status,
          row.evidence
        ])
      : [["none", "none", "none"]];
  const evidenceRows = [
    ["artifact", args.linkedPlanPath, "Linked plan path supplied by MCP."],
    ["artifact", args.summaryPath, "Canonical summary path supplied by MCP."],
    ...args.model.evidence.map((row) => [row.kind, row.source, row.summary])
  ];

  return `# Phase ${args.resolved.phasePrefix}: ${args.resolved.phaseName} - Summary ${args.planId}

**Plan:** \`${args.linkedPlanPath}\`
**Status:** ${args.model.status}
**Readiness:** ${args.model.readiness}
**Completion State:** ${args.model.completionState}
**Next Safe Action:** ${args.model.nextSafeAction}

## Outcome

${renderBulletList(args.model.outcome)}

## Changes Made

${renderBulletList(args.model.changesMade)}

## Verification

${renderSummaryTable(
  ["Check", "Command", "Result", "Evidence", "Notes"],
  args.model.targetedVerification.map((row) => [
    row.check,
    row.command,
    row.result,
    row.evidence,
    row.notes
  ])
)}

## Dependency Plans

${renderSummaryTable(["Plan", "Status", "Evidence"], dependencyRows)}

## Manual / Deferred Work

${renderSummaryTable(
  ["Item", "Reason", "Follow-Up", "Status"],
  args.model.manualOrDeferredWork.map((row) => [
    row.item,
    row.reason,
    row.followUp,
    row.status
  ])
)}

## Gap / Repair Routes

${renderSummaryTable(
  ["Gap", "Evidence", "Repair", "Status"],
  args.model.gapRoutes.map((row) => [row.gap, row.evidence, row.repair, row.status])
)}

## Follow-Ups

${renderBulletList(args.model.followUps)}

## Evidence

${renderSummaryTable(["Kind", "Source", "Summary"], evidenceRows)}
`;
}

const PHASE_VALIDATION_ALLOWED_VALUES: PhaseValidationAllowedValues = {
  verification: {
    gateStates: ["PASS", "PARTIAL", "BLOCKED"],
    coverageStates: ["PASS", "COVERED", "covered", "MANUAL", "DEFERRED", "BLOCKED"],
    manualCoverageStatuses: ["MANUAL", "DEFERRED", "NONE"],
    gapClasses: [
      "missing-evidence",
      "partial-coverage",
      "manual-only",
      "deferred-test",
      "contradiction",
      "none"
    ],
    readinessByGate: {
      PASS: "ready for UAT",
      PARTIAL: "not ready for UAT",
      BLOCKED: "not ready for UAT"
    },
    readyForUatCommand: "/blu-verify-work",
    repairCommands: ["/blu-add-tests", "/blu-audit-fix"]
  },
  uat: {
    statuses: ["PASS", "FAIL", "PARTIAL"],
    resumeStates: ["RESUMED", "NEW", "CONTINUED"],
    completeCheckpoint: "none",
    testResults: ["pending", "pass", "issue", "skipped", "blocked"],
    structuredGapStatuses: ["failed", "partial", "blocked", "none"],
    structuredGapSeverities: ["blocker", "major", "minor", "cosmetic", "none"]
  }
};

function clonePhaseValidationAllowedValues(): PhaseValidationAllowedValues {
  return {
    verification: {
      gateStates: [...PHASE_VALIDATION_ALLOWED_VALUES.verification.gateStates],
      coverageStates: [...PHASE_VALIDATION_ALLOWED_VALUES.verification.coverageStates],
      manualCoverageStatuses: [
        ...PHASE_VALIDATION_ALLOWED_VALUES.verification.manualCoverageStatuses
      ],
      gapClasses: [...PHASE_VALIDATION_ALLOWED_VALUES.verification.gapClasses],
      readinessByGate: {
        ...PHASE_VALIDATION_ALLOWED_VALUES.verification.readinessByGate
      },
      readyForUatCommand: PHASE_VALIDATION_ALLOWED_VALUES.verification.readyForUatCommand,
      repairCommands: [...PHASE_VALIDATION_ALLOWED_VALUES.verification.repairCommands]
    },
    uat: {
      statuses: [...PHASE_VALIDATION_ALLOWED_VALUES.uat.statuses],
      resumeStates: [...PHASE_VALIDATION_ALLOWED_VALUES.uat.resumeStates],
      completeCheckpoint: PHASE_VALIDATION_ALLOWED_VALUES.uat.completeCheckpoint,
      testResults: [...PHASE_VALIDATION_ALLOWED_VALUES.uat.testResults],
      structuredGapStatuses: [...PHASE_VALIDATION_ALLOWED_VALUES.uat.structuredGapStatuses],
      structuredGapSeverities: [...PHASE_VALIDATION_ALLOWED_VALUES.uat.structuredGapSeverities]
    }
  };
}

function validationArtifactContractId(
  artifact: PhaseValidationArtifactKind
): "phase.verification" | "phase.uat" {
  return artifact === "verification" ? "phase.verification" : "phase.uat";
}

function validationArtifactContractContext(
  resolved?: ResolvedPhaseLocation
): {
  phaseLabel?: string;
  phasePrefix?: string;
  phaseName?: string;
  phaseDir?: string;
  summaryFile?: string;
  summaryPath?: string;
} {
  if (!resolved) {
    return {};
  }

  return {
    phaseLabel: `Phase ${resolved.phasePrefix}: ${resolved.phaseName}`,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    summaryFile: `${resolved.phasePrefix}-01-SUMMARY.md`,
    summaryPath: `${resolved.phaseDir}/${resolved.phasePrefix}-01-SUMMARY.md`
  };
}

function validationArtifactContract(
  artifact: PhaseValidationArtifactKind,
  resolved?: ResolvedPhaseLocation
): ArtifactContractReadResult {
  return readArtifactContract(
    validationArtifactContractId(artifact),
    validationArtifactContractContext(resolved)
  );
}

type CommandCatalogResult = {
  commands: Record<string, { implemented: boolean }>;
};

let phasePlanImplementedCommandNamesPromise: Promise<Set<string> | null> | null = null;

function collectModelStringValues(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectModelStringValues(item));
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap((item) => collectModelStringValues(item));
  }

  return [];
}

function cloneJsonObject<T extends Record<string, unknown>>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asJsonObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function getJsonObjectProperty(
  value: Record<string, unknown>,
  key: string
): Record<string, unknown> | null {
  return asJsonObject(value[key]);
}

function createAjvValidator(): Ajv2020 {
  return new Ajv2020({
    allErrors: true,
    strict: false,
    validateSchema: true
  });
}

function phasePlanDiagnostic(args: PhasePlanModelDiagnostic): PhasePlanModelDiagnostic {
  const modelPath =
    args.modelPath ?? (args.path === "model" || args.path.startsWith("model.") ? args.path : undefined);
  const jsonPointer =
    args.jsonPointer !== undefined
      ? args.jsonPointer
      : modelPath
        ? phasePlanModelPathToJsonPointer(modelPath)
        : null;

  return {
    severity: "error",
    ...args,
    modelPath,
    jsonPointer
  };
}

function emptyPhasePlanDiagnosticCounts(): PhasePlanValidateModelResult["diagnosticCounts"] {
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

function countPhasePlanDiagnostics(
  diagnostics: PhasePlanModelDiagnostic[]
): PhasePlanValidateModelResult["diagnosticCounts"] {
  const counts = emptyPhasePlanDiagnosticCounts();

  for (const diagnostic of diagnostics) {
    counts.total += 1;
    counts.bySource[diagnostic.source] += 1;
    counts.byCode[diagnostic.code] = (counts.byCode[diagnostic.code] ?? 0) + 1;
  }

  return counts;
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

function summarizePhasePlanRepairs(
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

function formatPhasePlanDiagnostic(diagnostic: PhasePlanModelDiagnostic): string {
  const pathHint = diagnostic.jsonPointer
    ? `${diagnostic.path} (${diagnostic.jsonPointer})`
    : diagnostic.path;
  const actionHint = diagnostic.repairAction ? ` Action: ${diagnostic.repairAction}.` : "";

  return `${diagnostic.source}:${pathHint}:${diagnostic.code}: ${diagnostic.message}${actionHint} Suggestion: ${diagnostic.suggestion}`;
}

function ajvPathToPhasePlanModelPath(instancePath: string): string {
  if (instancePath.length === 0) {
    return "model";
  }

  return `model${instancePath
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      const decoded = segment.replace(/~1/g, "/").replace(/~0/g, "~");
      return /^\d+$/.test(decoded) ? `[${decoded}]` : `.${decoded}`;
    })
    .join("")}`;
}

function phasePlanModelPathToJsonPointer(pathValue: string): string | null {
  if (pathValue === "model") {
    return "";
  }

  if (!pathValue.startsWith("model.")) {
    return null;
  }

  const pathWithoutRoot = pathValue.slice("model.".length);
  const segments = pathWithoutRoot
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.replace(/~/g, "~0").replace(/\//g, "~1"));

  return `/${segments.join("/")}`;
}

function appendJsonPointerSegment(pointer: string, segment: string): string {
  const encoded = segment.replace(/~/g, "~0").replace(/\//g, "~1");

  return pointer.length === 0 ? `/${encoded}` : `${pointer}/${encoded}`;
}

function getValueAtJsonPointer(value: unknown, pointer: string | null): unknown {
  if (pointer === null) {
    return undefined;
  }

  if (pointer === "") {
    return value;
  }

  let current: unknown = value;
  const segments = pointer
    .split("/")
    .slice(1)
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));

  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);
      current = Number.isInteger(index) ? current[index] : undefined;
      continue;
    }

    if (typeof current === "object" && current !== null) {
      current = (current as Record<string, unknown>)[segment];
      continue;
    }

    return undefined;
  }

  return current;
}

function ajvAllowedValues(error: ErrorObject): unknown[] | undefined {
  if (
    typeof error.params === "object" &&
    error.params !== null &&
    "allowedValues" in error.params &&
    Array.isArray(error.params.allowedValues)
  ) {
    return error.params.allowedValues;
  }

  if (
    typeof error.params === "object" &&
    error.params !== null &&
    "allowedValue" in error.params
  ) {
    return [error.params.allowedValue];
  }

  return undefined;
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
  const basePath = ajvPathToPhasePlanModelPath(error.instancePath);
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

function schemaDiagnosticFromPhasePlanAjvError(
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

async function getPhasePlanImplementedCommandNames(): Promise<Set<string> | null> {
  if (!phasePlanImplementedCommandNamesPromise) {
    phasePlanImplementedCommandNamesPromise = (async () => {
      try {
        const projectModule = (await import("./project.js")) as {
          blueprintCommandCatalog: () => Promise<CommandCatalogResult>;
        };
        const catalog = await projectModule.blueprintCommandCatalog();
        const implementedCommands = new Set(
          Object.entries(catalog.commands)
            .filter(([, entry]) => entry.implemented)
            .map(([commandName]) => blueprintDirectCommand(commandName).toLowerCase())
        );

        return implementedCommands.size > 0 ? implementedCommands : null;
      } catch {
        return null;
      }
    })();
  }

  return phasePlanImplementedCommandNamesPromise;
}

function extractBlueprintDirectCommands(value: string): string[] {
  return [
    ...new Set(
      [...value.matchAll(/\/blu-[a-z0-9-]+/gi)].map((match) => match[0].toLowerCase())
    )
  ];
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

function phasePlanModelResidualDiagnostics(model: Record<string, unknown>): PhasePlanModelDiagnostic[] {
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

function setArrayItemEnum(schema: Record<string, unknown> | null, values: string[]): void {
  if (!schema || values.length === 0) {
    return;
  }

  const items = getJsonObjectProperty(schema, "items");
  if (items) {
    items.enum = values;
  }
}

function setArrayMaxItems(schema: Record<string, unknown> | null, maxItems: number): void {
  if (!schema) {
    return;
  }

  schema.maxItems = maxItems;
}

function allowOnlyEmptyArray(schema: Record<string, unknown> | null): void {
  if (!schema) {
    return;
  }

  schema.minItems = 0;
  schema.maxItems = 0;
}

function exactObjectPropertyContains(propertyName: string, value: string): Record<string, unknown> {
  return {
    contains: {
      type: "object",
      required: [propertyName],
      properties: {
        [propertyName]: { const: value }
      }
    },
    minContains: 1,
    maxContains: 1
  };
}

function objectPropertyContainsAtLeast(propertyName: string, value: string): Record<string, unknown> {
  return {
    contains: {
      type: "object",
      required: [propertyName],
      properties: {
        [propertyName]: { const: value }
      }
    },
    minContains: 1
  };
}

function buildPhasePlanTaskSchema(args: {
  baseSchema: Record<string, unknown>;
  knownRequirements: string[];
  knownEvidenceArtifacts: string[];
  allowedDependencyPlanIds: string[];
}): Record<string, unknown> {
  const schema = cloneJsonObject(args.baseSchema);
  const properties = getJsonObjectProperty(schema, "properties");
  const defs = getJsonObjectProperty(schema, "$defs");
  const task = defs ? getJsonObjectProperty(defs, "task") : null;
  const taskProperties = task ? getJsonObjectProperty(task, "properties") : null;
  const requirementCoverageRow = defs
    ? getJsonObjectProperty(defs, "requirementCoverageRow")
    : null;
  const requirementCoverageRowProperties = requirementCoverageRow
    ? getJsonObjectProperty(requirementCoverageRow, "properties")
    : null;
  const evidenceCoverageRow = defs ? getJsonObjectProperty(defs, "evidenceCoverageRow") : null;
  const evidenceCoverageRowProperties = evidenceCoverageRow
    ? getJsonObjectProperty(evidenceCoverageRow, "properties")
    : null;

  if (!properties) {
    return schema;
  }

  const dependsOn = getJsonObjectProperty(properties, "dependsOn");
  if (dependsOn) {
    if (args.allowedDependencyPlanIds.length > 0) {
      setArrayItemEnum(dependsOn, args.allowedDependencyPlanIds);
    } else {
      dependsOn.maxItems = 0;
    }
  }

  if (args.knownRequirements.length > 0) {
    setArrayItemEnum(getJsonObjectProperty(properties, "requirements"), args.knownRequirements);
    if (taskProperties) {
      setArrayItemEnum(
        getJsonObjectProperty(taskProperties, "requirements"),
        args.knownRequirements
      );
    }

    const requirement = requirementCoverageRowProperties
      ? getJsonObjectProperty(requirementCoverageRowProperties, "requirement")
      : null;
    if (requirement) {
      requirement.enum = args.knownRequirements;
    }

    const requirementCoverage = getJsonObjectProperty(properties, "requirementCoverage");
    if (requirementCoverage) {
      requirementCoverage.allOf = args.knownRequirements.map((requirementId) =>
        exactObjectPropertyContains("requirement", requirementId)
      );
    }
  } else {
    setArrayMaxItems(getJsonObjectProperty(properties, "requirements"), 0);
    if (taskProperties) {
      setArrayMaxItems(getJsonObjectProperty(taskProperties, "requirements"), 0);
    }

    setArrayMaxItems(getJsonObjectProperty(properties, "requirementCoverage"), 0);
  }

  if (args.knownEvidenceArtifacts.length > 0) {
    const artifact = evidenceCoverageRowProperties
      ? getJsonObjectProperty(evidenceCoverageRowProperties, "artifact")
      : null;
    if (artifact) {
      artifact.enum = args.knownEvidenceArtifacts;
    }

    const evidenceCoverage = getJsonObjectProperty(properties, "evidenceCoverage");
    if (evidenceCoverage) {
      evidenceCoverage.allOf = args.knownEvidenceArtifacts.map((artifactPath) =>
        exactObjectPropertyContains("artifact", artifactPath)
      );
    }
  } else {
    allowOnlyEmptyArray(getJsonObjectProperty(properties, "evidenceCoverage"));
  }

  schema["x-blueprint-runtimeContext"] = {
    knownRequirements: args.knownRequirements,
    knownEvidenceArtifacts: args.knownEvidenceArtifacts,
    allowedDependencyPlanIds: args.allowedDependencyPlanIds
  };

  return schema;
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

function uniquePreservingOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();

    if (trimmed.length === 0 || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
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

async function collectKnownPhasePlanEvidenceArtifacts(
  projectRoot: string,
  resolved: ResolvedPhaseLocation,
  targetPath: string
): Promise<string[]> {
  const located = await blueprintPhaseLocate({
    cwd: projectRoot,
    phase: resolved.phaseNumber
  });

  return located.artifacts.filter((artifact) => isPhasePlanEvidenceArtifact(artifact, targetPath));
}

async function resolvePhasePlanAuthoringContextData(
  args: PhasePlanAuthoringContextArgs
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
  const { projectRoot, resolved } = await resolveLocatedPhaseForMutation(args);
  const existingIndex = await blueprintPhasePlanIndex({
    cwd: projectRoot,
    phase: resolved.phaseNumber
  });
  const nextPlanNumber =
    existingIndex.plans.length === 0
      ? 1
      : Math.max(...existingIndex.plans.map((plan) => Number.parseInt(plan.planId, 10))) + 1;
  const planId = args.planId
    ? normalizePlanId(args.planId)
    : normalizePlanId(String(nextPlanNumber));
  const pathValue = planPathFor(resolved, planId);
  const modelContract = readArtifactContract("phase.plan").modelContract;

  if (!modelContract) {
    throw new Error("phase.plan does not expose a modelContract.");
  }
  if (!modelContract.schemaPath) {
    throw new Error("phase.plan modelContract does not expose a schemaPath.");
  }

  const knownRequirements = await readPhaseRoadmapRequirements(projectRoot, resolved.phaseNumber);
  const knownEvidenceArtifacts = await collectKnownPhasePlanEvidenceArtifacts(
    projectRoot,
    resolved,
    pathValue
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
        issues.push(
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
      issues.push(
        `File surface coverage for ${normalizedSurface} has unverifiable verification: ${row.verification}.`
      );
    }
  }

  for (const verification of model.verification) {
    if (!isPhasePlanAcceptanceCriterionVerifiable(verification.evidence)) {
      issues.push(
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
              path: phasePlanModelPathToJsonPointer(pathValue) ?? "",
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

function quoteYamlScalar(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

function renderYamlList(items: string[]): string {
  return items.map((item) => `  - ${quoteYamlScalar(item)}`).join("\n");
}

function renderMarkdownTableRows(rows: string[][]): string {
  return rows.map((row) => `| ${row.map((cell) => markdownCell(cell)).join(" | ")} |`).join("\n");
}

function renderPhasePlanModelContent(
  model: PhasePlanStructuredModel,
  resolved: ResolvedPhaseLocation,
  planId: string
): string {
  const acceptanceCriteria = uniquePreservingOrder(
    model.tasks.flatMap((task) => task.acceptanceCriteria)
  );
  const dependsOn = model.dependsOn.map((dependency) => normalizePlanId(dependency));
  const gapClosureFrontmatter = model.gapClosure === true ? "gap_closure: true\n" : "";
  const taskSections = model.tasks
    .map(
      (task, index) => `### Task ${index + 1}: ${task.id} - ${task.title}

#### Read First

${renderBulletList(task.readFirst)}

#### Action

${renderBulletList(task.action)}

#### Acceptance Criteria

${renderBulletList(task.acceptanceCriteria)}`
    )
    .join("\n\n");
  const verificationItems = model.verification.map(
    (item) => `${item.item} (${item.method}): ${item.evidence}`
  );
  const requirementRows = renderMarkdownTableRows(
    model.requirementCoverage.map((row) => [
      row.requirement,
      row.status,
      row.coveredByTasks.join(", ") || "none",
      row.evidence,
      row.rationale
    ])
  );
  const evidenceRows = renderMarkdownTableRows(
    model.evidenceCoverage.map((row) => [row.artifact, row.status, row.rationale])
  );
  const fileRows = renderMarkdownTableRows(
    model.fileSurfaceCoverage.map((row) => [
      row.surface,
      row.coveredByTasks.join(", "),
      row.verification,
      row.rationale
    ])
  );
  const unknownRows = renderMarkdownTableRows(
    model.unknownsAndDeferrals.map((row) => [
      row.item,
      row.disposition,
      row.rationale,
      row.followUp
    ])
  );

  return normalizeTextContent(`---
phase: ${resolved.phaseNumber}
plan_id: ${quoteYamlScalar(planId)}
title: ${quoteYamlScalar(model.title)}
wave: ${model.wave}
status: ${model.status}
${gapClosureFrontmatter}objective: ${quoteYamlScalar(model.objective)}
depends_on: [${dependsOn.map((dependency) => quoteYamlScalar(dependency)).join(", ")}]
requirements:
${renderYamlList(model.requirements)}
files_modified:
${renderYamlList(model.filesModified)}
read_first:
${renderYamlList(model.readFirst)}
acceptance_criteria:
${renderYamlList(acceptanceCriteria)}
autonomous: ${model.autonomous}
---

# Phase ${resolved.phasePrefix}: ${resolved.phaseName} - Plan ${planId}

## Goal

${model.goal}

## Scope

${renderBulletList(model.scope)}

## Tasks

${taskSections}

## Verification

${renderBulletList(verificationItems)}

## Must Haves

${renderBulletList(model.mustHaves)}

## Requirement Coverage

| Requirement | Status | Covered By Tasks | Evidence | Rationale |
|-------------|--------|------------------|----------|-----------|
${requirementRows}

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
${evidenceRows}

## File / Surface Coverage

| Surface | Covered By Tasks | Verification | Rationale |
|---------|------------------|--------------|-----------|
${fileRows}

## Unknowns And Deferrals

| Item | Disposition | Rationale | Follow-Up |
|------|-------------|-----------|-----------|
${unknownRows}
`);
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
    if (!schemaValid) {
      diagnostics.push(
        ...(validate.errors ?? []).map((error) =>
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

    if (schemaValid) {
      normalizedModel = modelObject as PhasePlanStructuredModel;
      const coverage = validatePhasePlanStructuredModelCoverage(normalizedModel);

      for (const issue of coverage.issues) {
        diagnostics.push(phasePlanCoverageDiagnosticFromIssue(issue, normalizedModel));
      }
    }
  }

  let renderPreview: string | null = null;

  if (diagnostics.length === 0 && normalizedModel) {
    const rendered = renderPhasePlanModelContent(
      normalizedModel,
      args.context.resolved,
      args.context.planId
    );
    const validation = validatePlanArtifactContent(rendered, args.context.resolved.phaseNumber, {
      strict: true
    });

    for (const issue of validation.issues) {
      diagnostics.push(
        phasePlanDiagnostic({
          source: "markdown",
          path: "renderPreview",
          code: "markdown.invalid_render",
          message: issue,
          context: {},
          suggestion: "Repair the model so MCP-rendered Markdown satisfies the phase.plan artifact contract."
        })
      );
    }

    if (validation.issues.length === 0) {
      renderPreview = rendered;
    }
  }

  return {
    status: diagnostics.length === 0 ? "valid" : "invalid",
    valid: diagnostics.length === 0,
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
    normalizedModel: diagnostics.some((diagnostic) => diagnostic.source === "schema")
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

  return {
    content: validation.renderPreview,
    issues: validation.diagnostics.map(formatPhasePlanDiagnostic),
    warnings: validation.warnings,
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

function phaseValidationDiagnostic(
  args: PhaseValidationModelDiagnostic
): PhaseValidationModelDiagnostic {
  return args;
}

function emptyPhaseValidationDiagnosticCounts(): PhaseValidationValidateModelResult["diagnosticCounts"] {
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

function trimPhaseValidationStandaloneValidateModelResult(
  validation: PhaseValidationValidateModelResult
): PhaseValidationStandaloneValidateModelResult {
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

function countPhaseValidationDiagnostics(
  diagnostics: PhaseValidationModelDiagnostic[]
): PhaseValidationValidateModelResult["diagnosticCounts"] {
  const counts = emptyPhaseValidationDiagnosticCounts();

  for (const diagnostic of diagnostics) {
    counts.total += 1;
    counts.bySource[diagnostic.source] += 1;
    counts.byCode[diagnostic.code] = (counts.byCode[diagnostic.code] ?? 0) + 1;
  }

  return counts;
}

function formatPhaseValidationDiagnostic(diagnostic: PhaseValidationModelDiagnostic): string {
  return `${diagnostic.source}:${diagnostic.path}:${diagnostic.code}: ${diagnostic.message} Suggestion: ${diagnostic.suggestion}`;
}

function ajvPathToPhaseValidationModelPath(instancePath: string): string {
  if (instancePath.length === 0) {
    return "model";
  }

  return `model${instancePath
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      const decoded = segment.replace(/~1/g, "/").replace(/~0/g, "~");
      return /^\d+$/.test(decoded) ? `[${decoded}]` : `.${decoded}`;
    })
    .join("")}`;
}

function schemaDiagnosticFromPhaseValidationAjvError(
  error: ErrorObject
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
  const basePath = ajvPathToPhaseValidationModelPath(error.instancePath);
  const pathValue =
    missingProperty !== null
      ? `${basePath}.${missingProperty}`
      : additionalProperty !== null
        ? `${basePath}.${additionalProperty}`
        : basePath;

  return phaseValidationDiagnostic({
    source: "schema",
    path: pathValue,
    code: `schema.${error.keyword}`,
    message: error.message ?? "Model does not match the phase validation task schema.",
    context: {
      keyword: error.keyword,
      params: error.params,
      schemaPath: error.schemaPath
    },
    suggestion:
      missingProperty !== null
        ? `Add required field ${missingProperty}.`
        : additionalProperty !== null
          ? `Remove unsupported field ${additionalProperty}.`
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

  const filterImplemented = (actions: string[]): string[] =>
    actions.filter((action) =>
      extractBlueprintDirectCommands(action).every((command) =>
        implementedCommands.has(command)
      )
    );
  const implementedReady = filterImplemented([readyAction])[0] ?? readyAction;
  const implementedRepairs = filterImplemented(repairActions);

  return {
    readyAction: implementedReady,
    repairActions: implementedRepairs.length > 0 ? implementedRepairs : repairActions,
    allowedActions: [implementedReady, ...(implementedRepairs.length > 0 ? implementedRepairs : repairActions)]
  };
}

function exactStringArrayContains(value: string): Record<string, unknown> {
  return {
    contains: { const: value },
    minContains: 1,
    maxContains: 1
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

async function phaseVerificationModelSchemas(args: {
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

  const filterImplemented = (actions: string[]): string[] =>
    actions.filter((action) =>
      extractBlueprintDirectCommands(action).every((command) =>
        implementedCommands.has(command)
      )
    );
  const implementedComplete = filterImplemented([completeAction])[0] ?? completeAction;
  const implementedContinuation = filterImplemented(continuationActions);
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

async function phaseUatModelSchemas(args: {
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

function phaseValidationResidualDiagnostics(
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

async function validatePhaseValidationModelCommands(
  model: Record<string, unknown>,
  artifact: PhaseValidationArtifactKind
): Promise<string[]> {
  const commands = [
    ...new Set(
      collectModelStringValues(model).flatMap((value) => extractBlueprintDirectCommands(value))
    )
  ];

  if (commands.length === 0) {
    return [];
  }

  const implementedCommands = await getPhasePlanImplementedCommandNames();

  if (implementedCommands === null || implementedCommands.size === 0) {
    return [
      `Phase ${artifact} model Blueprint command references could not be checked because the implemented command catalog was unavailable.`
    ];
  }

  const nonImplementedCommands = commands.filter((command) => !implementedCommands.has(command));

  return nonImplementedCommands.length > 0
    ? [
        `Phase ${artifact} model references non-implemented Blueprint command(s): ${nonImplementedCommands.join(", ")}.`
      ]
    : [];
}

function resolvedPhaseFromValidationContext(
  context: PhaseValidationAuthoringContextResult
): ResolvedPhaseLocation | null {
  return context.phaseFound &&
    context.phaseNumber &&
    context.phasePrefix &&
    context.phaseName &&
    context.phaseDir
    ? {
        phaseNumber: context.phaseNumber,
        phasePrefix: context.phasePrefix,
        phaseName: context.phaseName,
        phaseDir: context.phaseDir
      }
    : null;
}

function phaseValidationRoutingRules(phaseNumber: string | null): string[] {
  const phaseRef = phaseNumber ?? "<phase>";

  return [
    `PASS verification must use Readiness: ready for UAT and route to /blu-verify-work ${phaseRef}.`,
    "PARTIAL or BLOCKED verification must use Readiness: not ready for UAT.",
    `Test-generation gaps route to /blu-add-tests ${phaseRef}; implementation or behavior gaps route to /blu-audit-fix ${phaseRef}.`,
    "UAT PASS is complete only when **Checkpoint:** is none; checkpointed UAT should route back to /blu-verify-work."
  ];
}

function normalizeSummaryEvidenceHeading(value: string): string {
  return value
    .replace(/\s+#+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractSummaryEvidenceSection(markdown: string, heading: string): string {
  const expectedHeading = normalizeSummaryEvidenceHeading(heading);
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let startIndex = -1;
  let startLevel = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);

    if (match && normalizeSummaryEvidenceHeading(match[2]) === expectedHeading) {
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
    const match = lines[index].match(/^(#{1,6})\s+/);

    if (match && match[1].length <= startLevel) {
      endIndex = index;
      break;
    }
  }

  return lines.slice(startIndex, endIndex).join("\n").trim();
}

function mergeSummarySections(content: string, headings: string[]): string[] {
  return headings.flatMap((heading) => sectionToList(extractSummaryEvidenceSection(content, heading)));
}

async function collectValidationAuthoringSummaryEvidence(
  projectRoot: string,
  summaries: PhaseSummaryRecord[],
  completedPlanIds: ReadonlySet<string>
): Promise<{
  summaryPaths: string[];
  evidence: PhaseValidationSummaryEvidence[];
  warnings: string[];
}> {
  const summaryPaths: string[] = [];
  const evidence: PhaseValidationSummaryEvidence[] = [];
  const warnings: string[] = [];

  for (const summary of completedSummaryRecords(summaries, completedPlanIds)) {
    const content = await fs.readFile(resolveBlueprintPath(projectRoot, summary.path), "utf8");
    const validation = validateStrictSummaryArtifactContent(content, {
      linkedPlanPath: summary.linkedPlanPath
    });

    if (!validation.valid) {
      warnings.push(
        `${summary.path}: summary artifact is invalid and does not count as completed execution evidence.`
      );
      warnings.push(...validation.issues.map((issue) => `${summary.path}: ${issue}`));
      warnings.push(...validation.warnings.map((warning) => `${summary.path}: ${warning}`));
      continue;
    }

    summaryPaths.push(summary.path);
    evidence.push({
      planId: summary.planId,
      path: summary.path,
      linkedPlanPath: summary.linkedPlanPath,
      status: "COMPLETED",
      title: extractMarkdownHeading(content) ?? summary.title,
      summary: summary.summary,
      outcome: mergeSummarySections(content, ["Outcome", "Result"]),
      changesMade: mergeSummarySections(content, ["Changes Made"]),
      verification: mergeSummarySections(content, ["Verification"]),
      followUps: mergeSummarySections(content, ["Follow-Ups", "Follow Ups"]),
      evidence: mergeSummarySections(content, ["Evidence"])
    });
  }

  return { summaryPaths, evidence, warnings };
}

function renderBulletList(items: string[] | undefined, fallback = "none"): string {
  const lines = (items ?? []).map((item) => item.trim()).filter((item) => item.length > 0);

  if (lines.length === 0) {
    return `- ${fallback}`;
  }

  return lines.map((item) => `- ${item}`).join("\n");
}

function normalizeRenderList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value;
  }

  return value === undefined ? [] : [value];
}

function normalizeVerificationCoverageState(value: unknown): string {
  const normalized = String(value ?? "").trim();

  return normalized.toLowerCase() === "covered" ? "COVERED" : normalized;
}

function normalizeVerificationStructuredModel(
  model: PhaseVerificationStructuredModel
): PhaseVerificationStructuredModel {
  return {
    ...model,
    validationSummary: normalizeRenderList(model.validationSummary),
    requirementCoverage: model.requirementCoverage.map((row) => ({
      ...row,
      coverageState: normalizeVerificationCoverageState(row.coverageState) as
        | VerificationCoverageState
        | "covered"
    }))
  };
}

function renderVerificationOptionalSections(args: VerificationRenderArgs): string {
  const sections: string[] = [];

  if ((args.sessionState ?? []).length > 0) {
    sections.push(`## Session State\n\n${renderBulletList(args.sessionState)}`);
  }

  if (args.checkpoint?.trim()) {
    sections.push(`## Checkpoint\n\n- ${args.checkpoint.trim()}`);
  }

  if ((args.testMatrix ?? []).length > 0) {
    const testRows = (args.testMatrix ?? [])
      .map((row, index) =>
        `| ${markdownCell(row.number ?? String(index + 1))} | ${markdownCell(row.test)} | ${markdownCell(row.expectedBehavior)} | ${markdownCell(row.evidence)} | ${markdownCell(row.result)} | ${markdownCell(row.notes)} |`
      )
      .join("\n");

    sections.push(`## Validation Test Matrix

| # | Test | Expected Behavior | Evidence | Result | Notes |
|---|------|-------------------|----------|--------|-------|
${testRows}`);
  }

  if (args.resultSummary) {
    sections.push(`## Result Summary

- Total: ${args.resultSummary.total ?? ""}
- Passed: ${args.resultSummary.passed ?? ""}
- Issues: ${args.resultSummary.issues ?? ""}
- Pending: ${args.resultSummary.pending ?? ""}
- Skipped: ${args.resultSummary.skipped ?? ""}
- Blocked: ${args.resultSummary.blocked ?? ""}`);
  }

  if ((args.observedBehavior ?? []).length > 0) {
    sections.push(`## Observed Behavior\n\n${renderBulletList(args.observedBehavior)}`);
  }

  if ((args.unresolvedGaps ?? []).length > 0) {
    sections.push(`## Unresolved Gaps\n\n${renderBulletList(args.unresolvedGaps)}`);
  }

  if ((args.structuredGaps ?? []).length > 0) {
    const structuredGapRows = (args.structuredGaps ?? [])
      .map((row) =>
        `| ${markdownCell(row.test)} | ${markdownCell(row.truth)} | ${markdownCell(row.status)} | ${markdownCell(row.severity)} | ${markdownCell(row.reason)} | ${markdownCell(row.followUp)} |`
      )
      .join("\n");

    sections.push(`## Structured Gaps

| Test | Truth | Status | Severity | Reason | Follow-Up |
|------|-------|--------|----------|--------|-----------|
${structuredGapRows}`);
  }

  if ((args.followUpFixes ?? []).length > 0) {
    sections.push(`## Follow-Up Fixes\n\n${renderBulletList(args.followUpFixes)}`);
  }

  return sections.length > 0 ? `\n\n${sections.join("\n\n")}` : "";
}

function renderVerificationContent(
  args: VerificationRenderArgs,
  resolved: ResolvedPhaseLocation,
  summaryPaths: string[]
): string {
  const evidenceReviewedSummaryPaths = args.evidenceReviewedSummaryPaths ?? summaryPaths;
  const requirementRows = (args.requirementCoverage ?? [])
    .map(
      (row) =>
        `| ${markdownCell(row.requirement)} | ${markdownCell(row.taskOrCheck)} | ${markdownCell(row.evidence)} | ${markdownCell(normalizeVerificationCoverageState(row.coverageState))} | ${markdownCell(row.notes)} |`
    )
    .join("\n");
  const manualRows =
    (args.manualOrDeferredCoverage ?? []).length > 0
      ? (args.manualOrDeferredCoverage ?? [])
          .map(
            (row) =>
              `| ${markdownCell(row.item)} | ${markdownCell(row.whyManualOrDeferred)} | ${markdownCell(row.followUp)} | ${markdownCell(row.status)} |`
          )
          .join("\n")
      : "| none | none | none | NONE |";
  const gapRows =
    (args.gapClassification ?? []).length > 0
      ? (args.gapClassification ?? [])
          .map(
            (row) =>
              `| ${markdownCell(row.gapClass)} | ${markdownCell(row.scope)} | ${markdownCell(row.evidence)} | ${markdownCell(row.repair)} |`
          )
          .join("\n")
      : "| none | none | none | none |";

  return normalizeTextContent(`# Phase ${resolved.phasePrefix}: ${resolved.phaseName} - Verification

**Coverage:** ${args.coverageSummary ?? ""}
**Gate State:** ${args.gateState ?? ""}
**Sign-off:** ${args.signOff ?? ""}

## Validation Summary

${renderBulletList(normalizeRenderList(args.validationSummary))}

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
${requirementRows}

## Evidence Reviewed

${renderBulletList(evidenceReviewedSummaryPaths)}

## Test Infrastructure / Evidence Metadata

${renderBulletList(args.evidenceMetadata)}

## Manual-Only or Deferred Coverage

| Item | Why manual or deferred | Follow-Up | Status |
|------|------------------------|-----------|--------|
${manualRows}

## Gate State

- Gate: ${args.gateState ?? ""}
- Sign-off: ${args.signOff ?? ""}
- Readiness: ${
    PHASE_VALIDATION_ALLOWED_VALUES.verification.readinessByGate[args.gateState ?? ""] ?? ""
  }

## Gap Classification

| Gap class | Scope | Evidence | Repair |
|-----------|-------|----------|--------|
${gapRows}

## Gaps Found

${renderBulletList(args.gapsFound)}

## Suggested Repairs

${renderBulletList(args.suggestedRepairs)}${renderVerificationOptionalSections(args)}

## Next Safe Action

- ${args.nextSafeAction ?? ""}
`);
}

function renderUatContent(
  args: UatRenderArgs,
  resolved: ResolvedPhaseLocation
): string {
  const currentTest = args.currentTest ?? {};
  const resultSummary = args.resultSummary ?? {};
  const testRows =
    (args.testMatrix ?? []).length > 0
      ? (args.testMatrix ?? [])
          .map(
            (row, index) =>
              `| ${markdownCell(row.number ?? String(index + 1))} | ${markdownCell(row.test)} | ${markdownCell(row.expectedBehavior)} | ${markdownCell(row.evidence)} | ${markdownCell(row.result)} | ${markdownCell(row.notes)} |`
          )
          .join("\n")
      : "";
  const structuredGapRows =
    (args.structuredGaps ?? []).length > 0
      ? (args.structuredGaps ?? [])
          .map(
            (row) =>
              `| ${markdownCell(row.test)} | ${markdownCell(row.truth)} | ${markdownCell(row.status)} | ${markdownCell(row.severity)} | ${markdownCell(row.reason)} | ${markdownCell(row.followUp)} |`
          )
          .join("\n")
      : "| none | none | none | none | none | none |";

  return normalizeTextContent(`# Phase ${resolved.phasePrefix}: ${resolved.phaseName} - UAT

**Status:** ${args.status ?? ""}
**Resume State:** ${args.resumeState ?? ""}
**Checkpoint:** ${args.checkpoint ?? ""}

## UAT Summary

${renderBulletList(args.uatSummary)}

## Session State

${renderBulletList(args.sessionState)}

## Current Test

- Number: ${currentTest.number ?? ""}
- Name: ${currentTest.name ?? ""}
- Expected: ${currentTest.expected ?? ""}
- Awaiting: ${currentTest.awaiting ?? ""}

## Test Matrix

| # | Test | Expected Behavior | Evidence | Result | Notes |
|---|------|-------------------|----------|--------|-------|
${testRows}

## Result Summary

- Total: ${resultSummary.total ?? ""}
- Passed: ${resultSummary.passed ?? ""}
- Issues: ${resultSummary.issues ?? ""}
- Pending: ${resultSummary.pending ?? ""}
- Skipped: ${resultSummary.skipped ?? ""}
- Blocked: ${resultSummary.blocked ?? ""}

## Questions Asked

${renderBulletList(args.questionsAsked)}

## Observed Behavior

${renderBulletList(args.observedBehavior)}

## Unresolved Gaps

${renderBulletList(args.unresolvedGaps)}

## Structured Gaps

| Test | Truth | Status | Severity | Reason | Follow-Up |
|------|-------|--------|----------|--------|-----------|
${structuredGapRows}

## Follow-Up Fixes

${renderBulletList(args.followUpFixes)}

## Next Safe Action

- ${args.nextSafeAction ?? ""}
`);
}

function verificationPayloadIssues(args: VerificationRenderArgs): string[] {
  const issues: string[] = [];

  if (!args.coverageSummary?.trim()) {
    issues.push("Verification render payload must include coverageSummary.");
  }
  if (!args.gateState?.trim()) {
    issues.push("Verification render payload must include gateState.");
  }
  if (!args.signOff?.trim()) {
    issues.push("Verification render payload must include signOff.");
  }
  if (normalizeRenderList(args.validationSummary).filter((item) => item.trim().length > 0).length === 0) {
    issues.push("Verification render payload must include validationSummary.");
  }
  if ((args.requirementCoverage ?? []).length === 0) {
    issues.push("Verification render payload must include at least one requirementCoverage row.");
  }
  if ((args.evidenceMetadata ?? []).filter((item) => item.trim().length > 0).length === 0) {
    issues.push("Verification render payload must include evidenceMetadata.");
  }
  if (!args.nextSafeAction?.trim()) {
    issues.push("Verification render payload must include nextSafeAction.");
  }

  return issues;
}

function uatPayloadIssues(args: UatRenderArgs): string[] {
  const issues: string[] = [];

  if (!args.status?.trim()) {
    issues.push("UAT render payload must include status.");
  }
  if (!args.resumeState?.trim()) {
    issues.push("UAT render payload must include resumeState.");
  }
  if (!args.checkpoint?.trim()) {
    issues.push("UAT render payload must include checkpoint.");
  }
  if (args.status === "PASS" && args.checkpoint?.trim().toLowerCase() !== "none") {
    issues.push("UAT render payload must use checkpoint none when status is PASS.");
  }
  if (
    (args.status === "FAIL" || args.status === "PARTIAL") &&
    args.checkpoint?.trim().toLowerCase() === "none"
  ) {
    issues.push("UAT render payload must keep a non-empty checkpoint label until status is PASS.");
  }
  if ((args.uatSummary ?? []).filter((item) => item.trim().length > 0).length === 0) {
    issues.push("UAT render payload must include uatSummary.");
  }
  if ((args.testMatrix ?? []).length === 0) {
    issues.push("UAT render payload must include at least one testMatrix row.");
  }
  if (!args.resultSummary) {
    issues.push("UAT render payload must include resultSummary.");
  }
  if (!args.nextSafeAction?.trim()) {
    issues.push("UAT render payload must include nextSafeAction.");
  }

  return issues;
}

async function validationPrerequisiteBlockers(
  projectRoot: string,
  resolved: ResolvedPhaseLocation,
  artifact: PhaseValidationArtifactKind,
  summaryPaths: string[]
): Promise<{
  blockers: string[];
  verification: PhaseValidationReadResult | null;
}> {
  const blockers: string[] = [];
  let verification: PhaseValidationReadResult | null = null;

  if (summaryPaths.length === 0) {
    blockers.push(
      `Phase ${resolved.phaseNumber} does not have any valid completed execution summaries.`
    );
  }

  if (artifact === "uat") {
    verification = await blueprintPhaseValidationRead({
      cwd: projectRoot,
      phase: resolved.phaseNumber,
      artifact: "verification"
    });

    if (!verification.found) {
      blockers.push(
        `Phase ${resolved.phaseNumber} must have a saved VERIFICATION artifact before UAT.`
      );
    } else if (!verification.validation?.valid) {
      blockers.push(
        `Phase ${resolved.phaseNumber} must have a valid VERIFICATION artifact before UAT.`
      );
    } else if (!verification.verificationReadyForUat) {
      blockers.push(
        `Phase ${resolved.phaseNumber} verification is valid but not ready for UAT.`
      );
    }
  }

  return { blockers, verification };
}

export async function blueprintPhaseValidationAuthoringContext(
  args: PhaseValidationAuthoringContextArgs
): Promise<PhaseValidationAuthoringContextResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate(args);
  const resolved = toResolvedPhaseLocation(located);
  const contract = validationArtifactContract(args.artifact, resolved ?? undefined);
  const allowedValues = clonePhaseValidationAllowedValues();

  if (!resolved) {
    const reason = located.reason ?? "Phase could not be resolved for validation authoring.";

    return {
      status: "invalid",
      phaseFound: false,
      phaseNumber: null,
      phasePrefix: null,
      phaseName: null,
      phaseDir: null,
      artifact: args.artifact,
      path: null,
      contract,
      summaryPaths: [],
      summaryEvidence: [],
      existing: null,
      verification: null,
      prerequisiteBlockers: [reason],
      readyForDraft: false,
      schemaPath: null,
      baseSchema: null,
      taskSchema: null,
      allowedValues,
      routingRules: phaseValidationRoutingRules(null),
      warnings: [],
      reason
    };
  }

  const summaryIndex = await blueprintPhaseSummaryIndex({
    cwd: projectRoot,
    phase: resolved.phaseNumber
  });
  const completedSummaryPlanIds = new Set(summaryIndex.completedPlans);
  const summaryEvidence = await collectValidationAuthoringSummaryEvidence(
    projectRoot,
    summaryIndex.summaries,
    completedSummaryPlanIds
  );
  const existing = await blueprintPhaseValidationRead({
    cwd: projectRoot,
    phase: resolved.phaseNumber,
    artifact: args.artifact
  });
  const prerequisites = await validationPrerequisiteBlockers(
    projectRoot,
    resolved,
    args.artifact,
    summaryEvidence.summaryPaths
  );
  const verification = args.artifact === "verification" ? existing : prerequisites.verification;
  const modelSchemas =
    args.artifact === "verification"
      ? await phaseVerificationModelSchemas({
          contract,
          phaseNumber: resolved.phaseNumber,
          summaryPaths: summaryEvidence.summaryPaths
        })
      : await phaseUatModelSchemas({
          contract,
          phaseNumber: resolved.phaseNumber,
          summaryPaths: summaryEvidence.summaryPaths,
          verificationPath:
            prerequisites.verification?.found &&
            prerequisites.verification.validation?.valid &&
            prerequisites.verification.verificationReadyForUat
              ? prerequisites.verification.path
              : null
        });
  const readyForDraft = prerequisites.blockers.length === 0;

  return {
    status: readyForDraft ? "ready" : "invalid",
    phaseFound: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    artifact: args.artifact,
    path: validationArtifactPathFor(resolved, args.artifact),
    contract,
    summaryPaths: summaryEvidence.summaryPaths,
    summaryEvidence: summaryEvidence.evidence,
    existing,
    verification,
    prerequisiteBlockers: prerequisites.blockers,
    readyForDraft,
    schemaPath: modelSchemas.schemaPath,
    baseSchema: modelSchemas.baseSchema,
    taskSchema: modelSchemas.taskSchema,
    allowedValues,
    routingRules: phaseValidationRoutingRules(resolved.phaseNumber),
    warnings: summaryEvidence.warnings,
    reason: readyForDraft ? null : prerequisites.blockers.join(" ")
  };
}

export async function blueprintPhaseValidationValidateModel(
  args: PhaseValidationValidateModelArgs
): Promise<PhaseValidationValidateModelResult> {
  const context = await blueprintPhaseValidationAuthoringContext({
    cwd: args.cwd,
    phase: args.phase,
    artifact: args.artifact
  });
  const resolved = resolvedPhaseFromValidationContext(context);
  const diagnostics: PhaseValidationModelDiagnostic[] = context.prerequisiteBlockers.map((message) =>
    phaseValidationDiagnostic({
      source: "scope",
      path: "phase.summaryPaths",
      code: "scope.prerequisite_blocker",
      message,
      context: { phase: context.phaseNumber },
      suggestion:
        args.artifact === "verification"
          ? "Create valid completed execution summaries before authoring phase.verification evidence."
          : "Create valid completed execution summaries and ready verification evidence before authoring phase.uat evidence."
    })
  );
  const modelObject = asJsonObject(args.model);

  if (!modelObject) {
    diagnostics.push(
      phaseValidationDiagnostic({
        source: "schema",
        path: "model",
        code: "schema.type",
        message: `Phase ${args.artifact} model must be a JSON object.`,
        context: { receivedType: Array.isArray(args.model) ? "array" : typeof args.model },
        suggestion: "Return a JSON object that matches taskSchema."
      })
    );
  }

  if (!context.taskSchema) {
    diagnostics.push(
      phaseValidationDiagnostic({
        source: "scope",
        path: "taskSchema",
        code: "contract.missing_schema",
        message: `${validationArtifactContractId(args.artifact)} did not expose a runtime task schema.`,
        context: {},
        suggestion: `Read the live ${validationArtifactContractId(args.artifact)} contract and authoring context before writing.`
      })
    );
  }

  let normalizedModel: PhaseVerificationStructuredModel | PhaseUatStructuredModel | null = null;

  if (modelObject && context.taskSchema) {
    const validate = createAjvValidator().compile(context.taskSchema);
    const schemaValid = validate(modelObject);

    if (!schemaValid) {
      diagnostics.push(
        ...(validate.errors ?? []).map(schemaDiagnosticFromPhaseValidationAjvError)
      );
    }

    diagnostics.push(
      ...phaseValidationResidualDiagnostics(
        modelObject,
        context.contract.modelContract,
        args.artifact
      )
    );

    for (const issue of await validatePhaseValidationModelCommands(modelObject, args.artifact)) {
      diagnostics.push(
        phaseValidationDiagnostic({
          source: "residual",
          path: "model",
          code: "content.non_implemented_command",
          message: issue,
          context: {},
          suggestion: "Use only implemented Blueprint command references from the task schema."
        })
      );
    }

    if (schemaValid) {
      normalizedModel =
        args.artifact === "verification"
          ? normalizeVerificationStructuredModel(modelObject as PhaseVerificationStructuredModel)
          : modelObject as PhaseUatStructuredModel;
    }
  }

  let renderPreview: string | null = null;

  if (diagnostics.length === 0 && normalizedModel && resolved) {
    const rendered =
      args.artifact === "verification"
        ? renderVerificationContent(
            {
              cwd: args.cwd,
              phase: resolved.phaseNumber,
              artifact: "verification",
              ...(normalizedModel as PhaseVerificationStructuredModel)
            },
            resolved,
            context.summaryPaths
          )
        : renderUatContent(
            {
              cwd: args.cwd,
              phase: resolved.phaseNumber,
              artifact: "uat",
              ...(normalizedModel as PhaseUatStructuredModel)
            },
            resolved
          );
    const validation =
      args.artifact === "verification"
        ? validateVerificationArtifactContent(rendered, context.summaryPaths)
        : validateUatArtifactContent(rendered, context.summaryPaths, {
            requireReadyVerificationEvidence: true
          });

    for (const issue of validation.issues) {
      diagnostics.push(
        phaseValidationDiagnostic({
          source: "markdown",
          path: "renderPreview",
          code: "markdown.invalid_render",
          message: issue,
          context: {},
          suggestion:
            `Repair the model so MCP-rendered Markdown satisfies the ${validationArtifactContractId(args.artifact)} artifact contract.`
        })
      );
    }

    if (validation.issues.length === 0) {
      renderPreview = rendered;
    }
  }

  return {
    status: diagnostics.length === 0 ? "valid" : "invalid",
    valid: diagnostics.length === 0,
    phase: resolved,
    artifact: args.artifact,
    path: context.path,
    schemaPath: context.schemaPath,
    taskSchema: context.taskSchema,
    diagnostics,
    diagnosticCounts: countPhaseValidationDiagnostics(diagnostics),
    normalizedModel: diagnostics.some((diagnostic) => diagnostic.source === "schema")
      ? null
      : normalizedModel,
    renderPreview,
    warnings: context.warnings
  };
}

export async function blueprintPhaseValidationRender(
  args: PhaseValidationRenderArgs
): Promise<PhaseValidationRenderResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate(args);
  const resolved = toResolvedPhaseLocation(located);

  if (!resolved) {
    const reason = located.reason ?? "Phase could not be resolved for validation rendering.";
    const validation = {
      valid: false,
      issues: [reason],
      warnings: [] as string[]
    };

    return {
      phaseFound: false,
      phaseNumber: null,
      phasePrefix: null,
      phaseName: null,
      phaseDir: null,
      artifact: args.artifact,
      path: null,
      content: "",
      validation,
      summaryPaths: [],
      referencedSummaryPaths: [],
      prerequisiteBlockers: [reason],
      readyToWrite: false,
      issues: [reason],
      warnings: []
    };
  }

  const summaryIndex = await blueprintPhaseSummaryIndex({
    cwd: projectRoot,
    phase: resolved.phaseNumber
  });
  const completedSummaryPlanIds = new Set(summaryIndex.completedPlans);
  const summaryEvidence = await collectValidationAuthoringSummaryEvidence(
    projectRoot,
    summaryIndex.summaries,
    completedSummaryPlanIds
  );
  const prerequisites = await validationPrerequisiteBlockers(
    projectRoot,
    resolved,
    args.artifact,
    summaryEvidence.summaryPaths
  );
  const content =
    args.artifact === "verification"
      ? renderVerificationContent(args, resolved, summaryEvidence.summaryPaths)
      : renderUatContent(args, resolved);
  const referencedSummaryPaths = collectReferencedValidatedSummaryPaths(
    content,
    summaryIndex.summaries,
    completedSummaryPlanIds
  );
  const validation =
    args.artifact === "verification"
      ? validateVerificationArtifactContent(content, summaryEvidence.summaryPaths)
      : validateUatArtifactContent(content, summaryEvidence.summaryPaths, {
          requireReadyVerificationEvidence: true
        });
  const payloadIssues =
    args.artifact === "verification"
      ? verificationPayloadIssues(args)
      : uatPayloadIssues(args);
  const issues = [
    ...prerequisites.blockers,
    ...payloadIssues,
    ...validation.issues
  ];
  const warnings = [...summaryEvidence.warnings, ...validation.warnings];

  return {
    phaseFound: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    artifact: args.artifact,
    path: validationArtifactPathFor(resolved, args.artifact),
    content,
    validation,
    summaryPaths: summaryEvidence.summaryPaths,
    referencedSummaryPaths,
    prerequisiteBlockers: prerequisites.blockers,
    readyToWrite: issues.length === 0,
    issues,
    warnings
  };
}

function isScaffoldGeneratedPhaseArtifact(content: string): boolean {
  return isScaffoldGeneratedArtifact(content);
}

async function resolveLocatedPhaseForMutation(
  args: PhaseLookupArgs
): Promise<{
  projectRoot: string;
  resolved: ResolvedPhaseLocation;
}> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate(args);
  const resolved = toResolvedPhaseLocation(located);

  if (!resolved) {
    throw new Error(located.reason ?? "Phase could not be resolved for a deterministic write.");
  }

  return {
    projectRoot,
    resolved
  };
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
  const auditBackedDetails = args.auditBackedDetails ?? null;

  if (normalizedDescription.length === 0) {
    throw new Error(
      "Phase description required. Re-run /blu-add-phase with a concise description."
    );
  }

  return withBlueprintRepoLock(projectRoot, "roadmap-add-phase", async () => {
    const roadmap = await readRoadmap(projectRoot);
    const existingAuditBackedPhase = findMatchingAuditBackedPhase(
      roadmap.phases,
      normalizedDescription,
      auditBackedDetails
    );

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

    const phaseNumber = nextIntegerPhaseNumber(roadmap.phases);

    if (
      args.expectedPhaseNumber &&
      normalizePhaseNumber(args.expectedPhaseNumber) !== phaseNumber
    ) {
      throw new Error(
        `Confirmed next phase ${normalizePhaseNumber(args.expectedPhaseNumber)} no longer matches the live next phase ${phaseNumber}. Re-run /blu-add-phase after re-reading the roadmap.`
      );
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
    const updatedRoadmap = appendPhaseDetailsToRoadmap(
      appendPhaseLineToRoadmap(rawRoadmap, phaseNumber, normalizedDescription),
      phaseNumber,
      normalizedDescription,
      auditBackedDetails
        ? {
            dependsOnPhaseNumber,
            goal:
              auditBackedDetails.goal ??
              "Close the audit-identified milestone gaps and restore requirement traceability.",
            requirements: auditBackedDetails.repairRequirementIds,
            successCriteria:
              auditBackedDetails.successCriteria ??
              "Persist audit-backed gap details and repair traceability for the affected requirements.",
            auditBackedDetails
          }
        : { dependsOnPhaseNumber }
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
      roadmapPath: roadmap.path,
      milestone: roadmap.milestone,
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

  return withBlueprintRepoLock(projectRoot, "roadmap-insert-phase", async () => {
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
      normalizedDescription
    );
    const updatedRoadmap = insertPhaseDetailsToRoadmap(
      insertedPhaseLines,
      groupPhases.map((phase) => phase.phaseNumber),
      phaseNumber,
      normalizedDescription,
      afterPhaseNumber
    );
    const preparedRoadmap = prepareTextForPersistence(updatedRoadmap, {
      label: roadmap.path
    });
    const warnings: string[] = [...preparedRoadmap.warnings];
    const materializedPhaseDir = await materializePhaseDirectory(projectRoot, phaseDir);

    warnings.push(...materializedPhaseDir.warnings);

    try {
      warnings.push(
        ...await writeTextFile(roadmapPath, preparedRoadmap.content, {
          label: roadmap.path,
          enforcePromptBoundary: false
        })
      );
    } catch (error) {
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
      roadmapPath: roadmap.path,
      milestone: roadmap.milestone,
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

async function renamePhaseArtifactsInPlace(
  projectRoot: string,
  rootDirectoryPath: string,
  oldPhaseNumber: string,
  newPhasePrefix: string
): Promise<Array<{ from: string; to: string }>> {
  const renamedArtifacts: Array<{ from: string; to: string }> = [];
  const entries = await fs.readdir(rootDirectoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const currentPath = path.join(rootDirectoryPath, entry.name);
    const renamedEntry = renameLeadingPhaseToken(entry.name, oldPhaseNumber, newPhasePrefix);
    const nextPath = renamedEntry ? path.join(rootDirectoryPath, renamedEntry) : currentPath;

    if (renamedEntry) {
      await fs.rename(currentPath, nextPath);
      renamedArtifacts.push({
        from: toRepoRelativePath(projectRoot, currentPath),
        to: toRepoRelativePath(projectRoot, nextPath)
      });
    }

    const stats = await fs.stat(nextPath);

    if (stats.isDirectory()) {
      renamedArtifacts.push(
        ...(await renamePhaseArtifactsInPlace(
          projectRoot,
          nextPath,
          oldPhaseNumber,
          newPhasePrefix
        ))
      );
    }
  }

  return renamedArtifacts;
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

  const renumberTargets: Array<{
    previousPhase: ParsedRoadmapPhase;
    newPhaseNumber: string;
  }> = [];

  for (let index = targetIndex + 1; index < phases.length; index += 1) {
    renumberTargets.push({
      previousPhase: phases[index],
      newPhaseNumber:
        index === targetIndex + 1
          ? targetPhaseNumber
          : phases[index - 1]?.phaseNumber ?? targetPhaseNumber
    });
  }

  return renumberTargets;
}

export async function blueprintRoadmapRemovePhase(
  args: RoadmapRemovePhaseArgs
): Promise<RoadmapRemovePhaseResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const roadmap = await readRoadmap(projectRoot);
  const targetPhaseNumber = extractPhaseNumberToken(args.phase ?? "");

  if (!targetPhaseNumber) {
    throw new Error(
      "Phase number required. Re-run /blu-remove-phase with a phase number such as 7."
    );
  }

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
  const removedArtifacts = await listPhaseArtifacts(targetPhaseDirPath, projectRoot);
  const executionArtifacts = removedArtifacts.filter(
    (artifactPath) =>
      /-SUMMARY\.md$/i.test(artifactPath) ||
      /-VERIFICATION\.md$/i.test(artifactPath) ||
      /-UAT\.md$/i.test(artifactPath)
  );

  const warnings: string[] = [];

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
  const preparedRenumberTargets = [];

  for (const { previousPhase, newPhaseNumber } of renumberTargets) {
    const locatedPhaseDirectory = await findPhaseDirectory(projectRoot, previousPhase.phaseNumber);

    if (!locatedPhaseDirectory.phaseDir) {
      throw new Error(
        locatedPhaseDirectory.reason === "ambiguous"
          ? `Phase ${previousPhase.phaseNumber} has multiple matching directories under ${BLUEPRINT_PHASES_PATH}. Resolve the drift before removing ${targetPhaseNumber}.`
          : `Phase ${previousPhase.phaseNumber} is missing a matching directory under ${BLUEPRINT_PHASES_PATH}. Resolve the drift before removing ${targetPhaseNumber}.`
      );
    }

    preparedRenumberTargets.push({
      previousPhase,
      newPhaseNumber,
      previousPhaseDir: locatedPhaseDirectory.phaseDir
    });
  }

  await fs.rm(targetPhaseDirPath, { recursive: true, force: true });

  for (const { previousPhase, newPhaseNumber, previousPhaseDir } of preparedRenumberTargets) {
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

    await fs.rename(previousPhaseDirPath, newPhaseDirPath);

    const renamedArtifacts = await renamePhaseArtifactsInPlace(
      projectRoot,
      newPhaseDirPath,
      previousPhase.phaseNumber,
      newPhasePrefix
    );

    renumberedPhases.push({
      previousPhaseNumber: previousPhase.phaseNumber,
      newPhaseNumber,
      previousPhasePrefix: previousPhase.phasePrefix,
      newPhasePrefix,
      phaseName: previousPhase.phaseName,
      previousPhaseDir,
      newPhaseDir: toRepoRelativePath(projectRoot, newPhaseDirPath),
      renamedArtifacts
    });
  }

  warnings.push(
    ...await writeTextFile(roadmapPath, updatedRoadmap, {
      label: roadmap.path
    })
  );

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

      if (promotedPhaseDirPath !== reservedPhaseDirPath) {
        await fs.rename(reservedPhaseDirPath, promotedPhaseDirPath);
      }

      await renamePhaseArtifactsInPlace(
        projectRoot,
        promotedPhaseDirPath,
        item.reservedPhase,
        phasePrefix
      );

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
      appendPhaseLineToRoadmap(roadmapBody, phaseNumber, phaseName),
      phaseNumber,
      phaseName,
      { dependsOnPhaseNumber }
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
}

export async function blueprintPhaseLocate(
  args: PhaseLookupArgs = {}
): Promise<PhaseLocateResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  let roadmap;

  try {
    roadmap = await readRoadmap(projectRoot);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    return {
      found: false,
      phaseNumber: null,
      phasePrefix: null,
      phaseName: null,
      phaseDir: null,
      artifacts: [],
      milestone: null,
      resolvedFrom: "roadmap",
      reason,
      recovery: buildLocateRecovery(reason),
      warnings: []
    };
  }
  const { phaseNumber, resolvedFrom } = await resolveRequestedPhase(
    projectRoot,
    args.phase,
    roadmap.phases
  );

  if (!phaseNumber) {
    return {
      found: false,
      phaseNumber: null,
      phasePrefix: null,
      phaseName: null,
      phaseDir: null,
      artifacts: [],
      milestone: roadmap.milestone,
      resolvedFrom,
      reason: "No phase could be inferred from the request, state, or roadmap.",
      recovery: buildLocateRecovery("No phase could be inferred from the request, state, or roadmap."),
      warnings: []
    };
  }

  const matchedPhase = roadmap.phases.find(
    (phase) => normalizePhaseNumber(phase.phaseNumber) === normalizePhaseNumber(phaseNumber)
  );

  if (!matchedPhase) {
    return {
      found: false,
      phaseNumber,
      phasePrefix: formatPhasePrefix(phaseNumber),
      phaseName: null,
      phaseDir: null,
      artifacts: [],
      milestone: roadmap.milestone,
      resolvedFrom,
      reason: `Phase ${phaseNumber} was not found in ${BLUEPRINT_DIR}/ROADMAP.md.`,
      recovery: buildLocateRecovery(
        `Phase ${phaseNumber} was not found in ${BLUEPRINT_DIR}/ROADMAP.md.`
      ),
      warnings: []
    };
  }

  const phaseDirectoryResolution = await findPhaseDirectory(projectRoot, matchedPhase.phaseNumber);
  const phaseDir = phaseDirectoryResolution.phaseDir;

  if (!phaseDir) {
    const reason =
      phaseDirectoryResolution.reason === "ambiguous"
        ? `Phase ${matchedPhase.phaseNumber} has multiple matching directories in ${BLUEPRINT_PHASES_PATH}/.`
        : `Phase ${matchedPhase.phaseNumber} exists in ${BLUEPRINT_DIR}/ROADMAP.md but has no matching directory in ${BLUEPRINT_PHASES_PATH}/.`;

    return {
      found: false,
      phaseNumber: matchedPhase.phaseNumber,
      phasePrefix: matchedPhase.phasePrefix,
      phaseName: matchedPhase.phaseName,
      phaseDir: null,
      artifacts: [],
      milestone: roadmap.milestone,
      resolvedFrom,
      reason,
      recovery: buildLocateRecovery(reason),
      warnings: []
    };
  }

  const phaseArtifacts = await listPhaseArtifacts(
    resolveBlueprintPath(projectRoot, phaseDir),
    projectRoot
  );

  return {
    found: true,
    phaseNumber: matchedPhase.phaseNumber,
    phasePrefix: matchedPhase.phasePrefix,
    phaseName: matchedPhase.phaseName,
    phaseDir,
    artifacts: phaseArtifacts,
    milestone: roadmap.milestone,
    resolvedFrom,
    reason: null,
    recovery: [],
    warnings: []
  };
}

export async function blueprintPhaseContext(
  args: PhaseLookupArgs = {}
): Promise<PhaseContextResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const roadmap = await readRoadmap(projectRoot);
  const state = await blueprintStateLoad({ cwd: projectRoot });
  const located = await blueprintPhaseLocate(args);
  const codebase = await readMappedCodebaseContext(projectRoot);
  const matchedPhase = roadmap.phases.find(
    (phase) => phase.phaseNumber === located.phaseNumber
  );
  const grounding = await readPhaseContextGrounding(projectRoot, matchedPhase);

  if (!located.found || !located.phaseNumber || !located.phasePrefix || !located.phaseDir) {
    return {
      phase: null,
      projectBrief: grounding.projectBrief,
      requirementsGrounding: grounding.requirementsGrounding,
      workflowPosture: grounding.workflowPosture,
      codebase,
      requirements: [],
      missingArtifacts: [],
      warnings: located.reason ? [located.reason] : []
    };
  }

  const artifacts = located.artifacts;
  const contextPath = buildArtifactPath(located.phaseDir, located.phasePrefix, "-CONTEXT.md");
  const researchPath = buildArtifactPath(located.phaseDir, located.phasePrefix, "-RESEARCH.md");
  const uiSpecPath = buildArtifactPath(located.phaseDir, located.phasePrefix, "-UI-SPEC.md");

  return {
    phase: {
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName ?? matchedPhase?.phaseName ?? slugToTitle(located.phaseDir),
      phaseDir: located.phaseDir,
      roadmap: {
        completed: matchedPhase?.completed ?? false,
        summary: matchedPhase?.summary ?? null,
        goal: matchedPhase?.goal ?? null,
        successCriteria: matchedPhase?.successCriteria ?? null
      },
      artifacts: {
        all: artifacts,
        context: findArtifact(artifacts, "-CONTEXT.md"),
        discussionLog: findArtifact(artifacts, "-DISCUSSION-LOG.md"),
        research: findArtifact(artifacts, "-RESEARCH.md"),
        uiSpec: findArtifact(artifacts, "-UI-SPEC.md"),
        verification: findArtifact(artifacts, "-VERIFICATION.md"),
        uat: findArtifact(artifacts, "-UAT.md"),
        plans: artifacts.filter((artifact) => artifact.endsWith("-PLAN.md")),
        summaries: artifacts.filter((artifact) => artifact.endsWith("-SUMMARY.md"))
      }
    },
    projectBrief: grounding.projectBrief,
    requirementsGrounding: {
      ...grounding.requirementsGrounding,
      roadmapRequirementIds: matchedPhase?.requirements ?? grounding.requirementsGrounding.roadmapRequirementIds,
      summary: grounding.requirementsGrounding.summary
    },
    workflowPosture: {
      ...grounding.workflowPosture,
      currentPhase: state.derivedStatus.currentPhase ?? grounding.workflowPosture.currentPhase,
      currentMilestone: state.state.currentMilestone ?? grounding.workflowPosture.currentMilestone,
      nextAction: state.derivedStatus.nextAction || grounding.workflowPosture.nextAction,
      blockers: state.blockers.length > 0 ? state.blockers : grounding.workflowPosture.blockers,
      summary: grounding.workflowPosture.summary
    },
    codebase,
    requirements: matchedPhase?.requirements ?? [],
    missingArtifacts: [contextPath, researchPath, uiSpecPath].filter(
      (artifact) => !artifacts.includes(artifact)
    ),
    warnings: [
      ...(!findArtifact(artifacts, "-CONTEXT.md")
        ? ["Research quality will be limited until XX-CONTEXT.md exists."]
        : []),
      ...codebase.warnings,
      ...(matchedPhase && matchedPhase.requirements.length === 0
        ? ["Phase requirements are missing from ROADMAP.md for this phase."]
        : [])
    ]
  };
}

export async function blueprintPhaseResearchStatus(
  args: PhaseLookupArgs = {}
): Promise<PhaseResearchStatusResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const context = await blueprintPhaseContext(args);
  const artifacts = context.phase?.artifacts;
  const contextStatus = await evaluatePhaseArtifactUsability(
    projectRoot,
    artifacts?.context ?? null,
    "context"
  );
  const uiSpecStatus = await evaluatePhaseArtifactUsability(
    projectRoot,
    artifacts?.uiSpec ?? null,
    "ui-spec"
  );
  const researchPath = artifacts?.research ?? null;
  let researchValid: boolean | null = null;
  let researchIssues: string[] = [];
  let researchDiagnostics: PhaseArtifactValidationDiagnostic[] = [];
  let researchUnreadable = false;
  const warnings = [...context.warnings, ...contextStatus.warnings, ...uiSpecStatus.warnings];

  if (researchPath) {
    const absolutePath = resolveBlueprintPath(projectRoot, researchPath);
    try {
      const raw = await fs.readFile(absolutePath, "utf8");
      const validation = validatePhaseArtifactContent(raw, "research");

      researchValid = validation.valid;
      researchIssues = validation.issues;
      researchDiagnostics = validation.diagnostics;
      warnings.push(...validation.warnings);
    } catch (error) {
      researchUnreadable = true;
      researchValid = false;
      const reason =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "unknown read failure";

      researchIssues = [
        `Research artifact at ${researchPath} could not be read: ${reason}.`
      ];
      researchDiagnostics = [
        {
          path: researchPath,
          code: "research.unreadable",
          message: `Research artifact at ${researchPath} could not be read: ${reason}.`,
          repair: `Restore or regenerate ${researchPath} with /blu-research-phase before planning.`,
          retryable: true,
          nextTool: "blueprint_phase_research_status"
        }
      ];
      warnings.push(
        `Research artifact at ${researchPath} is stale, deleted, or unreadable: ${reason}.`
      );
    }
  }

  const suggestedRepairs: string[] = [];
  const bootstrapStarterContext = contextStatus.diagnostics.some(
    (diagnostic) => diagnostic.code === "context.bootstrap_starter"
  );

  if (contextStatus.issues.length > 0) {
    suggestedRepairs.push(
      contextStatus.unreadable
        ? `Restore or regenerate ${artifacts?.context} with /blu-discuss-phase before planning.`
        : bootstrapStarterContext
          ? "Replace the bootstrap starter context through /blu-discuss-phase before planning."
          : "Update the phase context through /blu-discuss-phase so it matches the required context schema before planning."
    );
  }

  if (researchIssues.length > 0) {
    suggestedRepairs.push(
      researchUnreadable
        ? `Restore or regenerate ${researchPath} with /blu-research-phase before planning.`
        : "Update the phase research through /blu-research-phase so it matches the required research schema before planning."
    );
  }

  if (uiSpecStatus.issues.length > 0) {
    suggestedRepairs.push(
      uiSpecStatus.unreadable
        ? `Restore or regenerate ${artifacts?.uiSpec} with /blu-ui-phase before planning.`
        : "Update the phase UI spec through /blu-ui-phase so it provides a usable contract or explicit skip rationale before planning."
    );
  }

  const planningReadiness = buildPhasePlanningReadiness({
    context,
    contextStatus,
    researchPath,
    researchValid,
    uiSpecStatus
  });

  return {
    hasContext: contextStatus.present,
    hasResearch: Boolean(artifacts?.research),
    hasUiSpec: uiSpecStatus.present,
    hasUsableContext: contextStatus.usable,
    hasUsableResearch: researchValid === true,
    hasUsableUiSpec: uiSpecStatus.usable,
    contextPath: artifacts?.context ?? null,
    researchPath,
    uiSpecPath: artifacts?.uiSpec ?? null,
    contextValid: contextStatus.valid,
    contextIssues: contextStatus.issues,
    contextDiagnostics: contextStatus.diagnostics,
    researchValid,
    researchIssues,
    researchDiagnostics,
    uiSpecValid: uiSpecStatus.valid,
    uiSpecIssues: uiSpecStatus.issues,
    uiSpecDiagnostics: uiSpecStatus.diagnostics,
    suggestedRepairs,
    planningReadiness,
    warnings
  };
}

export async function blueprintPhaseArtifactRead(
  args: PhaseArtifactReadArgs
): Promise<PhaseArtifactReadResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate(args);
  const resolved = toResolvedPhaseLocation(located);

  if (!resolved) {
    return {
      phaseFound: false,
      found: false,
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName,
      phaseDir: located.phaseDir,
      artifact: args.artifact,
      path: null,
      content: null,
      reason: located.reason
    };
  }

  const artifactPath = artifactPathFor(resolved, args.artifact);
  const absolutePath = resolveBlueprintPath(projectRoot, artifactPath);

  if (!(await pathExists(absolutePath))) {
    return {
      phaseFound: true,
      found: false,
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      artifact: args.artifact,
      path: artifactPath,
      content: null,
      reason: `${artifactPath} does not exist yet.`
    };
  }

  return {
    phaseFound: true,
    found: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    artifact: args.artifact,
    path: artifactPath,
    content: await fs.readFile(absolutePath, "utf8"),
    reason: null
  };
}

function phaseArtifactSuggestedRepairs(
  artifact: PhaseArtifactKind,
  diagnostics: readonly PhaseArtifactValidationDiagnostic[]
): string[] {
  if (diagnostics.length > 0) {
    return [...new Set(diagnostics.map((diagnostic) => diagnostic.repair))];
  }

  if (artifact === "research") {
    return ["Add the required research sections, confidence marker, and at least one cited source before retrying."];
  }

  if (artifact === "ui-spec") {
    return [
      "Add a populated Outcome Mode section plus either the contract headings or an explicit skip Rationale before retrying."
    ];
  }

  if (artifact === "context") {
    return [
      "Add a real context artifact title, remove scaffold placeholders, and populate every required context section with substantive downstream-planning detail before retrying."
    ];
  }

  return [
    `Add a real ${artifact} artifact title, remove scaffold placeholders, and populate at least one contract section before retrying.`
  ];
}

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

function renderPhaseContextModelContent(args: {
  resolved: ResolvedPhaseLocation;
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

function validatePhaseContextModelInput(
  model: unknown
): { model: null; validation: ReturnType<typeof validatePhaseArtifactContent> } | { model: PhaseContextStructuredModel; validation: null } {
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

function phaseArtifactRetryPlan(
  artifact: PhaseArtifactKind,
  diagnostics: readonly PhaseArtifactValidationDiagnostic[]
): PhaseArtifactRetryPlan {
  const suggestedRepairs = phaseArtifactSuggestedRepairs(artifact, diagnostics);
  const command =
    artifact === "context" || artifact === "discussion-log"
      ? "/blu-discuss-phase"
      : artifact === "research"
        ? "/blu-research-phase"
        : "/blu-ui-phase";

  return {
    retryable: diagnostics.length === 0 || diagnostics.every((diagnostic) => diagnostic.retryable),
    nextTool: "blueprint_phase_artifact_write",
    steps: [
      `Read blueprint_artifact_contract_read for phase.${artifact === "discussion-log" ? "discussion-log" : artifact}.`,
      ...suggestedRepairs,
      `Use ${command} orchestration or retry blueprint_phase_artifact_write with repaired content.`
    ]
  };
}

function invalidPhaseArtifactWriteResult(args: {
  resolved: ResolvedPhaseLocation;
  artifact: PhaseArtifactKind;
  path: string;
  validation: ReturnType<typeof validatePhaseArtifactContent>;
  warnings: string[];
}): PhaseArtifactWriteResult {
  const suggestedRepairs = phaseArtifactSuggestedRepairs(args.artifact, args.validation.diagnostics);
  const retryPlan = phaseArtifactRetryPlan(args.artifact, args.validation.diagnostics);

  return {
    phaseNumber: args.resolved.phaseNumber,
    phasePrefix: args.resolved.phasePrefix,
    phaseName: args.resolved.phaseName,
    phaseDir: args.resolved.phaseDir,
    artifact: args.artifact,
    path: args.path,
    written: false,
    created: false,
    overwritten: false,
    status: "invalid",
    validation: {
      valid: false,
      issues: args.validation.issues,
      warnings: args.validation.warnings,
      suggestedRepairs,
      diagnostics: args.validation.diagnostics,
      retryPlan
    },
    diagnostics: args.validation.diagnostics,
    suggestedRepairs,
    retryPlan,
    warnings: [...args.warnings, ...args.validation.warnings]
  };
}

export async function blueprintPhaseArtifactWrite(
  args: PhaseArtifactWriteArgs
): Promise<PhaseArtifactWriteResult> {
  const { projectRoot, resolved } = await resolveLocatedPhaseForMutation(args);
  const artifactPath = artifactPathFor(resolved, args.artifact);
  const absolutePath = resolveBlueprintPath(projectRoot, artifactPath);
  const hasContent = args.content !== undefined;
  const hasModel = args.model !== undefined;

  if (hasContent === hasModel) {
    return invalidPhaseArtifactWriteResult({
      resolved,
      artifact: args.artifact,
      path: artifactPath,
      validation: {
        valid: false,
        issues: ["Phase artifact writes must supply exactly one of content or model."],
        warnings: [],
        diagnostics: [
          {
            path: "args",
            code: "write.exactly_one_input",
            message: "Phase artifact writes must supply exactly one of content or model.",
            repair: "Pass either finalized Markdown content for freehand phase artifacts or a structured model for phase.context, not both.",
            retryable: true,
            nextTool: "blueprint_phase_artifact_write"
          }
        ]
      },
      warnings: []
    });
  }

  if (hasModel && args.artifact !== "context") {
    return invalidPhaseArtifactWriteResult({
      resolved,
      artifact: args.artifact,
      path: artifactPath,
      validation: {
        valid: false,
        issues: [`phase.${args.artifact} does not support structured model writes. Supply canonical Markdown content instead.`],
        warnings: [],
        diagnostics: [
          {
            path: "args.model",
            code: "write.unsupported_model",
            message: `phase.${args.artifact} does not support structured model writes.`,
            repair: "Use Markdown content for this freehand phase artifact, or use artifact: \"context\" with a phase.context structured model.",
            retryable: true,
            nextTool: "blueprint_phase_artifact_write"
          }
        ]
      },
      warnings: []
    });
  }

  if (args.artifact === "context" && hasContent) {
    return invalidPhaseArtifactWriteResult({
      resolved,
      artifact: args.artifact,
      path: artifactPath,
      validation: {
        valid: false,
        issues: [
          "phase.context is model-only; Markdown content fallback is not supported."
        ],
        warnings: [],
        diagnostics: [
          {
            path: "args.content",
            code: "write.model_only",
            message: "phase.context is model-only; Markdown content fallback is not supported.",
            repair: "Remove content, pass the structured phase.context model, and let blueprint_phase_artifact_write render canonical Markdown.",
            retryable: true,
            nextTool: "blueprint_phase_artifact_write"
          }
        ]
      },
      warnings: []
    });
  }

  let normalizedContent: string;

  if (hasModel) {
    const modelValidation = validatePhaseContextModelInput(args.model);

    if (!modelValidation.model) {
      return invalidPhaseArtifactWriteResult({
        resolved,
        artifact: args.artifact,
        path: artifactPath,
        validation: modelValidation.validation,
        warnings: []
      });
    }

    normalizedContent = normalizeTextContent(
      renderPhaseContextModelContent({
        resolved,
        model: modelValidation.model
      })
    );
  } else {
    normalizedContent = normalizeTextContent(args.content ?? "");
  }
  const exists = await pathExists(absolutePath);
  const warnings: string[] = [];
  const validation = validatePhaseArtifactContent(normalizedContent, args.artifact);

  if (exists) {
    const existingContent = await fs.readFile(absolutePath, "utf8");
    const existingValidation = validatePhaseArtifactContent(existingContent, args.artifact);

    if (existingContent === normalizedContent) {
      if (!validation.valid) {
        return invalidPhaseArtifactWriteResult({
          resolved,
          artifact: args.artifact,
          path: artifactPath,
          validation,
          warnings
        });
      }

      warnings.push(`Preserved existing ${args.artifact} artifact because the content was unchanged.`);

      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        artifact: args.artifact,
        path: artifactPath,
        written: false,
        created: false,
        overwritten: false,
        status: "reused",
        validation: {
          valid: validation.valid,
          issues: validation.issues,
          warnings: validation.warnings,
          suggestedRepairs: []
        },
        warnings: [...warnings, ...validation.warnings]
      };
    }

    if (!(args.overwrite ?? false) && !isScaffoldGeneratedPhaseArtifact(existingContent)) {
      throw new Error(
        `${artifactPath} already exists. Re-run only after explicit overwrite confirmation.`
      );
    }

    if (!(args.overwrite ?? false) && !existingValidation.valid) {
      warnings.push(`Replacing the existing scaffold ${args.artifact} artifact with authored content.`);
    } else if (!(args.overwrite ?? false)) {
      throw new Error(
        `${artifactPath} already exists. Re-run only after explicit overwrite confirmation.`
      );
    }
  }

  if (!validation.valid && (args.validationMode ?? "strict") === "strict") {
    return invalidPhaseArtifactWriteResult({
      resolved,
      artifact: args.artifact,
      path: artifactPath,
      validation,
      warnings
    });
  }

  warnings.push(
    ...await writeTextFile(absolutePath, normalizedContent, {
      label: artifactPath
    })
  );

  if (exists) {
    warnings.push(`Replaced existing ${args.artifact} artifact: ${artifactPath}`);
  }

  return {
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    artifact: args.artifact,
    path: artifactPath,
    written: true,
    created: !exists,
    overwritten: exists,
    status: exists ? "updated" : "created",
    validation: {
      valid: validation.valid,
      issues: validation.issues,
      warnings: validation.warnings,
      suggestedRepairs: []
    },
    warnings: [...warnings, ...validation.warnings]
  };
}

export async function blueprintPhaseValidationRead(
  args: PhaseValidationReadArgs
): Promise<PhaseValidationReadResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate(args);
  const resolved = toResolvedPhaseLocation(located);

  if (!resolved) {
    return {
      phaseFound: false,
      found: false,
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName,
      phaseDir: located.phaseDir,
      artifact: args.artifact,
      path: null,
      content: null,
      validation: null,
      verificationReadyForUat: false,
      uatStatus: null,
      resumeState: null,
      checkpoint: null,
      complete: false,
      summaryPaths: [],
      reason: located.reason
    };
  }

  const artifactPath = validationArtifactPathFor(resolved, args.artifact);
  const absolutePath = resolveBlueprintPath(projectRoot, artifactPath);

  if (!(await pathExists(absolutePath))) {
    return {
      phaseFound: true,
      found: false,
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      artifact: args.artifact,
      path: artifactPath,
      content: null,
      validation: null,
      verificationReadyForUat: false,
      uatStatus: null,
      resumeState: null,
      checkpoint: null,
      complete: false,
      summaryPaths: [],
      reason: `${artifactPath} does not exist yet.`
    };
  }

  const content = await fs.readFile(absolutePath, "utf8");
  const summaryIndex = await blueprintPhaseSummaryIndex({
    cwd: projectRoot,
    phase: resolved.phaseNumber
  });
  const completedSummaryPlanIds = new Set(summaryIndex.completedPlans);
  const completedSummaries = completedSummaryRecords(
    summaryIndex.summaries,
    completedSummaryPlanIds
  );
  const { summaryPaths: completedSummaryPaths, warnings: completedSummaryWarnings } =
    await collectValidatedSummaryPaths(projectRoot, completedSummaries);
  const validation =
    args.artifact === "verification"
      ? validateVerificationArtifactContent(content, completedSummaryPaths)
      : validateUatArtifactContent(content, completedSummaryPaths, {
          requireReadyVerificationEvidence: true
        });
  const validationWithSummaryWarnings = {
    ...validation,
    warnings: [...completedSummaryWarnings, ...validation.warnings]
  };
  const uatState = args.artifact === "uat" ? readUatArtifactState(content) : null;
  const verificationReadyForUat =
    args.artifact === "verification" &&
    validationWithSummaryWarnings.valid &&
    completedSummaryPaths.length > 0
      ? isVerificationArtifactReadyForUat(content)
      : false;
  const complete =
    args.artifact === "verification"
      ? validationWithSummaryWarnings.valid && verificationReadyForUat
      : validationWithSummaryWarnings.valid && Boolean(uatState?.complete);
  const resultSummaryPaths = completedSummaryPaths;

  return {
    phaseFound: true,
    found: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    artifact: args.artifact,
    path: artifactPath,
    content,
    validation: validationWithSummaryWarnings,
    verificationReadyForUat,
    uatStatus: uatState?.status ?? null,
    resumeState: uatState?.resumeState ?? null,
    checkpoint: uatState?.checkpoint ?? null,
    complete,
    summaryPaths: resultSummaryPaths,
    reason: null
  };
}

export async function blueprintPhaseValidationWrite(
  args: PhaseValidationWriteArgs
): Promise<PhaseValidationWriteResult> {
  const { projectRoot, resolved } = await resolveLocatedPhaseForMutation(args);
  const artifactPath = validationArtifactPathFor(resolved, args.artifact);
  const absolutePath = resolveBlueprintPath(projectRoot, artifactPath);
  const hasContent = args.content !== undefined;
  const hasModel = args.model !== undefined;

  if (hasContent === hasModel) {
    return {
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      artifact: args.artifact,
      path: artifactPath,
      summaryPaths: [],
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      issues: [
        "Phase validation writes must supply exactly one of content or model."
      ],
      warnings: []
    };
  }

  if (args.authoringMode === "model-only" && hasContent) {
    return {
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      artifact: args.artifact,
      path: artifactPath,
      summaryPaths: [],
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      issues: [
        "Phase validation model-only writes must supply the validated structured model, not Markdown content."
      ],
      warnings: []
    };
  }

  const summaryIndex = await blueprintPhaseSummaryIndex({
    cwd: projectRoot,
    phase: resolved.phaseNumber
  });

  if (!summaryIndex.phaseFound) {
    throw new Error(
      `Phase ${resolved.phaseNumber} could not be resolved for validation persistence.`
    );
  }

  const { summaryPaths, warnings: summaryWarnings } = await collectValidatedSummaryPaths(
    projectRoot,
    completedSummaryRecords(summaryIndex.summaries, new Set(summaryIndex.completedPlans))
  );
  const artifactLabel = args.artifact === "verification" ? "verification" : "UAT";
  const warnings: string[] = [...summaryWarnings];

  if (summaryPaths.length === 0) {
    throw new Error(
      `Phase ${resolved.phaseNumber} does not have any valid execution summaries yet. Run /blu-execute-phase ${resolved.phaseNumber} after fixing summary artifacts before writing ${artifactLabel} artifacts.`
    );
  }

  let normalizedContent: string;

  if (hasModel) {
    const modelValidation = await blueprintPhaseValidationValidateModel({
      cwd: projectRoot,
      phase: resolved.phaseNumber,
      artifact: args.artifact,
      model: args.model
    });

    if (!modelValidation.valid || !modelValidation.renderPreview) {
      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        artifact: args.artifact,
        path: artifactPath,
        summaryPaths,
        written: false,
        created: false,
        overwritten: false,
        status: "invalid",
        issues: modelValidation.diagnostics.map(formatPhaseValidationDiagnostic),
        warnings: [...warnings, ...modelValidation.warnings]
      };
    }

    normalizedContent = normalizeTextContent(modelValidation.renderPreview);
  } else {
    normalizedContent = normalizeTextContent(args.content ?? "");
  }

  const exists = await pathExists(absolutePath);
  const completedSummaryPaths = summaryPaths;
  const validationSummaryPaths = completedSummaryPaths;
  const validation =
    normalizedContent.trim().length === 0
      ? {
          valid: false,
          issues: [`${args.artifact} content must not be empty.`],
          warnings: [] as string[]
        }
      : args.artifact === "verification"
        ? validateVerificationArtifactContent(normalizedContent, completedSummaryPaths)
        : validateUatArtifactContent(normalizedContent, validationSummaryPaths, {
            requireReadyVerificationEvidence: true
          });

  if (args.artifact === "uat") {
    const verificationPath = validationArtifactPathFor(resolved, "verification");
    const verificationAbsolutePath = resolveBlueprintPath(projectRoot, verificationPath);

    if (!(await pathExists(verificationAbsolutePath))) {
      throw new Error(
        `Phase ${resolved.phaseNumber} must be validated before UAT. Run /blu-validate-phase ${resolved.phaseNumber} first.`
      );
    }

    const verificationContent = await fs.readFile(verificationAbsolutePath, "utf8");
    const verificationValidation = validateVerificationArtifactContent(
      verificationContent,
      completedSummaryPaths
    );

    if (!verificationValidation.valid) {
      throw new Error(
        `Phase ${resolved.phaseNumber} must have a valid VERIFICATION artifact before UAT. Repair the verification evidence before writing ${artifactLabel} artifacts.`
      );
    }

    if (!isVerificationArtifactReadyForUat(verificationContent)) {
      throw new Error(
        `Phase ${resolved.phaseNumber} must have a VERIFICATION artifact that is ready for UAT before writing ${artifactLabel} artifacts. Repair the verification evidence before writing ${artifactLabel} artifacts.`
      );
    }
  }

  if (exists) {
    const existingContent = await fs.readFile(absolutePath, "utf8");
    const existingReferencedSummaryPaths = collectReferencedValidatedSummaryPaths(
      existingContent,
      summaryIndex.summaries,
      new Set(summaryIndex.completedPlans)
    );
    const existingValidation =
      args.artifact === "verification"
        ? validateVerificationArtifactContent(existingContent, existingReferencedSummaryPaths)
        : validateUatArtifactContent(existingContent, validationSummaryPaths, {
            requireReadyVerificationEvidence: true
          });
    const existingUatState = args.artifact === "uat" ? readUatArtifactState(existingContent) : null;
    const nextUatState = args.artifact === "uat" ? readUatArtifactState(normalizedContent) : null;

    if (existingContent === normalizedContent) {
      if (!validation.valid) {
        return {
          phaseNumber: resolved.phaseNumber,
          phasePrefix: resolved.phasePrefix,
          phaseName: resolved.phaseName,
          phaseDir: resolved.phaseDir,
          artifact: args.artifact,
          path: artifactPath,
          summaryPaths: validationSummaryPaths,
          written: false,
          created: false,
          overwritten: false,
          status: "invalid",
          issues: validation.issues,
          warnings: [...warnings, ...validation.warnings]
        };
      }

      warnings.push(`Preserved existing ${args.artifact} artifact because the content was unchanged.`);
      if (args.artifact === "uat") {
        warnings.push(...(await syncRoadmapPhaseCompletion(projectRoot, resolved)));
      }

      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        artifact: args.artifact,
        path: artifactPath,
        summaryPaths: validationSummaryPaths,
        written: false,
        created: false,
        overwritten: false,
        status: "reused",
        issues: validation.issues,
        warnings: [...warnings, ...validation.warnings]
      };
    }

    const resumableUatContinuation =
      args.artifact === "uat" &&
      existingValidation.valid &&
      existingUatState !== null &&
      !existingUatState.complete &&
      nextUatState !== null &&
      nextUatState.resumeState !== "NEW";

    if (!(args.overwrite ?? false) && !resumableUatContinuation) {
      throw new Error(
        `${artifactPath} already exists. Re-run only after explicit overwrite confirmation.`
      );
    }

    if (resumableUatContinuation) {
      warnings.push(
        `Continuing the existing incomplete UAT artifact at ${artifactPath} without the replace path because the saved pass remains resumable.`
      );
    }
  }

  if (!validation.valid) {
    return {
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      artifact: args.artifact,
      path: artifactPath,
      summaryPaths: validationSummaryPaths,
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      issues: validation.issues,
      warnings: [...warnings, ...validation.warnings]
    };
  }

  warnings.push(
    ...await writeTextFile(absolutePath, normalizedContent, {
      label: artifactPath
    })
  );

  if (exists) {
    warnings.push(`Replaced existing ${args.artifact} artifact: ${artifactPath}`);
  }

  if (args.artifact === "uat") {
    warnings.push(...(await syncRoadmapPhaseCompletion(projectRoot, resolved)));
  }

  return {
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    artifact: args.artifact,
    path: artifactPath,
    summaryPaths: validationSummaryPaths,
    written: true,
    created: !exists,
    overwritten: exists,
    status: exists ? "updated" : "created",
    issues: validation.issues,
    warnings: [...warnings, ...validation.warnings]
  };
}

export async function blueprintPhasePlanIndex(
  args: PlanIndexArgs = {}
): Promise<PhasePlanIndexResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate(args);
  const resolved = toResolvedPhaseLocation(located);

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

  const planPaths = located.artifacts
    .filter((artifact) => artifact.endsWith("-PLAN.md"))
    .sort((left, right) => left.localeCompare(right));
  const plans: PhasePlanRecord[] = [];
  const waves: Record<string, string[]> = {};
  const warnings: string[] = [];
  const knownPlanIds = new Set<string>();
  const gapClosurePlans = new Set<string>();

  for (const planPath of planPaths) {
    const planId = parsePlanArtifactPath(planPath, resolved.phasePrefix);

    if (!planId) {
      warnings.push(`Ignoring non-canonical plan artifact name: ${planPath}`);
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

export async function blueprintPhasePlanRead(
  args: PhasePlanReadArgs
): Promise<PhasePlanReadResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate(args);
  const resolved = toResolvedPhaseLocation(located);

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
  const validation = validatePlanArtifactContent(content, resolved.phaseNumber);
  const dependencyIssues = collectInvalidPlanDependencyIssues(
    pathValue,
    validation.metadata.dependsOn
  );

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
      autonomous: validation.metadata.autonomous
    },
    validation: {
      valid: validation.valid && dependencyIssues.length === 0,
      issues: [...validation.issues, ...dependencyIssues],
      warnings: validation.warnings
    },
    reason: null
  };
}

export async function blueprintPhasePlanValidate(
  args: PhasePlanValidateArgs = {}
): Promise<PhasePlanValidationResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate(args);
  const resolved = toResolvedPhaseLocation(located);

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
    const blockers = phasePlanAuthoringContextBlockers(context);

    return {
      status: blockers.length === 0 ? "ready" : "invalid",
      phase: context.resolved,
      planId: context.planId,
      path: context.pathValue,
      schemaPath: context.schemaPath,
      baseSchema: context.baseSchema,
      taskSchema: context.taskSchema,
      knownRequirements: context.knownRequirements,
      knownEvidenceArtifacts: context.knownEvidenceArtifacts,
      allowedDependencyPlanIds: context.allowedDependencyPlanIds,
      modelOnly: true,
      reason: blockers.length === 0 ? null : blockers.join(" "),
      warnings: []
    };
  } catch (error) {
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
      modelOnly: true,
      reason: error instanceof Error ? error.message : String(error),
      warnings: []
    };
  }
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

  return trimPhasePlanStandaloneValidateModelResult(validation);
}

export async function blueprintPhasePlanWrite(
  args: PhasePlanWriteArgs
): Promise<PhasePlanWriteResult> {
  const { projectRoot, resolved } = await resolveLocatedPhaseForMutation(args);
  const hasContent = args.content !== undefined;
  const hasModel = args.model !== undefined;
  const modelOnly = args.authoringMode === "model-only";
  const strictValidation = (args.validationMode ?? "strict") === "strict";
  return withBlueprintRepoLock(projectRoot, "phase-plan-write", async () => {
    const existingIndex = await blueprintPhasePlanIndex({
      cwd: projectRoot,
      phase: resolved.phaseNumber
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

    let normalizedContent: string;
    let modelCoverageIssues: string[] = [];
    let modelWarnings: string[] = [];
    let modelValidation: PhasePlanWriteModelValidationResult | null = null;

    if (hasModel) {
      const authoringContext = await resolvePhasePlanAuthoringContextData({
        cwd: projectRoot,
        phase: resolved.phaseNumber,
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
    const dependencyIssues = collectInvalidPlanDependencyIssues(
      pathValue,
      validation.metadata.dependsOn
    );
    const normalizedFrontmatterPlanId =
      validation.metadata.planId && /^\d+$/.test(validation.metadata.planId)
        ? normalizePlanId(validation.metadata.planId)
        : null;
    const validationIssues = [...modelCoverageIssues, ...validation.issues, ...dependencyIssues];
    const warnings: string[] = [...modelWarnings, ...preparedContent.warnings];

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
          warnings: validation.warnings
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
          issues: [...validation.issues, issue],
          warnings: validation.warnings
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
          warnings: validation.warnings
        },
        modelValidation,
        warnings: [...warnings, ...validation.warnings]
      };
    }

    if (!validation.valid && strictValidation) {
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
          warnings: validation.warnings
        },
        warnings: []
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
            valid: prospectiveValidation.status === "valid",
            issues: prospectiveValidation.issues,
            warnings: prospectiveValidation.warnings
          },
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
        valid: prospectiveValidation.status === "valid",
        issues: prospectiveValidation.issues,
        warnings: prospectiveValidation.warnings
      },
      warnings: [...warnings, ...prospectiveValidation.warnings]
    };
  });
}

export async function blueprintPhaseSummaryIndex(
  args: PlanIndexArgs = {}
): Promise<PhaseSummaryIndexResult> {
  const located = await blueprintPhaseLocate(args);
  const resolved = toResolvedPhaseLocation(located);

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

  const projectRoot = await ensureRepoRoot(args.cwd);
  const planIndex = await blueprintPhasePlanIndex({
    cwd: projectRoot,
    phase: resolved.phaseNumber
  });
  const summaryPaths = located.artifacts
    .filter((artifact) => artifact.endsWith("-SUMMARY.md"))
    .sort((left, right) => left.localeCompare(right));
  const summaries: PhaseSummaryRecord[] = [];
  let completedPlans = new Set<string>();
  const warnings = [...planIndex.warnings];
  const knownPlanIds = new Set(planIndex.plans.map((plan) => plan.planId));
  const knownPlanPaths = new Map(planIndex.plans.map((plan) => [plan.planId, plan.path]));
  const planRecordsById = new Map(planIndex.plans.map((plan) => [plan.planId, plan]));
  const loadedSummaries: Array<{
    planId: string;
    path: string;
    content: string;
    status: PhaseSummaryRecord["status"];
    completedEvidence: boolean;
    legacyCompletedEvidence: boolean;
    strictValidation: { valid: boolean; issues: string[]; warnings: string[] };
    validation: { valid: boolean; issues: string[]; warnings: string[] };
    linkedPlan: PhasePlanRecord | null;
    dependencyPlanIds: string[];
  }> = [];

  for (const summaryPath of summaryPaths) {
    const planId = parseSummaryArtifactPath(summaryPath, resolved.phasePrefix);

    if (!planId) {
      warnings.push(`Ignoring non-canonical summary artifact name: ${summaryPath}`);
      continue;
    }

    const content = await fs.readFile(resolveBlueprintPath(projectRoot, summaryPath), "utf8");
    const linkedPlanPath = extractSummaryPlanReference(content);
    const strictValidation = validateStrictSummaryArtifactContent(content, {
      linkedPlanPath: knownPlanPaths.get(planId) ?? null
    });
    const linkedPlan = planRecordsById.get(planId) ?? null;
    const livePlanValidation = validateSummaryAgainstLivePlanInventory(content, {
      resolved,
      planId,
      plan: linkedPlan,
      knownPlanIds,
      completedRouteValidation: { mode: "skip" }
    });
    const validation = {
      valid: strictValidation.valid && livePlanValidation.valid,
      issues: [...strictValidation.issues, ...livePlanValidation.issues],
      warnings: [...strictValidation.warnings, ...livePlanValidation.warnings]
    };

    summaries.push(toPhaseSummaryRecord(planId, summaryPath, content, linkedPlanPath));

    const summaryStatus = extractSummaryStatus(content);
    const completedEvidence = summaryCountsAsCompleted(summaryStatus, content);
    const legacyCompletedEvidence = completedEvidence && summaryStatus === null;

    loadedSummaries.push({
      planId,
      path: summaryPath,
      content,
      status: summaryStatus,
      completedEvidence,
      legacyCompletedEvidence,
      strictValidation,
      validation,
      linkedPlan,
      dependencyPlanIds: linkedPlan ? normalizeDependencyPlanIds(linkedPlan.dependsOn) : []
    });
  }

  const deriveCompletedPlans = (): Set<string> => {
    const derivedCompletedPlans = new Set<string>();
    let changed = true;

    while (changed) {
      changed = false;

      for (const loaded of loadedSummaries) {
        if (
          derivedCompletedPlans.has(loaded.planId) ||
          !loaded.completedEvidence ||
          !loaded.validation.valid ||
          !loaded.linkedPlan
        ) {
          continue;
        }

        if (
          loaded.dependencyPlanIds.every((dependencyPlanId) =>
            derivedCompletedPlans.has(dependencyPlanId)
          )
        ) {
          derivedCompletedPlans.add(loaded.planId);
          changed = true;
        }
      }
    }

    return derivedCompletedPlans;
  };

  completedPlans = deriveCompletedPlans();

  for (let attempt = 0; attempt < loadedSummaries.length + 1; attempt += 1) {
    for (const loaded of loadedSummaries) {
      const livePlanValidation = validateSummaryAgainstLivePlanInventory(loaded.content, {
        resolved,
        planId: loaded.planId,
        plan: loaded.linkedPlan,
        knownPlanIds,
        completedDependencyPlanIds: completedPlans,
        completedRouteValidation: { mode: "indexed" }
      });

      loaded.validation = {
        valid: loaded.strictValidation.valid && livePlanValidation.valid,
        issues: [...loaded.strictValidation.issues, ...livePlanValidation.issues],
        warnings: [...loaded.strictValidation.warnings, ...livePlanValidation.warnings]
      };
    }

    const nextCompletedPlans = deriveCompletedPlans();

    if (
      nextCompletedPlans.size === completedPlans.size &&
      [...nextCompletedPlans].every((planId) => completedPlans.has(planId))
    ) {
      completedPlans = nextCompletedPlans;
      break;
    }

    completedPlans = nextCompletedPlans;
  }

  for (const loaded of loadedSummaries) {
    if (loaded.validation.valid && loaded.completedEvidence) {
      if (!completedPlans.has(loaded.planId)) {
        warnings.push(
          `${loaded.path}: linked plan ${loaded.linkedPlan?.path ?? loaded.planId} depends on incomplete execution plan(s): ${loaded.dependencyPlanIds
            .filter((dependencyPlanId) => !completedPlans.has(dependencyPlanId))
            .join(", ")}, so this summary does not close execution coverage.`
        );
      } else if (loaded.legacyCompletedEvidence) {
        warnings.push(
          `${loaded.path}: legacy summary has no Status marker; treating it as completed execution evidence because the canonical plan link and semantic checks passed.`
        );
      }
    } else if (loaded.validation.valid && loaded.status) {
      warnings.push(
        `${loaded.path}: summary status is ${loaded.status}, so it remains pending execution debt.`
      );
    } else {
      warnings.push(
        `${loaded.path}: summary artifact is invalid and does not count as completed execution evidence.`
      );
      warnings.push(...loaded.validation.issues.map((issue) => `${loaded.path}: ${issue}`));
      warnings.push(...loaded.validation.warnings.map((warning) => `${loaded.path}: ${warning}`));
    }
  }

  const pendingPlans = planIndex.plans
    .map((plan) => plan.planId)
    .filter((planId) => !completedPlans.has(planId));

  return {
    phaseFound: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    summaries,
    completedPlans: [...completedPlans].sort(),
    pendingPlans,
    warnings
  };
}

export async function blueprintPhaseSummaryAuthoringContext(
  args: PhaseSummaryAuthoringContextArgs
): Promise<PhaseSummaryAuthoringContextResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate(args);
  const resolved = toResolvedPhaseLocation(located);
  const planId = normalizePlanId(args.planId);
  const contract = readArtifactContract("phase.summary", phaseSummaryContractContext(resolved ?? undefined, planId));

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

  const summaryPath = summaryPathFor(resolved, planId);
  const planRead = await blueprintPhasePlanRead({
    cwd: projectRoot,
    phase: resolved.phaseNumber,
    planId
  });
  const planIndex = await blueprintPhasePlanIndex({
    cwd: projectRoot,
    phase: resolved.phaseNumber
  });
  const existing = await blueprintPhaseSummaryRead({
    cwd: projectRoot,
    phase: resolved.phaseNumber,
    planId
  });
  const summaryIndex = await blueprintPhaseSummaryIndex({
    cwd: projectRoot,
    phase: resolved.phaseNumber
  });
  const indexedPlan = planIndex.plans.find((candidate) => candidate.planId === planId) ?? null;
  const linkedPlanPath = planRead.path ?? indexedPlan?.path ?? planPathFor(resolved, planId);
  const knownPlanIds = new Set(planIndex.plans.map((candidate) => candidate.planId));
  const dependsOn = indexedPlan?.dependsOn ?? planRead.metadata?.dependsOn ?? [];
  const missingDependencyPlans = collectMissingDependencyPlanPaths(dependsOn, knownPlanIds, resolved);
  const dependencyPlans = dependsOn.flatMap((dependency) => {
    try {
      const normalizedDependency = normalizePlanId(dependency);

      return knownPlanIds.has(normalizedDependency)
        ? [
            {
              planId: normalizedDependency,
              path: planPathFor(resolved, normalizedDependency)
            }
          ]
        : [];
    } catch {
      return [];
    }
  });
  const acceptanceCriteria =
    indexedPlan?.acceptanceCriteria ?? planRead.metadata?.acceptanceCriteria ?? [];
  const completedDependencyPlanIds = new Set(summaryIndex.completedPlans);
  const planIds = planIndex.plans.map((candidate) => candidate.planId);
  const completedRoute = completedRouteAfterSelectedCompletion({
    phaseNumber: resolved.phaseNumber,
    planIds,
    completedPlanIds: completedDependencyPlanIds,
    selectedPlanId: planId
  });
  const unsatisfiedDependencyPlans = dependencyPlans.filter(
    (dependency) => !completedDependencyPlanIds.has(dependency.planId)
  );
  const blockers: string[] = [];
  const warnings = [...planIndex.warnings, ...summaryIndex.warnings];

  if (!planRead.found || !planRead.path) {
    blockers.push(
      `${linkedPlanPath} does not exist yet. Create the matching plan before authoring a summary.`
    );
  } else if (!planRead.validation?.valid) {
    const planIssues = planRead.validation?.issues.length
      ? planRead.validation.issues
      : ["Linked plan artifact is invalid and must be repaired before execution can be summarized."];
    blockers.push(...planIssues.map((issue) => `${planRead.path}: ${issue}`));
  }

  if (missingDependencyPlans.length > 0) {
    blockers.push(
      `${linkedPlanPath}: linked plan is missing dependency plan artifacts: ${missingDependencyPlans.join(", ")}`
    );
  }

  if (unsatisfiedDependencyPlans.length > 0) {
    warnings.push(
      `${linkedPlanPath}: a COMPLETED summary cannot close until linked dependency plan summaries are completed: ${unsatisfiedDependencyPlans
        .map((dependency) => `${dependency.planId} (${dependency.path})`)
        .join(", ")}`
    );
  }

  const allowedNextActions = await buildPhaseSummaryAllowedNextActions(resolved.phaseNumber);

  return {
    status: blockers.length === 0 ? "ready" : "invalid",
    phase: resolved,
    planId,
    path: summaryPath,
    linkedPlanPath,
    plan: indexedPlan,
    existing,
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
  const context = await blueprintPhaseSummaryAuthoringContext({
    cwd: args.cwd,
    phase: args.phase,
    planId: args.planId
  });
  const diagnostics: PhaseSummaryModelDiagnostic[] = context.prerequisiteBlockers.map((message) =>
    phaseSummaryDiagnostic({
      source: "scope",
      path: "phase.plan",
      code: "scope.prerequisite_blocker",
      message,
      context: { phase: context.phase?.phaseNumber ?? null, planId: context.planId },
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
            suggestion: "Pass Markdown content, or provide the legacy model fields needed for rendering."
          })
        );
      } else if (context.phase && context.planId && context.path && context.linkedPlanPath) {
        renderPreview = renderPhaseSummaryModelContent({
          model: normalizedModel,
          resolved: context.phase,
          planId: context.planId,
          linkedPlanPath: context.linkedPlanPath,
          summaryPath: context.path
        });
      }
    }
  }

  if (
    renderPreview &&
    context.phase &&
    context.planId &&
    context.path &&
    context.linkedPlanPath
  ) {
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
      linkedPlanPath: context.linkedPlanPath,
      requirePlanMarker: true
    });
    const planIndex = await blueprintPhasePlanIndex({
      cwd: args.cwd,
      phase: context.phase.phaseNumber
    });
    const summaryIndex = await blueprintPhaseSummaryIndex({
      cwd: args.cwd,
      phase: context.phase.phaseNumber
    });
    const completedRoute = completedRouteAfterSelectedCompletion({
      phaseNumber: context.phase.phaseNumber,
      planIds: planIndex.plans.map((plan) => plan.planId),
      completedPlanIds: new Set(summaryIndex.completedPlans),
      selectedPlanId: context.planId
    });
    const livePlanValidation = validateSummaryAgainstLivePlanInventory(renderPreview, {
      resolved: context.phase,
      planId: context.planId,
      plan: context.plan,
      knownPlanIds: new Set(planIndex.plans.map((plan) => plan.planId)),
      completedDependencyPlanIds: new Set(summaryIndex.completedPlans),
      completedRouteValidation: {
        mode: "exact",
        route: completedRoute
      }
    });
    const markdownIssues = [...validation.issues, ...livePlanValidation.issues];
    draftWarnings.push(...validation.warnings, ...livePlanValidation.warnings);

    for (const issue of markdownIssues) {
      diagnostics.push(
        phaseSummaryDiagnostic({
          source: "markdown",
          path: "content",
          code: "markdown.invalid_render",
          message: issue,
          context: {},
          suggestion:
            "Repair the summary so semantic completion evidence is truthful."
        })
      );
    }
  }

  return {
    status: diagnostics.length === 0 ? "valid" : "invalid",
    valid: diagnostics.length === 0,
    phase: context.phase,
    planId: context.planId,
    path: context.path,
    linkedPlanPath: context.linkedPlanPath,
    schemaPath: context.schemaPath,
    taskSchema: context.taskSchema,
    diagnostics,
    diagnosticCounts: countPhaseSummaryDiagnostics(diagnostics),
    normalizedModel,
    renderPreview: diagnostics.length === 0 ? renderPreview : null,
    warnings: hasModel
      ? [
          ...context.warnings,
          ...draftWarnings,
          "phase.summary structured models are deprecated; Markdown content is now the primary summary authoring path."
        ]
      : [...context.warnings, ...draftWarnings]
  };
}

export async function blueprintPhaseSummaryRead(
  args: PhaseSummaryReadArgs
): Promise<PhaseSummaryReadResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate(args);
  const resolved = toResolvedPhaseLocation(located);

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

  const content = await fs.readFile(absolutePath, "utf8");
  const metadata = summarizeMarkdownContent(content);
  const linkedPlanPath = extractSummaryPlanReference(content);
  const strictValidation = validateStrictSummaryArtifactContent(content, {
    linkedPlanPath: planPathFor(resolved, planId),
    requirePlanMarker: true
  });
  const planIndex = await blueprintPhasePlanIndex({
    cwd: projectRoot,
    phase: resolved.phaseNumber
  });
  const summaryIndex = await blueprintPhaseSummaryIndex({
    cwd: projectRoot,
    phase: resolved.phaseNumber
  });
  const knownPlanIds = new Set(planIndex.plans.map((plan) => plan.planId));
  const linkedPlan = planIndex.plans.find((plan) => plan.planId === planId) ?? null;
  const livePlanValidation = validateSummaryAgainstLivePlanInventory(content, {
    resolved,
    planId,
    plan: linkedPlan,
    knownPlanIds,
    completedDependencyPlanIds: new Set(summaryIndex.completedPlans),
    completedRouteValidation: { mode: "indexed" }
  });
  const validation = {
    valid: strictValidation.valid && livePlanValidation.valid,
    issues: [...strictValidation.issues, ...livePlanValidation.issues],
    warnings: [...strictValidation.warnings, ...livePlanValidation.warnings]
  };

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
      linkedPlanPath,
      status: extractSummaryStatus(content),
      title: metadata.title,
      summary: metadata.summary
    },
    validation,
    reason: null
  };
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

  const located = await blueprintPhaseLocate(args);
  const resolved = toResolvedPhaseLocation(located);

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

  const projectRoot = await ensureRepoRoot(args.cwd);
  const requestedWave = args.wave ?? null;
  const gapsOnly = args.gapsOnly ?? false;
  const includeConflicts = args.includeConflicts ?? true;
  const [planIndex, summaryIndex] = await Promise.all([
    blueprintPhasePlanIndex({
      cwd: projectRoot,
      phase: resolved.phaseNumber
    }),
    blueprintPhaseSummaryIndex({
      cwd: projectRoot,
      phase: resolved.phaseNumber
    })
  ]);
  const pendingPlanIds = summaryIndex.pendingPlans;
  const pendingPlanIdSet = new Set(pendingPlanIds);
  const gapClosurePlanIdSet = new Set(planIndex.gapClosurePlans);
  const knownPlanIds = new Set(planIndex.plans.map((plan) => plan.planId));
  const summaryReads = await Promise.all(
    planIndex.plans.map((plan) =>
      blueprintPhaseSummaryRead({
        cwd: projectRoot,
        phase: resolved.phaseNumber,
        planId: plan.planId
      })
    )
  );
  const executionPlans = planIndex.plans.map((plan, index) => {
    const summaryRead = summaryReads[index];
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
  const { projectRoot, resolved } = await resolveLocatedPhaseForMutation(args);
  const planId = normalizePlanId(args.planId);
  const pathValue = summaryPathFor(resolved, planId);
  const plan = await blueprintPhasePlanRead({
    cwd: projectRoot,
    phase: resolved.phaseNumber,
    planId
  });

  if (!plan.found || !plan.path) {
    throw new Error(
      `${plan.path ?? planPathFor(resolved, planId)} does not exist yet. Create the matching plan before writing a summary.`
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

  const planIndex = await blueprintPhasePlanIndex({
    cwd: projectRoot,
    phase: resolved.phaseNumber
  });
  const indexedPlan = planIndex.plans.find((candidate) => candidate.planId === planId) ?? null;
  const knownPlanIds = new Set(planIndex.plans.map((candidate) => candidate.planId));
  const dependsOn = indexedPlan?.dependsOn ?? plan.metadata?.dependsOn ?? [];
  const missingDependencyPlans = collectMissingDependencyPlanPaths(
    dependsOn,
    knownPlanIds,
    resolved
  );

  if (missingDependencyPlans.length > 0) {
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
      issues: [
        `${plan.path}: linked plan is missing dependency plan artifacts: ${missingDependencyPlans.join(", ")}`
      ],
      warnings: plan.validation?.warnings ?? []
    };
  }

  const summaryIndex = await blueprintPhaseSummaryIndex({
    cwd: projectRoot,
    phase: resolved.phaseNumber
  });
  const dependencyPlans = dependencyPlanRowsForPlan(dependsOn, knownPlanIds, resolved);
  const completedDependencyPlanIds = new Set(summaryIndex.completedPlans);
  const unsatisfiedDependencyPlans = dependencyPlans.filter(
    (dependency) => !completedDependencyPlanIds.has(dependency.planId)
  );

  const absolutePath = resolveBlueprintPath(projectRoot, pathValue);
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
      linkedPlanPath: plan.path,
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
    const modelValidation = await blueprintPhaseSummaryValidateModel({
      cwd: projectRoot,
      phase: resolved.phaseNumber,
      planId,
      model: args.model
    });

    if (!modelValidation.valid || !modelValidation.renderPreview) {
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
        issues: modelValidation.diagnostics.map(formatPhaseSummaryDiagnostic),
        warnings: modelValidation.warnings
      };
    }

    normalizedContent = normalizeTextContent(modelValidation.renderPreview);
    modelWarnings.push(...modelValidation.warnings);
  }

  const statusMarker = extractSummaryMarkerValue(normalizedContent, "Status");
  const summaryStatus = extractSummaryStatus(normalizedContent);
  const writeModeIssues: string[] = [];

  if (!statusMarker) {
    writeModeIssues.push("New phase summaries must include an explicit Status marker.");
  } else if (!summaryStatus) {
    writeModeIssues.push("Phase summary Status marker must be COMPLETED, PARTIAL, or BLOCKED.");
  }

  if (summaryStatus === "COMPLETED" && unsatisfiedDependencyPlans.length > 0) {
    writeModeIssues.push(
      `${plan.path}: linked dependency plan summaries are not completed yet: ${unsatisfiedDependencyPlans
        .map((dependency) => `${dependency.planId} (${dependency.path})`)
        .join(", ")}`
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
      linkedPlanPath: plan.path,
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      issues: writeModeIssues,
      warnings: [...modelWarnings, ...(plan.validation?.warnings ?? []), ...summaryIndex.warnings]
    };
  }

  const strictValidation = validateStrictSummaryArtifactContent(normalizedContent, {
    linkedPlanPath: plan.path,
    requirePlanMarker: true
  });
  const completedRoute = completedRouteAfterSelectedCompletion({
    phaseNumber: resolved.phaseNumber,
    planIds: planIndex.plans.map((candidate) => candidate.planId),
    completedPlanIds: completedDependencyPlanIds,
    selectedPlanId: planId
  });
  const livePlanValidation = validateSummaryAgainstLivePlanInventory(normalizedContent, {
    resolved,
    planId,
    plan: indexedPlan,
    knownPlanIds,
    completedDependencyPlanIds,
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
  const exists = await pathExists(absolutePath);

  if (!validation.valid) {
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
      issues,
      warnings: [...modelWarnings, ...warnings]
    };
  }

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
        path: pathValue,
        linkedPlanPath: plan.path,
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
        `${pathValue} already exists. Re-run only after explicit overwrite confirmation.`
      );
    }
  }

  warnings.push(
    ...await writeTextFile(absolutePath, normalizedContent, {
      label: pathValue
    })
  );

  if (exists) {
    warnings.push(`Replaced existing summary artifact: ${pathValue}`);
  }

  return {
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    planId,
    path: pathValue,
    linkedPlanPath: plan.path,
    written: true,
    created: !exists,
    overwritten: exists,
    status: exists ? "updated" : "created",
    issues,
    warnings: [...modelWarnings, ...warnings]
  };
}

export async function blueprintPhaseCheckpointGet(
  args: PhaseCheckpointGetArgs = {}
): Promise<PhaseCheckpointGetResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate(args);
  const resolved = toResolvedPhaseLocation(located);

  if (!resolved) {
    return {
      phaseFound: false,
      found: false,
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName,
      phaseDir: located.phaseDir,
      path: null,
      checkpoint: null,
      ownerCommand: null,
      resumeMode: null,
      safeToResume: false,
      warnings: [],
      reason: located.reason
    };
  }

  const checkpointPath = checkpointPathFor(resolved);
  const absolutePath = resolveBlueprintPath(projectRoot, checkpointPath);

  if (!(await pathExists(absolutePath))) {
    return {
      phaseFound: true,
      found: false,
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      path: checkpointPath,
      checkpoint: null,
      ownerCommand: null,
      resumeMode: null,
      safeToResume: false,
      warnings: [],
      reason: `${checkpointPath} does not exist.`
    };
  }

  const parsed = ensureCheckpointObject(
    safeJsonParseObject(await fs.readFile(absolutePath, "utf8"), {
      label: checkpointPath,
      maxBytes: 256 * 1024
    }),
    checkpointPath
  );
  const resumeSafety = evaluateCheckpointResumeSafety(
    parsed,
    checkpointPath,
    args.expectedOwnerCommand,
    args.expectedMode
  );

  return {
    phaseFound: true,
    found: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    path: checkpointPath,
    checkpoint: parsed,
    ownerCommand: resumeSafety.ownerCommand,
    resumeMode: resumeSafety.resumeMode,
    safeToResume: resumeSafety.safeToResume,
    warnings: resumeSafety.warnings,
    reason: null
  };
}

export async function blueprintPhaseCheckpointPut(
  args: PhaseCheckpointPutArgs
): Promise<PhaseCheckpointPutResult> {
  const { projectRoot, resolved } = await resolveLocatedPhaseForMutation(args);
  const checkpointPath = checkpointPathFor(resolved);
  const absolutePath = resolveBlueprintPath(projectRoot, checkpointPath);
  const nextCheckpoint = ensureCheckpointForPersistence(args.checkpoint, checkpointPath);
  const nextRaw = `${JSON.stringify(nextCheckpoint, null, 2)}\n`;
  const warnings: string[] = [];

  if (await pathExists(absolutePath)) {
    const existingRaw = await fs.readFile(absolutePath, "utf8");

    if (existingRaw === nextRaw) {
      warnings.push(`Preserved existing phase checkpoint because the content was unchanged.`);

      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        path: checkpointPath,
        updated: false,
        warnings
      };
    }

    const existingCheckpoint = ensureCheckpointObject(
      safeJsonParseObject(existingRaw, {
        label: checkpointPath,
        maxBytes: 256 * 1024
      }),
      checkpointPath
    );
    const ownershipSafety = evaluateCheckpointResumeSafety(
      existingCheckpoint,
      checkpointPath,
      args.checkpoint.ownerCommand,
      args.checkpoint.resumeMeta.mode
    );

    if (!ownershipSafety.safeToResume) {
      throw new Error(
        checkpointOwnershipBlockerReason(
          checkpointPath,
          ownershipSafety.warnings,
          "overwrite"
        )
      );
    }

    warnings.push(...ownershipSafety.warnings);
  }

  await writeJsonFile(absolutePath, nextCheckpoint);

  return {
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    path: checkpointPath,
    updated: true,
    warnings
  };
}

export async function blueprintPhaseCheckpointDelete(
  args: PhaseCheckpointDeleteArgs = {}
): Promise<PhaseCheckpointDeleteResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate(args);
  const resolved = toResolvedPhaseLocation(located);

  if (!resolved) {
    return {
      phaseFound: false,
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName,
      phaseDir: located.phaseDir,
      path: null,
      deleted: false,
      reason: located.reason
    };
  }

  const checkpointPath = checkpointPathFor(resolved);
  const absolutePath = resolveBlueprintPath(projectRoot, checkpointPath);

  if (!(await pathExists(absolutePath))) {
    return {
      phaseFound: true,
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      path: checkpointPath,
      deleted: false,
      reason: `${checkpointPath} did not exist.`
    };
  }

  const parsed = ensureCheckpointObject(
    safeJsonParseObject(await fs.readFile(absolutePath, "utf8"), {
      label: checkpointPath,
      maxBytes: 256 * 1024
    }),
    checkpointPath
  );

  if (!args.expectedOwnerCommand && !args.expectedMode) {
    return {
      phaseFound: true,
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      path: checkpointPath,
      deleted: false,
      reason: `Refusing to delete ${checkpointPath} without expectedOwnerCommand or expectedMode; shared checkpoint deletes must provide an ownership guard.`
    };
  }

  if (args.expectedOwnerCommand || args.expectedMode) {
    const expectedOwnerCommand =
      args.expectedOwnerCommand ?? checkpointExpectedOwnerFromMode(args.expectedMode ?? null);
    const expectedMode =
      args.expectedMode ??
      (expectedOwnerCommand ? PHASE_CHECKPOINT_OWNER_MODES[expectedOwnerCommand] : undefined);
    const ownershipSafety = evaluateCheckpointResumeSafety(
      parsed,
      checkpointPath,
      expectedOwnerCommand ?? undefined,
      expectedMode
    );

    if (!ownershipSafety.safeToResume) {
      return {
        phaseFound: true,
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        path: checkpointPath,
        deleted: false,
        reason: checkpointOwnershipBlockerReason(
          checkpointPath,
          ownershipSafety.warnings,
          "delete"
        )
      };
    }
  }

  await fs.rm(absolutePath, { force: true });

  return {
    phaseFound: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    path: checkpointPath,
    deleted: true,
    reason: null
  };
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
      "Append a new integer phase to the active Blueprint roadmap, ignoring decimal insertions when choosing the next phase number.",
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
      "Read a phase-scoped discovery artifact such as CONTEXT, DISCUSSION-LOG, RESEARCH, or UI-SPEC.",
    inputSchema: phaseArtifactInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseArtifactRead(args as PhaseArtifactReadArgs)
  },
  {
    name: "blueprint_phase_artifact_write",
    description:
      "Persist substantive phase-scoped discovery artifacts with overwrite protection; phase.context is model-only and rendered by MCP.",
    inputSchema: phaseArtifactWriteInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseArtifactWrite(args as PhaseArtifactWriteArgs)
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
