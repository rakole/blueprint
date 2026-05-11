import * as z from "zod/v4";
import type { ToolDefinition } from "../tool-types.js";
export declare const GOD_REVIEW_FLAG: "--feels-like-god";
export declare const GOD_REVIEW_REFUSAL: string;
export declare const GOD_REVIEW_PRIVATE_TOOL_NAMES: readonly ["blueprint_god_review_start", "blueprint_god_review_next", "blueprint_god_review_append", "blueprint_god_review_load_findings", "blueprint_god_review_record_fix", "blueprint_god_review_cleanup"];
export declare const GOD_REVIEW_MUTATION_TOOL_NAMES: readonly ["blueprint_god_review_start", "blueprint_god_review_append", "blueprint_god_review_record_fix", "blueprint_god_review_cleanup"];
export declare const GOD_REVIEW_ACTIVE_COMMANDS: readonly ["/blu-code-review", "/blu-code-review-fix"];
declare const GOD_REVIEW_SCOPE_KIND_VALUES: readonly ["phase", "pr", "current-diff", "explicit-files"];
declare const GOD_REVIEW_SESSION_STATUS_VALUES: readonly ["in-progress", "completed", "blocked", "stale"];
declare const GOD_REVIEW_GROUP_STATUS_VALUES: readonly ["pending", "in-progress", "completed", "blocked"];
declare const GOD_REVIEW_SEVERITY_VALUES: readonly ["critical", "high", "medium", "low", "unknown"];
declare const GOD_REVIEW_DISPOSITION_VALUES: readonly ["follow-up", "observation", "blocked", "accepted-risk"];
declare const GOD_REVIEW_FIX_ELIGIBILITY_VALUES: readonly ["eligible", "needs-confirmation", "not-eligible"];
declare const GOD_REVIEW_REMEDIATION_STATUS_VALUES: readonly ["fixed", "skipped", "deferred", "stale", "blocked"];
declare const GOD_REVIEW_SELECTED_BY_VALUES: readonly ["default", "explicit-id", "severity-filter", "all"];
declare const GOD_REVIEW_FIX_SELECTION_STATUS_VALUES: readonly ["ready", "empty", "stale", "invalid"];
export declare const GOD_REVIEW_GROUPS: readonly [{
    readonly id: "correctness-contracts";
    readonly prefix: "COR";
    readonly title: "Correctness And Contracts";
}, {
    readonly id: "security-privacy-auth";
    readonly prefix: "SEC";
    readonly title: "Security, Privacy, And Authorization";
}, {
    readonly id: "data-state-consistency";
    readonly prefix: "DAT";
    readonly title: "Data, State, And Consistency";
}, {
    readonly id: "failure-reliability";
    readonly prefix: "REL";
    readonly title: "Failure Handling And Reliability";
}, {
    readonly id: "tests-verification";
    readonly prefix: "TST";
    readonly title: "Tests And Verification";
}, {
    readonly id: "architecture-maintainability";
    readonly prefix: "ARC";
    readonly title: "Architecture And Maintainability";
}, {
    readonly id: "performance-scalability";
    readonly prefix: "PER";
    readonly title: "Performance And Scalability";
}, {
    readonly id: "operations-portability-product";
    readonly prefix: "OPS";
    readonly title: "Operations, Portability, And Product Surface";
}];
declare const GOD_REVIEW_GROUP_ID_VALUES: ["correctness-contracts", "security-privacy-auth", "data-state-consistency", "failure-reliability", "tests-verification", "architecture-maintainability", "performance-scalability", "operations-portability-product"];
declare const GOD_REVIEW_GROUP_PREFIX_VALUES: ["COR", "SEC", "DAT", "REL", "TST", "ARC", "PER", "OPS"];
export type GodReviewPrivateToolName = typeof GOD_REVIEW_PRIVATE_TOOL_NAMES[number];
export type GodReviewMutationToolName = typeof GOD_REVIEW_MUTATION_TOOL_NAMES[number];
export type GodReviewActiveCommand = typeof GOD_REVIEW_ACTIVE_COMMANDS[number];
export type GodReviewScopeKind = typeof GOD_REVIEW_SCOPE_KIND_VALUES[number];
export type GodReviewSessionStatus = typeof GOD_REVIEW_SESSION_STATUS_VALUES[number];
export type GodReviewGroupId = typeof GOD_REVIEW_GROUP_ID_VALUES[number];
export type GodReviewGroupPrefix = typeof GOD_REVIEW_GROUP_PREFIX_VALUES[number];
export type GodReviewGroupStatus = typeof GOD_REVIEW_GROUP_STATUS_VALUES[number];
export type GodReviewSeverity = typeof GOD_REVIEW_SEVERITY_VALUES[number];
export type GodReviewDisposition = typeof GOD_REVIEW_DISPOSITION_VALUES[number];
export type GodReviewFixEligibility = typeof GOD_REVIEW_FIX_ELIGIBILITY_VALUES[number];
export type GodReviewRemediationStatus = typeof GOD_REVIEW_REMEDIATION_STATUS_VALUES[number];
export type GodReviewSelectedBy = typeof GOD_REVIEW_SELECTED_BY_VALUES[number];
export type GodReviewFixSelectionStatus = typeof GOD_REVIEW_FIX_SELECTION_STATUS_VALUES[number];
export declare const godReviewScopeKindSchema: z.ZodEnum<{
    phase: "phase";
    "explicit-files": "explicit-files";
    pr: "pr";
    "current-diff": "current-diff";
}>;
export declare const godReviewSessionStatusSchema: z.ZodEnum<{
    blocked: "blocked";
    completed: "completed";
    "in-progress": "in-progress";
    stale: "stale";
}>;
export declare const godReviewGroupStatusSchema: z.ZodEnum<{
    blocked: "blocked";
    completed: "completed";
    pending: "pending";
    "in-progress": "in-progress";
}>;
export declare const godReviewSeveritySchema: z.ZodEnum<{
    unknown: "unknown";
    high: "high";
    low: "low";
    medium: "medium";
    critical: "critical";
}>;
export declare const godReviewDispositionSchema: z.ZodEnum<{
    blocked: "blocked";
    "follow-up": "follow-up";
    observation: "observation";
    "accepted-risk": "accepted-risk";
}>;
export declare const godReviewFixEligibilitySchema: z.ZodEnum<{
    eligible: "eligible";
    "needs-confirmation": "needs-confirmation";
    "not-eligible": "not-eligible";
}>;
export declare const godReviewRemediationStatusSchema: z.ZodEnum<{
    fixed: "fixed";
    blocked: "blocked";
    skipped: "skipped";
    deferred: "deferred";
    stale: "stale";
}>;
export declare const godReviewSelectedBySchema: z.ZodEnum<{
    default: "default";
    all: "all";
    "explicit-id": "explicit-id";
    "severity-filter": "severity-filter";
}>;
export declare const godReviewScopeFingerprintSchema: z.ZodObject<{
    baseSha: z.ZodNullable<z.ZodString>;
    headSha: z.ZodNullable<z.ZodString>;
    diffHash: z.ZodNullable<z.ZodString>;
    fileSetHash: z.ZodString;
    prNumber: z.ZodNullable<z.ZodNumber>;
}, z.core.$strip>;
export declare const godReviewGroupStateSchema: z.ZodObject<{
    id: z.ZodEnum<{
        "correctness-contracts": "correctness-contracts";
        "security-privacy-auth": "security-privacy-auth";
        "data-state-consistency": "data-state-consistency";
        "failure-reliability": "failure-reliability";
        "tests-verification": "tests-verification";
        "architecture-maintainability": "architecture-maintainability";
        "performance-scalability": "performance-scalability";
        "operations-portability-product": "operations-portability-product";
    }>;
    prefix: z.ZodEnum<{
        COR: "COR";
        SEC: "SEC";
        DAT: "DAT";
        REL: "REL";
        TST: "TST";
        ARC: "ARC";
        PER: "PER";
        OPS: "OPS";
    }>;
    status: z.ZodEnum<{
        blocked: "blocked";
        completed: "completed";
        pending: "pending";
        "in-progress": "in-progress";
    }>;
    findingIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const godReviewSessionSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    runId: z.ZodString;
    parentRunId: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
        blocked: "blocked";
        completed: "completed";
        "in-progress": "in-progress";
        stale: "stale";
    }>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    activeCommand: z.ZodEnum<{
        "/blu-code-review": "/blu-code-review";
        "/blu-code-review-fix": "/blu-code-review-fix";
    }>;
    scopeKind: z.ZodEnum<{
        phase: "phase";
        "explicit-files": "explicit-files";
        pr: "pr";
        "current-diff": "current-diff";
    }>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    sessionPath: z.ZodString;
    humanStatePath: z.ZodString;
    reportPath: z.ZodString;
    files: z.ZodArray<z.ZodString>;
    skippedFiles: z.ZodArray<z.ZodString>;
    scopeFingerprint: z.ZodObject<{
        baseSha: z.ZodNullable<z.ZodString>;
        headSha: z.ZodNullable<z.ZodString>;
        diffHash: z.ZodNullable<z.ZodString>;
        fileSetHash: z.ZodString;
        prNumber: z.ZodNullable<z.ZodNumber>;
    }, z.core.$strip>;
    groups: z.ZodArray<z.ZodObject<{
        id: z.ZodEnum<{
            "correctness-contracts": "correctness-contracts";
            "security-privacy-auth": "security-privacy-auth";
            "data-state-consistency": "data-state-consistency";
            "failure-reliability": "failure-reliability";
            "tests-verification": "tests-verification";
            "architecture-maintainability": "architecture-maintainability";
            "performance-scalability": "performance-scalability";
            "operations-portability-product": "operations-portability-product";
        }>;
        prefix: z.ZodEnum<{
            COR: "COR";
            SEC: "SEC";
            DAT: "DAT";
            REL: "REL";
            TST: "TST";
            ARC: "ARC";
            PER: "PER";
            OPS: "OPS";
        }>;
        status: z.ZodEnum<{
            blocked: "blocked";
            completed: "completed";
            pending: "pending";
            "in-progress": "in-progress";
        }>;
        findingIds: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    nextGroupId: z.ZodNullable<z.ZodEnum<{
        "correctness-contracts": "correctness-contracts";
        "security-privacy-auth": "security-privacy-auth";
        "data-state-consistency": "data-state-consistency";
        "failure-reliability": "failure-reliability";
        "tests-verification": "tests-verification";
        "architecture-maintainability": "architecture-maintainability";
        "performance-scalability": "performance-scalability";
        "operations-portability-product": "operations-portability-product";
    }>>;
    cleanup: z.ZodObject<{
        reviewTerminal: z.ZodBoolean;
        godFixTerminal: z.ZodBoolean;
        eligible: z.ZodBoolean;
    }, z.core.$strip>;
}, z.core.$strip>;
export type GodReviewScopeFingerprint = z.infer<typeof godReviewScopeFingerprintSchema>;
export type GodReviewGroupState = z.infer<typeof godReviewGroupStateSchema>;
export type GodReviewSession = z.infer<typeof godReviewSessionSchema>;
export type GodReviewActivationResult = {
    status: "valid";
    activeCommand: GodReviewActiveCommand;
    mode: "review" | "fix";
    hiddenFlag: true;
} | {
    status: "refused";
    refusal: string;
    sideEffectsAllowed: false;
    reason: string;
};
export type GodReviewRepoPathResult = {
    valid: true;
    path: string;
} | {
    valid: false;
    path: null;
    reason: string;
};
export type GodReviewPhasePaths = {
    sessionPath: string;
    humanStatePath: string;
    reportPath: string;
};
export type GodReviewReportPaths = GodReviewPhasePaths;
export type GodReviewParsedFinding = {
    id: string;
    title: string;
    severity: GodReviewSeverity | null;
    disposition: GodReviewDisposition | null;
    confidence: "high" | "medium" | "low" | null;
    files: string[];
    evidence: string | null;
    impact: string | null;
    recommendation: string | null;
    fixEligibility: GodReviewFixEligibility | null;
    remediationAttempts?: GodReviewParsedRemediation[];
    remediated?: boolean;
    stale?: boolean;
};
export type GodReviewParsedRemediation = {
    id: string;
    findingId: string;
    status: GodReviewRemediationStatus | null;
    selectedBy: GodReviewSelectedBy | null;
    filesChanged: string[];
    verification: string | null;
    evidence: string | null;
    followUp: string | null;
};
export type GodReviewParseResult = {
    findings: GodReviewParsedFinding[];
    remediations: GodReviewParsedRemediation[];
    warnings: string[];
};
export type GodReviewFixTarget = {
    id: string;
    title: string;
    severity: GodReviewSeverity | null;
    disposition: GodReviewDisposition | null;
    fixEligibility: GodReviewFixEligibility | null;
    files: string[];
    selectedBy: GodReviewSelectedBy;
    requiresConfirmationForCodeEdit: boolean;
};
export type GodReviewFixSelection = {
    status: GodReviewFixSelectionStatus;
    selectedBy: GodReviewSelectedBy;
    reason: string | null;
    targets: GodReviewFixTarget[];
    excluded: Array<{
        id: string;
        reason: string;
    }>;
    staleReasons: string[];
    fingerprintFresh: boolean;
    evidenceFresh: boolean;
    currentFingerprint: GodReviewScopeFingerprint | null;
};
export type GodReviewStartResult = {
    status: "started" | "reused" | "invalid" | "refused";
    activated: boolean;
    refusal?: string;
    reason: string | null;
    runId: string | null;
    scopeKind: GodReviewScopeKind | null;
    phase: string | number | null;
    sessionPath: string | null;
    humanStatePath: string | null;
    reportPath: string | null;
    files: string[];
    skippedFiles: string[];
    scopeFingerprint: GodReviewScopeFingerprint | null;
    groups: GodReviewGroupState[];
    nextGroupId: GodReviewGroupId | null;
    nextCommand: string | null;
    written: boolean;
    createdPaths: string[];
    warnings: string[];
};
export type GodReviewNextResult = {
    status: "ready" | "complete" | "stale" | "invalid" | "refused";
    activated: boolean;
    refusal?: string;
    reason: string | null;
    runId: string | null;
    sessionPath: string | null;
    humanStatePath: string | null;
    reportPath: string | null;
    scopeKind: GodReviewScopeKind | null;
    phase: string | number | null;
    files: string[];
    scopeFingerprint: GodReviewScopeFingerprint | null;
    currentFingerprint: GodReviewScopeFingerprint | null;
    staleReasons: string[];
    nextGroup: GodReviewGroupState | null;
    nextGroupId: GodReviewGroupId | null;
    nextCommand: string | null;
    written: false;
    warnings: string[];
};
export type GodReviewAppendedFinding = {
    id: string;
    title: string;
    severity: GodReviewSeverity;
    disposition: GodReviewDisposition;
    confidence: "high" | "medium" | "low" | null;
    files: string[];
    evidence: string | null;
    impact: string | null;
    recommendation: string | null;
    fixEligibility: GodReviewFixEligibility;
};
export type GodReviewAppendResult = {
    status: "appended" | "stale" | "invalid" | "refused";
    activated: boolean;
    refusal?: string;
    reason: string | null;
    runId: string | null;
    sessionPath: string | null;
    humanStatePath: string | null;
    reportPath: string | null;
    groupId: GodReviewGroupId | null;
    groupStatus: GodReviewGroupStatus | null;
    findingIds: string[];
    findings: GodReviewAppendedFinding[];
    nextGroupId: GodReviewGroupId | null;
    nextCommand: string | null;
    written: boolean;
    staleReasons: string[];
    warnings: string[];
};
export type GodReviewLoadFindingsResult = {
    status: "found" | "not_found" | "invalid" | "refused";
    activated: boolean;
    refusal?: string;
    reason: string | null;
    reportPath: string | null;
    sessionPath: string | null;
    findings: GodReviewParsedFinding[];
    remediations: GodReviewParsedRemediation[];
    selection: GodReviewFixSelection | null;
    warnings: string[];
};
export type GodReviewRecordFixResult = {
    status: "recorded" | "stale" | "invalid" | "refused";
    activated: boolean;
    refusal?: string;
    reason: string | null;
    runId: string | null;
    sessionPath: string | null;
    humanStatePath: string | null;
    reportPath: string | null;
    remediationId: string | null;
    findingId: string | null;
    selectedBy: GodReviewSelectedBy | null;
    remediationStatus: GodReviewRemediationStatus | null;
    filesChanged: string[];
    terminal: boolean;
    cleanupEligible: boolean;
    written: boolean;
    staleReasons: string[];
    warnings: string[];
};
export type GodReviewCleanupResult = {
    status: "cleaned" | "blocked" | "invalid" | "refused";
    activated: boolean;
    refusal?: string;
    reason: string | null;
    runId: string | null;
    sessionPath: string | null;
    humanStatePath: string | null;
    reportPath: string | null;
    deletedPaths: string[];
    preservedPaths: string[];
    cleanupEligible: boolean;
    reviewTerminal: boolean;
    godFixTerminal: boolean;
    warnings: string[];
};
declare const godReviewStartArgsSchema: z.ZodObject<{
    cwd: z.ZodOptional<z.ZodString>;
    activeCommand: z.ZodEnum<{
        "/blu-code-review": "/blu-code-review";
        "/blu-code-review-fix": "/blu-code-review-fix";
    }>;
    rawInvocation: z.ZodString;
    scopeKind: z.ZodOptional<z.ZodEnum<{
        phase: "phase";
        "explicit-files": "explicit-files";
        pr: "pr";
        "current-diff": "current-diff";
    }>>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    prNumber: z.ZodOptional<z.ZodNumber>;
    files: z.ZodOptional<z.ZodArray<z.ZodString>>;
    runId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
type GodReviewStartArgs = z.infer<typeof godReviewStartArgsSchema>;
declare const godReviewNextArgsSchema: z.ZodObject<{
    cwd: z.ZodOptional<z.ZodString>;
    activeCommand: z.ZodEnum<{
        "/blu-code-review": "/blu-code-review";
        "/blu-code-review-fix": "/blu-code-review-fix";
    }>;
    rawInvocation: z.ZodString;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    runId: z.ZodOptional<z.ZodString>;
    sessionPath: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
type GodReviewNextArgs = z.infer<typeof godReviewNextArgsSchema>;
declare const godReviewAppendArgsSchema: z.ZodObject<{
    cwd: z.ZodOptional<z.ZodString>;
    activeCommand: z.ZodEnum<{
        "/blu-code-review": "/blu-code-review";
        "/blu-code-review-fix": "/blu-code-review-fix";
    }>;
    rawInvocation: z.ZodString;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    runId: z.ZodOptional<z.ZodString>;
    sessionPath: z.ZodOptional<z.ZodString>;
    groupId: z.ZodEnum<{
        "correctness-contracts": "correctness-contracts";
        "security-privacy-auth": "security-privacy-auth";
        "data-state-consistency": "data-state-consistency";
        "failure-reliability": "failure-reliability";
        "tests-verification": "tests-verification";
        "architecture-maintainability": "architecture-maintainability";
        "performance-scalability": "performance-scalability";
        "operations-portability-product": "operations-portability-product";
    }>;
    status: z.ZodEnum<{
        blocked: "blocked";
        completed: "completed";
    }>;
    findings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        severity: z.ZodString;
        disposition: z.ZodString;
        confidence: z.ZodOptional<z.ZodString>;
        files: z.ZodOptional<z.ZodArray<z.ZodString>>;
        evidence: z.ZodOptional<z.ZodString>;
        impact: z.ZodOptional<z.ZodString>;
        recommendation: z.ZodOptional<z.ZodString>;
        fixEligibility: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    groups: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
}, z.core.$strip>;
type GodReviewAppendArgs = z.infer<typeof godReviewAppendArgsSchema>;
declare const godReviewLoadFindingsArgsSchema: z.ZodObject<{
    cwd: z.ZodOptional<z.ZodString>;
    activeCommand: z.ZodEnum<{
        "/blu-code-review": "/blu-code-review";
        "/blu-code-review-fix": "/blu-code-review-fix";
    }>;
    rawInvocation: z.ZodString;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    runId: z.ZodOptional<z.ZodString>;
    sessionPath: z.ZodOptional<z.ZodString>;
    reportPath: z.ZodOptional<z.ZodString>;
    findingIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    severity: z.ZodOptional<z.ZodString>;
    all: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
type GodReviewLoadFindingsArgs = z.infer<typeof godReviewLoadFindingsArgsSchema>;
declare const godReviewRecordFixArgsSchema: z.ZodObject<{
    cwd: z.ZodOptional<z.ZodString>;
    activeCommand: z.ZodLiteral<"/blu-code-review-fix">;
    rawInvocation: z.ZodString;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    runId: z.ZodOptional<z.ZodString>;
    sessionPath: z.ZodOptional<z.ZodString>;
    reportPath: z.ZodOptional<z.ZodString>;
    findingId: z.ZodString;
    status: z.ZodEnum<{
        fixed: "fixed";
        blocked: "blocked";
        skipped: "skipped";
        deferred: "deferred";
        stale: "stale";
    }>;
    selectedBy: z.ZodEnum<{
        default: "default";
        all: "all";
        "explicit-id": "explicit-id";
        "severity-filter": "severity-filter";
    }>;
    filesChanged: z.ZodOptional<z.ZodArray<z.ZodString>>;
    verification: z.ZodOptional<z.ZodString>;
    evidence: z.ZodOptional<z.ZodString>;
    followUp: z.ZodOptional<z.ZodString>;
    terminal: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
type GodReviewRecordFixArgs = z.infer<typeof godReviewRecordFixArgsSchema>;
declare const godReviewCleanupArgsSchema: z.ZodObject<{
    cwd: z.ZodOptional<z.ZodString>;
    activeCommand: z.ZodLiteral<"/blu-code-review-fix">;
    rawInvocation: z.ZodString;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    runId: z.ZodOptional<z.ZodString>;
    sessionPath: z.ZodOptional<z.ZodString>;
    noEligibleFindingsTerminal: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
type GodReviewCleanupArgs = z.infer<typeof godReviewCleanupArgsSchema>;
export declare function isGodReviewPrivateToolName(toolName: string): toolName is GodReviewPrivateToolName;
export declare function evaluateGodReviewActivation(args: {
    activeCommand: string;
    rawInvocation: string;
}): GodReviewActivationResult;
export declare function normalizeGodReviewRepoRelativeFilePath(rawPath: string): GodReviewRepoPathResult;
export declare function hashGodReviewFileSet(args: {
    files: string[];
    skippedFiles?: string[];
}): string;
export declare function buildGodReviewPhasePaths(args: {
    phaseDir: string;
    phasePrefix: string;
}): GodReviewPhasePaths;
export declare function buildGodReviewReportPaths(args: {
    runId: string;
}): GodReviewReportPaths;
export declare function buildInitialGodReviewGroups(): GodReviewGroupState[];
export declare function renderGodReviewReportHeader(args: {
    runId: string;
    status: GodReviewSessionStatus;
    scopeKind: GodReviewScopeKind;
    sessionPath: string;
    scopeFingerprintSummary: string;
}): string;
export declare function renderGodReviewHumanState(args: {
    runId: string;
    scopeKind: GodReviewScopeKind;
    fileCount: number;
    currentGroupId: GodReviewGroupId | null;
    nextGroupId: GodReviewGroupId | null;
    reviewTerminal: boolean;
    godFixTerminal: boolean;
    stale: boolean;
    nextCommand: string;
}): string;
export declare function blueprintGodReviewStart(rawArgs: GodReviewStartArgs): Promise<GodReviewStartResult>;
export declare function blueprintGodReviewNext(rawArgs: GodReviewNextArgs): Promise<GodReviewNextResult>;
export declare function blueprintGodReviewAppend(rawArgs: GodReviewAppendArgs): Promise<GodReviewAppendResult>;
export declare function blueprintGodReviewLoadFindings(rawArgs: GodReviewLoadFindingsArgs): Promise<GodReviewLoadFindingsResult>;
export declare function blueprintGodReviewRecordFix(rawArgs: GodReviewRecordFixArgs): Promise<GodReviewRecordFixResult>;
export declare function blueprintGodReviewCleanup(rawArgs: GodReviewCleanupArgs): Promise<GodReviewCleanupResult>;
export declare function parseGodReviewReportShell(content: string): GodReviewParseResult;
export declare const godReviewToolDefinitions: ToolDefinition[];
export {};
