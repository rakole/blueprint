import * as z from "zod/v4";
import type { PhasePlanStructuredModel } from "./phase-plan-rendering.js";
declare const authoringSchema: z.ZodObject<{
    plans: z.ZodArray<z.ZodObject<{
        key: z.ZodOptional<z.ZodString>;
        title: z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>, z.ZodTransform<string, string>>;
        goal: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        scope: z.ZodOptional<z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>>;
        dependsOn: z.ZodOptional<z.ZodArray<z.ZodString>>;
        tasks: z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            title: z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>, z.ZodTransform<string, string>>;
            readFirst: z.ZodOptional<z.ZodArray<z.ZodString>>;
            filesModified: z.ZodArray<z.ZodString>;
            requirements: z.ZodArray<z.ZodString>;
            action: z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
            acceptanceCriteria: z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
        }, z.core.$strict>>;
        mustHaves: z.ZodOptional<z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>>;
        autonomous: z.ZodOptional<z.ZodBoolean>;
        gapClosure: z.ZodOptional<z.ZodBoolean>;
        externalServicePrerequisites: z.ZodOptional<z.ZodArray<z.ZodObject<{
            service: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
            category: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
            purpose: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
            userSetup: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
            readinessCheck: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
            canAgentProceedWithoutIt: z.ZodBoolean;
        }, z.core.$strict>>>;
        verification: z.ZodOptional<z.ZodArray<z.ZodObject<{
            item: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
            method: z.ZodEnum<{
                test: "test";
                command: "command";
                grep: "grep";
                "file-read": "file-read";
                "artifact-validation": "artifact-validation";
            }>;
            evidence: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        }, z.core.$strict>>>;
        evidence: z.ZodOptional<z.ZodArray<z.ZodObject<{
            artifact: z.ZodString;
            rationale: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        }, z.core.$strict>>>;
        unknownsAndDeferrals: z.ZodOptional<z.ZodArray<z.ZodObject<{
            item: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
            disposition: z.ZodEnum<{
                unknown: "unknown";
                none: "none";
                deferred: "deferred";
                blocked: "blocked";
            }>;
            rationale: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
            followUp: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        }, z.core.$strict>>>;
    }, z.core.$strict>>;
    deferrals: z.ZodOptional<z.ZodArray<z.ZodObject<{
        requirement: z.ZodString;
        rationale: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        followUp: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    }, z.core.$strict>>>;
}, z.core.$strict>;
export declare const planningCandidateJsonSchema: Record<string, unknown>;
/** Give the author the actual allowed references before generation. */
export declare function planningPreparedSchema(context: Pick<PlanningCandidateContext, "knownRequirements" | "knownEvidenceArtifacts">): Record<string, unknown>;
export declare const planningDerivedFields: string[];
export declare const planningValidationRules: {
    reject: string[];
    advisory: string[];
    normalize: string[];
};
export type PlanningCandidate = z.infer<typeof authoringSchema>;
export type PlanningCandidateContext = {
    knownRequirements: string[];
    knownEvidenceArtifacts: string[];
    existingPlans: Array<{
        planId: string;
        wave: number;
        dependsOn?: string[];
        requirements?: string[];
    }>;
    mode: "add" | "revise" | "replace";
    targetPlanIds: string[];
};
/** A shape example grounded in the actual prepared requirement/evidence inventory. */
export declare function planningModelExample(context: Pick<PlanningCandidateContext, "knownRequirements" | "knownEvidenceArtifacts">): PlanningCandidate;
export type PlanningCandidateDiagnostic = {
    path: string;
    code: string;
    message: string;
    severity: "error" | "warning";
};
export type PlanningCandidateCompilation = {
    valid: boolean;
    diagnostics: PlanningCandidateDiagnostic[];
    models: Array<{
        planId: string;
        model: PhasePlanStructuredModel;
    }>;
    planIds: string[];
};
/** Pure, deterministic compilation. Invalid authoring input is never persisted. */
export declare function compilePlanCandidate(raw: unknown, context: PlanningCandidateContext): PlanningCandidateCompilation;
export {};
