import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import * as z from "zod/v4";

import { prepareTextForPersistence } from "../../shared/security.js";
import { readArtifactContract } from "../artifact-contracts/index.js";
import { blueprintDirectCommand } from "../command-paths.js";
import { isObviouslyNonPathMarkupToken } from "./path-token-heuristics.js";
import {
  ensureRepoRoot,
  resolveBlueprintPath,
  resolveRepoRelativePath,
  toRepoRelativePath,
  validatePlanArtifactContent,
  validateReviewArtifactContent,
  validateReviewArtifactScopeCoverage,
  writeTextFile
} from "./artifacts.js";
import { blueprintConfigGet } from "./config.js";
import {
  blueprintPhaseExecutionTargets,
  blueprintPhaseLocate,
  blueprintPhasePlanIndex,
  blueprintPhasePlanRead,
  blueprintPhaseSummaryIndex,
  blueprintPhaseSummaryRead
} from "./phase.js";

type ReviewArtifactKind =
  | "code-review"
  | "peer-review"
  | "review-fix"
  | "security"
  | "ui-review";

type NumericInput = string | number;

type ReviewFindingSeverity = "critical" | "high" | "medium" | "low" | "unknown";
type ReviewFindingDisposition = "follow-up" | "observation" | "blocked" | "accepted-risk";
type ReviewFixTargetClassification =
  | "fixable"
  | "test-gap"
  | "validation-only"
  | "routing-note"
  | "no-op"
  | "blocked"
  | "observation"
  | "accepted-risk";
type CodeReviewEvidenceCoverageStatus = "used" | "deferred" | "irrelevant";
type ReviewFixStatus = "COMPLETED" | "PARTIAL" | "BLOCKED";
type ReviewFixReadiness = "ready-for-validation" | "not-ready-for-validation" | "blocked";
type ReviewFixCompletionState = "complete" | "pending" | "blocked";
type ReviewFixFindingStatus = "fixed" | "deferred" | "skipped";
type ReviewFixVerificationResult = "pass" | "fail" | "blocked" | "not-run";
type ReviewFixDependencyStatus = "satisfied" | "pending" | "blocked";
type ReviewFixManualStatus = "MANUAL" | "DEFERRED" | "NONE";
type ReviewFixGapStatus = "OPEN" | "BLOCKED" | "NONE";
type ReviewFixEvidenceKind =
  | "review"
  | "summary"
  | "plan"
  | "repo-path"
  | "command"
  | "test"
  | "other";

type ReviewFixExecutionDebt = {
  pendingPlans: string[];
  lowerWavePendingPlanIds: string[];
  missingCompletedSummaries: boolean;
  unsatisfiedDependencyPlans: Array<{ planId: string; path: string }>;
  blockers: string[];
};

type PeerReviewStatus = "COMPLETED" | "PARTIAL" | "BLOCKED";
type PeerReviewReadiness = "ready-for-routing" | "not-ready-for-routing" | "blocked";
type PeerReviewCompletionState = "complete" | "pending" | "blocked";
type PeerReviewReviewerStatus = "completed" | "unavailable" | "failed" | "blocked";
type PeerReviewPlanFit = "achieves-goal" | "needs-revision" | "blocked";
type PeerReviewFindingStatus = "OPEN" | "BLOCKED" | "NONE";
type PeerReviewManualStatus = "MANUAL" | "DEFERRED" | "NONE";
type PeerReviewGapStatus = "OPEN" | "BLOCKED" | "NONE";
type PeerReviewEvidenceCoverageStatus = "used" | "deferred" | "unavailable";

type ReviewFindingLocation = {
  display: string;
  file: string;
  startLine: number;
  endLine: number | null;
};

type ReviewFinding = {
  id: string;
  visibleId: string | null;
  stableId: string | null;
  legacyDerived: boolean;
  severity: ReviewFindingSeverity;
  summary: string;
  sourceSection: string | null;
  disposition: ReviewFindingDisposition | null;
  location: ReviewFindingLocation | null;
  file: string | null;
  startLine: number | null;
  endLine: number | null;
  evidence: string | null;
  impact: string | null;
  recommendation: string | null;
  classification: ReviewFixTargetClassification | null;
  defaultEligible: boolean;
};

type ReviewRecordArgs = {
  cwd?: string;
  phase?: NumericInput;
  artifact: ReviewArtifactKind;
  content?: string;
  model?: unknown;
  overwrite?: boolean;
  scopeFiles?: string[];
  scopeSource?: ReviewModeSource;
  depth?: ReviewDepth;
  targetIds?: string[];
};

type ReviewRecordResult = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  phaseDir: string;
  artifact: ReviewArtifactKind;
  reportPath: string;
  written: boolean;
  created: boolean;
  overwritten: boolean;
  status: "created" | "updated" | "reused" | "invalid";
  counts: {
    sections: number;
    findings: number;
    followUps: number;
  };
  followUps: string[];
  diagnostics?: ReviewModelDiagnostic[];
  diagnosticCounts?: ReviewValidateModelResult["diagnosticCounts"];
  repairSummary?: ReviewModelRepairSummary;
  taskSchema?: Record<string, unknown> | null;
  warnings: string[];
};

type ReviewDepth = "quick" | "standard" | "deep";
type ReviewModeSource =
  | "explicit-files"
  | "phase-plans"
  | "phase-summaries"
  | "phase-evidence";

type ReviewScopeConfirmation = {
  recommended: boolean;
  pendingGate: "none" | "scope-confirmation";
  reasons: string[];
  thresholds: {
    broadFileCount: number;
    multiPlanCount: number;
    deepFileCount: number;
  };
  signals: {
    fileCount: number;
    summaryCount: number;
    matchedPlanCount: number;
    depth: ReviewDepth;
    source: ReviewModeSource;
  };
};

type ReviewScopeArgs = {
  cwd?: string;
  phase?: NumericInput;
  files?: string[];
  depth?: ReviewDepth;
  includeAuthoringContext?: boolean;
};

type ReviewScopePhase = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  phaseDir: string;
  resolvedFrom: "explicit" | "state" | "roadmap";
};

type CodeReviewAuthoringContext = {
  phase: ReviewScopePhase;
  files: string[];
  reviewMode: {
    depth: ReviewDepth;
    source: ReviewModeSource;
  };
  knownEvidenceArtifacts: string[];
  allowedNextActions: string[];
  preferredNextSafeAction: string | null;
  secondaryNextSafeAction: string | null;
  schemaPath: string;
  baseSchema: Record<string, unknown>;
  taskSchema: Record<string, unknown>;
};

type ReviewScopeResult = {
  status: "ready" | "invalid";
  phase: ReviewScopePhase | null;
  files: string[];
  reviewMode: {
    depth: ReviewDepth;
    source: ReviewModeSource;
  };
  confirmationRecommended: ReviewScopeConfirmation;
  artifacts: {
    plans: string[];
    summaries: string[];
    verification: string | null;
    uat: string | null;
    existingReview: string | null;
    security: string | null;
  };
  authoringContext?: CodeReviewAuthoringContext;
  reason: string | null;
  warnings: string[];
};

type NormalizeReviewFilesResult = {
  files: string[];
  rejected: boolean;
};

type ReviewLoadFindingsArgs = {
  cwd?: string;
  phase?: NumericInput;
  artifact?: ReviewArtifactKind;
};

type ReviewLoadFindingsResult = {
  phaseFound: boolean;
  found: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  artifact: ReviewArtifactKind;
  path: string | null;
  findings: ReviewFinding[];
  severityCounts: Record<ReviewFindingSeverity, number>;
  followUps: string[];
  followUpTargets: ReviewFixTarget[];
  reason: string | null;
  warnings: string[];
};

type CodeReviewStructuredModel = {
  verdict: "PASS" | "FOLLOW_UP" | "BLOCKED";
  reviewSummary: string[];
  positiveSignals: string[];
  findings: Array<{
    severity: ReviewFindingSeverity;
    disposition: ReviewFindingDisposition;
    location: string;
    evidence: string;
    impact: string;
    recommendation: string;
  }>;
  evidenceCoverage: Record<
    string,
    {
      status: CodeReviewEvidenceCoverageStatus;
      rationale: string;
    }
  >;
  followUps: string[];
  nextSafeAction: string;
};

type ReviewFixTarget = {
  targetId: string;
  visibleId: string | null;
  stableId: string | null;
  legacyDerived: boolean;
  source: "finding" | "follow-up";
  severity: ReviewFindingSeverity;
  summary: string;
  sourceSection: string | null;
  disposition: ReviewFindingDisposition | null;
  location: string | null;
  file: string | null;
  startLine: number | null;
  endLine: number | null;
  evidence: string | null;
  impact: string | null;
  recommendation: string | null;
  classification: ReviewFixTargetClassification;
  defaultEligible: boolean;
};

type ReviewFixStructuredModel = {
  status: ReviewFixStatus;
  readiness: ReviewFixReadiness;
  completionState: ReviewFixCompletionState;
  remediationSummary: string[];
  findingsAddressed: Array<{
    findingId: string;
    status: ReviewFixFindingStatus;
    evidence: string;
    disposition: string;
  }>;
  changesMade: Array<{
    file: string;
    summary: string;
  }>;
  verification: Array<{
    check: string;
    command: string;
    result: ReviewFixVerificationResult;
    evidence: string;
  }>;
  dependencyPlans: Array<{
    planId: string;
    path: string;
    status: ReviewFixDependencyStatus;
    evidence: string;
  }>;
  manualOrDeferredWork: Array<{
    item: string;
    reason: string;
    followUp: string;
    status: ReviewFixManualStatus;
  }>;
  gapRoutes: Array<{
    gap: string;
    evidence: string;
    repair: string;
    status: ReviewFixGapStatus;
  }>;
  followUps: string[];
  evidence: Array<{
    kind: ReviewFixEvidenceKind;
    source: string;
    summary: string;
  }>;
  nextSafeAction: string;
};

type ReviewFixAuthoringContext = {
  phase: ReviewScopePhase;
  path: string;
  sourceReviewPath: string;
  targets: ReviewFixTarget[];
  selectedTargetIds: string[];
  completedSummaries: string[];
  dependencyPlans: Array<{ planId: string; path: string }>;
  executionDebt: ReviewFixExecutionDebt;
  knownEvidenceArtifacts: string[];
  existingReviewFix: string | null;
  allowCompleted: boolean;
  completedNextSafeAction: string;
  partialNextSafeActions: string[];
  blockedNextSafeActions: string[];
  blockedRequiredNextSafeAction: string | null;
  allowedNextActions: string[];
  schemaPath: string;
  baseSchema: Record<string, unknown>;
  taskSchema: Record<string, unknown>;
};

type PeerReviewStructuredModel = {
  status: PeerReviewStatus;
  readiness: PeerReviewReadiness;
  completionState: PeerReviewCompletionState;
  reviewSummary: string[];
  reviewerCoverage: Array<{
    reviewer: string;
    status: PeerReviewReviewerStatus;
    summary: string;
  }>;
  planReviews: Array<{
    planId: string;
    path: string;
    goalFit: PeerReviewPlanFit;
    summary: string;
  }>;
  findings: Array<{
    severity: ReviewFindingSeverity;
    source: string;
    evidence: string;
    recommendation: string;
    status: PeerReviewFindingStatus;
  }>;
  consensus: string[];
  disagreements: string[];
  riskAssessment: {
    level: "LOW" | "MEDIUM" | "HIGH";
    summary: string;
  };
  manualOrDeferredWork: Array<{
    item: string;
    reason: string;
    followUp: string;
    status: PeerReviewManualStatus;
  }>;
  gapRoutes: Array<{
    gap: string;
    evidence: string;
    repair: string;
    status: PeerReviewGapStatus;
  }>;
  followUps: string[];
  evidenceCoverage: Record<
    string,
    {
      status: PeerReviewEvidenceCoverageStatus;
      rationale: string;
    }
  >;
  nextSafeAction: string;
};

type PeerReviewAuthoringContext = {
  phase: ReviewScopePhase;
  path: string;
  plans: Array<{ planId: string; path: string; title: string | null }>;
  knownEvidenceArtifacts: string[];
  pendingPlans: string[];
  existingPeerReview: string | null;
  completedNextSafeActions: string[];
  partialNextSafeActions: string[];
  blockedNextSafeActions: string[];
  allowedNextActions: string[];
  schemaPath: string;
  baseSchema: Record<string, unknown>;
  taskSchema: Record<string, unknown>;
};

type SecurityReviewStatus = "COMPLETED" | "PARTIAL" | "BLOCKED";
type SecurityReviewReadiness = "ready-for-routing" | "needs-follow-up" | "blocked";
type SecurityReviewCompletionState = "complete" | "partial" | "blocked";
type SecurityThreatStatus = "closed" | "accepted" | "open" | "none";
type SecurityEvidenceCoverageStatus = "used" | "deferred" | "unavailable";
type SecurityManualStatus = "MANUAL" | "DEFERRED" | "NONE";
type SecurityGapStatus = "OPEN" | "BLOCKED" | "NONE";
type UiReviewVerdict = "PASS" | "FOLLOW_UP" | "BLOCKED";
type UiReviewReadiness = "ready-for-routing" | "needs-follow-up" | "blocked";
type UiReviewCompletionState = "complete" | "partial" | "blocked";
type UiReviewPillar =
  | "Copywriting"
  | "Visual Hierarchy"
  | "Color"
  | "Typography"
  | "Spacing"
  | "Experience Design";
type UiReviewEvidenceCoverageStatus = "used" | "unavailable";
type UiReviewPriorityFixStatus = "OPEN" | "NONE";
type UiReviewFindingStatus = "OPEN" | "BLOCKED" | "NONE";
type UiReviewFindingSeverity = "high" | "medium" | "low" | "none";

type SecurityDeclaredThreat = {
  threatId: string;
  sourcePlan: string;
  category: string;
  component: string;
  disposition: string;
  mitigation: string;
};

type SecuritySummaryThreatFlag = {
  flagId: string;
  sourceSummary: string;
  threatId: string | null;
  evidence: string;
};

type SecurityThreatRegisterRow = {
  threatId: string;
  status: SecurityThreatStatus;
  evidence: string;
  verifierNote: string;
};

type SecurityStructuredModel = {
  status: SecurityReviewStatus;
  readiness: SecurityReviewReadiness;
  completionState: SecurityReviewCompletionState;
  securitySummary: string[];
  evidenceCoverage: Record<
    string,
    {
      status: SecurityEvidenceCoverageStatus;
      rationale: string;
    }
  >;
  threatRegister: SecurityThreatRegisterRow[];
  acceptedRisks: Array<{
    threatId: string;
    rationale: string;
    acceptedBy: string;
    acceptedAt: string;
    evidence: string;
  }>;
  findings: Array<{
    kind: "open-threat" | "missing-control" | "unregistered-flag" | "suspicious-artifact" | "hardening-follow-up" | "none";
    severity: ReviewFindingSeverity | "none";
    threatId: string;
    evidence: string;
    recommendation: string;
    status: "open" | "follow-up" | "accepted" | "closed" | "none";
  }>;
  manualOrDeferredWork: Array<{
    item: string;
    reason: string;
    followUp: string;
    status: SecurityManualStatus;
  }>;
  gapRoutes: Array<{
    gap: string;
    evidence: string;
    repair: string;
    status: SecurityGapStatus;
  }>;
  followUps: string[];
  auditTrail: {
    auditDate: string;
    executionMode: "inline" | "security-auditor-assisted";
    overwriteGate: "none" | "confirmed" | "reused" | "not-needed";
    verifyOrAcceptDecision: "none" | "verified" | "accepted" | "pending";
    pendingOpenThreatStatus: "none" | "verifying" | "accepted" | "still-open";
    verifierNote: string;
  };
  nextSafeAction: string;
};

type SecurityAuthoringContext = {
  phase: ReviewScopePhase;
  path: string;
  completedSummaries: string[];
  pendingPlans: string[];
  declaredThreats: SecurityDeclaredThreat[];
  summaryThreatFlags: SecuritySummaryThreatFlag[];
  knownEvidenceArtifacts: string[];
  existingSecurity: string | null;
  allowedNextActions: string[];
  completedNextSafeAction: string;
  partialNextSafeAction: string;
  blockedNextSafeAction: string;
  schemaPath: string;
  baseSchema: Record<string, unknown>;
  taskSchema: Record<string, unknown>;
};

type UiReviewStructuredModel = {
  verdict: UiReviewVerdict;
  readiness: UiReviewReadiness;
  completionState: UiReviewCompletionState;
  uiReviewSummary: string[];
  overallScore: number;
  evidenceCoverage: Record<
    string,
    {
      status: UiReviewEvidenceCoverageStatus;
      rationale: string;
    }
  >;
  pillarScores: Array<{
    pillar: UiReviewPillar;
    score: number;
    evidence: string;
    keyFinding: string;
  }>;
  priorityFixes: Array<{
    item: string;
    userImpact: string;
    repair: string;
    status: UiReviewPriorityFixStatus;
  }>;
  findings: Array<{
    pillar: UiReviewPillar | "none";
    severity: UiReviewFindingSeverity;
    evidence: string;
    userImpact: string;
    recommendation: string;
    status: UiReviewFindingStatus;
  }>;
  followUps: string[];
  auditTrail: {
    auditDate: string;
    executionMode: "inline" | "ui-auditor-assisted";
    existingReviewPosture: "none" | "reused" | "overwrite-confirmed";
    visualEvidence: "captured" | "supplied" | "not-supplied";
    auditorPath: "blueprint-ui-auditor" | "no-subagent-fallback";
    scoreConsistencyNote: string;
    confidenceLimitations: string;
  };
  nextSafeAction: string;
};

type UiReviewAuthoringContext = {
  phase: ReviewScopePhase;
  path: string;
  completedPlans: Array<{ planId: string; path: string }>;
  completedSummaries: string[];
  dependencyPlans: Array<{ planId: string; path: string }>;
  pendingPlans: string[];
  lowerWavePendingPlanIds: string[];
  verification: string | null;
  uat: string | null;
  knownEvidenceArtifacts: string[];
  existingUiReview: string | null;
  optionalEvidenceArtifacts: string[];
  allowedExistingReviewPostures: UiReviewStructuredModel["auditTrail"]["existingReviewPosture"][];
  completedNextSafeAction: string;
  followUpNextSafeAction: string;
  blockedNextSafeAction: string;
  allowedNextActions: string[];
  schemaPath: string;
  baseSchema: Record<string, unknown>;
  taskSchema: Record<string, unknown>;
};

type ReviewDiagnosticSource = "scope" | "schema" | "residual" | "markdown";

type ReviewModelDiagnostic = {
  source: ReviewDiagnosticSource;
  path: string;
  code: string;
  message: string;
  context: Record<string, unknown>;
  suggestion: string;
  received?: unknown;
  expected?: unknown;
  allowedValues?: unknown[];
  missing?: string[];
  repair?: string;
  retryable?: boolean;
  argsPatch?: Record<string, unknown>;
};

type ReviewModelRepairSummary = {
  topBlockers: string[];
  fieldsToChange: string[];
  firstPassActions: string[];
  action: "none" | "reread_authoring_context" | "retry_validation" | "stop";
  retryable: boolean;
  retryInstruction: string;
};

type ReviewValidateModelArgs = {
  cwd?: string;
  phase?: NumericInput;
  artifact?: "code-review" | "peer-review" | "review-fix" | "security" | "ui-review";
  files?: string[];
  depth?: ReviewDepth;
  targetIds?: string[];
  model: unknown;
};

type ReviewValidateModelResult = {
  status: "valid" | "invalid";
  valid: boolean;
  phase: ReviewScopeResult["phase"];
  files: string[];
  reviewMode: ReviewScopeResult["reviewMode"];
  schemaPath: string | null;
  taskSchema: Record<string, unknown> | null;
  diagnostics: ReviewModelDiagnostic[];
  diagnosticCounts: {
    total: number;
    bySource: Record<ReviewDiagnosticSource, number>;
    byCode: Record<string, number>;
  };
  repairSummary: ReviewModelRepairSummary;
  normalizedModel:
    | CodeReviewStructuredModel
    | PeerReviewStructuredModel
    | ReviewFixStructuredModel
    | SecurityStructuredModel
    | UiReviewStructuredModel
    | null;
  renderPreview: string | null;
  warnings: string[];
};

type PublicReviewValidateModelResult = Omit<
  ReviewValidateModelResult,
  "taskSchema" | "normalizedModel" | "renderPreview"
>;

type PublicReviewRecordResult = Omit<ReviewRecordResult, "taskSchema"> & {
  taskSchema?: ReviewRecordResult["taskSchema"];
};

type ReviewAuthoringContextArgs = {
  cwd?: string;
  phase?: NumericInput;
  artifact: "code-review" | "peer-review" | "review-fix" | "security" | "ui-review";
  files?: string[];
  depth?: ReviewDepth;
  targetIds?: string[];
};

type ReviewAuthoringContextResult = {
  status: "ready" | "invalid";
  artifact: "code-review" | "peer-review" | "review-fix" | "security" | "ui-review";
  phase: ReviewScopePhase | null;
  files: string[];
  reviewMode: ReviewScopeResult["reviewMode"] | null;
  schemaPath: string | null;
  baseSchema: Record<string, unknown> | null;
  taskSchema: Record<string, unknown> | null;
  modelOnly: boolean;
  authoringContext:
    | CodeReviewAuthoringContext
    | PeerReviewAuthoringContext
    | ReviewFixAuthoringContext
    | SecurityAuthoringContext
    | UiReviewAuthoringContext
    | null;
  prerequisiteBlockers: string[];
  reason: string | null;
  warnings: string[];
};

const REVIEW_ARTIFACT_SUFFIXES: Record<ReviewArtifactKind, string> = {
  "code-review": "-REVIEW.md",
  "peer-review": "-REVIEWS.md",
  "review-fix": "-REVIEW-FIX.md",
  security: "-SECURITY.md",
  "ui-review": "-UI-REVIEW.md"
};

const numericBlueprintInputSchema = z.union([z.string(), z.number()]);

const reviewRecordInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum([
    "code-review",
    "peer-review",
    "review-fix",
    "security",
    "ui-review"
  ]),
  content: z.string().optional(),
  model: z.unknown().optional(),
  overwrite: z.boolean().optional(),
  scopeFiles: z.array(z.string()).optional(),
  scopeSource: z
    .enum(["explicit-files", "phase-plans", "phase-summaries", "phase-evidence"])
    .optional(),
  depth: z.enum(["quick", "standard", "deep"]).optional(),
  targetIds: z.array(z.string()).optional()
};

const reviewScopeInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  files: z.array(z.string()).optional(),
  depth: z.enum(["quick", "standard", "deep"]).optional(),
  includeAuthoringContext: z.boolean().optional()
};

const reviewLoadFindingsInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z
    .enum(["code-review", "peer-review", "review-fix", "security", "ui-review"])
    .optional()
};

const reviewValidateModelInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum(["code-review", "peer-review", "review-fix", "security", "ui-review"]).optional(),
  files: z.array(z.string()).optional(),
  depth: z.enum(["quick", "standard", "deep"]).optional(),
  targetIds: z.array(z.string()).optional(),
  model: z.unknown()
};

const reviewAuthoringContextInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum(["code-review", "peer-review", "review-fix", "security", "ui-review"]),
  files: z.array(z.string()).optional(),
  depth: z.enum(["quick", "standard", "deep"]).optional(),
  targetIds: z.array(z.string()).optional()
};

const CODE_REVIEW_MODEL_IDENTITY_KEYS = new Set([
  "cwd",
  "phase",
  "phaseNumber",
  "phasePrefix",
  "phaseName",
  "phaseDir",
  "artifact",
  "path",
  "reportPath",
  "content",
  "scope",
  "severityCounts"
]);

const SECURITY_MODEL_IDENTITY_KEYS = new Set([
  "cwd",
  "phase",
  "phaseNumber",
  "phasePrefix",
  "phaseName",
  "phaseDir",
  "artifact",
  "path",
  "reportPath",
  "content",
  "summaryPath",
  "summaryPaths",
  "linkedPlanPath",
  "planPath",
  "planPaths",
  "threatCounts"
]);

const PEER_REVIEW_MODEL_IDENTITY_KEYS = new Set([
  "cwd",
  "phase",
  "phaseNumber",
  "phasePrefix",
  "phaseName",
  "phaseDir",
  "artifact",
  "path",
  "reportPath",
  "content",
  "planPath",
  "planPaths",
  "summaryPath",
  "summaryPaths"
]);

const CODE_REVIEW_LOCATION_PATTERN =
  /^((?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+):(\d+)(?:-(\d+))?$/;
const VISIBLE_REVIEW_TARGET_ID_PATTERN = /`?((?:F|FU)-[A-Z0-9][A-Z0-9._-]*)`?/i;
const CANONICAL_CODE_REVIEW_FINDING_PATTERN =
  /^\[(critical|high|medium|low|unknown)\]\[(follow-up|observation|blocked|accepted-risk)\]\s+`([^`]+)`\s+`([^`]+)`\s*-\s*Evidence:\s*(.+?)\s+Impact:\s*(.+?)\s+Fix\/verification:\s*(.+)$/i;
const LEGACY_CODE_REVIEW_FINDING_PATTERN =
  /^\[(critical|high|medium|low|unknown)\]\[(follow-up|observation|blocked|accepted-risk)\]\s+`([^`]+)`\s*-\s*Evidence:\s*(.+?)\s+Impact:\s*(.+?)\s+Fix\/verification:\s*(.+)$/i;
const CODE_REVIEW_NEXT_ACTION_BUILDERS = [
  (phaseNumber: string) => `/blu-code-review-fix ${phaseNumber}`,
  (phaseNumber: string) => `/blu-secure-phase ${phaseNumber}`,
  (phaseNumber: string) => `/blu-verify-work ${phaseNumber}`,
  (phaseNumber: string) => `/blu-add-tests ${phaseNumber}`,
  (phaseNumber: string) => `/blu-validate-phase ${phaseNumber}`,
  () => "/blu-progress"
] as const;
const REVIEW_FIX_TARGET_ID_COORDINATION_MESSAGE =
  "Pass the same targetIds to blueprint_review_authoring_context, blueprint_review_validate_model, and blueprint_review_record.";

function createAjvValidator(): Ajv2020 {
  return new Ajv2020({
    allErrors: true,
    strict: false,
    validateSchema: true
  });
}

type CommandCatalogResult = {
  commands: Record<string, { implemented: boolean }>;
};

let implementedCommandNamesPromise: Promise<Set<string> | null> | null = null;

function normalizeTextContent(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

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

function cloneJsonObject<T extends Record<string, unknown>>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function modelDiagnostic(args: ReviewModelDiagnostic): ReviewModelDiagnostic {
  return args;
}

function emptyDiagnosticCounts(): ReviewValidateModelResult["diagnosticCounts"] {
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

function countDiagnostics(
  diagnostics: ReviewModelDiagnostic[]
): ReviewValidateModelResult["diagnosticCounts"] {
  const counts = emptyDiagnosticCounts();

  for (const diagnostic of diagnostics) {
    counts.total += 1;
    counts.bySource[diagnostic.source] += 1;
    counts.byCode[diagnostic.code] = (counts.byCode[diagnostic.code] ?? 0) + 1;
  }

  return counts;
}

function reviewDiagnosticRepairText(diagnostic: ReviewModelDiagnostic): string {
  return diagnostic.repair ?? diagnostic.suggestion;
}

function formatReviewDiagnostic(diagnostic: ReviewModelDiagnostic): string {
  return `${diagnostic.source}:${diagnostic.path}:${diagnostic.code}: ${diagnostic.message} Repair: ${reviewDiagnosticRepairText(diagnostic)}`;
}

function reviewRepairActionFromDiagnostic(diagnostic: ReviewModelDiagnostic): string {
  if (diagnostic.source === "scope") {
    return "reread-authoring-context";
  }

  if (diagnostic.code === "schema.required" || diagnostic.code === "schema.minItems" || diagnostic.code === "schema.contains") {
    return "add";
  }

  if (diagnostic.code === "schema.additionalProperties" || diagnostic.code === "schema.maxItems") {
    return "remove";
  }

  if (diagnostic.code === "schema.uniqueItems") {
    return "dedupe";
  }

  if (diagnostic.code === "residual.runtime_owned_field") {
    return "remove-runtime-owned-fields";
  }

  if (diagnostic.source === "markdown") {
    return "repair-rendered-markdown";
  }

  if (diagnostic.source === "residual") {
    return "align-with-authoring-context";
  }

  return "replace";
}

function summarizeReviewModelRepairs(
  diagnostics: readonly ReviewModelDiagnostic[]
): ReviewModelRepairSummary {
  const topDiagnostics = diagnostics.slice(0, 5);
  const fieldsToChange = [
    ...new Set(
      diagnostics
        .map((diagnostic) => diagnostic.path)
        .filter((pathValue) =>
          pathValue === "model" ||
          pathValue.startsWith("model.") ||
          pathValue.startsWith("model[") ||
          pathValue === "renderPreview"
        )
    )
  ];
  const firstPassActions = [
    ...new Set(diagnostics.map((diagnostic) => reviewRepairActionFromDiagnostic(diagnostic)))
  ];
  const hasScopeBlocker = diagnostics.some((diagnostic) => diagnostic.source === "scope");
  const retryable = diagnostics.length > 0 && diagnostics.every((diagnostic) => diagnostic.retryable !== false);
  const action =
    diagnostics.length === 0
      ? "none"
      : hasScopeBlocker
        ? "reread_authoring_context"
        : retryable
          ? "retry_validation"
          : "stop";

  return {
    topBlockers: topDiagnostics.map(
      (diagnostic) => `${diagnostic.path}: ${diagnostic.message}`
    ),
    fieldsToChange,
    firstPassActions,
    action,
    retryable,
    retryInstruction:
      diagnostics.length === 0
        ? "No repair needed."
        : hasScopeBlocker
          ? "Re-read blueprint_review_authoring_context for the current phase and rebuild the model from that live context before retrying validation."
          : "Repair every diagnostic by exact path, applying each diagnostic's repair and allowedValues, then retry blueprint_review_validate_model once with the corrected model."
  };
}

function explicitReviewFilesRequested(files: string[] | undefined): boolean {
  return (files ?? []).some((candidate) => candidate.trim().length > 0);
}

function renderBulletList(items: string[], fallback = "none"): string {
  const lines = items.map((item) => item.trim()).filter((item) => item.length > 0);

  if (lines.length === 0) {
    return `- ${fallback}`;
  }

  return lines.map((item) => `- ${item}`).join("\n");
}

function formatReviewTargetId(prefix: "F" | "FU", index: number): string {
  return `${prefix}-${String(index + 1).padStart(2, "0")}`;
}

function extractVisibleReviewTargetId(value: string): string | null {
  const trimmed = value.trim();
  const startMatch = trimmed.match(
    /^`?((?:F|FU)-[A-Z0-9][A-Z0-9._-]*)`?(?:\s*[-:]\s*|\s+)/i
  );

  if (startMatch) {
    return startMatch[1].toUpperCase();
  }

  const inlineMatch = trimmed.match(VISIBLE_REVIEW_TARGET_ID_PATTERN);

  return inlineMatch ? inlineMatch[1].toUpperCase() : null;
}

function stripVisibleReviewTargetId(value: string): string {
  return value
    .replace(/^`?((?:F|FU)-[A-Z0-9][A-Z0-9._-]*)`?(?:\s*[-:]\s*|\s+)/i, "")
    .trim();
}

function buildLegacyReviewTargetId(
  prefix: "F" | "FU",
  sourceSection: string | null,
  value: string
): string {
  const digest = createHash("sha1")
    .update(`${prefix}\0${sourceSection ?? ""}\0${value.trim()}`)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();

  return `${prefix}-LEGACY-${digest}`;
}

function sanitizeMarkdownScalar(value: string): string {
  return value.replace(/\r\n|\r|\n/g, " ").replace(/\s+/g, " ").trim();
}

function renderIdentifiedBulletList(
  items: string[],
  prefix: "F" | "FU",
  fallback = "none"
): string {
  const lines = items
    .map((item) => stripVisibleReviewTargetId(item.trim()))
    .filter((item) => item.length > 0 && !isPlaceholderReviewListItem(item));

  if (lines.length === 0) {
    return `- ${fallback}`;
  }

  return lines
    .map((item, index) => `- \`${formatReviewTargetId(prefix, index)}\` - ${item}`)
    .join("\n");
}

function isGenericNoneValue(value: string): boolean {
  return /^(?:none|n\/a|na|not applicable)$/i.test(value.trim());
}

function hasPlaceholderLanguage(value: string): boolean {
  const normalized = value.trim();

  if (/\b(?:placeholder|replace me|fill in|insert here|coming soon)\b/i.test(normalized)) {
    return true;
  }

  return /^(?:todo|tbd)(?:\b|[:\s-])/i.test(normalized) && normalized.length <= 120;
}

function inferCodeReviewSecondaryNextSafeAction(
  allowedNextActions: string[],
  preferredNextSafeAction: string | null
): string | null {
  const repairAction =
    allowedNextActions.find((action) => /\/blu-code-review-fix\b/i.test(action)) ?? null;

  if (!repairAction || repairAction === preferredNextSafeAction) {
    return null;
  }

  return repairAction;
}

async function getImplementedCommandNames(): Promise<Set<string> | null> {
  if (!implementedCommandNamesPromise) {
    implementedCommandNamesPromise = (async () => {
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

        if (
          !implementedCommands.has("/blu-progress") ||
          !implementedCommands.has("/blu-code-review")
        ) {
          return null;
        }

        return implementedCommands;
      } catch {
        return null;
      }
    })();
  }

  return implementedCommandNamesPromise;
}

function extractBlueprintDirectCommands(value: string): string[] {
  return [
    ...new Set(
      [...value.matchAll(/\/blu-[a-z0-9-]+/gi)].map((match) =>
        match[0].toLowerCase()
      )
    )
  ];
}

async function validateImplementedNextSafeAction(
  value: string,
  sourceLabel = "Code-review model nextSafeAction"
): Promise<string[]> {
  const commands = extractBlueprintDirectCommands(value);

  if (commands.length === 0) {
    return [
      `${sourceLabel} must contain a direct Blueprint command such as /blu-progress.`
    ];
  }

  const implementedCommands = await getImplementedCommandNames();

  if (implementedCommands === null || implementedCommands.size === 0) {
    return [
      `${sourceLabel} could not be checked because the implemented command catalog was unavailable.`
    ];
  }

  const nonImplementedCommands = commands.filter(
    (command) => !implementedCommands.has(command)
  );

  if (nonImplementedCommands.length > 0) {
    return [
      `${sourceLabel} points to non-implemented command(s): ${nonImplementedCommands.join(", ")}.`
    ];
  }

  return [];
}

async function buildAllowedCodeReviewNextActions(phaseNumber: string): Promise<string[]> {
  const candidates = CODE_REVIEW_NEXT_ACTION_BUILDERS.map((buildAction) =>
    buildAction(phaseNumber)
  );
  const implementedCommands = await getImplementedCommandNames();

  if (implementedCommands === null || implementedCommands.size === 0) {
    return candidates;
  }

  return candidates.filter((action) =>
    extractBlueprintDirectCommands(action).every((command) =>
      implementedCommands.has(command)
    )
  );
}

