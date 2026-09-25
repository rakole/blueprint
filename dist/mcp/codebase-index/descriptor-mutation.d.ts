export type DescriptorMutationHooks = {
    readonly beforeWrite?: () => Promise<void> | void;
    /** Runs after the parent descriptor is held and before creating a leaf. */
    readonly beforeCreate?: () => Promise<void> | void;
    readonly afterTempCreate?: () => Promise<void> | void;
};
export type DescriptorWriteExpectation = {
    readonly device?: number;
    readonly inode?: number;
    readonly sha256?: string;
};
/** Create each literal segment through an anchored descriptor child. */
export declare function ensureDescriptorDirectory(root: string, relative: string): Promise<boolean>;
export declare function createDescriptorLeaf(root: string, relative: string, bytes: Uint8Array, mode?: number, hooks?: Pick<DescriptorMutationHooks, "beforeCreate">): Promise<"created" | "exists" | "unsafe">;
/** Remove only a descriptor-relative regular leaf whose current bytes match. */
export declare function unlinkDescriptorLeaf(root: string, relative: string, expected: Pick<DescriptorWriteExpectation, "sha256">): Promise<"removed" | "conflict" | "unsafe">;
/**
 * Atomic descriptor-relative writer. New leaves use link+unlink, never
 * rename-overwrite. Existing replacements are cooperative-lock CAS: an
 * external process that ignores the caller's lock can exchange the pathname
 * after validation, although it cannot redirect through an ancestor.
 */
export declare function atomicDescriptorWrite(input: {
    readonly root: string;
    readonly relative: string;
    readonly bytes: Uint8Array;
    readonly overwrite: boolean;
    readonly mode?: number;
    /** Preserve an existing target's explicit mode after the temp-file rename. */
    readonly preserveMode?: boolean;
    readonly expected?: DescriptorWriteExpectation;
    readonly hooks?: DescriptorMutationHooks;
}): Promise<"written" | "conflict" | "unsafe">;
