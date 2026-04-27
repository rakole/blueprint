import { promises as fs } from "node:fs";
import path from "node:path";

import * as z from "zod/v4";

import {
  CODEBASE_ARTIFACTS,
  BLUEPRINT_BACKLOG_INDEX_PATH,
  BLUEPRINT_DIR,
  BLUEPRINT_PHASES_PATH,
  DURABLE_REQUIREMENT_ID_PATTERN,
  ensureParentDirectory,
  ensureRepoRoot,
  inspectBlueprintArtifacts,
  extractMarkdownTableRows,
  isVerificationArtifactReadyForUat,
  parseCaptureIndexDocument,
  validatePhaseArtifactContent,
  validatePlanArtifactContent,
  validateResearchArtifactContent,
  extractSummaryPlanReference,
  extractSummaryStatus,
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
  formatBlueprintPhasePrefix,
  normalizeBlueprintPhaseRef,
  normalizeNumericArtifactId,
  prepareTextForPersistence,
  safeJsonParseObject
} from "../../shared/security.js";

type RoadmapReadArgs = {
  cwd?: string;
};

type NumericInput = string | number;

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
  content: string;
  overwrite?: boolean;
  validationMode?: "strict" | "warn";
};

type PhaseValidationReadArgs = PhaseLookupArgs & {
  artifact: PhaseValidationArtifactKind;
};

type PhaseValidationWriteArgs = PhaseLookupArgs & {
  artifact: PhaseValidationArtifactKind;
  content: string;
  overwrite?: boolean;
};

type PhaseCheckpointRecord = Record<string, unknown>;

type PhaseCheckpointDecisionRecord = {
  topic: string;
  decision: string;
  rationale?: string;
};

type PhaseCheckpointDeferredIdeaRecord = {
  idea: string;
  reason?: string;
  revisitWhen?: string;
};

type PhaseCheckpointReferenceRecord = {
  label: string;
  target: string;
  note?: string;
};

type PhaseCheckpointOwnerCommand =
  | "/blu-discuss-phase"
  | "/blu-research-phase";

type PhaseCheckpointResumeMode = "discuss" | "research";

type PhaseCheckpointResumeMetaRecord = {
  mode: PhaseCheckpointResumeMode;
  pendingTopics: string[];
  completedTopics: string[];
  currentQuestion?: string;
  notes: string[];
  resumeHint?: string;
  updatedAt: string;
};

type PhaseCheckpointWriteRecord = PhaseCheckpointRecord & {
  ownerCommand: PhaseCheckpointOwnerCommand;
  completedAreas: string[];
  remainingAreas: string[];
  decisions: PhaseCheckpointDecisionRecord[];
  deferredIdeas: PhaseCheckpointDeferredIdeaRecord[];
  canonicalReferences: PhaseCheckpointReferenceRecord[];
  resumeMeta: PhaseCheckpointResumeMetaRecord;
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
  content: string;
  overwrite?: boolean;
  validationMode?: "strict" | "warn";
};

type PhaseSummaryReadArgs = PhaseLookupArgs & {
  planId: NumericInput;
};

type PhaseSummaryWriteArgs = PhaseLookupArgs & {
  planId: NumericInput;
  content: string;
  overwrite?: boolean;
};

type ResolvedPhaseLocation = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  phaseDir: string;
};

type ParsedRoadmapPhase = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  completed: boolean;
  summary: string | null;
  goal: string | null;
  successCriteria: string | null;
  requirements: string[];
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
  researchValid: boolean | null;
  researchIssues: string[];
  uiSpecValid: boolean | null;
  uiSpecIssues: string[];
  suggestedRepairs: string[];
  warnings: string[];
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
  } | null;
  warnings: string[];
};

const SCAFFOLD_GENERATED_MARKER = "*Generated by `blueprint_artifact_scaffold`*";

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
  warnings: string[];
};

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
const PHASE_CHECKPOINT_OWNER_COMMANDS = [
  "/blu-discuss-phase",
  "/blu-research-phase"
] as const;
const PHASE_CHECKPOINT_RESUME_MODES = ["discuss", "research"] as const;
const PHASE_CHECKPOINT_OWNER_MODES: Record<
  PhaseCheckpointOwnerCommand,
  PhaseCheckpointResumeMode
> = {
  "/blu-discuss-phase": "discuss",
  "/blu-research-phase": "research"
};

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
  content: z.string(),
  overwrite: z.boolean().optional(),
  validationMode: z.enum(["strict", "warn"]).optional()
};
const phaseValidationWriteInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum(["verification", "uat"]),
  content: z.string(),
  overwrite: z.boolean().optional()
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
const phasePlanWriteInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema.optional(),
  content: z.string(),
  overwrite: z.boolean().optional(),
  validationMode: z.enum(["strict", "warn"]).optional()
};
const phaseSummaryReadInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema
};
const phaseSummaryWriteInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema,
  content: z.string(),
  overwrite: z.boolean().optional()
};

const phaseCheckpointDecisionSchema = z
  .object({
    topic: z.string().min(1),
    decision: z.string().min(1),
    rationale: z.string().min(1).optional()
  })
  .catchall(z.unknown());

const phaseCheckpointDeferredIdeaSchema = z
  .object({
    idea: z.string().min(1),
    reason: z.string().min(1).optional(),
    revisitWhen: z.string().min(1).optional()
  })
  .catchall(z.unknown());

