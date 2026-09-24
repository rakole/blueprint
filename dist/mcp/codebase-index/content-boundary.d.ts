import { type PathSnapshot } from "./path-policy.js";
/** The maximum transient source payload retained by a source read. */
export declare const DEFAULT_SAFE_SOURCE_READ_BYTES: number;
export declare const SAFE_SOURCE_CHUNK_BYTES: number;
export declare const CONTENT_BOUNDARY_CODES: readonly ["private-key", "credential", "prompt-injection", "prompt-context", "unsafe-display", "encoded-payload", "control-character"];
export type ContentBoundaryCode = typeof CONTENT_BOUNDARY_CODES[number];
export type ContentBoundarySeverity = "warning" | "error";
/**
 * A fixed, metadata-only finding.  The source text, key material, and parser
 * or regex error are deliberately absent from this public shape.
 */
export type ContentBoundaryFinding = {
    code: ContentBoundaryCode;
    severity: ContentBoundarySeverity;
    message: string;
};
export type ContentBoundaryAnalysis = {
    safe: boolean;
    hasWarnings: boolean;
    hasErrors: boolean;
    findings: readonly ContentBoundaryFinding[];
    warnings: readonly string[];
    errors: readonly string[];
};
export type SafeSourceFailureReason = "unsafe-path" | "symlink" | "missing" | "not-a-regular-file" | "unreadable" | "binary" | "too-large" | "changed-during-read" | "hash-mismatch" | "unsafe-content" | "invalid-range";
export type SafeSourceDiagnostic = {
    reason: SafeSourceFailureReason;
    message: string;
};
export type SafeSourceReadOptions = {
    /** Full-file expected hash used as a compare-and-swap basis. */
    expectedHash?: string;
    /** Maximum source bytes retained in memory; hashing remains streaming. */
    maxBytes?: number;
    /** Optional UTF-8 byte range for selected bounded evidence. */
    startByte?: number;
    endByteExclusive?: number;
};
export type SafeSourceReadSuccess = {
    ok: true;
    content: string;
    contentHash: string;
    byteSize: number;
    startByte: number;
    endByteExclusive: number;
    warnings: readonly string[];
};
export type SafeSourceReadFailure = {
    ok: false;
    diagnostic: SafeSourceDiagnostic;
};
export type SafeSourceReadResult = SafeSourceReadSuccess | SafeSourceReadFailure;
/**
 * Apply the shared prompt boundary checks and deterministic secret-shaped
 * checks without returning source text or regex captures in diagnostics.
 */
export declare function inspectContentBoundaries(text: string): ContentBoundaryAnalysis;
/** Stable aliases for callers that describe the same boundary operation differently. */
export declare const analyzeContentBoundaries: typeof inspectContentBoundaries;
export declare const checkContentBoundaries: typeof inspectContentBoundaries;
export declare function isSafeContent(text: string): boolean;
/** Resolve and inspect every literal path component; aliases are rejected. */
type LiteralFileStat = {
    size: number;
    dev: number;
    ino: number;
    mtimeMs: number;
    ctimeMs: number;
    isFile(): boolean;
    isDirectory(): boolean;
    isSymbolicLink(): boolean;
};
export declare function resolveLiteralRegularFile(rootPath: string, relativePath: string): Promise<{
    ok: true;
    absolutePath: string;
    stat: LiteralFileStat;
    snapshot: PathSnapshot;
} | SafeSourceReadFailure>;
/**
 * Read a bounded, literal source file transiently. The full-file hash is
 * computed while streaming, so callers can use an expected hash as a CAS
 * check even when only a selected range is returned.
 */
export declare function readSourceContentSafely(rootPath: string, relativePath: string, options?: SafeSourceReadOptions): Promise<SafeSourceReadResult>;
export declare const readSafeSourceContent: typeof readSourceContentSafely;
export declare const readSourceFileSafely: typeof readSourceContentSafely;
export {};
