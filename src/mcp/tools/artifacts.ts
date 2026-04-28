import { promises as fs } from "node:fs";
import path from "node:path";

import * as z from "zod/v4";

import {
  artifactContractIds,
  type ArtifactContractId,
  listArtifactContracts,
  readArtifactContract,
  renderArtifactScaffoldTemplate,
  resolveCodebaseArtifactContractId,
  resolvePhaseArtifactContractId,
  resolveReportContractId,
  resolveReviewArtifactContractId
} from "../artifact-contracts/index.js";
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
const OPERATIONAL_ONLY_BLUEPRINT_ARTIFACTS = new Set([
  `${BLUEPRINT_DIR}/mcp-write-failures.ndjson`
]);
const CODEBASE_ARTIFACT_CONTRACT_IDS = [
  "codebase.stack",
  "codebase.architecture",
  "codebase.structure",
  "codebase.conventions",
  "codebase.testing",
  "codebase.integrations",
  "codebase.concerns"
] as const satisfies readonly ArtifactContractId[];
type CodebaseArtifactContractId = (typeof CODEBASE_ARTIFACT_CONTRACT_IDS)[number];
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
export type BlueprintReadiness =
  | "uninitialized"
  | "mapping-incomplete"
  | "mapped-only"
  | "partial"
  | "initialized";
