import { promises as fs } from "node:fs";
import path from "node:path";

import * as z from "zod/v4";

import {
  BOOTSTRAP_STARTER_CONTEXT_MARKER,
  BLUEPRINT_DIR,
  DURABLE_REQUIREMENT_ID_PATTERN,
  SCAFFOLD_GENERATED_MARKER,
  artifactToolDefinitions,
  blueprintArtifactScaffold,
  buildDefaultBootstrapSeed,
  ensureRepoRoot,
  getBlueprintRoot,
  inspectBlueprintArtifacts,
  inspectBootstrapArtifacts,
  resolveBlueprintPath,
  type BootstrapArtifactDiagnostics,
  type BootstrapAssessment,
  type NormalizedBootstrapSeed,
  type BootstrapSeed,
  writeTextFile
} from "./artifacts.js";
import {
  formatBlueprintPhasePrefix,
  normalizeBlueprintPhaseRef,
  safeJsonParseObject
} from "../../shared/security.js";
import {
  configToolDefinitions,
  blueprintConfigGet,
  seedProjectConfig
} from "./config.js";
import {
  buildBlueprintPhaseDirectoryPath,
  phaseToolDefinitions
} from "./phase.js";
import {
  stateToolDefinitions,
  blueprintStateLoad,
  blueprintStateUpdate
} from "./state.js";
import { reviewToolDefinitions } from "./review.js";
import { impactToolDefinitions } from "./impact.js";
import { updateToolDefinitions } from "./update.js";
import { workspaceToolDefinitions } from "./workspace.js";
import {
  resolveBlueprintSkillPath,
  type BlueprintInternalToolName
} from "../runtime-vocabulary.js";
import {
  blueprintDirectCommand,
  blueprintDirectCommandAliases,
  blueprintPrimaryManifestPath,
  blueprintRootCommand,
  blueprintRouterCommand,
  blueprintRunCommand,
  blueprintRunDirectCommand
} from "../command-paths.js";
import { resolveAvailableOptionalAgents } from "../agent-definition.js";
import {
  getRuntimeOwnedCommandMetadata,
  listRuntimeOwnedCommandMetadata,
  type RuntimeOwnedCommandMetadata
} from "../command-runtime-metadata.js";

type CommandStatus = "planned" | "implemented" | "blocked" | "repairing";

type CommandCatalogEntry = {
  command: string;
  route: string;
  wave: number;
  family: string;
  risk: string;
  primarySkill: string;
  declaredStatus: CommandStatus;
  status: CommandStatus;
  implemented: boolean;
  blockedBy: string[];
  manifestPath: string | null;
  skillPath: string | null;
  specPath: string | null;
  requiredTools: string[];
  requiredToolsSatisfied: boolean;
  optionalAgents: string[];
  availableOptionalAgents: string[];
};

type CommandCatalogResult = {
  commands: Record<string, CommandCatalogEntry>;
  waves: Record<string, string[]>;
  aliases: Record<string, string[]>;
};

type ProjectInitArgs = {
  cwd?: string;
  defaultsPath?: string;
  overwrite?: boolean;
  projectName?: string;
  bootstrapMode?: "interactive" | "auto";
  bootstrapSeed?: BootstrapSeed;
};

type ProjectInitSuccessResult = {
  projectRoot: string;
  status?: never;
  written?: never;
  issues?: never;
  diagnostics?: never;
  suggestedRepairs?: never;
  createdPaths: string[];
  seededState: {
    updatedFields: string[];
    statePath: string;
  };
  configPath: string;
  configProvenance: {
    layersApplied: string[];
    defaultsPath: string | null;
    projectPath: string | null;
    defaultsApplied: boolean;
    projectApplied: boolean;
  };
  brownfield: BootstrapAssessment;
  bootstrapDiagnostics: BootstrapArtifactDiagnostics;
  nextAction: string;
  warnings: string[];
};

type ProjectInitDiagnostic = {
  path: string;
  code: string;
  message: string;
  repair: string;
  retryable: boolean;
  allowedValues?: string[];
  argsPatch?: unknown;
};

type ProjectInitInvalidResult = {
  projectRoot: string;
  status: "invalid";
  written: false;
  issues: string[];
  diagnostics: ProjectInitDiagnostic[];
  suggestedRepairs: string[];
};

type ProjectInitResult = ProjectInitSuccessResult | ProjectInitInvalidResult;

type ProjectStatusArgs = {
  cwd?: string;
};

type ProjectStatusResult = {
  status: "uninitialized" | "mapping-incomplete" | "mapped-only" | "partial" | "initialized";
  initialized: boolean;
  currentPhase: string | null;
  currentMilestone: string | null;
  nextAction: string;
  bootstrap: {
    repoShape: BootstrapAssessment["repoShape"];
    brownfieldDetected: boolean;
    codebaseMapped: boolean;
    placeholderArtifacts: string[];
    traceabilityWarnings: string[];
    recommendedNextAction: string;
  };
  health: {
    missingArtifacts: string[];
    warnings: string[];
  };
};

const commandCatalogInputSchema = {};
const projectInitInputSchema = {
  cwd: z.string().optional(),
  defaultsPath: z.string().optional(),
  overwrite: z.boolean().optional(),
  projectName: z.string().optional(),
  bootstrapMode: z.enum(["interactive", "auto"]).optional(),
  bootstrapSeed: z
    .object({
      vision: z.string().optional(),
      audience: z
        .object({
          primary: z.array(z.string()).optional(),
          secondary: z.array(z.string()).optional()
        })
        .optional(),
      constraints: z.array(z.string()).optional(),
      currentMilestone: z.string().optional(),
      nonGoals: z.array(z.string()).optional(),
      requirements: z
        .array(
          z.object({
            id: z
              .string()
              .trim()
              .min(1)
              .refine((value) => DURABLE_REQUIREMENT_ID_PATTERN.test(value), {
                message:
                  "Requirement IDs must use a durable format like RQ-01 or BP-03."
              }),
            scope: z.enum(["committed", "deferred", "out_of_scope"]).optional(),
            group: z.string().optional(),
            requirement: z.string(),
            status: z.string(),
            notes: z.string()
          })
        )
        .optional(),
      roadmapPhases: z
        .array(
          z.object({
            phase: z.string(),
            title: z.string(),
            status: z.enum(["planned", "in_progress", "done"]).optional(),
            objective: z.string(),
            requirementIds: z.array(z.string()).optional(),
            successCriteria: z.array(z.string()).optional(),
            notes: z.array(z.string()).optional()
          })
        )
        .optional(),
      brownfieldMode: z.enum(["greenfield", "scaffold-only", "brownfield"]).optional(),
      assumptions: z.array(z.string()).optional()
    })
    .optional()
};
const projectStatusInputSchema = {
  cwd: z.string().optional()
};

