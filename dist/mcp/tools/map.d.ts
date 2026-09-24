import * as z from "zod/v4";
import { type PortableLegacyPublicationSnapshot } from "../codebase-index/contracts.js";
import { blueprintPortableMapPrepare, blueprintPortableMapSubmit } from "../codebase-index/map-coordinator.js";
type Snapshot = PortableLegacyPublicationSnapshot;
declare const legacyPrepareSchema: z.ZodObject<{
    cwd: z.ZodOptional<z.ZodString>;
    inputs: z.ZodDefault<z.ZodArray<z.ZodString>>;
    focus: z.ZodOptional<z.ZodString>;
    restart: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strict>;
declare const legacySubmitSchema: z.ZodObject<{
    cwd: z.ZodOptional<z.ZodString>;
    snapshot: z.ZodObject<{
        version: z.ZodLiteral<1>;
        root: z.ZodString;
        inventory: z.ZodString;
        inputs: z.ZodRecord<z.ZodString, z.ZodString>;
        core: z.ZodString;
        targets: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodNullable<z.ZodString>>, z.core.$strict>;
        previousPublication: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>;
    documents: z.ZodDefault<z.ZodObject<{
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
    }, z.core.$strict>>;
    overwrite: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strict>;
export type BlueprintMapLegacyPrepareInput = z.input<typeof legacyPrepareSchema>;
export type BlueprintMapLegacySubmitInput = z.input<typeof legacySubmitSchema>;
export type BlueprintMapLegacyPrepareResult = {
    readonly status: string;
    readonly snapshot?: Snapshot | null;
    readonly [key: string]: unknown;
};
export type BlueprintMapLegacySubmitResult = {
    readonly status: string;
    readonly saved?: boolean;
    readonly [key: string]: unknown;
};
type PortableMapPrepareResult = Awaited<ReturnType<typeof blueprintPortableMapPrepare>>;
type PortableMapSubmitResult = Awaited<ReturnType<typeof blueprintPortableMapSubmit>>;
/** Preserve the direct legacy TypeScript contract while retaining the single MCP input shape. */
export declare function blueprintMapPrepare(raw: BlueprintMapLegacyPrepareInput): Promise<BlueprintMapLegacyPrepareResult>;
export declare function blueprintMapPrepare(raw: {
    readonly formatVersion: number;
    readonly [key: string]: unknown;
}): Promise<PortableMapPrepareResult>;
export declare function blueprintMapPrepare(raw: unknown): Promise<BlueprintMapLegacyPrepareResult | PortableMapPrepareResult>;
export declare function blueprintMapSubmit(raw: BlueprintMapLegacySubmitInput): Promise<BlueprintMapLegacySubmitResult>;
export declare function blueprintMapSubmit(raw: {
    readonly formatVersion: number;
    readonly [key: string]: unknown;
}): Promise<PortableMapSubmitResult>;
export declare function blueprintMapSubmit(raw: unknown): Promise<BlueprintMapLegacySubmitResult | PortableMapSubmitResult>;
export declare const mapToolDefinitions: ({
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        inputs: z.ZodOptional<z.ZodArray<z.ZodString>>;
        focus: z.ZodOptional<z.ZodString>;
        restart: z.ZodOptional<z.ZodBoolean>;
        formatVersion: z.ZodOptional<z.ZodNumber>;
        operationId: z.ZodOptional<z.ZodString>;
        cursor: z.ZodOptional<z.ZodString>;
        intent: z.ZodOptional<z.ZodString>;
        repair: z.ZodOptional<z.ZodUnknown>;
    };
    handler: (args: Record<string, unknown>) => Promise<{
        [x: string]: unknown;
    } | BlueprintMapLegacyPrepareResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        snapshot: z.ZodOptional<z.ZodObject<{
            version: z.ZodLiteral<1>;
            root: z.ZodString;
            inventory: z.ZodString;
            inputs: z.ZodRecord<z.ZodString, z.ZodString>;
            core: z.ZodString;
            targets: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodNullable<z.ZodString>>, z.core.$strict>;
            previousPublication: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>>;
        documents: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strict>>;
        overwrite: z.ZodOptional<z.ZodBoolean>;
        formatVersion: z.ZodOptional<z.ZodNumber>;
        operationId: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodUnknown>;
        submission: z.ZodOptional<z.ZodUnknown>;
        intent: z.ZodOptional<z.ZodString>;
        linkInstructions: z.ZodOptional<z.ZodBoolean>;
        instructionPath: z.ZodOptional<z.ZodString>;
    };
    handler: (args: Record<string, unknown>) => Promise<{
        [x: string]: unknown;
    } | BlueprintMapLegacySubmitResult>;
})[];
export {};
