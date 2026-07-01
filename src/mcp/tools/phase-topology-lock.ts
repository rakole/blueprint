import type { ParsedRoadmapPhase } from "./phase-roadmap-parser.js";

export const PHASE_TOPOLOGY_LOCK_NAME = "phase-topology";

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

export function phaseRoadmapEntryFingerprint(
  phase: ParsedRoadmapPhase | null | undefined
): PhaseRoadmapEntryFingerprint | null {
  if (!phase) {
    return null;
  }

  return {
    phaseNumber: phase.phaseNumber,
    phasePrefix: phase.phasePrefix,
    phaseName: phase.phaseName,
    completed: phase.completed,
    summary: phase.summary,
    goal: phase.goal,
    successCriteria: phase.successCriteria,
    requirements: [...phase.requirements]
  };
}

export function phaseTopologyFingerprintFromLocation(
  location: Omit<PhaseTopologyFingerprint, "roadmapEntry">,
  matchedPhase?: ParsedRoadmapPhase | null
): PhaseTopologyFingerprint {
  return {
    phaseNumber: location.phaseNumber,
    phasePrefix: location.phasePrefix,
    phaseName: location.phaseName,
    phaseDir: location.phaseDir,
    roadmapEntry: phaseRoadmapEntryFingerprint(matchedPhase)
  };
}

function roadmapEntryFingerprintsMatch(
  expected: PhaseRoadmapEntryFingerprint | null,
  actual: PhaseRoadmapEntryFingerprint | null
): boolean {
  if (expected === null || actual === null) {
    return expected === actual;
  }

  return (
    expected.phaseNumber === actual.phaseNumber &&
    expected.phasePrefix === actual.phasePrefix &&
    expected.phaseName === actual.phaseName &&
    expected.completed === actual.completed &&
    expected.summary === actual.summary &&
    expected.goal === actual.goal &&
    expected.successCriteria === actual.successCriteria &&
    expected.requirements.length === actual.requirements.length &&
    expected.requirements.every((requirement, index) => requirement === actual.requirements[index])
  );
}

export function phaseTopologyFingerprintsMatch(
  expected: PhaseTopologyFingerprint,
  actual: PhaseTopologyFingerprint
): boolean {
  return (
    expected.phaseNumber === actual.phaseNumber &&
    expected.phasePrefix === actual.phasePrefix &&
    expected.phaseName === actual.phaseName &&
    expected.phaseDir === actual.phaseDir &&
    roadmapEntryFingerprintsMatch(expected.roadmapEntry, actual.roadmapEntry)
  );
}

export function formatStalePhaseTopologyMessage(args: {
  operation: string;
  expected: PhaseTopologyFingerprint;
  actual: PhaseTopologyFingerprint;
}): string {
  return [
    `${args.operation} rejected stale phase topology for Phase ${args.expected.phaseNumber}.`,
    `Expected ${formatPhaseTopologyFingerprint(args.expected)}.`,
    `Found ${formatPhaseTopologyFingerprint(args.actual)}.`
  ].join(" ");
}

function formatPhaseTopologyFingerprint(fingerprint: PhaseTopologyFingerprint): string {
  return [
    `phaseNumber=${fingerprint.phaseNumber}`,
    `phasePrefix=${fingerprint.phasePrefix}`,
    `phaseDir=${fingerprint.phaseDir}`,
    `phaseName=${fingerprint.phaseName ?? "unknown"}`,
    `roadmapEntry=${formatRoadmapEntryFingerprint(fingerprint.roadmapEntry)}`
  ].join(", ");
}

function formatRoadmapEntryFingerprint(
  fingerprint: PhaseRoadmapEntryFingerprint | null
): string {
  if (!fingerprint) {
    return "missing";
  }

  return [
    `completed=${fingerprint.completed}`,
    `summary=${fingerprint.summary ?? "none"}`,
    `goal=${fingerprint.goal ?? "none"}`,
    `successCriteria=${fingerprint.successCriteria ?? "none"}`,
    `requirements=[${fingerprint.requirements.join(", ")}]`
  ].join("; ");
}
