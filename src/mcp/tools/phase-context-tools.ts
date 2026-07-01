import { promises as fs } from "node:fs";

import {
  BLUEPRINT_DIR,
  CODEBASE_ARTIFACTS,
  DURABLE_REQUIREMENT_ID_PATTERN,
  extractMarkdownTableRows,
  canonicalizeResearchHeadingLines,
  inspectBlueprintArtifacts,
  isBootstrapStarterContext,
  resolveBlueprintPath,
  validatePhaseArtifactContent,
  ensureRepoRoot,
  type PhaseArtifactValidationDiagnostic
} from "./artifacts.js";
import { blueprintConfigGet } from "./config.js";
import { phaseArtifactSuggestedRepairs } from "./phase-artifacts.js";
import {
  buildArtifactPath,
  findPhaseArtifact,
  findPhaseValidationArtifact,
  readMarkdownDocument,
  readRoadmap,
  type ParsedRoadmap,
  type PhaseArtifactKind
} from "./phase-locations.js";
import {
  detectStrongExplicitNoUiSignal
} from "./phase-no-ui-signals.js";
import {
  extractMarkdownHeading,
  extractMarkdownSection,
  normalizeTextContent,
  sectionToList,
  summarizeContextPieces,
  summarizeSavedArtifact
} from "./phase-markdown.js";
import { slugToTitle, normalizePhaseNumber } from "./phase-numbering.js";
import { parseCanonicalPlanArtifactPath } from "./phase-plan-identifiers.js";
import {
  locatePhaseFromRoadmap,
  phaseLocateFailureFromError,
  phaseSelectionFromLocate,
  resolvePhaseRuntimeSnapshot
} from "./phase-resolution.js";
import { loadBlueprintState, blueprintStateLoad } from "./state.js";
import type {
  PhaseContextResult,
  PhaseLocateResult,
  PhaseLookupArgs,
  PhasePlanningReadiness,
  PhaseResearchStatusResult
} from "./phase-tool-types.js";
import type { ParsedRoadmapPhase } from "./phase-roadmap-parser.js";

function extractRequirementIdsFromRequirementsTable(section: string): string[] {
  return extractMarkdownTableRows(section)
    .map((row) => row[0]?.trim() ?? "")
    .filter((id) => DURABLE_REQUIREMENT_ID_PATTERN.test(id));
}

