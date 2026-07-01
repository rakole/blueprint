import fs from "node:fs/promises";
import path from "node:path";

import {
  BLUEPRINT_DIR,
  ensureRepoRoot,
  extractMarkdownTableRows,
  extractSummaryStatus,
  readUatArtifactState,
  resolveBlueprintPath,
  resolveRepoRelativePath,
  toRepoRelativePath,
  validatePlanArtifactContent,
  validateUatArtifactContent
} from "./artifacts.js";
import { blueprintConfigGet } from "./config.js";
import {
  formatBlueprintPhasePrefix,
  normalizeBlueprintPhaseRef
} from "../../shared/security.js";
import { isObviouslyNonPathMarkupToken } from "./path-token-heuristics.js";

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
  securePhaseEnabled: boolean;
  requiresCodeReview: boolean;
  requiresSecurePhase: boolean;
  requiresQualityGate: boolean;
  gatesSatisfied: boolean;
  missingGate: PhaseQualityGateMissingGate;
  warnings: string[];
  reviewNextSafeAction: string | null;
  reviewDebtKind: "remediation" | "follow-up" | null;
  securityNextSafeAction: string | null;
  securityDebtKind: "incomplete" | "blocked" | null;
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
    | "reviewDebtKind"
    | "securityNextSafeAction"
    | "securityDebtKind"
  > &
    Partial<Pick<PhaseQualityGateEvaluation, "requiresQualityGate" | "requiresSecurePhase">>;
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

type ReviewArtifactRoutingState = {
  verdict: "PASS" | "FOLLOW_UP" | "BLOCKED" | null;
  nextSafeAction: string | null;
};

type ReviewFixArtifactStatus = "COMPLETED" | "PARTIAL" | "BLOCKED";

type ReviewFixArtifactRoutingState = {
  status: ReviewFixArtifactStatus | null;
  nextSafeAction: string | null;
  usesLatestReviewFixState: boolean;
  usableRoutingAction: boolean;
  leavesRemediationDebt: boolean;
};

type SecurityArtifactStatus = "COMPLETED" | "PARTIAL" | "BLOCKED" | "INCOMPLETE";

type SecurityArtifactRoutingState = {
  status: SecurityArtifactStatus | null;
  completionState: string | null;
  nextSafeAction: string | null;
  gateSatisfied: boolean;
  debtKind: "incomplete" | "blocked" | null;
};

