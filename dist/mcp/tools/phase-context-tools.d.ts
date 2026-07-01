import { type PhaseArtifactValidationDiagnostic } from "./artifacts.js";
import type { PhaseContextResult, PhaseLocateResult, PhaseLookupArgs, PhasePlanningReadiness, PhaseResearchStatusResult } from "./phase-tool-types.js";
type PhaseArtifactUsability = {
    present: boolean;
    valid: boolean | null;
    usable: boolean;
    content: string | null;
    issues: string[];
    diagnostics: PhaseArtifactValidationDiagnostic[];
    warnings: string[];
    unreadable: boolean;
};
export declare function buildPhasePlanningReadiness(args: {
    context: PhaseContextResult;
    contextStatus: PhaseArtifactUsability;
    researchPath: string | null;
    researchValid: boolean | null;
    uiSpecStatus: PhaseArtifactUsability;
    noUiSignalDetected: boolean;
}): PhasePlanningReadiness;
export declare function blueprintPhaseLocate(args?: PhaseLookupArgs): Promise<PhaseLocateResult>;
export declare function blueprintPhaseContext(args?: PhaseLookupArgs): Promise<PhaseContextResult>;
export declare function buildPhaseContext(projectRoot: string, args?: PhaseLookupArgs): Promise<PhaseContextResult>;
export declare function blueprintPhaseResearchStatus(args?: PhaseLookupArgs): Promise<PhaseResearchStatusResult>;
export declare function buildPhaseResearchStatusFromContext(projectRoot: string, context: PhaseContextResult): Promise<PhaseResearchStatusResult>;
export {};
