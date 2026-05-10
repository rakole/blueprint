import { validatePhaseArtifactContent } from "./artifacts.js";
type PhaseContextResolvedLocation = {
    phasePrefix: string;
    phaseName: string;
};
export type PhaseContextStructuredModel = {
    phaseBoundary: {
        goal: string;
        inScope: string[];
        outOfScope: string[];
        successCriteria: string[];
    };
    discoveryGrounding: {
        projectBrief: string;
        requirementsGrounding: string[];
        workflowPosture: string;
        confirmedDecisions: string[];
    };
    implementationDecisions: Array<{
        decision: string;
        tradeoffOrConstraint: string;
    }>;
    specificIdeas: string[];
    existingCodeInsights: string[];
    dependencies: {
        priorPhaseArtifacts: string[];
        externalConstraints: string[];
        requiredFollowUpReads: string[];
    };
    openQuestions: string[];
    deferredIdeas: string[];
    canonicalReferences: Array<{
        source: string;
        relevance: string;
    }>;
};
export declare function renderPhaseContextModelContent(args: {
    resolved: PhaseContextResolvedLocation;
    model: PhaseContextStructuredModel;
}): string;
export declare function validatePhaseContextModelInput(model: unknown): {
    model: null;
    validation: ReturnType<typeof validatePhaseArtifactContent>;
} | {
    model: PhaseContextStructuredModel;
    validation: null;
};
export {};
