import { promises as fs } from "node:fs";
import path from "node:path";

import * as z from "zod/v4";

import {
  assertNoNullBytes,
  ensurePathWithinRootSync,
  formatBlueprintPhasePrefix,
  normalizeBlueprintPhaseRef,
  prepareTextForPersistence,
  resolveRepoRelativeInputPathSync,
  safeJsonParseObject
} from "../../shared/security.js";
import { blueprintConfigGet } from "./config.js";

export const BLUEPRINT_DIR = ".blueprint";
export const BLUEPRINT_STATE_PATH = `${BLUEPRINT_DIR}/STATE.md`;
export const BLUEPRINT_CONFIG_PATH = `${BLUEPRINT_DIR}/config.json`;
export const BLUEPRINT_PHASES_PATH = `${BLUEPRINT_DIR}/phases`;
export const BLUEPRINT_REPORTS_PATH = `${BLUEPRINT_DIR}/reports`;
export const BLUEPRINT_CODEBASE_PATH = `${BLUEPRINT_DIR}/codebase`;
export const BLUEPRINT_BACKLOG_PATH = `${BLUEPRINT_DIR}/backlog`;
export const BLUEPRINT_TODOS_PATH = `${BLUEPRINT_DIR}/todos`;
export const BLUEPRINT_NOTES_PATH = `${BLUEPRINT_DIR}/notes`;
export const BLUEPRINT_BACKLOG_INDEX_PATH = `${BLUEPRINT_BACKLOG_PATH}/BACKLOG.md`;
export const BLUEPRINT_TODO_INDEX_PATH = `${BLUEPRINT_TODOS_PATH}/TODO.md`;
export const BLUEPRINT_NOTES_INDEX_PATH = `${BLUEPRINT_NOTES_PATH}/NOTES.md`;
export const SUPPORTED_BOOTSTRAP_ARTIFACTS = [
  `${BLUEPRINT_DIR}/PROJECT.md`,
  `${BLUEPRINT_DIR}/REQUIREMENTS.md`,
  `${BLUEPRINT_DIR}/ROADMAP.md`,
  `${BLUEPRINT_DIR}/phases/`
] as const;
export const CORE_PROJECT_ARTIFACTS = [
  `${BLUEPRINT_DIR}/PROJECT.md`,
  `${BLUEPRINT_DIR}/REQUIREMENTS.md`,
  `${BLUEPRINT_DIR}/ROADMAP.md`,
  BLUEPRINT_STATE_PATH,
  BLUEPRINT_CONFIG_PATH,
  `${BLUEPRINT_DIR}/phases/`
] as const;
export const CODEBASE_ARTIFACTS = [
  `${BLUEPRINT_CODEBASE_PATH}/STACK.md`,
  `${BLUEPRINT_CODEBASE_PATH}/ARCHITECTURE.md`,
  `${BLUEPRINT_CODEBASE_PATH}/STRUCTURE.md`,
  `${BLUEPRINT_CODEBASE_PATH}/CONVENTIONS.md`,
  `${BLUEPRINT_CODEBASE_PATH}/TESTING.md`,
  `${BLUEPRINT_CODEBASE_PATH}/INTEGRATIONS.md`,
  `${BLUEPRINT_CODEBASE_PATH}/CONCERNS.md`
] as const;
export const SUPPORTED_SCAFFOLD_ARTIFACTS = [
  ...SUPPORTED_BOOTSTRAP_ARTIFACTS,
  ...CODEBASE_ARTIFACTS
] as const;
const SCAFFOLD_PHASE_ARTIFACT_PATTERN =
  /^\.blueprint\/phases\/([^/]+)\/((\d+(?:\.\d+)?)-(?:(\d+)-PLAN|(CONTEXT|DISCUSSION-LOG|RESEARCH|UI-SPEC))\.md)$/;
const SCAFFOLD_ARTIFACT_PATH_GUIDANCE =
  "Use repo-relative Blueprint artifact paths such as `.blueprint/codebase/STACK.md` or `.blueprint/phases/03-auth/03-CONTEXT.md`; bare names like `STACK` and absolute filesystem paths are not supported.";

export type SupportedScaffoldArtifact =
  (typeof SUPPORTED_SCAFFOLD_ARTIFACTS)[number];
export type BlueprintReadiness = "uninitialized" | "partial" | "initialized";
export type BootstrapRepoShape = "greenfield" | "scaffold-only" | "brownfield";
export type BootstrapRequirementRow = {
  id: string;
  requirement: string;
  status: string;
  notes: string;
};
export type BootstrapRoadmapPhase = {
  phase: string;
  title: string;
  status?: "planned" | "in_progress" | "done";
  objective: string;
  requirementIds?: string[];
  notes?: string[];
};
export type BootstrapSeed = {
  vision?: string;
  audience?: {
    primary?: string[];
    secondary?: string[];
  };
  constraints?: string[];
  currentMilestone?: string;
  nonGoals?: string[];
  requirements?: BootstrapRequirementRow[];
  roadmapPhases?: BootstrapRoadmapPhase[];
  brownfieldMode?: BootstrapRepoShape;
  assumptions?: string[];
};
export type BootstrapAssessment = {
  repoShape: BootstrapRepoShape;
  codebaseMapped: boolean;
  provisionalRoadmap: boolean;
  recommendedNextAction: string;
  reasons: string[];
};
export type BootstrapArtifactDiagnostics = {
  placeholderArtifacts: string[];
  traceabilityWarnings: string[];
  brownfield: BootstrapAssessment;
};

type ArtifactScaffoldArgs = {
  cwd?: string;
  artifacts?: string[];
  overwrite?: boolean;
  projectName?: string;
  bootstrapSeed?: BootstrapSeed;
};

type ArtifactListArgs = {
  cwd?: string;
};

type ArtifactMutateIndexTarget = "backlog" | "todo" | "note";
type ArtifactMutateIndexAction = "append" | "list" | "update";
type ArtifactMutateIndexUpdate = {
  id: string;
  status?: string;
  description?: string;
  reservedPhase?: string | null;
};

type ArtifactMutateIndexArgs = {
  cwd?: string;
  target: ArtifactMutateIndexTarget;
  action?: ArtifactMutateIndexAction;
  entry?: {
    text: string;
    status?: string;
    addedAt?: string;
    reservePhaseStub?: boolean;
  };
  filter?: {
    query?: string;
    ids?: string[];
    statuses?: string[];
    limit?: number;
  };
  match?: {
    id?: string;
    text?: string;
  };
  update?: {
    status?: string;
  };
  updates?: ArtifactMutateIndexUpdate[];
};

type ArtifactScaffoldResult = {
  createdFiles: string[];
  reusedFiles: string[];
  warnings: string[];
};

type ArtifactListResult = {
  artifacts: {
    core: string[];
    phases: string[];
    codebase: string[];
  };
  reports: string[];
  missing: string[];
  warnings: string[];
};

type ArtifactMutateIndexReservedPhase = {
  phaseNumber: string;
  phasePrefix: string;
  phaseDir: string;
  artifactPaths: string[];
};

type ArtifactMutateIndexResult = {
  status:
    | "created"
    | "updated"
    | "duplicate"
    | "listed"
    | "not_found"
    | "project_missing"
    | "invalid";
  targetPath: string;
  createdEntryIds: string[];
  duplicateEntryIds: string[];
  matchedEntryIds: string[];
  updatedCounts: {
    added: number;
    updated: number;
    duplicates: number;
    preserved: number;
  };
  reservedPhase: ArtifactMutateIndexReservedPhase | null;
  entries: CaptureIndexRow[];
  summary: {
    total: number;
    matched: number;
    open: number;
    active: number;
    completed: number;
    other: number;
  };
  warnings: string[];
};

type ArtifactValidateArgs = {
  cwd?: string;
};

type ArtifactValidateResult = {
  valid: boolean;
  issues: string[];
  suggestedRepairs: string[];
  warnings: string[];
};

type ArtifactSummaryDigestArgs = {
  cwd?: string;
  focusArea?: string;
  packageJsonPath?: string;
  readmePath?: string;
  sourceFiles?: string[];
  testFiles?: string[];
  docFiles?: string[];
  trackedFiles?: string[];
  artifactPaths?: string[];
};

type ArtifactReportWriteArgs = {
  cwd?: string;
  reportName: string;
  content: string;
  overwrite?: boolean;
};

type ArtifactSummaryDigestSection = {
  artifact: string;
  title: string;
  summary: string;
  evidence: string[];
};

type ArtifactSummaryDigestResult = {
  digest: ArtifactSummaryDigestSection[];
  inputsUsed: string[];
};

type ArtifactReportWriteResult = {
  path: string;
  written: boolean;
  created: boolean;
  overwritten: boolean;
  status: "created" | "updated" | "reused" | "invalid";
  warnings: string[];
};

type TextWriteOptions = {
  label?: string;
  enforcePromptBoundary?: boolean;
};

export type CaptureIndexRow = {
  id: string;
  added: string;
  status: string | null;
  description: string;
  reservedPhase: string | null;
};

type BootstrapRenderContext = {
  projectName: string;
  bootstrapSeed?: BootstrapSeed;
  bootstrapAssessment: BootstrapAssessment;
};
type ArtifactRenderer = (context: BootstrapRenderContext) => string;
export type PlanArtifactMetadata = {
  phase: string | null;
  planId: string | null;
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
};
type PhaseArtifactRequest = {
  artifact: string;
  phaseDir: string;
  phaseName: string;
  phasePrefix: string;
  kind: "CONTEXT" | "DISCUSSION-LOG" | "RESEARCH" | "UI-SPEC" | "PLAN";
  planId: string | null;
};

const BOOTSTRAP_SOURCE_DIRECTORIES = new Set([
  "src",
  "app",
  "lib",
  "server",
  "client",
  "packages",
  "tests"
]);
const BOOTSTRAP_MANIFEST_FILES = new Set([
  "package.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "Gemfile",
  "pom.xml",
  "build.gradle",
  "composer.json",
  "mix.exs"
]);
const BOOTSTRAP_IGNORED_ROOT_ENTRIES = new Set([
  ".git",
  ".blueprint",
  "README",
  "README.md",
  "LICENSE",
  "LICENSE.md",
  ".gitignore",
  ".gitattributes",
  ".editorconfig",
  ".nvmrc"
]);
const BOOTSTRAP_PLACEHOLDER_SIGNALS: Record<string, string[]> = {
  ".blueprint/PROJECT.md": [
    "Describe the product outcome Blueprint should help this repository reach.",
    "Define the smallest useful milestone that should land first."
  ],
  ".blueprint/REQUIREMENTS.md": [
    "Replace this placeholder with the first real requirement."
  ],
  ".blueprint/ROADMAP.md": [
    "Replace this starter roadmap with real phase goals before execution."
  ]
};

const CAPTURE_INDEX_TARGETS = ["backlog", "todo", "note"] as const;

type CaptureIndexConfig = {
  targetPath: string;
  title: string;
  sectionHeading: string;
  idPrefix: string;
  defaultStatus: string | null;
  supportsReservedPhase: boolean;
  emptyState: string;
};

const CAPTURE_INDEX_CONFIG: Record<ArtifactMutateIndexTarget, CaptureIndexConfig> = {
  backlog: {
    targetPath: BLUEPRINT_BACKLOG_INDEX_PATH,
    title: "Backlog",
    sectionHeading: "Parking Lot",
    idPrefix: "BACKLOG",
    defaultStatus: "backlog",
    supportsReservedPhase: true,
    emptyState: "No backlog items recorded yet."
  },
  todo: {
    targetPath: BLUEPRINT_TODO_INDEX_PATH,
    title: "Todos",
    sectionHeading: "Open Items",
    idPrefix: "TODO",
    defaultStatus: "open",
    supportsReservedPhase: false,
    emptyState: "No todo items recorded yet."
  },
  note: {
    targetPath: BLUEPRINT_NOTES_INDEX_PATH,
    title: "Notes",
    sectionHeading: "Entries",
    idPrefix: "NOTE",
    defaultStatus: null,
    supportsReservedPhase: false,
    emptyState: "No notes recorded yet."
  }
};

