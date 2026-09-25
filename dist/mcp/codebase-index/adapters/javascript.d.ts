import { type PortableFileRecord, type PortableImportRelationship, type PortableRelationshipRecord, type PortableStructuralDetailRecord, type PortableSymbolRecord } from "../contracts.js";
/** The JS-family extraction rule is part of the pinned parser contract. */
export declare const JAVASCRIPT_ADAPTER_RULE_VERSION: "javascript-declarations-v1/tree-sitter-0.27.0";
export declare const JAVASCRIPT_ADAPTER_SUPPORTED_LANGUAGES: readonly ["javascript", "jsx", "typescript", "tsx"];
export declare const JAVASCRIPT_ADAPTER_MAX_FILE_BYTES: number;
export type JavaScriptAdapterInput = {
    readonly file: PortableFileRecord;
    readonly source: Uint8Array;
    readonly knownFiles?: readonly PortableFileRecord[];
};
export type JavaScriptAdapterDiagnosticCode = "source-mismatch" | "unsupported-language" | "too-large" | "invalid-utf8" | "unsafe-content" | "parse-error" | "unsupported-construct" | "invalid-output";
export type JavaScriptAdapterDiagnostic = {
    readonly code: JavaScriptAdapterDiagnosticCode;
    readonly message: string;
};
export type JavaScriptAdapterSuccess = {
    readonly ok: true;
    readonly status: "complete" | "partial";
    readonly file: PortableFileRecord;
    readonly symbols: readonly PortableSymbolRecord[];
    readonly imports: readonly PortableImportRelationship[];
    readonly relationships: readonly PortableRelationshipRecord[];
    readonly details: readonly PortableStructuralDetailRecord[];
    readonly diagnostics: readonly JavaScriptAdapterDiagnostic[];
    readonly ruleVersion: typeof JAVASCRIPT_ADAPTER_RULE_VERSION;
};
export type JavaScriptAdapterFailure = {
    readonly ok: false;
    readonly status: "stale" | "unsupported" | "invalid";
    readonly file: PortableFileRecord;
    readonly symbols: readonly [];
    readonly imports: readonly [];
    readonly relationships: readonly [];
    readonly details: readonly [];
    readonly diagnostics: readonly JavaScriptAdapterDiagnostic[];
    readonly ruleVersion: typeof JAVASCRIPT_ADAPTER_RULE_VERSION;
};
export type JavaScriptAdapterResult = JavaScriptAdapterSuccess | JavaScriptAdapterFailure;
/**
 * Extract declaration and syntax records from one JS/JSX/TS/TSX inventory file.
 * The source/tree are transient inputs; neither is retained in the result.
 */
export declare function adaptJavaScriptFile(input: JavaScriptAdapterInput): Promise<JavaScriptAdapterResult>;
export declare const extractJavaScriptFile: typeof adaptJavaScriptFile;
export declare const analyzeJavaScriptFile: typeof adaptJavaScriptFile;
