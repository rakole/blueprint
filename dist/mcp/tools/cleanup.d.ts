import type { ToolDefinition } from "../tool-types.js";
type CleanupArchiveMode = "preview" | "commit";
type CleanupArchiveOperation = "move" | "copy-delete";
type CleanupArchiveStatus = "ready" | "archived" | "partial" | "failed" | "blocked" | "invalid" | "project_missing";
type CleanupArchiveWaitingState = "cleanup-confirmation" | "archive-destination-confirmation" | "report-overwrite-confirmation" | "missing-phase-root" | "inconsistent-phase-layout" | "stale-cleanup-preview" | "archive-destination-collision" | "no-cleanup-candidates" | "dirty-working-tree" | null;
type CleanupProtectedEntry = {
    path: string;
    reason: string;
};
type CleanupArchiveFileSystem = {
    mkdir(targetPath: string, options: {
        recursive: true;
    }): Promise<unknown>;
    rename(sourcePath: string, destinationPath: string): Promise<void>;
    cp(sourcePath: string, destinationPath: string, options: {
        recursive: true;
        errorOnExist: true;
        force: false;
    }): Promise<void>;
    rm(targetPath: string, options: {
        recursive: true;
        force: true;
    }): Promise<void>;
};
type CleanupArchiveResult = {
    status: CleanupArchiveStatus;
    projectRoot: string | null;
    mode: CleanupArchiveMode;
    operation: CleanupArchiveOperation;
    archiveDestination: string;
    archiveDestinationExists: boolean;
    archiveDestinationCreated: boolean;
    selectedPhaseDirs: string[];
    protectedEntries: CleanupProtectedEntry[];
    archivedPhaseDirs: string[];
    failedPhaseDirs: string[];
    skippedPhaseDirs: string[];
    keptPhaseDirs: string[];
    digestInputs: string[];
    reportPath: string | null;
    reportWritten: boolean;
    waitingState: CleanupArchiveWaitingState;
    reason: string | null;
    issues: string[];
    warnings: string[];
    nextAction: string;
};
export declare const blueprintCleanupArchiveTestHooks: {
    setFileSystemForTest(fileSystem: CleanupArchiveFileSystem): () => void;
};
export declare function blueprintCleanupArchive(rawArgs?: Record<string, unknown>): Promise<CleanupArchiveResult>;
export declare const cleanupToolDefinitions: ToolDefinition[];
export {};