function normalizeList(values: string[] | undefined, fallback: string[]): string[] {
  const normalized = (values ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return normalized.length > 0 ? normalized : fallback;
}

function escapeTableCell(value: string): string {
  return value.replaceAll("|", "\\|").trim();
}

function titleCaseBootstrapShape(value: BootstrapRepoShape): string {
  return value
    .split("-")
    .map((segment) => `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`)
    .join(" ");
}

function normalizeCaptureText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeCaptureStatus(value?: string | null): string {
  return normalizeCaptureText(value ?? "").toLowerCase();
}

function canonicalizeTodoStatus(
  value?: string | null,
  options: { strict?: boolean } = {}
): string {
  const normalized = normalizeCaptureStatus(value);

  if (normalized.length === 0) {
    return "open";
  }

  if (["open", "pending", "todo"].includes(normalized)) {
    return "open";
  }

  if (
    [
      "active",
      "selected",
      "current",
      "working",
      "in progress",
      "in-progress",
      "in_progress"
    ].includes(normalized)
  ) {
    return "active";
  }

  if (["completed", "complete", "done", "closed", "finished"].includes(normalized)) {
    return "completed";
  }

  if (options.strict ?? true) {
    throw new Error(
      `Todo status must be one of: open, active, completed. Received: ${value ?? ""}`
    );
  }

  return normalized;
}

function normalizeStoredCaptureStatus(
  target: ArtifactMutateIndexTarget,
  value?: string | null
): string | null {
  const normalized = normalizeCaptureStatus(value);

  if (normalized.length === 0) {
    return null;
  }

  if (target === "todo") {
    return canonicalizeTodoStatus(normalized, { strict: false });
  }

  return normalized;
}

function captureDedupKey(value: string): string {
  return normalizeCaptureText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeCaptureDate(value?: string): string {
  if (!value || value.trim().length === 0) {
    return new Date().toISOString().slice(0, 10);
  }

  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Capture entry addedAt must be a valid ISO date or YYYY-MM-DD value: ${value}`);
  }

  return parsed.toISOString().slice(0, 10);
}

function slugifyCaptureEntry(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .toLowerCase()
    .replace(/[_\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : "backlog-item";
}

function nextCaptureEntryId(rows: CaptureIndexRow[], idPrefix: string): string {
  const suffixes = rows
    .map((row) => row.id.match(new RegExp(`^${idPrefix}-(\\d+)$`))?.[1])
    .map((value) => (value ? Number.parseInt(value, 10) : Number.NaN))
    .filter((value) => !Number.isNaN(value));
  const nextValue = suffixes.length === 0 ? 1 : Math.max(...suffixes) + 1;

  return `${idPrefix}-${String(nextValue).padStart(3, "0")}`;
}

function nextBacklogReservedPhase(rows: CaptureIndexRow[]): string {
  const suffixes = rows
    .map((row) => row.reservedPhase?.match(/^999\.(\d+)$/)?.[1])
    .map((value) => (value ? Number.parseInt(value, 10) : Number.NaN))
    .filter((value) => !Number.isNaN(value));
  const nextSuffix = suffixes.length === 0 ? 1 : Math.max(...suffixes) + 1;

  return `999.${nextSuffix}`;
}

function buildReservedBacklogPhase(
  rows: CaptureIndexRow[],
  description: string
): ArtifactMutateIndexReservedPhase {
  const phaseNumber = nextBacklogReservedPhase(rows);
  const phaseDir = `${BLUEPRINT_PHASES_PATH}/${phaseNumber}-${slugifyCaptureEntry(description)}`;

  return {
    phaseNumber,
    phasePrefix: phaseNumber,
    phaseDir,
    artifactPaths: [`${phaseDir}/${phaseNumber}-CONTEXT.md`]
  };
}

function renderCaptureIndexRow(
  target: ArtifactMutateIndexTarget,
  row: CaptureIndexRow
): string {
  const config = CAPTURE_INDEX_CONFIG[target];
  const lines = [`### ${row.id}`, `- Added: ${row.added}`];

  if (config.defaultStatus !== null) {
    lines.push(`- Status: ${row.status ?? config.defaultStatus}`);
  }

  if (config.supportsReservedPhase && row.reservedPhase) {
    lines.push(`- Reserved Phase: ${row.reservedPhase}`);
  }

  lines.push(`- Description: ${row.description}`);

  return lines.join("\n");
}

function renderCaptureIndexDocument(
  target: ArtifactMutateIndexTarget,
  rows: CaptureIndexRow[],
  recoveryContent?: string | null
): string {
  const config = CAPTURE_INDEX_CONFIG[target];
  const body =
    rows.length === 0
      ? `- ${config.emptyState}`
      : rows.map((row) => renderCaptureIndexRow(target, row)).join("\n\n");
  const recoverySection =
    recoveryContent && recoveryContent.trim().length > 0
      ? `\n\n## Recovery Notes\n\nThe previous index content did not match Blueprint's canonical format and was preserved below during repair.\n\n\`\`\`text\n${recoveryContent.trim()}\n\`\`\``
      : "";

  return `# ${config.title}

## ${config.sectionHeading}

${body}${recoverySection}
`;
}

function parseCaptureRowBlock(
  block: string,
  target: ArtifactMutateIndexTarget
): CaptureIndexRow | null {
  const [heading, ...restLines] = block.trim().split("\n");
  const headingMatch = heading?.match(/^### ([A-Z]+-\d+)$/);

  if (!headingMatch) {
    return null;
  }

  const fields = new Map<string, string>();

  for (const line of restLines) {
    const match = line.match(/^- ([A-Za-z ]+):\s*(.+)$/);

    if (!match) {
      continue;
    }

    fields.set(match[1].trim().toLowerCase(), match[2].trim());
  }

  const description = fields.get("description");
  const added = fields.get("added");

  if (!description || !added) {
    return null;
  }

  const config = CAPTURE_INDEX_CONFIG[target];

  return {
    id: headingMatch[1],
    added,
    status:
      config.defaultStatus !== null
        ? normalizeStoredCaptureStatus(target, fields.get("status")) ?? config.defaultStatus
        : null,
    description,
    reservedPhase:
      config.supportsReservedPhase ? fields.get("reserved phase") ?? null : null
  };
}

function matchesCaptureQuery(row: CaptureIndexRow, query?: string): boolean {
  const normalizedQuery = normalizeCaptureText(query ?? "").toLowerCase();

  if (normalizedQuery.length === 0) {
    return true;
  }

  return (
    row.id.toLowerCase().includes(normalizedQuery) ||
    row.description.toLowerCase().includes(normalizedQuery)
  );
}

function filterCaptureRows(
  rows: CaptureIndexRow[],
  target: ArtifactMutateIndexTarget,
  filter: ArtifactMutateIndexArgs["filter"],
  options: { defaultTodoStatuses?: boolean } = {}
): CaptureIndexRow[] {
  const requestedIds = new Set(
    (filter?.ids ?? [])
      .map((value) => normalizeCaptureText(value))
      .filter((value) => value.length > 0)
  );
  const requestedStatuses = new Set(
    (filter?.statuses ?? [])
      .map((value) =>
        target === "todo"
          ? canonicalizeTodoStatus(value, { strict: false })
          : normalizeCaptureStatus(value)
      )
      .filter((value) => value.length > 0)
  );
  const useDefaultTodoStatuses =
    target === "todo" && requestedStatuses.size === 0 && (options.defaultTodoStatuses ?? false);
  const sortedRows =
    target === "todo"
      ? [...rows].sort((left, right) => {
          const rank = (value: string | null): number => {
            const status = canonicalizeTodoStatus(value, { strict: false });

            if (status === "active") {
              return 0;
            }

            if (status === "open") {
              return 1;
            }

            if (status === "completed") {
              return 2;
            }

            return 3;
          };

          return rank(left.status) - rank(right.status);
        })
      : rows;
  const filtered = sortedRows.filter((row) => {
    if (requestedIds.size > 0 && !requestedIds.has(row.id)) {
      return false;
    }

    const rowStatus =
      target === "todo"
        ? canonicalizeTodoStatus(row.status, { strict: false })
        : normalizeCaptureStatus(row.status);

    if (requestedStatuses.size > 0 && !requestedStatuses.has(rowStatus)) {
      return false;
    }

    if (useDefaultTodoStatuses && !["open", "active"].includes(rowStatus)) {
      return false;
    }

    return matchesCaptureQuery(row, filter?.query);
  });
  const limit = filter?.limit;

  if (!limit || limit <= 0 || filtered.length <= limit) {
    return filtered;
  }

  return filtered.slice(0, limit);
}

function summarizeCaptureRows(
  rows: CaptureIndexRow[],
  matchedRows: CaptureIndexRow[],
  target: ArtifactMutateIndexTarget
): ArtifactMutateIndexResult["summary"] {
  const summary = {
    total: rows.length,
    matched: matchedRows.length,
    open: 0,
    active: 0,
    completed: 0,
    other: 0
  };

  for (const row of matchedRows) {
    const normalizedStatus =
      target === "todo"
        ? canonicalizeTodoStatus(row.status, { strict: false })
        : normalizeCaptureStatus(row.status);

    if (normalizedStatus === "open") {
      summary.open += 1;
    } else if (normalizedStatus === "active") {
      summary.active += 1;
    } else if (normalizedStatus === "completed") {
      summary.completed += 1;
    } else if (normalizedStatus.length > 0) {
      summary.other += 1;
    }
  }

  return summary;
}

function buildEmptyCaptureMutationResult(
  targetPath: string,
  status: ArtifactMutateIndexResult["status"],
  warnings: string[] = []
): ArtifactMutateIndexResult {
  return {
    status,
    targetPath,
    createdEntryIds: [],
    duplicateEntryIds: [],
    matchedEntryIds: [],
    updatedCounts: {
      added: 0,
      updated: 0,
      duplicates: 0,
      preserved: 0
    },
    reservedPhase: null,
    entries: [],
    summary: {
      total: 0,
      matched: 0,
      open: 0,
      active: 0,
      completed: 0,
      other: 0
    },
    warnings
  };
}

export function parseCaptureIndexDocument(
  content: string,
  target: ArtifactMutateIndexTarget
): {
  rows: CaptureIndexRow[];
  malformed: boolean;
  recoveryContent: string | null;
} {
  const config = CAPTURE_INDEX_CONFIG[target];
  const section = extractMarkdownSection(content, config.sectionHeading);

  if (content.trim().length === 0) {
    return {
      rows: [],
      malformed: false,
      recoveryContent: null
    };
  }

  if (!section) {
    return {
      rows: [],
      malformed: true,
      recoveryContent: content
    };
  }

  const trimmedSection = section.trim();

  if (
    trimmedSection.length === 0 ||
    trimmedSection === `- ${config.emptyState}`
  ) {
    return {
      rows: [],
      malformed: false,
      recoveryContent: null
    };
  }

  const blocks = trimmedSection
    .split(/\n(?=### )/g)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
  const rows = blocks
    .map((block) => parseCaptureRowBlock(block, target))
    .filter((row): row is CaptureIndexRow => row !== null);
  const malformed = rows.length !== blocks.length;

  return {
    rows,
    malformed,
    recoveryContent: malformed ? content : null
  };
}

function buildDefaultBootstrapSeed(
  projectName: string,
  assessment: BootstrapAssessment,
  seed?: BootstrapSeed
): Required<BootstrapSeed> {
  const defaultVision =
    assessment.repoShape === "brownfield"
      ? `Bring ${projectName} under Blueprint with a trustworthy understanding of the existing repo, durable requirements, and a roadmap that stays provisional until the codebase is mapped.`
      : `Establish ${projectName} with a durable Blueprint bootstrap draft so later discovery, planning, and execution commands inherit clear project intent and requirement traceability.`;
  const defaultPrimaryAudience =
    assessment.repoShape === "brownfield"
      ? ["Maintainers aligning an existing codebase with Blueprint-managed planning."]
      : ["Maintainers shaping the first milestone and execution path for the repo."];
  const defaultSecondaryAudience = [
    "Future contributors who need durable project context before they plan or implement changes."
  ];
  const defaultConstraints = [
    "Project state lives in `.blueprint/`.",
    "Persistent mutations must flow through Blueprint MCP tools.",
    assessment.repoShape === "brownfield"
      ? "Existing repo behavior should be preserved while Blueprint planning is introduced."
      : "Bootstrap artifacts should be specific enough to guide later commands without pretending every product decision is already final."
  ];
  const defaultMilestone =
    seed?.currentMilestone?.trim() ||
    (assessment.repoShape === "brownfield" ? "v1-existing-repo-alignment" : "v1");
  const defaultNonGoals = [
    "Hidden runtime conventions.",
    "Undocumented aliases.",
    assessment.repoShape === "brownfield"
      ? "Treating the roadmap as fully durable before `/blu-map-codebase` captures the existing repo."
      : "Prompt-only bootstrap artifacts that skip requirement or roadmap traceability."
  ];
  const defaultRequirements: BootstrapRequirementRow[] =
    assessment.repoShape === "brownfield"
      ? [
          {
            id: "RQ-01",
            requirement:
              "Document the repo's current product direction, technical boundaries, and maintenance constraints before downstream planning.",
            status: "Pending",
            notes: "Brownfield bootstrap requirement."
          },
          {
            id: "RQ-02",
            requirement:
              "Create a requirement set whose IDs remain traceable from the roadmap and later phase artifacts.",
            status: "Pending",
            notes: "Traceability must survive later lifecycle commands."
          },
          {
            id: "RQ-03",
            requirement:
              "Map the existing codebase before treating later roadmap phases as durable execution commitments.",
            status: "Pending",
            notes: "Unmapped brownfield repos should route to `/blu-map-codebase`."
          }
        ]
      : [
          {
            id: "RQ-01",
            requirement:
              `Define the product outcome and first-milestone goals for ${projectName}.`,
            status: "Pending",
            notes: "Bootstrap draft requirement."
          },
          {
            id: "RQ-02",
            requirement:
              "Record durable constraints, non-goals, and acceptance boundaries before detailed planning starts.",
            status: "Pending",
            notes: "Keeps later discovery and planning grounded."
          },
          {
            id: "RQ-03",
            requirement:
              "Prepare the repo for Blueprint lifecycle commands with stable requirement and roadmap traceability.",
            status: "Pending",
            notes: "Foundation requirement for later phases."
          }
        ];
  const defaultRoadmapPhases: BootstrapRoadmapPhase[] =
    assessment.repoShape === "brownfield"
      ? [
          {
            phase: "1",
            title: "Map Existing Codebase",
            objective:
              "Capture the current repo architecture, constraints, and risk areas before locking in later delivery phases.",
            requirementIds: ["RQ-01", "RQ-03"],
            notes: [
              "Route to `/blu-map-codebase` immediately after bootstrap.",
              "Treat later phases as provisional until mapping is complete."
            ]
          },
          {
            phase: "2",
            title: "Align Requirements And Roadmap",
            objective:
              "Refine milestone scope and convert bootstrap findings into durable phased work once mapping evidence exists.",
            requirementIds: ["RQ-02", "RQ-03"]
          }
        ]
      : [
          {
            phase: "1",
            title: "Discovery And Definition",
            objective:
              "Confirm product intent, user constraints, and first-milestone scope before deeper lifecycle commands run.",
            requirementIds: ["RQ-01", "RQ-02"]
          },
          {
            phase: "2",
            title: "Foundation Bootstrap",
            objective:
              "Turn the bootstrap draft into durable planning inputs for later execution-oriented phases.",
            requirementIds: ["RQ-02", "RQ-03"]
          }
        ];
  const defaultAssumptions =
    assessment.repoShape === "brownfield"
      ? [
          "The repo already contains implementation context that should be mapped before the roadmap is treated as durable.",
          "Bootstrap artifacts should stay explicit about which parts are draft assumptions."
        ]
      : [
          "The first milestone should stay small enough to validate Blueprint's workflow on this repo.",
          "Bootstrap artifacts can start as draft planning inputs as long as they are no longer placeholder-only shells."
        ];

  return {
    vision: seed?.vision?.trim() || defaultVision,
    audience: {
      primary: normalizeList(seed?.audience?.primary, defaultPrimaryAudience),
      secondary: normalizeList(seed?.audience?.secondary, defaultSecondaryAudience)
    },
    constraints: normalizeList(seed?.constraints, defaultConstraints),
    currentMilestone: defaultMilestone,
    nonGoals: normalizeList(seed?.nonGoals, defaultNonGoals),
    requirements:
      seed?.requirements?.filter(
        (requirement) =>
          requirement.id.trim().length > 0 && requirement.requirement.trim().length > 0
      ) ?? defaultRequirements,
    roadmapPhases:
      seed?.roadmapPhases?.filter(
        (phase) => phase.phase.trim().length > 0 && phase.title.trim().length > 0
      ) ?? defaultRoadmapPhases,
    brownfieldMode: seed?.brownfieldMode ?? assessment.repoShape,
    assumptions: normalizeList(seed?.assumptions, defaultAssumptions)
  };
}

function renderProjectArtifact(context: BootstrapRenderContext): string {
  const seed = buildDefaultBootstrapSeed(
    context.projectName,
    context.bootstrapAssessment,
    context.bootstrapSeed
  );
  const primaryAudience = normalizeList(seed.audience.primary, []);
  const secondaryAudience = normalizeList(seed.audience.secondary, []);

  return `# ${context.projectName}

## Vision

${seed.vision}

## Audience

${primaryAudience.map((value) => `- Primary: ${value}`).join("\n")}
${secondaryAudience.map((value) => `- Secondary: ${value}`).join("\n")}

## Constraints

${seed.constraints.map((value) => `- ${value}`).join("\n")}

## Current Milestone

${seed.currentMilestone}

## Non-Goals

${seed.nonGoals.map((value) => `- ${value}`).join("\n")}

## Assumptions

${seed.assumptions.map((value) => `- ${value}`).join("\n")}
`;
}

const REQUIRED_RESEARCH_SECTIONS = [
  "Phase Requirements",
  "Summary",
  "User Constraints",
  "Standard Stack",
  "Architecture Patterns",
  "Don't Hand-Roll",
  "Common Pitfalls",
  "Code Examples",
  "Recommendations",
  "Sources"
] as const;
const RESEARCH_CONFIDENCE_VALUES = ["LOW", "MEDIUM", "HIGH"] as const;
const RESEARCH_TEMPLATE_PLACEHOLDER_SIGNALS = [
  "Phase XX:",
  "<Phase Name>",
  "<YYYY-MM-DD>",
  "<research domain>",
  "<requirement-id>",
  "<phase requirement>",
  "<evidence-backed guidance>",
  "<key conclusion>",
  "<repo, product, or workflow constraint>",
  "<runtime, library, or shared repo pattern>",
  "<durable implementation pattern>",
  "<existing tool, helper, or platform feature>",
  "<failure mode or regression risk>",
  "<short code or pseudocode example>",
  "<prescriptive recommendation with tradeoffs>",
  "<repo path, URL, or cited file reference>"
] as const;
const REQUIRED_PLAN_SECTIONS = [
  "Goal",
  "Scope",
  "Tasks",
  "Verification",
  "Must Haves"
] as const;
const PLAN_PLACEHOLDER_SIGNALS = [
  "Replace with a concrete, execution-ready goal.",
  "Replace with the exact requirement IDs this plan addresses.",
  "Replace with the real repo paths the executor must touch.",
  "Replace with grep/test-verifiable acceptance criteria.",
  "*Generated by `blueprint_artifact_scaffold`*"
] as const;

function renderResearchArtifactTemplate(phaseLabel: string, domain: string): string {
  return `# ${phaseLabel} - Research

**Researched:** <YYYY-MM-DD>
**Domain:** ${domain}
**Confidence:** LOW|MEDIUM|HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| <requirement-id> | <phase requirement> | <evidence-backed guidance> |

## Summary

- <key conclusion>

## User Constraints

- <repo, product, or workflow constraint>

## Standard Stack

- <runtime, library, or shared repo pattern>

## Architecture Patterns

- <durable implementation pattern>

## Don't Hand-Roll

- <existing tool, helper, or platform feature>

## Common Pitfalls

- <failure mode or regression risk>

## Code Examples

\`\`\`text
<short code or pseudocode example>
\`\`\`

## Recommendations

- <prescriptive recommendation with tradeoffs>

## Sources

- <repo path, URL, or cited file reference> - why it matters
`;
}

function renderRequirementsArtifact(context: BootstrapRenderContext): string {
  const seed = buildDefaultBootstrapSeed(
    context.projectName,
    context.bootstrapAssessment,
    context.bootstrapSeed
  );
  const rows = seed.requirements
    .map(
      (requirement) =>
        `| ${escapeTableCell(requirement.id)} | ${escapeTableCell(requirement.requirement)} | ${escapeTableCell(requirement.status)} | ${escapeTableCell(requirement.notes)} |`
    )
    .join("\n");

  return `# Requirements: ${context.projectName}

## Requirements Table

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
${rows}

## Traceability Notes

- Keep every requirement ID referenced from \`.blueprint/ROADMAP.md\` before execution planning begins.
- Preserve requirement IDs across later phase artifacts instead of silently renumbering them.
- ${context.bootstrapAssessment.repoShape === "brownfield"
    ? "Treat brownfield roadmap coverage as provisional until `/blu-map-codebase` has captured the existing repo."
    : "Use these requirements as the durable baseline for later discovery and planning."}

## Open Questions

${seed.assumptions.map((value) => `- Revisit: ${value}`).join("\n")}
`;
}

function renderRoadmapArtifact(context: BootstrapRenderContext): string {
  const seed = buildDefaultBootstrapSeed(
    context.projectName,
    context.bootstrapAssessment,
    context.bootstrapSeed
  );
  const phases = seed.roadmapPhases
    .map((phase) => {
      const normalizedPhaseNumber = normalizePhaseNumber(phase.phase);
      const marker = phase.status === "done" ? "x" : " ";
      const requirementClause =
        phase.requirementIds && phase.requirementIds.length > 0
          ? ` (Requirements: ${phase.requirementIds.join(", ")})`
          : "";
      const notes = normalizeList(phase.notes, []).map((value) => `  - ${value}`).join("\n");

      return `- [${marker}] Phase ${normalizedPhaseNumber}: ${phase.title}${requirementClause}
  - Objective: ${phase.objective}${notes ? `\n${notes}` : ""}`;
    })
    .join("\n");

  return `# Roadmap: ${context.projectName}

## Milestone

- Active milestone: ${seed.currentMilestone}

## Bootstrap Status

- Repository shape: ${titleCaseBootstrapShape(context.bootstrapAssessment.repoShape)}
- Codebase mapping: ${context.bootstrapAssessment.codebaseMapped ? "ready" : "pending"}
- Roadmap confidence: ${context.bootstrapAssessment.provisionalRoadmap ? "provisional until /blu-map-codebase" : "ready for progress review"}

## Phases

${phases}

## Notes

${seed.assumptions.map((value) => `- ${value}`).join("\n")}
`;
}

const ARTIFACT_RENDERERS: Record<SupportedScaffoldArtifact, ArtifactRenderer> = {
  ".blueprint/PROJECT.md": renderProjectArtifact,
  ".blueprint/REQUIREMENTS.md": renderRequirementsArtifact,
  ".blueprint/ROADMAP.md": renderRoadmapArtifact,
  ".blueprint/phases/": () => "",
  ".blueprint/codebase/STACK.md": () => `# Stack

Generated by \`/blu-map-codebase\`.

- Record the runtime, languages, packages, and build tooling confirmed by repo evidence.
- Refresh only after explicit replace confirmation when the codebase changes materially.
`,
  ".blueprint/codebase/ARCHITECTURE.md": () => `# Architecture

Generated by \`/blu-map-codebase\`.

- Record the primary source layout, boundaries, and execution flow confirmed by repo evidence.
- Refresh only after explicit replace confirmation when the codebase changes materially.
`,
  ".blueprint/codebase/STRUCTURE.md": () => `# Structure

Generated by \`/blu-map-codebase\`.

- Record the directory layout, key file locations, and structural seams confirmed by repo evidence.
- Refresh only after explicit replace confirmation when the codebase changes materially.
`,
  ".blueprint/codebase/CONVENTIONS.md": () => `# Conventions

Generated by \`/blu-map-codebase\`.

- Record coding, naming, module, and documentation conventions confirmed by repo evidence.
- Refresh only after explicit replace confirmation when the codebase changes materially.
`,
  ".blueprint/codebase/TESTING.md": () => `# Testing

Generated by \`/blu-map-codebase\`.

- Record the test framework, commands, and coverage signals confirmed by repo evidence.
- Refresh only after explicit replace confirmation when the codebase changes materially.
`,
  ".blueprint/codebase/INTEGRATIONS.md": () => `# Integrations

Generated by \`/blu-map-codebase\`.

- Record external services, SDKs, and integration points confirmed by repo evidence.
- Refresh only after explicit replace confirmation when the codebase changes materially.
`,
  ".blueprint/codebase/CONCERNS.md": () => `# Concerns

Generated by \`/blu-map-codebase\`.

- Record current risks, thin areas, and follow-up questions confirmed by repo evidence.
- Refresh only after explicit replace confirmation when the codebase changes materially.
`
};

const artifactScaffoldInputSchema = {
  cwd: z.string().optional(),
  projectName: z.string().optional(),
  overwrite: z.boolean().optional(),
  artifacts: z
    .array(
      z
        .union([
          z.enum(SUPPORTED_SCAFFOLD_ARTIFACTS),
          z
            .string()
            .regex(
              SCAFFOLD_PHASE_ARTIFACT_PATTERN,
              "Use a repo-relative phase artifact path such as `.blueprint/phases/03-auth/03-CONTEXT.md`."
            )
        ])
        .describe(SCAFFOLD_ARTIFACT_PATH_GUIDANCE)
    )
    .optional()
    .describe(SCAFFOLD_ARTIFACT_PATH_GUIDANCE),
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
            id: z.string(),
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
            notes: z.array(z.string()).optional()
          })
        )
        .optional(),
      brownfieldMode: z.enum(["greenfield", "scaffold-only", "brownfield"]).optional(),
      assumptions: z.array(z.string()).optional()
    })
    .optional()
};
const artifactListInputSchema = {
  cwd: z.string().optional()
};
const artifactMutateIndexInputSchema = {
  cwd: z.string().optional(),
  target: z.enum(CAPTURE_INDEX_TARGETS),
  action: z.enum(["append", "list", "update"]).optional(),
  entry: z
    .object({
      text: z.string(),
      status: z.string().optional(),
      addedAt: z.string().optional(),
      reservePhaseStub: z.boolean().optional()
    })
    .optional(),
  filter: z
    .object({
      query: z.string().optional(),
      ids: z.array(z.string()).optional(),
      statuses: z.array(z.string()).optional(),
      limit: z.number().int().positive().optional()
    })
    .optional(),
  match: z
    .object({
      id: z.string().optional(),
      text: z.string().optional()
    })
    .optional(),
  update: z
    .object({
      status: z.string().optional()
    })
    .optional(),
  updates: z
    .array(
      z.object({
        id: z.string(),
        status: z.string().optional(),
        description: z.string().optional(),
        reservedPhase: z.string().nullable().optional()
      })
    )
    .optional()
};
const artifactValidateInputSchema = {
  cwd: z.string().optional()
};
const artifactSummaryDigestInputSchema = {
  cwd: z.string().optional(),
  focusArea: z.string().optional(),
  packageJsonPath: z.string().optional(),
  readmePath: z.string().optional(),
  sourceFiles: z.array(z.string()).optional(),
  testFiles: z.array(z.string()).optional(),
  docFiles: z.array(z.string()).optional(),
  trackedFiles: z.array(z.string()).optional(),
  artifactPaths: z.array(z.string()).optional()
};
const artifactReportWriteInputSchema = {
  cwd: z.string().optional(),
  reportName: z.string(),
  content: z.string(),
  overwrite: z.boolean().optional()
};

