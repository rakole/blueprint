import { promises as fs } from "node:fs";
import path from "node:path";

import * as z from "zod/v4";

import {
  CODEBASE_ARTIFACTS,
  BLUEPRINT_BACKLOG_INDEX_PATH,
  BLUEPRINT_DIR,
  BLUEPRINT_PHASES_PATH,
  ensureParentDirectory,
  ensureRepoRoot,
  parseCaptureIndexDocument,
  validatePhaseArtifactContent,
  validatePlanArtifactContent,
  validateResearchArtifactContent,
  validateSummaryArtifactContent,
  validateUatArtifactContent,
  validateVerificationArtifactContent,
  resolveBlueprintPath,
  toRepoRelativePath,
  writeJsonFile,
  withBlueprintRepoLock,
  writeTextFile
} from "./artifacts.js";
import { loadBlueprintState } from "./state.js";
import {
  formatBlueprintPhasePrefix,
  normalizeBlueprintPhaseRef,
  normalizeNumericArtifactId,
  safeJsonParseObject
} from "../../shared/security.js";

type RoadmapReadArgs = {
  cwd?: string;
};

type NumericInput = string | number;

type RoadmapAddPhaseArgs = {
  cwd?: string;
  description: string;
  expectedPhaseNumber?: string;
};

type RoadmapInsertPhaseArgs = {
  cwd?: string;
  after: NumericInput;
  description: string;
};

type RoadmapRemovePhaseArgs = {
  cwd?: string;
  phase: NumericInput;
};

type RoadmapPromoteBacklogArgs = {
  cwd?: string;
  backlogIds?: string[];
  previewOnly?: boolean;
};

type PhaseLookupArgs = {
  cwd?: string;
  phase?: NumericInput;
};

type PhaseArtifactKind = "context" | "discussion-log" | "research" | "ui-spec";
type PhaseValidationArtifactKind = "verification" | "uat";

type PlanIndexArgs = PhaseLookupArgs;

type PhaseArtifactReadArgs = PhaseLookupArgs & {
  artifact: PhaseArtifactKind;
};

type PhaseArtifactWriteArgs = PhaseLookupArgs & {
  artifact: PhaseArtifactKind;
  content: string;
  overwrite?: boolean;
  validationMode?: "strict" | "warn";
};

type PhaseValidationReadArgs = PhaseLookupArgs & {
  artifact: PhaseValidationArtifactKind;
};

type PhaseValidationWriteArgs = PhaseLookupArgs & {
  artifact: PhaseValidationArtifactKind;
  content: string;
  overwrite?: boolean;
};

type PhaseCheckpointRecord = Record<string, unknown>;

type PhaseCheckpointPutArgs = PhaseLookupArgs & {
  checkpoint: PhaseCheckpointRecord;
};

type PhasePlanReadArgs = PhaseLookupArgs & {
  planId: NumericInput;
};

type PhasePlanWriteArgs = PhaseLookupArgs & {
  planId?: NumericInput;
  content: string;
  overwrite?: boolean;
  validationMode?: "strict" | "warn";
};

type PhaseSummaryReadArgs = PhaseLookupArgs & {
  planId: NumericInput;
};

type PhaseSummaryWriteArgs = PhaseLookupArgs & {
  planId: NumericInput;
  content: string;
  overwrite?: boolean;
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

type RoadmapAddPhaseResult = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  slug: string;
  phaseDir: string;
  roadmapPath: string;
  milestone: string | null;
  written: boolean;
  warnings: string[];
};

type RoadmapInsertPhaseResult = {
  afterPhaseNumber: string;
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  slug: string;
  phaseDir: string;
  roadmapPath: string;
  milestone: string | null;
  written: boolean;
  warnings: string[];
};

type RoadmapRemovePhaseResult = {
  removedPhase: {
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    phaseDir: string;
    removedArtifacts: string[];
  };
  renumberedPhases: Array<{
    previousPhaseNumber: string;
    newPhaseNumber: string;
    previousPhasePrefix: string;
    newPhasePrefix: string;
    phaseName: string;
    previousPhaseDir: string;
    newPhaseDir: string;
    renamedArtifacts: Array<{
      from: string;
      to: string;
    }>;
  }>;
  roadmapPath: string;
  milestone: string | null;
  written: boolean;
  warnings: string[];
};

type RoadmapPromotionPreviewItem = {
  backlogId: string;
  description: string;
  status: string | null;
  reservedPhase: string | null;
};

type RoadmapPromoteBacklogResult = {
  status: "preview" | "updated" | "project_missing" | "invalid";
  backlogPath: string;
  roadmapPath: string;
  backlogItems: RoadmapPromotionPreviewItem[];
  selectedBacklogIds: string[];
  promotedItems: Array<{
    backlogId: string;
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    reservedPhase: string | null;
    phaseDir: string;
    createdPhaseDir: boolean;
    reusedReservedPhaseDir: boolean;
  }>;
  createdPhaseDirs: string[];
  warnings: string[];
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
      verification: string | null;
      uat: string | null;
      plans: string[];
      summaries: string[];
    };
  } | null;
  codebase: {
    mapped: boolean;
    artifacts: string[];
    missingArtifacts: string[];
    digest: Array<{
      artifact: string;
      title: string;
      summary: string;
    }>;
    warnings: string[];
  };
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

type PhaseValidationReadResult = {
  phaseFound: boolean;
  found: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  artifact: PhaseValidationArtifactKind;
  path: string | null;
  content: string | null;
  summaryPaths: string[];
  reason: string | null;
};

type PhaseValidationWriteResult = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  phaseDir: string;
  artifact: PhaseValidationArtifactKind;
  path: string;
  summaryPaths: string[];
  written: boolean;
  created: boolean;
  overwritten: boolean;
  status: "created" | "updated" | "reused" | "invalid";
  issues: string[];
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

type PhasePlanRecord = {
  planId: string;
  path: string;
  title: string | null;
  wave: number | null;
  status: string | null;
  objective: string | null;
  dependsOn: string[];
  requirements: string[];
  filesModified: string[];
  readFirst: string[];
  acceptanceCriteria: string[];
  autonomous: boolean | null;
  valid: boolean;
  issues: string[];
  warnings: string[];
};

type PhasePlanIndexResult = {
  phaseFound: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  plans: PhasePlanRecord[];
  waves: Record<string, string[]>;
  missingPlans: string[];
  warnings: string[];
};

type PhasePlanReadResult = {
  phaseFound: boolean;
  found: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  planId: string | null;
  path: string | null;
  content: string | null;
  metadata: Omit<PhasePlanRecord, "path" | "valid" | "issues" | "warnings" | "planId"> | null;
  validation: {
    valid: boolean;
    issues: string[];
    warnings: string[];
  } | null;
  reason: string | null;
};

type PhasePlanWriteResult = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  phaseDir: string;
  planId: string;
  path: string;
  written: boolean;
  created: boolean;
  overwritten: boolean;
  status: "created" | "updated" | "reused" | "invalid";
  validation: {
    valid: boolean;
    issues: string[];
    warnings: string[];
  };
  warnings: string[];
};

type PhaseSummaryRecord = {
  planId: string;
  path: string;
  linkedPlanPath: string | null;
  title: string | null;
  summary: string | null;
};

type PhaseSummaryIndexResult = {
  phaseFound: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  summaries: PhaseSummaryRecord[];
  completedPlans: string[];
  pendingPlans: string[];
  warnings: string[];
};

type PhaseSummaryReadResult = {
  phaseFound: boolean;
  found: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  planId: string | null;
  path: string | null;
  content: string | null;
  metadata: Omit<PhaseSummaryRecord, "path" | "planId"> | null;
  reason: string | null;
};

type PhaseSummaryWriteResult = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  phaseDir: string;
  planId: string;
  path: string;
  linkedPlanPath: string;
  written: boolean;
  created: boolean;
  overwritten: boolean;
  status: "created" | "updated" | "reused" | "invalid";
  issues: string[];
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

const PHASE_ARTIFACT_SUFFIXES: Record<PhaseArtifactKind, string> = {
  context: "-CONTEXT.md",
  "discussion-log": "-DISCUSSION-LOG.md",
  research: "-RESEARCH.md",
  "ui-spec": "-UI-SPEC.md"
};
const PHASE_VALIDATION_ARTIFACT_SUFFIXES: Record<PhaseValidationArtifactKind, string> = {
  verification: "-VERIFICATION.md",
  uat: "-UAT.md"
};
const PHASE_CHECKPOINT_SUFFIX = "-DISCUSS-CHECKPOINT.json";

const roadmapReadInputSchema = {
  cwd: z.string().optional()
};

const roadmapAddPhaseInputSchema = {
  cwd: z.string().optional(),
  description: z.string(),
  expectedPhaseNumber: z.string().optional()
};
const roadmapInsertPhaseInputSchema = {
  cwd: z.string().optional(),
  after: z.string(),
  description: z.string()
};
const roadmapRemovePhaseInputSchema = {
  cwd: z.string().optional(),
  phase: z.string()
};
const roadmapPromoteBacklogInputSchema = {
  cwd: z.string().optional(),
  backlogIds: z.array(z.string()).optional(),
  previewOnly: z.boolean().optional()
};

const numericBlueprintInputSchema = z.union([z.string(), z.number()]);

const phaseLookupInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional()
};

const phaseArtifactInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum(["context", "discussion-log", "research", "ui-spec"])
};
const phaseValidationArtifactInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum(["verification", "uat"])
};
const phasePlanInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional()
};

const phaseArtifactWriteInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum(["context", "discussion-log", "research", "ui-spec"]),
  content: z.string(),
  overwrite: z.boolean().optional(),
  validationMode: z.enum(["strict", "warn"]).optional()
};
const phaseValidationWriteInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum(["verification", "uat"]),
  content: z.string(),
  overwrite: z.boolean().optional()
};
const phasePlanReadInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema
};
const phasePlanWriteInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema.optional(),
  content: z.string(),
  overwrite: z.boolean().optional(),
  validationMode: z.enum(["strict", "warn"]).optional()
};
const phaseSummaryReadInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema
};
const phaseSummaryWriteInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  planId: numericBlueprintInputSchema,
  content: z.string(),
  overwrite: z.boolean().optional()
};

const phaseCheckpointQuestionSchema = z.object({
  prompt: z.string(),
  response: z.string().optional(),
  status: z.enum(["pending", "answered", "skipped"]).optional()
});

const phaseCheckpointSchema = z
  .object({
    mode: z.string().min(1).optional(),
    pendingTopics: z.array(z.string()).optional(),
    completedTopics: z.array(z.string()).optional(),
    currentQuestion: z.string().optional(),
    answers: z.array(phaseCheckpointQuestionSchema).optional(),
    notes: z.array(z.string()).optional(),
    resumeHint: z.string().optional(),
    updatedAt: z.string().optional()
  })
  .catchall(z.unknown())
  .superRefine((value, context) => {
    const structuredKeys = [
      "mode",
      "pendingTopics",
      "completedTopics",
      "currentQuestion",
      "answers",
      "notes",
      "resumeHint",
      "updatedAt"
    ];

    if (!structuredKeys.some((key) => key in value)) {
      context.addIssue({
        code: "custom",
        message:
          "Checkpoint must include resumability fields such as mode, pendingTopics, currentQuestion, answers, notes, resumeHint, or updatedAt."
      });
    }
  });

const phaseCheckpointPutInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  checkpoint: phaseCheckpointSchema
};

function normalizeBlueprintInput(value: NumericInput): string {
  return typeof value === "number" ? String(value) : value;
}

function normalizePhaseNumber(value: NumericInput): string {
  return normalizeBlueprintPhaseRef(normalizeBlueprintInput(value));
}

function basePhaseNumber(value: NumericInput): string {
  return normalizePhaseNumber(value).split(".")[0] ?? normalizePhaseNumber(value);
}

function comparePhaseNumbers(left: NumericInput, right: NumericInput): number {
  const leftParts = normalizePhaseNumber(left)
    .split(".")
    .map((segment) => Number.parseInt(segment, 10));
  const rightParts = normalizePhaseNumber(right)
    .split(".")
    .map((segment) => Number.parseInt(segment, 10));
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return 0;
}

function formatPhasePrefix(value: NumericInput): string {
  return formatBlueprintPhasePrefix(normalizeBlueprintInput(value));
}

function extractPhaseNumberToken(value: NumericInput): string | null {
  const match = normalizeBlueprintInput(value).trim().match(/(\d+(?:\.\d+)?)/);
  return match ? normalizePhaseNumber(match[1]) : null;
}

function isIntegerPhaseNumber(value: NumericInput): boolean {
  return !normalizePhaseNumber(value).includes(".");
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
    .filter(
      (entry) =>
        entry.length > 0 &&
        !["none", "none yet", "n/a", "not yet mapped"].includes(entry.toLowerCase())
    );
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
    /^- \[([ xX])\] (?:\*\*)?Phase (\d+(?:\.\d+)?): ([^\n*]+?)(?:\*\*)?(?: - (.+))?$/gm
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

function normalizePhaseDescription(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ");
}

function slugifyPhaseName(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .toLowerCase()
    .replace(/[_\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : "new-phase";
}

function nextIntegerPhaseNumber(phases: ParsedRoadmapPhase[]): string {
  const basePhaseNumbers = phases
    .map((phase) => phase.phaseNumber)
    .map((phaseNumber) => phaseNumber.split(".")[0] ?? phaseNumber)
    .map((phaseNumber) => Number.parseInt(phaseNumber, 10))
    .filter((phaseNumber) => !Number.isNaN(phaseNumber));

  const maxIntegerPhase = basePhaseNumbers.length === 0
    ? 0
    : Math.max(...basePhaseNumbers);

  return String(maxIntegerPhase + 1);
}

function previousIntegerPhaseNumber(value: NumericInput): string | null {
  const normalizedPhaseNumber = normalizePhaseNumber(value);

  if (!isIntegerPhaseNumber(normalizedPhaseNumber)) {
    return null;
  }

  const previousPhaseNumber = Number.parseInt(normalizedPhaseNumber, 10) - 1;

  return previousPhaseNumber > 0 ? String(previousPhaseNumber) : null;
}

function nextDecimalPhaseNumber(
  phases: ParsedRoadmapPhase[],
  afterPhaseNumber: string
): string {
  const normalizedAfterPhase = normalizePhaseNumber(afterPhaseNumber);
  const decimalMatcher = new RegExp(`^${escapeForRegex(normalizedAfterPhase)}\\.(\\d+)$`);
  const suffixes = phases
    .map((phase) => phase.phaseNumber)
    .map((phaseNumber) => phaseNumber.match(decimalMatcher)?.[1] ?? null)
    .filter((suffix): suffix is string => suffix !== null)
    .map((suffix) => Number.parseInt(suffix, 10))
    .filter((suffix) => !Number.isNaN(suffix));
  const nextSuffix = suffixes.length === 0 ? 1 : Math.max(...suffixes) + 1;

  return `${normalizedAfterPhase}.${nextSuffix}`;
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceWithPlaceholders(
  value: string,
  replacements: Array<{
    pattern: RegExp;
    replacement: string;
  }>
): string {
  const placeholders = replacements.map((_, index) => `__BLUEPRINT_PHASE_${index}__`);
  let updated = value;

  replacements.forEach((replacement, index) => {
    updated = updated.replace(replacement.pattern, placeholders[index]);
  });

  placeholders.forEach((placeholder, index) => {
    updated = updated.replaceAll(placeholder, replacements[index]?.replacement ?? placeholder);
  });

  return updated;
}

function rewriteDependencyLines(
  value: string,
  renumberMap: ReadonlyMap<string, string>
): string {
  return value.replace(/^(\*\*Depends on\*\*:\s*)(.+)$/gm, (_full, prefix: string, body: string) => {
    const trimmedBody = body.trim();

    if (trimmedBody.length === 0 || ["none", "n/a"].includes(trimmedBody.toLowerCase())) {
      return `${prefix}${body}`;
    }

    const rewritten = body
      .split(",")
      .map((rawEntry) => {
        const entry = rawEntry.trim();
        const phaseNumber = extractPhaseNumberToken(entry);

        if (!phaseNumber) {
          return rawEntry;
        }

        const replacement = renumberMap.get(phaseNumber);

        if (!replacement) {
          return rawEntry;
        }

        const phasePrefix = entry.startsWith("Phase ")
          ? "Phase "
          : entry.startsWith("phase ")
            ? "phase "
            : "";

        return rawEntry.replace(
          new RegExp(`${escapeForRegex(phasePrefix)}${escapeForRegex(phaseNumber)}\\b`),
          `${phasePrefix}${replacement}`
        );
      })
      .join(",");

    return `${prefix}${rewritten}`;
  });
}

function rewriteRoadmapPhaseReferences(
  value: string,
  renumberMap: ReadonlyMap<string, string>
): string {
  const replacements = [...renumberMap.entries()].flatMap(([from, to]) => [
    {
      pattern: new RegExp(`\\bPhase ${escapeForRegex(from)}\\b`, "g"),
      replacement: `Phase ${to}`
    },
    {
      pattern: new RegExp(`\\bphase ${escapeForRegex(from)}\\b`, "g"),
      replacement: `phase ${to}`
    }
  ]);

  return rewriteDependencyLines(replaceWithPlaceholders(value, replacements), renumberMap);
}

function appendPhaseLineToRoadmap(
  raw: string,
  phaseNumber: string,
  phaseName: string
): string {
  const phaseLine = `- [ ] **Phase ${phaseNumber}: ${phaseName}**`;
  const phasesSectionPattern = /(## Phases\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (!phasesSectionPattern.test(raw)) {
    throw new Error(
      `Malformed ${BLUEPRINT_DIR}/ROADMAP.md: missing a usable "## Phases" section.`
    );
  }

  return raw.replace(phasesSectionPattern, (_full, header: string, body: string) => {
    const trimmedBody = body.trimEnd();
    const nextBody = trimmedBody.length === 0 ? phaseLine : `${trimmedBody}\n${phaseLine}`;
    return `${header}${nextBody}\n`;
  });
}

function insertPhaseLineToRoadmap(
  raw: string,
  insertAfterPhaseNumber: string,
  phaseNumber: string,
  phaseName: string
): string {
  const normalizedAnchor = normalizePhaseNumber(insertAfterPhaseNumber);
  const phaseLine = `- [ ] **Phase ${phaseNumber}: ${phaseName}**`;
  const phasesSectionPattern = /(## Phases\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (!phasesSectionPattern.test(raw)) {
    throw new Error(
      `Malformed ${BLUEPRINT_DIR}/ROADMAP.md: missing a usable "## Phases" section.`
    );
  }

  let inserted = false;

  const content = raw.replace(phasesSectionPattern, (_full, header: string, body: string) => {
    const lines = body
      .split("\n")
      .filter((line) => line.trim().length > 0);
    const anchorIndex = lines.findIndex((line) => {
      const match = line.match(/^- \[[ xX]\] (?:\*\*)?Phase (\d+(?:\.\d+)?): [^\n]+$/);
      return match ? normalizePhaseNumber(match[1]) === normalizedAnchor : false;
    });

    if (anchorIndex === -1) {
      return `${header}${body}`;
    }

    lines.splice(anchorIndex + 1, 0, phaseLine);
    inserted = true;

    return `${header}${lines.join("\n")}\n`;
  });

  if (!inserted) {
    throw new Error(
      `Phase ${insertAfterPhaseNumber} could not be located in the roadmap phases list.`
    );
  }

  return content;
}

function buildPhaseDetailBlock(
  phaseNumber: string,
  phaseName: string,
  dependsOnPhaseNumber: string | null = null
): string {
  return `### Phase ${phaseNumber}: ${phaseName}
**Goal**: Capture the phase boundary and implementation goal during /blu-discuss-phase.
**Requirements**: none yet
**Depends on**: ${dependsOnPhaseNumber ? `Phase ${dependsOnPhaseNumber}` : "none"}
**Success Criteria**: Persist context, planning, execution, validation, and UAT evidence for this phase.
**Status**: planned
`;
}

function appendPhaseDetailsToRoadmap(
  raw: string,
  phaseNumber: string,
  phaseName: string,
  dependsOnPhaseNumber: string | null = null
): string {
  const detailHeadingPattern = new RegExp(`^### Phase ${escapeForRegex(phaseNumber)}: `, "m");

  if (detailHeadingPattern.test(raw)) {
    return raw;
  }

  const detailBlock = buildPhaseDetailBlock(phaseNumber, phaseName, dependsOnPhaseNumber);
  const phaseDetailsSectionPattern = /(## Phase Details\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (phaseDetailsSectionPattern.test(raw)) {
    return raw.replace(
      phaseDetailsSectionPattern,
      (_full, header: string, body: string) => {
        const trimmedBody = body.trimEnd();
        const nextBody =
          trimmedBody.length === 0 ? detailBlock.trimEnd() : `${trimmedBody}\n\n${detailBlock.trimEnd()}`;
        return `${header}${nextBody}\n`;
      }
    );
  }

  return `${raw.trimEnd()}

## Phase Details

${detailBlock}`;
}

function insertPhaseDetailsToRoadmap(
  raw: string,
  phaseGroupNumbers: string[],
  phaseNumber: string,
  phaseName: string,
  dependsOnPhaseNumber: string
): string {
  const detailHeadingPattern = new RegExp(`^### Phase ${escapeForRegex(phaseNumber)}: `, "m");

  if (detailHeadingPattern.test(raw)) {
    return raw;
  }

  const detailBlock = buildPhaseDetailBlock(phaseNumber, phaseName, dependsOnPhaseNumber).trimEnd();
  const phaseDetailsSectionPattern = /(## Phase Details\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (!phaseDetailsSectionPattern.test(raw)) {
    throw new Error(
      `Malformed ${BLUEPRINT_DIR}/ROADMAP.md: missing a usable "## Phase Details" section.`
    );
  }

  const phaseGroupSet = new Set(phaseGroupNumbers.map((value) => normalizePhaseNumber(value)));
  let inserted = false;
  const content = raw.replace(
    phaseDetailsSectionPattern,
    (_full, header: string, body: string) => {
      const blocks = [...body.matchAll(/(^### Phase [\s\S]*?)(?=^### Phase |\s*$)/gm)].map(
        (match) => match[1].trimEnd()
      );

      let insertIndex = -1;

      for (let index = blocks.length - 1; index >= 0; index -= 1) {
        const blockMatch = blocks[index]?.match(/^### Phase (\d+(?:\.\d+)?): /m);
        const blockPhaseNumber = blockMatch ? normalizePhaseNumber(blockMatch[1]) : null;

        if (blockPhaseNumber && phaseGroupSet.has(blockPhaseNumber)) {
          insertIndex = index + 1;
          break;
        }
      }

      if (insertIndex === -1) {
        throw new Error(
          `Phase ${dependsOnPhaseNumber} is missing a matching entry under the roadmap's "## Phase Details" section. Resolve roadmap drift before inserting a decimal phase.`
        );
      }

      blocks.splice(insertIndex, 0, detailBlock);
      inserted = true;

      return `${header}${blocks.join("\n\n")}\n`;
    }
  );

  if (!inserted) {
    throw new Error(
      `Phase ${phaseNumber} could not be inserted into the roadmap's "## Phase Details" section.`
    );
  }

  return content;
}

function removePhaseLineFromRoadmap(
  raw: string,
  phaseNumber: string
): {
  content: string;
  removed: boolean;
} {
  const phasesSectionPattern = /(## Phases\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (!phasesSectionPattern.test(raw)) {
    throw new Error(
      `Malformed ${BLUEPRINT_DIR}/ROADMAP.md: missing a usable "## Phases" section.`
    );
  }

  let removed = false;
  const content = raw.replace(phasesSectionPattern, (_full, header: string, body: string) => {
    const nextLines = body
      .split("\n")
      .filter((line) => {
        const match = line.match(/^- \[[ xX]\] (?:\*\*)?Phase (\d+(?:\.\d+)?): [^\n]+$/);

        if (!match) {
          return line.trim().length > 0;
        }

        if (normalizePhaseNumber(match[1]) === phaseNumber) {
          removed = true;
          return false;
        }

        return true;
      })
      .join("\n");

    return `${header}${nextLines.trimEnd()}\n`;
  });

  return {
    content,
    removed
  };
}

function removePhaseDetailsFromRoadmap(
  raw: string,
  phaseNumber: string
): {
  content: string;
  removed: boolean;
} {
  const phaseDetailsSectionPattern = /(## Phase Details\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (!phaseDetailsSectionPattern.test(raw)) {
    return {
      content: raw,
      removed: false
    };
  }

  let removed = false;
  const content = raw.replace(
    phaseDetailsSectionPattern,
    (_full, header: string, body: string) => {
      const blocks = [...body.matchAll(/(^### Phase [\s\S]*?)(?=^### Phase |\s*$)/gm)].map(
        (match) => match[1].trimEnd()
      );
      const nextBlocks = blocks.filter((block) => {
        const match = block.match(/^### Phase (\d+(?:\.\d+)?): /m);

        if (!match) {
          return true;
        }

        if (normalizePhaseNumber(match[1]) === phaseNumber) {
          removed = true;
          return false;
        }

        return true;
      });
      const nextBody = nextBlocks.join("\n\n");

      return nextBody.length > 0 ? `${header}${nextBody}\n` : `${header}`;
    }
  );

  return {
    content,
    removed
  };
}

function replacePhaseLineCompletionMarker(
  raw: string,
  phaseNumber: string,
  completed: boolean
): {
  content: string;
  found: boolean;
  changed: boolean;
} {
  const marker = completed ? "x" : " ";
  const pattern = new RegExp(
    `^(- \\[)([ xX])(\\] (?:\\*\\*)?Phase ${escapeForRegex(phaseNumber)}: [^\\n]+)$`,
    "m"
  );
  const match = raw.match(pattern);

  if (!match) {
    return {
      content: raw,
      found: false,
      changed: false
    };
  }

  const changed = (match[2]?.toLowerCase() === "x") !== completed;

  return {
    content: raw.replace(pattern, `$1${marker}$3`),
    found: true,
    changed
  };
}

function replacePhaseDetailStatus(
  raw: string,
  phaseNumber: string,
  nextStatus: string
): {
  content: string;
  found: boolean;
  changed: boolean;
} {
  const phaseDetailsSectionPattern = /(## Phase Details\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (!phaseDetailsSectionPattern.test(raw)) {
    return {
      content: raw,
      found: false,
      changed: false
    };
  }

  let found = false;
  let changed = false;
  const content = raw.replace(
    phaseDetailsSectionPattern,
    (_full, header: string, body: string) => {
      const blocks = [...body.matchAll(/(^### Phase [\s\S]*?)(?=^### Phase |\s*$)/gm)].map(
        (match) => match[1].trimEnd()
      );
      const nextBlocks = blocks.map((block) => {
        const match = block.match(/^### Phase (\d+(?:\.\d+)?): /m);

        if (!match || normalizePhaseNumber(match[1]) !== phaseNumber) {
          return block;
        }

        found = true;

        if (/^\*\*Status\*\*:\s*(.+)$/m.test(block)) {
          const existingStatus = block.match(/^\*\*Status\*\*:\s*(.+)$/m)?.[1]?.trim() ?? "";

          if (existingStatus.toLowerCase() === nextStatus.toLowerCase()) {
            return block;
          }

          changed = true;
          return block.replace(/^\*\*Status\*\*:\s*(.+)$/m, `**Status**: ${nextStatus}`);
        }

        changed = true;
        return `${block}\n**Status**: ${nextStatus}`;
      });

      return `${header}${nextBlocks.join("\n\n")}\n`;
    }
  );

  return {
    content,
    found,
    changed
  };
}

async function syncRoadmapPhaseCompletion(
  projectRoot: string,
  resolved: ResolvedPhaseLocation
): Promise<string[]> {
  const roadmapPath = resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/ROADMAP.md`);

  if (!(await pathExists(roadmapPath))) {
    return [];
  }

  const phaseArtifacts = await listPhaseArtifacts(
    resolveBlueprintPath(projectRoot, resolved.phaseDir),
    projectRoot
  );
  const summaryPaths = phaseArtifacts.filter((artifact) => artifact.endsWith("-SUMMARY.md"));
  const hasSummaries = summaryPaths.length > 0;
  const verificationAccepted = await isAcceptedValidationArtifact(
    projectRoot,
    resolved,
    "verification",
    summaryPaths
  );
  const uatAccepted = await isAcceptedValidationArtifact(
    projectRoot,
    resolved,
    "uat",
    summaryPaths
  );
  const completed = hasSummaries && verificationAccepted && uatAccepted;
  const rawRoadmap = await fs.readFile(roadmapPath, "utf8");
  const phaseLineSync = replacePhaseLineCompletionMarker(
    rawRoadmap,
    resolved.phaseNumber,
    completed
  );

  if (!phaseLineSync.found) {
    return [
      `ROADMAP completion sync could not find Phase ${resolved.phaseNumber} in ${BLUEPRINT_DIR}/ROADMAP.md.`
    ];
  }

  const detailStatus =
    completed
      ? replacePhaseDetailStatus(phaseLineSync.content, resolved.phaseNumber, "completed")
      : phaseLineSync.changed
        ? replacePhaseDetailStatus(phaseLineSync.content, resolved.phaseNumber, "in_progress")
        : {
            content: phaseLineSync.content,
            found: false,
            changed: false
          };

  if (!phaseLineSync.changed && !detailStatus.changed) {
    return [];
  }

  const warnings = await writeTextFile(roadmapPath, detailStatus.content, {
    label: `${BLUEPRINT_DIR}/ROADMAP.md`
  });

  warnings.push(
    completed
      ? `Marked Phase ${resolved.phaseNumber} completed in ${BLUEPRINT_DIR}/ROADMAP.md.`
      : `Reopened Phase ${resolved.phaseNumber} in ${BLUEPRINT_DIR}/ROADMAP.md until validation evidence is complete.`
  );

  return warnings;
}

async function isAcceptedValidationArtifact(
  projectRoot: string,
  resolved: ResolvedPhaseLocation,
  artifact: PhaseValidationArtifactKind,
  summaryPaths: string[]
): Promise<boolean> {
  const artifactPath = validationArtifactPathFor(resolved, artifact);
  const absolutePath = resolveBlueprintPath(projectRoot, artifactPath);

  if (!(await pathExists(absolutePath))) {
    return false;
  }

  const content = await fs.readFile(absolutePath, "utf8");
  const validation =
    artifact === "verification"
      ? validateVerificationArtifactContent(content, summaryPaths)
      : validateUatArtifactContent(content, summaryPaths);

  return validation.valid && validation.warnings.length === 0;
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

function normalizeBacklogReviewStatus(value: string | null): string {
  return value?.trim().toLowerCase() ?? "backlog";
}

function backlogStatusBlocksPromotion(value: string | null): boolean {
  return ["promoted", "done", "completed", "archived", "removed", "discarded"].includes(
    normalizeBacklogReviewStatus(value)
  );
}

async function readBacklogPromotionCandidates(projectRoot: string): Promise<{
  status: "ready" | "project_missing" | "missing";
  backlogItems: RoadmapPromotionPreviewItem[];
  warnings: string[];
}> {
  const projectPath = resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/PROJECT.md`);
  const roadmapPath = resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/ROADMAP.md`);
  const backlogPath = resolveBlueprintPath(projectRoot, BLUEPRINT_BACKLOG_INDEX_PATH);

  if (!(await pathExists(projectPath)) || !(await pathExists(roadmapPath))) {
    return {
      status: "project_missing",
      backlogItems: [],
      warnings: [
        "Blueprint review-backlog requires an initialized project. Run /blu-new-project before promoting backlog items."
      ]
    };
  }

  if (!(await pathExists(backlogPath))) {
    return {
      status: "missing",
      backlogItems: [],
      warnings: ["No backlog index exists yet. Run /blu-add-backlog before reviewing backlog items."]
    };
  }

  const rawBacklog = await fs.readFile(backlogPath, "utf8");
  const parsedBacklog = parseCaptureIndexDocument(rawBacklog, "backlog");
  const warnings = parsedBacklog.malformed
    ? [
        `Recovered non-canonical backlog index content while reading ${BLUEPRINT_BACKLOG_INDEX_PATH}.`
      ]
    : [];

  return {
    status: "ready",
    backlogItems: parsedBacklog.rows.map((row) => ({
      backlogId: row.id,
      description: row.description,
      status: row.status,
      reservedPhase: row.reservedPhase
    })),
    warnings
  };
}

async function resolveRequestedPhase(
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

function buildArtifactPath(phaseDir: string, phasePrefix: string, suffix: string): string {
  return `${phaseDir}/${phasePrefix}${suffix}`;
}

function findArtifact(artifacts: string[], suffix: string): string | null {
  return artifacts.find((artifact) => artifact.endsWith(suffix)) ?? null;
}

function summarizeSavedArtifact(raw: string): { title: string; summary: string } {
  const normalizedLines = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim());
  const withoutFrontmatter = [...normalizedLines];

  if (withoutFrontmatter[0] === "---") {
    withoutFrontmatter.shift();

    while (withoutFrontmatter.length > 0 && withoutFrontmatter[0] !== "---") {
      withoutFrontmatter.shift();
    }

    if (withoutFrontmatter[0] === "---") {
      withoutFrontmatter.shift();
    }
  }

  const meaningfulLines = withoutFrontmatter.filter(
    (line) => line.length > 0 && !line.startsWith("*Generated by")
  );
  const heading = meaningfulLines.find((line) => line.startsWith("#"));
  const bodyLine = meaningfulLines.find((line) => !line.startsWith("#"));

  return {
    title: heading?.replace(/^#+\s*/, "").trim() ?? "Artifact Summary",
    summary: bodyLine ?? "Artifact content is present and available for review."
  };
}

async function readMappedCodebaseContext(
  projectRoot: string
): Promise<PhaseContextResult["codebase"]> {
  const artifacts: string[] = [];
  const missingArtifacts: string[] = [];
  const digest: PhaseContextResult["codebase"]["digest"] = [];

  for (const artifact of CODEBASE_ARTIFACTS) {
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

  const mapped = artifacts.length === CODEBASE_ARTIFACTS.length;
  const warnings: string[] = [];

  if (artifacts.length > 0 && !mapped) {
    warnings.push(
      `Mapped codebase bundle is incomplete: missing ${missingArtifacts.join(", ")}.`
    );
  }

  if (mapped) {
    warnings.push(
      "Mapped codebase summaries are available and should be reused before rereading broad repo surfaces."
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

function buildLocateRecovery(reason: string | null): string[] {
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

function validationArtifactPathFor(
  located: Pick<ResolvedPhaseLocation, "phaseDir" | "phasePrefix">,
  artifact: PhaseValidationArtifactKind
): string {
  return buildArtifactPath(
    located.phaseDir,
    located.phasePrefix,
    PHASE_VALIDATION_ARTIFACT_SUFFIXES[artifact]
  );
}

function checkpointPathFor(located: Pick<ResolvedPhaseLocation, "phaseDir" | "phasePrefix">): string {
  return buildArtifactPath(located.phaseDir, located.phasePrefix, PHASE_CHECKPOINT_SUFFIX);
}

function normalizePlanId(value: NumericInput): string {
  return normalizeNumericArtifactId(normalizeBlueprintInput(value), "Plan id");
}

function parsePlanArtifactPath(
  pathValue: string,
  phasePrefix: string
): string | null {
  const match = pathValue.match(
    new RegExp(`${phasePrefix.replace(".", "\\.")}-(\\d+)-PLAN\\.md$`)
  );

  return match ? normalizePlanId(match[1]) : null;
}

function planPathFor(
  located: Pick<ResolvedPhaseLocation, "phaseDir" | "phasePrefix">,
  planId: string
): string {
  return buildArtifactPath(located.phaseDir, located.phasePrefix, `-${normalizePlanId(planId)}-PLAN.md`);
}

function parseSummaryArtifactPath(
  pathValue: string,
  phasePrefix: string
): string | null {
  const match = pathValue.match(
    new RegExp(`${phasePrefix.replace(".", "\\.")}-(\\d+)-SUMMARY\\.md$`)
  );

  return match ? normalizePlanId(match[1]) : null;
}

function summaryPathFor(
  located: Pick<ResolvedPhaseLocation, "phaseDir" | "phasePrefix">,
  planId: string
): string {
  return buildArtifactPath(
    located.phaseDir,
    located.phasePrefix,
    `-${normalizePlanId(planId)}-SUMMARY.md`
  );
}

function toPhasePlanRecord(
  planId: string,
  pathValue: string,
  content: string,
  expectedPhase: string
): PhasePlanRecord {
  const validation = validatePlanArtifactContent(content, expectedPhase);

  return {
    planId,
    path: pathValue,
    title: validation.metadata.title,
    wave: validation.metadata.wave,
    status: validation.metadata.status,
    objective: validation.metadata.objective,
    dependsOn: validation.metadata.dependsOn,
    requirements: validation.metadata.requirements,
    filesModified: validation.metadata.filesModified,
    readFirst: validation.metadata.readFirst,
    acceptanceCriteria: validation.metadata.acceptanceCriteria,
    autonomous: validation.metadata.autonomous,
    valid: validation.valid,
    issues: validation.issues,
    warnings: validation.warnings
  };
}

function normalizeTextContent(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function summarizeMarkdownContent(content: string): {
  title: string | null;
  summary: string | null;
} {
  const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
  const summary =
    content
      .split("\n")
      .map((line) => line.trim())
      .find(
        (line) =>
          line.length > 0 &&
          !line.startsWith("#") &&
          line !== "---" &&
          !line.startsWith("*Generated by")
      ) ?? null;

  return {
    title,
    summary
  };
}

function toPhaseSummaryRecord(
  planId: string,
  pathValue: string,
  content: string,
  linkedPlanPath: string | null
): PhaseSummaryRecord {
  const metadata = summarizeMarkdownContent(content);

  return {
    planId,
    path: pathValue,
    linkedPlanPath,
    title: metadata.title,
    summary: metadata.summary
  };
}

function ensureCheckpointObject(
  checkpoint: unknown,
  checkpointPath: string
): PhaseCheckpointRecord {
  if (typeof checkpoint !== "object" || checkpoint === null || Array.isArray(checkpoint)) {
    throw new Error(`${checkpointPath} must contain a JSON object.`);
  }

  return checkpoint as PhaseCheckpointRecord;
}

function ensureCheckpointForPersistence(
  checkpoint: unknown,
  checkpointPath: string
): PhaseCheckpointRecord {
  const parsed = phaseCheckpointSchema.safeParse(ensureCheckpointObject(checkpoint, checkpointPath));

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new Error(`${checkpointPath} must contain a structured discuss checkpoint. ${issues}`);
  }

  return parsed.data as PhaseCheckpointRecord;
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

export async function blueprintRoadmapAddPhase(
  args: RoadmapAddPhaseArgs
): Promise<RoadmapAddPhaseResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const normalizedDescription = normalizePhaseDescription(args.description);

  if (normalizedDescription.length === 0) {
    throw new Error(
      "Phase description required. Re-run /blu-add-phase with a concise description."
    );
  }

  return withBlueprintRepoLock(projectRoot, "roadmap-add-phase", async () => {
    const roadmap = await readRoadmap(projectRoot);
    const phaseNumber = nextIntegerPhaseNumber(roadmap.phases);

    if (
      args.expectedPhaseNumber &&
      normalizePhaseNumber(args.expectedPhaseNumber) !== phaseNumber
    ) {
      throw new Error(
        `Confirmed next phase ${normalizePhaseNumber(args.expectedPhaseNumber)} no longer matches the live next phase ${phaseNumber}. Re-run /blu-add-phase after re-reading the roadmap.`
      );
    }

    const phasePrefix = formatPhasePrefix(phaseNumber);
    const slug = slugifyPhaseName(normalizedDescription);
    const phaseDir = `${BLUEPRINT_PHASES_PATH}/${phasePrefix}-${slug}`;
    const roadmapPath = resolveBlueprintPath(projectRoot, roadmap.path);
    const rawRoadmap = await fs.readFile(roadmapPath, "utf8");
    const dependsOnPhaseNumber = previousIntegerPhaseNumber(phaseNumber);
    const updatedRoadmap = appendPhaseDetailsToRoadmap(
      appendPhaseLineToRoadmap(rawRoadmap, phaseNumber, normalizedDescription),
      phaseNumber,
      normalizedDescription,
      dependsOnPhaseNumber
    );
    const warnings: string[] = [];
    const phaseDirPath = resolveBlueprintPath(projectRoot, phaseDir);

    warnings.push(
      ...await writeTextFile(roadmapPath, updatedRoadmap, {
        label: roadmap.path
      })
    );

    if (await pathExists(phaseDirPath)) {
      warnings.push(`Phase directory already exists and can be reused: ${phaseDir}`);
    } else {
      await fs.mkdir(phaseDirPath, { recursive: true });
    }

    return {
      phaseNumber,
      phasePrefix,
      phaseName: normalizedDescription,
      slug,
      phaseDir,
      roadmapPath: roadmap.path,
      milestone: roadmap.milestone,
      written: true,
      warnings
    };
  });
}

export async function blueprintRoadmapInsertPhase(
  args: RoadmapInsertPhaseArgs
): Promise<RoadmapInsertPhaseResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const roadmap = await readRoadmap(projectRoot);
  const normalizedDescription = normalizePhaseDescription(args.description);

  if (normalizedDescription.length === 0) {
    throw new Error(
      "Phase description required. Re-run /blu-insert-phase with an integer phase number such as 3 and a concise description."
    );
  }

  const afterPhaseNumber = extractPhaseNumberToken(args.after ?? "");

  if (!afterPhaseNumber) {
    throw new Error(
      "Phase number required. Re-run /blu-insert-phase with an integer phase number such as 3."
    );
  }

  if (!isIntegerPhaseNumber(afterPhaseNumber)) {
    throw new Error(
      `Phase ${afterPhaseNumber} cannot be used as an insertion target. Re-run /blu-insert-phase with an existing integer phase number such as ${basePhaseNumber(afterPhaseNumber)}.`
    );
  }

  const targetPhase = roadmap.phases.find((phase) => phase.phaseNumber === afterPhaseNumber);

  if (!targetPhase) {
    throw new Error(
      `Phase ${afterPhaseNumber} does not exist in ${BLUEPRINT_DIR}/ROADMAP.md.`
    );
  }

  const targetPhaseDirectory = await findPhaseDirectory(projectRoot, afterPhaseNumber);

  if (!targetPhaseDirectory.phaseDir) {
    throw new Error(
      targetPhaseDirectory.reason === "ambiguous"
        ? `Phase ${afterPhaseNumber} has multiple matching directories under ${BLUEPRINT_PHASES_PATH}. Resolve the drift before inserting a decimal phase after it.`
        : `Phase ${afterPhaseNumber} is missing a matching directory under ${BLUEPRINT_PHASES_PATH}. Resolve the drift before inserting a decimal phase after it.`
    );
  }

  const phaseNumber = nextDecimalPhaseNumber(roadmap.phases, afterPhaseNumber);
  const phasePrefix = formatPhasePrefix(phaseNumber);
  const slug = slugifyPhaseName(normalizedDescription);
  const phaseDir = `${BLUEPRINT_PHASES_PATH}/${phasePrefix}-${slug}`;
  const existingDecimalDirectory = await findPhaseDirectory(projectRoot, phaseNumber);

  if (
    existingDecimalDirectory.reason === "ambiguous" ||
    (existingDecimalDirectory.phaseDir && existingDecimalDirectory.phaseDir !== phaseDir)
  ) {
    throw new Error(
      existingDecimalDirectory.reason === "ambiguous"
        ? `Phase ${phaseNumber} already has multiple matching directories under ${BLUEPRINT_PHASES_PATH}. Resolve the drift before inserting it into the roadmap.`
        : `Phase ${phaseNumber} already has a conflicting directory under ${BLUEPRINT_PHASES_PATH}: ${existingDecimalDirectory.phaseDir}. Resolve the drift before inserting it into the roadmap.`
    );
  }

  const groupPhases = roadmap.phases.filter(
    (phase) => basePhaseNumber(phase.phaseNumber) === afterPhaseNumber
  );
  const insertionAnchor = groupPhases.at(-1)?.phaseNumber ?? afterPhaseNumber;
  const insertionAnchorIndex = roadmap.phases.findIndex(
    (phase) => phase.phaseNumber === insertionAnchor
  );

  if (insertionAnchorIndex === -1) {
    throw new Error(
      `Phase ${afterPhaseNumber} could not be located in the roadmap phases list.`
    );
  }

  const roadmapPath = resolveBlueprintPath(projectRoot, roadmap.path);
  const rawRoadmap = await fs.readFile(roadmapPath, "utf8");
  const insertedPhaseLines = insertPhaseLineToRoadmap(
    rawRoadmap,
    insertionAnchor,
    phaseNumber,
    normalizedDescription
  );
  const updatedRoadmap = insertPhaseDetailsToRoadmap(
    insertedPhaseLines,
    groupPhases.map((phase) => phase.phaseNumber),
    phaseNumber,
    normalizedDescription,
    afterPhaseNumber
  );
  const phaseDirPath = resolveBlueprintPath(projectRoot, phaseDir);
  const warnings: string[] = [];

  warnings.push(
    ...await writeTextFile(roadmapPath, updatedRoadmap, {
      label: roadmap.path
    })
  );

  if (existingDecimalDirectory.phaseDir === phaseDir || (await pathExists(phaseDirPath))) {
    warnings.push(`Phase directory already exists and can be reused: ${phaseDir}`);
  } else {
    await fs.mkdir(phaseDirPath, { recursive: true });
  }

  return {
    afterPhaseNumber,
    phaseNumber,
    phasePrefix,
    phaseName: normalizedDescription,
    slug,
    phaseDir,
    roadmapPath: roadmap.path,
    milestone: roadmap.milestone,
    written: true,
    warnings
  };
}

function renameLeadingPhaseToken(
  entryName: string,
  phaseNumber: string,
  replacementPrefix: string
): string | null {
  const match = entryName.match(/^(\d+(?:\.\d+)?)(.*)$/);

  if (!match || normalizePhaseNumber(match[1]) !== phaseNumber) {
    return null;
  }

  return `${replacementPrefix}${match[2]}`;
}

async function renamePhaseArtifactsInPlace(
  projectRoot: string,
  rootDirectoryPath: string,
  oldPhaseNumber: string,
  newPhasePrefix: string
): Promise<Array<{ from: string; to: string }>> {
  const renamedArtifacts: Array<{ from: string; to: string }> = [];
  const entries = await fs.readdir(rootDirectoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const currentPath = path.join(rootDirectoryPath, entry.name);
    const renamedEntry = renameLeadingPhaseToken(entry.name, oldPhaseNumber, newPhasePrefix);
    const nextPath = renamedEntry ? path.join(rootDirectoryPath, renamedEntry) : currentPath;

    if (renamedEntry) {
      await fs.rename(currentPath, nextPath);
      renamedArtifacts.push({
        from: toRepoRelativePath(projectRoot, currentPath),
        to: toRepoRelativePath(projectRoot, nextPath)
      });
    }

    const stats = await fs.stat(nextPath);

    if (stats.isDirectory()) {
      renamedArtifacts.push(
        ...(await renamePhaseArtifactsInPlace(
          projectRoot,
          nextPath,
          oldPhaseNumber,
          newPhasePrefix
        ))
      );
    }
  }

  return renamedArtifacts;
}

function findPhaseRenumberTargets(
  phases: ParsedRoadmapPhase[],
  targetPhaseNumber: string
): Array<{
  previousPhase: ParsedRoadmapPhase;
  newPhaseNumber: string;
}> {
  const targetIndex = phases.findIndex((phase) => phase.phaseNumber === targetPhaseNumber);

  if (targetIndex === -1) {
    throw new Error(
      `Phase ${targetPhaseNumber} does not exist in ${BLUEPRINT_DIR}/ROADMAP.md.`
    );
  }

  const renumberTargets: Array<{
    previousPhase: ParsedRoadmapPhase;
    newPhaseNumber: string;
  }> = [];

  for (let index = targetIndex + 1; index < phases.length; index += 1) {
    renumberTargets.push({
      previousPhase: phases[index],
      newPhaseNumber:
        index === targetIndex + 1
          ? targetPhaseNumber
          : phases[index - 1]?.phaseNumber ?? targetPhaseNumber
    });
  }

  return renumberTargets;
}

export async function blueprintRoadmapRemovePhase(
  args: RoadmapRemovePhaseArgs
): Promise<RoadmapRemovePhaseResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const roadmap = await readRoadmap(projectRoot);
  const targetPhaseNumber = extractPhaseNumberToken(args.phase ?? "");

  if (!targetPhaseNumber) {
    throw new Error(
      "Phase number required. Re-run /blu-remove-phase with a phase number such as 7."
    );
  }

  const targetPhase = roadmap.phases.find((phase) => phase.phaseNumber === targetPhaseNumber);

  if (!targetPhase) {
    throw new Error(
      `Phase ${targetPhaseNumber} does not exist in ${BLUEPRINT_DIR}/ROADMAP.md.`
    );
  }

  const currentState = await loadBlueprintState(projectRoot);
  const currentPhaseNumber = extractPhaseNumberToken(currentState.currentPhase);

  if (!currentPhaseNumber) {
    throw new Error(
      `Cannot validate future-phase removal because ${BLUEPRINT_DIR}/STATE.md does not contain a usable current phase.`
    );
  }

  if (comparePhaseNumbers(targetPhaseNumber, currentPhaseNumber) <= 0) {
    throw new Error(
      `Cannot remove Phase ${targetPhaseNumber}. Only future phases can be removed; current phase is ${currentPhaseNumber}.`
    );
  }

  const targetPhaseDirectory = await findPhaseDirectory(projectRoot, targetPhaseNumber);

  if (!targetPhaseDirectory.phaseDir) {
    throw new Error(
      targetPhaseDirectory.reason === "ambiguous"
        ? `Phase ${targetPhaseNumber} has multiple matching directories under ${BLUEPRINT_PHASES_PATH}. Resolve the drift before removing it.`
        : `Phase ${targetPhaseNumber} is missing a matching directory under ${BLUEPRINT_PHASES_PATH}. Resolve the drift before removing it.`
    );
  }

  const targetPhaseDirPath = resolveBlueprintPath(projectRoot, targetPhaseDirectory.phaseDir);
  const removedArtifacts = await listPhaseArtifacts(targetPhaseDirPath, projectRoot);
  const executionArtifacts = removedArtifacts.filter(
    (artifactPath) =>
      /-SUMMARY\.md$/i.test(artifactPath) ||
      /-VERIFICATION\.md$/i.test(artifactPath) ||
      /-UAT\.md$/i.test(artifactPath)
  );

  if (executionArtifacts.length > 0) {
    throw new Error(
      `Phase ${targetPhaseNumber} already has execution evidence (${executionArtifacts.join(", ")}). Remove those artifacts explicitly before removing the phase.`
    );
  }

  const renumberTargets = findPhaseRenumberTargets(roadmap.phases, targetPhaseNumber);
  const renumberMap = new Map(
    renumberTargets.map(({ previousPhase, newPhaseNumber }) => [
      previousPhase.phaseNumber,
      newPhaseNumber
    ])
  );
  const roadmapPath = resolveBlueprintPath(projectRoot, roadmap.path);
  const rawRoadmap = await fs.readFile(roadmapPath, "utf8");
  const removedPhaseLine = removePhaseLineFromRoadmap(rawRoadmap, targetPhaseNumber);

  if (!removedPhaseLine.removed) {
    throw new Error(
      `Phase ${targetPhaseNumber} could not be removed from the roadmap phases list.`
    );
  }

  const removedPhaseDetails = removePhaseDetailsFromRoadmap(
    removedPhaseLine.content,
    targetPhaseNumber
  );
  const warnings: string[] = [];

  if (!removedPhaseDetails.removed) {
    warnings.push(
      `Phase ${targetPhaseNumber} did not have a matching entry under the roadmap's "## Phase Details" section.`
    );
  }

  const updatedRoadmap = rewriteRoadmapPhaseReferences(
    removedPhaseDetails.content,
    renumberMap
  );
  const renumberedPhases: RoadmapRemovePhaseResult["renumberedPhases"] = [];
  const preparedRenumberTargets = [];

  for (const { previousPhase, newPhaseNumber } of renumberTargets) {
    const locatedPhaseDirectory = await findPhaseDirectory(projectRoot, previousPhase.phaseNumber);

    if (!locatedPhaseDirectory.phaseDir) {
      throw new Error(
        locatedPhaseDirectory.reason === "ambiguous"
          ? `Phase ${previousPhase.phaseNumber} has multiple matching directories under ${BLUEPRINT_PHASES_PATH}. Resolve the drift before removing ${targetPhaseNumber}.`
          : `Phase ${previousPhase.phaseNumber} is missing a matching directory under ${BLUEPRINT_PHASES_PATH}. Resolve the drift before removing ${targetPhaseNumber}.`
      );
    }

    preparedRenumberTargets.push({
      previousPhase,
      newPhaseNumber,
      previousPhaseDir: locatedPhaseDirectory.phaseDir
    });
  }

  await fs.rm(targetPhaseDirPath, { recursive: true, force: true });

  for (const { previousPhase, newPhaseNumber, previousPhaseDir } of preparedRenumberTargets) {
    const previousPhaseDirPath = resolveBlueprintPath(projectRoot, previousPhaseDir);
    const previousDirectoryName = path.basename(previousPhaseDirPath);
    const newPhasePrefix = formatPhasePrefix(newPhaseNumber);
    const renamedDirectoryName = renameLeadingPhaseToken(
      previousDirectoryName,
      previousPhase.phaseNumber,
      newPhasePrefix
    );

    if (!renamedDirectoryName) {
      throw new Error(
        `Phase directory ${previousPhaseDir} does not start with the expected phase number ${previousPhase.phaseNumber}.`
      );
    }

    const newPhaseDirPath = path.join(path.dirname(previousPhaseDirPath), renamedDirectoryName);

    await fs.rename(previousPhaseDirPath, newPhaseDirPath);

    const renamedArtifacts = await renamePhaseArtifactsInPlace(
      projectRoot,
      newPhaseDirPath,
      previousPhase.phaseNumber,
      newPhasePrefix
    );

    renumberedPhases.push({
      previousPhaseNumber: previousPhase.phaseNumber,
      newPhaseNumber,
      previousPhasePrefix: previousPhase.phasePrefix,
      newPhasePrefix,
      phaseName: previousPhase.phaseName,
      previousPhaseDir,
      newPhaseDir: toRepoRelativePath(projectRoot, newPhaseDirPath),
      renamedArtifacts
    });
  }

  warnings.push(
    ...await writeTextFile(roadmapPath, updatedRoadmap, {
      label: roadmap.path
    })
  );

  return {
    removedPhase: {
      phaseNumber: targetPhase.phaseNumber,
      phasePrefix: targetPhase.phasePrefix,
      phaseName: targetPhase.phaseName,
      phaseDir: targetPhaseDirectory.phaseDir,
      removedArtifacts
    },
    renumberedPhases,
    roadmapPath: roadmap.path,
    milestone: roadmap.milestone,
    written: true,
    warnings
  };
}

async function materializePromotedBacklogPhaseDirectory(
  projectRoot: string,
  item: RoadmapPromotionPreviewItem,
  phasePrefix: string,
  phaseName: string
): Promise<{
  phaseDir: string;
  createdPhaseDir: boolean;
  reusedReservedPhaseDir: boolean;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const desiredPhaseDir = `${BLUEPRINT_PHASES_PATH}/${phasePrefix}-${slugifyPhaseName(phaseName)}`;
  const desiredPhaseDirPath = resolveBlueprintPath(projectRoot, desiredPhaseDir);

  if (item.reservedPhase) {
    const reservedDirectory = await findPhaseDirectory(projectRoot, item.reservedPhase);

    if (reservedDirectory.reason === "ambiguous") {
      throw new Error(
        `Backlog item ${item.backlogId} maps to reserved phase ${item.reservedPhase}, but multiple matching directories exist under ${BLUEPRINT_PHASES_PATH}. Resolve the drift before promoting it.`
      );
    }

    if (reservedDirectory.phaseDir) {
      const reservedPhaseDirPath = resolveBlueprintPath(projectRoot, reservedDirectory.phaseDir);
      const renamedDirectoryName = renameLeadingPhaseToken(
        path.basename(reservedPhaseDirPath),
        item.reservedPhase,
        phasePrefix
      );

      if (!renamedDirectoryName) {
        throw new Error(
          `Reserved phase directory ${reservedDirectory.phaseDir} does not start with ${item.reservedPhase}.`
        );
      }

      const promotedPhaseDirPath = path.join(
        path.dirname(reservedPhaseDirPath),
        renamedDirectoryName
      );

      if (
        promotedPhaseDirPath !== reservedPhaseDirPath &&
        (await pathExists(promotedPhaseDirPath))
      ) {
        throw new Error(
          `Promoted phase directory already exists for backlog item ${item.backlogId}: ${toRepoRelativePath(projectRoot, promotedPhaseDirPath)}.`
        );
      }

      if (promotedPhaseDirPath !== reservedPhaseDirPath) {
        await fs.rename(reservedPhaseDirPath, promotedPhaseDirPath);
      }

      await renamePhaseArtifactsInPlace(
        projectRoot,
        promotedPhaseDirPath,
        item.reservedPhase,
        phasePrefix
      );

      return {
        phaseDir: toRepoRelativePath(projectRoot, promotedPhaseDirPath),
        createdPhaseDir: true,
        reusedReservedPhaseDir: true,
        warnings
      };
    }

    warnings.push(
      `Reserved phase ${item.reservedPhase} did not have a matching directory; created a new active phase directory instead.`
    );
  }

  if (await pathExists(desiredPhaseDirPath)) {
    warnings.push(`Phase directory already exists and was reused: ${desiredPhaseDir}`);

    return {
      phaseDir: desiredPhaseDir,
      createdPhaseDir: false,
      reusedReservedPhaseDir: false,
      warnings
    };
  }

  await fs.mkdir(desiredPhaseDirPath, { recursive: true });

  return {
    phaseDir: desiredPhaseDir,
    createdPhaseDir: true,
    reusedReservedPhaseDir: false,
    warnings
  };
}

export async function blueprintRoadmapPromoteBacklog(
  args: RoadmapPromoteBacklogArgs = {}
): Promise<RoadmapPromoteBacklogResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const backlogPath = BLUEPRINT_BACKLOG_INDEX_PATH;
  const roadmapPath = `${BLUEPRINT_DIR}/ROADMAP.md`;
  const backlog = await readBacklogPromotionCandidates(projectRoot);

  if (backlog.status === "project_missing") {
    return {
      status: "project_missing",
      backlogPath,
      roadmapPath,
      backlogItems: [],
      selectedBacklogIds: [],
      promotedItems: [],
      createdPhaseDirs: [],
      warnings: backlog.warnings
    };
  }

  if (backlog.status === "missing") {
    return {
      status: "invalid",
      backlogPath,
      roadmapPath,
      backlogItems: [],
      selectedBacklogIds: [],
      promotedItems: [],
      createdPhaseDirs: [],
      warnings: backlog.warnings
    };
  }

  const requestedBacklogIds = [...new Set((args.backlogIds ?? []).map((value) => value.trim().toUpperCase()).filter((value) => value.length > 0))];

  if ((args.previewOnly ?? false) || requestedBacklogIds.length === 0) {
    return {
      status: "preview",
      backlogPath,
      roadmapPath,
      backlogItems: backlog.backlogItems,
      selectedBacklogIds: [],
      promotedItems: [],
      createdPhaseDirs: [],
      warnings: backlog.warnings
    };
  }

  const warnings = [...backlog.warnings];
  const selectedItems: RoadmapPromotionPreviewItem[] = [];

  for (const backlogId of requestedBacklogIds) {
    const matched = backlog.backlogItems.find((item) => item.backlogId === backlogId);

    if (!matched) {
      warnings.push(`Backlog item ${backlogId} was not found in ${backlogPath}.`);
      continue;
    }

    if (backlogStatusBlocksPromotion(matched.status)) {
      warnings.push(
        `Backlog item ${backlogId} is already ${normalizeBacklogReviewStatus(matched.status)} and was skipped.`
      );
      continue;
    }

    selectedItems.push(matched);
  }

  if (selectedItems.length === 0) {
    return {
      status: "invalid",
      backlogPath,
      roadmapPath,
      backlogItems: backlog.backlogItems,
      selectedBacklogIds: requestedBacklogIds,
      promotedItems: [],
      createdPhaseDirs: [],
      warnings
    };
  }

  const roadmap = await readRoadmap(projectRoot);
  const roadmapAbsolutePath = resolveBlueprintPath(projectRoot, roadmap.path);
  let roadmapBody = await fs.readFile(roadmapAbsolutePath, "utf8");
  const roadmapPhases = [...roadmap.phases];
  const promotedItems: RoadmapPromoteBacklogResult["promotedItems"] = [];
  const createdPhaseDirs: string[] = [];

  for (const item of selectedItems) {
    const phaseNumber = nextIntegerPhaseNumber(roadmapPhases);
    const phasePrefix = formatPhasePrefix(phaseNumber);
    const phaseName = normalizePhaseDescription(item.description);
    const dependsOnPhaseNumber = previousIntegerPhaseNumber(phaseNumber);
    const phaseDirectory = await materializePromotedBacklogPhaseDirectory(
      projectRoot,
      item,
      phasePrefix,
      phaseName
    );

    roadmapBody = appendPhaseDetailsToRoadmap(
      appendPhaseLineToRoadmap(roadmapBody, phaseNumber, phaseName),
      phaseNumber,
      phaseName,
      dependsOnPhaseNumber
    );
    roadmapPhases.push({
      phaseNumber,
      phasePrefix,
      phaseName,
      completed: false,
      summary: null,
      goal: null,
      requirements: []
    });
    promotedItems.push({
      backlogId: item.backlogId,
      phaseNumber,
      phasePrefix,
      phaseName,
      reservedPhase: item.reservedPhase,
      phaseDir: phaseDirectory.phaseDir,
      createdPhaseDir: phaseDirectory.createdPhaseDir,
      reusedReservedPhaseDir: phaseDirectory.reusedReservedPhaseDir
    });
    if (phaseDirectory.createdPhaseDir) {
      createdPhaseDirs.push(phaseDirectory.phaseDir);
    }
    warnings.push(...phaseDirectory.warnings);
  }

  warnings.push(
    ...await writeTextFile(roadmapAbsolutePath, roadmapBody, {
      label: roadmapPath
    })
  );

  return {
    status: "updated",
    backlogPath,
    roadmapPath,
    backlogItems: backlog.backlogItems,
    selectedBacklogIds: selectedItems.map((item) => item.backlogId),
    promotedItems,
    createdPhaseDirs,
    warnings
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
  const codebase = await readMappedCodebaseContext(projectRoot);

  if (!located.found || !located.phaseNumber || !located.phasePrefix || !located.phaseDir) {
    return {
      phase: null,
      codebase,
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
        verification: findArtifact(artifacts, "-VERIFICATION.md"),
        uat: findArtifact(artifacts, "-UAT.md"),
        plans: artifacts.filter((artifact) => artifact.endsWith("-PLAN.md")),
        summaries: artifacts.filter((artifact) => artifact.endsWith("-SUMMARY.md"))
      }
    },
    codebase,
    requirements: matchedPhase?.requirements ?? [],
    missingArtifacts: [contextPath, researchPath, uiSpecPath].filter(
      (artifact) => !artifacts.includes(artifact)
    ),
    warnings: [
      ...(!findArtifact(artifacts, "-CONTEXT.md")
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
  const context = await blueprintPhaseContext(args);
  const artifacts = context.phase?.artifacts;
  const researchPath = artifacts?.research ?? null;
  let researchValid: boolean | null = null;
  let researchIssues: string[] = [];
  let researchUnreadable = false;
  const warnings = [...context.warnings];

  if (researchPath) {
    const projectRoot = await ensureRepoRoot(args.cwd);
    const absolutePath = resolveBlueprintPath(projectRoot, researchPath);
    try {
      const raw = await fs.readFile(absolutePath, "utf8");
      const validation = validateResearchArtifactContent(raw);

      researchValid = validation.valid;
      researchIssues = validation.issues;
      warnings.push(...validation.warnings);
    } catch (error) {
      researchUnreadable = true;
      researchValid = false;
      const reason =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "unknown read failure";

      researchIssues = [
        `Research artifact at ${researchPath} could not be read: ${reason}.`
      ];
      warnings.push(
        `Research artifact at ${researchPath} is stale, deleted, or unreadable: ${reason}.`
      );
    }
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
    suggestedRepairs: researchIssues.length > 0
      ? [
          researchUnreadable
            ? `Restore or regenerate ${researchPath} with /blu-research-phase before planning.`
            : "Update the phase research through /blu-research-phase so it matches the required research schema before planning."
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
  const validation = validatePhaseArtifactContent(normalizedContent, args.artifact);

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
        validation: {
          valid: validation.valid,
          issues: validation.issues,
          warnings: validation.warnings,
          suggestedRepairs: []
        },
        warnings
      };
    }

    if (!(args.overwrite ?? false)) {
      throw new Error(
        `${artifactPath} already exists. Re-run only after explicit overwrite confirmation.`
      );
    }
  }

  if (!validation.valid && (args.validationMode ?? "strict") === "strict") {
    const suggestedRepairs =
      args.artifact === "research"
        ? ["Add the required research sections, confidence marker, and at least one cited source before retrying."]
        : args.artifact === "ui-spec"
          ? [
              "Add a populated Outcome Mode section plus either the contract headings or an explicit skip Rationale before retrying."
            ]
          : [
              `Add a real ${args.artifact} artifact title, remove scaffold placeholders, and populate at least one contract section before retrying.`
            ];

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
        suggestedRepairs
      },
      warnings: []
    };
  }

  warnings.push(
    ...await writeTextFile(absolutePath, normalizedContent, {
      label: artifactPath
    })
  );

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
    validation: {
      valid: validation.valid,
      issues: validation.issues,
      warnings: validation.warnings,
      suggestedRepairs: []
    },
    warnings: [...warnings, ...validation.warnings]
  };
}

export async function blueprintPhaseValidationRead(
  args: PhaseValidationReadArgs
): Promise<PhaseValidationReadResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate(args);
  const resolved = toResolvedPhaseLocation(located);
  const summaryPaths = located.artifacts
    .filter((artifact) => artifact.endsWith("-SUMMARY.md"))
    .sort((left, right) => left.localeCompare(right));

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
      summaryPaths,
      reason: located.reason
    };
  }

  const artifactPath = validationArtifactPathFor(resolved, args.artifact);
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
      summaryPaths,
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
    summaryPaths,
    reason: null
  };
}

export async function blueprintPhaseValidationWrite(
  args: PhaseValidationWriteArgs
): Promise<PhaseValidationWriteResult> {
  const { projectRoot, resolved } = await resolveLocatedPhaseForMutation(args);
  const summaryIndex = await blueprintPhaseSummaryIndex({
    cwd: projectRoot,
    phase: resolved.phaseNumber
  });

  if (!summaryIndex.phaseFound) {
    throw new Error(
      `Phase ${resolved.phaseNumber} could not be resolved for validation persistence.`
    );
  }

  if (summaryIndex.summaries.length === 0) {
    throw new Error(
      `Phase ${resolved.phaseNumber} does not have execution summaries yet. Run /blu-execute-phase ${resolved.phaseNumber} before writing ${args.artifact} artifacts.`
    );
  }

  const artifactPath = validationArtifactPathFor(resolved, args.artifact);
  const absolutePath = resolveBlueprintPath(projectRoot, artifactPath);
  const normalizedContent = normalizeTextContent(args.content);
  const exists = await pathExists(absolutePath);
  const validation =
    normalizedContent.trim().length === 0
      ? {
          valid: false,
          issues: [`${args.artifact} content must not be empty.`],
          warnings: [] as string[]
        }
      : args.artifact === "verification"
        ? validateVerificationArtifactContent(
            normalizedContent,
            summaryIndex.summaries.map((summary) => summary.path)
          )
        : validateUatArtifactContent(
            normalizedContent,
            summaryIndex.summaries.map((summary) => summary.path)
          );
  const warnings: string[] = [];

  if (args.artifact === "uat") {
    const verificationPath = validationArtifactPathFor(resolved, "verification");

    if (!(await pathExists(resolveBlueprintPath(projectRoot, verificationPath)))) {
      throw new Error(
        `Phase ${resolved.phaseNumber} must be validated before UAT. Run /blu-validate-phase ${resolved.phaseNumber} first.`
      );
    }
  }

  if (exists) {
    const existingContent = await fs.readFile(absolutePath, "utf8");

    if (existingContent === normalizedContent) {
      warnings.push(`Preserved existing ${args.artifact} artifact because the content was unchanged.`);
      warnings.push(...(await syncRoadmapPhaseCompletion(projectRoot, resolved)));

      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        artifact: args.artifact,
        path: artifactPath,
        summaryPaths: summaryIndex.summaries.map((summary) => summary.path),
        written: false,
        created: false,
        overwritten: false,
        status: "reused",
        issues: validation.issues,
        warnings: [...warnings, ...validation.warnings]
      };
    }

    if (!(args.overwrite ?? false)) {
      throw new Error(
        `${artifactPath} already exists. Re-run only after explicit overwrite confirmation.`
      );
    }
  }

  if (!validation.valid) {
    warnings.push(...(await syncRoadmapPhaseCompletion(projectRoot, resolved)));

    return {
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      artifact: args.artifact,
      path: artifactPath,
      summaryPaths: summaryIndex.summaries.map((summary) => summary.path),
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      issues: validation.issues,
      warnings: [...warnings, ...validation.warnings]
    };
  }

  warnings.push(
    ...await writeTextFile(absolutePath, normalizedContent, {
      label: artifactPath
    })
  );

  if (exists) {
    warnings.push(`Replaced existing ${args.artifact} artifact: ${artifactPath}`);
  }

  warnings.push(...(await syncRoadmapPhaseCompletion(projectRoot, resolved)));

  return {
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    artifact: args.artifact,
    path: artifactPath,
    summaryPaths: summaryIndex.summaries.map((summary) => summary.path),
    written: true,
    created: !exists,
    overwritten: exists,
    status: exists ? "updated" : "created",
    issues: validation.issues,
    warnings: [...warnings, ...validation.warnings]
  };
}

export async function blueprintPhasePlanIndex(
  args: PlanIndexArgs = {}
): Promise<PhasePlanIndexResult> {
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
      plans: [],
      waves: {},
      missingPlans: [],
      warnings: located.reason ? [located.reason] : []
    };
  }

  const planPaths = located.artifacts
    .filter((artifact) => artifact.endsWith("-PLAN.md"))
    .sort((left, right) => left.localeCompare(right));
  const plans: PhasePlanRecord[] = [];
  const waves: Record<string, string[]> = {};
  const warnings: string[] = [];
  const knownPlanIds = new Set<string>();

  for (const planPath of planPaths) {
    const planId = parsePlanArtifactPath(planPath, resolved.phasePrefix);

    if (!planId) {
      warnings.push(`Ignoring non-canonical plan artifact name: ${planPath}`);
      continue;
    }

    knownPlanIds.add(planId);
    const content = await fs.readFile(resolveBlueprintPath(projectRoot, planPath), "utf8");
    const record = toPhasePlanRecord(planId, planPath, content, resolved.phaseNumber);
    plans.push(record);

    const waveKey = String(record.wave ?? "unassigned");
    waves[waveKey] ??= [];
    waves[waveKey].push(planPath);
  }

  const missingPlans =
    plans.length === 0
      ? [planPathFor(resolved, "01")]
      : plans.flatMap((plan) =>
          plan.dependsOn.flatMap((dependency) => {
            try {
              const normalizedDependency = normalizePlanId(dependency);

              return knownPlanIds.has(normalizedDependency)
                ? []
                : [planPathFor(resolved, normalizedDependency)];
            } catch {
              warnings.push(`${plan.path}: invalid depends_on reference: ${dependency}`);
              return [];
            }
          })
        );

  for (const plan of plans) {
    for (const issue of plan.issues) {
      warnings.push(`${plan.path}: ${issue}`);
    }
    for (const warning of plan.warnings) {
      warnings.push(`${plan.path}: ${warning}`);
    }
  }

  return {
    phaseFound: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    plans,
    waves,
    missingPlans: [...new Set(missingPlans)],
    warnings
  };
}

export async function blueprintPhasePlanRead(
  args: PhasePlanReadArgs
): Promise<PhasePlanReadResult> {
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
      planId: null,
      path: null,
      content: null,
      metadata: null,
      validation: null,
      reason: located.reason
    };
  }

  const planId = normalizePlanId(args.planId);
  const pathValue = planPathFor(resolved, planId);
  const absolutePath = resolveBlueprintPath(projectRoot, pathValue);

  if (!(await pathExists(absolutePath))) {
    return {
      phaseFound: true,
      found: false,
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      planId,
      path: pathValue,
      content: null,
      metadata: null,
      validation: null,
      reason: `${pathValue} does not exist yet.`
    };
  }

  const content = await fs.readFile(absolutePath, "utf8");
  const validation = validatePlanArtifactContent(content, resolved.phaseNumber);

  return {
    phaseFound: true,
    found: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    planId,
    path: pathValue,
    content,
    metadata: {
      title: validation.metadata.title,
      wave: validation.metadata.wave,
      status: validation.metadata.status,
      objective: validation.metadata.objective,
      dependsOn: validation.metadata.dependsOn,
      requirements: validation.metadata.requirements,
      filesModified: validation.metadata.filesModified,
      readFirst: validation.metadata.readFirst,
      acceptanceCriteria: validation.metadata.acceptanceCriteria,
      autonomous: validation.metadata.autonomous
    },
    validation: {
      valid: validation.valid,
      issues: validation.issues,
      warnings: validation.warnings
    },
    reason: null
  };
}