function escapePatternLiteral(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function buildScopedLocationPattern(scopeFiles: string[]): string {
  const filePattern =
    scopeFiles.length === 0
      ? "(?:(?:[A-Za-z0-9._-]+/)+[A-Za-z0-9._-]+(?:\\.[A-Za-z0-9._-]+)?|[A-Za-z0-9._-]*\\.[A-Za-z0-9._-]+)"
      : `(?:${scopeFiles.map(escapePatternLiteral).join("|")})`;

  return `^${filePattern}:\\d+(?:-\\d+)?$`;
}

function buildTaskLocationSchema(scopeFiles: string[]): Record<string, unknown> {
  return {
    type: "string",
    description:
      "Repo-relative file:line or file:line-line citation narrowed to the resolved review scope.",
    pattern: buildScopedLocationPattern(scopeFiles),
    examples: scopeFiles.slice(0, 1).map((scopeFile) => `${scopeFile}:1`)
  };
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

function buildCodeReviewTaskSchema(args: {
  baseSchema: Record<string, unknown>;
  scopeFiles: string[];
  knownEvidenceArtifacts: string[];
  allowedNextActions: string[];
  preferredNextSafeAction: string | null;
  secondaryNextSafeAction: string | null;
}): Record<string, unknown> {
  const schema = cloneJsonObject(args.baseSchema);
  const properties = getJsonObjectProperty(schema, "properties");
  const defs = getJsonObjectProperty(schema, "$defs");
  const finding = defs ? getJsonObjectProperty(defs, "finding") : null;
  const findingProperties = finding ? getJsonObjectProperty(finding, "properties") : null;
  const location = findingProperties ? getJsonObjectProperty(findingProperties, "location") : null;

  if (properties) {
    const nextSafeAction = getJsonObjectProperty(properties, "nextSafeAction");
    if (nextSafeAction) {
      nextSafeAction.enum = args.allowedNextActions;
    }

    properties.evidenceCoverage = {
      type: "object",
      description:
        "Exhaustive coverage decisions for the exact known evidence artifacts in this phase.",
      additionalProperties: false,
      required: args.knownEvidenceArtifacts,
      properties: Object.fromEntries(
        args.knownEvidenceArtifacts.map((artifactPath) => [
          artifactPath,
          { $ref: "#/$defs/evidenceCoverageEntry" }
        ])
      )
    };
  }

  if (location) {
    for (const key of Object.keys(location)) {
      delete location[key];
    }
    Object.assign(location, buildTaskLocationSchema(args.scopeFiles));
  }

  schema["x-blueprint-runtimeContext"] = {
    preferredNextSafeAction: args.preferredNextSafeAction,
    secondaryNextSafeAction: args.secondaryNextSafeAction,
    allowedNextActions: args.allowedNextActions,
    knownEvidenceArtifacts: args.knownEvidenceArtifacts,
    scopeFiles: args.scopeFiles
  };

  return schema;
}

async function buildCodeReviewAuthoringContext(args: {
  phase: ReviewScopePhase;
  files: string[];
  reviewMode: ReviewScopeResult["reviewMode"];
  knownEvidenceArtifacts: string[];
}): Promise<CodeReviewAuthoringContext> {
  const modelContract = readArtifactContract("review.code-review").modelContract;

  if (!modelContract) {
    throw new Error("review.code-review does not expose a modelContract.");
  }
  if (!modelContract.schemaPath) {
    throw new Error("review.code-review modelContract does not expose a schemaPath.");
  }

  const allowedNextActions = await buildAllowedCodeReviewNextActions(args.phase.phaseNumber);
  const preferredNextSafeAction =
    allowedNextActions.find((action) => /\/blu-secure-phase\b/i.test(action)) ??
    allowedNextActions.find((action) => /\/blu-code-review-fix\b/i.test(action)) ??
    allowedNextActions[0] ??
    null;
  const secondaryNextSafeAction = inferCodeReviewSecondaryNextSafeAction(
    allowedNextActions,
    preferredNextSafeAction
  );
  const baseSchema = cloneJsonObject(modelContract.jsonSchema);
  const taskSchema = buildCodeReviewTaskSchema({
    baseSchema,
    scopeFiles: args.files,
    knownEvidenceArtifacts: args.knownEvidenceArtifacts,
    allowedNextActions,
    preferredNextSafeAction,
    secondaryNextSafeAction
  });

  return {
    phase: args.phase,
    files: [...args.files],
    reviewMode: { ...args.reviewMode },
    knownEvidenceArtifacts: [...args.knownEvidenceArtifacts],
    allowedNextActions,
    preferredNextSafeAction,
    secondaryNextSafeAction,
    schemaPath: modelContract.schemaPath,
    baseSchema,
    taskSchema
  };
}

async function buildAllowedPeerReviewNextActions(args: {
  phaseNumber: string;
  pendingPlans: string[];
  hasCodeReview: boolean;
}): Promise<{
  completedNextSafeActions: string[];
  partialNextSafeActions: string[];
  blockedNextSafeActions: string[];
  allowedNextActions: string[];
}> {
  const completedPreferred =
    args.pendingPlans.length > 0
      ? `/blu-execute-phase ${args.phaseNumber}`
      : args.hasCodeReview
        ? "/blu-progress"
        : `/blu-code-review ${args.phaseNumber}`;
  const partialCandidates = uniqueSortedStrings([
    `/blu-plan-phase ${args.phaseNumber}`,
    `/blu-review ${args.phaseNumber}`
  ]);
  const blockedCandidates = uniqueSortedStrings([
    `/blu-review ${args.phaseNumber}`,
    `/blu-plan-phase ${args.phaseNumber}`
  ]);
  const implementedCommands = await getImplementedCommandNames();
  const filterImplemented = (actions: string[]): string[] => {
    if (implementedCommands === null || implementedCommands.size === 0) {
      return actions;
    }

    const filtered = actions.filter((action) =>
      extractBlueprintDirectCommands(action).every((command) =>
        implementedCommands.has(command)
      )
    );

    return filtered.length > 0 ? filtered : actions;
  };
  const completedNextSafeActions = filterImplemented([completedPreferred]);
  const partialNextSafeActions = filterImplemented(partialCandidates);
  const blockedNextSafeActions = filterImplemented(blockedCandidates);

  return {
    completedNextSafeActions,
    partialNextSafeActions,
    blockedNextSafeActions,
    allowedNextActions: uniqueSortedStrings([
      ...completedNextSafeActions,
      ...partialNextSafeActions,
      ...blockedNextSafeActions
    ])
  };
}

const PEER_REVIEW_REPO_EVIDENCE_ARTIFACTS = [
  ".blueprint/ROADMAP.md",
  ".blueprint/REQUIREMENTS.md"
];

async function collectPeerReviewEvidenceArtifacts(args: {
  projectRoot: string;
  planPaths: string[];
  artifacts: string[];
}): Promise<string[]> {
  const repoEvidenceArtifacts: string[] = [];

  for (const artifactPath of PEER_REVIEW_REPO_EVIDENCE_ARTIFACTS) {
    if (await pathExists(resolveBlueprintPath(args.projectRoot, artifactPath))) {
      repoEvidenceArtifacts.push(artifactPath);
    }
  }

  return uniqueSortedStrings([
    ...repoEvidenceArtifacts,
    ...args.planPaths,
    ...args.artifacts
      .filter((artifactPath) =>
        /-(?:CONTEXT|RESEARCH|UI-SPEC|PLAN|SUMMARY|VERIFICATION|UAT|REVIEW|REVIEWS|SECURITY|UI-REVIEW)\.md$/i.test(artifactPath)
      )
  ]);
}

function buildPeerReviewTaskSchema(args: {
  baseSchema: Record<string, unknown>;
  plans: Array<{ planId: string; path: string }>;
  knownEvidenceArtifacts: string[];
  completedNextSafeActions: string[];
  partialNextSafeActions: string[];
  blockedNextSafeActions: string[];
  allowedNextActions: string[];
  reportPath: string;
}): Record<string, unknown> {
  const schema = cloneJsonObject(args.baseSchema);
  const properties = getJsonObjectProperty(schema, "properties");

  if (properties) {
    const planReviews = getJsonObjectProperty(properties, "planReviews");
    if (planReviews) {
      planReviews.minItems = args.plans.length;
      planReviews.maxItems = args.plans.length;
      const items = getJsonObjectProperty(planReviews, "items");
      const itemProperties = items ? getJsonObjectProperty(items, "properties") : null;
      const planId = itemProperties ? getJsonObjectProperty(itemProperties, "planId") : null;
      const pathProperty = itemProperties ? getJsonObjectProperty(itemProperties, "path") : null;
      if (planId) {
        planId.enum = args.plans.map((plan) => plan.planId);
      }
      if (pathProperty) {
        pathProperty.enum = args.plans.map((plan) => plan.path);
      }
      planReviews.allOf = args.plans.map((plan) => ({
        contains: {
          type: "object",
          required: ["planId", "path"],
          properties: {
            planId: { const: plan.planId },
            path: { const: plan.path }
          }
        },
        minContains: 1,
        maxContains: 1
      }));
    }

    const evidenceCoverage = getJsonObjectProperty(properties, "evidenceCoverage");
    if (evidenceCoverage) {
      evidenceCoverage.additionalProperties = false;
      evidenceCoverage.required = args.knownEvidenceArtifacts;
      evidenceCoverage.properties = Object.fromEntries(
        args.knownEvidenceArtifacts.map((artifactPath) => [
          artifactPath,
          { $ref: "#/$defs/evidenceCoverageEntry" }
        ])
      );
    }

    const nextSafeAction = getJsonObjectProperty(properties, "nextSafeAction");
    if (nextSafeAction) {
      nextSafeAction.enum = args.allowedNextActions;
    }
  }

  const existingAllOf = Array.isArray(schema.allOf) ? schema.allOf : [];
  schema.allOf = [
    ...existingAllOf,
    {
      if: {
        required: ["status"],
        properties: {
          status: { const: "COMPLETED" }
        }
      },
      then: {
        properties: {
          nextSafeAction: {
            enum: args.completedNextSafeActions
          }
        }
      }
    },
    {
      if: {
        required: ["status"],
        properties: {
          status: { const: "PARTIAL" }
        }
      },
      then: {
        properties: {
          nextSafeAction: {
            enum: args.partialNextSafeActions
          }
        }
      }
    },
    {
      if: {
        required: ["status"],
        properties: {
          status: { const: "BLOCKED" }
        }
      },
      then: {
        properties: {
          nextSafeAction: {
            enum: args.blockedNextSafeActions
          }
        }
      }
    }
  ];

  schema["x-blueprint-runtimeContext"] = {
    reportPath: args.reportPath,
    plans: args.plans,
    knownEvidenceArtifacts: args.knownEvidenceArtifacts,
    completedNextSafeActions: args.completedNextSafeActions,
    partialNextSafeActions: args.partialNextSafeActions,
    blockedNextSafeActions: args.blockedNextSafeActions,
    allowedNextActions: args.allowedNextActions
  };

  return schema;
}

async function buildPeerReviewAuthoringContext(args: {
  projectRoot: string;
  phase?: NumericInput;
}): Promise<ReviewAuthoringContextResult> {
  const contract = readArtifactContract("review.peer-review");
  const modelContract = contract.modelContract;
  const baseSchema = modelContract ? cloneJsonObject(modelContract.jsonSchema) : null;
  const located = await blueprintPhaseLocate({
    cwd: args.projectRoot,
    phase: args.phase
  });

  if (
    !located.found ||
    !located.phaseNumber ||
    !located.phasePrefix ||
    !located.phaseDir
  ) {
    const reason = located.reason ?? "Phase could not be resolved for peer-review authoring.";

    return {
      status: "invalid",
      artifact: "peer-review",
      phase: null,
      files: [],
      reviewMode: null,
      schemaPath: modelContract?.schemaPath ?? null,
      baseSchema,
      taskSchema: null,
      modelOnly: true,
      authoringContext: null,
      prerequisiteBlockers: [reason],
      reason,
      warnings: located.warnings
    };
  }

  const phase: ReviewScopePhase = {
    phaseNumber: located.phaseNumber,
    phasePrefix: located.phasePrefix,
    phaseName:
      located.phaseName ??
      `Phase ${located.phasePrefix} ${path.basename(located.phaseDir)}`,
    phaseDir: located.phaseDir,
    resolvedFrom: located.resolvedFrom
  };
  const phaseNumber = located.phaseNumber;
  const reportPath = `${located.phaseDir}/${located.phasePrefix}${REVIEW_ARTIFACT_SUFFIXES["peer-review"]}`;
  const [planIndex, summaryIndex, executionTargets] = await Promise.all([
    blueprintPhasePlanIndex({
      cwd: args.projectRoot,
      phase: phaseNumber
    }),
    blueprintPhaseSummaryIndex({
      cwd: args.projectRoot,
      phase: phaseNumber
    }),
    blueprintPhaseExecutionTargets({
      cwd: args.projectRoot,
      phase: phaseNumber
    })
  ]);
  const planReads = await Promise.all(
    planIndex.plans.map((plan) =>
      blueprintPhasePlanRead({
        cwd: args.projectRoot,
        phase: phaseNumber,
        planId: plan.planId
      })
    )
  );
  const summaryReads = await Promise.all(
    summaryIndex.summaries.map((summary) =>
      blueprintPhaseSummaryRead({
        cwd: args.projectRoot,
        phase: phaseNumber,
        planId: summary.planId
      })
    )
  );
  const blockers: string[] = [];

  if (!modelContract?.schemaPath) {
    blockers.push("review.peer-review does not expose a model schema contract.");
  }

  if (planIndex.plans.length === 0) {
    blockers.push(
      `Phase ${located.phaseNumber} has no saved plan artifacts; run /blu-plan-phase ${located.phaseNumber} before peer review.`
    );
  }

  for (const planRead of planReads) {
    if (!planRead.found || !planRead.path) {
      blockers.push(
        `${planRead.path ?? "A selected plan"} could not be read for peer-review authoring.`
      );
    } else if (!planRead.validation?.valid) {
      const issues = planRead.validation?.issues.length
        ? planRead.validation.issues
        : ["Saved plan artifact is invalid."];
      blockers.push(...issues.map((issue) => `${planRead.path}: ${issue}`));
    }
  }

  const plans = planReads
    .filter((planRead) => planRead.found && planRead.path)
    .map((planRead) => ({
      planId: planRead.planId ?? "",
      path: planRead.path ?? "",
      title: planRead.metadata?.title ?? null
    }))
    .filter((plan) => plan.planId.length > 0 && plan.path.length > 0);
  const knownEvidenceArtifacts = await collectPeerReviewEvidenceArtifacts({
    projectRoot: args.projectRoot,
    planPaths: plans.map((plan) => plan.path),
    artifacts: located.artifacts
  });
  const nextActions = await buildAllowedPeerReviewNextActions({
    phaseNumber,
    pendingPlans: summaryIndex.pendingPlans,
    hasCodeReview: located.artifacts.some((artifactPath) =>
      artifactPath.endsWith(REVIEW_ARTIFACT_SUFFIXES["code-review"])
    )
  });
  const taskSchema =
    blockers.length === 0 && baseSchema && modelContract?.schemaPath
      ? buildPeerReviewTaskSchema({
          baseSchema,
          plans,
          knownEvidenceArtifacts,
          reportPath,
          ...nextActions
        })
      : null;
  const authoringContext: PeerReviewAuthoringContext | null =
    blockers.length === 0 && taskSchema && baseSchema && modelContract?.schemaPath
      ? {
          phase,
          path: reportPath,
          plans,
          knownEvidenceArtifacts,
          pendingPlans: summaryIndex.pendingPlans,
          existingPeerReview:
            located.artifacts.find((artifactPath) =>
              artifactPath.endsWith(REVIEW_ARTIFACT_SUFFIXES["peer-review"])
            ) ?? null,
          ...nextActions,
          schemaPath: modelContract.schemaPath,
          baseSchema,
          taskSchema
        }
      : null;

  return {
    status: blockers.length === 0 ? "ready" : "invalid",
    artifact: "peer-review",
    phase,
    files: [],
    reviewMode: {
      depth: "standard",
      source: "phase-plans"
    },
    schemaPath: modelContract?.schemaPath ?? null,
    baseSchema,
    taskSchema,
    modelOnly: true,
    authoringContext,
    prerequisiteBlockers: blockers,
    reason: blockers.length > 0 ? blockers.join(" ") : null,
    warnings: uniqueSortedStrings([
      ...located.warnings,
      ...planIndex.warnings,
      ...summaryIndex.warnings,
      ...executionTargets.warnings,
      ...summaryReads.flatMap((summaryRead) => summaryRead.validation?.warnings ?? [])
    ])
  };
}

function allowOnlyEmptyArray(schema: Record<string, unknown>): void {
  schema.minItems = 0;
  schema.maxItems = 0;
  delete schema.items;
}

function reviewFixTargetsFromFindings(loaded: ReviewLoadFindingsResult): ReviewFixTarget[] {
  const findingTargets: ReviewFixTarget[] = loaded.findings.map((finding) => ({
    targetId: finding.visibleId ?? finding.stableId ?? finding.id,
    visibleId: finding.visibleId,
    stableId: finding.stableId,
    legacyDerived: finding.legacyDerived,
    source: "finding",
    severity: finding.severity,
    summary: finding.summary,
    sourceSection: finding.sourceSection,
    disposition: finding.disposition,
    location: finding.location?.display ?? null,
    file: finding.file,
    startLine: finding.startLine,
    endLine: finding.endLine,
    evidence: finding.evidence,
    impact: finding.impact,
    recommendation: finding.recommendation,
    classification: finding.classification ?? "fixable",
    defaultEligible: finding.defaultEligible
  }));

  return [...findingTargets, ...loaded.followUpTargets];
}

function resolveReviewFixSelectedTargetIds(args: {
  targets: ReviewFixTarget[];
  targetIds?: string[];
}): { selectedTargetIds: string[]; issues: string[] } {
  const available = new Set(args.targets.map((target) => target.targetId));
  const requested = args.targetIds?.map((targetId) => targetId.trim()).filter(Boolean);
  const selectedTargetIds = requested && requested.length > 0
    ? [...new Set(requested)]
    : args.targets.filter((target) => target.defaultEligible).map((target) => target.targetId);
  const unknown = selectedTargetIds.filter((targetId) => !available.has(targetId));
  const issues: string[] = [];

  if (selectedTargetIds.length === 0) {
    const explicitOnlyTargets = args.targets.filter((target) => !target.defaultEligible);
    issues.push(
      explicitOnlyTargets.length > 0
        ? `review.review-fix default selection found only explicit-only saved review targets: ${explicitOnlyTargets.map((target) => `${target.targetId} (${target.classification})`).join(", ")}. Pass targetIds explicitly.`
        : "review.review-fix requires at least one selected saved review target."
    );
  }
  if (unknown.length > 0) {
    issues.push(`Selected review-fix target ids are not present in the saved review baseline: ${unknown.join(", ")}.`);
  }

  return { selectedTargetIds, issues };
}

async function buildAllowedReviewFixNextActions(args: {
  phaseNumber: string;
  includeExecutionRepairAction: boolean;
}): Promise<{
  completedNextSafeAction: string;
  partialNextSafeActions: string[];
  blockedNextSafeActions: string[];
  blockedRequiredNextSafeAction: string | null;
  allowedNextActions: string[];
}> {
  const completedNextSafeAction = `/blu-validate-phase ${args.phaseNumber}`;
  const executionRepairAction = `/blu-execute-phase ${args.phaseNumber}`;
  const partialCandidates = [
    ...(args.includeExecutionRepairAction ? [executionRepairAction] : []),
    `/blu-code-review-fix ${args.phaseNumber}`,
    `/blu-add-tests ${args.phaseNumber}`
  ];
  const blockedCandidates = [
    ...(args.includeExecutionRepairAction ? [executionRepairAction] : []),
    "/blu-progress"
  ];
  const implementedCommands = await getImplementedCommandNames();
  const keepImplemented = (candidate: string): boolean => {
    if (implementedCommands === null || implementedCommands.size === 0) {
      return true;
    }

    return extractBlueprintDirectCommands(candidate).every((command) =>
      implementedCommands.has(command)
    );
  };
  const partialNextSafeActions = partialCandidates.filter(keepImplemented);
  const blockedNextSafeActions = blockedCandidates.filter(keepImplemented);
  const blockedRequiredNextSafeAction =
    args.includeExecutionRepairAction && blockedNextSafeActions.includes(executionRepairAction)
      ? executionRepairAction
      : null;
  const completedAction = keepImplemented(completedNextSafeAction)
    ? completedNextSafeAction
    : "/blu-progress";

  return {
    completedNextSafeAction: completedAction,
    partialNextSafeActions,
    blockedNextSafeActions,
    blockedRequiredNextSafeAction,
    allowedNextActions: uniqueSortedStrings([
      completedAction,
      ...partialNextSafeActions,
      ...blockedNextSafeActions
    ])
  };
}

function dependencyPlanRowsForReviewFix(
  dependsOn: string[],
  phasePrefix: string,
  phaseDir: string,
  knownPlanIds: Set<string>
): Array<{ planId: string; path: string }> {
  return dependsOn.flatMap((dependency) => {
    const trimmed = dependency.trim();
    const candidates = [
      trimmed,
      /^\d+$/.test(trimmed) ? trimmed.padStart(2, "0") : trimmed,
      trimmed.replace(/^0+(?=\d)/, "")
    ];
    const normalized = candidates.find((candidate) => knownPlanIds.has(candidate));

    if (!normalized || !/^\d+(?:\.\d+)?$/.test(normalized)) {
      return [];
    }

    const dependencyPrefix = `${phasePrefix}-${normalized}`;

    return [{
      planId: normalized,
      path: `${phaseDir}/${dependencyPrefix}-PLAN.md`
    }];
  });
}

function reviewFixEvidenceKindForSource(source: string): "review" | "plan" | "summary" | "other" {
  if (source.endsWith(REVIEW_ARTIFACT_SUFFIXES["code-review"])) {
    return "review";
  }
  if (source.endsWith("-PLAN.md")) {
    return "plan";
  }
  if (source.endsWith("-SUMMARY.md")) {
    return "summary";
  }

  return "other";
}

async function buildReviewFixTaskSchema(args: {
  baseSchema: Record<string, unknown>;
  targets: ReviewFixTarget[];
  selectedTargetIds: string[];
  dependencyPlans: Array<{ planId: string; path: string }>;
  executionDebt: ReviewFixExecutionDebt;
  knownEvidenceArtifacts: string[];
  allowCompleted: boolean;
  completedNextSafeAction: string;
  partialNextSafeActions: string[];
  blockedNextSafeActions: string[];
  blockedRequiredNextSafeAction: string | null;
  allowedNextActions: string[];
}): Promise<Record<string, unknown>> {
  const schema = cloneJsonObject(args.baseSchema);
  const properties = getJsonObjectProperty(schema, "properties");

  if (properties) {
    const status = getJsonObjectProperty(properties, "status");
    if (status && !args.allowCompleted) {
      status.enum = ["PARTIAL", "BLOCKED"];
    }

    const findingsAddressed = getJsonObjectProperty(properties, "findingsAddressed");
    if (findingsAddressed) {
      findingsAddressed.minItems = args.selectedTargetIds.length;
      findingsAddressed.maxItems = args.selectedTargetIds.length;
      const items = getJsonObjectProperty(findingsAddressed, "items");
      const itemProperties = items ? getJsonObjectProperty(items, "properties") : null;
      const findingId = itemProperties ? getJsonObjectProperty(itemProperties, "findingId") : null;
      if (findingId) {
        findingId.enum = args.selectedTargetIds;
      }
      findingsAddressed.allOf = args.selectedTargetIds.map((targetId) =>
        exactObjectPropertyContains("findingId", targetId)
      );
    }

    const dependencyPlans = getJsonObjectProperty(properties, "dependencyPlans");
    if (dependencyPlans) {
      if (args.dependencyPlans.length === 0) {
        allowOnlyEmptyArray(dependencyPlans);
      } else {
        dependencyPlans.minItems = args.dependencyPlans.length;
        dependencyPlans.maxItems = args.dependencyPlans.length;
        const items = getJsonObjectProperty(dependencyPlans, "items");
        const itemProperties = items ? getJsonObjectProperty(items, "properties") : null;
        const planId = itemProperties ? getJsonObjectProperty(itemProperties, "planId") : null;
        const pathProperty = itemProperties ? getJsonObjectProperty(itemProperties, "path") : null;
        const statusProperty = itemProperties ? getJsonObjectProperty(itemProperties, "status") : null;
        const unsatisfiedDependencyIds = new Set(
          args.executionDebt.unsatisfiedDependencyPlans.map((dependency) => dependency.planId)
        );
        if (planId) {
          planId.enum = args.dependencyPlans.map((dependency) => dependency.planId);
        }
        if (pathProperty) {
          pathProperty.enum = args.dependencyPlans.map((dependency) => dependency.path);
        }
        if (statusProperty) {
          statusProperty.enum = args.allowCompleted
            ? ["satisfied"]
            : ["satisfied", "pending", "blocked"];
        }
        dependencyPlans.allOf = args.dependencyPlans.map((dependency) => ({
          contains: {
            type: "object",
            required: ["planId", "path", "status"],
            properties: {
              planId: { const: dependency.planId },
              path: { const: dependency.path },
              status: unsatisfiedDependencyIds.has(dependency.planId)
                ? { enum: ["pending", "blocked"] }
                : { const: "satisfied" }
            }
          },
          minContains: 1,
          maxContains: 1
        }));
      }
    }

    const evidence = getJsonObjectProperty(properties, "evidence");
    if (evidence) {
      evidence.minItems = args.knownEvidenceArtifacts.length;
      delete evidence.maxItems;
      const upstreamEvidenceByKind = {
        review: args.knownEvidenceArtifacts.filter(
          (artifactPath) => reviewFixEvidenceKindForSource(artifactPath) === "review"
        ),
        plan: args.knownEvidenceArtifacts.filter(
          (artifactPath) => reviewFixEvidenceKindForSource(artifactPath) === "plan"
        ),
        summary: args.knownEvidenceArtifacts.filter(
          (artifactPath) => reviewFixEvidenceKindForSource(artifactPath) === "summary"
        )
      };
      const items = getJsonObjectProperty(evidence, "items");
      if (items) {
        items.allOf = [
          ...(Array.isArray(items.allOf) ? items.allOf : []),
          ...Object.entries(upstreamEvidenceByKind).map(([kind, sources]) => ({
            if: {
              required: ["kind"],
              properties: {
                kind: { const: kind }
              }
            },
            then: {
              properties: {
                source: { enum: sources }
              }
            }
          })),
          {
            if: {
              required: ["source"],
              properties: {
                source: { pattern: "^\\.blueprint/.+-(?:REVIEW|PLAN|SUMMARY)\\.md$" }
              }
            },
            then: {
              properties: {
                source: { enum: args.knownEvidenceArtifacts }
              }
            }
          },
          ...args.knownEvidenceArtifacts.map((artifactPath) => ({
            if: {
              required: ["source"],
              properties: {
                source: { const: artifactPath }
              }
            },
            then: {
              properties: {
                kind: { const: reviewFixEvidenceKindForSource(artifactPath) }
              }
            }
          }))
        ];
      }
      evidence.allOf = args.knownEvidenceArtifacts.map((artifactPath) =>
        ({
          contains: {
            type: "object",
            required: ["kind", "source"],
            properties: {
              kind: { const: reviewFixEvidenceKindForSource(artifactPath) },
              source: { const: artifactPath }
            }
          },
          minContains: 1,
          maxContains: 1
        })
      );
    }

    const nextSafeAction = getJsonObjectProperty(properties, "nextSafeAction");
    if (nextSafeAction) {
      nextSafeAction.enum = args.allowedNextActions;
    }
  }

  const existingAllOf = Array.isArray(schema.allOf) ? schema.allOf : [];
  schema.allOf = [
    ...existingAllOf,
    {
      if: {
        required: ["status"],
        properties: {
          status: { const: "COMPLETED" }
        }
      },
      then: {
        properties: {
          nextSafeAction: { const: args.completedNextSafeAction }
        }
      }
    },
    {
      if: {
        required: ["status"],
        properties: {
          status: { const: "PARTIAL" }
        }
      },
      then: {
        properties: {
          nextSafeAction: { enum: args.partialNextSafeActions }
        }
      }
    },
    {
      if: {
        required: ["status"],
        properties: {
          status: { const: "BLOCKED" }
        }
      },
      then: {
        properties: {
          nextSafeAction: args.blockedRequiredNextSafeAction
            ? { const: args.blockedRequiredNextSafeAction }
            : { enum: args.blockedNextSafeActions }
        }
      }
    }
  ];

  schema["x-blueprint-runtimeContext"] = {
    targets: args.targets,
    selectedTargetIds: args.selectedTargetIds,
    dependencyPlans: args.dependencyPlans,
    knownEvidenceArtifacts: args.knownEvidenceArtifacts,
    executionDebt: args.executionDebt,
    allowCompleted: args.allowCompleted,
    completedNextSafeAction: args.completedNextSafeAction,
    partialNextSafeActions: args.partialNextSafeActions,
    blockedNextSafeActions: args.blockedNextSafeActions,
    blockedRequiredNextSafeAction: args.blockedRequiredNextSafeAction
  };

  return schema;
}

async function buildReviewFixAuthoringContext(args: {
  projectRoot: string;
  phase?: NumericInput;
  targetIds?: string[];
}): Promise<ReviewAuthoringContextResult> {
  const located = await blueprintPhaseLocate({
    cwd: args.projectRoot,
    phase: args.phase
  });
  const modelContract = readArtifactContract("review.review-fix").modelContract;
  const baseSchema = modelContract ? cloneJsonObject(modelContract.jsonSchema) : null;

  if (
    !located.found ||
    !located.phaseNumber ||
    !located.phasePrefix ||
    !located.phaseDir
  ) {
    const reason = located.reason ?? "Phase could not be resolved for review-fix authoring.";

    return {
      status: "invalid",
      artifact: "review-fix",
      phase: null,
      files: [],
      reviewMode: null,
      schemaPath: modelContract?.schemaPath ?? null,
      baseSchema,
      taskSchema: null,
      modelOnly: true,
      authoringContext: null,
      prerequisiteBlockers: [reason],
      reason,
      warnings: located.warnings
    };
  }

  if (!modelContract || !modelContract.schemaPath) {
    const reason = "review.review-fix does not expose a modelContract schema path.";

    return {
      status: "invalid",
      artifact: "review-fix",
      phase: null,
      files: [],
      reviewMode: null,
      schemaPath: modelContract?.schemaPath ?? null,
      baseSchema,
      taskSchema: null,
      modelOnly: true,
      authoringContext: null,
      prerequisiteBlockers: [reason],
      reason,
      warnings: located.warnings
    };
  }

  const phaseNumber = located.phaseNumber;
  const phase: ReviewScopePhase = {
    phaseNumber,
    phasePrefix: located.phasePrefix,
    phaseName:
      located.phaseName ??
      `Phase ${located.phasePrefix} ${path.basename(located.phaseDir)}`,
    phaseDir: located.phaseDir,
    resolvedFrom: located.resolvedFrom
  };
  const loaded = await blueprintReviewLoadFindings({
    cwd: args.projectRoot,
    phase: phaseNumber,
    artifact: "code-review"
  });
  const hardBlockers: string[] = [];

  if (!loaded.found || !loaded.path) {
    hardBlockers.push(
      loaded.reason ??
      `Phase ${phaseNumber} does not have a saved code-review artifact for review-fix authoring.`
    );
  }

  const targets = reviewFixTargetsFromFindings(loaded);
  if (targets.length === 0) {
    hardBlockers.push(
      `Phase ${phaseNumber} saved code-review artifact does not contain structured findings or follow-ups to remediate.`
    );
  }

  const selected = resolveReviewFixSelectedTargetIds({
    targets,
    targetIds: args.targetIds
  });
  hardBlockers.push(...selected.issues);

  const [planIndex, summaryIndex, executionTargets] = await Promise.all([
    blueprintPhasePlanIndex({
      cwd: args.projectRoot,
      phase: phaseNumber
    }),
    blueprintPhaseSummaryIndex({
      cwd: args.projectRoot,
      phase: phaseNumber
    }),
    blueprintPhaseExecutionTargets({
      cwd: args.projectRoot,
      phase: phaseNumber
    })
  ]);
  const planReads = await Promise.all(
    planIndex.plans.map((plan) =>
      blueprintPhasePlanRead({
        cwd: args.projectRoot,
        phase: phaseNumber,
        planId: plan.planId
      })
    )
  );
  const summaryReads = await Promise.all(
    summaryIndex.completedPlans.map((planId) =>
      blueprintPhaseSummaryRead({
        cwd: args.projectRoot,
        phase: phaseNumber,
        planId
      })
    )
  );
  const knownPlanIds = new Set(planIndex.plans.map((plan) => plan.planId));
  const dependencyPlans = uniqueSortedStrings(
    planReads.flatMap((planRead) =>
      planRead.found && planRead.metadata
        ? dependencyPlanRowsForReviewFix(
            planRead.metadata.dependsOn,
            located.phasePrefix!,
            located.phaseDir!,
            knownPlanIds
          ).map((dependency) => `${dependency.planId}\t${dependency.path}`)
        : []
    )
  ).map((entry) => {
    const [planId, dependencyPath] = entry.split("\t");
    return { planId, path: dependencyPath };
  });
  const completedSummaries = summaryReads
    .filter((summaryRead) => summaryRead.found && summaryRead.path && summaryRead.validation?.valid)
    .map((summaryRead) => summaryRead.path!)
    .sort((left, right) => left.localeCompare(right));
  const completedDependencyPlanIds = new Set(summaryIndex.completedPlans);
  const unsatisfiedDependencyPlans = dependencyPlans.filter(
    (dependency) => !completedDependencyPlanIds.has(dependency.planId)
  );
  const executionDebtBlockers: string[] = [];

  if (summaryIndex.pendingPlans.length > 0) {
    executionDebtBlockers.push(
      `Phase ${phaseNumber} still has pending execution plans: ${summaryIndex.pendingPlans.join(", ")}. Run /blu-execute-phase ${phaseNumber} before persisting review-fix completion evidence.`
    );
  }

  if (completedSummaries.length === 0) {
    executionDebtBlockers.push(
      `Phase ${phaseNumber} has no valid completed SUMMARY artifacts. Run /blu-execute-phase ${phaseNumber} before persisting review-fix evidence.`
    );
  }

  if (executionTargets.blockers.lowerWavePendingPlanIds.length > 0) {
    executionDebtBlockers.push(
      `Lower-wave pending plans block full review-fix coverage: ${executionTargets.blockers.lowerWavePendingPlanIds.join(", ")}.`
    );
  }

  if (unsatisfiedDependencyPlans.length > 0) {
    executionDebtBlockers.push(
      `Linked dependency plan summaries are not completed yet: ${unsatisfiedDependencyPlans
        .map((dependency) => `${dependency.planId} (${dependency.path})`)
        .join(", ")}.`
    );
  }

  const existingReviewFix =
    located.artifacts.find((artifact) =>
      artifact.endsWith(REVIEW_ARTIFACT_SUFFIXES["review-fix"])
    ) ?? null;
  const knownEvidenceArtifacts = uniqueSortedStrings([
    ...(loaded.path ? [loaded.path] : []),
    ...planIndex.plans.map((plan) => plan.path),
    ...completedSummaries
  ]);
  const executionDebt: ReviewFixExecutionDebt = {
    pendingPlans: summaryIndex.pendingPlans,
    lowerWavePendingPlanIds: executionTargets.blockers.lowerWavePendingPlanIds,
    missingCompletedSummaries: completedSummaries.length === 0,
    unsatisfiedDependencyPlans,
    blockers: executionDebtBlockers
  };
  const allowCompleted = executionDebt.blockers.length === 0;
  const nextActions = await buildAllowedReviewFixNextActions({
    phaseNumber,
    includeExecutionRepairAction: !allowCompleted
  });
  const reviewFixBaseSchema = cloneJsonObject(modelContract.jsonSchema);
  const taskSchema =
    hardBlockers.length === 0 && loaded.path
      ? await buildReviewFixTaskSchema({
          baseSchema: reviewFixBaseSchema,
          targets,
          selectedTargetIds: selected.selectedTargetIds,
          dependencyPlans,
          executionDebt,
          knownEvidenceArtifacts,
          allowCompleted,
          ...nextActions
        })
      : null;
  const authoringContext: ReviewFixAuthoringContext | null = taskSchema && loaded.path
    ? {
        phase,
        path: `${located.phaseDir}/${located.phasePrefix}${REVIEW_ARTIFACT_SUFFIXES["review-fix"]}`,
        sourceReviewPath: loaded.path,
        targets,
        selectedTargetIds: selected.selectedTargetIds,
        completedSummaries,
        dependencyPlans,
        executionDebt,
        knownEvidenceArtifacts,
        existingReviewFix,
        allowCompleted,
        ...nextActions,
        schemaPath: modelContract.schemaPath,
        baseSchema: reviewFixBaseSchema,
        taskSchema
      }
    : null;

  return {
    status: hardBlockers.length === 0 ? "ready" : "invalid",
    artifact: "review-fix",
    phase,
    files: [],
    reviewMode: null,
    schemaPath: modelContract.schemaPath,
    baseSchema: reviewFixBaseSchema,
    taskSchema,
    modelOnly: true,
    authoringContext,
    prerequisiteBlockers: hardBlockers,
    reason: hardBlockers.length > 0 ? hardBlockers.join(" ") : null,
    warnings: uniqueSortedStrings([
      ...located.warnings,
      ...loaded.warnings,
      ...planIndex.warnings,
      ...summaryIndex.warnings,
      ...executionTargets.warnings
    ])
  };
}

function uniqueSortedStrings(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function uniqueOrderedStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function exactObjectPropertyContains(
  propertyName: string,
  value: string
): Record<string, unknown> {
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

function exactArraySentinel(schema: Record<string, unknown>): Record<string, unknown> {
  return {
    minItems: 1,
    maxItems: 1,
    items: schema
  };
}

function canonicalNoneTableRow(width: number): string[] {
  return Array.from({ length: width }, () => "none");
}

async function buildAllowedSecurityNextActions(args: {
  phaseNumber: string;
  artifacts: {
    verification: string | null;
    uat: string | null;
  };
}): Promise<{
  completedNextSafeAction: string;
  partialNextSafeAction: string;
  blockedNextSafeAction: string;
  allowedNextActions: string[];
}> {
  const completedCandidate =
    args.artifacts.verification === null
      ? `/blu-validate-phase ${args.phaseNumber}`
      : args.artifacts.uat === null
        ? `/blu-verify-work ${args.phaseNumber}`
        : "/blu-progress";
  const partialCandidate = "/blu-progress";
  const blockedNextSafeAction = "Blocked: pending-open-threat";
  const implementedCommands = await getImplementedCommandNames();
  const implementedOrProgress = (candidate: string): string => {
    if (implementedCommands === null || implementedCommands.size === 0) {
      return candidate;
    }

    const commands = extractBlueprintDirectCommands(candidate);

    return commands.length > 0 && commands.every((command) => implementedCommands.has(command))
      ? candidate
      : "/blu-progress";
  };
  const completedNextSafeAction = implementedOrProgress(completedCandidate);
  const partialNextSafeAction = implementedOrProgress(partialCandidate);

  return {
    completedNextSafeAction,
    partialNextSafeAction,
    blockedNextSafeAction,
    allowedNextActions: uniqueSortedStrings([
      completedNextSafeAction,
      partialNextSafeAction,
      blockedNextSafeAction
    ])
  };
}

function splitMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim();
  const withoutLeadingPipe = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const withoutOuterPipes = withoutLeadingPipe.endsWith("|")
    ? withoutLeadingPipe.slice(0, -1)
    : withoutLeadingPipe;
  const cells: string[] = [];
  let current = "";

  for (let index = 0; index < withoutOuterPipes.length; index += 1) {
    const char = withoutOuterPipes[index];
    const next = withoutOuterPipes[index + 1];

    if (char === "\\" && next === "|") {
      current += "|";
      index += 1;
      continue;
    }

    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());

  return cells;
}

function isMarkdownTableSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseMarkdownTableRows(section: string): string[][] {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"))
    .map(splitMarkdownTableRow)
    .filter((cells) => cells.length > 0)
    .filter((cells) => !isMarkdownTableSeparatorRow(cells));
}

function normalizeThreatCell(value: string, fallback: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeThreatId(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .replace(/`/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : fallback;
}

function isThreatIdSentinel(value: string): boolean {
  const normalized = value
    .trim()
    .replace(/^`+|`+$/g, "")
    .replace(/\s+/g, " ");

  return /^(?:none|n\/a|na)$/i.test(normalized);
}

function looksLikeExplicitThreatId(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9._-]*-\d[A-Za-z0-9._-]*$/.test(
    value.trim().replace(/^`+|`+$/g, "")
  );
}

function extractThreatModelContent(content: string): string[] {
  const blockSections = [...content.matchAll(/<threat_model\b[^>]*>([\s\S]*?)<\/threat_model>/gi)]
    .map((match) => match[1]?.trim() ?? "")
    .filter((section) => section.length > 0);

  if (blockSections.length > 0) {
    return blockSections;
  }

  return extractMarkdownSectionContent(
    content,
    /^(?:threat model|threat register|security threats?|security model)$/i
  );
}

function planThreatIdPrefix(sourcePlan: string): string {
  return sourcePlan.match(/(?:^|\/)(\d+(?:-\d+)*)-PLAN\.md$/)?.[1] ?? "plan";
}

function disambiguateDeclaredThreatIds(threats: SecurityDeclaredThreat[]): SecurityDeclaredThreat[] {
  const seen = new Set<string>();

  return threats.map((threat) => {
    if (!seen.has(threat.threatId)) {
      seen.add(threat.threatId);
      return threat;
    }

    const baseThreatId = `${planThreatIdPrefix(threat.sourcePlan)}-${threat.threatId}`;
    let uniqueThreatId = baseThreatId;
    let suffix = 2;

    while (seen.has(uniqueThreatId)) {
      uniqueThreatId = `${baseThreatId}-${suffix}`;
      suffix += 1;
    }

    seen.add(uniqueThreatId);

    return {
      ...threat,
      threatId: uniqueThreatId
    };
  });
}

function parseThreatRowsFromPlanContent(content: string, sourcePlan: string): SecurityDeclaredThreat[] {
  const sections = extractThreatModelContent(content);
  const threats: SecurityDeclaredThreat[] = [];

  for (const section of sections) {
    const tableRows = parseMarkdownTableRows(section);

    if (tableRows.length > 0) {
      const header = tableRows[0].map((cell) =>
        cell.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
      );
      const rows = header.some((cell) => cell === "threat id" || cell === "id")
        ? tableRows.slice(1)
        : tableRows;
      const findIndex = (patterns: RegExp[], fallback: number): number => {
        const index = header.findIndex((cell) => patterns.some((pattern) => pattern.test(cell)));
        return index >= 0 ? index : fallback;
      };
      const threatIdIndex = findIndex([/^(?:threat )?id$/], 0);
      const categoryIndex = findIndex([/^category$/, /^stride$/], 1);
      const componentIndex = findIndex([/^component$/, /^surface$/, /^boundary$/], 2);
      const dispositionIndex = findIndex([/^disposition$/, /^decision$/], 3);
      const mitigationIndex = findIndex([/^mitigation$/, /^control$/, /^evidence$/], 4);

      rows.forEach((row, index) => {
        const fallbackId = `T-${String(threats.length + index + 1).padStart(2, "0")}`;
        const rawThreatId = row[threatIdIndex] ?? "";

        if (isThreatIdSentinel(rawThreatId)) {
          return;
        }

        const threatId = normalizeThreatId(rawThreatId, fallbackId);

        threats.push({
          threatId,
          sourcePlan,
          category: normalizeThreatCell(row[categoryIndex] ?? "", "unspecified"),
          component: normalizeThreatCell(row[componentIndex] ?? "", "unspecified"),
          disposition: normalizeThreatCell(row[dispositionIndex] ?? "", "mitigate"),
          mitigation: normalizeThreatCell(row[mitigationIndex] ?? "", "No mitigation text found in the saved plan.")
        });
      });

      continue;
    }

    const bullets = collectListItems(section);
    bullets.forEach((item, index) => {
      const rawMatch = item.match(/^`?([^`:\-]+?)`?\s*[:\-]\s*(.+)$/);

      if (rawMatch && isThreatIdSentinel(rawMatch[1])) {
        return;
      }

      if (!rawMatch && isThreatIdSentinel(item)) {
        return;
      }

      const match = item.match(/^`?([A-Za-z0-9._-]+)`?\s*[:\-]\s*(.+)$/);
      const threatId = normalizeThreatId(match?.[1] ?? "", `T-${String(index + 1).padStart(2, "0")}`);
      const mitigation = normalizeThreatCell(match?.[2] ?? item, "No mitigation text found in the saved plan.");

      if (match && isThreatIdSentinel(match[1])) {
        return;
      }

      threats.push({
        threatId,
        sourcePlan,
        category: "unspecified",
        component: "unspecified",
        disposition: "mitigate",
        mitigation
      });
    });
  }

  return disambiguateDeclaredThreatIds(threats);
}

function normalizeMarkdownHeaderCell(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findHeaderIndex(headers: string[], patterns: RegExp[]): number {
  return headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
}

function parsePotentialThreatFlagId(value: string, headerImpliesThreatId: boolean): string | null {
  const raw = value.trim();

  if (raw.length === 0 || isThreatIdSentinel(raw)) {
    return null;
  }

  if (!headerImpliesThreatId && !looksLikeExplicitThreatId(raw)) {
    return null;
  }

  const normalized = normalizeThreatId(raw, "");

  return normalized.length > 0 ? normalized : null;
}

function parseThreatFlagsFromSummaryContent(
  content: string,
  sourceSummary: string
): SecuritySummaryThreatFlag[] {
  const flags: SecuritySummaryThreatFlag[] = [];

  for (const section of extractMarkdownSectionContent(content, /^Threat Flags?$/i)) {
    const tableRows = parseMarkdownTableRows(section);

    if (tableRows.length > 0) {
      const header = tableRows[0].map(normalizeMarkdownHeaderCell);
      const hasHeader = header.some((cell) =>
        /^(?:threat id|id|flag|finding|evidence|summary|description|status)$/.test(cell)
      );
      const rows = hasHeader ? tableRows.slice(1) : tableRows;
      const threatIdIndex = hasHeader
        ? findHeaderIndex(header, [/^(?:threat )?id$/])
        : -1;
      const evidenceIndex = hasHeader
        ? findHeaderIndex(header, [/^flag$/, /^finding$/, /^evidence$/, /^summary$/, /^description$/, /^notes?$/])
        : -1;

      rows.forEach((row) => {
        if (row.every((cell) => isPlaceholderReviewListItem(cell))) {
          return;
        }

        const fallbackEvidence = row.filter((cell) => cell.trim().length > 0).join(" | ");
        const evidence = normalizeThreatCell(
          row[evidenceIndex >= 0 ? evidenceIndex : threatIdIndex >= 0 ? Math.min(threatIdIndex + 1, row.length - 1) : 0] ??
            fallbackEvidence,
          fallbackEvidence
        );
        const threatId = parsePotentialThreatFlagId(
          threatIdIndex >= 0 ? row[threatIdIndex] ?? "" : row[0] ?? "",
          threatIdIndex >= 0
        );

        if (evidence.length === 0 || isPlaceholderReviewListItem(evidence)) {
          return;
        }

        flags.push({
          flagId: `${sourceSummary}#TF-${String(flags.length + 1).padStart(2, "0")}`,
          sourceSummary,
          threatId,
          evidence
        });
      });

      continue;
    }

    for (const item of collectListItems(section)) {
      if (isPlaceholderReviewListItem(item)) {
        continue;
      }

      const match =
        item.match(/^`?([A-Za-z][A-Za-z0-9._-]*-\d[A-Za-z0-9._-]*)`?\s*[:\-]\s*(.+)$/) ??
        item.match(/^(?:threat\s+)?`?([A-Za-z][A-Za-z0-9._-]*-\d[A-Za-z0-9._-]*)`?\s*[:\-]\s*(.+)$/i);
      const threatId = match ? parsePotentialThreatFlagId(match[1], false) : null;
      const evidence = normalizeThreatCell(match?.[2] ?? item, item);

      flags.push({
        flagId: `${sourceSummary}#TF-${String(flags.length + 1).padStart(2, "0")}`,
        sourceSummary,
        threatId,
        evidence
      });
    }
  }

  return flags;
}

function buildSecurityTaskSchema(args: {
  baseSchema: Record<string, unknown>;
  declaredThreats: SecurityDeclaredThreat[];
  summaryThreatFlags: SecuritySummaryThreatFlag[];
  knownEvidenceArtifacts: string[];
  allowedNextActions: string[];
  completedNextSafeAction: string;
  partialNextSafeAction: string;
  blockedNextSafeAction: string;
  allowCompleted: boolean;
}): Record<string, unknown> {
  const schema = cloneJsonObject(args.baseSchema);
  const properties = getJsonObjectProperty(schema, "properties");
  const defs = getJsonObjectProperty(schema, "$defs");

  if (properties) {
    const status = getJsonObjectProperty(properties, "status");
    if (status && !args.allowCompleted) {
      status.enum = ["PARTIAL", "BLOCKED"];
    }

    const evidenceCoverage = getJsonObjectProperty(properties, "evidenceCoverage");
    if (evidenceCoverage) {
      evidenceCoverage.additionalProperties = { $ref: "#/$defs/evidenceCoverageEntry" };
      delete evidenceCoverage.required;
      evidenceCoverage.properties = Object.fromEntries(
        args.knownEvidenceArtifacts.map((artifactPath) => [
          artifactPath,
          { $ref: "#/$defs/evidenceCoverageEntry" }
        ])
      );
      evidenceCoverage.description =
        "Coverage decisions for evidence artifacts. Prefer exact keys from blueprint_review_authoring_context.authoringContext.knownEvidenceArtifacts; missing or extra bookkeeping is warning-only unless the artifact is directly cited elsewhere in the model.";
    }

    const threatRegister = getJsonObjectProperty(properties, "threatRegister");
    if (threatRegister) {
      if (args.declaredThreats.length === 0) {
        threatRegister.minItems = 0;
        threatRegister.maxItems = 1;
        threatRegister.items = { $ref: "#/$defs/noThreatRow" };
      } else {
        threatRegister.minItems = args.declaredThreats.length;
        threatRegister.maxItems = args.declaredThreats.length;
        const items = getJsonObjectProperty(threatRegister, "items");
        const oneOf = Array.isArray(items?.oneOf) ? items.oneOf : null;
        const realThreatRow = oneOf
          ? oneOf.find((candidate) => asJsonObject(candidate)?.$ref === "#/$defs/threatRegisterRow")
          : null;
        const threatRowSchema = asJsonObject(realThreatRow);
        const threatRow = threatRowSchema
          ? getJsonObjectProperty(defs ?? {}, "threatRegisterRow")
          : getJsonObjectProperty(defs ?? {}, "threatRegisterRow");
        const threatProperties = threatRow ? getJsonObjectProperty(threatRow, "properties") : null;
        const threatId = threatProperties ? getJsonObjectProperty(threatProperties, "threatId") : null;

        if (threatId) {
          threatId.enum = args.declaredThreats.map((threat) => threat.threatId);
        }
        threatRegister.allOf = args.declaredThreats.map((threat) =>
          exactObjectPropertyContains("threatId", threat.threatId)
        );
      }
    }

    const acceptedRisks = getJsonObjectProperty(properties, "acceptedRisks");
    const findings = getJsonObjectProperty(properties, "findings");
    const threatIdEnum = args.declaredThreats.map((threat) => threat.threatId);

    for (const definitionName of ["acceptedRiskRow", "findingRow"] as const) {
      const definition = getJsonObjectProperty(defs ?? {}, definitionName);
      const definitionProperties = definition ? getJsonObjectProperty(definition, "properties") : null;
      const threatId = definitionProperties ? getJsonObjectProperty(definitionProperties, "threatId") : null;

      if (threatId && threatIdEnum.length > 0) {
        threatId.enum = definitionName === "findingRow"
          ? [...threatIdEnum, "unregistered"]
          : threatIdEnum;
      } else if (threatId && definitionName === "findingRow") {
        threatId.enum = ["unregistered"];
      }
    }

    if (acceptedRisks && threatIdEnum.length === 0) {
      acceptedRisks.minItems = 0;
      acceptedRisks.maxItems = 1;
      acceptedRisks.items = { $ref: "#/$defs/noAcceptedRiskRow" };
    }

    const nextSafeAction = getJsonObjectProperty(properties, "nextSafeAction");
    if (nextSafeAction) {
      nextSafeAction.enum = args.allowedNextActions;
    }
  }

  const existingAllOf = Array.isArray(schema.allOf) ? schema.allOf : [];
  schema.allOf = [
    ...existingAllOf,
    {
      if: {
        required: ["status"],
        properties: {
          status: { const: "COMPLETED" }
        }
      },
      then: {
        properties: {
          nextSafeAction: { const: args.completedNextSafeAction }
        }
      }
    },
    {
      if: {
        required: ["status"],
        properties: {
          status: { const: "PARTIAL" }
        }
      },
      then: {
        properties: {
          nextSafeAction: { const: args.partialNextSafeAction }
        }
      }
    },
    {
      if: {
        required: ["status"],
        properties: {
          status: { const: "BLOCKED" }
        }
      },
      then: {
        properties: {
          nextSafeAction: { const: args.blockedNextSafeAction }
        }
      }
    }
  ];

  schema["x-blueprint-runtimeContext"] = {
    declaredThreats: args.declaredThreats,
    summaryThreatFlags: args.summaryThreatFlags,
    knownEvidenceArtifacts: args.knownEvidenceArtifacts,
    completedNextSafeAction: args.completedNextSafeAction,
    partialNextSafeAction: args.partialNextSafeAction,
    blockedNextSafeAction: args.blockedNextSafeAction,
    allowCompleted: args.allowCompleted
  };

  return schema;
}

async function buildSecurityAuthoringContext(args: {
  projectRoot: string;
  phase?: NumericInput;
}): Promise<ReviewAuthoringContextResult> {
  const located = await blueprintPhaseLocate({
    cwd: args.projectRoot,
    phase: args.phase
  });
  const modelContract = readArtifactContract("review.security").modelContract;
  const baseSchema = modelContract ? cloneJsonObject(modelContract.jsonSchema) : null;

  if (
    !located.found ||
    !located.phaseNumber ||
    !located.phasePrefix ||
    !located.phaseDir
  ) {
    const reason = located.reason ?? "Phase could not be resolved for security authoring.";

    return {
      status: "invalid",
      artifact: "security",
      phase: null,
      files: [],
      reviewMode: null,
      schemaPath: modelContract?.schemaPath ?? null,
      baseSchema,
      taskSchema: null,
      modelOnly: true,
      authoringContext: null,
      prerequisiteBlockers: [reason],
      reason,
      warnings: located.warnings
    };
  }

  if (!modelContract || !modelContract.schemaPath) {
    const reason = "review.security does not expose a modelContract schema path.";

    return {
      status: "invalid",
      artifact: "security",
      phase: null,
      files: [],
      reviewMode: null,
      schemaPath: modelContract?.schemaPath ?? null,
      baseSchema,
      taskSchema: null,
      modelOnly: true,
      authoringContext: null,
      prerequisiteBlockers: [reason],
      reason,
      warnings: located.warnings
    };
  }

  const phaseNumber = located.phaseNumber;
  const securityBaseSchema = cloneJsonObject(modelContract.jsonSchema);
  const phase: ReviewScopePhase = {
    phaseNumber,
    phasePrefix: located.phasePrefix,
    phaseName:
      located.phaseName ??
      `Phase ${located.phasePrefix} ${path.basename(located.phaseDir)}`,
    phaseDir: located.phaseDir,
    resolvedFrom: located.resolvedFrom
  };
  const artifacts = {
    plans: located.artifacts
      .filter((artifact) => artifact.endsWith("-PLAN.md"))
      .sort((left, right) => left.localeCompare(right)),
    summaries: located.artifacts
      .filter((artifact) => artifact.endsWith("-SUMMARY.md"))
      .sort((left, right) => left.localeCompare(right)),
    verification: findPhaseArtifact(located.artifacts, "-VERIFICATION.md"),
    uat: findPhaseArtifact(located.artifacts, "-UAT.md"),
    existingSecurity: findPhaseArtifact(located.artifacts, "-SECURITY.md")
  };
  const [planIndex, summaryIndex, executionTargets] = await Promise.all([
    blueprintPhasePlanIndex({
      cwd: args.projectRoot,
      phase: phaseNumber
    }),
    blueprintPhaseSummaryIndex({
      cwd: args.projectRoot,
      phase: phaseNumber
    }),
    blueprintPhaseExecutionTargets({
      cwd: args.projectRoot,
      phase: phaseNumber
    })
  ]);
  const completedSummaries = summaryIndex.summaries
    .filter((summary) => summaryIndex.completedPlans.includes(summary.planId))
    .map((summary) => summary.path)
    .sort((left, right) => left.localeCompare(right));
  const completionWarnings: string[] = [];

  if (planIndex.plans.length === 0) {
    completionWarnings.push(
      `Phase ${phaseNumber} has no saved PLAN artifacts, so review.security cannot bind to plan provenance.`
    );
  }

  if (completedSummaries.length === 0) {
    completionWarnings.push(
      `Phase ${phaseNumber} has no valid completed SUMMARY artifacts. Run /blu-execute-phase ${phaseNumber} before /blu-secure-phase.`
    );
  }

  if (summaryIndex.pendingPlans.length > 0) {
    completionWarnings.push(
      `Phase ${phaseNumber} still has pending execution plans: ${summaryIndex.pendingPlans.join(", ")}. Run /blu-execute-phase ${phaseNumber} before persisting security evidence.`
    );
  }

  if (executionTargets.blockers.lowerWavePendingPlanIds.length > 0) {
    completionWarnings.push(
      `Lower-wave pending plans block full security coverage: ${executionTargets.blockers.lowerWavePendingPlanIds.join(", ")}.`
    );
  }

  const planReads = await Promise.all(
    planIndex.plans.map((plan) =>
      blueprintPhasePlanRead({
        cwd: args.projectRoot,
        phase: phaseNumber,
        planId: plan.planId
      })
    )
  );
  const summaryReads = await Promise.all(
    summaryIndex.completedPlans.map((planId) =>
      blueprintPhaseSummaryRead({
        cwd: args.projectRoot,
        phase: phaseNumber,
        planId
      })
    )
  );

  for (const planRead of planReads) {
    if (!planRead.found || !planRead.path) {
      completionWarnings.push(
        planRead.reason ?? "A saved plan could not be read for security provenance."
      );
      continue;
    }

    if (!planRead.validation?.valid) {
      const issues = planRead.validation?.issues.length
        ? planRead.validation.issues
        : ["Linked plan artifact is invalid."];
      completionWarnings.push(...issues.map((issue) => `${planRead.path}: ${issue}`));
    }
  }

  for (const summaryRead of summaryReads) {
    if (!summaryRead.found || !summaryRead.path) {
      completionWarnings.push(
        summaryRead.reason ?? "A completed summary could not be read for security evidence."
      );
      continue;
    }

    if (!summaryRead.validation?.valid) {
      const issues = summaryRead.validation?.issues.length
        ? summaryRead.validation.issues
        : ["Completed summary artifact is invalid."];
      completionWarnings.push(...issues.map((issue) => `${summaryRead.path}: ${issue}`));
    }
  }

  const declaredThreats = disambiguateDeclaredThreatIds(
    planReads.flatMap((planRead) =>
      planRead.path && planRead.content
        ? parseThreatRowsFromPlanContent(planRead.content, planRead.path)
        : []
    )
  );
  const hasExplicitThreatModelEvidence = planReads.some((planRead) =>
    Boolean(planRead.content && extractThreatModelContent(planRead.content).length > 0)
  );
  if (declaredThreats.length === 0 && !hasExplicitThreatModelEvidence) {
    completionWarnings.push(
      `Phase ${phaseNumber} has no saved threat model evidence. Authoring is restricted to PARTIAL or BLOCKED until a saved threat model or explicit no-threat rationale exists.`
    );
  }
  const summaryThreatFlags = summaryReads.flatMap((summaryRead) =>
    summaryRead.path && summaryRead.content
      ? parseThreatFlagsFromSummaryContent(summaryRead.content, summaryRead.path)
      : []
  );
  const knownEvidenceArtifacts = uniqueSortedStrings([
    ...planIndex.plans.map((plan) => plan.path),
    ...completedSummaries,
    ...(artifacts.verification ? [artifacts.verification] : []),
    ...(artifacts.uat ? [artifacts.uat] : [])
  ]);
  const allowedNextActions = await buildAllowedSecurityNextActions({
    phaseNumber,
    artifacts
  });
  const allowCompleted = completionWarnings.length === 0;
  const taskSchema = buildSecurityTaskSchema({
    baseSchema: securityBaseSchema,
    declaredThreats,
    summaryThreatFlags,
    knownEvidenceArtifacts,
    allowCompleted,
    ...allowedNextActions
  });
  const authoringContext: SecurityAuthoringContext = {
    phase,
    path: `${located.phaseDir}/${located.phasePrefix}${REVIEW_ARTIFACT_SUFFIXES.security}`,
    completedSummaries,
    pendingPlans: summaryIndex.pendingPlans,
    declaredThreats,
    summaryThreatFlags,
    knownEvidenceArtifacts,
    existingSecurity: artifacts.existingSecurity,
    ...allowedNextActions,
    schemaPath: modelContract.schemaPath,
    baseSchema: securityBaseSchema,
    taskSchema
  };

  return {
    status: "ready",
    artifact: "security",
    phase,
    files: [],
    reviewMode: null,
    schemaPath: modelContract.schemaPath,
    baseSchema: securityBaseSchema,
    taskSchema,
    modelOnly: true,
    authoringContext,
    prerequisiteBlockers: [],
    reason: null,
    warnings: uniqueSortedStrings([
      ...located.warnings,
      ...planIndex.warnings,
      ...summaryIndex.warnings,
      ...executionTargets.warnings,
      ...completionWarnings
    ])
  };
}

async function buildAllowedUiReviewNextActions(args: {
  phaseNumber: string;
  artifacts: {
    verification: string | null;
    uat: string | null;
  };
}): Promise<{
  completedNextSafeAction: string;
  followUpNextSafeAction: string;
  blockedNextSafeAction: string;
  allowedNextActions: string[];
}> {
  const completedCandidate =
    args.artifacts.verification === null
      ? `/blu-validate-phase ${args.phaseNumber}`
      : args.artifacts.uat === null
        ? `/blu-verify-work ${args.phaseNumber}`
        : "/blu-progress";
  const implementedCommands = await getImplementedCommandNames();
  const implementedOrProgress = (candidate: string): string => {
    if (implementedCommands === null || implementedCommands.size === 0) {
      return candidate;
    }

    const commands = extractBlueprintDirectCommands(candidate);

    return commands.length > 0 && commands.every((command) => implementedCommands.has(command))
      ? candidate
      : "/blu-progress";
  };
  const completedNextSafeAction = implementedOrProgress(completedCandidate);
  const followUpNextSafeAction = "/blu-progress";
  const blockedNextSafeAction = "/blu-progress";

  return {
    completedNextSafeAction,
    followUpNextSafeAction,
    blockedNextSafeAction,
    allowedNextActions: uniqueSortedStrings([
      completedNextSafeAction,
      followUpNextSafeAction,
      blockedNextSafeAction
    ])
  };
}

function buildUiReviewTaskSchema(args: {
  baseSchema: Record<string, unknown>;
  knownEvidenceArtifacts: string[];
  optionalEvidenceArtifacts: string[];
  completedPlans: Array<{ planId: string; path: string }>;
  dependencyPlans: Array<{ planId: string; path: string }>;
  verification: string | null;
  uat: string | null;
  existingUiReview: string | null;
  allowPass: boolean;
  allowedExistingReviewPostures: UiReviewStructuredModel["auditTrail"]["existingReviewPosture"][];
  completedNextSafeAction: string;
  followUpNextSafeAction: string;
  blockedNextSafeAction: string;
  allowedNextActions: string[];
}): Record<string, unknown> {
  const schema = cloneJsonObject(args.baseSchema);
  const properties = getJsonObjectProperty(schema, "properties");

  if (properties) {
    const verdict = getJsonObjectProperty(properties, "verdict");
    if (verdict && !args.allowPass) {
      verdict.enum = ["FOLLOW_UP", "BLOCKED"];
    }

    properties.evidenceCoverage = {
      type: "object",
      description:
        "Exhaustive coverage decisions for the exact live evidence artifacts in this UI-review scope.",
      additionalProperties: false,
      required: args.knownEvidenceArtifacts,
      properties: Object.fromEntries(
        args.knownEvidenceArtifacts.map((artifactPath) => [
          artifactPath,
          { $ref: "#/$defs/evidenceCoverageEntry" }
        ])
      )
    };

    const nextSafeAction = getJsonObjectProperty(properties, "nextSafeAction");
    if (nextSafeAction) {
      nextSafeAction.enum = args.allowedNextActions;
    }

    const defs = getJsonObjectProperty(schema, "$defs");
    const auditTrail = defs ? getJsonObjectProperty(defs, "auditTrail") : null;
    const auditTrailProperties = auditTrail
      ? getJsonObjectProperty(auditTrail, "properties")
      : null;
    const existingReviewPosture = auditTrailProperties
      ? getJsonObjectProperty(auditTrailProperties, "existingReviewPosture")
      : null;
    if (existingReviewPosture) {
      existingReviewPosture.enum = args.allowedExistingReviewPostures;
    }

    const allowedEvidenceValues = [
      ...args.knownEvidenceArtifacts,
      ...args.optionalEvidenceArtifacts,
      {
        type: "string",
        pattern: "^(?:(?:[A-Za-z0-9._-]+/)*[A-Za-z0-9._-]+:\\d+(?:-\\d+)?|screenshots?: [^\\r\\n|]+|visual observation: [^\\r\\n|]+|not supplied: [^\\r\\n|]+)$"
      }
    ];
    const pillarScore = defs ? getJsonObjectProperty(defs, "pillarScore") : null;
    const pillarScoreProperties = pillarScore
      ? getJsonObjectProperty(pillarScore, "properties")
      : null;
    const pillarEvidence = pillarScoreProperties
      ? getJsonObjectProperty(pillarScoreProperties, "evidence")
      : null;
    if (pillarEvidence) {
      delete pillarEvidence.$ref;
      pillarEvidence.anyOf = allowedEvidenceValues.map((entry) =>
        typeof entry === "string" ? { const: entry } : entry
      );
    }

    const findingRow = defs ? getJsonObjectProperty(defs, "findingRow") : null;
    const findingRowProperties = findingRow
      ? getJsonObjectProperty(findingRow, "properties")
      : null;
    const findingEvidence = findingRowProperties
      ? getJsonObjectProperty(findingRowProperties, "evidence")
      : null;
    if (findingEvidence) {
      delete findingEvidence.$ref;
      findingEvidence.anyOf = allowedEvidenceValues.map((entry) =>
        typeof entry === "string" ? { const: entry } : entry
      );
    }
  }

  const existingAllOf = Array.isArray(schema.allOf) ? schema.allOf : [];
  schema.allOf = [
    ...existingAllOf,
    {
      if: {
        required: ["verdict"],
        properties: {
          verdict: { const: "PASS" }
        }
      },
      then: {
        properties: {
          nextSafeAction: { const: args.completedNextSafeAction }
        }
      }
    },
    {
      if: {
        required: ["verdict"],
        properties: {
          verdict: { const: "FOLLOW_UP" }
        }
      },
      then: {
        properties: {
          nextSafeAction: { const: args.followUpNextSafeAction }
        }
      }
    },
    {
      if: {
        required: ["verdict"],
        properties: {
          verdict: { const: "BLOCKED" }
        }
      },
      then: {
        properties: {
          nextSafeAction: { const: args.blockedNextSafeAction }
        }
      }
    }
  ];

  schema["x-blueprint-runtimeContext"] = {
    knownEvidenceArtifacts: args.knownEvidenceArtifacts,
    optionalEvidenceArtifacts: args.optionalEvidenceArtifacts,
    completedPlans: args.completedPlans,
    dependencyPlans: args.dependencyPlans,
    verificationArtifact: args.verification,
    uatArtifact: args.uat,
    existingUiReview: args.existingUiReview,
    allowPass: args.allowPass,
    allowedExistingReviewPostures: args.allowedExistingReviewPostures,
    completedNextSafeAction: args.completedNextSafeAction,
    followUpNextSafeAction: args.followUpNextSafeAction,
    blockedNextSafeAction: args.blockedNextSafeAction
  };

  return schema;
}

async function buildUiReviewAuthoringContext(args: {
  projectRoot: string;
  phase?: NumericInput;
}): Promise<ReviewAuthoringContextResult> {
  const located = await blueprintPhaseLocate({
    cwd: args.projectRoot,
    phase: args.phase
  });
  const modelContract = readArtifactContract("review.ui-review").modelContract;
  const baseSchema = modelContract ? cloneJsonObject(modelContract.jsonSchema) : null;

  if (
    !located.found ||
    !located.phaseNumber ||
    !located.phasePrefix ||
    !located.phaseDir
  ) {
    const reason = located.reason ?? "Phase could not be resolved for UI-review authoring.";

    return {
      status: "invalid",
      artifact: "ui-review",
      phase: null,
      files: [],
      reviewMode: null,
      schemaPath: modelContract?.schemaPath ?? null,
      baseSchema,
      taskSchema: null,
      modelOnly: true,
      authoringContext: null,
      prerequisiteBlockers: [reason],
      reason,
      warnings: located.warnings
    };
  }

  if (!modelContract || !modelContract.schemaPath) {
    const reason = "review.ui-review does not expose a modelContract schema path.";

    return {
      status: "invalid",
      artifact: "ui-review",
      phase: null,
      files: [],
      reviewMode: null,
      schemaPath: modelContract?.schemaPath ?? null,
      baseSchema,
      taskSchema: null,
      modelOnly: true,
      authoringContext: null,
      prerequisiteBlockers: [reason],
      reason,
      warnings: located.warnings
    };
  }

  const phaseNumber = located.phaseNumber;
  const phase: ReviewScopePhase = {
    phaseNumber,
    phasePrefix: located.phasePrefix,
    phaseName:
      located.phaseName ??
      `Phase ${located.phasePrefix} ${path.basename(located.phaseDir)}`,
    phaseDir: located.phaseDir,
    resolvedFrom: located.resolvedFrom
  };
  const [planIndex, summaryIndex, executionTargets] = await Promise.all([
    blueprintPhasePlanIndex({
      cwd: args.projectRoot,
      phase: phaseNumber
    }),
    blueprintPhaseSummaryIndex({
      cwd: args.projectRoot,
      phase: phaseNumber
    }),
    blueprintPhaseExecutionTargets({
      cwd: args.projectRoot,
      phase: phaseNumber
    })
  ]);
  const summaryReads = await Promise.all(
    summaryIndex.completedPlans.map((planIdValue) =>
      blueprintPhaseSummaryRead({
        cwd: args.projectRoot,
        phase: phaseNumber,
        planId: planIdValue
      })
    )
  );
  const blockers: string[] = [];

  for (const summaryRead of summaryReads) {
    if (!summaryRead.found || !summaryRead.path) {
      blockers.push(summaryRead.reason ?? "A completed summary could not be read for UI-review evidence.");
      continue;
    }

    if (!summaryRead.validation?.valid) {
      const issues = summaryRead.validation?.issues.length
        ? summaryRead.validation.issues
        : ["Completed summary artifact is invalid."];
      blockers.push(...issues.map((issue) => `${summaryRead.path}: ${issue}`));
    }
  }

  const completedSummaries = summaryReads
    .filter((summaryRead) => summaryRead.found && summaryRead.path && summaryRead.validation?.valid)
    .map((summaryRead) => summaryRead.path!)
    .sort((left, right) => left.localeCompare(right));
  const completedPlanIds = new Set(summaryIndex.completedPlans);
  const completedPlanRecords = planIndex.plans.filter((plan) =>
    completedPlanIds.has(plan.planId)
  );
  const completedPlans = completedPlanRecords
    .map((plan) => ({
      planId: plan.planId,
      path: plan.path
    }))
    .sort((left, right) => left.planId.localeCompare(right.planId));
  const knownPlanIds = new Set(planIndex.plans.map((plan) => plan.planId));
  const dependencyPlans = uniqueOrderedStrings(
    planIndex.plans.flatMap((plan) =>
      dependencyPlanRowsForReviewFix(
        plan.dependsOn,
        phase.phasePrefix,
        phase.phaseDir,
        knownPlanIds
      ).map((dependency) => `${dependency.planId}\t${dependency.path}`)
    )
  )
    .map((entry) => {
      const [planId, dependencyPath] = entry.split("\t");
      return { planId, path: dependencyPath };
    })
    .sort((left, right) => left.planId.localeCompare(right.planId));

  if (completedSummaries.length === 0) {
    blockers.push(
      `Phase ${phaseNumber} has no valid completed SUMMARY artifacts. Run /blu-execute-phase ${phaseNumber} before persisting UI-review evidence.`
    );
  }

  const artifacts = {
    uiSpec:
      located.artifacts.find((artifactPath) => artifactPath.endsWith("-UI-SPEC.md")) ??
      null,
    verification:
      located.artifacts.find((artifactPath) => artifactPath.endsWith("-VERIFICATION.md")) ??
      null,
    uat:
      located.artifacts.find((artifactPath) => artifactPath.endsWith("-UAT.md")) ??
      null,
    existingUiReview:
      located.artifacts.find((artifactPath) =>
        artifactPath.endsWith(REVIEW_ARTIFACT_SUFFIXES["ui-review"])
      ) ?? null
  };
  const knownEvidenceArtifacts = uniqueSortedStrings([
    ...completedSummaries,
    ...(artifacts.uiSpec ? [artifacts.uiSpec] : []),
    ...(artifacts.verification ? [artifacts.verification] : []),
    ...(artifacts.uat ? [artifacts.uat] : [])
  ]);
  const optionalEvidenceArtifacts = artifacts.existingUiReview
    ? [artifacts.existingUiReview]
    : [];
  const allowedExistingReviewPostures: UiReviewStructuredModel["auditTrail"]["existingReviewPosture"][] =
    artifacts.existingUiReview ? ["reused", "overwrite-confirmed"] : ["none"];
  const allowPass =
    summaryIndex.pendingPlans.length === 0 &&
    executionTargets.blockers.lowerWavePendingPlanIds.length === 0;
  const nextActions = await buildAllowedUiReviewNextActions({
    phaseNumber,
    artifacts
  });
  const uiReviewBaseSchema = cloneJsonObject(modelContract.jsonSchema);
  const taskSchema =
    blockers.length === 0
      ? buildUiReviewTaskSchema({
          baseSchema: uiReviewBaseSchema,
          knownEvidenceArtifacts,
          optionalEvidenceArtifacts,
          completedPlans,
          dependencyPlans,
          verification: artifacts.verification,
          uat: artifacts.uat,
          existingUiReview: artifacts.existingUiReview,
          allowPass,
          allowedExistingReviewPostures,
          ...nextActions
        })
      : null;
  const authoringContext: UiReviewAuthoringContext | null = taskSchema
    ? {
        phase,
        path: `${located.phaseDir}/${located.phasePrefix}${REVIEW_ARTIFACT_SUFFIXES["ui-review"]}`,
        completedPlans,
        completedSummaries,
        dependencyPlans,
        pendingPlans: summaryIndex.pendingPlans,
        lowerWavePendingPlanIds: executionTargets.blockers.lowerWavePendingPlanIds,
        verification: artifacts.verification,
        uat: artifacts.uat,
        knownEvidenceArtifacts,
        existingUiReview: artifacts.existingUiReview,
        optionalEvidenceArtifacts,
        allowedExistingReviewPostures,
        ...nextActions,
        schemaPath: modelContract.schemaPath,
        baseSchema: uiReviewBaseSchema,
        taskSchema
      }
    : null;

  return {
    status: blockers.length === 0 ? "ready" : "invalid",
    artifact: "ui-review",
    phase,
    files: [],
    reviewMode: null,
    schemaPath: modelContract.schemaPath,
    baseSchema: uiReviewBaseSchema,
    taskSchema,
    modelOnly: true,
    authoringContext,
    prerequisiteBlockers: blockers,
    reason: blockers.length > 0 ? blockers.join(" ") : null,
    warnings: uniqueSortedStrings([
      ...located.warnings,
      ...planIndex.warnings,
      ...summaryIndex.warnings,
      ...executionTargets.warnings
    ])
  };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function countMarkdownSections(content: string): number {
  return [...content.matchAll(/^##?\s+.+$/gm)].length;
}

function collectListItems(block: string): string[] {
  return block
    .split("\n")
    .map((line) => line.trim())
    .flatMap((line) => {
      const checklistMatch = line.match(/^[-*]\s+\[(?: |x|X)\]\s+(.+)$/);

      if (checklistMatch) {
        return [checklistMatch[1].trim()];
      }

      const bulletMatch = line.match(/^[-*+]\s+(.+)$/);

      if (bulletMatch) {
        return [bulletMatch[1].trim()];
      }

      const numberedMatch = line.match(/^\d+\.\s+(.+)$/);

      return numberedMatch ? [numberedMatch[1].trim()] : [];
    })
    .filter((item) => item.length > 0);
}

function extractMarkdownSectionRawItems(
  content: string,
  headingPattern: RegExp
): Array<{
  heading: string;
  items: string[];
}> {
  const lines = content.split("\n");
  const entries: Array<{
    heading: string;
    items: string[];
  }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const headingMatch = lines[index].match(/^(##+)\s+(.+)$/);

    if (!headingMatch || !headingPattern.test(headingMatch[2].trim())) {
      continue;
    }

    const sectionLevel = headingMatch[1].length;
    const sectionLines: string[] = [];

    for (let innerIndex = index + 1; innerIndex < lines.length; innerIndex += 1) {
      const nextHeadingMatch = lines[innerIndex].match(/^(##+)\s+(.+)$/);

      if (nextHeadingMatch && nextHeadingMatch[1].length <= sectionLevel) {
        break;
      }

      sectionLines.push(lines[innerIndex]);
    }

    entries.push({
      heading: headingMatch[2].trim(),
      items: collectListItems(sectionLines.join("\n"))
    });
  }

  return entries;
}

function extractMarkdownSectionItems(
  content: string,
  headingPattern: RegExp
): string[] {
  return [
    ...new Set(
      extractMarkdownSectionRawItems(content, headingPattern).flatMap((entry) => entry.items)
    )
  ];
}

function normalizeReviewListItem(item: string): string {
  return normalizeFindingSummary(item)
    .replace(/^`+|`+$/g, "")
    .replace(/^[\s"'“”‘’()[\]{}<>]+|[\s"'“”‘’()[\]{}<>.,;:!?]+$/g, "")
    .trim()
    .toLowerCase();
}

function hasGlobPattern(candidate: string): boolean {
  return /[*?[\]{}]/.test(candidate);
}

function isPlaceholderReviewListItem(item: string): boolean {
  const normalized = normalizeReviewListItem(item);

  return (
    normalized.length === 0 ||
    normalized === "none" ||
    normalized === "n/a" ||
    normalized === "na" ||
    normalized === "not applicable" ||
    normalized === "no finding" ||
    normalized === "no findings" ||
    normalized === "no follow up" ||
    normalized === "no follow ups" ||
    normalized === "no follow-up" ||
    normalized === "no follow-ups"
  );
}

function collectSubstantiveReviewItems(
  content: string,
  headingPattern: RegExp
): string[] {
  return uniqueOrderedStrings(
    extractMarkdownSectionItems(content, headingPattern)
      .map(stripVisibleReviewTargetId)
      .filter((item) => !isPlaceholderReviewListItem(item))
  );
}

function extractMarkdownSectionContent(
  content: string,
  headingPattern: RegExp
): string[] {
  const lines = content.split("\n");
  const sections: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const headingMatch = lines[index].match(/^(##+)\s+(.+)$/);

    if (!headingMatch || !headingPattern.test(headingMatch[2].trim())) {
      continue;
    }

    const sectionLevel = headingMatch[1].length;
    const sectionLines: string[] = [];

    for (let innerIndex = index + 1; innerIndex < lines.length; innerIndex += 1) {
      const nextHeadingMatch = lines[innerIndex].match(/^(##+)\s+(.+)$/);

      if (nextHeadingMatch && nextHeadingMatch[1].length <= sectionLevel) {
        break;
      }

      sectionLines.push(lines[innerIndex]);
    }

    sections.push(sectionLines.join("\n"));
  }

  return sections;
}

function parseSecurityThreatRegisterFindings(content: string): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  const seenSummaries = new Set<string>();

  for (const section of extractMarkdownSectionContent(content, /^Threat Register$/i)) {
    const tableRows = parseMarkdownTableRows(section);

    if (tableRows.length === 0) {
      continue;
    }

    let headers: string[] | null = null;

    for (const cells of tableRows) {
      if (cells.length < 4) {
        continue;
      }

      const normalizedCells = cells.map(normalizeMarkdownHeaderCell);

      if (
        headers === null &&
        normalizedCells.some((cell) => cell === "threat id")
      ) {
        headers = normalizedCells;
        continue;
      }

      const threatIdIndex = headers ? findHeaderIndex(headers, [/^threat id$/]) : -1;
      const dispositionIndex = headers ? findHeaderIndex(headers, [/^disposition$/]) : -1;
      const mitigationIndex = headers ? findHeaderIndex(headers, [/^mitigation$/]) : -1;
      const statusIndex = headers ? findHeaderIndex(headers, [/^status$/]) : -1;
      const evidenceIndex = headers
        ? findHeaderIndex(headers, [/^evidence(?: note)?$/, /^evidence .* note$/])
        : -1;
      const hasRichFallbackShape = cells.length >= 7;

      const threatId = cells[threatIdIndex >= 0 ? threatIdIndex : 0] ?? "";
      const disposition =
        cells[
          dispositionIndex >= 0
            ? dispositionIndex
            : hasRichFallbackShape
              ? 3
              : 1
        ] ?? "";
      const mitigation =
        cells[
          mitigationIndex >= 0
            ? mitigationIndex
            : hasRichFallbackShape
              ? 4
              : -1
        ] ?? "";
      const status =
        cells[
          statusIndex >= 0
            ? statusIndex
            : hasRichFallbackShape
              ? 6
              : 2
        ] ?? "";
      const evidence =
        cells[
          evidenceIndex >= 0
            ? evidenceIndex
            : hasRichFallbackShape
              ? 7
              : 3
        ] ?? "";

      if (
        threatId.length === 0 ||
        threatId === "Threat ID" ||
        !/\bopen\b/i.test(status)
      ) {
        continue;
      }

      const evidenceNote = evidence.length > 0 ? evidence : mitigation;
      const summary = normalizeFindingSummary(
        `Open threat ${threatId}: ${evidenceNote.length > 0 ? evidenceNote : `${disposition} ${status}`}`
      );

      if (summary.length === 0 || seenSummaries.has(summary)) {
        continue;
      }

      seenSummaries.add(summary);
      findings.push(buildReviewFinding({
        id: `F-${String(findings.length + 1).padStart(2, "0")}`,
        severity: "unknown",
        summary,
        sourceSection: "Threat Register"
      }));
    }
  }

  return findings;
}

function extractMarkdownSectionEntries(
  content: string,
  headingPattern: RegExp
): Array<{
  heading: string;
  items: string[];
}> {
  const lines = content.split("\n");
  const entries: Array<{
    heading: string;
    items: string[];
  }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const headingMatch = lines[index].match(/^(##+)\s+(.+)$/);

    if (!headingMatch || !headingPattern.test(headingMatch[2].trim())) {
      continue;
    }

    const sectionLevel = headingMatch[1].length;
    const sectionLines: string[] = [];

    for (let innerIndex = index + 1; innerIndex < lines.length; innerIndex += 1) {
      const nextHeadingMatch = lines[innerIndex].match(/^(##+)\s+(.+)$/);

      if (nextHeadingMatch && nextHeadingMatch[1].length <= sectionLevel) {
        break;
      }

      sectionLines.push(lines[innerIndex]);
    }

    const items = [...new Set(collectListItems(sectionLines.join("\n")))];

    if (items.length > 0) {
      entries.push({
        heading: headingMatch[2].trim(),
        items
      });
    }
  }

  return entries;
}

function emptySeverityCounts(): Record<ReviewFindingSeverity, number> {
  return {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0
  };
}

function inferFindingSeverity(
  heading: string,
  item: string
): ReviewFindingSeverity {
  const source = `${heading} ${item}`.toLowerCase();

  if (/\b(?:critical|p0)\b/.test(source)) {
    return "critical";
  }

  if (/\b(?:high|p1)\b/.test(source)) {
    return "high";
  }

  if (/\b(?:medium|p2)\b/.test(source)) {
    return "medium";
  }

  if (/\b(?:low|p3)\b/.test(source)) {
    return "low";
  }

  return "unknown";
}

function normalizeFindingSummary(item: string): string {
  return item
    .replace(/^`?((?:F|FU)-[A-Z0-9][A-Z0-9._-]*)`?(?:\s*[-:]\s*|\s+)/i, "")
    .replace(
      /^(?:\[(?:critical|high|medium|low|unknown|p[0-3]|blocker|follow-?up|observation|accepted-risk|pass|fixed|deferred|skipped)\]\s*)+/i,
      ""
    )
    .replace(/^`?((?:F|FU)-[A-Z0-9][A-Z0-9._-]*)`?(?:\s*[-:]\s*|\s+)/i, "")
    .replace(/^(?:critical|high|medium|low|p[0-3])\s*[:\-]\s*/i, "")
    .replace(
      /^severity\s*[:\-]\s*(?:critical|high|medium|low|unknown)\s*[:\-]?\s*/i,
      ""
    )
    .trim();
}

function extractReviewFixTargetId(item: string): string | null {
  return extractVisibleReviewTargetId(item);
}

function normalizeReviewFixFindingSummary(item: string): string {
  const match = item.match(
    /^`?((?:F|FU)-[A-Z0-9][A-Z0-9._-]*)`?(?:\s*[-:]\s*|\s+)/i
  );

  if (!match) {
    return normalizeFindingSummary(item);
  }

  return item.slice((match.index ?? 0) + match[0].length).trim();
}

function buildReviewFinding(args: {
  id: string;
  visibleId?: string | null;
  stableId?: string | null;
  legacyDerived?: boolean;
  severity?: ReviewFindingSeverity;
  summary: string;
  sourceSection: string | null;
  disposition?: ReviewFindingDisposition | null;
  location?: string | null;
  evidence?: string | null;
  impact?: string | null;
  recommendation?: string | null;
  classification?: ReviewFixTargetClassification | null;
  defaultEligible?: boolean;
}): ReviewFinding {
  const parsedLocation = args.location ? parseCodeReviewLocation(args.location) : null;

  return {
    id: args.id,
    visibleId: args.visibleId ?? null,
    stableId: args.stableId ?? null,
    legacyDerived: args.legacyDerived ?? false,
    severity: args.severity ?? "unknown",
    summary: args.summary,
    sourceSection: args.sourceSection,
    disposition: args.disposition ?? null,
    location: parsedLocation
      ? {
          display: args.location ?? `${parsedLocation.file}:${parsedLocation.startLine}`,
          file: parsedLocation.file,
          startLine: parsedLocation.startLine,
          endLine: parsedLocation.endLine
        }
      : null,
    file: parsedLocation?.file ?? null,
    startLine: parsedLocation?.startLine ?? null,
    endLine: parsedLocation?.endLine ?? null,
    evidence: args.evidence ?? null,
    impact: args.impact ?? null,
    recommendation: args.recommendation ?? null,
    classification: args.classification ?? null,
    defaultEligible: args.defaultEligible ?? false
  };
}

function classificationForFindingDisposition(
  disposition: ReviewFindingDisposition | null
): ReviewFixTargetClassification | null {
  if (disposition === "follow-up") {
    return "fixable";
  }
  if (disposition === "blocked") {
    return "blocked";
  }
  if (disposition === "observation") {
    return "observation";
  }
  if (disposition === "accepted-risk") {
    return "accepted-risk";
  }

  return null;
}

function classifyFollowUpTarget(summary: string): ReviewFixTargetClassification {
  const normalized = normalizeReviewListItem(summary);

  if (normalized.length === 0 || isPlaceholderReviewListItem(summary)) {
    return "no-op";
  }

  if (
    /(?:^|\b)(?:add|missing|gap|coverage)(?:\s+(?:a|an))?\s+(?:unit |integration |regression |smoke )?tests?\b/i.test(summary) ||
    /\b(?:test gap|missing test|assertion gap|coverage gap)\b/i.test(summary) ||
    /\/blu-add-tests\b/i.test(summary)
  ) {
    return "test-gap";
  }

  if (
    /\b(?:verify|verification|validate|validation|uat|manual qa|smoke check|re-run)\b/i.test(summary) ||
    /\/blu-(?:validate-phase|verify-work)\b/i.test(summary)
  ) {
    return "validation-only";
  }

  if (
    /\/blu-(?:progress|secure-phase|plan-phase|review|execute-phase|pause-work|resume-work)\b/i.test(summary) ||
    /\b(?:route|routing|document|triage|coordinate|handoff|process note)\b/i.test(summary)
  ) {
    return "routing-note";
  }

  if (/\b(?:no action|no change|already covered|informational only)\b/i.test(summary)) {
    return "no-op";
  }

  return "fixable";
}

function isDefaultReviewFixClassification(
  classification: ReviewFixTargetClassification
): boolean {
  return classification === "fixable";
}

function parseCodeReviewFindingEntry(
  item: string,
  sourceSection: string,
  index: number
): ReviewFinding {
  const visibleId = extractVisibleReviewTargetId(item);
  const canonical = item.match(CANONICAL_CODE_REVIEW_FINDING_PATTERN);

  if (canonical) {
    const [, severity, disposition, canonicalId, location, evidence, impact, recommendation] = canonical;
    const normalizedDisposition = disposition.toLowerCase() as ReviewFindingDisposition;
    const classification = normalizedDisposition === "follow-up"
      ? classifyFollowUpTarget(recommendation)
      : classificationForFindingDisposition(normalizedDisposition);

    return buildReviewFinding({
      id: canonicalId.toUpperCase(),
      visibleId: canonicalId.toUpperCase(),
      stableId: null,
      legacyDerived: false,
      severity: severity.toLowerCase() as ReviewFindingSeverity,
      summary: sanitizeMarkdownScalar(recommendation),
      sourceSection,
      disposition: normalizedDisposition,
      location,
      evidence,
      impact,
      recommendation,
      classification,
      defaultEligible: isDefaultReviewFixClassification(classification ?? "routing-note")
    });
  }

  const legacyCanonical = item.match(LEGACY_CODE_REVIEW_FINDING_PATTERN);

  if (legacyCanonical) {
    const [, severity, disposition, location, evidence, impact, recommendation] = legacyCanonical;
    const normalizedDisposition = disposition.toLowerCase() as ReviewFindingDisposition;
    const classification = normalizedDisposition === "follow-up"
      ? classifyFollowUpTarget(recommendation)
      : classificationForFindingDisposition(normalizedDisposition);
    const stableId = buildLegacyReviewTargetId("F", sourceSection, item);

    return buildReviewFinding({
      id: stableId,
      visibleId: null,
      stableId,
      legacyDerived: true,
      severity: severity.toLowerCase() as ReviewFindingSeverity,
      summary: sanitizeMarkdownScalar(recommendation),
      sourceSection,
      disposition: normalizedDisposition,
      location,
      evidence,
      impact,
      recommendation,
      classification,
      defaultEligible: isDefaultReviewFixClassification(classification ?? "routing-note")
    });
  }

  const stripped = stripVisibleReviewTargetId(item);
  const locationMatch = [...stripped.matchAll(/`([^`]+)`/g)][0]?.[1] ?? null;
  const recommendationMatch = stripped.match(/Fix\/verification:\s*(.+)$/i);
  const summary = sanitizeMarkdownScalar(recommendationMatch?.[1] ?? normalizeFindingSummary(stripped));
  const severity = inferFindingSeverity(sourceSection, item);
  const stableId = visibleId === null ? buildLegacyReviewTargetId("F", sourceSection, item) : null;
  const classification = classifyFollowUpTarget(summary);

  return buildReviewFinding({
    id: visibleId ?? stableId!,
    visibleId,
    stableId,
    legacyDerived: visibleId === null,
    severity,
    summary,
    sourceSection,
    disposition: /follow-?up/i.test(item) ? "follow-up" : null,
    location: locationMatch,
    classification,
    defaultEligible: isDefaultReviewFixClassification(classification)
  });
}

function parseCodeReviewFollowUpTargets(content: string): {
  followUps: string[];
  targets: ReviewFixTarget[];
} {
  const followUps: string[] = [];
  const targets: ReviewFixTarget[] = [];

  for (const entry of extractMarkdownSectionRawItems(content, /^Follow-?Ups$/i)) {
    for (const item of entry.items) {
      const visibleId = extractVisibleReviewTargetId(item);
      const summary = stripVisibleReviewTargetId(item);
      const classification = classifyFollowUpTarget(summary);
      const placeholderOnly = isPlaceholderReviewListItem(summary);
      const stableId =
        visibleId === null ? buildLegacyReviewTargetId("FU", entry.heading, item) : null;

      if (!placeholderOnly) {
        followUps.push(summary);
      }

      if (placeholderOnly && visibleId === null) {
        continue;
      }

      targets.push({
        targetId: visibleId ?? stableId!,
        visibleId,
        stableId,
        legacyDerived: visibleId === null,
        source: "follow-up",
        severity: "unknown",
        summary: summary.length > 0 ? summary : "none",
        sourceSection: entry.heading,
        disposition: null,
        location: null,
        file: null,
        startLine: null,
        endLine: null,
        evidence: null,
        impact: null,
        recommendation: null,
        classification,
        defaultEligible: isDefaultReviewFixClassification(classification)
      });
    }
  }

  return {
    followUps: uniqueOrderedStrings(followUps),
    targets
  };
}

function parseCodeReviewFindings(content: string): {
  findings: ReviewFinding[];
  severityCounts: Record<ReviewFindingSeverity, number>;
  followUps: string[];
  followUpTargets: ReviewFixTarget[];
} {
  const findings = extractMarkdownSectionRawItems(content, /^Findings$/i)
    .flatMap((entry) =>
      entry.items
        .filter((item) => !isPlaceholderReviewListItem(item))
        .map((item, index) => parseCodeReviewFindingEntry(item, entry.heading, index))
    );
  const severityCounts = emptySeverityCounts();

  findings.forEach((finding) => {
    severityCounts[finding.severity] += 1;
  });

  const followUps = parseCodeReviewFollowUpTargets(content);

  return {
    findings,
    severityCounts,
    followUps: followUps.followUps,
    followUpTargets: followUps.targets
  };
}

function resolveFindingsHeadingPattern(artifact: ReviewArtifactKind): RegExp {
  if (artifact === "review-fix") {
    return /^(findings addressed|findings)$/i;
  }

  return /^(findings?|security findings|risks?|gaps found|unresolved gaps)$/i;
}

function normalizeSecurityFindingSeverity(value: string): ReviewFindingSeverity {
  const normalized = value.toLowerCase();

  return (["critical", "high", "medium", "low", "unknown"] as const).includes(
    normalized as ReviewFindingSeverity
  )
    ? normalized as ReviewFindingSeverity
    : "unknown";
}

function parseSecurityFindingsTableFindings(content: string): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  const seenSummaries = new Set<string>();

  for (const section of extractMarkdownSectionContent(content, /^Findings$/i)) {
    const tableRows = parseMarkdownTableRows(section);

    if (tableRows.length === 0) {
      continue;
    }

    let headers: string[] | null = null;

    for (const cells of tableRows) {
      if (cells.length < 6) {
        continue;
      }

      const normalizedCells = cells.map(normalizeMarkdownHeaderCell);

      if (
        headers === null &&
        normalizedCells.includes("kind") &&
        normalizedCells.includes("severity")
      ) {
        headers = normalizedCells;
        continue;
      }

      const kindIndex = headers ? findHeaderIndex(headers, [/^kind$/]) : 0;
      const severityIndex = headers ? findHeaderIndex(headers, [/^severity$/]) : 1;
      const threatIdIndex = headers ? findHeaderIndex(headers, [/^threat id$/]) : 2;
      const statusIndex = headers ? findHeaderIndex(headers, [/^status$/]) : 3;
      const evidenceIndex = headers ? findHeaderIndex(headers, [/^evidence$/]) : 4;
      const recommendationIndex = headers ? findHeaderIndex(headers, [/^recommendation$/]) : 5;
      const kind = cells[kindIndex >= 0 ? kindIndex : 0] ?? "";
      const severity = cells[severityIndex >= 0 ? severityIndex : 1] ?? "";
      const threatId = cells[threatIdIndex >= 0 ? threatIdIndex : 2] ?? "";
      const status = cells[statusIndex >= 0 ? statusIndex : 3] ?? "";
      const evidence = cells[evidenceIndex >= 0 ? evidenceIndex : 4] ?? "";
      const recommendation = cells[recommendationIndex >= 0 ? recommendationIndex : 5] ?? "";

      if (
        kind === "none" &&
        severity === "none" &&
        threatId === "none" &&
        status === "none" &&
        evidence === "none" &&
        recommendation === "none"
      ) {
        continue;
      }

      if (kind.length === 0 || isPlaceholderReviewListItem(evidence)) {
        continue;
      }

      const summary = normalizeFindingSummary(
        kind === "open-threat"
          ? `Open threat ${threatId}: ${evidence}`
          : `${kind}${threatId && threatId !== "none" ? ` ${threatId}` : ""}: ${evidence}${
              recommendation && !isPlaceholderReviewListItem(recommendation)
                ? ` Recommendation: ${recommendation}`
                : ""
            }`
      );

      if (summary.length === 0 || seenSummaries.has(summary)) {
        continue;
      }

      seenSummaries.add(summary);
      findings.push(buildReviewFinding({
        id: `F-${String(findings.length + 1).padStart(2, "0")}`,
        severity: normalizeSecurityFindingSeverity(severity),
        summary,
        sourceSection: "Findings"
      }));
    }
  }

  return findings;
}

function normalizeUiReviewFindingSeverity(value: string): ReviewFindingSeverity {
  const normalized = value.toLowerCase();

  return (["high", "medium", "low"] as const).includes(
    normalized as "high" | "medium" | "low"
  )
    ? normalized as ReviewFindingSeverity
    : "unknown";
}

function parseUiReviewFindingsTable(content: string): {
  findings: ReviewFinding[];
  followUps: string[];
} {
  const findings: ReviewFinding[] = [];
  const followUps: string[] = [];
  const seenSummaries = new Set<string>();

  for (const section of extractMarkdownSectionContent(content, /^Findings$/i)) {
    const tableRows = parseMarkdownTableRows(section);

    if (tableRows.length === 0) {
      continue;
    }

    let headers: string[] | null = null;

    for (const cells of tableRows) {
      if (cells.length < 6) {
        continue;
      }

      const normalizedCells = cells.map(normalizeMarkdownHeaderCell);

      if (
        headers === null &&
        normalizedCells.includes("pillar") &&
        normalizedCells.includes("severity") &&
        normalizedCells.includes("evidence")
      ) {
        headers = normalizedCells;
        continue;
      }

      const pillarIndex = headers ? findHeaderIndex(headers, [/^pillar$/]) : 0;
      const severityIndex = headers ? findHeaderIndex(headers, [/^severity$/]) : 1;
      const statusIndex = headers ? findHeaderIndex(headers, [/^status$/]) : 2;
      const evidenceIndex = headers ? findHeaderIndex(headers, [/^evidence$/]) : 3;
      const impactIndex = headers ? findHeaderIndex(headers, [/^user impact$/]) : 4;
      const recommendationIndex = headers ? findHeaderIndex(headers, [/^recommendation$/]) : 5;
      const pillar = cells[pillarIndex >= 0 ? pillarIndex : 0] ?? "";
      const severity = cells[severityIndex >= 0 ? severityIndex : 1] ?? "";
      const status = cells[statusIndex >= 0 ? statusIndex : 2] ?? "";
      const evidence = cells[evidenceIndex >= 0 ? evidenceIndex : 3] ?? "";
      const userImpact = cells[impactIndex >= 0 ? impactIndex : 4] ?? "";
      const recommendation = cells[recommendationIndex >= 0 ? recommendationIndex : 5] ?? "";

      if (
        /^none$/i.test(pillar) &&
        /^none$/i.test(severity) &&
        /^none$/i.test(status) &&
        /^none$/i.test(evidence) &&
        /^none$/i.test(userImpact) &&
        /^none$/i.test(recommendation)
      ) {
        continue;
      }

      if (
        pillar.length === 0 ||
        /^none$/i.test(status) ||
        isPlaceholderReviewListItem(evidence)
      ) {
        continue;
      }

      const impactText = userImpact.length > 0 && !isPlaceholderReviewListItem(userImpact)
        ? ` Impact: ${userImpact}.`
        : "";
      const recommendationText =
        recommendation.length > 0 && !isPlaceholderReviewListItem(recommendation)
          ? ` Recommendation: ${recommendation}.`
          : "";
      const summary = normalizeFindingSummary(
        `${pillar}${status ? ` ${status}` : ""}: ${evidence}.${impactText}${recommendationText}`
      );

      if (summary.length === 0 || seenSummaries.has(summary)) {
        continue;
      }

      seenSummaries.add(summary);
      findings.push(buildReviewFinding({
        id: `F-${String(findings.length + 1).padStart(2, "0")}`,
        severity: normalizeUiReviewFindingSeverity(severity),
        summary,
        sourceSection: "Findings"
      }));

      if (
        recommendation.length > 0 &&
        !isPlaceholderReviewListItem(recommendation) &&
        !/^none$/i.test(recommendation)
      ) {
        followUps.push(recommendation);
      }
    }
  }

  return {
    findings,
    followUps: uniqueOrderedStrings(followUps)
  };
}

function parsePeerReviewFindingsTableFindings(content: string): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  const seenSummaries = new Set<string>();

  for (const section of extractMarkdownSectionContent(content, /^Findings$/i)) {
    const tableRows = parseMarkdownTableRows(section);

    if (tableRows.length === 0) {
      continue;
    }

    let headers: string[] | null = null;

    for (const cells of tableRows) {
      if (cells.length < 5) {
        continue;
      }

      const normalizedCells = cells.map(normalizeMarkdownHeaderCell);

      if (
        headers === null &&
        normalizedCells.includes("severity") &&
        normalizedCells.includes("source") &&
        normalizedCells.includes("evidence") &&
        normalizedCells.includes("recommendation") &&
        normalizedCells.includes("status")
      ) {
        headers = normalizedCells;
        continue;
      }

      const severityIndex = headers ? findHeaderIndex(headers, [/^severity$/]) : 0;
      const sourceIndex = headers ? findHeaderIndex(headers, [/^source$/]) : 1;
      const evidenceIndex = headers ? findHeaderIndex(headers, [/^evidence$/]) : 2;
      const recommendationIndex = headers ? findHeaderIndex(headers, [/^recommendation$/]) : 3;
      const statusIndex = headers ? findHeaderIndex(headers, [/^status$/]) : 4;
      const severity = cells[severityIndex >= 0 ? severityIndex : 0] ?? "";
      const source = cells[sourceIndex >= 0 ? sourceIndex : 1] ?? "";
      const evidence = cells[evidenceIndex >= 0 ? evidenceIndex : 2] ?? "";
      const recommendation = cells[recommendationIndex >= 0 ? recommendationIndex : 3] ?? "";
      const status = cells[statusIndex >= 0 ? statusIndex : 4] ?? "";

      if (!/^(?:OPEN|BLOCKED)$/i.test(status.trim())) {
        continue;
      }

      if (
        isPlaceholderReviewListItem(source) &&
        isPlaceholderReviewListItem(evidence) &&
        isPlaceholderReviewListItem(recommendation)
      ) {
        continue;
      }

      const summary = normalizeFindingSummary(
        `${source}: ${evidence}${
          isPlaceholderReviewListItem(recommendation)
            ? ""
            : ` Recommendation: ${recommendation}`
        }`
      );

      if (summary.length === 0 || seenSummaries.has(summary)) {
        continue;
      }

      seenSummaries.add(summary);
      findings.push(buildReviewFinding({
        id: `F-${String(findings.length + 1).padStart(2, "0")}`,
        severity: normalizeSecurityFindingSeverity(severity),
        summary,
        sourceSection: "Findings"
      }));
    }
  }

  return findings;
}

function parseFindingsFromArtifact(
  content: string,
  artifact: ReviewArtifactKind
): {
  findings: ReviewFinding[];
  severityCounts: Record<ReviewFindingSeverity, number>;
  followUps: string[];
  followUpTargets: ReviewFixTarget[];
} {
  if (artifact === "code-review") {
    return parseCodeReviewFindings(content);
  }

  const entries = extractMarkdownSectionEntries(content, resolveFindingsHeadingPattern(artifact));
  const findings: ReviewFinding[] = [];
  const seenFindingKeys = new Set<string>();
  const severityCounts = emptySeverityCounts();
  const parsedFollowUps: string[] = [];

  for (const entry of entries) {
    for (const item of entry.items) {
      if (isPlaceholderReviewListItem(item)) {
        continue;
      }

      const reviewFixTargetId = artifact === "review-fix"
        ? extractReviewFixTargetId(item)
        : null;
      const summary = reviewFixTargetId
        ? normalizeReviewFixFindingSummary(item)
        : normalizeFindingSummary(item);
      const findingKey = reviewFixTargetId ?? summary;

      if (summary.length === 0 || seenFindingKeys.has(findingKey)) {
        continue;
      }

      const severity = inferFindingSeverity(entry.heading, item);
      seenFindingKeys.add(findingKey);
      severityCounts[severity] += 1;
      findings.push(buildReviewFinding({
        id: reviewFixTargetId ?? `F-${String(findings.length + 1).padStart(2, "0")}`,
        visibleId: reviewFixTargetId,
        legacyDerived: reviewFixTargetId === null,
        severity,
        summary,
        sourceSection: entry.heading
      }));
    }
  }

  if (artifact === "security") {
    for (const tableFinding of parseSecurityFindingsTableFindings(content)) {
      if (seenFindingKeys.has(tableFinding.summary)) {
        continue;
      }

      seenFindingKeys.add(tableFinding.summary);
      severityCounts[tableFinding.severity] += 1;
      findings.push(
        buildReviewFinding({
          id: `F-${String(findings.length + 1).padStart(2, "0")}`,
          visibleId: tableFinding.visibleId,
          stableId: tableFinding.stableId,
          legacyDerived: tableFinding.legacyDerived,
          severity: tableFinding.severity,
          summary: tableFinding.summary,
          sourceSection: tableFinding.sourceSection,
          disposition: tableFinding.disposition,
          location: tableFinding.location?.display ?? null,
          evidence: tableFinding.evidence,
          impact: tableFinding.impact,
          recommendation: tableFinding.recommendation,
          classification: tableFinding.classification,
          defaultEligible: tableFinding.defaultEligible
        })
      );
    }

    for (const threatFinding of parseSecurityThreatRegisterFindings(content)) {
      if (seenFindingKeys.has(threatFinding.summary)) {
        continue;
      }

      seenFindingKeys.add(threatFinding.summary);
      severityCounts[threatFinding.severity] += 1;
      findings.push(
        buildReviewFinding({
          id: `F-${String(findings.length + 1).padStart(2, "0")}`,
          visibleId: threatFinding.visibleId,
          stableId: threatFinding.stableId,
          legacyDerived: threatFinding.legacyDerived,
          severity: threatFinding.severity,
          summary: threatFinding.summary,
          sourceSection: threatFinding.sourceSection,
          disposition: threatFinding.disposition,
          location: threatFinding.location?.display ?? null,
          evidence: threatFinding.evidence,
          impact: threatFinding.impact,
          recommendation: threatFinding.recommendation,
          classification: threatFinding.classification,
          defaultEligible: threatFinding.defaultEligible
        })
      );
    }
  }

  if (artifact === "ui-review") {
    const table = parseUiReviewFindingsTable(content);
    parsedFollowUps.push(...table.followUps);

    for (const tableFinding of table.findings) {
      if (seenFindingKeys.has(tableFinding.summary)) {
        continue;
      }

      seenFindingKeys.add(tableFinding.summary);
      severityCounts[tableFinding.severity] += 1;
      findings.push(
        buildReviewFinding({
          id: `F-${String(findings.length + 1).padStart(2, "0")}`,
          visibleId: tableFinding.visibleId,
          stableId: tableFinding.stableId,
          legacyDerived: tableFinding.legacyDerived,
          severity: tableFinding.severity,
          summary: tableFinding.summary,
          sourceSection: tableFinding.sourceSection,
          disposition: tableFinding.disposition,
          location: tableFinding.location?.display ?? null,
          evidence: tableFinding.evidence,
          impact: tableFinding.impact,
          recommendation: tableFinding.recommendation,
          classification: tableFinding.classification,
          defaultEligible: tableFinding.defaultEligible
        })
      );
    }
  }

  if (artifact === "peer-review") {
    for (const tableFinding of parsePeerReviewFindingsTableFindings(content)) {
      if (seenFindingKeys.has(tableFinding.summary)) {
        continue;
      }

      seenFindingKeys.add(tableFinding.summary);
      severityCounts[tableFinding.severity] += 1;
      findings.push(
        buildReviewFinding({
          id: `F-${String(findings.length + 1).padStart(2, "0")}`,
          visibleId: tableFinding.visibleId,
          stableId: tableFinding.stableId,
          legacyDerived: tableFinding.legacyDerived,
          severity: tableFinding.severity,
          summary: tableFinding.summary,
          sourceSection: tableFinding.sourceSection,
          disposition: tableFinding.disposition,
          location: tableFinding.location?.display ?? null,
          evidence: tableFinding.evidence,
          impact: tableFinding.impact,
          recommendation: tableFinding.recommendation,
          classification: tableFinding.classification,
          defaultEligible: tableFinding.defaultEligible
        })
      );
    }
  }

  return {
    findings,
    severityCounts,
    followUps: uniqueOrderedStrings([
      ...collectSubstantiveReviewItems(
        content,
        /^(follow-?ups?|follow-up fixes|suggested repairs|recommended fixes|next actions?)$/i
      ),
      ...parsedFollowUps
    ]),
    followUpTargets: []
  };
}

function collectReviewCounts(
  content: string,
  artifact: ReviewArtifactKind
): {
  counts: ReviewRecordResult["counts"];
  followUps: string[];
} {
  const parsedFindings = parseFindingsFromArtifact(content, artifact);

  return {
    counts: {
      sections: countMarkdownSections(content),
      findings: parsedFindings.findings.length,
      followUps: parsedFindings.followUps.length
    },
    followUps: parsedFindings.followUps
  };
}

type LocatedReviewPhase = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName?: string | null;
  phaseDir: string;
  artifacts: string[];
};

function reviewRecordInvalidResult(args: {
  located: LocatedReviewPhase;
  artifact: ReviewArtifactKind;
  reportPath: string;
  counts?: ReviewRecordResult["counts"];
  followUps?: string[];
  diagnostics?: ReviewModelDiagnostic[];
  diagnosticCounts?: ReviewValidateModelResult["diagnosticCounts"];
  repairSummary?: ReviewModelRepairSummary;
  taskSchema?: Record<string, unknown> | null;
  warnings: string[];
}): ReviewRecordResult {
  return {
    phaseNumber: args.located.phaseNumber,
    phasePrefix: args.located.phasePrefix,
    phaseName: args.located.phaseName ?? `Phase ${args.located.phasePrefix}`,
    phaseDir: args.located.phaseDir,
    artifact: args.artifact,
    reportPath: args.reportPath,
    written: false,
    created: false,
    overwritten: false,
    status: "invalid",
    counts:
      args.counts ?? {
        sections: 0,
        findings: 0,
        followUps: 0
      },
    followUps: args.followUps ?? [],
    diagnostics: args.diagnostics,
    diagnosticCounts: args.diagnosticCounts,
    repairSummary: args.repairSummary,
    taskSchema: args.taskSchema ?? null,
    warnings: args.warnings
  };
}

function collectKnownCodeReviewEvidenceArtifacts(
  located: LocatedReviewPhase,
  reportPath: string
): string[] {
  return located.artifacts
    .filter((artifactPath) => artifactPath !== reportPath)
    .filter((artifactPath) =>
      /-(?:PLAN|SUMMARY|VERIFICATION|UAT|SECURITY)\.md$/i.test(artifactPath)
    )
    .sort((left, right) => left.localeCompare(right));
}

function validateCodeReviewEvidenceCoverage(
  content: string,
  knownEvidenceArtifacts: string[]
): string[] {
  if (knownEvidenceArtifacts.length === 0) {
    return [];
  }

  const evidenceSections = extractMarkdownSectionContent(content, /^Evidence Reviewed$/i).join("\n");
  const missingEvidence = knownEvidenceArtifacts.filter(
    (artifactPath) => !evidenceSections.includes(artifactPath)
  );

  return missingEvidence.length === 0
    ? []
    : [
        `Review artifact section Evidence Reviewed must cite or explicitly defer every saved phase evidence artifact. Missing: ${missingEvidence.join(", ")}.`
      ];
}

async function validateCodeReviewNextSafeAction(content: string): Promise<string[]> {
  return validateImplementedNextSafeAction(
    extractMarkdownSectionContent(content, /^Next Safe Action$/i).join("\n"),
    "Review artifact section Next Safe Action"
  );
}

function codeReviewModelSeverityCounts(
  findings: CodeReviewStructuredModel["findings"]
): Record<ReviewFindingSeverity, number> {
  const counts = emptySeverityCounts();

  for (const finding of findings) {
    counts[finding.severity] += 1;
  }

  return counts;
}

function renderCodeReviewFinding(
  finding: CodeReviewStructuredModel["findings"][number],
  index: number
): string {
  return `- [${finding.severity}][${finding.disposition}] \`${formatReviewTargetId("F", index)}\` \`${sanitizeMarkdownScalar(finding.location)}\` - Evidence: ${sanitizeMarkdownScalar(finding.evidence)} Impact: ${sanitizeMarkdownScalar(finding.impact)} Fix/verification: ${sanitizeMarkdownScalar(finding.recommendation)}`;
}

function renderCodeReviewEvidenceCoverage(args: {
  model: CodeReviewStructuredModel;
  knownEvidenceArtifacts: string[];
}): string[] {
  if (args.knownEvidenceArtifacts.length === 0) {
    return ["none"];
  }

  return args.knownEvidenceArtifacts.map((artifactPath) => {
    const coverage = args.model.evidenceCoverage[artifactPath];
    return `${artifactPath} - ${coverage.status}: ${coverage.rationale}`;
  });
}

function renderCodeReviewModelContent(
  model: CodeReviewStructuredModel,
  located: LocatedReviewPhase,
  authoringContext: CodeReviewAuthoringContext
): string {
  const severityCounts = codeReviewModelSeverityCounts(model.findings);
  const evidenceReviewed = renderCodeReviewEvidenceCoverage({
    model,
    knownEvidenceArtifacts: authoringContext.knownEvidenceArtifacts
  });
  const findings =
    model.findings.length > 0
      ? model.findings.map(renderCodeReviewFinding)
      : ["none"];

  return normalizeTextContent(`# Phase ${located.phasePrefix}: ${located.phaseName ?? `Phase ${located.phasePrefix}`} - Code Review

**Verdict:** ${model.verdict}

## Review Summary

- Depth: ${authoringContext.reviewMode.depth}
- Scope source: ${authoringContext.reviewMode.source}
- File count: ${authoringContext.files.length}
${renderBulletList(model.reviewSummary)}

## Scope Reviewed

${renderBulletList(authoringContext.files)}

## Evidence Reviewed

${renderBulletList(evidenceReviewed)}

## Positive Signals

${renderBulletList(model.positiveSignals)}

## Severity Summary

- critical: ${severityCounts.critical}
- high: ${severityCounts.high}
- medium: ${severityCounts.medium}
- low: ${severityCounts.low}
- unknown: ${severityCounts.unknown}

## Findings

${findings.join("\n")}

## Follow-Ups

${renderIdentifiedBulletList(model.followUps, "FU")}

## Next Safe Action

- ${model.nextSafeAction}
`);
}

function renderPeerReviewModelContent(
  model: PeerReviewStructuredModel,
  located: LocatedReviewPhase,
  authoringContext: PeerReviewAuthoringContext
): string {
  const completedReviewers = model.reviewerCoverage.filter((row) => row.status === "completed");
  const reviewers =
    completedReviewers.length > 0
      ? completedReviewers.map((row) => row.reviewer).join(", ")
      : "none";
  const reviewerRows = model.reviewerCoverage.map((row) => [
    row.reviewer,
    row.status,
    row.summary
  ]);
  const planRows = model.planReviews.map((row) => [
    `${row.planId} (${row.path})`,
    row.goalFit,
    row.summary
  ]);
  const findingRows = model.findings.map((row) => [
    row.severity,
    row.source,
    row.evidence,
    row.recommendation,
    row.status
  ]);
  const evidenceRows = authoringContext.knownEvidenceArtifacts.map((artifactPath) => {
    const coverage = model.evidenceCoverage[artifactPath];
    return [artifactPath, coverage.status, coverage.rationale];
  });

  return normalizeTextContent(`# Phase ${located.phasePrefix}: ${located.phaseName ?? `Phase ${located.phasePrefix}`} - Peer Reviews

**Reviewers:** ${reviewers}
**Status:** ${model.status}
**Readiness:** ${model.readiness}
**Completion State:** ${model.completionState}
**Next Safe Action:** ${model.nextSafeAction}

## Review Summary

${renderBulletList(model.reviewSummary)}

## Reviewer Coverage

${renderMarkdownTable(["Reviewer", "Status", "Summary"], reviewerRows)}

## Reviewer Results

${renderBulletList(completedReviewers.map((row) => `${row.reviewer}: ${row.summary}`))}

## Plan Reviews

${renderMarkdownTable(["Plan", "Goal Fit", "Summary"], planRows)}

## Findings

${renderMarkdownTable(["Severity", "Source", "Evidence", "Recommendation", "Status"], findingRows)}

## Consensus

${renderBulletList(model.consensus)}

## Disagreements

${renderBulletList(model.disagreements)}

## Risk Assessment

${renderMarkdownTable(["Level", "Summary"], [[model.riskAssessment.level, model.riskAssessment.summary]])}

## Manual / Deferred Work

${renderMarkdownTable(
  ["Item", "Reason", "Follow-Up", "Status"],
  model.manualOrDeferredWork.map((row) => [row.item, row.reason, row.followUp, row.status])
)}

## Gap / Repair Routes

${renderMarkdownTable(
  ["Gap", "Evidence", "Repair", "Status"],
  model.gapRoutes.map((row) => [row.gap, row.evidence, row.repair, row.status])
)}

## Follow-Ups

${renderBulletList(model.followUps)}

## Evidence Reviewed

${renderMarkdownTable(["Evidence", "Status", "Rationale"], evidenceRows)}

## Next Safe Action

- ${model.nextSafeAction}
`);
}

function markdownTableCell(value: string): string {
  return value.replace(/\r\n|\r|\n/g, " ").replace(/\|/g, "\\|").trim();
}

function renderMarkdownTable(headers: string[], rows: string[][]): string {
  return [
    headers,
    headers.map(() => "---"),
    ...rows
  ]
    .map((row) => `| ${row.map(markdownTableCell).join(" | ")} |`)
    .join("\n");
}

function renderReviewFixModelContent(
  model: ReviewFixStructuredModel,
  located: LocatedReviewPhase,
  authoringContext: ReviewFixAuthoringContext
): string {
  const targetById = new Map(
    authoringContext.targets.map((target) => [target.targetId, target])
  );
  const findingsRows = model.findingsAddressed.map((row) => {
    const target = targetById.get(row.findingId);
    const severity = target?.severity ?? "unknown";
    const summary = target?.summary ?? "Saved review target summary unavailable.";

    return `- [${severity}][${row.status}] \`${row.findingId}\` - ${summary} Evidence: ${row.evidence} Disposition: ${row.disposition}`;
  });

  return normalizeTextContent(`# Phase ${located.phasePrefix}: ${located.phaseName ?? `Phase ${located.phasePrefix}`} - Review Fix

**Status:** ${model.status}
**Readiness:** ${model.readiness}
**Completion State:** ${model.completionState}
**Source Review:** ${authoringContext.sourceReviewPath}
**Next Safe Action:** ${model.nextSafeAction}

## Remediation Summary

${renderBulletList(model.remediationSummary)}

## Findings Addressed

${findingsRows.join("\n")}

## Changes Made

${renderMarkdownTable(
  ["File", "Summary"],
  model.changesMade.map((row) => [row.file, row.summary])
)}

## Verification

${renderMarkdownTable(
  ["Check", "Command", "Result", "Evidence"],
  model.verification.map((row) => [row.check, row.command, row.result, row.evidence])
)}

## Dependency Plans

${renderMarkdownTable(
  ["Plan", "Status", "Evidence"],
  model.dependencyPlans.length > 0
    ? model.dependencyPlans.map((row) => [
        `${row.planId} (${row.path})`,
        row.status,
        row.evidence
      ])
    : [["none", "none", "none"]]
)}

## Manual / Deferred Work

${renderMarkdownTable(
  ["Item", "Reason", "Follow-Up", "Status"],
  model.manualOrDeferredWork.map((row) => [
    row.item,
    row.reason,
    row.followUp,
    row.status
  ])
)}

## Gap / Repair Routes

${renderMarkdownTable(
  ["Gap", "Evidence", "Repair", "Status"],
  model.gapRoutes.map((row) => [row.gap, row.evidence, row.repair, row.status])
)}

## Follow-Ups

${renderBulletList(model.followUps)}

## Evidence

${renderMarkdownTable(
  ["Kind", "Source", "Summary"],
  model.evidence.map((row) => [row.kind, row.source, row.summary])
)}

## Next Safe Action

- ${model.nextSafeAction}
`);
}

function securityThreatCounts(model: SecurityStructuredModel): {
  declared: number;
  closed: number;
  accepted: number;
  open: number;
} {
  const realThreats = model.threatRegister.filter((row) => row.threatId !== "none");

  return {
    declared: realThreats.length,
    closed: realThreats.filter((row) => row.status === "closed").length,
    accepted: realThreats.filter((row) => row.status === "accepted").length,
    open: realThreats.filter((row) => row.status === "open").length
  };
}

function renderSecurityEvidenceCoverage(args: {
  model: SecurityStructuredModel;
  knownEvidenceArtifacts: string[];
}): string[] {
  const artifactPaths = uniqueSortedStrings([
    ...args.knownEvidenceArtifacts,
    ...Object.keys(args.model.evidenceCoverage)
  ]);

  if (artifactPaths.length === 0) {
    return ["none"];
  }

  return artifactPaths.map((artifactPath) => {
    const coverage = args.model.evidenceCoverage[artifactPath];
    return coverage
      ? `${artifactPath} - ${coverage.status}: ${coverage.rationale}`
      : `${artifactPath} - unavailable: No evidenceCoverage entry was authored.`;
  });
}

function renderSecurityModelContent(
  model: SecurityStructuredModel,
  located: LocatedReviewPhase,
  authoringContext: SecurityAuthoringContext
): string {
  const threatById = new Map(
    authoringContext.declaredThreats.map((threat) => [threat.threatId, threat])
  );
  const counts = securityThreatCounts(model);
  const threatRows =
    model.threatRegister.length > 0
      ? model.threatRegister.map((row) => {
          if (row.threatId === "none") {
            return canonicalNoneTableRow(9);
          }

          const declared = threatById.get(row.threatId);

          return [
            row.threatId,
            declared?.sourcePlan ?? "unknown",
            declared?.category ?? "unknown",
            declared?.component ?? "unknown",
            declared?.disposition ?? "unknown",
            declared?.mitigation ?? "unknown",
            row.status,
            row.evidence,
            row.verifierNote
          ];
        })
      : [canonicalNoneTableRow(9)];
  const acceptedRiskRows =
    model.acceptedRisks.length > 0
      ? model.acceptedRisks.map((row) => [
          row.threatId,
          row.rationale,
          row.acceptedBy,
          row.acceptedAt,
          row.evidence
        ])
      : [canonicalNoneTableRow(5)];
  const findingRows =
    model.findings.length > 0
      ? model.findings.map((row) => [
          row.kind,
          row.severity,
          row.threatId,
          row.status,
          row.evidence,
          row.recommendation
        ])
      : [canonicalNoneTableRow(6)];
  const manualRows =
    model.manualOrDeferredWork.length > 0
      ? model.manualOrDeferredWork.map((row) => [
          row.item,
          row.reason,
          row.followUp,
          row.status
        ])
      : [canonicalNoneTableRow(4)];
  const gapRows =
    model.gapRoutes.length > 0
      ? model.gapRoutes.map((row) => [
          row.gap,
          row.evidence,
          row.repair,
          row.status
        ])
      : [canonicalNoneTableRow(4)];

  return normalizeTextContent(`# Phase ${located.phasePrefix}: ${located.phaseName ?? `Phase ${located.phasePrefix}`} - Security Review

**Status:** ${model.status}
**Readiness:** ${model.readiness}
**Completion State:** ${model.completionState}
**Next Safe Action:** ${model.nextSafeAction}

## Security Summary

- Declared threats: ${counts.declared}
- Closed threats: ${counts.closed}
- Accepted risks: ${counts.accepted}
- Open threats: ${counts.open}
${renderBulletList(model.securitySummary)}

## Evidence Reviewed

${renderBulletList(renderSecurityEvidenceCoverage({
  model,
  knownEvidenceArtifacts: authoringContext.knownEvidenceArtifacts
}))}

## Threat Register

${renderMarkdownTable(
  [
    "Threat ID",
    "Source Plan",
    "Category",
    "Component",
    "Disposition",
    "Mitigation",
    "Status",
    "Evidence",
    "Verifier Note"
  ],
  threatRows
)}

## Accepted Risks

${renderMarkdownTable(
  ["Threat ID", "Rationale", "Accepted By", "Accepted At", "Evidence"],
  acceptedRiskRows
)}

## Findings

${renderMarkdownTable(
  ["Kind", "Severity", "Threat ID", "Status", "Evidence", "Recommendation"],
  findingRows
)}

## Manual / Deferred Work

${renderMarkdownTable(
  ["Item", "Reason", "Follow-Up", "Status"],
  manualRows
)}

## Gap / Repair Routes

${renderMarkdownTable(
  ["Gap", "Evidence", "Repair", "Status"],
  gapRows
)}

## Follow-Ups

${renderBulletList(model.followUps)}

## Security Audit Trail

- Audit date: ${model.auditTrail.auditDate}
- Execution mode: ${model.auditTrail.executionMode}
- Overwrite gate: ${model.auditTrail.overwriteGate}
- Verify-or-accept decision: ${model.auditTrail.verifyOrAcceptDecision}
- Pending-open-threat status: ${model.auditTrail.pendingOpenThreatStatus}
- Verifier note: ${model.auditTrail.verifierNote}

## Next Safe Action

- ${model.nextSafeAction}
`);
}

function renderUiReviewEvidenceCoverage(args: {
  model: UiReviewStructuredModel;
  knownEvidenceArtifacts: string[];
}): string[] {
  const knownArtifacts = new Set(args.knownEvidenceArtifacts);
  const artifactCoverage = args.knownEvidenceArtifacts.map((artifactPath) => {
    const coverage = args.model.evidenceCoverage[artifactPath];
    return `${artifactPath} - ${coverage.status}: ${coverage.rationale}`;
  });
  const citedEvidence = uniqueOrderedStrings([
    ...args.model.pillarScores.map((row) => row.evidence),
    ...args.model.findings.map((row) => row.evidence)
  ])
    .map((evidence) => evidence.trim())
    .filter((evidence) => evidence.length > 0)
    .filter((evidence) => !isGenericNoneValue(evidence))
    .filter((evidence) => !knownArtifacts.has(evidence))
    .map((evidence) => `${evidence} - cited by pillar or finding evidence.`);

  return [...artifactCoverage, ...citedEvidence];
}

function renderUiReviewModelContent(
  model: UiReviewStructuredModel,
  located: LocatedReviewPhase,
  authoringContext: UiReviewAuthoringContext
): string {
  const priorityRows = model.priorityFixes.map((row, index) => [
    row.status === "NONE" ? "none" : String(index + 1),
    row.item,
    row.userImpact,
    row.repair,
    row.status
  ]);
  const findingRows = model.findings.map((row) => [
    row.pillar,
    row.severity,
    row.status,
    row.evidence,
    row.userImpact,
    row.recommendation
  ]);

  return normalizeTextContent(`# Phase ${located.phasePrefix}: ${located.phaseName ?? `Phase ${located.phasePrefix}`} - UI Review

**Verdict:** ${model.verdict}
**Readiness:** ${model.readiness}
**Completion State:** ${model.completionState}
**Next Safe Action:** ${model.nextSafeAction}

## UI Review Summary

- Overall score: ${model.overallScore}/24
- Completed summaries: ${authoringContext.completedSummaries.length}
- Pending plans: ${authoringContext.pendingPlans.length}
- Lower-wave pending plans: ${authoringContext.lowerWavePendingPlanIds.length}
${renderBulletList(model.uiReviewSummary)}

## Evidence Reviewed

${renderBulletList(renderUiReviewEvidenceCoverage({
  model,
  knownEvidenceArtifacts: authoringContext.knownEvidenceArtifacts
}))}

## Pillar Scores

${renderMarkdownTable(
  ["Pillar", "Score", "Evidence", "Key Finding"],
  model.pillarScores.map((row) => [
    row.pillar,
    `${row.score}/4`,
    row.evidence,
    row.keyFinding
  ])
)}

## Priority Fixes

${renderMarkdownTable(
  ["Priority", "Issue", "User Impact", "Repair", "Status"],
  priorityRows
)}

## Findings

${renderMarkdownTable(
  ["Pillar", "Severity", "Status", "Evidence", "User Impact", "Recommendation"],
  findingRows
)}

## Follow-Ups

${renderBulletList(model.followUps)}

## Audit Trail

- Audit date: ${model.auditTrail.auditDate}
- Execution mode: ${model.auditTrail.executionMode}
- Existing review posture: ${model.auditTrail.existingReviewPosture}
- Visual evidence: ${model.auditTrail.visualEvidence}
- Auditor path: ${model.auditTrail.auditorPath}
- Score consistency: ${model.auditTrail.scoreConsistencyNote}
- Confidence limitations: ${model.auditTrail.confidenceLimitations}

## Next Safe Action

- ${model.nextSafeAction}
`);
}

function ajvPathToModelPath(instancePath: string): string {
  if (instancePath.length === 0) {
    return "model";
  }

  return `model${instancePath
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      const decoded = segment.replace(/~1/g, "/").replace(/~0/g, "~");
      if (/^\d+$/.test(decoded)) {
        return `[${decoded}]`;
      }

      return /^[A-Za-z_][A-Za-z0-9_]*$/.test(decoded)
        ? `.${decoded}`
        : `[${JSON.stringify(decoded)}]`;
    })
    .join("")}`;
}

function appendJsonPointerSegment(pointer: string, segment: string): string {
  const encoded = segment.replace(/~/g, "~0").replace(/\//g, "~1");

  return pointer.length === 0 ? `/${encoded}` : `${pointer}/${encoded}`;
}

function valueAtJsonPointer(root: unknown, pointer: string): unknown {
  if (pointer.length === 0) {
    return root;
  }

  return pointer
    .split("/")
    .filter((segment) => segment.length > 0)
    .reduce<unknown>((current, segment) => {
      const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");

      if (Array.isArray(current) && /^\d+$/.test(key)) {
        return current[Number(key)];
      }

      if (typeof current === "object" && current !== null && key in current) {
        return (current as Record<string, unknown>)[key];
      }

      return undefined;
    }, root);
}

function normalizeAllowedValues(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) {
    return value;
  }

  return value === undefined ? undefined : [value];
}

function ajvAllowedValues(error: ErrorObject): unknown[] | undefined {
  if (
    typeof error.params === "object" &&
    error.params !== null &&
    "allowedValues" in error.params
  ) {
    return normalizeAllowedValues(error.params.allowedValues);
  }

  if (
    typeof error.params === "object" &&
    error.params !== null &&
    "allowedValue" in error.params
  ) {
    return normalizeAllowedValues(error.params.allowedValue);
  }

  return undefined;
}

function reviewSchemaExpected(error: ErrorObject, allowedValues?: unknown[]): unknown {
  if (allowedValues && allowedValues.length > 0) {
    return allowedValues;
  }

  if (error.keyword === "pattern" && "pattern" in error.params) {
    return `Value matching pattern ${String(error.params.pattern)}`;
  }

  if ((error.keyword === "minItems" || error.keyword === "maxItems") && "limit" in error.params) {
    return `${error.keyword === "minItems" ? "At least" : "At most"} ${String(error.params.limit)} item(s)`;
  }

  return error.keyword;
}

function schemaDiagnosticFromAjvError(
  error: ErrorObject,
  artifact: ReviewValidateModelArgs["artifact"],
  securityAuthoringContext: SecurityAuthoringContext | null = null,
  model?: Record<string, unknown>
): ReviewModelDiagnostic {
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
  const basePath = ajvPathToModelPath(error.instancePath);
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
  const params = typeof error.params === "object" && error.params !== null
    ? error.params as Record<string, unknown>
    : {};
  const allowedValues = ajvAllowedValues(error);
  const missing = missingProperty !== null ? [missingProperty] : undefined;
  const limit = typeof params.limit === "number" ? params.limit : null;
  const received =
    (error as ErrorObject & { data?: unknown }).data ??
    (model ? valueAtJsonPointer(model, jsonPointer) : undefined);
  const securityHintContext =
    artifact === "security" && securityAuthoringContext
      ? {
          allowedThreatIds: securityAuthoringContext.declaredThreats.map((threat) => threat.threatId),
          allowedEvidenceKeys: securityAuthoringContext.knownEvidenceArtifacts,
          allowedNextActions: securityAuthoringContext.allowedNextActions
        }
      : {};
  const securitySuggestion =
    artifact === "security" && securityAuthoringContext
      ? (() => {
          const allowedThreatIds = securityAuthoringContext.declaredThreats.map(
            (threat) => threat.threatId
          );

          if (
            /model\.(?:threatRegister|acceptedRisks|findings)(?:\[.*\])?\.threatId$/.test(pathValue)
          ) {
            if (allowedThreatIds.length === 0) {
              return "Revise the model to satisfy authoringContext.taskSchema returned by blueprint_review_authoring_context. No declared threats exist in the saved threat model; leave threatRegister empty and use threatId unregistered only for concrete unregistered findings.";
            }

            return `Revise the model to satisfy authoringContext.taskSchema returned by blueprint_review_authoring_context. Allowed threat ids from blueprint_review_authoring_context.authoringContext.declaredThreats: ${allowedThreatIds.length > 0 ? allowedThreatIds.join(", ") : "none"}.`;
          }

          if (pathValue.startsWith("model.evidenceCoverage")) {
            return `Revise the model to satisfy authoringContext.taskSchema returned by blueprint_review_authoring_context. Preferred evidenceCoverage keys from blueprint_review_authoring_context.authoringContext.knownEvidenceArtifacts: ${securityAuthoringContext.knownEvidenceArtifacts.length > 0 ? securityAuthoringContext.knownEvidenceArtifacts.join(", ") : "none"}.`;
          }

          if (pathValue === "model.nextSafeAction") {
            return `Revise the model to satisfy authoringContext.taskSchema returned by blueprint_review_authoring_context. Allowed next actions from blueprint_review_authoring_context.authoringContext.allowedNextActions: ${securityAuthoringContext.allowedNextActions.join(", ")}.`;
          }

          if (
            pathValue === "model.auditTrail.verifyOrAcceptDecision" ||
            pathValue === "model.auditTrail.pendingOpenThreatStatus"
          ) {
            return "Revise the model to satisfy authoringContext.taskSchema returned by blueprint_review_authoring_context. PARTIAL security reviews should not use a pending verify-or-accept decision or pending-open-threat state unless an open threat is actually blocking advancement.";
          }

          return "Revise the model to satisfy authoringContext.taskSchema returned by blueprint_review_authoring_context, then align threat ids, evidenceCoverage keys, and nextSafeAction with the live security authoring context.";
        })()
      : null;
  const defaultRepair =
    artifact === "security" && securitySuggestion
      ? securitySuggestion
      : artifact === "ui-review" ||
          artifact === "review-fix" ||
          artifact === "peer-review"
        ? "Revise the model to satisfy authoringContext.taskSchema returned by blueprint_review_authoring_context."
        : "Revise the model to satisfy the narrowed task schema returned by blueprint_review_scope.";
  let message = error.message ?? "Model does not match the review task schema.";
  let repair = defaultRepair;
  let argsPatch: Record<string, unknown> | undefined;

  if ((error.keyword === "enum" || error.keyword === "const") && allowedValues && allowedValues.length > 0) {
    message = `${pathValue} must be equal to one of the allowed values: ${allowedValues.map(String).join(", ")}.`;
    repair = `Set ${pathValue} to one of the allowed values from the current taskSchema: ${allowedValues.map(String).join(", ")}.`;
    if (received !== undefined) {
      argsPatch = { modelPatch: { path: jsonPointer, value: allowedValues[0] } };
    }
  } else if (error.keyword === "required" && missingProperty !== null) {
    message = `${pathValue} is required; must have required property '${missingProperty}'.`;
    repair = `Add ${pathValue} using the current taskSchema.`;
  } else if (error.keyword === "additionalProperties" && additionalProperty !== null) {
    message = `${pathValue} is not supported by review.${artifact ?? "code-review"}; must NOT have additional properties.`;
    repair = `Remove ${pathValue}; MCP owns identity, paths, rendered Markdown, and runtime provenance.`;
    argsPatch = { modelPatch: { op: "remove", path: jsonPointer } };
  } else if (error.keyword === "maxItems" && limit === 0) {
    message = `${pathValue} must be empty because the current runtime authoring context exposes no allowed items for this array.`;
    repair = `Set ${pathValue} to [] or re-read blueprint_review_authoring_context if you expected allowed rows.`;
  } else if (error.keyword === "maxItems" && limit !== null) {
    message = `${pathValue} must NOT have more than ${String(limit)} items.`;
    repair = `Remove extra entries from ${pathValue}.`;
  } else if (error.keyword === "minItems" && limit !== null) {
    message = `${pathValue} must NOT have fewer than ${String(limit)} items; must include at least ${String(limit)} item(s) from the current taskSchema.`;
    repair = `Populate ${pathValue} with concrete values allowed by the current taskSchema; do not invent ids or paths.`;
  } else if (error.keyword === "oneOf") {
    message = `${pathValue} must match exactly one schema for review.${artifact ?? "code-review"}.`;
    repair = `Use either a real row shape or the exact none sentinel shape for ${pathValue}; do not mix sentinel rows with real rows.`;
  } else if (error.keyword === "pattern" && "pattern" in params) {
    message = `${pathValue} must match pattern ${String(params.pattern)}.`;
    repair = `Rewrite ${pathValue} to satisfy the required format without Markdown headings, pipes, or newlines unless the schema allows them.`;
  } else if (error.keyword === "type" && "type" in params) {
    message = `${pathValue} must be ${String(params.type)}.`;
    repair = `Replace ${pathValue} with a ${String(params.type)} value that matches the current taskSchema.`;
  } else if (error.keyword === "if") {
    message = `${pathValue} must satisfy the review.${artifact ?? "code-review"} status truth table.`;
    repair = "Align status, readiness, completionState, gated rows, auditTrail, and nextSafeAction so they describe the same outcome.";
  }

  if (artifact === "security" && securitySuggestion && repair !== securitySuggestion) {
    repair = `${repair} ${securitySuggestion}`;
  }

  if (artifact === "security" && securitySuggestion && !message.includes(securitySuggestion)) {
    message = `${message} ${securitySuggestion}`;
  }

  return modelDiagnostic({
    source: "schema",
    path: pathValue,
    code: `schema.${error.keyword}`,
    message,
    context: {
      keyword: error.keyword,
      params: error.params,
      schemaPath: error.schemaPath,
      ...securityHintContext
    },
    received,
    expected: reviewSchemaExpected(error, allowedValues),
    allowedValues,
    missing,
    repair,
    retryable: true,
    argsPatch,
    suggestion: repair
  });
}

function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return null;
  }

  return value.map((item) => item.trim());
}

function normalizeCodeReviewFinding(
  finding: unknown
): CodeReviewStructuredModel["findings"][number] | null {
  const findingObject = asJsonObject(finding);

  if (
    !findingObject ||
    typeof findingObject.severity !== "string" ||
    typeof findingObject.disposition !== "string" ||
    typeof findingObject.location !== "string" ||
    typeof findingObject.evidence !== "string" ||
    typeof findingObject.impact !== "string" ||
    typeof findingObject.recommendation !== "string"
  ) {
    return null;
  }

  return {
    severity: findingObject.severity as ReviewFindingSeverity,
    disposition: findingObject.disposition as ReviewFindingDisposition,
    location: findingObject.location.trim(),
    evidence: findingObject.evidence.trim(),
    impact: findingObject.impact.trim(),
    recommendation: findingObject.recommendation.trim()
  };
}

function normalizeEvidenceCoverage(
  evidenceCoverage: Record<string, unknown>
): CodeReviewStructuredModel["evidenceCoverage"] | null {
  const normalized: CodeReviewStructuredModel["evidenceCoverage"] = {};

  for (const [artifactPath, coverage] of Object.entries(evidenceCoverage)) {
    const coverageObject = asJsonObject(coverage);

    if (
      !coverageObject ||
      typeof coverageObject.status !== "string" ||
      typeof coverageObject.rationale !== "string"
    ) {
      return null;
    }

    normalized[artifactPath] = {
      status: coverageObject.status as CodeReviewEvidenceCoverageStatus,
      rationale: coverageObject.rationale.trim()
    };
  }

  return normalized;
}

function normalizeCodeReviewModel(model: Record<string, unknown>): CodeReviewStructuredModel | null {
  const findings = Array.isArray(model.findings) ? model.findings : null;
  const evidenceCoverage = asJsonObject(model.evidenceCoverage);
  const reviewSummary = normalizeStringArray(model.reviewSummary);
  const positiveSignals = normalizeStringArray(model.positiveSignals);
  const followUps = normalizeStringArray(model.followUps);

  if (
    typeof model.verdict !== "string" ||
    reviewSummary === null ||
    positiveSignals === null ||
    findings === null ||
    evidenceCoverage === null ||
    followUps === null ||
    typeof model.nextSafeAction !== "string"
  ) {
    return null;
  }

  const normalizedFindings = findings.map(normalizeCodeReviewFinding);
  const normalizedEvidenceCoverage = normalizeEvidenceCoverage(evidenceCoverage);

  if (
    normalizedFindings.some((finding) => finding === null) ||
    normalizedEvidenceCoverage === null
  ) {
    return null;
  }

  return {
    verdict: model.verdict as CodeReviewStructuredModel["verdict"],
    reviewSummary,
    positiveSignals,
    findings: normalizedFindings as CodeReviewStructuredModel["findings"],
    evidenceCoverage: normalizedEvidenceCoverage,
    followUps,
    nextSafeAction: model.nextSafeAction.trim()
  };
}

function normalizeCodeReviewModelForResiduals(
  model: Record<string, unknown>
): CodeReviewStructuredModel {
  const findings = Array.isArray(model.findings)
    ? model.findings.flatMap((finding) => {
        const normalized = normalizeCodeReviewFinding(finding);
        return normalized ? [normalized] : [];
      })
    : [];
  const evidenceCoverage = asJsonObject(model.evidenceCoverage);

  return {
    verdict:
      typeof model.verdict === "string"
        ? model.verdict as CodeReviewStructuredModel["verdict"]
        : "" as CodeReviewStructuredModel["verdict"],
    reviewSummary: normalizeStringArray(model.reviewSummary) ?? [],
    positiveSignals: normalizeStringArray(model.positiveSignals) ?? [],
    findings,
    evidenceCoverage: evidenceCoverage
      ? normalizeEvidenceCoverage(evidenceCoverage) ?? {}
      : {},
    followUps: normalizeStringArray(model.followUps) ?? [],
    nextSafeAction:
      typeof model.nextSafeAction === "string" ? model.nextSafeAction.trim() : ""
  };
}

function normalizePeerReviewEvidenceCoverage(
  evidenceCoverage: Record<string, unknown>
): PeerReviewStructuredModel["evidenceCoverage"] | null {
  const normalized: PeerReviewStructuredModel["evidenceCoverage"] = {};

  for (const [artifactPath, coverage] of Object.entries(evidenceCoverage)) {
    const coverageObject = asJsonObject(coverage);

    if (
      !coverageObject ||
      typeof coverageObject.status !== "string" ||
      typeof coverageObject.rationale !== "string"
    ) {
      return null;
    }

    normalized[artifactPath] = {
      status: coverageObject.status as PeerReviewEvidenceCoverageStatus,
      rationale: coverageObject.rationale.trim()
    };
  }

  return normalized;
}

function normalizePeerReviewModel(model: Record<string, unknown>): PeerReviewStructuredModel | null {
  const reviewSummary = normalizeStringArray(model.reviewSummary);
  const reviewerCoverage = Array.isArray(model.reviewerCoverage) ? model.reviewerCoverage : null;
  const planReviews = Array.isArray(model.planReviews) ? model.planReviews : null;
  const findings = Array.isArray(model.findings) ? model.findings : null;
  const consensus = normalizeStringArray(model.consensus);
  const disagreements = normalizeStringArray(model.disagreements);
  const riskAssessment = asJsonObject(model.riskAssessment);
  const manualOrDeferredWork = Array.isArray(model.manualOrDeferredWork)
    ? model.manualOrDeferredWork
    : null;
  const gapRoutes = Array.isArray(model.gapRoutes) ? model.gapRoutes : null;
  const followUps = normalizeStringArray(model.followUps);
  const evidenceCoverage = asJsonObject(model.evidenceCoverage);

  if (
    typeof model.status !== "string" ||
    typeof model.readiness !== "string" ||
    typeof model.completionState !== "string" ||
    reviewSummary === null ||
    reviewerCoverage === null ||
    planReviews === null ||
    findings === null ||
    consensus === null ||
    disagreements === null ||
    !riskAssessment ||
    typeof riskAssessment.level !== "string" ||
    typeof riskAssessment.summary !== "string" ||
    manualOrDeferredWork === null ||
    gapRoutes === null ||
    followUps === null ||
    evidenceCoverage === null ||
    typeof model.nextSafeAction !== "string"
  ) {
    return null;
  }

  const normalizedReviewerCoverage = reviewerCoverage.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.reviewer === "string" &&
      typeof rowObject.status === "string" &&
      typeof rowObject.summary === "string"
      ? {
          reviewer: rowObject.reviewer.trim(),
          status: rowObject.status as PeerReviewReviewerStatus,
          summary: rowObject.summary.trim()
        }
      : null;
  });
  const normalizedPlanReviews = planReviews.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.planId === "string" &&
      typeof rowObject.path === "string" &&
      typeof rowObject.goalFit === "string" &&
      typeof rowObject.summary === "string"
      ? {
          planId: rowObject.planId.trim(),
          path: rowObject.path.trim(),
          goalFit: rowObject.goalFit as PeerReviewPlanFit,
          summary: rowObject.summary.trim()
        }
      : null;
  });
  const normalizedFindings = findings.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.severity === "string" &&
      typeof rowObject.source === "string" &&
      typeof rowObject.evidence === "string" &&
      typeof rowObject.recommendation === "string" &&
      typeof rowObject.status === "string"
      ? {
          severity: rowObject.severity as ReviewFindingSeverity,
          source: rowObject.source.trim(),
          evidence: rowObject.evidence.trim(),
          recommendation: rowObject.recommendation.trim(),
          status: rowObject.status as PeerReviewFindingStatus
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
          status: rowObject.status as PeerReviewManualStatus
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
          status: rowObject.status as PeerReviewGapStatus
        }
      : null;
  });
  const normalizedEvidenceCoverage = normalizePeerReviewEvidenceCoverage(evidenceCoverage);

  if (
    normalizedReviewerCoverage.some((row) => row === null) ||
    normalizedPlanReviews.some((row) => row === null) ||
    normalizedFindings.some((row) => row === null) ||
    normalizedManual.some((row) => row === null) ||
    normalizedGaps.some((row) => row === null) ||
    normalizedEvidenceCoverage === null
  ) {
    return null;
  }

  return {
    status: model.status as PeerReviewStatus,
    readiness: model.readiness as PeerReviewReadiness,
    completionState: model.completionState as PeerReviewCompletionState,
    reviewSummary,
    reviewerCoverage: normalizedReviewerCoverage as PeerReviewStructuredModel["reviewerCoverage"],
    planReviews: normalizedPlanReviews as PeerReviewStructuredModel["planReviews"],
    findings: normalizedFindings as PeerReviewStructuredModel["findings"],
    consensus,
    disagreements,
    riskAssessment: {
      level: riskAssessment.level as PeerReviewStructuredModel["riskAssessment"]["level"],
      summary: riskAssessment.summary.trim()
    },
    manualOrDeferredWork: normalizedManual as PeerReviewStructuredModel["manualOrDeferredWork"],
    gapRoutes: normalizedGaps as PeerReviewStructuredModel["gapRoutes"],
    followUps,
    evidenceCoverage: normalizedEvidenceCoverage,
    nextSafeAction: model.nextSafeAction.trim()
  };
}

function normalizePeerReviewModelForResiduals(
  model: Record<string, unknown>
): PeerReviewStructuredModel {
  return normalizePeerReviewModel(model) ?? {
    status:
      typeof model.status === "string"
        ? model.status as PeerReviewStatus
        : "" as PeerReviewStatus,
    readiness:
      typeof model.readiness === "string"
        ? model.readiness as PeerReviewReadiness
        : "" as PeerReviewReadiness,
    completionState:
      typeof model.completionState === "string"
        ? model.completionState as PeerReviewCompletionState
        : "" as PeerReviewCompletionState,
    reviewSummary: normalizeStringArray(model.reviewSummary) ?? [],
    reviewerCoverage: [],
    planReviews: [],
    findings: [],
    consensus: normalizeStringArray(model.consensus) ?? [],
    disagreements: normalizeStringArray(model.disagreements) ?? [],
    riskAssessment: {
      level: "LOW",
      summary: ""
    },
    manualOrDeferredWork: [],
    gapRoutes: [],
    followUps: normalizeStringArray(model.followUps) ?? [],
    evidenceCoverage: {},
    nextSafeAction:
      typeof model.nextSafeAction === "string" ? model.nextSafeAction.trim() : ""
  };
}

function normalizeReviewFixModel(
  model: Record<string, unknown>
): ReviewFixStructuredModel | null {
  const remediationSummary = normalizeStringArray(model.remediationSummary);
  const findingsAddressed = Array.isArray(model.findingsAddressed)
    ? model.findingsAddressed
    : null;
  const changesMade = Array.isArray(model.changesMade) ? model.changesMade : null;
  const verification = Array.isArray(model.verification) ? model.verification : null;
  const dependencyPlans = Array.isArray(model.dependencyPlans) ? model.dependencyPlans : null;
  const manualOrDeferredWork = Array.isArray(model.manualOrDeferredWork)
    ? model.manualOrDeferredWork
    : null;
  const gapRoutes = Array.isArray(model.gapRoutes) ? model.gapRoutes : null;
  const followUps = normalizeStringArray(model.followUps);
  const evidence = Array.isArray(model.evidence) ? model.evidence : null;

  if (
    typeof model.status !== "string" ||
    typeof model.readiness !== "string" ||
    typeof model.completionState !== "string" ||
    remediationSummary === null ||
    findingsAddressed === null ||
    changesMade === null ||
    verification === null ||
    dependencyPlans === null ||
    manualOrDeferredWork === null ||
    gapRoutes === null ||
    followUps === null ||
    evidence === null ||
    typeof model.nextSafeAction !== "string"
  ) {
    return null;
  }

  const normalizedFindings = findingsAddressed.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.findingId === "string" &&
      typeof rowObject.status === "string" &&
      typeof rowObject.evidence === "string" &&
      typeof rowObject.disposition === "string"
      ? {
          findingId: rowObject.findingId.trim(),
          status: rowObject.status as ReviewFixFindingStatus,
          evidence: rowObject.evidence.trim(),
          disposition: rowObject.disposition.trim()
        }
      : null;
  });
  const normalizedChanges = changesMade.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.file === "string" &&
      typeof rowObject.summary === "string"
      ? {
          file: rowObject.file.trim(),
          summary: rowObject.summary.trim()
        }
      : null;
  });
  const normalizedVerification = verification.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.check === "string" &&
      typeof rowObject.command === "string" &&
      typeof rowObject.result === "string" &&
      typeof rowObject.evidence === "string"
      ? {
          check: rowObject.check.trim(),
          command: rowObject.command.trim(),
          result: rowObject.result as ReviewFixVerificationResult,
          evidence: rowObject.evidence.trim()
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
          status: rowObject.status as ReviewFixDependencyStatus,
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
          status: rowObject.status as ReviewFixManualStatus
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
          status: rowObject.status as ReviewFixGapStatus
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
          kind: rowObject.kind as ReviewFixEvidenceKind,
          source: rowObject.source.trim(),
          summary: rowObject.summary.trim()
        }
      : null;
  });

  if (
    normalizedFindings.some((row) => row === null) ||
    normalizedChanges.some((row) => row === null) ||
    normalizedVerification.some((row) => row === null) ||
    normalizedDependencies.some((row) => row === null) ||
    normalizedManual.some((row) => row === null) ||
    normalizedGaps.some((row) => row === null) ||
    normalizedEvidence.some((row) => row === null)
  ) {
    return null;
  }

  return {
    status: model.status as ReviewFixStatus,
    readiness: model.readiness as ReviewFixReadiness,
    completionState: model.completionState as ReviewFixCompletionState,
    remediationSummary,
    findingsAddressed: normalizedFindings as ReviewFixStructuredModel["findingsAddressed"],
    changesMade: normalizedChanges as ReviewFixStructuredModel["changesMade"],
    verification: normalizedVerification as ReviewFixStructuredModel["verification"],
    dependencyPlans: normalizedDependencies as ReviewFixStructuredModel["dependencyPlans"],
    manualOrDeferredWork: normalizedManual as ReviewFixStructuredModel["manualOrDeferredWork"],
    gapRoutes: normalizedGaps as ReviewFixStructuredModel["gapRoutes"],
    followUps,
    evidence: normalizedEvidence as ReviewFixStructuredModel["evidence"],
    nextSafeAction: model.nextSafeAction.trim()
  };
}

function normalizeReviewFixModelForResiduals(
  model: Record<string, unknown>
): ReviewFixStructuredModel {
  return normalizeReviewFixModel(model) ?? {
    status: typeof model.status === "string" ? model.status as ReviewFixStatus : "PARTIAL",
    readiness:
      typeof model.readiness === "string"
        ? model.readiness as ReviewFixReadiness
        : "not-ready-for-validation",
    completionState:
      typeof model.completionState === "string"
        ? model.completionState as ReviewFixCompletionState
        : "pending",
    remediationSummary: normalizeStringArray(model.remediationSummary) ?? [],
    findingsAddressed: [],
    changesMade: [],
    verification: [],
    dependencyPlans: [],
    manualOrDeferredWork: [],
    gapRoutes: [],
    followUps: normalizeStringArray(model.followUps) ?? [],
    evidence: [],
    nextSafeAction:
      typeof model.nextSafeAction === "string" ? model.nextSafeAction.trim() : ""
  };
}

function normalizeSecurityEvidenceCoverage(
  evidenceCoverage: Record<string, unknown>
): SecurityStructuredModel["evidenceCoverage"] | null {
  const normalized: SecurityStructuredModel["evidenceCoverage"] = {};

  for (const [artifactPath, coverage] of Object.entries(evidenceCoverage)) {
    const coverageObject = asJsonObject(coverage);

    if (
      !coverageObject ||
      typeof coverageObject.status !== "string" ||
      typeof coverageObject.rationale !== "string"
    ) {
      return null;
    }

    normalized[artifactPath] = {
      status: coverageObject.status as SecurityEvidenceCoverageStatus,
      rationale: coverageObject.rationale.trim()
    };
  }

  return normalized;
}

function normalizeSecurityModel(model: Record<string, unknown>): SecurityStructuredModel | null {
  const securitySummary = normalizeStringArray(model.securitySummary);
  const followUps = normalizeStringArray(model.followUps);
  const evidenceCoverage = asJsonObject(model.evidenceCoverage);
  const threatRegister = Array.isArray(model.threatRegister) ? model.threatRegister : null;
  const acceptedRisks = Array.isArray(model.acceptedRisks) ? model.acceptedRisks : null;
  const findings = Array.isArray(model.findings) ? model.findings : null;
  const manualOrDeferredWork = Array.isArray(model.manualOrDeferredWork)
    ? model.manualOrDeferredWork
    : null;
  const gapRoutes = Array.isArray(model.gapRoutes) ? model.gapRoutes : null;
  const auditTrail = asJsonObject(model.auditTrail);

  if (
    typeof model.status !== "string" ||
    typeof model.readiness !== "string" ||
    typeof model.completionState !== "string" ||
    securitySummary === null ||
    evidenceCoverage === null ||
    threatRegister === null ||
    acceptedRisks === null ||
    findings === null ||
    manualOrDeferredWork === null ||
    gapRoutes === null ||
    followUps === null ||
    !auditTrail ||
    typeof auditTrail.auditDate !== "string" ||
    typeof auditTrail.executionMode !== "string" ||
    typeof auditTrail.overwriteGate !== "string" ||
    typeof auditTrail.verifyOrAcceptDecision !== "string" ||
    typeof auditTrail.pendingOpenThreatStatus !== "string" ||
    typeof auditTrail.verifierNote !== "string" ||
    typeof model.nextSafeAction !== "string"
  ) {
    return null;
  }

  const normalizedEvidenceCoverage = normalizeSecurityEvidenceCoverage(evidenceCoverage);
  const normalizedThreatRegister = threatRegister.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.threatId === "string" &&
      typeof rowObject.status === "string" &&
      typeof rowObject.evidence === "string" &&
      typeof rowObject.verifierNote === "string"
      ? {
          threatId: rowObject.threatId.trim(),
          status: rowObject.status as SecurityThreatStatus,
          evidence: rowObject.evidence.trim(),
          verifierNote: rowObject.verifierNote.trim()
        }
      : null;
  });
  const normalizedAcceptedRisks = acceptedRisks.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.threatId === "string" &&
      typeof rowObject.rationale === "string" &&
      (typeof rowObject.acceptedBy === "string" || rowObject.acceptedBy === undefined) &&
      (typeof rowObject.acceptedAt === "string" || rowObject.acceptedAt === undefined) &&
      typeof rowObject.evidence === "string"
      ? {
          threatId: rowObject.threatId.trim(),
          rationale: rowObject.rationale.trim(),
          acceptedBy: typeof rowObject.acceptedBy === "string" ? rowObject.acceptedBy.trim() : "unspecified",
          acceptedAt: typeof rowObject.acceptedAt === "string" ? rowObject.acceptedAt.trim() : "unspecified",
          evidence: rowObject.evidence.trim()
        }
      : null;
  });
  const normalizedFindings = findings.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.kind === "string" &&
      typeof rowObject.severity === "string" &&
      typeof rowObject.threatId === "string" &&
      typeof rowObject.evidence === "string" &&
      typeof rowObject.recommendation === "string" &&
      typeof rowObject.status === "string"
      ? {
          kind: rowObject.kind as SecurityStructuredModel["findings"][number]["kind"],
          severity: rowObject.severity as SecurityStructuredModel["findings"][number]["severity"],
          threatId: rowObject.threatId.trim(),
          evidence: rowObject.evidence.trim(),
          recommendation: rowObject.recommendation.trim(),
          status: rowObject.status as SecurityStructuredModel["findings"][number]["status"]
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
          status: rowObject.status as SecurityManualStatus
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
          status: rowObject.status as SecurityGapStatus
        }
      : null;
  });

  if (
    normalizedEvidenceCoverage === null ||
    normalizedThreatRegister.some((row) => row === null) ||
    normalizedAcceptedRisks.some((row) => row === null) ||
    normalizedFindings.some((row) => row === null) ||
    normalizedManual.some((row) => row === null) ||
    normalizedGaps.some((row) => row === null)
  ) {
    return null;
  }

  return {
    status: model.status as SecurityReviewStatus,
    readiness: model.readiness as SecurityReviewReadiness,
    completionState: model.completionState as SecurityReviewCompletionState,
    securitySummary,
    evidenceCoverage: normalizedEvidenceCoverage,
    threatRegister: normalizedThreatRegister as SecurityStructuredModel["threatRegister"],
    acceptedRisks: normalizedAcceptedRisks as SecurityStructuredModel["acceptedRisks"],
    findings: normalizedFindings as SecurityStructuredModel["findings"],
    manualOrDeferredWork: normalizedManual as SecurityStructuredModel["manualOrDeferredWork"],
    gapRoutes: normalizedGaps as SecurityStructuredModel["gapRoutes"],
    followUps,
    auditTrail: {
      auditDate: auditTrail.auditDate.trim(),
      executionMode: auditTrail.executionMode as SecurityStructuredModel["auditTrail"]["executionMode"],
      overwriteGate: auditTrail.overwriteGate as SecurityStructuredModel["auditTrail"]["overwriteGate"],
      verifyOrAcceptDecision: auditTrail.verifyOrAcceptDecision as SecurityStructuredModel["auditTrail"]["verifyOrAcceptDecision"],
      pendingOpenThreatStatus: auditTrail.pendingOpenThreatStatus as SecurityStructuredModel["auditTrail"]["pendingOpenThreatStatus"],
      verifierNote: auditTrail.verifierNote.trim()
    },
    nextSafeAction: model.nextSafeAction.trim()
  };
}