const CODEBASE_SECTION_TITLES: Record<(typeof CODEBASE_ARTIFACTS)[number], string> = {
  ".blueprint/codebase/STACK.md": "Stack",
  ".blueprint/codebase/ARCHITECTURE.md": "Architecture",
  ".blueprint/codebase/STRUCTURE.md": "Structure",
  ".blueprint/codebase/CONVENTIONS.md": "Conventions",
  ".blueprint/codebase/TESTING.md": "Testing",
  ".blueprint/codebase/INTEGRATIONS.md": "Integrations",
  ".blueprint/codebase/CONCERNS.md": "Concerns"
};

function normalizePhaseNumber(value: string): string {
  return normalizeBlueprintPhaseRef(value);
}

function formatPhasePrefix(value: string): string {
  return formatBlueprintPhasePrefix(value);
}

export function normalizeReportSlug(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized.length === 0) {
    throw new Error(`Report name must include at least one alphanumeric character: ${value}`);
  }

  return normalized;
}

export function buildBlueprintReportPath(reportName: string): string {
  return `${BLUEPRINT_REPORTS_PATH}/${normalizeReportSlug(reportName)}.md`;
}

function slugToTitle(value: string): string {
  return value
    .split("-")
    .filter((segment) => segment.length > 0)
    .map((segment) => `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`)
    .join(" ");
}

