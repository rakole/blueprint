import path from "node:path";

import {
  BLUEPRINT_DIR,
  BLUEPRINT_PHASES_PATH,
  ensureRepoRoot,
  resolveBlueprintPath,
  withBlueprintRepoLock
} from "./artifacts.js";
import {
  buildBlueprintPhaseDirectoryPath
} from "./phase-roadmap-mutations.js";
import {
  extractPhaseNumberToken,
  formatPhasePrefix,
  normalizeBlueprintInput,
  normalizePhaseNumber,
  slugToTitle,
  type NumericInput
} from "./phase-numbering.js";
import {
  findPhaseDirectory,
  listPhaseArtifacts,
  readRoadmap,
  resolveRequestedPhase,
  type ParsedRoadmap
} from "./phase-locations.js";
import type {
  PhaseArtifactScaffoldArgs,
  PhaseLocateResult,
  PhaseLookupArgs,
  PhaseSelectionResult,
  ResolvedPhaseLocation,
  ResolvedPhaseRuntimeSnapshot
} from "./phase-tool-types.js";
import type { ParsedRoadmapPhase } from "./phase-roadmap-parser.js";
import {
  formatStalePhaseTopologyMessage,
  PHASE_TOPOLOGY_LOCK_NAME,
  phaseTopologyFingerprintFromLocation,
  phaseTopologyFingerprintsMatch,
  type PhaseTopologyFingerprint
} from "./phase-topology-lock.js";

export function buildLocateRecovery(reason: string | null): string[] {
  if (!reason) {
    return [];
  }

  if (reason.includes("no matching directory")) {
    return [
      "Create or restore the numbered phase directory under .blueprint/phases/ so it matches ROADMAP.md.",
      "Run /blu-discuss-phase after the directory exists to rebuild missing discovery artifacts."
    ];
  }

  if (reason.includes("multiple matching directories")) {
    return [
      "Rename duplicate phase directories so only one directory matches the requested phase number.",
      "Run /blu-health to confirm the phase tree is normalized before retrying discovery commands."
    ];
  }

  if (reason.includes("ROADMAP.md")) {
    return [
      "Restore .blueprint/ROADMAP.md or reinitialize the project with /blu-new-project.",
      "Run /blu-health after restoring artifacts to confirm Blueprint state is consistent."
    ];
  }

  return [
    "Confirm the requested phase exists in .blueprint/ROADMAP.md and has a matching numbered directory.",
    "Use /blu-progress if you need the safest currently implemented next action."
  ];
}

export function fallbackPhaseName(phaseDir: string): string {
  return slugToTitle(path.basename(phaseDir).replace(/^\d+(?:\.\d+)?-/, ""));
}

export function toResolvedPhaseLocation(
  located: PhaseLocateResult
): ResolvedPhaseLocation | null {
  if (!located.found || !located.phaseNumber || !located.phasePrefix || !located.phaseDir) {
    return null;
  }

  return {
    phaseNumber: located.phaseNumber,
    phasePrefix: located.phasePrefix,
    phaseName: located.phaseName ?? fallbackPhaseName(located.phaseDir),
    phaseDir: located.phaseDir
  };
}

export function findRoadmapPhase(
  roadmap: ParsedRoadmap | null,
  phaseNumber: string | null
): ParsedRoadmapPhase | null {
  if (!roadmap || !phaseNumber) {
    return null;
  }

  const normalizedPhaseNumber = normalizePhaseNumber(phaseNumber);

  return roadmap.phases.find(
    (phase) => normalizePhaseNumber(phase.phaseNumber) === normalizedPhaseNumber
  ) ?? null;
}

export async function resolvePhaseRuntimeSnapshot(
  args: PhaseLookupArgs = {},
  options: {
    stateCurrentPhase?: string | null;
  } = {}
): Promise<ResolvedPhaseRuntimeSnapshot> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  let roadmap: ParsedRoadmap;

  try {
    roadmap = await readRoadmap(projectRoot);
  } catch (error) {
    const located = phaseLocateFailureFromError(error);

    return {
      projectRoot,
      roadmap: null,
      located,
      resolved: null,
      matchedPhase: null,
      artifacts: []
    };
  }

  const located = await locatePhaseFromRoadmap(projectRoot, args, roadmap, options);
  const resolved = toResolvedPhaseLocation(located);

  return {
    projectRoot,
    roadmap,
    located,
    resolved,
    matchedPhase: findRoadmapPhase(roadmap, located.phaseNumber),
    artifacts: located.artifacts
  };
}

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