const COMMAND_SPEC_PREFIX = "docs/commands";
const DOCLESS_FALLBACK_CATALOG_ROWS = [
  {
    commandName: "do",
    wave: 3,
    family: "Capture And Lightweight Execution",
    primarySkill: "blueprint-router",
    declaredStatus: "planned",
    risk: "Low: routing only."
  }
] as const satisfies readonly ParsedCatalogRow[];
const PROJECT_TOOL_NAMES = [
  "blueprint_command_catalog",
  "blueprint_project_init",
  "blueprint_project_status"
 ] as const satisfies readonly BlueprintInternalToolName[];
const AVAILABLE_TOOL_NAMES = new Set([
  ...PROJECT_TOOL_NAMES,
  ...configToolDefinitions.map((definition) => definition.name),
  ...stateToolDefinitions.map((definition) => definition.name),
  ...phaseToolDefinitions.map((definition) => definition.name),
  ...reviewToolDefinitions.map((definition) => definition.name),
  ...artifactToolDefinitions.map((definition) => definition.name),
  ...impactToolDefinitions.map((definition) => definition.name),
  ...updateToolDefinitions.map((definition) => definition.name),
  ...workspaceToolDefinitions.map((definition) => definition.name)
]);
function bundledUrl(relativePath: string): URL {
  const rootDepth = import.meta.url.includes("/dist/mcp/") ? "../../" : "../../../";

  return new URL(`${rootDepth}${relativePath}`, import.meta.url);
}

function renderBootstrapPhaseContext(args: {
  phaseNumber: string;
  phasePrefix: string;
  phaseTitle: string;
  milestone: string;
  objective: string;
  requirementIds: string[];
  successCriteria: string[];
}): string {
  const requirementSummary =
    args.requirementIds.length > 0 ? args.requirementIds.join(", ") : "none recorded yet";
  const successCriteriaSummary =
    args.successCriteria.length > 0
      ? args.successCriteria.join("; ")
      : "Replace this starter context with authored discovery outcomes through /blu-discuss-phase.";

  return `# Phase ${args.phasePrefix}: ${args.phaseTitle} - Context

## Phase Boundary

- This starter context was seeded during /blu-new-project for Phase ${args.phaseNumber}.
- The current roadmap goal is ${args.objective}.
- The phase is presently grounded in roadmap requirements ${requirementSummary}.
- Replace this starter with authored discovery boundaries through ${blueprintDirectCommand("discuss-phase")} ${args.phaseNumber} before planning continues.

## Discovery Grounding

- Project bootstrap artifacts exist at .blueprint/PROJECT.md, .blueprint/REQUIREMENTS.md, and .blueprint/ROADMAP.md.
- The active milestone recorded during bootstrap is ${args.milestone}.
- ROADMAP.md currently names this phase as ${args.phaseTitle}.
- Current success criteria captured for the phase: ${successCriteriaSummary}.

## Implementation Decisions

- Discovery context remains phase-scoped under .blueprint/phases/ rather than repo-root CONTEXT.md.
- Subsequent lifecycle commands should wait for authored discuss-phase output before treating this starter as complete.
- Bootstrap owns this starter context so phase discovery can resolve the first roadmap phase immediately.

## Specific Ideas

- Use ${blueprintDirectCommand("discuss-phase")} ${args.phaseNumber} to replace this starter with concrete scope, constraints, and decisions.
- Confirm whether the roadmap objective needs refinement before plan-phase begins.
- Capture durable delivery ideas in the authored context instead of leaving them only in ROADMAP.md.

## Existing Code Insights

- No repo-specific codebase insight has been authored for this fresh bootstrap yet.
- Treat ROADMAP.md and REQUIREMENTS.md as the current grounded sources for this phase.
- Add concrete code or system notes during ${blueprintDirectCommand("discuss-phase")} ${args.phaseNumber} when evidence exists.

## Dependencies

- Prior phase artifacts: none.
- External constraints: bootstrap should stay within implemented Blueprint command surfaces.
- Required follow-up reads: .blueprint/PROJECT.md, .blueprint/REQUIREMENTS.md, and .blueprint/ROADMAP.md.

## Open Questions

- Which repo-specific constraints or requirement details still need clarification before planning starts?

## Deferred Ideas

- Leave plan structure, execution details, and later-phase scope decisions for the authored discuss-phase pass.
- Keep implementation specifics deferred until discovery grounds them in project evidence.
- Revisit broader roadmap adjustments after Phase ${args.phaseNumber} context is authored.

## Canonical References

- .blueprint/PROJECT.md
- .blueprint/REQUIREMENTS.md
- .blueprint/ROADMAP.md

---
${SCAFFOLD_GENERATED_MARKER}
${BOOTSTRAP_STARTER_CONTEXT_MARKER}
`;
}

async function pathExists(targetPath: string | URL): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readPackageProjectName(projectRoot: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(projectRoot, "package.json"), "utf8");
    const parsed = safeJsonParseObject<{ name?: unknown }>(raw, {
      label: "package.json",
      maxBytes: 1024 * 1024
    });
    return typeof parsed.name === "string" && parsed.name.trim().length > 0
      ? parsed.name.trim()
      : null;
  } catch {
    return null;
  }
}

async function readPackageDescription(projectRoot: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(projectRoot, "package.json"), "utf8");
    const parsed = safeJsonParseObject<{ description?: unknown }>(raw, {
      label: "package.json",
      maxBytes: 1024 * 1024
    });
    return typeof parsed.description === "string" && parsed.description.trim().length > 0
      ? parsed.description.trim()
      : null;
  } catch {
    return null;
  }
}

async function inferProjectName(
  projectRoot: string,
  requestedName?: string
): Promise<string> {
  const explicit = requestedName?.trim();

  if (explicit) {
    return explicit;
  }

  return (await readPackageProjectName(projectRoot)) ?? path.basename(projectRoot);
}

async function readRepoSummary(projectRoot: string): Promise<string | null> {
  const readmePaths = ["README.md", "README"];

  for (const candidate of readmePaths) {
    try {
      const raw = await fs.readFile(path.join(projectRoot, candidate), "utf8");
      const summary = raw
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 0 && !line.startsWith("#"));

      if (summary) {
        return summary;
      }
    } catch {
      continue;
    }
  }

  return readPackageDescription(projectRoot);
}

