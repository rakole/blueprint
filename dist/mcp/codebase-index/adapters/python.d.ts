import { type PortableFileRecord, type PortableImportRelationship, type PortableRelationshipRecord, type PortableStructuralDetailRecord, type PortableSymbolRecord } from "../contracts.js";
/** Python extraction is tied to the bundled grammar and its parser contract. */
export declare const PYTHON_ADAPTER_RULE_VERSION: "python-declarations-v1/tree-sitter-0.27.0";
export declare const PYTHON_ADAPTER_SUPPORTED_LANGUAGES: readonly ["python"];
export declare const PYTHON_ADAPTER_MAX_FILE_BYTES: number;
export type PythonAdapterInput = {
    readonly file: PortableFileRecord;
    readonly source: Uint8Array;
    readonly knownFiles?: readonly PortableFileRecord[];
};
export type PythonAdapterDiagnosticCode = "source-mismatch" | "unsupported-language" | "too-large" | "invalid-utf8" | "unsafe-content" | "parse-error" | "unsupported-construct" | "invalid-output";
export type PythonAdapterDiagnostic = {
    readonly code: PythonAdapterDiagnosticCode;
    readonly message: string;
};
export type PythonAdapterSuccess = {
    readonly ok: true;
    readonly status: "complete" | "partial";
    readonly file: PortableFileRecord;
    readonly symbols: readonly PortableSymbolRecord[];
    readonly imports: readonly PortableImportRelationship[];
    readonly relationships: readonly PortableRelationshipRecord[];
    readonly details: readonly PortableStructuralDetailRecord[];
    readonly diagnostics: readonly PythonAdapterDiagnostic[];
    readonly ruleVersion: typeof PYTHON_ADAPTER_RULE_VERSION;
};
export type PythonAdapterFailure = {
    readonly ok: false;
    readonly status: "stale" | "unsupported" | "invalid";
    readonly file: PortableFileRecord;
    readonly symbols: readonly [];
    readonly imports: readonly [];
    readonly relationships: readonly [];
    readonly details: readonly [];
    readonly diagnostics: readonly PythonAdapterDiagnostic[];
    readonly ruleVersion: typeof PYTHON_ADAPTER_RULE_VERSION;
};
export type PythonAdapterResult = PythonAdapterSuccess | PythonAdapterFailure;
/** Extract Python declarations and syntax imports from one inventory file. */
export declare function adaptPythonFile(input: PythonAdapterInput): Promise<PythonAdapterResult>;
export declare const extractPythonFile: typeof adaptPythonFile;
export declare const analyzePythonFile: typeof adaptPythonFile;