async function readPhaseContextGrounding(
  projectRoot: string,
  matchedPhase: ParsedRoadmapPhase | undefined,
  options: {
    stateResult?: Awaited<ReturnType<typeof blueprintStateLoad>>;
    configResult?: Awaited<ReturnType<typeof blueprintConfigGet>>;
  } = {}
): Promise<{
  projectBrief: PhaseContextResult["projectBrief"];
  requirementsGrounding: PhaseContextResult["requirementsGrounding"];
  workflowPosture: PhaseContextResult["workflowPosture"];
}> {
  const projectPath = `${BLUEPRINT_DIR}/PROJECT.md`;
  const requirementsPath = `${BLUEPRINT_DIR}/REQUIREMENTS.md`;
  const statePath = `${BLUEPRINT_DIR}/STATE.md`;
  const [projectContent, requirementsContent, stateResult, configResult] = await Promise.all([
    readMarkdownDocument(projectRoot, projectPath),
    readMarkdownDocument(projectRoot, requirementsPath),
    options.stateResult ?? blueprintStateLoad({ cwd: projectRoot }),
    options.configResult ??
      blueprintConfigGet({
        cwd: projectRoot,
        scope: "effective"
      })
  ]);
  const projectWarnings: string[] = [];
  const requirementsWarnings: string[] = [];
  const workflowWarnings: string[] = [];

  const vision = projectContent ? sectionToList(extractMarkdownSection(projectContent, "Vision")) : [];
  const audience = projectContent ? sectionToList(extractMarkdownSection(projectContent, "Audience")) : [];
  const constraints = projectContent
    ? sectionToList(extractMarkdownSection(projectContent, "Constraints"))
    : [];
  const nonGoals = projectContent ? sectionToList(extractMarkdownSection(projectContent, "Non-Goals")) : [];
  const currentMilestone = projectContent
    ? extractMarkdownSection(projectContent, "Current Milestone") || null
    : null;
  const projectTitle = projectContent ? extractMarkdownHeading(projectContent) : null;

  if (!projectContent) {
    projectWarnings.push(`${projectPath} is missing, so the project brief is unavailable.`);
  } else if (
    vision.length === 0 &&
    audience.length === 0 &&
    constraints.length === 0 &&
    nonGoals.length === 0
  ) {
    projectWarnings.push(`${projectPath} is present but does not yet contain a substantive brief.`);
  }

  const requirementsTable = requirementsContent
    ? extractMarkdownSection(requirementsContent, "Requirements Table")
    : "";
  const traceabilityNotes = requirementsContent
    ? sectionToList(extractMarkdownSection(requirementsContent, "Traceability Notes"))
    : [];
  const acceptanceNotes = requirementsContent
    ? sectionToList(extractMarkdownSection(requirementsContent, "Acceptance Notes"))
    : [];
  const deferredItems = requirementsContent
    ? sectionToList(extractMarkdownSection(requirementsContent, "Deferred Items"))
    : [];
  const canonicalRequirementIds = requirementsContent
    ? extractRequirementIdsFromRequirementsTable(requirementsTable)
    : [];
  const roadmapRequirementIds = matchedPhase?.requirements ?? [];

  if (!requirementsContent) {
    requirementsWarnings.push(`${requirementsPath} is missing, so canonical requirement grounding is unavailable.`);
  } else if (canonicalRequirementIds.length === 0) {
    requirementsWarnings.push(
      `${requirementsPath} is present but does not yet expose canonical requirement identifiers.`
    );
  }

  if (requirementsContent && canonicalRequirementIds.length > 0 && roadmapRequirementIds.length === 0) {
    requirementsWarnings.push(
      "Phase requirements are missing from ROADMAP.md for this phase, so the requirement grounding is only partially linked."
    );
  }

  const projectBriefSummary = summarizeContextPieces(
    [
      projectTitle ? projectTitle.replace(/^Blueprint\s+/, "") : null,
      currentMilestone ? `current milestone: ${currentMilestone}` : null,
      vision[0] ?? null,
      audience[0] ?? null,
      constraints[0] ?? null
    ].filter((piece): piece is string => piece !== null),
    projectContent
      ? "PROJECT.md is present but does not yet provide a reusable project brief."
      : "PROJECT.md is missing."
  );

  const requirementsSummary = summarizeContextPieces(
    [
      canonicalRequirementIds.length > 0
        ? `canonical requirements: ${canonicalRequirementIds.join(", ")}`
        : null,
      roadmapRequirementIds.length > 0
        ? `phase requirements: ${roadmapRequirementIds.join(", ")}`
        : null,
      traceabilityNotes[0] ?? null,
      acceptanceNotes[0] ?? null
    ].filter((piece): piece is string => piece !== null),
    requirementsContent
      ? "REQUIREMENTS.md is present but does not yet provide reusable grounding."
      : "REQUIREMENTS.md is missing."
  );

  const workflow = configResult.config.workflow;
  const researchConfig = configResult.config.research;
  const securePhaseRequired = workflow.code_review && workflow.secure_phase;
  workflowWarnings.push(...configResult.warnings);
  const workflowSummary = summarizeContextPieces(
    [
      stateResult.derivedStatus.projectStatus
        ? `project status: ${stateResult.derivedStatus.projectStatus}`
        : null,
      stateResult.state.currentMilestone
        ? `milestone: ${stateResult.state.currentMilestone}`
        : null,
      stateResult.derivedStatus.currentPhase
        ? `phase: ${stateResult.derivedStatus.currentPhase}`
        : null,
      workflow.discuss_mode ? `discuss_mode: ${workflow.discuss_mode}` : null,
      workflow.research_before_questions
        ? "research_before_questions enabled"
        : "research_before_questions disabled",
      securePhaseRequired
        ? "secure_phase required after code review"
        : workflow.secure_phase
          ? "secure_phase configured but not required because code_review is disabled"
          : "secure_phase disabled",
      `external sources: ${researchConfig.external_sources}`,
      stateResult.derivedStatus.nextAction ? `next action: ${stateResult.derivedStatus.nextAction}` : null
    ].filter((piece): piece is string => piece !== null),
    "Workflow posture is unavailable."
  );

  return {
    projectBrief: {
      found: projectContent !== null,
      path: projectContent ? projectPath : null,
      title: projectTitle,
      summary: projectBriefSummary,
      vision,
      audience,
      constraints,
      currentMilestone,
      nonGoals,
      warnings: projectWarnings
    },
    requirementsGrounding: {
      found: requirementsContent !== null,
      path: requirementsContent ? requirementsPath : null,
      canonicalRequirementIds,
      roadmapRequirementIds,
      traceabilityNotes,
      acceptanceNotes,
      deferredItems,
      summary: requirementsSummary,
      warnings: requirementsWarnings
    },
    workflowPosture: {
      path: statePath,
      projectStatus: stateResult.derivedStatus.projectStatus,
      currentMilestone: stateResult.state.currentMilestone,
      currentPhase: stateResult.derivedStatus.currentPhase,
      activeCommand: stateResult.state.activeCommand,
      nextAction: stateResult.derivedStatus.nextAction,
      blockers: stateResult.blockers,
      workflow: {
        research: workflow.research,
        planCheck: workflow.plan_check,
        verifier: workflow.verifier,
        nyquistValidation: workflow.nyquist_validation,
        uiPhase: workflow.ui_phase,
        uiSafetyGate: workflow.ui_safety_gate,
        codeReview: workflow.code_review,
        securePhase: workflow.secure_phase,
        securePhaseRequired,
        autoAdvance: workflow.auto_advance,
        researchBeforeQuestions: workflow.research_before_questions,
        discussMode: workflow.discuss_mode,
        useWorktrees: workflow.use_worktrees
      },
      research: {
        externalSources: researchConfig.external_sources
      },
      summary: workflowSummary,
      warnings: workflowWarnings
    }
  };
}

