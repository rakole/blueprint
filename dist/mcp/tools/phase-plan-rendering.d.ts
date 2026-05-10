type PhasePlanRenderResolvedPhase = {
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
};
export type PhasePlanStructuredModel = {
    title: string;
    wave: number;
    status: "planned";
    objective: string;
    gapClosure?: boolean;
    dependsOn: string[];
    requirements: string[];
    filesModified: string[];
    readFirst: string[];
    autonomous: boolean;
    goal: string;
    scope: string[];
    tasks: Array<{
        id: string;
        title: string;
        readFirst: string[];
        action: string[];
        acceptanceCriteria: string[];
        requirements: string[];
        filesModified: string[];
    }>;
    verification: Array<{
        item: string;
        method: "test" | "grep" | "command" | "file-read" | "artifact-validation";
        evidence: string;
    }>;
    mustHaves: string[];
    requirementCoverage: Array<{
        requirement: string;
        status: "covered" | "deferred" | "irrelevant";
        coveredByTasks: string[];
        evidence: string;
        rationale: string;
    }>;
    evidenceCoverage: Array<{
        artifact: string;
        status: "used" | "deferred" | "irrelevant" | "unavailable";
        rationale: string;
    }>;
    fileSurfaceCoverage: Array<{
        surface: string;
        coveredByTasks: string[];
        verification: string;
        rationale: string;
    }>;
    unknownsAndDeferrals: Array<{
        item: string;
        disposition: "unknown" | "deferred" | "blocked" | "none";
        rationale: string;
        followUp: string;
    }>;
};
export declare function renderPhasePlanModelContent(model: PhasePlanStructuredModel, resolved: PhasePlanRenderResolvedPhase, planId: string): string;
export {};
