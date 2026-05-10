import { type NumericInput } from "./phase-numbering.js";
type PhasePlanPathLocation = {
    phaseDir: string;
    phasePrefix: string;
};
export declare function normalizePlanId(value: NumericInput): string;
export declare function parsePlanArtifactPath(pathValue: string, phasePrefix: string): string | null;
export declare function planPathFor(located: PhasePlanPathLocation, planId: string): string;
export declare function extractPlanIdFromFrontmatterLine(line: string): string | null;
export declare function reconcileAutoAssignedPlanContent(content: string, planId: string): string;
export declare function collectInvalidPlanDependencyIssues(planPath: string, dependsOn: string[]): string[];
export declare function normalizeMaybePlanId(value: string | null): string | null;
export declare function extractHeadingText(content: string): string | null;
export declare function extractReferencedPlanId(value: string | null): string | null;
export {};