const phaseCheckpointReferenceSchema = z
  .object({
    label: z.string().min(1),
    target: z.string().min(1),
    note: z.string().min(1).optional()
  })
  .catchall(z.unknown());

const phaseCheckpointOwnerCommandSchema = z.enum(PHASE_CHECKPOINT_OWNER_COMMANDS);
const phaseCheckpointResumeModeSchema = z.enum(PHASE_CHECKPOINT_RESUME_MODES);

const phaseCheckpointResumeMetaSchema = z
  .object({
    mode: phaseCheckpointResumeModeSchema,
    pendingTopics: z.array(z.string().min(1)),
    completedTopics: z.array(z.string().min(1)),
    currentQuestion: z.string().min(1).optional(),
    notes: z.array(z.string().min(1)),
    resumeHint: z.string().min(1).optional(),
    updatedAt: z.string().min(1)
  })
  .catchall(z.unknown());

const phaseCheckpointWriteSchema = z
  .object({
    ownerCommand: phaseCheckpointOwnerCommandSchema,
    completedAreas: z.array(z.string().min(1)),
    remainingAreas: z.array(z.string().min(1)),
    decisions: z.array(phaseCheckpointDecisionSchema),
    deferredIdeas: z.array(phaseCheckpointDeferredIdeaSchema),
    canonicalReferences: z.array(phaseCheckpointReferenceSchema),
    resumeMeta: phaseCheckpointResumeMetaSchema
  })
  .catchall(z.unknown())
  .superRefine((value, context) => {
    const requiredSections = [
      "ownerCommand",
      "completedAreas",
      "remainingAreas",
      "decisions",
      "deferredIdeas",
      "canonicalReferences",
      "resumeMeta"
    ];

    if (!requiredSections.every((key) => key in value)) {
      context.addIssue({
        code: "custom",
        message:
          "Checkpoint writes must include ownerCommand, completedAreas, remainingAreas, decisions, deferredIdeas, canonicalReferences, and resumeMeta."
      });
    }

    const expectedMode = PHASE_CHECKPOINT_OWNER_MODES[value.ownerCommand];
    if (expectedMode && value.resumeMeta.mode !== expectedMode) {
      context.addIssue({
        code: "custom",
        path: ["resumeMeta", "mode"],
        message: `${value.ownerCommand} checkpoints must use resumeMeta.mode "${expectedMode}".`
      });
    }
  });

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

function normalizeBlueprintInput(value: NumericInput): string {
  return typeof value === "number" ? String(value) : value;
}

function normalizePhaseNumber(value: NumericInput): string {
  return normalizeBlueprintPhaseRef(normalizeBlueprintInput(value));
}

function basePhaseNumber(value: NumericInput): string {
  return normalizePhaseNumber(value).split(".")[0] ?? normalizePhaseNumber(value);
}

function comparePhaseNumbers(left: NumericInput, right: NumericInput): number {
  const leftParts = normalizePhaseNumber(left)
    .split(".")
    .map((segment) => Number.parseInt(segment, 10));
  const rightParts = normalizePhaseNumber(right)
    .split(".")
    .map((segment) => Number.parseInt(segment, 10));
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return 0;
}

function formatPhasePrefix(value: NumericInput): string {
  return formatBlueprintPhasePrefix(normalizeBlueprintInput(value));
}

function extractPhaseNumberToken(value: NumericInput): string | null {
  const match = normalizeBlueprintInput(value).trim().match(/(\d+(?:\.\d+)?)/);
  return match ? normalizePhaseNumber(match[1]) : null;
}

function extractExactPhaseNumberToken(value: NumericInput): string | null {
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : null;
  }

  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  return normalizePhaseNumber(trimmed);
}

function isIntegerPhaseNumber(value: NumericInput): boolean {
  return !normalizePhaseNumber(value).includes(".");
}

function slugToTitle(value: string): string {
  return value
    .split("-")
    .filter((segment) => segment.length > 0)
    .map((segment) => `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`)
    .join(" ");
}

function parseRequirements(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(
      (entry) =>
        entry.length > 0 &&
        !["none", "none yet", "n/a", "not yet mapped"].includes(entry.toLowerCase())
    );
}

