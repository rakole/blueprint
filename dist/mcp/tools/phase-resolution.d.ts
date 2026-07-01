import { type NumericInput } from "./phase-numbering.js";
import { type ParsedRoadmap } from "./phase-locations.js";
import type { PhaseArtifactScaffoldArgs, PhaseLocateResult, PhaseLookupArgs, PhaseSelectionResult, ResolvedPhaseLocation, ResolvedPhaseRuntimeSnapshot } from "./phase-tool-types.js";
import type { ParsedRoadmapPhase } from "./phase-roadmap-parser.js";
import { type PhaseTopologyFingerprint } from "./phase-topology-lock.js";
export declare function buildLocateRecovery(reason: string | null): string[];
export declare function fallbackPhaseName(phaseDir: string): string;
export declare function toResolvedPhaseLocation(located: PhaseLocateResult): ResolvedPhaseLocation | null;
export declare function findRoadmapPhase(roadmap: ParsedRoadmap | null, phaseNumber: string | null): ParsedRoadmapPhase | null;
export declare function resolvePhaseRuntimeSnapshot(args?: PhaseLookupArgs, options?: {
    stateCurrentPhase?: string | null;
}): Promise<ResolvedPhaseRuntimeSnapshot>;
export type LocatedPhaseForMutation = {
    projectRoot: string;
    resolved: ResolvedPhaseLocation;
    located: PhaseLocateResult;
    artifacts: string[];
    matchedPhase: ParsedRoadmapPhase | null;
};
export type PhaseTopologySnapshot = {
    projectRoot: string;
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    phaseDir: string;
    artifacts: string[];
    fingerprint: PhaseTopologyFingerprint;
};
export declare function assertFreshPhaseTopology(args: {
    operation: string;
    expected: PhaseTopologyFingerprint;
    resolved: ResolvedPhaseLocation;
    matchedPhase: ParsedRoadmapPhase | null;
}): void;
export declare function resolveLocatedPhaseForMutation(args: PhaseLookupArgs): Promise<LocatedPhaseForMutation>;
export declare function resolvePhaseTopologySnapshot(args: PhaseLookupArgs): Promise<PhaseTopologySnapshot>;
export declare function withFreshPhaseTopologyForMutation<T>(projectRoot: string, args: PhaseLookupArgs, expected: PhaseTopologyFingerprint, operation: string, task: (latest: LocatedPhaseForMutation) => Promise<T>): Promise<T>;
export declare function resolvePlannedContextScaffoldPhase(args: PhaseArtifactScaffoldArgs): Promise<{
    projectRoot: string;
    resolved: ResolvedPhaseLocation;
    matchedPhase: ParsedRoadmapPhase;
    expectedTopology: PhaseTopologyFingerprint;
} | null>;
export declare function resolveLocatedPhaseForRead(args: PhaseLookupArgs): Promise<{
    projectRoot: string;
    located: PhaseLocateResult;
    resolved: ResolvedPhaseLocation | null;
}>;
export declare function phaseLocateFailureFromError(error: unknown): PhaseLocateResult;
export declare function locatePhaseFromRoadmap(projectRoot: string, args: PhaseLookupArgs, roadmap: ParsedRoadmap, options?: {
    stateCurrentPhase?: string | null;
}): Promise<PhaseLocateResult>;
export declare function resolveRequestedPhaseForRoadmap(projectRoot: string, requestedPhase: NumericInput | undefined, phases: ParsedRoadmapPhase[], options?: {
    stateCurrentPhase?: string | null;
}): Promise<{
    phaseNumber: string | null;
    resolvedFrom: "explicit" | "state" | "roadmap";
}>;
export declare function phaseSelectionFromLocate(located: PhaseLocateResult): PhaseSelectionResult;
