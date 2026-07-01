import { type PhaseSummaryCompletedRouteValidation } from "./phase-summary-routing.js";
import type { PhaseLocateResult, PhasePlanIndexResult, PhasePlanRecord, PhaseSummaryInventory, PhaseSummaryReadResult, PhaseSummaryRecord, ResolvedPhaseLocation } from "./phase-tool-types.js";
export declare function summarizeMarkdownContent(content: string): {
    title: string | null;
    summary: string | null;
};
export declare function toPhaseSummaryRecord(planId: string, pathValue: string, content: string, linkedPlanPath: string | null): PhaseSummaryRecord;
export type ValidateSummaryAgainstLivePlanInventory = (content: string, args: {
    resolved: Pick<ResolvedPhaseLocation, "phaseNumber" | "phaseDir" | "phasePrefix">;
    planId: string;
    plan: PhasePlanRecord | null;
    knownPlanIds: ReadonlySet<string>;
    completedDependencyPlanIds?: ReadonlySet<string>;
    completedRouteValidation?: PhaseSummaryCompletedRouteValidation;
}) => {
    valid: boolean;
    issues: string[];
    warnings: string[];
};
export declare function loadPhaseSummaryInventory(args: {
    projectRoot: string;
    located: PhaseLocateResult;
    resolved: ResolvedPhaseLocation;
    planIndex: PhasePlanIndexResult;
    validateSummaryAgainstLivePlanInventory: ValidateSummaryAgainstLivePlanInventory;
}): Promise<PhaseSummaryInventory>;
export declare function phaseSummaryReadFromInventory(args: {
    resolved: ResolvedPhaseLocation;
    planId: string;
    inventory: PhaseSummaryInventory;
    validateSummaryAgainstLivePlanInventory: ValidateSummaryAgainstLivePlanInventory;
}): PhaseSummaryReadResult;
export declare function loadResolvedPhaseSummaryContext(args: {
    projectRoot: string;
    located: PhaseLocateResult;
    resolved: ResolvedPhaseLocation;
    buildPhasePlanIndexFromLocated: (args: {
        projectRoot: string;
        located: PhaseLocateResult;
        resolved: ResolvedPhaseLocation;
    }) => Promise<PhasePlanIndexResult>;
    validateSummaryAgainstLivePlanInventory: ValidateSummaryAgainstLivePlanInventory;
}): Promise<{
    planIndex: PhasePlanIndexResult;
    summaryInventory: PhaseSummaryInventory;
}>;
export declare function isLegacySummaryWithoutStatus(content: string): boolean;
export declare function summaryCountsAsCompleted(status: PhaseSummaryRecord["status"], content: string): boolean;
export declare function collectValidatedSummaryPaths(projectRoot: string, summaries: PhaseSummaryRecord[]): Promise<{
    summaryPaths: string[];
    warnings: string[];
}>;
export declare function completedSummaryRecords(summaries: PhaseSummaryRecord[], completedPlanIds?: ReadonlySet<string>): PhaseSummaryRecord[];
export declare function collectReferencedValidatedSummaryPaths(content: string, summaries: PhaseSummaryRecord[], completedPlans: ReadonlySet<string>): string[];
export declare function buildPhaseSummaryAllowedNextActions(phaseNumber: string): Promise<{
    readyAction: string;
    partialAction: string;
    blockedAction: string;
    allowedActions: string[];
}>;