function parsePhaseArtifactRequest(artifact: string): PhaseArtifactRequest | null {
  const match = artifact.match(SCAFFOLD_PHASE_ARTIFACT_PATTERN);

  if (!match) {
    return null;
  }

  const [, phaseDir, , rawPrefix, rawPlanId, kind] = match;
  const directoryPrefix = phaseDir.match(/^(\d+(?:\.\d+)?)(?:-|$)/)?.[1];

  if (!directoryPrefix) {
    throw new Error(`Phase artifact path must use a numbered phase directory: ${artifact}`);
  }

  const normalizedDirectoryPrefix = normalizePhaseNumber(directoryPrefix);
  const normalizedFilePrefix = normalizePhaseNumber(rawPrefix);

  if (normalizedDirectoryPrefix !== normalizedFilePrefix) {
    throw new Error(`Phase artifact prefix must match its phase directory: ${artifact}`);
  }

  const canonicalPrefix = formatPhasePrefix(normalizedDirectoryPrefix);

  if (rawPrefix !== canonicalPrefix) {
    throw new Error(
      `Phase artifact prefix must use the canonical form ${canonicalPrefix}: ${artifact}`
    );
  }

  return {
    artifact,
    phaseDir,
    phaseName: slugToTitle(phaseDir.replace(/^\d+(?:\.\d+)?-?/, "")),
    phasePrefix: canonicalPrefix,
    kind: rawPlanId ? "PLAN" : (kind as PhaseArtifactRequest["kind"]),
    planId: rawPlanId ? rawPlanId.padStart(2, "0") : null
  };
}

function renderPhaseArtifact(request: PhaseArtifactRequest): string {
  const title = request.phaseName.length > 0 ? request.phaseName : "Phase";
  const phaseLabel = `Phase ${request.phasePrefix}: ${title}`;

  switch (request.kind) {
    case "CONTEXT":
      return `# ${phaseLabel} - Context

## Phase Boundary

- Goal:
- In scope:
- Out of scope:

## Decisions

- Capture the confirmed choices for this phase here.

## Dependencies

- Prior phase artifacts:
- External constraints:

## Open Questions

- Question 1:

---
*Generated by \`blueprint_artifact_scaffold\`*
`;
    case "DISCUSSION-LOG":
      return `# ${phaseLabel} - Discussion Log

## Summary

- Record the major discussion outcomes and unresolved questions here.

## Notes

- Timestamped notes:

## Follow-Ups

- Follow-up 1:

---
*Generated by \`blueprint_artifact_scaffold\`*
`;
    case "RESEARCH":
      return `${renderResearchArtifactTemplate(phaseLabel, `${title} implementation research`)}

---
*Generated by \`blueprint_artifact_scaffold\`*
`;
    case "UI-SPEC":
      return `# ${phaseLabel} - UI Spec

## Outcome Mode

- Choose one: UI contract or explicit skip rationale.

## User Experience Goals

- Goal 1:

## Screens And States

- Screen/state 1:

## Components And Constraints

- Component 1:

## Accessibility And Content

- Accessibility note 1:

---
*Generated by \`blueprint_artifact_scaffold\`*
`;
    case "PLAN":
      return `---
phase: ${normalizePhaseNumber(request.phasePrefix)}
plan_id: "${request.planId ?? "01"}"
title: "${title} plan ${request.planId ?? "01"}"
wave: 1
status: planned
objective: "Replace with a concrete, execution-ready goal."
depends_on: []
requirements:
  - Replace with the exact requirement IDs this plan addresses.
files_modified:
  - Replace with the real repo paths the executor must touch.
read_first:
  - Replace with the files the executor must inspect before editing.
acceptance_criteria:
  - Replace with grep/test-verifiable acceptance criteria.
autonomous: true
---

# ${phaseLabel} - Plan ${request.planId ?? "01"}

## Goal

Replace with a concrete, execution-ready goal.

## Scope

- Replace with the exact work this plan owns.

## Tasks

### Task 1: Replace with a concrete task name

#### Read First

- Replace with the files the executor must inspect before editing.

#### Action

- Replace with concrete code, config, or artifact changes.

#### Acceptance Criteria

- Replace with grep/test-verifiable acceptance criteria.

## Verification

- Replace with the exact checks that prove this plan is complete.

## Must Haves

- Replace with the goal-backward must-haves this plan cannot drop.

---
*Generated by \`blueprint_artifact_scaffold\`*
`;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function toPosixPath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

export function getProjectRoot(cwd?: string): string {
  return path.resolve(cwd ?? process.cwd());
}

export function getBlueprintRoot(cwd?: string): string {
  return path.join(getProjectRoot(cwd), BLUEPRINT_DIR);
}

export async function blueprintPathExists(targetPath: string): Promise<boolean> {
  return pathExists(targetPath);
}

export async function ensureRepoRoot(cwd?: string): Promise<string> {
  const projectRoot = getProjectRoot(cwd);
  const gitPath = path.join(projectRoot, ".git");

  if (!(await pathExists(gitPath))) {
    throw new Error(
      "Blueprint commands must run from the repository root; no .git entry was found in the current directory."
    );
  }

  return projectRoot;
}

export function toRepoRelativePath(projectRoot: string, absolutePath: string): string {
  return toPosixPath(path.relative(projectRoot, absolutePath));
}

export function resolveRepoRelativePath(
  projectRoot: string,
  relativePath: string
): string {
  try {
    return resolveRepoRelativeInputPathSync(projectRoot, relativePath, {
      label: "Path"
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("must be repo-relative, not absolute")
    ) {
      throw error;
    }

    throw new Error(`Path traversal is not allowed: ${relativePath}`);
  }
}

export function resolveBlueprintPath(
  projectRoot: string,
  relativePath: string
): string {
  assertNoNullBytes(relativePath, "Blueprint path");

  if (path.isAbsolute(relativePath)) {
    throw new Error(`Blueprint paths must be repo-relative, not absolute: ${relativePath}`);
  }

  if (!relativePath.startsWith(`${BLUEPRINT_DIR}/`)) {
    throw new Error(
      `Blueprint artifacts must stay inside ${BLUEPRINT_DIR}/: ${relativePath}`
    );
  }

  const absolutePath = resolveRepoRelativePath(projectRoot, relativePath);

  try {
    ensurePathWithinRootSync(getBlueprintRoot(projectRoot), absolutePath, {
      label: "Blueprint path"
    });
  } catch {
    throw new Error(`Path traversal is not allowed: ${relativePath}`);
  }

  return absolutePath;
}

export async function ensureParentDirectory(targetPath: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
}

export async function readJsonIfPresent(
  filePath: string
): Promise<Record<string, unknown> | null> {
  if (!(await pathExists(filePath))) {
    return null;
  }

  const raw = await fs.readFile(filePath, "utf8");
  return safeJsonParseObject(raw, { label: filePath });
}

export async function writeJsonFile(
  filePath: string,
  value: Record<string, unknown>
): Promise<void> {
  await ensureParentDirectory(filePath);
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeTextFile(
  filePath: string,
  value: string,
  options: TextWriteOptions = {}
): Promise<string[]> {
  const prepared =
    options.enforcePromptBoundary === false
      ? {
          content: value.replace(/\r\n/g, "\n"),
          warnings: [] as string[]
        }
      : prepareTextForPersistence(value, {
          label: options.label ?? path.basename(filePath)
        });

  await ensureParentDirectory(filePath);
  await fs.writeFile(filePath, prepared.content, "utf8");
  return prepared.warnings;
}

function extractMarkdownSection(markdown: string, heading: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(
    new RegExp(`(?:^|\\n)## ${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`)
  );

  return match?.[1]?.trim() ?? "";
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractFrontmatter(content: string): string | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\s*(?:\n|$)/);

  return match?.[1] ?? null;
}

function normalizeFrontmatterScalar(value: string): string {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function parseInlineArray(value: string): string[] {
  const trimmed = value.trim();

  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return [];
  }

  return trimmed
    .slice(1, -1)
    .split(",")
    .map((entry) => normalizeFrontmatterScalar(entry))
    .filter((entry) => entry.length > 0);
}

function parsePlanFrontmatter(content: string): PlanArtifactMetadata {
  const frontmatter = extractFrontmatter(content);

  if (!frontmatter) {
    return {
      phase: null,
      planId: null,
      title: null,
      wave: null,
      status: null,
      objective: null,
      dependsOn: [],
      requirements: [],
      filesModified: [],
      readFirst: [],
      acceptanceCriteria: [],
      autonomous: null
    };
  }

  const scalars = new Map<string, string>();
  const arrays = new Map<string, string[]>();
  let currentArrayKey: string | null = null;

  for (const rawLine of frontmatter.split("\n")) {
    const line = rawLine.trimEnd();

    if (line.trim().length === 0) {
      continue;
    }

    const arrayItemMatch = line.match(/^\s*-\s+(.+)$/);

    if (arrayItemMatch && currentArrayKey) {
      arrays.get(currentArrayKey)?.push(normalizeFrontmatterScalar(arrayItemMatch[1]));
      continue;
    }

    const keyValueMatch = line.match(/^([a-z_]+):\s*(.*)$/);

    if (!keyValueMatch) {
      currentArrayKey = null;
      continue;
    }

    const [, key, rawValue] = keyValueMatch;
    const value = rawValue.trim();

    if (value === "") {
      arrays.set(key, []);
      currentArrayKey = key;
      continue;
    }

    if (value === "[]") {
      arrays.set(key, []);
      currentArrayKey = null;
      continue;
    }

    if (value.startsWith("[")) {
      arrays.set(key, parseInlineArray(value));
      currentArrayKey = null;
      continue;
    }

    scalars.set(key, normalizeFrontmatterScalar(value));
    currentArrayKey = null;
  }

  const waveValue = scalars.get("wave");
  const autonomousValue = scalars.get("autonomous");

  return {
    phase: scalars.get("phase") ?? null,
    planId: scalars.get("plan_id") ?? null,
    title: scalars.get("title") ?? null,
    wave:
      waveValue && /^\d+$/.test(waveValue) ? Number.parseInt(waveValue, 10) : null,
    status: scalars.get("status") ?? null,
    objective: scalars.get("objective") ?? null,
    dependsOn: arrays.get("depends_on") ?? [],
    requirements: arrays.get("requirements") ?? [],
    filesModified: arrays.get("files_modified") ?? [],
    readFirst: arrays.get("read_first") ?? [],
    acceptanceCriteria: arrays.get("acceptance_criteria") ?? [],
    autonomous:
      autonomousValue === "true"
        ? true
        : autonomousValue === "false"
          ? false
          : null
  };
}

function containsSourceEvidence(section: string): boolean {
  return /https?:\/\/|`[^`]+`|\.blueprint\/|docs\/|src\/|tests\//.test(section);
}

export function validateResearchArtifactContent(content: string): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];
  const placeholderSignals = [
    ...RESEARCH_TEMPLATE_PLACEHOLDER_SIGNALS,
    "*Generated by `blueprint_artifact_scaffold`*"
  ];

  if (!/^# .+ - Research\s*$/m.test(content)) {
    issues.push("Research artifact must start with a '# ... - Research' heading.");
  }

  if (placeholderSignals.some((signal) => content.includes(signal))) {
    issues.push(
      "Research artifact still contains scaffold placeholder text and must be replaced with real research content."
    );
  }

  const confidenceMatch = content.match(
    /^\*\*Confidence:\*\*\s*(LOW|MEDIUM|HIGH)\s*$/m
  );

  if (!confidenceMatch) {
    issues.push(
      `Research artifact must declare **Confidence:** using one of ${RESEARCH_CONFIDENCE_VALUES.join(", ")}.`
    );
  }

  for (const heading of REQUIRED_RESEARCH_SECTIONS) {
    if (!new RegExp(`(?:^|\\n)## ${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m").test(content)) {
      issues.push(`Research artifact is missing required section: ${heading}.`);
    }
  }

  const recommendations = extractMarkdownSection(content, "Recommendations");

  if (!/^- /m.test(recommendations)) {
    issues.push("Research artifact must include at least one bullet under Recommendations.");
  }

  const sources = extractMarkdownSection(content, "Sources");

  if (!/^- /m.test(sources) || !containsSourceEvidence(sources)) {
    issues.push(
      "Research artifact must include at least one source bullet with a URL, repo path, or cited file."
    );
  }

  const codeExamples = extractMarkdownSection(content, "Code Examples");

  if (!/```/.test(codeExamples)) {
    warnings.push("Research artifact should include a fenced code or pseudocode example when examples add value.");
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}

function containsReferencedSummaryPath(section: string, summaryPaths: string[]): boolean {
  const normalizedSection = section.trim();

  if (normalizedSection.length === 0 || summaryPaths.length === 0) {
    return false;
  }

  return summaryPaths.some((summaryPath) => {
    const fileName = summaryPath.split("/").pop() ?? summaryPath;
    return normalizedSection.includes(summaryPath) || normalizedSection.includes(fileName);
  });
}

function validateRequiredMarkdownSections(
  content: string,
  artifactLabel: string,
  headings: readonly string[]
): string[] {
  const issues: string[] = [];

  for (const heading of headings) {
    if (!new RegExp(`(?:^|\\n)## ${escapeRegex(heading)}\\s*$`, "m").test(content)) {
      issues.push(`${artifactLabel} is missing required section: ${heading}.`);
      continue;
    }

    if (extractMarkdownSection(content, heading).trim().length === 0) {
      issues.push(`${artifactLabel} section ${heading} must not be empty.`);
    }
  }

  return issues;
}