function normalizeSecurityModelForResiduals(
  model: Record<string, unknown>
): SecurityStructuredModel | null {
  return normalizeSecurityModel(model);
}

function normalizeUiReviewEvidenceCoverage(
  evidenceCoverage: Record<string, unknown>
): UiReviewStructuredModel["evidenceCoverage"] | null {
  const normalized: UiReviewStructuredModel["evidenceCoverage"] = {};

  for (const [artifactPath, coverage] of Object.entries(evidenceCoverage)) {
    const coverageObject = asJsonObject(coverage);

    if (
      !coverageObject ||
      typeof coverageObject.status !== "string" ||
      typeof coverageObject.rationale !== "string"
    ) {
      return null;
    }

    normalized[artifactPath] = {
      status: coverageObject.status as UiReviewEvidenceCoverageStatus,
      rationale: coverageObject.rationale.trim()
    };
  }

  return normalized;
}

function normalizeUiReviewModel(model: Record<string, unknown>): UiReviewStructuredModel | null {
  const uiReviewSummary = normalizeStringArray(model.uiReviewSummary);
  const evidenceCoverage = asJsonObject(model.evidenceCoverage);
  const pillarScores = Array.isArray(model.pillarScores) ? model.pillarScores : null;
  const priorityFixes = Array.isArray(model.priorityFixes) ? model.priorityFixes : null;
  const findings = Array.isArray(model.findings) ? model.findings : null;
  const followUps = normalizeStringArray(model.followUps);
  const auditTrail = asJsonObject(model.auditTrail);

  if (
    typeof model.verdict !== "string" ||
    typeof model.readiness !== "string" ||
    typeof model.completionState !== "string" ||
    typeof model.overallScore !== "number" ||
    uiReviewSummary === null ||
    evidenceCoverage === null ||
    pillarScores === null ||
    priorityFixes === null ||
    findings === null ||
    followUps === null ||
    !auditTrail ||
    typeof auditTrail.auditDate !== "string" ||
    typeof auditTrail.executionMode !== "string" ||
    typeof auditTrail.existingReviewPosture !== "string" ||
    typeof auditTrail.visualEvidence !== "string" ||
    typeof auditTrail.auditorPath !== "string" ||
    typeof auditTrail.scoreConsistencyNote !== "string" ||
    typeof auditTrail.confidenceLimitations !== "string" ||
    typeof model.nextSafeAction !== "string"
  ) {
    return null;
  }

  const normalizedEvidenceCoverage = normalizeUiReviewEvidenceCoverage(evidenceCoverage);
  const normalizedPillars = pillarScores.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.pillar === "string" &&
      typeof rowObject.score === "number" &&
      typeof rowObject.evidence === "string" &&
      typeof rowObject.keyFinding === "string"
      ? {
          pillar: rowObject.pillar as UiReviewPillar,
          score: rowObject.score,
          evidence: rowObject.evidence.trim(),
          keyFinding: rowObject.keyFinding.trim()
        }
      : null;
  });
  const normalizedPriorityFixes = priorityFixes.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.item === "string" &&
      typeof rowObject.userImpact === "string" &&
      typeof rowObject.repair === "string" &&
      typeof rowObject.status === "string"
      ? {
          item: rowObject.item.trim(),
          userImpact: rowObject.userImpact.trim(),
          repair: rowObject.repair.trim(),
          status: rowObject.status as UiReviewPriorityFixStatus
        }
      : null;
  });
  const normalizedFindings = findings.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.pillar === "string" &&
      typeof rowObject.severity === "string" &&
      typeof rowObject.evidence === "string" &&
      typeof rowObject.userImpact === "string" &&
      typeof rowObject.recommendation === "string" &&
      typeof rowObject.status === "string"
      ? {
          pillar: rowObject.pillar as UiReviewPillar | "none",
          severity: rowObject.severity as UiReviewFindingSeverity,
          evidence: rowObject.evidence.trim(),
          userImpact: rowObject.userImpact.trim(),
          recommendation: rowObject.recommendation.trim(),
          status: rowObject.status as UiReviewFindingStatus
        }
      : null;
  });

  if (
    normalizedEvidenceCoverage === null ||
    normalizedPillars.some((row) => row === null) ||
    normalizedPriorityFixes.some((row) => row === null) ||
    normalizedFindings.some((row) => row === null)
  ) {
    return null;
  }

  return {
    verdict: model.verdict as UiReviewVerdict,
    readiness: model.readiness as UiReviewReadiness,
    completionState: model.completionState as UiReviewCompletionState,
    uiReviewSummary,
    overallScore: model.overallScore,
    evidenceCoverage: normalizedEvidenceCoverage,
    pillarScores: normalizedPillars as UiReviewStructuredModel["pillarScores"],
    priorityFixes: normalizedPriorityFixes as UiReviewStructuredModel["priorityFixes"],
    findings: normalizedFindings as UiReviewStructuredModel["findings"],
    followUps,
    auditTrail: {
      auditDate: auditTrail.auditDate.trim(),
      executionMode: auditTrail.executionMode as UiReviewStructuredModel["auditTrail"]["executionMode"],
      existingReviewPosture: auditTrail.existingReviewPosture as UiReviewStructuredModel["auditTrail"]["existingReviewPosture"],
      visualEvidence: auditTrail.visualEvidence as UiReviewStructuredModel["auditTrail"]["visualEvidence"],
      auditorPath: auditTrail.auditorPath as UiReviewStructuredModel["auditTrail"]["auditorPath"],
      scoreConsistencyNote: auditTrail.scoreConsistencyNote.trim(),
      confidenceLimitations: auditTrail.confidenceLimitations.trim()
    },
    nextSafeAction: model.nextSafeAction.trim()
  };
}

