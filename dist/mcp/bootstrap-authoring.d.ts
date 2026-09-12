import * as z from "zod/v4";
import type { BootstrapSeed } from "./tools/artifacts.js";
/** Author product decisions once; persistence owns identifiers and document shape. */
export declare const bootstrapAuthoringSchema: z.ZodObject<{
    vision: z.ZodString;
    audience: z.ZodArray<z.ZodString>;
    milestone: z.ZodString;
    constraints: z.ZodOptional<z.ZodArray<z.ZodString>>;
    assumptions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    phases: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        objective: z.ZodString;
        requirements: z.ZodArray<z.ZodString>;
        successCriteria: z.ZodArray<z.ZodString>;
        dependsOn: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>>;
    deferred: z.ZodOptional<z.ZodArray<z.ZodString>>;
    outOfScope: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strict>;
export type BootstrapAuthoringModel = z.infer<typeof bootstrapAuthoringSchema>;
export declare function compileBootstrapAuthoringModel(model: BootstrapAuthoringModel, previous?: {
    id: string;
    requirement: string;
}[]): BootstrapSeed;
export declare function readPreviousBootstrapRequirementIds(markdown: string): {
    id: string;
    requirement: string;
}[];
