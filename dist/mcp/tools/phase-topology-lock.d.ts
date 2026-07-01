import type { ParsedRoadmapPhase } from "./phase-roadmap-parser.js";
export declare const PHASE_TOPOLOGY_LOCK_NAME = "phase-topology";
export type PhaseRoadmapEntryFingerprint = {
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    completed: boolean;
    summary: string | null;
    goal: string | null;
    successCriteria: string | null;
    requirements: readonly string[];
};
export type PhaseTopologyFingerprint = {
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string | null;
    phaseDir: string;
    roadmapEntry: PhaseRoadmapEntryFingerprint | null;
};
export declare function phaseRoadmapEntryFingerprint(phase: ParsedRoadmapPhase | null | undefined): PhaseRoadmapEntryFingerprint | null;
export declare function phaseTopologyFingerprintFromLocation(location: Omit<PhaseTopologyFingerprint, "roadmapEntry">, matchedPhase?: ParsedRoadmapPhase | null): PhaseTopologyFingerprint;
export declare function phaseTopologyFingerprintsMatch(expected: PhaseTopologyFingerprint, actual: PhaseTopologyFingerprint): boolean;
export declare function formatStalePhaseTopologyMessage(args: {
    operation: string;
    expected: PhaseTopologyFingerprint;
    actual: PhaseTopologyFingerprint;
}): string;