function normalizeUiReviewModelForResiduals(
  model: Record<string, unknown>
): UiReviewStructuredModel | null {
  return normalizeUiReviewModel(model);
}

function parseCodeReviewLocation(location: string): {
  file: string;
  startLine: number;
  endLine: number;
} | null {
  const match = location.match(CODE_REVIEW_LOCATION_PATTERN);

  if (!match) {
    return null;
  }

  const file = match[1];
  const startLine = Number(match[2]);
  const endLine = match[3] ? Number(match[3]) : startLine;

  return {
    file,
    startLine,
    endLine
  };
}

async function countFileLines(filePath: string): Promise<number> {
  const content = await fs.readFile(filePath, "utf8");
  const contentWithoutTerminalNewline = content.replace(/(?:\r\n|\r|\n)$/, "");

  if (contentWithoutTerminalNewline.length === 0) {
    return content.length === 0 ? 0 : 1;
  }

  return contentWithoutTerminalNewline.split(/\r\n|\r|\n/).length;
}

function addGenericValueDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  model: CodeReviewStructuredModel;
}): void {
  for (const [field, values] of [
    ["reviewSummary", args.model.reviewSummary],
    ["positiveSignals", args.model.positiveSignals]
  ] as const) {
    values.forEach((value, index) => {
      if (isGenericNoneValue(value)) {
        args.diagnostics.push(
          modelDiagnostic({
            source: "residual",
            path: `model.${field}[${index}]`,
            code: "residual.generic_text",
            message: `Code-review model ${field} cannot use generic none values.`,
            context: { value },
            suggestion: "Replace the generic value with concrete review evidence."
          })
        );
      }
    });
  }

  if (
    args.model.findings.length > 0 &&
    args.model.followUps.every((followUp) => isGenericNoneValue(followUp))
  ) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.followUps",
        code: "residual.generic_text",
        message: "Code-review model with findings must include concrete followUps instead of generic none.",
        context: { findingCount: args.model.findings.length },
        suggestion: "Add a concrete fix, test, or validation follow-up for the findings."
      })
    );
  }

  args.model.findings.forEach((finding, index) => {
    for (const field of ["evidence", "impact", "recommendation"] as const) {
      if (isGenericNoneValue(finding[field])) {
        args.diagnostics.push(
          modelDiagnostic({
            source: "residual",
            path: `model.findings[${index}].${field}`,
            code: "residual.generic_text",
            message: `Code-review model findings.${index}.${field} must be concrete instead of generic none.`,
            context: { value: finding[field] },
            suggestion: "Replace the generic value with specific line-backed review reasoning."
          })
        );
      }
    }
  });

  for (const [artifactPath, coverage] of Object.entries(args.model.evidenceCoverage)) {
    if (isGenericNoneValue(coverage.rationale)) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.evidenceCoverage.${artifactPath}.rationale`,
          code: "residual.generic_text",
          message: `Code-review model evidenceCoverage rationale for ${artifactPath} must be concrete.`,
          context: { artifactPath, value: coverage.rationale },
          suggestion: "Explain why this exact evidence artifact was used, deferred, or irrelevant."
        })
      );
    }
  }
}

function addPlaceholderDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  model: Record<string, unknown>;
}): void {
  const modelContract = readArtifactContract("review.code-review").modelContract;
  const stringEntries = collectModelStringEntries(args.model);

  for (const entry of stringEntries) {
    if (hasPlaceholderLanguage(entry.value)) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: entry.path,
          code: "residual.placeholder_text",
          message: "Code-review model still contains placeholder language.",
          context: { value: entry.value },
          suggestion: "Replace placeholder wording with concrete review evidence."
        })
      );
    }
  }

  if (!modelContract) {
    return;
  }

  for (const signal of modelContract.exampleLeakageSignals) {
    const leakedEntry = stringEntries.find((entry) => entry.value.includes(signal));

    if (leakedEntry) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: leakedEntry.path,
          code: "residual.example_leakage",
          message: `Code-review model copied example leakage signal from ${modelContract.schemaId}.`,
          context: { signal },
          suggestion: "Replace copied example wording with review-specific evidence."
        })
      );
    }
  }
}

function addEvidenceCoverageDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  model: CodeReviewStructuredModel;
  knownEvidenceArtifacts: string[];
}): void {
  const knownEvidence = new Set(args.knownEvidenceArtifacts);
  const coverageKeys = Object.keys(args.model.evidenceCoverage);
  const missing = args.knownEvidenceArtifacts.filter(
    (artifactPath) => !(artifactPath in args.model.evidenceCoverage)
  );
  const unknown = coverageKeys.filter((artifactPath) => !knownEvidence.has(artifactPath));

  if (missing.length > 0) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.evidenceCoverage",
        code: "residual.evidence_missing",
        message: `Code-review model evidenceCoverage must include every known evidence artifact. Missing: ${missing.join(", ")}.`,
        context: { missing },
        suggestion: "Add exact evidenceCoverage keys from authoringContext.knownEvidenceArtifacts."
      })
    );
  }

  if (unknown.length > 0) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.evidenceCoverage",
        code: "residual.evidence_unknown",
        message: `Code-review model evidenceCoverage contains artifacts outside the live phase inventory: ${unknown.join(", ")}.`,
        context: { unknown },
        suggestion: "Remove invented or stale evidence keys and use only exact known evidence artifact paths."
      })
    );
  }
}

async function addFindingLocationDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  warnings: string[];
  projectRoot: string;
  model: CodeReviewStructuredModel;
  scopeFiles: string[];
}): Promise<void> {
  const scopeSet = new Set(args.scopeFiles);
  const seenLocations = new Map<string, number>();
  const rangesByFile = new Map<string, Array<{ index: number; startLine: number; endLine: number }>>();
  const distinctFindingDetails = (
    left: CodeReviewStructuredModel["findings"][number],
    right: CodeReviewStructuredModel["findings"][number]
  ): boolean =>
    left.disposition !== right.disposition ||
    sanitizeMarkdownScalar(left.evidence) !== sanitizeMarkdownScalar(right.evidence) ||
    sanitizeMarkdownScalar(left.impact) !== sanitizeMarkdownScalar(right.impact) ||
    sanitizeMarkdownScalar(left.recommendation) !== sanitizeMarkdownScalar(right.recommendation);

  for (const [index, finding] of args.model.findings.entries()) {
    const parsed = parseCodeReviewLocation(finding.location);

    if (!parsed) {
      continue;
    }

    if (scopeSet.size > 0 && !scopeSet.has(parsed.file)) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.findings[${index}].location`,
          code: "residual.location_out_of_scope",
          message: `Code-review model finding location is outside the resolved review scope: ${finding.location}.`,
          context: { location: finding.location, scopeFiles: args.scopeFiles },
          suggestion: "Use a file:line citation from the resolved blueprint_review_scope.files list."
        })
      );
    }

    if (parsed.startLine < 1 || parsed.endLine < parsed.startLine) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.findings[${index}].location`,
          code: "residual.invalid_line_range",
          message: `Code-review model finding has an invalid line range: ${finding.location}.`,
          context: { location: finding.location, startLine: parsed.startLine, endLine: parsed.endLine },
          suggestion: "Use one-based line numbers with an end line greater than or equal to the start line."
        })
      );
      continue;
    }

    let absolutePath: string;
    try {
      absolutePath = resolveRepoRelativePath(args.projectRoot, parsed.file);
    } catch (error) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.findings[${index}].location`,
          code: "residual.location_path_invalid",
          message:
            error instanceof Error
              ? error.message
              : `Code-review model finding path could not be resolved: ${parsed.file}.`,
          context: { location: finding.location, file: parsed.file },
          suggestion: "Use a repo-relative file path inside the resolved review scope."
        })
      );
      continue;
    }

    try {
      const stats = await fs.stat(absolutePath);
      if (!stats.isFile()) {
        args.diagnostics.push(
          modelDiagnostic({
            source: "residual",
            path: `model.findings[${index}].location`,
            code: "residual.location_not_file",
            message: `Code-review model finding path is not a file: ${parsed.file}.`,
            context: { location: finding.location, file: parsed.file },
            suggestion: "Use a repo-relative file path to an existing file."
          })
        );
        continue;
      }

      const lineCount = await countFileLines(absolutePath);
      if (parsed.endLine > lineCount) {
        args.diagnostics.push(
          modelDiagnostic({
            source: "residual",
            path: `model.findings[${index}].location`,
            code: "residual.line_range_missing",
            message: `Code-review model finding line range exceeds ${parsed.file}'s ${lineCount} line(s): ${finding.location}.`,
            context: { location: finding.location, file: parsed.file, lineCount },
            suggestion: "Update the finding to cite an existing line or line range."
          })
        );
      }
    } catch {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.findings[${index}].location`,
          code: "residual.location_missing_file",
          message: `Code-review model finding cites a file that does not exist: ${parsed.file}.`,
          context: { location: finding.location, file: parsed.file },
          suggestion: "Use a file returned by blueprint_review_scope.files."
        })
      );
    }

    const previousIndex = seenLocations.get(finding.location);
    if (previousIndex !== undefined) {
      if (distinctFindingDetails(args.model.findings[previousIndex], finding)) {
        args.warnings.push(
          `Code-review model reuses location ${finding.location} for distinct findings (${previousIndex} and ${index}).`
        );
      } else {
        args.diagnostics.push(
          modelDiagnostic({
            source: "residual",
            path: `model.findings[${index}].location`,
            code: "residual.duplicate_location",
            message: `Code-review model repeats the same finding location: ${finding.location}.`,
            context: { location: finding.location, firstFindingIndex: previousIndex, duplicateFindingIndex: index },
            suggestion: "Merge duplicate findings or cite distinct line-backed evidence."
          })
        );
      }
    } else {
      seenLocations.set(finding.location, index);
    }

    const ranges = rangesByFile.get(parsed.file) ?? [];
    const overlapping = ranges.find(
      (range) => parsed.startLine <= range.endLine && parsed.endLine >= range.startLine
    );

    if (overlapping) {
      if (distinctFindingDetails(args.model.findings[overlapping.index], finding)) {
        args.warnings.push(
          `Code-review model overlaps distinct finding ranges in ${parsed.file} (${overlapping.index} and ${index}).`
        );
      } else {
        args.diagnostics.push(
          modelDiagnostic({
            source: "residual",
            path: `model.findings[${index}].location`,
            code: "residual.conflicting_location",
            message: `Code-review model has overlapping finding locations in ${parsed.file}.`,
            context: {
              file: parsed.file,
              firstFindingIndex: overlapping.index,
              conflictingFindingIndex: index
            },
            suggestion: "Merge overlapping findings unless they cite distinct, non-overlapping evidence."
          })
        );
      }
    }

    ranges.push({
      index,
      startLine: parsed.startLine,
      endLine: parsed.endLine
    });
    rangesByFile.set(parsed.file, ranges);
  }
}

function addVerdictContradictionDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  model: CodeReviewStructuredModel;
}): void {
  const followUpFindings = args.model.findings.filter(
    (finding) => finding.disposition === "follow-up"
  );
  const blockedFindings = args.model.findings.filter(
    (finding) => finding.disposition === "blocked"
  );
  const nextAction = args.model.nextSafeAction;

  if (args.model.verdict === "PASS" && args.model.findings.length > 0) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.verdict",
        code: "residual.verdict_contradiction",
        message: "Code-review model verdict PASS contradicts non-empty findings.",
        context: { verdict: args.model.verdict, findingCount: args.model.findings.length },
        suggestion: "Use FOLLOW_UP or BLOCKED when findings remain, or remove non-actionable findings."
      })
    );
  }

  if (args.model.verdict === "FOLLOW_UP" && followUpFindings.length === 0) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.verdict",
        code: "residual.verdict_contradiction",
        message: "Code-review model verdict FOLLOW_UP requires at least one follow-up finding.",
        context: { verdict: args.model.verdict },
        suggestion: "Add a follow-up finding or change the verdict to PASS when no follow-up remains."
      })
    );
  }

  if (args.model.verdict === "BLOCKED" && blockedFindings.length === 0) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.verdict",
        code: "residual.verdict_contradiction",
        message: "Code-review model verdict BLOCKED requires at least one blocked finding.",
        context: { verdict: args.model.verdict },
        suggestion: "Mark the blocking finding disposition as blocked or use FOLLOW_UP for non-blocking fixes."
      })
    );
  }

  if (followUpFindings.length > 0 && nextAction === "/blu-progress") {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.nextSafeAction",
        code: "residual.next_action_contradiction",
        message: "Code-review model routes to /blu-progress while follow-up findings remain.",
        context: { nextSafeAction: nextAction, followUpFindingCount: followUpFindings.length },
        suggestion: "Route to /blu-code-review-fix <phase> or another allowed repair/validation action."
      })
    );
  }

  if (
    (args.model.verdict === "BLOCKED" || blockedFindings.length > 0) &&
    nextAction === "/blu-progress"
  ) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.nextSafeAction",
        code: "residual.next_action_contradiction",
        message: "Code-review model routes to /blu-progress while blocked findings or a BLOCKED verdict remain.",
        context: {
          verdict: args.model.verdict,
          nextSafeAction: nextAction,
          blockedFindingCount: blockedFindings.length
        },
        suggestion: "Route to /blu-code-review-fix <phase> or another allowed repair/validation action."
      })
    );
  }

  if (args.model.findings.length === 0 && /\/blu-code-review-fix\b/i.test(nextAction)) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.nextSafeAction",
        code: "residual.next_action_contradiction",
        message: "Code-review model routes to code-review-fix without findings.",
        context: { nextSafeAction: nextAction },
        suggestion: "Use /blu-progress or another allowed non-fix next action when no findings remain."
      })
    );
  }
}

async function collectCodeReviewResidualDiagnostics(args: {
  projectRoot: string;
  model: Record<string, unknown>;
  normalizedModel: CodeReviewStructuredModel | null;
  authoringContext: CodeReviewAuthoringContext;
}): Promise<{
  diagnostics: ReviewModelDiagnostic[];
  warnings: string[];
}> {
  const diagnostics: ReviewModelDiagnostic[] = [];
  const warnings: string[] = [];
  const identityKeys = Object.keys(args.model).filter((key) =>
    CODE_REVIEW_MODEL_IDENTITY_KEYS.has(key)
  );

  if (identityKeys.length > 0) {
    diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model",
        code: "residual.runtime_owned_field",
        message: `Code-review model must not include MCP-owned identity or rendering keys: ${identityKeys.join(", ")}.`,
        context: { identityKeys },
        suggestion: "Remove runtime-owned fields and author only the review.code-review model fields."
      })
    );
  }

  addPlaceholderDiagnostics({ diagnostics, model: args.model });

  if (!args.normalizedModel) {
    return { diagnostics, warnings };
  }

  addGenericValueDiagnostics({
    diagnostics,
    model: args.normalizedModel
  });
  addEvidenceCoverageDiagnostics({
    diagnostics,
    model: args.normalizedModel,
    knownEvidenceArtifacts: args.authoringContext.knownEvidenceArtifacts
  });
  await addFindingLocationDiagnostics({
    diagnostics,
    warnings,
    projectRoot: args.projectRoot,
    model: args.normalizedModel,
    scopeFiles: args.authoringContext.files
  });
  addVerdictContradictionDiagnostics({
    diagnostics,
    model: args.normalizedModel
  });

  const nextSafeActionIssues = await validateImplementedNextSafeAction(
    args.normalizedModel.nextSafeAction
  );
  for (const issue of nextSafeActionIssues) {
    diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.nextSafeAction",
        code: "residual.next_action_unimplemented",
        message: issue,
        context: { nextSafeAction: args.normalizedModel.nextSafeAction },
        suggestion: "Use one of authoringContext.allowedNextActions."
      })
    );
  }

  return { diagnostics, warnings };
}

async function collectPeerReviewResidualDiagnostics(args: {
  model: Record<string, unknown>;
  normalizedModel: PeerReviewStructuredModel;
  authoringContext: PeerReviewAuthoringContext;
}): Promise<ReviewModelDiagnostic[]> {
  const diagnostics: ReviewModelDiagnostic[] = [];
  const modelContract = readArtifactContract("review.peer-review").modelContract;
  const stringEntries = collectModelStringEntries(args.model);

  for (const key of Object.keys(args.model)) {
    if (PEER_REVIEW_MODEL_IDENTITY_KEYS.has(key)) {
      diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.${key}`,
          code: "residual.identity_key",
          message: `Peer-review model must not include MCP-owned identity field ${key}.`,
          context: { key },
          suggestion: "Remove identity/provenance fields from the model and pass them as MCP tool arguments."
        })
      );
    }
  }

  for (const entry of stringEntries) {
    if (hasPlaceholderLanguage(entry.value)) {
      diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: entry.path,
          code: "residual.placeholder_text",
          message: "Peer-review model still contains placeholder language.",
          context: { value: entry.value },
          suggestion: "Replace placeholder wording with concrete reviewer, plan, or saved evidence."
        })
      );
    }
  }

  if (modelContract) {
    for (const signal of modelContract.exampleLeakageSignals) {
      const leakedEntry = stringEntries.find((entry) => entry.value.includes(signal));

      if (leakedEntry) {
        diagnostics.push(
          modelDiagnostic({
            source: "residual",
            path: leakedEntry.path,
            code: "residual.example_leakage",
            message: `Peer-review model copied example leakage signal from ${modelContract.schemaId}.`,
            context: { signal },
            suggestion: "Replace copied example wording with reviewer-specific evidence."
          })
        );
      }
    }
  }

  const knownEvidence = new Set(args.authoringContext.knownEvidenceArtifacts);
  const coverageKeys = Object.keys(args.normalizedModel.evidenceCoverage);
  const missingEvidence = args.authoringContext.knownEvidenceArtifacts.filter(
    (artifactPath) => !(artifactPath in args.normalizedModel.evidenceCoverage)
  );
  const unknownEvidence = coverageKeys.filter((artifactPath) => !knownEvidence.has(artifactPath));

  if (missingEvidence.length > 0) {
    diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.evidenceCoverage",
        code: "residual.evidence_missing",
        message: `Peer-review model evidenceCoverage must include every saved peer-review evidence artifact. Missing: ${missingEvidence.join(", ")}.`,
        context: { missingEvidence },
        suggestion: "Use exact evidenceCoverage keys from authoringContext.knownEvidenceArtifacts."
      })
    );
  }

  if (unknownEvidence.length > 0) {
    diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.evidenceCoverage",
        code: "residual.evidence_unknown",
        message: `Peer-review model evidenceCoverage contains artifacts outside the live phase inventory: ${unknownEvidence.join(", ")}.`,
        context: { unknownEvidence },
        suggestion: "Remove invented or stale evidence keys and use only exact saved phase artifact paths."
      })
    );
  }

  const knownPlanKeys = new Set(
    args.authoringContext.plans.map((plan) => `${plan.planId}:${plan.path}`)
  );
  const modelPlanKeys = args.normalizedModel.planReviews.map(
    (plan) => `${plan.planId}:${plan.path}`
  );
  const unknownPlanKeys = modelPlanKeys.filter((key) => !knownPlanKeys.has(key));

  if (unknownPlanKeys.length > 0) {
    diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.planReviews",
        code: "residual.plan_out_of_scope",
        message: `Peer-review model planReviews contains plan rows outside the live selected plan inventory: ${unknownPlanKeys.join(", ")}.`,
        context: { unknownPlanKeys },
        suggestion: "Use only exact planId/path pairs from authoringContext.plans."
      })
    );
  }

  const nextSafeActionIssues = await validateImplementedNextSafeAction(
    args.normalizedModel.nextSafeAction,
    "Peer-review model nextSafeAction"
  );
  for (const issue of nextSafeActionIssues) {
    diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.nextSafeAction",
        code: "residual.next_action_unimplemented",
        message: issue,
        context: { nextSafeAction: args.normalizedModel.nextSafeAction },
        suggestion: "Use one of authoringContext.allowedNextActions."
      })
    );
  }

  return diagnostics;
}

function addReviewFixPlaceholderDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  model: Record<string, unknown>;
}): void {
  const modelContract = readArtifactContract("review.review-fix").modelContract;
  const stringEntries = collectModelStringEntries(args.model);

  for (const entry of stringEntries) {
    if (hasPlaceholderLanguage(entry.value)) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: entry.path,
          code: "residual.placeholder_text",
          message: "Review-fix model still contains placeholder language.",
          context: { value: entry.value },
          suggestion: "Replace placeholder wording with saved-finding, file, command, or artifact evidence."
        })
      );
    }
  }

  if (!modelContract) {
    return;
  }

  for (const signal of modelContract.exampleLeakageSignals) {
    const leakedEntry = stringEntries.find((entry) => entry.value.includes(signal));

    if (leakedEntry) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: leakedEntry.path,
          code: "residual.example_leakage",
          message: `Review-fix model copied example leakage signal from ${modelContract.schemaId}.`,
          context: { signal },
          suggestion: "Replace copied example wording with phase-specific remediation evidence."
        })
      );
    }
  }
}

function addReviewFixGenericValueDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  model: ReviewFixStructuredModel;
}): void {
  args.model.remediationSummary.forEach((value, index) => {
    if (isGenericNoneValue(value)) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.remediationSummary[${index}]`,
          code: "residual.generic_text",
          message: "Review-fix remediationSummary cannot use generic none values.",
          context: { value },
          suggestion: "Describe the bounded remediation result or blocker concretely."
        })
      );
    }
  });

  for (const [index, row] of args.model.findingsAddressed.entries()) {
    for (const field of ["evidence", "disposition"] as const) {
      if (isGenericNoneValue(row[field])) {
        args.diagnostics.push(
          modelDiagnostic({
            source: "residual",
            path: `model.findingsAddressed[${index}].${field}`,
            code: "residual.generic_text",
            message: `Review-fix findingsAddressed.${index}.${field} must be concrete.`,
            context: { value: row[field] },
            suggestion: "Tie the row to saved review evidence, code changes, verification, or a concrete blocker."
          })
        );
      }
    }
  }

  for (const [index, row] of args.model.changesMade.entries()) {
    if (row.file === "none") {
      continue;
    }
    if (isGenericNoneValue(row.summary)) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.changesMade[${index}].summary`,
          code: "residual.generic_text",
          message: "Review-fix changesMade summary must be concrete for real changed files.",
          context: { file: row.file, value: row.summary },
          suggestion: "Name what changed in this file for the selected saved finding."
        })
      );
    }
  }

  for (const [index, row] of args.model.verification.entries()) {
    if (row.result === "not-run" && row.check === "none" && row.command === "none") {
      continue;
    }
    for (const field of ["check", "command", "evidence"] as const) {
      if (isGenericNoneValue(row[field])) {
        args.diagnostics.push(
          modelDiagnostic({
            source: "residual",
            path: `model.verification[${index}].${field}`,
            code: "residual.generic_text",
            message: `Review-fix verification.${index}.${field} must be concrete unless it is the exact not-run sentinel.`,
            context: { value: row[field] },
            suggestion: "Record the focused command/check evidence or a concrete reason it could not run."
          })
        );
      }
    }
  }

  for (const [index, row] of args.model.evidence.entries()) {
    if (isGenericNoneValue(row.summary)) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.evidence[${index}].summary`,
          code: "residual.generic_text",
          message: "Review-fix evidence summary must be concrete.",
          context: { source: row.source, value: row.summary },
          suggestion: "Explain what this exact upstream artifact or repo path proves."
        })
      );
    }
  }
}

async function addReviewFixChangedFileDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  projectRoot: string;
  model: ReviewFixStructuredModel;
}): Promise<void> {
  for (const [index, row] of args.model.changesMade.entries()) {
    if (row.file === "none") {
      continue;
    }

    let absolutePath: string;
    try {
      absolutePath = resolveRepoRelativePath(args.projectRoot, row.file);
    } catch (error) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.changesMade[${index}].file`,
          code: "residual.changed_file_invalid",
          message:
            error instanceof Error
              ? error.message
              : `Review-fix changed file path could not be resolved: ${row.file}.`,
          context: { file: row.file },
          suggestion: "Use a repo-relative file path inside the repository."
        })
      );
      continue;
    }

    try {
      const stats = await fs.stat(absolutePath);
      if (!stats.isFile()) {
        args.diagnostics.push(
          modelDiagnostic({
            source: "residual",
            path: `model.changesMade[${index}].file`,
            code: "residual.changed_file_not_file",
            message: `Review-fix changed file path is not a file: ${row.file}.`,
            context: { file: row.file },
            suggestion: "Use a repo-relative path to a real changed file, or the exact none sentinel when no file changed."
          })
        );
      }
    } catch {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.changesMade[${index}].file`,
          code: "residual.changed_file_missing",
          message: `Review-fix changed file path does not exist: ${row.file}.`,
          context: { file: row.file },
          suggestion: "Use an existing repo-relative file touched by the remediation."
        })
      );
    }
  }
}

function duplicateReviewFixTargetIds(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicated = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicated.add(value);
    }
    seen.add(value);
  }

  return [...duplicated];
}

function formatReviewFixExpectedTargetIds(expectedTargetIds: string[]): string {
  return expectedTargetIds.length > 0 ? expectedTargetIds.join(", ") : "(none)";
}

function addReviewFixFindingIdDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  model: ReviewFixStructuredModel;
  authoringContext: ReviewFixAuthoringContext;
}): void {
  const expectedTargetIds = args.authoringContext.selectedTargetIds;
  const expectedTargetIdSet = new Set(expectedTargetIds);
  const knownTargetIds = args.authoringContext.targets.map((target) => target.targetId);
  const knownTargetIdSet = new Set(knownTargetIds);
  const actualTargetIds = args.model.findingsAddressed
    .map((row) => row.findingId.trim())
    .filter((targetId) => targetId.length > 0);
  const missingTargetIds = expectedTargetIds.filter(
    (targetId) => !actualTargetIds.includes(targetId)
  );
  const duplicateTargetIds = duplicateReviewFixTargetIds(actualTargetIds);
  const unknownTargetIds = uniqueOrderedStrings(
    actualTargetIds.filter((targetId) => !knownTargetIdSet.has(targetId))
  );
  const mismatchedTargetIds = uniqueOrderedStrings(
    actualTargetIds.filter(
      (targetId) => knownTargetIdSet.has(targetId) && !expectedTargetIdSet.has(targetId)
    )
  );
  const expectedText = formatReviewFixExpectedTargetIds(expectedTargetIds);
  const diagnosticContext = {
    expectedSelectedTargetIds: expectedTargetIds,
    actualFindingIds: actualTargetIds,
    knownTargetIds
  };
  const pushFindingIdDiagnostic = (argsForDiagnostic: {
    code: string;
    message: string;
    context: Record<string, unknown>;
  }): void => {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.findingsAddressed[].findingId",
        code: argsForDiagnostic.code,
        message: `Review-fix findingsAddressed[].findingId must exactly match authoringContext.selectedTargetIds. Expected selected IDs: ${expectedText}. ${argsForDiagnostic.message} ${REVIEW_FIX_TARGET_ID_COORDINATION_MESSAGE}`,
        context: {
          ...diagnosticContext,
          ...argsForDiagnostic.context
        },
        suggestion: REVIEW_FIX_TARGET_ID_COORDINATION_MESSAGE
      })
    );
  };

  if (unknownTargetIds.length > 0) {
    pushFindingIdDiagnostic({
      code: "residual.finding_id_unknown",
      message: `Unknown saved review target ids: ${unknownTargetIds.join(", ")}.`,
      context: { unknownTargetIds }
    });
  }

  if (mismatchedTargetIds.length > 0) {
    pushFindingIdDiagnostic({
      code: "residual.finding_id_mismatched",
      message: `Ids were found in the saved review baseline but were not selected for this review-fix pass: ${mismatchedTargetIds.join(", ")}.`,
      context: { mismatchedTargetIds }
    });
  }

  if (duplicateTargetIds.length > 0) {
    pushFindingIdDiagnostic({
      code: "residual.finding_id_duplicate",
      message: `Duplicate selected target ids: ${duplicateTargetIds.join(", ")}.`,
      context: { duplicateTargetIds }
    });
  }

  if (missingTargetIds.length > 0) {
    pushFindingIdDiagnostic({
      code: "residual.finding_id_missing",
      message: `Missing selected target ids: ${missingTargetIds.join(", ")}.`,
      context: { missingTargetIds }
    });
  }
}

async function collectReviewFixResidualDiagnostics(args: {
  projectRoot: string;
  model: Record<string, unknown>;
  normalizedModel: ReviewFixStructuredModel | null;
  authoringContext: ReviewFixAuthoringContext;
}): Promise<ReviewModelDiagnostic[]> {
  const diagnostics: ReviewModelDiagnostic[] = [];

  addReviewFixPlaceholderDiagnostics({ diagnostics, model: args.model });

  if (!args.normalizedModel) {
    return diagnostics;
  }

  addReviewFixGenericValueDiagnostics({
    diagnostics,
    model: args.normalizedModel
  });
  addReviewFixFindingIdDiagnostics({
    diagnostics,
    model: args.normalizedModel,
    authoringContext: args.authoringContext
  });
  await addReviewFixChangedFileDiagnostics({
    diagnostics,
    projectRoot: args.projectRoot,
    model: args.normalizedModel
  });

  return diagnostics;
}

function addSecurityPlaceholderDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  model: Record<string, unknown>;
}): void {
  const modelContract = readArtifactContract("review.security").modelContract;
  const stringEntries = collectModelStringEntries(args.model);

  for (const entry of stringEntries) {
    if (hasPlaceholderLanguage(entry.value)) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: entry.path,
          code: "residual.placeholder_text",
          message: "Security review model still contains placeholder language.",
          context: { value: entry.value },
          suggestion: "Replace placeholder wording with concrete security evidence."
        })
      );
    }
  }

  if (!modelContract) {
    return;
  }

  for (const signal of modelContract.exampleLeakageSignals) {
    const leakedEntry = stringEntries.find((entry) => entry.value.includes(signal));

    if (leakedEntry) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: leakedEntry.path,
          code: "residual.example_leakage",
          message: `Security review model copied example leakage signal from ${modelContract.schemaId}.`,
          context: { signal },
          suggestion: "Replace copied example wording with phase-specific security evidence."
        })
      );
    }
  }
}

function addSecurityGenericValueDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  model: SecurityStructuredModel;
}): void {
  args.model.securitySummary.forEach((value, index) => {
    if (isGenericNoneValue(value)) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.securitySummary[${index}]`,
          code: "residual.generic_text",
          message: "Security review summary cannot use generic none values.",
          context: { value },
          suggestion: "Replace the generic value with concrete security posture evidence."
        })
      );
    }
  });

  for (const [artifactPath, coverage] of Object.entries(args.model.evidenceCoverage)) {
    if (isGenericNoneValue(coverage.rationale)) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.evidenceCoverage.${artifactPath}.rationale`,
          code: "residual.generic_text",
          message: `Security review evidenceCoverage rationale for ${artifactPath} must be concrete.`,
          context: { artifactPath, value: coverage.rationale },
          suggestion: "Explain why this exact upstream artifact was used, deferred, or unavailable."
        })
      );
    }
  }

  for (const [index, row] of args.model.threatRegister.entries()) {
    if (row.threatId === "none") {
      continue;
    }

    for (const field of ["evidence", "verifierNote"] as const) {
      if (isGenericNoneValue(row[field])) {
        args.diagnostics.push(
          modelDiagnostic({
            source: "residual",
            path: `model.threatRegister[${index}].${field}`,
            code: "residual.generic_text",
            message: `Security review threatRegister.${index}.${field} must be concrete.`,
            context: { value: row[field] },
            suggestion: "Use artifact, code, acceptance, or explicit gap evidence for each declared threat."
          })
        );
      }
    }
  }
}

function normalizeThreatFlagMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function securityFindingMentionsThreatFlag(
  finding: SecurityStructuredModel["findings"][number],
  flag: SecuritySummaryThreatFlag
): boolean {
  const flagText = normalizeThreatFlagMatchText(flag.evidence);
  const findingText = normalizeThreatFlagMatchText(
    `${finding.evidence} ${finding.recommendation}`
  );

  return (
    flagText.length > 0 &&
    findingText.length > 0 &&
    findingText.includes(flagText)
  );
}

function addSecuritySemanticDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  model: SecurityStructuredModel;
  authoringContext: SecurityAuthoringContext;
}): void {
  const declaredThreatIds = new Set(args.authoringContext.declaredThreats.map((threat) => threat.threatId));
  const openThreats = args.model.threatRegister.filter((row) => row.status === "open");
  const acceptedThreatRows = args.model.threatRegister
    .filter((row) => row.status === "accepted")
    .map((row) => row.threatId);
  const acceptedRiskRows = args.model.acceptedRisks
    .filter((row) => row.threatId !== "none")
    .map((row) => row.threatId);
  const missingAcceptedRisks = acceptedThreatRows.filter(
    (threatId) => !acceptedRiskRows.includes(threatId)
  );
  const unexpectedAcceptedRisks = acceptedRiskRows.filter((threatId) => {
    const threatRow = args.model.threatRegister.find((row) => row.threatId === threatId);
    return !threatRow || threatRow.status !== "accepted";
  });
  const unknownThreatIds = args.model.threatRegister
    .filter((row) => row.threatId !== "none")
    .map((row) => row.threatId)
    .filter((threatId) => !declaredThreatIds.has(threatId));
  const realFindings = args.model.findings.filter((row) => row.kind !== "none");

  if (unknownThreatIds.length > 0) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.threatRegister",
        code: "residual.threat_unknown",
        message: declaredThreatIds.size === 0
          ? `Security review model contains threat ids but no declared threats exist in the saved threat model: ${unknownThreatIds.join(", ")}. Leave the threat register empty until saved threat model evidence exists.`
          : `Security review model contains threat ids outside the live saved-plan register: ${unknownThreatIds.join(", ")}.`,
        context: { unknownThreatIds },
        suggestion: "Use only exact threat ids from authoringContext.declaredThreats."
      })
    );
  }

  args.authoringContext.summaryThreatFlags.forEach((flag, index) => {
    if (flag.threatId && declaredThreatIds.has(flag.threatId)) {
      const matchingThreatRows = args.model.threatRegister.filter(
        (row) => row.threatId === flag.threatId && row.status !== "none"
      );
      const hasFindingCoverage = realFindings.some(
        (row) => securityFindingMentionsThreatFlag(row, flag)
      );

      if (matchingThreatRows.length === 0 && !hasFindingCoverage) {
        args.diagnostics.push(
          modelDiagnostic({
            source: "residual",
            path: `authoringContext.summaryThreatFlags[${index}]`,
            code: "residual.summary_threat_flag_uncovered",
            message: `Summary threat flag ${flag.flagId} maps to declared threat ${flag.threatId} but is not covered by the security model.`,
            context: { flag },
            suggestion: "Cover the flag with the matching threatRegister row or a concrete security finding."
          })
        );
      }

      return;
    }

    const matchingUnregisteredFindings = realFindings.filter(
      (row) => row.kind === "unregistered-flag" && row.threatId === "unregistered"
    );

    if (matchingUnregisteredFindings.length === 0) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `authoringContext.summaryThreatFlags[${index}]`,
          code: "residual.summary_threat_flag_uncovered",
          message: `Summary threat flag ${flag.flagId} is not registered in saved plan threats and must be covered by an unregistered-flag finding.`,
          context: { flag },
          suggestion: "Add a findings row with kind unregistered-flag, threatId unregistered, concrete evidence, and a follow-up route."
        })
      );
    }
  });

  if (missingAcceptedRisks.length > 0) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.acceptedRisks",
        code: "residual.accepted_risk_missing",
        message: `Accepted threat rows require matching acceptedRisks entries: ${missingAcceptedRisks.join(", ")}.`,
        context: { missingAcceptedRisks },
        suggestion: "Add accepted-risk rows with explicit acceptance source and date, or change the threat status."
      })
    );
  }

  if (unexpectedAcceptedRisks.length > 0) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.acceptedRisks",
        code: "residual.accepted_risk_contradiction",
        message: `Accepted risk rows must map to threatRegister rows with status accepted: ${unexpectedAcceptedRisks.join(", ")}.`,
        context: { unexpectedAcceptedRisks },
        suggestion: "Remove stale accepted-risk rows or mark the matching threat status as accepted."
      })
    );
  }

  if (
    openThreats.length > 0 &&
    args.model.nextSafeAction !== args.authoringContext.blockedNextSafeAction
  ) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.nextSafeAction",
        code: "residual.next_action_contradiction",
        message: `Open threat rows require the blocked pending-open-threat action until they are verified or explicitly accepted: ${openThreats.map((row) => row.threatId).join(", ")}.`,
        context: {
          openThreatIds: openThreats.map((row) => row.threatId),
          nextSafeAction: args.model.nextSafeAction
        },
        suggestion: "Use the blocked next action from authoringContext.allowedNextActions while any threatRegister row remains open."
      })
    );
  }

  if (
    openThreats.length === 0 &&
    args.model.nextSafeAction === args.authoringContext.blockedNextSafeAction
  ) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.nextSafeAction",
        code: "residual.next_action_contradiction",
        message: "Security review model uses the blocked pending-open-threat action without open threats.",
        context: { nextSafeAction: args.model.nextSafeAction },
        suggestion: "Use the status-safe next action from the runtime task schema."
      })
    );
  }
}

function collectSecurityDirectEvidenceCitations(args: {
  model: Record<string, unknown>;
  knownEvidenceArtifacts: string[];
}): Set<string> {
  const citations = new Set<string>();
  const stringEntries = collectModelStringEntries(args.model).filter(
    (entry) => !entry.path.startsWith("model.evidenceCoverage.")
  );

  for (const artifactPath of args.knownEvidenceArtifacts) {
    if (stringEntries.some((entry) => entry.value.includes(artifactPath))) {
      citations.add(artifactPath);
    }
  }

  return citations;
}

function addSecurityEvidenceCoverageBookkeepingFeedback(args: {
  diagnostics: ReviewModelDiagnostic[];
  warnings: string[];
  rawModel: Record<string, unknown>;
  normalizedModel: SecurityStructuredModel;
  authoringContext: SecurityAuthoringContext;
}): void {
  const knownEvidence = new Set(args.authoringContext.knownEvidenceArtifacts);
  const coverageKeys = Object.keys(args.normalizedModel.evidenceCoverage);
  const missingCoverage = args.authoringContext.knownEvidenceArtifacts.filter(
    (artifactPath) => !(artifactPath in args.normalizedModel.evidenceCoverage)
  );
  const unknownCoverage = coverageKeys.filter((artifactPath) => !knownEvidence.has(artifactPath));
  const directCitations = collectSecurityDirectEvidenceCitations({
    model: args.rawModel,
    knownEvidenceArtifacts: args.authoringContext.knownEvidenceArtifacts
  });
  const directlyCitedMissing = missingCoverage.filter((artifactPath) =>
    directCitations.has(artifactPath)
  );

  if (directlyCitedMissing.length > 0) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.evidenceCoverage",
        code: "residual.evidence_coverage_missing",
        message: `Security review model directly cites saved evidence artifacts without matching evidenceCoverage entries: ${directlyCitedMissing.join(", ")}.`,
        context: {
          directlyCitedMissing,
          allowedEvidenceKeys: args.authoringContext.knownEvidenceArtifacts
        },
        suggestion:
          "Add exact evidenceCoverage keys from blueprint_review_authoring_context.authoringContext.knownEvidenceArtifacts for every directly cited artifact."
      })
    );
  }

  if (unknownCoverage.length > 0) {
    args.warnings.push(
      `Security review model evidenceCoverage contains paths outside the live phase inventory: ${unknownCoverage.join(", ")}. Prefer exact keys from blueprint_review_authoring_context.authoringContext.knownEvidenceArtifacts.`
    );
  }
}

async function collectSecurityResidualDiagnostics(args: {
  model: Record<string, unknown>;
  normalizedModel: SecurityStructuredModel | null;
  authoringContext: SecurityAuthoringContext;
}): Promise<{ diagnostics: ReviewModelDiagnostic[]; warnings: string[] }> {
  const diagnostics: ReviewModelDiagnostic[] = [];
  const warnings: string[] = [];
  const identityKeys = Object.keys(args.model).filter((key) =>
    SECURITY_MODEL_IDENTITY_KEYS.has(key)
  );

  if (identityKeys.length > 0) {
    diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model",
        code: "residual.runtime_owned_field",
        message: `Security review model must not include MCP-owned identity or provenance keys: ${identityKeys.join(", ")}.`,
        context: { identityKeys },
        suggestion: "Remove runtime-owned fields and author only the review.security model fields."
      })
    );
  }

  addSecurityPlaceholderDiagnostics({ diagnostics, model: args.model });

  if (!args.normalizedModel) {
    return { diagnostics, warnings };
  }

  addSecurityEvidenceCoverageBookkeepingFeedback({
    diagnostics,
    warnings,
    rawModel: args.model,
    normalizedModel: args.normalizedModel,
    authoringContext: args.authoringContext
  });
  addSecurityGenericValueDiagnostics({
    diagnostics,
    model: args.normalizedModel
  });
  addSecuritySemanticDiagnostics({
    diagnostics,
    model: args.normalizedModel,
    authoringContext: args.authoringContext
  });

  const nextSafeActionIssues =
    args.normalizedModel.nextSafeAction === args.authoringContext.blockedNextSafeAction
      ? []
      : await validateImplementedNextSafeAction(
          args.normalizedModel.nextSafeAction,
          "Security review model nextSafeAction"
        );
  for (const issue of nextSafeActionIssues) {
    diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.nextSafeAction",
        code: "residual.next_action_unimplemented",
        message: issue,
        context: { nextSafeAction: args.normalizedModel.nextSafeAction },
        suggestion: "Use one of authoringContext.allowedNextActions."
      })
    );
  }

  return {
    diagnostics,
    warnings: uniqueSortedStrings(warnings)
  };
}

function addUiReviewPlaceholderDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  model: Record<string, unknown>;
}): void {
  const modelContract = readArtifactContract("review.ui-review").modelContract;
  const stringEntries = collectModelStringEntries(args.model);

  for (const entry of stringEntries) {
    if (hasPlaceholderLanguage(entry.value)) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: entry.path,
          code: "residual.placeholder_text",
          message: "UI-review model still contains placeholder language.",
          context: { value: entry.value },
          suggestion: "Replace placeholder wording with concrete UI review evidence."
        })
      );
    }
  }

  if (!modelContract) {
    return;
  }

  for (const signal of modelContract.exampleLeakageSignals) {
    const leakedEntry = stringEntries.find((entry) => entry.value.includes(signal));

    if (leakedEntry) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: leakedEntry.path,
          code: "residual.example_leakage",
          message: `UI-review model copied example leakage signal from ${modelContract.schemaId}.`,
          context: { signal },
          suggestion: "Replace copied example wording with UI-review-specific evidence."
        })
      );
    }
  }
}

function addUiReviewGenericValueDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  model: UiReviewStructuredModel;
}): void {
  args.model.uiReviewSummary.forEach((value, index) => {
    if (isGenericNoneValue(value)) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.uiReviewSummary[${index}]`,
          code: "residual.generic_text",
          message: "UI-review summary cannot use generic none values.",
          context: { value },
          suggestion: "Replace the generic value with concrete UI evidence and verdict rationale."
        })
      );
    }
  });

  for (const [artifactPath, coverage] of Object.entries(args.model.evidenceCoverage)) {
    if (isGenericNoneValue(coverage.rationale)) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.evidenceCoverage.${artifactPath}.rationale`,
          code: "residual.generic_text",
          message: `UI-review evidenceCoverage rationale for ${artifactPath} must be concrete.`,
          context: { artifactPath, value: coverage.rationale },
          suggestion: "Explain how this exact artifact informed the UI audit or why it was unavailable."
        })
      );
    }
  }

  args.model.pillarScores.forEach((row, index) => {
    if (isGenericNoneValue(row.keyFinding)) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.pillarScores[${index}].keyFinding`,
          code: "residual.generic_text",
          message: "UI-review pillar score must include a concrete key finding.",
          context: { pillar: row.pillar, value: row.keyFinding },
          suggestion: "Summarize the pass signal, limitation, or issue for this exact pillar."
        })
      );
    }
  });

  args.model.findings.forEach((row, index) => {
    if (row.status === "NONE") {
      return;
    }

    for (const field of ["evidence", "userImpact", "recommendation"] as const) {
      if (isGenericNoneValue(row[field])) {
        args.diagnostics.push(
          modelDiagnostic({
            source: "residual",
            path: `model.findings[${index}].${field}`,
            code: "residual.generic_text",
            message: `UI-review finding ${field} must be concrete instead of generic none.`,
            context: { value: row[field] },
            suggestion: "Replace the generic value with specific UI evidence, impact, or repair guidance."
          })
        );
      }
    }
  });
}

function addUiReviewSemanticDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  model: UiReviewStructuredModel;
}): void {
  const computedScore = args.model.pillarScores.reduce(
    (total, row) => total + row.score,
    0
  );

  if (computedScore !== args.model.overallScore) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.overallScore",
        code: "residual.score_mismatch",
        message: `UI-review overallScore must equal the six pillar scores (${computedScore}), not ${args.model.overallScore}.`,
        context: {
          computedScore,
          overallScore: args.model.overallScore
        },
        suggestion: "Recalculate overallScore from pillarScores before validation."
      })
    );
  }
}

function collectUiReviewEvidenceEntries(model: UiReviewStructuredModel): Array<{
  path: string;
  evidence: string;
}> {
  return [
    ...model.pillarScores.map((row, index) => ({
      path: `model.pillarScores[${index}].evidence`,
      evidence: row.evidence
    })),
    ...model.findings.map((row, index) => ({
      path: `model.findings[${index}].evidence`,
      evidence: row.evidence
    }))
  ];
}

async function addUiReviewRepoCitationDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  projectRoot: string;
  model: UiReviewStructuredModel;
}): Promise<void> {
  for (const entry of collectUiReviewEvidenceEntries(args.model)) {
    const parsed = parseCodeReviewLocation(entry.evidence);

    if (!parsed) {
      continue;
    }

    if (parsed.file.startsWith(".blueprint/")) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: entry.path,
          code: "residual.repo_citation_blueprint_artifact",
          message: `UI-review evidence must cite saved Blueprint artifacts without line suffixes: ${entry.evidence}.`,
          context: { evidence: entry.evidence, file: parsed.file },
          suggestion: "Use the exact saved artifact path from authoringContext.knownEvidenceArtifacts instead of a repo-line citation."
        })
      );
      continue;
    }

    if (parsed.startLine < 1 || parsed.endLine < parsed.startLine) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: entry.path,
          code: "residual.invalid_line_range",
          message: `UI-review evidence has an invalid repo line range: ${entry.evidence}.`,
          context: {
            evidence: entry.evidence,
            startLine: parsed.startLine,
            endLine: parsed.endLine
          },
          suggestion: "Use one-based line numbers with an end line greater than or equal to the start line."
        })
      );
      continue;
    }

    let absolutePath: string;
    try {
      absolutePath = resolveRepoRelativePath(args.projectRoot, parsed.file);
    } catch (error) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: entry.path,
          code: "residual.repo_citation_path_invalid",
          message:
            error instanceof Error
              ? error.message
              : `UI-review evidence path could not be resolved: ${parsed.file}.`,
          context: { evidence: entry.evidence, file: parsed.file },
          suggestion: "Use a repo-relative file:line citation inside the current repository."
        })
      );
      continue;
    }

    try {
      const stats = await fs.stat(absolutePath);
      if (!stats.isFile()) {
        args.diagnostics.push(
          modelDiagnostic({
            source: "residual",
            path: entry.path,
            code: "residual.repo_citation_not_file",
            message: `UI-review evidence path is not a file: ${parsed.file}.`,
            context: { evidence: entry.evidence, file: parsed.file },
            suggestion: "Use a repo-relative file path to an existing file."
          })
        );
        continue;
      }

      const lineCount = await countFileLines(absolutePath);
      if (parsed.endLine > lineCount) {
        args.diagnostics.push(
          modelDiagnostic({
            source: "residual",
            path: entry.path,
            code: "residual.repo_citation_line_missing",
            message: `UI-review evidence line range exceeds ${parsed.file}'s ${lineCount} line(s): ${entry.evidence}.`,
            context: {
              evidence: entry.evidence,
              file: parsed.file,
              lineCount
            },
            suggestion: "Update the evidence citation to an existing line or line range."
          })
        );
      }
    } catch {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: entry.path,
          code: "residual.repo_citation_missing_file",
          message: `UI-review evidence cites a file that does not exist: ${parsed.file}.`,
          context: { evidence: entry.evidence, file: parsed.file },
          suggestion: "Use a repo-relative file:line citation for a file that exists in this repository."
        })
      );
    }
  }
}

