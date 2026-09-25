import { type PortableFileRecord, type PortableImportRelationship, type PortableRelationshipRecord, type PortableStructuralDetailRecord, type PortableSymbolRecord } from "../contracts.js";
/** Java extraction is tied to the bundled Java grammar and parser contract. */
export declare const JAVA_ADAPTER_RULE_VERSION: "java-declarations-v1/tree-sitter-0.27.0";
export declare const JAVA_ADAPTER_SUPPORTED_LANGUAGES: readonly ["java"];
export declare const JAVA_ADAPTER_MAX_FILE_BYTES: number;
export type JavaAdapterInput = {
    readonly file: PortableFileRecord;
    readonly source: Uint8Array;
    readonly knownFiles?: readonly PortableFileRecord[];
};
export type JavaAdapterDiagnosticCode = "source-mismatch" | "unsupported-language" | "too-large" | "invalid-utf8" | "unsafe-content" | "parse-error" | "unsupported-construct" | "invalid-output";
export type JavaAdapterDiagnostic = {
    readonly code: JavaAdapterDiagnosticCode;
    readonly message: string;
};
export type JavaAdapterSuccess = {
    readonly ok: true;
    readonly status: "complete" | "partial";
    readonly file: PortableFileRecord;
    readonly symbols: readonly PortableSymbolRecord[];
    readonly imports: readonly PortableImportRelationship[];
    readonly relationships: readonly PortableRelationshipRecord[];
    readonly details: readonly PortableStructuralDetailRecord[];
    readonly diagnostics: readonly JavaAdapterDiagnostic[];
    readonly ruleVersion: typeof JAVA_ADAPTER_RULE_VERSION;
};
export type JavaAdapterFailure = {
    readonly ok: false;
    readonly status: "stale" | "unsupported" | "invalid";
    readonly file: PortableFileRecord;
    readonly symbols: readonly [];
    readonly imports: readonly [];
    readonly relationships: readonly [];
    readonly details: readonly [];
    readonly diagnostics: readonly JavaAdapterDiagnostic[];
    readonly ruleVersion: typeof JAVA_ADAPTER_RULE_VERSION;
};
export type JavaAdapterResult = JavaAdapterSuccess | JavaAdapterFailure;
/** Extract Java declarations and syntax relationships without retaining source bodies. */
export declare function adaptJavaFile(input: JavaAdapterInput): Promise<JavaAdapterResult>;
export declare const extractJavaFile: typeof adaptJavaFile;
export declare const analyzeJavaFile: typeof adaptJavaFile;
