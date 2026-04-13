import { promises as fs } from "node:fs";
import path from "node:path";

import * as z from "zod/v4";

import {
  ensureParentDirectory,
  ensureRepoRoot,
  resolveBlueprintPath,
  resolveRepoRelativePath,
  toRepoRelativePath,
  validatePlanArtifactContent
} from "./artifacts.js";
import { blueprintPhaseLocate } from "./phase.js";

type ReviewArtifactKind =
  | "code-review"
  | "peer-review"
  | "review-fix"
  | "security"
  | "ui-review";

type ReviewFindingSeverity = "critical" | "high" | "medium" | "low" | "unknown";

type ReviewFinding = {
  id: string;
  severity: ReviewFindingSeverity;
  summary: string;
  sourceSection: string | null;
};

type ReviewRecordArgs = {
  cwd?: string;
  phase?: string;
  artifact: ReviewArtifactKind;
  content: string;
  overwrite?: boolean;
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

type ReviewScopeArgs = {
  cwd?: string;
  phase?: string;
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
    source: "phase-plans" | "explicit-files" | "mixed";
  };
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

type ReviewLoadFindingsArgs = {
  cwd?: string;
  phase?: string;
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

const reviewRecordInputSchema = {
  cwd: z.string().optional(),
  phase: z.string().optional(),
  artifact: z.enum([
    "code-review",
    "peer-review",
    "review-fix",
    "security",
    "ui-review"
  ]),
  content: z.string(),
  overwrite: z.boolean().optional()
};

const reviewScopeInputSchema = {
  cwd: z.string().optional(),
  phase: z.string().optional(),
  files: z.array(z.string()).optional(),
  depth: z.enum(["quick", "standard", "deep"]).optional()
};

const reviewLoadFindingsInputSchema = {
  cwd: z.string().optional(),
  phase: z.string().optional(),
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
    .replace(/^\[(?:critical|high|medium|low|p[0-3])\]\s*[:\-]?\s*/i, "")
    .replace(/^(?:critical|high|medium|low|p[0-3])\s*[:\-]\s*/i, "")
    .replace(/^severity\s*[:\-]\s*(?:critical|high|medium|low)\s*[:\-]?\s*/i, "")
    .trim();
}

function parseFindingsFromArtifact(content: string): {
  findings: ReviewFinding[];
  severityCounts: Record<ReviewFindingSeverity, number>;
  followUps: string[];
} {
  const entries = extractMarkdownSectionEntries(
    content,
    /^(findings?|security findings|risks?|gaps found|unresolved gaps)$/i
  );
  const findings: ReviewFinding[] = [];
  const seenSummaries = new Set<string>();
  const severityCounts = emptySeverityCounts();

  for (const entry of entries) {
    for (const item of entry.items) {
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

  return {
    findings,
    severityCounts,
    followUps: extractMarkdownSectionItems(
      content,
      /^(follow-?ups?|follow-up fixes|suggested repairs|recommended fixes|next actions?)$/i
    )
  };
}

function collectReviewCounts(content: string): {
  counts: ReviewRecordResult["counts"];
  followUps: string[];
} {
  const findings = extractMarkdownSectionItems(
    content,
    /^(findings?|security findings|risks?|gaps found|unresolved gaps)$/i
  );
  const followUps = extractMarkdownSectionItems(
    content,
    /^(follow-?ups?|follow-up fixes|suggested repairs|recommended fixes|next actions?)$/i
  );

  return {
    counts: {
      sections: countMarkdownSections(content),
      findings: findings.length,
      followUps: followUps.length
    },
    followUps
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
): Promise<string[]> {
  const resolvedFiles = new Set<string>();

  for (const rawFile of files) {
    const requestedPath = rawFile.trim();

    if (requestedPath.length === 0) {
      continue;
    }

    let absolutePath: string;

    try {
      absolutePath = resolveRepoRelativePath(projectRoot, requestedPath);
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? error.message
          : `Could not resolve explicit review path: ${requestedPath}`
      );
      continue;
    }

    const relativePath = toRepoRelativePath(projectRoot, absolutePath);

    if (relativePath.startsWith(".blueprint/")) {
      warnings.push(
        `Skipped Blueprint artifact path from explicit review scope: ${relativePath}`
      );
      continue;
    }

    let stats;

    try {
      stats = await fs.stat(absolutePath);
    } catch {
      warnings.push(`Skipped missing explicit review path: ${relativePath}`);
      continue;
    }

    if (!stats.isFile()) {
      warnings.push(`Skipped non-file explicit review path: ${relativePath}`);
      continue;
    }

    resolvedFiles.add(relativePath);
  }

  return [...resolvedFiles];
}

async function deriveReviewFilesFromPlans(
  projectRoot: string,
  located: {
    phaseNumber: string;
    phasePrefix: string;
    artifacts: string[];
  },
  warnings: string[]
): Promise<string[]> {
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

    return [];
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

    return [];
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

  return [...resolvedFiles].sort((left, right) => left.localeCompare(right));
}

export async function blueprintReviewScope(
  args: ReviewScopeArgs
): Promise<ReviewScopeResult> {
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
      status: "invalid",
      phase: null,
      files: [],
      reviewMode: {
        depth: args.depth ?? "standard",
        source: (args.files?.length ?? 0) > 0 ? "explicit-files" : "phase-plans"
      },
      artifacts: {
        plans: [],
        summaries: [],
        verification: null,
        uat: null,
        existingReview: null,
        security: null
      },
      reason: located.reason ?? "Phase could not be resolved for review scoping.",
      warnings: located.warnings
    };
  }

  const warnings = [...located.warnings];
  const explicitFiles = await normalizeExplicitReviewFiles(
    projectRoot,
    args.files ?? [],
    warnings
  );
  const derivedFiles = await deriveReviewFilesFromPlans(
    projectRoot,
    {
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      artifacts: located.artifacts
    },
    warnings
  );
  const files = [...new Set([...explicitFiles, ...derivedFiles])];
  const source =
    explicitFiles.length > 0 && derivedFiles.length > 0
      ? "mixed"
      : explicitFiles.length > 0
        ? "explicit-files"
        : "phase-plans";
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

  if (files.length === 0) {
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
        depth: args.depth ?? "standard",
        source
      },
      artifacts,
      reason:
        explicitFiles.length > 0
          ? "No valid repo files remained in the explicit review scope."
          : "Blueprint could not derive any reviewable repo files from the executed phase plans. Re-run with explicit --files paths or restore the saved plan metadata.",
      warnings
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
      depth: args.depth ?? "standard",
      source
    },
    artifacts,
    reason: null,
    warnings
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

  const normalizedContent = normalizeTextContent(args.content);
  const { counts, followUps } = collectReviewCounts(normalizedContent);
  const reportPath = `${located.phaseDir}/${located.phasePrefix}${REVIEW_ARTIFACT_SUFFIXES[args.artifact]}`;
  const absolutePath = resolveBlueprintPath(projectRoot, reportPath);
  const exists = await pathExists(absolutePath);
  const warnings: string[] = [];

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
      warnings: [`${reportPath} content must not be empty.`]
    };
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

  await ensureParentDirectory(absolutePath);
  await fs.writeFile(absolutePath, normalizedContent, "utf8");

  if (exists) {
    warnings.push(`Replaced existing review artifact: ${reportPath}`);
  }

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
  const parsed = parseFindingsFromArtifact(content);

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
      "Resolve a phase-backed Blueprint code-review scope from executed plan metadata or explicit repo file paths.",
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