function parseRoadmapDocument(raw: string): {
  milestone: string | null;
  phases: ParsedRoadmapPhase[];
} {
  const milestone = raw.match(/- Active milestone:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const details = new Map<
    string,
    {
      goal: string | null;
      successCriteria: string | null;
      requirements: string[];
    }
  >();

  for (const block of raw.split(/^### Phase /gm).slice(1)) {
    const newlineIndex = block.indexOf("\n");
    const header = newlineIndex === -1 ? block.trim() : block.slice(0, newlineIndex).trim();
    const body = newlineIndex === -1 ? "" : block.slice(newlineIndex + 1);
    const headerMatch = header.match(/^(\d+(?:\.\d+)?): (.+)$/);

    if (!headerMatch) {
      continue;
    }

    const phaseNumber = normalizePhaseNumber(headerMatch[1]);
    const goal = body.match(/^\*\*Goal\*\*:\s*(.+)$/m)?.[1]?.trim() ?? null;
    const successCriteria =
      body.match(/^\*\*Success Criteria\*\*:\s*(.+)$/m)?.[1]?.trim() ?? null;
    const requirements = parseRequirements(
      body.match(/^\*\*Requirements\*\*:\s*(.+)$/m)?.[1] ?? null
    );

    details.set(phaseNumber, { goal, successCriteria, requirements });
  }

  const phases: ParsedRoadmapPhase[] = [];

  for (const match of raw.matchAll(
    /^- \[([ xX])\] (?:\*\*)?Phase (\d+(?:\.\d+)?): ([^\n*]+?)(?:\*\*)?(?: - (.+))?$/gm
  )) {
    const phaseNumber = normalizePhaseNumber(match[2]);
    const phaseName = match[3].trim();
    const detail = details.get(phaseNumber);

    phases.push({
      phaseNumber,
      phasePrefix: formatPhasePrefix(phaseNumber),
      phaseName,
      completed: match[1].toLowerCase() === "x",
      summary: match[4]?.trim() ?? null,
      goal: detail?.goal ?? null,
      successCriteria: detail?.successCriteria ?? null,
      requirements: detail?.requirements ?? []
    });
  }

  return { milestone, phases };
}

function normalizePhaseDescription(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ");
}

function slugifyPhaseName(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .toLowerCase()
    .replace(/[_\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : "new-phase";
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
      `Malformed ${BLUEPRINT_DIR}/ROADMAP.md: missing a usable "## Phases" section.`
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
      `Malformed ${BLUEPRINT_DIR}/ROADMAP.md: missing a usable "## Phases" section.`
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
      `Phase ${insertAfterPhaseNumber} could not be located in the roadmap phases list.`
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

function buildPhaseDetailBlock(options: PhaseDetailBlockOptions): string {
  const goal =
    options.goal?.trim() || "Capture the phase boundary and implementation goal during /blu-discuss-phase.";
  const requirements = normalizeRoadmapDetailList(options.requirements);
  const successCriteria =
    options.successCriteria?.trim() ||
    "Persist context, planning, execution, validation, and UAT evidence for this phase.";
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
      `Malformed ${BLUEPRINT_DIR}/ROADMAP.md: missing a usable "## Phase Details" section.`
    );
  }

  const phaseGroupSet = new Set(phaseGroupNumbers.map((value) => normalizePhaseNumber(value)));
  let inserted = false;
  const content = raw.replace(
    phaseDetailsSectionPattern,
    (_full, header: string, body: string) => {
      const blocks = [...body.matchAll(/(^### Phase [\s\S]*?)(?=^### Phase |\s*$)/gm)].map(
        (match) => match[1].trimEnd()
      );

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
          `Phase ${dependsOnPhaseNumber} is missing a matching entry under the roadmap's "## Phase Details" section. Resolve roadmap drift before inserting a decimal phase.`
        );
      }

      blocks.splice(insertIndex, 0, detailBlock);
      inserted = true;

      return `${header}${blocks.join("\n\n")}\n`;
    }
  );

  if (!inserted) {
    throw new Error(
      `Phase ${phaseNumber} could not be inserted into the roadmap's "## Phase Details" section.`
    );
  }

  return content;
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
      const blocks = [...body.matchAll(/(^### Phase [\s\S]*?)(?=^### Phase |\s*$)/gm)].map(
        (match) => match[1].trimEnd()
      );
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
      const blocks = [...body.matchAll(/(^### Phase [\s\S]*?)(?=^### Phase |\s*$)/gm)].map(
        (match) => match[1].trimEnd()
      );
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
  const { summaryPaths, warnings: summaryWarnings } = await collectValidatedSummaryPaths(
    projectRoot,
    completedSummaryRecords(summaryIndex.summaries)
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
        : validateUatArtifactContent(content, summaryPaths);

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

  const completed =
    summaryIndex.pendingPlans.length === 0 &&
    summaryPaths.length > 0 &&
    hasValidVerification &&
    verificationReadyForUat &&
    hasCompleteUat;
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
): Promise<{
  path: string;
  milestone: string | null;
  phases: ParsedRoadmapPhase[];
}> {
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

function summarizeSavedArtifact(raw: string): { title: string; summary: string } {
  const normalizedLines = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim());
  const withoutFrontmatter = [...normalizedLines];

  if (withoutFrontmatter[0] === "---") {
    withoutFrontmatter.shift();

    while (withoutFrontmatter.length > 0 && withoutFrontmatter[0] !== "---") {
      withoutFrontmatter.shift();
    }

    if (withoutFrontmatter[0] === "---") {
      withoutFrontmatter.shift();
    }
  }

  const meaningfulLines = withoutFrontmatter.filter(
    (line) => line.length > 0 && !line.startsWith("*Generated by")
  );
  const heading = meaningfulLines.find((line) => line.startsWith("#"));
  const bodyLine = meaningfulLines.find((line) => !line.startsWith("#"));

  return {
    title: heading?.replace(/^#+\s*/, "").trim() ?? "Artifact Summary",
    summary: bodyLine ?? "Artifact content is present and available for review."
  };
}

function extractMarkdownSection(markdown: string, heading: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(
    new RegExp(`(?:^|\\n)## ${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`)
  );

  return match?.[1]?.trim() ?? "";
}

function extractMarkdownHeading(markdown: string): string | null {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
}

function normalizeMarkdownListItems(section: string): string[] {
  return section
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^[-*+]\s+/, "").trim())
    .filter((line) => line.length > 0);
}

function sectionToList(section: string): string[] {
  const lines = normalizeMarkdownListItems(section);
  const bulletLines = lines.filter((line) => !/^[A-Za-z0-9_.-]+\s*:\s*/.test(line));

  return bulletLines.length > 0 ? bulletLines : lines;
}

function extractRequirementIdsFromRequirementsTable(section: string): string[] {
  return extractMarkdownTableRows(section)
    .map((row) => row[0]?.trim() ?? "")
    .filter((id) => DURABLE_REQUIREMENT_ID_PATTERN.test(id));
}

function summarizeContextPieces(pieces: string[], emptyMessage: string): string {
  const meaningfulPieces = pieces
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0);

  return meaningfulPieces.length > 0 ? meaningfulPieces.join(" | ") : emptyMessage;
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
      warnings: [],
      unreadable: false
    };
  }

  const absolutePath = resolveBlueprintPath(projectRoot, artifactPath);

  try {
    const raw = await fs.readFile(absolutePath, "utf8");
    const validation = validatePhaseArtifactContent(raw, artifact);

    return {
      present: true,
      valid: validation.valid,
      usable: validation.valid,
      issues: validation.issues,
      warnings: validation.warnings,
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
      warnings: [`${artifactPath} is stale, deleted, or unreadable: ${reason}.`],
      unreadable: true
    };
  }
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

function normalizePlanId(value: NumericInput): string {
  const normalizedInput = normalizeBlueprintInput(value).trim();

  if (/^0+$/.test(normalizedInput)) {
    throw new Error("Plan id must be greater than zero.");
  }

  return normalizeNumericArtifactId(normalizedInput, "Plan id");
}

function parsePlanArtifactPath(
  pathValue: string,
  phasePrefix: string
): string | null {
  const match = pathValue.match(
    new RegExp(`${phasePrefix.replace(".", "\\.")}-(\\d+)-PLAN\\.md$`)
  );

  return match ? normalizePlanId(match[1]) : null;
}

function planPathFor(
  located: Pick<ResolvedPhaseLocation, "phaseDir" | "phasePrefix">,
  planId: string
): string {
  return buildArtifactPath(located.phaseDir, located.phasePrefix, `-${normalizePlanId(planId)}-PLAN.md`);
}

function replacePlanSlotLabel(
  value: string,
  fromPlanId: string | null,
  toPlanId: string
): string {
  const candidates = new Set<string>(["YY"]);

  if (fromPlanId) {
    candidates.add(fromPlanId);
  }

  let updated = value;

  for (const candidate of candidates) {
    updated = updated.replace(
      new RegExp(`\\bPlan\\s+${escapeForRegex(candidate)}\\b`, "g"),
      `Plan ${toPlanId}`
    );
  }

  return updated;
}

function extractPlanIdFromFrontmatterLine(line: string): string | null {
  const match = line.match(/^plan_id:\s*(?:"([^"]+)"|'([^']+)'|([^\s#]+))\s*$/);
  const rawValue = match?.[1] ?? match?.[2] ?? match?.[3] ?? null;

  if (!rawValue) {
    return null;
  }

  try {
    return normalizePlanId(rawValue);
  } catch {
    return null;
  }
}

function extractPlanSlotLabelFromFrontmatterLine(line: string): string | null {
  const match = line.match(/^plan_id:\s*(?:"([^"]+)"|'([^']+)'|([^\s#]+))\s*$/);
  const rawValue = match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
  const trimmed = rawValue?.trim() ?? "";

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  if (/^0+$/.test(trimmed)) {
    return trimmed.padStart(2, "0");
  }

  return normalizePlanId(trimmed);
}

function reconcilePlanTitleLine(
  line: string,
  fromPlanId: string | null,
  toPlanId: string
): string | null {
  const match = line.match(/^(\s*title:\s*)(.+)$/);

  if (!match) {
    return null;
  }

  const prefix = match[1] ?? "";
  const rawValue = match[2]?.trim() ?? "";
  const quoteMatch = rawValue.match(/^(['"])([\s\S]*?)\1$/);
  const quote = quoteMatch?.[1] ?? "";
  const value = quoteMatch?.[2] ?? rawValue;
  const updatedValue = replacePlanSlotLabel(value, fromPlanId, toPlanId);

  if (updatedValue === value) {
    return null;
  }

  return `${prefix}${quote}${updatedValue}${quote}`;
}

function reconcilePlanHeadingLine(
  line: string,
  fromPlanId: string | null,
  toPlanId: string
): string | null {
  if (!/^#\s+/.test(line)) {
    return null;
  }

  const updatedLine = replacePlanSlotLabel(line, fromPlanId, toPlanId);

  return updatedLine === line ? null : updatedLine;
}

function reconcileAutoAssignedPlanContent(content: string, planId: string): string {
  const normalizedPlanId = normalizePlanId(planId);
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---(\n|$)/);

  if (!frontmatterMatch || frontmatterMatch.index === undefined) {
    return content;
  }

  const frontmatter = frontmatterMatch[1] ?? "";
  const updatedFrontmatterLines = frontmatter.split("\n");
  const sourcePlanId = updatedFrontmatterLines
    .map((line) => extractPlanSlotLabelFromFrontmatterLine(line))
    .find((value): value is string => value !== null)
    ?? null;
  const planIdLineIndex = updatedFrontmatterLines.findIndex((line) => /^plan_id:\s*/.test(line));

  if (planIdLineIndex >= 0) {
    updatedFrontmatterLines[planIdLineIndex] = `plan_id: "${normalizedPlanId}"`;
  } else {
    const phaseLineIndex = updatedFrontmatterLines.findIndex((line) => /^phase:\s*/.test(line));

    if (phaseLineIndex >= 0) {
      updatedFrontmatterLines.splice(phaseLineIndex + 1, 0, `plan_id: "${normalizedPlanId}"`);
    } else {
      updatedFrontmatterLines.unshift(`plan_id: "${normalizedPlanId}"`);
    }
  }

  const titleLineIndex = updatedFrontmatterLines.findIndex((line) => /^title:\s*/.test(line));

  if (titleLineIndex >= 0) {
    const updatedTitleLine = reconcilePlanTitleLine(
      updatedFrontmatterLines[titleLineIndex] ?? "",
      sourcePlanId,
      normalizedPlanId
    );

    if (updatedTitleLine) {
      updatedFrontmatterLines[titleLineIndex] = updatedTitleLine;
    }
  }

  const contentStart = frontmatterMatch.index;
  const contentAfterFrontmatter = content.slice(contentStart + frontmatterMatch[0].length);
  const reconciledBody =
    (() => {
      let headingRewritten = false;

      return contentAfterFrontmatter
        .split("\n")
        .map((line) => {
          if (headingRewritten || !/^#\s+/.test(line)) {
            return line;
          }

          headingRewritten = true;
          return reconcilePlanHeadingLine(line, sourcePlanId, normalizedPlanId) ?? line;
        })
        .join("\n");
    })();

  return `---\n${updatedFrontmatterLines.join("\n")}\n---${reconciledBody}`;
}

function collectInvalidPlanDependencyIssues(planPath: string, dependsOn: string[]): string[] {
  const issues: string[] = [];

  for (const dependency of dependsOn) {
    try {
      normalizePlanId(dependency);
    } catch {
      issues.push(`${planPath}: invalid depends_on reference: ${dependency}`);
    }
  }

  return issues;
}

function normalizeMaybePlanId(value: string | null): string | null {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  return normalizePlanId(value);
}

function extractHeadingText(content: string): string | null {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
}

function extractReferencedPlanId(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const placeholderMatch = value.match(/\bPlan\s+(YY)\b/i);

  if (placeholderMatch) {
    return placeholderMatch[1].toUpperCase();
  }

  const numericMatch = value.match(/\bPlan\s+(\d+)\b/i);

  if (!numericMatch) {
    return null;
  }

  try {
    return normalizePlanId(numericMatch[1]);
  } catch {
    return null;
  }
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

function completedSummaryRecords(summaries: PhaseSummaryRecord[]): PhaseSummaryRecord[] {
  return summaries.filter((summary) => summary.status === "COMPLETED");
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

function ensureCheckpointObject(
  checkpoint: unknown,
  checkpointPath: string
): PhaseCheckpointRecord {
  if (typeof checkpoint !== "object" || checkpoint === null || Array.isArray(checkpoint)) {
    throw new Error(`${checkpointPath} must contain a JSON object.`);
  }

  return checkpoint as PhaseCheckpointRecord;
}

function ensureCheckpointForPersistence(
  checkpoint: unknown,
  checkpointPath: string
): PhaseCheckpointWriteRecord {
  const parsed = phaseCheckpointWriteSchema.safeParse(
    ensureCheckpointObject(checkpoint, checkpointPath)
  );

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new Error(`${checkpointPath} must contain a structured discuss checkpoint. ${issues}`);
  }

  return parsed.data as PhaseCheckpointWriteRecord;
}

function checkpointStringField(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function checkpointResumeMeta(record: Record<string, unknown>): Record<string, unknown> | null {
  const resumeMeta = record.resumeMeta;
  if (typeof resumeMeta !== "object" || resumeMeta === null || Array.isArray(resumeMeta)) {
    return null;
  }

  return resumeMeta as Record<string, unknown>;
}

function checkpointOwnerCommand(record: Record<string, unknown>): string | null {
  return checkpointStringField(record, "ownerCommand");
}

function checkpointResumeMode(record: Record<string, unknown>): string | null {
  return (
    checkpointStringField(checkpointResumeMeta(record) ?? {}, "mode") ??
    checkpointStringField(record, "mode")
  );
}

function isScaffoldGeneratedPhaseArtifact(content: string): boolean {
  return content.includes(SCAFFOLD_GENERATED_MARKER);
}

function isKnownCheckpointOwnerCommand(value: string | null): value is PhaseCheckpointOwnerCommand {
  return value !== null && PHASE_CHECKPOINT_OWNER_COMMANDS.includes(value as PhaseCheckpointOwnerCommand);
}

function isKnownCheckpointResumeMode(value: string | null): value is PhaseCheckpointResumeMode {
  return value !== null && PHASE_CHECKPOINT_RESUME_MODES.includes(value as PhaseCheckpointResumeMode);
}

function checkpointExpectedOwnerFromMode(
  value: string | null
): PhaseCheckpointOwnerCommand | null {
  switch (value) {
    case "discuss":
      return "/blu-discuss-phase";
    case "research":
      return "/blu-research-phase";
    default:
      return null;
  }
}

function checkpointOwnershipBlockerReason(
  checkpointPath: string,
  warnings: string[],
  action: "overwrite" | "delete"
): string {
  const details = warnings.join(" ");

  return `Refusing to ${action} ${checkpointPath} because ${details}`;
}

function evaluateCheckpointResumeSafety(
  checkpoint: Record<string, unknown>,
  checkpointPath: string,
  expectedOwnerCommand?: PhaseCheckpointOwnerCommand,
  expectedMode?: PhaseCheckpointResumeMode
): Pick<PhaseCheckpointGetResult, "ownerCommand" | "resumeMode" | "safeToResume" | "warnings"> {
  const ownerCommand = checkpointOwnerCommand(checkpoint);
  const resumeMode = checkpointResumeMode(checkpoint);
  const warnings: string[] = [];

  if (!ownerCommand) {
    warnings.push(
      `${checkpointPath} does not declare ownerCommand; treating it as a legacy checkpoint.`
    );
  } else if (!isKnownCheckpointOwnerCommand(ownerCommand)) {
    warnings.push(`${checkpointPath} declares unknown ownerCommand "${ownerCommand}".`);
  }

  if (!resumeMode) {
    warnings.push(`${checkpointPath} does not declare a resumable mode.`);
  } else if (!isKnownCheckpointResumeMode(resumeMode)) {
    warnings.push(`${checkpointPath} declares unknown resumeMeta.mode "${resumeMode}".`);
  }

  if (
    isKnownCheckpointOwnerCommand(ownerCommand) &&
    isKnownCheckpointResumeMode(resumeMode) &&
    PHASE_CHECKPOINT_OWNER_MODES[ownerCommand] !== resumeMode
  ) {
    warnings.push(
      `${checkpointPath} ownerCommand "${ownerCommand}" does not match resumeMeta.mode "${resumeMode}".`
    );
  }

  if (expectedOwnerCommand && ownerCommand && ownerCommand !== expectedOwnerCommand) {
    warnings.push(
      `${checkpointPath} belongs to ${ownerCommand}, not ${expectedOwnerCommand}; do not resume it for this command.`
    );
  }

  if (expectedMode && resumeMode && resumeMode !== expectedMode) {
    warnings.push(
      `${checkpointPath} has resumeMeta.mode "${resumeMode}", not "${expectedMode}"; do not resume it for this command.`
    );
  }

  const hasForeignOwner = Boolean(expectedOwnerCommand && ownerCommand && ownerCommand !== expectedOwnerCommand);
  const hasForeignMode = Boolean(expectedMode && resumeMode && resumeMode !== expectedMode);
  const hasUnknownOwner = Boolean(ownerCommand && !isKnownCheckpointOwnerCommand(ownerCommand));
  const hasUnknownMode = Boolean(resumeMode && !isKnownCheckpointResumeMode(resumeMode));
  const missingExpectedMode = Boolean(expectedMode && !resumeMode);
  const ownerModeMismatch = Boolean(
    isKnownCheckpointOwnerCommand(ownerCommand) &&
      isKnownCheckpointResumeMode(resumeMode) &&
      PHASE_CHECKPOINT_OWNER_MODES[ownerCommand] !== resumeMode
  );

  return {
    ownerCommand,
    resumeMode,
    safeToResume:
      !hasForeignOwner &&
      !hasForeignMode &&
      !hasUnknownOwner &&
      !hasUnknownMode &&
      !missingExpectedMode &&
      !ownerModeMismatch,
    warnings
  };
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
    const phaseDir = `${BLUEPRINT_PHASES_PATH}/${phasePrefix}-${slug}`;
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
    const phaseDirPath = resolveBlueprintPath(projectRoot, phaseDir);

    warnings.push(
      ...await writeTextFile(roadmapPath, updatedRoadmap, {
        label: roadmap.path
      })
    );

    if (requirementRepair) {
      warnings.push(...requirementRepair.warnings);
      warnings.push(
        ...await writeTextFile(
          resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/REQUIREMENTS.md`),
          requirementRepair.content,
          {
            label: `${BLUEPRINT_DIR}/REQUIREMENTS.md`
          }
        )
      );
    }

    if (await pathExists(phaseDirPath)) {
      warnings.push(`Phase directory already exists and can be reused: ${phaseDir}`);
    } else {
      await fs.mkdir(phaseDirPath, { recursive: true });
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
  const roadmap = await readRoadmap(projectRoot);
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
  const phaseDir = `${BLUEPRINT_PHASES_PATH}/${phasePrefix}-${slug}`;
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
  const phaseDirPath = resolveBlueprintPath(projectRoot, phaseDir);
  const warnings: string[] = [];

  warnings.push(
    ...await writeTextFile(roadmapPath, updatedRoadmap, {
      label: roadmap.path
    })
  );

  if (existingDecimalDirectory.phaseDir === phaseDir || (await pathExists(phaseDirPath))) {
    warnings.push(`Phase directory already exists and can be reused: ${phaseDir}`);
  } else {
    await fs.mkdir(phaseDirPath, { recursive: true });
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
  const desiredPhaseDir = `${BLUEPRINT_PHASES_PATH}/${phasePrefix}-${slugifyPhaseName(phaseName)}`;
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
  let researchUnreadable = false;
  const warnings = [...context.warnings, ...contextStatus.warnings, ...uiSpecStatus.warnings];

  if (researchPath) {
    const absolutePath = resolveBlueprintPath(projectRoot, researchPath);
    try {
      const raw = await fs.readFile(absolutePath, "utf8");
      const validation = validateResearchArtifactContent(raw);

      researchValid = validation.valid;
      researchIssues = validation.issues;
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
      warnings.push(
        `Research artifact at ${researchPath} is stale, deleted, or unreadable: ${reason}.`
      );
    }
  }

  const suggestedRepairs: string[] = [];

  if (contextStatus.issues.length > 0) {
    suggestedRepairs.push(
      contextStatus.unreadable
        ? `Restore or regenerate ${artifacts?.context} with /blu-discuss-phase before planning.`
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
    researchValid,
    researchIssues,
    uiSpecValid: uiSpecStatus.valid,
    uiSpecIssues: uiSpecStatus.issues,
    suggestedRepairs,
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

export async function blueprintPhaseArtifactWrite(
  args: PhaseArtifactWriteArgs
): Promise<PhaseArtifactWriteResult> {
  const { projectRoot, resolved } = await resolveLocatedPhaseForMutation(args);
  const artifactPath = artifactPathFor(resolved, args.artifact);
  const absolutePath = resolveBlueprintPath(projectRoot, artifactPath);
  const normalizedContent = normalizeTextContent(args.content);
  const exists = await pathExists(absolutePath);
  const warnings: string[] = [];
  const validation = validatePhaseArtifactContent(normalizedContent, args.artifact);

  if (exists) {
    const existingContent = await fs.readFile(absolutePath, "utf8");
    const existingValidation = validatePhaseArtifactContent(existingContent, args.artifact);

    if (existingContent === normalizedContent) {
      if (!validation.valid) {
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
          status: "invalid",
          validation: {
            valid: false,
            issues: validation.issues,
            warnings: validation.warnings,
            suggestedRepairs: []
          },
          warnings: [...warnings, ...validation.warnings]
        };
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
    const suggestedRepairs =
      args.artifact === "research"
        ? ["Add the required research sections, confidence marker, and at least one cited source before retrying."]
        : args.artifact === "ui-spec"
          ? [
              "Add a populated Outcome Mode section plus either the contract headings or an explicit skip Rationale before retrying."
            ]
          : [
              `Add a real ${args.artifact} artifact title, remove scaffold placeholders, and populate at least one contract section before retrying.`
            ];

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
      status: "invalid",
      validation: {
        valid: false,
        issues: validation.issues,
        warnings: validation.warnings,
        suggestedRepairs
      },
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
  const completedSummaryPlanIds = new Set(
    completedSummaryRecords(summaryIndex.summaries).map((summary) => summary.planId)
  );
  const summaryPaths = collectReferencedValidatedSummaryPaths(
    content,
    summaryIndex.summaries,
    completedSummaryPlanIds
  );
  const validation =
    args.artifact === "verification"
      ? validateVerificationArtifactContent(content, summaryPaths)
      : validateUatArtifactContent(content, summaryPaths);
  const uatState = args.artifact === "uat" ? readUatArtifactState(content) : null;
  const verificationReadyForUat =
    args.artifact === "verification" && validation.valid
      ? isVerificationArtifactReadyForUat(content)
      : false;
  const complete =
    args.artifact === "verification"
      ? validation.valid && verificationReadyForUat
      : validation.valid && Boolean(uatState?.complete);

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
    validation,
    verificationReadyForUat,
    uatStatus: uatState?.status ?? null,
    resumeState: uatState?.resumeState ?? null,
    checkpoint: uatState?.checkpoint ?? null,
    complete,
    summaryPaths,
    reason: null
  };
}

export async function blueprintPhaseValidationWrite(
  args: PhaseValidationWriteArgs
): Promise<PhaseValidationWriteResult> {
  const { projectRoot, resolved } = await resolveLocatedPhaseForMutation(args);
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
    completedSummaryRecords(summaryIndex.summaries)
  );
  const artifactLabel = args.artifact === "verification" ? "verification" : "UAT";
  const warnings: string[] = [...summaryWarnings];

  if (summaryPaths.length === 0) {
    throw new Error(
      `Phase ${resolved.phaseNumber} does not have any valid execution summaries yet. Run /blu-execute-phase ${resolved.phaseNumber} after fixing summary artifacts before writing ${artifactLabel} artifacts.`
    );
  }

  const artifactPath = validationArtifactPathFor(resolved, args.artifact);
  const absolutePath = resolveBlueprintPath(projectRoot, artifactPath);
  const normalizedContent = normalizeTextContent(args.content);
  const exists = await pathExists(absolutePath);
  const completedSummaryPaths = summaryPaths;
  const referencedSummaryPaths = collectReferencedValidatedSummaryPaths(
    normalizedContent,
    summaryIndex.summaries,
    new Set(completedSummaryRecords(summaryIndex.summaries).map((summary) => summary.planId))
  );
  const validation =
    normalizedContent.trim().length === 0
      ? {
          valid: false,
          issues: [`${args.artifact} content must not be empty.`],
          warnings: [] as string[]
        }
      : args.artifact === "verification"
        ? validateVerificationArtifactContent(normalizedContent, completedSummaryPaths)
        : validateUatArtifactContent(normalizedContent, referencedSummaryPaths);

  if (args.artifact === "uat") {
    const verificationPath = validationArtifactPathFor(resolved, "verification");
    const verificationAbsolutePath = resolveBlueprintPath(projectRoot, verificationPath);

    if (!(await pathExists(verificationAbsolutePath))) {
      throw new Error(
        `Phase ${resolved.phaseNumber} must be validated before UAT. Run /blu-validate-phase ${resolved.phaseNumber} first.`
      );
    }

    const verificationContent = await fs.readFile(verificationAbsolutePath, "utf8");
    const verificationSummaryPaths = collectReferencedValidatedSummaryPaths(
      verificationContent,
      summaryIndex.summaries,
      new Set(completedSummaryRecords(summaryIndex.summaries).map((summary) => summary.planId))
    );
    const verificationValidation = validateVerificationArtifactContent(
      verificationContent,
      verificationSummaryPaths
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
        : validateUatArtifactContent(existingContent, existingReferencedSummaryPaths);
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
          summaryPaths: referencedSummaryPaths,
          written: false,
          created: false,
          overwritten: false,
          status: "invalid",
          issues: validation.issues,
          warnings: [...warnings, ...validation.warnings]
        };
      }

      warnings.push(`Preserved existing ${args.artifact} artifact because the content was unchanged.`);
      warnings.push(...(await syncRoadmapPhaseCompletion(projectRoot, resolved)));

      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        artifact: args.artifact,
        path: artifactPath,
        summaryPaths: referencedSummaryPaths,
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
      summaryPaths: referencedSummaryPaths,
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

  warnings.push(...(await syncRoadmapPhaseCompletion(projectRoot, resolved)));

  return {
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    artifact: args.artifact,
    path: artifactPath,
    summaryPaths: referencedSummaryPaths,
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

export async function blueprintPhasePlanWrite(
  args: PhasePlanWriteArgs
): Promise<PhasePlanWriteResult> {
  const { projectRoot, resolved } = await resolveLocatedPhaseForMutation(args);
  const normalizedContent = normalizeTextContent(args.content);
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
    const contentForValidation =
      args.planId === undefined
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
    const validationIssues = [...validation.issues, ...dependencyIssues];
    const warnings: string[] = [...preparedContent.warnings];

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
  const completedPlans = new Set<string>();
  const warnings = [...planIndex.warnings];
  const knownPlanIds = new Set(planIndex.plans.map((plan) => plan.planId));
  const knownPlanPaths = new Map(planIndex.plans.map((plan) => [plan.planId, plan.path]));
  const planRecordsById = new Map(planIndex.plans.map((plan) => [plan.planId, plan]));

  for (const summaryPath of summaryPaths) {
    const planId = parseSummaryArtifactPath(summaryPath, resolved.phasePrefix);

    if (!planId) {
      warnings.push(`Ignoring non-canonical summary artifact name: ${summaryPath}`);
      continue;
    }

    const content = await fs.readFile(resolveBlueprintPath(projectRoot, summaryPath), "utf8");
    const linkedPlanPath = extractSummaryPlanReference(content);
    const validation = validateStrictSummaryArtifactContent(content, {
      linkedPlanPath: knownPlanPaths.get(planId) ?? null
    });

    summaries.push(toPhaseSummaryRecord(planId, summaryPath, content, linkedPlanPath));

    const summaryStatus = extractSummaryStatus(content);
    const linkedPlan = planRecordsById.get(planId);
    const missingDependencyPlans = linkedPlan
      ? collectMissingDependencyPlanPaths(linkedPlan.dependsOn, knownPlanIds, resolved)
      : [];

    if (validation.valid && summaryStatus === "COMPLETED") {
      if (!linkedPlan) {
        warnings.push(
          `${summaryPath}: no matching plan artifact exists for this summary, so it does not close execution coverage.`
        );
      } else if (!linkedPlan.valid) {
        warnings.push(
          `${summaryPath}: linked plan ${linkedPlan.path} is invalid, so this summary does not close execution coverage.`
        );
      } else if (missingDependencyPlans.length > 0) {
        warnings.push(
          `${summaryPath}: linked plan ${linkedPlan.path} is missing dependency plan artifacts (${missingDependencyPlans.join(", ")}), so this summary does not close execution coverage.`
        );
      } else {
        completedPlans.add(planId);
      }
    } else if (validation.valid && summaryStatus) {
      warnings.push(
        `${summaryPath}: summary status is ${summaryStatus}, so it remains pending execution debt.`
      );
    } else {
      warnings.push(
        `${summaryPath}: summary artifact is invalid and does not count as completed execution evidence.`
      );
      warnings.push(...validation.issues.map((issue) => `${summaryPath}: ${issue}`));
      warnings.push(...validation.warnings.map((warning) => `${summaryPath}: ${warning}`));
    }

    if (!knownPlanPaths.has(planId) && !(validation.valid && summaryStatus === "COMPLETED")) {
      warnings.push(`${summaryPath}: no matching plan artifact exists for this summary.`);
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
  const validation = validateStrictSummaryArtifactContent(content, {
    linkedPlanPath: planPathFor(resolved, planId),
    requirePlanMarker: true
  });

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
      path: summaryPathFor(resolved, planId),
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
  const missingDependencyPlans = collectMissingDependencyPlanPaths(
    indexedPlan?.dependsOn ?? plan.metadata?.dependsOn ?? [],
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
      path: summaryPathFor(resolved, planId),
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

  const pathValue = summaryPathFor(resolved, planId);
  const absolutePath = resolveBlueprintPath(projectRoot, pathValue);
  const normalizedContent = normalizeTextContent(args.content);
  const validation = validateStrictSummaryArtifactContent(normalizedContent, {
    linkedPlanPath: plan.path,
    requirePlanMarker: true
  });
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
      warnings
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
        warnings
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
    warnings
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
      "Persist substantive phase-scoped discovery artifact content with overwrite protection.",
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
    name: "blueprint_phase_validation_write",
    description:
      "Persist a phase-scoped VERIFICATION or UAT artifact with overwrite protection and execution-aware prerequisite checks.",
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
    name: "blueprint_phase_plan_write",
    description:
      "Persist substantive phase-scoped PLAN artifact content with overwrite protection and validation.",
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
    name: "blueprint_phase_summary_write",
    description:
      "Persist substantive phase-scoped SUMMARY artifact content for an existing plan with overwrite protection.",
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