export function assertFreshPhaseTopology(args: {
  operation: string;
  expected: PhaseTopologyFingerprint;
  resolved: ResolvedPhaseLocation;
  matchedPhase: ParsedRoadmapPhase | null;
}): void {
  const actual = phaseTopologyFingerprintFromLocation(args.resolved, args.matchedPhase);

  if (!phaseTopologyFingerprintsMatch(args.expected, actual)) {
    throw new Error(
      formatStalePhaseTopologyMessage({
        operation: args.operation,
        expected: args.expected,
        actual
      })
    );
  }
}

export async function resolveLocatedPhaseForMutation(
  args: PhaseLookupArgs
): Promise<LocatedPhaseForMutation> {
  const snapshot = await resolvePhaseRuntimeSnapshot(args);
  const resolved = snapshot.resolved;

  if (!resolved) {
    throw new Error(snapshot.located.reason ?? "Phase could not be resolved for a deterministic write.");
  }

  return {
    projectRoot: snapshot.projectRoot,
    resolved,
    located: snapshot.located,
    artifacts: snapshot.artifacts,
    matchedPhase: snapshot.matchedPhase
  };
}

export async function resolvePhaseTopologySnapshot(
  args: PhaseLookupArgs
): Promise<PhaseTopologySnapshot> {
  const snapshot = await resolveLocatedPhaseForMutation(args);

  return {
    projectRoot: snapshot.projectRoot,
    phaseNumber: snapshot.resolved.phaseNumber,
    phasePrefix: snapshot.resolved.phasePrefix,
    phaseName: snapshot.resolved.phaseName,
    phaseDir: snapshot.resolved.phaseDir,
    artifacts: snapshot.artifacts,
    fingerprint: phaseTopologyFingerprintFromLocation(
      snapshot.resolved,
      snapshot.matchedPhase
    )
  };
}

export async function withFreshPhaseTopologyForMutation<T>(
  projectRoot: string,
  args: PhaseLookupArgs,
  expected: PhaseTopologyFingerprint,
  operation: string,
  task: (latest: LocatedPhaseForMutation) => Promise<T>
): Promise<T> {
  return withBlueprintRepoLock(projectRoot, PHASE_TOPOLOGY_LOCK_NAME, async () => {
    const latest = await resolveLocatedPhaseForMutation({ ...args, cwd: projectRoot });

    assertFreshPhaseTopology({
      operation,
      expected,
      resolved: latest.resolved,
      matchedPhase: latest.matchedPhase
    });

    return task(latest);
  });
}

export async function resolvePlannedContextScaffoldPhase(
  args: PhaseArtifactScaffoldArgs
): Promise<{
  projectRoot: string;
  resolved: ResolvedPhaseLocation;
  matchedPhase: ParsedRoadmapPhase;
  expectedTopology: PhaseTopologyFingerprint;
} | null> {
  if (args.artifact !== "context") {
    return null;
  }

  const snapshot = await resolvePhaseRuntimeSnapshot(args);
  const matchedPhase = snapshot.matchedPhase;

  if (
    snapshot.resolved ||
    !matchedPhase ||
    matchedPhase.completed ||
    snapshot.located.reason?.includes("no matching directory") !== true
  ) {
    return null;
  }

  const phaseDir = buildBlueprintPhaseDirectoryPath(
    matchedPhase.phaseNumber,
    matchedPhase.phaseName
  );
  const resolved = {
    phaseNumber: matchedPhase.phaseNumber,
    phasePrefix: matchedPhase.phasePrefix,
    phaseName: matchedPhase.phaseName,
    phaseDir
  };

  return {
    projectRoot: snapshot.projectRoot,
    resolved,
    matchedPhase,
    expectedTopology: phaseTopologyFingerprintFromLocation(resolved, matchedPhase)
  };
}

export async function resolveLocatedPhaseForRead(
  args: PhaseLookupArgs
): Promise<{
  projectRoot: string;
  located: PhaseLocateResult;
  resolved: ResolvedPhaseLocation | null;
}> {
  const snapshot = await resolvePhaseRuntimeSnapshot(args);

  return {
    projectRoot: snapshot.projectRoot,
    located: snapshot.located,
    resolved: snapshot.resolved
  };
}

export function phaseLocateFailureFromError(error: unknown): PhaseLocateResult {
  const reason = error instanceof Error ? error.message : String(error);

  return {
    found: false,
    phaseNumber: null,
    phasePrefix: null,
    phaseName: null,
    phaseDir: null,
    artifacts: [],
    milestone: null,
    resolvedFrom: "roadmap",
    reason,
    recovery: buildLocateRecovery(reason),
    warnings: []
  };
}

