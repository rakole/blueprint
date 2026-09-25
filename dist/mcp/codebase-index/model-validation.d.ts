import * as z from "zod/v4";
import { type CodebaseDocumentId } from "../codebase-authoring.js";
import { type PortableMapSubmission, type PortableStructuralInventory } from "./contracts.js";
declare const sourceBasisFileSchema: z.ZodObject<{
    path: z.ZodString;
    byteSize: z.ZodNumber;
    contentHash: z.ZodString;
}, z.core.$strict>;
declare const sourceBasisRecordSchema: z.ZodObject<{
    kind: z.ZodEnum<{
        symbol: "symbol";
        file: "file";
        import: "import";
        relationship: "relationship";
    }>;
    recordId: z.ZodString;
    path: z.ZodString;
    contentHash: z.ZodString;
    coordinate: z.ZodOptional<z.ZodObject<{
        start: z.ZodObject<{
            line: z.ZodNumber;
            column: z.ZodNumber;
            byte: z.ZodNumber;
        }, z.core.$strict>;
        end: z.ZodObject<{
            line: z.ZodNumber;
            column: z.ZodNumber;
            byte: z.ZodNumber;
        }, z.core.$strict>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const portableAuthoritativeSourceBasisSchema: z.ZodObject<{
    generationId: z.ZodString;
    files: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        byteSize: z.ZodNumber;
        contentHash: z.ZodString;
    }, z.core.$strict>>;
    records: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<{
            symbol: "symbol";
            file: "file";
            import: "import";
            relationship: "relationship";
        }>;
        recordId: z.ZodString;
        path: z.ZodString;
        contentHash: z.ZodString;
        coordinate: z.ZodOptional<z.ZodObject<{
            start: z.ZodObject<{
                line: z.ZodNumber;
                column: z.ZodNumber;
                byte: z.ZodNumber;
            }, z.core.$strict>;
            end: z.ZodObject<{
                line: z.ZodNumber;
                column: z.ZodNumber;
                byte: z.ZodNumber;
            }, z.core.$strict>;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type PortableAuthoritativeSourceBasis = z.infer<typeof portableAuthoritativeSourceBasisSchema>;
export type PortableAuthoritativeSourceFile = z.infer<typeof sourceBasisFileSchema>;
export type PortableAuthoritativeSourceRecord = z.infer<typeof sourceBasisRecordSchema>;
export declare const PORTABLE_MODEL_VALIDATION_CODES: readonly ["invalid-input", "incomplete-structure", "duplicate-id", "source-mismatch", "dangling-reference", "invalid-coordinate", "parent-cycle", "invalid-detail-chain", "invalid-evidence", "invalid-document", "unsafe-content"];
export type PortableModelValidationCode = typeof PORTABLE_MODEL_VALIDATION_CODES[number];
export type PortableModelValidationScope = "source-basis" | "structural-shard" | "structural-record" | "semantic" | "document";
/** Fixed metadata-only diagnostics. Values from rejected input are excluded. */
export type PortableModelValidationDiagnostic = {
    code: PortableModelValidationCode;
    scope: PortableModelValidationScope;
    message: string;
    field?: string;
    index?: number;
};
export type PortableValidatedMapData = {
    submission: PortableMapSubmission;
    structuralShards: readonly PortableStructuralInventory[];
    sourceBasis: PortableAuthoritativeSourceBasis;
    compiledDocuments: Readonly<Record<CodebaseDocumentId, string>>;
};
export type PortableModelValidationResult = {
    ok: true;
    data: PortableValidatedMapData;
} | {
    ok: false;
    diagnostics: readonly PortableModelValidationDiagnostic[];
};
/** Public fixed messages for callers that need to render diagnostics. */
export declare function portableModelValidationMessage(code: PortableModelValidationCode): string;
/**
 * Validate a complete portable model in memory. The function never reads or
 * writes the filesystem and never retains rejected input in its result.
 */
export declare function validatePortableMapModel(structuralShardsInput: readonly unknown[], authoredSubmissionInput: unknown, authoritativeSourceBasisInput: unknown): PortableModelValidationResult;
export {};
