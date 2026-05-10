export declare function buildPhasePlanTaskSchema(args: {
    baseSchema: Record<string, unknown>;
    knownRequirements: string[];
    knownEvidenceArtifacts: string[];
    allowedDependencyPlanIds: string[];
}): Record<string, unknown>;
