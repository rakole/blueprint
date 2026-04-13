import { existsSync, realpathSync } from "node:fs";
import path from "node:path";

const DEFAULT_MAX_JSON_BYTES = 512 * 1024;
const STRONG_PROMPT_INJECTION_PATTERNS = [
  /ignore (?:all )?previous instructions/i,
  /forget (?:all )?previous instructions/i,
  /override the rules/i,
  /disregard (?:all )?(?:earlier|previous) instructions/i,
  /follow (?:only|these) instructions instead/i
] as const;
const CONTEXTUAL_PROMPT_MARKER_PATTERNS = [
  /system prompt/i,
  /developer message/i,
  /prompt injection/i,
  /jailbreak/i
] as const;
const UNSAFE_DISPLAY_MARKER_PATTERNS = [
  /<\s*system\b[^>]*>/i,
  /<\s*developer\b[^>]*>/i,
  /<\s*assistant\b[^>]*>/i,
  /<\s*tool\b[^>]*>/i,
  /<<\s*sys\s*>>/i
] as const;
const INVISIBLE_OR_CONTROL_CHARACTERS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
const FIELD_NAME_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;
const PHASE_REFERENCE_PATTERN = /^\d+(?:\.\d+)*$/;
const NUMERIC_ARTIFACT_ID_PATTERN = /^\d+$/;

export type PromptBoundaryFindingType =
  | "prompt-injection"
  | "prompt-context"
  | "unsafe-display"
  | "encoded-payload"
  | "control-character";

export type PromptBoundaryFindingSeverity = "warning" | "error";

export type PromptBoundaryFinding = {
  type: PromptBoundaryFindingType;
  severity: PromptBoundaryFindingSeverity;
  message: string;
};

export type PromptBoundaryAnalysis = {
  sanitizedText: string;
  findings: PromptBoundaryFinding[];
  warnings: string[];
  errors: string[];
  hasWarnings: boolean;
  hasErrors: boolean;
};

type JsonParseOptions = {
  label?: string;
  maxBytes?: number;
};

type PersistencePreparationOptions = {
  label?: string;
};