async function readMappedCodebaseContext(
  projectRoot: string
): Promise<PhaseContextResult["codebase"]> {
  const inspection = await inspectBlueprintArtifacts(projectRoot);
  const artifacts: string[] = [];
  const missingArtifacts: string[] = [];
  const invalidArtifacts = new Set(inspection.codebase.invalid);
  const digest: PhaseContextResult["codebase"]["digest"] = [];

  for (const artifact of CODEBASE_ARTIFACTS) {
    if (invalidArtifacts.has(artifact)) {
      continue;
    }

    const absolutePath = resolveBlueprintPath(projectRoot, artifact);

    try {
      const raw = await fs.readFile(absolutePath, "utf8");
      const summary = summarizeSavedArtifact(raw);
      artifacts.push(artifact);
      digest.push({
        artifact,
        title: summary.title,
        summary: summary.summary
      });
    } catch (error) {
      const missing =
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT";

      if (missing) {
        missingArtifacts.push(artifact);
        continue;
      }

      throw error;
    }
  }

  const mapped = inspection.codebase.mapped;
  const warnings: string[] = [];

  if (artifacts.length > 0 && !mapped) {
    const missingBit = missingArtifacts.length > 0 ? `missing ${missingArtifacts.join(", ")}` : "";
    const invalidBit =
      inspection.codebase.invalid.length > 0
        ? `invalid ${inspection.codebase.invalid.join(", ")}`
        : "";
    warnings.push(
      `Mapped codebase bundle is incomplete or non-canonical: ${[missingBit, invalidBit]
        .filter((value) => value.length > 0)
        .join("; ")}.`
    );
  }

  if (mapped) {
    warnings.push(
      "Mapped codebase summaries are available and should be reused before rereading broad repo surfaces."
    );
  } else if (inspection.codebase.invalid.length > 0) {
    warnings.push(
      "Saved codebase docs exist but are not yet valid enough to reuse as authoritative mapped context."
    );
  }

  return {
    mapped,
    artifacts,
    missingArtifacts,
    digest,
    warnings
  };
}

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