function mergeBootstrapSeed(
  synthesized: BootstrapSeed,
  explicit?: BootstrapSeed
): BootstrapSeed {
  if (!explicit) {
    return synthesized;
  }

  return {
    vision: explicit.vision ?? synthesized.vision,
    audience: {
      primary: explicit.audience?.primary ?? synthesized.audience?.primary,
      secondary: explicit.audience?.secondary ?? synthesized.audience?.secondary
    },
    constraints: explicit.constraints ?? synthesized.constraints,
    currentMilestone: explicit.currentMilestone ?? synthesized.currentMilestone,
    nonGoals: explicit.nonGoals ?? synthesized.nonGoals,
    requirements: explicit.requirements ?? synthesized.requirements,
    roadmapPhases: explicit.roadmapPhases ?? synthesized.roadmapPhases,
    brownfieldMode: explicit.brownfieldMode ?? synthesized.brownfieldMode,
    assumptions: explicit.assumptions ?? synthesized.assumptions
  };
}

function bootstrapSeedIsSufficient(seed: BootstrapSeed | undefined): boolean {
  return Boolean(
    seed?.vision?.trim() &&
    seed.currentMilestone?.trim() &&
    seed.requirements &&
    seed.requirements.length > 0 &&
    seed.roadmapPhases &&
    seed.roadmapPhases.length > 0
  );
}

const MIN_SUBSTANTIVE_WORDS = 6;
const GENERIC_TEXT_PATTERN = /^(?:tbd|todo|n\/a|na|none|unknown|placeholder|to be decided|to be determined)$/i;
const GENERIC_SUCCESS_CRITERIA_PATTERNS = [
  /^(?:complete|finish|do|implement|handle|support|make|prepare)\s+(?:the\s+)?(?:work|task|feature|phase|roadmap|bootstrap|workflow)\.?$/i,
  /^(?:keep|ensure|verify|validate|confirm)\s+(?:things|it|this|the work|the phase|the roadmap|the workflow)\s+(?:working|done|ready|traceable|complete)\.?$/i,
  /^complete .+ with traceable handoff evidence\.?$/i,
  /^keep requirement ids traceable into later roadmap artifacts\.?$/i
];

function countWords(value: string): number {
  return (value.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) ?? []).length;
}

function isSubstantiveText(value: string | undefined, minimumWords = MIN_SUBSTANTIVE_WORDS): boolean {
  const normalized = value?.trim() ?? "";

  return (
    normalized.length > 0 &&
    countWords(normalized) >= minimumWords &&
    !GENERIC_TEXT_PATTERN.test(normalized)
  );
}

function bootstrapSeedHasAutoContext(seed: BootstrapSeed | undefined, repoSummary: string | null): boolean {
  if (isSubstantiveText(repoSummary ?? undefined)) {
    return true;
  }

  if (isSubstantiveText(seed?.vision)) {
    return true;
  }

  const substantiveRequirements =
    seed?.requirements?.filter((requirement) => isSubstantiveText(requirement.requirement)).length ?? 0;
  const substantivePhases =
    seed?.roadmapPhases?.filter(
      (phase) => isSubstantiveText(phase.title, 2) && isSubstantiveText(phase.objective)
    ).length ?? 0;

  return substantiveRequirements > 0 && substantivePhases > 0;
}

function normalizedPhaseRef(value: string): string {
  return value.trim().replace(/\.0+$/, "").toLowerCase();
}

function bootstrapSeedPreflightDiagnostics(seed: NormalizedBootstrapSeed): ProjectInitDiagnostic[] {
  const diagnostics: ProjectInitDiagnostic[] = [];
  const requirementIds = new Set<string>();
  const committedRequirementIds = new Set<string>();
  const committedCoverageCounts = new Map<string, number>();
  const phaseRefs = new Set<string>();

  if (!isSubstantiveText(seed.vision)) {
    diagnostics.push(seedDiagnostic({
      path: "bootstrapSeed.vision",
      code: "seed_vision_not_substantive",
      message: "bootstrapSeed.vision must contain a substantive project brief before the first write.",
      repair: "Replace placeholder vision text with a concrete project brief of at least six meaningful words."
    }));
  }

  if (!isSubstantiveText(seed.currentMilestone, 1)) {
    diagnostics.push(seedDiagnostic({
      path: "bootstrapSeed.currentMilestone",
      code: "seed_current_milestone_missing",
      message: "bootstrapSeed.currentMilestone must name the active milestone before the first write.",
      repair: "Set bootstrapSeed.currentMilestone to the active milestone label, for example v1."
    }));
  }

  for (const [requirementIndex, requirement] of seed.requirements.entries()) {
    if (requirementIds.has(requirement.id)) {
      diagnostics.push(seedDiagnostic({
        path: `bootstrapSeed.requirements[${requirementIndex}].id`,
        code: "seed_duplicate_requirement_id",
        message: `bootstrapSeed requirements contain duplicate requirement ID ${requirement.id}.`,
        repair: "Give each requirement a unique durable ID and update phase requirementIds to match.",
        argsPatch: { bootstrapSeed: { requirements: [{ index: requirementIndex, id: `${requirement.id}-2` }] } }
      }));
    }

    requirementIds.add(requirement.id);

    if (!isSubstantiveText(requirement.requirement, 5)) {
      diagnostics.push(seedDiagnostic({
        path: `bootstrapSeed.requirements[${requirementIndex}].requirement`,
        code: "seed_requirement_not_substantive",
        message: `Requirement ${requirement.id} must be substantive before the first write.`,
        repair: "Rewrite the requirement as a concrete, testable product or workflow expectation."
      }));
    }

    if (requirement.scope === "committed") {
      committedRequirementIds.add(requirement.id);
      committedCoverageCounts.set(requirement.id, 0);
    }
  }

  if (committedRequirementIds.size === 0) {
    diagnostics.push(seedDiagnostic({
      path: "bootstrapSeed.requirements",
      code: "seed_no_committed_requirements",
      message: "bootstrapSeed must include at least one committed requirement before the first write.",
      repair: "Mark at least one requirement scope as committed.",
      allowedValues: ["committed", "deferred", "out_of_scope"],
      argsPatch: { bootstrapSeed: { requirements: [{ index: 0, scope: "committed" }] } }
    }));
  }

  for (const [phaseIndex, phase] of seed.roadmapPhases.entries()) {
    const phaseRef = normalizedPhaseRef(phase.phase);

    if (phaseRefs.has(phaseRef)) {
      diagnostics.push(seedDiagnostic({
        path: `bootstrapSeed.roadmapPhases[${phaseIndex}].phase`,
        code: "seed_duplicate_phase_ref",
        message: `bootstrapSeed roadmapPhases contain duplicate phase reference ${phase.phase}.`,
        repair: "Give every roadmap phase a distinct normalized phase reference.",
        argsPatch: { bootstrapSeed: { roadmapPhases: [{ index: phaseIndex, phase: `${phase.phase}.1` }] } }
      }));
    }

    phaseRefs.add(phaseRef);

    const phaseRequirementIds = phase.requirementIds ?? [];
    const uniquePhaseRequirementIds = new Set<string>();

    for (const requirementId of phaseRequirementIds) {
      if (uniquePhaseRequirementIds.has(requirementId)) {
        diagnostics.push(seedDiagnostic({
          path: `bootstrapSeed.roadmapPhases[${phaseIndex}].requirementIds`,
          code: "seed_duplicate_phase_requirement_ref",
          message: `Phase ${phase.phase} references requirement ${requirementId} more than once.`,
          repair: "Remove duplicate requirement IDs from the phase requirementIds list."
        }));
      }

      uniquePhaseRequirementIds.add(requirementId);

      if (!requirementIds.has(requirementId)) {
        diagnostics.push(seedDiagnostic({
          path: `bootstrapSeed.roadmapPhases[${phaseIndex}].requirementIds`,
          code: "seed_undeclared_requirement_ref",
          message: `Phase ${phase.phase} references undeclared requirement ${requirementId}.`,
          repair: "Declare the requirement in bootstrapSeed.requirements or remove it from the phase."
        }));
      }

      if (committedCoverageCounts.has(requirementId)) {
        committedCoverageCounts.set(requirementId, (committedCoverageCounts.get(requirementId) ?? 0) + 1);
      }
    }

    const successCriteria = phase.successCriteria ?? [];

    if (successCriteria.length < 2 || successCriteria.length > 5) {
      diagnostics.push(seedDiagnostic({
        path: `bootstrapSeed.roadmapPhases[${phaseIndex}].successCriteria`,
        code: "seed_success_criteria_count_invalid",
        message: `Phase ${phase.phase} must include 2-5 success criteria before the first write.`,
        repair: "Provide between 2 and 5 observable success criteria for the phase."
      }));
    }

    for (const [criterionIndex, criterion] of successCriteria.entries()) {
      const trimmedCriterion = criterion.trim();

      if (
        !isSubstantiveText(trimmedCriterion) ||
        GENERIC_SUCCESS_CRITERIA_PATTERNS.some((pattern) => pattern.test(trimmedCriterion))
      ) {
        diagnostics.push(seedDiagnostic({
          path: `bootstrapSeed.roadmapPhases[${phaseIndex}].successCriteria[${criterionIndex}]`,
          code: "seed_success_criterion_generic",
          message: `Phase ${phase.phase} has a generic success criterion: ${trimmedCriterion}`,
          repair: "Replace generic success criteria with observable evidence that can be verified later."
        }));
      }
    }
  }

  for (const requirementId of committedRequirementIds) {
    const coverageCount = committedCoverageCounts.get(requirementId) ?? 0;

    if (coverageCount !== 1) {
      diagnostics.push(seedDiagnostic({
        path: "bootstrapSeed.roadmapPhases[].requirementIds",
        code: "seed_committed_requirement_coverage_invalid",
        message: `Committed requirement ${requirementId} must be mapped to exactly one roadmap phase before the first write; found ${coverageCount}.`,
        repair: "Adjust roadmap phase requirementIds so each committed requirement appears in exactly one phase."
      }));
    }
  }

  return diagnostics;
}

