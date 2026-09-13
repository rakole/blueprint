import * as z from "zod/v4";
import type { PhaseArtifactValidationDiagnostic } from "./artifacts.js";
export declare const phaseResearchAuthoringSchema: z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>;
declare const OPTIONAL_HEADINGS: {
    readonly standardStack: "Standard Stack";
    readonly installationAndSetup: "Installation And Setup";
    readonly alternativesConsidered: "Alternatives Considered";
    readonly architecturePatterns: "Architecture Patterns";
    readonly dontHandRoll: "Don't Hand-Roll";
    readonly antiPatterns: "Anti-Patterns";
    readonly stateOfTheArt: "State Of The Art";
    readonly commonPitfalls: "Common Pitfalls";
    readonly codeExamples: "Code Examples";
};
export type PhaseResearchStructuredModel = {
    summary: string;
    findings: Array<{
        id: string;
        finding: string;
        sourceIds: string[];
        confidence: "LOW" | "MEDIUM" | "HIGH";
        requirementIds: string[];
        status: "supported" | "inferred" | "unsupported";
    }>;
    recommendations: Array<{
        id: string;
        recommendation: string;
        findingIds: string[];
        affectedSurfaces: string[];
        verification: string[];
        requirementIds: string[];
        status: "ready" | "blocked";
    }>;
    openQuestions: Array<{
        question: string;
        blocking: boolean;
    }>;
    sources: Array<{
        id: string;
        lane: "repo" | "external" | "supplied";
        reference: string;
        title?: string;
        accessed?: string;
        excerpt?: string;
        limitations?: string;
    }>;
    sections?: Partial<Record<keyof typeof OPTIONAL_HEADINGS, string | string[]>>;
};
export type PhaseResearchModelValidation = {
    valid: boolean;
    planningReady: boolean;
    planningBlockers: string[];
    issues: string[];
    warnings: string[];
    diagnostics: PhaseArtifactValidationDiagnostic[];
};
export type PhaseResearchModelValidationContext = {
    knownRequirementIds?: readonly string[];
    requiredRequirementIds?: readonly string[];
};
/** Publication validity is separate from whether this research resolves planning blockers. */
export declare function validatePhaseResearchModelInput(raw: unknown, context?: PhaseResearchModelValidationContext): {
    model: PhaseResearchStructuredModel | null;
    validation: PhaseResearchModelValidation;
};
export declare function renderPhaseResearchModelContent(args: {
    resolved: {
        phasePrefix: string;
        phaseName: string;
    };
    model: PhaseResearchStructuredModel;
    researchedAt?: string;
    requirements?: Array<{
        id: string;
        description: string;
    }>;
    lockedDecisions?: string[];
    userConstraints?: string[];
}): string;
export {};
