import {
  normalizeBlueprintInput,
  type NumericInput
} from "./phase-numbering.js";
import { normalizeNumericArtifactId } from "../../shared/security.js";

type PhasePlanPathLocation = {
  phaseDir: string;
  phasePrefix: string;
};

export function normalizePlanId(value: NumericInput): string {
  const normalizedInput = normalizeBlueprintInput(value).trim();

  if (/^0+$/.test(normalizedInput)) {
    throw new Error("Plan id must be greater than zero.");
  }

  return normalizeNumericArtifactId(normalizedInput, "Plan id");
}

export function parsePlanArtifactPath(
  pathValue: string,
  phasePrefix: string
): string | null {
  const match = pathValue.match(
    new RegExp(`${phasePrefix.replace(".", "\\.")}-(\\d+)-PLAN\\.md$`)
  );

  return match ? normalizePlanId(match[1]) : null;
}

export function planPathFor(
  located: PhasePlanPathLocation,
  planId: string
): string {
  return `${located.phaseDir}/${located.phasePrefix}-${normalizePlanId(planId)}-PLAN.md`;
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replacePlanSlotLabel(
  value: string,
  fromPlanId: string | null,
  toPlanId: string
): string {
  const candidates = new Set<string>(["YY"]);

  if (fromPlanId) {
    candidates.add(fromPlanId);
  }

  let updated = value;

  for (const candidate of candidates) {
    updated = updated.replace(
      new RegExp(`\\bPlan\\s+${escapeForRegex(candidate)}\\b`, "g"),
      `Plan ${toPlanId}`
    );
  }

  return updated;
}

export function extractPlanIdFromFrontmatterLine(line: string): string | null {
  const match = line.match(/^plan_id:\s*(?:"([^"]+)"|'([^']+)'|([^\s#]+))\s*$/);
  const rawValue = match?.[1] ?? match?.[2] ?? match?.[3] ?? null;

  if (!rawValue) {
    return null;
  }

  try {
    return normalizePlanId(rawValue);
  } catch {
    return null;
  }
}

function extractPlanSlotLabelFromFrontmatterLine(line: string): string | null {
  const match = line.match(/^plan_id:\s*(?:"([^"]+)"|'([^']+)'|([^\s#]+))\s*$/);
  const rawValue = match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
  const trimmed = rawValue?.trim() ?? "";

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  if (/^0+$/.test(trimmed)) {
    return trimmed.padStart(2, "0");
  }

  return normalizePlanId(trimmed);
}

function reconcilePlanTitleLine(
  line: string,
  fromPlanId: string | null,
  toPlanId: string
): string | null {
  const match = line.match(/^(\s*title:\s*)(.+)$/);

  if (!match) {
    return null;
  }

  const prefix = match[1] ?? "";
  const rawValue = match[2]?.trim() ?? "";
  const quoteMatch = rawValue.match(/^(['"])([\s\S]*?)\1$/);
  const quote = quoteMatch?.[1] ?? "";
  const value = quoteMatch?.[2] ?? rawValue;
  const updatedValue = replacePlanSlotLabel(value, fromPlanId, toPlanId);

  if (updatedValue === value) {
    return null;
  }

  return `${prefix}${quote}${updatedValue}${quote}`;
}

function reconcilePlanHeadingLine(
  line: string,
  fromPlanId: string | null,
  toPlanId: string
): string | null {
  if (!/^#\s+/.test(line)) {
    return null;
  }

  const updatedLine = replacePlanSlotLabel(line, fromPlanId, toPlanId);

  return updatedLine === line ? null : updatedLine;
}

export function reconcileAutoAssignedPlanContent(content: string, planId: string): string {
  const normalizedPlanId = normalizePlanId(planId);
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---(\n|$)/);

  if (!frontmatterMatch || frontmatterMatch.index === undefined) {
    return content;
  }

  const frontmatter = frontmatterMatch[1] ?? "";
  const updatedFrontmatterLines = frontmatter.split("\n");
  const sourcePlanId = updatedFrontmatterLines
    .map((line) => extractPlanSlotLabelFromFrontmatterLine(line))
    .find((value): value is string => value !== null)
    ?? null;
  const planIdLineIndex = updatedFrontmatterLines.findIndex((line) => /^plan_id:\s*/.test(line));

  if (planIdLineIndex >= 0) {
    updatedFrontmatterLines[planIdLineIndex] = `plan_id: "${normalizedPlanId}"`;
  } else {
    const phaseLineIndex = updatedFrontmatterLines.findIndex((line) => /^phase:\s*/.test(line));

    if (phaseLineIndex >= 0) {
      updatedFrontmatterLines.splice(phaseLineIndex + 1, 0, `plan_id: "${normalizedPlanId}"`);
    } else {
      updatedFrontmatterLines.unshift(`plan_id: "${normalizedPlanId}"`);
    }
  }

  const titleLineIndex = updatedFrontmatterLines.findIndex((line) => /^title:\s*/.test(line));

  if (titleLineIndex >= 0) {
    const updatedTitleLine = reconcilePlanTitleLine(
      updatedFrontmatterLines[titleLineIndex] ?? "",
      sourcePlanId,
      normalizedPlanId
    );

    if (updatedTitleLine) {
      updatedFrontmatterLines[titleLineIndex] = updatedTitleLine;
    }
  }

  const contentStart = frontmatterMatch.index;
  const contentAfterFrontmatter = content.slice(contentStart + frontmatterMatch[0].length);
  const reconciledBody =
    (() => {
      let headingRewritten = false;

      return contentAfterFrontmatter
        .split("\n")
        .map((line) => {
          if (headingRewritten || !/^#\s+/.test(line)) {
            return line;
          }

          headingRewritten = true;
          return reconcilePlanHeadingLine(line, sourcePlanId, normalizedPlanId) ?? line;
        })
        .join("\n");
    })();

  return `---\n${updatedFrontmatterLines.join("\n")}\n---${reconciledBody}`;
}

export function collectInvalidPlanDependencyIssues(planPath: string, dependsOn: string[]): string[] {
  const issues: string[] = [];

  for (const dependency of dependsOn) {
    try {
      normalizePlanId(dependency);
    } catch {
      issues.push(`${planPath}: invalid depends_on reference: ${dependency}`);
    }
  }

  return issues;
}

export function normalizeMaybePlanId(value: string | null): string | null {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  return normalizePlanId(value);
}

export function extractHeadingText(content: string): string | null {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
}

export function extractReferencedPlanId(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const placeholderMatch = value.match(/\bPlan\s+(YY)\b/i);

  if (placeholderMatch) {
    return placeholderMatch[1].toUpperCase();
  }

  const numericMatch = value.match(/\bPlan\s+(\d+)\b/i);

  if (!numericMatch) {
    return null;
  }

  try {
    return normalizePlanId(numericMatch[1]);
  } catch {
    return null;
  }
}
