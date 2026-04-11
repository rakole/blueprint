import { promises as fs } from "node:fs";
import path from "node:path";

import * as z from "zod/v4";

import {
  BLUEPRINT_DIR,
  BLUEPRINT_PHASES_PATH,
  ensureRepoRoot,
  validateResearchArtifactContent,
  writeTextFile,
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

type PhaseArtifactWriteArgs = {
  cwd?: string;
  phase?: string;
  artifactKind?: "RESEARCH";
  content?: string;
  overwrite?: boolean;
  validationMode?: "strict" | "warn";
};

type PhaseArtifactWriteResult = {
  status: "created" | "updated" | "reused" | "invalid" | "blocked";
  phase: {
    phaseNumber: string | null;
    phasePrefix: string | null;
    phaseName: string | null;
    phaseDir: string | null;
    resolvedFrom: "explicit" | "state" | "roadmap";
  };
  artifactKind: "RESEARCH";
  artifactPath: string | null;
  reason: string | null;
  validation: {
    valid: boolean;
    issues: string[];
    warnings: string[];
    suggestedRepairs: string[];
  };
  warnings: string[];
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

const roadmapReadInputSchema = {
  cwd: z.string().optional()
};

const phaseLookupInputSchema = {
  cwd: z.string().optional(),
  phase: z.string().optional()
};
const phaseArtifactWriteInputSchema = {
  cwd: z.string().optional(),
  phase: z.string().optional(),
  artifactKind: z.enum(["RESEARCH"]).optional(),
  content: z.string().optional(),
  overwrite: z.boolean().optional(),
  validationMode: z.enum(["strict", "warn"]).optional()
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

  if (researchPath && args.cwd) {
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

export async function blueprintPhaseArtifactWrite(
  args: PhaseArtifactWriteArgs = {}
): Promise<PhaseArtifactWriteResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const artifactKind = args.artifactKind ?? "RESEARCH";
  const located = await blueprintPhaseLocate({
    cwd: projectRoot,
    phase: args.phase
  });

  if (!located.found || !located.phaseDir || !located.phasePrefix) {
    return {
      status: "blocked",
      phase: {
        phaseNumber: located.phaseNumber,
        phasePrefix: located.phasePrefix,
        phaseName: located.phaseName,
        phaseDir: located.phaseDir,
        resolvedFrom: located.resolvedFrom
      },
      artifactKind,
      artifactPath: null,
      reason: located.reason,
      validation: {
        valid: false,
        issues: located.reason ? [located.reason] : [],
        warnings: located.warnings,
        suggestedRepairs: located.recovery
      },
      warnings: located.warnings
    };
  }

  const content = args.content?.trim() ?? "";

  if (content.length === 0) {
    return {
      status: "invalid",
      phase: {
        phaseNumber: located.phaseNumber,
        phasePrefix: located.phasePrefix,
        phaseName: located.phaseName,
        phaseDir: located.phaseDir,
        resolvedFrom: located.resolvedFrom
      },
      artifactKind,
      artifactPath: null,
      reason: "Research content cannot be blank.",
      validation: {
        valid: false,
        issues: ["Research content cannot be blank."],
        warnings: [],
        suggestedRepairs: ["Provide populated research content with the required sections before writing."]
      },
      warnings: []
    };
  }

  const validation = validateResearchArtifactContent(content);
  const artifactPath = buildArtifactPath(located.phaseDir, located.phasePrefix, "-RESEARCH.md");
  const absolutePath = resolveBlueprintPath(projectRoot, artifactPath);
  const exists = await pathExists(absolutePath);
  const shouldBlock = !validation.valid && (args.validationMode ?? "strict") === "strict";

  if (shouldBlock) {
    return {
      status: "invalid",
      phase: {
        phaseNumber: located.phaseNumber,
        phasePrefix: located.phasePrefix,
        phaseName: located.phaseName,
        phaseDir: located.phaseDir,
        resolvedFrom: located.resolvedFrom
      },
      artifactKind,
      artifactPath,
      reason: "Research content failed validation.",
      validation: {
        valid: validation.valid,
        issues: validation.issues,
        warnings: validation.warnings,
        suggestedRepairs: [
          "Add the required research sections, confidence marker, and at least one cited source before retrying."
        ]
      },
      warnings: []
    };
  }

  if (exists && !args.overwrite) {
    return {
      status: "reused",
      phase: {
        phaseNumber: located.phaseNumber,
        phasePrefix: located.phasePrefix,
        phaseName: located.phaseName,
        phaseDir: located.phaseDir,
        resolvedFrom: located.resolvedFrom
      },
      artifactKind,
      artifactPath,
      reason: null,
      validation: {
        valid: validation.valid,
        issues: validation.issues,
        warnings: validation.warnings,
        suggestedRepairs: []
      },
      warnings: [
        "Preserved existing phase research. Pass overwrite=true only after an explicit update decision."
      ]
    };
  }

  await writeTextFile(absolutePath, `${content.replace(/\s+$/, "")}\n`);

  return {
    status: exists ? "updated" : "created",
    phase: {
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName,
      phaseDir: located.phaseDir,
      resolvedFrom: located.resolvedFrom
    },
    artifactKind,
    artifactPath,
    reason: null,
    validation: {
      valid: validation.valid,
      issues: validation.issues,
      warnings: validation.warnings,
      suggestedRepairs: []
    },
    warnings: validation.warnings
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
    name: "blueprint_phase_artifact_write",
    description:
      "Write validated phase-scoped research content into the selected Blueprint phase artifact.",
    inputSchema: phaseArtifactWriteInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseArtifactWrite(args as PhaseArtifactWriteArgs)
  }
];
