export type QualityShippingOperation = "pr-branch" | "ship" | "undo";
export type QualityShippingProcessResult = {
    exitCode: number | null;
    stdout: string;
    stderr: string;
    signal: NodeJS.Signals | null;
    timedOut: boolean;
};
export type QualityShippingProcessRunner = (command: string, argv: readonly string[], cwd: string, env: NodeJS.ProcessEnv) => Promise<QualityShippingProcessResult>;
export declare const qualityShippingProcessRunner: QualityShippingProcessRunner;
export declare function qualityShippingStableSerialize(value: unknown): string;
export declare function qualityShippingSha256(value: string | Buffer): string;
export declare function qualityShippingFingerprint(value: unknown): string;
export declare function isCanonicalFullGitHash(value: string): boolean;
export declare function assertUndoRevertArgv(argv: readonly string[]): void;
export declare function qualityShippingGitEnvironment(overrides?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
export declare function withQualityShippingOperationLock<T>(operation: QualityShippingOperation, repositoryIdentity: string, task: () => Promise<T>): Promise<T>;
export declare function tryAcquireQualityShippingOperationLock(_operation: QualityShippingOperation, repositoryIdentity: string): (() => void) | null;
