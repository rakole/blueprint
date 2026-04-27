import * as z from "zod/v4";
type ReviewArtifactKind = "code-review" | "peer-review" | "review-fix" | "security" | "ui-review";
type NumericInput = string | number;
type ReviewFindingSeverity = "critical" | "high" | "medium" | "low" | "unknown";
type ReviewFinding = {
    id: string;
    severity: ReviewFindingSeverity;
    summary: string;
    sourceSection: string | null;
};
type ReviewRecordArgs = {
    cwd?: string;
    phase?: NumericInput;
    artifact: ReviewArtifactKind;
    content: string;
    overwrite?: boolean;
    scopeFiles?: string[];
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
    warnings: string[];
};
type ReviewDepth = "quick" | "standard" | "deep";
type ReviewModeSource = "explicit-files" | "phase-plans" | "phase-summaries" | "phase-evidence";
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
};
type ReviewScopeResult = {
    status: "ready" | "invalid";
    phase: {
        phaseNumber: string;
        phasePrefix: string;
        phaseName: string;
        phaseDir: string;
        resolvedFrom: "explicit" | "state" | "roadmap";
    } | null;
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
    reason: string | null;
    warnings: string[];
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
    reason: string | null;
    warnings: string[];
};
export declare function blueprintReviewScope(args: ReviewScopeArgs): Promise<ReviewScopeResult>;
export declare function blueprintReviewRecord(args: ReviewRecordArgs): Promise<ReviewRecordResult>;
export declare function blueprintReviewLoadFindings(args: ReviewLoadFindingsArgs): Promise<ReviewLoadFindingsResult>;
export declare const reviewToolDefinitions: ({
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        files: z.ZodOptional<z.ZodArray<z.ZodString>>;
        depth: z.ZodOptional<z.ZodEnum<{
            standard: "standard";
            quick: "quick";
            deep: "deep";
        }>>;
    };
    handler: (args: Record<string, unknown>) => Promise<ReviewScopeResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        artifact: z.ZodOptional<z.ZodEnum<{
            "code-review": "code-review";
            "peer-review": "peer-review";
            "review-fix": "review-fix";
            security: "security";
            "ui-review": "ui-review";
        }>>;
    };
    handler: (args: Record<string, unknown>) => Promise<ReviewLoadFindingsResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        artifact: z.ZodEnum<{
            "code-review": "code-review";
            "peer-review": "peer-review";
            "review-fix": "review-fix";
            security: "security";
            "ui-review": "ui-review";
        }>;
        content: z.ZodString;
        overwrite: z.ZodOptional<z.ZodBoolean>;
        scopeFiles: z.ZodOptional<z.ZodArray<z.ZodString>>;
    };
    handler: (args: Record<string, unknown>) => Promise<ReviewRecordResult>;
})[];
export {};
