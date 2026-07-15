import { promises as fs } from "node:fs";
export type PhaseExecutionFileMutation = {
    path: string;
    operation: "write" | "delete";
    content?: string;
    expectedHash: string | null;
};
export type PhaseExecutionMutationReceipt = {
    path: string;
    operation: "write" | "delete";
    beforeHash: string | null;
    beforeMode: number | null;
    afterHash: string | null;
    afterMode: number | null;
    bytesWritten: number;
};
export type PhaseExecutionMutationResult = {
    status: "committed" | "committed-cleanup-required" | "postimage-diverged" | "rolled-back" | "rollback-failed";
    receipts: PhaseExecutionMutationReceipt[];
    cleanupPaths: string[];
    failure: string | null;
    rollbackFailures: string[];
};
export type PhaseExecutionProcessResult = {
    exitCode: number | null;
    stdout: string;
    stderr: string;
    signal: NodeJS.Signals | null;
    timedOut: boolean;
    outputLimitExceeded?: boolean;
};
export type PhaseExecutionProcessRunner = (command: string, argv: readonly string[], cwd: string, env: NodeJS.ProcessEnv, timeoutMs: number) => Promise<PhaseExecutionProcessResult>;
export type PhaseExecutionVerificationReceipt = {
    command: string;
    argv: ["-c", string];
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    timedOut: boolean;
    outputLimitExceeded: boolean;
    passed: boolean;
    stdout: string;
    stdoutBytes: number;
    stdoutHash: string;
    stdoutTruncated: boolean;
    stderr: string;
    stderrBytes: number;
    stderrHash: string;
    stderrTruncated: boolean;
};
export type PhaseExecutionGitObservation = {
    head: string;
    changedPaths: string[];
    unauthorizedChangedPaths: string[];
};
type PhaseExecutionMutationFileSystem = Pick<typeof fs, "access" | "chmod" | "lstat" | "mkdir" | "readFile" | "realpath" | "rename" | "rm" | "writeFile">;
export declare function applyPhaseExecutionMutations(args: {
    projectRoot: string;
    authorizedFiles: readonly string[];
    mutations: readonly PhaseExecutionFileMutation[];
    fileSystem?: PhaseExecutionMutationFileSystem;
    runtimeHooks?: {
        afterParentsPinned?: () => Promise<void> | void;
        beforeFinalObservation?: () => Promise<void> | void;
        crashWorkerAfterCommit?: boolean;
        crashWorkerDuringCleanup?: boolean;
        stopWorkerAfterCommit?: boolean;
        stopWorkerDuringCleanup?: boolean;
        pinnedWorkerTimeoutMs?: number;
        withholdCloseExitSignalForTest?: boolean;
    };
}): Promise<PhaseExecutionMutationResult>;
export declare const phaseExecutionProcessRunner: PhaseExecutionProcessRunner;
export declare function runPhaseExecutionVerification(args: {
    projectRoot: string;
    commands: readonly string[];
    processRunner?: PhaseExecutionProcessRunner;
    timeoutMs?: number;
}): Promise<PhaseExecutionVerificationReceipt[]>;
export declare function observePhaseExecutionGitState(args: {
    projectRoot: string;
    authorizedFiles: readonly string[];
    baselineChangedPaths?: readonly string[];
    processRunner?: PhaseExecutionProcessRunner;
}): Promise<PhaseExecutionGitObservation>;
export {};