export type BootstrapRepoShape = "greenfield" | "scaffold-only" | "brownfield";
export type BootstrapRequirementScope = "committed" | "deferred" | "out_of_scope";
export type BootstrapRequirementRow = {
  id: string;
  scope?: BootstrapRequirementScope;
  group?: string;
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
  successCriteria?: string[];
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
export type CodebaseArtifactDiagnostics = {
  present: string[];
  missing: string[];
  valid: string[];
  invalid: string[];
  mapped: boolean;
  warnings: string[];
};

export const DURABLE_REQUIREMENT_ID_PATTERN = /^[A-Z][A-Z0-9-]*-\d+$/;

export type NormalizedBootstrapRequirementRow = Required<BootstrapRequirementRow>;
export type NormalizedBootstrapSeed = Omit<Required<BootstrapSeed>, "requirements"> & {
  requirements: NormalizedBootstrapRequirementRow[];
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

type ArtifactContractReadArgs = {
  artifactId?: ArtifactContractId;
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

type ArtifactContractReadResult =
  | {
      artifactId: ArtifactContractId;
      contract: ReturnType<typeof readArtifactContract>;
      contracts?: never;
    }
  | {
      artifactId: null;
      contract?: never;
      contracts: ReturnType<typeof listArtifactContracts>;
    };

type ArtifactReportWriteResult = {
  path: string;
  written: boolean;
  created: boolean;
  overwritten: boolean;
  status: "created" | "updated" | "reused" | "invalid";
  warnings: string[];
};

type ArtifactCodebaseWriteArgs = {
  cwd?: string;
  artifactId: CodebaseArtifactContractId;
  content: string;
  overwrite?: boolean;
};

type ArtifactCodebaseWriteResult = {
  path: string;
  artifactId: CodebaseArtifactContractId;
  written: boolean;
  created: boolean;
  overwritten: boolean;
  reused: boolean;
  status: "created" | "updated" | "reused" | "invalid";
  issues: string[];
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
  gapClosure: boolean;
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

async function assessRootBootstrapShape(projectRoot: string): Promise<{
  repoShape: BootstrapRepoShape;
  reasons: string[];
}> {
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

  return {
    repoShape,
    reasons
  };
}

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

function normalizeSuccessCriteria(values: string[] | undefined, fallback: string[]): string[] {
  return normalizeList(values, fallback);
}

function normalizeBootstrapRoadmapPhaseRequirementIds(
  phase: BootstrapRoadmapPhase,
  requirements: NormalizedBootstrapRequirementRow[],
  phaseIndex: number
): string[] {
  const explicitRequirementIds = [...new Set((phase.requirementIds ?? []).map((value) => value.trim()))]
    .filter((value) => value.length > 0);

  if (explicitRequirementIds.length > 0) {
    return explicitRequirementIds;
  }

  const preferredScopes: BootstrapRequirementScope[] =
    phaseIndex === 0
      ? ["committed", "deferred", "out_of_scope"]
      : phaseIndex === 1
        ? ["deferred", "committed", "out_of_scope"]
        : ["out_of_scope", "deferred", "committed"];

  for (const scope of preferredScopes) {
    const requirementIds = requirements
      .filter((requirement) => requirement.scope === scope)
      .map((requirement) => requirement.id);

    if (requirementIds.length > 0) {
      return requirementIds;
    }
  }

  return requirements.map((requirement) => requirement.id);
}

const BOOTSTRAP_REQUIREMENT_SCOPE_ORDER: BootstrapRequirementScope[] = [
  "committed",
  "deferred",
  "out_of_scope"
];

function normalizeRequirementScope(
  value: string | undefined,
  fallback: BootstrapRequirementScope
): BootstrapRequirementScope {
  const normalized = normalizeCaptureStatus(value ?? "").replace(/[\s-]+/g, "_");

  if (normalized.length === 0) {
    return fallback;
  }

  if (["committed", "v1", "current", "core"].includes(normalized)) {
    return "committed";
  }

  if (["deferred", "later", "future", "post_v1", "postv1"].includes(normalized)) {
    return "deferred";
  }

  if (["out_of_scope", "outofscope", "cut", "cuts", "excluded"].includes(normalized)) {
    return "out_of_scope";
  }

  throw new Error(
    `Requirement scope must be one of: committed, deferred, out_of_scope. Received: ${value ?? ""}`
  );
}

function fallbackRequirementGroup(scope: BootstrapRequirementScope): string {
  if (scope === "committed") {
    return "Committed v1";
  }

  if (scope === "deferred") {
    return "Deferred follow-through";
  }

  return "Out-of-scope cuts";
}

function normalizeRequirementGroup(value: string | undefined, fallback: string): string {
  const normalized = normalizeCaptureText(value ?? "");

  return normalized.length > 0 ? normalized : fallback;
}

function normalizeBootstrapRequirements(
  requirements: BootstrapRequirementRow[] | undefined,
  defaults: BootstrapRequirementRow[]
): NormalizedBootstrapRequirementRow[] {
  const source = requirements ?? defaults;

  return source
    .filter(
      (requirement) =>
        requirement.id.trim().length > 0 && requirement.requirement.trim().length > 0
    )
    .map((requirement, index) => {
      const defaultRequirement = defaults[index];
      const scope = normalizeRequirementScope(
        requirement.scope,
        defaultRequirement?.scope ?? "committed"
      );

      return {
        id: requirement.id.trim(),
        scope,
        group: normalizeRequirementGroup(
          requirement.group,
          defaultRequirement?.group ?? fallbackRequirementGroup(scope)
        ),
        requirement: requirement.requirement.trim(),
        status: requirement.status.trim(),
        notes: requirement.notes.trim()
      };
    });
}

function requirementScopeOrder(scope: BootstrapRequirementScope): number {
  return BOOTSTRAP_REQUIREMENT_SCOPE_ORDER.indexOf(scope);
}

function requirementScopeLabel(scope: BootstrapRequirementScope): string {
  if (scope === "committed") {
    return "Committed V1 Scope";
  }

  if (scope === "deferred") {
    return "Deferred Scope";
  }

  return "Out-of-Scope Cuts";
}

function requirementScopeSummaryLabel(scope: BootstrapRequirementScope): string {
  if (scope === "committed") {
    return "Committed v1";
  }

  if (scope === "deferred") {
    return "Deferred";
  }

  return "Out-of-scope";
}

function bootstrapRequirementSort(
  left: NormalizedBootstrapRequirementRow,
  right: NormalizedBootstrapRequirementRow
): number {
  const scopeDelta = requirementScopeOrder(left.scope) - requirementScopeOrder(right.scope);

  if (scopeDelta !== 0) {
    return scopeDelta;
  }

  const groupDelta = left.group.localeCompare(right.group, undefined, {
    numeric: true,
    sensitivity: "base"
  });

  if (groupDelta !== 0) {
    return groupDelta;
  }

  return left.id.localeCompare(right.id, undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

function groupBootstrapRequirements(
  requirements: NormalizedBootstrapRequirementRow[]
): Map<BootstrapRequirementScope, NormalizedBootstrapRequirementRow[]> {
  const grouped = new Map<BootstrapRequirementScope, NormalizedBootstrapRequirementRow[]>();

  for (const requirement of requirements.slice().sort(bootstrapRequirementSort)) {
    const scopeRequirements = grouped.get(requirement.scope) ?? [];
    scopeRequirements.push(requirement);
    grouped.set(requirement.scope, scopeRequirements);
  }

  return grouped;
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

export function buildDefaultBootstrapSeed(
  projectName: string,
  assessment: BootstrapAssessment,
  seed?: BootstrapSeed
): NormalizedBootstrapSeed {
  const defaultVision =
    assessment.repoShape === "brownfield"
      ? `Bring ${projectName} under Blueprint with the saved codebase map, durable requirements, and a roadmap grounded in current repo evidence.`
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
      ? "Replacing or ignoring the saved `.blueprint/codebase/` mapping during bootstrap."
      : "Prompt-only bootstrap artifacts that skip requirement or roadmap traceability."
  ];
  const defaultRequirements: BootstrapRequirementRow[] =
    assessment.repoShape === "brownfield"
      ? [
          {
            id: "RQ-01",
            scope: "committed",
            group: "Repo alignment",
            requirement:
              "Document the repo's current product direction, technical boundaries, and maintenance constraints before downstream planning.",
            status: "Pending",
            notes: "Brownfield bootstrap requirement."
          },
          {
            id: "RQ-02",
            scope: "committed",
            group: "Traceability",
            requirement:
              "Create a requirement set whose IDs remain traceable from the roadmap and later phase artifacts.",
            status: "Pending",
            notes: "Traceability must survive later lifecycle commands."
          },
          {
            id: "RQ-03",
            scope: "committed",
            group: "Mapped baseline",
            requirement:
              "Use the saved codebase mapping bundle as bootstrap evidence for requirements and roadmap scope.",
            status: "Pending",
            notes: "Map-first bootstrap has already produced the codebase bundle."
          },
          {
            id: "RQ-04",
            scope: "out_of_scope",
            group: "Future expansion cuts",
            requirement:
              "Do not promote implementation work or long-horizon automation until the mapped baseline is understood.",
            status: "Pending",
            notes: "Keep bootstrap scope narrower than execution planning."
          }
        ]
      : [
          {
            id: "RQ-01",
            scope: "committed",
            group: "Product direction",
            requirement:
              `Define the product outcome and first-milestone goals for ${projectName}.`,
            status: "Pending",
            notes: "Bootstrap draft requirement."
          },
          {
            id: "RQ-02",
            scope: "committed",
            group: "Delivery boundaries",
            requirement:
              "Record durable constraints, non-goals, and acceptance boundaries before detailed planning starts.",
            status: "Pending",
            notes: "Keeps later discovery and planning grounded."
          },
          {
            id: "RQ-03",
            scope: "deferred",
            group: "Follow-through planning",
            requirement:
              "Prepare the repo for Blueprint lifecycle commands with stable requirement and roadmap traceability.",
            status: "Pending",
            notes: "Foundation requirement for later phases."
          },
          {
            id: "RQ-04",
            scope: "out_of_scope",
            group: "Explicit bootstrap cuts",
            requirement:
              "Do not turn the bootstrap draft into a full implementation backlog or execution plan.",
            status: "Pending",
            notes: "Keeps v1 bootstrap narrower than later work streams."
          }
        ];
  const defaultRoadmapPhases: BootstrapRoadmapPhase[] =
    assessment.repoShape === "brownfield"
      ? [
          {
            phase: "1",
            title: "Align Requirements With Mapped Codebase",
            objective:
              "Convert the saved codebase map into durable project intent, requirements, and first-milestone scope.",
            requirementIds: ["RQ-01", "RQ-02"],
            successCriteria: [
              "PROJECT.md and REQUIREMENTS.md cite the saved `.blueprint/codebase/` bundle as bootstrap evidence.",
              "The first milestone separates mapped brownfield facts from assumptions that still need owner review."
            ]
          },
          {
            phase: "2",
            title: "Plan First Brownfield Delivery Slice",
            objective:
              "Shape the first implementation slice from mapped repo constraints and durable requirements.",
            requirementIds: ["RQ-03"],
            successCriteria: [
              "ROADMAP.md names the first delivery slice from the mapped repo constraints.",
              "The preserved codebase map can be reused by later discovery without rerunning bootstrap."
            ]
          }
        ]
      : [
          {
            phase: "1",
            title: "Discovery And Definition",
            objective:
              "Confirm product intent, user constraints, and first-milestone scope before deeper lifecycle commands run.",
            requirementIds: ["RQ-01"],
            successCriteria: [
              "PROJECT.md names the product audience, value, constraints, and first milestone.",
              "REQUIREMENTS.md records committed product-direction requirements with durable IDs."
            ]
          },
          {
            phase: "2",
            title: "Foundation Bootstrap",
            objective:
              "Turn the bootstrap draft into durable planning inputs for later execution-oriented phases.",
            requirementIds: ["RQ-02"],
            successCriteria: [
              "ROADMAP.md maps delivery-boundary requirements to concrete follow-up phases.",
              "STATE.md routes maintainers to `/blu-progress` after bootstrap validation passes."
            ]
          }
        ];
  const defaultAssumptions =
    assessment.repoShape === "brownfield"
      ? [
          "The saved codebase mapping is the baseline for bootstrap scope.",
          "Bootstrap artifacts should preserve mapped evidence rather than replacing it."
        ]
      : [
          "The first milestone should stay small enough to validate Blueprint's workflow on this repo.",
          "Bootstrap artifacts can start as draft planning inputs as long as they are no longer placeholder-only shells."
        ];
  const normalizedRequirements = normalizeBootstrapRequirements(seed?.requirements, defaultRequirements);
  const sourceRoadmapPhases =
    seed?.roadmapPhases?.filter(
      (phase) => phase.phase.trim().length > 0 && phase.title.trim().length > 0
    ) ?? defaultRoadmapPhases;

  return {
    vision: seed?.vision?.trim() || defaultVision,
    audience: {
      primary: normalizeList(seed?.audience?.primary, defaultPrimaryAudience),
      secondary: normalizeList(seed?.audience?.secondary, defaultSecondaryAudience)
    },
    constraints: normalizeList(seed?.constraints, defaultConstraints),
    currentMilestone: defaultMilestone,
    nonGoals: normalizeList(seed?.nonGoals, defaultNonGoals),
    requirements: normalizedRequirements,
    roadmapPhases: sourceRoadmapPhases.map((phase, index) => ({
      ...phase,
      requirementIds: normalizeBootstrapRoadmapPhaseRequirementIds(phase, normalizedRequirements, index),
      successCriteria: normalizeSuccessCriteria(phase.successCriteria, [
        `${phase.title} produces reviewable Blueprint artifacts tied to the selected requirement IDs.`,
        "Maintainers can validate the phase outcome through `.blueprint/ROADMAP.md` and `.blueprint/STATE.md`."
      ])
    })),
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
  const requirements = normalizeBootstrapRequirements(seed.requirements, seed.requirements);
  const primaryAudience = normalizeList(seed.audience.primary, []);
  const secondaryAudience = normalizeList(seed.audience.secondary, []);
  const groupedRequirements = groupBootstrapRequirements(requirements);
  const requirementSummary = BOOTSTRAP_REQUIREMENT_SCOPE_ORDER.map((scope) => {
    const ids = (groupedRequirements.get(scope) ?? []).map((requirement) => requirement.id);

    return `- ${requirementScopeSummaryLabel(scope)}: ${ids.length > 0 ? ids.join(", ") : "none"}`;
  }).join("\n");
  const bootstrapShapeLine =
    context.bootstrapAssessment.repoShape === "brownfield" &&
    !context.bootstrapAssessment.codebaseMapped
      ? "Brownfield bootstrap should stay provisional until `/blu-map-codebase` captures the current repo."
      : context.bootstrapAssessment.repoShape === "brownfield"
        ? "Brownfield bootstrap can use the saved `.blueprint/codebase/` map as durable baseline evidence."
      : "Greenfield bootstrap can shape v1 directly, but deferred cuts still remain visible.";

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

## Bootstrap Shape

- Repository shape: ${titleCaseBootstrapShape(context.bootstrapAssessment.repoShape)}
- Codebase mapping: ${context.bootstrapAssessment.codebaseMapped ? "ready" : "pending"}
- Bootstrap posture: ${bootstrapShapeLine}

## Scope Posture

${requirementSummary}

## Non-Goals

${seed.nonGoals.map((value) => `- ${value}`).join("\n")}

## Assumptions

${seed.assumptions.map((value) => `- ${value}`).join("\n")}
`;
}

const REQUIRED_RESEARCH_SECTIONS = readArtifactContract(
  "phase.research"
).requiredHeadings;
const RESEARCH_CONFIDENCE_VALUES = ["LOW", "MEDIUM", "HIGH"] as const;
const RESEARCH_TEMPLATE_PLACEHOLDER_SIGNALS = readArtifactContract(
  "phase.research"
).placeholderSignals;
const BOOTSTRAP_PROJECT_CONTRACT = readArtifactContract("bootstrap.project");
const PLAN_CONTRACT = readArtifactContract("phase.plan");
const REQUIRED_PLAN_SECTIONS = PLAN_CONTRACT.requiredHeadings;
const PLAN_PLACEHOLDER_SIGNALS = [
  ...PLAN_CONTRACT.placeholderSignals,
  "*Generated by `blueprint_artifact_scaffold`*"
] as const;
const PLAN_TEMPLATE_PLACEHOLDER_LIST_ITEMS = extractPlanTemplatePlaceholderListItems(
  PLAN_CONTRACT.authoringTemplate
);

function renderRequirementsArtifact(context: BootstrapRenderContext): string {
  const seed = buildDefaultBootstrapSeed(
    context.projectName,
    context.bootstrapAssessment,
    context.bootstrapSeed
  );
  const requirements = normalizeBootstrapRequirements(seed.requirements, seed.requirements);
  const groupedRequirements = groupBootstrapRequirements(requirements);
  const rows = requirements
    .slice()
    .sort(bootstrapRequirementSort)
    .map(
      (requirement) =>
        `| ${escapeTableCell(requirement.id)} | ${escapeTableCell(requirement.requirement)} | ${escapeTableCell(requirement.status)} | ${escapeTableCell(requirement.notes)} |`
    )
    .join("\n");
  const scopeSummary = BOOTSTRAP_REQUIREMENT_SCOPE_ORDER.map((scope) => {
    const scopeRequirements = groupedRequirements.get(scope) ?? [];
    const ids = scopeRequirements.map((requirement) => requirement.id).join(", ");
    return `- ${requirementScopeSummaryLabel(scope)}: ${ids.length > 0 ? ids : "none"}`;
  }).join("\n");
  const scopeSections = BOOTSTRAP_REQUIREMENT_SCOPE_ORDER.map((scope) => {
    const scopeRequirements = groupedRequirements.get(scope) ?? [];

    if (scopeRequirements.length === 0) {
      return "";
    }

    const groupedByTheme = new Map<string, Required<BootstrapRequirementRow>[]>();

    for (const requirement of scopeRequirements) {
      const themeRequirements = groupedByTheme.get(requirement.group) ?? [];
      themeRequirements.push(requirement);
      groupedByTheme.set(requirement.group, themeRequirements);
    }

    const themeBlocks = [...groupedByTheme.entries()]
      .sort(([left], [right]) => left.localeCompare(right, undefined, { sensitivity: "base" }))
      .map(([group, requirements]) => {
        const entries = requirements
          .map(
            (requirement) =>
              `- \`${requirement.id}\`: ${requirement.requirement}\n  - Status: ${requirement.status}\n  - Notes: ${requirement.notes}`
          )
          .join("\n");

        return `### ${group}\n\n${entries}`;
      })
      .join("\n\n");

    return `## ${requirementScopeLabel(scope)}\n\n${themeBlocks}`;
  })
    .filter((value) => value.length > 0)
    .join("\n\n");

  return `# Requirements: ${context.projectName}

## Requirements Table

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
${rows}

## Scope Summary

${scopeSummary}

${scopeSections}

## Traceability Notes

- Keep every requirement ID referenced from \`.blueprint/ROADMAP.md\` before execution planning begins.
- Preserve requirement IDs across later phase artifacts instead of silently renumbering them.
- ${context.bootstrapAssessment.repoShape === "brownfield" && !context.bootstrapAssessment.codebaseMapped
    ? "Treat brownfield roadmap coverage as provisional until `/blu-map-codebase` has captured the existing repo."
    : context.bootstrapAssessment.repoShape === "brownfield"
      ? "Use the saved `.blueprint/codebase/` mapping as durable baseline evidence for later discovery and planning."
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
  const requirements = normalizeBootstrapRequirements(seed.requirements, seed.requirements);
  const groupedRequirements = groupBootstrapRequirements(requirements);
  const phases = seed.roadmapPhases
    .map((phase) => {
      const normalizedPhaseNumber = normalizePhaseNumber(phase.phase);
      const marker = phase.status === "done" ? "x" : " ";
      const requirementClause =
        phase.requirementIds && phase.requirementIds.length > 0
          ? ` (Requirements: ${phase.requirementIds.join(", ")})`
          : "";
      const successCriteria = normalizeList(phase.successCriteria, []);
      const successCriteriaBlock =
        successCriteria.length > 0
          ? `  - Success Criteria:\n${successCriteria.map((value) => `    - ${value}`).join("\n")}`
          : "";
      const notes = normalizeList(phase.notes, []).map((value) => `  - ${value}`).join("\n");

      return `- [${marker}] Phase ${normalizedPhaseNumber}: ${phase.title}${requirementClause}
  - Objective: ${phase.objective}${successCriteriaBlock ? `\n${successCriteriaBlock}` : ""}${notes ? `\n${notes}` : ""}`;
    })
    .join("\n");

  return `# Roadmap: ${context.projectName}

## Milestone

- Active milestone: ${seed.currentMilestone}

## Bootstrap Status

- Repository shape: ${titleCaseBootstrapShape(context.bootstrapAssessment.repoShape)}
- Codebase mapping: ${context.bootstrapAssessment.codebaseMapped ? "ready" : "pending"}
- Roadmap confidence: ${context.bootstrapAssessment.provisionalRoadmap ? "provisional until /blu-map-codebase" : "ready for progress review"}

## Requirement Coverage

${BOOTSTRAP_REQUIREMENT_SCOPE_ORDER.map((scope) => {
    const scopeRequirements = groupedRequirements.get(scope) ?? [];
    const ids = scopeRequirements.map((requirement) => requirement.id).join(", ");

    return `- ${requirementScopeSummaryLabel(scope)}: ${ids.length > 0 ? ids : "none"}`;
  }).join("\n")}

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
  ".blueprint/codebase/STACK.md": () => renderArtifactScaffoldTemplate("codebase.stack"),
  ".blueprint/codebase/ARCHITECTURE.md": () => renderArtifactScaffoldTemplate("codebase.architecture"),
  ".blueprint/codebase/STRUCTURE.md": () => renderArtifactScaffoldTemplate("codebase.structure"),
  ".blueprint/codebase/CONVENTIONS.md": () => renderArtifactScaffoldTemplate("codebase.conventions"),
  ".blueprint/codebase/TESTING.md": () => renderArtifactScaffoldTemplate("codebase.testing"),
  ".blueprint/codebase/INTEGRATIONS.md": () => renderArtifactScaffoldTemplate("codebase.integrations"),
  ".blueprint/codebase/CONCERNS.md": () => renderArtifactScaffoldTemplate("codebase.concerns")
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
const artifactContractReadInputSchema = {
  artifactId: z.enum(artifactContractIds).optional()
};
const artifactReportWriteInputSchema = {
  cwd: z.string().optional(),
  reportName: z.string(),
  content: z.string(),
  overwrite: z.boolean().optional()
};
const artifactCodebaseWriteInputSchema = {
  cwd: z.string().optional(),
  artifactId: z.enum(CODEBASE_ARTIFACT_CONTRACT_IDS),
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
  const context = {
    phaseLabel,
    phasePrefix: request.phasePrefix,
    phaseName: title,
    phaseDir: request.phaseDir,
    planId: request.planId ?? "01",
    domain: `${title} implementation research`
  };

  switch (request.kind) {
    case "CONTEXT":
      return renderArtifactScaffoldTemplate("phase.context", context);
    case "DISCUSSION-LOG":
      return renderArtifactScaffoldTemplate("phase.discussion-log", context);
    case "RESEARCH":
      return renderArtifactScaffoldTemplate("phase.research", context);
    case "UI-SPEC":
      return renderArtifactScaffoldTemplate("phase.ui-spec", context);
    case "PLAN":
      return renderArtifactScaffoldTemplate("phase.plan", context);
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

async function acquireBlueprintRepoLock(lockPath: string): Promise<void> {
  const retryDelayMs = 50;
  const staleAfterMs = 60_000;

  await ensureParentDirectory(lockPath);

  for (;;) {
    try {
      await fs.mkdir(lockPath);
      return;
    } catch (error) {
      const lockError = error as NodeJS.ErrnoException;

      if (lockError.code !== "EEXIST") {
        throw error;
      }

      try {
        const stats = await fs.stat(lockPath);

        if (Date.now() - stats.mtimeMs > staleAfterMs) {
          await fs.rm(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch {
        continue;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}

export async function withBlueprintRepoLock<T>(
  projectRoot: string,
  lockName: string,
  task: () => Promise<T>
): Promise<T> {
  const lockPath = resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/locks/${lockName}.lock`);

  await acquireBlueprintRepoLock(lockPath);

  try {
    return await task();
  } finally {
    await fs.rm(lockPath, { recursive: true, force: true });
  }
}

function extractMarkdownSection(markdown: string, heading: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(
    new RegExp(`(?:^|\\n)## ${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`)
  );

  return match?.[1]?.trim() ?? "";
}

export function extractMarkdownTableRows(section: string): string[][] {
  return section
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => isMarkdownTableRow(line) && !isMarkdownTableHeaderRow(line))
    .map((line) => parseMarkdownTableCells(line));
}

function stripPlanPlaceholderSignals(section: string): string {
  return [...PLAN_PLACEHOLDER_SIGNALS, ...PLAN_TEMPLATE_PLACEHOLDER_LIST_ITEMS].reduce(
    (acc, signal) => acc.split(signal).join(""),
    section.replace(/\r\n/g, "\n")
  );
}

function extractPlanTemplatePlaceholderListItems(template: string): string[] {
  return ["Verification", "Must Haves"].flatMap((heading) => {
    const section = extractMarkdownSection(template, heading);

    return section
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^[-*+]\s+/.test(line));
  });
}

function hasSubstantivePlanListContent(section: string): boolean {
  const normalizedSection = stripPlanPlaceholderSignals(section);
  const bulletLines = normalizedSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^(?:[-*+]\s*|\d+\.\s*)+/, "").trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^[#>*`|_\-\s]+$/.test(line))
    .filter((line) => !/^(?:none|n\/a|na|tbd|todo|to do|placeholder|coming soon|replace me|fill in here|insert here)$/i.test(line));

  return bulletLines.length > 0;
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
      gapClosure: false,
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
  const gapClosureValue = scalars.get("gap_closure");

  return {
    phase: scalars.get("phase") ?? null,
    planId: scalars.get("plan_id") ?? null,
    title: scalars.get("title") ?? null,
    wave:
      waveValue && /^\d+$/.test(waveValue) ? Number.parseInt(waveValue, 10) : null,
    gapClosure: gapClosureValue === "true",
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
  const repoDirectoryReference =
    /(?:^|[\s([`])(?:\.blueprint\/|(?:agents|commands|docs|hooks|scripts|skills|src|tests)\/)[A-Za-z0-9._~!$&'()*+,;=:@%/-]+/m;
  const repoRootFileReference =
    /(?:^|[\s([`])(?:AGENTS\.md|MEMORY\.md|PROGRESS\.md|README\.md|gemini-extension\.json|package(?:-lock)?\.json|tabnine-extension\.json|tsconfig\.json)\b/m;

  return (
    /\bhttps?:\/\/[^\s)]+/.test(section) ||
    repoDirectoryReference.test(section) ||
    repoRootFileReference.test(section)
  );
}

function stripResearchPlaceholderSignals(section: string): string {
  return RESEARCH_TEMPLATE_PLACEHOLDER_SIGNALS.reduce(
    (acc, signal) => acc.split(signal).join(""),
    section.replace(/\r\n/g, "\n")
  );
}

function countResearchContentWords(section: string): number {
  return section.match(/[A-Za-z0-9][A-Za-z0-9'/-]*/g)?.length ?? 0;
}

function hasSubstantiveResearchSection(section: string, heading: string): boolean {
  const normalized = stripResearchPlaceholderSignals(section);
  const meaningfulLines = normalized
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.replace(/^(?:[-*]\s*)+/, "").trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^[#>*`|_\-\s]+$/.test(line))
    .filter((line) => !/^why it matters\.?$/i.test(line));

  if (meaningfulLines.length === 0) {
    return false;
  }

  if (heading === "Code Examples") {
    return /```[\s\S]*```/.test(normalized) && countResearchContentWords(normalized) >= 3;
  }

  return meaningfulLines.some((line) => countResearchContentWords(line) >= 3);
}

function hasExplicitFreshnessDate(section: string): boolean {
  return (
    /\b\d{4}-\d{2}-\d{2}\b/.test(section) ||
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]* \d{1,2}, \d{4}\b/.test(
      section
    )
  );
}

function marksExternalCurrencyUnchecked(section: string): boolean {
  return /not externally checked|external currency (?:was )?not checked/i.test(section);
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
    if (
      !new RegExp(`(?:^|\\n)## ${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m").test(
        content
      )
    ) {
      issues.push(`Research artifact is missing required section: ${heading}.`);
      continue;
    }

    const section = extractMarkdownSection(content, heading);

    if (!hasSubstantiveResearchSection(section, heading)) {
      issues.push(
        `Research artifact section ${heading} must contain substantive content after placeholders are removed.`
      );
    }
  }

  const phaseRequirements = extractMarkdownSection(content, "Phase Requirements");

  if (!hasRequirementTableRows(phaseRequirements)) {
    issues.push(
      "Research artifact section Phase Requirements must include at least one populated requirement row."
    );
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

  const stateOfTheArt = extractMarkdownSection(content, "State Of The Art");

  if (
    !marksExternalCurrencyUnchecked(stateOfTheArt) &&
    !hasExplicitFreshnessDate(stateOfTheArt)
  ) {
    issues.push(
      "Research artifact section State Of The Art must include an explicit source date for freshness-sensitive claims or say that external currency was not checked."
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

function collectReferencedSummaryPaths(section: string, summaryPaths: string[]): string[] {
  const normalizedSection = section.trim();

  if (normalizedSection.length === 0 || summaryPaths.length === 0) {
    return [];
  }

  return summaryPaths.filter((summaryPath) => {
    const fileName = summaryPath.split("/").pop() ?? summaryPath;
    return normalizedSection.includes(summaryPath) || normalizedSection.includes(fileName);
  });
}

function containsReferencedSummaryPath(section: string, summaryPaths: string[]): boolean {
  return collectReferencedSummaryPaths(section, summaryPaths).length > 0;
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

function extractTaskSubsection(taskBlock: string, subsectionHeading: string): string {
  const escapedHeading = escapeRegex(subsectionHeading);
  const match = taskBlock.match(
    new RegExp(`(?:^|\\n)#### ${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n#### |\\n### |$)`)
  );

  return match?.[1]?.trim() ?? "";
}

function isBlankOrPlaceholderPlanLine(line: string): boolean {
  return (
    line.length === 0 ||
    /^(?:none|n\/a|na|tbd|todo|to do|placeholder|coming soon|replace me|fill in here|insert here)$/i.test(
      line
    ) ||
    /replace with/i.test(line)
  );
}

function isSubjectivePlanLine(line: string): boolean {
  return /(?:\blooks\b|\bfeels\b|\bsounds\b|\bseems\b|\bgood\b|\bbetter\b|\bnice\b|\bclean\b|\bclear\b|\brobust\b|\bstable\b|\bfast\b|\bsimple\b|\beasy\b|\beasier\b|\bseamless\b|\bhelpful\b|\buseful\b|\bintuitive\b|\bpolished\b|\bworking\b|\bworks\b)/i.test(
    line
  );
}

function isRepoRelativePlanPath(value: string): boolean {
  const normalized = value.trim().replace(/\\/g, "/");

  if (normalized.length === 0) {
    return false;
  }

  if (
    path.isAbsolute(normalized) ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.startsWith("//") ||
    normalized.startsWith("~")
  ) {
    return false;
  }

  const segments = normalized.split("/");

  if (segments[0] === ".") {
    segments.shift();
  }

  if (segments.length === 0) {
    return false;
  }

  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function isGlobPlanPath(value: string): boolean {
  return /[*?\[\]{}]/.test(value.trim().replace(/\\/g, "/"));
}

function isBlueprintCommandReference(value: string): boolean {
  return /^\/blu-[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value.trim());
}

function validatePlanPathList(entries: string[], label: string): string[] {
  const issues: string[] = [];

  for (const entry of entries) {
    const normalizedEntry = entry.trim();

    if (normalizedEntry.length === 0) {
      issues.push(`Plan frontmatter ${label} entries must not be blank.`);
      continue;
    }

    if (isGlobPlanPath(normalizedEntry)) {
      issues.push(
        `Plan frontmatter ${label} entry must be a concrete repo-relative path, not a glob pattern: ${entry}.`
      );
      continue;
    }

    if (!isRepoRelativePlanPath(normalizedEntry)) {
      issues.push(
        `Plan frontmatter ${label} entry must be a repo-relative path, not an absolute or traversing path: ${entry}.`
      );
    }
  }

  return issues;
}

function extractTaskPathReferenceCandidates(section: string): string[] {
  const candidates = new Set<string>();

  for (const line of section.replace(/\r\n/g, "\n").split("\n")) {
    const tokens = line.match(/`[^`]+`|[^\s]+/g) ?? [];

    for (const token of tokens) {
      const normalizedToken = token
        .trim()
        .replace(/^[`"'([<{]+/, "")
        .replace(/[)`"'\])>.,;:!?]+$/, "");

      if (normalizedToken.length === 0 || /^[a-z][a-z0-9+.-]*:\/\//i.test(normalizedToken)) {
        continue;
      }

      const normalizedPath = normalizedToken.replace(/\\/g, "/");

      if (isBlueprintCommandReference(normalizedPath)) {
        continue;
      }

      if (
        normalizedPath.includes("/") ||
        normalizedPath.startsWith(".") ||
        normalizedPath.startsWith("~") ||
        /^[A-Za-z]:/.test(normalizedPath) ||
        normalizedToken.includes("\\")
      ) {
        candidates.add(normalizedToken);
      }
    }
  }

  return [...candidates];
}

function validatePlanTaskPathList(section: string, label: string): string[] {
  const issues: string[] = [];

  for (const entry of extractTaskPathReferenceCandidates(section)) {
    if (isGlobPlanPath(entry)) {
      issues.push(
        `${label} entry must be a concrete repo-relative path, not a glob pattern: ${entry}.`
      );
      continue;
    }

    if (!isRepoRelativePlanPath(entry)) {
      issues.push(
        `${label} entry must be a repo-relative path, not an absolute or traversing path: ${entry}.`
      );
    }
  }

  return issues;
}

function hasConcretePlanSubsectionContent(section: string): boolean {
  const normalizedSection = stripPlanPlaceholderSignals(section);
  const meaningfulLines = normalizedSection
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.replace(/^(?:[-*+]\s+|\d+\.\s+)+/, "").trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^[#>*`|_\-\s]+$/.test(line));

  if (meaningfulLines.length === 0) {
    return false;
  }

  return meaningfulLines.some((line) => {
    if (isBlankOrPlaceholderPlanLine(line)) {
      return false;
    }

    if (
      /`[^`]+`/.test(line) ||
      /(?:^|[\s"'])\.?\.blueprint\/[^\s`'"()]+/.test(line) ||
      /(?:^|[\s"'])?(?:src|tests|docs|skills|agents|commands)\/[^\s`'"()]+/.test(line) ||
      /\/blu-[\w-]+(?:\b|$)/i.test(line) ||
      /^(?:npm|pnpm|yarn|node|git|bash|sh)\s+\S+/i.test(line)
    ) {
      return true;
    }

    if (isSubjectivePlanLine(line)) {
      return false;
    }

    const words = line.match(/[A-Za-z0-9][A-Za-z0-9'/-]*/g) ?? [];

    return words.length >= 3;
  });
}

function validateObjectivePlanBulletList(section: string, artifactLabel: string): string[] {
  const issues: string[] = [];
  const normalizedSection = stripPlanPlaceholderSignals(section);
  const bulletItems = normalizedSection
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^(?:[-*+]\s*|\d+\.\s*)+/, "").trim())
    .filter((line) => line.length > 0)
    .filter((line) => !isBlankOrPlaceholderPlanLine(line));

  if (bulletItems.length === 0) {
    issues.push(`${artifactLabel} must include at least one objective bullet.`);
    return issues;
  }

  const objectiveSignals = [
    /(?:\bgrep\b|\btest\b|\btests?\b|\bassert\b|\bexits?\s+0\b|\bpasses?\b|\bfails?\b|\bcontains?\b|\bmatches?\b|\breturns?\b|\bwrites?\b|\breads?\b|\bupdates?\b|\bcreates?\b|\brejects?\b|\bthrows?\b|\bproduces?\b|\bchecks?\b|\bruns?\b|\bverifies?\b)/i,
    /(?:^|[\s"'])\.?\.blueprint\/[^\s`'"()]+/,
    /(?:^|[\s"'])?(?:src|tests|docs|skills|agents|commands)\/[^\s`'"()]+/,
    /\/blu-[\w-]+(?:\b|$)/i,
    /`[^`]+`/
  ] as const;

  for (const bullet of bulletItems) {
    if (!objectiveSignals.some((signal) => signal.test(bullet))) {
      if (isSubjectivePlanLine(bullet)) {
        issues.push(
          `${artifactLabel} must use objectively checkable bullets instead of subjective language: ${bullet}.`
        );
        continue;
      }

      issues.push(
        `${artifactLabel} must use grep/test-verifiable or otherwise objectively checkable bullets: ${bullet}.`
      );
    }
  }

  return issues;
}

function validatePlanTaskBlock(taskBlock: string, taskNumber: number): string[] {
  const issues: string[] = [];
  const lines = taskBlock
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const heading = lines[0] ?? "";
  const headingText = heading.replace(/^###\s+/, "").trim();

  if (
    headingText.length === 0 ||
    /^Task\s+\d+(?::\s*)?$/i.test(headingText) ||
    /(?:replace with|todo|tbd|placeholder|coming soon|insert here|fill in here)/i.test(headingText)
  ) {
    issues.push(`Task ${taskNumber} must use a concrete heading.`);
  }

  for (const subsectionHeading of ["Read First", "Action", "Acceptance Criteria"]) {
    const subsection = extractTaskSubsection(taskBlock, subsectionHeading);

    if (!hasConcretePlanSubsectionContent(subsection)) {
      issues.push(`Task ${taskNumber} subsection ${subsectionHeading} must contain concrete content.`);
    }
  }

  for (const subsectionHeading of ["Read First", "Action"]) {
    const subsection = extractTaskSubsection(taskBlock, subsectionHeading);

    issues.push(
      ...validatePlanTaskPathList(
        subsection,
        `Task ${taskNumber} subsection ${subsectionHeading}`
      )
    );
  }

  const acceptanceCriteria = extractTaskSubsection(taskBlock, "Acceptance Criteria");
  issues.push(
    ...validateObjectivePlanBulletList(
      acceptanceCriteria,
      `Task ${taskNumber} subsection Acceptance Criteria`
    )
  );

  return issues;
}

function validateLockedMarkers(
  content: string,
  artifactLabel: string,
  markers: readonly string[]
): string[] {
  return markers
    .filter((marker) => !content.includes(marker))
    .map((marker) => `${artifactLabel} is missing locked marker: ${marker}.`);
}

type MilestoneEvidenceRowSpec = {
  label: string;
  pattern: RegExp;
};

function validateMilestoneEvidenceLedger(
  content: string,
  artifactLabel: string,
  sectionHeading: string,
  requiredRows: readonly MilestoneEvidenceRowSpec[]
): string[] {
  const issues: string[] = [];
  const section = extractMarkdownSection(content, sectionHeading);
  const evidenceRows = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => isMarkdownTableRow(line) && !isMarkdownTableHeaderRow(line));

  if (evidenceRows.length < requiredRows.length) {
    issues.push(
      `${artifactLabel} section ${sectionHeading} must include evidence rows for ${requiredRows
        .map((row) => row.label)
        .join(", ")}.`
    );
  }

  const rowLabels: string[] = [];

  for (const row of evidenceRows) {
    const cells = parseMarkdownTableCells(row);

    if (cells.length !== 4) {
      issues.push(
        `${artifactLabel} section ${sectionHeading} must keep each evidence row in the Dimension, Evidence, Status, and Notes columns.`
      );
      continue;
    }

    const [dimension, evidence, status, notes] = cells;
    rowLabels.push(dimension);

    if (!/^(PASS|GAP|BLOCKED)$/i.test(status)) {
      issues.push(
        `${artifactLabel} section ${sectionHeading} must use PASS, GAP, or BLOCKED for ${dimension}.`
      );
    }

    if (!evidence || !notes) {
      issues.push(
        `${artifactLabel} section ${sectionHeading} must keep evidence and notes populated for ${dimension}.`
      );
    }
  }

  for (const requiredRow of requiredRows) {
    if (!rowLabels.some((label) => requiredRow.pattern.test(label))) {
      issues.push(
        `${artifactLabel} section ${sectionHeading} is missing a ${requiredRow.label} row.`
      );
    }
  }

  return issues;
}

function validateMilestoneReportReferences(
  content: string,
  artifactLabel: string,
  sectionHeading: string,
  requiredMentions: readonly string[]
): string[] {
  const issues: string[] = [];
  const section = extractMarkdownSection(content, sectionHeading);

  if (!/^- /m.test(section)) {
    issues.push(
      `${artifactLabel} section ${sectionHeading} must include at least one bullet with saved report references.`
    );
  }

  for (const mention of requiredMentions) {
    if (!new RegExp(escapeRegex(mention), "i").test(section)) {
      issues.push(
        `${artifactLabel} section ${sectionHeading} must reference ${mention}.`
      );
    }
  }

  return issues;
}

function parseMarkdownTableCells(line: string): string[] {
  if (!/^\|.*\|$/.test(line)) {
    return [];
  }

  return line
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function isMarkdownTableRow(line: string): boolean {
  const cells = parseMarkdownTableCells(line);

  return cells.length > 0 && !cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isMarkdownTableHeaderRow(line: string): boolean {
  const cells = parseMarkdownTableCells(line).map((cell) => cell.toLowerCase());

  if (cells.length === 0) {
    return false;
  }

  const headerPatterns: Array<string[]> = [
    ["dimension", "evidence", "status", "notes"],
    ["requirement", "task or check", "evidence", "coverage state", "notes"],
    ["id", "description", "research support"],
    ["requirement", "task or check", "evidence", "coverage state"],
    ["gap id", "surface", "evidence", "repair"],
    ["item", "why manual or deferred", "follow-up", "status"],
    ["gap class", "scope", "evidence", "repair"]
  ];

  return headerPatterns.some(
    (pattern) =>
      pattern.length === cells.length && pattern.every((cell, index) => cells[index] === cell)
  );
}

function extractMarkdownTableDataRows(section: string): string[][] {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => isMarkdownTableRow(line) && !isMarkdownTableHeaderRow(line))
    .map((line) => parseMarkdownTableCells(line))
    .filter((cells) => cells.some((cell) => cell.length > 0));
}

function extractBlueprintCommands(section: string): string[] {
  return [...new Set(section.match(/\/blu-[a-z0-9]+(?:-[a-z0-9]+)*/gi) ?? [])];
}

function summarizeMarkdownTableRow(line: string): string {
  const cells = line
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());

  if (cells.length === 0) {
    return "";
  }

  if (cells.length >= 4) {
    const label = cells[0] ?? "";
    const evidence = cells[1] ?? "";
    const status = cells[2] ?? "";
    const note = cells[3] ?? "";
    const summary = [label, status].filter((value) => value.length > 0).join(": ");
    const withEvidence = evidence.length > 0 ? `${summary}${summary.length > 0 ? ": " : ""}${evidence}` : summary;

    return note.length > 0
      ? `${withEvidence}${withEvidence.length > 0 ? " - " : ""}${note}`
      : withEvidence;
  }

  if (cells.length === 3) {
    const summary = [cells[0] ?? "", cells[1] ?? ""].filter((value) => value.length > 0).join(": ");
    return cells[2]?.length > 0 ? `${summary}${summary.length > 0 ? " - " : ""}${cells[2]}` : summary;
  }

  if (cells.length === 2) {
    return [cells[0] ?? "", cells[1] ?? ""].filter((value) => value.length > 0).join(": ");
  }

  return cells[0] ?? "";
}

function scoreDigestSectionHeading(heading: string): number {
  const normalized = heading.trim().toLowerCase();
  const highPriorityPatterns = [
    /(?:^|\b)verdict(?:\b|$)/i,
    /(?:^|\b)decision(?:\b|$)/i,
    /(?:^|\b)evidence(?:\b|$)/i,
    /next safe action/i,
    /source reports used/i,
    /recommended carry-forward context/i,
    /milestone evidence dimensions/i,
    /roadmap and phase evidence/i,
    /audit report used/i
  ];
  const mediumPriorityPatterns = [
    /(?:^|\b)rationale(?:\b|$)/i,
    /(?:^|\b)summary(?:\b|$)/i,
    /(?:^|\b)carry-forward(?:\b|$)/i,
    /(?:^|\b)follow[- ]ups?(?:\b|$)/i,
    /(?:^|\b)blockers?(?:\b|$)/i,
    /(?:^|\b)gaps?(?:\b|$)/i,
    /(?:^|\b)outcomes?(?:\b|$)/i,
    /(?:^|\b)watch items?(?:\b|$)/i,
    /(?:^|\b)completion(?:\b|$)/i,
    /(?:^|\b)intent(?:\b|$)/i
  ];

  if (highPriorityPatterns.some((pattern) => pattern.test(normalized))) {
    return 2;
  }

  if (mediumPriorityPatterns.some((pattern) => pattern.test(normalized))) {
    return 1;
  }

  return 0;
}

function summarizeMarkdownSectionBody(section: string): string {
  const lines = section
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("## "));

  if (lines.length === 0) {
    return "";
  }

  const verdictLine = lines.find((line) => /^[-*+]\s+Verdict:/i.test(line) || /^Verdict:/i.test(line));

  if (verdictLine) {
    return verdictLine.replace(/^[-*+]\s*/, "").trim();
  }

  const tableRows = lines.filter(
    (line) => isMarkdownTableRow(line) && !isMarkdownTableHeaderRow(line)
  );

  if (tableRows.length > 0) {
    return tableRows
      .slice(0, 4)
      .map((line) => summarizeMarkdownTableRow(line))
      .filter((line) => line.length > 0)
      .join("; ");
  }

  const bullets = lines
    .filter((line) => /^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^(?:[-*+]\s*|\d+\.\s*)+/, "").trim())
    .filter((line) => line.length > 0);

  if (bullets.length > 0) {
    return bullets.slice(0, 2).join("; ");
  }

  return lines[0] ?? "";
}

function splitMarkdownSections(lines: string[]): Array<{ heading: string; body: string[] }> {
  const sections: Array<{ heading: string; body: string[] }> = [];
  let current: { heading: string; body: string[] } | null = null;

  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      if (current) {
        sections.push(current);
      }

      current = {
        heading: line.replace(/^##\s+/, "").trim(),
        body: []
      };
      continue;
    }

    if (!current) {
      continue;
    }

    current.body.push(line);
  }

  if (current) {
    sections.push(current);
  }

  return sections;
}

function summarizePreambleLines(lines: string[]): string[] {
  const synopsis: string[] = [];

  for (const line of lines) {
    if (line.startsWith("**") && /:\s*/.test(line)) {
      synopsis.push(line.replace(/^\*\*(.+?)\*\*:\s*/, "$1: ").trim());
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      synopsis.push(line.replace(/^[-*+]\s+/, "").trim());
    }
  }

  if (synopsis.length > 0) {
    return synopsis;
  }

  return lines
    .map((line) => line.replace(/^(?:[-*+]\s*|\d+\.\s*)+/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 2);
}

const VALIDATION_SCAFFOLD_PLACEHOLDER_PATTERNS: Array<{
  pattern: RegExp;
  signal: string;
}> = [
  { pattern: /\bPhase XX\b/i, signal: "Phase XX" },
  { pattern: /<Phase Name>/i, signal: "<Phase Name>" },
  { pattern: /<phase-dir>/i, signal: "<phase-dir>" },
  {
    pattern: /\b(?:XX|\d{2}(?:\.\d+)?)\-YY-SUMMARY\.md\b/i,
    signal: "XX-YY-SUMMARY.md"
  },
  { pattern: /\bXX-VERIFICATION\.md\b/i, signal: "XX-VERIFICATION.md" },
  { pattern: /\bXX-UAT\.md\b/i, signal: "XX-UAT.md" },
  { pattern: /<requirement-id>/i, signal: "<requirement-id>" },
  { pattern: /<task or check>/i, signal: "<task or check>" },
  {
    pattern: /<summary path, command, or saved evidence>/i,
    signal: "<summary path, command, or saved evidence>"
  },
  { pattern: /<coverage note>/i, signal: "<coverage note>" },
  { pattern: /<manual-only item>/i, signal: "<manual-only item>" },
  { pattern: /<coverage gap class>/i, signal: "<coverage gap class>" },
  { pattern: /<scope>/i, signal: "<scope>" },
  { pattern: /<evidence>/i, signal: "<evidence>" },
  { pattern: /<repair>/i, signal: "<repair>" },
  { pattern: /<name or pending>/i, signal: "<name or pending>" },
  { pattern: /<ready for UAT or not ready>/i, signal: "<ready for UAT or not ready>" },
  { pattern: /\bPASS\|PARTIAL\|BLOCKED\b/i, signal: "PASS|PARTIAL|BLOCKED" },
  { pattern: /\bPASS\|MANUAL\|DEFERRED\|BLOCKED\b/i, signal: "PASS|MANUAL|DEFERRED|BLOCKED" },
  { pattern: /\bMANUAL\|DEFERRED\|NONE\b/i, signal: "MANUAL|DEFERRED|NONE" },
  {
    pattern: /Concise readiness result grounded in the saved summaries\./i,
    signal: "Concise readiness result grounded in the saved summaries."
  },
  {
    pattern: /Concise user-facing result grounded in the saved summaries and verification artifact\./i,
    signal: "Concise user-facing result grounded in the saved summaries and verification artifact."
  },
  { pattern: /\bPASS\|FAIL\|PARTIAL\b/i, signal: "PASS|FAIL|PARTIAL" }
];

function validateValidationScaffoldPlaceholders(
  content: string,
  artifactLabel: string
): string[] {
  return VALIDATION_SCAFFOLD_PLACEHOLDER_PATTERNS.filter(({ pattern }) => pattern.test(content)).map(
    ({ pattern, signal }) => {
      const matchedPlaceholder = content.match(pattern)?.[0] ?? signal;
      return `${artifactLabel} still contains placeholder scaffold text: ${matchedPlaceholder}.`;
    }
  );
}

function validateContractBackedMarkdown(
  content: string,
  contractId: ArtifactContractId,
  artifactLabel: string
): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  const contract = readArtifactContract(contractId);
  const issues: string[] = [];

  if (!/^# .+\S(?:\r?\n|$)/.test(content)) {
    issues.push(`${artifactLabel} must start with a markdown H1 title.`);
  }

  issues.push(
    ...validateLockedMarkers(content, artifactLabel, contract.lockedMarkers),
    ...validateRequiredMarkdownSections(content, artifactLabel, contract.requiredHeadings)
  );

  issues.push(
    ...contract.placeholderSignals
      .filter((signal) => signal.length > 0 && content.includes(signal))
      .map((signal) => `${artifactLabel} still contains placeholder scaffold text: ${signal}.`)
  );

  return {
    valid: issues.length === 0,
    issues,
    warnings: []
  };
}

function resolveCodebaseArtifactPathContractId(
  artifact: (typeof CODEBASE_ARTIFACTS)[number]
): ArtifactContractId {
  switch (artifact) {
    case ".blueprint/codebase/STACK.md":
      return resolveCodebaseArtifactContractId("stack");
    case ".blueprint/codebase/ARCHITECTURE.md":
      return resolveCodebaseArtifactContractId("architecture");
    case ".blueprint/codebase/STRUCTURE.md":
      return resolveCodebaseArtifactContractId("structure");
    case ".blueprint/codebase/CONVENTIONS.md":
      return resolveCodebaseArtifactContractId("conventions");
    case ".blueprint/codebase/TESTING.md":
      return resolveCodebaseArtifactContractId("testing");
    case ".blueprint/codebase/INTEGRATIONS.md":
      return resolveCodebaseArtifactContractId("integrations");
    case ".blueprint/codebase/CONCERNS.md":
      return resolveCodebaseArtifactContractId("concerns");
  }
}

function resolveCodebaseArtifactPath(
  artifactId: CodebaseArtifactContractId
): (typeof CODEBASE_ARTIFACTS)[number] {
  switch (artifactId) {
    case "codebase.stack":
      return ".blueprint/codebase/STACK.md";
    case "codebase.architecture":
      return ".blueprint/codebase/ARCHITECTURE.md";
    case "codebase.structure":
      return ".blueprint/codebase/STRUCTURE.md";
    case "codebase.conventions":
      return ".blueprint/codebase/CONVENTIONS.md";
    case "codebase.testing":
      return ".blueprint/codebase/TESTING.md";
    case "codebase.integrations":
      return ".blueprint/codebase/INTEGRATIONS.md";
    case "codebase.concerns":
      return ".blueprint/codebase/CONCERNS.md";
  }
}

function validateCodebaseArtifactContent(content: string, artifactId: ArtifactContractId): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  const contract = readArtifactContract(artifactId);
  const issues: string[] = [];
  const warnings: string[] = [];
  const requiredSectionIssues = validateRequiredMarkdownSections(
    content,
    `${contract.canonicalName} artifact`,
    contract.requiredHeadings
  );
  const populatedRequiredSections = contract.requiredHeadings.filter(
    (heading) => extractMarkdownSection(content, heading).trim().length > 0
  );
  const normalizedLines = content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim());
  const meaningfulLines = normalizedLines.filter(
    (line) =>
      line.length > 0 &&
      !line.startsWith("#") &&
      !line.startsWith("*Generated by") &&
      !/^[-*]\s*$/.test(line)
  );
  const hasLegacySummary = countMeaningfulWords(meaningfulLines.join(" ")) >= 1;

  if (!/^# .+\S\s*$/m.test(content)) {
    issues.push(`${contract.canonicalName} artifact must start with a markdown H1 title.`);
  }

  issues.push(
    ...contract.placeholderSignals
      .filter((signal) => signal.length > 0 && content.includes(signal))
      .map(
        (signal) =>
          `${contract.canonicalName} artifact still contains placeholder scaffold text: ${signal}.`
      )
  );

  if (requiredSectionIssues.length > 0) {
    if (populatedRequiredSections.length === 0 && hasLegacySummary) {
      warnings.push(
        `${contract.canonicalName} artifact uses a legacy concise format without the canonical section headings.`
      );
    } else {
      issues.push(...requiredSectionIssues);
    }
  }

  if (populatedRequiredSections.length === 0 && !hasLegacySummary) {
    issues.push(
      `${contract.canonicalName} artifact must include either substantive mapped prose or at least one populated contract section: ${contract.requiredHeadings.join(", ")}.`
    );
  }

  for (const heading of contract.requiredHeadings) {
    const section = extractMarkdownSection(content, heading);

    if (section.trim().length === 0) {
      continue;
    }

    if (!hasBootstrapText(section, 2)) {
      issues.push(
        `${contract.canonicalName} artifact section ${heading} must contain substantive repo evidence instead of scaffold placeholders.`
      );
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}

function hasNonEmptyBulletedList(section: string): boolean {
  return section
    .split("\n")
    .map((line) => line.trim())
    .some((line) => /^[-*]\s+\S/.test(line));
}

function countMeaningfulWords(value: string): number {
  return value.match(/[A-Za-z0-9][A-Za-z0-9'/-]*/g)?.length ?? 0;
}

function hasBootstrapText(section: string, minimumWords = 3): boolean {
  return countMeaningfulWords(
    section
      .replace(/\r\n/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/^(?:[-*]\s*)+/gm, "")
  ) >= minimumWords;
}

type BootstrapValidationOptions = {
  allowLegacyShell?: boolean;
};

function isBootstrapProjectArtifact(content: string): boolean {
  return (
    extractMarkdownSection(content, "Bootstrap Shape").trim().length > 0 ||
    extractMarkdownSection(content, "Scope Posture").trim().length > 0
  );
}

function isBootstrapRequirementsArtifact(content: string): boolean {
  return (
    extractMarkdownSection(content, "Scope Summary").trim().length > 0 ||
    extractMarkdownSection(content, "Traceability Notes").trim().length > 0 ||
    extractMarkdownSection(content, "Committed V1 Scope").trim().length > 0 ||
    extractMarkdownSection(content, "Deferred Scope").trim().length > 0 ||
    extractMarkdownSection(content, "Out-of-Scope Cuts").trim().length > 0
  );
}

function isBootstrapRoadmapArtifact(content: string): boolean {
  return (
    extractMarkdownSection(content, "Bootstrap Status").trim().length > 0 ||
    extractMarkdownSection(content, "Requirement Coverage").trim().length > 0
  );
}

function validateBootstrapProjectArtifact(
  content: string,
  options: BootstrapValidationOptions = {}
): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!/^# .+\S\s*$/m.test(content)) {
    issues.push("Project artifact must start with a markdown H1 title.");
  }

  const vision = extractMarkdownSection(content, "Vision");
  const audience = extractMarkdownSection(content, "Audience");
  const constraints = extractMarkdownSection(content, "Constraints");
  const currentMilestone = extractMarkdownSection(content, "Current Milestone");
  const bootstrapShape = extractMarkdownSection(content, "Bootstrap Shape");
  const scopePosture = extractMarkdownSection(content, "Scope Posture");
  const nonGoals = extractMarkdownSection(content, "Non-Goals");
  const assumptions = extractMarkdownSection(content, "Assumptions");

  if (isBootstrapProjectArtifact(content)) {
    issues.push(
      ...validateRequiredMarkdownSections(
        content,
        "Project artifact",
        BOOTSTRAP_PROJECT_CONTRACT.requiredHeadings
      )
    );

    if (!hasBootstrapText(vision)) {
      issues.push("Project artifact section Vision must contain substantive project direction.");
    }

    if (!/- Primary:\s*\S+/m.test(audience) || !/- Secondary:\s*\S+/m.test(audience)) {
      issues.push(
        "Project artifact section Audience must include primary and secondary audience bullets."
      );
    }

    if (!hasNonEmptyBulletedList(constraints)) {
      issues.push("Project artifact section Constraints must include at least one constraint bullet.");
    }

    if (!hasBootstrapText(currentMilestone, 1)) {
      issues.push("Project artifact section Current Milestone must name the active bootstrap milestone.");
    }

    if (
      !/Repository shape:\s*(?:greenfield|scaffold-only|brownfield)/i.test(bootstrapShape) ||
      !/Codebase mapping:\s*(?:ready|pending)/i.test(bootstrapShape) ||
      !/Bootstrap posture:\s*\S+/i.test(bootstrapShape)
    ) {
      issues.push(
        "Project artifact section Bootstrap Shape must summarize repository shape, mapping state, and bootstrap posture."
      );
    }

    if (
      !/Committed v1:\s*\S+/i.test(scopePosture) ||
      !/Deferred:\s*\S+/i.test(scopePosture) ||
      !/Out-of-scope:\s*\S+/i.test(scopePosture)
    ) {
      issues.push(
        "Project artifact section Scope Posture must describe committed v1, deferred, and out-of-scope scope."
      );
    }

    if (!hasNonEmptyBulletedList(nonGoals)) {
      issues.push("Project artifact section Non-Goals must include at least one non-goal bullet.");
    }

    if (!hasNonEmptyBulletedList(assumptions)) {
      issues.push("Project artifact section Assumptions must include at least one assumption bullet.");
    }
  } else if (options.allowLegacyShell) {
    if (!/^# .+\S\s*$/m.test(content)) {
      issues.push("Project artifact must start with a markdown H1 title.");
    }
  } else {
    if (!hasBootstrapText(vision, 1)) {
      issues.push("Project artifact section Vision must contain substantive project direction.");
    }

    if (!hasBootstrapText(content, 3)) {
      issues.push("Project artifact must include substantive bootstrap guidance.");
    }
  }

  if (isBootstrapProjectArtifact(content) && extractRequirementIdsFromMarkdown(content).length === 0) {
    issues.push("Project artifact must surface at least one bootstrap requirement identifier.");
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}

function validateBootstrapRequirementsArtifact(
  content: string,
  options: BootstrapValidationOptions = {}
): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];
  const requirementsTable = extractMarkdownSection(content, "Requirements Table");
  const scopeSummary = extractMarkdownSection(content, "Scope Summary");
  const committedScope = extractMarkdownSection(content, "Committed V1 Scope");
  const deferredScope = extractMarkdownSection(content, "Deferred Scope");
  const outOfScope = extractMarkdownSection(content, "Out-of-Scope Cuts");
  const traceabilityNotes = extractMarkdownSection(content, "Traceability Notes");
  const openQuestions = extractMarkdownSection(content, "Open Questions");
  const requirementIds = extractRequirementIds(requirementsTable);
  const scopeSummaryIds = new Map<string, string[]>();
  const groupedScopeIds = new Map<string, string[]>();
  const isBootstrapShape = isBootstrapRequirementsArtifact(content);

  if (isBootstrapShape) {
    if (!/^# Requirements:\s*.+\S\s*$/m.test(content)) {
      issues.push("Requirements artifact must start with a '# Requirements: ...' heading.");
    }

    const requiredHeadings = [
      "Requirements Table",
      "Scope Summary",
      "Committed V1 Scope",
      "Traceability Notes",
      "Open Questions"
    ] as const;

    for (const heading of requiredHeadings) {
      if (extractMarkdownSection(content, heading).trim().length === 0) {
        issues.push(`Requirements artifact is missing required section: ${heading}.`);
      }
    }

    if (!hasRequirementTableRows(requirementsTable)) {
      issues.push(
        "Requirements artifact section Requirements Table must include at least one populated requirement row."
      );
    }

    if (requirementIds.length === 0) {
      issues.push("Requirements artifact must surface at least one durable requirement identifier.");
    }
  } else if (options.allowLegacyShell) {
    if (!/^# Requirements(?:\s*:\s*.+\S)?\s*$/m.test(content)) {
      issues.push("Requirements artifact must start with a '# Requirements' heading.");
    }
  } else {
    if (!/^# Requirements(?:\s*:\s*.+\S)?\s*$/m.test(content)) {
      issues.push("Requirements artifact must start with a '# Requirements' heading.");
    }

    if (!hasRequirementTableRows(requirementsTable)) {
      issues.push(
        "Requirements artifact section Requirements Table must include at least one populated requirement row."
      );
    }

    if (requirementIds.length === 0) {
      issues.push("Requirements artifact must surface at least one durable requirement identifier.");
    }
  }

  const scopeSummaryEntries = [
    {
      summaryLabel: "Committed v1",
      heading: "Committed V1 Scope",
      section: committedScope,
      required: true
    },
    {
      summaryLabel: "Deferred",
      heading: "Deferred Scope",
      section: deferredScope,
      required: false
    },
    {
      summaryLabel: "Out-of-scope",
      heading: "Out-of-Scope Cuts",
      section: outOfScope,
      required: false
    }
  ] as const;

  for (const { summaryLabel, heading, section, required } of scopeSummaryEntries) {
    const scopeMatch = scopeSummary.match(
      new RegExp(`^-\\s*${summaryLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*(.+)$`, "im")
    );
    const summaryValue = scopeMatch?.[1]?.trim() ?? "";
    const hasScopeEntries = summaryValue.length > 0 && !/^none$/i.test(summaryValue);
    const summaryRequirementIds = hasScopeEntries ? extractRequirementIdsFromMarkdown(summaryValue) : [];
    const groupedRequirementIds = extractBootstrapRequirementListIds(section);

    scopeSummaryIds.set(heading, summaryRequirementIds);
    groupedScopeIds.set(heading, groupedRequirementIds);

    if (required && !hasScopeEntries && isBootstrapShape) {
      issues.push(
        "Requirements artifact section Scope Summary must list committed v1 requirement IDs."
      );
    }

    if (!isBootstrapShape || !hasScopeEntries) {
      continue;
    }

    if (section.trim().length === 0) {
      issues.push(
        `Requirements artifact section ${heading} must include grouped requirement entries with durable IDs.`
      );
      continue;
    }

    if (!/###\s+\S+/m.test(section) || !/^- `[^`]+`:\s*\S+/m.test(section)) {
      issues.push(
        `Requirements artifact section ${heading} must include grouped requirement entries with durable IDs.`
      );
    }
  }

  if (isBootstrapShape && requirementIds.length > 0) {
    const summaryRequirementIds = [...scopeSummaryIds.values()].flat();

    if (requirementIds.length !== summaryRequirementIds.length) {
      issues.push(
        "Requirements artifact section Scope Summary must list the same requirement IDs as Requirements Table."
      );
    } else {
      const tableRequirementIdSet = new Set(requirementIds);
      const summaryRequirementIdSet = new Set(summaryRequirementIds);

      if (
        requirementIds.some((requirementId) => !summaryRequirementIdSet.has(requirementId)) ||
        summaryRequirementIds.some((requirementId) => !tableRequirementIdSet.has(requirementId))
      ) {
        issues.push(
          "Requirements artifact section Scope Summary must list the same requirement IDs as Requirements Table."
        );
      }
    }

    for (const { heading } of scopeSummaryEntries) {
      const summaryRequirementIds = scopeSummaryIds.get(heading) ?? [];
      const groupedRequirementIds = groupedScopeIds.get(heading) ?? [];

      if (summaryRequirementIds.length !== groupedRequirementIds.length) {
        issues.push(
          `Requirements artifact section ${heading} must list the same requirement IDs as Scope Summary.`
        );
        continue;
      }

      const summaryRequirementIdSet = new Set(summaryRequirementIds);
      const groupedRequirementIdSet = new Set(groupedRequirementIds);

      if (
        summaryRequirementIds.some((requirementId) => !groupedRequirementIdSet.has(requirementId)) ||
        groupedRequirementIds.some((requirementId) => !summaryRequirementIdSet.has(requirementId))
      ) {
        issues.push(
          `Requirements artifact section ${heading} must list the same requirement IDs as Scope Summary.`
        );
      }
    }
  }

  if (isBootstrapShape && !/\.blueprint\/ROADMAP\.md/i.test(traceabilityNotes)) {
    issues.push("Requirements artifact section Traceability Notes must reference .blueprint/ROADMAP.md.");
  }

  if (isBootstrapShape && !hasNonEmptyBulletedList(openQuestions)) {
    issues.push("Requirements artifact section Open Questions must include at least one open question bullet.");
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}

function extractBootstrapRoadmapPhaseBlocks(content: string): string[] {
  const phasesSection = extractMarkdownSection(content, "Phases");

  return phasesSection
    .split(/\n(?=- \[(?: |x)\] Phase )/g)
    .map((block) => block.trim())
    .filter((block) => block.startsWith("- ["));
}

function validateBootstrapRoadmapArtifact(
  content: string,
  options: BootstrapValidationOptions = {}
): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (isBootstrapRoadmapArtifact(content)) {
    if (!/^# Roadmap:\s*.+\S\s*$/m.test(content)) {
      issues.push("Roadmap artifact must start with a '# Roadmap: ...' heading.");
    }
  } else if (!/^# Roadmap(?:\s*:\s*.+\S)?\s*$/m.test(content)) {
    issues.push("Roadmap artifact must start with a '# Roadmap' heading.");
  }

  const milestone = extractMarkdownSection(content, "Milestone");
  const bootstrapStatus = extractMarkdownSection(content, "Bootstrap Status");
  const requirementCoverage = extractMarkdownSection(content, "Requirement Coverage");
  const notes = extractMarkdownSection(content, "Notes");
  const phaseBlocks = extractBootstrapRoadmapPhaseBlocks(content);
  const coverageIds = extractBootstrapScopedRequirementIds(requirementCoverage);
  const phaseRequirementRefs = phaseBlocks.flatMap((phaseBlock) =>
    extractBootstrapRoadmapPhaseRequirementIds(phaseBlock)
  );
  const duplicatePhaseRequirementRefs = valuesWithDuplicates(phaseRequirementRefs);

  if (isBootstrapRoadmapArtifact(content)) {
    if (!hasBootstrapText(milestone)) {
      issues.push("Roadmap artifact section Milestone must name the active bootstrap milestone.");
    }

    if (
      !/Repository shape:\s*(?:greenfield|scaffold-only|brownfield)/i.test(bootstrapStatus) ||
      !/Codebase mapping:\s*(?:ready|pending)/i.test(bootstrapStatus) ||
      !/Roadmap confidence:\s*\S+/i.test(bootstrapStatus)
    ) {
      issues.push(
        "Roadmap artifact section Bootstrap Status must capture repository shape, mapping state, and roadmap confidence."
      );
    }

    if (!hasNonEmptyBulletedList(requirementCoverage) || coverageIds.length === 0) {
      issues.push(
        "Roadmap artifact section Requirement Coverage must include at least one requirement identifier."
      );
    }

    if (phaseBlocks.length === 0) {
      issues.push("Roadmap artifact section Phases must include at least one concrete phase entry.");
    }

    if (duplicatePhaseRequirementRefs.length > 0) {
      issues.push(
        `Roadmap artifact phase entries must not reference a requirement ID more than once: ${duplicatePhaseRequirementRefs.join(", ")}.`
      );
    }

    for (const phaseBlock of phaseBlocks) {
      if (!/^- \[(?: |x)\] Phase \d+(?:\.\d+)?:\s+\S+/m.test(phaseBlock)) {
        issues.push("Roadmap artifact phase entries must include a numbered phase title.");
      }

      if (!/Objective:\s*\S+/m.test(phaseBlock)) {
        issues.push("Roadmap artifact phase entries must include an objective.");
      }

      const phaseRequirementIds = extractBootstrapRoadmapPhaseRequirementIds(phaseBlock);
      const successCriteria = extractBootstrapRoadmapPhaseSuccessCriteria(phaseBlock);

      if (phaseRequirementIds.length === 0) {
        issues.push(
          "Roadmap artifact phase entries must include at least one requirement identifier in a Requirements clause."
        );
      } else if (phaseRequirementIds.some((requirementId) => !coverageIds.includes(requirementId))) {
        issues.push(
          "Roadmap artifact phase entries may only reference requirement IDs listed in Requirement Coverage."
        );
      }

      if (successCriteria.length === 0) {
        issues.push("Roadmap artifact phase entries must include at least one success criteria bullet.");
      }
    }

    if (!hasNonEmptyBulletedList(notes)) {
      issues.push("Roadmap artifact section Notes must include at least one bootstrap note.");
    }
  } else if (options.allowLegacyShell) {
    if (!/^# Roadmap(?:\s*:\s*.+\S)?\s*$/m.test(content)) {
      issues.push("Roadmap artifact must start with a '# Roadmap' heading.");
    }
  } else {
    if (!hasNonEmptyBulletedList(extractMarkdownSection(content, "Phases"))) {
      issues.push("Roadmap artifact section Phases must include at least one concrete phase entry.");
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}

function countNonEmptyContractSections(
  content: string,
  headings: readonly string[]
): number {
  return headings.reduce(
    (count, heading) => count + (extractMarkdownSection(content, heading).trim().length > 0 ? 1 : 0),
    0
  );
}

function hasSubstantiveContractSection(section: string): boolean {
  return hasBootstrapText(section, 3);
}

function hasRequirementTableRows(section: string): boolean {
  const lines = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\|.*\|$/.test(line));

  return lines.some((line, index) => {
    const cells = line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());

    if (cells.length < 3) {
      return false;
    }

    const isSeparator = cells.every((cell) => /^:?-{3,}:?$/.test(cell));
    const nextLine = lines[index + 1] ?? "";
    const nextCells = nextLine
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    const isHeader = nextCells.length >= 3 && nextCells.every((cell) => /^:?-{3,}:?$/.test(cell));

    return !isHeader && !isSeparator && cells.some((cell) => cell.length > 0);
  });
}

function hasCoverageTableRows(section: string): boolean {
  return section
    .split("\n")
    .map((line) => line.trim())
    .some((line) => {
      if (!/^\|.*\|$/.test(line)) {
        return false;
      }

      const cells = line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim());

      if (cells.length < 4) {
        return false;
      }

      const isHeader =
        /^requirement$/i.test(cells[0] ?? "") &&
        /^task or check$/i.test(cells[1] ?? "") &&
        /^evidence$/i.test(cells[2] ?? "") &&
        /^coverage state$/i.test(cells[3] ?? "");
      const isSeparator = cells.every((cell) => /^:?-{3,}:?$/.test(cell));

      return !isHeader && !isSeparator && cells.some((cell) => cell.length > 0);
    });
}

function isExplicitUiSkipRationale(content: string): boolean {
  const outcomeMode = extractMarkdownSection(content, "Outcome Mode");

  return /(?:^|\n)\s*(?:[-*]\s+|\d+\.\s+)?(?:explicit\s+)?skip rationale\b/im.test(
    outcomeMode
  );
}

const UNSUPPORTED_DISCUSS_MODE_CLAIM_PATTERNS: Array<{
  mode: string;
  pattern: RegExp;
}> = [
  { mode: "power mode", pattern: /\bpower[\s-]?mode\b/i },
  { mode: "chain mode", pattern: /\bchain[\s-]?mode\b/i },
  { mode: "auto mode", pattern: /\bauto[\s-]?mode\b/i },
  { mode: "batch mode", pattern: /\bbatch[\s-]?mode\b/i },
  { mode: "auto-advance", pattern: /\bauto[\s-]?advance(?:ment|s|d)?\b/i }
];

const UNSUPPORTED_MODE_POSITIVE_CLAIM_PATTERN =
  /\b(?:supports?|supported|implements?|implemented|ships?|shipped|available|enabled|routable|provides?|offers?|runs?)\b/i;

const UNSUPPORTED_MODE_NEGATION_PATTERN =
  /\b(?:do not|must not|should not|cannot|can't|does not|doesn't|is not|isn't|are not|aren't|not|no|without|defer|deferred|unsupported|unavailable|unimplemented)\b/i;

function validateUnsupportedDiscussModeClaims(content: string, artifactLabel: string): string[] {
  const issues: string[] = [];
  const flaggedModes = new Set<string>();

  for (const line of content.replace(/\r\n/g, "\n").split("\n")) {
    if (UNSUPPORTED_MODE_NEGATION_PATTERN.test(line)) {
      continue;
    }

    if (!UNSUPPORTED_MODE_POSITIVE_CLAIM_PATTERN.test(line)) {
      continue;
    }

    for (const { mode, pattern } of UNSUPPORTED_DISCUSS_MODE_CLAIM_PATTERNS) {
      if (pattern.test(line) && !flaggedModes.has(mode)) {
        issues.push(
          `${artifactLabel} claims unsupported discuss-phase behavior is shipped or available: ${mode}.`
        );
        flaggedModes.add(mode);
      }
    }
  }

  return issues;
}

function markdownSectionLines(section: string): string[] {
  return section
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/^(?:[-*+]\s*|\d+\.\s*)+/, "").trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^[#>*`|_\-\s]+$/.test(line));
}

function hasConcreteCanonicalReference(section: string): boolean {
  return markdownSectionLines(section)
    .filter(
      (line) =>
        !/^(?:none|n\/a|na|not applicable|no canonical references?|no saved references?)\b/i.test(
          line
        )
    )
    .some((line) =>
      /https?:\/\/\S+|(?:^|[\s`])(?:\.blueprint|src|tests|docs|commands|skills|agents|hooks|scripts|dist)\/[^\s`,)]+|\b(?:ROADMAP|STATE|PROJECT|REQUIREMENTS|MEMORY|AGENTS|README|CHANGELOG)\.md\b|\b(?:roadmap|requirements?|project brief|state|saved phase artifacts?|phase artifacts?|context artifact|discussion log)\b|\b[\w.-]+\.(?:ts|tsx|js|mjs|json|toml|md|yaml|yml)\b/i.test(
        line
      )
    );
}

function hasDeferredIdeaSignal(section: string): boolean {
  return /\b(?:deferred ideas?|later follow-?ups?|future follow-?ups?|follow-?up ideas?|scope creep|revisit|after this phase|next phase|backlog|parking lot)\b/i.test(
    section
  );
}

function hasConcreteDeferredIdeas(section: string): boolean {
  return markdownSectionLines(section)
    .filter(
      (line) =>
        !/^(?:none|n\/a|na|not applicable|no\b.*(?:deferred|follow-?up|ideas?)|nothing deferred)\b/i.test(
          line
        )
    )
    .some((line) => countMeaningfulWords(line) >= 3);
}

function validateDiscussPhaseContextAntiPatterns(content: string): {
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];
  const canonicalReferences = extractMarkdownSection(content, "Canonical References");
  const deferredIdeas = extractMarkdownSection(content, "Deferred Ideas");
  const deferredSourceSections = [
    "Discovery Grounding",
    "Implementation Decisions",
    "Specific Ideas",
    "Existing Code Insights",
    "Dependencies",
    "Open Questions"
  ]
    .map((heading) => extractMarkdownSection(content, heading))
    .join("\n");

  issues.push(...validateUnsupportedDiscussModeClaims(content, "Context artifact"));

  if (!hasConcreteCanonicalReference(canonicalReferences)) {
    issues.push(
      "Context artifact section Canonical References must include at least one named source, saved artifact, repo path, or URL."
    );
  }

  if (hasDeferredIdeaSignal(deferredSourceSections) && !hasConcreteDeferredIdeas(deferredIdeas)) {
    issues.push(
      "Context artifact mentions deferred or later follow-up ideas but does not preserve them in the Deferred Ideas section."
    );
  }

  if (/\b(?:plan inventory|existing plans?|saved plans?|current plans?)\b/i.test(content) && !/\/blu-plan-phase\b/i.test(content)) {
    warnings.push(
      "Context artifact mentions existing plan inventory but does not preserve the /blu-plan-phase refresh warning."
    );
  }

  return { issues, warnings };
}

function validateDiscussPhaseDiscussionLogAntiPatterns(content: string): {
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];
  const followUps = extractMarkdownSection(content, "Follow-Ups");
  const discussionSections = ["Summary", "Notes"]
    .map((heading) => extractMarkdownSection(content, heading))
    .join("\n");

  issues.push(...validateUnsupportedDiscussModeClaims(content, "Discussion log artifact"));

  if (hasDeferredIdeaSignal(discussionSections) && !hasConcreteDeferredIdeas(followUps)) {
    issues.push(
      "Discussion log artifact mentions deferred or later follow-up ideas but does not preserve them in the Follow-Ups section."
    );
  }

  if (/\b(?:plan inventory|existing plans?|saved plans?|current plans?)\b/i.test(content) && !/\/blu-plan-phase\b/i.test(content)) {
    warnings.push(
      "Discussion log artifact mentions existing plan inventory but does not preserve the /blu-plan-phase refresh warning."
    );
  }

  return { issues, warnings };
}

export function validatePhaseArtifactContent(
  content: string,
  artifact: "context" | "discussion-log" | "research" | "ui-spec"
): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  if (artifact === "research") {
    return validateResearchArtifactContent(content);
  }

  const contractId = resolvePhaseArtifactContractId(artifact);
  const contract = readArtifactContract(contractId);
  const artifactLabel =
    artifact === "context"
      ? "Context artifact"
      : artifact === "discussion-log"
        ? "Discussion log artifact"
        : "UI spec artifact";
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!/^\uFEFF?# .+\S[ \t]*(?:\r?\n|$)/.test(content)) {
    issues.push(`${artifactLabel} must start with a markdown H1 title.`);
  }

  issues.push(
    ...contract.placeholderSignals
      .filter((signal) => signal.length > 0 && content.includes(signal))
      .map((signal) => `${artifactLabel} still contains placeholder scaffold text: ${signal}.`)
  );

  const presentRequiredSections = countNonEmptyContractSections(content, contract.requiredHeadings);
  const missingRequiredSections = contract.requiredHeadings.filter(
    (heading) => extractMarkdownSection(content, heading).trim().length === 0
  );

  if (artifact === "ui-spec" && isExplicitUiSkipRationale(content)) {
    if (extractMarkdownSection(content, "Outcome Mode").trim().length === 0) {
      issues.push("UI spec artifact section Outcome Mode must not be empty.");
    }
    if (extractMarkdownSection(content, "Rationale").trim().length === 0) {
      issues.push(
        "UI spec artifact using explicit skip rationale must include a non-empty Rationale section."
      );
    }
  } else if (artifact === "context" && missingRequiredSections.length > 0) {
    issues.push(
      `Context artifact is missing required contract sections: ${missingRequiredSections.join(", ")}.`
    );
  } else if (artifact === "ui-spec" && missingRequiredSections.length > 0) {
    issues.push(
      `UI spec artifact is missing required contract sections: ${missingRequiredSections.join(", ")}.`
    );
  } else if (presentRequiredSections === 0) {
    issues.push(
      `${artifactLabel} must include at least one populated contract section: ${contract.requiredHeadings.join(", ")}.`
    );
  }

  if (artifact === "ui-spec" && missingRequiredSections.includes("Outcome Mode")) {
    issues.push("UI spec artifact section Outcome Mode must not be empty.");
  }

  if (artifact === "context") {
    for (const heading of contract.requiredHeadings) {
      const section = extractMarkdownSection(content, heading);

      if (section.trim().length === 0) {
        continue;
      }

      if (!hasSubstantiveContractSection(section)) {
        issues.push(
          `Context artifact section ${heading} must contain substantive downstream-planning detail.`
        );
      }
    }

    const discussValidation = validateDiscussPhaseContextAntiPatterns(content);
    issues.push(...discussValidation.issues);
    warnings.push(...discussValidation.warnings);
  }

  if (artifact === "discussion-log") {
    const discussValidation = validateDiscussPhaseDiscussionLogAntiPatterns(content);
    issues.push(...discussValidation.issues);
    warnings.push(...discussValidation.warnings);
  }

  if (artifact !== "ui-spec" && artifact !== "context" && missingRequiredSections.length > 0) {
    warnings.push(
      `${artifactLabel} is missing recommended contract sections: ${missingRequiredSections.join(", ")}.`
    );
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}

const REQUIRED_VERIFICATION_SECTIONS = readArtifactContract(
  "phase.verification"
).requiredHeadings;
const VERIFICATION_PLACEHOLDER_BODIES = [
  "and any other saved phase summaries for validation evidence.",
  "Concise readiness result grounded in the saved summaries.",
  "Explicit blocker, follow-up, or `none`.",
  "Explicit next repair, follow-up, or `none`."
] as const;
type VerificationGateState = "PASS" | "PARTIAL" | "BLOCKED";
type VerificationReadinessState = "ready for UAT" | "not ready for UAT";
const VALID_VERIFICATION_COVERAGE_STATES = new Set(["PASS", "MANUAL", "DEFERRED", "BLOCKED"]);
const VALID_VERIFICATION_MANUAL_COVERAGE_STATES = new Set(["MANUAL", "DEFERRED", "NONE"]);
const VALID_VERIFICATION_GAP_CLASSES = new Set([
  "missing-evidence",
  "partial-coverage",
  "manual-only",
  "deferred-test",
  "contradiction",
  "none"
]);

function parseVerificationGateState(
  content: string
): {
  topGateState: VerificationGateState | null;
  gateState: VerificationGateState | null;
  readinessState: VerificationReadinessState | null;
} {
  const topGateState = content.match(/^\*\*Gate State:\*\*\s*(PASS|PARTIAL|BLOCKED)\s*$/m)?.[1] ?? null;
  const gateState = content.match(/^\s*-\s*Gate:\s*(PASS|PARTIAL|BLOCKED)\s*$/m)?.[1] ?? null;
  const readinessState =
    content.match(/^\s*-\s*Readiness:\s*(ready for UAT|not ready for UAT)\s*$/m)?.[1] ?? null;

  return {
    topGateState: topGateState as VerificationGateState | null,
    gateState: gateState as VerificationGateState | null,
    readinessState: readinessState as VerificationReadinessState | null
  };
}

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

  if (!/^# .+ - Verification(?:\r?\n|$)/.test(content)) {
    issues.push("Verification artifact must start with a '# ... - Verification' heading.");
  }

  if (!/^\*\*Coverage:\*\*\s*.+$/m.test(content)) {
    issues.push(
      "Verification artifact must declare **Coverage:** with a brief summary of the validated summaries or plan slices."
    );
  }

  issues.push(...validateValidationScaffoldPlaceholders(content, "Verification artifact"));
  const { topGateState, gateState, readinessState } = parseVerificationGateState(content);

  if (!topGateState) {
    issues.push(
      "Verification artifact must declare **Gate State:** as PASS, PARTIAL, or BLOCKED."
    );
  }

  if (!gateState) {
    issues.push("Verification artifact must include a Gate State section with a concrete Gate value.");
  }

  if (!readinessState) {
    issues.push(
      "Verification artifact must include a Gate State section with a concrete Readiness value."
    );
  }

  if (topGateState && gateState && topGateState !== gateState) {
    issues.push(
      "Verification artifact must keep the top **Gate State:** marker and the Gate section value consistent."
    );
  }

  if (gateState && readinessState) {
    const expectedReadiness: VerificationReadinessState =
      gateState === "PASS" ? "ready for UAT" : "not ready for UAT";

    if (readinessState !== expectedReadiness) {
      issues.push(
        "Verification artifact must keep the Gate section Readiness value aligned with the Gate state."
      );
    }
  }

  if (/^\*\*Sign-off:\*\*\s*verified\|pending\|blocked\s*$/m.test(content)) {
    issues.push(
      "Verification artifact must replace the raw **Sign-off:** verified|pending|blocked placeholder with the verification owner or pending state."
    );
  }

  if (!/^\*\*Sign-off:\*\*\s*.+$/m.test(content)) {
    issues.push("Verification artifact must declare **Sign-off:** with the verification owner or pending state.");
  }

  issues.push(
    ...validateRequiredMarkdownSections(
      content,
      "Verification artifact",
      REQUIRED_VERIFICATION_SECTIONS
    )
  );

  for (const placeholderBody of VERIFICATION_PLACEHOLDER_BODIES) {
    if (content.includes(placeholderBody)) {
      issues.push(
        `Verification artifact still contains placeholder scaffold text: ${placeholderBody}`
      );
    }
  }

  const requirementCoverage = extractMarkdownSection(content, "Requirement / Task Coverage");
  if (!hasCoverageTableRows(requirementCoverage)) {
    issues.push(
      "Verification artifact section Requirement / Task Coverage must include at least one populated coverage row."
    );
  }
  for (const cells of extractMarkdownTableDataRows(requirementCoverage)) {
    if (cells.length < 4) {
      issues.push(
        "Verification artifact section Requirement / Task Coverage must keep Requirement, Task or Check, Evidence, and Coverage State columns populated."
      );
      continue;
    }

    const coverageState = (cells[3] ?? "").trim().toUpperCase();
    if (!VALID_VERIFICATION_COVERAGE_STATES.has(coverageState)) {
      issues.push(
        `Verification artifact section Requirement / Task Coverage uses an unsupported coverage state: ${cells[3] ?? ""}.`
      );
    }
  }

  const evidenceReviewed = extractMarkdownSection(content, "Evidence Reviewed");
  const citedSummaries = new Set(collectReferencedSummaryPaths(evidenceReviewed, summaryPaths));
  const missingSummaryCitations = summaryPaths.filter((summaryPath) => !citedSummaries.has(summaryPath));
  if (summaryPaths.length > 0 && citedSummaries.size === 0) {
    issues.push(
      "Verification artifact must cite at least one saved execution summary path or filename under ## Evidence Reviewed."
    );
  }
  if (missingSummaryCitations.length > 0) {
    issues.push(
      `Verification artifact must cite every saved execution summary under ## Evidence Reviewed. Missing: ${missingSummaryCitations
        .map((summaryPath) => summaryPath.split("/").pop() ?? summaryPath)
        .join(", ")}.`
    );
  }

  const manualCoverage = extractMarkdownSection(content, "Manual-Only or Deferred Coverage");
  for (const cells of extractMarkdownTableDataRows(manualCoverage)) {
    if (cells.length < 4) {
      issues.push(
        "Verification artifact section Manual-Only or Deferred Coverage must keep Item, Why manual or deferred, Follow-Up, and Status columns populated."
      );
      continue;
    }

    const status = (cells[3] ?? "").trim().toUpperCase();
    if (!VALID_VERIFICATION_MANUAL_COVERAGE_STATES.has(status)) {
      issues.push(
        `Verification artifact section Manual-Only or Deferred Coverage uses an unsupported status: ${cells[3] ?? ""}.`
      );
    }
  }

  const gapClassification = extractMarkdownSection(content, "Gap Classification");
  const gapRows = extractMarkdownTableDataRows(gapClassification);
  if (gapRows.length === 0) {
    issues.push(
      "Verification artifact section Gap Classification must include at least one populated gap row."
    );
  }
  for (const cells of gapRows) {
    if (cells.length < 4) {
      issues.push(
        "Verification artifact section Gap Classification must keep Gap class, Scope, Evidence, and Repair columns populated."
      );
      continue;
    }

    const gapClass = (cells[0] ?? "").trim().toLowerCase();
    if (!VALID_VERIFICATION_GAP_CLASSES.has(gapClass)) {
      issues.push(
        `Verification artifact section Gap Classification uses an unsupported gap class: ${cells[0] ?? ""}.`
      );
    }
  }

  const nextSafeAction = extractMarkdownSection(content, "Next Safe Action");
  const nextActionCommands = extractBlueprintCommands(nextSafeAction);
  const routesToVerifyWork = nextActionCommands.some((command) => /^\/blu-verify-work$/i.test(command));
  if (gateState === "PASS" && readinessState === "ready for UAT" && !routesToVerifyWork) {
    issues.push(
      "Verification artifact must route ready-for-UAT validation to /blu-verify-work under ## Next Safe Action."
    );
  }
  if (
    (gateState === "PARTIAL" || gateState === "BLOCKED" || readinessState === "not ready for UAT") &&
    routesToVerifyWork
  ) {
    issues.push(
      "Verification artifact must not route PARTIAL or BLOCKED validation to /blu-verify-work under ## Next Safe Action."
    );
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}

export function isVerificationArtifactReadyForUat(content: string): boolean {
  const { topGateState, gateState, readinessState } = parseVerificationGateState(content);

  return (
    topGateState === "PASS" &&
    gateState === "PASS" &&
    readinessState === "ready for UAT"
  );
}

type UatArtifactStatus = "PASS" | "FAIL" | "PARTIAL";
type UatArtifactResumeState = "RESUMED" | "NEW" | "CONTINUED";

export function readUatArtifactState(content: string): {
  status: UatArtifactStatus | null;
  resumeState: UatArtifactResumeState | null;
  checkpoint: string | null;
  complete: boolean;
} {
  const statusMatch = content.match(/^\*\*Status:\*\*\s*(PASS|FAIL|PARTIAL)\s*$/m);
  const resumeStateMatch = content.match(
    /^\*\*Resume State:\*\*\s*(RESUMED|NEW|CONTINUED)\s*$/m
  );
  const checkpointMatch = content.match(/^\*\*Checkpoint:\*\*[^\S\r\n]*(.+?)[^\S\r\n]*$/m);
  const checkpoint = checkpointMatch?.[1]?.trim() ?? null;

  return {
    status: (statusMatch?.[1] ?? null) as UatArtifactStatus | null,
    resumeState: (resumeStateMatch?.[1] ?? null) as UatArtifactResumeState | null,
    checkpoint,
    complete: statusMatch?.[1] === "PASS" && checkpoint?.toLowerCase() === "none"
  };
}

const REQUIRED_UAT_SECTIONS = readArtifactContract("phase.uat").requiredHeadings;
const UAT_PLACEHOLDER_BODIES = [
  "Concise user-facing result grounded in the saved summaries and verification artifact.",
  "Question asked during the UAT pass, or `none`.",
  "User-reported observed behavior tied to saved summary evidence such as",
  "Explicit blocker, follow-up, or `none`.",
  "Explicit follow-up fix, acceptance note, or `none`.",
  "<active test number or testing complete>",
  "<active user-observable test name or none>",
  "<what the user should observe>",
  "<user response, next checkpoint, or none>",
  "<test name>",
  "<observable expected behavior>",
  "pending|pass|issue|skipped|blocked",
  "<test number or none>",
  "<expected behavior>",
  "failed|partial|blocked|none",
  "blocker|major|minor|cosmetic|none",
  "<verbatim report or blocked reason>",
  "<repair or confirmation path>"
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
  const uatState = readUatArtifactState(content);

  if (!/^# .+ - UAT(?:\r?\n|$)/.test(content)) {
    issues.push("UAT artifact must start with a '# ... - UAT' heading.");
  }

  if (!uatState.status) {
    issues.push("UAT artifact must declare **Status:** PASS, FAIL, or PARTIAL.");
  }

  if (!uatState.resumeState) {
    issues.push("UAT artifact must declare **Resume State:** RESUMED, NEW, or CONTINUED.");
  }

  if (!uatState.checkpoint || uatState.checkpoint.length === 0) {
    issues.push(
      "UAT artifact must declare **Checkpoint:** with `none` or a non-empty in-artifact checkpoint label."
    );
  }

  issues.push(...validateValidationScaffoldPlaceholders(content, "UAT artifact"));
  issues.push(...validateRequiredMarkdownSections(content, "UAT artifact", REQUIRED_UAT_SECTIONS));

  for (const placeholderBody of UAT_PLACEHOLDER_BODIES) {
    if (content.includes(placeholderBody)) {
      issues.push(`UAT artifact still contains placeholder scaffold text: ${placeholderBody}`);
    }
  }

  const uatSummary = extractMarkdownSection(content, "UAT Summary");
  const sessionState = extractMarkdownSection(content, "Session State");
  const observedBehavior = extractMarkdownSection(content, "Observed Behavior");
  if (
    !containsReferencedSummaryPath(`${uatSummary}\n${sessionState}\n${observedBehavior}`, summaryPaths)
  ) {
    issues.push(
      "UAT artifact must cite at least one saved execution summary path or filename in ## UAT Summary, ## Session State, or ## Observed Behavior."
    );
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}

export function validateReviewArtifactContent(
  content: string,
  artifact:
    | "code-review"
    | "peer-review"
    | "review-fix"
    | "security"
    | "ui-review"
): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  const validation = validateContractBackedMarkdown(
    content,
    resolveReviewArtifactContractId(artifact),
    "Review artifact"
  );

  if (!validation.valid || artifact !== "code-review") {
    return validation;
  }

  const issues = [...validation.issues, ...validateCodeReviewArtifactCoreQuality(content)];

  return {
    valid: issues.length === 0,
    issues,
    warnings: validation.warnings
  };
}

type ReviewArtifactSeverity = "critical" | "high" | "medium" | "low" | "unknown";

const REVIEW_ARTIFACT_SEVERITIES = [
  "critical",
  "high",
  "medium",
  "low",
  "unknown"
] as const satisfies readonly ReviewArtifactSeverity[];

function collectMarkdownListItems(section: string): string[] {
  return section
    .split("\n")
    .map((line) => line.trim())
    .flatMap((line) => {
      const checklistMatch = line.match(/^[-*]\s+\[(?: |x|X)\]\s+(.+)$/);

      if (checklistMatch) {
        return [checklistMatch[1].trim()];
      }

      const bulletMatch = line.match(/^[-*+]\s+(.+)$/);

      if (bulletMatch) {
        return [bulletMatch[1].trim()];
      }

      const numberedMatch = line.match(/^\d+\.\s+(.+)$/);

      return numberedMatch ? [numberedMatch[1].trim()] : [];
    })
    .filter((item) => item.length > 0);
}

function normalizeReviewArtifactItem(item: string): string {
  return item
    .replace(/^`+|`+$/g, "")
    .replace(/^[\s"'“”‘’()[\]{}<>]+|[\s"'“”‘’()[\]{}<>.,;:!?]+$/g, "")
    .trim()
    .toLowerCase();
}

function isPlaceholderReviewArtifactItem(item: string): boolean {
  const normalized = normalizeReviewArtifactItem(item);

  return (
    normalized.length === 0 ||
    normalized === "none" ||
    normalized === "n/a" ||
    normalized === "na" ||
    normalized === "not applicable" ||
    normalized === "no finding" ||
    normalized === "no findings" ||
    normalized === "no follow up" ||
    normalized === "no follow ups" ||
    normalized === "no follow-up" ||
    normalized === "no follow-ups"
  );
}

function extractScopeReviewedPaths(section: string): string[] {
  const paths = new Set<string>();
  const pathPattern = /(?:^|[\s(])`?((?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+(?:\.[A-Za-z0-9._-]+)?)`?(?=$|[\s),.;:!?])/g;

  for (const item of collectMarkdownListItems(section)) {
    for (const match of item.matchAll(pathPattern)) {
      paths.add(match[1]);
    }
  }

  for (const row of extractMarkdownTableRows(section)) {
    const candidate = row[0]?.trim();

    if (!candidate) {
      continue;
    }

    const unwrapped = candidate.replace(/^`|`$/g, "");
    if (/^(?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+(?:\.[A-Za-z0-9._-]+)?$/.test(unwrapped)) {
      paths.add(unwrapped);
    }
  }

  return [...paths].sort((left, right) => left.localeCompare(right));
}

function inferReviewArtifactSeverity(item: string): ReviewArtifactSeverity {
  const source = item.toLowerCase();

  if (/\b(?:critical|p0)\b/.test(source)) {
    return "critical";
  }

  if (/\b(?:high|p1)\b/.test(source)) {
    return "high";
  }

  if (/\b(?:medium|p2)\b/.test(source)) {
    return "medium";
  }

  if (/\b(?:low|p3)\b/.test(source)) {
    return "low";
  }

  return "unknown";
}

function containsLineBackedRepoFileEvidence(item: string): boolean {
  return /(?:^|[\s(])`?(?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+(?:\.[A-Za-z0-9._-]+)?:\d+(?:-\d+)?`?(?=$|[\s),.;:!?])/.test(
    item
  );
}

function parseSeveritySummaryCounts(section: string): Partial<Record<ReviewArtifactSeverity, number>> {
  const counts: Partial<Record<ReviewArtifactSeverity, number>> = {};

  for (const line of section.split("\n")) {
    const match = line.trim().match(
      /^[-*+]\s*(critical|high|medium|low|unknown)\s*:\s*(\d+)\s*$/i
    );

    if (!match) {
      continue;
    }

    counts[match[1].toLowerCase() as ReviewArtifactSeverity] = Number(match[2]);
  }

  return counts;
}

function validateCodeReviewArtifactCoreQuality(content: string): string[] {
  const issues: string[] = [];
  const scopeReviewed = extractMarkdownSection(content, "Scope Reviewed");
  const scopedPaths = extractScopeReviewedPaths(scopeReviewed);

  if (scopedPaths.length === 0) {
    issues.push(
      "Review artifact section Scope Reviewed must cite at least one repo-relative reviewed file."
    );
  }

  const findingsSection = extractMarkdownSection(content, "Findings");
  const findingItems = collectMarkdownListItems(findingsSection).filter(
    (item) => !isPlaceholderReviewArtifactItem(item)
  );
  const actualCounts = REVIEW_ARTIFACT_SEVERITIES.reduce(
    (acc, severity) => {
      acc[severity] = 0;
      return acc;
    },
    {} as Record<ReviewArtifactSeverity, number>
  );

  for (const item of findingItems) {
    actualCounts[inferReviewArtifactSeverity(item)] += 1;

    if (!containsLineBackedRepoFileEvidence(item)) {
      issues.push(
        `Review artifact finding must include repo-relative file:line evidence: ${item}`
      );
    }
  }

  const severitySummary = extractMarkdownSection(content, "Severity Summary");
  const declaredCounts = parseSeveritySummaryCounts(severitySummary);

  for (const severity of REVIEW_ARTIFACT_SEVERITIES) {
    if (declaredCounts[severity] === undefined) {
      issues.push(
        `Review artifact section Severity Summary must include a ${severity}: <count> line.`
      );
      continue;
    }

    if (declaredCounts[severity] !== actualCounts[severity]) {
      issues.push(
        `Review artifact section Severity Summary reports ${severity}: ${declaredCounts[severity]}, but Findings contains ${actualCounts[severity]} ${severity} item(s).`
      );
    }
  }

  return issues;
}

export function validateReviewArtifactScopeCoverage(
  content: string,
  scopeFiles: string[]
): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  const scopeReviewed = extractScopeReviewedPaths(extractMarkdownSection(content, "Scope Reviewed"));
  const reviewed = new Set(scopeReviewed);
  const missingScopeFiles = [...new Set(scopeFiles)].filter((scopeFile) => !reviewed.has(scopeFile));
  const issues =
    missingScopeFiles.length === 0
      ? []
      : [
          `Review artifact section Scope Reviewed must list every resolved scoped file. Missing: ${missingScopeFiles.join(", ")}.`
        ];

  return {
    valid: issues.length === 0,
    issues,
    warnings: []
  };
}

export function validateReportArtifactContent(
  content: string,
  reportName: string
): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  const contractId = resolveReportContractId(reportName);

  if (!contractId || contractId === "report.pause-work") {
    return {
      valid: true,
      issues: [],
      warnings: []
    };
  }

  const isMilestoneAudit = contractId === "report.milestone-audit";
  const milestoneAuditGapHeadings = [
    "Requirement Gaps",
    "Integration Gaps",
    "Flow Gaps",
    "Optional Gaps"
  ] as const;
  const hasStructuredMilestoneAuditGapSections = isMilestoneAudit
    ? milestoneAuditGapHeadings.some((heading) =>
        new RegExp(`(?:^|\\n)## ${escapeRegex(heading)}\\s*$`, "m").test(content)
      )
    : false;
  const hasLegacyMilestoneAuditGapSummary = isMilestoneAudit
    ? /(?:^|\n)## Gaps Found\s*$/m.test(content)
    : false;
  const legacyMilestoneAuditCompatibility =
    isMilestoneAudit && hasLegacyMilestoneAuditGapSummary && !hasStructuredMilestoneAuditGapSections;

  const validation = validateContractBackedMarkdown(content, contractId, "Report artifact");

  if (!validation.valid && !legacyMilestoneAuditCompatibility) {
    return validation;
  }

  if (isMilestoneAudit) {
    const issues: string[] = [];
    const auditVerdict = extractMarkdownSection(content, "Audit Verdict");
    const evidenceDimensions = extractMarkdownSection(content, "Milestone Evidence Dimensions");
    const requirementGaps = extractMarkdownSection(content, "Requirement Gaps");
    const integrationGaps = extractMarkdownSection(content, "Integration Gaps");
    const flowGaps = extractMarkdownSection(content, "Flow Gaps");
    const optionalGaps = extractMarkdownSection(content, "Optional Gaps");
    const hasStructuredGapSections =
      [requirementGaps, integrationGaps, flowGaps, optionalGaps].some((section) => section.length > 0) ||
      hasStructuredMilestoneAuditGapSections;
    const hasLegacyGapSummary = hasLegacyMilestoneAuditGapSummary;
    const evidenceRows = evidenceDimensions
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => isMarkdownTableRow(line) && !isMarkdownTableHeaderRow(line));
    const gapSections = [
      ["Requirement Gaps", requirementGaps],
      ["Integration Gaps", integrationGaps],
      ["Flow Gaps", flowGaps],
      ["Optional Gaps", optionalGaps]
    ] as const;

    if (!/^- Verdict:\s*(READY_TO_CLOSE|FOLLOW_UP|BLOCKED)\s*$/m.test(auditVerdict)) {
      issues.push(
        "Report artifact section Audit Verdict must include a concrete Verdict line using READY_TO_CLOSE, FOLLOW_UP, or BLOCKED."
      );
    }

    if (/\bREADY_TO_CLOSE\|FOLLOW_UP\|BLOCKED\b/.test(auditVerdict)) {
      issues.push("Report artifact section Audit Verdict still contains scaffold verdict placeholder text.");
    }

    issues.push(
      ...validateMilestoneEvidenceLedger(content, "Report artifact", "Milestone Evidence Dimensions", [
        { label: "Roadmap intent", pattern: /Roadmap intent/i },
        { label: "Validation evidence", pattern: /Validation evidence/i },
        { label: "UAT evidence", pattern: /UAT evidence/i },
        { label: "Carry-forward evidence", pattern: /Carry-forward evidence/i }
      ])
    );

    if (hasStructuredGapSections) {
      for (const [heading, section] of gapSections) {
        const rows = extractMarkdownTableRows(section);

        if (rows.length === 0) {
          issues.push(`Report artifact section ${heading} must include at least one structured gap row.`);
          continue;
        }

        for (const row of rows) {
          if (row.length !== 4) {
            issues.push(
              `Report artifact section ${heading} must keep each gap row in the Gap ID, Surface, Evidence, and Repair columns.`
            );
            continue;
          }
        }
      }
    }

    if (!hasStructuredGapSections && hasLegacyGapSummary) {
      const filteredValidationIssues = validation.issues.filter(
        (issue) =>
          !milestoneAuditGapHeadings.some((heading) =>
            issue.includes(`missing required section: ${heading}`) ||
            issue.includes(`section ${heading} must not be empty.`)
          )
      );

      return {
        valid: issues.length === 0 && filteredValidationIssues.length === 0,
        issues: [...filteredValidationIssues, ...issues],
        warnings: []
      };
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings: []
    };
  }

  if (contractId === "report.milestone-complete") {
    const issues: string[] = [];
    const completionDecision = extractMarkdownSection(content, "Completion Decision");

    if (!/^- Decision:\s*(READY_TO_CLOSE|FOLLOW_UP|BLOCKED)\s*$/m.test(completionDecision)) {
      issues.push(
        "Report artifact section Completion Decision must include a concrete Decision line using READY_TO_CLOSE, FOLLOW_UP, or BLOCKED."
      );
    }

    if (/\bREADY_TO_CLOSE\|FOLLOW_UP\|BLOCKED\b/.test(completionDecision)) {
      issues.push(
        "Report artifact section Completion Decision still contains scaffold decision placeholder text."
      );
    }

    issues.push(
      ...validateMilestoneReportReferences(content, "Report artifact", "Audit Report Used", [
        "milestone-audit"
      ])
    );
    issues.push(
      ...validateMilestoneEvidenceLedger(content, "Report artifact", "Milestone Evidence Ledger", [
        { label: "Roadmap intent", pattern: /Roadmap intent/i },
        { label: "Validation evidence", pattern: /Validation evidence/i },
        { label: "UAT evidence", pattern: /UAT evidence/i },
        { label: "Carry-forward evidence", pattern: /Carry-forward evidence/i }
      ])
    );

    return {
      valid: issues.length === 0,
      issues,
      warnings: []
    };
  }

  if (contractId === "report.milestone-summary") {
    const issues: string[] = [];

    issues.push(
      ...validateMilestoneReportReferences(content, "Report artifact", "Source Reports Used", [
        "milestone-audit",
        "milestone-complete"
      ])
    );
    issues.push(
      ...validateMilestoneEvidenceLedger(content, "Report artifact", "Milestone Evidence Ledger", [
        { label: "Audit report", pattern: /Audit report/i },
        { label: "Completion report", pattern: /Completion report/i },
        { label: "Roadmap context", pattern: /Roadmap context/i },
        { label: "Carry-forward context", pattern: /Carry-forward context/i }
      ])
    );

    return {
      valid: issues.length === 0,
      issues,
      warnings: []
    };
  }

  return validation;
}

type SummaryValidationOptions = {
  linkedPlanPath?: string | null;
  requirePlanMarker?: boolean;
};

function normalizeSummaryPlanReference(value: string): string {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith("`") && trimmed.endsWith("`")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

export function extractSummaryPlanReference(content: string): string | null {
  const match = content.match(/^\*\*Plan:\*\*\s*(.+)$/m);

  return match ? normalizeSummaryPlanReference(match[1]) : null;
}

export function extractSummaryStatus(content: string): "COMPLETED" | "PARTIAL" | "BLOCKED" | null {
  const match = content.match(/^\*\*Status:\*\*\s*(.+)$/m);

  if (!match) {
    return null;
  }

  const status = match[1].trim().toUpperCase();

  if (status === "COMPLETED" || status === "PARTIAL" || status === "BLOCKED") {
    return status;
  }

  return null;
}

export function validateSummaryArtifactContent(
  content: string,
): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  const contract = readArtifactContract("phase.summary");
  const issues: string[] = [];
  const warnings: string[] = [];
  const normalizedContent = content.replace(/\r\n/g, "\n");

  if (!/^# .+ - Summary(?:\s+\d+)?(?:\n|$)/.test(normalizedContent)) {
    issues.push("Summary artifact must start with a '# ... - Summary' heading.");
  }

  issues.push(
    ...validateLockedMarkers(normalizedContent, "Summary artifact", contract.lockedMarkers),
    ...validateRequiredMarkdownSections(
      normalizedContent,
      "Summary artifact",
      contract.requiredHeadings
    )
  );

  issues.push(
    ...contract.placeholderSignals
      .filter((signal) => signal.length > 0 && normalizedContent.includes(signal))
      .map((signal) => `Summary artifact still contains placeholder scaffold text: ${signal}.`)
  );

  const statusLine = normalizedContent.match(/^\*\*Status:\*\*\s*(.+)$/m)?.[1]?.trim();
  if (statusLine && !extractSummaryStatus(normalizedContent)) {
    issues.push(
      "Summary artifact **Status:** marker must be one of COMPLETED, PARTIAL, or BLOCKED."
    );
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}

export function validateSummaryPlanReference(
  content: string,
  options: SummaryValidationOptions = {}
): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];
  const normalizedContent = content.replace(/\r\n/g, "\n");
  const summaryPlanReference = extractSummaryPlanReference(normalizedContent);

  if (summaryPlanReference) {
    if (options.linkedPlanPath === undefined || options.linkedPlanPath === null) {
      issues.push("Summary artifact must reference a matching plan artifact.");
    } else {
      const expectedPlanPath = options.linkedPlanPath;
      const expectedPlanFile = path.basename(expectedPlanPath);

      if (
        summaryPlanReference !== expectedPlanPath &&
        summaryPlanReference !== expectedPlanFile
      ) {
        issues.push(
          `Summary artifact **Plan:** marker ${summaryPlanReference} does not match linked plan path ${expectedPlanPath}.`
        );
      }
    }
  } else if (options.requirePlanMarker) {
    issues.push(
      "Summary artifact must include a **Plan:** marker that references the matching plan artifact."
    );
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}

export function validateStrictSummaryArtifactContent(
  content: string,
  options: SummaryValidationOptions = {}
): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  const summaryValidation = validateSummaryArtifactContent(content);
  const planValidation = validateSummaryPlanReference(content, options);

  return {
    valid: summaryValidation.valid && planValidation.valid,
    issues: [...summaryValidation.issues, ...planValidation.issues],
    warnings: [...summaryValidation.warnings, ...planValidation.warnings]
  };
}

export function validatePlanArtifactContent(
  content: string,
  expectedPhase?: string,
  options: { strict?: boolean } = {}
): {
  valid: boolean;
  issues: string[];
  warnings: string[];
  metadata: PlanArtifactMetadata;
} {
  const issues: string[] = [];
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
  } else {
    issues.push(...validatePlanPathList(metadata.filesModified, "files_modified"));
  }

  if (metadata.readFirst.length === 0) {
    issues.push("Plan frontmatter must include at least one file or path in read_first.");
  } else {
    issues.push(...validatePlanPathList(metadata.readFirst, "read_first"));
  }

  if (metadata.acceptanceCriteria.length === 0) {
    issues.push(
      "Plan frontmatter must include at least one grep/test-verifiable item in acceptance_criteria."
    );
  } else {
    issues.push(
      ...validateObjectivePlanBulletList(
        metadata.acceptanceCriteria.map((criterion) => `- ${criterion}`).join("\n"),
        "Plan frontmatter acceptance_criteria"
      )
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
    const taskNumberMatch = taskBlock.match(/^###\s+Task\s+(\d+)/m);
    const taskNumber = taskNumberMatch ? Number.parseInt(taskNumberMatch[1], 10) : taskBlocks.indexOf(taskBlock) + 1;

    for (const taskHeading of ["Read First", "Action", "Acceptance Criteria"]) {
      if (!new RegExp(`(?:^|\\n)#### ${escapeRegex(taskHeading)}\\s*$`, "m").test(taskBlock)) {
        issues.push(`Each task must include a #### ${taskHeading} subsection.`);
      }
    }

    issues.push(...validatePlanTaskBlock(taskBlock, taskNumber));
  }

  const verificationSection = extractMarkdownSection(content, "Verification");
  if (!hasSubstantivePlanListContent(verificationSection)) {
    issues.push("Plan artifact must include at least one substantive verification bullet under ## Verification.");
  }

  const mustHavesSection = extractMarkdownSection(content, "Must Haves");
  if (!hasSubstantivePlanListContent(mustHavesSection)) {
    issues.push("Plan artifact must include at least one substantive bullet under ## Must Haves.");
  }

  const normalizedPlanId =
    metadata.planId && /^\d+$/.test(metadata.planId)
      ? Number.parseInt(metadata.planId, 10)
      : null;
  const dependencyIds = metadata.dependsOn
    .filter((dependency) => /^\d+$/.test(dependency))
    .map((dependency) => Number.parseInt(dependency, 10));

  if (metadata.dependsOn.some((dependency) => !/^\d+$/.test(dependency))) {
    issues.push("Plan frontmatter depends_on entries must be numeric plan ids.");
  }

  if (new Set(dependencyIds).size !== dependencyIds.length) {
    issues.push("Plan frontmatter depends_on entries must not repeat plan ids.");
  }

  if (normalizedPlanId !== null) {
    for (const dependency of dependencyIds) {
      if (dependency === normalizedPlanId) {
        issues.push("Plan frontmatter depends_on entries must not reference the plan itself.");
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings: [],
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
  workflowArtifactFiles: string[];
  core: { present: string[]; missing: string[] };
  phases: string[];
  reports: string[];
  codebase: CodebaseArtifactDiagnostics;
}> {
  const blueprintRoot = getBlueprintRoot(projectRoot);
  const blueprintRootExists = await pathExists(blueprintRoot);
  const codebaseRootExists = await pathExists(resolveBlueprintPath(projectRoot, BLUEPRINT_CODEBASE_PATH));
  const rootShape = await assessRootBootstrapShape(projectRoot);
  const blueprintFiles = blueprintRootExists
    ? await listRelativeFiles(blueprintRoot, projectRoot)
    : [];
  const workflowArtifactFiles = blueprintFiles.filter(
    (artifact) => !OPERATIONAL_ONLY_BLUEPRINT_ARTIFACTS.has(artifact)
  );
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
  const codebaseValid: string[] = [];
  const codebaseInvalid: string[] = [];
  const codebaseWarnings: string[] = [];

  for (const artifact of CODEBASE_ARTIFACTS) {
    const artifactPath = resolveBlueprintPath(projectRoot, artifact);

    if (await pathExists(artifactPath)) {
      codebasePresent.push(artifact);
      const contractId = resolveCodebaseArtifactPathContractId(artifact);
      const raw = await fs.readFile(artifactPath, "utf8");
      const validation = validateCodebaseArtifactContent(raw, contractId);

      if (validation.valid) {
        codebaseValid.push(artifact);
      } else {
        codebaseInvalid.push(artifact);
        codebaseWarnings.push(
          `${artifact}: ${validation.issues.join(" ")}`
        );
      }

      for (const warning of validation.warnings) {
        codebaseWarnings.push(`${artifact}: ${warning}`);
      }
    } else {
      codebaseMissing.push(artifact);
    }
  }

  let readiness: BlueprintReadiness = "uninitialized";

  if (
    !blueprintRootExists ||
    (
      workflowArtifactFiles.length === 0 &&
      !codebaseRootExists &&
      rootShape.repoShape !== "brownfield"
    )
  ) {
    readiness = "uninitialized";
  } else if (coreMissing.length === 0) {
    readiness = "initialized";
  } else if (
    corePresent.length === 0 &&
    (codebaseRootExists || rootShape.repoShape === "brownfield")
  ) {
    readiness =
      codebaseMissing.length === 0 &&
      codebaseInvalid.length === 0 &&
      codebasePresent.length > 0
        ? "mapped-only"
        : "mapping-incomplete";
  } else {
    readiness = "partial";
  }

  return {
    readiness,
    blueprintRootExists,
    workflowArtifactFiles,
    core: {
      present: corePresent,
      missing: coreMissing
    },
    phases,
    reports,
    codebase: {
      present: codebasePresent,
      missing: codebaseMissing,
      valid: codebaseValid,
      invalid: codebaseInvalid,
      mapped: codebaseMissing.length === 0 && codebaseInvalid.length === 0 && codebasePresent.length > 0,
      warnings: codebaseWarnings
    }
  };
}

async function assessBootstrapRepoShape(
  projectRoot: string,
  inspection?: Awaited<ReturnType<typeof inspectBlueprintArtifacts>>
): Promise<BootstrapAssessment> {
  const rootShape = await assessRootBootstrapShape(projectRoot);
  const codebaseMapped = inspection?.codebase.mapped ?? false;
  const repoShape = rootShape.repoShape;
  const reasons = [...rootShape.reasons];

  const provisionalRoadmap = repoShape === "brownfield" && !codebaseMapped;
  const recommendedNextAction =
    provisionalRoadmap || inspection?.readiness === "mapping-incomplete"
      ? "Run /blu-map-codebase"
      : inspection?.readiness === "mapped-only"
        ? "Run /blu-new-project"
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

function extractRequirementIdsFromMarkdown(content: string): string[] {
  return [...new Set(extractRequirementIdsFromMarkdownAll(content))];
}

function extractRequirementIdsFromMarkdownAll(content: string): string[] {
  return [...content.matchAll(/\b([A-Z][A-Z0-9-]*-\d+)\b/g)].map((match) => match[1]);
}

function valuesWithDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }

    seen.add(value);
  }

  return [...duplicates];
}

function extractBootstrapRequirementListIds(section: string): string[] {
  return [...new Set([...section.matchAll(/^\s*-\s+`([A-Z][A-Z0-9-]*-\d+)`:/gm)].map((match) => match[1]))];
}

function extractBootstrapScopedRequirementIds(section: string): string[] {
  const ids: string[] = [];

  for (const line of section.split("\n")) {
    const match = line.match(/^\s*-\s*[^:]+:\s*(.+)$/);

    if (!match) {
      continue;
    }

    const value = match[1].trim();

    if (value.length === 0 || /^none$/i.test(value)) {
      continue;
    }

    ids.push(...extractRequirementIdsFromMarkdown(value));
  }

  return [...new Set(ids)];
}

function extractBootstrapRoadmapPhaseRequirementIds(phaseBlock: string): string[] {
  const requirementClause =
    phaseBlock.match(/\(\s*Requirements:\s*([^)]+)\)/i)?.[1] ??
    phaseBlock.match(/\bRequirements:\s*([^\n)]+)\s*$/im)?.[1] ??
    "";

  if (requirementClause.trim().length === 0) {
    return [];
  }

  return extractRequirementIdsFromMarkdownAll(requirementClause);
}

function extractBootstrapRoadmapPhaseSuccessCriteria(phaseBlock: string): string[] {
  const lines = phaseBlock.replace(/\r\n/g, "\n").split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)-\s*Success Criteria:\s*$/i);

    if (!match) {
      continue;
    }

    const labelIndent = match[1].length;
    const items: string[] = [];

    for (let lineIndex = index + 1; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];

      if (line.trim().length === 0) {
        continue;
      }

      const lineIndent = line.match(/^(\s*)/)?.[1].length ?? 0;

      if (lineIndent <= labelIndent && /^\s*-\s+/.test(line)) {
        break;
      }

      if (lineIndent > labelIndent && /^\s*-\s+\S/.test(line)) {
        items.push(line.trim().replace(/^\s*-\s+/, ""));
      }
    }

    return items;
  }

  return [];
}

function extractRoadmapRequirementRefs(content: string): string[] {
  const requirementCoverage = extractMarkdownSection(content, "Requirement Coverage");
  const phaseBlocks = extractBootstrapRoadmapPhaseBlocks(content);

  return [
    ...new Set([
      ...extractBootstrapScopedRequirementIds(requirementCoverage),
      ...phaseBlocks.flatMap((phaseBlock) => extractBootstrapRoadmapPhaseRequirementIds(phaseBlock))
    ])
  ];
}

function validateBootstrapRequirementTraceability(
  requirementsContent: string,
  roadmapContent: string
): {
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!isBootstrapRequirementsArtifact(requirementsContent) || !isBootstrapRoadmapArtifact(roadmapContent)) {
    return {
      issues,
      warnings
    };
  }

  const requirementIds = extractRequirementIds(requirementsContent);
  const roadmapRequirementRefs = extractRoadmapRequirementRefs(roadmapContent);

  if (requirementsContent.length > 0 && requirementIds.length === 0) {
    issues.push("REQUIREMENTS.md does not yet contain durable requirement IDs.");
  }

  if (requirementIds.length > 0 && roadmapRequirementRefs.length === 0) {
    issues.push("ROADMAP.md does not reference any requirement IDs from REQUIREMENTS.md.");
  }

  for (const requirementId of requirementIds) {
    if (!roadmapRequirementRefs.includes(requirementId)) {
      issues.push(`ROADMAP.md is missing traceability for requirement ${requirementId}.`);
    }
  }

  for (const roadmapRequirementRef of roadmapRequirementRefs) {
    if (!requirementIds.includes(roadmapRequirementRef)) {
      issues.push(
        `ROADMAP.md references requirement ${roadmapRequirementRef} which is not declared in REQUIREMENTS.md.`
      );
    }
  }

  return {
    issues,
    warnings
  };
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
  const traceability = validateBootstrapRequirementTraceability(requirementsContent, roadmapContent);

  traceabilityWarnings.push(...traceability.warnings, ...traceability.issues);

  if (
    brownfield.provisionalRoadmap &&
    inspection.codebase.present.length > 0 &&
    (inspection.codebase.missing.length > 0 || inspection.codebase.invalid.length > 0)
  ) {
    const missingBit =
      inspection.codebase.missing.length > 0
        ? ` missing ${inspection.codebase.missing.join(", ")}`
        : "";
    const invalidBit =
      inspection.codebase.invalid.length > 0
        ? ` invalid ${inspection.codebase.invalid.join(", ")}`
        : "";
    traceabilityWarnings.push(
      `Codebase artifact bundle is not yet mapped${missingBit}${invalidBit}.`
    );
  }

  if (brownfield.provisionalRoadmap) {
    traceabilityWarnings.push(
      "Brownfield roadmap remains provisional until `/blu-map-codebase` captures the existing codebase."
    );
  } else if (inspection.codebase.mapped) {
    traceabilityWarnings.push("Codebase artifact bundle is validated and ready for reuse.");
  } else if (inspection.codebase.present.length > 0 && inspection.codebase.invalid.length > 0) {
    traceabilityWarnings.push(
      "Codebase artifacts are present but remain incomplete or non-canonical; reuse should stay provisional until validation passes."
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
  const missing =
    inspection.readiness === "mapped-only" || inspection.readiness === "mapping-incomplete"
      ? []
      : [...inspection.core.missing];
  const warnings: string[] = [];

  if (
    inspection.readiness === "mapping-incomplete" &&
    inspection.codebase.missing.length > 0
  ) {
    missing.push(...inspection.codebase.missing);
  } else if (inspection.codebase.present.length > 0 && inspection.codebase.missing.length > 0) {
    missing.push(...inspection.codebase.missing);
  }

  if (inspection.codebase.invalid.length > 0) {
    warnings.push(
      `Existing codebase artifacts are present but not yet valid: ${inspection.codebase.invalid.join(", ")}`
    );
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

  if (inspection.readiness === "mapping-incomplete" || inspection.readiness === "mapped-only") {
    const nextAction =
      inspection.readiness === "mapping-incomplete"
        ? "Run /blu-map-codebase to finish the codebase mapping bundle before capture writes."
        : "Run /blu-new-project to bootstrap project artifacts before capture writes.";

    return {
      ...buildEmptyCaptureMutationResult(targetPath, "project_missing", [
        `Blueprint capture commands require initialized core project artifacts. ${nextAction}`
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

function collectPhaseSummaryPathsForArtifact(
  phaseArtifacts: string[],
  artifactPath: string
): string[] {
  const phaseRoot = artifactPath.slice(0, artifactPath.lastIndexOf("/") + 1);

  return phaseArtifacts.filter(
    (value) => value.startsWith(phaseRoot) && value.endsWith("-SUMMARY.md")
  );
}

export async function blueprintArtifactValidate(
  args: ArtifactValidateArgs = {}
): Promise<ArtifactValidateResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const inspection = await inspectBlueprintArtifacts(projectRoot);
  const issues: string[] = [];
  const suggestedRepairs = new Set<string>();
  const warnings: string[] = [];
  const bootstrapContents = new Map<string, string>();
  const allowLegacyBootstrapShell = inspection.phases.some((artifact) =>
    /phase-discovery/i.test(artifact)
  );
  const bootstrapAssessment = await assessBootstrapRepoShape(projectRoot, inspection);

  if (!inspection.blueprintRootExists) {
    issues.push(`Missing ${BLUEPRINT_DIR}/ directory.`);
    suggestedRepairs.add(
      bootstrapAssessment.repoShape === "brownfield"
        ? "Run /blu-map-codebase to create the seven-document codebase bundle before project bootstrap."
        : "Run /blu-new-project to initialize Blueprint artifacts."
    );
  } else if (
    inspection.readiness === "uninitialized" &&
    inspection.workflowArtifactFiles.length === 0
  ) {
    issues.push(`Missing ${BLUEPRINT_DIR}/ workflow artifacts.`);
    suggestedRepairs.add(
      bootstrapAssessment.repoShape === "brownfield"
        ? "Run /blu-map-codebase to create the seven-document codebase bundle before project bootstrap."
        : "Run /blu-new-project to initialize Blueprint artifacts."
    );
  }

  const codebaseOnly =
    inspection.readiness === "mapped-only" || inspection.readiness === "mapping-incomplete";

  if (!codebaseOnly && inspection.readiness !== "uninitialized") {
    for (const artifact of inspection.core.missing) {
      issues.push(`Missing core artifact: ${artifact}`);
    }
  }

  if (
    inspection.core.missing.length > 0 &&
    !codebaseOnly &&
    inspection.readiness !== "uninitialized"
  ) {
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

  if (
    inspection.codebase.present.length > 0 &&
    (inspection.codebase.missing.length > 0 || inspection.codebase.invalid.length > 0)
  ) {
    const missingText =
      inspection.codebase.missing.length > 0
        ? ` missing ${inspection.codebase.missing.join(", ")}`
        : "";
    const invalidText =
      inspection.codebase.invalid.length > 0
        ? ` invalid ${inspection.codebase.invalid.join(", ")}`
        : "";
    issues.push(`Codebase artifact bundle is incomplete or non-canonical:${missingText}${invalidText}`);
    suggestedRepairs.add("Re-run /blu-map-codebase to recreate the missing codebase artifacts.");
  }

  if (inspection.readiness === "mapping-incomplete" && inspection.codebase.present.length === 0) {
    issues.push("Codebase mapping bundle has not been written yet.");
    suggestedRepairs.add("Run /blu-map-codebase to create the seven-document codebase bundle.");
  }

  if (inspection.codebase.invalid.length > 0) {
    warnings.push(
      `Existing codebase artifacts are present but not yet valid: ${inspection.codebase.invalid.join(", ")}`
    );
  } else if (inspection.codebase.present.length > 0) {
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

  for (const artifact of [
    `${BLUEPRINT_DIR}/PROJECT.md`,
    `${BLUEPRINT_DIR}/REQUIREMENTS.md`,
    `${BLUEPRINT_DIR}/ROADMAP.md`
  ] as const) {
    const absolutePath = resolveBlueprintPath(projectRoot, artifact);

    if (!(await pathExists(absolutePath))) {
      continue;
    }

    const raw = await fs.readFile(absolutePath, "utf8");
    bootstrapContents.set(artifact, raw);
    const validation =
      artifact.endsWith("PROJECT.md")
        ? validateBootstrapProjectArtifact(raw, { allowLegacyShell: allowLegacyBootstrapShell })
        : artifact.endsWith("REQUIREMENTS.md")
          ? validateBootstrapRequirementsArtifact(raw, {
              allowLegacyShell: allowLegacyBootstrapShell
            })
          : validateBootstrapRoadmapArtifact(raw, { allowLegacyShell: allowLegacyBootstrapShell });

    for (const issue of validation.issues) {
      issues.push(`${artifact}: ${issue}`);
    }

    for (const warning of validation.warnings) {
      warnings.push(`${artifact}: ${warning}`);
    }

    if (!validation.valid) {
      suggestedRepairs.add(
        "Re-run /blu-new-project or /blu-health --repair to regenerate the bootstrap artifacts from the canonical contract."
      );
    }
  }

  const requirementsContent = bootstrapContents.get(`${BLUEPRINT_DIR}/REQUIREMENTS.md`);
  const roadmapContent = bootstrapContents.get(`${BLUEPRINT_DIR}/ROADMAP.md`);

  if (requirementsContent && roadmapContent) {
    const traceability = validateBootstrapRequirementTraceability(
      requirementsContent,
      roadmapContent
    );

    for (const issue of traceability.issues) {
      issues.push(issue);
    }
  }

  for (const artifact of inspection.phases.filter((value) => value.endsWith("-VERIFICATION.md"))) {
    const absolutePath = resolveBlueprintPath(projectRoot, artifact);
    const raw = await fs.readFile(absolutePath, "utf8");
    const summaryPaths = collectPhaseSummaryPathsForArtifact(inspection.phases, artifact);
    const validation = validateVerificationArtifactContent(raw, summaryPaths);

    for (const issue of validation.issues) {
      issues.push(`${artifact}: ${issue}`);
    }

    for (const warning of validation.warnings) {
      warnings.push(`${artifact}: ${warning}`);
    }

    if (!validation.valid) {
      suggestedRepairs.add(
        "Regenerate or update malformed phase verification through /blu-validate-phase before UAT."
      );
    }
  }

  for (const artifact of inspection.phases.filter((value) => value.endsWith("-UAT.md"))) {
    const absolutePath = resolveBlueprintPath(projectRoot, artifact);
    const raw = await fs.readFile(absolutePath, "utf8");
    const summaryPaths = collectPhaseSummaryPathsForArtifact(inspection.phases, artifact);
    const validation = validateUatArtifactContent(raw, summaryPaths);

    for (const issue of validation.issues) {
      issues.push(`${artifact}: ${issue}`);
    }

    for (const warning of validation.warnings) {
      warnings.push(`${artifact}: ${warning}`);
    }

    if (!validation.valid) {
      suggestedRepairs.add(
        "Regenerate or update malformed UAT through /blu-verify-work after the saved summaries and verification artifact are corrected."
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

  for (const artifact of inspection.phases.filter((value) => value.endsWith("-SUMMARY.md"))) {
    const absolutePath = resolveBlueprintPath(projectRoot, artifact);
    const linkedPlanPath = artifact.replace(/-SUMMARY\.md$/, "-PLAN.md");
    const linkedPlanExists = await pathExists(resolveBlueprintPath(projectRoot, linkedPlanPath));
    const raw = await fs.readFile(absolutePath, "utf8");
    const validation = validateStrictSummaryArtifactContent(raw, {
      linkedPlanPath: linkedPlanExists ? linkedPlanPath : null
    });

    for (const issue of validation.issues) {
      issues.push(`${artifact}: ${issue}`);
    }

    for (const warning of validation.warnings) {
      warnings.push(`${artifact}: ${warning}`);
    }

    if (!validation.valid) {
      suggestedRepairs.add(
        "Regenerate or update malformed phase summaries through /blu-execute-phase before validation-dependent commands."
      );
    }

    if (!linkedPlanExists) {
      issues.push(`${artifact}: no matching plan artifact exists for this summary.`);
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

function collectFocusEvidence(
  focusArea: string | undefined,
  candidates: string[]
): string[] {
  const normalizedFocus = focusArea?.trim().toLowerCase();

  if (!normalizedFocus) {
    return [];
  }

  return uniqueSorted(
    candidates.filter((candidate) => candidate.toLowerCase().includes(normalizedFocus))
  );
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
  const focusLabel = args.focusArea?.trim();
  const focusedSourceFiles = collectFocusEvidence(focusLabel, args.sourceFiles);
  const focusedDocFiles = collectFocusEvidence(focusLabel, args.docFiles);
  const focusedTrackedFiles = collectFocusEvidence(focusLabel, args.trackedFiles);
  const focusedDependencies = collectFocusEvidence(focusLabel, dependencies);
  const focusedEvidence = uniqueSorted([
    ...focusedSourceFiles,
    ...focusedDocFiles,
    ...focusedTrackedFiles,
    ...focusedDependencies
  ]);
  const focusNarrative =
    focusLabel && focusedEvidence.length > 0
      ? ` Focused ${focusLabel} evidence comes from ${focusedEvidence.slice(0, 3).join(", ")}.`
      : focusLabel
        ? ` Focus area requested: ${focusLabel}, but the supplied evidence did not include direct ${focusLabel} matches.`
        : "";

  return [
    {
      artifact: `${BLUEPRINT_CODEBASE_PATH}/STACK.md`,
      title: CODEBASE_SECTION_TITLES[`${BLUEPRINT_CODEBASE_PATH}/STACK.md`],
      summary: `${runtime} ${moduleType} project with ${testFramework}. Key package evidence comes from ${args.packageJsonPath ?? "package.json"} and tracked source files.${focusNarrative}`,
      evidence: uniqueSorted(
        [
          args.packageJsonPath,
          ...focusedDependencies.slice(0, 2),
          ...focusedSourceFiles.slice(0, 2),
          ...args.sourceFiles.slice(0, 2),
          ...args.testFiles.slice(0, 1)
        ].filter((value): value is string => Boolean(value))
      )
    },
    {
      artifact: `${BLUEPRINT_CODEBASE_PATH}/ARCHITECTURE.md`,
      title: CODEBASE_SECTION_TITLES[`${BLUEPRINT_CODEBASE_PATH}/ARCHITECTURE.md`],
      summary: `Primary layout centers on ${sourceRoots.join(", ") || "the repo root"}, with ${args.trackedFiles.length} tracked files informing the initial architecture map.${focusNarrative}`,
      evidence: uniqueSorted([
        ...focusedSourceFiles.slice(0, 3),
        ...focusedTrackedFiles.slice(0, 2),
        ...args.sourceFiles.slice(0, 3),
        ...args.trackedFiles.slice(0, 2)
      ])
    },
    {
      artifact: `${BLUEPRINT_CODEBASE_PATH}/STRUCTURE.md`,
      title: CODEBASE_SECTION_TITLES[`${BLUEPRINT_CODEBASE_PATH}/STRUCTURE.md`],
      summary: `Repository structure is anchored around ${sourceRoots.join(", ") || "the repo root"} with document roots in ${docRoots.join(", ") || "README-only docs"}. Use this map to find implementation seams quickly.${focusNarrative}`,
      evidence: uniqueSorted([
        ...focusedSourceFiles.slice(0, 4),
        ...focusedDocFiles.slice(0, 2),
        ...args.sourceFiles.slice(0, 4),
        ...args.docFiles.slice(0, 2),
        ...args.trackedFiles.slice(0, 2)
      ])
    },
    {
      artifact: `${BLUEPRINT_CODEBASE_PATH}/CONVENTIONS.md`,
      title: CODEBASE_SECTION_TITLES[`${BLUEPRINT_CODEBASE_PATH}/CONVENTIONS.md`],
      summary: `The repo signals ${runtime} conventions, ${moduleType} modules, and documented guidance via ${docRoots.join(", ") || "README-only docs"}.${focusNarrative}`,
      evidence: uniqueSorted(
        [
          args.readmePath,
          ...focusedDocFiles.slice(0, 2),
          ...focusedSourceFiles.slice(0, 2),
          ...args.docFiles.slice(0, 2),
          ...args.sourceFiles.slice(0, 2)
        ].filter((value): value is string => Boolean(value))
      )
    },
    {
      artifact: `${BLUEPRINT_CODEBASE_PATH}/TESTING.md`,
      title: CODEBASE_SECTION_TITLES[`${BLUEPRINT_CODEBASE_PATH}/TESTING.md`],
      summary: `Testing evidence points to ${testFramework} with ${args.testFiles.length} test file(s) and documentation coverage in ${docRoots.includes("docs") ? "docs/" : "README.md"}.${focusNarrative}`,
      evidence: uniqueSorted(
        [
          ...focusedSourceFiles.filter((file) => /test|spec/i.test(file)).slice(0, 2),
          ...args.testFiles.slice(0, 3),
          ...args.docFiles.filter((file) => file.startsWith("docs/")).slice(0, 1)
        ]
      )
    },
    {
      artifact: `${BLUEPRINT_CODEBASE_PATH}/INTEGRATIONS.md`,
      title: CODEBASE_SECTION_TITLES[`${BLUEPRINT_CODEBASE_PATH}/INTEGRATIONS.md`],
      summary:
        integrations.length > 0
          ? `Detected integration signals include ${integrations.join(", ")}.${focusNarrative}`
          : "No explicit third-party integration surface was detected from the supplied repo evidence.",
      evidence: uniqueSorted(
        [
          ...focusedDependencies.slice(0, 2),
          ...focusedSourceFiles.slice(0, 2),
          ...integrations,
          ...args.sourceFiles.filter((file) => file.includes("/integrations/")).slice(0, 2)
        ]
      )
    },
    {
      artifact: `${BLUEPRINT_CODEBASE_PATH}/CONCERNS.md`,
      title: CODEBASE_SECTION_TITLES[`${BLUEPRINT_CODEBASE_PATH}/CONCERNS.md`],
      summary:
        args.docFiles.length > 0
          ? `Docs exist under ${docRoots.join(", ")}, but reruns should preserve edited codebase docs unless replace is explicitly confirmed.${focusNarrative}`
          : "Documentation signals are thin, so generated codebase docs should be reviewed before deeper discovery or planning.",
      evidence: uniqueSorted(
        [
          ...focusedDocFiles.slice(0, 2),
          ...focusedTrackedFiles.slice(0, 2),
          ...args.docFiles.slice(0, 2),
          ...args.trackedFiles.slice(0, 2),
          ...args.testFiles.slice(0, 1)
        ]
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
  const h1Index = meaningfulLines.findIndex((line) => /^#\s+/.test(line));
  const firstSectionIndex = meaningfulLines.findIndex(
    (line, index) => index > h1Index && /^##\s+/.test(line)
  );
  const preambleLines =
    h1Index >= 0
      ? meaningfulLines
          .slice(h1Index + 1, firstSectionIndex >= 0 ? firstSectionIndex : meaningfulLines.length)
          .filter((line) => !line.startsWith("#"))
      : [];
  const sections = splitMarkdownSections(meaningfulLines).map((section, index) => {
    const summary = summarizeMarkdownSectionBody(section.body.join("\n"));

    return {
      ...section,
      index,
      summary,
      score: scoreDigestSectionHeading(section.heading)
    };
  });
  const prioritizedSections = sections
    .filter((section) => section.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const selectedSectionIndexes = new Set<number>();
  const preferredSections =
    prioritizedSections.length > 0 ? prioritizedSections.slice(0, 6) : sections.slice(0, 2);

  for (const section of preferredSections) {
    selectedSectionIndexes.add(section.index);
  }

  if (selectedSectionIndexes.size < 2) {
    for (const section of sections.slice(0, 2)) {
      selectedSectionIndexes.add(section.index);
    }
  }

  const summaryParts = [
    ...summarizePreambleLines(preambleLines),
    ...sections
      .filter((section) => selectedSectionIndexes.has(section.index))
      .map((section) => {
        return section.summary.length > 0 ? `${section.heading}: ${section.summary}` : section.heading;
      })
  ].filter((part) => part.length > 0);

  return {
    title: heading?.replace(/^#+\s*/, "").trim() ?? "Artifact Summary",
    summary:
      summaryParts.length > 0
        ? summaryParts.join(" | ")
        : "Artifact content is present and available for review.",
    evidence: []
  };
}

function buildRepoEvidenceDigestSections(args: {
  packageJsonPath: string | null;
  readmePath: string | null;
  sourceFiles: string[];
  testFiles: string[];
  docFiles: string[];
  trackedFiles: string[];
}): ArtifactSummaryDigestSection[] {
  const sections: ArtifactSummaryDigestSection[] = [];

  if (args.packageJsonPath || args.sourceFiles.length > 0) {
    sections.push({
      artifact: "repo-evidence/source",
      title: "Repo Source Evidence",
      summary:
        args.sourceFiles.length > 0
          ? `Source evidence spans ${summarizeTopDirectories(args.sourceFiles).join(", ") || "the repo root"} with ${args.sourceFiles.length} repo file(s) in scope.`
          : `Package evidence is anchored in ${args.packageJsonPath ?? "package.json"} even though no explicit source files were supplied.`,
      evidence: uniqueSorted(
        [args.packageJsonPath, ...args.sourceFiles.slice(0, 4)].filter(
          (value): value is string => Boolean(value)
        )
      )
    });
  }

  if (args.docFiles.length > 0 || args.readmePath) {
    sections.push({
      artifact: "repo-evidence/docs",
      title: "Repo Documentation Evidence",
      summary:
        args.docFiles.length > 0
          ? `Documentation evidence includes ${args.docFiles.length} file(s) rooted in ${summarizeTopDirectories(args.docFiles).join(", ")}.`
          : `Documentation evidence is currently anchored in ${args.readmePath ?? "README.md"}.`,
      evidence: uniqueSorted(
        [args.readmePath, ...args.docFiles.slice(0, 4)].filter(
          (value): value is string => Boolean(value)
        )
      )
    });
  }

  if (args.testFiles.length > 0) {
    sections.push({
      artifact: "repo-evidence/tests",
      title: "Repo Test Evidence",
      summary: `Test evidence includes ${args.testFiles.length} file(s) rooted in ${summarizeTopDirectories(args.testFiles).join(", ")}.`,
      evidence: uniqueSorted(args.testFiles.slice(0, 5))
    });
  }

  if (args.trackedFiles.length > 0) {
    sections.push({
      artifact: "repo-evidence/tracked",
      title: "Repo Tracked File Evidence",
      summary: `Tracked-file evidence includes ${args.trackedFiles.length} repo file(s) that can ground the current digest scope.`,
      evidence: uniqueSorted(args.trackedFiles.slice(0, 5))
    });
  }

  return sections;
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

  if (artifactPaths.length > 0) {
    const digest = await buildArtifactDigestSections(projectRoot, artifactPaths);
    const repoEvidenceDigest = buildRepoEvidenceDigestSections({
      packageJsonPath,
      readmePath,
      sourceFiles,
      testFiles,
      docFiles,
      trackedFiles
    });

    return {
      digest: [...digest, ...repoEvidenceDigest],
      inputsUsed: uniqueSorted([
        ...artifactPaths,
        packageJsonPath ?? "",
        readmePath ?? "",
        ...sourceFiles,
        ...testFiles,
        ...docFiles,
        ...trackedFiles
      ]).filter((value) => value.length > 0)
    };
  }

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

export async function blueprintArtifactContractRead(
  args: ArtifactContractReadArgs = {}
): Promise<ArtifactContractReadResult> {
  if (args.artifactId) {
    return {
      artifactId: args.artifactId,
      contract: readArtifactContract(args.artifactId)
    };
  }

  return {
    artifactId: null,
    contracts: listArtifactContracts()
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

  if (inspection.readiness === "mapping-incomplete" || inspection.readiness === "mapped-only") {
    throw new Error(
      "Blueprint report writes require initialized core project artifacts. Finish map-codebase/new-project bootstrap before writing reports."
    );
  }

  const pathValue = buildBlueprintReportPath(args.reportName);
  const absolutePath = resolveBlueprintPath(projectRoot, pathValue);
  const normalizedContent = args.content.endsWith("\n") ? args.content : `${args.content}\n`;
  const warnings: string[] = [];
  const exists = await pathExists(absolutePath);
  const validation = validateReportArtifactContent(normalizedContent, args.reportName);

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

  if (!validation.valid) {
    return {
      path: pathValue,
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      warnings: [...validation.issues]
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

  warnings.push(...validation.issues);
  warnings.push(...validation.warnings);
  return {
    path: pathValue,
    written: true,
    created: !exists,
    overwritten: exists,
    status: exists ? "updated" : "created",
    warnings
  };
}

export async function blueprintCodebaseArtifactWrite(
  args: ArtifactCodebaseWriteArgs
): Promise<ArtifactCodebaseWriteResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const inspection = await inspectBlueprintArtifacts(projectRoot);

  if (inspection.readiness === "uninitialized") {
    const bootstrapDiagnostics = await inspectBootstrapArtifacts(projectRoot);

    if (bootstrapDiagnostics.brownfield.repoShape !== "brownfield") {
      throw new Error(
        "Blueprint codebase writes before project bootstrap are only allowed for brownfield map-codebase runs. Run /blu-new-project first for greenfield or scaffold-only repos."
      );
    }
  }

  if (inspection.readiness === "partial") {
    throw new Error(
      "Blueprint codebase writes cannot proceed while core .blueprint artifacts are partially initialized. Run /blu-health before writing codebase artifacts."
    );
  }

  const pathValue = resolveCodebaseArtifactPath(args.artifactId);
  const absolutePath = resolveBlueprintPath(projectRoot, pathValue);
  const normalizedContent = args.content.endsWith("\n") ? args.content : `${args.content}\n`;
  const warnings: string[] = [];
  const exists = await pathExists(absolutePath);
  const validation = validateCodebaseArtifactContent(normalizedContent, args.artifactId);

  if (normalizedContent.trim().length === 0) {
    return {
      path: pathValue,
      artifactId: args.artifactId,
      written: false,
      created: false,
      overwritten: false,
      reused: false,
      status: "invalid",
      issues: ["Codebase artifact content must not be empty."],
      warnings: []
    };
  }

  if (!validation.valid) {
    return {
      path: pathValue,
      artifactId: args.artifactId,
      written: false,
      created: false,
      overwritten: false,
      reused: false,
      status: "invalid",
      issues: [...validation.issues],
      warnings: [...validation.warnings]
    };
  }

  if (exists) {
    const existingContent = await fs.readFile(absolutePath, "utf8");
    const existingValidation = validateCodebaseArtifactContent(existingContent, args.artifactId);

    if (existingContent === normalizedContent) {
      warnings.push("Preserved existing codebase artifact because the content was unchanged.");

      return {
        path: pathValue,
        artifactId: args.artifactId,
        written: false,
        created: false,
        overwritten: false,
        reused: true,
        status: "reused",
        issues: [],
        warnings
      };
    }

    if (!existingValidation.valid && !(args.overwrite ?? false)) {
      warnings.push(
        "Replacing the existing scaffold or non-canonical codebase artifact with authored content."
      );
    } else if (!(args.overwrite ?? false)) {
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
    warnings.push(`Replaced existing codebase artifact: ${pathValue}`);
  }

  warnings.push(...validation.warnings);
  return {
    path: pathValue,
    artifactId: args.artifactId,
    written: true,
    created: !exists,
    overwritten: exists,
    reused: false,
    status: exists ? "updated" : "created",
    issues: [],
    warnings
  };
}

export const artifactToolDefinitions = [
  {
    name: "blueprint_artifact_contract_read",
    description:
      "Read the canonical Blueprint artifact contract registry, including scaffold templates, authoring templates, and validation metadata.",
    inputSchema: artifactContractReadInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintArtifactContractRead(args as ArtifactContractReadArgs)
  },
  {
    name: "blueprint_artifact_scaffold",
    description:
      "Create or reuse Blueprint bootstrap, codebase, and phase artifacts inside .blueprint/.",
    inputSchema: artifactScaffoldInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintArtifactScaffold(args as ArtifactScaffoldArgs)
  },
  {
    name: "blueprint_codebase_artifact_write",
    description:
      "Write a substantive Blueprint codebase artifact with contract validation and overwrite protection.",
    inputSchema: artifactCodebaseWriteInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintCodebaseArtifactWrite(args as ArtifactCodebaseWriteArgs)
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
