import { promises as fs } from "node:fs";
import path from "node:path";

import * as z from "zod/v4";

import { prepareTextForPersistence } from "../../shared/security.js";
import {
  ensureRepoRoot,
  resolveBlueprintPath,
  resolveRepoRelativePath,
  toRepoRelativePath,
  validatePlanArtifactContent,
  validateReviewArtifactContent,
  validateReviewArtifactScopeCoverage,
  writeTextFile
} from "./artifacts.js";
import { blueprintConfigGet } from "./config.js";
import { blueprintPhaseLocate } from "./phase.js";

type ReviewArtifactKind =
  | "code-review"
  | "peer-review"
  | "review-fix"
  | "security"
  | "ui-review";

type NumericInput = string | number;

type ReviewFindingSeverity = "critical" | "high" | "medium" | "low" | "unknown";

type ReviewFinding = {
  id: string;
  severity: ReviewFindingSeverity;
  summary: string;
  sourceSection: string | null;
};

type ReviewRecordArgs = {
  cwd?: string;
  phase?: NumericInput;
  artifact: ReviewArtifactKind;
  content: string;
  overwrite?: boolean;
  scopeFiles?: string[];
};

type ReviewRecordResult = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  phaseDir: string;
  artifact: ReviewArtifactKind;
  reportPath: string;
  written: boolean;
  created: boolean;
  overwritten: boolean;
  status: "created" | "updated" | "reused" | "invalid";
  counts: {
    sections: number;
    findings: number;
    followUps: number;
  };
  followUps: string[];
  warnings: string[];
};

type ReviewDepth = "quick" | "standard" | "deep";
type ReviewModeSource =
  | "explicit-files"
  | "phase-plans"
  | "phase-summaries"
  | "phase-evidence";

type ReviewScopeConfirmation = {
  recommended: boolean;
  pendingGate: "none" | "scope-confirmation";
  reasons: string[];
  thresholds: {
    broadFileCount: number;
    multiPlanCount: number;
    deepFileCount: number;
  };
  signals: {
    fileCount: number;
    summaryCount: number;
    matchedPlanCount: number;
    depth: ReviewDepth;
    source: ReviewModeSource;
  };
};

type ReviewScopeArgs = {
  cwd?: string;
  phase?: NumericInput;
  files?: string[];
  depth?: ReviewDepth;
};

type ReviewScopeResult = {
  status: "ready" | "invalid";
  phase: {
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    phaseDir: string;
    resolvedFrom: "explicit" | "state" | "roadmap";
  } | null;
  files: string[];
  reviewMode: {
    depth: ReviewDepth;
    source: ReviewModeSource;
  };
  confirmationRecommended: ReviewScopeConfirmation;
  artifacts: {
    plans: string[];
    summaries: string[];
    verification: string | null;
    uat: string | null;
    existingReview: string | null;
    security: string | null;
  };
  reason: string | null;
  warnings: string[];
};

type NormalizeReviewFilesResult = {
  files: string[];
  rejected: boolean;
};

type ReviewLoadFindingsArgs = {
  cwd?: string;
  phase?: NumericInput;
  artifact?: ReviewArtifactKind;
};

type ReviewLoadFindingsResult = {
  phaseFound: boolean;
  found: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  artifact: ReviewArtifactKind;
  path: string | null;
  findings: ReviewFinding[];
  severityCounts: Record<ReviewFindingSeverity, number>;
  followUps: string[];
  reason: string | null;
  warnings: string[];
};

const REVIEW_ARTIFACT_SUFFIXES: Record<ReviewArtifactKind, string> = {
  "code-review": "-REVIEW.md",
  "peer-review": "-REVIEWS.md",
  "review-fix": "-REVIEW-FIX.md",
  security: "-SECURITY.md",
  "ui-review": "-UI-REVIEW.md"
};

const numericBlueprintInputSchema = z.union([z.string(), z.number()]);

const reviewRecordInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum([
    "code-review",
    "peer-review",
    "review-fix",
    "security",
    "ui-review"
  ]),
  content: z.string(),
  overwrite: z.boolean().optional(),
  scopeFiles: z.array(z.string()).optional()
};

const reviewScopeInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  files: z.array(z.string()).optional(),
  depth: z.enum(["quick", "standard", "deep"]).optional()
};

const reviewLoadFindingsInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z
    .enum(["code-review", "peer-review", "review-fix", "security", "ui-review"])
    .optional()
};