function bootstrapSeedPreflightIssues(seed: NormalizedBootstrapSeed): string[] {
  return bootstrapSeedPreflightDiagnostics(seed).map((diagnostic) => diagnostic.message);
}

function seedDiagnostic(
  diagnostic: Omit<ProjectInitDiagnostic, "retryable">
): ProjectInitDiagnostic {
  return {
    ...diagnostic,
    retryable: true
  };
}

function bootstrapSeedExplicitGapDiagnostics(seed: BootstrapSeed): ProjectInitDiagnostic[] {
  const diagnostics: ProjectInitDiagnostic[] = [];

  for (const [phaseIndex, phase] of (seed.roadmapPhases ?? []).entries()) {
    const phaseLabel = phase.phase.trim() || "(blank)";
    const requirementIds = phase.requirementIds?.map((value) => value.trim()).filter(Boolean) ?? [];
    const successCriteria = phase.successCriteria?.map((value) => value.trim()).filter(Boolean) ?? [];

    if (requirementIds.length === 0) {
      diagnostics.push(seedDiagnostic({
        path: `bootstrapSeed.roadmapPhases[${phaseIndex}].requirementIds`,
        code: "seed_phase_requirement_ids_missing",
        message: `Phase ${phaseLabel} must include explicit requirementIds before the first write.`,
        repair: "Add requirementIds that reference committed or deferred bootstrapSeed.requirements before retrying."
      }));
    }

    if (successCriteria.length === 0) {
      diagnostics.push(seedDiagnostic({
        path: `bootstrapSeed.roadmapPhases[${phaseIndex}].successCriteria`,
        code: "seed_phase_success_criteria_missing",
        message: `Phase ${phaseLabel} must include explicit successCriteria before the first write.`,
        repair: "Add at least two concrete success criteria before retrying."
      }));
    }
  }

  return diagnostics;
}

function bootstrapSeedExplicitGapIssues(seed: BootstrapSeed): string[] {
  return bootstrapSeedExplicitGapDiagnostics(seed).map((diagnostic) => diagnostic.message);
}

function buildInvalidProjectInitResult(args: {
  projectRoot: string;
  diagnostics: ProjectInitDiagnostic[];
}): ProjectInitResult {
  const issues = args.diagnostics.map((diagnostic) => diagnostic.message);

  return {
    projectRoot: args.projectRoot,
    status: "invalid",
    written: false,
    issues,
    diagnostics: args.diagnostics,
    suggestedRepairs: [
      "Repair bootstrapSeed using the diagnostics paths, then re-run /blu-new-project with the corrected seed.",
      "Do not delete .blueprint/ only for this result; no bootstrap artifacts were written."
    ]
  };
}

