import { type ArtifactContractReadResult } from "../artifact-contracts/index.js";
import { type PhaseValidationArtifactKind } from "./phase-locations.js";
type PhaseValidationContractResolvedPhase = {
    phasePrefix: string;
    phaseName: string;
    phaseDir: string;
};
export type PhaseValidationAllowedValues = {
    verification: {
        gateStates: string[];
        coverageStates: string[];
        manualCoverageStatuses: string[];
        gapClasses: string[];
        readinessByGate: Record<string, string>;
        readyForUatCommand: string;
        repairCommands: string[];
    };
    uat: {
        statuses: string[];
        resumeStates: string[];
        completeCheckpoint: string;
        testResults: string[];
        structuredGapStatuses: string[];
        structuredGapSeverities: string[];
    };
};
export declare const PHASE_VALIDATION_ALLOWED_VALUES: PhaseValidationAllowedValues;
export declare function clonePhaseValidationAllowedValues(): PhaseValidationAllowedValues;
export declare function validationArtifactContractId(artifact: PhaseValidationArtifactKind): "phase.verification" | "phase.uat";
export declare function validationArtifactContract(artifact: PhaseValidationArtifactKind, resolved?: PhaseValidationContractResolvedPhase): ArtifactContractReadResult;
export {};