async function evaluatePhaseArtifactUsability(
  projectRoot: string,
  artifactPath: string | null,
  artifact: PhaseArtifactKind
): Promise<PhaseArtifactUsability> {
  if (!artifactPath) {
    return {
      present: false,
      valid: null,
      usable: false,
      content: null,
      issues: [],
      diagnostics: [],
      warnings: [],
      unreadable: false
    };
  }

  const absolutePath = resolveBlueprintPath(projectRoot, artifactPath);

  try {
    const raw = await fs.readFile(absolutePath, "utf8");
    const validation = validatePhaseArtifactContent(raw, artifact);
    const bootstrapStarter = artifact === "context" && isBootstrapStarterContext(raw);
    const issues = [...validation.issues];
    const diagnostics = [...validation.diagnostics];
    const warnings = [...validation.warnings];

    if (bootstrapStarter) {
      const issue =
        "Context artifact is still the bootstrap starter and must be replaced through /blu-discuss-phase before planning.";
      issues.push(issue);
      diagnostics.push({
        path: artifactPath,
        code: "context.bootstrap_starter",
        message: issue,
        repair: `Replace ${artifactPath} through /blu-discuss-phase before planning.`,
        retryable: true,
        nextTool: "blueprint_phase_research_status"
      });
      warnings.push(
        `${artifactPath} is still the bootstrap starter context; replace it through /blu-discuss-phase before planning.`
      );
    }

    return {
      present: true,
      valid: validation.valid,
      usable: validation.valid && !bootstrapStarter,
      content: raw,
      issues,
      diagnostics,
      warnings,
      unreadable: false
    };
  } catch (error) {
    const reason =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "unknown read failure";

    return {
      present: true,
      valid: false,
      usable: false,
      content: null,
      issues: [`${artifactPath} could not be read: ${reason}.`],
      diagnostics: [
        {
          path: artifactPath,
          code: `${artifact}.unreadable`,
          message: `${artifactPath} could not be read: ${reason}.`,
          repair: `Restore or regenerate ${artifactPath}, then retry the readiness check.`,
          retryable: true,
          nextTool: "blueprint_phase_research_status"
        }
      ],
      warnings: [`${artifactPath} is stale, deleted, or unreadable: ${reason}.`],
      unreadable: true
    };
  }
}

