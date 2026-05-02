import * as z from "zod/v4";
import { type ArtifactContractId, listArtifactContracts, readArtifactContract } from "../artifact-contracts/index.js";
export declare const BLUEPRINT_DIR = ".blueprint";
export declare const BLUEPRINT_STATE_PATH = ".blueprint/STATE.md";
export declare const BLUEPRINT_CONFIG_PATH = ".blueprint/config.json";
export declare const BLUEPRINT_PHASES_PATH = ".blueprint/phases";
export declare const BLUEPRINT_REPORTS_PATH = ".blueprint/reports";
export declare const BLUEPRINT_CODEBASE_PATH = ".blueprint/codebase";
export declare const BLUEPRINT_BACKLOG_PATH = ".blueprint/backlog";
export declare const BLUEPRINT_TODOS_PATH = ".blueprint/todos";
export declare const BLUEPRINT_NOTES_PATH = ".blueprint/notes";
export declare const BLUEPRINT_BACKLOG_INDEX_PATH = ".blueprint/backlog/BACKLOG.md";
export declare const BLUEPRINT_TODO_INDEX_PATH = ".blueprint/todos/TODO.md";
export declare const BLUEPRINT_NOTES_INDEX_PATH = ".blueprint/notes/NOTES.md";
export declare const SUPPORTED_BOOTSTRAP_ARTIFACTS: readonly [".blueprint/PROJECT.md", ".blueprint/REQUIREMENTS.md", ".blueprint/ROADMAP.md", ".blueprint/phases/"];
export declare const CORE_PROJECT_ARTIFACTS: readonly [".blueprint/PROJECT.md", ".blueprint/REQUIREMENTS.md", ".blueprint/ROADMAP.md", ".blueprint/STATE.md", ".blueprint/config.json", ".blueprint/phases/"];
export declare const CODEBASE_ARTIFACTS: readonly [".blueprint/codebase/STACK.md", ".blueprint/codebase/ARCHITECTURE.md", ".blueprint/codebase/STRUCTURE.md", ".blueprint/codebase/CONVENTIONS.md", ".blueprint/codebase/TESTING.md", ".blueprint/codebase/INTEGRATIONS.md", ".blueprint/codebase/CONCERNS.md"];
declare const CODEBASE_ARTIFACT_CONTRACT_IDS: readonly ["codebase.stack", "codebase.architecture", "codebase.structure", "codebase.conventions", "codebase.testing", "codebase.integrations", "codebase.concerns"];
type CodebaseArtifactContractId = (typeof CODEBASE_ARTIFACT_CONTRACT_IDS)[number];
export declare const SUPPORTED_SCAFFOLD_ARTIFACTS: readonly [".blueprint/PROJECT.md", ".blueprint/REQUIREMENTS.md", ".blueprint/ROADMAP.md", ".blueprint/phases/", ".blueprint/codebase/STACK.md", ".blueprint/codebase/ARCHITECTURE.md", ".blueprint/codebase/STRUCTURE.md", ".blueprint/codebase/CONVENTIONS.md", ".blueprint/codebase/TESTING.md", ".blueprint/codebase/INTEGRATIONS.md", ".blueprint/codebase/CONCERNS.md"];
export type SupportedScaffoldArtifact = (typeof SUPPORTED_SCAFFOLD_ARTIFACTS)[number];
export type BlueprintReadiness = "uninitialized" | "mapping-incomplete" | "mapped-only" | "partial" | "initialized";
export type BootstrapRepoShape = "greenfield" | "scaffold-only" | "brownfield";
export type BootstrapRequirementScope = "committed" | "deferred" | "out_of_scope";
export type BootstrapRequirementRow = {
    id: string;
    scope?: BootstrapRequirementScope;
    group?: string;
    requirement: string;
    status: string;
    notes: string;
};
export type BootstrapRoadmapPhase = {
    phase: string;
    title: string;
    status?: "planned" | "in_progress" | "done";
    objective: string;
    requirementIds?: string[];
    successCriteria?: string[];
    notes?: string[];
};
export type BootstrapSeed = {
    vision?: string;
    audience?: {
        primary?: string[];
        secondary?: string[];
    };
    constraints?: string[];
    currentMilestone?: string;
    nonGoals?: string[];
    requirements?: BootstrapRequirementRow[];
    roadmapPhases?: BootstrapRoadmapPhase[];
    brownfieldMode?: BootstrapRepoShape;
    assumptions?: string[];
};
export type BootstrapAssessment = {
    repoShape: BootstrapRepoShape;
    codebaseMapped: boolean;
    provisionalRoadmap: boolean;
    recommendedNextAction: string;
    reasons: string[];
};
export type BootstrapArtifactDiagnostics = {
    placeholderArtifacts: string[];
    traceabilityWarnings: string[];
    brownfield: BootstrapAssessment;
};
export type CodebaseArtifactDiagnostics = {
    present: string[];
    missing: string[];
    valid: string[];
    invalid: string[];
    mapped: boolean;
    warnings: string[];
};
export declare const DURABLE_REQUIREMENT_ID_PATTERN: RegExp;
export type NormalizedBootstrapRequirementRow = Required<BootstrapRequirementRow>;
export type NormalizedBootstrapSeed = Omit<Required<BootstrapSeed>, "requirements"> & {
    requirements: NormalizedBootstrapRequirementRow[];
};
type ArtifactScaffoldArgs = {
    cwd?: string;
    artifacts?: string[];
    overwrite?: boolean;
    projectName?: string;
    bootstrapSeed?: BootstrapSeed;
};
type ArtifactListArgs = {
    cwd?: string;
};
type ArtifactMutateIndexTarget = "backlog" | "todo" | "note";
type ArtifactMutateIndexAction = "append" | "list" | "update";
type ArtifactMutateIndexUpdate = {
    id: string;
    status?: string;
    description?: string;
    reservedPhase?: string | null;
};
type ArtifactMutateIndexArgs = {
    cwd?: string;
    target: ArtifactMutateIndexTarget;
    action?: ArtifactMutateIndexAction;
    entry?: {
        text: string;
        status?: string;
        addedAt?: string;
        reservePhaseStub?: boolean;
    };
    filter?: {
        query?: string;
        ids?: string[];
        statuses?: string[];
        limit?: number;
    };
    match?: {
        id?: string;
        text?: string;
    };
    update?: {
        status?: string;
    };
    updates?: ArtifactMutateIndexUpdate[];
};
type ArtifactScaffoldResult = {
    createdFiles: string[];
    reusedFiles: string[];
    warnings: string[];
};
type ArtifactListResult = {
    artifacts: {
        core: string[];
        phases: string[];
        codebase: string[];
    };
    reports: string[];
    missing: string[];
    warnings: string[];
};
type ArtifactMutateIndexReservedPhase = {
    phaseNumber: string;
    phasePrefix: string;
    phaseDir: string;
    artifactPaths: string[];
};
type ArtifactMutateIndexResult = {
    status: "created" | "updated" | "duplicate" | "listed" | "not_found" | "project_missing" | "invalid";
    targetPath: string;
    createdEntryIds: string[];
    duplicateEntryIds: string[];
    matchedEntryIds: string[];
    updatedCounts: {
        added: number;
        updated: number;
        duplicates: number;
        preserved: number;
    };
    reservedPhase: ArtifactMutateIndexReservedPhase | null;
    entries: CaptureIndexRow[];
    summary: {
        total: number;
        matched: number;
        open: number;
        active: number;
        completed: number;
        other: number;
    };
    warnings: string[];
};
type ArtifactValidateArgs = {
    cwd?: string;
};
type ArtifactValidateResult = {
    valid: boolean;
    issues: string[];
    suggestedRepairs: string[];
    warnings: string[];
};
type ArtifactSummaryDigestArgs = {
    cwd?: string;
    focusArea?: string;
    packageJsonPath?: string;
    readmePath?: string;
    sourceFiles?: string[];
    testFiles?: string[];
    docFiles?: string[];
    trackedFiles?: string[];
    artifactPaths?: string[];
};
type ArtifactContractReadArgs = {
    artifactId?: ArtifactContractId;
};
type ArtifactReportWriteArgs = {
    cwd?: string;
    reportName: string;
    content?: string;
    model?: Record<string, unknown>;
    overwrite?: boolean;
    auditFixContext?: {
        source: AuditFixReportSource;
        severity: AuditFixReportSeverityFilter;
        maxAttempts: number;
        dryRun: boolean;
        scopeFiles: string[];
    };
};
type ArtifactReportAuthoringContextArgs = {
    cwd?: string;
    reportName: string;
    auditFixContext?: {
        source: AuditFixReportSource;
        severity: AuditFixReportSeverityFilter;
        maxAttempts: number;
        dryRun: boolean;
        scopeFiles: string[];
    };
};
type ArtifactReportValidateModelArgs = ArtifactReportAuthoringContextArgs & {
    model: unknown;
};
type ArtifactSummaryDigestSection = {
    artifact: string;
    title: string;
    summary: string;
    evidence: string[];
};
type ArtifactSummaryDigestResult = {
    digest: ArtifactSummaryDigestSection[];
    inputsUsed: string[];
};
type ArtifactContractReadResult = {
    artifactId: ArtifactContractId;
    contract: ReturnType<typeof readArtifactContract>;
    contracts?: never;
} | {
    artifactId: null;
    contract?: never;
    contracts: ReturnType<typeof listArtifactContracts>;
};
type ArtifactReportWriteResult = {
    path: string;
    written: boolean;
    created: boolean;
    overwritten: boolean;
    status: "created" | "updated" | "reused" | "invalid";
    issues: string[];
    warnings: string[];
};
type AddTestsReportStatus = "COMPLETED" | "PARTIAL" | "BLOCKED";
type AddTestsReportReadiness = "ready-for-routing" | "not-ready-for-routing" | "blocked";
type AddTestsReportCompletionState = "complete" | "pending" | "blocked";
type AddTestsCommandResult = "pass" | "fail" | "blocked" | "not-run";
type AddTestsManualStatus = "MANUAL" | "DEFERRED" | "NONE";
type AddTestsGapStatus = "OPEN" | "BLOCKED" | "NONE";
type AddTestsBugStatus = "BUG" | "BLOCKER" | "NONE";
type AddTestsVerificationWriteStatus = "written" | "reused" | "invalid" | "blocked";
type AuditFixReportSource = "review" | "security" | "verification" | "uat" | "all";
type AuditFixReportSeverityFilter = "medium" | "high" | "all";
type AuditFixReportStatus = "COMPLETED" | "PARTIAL" | "BLOCKED";
type AuditFixReportReadiness = "ready-for-routing" | "not-ready-for-routing" | "blocked";
type AuditFixReportCompletionState = "complete" | "pending" | "blocked";
type AuditFixFindingSeverity = "critical" | "high" | "medium" | "low" | "unknown";
type AuditFixClassification = "auto-fixable" | "manual-only" | "skip";
type AuditFixChangeStatus = "fixed" | "planned" | "failed" | "skipped" | "none";
type AuditFixVerificationResult = "pass" | "fail" | "blocked" | "not-run" | "reread-only";
type AuditFixDependencyStatus = "satisfied" | "pending" | "blocked";
type AuditFixManualStatus = "MANUAL" | "DEFERRED" | "NONE";
type AuditFixGapStatus = "OPEN" | "BLOCKED" | "NONE";
type AuditFixEvidenceKind = "review" | "security" | "verification" | "uat" | "summary" | "scope" | "git" | "command" | "other";
type AuditFixTodoStatus = "captured" | "declined" | "not-needed" | "blocked";
type AddTestsReportModel = {
    status: AddTestsReportStatus;
    readiness: AddTestsReportReadiness;
    completionState: AddTestsReportCompletionState;
    coverageGoal: string[];
    evidenceUsed: string[];
    summaryEvidence: Record<string, {
        planId: string;
        linkedPlanPath: string;
        summaryStatus: "COMPLETED";
        targetedVerification: string[];
        coverageNote: string;
    }>;
    pendingPlans: Array<{
        planId: string;
        path: string;
        reason: string;
    }>;
    dependencyPlans: Array<{
        planId: string;
        path: string;
        status: "satisfied";
        evidence: string;
    }>;
    classification: Array<{
        target: string;
        category: string;
        reason: string;
    }>;
    testPlan: Array<{
        target: string;
        scenario: string;
        expectedAssertion: string;
        command: string;
    }>;
    testsAddedOrUpdated: Array<{
        path: string;
        summary: string;
    }>;
    targetedCommands: Array<{
        command: string;
        result: AddTestsCommandResult;
        evidence: string;
    }>;
    resultCounts: {
        generated: number;
        passing: number;
        failing: number;
        blocked: number;
    };
    bugsOrBlockers: Array<{
        item: string;
        evidence: string;
        status: AddTestsBugStatus;
    }>;
    manualOrDeferredWork: Array<{
        item: string;
        reason: string;
        followUp: string;
        status: AddTestsManualStatus;
    }>;
    remainingGaps: Array<{
        gap: string;
        evidence: string;
        repair: string;
        status: AddTestsGapStatus;
    }>;
    followUpFixes: string[];
    verificationWrite: {
        status: AddTestsVerificationWriteStatus;
        evidence: string;
    };
    nextSafeAction: string;
};
type AuditFixReportModel = {
    status: AuditFixReportStatus;
    readiness: AuditFixReportReadiness;
    completionState: AuditFixReportCompletionState;
    remediationSummary: string[];
    summaryEvidence: Record<string, {
        planId: string;
        linkedPlanPath: string;
        summaryStatus: "COMPLETED";
        targetedVerification: string[];
        coverageNote: string;
    }>;
    classification: Array<{
        findingId: string;
        evidenceSource: string;
        severity: AuditFixFindingSeverity;
        classification: AuditFixClassification;
        reason: string;
        implicatedFiles: string[];
        narrowVerification: string;
    }>;
    changesApplied: Array<{
        findingId: string;
        status: AuditFixChangeStatus;
        changedFiles: string[];
        summary: string;
    }>;
    verification: Array<{
        findingId: string;
        check: string;
        command: string;
        result: AuditFixVerificationResult;
        evidence: string;
    }>;
    pendingPlans: Array<{
        planId: string;
        path: string;
        reason: string;
    }>;
    dependencyPlans: Array<{
        planId: string;
        path: string;
        status: AuditFixDependencyStatus;
        evidence: string;
    }>;
    manualOrDeferredWork: Array<{
        item: string;
        reason: string;
        followUp: string;
        status: AuditFixManualStatus;
    }>;
    gapRoutes: Array<{
        gap: string;
        evidence: string;
        repair: string;
        status: AuditFixGapStatus;
    }>;
    followUpFixes: string[];
    evidence: Array<{
        kind: AuditFixEvidenceKind;
        source: string;
        summary: string;
    }>;
    commitTraceability: {
        preFixHead: string;
        createdCommits: string[];
    };
    todoCapture: {
        status: AuditFixTodoStatus;
        evidence: string;
    };
    nextSafeAction: string;
};
type ArtifactReportDiagnosticSource = "scope" | "schema" | "residual" | "markdown";
type ArtifactReportDiagnostic = {
    source: ArtifactReportDiagnosticSource;
    path: string;
    code: string;
    message: string;
    context: Record<string, unknown>;
    suggestion: string;
};
type ArtifactReportAuthoringContextResult = {
    status: "ready" | "invalid";
    reportName: string;
    path: string;
    phase: {
        phaseNumber: string;
        phasePrefix: string;
        phaseName: string;
        phaseDir: string;
    } | null;
    completedSummaries: Array<{
        planId: string;
        path: string;
        linkedPlanPath: string;
        targetedVerification: string[];
    }>;
    pendingPlans: Array<{
        planId: string;
        path: string;
        reason: string;
    }>;
    dependencyPlans: Array<{
        planId: string;
        path: string;
    }>;
    validationEvidencePaths: string[];
    selectedEvidencePaths: string[];
    scopeFiles: string[];
    auditFixContext: {
        source: AuditFixReportSource;
        severity: AuditFixReportSeverityFilter;
        maxAttempts: number;
        dryRun: boolean;
    } | null;
    allowedNextActions: string[];
    schemaPath: string | null;
    baseSchema: Record<string, unknown> | null;
    taskSchema: Record<string, unknown> | null;
    modelOnly: true;
    prerequisiteBlockers: string[];
    reason: string | null;
    warnings: string[];
};
type ArtifactReportValidateModelResult = {
    status: "valid" | "invalid";
    valid: boolean;
    reportName: string;
    path: string;
    phase: ArtifactReportAuthoringContextResult["phase"];
    schemaPath: string | null;
    taskSchema: Record<string, unknown> | null;
    diagnostics: ArtifactReportDiagnostic[];
    normalizedModel: AddTestsReportModel | AuditFixReportModel | null;
    renderPreview: string | null;
    warnings: string[];
};
type ArtifactCodebaseWriteArgs = {
    cwd?: string;
    artifactId: CodebaseArtifactContractId;
    content: string;
    overwrite?: boolean;
};
type ArtifactCodebaseWriteResult = {
    path: string;
    artifactId: CodebaseArtifactContractId;
    written: boolean;
    created: boolean;
    overwritten: boolean;
    reused: boolean;
    status: "created" | "updated" | "reused" | "invalid";
    issues: string[];
    warnings: string[];
};
type TextWriteOptions = {
    label?: string;
    enforcePromptBoundary?: boolean;
};
export type CaptureIndexRow = {
    id: string;
    added: string;
    status: string | null;
    description: string;
    reservedPhase: string | null;
};
export type PlanArtifactMetadata = {
    phase: string | null;
    planId: string | null;
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
};
export declare function parseCaptureIndexDocument(content: string, target: ArtifactMutateIndexTarget): {
    rows: CaptureIndexRow[];
    malformed: boolean;
    recoveryContent: string | null;
};
export declare function buildDefaultBootstrapSeed(projectName: string, assessment: BootstrapAssessment, seed?: BootstrapSeed): NormalizedBootstrapSeed;
export declare function normalizeReportSlug(value: string): string;
export declare function buildBlueprintReportPath(reportName: string): string;
export declare function toPosixPath(relativePath: string): string;
export declare function getProjectRoot(cwd?: string): string;
export declare function getBlueprintRoot(cwd?: string): string;
export declare function blueprintPathExists(targetPath: string): Promise<boolean>;
export declare function ensureRepoRoot(cwd?: string): Promise<string>;
export declare function toRepoRelativePath(projectRoot: string, absolutePath: string): string;
export declare function resolveRepoRelativePath(projectRoot: string, relativePath: string): string;
export declare function resolveBlueprintPath(projectRoot: string, relativePath: string): string;
export declare function ensureParentDirectory(targetPath: string): Promise<void>;
export declare function readJsonIfPresent(filePath: string): Promise<Record<string, unknown> | null>;
export declare function writeJsonFile(filePath: string, value: Record<string, unknown>): Promise<void>;
export declare function writeTextFile(filePath: string, value: string, options?: TextWriteOptions): Promise<string[]>;
export declare function withBlueprintRepoLock<T>(projectRoot: string, lockName: string, task: () => Promise<T>): Promise<T>;
export declare function extractMarkdownTableRows(section: string): string[][];
export declare function validateResearchArtifactContent(content: string): {
    valid: boolean;
    issues: string[];
    warnings: string[];
};
export declare function validatePhaseArtifactContent(content: string, artifact: "context" | "discussion-log" | "research" | "ui-spec"): {
    valid: boolean;
    issues: string[];
    warnings: string[];
};
export declare function validateVerificationArtifactContent(content: string, summaryPaths?: string[]): {
    valid: boolean;
    issues: string[];
    warnings: string[];
};
export declare function isVerificationArtifactReadyForUat(content: string): boolean;
type UatArtifactStatus = "PASS" | "FAIL" | "PARTIAL";
type UatArtifactResumeState = "RESUMED" | "NEW" | "CONTINUED";
type UatValidationOptions = {
    requireReadyVerificationEvidence?: boolean;
};
export declare function readUatArtifactState(content: string): {
    status: UatArtifactStatus | null;
    resumeState: UatArtifactResumeState | null;
    checkpoint: string | null;
    complete: boolean;
};
export declare function validateUatArtifactContent(content: string, summaryPaths?: string[], options?: UatValidationOptions): {
    valid: boolean;
    issues: string[];
    warnings: string[];
};
export declare function validateReviewArtifactContent(content: string, artifact: "code-review" | "peer-review" | "review-fix" | "security" | "ui-review"): {
    valid: boolean;
    issues: string[];
    warnings: string[];
};
export declare function validateReviewArtifactScopeCoverage(content: string, scopeFiles: string[]): {
    valid: boolean;
    issues: string[];
    warnings: string[];
};
export declare function validateReportArtifactContent(content: string, reportName: string): {
    valid: boolean;
    issues: string[];
    warnings: string[];
};
type SummaryValidationOptions = {
    linkedPlanPath?: string | null;
    requirePlanMarker?: boolean;
};
export declare function extractSummaryPlanReference(content: string): string | null;
export declare function extractSummaryStatus(content: string): "COMPLETED" | "PARTIAL" | "BLOCKED" | null;
export declare function validateSummaryArtifactContent(content: string): {
    valid: boolean;
    issues: string[];
    warnings: string[];
};
export declare function validateSummaryPlanReference(content: string, options?: SummaryValidationOptions): {
    valid: boolean;
    issues: string[];
    warnings: string[];
};
export declare function validateStrictSummaryArtifactContent(content: string, options?: SummaryValidationOptions): {
    valid: boolean;
    issues: string[];
    warnings: string[];
};
export declare function validatePlanArtifactContent(content: string, expectedPhase?: string, options?: {
    strict?: boolean;
}): {
    valid: boolean;
    issues: string[];
    warnings: string[];
    metadata: PlanArtifactMetadata;
};
export declare function inspectBlueprintArtifacts(projectRoot: string): Promise<{
    readiness: BlueprintReadiness;
    blueprintRootExists: boolean;
    workflowArtifactFiles: string[];
    core: {
        present: string[];
        missing: string[];
    };
    phases: string[];
    reports: string[];
    codebase: CodebaseArtifactDiagnostics;
}>;
export declare function inspectBootstrapArtifacts(projectRoot: string): Promise<BootstrapArtifactDiagnostics>;
export declare function blueprintArtifactScaffold(args?: ArtifactScaffoldArgs): Promise<ArtifactScaffoldResult>;
export declare function blueprintArtifactList(args?: ArtifactListArgs): Promise<ArtifactListResult>;
export declare function blueprintArtifactMutateIndex(args: ArtifactMutateIndexArgs): Promise<ArtifactMutateIndexResult>;
export declare function blueprintArtifactValidate(args?: ArtifactValidateArgs): Promise<ArtifactValidateResult>;
export declare function blueprintArtifactSummaryDigest(args?: ArtifactSummaryDigestArgs): Promise<ArtifactSummaryDigestResult>;
export declare function blueprintArtifactContractRead(args?: ArtifactContractReadArgs): Promise<ArtifactContractReadResult>;
export declare function blueprintArtifactReportAuthoringContext(args: ArtifactReportAuthoringContextArgs): Promise<ArtifactReportAuthoringContextResult>;
export declare function blueprintArtifactReportValidateModel(args: ArtifactReportValidateModelArgs): Promise<ArtifactReportValidateModelResult>;
export declare function blueprintArtifactReportWrite(args: ArtifactReportWriteArgs): Promise<ArtifactReportWriteResult>;
export declare function blueprintCodebaseArtifactWrite(args: ArtifactCodebaseWriteArgs): Promise<ArtifactCodebaseWriteResult>;
export declare const artifactToolDefinitions: ({
    name: string;
    description: string;
    inputSchema: {
        artifactId: z.ZodOptional<z.ZodEnum<{
            "bootstrap.project": "bootstrap.project";
            "bootstrap.requirements": "bootstrap.requirements";
            "bootstrap.roadmap": "bootstrap.roadmap";
            "codebase.stack": "codebase.stack";
            "codebase.architecture": "codebase.architecture";
            "codebase.structure": "codebase.structure";
            "codebase.conventions": "codebase.conventions";
            "codebase.testing": "codebase.testing";
            "codebase.integrations": "codebase.integrations";
            "codebase.concerns": "codebase.concerns";
            "phase.context": "phase.context";
            "phase.discussion-log": "phase.discussion-log";
            "phase.research": "phase.research";
            "phase.ui-spec": "phase.ui-spec";
            "phase.plan": "phase.plan";
            "phase.summary": "phase.summary";
            "phase.verification": "phase.verification";
            "phase.uat": "phase.uat";
            "review.code-review": "review.code-review";
            "review.review-fix": "review.review-fix";
            "review.peer-review": "review.peer-review";
            "review.security": "review.security";
            "review.ui-review": "review.ui-review";
            "report.pause-work": "report.pause-work";
            "report.milestone-audit": "report.milestone-audit";
            "report.milestone-complete": "report.milestone-complete";
            "report.milestone-summary": "report.milestone-summary";
            "report.debug": "report.debug";
            "report.quick-run": "report.quick-run";
            "report.docs-update": "report.docs-update";
            "report.pr-branch": "report.pr-branch";
            "report.ship": "report.ship";
            "report.undo": "report.undo";
            "report.cleanup": "report.cleanup";
            "report.add-tests": "report.add-tests";
            "report.audit-fix": "report.audit-fix";
            "report.impact": "report.impact";
        }>>;
    };
    handler: (args: Record<string, unknown>) => Promise<ArtifactContractReadResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        projectName: z.ZodOptional<z.ZodString>;
        overwrite: z.ZodOptional<z.ZodBoolean>;
        artifacts: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodEnum<{
            ".blueprint/PROJECT.md": ".blueprint/PROJECT.md";
            ".blueprint/REQUIREMENTS.md": ".blueprint/REQUIREMENTS.md";
            ".blueprint/ROADMAP.md": ".blueprint/ROADMAP.md";
            ".blueprint/codebase/STACK.md": ".blueprint/codebase/STACK.md";
            ".blueprint/codebase/ARCHITECTURE.md": ".blueprint/codebase/ARCHITECTURE.md";
            ".blueprint/codebase/STRUCTURE.md": ".blueprint/codebase/STRUCTURE.md";
            ".blueprint/codebase/CONVENTIONS.md": ".blueprint/codebase/CONVENTIONS.md";
            ".blueprint/codebase/TESTING.md": ".blueprint/codebase/TESTING.md";
            ".blueprint/codebase/INTEGRATIONS.md": ".blueprint/codebase/INTEGRATIONS.md";
            ".blueprint/codebase/CONCERNS.md": ".blueprint/codebase/CONCERNS.md";
            ".blueprint/phases/": ".blueprint/phases/";
        }>, z.ZodString]>>>;
        bootstrapSeed: z.ZodOptional<z.ZodObject<{
            vision: z.ZodOptional<z.ZodString>;
            audience: z.ZodOptional<z.ZodObject<{
                primary: z.ZodOptional<z.ZodArray<z.ZodString>>;
                secondary: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            constraints: z.ZodOptional<z.ZodArray<z.ZodString>>;
            currentMilestone: z.ZodOptional<z.ZodString>;
            nonGoals: z.ZodOptional<z.ZodArray<z.ZodString>>;
            requirements: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                scope: z.ZodOptional<z.ZodEnum<{
                    deferred: "deferred";
                    committed: "committed";
                    out_of_scope: "out_of_scope";
                }>>;
                group: z.ZodOptional<z.ZodString>;
                requirement: z.ZodString;
                status: z.ZodString;
                notes: z.ZodString;
            }, z.core.$strip>>>;
            roadmapPhases: z.ZodOptional<z.ZodArray<z.ZodObject<{
                phase: z.ZodString;
                title: z.ZodString;
                status: z.ZodOptional<z.ZodEnum<{
                    done: "done";
                    planned: "planned";
                    in_progress: "in_progress";
                }>>;
                objective: z.ZodString;
                requirementIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
                successCriteria: z.ZodOptional<z.ZodArray<z.ZodString>>;
                notes: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
            brownfieldMode: z.ZodOptional<z.ZodEnum<{
                greenfield: "greenfield";
                "scaffold-only": "scaffold-only";
                brownfield: "brownfield";
            }>>;
            assumptions: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
    };
    handler: (args: Record<string, unknown>) => Promise<ArtifactScaffoldResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        artifactId: z.ZodEnum<{
            "codebase.stack": "codebase.stack";
            "codebase.architecture": "codebase.architecture";
            "codebase.structure": "codebase.structure";
            "codebase.conventions": "codebase.conventions";
            "codebase.testing": "codebase.testing";
            "codebase.integrations": "codebase.integrations";
            "codebase.concerns": "codebase.concerns";
        }>;
        content: z.ZodString;
        overwrite: z.ZodOptional<z.ZodBoolean>;
    };
    handler: (args: Record<string, unknown>) => Promise<ArtifactCodebaseWriteResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
    };
    handler: (args: Record<string, unknown>) => Promise<ArtifactListResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        target: z.ZodEnum<{
            note: "note";
            backlog: "backlog";
            todo: "todo";
        }>;
        action: z.ZodOptional<z.ZodEnum<{
            append: "append";
            list: "list";
            update: "update";
        }>>;
        entry: z.ZodOptional<z.ZodObject<{
            text: z.ZodString;
            status: z.ZodOptional<z.ZodString>;
            addedAt: z.ZodOptional<z.ZodString>;
            reservePhaseStub: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
        filter: z.ZodOptional<z.ZodObject<{
            query: z.ZodOptional<z.ZodString>;
            ids: z.ZodOptional<z.ZodArray<z.ZodString>>;
            statuses: z.ZodOptional<z.ZodArray<z.ZodString>>;
            limit: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        match: z.ZodOptional<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            text: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        update: z.ZodOptional<z.ZodObject<{
            status: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        updates: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            status: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            reservedPhase: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
    };
    handler: (args: Record<string, unknown>) => Promise<ArtifactMutateIndexResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
    };
    handler: (args: Record<string, unknown>) => Promise<ArtifactValidateResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        focusArea: z.ZodOptional<z.ZodString>;
        packageJsonPath: z.ZodOptional<z.ZodString>;
        readmePath: z.ZodOptional<z.ZodString>;
        sourceFiles: z.ZodOptional<z.ZodArray<z.ZodString>>;
        testFiles: z.ZodOptional<z.ZodArray<z.ZodString>>;
        docFiles: z.ZodOptional<z.ZodArray<z.ZodString>>;
        trackedFiles: z.ZodOptional<z.ZodArray<z.ZodString>>;
        artifactPaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    };
    handler: (args: Record<string, unknown>) => Promise<ArtifactSummaryDigestResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        reportName: z.ZodString;
        auditFixContext: z.ZodOptional<z.ZodObject<{
            source: z.ZodEnum<{
                review: "review";
                verification: "verification";
                uat: "uat";
                security: "security";
                all: "all";
            }>;
            severity: z.ZodEnum<{
                high: "high";
                all: "all";
                medium: "medium";
            }>;
            maxAttempts: z.ZodNumber;
            dryRun: z.ZodBoolean;
            scopeFiles: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
    };
    handler: (args: Record<string, unknown>) => Promise<ArtifactReportAuthoringContextResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        reportName: z.ZodString;
        model: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        auditFixContext: z.ZodOptional<z.ZodObject<{
            source: z.ZodEnum<{
                review: "review";
                verification: "verification";
                uat: "uat";
                security: "security";
                all: "all";
            }>;
            severity: z.ZodEnum<{
                high: "high";
                all: "all";
                medium: "medium";
            }>;
            maxAttempts: z.ZodNumber;
            dryRun: z.ZodBoolean;
            scopeFiles: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
    };
    handler: (args: Record<string, unknown>) => Promise<ArtifactReportValidateModelResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        reportName: z.ZodString;
        content: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        overwrite: z.ZodOptional<z.ZodBoolean>;
        auditFixContext: z.ZodOptional<z.ZodObject<{
            source: z.ZodEnum<{
                review: "review";
                verification: "verification";
                uat: "uat";
                security: "security";
                all: "all";
            }>;
            severity: z.ZodEnum<{
                high: "high";
                all: "all";
                medium: "medium";
            }>;
            maxAttempts: z.ZodNumber;
            dryRun: z.ZodBoolean;
            scopeFiles: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
    };
    handler: (args: Record<string, unknown>) => Promise<ArtifactReportWriteResult>;
})[];
export {};
