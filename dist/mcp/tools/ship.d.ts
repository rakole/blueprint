import type { ToolDefinition } from "../tool-types.js";
import { type QualityShippingProcessResult, type QualityShippingProcessRunner } from "../quality-shipping-safety.js";
import { blueprintArtifactReportWrite } from "./artifacts.js";
import { blueprintConfigGet } from "./config.js";
import { type StateUpdateArgs, type StateUpdateResult } from "./state.js";
declare const REPORT_PATH = ".blueprint/reports/ship-latest.md";
export type ShipEvidenceInput = {
    path: string;
    kind: "review" | "security" | "verification" | "pr-branch";
};
export type ShipPreviewArgs = {
    cwd?: string;
    baseBranch: string;
    remoteName?: string;
    ghRepository?: string;
    posture: "draft" | "ready";
    push: boolean;
    createPr: boolean;
    title: string;
    body: string;
    evidence: ShipEvidenceInput[];
    overwriteReport?: boolean;
    statePatch?: StateUpdateArgs["patch"];
};
type ProcessReceipt = {
    stage: string;
    command: "git" | "gh";
    argv: string[];
    result: QualityShippingProcessResult;
};
type EvidenceReceipt = ShipEvidenceInput & {
    contentSha256: string | null;
    coveredHead: string | null;
    coveredBase: string | null;
    outcome: "approved" | "passed" | "clean" | "blocking" | "unknown";
    phasePrefix: string | null;
    phaseDir: string | null;
};
type QualityGateInventoryEntry = {
    path: string;
    contentSha256: string;
};
type GhFailureReason = "gh-missing" | "gh-unauthenticated" | "gh-repository-unavailable" | "pr-view-unavailable" | "pr-create-failed";
type ExistingPr = {
    disposition: "absent" | "exact" | "divergent";
    url: string | null;
    headOid: string | null;
};
export type ShipApprovalPacket = {
    schemaVersion: 1;
    operation: "ship";
    repoRoot: string;
    gitCommonDir: string;
    branch: string;
    head: string;
    baseBranch: string;
    baseOid: string;
    mergeBase: string;
    candidateCommits: string[];
    changedPaths: string[];
    reviewablePaths: string[];
    remote: {
        name: string;
        fetchUrl: string;
        pushUrl: string;
        headRef: string;
        observedHeadOid: string | null;
        baseRef: string;
        observedBaseOid: string;
    };
    upstream: string;
    ghRepository: {
        selector: string;
        url: string;
    } | null;
    gitConfigSha256: string;
    blueprintConfig: {
        sha256: string;
        codeReview: boolean;
        securePhase: boolean;
        baseBranch: string | null;
        branchingStrategy: string;
        commitDocs: boolean;
        noUat: boolean;
        provenance: unknown;
    };
    posture: "draft" | "ready";
    pushRequested: boolean;
    prRequested: boolean;
    title: string;
    bodySha256: string;
    evidence: EvidenceReceipt[];
    qualityGateInventory: {
        phaseDir: string;
        entries: QualityGateInventoryEntry[];
    };
    gate: {
        reviewRequired: boolean;
        securityRequired: boolean;
        reviewSatisfied: boolean;
        securitySatisfied: boolean;
    };
    existingPr: ExistingPr;
    report: {
        path: typeof REPORT_PATH;
        overwriteApproved: boolean;
        priorExists: boolean;
        priorContentSha256: string | null;
        preMutationContentSha256: string;
    };
    statePatch: StateUpdateArgs["patch"] | null;
    executionPlan: Array<{
        stage: "push" | "pr-create";
        command: "git" | "gh";
        argv: string[];
    }>;
};
type PreviewResult = {
    status: "ready" | "blocked" | "invalid";
    operationId: string | null;
    fingerprint: string | null;
    packet: ShipApprovalPacket | null;
    waitingState: "ship-confirmation" | "report-overwrite-confirmation" | null;
    blockers: string[];
    warnings: string[];
};
export type ShipExecutionResult = {
    status: "blocked" | "stale" | "succeeded" | "partial" | "failed" | "outcome-unknown";
    stage: "approval" | "revalidate" | "pre-report" | "push" | "pr-create" | "outcome-report" | "state" | "persistence-recovery";
    operationId: string;
    fingerprint: string;
    externalMutationStarted: boolean;
    push: {
        status: "not-requested" | "not-attempted" | "pushed" | "reused" | "failed" | "outcome-unknown";
        remoteHeadBefore: string | null;
        remoteHeadAfter: string | null;
    };
    pr: {
        status: "not-requested" | "not-attempted" | "created" | "reused" | "failed" | "outcome-unknown";
        url: string | null;
    };
    gh: {
        status: "not-requested" | "ready" | GhFailureReason;
        detail: string | null;
    };
    processes: ProcessReceipt[];
    report: {
        path: typeof REPORT_PATH;
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
type ReportResult = Awaited<ReturnType<typeof blueprintArtifactReportWrite>>;
type ReportWriter = (args: {
    cwd?: string;
    reportName: string;
    content?: string;
    overwrite?: boolean;
    expectedExistingContentSha256?: string | null;
}) => Promise<ReportResult>;
type StateUpdater = (args: StateUpdateArgs) => Promise<StateUpdateResult>;
type ConfigReader = (args: {
    cwd?: string;
    scope: "effective";
}) => ReturnType<typeof blueprintConfigGet>;
export declare const shipToolTestHooks: {
    canonicalEvidenceRoleForTest(evidencePath: string): ReturnType<typeof canonicalEvidenceRole>;
    setProcessRunnerForTest(runner: QualityShippingProcessRunner): () => void;
    setReportWriterForTest(writer: ReportWriter): () => void;
    setStateUpdaterForTest(updater: StateUpdater): () => void;
    setConfigReaderForTest(reader: ConfigReader): () => void;
    setRemoteSelectorResolverForTest(resolver: (remoteUrl: string) => string | null): () => void;
    clearApprovalsForTest(): void;
    mutateApprovalForTest(operationId: string, mutate: (packet: ShipApprovalPacket) => void, rebindStoredFingerprint?: boolean): string | null;
    setRetentionForTest(args: {
        now?: () => number;
        approvalTtlMs?: number;
        terminalTtlMs?: number;
        maxApprovals?: number;
    }): () => void;
};
declare function canonicalEvidenceRole(evidencePath: string): {
    kind: ShipEvidenceInput["kind"];
    phasePrefix: string | null;
    phaseDir: string | null;
} | null;
export declare function blueprintShipPreview(args: ShipPreviewArgs): Promise<PreviewResult>;
export declare function blueprintShipExecute(args: {
    operationId: string;
    fingerprint: string;
    confirmed: true;
}): Promise<ShipExecutionResult>;
export declare function blueprintShipPersist(args: {
    operationId: string;
    fingerprint: string;
    stage: "outcome-report" | "state";
}): Promise<ShipExecutionResult>;
export declare const shipToolDefinitions: ToolDefinition[];
export {};