export function buildPhasePlanningReadiness(args: {
  context: PhaseContextResult;
  contextStatus: PhaseArtifactUsability;
  researchPath: string | null;
  researchValid: boolean | null;
  uiSpecStatus: PhaseArtifactUsability;
  noUiSignalDetected: boolean;
}): PhasePlanningReadiness {
  const phaseNumber = args.context.phase?.phaseNumber ?? null;
  const workflow = args.context.workflowPosture.workflow;
  const phaseSuffix = phaseNumber ? ` ${phaseNumber}` : "";
  const progressAction = "Run /blu-progress to review the next safe Blueprint action";

  if (!phaseNumber) {
    return {
      workflowResearchRequired: workflow.research,
      workflowUiPhaseRequired: workflow.uiPhase,
      workflowUiSafetyGateEnabled: workflow.uiSafetyGate,
      readyForPlanPhase: false,
      nextSafeAction: progressAction,
      blockers: ["Phase planning readiness could not be resolved because the phase was not found."]
    };
  }

  if (!args.contextStatus.usable) {
    const contextIssueBlockers = args.contextStatus.issues.map((issue) => `Context validation: ${issue}`);

    return {
      workflowResearchRequired: workflow.research,
      workflowUiPhaseRequired: workflow.uiPhase,
      workflowUiSafetyGateEnabled: workflow.uiSafetyGate,
      readyForPlanPhase: false,
      nextSafeAction: `Run /blu-discuss-phase${phaseSuffix} to rebuild the current phase context`,
      blockers: [
        args.contextStatus.present
          ? "Saved phase context exists but is not usable for planning."
          : "Phase planning requires a usable XX-CONTEXT.md artifact.",
        ...contextIssueBlockers
      ],
      ...(args.contextStatus.diagnostics.length > 0
        ? { diagnostics: args.contextStatus.diagnostics }
        : {})
    };
  }

  if (workflow.research && args.researchValid !== true) {
    return {
      workflowResearchRequired: workflow.research,
      workflowUiPhaseRequired: workflow.uiPhase,
      workflowUiSafetyGateEnabled: workflow.uiSafetyGate,
      readyForPlanPhase: false,
      nextSafeAction: args.researchPath
        ? `Run /blu-research-phase${phaseSuffix} to repair invalid phase research`
        : `Run /blu-research-phase${phaseSuffix} to capture phase research`,
      blockers: [
        args.researchPath
          ? "workflow.research=true but the saved XX-RESEARCH.md artifact is not usable."
          : "workflow.research=true but no XX-RESEARCH.md artifact is saved."
      ]
    };
  }

  const bypassMissingUiSpec =
    workflow.uiPhase &&
    !workflow.uiSafetyGate &&
    !args.uiSpecStatus.present &&
    args.noUiSignalDetected;

  if (bypassMissingUiSpec) {
    return {
      workflowResearchRequired: workflow.research,
      workflowUiPhaseRequired: workflow.uiPhase,
      workflowUiSafetyGateEnabled: workflow.uiSafetyGate,
      readyForPlanPhase: true,
      nextSafeAction: `Run /blu-plan-phase${phaseSuffix} to create execution-ready phase plans`,
      blockers: []
    };
  }

  if (workflow.uiPhase && !args.uiSpecStatus.usable) {
    const uiSpecIssueBlockers = args.uiSpecStatus.issues.map((issue) => `UI spec validation: ${issue}`);
    const nextSafeAction = args.uiSpecStatus.present
      ? `Run /blu-ui-phase${phaseSuffix} to repair the phase UI contract`
      : args.noUiSignalDetected
        ? `Run /blu-ui-phase${phaseSuffix} to record the explicit UI skip rationale`
        : `Run /blu-ui-phase${phaseSuffix} to draft the phase UI contract`;

    return {
      workflowResearchRequired: workflow.research,
      workflowUiPhaseRequired: workflow.uiPhase,
      workflowUiSafetyGateEnabled: workflow.uiSafetyGate,
      readyForPlanPhase: false,
      nextSafeAction,
      blockers: [
        args.uiSpecStatus.present
          ? "workflow.ui_phase=true but the saved XX-UI-SPEC.md artifact is not usable."
          : "workflow.ui_phase=true but no XX-UI-SPEC.md artifact is saved.",
        ...uiSpecIssueBlockers
      ],
      ...(args.uiSpecStatus.diagnostics.length > 0
        ? { diagnostics: args.uiSpecStatus.diagnostics }
        : {})
    };
  }

  return {
    workflowResearchRequired: workflow.research,
    workflowUiPhaseRequired: workflow.uiPhase,
    workflowUiSafetyGateEnabled: workflow.uiSafetyGate,
    readyForPlanPhase: true,
    nextSafeAction: `Run /blu-plan-phase${phaseSuffix} to create execution-ready phase plans`,
    blockers: []
  };
}

