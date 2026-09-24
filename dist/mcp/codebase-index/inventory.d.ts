import type { PortableLanguage } from "./contracts.js";
export declare const INVENTORY_MAX_FILE_BYTES: number;
export declare const INVENTORY_HASH_CHUNK_BYTES: number;
/** @internal Deterministic race seam used only by focused filesystem tests. */
export declare const inventoryTestHooks: {
    afterChunk?: (absolutePath: string, chunkIndex: number) => Promise<void> | void;
};
export declare const INVENTORY_EXCLUSION_REASONS: readonly ["runtime-state", "git-metadata", "dependency", "vendor", "build-output", "binary", "sensitive-path", "unsafe-path", "symlink", "missing", "not-a-regular-file", "unreadable", "changed-during-read"];
export type InventoryExclusionReason = typeof INVENTORY_EXCLUSION_REASONS[number];
export type InventoryCoverageHint = "full" | "file";
export type InventorySupport = "supported" | "unsupported";
export type InventoryFileRole = "source" | "test" | "configuration" | "documentation" | "generated" | "unknown";
/** Metadata retained for every eligible file, including unknown languages. */
export type SourceInventoryFile = {
    path: string;
    language: PortableLanguage;
    role: InventoryFileRole;
    byteSize: number;
    contentHash: string;
    coverageHint: InventoryCoverageHint;
    support: InventorySupport;
};
export type InventoryExclusionCounts = Record<InventoryExclusionReason, number>;
export type SourceInventory = {
    files: readonly SourceInventoryFile[];
    inventoryFingerprint: string;
    /** Alias for consumers that use the shorter term. */
    fingerprint: string;
    candidateCount: number;
    includedCount: number;
    excludedCount: number;
    exclusionCounts: InventoryExclusionCounts;
    /** Fixed reasons only; paths and source values are intentionally omitted. */
    exclusions: readonly {
        reason: InventoryExclusionReason;
        count: number;
    }[];
};
export type InventoryOptions = {
    /** Defaults to true; false is useful only for deterministic test doubles. */
    useGit?: boolean;
};
/**
 * Enumerate Git-tracked plus nonignored-untracked literal regular files.
 * This is metadata-only: source bodies are never returned or persisted.
 */
export declare function buildSourceInventory(repositoryRoot: string, options?: InventoryOptions): Promise<SourceInventory>;
export declare const createSourceInventory: typeof buildSourceInventory;
export declare const inventoryRepository: typeof buildSourceInventory;
