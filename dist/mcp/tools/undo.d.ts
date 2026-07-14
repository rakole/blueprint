import type { ToolDefinition } from "../tool-types.js";
import { type QualityShippingProcessResult, type QualityShippingProcessRunner } from "../quality-shipping-safety.js";
import { blueprintArtifactReportWrite } from "./artifacts.js";
import { type StateUpdateArgs, type StateUpdateResult } from "./state.js";
declare const UNDO_REPORT_PATH = ".blueprint/reports/undo-latest.md";
export type UndoTargetInput = {
    sha: string;
    mainline?: number;
};
export type UndoPreviewArgs = {
    cwd?: string;
    targets: UndoTargetInput[];
    reason: string;
    evidencePaths: string[];
    dependencyImpact?: string;
    overwriteReport?: boolean;
    statePatch?: StateUpdateArgs["patch"];
};
export type UndoCandidate = {
    sha: string;
    parents: string[];
    mainline: number | null;
    subject: string;
    changedPaths: string[];
    order: number;
    argv: string[];
};
export type UndoEvidenceReceipt = {
    path: string;
    contentSha256: string | null;
};
type UndoAppliedRevert = {
    target: string;
    revertCommit: string;
};
export type UndoApprovalPacket = {
    schemaVersion: 1;
    operation: "undo";
    repoRoot: string;
    gitCommonDir: string;
    branch: string;
    head: string;
    gitConfigSha256: string;
    workingTreeFingerprint: string;
    inProgressState: string[];
    candidates: UndoCandidate[];
    evidence: UndoEvidenceReceipt[];
    priorAppliedReverts: UndoAppliedRevert[];
    reason: string;
    dependencyImpact: string;
    report: {
        path: typeof UNDO_REPORT_PATH;
        overwriteApproved: boolean;
        priorExists: boolean;
        priorContentSha256: string | null;
        preMutationContentSha256: string;
    };
    statePatch: StateUpdateArgs["patch"] | null;
};
type UndoPreviewStatus = "ready" | "blocked" | "already-applied" | "invalid";
type UndoExecutionStatus = "blocked" | "stale" | "already-applied" | "succeeded" | "partial" | "failed" | "outcome-unknown";
type UndoPreviewResult = {
    status: UndoPreviewStatus;
    operationId: string | null;
    fingerprint: string | null;
    packet: UndoApprovalPacket | null;
    waitingState: "undo-confirmation" | "report-overwrite-confirmation" | null;
    blockers: string[];
    warnings: string[];
};
type UndoProcessReceipt = {
    target: string;
    argv: string[];
    result: QualityShippingProcessResult;
    headBefore: string;
    headAfter: string;
};
export type UndoExecutionResult = {
    status: UndoExecutionStatus;
    stage: "approval" | "revalidate" | "pre-report" | "execute" | "outcome-report" | "state" | "persistence-recovery";
    operationId: string;
    fingerprint: string;
    mutationStarted: boolean;
    mutationStatus: "not-started" | "succeeded" | "partial" | "failed" | "outcome-unknown";
    originalHead: string | null;
    finalHead: string | null;
    finalWorkingTreeStatus: "clean" | "dirty" | "unknown";
    attempted: string[];
    reverted: Array<{
        target: string;
        revertCommit: string;
    }>;
    unreverted: string[];
    processes: UndoProcessReceipt[];
    conflictedPaths: string[];
    inProgressState: string[];
    report: {
        path: typeof UNDO_REPORT_PATH;
        preMutationStatus: "not-attempted" | "created" | "updated" | "reused" | "failed";
        outcomeStatus: "not-attempted" | "created" | "updated" | "reused" | "failed";
        error: string | null;
    };
    state: {
        status: "not-requested" | "not-attempted" | "updated" | "unchanged" | "failed";
        path: string | null;
        error: string | null;
    };
    blockers: string[];
    warnings: string[];
    recoveryActions: string[];
};
type UndoReportWriteResult = Awaited<ReturnType<typeof blueprintArtifactReportWrite>>;
type UndoReportWriter = (args: {
    cwd?: string;
    reportName: string;
    content?: string;
    overwrite?: boolean;
    expectedExistingContentSha256?: string | null;
}) => Promise<UndoReportWriteResult>;
type UndoStateUpdater = (args: StateUpdateArgs) => Promise<StateUpdateResult>;
export declare const undoToolTestHooks: {
    setProcessRunnerForTest(runner: QualityShippingProcessRunner): () => void;
    setReportWriterForTest(writer: UndoReportWriter): () => void;
    setStateUpdaterForTest(updater: UndoStateUpdater): () => void;
    clearApprovalsForTest(): void;
    setRetentionForTest(args: {
        now?: () => number;
        approvalTtlMs?: number;
        terminalReceiptTtlMs?: number;
        maxApprovals?: number;
    }): () => void;
};
export declare function blueprintUndoPreview(args: UndoPreviewArgs): Promise<UndoPreviewResult>;
export declare function blueprintUndoExecute(args: {
    operationId: string;
    fingerprint: string;
    confirmed: true;
}): Promise<UndoExecutionResult>;
export declare function blueprintUndoPersist(args: {
    operationId: string;
    fingerprint: string;
    stage: "outcome-report" | "state";
}): Promise<UndoExecutionResult>;
export declare const undoToolDefinitions: ToolDefinition[];
export {};
