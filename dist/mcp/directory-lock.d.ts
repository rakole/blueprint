export type DirectoryLockTiming = {
    retryMs: number;
    staleMs: number;
    heartbeatMs: number;
};
export type DirectoryLockRecoveryHooksForTest = {
    beforeStaleRecoveryClaim?(lockPath: string): Promise<void> | void;
    beforeStaleLockQuarantine?(lockPath: string): Promise<void> | void;
    afterRecoveryGuardRelease?(lockPath: string): Promise<void> | void;
};
type DirectoryLockOptions = {
    lockPath: string;
    timing: DirectoryLockTiming;
    recoveryHooks?: DirectoryLockRecoveryHooksForTest;
};
export declare function withDirectoryLock<T>(options: DirectoryLockOptions, callback: () => Promise<T>): Promise<T>;
export {};