export async function locatePhaseFromRoadmap(
  projectRoot: string,
  args: PhaseLookupArgs,
  roadmap: ParsedRoadmap,
  options: {
    stateCurrentPhase?: string | null;
  } = {}
): Promise<PhaseLocateResult> {
  const { phaseNumber, resolvedFrom } = await resolveRequestedPhaseForRoadmap(
    projectRoot,
    args.phase,
    roadmap.phases,
    options
  );

  if (!phaseNumber) {
    return {
      found: false,
      phaseNumber: null,
      phasePrefix: null,
      phaseName: null,
      phaseDir: null,
      artifacts: [],
      milestone: roadmap.milestone,
      resolvedFrom,
      reason: "No phase could be inferred from the request, state, or roadmap.",
      recovery: buildLocateRecovery("No phase could be inferred from the request, state, or roadmap."),
      warnings: []
    };
  }

  const matchedPhase = roadmap.phases.find(
    (phase) => normalizePhaseNumber(phase.phaseNumber) === normalizePhaseNumber(phaseNumber)
  );

  if (!matchedPhase) {
    return {
      found: false,
      phaseNumber,
      phasePrefix: formatPhasePrefix(phaseNumber),
      phaseName: null,
      phaseDir: null,
      artifacts: [],
      milestone: roadmap.milestone,
      resolvedFrom,
      reason: `Phase ${phaseNumber} was not found in ${BLUEPRINT_DIR}/ROADMAP.md.`,
      recovery: buildLocateRecovery(
        `Phase ${phaseNumber} was not found in ${BLUEPRINT_DIR}/ROADMAP.md.`
      ),
      warnings: []
    };
  }

  const phaseDirectoryResolution = await findPhaseDirectory(projectRoot, matchedPhase.phaseNumber);
  const phaseDir = phaseDirectoryResolution.phaseDir;

  if (!phaseDir) {
    const reason =
      phaseDirectoryResolution.reason === "ambiguous"
        ? `Phase ${matchedPhase.phaseNumber} has multiple matching directories in ${BLUEPRINT_PHASES_PATH}/.`
        : `Phase ${matchedPhase.phaseNumber} exists in ${BLUEPRINT_DIR}/ROADMAP.md but has no matching directory in ${BLUEPRINT_PHASES_PATH}/.`;

    return {
      found: false,
      phaseNumber: matchedPhase.phaseNumber,
      phasePrefix: matchedPhase.phasePrefix,
      phaseName: matchedPhase.phaseName,
      phaseDir: null,
      artifacts: [],
      milestone: roadmap.milestone,
      resolvedFrom,
      reason,
      recovery: buildLocateRecovery(reason),
      warnings: []
    };
  }

  const phaseArtifacts = await listPhaseArtifacts(
    resolveBlueprintPath(projectRoot, phaseDir),
    projectRoot
  );

  return {
    found: true,
    phaseNumber: matchedPhase.phaseNumber,
    phasePrefix: matchedPhase.phasePrefix,
    phaseName: matchedPhase.phaseName,
    phaseDir,
    artifacts: phaseArtifacts,
    milestone: roadmap.milestone,
    resolvedFrom,
    reason: null,
    recovery: [],
    warnings: []
  };
}

export async function resolveRequestedPhaseForRoadmap(
  projectRoot: string,
  requestedPhase: NumericInput | undefined,
  phases: ParsedRoadmapPhase[],
  options: {
    stateCurrentPhase?: string | null;
  } = {}
): Promise<{
  phaseNumber: string | null;
  resolvedFrom: "explicit" | "state" | "roadmap";
}> {
  if (options.stateCurrentPhase === undefined) {
    return await resolveRequestedPhase(projectRoot, requestedPhase, phases);
  }

  const explicit = requestedPhase === undefined ? undefined : normalizeBlueprintInput(requestedPhase).trim();

  if (explicit) {
    return {
      phaseNumber: extractPhaseNumberToken(explicit),
      resolvedFrom: "explicit"
    };
  }

  const fromState = extractPhaseNumberToken(options.stateCurrentPhase ?? "");

  if (fromState) {
    return {
      phaseNumber: fromState,
      resolvedFrom: "state"
    };
  }

  const nextPhase = phases.find((phase) => !phase.completed) ?? phases[0];

  return {
    phaseNumber: nextPhase?.phaseNumber ?? null,
    resolvedFrom: "roadmap"
  };
}

export function phaseSelectionFromLocate(located: PhaseLocateResult): PhaseSelectionResult {
  return {
    found: located.found,
    phaseNumber: located.phaseNumber,
    phasePrefix: located.phasePrefix,
    phaseName: located.phaseName,
    phaseDir: located.phaseDir,
    resolvedFrom: located.resolvedFrom,
    reason: located.reason,
    recovery: located.recovery,
    warnings: located.warnings
  };
}
