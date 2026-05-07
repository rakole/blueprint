import fs from "node:fs/promises";
import path from "node:path";

import {
  BLUEPRINT_DIR,
  ensureRepoRoot,
  extractSummaryStatus,
  resolveBlueprintPath,
  resolveRepoRelativePath,
  toRepoRelativePath,
  validatePlanArtifactContent
} from "./artifacts.js";
import { blueprintConfigGet } from "./config.js";
import {
  formatBlueprintPhasePrefix,
  normalizeBlueprintPhaseRef
} from "../../shared/security.js";

export type PhaseQualityGateMissingGate = "review" | "security" | null;

export type PhaseQualityGateArtifactKind =
  | "plan"
  | "summary"
  | "review"
  | "review-fix"
  | "security"
  | "other";

export type PhaseQualityGateArtifactInput =
  | string
  | {
      path: string;
      content?: string;
      kind?: PhaseQualityGateArtifactKind;
    };

export type PhaseQualityGateScopedArtifacts = {
  all?: PhaseQualityGateArtifactInput[];
  plans?: PhaseQualityGateArtifactInput[];
  summaries?: PhaseQualityGateArtifactInput[];
  review?: PhaseQualityGateArtifactInput | null;
  reviewFix?: PhaseQualityGateArtifactInput | null;
  security?: PhaseQualityGateArtifactInput | null;
};

export type PhaseQualityGateArtifactCollection =
  | PhaseQualityGateArtifactInput[]
  | PhaseQualityGateScopedArtifacts;

export type PhaseQualityGateEvaluationArgs = {
  projectRoot: string;
  phaseNumber: string;
  phasePrefix?: string;
  phaseDir?: string;
  artifacts?: PhaseQualityGateArtifactCollection;
};

export type PhaseQualityGateEvaluation = {
  reviewPath: string | null;
  securityPath: string | null;
  hasReview: boolean;
  hasSecurity: boolean;
  reviewableFiles: string[];
  codeReviewEnabled: boolean;
  requiresCodeReview: boolean;
  gatesSatisfied: boolean;
  missingGate: PhaseQualityGateMissingGate;
  warnings: string[];
  reviewNextSafeAction: string | null;
};

export type PhaseQualityGateRoutingArgs = {
  implementedCommandNames: Set<string>;
  phaseNumber: string;
  evaluation: Pick<
    PhaseQualityGateEvaluation,
    | "missingGate"
    | "requiresCodeReview"
    | "gatesSatisfied"
    | "hasSecurity"
    | "reviewNextSafeAction"
  >;
};

type NormalizedArtifact = {
  path: string;
  content?: string;
  kind: PhaseQualityGateArtifactKind;
};

type CandidateResolution = {
  files: string[];
  warnings: string[];
};

const REVIEWABLE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".java",
  ".py",
  ".go",
  ".rs",
  ".rb",
  ".php",
  ".cs",
  ".cpp",
  ".cc",
  ".cxx",
  ".c",
  ".h",
  ".hpp",
  ".swift",
  ".kt",
  ".kts",
  ".scala",
  ".sh",
  ".toml",
  ".yaml",
  ".yml"
]);

const REVIEWABLE_FILENAMES = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "tsconfig.json",
  "jsconfig.json",
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mjs",
  "vitest.config.ts",
  "vitest.config.js",
  "jest.config.ts",
  "jest.config.js",
  "playwright.config.ts",
  "rollup.config.js",
  "rollup.config.mjs",
  "webpack.config.js",
  "esbuild.config.mjs",
  "tsup.config.ts",
  "eslint.config.js",
  "eslint.config.mjs",
  "biome.json",
  "tailwind.config.ts",
  "tailwind.config.js",
  "postcss.config.js",
  "gemini-extension.json",
  "tabnine-extension.json",
  "Dockerfile",
  "Makefile"
]);

const REVIEWABLE_ROOT_PREFIXES = [
  "src/",
  "tests/",
  "test/",
  "spec/",
  "scripts/",
  "hooks/",
  "commands/",
  "skills/",
  "agents/",
  "config/"
];