function assertBootstrapCanWrite(args: {
  inspection: Awaited<ReturnType<typeof inspectBlueprintArtifacts>>;
  bootstrapAssessment: BootstrapAssessment;
  overwrite: boolean;
  bootstrapMode: "interactive" | "auto";
  bootstrapSeed?: BootstrapSeed;
}): void {
  if (args.inspection.readiness === "partial") {
    throw new Error(
      `Core .blueprint artifacts are partially initialized. Run ${blueprintRunDirectCommand("health")} to inspect and repair the partial bootstrap before running ${blueprintDirectCommand("new-project")}.`
    );
  }

  if (args.inspection.readiness === "mapping-incomplete") {
    throw new Error(
      `Codebase mapping is incomplete or invalid. Run ${blueprintRunDirectCommand("map-codebase")} to finish the seven-document map before running ${blueprintDirectCommand("new-project")}.`
    );
  }

  if (
    args.inspection.readiness === "initialized" &&
    !args.overwrite
  ) {
    throw new Error(
      "Blueprint artifacts already exist at .blueprint/. Re-run only after explicit overwrite confirmation."
    );
  }

  if (
    args.bootstrapAssessment.repoShape === "brownfield" &&
    !args.bootstrapAssessment.codebaseMapped
  ) {
    throw new Error(
      `Brownfield repos must be mapped before project bootstrap writes. Run ${blueprintRunDirectCommand("map-codebase")} first, then re-run ${blueprintDirectCommand("new-project")}.`
    );
  }

  if (
    args.bootstrapMode === "interactive" &&
    !bootstrapSeedIsSufficient(args.bootstrapSeed)
  ) {
    return;
  }
}

function bootstrapSeedSufficiencyDiagnostics(seed: BootstrapSeed | undefined): ProjectInitDiagnostic[] {
  const diagnostics: ProjectInitDiagnostic[] = [];

  if (!seed?.vision?.trim()) {
    diagnostics.push(seedDiagnostic({
      path: "bootstrapSeed.vision",
      code: "seed_vision_missing",
      message: "Interactive project bootstrap requires bootstrapSeed.vision before any writes.",
      repair: "Ask for or provide a concise project vision before retrying."
    }));
  }

  if (!seed?.currentMilestone?.trim()) {
    diagnostics.push(seedDiagnostic({
      path: "bootstrapSeed.currentMilestone",
      code: "seed_current_milestone_missing",
      message: "Interactive project bootstrap requires bootstrapSeed.currentMilestone before any writes.",
      repair: "Set the active milestone label before retrying."
    }));
  }

  if (!seed?.requirements || seed.requirements.length === 0) {
    diagnostics.push(seedDiagnostic({
      path: "bootstrapSeed.requirements",
      code: "seed_requirements_missing",
      message: "Interactive project bootstrap requires at least one bootstrapSeed.requirements entry before any writes.",
      repair: "Capture at least one durable requirement with id, requirement, status, and notes before retrying."
    }));
  }

  if (!seed?.roadmapPhases || seed.roadmapPhases.length === 0) {
    diagnostics.push(seedDiagnostic({
      path: "bootstrapSeed.roadmapPhases",
      code: "seed_roadmap_phases_missing",
      message: "Interactive project bootstrap requires at least one bootstrapSeed.roadmapPhases entry before any writes.",
      repair: "Capture at least one roadmap phase with phase, title, objective, requirementIds, and successCriteria before retrying."
    }));
  }

  return diagnostics;
}

function bootstrapSeedAutoContextDiagnostics(): ProjectInitDiagnostic[] {
  return [
    seedDiagnostic({
      path: "bootstrapSeed.vision",
      code: "seed_auto_context_missing",
      message:
        "Automatic project bootstrap requires a substantive supplied or repo-derived brief before any writes.",
      repair: "Provide bootstrapSeed.vision or add README/package description context before retrying."
    })
  ];
}

function buildBootstrapStatus(
  diagnostics: BootstrapArtifactDiagnostics
): ProjectStatusResult["bootstrap"] {
  return {
    repoShape: diagnostics.brownfield.repoShape,
    brownfieldDetected: diagnostics.brownfield.repoShape === "brownfield",
    codebaseMapped: diagnostics.brownfield.codebaseMapped,
    placeholderArtifacts: diagnostics.placeholderArtifacts,
    traceabilityWarnings: diagnostics.traceabilityWarnings,
    recommendedNextAction: diagnostics.brownfield.recommendedNextAction
  };
}

function extractMarkdownSection(markdown: string, heading: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(
    new RegExp(`(?:^|\\n)## ${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`)
  );

  return match?.[1] ?? "";
}

function parseRequiredTools(markdown: string): string[] {
  const section = extractMarkdownSection(markdown, "Required MCP Tools");

  return [...section.matchAll(/`(blueprint_[a-z0-9_]+)`/g)].map((match) => match[1]);
}

function parseOptionalAgents(markdown: string, primarySkill: string): string[] {
  const section = extractMarkdownSection(markdown, "Skills And Subagents");
  const values = [...section.matchAll(/`([a-z0-9-]+)`/g)].map((match) => match[1]);

  return values.filter((value) => value !== primarySkill);
}

type ParsedCatalogRow = {
  commandName: string;
  wave: number;
  family: string;
  primarySkill: string;
  declaredStatus: CommandStatus;
  risk: string;
};

function parseCatalogRow(cells: string[]): ParsedCatalogRow | null {
  if (cells.length < 7) {
    return null;
  }

  const commandName = cells[0].replaceAll("`", "");
  const wave = Number.parseInt(cells[1], 10);
  const family = cells[2].replaceAll("`", "");
  const primarySkill = cells[3].replaceAll("`", "");
  const declaredStatus = cells[4].replaceAll("`", "") as CommandStatus;
  const risk = cells[6].replaceAll("`", "");

  if (
    !commandName ||
    Number.isNaN(wave) ||
    !["planned", "implemented", "blocked", "repairing"].includes(declaredStatus)
  ) {
    return null;
  }

  return {
    commandName,
    wave,
    family,
    primarySkill,
    declaredStatus,
    risk
  };
}