type ResolvePathOptions = {
  label?: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shannonEntropy(value: string): number {
  if (value.length === 0) {
    return 0;
  }

  const counts = new Map<string, number>();

  for (const character of value) {
    counts.set(character, (counts.get(character) ?? 0) + 1);
  }

  let entropy = 0;

  for (const count of counts.values()) {
    const probability = count / value.length;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

function resolveRealishPathSync(targetPath: string): string {
  const absoluteTarget = path.resolve(targetPath);

  if (existsSync(absoluteTarget)) {
    return realpathSync.native(absoluteTarget);
  }

  const pendingSegments: string[] = [];
  let current = absoluteTarget;

  while (!existsSync(current)) {
    const parent = path.dirname(current);

    if (parent === current) {
      return absoluteTarget;
    }

    pendingSegments.unshift(path.basename(current));
    current = parent;
  }

  const realExistingPath = realpathSync.native(current);
  return path.join(realExistingPath, ...pendingSegments);
}

function isEscapingRoot(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative.startsWith("..") || path.isAbsolute(relative);
}

function findSuspiciousEncodedPayload(text: string): string | null {
  const tokens = text.match(/[A-Za-z0-9+/=]{128,}|[A-Fa-f0-9]{128,}/g) ?? [];

  for (const token of tokens) {
    const entropy = shannonEntropy(token);

    if (entropy >= 4.4) {
      return token.slice(0, 24);
    }
  }

  return null;
}

export function assertNoNullBytes(value: string, label = "Value"): void {
  if (value.includes("\0")) {
    throw new Error(`${label} must not contain null bytes.`);
  }
}

export function ensurePathWithinRootSync(
  rootPath: string,
  candidatePath: string,
  options: ResolvePathOptions = {}
): string {
  const label = options.label ?? "Path";
  assertNoNullBytes(rootPath, "Root path");
  assertNoNullBytes(candidatePath, label);

  const resolvedRoot = resolveRealishPathSync(rootPath);
  const resolvedCandidate = resolveRealishPathSync(candidatePath);

  if (isEscapingRoot(resolvedRoot, resolvedCandidate)) {
    throw new Error(`${label} escapes the allowed root: ${candidatePath}`);
  }

  return path.resolve(candidatePath);
}

export function isPathWithinRootSync(rootPath: string, candidatePath: string): boolean {
  try {
    ensurePathWithinRootSync(rootPath, candidatePath, { label: "Path" });
    return true;
  } catch {
    return false;
  }
}

export function resolveRepoRelativeInputPathSync(
  rootPath: string,
  candidatePath: string,
  options: ResolvePathOptions = {}
): string {
  const label = options.label ?? "Path";
  assertNoNullBytes(candidatePath, label);

  if (candidatePath.trim().length === 0) {
    throw new Error(`${label} must not be blank.`);
  }

  if (path.isAbsolute(candidatePath)) {
    throw new Error(`${label} must be repo-relative, not absolute: ${candidatePath}`);
  }

  const absolutePath = path.resolve(rootPath, candidatePath);
  return ensurePathWithinRootSync(rootPath, absolutePath, options);
}

export function safeJsonParse<T = unknown>(
  raw: string,
  options: JsonParseOptions = {}
): T {
  const label = options.label ?? "JSON";
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BYTES;
  const size = Buffer.byteLength(raw, "utf8");

  if (size > maxBytes) {
    throw new Error(`${label} exceeds the ${maxBytes} byte safety limit.`);
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown parse error";
    throw new Error(`${label} is not valid JSON: ${reason}`);
  }
}

export function safeJsonParseObject<T extends Record<string, unknown> = Record<string, unknown>>(
  raw: string,
  options: JsonParseOptions = {}
): T {
  const label = options.label ?? "JSON object";
  const parsed = safeJsonParse<unknown>(raw, options);

  if (!isPlainObject(parsed)) {
    throw new Error(`${label} must contain a JSON object.`);
  }

  return parsed as T;
}

export function validateFieldNameSegment(segment: string, label = "Field name"): string {
  const trimmed = segment.trim();
  assertNoNullBytes(trimmed, label);

  if (trimmed.length === 0) {
    throw new Error(`${label} must not be blank.`);
  }

  if (!FIELD_NAME_SEGMENT_PATTERN.test(trimmed)) {
    throw new Error(`${label} contains unsupported characters: ${segment}`);
  }

  return trimmed;
}

export function normalizeBlueprintPhaseRef(value: string, label = "Phase reference"): string {
  const trimmed = value.trim();
  assertNoNullBytes(trimmed, label);

  if (!PHASE_REFERENCE_PATTERN.test(trimmed)) {
    throw new Error(`${label} must be a numeric Blueprint phase reference: ${value}`);
  }

  const normalized = trimmed
    .split(".")
    .map((segment) => {
      const normalized = segment.replace(/^0+(?=\d)/, "");
      return normalized.length > 0 ? normalized : "0";
    });

  while (normalized.length > 1 && normalized.at(-1) === "0") {
    normalized.pop();
  }

  return normalized.join(".");
}

export function formatBlueprintPhasePrefix(value: string): string {
  const normalized = normalizeBlueprintPhaseRef(value);
  const [head, ...rest] = normalized.split(".");

  return [head.padStart(2, "0"), ...rest].join(".");
}

export function normalizeNumericArtifactId(value: string, label = "Artifact id"): string {
  const trimmed = value.trim();
  assertNoNullBytes(trimmed, label);

  if (!NUMERIC_ARTIFACT_ID_PATTERN.test(trimmed)) {
    throw new Error(`${label} must be numeric: ${value}`);
  }

  return trimmed.padStart(2, "0");
}

export function sanitizeForDisplay(value: string): string {
  return value.replace(INVISIBLE_OR_CONTROL_CHARACTERS, "");
}

export function analyzePromptBoundaryText(text: string): PromptBoundaryAnalysis {
  const findings: PromptBoundaryFinding[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  let sanitizedText = text.replace(/\r\n/g, "\n");

  const removedCharacters = sanitizedText.match(INVISIBLE_OR_CONTROL_CHARACTERS)?.length ?? 0;

  if (removedCharacters > 0) {
    sanitizedText = sanitizedText.replace(INVISIBLE_OR_CONTROL_CHARACTERS, "");
    const message = `Removed ${removedCharacters} invisible or control character(s) before persistence.`;
    findings.push({
      type: "control-character",
      severity: "warning",
      message
    });
    warnings.push(message);
  }

  for (const pattern of STRONG_PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(sanitizedText)) {
      const message =
        "Content contains instruction-override language that is unsafe to persist inside Blueprint-managed artifacts.";
      findings.push({
        type: "prompt-injection",
        severity: "error",
        message
      });
      errors.push(message);
      break;
    }
  }

  for (const pattern of CONTEXTUAL_PROMPT_MARKER_PATTERNS) {
    if (pattern.test(sanitizedText)) {
      const message =
        "Content references prompt-boundary metadata and should be reviewed before reuse in model context.";
      findings.push({
        type: "prompt-context",
        severity: "warning",
        message
      });
      warnings.push(message);
      break;
    }
  }

  for (const pattern of UNSAFE_DISPLAY_MARKER_PATTERNS) {
    if (pattern.test(sanitizedText)) {
      const message =
        "Content includes protocol-style role markers that can confuse prompt or display boundaries.";
      findings.push({
        type: "unsafe-display",
        severity: "warning",
        message
      });
      warnings.push(message);
      break;
    }
  }

  const suspiciousPayload = findSuspiciousEncodedPayload(sanitizedText);

  if (suspiciousPayload) {
    const message =
      `Content includes a suspicious high-entropy payload (${suspiciousPayload}...) that is unsafe to persist without review.`;
    findings.push({
      type: "encoded-payload",
      severity: "error",
      message
    });
    errors.push(message);
  }

  return {
    sanitizedText,
    findings,
    warnings: [...new Set(warnings)],
    errors: [...new Set(errors)],
    hasWarnings: warnings.length > 0,
    hasErrors: errors.length > 0
  };
}

export function prepareTextForPersistence(
  text: string,
  options: PersistencePreparationOptions = {}
): { content: string; warnings: string[] } {
  const label = options.label ?? "Content";
  const analysis = analyzePromptBoundaryText(text);

  if (analysis.hasErrors) {
    throw new Error(`${label} is unsafe to persist. ${analysis.errors.join(" ")}`);
  }

  return {
    content: analysis.sanitizedText,
    warnings: analysis.warnings
  };
}

export function hasSuspiciousPromptBoundarySignals(text: string): boolean {
  return analyzePromptBoundaryText(text).findings.some(
    (finding) => finding.type !== "control-character"
  );
}