export async function blueprintPhasePlanWrite(
  args: PhasePlanWriteArgs
): Promise<PhasePlanWriteResult> {
  const { projectRoot, resolved } = await resolveLocatedPhaseForMutation(args);
  const existingIndex = await blueprintPhasePlanIndex({
    cwd: projectRoot,
    phase: resolved.phaseNumber
  });
  const nextPlanNumber =
    existingIndex.plans.length === 0
      ? 1
      : Math.max(
          ...existingIndex.plans.map((plan) => Number.parseInt(plan.planId, 10))
        ) + 1;
  const planId = args.planId ? normalizePlanId(args.planId) : normalizePlanId(String(nextPlanNumber));
  const pathValue = planPathFor(resolved, planId);
  const absolutePath = resolveBlueprintPath(projectRoot, pathValue);
  const normalizedContent = normalizeTextContent(args.content);
  const strictValidation = (args.validationMode ?? "strict") === "strict";
  const validation = validatePlanArtifactContent(normalizedContent, resolved.phaseNumber, {
    strict: strictValidation
  });
  const warnings: string[] = [];
  const normalizedFrontmatterPlanId =
    validation.metadata.planId && /^\d+$/.test(validation.metadata.planId)
      ? normalizePlanId(validation.metadata.planId)
      : null;

  if (normalizedFrontmatterPlanId && normalizedFrontmatterPlanId !== planId) {
    const issue = `Plan frontmatter plan_id "${validation.metadata.planId}" must match the requested planId "${planId}".`;

    return {
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      planId,
      path: pathValue,
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      validation: {
        valid: false,
        issues: [...validation.issues, issue],
        warnings: validation.warnings
      },
      warnings: []
    };
  }

  if (!validation.valid && strictValidation) {
    return {
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      planId,
      path: pathValue,
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      validation: {
        valid: false,
        issues: validation.issues,
        warnings: validation.warnings
      },
      warnings: []
    };
  }

  const exists = await pathExists(absolutePath);

  if (exists) {
    const existingContent = await fs.readFile(absolutePath, "utf8");

    if (existingContent === normalizedContent) {
      warnings.push(`Preserved existing plan artifact because the content was unchanged.`);

      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        planId,
        path: pathValue,
        written: false,
        created: false,
        overwritten: false,
        status: "reused",
        validation: {
          valid: validation.valid,
          issues: validation.issues,
          warnings: validation.warnings
        },
        warnings
      };
    }

    if (!(args.overwrite ?? false)) {
      throw new Error(
        `${pathValue} already exists. Re-run only after explicit overwrite confirmation.`
      );
    }
  }

  warnings.push(
    ...await writeTextFile(absolutePath, normalizedContent, {
      label: pathValue
    })
  );

  if (exists) {
    warnings.push(`Replaced existing plan artifact: ${pathValue}`);
  }

  return {
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    planId,
    path: pathValue,
    written: true,
    created: !exists,
    overwritten: exists,
    status: exists ? "updated" : "created",
    validation: {
      valid: validation.valid,
      issues: validation.issues,
      warnings: validation.warnings
    },
    warnings: [...warnings, ...validation.warnings]
  };
}