async function buildCommandCatalogEntry(parsedRow: ParsedCatalogRow): Promise<CommandCatalogEntry> {
  const runtimeMetadata = getRuntimeOwnedCommandMetadata(parsedRow.commandName);
  const catalogFacts = runtimeMetadata?.catalog ?? parsedRow;
  const specPath = runtimeMetadata?.sourceId ?? `${COMMAND_SPEC_PREFIX}/${parsedRow.commandName}.md`;
  const manifestPath = blueprintPrimaryManifestPath(parsedRow.commandName);
  const specUrl = runtimeMetadata ? null : bundledUrl(specPath);
  const manifestExists = await pathExists(bundledUrl(manifestPath));
  let specExists = runtimeMetadata ? true : await pathExists(specUrl!);
  const missingRuntimeInputs: string[] = [];
  let specMarkdown = "";

  if (specExists && specUrl) {
    try {
      specMarkdown = await fs.readFile(specUrl, "utf8");
    } catch {
      specExists = false;
    }
  }

  const requiredTools = runtimeMetadata
    ? [...runtimeMetadata.requiredTools]
    : parseRequiredTools(specMarkdown);
  const optionalAgents = runtimeMetadata
    ? [...runtimeMetadata.optionalAgents]
    : parseOptionalAgents(specMarkdown, catalogFacts.primarySkill);
  const availableOptionalAgents: string[] = [];
  const blockedBy: string[] = [];
  const skillResolution = await resolveBlueprintSkillPath(catalogFacts.primarySkill, async (skillPath) =>
    pathExists(bundledUrl(skillPath))
  );
  const skillExists = skillResolution.resolvedPath !== null;

  if (!specExists) {
    blockedBy.push(`Missing command spec: ${specPath}`);
  }

  if (!manifestExists) {
    blockedBy.push(`Missing command manifest: ${manifestPath}`);
  }

  if (!skillExists) {
    blockedBy.push(`Missing primary skill: ${skillResolution.canonicalPath}`);
  }

  for (const inputPath of runtimeMetadata?.requiredInputPaths ?? []) {
    if (!(await pathExists(bundledUrl(inputPath)))) {
      missingRuntimeInputs.push(inputPath);
      blockedBy.push(`Missing runtime input: ${inputPath}`);
    }
  }

  const missingTools = requiredTools.filter((toolName) => !AVAILABLE_TOOL_NAMES.has(toolName));
  const requiredToolsSatisfied = missingTools.length === 0;
  const runtimeInputsSatisfied = missingRuntimeInputs.length === 0;

  for (const toolName of missingTools) {
    blockedBy.push(`Missing required MCP tool: ${toolName}`);
  }

  availableOptionalAgents.push(
    ...(await resolveAvailableOptionalAgents(optionalAgents, async (relativePath) => {
      try {
        return await fs.readFile(bundledUrl(relativePath), "utf8");
      } catch {
        return null;
      }
    }))
  );

  let status = catalogFacts.declaredStatus;

  if (!(manifestExists && skillExists && runtimeInputsSatisfied && requiredToolsSatisfied)) {
    if (manifestExists || skillExists) {
      status = "repairing";
    } else if (blockedBy.length > 0) {
      status = "blocked";
    }
  } else if (catalogFacts.declaredStatus === "blocked") {
    status = "blocked";
  } else if (catalogFacts.declaredStatus === "planned") {
    status = "planned";
  } else if (catalogFacts.declaredStatus === "repairing") {
    status = "repairing";
  }

  return {
    command: blueprintDirectCommand(parsedRow.commandName),
    route: blueprintRouterCommand(parsedRow.commandName),
    wave: catalogFacts.wave,
    family: catalogFacts.family,
    risk: catalogFacts.risk,
    primarySkill: catalogFacts.primarySkill,
    declaredStatus: catalogFacts.declaredStatus,
    status,
    implemented: status === "implemented",
    blockedBy,
    manifestPath: manifestExists ? manifestPath : null,
    skillPath: skillResolution.resolvedPath,
    specPath: specExists && runtimeInputsSatisfied ? specPath : null,
    requiredTools,
    requiredToolsSatisfied,
    optionalAgents,
    availableOptionalAgents
  };
}

function runtimeOwnedMetadataToParsedRow(
  metadata: RuntimeOwnedCommandMetadata
): ParsedCatalogRow {
  return {
    commandName: metadata.commandName,
    wave: metadata.catalog.wave,
    family: metadata.catalog.family,
    primarySkill: metadata.catalog.primarySkill,
    declaredStatus: metadata.catalog.declaredStatus,
    risk: metadata.catalog.risk
  };
}

async function addRuntimeOwnedCommandCatalogEntry(
  result: CommandCatalogResult,
  metadata: RuntimeOwnedCommandMetadata
): Promise<void> {
  const parsedRow = runtimeOwnedMetadataToParsedRow(metadata);
  const entry = await buildCommandCatalogEntry(parsedRow);
  const waveKey = String(parsedRow.wave);

  result.commands[parsedRow.commandName] = entry;
  result.waves[waveKey] ??= [];

  if (!result.waves[waveKey].includes(parsedRow.commandName)) {
    result.waves[waveKey].push(parsedRow.commandName);
  }

  result.aliases[parsedRow.commandName] = blueprintDirectCommandAliases(
    parsedRow.commandName
  );
}

async function addMissingRuntimeOwnedCommandCatalogEntries(
  result: CommandCatalogResult
): Promise<CommandCatalogResult> {
  for (const metadata of listRuntimeOwnedCommandMetadata()) {
    if (result.commands[metadata.commandName]) {
      continue;
    }

    await addRuntimeOwnedCommandCatalogEntry(result, metadata);
  }

  return result;
}

async function buildRuntimeOwnedFallbackCommandCatalog(): Promise<CommandCatalogResult> {
  const result = await addMissingRuntimeOwnedCommandCatalogEntries({
    commands: {},
    waves: {},
    aliases: {}
  });

  for (const parsedRow of DOCLESS_FALLBACK_CATALOG_ROWS) {
    if (result.commands[parsedRow.commandName]) {
      continue;
    }

    await addDoclessFallbackCommandCatalogEntry(result, parsedRow);
  }

  return result;
}

async function buildDoclessFallbackCommandCatalogEntry(
  parsedRow: ParsedCatalogRow
): Promise<CommandCatalogEntry> {
  const manifestPath = blueprintPrimaryManifestPath(parsedRow.commandName);
  const manifestExists = await pathExists(bundledUrl(manifestPath));
  const skillResolution = await resolveBlueprintSkillPath(
    parsedRow.primarySkill,
    async (skillPath) => pathExists(bundledUrl(skillPath))
  );
  const skillExists = skillResolution.resolvedPath !== null;
  const blockedBy: string[] = [];
  let status = parsedRow.declaredStatus;

  if (!manifestExists) {
    blockedBy.push(`Missing command manifest: ${manifestPath}`);
  }

  if (!skillExists) {
    blockedBy.push(`Missing primary skill: ${skillResolution.canonicalPath}`);
  }

  if (!(manifestExists && skillExists)) {
    if (manifestExists || skillExists) {
      status = "repairing";
    } else if (blockedBy.length > 0) {
      status = "blocked";
    }
  }

  return {
    command: blueprintDirectCommand(parsedRow.commandName),
    route: blueprintRouterCommand(parsedRow.commandName),
    wave: parsedRow.wave,
    family: parsedRow.family,
    risk: parsedRow.risk,
    primarySkill: parsedRow.primarySkill,
    declaredStatus: parsedRow.declaredStatus,
    status,
    implemented: status === "implemented",
    blockedBy,
    manifestPath: manifestExists ? manifestPath : null,
    skillPath: skillResolution.resolvedPath,
    specPath: null,
    requiredTools: [],
    requiredToolsSatisfied: true,
    optionalAgents: [],
    availableOptionalAgents: []
  };
}

