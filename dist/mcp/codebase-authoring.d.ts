import * as z from "zod/v4";
import { type ArtifactContractId } from "./artifact-contracts/index.js";
export declare const CODEBASE_DOCUMENT_IDS: readonly ["stack", "architecture", "structure", "conventions", "testing", "integrations", "concerns"];
export type CodebaseDocumentId = (typeof CODEBASE_DOCUMENT_IDS)[number];
export type CodebaseDocumentContractId = `codebase.${CodebaseDocumentId}`;
/** The model supplies findings and observed paths; the runtime owns Markdown structure. */
export declare const codebaseDocumentModelSchema: z.ZodObject<{
    summary: z.ZodString;
    sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
        heading: z.ZodString;
        content: z.ZodString;
    }, z.core.$strict>>>;
    evidencePaths: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export type CodebaseDocumentModel = z.infer<typeof codebaseDocumentModelSchema>;
export declare const codebaseMapModelSchema: z.ZodObject<{
    stack: z.ZodOptional<z.ZodObject<{
        summary: z.ZodString;
        sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
            heading: z.ZodString;
            content: z.ZodString;
        }, z.core.$strict>>>;
        evidencePaths: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    architecture: z.ZodOptional<z.ZodObject<{
        summary: z.ZodString;
        sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
            heading: z.ZodString;
            content: z.ZodString;
        }, z.core.$strict>>>;
        evidencePaths: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    structure: z.ZodOptional<z.ZodObject<{
        summary: z.ZodString;
        sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
            heading: z.ZodString;
            content: z.ZodString;
        }, z.core.$strict>>>;
        evidencePaths: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    conventions: z.ZodOptional<z.ZodObject<{
        summary: z.ZodString;
        sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
            heading: z.ZodString;
            content: z.ZodString;
        }, z.core.$strict>>>;
        evidencePaths: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    testing: z.ZodOptional<z.ZodObject<{
        summary: z.ZodString;
        sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
            heading: z.ZodString;
            content: z.ZodString;
        }, z.core.$strict>>>;
        evidencePaths: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    integrations: z.ZodOptional<z.ZodObject<{
        summary: z.ZodString;
        sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
            heading: z.ZodString;
            content: z.ZodString;
        }, z.core.$strict>>>;
        evidencePaths: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    concerns: z.ZodOptional<z.ZodObject<{
        summary: z.ZodString;
        sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
            heading: z.ZodString;
            content: z.ZodString;
        }, z.core.$strict>>>;
        evidencePaths: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type CodebaseMapModel = z.infer<typeof codebaseMapModelSchema>;
export declare function compileCodebaseDocument(artifactId: CodebaseDocumentId | CodebaseDocumentContractId, input: unknown): string;
export declare function compileCodebaseMap(input: unknown): Partial<Record<CodebaseDocumentId, string>>;
/** Shared by canonical publication and legacy inspection; optional headings are never gates. */
export declare function validateCodebaseContent(content: string, artifactId: ArtifactContractId): {
    valid: boolean;
    issues: string[];
    warnings: string[];
};
