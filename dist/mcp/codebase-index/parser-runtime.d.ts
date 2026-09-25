/** Languages for which the portable map has a bundled Tree-sitter grammar. */
export declare const PARSER_LANGUAGES: readonly ["javascript", "jsx", "typescript", "tsx", "python", "java"];
export type ParserLanguageId = typeof PARSER_LANGUAGES[number];
export declare const PARSER_RUNTIME_VERSION: "0.27.0";
export declare const PARSER_BINDING_INDEX_UNIT: "utf16-code-unit";
export declare const PARSER_OUTPUT_COLUMN_UNIT: "utf8-byte";
export type SourcePoint = {
    /** One-based line number. */
    readonly line: number;
    /** Zero-based UTF-8 byte column within the line. */
    readonly column: number;
    /** Zero-based UTF-8 byte offset in the complete source. */
    readonly byte: number;
};
export type SourceCoordinate = {
    /** The end point is exclusive. */
    readonly start: SourcePoint;
    readonly end: SourcePoint;
};
/**
 * A read-only, private syntax-node view.  Deliberately absent are `text`,
 * source bytes, and any method that returns a source body.  Adapters can use
 * type/field/child structure and exact coordinates while the source remains
 * in the caller's transient scope.
 */
export interface SyntaxNodeView {
    readonly type: string;
    readonly isNamed: boolean;
    readonly isError: boolean;
    readonly isMissing: boolean;
    readonly hasError: boolean;
    readonly coordinate: SourceCoordinate;
    readonly childCount: number;
    readonly namedChildCount: number;
    readonly children: readonly SyntaxNodeView[];
    readonly namedChildren: readonly SyntaxNodeView[];
    child(index: number): SyntaxNodeView | null;
    namedChild(index: number): SyntaxNodeView | null;
    childForFieldName(name: string): SyntaxNodeView | null;
}
export interface SyntaxTreeView {
    readonly language: ParserLanguageId;
    readonly rootNode: SyntaxNodeView;
    readonly sourceByteLength: number;
    readonly sourceCodeUnitLength: number;
    /** Binding units are recorded instead of assumed by coordinate consumers. */
    readonly bindingIndexUnit: typeof PARSER_BINDING_INDEX_UNIT;
    readonly outputColumnUnit: typeof PARSER_OUTPUT_COLUMN_UNIT;
    readonly endExclusive: true;
    dispose(): void;
}
export type ParserAssetOrigin = {
    readonly npm: string;
    readonly repository: string;
};
export type ParserAssetManifest = {
    readonly formatVersion: number;
    readonly runtime: {
        readonly package: string;
        readonly version: string;
        readonly origin: ParserAssetOrigin;
        readonly packageSha256: string;
        readonly module: string;
        readonly moduleSha256: string;
        readonly wasm: string;
        readonly wasmSha256: string;
        readonly license: string;
        readonly licenseFile: string;
        readonly languageVersion: number;
        readonly minimumCompatibleVersion: number;
    };
    readonly grammars: readonly Record<string, unknown>[];
    readonly languages: Readonly<Record<ParserLanguageId, {
        readonly grammar: string;
        readonly asset: string;
        readonly sha256: string;
        readonly abiVersion: number;
    }>>;
    readonly bindingCoordinates: {
        readonly indexUnit: typeof PARSER_BINDING_INDEX_UNIT;
        readonly columnUnit: typeof PARSER_BINDING_INDEX_UNIT;
        readonly outputLineBase: 1;
        readonly outputColumnUnit: typeof PARSER_OUTPUT_COLUMN_UNIT;
        readonly outputColumnBase: 0;
        readonly outputByteBase: 0;
        readonly endExclusive: true;
    };
};
/** Parse one source file into a private transient syntax-tree view. */
export declare function parseSource(language: ParserLanguageId, source: Uint8Array | string): Promise<SyntaxTreeView>;
/** Parse and dispose deterministically, including when the adapter throws. */
export declare function withParsedSource<T>(language: ParserLanguageId, source: Uint8Array | string, callback: (tree: SyntaxTreeView) => T | Promise<T>): Promise<T>;
/** Return verified pinned metadata for every extraction freshness capture. */
export declare function getVerifiedParserAssetManifest(): Promise<ParserAssetManifest>;
/** Backwards-compatible diagnostics/test accessor with the same verification. */
export declare function getParserAssetManifest(): Promise<ParserAssetManifest>;