async function collectUiReviewResidualDiagnostics(args: {
  projectRoot: string;
  model: Record<string, unknown>;
  normalizedModel: UiReviewStructuredModel | null;
}): Promise<ReviewModelDiagnostic[]> {
  const diagnostics: ReviewModelDiagnostic[] = [];

  addUiReviewPlaceholderDiagnostics({ diagnostics, model: args.model });

  if (!args.normalizedModel) {
    return diagnostics;
  }

  addUiReviewGenericValueDiagnostics({
    diagnostics,
    model: args.normalizedModel
  });
  addUiReviewSemanticDiagnostics({
    diagnostics,
    model: args.normalizedModel
  });
  await addUiReviewRepoCitationDiagnostics({
    diagnostics,
    projectRoot: args.projectRoot,
    model: args.normalizedModel
  });

  const nextSafeActionIssues = await validateImplementedNextSafeAction(
    args.normalizedModel.nextSafeAction,
    "UI-review model nextSafeAction"
  );
  for (const issue of nextSafeActionIssues) {
    diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.nextSafeAction",
        code: "residual.next_action_unimplemented",
        message: issue,
        context: { nextSafeAction: args.normalizedModel.nextSafeAction },
        suggestion: "Use one of authoringContext.allowedNextActions."
      })
    );
  }

  return diagnostics;
}

function parsePlanIdForSuffix(
  pathValue: string,
  phasePrefix: string,
  suffix: "PLAN" | "SUMMARY"
): string | null {
  const match = pathValue.match(
    new RegExp(`${phasePrefix.replace(".", "\\.")}-(\\d+)-${suffix}\\.md$`)
  );

  if (!match) {
    return null;
  }

  return match[1].padStart(2, "0");
}

function isNormalReviewArtifactPath(artifactPath: string): boolean {
  return artifactPath.endsWith("-REVIEW.md") && !artifactPath.endsWith("-GOD-REVIEW.md");
}

function findPhaseArtifact(artifacts: string[], suffix: string): string | null {
  if (suffix === "-REVIEW.md") {
    return artifacts.find((artifact) => isNormalReviewArtifactPath(artifact)) ?? null;
  }

  return artifacts.find((artifact) => artifact.endsWith(suffix)) ?? null;
}

async function readRepoFileIfPresent(
  projectRoot: string,
  relativePath: string
): Promise<string | null> {
  try {
    const absolutePath = resolveRepoRelativePath(projectRoot, relativePath);
    return await fs.readFile(absolutePath, "utf8");
  } catch {
    return null;
  }
}

async function normalizeExplicitReviewFiles(
  projectRoot: string,
  files: string[],
  warnings: string[]
): Promise<NormalizeReviewFilesResult> {
  return normalizeReviewFiles(projectRoot, files, warnings, "explicit review");
}

const REVIEW_SCOPE_CONFIRMATION_THRESHOLDS = {
  broadFileCount: 5,
  multiPlanCount: 2,
  deepFileCount: 3
} as const;

