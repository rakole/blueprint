import { promises as fs } from "node:fs";
import path from "node:path";

import {
  BLUEPRINT_DIR,
  BLUEPRINT_PHASES_PATH,
  resolveBlueprintPath,
  toRepoRelativePath
} from "./artifacts.js";
import {
  extractPhaseNumberToken,
  normalizeBlueprintInput,
  normalizePhaseNumber,
  type NumericInput
} from "./phase-numbering.js";
import {
  parseRoadmapDocument,
  type ParsedRoadmapPhase
} from "./phase-roadmap-parser.js";
import { loadBlueprintState } from "./state.js";

export type PhaseArtifactKind = "context" | "discussion-log" | "research" | "spec" | "ui-spec";
export type PhaseValidationArtifactKind = "verification" | "uat";

export type ParsedRoadmap = {
  path: string;
  milestone: string | null;
  phases: ParsedRoadmapPhase[];
};

export type PhasePathLocation = {
  phaseDir: string;
  phasePrefix: string;
};

const PHASE_ARTIFACT_SUFFIXES: Record<PhaseArtifactKind, string> = {
  context: "-CONTEXT.md",
  "discussion-log": "-DISCUSSION-LOG.md",
  research: "-RESEARCH.md",
  spec: "-SPEC.md",
  "ui-spec": "-UI-SPEC.md"
};
const PHASE_VALIDATION_ARTIFACT_SUFFIXES: Record<PhaseValidationArtifactKind, string> = {
  verification: "-VERIFICATION.md",
  uat: "-UAT.md"
};
const PHASE_CHECKPOINT_SUFFIX = "-DISCUSS-CHECKPOINT.json";

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function materializePhaseDirectory(
  projectRoot: string,
  phaseDir: string
): Promise<{
  phaseDirPath: string;
  created: boolean;
  warnings: string[];
}> {
  const phaseDirPath = resolveBlueprintPath(projectRoot, phaseDir);

  try {
    const stats = await fs.stat(phaseDirPath);

    if (!stats.isDirectory()) {
      throw new Error(
        `Phase directory path exists but is not a directory: ${phaseDir}. Resolve the drift before mutating the roadmap.`
      );
    }

    return {
      phaseDirPath,
      created: false,
      warnings: [`Phase directory already exists and can be reused: ${phaseDir}`]
    };
  } catch (error) {
    const statError = error as NodeJS.ErrnoException;

    if (statError.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.mkdir(phaseDirPath, { recursive: true });
  return {
    phaseDirPath,
    created: true,
    warnings: []
  };
}

export async function listPhaseArtifacts(
  rootPath: string,
  projectRoot: string
): Promise<string[]> {
  if (!(await pathExists(rootPath))) {
    return [];
  }

  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listPhaseArtifacts(absolutePath, projectRoot)));
      continue;
    }

    files.push(toRepoRelativePath(projectRoot, absolutePath));
  }

  return files.sort();
}

export async function findPhaseDirectory(
  projectRoot: string,
  phaseNumber: string
): Promise<{
  phaseDir: string | null;
  reason: "missing" | "ambiguous" | null;
}> {
  const phasesRoot = resolveBlueprintPath(projectRoot, BLUEPRINT_PHASES_PATH);

  if (!(await pathExists(phasesRoot))) {
    return {
      phaseDir: null,
      reason: "missing"
    };
  }

  const entries = await fs.readdir(phasesRoot, { withFileTypes: true });
  const target = normalizePhaseNumber(phaseNumber);
  const matches = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((directoryName) => {
      const prefix = extractPhaseNumberToken(directoryName);
      return prefix === target;
    });

  if (matches.length === 0) {
    return {
      phaseDir: null,
      reason: "missing"
    };
  }

  if (matches.length > 1) {
    return {
      phaseDir: null,
      reason: "ambiguous"
    };
  }

  return {
    phaseDir: toRepoRelativePath(projectRoot, path.join(phasesRoot, matches[0])),
    reason: null
  };
}

export async function readRoadmap(projectRoot: string): Promise<ParsedRoadmap> {
  const roadmapPath = resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/ROADMAP.md`);

  if (!(await pathExists(roadmapPath))) {
    throw new Error(
      `Missing prerequisite artifact: ${BLUEPRINT_DIR}/ROADMAP.md. Restore it or run /blu-new-project before using phase discovery commands.`
    );
  }

  const raw = await fs.readFile(roadmapPath, "utf8");
  const parsed = parseRoadmapDocument(raw);

  return {
    path: `${BLUEPRINT_DIR}/ROADMAP.md`,
    milestone: parsed.milestone,
    phases: parsed.phases
  };
}

export async function readMarkdownDocument(
  projectRoot: string,
  relativePath: string
): Promise<string | null> {
  const absolutePath = resolveBlueprintPath(projectRoot, relativePath);

  if (!(await pathExists(absolutePath))) {
    return null;
  }

  return await fs.readFile(absolutePath, "utf8");
}

export async function resolveRequestedPhase(
  projectRoot: string,
  requestedPhase: NumericInput | undefined,
  phases: ParsedRoadmapPhase[]
): Promise<{
  phaseNumber: string | null;
  resolvedFrom: "explicit" | "state" | "roadmap";
}> {
  const explicit = requestedPhase === undefined ? undefined : normalizeBlueprintInput(requestedPhase).trim();

  if (explicit) {
    return {
      phaseNumber: extractPhaseNumberToken(explicit),
      resolvedFrom: "explicit"
    };
  }

  try {
    const state = await loadBlueprintState(projectRoot);
    const fromState = extractPhaseNumberToken(state.currentPhase);

    if (fromState) {
      return {
        phaseNumber: fromState,
        resolvedFrom: "state"
      };
    }
  } catch {
    // fall back to roadmap-derived selection below
  }

  const nextPhase = phases.find((phase) => !phase.completed) ?? phases[0];

  return {
    phaseNumber: nextPhase?.phaseNumber ?? null,
    resolvedFrom: "roadmap"
  };
}

export function buildArtifactPath(phaseDir: string, phasePrefix: string, suffix: string): string {
  return `${phaseDir}/${phasePrefix}${suffix}`;
}

export function findArtifact(artifacts: string[], suffix: string): string | null {
  return artifacts.find((artifact) => artifact.endsWith(suffix)) ?? null;
}

export function findPhaseSpecArtifact(
  artifacts: string[],
  phaseDir: string,
  phasePrefix: string
): string | null {
  const expectedPath = buildArtifactPath(phaseDir, phasePrefix, "-SPEC.md");

  return (
    artifacts.find((artifact) => artifact === expectedPath) ?? null
  );
}

export function artifactPathFor(located: PhasePathLocation, artifact: PhaseArtifactKind): string {
  return buildArtifactPath(
    located.phaseDir,
    located.phasePrefix,
    PHASE_ARTIFACT_SUFFIXES[artifact]
  );
}

export function validationArtifactPathFor(
  located: PhasePathLocation,
  artifact: PhaseValidationArtifactKind
): string {
  return buildArtifactPath(
    located.phaseDir,
    located.phasePrefix,
    PHASE_VALIDATION_ARTIFACT_SUFFIXES[artifact]
  );
}

export function checkpointPathFor(located: PhasePathLocation): string {
  return buildArtifactPath(located.phaseDir, located.phasePrefix, PHASE_CHECKPOINT_SUFFIX);
}