const REQUIRED_VERIFICATION_SECTIONS = [
  "Validation Summary",
  "Evidence Reviewed",
  "Gaps Found",
  "Suggested Repairs",
  "Next Safe Action"
] as const;

export function validateVerificationArtifactContent(
  content: string,
  summaryPaths: string[] = []
): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!/^# .+ - Verification\s*$/m.test(content)) {
    issues.push("Verification artifact must start with a '# ... - Verification' heading.");
  }

  if (!/^\*\*Coverage:\*\*\s*.+$/m.test(content)) {
    issues.push(
      "Verification artifact must declare **Coverage:** with a brief summary of the validated summaries or plan slices."
    );
  }

  issues.push(
    ...validateRequiredMarkdownSections(
      content,
      "Verification artifact",
      REQUIRED_VERIFICATION_SECTIONS
    )
  );

  const evidenceReviewed = extractMarkdownSection(content, "Evidence Reviewed");
  if (summaryPaths.length > 0 && !containsReferencedSummaryPath(evidenceReviewed, summaryPaths)) {
    warnings.push(
      "Verification artifact should cite at least one saved execution summary path or filename under ## Evidence Reviewed."
    );
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}

const REQUIRED_UAT_SECTIONS = [
  "UAT Summary",
  "Questions Asked",
  "Observed Behavior",
  "Unresolved Gaps",
  "Follow-Up Fixes",
  "Next Safe Action"
] as const;

export function validateUatArtifactContent(
  content: string,
  summaryPaths: string[] = []
): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!/^# .+ - UAT\s*$/m.test(content)) {
    issues.push("UAT artifact must start with a '# ... - UAT' heading.");
  }

  if (!/^\*\*Status:\*\*\s*(PASS|FAIL|PARTIAL)\s*$/m.test(content)) {
    issues.push("UAT artifact must declare **Status:** PASS, FAIL, or PARTIAL.");
  }

  issues.push(...validateRequiredMarkdownSections(content, "UAT artifact", REQUIRED_UAT_SECTIONS));

  const uatSummary = extractMarkdownSection(content, "UAT Summary");
  const observedBehavior = extractMarkdownSection(content, "Observed Behavior");
  if (
    summaryPaths.length > 0 &&
    !containsReferencedSummaryPath(`${uatSummary}\n${observedBehavior}`, summaryPaths)
  ) {
    warnings.push(
      "UAT artifact should reference at least one saved execution summary path or filename in ## UAT Summary or ## Observed Behavior."
    );
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}

export function validatePlanArtifactContent(
  content: string,
  expectedPhase?: string
): {
  valid: boolean;
  issues: string[];
  warnings: string[];
  metadata: PlanArtifactMetadata;
} {
  const issues: string[] = [];
  const warnings: string[] = [];
  const metadata = parsePlanFrontmatter(content);

  if (!extractFrontmatter(content)) {
    issues.push("Plan artifact must start with YAML-style frontmatter.");
  }

  if (PLAN_PLACEHOLDER_SIGNALS.some((signal) => content.includes(signal))) {
    issues.push(
      "Plan artifact still contains scaffold placeholder text and must be replaced with execution-ready content."
    );
  }

  if (!metadata.phase) {
    issues.push("Plan frontmatter must include phase.");
  } else if (
    expectedPhase &&
    normalizePhaseNumber(metadata.phase) !== normalizePhaseNumber(expectedPhase)
  ) {
    issues.push(
      `Plan frontmatter phase ${metadata.phase} does not match expected phase ${expectedPhase}.`
    );
  }

  if (!metadata.planId || !/^\d+$/.test(metadata.planId)) {
    issues.push("Plan frontmatter must include a numeric plan_id.");
  }

  if (!metadata.title) {
    issues.push("Plan frontmatter must include title.");
  }

  if (!metadata.wave || metadata.wave < 1) {
    issues.push("Plan frontmatter must include a positive integer wave.");
  }

  if (!metadata.status) {
    issues.push("Plan frontmatter must include status.");
  }

  if (!metadata.objective) {
    issues.push("Plan frontmatter must include objective.");
  }

  if (metadata.requirements.length === 0) {
    issues.push("Plan frontmatter must include at least one requirement in requirements.");
  }

  if (metadata.filesModified.length === 0) {
    issues.push("Plan frontmatter must include at least one file or path in files_modified.");
  }

  if (metadata.readFirst.length === 0) {
    issues.push("Plan frontmatter must include at least one file or path in read_first.");
  }

  if (metadata.acceptanceCriteria.length === 0) {
    issues.push(
      "Plan frontmatter must include at least one grep/test-verifiable item in acceptance_criteria."
    );
  }

  if (metadata.autonomous === null) {
    issues.push("Plan frontmatter must declare autonomous as true or false.");
  }

  for (const heading of REQUIRED_PLAN_SECTIONS) {
    if (
      !new RegExp(
        `(?:^|\\n)## ${escapeRegex(heading)}\\s*$`,
        "m"
      ).test(content)
    ) {
      issues.push(`Plan artifact is missing required section: ${heading}.`);
    }
  }

  const tasksSection = extractMarkdownSection(content, "Tasks");
  const taskBlocks = tasksSection
    .split(/\n### /)
    .map((block, index) => (index === 0 ? block.trim() : `### ${block}`.trim()))
    .filter((block) => block.startsWith("### "));

  if (taskBlocks.length === 0) {
    issues.push("Plan artifact must include at least one task under ## Tasks.");
  }

  for (const taskBlock of taskBlocks) {
    for (const taskHeading of ["Read First", "Action", "Acceptance Criteria"]) {
      if (
        !new RegExp(
          `(?:^|\\n)#### ${escapeRegex(taskHeading)}\\s*$`,
          "m"
        ).test(taskBlock)
      ) {
        issues.push(`Each task must include a #### ${taskHeading} subsection.`);
      }
    }
  }

  const verificationSection = extractMarkdownSection(content, "Verification");
  if (!/^- /m.test(verificationSection)) {
    warnings.push(
      "Plan artifact should include at least one verification bullet under ## Verification."
    );
  }

  const mustHavesSection = extractMarkdownSection(content, "Must Haves");
  if (!/^- /m.test(mustHavesSection)) {
    warnings.push("Plan artifact should include at least one bullet under ## Must Haves.");
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    metadata
  };
}

async function listRelativeFiles(rootPath: string, projectRoot: string): Promise<string[]> {
  if (!(await pathExists(rootPath))) {
    return [];
  }

  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listRelativeFiles(absolutePath, projectRoot)));
      continue;
    }

    files.push(toRepoRelativePath(projectRoot, absolutePath));
  }

  return files.sort();
}

async function listImmediateDirectories(rootPath: string): Promise<string[]> {
  if (!(await pathExists(rootPath))) {
    return [];
  }

  const entries = await fs.readdir(rootPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export async function inspectBlueprintArtifacts(projectRoot: string): Promise<{
  readiness: BlueprintReadiness;
  blueprintRootExists: boolean;
  core: { present: string[]; missing: string[] };
  phases: string[];
  reports: string[];
  codebase: { present: string[]; missing: string[] };
}> {
  const blueprintRoot = getBlueprintRoot(projectRoot);
  const blueprintRootExists = await pathExists(blueprintRoot);
  const corePresent: string[] = [];
  const coreMissing: string[] = [];

  for (const artifact of CORE_PROJECT_ARTIFACTS) {
    const artifactPath = resolveBlueprintPath(projectRoot, artifact);

    if (await pathExists(artifactPath)) {
      corePresent.push(artifact);
    } else {
      coreMissing.push(artifact);
    }
  }

  const phases = await listRelativeFiles(
    resolveBlueprintPath(projectRoot, BLUEPRINT_PHASES_PATH),
    projectRoot
  );
  const reports = await listRelativeFiles(
    resolveBlueprintPath(projectRoot, BLUEPRINT_REPORTS_PATH),
    projectRoot
  );
  const codebasePresent: string[] = [];
  const codebaseMissing: string[] = [];

  for (const artifact of CODEBASE_ARTIFACTS) {
    const artifactPath = resolveBlueprintPath(projectRoot, artifact);

    if (await pathExists(artifactPath)) {
      codebasePresent.push(artifact);
    } else {
      codebaseMissing.push(artifact);
    }
  }

  const readiness: BlueprintReadiness = !blueprintRootExists
    ? "uninitialized"
    : coreMissing.length === 0
      ? "initialized"
      : "partial";

  return {
    readiness,
    blueprintRootExists,
    core: {
      present: corePresent,
      missing: coreMissing
    },
    phases,
    reports,
    codebase: {
      present: codebasePresent,
      missing: codebaseMissing
    }
  };
}

async function assessBootstrapRepoShape(
  projectRoot: string,
  inspection?: Awaited<ReturnType<typeof inspectBlueprintArtifacts>>
): Promise<BootstrapAssessment> {
  const entries = await fs.readdir(projectRoot, { withFileTypes: true });
  const substantiveEntries = entries.filter(
    (entry) => !BOOTSTRAP_IGNORED_ROOT_ENTRIES.has(entry.name)
  );
  const hasSourceDirectories = substantiveEntries.some(
    (entry) => entry.isDirectory() && BOOTSTRAP_SOURCE_DIRECTORIES.has(entry.name)
  );
  const hasBuildManifest = substantiveEntries.some(
    (entry) => entry.isFile() && BOOTSTRAP_MANIFEST_FILES.has(entry.name)
  );
  const codebasePresentCount = inspection?.codebase.present.length ?? 0;
  const codebaseMapped = codebasePresentCount === CODEBASE_ARTIFACTS.length;
  let repoShape: BootstrapRepoShape = "greenfield";
  const reasons: string[] = [];

  if (
    hasSourceDirectories ||
    (hasBuildManifest && substantiveEntries.length >= 2) ||
    substantiveEntries.length >= 4
  ) {
    repoShape = "brownfield";
    reasons.push("Repo already contains substantive implementation or build structure.");
  } else if (hasBuildManifest || substantiveEntries.length >= 2) {
    repoShape = "scaffold-only";
    reasons.push("Repo contains initial scaffolding but not enough evidence for a mapped brownfield flow.");
  } else {
    reasons.push("Repo shape still looks close to an empty or freshly created project.");
  }

  const provisionalRoadmap = repoShape === "brownfield" && !codebaseMapped;
  const recommendedNextAction = provisionalRoadmap
    ? "Run /blu-map-codebase"
    : "Run /blu-progress";

  if (provisionalRoadmap) {
    reasons.push("Brownfield repos should map the existing codebase before later roadmap phases are treated as durable.");
  }

  return {
    repoShape,
    codebaseMapped,
    provisionalRoadmap,
    recommendedNextAction,
    reasons
  };
}

function extractRequirementIds(content: string): string[] {
  return [...content.matchAll(/\|\s*([A-Z][A-Z0-9-]*-\d+)\s*\|/g)].map((match) => match[1]);
}

function extractRoadmapRequirementRefs(content: string): string[] {
  const references = [
    ...content.matchAll(/Requirements?:\s*([A-Z0-9,\- ]+)/g)
  ].flatMap((match) =>
    match[1]
      .split(",")
      .map((value) => value.trim())
      .filter((value) => /^[A-Z][A-Z0-9-]*-\d+$/.test(value))
  );

  return [...new Set(references)];
}

export async function inspectBootstrapArtifacts(
  projectRoot: string
): Promise<BootstrapArtifactDiagnostics> {
  const inspection = await inspectBlueprintArtifacts(projectRoot);
  const brownfield = await assessBootstrapRepoShape(projectRoot, inspection);
  const placeholderArtifacts: string[] = [];
  const traceabilityWarnings: string[] = [];
  const projectArtifactPaths = [
    `${BLUEPRINT_DIR}/PROJECT.md`,
    `${BLUEPRINT_DIR}/REQUIREMENTS.md`,
    `${BLUEPRINT_DIR}/ROADMAP.md`
  ] as const;
  const contents = new Map<string, string>();

  for (const artifact of projectArtifactPaths) {
    const absolutePath = resolveBlueprintPath(projectRoot, artifact);

    if (!(await pathExists(absolutePath))) {
      continue;
    }

    const raw = await fs.readFile(absolutePath, "utf8");
    contents.set(artifact, raw);

    if (
      BOOTSTRAP_PLACEHOLDER_SIGNALS[artifact]?.some((signal) => raw.includes(signal))
    ) {
      placeholderArtifacts.push(artifact);
    }
  }

  const requirementsContent = contents.get(`${BLUEPRINT_DIR}/REQUIREMENTS.md`) ?? "";
  const roadmapContent = contents.get(`${BLUEPRINT_DIR}/ROADMAP.md`) ?? "";
  const requirementIds = extractRequirementIds(requirementsContent);
  const roadmapRequirementRefs = extractRoadmapRequirementRefs(roadmapContent);

  if (requirementIds.length === 0 && requirementsContent.length > 0) {
    traceabilityWarnings.push(
      "REQUIREMENTS.md does not yet contain durable requirement IDs."
    );
  }

  if (requirementIds.length > 0 && roadmapRequirementRefs.length === 0) {
    traceabilityWarnings.push(
      "ROADMAP.md does not reference any requirement IDs from REQUIREMENTS.md."
    );
  }

  for (const requirementId of requirementIds) {
    if (!roadmapRequirementRefs.includes(requirementId)) {
      traceabilityWarnings.push(
        `ROADMAP.md is missing traceability for requirement ${requirementId}.`
      );
    }
  }

  if (brownfield.provisionalRoadmap) {
    traceabilityWarnings.push(
      "Brownfield roadmap remains provisional until `/blu-map-codebase` captures the existing codebase."
    );
  }

  return {
    placeholderArtifacts: [...new Set(placeholderArtifacts)],
    traceabilityWarnings: [...new Set(traceabilityWarnings)],
    brownfield
  };
}

function normalizeRequestedArtifacts(
  requestedArtifacts?: string[]
): string[] {
  if (!requestedArtifacts || requestedArtifacts.length === 0) {
    return [...SUPPORTED_BOOTSTRAP_ARTIFACTS];
  }

  const normalized = requestedArtifacts.map((artifact) => {
    const value = artifact.trim();

    if (
      !SUPPORTED_SCAFFOLD_ARTIFACTS.includes(value as SupportedScaffoldArtifact) &&
      !parsePhaseArtifactRequest(value)
    ) {
      throw new Error(
        `Unsupported Blueprint artifact requested: ${artifact}. ${SCAFFOLD_ARTIFACT_PATH_GUIDANCE}`
      );
    }

    return value;
  });

  return [...new Set(normalized)];
}

function isCodebaseArtifact(
  artifact: SupportedScaffoldArtifact
): artifact is (typeof CODEBASE_ARTIFACTS)[number] {
  return CODEBASE_ARTIFACTS.includes(artifact as (typeof CODEBASE_ARTIFACTS)[number]);
}

function inferProjectName(projectRoot: string, requestedName?: string): string {
  const trimmed = requestedName?.trim();

  if (trimmed) {
    return trimmed;
  }

  return path.basename(projectRoot);
}

export async function blueprintArtifactScaffold(
  args: ArtifactScaffoldArgs = {}
): Promise<ArtifactScaffoldResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const projectName = inferProjectName(projectRoot, args.projectName);
  const bootstrapDiagnostics = await inspectBootstrapArtifacts(projectRoot);
  const overwrite = args.overwrite ?? false;
  const artifacts = normalizeRequestedArtifacts(args.artifacts);
  const createdFiles: string[] = [];
  const reusedFiles: string[] = [];
  const warnings: string[] = [];
  const renderContext: BootstrapRenderContext = {
    projectName,
    bootstrapSeed: args.bootstrapSeed,
    bootstrapAssessment: bootstrapDiagnostics.brownfield
  };

  await fs.mkdir(getBlueprintRoot(projectRoot), { recursive: true });

  for (const artifact of artifacts) {
    const absolutePath = resolveBlueprintPath(projectRoot, artifact);
    const exists = await pathExists(absolutePath);
    const phaseArtifactRequest = parsePhaseArtifactRequest(artifact);

    if (artifact.endsWith("/")) {
      if (exists) {
        reusedFiles.push(artifact);
      } else {
        await fs.mkdir(absolutePath, { recursive: true });
        createdFiles.push(artifact);
      }
      continue;
    }

    if (exists && !overwrite) {
      reusedFiles.push(artifact);
      if (
        SUPPORTED_SCAFFOLD_ARTIFACTS.includes(artifact as SupportedScaffoldArtifact) &&
        isCodebaseArtifact(artifact as SupportedScaffoldArtifact)
      ) {
        warnings.push(
          `Preserved existing codebase artifact: ${artifact}. Reuse it unless an explicit replace path is confirmed.`
        );
      }
      continue;
    }

    const renderArtifact =
      phaseArtifactRequest
        ? () => renderPhaseArtifact(phaseArtifactRequest)
        : ARTIFACT_RENDERERS[artifact as SupportedScaffoldArtifact];

    if (!renderArtifact) {
      warnings.push(`No renderer registered for ${artifact}; skipped.`);
      continue;
    }

    warnings.push(
      ...await writeTextFile(absolutePath, renderArtifact(renderContext), {
        label: artifact
      })
    );

    if (exists) {
      warnings.push(
        SUPPORTED_SCAFFOLD_ARTIFACTS.includes(artifact as SupportedScaffoldArtifact) &&
        isCodebaseArtifact(artifact as SupportedScaffoldArtifact)
          ? `Replaced existing codebase artifact: ${artifact}`
          : `Replaced existing artifact: ${artifact}`
      );
    } else {
      createdFiles.push(artifact);
    }
  }

  return {
    createdFiles,
    reusedFiles,
    warnings
  };
}

export async function blueprintArtifactList(
  args: ArtifactListArgs = {}
): Promise<ArtifactListResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const inspection = await inspectBlueprintArtifacts(projectRoot);
  const missing = [...inspection.core.missing];
  const warnings: string[] = [];

  if (inspection.codebase.present.length > 0 && inspection.codebase.missing.length > 0) {
    missing.push(...inspection.codebase.missing);
  }

  if (inspection.codebase.present.length > 0) {
    warnings.push(
      `Existing codebase artifacts will be reused unless replace is explicitly confirmed: ${inspection.codebase.present.join(", ")}`
    );
  }

  return {
    artifacts: {
      core: inspection.core.present,
      phases: inspection.phases,
      codebase: inspection.codebase.present
    },
    reports: inspection.reports,
    missing,
    warnings
  };
}

