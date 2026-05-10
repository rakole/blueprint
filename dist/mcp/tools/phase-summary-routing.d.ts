type PhaseSummaryPathLocation = {
    phaseDir: string;
    phasePrefix: string;
};
export type PhaseSummaryCompletedRoute = {
    readiness: "ready-for-validation" | "not-ready-for-validation";
    nextSafeAction: string;
};
export type PhaseSummaryCompletedRouteValidation = {
    mode: "skip";
} | {
    mode: "exact";
    route: PhaseSummaryCompletedRoute;
} | {
    mode: "indexed";
};
export declare function parseSummaryArtifactPath(pathValue: string, phasePrefix: string): string | null;
export declare function summaryPathFor(located: PhaseSummaryPathLocation, planId: string): string;
export declare function phaseSummaryCompletedRoute(args: {
    phaseNumber: string;
    hasRemainingPendingPlans: boolean;
}): PhaseSummaryCompletedRoute;
export declare function completedRouteAfterSelectedCompletion(args: {
    phaseNumber: string;
    planIds: string[];
    completedPlanIds: ReadonlySet<string>;
    selectedPlanId: string;
}): PhaseSummaryCompletedRoute;
export declare function routesMatch(actual: {
    readiness: string | null;
    nextSafeAction: string | null;
}, expected: PhaseSummaryCompletedRoute): boolean;
export declare function formatCompletedSummaryRoute(route: PhaseSummaryCompletedRoute): string;
export declare function extractPhaseSummaryMarkerValue(content: string, marker: string): string | null;
export declare function dependencyPlanRowsForPlan(dependsOn: string[], availablePlanIds: ReadonlySet<string>, resolved: PhaseSummaryPathLocation): Array<{
    planId: string;
    path: string;
}>;
export declare function normalizeDependencyPlanIds(dependsOn: string[]): string[];
export {};
