import { promises as fs } from "node:fs";

import * as z from "zod/v4";

import {
  ensureParentDirectory,
  ensureRepoRoot,
  resolveBlueprintPath
} from "./artifacts.js";
import { blueprintPhaseLocate } from "./phase.js";

type ReviewArtifactKind =
  | "code-review"
  | "peer-review"
  | "review-fix"
  | "security"
  | "ui-review";

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

export const reviewToolDefinitions = [
  {
    name: "blueprint_review_record",
    description:
      "Persist a phase-scoped Blueprint review artifact such as SECURITY, REVIEW, or UI-REVIEW with overwrite protection.",
    inputSchema: reviewRecordInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintReviewRecord(args as ReviewRecordArgs)
  }
];
