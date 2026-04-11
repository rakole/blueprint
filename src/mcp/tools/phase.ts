import { promises as fs } from "node:fs";
import path from "node:path";

import * as z from "zod/v4";

import {
  BLUEPRINT_DIR,
  BLUEPRINT_PHASES_PATH,
  ensureParentDirectory,
  ensureRepoRoot,
  validateResearchArtifactContent,
  resolveBlueprintPath,
  toRepoRelativePath
} from "./artifacts.js";
import { loadBlueprintState } from "./state.js";

type RoadmapReadArgs = {
  cwd?: string;
};

type PhaseLookupArgs = {
  cwd?: string;
  phase?: string;
};

type PhaseArtifactKind = "context" | "discussion-log" | "research" | "ui-spec";

type PhaseArtifactReadArgs = PhaseLookupArgs & {
  artifact: PhaseArtifactKind;
};

type PhaseArtifactWriteArgs = PhaseLookupArgs & {
  artifact: PhaseArtifactKind;
  content: string;
  overwrite?: boolean;
  validationMode?: "strict" | "warn";
};

type PhaseCheckpointPutArgs = PhaseLookupArgs & {
  checkpoint: Record<string, unknown>;
};

type ResolvedPhaseLocation = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  phaseDir: string;
};

type ParsedRoadmapPhase = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  completed: boolean;
  summary: string | null;
  goal: string | null;
  requirements: string[];
};

type PhaseLocateResult = {
  found: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  artifacts: string[];
  milestone: string | null;
  resolvedFrom: "explicit" | "state" | "roadmap";
  reason: string | null;
  recovery: string[];
  warnings: string[];
};

type PhaseContextResult = {
  phase: {
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    phaseDir: string;
    artifacts: {
      all: string[];
      context: string | null;
      discussionLog: string | null;
      research: string | null;
      uiSpec: string | null;
      plans: string[];
      summaries: string[];
    };
  } | null;
  requirements: string[];
  missingArtifacts: string[];
  warnings: string[];
};

type PhaseResearchStatusResult = {
  hasContext: boolean;
  hasResearch: boolean;
  hasUiSpec: boolean;
  contextPath: string | null;
  researchPath: string | null;
  uiSpecPath: string | null;
  researchValid: boolean | null;
  researchIssues: string[];
  suggestedRepairs: string[];
  warnings: string[];
};

type PhaseArtifactReadResult = {
  phaseFound: boolean;
  found: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  artifact: PhaseArtifactKind;
  path: string | null;
  content: string | null;
  reason: string | null;
};

type PhaseArtifactWriteResult = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  phaseDir: string;
  artifact: PhaseArtifactKind;
  path: string;
  written: boolean;
  created: boolean;
  overwritten: boolean;
  status: "created" | "updated" | "reused" | "invalid";
  validation: {
    valid: boolean;
    issues: string[];
    warnings: string[];
    suggestedRepairs: string[];
  } | null;
  warnings: string[];
};

type PhaseCheckpointGetResult = {
  phaseFound: boolean;
  found: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  path: string | null;
  checkpoint: Record<string, unknown> | null;
  reason: string | null;
};

type PhaseCheckpointPutResult = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  phaseDir: string;
  path: string;
  updated: boolean;
  warnings: string[];
};

type PhaseCheckpointDeleteResult = {
  phaseFound: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  path: string | null;
  deleted: boolean;
  reason: string | null;
};

type RoadmapReadResult = {
  roadmap: {
    path: string;
    phaseCount: number;
  };
  milestone: string | null;
  warnings: string[];
  recovery: string[];
  phases: Array<{
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    completed: boolean;
    summary: string | null;
    goal: string | null;
    requirements: string[];
    phaseDir: string | null;
  }>;
};

const PHASE_ARTIFACT_SUFFIXES: Record<PhaseArtifactKind, string> = {
  context: "-CONTEXT.md",
  "discussion-log": "-DISCUSSION-LOG.md",
  research: "-RESEARCH.md",
  "ui-spec": "-UI-SPEC.md"
};
const PHASE_CHECKPOINT_SUFFIX = "-DISCUSS-CHECKPOINT.json";

const roadmapReadInputSchema = {
  cwd: z.string().optional()
};

