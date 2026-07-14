import type { ToolDefinition } from "../tool-types.js";
import { type QualityShippingProcessResult, type QualityShippingProcessRunner } from "../quality-shipping-safety.js";
import { blueprintArtifactReportWrite } from "./artifacts.js";
import { blueprintConfigGet } from "./config.js";
declare const REPORT_PATH = ".blueprint/reports/pr-branch-latest.md";
export type PrBranchPreviewArgs = {
    cwd?: string;
    baseRef: string;
    reviewBranch: string;
    blueprintPolicy: "exclude" | "include";
    evidencePaths: string[];
    overwriteReport?: boolean;
    stayOnReviewBranch?: boolean;
};
type PathChange = {
    status: string;
    paths: string[];
};
export type PrBranchCommit = {
    sourceCommit: string;
    parents: string[];
    tree: string;
    subject: string;
    author: string;
    message: string;
    filteredDeltaSha256: string;
    classification: "code-only" | "blueprint-only" | "mixed";
    action: "include" | "exclude";
    pathChanges: PathChange[];
    includedPaths: string[];
    excludedPaths: string[];
};
type EvidenceReceipt = {
    path: string;
    contentSha256: string | null;
};
export type PrBranchApprovalPacket = {
    schemaVersion: 1;
    operation: "pr-branch";
    repoRoot: string;
    gitCommonDir: string;
    sourceBranch: string;
    sourceHead: string;
    baseRef: string;
    baseOid: string;
    mergeBase: string;
    reviewBranch: string;
    reviewRefDisposition: "absent";
    blueprintPolicy: "exclude" | "include";
    stayOnReviewBranch: boolean;
    gitConfigSha256: string;
    blueprintConfig: {
        sha256: string;
        gitBaseBranch: string | null;
        gitBranchingStrategy: string;
        planningCommitDocs: boolean;
        layersApplied: string[];
        defaultsPath: string | null;
        projectPath: string | null;
        sourcePath: string | null;
    };
    workingTreeFingerprint: string;
    inProgressState: string[];
    commits: PrBranchCommit[];
    includedPaths: string[];
    excludedPaths: string[];
    expectedRetainedTree: Array<{
        path: string;
        entry: string | null;
    }>;
    evidence: EvidenceReceipt[];
    report: {
        path: typeof REPORT_PATH;
        overwriteApproved: boolean;
        priorExists: boolean;
        priorContentSha256: string | null;
        preMutationContentSha256: string;
    };
    executionPlan: Array<{
        stage: string;
        argv: string[];
    }>;
};
type ProcessReceipt = {
    stage: string;
    argv: string[];
    result: QualityShippingProcessResult;
};
type Mapping = {
    sourceCommit: string;
    reviewCommit: string | null;
    outcome: "replayed" | "excluded" | "empty-after-filter" | "failed" | "not-attempted";
    observedSubject?: string | null;
    verification?: "verified" | "not-applicable" | "not-attempted" | "mismatch" | "unknown";
};
export type PrBranchExecutionResult = {
    status: "blocked" | "stale" | "succeeded" | "partial" | "failed" | "outcome-unknown";
    stage: "approval" | "revalidate" | "pre-report" | "create-branch" | "replay" | "validate" | "restore-source" | "outcome-report" | "persistence-recovery";
    operationId: string;
    fingerprint: string;
    mutationStarted: boolean;
    source: {
        branch: string;
        beforeOid: string;
        afterOid: string | null;
        preserved: boolean;
        restored: boolean;
    };
    review: {
        branch: string;
        oid: string | null;
        disposition: "absent" | "created" | "partial" | "complete";
    };
    mapping: Mapping[];
    processes: ProcessReceipt[];
    validation: {
        clean: boolean | null;
        finalClean: boolean | null;
        retainedPaths: string[];
        excludedPathsFound: string[];
        retainedCommitCount: number | null;
        currentBranch: string | null;
        currentHead: string | null;
    };
    report: {
        path: typeof REPORT_PATH;
        preMutationStatus: "not-attempted" | "created" | "updated" | "reused" | "failed";
        outcomeStatus: "not-attempted" | "created" | "updated" | "reused" | "failed";
        error: string | null;
    };
    blockers: string[];
    warnings: string[];
    recoveryActions: string[];
};
type PreviewResult = {
    status: "ready" | "blocked" | "already-complete" | "partial" | "divergent" | "invalid";
    operationId: string | null;
    fingerprint: string | null;
    packet: PrBranchApprovalPacket | null;
    waitingState: "review-branch-confirmation" | "report-overwrite-confirmation" | null;
    blockers: string[];
    warnings: string[];
};
type ReportWriteResult = Awaited<ReturnType<typeof blueprintArtifactReportWrite>>;
type ReportWriter = (args: {
    cwd?: string;
    reportName: string;
    content?: string;
    overwrite?: boolean;
    expectedExistingContentSha256?: string | null;
}) => Promise<ReportWriteResult>;
declare let effectiveConfigReader: (args: {
    cwd?: string;
    scope: "effective";
}) => ReturnType<typeof blueprintConfigGet>;
export declare const prBranchToolTestHooks: {
    setProcessRunnerForTest(runner: QualityShippingProcessRunner): () => void;
    setReportWriterForTest(writer: ReportWriter): () => void;
    setEffectiveConfigReaderForTest(reader: typeof effectiveConfigReader): () => void;
    clearApprovalsForTest(): void;
    mutateApprovalForTest(operationId: string, mutate: (packet: PrBranchApprovalPacket) => void, rebindStoredFingerprint?: boolean): string | null;
    setRetentionForTest(args: {
        now?: () => number;
        approvalTtlMs?: number;
        terminalTtlMs?: number;
        maxApprovals?: number;
    }): () => void;
};
export declare function blueprintPrBranchPreview(args: PrBranchPreviewArgs): Promise<PreviewResult>;
export declare function blueprintPrBranchExecute(args: {
    operationId: string;
    fingerprint: string;
    confirmed: true;
}): Promise<PrBranchExecutionResult>;
export declare function blueprintPrBranchPersist(args: {
    operationId: string;
    fingerprint: string;
}): Promise<PrBranchExecutionResult>;
export declare const prBranchToolDefinitions: ToolDefinition[];
export {};