export async function blueprintArtifactMutateIndex(
  args: ArtifactMutateIndexArgs
): Promise<ArtifactMutateIndexResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const inspection = await inspectBlueprintArtifacts(projectRoot);
  const config = CAPTURE_INDEX_CONFIG[args.target];
  const action = args.action ?? "append";
  const targetPath = config.targetPath;
  const warnings: string[] = [];

  if (inspection.readiness === "uninitialized") {
    return {
      ...buildEmptyCaptureMutationResult(targetPath, "project_missing", [
        "Blueprint capture commands require an initialized project. Run /blu-new-project before writing capture artifacts."
      ])
    };
  }

  if (inspection.readiness === "partial") {
    warnings.push(
      "Blueprint project is partial; capture index write will proceed without repairing unrelated missing artifacts."
    );
  }

  const absolutePath = resolveBlueprintPath(projectRoot, targetPath);
  const exists = await pathExists(absolutePath);
  const raw = exists ? await fs.readFile(absolutePath, "utf8") : "";
  const parsed = parseCaptureIndexDocument(raw, args.target);

  if (parsed.malformed) {
    warnings.push(
      action === "append" || action === "update"
        ? `Recovered non-canonical capture index content while repairing ${targetPath}.`
        : `Detected non-canonical capture index content while reading ${targetPath}.`
    );
  }

  if (action === "list") {
    const matchedRows = filterCaptureRows(parsed.rows, args.target, args.filter, {
      defaultTodoStatuses: true
    });

    return {
      ...buildEmptyCaptureMutationResult(targetPath, "listed", warnings),
      matchedEntryIds: matchedRows.map((row) => row.id),
      updatedCounts: {
        added: 0,
        updated: 0,
        duplicates: 0,
        preserved: parsed.rows.length
      },
      entries: matchedRows,
      summary: summarizeCaptureRows(parsed.rows, matchedRows, args.target)
    };
  }

  if (action === "update") {
    const hasBatchUpdates = (args.updates ?? []).length > 0;

    if (!hasBatchUpdates && args.target === "todo") {
      const requestedId = normalizeCaptureText(args.match?.id ?? "");
      const requestedText = normalizeCaptureText(args.match?.text ?? "");

      if (requestedId.length === 0 && requestedText.length === 0) {
        return {
          ...buildEmptyCaptureMutationResult(targetPath, "invalid", [
            ...warnings,
            "Todo updates require a matching entry ID or exact todo text."
          ]),
          updatedCounts: {
            added: 0,
            updated: 0,
            duplicates: 0,
            preserved: parsed.rows.length
          },
          summary: summarizeCaptureRows(parsed.rows, [], args.target)
        };
      }

      if (normalizeCaptureText(args.update?.status ?? "").length === 0) {
        return {
          ...buildEmptyCaptureMutationResult(targetPath, "invalid", [
            ...warnings,
            "Todo updates require an explicit status."
          ]),
          updatedCounts: {
            added: 0,
            updated: 0,
            duplicates: 0,
            preserved: parsed.rows.length
          },
          summary: summarizeCaptureRows(parsed.rows, [], args.target)
        };
      }

      const desiredStatus = canonicalizeTodoStatus(args.update?.status);
      const matchedRows = parsed.rows.filter((row) => {
        if (requestedId.length > 0) {
          return row.id === requestedId;
        }

        return captureDedupKey(row.description) === captureDedupKey(requestedText);
      });

      if (matchedRows.length === 0) {
        return {
          ...buildEmptyCaptureMutationResult(targetPath, "not_found", [
            ...warnings,
            "No matching todo entry was found."
          ]),
          updatedCounts: {
            added: 0,
            updated: 0,
            duplicates: 0,
            preserved: parsed.rows.length
          },
          summary: summarizeCaptureRows(parsed.rows, [], args.target)
        };
      }

      if (matchedRows.length > 1) {
        return {
          ...buildEmptyCaptureMutationResult(targetPath, "invalid", [
            ...warnings,
            `Todo selection is ambiguous. Use an exact ID instead: ${matchedRows.map((row) => row.id).join(", ")}`
          ]),
          matchedEntryIds: matchedRows.map((row) => row.id),
          updatedCounts: {
            added: 0,
            updated: 0,
            duplicates: 0,
            preserved: parsed.rows.length
          },
          entries: matchedRows,
          summary: summarizeCaptureRows(parsed.rows, matchedRows, args.target)
        };
      }

      const matchedEntry = matchedRows[0];
      let updatedCount = 0;
      const nextRows = parsed.rows.map((row) => {
        const currentStatus = canonicalizeTodoStatus(row.status, { strict: false });

        if (row.id === matchedEntry.id) {
          if (currentStatus === desiredStatus) {
            return row;
          }

          updatedCount += 1;

          return {
            ...row,
            status: desiredStatus
          };
        }

        if (desiredStatus === "active" && currentStatus === "active") {
          updatedCount += 1;

          return {
            ...row,
            status: "open"
          };
        }

        return row;
      });
      const didWrite = parsed.malformed || updatedCount > 0;

      if (didWrite) {
        const recoveryContent =
          parsed.malformed && parsed.recoveryContent ? parsed.recoveryContent : null;
        const rendered = renderCaptureIndexDocument(args.target, nextRows, recoveryContent);

        warnings.push(
          ...await writeTextFile(absolutePath, rendered, {
            label: targetPath
          })
        );
      } else {
        warnings.push(
          "Preserved existing todo status because it already matched the requested value."
        );
      }

      const resultingEntry = nextRows.find((row) => row.id === matchedEntry.id);
      const resultingEntries = resultingEntry ? [resultingEntry] : [];

      return {
        ...buildEmptyCaptureMutationResult(targetPath, "updated", warnings),
        matchedEntryIds: [matchedEntry.id],
        updatedCounts: {
          added: 0,
          updated: updatedCount,
          duplicates: 0,
          preserved: parsed.rows.length - updatedCount
        },
        entries: resultingEntries,
        summary: summarizeCaptureRows(nextRows, resultingEntries, args.target)
      };
    }

    const updates = args.updates ?? [];

    if (updates.length === 0) {
      return {
        ...buildEmptyCaptureMutationResult(targetPath, "invalid", [
          ...warnings,
          "Capture index updates require at least one entry id."
        ]),
        updatedCounts: {
          added: 0,
          updated: 0,
          duplicates: 0,
          preserved: parsed.rows.length
        },
        summary: summarizeCaptureRows(parsed.rows, [], args.target)
      };
    }

    const rows = [...parsed.rows];
    const seenUpdateIds = new Set<string>();
    let updated = 0;

    for (const update of updates) {
      const normalizedId = update.id.trim().toUpperCase();

      if (normalizedId.length === 0) {
        warnings.push("Skipped a capture index update because the entry id was blank.");
        continue;
      }

      if (seenUpdateIds.has(normalizedId)) {
        warnings.push(`Skipped duplicate update request for ${normalizedId}.`);
        continue;
      }

      seenUpdateIds.add(normalizedId);

      const rowIndex = rows.findIndex((row) => row.id === normalizedId);

      if (rowIndex === -1) {
        warnings.push(`No ${args.target} entry matched ${normalizedId}.`);
        continue;
      }

      const currentRow = rows[rowIndex];
      let nextRow = currentRow;
      let rowChanged = false;

      if (typeof update.status === "string") {
        const normalizedStatus = normalizeCaptureText(update.status);

        if (normalizedStatus.length === 0) {
          warnings.push(`Skipped blank status update for ${normalizedId}.`);
        } else if (config.defaultStatus !== null && normalizedStatus !== currentRow.status) {
          nextRow = {
            ...nextRow,
            status: normalizedStatus
          };
          rowChanged = true;
        }
      }

      if (typeof update.description === "string") {
        const normalizedDescription = normalizeCaptureText(update.description);

        if (normalizedDescription.length === 0) {
          warnings.push(`Skipped blank description update for ${normalizedId}.`);
        } else if (normalizedDescription !== currentRow.description) {
          nextRow = {
            ...nextRow,
            description: normalizedDescription
          };
          rowChanged = true;
        }
      }

      if (
        config.supportsReservedPhase &&
        Object.prototype.hasOwnProperty.call(update, "reservedPhase")
      ) {
        let normalizedReservedPhase: string | null = null;

        if (typeof update.reservedPhase === "string") {
          try {
            normalizedReservedPhase = normalizeBlueprintPhaseRef(
              normalizeCaptureText(update.reservedPhase),
              "Reserved phase"
            );
          } catch (error) {
            warnings.push(
              error instanceof Error
                ? `Skipped invalid reserved phase for ${normalizedId}: ${error.message}`
                : `Skipped invalid reserved phase for ${normalizedId}.`
            );
            normalizedReservedPhase = currentRow.reservedPhase;
          }
        }

        const nextReservedPhase =
          normalizedReservedPhase && normalizedReservedPhase.length > 0
            ? normalizedReservedPhase
            : null;

        if (nextReservedPhase !== currentRow.reservedPhase) {
          nextRow = {
            ...nextRow,
            reservedPhase: nextReservedPhase
          };
          rowChanged = true;
        }
      }

      if (!rowChanged) {
        continue;
      }

      rows[rowIndex] = nextRow;
      updated += 1;
    }

    if (updated === 0 && !parsed.malformed) {
      return {
        ...buildEmptyCaptureMutationResult(targetPath, "invalid", warnings),
        updatedCounts: {
          added: 0,
          updated: 0,
          duplicates: 0,
          preserved: parsed.rows.length
        },
        summary: summarizeCaptureRows(parsed.rows, [], args.target)
      };
    }

    const recoveryContent =
      parsed.malformed && parsed.recoveryContent ? parsed.recoveryContent : null;
    const rendered = renderCaptureIndexDocument(args.target, rows, recoveryContent);

    warnings.push(
      ...await writeTextFile(absolutePath, rendered, {
        label: targetPath
      })
    );

    return {
      ...buildEmptyCaptureMutationResult(targetPath, "updated", warnings),
      updatedCounts: {
        added: 0,
        updated,
        duplicates: 0,
        preserved: Math.max(rows.length - updated, 0)
      },
      matchedEntryIds: updates.map((update) => update.id.trim().toUpperCase()),
      entries: rows.filter((row) =>
        updates.some((update) => row.id === update.id.trim().toUpperCase())
      ),
      summary: summarizeCaptureRows(
        rows,
        rows.filter((row) => updates.some((update) => row.id === update.id.trim().toUpperCase())),
        args.target
      )
    };
  }

  const normalizedText = normalizeCaptureText(args.entry?.text ?? "");

  if (normalizedText.length === 0) {
    return {
      ...buildEmptyCaptureMutationResult(targetPath, "invalid", [
        ...warnings,
        "Capture entry text must not be blank."
      ]),
      updatedCounts: {
        added: 0,
        updated: 0,
        duplicates: 0,
        preserved: parsed.rows.length
      },
      summary: summarizeCaptureRows(parsed.rows, [], args.target)
    };
  }

  const duplicateRows = parsed.rows.filter(
    (row) => captureDedupKey(row.description) === captureDedupKey(normalizedText)
  );

  if (duplicateRows.length > 0) {
    warnings.push(
      `Preserved existing ${args.target} entry because the normalized description already exists.`
    );

    return {
      ...buildEmptyCaptureMutationResult(targetPath, "duplicate", warnings),
      duplicateEntryIds: duplicateRows.map((row) => row.id),
      updatedCounts: {
        added: 0,
        updated: 0,
        duplicates: duplicateRows.length,
        preserved: parsed.rows.length
      },
      matchedEntryIds: duplicateRows.map((row) => row.id),
      entries: duplicateRows,
      summary: summarizeCaptureRows(parsed.rows, duplicateRows, args.target)
    };
  }

  const reservedPhase =
    args.target === "backlog" && (args.entry?.reservePhaseStub ?? false)
      ? buildReservedBacklogPhase(parsed.rows, normalizedText)
      : null;
  const normalizedStatus =
    config.defaultStatus !== null
      ? normalizeStoredCaptureStatus(args.target, args.entry?.status) ?? config.defaultStatus
      : null;
  const nextRow: CaptureIndexRow = {
    id: nextCaptureEntryId(parsed.rows, config.idPrefix),
    added: normalizeCaptureDate(args.entry?.addedAt),
    status: config.defaultStatus !== null ? normalizedStatus : null,
    description: normalizedText,
    reservedPhase: reservedPhase?.phaseNumber ?? null
  };
  const rows = [...parsed.rows, nextRow];
  const recoveryContent =
    parsed.malformed && parsed.recoveryContent ? parsed.recoveryContent : null;
  const rendered = renderCaptureIndexDocument(args.target, rows, recoveryContent);

  warnings.push(
    ...await writeTextFile(absolutePath, rendered, {
      label: targetPath
    })
  );

  return {
    ...buildEmptyCaptureMutationResult(targetPath, exists ? "updated" : "created", warnings),
    createdEntryIds: [nextRow.id],
    updatedCounts: {
      added: 1,
      updated: 0,
      duplicates: 0,
      preserved: parsed.rows.length
    },
    reservedPhase,
    matchedEntryIds: [nextRow.id],
    entries: [nextRow],
    summary: summarizeCaptureRows(rows, [nextRow], args.target)
  };
}