async function normalizeReviewFiles(
  projectRoot: string,
  files: string[],
  warnings: string[],
  sourceLabel: string
): Promise<NormalizeReviewFilesResult> {
  const resolvedFiles = new Set<string>();
  let rejected = false;

  for (const rawFile of files) {
    const requestedPath = rawFile.trim();

    if (requestedPath.length === 0) {
      continue;
    }

    if (path.isAbsolute(requestedPath)) {
      warnings.push(
        `Invalid ${sourceLabel} path: ${requestedPath} (absolute filesystem paths are not allowed).`
      );
      rejected = true;
      continue;
    }

    if (hasGlobPattern(requestedPath)) {
      warnings.push(
        `Invalid ${sourceLabel} path: ${requestedPath} (wildcards are not allowed).`
      );
      rejected = true;
      continue;
    }

    let absolutePath: string;

    try {
      absolutePath = resolveRepoRelativePath(projectRoot, requestedPath);
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Invalid ${sourceLabel} path: ${requestedPath} (${error.message})`
          : `Invalid ${sourceLabel} path: ${requestedPath} (could not be resolved).`
      );
      rejected = true;
      continue;
    }

    const relativePath = toRepoRelativePath(projectRoot, absolutePath);

    if (relativePath.startsWith(".blueprint/")) {
      warnings.push(
        `Invalid ${sourceLabel} path: ${relativePath} (.blueprint artifacts are not reviewable repo files).`
      );
      rejected = true;
      continue;
    }

    let stats;

    try {
      stats = await fs.stat(absolutePath);
    } catch {
      warnings.push(`Invalid ${sourceLabel} path: ${relativePath} (file does not exist).`);
      rejected = true;
      continue;
    }

    if (!stats.isFile()) {
      warnings.push(
        `Invalid ${sourceLabel} path: ${relativePath} (${stats.isDirectory() ? "directories" : "non-file entries"} are not allowed).`
      );
      rejected = true;
      continue;
    }

    resolvedFiles.add(relativePath);
  }

  return {
    files: [...resolvedFiles].sort((left, right) => left.localeCompare(right)),
    rejected
  };
}

function extractPathCandidates(text: string): string[] {
  const candidates = new Set<string>();

  for (const match of text.matchAll(/`([^`]+)`/g)) {
    const candidate = match[1].trim();

    if (!isObviouslyNonPathMarkupToken(candidate)) {
      candidates.add(candidate);
    }
  }

  for (const match of text.matchAll(
    /(?:^|[\s("'`])((?:\.{1,2}\/)?(?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+(?:\.[A-Za-z0-9._-]+)?)(?=$|[\s"'`),.;:!?])/g
  )) {
    const candidate = match[1].trim();

    if (!isObviouslyNonPathMarkupToken(candidate)) {
      candidates.add(candidate);
    }
  }

  return [...candidates].filter((candidate) => candidate.length > 0);
}

async function deriveReviewFilesFromSummaries(
  projectRoot: string,
  located: {
    artifacts: string[];
  },
  warnings: string[]
): Promise<{
  files: string[];
  summaryCount: number;
}> {
  const summaryFiles = located.artifacts.filter((artifact) =>
    artifact.endsWith("-SUMMARY.md")
  );

  if (summaryFiles.length === 0) {
    warnings.push(
      "No saved execution summaries were found for the selected phase, so Blueprint could not derive a review scope from summary evidence."
    );
  }

  const resolvedFiles = new Set<string>();

  for (const summaryPath of summaryFiles) {
    const content = await readRepoFileIfPresent(projectRoot, summaryPath);

    if (content === null) {
      warnings.push(`Skipped unreadable summary artifact while deriving review scope: ${summaryPath}`);
      continue;
    }

    const summaryEntries = extractMarkdownSectionEntries(
      content,
      /^changes made$/i
    );

    for (const entry of summaryEntries) {
      for (const candidate of extractPathCandidates(entry.items.join("\n"))) {
        let absolutePath: string;

        try {
          absolutePath = resolveRepoRelativePath(projectRoot, candidate);
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? error.message
              : `Could not resolve summary-derived review path from ${summaryPath}: ${candidate}`
          );
          continue;
        }

        const relativePath = toRepoRelativePath(projectRoot, absolutePath);

        if (relativePath.startsWith(".blueprint/")) {
          warnings.push(
            `Skipped Blueprint artifact path from ${summaryPath} review scope: ${relativePath}`
          );
          continue;
        }

        let stats;

        try {
          stats = await fs.stat(absolutePath);
        } catch {
          warnings.push(
            `Skipped missing repo path from ${summaryPath} review scope: ${relativePath}`
          );
          continue;
        }

        if (!stats.isFile()) {
          warnings.push(
            `Skipped non-file repo path from ${summaryPath} review scope: ${relativePath}`
          );
          continue;
        }

        resolvedFiles.add(relativePath);
      }
    }
  }

  return {
    files: [...resolvedFiles].sort((left, right) => left.localeCompare(right)),
    summaryCount: summaryFiles.length
  };
}

async function deriveReviewFilesFromPlans(
  projectRoot: string,
  located: {
    phaseNumber: string;
    phasePrefix: string;
    artifacts: string[];
  },
  warnings: string[]
): Promise<{
  files: string[];
  matchedPlanCount: number;
}> {
  const summaryPlanIds = new Set(
    located.artifacts
      .filter((artifact) => artifact.endsWith("-SUMMARY.md"))
      .map((artifact) => parsePlanIdForSuffix(artifact, located.phasePrefix, "SUMMARY"))
      .filter((planId): planId is string => planId !== null)
  );

  if (summaryPlanIds.size === 0) {
    warnings.push(
      "No execution summaries were found for the selected phase, so Blueprint could not derive a review scope from executed plans."
    );

    return {
      files: [],
      matchedPlanCount: 0
    };
  }

  const planPaths = located.artifacts.filter((artifact) => {
    if (!artifact.endsWith("-PLAN.md")) {
      return false;
    }

    const planId = parsePlanIdForSuffix(artifact, located.phasePrefix, "PLAN");
    return planId !== null && summaryPlanIds.has(planId);
  });

  if (planPaths.length === 0) {
    warnings.push(
      "Execution summaries exist, but the matching plan artifacts were missing, so Blueprint could not derive changed repo files for review."
    );

    return {
      files: [],
      matchedPlanCount: 0
    };
  }

  const resolvedFiles = new Set<string>();

  for (const planPath of planPaths) {
    const content = await readRepoFileIfPresent(projectRoot, planPath);

    if (content === null) {
      warnings.push(`Skipped unreadable plan artifact while deriving review scope: ${planPath}`);
      continue;
    }

    const validation = validatePlanArtifactContent(content, located.phaseNumber);

    if (!validation.valid) {
      warnings.push(
        `Plan metadata issues in ${planPath}: ${validation.issues.join(" ")}`
      );
    }

    for (const plannedPath of validation.metadata.filesModified) {
      const requestedPath = plannedPath.trim();

      if (requestedPath.length === 0) {
        continue;
      }

      if (requestedPath.includes("*")) {
        warnings.push(
          `Skipped wildcard review scope entry from ${planPath}: ${requestedPath}`
        );
        continue;
      }

      let absolutePath: string;

      try {
        absolutePath = resolveRepoRelativePath(projectRoot, requestedPath);
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? error.message
            : `Could not resolve planned review path from ${planPath}: ${requestedPath}`
        );
        continue;
      }

      const relativePath = toRepoRelativePath(projectRoot, absolutePath);

      if (relativePath.startsWith(".blueprint/")) {
        warnings.push(
          `Skipped Blueprint artifact path from ${planPath} review scope: ${relativePath}`
        );
        continue;
      }

      let stats;

      try {
        stats = await fs.stat(absolutePath);
      } catch {
        warnings.push(
          `Skipped missing repo path from ${planPath} review scope: ${relativePath}`
        );
        continue;
      }

      if (!stats.isFile()) {
        warnings.push(
          `Skipped non-file repo path from ${planPath} review scope: ${relativePath}`
        );
        continue;
      }

      resolvedFiles.add(relativePath);
    }
  }

  return {
    files: [...resolvedFiles].sort((left, right) => left.localeCompare(right)),
    matchedPlanCount: planPaths.length
  };
}

function determineReviewModeSource(
  explicitFiles: string[],
  summaryFiles: string[],
  planFiles: string[]
): ReviewModeSource {
  if (explicitFiles.length > 0) {
    return "explicit-files";
  }

  if (summaryFiles.length > 0 && planFiles.length > 0) {
    return "phase-evidence";
  }

  if (summaryFiles.length > 0) {
    return "phase-summaries";
  }

  return "phase-plans";
}

function buildReviewScopeConfirmation(args: {
  fileCount: number;
  summaryCount: number;
  matchedPlanCount: number;
  depth: ReviewDepth;
  source: ReviewModeSource;
}): ReviewScopeConfirmation {
  const reasons: string[] = [];

  if (args.fileCount >= REVIEW_SCOPE_CONFIRMATION_THRESHOLDS.broadFileCount) {
    reasons.push(
      `Resolved scope includes ${args.fileCount} files, meeting the broad-scope confirmation threshold of ${REVIEW_SCOPE_CONFIRMATION_THRESHOLDS.broadFileCount}.`
    );
  }

  if (
    args.source !== "explicit-files" &&
    args.summaryCount >= REVIEW_SCOPE_CONFIRMATION_THRESHOLDS.multiPlanCount
  ) {
    reasons.push(
      `Resolved scope includes evidence from ${args.summaryCount} executed plans, meeting the multi-plan confirmation threshold of ${REVIEW_SCOPE_CONFIRMATION_THRESHOLDS.multiPlanCount}.`
    );
  }

  if (
    args.depth === "deep" &&
    args.fileCount >= REVIEW_SCOPE_CONFIRMATION_THRESHOLDS.deepFileCount
  ) {
    reasons.push(
      `Deep review over ${args.fileCount} files meets the deep-review confirmation threshold of ${REVIEW_SCOPE_CONFIRMATION_THRESHOLDS.deepFileCount}.`
    );
  }

  return {
    recommended: reasons.length > 0,
    pendingGate: reasons.length > 0 ? "scope-confirmation" : "none",
    reasons,
    thresholds: { ...REVIEW_SCOPE_CONFIRMATION_THRESHOLDS },
    signals: {
      fileCount: args.fileCount,
      summaryCount: args.summaryCount,
      matchedPlanCount: args.matchedPlanCount,
      depth: args.depth,
      source: args.source
    }
  };
}

function resolveConfiguredReviewDepth(
  value: unknown,
  warnings: string[]
): ReviewDepth {
  if (value === "quick" || value === "standard" || value === "deep") {
    return value;
  }

  if (value !== undefined) {
    warnings.push(
      `Ignoring invalid workflow.code_review_depth value and using standard instead: ${String(value)}`
    );
  }

  return "standard";
}

async function resolveReviewSettings(projectRoot: string, requestedDepth?: ReviewDepth): Promise<{
  allowed: boolean;
  depth: ReviewDepth;
  warnings: string[];
}> {
  try {
    const config = await blueprintConfigGet({
      scope: "effective",
      cwd: projectRoot
    });
    const warnings = [...config.warnings];

    return {
      allowed: config.config.workflow.code_review,
      depth:
        requestedDepth ??
        resolveConfiguredReviewDepth(config.config.workflow.code_review_depth, warnings),
      warnings
    };
  } catch {
    return {
      allowed: true,
      depth: requestedDepth ?? "standard",
      warnings: ["Blueprint review config could not be read; using standard depth."]
    };
  }
}

export async function blueprintReviewScope(
  args: ReviewScopeArgs
): Promise<ReviewScopeResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate({
    cwd: projectRoot,
    phase: args.phase
  });
  const reviewSettings = await resolveReviewSettings(projectRoot, args.depth);
  const explicitScopeRequested = (args.files ?? []).some((candidate) => candidate.trim().length > 0);
  const artifacts = {
    plans: located.artifacts
      .filter((artifact) => artifact.endsWith("-PLAN.md"))
      .sort((left, right) => left.localeCompare(right)),
    summaries: located.artifacts
      .filter((artifact) => artifact.endsWith("-SUMMARY.md"))
      .sort((left, right) => left.localeCompare(right)),
    verification: findPhaseArtifact(located.artifacts, "-VERIFICATION.md"),
    uat: findPhaseArtifact(located.artifacts, "-UAT.md"),
    existingReview: findPhaseArtifact(located.artifacts, "-REVIEW.md"),
    security: findPhaseArtifact(located.artifacts, "-SECURITY.md")
  };

  if (
    !located.found ||
    !located.phaseNumber ||
    !located.phasePrefix ||
    !located.phaseDir
  ) {
    return {
      status: "invalid",
      phase: null,
      files: [],
      reviewMode: {
        depth: reviewSettings.depth,
        source: explicitScopeRequested ? "explicit-files" : "phase-plans"
      },
      confirmationRecommended: buildReviewScopeConfirmation({
        fileCount: 0,
        summaryCount: artifacts.summaries.length,
        matchedPlanCount: 0,
        depth: reviewSettings.depth,
        source: explicitScopeRequested ? "explicit-files" : "phase-plans"
      }),
      artifacts,
      reason: located.reason ?? "Phase could not be resolved for review scoping.",
      warnings: [...located.warnings, ...reviewSettings.warnings]
    };
  }

  if (!reviewSettings.allowed) {
    return {
      status: "invalid",
      phase: {
        phaseNumber: located.phaseNumber,
        phasePrefix: located.phasePrefix,
        phaseName:
          located.phaseName ??
          `Phase ${located.phasePrefix} ${path.basename(located.phaseDir)}`,
        phaseDir: located.phaseDir,
        resolvedFrom: located.resolvedFrom
      },
      files: [],
      reviewMode: {
        depth: reviewSettings.depth,
        source: explicitScopeRequested ? "explicit-files" : "phase-plans"
      },
      confirmationRecommended: buildReviewScopeConfirmation({
        fileCount: 0,
        summaryCount: artifacts.summaries.length,
        matchedPlanCount: 0,
        depth: reviewSettings.depth,
        source: explicitScopeRequested ? "explicit-files" : "phase-plans"
      }),
      artifacts,
      reason: "workflow.code_review is disabled in the effective Blueprint config.",
      warnings: [...located.warnings, ...reviewSettings.warnings]
    };
  }

  const warnings = [...located.warnings];
  const explicitScope = await normalizeExplicitReviewFiles(
    projectRoot,
    args.files ?? [],
    warnings
  );
  const explicitFiles = explicitScope.files;

  if (explicitScopeRequested && explicitScope.rejected) {
    return {
      status: "invalid",
      phase: {
        phaseNumber: located.phaseNumber,
        phasePrefix: located.phasePrefix,
        phaseName:
          located.phaseName ??
          `Phase ${located.phasePrefix} ${path.basename(located.phaseDir)}`,
        phaseDir: located.phaseDir,
        resolvedFrom: located.resolvedFrom
      },
      files: [],
      reviewMode: {
        depth: reviewSettings.depth,
        source: "explicit-files"
      },
      confirmationRecommended: buildReviewScopeConfirmation({
        fileCount: 0,
        summaryCount: artifacts.summaries.length,
        matchedPlanCount: 0,
        depth: reviewSettings.depth,
        source: "explicit-files"
      }),
      artifacts,
      reason:
        "Explicit review scope contained invalid `--files` entries. Re-run with only repo-relative file paths to existing repo files.",
      warnings: [...warnings, ...reviewSettings.warnings]
    };
  }
  let files: string[] = [];
  let source: ReviewModeSource = "phase-plans";
  let summaryCount = artifacts.summaries.length;
  let matchedPlanCount = 0;

  if (explicitFiles.length > 0) {
    files = explicitFiles;
    source = "explicit-files";
  } else {
    const summaryScope = await deriveReviewFilesFromSummaries(
      projectRoot,
      { artifacts: located.artifacts },
      warnings
    );
    const planScope = await deriveReviewFilesFromPlans(
      projectRoot,
      {
        phaseNumber: located.phaseNumber,
        phasePrefix: located.phasePrefix,
        artifacts: located.artifacts
      },
      warnings
    );

    files = [...new Set([...summaryScope.files, ...planScope.files])].sort((left, right) =>
      left.localeCompare(right)
    );
    summaryCount = summaryScope.summaryCount;
    matchedPlanCount = planScope.matchedPlanCount;
    source = determineReviewModeSource(explicitFiles, summaryScope.files, planScope.files);
  }
  if (files.length === 0) {
    const missingSummaries = artifacts.summaries.length === 0;
    const missingPlans = artifacts.plans.length === 0;

    if (missingSummaries) {
      warnings.push(
        "No saved SUMMARY artifacts were found for this phase; implicit review scope resolution requires saved execution evidence."
      );
    }

    if (missingPlans) {
      warnings.push(
        "No saved PLAN artifacts were found for this phase; implicit review scope resolution requires saved plan metadata."
      );
    }

    return {
      status: "invalid",
      phase: {
        phaseNumber: located.phaseNumber,
        phasePrefix: located.phasePrefix,
        phaseName:
          located.phaseName ??
          `Phase ${located.phasePrefix} ${path.basename(located.phaseDir)}`,
        phaseDir: located.phaseDir,
        resolvedFrom: located.resolvedFrom
      },
      files,
      reviewMode: {
        depth: reviewSettings.depth,
        source
      },
      confirmationRecommended: buildReviewScopeConfirmation({
        fileCount: files.length,
        summaryCount,
        matchedPlanCount,
        depth: reviewSettings.depth,
        source
      }),
      artifacts,
      reason:
        explicitScopeRequested
          ? "No valid repo files remained in the explicit review scope."
          : missingSummaries && missingPlans
            ? "Blueprint could not derive any reviewable repo files because saved SUMMARY and PLAN artifacts were missing for this phase. Re-run with explicit --files paths or restore the saved evidence."
            : missingSummaries
              ? "Blueprint could not derive any reviewable repo files because saved SUMMARY artifacts were missing for this phase. Re-run with explicit --files paths or restore the saved summaries."
              : missingPlans
                ? "Blueprint could not derive any reviewable repo files because saved PLAN artifacts were missing for this phase. Re-run with explicit --files paths or restore the saved plans."
                : "Blueprint could not derive any reviewable repo files from the saved SUMMARY/PLAN evidence. Re-run with explicit --files paths or update the saved artifacts to include repo file paths.",
      warnings: [...warnings, ...reviewSettings.warnings]
    };
  }

  const phase = {
    phaseNumber: located.phaseNumber,
    phasePrefix: located.phasePrefix,
    phaseName:
      located.phaseName ??
      `Phase ${located.phasePrefix} ${path.basename(located.phaseDir)}`,
    phaseDir: located.phaseDir,
    resolvedFrom: located.resolvedFrom
  };
  const reviewMode = {
    depth: reviewSettings.depth,
    source
  };
  const reportPath = `${located.phaseDir}/${located.phasePrefix}${REVIEW_ARTIFACT_SUFFIXES["code-review"]}`;
  const knownEvidenceArtifacts = collectKnownCodeReviewEvidenceArtifacts(
    {
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName,
      phaseDir: located.phaseDir,
      artifacts: located.artifacts
    },
    reportPath
  );
  const authoringContext = args.includeAuthoringContext
    ? await buildCodeReviewAuthoringContext({
        phase,
        files,
        reviewMode,
        knownEvidenceArtifacts
      })
    : undefined;

  return {
    status: "ready",
    phase,
    files,
    reviewMode,
    confirmationRecommended: buildReviewScopeConfirmation({
      fileCount: files.length,
      summaryCount,
      matchedPlanCount,
      depth: reviewSettings.depth,
      source
    }),
    artifacts,
    authoringContext,
    reason: null,
    warnings: [...warnings, ...reviewSettings.warnings]
  };
}

export async function blueprintReviewAuthoringContext(
  args: ReviewAuthoringContextArgs
): Promise<ReviewAuthoringContextResult> {
  const artifact = args.artifact;
  const projectRoot = await ensureRepoRoot(args.cwd);

  if (artifact === "security") {
    return buildSecurityAuthoringContext({
      projectRoot,
      phase: args.phase
    });
  }

  if (artifact === "review-fix") {
    return buildReviewFixAuthoringContext({
      projectRoot,
      phase: args.phase,
      targetIds: args.targetIds
    });
  }

  if (artifact === "ui-review") {
    return buildUiReviewAuthoringContext({
      projectRoot,
      phase: args.phase
    });
  }

  if (artifact === "peer-review") {
    return buildPeerReviewAuthoringContext({
      projectRoot,
      phase: args.phase
    });
  }

  const scoped = await blueprintReviewScope({
    cwd: projectRoot,
    phase: args.phase,
    files: args.files,
    depth: args.depth,
    includeAuthoringContext: true
  });

  if (scoped.status !== "ready" || !scoped.phase || !scoped.authoringContext) {
    const reason = scoped.reason ?? "Code-review authoring context could not resolve a ready review scope.";

    return {
      status: "invalid",
      artifact: "code-review",
      phase: scoped.phase,
      files: scoped.files,
      reviewMode: scoped.reviewMode,
      schemaPath: null,
      baseSchema: readArtifactContract("review.code-review").modelContract
        ? cloneJsonObject(readArtifactContract("review.code-review").modelContract!.jsonSchema)
        : null,
      taskSchema: null,
      modelOnly: true,
      authoringContext: null,
      prerequisiteBlockers: [reason],
      reason,
      warnings: scoped.warnings
    };
  }

  return {
    status: "ready",
    artifact: "code-review",
    phase: scoped.phase,
    files: scoped.files,
    reviewMode: scoped.reviewMode,
    schemaPath: scoped.authoringContext.schemaPath,
    baseSchema: scoped.authoringContext.baseSchema,
    taskSchema: scoped.authoringContext.taskSchema,
    modelOnly: true,
    authoringContext: scoped.authoringContext,
    prerequisiteBlockers: [],
    reason: null,
    warnings: scoped.warnings
  };
}

export async function blueprintReviewValidateModel(
  args: ReviewValidateModelArgs
): Promise<ReviewValidateModelResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const artifact = args.artifact ?? "code-review";
  const context = await blueprintReviewAuthoringContext({
    cwd: projectRoot,
    phase: args.phase,
    artifact,
    files: args.files,
    depth: args.depth,
    targetIds: args.targetIds
  });

  if (context.status !== "ready" || !context.phase || !context.taskSchema || !context.authoringContext) {
    const filesRequiredDiagnostic =
      artifact === "code-review" &&
      !explicitReviewFilesRequested(args.files) &&
      context.files.length === 0 &&
      /could not derive any reviewable repo files/i.test(context.reason ?? "");
    const diagnostics = context.prerequisiteBlockers.length > 0
      ? context.prerequisiteBlockers.map((message) =>
          modelDiagnostic({
            source: "scope",
            path: filesRequiredDiagnostic ? "model.findings[].location" : "phase",
            code: filesRequiredDiagnostic ? "scope.files_required" : "scope.invalid",
            message: filesRequiredDiagnostic
              ? "Code-review finding location scope cannot be validated because no explicit files were passed and no PLAN/SUMMARY-derived review files were found."
              : message,
            context: {
              reason: context.reason,
              warnings: context.warnings,
              files: args.files ?? []
            },
            suggestion:
              filesRequiredDiagnostic
                ? "Pass explicit repo-relative files, or restore saved PLAN/SUMMARY evidence that names reviewable repo files."
                : artifact === "security"
                ? "Resolve completed phase execution evidence and live plan provenance before authoring review.security."
                : artifact === "review-fix"
                  ? "Resolve a saved code-review artifact, selected finding ids, completed summary evidence, and dependency provenance before authoring review.review-fix."
                  : artifact === "ui-review"
                    ? "Resolve valid completed summary evidence and live UI-review provenance before authoring review.ui-review."
                    : artifact === "peer-review"
                      ? "Resolve saved phase plan artifacts before authoring review.peer-review."
                  : "Resolve a valid phase review scope first, or pass explicit repo-relative files that exist."
          })
        )
      : [
      modelDiagnostic({
        source: "scope",
        path: filesRequiredDiagnostic ? "model.findings[].location" : "phase",
        code: filesRequiredDiagnostic ? "scope.files_required" : "scope.invalid",
        message: filesRequiredDiagnostic
          ? "Code-review finding location scope cannot be validated because no explicit files were passed and no PLAN/SUMMARY-derived review files were found."
          : context.reason ?? "Review model validation could not resolve a ready authoring context.",
        context: {
          reason: context.reason,
          warnings: context.warnings,
          files: args.files ?? []
        },
        suggestion:
          filesRequiredDiagnostic
            ? "Pass explicit repo-relative files, or restore saved PLAN/SUMMARY evidence that names reviewable repo files."
            : artifact === "security"
            ? "Resolve completed phase execution evidence and live plan provenance before authoring review.security."
            : artifact === "review-fix"
              ? "Resolve a saved code-review artifact, selected finding ids, completed summary evidence, and dependency provenance before authoring review.review-fix."
              : artifact === "ui-review"
                ? "Resolve valid completed summary evidence and live UI-review provenance before authoring review.ui-review."
                : artifact === "peer-review"
                  ? "Resolve saved phase plan artifacts before authoring review.peer-review."
              : "Resolve a valid phase review scope first, or pass explicit repo-relative files that exist."
      })
    ];

    return {
      status: "invalid",
      valid: false,
      phase: context.phase,
      files: context.files,
      reviewMode: context.reviewMode ?? {
        depth: args.depth ?? "standard",
        source: "phase-evidence"
      },
      schemaPath: context.schemaPath,
      taskSchema: context.taskSchema,
      diagnostics,
      diagnosticCounts: countDiagnostics(diagnostics),
      repairSummary: summarizeReviewModelRepairs(diagnostics),
      normalizedModel: null,
      renderPreview: null,
      warnings: context.warnings
    };
  }

  const modelObject = asJsonObject(args.model);
  const diagnostics: ReviewModelDiagnostic[] = [];

  if (!modelObject) {
    const modelLabel =
      artifact === "security"
        ? "Security review"
        : artifact === "review-fix"
          ? "Review-fix"
          : artifact === "ui-review"
            ? "UI-review"
            : artifact === "peer-review"
              ? "Peer-review"
              : "Code-review";
    diagnostics.push(
      modelDiagnostic({
        source: "schema",
        path: "model",
        code: "schema.type",
        message: `${modelLabel} model must be a JSON object.`,
        context: { receivedType: Array.isArray(args.model) ? "array" : typeof args.model },
        suggestion: "Return a JSON object that matches authoringContext.taskSchema."
      })
    );
  }

  let normalizedModel: CodeReviewStructuredModel | null = null;
  let normalizedPeerReviewModel: PeerReviewStructuredModel | null = null;
  let normalizedReviewFixModel: ReviewFixStructuredModel | null = null;
  let normalizedSecurityModel: SecurityStructuredModel | null = null;
  let normalizedUiReviewModel: UiReviewStructuredModel | null = null;
  const validationWarnings = [...context.warnings];

  if (modelObject) {
    const validate = createAjvValidator().compile(context.taskSchema);
    const schemaValid = validate(modelObject);
    if (!schemaValid) {
      diagnostics.push(
        ...(validate.errors ?? []).map((error) =>
          schemaDiagnosticFromAjvError(
            error,
            artifact,
            artifact === "security"
              ? context.authoringContext as SecurityAuthoringContext
              : null,
            modelObject
          )
        )
      );
    }

    if (artifact === "security") {
      normalizedSecurityModel = normalizeSecurityModel(modelObject);
      const securityResidual = await collectSecurityResidualDiagnostics({
          model: modelObject,
          normalizedModel: normalizeSecurityModelForResiduals(modelObject),
          authoringContext: context.authoringContext as SecurityAuthoringContext
        });
      diagnostics.push(...securityResidual.diagnostics);
      validationWarnings.push(...securityResidual.warnings);
    } else if (artifact === "review-fix") {
      normalizedReviewFixModel = normalizeReviewFixModel(modelObject);
      diagnostics.push(
        ...await collectReviewFixResidualDiagnostics({
          projectRoot,
          model: modelObject,
          normalizedModel: normalizeReviewFixModelForResiduals(modelObject),
          authoringContext: context.authoringContext as ReviewFixAuthoringContext
        })
      );
    } else if (artifact === "ui-review") {
      normalizedUiReviewModel = normalizeUiReviewModel(modelObject);
      diagnostics.push(
        ...await collectUiReviewResidualDiagnostics({
          projectRoot,
          model: modelObject,
          normalizedModel: normalizeUiReviewModelForResiduals(modelObject)
        })
      );
    } else if (artifact === "peer-review") {
      normalizedPeerReviewModel = normalizePeerReviewModel(modelObject);
      diagnostics.push(
        ...await collectPeerReviewResidualDiagnostics({
          model: modelObject,
          normalizedModel: normalizePeerReviewModelForResiduals(modelObject),
          authoringContext: context.authoringContext as PeerReviewAuthoringContext
        })
      );
    } else {
      normalizedModel = normalizeCodeReviewModel(modelObject);
      const residualModel = normalizeCodeReviewModelForResiduals(modelObject);
      const codeReviewResiduals = await collectCodeReviewResidualDiagnostics({
        projectRoot,
        model: modelObject,
        normalizedModel: residualModel,
        authoringContext: context.authoringContext as CodeReviewAuthoringContext
      });
      diagnostics.push(...codeReviewResiduals.diagnostics);
      validationWarnings.push(...codeReviewResiduals.warnings);
    }
  }

  let renderPreview: string | null = null;

  if (artifact === "code-review" && diagnostics.length === 0 && normalizedModel) {
    const located: LocatedReviewPhase = {
      phaseNumber: context.phase.phaseNumber,
      phasePrefix: context.phase.phasePrefix,
      phaseName: context.phase.phaseName,
      phaseDir: context.phase.phaseDir,
      artifacts: [
        ...(context.authoringContext as CodeReviewAuthoringContext).knownEvidenceArtifacts
      ]
    };
    const rendered = renderCodeReviewModelContent(
      normalizedModel,
      located,
      context.authoringContext as CodeReviewAuthoringContext
    );
    const markdownValidation = validateReviewArtifactContent(rendered, "code-review");
    const scopedValidation = validateReviewArtifactScopeCoverage(
      rendered,
      (context.authoringContext as CodeReviewAuthoringContext).files
    );
    const evidenceCoverageIssues = validateCodeReviewEvidenceCoverage(
      rendered,
      (context.authoringContext as CodeReviewAuthoringContext).knownEvidenceArtifacts
    );
    const nextSafeActionIssues = await validateCodeReviewNextSafeAction(rendered);
    const markdownIssues = [
      ...markdownValidation.issues,
      ...scopedValidation.issues,
      ...nextSafeActionIssues
    ];
    validationWarnings.push(...evidenceCoverageIssues);

    for (const issue of markdownIssues) {
      diagnostics.push(
        modelDiagnostic({
          source: "markdown",
          path: "renderPreview",
          code: "markdown.invalid_render",
          message: issue,
          context: {},
          suggestion: "Repair the model so MCP-rendered Markdown satisfies the canonical review artifact contract."
        })
      );
    }

    if (markdownIssues.length === 0) {
      renderPreview = rendered;
    }
  }

  if (artifact === "review-fix" && diagnostics.length === 0 && normalizedReviewFixModel) {
    const reviewFixContext = context.authoringContext as ReviewFixAuthoringContext;
    const located: LocatedReviewPhase = {
      phaseNumber: context.phase.phaseNumber,
      phasePrefix: context.phase.phasePrefix,
      phaseName: context.phase.phaseName,
      phaseDir: context.phase.phaseDir,
      artifacts: reviewFixContext.knownEvidenceArtifacts
    };
    const rendered = renderReviewFixModelContent(
      normalizedReviewFixModel,
      located,
      reviewFixContext
    );
    const markdownValidation = validateReviewArtifactContent(rendered, "review-fix");
    const markdownIssues = [...markdownValidation.issues];

    for (const issue of markdownIssues) {
      diagnostics.push(
        modelDiagnostic({
          source: "markdown",
          path: "renderPreview",
          code: "markdown.invalid_render",
          message: issue,
          context: {},
          suggestion: "Repair the model so MCP-rendered Markdown satisfies the canonical review-fix artifact contract."
        })
      );
    }

    if (markdownIssues.length === 0) {
      renderPreview = rendered;
    }
  }

  if (artifact === "peer-review" && diagnostics.length === 0 && normalizedPeerReviewModel) {
    const peerReviewContext = context.authoringContext as PeerReviewAuthoringContext;
    const located: LocatedReviewPhase = {
      phaseNumber: context.phase.phaseNumber,
      phasePrefix: context.phase.phasePrefix,
      phaseName: context.phase.phaseName,
      phaseDir: context.phase.phaseDir,
      artifacts: peerReviewContext.knownEvidenceArtifacts
    };
    const rendered = renderPeerReviewModelContent(
      normalizedPeerReviewModel,
      located,
      peerReviewContext
    );
    const markdownValidation = validateReviewArtifactContent(rendered, "peer-review");
    const nextSafeActionIssues = await validateImplementedNextSafeAction(
      normalizedPeerReviewModel.nextSafeAction,
      "Peer-review render Next Safe Action"
    );
    const markdownIssues = [...markdownValidation.issues, ...nextSafeActionIssues];

    for (const issue of markdownIssues) {
      diagnostics.push(
        modelDiagnostic({
          source: "markdown",
          path: "renderPreview",
          code: "markdown.invalid_render",
          message: issue,
          context: {},
          suggestion: "Repair the model so MCP-rendered Markdown satisfies the canonical peer-review artifact contract."
        })
      );
    }

    if (markdownIssues.length === 0) {
      renderPreview = rendered;
    }
  }

  if (artifact === "security" && diagnostics.length === 0 && normalizedSecurityModel) {
    const securityContext = context.authoringContext as SecurityAuthoringContext;
    const located: LocatedReviewPhase = {
      phaseNumber: context.phase.phaseNumber,
      phasePrefix: context.phase.phasePrefix,
      phaseName: context.phase.phaseName,
      phaseDir: context.phase.phaseDir,
      artifacts: securityContext.knownEvidenceArtifacts
    };
    const rendered = renderSecurityModelContent(
      normalizedSecurityModel,
      located,
      securityContext
    );
    const markdownValidation = validateReviewArtifactContent(rendered, "security");
    const markdownIssues = [...markdownValidation.issues];

    for (const issue of markdownIssues) {
      diagnostics.push(
        modelDiagnostic({
          source: "markdown",
          path: "renderPreview",
          code: "markdown.invalid_render",
          message: issue,
          context: {},
          suggestion: "Repair the model so MCP-rendered Markdown satisfies the canonical security artifact contract."
        })
      );
    }

    if (markdownIssues.length === 0) {
      renderPreview = rendered;
    }
  }

  if (artifact === "ui-review" && diagnostics.length === 0 && normalizedUiReviewModel) {
    const uiReviewContext = context.authoringContext as UiReviewAuthoringContext;
    const located: LocatedReviewPhase = {
      phaseNumber: context.phase.phaseNumber,
      phasePrefix: context.phase.phasePrefix,
      phaseName: context.phase.phaseName,
      phaseDir: context.phase.phaseDir,
      artifacts: uiReviewContext.knownEvidenceArtifacts
    };
    const rendered = renderUiReviewModelContent(
      normalizedUiReviewModel,
      located,
      uiReviewContext
    );
    const markdownValidation = validateReviewArtifactContent(rendered, "ui-review");
    const markdownIssues = [...markdownValidation.issues];

    for (const issue of markdownIssues) {
      diagnostics.push(
        modelDiagnostic({
          source: "markdown",
          path: "renderPreview",
          code: "markdown.invalid_render",
          message: issue,
          context: {},
          suggestion: "Repair the model so MCP-rendered Markdown satisfies the canonical UI-review artifact contract."
        })
      );
    }

    if (markdownIssues.length === 0) {
      renderPreview = rendered;
    }
  }

  return {
    status: diagnostics.length === 0 ? "valid" : "invalid",
    valid: diagnostics.length === 0,
    phase: context.phase,
    files: context.files,
    reviewMode: context.reviewMode ?? {
      depth: args.depth ?? "standard",
      source: "phase-evidence"
    },
    schemaPath: context.schemaPath,
    taskSchema: context.taskSchema,
    diagnostics,
    diagnosticCounts: countDiagnostics(diagnostics),
    repairSummary: summarizeReviewModelRepairs(diagnostics),
    normalizedModel: diagnostics.some((diagnostic) => diagnostic.source === "schema")
      ? null
      : artifact === "security"
        ? normalizedSecurityModel
        : artifact === "review-fix"
          ? normalizedReviewFixModel
          : artifact === "ui-review"
            ? normalizedUiReviewModel
            : artifact === "peer-review"
              ? normalizedPeerReviewModel
          : normalizedModel,
    renderPreview,
    warnings: uniqueSortedStrings([...context.warnings, ...validationWarnings])
  };
}

function toPublicReviewValidateModelResult(
  result: ReviewValidateModelResult
): PublicReviewValidateModelResult {
  const {
    taskSchema: _taskSchema,
    normalizedModel: _normalizedModel,
    renderPreview: _renderPreview,
    ...publicResult
  } = result;
  return publicResult;
}

function toPublicReviewRecordResult(
  result: ReviewRecordResult
): PublicReviewRecordResult {
  if (result.status !== "invalid") {
    return result;
  }

  const { taskSchema: _taskSchema, ...publicResult } = result;
  return publicResult;
}

async function resolveCodeReviewRecordValidationFiles(args: {
  recordArgs: ReviewRecordArgs;
}): Promise<string[] | undefined> {
  if (!args.recordArgs.scopeFiles || args.recordArgs.scopeFiles.length === 0) {
    return undefined;
  }

  if (args.recordArgs.scopeSource) {
    return args.recordArgs.scopeSource === "explicit-files"
      ? args.recordArgs.scopeFiles
      : undefined;
  }

  return args.recordArgs.scopeFiles;
}

export async function blueprintReviewRecord(
  args: ReviewRecordArgs
): Promise<ReviewRecordResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate({
    cwd: projectRoot,
    phase: args.phase
  });

  if (
    !located.found ||
    !located.phaseNumber ||
    !located.phasePrefix ||
    !located.phaseDir
  ) {
    throw new Error(
      located.reason ?? "Phase could not be resolved for review persistence."
    );
  }

  const reportPath = `${located.phaseDir}/${located.phasePrefix}${REVIEW_ARTIFACT_SUFFIXES[args.artifact]}`;
  const hasContent = args.content !== undefined;
  const hasModel = args.model !== undefined;
  const warnings: string[] = [];
  const modelOnlyArtifact =
    args.artifact === "code-review" ||
    args.artifact === "peer-review" ||
    args.artifact === "review-fix" ||
    args.artifact === "security" ||
    args.artifact === "ui-review";
  const locatedReviewPhase: LocatedReviewPhase = {
    phaseNumber: located.phaseNumber,
    phasePrefix: located.phasePrefix,
    phaseName: located.phaseName,
    phaseDir: located.phaseDir,
    artifacts: located.artifacts
  };

  if (modelOnlyArtifact && hasContent) {
    return reviewRecordInvalidResult({
      located: locatedReviewPhase,
      artifact: args.artifact,
      reportPath,
      warnings: [
        `review.${args.artifact} is model-only; content is invalid. Call blueprint_review_validate_model with JSON first, then persist the same model through blueprint_review_record.`
      ]
    });
  }

  if (modelOnlyArtifact && !hasModel) {
    return reviewRecordInvalidResult({
      located: locatedReviewPhase,
      artifact: args.artifact,
      reportPath,
      warnings: [
        `review.${args.artifact} requires a structured model. Markdown content fallback is not supported.`
      ]
    });
  }

  if (!modelOnlyArtifact && hasModel) {
    return reviewRecordInvalidResult({
      located: locatedReviewPhase,
      artifact: args.artifact,
      reportPath,
      warnings: [
        `${args.artifact} does not support structured model writes. Supply canonical Markdown content instead.`
      ]
    });
  }

  if (!modelOnlyArtifact && !hasContent) {
    return reviewRecordInvalidResult({
      located: locatedReviewPhase,
      artifact: args.artifact,
      reportPath,
      warnings: [
        "Review artifact writes must supply Markdown content for non-code-review artifacts."
      ]
    });
  }

  let content = args.content ?? "";
  let codeReviewScopeFiles: string[] = [];
  let modelCountsOverride: {
    counts: ReviewRecordResult["counts"];
    followUps: string[];
  } | null = null;
  let uiReviewValidatedModel: UiReviewStructuredModel | null = null;

  if (modelOnlyArtifact) {
    if (
      args.artifact === "code-review" &&
      (args.scopeFiles?.length ?? 0) > 0 &&
      !args.scopeSource
    ) {
      const context = await blueprintReviewAuthoringContext({
        cwd: projectRoot,
        phase: args.phase,
        artifact: "code-review",
        files: args.scopeFiles,
        depth: args.depth
      });
      const diagnostics = [
        modelDiagnostic({
          source: "scope",
          path: "scopeSource",
          code: "scope.source_required",
          message: "Code-review record writes with scopeFiles must also provide scopeSource.",
          context: { scopeFiles: args.scopeFiles },
          suggestion: "Pass scopeSource alongside scopeFiles so Blueprint can preserve explicit scope provenance."
        })
      ];

      return reviewRecordInvalidResult({
        located: locatedReviewPhase,
        artifact: args.artifact,
        reportPath,
        diagnostics,
        diagnosticCounts: countDiagnostics(diagnostics),
        repairSummary: summarizeReviewModelRepairs(diagnostics),
        taskSchema: context.taskSchema,
        warnings: [...warnings, ...diagnostics.map(formatReviewDiagnostic)]
      });
    }

    const modelArtifact = args.artifact as "code-review" | "peer-review" | "review-fix" | "security" | "ui-review";
    const validationFiles =
      args.artifact === "code-review"
        ? await resolveCodeReviewRecordValidationFiles({
            recordArgs: args
          })
        : undefined;
    const validation = await blueprintReviewValidateModel({
      cwd: projectRoot,
      phase: args.phase,
      artifact: modelArtifact,
      files: validationFiles,
      depth: args.depth,
      targetIds: args.targetIds,
      model: args.model
    });

    if (!validation.valid || !validation.renderPreview) {
      return reviewRecordInvalidResult({
        located: locatedReviewPhase,
        artifact: args.artifact,
        reportPath,
        diagnostics: validation.diagnostics,
        diagnosticCounts: validation.diagnosticCounts,
        repairSummary: validation.repairSummary,
        taskSchema: validation.taskSchema,
        warnings: [
          ...warnings,
          ...validation.warnings,
          ...validation.diagnostics.map(formatReviewDiagnostic)
        ]
      });
    }

    content = validation.renderPreview;
    warnings.push(...validation.warnings);
    codeReviewScopeFiles = args.artifact === "code-review" ? validation.files : [];
    if (args.artifact === "ui-review" && validation.normalizedModel) {
      const uiModel = validation.normalizedModel as UiReviewStructuredModel;
      uiReviewValidatedModel = uiModel;
      const followUps = uiModel.followUps.filter((followUp) => !isGenericNoneValue(followUp));
      modelCountsOverride = {
        counts: {
          sections: countMarkdownSections(content),
          findings: uiModel.findings.filter((finding) => finding.status !== "NONE").length,
          followUps: followUps.length
        },
        followUps
      };
    }
  }

  const prepared = prepareTextForPersistence(normalizeTextContent(content), {
    label: reportPath
  });
  const normalizedContent = normalizeTextContent(prepared.content);
  const parsedCounts = collectReviewCounts(normalizedContent, args.artifact);
  const { counts, followUps } = modelCountsOverride ?? parsedCounts;
  const absolutePath = resolveBlueprintPath(projectRoot, reportPath);
  const exists = await pathExists(absolutePath);
  const existingContent = exists ? await fs.readFile(absolutePath, "utf8") : null;
  warnings.push(...prepared.warnings);
  const validation = validateReviewArtifactContent(normalizedContent, args.artifact);
  const evidenceCoverageIssues =
    args.artifact === "code-review"
      ? validateCodeReviewEvidenceCoverage(
          normalizedContent,
          collectKnownCodeReviewEvidenceArtifacts(locatedReviewPhase, reportPath)
        )
      : [];
  const nextSafeActionIssues =
    args.artifact === "code-review"
      ? await validateCodeReviewNextSafeAction(normalizedContent)
      : [];

  if (normalizedContent.trim().length === 0) {
    return reviewRecordInvalidResult({
      located: locatedReviewPhase,
      artifact: args.artifact,
      reportPath,
      counts,
      followUps,
      warnings: [...warnings, `${reportPath} content must not be empty.`]
    });
  }

  if (!validation.valid) {
    return reviewRecordInvalidResult({
      located: locatedReviewPhase,
      artifact: args.artifact,
      reportPath,
      counts,
      followUps,
      warnings: [...warnings, ...validation.issues]
    });
  }

  if (evidenceCoverageIssues.length > 0) {
    return reviewRecordInvalidResult({
      located: locatedReviewPhase,
      artifact: args.artifact,
      reportPath,
      counts,
      followUps,
      warnings: [...warnings, ...evidenceCoverageIssues]
    });
  }

  if (nextSafeActionIssues.length > 0) {
    return reviewRecordInvalidResult({
      located: locatedReviewPhase,
      artifact: args.artifact,
      reportPath,
      counts,
      followUps,
      warnings: [...warnings, ...nextSafeActionIssues]
    });
  }

  if (args.artifact === "code-review" && codeReviewScopeFiles.length > 0) {
    const scopedValidation = validateReviewArtifactScopeCoverage(
      normalizedContent,
      codeReviewScopeFiles
    );

    if (!scopedValidation.valid) {
      return reviewRecordInvalidResult({
        located: locatedReviewPhase,
        artifact: args.artifact,
        reportPath,
        counts,
        followUps,
        warnings: [...warnings, ...scopedValidation.issues]
      });
    }
  }

  if (args.artifact === "ui-review" && uiReviewValidatedModel) {
    const posture = uiReviewValidatedModel.auditTrail.existingReviewPosture;
    const expectedPosture =
      existingContent === null
        ? "none"
        : existingContent === normalizedContent
          ? "reused"
          : "overwrite-confirmed";

    if (posture !== expectedPosture) {
      return reviewRecordInvalidResult({
        located: locatedReviewPhase,
        artifact: args.artifact,
        reportPath,
        counts,
        followUps,
        warnings: [
          ...warnings,
          `UI-review auditTrail.existingReviewPosture must be "${expectedPosture}" for this write, not "${posture}".`
        ]
      });
    }
  }

  if (exists) {
    if (existingContent === normalizedContent) {
      warnings.push("Preserved existing review artifact because the content was unchanged.");

      return {
        phaseNumber: located.phaseNumber,
        phasePrefix: located.phasePrefix,
        phaseName: located.phaseName ?? `Phase ${located.phasePrefix}`,
        phaseDir: located.phaseDir,
        artifact: args.artifact,
        reportPath,
        written: false,
        created: false,
        overwritten: false,
        status: "reused",
        counts,
        followUps,
        warnings
      };
    }

    if (!(args.overwrite ?? false)) {
      throw new Error(
        `${reportPath} already exists. Re-run only after explicit overwrite confirmation.`
      );
    }
  }

  warnings.push(
    ...await writeTextFile(absolutePath, normalizedContent, {
      label: reportPath,
      enforcePromptBoundary: false
    })
  );

  if (exists) {
    warnings.push(`Replaced existing review artifact: ${reportPath}`);
  }

  warnings.push(...validation.warnings);

  return {
    phaseNumber: located.phaseNumber,
    phasePrefix: located.phasePrefix,
    phaseName: located.phaseName ?? `Phase ${located.phasePrefix}`,
    phaseDir: located.phaseDir,
    artifact: args.artifact,
    reportPath,
    written: true,
    created: !exists,
    overwritten: exists,
    status: exists ? "updated" : "created",
    counts,
    followUps,
    warnings
  };
}

export async function blueprintReviewLoadFindings(
  args: ReviewLoadFindingsArgs
): Promise<ReviewLoadFindingsResult> {
  const artifact = args.artifact ?? "code-review";
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate({
    cwd: projectRoot,
    phase: args.phase
  });

  if (
    !located.found ||
    !located.phaseNumber ||
    !located.phasePrefix ||
    !located.phaseDir
  ) {
    return {
      phaseFound: false,
      found: false,
      phaseNumber: null,
      phasePrefix: null,
      phaseName: null,
      phaseDir: null,
      artifact,
      path: null,
      findings: [],
      severityCounts: emptySeverityCounts(),
      followUps: [],
      followUpTargets: [],
      reason:
        located.reason ?? "Phase could not be resolved for review findings loading.",
      warnings: [
        ...located.warnings
      ]
    };
  }

  const artifactPath =
    artifact === "code-review"
      ? findPhaseArtifact(located.artifacts, REVIEW_ARTIFACT_SUFFIXES[artifact])
      : located.artifacts.find((candidate) =>
          candidate.endsWith(REVIEW_ARTIFACT_SUFFIXES[artifact])
        ) ?? null;

  if (!artifactPath) {
    return {
      phaseFound: true,
      found: false,
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName ?? `Phase ${located.phasePrefix}`,
      phaseDir: located.phaseDir,
      artifact,
      path: null,
      findings: [],
      severityCounts: emptySeverityCounts(),
      followUps: [],
      followUpTargets: [],
      reason: `Phase ${located.phaseNumber} does not have a saved ${REVIEW_ARTIFACT_SUFFIXES[artifact]} artifact yet.`,
      warnings: located.warnings
    };
  }

  const content = await fs.readFile(
    resolveBlueprintPath(projectRoot, artifactPath),
    "utf8"
  );
  const parsed = parseFindingsFromArtifact(content, artifact);

  return {
    phaseFound: true,
    found: true,
    phaseNumber: located.phaseNumber,
    phasePrefix: located.phasePrefix,
    phaseName: located.phaseName ?? `Phase ${located.phasePrefix}`,
    phaseDir: located.phaseDir,
    artifact,
    path: artifactPath,
    findings: parsed.findings,
    severityCounts: parsed.severityCounts,
    followUps: parsed.followUps,
    followUpTargets: parsed.followUpTargets,
    reason: null,
    warnings:
      parsed.findings.length === 0 && parsed.followUpTargets.length === 0
        ? [
            ...located.warnings,
            `No structured findings were parsed from ${artifactPath}.`
          ]
        : located.warnings
  };
}

export const reviewToolDefinitions = [
  {
    name: "blueprint_review_scope",
    description:
      "Resolve a phase-backed Blueprint code-review scope, including effective review settings and saved phase evidence, from executed plan metadata or explicit repo file paths.",
    inputSchema: reviewScopeInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintReviewScope(args as ReviewScopeArgs)
  },
  {
    name: "blueprint_review_load_findings",
    description:
      "Load structured findings and severity counts from a saved phase-scoped Blueprint review artifact.",
    inputSchema: reviewLoadFindingsInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintReviewLoadFindings(args as ReviewLoadFindingsArgs)
  },
  {
    name: "blueprint_review_validate_model",
    description:
      "Validate a model-authored review.code-review, review.peer-review, review.review-fix, review.security, or review.ui-review JSON payload against the runtime task schema, residual quality checks, and canonical Markdown render before persistence.",
    inputSchema: reviewValidateModelInputSchema,
    handler: async (args: Record<string, unknown>) =>
      toPublicReviewValidateModelResult(
        await blueprintReviewValidateModel(args as ReviewValidateModelArgs)
      )
  },
  {
    name: "blueprint_review_authoring_context",
    description:
      "Build the model-only review authoring context and narrowed task schema for review.code-review, review.peer-review, review.review-fix, review.security, or review.ui-review before model drafting.",
    inputSchema: reviewAuthoringContextInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintReviewAuthoringContext(args as ReviewAuthoringContextArgs)
  },
  {
    name: "blueprint_review_record",
    description:
      "Persist a phase-scoped Blueprint review artifact with overwrite protection; code-review, peer-review, review-fix, security, and ui-review persist model-authored JSON only after validator replay.",
    inputSchema: reviewRecordInputSchema,
    handler: async (args: Record<string, unknown>) =>
      toPublicReviewRecordResult(await blueprintReviewRecord(args as ReviewRecordArgs))
  }
];
