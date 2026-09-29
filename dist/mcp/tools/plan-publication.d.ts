export type PlanPublicationStatus = {
    status: "absent" | "pending" | "committed" | "invalid";
    token: string;
    reason: string | null;
};
export type PlanPublicationFile = {
    path: string;
    hash: string;
};
export type PlanPublicationSnapshot = PlanPublicationStatus & {
    version: 1 | 2 | null;
    files: readonly PlanPublicationFile[];
    removedPaths: readonly string[];
    /** Exact decoded bytes whose hashes were checked against a v2 committed receipt. */
    contents: ReadonlyMap<string, string> | null;
};
export type PlanLifecycleOwnership = {
    hasSession: boolean;
    ownsPublication: boolean;
    token: string;
    reason: string | null;
};
/** Metadata-only ownership inference used while older sessions gain the durable flag. */
export declare function planSessionOwnsPublication(data: Record<string, unknown>): boolean;
/**
 * Inspect only metadata needed to decide whether a missing marker is safe.
 * No draft, plan body, review prose, or diagnostic payload is retained or returned.
 */
export declare function readPlanLifecycleOwnership(projectRoot: string, phaseDir: string, phasePrefix: string): Promise<PlanLifecycleOwnership>;
/**
 * Read one guarded publication generation. Version 1 committed markers were
 * delta receipts, so they require explicit target-hash reconciliation. Version
 * 2 markers bind the complete canonical plan inventory and exact consumed bytes.
 */
export declare function readPlanPublicationSnapshot(projectRoot: string, phaseDir: string, phasePrefix: string, options?: {
    allowOwnedMissing?: boolean;
}): Promise<PlanPublicationSnapshot>;
export declare function planPublicationConsumptionIssue(snapshot: PlanPublicationSnapshot, consumed: ReadonlyMap<string, string>, options: {
    complete: boolean;
}): string | null;
export declare function readPlanPublicationStatus(projectRoot: string, phaseDir: string, phasePrefix: string, options?: {
    allowOwnedMissing?: boolean;
}): Promise<PlanPublicationStatus>;