export async function blueprintPhaseSummaryIndex(
  args: PlanIndexArgs = {}
): Promise<PhaseSummaryIndexResult> {
  const located = await blueprintPhaseLocate(args);
  const resolved = toResolvedPhaseLocation(located);

  if (!resolved) {
    return {
      phaseFound: false,
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName,
      phaseDir: located.phaseDir,
      summaries: [],
      completedPlans: [],
      pendingPlans: [],
      warnings: located.reason ? [located.reason] : []
    };
  }

  const projectRoot = await ensureRepoRoot(args.cwd);
  const planIndex = await blueprintPhasePlanIndex({
    cwd: projectRoot,
    phase: resolved.phaseNumber
  });
  const summaryPaths = located.artifacts
    .filter((artifact) => artifact.endsWith("-SUMMARY.md"))
    .sort((left, right) => left.localeCompare(right));
  const summaries: PhaseSummaryRecord[] = [];
  const completedPlans = new Set<string>();
  const warnings = [...planIndex.warnings];
  const knownPlanPaths = new Map(planIndex.plans.map((plan) => [plan.planId, plan.path]));

  for (const summaryPath of summaryPaths) {
    const planId = parseSummaryArtifactPath(summaryPath, resolved.phasePrefix);

    if (!planId) {
      warnings.push(`Ignoring non-canonical summary artifact name: ${summaryPath}`);
      continue;
    }

    const content = await fs.readFile(resolveBlueprintPath(projectRoot, summaryPath), "utf8");
    summaries.push(
      toPhaseSummaryRecord(planId, summaryPath, content, knownPlanPaths.get(planId) ?? null)
    );
    completedPlans.add(planId);

    if (!knownPlanPaths.has(planId)) {
      warnings.push(`${summaryPath}: no matching plan artifact exists for this summary.`);
    }
  }

  const pendingPlans = planIndex.plans
    .map((plan) => plan.planId)
    .filter((planId) => !completedPlans.has(planId));

  return {
    phaseFound: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    summaries,
    completedPlans: [...completedPlans].sort(),
    pendingPlans,
    warnings
  };
}

