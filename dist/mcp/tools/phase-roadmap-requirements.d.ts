import { type ParsedRoadmap } from "./phase-locations.js";
import type { RoadmapInsertPhaseRequirementMappingStatus } from "./phase-tool-types.js";
export type RequirementTableRow = {
    id: string;
    requirement: string;
    status: string;
    notes: string;
};
export declare const REQUIREMENTS_TABLE_SECTION_PATTERN: RegExp;
export declare function parseRequirementTableRow(line: string): RequirementTableRow | null;
export declare function renderRequirementTableRow(row: RequirementTableRow): string;
export declare function readRequirementTable(projectRoot: string, options: {
    missingFileMessage: string;
    malformedMessage: string;
}): Promise<{
    rawRequirements: string;
    rows: RequirementTableRow[];
}>;
export declare function findUndeclaredRequirementIds(rows: RequirementTableRow[], requirementIds: string[]): string[];
export declare function requireDeclaredRequirementIds(projectRoot: string, requirementIds: string[], options: {
    missingFileMessage: string;
    malformedMessage: string;
    undeclaredMessage: (undeclaredRequirementIds: string[]) => string;
}): Promise<void>;
export declare function repairRequirementsTraceability(projectRoot: string, requirementIds: string[], phaseNumber: string, phaseName: string, sourceReportPath?: string): Promise<{
    content: string;
    warnings: string[];
}>;
export declare function mapRequirementsToInsertedPhase(projectRoot: string, requirementIds: string[], phaseNumber: string, phaseName: string): Promise<{
    content: string;
    mappingStatus: RoadmapInsertPhaseRequirementMappingStatus;
    warnings: string[];
}>;
export declare function requireUnassignedRoadmapRequirements(roadmap: ParsedRoadmap, requirementIds: string[], phaseNumber: string): void;