type SecurityUatRoutingState = {
  hasCompleteUat: boolean;
  hasBlockingUat: boolean;
  blockingNextSafeAction: string | null;
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
const VISIBLE_REVIEW_TARGET_ID_PATTERN = /`?((?:F|FU)-[A-Z0-9][A-Z0-9._-]*)`?/i;
const CANONICAL_CODE_REVIEW_FINDING_PATTERN =
  /^\[(critical|high|medium|low|unknown)\]\[(follow-up|observation|blocked|accepted-risk)\]\s+`([^`]+)`\s+`([^`]+)`\s*-\s*Evidence:\s*(.+?)\s+Impact:\s*(.+?)\s+Fix\/verification:\s*(.+)$/i;

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

function findPhaseArtifactPath(args: {
  artifacts: NormalizedArtifact[];
  phaseRoot: string | null;
  phasePrefix: string;
  suffix: "-VERIFICATION.md" | "-UAT.md";
}): string | null {
  return (
    args.artifacts.find(
      (artifact) =>
        artifact.path === `${args.phasePrefix}${args.suffix}` ||
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
    if (isObviouslyNonPathMarkupToken(rawCandidate)) {
      continue;
    }

    const candidate = normalizeRepoPathCandidate(rawCandidate);

    if (
      candidate.length === 0 ||
      /^https?:\/\//i.test(candidate) ||
      isObviouslyNonPathMarkupToken(rawCandidate, candidate)
    ) {
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

function collectListItems(block: string): string[] {
  return block
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

function extractMarkdownSectionItems(content: string, heading: string): string[] {
  return [...new Set(collectListItems(extractMarkdownSection(content, heading)))];
}

function extractPathCandidatesFromSection(section: string): string[] {
  const candidates = new Set<string>();

  for (const match of section.matchAll(/`([^`]+)`/g)) {
    const value = match[1]?.trim();

    if (value && !isObviouslyNonPathMarkupToken(value)) {
      candidates.add(value);
    }
  }

  for (const match of section.matchAll(PATH_TOKEN_PATTERN)) {
    const candidate = match[0];

    if (!isObviouslyNonPathMarkupToken(candidate)) {
      candidates.add(candidate);
    }
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

function extractReviewVerdict(content: string): "PASS" | "FOLLOW_UP" | "BLOCKED" | null {
  const verdict = extractArtifactMarker(content, "Verdict")?.toUpperCase() ?? null;

  if (verdict === "PASS" || verdict === "FOLLOW_UP" || verdict === "BLOCKED") {
    return verdict;
  }

  return null;
}

function extractReviewFixNextSafeAction(content: string): string | null {
  const sectionAction = extractReviewNextSafeAction(content);

  if (sectionAction !== null) {
    return sectionAction;
  }

  const markerAction = extractArtifactMarker(content, "Next Safe Action");

  return markerAction ? extractBlueprintCommand(markerAction) : null;
}

function extractReviewFixStatus(content: string): ReviewFixArtifactStatus | null {
  const status = extractArtifactMarker(content, "Status")?.toUpperCase() ?? null;

  if (
    status === "COMPLETED" ||
    status === "PARTIAL" ||
    status === "BLOCKED"
  ) {
    return status;
  }

  return null;
}

function extractSecurityStatus(content: string): SecurityArtifactStatus | null {
  const status = extractArtifactMarker(content, "Status")?.toUpperCase() ?? null;

  if (
    status === "COMPLETED" ||
    status === "PARTIAL" ||
    status === "BLOCKED" ||
    status === "INCOMPLETE"
  ) {
    return status;
  }

  return null;
}

function extractLabeledLineValue(content: string, label: string): string | null {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(
    new RegExp(`^\\s*(?:[-*]\\s*)?${escapedLabel}:\\s*(.+?)\\s*$`, "im")
  );

  return match?.[1]?.trim() ?? null;
}

function extractAnyLabeledLineValue(content: string, labels: string[]): string | null {
  for (const label of labels) {
    const value = extractLabeledLineValue(content, label);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function normalizeSecuritySignal(value: string): string {
  return value
    .replace(/`/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
}

function isClosedSecuritySignal(value: string): boolean {
  const normalized = normalizeSecuritySignal(value);

  return (
    normalized.length === 0 ||
    normalized === "none" ||
    normalized === "n/a" ||
    normalized === "na" ||
    normalized === "closed" ||
    normalized === "resolved" ||
    normalized === "verified" ||
    normalized === "accepted" ||
    normalized === "complete" ||
    normalized === "completed" ||
    normalized === "pass" ||
    normalized === "passed"
  );
}

function isBlockingSecuritySignal(value: string): boolean {
  const normalized = normalizeSecuritySignal(value);

  if (isClosedSecuritySignal(normalized)) {
    return false;
  }

  return /\b(?:open|still-open|blocked|blocking|pending|fail|failed|failing)\b/i.test(
    normalized
  );
}

function tableHasBlockingSecurityStatus(args: {
  content: string;
  heading: string;
}): boolean {
  const rows = extractMarkdownTableRows(extractMarkdownSection(args.content, args.heading));
  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeSecuritySignal(cell) === "status")
  );

  if (headerRowIndex === -1) {
    return false;
  }

  const headerRow = rows[headerRowIndex] ?? [];
  const statusColumn = headerRow.findIndex(
    (cell) => normalizeSecuritySignal(cell) === "status"
  );

  if (statusColumn === -1) {
    return false;
  }

  return rows
    .slice(headerRowIndex + 1)
    .some((row) => isBlockingSecuritySignal(row[statusColumn]?.trim() ?? ""));
}

function hasBlockingSecurityState(content: string, nextSafeAction: string | null): boolean {
  const pendingOpenThreatStatus = extractAnyLabeledLineValue(content, [
    "Pending-open-threat status",
    "Pending open threat status"
  ]);

  if (
    pendingOpenThreatStatus !== null &&
    isBlockingSecuritySignal(pendingOpenThreatStatus)
  ) {
    return true;
  }

  if (
    nextSafeAction !== null &&
    /\b(?:blocked|pending-open-threat|still-open)\b/i.test(nextSafeAction)
  ) {
    return true;
  }

  return (
    tableHasBlockingSecurityStatus({
      content,
      heading: "Threat Register"
    }) ||
    tableHasBlockingSecurityStatus({
      content,
      heading: "Findings"
    })
  );
}

function extractNextSafeActionText(content: string): string | null {
  const section = extractMarkdownSection(content, "Next Safe Action");

  return (
    section
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*+]\s+/, "").trim())
      .find((line) => line.length > 0) ??
    extractArtifactMarker(content, "Next Safe Action")
  );
}

function extractVisibleReviewTargetId(value: string): string | null {
  const trimmed = value.trim();
  const startMatch = trimmed.match(
    /^`?((?:F|FU)-[A-Z0-9][A-Z0-9._-]*)`?(?:\s*[-:]\s*|\s+)/i
  );

  if (startMatch) {
    return startMatch[1].toUpperCase();
  }

  const inlineMatch = trimmed.match(VISIBLE_REVIEW_TARGET_ID_PATTERN);

  return inlineMatch ? inlineMatch[1].toUpperCase() : null;
}

function stripVisibleReviewTargetId(value: string): string {
  return value
    .replace(/^`?((?:F|FU)-[A-Z0-9][A-Z0-9._-]*)`?(?:\s*[-:]\s*|\s+)/i, "")
    .trim();
}

function normalizeReviewListItem(item: string): string {
  return stripVisibleReviewTargetId(item)
    .replace(/^`+|`+$/g, "")
    .replace(/^[\s"'“”‘’()[\]{}<>]+|[\s"'“”‘’()[\]{}<>.,;:!?]+$/g, "")
    .trim()
    .toLowerCase();
}

function classifyReviewFixTargetSummary(
  summary: string
): "fixable" | "test-gap" | "validation-only" | "routing-note" | "no-op" {
  const normalized = normalizeReviewListItem(summary);

  if (normalized.length === 0) {
    return "no-op";
  }

  if (
    /(?:^|\b)(?:add|missing|gap|coverage)(?:\s+(?:a|an))?\s+(?:unit |integration |regression |smoke )?tests?\b/i.test(summary) ||
    /\b(?:test gap|missing test|assertion gap|coverage gap)\b/i.test(summary) ||
    /\/blu-add-tests\b/i.test(summary)
  ) {
    return "test-gap";
  }

  if (
    /\b(?:verify|verification|validate|validation|uat|manual qa|smoke check|re-run)\b/i.test(summary) ||
    /\/blu-(?:validate-phase|verify-work)\b/i.test(summary)
  ) {
    return "validation-only";
  }

  if (
    /\/blu-(?:progress|secure-phase|plan-phase|review|execute-phase|pause-work|resume-work)\b/i.test(summary) ||
    /\b(?:route|routing|document|triage|coordinate|handoff|process note)\b/i.test(summary)
  ) {
    return "routing-note";
  }

  if (/\b(?:no action|no change|already covered|informational only)\b/i.test(summary)) {
    return "no-op";
  }

  return "fixable";
}

function extractReviewFindingSummary(item: string): string {
  const canonical = item.match(CANONICAL_CODE_REVIEW_FINDING_PATTERN);

  if (canonical) {
    return canonical[7]?.trim() ?? "";
  }

  const recommendationMatch = item.match(/Fix\/verification:\s*(.+)$/i);

  return recommendationMatch?.[1]?.trim() ?? stripVisibleReviewTargetId(item);
}

function parseExplicitActionableReviewTargetIds(content: string): string[] {
  const actionableTargetIds = new Set<string>();

  for (const item of extractMarkdownSectionItems(content, "Findings")) {
    const targetId = extractVisibleReviewTargetId(item);

    if (targetId === null || !/\[follow-up\]/i.test(item)) {
      continue;
    }

    if (classifyReviewFixTargetSummary(extractReviewFindingSummary(item)) === "fixable") {
      actionableTargetIds.add(targetId);
    }
  }

  for (const item of extractMarkdownSectionItems(content, "Follow-Ups")) {
    const targetId = extractVisibleReviewTargetId(item);

    if (
      targetId !== null &&
      classifyReviewFixTargetSummary(stripVisibleReviewTargetId(item)) === "fixable"
    ) {
      actionableTargetIds.add(targetId);
    }
  }

  return [...actionableTargetIds];
}

function parseExplicitReviewFixAddressedIds(content: string): string[] {
  const addressedTargetIds = new Set<string>();

  for (const item of extractMarkdownSectionItems(content, "Findings Addressed")) {
    const targetId = extractVisibleReviewTargetId(item);

    if (targetId !== null) {
      addressedTargetIds.add(targetId);
    }
  }

  return [...addressedTargetIds];
}

function extractArtifactMarker(content: string, marker: string): string | null {
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(
    new RegExp(`^\\s*\\*\\*${escapedMarker}:?\\*\\*\\s*:?\\s*(.+?)\\s*$`, "im")
  );

  return match?.[1]?.trim() ?? null;
}

function hasLegalReviewFixStatusPair(args: {
  status: ReviewFixArtifactStatus;
  completionState: string | null;
}): boolean {
  return (
    (args.status === "COMPLETED" && args.completionState === "complete") ||
    (args.status === "PARTIAL" && args.completionState === "pending") ||
    (args.status === "BLOCKED" && args.completionState === "blocked")
  );
}

function isLegalReviewFixNextSafeAction(args: {
  status: ReviewFixArtifactStatus;
  nextSafeAction: string | null;
  phaseNumber: string;
}): boolean {
  switch (args.status) {
    case "COMPLETED":
      return args.nextSafeAction === `/blu-validate-phase ${args.phaseNumber}`;
    case "PARTIAL":
      return (
        args.nextSafeAction === `/blu-code-review-fix ${args.phaseNumber}` ||
        args.nextSafeAction === `/blu-add-tests ${args.phaseNumber}` ||
        args.nextSafeAction === `/blu-execute-phase ${args.phaseNumber}`
      );
    case "BLOCKED":
      return (
        args.nextSafeAction === "/blu-progress" ||
        args.nextSafeAction === `/blu-execute-phase ${args.phaseNumber}`
      );
  }
}

function isLegalCompletedSecurityNextSafeAction(args: {
  nextSafeAction: string | null;
  phaseNumber: string;
  hasVerification: boolean;
  uatRequired: boolean;
  uatRoutingState: SecurityUatRoutingState;
}): boolean {
  if (args.nextSafeAction === `/blu-validate-phase ${args.phaseNumber}`) {
    return !args.hasVerification;
  }

  if (args.nextSafeAction === `/blu-verify-work ${args.phaseNumber}`) {
    return (
      args.hasVerification &&
      (args.uatRoutingState.hasBlockingUat ||
        (args.uatRequired && !args.uatRoutingState.hasCompleteUat))
    );
  }

  if (args.nextSafeAction === "/blu-progress") {
    return (
      args.hasVerification &&
      !args.uatRoutingState.hasBlockingUat &&
      (!args.uatRequired || args.uatRoutingState.hasCompleteUat)
    );
  }

  return false;
}

function isLegalPartialSecurityNextSafeAction(args: {
  nextSafeAction: string | null;
  uatRoutingState: SecurityUatRoutingState;
}): boolean {
  if (args.uatRoutingState.hasBlockingUat) {
    return (
      args.nextSafeAction !== null &&
      args.uatRoutingState.blockingNextSafeAction !== null &&
      args.nextSafeAction === args.uatRoutingState.blockingNextSafeAction
    );
  }

  return args.nextSafeAction === "/blu-progress";
}

function normalizeSecurityNextSafeActionText(value: string | null): string | null {
  return value?.replace(/`/g, "").trim().replace(/\s+/g, " ") ?? null;
}

function isLegalBlockedSecurityNextSafeAction(nextSafeActionText: string | null): boolean {
  return normalizeSecurityNextSafeActionText(nextSafeActionText) === "Blocked: pending-open-threat";
}

function parseReviewFixRoutingState(args: {
  content: string;
  phaseNumber: string;
}): ReviewFixArtifactRoutingState {
  const status = extractReviewFixStatus(args.content);
  const completionState =
    extractArtifactMarker(args.content, "Completion State")?.toLowerCase() ?? null;

  if (status === null || !hasLegalReviewFixStatusPair({ status, completionState })) {
    return {
      status,
      nextSafeAction: extractReviewFixNextSafeAction(args.content),
      usesLatestReviewFixState: false,
      usableRoutingAction: false,
      leavesRemediationDebt: false
    };
  }

  const nextSafeAction = extractReviewFixNextSafeAction(args.content);
  const legalNextSafeAction = isLegalReviewFixNextSafeAction({
    status,
    nextSafeAction,
    phaseNumber: args.phaseNumber
  });

  return {
    status,
    nextSafeAction,
    usesLatestReviewFixState: true,
    usableRoutingAction:
      legalNextSafeAction &&
      !(status === "BLOCKED" && nextSafeAction === "/blu-progress"),
    leavesRemediationDebt: status !== "COMPLETED"
  };
}

async function reconcileCompletedReviewFixDebt(args: {
  projectRoot: string;
  reviewPath: string | null;
  reviewFixPath: string;
  reviewFixContent: string;
  artifacts: NormalizedArtifact[];
  warnings: string[];
}): Promise<boolean | null> {
  const addressedTargetIds = parseExplicitReviewFixAddressedIds(args.reviewFixContent);

  if (args.reviewPath === null) {
    if (addressedTargetIds.length === 0) {
      args.warnings.push(
        `${args.reviewFixPath}: latest completed Review Fix artifact lacks explicit parseable addressed ids in Findings Addressed, but no source Review artifact is available; quality-gate routing will keep legacy debt-clearing behavior.`
      );
    }

    return null;
  }

  const reviewArtifact =
    args.artifacts.find((artifact) => artifact.path === args.reviewPath) ??
    ({
      path: args.reviewPath,
      kind: "review"
    } satisfies NormalizedArtifact);
  const reviewContent = await readArtifactContent({
    projectRoot: args.projectRoot,
    artifact: reviewArtifact
  });

  if (reviewContent === null) {
    if (addressedTargetIds.length === 0) {
      args.warnings.push(
        `${args.reviewFixPath}: latest completed Review Fix artifact lacks explicit parseable addressed ids in Findings Addressed, but the source Review artifact could not be read; quality-gate routing will keep legacy debt-clearing behavior.`
      );
    }

    return null;
  }

  const actionableTargetIds = parseExplicitActionableReviewTargetIds(reviewContent);

  if (actionableTargetIds.length === 0) {
    if (addressedTargetIds.length === 0) {
      args.warnings.push(
        `${args.reviewFixPath}: latest completed Review Fix artifact lacks explicit parseable addressed ids in Findings Addressed, but the source Review artifact has no parseable actionable target ids; quality-gate routing will keep legacy debt-clearing behavior.`
      );
    }

    return null;
  }

  if (addressedTargetIds.length === 0) {
    args.warnings.push(
      `${args.reviewFixPath}: latest completed Review Fix artifact lacks explicit parseable addressed ids in Findings Addressed while the source Review artifact has ${actionableTargetIds.length} actionable saved review target id(s); quality-gate routing will keep remediation debt open. Missing: ${actionableTargetIds.join(", ")}.`
    );
    return false;
  }

  const addressedTargetIdSet = new Set(addressedTargetIds);
  const missingTargetIds = actionableTargetIds.filter(
    (targetId) => !addressedTargetIdSet.has(targetId)
  );

  if (missingTargetIds.length === 0) {
    return true;
  }

  const addressedCount = actionableTargetIds.length - missingTargetIds.length;
  args.warnings.push(
    `${args.reviewFixPath}: latest completed Review Fix artifact addressed ${addressedCount} of ${actionableTargetIds.length} actionable saved review target ids; quality-gate routing will keep remediation debt open. Missing: ${missingTargetIds.join(", ")}.`
  );
  return false;
}

function deriveReviewDebtKind(args: {
  requiresCodeReview: boolean;
  reviewFixState: ReviewFixArtifactRoutingState;
  reviewVerdict: "PASS" | "FOLLOW_UP" | "BLOCKED" | null;
  reviewNextSafeAction: string | null;
  missingGate: PhaseQualityGateMissingGate;
  requiresSecurePhase: boolean;
}): "remediation" | "follow-up" | null {
  if (!args.requiresCodeReview) {
    return null;
  }

  if (args.reviewFixState.leavesRemediationDebt) {
    return "remediation";
  }

  if (
    args.reviewFixState.usesLatestReviewFixState &&
    args.reviewFixState.status === "COMPLETED" &&
    args.reviewFixState.usableRoutingAction
  ) {
    return null;
  }

  const reviewFollowUpCommand = savedReviewFollowUpCommandName({
    reviewNextSafeAction: args.reviewNextSafeAction,
    missingGate: args.missingGate,
    requiresSecurePhase: args.requiresSecurePhase
  });

  if (reviewFollowUpCommand === "code-review-fix") {
    return "remediation";
  }

  if (
    reviewFollowUpCommand !== null &&
    (args.reviewVerdict === "FOLLOW_UP" || args.reviewVerdict === "BLOCKED")
  ) {
    return "follow-up";
  }

  return null;
}

function buildReviewDebtFallbackAction(phaseNumber: string): string {
  return `/blu-code-review-fix ${phaseNumber}`;
}

function extractCommandName(action: string): string | null {
  const match = action.match(/\/blu-([a-z0-9-]+)/i);

  return match?.[1] ?? null;
}

function isImplementedCommand(commandNames: Set<string>, commandName: string): boolean {
  return commandNames.has(commandName) || commandNames.has(`/blu-${commandName}`);
}

const NON_REPAIR_ROUTING_COMMANDS = new Set([
  "progress",
  "audit-milestone",
  "complete-milestone",
  "milestone-summary",
  "new-milestone",
  "cleanup",
  "ship",
  "pr-branch",
  "new-workspace",
  "remove-workspace",
  "undo",
  "reapply-patches"
]);

function implementedRepairNextSafeAction(
  action: string | null,
  implementedCommandNames: Set<string>
): string | null {
  if (action === null) {
    return null;
  }

  const commandName = extractCommandName(action);

  if (
    commandName === null ||
    NON_REPAIR_ROUTING_COMMANDS.has(commandName) ||
    !isImplementedCommand(implementedCommandNames, commandName)
  ) {
    return null;
  }

  return action;
}

function isStaleSecurePhaseAction(args: {
  commandName: string | null;
  missingGate: PhaseQualityGateMissingGate;
  requiresSecurePhase: boolean;
  hasSecurity: boolean;
}): boolean {
  return (
    args.commandName === "secure-phase" &&
    (!args.requiresSecurePhase || (args.hasSecurity && args.missingGate !== "security"))
  );
}

function normalizeReviewNextSafeAction(args: {
  action: string | null;
  phaseNumber: string;
  reviewVerdict: "PASS" | "FOLLOW_UP" | "BLOCKED" | null;
  missingGate: PhaseQualityGateMissingGate;
  requiresSecurePhase: boolean;
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
      requiresSecurePhase: args.requiresSecurePhase,
      hasSecurity: args.hasSecurity
    })
  ) {
    if (args.reviewVerdict === "FOLLOW_UP" || args.reviewVerdict === "BLOCKED") {
      return `/blu-code-review-fix ${args.phaseNumber}`;
    }

    return null;
  }

  return args.action;
}

function savedReviewFollowUpCommandName(args: {
  reviewNextSafeAction: string | null;
  missingGate: PhaseQualityGateMissingGate;
  requiresSecurePhase: boolean;
}): string | null {
  if (args.missingGate !== null) {
    return null;
  }

  const commandName = extractCommandName(args.reviewNextSafeAction ?? "");

  if (commandName === null || commandName === "progress") {
    return null;
  }

  if (commandName === "secure-phase" && !args.requiresSecurePhase) {
    return null;
  }

  return commandName;
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

async function resolveQualityGateSettings(projectRoot: string): Promise<{
  codeReviewEnabled: boolean;
  securePhaseEnabled: boolean;
  uatRequired: boolean;
  warnings: string[];
}> {
  try {
    const config = await blueprintConfigGet({
      scope: "effective",
      cwd: projectRoot
    });

    return {
      codeReviewEnabled: config.config.workflow.code_review,
      securePhaseEnabled: config.config.workflow.secure_phase,
      uatRequired: config.config.workflow.no_uat !== true,
      warnings: [...config.warnings]
    };
  } catch {
    return {
      codeReviewEnabled: true,
      securePhaseEnabled: false,
      uatRequired: true,
      warnings: [
        "Blueprint quality-gate config could not be read; defaulting workflow.code_review to true, workflow.secure_phase to false, and workflow.no_uat to false."
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

async function readReviewRoutingState(args: {
  projectRoot: string;
  reviewPath: string | null;
  artifacts: NormalizedArtifact[];
  warnings: string[];
}): Promise<ReviewArtifactRoutingState> {
  if (args.reviewPath === null) {
    return {
      verdict: null,
      nextSafeAction: null
    };
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
    return {
      verdict: null,
      nextSafeAction: null
    };
  }

  const nextSafeAction = extractReviewFixNextSafeAction(content);
  const verdict = extractReviewVerdict(content);

  if (nextSafeAction === null) {
    args.warnings.push(
      `${args.reviewPath}: Next Safe Action does not contain a Blueprint command; quality-gate routing will use derived state.`
    );
  }

  return {
    verdict,
    nextSafeAction
  };
}

async function readUsableReviewFixNextSafeAction(args: {
  projectRoot: string;
  reviewPath: string | null;
  reviewFixPath: string | null;
  artifacts: NormalizedArtifact[];
  warnings: string[];
  phaseNumber: string;
}): Promise<ReviewFixArtifactRoutingState> {
  if (args.reviewFixPath === null) {
    return {
      status: null,
      nextSafeAction: null,
      usesLatestReviewFixState: false,
      usableRoutingAction: false,
      leavesRemediationDebt: false
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
      status: null,
      nextSafeAction: null,
      usesLatestReviewFixState: false,
      usableRoutingAction: false,
      leavesRemediationDebt: false
    };
  }

  const routingState = parseReviewFixRoutingState({
    content,
    phaseNumber: args.phaseNumber
  });

  if (!routingState.usesLatestReviewFixState) {
    return routingState;
  }

  if (routingState.nextSafeAction === null) {
    args.warnings.push(
      `${args.reviewFixPath}: latest Review Fix artifact Next Safe Action does not contain a Blueprint command; quality-gate routing will keep the newest remediation state and use debt-aware fallback routing.`
    );
    return routingState;
  }

  if (routingState.status === null) {
    return routingState;
  }

  if (
    !isLegalReviewFixNextSafeAction({
      status: routingState.status,
      nextSafeAction: routingState.nextSafeAction,
      phaseNumber: args.phaseNumber
    })
  ) {
    args.warnings.push(
      `${args.reviewFixPath}: latest ${routingState.status} Review Fix artifact Next Safe Action is not a legal review-fix route; quality-gate routing will keep the newest remediation state and use debt-aware fallback routing.`
    );
    return routingState;
  }

  if (routingState.status === "COMPLETED" && routingState.usableRoutingAction) {
    const clearsSavedDebt = await reconcileCompletedReviewFixDebt({
      projectRoot: args.projectRoot,
      reviewPath: args.reviewPath,
      reviewFixPath: args.reviewFixPath,
      reviewFixContent: content,
      artifacts: args.artifacts,
      warnings: args.warnings
    });

    if (clearsSavedDebt === false) {
      return {
        ...routingState,
        usableRoutingAction: false,
        leavesRemediationDebt: true
      };
    }
  }

  if (!routingState.usableRoutingAction) {
    args.warnings.push(
      `${args.reviewFixPath}: latest ${routingState.status} Review Fix artifact keeps saved remediation debt open; quality-gate routing will not treat ${routingState.nextSafeAction} as debt-clearing.`
    );
  }

  return routingState;
}

async function readSecurityUatRoutingState(args: {
  projectRoot: string;
  uatPath: string | null;
  artifacts: NormalizedArtifact[];
  summaryPaths: string[];
  warnings: string[];
}): Promise<SecurityUatRoutingState> {
  if (args.uatPath === null) {
    return {
      hasCompleteUat: false,
      hasBlockingUat: false,
      blockingNextSafeAction: null
    };
  }

  const uatArtifact =
    args.artifacts.find((artifact) => artifact.path === args.uatPath) ??
    ({
      path: args.uatPath,
      kind: "other"
    } satisfies NormalizedArtifact);
  const content = await readArtifactContent({
    projectRoot: args.projectRoot,
    artifact: uatArtifact
  });

  if (content === null) {
    args.warnings.push(
      `${args.uatPath}: could not read saved UAT evidence; completed Security routing will require /blu-verify-work before closeout.`
    );

    return {
      hasCompleteUat: false,
      hasBlockingUat: true,
      blockingNextSafeAction: null
    };
  }

  const nextSafeAction = extractReviewFixNextSafeAction(content);

  const validation = validateUatArtifactContent(content, args.summaryPaths, {
    requireReadyVerificationEvidence: true
  });

  if (!validation.valid) {
    args.warnings.push(
      `${args.uatPath}: saved UAT evidence is invalid; completed Security routing will require /blu-verify-work before closeout.`,
      ...validation.issues.map((issue) => `${args.uatPath}: ${issue}`),
      ...validation.warnings.map((warning) => `${args.uatPath}: ${warning}`)
    );

    return {
      hasCompleteUat: false,
      hasBlockingUat: true,
      blockingNextSafeAction: nextSafeAction
    };
  }

  const uatState = readUatArtifactState(content);

  return {
    hasCompleteUat: uatState.complete,
    hasBlockingUat: !uatState.complete,
    blockingNextSafeAction: uatState.complete ? null : nextSafeAction
  };
}

async function readSecurityRoutingState(args: {
  projectRoot: string;
  securityPath: string | null;
  artifacts: NormalizedArtifact[];
  phaseNumber: string;
  hasVerification: boolean;
  uatPath: string | null;
  uatRequired: boolean;
  summaryPaths: string[];
  warnings: string[];
}): Promise<SecurityArtifactRoutingState> {
  if (args.securityPath === null) {
    return {
      status: null,
      completionState: null,
      nextSafeAction: null,
      gateSatisfied: false,
      debtKind: null
    };
  }

  const securityArtifact =
    args.artifacts.find((artifact) => artifact.path === args.securityPath) ??
    ({
      path: args.securityPath,
      kind: "security"
    } satisfies NormalizedArtifact);
  const content = await readArtifactContent({
    projectRoot: args.projectRoot,
    artifact: securityArtifact
  });

  if (content === null) {
    args.warnings.push(
      `${args.securityPath}: could not read Security artifact; quality-gate routing will keep secure-phase debt open.`
    );

    return {
      status: null,
      completionState: null,
      nextSafeAction: null,
      gateSatisfied: false,
      debtKind: "incomplete"
    };
  }

  const status = extractSecurityStatus(content);
  const completionState =
    extractArtifactMarker(content, "Completion State")?.toLowerCase() ?? null;
  const nextSafeAction = extractReviewFixNextSafeAction(content);
  const nextSafeActionText = extractNextSafeActionText(content);
  const hasBlockingState = hasBlockingSecurityState(content, nextSafeActionText);
  const hasCompletedSecurityShape =
    status === "COMPLETED" && completionState === "complete";
  const uatRoutingState = await readSecurityUatRoutingState({
    projectRoot: args.projectRoot,
    uatPath: args.uatPath,
    artifacts: args.artifacts,
    summaryPaths: args.summaryPaths,
    warnings: args.warnings
  });
  const hasLegalCompletedNextSafeAction =
    isLegalCompletedSecurityNextSafeAction({
      nextSafeAction,
      phaseNumber: args.phaseNumber,
      hasVerification: args.hasVerification,
      uatRequired: args.uatRequired,
      uatRoutingState
    });
  const hasLegalPartialNextSafeAction =
    isLegalPartialSecurityNextSafeAction({
      nextSafeAction,
      uatRoutingState
    });
  const hasLegalBlockedNextSafeAction =
    isLegalBlockedSecurityNextSafeAction(nextSafeActionText);
  const hasLegalNextSafeAction =
    status === "COMPLETED"
      ? hasCompletedSecurityShape && hasLegalCompletedNextSafeAction
      : status === "PARTIAL" || status === "INCOMPLETE"
        ? hasLegalPartialNextSafeAction
        : status === "BLOCKED"
          ? hasLegalBlockedNextSafeAction
          : false;

  if (
    hasCompletedSecurityShape &&
    !hasLegalCompletedNextSafeAction
  ) {
    args.warnings.push(
      `${args.securityPath}: completed Security artifact has a missing, illegal, or stale Next Safe Action; quality-gate routing will keep secure-phase debt open.`
    );
  }

  if (
    status !== null &&
    status !== "COMPLETED" &&
    !hasLegalNextSafeAction
  ) {
    args.warnings.push(
      `${args.securityPath}: non-complete Security artifact has a missing, illegal, or stale Next Safe Action; quality-gate routing will keep secure-phase debt open.`
    );
  }

  const gateSatisfied =
    hasCompletedSecurityShape &&
    !hasBlockingState &&
    hasLegalCompletedNextSafeAction;
  const routableNextSafeAction =
    status === "COMPLETED"
      ? hasLegalCompletedNextSafeAction
        ? nextSafeAction
        : null
      : status === "PARTIAL" || status === "INCOMPLETE"
        ? hasLegalPartialNextSafeAction
          ? nextSafeAction
          : null
        : null;

  return {
    status,
    completionState,
    nextSafeAction: routableNextSafeAction,
    gateSatisfied,
    debtKind: gateSatisfied
      ? null
      : hasBlockingState || status === "BLOCKED"
        ? "blocked"
        : "incomplete"
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
  const verificationPath = findPhaseArtifactPath({
    artifacts,
    phaseRoot,
    phasePrefix,
    suffix: "-VERIFICATION.md"
  });
  const uatPath = findPhaseArtifactPath({
    artifacts,
    phaseRoot,
    phasePrefix,
    suffix: "-UAT.md"
  });
  const [
    reviewExists,
    reviewFixExists,
    securityExists,
    verificationExists,
    uatExists,
    qualityGateSettings
  ] = await Promise.all([
    artifactExists(projectRoot, reviewPath),
    artifactExists(projectRoot, reviewFixPath),
    artifactExists(projectRoot, securityPath),
    artifactExists(projectRoot, verificationPath),
    artifactExists(projectRoot, uatPath),
    resolveQualityGateSettings(projectRoot)
  ]);
  const hasReview = reviewExists || artifactDeclared(artifacts, reviewPath);
  const hasReviewFix = reviewFixExists || artifactDeclared(artifacts, reviewFixPath);
  const hasSecurity = securityExists || artifactDeclared(artifacts, securityPath);
  const hasVerification =
    verificationExists || artifactDeclared(artifacts, verificationPath);
  const hasUat = uatExists || artifactDeclared(artifacts, uatPath);
  warnings.push(...qualityGateSettings.warnings);

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
  const requiresCodeReview =
    qualityGateSettings.codeReviewEnabled && reviewableFiles.length > 0;
  const requiresSecurePhase = requiresCodeReview && qualityGateSettings.securePhaseEnabled;
  const requiresQualityGate = requiresCodeReview || requiresSecurePhase;
  const missingGate: PhaseQualityGateMissingGate =
    requiresCodeReview && !hasReview
      ? "review"
      : requiresSecurePhase && hasReview && !hasSecurity
        ? "security"
        : null;
  const securityRoutingState = hasSecurity
    ? await readSecurityRoutingState({
        projectRoot,
        securityPath,
        artifacts,
        phaseNumber,
        hasVerification,
        uatPath: hasUat ? uatPath : null,
        uatRequired: qualityGateSettings.uatRequired,
        summaryPaths: completedSummaries.summaries.map((summary) => summary.path),
        warnings
      })
    : {
        status: null,
        completionState: null,
        nextSafeAction: null,
        gateSatisfied: false,
        debtKind: null
      };
  const reviewFixRoutingState = hasReviewFix
    ? await readUsableReviewFixNextSafeAction({
        projectRoot,
        reviewPath,
        reviewFixPath,
        artifacts,
        warnings,
        phaseNumber
      })
    : {
        status: null,
        nextSafeAction: null,
        usesLatestReviewFixState: false,
        usableRoutingAction: false,
        leavesRemediationDebt: false
      };
  const reviewRoutingState = hasReview
    ? await readReviewRoutingState({
        projectRoot,
        reviewPath,
        artifacts,
        warnings
      })
    : {
        verdict: null,
        nextSafeAction: null
      };
  const rawReviewNextSafeAction = reviewFixRoutingState.usesLatestReviewFixState
    ? reviewFixRoutingState.usableRoutingAction
      ? reviewFixRoutingState.nextSafeAction
      : null
    : reviewRoutingState.nextSafeAction;
  const reviewNextSafeAction = normalizeReviewNextSafeAction({
    action: rawReviewNextSafeAction,
    phaseNumber,
    reviewVerdict: reviewRoutingState.verdict,
    missingGate,
    requiresSecurePhase,
    hasSecurity
  });
  const reviewDebtKind = deriveReviewDebtKind({
    requiresCodeReview,
    reviewFixState: reviewFixRoutingState,
    reviewVerdict: reviewRoutingState.verdict,
    reviewNextSafeAction,
    missingGate,
    requiresSecurePhase
  });
  const securityDebtKind =
    requiresSecurePhase &&
    hasReview &&
    hasSecurity &&
    !securityRoutingState.gateSatisfied
      ? securityRoutingState.debtKind ?? "incomplete"
      : null;

  return {
    reviewPath: hasReview ? reviewPath : null,
    securityPath: hasSecurity ? securityPath : null,
    hasReview,
    hasSecurity,
    reviewableFiles,
    codeReviewEnabled: qualityGateSettings.codeReviewEnabled,
    securePhaseEnabled: qualityGateSettings.securePhaseEnabled,
    requiresCodeReview,
    requiresSecurePhase,
    requiresQualityGate,
    gatesSatisfied:
      missingGate === null && reviewDebtKind === null && securityDebtKind === null,
    missingGate,
    warnings,
    reviewNextSafeAction,
    reviewDebtKind,
    securityNextSafeAction:
      securityDebtKind === null ? null : securityRoutingState.nextSafeAction,
    securityDebtKind
  };
}

export function formatPhaseQualityGateDebtReason(
  args:
    | Pick<
        PhaseQualityGateEvaluation,
        | "requiresCodeReview"
        | "missingGate"
        | "reviewableFiles"
        | "reviewNextSafeAction"
        | "reviewDebtKind"
        | "securityDebtKind"
      >
    | Pick<
        PhaseQualityGateEvaluation,
        | "requiresCodeReview"
        | "requiresQualityGate"
        | "missingGate"
        | "reviewableFiles"
        | "reviewNextSafeAction"
        | "reviewDebtKind"
        | "securityDebtKind"
      >
): string | null {
  const requiresQualityGate =
    ("requiresQualityGate" in args ? args.requiresQualityGate : undefined) ??
    args.requiresCodeReview;

  if (!requiresQualityGate) {
    return null;
  }

  const reviewableFileCount = args.reviewableFiles.length;

  if (args.missingGate === "review") {
    return `REVIEW evidence is missing for ${reviewableFileCount} reviewable file(s).`;
  }

  if (args.missingGate === "security") {
    return `SECURITY evidence is missing for ${reviewableFileCount} reviewable file(s).`;
  }

  if (args.securityDebtKind === "blocked") {
    return `Saved security evidence still has blocking threat debt for ${reviewableFileCount} reviewable file(s).`;
  }

  if (args.securityDebtKind === "incomplete") {
    return `Saved security evidence is not complete for ${reviewableFileCount} reviewable file(s).`;
  }

  if (args.reviewDebtKind === "remediation") {
    return `Saved review remediation debt remains for ${reviewableFileCount} reviewable file(s).`;
  }

  if (args.reviewDebtKind === "follow-up") {
    return `Saved review follow-up remains for ${reviewableFileCount} reviewable file(s).`;
  }

  return null;
}

export function buildPhaseQualityGateNextAction(
  args: PhaseQualityGateRoutingArgs
): string | null {
  const phaseNumber = normalizeBlueprintPhaseRef(args.phaseNumber);
  const requiresQualityGate =
    args.evaluation.requiresQualityGate ?? args.evaluation.requiresCodeReview;
  const requiresSecurePhase =
    args.evaluation.requiresSecurePhase ?? args.evaluation.missingGate === "security";

  if (
    requiresQualityGate &&
    args.evaluation.missingGate === "review" &&
    isImplementedCommand(args.implementedCommandNames, "code-review")
  ) {
    return `Run /blu-code-review ${phaseNumber} to satisfy the phase code review gate.`;
  }

  if (
    requiresSecurePhase &&
    args.evaluation.missingGate === "security" &&
    isImplementedCommand(args.implementedCommandNames, "secure-phase")
  ) {
    return `Run /blu-secure-phase ${phaseNumber} to satisfy the phase security gate.`;
  }

  if (requiresSecurePhase && args.evaluation.securityDebtKind !== null) {
    const securityNextSafeAction = implementedRepairNextSafeAction(
      args.evaluation.securityNextSafeAction,
      args.implementedCommandNames
    );

    if (securityNextSafeAction !== null) {
      return `Run ${securityNextSafeAction}.`;
    }

    if (isImplementedCommand(args.implementedCommandNames, "secure-phase")) {
      return `Run /blu-secure-phase ${phaseNumber} to complete the phase security gate.`;
    }
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
        requiresSecurePhase,
        hasSecurity: args.evaluation.hasSecurity
      }) &&
      isImplementedCommand(args.implementedCommandNames, commandName)
    ) {
      return `Run ${reviewNextSafeAction}.`;
    }
  }

  if (
    args.evaluation.reviewDebtKind === "remediation" &&
    isImplementedCommand(args.implementedCommandNames, "code-review-fix")
  ) {
    return `Run /blu-code-review-fix ${phaseNumber} to continue resolving saved review remediation debt.`;
  }

  if (args.evaluation.gatesSatisfied || !requiresQualityGate) {
    return null;
  }

  return null;
}
