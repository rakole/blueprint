export type ParsedRoadmapPhase = {
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    completed: boolean;
    summary: string | null;
    goal: string | null;
    successCriteria: string | null;
    requirements: string[];
};
export declare function parseRoadmapDocument(raw: string): {
    milestone: string | null;
    phases: ParsedRoadmapPhase[];
};