const PATH_TOKEN_PATTERN =
  /\/?[A-Za-z0-9._~@$+%-]+(?:\/[A-Za-z0-9._~@$+%-]+)+|\/?[A-Za-z0-9._~@$+%-]+\.[A-Za-z0-9]+/g;

function normalizePhasePrefix(args: PhaseQualityGateEvaluationArgs): string {
  return args.phasePrefix?.trim() || formatBlueprintPhasePrefix(args.phaseNumber);
}

function normalizePhaseRoot(phaseDir: string | undefined): string | null {
  const trimmed = phaseDir?.trim();

  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/\\/g, "/").replace(/\/+$/g, "");

  if (normalized.startsWith(`${BLUEPRINT_DIR}/phases/`)) {
    return normalized;
  }

  return `${BLUEPRINT_DIR}/phases/${normalized}`;
}

function normalizeArtifactInput(
  input: PhaseQualityGateArtifactInput,
  kind: PhaseQualityGateArtifactKind = "other"
): NormalizedArtifact | null {
  const artifactPath = typeof input === "string" ? input : input.path;
  const normalizedPath = artifactPath.trim().replace(/\\/g, "/");

  if (normalizedPath.length === 0) {
    return null;
  }

  return {
    path: normalizedPath,
    content: typeof input === "string" ? undefined : input.content,
    kind: typeof input === "string" ? kind : (input.kind ?? kind)
  };
}

function pushNormalizedArtifact(
  artifacts: NormalizedArtifact[],
  input: PhaseQualityGateArtifactInput | null | undefined,
  kind: PhaseQualityGateArtifactKind
): void {
  if (!input) {
    return;
  }

  const normalized = normalizeArtifactInput(input, kind);

  if (normalized) {
    artifacts.push(normalized);
  }
}

function normalizeArtifactCollection(
  collection: PhaseQualityGateArtifactCollection | undefined
): NormalizedArtifact[] {
  if (!collection) {
    return [];
  }

  if (Array.isArray(collection)) {
    return collection.flatMap((input) => {
      const normalized = normalizeArtifactInput(input);
      return normalized ? [normalized] : [];
    });
  }

  const artifacts: NormalizedArtifact[] = [];

  for (const input of collection.all ?? []) {
    pushNormalizedArtifact(artifacts, input, "other");
  }

  for (const input of collection.plans ?? []) {
    pushNormalizedArtifact(artifacts, input, "plan");
  }

  for (const input of collection.summaries ?? []) {
    pushNormalizedArtifact(artifacts, input, "summary");
  }

  pushNormalizedArtifact(artifacts, collection.review, "review");
  pushNormalizedArtifact(artifacts, collection.reviewFix, "review-fix");
  pushNormalizedArtifact(artifacts, collection.security, "security");

  return artifacts;
}

