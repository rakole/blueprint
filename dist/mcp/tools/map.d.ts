import * as z from "zod/v4";
import { type PortableLegacyPublicationSnapshot } from "../codebase-index/contracts.js";
type Snapshot = PortableLegacyPublicationSnapshot;
export declare function blueprintMapPrepare(raw: {
    cwd?: string;
    inputs?: string[];
    focus?: string;
    restart?: boolean;
}): Promise<{
    status: string;
    readiness: "partial" | "uninitialized" | "mapping-incomplete" | "mapped-only" | "initialized";
    nextAction: string | null;
    issues?: undefined;
    snapshot?: undefined;
    expectedHashes?: undefined;
    focus?: undefined;
    existing?: undefined;
    requiredDocuments?: undefined;
    inputsUsed?: undefined;
    inventory?: undefined;
    omittedInventoryCount?: undefined;
    workflow?: undefined;
    authoring?: undefined;
    warnings?: undefined;
} | {
    status: string;
    readiness: "partial" | "uninitialized" | "mapping-incomplete" | "mapped-only" | "initialized";
    issues: string[];
    nextAction: null;
    snapshot?: undefined;
    expectedHashes?: undefined;
    focus?: undefined;
    existing?: undefined;
    requiredDocuments?: undefined;
    inputsUsed?: undefined;
    inventory?: undefined;
    omittedInventoryCount?: undefined;
    workflow?: undefined;
    authoring?: undefined;
    warnings?: undefined;
} | {
    status: string;
    snapshot: {
        version: 1;
        root: string;
        inventory: string;
        inputs: Record<string, string>;
        core: string;
        targets: {
            stack: string | null;
            architecture: string | null;
            structure: string | null;
            conventions: string | null;
            testing: string | null;
            integrations: string | null;
            concerns: string | null;
        };
        previousPublication: string | null;
    } | null;
    expectedHashes: {
        stack: string | null;
        architecture: string | null;
        structure: string | null;
        conventions: string | null;
        testing: string | null;
        integrations: string | null;
        concerns: string | null;
    } | null;
    issues: string[];
    nextAction: null;
    readiness?: undefined;
    focus?: undefined;
    existing?: undefined;
    requiredDocuments?: undefined;
    inputsUsed?: undefined;
    inventory?: undefined;
    omittedInventoryCount?: undefined;
    workflow?: undefined;
    authoring?: undefined;
    warnings?: undefined;
} | {
    status: string;
    issues: string[];
    readiness: "partial" | "uninitialized" | "mapping-incomplete" | "mapped-only" | "initialized";
    focus: string | null;
    snapshot: {
        version: 1;
        root: string;
        inventory: string;
        inputs: Record<string, string>;
        core: string;
        targets: {
            stack: string | null;
            architecture: string | null;
            structure: string | null;
            conventions: string | null;
            testing: string | null;
            integrations: string | null;
            concerns: string | null;
        };
        previousPublication: string | null;
    };
    existing: {
        [k: string]: {
            path: string;
            status: string;
        };
    };
    requiredDocuments: ("stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns")[];
    inputsUsed: string[];
    inventory: string[];
    omittedInventoryCount: number;
    workflow: {
        subagents: boolean;
        parallelization: boolean;
    };
    authoring: {
        schema: z.core.ZodStandardJSONSchemaPayload<z.ZodObject<{
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
        example: {
            stack: {
                summary: string;
                evidencePaths: string[];
            };
        } | null;
        exampleIsIllustrative: boolean;
        rules: string[];
    };
    warnings: string[];
    nextAction: string | null;
    expectedHashes?: undefined;
}>;
export declare function blueprintMapSubmit(raw: {
    cwd?: string;
    snapshot: Snapshot;
    documents?: unknown;
    overwrite?: boolean;
}): Promise<{
    status: string;
    saved: boolean;
    nextAction: string | null;
    issues: string[];
    warnings?: undefined;
    paths?: undefined;
    written?: undefined;
    published?: undefined;
    reused?: undefined;
} | {
    status: string;
    saved: boolean;
    issues: string[];
    warnings: string[];
    nextAction?: undefined;
    paths?: undefined;
    written?: undefined;
    published?: undefined;
    reused?: undefined;
} | {
    status: string;
    saved: boolean;
    paths: string[];
    warnings: string[];
    nextAction: string | null;
    issues?: undefined;
    written?: undefined;
    published?: undefined;
    reused?: undefined;
} | {
    status: string;
    saved: boolean;
    written: string[];
    published: string[];
    issues: string[];
    warnings: string[];
    nextAction: null;
    paths?: undefined;
    reused?: undefined;
} | {
    status: string;
    saved: boolean;
    written: string[];
    reused: string[];
    paths: string[];
    warnings: string[];
    nextAction: string | null;
    issues?: undefined;
    published?: undefined;
} | {
    status: string;
    saved: boolean;
    issues: {
        path: string;
        code: "custom" | "invalid_type" | "invalid_key" | "invalid_union" | "unrecognized_keys" | "too_big" | "too_small" | "invalid_format" | "not_multiple_of" | "invalid_element" | "invalid_value";
    }[];
    warnings: never[];
}>;
export declare const mapToolDefinitions: ({
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        inputs: z.ZodDefault<z.ZodArray<z.ZodString>>;
        focus: z.ZodOptional<z.ZodString>;
        restart: z.ZodDefault<z.ZodBoolean>;
    };
    handler: (args: Record<string, unknown>) => Promise<{
        status: string;
        readiness: "partial" | "uninitialized" | "mapping-incomplete" | "mapped-only" | "initialized";
        nextAction: string | null;
        issues?: undefined;
        snapshot?: undefined;
        expectedHashes?: undefined;
        focus?: undefined;
        existing?: undefined;
        requiredDocuments?: undefined;
        inputsUsed?: undefined;
        inventory?: undefined;
        omittedInventoryCount?: undefined;
        workflow?: undefined;
        authoring?: undefined;
        warnings?: undefined;
    } | {
        status: string;
        readiness: "partial" | "uninitialized" | "mapping-incomplete" | "mapped-only" | "initialized";
        issues: string[];
        nextAction: null;
        snapshot?: undefined;
        expectedHashes?: undefined;
        focus?: undefined;
        existing?: undefined;
        requiredDocuments?: undefined;
        inputsUsed?: undefined;
        inventory?: undefined;
        omittedInventoryCount?: undefined;
        workflow?: undefined;
        authoring?: undefined;
        warnings?: undefined;
    } | {
        status: string;
        snapshot: {
            version: 1;
            root: string;
            inventory: string;
            inputs: Record<string, string>;
            core: string;
            targets: {
                stack: string | null;
                architecture: string | null;
                structure: string | null;
                conventions: string | null;
                testing: string | null;
                integrations: string | null;
                concerns: string | null;
            };
            previousPublication: string | null;
        } | null;
        expectedHashes: {
            stack: string | null;
            architecture: string | null;
            structure: string | null;
            conventions: string | null;
            testing: string | null;
            integrations: string | null;
            concerns: string | null;
        } | null;
        issues: string[];
        nextAction: null;
        readiness?: undefined;
        focus?: undefined;
        existing?: undefined;
        requiredDocuments?: undefined;
        inputsUsed?: undefined;
        inventory?: undefined;
        omittedInventoryCount?: undefined;
        workflow?: undefined;
        authoring?: undefined;
        warnings?: undefined;
    } | {
        status: string;
        issues: string[];
        readiness: "partial" | "uninitialized" | "mapping-incomplete" | "mapped-only" | "initialized";
        focus: string | null;
        snapshot: {
            version: 1;
            root: string;
            inventory: string;
            inputs: Record<string, string>;
            core: string;
            targets: {
                stack: string | null;
                architecture: string | null;
                structure: string | null;
                conventions: string | null;
                testing: string | null;
                integrations: string | null;
                concerns: string | null;
            };
            previousPublication: string | null;
        };
        existing: {
            [k: string]: {
                path: string;
                status: string;
            };
        };
        requiredDocuments: ("stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns")[];
        inputsUsed: string[];
        inventory: string[];
        omittedInventoryCount: number;
        workflow: {
            subagents: boolean;
            parallelization: boolean;
        };
        authoring: {
            schema: z.core.ZodStandardJSONSchemaPayload<z.ZodObject<{
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
            example: {
                stack: {
                    summary: string;
                    evidencePaths: string[];
                };
            } | null;
            exampleIsIllustrative: boolean;
            rules: string[];
        };
        warnings: string[];
        nextAction: string | null;
        expectedHashes?: undefined;
    }>;
} | {
    name: string;
    description: string;
    inputSchema: {
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
    };
    handler: (args: Record<string, unknown>) => Promise<{
        status: string;
        saved: boolean;
        nextAction: string | null;
        issues: string[];
        warnings?: undefined;
        paths?: undefined;
        written?: undefined;
        published?: undefined;
        reused?: undefined;
    } | {
        status: string;
        saved: boolean;
        issues: string[];
        warnings: string[];
        nextAction?: undefined;
        paths?: undefined;
        written?: undefined;
        published?: undefined;
        reused?: undefined;
    } | {
        status: string;
        saved: boolean;
        paths: string[];
        warnings: string[];
        nextAction: string | null;
        issues?: undefined;
        written?: undefined;
        published?: undefined;
        reused?: undefined;
    } | {
        status: string;
        saved: boolean;
        written: string[];
        published: string[];
        issues: string[];
        warnings: string[];
        nextAction: null;
        paths?: undefined;
        reused?: undefined;
    } | {
        status: string;
        saved: boolean;
        written: string[];
        reused: string[];
        paths: string[];
        warnings: string[];
        nextAction: string | null;
        issues?: undefined;
        published?: undefined;
    } | {
        status: string;
        saved: boolean;
        issues: {
            path: string;
            code: "custom" | "invalid_type" | "invalid_key" | "invalid_union" | "unrecognized_keys" | "too_big" | "too_small" | "invalid_format" | "not_multiple_of" | "invalid_element" | "invalid_value";
        }[];
        warnings: never[];
    }>;
})[];
export {};
