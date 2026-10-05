export declare const BLUEPRINT_STATE_COMPATIBILITY = "blueprint-state-v1";
export type LifecycleAction = "install" | "upgrade" | "rollback" | "uninstall" | "status";
export type OpenCodeLifecycleAction = LifecycleAction;
export type LifecycleStep = "beforeJournalWrite" | "afterJournalWrite" | "afterConfigWrite" | "afterLedgerWrite" | "afterReceiptWrite" | "afterActivation";
export type LifecycleCleanupKind = "config" | "generation" | "receipt" | "launcher" | "ledger" | "transactionJournal" | "generationsDirectory" | "receiptsDirectory" | "installRoot" | "cleanupJournal";
export type LifecycleGeneration = {
    generationId: string;
    packageRoot: string;
    sourceSpec: string;
    stateCompatibility: string;
    version: string;
};
export type OpenCodeLifecycleResult = {
    action: LifecycleAction;
    active: LifecycleGeneration | null;
    previous: LifecycleGeneration | null;
    registration: string | null;
    status: "configured" | "not-installed";
};
export type PackageInstaller = (input: {
    packageSpec: string;
    stagingPrefix: string;
    env: NodeJS.ProcessEnv;
}) => Promise<{
    packageRoot: string;
}>;
export type OpenCodeLifecycleDependencies = {
    env?: NodeJS.ProcessEnv;
    now?: () => Date;
    randomId?: () => string;
    packageInstaller?: PackageInstaller;
    allowRegistryPackageSpec?: boolean;
    validatePackageAssets?: boolean;
    onStep?: (step: LifecycleStep) => Promise<void> | void;
    beforeCleanup?: (targetPath: string, kind: LifecycleCleanupKind) => Promise<void> | void;
    lockOptions?: {
        timeoutMs?: number;
        pollMs?: number;
        staleMs?: number;
    };
};
export type OpenCodeLifecycleInput = {
    action: LifecycleAction;
    configPath: string;
    cwd?: string;
    packageSpec?: string;
};
export declare function runOpenCodeLifecycle(input: OpenCodeLifecycleInput, dependencies?: OpenCodeLifecycleDependencies): Promise<OpenCodeLifecycleResult>;