async function listPhaseArtifacts(args: {
  projectRoot: string;
  phaseRoot: string | null;
  providedArtifacts: NormalizedArtifact[];
  warnings: string[];
}): Promise<NormalizedArtifact[]> {
  if (args.providedArtifacts.length > 0 || args.phaseRoot === null) {
    return args.providedArtifacts;
  }

  try {
    const absolutePhaseRoot = resolveBlueprintPath(args.projectRoot, args.phaseRoot);
    const entries = await fs.readdir(absolutePhaseRoot, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => ({
        path: `${args.phaseRoot}/${entry.name}`,
        kind: "other" as const
      }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    args.warnings.push(`Could not list phase artifacts for quality gates: ${message}`);

    return args.providedArtifacts;
  }
}

function findArtifactPath(args: {
  artifacts: NormalizedArtifact[];
  phaseRoot: string | null;
  phasePrefix: string;
  suffix: "-REVIEW.md" | "-REVIEW-FIX.md" | "-SECURITY.md";
  kind: PhaseQualityGateArtifactKind;
}): string | null {
  return (
    args.artifacts.find((artifact) => artifact.kind === args.kind)?.path ??
    args.artifacts.find((artifact) =>
      artifact.path.endsWith(`/${args.phasePrefix}${args.suffix}`)
    )?.path ??
    (args.phaseRoot ? `${args.phaseRoot}/${args.phasePrefix}${args.suffix}` : null)
  );
}

async function readArtifactContent(args: {
  projectRoot: string;
  artifact: NormalizedArtifact;
}): Promise<string | null> {
  if (args.artifact.content !== undefined) {
    return args.artifact.content;
  }

  try {
    return await fs.readFile(resolveBlueprintPath(args.projectRoot, args.artifact.path), "utf8");
  } catch {
    return null;
  }
}

async function artifactExists(projectRoot: string, artifactPath: string | null): Promise<boolean> {
  if (artifactPath === null) {
    return false;
  }

  try {
    const stats = await fs.stat(resolveBlueprintPath(projectRoot, artifactPath));
    return stats.isFile();
  } catch {
    return false;
  }
}

function artifactDeclared(artifacts: NormalizedArtifact[], artifactPath: string | null): boolean {
  return artifactPath !== null && artifacts.some((artifact) => artifact.path === artifactPath);
}

function parsePlanIdForSuffix(
  artifactPath: string,
  phasePrefix: string,
  suffix: "PLAN" | "SUMMARY"
): string | null {
  const match = artifactPath.match(
    new RegExp(`${phasePrefix.replace(".", "\\.")}-(\\d+)-${suffix}\\.md$`)
  );

  return match?.[1]?.padStart(2, "0") ?? null;
}

function normalizeRepoPathCandidate(rawValue: string): string {
  return rawValue
    .trim()
    .replace(/^[-*]\s+/, "")
    .replace(/^["'`([{<]+/g, "")
    .replace(/[>"'`)\]}.,;:]+$/g, "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "");
}

async function resolveExistingRepoFiles(args: {
  projectRoot: string;
  candidates: Iterable<string>;
  source: string;
}): Promise<CandidateResolution> {
  const files = new Set<string>();
  const warnings: string[] = [];

  for (const rawCandidate of args.candidates) {
    const candidate = normalizeRepoPathCandidate(rawCandidate);

    if (candidate.length === 0 || /^https?:\/\//i.test(candidate)) {
      continue;
    }

    if (candidate.includes("*")) {
      warnings.push(`Skipped wildcard quality-gate path from ${args.source}: ${candidate}`);
      continue;
    }

    if (path.isAbsolute(candidate)) {
      warnings.push(`Skipped absolute quality-gate path from ${args.source}: ${candidate}`);
      continue;
    }

    if (candidate.startsWith(`${BLUEPRINT_DIR}/`) || candidate.startsWith("dist/")) {
      continue;
    }

    let absolutePath: string;

    try {
      absolutePath = resolveRepoRelativePath(args.projectRoot, candidate);
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? error.message
          : `Skipped invalid quality-gate path from ${args.source}: ${candidate}`
      );
      continue;
    }

    let stats;

    try {
      stats = await fs.stat(absolutePath);
    } catch {
      continue;
    }

    if (!stats.isFile()) {
      continue;
    }

    files.add(toRepoRelativePath(args.projectRoot, absolutePath));
  }

  return {
    files: [...files].sort((left, right) => left.localeCompare(right)),
    warnings
  };
}

function extractMarkdownSection(content: string, heading: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(
    new RegExp(`(?:^|\\n)##\\s+${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, "i")
  );

  return match?.[1]?.trim() ?? "";
}

function extractPathCandidatesFromSection(section: string): string[] {
  const candidates = new Set<string>();

  for (const match of section.matchAll(/`([^`]+)`/g)) {
    const value = match[1]?.trim();

    if (value) {
      candidates.add(value);
    }
  }

  for (const match of section.matchAll(PATH_TOKEN_PATTERN)) {
    candidates.add(match[0]);
  }

  return [...candidates];
}

function extractBlueprintCommand(line: string): string | null {
  const match = line.match(/\/blu-[a-z0-9-]+(?:\s+[^\s`'").,;:!?]+)?/i);

  return match?.[0]?.trim().replace(/[`'").,;:!?]+$/g, "") ?? null;
}

function extractReviewNextSafeAction(content: string): string | null {
  const section = extractMarkdownSection(content, "Next Safe Action");

  return (
    section
      .split(/\r?\n/)
      .map(extractBlueprintCommand)
      .find((command): command is string => command !== null) ?? null
  );
}

function extractReviewFixNextSafeAction(content: string): string | null {
  const sectionAction = extractReviewNextSafeAction(content);

  if (sectionAction !== null) {
    return sectionAction;
  }

  const markerAction = extractArtifactMarker(content, "Next Safe Action");

  return markerAction ? extractBlueprintCommand(markerAction) : null;
}

function extractArtifactMarker(content: string, marker: string): string | null {
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(
    new RegExp(`^\\s*\\*\\*${escapedMarker}:?\\*\\*\\s*:?\\s*(.+?)\\s*$`, "im")
  );

  return match?.[1]?.trim() ?? null;
}

function isCompletedReviewFixArtifact(content: string): boolean {
  const status = extractArtifactMarker(content, "Status")?.toUpperCase() ?? null;
  const completionState =
    extractArtifactMarker(content, "Completion State")?.toLowerCase() ?? null;

  return status === "COMPLETED" && completionState === "complete";
}

function extractCommandName(action: string): string | null {
  const match = action.match(/\/blu-([a-z0-9-]+)/i);

  return match?.[1] ?? null;
}

function isImplementedCommand(commandNames: Set<string>, commandName: string): boolean {
  return commandNames.has(commandName) || commandNames.has(`/blu-${commandName}`);
}

function isStaleSecurePhaseAction(args: {
  commandName: string | null;
  missingGate: PhaseQualityGateMissingGate;
  hasSecurity: boolean;
}): boolean {
  return args.commandName === "secure-phase" && args.hasSecurity && args.missingGate !== "security";
}

function normalizeReviewNextSafeAction(args: {
  action: string | null;
  missingGate: PhaseQualityGateMissingGate;
  hasSecurity: boolean;
}): string | null {
  if (args.action === null) {
    return null;
  }

  const commandName = extractCommandName(args.action);

  if (
    isStaleSecurePhaseAction({
      commandName,
      missingGate: args.missingGate,
      hasSecurity: args.hasSecurity
    })
  ) {
    return null;
  }

  return args.action;
}

function isBlockingReviewNextSafeAction(args: {
  action: string | null;
  missingGate: PhaseQualityGateMissingGate;
  hasSecurity: boolean;
}): boolean {
  if (args.action === null) {
    return false;
  }

  const commandName = extractCommandName(args.action);

  return (
    commandName !== null &&
    commandName !== "progress" &&
    !isStaleSecurePhaseAction({
      commandName,
      missingGate: args.missingGate,
      hasSecurity: args.hasSecurity
    })
  );
}

function isReviewableConfigPath(relativePath: string): boolean {
  const basename = path.posix.basename(relativePath);

  if (REVIEWABLE_FILENAMES.has(basename)) {
    return true;
  }

  return (
    /^.+\.config\.(?:ts|tsx|js|jsx|mjs|cjs)$/u.test(basename) ||
    /^.+rc\.(?:json|js|mjs|cjs)$/u.test(basename)
  );
}

export function isReviewableRepoFile(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\.\//, "");

  if (
    normalized.length === 0 ||
    normalized.startsWith(`${BLUEPRINT_DIR}/`) ||
    normalized.startsWith("dist/")
  ) {
    return false;
  }

  const extension = path.posix.extname(normalized);

  if (extension === ".md") {
    return false;
  }

  return (
    REVIEWABLE_EXTENSIONS.has(extension) ||
    isReviewableConfigPath(normalized) ||
    (REVIEWABLE_ROOT_PREFIXES.some((prefix) => normalized.startsWith(prefix)) &&
      extension.length > 0)
  );
}

async function resolveCodeReviewEnabled(projectRoot: string): Promise<{
  enabled: boolean;
  warnings: string[];
}> {
  try {
    const config = await blueprintConfigGet({
      scope: "effective",
      cwd: projectRoot
    });

    return {
      enabled: config.config.workflow.code_review,
      warnings: [...config.warnings]
    };
  } catch {
    return {
      enabled: true,
      warnings: [
        "Blueprint quality-gate config could not be read; defaulting workflow.code_review to true."
      ]
    };
  }
}

async function collectPlanDerivedFiles(args: {
  projectRoot: string;
  phaseNumber: string;
  phasePrefix: string;
  artifacts: NormalizedArtifact[];
  completedSummaryIds: Set<string>;
  warnings: string[];
}): Promise<string[]> {
  const files = new Set<string>();
  const planArtifacts = args.artifacts.filter((artifact) => {
    const planId = parsePlanIdForSuffix(artifact.path, args.phasePrefix, "PLAN");
    return planId !== null && args.completedSummaryIds.has(planId);
  });

  for (const planArtifact of planArtifacts) {
    const content = await readArtifactContent({
      projectRoot: args.projectRoot,
      artifact: planArtifact
    });

    if (content === null) {
      args.warnings.push(`Skipped unreadable quality-gate plan artifact: ${planArtifact.path}`);
      continue;
    }

    const validation = validatePlanArtifactContent(content, args.phaseNumber);

    if (!validation.valid) {
      args.warnings.push(
        `${planArtifact.path}: ${validation.issues.join(" ")}`
      );
    }

    const resolved = await resolveExistingRepoFiles({
      projectRoot: args.projectRoot,
      candidates: validation.metadata.filesModified,
      source: planArtifact.path
    });

    for (const file of resolved.files) {
      files.add(file);
    }

    args.warnings.push(...resolved.warnings);
  }

  return [...files].sort((left, right) => left.localeCompare(right));
}

async function collectSummaryDerivedFiles(args: {
  projectRoot: string;
  summaries: NormalizedArtifact[];
  warnings: string[];
}): Promise<string[]> {
  const files = new Set<string>();

  for (const summary of args.summaries) {
    const content = await readArtifactContent({
      projectRoot: args.projectRoot,
      artifact: summary
    });

    if (content === null) {
      args.warnings.push(`Skipped unreadable quality-gate summary artifact: ${summary.path}`);
      continue;
    }

    const changesMade = extractMarkdownSection(content, "Changes Made");
    const resolved = await resolveExistingRepoFiles({
      projectRoot: args.projectRoot,
      candidates: extractPathCandidatesFromSection(changesMade),
      source: `${summary.path} Changes Made`
    });

    for (const file of resolved.files) {
      files.add(file);
    }

    args.warnings.push(...resolved.warnings);
  }

  return [...files].sort((left, right) => left.localeCompare(right));
}

async function collectCompletedSummaries(args: {
  projectRoot: string;
  phasePrefix: string;
  artifacts: NormalizedArtifact[];
  warnings: string[];
}): Promise<{
  summaries: NormalizedArtifact[];
  summaryIds: Set<string>;
}> {
  const summaries: NormalizedArtifact[] = [];
  const summaryIds = new Set<string>();

  for (const artifact of args.artifacts) {
    const planId = parsePlanIdForSuffix(artifact.path, args.phasePrefix, "SUMMARY");

    if (planId === null) {
      continue;
    }

    const content = await readArtifactContent({
      projectRoot: args.projectRoot,
      artifact
    });

    if (content === null) {
      args.warnings.push(`Skipped unreadable quality-gate summary artifact: ${artifact.path}`);
      continue;
    }

    if (extractSummaryStatus(content) !== "COMPLETED") {
      continue;
    }

    summaries.push(artifact);
    summaryIds.add(planId);
  }

  return { summaries, summaryIds };
}

async function readReviewNextSafeAction(args: {
  projectRoot: string;
  reviewPath: string | null;
  artifacts: NormalizedArtifact[];
  warnings: string[];
}): Promise<string | null> {
  if (args.reviewPath === null) {
    return null;
  }

  const reviewArtifact =
    args.artifacts.find((artifact) => artifact.path === args.reviewPath) ??
    ({
      path: args.reviewPath,
      kind: "review"
    } satisfies NormalizedArtifact);
  const content = await readArtifactContent({
    projectRoot: args.projectRoot,
    artifact: reviewArtifact
  });

  if (content === null) {
    args.warnings.push(`${args.reviewPath}: could not read Review artifact Next Safe Action.`);
    return null;
  }

  const nextSafeAction = extractReviewFixNextSafeAction(content);

  if (nextSafeAction === null) {
    args.warnings.push(
      `${args.reviewPath}: Next Safe Action does not contain a Blueprint command; quality-gate routing will use derived state.`
    );
  }

  return nextSafeAction;
}

async function readCompletedReviewFixNextSafeAction(args: {
  projectRoot: string;
  reviewFixPath: string | null;
  artifacts: NormalizedArtifact[];
  warnings: string[];
}): Promise<{
  completed: boolean;
  nextSafeAction: string | null;
}> {
  if (args.reviewFixPath === null) {
    return {
      completed: false,
      nextSafeAction: null
    };
  }

  const reviewFixArtifact =
    args.artifacts.find((artifact) => artifact.path === args.reviewFixPath) ??
    ({
      path: args.reviewFixPath,
      kind: "review-fix"
    } satisfies NormalizedArtifact);
  const content = await readArtifactContent({
    projectRoot: args.projectRoot,
    artifact: reviewFixArtifact
  });

  if (content === null) {
    args.warnings.push(
      `${args.reviewFixPath}: could not read Review Fix artifact Next Safe Action.`
    );
    return {
      completed: false,
      nextSafeAction: null
    };
  }

  if (!isCompletedReviewFixArtifact(content)) {
    return {
      completed: false,
      nextSafeAction: null
    };
  }

  const nextSafeAction = extractReviewNextSafeAction(content);

  if (nextSafeAction === null) {
    args.warnings.push(
      `${args.reviewFixPath}: completed Review Fix artifact Next Safe Action does not contain a Blueprint command; quality-gate routing will use derived state.`
    );
  }

  return {
    completed: true,
    nextSafeAction
  };
}

export async function evaluatePhaseQualityGates(
  args: PhaseQualityGateEvaluationArgs
): Promise<PhaseQualityGateEvaluation> {
  const projectRoot = await ensureRepoRoot(args.projectRoot);
  const phaseNumber = normalizeBlueprintPhaseRef(args.phaseNumber);
  const phasePrefix = normalizePhasePrefix({ ...args, phaseNumber });
  const phaseRoot = normalizePhaseRoot(args.phaseDir);
  const warnings: string[] = [];
  const providedArtifacts = normalizeArtifactCollection(args.artifacts);
  const artifacts = await listPhaseArtifacts({
    projectRoot,
    phaseRoot,
    providedArtifacts,
    warnings
  });
  const reviewPath = findArtifactPath({
    artifacts,
    phaseRoot,
    phasePrefix,
    suffix: "-REVIEW.md",
    kind: "review"
  });
  const reviewFixPath = findArtifactPath({
    artifacts,
    phaseRoot,
    phasePrefix,
    suffix: "-REVIEW-FIX.md",
    kind: "review-fix"
  });
  const securityPath = findArtifactPath({
    artifacts,
    phaseRoot,
    phasePrefix,
    suffix: "-SECURITY.md",
    kind: "security"
  });
  const [reviewExists, reviewFixExists, securityExists, reviewSettings] = await Promise.all([
    artifactExists(projectRoot, reviewPath),
    artifactExists(projectRoot, reviewFixPath),
    artifactExists(projectRoot, securityPath),
    resolveCodeReviewEnabled(projectRoot)
  ]);
  const hasReview = reviewExists || artifactDeclared(artifacts, reviewPath);
  const hasReviewFix = reviewFixExists || artifactDeclared(artifacts, reviewFixPath);
  const hasSecurity = securityExists || artifactDeclared(artifacts, securityPath);
  warnings.push(...reviewSettings.warnings);

  const completedSummaries = await collectCompletedSummaries({
    projectRoot,
    phasePrefix,
    artifacts,
    warnings
  });
  const planDerivedFiles = await collectPlanDerivedFiles({
    projectRoot,
    phaseNumber,
    phasePrefix,
    artifacts,
    completedSummaryIds: completedSummaries.summaryIds,
    warnings
  });
  const summaryDerivedFiles = await collectSummaryDerivedFiles({
    projectRoot,
    summaries: completedSummaries.summaries,
    warnings
  });
  const evidenceFiles = [...new Set([...planDerivedFiles, ...summaryDerivedFiles])].sort(
    (left, right) => left.localeCompare(right)
  );
  const reviewableFiles = evidenceFiles
    .filter(isReviewableRepoFile)
    .sort((left, right) => left.localeCompare(right));
  const requiresCodeReview = reviewSettings.enabled && reviewableFiles.length > 0;
  const missingGate: PhaseQualityGateMissingGate =
    requiresCodeReview && !hasReview
      ? "review"
      : requiresCodeReview && hasReview && !hasSecurity
        ? "security"
        : null;
  const reviewFixNextSafeAction = hasReviewFix
    ? await readCompletedReviewFixNextSafeAction({
        projectRoot,
        reviewFixPath,
        artifacts,
        warnings
      })
    : {
        completed: false,
        nextSafeAction: null
      };
  const rawReviewNextSafeAction = reviewFixNextSafeAction.completed
    ? reviewFixNextSafeAction.nextSafeAction
    : hasReview
      ? await readReviewNextSafeAction({
          projectRoot,
          reviewPath,
          artifacts,
          warnings
        })
      : null;
  const reviewNextSafeAction = normalizeReviewNextSafeAction({
    action: rawReviewNextSafeAction,
    missingGate,
    hasSecurity
  });
  const hasBlockingReviewFollowUp = isBlockingReviewNextSafeAction({
    action: reviewNextSafeAction,
    missingGate,
    hasSecurity
  });

  return {
    reviewPath: hasReview ? reviewPath : null,
    securityPath: hasSecurity ? securityPath : null,
    hasReview,
    hasSecurity,
    reviewableFiles,
    codeReviewEnabled: reviewSettings.enabled,
    requiresCodeReview,
    gatesSatisfied: missingGate === null && !hasBlockingReviewFollowUp,
    missingGate,
    warnings,
    reviewNextSafeAction
  };
}

export function buildPhaseQualityGateNextAction(
  args: PhaseQualityGateRoutingArgs
): string | null {
  const phaseNumber = normalizeBlueprintPhaseRef(args.phaseNumber);

  if (
    args.evaluation.requiresCodeReview &&
    args.evaluation.missingGate === "review" &&
    isImplementedCommand(args.implementedCommandNames, "code-review")
  ) {
    return `Run /blu-code-review ${phaseNumber} to satisfy the phase code review gate.`;
  }

  if (
    args.evaluation.requiresCodeReview &&
    args.evaluation.missingGate === "security" &&
    isImplementedCommand(args.implementedCommandNames, "secure-phase")
  ) {
    return `Run /blu-secure-phase ${phaseNumber} to satisfy the phase security gate.`;
  }

  const reviewNextSafeAction = args.evaluation.reviewNextSafeAction;

  if (reviewNextSafeAction) {
    const commandName = extractCommandName(reviewNextSafeAction);

    if (
      commandName !== null &&
      commandName !== "progress" &&
      !isStaleSecurePhaseAction({
        commandName,
        missingGate: args.evaluation.missingGate,
        hasSecurity: args.evaluation.hasSecurity
      }) &&
      isImplementedCommand(args.implementedCommandNames, commandName)
    ) {
      return `Run ${reviewNextSafeAction}.`;
    }
  }

  if (args.evaluation.gatesSatisfied || !args.evaluation.requiresCodeReview) {
    return null;
  }

  return null;
}