function normalizeTextContent(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function countMarkdownSections(content: string): number {
  return [...content.matchAll(/^##?\s+.+$/gm)].length;
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

function extractMarkdownSectionItems(
  content: string,
  headingPattern: RegExp
): string[] {
  const lines = content.split("\n");
  const items: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const headingMatch = lines[index].match(/^(##+)\s+(.+)$/);

    if (!headingMatch || !headingPattern.test(headingMatch[2].trim())) {
      continue;
    }

    const sectionLevel = headingMatch[1].length;
    const sectionLines: string[] = [];

    for (let innerIndex = index + 1; innerIndex < lines.length; innerIndex += 1) {
      const nextHeadingMatch = lines[innerIndex].match(/^(##+)\s+(.+)$/);

      if (nextHeadingMatch && nextHeadingMatch[1].length <= sectionLevel) {
        break;
      }

      sectionLines.push(lines[innerIndex]);
    }

    items.push(...collectListItems(sectionLines.join("\n")));
  }

  return [...new Set(items)];
}

function normalizeReviewListItem(item: string): string {
  return normalizeFindingSummary(item)
    .replace(/^`+|`+$/g, "")
    .replace(/^[\s"'“”‘’()[\]{}<>]+|[\s"'“”‘’()[\]{}<>.,;:!?]+$/g, "")
    .trim()
    .toLowerCase();
}

function hasGlobPattern(candidate: string): boolean {
  return /[*?[\]{}]/.test(candidate);
}

function isPlaceholderReviewListItem(item: string): boolean {
  const normalized = normalizeReviewListItem(item);

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

function collectSubstantiveReviewItems(
  content: string,
  headingPattern: RegExp
): string[] {
  return extractMarkdownSectionItems(content, headingPattern).filter(
    (item) => !isPlaceholderReviewListItem(item)
  );
}

function extractMarkdownSectionContent(
  content: string,
  headingPattern: RegExp
): string[] {
  const lines = content.split("\n");
  const sections: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const headingMatch = lines[index].match(/^(##+)\s+(.+)$/);

    if (!headingMatch || !headingPattern.test(headingMatch[2].trim())) {
      continue;
    }

    const sectionLevel = headingMatch[1].length;
    const sectionLines: string[] = [];

    for (let innerIndex = index + 1; innerIndex < lines.length; innerIndex += 1) {
      const nextHeadingMatch = lines[innerIndex].match(/^(##+)\s+(.+)$/);

      if (nextHeadingMatch && nextHeadingMatch[1].length <= sectionLevel) {
        break;
      }

      sectionLines.push(lines[innerIndex]);
    }

    sections.push(sectionLines.join("\n"));
  }

  return sections;
}

function parseSecurityThreatRegisterFindings(content: string): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  const seenSummaries = new Set<string>();

  for (const section of extractMarkdownSectionContent(content, /^Threat Register$/i)) {
    let headers: string[] | null = null;

    for (const line of section.split("\n")) {
      const trimmed = line.trim();

      if (!trimmed.startsWith("|")) {
        continue;
      }

      const cells = trimmed
        .split("|")
        .map((cell) => cell.trim())
        .slice(1, -1);

      if (cells.length < 4) {
        continue;
      }

      if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
        continue;
      }

      const normalizedCells = cells.map((cell) =>
        cell.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
      );

      if (
        headers === null &&
        normalizedCells.some((cell) => cell === "threat id")
      ) {
        headers = normalizedCells;
        continue;
      }

      const findHeaderIndex = (patterns: RegExp[]): number =>
        headers?.findIndex((header) => patterns.some((pattern) => pattern.test(header))) ?? -1;

      const threatIdIndex = findHeaderIndex([/^threat id$/]);
      const dispositionIndex = findHeaderIndex([/^disposition$/]);
      const mitigationIndex = findHeaderIndex([/^mitigation$/]);
      const statusIndex = findHeaderIndex([/^status$/]);
      const evidenceIndex = findHeaderIndex([/^evidence(?: note)?$/, /^evidence .* note$/]);
      const hasRichFallbackShape = cells.length >= 7;

      const threatId = cells[threatIdIndex >= 0 ? threatIdIndex : 0] ?? "";
      const disposition =
        cells[
          dispositionIndex >= 0
            ? dispositionIndex
            : hasRichFallbackShape
              ? 3
              : 1
        ] ?? "";
      const mitigation =
        cells[
          mitigationIndex >= 0
            ? mitigationIndex
            : hasRichFallbackShape
              ? 4
              : -1
        ] ?? "";
      const status =
        cells[
          statusIndex >= 0
            ? statusIndex
            : hasRichFallbackShape
              ? 5
              : 2
        ] ?? "";
      const evidence =
        cells[
          evidenceIndex >= 0
            ? evidenceIndex
            : hasRichFallbackShape
              ? 6
              : 3
        ] ?? "";

      if (
        threatId.length === 0 ||
        threatId === "Threat ID" ||
        !/\bopen\b/i.test(status)
      ) {
        continue;
      }

      const evidenceNote = evidence.length > 0 ? evidence : mitigation;
      const summary = normalizeFindingSummary(
        `Open threat ${threatId}: ${evidenceNote.length > 0 ? evidenceNote : `${disposition} ${status}`}`
      );

      if (summary.length === 0 || seenSummaries.has(summary)) {
        continue;
      }

      seenSummaries.add(summary);
      findings.push({
        id: `F-${String(findings.length + 1).padStart(2, "0")}`,
        severity: "unknown",
        summary,
        sourceSection: "Threat Register"
      });
    }
  }

  return findings;
}

function extractMarkdownSectionEntries(
  content: string,
  headingPattern: RegExp
): Array<{
  heading: string;
  items: string[];
}> {
  const lines = content.split("\n");
  const entries: Array<{
    heading: string;
    items: string[];
  }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const headingMatch = lines[index].match(/^(##+)\s+(.+)$/);

    if (!headingMatch || !headingPattern.test(headingMatch[2].trim())) {
      continue;
    }

    const sectionLevel = headingMatch[1].length;
    const sectionLines: string[] = [];

    for (let innerIndex = index + 1; innerIndex < lines.length; innerIndex += 1) {
      const nextHeadingMatch = lines[innerIndex].match(/^(##+)\s+(.+)$/);

      if (nextHeadingMatch && nextHeadingMatch[1].length <= sectionLevel) {
        break;
      }

      sectionLines.push(lines[innerIndex]);
    }

    const items = [...new Set(collectListItems(sectionLines.join("\n")))];

    if (items.length > 0) {
      entries.push({
        heading: headingMatch[2].trim(),
        items
      });
    }
  }

  return entries;
}

function emptySeverityCounts(): Record<ReviewFindingSeverity, number> {
  return {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0
  };
}

function inferFindingSeverity(
  heading: string,
  item: string
): ReviewFindingSeverity {
  const source = `${heading} ${item}`.toLowerCase();

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

function normalizeFindingSummary(item: string): string {
  return item
    .replace(
      /^(?:\[(?:critical|high|medium|low|unknown|p[0-3]|blocker|follow-?up|observation|pass)\]\s*)+/i,
      ""
    )
    .replace(/^(?:critical|high|medium|low|p[0-3])\s*[:\-]\s*/i, "")
    .replace(
      /^severity\s*[:\-]\s*(?:critical|high|medium|low|unknown)\s*[:\-]?\s*/i,
      ""
    )
    .trim();
}

function resolveFindingsHeadingPattern(artifact: ReviewArtifactKind): RegExp {
  if (artifact === "review-fix") {
    return /^(findings addressed|findings)$/i;
  }

  return /^(findings?|security findings|risks?|gaps found|unresolved gaps)$/i;
}

function parseFindingsFromArtifact(
  content: string,
  artifact: ReviewArtifactKind
): {
  findings: ReviewFinding[];
  severityCounts: Record<ReviewFindingSeverity, number>;
  followUps: string[];
} {
  const entries = extractMarkdownSectionEntries(content, resolveFindingsHeadingPattern(artifact));
  const findings: ReviewFinding[] = [];
  const seenSummaries = new Set<string>();
  const severityCounts = emptySeverityCounts();

  for (const entry of entries) {
    for (const item of entry.items) {
      if (isPlaceholderReviewListItem(item)) {
        continue;
      }

      const summary = normalizeFindingSummary(item);

      if (summary.length === 0 || seenSummaries.has(summary)) {
        continue;
      }

      const severity = inferFindingSeverity(entry.heading, item);
      seenSummaries.add(summary);
      severityCounts[severity] += 1;
      findings.push({
        id: `F-${String(findings.length + 1).padStart(2, "0")}`,
        severity,
        summary,
        sourceSection: entry.heading
      });
    }
  }

  if (artifact === "security") {
    for (const threatFinding of parseSecurityThreatRegisterFindings(content)) {
      if (seenSummaries.has(threatFinding.summary)) {
        continue;
      }

      seenSummaries.add(threatFinding.summary);
      severityCounts[threatFinding.severity] += 1;
      findings.push({
        id: `F-${String(findings.length + 1).padStart(2, "0")}`,
        severity: threatFinding.severity,
        summary: threatFinding.summary,
        sourceSection: threatFinding.sourceSection
      });
    }
  }

  return {
    findings,
    severityCounts,
    followUps: collectSubstantiveReviewItems(
      content,
      /^(follow-?ups?|follow-up fixes|suggested repairs|recommended fixes|next actions?)$/i
    )
  };
}

function collectReviewCounts(
  content: string,
  artifact: ReviewArtifactKind
): {
  counts: ReviewRecordResult["counts"];
  followUps: string[];
} {
  const parsedFindings = parseFindingsFromArtifact(content, artifact);

  return {
    counts: {
      sections: countMarkdownSections(content),
      findings: parsedFindings.findings.length,
      followUps: parsedFindings.followUps.length
    },
    followUps: parsedFindings.followUps
  };
}

function parsePlanIdForSuffix(
  pathValue: string,
  phasePrefix: string,
  suffix: "PLAN" | "SUMMARY"
): string | null {
  const match = pathValue.match(
    new RegExp(`${phasePrefix.replace(".", "\\.")}-(\\d+)-${suffix}\\.md$`)
  );

  if (!match) {
    return null;
  }

  return match[1].padStart(2, "0");
}

function findPhaseArtifact(artifacts: string[], suffix: string): string | null {
  return artifacts.find((artifact) => artifact.endsWith(suffix)) ?? null;
}

async function readRepoFileIfPresent(
  projectRoot: string,
  relativePath: string
): Promise<string | null> {
  try {
    const absolutePath = resolveRepoRelativePath(projectRoot, relativePath);
    return await fs.readFile(absolutePath, "utf8");
  } catch {
    return null;
  }
}

async function normalizeExplicitReviewFiles(
  projectRoot: string,
  files: string[],
  warnings: string[]
): Promise<NormalizeReviewFilesResult> {
  return normalizeReviewFiles(projectRoot, files, warnings, "explicit review");
}

const REVIEW_SCOPE_CONFIRMATION_THRESHOLDS = {
  broadFileCount: 5,
  multiPlanCount: 2,
  deepFileCount: 3
} as const;

async function normalizeReviewFiles(
  projectRoot: string,
  files: string[],
  warnings: string[],
  sourceLabel: string
): Promise<NormalizeReviewFilesResult> {
  const resolvedFiles = new Set<string>();
  let rejected = false;

  for (const rawFile of files) {
    const requestedPath = rawFile.trim();

    if (requestedPath.length === 0) {
      continue;
    }

    if (path.isAbsolute(requestedPath)) {
      warnings.push(
        `Invalid ${sourceLabel} path: ${requestedPath} (absolute filesystem paths are not allowed).`
      );
      rejected = true;
      continue;
    }

    if (hasGlobPattern(requestedPath)) {
      warnings.push(
        `Invalid ${sourceLabel} path: ${requestedPath} (wildcards are not allowed).`
      );
      rejected = true;
      continue;
    }

    let absolutePath: string;

    try {
      absolutePath = resolveRepoRelativePath(projectRoot, requestedPath);
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Invalid ${sourceLabel} path: ${requestedPath} (${error.message})`
          : `Invalid ${sourceLabel} path: ${requestedPath} (could not be resolved).`
      );
      rejected = true;
      continue;
    }

    const relativePath = toRepoRelativePath(projectRoot, absolutePath);

    if (relativePath.startsWith(".blueprint/")) {
      warnings.push(
        `Invalid ${sourceLabel} path: ${relativePath} (.blueprint artifacts are not reviewable repo files).`
      );
      rejected = true;
      continue;
    }

    let stats;

    try {
      stats = await fs.stat(absolutePath);
    } catch {
      warnings.push(`Invalid ${sourceLabel} path: ${relativePath} (file does not exist).`);
      rejected = true;
      continue;
    }

    if (!stats.isFile()) {
      warnings.push(
        `Invalid ${sourceLabel} path: ${relativePath} (${stats.isDirectory() ? "directories" : "non-file entries"} are not allowed).`
      );
      rejected = true;
      continue;
    }

    resolvedFiles.add(relativePath);
  }

  return {
    files: [...resolvedFiles].sort((left, right) => left.localeCompare(right)),
    rejected
  };
}

function extractPathCandidates(text: string): string[] {
  const candidates = new Set<string>();

  for (const match of text.matchAll(/`([^`]+)`/g)) {
    candidates.add(match[1].trim());
  }

  for (const match of text.matchAll(
    /(?:^|[\s("'`])((?:\.{1,2}\/)?(?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+(?:\.[A-Za-z0-9._-]+)?)(?=$|[\s"'`),.;:!?])/g
  )) {
    candidates.add(match[1].trim());
  }

  return [...candidates].filter((candidate) => candidate.length > 0);
}

async function deriveReviewFilesFromSummaries(
  projectRoot: string,
  located: {
    artifacts: string[];
  },
  warnings: string[]
): Promise<{
  files: string[];
  summaryCount: number;
}> {
  const summaryFiles = located.artifacts.filter((artifact) =>
    artifact.endsWith("-SUMMARY.md")
  );

  if (summaryFiles.length === 0) {
    warnings.push(
      "No saved execution summaries were found for the selected phase, so Blueprint could not derive a review scope from summary evidence."
    );
  }

  const resolvedFiles = new Set<string>();

  for (const summaryPath of summaryFiles) {
    const content = await readRepoFileIfPresent(projectRoot, summaryPath);

    if (content === null) {
      warnings.push(`Skipped unreadable summary artifact while deriving review scope: ${summaryPath}`);
      continue;
    }

    const summaryEntries = extractMarkdownSectionEntries(
      content,
      /^changes made$/i
    );

    for (const entry of summaryEntries) {
      for (const candidate of extractPathCandidates(entry.items.join("\n"))) {
        let absolutePath: string;

        try {
          absolutePath = resolveRepoRelativePath(projectRoot, candidate);
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? error.message
              : `Could not resolve summary-derived review path from ${summaryPath}: ${candidate}`
          );
          continue;
        }

        const relativePath = toRepoRelativePath(projectRoot, absolutePath);

        if (relativePath.startsWith(".blueprint/")) {
          warnings.push(
            `Skipped Blueprint artifact path from ${summaryPath} review scope: ${relativePath}`
          );
          continue;
        }

        let stats;

        try {
          stats = await fs.stat(absolutePath);
        } catch {
          warnings.push(
            `Skipped missing repo path from ${summaryPath} review scope: ${relativePath}`
          );
          continue;
        }

        if (!stats.isFile()) {
          warnings.push(
            `Skipped non-file repo path from ${summaryPath} review scope: ${relativePath}`
          );
          continue;
        }

        resolvedFiles.add(relativePath);
      }
    }
  }

  return {
    files: [...resolvedFiles].sort((left, right) => left.localeCompare(right)),
    summaryCount: summaryFiles.length
  };
}

async function deriveReviewFilesFromPlans(
  projectRoot: string,
  located: {
    phaseNumber: string;
    phasePrefix: string;
    artifacts: string[];
  },
  warnings: string[]
): Promise<{
  files: string[];
  matchedPlanCount: number;
}> {
  const summaryPlanIds = new Set(
    located.artifacts
      .filter((artifact) => artifact.endsWith("-SUMMARY.md"))
      .map((artifact) => parsePlanIdForSuffix(artifact, located.phasePrefix, "SUMMARY"))
      .filter((planId): planId is string => planId !== null)
  );

  if (summaryPlanIds.size === 0) {
    warnings.push(
      "No execution summaries were found for the selected phase, so Blueprint could not derive a review scope from executed plans."
    );

    return {
      files: [],
      matchedPlanCount: 0
    };
  }

  const planPaths = located.artifacts.filter((artifact) => {
    if (!artifact.endsWith("-PLAN.md")) {
      return false;
    }

    const planId = parsePlanIdForSuffix(artifact, located.phasePrefix, "PLAN");
    return planId !== null && summaryPlanIds.has(planId);
  });

  if (planPaths.length === 0) {
    warnings.push(
      "Execution summaries exist, but the matching plan artifacts were missing, so Blueprint could not derive changed repo files for review."
    );

    return {
      files: [],
      matchedPlanCount: 0
    };
  }

  const resolvedFiles = new Set<string>();

  for (const planPath of planPaths) {
    const content = await readRepoFileIfPresent(projectRoot, planPath);

    if (content === null) {
      warnings.push(`Skipped unreadable plan artifact while deriving review scope: ${planPath}`);
      continue;
    }

    const validation = validatePlanArtifactContent(content, located.phaseNumber);

    if (!validation.valid) {
      warnings.push(
        `Plan metadata issues in ${planPath}: ${validation.issues.join(" ")}`
      );
    }

    for (const plannedPath of validation.metadata.filesModified) {
      const requestedPath = plannedPath.trim();

      if (requestedPath.length === 0) {
        continue;
      }

      if (requestedPath.includes("*")) {
        warnings.push(
          `Skipped wildcard review scope entry from ${planPath}: ${requestedPath}`
        );
        continue;
      }

      let absolutePath: string;

      try {
        absolutePath = resolveRepoRelativePath(projectRoot, requestedPath);
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? error.message
            : `Could not resolve planned review path from ${planPath}: ${requestedPath}`
        );
        continue;
      }

      const relativePath = toRepoRelativePath(projectRoot, absolutePath);

      if (relativePath.startsWith(".blueprint/")) {
        warnings.push(
          `Skipped Blueprint artifact path from ${planPath} review scope: ${relativePath}`
        );
        continue;
      }

      let stats;

      try {
        stats = await fs.stat(absolutePath);
      } catch {
        warnings.push(
          `Skipped missing repo path from ${planPath} review scope: ${relativePath}`
        );
        continue;
      }

      if (!stats.isFile()) {
        warnings.push(
          `Skipped non-file repo path from ${planPath} review scope: ${relativePath}`
        );
        continue;
      }

      resolvedFiles.add(relativePath);
    }
  }

  return {
    files: [...resolvedFiles].sort((left, right) => left.localeCompare(right)),
    matchedPlanCount: planPaths.length
  };
}

function determineReviewModeSource(
  explicitFiles: string[],
  summaryFiles: string[],
  planFiles: string[]
): ReviewModeSource {
  if (explicitFiles.length > 0) {
    return "explicit-files";
  }

  if (summaryFiles.length > 0 && planFiles.length > 0) {
    return "phase-evidence";
  }

  if (summaryFiles.length > 0) {
    return "phase-summaries";
  }

  return "phase-plans";
}

function buildReviewScopeConfirmation(args: {
  fileCount: number;
  summaryCount: number;
  matchedPlanCount: number;
  depth: ReviewDepth;
  source: ReviewModeSource;
}): ReviewScopeConfirmation {
  const reasons: string[] = [];

  if (args.fileCount >= REVIEW_SCOPE_CONFIRMATION_THRESHOLDS.broadFileCount) {
    reasons.push(
      `Resolved scope includes ${args.fileCount} files, meeting the broad-scope confirmation threshold of ${REVIEW_SCOPE_CONFIRMATION_THRESHOLDS.broadFileCount}.`
    );
  }

  if (
    args.source !== "explicit-files" &&
    args.summaryCount >= REVIEW_SCOPE_CONFIRMATION_THRESHOLDS.multiPlanCount
  ) {
    reasons.push(
      `Resolved scope includes evidence from ${args.summaryCount} executed plans, meeting the multi-plan confirmation threshold of ${REVIEW_SCOPE_CONFIRMATION_THRESHOLDS.multiPlanCount}.`
    );
  }

  if (
    args.depth === "deep" &&
    args.fileCount >= REVIEW_SCOPE_CONFIRMATION_THRESHOLDS.deepFileCount
  ) {
    reasons.push(
      `Deep review over ${args.fileCount} files meets the deep-review confirmation threshold of ${REVIEW_SCOPE_CONFIRMATION_THRESHOLDS.deepFileCount}.`
    );
  }

  return {
    recommended: reasons.length > 0,
    pendingGate: reasons.length > 0 ? "scope-confirmation" : "none",
    reasons,
    thresholds: { ...REVIEW_SCOPE_CONFIRMATION_THRESHOLDS },
    signals: {
      fileCount: args.fileCount,
      summaryCount: args.summaryCount,
      matchedPlanCount: args.matchedPlanCount,
      depth: args.depth,
      source: args.source
    }
  };
}

function resolveConfiguredReviewDepth(
  value: unknown,
  warnings: string[]
): ReviewDepth {
  if (value === "quick" || value === "standard" || value === "deep") {
    return value;
  }

  if (value !== undefined) {
    warnings.push(
      `Ignoring invalid workflow.code_review_depth value and using standard instead: ${String(value)}`
    );
  }

  return "standard";
}

async function resolveReviewSettings(projectRoot: string, requestedDepth?: ReviewDepth): Promise<{
  allowed: boolean;
  depth: ReviewDepth;
  warnings: string[];
}> {
  try {
    const config = await blueprintConfigGet({
      scope: "effective",
      cwd: projectRoot
    });
    const warnings = [...config.warnings];

    return {
      allowed: config.config.workflow.code_review,
      depth:
        requestedDepth ??
        resolveConfiguredReviewDepth(config.config.workflow.code_review_depth, warnings),
      warnings
    };
  } catch {
    return {
      allowed: true,
      depth: requestedDepth ?? "standard",
      warnings: ["Blueprint review config could not be read; using standard depth."]
    };
  }
}

export async function blueprintReviewScope(
  args: ReviewScopeArgs
): Promise<ReviewScopeResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate({
    cwd: projectRoot,
    phase: args.phase
  });
  const reviewSettings = await resolveReviewSettings(projectRoot, args.depth);
  const explicitScopeRequested = (args.files ?? []).some((candidate) => candidate.trim().length > 0);
  const artifacts = {
    plans: located.artifacts
      .filter((artifact) => artifact.endsWith("-PLAN.md"))
      .sort((left, right) => left.localeCompare(right)),
    summaries: located.artifacts
      .filter((artifact) => artifact.endsWith("-SUMMARY.md"))
      .sort((left, right) => left.localeCompare(right)),
    verification: findPhaseArtifact(located.artifacts, "-VERIFICATION.md"),
    uat: findPhaseArtifact(located.artifacts, "-UAT.md"),
    existingReview: findPhaseArtifact(located.artifacts, "-REVIEW.md"),
    security: findPhaseArtifact(located.artifacts, "-SECURITY.md")
  };

  if (
    !located.found ||
    !located.phaseNumber ||
    !located.phasePrefix ||
    !located.phaseDir
  ) {
    return {
      status: "invalid",
      phase: null,
      files: [],
      reviewMode: {
        depth: reviewSettings.depth,
        source: explicitScopeRequested ? "explicit-files" : "phase-plans"
      },
      confirmationRecommended: buildReviewScopeConfirmation({
        fileCount: 0,
        summaryCount: artifacts.summaries.length,
        matchedPlanCount: 0,
        depth: reviewSettings.depth,
        source: explicitScopeRequested ? "explicit-files" : "phase-plans"
      }),
      artifacts,
      reason: located.reason ?? "Phase could not be resolved for review scoping.",
      warnings: [...located.warnings, ...reviewSettings.warnings]
    };
  }

  if (!reviewSettings.allowed) {
    return {
      status: "invalid",
      phase: {
        phaseNumber: located.phaseNumber,
        phasePrefix: located.phasePrefix,
        phaseName:
          located.phaseName ??
          `Phase ${located.phasePrefix} ${path.basename(located.phaseDir)}`,
        phaseDir: located.phaseDir,
        resolvedFrom: located.resolvedFrom
      },
      files: [],
      reviewMode: {
        depth: reviewSettings.depth,
        source: explicitScopeRequested ? "explicit-files" : "phase-plans"
      },
      confirmationRecommended: buildReviewScopeConfirmation({
        fileCount: 0,
        summaryCount: artifacts.summaries.length,
        matchedPlanCount: 0,
        depth: reviewSettings.depth,
        source: explicitScopeRequested ? "explicit-files" : "phase-plans"
      }),
      artifacts,
      reason: "workflow.code_review is disabled in the effective Blueprint config.",
      warnings: [...located.warnings, ...reviewSettings.warnings]
    };
  }

  const warnings = [...located.warnings];
  const explicitScope = await normalizeExplicitReviewFiles(
    projectRoot,
    args.files ?? [],
    warnings
  );
  const explicitFiles = explicitScope.files;

  if (explicitScopeRequested && explicitScope.rejected) {
    return {
      status: "invalid",
      phase: {
        phaseNumber: located.phaseNumber,
        phasePrefix: located.phasePrefix,
        phaseName:
          located.phaseName ??
          `Phase ${located.phasePrefix} ${path.basename(located.phaseDir)}`,
        phaseDir: located.phaseDir,
        resolvedFrom: located.resolvedFrom
      },
      files: [],
      reviewMode: {
        depth: reviewSettings.depth,
        source: "explicit-files"
      },
      confirmationRecommended: buildReviewScopeConfirmation({
        fileCount: 0,
        summaryCount: artifacts.summaries.length,
        matchedPlanCount: 0,
        depth: reviewSettings.depth,
        source: "explicit-files"
      }),
      artifacts,
      reason:
        "Explicit review scope contained invalid `--files` entries. Re-run with only repo-relative file paths to existing repo files.",
      warnings: [...warnings, ...reviewSettings.warnings]
    };
  }
  let files: string[] = [];
  let source: ReviewModeSource = "phase-plans";
  let summaryCount = artifacts.summaries.length;
  let matchedPlanCount = 0;

  if (explicitFiles.length > 0) {
    files = explicitFiles;
    source = "explicit-files";
  } else {
    const summaryScope = await deriveReviewFilesFromSummaries(
      projectRoot,
      { artifacts: located.artifacts },
      warnings
    );
    const planScope = await deriveReviewFilesFromPlans(
      projectRoot,
      {
        phaseNumber: located.phaseNumber,
        phasePrefix: located.phasePrefix,
        artifacts: located.artifacts
      },
      warnings
    );

    files = [...new Set([...summaryScope.files, ...planScope.files])].sort((left, right) =>
      left.localeCompare(right)
    );
    summaryCount = summaryScope.summaryCount;
    matchedPlanCount = planScope.matchedPlanCount;
    source = determineReviewModeSource(explicitFiles, summaryScope.files, planScope.files);
  }
  if (files.length === 0) {
    const missingSummaries = artifacts.summaries.length === 0;
    const missingPlans = artifacts.plans.length === 0;

    if (missingSummaries) {
      warnings.push(
        "No saved SUMMARY artifacts were found for this phase; implicit review scope resolution requires saved execution evidence."
      );
    }

    if (missingPlans) {
      warnings.push(
        "No saved PLAN artifacts were found for this phase; implicit review scope resolution requires saved plan metadata."
      );
    }

    return {
      status: "invalid",
      phase: {
        phaseNumber: located.phaseNumber,
        phasePrefix: located.phasePrefix,
        phaseName:
          located.phaseName ??
          `Phase ${located.phasePrefix} ${path.basename(located.phaseDir)}`,
        phaseDir: located.phaseDir,
        resolvedFrom: located.resolvedFrom
      },
      files,
      reviewMode: {
        depth: reviewSettings.depth,
        source
      },
      confirmationRecommended: buildReviewScopeConfirmation({
        fileCount: files.length,
        summaryCount,
        matchedPlanCount,
        depth: reviewSettings.depth,
        source
      }),
      artifacts,
      reason:
        explicitScopeRequested
          ? "No valid repo files remained in the explicit review scope."
          : missingSummaries && missingPlans
            ? "Blueprint could not derive any reviewable repo files because saved SUMMARY and PLAN artifacts were missing for this phase. Re-run with explicit --files paths or restore the saved evidence."
            : missingSummaries
              ? "Blueprint could not derive any reviewable repo files because saved SUMMARY artifacts were missing for this phase. Re-run with explicit --files paths or restore the saved summaries."
              : missingPlans
                ? "Blueprint could not derive any reviewable repo files because saved PLAN artifacts were missing for this phase. Re-run with explicit --files paths or restore the saved plans."
                : "Blueprint could not derive any reviewable repo files from the saved SUMMARY/PLAN evidence. Re-run with explicit --files paths or update the saved artifacts to include repo file paths.",
      warnings: [...warnings, ...reviewSettings.warnings]
    };
  }

  return {
    status: "ready",
    phase: {
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName:
        located.phaseName ??
        `Phase ${located.phasePrefix} ${path.basename(located.phaseDir)}`,
      phaseDir: located.phaseDir,
      resolvedFrom: located.resolvedFrom
    },
    files,
      reviewMode: {
      depth: reviewSettings.depth,
      source
    },
    confirmationRecommended: buildReviewScopeConfirmation({
      fileCount: files.length,
      summaryCount,
      matchedPlanCount,
      depth: reviewSettings.depth,
      source
    }),
    artifacts,
    reason: null,
    warnings: [...warnings, ...reviewSettings.warnings]
  };
}

export async function blueprintReviewRecord(
  args: ReviewRecordArgs
): Promise<ReviewRecordResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate({
    cwd: projectRoot,
    phase: args.phase
  });

  if (
    !located.found ||
    !located.phaseNumber ||
    !located.phasePrefix ||
    !located.phaseDir
  ) {
    throw new Error(
      located.reason ?? "Phase could not be resolved for review persistence."
    );
  }

  const reportPath = `${located.phaseDir}/${located.phasePrefix}${REVIEW_ARTIFACT_SUFFIXES[args.artifact]}`;
  const prepared = prepareTextForPersistence(normalizeTextContent(args.content), {
    label: reportPath
  });
  const normalizedContent = normalizeTextContent(prepared.content);
  const { counts, followUps } = collectReviewCounts(normalizedContent, args.artifact);
  const absolutePath = resolveBlueprintPath(projectRoot, reportPath);
  const exists = await pathExists(absolutePath);
  const warnings: string[] = [...prepared.warnings];
  const validation = validateReviewArtifactContent(normalizedContent, args.artifact);
  const normalizedScopeFiles =
    args.artifact === "code-review"
      ? await normalizeReviewFiles(projectRoot, args.scopeFiles ?? [], warnings, "review scope")
      : { files: [], rejected: false };

  if (normalizedContent.trim().length === 0) {
    return {
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName ?? `Phase ${located.phasePrefix}`,
      phaseDir: located.phaseDir,
      artifact: args.artifact,
      reportPath,
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      counts,
      followUps,
      warnings: [...warnings, `${reportPath} content must not be empty.`]
    };
  }

  if (!validation.valid) {
    return {
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName ?? `Phase ${located.phasePrefix}`,
      phaseDir: located.phaseDir,
      artifact: args.artifact,
      reportPath,
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      counts,
      followUps,
      warnings: [...warnings, ...validation.issues]
    };
  }

  if (args.artifact === "code-review" && normalizedScopeFiles.rejected) {
    return {
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName ?? `Phase ${located.phasePrefix}`,
      phaseDir: located.phaseDir,
      artifact: args.artifact,
      reportPath,
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      counts,
      followUps,
      warnings: [
        ...warnings,
        "Code-review persistence received invalid scoped repo files. Re-run with the repo-relative `files` returned by blueprint_review_scope."
      ]
    };
  }

  if (args.artifact === "code-review" && normalizedScopeFiles.files.length > 0) {
    const scopedValidation = validateReviewArtifactScopeCoverage(
      normalizedContent,
      normalizedScopeFiles.files
    );

    if (!scopedValidation.valid) {
      return {
        phaseNumber: located.phaseNumber,
        phasePrefix: located.phasePrefix,
        phaseName: located.phaseName ?? `Phase ${located.phasePrefix}`,
        phaseDir: located.phaseDir,
        artifact: args.artifact,
        reportPath,
        written: false,
        created: false,
        overwritten: false,
        status: "invalid",
        counts,
        followUps,
        warnings: [...warnings, ...scopedValidation.issues]
      };
    }
  }

  if (exists) {
    const existingContent = await fs.readFile(absolutePath, "utf8");

    if (existingContent === normalizedContent) {
      warnings.push("Preserved existing review artifact because the content was unchanged.");

      return {
        phaseNumber: located.phaseNumber,
        phasePrefix: located.phasePrefix,
        phaseName: located.phaseName ?? `Phase ${located.phasePrefix}`,
        phaseDir: located.phaseDir,
        artifact: args.artifact,
        reportPath,
        written: false,
        created: false,
        overwritten: false,
        status: "reused",
        counts,
        followUps,
        warnings
      };
    }

    if (!(args.overwrite ?? false)) {
      throw new Error(
        `${reportPath} already exists. Re-run only after explicit overwrite confirmation.`
      );
    }
  }

  warnings.push(
    ...await writeTextFile(absolutePath, normalizedContent, {
      label: reportPath,
      enforcePromptBoundary: false
    })
  );

  if (exists) {
    warnings.push(`Replaced existing review artifact: ${reportPath}`);
  }

  warnings.push(...validation.warnings);

  return {
    phaseNumber: located.phaseNumber,
    phasePrefix: located.phasePrefix,
    phaseName: located.phaseName ?? `Phase ${located.phasePrefix}`,
    phaseDir: located.phaseDir,
    artifact: args.artifact,
    reportPath,
    written: true,
    created: !exists,
    overwritten: exists,
    status: exists ? "updated" : "created",
    counts,
    followUps,
    warnings
  };
}

export async function blueprintReviewLoadFindings(
  args: ReviewLoadFindingsArgs
): Promise<ReviewLoadFindingsResult> {
  const artifact = args.artifact ?? "code-review";
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate({
    cwd: projectRoot,
    phase: args.phase
  });

  if (
    !located.found ||
    !located.phaseNumber ||
    !located.phasePrefix ||
    !located.phaseDir
  ) {
    return {
      phaseFound: false,
      found: false,
      phaseNumber: null,
      phasePrefix: null,
      phaseName: null,
      phaseDir: null,
      artifact,
      path: null,
      findings: [],
      severityCounts: emptySeverityCounts(),
      followUps: [],
      reason:
        located.reason ?? "Phase could not be resolved for review findings loading.",
      warnings: located.warnings
    };
  }

  const artifactPath =
    located.artifacts.find((candidate) =>
      candidate.endsWith(REVIEW_ARTIFACT_SUFFIXES[artifact])
    ) ?? null;

  if (!artifactPath) {
    return {
      phaseFound: true,
      found: false,
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName ?? `Phase ${located.phasePrefix}`,
      phaseDir: located.phaseDir,
      artifact,
      path: null,
      findings: [],
      severityCounts: emptySeverityCounts(),
      followUps: [],
      reason: `Phase ${located.phaseNumber} does not have a saved ${REVIEW_ARTIFACT_SUFFIXES[artifact]} artifact yet.`,
      warnings: located.warnings
    };
  }

  const content = await fs.readFile(
    resolveBlueprintPath(projectRoot, artifactPath),
    "utf8"
  );
  const parsed = parseFindingsFromArtifact(content, artifact);

  return {
    phaseFound: true,
    found: true,
    phaseNumber: located.phaseNumber,
    phasePrefix: located.phasePrefix,
    phaseName: located.phaseName ?? `Phase ${located.phasePrefix}`,
    phaseDir: located.phaseDir,
    artifact,
    path: artifactPath,
    findings: parsed.findings,
    severityCounts: parsed.severityCounts,
    followUps: parsed.followUps,
    reason: null,
    warnings:
      parsed.findings.length === 0
        ? [
            ...located.warnings,
            `No structured findings were parsed from ${artifactPath}.`
          ]
        : located.warnings
  };
}

export const reviewToolDefinitions = [
  {
    name: "blueprint_review_scope",
    description:
      "Resolve a phase-backed Blueprint code-review scope, including effective review settings and saved phase evidence, from executed plan metadata or explicit repo file paths.",
    inputSchema: reviewScopeInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintReviewScope(args as ReviewScopeArgs)
  },
  {
    name: "blueprint_review_load_findings",
    description:
      "Load structured findings and severity counts from a saved phase-scoped Blueprint review artifact.",
    inputSchema: reviewLoadFindingsInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintReviewLoadFindings(args as ReviewLoadFindingsArgs)
  },
  {
    name: "blueprint_review_record",
    description:
      "Persist a phase-scoped Blueprint review artifact such as SECURITY, REVIEW, or UI-REVIEW with overwrite protection.",
    inputSchema: reviewRecordInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintReviewRecord(args as ReviewRecordArgs)
  }
];