export async function blueprintPhaseSummaryRead(
  args: PhaseSummaryReadArgs
): Promise<PhaseSummaryReadResult> {
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
      planId: null,
      path: null,
      content: null,
      metadata: null,
      reason: located.reason
    };
  }

  const planId = normalizePlanId(args.planId);
  const pathValue = summaryPathFor(resolved, planId);
  const absolutePath = resolveBlueprintPath(projectRoot, pathValue);

  if (!(await pathExists(absolutePath))) {
    return {
      phaseFound: true,
      found: false,
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      planId,
      path: pathValue,
      content: null,
      metadata: null,
      reason: `${pathValue} does not exist yet.`
    };
  }

  const content = await fs.readFile(absolutePath, "utf8");
  const metadata = summarizeMarkdownContent(content);
  const linkedPlanPath = planPathFor(resolved, planId);

  return {
    phaseFound: true,
    found: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    planId,
    path: pathValue,
    content,
    metadata: {
      linkedPlanPath,
      title: metadata.title,
      summary: metadata.summary
    },
    reason: null
  };
}

export async function blueprintPhaseSummaryWrite(
  args: PhaseSummaryWriteArgs
): Promise<PhaseSummaryWriteResult> {
  const { projectRoot, resolved } = await resolveLocatedPhaseForMutation(args);
  const planId = normalizePlanId(args.planId);
  const plan = await blueprintPhasePlanRead({
    cwd: projectRoot,
    phase: resolved.phaseNumber,
    planId
  });

  if (!plan.found || !plan.path) {
    throw new Error(
      `${plan.path ?? planPathFor(resolved, planId)} does not exist yet. Create the matching plan before writing a summary.`
    );
  }

  const pathValue = summaryPathFor(resolved, planId);
  const absolutePath = resolveBlueprintPath(projectRoot, pathValue);
  const normalizedContent = normalizeTextContent(args.content);
  const exists = await pathExists(absolutePath);
  const issues =
    normalizedContent.trim().length === 0
      ? ["Execution summary content must not be empty."]
      : [];
  const warnings =
    normalizedContent.trim().length === 0
      ? ([] as string[])
      : validateSummaryArtifactContent(normalizedContent).warnings;

  if (exists) {
    const existingContent = await fs.readFile(absolutePath, "utf8");

    if (existingContent === normalizedContent) {
      warnings.push(`Preserved existing summary artifact because the content was unchanged.`);

      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        planId,
        path: pathValue,
        linkedPlanPath: plan.path,
        written: false,
        created: false,
        overwritten: false,
        status: "reused",
        issues,
        warnings
      };
    }

    if (!(args.overwrite ?? false)) {
      throw new Error(
        `${pathValue} already exists. Re-run only after explicit overwrite confirmation.`
      );
    }
  }

  if (issues.length > 0) {
    return {
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      planId,
      path: pathValue,
      linkedPlanPath: plan.path,
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      issues,
      warnings
    };
  }

  warnings.push(
    ...await writeTextFile(absolutePath, normalizedContent, {
      label: pathValue
    })
  );

  if (exists) {
    warnings.push(`Replaced existing summary artifact: ${pathValue}`);
  }

  return {
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    planId,
    path: pathValue,
    linkedPlanPath: plan.path,
    written: true,
    created: !exists,
    overwritten: exists,
    status: exists ? "updated" : "created",
    issues,
    warnings
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
    safeJsonParseObject(await fs.readFile(absolutePath, "utf8"), {
      label: checkpointPath,
      maxBytes: 256 * 1024
    }),
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
  const nextCheckpoint = ensureCheckpointForPersistence(args.checkpoint, checkpointPath);
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

  await writeJsonFile(absolutePath, nextCheckpoint);

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
    name: "blueprint_roadmap_add_phase",
    description:
      "Append a new integer phase to the active Blueprint roadmap, ignoring decimal insertions when choosing the next phase number.",
    inputSchema: roadmapAddPhaseInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintRoadmapAddPhase(args as RoadmapAddPhaseArgs)
  },
  {
    name: "blueprint_roadmap_insert_phase",
    description:
      "Insert the next decimal Blueprint phase after an existing integer phase and derive the matching phase directory path without renumbering later phases.",
    inputSchema: roadmapInsertPhaseInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintRoadmapInsertPhase(args as RoadmapInsertPhaseArgs)
  },
  {
    name: "blueprint_roadmap_remove_phase",
    description:
      "Remove a future Blueprint phase, delete its phase directory, and renumber subsequent phase directories plus roadmap references.",
    inputSchema: roadmapRemovePhaseInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintRoadmapRemovePhase(args as RoadmapRemovePhaseArgs)
  },
  {
    name: "blueprint_roadmap_promote_backlog",
    description:
      "Preview or promote selected backlog items into appended roadmap phases while reusing reserved 999.x phase stubs when available.",
    inputSchema: roadmapPromoteBacklogInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintRoadmapPromoteBacklog(args as RoadmapPromoteBacklogArgs)
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
    name: "blueprint_phase_plan_index",
    description:
      "Index phase plan artifacts, dependency waves, and missing plan prerequisites without mutating repo state.",
    inputSchema: phasePlanInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhasePlanIndex(args as PlanIndexArgs)
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
    name: "blueprint_phase_validation_read",
    description:
      "Read a phase-scoped validation artifact such as VERIFICATION or UAT together with execution-summary coverage.",
    inputSchema: phaseValidationArtifactInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseValidationRead(args as PhaseValidationReadArgs)
  },
  {
    name: "blueprint_phase_validation_write",
    description:
      "Persist a phase-scoped VERIFICATION or UAT artifact with overwrite protection and execution-aware prerequisite checks.",
    inputSchema: phaseValidationWriteInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseValidationWrite(args as PhaseValidationWriteArgs)
  },
  {
    name: "blueprint_phase_plan_read",
    description:
      "Read a phase-scoped PLAN artifact together with parsed metadata and validation signals.",
    inputSchema: phasePlanReadInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhasePlanRead(args as PhasePlanReadArgs)
  },
  {
    name: "blueprint_phase_plan_write",
    description:
      "Persist substantive phase-scoped PLAN artifact content with overwrite protection and validation.",
    inputSchema: phasePlanWriteInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhasePlanWrite(args as PhasePlanWriteArgs)
  },
  {
    name: "blueprint_phase_summary_index",
    description:
      "Index phase SUMMARY artifacts and report which plans still need execution summaries.",
    inputSchema: phasePlanInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseSummaryIndex(args as PlanIndexArgs)
  },
  {
    name: "blueprint_phase_summary_read",
    description:
      "Read a phase-scoped SUMMARY artifact together with its linked plan path and concise metadata.",
    inputSchema: phaseSummaryReadInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseSummaryRead(args as PhaseSummaryReadArgs)
  },
  {
    name: "blueprint_phase_summary_write",
    description:
      "Persist substantive phase-scoped SUMMARY artifact content for an existing plan with overwrite protection.",
    inputSchema: phaseSummaryWriteInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseSummaryWrite(args as PhaseSummaryWriteArgs)
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