function isCanonicalPhasePlanArtifactPath(
  artifactPath: string,
  resolved: Pick<NonNullable<PhaseContextResult["phase"]>, "phaseDir" | "phasePrefix">
): boolean {
  return parseCanonicalPlanArtifactPath(artifactPath, resolved) !== null;
}

export async function blueprintPhaseLocate(
  args: PhaseLookupArgs = {}
): Promise<PhaseLocateResult> {
  return (await resolvePhaseRuntimeSnapshot(args)).located;
}

export async function blueprintPhaseContext(
  args: PhaseLookupArgs = {}
): Promise<PhaseContextResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);

  return buildPhaseContext(projectRoot, args);
}

export async function buildPhaseContext(
  projectRoot: string,
  args: PhaseLookupArgs = {}
): Promise<PhaseContextResult> {
  const roadmapResultPromise: Promise<
    { ok: true; roadmap: ParsedRoadmap } | { ok: false; failure: PhaseLocateResult }
  > = readRoadmap(projectRoot)
    .then((roadmap) => ({
      ok: true as const,
      roadmap
    }))
    .catch((error) => ({
      ok: false as const,
      failure: phaseLocateFailureFromError(error)
    }));
  const [roadmapResult, state, rawState, config, codebase] = await Promise.all([
    roadmapResultPromise,
    blueprintStateLoad({ cwd: projectRoot }),
    loadBlueprintState(projectRoot),
    blueprintConfigGet({
      cwd: projectRoot,
      scope: "effective"
    }),
    readMappedCodebaseContext(projectRoot)
  ]);
  if (!roadmapResult.ok) {
    const phaseSelection = phaseSelectionFromLocate(roadmapResult.failure);
    const grounding = await readPhaseContextGrounding(projectRoot, undefined, {
      stateResult: state,
      configResult: config
    });

    return {
      phaseSelection,
      phase: null,
      projectBrief: grounding.projectBrief,
      requirementsGrounding: grounding.requirementsGrounding,
      workflowPosture: grounding.workflowPosture,
      codebase,
      requirements: [],
      missingArtifacts: [],
      warnings: roadmapResult.failure.reason ? [roadmapResult.failure.reason] : []
    };
  }
  const roadmap = roadmapResult.roadmap;
  const located = await locatePhaseFromRoadmap(projectRoot, args, roadmap, {
    stateCurrentPhase: rawState.currentPhase
  });
  const phaseSelection = phaseSelectionFromLocate(located);
  const locatedPhaseNumber =
    located.phaseNumber === null ? null : normalizePhaseNumber(located.phaseNumber);
  const matchedPhase = roadmap.phases.find(
    (phase) =>
      locatedPhaseNumber !== null &&
      normalizePhaseNumber(phase.phaseNumber) === locatedPhaseNumber
  );
  const grounding = await readPhaseContextGrounding(projectRoot, matchedPhase, {
    stateResult: state,
    configResult: config
  });

  if (!located.found || !located.phaseNumber || !located.phasePrefix || !located.phaseDir) {
    return {
      phaseSelection,
      phase: null,
      projectBrief: grounding.projectBrief,
      requirementsGrounding: grounding.requirementsGrounding,
      workflowPosture: grounding.workflowPosture,
      codebase,
      requirements: [],
      missingArtifacts: [],
      warnings: located.reason ? [located.reason] : []
    };
  }

  const artifacts = located.artifacts;
  const locatedPath = {
    phaseDir: located.phaseDir,
    phasePrefix: located.phasePrefix
  };
  const contextPath = buildArtifactPath(located.phaseDir, located.phasePrefix, "-CONTEXT.md");
  const researchPath = buildArtifactPath(located.phaseDir, located.phasePrefix, "-RESEARCH.md");
  const uiSpecPath = buildArtifactPath(located.phaseDir, located.phasePrefix, "-UI-SPEC.md");
  const contextArtifact = findPhaseArtifact(artifacts, locatedPath, "context");
  const discussionLogArtifact = findPhaseArtifact(artifacts, locatedPath, "discussion-log");
  const researchArtifact = findPhaseArtifact(artifacts, locatedPath, "research");
  const specArtifact = findPhaseArtifact(artifacts, locatedPath, "spec");
  const uiSpecArtifact = findPhaseArtifact(artifacts, locatedPath, "ui-spec");
  const verificationArtifact = findPhaseValidationArtifact(artifacts, locatedPath, "verification");
  const uatArtifact = findPhaseValidationArtifact(artifacts, locatedPath, "uat");

  return {
    phaseSelection,
    phase: {
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName ?? matchedPhase?.phaseName ?? slugToTitle(located.phaseDir),
      phaseDir: located.phaseDir,
      roadmap: {
        completed: matchedPhase?.completed ?? false,
        summary: matchedPhase?.summary ?? null,
        goal: matchedPhase?.goal ?? null,
        successCriteria: matchedPhase?.successCriteria ?? null
      },
      artifacts: {
        all: artifacts,
        context: contextArtifact,
        discussionLog: discussionLogArtifact,
        research: researchArtifact,
        spec: specArtifact,
        uiSpec: uiSpecArtifact,
        verification: verificationArtifact,
        uat: uatArtifact,
        plans: artifacts.filter((artifact) => isCanonicalPhasePlanArtifactPath(artifact, locatedPath)),
        summaries: artifacts.filter((artifact) => artifact.endsWith("-SUMMARY.md"))
      }
    },
    projectBrief: grounding.projectBrief,
    requirementsGrounding: {
      ...grounding.requirementsGrounding,
      roadmapRequirementIds: matchedPhase?.requirements ?? grounding.requirementsGrounding.roadmapRequirementIds,
      summary: grounding.requirementsGrounding.summary
    },
    workflowPosture: {
      ...grounding.workflowPosture,
      currentPhase: state.derivedStatus.currentPhase ?? grounding.workflowPosture.currentPhase,
      currentMilestone: state.state.currentMilestone ?? grounding.workflowPosture.currentMilestone,
      nextAction: state.derivedStatus.nextAction || grounding.workflowPosture.nextAction,
      blockers: state.blockers.length > 0 ? state.blockers : grounding.workflowPosture.blockers,
      summary: grounding.workflowPosture.summary
    },
    codebase,
    requirements: matchedPhase?.requirements ?? [],
    missingArtifacts: [contextPath, researchPath, uiSpecPath].filter(
      (artifact) => !artifacts.includes(artifact)
    ),
    warnings: [
      ...(!contextArtifact
        ? ["Research quality will be limited until XX-CONTEXT.md exists."]
        : []),
      ...codebase.warnings,
      ...(matchedPhase && matchedPhase.requirements.length === 0
        ? ["Phase requirements are missing from ROADMAP.md for this phase."]
        : [])
    ]
  };
}