function collectPhaseBundleIssues(
  phaseArtifacts: string[],
  phaseDirectories: string[]
): string[] {
  const issues: string[] = [];

  for (const directoryName of phaseDirectories) {
    const phasePrefix = directoryName.match(/^(\d+(?:\.\d+)?)/)?.[1];

    if (!phasePrefix) {
      continue;
    }

    const phaseRoot = `${BLUEPRINT_PHASES_PATH}/${directoryName}/`;
    const expectedPrefix = `${phaseRoot}${phasePrefix}`;
    const artifactsForPhase = phaseArtifacts.filter((artifact) =>
      artifact.startsWith(phaseRoot)
    );

    if (artifactsForPhase.length === 0) {
      continue;
    }

    const hasContext = artifactsForPhase.some((artifact) =>
      artifact.endsWith(`${expectedPrefix}-CONTEXT.md`)
    );
    const hasDiscussionLog = artifactsForPhase.some((artifact) =>
      artifact.endsWith(`${expectedPrefix}-DISCUSSION-LOG.md`)
    );
    const hasResearch = artifactsForPhase.some((artifact) =>
      artifact.endsWith(`${expectedPrefix}-RESEARCH.md`)
    );
    const hasUiSpec = artifactsForPhase.some((artifact) =>
      artifact.endsWith(`${expectedPrefix}-UI-SPEC.md`)
    );
    const hasPlan = artifactsForPhase.some((artifact) =>
      artifact.includes(`${expectedPrefix}-`) && artifact.endsWith("-PLAN.md")
    );
    const hasSummary = artifactsForPhase.some((artifact) =>
      artifact.includes(`${expectedPrefix}-`) && artifact.endsWith("-SUMMARY.md")
    );
    const hasVerification = artifactsForPhase.some((artifact) =>
      artifact.endsWith(`${expectedPrefix}-VERIFICATION.md`)
    );
    const hasUat = artifactsForPhase.some((artifact) =>
      artifact.endsWith(`${expectedPrefix}-UAT.md`)
    );
    const hasCheckpoint = artifactsForPhase.some((artifact) =>
      artifact.endsWith(`${expectedPrefix}-DISCUSS-CHECKPOINT.json`)
    );

    if (
      !hasContext &&
      (
        hasDiscussionLog ||
        hasResearch ||
        hasUiSpec ||
        hasPlan ||
        hasSummary ||
        hasVerification ||
        hasUat ||
        hasCheckpoint
      )
    ) {
      issues.push(
        `Phase artifact flow is inconsistent for ${directoryName}: missing CONTEXT before later discovery or execution artifacts.`
      );
    }

    if (hasSummary && !hasPlan) {
      issues.push(
        `Phase artifact flow is inconsistent for ${directoryName}: SUMMARY artifacts exist without a PLAN artifact.`
      );
    }

    if (hasVerification && !hasSummary) {
      issues.push(
        `Phase artifact flow is inconsistent for ${directoryName}: VERIFICATION artifacts exist without a SUMMARY artifact.`
      );
    }

    if (hasUat && !hasVerification) {
      issues.push(
        `Phase artifact flow is inconsistent for ${directoryName}: UAT artifacts exist without a VERIFICATION artifact.`
      );
    }

    for (const planArtifact of artifactsForPhase.filter((artifact) => artifact.endsWith("-PLAN.md"))) {
      const relativePath = planArtifact.replace(`${phaseRoot}`, "");
      const planMatch = relativePath.match(
        new RegExp(`^${phasePrefix}-(\\d+)-PLAN\\.md$`)
      );

      if (!planMatch) {
        issues.push(
          `Phase artifact flow is inconsistent for ${directoryName}: plan artifact ${planArtifact} does not use the canonical ${phasePrefix}-NN-PLAN.md naming.`
        );
      }
    }
  }

  return issues;
}

