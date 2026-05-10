import {
  formatBlueprintPhasePrefix,
  normalizeBlueprintPhaseRef
} from "../../shared/security.js";

export type NumericInput = string | number;

export function normalizeBlueprintInput(value: NumericInput): string {
  if (typeof value === "number") {
    return String(value);
  }

  const trimmed = value.trim();
  const quoteMatch = trimmed.match(/^(['"])([\s\S]+)\1$/);

  return quoteMatch ? quoteMatch[2].trim() : value;
}

export function normalizePhaseNumber(value: NumericInput): string {
  return normalizeBlueprintPhaseRef(normalizeBlueprintInput(value));
}

export function basePhaseNumber(value: NumericInput): string {
  return normalizePhaseNumber(value).split(".")[0] ?? normalizePhaseNumber(value);
}

export function comparePhaseNumbers(left: NumericInput, right: NumericInput): number {
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

export function formatPhasePrefix(value: NumericInput): string {
  return formatBlueprintPhasePrefix(normalizeBlueprintInput(value));
}

export function extractPhaseNumberToken(value: NumericInput): string | null {
  const match = normalizeBlueprintInput(value).trim().match(/(\d+(?:\.\d+)?)/);
  return match ? normalizePhaseNumber(match[1]) : null;
}

export function extractExactPhaseNumberToken(value: NumericInput): string | null {
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : null;
  }

  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  return normalizePhaseNumber(trimmed);
}

export function isIntegerPhaseNumber(value: NumericInput): boolean {
  return !normalizePhaseNumber(value).includes(".");
}

export function slugToTitle(value: string): string {
  return value
    .split("-")
    .filter((segment) => segment.length > 0)
    .map((segment) => `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`)
    .join(" ");
}

export function normalizePhaseDescription(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ");
}

export function slugifyPhaseName(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .toLowerCase()
    .replace(/[_\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : "new-phase";
}