export async function blueprintPhaseResearchStatus(
  args: PhaseLookupArgs = {}
): Promise<PhaseResearchStatusResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const context = await buildPhaseContext(projectRoot, args);

  return buildPhaseResearchStatusFromContext(projectRoot, context);
}

export async function buildPhaseResearchStatusFromContext(
  projectRoot: string,
  context: PhaseContextResult
): Promise<PhaseResearchStatusResult> {
  const artifacts = context.phase?.artifacts;
  const contextStatus = await evaluatePhaseArtifactUsability(
    projectRoot,
    artifacts?.context ?? null,
    "context"
  );
  const uiSpecStatus = await evaluatePhaseArtifactUsability(
    projectRoot,
    artifacts?.uiSpec ?? null,
    "ui-spec"
  );
  const researchPath = artifacts?.research ?? null;
  let researchValid: boolean | null = null;
  let researchIssues: string[] = [];
  let researchDiagnostics: PhaseArtifactValidationDiagnostic[] = [];
  const warnings = [...context.warnings, ...contextStatus.warnings, ...uiSpecStatus.warnings];

  if (researchPath) {
    const absolutePath = resolveBlueprintPath(projectRoot, researchPath);
    try {
      const raw = await fs.readFile(absolutePath, "utf8");
      const validation = validatePhaseArtifactContent(
        canonicalizeResearchHeadingLines(normalizeTextContent(raw)),
        "research"
      );

      researchValid = validation.valid;
      researchIssues = validation.issues;
      researchDiagnostics = validation.diagnostics;
      warnings.push(...validation.warnings);
    } catch (error) {
      researchValid = false;
      const reason =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "unknown read failure";

      researchIssues = [
        `Research artifact at ${researchPath} could not be read: ${reason}.`
      ];
      researchDiagnostics = [
        {
          path: researchPath,
          code: "research.unreadable",
          message: `Research artifact at ${researchPath} could not be read: ${reason}.`,
          repair: `Restore or regenerate ${researchPath} with /blu-research-phase before planning.`,
          retryable: true,
          nextTool: "blueprint_phase_research_status"
        }
      ];
      warnings.push(
        `Research artifact at ${researchPath} is stale, deleted, or unreadable: ${reason}.`
      );
    }
  }

  const suggestedRepairs: string[] = [];
  const bootstrapStarterContext = contextStatus.diagnostics.some(
    (diagnostic) => diagnostic.code === "context.bootstrap_starter"
  );

  if (contextStatus.issues.length > 0) {
    suggestedRepairs.push(
      contextStatus.unreadable
        ? `Restore or regenerate ${artifacts?.context} with /blu-discuss-phase before planning.`
        : bootstrapStarterContext
          ? "Replace the bootstrap starter context through /blu-discuss-phase before planning."
          : "Update the phase context through /blu-discuss-phase so it matches the required context schema before planning."
    );
  }

  if (researchIssues.length > 0) {
    suggestedRepairs.push(...phaseArtifactSuggestedRepairs("research", researchDiagnostics));
  }

  if (uiSpecStatus.issues.length > 0) {
    suggestedRepairs.push(
      uiSpecStatus.unreadable
        ? `Restore or regenerate ${artifacts?.uiSpec} with /blu-ui-phase before planning.`
        : "Update the phase UI spec through /blu-ui-phase so it provides a usable contract or explicit skip rationale before planning."
    );
  }

  const noUiBypassSignal = detectStrongExplicitNoUiSignal({
    contextContent: contextStatus.content
  });

  const planningReadiness = buildPhasePlanningReadiness({
    context,
    contextStatus,
    researchPath,
    researchValid,
    uiSpecStatus,
    noUiSignalDetected: noUiBypassSignal.bypassAllowed
  });

  return {
    hasContext: contextStatus.present,
    hasResearch: Boolean(artifacts?.research),
    hasUiSpec: uiSpecStatus.present,
    hasUsableContext: contextStatus.usable,
    hasUsableResearch: researchValid === true,
    hasUsableUiSpec: uiSpecStatus.usable,
    contextPath: artifacts?.context ?? null,
    researchPath,
    uiSpecPath: artifacts?.uiSpec ?? null,
    contextValid: contextStatus.valid,
    contextIssues: contextStatus.issues,
    contextDiagnostics: contextStatus.diagnostics,
    researchValid,
    researchIssues,
    researchDiagnostics,
    uiSpecValid: uiSpecStatus.valid,
    uiSpecIssues: uiSpecStatus.issues,
    uiSpecDiagnostics: uiSpecStatus.diagnostics,
    suggestedRepairs: [...new Set(suggestedRepairs)],
    planningReadiness,
    warnings
  };
}
