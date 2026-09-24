export type HardenedLiteralReadReason = "missing" | "unsafe" | "too-large" | "unreadable" | "changed";
export type HardenedLiteralReadResult = {
    readonly ok: true;
    readonly bytes: Uint8Array;
} | {
    readonly ok: false;
    readonly reason: HardenedLiteralReadReason;
};
/**
 * Read a literal regular file while binding every named ancestor and the final
 * pathname to the bytes. A descriptor identity check alone is insufficient:
 * a caller can rename an ancestor after open and replace the named path with a
 * symlink to unrelated content. This primitive therefore rechecks the whole
 * chain and final leaf after the descriptor read.
 */
export declare function readHardenedLiteralFile(root: string, relativePath: string, maxBytes: number): Promise<HardenedLiteralReadResult>;