const phaseLookupInputSchema = {
  cwd: z.string().optional(),
  phase: z.string().optional()
};

const phaseArtifactInputSchema = {
  cwd: z.string().optional(),
  phase: z.string().optional(),
  artifact: z.enum(["context", "discussion-log", "research", "ui-spec"])
};

const phaseArtifactWriteInputSchema = {
  cwd: z.string().optional(),
  phase: z.string().optional(),
  artifact: z.enum(["context", "discussion-log", "research", "ui-spec"]),
  content: z.string(),
  overwrite: z.boolean().optional(),
  validationMode: z.enum(["strict", "warn"]).optional()
};

const phaseCheckpointPutInputSchema = {
  cwd: z.string().optional(),
  phase: z.string().optional(),
  checkpoint: z.record(z.string(), z.unknown())
};

function normalizePhaseNumber(value: string): string {
  return value
    .split(".")
    .map((segment) => {
      const trimmed = segment.trim().replace(/^0+(?=\d)/, "");
      return trimmed.length > 0 ? trimmed : "0";
    })
    .join(".");
}

function formatPhasePrefix(value: string): string {
  const normalized = normalizePhaseNumber(value);
  const [head, ...rest] = normalized.split(".");

  return [head.padStart(2, "0"), ...rest].join(".");
}

function extractPhaseNumberToken(value: string): string | null {
  const match = value.trim().match(/(\d+(?:\.\d+)?)/);
  return match ? normalizePhaseNumber(match[1]) : null;
}

function slugToTitle(value: string): string {
  return value
    .split("-")
    .filter((segment) => segment.length > 0)
    .map((segment) => `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`)
    .join(" ");
}

