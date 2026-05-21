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
export type ParsedRoadmapPhaseListLine = {
    completed: boolean;
    phaseNumber: string;
    phaseName: string;
    requirements: string[];
};
export type ParsedRoadmapPhaseDetailHeading = {
    phaseNumber: string;
    phaseName: string;
};
export declare function parseRoadmapPhaseListLine(line: string): ParsedRoadmapPhaseListLine | null;
export declare function formatRoadmapPhaseListLine(line: {
    completed: boolean;
    phaseNumber: string;
    phaseName: string;
    requirementIds?: readonly string[];
    requirements?: readonly string[];
}): string;
export declare function splitRoadmapPhaseListBlocks(body: string): string[];
export declare function parseRoadmapPhaseDetailHeading(heading: string): ParsedRoadmapPhaseDetailHeading | null;
export declare function formatRoadmapPhaseDetailHeading(heading: ParsedRoadmapPhaseDetailHeading): string;
export declare function splitRoadmapPhaseDetailBlocks(body: string): string[];
export declare function parseRoadmapDocument(raw: string): {
    milestone: string | null;
    phases: ParsedRoadmapPhase[];
};
