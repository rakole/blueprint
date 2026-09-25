/** The largest complete source file this private parser reader will retain. */
export declare const DEFAULT_PARSER_SOURCE_MAX_BYTES: number;
export declare const PARSER_SOURCE_READ_CHUNK_BYTES: number;
export type ParserSourceBasis = {
    /** Canonical repository-relative path from the source inventory. */
    readonly path: string;
    /** Complete file byte size captured by the source inventory. */
    readonly byteSize: number;
    /** Lowercase SHA-256 of the complete file captured by the source inventory. */
    readonly contentHash: string;
};
export type ParserSourceOptions = {
    /** Optional lower byte cap. It may not raise the fixed default ceiling. */
    readonly maxBytes?: number;
};
export type ParserSourceMetadata = {
    readonly path: string;
    readonly byteSize: number;
    readonly contentHash: string;
};
export type ParserSourceFailureReason = "invalid-metadata" | "unsafe-path" | "symlink" | "missing" | "not-a-regular-file" | "unreadable" | "too-large" | "size-mismatch" | "changed-during-read" | "hash-mismatch" | "binary" | "invalid-utf8" | "callback-failed";
export type ParserSourceFailure = {
    readonly ok: false;
    readonly status: "rejected";
    readonly diagnostic: {
        readonly reason: ParserSourceFailureReason;
        readonly message: string;
    };
};
export type ParserSourceSuccess<T> = {
    readonly ok: true;
    readonly status: "accepted";
    /** Only the callback result escapes; the source bytes are never returned. */
    readonly result: T;
    readonly metadata: ParserSourceMetadata;
};
export type ParserSourceResult<T> = ParserSourceSuccess<T> | ParserSourceFailure;
/** @internal Deterministic filesystem-race seam used only by focused tests. */
export declare const parserSourceTestHooks: {
    afterChunk?: (absolutePath: string, chunkIndex: number) => Promise<void> | void;
};
/**
 * Read one inventory-backed source file only for the duration of an extraction
 * callback. The inventory basis is a captured read basis, not a lock: the
 * final root/ancestor/target snapshot and full-file hash are checked before
 * the callback receives bytes. The callback owns any accepted structural
 * result and the later coordinator owns the final source CAS lifecycle.
 */
export declare function withParserSource<T>(repositoryRoot: string, basis: ParserSourceBasis, callback: (source: Uint8Array) => T | Promise<T>, options?: ParserSourceOptions): Promise<ParserSourceResult<T>>;