function parseRequirements(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseRoadmapDocument(raw: string): {
  milestone: string | null;
  phases: ParsedRoadmapPhase[];
} {
  const milestone = raw.match(/- Active milestone:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const details = new Map<
    string,
    {
      goal: string | null;
      requirements: string[];
    }
  >();

  for (const block of raw.split(/^### Phase /gm).slice(1)) {
    const newlineIndex = block.indexOf("\n");
    const header = newlineIndex === -1 ? block.trim() : block.slice(0, newlineIndex).trim();
    const body = newlineIndex === -1 ? "" : block.slice(newlineIndex + 1);
    const headerMatch = header.match(/^(\d+(?:\.\d+)?): (.+)$/);

    if (!headerMatch) {
      continue;
    }

    const phaseNumber = normalizePhaseNumber(headerMatch[1]);
    const goal = body.match(/^\*\*Goal\*\*:\s*(.+)$/m)?.[1]?.trim() ?? null;
    const requirements = parseRequirements(
      body.match(/^\*\*Requirements\*\*:\s*(.+)$/m)?.[1] ?? null
    );

    details.set(phaseNumber, { goal, requirements });
  }

  const phases: ParsedRoadmapPhase[] = [];

  for (const match of raw.matchAll(
    /^- \[([ xX])\] \*\*Phase (\d+(?:\.\d+)?): ([^*]+?)\*\*(?: - (.+))?$/gm
  )) {
    const phaseNumber = normalizePhaseNumber(match[2]);
    const phaseName = match[3].trim();
    const detail = details.get(phaseNumber);

    phases.push({
      phaseNumber,
      phasePrefix: formatPhasePrefix(phaseNumber),
      phaseName,
      completed: match[1].toLowerCase() === "x",
      summary: match[4]?.trim() ?? null,
      goal: detail?.goal ?? null,
      requirements: detail?.requirements ?? []
    });
  }

  return { milestone, phases };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listPhaseArtifacts(
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

async function findPhaseDirectory(
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

async function readRoadmap(
  projectRoot: string
): Promise<{
  path: string;
  milestone: string | null;
  phases: ParsedRoadmapPhase[];
}> {
  const roadmapPath = resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/ROADMAP.md`);

  if (!(await pathExists(roadmapPath))) {
    throw new Error(
      `Missing prerequisite artifact: ${BLUEPRINT_DIR}/ROADMAP.md. Restore it or run /blu:new-project before using phase discovery commands.`
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

async function resolveRequestedPhase(
  projectRoot: string,
  requestedPhase: string | undefined,
  phases: ParsedRoadmapPhase[]
): Promise<{
  phaseNumber: string | null;
  resolvedFrom: "explicit" | "state" | "roadmap";
}> {
  const explicit = requestedPhase?.trim();

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

function buildArtifactPath(phaseDir: string, phasePrefix: string, suffix: string): string {
  return `${phaseDir}/${phasePrefix}${suffix}`;
}

function findArtifact(artifacts: string[], suffix: string): string | null {
  return artifacts.find((artifact) => artifact.endsWith(suffix)) ?? null;
}

function buildLocateRecovery(reason: string | null): string[] {
  if (!reason) {
    return [];
  }

  if (reason.includes("ROADMAP.md")) {
    return [
      "Restore .blueprint/ROADMAP.md or reinitialize the project with /blu:new-project.",
      "Run /blu:health after restoring artifacts to confirm Blueprint state is consistent."
    ];
  }

  if (reason.includes("no matching directory")) {
    return [
      "Create or restore the numbered phase directory under .blueprint/phases/ so it matches ROADMAP.md.",
      "Run /blu:discuss-phase after the directory exists to rebuild missing discovery artifacts."
    ];
  }

  if (reason.includes("multiple matching directories")) {
    return [
      "Rename duplicate phase directories so only one directory matches the requested phase number.",
      "Run /blu:health to confirm the phase tree is normalized before retrying discovery commands."
    ];
  }

  return [
    "Confirm the requested phase exists in .blueprint/ROADMAP.md and has a matching numbered directory.",
    "Use /blu:progress if you need the safest currently implemented next action."
  ];
}

function fallbackPhaseName(phaseDir: string): string {
  return slugToTitle(path.basename(phaseDir).replace(/^\d+(?:\.\d+)?-/, ""));
}

function toResolvedPhaseLocation(
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

function artifactPathFor(located: Pick<ResolvedPhaseLocation, "phaseDir" | "phasePrefix">, artifact: PhaseArtifactKind): string {
  return buildArtifactPath(
    located.phaseDir,
    located.phasePrefix,
    PHASE_ARTIFACT_SUFFIXES[artifact]
  );
}

function checkpointPathFor(located: Pick<ResolvedPhaseLocation, "phaseDir" | "phasePrefix">): string {
  return buildArtifactPath(located.phaseDir, located.phasePrefix, PHASE_CHECKPOINT_SUFFIX);
}

function normalizeTextContent(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function ensureCheckpointObject(
  checkpoint: unknown,
  checkpointPath: string
): Record<string, unknown> {
  if (typeof checkpoint !== "object" || checkpoint === null || Array.isArray(checkpoint)) {
    throw new Error(`${checkpointPath} must contain a JSON object.`);
  }

  return checkpoint as Record<string, unknown>;
}

async function resolveLocatedPhaseForMutation(
  args: PhaseLookupArgs
): Promise<{
  projectRoot: string;
  resolved: ResolvedPhaseLocation;
}> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate(args);
  const resolved = toResolvedPhaseLocation(located);

  if (!resolved) {
    throw new Error(located.reason ?? "Phase could not be resolved for a deterministic write.");
  }

  return {
    projectRoot,
    resolved
  };
}

export async function blueprintRoadmapRead(
  args: RoadmapReadArgs = {}
): Promise<RoadmapReadResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  let roadmap;

  try {
    roadmap = await readRoadmap(projectRoot);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    return {
      roadmap: {
        path: `${BLUEPRINT_DIR}/ROADMAP.md`,
        phaseCount: 0
      },
      milestone: null,
      warnings: [reason],
      recovery: buildLocateRecovery(reason),
      phases: []
    };
  }
  const phases = await Promise.all(
    roadmap.phases.map(async (phase) => {
      const locatedPhaseDir = await findPhaseDirectory(projectRoot, phase.phaseNumber);

      return {
        ...phase,
        phaseDir: locatedPhaseDir.phaseDir
      };
    })
  );

  return {
    roadmap: {
      path: roadmap.path,
      phaseCount: phases.length
    },
    milestone: roadmap.milestone,
    warnings: [],
    recovery: [],
    phases
  };
}

export async function blueprintPhaseLocate(
  args: PhaseLookupArgs = {}
): Promise<PhaseLocateResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  let roadmap;

  try {
    roadmap = await readRoadmap(projectRoot);
  } catch (error) {
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
  const { phaseNumber, resolvedFrom } = await resolveRequestedPhase(
    projectRoot,
    args.phase,
    roadmap.phases
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

export async function blueprintPhaseContext(
  args: PhaseLookupArgs = {}
): Promise<PhaseContextResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const roadmap = await readRoadmap(projectRoot);
  const located = await blueprintPhaseLocate(args);

  if (!located.found || !located.phaseNumber || !located.phasePrefix || !located.phaseDir) {
    return {
      phase: null,
      requirements: [],
      missingArtifacts: [],
      warnings: located.reason ? [located.reason] : []
    };
  }

  const matchedPhase = roadmap.phases.find(
    (phase) => phase.phaseNumber === located.phaseNumber
  );
  const artifacts = located.artifacts;
  const contextPath = buildArtifactPath(located.phaseDir, located.phasePrefix, "-CONTEXT.md");
  const researchPath = buildArtifactPath(located.phaseDir, located.phasePrefix, "-RESEARCH.md");
  const uiSpecPath = buildArtifactPath(located.phaseDir, located.phasePrefix, "-UI-SPEC.md");

  return {
    phase: {
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName ?? matchedPhase?.phaseName ?? slugToTitle(located.phaseDir),
      phaseDir: located.phaseDir,
      artifacts: {
        all: artifacts,
        context: findArtifact(artifacts, "-CONTEXT.md"),
        discussionLog: findArtifact(artifacts, "-DISCUSSION-LOG.md"),
        research: findArtifact(artifacts, "-RESEARCH.md"),
        uiSpec: findArtifact(artifacts, "-UI-SPEC.md"),
        plans: artifacts.filter((artifact) => artifact.endsWith("-PLAN.md")),
        summaries: artifacts.filter((artifact) => artifact.endsWith("-SUMMARY.md"))
      }
    },
    requirements: matchedPhase?.requirements ?? [],
    missingArtifacts: [contextPath, researchPath, uiSpecPath].filter(
      (artifact) => !artifacts.includes(artifact)
    ),
    warnings: [
      ...(!findArtifact(artifacts, "-CONTEXT.md")
        ? ["Research quality will be limited until XX-CONTEXT.md exists."]
        : []),
      ...(matchedPhase && matchedPhase.requirements.length === 0
        ? ["Phase requirements are missing from ROADMAP.md for this phase."]
        : [])
    ]
  };
}

export async function blueprintPhaseResearchStatus(
  args: PhaseLookupArgs = {}
): Promise<PhaseResearchStatusResult> {
  const context = await blueprintPhaseContext(args);
  const artifacts = context.phase?.artifacts;
  const researchPath = artifacts?.research ?? null;
  let researchValid: boolean | null = null;
  let researchIssues: string[] = [];
  const warnings = [...context.warnings];

  if (researchPath) {
    const projectRoot = await ensureRepoRoot(args.cwd);
    const absolutePath = resolveBlueprintPath(projectRoot, researchPath);
    const raw = await fs.readFile(absolutePath, "utf8");
    const validation = validateResearchArtifactContent(raw);

    researchValid = validation.valid;
    researchIssues = validation.issues;
    warnings.push(...validation.warnings);
  }

  return {
    hasContext: Boolean(artifacts?.context),
    hasResearch: Boolean(artifacts?.research),
    hasUiSpec: Boolean(artifacts?.uiSpec),
    contextPath: artifacts?.context ?? null,
    researchPath,
    uiSpecPath: artifacts?.uiSpec ?? null,
    researchValid,
    researchIssues,
    suggestedRepairs:
      researchIssues.length > 0
        ? [
            "Update the phase research through /blu:research-phase so it matches the required research schema before planning."
          ]
        : [],
    warnings
  };
}

export async function blueprintPhaseArtifactRead(
  args: PhaseArtifactReadArgs
): Promise<PhaseArtifactReadResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate(args);
  const resolved = toResolvedPhaseLocation(located);

  if (!resolved) {
    return {
      phaseFound: false,
      found: false,
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName,
      phaseDir: located.phaseDir,
      artifact: args.artifact,
      path: null,
      content: null,
      reason: located.reason
    };
  }

  const artifactPath = artifactPathFor(resolved, args.artifact);
  const absolutePath = resolveBlueprintPath(projectRoot, artifactPath);

  if (!(await pathExists(absolutePath))) {
    return {
      phaseFound: true,
      found: false,
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      artifact: args.artifact,
      path: artifactPath,
      content: null,
      reason: `${artifactPath} does not exist yet.`
    };
  }

  return {
    phaseFound: true,
    found: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    artifact: args.artifact,
    path: artifactPath,
    content: await fs.readFile(absolutePath, "utf8"),
    reason: null
  };
}

export async function blueprintPhaseArtifactWrite(
  args: PhaseArtifactWriteArgs
): Promise<PhaseArtifactWriteResult> {
  const { projectRoot, resolved } = await resolveLocatedPhaseForMutation(args);
  const artifactPath = artifactPathFor(resolved, args.artifact);
  const absolutePath = resolveBlueprintPath(projectRoot, artifactPath);
  const normalizedContent = normalizeTextContent(args.content);
  const exists = await pathExists(absolutePath);
  const warnings: string[] = [];
  const validation =
    args.artifact === "research"
      ? validateResearchArtifactContent(normalizedContent)
      : null;

  if (exists) {
    const existingContent = await fs.readFile(absolutePath, "utf8");

    if (existingContent === normalizedContent) {
      warnings.push(`Preserved existing ${args.artifact} artifact because the content was unchanged.`);

      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        artifact: args.artifact,
        path: artifactPath,
        written: false,
        created: false,
        overwritten: false,
        status: "reused",
        validation:
          validation
            ? {
                valid: validation.valid,
                issues: validation.issues,
                warnings: validation.warnings,
                suggestedRepairs: []
              }
            : null,
        warnings
      };
    }

    if (!(args.overwrite ?? false)) {
      throw new Error(
        `${artifactPath} already exists. Re-run only after explicit overwrite confirmation.`
      );
    }
  }

  if (validation && !validation.valid && (args.validationMode ?? "strict") === "strict") {
    return {
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      artifact: args.artifact,
      path: artifactPath,
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      validation: {
        valid: false,
        issues: validation.issues,
        warnings: validation.warnings,
        suggestedRepairs: [
          "Add the required research sections, confidence marker, and at least one cited source before retrying."
        ]
      },
      warnings: []
    };
  }

  await ensureParentDirectory(absolutePath);
  await fs.writeFile(absolutePath, normalizedContent, "utf8");

  if (exists) {
    warnings.push(`Replaced existing ${args.artifact} artifact: ${artifactPath}`);
  }

  return {
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    artifact: args.artifact,
    path: artifactPath,
    written: true,
    created: !exists,
    overwritten: exists,
    status: exists ? "updated" : "created",
    validation:
      validation
        ? {
            valid: validation.valid,
            issues: validation.issues,
            warnings: validation.warnings,
            suggestedRepairs: []
          }
        : null,
    warnings: [...warnings, ...(validation?.warnings ?? [])]
  };
}

export async function blueprintPhaseCheckpointGet(
  args: PhaseLookupArgs = {}
): Promise<PhaseCheckpointGetResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate(args);
  const resolved = toResolvedPhaseLocation(located);

  if (!resolved) {
    return {
      phaseFound: false,
      found: false,
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName,
      phaseDir: located.phaseDir,
      path: null,
      checkpoint: null,
      reason: located.reason
    };
  }

  const checkpointPath = checkpointPathFor(resolved);
  const absolutePath = resolveBlueprintPath(projectRoot, checkpointPath);

  if (!(await pathExists(absolutePath))) {
    return {
      phaseFound: true,
      found: false,
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      path: checkpointPath,
      checkpoint: null,
      reason: `${checkpointPath} does not exist.`
    };
  }

  const parsed = ensureCheckpointObject(
    JSON.parse(await fs.readFile(absolutePath, "utf8")) as unknown,
    checkpointPath
  );

  return {
    phaseFound: true,
    found: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    path: checkpointPath,
    checkpoint: parsed,
    reason: null
  };
}

export async function blueprintPhaseCheckpointPut(
  args: PhaseCheckpointPutArgs
): Promise<PhaseCheckpointPutResult> {
  const { projectRoot, resolved } = await resolveLocatedPhaseForMutation(args);
  const checkpointPath = checkpointPathFor(resolved);
  const absolutePath = resolveBlueprintPath(projectRoot, checkpointPath);
  const nextCheckpoint = ensureCheckpointObject(args.checkpoint, checkpointPath);
  const nextRaw = `${JSON.stringify(nextCheckpoint, null, 2)}\n`;
  const warnings: string[] = [];

  if (await pathExists(absolutePath)) {
    const existingRaw = await fs.readFile(absolutePath, "utf8");

    if (existingRaw === nextRaw) {
      warnings.push(`Preserved existing discussion checkpoint because the content was unchanged.`);

      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        path: checkpointPath,
        updated: false,
        warnings
      };
    }
  }

  await ensureParentDirectory(absolutePath);
  await fs.writeFile(absolutePath, nextRaw, "utf8");

  return {
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    path: checkpointPath,
    updated: true,
    warnings
  };
}

export async function blueprintPhaseCheckpointDelete(
  args: PhaseLookupArgs = {}
): Promise<PhaseCheckpointDeleteResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate(args);
  const resolved = toResolvedPhaseLocation(located);

  if (!resolved) {
    return {
      phaseFound: false,
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName,
      phaseDir: located.phaseDir,
      path: null,
      deleted: false,
      reason: located.reason
    };
  }

  const checkpointPath = checkpointPathFor(resolved);
  const absolutePath = resolveBlueprintPath(projectRoot, checkpointPath);

  if (!(await pathExists(absolutePath))) {
    return {
      phaseFound: true,
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      path: checkpointPath,
      deleted: false,
      reason: `${checkpointPath} did not exist.`
    };
  }

  await fs.rm(absolutePath, { force: true });

  return {
    phaseFound: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    path: checkpointPath,
    deleted: true,
    reason: null
  };
}

export const phaseToolDefinitions = [
  {
    name: "blueprint_roadmap_read",
    description:
      "Read the Blueprint roadmap and resolve milestone plus phase inventory without mutating repo state.",
    inputSchema: roadmapReadInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintRoadmapRead(args as RoadmapReadArgs)
  },
  {
    name: "blueprint_phase_locate",
    description:
      "Resolve a Blueprint phase reference to its phase directory and known artifacts.",
    inputSchema: phaseLookupInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseLocate(args as PhaseLookupArgs)
  },
  {
    name: "blueprint_phase_context",
    description:
      "Summarize a Blueprint phase's durable discovery artifacts and requirement mapping.",
    inputSchema: phaseLookupInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseContext(args as PhaseLookupArgs)
  },
  {
    name: "blueprint_phase_research_status",
    description:
      "Report whether a Blueprint phase already has context, research, and UI-spec artifacts.",
    inputSchema: phaseLookupInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseResearchStatus(args as PhaseLookupArgs)
  },
  {
    name: "blueprint_phase_artifact_read",
    description:
      "Read a phase-scoped discovery artifact such as CONTEXT, DISCUSSION-LOG, RESEARCH, or UI-SPEC.",
    inputSchema: phaseArtifactInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseArtifactRead(args as PhaseArtifactReadArgs)
  },
  {
    name: "blueprint_phase_artifact_write",
    description:
      "Persist substantive phase-scoped discovery artifact content with overwrite protection.",
    inputSchema: phaseArtifactWriteInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseArtifactWrite(args as PhaseArtifactWriteArgs)
  },
  {
    name: "blueprint_phase_checkpoint_get",
    description:
      "Read the saved discuss-phase checkpoint for a phase without mutating repo state.",
    inputSchema: phaseLookupInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseCheckpointGet(args as PhaseLookupArgs)
  },
  {
    name: "blueprint_phase_checkpoint_put",
    description:
      "Persist a discuss-phase checkpoint JSON object for a phase.",
    inputSchema: phaseCheckpointPutInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseCheckpointPut(args as PhaseCheckpointPutArgs)
  },
  {
    name: "blueprint_phase_checkpoint_delete",
    description:
      "Delete the saved discuss-phase checkpoint for a phase after successful completion.",
    inputSchema: phaseLookupInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseCheckpointDelete(args as PhaseLookupArgs)
  }
];
