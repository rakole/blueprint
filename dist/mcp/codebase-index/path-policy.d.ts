/** Exclusion labels shared by inventory and transient source reads. */
export declare const SOURCE_PATH_EXCLUSION_REASONS: readonly ["runtime-state", "git-metadata", "dependency", "vendor", "build-output", "binary", "sensitive-path", "unsafe-path", "symlink", "missing", "not-a-regular-file", "unreadable", "changed-during-read"];
export type SourcePathExclusionReason = typeof SOURCE_PATH_EXCLUSION_REASONS[number];
export declare function sourcePathSafetyReason(relativePath: string): "unsafe-path" | null;
/**
 * Return the shared source eligibility decision without opening the path.
 * Exact sensitive names are bounded deliberately: `tokenizer.ts` and
 * `password.ts` are legitimate source files, while `.env.*` is always state.
 */
export declare function sourcePathExclusionReason(relativePath: string): SourcePathExclusionReason | null;
export declare function sourcePathIsGenerated(relativePath: string): boolean;
export type PathIdentity = {
    device: number;
    inode: number;
    size: number;
    mtimeMs: number;
    ctimeMs: number;
};
export type PathSnapshot = {
    root: PathIdentity;
    ancestors: readonly PathIdentity[];
    target: PathIdentity;
};
export declare function pathIdentity(stat: {
    dev: number;
    ino: number;
    size: number;
    mtimeMs: number;
    ctimeMs: number;
}): PathIdentity;
export declare function samePathIdentity(left: PathIdentity, right: PathIdentity): boolean;
export declare function samePathSnapshot(left: PathSnapshot, right: PathSnapshot): boolean;
/** Capture the literal root, parent chain, and target identity before opening. */
export declare function capturePathSnapshot(rootPath: string, relativePath: string): Promise<PathSnapshot | null>;