export async function blueprintArtifactValidate(
  args: ArtifactValidateArgs = {}
): Promise<ArtifactValidateResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const inspection = await inspectBlueprintArtifacts(projectRoot);
  const issues: string[] = [];
  const suggestedRepairs = new Set<string>();
  const warnings: string[] = [];

  if (!inspection.blueprintRootExists) {
    issues.push(`Missing ${BLUEPRINT_DIR}/ directory.`);
    suggestedRepairs.add("Run /blu-new-project to initialize Blueprint artifacts.");
  }

  for (const artifact of inspection.core.missing) {
    issues.push(`Missing core artifact: ${artifact}`);
  }

  if (inspection.core.missing.length > 0) {
    suggestedRepairs.add("Run /blu-health to inspect partial Blueprint state.");
    suggestedRepairs.add("Use /blu-health --repair only after reviewing the proposed writes.");
  }

  const configPath = resolveBlueprintPath(projectRoot, BLUEPRINT_CONFIG_PATH);
  const configExists = await pathExists(configPath);

  if (configExists) {
    try {
      const config = await blueprintConfigGet({
        scope: "project",
        cwd: projectRoot
      });

      for (const warning of config.warnings) {
        issues.push(`Config warning: ${warning}`);
      }

      if (config.warnings.length > 0) {
        suggestedRepairs.add(
          "Run /blu-health --repair to normalize malformed or legacy Blueprint config."
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      issues.push(`Malformed config: ${message}`);
      suggestedRepairs.add(
        "Run /blu-health --repair to rewrite .blueprint/config.json in normalized form."
      );
    }
  }

  const phaseDirectories = await listImmediateDirectories(
    resolveBlueprintPath(projectRoot, BLUEPRINT_PHASES_PATH)
  );

  for (const issue of collectPhaseBundleIssues(inspection.phases, phaseDirectories)) {
    issues.push(issue);
    suggestedRepairs.add("Restore or regenerate the missing phase artifacts before execution.");
  }

  if (inspection.codebase.present.length > 0 && inspection.codebase.missing.length > 0) {
    issues.push(
      `Codebase artifact bundle is incomplete: missing ${inspection.codebase.missing.join(", ")}`
    );
    suggestedRepairs.add("Re-run /blu-map-codebase to recreate the missing codebase artifacts.");
  }

  if (inspection.codebase.present.length > 0) {
    warnings.push(
      "Existing codebase artifacts are present and should be reused unless replace is explicitly confirmed."
    );
  }

  for (const artifact of inspection.phases.filter((value) => value.endsWith("-RESEARCH.md"))) {
    const absolutePath = resolveBlueprintPath(projectRoot, artifact);
    const raw = await fs.readFile(absolutePath, "utf8");
    const validation = validateResearchArtifactContent(raw);

    for (const issue of validation.issues) {
      issues.push(`${artifact}: ${issue}`);
    }

    for (const warning of validation.warnings) {
      warnings.push(`${artifact}: ${warning}`);
    }

    if (!validation.valid) {
      suggestedRepairs.add(
        "Regenerate or update malformed phase research through /blu-research-phase before planning."
      );
    }
  }

  for (const artifact of inspection.phases.filter((value) => value.endsWith("-PLAN.md"))) {
    const absolutePath = resolveBlueprintPath(projectRoot, artifact);
    const phaseMatch = artifact.match(/\/(\d+(?:\.\d+)?)-\d+-PLAN\.md$/);
    const expectedPhase = phaseMatch?.[1];
    const raw = await fs.readFile(absolutePath, "utf8");
    const validation = validatePlanArtifactContent(raw, expectedPhase);

    for (const issue of validation.issues) {
      issues.push(`${artifact}: ${issue}`);
    }

    for (const warning of validation.warnings) {
      warnings.push(`${artifact}: ${warning}`);
    }

    if (!validation.valid) {
      suggestedRepairs.add(
        "Regenerate or update malformed phase plans through /blu-plan-phase before execution."
      );
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    suggestedRepairs: [...suggestedRepairs],
    warnings
  };
}

type PackageManifest = {
  name?: unknown;
  type?: unknown;
  scripts?: unknown;
  dependencies?: unknown;
  devDependencies?: unknown;
};

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function normalizeInputPaths(projectRoot: string, values?: string[]): string[] {
  if (!values || values.length === 0) {
    return [];
  }

  return uniqueSorted(
    values
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => toRepoRelativePath(projectRoot, resolveRepoRelativePath(projectRoot, value)))
  );
}

async function normalizeOptionalRepoPath(
  projectRoot: string,
  value: string | undefined,
  fallback: string
): Promise<string | null> {
  const candidate = value?.trim() || fallback;
  const absolutePath = resolveRepoRelativePath(projectRoot, candidate);

  if (!(await pathExists(absolutePath))) {
    return null;
  }

  return toRepoRelativePath(projectRoot, absolutePath);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

function collectDependencyNames(manifest: PackageManifest): string[] {
  return uniqueSorted([
    ...Object.keys(asRecord(manifest.dependencies)),
    ...Object.keys(asRecord(manifest.devDependencies))
  ]);
}

function detectTestFramework(manifest: PackageManifest, testFiles: string[]): string {
  const scripts = asRecord(manifest.scripts);
  const testScript = typeof scripts.test === "string" ? scripts.test : "";
  const dependencies = collectDependencyNames(manifest);

  if (testScript.includes("--test") || testFiles.some((file) => file.endsWith(".test.ts"))) {
    return testScript.includes("tsx")
      ? "node:test via tsx --test"
      : "node:test";
  }

  if (dependencies.includes("vitest")) {
    return "Vitest";
  }

  if (dependencies.includes("jest")) {
    return "Jest";
  }

  return testFiles.length > 0 ? "custom test harness" : "no test framework detected";
}

function summarizeTopDirectories(files: string[]): string[] {
  return uniqueSorted(
    files
      .map((file) => file.split("/")[0] ?? file)
      .filter((segment) => segment.length > 0)
  );
}

function summarizeIntegrations(
  dependencies: string[],
  sourceFiles: string[],
  trackedFiles: string[]
): string[] {
  const integrationPackages = dependencies.filter((dependency) =>
    /^@modelcontextprotocol\/sdk$|^@octokit\/rest$|^axios$|^zod$/.test(dependency)
  );
  const integrationPaths = uniqueSorted(
    [...sourceFiles, ...trackedFiles].filter((file) => file.includes("/integrations/"))
  );

  return uniqueSorted([...integrationPackages, ...integrationPaths]).slice(0, 5);
}

function buildCodebaseDigestSections(args: {
  focusArea?: string;
  packageManifest: PackageManifest;
  packageJsonPath: string | null;
  readmePath: string | null;
  sourceFiles: string[];
  testFiles: string[];
  docFiles: string[];
  trackedFiles: string[];
}): ArtifactSummaryDigestSection[] {
  const dependencies = collectDependencyNames(args.packageManifest);
  const testFramework = detectTestFramework(args.packageManifest, args.testFiles);
  const sourceRoots = summarizeTopDirectories(args.sourceFiles);
  const docRoots = summarizeTopDirectories(args.docFiles);
  const runtime =
    args.sourceFiles.some((file) => file.endsWith(".ts") || file.endsWith(".tsx")) ||
    dependencies.includes("typescript")
      ? "TypeScript"
      : "JavaScript";
  const moduleType =
    typeof args.packageManifest.type === "string" && args.packageManifest.type.length > 0
      ? args.packageManifest.type
      : "commonjs";
  const integrations = summarizeIntegrations(
    dependencies,
    args.sourceFiles,
    args.trackedFiles
  );
  const focusSuffix =
    args.focusArea && args.focusArea.trim().length > 0
      ? ` Focus area requested: ${args.focusArea.trim()}.`
      : "";

  return [
    {
      artifact: `${BLUEPRINT_CODEBASE_PATH}/STACK.md`,
      title: CODEBASE_SECTION_TITLES[`${BLUEPRINT_CODEBASE_PATH}/STACK.md`],
      summary: `${runtime} ${moduleType} project with ${testFramework}. Key package evidence comes from ${args.packageJsonPath ?? "package.json"} and tracked source files.${focusSuffix}`,
      evidence: uniqueSorted(
        [args.packageJsonPath, ...args.sourceFiles.slice(0, 2), ...args.testFiles.slice(0, 1)].filter(
          (value): value is string => Boolean(value)
        )
      )
    },
    {
      artifact: `${BLUEPRINT_CODEBASE_PATH}/ARCHITECTURE.md`,
      title: CODEBASE_SECTION_TITLES[`${BLUEPRINT_CODEBASE_PATH}/ARCHITECTURE.md`],
      summary: `Primary layout centers on ${sourceRoots.join(", ") || "the repo root"}, with ${args.trackedFiles.length} tracked files informing the initial architecture map.${focusSuffix}`,
      evidence: uniqueSorted([...args.sourceFiles.slice(0, 3), ...args.trackedFiles.slice(0, 2)])
    },
    {
      artifact: `${BLUEPRINT_CODEBASE_PATH}/STRUCTURE.md`,
      title: CODEBASE_SECTION_TITLES[`${BLUEPRINT_CODEBASE_PATH}/STRUCTURE.md`],
      summary: `Repository structure is anchored around ${sourceRoots.join(", ") || "the repo root"} with document roots in ${docRoots.join(", ") || "README-only docs"}. Use this map to find implementation seams quickly.${focusSuffix}`,
      evidence: uniqueSorted([
        ...args.sourceFiles.slice(0, 4),
        ...args.docFiles.slice(0, 2),
        ...args.trackedFiles.slice(0, 2)
      ])
    },
    {
      artifact: `${BLUEPRINT_CODEBASE_PATH}/CONVENTIONS.md`,
      title: CODEBASE_SECTION_TITLES[`${BLUEPRINT_CODEBASE_PATH}/CONVENTIONS.md`],
      summary: `The repo signals ${runtime} conventions, ${moduleType} modules, and documented guidance via ${docRoots.join(", ") || "README-only docs"}.`,
      evidence: uniqueSorted(
        [args.readmePath, ...args.docFiles.slice(0, 2), ...args.sourceFiles.slice(0, 2)].filter(
          (value): value is string => Boolean(value)
        )
      )
    },
    {
      artifact: `${BLUEPRINT_CODEBASE_PATH}/TESTING.md`,
      title: CODEBASE_SECTION_TITLES[`${BLUEPRINT_CODEBASE_PATH}/TESTING.md`],
      summary: `Testing evidence points to ${testFramework} with ${args.testFiles.length} test file(s) and documentation coverage in ${docRoots.includes("docs") ? "docs/" : "README.md"}.`,
      evidence: uniqueSorted(
        [...args.testFiles.slice(0, 3), ...args.docFiles.filter((file) => file.startsWith("docs/")).slice(0, 1)]
      )
    },
    {
      artifact: `${BLUEPRINT_CODEBASE_PATH}/INTEGRATIONS.md`,
      title: CODEBASE_SECTION_TITLES[`${BLUEPRINT_CODEBASE_PATH}/INTEGRATIONS.md`],
      summary:
        integrations.length > 0
          ? `Detected integration signals include ${integrations.join(", ")}.`
          : "No explicit third-party integration surface was detected from the supplied repo evidence.",
      evidence: uniqueSorted(
        [...integrations, ...args.sourceFiles.filter((file) => file.includes("/integrations/")).slice(0, 2)]
      )
    },
    {
      artifact: `${BLUEPRINT_CODEBASE_PATH}/CONCERNS.md`,
      title: CODEBASE_SECTION_TITLES[`${BLUEPRINT_CODEBASE_PATH}/CONCERNS.md`],
      summary:
        args.docFiles.length > 0
          ? `Docs exist under ${docRoots.join(", ")}, but reruns should preserve edited codebase docs unless replace is explicitly confirmed.`
          : "Documentation signals are thin, so generated codebase docs should be reviewed before deeper discovery or planning.",
      evidence: uniqueSorted(
        [...args.docFiles.slice(0, 2), ...args.trackedFiles.slice(0, 2), ...args.testFiles.slice(0, 1)]
      )
    }
  ];
}

function summarizeArtifactContent(content: string): {
  title: string;
  summary: string;
  evidence: string[];
} {
  const normalizedLines = content
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
    summary: bodyLine ?? "Artifact content is present and available for review.",
    evidence: []
  };
}

async function buildArtifactDigestSections(
  projectRoot: string,
  artifactPaths: string[]
): Promise<ArtifactSummaryDigestSection[]> {
  const digest: ArtifactSummaryDigestSection[] = [];

  for (const artifactPath of artifactPaths) {
    const absolutePath = resolveRepoRelativePath(projectRoot, artifactPath);
    const raw = await fs.readFile(absolutePath, "utf8");
    const summary = summarizeArtifactContent(raw);

    digest.push({
      artifact: artifactPath,
      title:
        summary.title.length > 0
          ? summary.title
          : path.basename(artifactPath, path.extname(artifactPath)),
      summary: summary.summary,
      evidence: [artifactPath]
    });
  }

  return digest;
}

export async function blueprintArtifactSummaryDigest(
  args: ArtifactSummaryDigestArgs = {}
): Promise<ArtifactSummaryDigestResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const artifactPaths = normalizeInputPaths(projectRoot, args.artifactPaths);

  if (artifactPaths.length > 0) {
    return {
      digest: await buildArtifactDigestSections(projectRoot, artifactPaths),
      inputsUsed: artifactPaths
    };
  }

  const packageJsonPath = await normalizeOptionalRepoPath(
    projectRoot,
    args.packageJsonPath,
    "package.json"
  );
  const readmePath = await normalizeOptionalRepoPath(projectRoot, args.readmePath, "README.md");
  const sourceFiles = normalizeInputPaths(projectRoot, args.sourceFiles);
  const testFiles = normalizeInputPaths(projectRoot, args.testFiles);
  const docFiles = normalizeInputPaths(projectRoot, args.docFiles);
  const trackedFiles = normalizeInputPaths(projectRoot, args.trackedFiles);

  let packageManifest: PackageManifest = {};

  if (packageJsonPath) {
    try {
      const packageJson = await readJsonIfPresent(
        resolveRepoRelativePath(projectRoot, packageJsonPath)
      );
      packageManifest = packageJson ?? {};
    } catch {
      packageManifest = {};
    }
  }

  const digest = buildCodebaseDigestSections({
    focusArea: args.focusArea,
    packageManifest,
    packageJsonPath,
    readmePath,
    sourceFiles,
    testFiles,
    docFiles,
    trackedFiles
  });
  const inputsUsed = uniqueSorted([
    packageJsonPath ?? "",
    readmePath ?? "",
    ...sourceFiles,
    ...testFiles,
    ...docFiles,
    ...trackedFiles
  ]).filter((value) => value.length > 0);

  return {
    digest,
    inputsUsed
  };
}

export async function blueprintArtifactReportWrite(
  args: ArtifactReportWriteArgs
): Promise<ArtifactReportWriteResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const inspection = await inspectBlueprintArtifacts(projectRoot);

  if (inspection.readiness === "uninitialized") {
    throw new Error(
      "Blueprint report writes require an initialized or partial Blueprint project with a .blueprint/ directory."
    );
  }

  const pathValue = buildBlueprintReportPath(args.reportName);
  const absolutePath = resolveBlueprintPath(projectRoot, pathValue);
  const normalizedContent = args.content.endsWith("\n") ? args.content : `${args.content}\n`;
  const warnings: string[] = [];
  const exists = await pathExists(absolutePath);

  if (normalizedContent.trim().length === 0) {
    return {
      path: pathValue,
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      warnings: ["Report content must not be empty."]
    };
  }

  if (exists) {
    const existingContent = await fs.readFile(absolutePath, "utf8");

    if (existingContent === normalizedContent) {
      warnings.push("Preserved existing report because the content was unchanged.");

      return {
        path: pathValue,
        written: false,
        created: false,
        overwritten: false,
        status: "reused",
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
    warnings.push(`Replaced existing report: ${pathValue}`);
  }

  return {
    path: pathValue,
    written: true,
    created: !exists,
    overwritten: exists,
    status: exists ? "updated" : "created",
    warnings
  };
}

export const artifactToolDefinitions = [
  {
    name: "blueprint_artifact_scaffold",
    description:
      "Create or reuse Blueprint bootstrap, codebase, and phase artifacts inside .blueprint/.",
    inputSchema: artifactScaffoldInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintArtifactScaffold(args as ArtifactScaffoldArgs)
  },
  {
    name: "blueprint_artifact_list",
    description:
      "List Blueprint core, phase, codebase, and report artifacts without mutating the repo.",
    inputSchema: artifactListInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintArtifactList(args as ArtifactListArgs)
  },
  {
    name: "blueprint_artifact_mutate_index",
    description:
      "Append or update canonical capture entries in project-local Blueprint indexes such as backlog, todo, and notes, and inspect or update todo status deterministically.",
    inputSchema: artifactMutateIndexInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintArtifactMutateIndex(args as ArtifactMutateIndexArgs)
  },
  {
    name: "blueprint_artifact_validate",
    description:
      "Validate Blueprint artifact structure, config health, and bundle completeness.",
    inputSchema: artifactValidateInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintArtifactValidate(args as ArtifactValidateArgs)
  },
  {
    name: "blueprint_artifact_summary_digest",
    description:
      "Build deterministic codebase mapping digests from repo evidence without mutating Blueprint artifacts.",
    inputSchema: artifactSummaryDigestInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintArtifactSummaryDigest(args as ArtifactSummaryDigestArgs)
  },
  {
    name: "blueprint_artifact_report_write",
    description:
      "Persist a non-phase Blueprint report inside .blueprint/reports/ with overwrite protection.",
    inputSchema: artifactReportWriteInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintArtifactReportWrite(args as ArtifactReportWriteArgs)
  }
];