async function addDoclessFallbackCommandCatalogEntry(
  result: CommandCatalogResult,
  parsedRow: ParsedCatalogRow
): Promise<void> {
  const entry = await buildDoclessFallbackCommandCatalogEntry(parsedRow);
  const waveKey = String(parsedRow.wave);

  result.commands[parsedRow.commandName] = entry;
  result.waves[waveKey] ??= [];

  if (!result.waves[waveKey].includes(parsedRow.commandName)) {
    result.waves[waveKey].push(parsedRow.commandName);
  }

  result.aliases[parsedRow.commandName] = blueprintDirectCommandAliases(
    parsedRow.commandName
  );
}

export async function blueprintRuntimeOwnedCommandCatalog(): Promise<CommandCatalogResult> {
  const result = await addMissingRuntimeOwnedCommandCatalogEntries({
    commands: {},
    waves: {},
    aliases: {}
  });

  for (const parsedRow of DOCLESS_FALLBACK_CATALOG_ROWS) {
    if (result.commands[parsedRow.commandName]) {
      continue;
    }

    await addDoclessFallbackCommandCatalogEntry(result, parsedRow);
  }

  return result;
}

async function readBundledCommandCatalog(): Promise<CommandCatalogResult> {
  const commandCatalogPath = bundledUrl("docs/COMMAND-CATALOG.md");

  try {
    const markdown = await fs.readFile(commandCatalogPath, "utf8");
    const commands: Record<string, CommandCatalogEntry> = {};
    const waves: Record<string, string[]> = {};
    const aliases: Record<string, string[]> = {};

    for (const line of markdown.split("\n")) {
      const trimmed = line.trim();

      if (!trimmed.startsWith("| `")) {
        continue;
      }

      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());

      const parsedRow = parseCatalogRow(cells);

      if (!parsedRow) {
        continue;
      }

      const entry = await buildCommandCatalogEntry(parsedRow);

      commands[parsedRow.commandName] = entry;

      const waveKey = String(parsedRow.wave);
      waves[waveKey] ??= [];
      waves[waveKey].push(parsedRow.commandName);
      aliases[parsedRow.commandName] = blueprintDirectCommandAliases(parsedRow.commandName);
    }

    return Object.keys(commands).length > 0
      ? addMissingRuntimeOwnedCommandCatalogEntries({ commands, waves, aliases })
      : await buildRuntimeOwnedFallbackCommandCatalog();
  } catch {
    return buildRuntimeOwnedFallbackCommandCatalog();
  }
}

export async function blueprintCommandCatalog(): Promise<CommandCatalogResult> {
  return readBundledCommandCatalog();
}

export async function blueprintProjectInit(
  args: ProjectInitArgs = {}
): Promise<ProjectInitResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const overwrite = args.overwrite ?? false;
  const bootstrapMode = args.bootstrapMode ?? "interactive";
  const inspection = await inspectBlueprintArtifacts(projectRoot);
  const initialBootstrapDiagnostics = await inspectBootstrapArtifacts(projectRoot);

  assertBootstrapCanWrite({
    inspection,
    bootstrapAssessment: initialBootstrapDiagnostics.brownfield,
    overwrite,
    bootstrapMode,
    bootstrapSeed: args.bootstrapSeed
  });

  if (
    bootstrapMode === "interactive" &&
    !bootstrapSeedIsSufficient(args.bootstrapSeed)
  ) {
    return buildInvalidProjectInitResult({
      projectRoot,
      diagnostics: bootstrapSeedSufficiencyDiagnostics(args.bootstrapSeed)
    });
  }

  const projectName = await inferProjectName(projectRoot, args.projectName);
  const bootstrapAssessment = initialBootstrapDiagnostics.brownfield;
  const repoSummary = await readRepoSummary(projectRoot);

  if (
    bootstrapMode === "auto" &&
    !bootstrapSeedHasAutoContext(args.bootstrapSeed, repoSummary)
  ) {
    return buildInvalidProjectInitResult({
      projectRoot,
      diagnostics: bootstrapSeedAutoContextDiagnostics()
    });
  }

  const autoBaseSeed =
    bootstrapMode === "auto"
      ? buildDefaultBootstrapSeed(
          projectName,
          bootstrapAssessment,
          repoSummary ? { vision: repoSummary } : undefined
        )
      : undefined;
  const seedInput =
    bootstrapMode === "auto"
      ? mergeBootstrapSeed(autoBaseSeed!, args.bootstrapSeed)
      : args.bootstrapSeed!;
  const explicitGapDiagnostics = bootstrapSeedExplicitGapDiagnostics(seedInput);

  if (explicitGapDiagnostics.length > 0) {
    return buildInvalidProjectInitResult({
      projectRoot,
      diagnostics: explicitGapDiagnostics
    });
  }

  const bootstrapSeed = buildDefaultBootstrapSeed(projectName, bootstrapAssessment, seedInput);

  const preflightDiagnostics = bootstrapSeedPreflightDiagnostics(bootstrapSeed);

  if (preflightDiagnostics.length > 0) {
    return buildInvalidProjectInitResult({
      projectRoot,
      diagnostics: preflightDiagnostics
    });
  }

  const initialPhase = bootstrapSeed.roadmapPhases[0]?.phase
    ? normalizeBlueprintPhaseRef(
        bootstrapSeed.roadmapPhases[0].phase,
        "Initial roadmap phase"
      )
    : "1";
  const initialPhaseTitle =
    bootstrapSeed.roadmapPhases[0]?.title?.trim() || "Initial Phase";
  const initialPhaseDir = buildBlueprintPhaseDirectoryPath(
    initialPhase,
    initialPhaseTitle
  );
  const initialPhasePrefix = formatBlueprintPhasePrefix(initialPhase);
  const initialPhaseContextPath = `${initialPhaseDir}/${initialPhasePrefix}-CONTEXT.md`;
  const initialPhaseObjective =
    bootstrapSeed.roadmapPhases[0]?.objective?.trim() ||
    "Author the first phase context before later lifecycle commands run.";
  const initialPhaseRequirementIds =
    bootstrapSeed.roadmapPhases[0]?.requirementIds ?? [];
  const initialPhaseSuccessCriteria =
    bootstrapSeed.roadmapPhases[0]?.successCriteria ?? [];
  const initializedNextAction =
    bootstrapAssessment.provisionalRoadmap
      ? `${blueprintRunDirectCommand("map-codebase")} before treating the roadmap as durable`
      : blueprintRunDirectCommand("discuss-phase", initialPhase);

  const scaffold = await blueprintArtifactScaffold({
    cwd: projectRoot,
    overwrite,
    projectName,
    bootstrapSeed,
    artifacts: [
      `${BLUEPRINT_DIR}/PROJECT.md`,
      `${BLUEPRINT_DIR}/REQUIREMENTS.md`,
      `${BLUEPRINT_DIR}/ROADMAP.md`,
      `${BLUEPRINT_DIR}/phases/`,
      initialPhaseContextPath
    ]
  });
  const seededConfig = await seedProjectConfig({
    cwd: projectRoot,
    defaultsPath: args.defaultsPath
  });
  const bootstrapContextWarnings =
    overwrite || scaffold.createdFiles.includes(initialPhaseContextPath)
      ? await writeTextFile(
          resolveBlueprintPath(projectRoot, initialPhaseContextPath),
          renderBootstrapPhaseContext({
            phaseNumber: initialPhase,
            phasePrefix: initialPhasePrefix,
            phaseTitle: initialPhaseTitle,
            milestone: bootstrapSeed.currentMilestone ?? "v1",
            objective: initialPhaseObjective,
            requirementIds: initialPhaseRequirementIds,
            successCriteria: initialPhaseSuccessCriteria
          }),
          {
            label: initialPhaseContextPath
          }
        )
      : [];
  const seededState = await blueprintStateUpdate({
    cwd: projectRoot,
    patch: {
      projectStatus: "initialized",
      currentMilestone: bootstrapSeed.currentMilestone ?? "v1",
      currentPhase: initialPhase,
      activeCommand: blueprintDirectCommand("new-project"),
      nextAction: initializedNextAction,
      blockers: [],
      lastUpdated: new Date().toISOString()
    }
  });
  const bootstrapDiagnostics = await inspectBootstrapArtifacts(projectRoot);
  const createdPaths = [
    ...scaffold.createdFiles,
    seededState.statePath,
    seededConfig.configPath
  ];
  const warnings = [
    ...scaffold.warnings,
    ...bootstrapContextWarnings,
    ...seededConfig.warnings,
    ...bootstrapDiagnostics.traceabilityWarnings
  ];

  return {
    projectRoot,
    createdPaths,
    seededState,
    configPath: seededConfig.configPath,
    configProvenance: seededConfig.provenance,
    brownfield: bootstrapDiagnostics.brownfield,
    bootstrapDiagnostics,
    nextAction: initializedNextAction,
    warnings: [...new Set(warnings)]
  };
}

