import * as z from "zod/v4";
import type { PhasePlanStructuredModel } from "./phase-plan-rendering.js";
declare const authoringSchema: z.ZodObject<{
    plans: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        title: z.ZodString;
        goal: z.ZodString;
        scope: z.ZodArray<z.ZodString>;
        dependsOn: z.ZodArray<z.ZodString>;
        tasks: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            readFirst: z.ZodArray<z.ZodString>;
            filesModified: z.ZodArray<z.ZodString>;
            requirements: z.ZodArray<z.ZodString>;
            action: z.ZodArray<z.ZodString>;
            acceptanceCriteria: z.ZodArray<z.ZodString>;
        }, z.core.$strict>>;
        mustHaves: z.ZodArray<z.ZodString>;
        autonomous: z.ZodOptional<z.ZodBoolean>;
        gapClosure: z.ZodOptional<z.ZodBoolean>;
        externalServicePrerequisites: z.ZodOptional<z.ZodArray<z.ZodObject<{
            service: z.ZodString;
            category: z.ZodString;
            purpose: z.ZodString;
            userSetup: z.ZodString;
            readinessCheck: z.ZodString;
            canAgentProceedWithoutIt: z.ZodBoolean;
        }, z.core.$strict>>>;
        verification: z.ZodOptional<z.ZodArray<z.ZodObject<{
            item: z.ZodString;
            method: z.ZodEnum<{
                test: "test";
                command: "command";
                grep: "grep";
                "file-read": "file-read";
                "artifact-validation": "artifact-validation";
            }>;
            evidence: z.ZodString;
        }, z.core.$strict>>>;
        evidence: z.ZodOptional<z.ZodArray<z.ZodObject<{
            artifact: z.ZodString;
            rationale: z.ZodString;
        }, z.core.$strict>>>;
        unknownsAndDeferrals: z.ZodOptional<z.ZodArray<z.ZodObject<{
            item: z.ZodString;
            disposition: z.ZodEnum<{
                unknown: "unknown";
                none: "none";
                deferred: "deferred";
                blocked: "blocked";
            }>;
            rationale: z.ZodString;
            followUp: z.ZodString;
        }, z.core.$strict>>>;
    }, z.core.$strict>>;
    deferrals: z.ZodOptional<z.ZodArray<z.ZodObject<{
        requirement: z.ZodString;
        rationale: z.ZodString;
        followUp: z.ZodString;
    }, z.core.$strict>>>;
}, z.core.$strict>;
export declare const planningCandidateJsonSchema: Record<string, unknown>;
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
/** Pure, deterministic compilation. Callers persist raw input before calling. */
export declare function compilePlanCandidate(raw: unknown, context: PlanningCandidateContext): PlanningCandidateCompilation;
export {};
