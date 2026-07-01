import type { AuditBackedGapCategory, AuditBackedGapGroup, RoadmapAuditBackedDetails } from "./phase-tool-types.js";
import { type NumericInput } from "./phase-numbering.js";
import type { ParsedRoadmapPhase } from "./phase-roadmap-parser.js";
export declare function buildBlueprintPhaseDirectoryPath(phaseNumber: string | number, phaseName: string): string;
export declare function nextIntegerPhaseNumber(phases: ParsedRoadmapPhase[]): string;
export declare function previousIntegerPhaseNumber(value: NumericInput): string | null;
export declare function nextDecimalPhaseNumber(phases: ParsedRoadmapPhase[], afterPhaseNumber: string): string;
export declare function escapeForRegex(value: string): string;
export declare function replaceWithPlaceholders(value: string, replacements: Array<{
    pattern: RegExp;
    replacement: string;
}>): string;
export declare function rewriteDependencyLines(value: string, renumberMap: ReadonlyMap<string, string>): string;
export declare function rewriteRoadmapPhaseReferences(value: string, renumberMap: ReadonlyMap<string, string>): string;
export declare function normalizeRoadmapGoal(value: string | undefined): string;
export declare function normalizeRoadmapSuccessCriteriaList(values: string[] | undefined): string[];
export declare function normalizeRoadmapSuccessCriteriaString(value: string | undefined): string[];
export declare function requireRoadmapPhaseMetadata(options: {
    command: "/blu-add-phase" | "/blu-insert-phase";
    goal: string;
    successCriteria: string[];
}): void;
export declare function requireConfirmedRoadmapMutation(options: {
    command: "/blu-add-phase" | "/blu-insert-phase" | "/blu-remove-phase";
    confirmed: boolean | undefined;
    gate: "phase-number-confirmation" | "phase-insert-confirmation" | "remove-phase-confirmation";
    mutation: string;
}): void;
export declare function buildRoadmapPhaseListBlock(options: {
    phaseNumber: string;
    phaseName: string;
    requirementIds?: string[];
    goal: string;
    successCriteria: string[];
    inserted?: boolean;
}): string;
export declare function appendPhaseLineToRoadmap(raw: string, phaseNumber: string, phaseName: string, options: {
    requirementIds?: string[];
    goal: string;
    successCriteria: string[];
}): string;
export declare function splitRoadmapPhaseListBlocks(body: string): string[];
export declare function insertPhaseLineToRoadmap(raw: string, insertAfterPhaseNumber: string, phaseNumber: string, phaseName: string, options: {
    requirementIds?: string[];
    goal: string;
    successCriteria: string[];
}): string;
export type PhaseDetailBlockOptions = {
    phaseNumber: string;
    phaseName: string;
    dependsOnPhaseNumber?: string | null;
    insertedMarker?: string | null;
    goal?: string;
    requirements?: string[];
    successCriteria?: string;
    auditBackedDetails?: RoadmapAuditBackedDetails | null;
};
export declare function titleCaseAuditBackedCategory(category: AuditBackedGapCategory): string;
export declare function normalizeRoadmapDetailList(values: string[] | undefined): string[];
export declare function renderAuditBackedGapGroups(gapGroups: AuditBackedGapGroup[] | undefined): string;
export declare function renderRequirementTraceabilityRepairSection(requirementIds: string[] | undefined, phaseNumber: string, sourceReportPath: string | undefined): string;
export declare function normalizeRoadmapSuccessCriteriaField(value: string | undefined): string;
export declare function buildPhaseDetailBlock(options: PhaseDetailBlockOptions): string;
export declare function appendPhaseDetailsSection(raw: string, detailBlock: string): string;
export declare function appendPhaseDetailsToRoadmap(raw: string, phaseNumber: string, phaseName: string, detailOptions?: Omit<PhaseDetailBlockOptions, "phaseNumber" | "phaseName">): string;
export declare function insertPhaseDetailsToRoadmap(raw: string, phaseGroupNumbers: string[], phaseNumber: string, phaseName: string, dependsOnPhaseNumber: string, detailOptions?: Omit<PhaseDetailBlockOptions, "phaseNumber" | "phaseName" | "dependsOnPhaseNumber" | "insertedMarker">): string;
export declare function splitRoadmapPhaseDetailBlocks(body: string): string[];
export declare function removePhaseLineFromRoadmap(raw: string, phaseNumber: string): {
    content: string;
    removed: boolean;
};
export declare function removePhaseDetailsFromRoadmap(raw: string, phaseNumber: string): {
    content: string;
    removed: boolean;
};
export declare function replacePhaseLineCompletionMarker(raw: string, phaseNumber: string, completed: boolean): {
    content: string;
    found: boolean;
    changed: boolean;
};
export declare function replacePhaseDetailStatus(raw: string, phaseNumber: string, nextStatus: string): {
    content: string;
    found: boolean;
    changed: boolean;
};