export async function blueprintProjectStatus(
  args: ProjectStatusArgs = {}
): Promise<ProjectStatusResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const inspection = await inspectBlueprintArtifacts(projectRoot);
  const bootstrapDiagnostics = await inspectBootstrapArtifacts(projectRoot);
  const bootstrap = buildBootstrapStatus(bootstrapDiagnostics);
  const initialized = inspection.readiness === "initialized";

  if (!initialized) {
    let nextAction = blueprintRunDirectCommand("new-project");
    let warnings = ["Blueprint has not been initialized yet."];

    if (
      inspection.readiness === "uninitialized" &&
      bootstrapDiagnostics.brownfield.repoShape === "brownfield" &&
      !bootstrapDiagnostics.brownfield.codebaseMapped
    ) {
      nextAction = `${blueprintRunDirectCommand("map-codebase")} before ${blueprintDirectCommand("new-project")} so brownfield bootstrap starts from a mapped baseline`;
      warnings = [
        "Brownfield repo is unmapped; map-codebase is the first safe Blueprint write."
      ];
    } else if (inspection.readiness === "mapping-incomplete") {
      nextAction = `${blueprintRunDirectCommand("map-codebase")} to finish the interrupted codebase-only mapping bundle`;
      warnings = [
        "Codebase-only Blueprint state is mapping-incomplete, not a core bootstrap.",
        ...inspection.codebase.warnings
      ];
    } else if (inspection.readiness === "mapped-only") {
      nextAction = `${blueprintRunDirectCommand("new-project")} to bootstrap project artifacts while preserving the mapped codebase docs`;
      warnings = [
        "Codebase mapping is complete and project bootstrap has not been written yet."
      ];
    } else if (inspection.readiness === "partial") {
      nextAction = `${blueprintRunDirectCommand("health")} to inspect and repair the partial .blueprint state`;
      warnings = [
        "Blueprint is partially initialized.",
        ...bootstrapDiagnostics.traceabilityWarnings
      ];
    }

    return {
      status: inspection.readiness,
      initialized: false,
      currentPhase: null,
      currentMilestone: null,
      nextAction,
      bootstrap,
      health: {
        missingArtifacts:
          inspection.readiness === "mapping-incomplete" || inspection.readiness === "mapped-only"
            ? []
            : inspection.core.missing,
        warnings
      }
    };
  }

  const stateResult = await blueprintStateLoad({ cwd: projectRoot });
  let configWarnings: string[] = [];

  try {
    const effectiveConfig = await blueprintConfigGet({
      scope: "effective",
      cwd: projectRoot
    });
    configWarnings = effectiveConfig.warnings;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    configWarnings = [`Blueprint config could not be read: ${message}`];
  }

  return {
    status: inspection.readiness,
    initialized: true,
    currentPhase: stateResult.derivedStatus.currentPhase,
    currentMilestone: stateResult.state.currentMilestone,
    nextAction:
      stateResult.derivedStatus.nextAction || blueprintRunCommand(blueprintRootCommand(), "for the next Blueprint step"),
    bootstrap,
    health: {
      missingArtifacts: inspection.core.missing,
      warnings: [
        ...configWarnings,
        ...bootstrapDiagnostics.placeholderArtifacts.map(
          (artifact) => `Bootstrap artifact still looks like a placeholder: ${artifact}`
        ),
        ...bootstrapDiagnostics.traceabilityWarnings
      ]
    }
  };
}

export const projectToolDefinitions = [
  {
    name: "blueprint_command_catalog",
    description: "Return the retained Blueprint command registry and router metadata.",
    inputSchema: commandCatalogInputSchema,
    handler: async () => blueprintCommandCatalog()
  },
  {
    name: "blueprint_project_init",
    description:
      "Create the initial .blueprint/ scaffold and seed normalized repo config from defaults.",
    inputSchema: projectInitInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintProjectInit(args as ProjectInitArgs)
  },
  {
    name: "blueprint_project_status",
    description: "Summarize Blueprint readiness and the next safe action for the repo.",
    inputSchema: projectStatusInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintProjectStatus(args as ProjectStatusArgs)
  }
];
